/**
 * Master ATS Service Coordinator
 * Combines parser, check rules, AI enrichment, and scoring engine.
 * Handles hash-based duplicate analysis caching and persistence.
 */

const crypto = require('crypto');
const ATSAnalysis = require('../../models/ATSAnalysis');
const { parseResume } = require('./resumeParser');
const { runAtsChecks } = require('./checkRules');
const { enrichWithAI } = require('./aiEnricher');
const { calculateAtsScore } = require('./scoringEngine');

const ANALYSIS_VERSION = '1.0.0';

function computeResumeHash(text) {
  const normalized = (text || '').trim().replace(/\s+/g, ' ');
  return crypto.createHash('md5').update(normalized + '_' + ANALYSIS_VERSION).digest('hex');
}

async function analyzeResume({ studentId, resumeId, rawText, metadata = {}, aiKeys = [], forceRefresh = false }) {
  if (!studentId) {
    throw new Error('Student ID is required');
  }
  if (!rawText || !rawText.trim()) {
    const error = new Error('Extracted resume text is empty or unreadable');
    error.statusCode = 422;
    error.code = 'EMPTY_TEXT';
    throw error;
  }

  const resumeHash = computeResumeHash(rawText);
  const cleanResumeId = String(resumeId || 'primary');

  // Check cache if forceRefresh is false
  if (!forceRefresh) {
    const existingAnalysis = await ATSAnalysis.findOne({
      student: studentId,
      resume: cleanResumeId,
      $or: [
        { resumeVersionOrHash: resumeHash },
        { resumeHash: resumeHash }
      ],
      analysisVersion: ANALYSIS_VERSION
    });

    if (existingAnalysis) {
      console.log(`[ATSService] Reusing existing ATS analysis for student=${studentId}, resume=${cleanResumeId}`);
      return {
        isCached: true,
        analysis: existingAnalysis
      };
    }
  }

  // Step 1: Parse & normalize resume
  const parsedResume = parseResume(rawText, metadata);

  // Step 2: Run deterministic check rules
  const checkResults = runAtsChecks(parsedResume);

  // Step 3: Run AI enrichment (non-blocking fallback on error)
  let aiEnrichment = {};
  try {
    aiEnrichment = await enrichWithAI({ keys: aiKeys, parsedResume });
  } catch (aiErr) {
    console.warn('[ATSService] AI enrichment warning (continuing with deterministic scoring):', aiErr.message);
  }

  // Step 4: Calculate deterministic scores
  const scoreResult = calculateAtsScore({
    parsedResume,
    checks: checkResults,
    aiEnrichment
  });

  // Step 5: Save or update ATSAnalysis in database
  const analysisPayload = {
    student: studentId,
    resume: cleanResumeId,
    resumeVersionOrHash: resumeHash,
    resumeHash: resumeHash,
    analysisVersion: ANALYSIS_VERSION,
    overallScore: scoreResult.overallScore,
    categories: scoreResult.categories,
    checks: checkResults.map(c => ({
      id: c.id,
      category: c.category,
      name: c.name,
      passed: c.passed,
      weight: c.weight,
      severity: c.severity,
      title: c.title,
      description: c.description,
      recommendation: c.recommendation,
      example: c.example
    })),
    issues: scoreResult.issues,
    suggestions: scoreResult.suggestions,
    detectedSections: scoreResult.detectedSections,
    detectedSkills: scoreResult.detectedSkills,
    normalizedResume: scoreResult.normalizedResume,
    parserMetadata: {
      textLength: rawText.length,
      isAccessible: metadata.isAccessible !== false,
      qualityFlag: rawText.length < 150 ? 'low_text_extraction' : 'ok',
      sourceUrl: metadata.sourceUrl || '',
      fileName: metadata.fileName || '',
      parsedAt: new Date()
    }
  };

  const analysis = await ATSAnalysis.findOneAndUpdate(
    {
      student: studentId,
      resume: cleanResumeId,
      resumeVersionOrHash: resumeHash,
      analysisVersion: ANALYSIS_VERSION
    },
    analysisPayload,
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return {
    isCached: false,
    analysis
  };
}

module.exports = {
  analyzeResume,
  computeResumeHash,
  ANALYSIS_VERSION
};
