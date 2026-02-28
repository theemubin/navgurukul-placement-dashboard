const mongoose = require('mongoose');

const scamReportSchema = new mongoose.Schema({
  // Company and role info
  companyName: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  roleName: {
    type: String,
    required: true,
    trim: true
  },

  // Analysis results
  trustScore: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  verdict: {
    type: String,
    required: true,
    enum: ['SAFE', 'WARNING', 'DANGER']
  },
  summary: {
    type: String,
    required: true
  },

  // Detailed analysis data
  analysisData: {
    subScores: {
      companyLegitimacy: { type: Number, min: 0, max: 100 },
      offerRealism: { type: Number, min: 0, max: 100 },
      processFlags: { type: Number, min: 0, max: 100 },
      communitySentiment: { type: Number, min: 0, max: 100 }
    },
    redFlags: [String],
    greenFlags: [String],
    communityFindings: [{
      source: String,
      icon: String,
      finding: String,
      sentiment: String,
      links: [{
        title: String,
        url: String
      }]
    }],
    salaryCheck: {
      offered: String,
      marketRate: String,
      verdict: String,
      explanation: String
    },
    domainAnalysis: {
      companyDomain: String,
      domainAge: String,
      domainRisk: String,
      senderDomainMatch: String,
      explanation: String
    },
    emailChecks: [{
      check: String,
      status: String,
      detail: String
    }],
    finalVerdict: String,
    actionItems: [String],
    resourceLinks: [{
      icon: String,
      title: String,
      desc: String,
      url: String
    }]
  },

  // Input details (for context)
  inputData: {
    originalText: { type: String, maxlength: 10000 }, // Truncated version
    emailHeader: String,
    senderEmail: String,
    companyUrl: String,
    sourceType: { type: String, enum: ['text', 'image', 'email'] }
  },

  // User reporting and metadata
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isPublic: {
    type: Boolean,
    default: true // Published by default for community benefit
  },

  // Community votes (students can vote if they agree/disagree)
  communityVotes: {
    agree: { type: Number, default: 0 }, // Agree with the verdict
    disagree: { type: Number, default: 0 }, // Disagree with verdict  
    helpful: { type: Number, default: 0 } // Found the report helpful
  },

  // Voters tracking (to prevent multiple votes from same user)
  voters: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    voteType: { type: String, enum: ['agree', 'disagree', 'helpful'] },
    votedAt: { type: Date, default: Date.now }
  }],

  // Comments system (forum-like discussion)
  comments: [{
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    content: {
      type: String,
      required: true,
      maxlength: 2000,
      trim: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    likes: {
      count: { type: Number, default: 0 },
      users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
    },
    edited: {
      isEdited: { type: Boolean, default: false },
      editedAt: Date
    },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'ScamReport.comments' }
  }],

  // Tags for better searching
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }], // e.g., ['internship-scam', 'fake-payment', 'whatsapp-recruitment']

  // Status
  status: {
    type: String,
    enum: ['active', 'archived', 'flagged'],
    default: 'active'
  },

  // Admin moderation
  moderatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  moderationNotes: String,

  // Analytics
  viewCount: { type: Number, default: 0 },
  lastViewed: Date
}, {
  timestamps: true // createdAt and updatedAt
});

// Indexes for better query performance
scamReportSchema.index({ companyName: 1, createdAt: -1 });
scamReportSchema.index({ verdict: 1, trustScore: -1 });
scamReportSchema.index({ isPublic: 1, status: 1, createdAt: -1 });
scamReportSchema.index({ tags: 1 });
scamReportSchema.index({ 'communityVotes.helpful': -1 });

// Virtual for company report count
scamReportSchema.virtual('companyReportCount', {
  ref: 'ScamReport',
  localField: 'companyName',
  foreignField: 'companyName',
  count: true
});

// Static method to find reports by company
scamReportSchema.statics.findByCompany = function (companyName, limit = 10) {
  return this.find({
    companyName: { $regex: new RegExp(companyName, 'i') },
    isPublic: true,
    status: 'active'
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('reportedBy', 'name studentId campus');
};

// Static method to get company stats
scamReportSchema.statics.getCompanyStats = function (companyName) {
  return this.aggregate([
    {
      $match: {
        companyName: { $regex: new RegExp(companyName, 'i') },
        isPublic: true,
        status: 'active'
      }
    },
    {
      $group: {
        _id: null,
        totalReports: { $sum: 1 },
        avgTrustScore: { $avg: '$trustScore' },
        dangerCount: {
          $sum: { $cond: [{ $eq: ['$verdict', 'DANGER'] }, 1, 0] }
        },
        warningCount: {
          $sum: { $cond: [{ $eq: ['$verdict', 'WARNING'] }, 1, 0] }
        },
        safeCount: {
          $sum: { $cond: [{ $eq: ['$verdict', 'SAFE'] }, 1, 0] }
        },
        totalHelpfulVotes: { $sum: '$communityVotes.helpful' }
      }
    }
  ]);
};

module.exports = mongoose.model('ScamReport', scamReportSchema);