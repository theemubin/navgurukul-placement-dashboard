const mongoose = require('mongoose');

// Pipeline stage schema for job workflow
const pipelineStageSchema = new mongoose.Schema({
  id: { type: String, required: true }, // Unique identifier (slug)
  label: { type: String, required: true }, // Display name
  description: { type: String, default: '' },
  color: { type: String, default: 'gray' }, // Color theme: gray, yellow, green, orange, blue, red, purple, pink, indigo
  order: { type: Number, required: true }, // Position in pipeline
  isDefault: { type: Boolean, default: false }, // System default stages can't be deleted
  visibleToStudents: { type: Boolean, default: true }, // Whether students can see jobs in this stage
  studentLabel: { type: String, default: '' } // Friendly label for students (optional)
}, { _id: false });

// Single document schema that holds all configurable settings
const settingsSchema = new mongoose.Schema({
  // Map of school name to array of modules
  schoolModules: {
    type: Map,
    of: [String],
    default: new Map()
  },
  // Available placement role preferences
  rolePreferences: {
    type: [String],
    default: []
  },
  // Technical skills for self-assessment
  technicalSkills: {
    type: [String],
    default: []
  },
  // Degree options
  degreeOptions: {
    type: [String],
    default: []
  },
  // Soft skills options
  softSkills: {
    type: [String],
    default: []
  },
  // Role Categories for job postings
  roleCategories: {
    type: [String],
    default: []
  },
  // Council Posts
  councilPosts: {
    type: [String],
    default: ['General Secretary', 'Technical Secretary', 'Cultural Secretary', 'Sports Secretary', 'Health Secretary', 'Mess Secretary', 'Maintenance Secretary', 'Discipline Secretary', 'Academic Secretary', 'Placement Coordinator']
  },
  // Course skills (user-added skills from courses - available to all)
  courseSkills: {
    type: [String],
    default: []
  },
  // Course providers
  courseProviders: {
    type: [String],
    default: ['Navgurukul', 'Coursera', 'Udemy', 'LinkedIn Learning', 'YouTube', 'Other']
  },
  higherEducationOptions: {
    type: Map,
    of: [String],
    default: new Map()
  },
  // Institution options (Educational institutes: Name -> Pincode)
  institutionOptions: {
    type: Map,
    of: String,
    default: new Map()
  },
  // Inactive schools (manager can toggle)
  inactiveSchools: {
    type: [String],
    default: []
  },
  // Job pipeline stages (customizable workflow)
  jobPipelineStages: {
    type: [pipelineStageSchema],
    default: []
  },
  // Master list of companies
  masterCompanies: {
    type: Map,
    of: {
      name: String,
      website: String,
      description: String,
      logo: String, // Favicon/Logo URL
      pocs: [{
        name: String,
        role: String,
        contact: String,
        email: String,
        isPrimary: { type: Boolean, default: false }
      }],
      addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    },
    default: new Map()
  },
  // Dynamic job locations
  jobLocations: {
    type: [String],
    default: ['Bangalore', 'Pune', 'New Delhi', 'Mumbai', 'Hyderabad', 'Remote']
  },
  // Skill proficiency descriptions (Levels 1-4)
  proficiencyRubrics: {
    type: Map,
    of: {
      label: String,
      description: String
    },
    default: new Map()
  },
  // AI Integration Settings
  aiConfig: {
    googleApiKeys: [{
      key: { type: String, required: true },
      label: { type: String, default: '' }, // Optional label like "Primary", "Backup", etc.
      addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      addedAt: { type: Date, default: Date.now },
      lastUsed: { type: Date },
      isActive: { type: Boolean, default: true }
    }],
    enabled: { type: Boolean, default: true }
  },
  // Discord Integration Settings
  discordConfig: {
    enabled: { type: Boolean, default: false },
    botToken: { type: String, default: '' },
    guildId: { type: String, default: '' },      // Server ID
    channels: {
      jobPostings: { type: String, default: '' },           // Channel ID for new jobs
      applicationUpdates: { type: String, default: '' },    // Channel ID for app updates
      profileUpdates: { type: String, default: '' },        // Channel ID for profile changes
      general: { type: String, default: '' }                // General notifications
    },
    useThreads: { type: Boolean, default: true },   // Create threads for each job/student
    mentionUsers: { type: Boolean, default: true }, // @mention users in notifications
    testMode: { type: Boolean, default: false }     // Test mode (don't send actual notifications)
  },
  // Hiring Partners logos for public showcase
  hiringPartners: [{
    name: { type: String, required: true },
    logo: { type: String, required: true }
  }],
  // Testimonials for public showcase
  testimonials: [{
    companyName: { type: String, required: true },
    companyLogo: { type: String },
    authorName: { type: String, required: true },
    authorRole: { type: String, required: true },
    quote: { type: String, required: true },
    isActive: { type: Boolean, default: true }
  }],
  // Last updated by
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Default pipeline stages
const DEFAULT_PIPELINE_STAGES = [
  { id: 'draft', label: 'Draft', description: 'Jobs being prepared', color: 'gray', order: 0, isDefault: true, visibleToStudents: false, studentLabel: '' },
  { id: 'pending_approval', label: 'Pending Approval', description: 'Awaiting manager approval', color: 'yellow', order: 1, isDefault: true, visibleToStudents: false, studentLabel: '' },
  { id: 'application_stage', label: 'Application Stage', description: 'Open for applications', color: 'green', order: 2, isDefault: true, visibleToStudents: true, studentLabel: 'Now Hiring' },
  { id: 'hr_shortlisting', label: 'HR Shortlisting', description: 'Reviewing applications', color: 'indigo', order: 3, isDefault: true, visibleToStudents: true, studentLabel: 'Shortlisting' },
  { id: 'interviewing', label: 'Interviewing', description: 'Interview process ongoing', color: 'blue', order: 4, isDefault: true, visibleToStudents: true, studentLabel: 'Interviews Ongoing' },
  { id: 'on_hold', label: 'On Hold', description: 'Temporarily paused', color: 'orange', order: 5, isDefault: false, visibleToStudents: true, studentLabel: 'Applications Paused' },
  { id: 'closed', label: 'Closed', description: 'No longer accepting applications', color: 'red', order: 6, isDefault: true, visibleToStudents: true, studentLabel: 'Closed' },
  { id: 'filled', label: 'Filled', description: 'Position(s) filled', color: 'purple', order: 7, isDefault: true, visibleToStudents: true, studentLabel: 'Position Filled' }
];

// Default School Modules
const DEFAULT_SCHOOL_MODULES = new Map([
  ['School of Programming', []],
  ['School of Business', []],
  ['School of Second Chance', []],
  ['School of Finance', []],
  ['School of Education', []],
  ['School of Design', ['Graphic Design', 'UI/UX Design', 'Product Design', 'Motion Graphics']]
]);

// Default Higher Education Options (Department -> Specializations)
const DEFAULT_HIGHER_EDUCATION_OPTIONS = new Map([
  ['Engineering', ['Computer Science & Engineering', 'Information Technology', 'Electronics & Communication', 'Mechanical Engineering', 'Civil Engineering', 'Electrical Engineering']],
  ['Computer Applications', ['BCA', 'MCA', 'B.Sc IT']],
  ['Management', ['BBA', 'MBA', 'Marketing', 'Finance', 'Human Resources', 'Operations']],
  ['Science', ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'Biotechnology']],
  ['Commerce', ['Accounting', 'Finance', 'Banking', 'Economics']],
  ['Arts & Humanities', ['English', 'History', 'Psychology', 'Sociology', 'Political Science']],
  ['Other', ['Generic']]
]);

// Default Institution Options (Name -> Pincode)
const DEFAULT_INSTITUTION_OPTIONS = new Map([
  ['IIT Delhi', '110016'],
  ['IIT Bombay', '400076'],
  ['IIT Kanpur', '208016'],
  ['IIT Madras', '600036'],
  ['IIT Kharagpur', '721302'],
  ['IIT Roorkee', '247667'],
  ['IIT Guwahati', '781039'],
  ['NIT Trichy', '620015'],
  ['NIT Karnataka', '575025'],
  ['NIT Rourkela', '769008'],
  ['NIT Warangal', '506004'],
  ['NIT Calicut', '673601'],
  ['BITS Pilani', '333031'],
  ['BITS Goa', '403726'],
  ['BITS Hyderabad', '500078'],
  ['IISc Bangalore', '560012'],
  ['JNU Delhi', '110067'],
  ['Delhi University', '110007'],
  ['Mumbai University', '400032'],
  ['Anna University', '600025'],
  ['Amity University', '201313'],
  ['Lovely Professional University', '144411'],
  ['Chandigarh University', '140413'],
  ['Indira Gandhi National Open University (IGNOU)', '110068'],
  ['Other', '']
]);

// Default Role Categories
const DEFAULT_ROLE_CATEGORIES = [
  'Backend Developer',
  'Counselling',
  'Customer Success',
  'Customer Support',
  'Data Analytics',
  'Database Management',
  'Design',
  'Fellowship',
  'Frontend Developer',
  'Full Stack Developer',
  'Marketing',
  'Operations',
  'Program Management',
  'Sales',
  'Software Developer',
  'Teaching'
];

// Default Proficiency Rubrics
const DEFAULT_PROFICIENCY_RUBRICS = new Map([
  ['1', { label: 'Basic', description: 'Has basic theoretical knowledge and can perform simple tasks with guidance.' }],
  ['2', { label: 'Intermediate', description: 'Can work independently on routine tasks and understands core principles.' }],
  ['3', { label: 'Advanced', description: 'Can handle complex problems, optimize workflows, and guide others.' }],
  ['4', { label: 'Expert', description: 'Deep mastery of the subject with ability to architect systems and lead strategy.' }]
]);

// Default Job Locations
const DEFAULT_JOB_LOCATIONS = ['Bangalore', 'Pune', 'New Delhi', 'Mumbai', 'Hyderabad', 'Remote'];

// Ensure only one settings document exists
settingsSchema.statics.getSettings = async function () {
  try {
    let settings = await this.findOne();
    if (!settings) {
      settings = await this.create({
        schoolModules: DEFAULT_SCHOOL_MODULES,
        rolePreferences: [],
        technicalSkills: [],
        degreeOptions: [],
        softSkills: [],
        jobPipelineStages: DEFAULT_PIPELINE_STAGES,
        inactiveSchools: [],
        higherEducationOptions: DEFAULT_HIGHER_EDUCATION_OPTIONS,
        institutionOptions: DEFAULT_INSTITUTION_OPTIONS,
        roleCategories: DEFAULT_ROLE_CATEGORIES
      });
    }

    // Ensure role categories exist (for existing databases)
    if (!settings.roleCategories || settings.roleCategories.length === 0) {
      settings.roleCategories = DEFAULT_ROLE_CATEGORIES;
      await settings.save();
    }

    // Ensure pipeline stages exist (for existing databases)
    if (!settings.jobPipelineStages || settings.jobPipelineStages.length === 0) {
      settings.jobPipelineStages = DEFAULT_PIPELINE_STAGES;
      await settings.save();
    }

    // Ensure all standard schools exist and migrate legacy names
    let schoolsChanged = false;

    // Ensure schoolModules is a Map (handles cases where Mongoose returns a plain object)
    if (!settings.schoolModules || typeof settings.schoolModules.has !== 'function') {
      console.log('Warning: settings.schoolModules is not a Map. Converting...');
      const source = settings.schoolModules && typeof settings.schoolModules === 'object' ? settings.schoolModules : {};
      const entries = (source instanceof Map) ? source : Object.entries(source);
      settings.schoolModules = new Map(entries.length > 0 ? entries : DEFAULT_SCHOOL_MODULES);
      schoolsChanged = true;
    }

    // Migration: Merge "School Of ..." into "School of ..." to fix duplicates
    const schoolMerges = [
      { from: 'School Of Programming', to: 'School of Programming' },
      { from: 'School Of Business', to: 'School of Business' },
      { from: 'School Of Finance', to: 'School of Finance' },
      { from: 'School Of Education', to: 'School of Education' },
      { from: 'School Of Second Chance', to: 'School of Second Chance' }
    ];

    for (const merge of schoolMerges) {
      if (settings.schoolModules && settings.schoolModules.has(merge.from)) {
        const existingModules = settings.schoolModules.get(merge.from) || [];
        const targetModules = settings.schoolModules.get(merge.to) || [];
        // Merge unique modules
        const merged = [...new Set([...targetModules, ...existingModules])];

        settings.schoolModules.set(merge.to, merged);
        settings.schoolModules.delete(merge.from);
        schoolsChanged = true;
        console.log(`Migrated school: ${merge.from} -> ${merge.to}`);

        // Update student profiles using the old name
        try {
          const User = mongoose.model('User');
          await User.updateMany(
            { 'studentProfile.currentSchool': merge.from },
            { $set: { 'studentProfile.currentSchool': merge.to } }
          );
        } catch (err) {
          console.error(`Error migrating Users for ${merge.from}:`, err.message);
        }
      }
    }

    // Ensure all standard schools exist
    console.log('Ensuring default schools exist...');
    for (const [school, modules] of DEFAULT_SCHOOL_MODULES) {
      if (!settings.schoolModules.has(school)) {
        settings.schoolModules.set(school, modules);
        schoolsChanged = true;
        console.log(`Added missing default school: ${school}`);
      }
    }

    // Ensure higherEducationOptions is a Map
    if (!settings.higherEducationOptions || typeof settings.higherEducationOptions.has !== 'function') {
      console.log('Warning: settings.higherEducationOptions is not a Map. Initializing...');
      const source = settings.higherEducationOptions && typeof settings.higherEducationOptions === 'object' ? settings.higherEducationOptions : {};
      const entries = (source instanceof Map) ? source : Object.entries(source);
      settings.higherEducationOptions = new Map(entries.length > 0 ? entries : DEFAULT_HIGHER_EDUCATION_OPTIONS);
      schoolsChanged = true;
    }

    // Ensure institutionOptions is a Map and initialized
    if (!settings.institutionOptions || typeof settings.institutionOptions.has !== 'function') {
      console.log('Warning: settings.institutionOptions is not a Map. Initializing...');
      const source = settings.institutionOptions || [];
      const newMap = new Map();
      if (Array.isArray(source)) {
        // Migrate from [String] to Map<String, String>
        source.forEach(inst => {
          if (typeof inst === 'string') {
            newMap.set(inst, '');
          }
        });
      } else if (typeof source === 'object') {
        Object.entries(source).forEach(([k, v]) => newMap.set(k, v));
      }

      // Merge with defaults to populate missing pincodes
      const defaults = DEFAULT_INSTITUTION_OPTIONS;
      defaults.forEach((pin, name) => {
        if (!newMap.has(name)) {
          newMap.set(name, pin);
        } else if (!newMap.get(name)) {
          newMap.set(name, pin);
        }
      });

      settings.institutionOptions = newMap;
      schoolsChanged = true;
    }

    // Ensure proficiencyRubrics is a Map and initialized
    if (!settings.proficiencyRubrics || typeof settings.proficiencyRubrics.has !== 'function') {
      console.log('Warning: settings.proficiencyRubrics is not a Map. Initializing...');
      const source = settings.proficiencyRubrics && typeof settings.proficiencyRubrics === 'object' ? settings.proficiencyRubrics : {};
      const entries = (source instanceof Map) ? source : Object.entries(source);
      settings.proficiencyRubrics = new Map(entries.length > 0 ? entries : DEFAULT_PROFICIENCY_RUBRICS);
      schoolsChanged = true;
    } else if (settings.proficiencyRubrics.size === 0) {
      settings.proficiencyRubrics = DEFAULT_PROFICIENCY_RUBRICS;
      schoolsChanged = true;
    }

    // Ensure jobLocations exists
    if (!settings.jobLocations || settings.jobLocations.length === 0) {
      settings.jobLocations = DEFAULT_JOB_LOCATIONS;
      schoolsChanged = true;
    }

    // Ensure masterCompanies is initialized
    if (!settings.masterCompanies) {
      settings.masterCompanies = new Map();
      schoolsChanged = true;
    }

    if (schoolsChanged) {
      console.log('Saving settings changes...');
      await settings.save();
      console.log('Settings saved successfully.');
    }

    return settings;
  } catch (error) {
    console.error('CRITICAL: getSettings failed:', error);
    // Return findOne result as fallback to avoid crashing route
    return await this.findOne();
  }
};

// Get valid status IDs for validation
settingsSchema.statics.getValidStatuses = async function () {
  const settings = await this.getSettings();
  return settings.jobPipelineStages.map(stage => stage.id);
};

settingsSchema.statics.updateSettings = async function (updates, userId) {
  let settings = await this.findOne();
  if (!settings) {
    settings = new this();
  }

  if (updates.schoolModules) {
    // Convert object to Map if needed
    if (!(updates.schoolModules instanceof Map)) {
      settings.schoolModules = new Map(Object.entries(updates.schoolModules));
    } else {
      settings.schoolModules = updates.schoolModules;
    }
  }
  if (updates.rolePreferences) settings.rolePreferences = updates.rolePreferences;
  if (updates.technicalSkills) settings.technicalSkills = updates.technicalSkills;
  if (updates.degreeOptions) settings.degreeOptions = updates.degreeOptions;
  if (updates.softSkills) settings.softSkills = updates.softSkills;
  if (updates.inactiveSchools) settings.inactiveSchools = updates.inactiveSchools;
  if (updates.jobPipelineStages) settings.jobPipelineStages = updates.jobPipelineStages;
  if (updates.roleCategories) settings.roleCategories = updates.roleCategories;
  if (updates.discordConfig) settings.discordConfig = updates.discordConfig;
  if (updates.higherEducationOptions) {
    if (!(updates.higherEducationOptions instanceof Map)) {
      settings.higherEducationOptions = new Map(Object.entries(updates.higherEducationOptions));
    } else {
      settings.higherEducationOptions = updates.higherEducationOptions;
    }
  }
  if (updates.institutionOptions) {
    if (!(updates.institutionOptions instanceof Map)) {
      settings.institutionOptions = new Map(Object.entries(updates.institutionOptions));
    } else {
      settings.institutionOptions = updates.institutionOptions;
    }
  }
  if (updates.hiringPartners) settings.hiringPartners = updates.hiringPartners;
  if (updates.testimonials) settings.testimonials = updates.testimonials;
  if (userId) settings.lastUpdatedBy = userId;

  await settings.save();
  return settings;
};

// Add a new pipeline stage
settingsSchema.statics.addPipelineStage = async function (stage, userId) {
  const settings = await this.getSettings();

  // Generate ID from label if not provided
  if (!stage.id) {
    stage.id = stage.label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  }

  // Check for duplicate ID
  if (settings.jobPipelineStages.some(s => s.id === stage.id)) {
    throw new Error('Stage with this ID already exists');
  }

  // Set order to end if not specified
  if (stage.order === undefined) {
    stage.order = settings.jobPipelineStages.length;
  }

  settings.jobPipelineStages.push(stage);
  settings.jobPipelineStages.sort((a, b) => a.order - b.order);
  settings.lastUpdatedBy = userId;
  await settings.save();
  return settings;
};

// Update a pipeline stage
settingsSchema.statics.updatePipelineStage = async function (stageId, updates, userId) {
  const settings = await this.getSettings();
  const stageIndex = settings.jobPipelineStages.findIndex(s => s.id === stageId);

  if (stageIndex === -1) {
    throw new Error('Stage not found');
  }

  const stage = settings.jobPipelineStages[stageIndex];

  // Prevent changing ID of default stages
  if (stage.isDefault && updates.id && updates.id !== stage.id) {
    throw new Error('Cannot change ID of default stages');
  }

  // Update allowed fields
  if (updates.label) stage.label = updates.label;
  if (updates.description !== undefined) stage.description = updates.description;
  if (updates.color) stage.color = updates.color;
  if (updates.visibleToStudents !== undefined) stage.visibleToStudents = updates.visibleToStudents;
  if (updates.studentLabel !== undefined) stage.studentLabel = updates.studentLabel;

  settings.lastUpdatedBy = userId;
  await settings.save();
  return settings;
};

// Delete a pipeline stage
settingsSchema.statics.deletePipelineStage = async function (stageId, userId) {
  const settings = await this.getSettings();
  const stage = settings.jobPipelineStages.find(s => s.id === stageId);

  if (!stage) {
    throw new Error('Stage not found');
  }

  if (stage.isDefault) {
    throw new Error('Cannot delete default stages');
  }

  settings.jobPipelineStages = settings.jobPipelineStages.filter(s => s.id !== stageId);

  // Reorder remaining stages
  settings.jobPipelineStages.forEach((s, idx) => {
    s.order = idx;
  });

  settings.lastUpdatedBy = userId;
  await settings.save();
  return settings;
};

// Reorder pipeline stages
settingsSchema.statics.reorderPipelineStages = async function (stageIds, userId) {
  const settings = await this.getSettings();

  // Validate all IDs exist
  const existingIds = settings.jobPipelineStages.map(s => s.id);
  for (const id of stageIds) {
    if (!existingIds.includes(id)) {
      throw new Error(`Stage ${id} not found`);
    }
  }

  // Reorder based on the new order
  const reordered = stageIds.map((id, index) => {
    const stage = settings.jobPipelineStages.find(s => s.id === id);
    stage.order = index;
    return stage;
  });

  settings.jobPipelineStages = reordered;
  settings.lastUpdatedBy = userId;
  await settings.save();
  return settings;
};

const Settings = mongoose.model('Settings', settingsSchema);

module.exports = Settings;
