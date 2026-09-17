const mongoose = require('mongoose');

const atsAnalysisSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  resume: {
    type: String, // resumeId (e.g. subdocument _id.toString())
    required: true,
    index: true
  },
  resumeVersionOrHash: {
    type: String,
    required: true,
    index: true
  },
  resumeHash: {
    type: String,
    sparse: true
  },
  analysisVersion: {
    type: String,
    default: '1.0.0'
  },
  overallScore: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  categories: {
    content: {
      score: { type: Number, default: 0 },
      maxScore: { type: Number, default: 20 },
      percentage: { type: Number, default: 0 },
      passedChecks: { type: Number, default: 0 },
      totalChecks: { type: Number, default: 0 }
    },
    sections: {
      score: { type: Number, default: 0 },
      maxScore: { type: Number, default: 15 },
      percentage: { type: Number, default: 0 },
      passedChecks: { type: Number, default: 0 },
      totalChecks: { type: Number, default: 0 }
    },
    atsEssentials: {
      score: { type: Number, default: 0 },
      maxScore: { type: Number, default: 20 },
      percentage: { type: Number, default: 0 },
      passedChecks: { type: Number, default: 0 },
      totalChecks: { type: Number, default: 0 }
    },
    readability: {
      score: { type: Number, default: 0 },
      maxScore: { type: Number, default: 15 },
      percentage: { type: Number, default: 0 },
      passedChecks: { type: Number, default: 0 },
      totalChecks: { type: Number, default: 0 }
    },
    experienceQuality: {
      score: { type: Number, default: 0 },
      maxScore: { type: Number, default: 15 },
      percentage: { type: Number, default: 0 },
      passedChecks: { type: Number, default: 0 },
      totalChecks: { type: Number, default: 0 }
    },
    skillEvidence: {
      score: { type: Number, default: 0 },
      maxScore: { type: Number, default: 15 },
      percentage: { type: Number, default: 0 },
      passedChecks: { type: Number, default: 0 },
      totalChecks: { type: Number, default: 0 }
    }
  },
  checks: [{
    id: String,
    category: String,
    name: String,
    passed: Boolean,
    weight: Number,
    severity: String,
    title: String,
    description: String,
    recommendation: String,
    example: String
  }],
  issues: [{
    id: { type: String, required: true },
    category: {
      type: String,
      enum: ['content', 'sections', 'atsEssentials', 'readability', 'experienceQuality', 'skillEvidence'],
      required: true
    },
    severity: {
      type: String,
      enum: ['critical', 'warning', 'suggestion'],
      default: 'suggestion'
    },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    recommendation: { type: String, default: '' },
    example: { type: String, default: '' }
  }],
  suggestions: [{
    category: { type: String, default: 'general' },
    suggestion: { type: String, required: true },
    example: { type: String, default: '' },
    priority: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' }
  }],
  detectedSections: [{ type: String }],
  detectedSkills: [{
    name: { type: String, required: true },
    category: { type: String, default: 'general' }, // 'technical' | 'soft' | 'domain' | 'tool' | 'general'
    hasEvidence: { type: Boolean, default: false },
    evidenceContext: { type: String, default: '' }
  }],
  normalizedResume: {
    isFresher: { type: Boolean, default: false },
    detectedDomain: { type: String, default: 'General' },
    contact: {
      name: { type: String, default: '' },
      email: { type: String, default: '' },
      phone: { type: String, default: '' },
      linkedin: { type: String, default: '' },
      github: { type: String, default: '' },
      portfolio: { type: String, default: '' },
      location: { type: String, default: '' }
    },
    summary: { type: String, default: '' },
    experienceCount: { type: Number, default: 0 },
    projectsCount: { type: Number, default: 0 },
    educationCount: { type: Number, default: 0 },
    certificationsCount: { type: Number, default: 0 },
    wordCount: { type: Number, default: 0 },
    charCount: { type: Number, default: 0 }
  },
  parserMetadata: {
    textLength: { type: Number, default: 0 },
    isAccessible: { type: Boolean, default: true },
    qualityFlag: { type: String, enum: ['ok', 'low_text_extraction'], default: 'ok' },
    sourceUrl: { type: String, default: '' },
    fileName: { type: String, default: '' },
    parsedAt: { type: Date, default: Date.now }
  }
}, {
  timestamps: true
});

atsAnalysisSchema.index({ student: 1, resume: 1, resumeVersionOrHash: 1, analysisVersion: 1 }, { unique: true });

module.exports = mongoose.model('ATSAnalysis', atsAnalysisSchema);
