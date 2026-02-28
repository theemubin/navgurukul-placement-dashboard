const express = require('express');
const router = express.Router();
const axios = require('axios');
const { auth } = require('../middleware/auth');
const AIService = require('../services/aiService');
const { resolveAIKeysForUser } = require('../utils/aiKeyResolver');

// POST /api/utils/check-url
// Body: { url: string }
// Returns: { ok: boolean, status: number, statusText?: string }
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

// POST /api/utils/analyze-scam
// Body: { input: string }
// Returns: Scam analysis JSON
// POST /api/utils/test-ai-key
// Test if the Google AI key works with Gemini
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
