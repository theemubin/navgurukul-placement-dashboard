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
    
    // Module hierarchy requirement (only for School of Programming)
    minModule: { 
      type: String, 
      default: null,
      enum: [null, 'Foundation', 'Basics of Programming', 'DSA', 'Backend', 'Full Stack', 'Interview Prep']
    },
    
    // Other Requirements
    minCgpa: { type: Number, default: null },
    certifications: { type: [String], default: [] }, // Required certifications
    
    // English Proficiency (CEFR levels)
    englishWriting: { type: String, enum: ['', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'], default: '' },
    englishSpeaking: { type: String, enum: ['', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'], default: '' },
    
    // Shortlist Deadline - Students must complete profile before this
    shortlistDeadline: { type: Date, default: null },
    
    // Legacy fields for backward compatibility
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
  interviewRounds: [{
    name: String,
    type: {
      type: String,
      enum: ['aptitude', 'technical', 'hr', 'group_discussion', 'coding', 'other']
    },
    description: String,
    scheduledDate: Date
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  placementsCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for searching
jobSchema.index({ title: 'text', 'company.name': 'text', description: 'text' });

module.exports = mongoose.model('Job', jobSchema);
