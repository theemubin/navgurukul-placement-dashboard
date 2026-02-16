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

        // Sync data from Ghar API
        const externalData = await gharApiService.syncStudentData(student.email);

        if (externalData) {
            // Initialize externalData if not present
            if (!student.studentProfile.externalData) {
                student.studentProfile.externalData = { ghar: {} };
            }
            if (!student.studentProfile.externalData.ghar) {
                student.studentProfile.externalData.ghar = {};
            }

            const now = new Date();
            const gharData = student.studentProfile.externalData.ghar;

            // Map the fields safely to the additive section (Ghar Dashboard specific)
            if (externalData.attendance) {
                gharData.attendancePercentage = {
                    value: externalData.attendance.percentage,
                    lastUpdated: now
                };
            }
            if (externalData.currentSchool) {
                gharData.currentSchool = {
                    value: externalData.currentSchool,
                    lastUpdated: now
                };
            }
            if (externalData.joiningDate) {
                gharData.admissionDate = {
                    value: new Date(externalData.joiningDate),
                    lastUpdated: now
                };
            }

            // Store everything else in extraAttributes to avoid data loss
            gharData.extraAttributes = {
                ...gharData.extraAttributes,
                ...externalData,
                syncTimestamp: now
            };

            // Mark the model modified for mixed type objects
            student.markModified('studentProfile.externalData');
            await student.save();

            res.json({
                success: true,
                message: 'Student data synced to Ghar section successfully',
                data: {
                    student: {
                        id: student._id,
                        name: student.fullName,
                        email: student.email
                    },
                    externalData
                }
            });
        } else {
            res.status(404).json({
                success: false,
                message: 'No data found for this student in Ghar Dashboard'
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

        const updatePromises = results
            .filter(r => r.success && r.data)
            .map(async (result) => {
                const student = studentsToSync.find(s => s.email === result.email);
                if (student && result.data) {
                    const externalData = result.data;

                    if (!student.studentProfile.externalData) {
                        student.studentProfile.externalData = { ghar: {} };
                    }
                    if (!student.studentProfile.externalData.ghar) {
                        student.studentProfile.externalData.ghar = {};
                    }

                    const now = new Date();
                    const gharData = student.studentProfile.externalData.ghar;

                    if (externalData.attendance) {
                        gharData.attendancePercentage = {
                            value: externalData.attendance.percentage,
                            lastUpdated: now
                        };
                    }

                    gharData.extraAttributes = {
                        ...gharData.extraAttributes,
                        ...externalData,
                        syncTimestamp: now
                    };

                    student.markModified('studentProfile.externalData');
                    await student.save();
                }
            });

        await Promise.all(updatePromises);

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

module.exports = router;
