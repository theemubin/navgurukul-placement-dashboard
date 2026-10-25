import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Building2, CheckCircle2, Download, FileText, Image as ImageIcon, ShieldCheck, UserCheck, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { postPlacementAPI } from '../../services/api';
import { Button, LoadingSpinner, Modal, StatusBadge } from '../../components/common/UIComponents';
import { completionText, formatMonthYear, getDocumentLabel, toPeriodKey } from '../../utils/postPlacement';

const statusPillClasses = {
  Pending: 'bg-gray-100 text-gray-700',
  Uploaded: 'bg-blue-100 text-blue-700',
  Verified: 'bg-green-100 text-green-700',
  Rejected: 'bg-red-100 text-red-700'
};

const formatPlacementDate = (value) => {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not recorded' : date.toLocaleDateString();
};

const getSelfReportDocumentRequirements = (data) => {
  const requirements = [{
    key: 'OFFER_LETTER',
    documentType: 'OFFER_LETTER',
    label: 'Offer Letter'
  }];

  if (data.employmentType === 'Paid Internship' && data.internshipStartDate && data.internshipEndDate) {
    const start = new Date(`${data.internshipStartDate}T00:00:00`);
    for (let index = 0; index < 3; index += 1) {
      const month = new Date(start.getFullYear(), start.getMonth() + index, 1);
      const periodKey = toPeriodKey(month);
      requirements.push({
        key: `INTERNSHIP_STIPEND_SLIP:${periodKey}`,
        documentType: 'INTERNSHIP_STIPEND_SLIP',
        documentPeriodKey: periodKey,
        label: `${formatMonthYear(month)} Stipend Slip`
      });
    }
  }

  if (data.employmentType === 'Full-Time Placement' && data.joiningDate) {
    const start = new Date(`${data.joiningDate}T00:00:00`);
    for (let index = 0; index < 3; index += 1) {
      const month = new Date(start.getFullYear(), start.getMonth() + index, 1);
      const periodKey = toPeriodKey(month);
      requirements.push({
        key: `FULL_TIME_SALARY_SLIP:${periodKey}`,
        documentType: 'FULL_TIME_SALARY_SLIP',
        documentPeriodKey: periodKey,
        label: `${formatMonthYear(month)} Salary Slip`
      });
    }
  }

  return requirements;
};

const StudentPostPlacementTracking = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingKey, setUploadingKey] = useState('');
  const [placement, setPlacement] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [requiredDocuments, setRequiredDocuments] = useState([]);
  const [completion, setCompletion] = useState({ completed: 0, total: 0, percentage: 0 });
  const [creatingPlacement, setCreatingPlacement] = useState(false);
  const [placementEditing, setPlacementEditing] = useState(false);
  const [selfReportFiles, setSelfReportFiles] = useState({});
  const [selfReportData, setSelfReportData] = useState({
    companyName: '',
    designation: '',
    employmentType: '',
    joiningDate: '',
    internshipStartDate: '',
    internshipEndDate: '',
    hasFullTimeConversion: null,
    fullTimeConversionDate: '',
    ctc: '',
    stipendOrSalary: '',
    currency: 'INR'
  });
  const [formData, setFormData] = useState({
    companyName: '',
    designation: '',
    employmentType: '',
    joiningDate: '',
    internshipStartDate: '',
    internshipEndDate: '',
    hasFullTimeConversion: null,
    fullTimeConversionDate: '',
    ctc: '',
    stipendOrSalary: '',
    currency: 'INR'
  });
  const [previewModal, setPreviewModal] = useState({
    isOpen: false,
    document: null,
    loading: false,
    error: null
  });

  useEffect(() => {
    fetchTracking();
  }, []);

  const fetchTracking = async (options = {}) => {
    try {
      setLoading(true);
      const response = await postPlacementAPI.getMyPlacement(options);
      const data = response.data || {};
      setPlacement(data.placement || null);
      setPlacementEditing(false);
      setDocuments(data.documents || []);
      setRequiredDocuments(data.requiredDocuments || []);
      setCompletion(data.completion || { completed: 0, total: 0, percentage: 0 });

      if (data.placement) {
        setFormData({
          companyName: data.placement.companyName || '',
          designation: data.placement.designation || '',
          employmentType: data.placement.employmentType || '',
          joiningDate: data.placement.joiningDate ? new Date(data.placement.joiningDate).toISOString().slice(0, 10) : '',
          internshipStartDate: data.placement.internshipStartDate ? new Date(data.placement.internshipStartDate).toISOString().slice(0, 10) : '',
          internshipEndDate: data.placement.internshipEndDate ? new Date(data.placement.internshipEndDate).toISOString().slice(0, 10) : '',
          hasFullTimeConversion: data.placement.hasFullTimeConversion ?? null,
          fullTimeConversionDate: data.placement.fullTimeConversionDate ? new Date(data.placement.fullTimeConversionDate).toISOString().slice(0, 10) : '',
          ctc: data.placement.ctc ?? '',
          stipendOrSalary: data.placement.stipendOrSalary ?? '',
          currency: data.placement.currency || 'INR'
        });
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load post-placement tracking');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await postPlacementAPI.updateMyPlacement(formData);
      toast.success('Post-placement details updated');
      setPlacementEditing(false);
      await fetchTracking({ forceRefresh: true });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update post-placement details');
    } finally {
      setSaving(false);
    }
  };

  const handleResetPlacement = async () => {
    if (!window.confirm('Reset this placement and remove its uploaded documents?')) return;

    try {
      setSaving(true);
      await postPlacementAPI.resetMyPlacement();
      setPlacement(null);
      setPlacementEditing(false);
      setDocuments([]);
      setRequiredDocuments([]);
      setCompletion({ completed: 0, total: 0, percentage: 0 });
      setFormData({
        companyName: '',
        designation: '',
        employmentType: '',
        joiningDate: '',
        internshipStartDate: '',
        internshipEndDate: '',
        hasFullTimeConversion: null,
        fullTimeConversionDate: '',
        ctc: '',
        stipendOrSalary: '',
        currency: 'INR'
      });
      toast.success('Placement reset successfully');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to reset placement');
    } finally {
      setSaving(false);
    }
  };

  const handleSelfReport = async () => {
    try {
      setCreatingPlacement(true);
      if (placement) {
        await postPlacementAPI.updateMyPlacement(selfReportData);
      } else {
        await postPlacementAPI.selfReportPlacement(selfReportData);
      }
      const requirements = getSelfReportDocumentRequirements(selfReportData);
      for (const requirement of requirements) {
        const file = selfReportFiles[requirement.key];
        if (!file) continue;
        await postPlacementAPI.uploadMyDocument({
          file,
          documentType: requirement.documentType,
          documentPeriodKey: requirement.documentPeriodKey
        });
      }
      setSelfReportFiles({});
      setSelfReportData({
        companyName: '',
        designation: '',
        employmentType: '',
        joiningDate: '',
        internshipStartDate: '',
        internshipEndDate: '',
        hasFullTimeConversion: null,
        fullTimeConversionDate: '',
        ctc: '',
        stipendOrSalary: '',
        currency: 'INR'
      });
      toast.success(placement ? 'Placement details updated successfully' : 'Placement submitted successfully');
      await fetchTracking({ forceRefresh: true });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit placement');
    } finally {
      setCreatingPlacement(false);
    }
  };

  const uploadDocument = async (file, documentType, documentPeriodKey = '') => {
    try {
      setUploadingKey(documentPeriodKey || documentType);
      await postPlacementAPI.uploadMyDocument({ file, documentType, documentPeriodKey });
      toast.success('Document uploaded successfully');
      await fetchTracking({ forceRefresh: true });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to upload document');
    } finally {
      setUploadingKey('');
    }
  };

  const openPreview = (document) => {
    setPreviewModal({
      isOpen: true,
      document,
      loading: false,
      error: null
    });
  };

  const closePreview = () => {
    setPreviewModal({
      isOpen: false,
      document: null,
      loading: false,
      error: null
    });
  };

  const downloadDocument = (document) => {
    try {
      const link = document.createElement('a');
      link.href = document.fileUrl;
      link.download = document.originalName || 'document';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      toast.error('Failed to download document');
    }
  };

  const getFileIcon = (mimeType) => {
    if (!mimeType) return <FileText className="h-5 w-5 text-gray-400" />;
    if (mimeType.startsWith('image/')) return <ImageIcon className="h-5 w-5 text-blue-500" />;
    if (mimeType === 'application/pdf') return <FileText className="h-5 w-5 text-red-500" />;
    return <FileText className="h-5 w-5 text-gray-400" />;
  };

  const isPreviewable = (mimeType) => {
    if (!mimeType) return false;
    return mimeType.startsWith('image/') || mimeType === 'application/pdf';
  };

  const replaceDocument = async (documentId, file) => {
    try {
      setUploadingKey(documentId);
      await postPlacementAPI.replaceMyDocument(documentId, file);
      toast.success('Document replaced successfully');
      await fetchTracking({ forceRefresh: true });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to replace document');
    } finally {
      setUploadingKey('');
    }
  };

  const handleFilePick = (documentType, documentPeriodKey = '', mode = 'upload', documentId = null) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.doc,.docx,image/*';
    input.onchange = async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (mode === 'replace' && documentId) {
        await replaceDocument(documentId, file);
        return;
      }
      await uploadDocument(file, documentType, documentPeriodKey);
    };
    input.click();
  };

  const renderDocumentRow = (required) => {
    const document = required.document || documents.find((item) => item.documentKey === required.documentKey);
    const status = document?.verificationStatus || required.status || 'Pending';
    const key = required.documentKey;

    return (
      <div key={key} className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-gray-50/60 p-4 md:flex-row md:items-start md:justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-black text-gray-900">{getDocumentLabel(required)}</p>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${statusPillClasses[status] || 'bg-gray-100 text-gray-700'}`}>
              {status}
            </span>
          </div>
          {required.period?.label && <p className="mt-1 text-xs font-semibold text-gray-500">{required.period.label}</p>}
          {required.dueDate && (
            <p className={`mt-1 text-xs font-semibold ${required.overdue ? 'text-red-600' : 'text-gray-500'}`}>
              {required.overdue ? 'Overdue: ' : 'Due: '}{new Date(required.dueDate).toLocaleDateString()}
            </p>
          )}
          {document?.rejectionReason && <p className="mt-1 text-xs text-red-600">Reason: {document.rejectionReason}</p>}

          {/* Document card for uploaded files */}
          {document?.fileUrl && (
            <div className="mt-3 max-w-xs">
              <div
                className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 hover:border-primary-300 hover:shadow-md transition-all cursor-pointer"
                onClick={() => openPreview(document)}
              >
                <div className="flex-shrink-0">
                  {getFileIcon(document.mimeType)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {document.originalName || 'Document'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {document.mimeType || 'Unknown type'}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadDocument(document);
                  }}
                  className="flex-shrink-0"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 mt-3 md:mt-0">
          <Button variant="outline" size="sm" onClick={() => handleFilePick(required.documentType, required.period?.key || '', document ? 'replace' : 'upload', document?._id)} disabled={uploadingKey === document?.documentKey || uploadingKey === document?._id}>
            {document ? 'Replace' : 'Upload'}
          </Button>
        </div>
      </div>
    );
  };

  const isFullTime = formData.employmentType === 'Full-Time Placement';
  const isInternship = formData.employmentType === 'Internship' || formData.employmentType === 'Paid Internship';
  const isSelfReportInternship = selfReportData.employmentType === 'Internship' || selfReportData.employmentType === 'Paid Internship';
  const hasConversion = formData.hasFullTimeConversion === true;
  const hasSelfReportConversion = selfReportData.hasFullTimeConversion === true;
  const documentationPreview = formData.employmentType === 'Full-Time Placement'
    ? 'Offer Letter and three monthly Salary Slips'
    : formData.employmentType === 'Paid Internship'
      ? 'Offer Letter and three monthly Stipend Slips'
      : formData.employmentType === 'Internship'
        ? 'Offer Letter only'
        : '';
  const selfReportDocumentationPreview = selfReportData.employmentType === 'Full-Time Placement'
    ? 'Offer Letter and three monthly Salary Slips'
    : selfReportData.employmentType === 'Paid Internship'
      ? 'Offer Letter and three monthly Stipend Slips'
      : selfReportData.employmentType === 'Internship'
        ? 'Offer Letter only'
        : '';
  const selfReportDocumentRequirements = selfReportData.employmentType
    ? getSelfReportDocumentRequirements(selfReportData)
    : [];
  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!placement) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-[2rem] border border-gray-100 bg-white p-8 shadow-xl shadow-gray-100/50">
          <h1 className="text-2xl font-black text-gray-900">Post-Placement Submission</h1>
          <p className="mt-2 text-sm text-gray-500">Enter your placement details and submit the required documents below.</p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm font-medium text-gray-700">
              Company Name
              <input value={selfReportData.companyName} onChange={(e) => setSelfReportData({ ...selfReportData, companyName: e.target.value })} placeholder="e.g. Acme Pvt Ltd" />
            </label>
            <label className="space-y-1 text-sm font-medium text-gray-700">
              Role / Designation
              <input value={selfReportData.designation} onChange={(e) => setSelfReportData({ ...selfReportData, designation: e.target.value })} placeholder="e.g. Software Engineer Intern" />
            </label>
            <label className="space-y-1 text-sm font-medium text-gray-700">
              Employment Type
              <select value={selfReportData.employmentType} onChange={(e) => setSelfReportData({ ...selfReportData, employmentType: e.target.value })}>
                <option value="">Select Employer Type</option>
                <option value="Internship">Internship</option>
                <option value="Paid Internship">Paid Internship</option>
                <option value="Full-Time Placement">Full-Time Placement</option>
              </select>
            </label>
            {isSelfReportInternship && (
              <label className="space-y-1 text-sm font-medium text-gray-700">
                Full-time conversion?
                <select value={selfReportData.hasFullTimeConversion === null ? '' : String(selfReportData.hasFullTimeConversion)} onChange={(e) => setSelfReportData({ ...selfReportData, hasFullTimeConversion: e.target.value === '' ? null : e.target.value === 'true' })}>
                  <option value="">Select one</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </label>
            )}
            {!isSelfReportInternship && (
              <label className="space-y-1 text-sm font-medium text-gray-700">
                Joining Date
                <input type="date" value={selfReportData.joiningDate} onChange={(e) => setSelfReportData({ ...selfReportData, joiningDate: e.target.value })} />
              </label>
            )}
            <label className="space-y-1 text-sm font-medium text-gray-700">
              CTC
              <input type="number" value={selfReportData.ctc} onChange={(e) => setSelfReportData({ ...selfReportData, ctc: e.target.value })} placeholder="Optional" />
            </label>
            <label className="space-y-1 text-sm font-medium text-gray-700">
              Stipend / Salary
              <input type="number" value={selfReportData.stipendOrSalary} onChange={(e) => setSelfReportData({ ...selfReportData, stipendOrSalary: e.target.value })} placeholder="Optional" />
            </label>
          </div>

          {isSelfReportInternship && (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm font-medium text-gray-700">
                Internship Start Date
                <input type="date" value={selfReportData.internshipStartDate} onChange={(e) => setSelfReportData({ ...selfReportData, internshipStartDate: e.target.value })} />
              </label>
              <label className="space-y-1 text-sm font-medium text-gray-700">
                Internship End Date
                <input type="date" value={selfReportData.internshipEndDate} onChange={(e) => setSelfReportData({ ...selfReportData, internshipEndDate: e.target.value })} />
              </label>
              {hasSelfReportConversion && (
                <label className="space-y-1 text-sm font-medium text-gray-700">
                  Full-time conversion date (Optional)
                  <input type="date" value={selfReportData.fullTimeConversionDate} onChange={(e) => setSelfReportData({ ...selfReportData, fullTimeConversionDate: e.target.value })} />
                </label>
              )}
            </div>
          )}

          {selfReportData.employmentType === 'Internship' && <p className="mt-4 text-sm text-gray-500">You will upload your offer letter only.</p>}
          {selfReportData.employmentType === 'Paid Internship' && <p className="mt-4 text-sm text-gray-500">You will upload your offer letter and stipend slips for your first three internship months.</p>}

          {selfReportDocumentationPreview && (
            <div className="mt-5 rounded-2xl border border-primary-100 bg-primary-50/60 p-4 text-sm text-primary-900">
              <p className="font-black">Required documents</p>
              <p className="mt-1">{selfReportDocumentationPreview}</p>
              <div className="mt-4 space-y-3">
                {selfReportDocumentRequirements.map((requirement) => (
                  <label key={requirement.key} className="block text-xs font-bold text-primary-900">
                    {requirement.label}
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,image/*"
                      className="mt-1 block w-full rounded-xl border border-primary-200 bg-white p-2 text-xs font-medium text-gray-700"
                      onChange={(event) => setSelfReportFiles({ ...selfReportFiles, [requirement.key]: event.target.files?.[0] || null })}
                    />
                  </label>
                ))}
              </div>
              {(selfReportData.employmentType === 'Paid Internship' && (!selfReportData.internshipStartDate || !selfReportData.internshipEndDate)) && (
                <p className="mt-2 text-xs text-primary-700">Select internship start and end dates to show the three stipend slip upload fields.</p>
              )}
              {(selfReportData.employmentType === 'Full-Time Placement' && !selfReportData.joiningDate) && (
                <p className="mt-2 text-xs text-primary-700">Select a joining date to show the three salary slip upload fields.</p>
              )}
              <p className="mt-2 text-xs text-primary-700">Selected files will be saved when you submit the placement details.</p>
            </div>
          )}

          <div className="mt-6">
            <Button onClick={handleSelfReport} disabled={creatingPlacement}>
              {creatingPlacement ? 'Saving...' : 'Submit Placement Details'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-12">
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-gray-900 via-slate-900 to-primary-900 p-8 shadow-2xl md:p-10">
        <div className="absolute -right-24 top-0 h-72 w-72 rounded-full bg-primary-500/20 blur-3xl" />
        <div className="absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/80 backdrop-blur-md">
              <UserCheck size={12} /> Post-Placement Tracking
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-white md:text-4xl">{placement.companyName || 'Placement'}</h1>
            <p className="mt-2 max-w-2xl text-sm font-medium text-gray-300 md:text-base">Track offer letters, salary slips, stipend documents, and placement details from one place.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 md:w-[360px]">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 text-white backdrop-blur-md">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/50">Documentation</p>
              <p className="mt-1 text-2xl font-black">{completionText(completion)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 text-white backdrop-blur-md">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/50">Progress</p>
              <p className="mt-1 text-2xl font-black">{completion.percentage || 0}%</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-xl shadow-gray-100/50">
          <div className="flex items-center justify-between gap-4 border-b border-gray-50 pb-5">
            <div>
              <h2 className="text-xl font-black text-gray-900">Placement Details</h2>
              <p className="text-sm text-gray-500">Keep these values aligned with your offer and joining record.</p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={placement.status || 'active'} />
              {!placementEditing && (
                <Button size="sm" onClick={() => setPlacementEditing(true)}>
                  Edit
                </Button>
              )}
              {placementEditing && (
                <Button variant="danger" size="sm" onClick={handleResetPlacement} disabled={saving}>
                  Reset placement
                </Button>
              )}
            </div>
          </div>

          {!placementEditing && (
            <div className="mt-5 rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-gray-400">Company</p>
                  <p className="mt-1 font-bold text-gray-900">{placement.companyName || 'Not recorded'}</p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-gray-400">Role / Designation</p>
                  <p className="mt-1 font-bold text-gray-900">{placement.designation || 'Not recorded'}</p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-gray-400">Employment type</p>
                  <p className="mt-1 font-bold text-gray-900">{placement.employmentType || 'Not recorded'}</p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-gray-400">Joining date</p>
                  <p className="mt-1 font-bold text-gray-900">{formatPlacementDate(placement.joiningDate)}</p>
                </div>
                {isInternship && (
                  <>
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-gray-400">Internship period</p>
                      <p className="mt-1 font-bold text-gray-900">
                        {formatPlacementDate(placement.internshipStartDate)} – {formatPlacementDate(placement.internshipEndDate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-gray-400">Full-time conversion</p>
                      <p className="mt-1 font-bold text-gray-900">
                        {placement.hasFullTimeConversion === true ? `Yes${placement.fullTimeConversionDate ? `, ${formatPlacementDate(placement.fullTimeConversionDate)}` : ''}` : placement.hasFullTimeConversion === false ? 'No' : 'Not recorded'}
                      </p>
                    </div>
                  </>
                )}
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-gray-400">CTC</p>
                  <p className="mt-1 font-bold text-gray-900">{placement.ctc ? `${placement.currency || 'INR'} ${placement.ctc}` : 'Not recorded'}</p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-gray-400">Stipend / Salary</p>
                  <p className="mt-1 font-bold text-gray-900">{placement.stipendOrSalary ? `${placement.currency || 'INR'} ${placement.stipendOrSalary}` : 'Not recorded'}</p>
                </div>
              </div>
            </div>
          )}

          <div className={placementEditing ? '' : 'hidden'}>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm font-medium text-gray-700">
              Employment Type
              <select value={formData.employmentType} onChange={(e) => setFormData({ ...formData, employmentType: e.target.value })}>
                <option value="">Select Employer Type</option>
                <option value="Internship">Internship</option>
                <option value="Paid Internship">Paid Internship</option>
                <option value="Full-Time Placement">Full-Time Placement</option>
              </select>
            </label>
            {isInternship && (
              <label className="space-y-1 text-sm font-medium text-gray-700">
                Full-time conversion?
                <select value={formData.hasFullTimeConversion === null ? '' : String(formData.hasFullTimeConversion)} onChange={(e) => setFormData({ ...formData, hasFullTimeConversion: e.target.value === '' ? null : e.target.value === 'true' })}>
                  <option value="">Select one</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </label>
            )}
            <label className="space-y-1 text-sm font-medium text-gray-700">
              Company
              <input value={formData.companyName} onChange={(e) => setFormData({ ...formData, companyName: e.target.value })} placeholder="Company name" />
            </label>
            <label className="space-y-1 text-sm font-medium text-gray-700">
              Role / Designation
              <input value={formData.designation} onChange={(e) => setFormData({ ...formData, designation: e.target.value })} placeholder="Role or designation" />
            </label>
            <label className="space-y-1 text-sm font-medium text-gray-700">
              CTC
              <input type="number" value={formData.ctc} onChange={(e) => setFormData({ ...formData, ctc: e.target.value })} placeholder="Optional" />
            </label>
            <label className="space-y-1 text-sm font-medium text-gray-700">
              Joining Date
              <input type="date" value={formData.joiningDate} onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })} />
            </label>
            <label className="space-y-1 text-sm font-medium text-gray-700">
              Stipend / Salary
              <input type="number" value={formData.stipendOrSalary} onChange={(e) => setFormData({ ...formData, stipendOrSalary: e.target.value })} placeholder="Optional" />
            </label>
          </div>

          {isInternship && (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm font-medium text-gray-700">
                Internship Start Date
                <input type="date" value={formData.internshipStartDate} onChange={(e) => setFormData({ ...formData, internshipStartDate: e.target.value })} />
              </label>
              <label className="space-y-1 text-sm font-medium text-gray-700">
                Internship End Date
                <input type="date" value={formData.internshipEndDate} onChange={(e) => setFormData({ ...formData, internshipEndDate: e.target.value })} />
              </label>
              {hasConversion && (
                <label className="space-y-1 text-sm font-medium text-gray-700">
                  Full-time conversion date (Optional)
                  <input type="date" value={formData.fullTimeConversionDate} onChange={(e) => setFormData({ ...formData, fullTimeConversionDate: e.target.value })} />
                </label>
              )}
            </div>
          )}

          {formData.employmentType === 'Internship' && <p className="mt-4 text-sm text-gray-500">Required document: offer letter only.</p>}
          {formData.employmentType === 'Paid Internship' && <p className="mt-4 text-sm text-gray-500">Required documents: offer letter and three monthly stipend slips.</p>}
          {formData.employmentType === 'Full-Time Placement' && <p className="mt-4 text-sm text-gray-500">Required documents: offer letter and three monthly salary slips.</p>}

          {isFullTime && formData.joiningDate && (
            <div className="mt-5 rounded-2xl border border-primary-100 bg-primary-50/60 p-4 text-sm text-primary-900">
              Salary slips will be generated automatically for {formatMonthYear(formData.joiningDate)}, {formatMonthYear(new Date(new Date(formData.joiningDate).setMonth(new Date(formData.joiningDate).getMonth() + 1)))}, and {formatMonthYear(new Date(new Date(formData.joiningDate).setMonth(new Date(formData.joiningDate).getMonth() + 2)))}.
            </div>
          )}

          <div className="mt-6 flex gap-3">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Placement Details'}
            </Button>
          </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-xl shadow-gray-100/50">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-50 text-green-600"><ShieldCheck size={22} /></div>
            <div>
              <h2 className="text-lg font-black text-gray-900">Documentation Progress</h2>
              <p className="text-sm text-gray-500">Upload required offer and monthly slips.</p>
            </div>
          </div>
          <div className="mt-5 rounded-2xl bg-gray-50 p-4">
            <div className="flex items-center justify-between text-sm font-bold text-gray-700">
              <span>{completion.completed}/{completion.total} Completed</span>
              <span>{completion.percentage || 0}%</span>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-gray-200">
              <div className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-600" style={{ width: `${completion.percentage || 0}%` }} />
            </div>
          </div>
          <div className="mt-6 space-y-4">
            {requiredDocuments.length === 0 && (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                {documentationPreview ? `After saving, upload options will appear here for: ${documentationPreview}. ` : ''}
                Select the employment type, complete the required dates and conversion answer, then click Save Placement Details. The upload options will appear here after the required documents are generated.
              </div>
            )}
            {requiredDocuments.map((required) => renderDocumentRow(required))}
          </div>
        </div>
      </div>

      {/* Document Preview Modal */}
      <Modal
        isOpen={previewModal.isOpen}
        onClose={closePreview}
        title="Document Preview"
        size="xl"
      >
        {previewModal.document && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {previewModal.document.originalName || 'Document'}
                </p>
                <p className="text-xs text-gray-500">
                  {previewModal.document.mimeType || 'Unknown type'}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadDocument(previewModal.document)}
              >
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 min-h-[400px] flex items-center justify-center">
              {isPreviewable(previewModal.document.mimeType) ? (
                previewModal.document.mimeType?.startsWith('image/') ? (
                  <img
                    src={previewModal.document.fileUrl}
                    alt={previewModal.document.originalName || 'Document preview'}
                    className="max-w-full max-h-[600px] object-contain"
                    onError={() => setPreviewModal(prev => ({ ...prev, error: 'Failed to load image' }))}
                  />
                ) : previewModal.document.mimeType === 'application/pdf' ? (
                  <iframe
                    src={previewModal.document.fileUrl}
                    title={previewModal.document.originalName || 'PDF preview'}
                    className="w-full h-[600px] border-0"
                    onError={() => setPreviewModal(prev => ({ ...prev, error: 'Failed to load PDF' }))}
                  />
                ) : (
                  <div className="text-center">
                    <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-sm text-gray-600">Preview not available for this file type</p>
                  </div>
                )
              ) : (
                <div className="text-center">
                  <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-sm text-gray-600 mb-2">Preview not available for this file type</p>
                  <p className="text-xs text-gray-500">Please download the file to view it</p>
                </div>
              )}

              {previewModal.error && (
                <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90">
                  <div className="text-center">
                    <X className="h-16 w-16 text-red-500 mx-auto mb-4" />
                    <p className="text-sm font-medium text-gray-900">{previewModal.error}</p>
                    <p className="text-xs text-gray-500 mt-2">Please try downloading the file instead</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default StudentPostPlacementTracking;