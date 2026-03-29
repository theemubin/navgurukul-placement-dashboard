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
      // Password not required if using Google OAuth or if synced from external source as Google user
      return this.authProvider === 'local' && !this.googleId;
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
  // Role Change Request
  roleRequest: {
    role: { 
      type: String, 
      enum: ['student', 'campus_poc', 'coordinator', 'manager'] 
    },
    status: { 
      type: String, 
      enum: ['pending', 'approved', 'rejected'], 
      default: 'pending' 
    },
    requestedAt: Date,
    reason: String,
    reviewedAt: Date,
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
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
      enum: ['Active', 'In active', 'InActive', 'Long Leave', 'Dropout', 'DropOut', 'Placed', 'Intern (In Campus)', 'Intern (Out Campus)', 'Completed-Opted out for placement'],
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
      enum: ['', 'Bageshree House', 'Bhairav House', 'Malhar House', 'Bageshree', 'Bhairav', 'Malhar'],
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
    dateOfPlacement: Date, // Track date of placement from Ghar Zoho data
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
    resumeAts: {
      overallScore: { type: Number, min: 0, max: 100, default: null },
      qualityFlag: { type: String, enum: ['ok', 'low_text_extraction'], default: null },
      textLength: { type: Number, default: 0 },
      status: { type: String, enum: ['ok', 'failed'], default: null },
      sourceUrl: String,
      checkedAt: Date,
      errorMessage: String,
      atsSummary: String,
      nameMatch: {
        isMatch: { type: Boolean, default: null },
        confidence: { type: Number, min: 0, max: 100, default: 0 },
        matchedName: String,
        reason: String
      },
      breakdown: {
        keywordAlignment: { type: Number, min: 0, max: 30, default: 0 },
        skillsRelevance: { type: Number, min: 0, max: 20, default: 0 },
        projectImpact: { type: Number, min: 0, max: 20, default: 0 },
        structureReadability: { type: Number, min: 0, max: 15, default: 0 },
        experienceStrength: { type: Number, min: 0, max: 15, default: 0 }
      },
      strengths: [{ type: String }],
      gaps: [{ type: String }],
      actionItems: [{ type: String }]
    },
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
        currentStatus: { value: String, lastUpdated: Date },
        admissionDate: { value: Date, lastUpdated: Date },
        gender: { value: String, lastUpdated: Date },
        englishSpeaking: { value: String, lastUpdated: Date },
        englishWriting: { value: String, lastUpdated: Date },
        hometown: {
          value: {
            pincode: String,
            district: String,
            state: String,
            address: String
          },
          lastUpdated: Date
        },
        phone: { value: String, lastUpdated: Date },
        personalEmail: { value: String, lastUpdated: Date },
        aadharNo: { value: String, lastUpdated: Date },
        caste: { value: String, lastUpdated: Date },
        religion: { value: String, lastUpdated: Date },
        dob: { value: Date, lastUpdated: Date },
        qualification: { value: String, lastUpdated: Date },
        maritalStatus: { value: String, lastUpdated: Date },
        daysInCampus: { value: Number, lastUpdated: Date },
        admissionTestScore: { value: String, lastUpdated: Date },
        readTheoryLevel: { value: String, lastUpdated: Date },
        atCoderRating: { value: String, lastUpdated: Date },
        campus: { value: String, lastUpdated: Date },
        firstName: { value: String, lastUpdated: Date },
        lastName: { value: String, lastUpdated: Date },
        stdId: { value: String, lastUpdated: Date },
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
    englishSpeaking: ghar.englishSpeaking?.value || local.englishProficiency?.speaking || '',
    englishWriting: ghar.englishWriting?.value || local.englishProficiency?.writing || '',
    hometown: ghar.hometown?.value || local.hometown || null,
    phone: ghar.phone?.value || this.phone || '',
    personalEmail: ghar.personalEmail?.value || local.personalEmail || '',
    aadharNo: ghar.aadharNo?.value || '',
    qualification: ghar.qualification?.value || '',
    caste: ghar.caste?.value || '',
    religion: ghar.religion?.value || '',
    maritalStatus: ghar.maritalStatus?.value || '',
    dob: ghar.dob?.value || null,
    dateOfPlacement: ghar.dateOfPlacement?.value || local.dateOfPlacement || null,
    readTheoryLevel: ghar.readTheoryLevel?.value || '',
    atCoderRating: ghar.atCoderRating?.value || '',
    campus: ghar.campus?.value || '',
    firstName: ghar.firstName?.value || this.firstName || '',
    lastName: ghar.lastName?.value || this.lastName || '',
    stdId: ghar.stdId?.value || '',
    // Flags for frontend to know which fields are verified
    isSchoolVerified: !!ghar.currentSchool?.value,
    isJoiningDateVerified: !!ghar.admissionDate?.value,
    isModuleVerified: !!ghar.currentModule?.value,
    isAttendanceVerified: !!ghar.attendancePercentage?.value,
    isStatusVerified: !!ghar.currentStatus?.value,
    isGenderVerified: !!ghar.gender?.value,
    isEnglishVerified: !!(ghar.englishSpeaking?.value || ghar.englishWriting?.value),
    isHometownVerified: !!ghar.hometown?.value,
    isPhoneVerified: !!ghar.phone?.value,
    isNameVerified: !!(ghar.firstName?.value || ghar.lastName?.value),
    isCampusVerified: !!ghar.campus?.value
  };
});

userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

  /**
   * Static method to sync Ghar data for a user
   * @param {string} email - Student email
   * @param {Object} externalData - Raw data from Ghar API
   * @param {Object} options - Sync options (e.g., createIfNotFound)
   */
  userSchema.statics.syncGharData = async function (email, externalData, options = {}) {
    if (!externalData) return null;
    if (!email) return null;
    
    const normalizedEmail = email.trim().toLowerCase();
    let user = await this.findOne({ email: normalizedEmail, role: 'student' });
  
    if (!user && options.createIfNotFound) {
      console.log(`[GharSync] Creating new student user for ${normalizedEmail}`);
      
      // Robust Name parsing (handle both object and string from different Zoho reports)
      let resolvedFirstName = 'Student';
      let resolvedLastName = 'User';
      
      if (externalData.Name && typeof externalData.Name === 'object') {
        resolvedFirstName = externalData.Name.first_name || resolvedFirstName;
        resolvedLastName = externalData.Name.last_name || resolvedLastName;
      } else if (typeof externalData.Name === 'string') {
        const parts = externalData.Name.split(' ');
        resolvedFirstName = parts[0];
        resolvedLastName = parts.slice(1).join(' ') || 'User';
      } else if (externalData.Student_Name) {
        const parts = String(externalData.Student_Name).split(' ');
        resolvedFirstName = parts[0];
        resolvedLastName = parts.slice(1).join(' ') || 'User';
      }

      user = new this({
        email: normalizedEmail,
        role: 'student',
        isActive: true, // Mark as active to ensure they appear in "Active" counts as requested
        firstName: resolvedFirstName,
        lastName: resolvedLastName,
        authProvider: 'google',
        studentProfile: {
          profileStatus: 'draft',
          externalData: { ghar: {} }
        }
      });
    }
  
    if (!user) return null;

    if (!user.studentProfile) user.studentProfile = { profileStatus: 'draft', externalData: { ghar: {} } };
    if (!user.studentProfile.externalData) user.studentProfile.externalData = { ghar: {} };
    if (!user.studentProfile.externalData.ghar) user.studentProfile.externalData.ghar = {};

    const now = new Date();
    const gharData = user.studentProfile.externalData.ghar;

    /**
     * MAPPING LOGIC (Deduplicated & Robust)
     */
    
    // 1. Identifiers
    const gharId = externalData.Student_ID1 || externalData.ID;
    if (gharId) gharData.stdId = { value: gharId.toString(), lastUpdated: now };

    // 2. Status & Academic
    const statusValue = externalData.Status || externalData.Academic_Status || externalData.Student_Status;
    if (statusValue) {
      const trimmedStatus = statusValue.toString().trim();
      gharData.currentStatus = { value: trimmedStatus, lastUpdated: now };
      
      const knownStatuses = [
        'Active', 'Placed', 'Intern (In Campus)', 'Intern (Out Campus)', 
        'Dropout', 'DropOut', 'InActive', 'Completed-Opted out for placement'
      ];
      
      const matchedStatus = knownStatuses.find(s => s.toLowerCase() === trimmedStatus.toLowerCase()) || 
                            knownStatuses.find(s => trimmedStatus.includes(s));

      if (matchedStatus) {
        user.studentProfile.currentStatus = matchedStatus;
        // Request: Ensure user is marked as Active if Zoho status is Active
        if (matchedStatus.toLowerCase() === 'active') {
          user.isActive = true;
        }
      }
    }

    // 3. Dates
    const joinDateValue = externalData.Joining_Date || externalData.Admission_Date || externalData.Date_of_Joining;
    if (joinDateValue) {
       const jd = new Date(joinDateValue);
       if (!isNaN(jd.getTime())) gharData.joiningDate = { value: jd, lastUpdated: now };
    }

    const dobValue = externalData.Date_of_Birth || externalData.DOB;
    if (dobValue) {
      const dob = new Date(dobValue);
      if (!isNaN(dob.getTime())) gharData.dob = { value: dob, lastUpdated: now };
    }

    const placementDateValue = externalData.Placed_Date || externalData.Date_of_Placement || externalData.Placement_Date;
    if (placementDateValue) {
      const pd = new Date(placementDateValue);
      if (!isNaN(pd.getTime())) gharData.dateOfPlacement = { value: pd, lastUpdated: now };
    }

    // 4. Academic Metrics
    const moduleValue = externalData.Current_Module || externalData.Current_Module_Avg;
    if (moduleValue) gharData.currentModule = { value: moduleValue, lastUpdated: now };

    const attendanceValue = externalData.Attendance_Rate1 || externalData.Attendance_Rate || externalData.Attendance_Percentage;
    if (attendanceValue) {
      const rate = parseFloat(attendanceValue);
      if (!isNaN(rate)) gharData.attendancePercentage = { value: rate, lastUpdated: now };
    }

    // 5. General Info
    if (externalData.Gender) gharData.gender = { value: externalData.Gender, lastUpdated: now };
    if (externalData.Caste) gharData.caste = { value: externalData.Caste, lastUpdated: now };
    if (externalData.Religion) gharData.religion = { value: externalData.Religion, lastUpdated: now };
    if (externalData.Qualification) gharData.qualification = { value: externalData.Qualification, lastUpdated: now };
    if (externalData.Marital_status) gharData.maritalStatus = { value: externalData.Marital_status, lastUpdated: now };
    if (externalData.Days_in_Campus) gharData.daysInCampus = { value: parseInt(externalData.Days_in_Campus), lastUpdated: now };
    
    // 6. Contact & Personal
    const phoneValue = externalData.Phone_Number || externalData.Mobile || externalData.Mobile_Number;
    if (phoneValue) gharData.phone = { value: phoneValue, lastUpdated: now };
    
    if (externalData.Personal_Email) gharData.personalEmail = { value: externalData.Personal_Email, lastUpdated: now };
    if (externalData.Aadhar_No || externalData.Aadhar_Number) gharData.aadharNo = { value: externalData.Aadhar_No || externalData.Aadhar_Number, lastUpdated: now };
    
    // 7. Campus & School
    const campusValue = externalData.Select_Campus?.Campus_Name || externalData.Campus_Name || externalData.Campus;
    if (campusValue) {
      gharData.campus = { value: campusValue, lastUpdated: now };
      
      // Attempt to resolve top-level campus reference
      try {
        if (options.targetCampusId) {
          user.campus = options.targetCampusId;
        } else {
          const Campus = mongoose.model('Campus');
          const matchedCampus = await Campus.findOne({ name: new RegExp(`^${campusValue}$`, 'i') });
          if (matchedCampus) {
            user.campus = matchedCampus._id;
          }
        }
      } catch (e) {
        console.warn('[GharSync] Could not resolve campus reference for:', campusValue);
      }
    }

    const schoolValue = externalData.Select_School1 || externalData.Current_School || externalData.School_Name;
    if (schoolValue) gharData.currentSchool = { value: schoolValue, lastUpdated: now };

    // 8. Hometown
    if (externalData.Address) {
      const state = externalData.Address.state_province || externalData.State;
      const district = externalData.Address.district_city || externalData.District;
      if (state || district) {
        gharData.hometown = {
          value: { state, district },
          lastUpdated: now
        };
      }
    }

    // 9. English & Coding
    if (externalData.Speak_Improve_Latest_Grade) gharData.englishSpeaking = { value: externalData.Speak_Improve_Latest_Grade, lastUpdated: now };
    if (externalData.Write_Improve_Latest_Grade) gharData.englishWriting = { value: externalData.Write_Improve_Latest_Grade, lastUpdated: now };
    if (externalData.AtCoder_Rating) gharData.atCoderRating = { value: externalData.AtCoder_Rating, lastUpdated: now };
    if (externalData.ReadTheory_Avg_Quize_Level) gharData.readTheoryLevel = { value: externalData.ReadTheory_Avg_Quize_Level, lastUpdated: now };

    gharData.lastSyncedAt = now;

    // Safely update extraAttributes Map
    if (externalData) {
      if (!user.studentProfile.externalData.ghar.extraAttributes || typeof user.studentProfile.externalData.ghar.extraAttributes.set !== 'function') {
        user.studentProfile.externalData.ghar.extraAttributes = new Map();
      }

      Object.keys(externalData).forEach(key => {
        const safeKey = key.replace(/\./g, '_');
        user.studentProfile.externalData.ghar.extraAttributes.set(safeKey, externalData[key]);
      });
      user.studentProfile.externalData.ghar.extraAttributes.set('syncTimestamp', now);
    }

    user.markModified('studentProfile.externalData');
    return await user.save();
  };

module.exports = mongoose.model('User', userSchema);
