const express = require('express');
const router = express.Router();
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const pdfParseModule = require('pdf-parse');
const pdfParse = pdfParseModule && (pdfParseModule.default || pdfParseModule);
const { auth } = require('../middleware/auth');
const AIService = require('../services/aiService');
const { resolveAIKeysForUser } = require('../utils/aiKeyResolver');
const User = require('../models/User');

function normalizeWhitespace(text = '') {
  return text.replace(/\s+/g, ' ').trim();
}

function extractGoogleDriveFileId(url = '') {
  const match = url.match(/(?:\/file\/d\/|[?&]id=)([a-zA-Z0-9_-]{10,})/);
  return match && match[1] ? match[1] : null;
}

async function downloadResumeBuffer(url) {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 20000,
    maxRedirects: 5,
    validateStatus: () => true
  });

  if (response.status >= 400) {
    throw new Error(`Failed to download resume (HTTP ${response.status})`);
  }

  const contentType = String(response.headers['content-type'] || '').toLowerCase();
  const buffer = Buffer.from(response.data || '');
  return { buffer, contentType, status: response.status };
}

async function extractPdfText(buffer) {
  if (!pdfParse) {
    throw new Error('PDF parsing library not available');
  }

  if (typeof pdfParse === 'function') {
    const parsed = await pdfParse(buffer);
    return parsed?.text || '';
  }

  if (pdfParse.PDFParse) {
    const parser = new pdfParse.PDFParse({ data: buffer });
    const result = await parser.getText();
    return result?.text || '';
  }

  throw new Error('Unsupported pdf-parse API');
}

function extractJsonBlock(text = '') {
  const cleaned = String(text)
    .replace(/```json\n?/gi, '')
    .replace(/```\n?/g, '')
    .trim();
  return cleaned;
}

function normalizeActionItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    if (typeof item === 'string') return item;
    const priority = item?.priority ? `[${String(item.priority).toUpperCase()}] ` : '';
    const issue = item?.issue || 'Issue';
    const fix = item?.fix || '';
    const example = item?.exampleRewrite ? ` Example: ${item.exampleRewrite}` : '';
    return `${priority}${issue}${fix ? ` - ${fix}` : ''}${example}`;
  }).filter(Boolean);
}

async function generateAtsWithAI({ keys, resumeText, studentName, school, studentEmail, studentPhone, studentLinkedIn }) {
  const models = ['models/gemini-2.0-flash', 'models/gemini-flash-latest', 'gemini-1.5-flash'];
  let lastError = null;

  for (const key of keys) {
    const genAI = new GoogleGenerativeAI(key);
    for (const modelName of models) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const prompt = `
You are an expert ATS reviewer.

CRITICAL RULES:
1) Use AI reasoning only.
      2) First verify whether resume belongs to student by checking identity signals.
3) If name does not reasonably match, set nameMatch.isMatch=false and explain why.
4) Return ONLY valid JSON.

Context:
- Student Name: ${studentName}
- School: ${school || 'Unknown'}
      - Student Email: ${studentEmail || 'N/A'}
      - Student Phone: ${studentPhone || 'N/A'}
      - Student LinkedIn: ${studentLinkedIn || 'N/A'}

      Identity Match Guidance:
      - Treat as match if resume has strong evidence from ANY of these: full/near name match, matching email, matching phone, or matching LinkedIn handle/profile.
      - Name variations allowed: initials, middle name added/omitted, reversed order, minor spacing/punctuation changes.
      - If first-name or last-name alone clearly appears in resume owner section with other corroborating identity signals, mark as match with moderate confidence.
      - If the document appears to be a job description or not a resume, mark documentType accordingly and set nameMatch.isMatch=false.

Resume Text:
"""
${resumeText.slice(0, 24000)}
"""

Return JSON in this schema exactly:
{
  "overallScore": number,
  "qualityFlag": "ok" | "low_text_extraction",
  "breakdown": {
    "keywordAlignment": number,
    "skillsRelevance": number,
    "projectImpact": number,
    "structureReadability": number,
    "experienceStrength": number
  },
  "strengths": [string],
  "gaps": [string],
  "actionItems": [
    {
      "priority": "high" | "medium" | "low",
      "issue": string,
      "fix": string,
      "exampleRewrite": string
    }
  ],
  "atsSummary": string,
  "documentType": "resume" | "job_description" | "other",
  "nameMatch": {
    "isMatch": boolean,
    "confidence": number,
    "matchedName": string,
    "reason": string
  }
}
`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const parsed = JSON.parse(extractJsonBlock(response.text()));
        return parsed;
      } catch (error) {
        lastError = error;
      }
    }
  }

  throw lastError || new Error('AI ATS generation failed');
}

async function generateNameMatchDecisionWithAI({ keys, resumeText, studentName, studentEmail, studentPhone, studentLinkedIn }) {
  const models = ['models/gemini-2.0-flash', 'models/gemini-flash-latest', 'gemini-1.5-flash'];
  let lastError = null;

  for (const key of keys) {
    const genAI = new GoogleGenerativeAI(key);
    for (const modelName of models) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const prompt = `
You are an identity validator for resume ownership.

Task: Determine if this resume belongs to the student profile.
Use ONLY the given identity clues and resume text.

Student identity:
- Name: ${studentName}
- Email: ${studentEmail || 'N/A'}
- Phone: ${studentPhone || 'N/A'}
- LinkedIn: ${studentLinkedIn || 'N/A'}

Rules:
- Accept reasonable variations in name spelling/order/initials.
- Any one strong signal (exact email/phone/linkedin handle) can establish a match.
- If confidence is low or contradictory, set isMatch=false.

Resume text:
"""
${resumeText.slice(0, 20000)}
"""

Return ONLY JSON:
{
  "isMatch": boolean,
  "confidence": number,
  "matchedName": string,
  "reason": string
}
`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const parsed = JSON.parse(extractJsonBlock(response.text()));
        return {
          isMatch: parsed?.isMatch === true,
          confidence: Number(parsed?.confidence || 0),
          matchedName: parsed?.matchedName || '',
          reason: parsed?.reason || 'AI verification result'
        };
      } catch (error) {
        lastError = error;
      }
    }
  }

  throw lastError || new Error('AI identity verification failed');
}

/**
 * @swagger
 * tags:
 *   name: Utils
 *   description: Utility endpoints for URL checking and AI analysis
 */

// POST /api/utils/check-url
// Body: { url: string }
// Returns: { ok: boolean, status: number, statusText?: string }
/**
 * @swagger
 * /api/utils/check-url:
 *   post:
 *     summary: Verify if a URL is accessible
 *     tags: [Utils]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *             properties:
 *               url:
 *                 type: string
 *     responses:
 *       200:
 *         description: URL check result
 *       400:
 *         description: Invalid URL
 */
router.post('/check-url', auth, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ message: 'Invalid URL' });
    }

    // Basic URL validation
    let parsed;
    try {
      parsed = new URL(url);
    } catch (err) {
      return res.status(400).json({ message: 'Invalid URL format' });
    }

    // Use robust checker to determine accessibility
    const { checkUrlAccessible } = require('../utils/urlChecker');
    const result = await checkUrlAccessible(url);
    // Normalize response
    return res.json({ ok: !!result.ok, status: result.status || null, contentType: result.contentType || null, reason: result.reason || null });
  } catch (error) {
    console.error('Check URL error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @swagger
 * /api/utils/resume-ats/check:
 *   post:
 *     summary: Check ATS score from student's resume link
 *     tags: [Utils]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: ATS score calculated
 */
router.post('/resume-ats/check', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId);
    if (!currentUser || currentUser.role !== 'student') {
      return res.status(403).json({ message: 'Only students can run ATS check on their profile resume.' });
    }

    // Always use profile resume link to avoid checking arbitrary links.
    const resumeUrl = (currentUser.studentProfile?.resumeLink || '').trim();

    if (!resumeUrl) {
      return res.status(400).json({ message: 'Resume link is required. Please add it in profile first.' });
    }

    const { checkUrlAccessible } = require('../utils/urlChecker');
    const accessResult = await checkUrlAccessible(resumeUrl);

    if (!accessResult.ok) {
      currentUser.studentProfile.resumeAts = {
        status: 'failed',
        sourceUrl: resumeUrl,
        checkedAt: new Date(),
        errorMessage: 'Resume link is not accessible'
      };
      await currentUser.save();
      return res.status(400).json({ message: 'Resume link is not accessible. Make sure it is public.', reason: accessResult.reason || 'inaccessible' });
    }

    let downloadUrl = accessResult.candidate || resumeUrl;
    let file = await downloadResumeBuffer(downloadUrl);

    // If we got HTML from a Drive share page, force direct-download URL once.
    if (String(file.contentType || '').includes('text/html') && /drive\.google\.com/i.test(downloadUrl)) {
      const fileId = extractGoogleDriveFileId(downloadUrl);
      if (fileId) {
        downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
        file = await downloadResumeBuffer(downloadUrl);
      }
    }

    const parsedText = await extractPdfText(file.buffer);
    const resumeText = normalizeWhitespace(parsedText || '');

    if (!resumeText) {
      currentUser.studentProfile.resumeAts = {
        status: 'failed',
        sourceUrl: resumeUrl,
        checkedAt: new Date(),
        errorMessage: 'No extractable text found in resume PDF'
      };
      await currentUser.save();
      return res.status(422).json({ message: 'Could not extract text from resume. Please upload a text-based PDF.' });
    }

    const aiRuntime = await resolveAIKeysForUser(req.userId);
    if (!aiRuntime.aiEnabled) {
      return res.status(503).json({ message: 'AI service is disabled by admin. ATS is AI-only.' });
    }
    if (!aiRuntime.keys || aiRuntime.keys.length === 0) {
      return res.status(400).json({ message: 'No AI API key configured. Configure key in settings used by scam tester.' });
    }

    const studentName = `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim();
    const aiScore = await generateAtsWithAI({
      keys: aiRuntime.keys,
      resumeText,
      studentName,
      school: currentUser.studentProfile?.currentSchool,
      studentEmail: currentUser.email || '',
      studentPhone: currentUser.phone || currentUser.studentProfile?.phone || '',
      studentLinkedIn: currentUser.studentProfile?.linkedIn || ''
    });

    const nameMatch = aiScore?.nameMatch || {};
    let matchConfidence = Number(nameMatch?.confidence || 0);
    const documentType = String(aiScore?.documentType || 'resume').toLowerCase();
    const matchedNameText = String(nameMatch?.matchedName || '').trim().toLowerCase();
    const invalidMatchedName = !matchedNameText || ['none', 'n/a', 'na', 'unknown'].includes(matchedNameText);

    let isNameMatch = (nameMatch?.isMatch === true && matchConfidence >= 30)
      || (documentType === 'resume' && !invalidMatchedName && matchConfidence >= 45);

    // AI-only second pass to reduce false negatives on real resumes.
    if (!isNameMatch && documentType === 'resume') {
      try {
        const secondPass = await generateNameMatchDecisionWithAI({
          keys: aiRuntime.keys,
          resumeText,
          studentName,
          studentEmail: currentUser.email || '',
          studentPhone: currentUser.phone || currentUser.studentProfile?.phone || '',
          studentLinkedIn: currentUser.studentProfile?.linkedIn || ''
        });

        if (secondPass.isMatch === true && secondPass.confidence >= 40) {
          isNameMatch = true;
          matchConfidence = Math.max(matchConfidence, Number(secondPass.confidence || 0));
          nameMatch.isMatch = true;
          nameMatch.matchedName = secondPass.matchedName || nameMatch.matchedName;
          nameMatch.reason = `Second-pass AI verification accepted: ${secondPass.reason}`;
        }
      } catch (verifyErr) {
        // Keep primary AI decision when second-pass verification fails.
        console.warn('Second-pass AI identity verification failed:', verifyErr.message);
      }
    }

    if (!isNameMatch || documentType !== 'resume') {
      let mismatchMessage = 'Resume name does not match your profile. Please upload your own resume link.';
      if (documentType === 'job_description') {
        mismatchMessage = 'The uploaded file looks like a Job Description, not a student resume.';
      } else if (documentType === 'other') {
        mismatchMessage = 'The uploaded file does not look like a resume.';
      }

      currentUser.studentProfile.resumeAts = {
        status: 'failed',
        sourceUrl: resumeUrl,
        checkedAt: new Date(),
        errorMessage: `${mismatchMessage} ${nameMatch?.reason || ''}`.trim(),
        nameMatch: {
          isMatch: false,
          confidence: matchConfidence,
          matchedName: nameMatch?.matchedName || '',
          reason: nameMatch?.reason || 'AI could not confirm ownership'
        }
      };
      await currentUser.save();
      return res.status(422).json({
        message: mismatchMessage,
        documentType,
        nameMatch: currentUser.studentProfile.resumeAts.nameMatch
      });
    }

    const storedAts = {
      overallScore: Number(aiScore?.overallScore || 0),
      qualityFlag: aiScore?.qualityFlag === 'low_text_extraction' ? 'low_text_extraction' : 'ok',
      textLength: resumeText.length,
      status: 'ok',
      sourceUrl: resumeUrl,
      checkedAt: new Date(),
      errorMessage: null,
      atsSummary: aiScore?.atsSummary || '',
      nameMatch: {
        isMatch: true,
        confidence: matchConfidence,
        matchedName: nameMatch?.matchedName || studentName,
        reason: nameMatch?.reason || 'Matched via AI validation'
      },
      breakdown: {
        keywordAlignment: Number(aiScore?.breakdown?.keywordAlignment || 0),
        skillsRelevance: Number(aiScore?.breakdown?.skillsRelevance || 0),
        projectImpact: Number(aiScore?.breakdown?.projectImpact || 0),
        structureReadability: Number(aiScore?.breakdown?.structureReadability || 0),
        experienceStrength: Number(aiScore?.breakdown?.experienceStrength || 0)
      },
      strengths: Array.isArray(aiScore?.strengths) ? aiScore.strengths.slice(0, 10) : [],
      gaps: Array.isArray(aiScore?.gaps) ? aiScore.gaps.slice(0, 10) : [],
      actionItems: normalizeActionItems(aiScore?.actionItems).slice(0, 10)
    };

    currentUser.studentProfile.resumeAts = storedAts;
    await currentUser.save();

    return res.json({
      message: 'ATS score generated successfully',
      data: {
        ...storedAts
      }
    });
  } catch (error) {
    console.error('Resume ATS check error:', error);
    return res.status(500).json({ message: 'Failed to generate ATS score', error: error.message });
  }
});

// POST /api/utils/analyze-scam
// Body: { input: string }
// Returns: Scam analysis JSON
// POST /api/utils/test-ai-key
// Test if the Google AI key works with Gemini
/**
 * @swagger
 * /api/utils/test-ai-key:
 *   post:
 *     summary: Test configured Google AI keys
 *     tags: [Utils]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Test result
 */
router.post('/test-ai-key', auth, async (req, res) => {
  let aiRuntime = null;

  try {
    aiRuntime = await resolveAIKeysForUser(req.userId);

    if (!aiRuntime.aiEnabled) {
      return res.json({
        success: false,
        error: 'AI service is disabled by admin',
        keyInfo: {
          hasUserKeys: aiRuntime.hasUserKeys,
          hasGlobalKeys: aiRuntime.hasGlobalKeys,
          hasDeveloperKey: aiRuntime.hasDeveloperKey,
          totalKeys: aiRuntime.keys.length
        }
      });
    }

    if (aiRuntime.keys.length === 0) {
      return res.json({
        success: false,
        error: 'No API key configured',
        keyInfo: {
          hasUserKeys: false,
          hasGlobalKeys: false,
          hasDeveloperKey: false,
          totalKeys: 0
        }
      });
    }

    let successModel, successKey, testResponse;
    const errors = [];
    const { GoogleGenerativeAI } = require('@google/generative-ai');

    // Try multiple model IDs to find one that works for this key
    const modelsToTry = [
      'gemini-1.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash-latest',
      'models/gemini-1.5-flash',
      'gemini-pro'
    ];

    // Test each key until one works
    for (let i = 0; i < aiRuntime.keys.length; i++) {
      const currentKey = aiRuntime.keys[i];
      const genAI = new GoogleGenerativeAI(currentKey);

      console.log(`Testing API key #${i + 1} (first 15 chars): ${currentKey.substring(0, 15)}...`);

      for (const modelName of modelsToTry) {
        try {
          const model = genAI.getGenerativeModel({ model: modelName });
          // Minimal token usage test
          const result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: 'Say "OK"' }] }], generationConfig: { maxOutputTokens: 5 } });
          const response = await result.response;
          testResponse = response.text();
          successModel = modelName;
          successKey = currentKey;
          console.log(`  ✓ Key #${i + 1} Success with model: ${modelName}`);
          break; // Model worked
        } catch (err) {
          const msg = err.message || 'Unknown error';
          console.log(`  ✗ Model ${modelName} failed:`, msg.substring(0, 80));
          errors.push({ keyIndex: i, model: modelName, error: msg });

          // If it's a fatal key error (auth/rate limit), don't try other models for THIS key
          if (msg.includes('invalid') || msg.includes('403') || msg.includes('PermissionDenied') || msg.includes('authentication') || msg.includes('unauthorized')) {
            break;
          }

          // If it's a quota error, we stop here as well for this key
          if (msg.includes('quota') || msg.includes('429')) {
            break;
          }
        }
      }

      if (successModel) break; // Found a working key+model combo
    }

    if (!successModel) {
      // Pick the most relevant error to show the user
      const lastErrorMsg = errors[errors.length - 1]?.error || 'All keys and models failed';
      throw new Error(lastErrorMsg);
    }

    res.json({
      success: true,
      message: aiRuntime.keys.length > 1 ? `Success! Working key found among ${aiRuntime.keys.length} keys.` : 'API key works!',
      testResponse,
      model: successModel,
      keyInfo: {
        hasUserKeys: aiRuntime.hasUserKeys,
        hasGlobalKeys: aiRuntime.hasGlobalKeys,
        hasDeveloperKey: aiRuntime.hasDeveloperKey,
        totalKeys: aiRuntime.keys.length,
        usedKeyIndex: aiRuntime.keys.indexOf(successKey)
      }
    });
  } catch (error) {
    console.error('AI key test failed:', error);

    let suggestion = '';
    const errorMsg = error?.message || '';

    if (errorMsg.includes('404') || errorMsg.includes('not found')) {
      suggestion = `Your API key is valid but can't access Gemini models. Most common causes:

1. Terms of Service not accepted:
   - Go to https://aistudio.google.com
   - Look for a banner asking you to accept Terms
   - Accept it, then try again

2. API not enabled:
   - Go to https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com
   - Click "Enable"
   - Wait 1-2 minutes for it to propagate

3. Create a completely fresh key:
   - Visit https://aistudio.google.com/app/apikey
   - Delete ALL old keys
   - Click "Create API Key"
   - Use the NEW key here

If none of these work, your account might need billing enabled (even though it's free).`;
    } else if (errorMsg.includes('authentication') || errorMsg.includes('permission') || errorMsg.includes('unauthorized') || errorMsg.includes('403')) {
      suggestion = 'API key authentication failed. Make sure you\'re using a valid API key from https://aistudio.google.com/app/apikey';
    } else if (errorMsg.includes('quota') || errorMsg.includes('rate limit') || errorMsg.includes('429')) {
      suggestion = `✅ GOOD NEWS: Your API key IS WORKING! You just hit the rate limit from testing multiple times.

What this means:
- Your API is properly enabled ✓
- Your key can access Gemini ✓  
- You've just used your free quota for this minute

What to do:
1. Wait 60 seconds for the quota to reset
2. DON'T click "Test Key" anymore - it works!
3. Just try the actual Scam Detector now

Your scam analysis will work now. The free tier allows 15 requests per minute, which is plenty for normal use.`;
    } else {
      suggestion = 'Unexpected error. Try creating a fresh API key from https://aistudio.google.com/app/apikey';
    }

    res.json({
      success: false,
      error: errorMsg,
      suggestion: suggestion,
      keyInfo: aiRuntime ? {
        hasUserKeys: aiRuntime.hasUserKeys,
        hasGlobalKeys: aiRuntime.hasGlobalKeys,
        hasDeveloperKey: aiRuntime.hasDeveloperKey,
        totalKeys: aiRuntime.keys.length
      } : {
        hasUserKeys: false,
        hasGlobalKeys: false,
        hasDeveloperKey: false,
        totalKeys: 0
      }
    });
  }
});

/**
 * @swagger
 * /api/utils/analyze-scam:
 *   post:
 *     summary: Analyze a job offer for potential scam indicators
 *     tags: [Utils]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               input:
 *                 type: string
 *               imageBase64:
 *                 type: string
 *               imageMimeType:
 *                 type: string
 *               emailHeader:
 *                 type: string
 *               senderEmail:
 *                 type: string
 *               companyUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Scam analysis result
 */
router.post('/analyze-scam', auth, async (req, res) => {
  try {
    const {
      input,
      imageBase64,
      imageMimeType,
      emailHeader,
      senderEmail,
      companyUrl,
      sourceType
    } = req.body || {};

    const safeInput = typeof input === 'string' ? input.trim() : '';
    const safeImage = typeof imageBase64 === 'string' ? imageBase64.trim() : '';
    const safeEmailHeader = typeof emailHeader === 'string' ? emailHeader.trim() : '';
    const safeSenderEmail = typeof senderEmail === 'string' ? senderEmail.trim() : '';
    const safeCompanyUrl = typeof companyUrl === 'string' ? companyUrl.trim() : '';

    if (!safeInput && !safeImage && !safeEmailHeader && !safeSenderEmail) {
      return res.status(400).json({ message: 'Offer details are required' });
    }

    const payload = {
      input: safeInput,
      imageBase64: safeImage,
      imageMimeType,
      emailHeader: safeEmailHeader,
      senderEmail: safeSenderEmail,
      companyUrl: safeCompanyUrl,
      sourceType
    };

    const aiRuntime = await resolveAIKeysForUser(req.userId);
    const aiService = new AIService(aiRuntime.keys);

    if (!aiRuntime.aiEnabled) {
      const fallback = aiService.analyzeScamFallback(payload, 'AI service is currently disabled by admin.');
      return res.json(fallback);
    }

    if (aiRuntime.keys.length === 0) {
      const fallback = aiService.analyzeScamFallback(payload, 'No AI API key configured. Add your Google AI Studio API key in settings.');
      return res.json(fallback);
    }

    let analysis;
    try {
      const keyPreview = aiRuntime.keys.map((k, i) => `Key${i + 1}:...${k.slice(-8)}`).join(' | ');
      console.log(`[AnalyzeScam] Starting analysis with ${aiRuntime.keys.length} keys: ${keyPreview}`);
      analysis = await aiService.analyzeScam(payload);
      console.log(`[AnalyzeScam] ✅ Analysis complete, AI mode activated`);
    } catch (aiError) {
      console.error('[AnalyzeScam] ❌ AI analysis failed:', {
        message: aiError.message,
        code: aiError.code,
        keyCount: aiRuntime.keys.length,
        keyPreview: aiRuntime.keys.map((k, i) => `Key${i + 1}:...${k.slice(-8)}`).join(' | '),
        hasUserKeys: aiRuntime.hasUserKeys,
        hasGlobalKeys: aiRuntime.hasGlobalKeys,
        hasDeveloperKey: aiRuntime.hasDeveloperKey
      });
      console.warn('[AnalyzeScam] Falling back to heuristic analysis');
      analysis = aiService.analyzeScamFallback(payload, aiError.message || 'AI provider unavailable');
    }

    res.json(analysis);
  } catch (error) {
    console.error('Analyze scam error:', error);
    const message = error.message || 'Failed to analyze offer';
    res.status(500).json({ message });
  }
});

module.exports = router;
