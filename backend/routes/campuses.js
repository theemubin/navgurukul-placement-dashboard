const express = require('express');
const router = express.Router();
const Campus = require('../models/Campus');
const { auth, authorize } = require('../middleware/auth');

// Get all campuses (public)
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
