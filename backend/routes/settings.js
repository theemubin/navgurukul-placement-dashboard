const express = require('express');
const router = express.Router();
const Settings = require('../models/Settings');
const { auth, authorize } = require('../middleware/auth');
const { resolveAIKeysForUser } = require('../utils/aiKeyResolver');

// Get all settings (public - for dropdowns and forms)
router.get('/', auth, async (req, res) => {
  try {
    const settings = await Settings.getSettings();

    // Convert Map to plain object for JSON response
    const response = {
      schoolModules: Object.fromEntries(settings.schoolModules || new Map()),
      schools: Object.keys(Object.fromEntries(settings.schoolModules || new Map())),
      rolePreferences: settings.rolePreferences || [],
      technicalSkills: settings.technicalSkills || [],
      degreeOptions: settings.degreeOptions || [],
      softSkills: settings.softSkills || [],
      inactiveSchools: settings.inactiveSchools || [],
      roleCategories: settings.roleCategories || [],
      councilPosts: settings.councilPosts || [],
      jobLocations: settings.jobLocations || [],
      proficiencyRubrics: Object.fromEntries(settings.proficiencyRubrics || new Map()),
      masterCompanies: Object.fromEntries(settings.masterCompanies || new Map()),
      institutionOptions: Object.fromEntries(settings.institutionOptions || new Map()),
      higherEducationOptions: Object.fromEntries(settings.higherEducationOptions || new Map()),
      // Include discord settings so UI can display and edit them
      discordConfig: settings.discordConfig || { enabled: false, channels: {} },
      hiringPartners: settings.hiringPartners || [],
      testimonials: settings.testimonials || []
    };

    res.json({ success: true, data: response });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update all settings (manager/coordinator only)
router.put('/', auth, authorize('manager', 'coordinator'), async (req, res) => {
  try {
    // Diagnostic logging to help debug accidental overwrites in production
    try {
      const payloadSummary = Object.keys(req.body).reduce((acc, key) => {
        const val = req.body[key];
        acc[key] = Array.isArray(val) ? `array(len=${val.length})` : (val && typeof val === 'object' ? 'object' : String(val));
        return acc;
      }, {});
      console.log('Update settings request by user:', req.userId, 'payloadSummary:', payloadSummary);
    } catch (e) {
      console.log('Failed to summarize settings payload', e && e.message);
    }

    const { schoolModules, rolePreferences, technicalSkills, degreeOptions, softSkills, inactiveSchools, institutionOptions, higherEducationOptions, roleCategories, discordConfig, hiringPartners, testimonials } = req.body;

    if (discordConfig) {
      // Avoid logging sensitive token value; only log presence and channel counts
      try {
        const channels = discordConfig.channels ? Object.keys(discordConfig.channels).length : 0;
        console.log('Saving discordConfig for user:', req.userId, 'enabled=', !!discordConfig.enabled, 'channels=', channels);
      } catch (e) {
        console.log('Error summarizing discordConfig', e && e.message);
      }
    }

    const settings = await Settings.updateSettings({
      schoolModules,
      rolePreferences,
      technicalSkills,
      degreeOptions,
      softSkills,
      inactiveSchools,
      institutionOptions,
      higherEducationOptions,
      roleCategories,
      discordConfig,
      hiringPartners,
      testimonials
    }, req.userId);

    // Log post-update snapshot for diagnostics (only keys and lengths to avoid leaking data)
    try {
      const snapshot = {
        schoolModules: settings.schoolModules ? Object.fromEntries(Object.entries(Object.fromEntries(settings.schoolModules)).map(([k, v]) => [k, `array(len=${(v || []).length})`])) : {},
        rolePreferencesLen: settings.rolePreferences ? settings.rolePreferences.length : 0,
        technicalSkillsLen: settings.technicalSkills ? settings.technicalSkills.length : 0,
        degreeOptionsLen: settings.degreeOptions ? settings.degreeOptions.length : 0,
        softSkillsLen: settings.softSkills ? settings.softSkills.length : 0,
        discordHasToken: !!(settings.discordConfig && settings.discordConfig.botToken),
        discordChannelsCount: settings.discordConfig && settings.discordConfig.channels ? Object.keys(settings.discordConfig.channels).length : 0
      };
      console.log('Post-update settings snapshot by user:', req.userId, snapshot);
    } catch (e) {
      console.log('Failed to snapshot settings after update', e && e.message);
    }

    // Convert Map to plain object for JSON response
    const response = {
      schoolModules: Object.fromEntries(settings.schoolModules || new Map()),
      rolePreferences: settings.rolePreferences || [],
      technicalSkills: settings.technicalSkills || [],
      degreeOptions: settings.degreeOptions || [],
      softSkills: settings.softSkills || [],
      inactiveSchools: settings.inactiveSchools || [],
      roleCategories: settings.roleCategories || [],
      institutionOptions: Object.fromEntries(settings.institutionOptions || new Map()),
      higherEducationOptions: Object.fromEntries(settings.higherEducationOptions || new Map()),
      // Include discordConfig so frontend sees updated values (botToken is sensitive but returned here for UX)
      discordConfig: settings.discordConfig || { enabled: false, channels: {} },
      hiringPartners: settings.hiringPartners || [],
      testimonials: settings.testimonials || []
    };

    res.json({
      success: true,
      message: 'Settings updated successfully',
      data: response
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Add module to a school (manager/coordinator only)
router.post('/schools/:school/modules', auth, authorize('manager', 'coordinator'), async (req, res) => {
  try {
    const { school } = req.params;
    const { module } = req.body;

    const settings = await Settings.getSettings();
    const modules = settings.schoolModules.get(school) || [];

    if (modules.includes(module)) {
      return res.status(400).json({ success: false, message: 'Module already exists' });
    }

    modules.push(module);
    settings.schoolModules.set(school, modules);
    settings.lastUpdatedBy = req.userId;
    await settings.save();

    res.json({
      success: true,
      message: 'Module added successfully',
      data: { school, modules }
    });
  } catch (error) {
    console.error('Add module error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Remove module from a school (manager/coordinator only)
router.delete('/schools/:school/modules/:module', auth, authorize('manager', 'coordinator'), async (req, res) => {
  try {
    const { school, module } = req.params;

    const settings = await Settings.getSettings();
    const modules = settings.schoolModules.get(school) || [];

    const index = modules.indexOf(decodeURIComponent(module));
    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Module not found' });
    }

    modules.splice(index, 1);
    settings.schoolModules.set(school, modules);
    settings.lastUpdatedBy = req.userId;
    await settings.save();

    res.json({
      success: true,
      message: 'Module removed successfully',
      data: { school, modules }
    });
  } catch (error) {
    console.error('Remove module error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Add role preference (manager/coordinator only)
router.post('/roles', auth, authorize('manager', 'coordinator'), async (req, res) => {
  try {
    const { role } = req.body;

    const settings = await Settings.getSettings();

    if (settings.rolePreferences.includes(role)) {
      return res.status(400).json({ success: false, message: 'Role already exists' });
    }

    settings.rolePreferences.push(role);
    settings.lastUpdatedBy = req.userId;
    await settings.save();

    res.json({
      success: true,
      message: 'Role added successfully',
      data: { rolePreferences: settings.rolePreferences }
    });
  } catch (error) {
    console.error('Add role error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Remove role preference (manager/coordinator only)
router.delete('/roles/:role', auth, authorize('manager', 'coordinator'), async (req, res) => {
  try {
    const { role } = req.params;

    const settings = await Settings.getSettings();
    const index = settings.rolePreferences.indexOf(decodeURIComponent(role));

    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    settings.rolePreferences.splice(index, 1);
    settings.lastUpdatedBy = req.userId;
    await settings.save();

    res.json({
      success: true,
      message: 'Role removed successfully',
      data: { rolePreferences: settings.rolePreferences }
    });
  } catch (error) {
    console.error('Remove role error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Add technical skill (manager/coordinator only)
router.post('/skills', auth, authorize('manager', 'coordinator'), async (req, res) => {
  try {
    const { skill } = req.body;

    const settings = await Settings.getSettings();

    if (settings.technicalSkills.includes(skill)) {
      return res.status(400).json({ success: false, message: 'Skill already exists' });
    }

    settings.technicalSkills.push(skill);
    settings.lastUpdatedBy = req.userId;
    await settings.save();

    res.json({
      success: true,
      message: 'Skill added successfully',
      data: { technicalSkills: settings.technicalSkills }
    });
  } catch (error) {
    console.error('Add skill error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Remove technical skill (manager/coordinator only)
router.delete('/skills/:skill', auth, authorize('manager', 'coordinator'), async (req, res) => {
  try {
    const { skill } = req.params;

    const settings = await Settings.getSettings();
    const index = settings.technicalSkills.indexOf(decodeURIComponent(skill));

    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Skill not found' });
    }

    settings.technicalSkills.splice(index, 1);
    settings.lastUpdatedBy = req.userId;
    await settings.save();

    res.json({
      success: true,
      message: 'Skill removed successfully',
      data: { technicalSkills: settings.technicalSkills }
    });
  } catch (error) {
    console.error('Remove skill error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Add a new school (coordinator/manager/campus_poc)
router.post('/schools', auth, authorize('manager', 'coordinator', 'campus_poc'), async (req, res) => {
  try {
    const { school } = req.body;
    const normalized = (school || '').trim();
    if (!normalized) {
      return res.status(400).json({ success: false, message: 'School name is required' });
    }

    const settings = await Settings.getSettings();
    const current = settings.schoolModules || new Map();
    if (current.has(normalized)) {
      return res.status(400).json({ success: false, message: 'School already exists' });
    }
    current.set(normalized, []);
    settings.schoolModules = current;
    settings.lastUpdatedBy = req.userId;
    await settings.save();
    res.json({ success: true, message: 'School added successfully', data: { schools: Array.from(current.keys()) } });
  } catch (error) {
    console.error('Add school error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Add course skill (any authenticated user can add - becomes available to all)
router.post('/course-skills', auth, async (req, res) => {
  try {
    const { skill } = req.body;

    if (!skill || typeof skill !== 'string' || skill.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid skill name' });
    }

    const settings = await Settings.getSettings();
    const normalizedSkill = skill.trim();

    // Check if skill already exists in courseSkills or technicalSkills
    const allSkills = [...(settings.courseSkills || []), ...(settings.technicalSkills || [])];
    if (allSkills.some(s => s.toLowerCase() === normalizedSkill.toLowerCase())) {
      return res.status(400).json({ success: false, message: 'Skill already exists' });
    }

    if (!settings.courseSkills) settings.courseSkills = [];
    settings.courseSkills.push(normalizedSkill);
    settings.lastUpdatedBy = req.userId;
    await settings.save();

    res.json({
      success: true,
      message: 'Course skill added successfully',
      data: {
        courseSkills: settings.courseSkills,
        allSkills: [...settings.technicalSkills, ...settings.courseSkills]
      }
    });
  } catch (error) {
    console.error('Add course skill error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==================== PIPELINE STAGES ROUTES ====================

// Get all pipeline stages (public for dropdowns)
router.get('/pipeline-stages', auth, async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    const stages = settings.jobPipelineStages.sort((a, b) => a.order - b.order);

    res.json({
      success: true,
      data: stages
    });
  } catch (error) {
    console.error('Get pipeline stages error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create a new pipeline stage (coordinator/manager only)
router.post('/pipeline-stages', auth, authorize('coordinator', 'manager'), async (req, res) => {
  try {
    const { id, label, description, color, order, visibleToStudents, studentLabel } = req.body;

    if (!label || label.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Stage label is required' });
    }

    const stage = {
      id: id || label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
      label: label.trim(),
      description: description || '',
      color: color || 'gray',
      order,
      isDefault: false,
      visibleToStudents: visibleToStudents !== false,
      studentLabel: studentLabel || ''
    };

    const settings = await Settings.addPipelineStage(stage, req.userId);

    res.json({
      success: true,
      message: 'Pipeline stage created successfully',
      data: settings.jobPipelineStages.sort((a, b) => a.order - b.order)
    });
  } catch (error) {
    console.error('Create pipeline stage error:', error);
    res.status(400).json({ success: false, message: error.message || 'Server error' });
  }
});

// Update a pipeline stage (coordinator/manager only)
router.put('/pipeline-stages/:stageId', auth, authorize('coordinator', 'manager'), async (req, res) => {
  try {
    const { stageId } = req.params;
    const { label, description, color, visibleToStudents, studentLabel } = req.body;

    const settings = await Settings.updatePipelineStage(stageId, {
      label,
      description,
      color,
      visibleToStudents,
      studentLabel
    }, req.userId);

    res.json({
      success: true,
      message: 'Pipeline stage updated successfully',
      data: settings.jobPipelineStages.sort((a, b) => a.order - b.order)
    });
  } catch (error) {
    console.error('Update pipeline stage error:', error);
    res.status(400).json({ success: false, message: error.message || 'Server error' });
  }
});

// Delete a pipeline stage (coordinator/manager only)
router.delete('/pipeline-stages/:stageId', auth, authorize('coordinator', 'manager'), async (req, res) => {
  try {
    const { stageId } = req.params;

    const settings = await Settings.deletePipelineStage(stageId, req.userId);

    res.json({
      success: true,
      message: 'Pipeline stage deleted successfully',
      data: settings.jobPipelineStages.sort((a, b) => a.order - b.order)
    });
  } catch (error) {
    console.error('Delete pipeline stage error:', error);
    res.status(400).json({ success: false, message: error.message || 'Server error' });
  }
});

// Reorder pipeline stages (coordinator/manager only)
router.put('/pipeline-stages-order', auth, authorize('coordinator', 'manager'), async (req, res) => {
  try {
    const { stageIds } = req.body;

    if (!Array.isArray(stageIds) || stageIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Stage IDs array is required' });
    }

    const settings = await Settings.reorderPipelineStages(stageIds, req.userId);

    res.json({
      success: true,
      message: 'Pipeline stages reordered successfully',
      data: settings.jobPipelineStages.sort((a, b) => a.order - b.order)
    });
  } catch (error) {
    console.error('Reorder pipeline stages error:', error);
    res.status(400).json({ success: false, message: error.message || 'Server error' });
  }
});

// Add council post (manager/coordinator only)
router.post('/council-posts', auth, authorize('manager', 'coordinator'), async (req, res) => {
  try {
    const { post } = req.body;

    if (!post || typeof post !== 'string' || post.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid post name' });
    }

    const settings = await Settings.getSettings();
    const normalizedPost = post.trim();

    if (settings.councilPosts.includes(normalizedPost)) {
      return res.status(400).json({ success: false, message: 'Post already exists' });
    }

    settings.councilPosts.push(normalizedPost);
    settings.lastUpdatedBy = req.userId;
    await settings.save();

    res.json({
      success: true,
      message: 'Council post added successfully',
      data: { councilPosts: settings.councilPosts }
    });
  } catch (error) {
    console.error('Add council post error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Add council post dynamically (Any authenticated user)
router.post('/council-posts/add', auth, async (req, res) => {
  try {
    const { post } = req.body;
    if (!post || !post.trim()) {
      return res.status(400).json({ success: false, message: 'Post name is required' });
    }

    const settings = await Settings.getSettings();
    const normalizedPost = post.trim();

    if (settings.councilPosts.includes(normalizedPost)) {
      return res.json({ success: true, message: 'Post already exists', data: { councilPosts: settings.councilPosts } });
    }

    settings.councilPosts.push(normalizedPost);
    settings.lastUpdatedBy = req.userId;
    await settings.save();

    res.json({
      success: true,
      message: 'Council post added successfully',
      data: { councilPosts: settings.councilPosts }
    });
  } catch (error) {
    console.error('Add council post dynamic error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Remove council post (manager/coordinator only)
router.delete('/council-posts/:post', auth, authorize('manager', 'coordinator'), async (req, res) => {
  try {
    const { post } = req.params;

    const settings = await Settings.getSettings();
    const index = settings.councilPosts.indexOf(decodeURIComponent(post));

    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    settings.councilPosts.splice(index, 1);
    settings.lastUpdatedBy = req.userId;
    await settings.save();

    res.json({
      success: true,
      message: 'Council post removed successfully',
      data: { councilPosts: settings.councilPosts }
    });
  } catch (error) {
    console.error('Remove council post error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get AI config (manager only)
router.get('/ai-config', auth, authorize('manager'), async (req, res) => {
  try {
    const settings = await Settings.getSettings();

    res.json({
      success: true,
      data: {
        hasApiKey: !!settings.aiConfig?.googleApiKey,
        enabled: settings.aiConfig?.enabled !== false,
        // Don't send the actual API key for security
        apiKeyPreview: settings.aiConfig?.googleApiKey
          ? `${settings.aiConfig.googleApiKey.substring(0, 8)}...${settings.aiConfig.googleApiKey.slice(-4)}`
          : null
      }
    });
  } catch (error) {
    console.error('Get AI config error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update AI config (manager only)
router.put('/ai-config', auth, authorize('manager'), async (req, res) => {
  try {
    const { googleApiKey, enabled } = req.body;

    const settings = await Settings.getSettings();

    if (!settings.aiConfig) {
      settings.aiConfig = {};
    }

    if (googleApiKey !== undefined) {
      settings.aiConfig.googleApiKey = googleApiKey;
    }

    if (enabled !== undefined) {
      settings.aiConfig.enabled = enabled;
    }

    settings.lastUpdatedBy = req.userId;
    await settings.save();

    res.json({
      success: true,
      message: 'AI configuration updated successfully',
      data: {
        hasApiKey: !!settings.aiConfig.googleApiKey,
        enabled: settings.aiConfig.enabled !== false,
        apiKeyPreview: settings.aiConfig.googleApiKey
          ? `${settings.aiConfig.googleApiKey.substring(0, 8)}...${settings.aiConfig.googleApiKey.slice(-4)}`
          : null
      }
    });
  } catch (error) {
    console.error('Update AI config error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get AI runtime status (manager only) - shows whether API key is valid and model accessible
router.get('/ai-status', auth, authorize('manager'), async (req, res) => {
  try {
    const AIService = require('../services/aiService');
    const { keys } = await resolveAIKeysForUser(req.userId);
    const ai = new AIService(keys);
    const status = await ai.getStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    console.error('Get AI status error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve AI status' });
  }
});

// Add higher education option (Department or Specialization)
router.post('/higher-education/add', auth, async (req, res) => {
  try {
    const { department, specialization } = req.body;

    if (!department || !department.trim()) {
      return res.status(400).json({ success: false, message: 'Department name is required' });
    }

    const settings = await Settings.getSettings();
    const currentOptions = settings.higherEducationOptions || new Map();

    const normalizedDept = department.trim();
    const existingSpecializations = currentOptions.get(normalizedDept) || [];

    if (specialization && specialization.trim()) {
      const normalizedSpec = specialization.trim();
      if (!existingSpecializations.includes(normalizedSpec)) {
        existingSpecializations.push(normalizedSpec);
        currentOptions.set(normalizedDept, existingSpecializations);
      }
    } else if (!currentOptions.has(normalizedDept)) {
      // If only department is provided and it doesn't exist, add it with empty spec list
      currentOptions.set(normalizedDept, []);
    }

    settings.higherEducationOptions = currentOptions;
    settings.lastUpdatedBy = req.userId;
    await settings.save();

    res.json({
      success: true,
      message: 'Education options updated successfully',
      data: Object.fromEntries(currentOptions)
    });
  } catch (error) {
    console.error('Add higher education option error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get education analytics (clubbed counts)
router.get('/analytics/education', auth, authorize('manager'), async (req, res) => {
  try {
    const User = require('../models/User');
    const users = await User.find({ role: 'student' }, 'higherEducation');

    const stats = {
      institutes: {},
      departments: {}
    };

    users.forEach(user => {
      (user.higherEducation || []).forEach(edu => {
        const inst = edu.institution?.trim();
        const dept = (edu.department || edu.fieldOfStudy)?.trim();

        if (inst) {
          stats.institutes[inst] = (stats.institutes[inst] || 0) + 1;
        }
        if (dept) {
          stats.departments[dept] = (stats.departments[dept] || 0) + 1;
        }
      });
    });

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Education stats error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Rename education item globally
router.post('/education/rename', auth, authorize('manager'), async (req, res) => {
  try {
    const { type, oldName, newName } = req.body;
    if (!oldName || !newName || oldName === newName) {
      return res.status(400).json({ success: false, message: 'Valid old and new names required' });
    }

    const User = require('../models/User');
    const settings = await Settings.getSettings();
    let settingsChanged = false;

    if (type === 'institution') {
      const insts = settings.institutionOptions || new Map();
      if (insts.has(oldName)) {
        const pincode = insts.get(oldName);
        insts.set(newName, pincode);
        insts.delete(oldName);
        settings.institutionOptions = insts;
        settingsChanged = true;
      }
      // Update all users who have this institution
      await User.updateMany(
        { 'higherEducation.institution': oldName },
        { $set: { 'higherEducation.$[elem].institution': newName } },
        { arrayFilters: [{ 'elem.institution': oldName }] }
      );
    } else if (type === 'department') {
      const opts = settings.higherEducationOptions || new Map();
      if (opts.has(oldName)) {
        const specs = opts.get(oldName);
        opts.set(newName, specs);
        opts.delete(oldName);
        settings.higherEducationOptions = opts;
        settingsChanged = true;
      }
      // Update all users who have this department
      await User.updateMany(
        {
          $or: [
            { 'higherEducation.department': oldName },
            { 'higherEducation.fieldOfStudy': oldName }
          ]
        },
        {
          $set: {
            'higherEducation.$[elem].department': newName,
            'higherEducation.$[elem].fieldOfStudy': newName
          }
        },
        { arrayFilters: [{ $or: [{ 'elem.department': oldName }, { 'elem.fieldOfStudy': oldName }] }] }
      );
    }

    if (settingsChanged) {
      await settings.save();
    }

    res.json({ success: true, message: `Renamed ${type} from "${oldName}" to "${newName}"` });
  } catch (error) {
    console.error('Rename education error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Add new institution dynamically (Student/Campus POC/Manager)
router.post('/institutions/add', auth, async (req, res) => {
  try {
    const { institution, pincode } = req.body;
    if (!institution || !institution.trim()) {
      return res.status(400).json({ success: false, message: 'Institution name is required' });
    }

    const settings = await Settings.getSettings();
    const currentInstitutions = settings.institutionOptions || new Map();

    const normalizedInst = institution.trim();
    if (currentInstitutions.has(normalizedInst)) {
      // Update pincode if provided and different
      if (pincode && pincode.trim() && currentInstitutions.get(normalizedInst) !== pincode.trim()) {
        currentInstitutions.set(normalizedInst, pincode.trim());
        settings.institutionOptions = currentInstitutions;
        settings.lastUpdatedBy = req.userId;
        await settings.save();
        return res.json({ success: true, message: 'Institution pincode updated', data: Object.fromEntries(currentInstitutions) });
      }
      return res.json({ success: true, message: 'Institution already exists', data: Object.fromEntries(currentInstitutions) });
    }

    currentInstitutions.set(normalizedInst, (pincode || '').trim());
    settings.institutionOptions = currentInstitutions;
    settings.markModified('institutionOptions');
    settings.lastUpdatedBy = req.userId;
    await settings.save();

    res.json({ success: true, message: 'Institution added successfully', data: Object.fromEntries(currentInstitutions) });
  } catch (error) {
    console.error('Add institution error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Add job location dynamically (authenticated user)
router.post('/locations/add', auth, async (req, res) => {
  try {
    const { location } = req.body;
    if (!location || !location.trim()) {
      return res.status(400).json({ success: false, message: 'Location name is required' });
    }

    const settings = await Settings.getSettings();
    const normalized = location.trim();

    if (settings.jobLocations.includes(normalized)) {
      return res.json({ success: true, message: 'Location already exists', data: { jobLocations: settings.jobLocations } });
    }

    settings.jobLocations.push(normalized);
    settings.lastUpdatedBy = req.userId;
    await settings.save();

    res.json({
      success: true,
      message: 'Location added successfully',
      data: { jobLocations: settings.jobLocations }
    });
  } catch (error) {
    console.error('Add location error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update proficiency rubrics (manager only)
router.put('/proficiency-rubrics', auth, authorize('manager'), async (req, res) => {
  try {
    const { rubrics } = req.body; // Expects object { "1": { label, description }, ... }
    if (!rubrics || typeof rubrics !== 'object') {
      return res.status(400).json({ success: false, message: 'Invalid rubrics data' });
    }

    const settings = await Settings.getSettings();
    const current = settings.proficiencyRubrics || new Map();

    Object.entries(rubrics).forEach(([level, data]) => {
      if (['1', '2', '3', '4'].includes(level)) {
        current.set(level, {
          label: data.label || '',
          description: data.description || ''
        });
      }
    });

    settings.proficiencyRubrics = current;
    settings.lastUpdatedBy = req.userId;
    await settings.save();

    res.json({
      success: true,
      message: 'Proficiency rubrics updated successfully',
      data: Object.fromEntries(current)
    });
  } catch (error) {
    console.error('Update rubrics error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Add/Update master company (authenticated user)
router.post('/companies/add', auth, async (req, res) => {
  try {
    const { name, website, description, logo, pocName, pocContact, pocEmail } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Company name is required' });
    }

    const settings = await Settings.getSettings();
    const current = settings.masterCompanies || new Map();
    const normalizedName = name.trim();

    // Auto-fetch logo if website is provided but logo is not
    let logoUrl = logo;
    if (website && !logoUrl) {
      try {
        const domain = website.replace(/^https?:\/\//, '').replace(/\/$/, '').split('/')[0];
        logoUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
      } catch (e) {
        // ignore
      }
    }

    let existing = current.get(normalizedName) || { name: normalizedName, website: '', description: '', pocs: [] };

    // Update basic info if provided
    if (website) existing.website = website;
    if (description) existing.description = description;
    if (logoUrl) existing.logo = logoUrl;

    // Manage PoCs
    if (pocName) {
      if (!existing.pocs) existing.pocs = [];
      const pocIndex = existing.pocs.findIndex(p => p.name.toLowerCase() === pocName.toLowerCase());
      const newPoc = {
        name: pocName,
        contact: pocContact || '',
        email: pocEmail || '',
        isPrimary: existing.pocs.length === 0 // First one added becomes primary
      };

      if (pocIndex > -1) {
        existing.pocs[pocIndex] = { ...existing.pocs[pocIndex], ...newPoc };
      } else {
        existing.pocs.push(newPoc);
      }
    }

    current.set(normalizedName, {
      ...existing,
      addedBy: req.userId
    });

    settings.masterCompanies = current;
    settings.markModified('masterCompanies');
    settings.lastUpdatedBy = req.userId;
    await settings.save();

    res.json({
      success: true,
      message: 'Company info saved successfully',
      data: Object.fromEntries(current)
    });
  } catch (error) {
    console.error('Add company error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
