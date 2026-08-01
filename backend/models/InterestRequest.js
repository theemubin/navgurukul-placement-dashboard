const mongoose = require('mongoose');

// Schema for Interest Requests (for students with <60% match who want to apply)
const interestRequestSchema = new mongoose.Schema({
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
  // Match details at time of request
  matchDetails: {
    overallPercentage: {
      type: Number,
      required: true
    },
    skillMatch: {
      matched: Number,
      required: Number,
      percentage: Number
    },
    eligibilityMatch: {
      tenthGrade: { meets: Boolean, required: Boolean },
      twelfthGrade: { meets: Boolean, required: Boolean },
      higherEducation: { meets: Boolean, required: Boolean },
      school: { meets: Boolean, required: Boolean },
      campus: { meets: Boolean, required: Boolean },
      module: { meets: Boolean, required: Boolean }
    },
    requirementsMatch: {
      met: Number,
      total: Number,
      percentage: Number
    }
  },
  // Student's reason for wanting to apply despite low match
  reason: {
    type: String,
    required: true,
    minlength: 50 // Require a meaningful explanation
  },
  // Missing skills/requirements the student acknowledges
  acknowledgedGaps: [{
    type: String // What the student is missing
  }],
  // How student plans to address the gaps
  improvementPlan: String,
  // The specific resume the student chose to apply with
  resume: String,
  // Request status
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  // Campus PoC review
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: Date,
  reviewNotes: String,
  rejectionReason: String,
  // If approved, this creates an Application
  applicationCreated: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application',
    default: null
  }
}, {
  timestamps: true
});

// Compound index to ensure one request per student per job
interestRequestSchema.index({ student: 1, job: 1 }, { unique: true });
interestRequestSchema.index({ status: 1, createdAt: -1 });
interestRequestSchema.index({ job: 1, status: 1 });

// Static method to get pending requests for a campus
interestRequestSchema.statics.getPendingForCampus = async function(campusId) {
  return this.aggregate([
    { $match: { status: 'pending' } },
    {
      $lookup: {
        from: 'users',
        localField: 'student',
        foreignField: '_id',
        as: 'studentInfo'
      }
    },
    { $unwind: '$studentInfo' },
    { $match: { 'studentInfo.campus': campusId } },
    {
      $lookup: {
        from: 'jobs',
        localField: 'job',
        foreignField: '_id',
        as: 'jobInfo'
      }
    },
    { $unwind: '$jobInfo' },
    {
      $project: {
        student: {
          _id: '$studentInfo._id',
          firstName: '$studentInfo.firstName',
          lastName: '$studentInfo.lastName',
          email: '$studentInfo.email'
        },
        job: {
          _id: '$jobInfo._id',
          title: '$jobInfo.title',
          company: '$jobInfo.company.name'
        },
        matchDetails: 1,
        reason: 1,
        acknowledgedGaps: 1,
        improvementPlan: 1,
        createdAt: 1
      }
    },
    { $sort: { createdAt: -1 } }
  ]);
};

module.exports = mongoose.model('InterestRequest', interestRequestSchema);
