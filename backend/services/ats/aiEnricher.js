/**
 * AI Enricher Service
 * Uses Google Gemini AI to analyze grammar, bullet quality, weak statements, and generate improvement suggestions.
 * 
 * IMPORTANT:
 * - AI is NOT asked for a numeric score.
 * - AI output is validated and converted into structured suggestions/issues.
 * - If AI fails, is rate-limited, or disabled, system falls back to empty enrichment without breaking.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

function cleanJsonText(rawText) {
  if (!rawText) return '';
  return rawText
    .replace(/```json\n?/gi, '')
    .replace(/```\n?/gi, '')
    .trim();
}

async function enrichWithAI({ keys, parsedResume }) {
  if (!keys || !Array.isArray(keys) || keys.length === 0) {
    console.log('[AIElections] No AI keys configured. Skipping AI enrichment.');
    return getFallbackEnrichment(parsedResume);
  }

  const models = ['models/gemini-2.0-flash', 'models/gemini-flash-latest', 'gemini-1.5-flash'];
  const resumeSnippet = (parsedResume.rawText || '').slice(0, 15000);

  const prompt = `
You are an expert ATS resume reviewer and career consultant.
Analyze this resume for domain: ${parsedResume.detectedDomain || 'General'}.
Is Fresher: ${parsedResume.isFresher ? 'Yes' : 'No'}.

CRITICAL INSTRUCTIONS:
1. DO NOT assign a numeric score out of 100. (The score is computed deterministically).
2. Identify weak bullet points, grammar/phrasing issues, missing domain highlights, and constructive improvement actions.
3. Return ONLY a valid JSON object matching this schema exactly:

{
  "weakBullets": [
    {
      "original": "exact text from resume",
      "issue": "why it is weak",
      "suggestedRewrite": "improved bullet point with active verb and outcome"
    }
  ],
  "grammarIssues": [
    {
      "text": "text snippet",
      "suggestion": "grammar/typo fix"
    }
  ],
  "topSuggestions": [
    {
      "category": "content" | "sections" | "readability" | "experienceQuality" | "skillEvidence",
      "suggestion": "actionable suggestion string",
      "example": "concrete example string",
      "priority": "high" | "medium" | "low"
    }
  ],
  "aiSummary": "2-3 sentence overview of resume strengths and main areas to improve."
}

Resume Text:
"""
${resumeSnippet}
"""
`;

  let lastError = null;

  for (const key of keys) {
    if (!key) continue;
    try {
      const genAI = new GoogleGenerativeAI(key);
      for (const modelName of models) {
        try {
          const model = genAI.getGenerativeModel({ model: modelName });
          const result = await model.generateContent(prompt);
          const response = await result.response;
          const cleanedText = cleanJsonText(response.text());
          const parsed = JSON.parse(cleanedText);

          return validateAndSanitizeAIOutput(parsed, parsedResume);
        } catch (modelErr) {
          lastError = modelErr;
          continue;
        }
      }
    } catch (keyErr) {
      lastError = keyErr;
      continue;
    }
  }

  console.warn('[AIEnricher] AI enrichment failed, falling back to rule-based enrichment:', lastError?.message);
  return getFallbackEnrichment(parsedResume);
}

function validateAndSanitizeAIOutput(parsed, parsedResume) {
  const result = {
    weakBullets: [],
    grammarIssues: [],
    topSuggestions: [],
    aiSummary: ''
  };

  if (Array.isArray(parsed?.weakBullets)) {
    result.weakBullets = parsed.weakBullets.map(wb => ({
      original: String(wb.original || '').trim(),
      issue: String(wb.issue || '').trim(),
      suggestedRewrite: String(wb.suggestedRewrite || '').trim()
    })).filter(wb => wb.original && wb.suggestedRewrite);
  }

  if (Array.isArray(parsed?.grammarIssues)) {
    result.grammarIssues = parsed.grammarIssues.map(gi => ({
      text: String(gi.text || '').trim(),
      suggestion: String(gi.suggestion || '').trim()
    })).filter(gi => gi.text && gi.suggestion);
  }

  if (Array.isArray(parsed?.topSuggestions)) {
    const validCats = ['content', 'sections', 'readability', 'experienceQuality', 'skillEvidence'];
    result.topSuggestions = parsed.topSuggestions.map(ts => ({
      category: validCats.includes(ts.category) ? ts.category : 'content',
      suggestion: String(ts.suggestion || '').trim(),
      example: String(ts.example || '').trim(),
      priority: ['high', 'medium', 'low'].includes(ts.priority) ? ts.priority : 'medium'
    })).filter(ts => ts.suggestion);
  }

  result.aiSummary = String(parsed?.aiSummary || '').trim();

  return result;
}

function getFallbackEnrichment(parsedResume) {
  const fallbackSuggestions = [];

  if (parsedResume.wordCount < 250) {
    fallbackSuggestions.push({
      category: 'readability',
      suggestion: 'Expand your resume length with detailed responsibilities and project descriptions.',
      example: 'Add 2-3 bullet points per role or project describing tools used and results achieved.',
      priority: 'high'
    });
  }

  if (parsedResume.skills.length < 5) {
    fallbackSuggestions.push({
      category: 'skillEvidence',
      suggestion: `Add core domain skills for ${parsedResume.detectedDomain || 'your target career'}.`,
      example: 'Include both technical tools and domain-specific methodologies.',
      priority: 'medium'
    });
  }

  return {
    weakBullets: [],
    grammarIssues: [],
    topSuggestions: fallbackSuggestions,
    aiSummary: `Resume parsed under ${parsedResume.detectedDomain || 'General'} domain.`
  };
}

module.exports = {
  enrichWithAI
};
