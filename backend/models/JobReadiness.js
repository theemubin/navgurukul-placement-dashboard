const mongoose = require('mongoose');

// Predefined criteria items for Job Readiness
// These are used as defaults but can be configured per school/campus
const DEFAULT_CRITERIA = [
  {
    id: 'profile_complete',
    name: 'Profile Completed',
    description: 'All mandatory profile fields are filled',
    category: 'profile'
  },
  {
    id: 'resume_uploaded',
    name: 'Resume Uploaded',
    description: 'Latest resume is uploaded and approved',
    category: 'profile'
  },
  {
    id: 'english_b1',
    name: 'English B1 Level',
    description: 'English proficiency at least B1 (Speaking & Writing)',
    category: 'skills'
  },
  {
    id: 'interview_practice',
    name: 'Interview Practice Sessions',
    description: 'Completed minimum required mock interview sessions',
    category: 'preparation'
  },
  {
    id: 'dsa_problems',
    name: 'DSA Problems Solved',
    description: 'Solved minimum required DSA problems',
    category: 'technical'
  },
  {
    id: 'projects_completed',
    name: 'Projects Completed',
    description: 'Completed minimum required projects with documentation',
    category: 'technical'
  },
  {
    id: 'github_active',
    name: 'GitHub Profile Active',
    description: 'GitHub profile linked and has recent contributions',
    category: 'profile'
  },
  {
    id: 'soft_skills_assessment',
    name: 'Soft Skills Assessment',
    description: 'Completed soft skills assessment with minimum score',
    category: 'skills'
  },
  {
    id: 'attendance_requirement',
    name: 'Attendance Requirement',
    description: 'Meeting minimum attendance percentage',
    category: 'academic'
  }
];

// Schema for Job Readiness Configuration (per school/campus)
const jobReadinessConfigSchema = new mongoose.Schema({
  school: {
    type: String,
    required: true,
    enum: ['School of Programming', 'School of Business', 'School of Finance', 'School of Education', 'School of Second Chance']
  },
  campus: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campus',
    default: null // null means applies to all campuses for this school
  },
  criteria: [{
    criteriaId: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    description: String,
    type: {
      type: String,
      enum: ['answer', 'link', 'yes/no', 'comment'],
      default: 'answer'
    },
    pocCommentRequired: {
      type: Boolean,
      default: false
    },
    pocCommentTemplate: String, // Template for PoC comments
    pocRatingRequired: {
      type: Boolean,
      default: false
    },
    pocRatingScale: {
      type: Number,
      enum: [4],
      default: 4
    },
    link: String, // Optional link for the criterion
    category: {
      type: String,
      enum: ['profile', 'skills', 'technical', 'preparation', 'academic', 'other'],
      default: 'other'
    },
    isActive: {
      type: Boolean,
      default: true
    },
    isMandatory: {
      type: Boolean,
      default: true
    },
    // For criteria that need numeric thresholds
    numericTarget: {
      type: Number,
      default: null // e.g., minimum 50 DSA problems
    },
    // Weight for calculating readiness percentage
    weight: {
      type: Number,
      default: 1
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Compound index for school + campus uniqueness
jobReadinessConfigSchema.index({ school: 1, campus: 1 }, { unique: true });

// Schema for Student Job Readiness Status (tracking individual student progress)
const studentJobReadinessSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  school: {
    type: String,
    required: true
  },
  campus: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campus'
  },
  criteriaStatus: [{
    criteriaId: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['not_started', 'in_progress', 'completed', 'verified'],
      default: 'not_started'
    },
    // Student's self-reported value (for numeric criteria)
    selfReportedValue: Number,
    // Proof/evidence link if required
    proofUrl: String,
    // Verification by PoC
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    verifiedAt: Date,
    verificationNotes: String,
    // PoC Comments
    pocComment: String,
    pocCommentedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    pocCommentedAt: Date,
    // PoC Rating
    pocRating: Number,
    pocRatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    pocRatedAt: Date,
    completedAt: Date,
    updatedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Overall readiness percentage
  readinessPercentage: {
    type: Number,
    default: 0
  },
  // Job ready status
  isJobReady: {
    type: Boolean,
    default: false
  },
  // PoC approval for job ready status
  approvedAsJobReady: {
    type: Boolean,
    default: false
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  approvalNotes: String
}, {
  timestamps: true
});

// Index for quick lookups
studentJobReadinessSchema.index({ student: 1 }, { unique: true });
studentJobReadinessSchema.index({ campus: 1, school: 1 });
studentJobReadinessSchema.index({ isJobReady: 1 });

// Method to calculate readiness percentage
studentJobReadinessSchema.methods.calculateReadiness = async function() {
  const config = await JobReadinessConfig.findOne({
    school: this.school,
    $or: [{ campus: this.campus }, { campus: null }],
    isActive: true
  }).sort({ campus: -1 }); // Prefer campus-specific config

  if (!config || !config.criteria || config.criteria.length === 0) {
    this.readinessPercentage = 0;
    return 0;
  }

  const activeCriteria = config.criteria.filter(c => c.isActive);
  let totalWeight = 0;
  let achievedWeight = 0;

  for (const criterion of activeCriteria) {
    totalWeight += criterion.weight;
    const studentCriterion = this.criteriaStatus.find(
      s => s.criteriaId === criterion.criteriaId
    );
    
    if (studentCriterion && 
        (studentCriterion.status === 'completed' || studentCriterion.status === 'verified')) {
      achievedWeight += criterion.weight;
    }
  }

  this.readinessPercentage = totalWeight > 0 
    ? Math.round((achievedWeight / totalWeight) * 100) 
    : 0;
  
  // Auto-set job ready if all mandatory criteria are completed
  const mandatoryCriteria = activeCriteria.filter(c => c.isMandatory);
  this.isJobReady = mandatoryCriteria.every(mc => {
    const status = this.criteriaStatus.find(s => s.criteriaId === mc.criteriaId);
    return status && (status.status === 'completed' || status.status === 'verified');
  });

  return this.readinessPercentage;
};

const JobReadinessConfig = mongoose.model('JobReadinessConfig', jobReadinessConfigSchema);
const StudentJobReadiness = mongoose.model('StudentJobReadiness', studentJobReadinessSchema);

module.exports = {
  JobReadinessConfig,
  StudentJobReadiness,
  DEFAULT_CRITERIA
};
