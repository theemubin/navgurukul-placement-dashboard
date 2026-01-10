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
    enum: ['applied', 'shortlisted', 'in_progress', 'selected', 'rejected', 'withdrawn'],
    default: 'applied'
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

module.exports = mongoose.model('Application', applicationSchema);
