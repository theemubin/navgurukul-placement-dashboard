const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const User = require('../models/User');
const ATSAnalysis = require('../models/ATSAnalysis');
const { analyzeResume } = require('../services/ats/atsService');
const { checkUrlAccessible } = require('../utils/urlChecker');
const { downloadResumeBuffer, extractPdfText, resolveAIKeysForUser, extractGoogleDriveFileId } = require('./utils');

/**
 * Helper to resolve target resume object from user profile
 */
function resolveStudentResume(user, resumeId) {
  if (!user || !user.studentProfile) return null;

  const resumes = user.studentProfile.resumes || [];

  if (resumeId && resumeId !== 'primary') {
    const found = resumes.find(r => r._id && r._id.toString() === resumeId);
    if (found) return { resumeId: found._id.toString(), resumeItem: found, url: (found.resumeLink || found.url || found.resume || '').trim() };
    return null;
  }

  // Primary fallback
  const primaryItem = resumes.find(r => r.isPrimary) || resumes[0];
  if (primaryItem) {
    return { resumeId: primaryItem._id.toString(), resumeItem: primaryItem, url: (primaryItem.resumeLink || primaryItem.url || primaryItem.resume || '').trim() };
  }

  const legacyUrl = (user.studentProfile.resumeLink || user.studentProfile.resume || '').trim();
  if (legacyUrl) {
    return { resumeId: 'primary', resumeItem: null, url: legacyUrl };
  }

  return null;
}

/**
 * @route POST /api/ats/analyze
 * @desc Analyze a student's resume (Standalone ATS Resume Checker)
 * @access Private (Student only)
 */
router.post('/analyze', auth, async (req, res) => {
  try {
    const studentId = req.userId;
    const { resumeId = 'primary', forceRefresh = false } = req.body || {};

    const user = await User.findById(studentId);
    if (!user || user.role !== 'student') {
      return res.status(403).json({ message: 'Only authenticated students can run ATS resume analysis' });
    }

    const resolved = resolveStudentResume(user, resumeId);
    if (!resolved || !resolved.url) {
      return res.status(404).json({ message: 'Resume not found. Please upload a resume first.' });
    }

    const resumeUrl = resolved.url;
    const isDirectFile = resumeUrl.startsWith('/uploads/') || resumeUrl.startsWith('uploads/') || resumeUrl.includes('/uploads/') || resumeUrl.startsWith('http://localhost') || resumeUrl.startsWith('http://127.0.0.1') || resumeUrl.includes('cloudinary.com') || resumeUrl.includes('res.cloudinary.com');
    let accessResult = { ok: true, candidate: resumeUrl };

    if (!isDirectFile) {
      accessResult = await checkUrlAccessible(resumeUrl);
    }

    if (!accessResult.ok) {
      return res.status(400).json({
        message: 'Resume file or share link is not accessible. Please ensure link permissions are set to public.',
        reason: accessResult.reason || 'inaccessible'
      });
    }

    let downloadUrl = accessResult.candidate || resumeUrl;
    let file;
    try {
      file = await downloadResumeBuffer(downloadUrl);
    } catch (downloadErr) {
      console.error('[ATS] Resume download failed:', downloadErr.message);
      return res.status(400).json({ message: 'Failed to download resume file. Check URL or network access.' });
    }

    if (String(file.contentType || '').includes('text/html') && /drive\.google\.com/i.test(downloadUrl)) {
      const fileId = extractGoogleDriveFileId(downloadUrl);
      if (fileId) {
        downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
        file = await downloadResumeBuffer(downloadUrl);
      }
    }

    let rawText = '';
    try {
      rawText = await extractPdfText(file.buffer);
    } catch (extractErr) {
      console.error('[ATS] PDF text extraction failed:', extractErr.message);
      return res.status(422).json({ message: 'Could not extract text from PDF. Ensure your resume is a text-selectable PDF, not a scanned image.' });
    }

    if (!rawText || rawText.trim().length < 20) {
      return res.status(422).json({ message: 'Extracted text is empty or too short. Upload a text-selectable PDF resume.' });
    }

    // Resolve AI keys for optional enrichment
    let aiKeys = [];
    try {
      const aiRuntime = await resolveAIKeysForUser(studentId);
      if (aiRuntime && aiRuntime.aiEnabled && Array.isArray(aiRuntime.keys)) {
        aiKeys = aiRuntime.keys;
      }
    } catch (aiErr) {
      console.warn('[ATS] AI key resolution warning:', aiErr.message);
    }

    const { isCached, analysis } = await analyzeResume({
      studentId: user._id,
      resumeId: resolved.resumeId,
      rawText,
      metadata: {
        sourceUrl: resumeUrl,
        fileName: resolved.resumeItem?.fileName || 'resume.pdf',
        isAccessible: true
      },
      aiKeys,
      forceRefresh: !!forceRefresh
    });

    // Update user profile resumeAts summary for backward compatibility
    const atsSummaryObj = {
      overallScore: analysis.overallScore,
      qualityFlag: analysis.parserMetadata.qualityFlag,
      textLength: analysis.parserMetadata.textLength,
      status: 'ok',
      sourceUrl: resumeUrl,
      checkedAt: new Date(),
      breakdown: {
        keywordAlignment: analysis.categories.content.score,
        skillsRelevance: analysis.categories.skillEvidence.score,
        projectImpact: analysis.categories.experienceQuality.score,
        structureReadability: analysis.categories.sections.score,
        experienceStrength: analysis.categories.readability.score
      },
      strengths: analysis.suggestions.filter(s => s.priority === 'low').map(s => s.suggestion),
      gaps: analysis.issues.map(i => i.title),
      actionItems: analysis.suggestions.map(s => s.suggestion)
    };

    if (resolved.resumeItem) {
      resolved.resumeItem.resumeAts = atsSummaryObj;
    }
    if (!resolved.resumeItem || resolved.resumeItem.isPrimary) {
      user.studentProfile.resumeAts = atsSummaryObj;
    }
    user.markModified('studentProfile');
    await user.save();

    res.json({
      success: true,
      isCached,
      analysis
    });
  } catch (error) {
    console.error('[ATS Route] Analysis error:', error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      message: error.message || 'Server error during ATS resume analysis'
    });
  }
});

/**
 * @route GET /api/ats/resumes
 * @desc Fetch student resumes metadata with latest ATS summary efficiently (No N+1 queries)
 * @access Private (Student only)
 */
router.get('/resumes', auth, async (req, res) => {
  try {
    const studentId = req.userId;
    const user = await User.findById(studentId);

    if (!user || user.role !== 'student') {
      return res.status(403).json({ message: 'Only authenticated students can fetch ATS resumes' });
    }

    const resumesList = user.studentProfile?.resumes || [];

    // Retrieve latest ATSAnalysis record per resumeId for this student in ONE MongoDB aggregation query
    const latestAnalyses = await ATSAnalysis.aggregate([
      { $match: { student: user._id } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$resume',
          latestAnalysis: { $first: '$$ROOT' }
        }
      }
    ]);

    const analysisMap = {};
    latestAnalyses.forEach(item => {
      if (item._id) {
        analysisMap[item._id] = item.latestAnalysis;
      }
    });

    let items = resumesList.map(r => {
      const rId = r._id ? r._id.toString() : 'primary';
      const latest = analysisMap[rId];
      const score = latest ? latest.overallScore : (r.resumeAts?.overallScore ?? null);
      const status = (latest || r.resumeAts?.overallScore != null) ? 'analyzed' : 'not_analyzed';

      return {
        resumeId: rId,
        _id: rId,
        role: r.role || 'Target Role',
        fileName: r.fileName || `${r.role || 'Resume'}.pdf`,
        url: (r.url || r.resumeLink || r.resume || '').trim(),
        resumeLink: (r.url || r.resumeLink || r.resume || '').trim(),
        uploadedAt: r.uploadedAt,
        isPrimary: !!r.isPrimary,
        atsScore: score,
        atsStatus: status,
        checkedAt: latest?.createdAt || r.resumeAts?.checkedAt || null,
        latestAnalysis: latest || null
      };
    });

    // Legacy fallback if student profile has top-level resumeLink string
    if (items.length === 0 && (user.studentProfile?.resumeLink || user.studentProfile?.resume)) {
      const legacyUrl = (user.studentProfile.resumeLink || user.studentProfile.resume).trim();
      if (legacyUrl && !legacyUrl.includes('duxtmfi5t')) {
        const latest = analysisMap['primary'];
        const score = latest ? latest.overallScore : (user.studentProfile.resumeAts?.overallScore ?? null);
        items = [{
          resumeId: 'primary',
          _id: 'primary',
          role: 'Primary Resume',
          fileName: 'Primary_Resume.pdf',
          url: legacyUrl,
          resumeLink: legacyUrl,
          uploadedAt: user.updatedAt || new Date(),
          isPrimary: true,
          atsScore: score,
          atsStatus: (latest || user.studentProfile.resumeAts?.overallScore != null) ? 'analyzed' : 'not_analyzed',
          checkedAt: latest?.createdAt || user.studentProfile.resumeAts?.checkedAt || null,
          latestAnalysis: latest || null
        }];
      }
    }

    res.json({
      success: true,
      resumes: items
    });
  } catch (error) {
    console.error('[ATS Route] Fetch resumes error:', error);
    res.status(500).json({ message: 'Server error fetching resumes metadata' });
  }
});

/**
 * @route GET /api/ats/resume/:resumeId
 * @desc Get latest ATS analysis for a specific resume
 * @access Private (Student only)
 */
router.get('/resume/:resumeId', auth, async (req, res) => {
  try {
    const studentId = req.userId;
    const { resumeId } = req.params;

    const analysis = await ATSAnalysis.findOne({
      student: studentId,
      resume: resumeId
    }).sort({ createdAt: -1 });

    if (!analysis) {
      return res.status(404).json({ message: 'No ATS analysis found for this resume' });
    }

    res.json({
      success: true,
      analysis
    });
  } catch (error) {
    console.error('[ATS Route] Fetch analysis error:', error);
    res.status(500).json({ message: 'Server error fetching ATS analysis' });
  }
});

/**
 * @route GET /api/ats/resume/:resumeId/history
 * @desc Get ATS analysis history for a specific resume
 * @access Private (Student only)
 */
router.get('/resume/:resumeId/history', auth, async (req, res) => {
  try {
    const studentId = req.userId;
    const { resumeId } = req.params;

    const history = await ATSAnalysis.find({
      student: studentId,
      resume: resumeId
    }).sort({ createdAt: -1 }).limit(10);

    res.json({
      success: true,
      history
    });
  } catch (error) {
    console.error('[ATS Route] Fetch history error:', error);
    res.status(500).json({ message: 'Server error fetching ATS history' });
  }
});

module.exports = router;
