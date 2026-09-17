/**
 * ATS Scoring Engine
 * Deterministic scoring engine that computes overall & category scores from structured check results.
 * 
 * Rules:
 * - AI does NOT set the score.
 * - Score is calculated deterministically from check weights.
 * - Freshers & non-technical candidates are scored fairly without unfair penalties.
 */

const CATEGORY_CONFIG = {
  experienced: {
    content: { maxScore: 20, label: 'Content Quality & Impact' },
    sections: { maxScore: 15, label: 'Essential Sections' },
    atsEssentials: { maxScore: 20, label: 'ATS Formatting & Essentials' },
    readability: { maxScore: 15, label: 'Readability & Layout' },
    experienceQuality: { maxScore: 15, label: 'Experience Quality & Metrics' },
    skillEvidence: { maxScore: 15, label: 'Skill Evidence & Context' }
  },
  fresher: {
    content: { maxScore: 25, label: 'Content Quality & Impact' },
    sections: { maxScore: 15, label: 'Essential Sections' },
    atsEssentials: { maxScore: 20, label: 'ATS Formatting & Essentials' },
    readability: { maxScore: 15, label: 'Readability & Layout' },
    experienceQuality: { maxScore: 10, label: 'Project & Academic History' },
    skillEvidence: { maxScore: 15, label: 'Skill Evidence & Context' }
  }
};

function calculateAtsScore({ parsedResume, checks, aiEnrichment = {} }) {
  const config = parsedResume.isFresher ? CATEGORY_CONFIG.fresher : CATEGORY_CONFIG.experienced;
  const categoriesResult = {};
  let totalComputedScore = 0;

  const categoryCheckGroups = {
    content: [],
    sections: [],
    atsEssentials: [],
    readability: [],
    experienceQuality: [],
    skillEvidence: []
  };

  // Group checks by category
  checks.forEach(check => {
    if (categoryCheckGroups[check.category]) {
      categoryCheckGroups[check.category].push(check);
    }
  });

  // Calculate each category score deterministically
  Object.keys(config).forEach(catKey => {
    const catConfig = config[catKey];
    const catChecks = categoryCheckGroups[catKey] || [];

    let totalPossibleWeight = 0;
    let passedWeight = 0;
    let passedCount = 0;

    catChecks.forEach(check => {
      totalPossibleWeight += check.weight;
      if (check.passed) {
        passedWeight += check.weight;
        passedCount++;
      }
    });

    const ratio = totalPossibleWeight > 0 ? passedWeight / totalPossibleWeight : 1;
    const catScore = Math.round(ratio * catConfig.maxScore);
    const catPercentage = Math.round(ratio * 100);

    totalComputedScore += catScore;

    categoriesResult[catKey] = {
      score: catScore,
      maxScore: catConfig.maxScore,
      percentage: catPercentage,
      passedChecks: passedCount,
      totalChecks: catChecks.length
    };
  });

  const overallScore = Math.min(100, Math.max(0, Math.round(totalComputedScore)));

  // Collect failed check issues
  const issues = [];
  checks.forEach(check => {
    if (!check.passed) {
      issues.push({
        id: check.id,
        category: check.category,
        severity: check.severity || 'suggestion',
        title: check.title,
        description: check.description || '',
        recommendation: check.recommendation || '',
        example: check.example || ''
      });
    }
  });

  // Include AI weak bullets into issues if present
  if (Array.isArray(aiEnrichment.weakBullets)) {
    aiEnrichment.weakBullets.forEach((wb, idx) => {
      issues.push({
        id: `ai_weak_bullet_${idx}`,
        category: 'experienceQuality',
        severity: 'suggestion',
        title: 'Weak bullet point phrasing',
        description: `Original: "${wb.original}" - ${wb.issue}`,
        recommendation: `Rewrite to emphasize action & impact.`,
        example: wb.suggestedRewrite
      });
    });
  }

  // Compile final suggestions list
  const suggestions = [];
  if (Array.isArray(aiEnrichment.topSuggestions)) {
    aiEnrichment.topSuggestions.forEach(sug => {
      suggestions.push({
        category: sug.category || 'content',
        suggestion: sug.suggestion,
        example: sug.example || '',
        priority: sug.priority || 'medium'
      });
    });
  }

  // Fallback suggestions if none were returned
  if (suggestions.length === 0 && issues.length > 0) {
    issues.slice(0, 3).forEach(iss => {
      suggestions.push({
        category: iss.category,
        suggestion: iss.recommendation || iss.title,
        example: iss.example || '',
        priority: iss.severity === 'critical' ? 'high' : 'medium'
      });
    });
  }

  return {
    overallScore,
    categories: categoriesResult,
    issues,
    suggestions,
    detectedSections: parsedResume.detectedSections || [],
    detectedSkills: parsedResume.skills || [],
    normalizedResume: {
      isFresher: parsedResume.isFresher,
      detectedDomain: parsedResume.detectedDomain,
      contact: parsedResume.contact,
      summary: parsedResume.contact?.summary || '',
      experienceCount: parsedResume.experienceCount,
      projectsCount: parsedResume.projectsCount,
      educationCount: parsedResume.detectedSections.includes('education') ? 1 : 0,
      certificationsCount: parsedResume.detectedSections.includes('certifications') ? 1 : 0,
      wordCount: parsedResume.wordCount,
      charCount: parsedResume.charCount
    }
  };
}

module.exports = {
  calculateAtsScore,
  CATEGORY_CONFIG
};
