const express = require('express');
const router = express.Router();
const gharApiService = require('../services/gharApiService');
const User = require('../models/User');
const { auth, authorize } = require('../middleware/auth');

// Helper middlewares using the existing authorize function
const isManager = authorize('manager');
const isAuthenticated = auth;

/**
 * @route   GET /api/ghar/attendance-config
 * @desc    Get all attendance configurations from Ghar Dashboard
 * @access  Manager, Campus POC
 */
router.get('/attendance-config', isAuthenticated, async (req, res) => {
    try {
        const isDev = req.query.isDev === 'true';
        const config = await gharApiService.getAllAttendanceConfigurations(isDev);

        res.json({
            success: true,
            data: config
        });
    } catch (error) {
        console.error('Error fetching attendance config:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch attendance configurations',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/ghar/sync-student
 * @desc    Sync single student data from Ghar API to local additive section
 * @access  Manager, Campus POC
 */
router.post('/sync-student', isAuthenticated, async (req, res) => {
    try {
        const { email, userId } = req.body;

        if (!email && !userId) {
            return res.status(400).json({
                success: false,
                message: 'Email or userId is required'
            });
        }

        // Find local student
        const student = userId
            ? await User.findById(userId)
            : await User.findOne({ email, role: 'student' });

        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student not found in local database'
            });
        }

        // Sync data from Ghar API (this already calls User.syncGharData internally)
        const externalData = await gharApiService.syncStudentData(student.email);

        if (externalData) {
            // Re-fetch student to get updated virtuals/resolved data
            const updatedStudent = await User.findById(student._id);

            res.json({
                success: true,
                message: 'Student data synced from Ghar successfully',
                data: {
                    student: {
                        id: updatedStudent._id,
                        name: updatedStudent.fullName,
                        email: updatedStudent.email,
                        resolvedProfile: updatedStudent.resolvedProfile
                    },
                    externalData
                }
            });
        } else {
            res.status(404).json({
                success: false,
                message: `No data found for email ${student.email} in Ghar Dashboard (check if email matches exactly)`
            });
        }
    } catch (error) {
        console.error('Error syncing student:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to sync student data',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/ghar/batch-sync
 * @desc    Batch sync multiple students from Ghar API
 * @access  Manager only
 */
router.post('/batch-sync', isAuthenticated, isManager, async (req, res) => {
    try {
        const { emails, campusId } = req.body;

        let studentsToSync;

        if (emails && emails.length > 0) {
            studentsToSync = await User.find({
                email: { $in: emails },
                role: 'student'
            });
        } else if (campusId) {
            studentsToSync = await User.find({
                campus: campusId,
                role: 'student'
            });
        } else {
            return res.status(400).json({
                success: false,
                message: 'Either emails array or campusId is required'
            });
        }

        if (studentsToSync.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No students found to sync'
            });
        }

        const studentEmails = studentsToSync.map(s => s.email);
        const results = await gharApiService.batchSyncStudents(studentEmails);

        const summary = {
            total: results.length,
            successful: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length
        };

        res.json({
            success: true,
            message: `Batch sync completed: ${summary.successful}/${summary.total} successful`,
            summary,
            results
        });
    } catch (error) {
        console.error('Error in batch sync:', error);
        res.status(500).json({
            success: false,
            message: 'Batch sync failed',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/ghar/connection-status
 * @desc    Check if Ghar API is accessible
 * @access  Manager only
 */
router.get('/connection-status', isAuthenticated, isManager, async (req, res) => {
    try {
        const isConnected = await gharApiService.checkConnection();

        res.json({
            success: true,
            connected: isConnected,
            message: isConnected
                ? 'Ghar Dashboard API is accessible'
                : 'Cannot connect to Ghar API. Check token and network.'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            connected: false,
            message: 'Error checking connection',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/ghar/student-preview/:email
 * @desc    Fetch raw student data from Ghar API (no DB sync)
 * @access  Manager only
 */
router.get('/student-preview/:email', isAuthenticated, isManager, async (req, res) => {
    try {
        const { email } = req.params;
        const isDev = req.query.isDev === 'true';

        const response = await gharApiService.client.get('/gharZoho/students/By/NgEmail', {
            params: {
                isDev,
                Student_ng_email: email
            }
        });

        if (response.data && response.data.data && Array.isArray(response.data.data) && response.data.data.length > 0) {
            res.json({
                success: true,
                data: response.data.data
            });
        } else {
            res.status(404).json({
                success: false,
                message: `No data found for email ${email} in Ghar Dashboard`
            });
        }
    } catch (error) {
        console.error('Error fetching student preview:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch student data',
            error: error.message
        });
    }
});

module.exports = router;
