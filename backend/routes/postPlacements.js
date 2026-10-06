const express = require('express');
const router = express.Router();
const cloudinary = require('cloudinary').v2;
const { auth, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const Application = require('../models/Application');
const User = require('../models/User');
const Job = require('../models/Job');
const PostPlacementTracking = require('../models/PostPlacementTracking');
const PostPlacementDocument = require('../models/PostPlacementDocument');
const Notification = require('../models/Notification');
const { buildRequiredDocuments, buildDocumentCompletion, buildDocumentKey, inferEmploymentType, normalizeDocumentType, parseDate, toPeriodKey } = require('../utils/postPlacement');

const placementPopulation = [
  { path: 'student', select: 'firstName lastName email campus studentProfile.currentStatus studentProfile.joiningDate studentProfile.currentSchool studentProfile.profileStatus' },
  { path: 'application', select: 'status offerDetails createdAt', populate: { path: 'job', select: 'title company jobType salary location' } },
  { path: 'job', select: 'title company jobType salary location' },
  { path: 'createdBy', select: 'firstName lastName email role' },
  { path: 'updatedBy', select: 'firstName lastName email role' }
];

const documentPopulation = [
  { path: 'verifiedBy', select: 'firstName lastName email role' },
  { path: 'uploadedBy', select: 'firstName lastName email role' }
];

const ensurePlacementFromApplication = async (application, actorId) => {
  if (!application?._id || !application.student || !application.job) return null;

  const existing = await PostPlacementTracking.findOne({ application: application._id });
  const job = application.job;
  const studentId = application.student._id || application.student;
  const placementPayload = {
    student: studentId,
    application: application._id,
    job: job._id || job,
    companyName: job.company?.name || '',
    designation: job.title || '',
    employmentType: inferEmploymentType(application),
    joiningDate: parseDate(application.offerDetails?.joiningDate),
    ctc: Number(application.offerDetails?.salary || job.salary?.max || job.salary?.min || null) || null,
    stipendOrSalary: Number(application.offerDetails?.salary || job.salary?.max || job.salary?.min || null) || null,
    currency: application.offerDetails?.currency || job.salary?.currency || 'INR',
    status: 'active',
    updatedBy: actorId
  };

  if (!existing) {
    placementPayload.createdBy = actorId;
    return PostPlacementTracking.create(placementPayload);
  }

  Object.assign(existing, placementPayload);
  return existing.save();
};

const loadPlacementForStudent = async (studentId) => {
  return PostPlacementTracking.findOne({ student: studentId })
    .sort({ createdAt: -1 })
    .populate(placementPopulation);
};

const canAccessPlacement = async (req, placement) => {
  if (!placement) return false;
  if (req.user.role === 'manager' || req.user.role === 'coordinator') return true;
  if (req.user.role === 'student') return String(placement.student?._id || placement.student) === String(req.userId);

  if (req.user.role === 'campus_poc') {
    const student = placement.student && placement.student.campus ? placement.student : await User.findById(placement.student).select('campus managedCampuses');
    if (!student) return false;
    const allowed = [];
    if (req.user.campus) allowed.push(String(req.user.campus));
    if (Array.isArray(req.user.managedCampuses)) {
      req.user.managedCampuses.forEach((campus) => allowed.push(String(campus)));
    }
    return student.campus ? allowed.includes(String(student.campus)) : false;
  }

  return false;
};

const buildPlacementResponse = async (placement) => {
  const documents = await PostPlacementDocument.find({ placement: placement._id })
    .populate(documentPopulation)
    .sort({ documentKey: 1 });
  const completion = buildDocumentCompletion(placement, documents);

  return {
    placement,
    documents,
    requiredDocuments: completion.requiredDocuments,
    completion: completion.completion
  };
};

const syncPlacementDocumentToStudentProfile = async ({ studentId, placementId, document }) => {
  const student = await User.findById(studentId).select('studentProfile');
  if (!student) return;

  if (!student.studentProfile) {
    student.studentProfile = { profileStatus: 'draft' };
  }

  if (!Array.isArray(student.studentProfile.postPlacementDocuments)) {
    student.studentProfile.postPlacementDocuments = [];
  }

  const entry = {
    placement: placementId || document.placement || null,
    documentId: document._id,
    documentType: document.documentType,
    documentKey: document.documentKey,
    documentPeriod: document.documentPeriod || null,
    fileUrl: document.fileUrl,
    storagePath: document.storagePath,
    originalName: document.originalName,
    mimeType: document.mimeType,
    fileSize: document.fileSize,
    verificationStatus: document.verificationStatus || 'Uploaded',
    rejectionReason: document.rejectionReason || '',
    uploadedAt: document.uploadedAt || new Date(),
    verifiedAt: document.verifiedAt || null,
    replacedAt: document.replacedAt || null,
    syncedAt: new Date()
  };

  const existingIndex = student.studentProfile.postPlacementDocuments.findIndex((item) => {
    if (item.documentId && String(item.documentId) === String(document._id)) return true;
    if (item.documentKey && document.documentKey && String(item.documentKey) === String(document.documentKey)) return true;
    return false;
  });

  if (existingIndex >= 0) {
    student.studentProfile.postPlacementDocuments[existingIndex] = {
      ...student.studentProfile.postPlacementDocuments[existingIndex],
      ...entry
    };
  } else {
    student.studentProfile.postPlacementDocuments.push(entry);
  }

  student.markModified('studentProfile.postPlacementDocuments');
  await student.save();
};

const syncPlacementDocumentsForPlacementToStudentProfile = async ({ studentId, placementId }) => {
  const documents = await PostPlacementDocument.find({ placement: placementId });
  for (const document of documents) {
    await syncPlacementDocumentToStudentProfile({
      studentId,
      placementId,
      document
    });
  }
};

router.get('/me', auth, authorize('student'), async (req, res) => {
  try {
    const placement = await loadPlacementForStudent(req.userId);
    if (!placement) {
      return res.json({ placement: null, documents: [], requiredDocuments: [], completion: { completed: 0, total: 0, percentage: 0 } });
    }

    await syncPlacementDocumentsForPlacementToStudentProfile({
      studentId: req.userId,
      placementId: placement._id
    });

    res.json(await buildPlacementResponse(placement));
  } catch (error) {
    console.error('Get my placement error:', error);
    res.status(500).json({ message: 'Failed to load post-placement details' });
  }
});

router.post('/me/self-report', auth, authorize('student'), async (req, res) => {
  try {
    const existingPlacement = await loadPlacementForStudent(req.userId);
    if (existingPlacement) {
      return res.status(409).json({ message: 'A placement record already exists for this student' });
    }

    const {
      companyName,
      designation,
      employmentType,
      joiningDate,
      internshipStartDate,
      internshipEndDate,
      hasFullTimeConversion,
      fullTimeConversionDate,
      ctc,
      stipendOrSalary,
      currency
    } = req.body;

    if (!companyName || !String(companyName).trim()) {
      return res.status(400).json({ message: 'Company name is required' });
    }

    if (!designation || !String(designation).trim()) {
      return res.status(400).json({ message: 'Designation is required' });
    }

    if (!['Internship', 'Paid Internship', 'Full-Time Placement'].includes(employmentType)) {
      return res.status(400).json({ message: 'Invalid employment type' });
    }

    const normalizedJoiningDate = joiningDate ? parseDate(joiningDate) : null;
    const normalizedStart = internshipStartDate ? parseDate(internshipStartDate) : null;
    const normalizedEnd = internshipEndDate ? parseDate(internshipEndDate) : null;
    const normalizedConversionDate = fullTimeConversionDate ? parseDate(fullTimeConversionDate) : null;

    if (employmentType === 'Full-Time Placement' && !normalizedJoiningDate) {
      return res.status(400).json({ message: 'Joining date is required for full-time placements' });
    }

    if (employmentType === 'Internship' || employmentType === 'Paid Internship') {
      if (hasFullTimeConversion !== true && hasFullTimeConversion !== false) {
        return res.status(400).json({ message: 'Please indicate whether the internship has a full-time conversion' });
      }
      if (!normalizedStart || !normalizedEnd) {
        return res.status(400).json({ message: 'Internship start and end dates are required' });
      }
      if (normalizedEnd < normalizedStart) {
        return res.status(400).json({ message: 'Internship end date cannot be before the start date' });
      }
    }

    const placement = await PostPlacementTracking.create({
      student: req.userId,
      companyName: String(companyName).trim(),
      designation: String(designation).trim(),
      employmentType,
      joiningDate: normalizedJoiningDate,
      internshipStartDate: normalizedStart,
      internshipEndDate: normalizedEnd,
      hasFullTimeConversion: employmentType === 'Full-Time Placement' ? null : hasFullTimeConversion === true,
      fullTimeConversionDate: employmentType === 'Full-Time Placement' ? null : normalizedConversionDate,
      ctc: ctc === '' || ctc === undefined ? null : Number(ctc),
      stipendOrSalary: stipendOrSalary === '' || stipendOrSalary === undefined ? null : Number(stipendOrSalary),
      currency: currency || 'INR',
      status: 'active',
      createdBy: req.userId,
      updatedBy: req.userId
    });

    await User.findByIdAndUpdate(req.userId, {
      'studentProfile.currentStatus': 'Placed'
    });

    res.status(201).json(await buildPlacementResponse(await placement.populate(placementPopulation)));
  } catch (error) {
    console.error('Self-report placement error:', error);
    res.status(500).json({ message: 'Failed to create self-reported placement' });
  }
});

router.delete('/me', auth, authorize('student'), async (req, res) => {
  try {
    const placement = await loadPlacementForStudent(req.userId);
    if (!placement) {
      return res.status(404).json({ message: 'No placement found for this student' });
    }

    const documents = await PostPlacementDocument.find({ placement: placement._id });
    await Promise.all(documents.map(async (document) => {
      if (!document.storagePath) return;
      try {
        await cloudinary.uploader.destroy(document.storagePath, { resource_type: 'raw' });
      } catch (cloudinaryErr) {
        console.warn('Unable to delete placement document from Cloudinary:', cloudinaryErr.message);
      }
    }));

    await PostPlacementDocument.deleteMany({ placement: placement._id });
    await PostPlacementTracking.deleteOne({ _id: placement._id });
    await User.findByIdAndUpdate(req.userId, { 'studentProfile.currentStatus': 'Active' });

    res.json({ message: 'Placement reset successfully' });
  } catch (error) {
    console.error('Reset placement error:', error);
    res.status(500).json({ message: 'Failed to reset placement' });
  }
});

router.put('/me', auth, authorize('student'), async (req, res) => {
  try {
    const placement = await loadPlacementForStudent(req.userId);
    if (!placement) {
      return res.status(404).json({ message: 'No placement found for this student' });
    }

    const {
      companyName,
      designation,
      employmentType,
      joiningDate,
      internshipStartDate,
      internshipEndDate,
      hasFullTimeConversion,
      fullTimeConversionDate,
      ctc,
      stipendOrSalary,
      currency
    } = req.body;

    if (employmentType !== undefined) {
      if (!['Internship', 'Paid Internship', 'Full-Time Placement'].includes(employmentType)) {
        return res.status(400).json({ message: 'Invalid employment type' });
      }
      placement.employmentType = employmentType;
    }

    if (companyName !== undefined) {
      if (!String(companyName).trim()) {
        return res.status(400).json({ message: 'Company name is required' });
      }
      placement.companyName = String(companyName).trim();
    }

    if (designation !== undefined) {
      if (!String(designation).trim()) {
        return res.status(400).json({ message: 'Role or designation is required' });
      }
      placement.designation = String(designation).trim();
    }

    const effectiveType = String(employmentType || placement.employmentType || '').trim();
    const normalizedJoiningDate = joiningDate ? parseDate(joiningDate) : placement.joiningDate;
    const normalizedStart = internshipStartDate ? parseDate(internshipStartDate) : placement.internshipStartDate;
    const normalizedEnd = internshipEndDate ? parseDate(internshipEndDate) : placement.internshipEndDate;
    const normalizedConversionDate = fullTimeConversionDate ? parseDate(fullTimeConversionDate) : placement.fullTimeConversionDate;

    if (effectiveType === 'Full-Time Placement') {
      if (!normalizedJoiningDate) {
        return res.status(400).json({ message: 'Joining date is required for full-time placements' });
      }
    }

    if (effectiveType === 'Internship' || effectiveType === 'Paid Internship') {
      if (!normalizedStart || !normalizedEnd) {
        return res.status(400).json({ message: 'Internship start and end dates are required' });
      }
      if (normalizedEnd < normalizedStart) {
        return res.status(400).json({ message: 'Internship end date cannot be before the start date' });
      }
    }

    if (joiningDate !== undefined) placement.joiningDate = normalizedJoiningDate;
    if (internshipStartDate !== undefined) placement.internshipStartDate = normalizedStart;
    if (internshipEndDate !== undefined) placement.internshipEndDate = normalizedEnd;
    if (hasFullTimeConversion !== undefined) {
      placement.hasFullTimeConversion = effectiveType === 'Full-Time Placement' ? null : hasFullTimeConversion === true;
      placement.fullTimeConversionDate = placement.hasFullTimeConversion ? normalizedConversionDate : null;
    }
    if (effectiveType === 'Full-Time Placement') {
      placement.hasFullTimeConversion = null;
      placement.fullTimeConversionDate = null;
    }
    if (fullTimeConversionDate !== undefined && placement.hasFullTimeConversion === true) {
      placement.fullTimeConversionDate = normalizedConversionDate;
    }
    if (ctc !== undefined) placement.ctc = ctc === '' ? null : Number(ctc);
    if (stipendOrSalary !== undefined) placement.stipendOrSalary = stipendOrSalary === '' ? null : Number(stipendOrSalary);
    if (currency !== undefined) placement.currency = currency || 'INR';

    placement.updatedBy = req.userId;
    await placement.save();

    res.json(await buildPlacementResponse(placement));
  } catch (error) {
    console.error('Update placement error:', error);
    res.status(500).json({ message: 'Failed to update post-placement details' });
  }
});

router.get('/me/documents', auth, authorize('student'), async (req, res) => {
  try {
    const placement = await loadPlacementForStudent(req.userId);
    if (!placement) {
      return res.status(404).json({ message: 'No placement found for this student' });
    }

    await syncPlacementDocumentsForPlacementToStudentProfile({
      studentId: req.userId,
      placementId: placement._id
    });

    res.json(await buildPlacementResponse(placement));
  } catch (error) {
    console.error('Get placement documents error:', error);
    res.status(500).json({ message: 'Failed to load documents' });
  }
});

router.post('/me/documents', auth, authorize('student'), upload.single('document'), async (req, res) => {
  try {
    const placement = await loadPlacementForStudent(req.userId);
    if (!placement) {
      return res.status(404).json({ message: 'No placement found for this student' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No document uploaded' });
    }

    const documentType = normalizeDocumentType(req.body.documentType);
    if (!documentType) {
      return res.status(400).json({ message: 'Valid document type is required' });
    }

    const periodKey = req.body.documentPeriodKey || req.body.periodKey || (req.body.documentPeriod ? toPeriodKey(req.body.documentPeriod) : '');
    const documentKey = buildDocumentKey({ documentType, periodKey });
    if (!documentKey) {
      return res.status(400).json({ message: 'Document period is required for salary/stipend slips' });
    }

    const requiredDocuments = buildRequiredDocuments(placement);
    const isRequired = requiredDocuments.some((required) => required.documentKey === documentKey);
    if (!isRequired) {
      return res.status(400).json({ message: 'This document is not required for the current placement' });
    }

    const existing = await PostPlacementDocument.findOne({ placement: placement._id, documentKey });
    if (existing && existing.storagePath && existing.storagePath !== req.file.filename) {
      try {
        await cloudinary.uploader.destroy(existing.storagePath, { resource_type: 'raw' });
      } catch (cloudinaryErr) {
        console.warn('Unable to delete previous placement document from Cloudinary:', cloudinaryErr.message);
      }
    }

    const requiredDocument = requiredDocuments.find((required) => required.documentKey === documentKey);
    const documentPeriod = requiredDocument?.period || null;
    const payload = {
      student: req.userId,
      placement: placement._id,
      application: placement.application,
      documentType,
      documentKey,
      documentPeriod,
      fileUrl: req.file.path,
      storagePath: req.file.filename || req.file.public_id || '',
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      dueDate: requiredDocument?.dueDate || null,
      verificationStatus: 'Uploaded',
      uploadedBy: req.userId,
      uploadedAt: new Date(),
      replacedAt: existing ? new Date() : undefined
    };

    const saved = existing ? Object.assign(existing, payload) && await existing.save() : await PostPlacementDocument.create(payload);
    await syncPlacementDocumentToStudentProfile({
      studentId: req.userId,
      placementId: placement._id,
      document: saved
    });
    res.json({
      message: 'Document uploaded successfully',
      document: await saved.populate(documentPopulation)
    });
  } catch (error) {
    console.error('Upload placement document error:', error);
    res.status(500).json({ message: 'Failed to upload document' });
  }
});

router.post('/me/documents/:documentId/replace', auth, authorize('student'), upload.single('document'), async (req, res) => {
  try {
    const document = await PostPlacementDocument.findById(req.params.documentId);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }
    if (String(document.student) !== String(req.userId)) {
      return res.status(403).json({ message: 'You can only replace your own documents' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No document uploaded' });
    }

    if (document.storagePath) {
      try {
        await cloudinary.uploader.destroy(document.storagePath, { resource_type: 'raw' });
      } catch (cloudinaryErr) {
        console.warn('Unable to delete previous placement document from Cloudinary:', cloudinaryErr.message);
      }
    }

    document.fileUrl = req.file.path;
    document.storagePath = req.file.filename || req.file.public_id || '';
    document.originalName = req.file.originalname;
    document.mimeType = req.file.mimetype;
    document.fileSize = req.file.size;
    document.verificationStatus = 'Uploaded';
    document.verifiedBy = null;
    document.verifiedAt = null;
    document.rejectionReason = '';
    document.uploadedBy = req.userId;
    document.replacedAt = new Date();

    await document.save();
    await syncPlacementDocumentToStudentProfile({
      studentId: req.userId,
      placementId: document.placement,
      document
    });
    res.json({ message: 'Document replaced successfully', document: await document.populate(documentPopulation) });
  } catch (error) {
    console.error('Replace placement document error:', error);
    res.status(500).json({ message: 'Failed to replace document' });
  }
});

router.get('/admin', auth, authorize('campus_poc', 'coordinator', 'manager'), async (req, res) => {
  try {
    const {
      employmentType,
      company,
      batch,
      joiningDateFrom,
      joiningDateTo,
      documentStatus,
      page = 1,
      limit = 20,
      search
    } = req.query;

    const query = {};
    if (employmentType) query.employmentType = employmentType;
    if (company) query.companyName = new RegExp(company, 'i');
    if (joiningDateFrom || joiningDateTo) {
      query.joiningDate = {};
      if (joiningDateFrom) query.joiningDate.$gte = new Date(joiningDateFrom);
      if (joiningDateTo) query.joiningDate.$lte = new Date(joiningDateTo);
    }

    const placements = await PostPlacementTracking.find(query)
      .populate(placementPopulation)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit, 10));

    const withDocuments = await Promise.all(placements.map(async (placement) => {
      const documents = await PostPlacementDocument.find({ placement: placement._id }).sort({ documentKey: 1 });
      const completion = buildDocumentCompletion(placement, documents);

      return {
        ...placement.toObject(),
        documents,
        requiredDocuments: completion.requiredDocuments,
        completion: completion.completion,
        batchYear: placement.student?.studentProfile?.joiningDate ? new Date(placement.student.studentProfile.joiningDate).getFullYear() : null
      };
    }));

    let filtered = withDocuments;
    if (batch) {
      const batchYear = String(batch).trim();
      filtered = filtered.filter((placement) => String(placement.batchYear || '') === batchYear);
    }
    if (documentStatus) {
      filtered = filtered.filter((placement) => placement.documents.some((document) => document.verificationStatus === documentStatus) || placement.requiredDocuments.some((required) => required.status === documentStatus));
    }
    if (search) {
      const term = String(search).toLowerCase();
      filtered = filtered.filter((placement) =>
        `${placement.student?.firstName || ''} ${placement.student?.lastName || ''}`.toLowerCase().includes(term) ||
        String(placement.companyName || '').toLowerCase().includes(term) ||
        String(placement.designation || '').toLowerCase().includes(term)
      );
    }

    const total = await PostPlacementTracking.countDocuments(query);
    res.json({
      placements: filtered,
      pagination: {
        current: Number(page),
        pages: Math.max(1, Math.ceil(total / limit)),
        total
      }
    });
  } catch (error) {
    console.error('Admin post-placement list error:', error);
    res.status(500).json({ message: 'Failed to load post-placement dashboard' });
  }
});

router.patch('/admin/:placementId/documents/:documentId', auth, authorize('campus_poc', 'coordinator', 'manager'), async (req, res) => {
  try {
    const { status, rejectionReason = '' } = req.body;
    if (!['Verified', 'Rejected'].includes(status)) {
      return res.status(400).json({ message: 'Status must be Verified or Rejected' });
    }

    const placement = await PostPlacementTracking.findById(req.params.placementId).populate('student');
    const document = await PostPlacementDocument.findById(req.params.documentId);
    if (!placement || !document || String(document.placement) !== String(placement._id)) {
      return res.status(404).json({ message: 'Document not found' });
    }

    if (!(await canAccessPlacement(req, placement))) {
      return res.status(403).json({ message: 'You do not have access to this placement' });
    }

    document.verificationStatus = status;
    document.verifiedBy = req.userId;
    document.verifiedAt = new Date();
    document.rejectionReason = status === 'Rejected' ? rejectionReason : '';
    await document.save();
    await syncPlacementDocumentToStudentProfile({
      studentId: placement.student._id,
      placementId: placement._id,
      document
    });

    await Notification.create({
      recipient: placement.student._id,
      type: status === 'Verified' ? 'document_verified' : 'document_rejected',
      title: status === 'Verified' ? 'Document Verified' : 'Document Rejected',
      message: status === 'Verified'
        ? `Your ${document.documentType.replace(/_/g, ' ').toLowerCase()} has been verified.`
        : `Your ${document.documentType.replace(/_/g, ' ').toLowerCase()} was rejected.${rejectionReason ? ` Reason: ${rejectionReason}` : ''}`,
      link: '/student/post-placement',
      relatedEntity: { type: 'postPlacementDocument', id: document._id }
    });

    res.json({ message: 'Document updated successfully', document });
  } catch (error) {
    console.error('Admin document verification error:', error);
    res.status(500).json({ message: 'Failed to update document status' });
  }
});

router.get('/admin/:placementId', auth, authorize('campus_poc', 'coordinator', 'manager'), async (req, res) => {
  try {
    const placement = await PostPlacementTracking.findById(req.params.placementId).populate(placementPopulation);
    if (!placement) {
      return res.status(404).json({ message: 'Placement not found' });
    }

    if (!(await canAccessPlacement(req, placement))) {
      return res.status(403).json({ message: 'You do not have access to this placement' });
    }

    res.json(await buildPlacementResponse(placement));
  } catch (error) {
    console.error('Get admin placement error:', error);
    res.status(500).json({ message: 'Failed to load placement details' });
  }
});

router.post('/sync-from-application', auth, authorize('coordinator', 'manager', 'campus_poc'), async (req, res) => {
  try {
    const { applicationId } = req.body;
    if (!applicationId) {
      return res.status(400).json({ message: 'applicationId is required' });
    }

    const application = await Application.findById(applicationId).populate('student').populate('job');
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    const placement = await ensurePlacementFromApplication(application, req.userId);
    if (!placement) {
      return res.status(400).json({ message: 'Unable to build placement from application' });
    }

    res.json({ message: 'Placement synced successfully', placement });
  } catch (error) {
    console.error('Sync placement from application error:', error);
    res.status(500).json({ message: 'Failed to sync placement' });
  }
});

module.exports = router;