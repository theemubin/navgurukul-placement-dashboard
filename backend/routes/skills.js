const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Skill = require('../models/Skill');
const User = require('../models/User');
const { auth, authorize } = require('../middleware/auth');
const Settings = require('../models/Settings');

/**
 * @swagger
 * tags:
 *   name: Skills
 *   description: Skill taxonomy management
 */

// Get all skills with optional filters
/**
 * @swagger
 * /api/skills:
 *   get:
 *     summary: Get all skills
 *     tags: [Skills]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: active
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of skills
 */
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
/**
 * @swagger
 * /api/skills/categories:
 *   get:
 *     summary: Get skill categories
 *     tags: [Skills]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of categories
 */
router.get('/categories', auth, async (req, res) => {
  try {
    const categories = [
      { value: 'technical', label: 'Technical Skills' },
      { value: 'soft_skill', label: 'Soft Skills' },
      { value: 'office', label: 'Office Skills' },
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
/**
 * @swagger
 * /api/skills/{id}:
 *   get:
 *     summary: Get a single skill
 *     tags: [Skills]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Skill details
 */
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
/**
 * @swagger
 * /api/skills:
 *   post:
 *     summary: Create a new skill
 *     tags: [Skills]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - category
 *             properties:
 *               name:
 *                 type: string
 *               category:
 *                 type: string
 *               description:
 *                 type: string
 *               isCommon:
 *                 type: boolean
 *               schools:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Skill created
 */
router.post('/', auth, authorize('coordinator', 'manager', 'campus_poc'), [
  body('name').trim().notEmpty(),
  body('category').isIn(['technical', 'soft_skill', 'office', 'language', 'certification', 'domain', 'other'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, category, description, isCommon = false, schools = [] } = req.body;

    const settings = await Settings.getSettings();
    const allowedSchools = Object.keys(Object.fromEntries(settings.schoolModules || new Map()));

    // Normalize name to prevent case-only collisions and check if skill already exists
    const normalized = (name || '').toString().trim().toLowerCase();
    let skill = await Skill.findOne({ normalizedName: normalized });

    if (skill) {
      if (skill.isActive) {
        return res.status(400).json({ message: 'Skill already exists' });
      }
      // If it exists but is inactive, reactivate it and update with new data
      skill.isActive = true;
      skill.name = name;
      skill.category = category;
      skill.description = description;
      skill.isCommon = Boolean(isCommon);
      skill.schools = Array.isArray(schools) ? schools : [];
      skill.createdBy = req.userId;
      await skill.save();
      return res.status(200).json({ message: 'Skill reactivated successfully', skill });
    }

    skill = new Skill({
      name,
      normalizedName: normalized,
      category,
      description,
      isCommon: Boolean(isCommon),
      schools: Array.isArray(schools) ? schools : [],
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
/**
 * @swagger
 * /api/skills/{id}:
 *   put:
 *     summary: Update a skill
 *     tags: [Skills]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Skill updated
 */
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

    // Back-propagate skill name changes to student profiles that reference this skill (technical + soft skills)
    try {
      // Technical skills
      await User.updateMany(
        { 'studentProfile.technicalSkills.skillId': skill._id },
        { $set: { 'studentProfile.technicalSkills.$[elem].skillName': skill.name } },
        { arrayFilters: [{ 'elem.skillId': skill._id }] }
      );

      // Soft skills
      await User.updateMany(
        { 'studentProfile.softSkills.skillId': skill._id },
        { $set: { 'studentProfile.softSkills.$[elem].skillName': skill.name } },
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
/**
 * @swagger
 * /api/skills/{id}:
 *   delete:
 *     summary: Deactivate a skill
 *     tags: [Skills]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Skill deactivated
 */
router.delete('/:id', auth, authorize('coordinator', 'manager', 'campus_poc'), async (req, res) => {
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
