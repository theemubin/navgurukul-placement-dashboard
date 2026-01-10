const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    enum: ['student', 'campus_poc', 'coordinator', 'manager'],
    default: 'student'
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  gender: {
    type: String,
    enum: ['', 'male', 'female', 'other'],
    default: ''
  },
  campus: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campus'
  },
  avatar: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  // Placement cycle assignment (for students)
  placementCycle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PlacementCycle'
  },
  placementCycleAssignedAt: Date,
  placementCycleAssignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Student-specific fields
  studentProfile: {
    // Profile approval status
    profileStatus: {
      type: String,
      enum: ['draft', 'pending_approval', 'approved', 'needs_revision'],
      default: 'draft'
    },
    revisionNotes: String,
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: Date,
    lastSubmittedAt: Date,
    
    // Current Navgurukul Education
    currentSchool: {
      type: String,
      enum: ['', 'School of Programming', 'School of Business', 'School of Finance', 'School of Education', 'School of Second Chance']
    },
    joiningDate: Date,
    dateOfJoining: Date, // Official joining date for calculating months at Navgurukul
    attendancePercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: null
    },
    currentModule: String, // For Programming/Business - selected from predefined list
    customModuleDescription: String, // For Finance/Education - free text
    
    // 10th Grade Details
    tenthGrade: {
      passingYear: Number,
      state: String,
      board: {
        type: String,
        enum: ['', 'State', 'CBSE', 'ICSE', 'Other']
      },
      percentage: Number
    },
    
    // 12th Grade Details
    twelfthGrade: {
      passingYear: Number,
      state: String,
      board: {
        type: String,
        enum: ['', 'State', 'CBSE', 'ICSE', 'Other']
      },
      percentage: Number
    },
    
    // Higher Education (can have multiple)
    higherEducation: [{
      degree: String,
      institution: String,
      fieldOfStudy: String,
      startYear: Number,
      endYear: Number,
      percentage: Number,
      isCompleted: {
        type: Boolean,
        default: false
      }
    }],
    
    // Courses completed
    courses: [{
      courseName: String,
      provider: String, // e.g., Coursera, Udemy, Navgurukul, etc.
      completionDate: Date,
      certificateUrl: String,
      skills: [String], // Skills learned from this course
      addedAt: {
        type: Date,
        default: Date.now
      }
    }],
    
    // Hometown with pincode-based location
    hometown: {
      pincode: String,
      village: String,
      district: String,
      state: String
    },
    
    // Open for roles (job preferences)
    openForRoles: [{
      type: String
    }],
    
    // Technical Skills with self-assessment rubric
    technicalSkills: [{
      skillName: String,
      selfRating: {
        type: Number,
        min: 0,
        max: 4
      },
      description: String,
      addedAt: {
        type: Date,
        default: Date.now
      }
    }],
    
    // English Proficiency (CEFR Levels)
    englishProficiency: {
      speaking: {
        type: String,
        enum: ['', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']
      },
      writing: {
        type: String,
        enum: ['', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']
      }
    },
    
    // Soft Skills with levels (0-4)
    softSkills: {
      communication: { type: Number, min: 0, max: 4, default: 0 },
      collaboration: { type: Number, min: 0, max: 4, default: 0 },
      creativity: { type: Number, min: 0, max: 4, default: 0 },
      criticalThinking: { type: Number, min: 0, max: 4, default: 0 },
      problemSolving: { type: Number, min: 0, max: 4, default: 0 },
      adaptability: { type: Number, min: 0, max: 4, default: 0 },
      timeManagement: { type: Number, min: 0, max: 4, default: 0 },
      leadership: { type: Number, min: 0, max: 4, default: 0 },
      teamwork: { type: Number, min: 0, max: 4, default: 0 },
      emotionalIntelligence: { type: Number, min: 0, max: 4, default: 0 }
    },
    
    // Legacy skills (for POC approval)
    skills: [{
      skill: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Skill'
      },
      status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
      },
      approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      approvedAt: Date
    }],
    
    resume: String,
    linkedIn: String,
    github: String,
    portfolio: String,
    about: String,
    expectedSalary: Number
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Get full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

userSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('User', userSchema);
