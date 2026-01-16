const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Skill = require('../models/Skill');
const User = require('../models/User');
const { auth, authorize } = require('../middleware/auth');
const Settings = require('../models/Settings');

// Get all skills with optional filters
router.get('/', auth, async (req, res) => {
  try {
    const { category, search, active = 'true', school, common } = req.query;
    const query = {};

    if (active === 'true') {
      query.isActive = true;
    }

    if (category) {
      if (category.includes(',')) {
        query.category = { $in: category.split(',') };
      } else {
        query.category = category;
      }
    }

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    // Filter by common
    if (common === 'true') {
      query.isCommon = true;
    }

    // Filter by school (skills tagged for a specific school)
    if (school) {
      query.schools = school; // matches membership in array
    }

    const skills = await Skill.find(query)
      .populate('createdBy', 'firstName lastName')
      .sort({ name: 1 });

    res.json(skills);
  } catch (error) {
    console.error('Get skills error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get skill categories
router.get('/categories', auth, async (req, res) => {
  try {
    const categories = [
      { value: 'technical', label: 'Technical Skills' },
      { value: 'soft_skill', label: 'Soft Skills' },
      { value: 'language', label: 'Languages' },
      { value: 'certification', label: 'Certifications' },
      { value: 'domain', label: 'Domain Knowledge' },
      { value: 'other', label: 'Other' }
    ];

    res.json(categories);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single skill
router.get('/:id', auth, async (req, res) => {
  try {
    const skill = await Skill.findById(req.params.id)
      .populate('createdBy', 'firstName lastName');

    if (!skill) {
      return res.status(404).json({ message: 'Skill not found' });
    }

    res.json(skill);
  } catch (error) {
    console.error('Get skill error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create skill (Coordinators only)
router.post('/', auth, authorize('coordinator', 'manager', 'campus_poc'), [
  body('name').trim().notEmpty(),
  body('category').isIn(['technical', 'soft_skill', 'language', 'certification', 'domain', 'other'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, category, description, isCommon = false, schools = [] } = req.body;

    const settings = await Settings.getSettings();
    const allowedSchools = Object.keys(Object.fromEntries(settings.schoolModules || new Map()));

    // Check if skill already exists
    const existingSkill = await Skill.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (existingSkill) {
      return res.status(400).json({ message: 'Skill already exists' });
    }

    const skill = new Skill({
      name,
      category,
      description,
      isCommon: Boolean(isCommon),
      schools: Array.isArray(schools) ? schools.filter(s => allowedSchools.includes(s)) : [],
      createdBy: req.userId
    });

    await skill.save();

    res.status(201).json({ message: 'Skill created successfully', skill });
  } catch (error) {
    console.error('Create skill error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update skill
router.put('/:id', auth, authorize('coordinator', 'manager', 'campus_poc'), async (req, res) => {
  try {
    const skill = await Skill.findById(req.params.id);

    if (!skill) {
      return res.status(404).json({ message: 'Skill not found' });
    }

    const { name, category, description, isActive, isCommon, schools } = req.body;
    const settings = await Settings.getSettings();
    const allowedSchools = Object.keys(Object.fromEntries(settings.schoolModules || new Map()));

    if (name) skill.name = name;
    if (category) skill.category = category;
    if (description !== undefined) skill.description = description;
    if (isActive !== undefined) skill.isActive = isActive;
    if (isCommon !== undefined) skill.isCommon = Boolean(isCommon);
    if (schools !== undefined) {
      const normalized = Array.isArray(schools) ? schools.filter(s => allowedSchools.includes(s)) : [];
      skill.schools = normalized;
    }

    await skill.save();

    // Back-propagate skill name changes to student profiles that reference this skill
    try {
      await User.updateMany(
        { 'studentProfile.technicalSkills.skillId': skill._id },
        { $set: { 'studentProfile.technicalSkills.$[elem].skillName': skill.name } },
        { arrayFilters: [{ 'elem.skillId': skill._id }] }
      );
    } catch (err) {
      console.warn('Failed to back-propagate skill name to users:', err.message);
    }

    res.json({ message: 'Skill updated successfully', skill });
  } catch (error) {
    console.error('Update skill error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete skill
router.delete('/:id', auth, authorize('coordinator', 'manager'), async (req, res) => {
  try {
    const skill = await Skill.findById(req.params.id);

    if (!skill) {
      return res.status(404).json({ message: 'Skill not found' });
    }

    // Soft delete - deactivate instead of removing
    skill.isActive = false;
    await skill.save();

    res.json({ message: 'Skill deactivated successfully' });
  } catch (error) {
    console.error('Delete skill error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
