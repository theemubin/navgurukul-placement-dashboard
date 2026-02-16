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
    required: function () {
      return !this.googleId; // Password not required if using Google OAuth
    },
    minlength: 6
  },
  // Google OAuth fields
  googleId: {
    type: String,
    sparse: true // Allow multiple null values
  },
  authProvider: {
    type: String,
    enum: ['local', 'google'],
    default: 'local'
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
  // AI API Keys (for coordinators to add their own keys)
  aiApiKeys: [{
    key: { type: String, required: true },
    label: { type: String, default: '' },
    addedAt: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true }
  }],
  // User-specific export presets (max 2)
  exportPresets: [{
    name: String,
    fields: [String],
    format: { type: String, enum: ['csv', 'pdf'], default: 'pdf' },
    layout: { type: String, enum: ['resume', 'table'], default: 'resume' },
    createdAt: { type: Date, default: Date.now }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  // Campuses managed by this user (for Campus POCs)
  managedCampuses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campus'
  }],
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
  // Discord Integration
  discord: {
    userId: {
      type: String,
      default: '',
      trim: true
    },        // Discord User ID (e.g., "123456789012345678")
    username: {
      type: String,
      default: '',
      trim: true
    },      // Discord username for display (e.g., "username#1234")
    verified: {
      type: Boolean,
      default: false
    },  // Whether Discord ID is verified
    verifiedAt: {
      type: Date
    },
    lastNotificationSent: {
      type: Date
    }  // Track last notification for rate limiting
  },
  // Student-specific fields
  studentProfile: {
    // Profile approval status
    profileStatus: {
      type: String,
      enum: ['draft', 'pending_approval', 'approved', 'needs_revision'],
      default: 'draft'
    },
    currentStatus: {
      type: String,
      enum: ['Active', 'In active', 'Long Leave', 'Dropout', 'Placed'],
      default: 'Active'
    },
    isPaidProject: {
      type: Boolean,
      default: false
    },
    onInternship: {
      type: Boolean,
      default: false
    },
    internshipType: {
      type: String,
      enum: ['', 'Paid', 'Unpaid'],
      default: ''
    },
    revisionNotes: String,
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: Date,
    lastSubmittedAt: Date,

    // House Name (Navgurukul Specific)
    houseName: {
      type: String,
      enum: ['', 'Bageshree', 'Bhairav', 'Malhar'],
      default: ''
    },

    // Snapshot of the last approved profile for diffing
    lastApprovedSnapshot: {
      type: mongoose.Schema.Types.Mixed, // Stores the entire studentProfile object
      default: null
    },

    // Current Navgurukul Education
    currentSchool: {
      type: String,
      trim: true,
      default: ''
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
      institution: String,
      department: String,
      specialization: String,
      degree: String,
      fieldOfStudy: String, // Keeping for legacy/compatibility
      pincode: String,
      district: String,
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
      skillId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Skill'
      },
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

    // English Proficiency (CEFR Levels) - legacy, kept for backward compatibility
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

    // Multi-language proficiency with CEFR levels
    languages: [{
      language: {
        type: String,
        required: true,
        trim: true
      },
      speaking: {
        type: String,
        enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
        required: true
      },
      writing: {
        type: String,
        enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
        required: true
      },
      reading: {
        type: String,
        enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
      },
      listening: {
        type: String,
        enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
      },
      isNative: {
        type: Boolean,
        default: false
      }
    }],

    // Soft Skills with self-assessment (now using Skill model)
    softSkills: [{
      skillId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Skill'
      },
      skillName: String,
      selfRating: {
        type: Number,
        min: 0,
        max: 4
      },
      addedAt: {
        type: Date,
        default: Date.now
      }
    }],

    // Office Skills with self-assessment (using Skill model)
    officeSkills: [{
      skillId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Skill'
      },
      skillName: String,
      selfRating: {
        type: Number,
        min: 0,
        max: 4
      },
      addedAt: {
        type: Date,
        default: Date.now
      }
    }],

    // Council Service
    councilService: [{
      post: { type: String, required: true },
      monthsServed: { type: Number, required: true, min: 0 },
      certificateUrl: String,
      status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
      },
      approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      approvedAt: Date,
      addedAt: { type: Date, default: Date.now }
    }],

    // Legacy skills (for POC approval)
    skills: [{
      skill: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Skill'
      },
      // Optional self-rating provided by student at add-time (1-4)
      selfRating: {
        type: Number,
        min: 0,
        max: 4,
        default: 0
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
    resumeLink: String,
    // Indicates whether the resume link was confirmed accessible when last checked
    resumeAccessible: { type: Boolean, default: null },
    // Free-text remark about accessibility or instructions (set by manager or system checks)
    resumeAccessibilityRemark: String,
    linkedIn: String,
    github: String,
    portfolio: String,
    about: String,
    expectedSalary: Number,
    // Add additive external data section
    externalData: {
      ghar: {
        attendancePercentage: { value: Number, lastUpdated: Date },
        currentSchool: { value: String, lastUpdated: Date },
        currentModule: { value: String, lastUpdated: Date },
        admissionDate: { value: Date, lastUpdated: Date },
        gender: { value: String, lastUpdated: Date },
        lastSyncedAt: { type: Date },
        extraAttributes: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} }
      },
      // Placeholder for other platforms
      zoho: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
      other: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} }
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Get full name
userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for prioritized profile data
// Returns prioritized values for keys that could come from Ghar or student
userSchema.virtual('resolvedProfile').get(function () {
  if (this.role !== 'student') return null;

  const ghar = this.studentProfile?.externalData?.ghar || {};
  const local = this.studentProfile || {};

  return {
    currentSchool: ghar.currentSchool?.value || local.currentSchool || '',
    joiningDate: ghar.admissionDate?.value || local.joiningDate || null,
    currentModule: ghar.currentModule?.value || local.currentModule || '',
    attendancePercentage: ghar.attendancePercentage?.value || local.attendancePercentage || null,
    currentStatus: ghar.currentStatus?.value || local.currentStatus || 'Active',
    gender: (ghar.gender?.value || this.gender || '').toLowerCase(),
    // Flags for frontend to know which fields are verified
    isSchoolVerified: !!ghar.currentSchool?.value,
    isJoiningDateVerified: !!ghar.admissionDate?.value,
    isModuleVerified: !!ghar.currentModule?.value,
    isAttendanceVerified: !!ghar.attendancePercentage?.value,
    isStatusVerified: !!ghar.currentStatus?.value,
    isGenderVerified: !!ghar.gender?.value
  };
});

userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

/**
 * Static method to sync Ghar data for a user
 * @param {string} email - Student email
 * @param {Object} externalData - Raw data from Ghar API
 */
userSchema.statics.syncGharData = async function (email, externalData) {
  if (!externalData) return null;

  const user = await this.findOne({ email, role: 'student' });
  if (!user) return null;

  if (!user.studentProfile.externalData) {
    user.studentProfile.externalData = { ghar: {} };
  }
  if (!user.studentProfile.externalData.ghar) {
    user.studentProfile.externalData.ghar = {};
  }

  const now = new Date();
  const gharData = user.studentProfile.externalData.ghar;

  // Map fields with fallbacks for different API versions
  const schoolValue = externalData.Current_School || externalData.Select_School1 || externalData.Select_School;
  if (schoolValue) {
    gharData.currentSchool = { value: schoolValue, lastUpdated: now };
  }

  if (externalData.Joining_Date) {
    gharData.admissionDate = { value: new Date(externalData.Joining_Date), lastUpdated: now };
  }

  const statusValue = externalData.Academic_Status || externalData.Status;
  if (statusValue) {
    gharData.currentStatus = { value: statusValue, lastUpdated: now };
  }

  if (externalData.Gender) {
    gharData.gender = { value: externalData.Gender, lastUpdated: now };
  }

  const moduleValue = externalData.Current_Module || externalData.Current_Module_Avg;
  if (moduleValue) {
    gharData.currentModule = { value: moduleValue, lastUpdated: now };
  }

  const attendanceValue = externalData.Attendance_Rate || externalData.Attendance_Rate1;
  if (attendanceValue) {
    const rate = parseFloat(attendanceValue);
    if (!isNaN(rate)) {
      gharData.attendancePercentage = { value: rate, lastUpdated: now };
    }
  }

  gharData.lastSyncedAt = now;

  // Safely update Map
  if (externalData) {
    Object.keys(externalData).forEach(key => {
      user.studentProfile.externalData.ghar.extraAttributes.set(key, externalData[key]);
    });
    user.studentProfile.externalData.ghar.extraAttributes.set('syncTimestamp', now);
  }

  user.markModified('studentProfile.externalData');
  const savedUser = await user.save();
  console.log(`[GharSync] Successfully synced data for ${email}. Resolved school: ${externalData.Current_School || 'None'}`);
  return savedUser;
};

module.exports = mongoose.model('User', userSchema);
