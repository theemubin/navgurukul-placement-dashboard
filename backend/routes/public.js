const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Campus = require('../models/Campus');
const Skill = require('../models/Skill');

/**
 * @swagger
 * tags:
 *   name: Public
 *   description: Publicly accessible endpoints
 */

/**
 * @swagger
 * /api/public/portfolios:
 *   get:
 *     summary: Get public student portfolios
 *     tags: [Public]
 *     parameters:
 *       - in: query
 *         name: campus
 *         schema:
 *           type: string
 *       - in: query
 *         name: skills
 *         schema:
 *           type: string
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of student portfolios
 */
router.get('/portfolios', async (req, res) => {
    try {
        const { campus, skills, role } = req.query;

        // Build query for approved, active students only
        const query = {
            role: 'student',
            isActive: true,
            'studentProfile.profileStatus': 'approved'
        };

        // Filter by campus if provided
        if (campus) {
            query.campus = campus;
        }

        // Filter by role preference if provided
        if (role) {
            query['studentProfile.openForRoles'] = role;
        }

        // Fetch students with populated fields
        let students = await User.find(query)
            .select('firstName lastName avatar campus studentProfile.technicalSkills studentProfile.softSkills studentProfile.officeSkills studentProfile.openForRoles studentProfile.github studentProfile.linkedIn studentProfile.portfolio studentProfile.resumeLink studentProfile.about studentProfile.languages studentProfile.tenthGrade studentProfile.twelfthGrade studentProfile.higherEducation studentProfile.courses placementCycle')
            .populate('campus', 'name code')
            .populate('placementCycle', 'name year')
            .populate('studentProfile.technicalSkills.skillId', 'name category')
            .populate('studentProfile.softSkills.skillId', 'name')
            .populate('studentProfile.officeSkills.skillId', 'name')
            .lean();

        // Filter by skills if provided (after population)
        if (skills) {
            const skillsArray = Array.isArray(skills) ? skills : [skills];
            students = students.filter(student => {
                const studentSkills = student.studentProfile?.technicalSkills || [];
                return skillsArray.some(skillId =>
                    studentSkills.some(ts => ts.skillId?._id?.toString() === skillId)
                );
            });
        }

        // Transform data for public consumption
        const portfolios = students.map(student => ({
            id: student._id,
            name: `${student.firstName} ${student.lastName}`,
            avatar: student.avatar || null,
            campus: student.campus ? {
                id: student.campus._id,
                name: student.campus.name,
                code: student.campus.code
            } : null,
            batch: student.placementCycle ? {
                name: student.placementCycle.name,
                year: student.placementCycle.year
            } : null,
            openForRoles: student.studentProfile?.openForRoles || [],
            technicalSkills: (student.studentProfile?.technicalSkills || [])
                .filter(ts => ts.skillId)
                .map(ts => ({
                    id: ts.skillId._id,
                    name: ts.skillId.name,
                    category: ts.skillId.category,
                    rating: ts.selfRating
                }))
                .slice(0, 6), // Limit to top 6 skills for card display
            softSkills: (student.studentProfile?.softSkills || [])
                .filter(ss => ss.skillId)
                .map(ss => ({
                    id: ss.skillId._id,
                    name: ss.skillId.name,
                    rating: ss.selfRating
                })),
            officeSkills: (student.studentProfile?.officeSkills || [])
                .filter(os => os.skillId)
                .map(os => ({
                    id: os.skillId._id,
                    name: os.skillId.name,
                    rating: os.selfRating
                })),
            github: student.studentProfile?.github || null,
            linkedIn: student.studentProfile?.linkedIn || null,
            portfolio: student.studentProfile?.portfolio || null,
            resumeLink: student.studentProfile?.resumeLink || null,
            about: student.studentProfile?.about || null,
            languages: student.studentProfile?.languages || [],
            education: {
                tenth: student.studentProfile?.tenthGrade || null,
                twelfth: student.studentProfile?.twelfthGrade || null,
                higher: student.studentProfile?.higherEducation || []
            },
            courses: student.studentProfile?.courses || []
        }));

        res.json({
            success: true,
            count: portfolios.length,
            portfolios
        });

    } catch (error) {
        console.error('Error fetching public portfolios:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching portfolios'
        });
    }
});

/**
 * @swagger
 * /api/public/filters:
 *   get:
 *     summary: Get filter options for public portfolio explorer
 *     tags: [Public]
 *     responses:
 *       200:
 *         description: Filter options
 */
router.get('/filters', async (req, res) => {
    try {
        // Get all campuses
        const campuses = await Campus.find({ isActive: true })
            .select('name code')
            .sort('name');

        // Get all technical skills
        const skills = await Skill.find({ category: 'technical', isActive: true })
            .select('name category')
            .sort('name');

        // Get unique roles from approved students
        const students = await User.find({
            role: 'student',
            isActive: true,
            'studentProfile.profileStatus': 'approved'
        }).select('studentProfile.openForRoles');

        const rolesSet = new Set();
        students.forEach(student => {
            (student.studentProfile?.openForRoles || []).forEach(role => {
                if (role) rolesSet.add(role);
            });
        });

        const roles = Array.from(rolesSet).sort();

        res.json({
            success: true,
            filters: {
                campuses,
                skills,
                roles
            }
        });

    } catch (error) {
        console.error('Error fetching filter options:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching filter options'
        });
    }
});

/**
 * @swagger
 * /api/public/placements:
 *   get:
 *     summary: Get placement data for public carousel
 *     tags: [Public]
 *     responses:
 *       200:
 *         description: Carousel data
 */
router.get('/placements', async (req, res) => {
    try {
        const FeaturedPlacement = require('../models/FeaturedPlacement');
        const Application = require('../models/Application');

        // First, try to get featured placements
        const featured = await FeaturedPlacement.find({ isActive: true })
            .populate({
                path: 'student',
                select: 'firstName lastName avatar campus placementCycle studentProfile.about',
                populate: [
                    { path: 'campus', select: 'name' },
                    { path: 'placementCycle', select: 'name year' }
                ]
            })
            .populate({
                path: 'job',
                select: 'title company salary location',
                populate: {
                    path: 'company',
                    select: 'name logo'
                }
            })
            .sort({ displayOrder: 1, featuredAt: -1 })
            .lean();

        let carouselData = [];

        if (featured && featured.length > 0) {
            // Use featured placements with custom images and quotes
            carouselData = featured.map(f => {
                const studentName = f.manualStudentName || (f.student ? `${f.student.firstName} ${f.student.lastName}` : 'Future Alumni');
                const role = f.manualJobTitle || f.job?.title || 'Professional';
                const companyName = f.manualCompanyName || f.job?.company?.name || 'Hiring Partner';
                const studentAvatar = f.manualStudentAvatar || f.student?.avatar || null;

                return {
                    studentName,
                    studentAvatar,
                    studentImage: f.heroImage || studentAvatar, // Use custom hero image if available
                    role,
                    companyName,
                    companyLogo: f.job?.company?.logo || null,
                    package: f.manualPackage || ((f.job?.salary && !isNaN(f.job.salary)) ? (f.job.salary / 100000).toFixed(2) : null),
                    campus: f.manualCampus || f.student?.campus?.name || null,
                    batch: f.manualBatch || (f.student?.placementCycle ? `${f.student.placementCycle.year || f.student.placementCycle.name}` : null),
                    quote: f.customQuote || f.student?.studentProfile?.about ||
                        `Thrilled to join ${companyName} as a ${role}. Navgurukul has been instrumental in my journey.`,
                    location: f.job?.location || null
                };
            });
        }

        // If no featured placements, fall back to recent accepted applications
        if (carouselData.length === 0) {
            const placements = await Application.find({
                status: 'accepted'
            })
                .populate({
                    path: 'student',
                    select: 'firstName lastName avatar campus placementCycle studentProfile.about',
                    populate: [
                        { path: 'campus', select: 'name' },
                        { path: 'placementCycle', select: 'name year' }
                    ]
                })
                .populate({
                    path: 'job',
                    select: 'title company salary location',
                    populate: {
                        path: 'company',
                        select: 'name logo'
                    }
                })
                .sort({ updatedAt: -1 })
                .limit(10)
                .lean();

            carouselData = placements
                .filter(p => p.student && p.job && p.job.company)
                .map(placement => ({
                    studentName: `${placement.student.firstName} ${placement.student.lastName}`,
                    studentAvatar: placement.student.avatar || null,
                    studentImage: placement.student.avatar || null,
                    role: placement.job.title,
                    companyName: placement.job.company.name,
                    companyLogo: placement.job.company.logo || null,
                    package: (placement.job.salary && !isNaN(placement.job.salary)) ? (placement.job.salary / 100000).toFixed(2) : null,
                    campus: placement.student.campus?.name || null,
                    batch: placement.student.placementCycle ? `${placement.student.placementCycle.year || placement.student.placementCycle.name}` : null,
                    quote: placement.student.studentProfile?.about ||
                        `Thrilled to join ${placement.job.company.name} as a ${placement.job.title}. Navgurukul has been instrumental in my journey.`,
                    location: placement.job.location || null
                }));
        }

        res.json({
            success: true,
            count: carouselData.length,
            placements: carouselData
        });

    } catch (error) {
        console.error('Error fetching placements:', error);
        res.json({
            success: true,
            count: 0,
            placements: [] // Return empty array on error to show default hero
        });
    }
});

/**
 * @swagger
 * /api/public/hiring-partners:
 *   get:
 *     summary: Get hiring partner logos and testimonials
 *     tags: [Public]
 *     responses:
 *       200:
 *         description: Partner data
 */
router.get('/hiring-partners', async (req, res) => {
    try {
        const Settings = require('../models/Settings');
        const settings = await Settings.getSettings();

        res.json({
            success: true,
            partners: settings.hiringPartners || [],
            testimonials: settings.testimonials || []
        });
    } catch (error) {
        console.error('Error fetching hiring partners:', error);
        res.json({
            success: true,
            partners: []
        });
    }
});

/**
 * @swagger
 * /api/public/leads:
 *   post:
 *     summary: Submit a contact inquiry
 *     tags: [Public]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - phone
 *               - company
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               company:
 *                 type: string
 *     responses:
 *       200:
 *         description: Inquiry submitted
 */
router.post('/leads', async (req, res) => {
    try {
        const Lead = require('../models/Lead');
        const { name, email, phone, company } = req.body;

        if (!name || !email || !phone || !company) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }

        const lead = new Lead({ name, email, phone, company });
        await lead.save();

        res.json({
            success: true,
            message: 'Inquiry received successfully'
        });
    } catch (error) {
        console.error('Error submitting lead:', error);
        res.status(500).json({ success: false, message: 'Failed to submit inquiry' });
    }
});

module.exports = router;
