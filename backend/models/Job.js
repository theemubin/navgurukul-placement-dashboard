const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  company: {
    name: {
      type: String,
      required: true
    },
    logo: String,
    website: String,
    description: String
  },
  description: {
    type: String,
    required: true
  },
  requirements: [String],
  responsibilities: [String],
  location: {
    type: String,
    required: true
  },
  jobType: {
    type: String,
    enum: ['full_time', 'part_time', 'internship', 'contract'],
    default: 'full_time'
  },
  duration: {
    type: String, // e.g., "3 months", "6 months"
    default: null // Only for internships
  },
  salary: {
    min: Number,
    max: Number,
    currency: {
      type: String,
      default: 'INR'
    }
  },
  // Skills with proficiency levels (0-4: None, Beginner, Intermediate, Advanced, Expert)
  requiredSkills: [{
    skill: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Skill'
    },
    required: {
      type: Boolean,
      default: true
    },
    proficiencyLevel: {
      type: Number,
      min: 0,
      max: 4,
      default: 1 // Default: Beginner (any level acceptable)
    }
  }],
  // Custom requirements visible to students (yes/no selection)
  customRequirements: [{
    requirement: {
      type: String,
      required: true
    },
    isMandatory: {
      type: Boolean,
      default: true
    }
  }],
  eligibility: {
    // When all criteria fields are empty/null, the job is open for everyone
    openForAll: { type: Boolean, default: true }, // Explicit flag for open positions

    // Academic Requirements
    tenthGrade: {
      required: { type: Boolean, default: false },
      minPercentage: { type: Number, default: null }
    },
    twelfthGrade: {
      required: { type: Boolean, default: false },
      minPercentage: { type: Number, default: null }
    },
    higherEducation: {
      required: { type: Boolean, default: false },
      level: { type: String, enum: ['', 'bachelor', 'master', 'any'], default: '' },
      acceptedDegrees: {
        type: [String],
        default: [] // e.g., ['BA', 'BSc', 'BCom', 'BCA', 'BTech', 'Any Graduate']
      }
    },

    // Navgurukul Specific
    schools: { type: [String], default: [] }, // Navgurukul schools - empty means all schools
    campuses: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campus'
    }], // empty means all campuses eligible

    // Module hierarchy requirement (school-specific)
    minModule: {
      type: String,
      default: null
      // No enum constraint - modules vary by school
    },

    // Other Requirements
    certifications: { type: [String], default: [] }, // Required certifications

    // Council Post Eligibility
    councilPosts: [{
      post: String,
      minMonths: { type: Number, default: 0 }
    }],

    // English Proficiency (CEFR levels)
    englishWriting: { type: String, enum: ['', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'], default: '' },
    englishSpeaking: { type: String, enum: ['', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'], default: '' },

    // Shortlist Deadline - Students must complete profile before this
    shortlistDeadline: { type: Date, default: null },

    // Gender requirement (for female-only jobs)
    femaleOnly: { type: Boolean, default: false },

    // Minimum months at Navgurukul
    minMonthsAtNavgurukul: { type: Number, default: null },

    // Minimum attendance percentage
    minAttendance: { type: Number, default: null },

    // Job Readiness requirement
    readinessRequirement: {
      type: String,
      enum: ['yes', 'no', 'in_progress'],
      default: 'yes'
    },

    // Legacy fields for backward compatibility
    minCgpa: { type: Number, default: null }, // Deprecated - keeping for backward compatibility
    departments: { type: [String], default: [] },
    batches: { type: [String], default: [] }
  },
  applicationDeadline: {
    type: Date,
    required: true
  },
  maxPositions: {
    type: Number,
    default: 1
  },
  status: {
    type: String,
    default: 'draft'
    // Note: Validation against pipeline stages is done in routes
  },
  statusHistory: [{
    status: String,
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: String
  }],
  // Job Journey/Timeline - tracking all important events
  timeline: [{
    event: {
      type: String,
      enum: ['created', 'status_changed', 'deadline_extended', 'positions_updated', 'coordinator_assigned', 'custom']
    },
    description: String,
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changedAt: { type: Date, default: Date.now },
    metadata: mongoose.Schema.Types.Mixed // Additional data for the event
  }],
  // Expected next update date for applicants
  expectedUpdateDate: {
    type: Date,
    default: null
  },
  expectedUpdateNote: {
    type: String,
    default: ''
  },
  interviewRounds: [{
    name: String,
    type: {
      type: String,
      enum: ['aptitude', 'technical', 'hr', 'group_discussion', 'coding', 'other']
    },
    description: String,
    scheduledDate: Date
  }],
  // Job Coordinator (assigned to manage this job)
  coordinator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  placementsCount: {
    type: Number,
    default: 0
  },
  // FAQ/Questions for this job
  questions: [{
    question: { type: String, required: true },
    answer: { type: String, default: '' },
    askedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    answeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    askedAt: { type: Date, default: Date.now },
    answeredAt: Date,
    isPublic: { type: Boolean, default: true }
  }]
}, {
  timestamps: true
});

// Index for searching
jobSchema.index({ title: 'text', 'company.name': 'text', description: 'text' });

module.exports = mongoose.model('Job', jobSchema);
