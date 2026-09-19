const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true
  },
  status: {
    type: String,
    default: 'applied'
    // Status should ideally match one of the IDs in Settings.jobPipelineStages
  },
  applicationType: {
    type: String,
    enum: ['regular', 'interest'],
    default: 'regular'
  },
  currentRound: {
    type: Number,
    default: 0
  },
  roundResults: [{
    round: Number,
    roundName: String,
    status: {
      type: String,
      enum: ['pending', 'scheduled', 'passed', 'failed']
    },
    scheduledDate: Date, // When this round is scheduled
    completedAt: Date, // When the round was completed
    score: Number,
    feedback: String,
    evaluatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    evaluatedAt: Date
  }],
  specialRecommendation: {
    isRecommended: {
      type: Boolean,
      default: false
    },
    recommendedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: String,
    recommendedAt: Date
  },
  resume: String, // Resume used for this application
  resumeSnapshot: {
    role: String,
    url: String,
    publicId: String,
    uploadedAt: Date
  },
  coverLetter: String,
  customResponses: [{
    requirement: String,
    response: Boolean,
    isMandatory: Boolean
  }],
  feedback: String,
  feedbackBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Coordinator comment associated with current status (e.g., reason for closing)
  statusComment: {
    type: String,
    default: ''
  },
  // History of status changes for audit / display to students
  statusHistory: [{
    status: String,
    changedAt: Date,
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    comment: String
  }],
  // Intervention history logged by PoC, Coordinator, or Manager
  interventions: [{
    actionType: {
      type: String,
      enum: ['mock_interview_scheduled', 'hr_followup', 'resume_review', 'poc_counseling', 'other'],
      default: 'other'
    },
    note: {
      type: String,
      required: true
    },
    remedialTag: {
      type: String,
      default: ''
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  offerDetails: {
    salary: Number,
    joiningDate: Date,
    offerLetter: String,
    acceptedAt: Date
  }
}, {
  timestamps: true
});

// Compound index for unique applications
applicationSchema.index({ student: 1, job: 1 }, { unique: true });
applicationSchema.index({ job: 1, student: 1, status: 1 });
applicationSchema.index({ job: 1, status: 1 });

module.exports = mongoose.model('Application', applicationSchema);
