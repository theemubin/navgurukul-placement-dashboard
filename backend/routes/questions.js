const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Question = require('../models/Question');
const Job = require('../models/Job');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { auth, authorize } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Questions
 *   description: Q&A forum for job postings
 */

// Get questions for a company
/**
 * @swagger
 * /api/questions:
 *   get:
 *     summary: Get questions for a company
 *     tags: [Questions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: company
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of questions
 */
router.get('/', auth, async (req, res) => {
    try {
        const { company } = req.query;
        let query = { isDeleted: false };

        if (company) {
            query.companyName = { $regex: new RegExp(`^${company}$`, 'i') }; // Case-insensitive match 
        }

        // Find non-deleted questions
        const questions = await Question.find(query)
            .sort({ createdAt: -1 })
            .populate('job', 'title applicationDeadline'); // Optional: show which job it was asked on

        // Return plain objects
        const result = questions.map(q => ({
            _id: q._id,
            question: q.question,
            answer: q.answer,
            answeredAt: q.answeredAt,
            createdAt: q.createdAt,
            companyName: q.companyName,
            jobTitle: q.job?.title,
            jobDeadline: q.job?.applicationDeadline,
        }));

        res.json(result);
    } catch (error) {
        console.error('Get questions error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Post a question
/**
 * @swagger
 * /api/questions:
 *   post:
 *     summary: Post a new question for a job
 *     tags: [Questions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - jobId
 *               - question
 *             properties:
 *               jobId:
 *                 type: string
 *               question:
 *                 type: string
 *     responses:
 *       201:
 *         description: Question submitted
 */
router.post('/', auth, authorize('student'), [
    body('jobId').notEmpty(),
    body('question').trim().isLength({ min: 10 }).withMessage('Question must be at least 10 characters')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { jobId, question } = req.body;

        const job = await Job.findById(jobId);
        if (!job) {
            return res.status(404).json({ message: 'Job not found' });
        }

        const newQuestion = new Question({
            companyName: job.company.name,
            job: jobId,
            question,
            askedBy: req.userId
        });

        await newQuestion.save();

        // Notify coordinators
        // (This matches previous logic but centralized)
        const coordinators = await User.find({ role: 'coordinator', isActive: true });
        if (coordinators.length > 0) {
            const notifications = coordinators.map(c => ({
                recipient: c._id,
                type: 'job_question',
                title: 'New Forum Question',
                message: `New question for ${job.company.name} (Job: ${job.title})`,
                link: `/coordinator/jobs/${jobId}`, // Coordinators likely view via Job page still
                relatedEntity: { type: 'job', id: jobId }
            }));
            await Notification.insertMany(notifications);
        }

        res.status(201).json({ message: 'Question submitted successfully', question: newQuestion });
    } catch (error) {
        console.error('Post question error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Answer a question (Coordinator only)
/**
 * @swagger
 * /api/questions/{id}/answer:
 *   patch:
 *     summary: Answer a question (Coordinators/Managers)
 *     tags: [Questions]
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
 *             required:
 *               - answer
 *             properties:
 *               answer:
 *                 type: string
 *     responses:
 *       200:
 *         description: Answer submitted
 */
router.patch('/:id/answer', auth, authorize('coordinator', 'manager'), [
    body('answer').trim().notEmpty()
], async (req, res) => {
    try {
        const question = await Question.findById(req.params.id);
        if (!question) {
            return res.status(404).json({ message: 'Question not found' });
        }

        question.answer = req.body.answer;
        question.answeredBy = req.userId;
        question.answeredAt = new Date();
        await question.save();

        // Notify student
        const notification = new Notification({
            recipient: question.askedBy,
            type: 'question_answered',
            title: 'Question Answered',
            message: `Your question for ${question.companyName} has been answered.`,
            link: `/student/jobs/${question.job}`, // Link back to the job they asked on
            relatedEntity: { type: 'job', id: question.job }
        });
        await notification.save();

        res.json({ message: 'Answer submitted', question });
    } catch (error) {
        console.error('Answer question error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete a question (Coordinator only)
/**
 * @swagger
 * /api/questions/{id}:
 *   delete:
 *     summary: Delete a question (soft delete)
 *     tags: [Questions]
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
 *         description: Question deleted
 */
router.delete('/:id', auth, authorize('coordinator', 'manager'), async (req, res) => {
    try {
        const question = await Question.findById(req.params.id);
        if (!question) {
            return res.status(404).json({ message: 'Question not found' });
        }

        question.isDeleted = true;
        await question.save();

        res.json({ message: 'Question deleted' });
    } catch (error) {
        console.error('Delete question error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
