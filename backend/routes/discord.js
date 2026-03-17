const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const discordService = require('../services/discordService');
const User = require('../models/User');

/**
 * @swagger
 * tags:
 *   name: Discord
 *   description: Discord bot integration
 */

// Middleware to ensure Discord is initialized
const ensureDiscordReady = async (req, res, next) => {
    const isReady = await discordService.ensureReady();
    if (!isReady) {
        return res.status(503).json({ message: 'Discord service not available' });
    }
    next();
};

/**
 * @route   POST /api/discord/test-connection
 * @desc    Test Discord bot connection by sending a message
 * @access  Manager
 */
/**
 * @swagger
 * /api/discord/test-connection:
 *   post:
 *     summary: Test Discord bot connection
 *     tags: [Discord]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Connection test result
 */
router.post('/test-connection', auth, authorize('manager'), ensureDiscordReady, async (req, res) => {
    try {
        const result = await discordService.testConnection();
        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        console.error('Discord test connection error:', error);
        res.status(500).json({ message: 'Server error during test' });
    }
});

/**
 * @route   GET /api/discord/server-info
 * @desc    Get Discord server information (channels, roles)
 * @access  Manager
 */
/**
 * @swagger
 * /api/discord/server-info:
 *   get:
 *     summary: Get Discord server info
 *     tags: [Discord]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Server details
 */
router.get('/server-info', auth, authorize('manager'), ensureDiscordReady, async (req, res) => {
    try {
        const info = await discordService.getServerInfo();
        if (info) {
            res.json(info);
        } else {
            res.status(404).json({ message: 'Could not fetch server info' });
        }
    } catch (error) {
        console.error('Get server info error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * @route   POST /api/discord/verify-user
 * @desc    Verify a user's Discord ID (initiated by user)
 * @access  Private
 */
/**
 * @swagger
 * /api/discord/verify-user:
 *   post:
 *     summary: Link and verify Discord user ID
 *     tags: [Discord]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - discordUserId
 *             properties:
 *               discordUserId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Discord linked
 */
router.post('/verify-user', auth, async (req, res) => {
    try {
        // This is a simplified verification that just validates the ID format
        // In a full implementation, this could send a DM with a OTP
        const { discordUserId } = req.body;

        if (!discordUserId || !/^\d{17,19}$/.test(discordUserId)) {
            return res.status(400).json({ message: 'Invalid Discord User ID format' });
        }

        const user = await User.findById(req.userId);
        user.discord = user.discord || {};
        user.discord.userId = discordUserId;
        // For now, auto-verify if format is valid. Later implement strict verification.
        user.discord.verified = true;
        user.discord.verifiedAt = new Date();

        await user.save();

        res.json({
            message: 'Discord ID updated',
            discord: user.discord
        });
    } catch (error) {
        console.error('Verify Discord user error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * @route   DELETE /api/discord/disconnect
 * @desc    Remove Discord ID from user profile
 * @access  Private
 */
/**
 * @swagger
 * /api/discord/disconnect:
 *   delete:
 *     summary: Unlink Discord from profile
 *     tags: [Discord]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Discord unlinked
 */
router.delete('/disconnect', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        user.discord = {
            userId: '',
            username: '',
            verified: false,
            verifiedAt: null
        };

        await user.save();

        res.json({ message: 'Discord disconnected successfully' });
    } catch (error) {
        console.error('Disconnect Discord error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
