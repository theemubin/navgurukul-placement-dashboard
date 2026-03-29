const express = require('express');
const router = express.Router();
const gharApiService = require('../services/gharApiService');
const User = require('../models/User');
const { auth, authorize } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Ghar
 *   description: Ghar Dashboard (Internal) integration
 */

// Helper middlewares using the existing authorize function
const isManager = authorize('manager');
const isAuthenticated = auth;

/**
 * @route   GET /api/ghar/attendance-config
 * @desc    Get all attendance configurations from Ghar Dashboard
 * @access  Manager, Campus POC
 */
/**
 * @swagger
 * /api/ghar/attendance-config:
 *   get:
 *     summary: Get attendance configurations from Ghar Dashboard
 *     tags: [Ghar]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Config data
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
/**
 * @swagger
 * /api/ghar/sync-student:
 *   post:
 *     summary: Sync single student data from Ghar API
 *     tags: [Ghar]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               userId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Sync successful
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
            : await User.findOne({ email: new RegExp(`^${email}$`, 'i'), role: 'student' });

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
/**
 * @swagger
 * /api/ghar/batch-sync:
 *   post:
 *     summary: Batch sync students from Ghar API
 *     tags: [Ghar]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               emails:
 *                 type: array
 *                 items:
 *                   type: string
 *               campusId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Batch sync result
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
 * @route   POST /api/ghar/import-all-students
 * @desc    Mass sync and import students from Ghar Dashboard (optionally filtered by campus)
 * @access  Manager, Campus POC
 */
router.post('/import-all-students', isAuthenticated, authorize('manager', 'campus_poc'), async (req, res) => {
    try {
        const isDev = req.query.isDev === 'true';
        const { campus, school, status, stdIdStart, stdIdEnd } = req.query;
        console.log(`[GharSync] Starting mass import (isDev: ${isDev}, Campus: ${campus || 'All'}, School: ${school || 'All'}, Status: ${status || 'All'}, Range: ${stdIdStart || 1}-${stdIdEnd || 10000})`);

        const studentsToProcess = await gharApiService.fetchFilteredStudents({ 
          campus, 
          school, 
          status,
          stdIdStart: stdIdStart || 1, 
          stdIdEnd: stdIdEnd || 5000 // Default 5k to be safe
        }, isDev);
        
        if (!studentsToProcess || studentsToProcess.length === 0) {
            return res.status(200).json({
                success: false,
                message: campus || school || status 
                  ? 'No students found matching your filters' 
                  : 'No students found to import'
            });
        }

        const stats = {
            totalFromGhar: studentsToProcess.length,
            created: 0,
            updated: 0,
            failed: 0,
            processedStudents: [] 
        };

        // Pre-fetch campus ID once to avoid 292 redundant queries
        let resolvedCampusId = null;
        if (campus) {
          try {
            const Campus = mongoose.model('Campus');
            const campusDoc = await Campus.findOne({ name: new RegExp(`^${campus}$`, 'i') });
            if (campusDoc) resolvedCampusId = campusDoc._id;
          } catch (e) {
            console.warn('[GharSync] Could not pre-cache campus ID');
          }
        }

        // Get all emails in one batch to check existence in one go
        const studentEmailsInGhar = studentsToProcess.map(st => {
           // Reuse the email finding logic but carefully
           return [
              'Navgurukul_Email', 'Student_ng_email', 'Email', 'Email_ID', 
              'student_email', 'Ng_Email_ID', 'Personal_Email'
            ].map(k => st[k]).find(v => v);
        }).filter(v => v);

        const existingUsers = await User.find({ 
           email: { $in: studentEmailsInGhar.map(e => new RegExp(`^${e.trim()}$`, 'i')) } 
        }, 'email');
        const existingEmailsSet = new Set(existingUsers.map(u => u.email.toLowerCase()));

        const batchSize = 15; // Slightly larger batches
        for (let i = 0; i < studentsToProcess.length; i += batchSize) {
            const batch = studentsToProcess.slice(i, i + batchSize);
            await Promise.allSettled(batch.map(async (st) => {
                let currentEmail = 'Unknown';
                let currentName = 'Unknown Student';
                try {
                    // Reuse the finding logic
                    const emailField = [
                      'Navgurukul_Email', 'Student_ng_email', 'Email', 'Email_ID', 
                      'student_email', 'Ng_Email_ID', 'Personal_Email',
                      'Select_Campus.Campus_Email', 'Email_Address'
                    ].find(k => {
                      if (k.includes('.')) {
                        const [p, c] = k.split('.');
                        return st[p] && st[p][c];
                      }
                      return st[k];
                    });

                    if (emailField && emailField.includes('.')) {
                      const [p, c] = emailField.split('.');
                      currentEmail = st[p][c];
                    } else if (emailField) {
                      currentEmail = st[emailField];
                    }
                    
                    if (st.Name && typeof st.Name === 'object') {
                      currentName = `${st.Name.first_name || ''} ${st.Name.last_name || ''}`.trim() || 'No Name';
                    } else if (typeof st.Name === 'string') {
                      currentName = st.Name;
                    }

                    if (!currentEmail) {
                      stats.failed++;
                      return;
                    }

                    const normalizedEmail = currentEmail.trim().toLowerCase();
                    const exists = existingEmailsSet.has(normalizedEmail);
                    
                    // Sync data 
                    const result = await User.syncGharData(normalizedEmail, st, { 
                      createIfNotFound: true,
                      targetCampusId: resolvedCampusId // Pass if already found
                    });
                    
                    if (result) {
                        const isNew = !exists;
                        if (isNew) stats.created++;
                        else stats.updated++;
                        
                        stats.processedStudents.push({
                           name: currentName,
                           email: currentEmail,
                           status: isNew ? 'Created' : 'Updated'
                        });
                    } else {
                        stats.failed++;
                    }
                } catch (err) {
                    console.error(`[GharSync] Import error for student ${currentEmail}:`, err.message);
                    stats.failed++;
                }
            }));
        }

        res.json({
            success: true,
            message: campus 
              ? `Sync for ${campus} completed: ${stats.created} new imported, ${stats.updated} updated`
              : `Mass sync completed: ${stats.created} imported, ${stats.updated} updated`,
            stats,
            debug: stats.failed > 0 ? {
                sampleStudentKeys: studentsToProcess[0] ? Object.keys(studentsToProcess[0]) : [],
                sampleFirstStudent: studentsToProcess[0] || null
            } : null
        });
    } catch (error) {
        console.error('Error in mass import:', error);
        res.status(500).json({
            success: false,
            message: 'Mass import failed',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/ghar/connection-status
 * @desc    Check if Ghar API is accessible
 * @access  Manager only
 */
/**
 * @swagger
 * /api/ghar/connection-status:
 *   get:
 *     summary: Check Ghar API connection status
 *     tags: [Ghar]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Connection status
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
/**
 * @swagger
 * /api/ghar/student-preview/{email}:
 *   get:
 *     summary: Preview student data from Ghar API (no sync)
 *     tags: [Ghar]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Preview data
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
