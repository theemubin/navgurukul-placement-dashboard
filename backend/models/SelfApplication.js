const mongoose = require('mongoose');

// Schema for Self-Applications (external job applications by students)
const selfApplicationSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Company Details
  company: {
    name: {
      type: String,
      required: true
    },
    website: String,
    location: String
  },
  // Job Details
  jobTitle: {
    type: String,
    required: true
  },
  jobLink: {
    type: String // URL to the job posting
  },
  jobType: {
    type: String,
    enum: ['full_time', 'part_time', 'internship', 'contract', 'freelance'],
    default: 'full_time'
  },
  // Salary offered
  salary: {
    amount: Number,
    currency: {
      type: String,
      default: 'INR'
    },
    frequency: {
      type: String,
      enum: ['monthly', 'annually', 'hourly'],
      default: 'annually'
    }
  },
  // Application Details
  applicationDate: {
    type: Date,
    default: Date.now
  },
  applicationMethod: {
    type: String,
    enum: ['company_website', 'linkedin', 'naukri', 'indeed', 'referral', 'email', 'walk_in', 'other'],
    default: 'company_website'
  },
  // Current Status
  status: {
    type: String,
    enum: [
      'applied',
      'screening',
      'screening_failed',
      'assessment_scheduled',
      'interview_scheduled',
      'interview_completed',
      'on_hold',
      'offer_received',
      'offer_accepted',
      'offer_declined',
      'rejected',
      'withdrawn'
    ],
    default: 'applied'
  },
  // Interview rounds (if any)
  interviewRounds: [{
    roundNumber: Number,
    type: {
      type: String,
      enum: ['phone_screening', 'assessment', 'technical', 'hr', 'managerial', 'group_discussion', 'coding', 'other']
    },
    scheduledDate: Date,
    status: {
      type: String,
      enum: ['scheduled', 'completed', 'cancelled', 'cleared', 'not_cleared', 'rescheduled'],
      default: 'scheduled'
    },
    feedback: String
  }],
  // Offer details (if received)
  offer: {
    salary: {
      amount: Number,
      currency: { type: String, default: 'INR' },
      frequency: { type: String, enum: ['monthly', 'annually'], default: 'annually' }
    },
    joiningDate: Date,
    position: String,
    location: String,
    offerLetterUrl: String,
    responseDeadline: Date
  },
  // Status history with user tracking
  statusHistory: [{
    status: String,
    changedAt: {
      type: Date,
      default: Date.now
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    notes: String
  }],
  // Notes and additional info
  notes: String,
  // Proof documents
  documents: [{
    name: String,
    url: String,
    type: {
      type: String,
      enum: ['job_description', 'application_acknowledgment', 'interview_invite', 'offer_letter', 'appointment_letter', 'screenshot', 'email', 'other']
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // PoC verification
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verifiedAt: Date,
  rejectionReason: String,
  verificationNotes: String,
  // Lead POC responsible for this specific follow-up
  assignedPoc: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // For tracking referrals
  referralDetails: {
    referredBy: String,
    referralType: { type: String, enum: ['employee', 'external', 'alumni', 'none'], default: 'none' },
    referrerContact: String
  },
  // Skills used/relevant for this application
  relevantSkills: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Skill'
  }],
  // Discord tracking
  discordThreadId: String,
  discordMessageId: String
}, {
  timestamps: true
});

// Indexes
selfApplicationSchema.index({ student: 1, createdAt: -1 });
selfApplicationSchema.index({ status: 1 });
selfApplicationSchema.index({ 'company.name': 'text', jobTitle: 'text' });

// Pre-save middleware to track status history
selfApplicationSchema.pre('save', function (next) {
  if (this.isModified('status')) {
    this.statusHistory.push({
      status: this.status,
      changedAt: new Date()
    });
  }
  next();
});

// Virtual for campus (from student)
selfApplicationSchema.virtual('campus', {
  ref: 'User',
  localField: 'student',
  foreignField: '_id',
  justOne: true
});

// Static method to get stats for a campus
selfApplicationSchema.statics.getCampusStats = async function (campusId) {
  const managedCampuses = Array.isArray(campusId) ? campusId : [campusId];

  const stats = await this.aggregate([
    {
      $lookup: {
        from: 'users',
        localField: 'student',
        foreignField: '_id',
        as: 'studentInfo'
      }
    },
    { $unwind: '$studentInfo' },
    {
      $match: {
        'studentInfo.campus': { $in: managedCampuses.map(id => new mongoose.Types.ObjectId(id)) }
      }
    },
    {
      $facet: {
        byStatus: [
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ],
        byVerification: [
          { $group: { _id: '$verificationStatus', count: { $sum: 1 } } }
        ]
      }
    }
  ]);

  const result = {
    total: 0,
    active: 0,
    offers: 0,
    placed: 0,
    unverified: 0
  };

  if (stats.length > 0) {
    const data = stats[0];

    data.byStatus.forEach(item => {
      result.total += item.count;

      if (['offer_received', 'offer_accepted', 'offer_declined'].includes(item._id)) {
        result.offers += item.count;
      }

      if (item._id === 'offer_accepted') {
        result.placed += item.count;
      }

      if (!['withdrawn', 'rejected', 'offer_accepted'].includes(item._id)) {
        result.active += item.count;
      }
    });

    data.byVerification.forEach(item => {
      if (item._id !== 'verified') {
        result.unverified += item.count;
      }
    });
  }

  return result;
};

module.exports = mongoose.model('SelfApplication', selfApplicationSchema);
