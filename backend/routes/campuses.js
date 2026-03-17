const express = require('express');
const router = express.Router();
const Campus = require('../models/Campus');
const { auth, authorize } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Campuses
 *   description: Campus management
 */

// Get all campuses (public)
/**
 * @swagger
 * /api/campuses:
 *   get:
 *     summary: Get all active campuses
 *     tags: [Campuses]
 *     responses:
 *       200:
 *         description: List of campuses
 */
router.get('/', async (req, res) => {
  try {
    const campuses = await Campus.find({ isActive: true }).sort({ name: 1 });
    res.json(campuses);
  } catch (error) {
    console.error('Get campuses error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single campus
/**
 * @swagger
 * /api/campuses/{id}:
 *   get:
 *     summary: Get a single campus by ID
 *     tags: [Campuses]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Campus details
 *       404:
 *         description: Campus not found
 */
router.get('/:id', async (req, res) => {
  try {
    const campus = await Campus.findById(req.params.id);
    if (!campus) {
      return res.status(404).json({ message: 'Campus not found' });
    }
    res.json(campus);
  } catch (error) {
    console.error('Get campus error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create campus (Manager only)
/**
 * @swagger
 * /api/campuses:
 *   post:
 *     summary: Create a new campus
 *     tags: [Campuses]
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
 *               - code
 *             properties:
 *               name:
 *                 type: string
 *               code:
 *                 type: string
 *               location:
 *                 type: string
 *               contactEmail:
 *                 type: string
 *               contactPhone:
 *                 type: string
 *               discordChannelId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Campus created
 *       400:
 *         description: Duplicate code
 */
router.post('/', auth, authorize('manager'), async (req, res) => {
  try {
    const { name, code, location, contactEmail, contactPhone, discordChannelId } = req.body;

    const existing = await Campus.findOne({ code: code.toUpperCase() });
    if (existing) {
      return res.status(400).json({ message: 'Campus with this code already exists' });
    }

    const campus = new Campus({
      name,
      code: code.toUpperCase(),
      location,
      contactEmail,
      contactPhone,
      discordChannelId
    });

    await campus.save();
    res.status(201).json(campus);
  } catch (error) {
    console.error('Create campus error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update campus (Manager only)
/**
 * @swagger
 * /api/campuses/{id}:
 *   put:
 *     summary: Update a campus
 *     tags: [Campuses]
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
 *         description: Campus updated
 */
router.put('/:id', auth, authorize('manager'), async (req, res) => {
  try {
    const { name, location, contactEmail, contactPhone, isActive, discordChannelId } = req.body;

    const campus = await Campus.findById(req.params.id);
    if (!campus) {
      return res.status(404).json({ message: 'Campus not found' });
    }

    if (name) campus.name = name;
    if (location) campus.location = location;
    if (contactEmail) campus.contactEmail = contactEmail;
    if (contactPhone) campus.contactPhone = contactPhone;
    if (isActive !== undefined) campus.isActive = isActive;
    if (discordChannelId !== undefined) campus.discordChannelId = discordChannelId;

    await campus.save();
    res.json(campus);
  } catch (error) {
    console.error('Update campus error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete campus (Manager only)
/**
 * @swagger
 * /api/campuses/{id}:
 *   delete:
 *     summary: Deactivate a campus (soft delete)
 *     tags: [Campuses]
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
 *         description: Campus deactivated
 */
router.delete('/:id', auth, authorize('manager'), async (req, res) => {
  try {
    const campus = await Campus.findById(req.params.id);
    if (!campus) {
      return res.status(404).json({ message: 'Campus not found' });
    }

    // Soft delete - set isActive to false
    campus.isActive = false;
    await campus.save();

    res.json({ message: 'Campus deactivated' });
  } catch (error) {
    console.error('Delete campus error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
