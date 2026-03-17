const express = require('express');
const router = express.Router();
const Lead = require('../models/Lead');
const { auth, authorize } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Leads
 *   description: Management of contact inquiries
 */

/**
 * @swagger
 * /api/leads:
 *   get:
 *     summary: Get all leads (manager only)
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of leads
 */
router.get('/', auth, authorize('manager'), async (req, res) => {
    try {
        const leads = await Lead.find()
            .populate('statusHistory.updatedBy', 'name')
            .sort({ createdAt: -1 });
        res.json({ success: true, leads });
    } catch (error) {
        console.error('Error fetching leads:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

/**
 * @swagger
 * /api/leads/{id}:
 *   patch:
 *     summary: Update lead status or notes
 *     tags: [Leads]
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
 *         description: Lead updated
 */
router.patch('/:id', auth, authorize('manager'), async (req, res) => {
    try {
        const { status, notes, comment } = req.body;

        const lead = await Lead.findById(req.params.id);
        if (!lead) {
            return res.status(404).json({ success: false, message: 'Lead not found' });
        }

        // If status changed, record in history
        if (status && status !== lead.status) {
            lead.status = status;
            lead.statusHistory.push({
                status,
                comment: comment || '',
                updatedBy: req.user?._id || req.user?.id,
                updatedAt: new Date()
            });
        }

        if (notes !== undefined) lead.notes = notes;

        await lead.save();

        // Re-fetch with population
        const updatedLead = await Lead.findById(lead._id).populate('statusHistory.updatedBy', 'name');

        res.json({ success: true, lead: updatedLead });
    } catch (error) {
        console.error('Error updating lead:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
