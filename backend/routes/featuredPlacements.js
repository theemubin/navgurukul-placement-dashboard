const express = require('express');
const router = express.Router();
const FeaturedPlacement = require('../models/FeaturedPlacement');
const Application = require('../models/Application');
const { auth, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Helper for manager authorization
const isManager = authorize('manager');

/**
 * GET /api/featured-placements
 * Get all featured placements (for manager dashboard)
 */
router.get('/', auth, isManager, async (req, res) => {
    try {
        const featured = await FeaturedPlacement.find()
            .populate({
                path: 'student',
                select: 'firstName lastName avatar email'
            })
            .populate({
                path: 'job',
                select: 'title company salary location',
                populate: {
                    path: 'company',
                    select: 'name logo'
                }
            })
            .populate({
                path: 'application',
                select: 'status currentRound'
            })
            .populate('featuredBy', 'firstName lastName')
            .sort({ displayOrder: 1, featuredAt: -1 });

        res.json({
            success: true,
            count: featured.length,
            featuredPlacements: featured
        });
    } catch (error) {
        console.error('Error fetching featured placements:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching featured placements'
        });
    }
});

/**
 * POST /api/featured-placements
 * Create a new featured placement
 */
router.post('/', auth, isManager, async (req, res) => {
    try {
        const {
            applicationId,
            heroImage,
            customQuote,
            displayOrder,
            isManual,
            manualStudentName,
            manualJobTitle,
            manualCompanyName,
            manualStudentAvatar,
            manualPackage,
            manualCampus,
            manualBatch
        } = req.body;

        let featuredData = {
            heroImage: heroImage || null,
            customQuote: customQuote || null,
            displayOrder: displayOrder || 0,
            featuredBy: req.userId
        };

        if (isManual) {
            featuredData = {
                ...featuredData,
                manualStudentName,
                manualJobTitle,
                manualCompanyName,
                manualStudentAvatar,
                manualPackage,
                manualCampus,
                manualBatch
            };
        } else {
            // Verify application exists and is accepted
            const application = await Application.findById(applicationId)
                .populate('student')
                .populate('job');

            if (!application) {
                return res.status(404).json({
                    success: false,
                    message: 'Application not found'
                });
            }

            featuredData = {
                ...featuredData,
                application: applicationId,
                student: application.student._id,
                job: application.job._id
            };
        }

        const featured = new FeaturedPlacement(featuredData);
        await featured.save();

        if (featured.student) {
            await featured.populate([
                { path: 'student', select: 'firstName lastName avatar' },
                {
                    path: 'job',
                    select: 'title company salary',
                    populate: { path: 'company', select: 'name logo' }
                }
            ]);
        }

        res.status(201).json({
            success: true,
            message: 'Placement featured successfully',
            featuredPlacement: featured
        });
    } catch (error) {
        console.error('Error creating featured placement:', error);
        res.status(500).json({
            success: false,
            message: 'Error featuring placement'
        });
    }
});

/**
 * PUT /api/featured-placements/:id
 * Update a featured placement
 */
router.put('/:id', auth, isManager, async (req, res) => {
    try {
        const { heroImage, customQuote, displayOrder, isActive } = req.body;

        const featured = await FeaturedPlacement.findById(req.params.id);
        if (!featured) {
            return res.status(404).json({
                success: false,
                message: 'Featured placement not found'
            });
        }

        // Update fields
        if (heroImage !== undefined) featured.heroImage = heroImage;
        if (customQuote !== undefined) featured.customQuote = customQuote;
        if (displayOrder !== undefined) featured.displayOrder = displayOrder;
        if (isActive !== undefined) featured.isActive = isActive;

        await featured.save();

        // Populate for response
        await featured.populate([
            { path: 'student', select: 'firstName lastName avatar' },
            {
                path: 'job',
                select: 'title company salary',
                populate: { path: 'company', select: 'name logo' }
            }
        ]);

        res.json({
            success: true,
            message: 'Featured placement updated successfully',
            featuredPlacement: featured
        });
    } catch (error) {
        console.error('Error updating featured placement:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating featured placement'
        });
    }
});

/**
 * DELETE /api/featured-placements/:id
 * Remove a placement from featured list
 */
router.delete('/:id', auth, isManager, async (req, res) => {
    try {
        const featured = await FeaturedPlacement.findByIdAndDelete(req.params.id);

        if (!featured) {
            return res.status(404).json({
                success: false,
                message: 'Featured placement not found'
            });
        }

        res.json({
            success: true,
            message: 'Placement removed from featured list'
        });
    } catch (error) {
        console.error('Error deleting featured placement:', error);
        res.status(500).json({
            success: false,
            message: 'Error removing featured placement'
        });
    }
});

/**
 * PUT /api/featured-placements/reorder/batch
 * Reorder featured placements
 */
router.put('/reorder/batch', auth, isManager, async (req, res) => {
    try {
        const { placements } = req.body; // Array of { id, displayOrder }

        if (!Array.isArray(placements)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid request format'
            });
        }

        // Update all in parallel
        await Promise.all(
            placements.map(({ id, displayOrder }) =>
                FeaturedPlacement.findByIdAndUpdate(id, { displayOrder })
            )
        );

        res.json({
            success: true,
            message: 'Featured placements reordered successfully'
        });
    } catch (error) {
        console.error('Error reordering featured placements:', error);
        res.status(500).json({
            success: false,
            message: 'Error reordering placements'
        });
    }
});

/**
 * GET /api/featured-placements/available
 * Get accepted applications that can be featured
 */
router.get('/available', auth, isManager, async (req, res) => {
    try {
        // Get all featured application IDs
        const featured = await FeaturedPlacement.find().select('application');
        const featuredIds = featured
            .filter(f => f.application)
            .map(f => f.application.toString());

        // Find accepted applications not yet featured
        const available = await Application.find({
            status: 'accepted',
            _id: { $nin: featuredIds }
        })
            .populate('student', 'firstName lastName avatar')
            .populate({
                path: 'job',
                select: 'title company salary',
                populate: { path: 'company', select: 'name logo' }
            })
            .sort({ updatedAt: -1 })
            .limit(50);

        res.json({
            success: true,
            count: available.length,
            applications: available
        });
    } catch (error) {
        console.error('Error fetching available placements:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching available placements'
        });
    }
});

/**
 * PUT /api/featured-placements/:id/image
 * Upload a hero image for a featured placement
 */
router.put('/:id/image', auth, isManager, upload.single('heroImage'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        const featured = await FeaturedPlacement.findById(req.params.id);
        if (!featured) {
            return res.status(404).json({
                success: false,
                message: 'Featured placement not found'
            });
        }

        // Save relative path
        featured.heroImage = `/uploads/hero_images/${req.file.filename}`;
        await featured.save();

        res.json({
            success: true,
            message: 'Hero image uploaded successfully',
            heroImage: featured.heroImage
        });
    } catch (error) {
        console.error('Error uploading hero image:', error);
        res.status(500).json({
            success: false,
            message: 'Error uploading hero image'
        });
    }
});

module.exports = router;
