const express = require('express');
const router = express.Router();
const ScamReport = require('../models/ScamReport');
const { auth } = require('../middleware/auth');

// @route   POST /api/scam-reports
// @desc    Save a scam analysis report
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const {
      companyName,
      roleName,
      trustScore,
      verdict,
      summary,
      analysisData,
      inputData,
      isPublic = true,
      tags = []
    } = req.body;

    // Validate required fields
    if (!companyName || !roleName || trustScore === undefined || !verdict || !summary) {
      return res.status(400).json({
        message: 'Missing required fields: companyName, roleName, trustScore, verdict, summary'
      });
    }

    // Sanitize input data to remove sensitive information
    const sanitizedInputData = {
      ...inputData,
      originalText: inputData?.originalText?.substring(0, 5000) || '', // Truncate long text
      // Remove sensitive personal info patterns
      emailHeader: inputData?.emailHeader?.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]') || '',
      senderEmail: inputData?.senderEmail || '',
      companyUrl: inputData?.companyUrl || '',
      sourceType: inputData?.sourceType || 'text'
    };

    // Auto-generate tags based on analysis
    const autoTags = [];
    if (verdict === 'DANGER') autoTags.push('confirmed-scam');
    if (verdict === 'WARNING') autoTags.push('suspicious');
    if (trustScore < 30) autoTags.push('high-risk');
    if (analysisData?.redFlags?.some(flag => flag.includes('payment') || flag.includes('fee'))) {
      autoTags.push('payment-scam');
    }
    if (analysisData?.redFlags?.some(flag => flag.includes('WhatsApp') || flag.includes('Telegram'))) {
      autoTags.push('social-media-recruitment');
    }
    if (roleName.toLowerCase().includes('intern')) autoTags.push('internship');

    const report = new ScamReport({
      companyName: companyName.trim(),
      roleName: roleName.trim(),
      trustScore: Math.max(0, Math.min(100, parseInt(trustScore))),
      verdict,
      summary: summary.trim(),
      analysisData,
      inputData: sanitizedInputData,
      reportedBy: req.userId,
      isPublic,
      tags: [...new Set([...tags, ...autoTags])], // Remove duplicates
      communityVotes: { agree: 0, disagree: 0, helpful: 0 },
      voters: [],
      viewCount: 0
    });

    await report.save();

    res.status(201).json({
      message: 'Scam report saved successfully',
      reportId: report._id,
      isPublic: report.isPublic
    });

  } catch (error) {
    console.error('Save scam report error:', error);
    res.status(500).json({
      message: 'Failed to save scam report',
      error: error.message
    });
  }
});

// @route   GET /api/scam-reports/public
// @desc    Get public scam reports for browsing
// @access  Public
router.get('/public', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      verdict,
      company,
      tags,
      sortBy = 'recent' // recent, popular, trustScore
    } = req.query;

    const filters = {
      isPublic: true,
      status: 'active'
    };

    // Apply filters
    if (verdict && ['SAFE', 'WARNING', 'DANGER'].includes(verdict)) {
      filters.verdict = verdict;
    }

    if (company) {
      const searchRegex = { $regex: new RegExp(company, 'i') };
      filters.$or = [
        { companyName: searchRegex },
        { roleName: searchRegex },
        { summary: searchRegex }
      ];
    }

    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim());
      filters.tags = { $in: tagArray };
    }

    // Determine sort order
    let sortOptions = {};
    switch (sortBy) {
      case 'popular':
        sortOptions = { 'communityVotes.helpful': -1, createdAt: -1 };
        break;
      case 'trustScore':
        sortOptions = { trustScore: 1, createdAt: -1 }; // Low trust scores first (dangerous ones)
        break;
      default: // recent
        sortOptions = { createdAt: -1 };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [reports, totalReports] = await Promise.all([
      ScamReport.find(filters)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('reportedBy', 'firstName lastName campus studentId lastLogin')
        .select('-inputData.originalText -inputData.emailHeader') // Exclude sensitive input data
        .lean(),

      ScamReport.countDocuments(filters)
    ]);

    // Get popular tags for filtering
    const popularTags = await ScamReport.aggregate([
      { $match: { isPublic: true, status: 'active' } },
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]);

    res.json({
      reports,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalReports / parseInt(limit)),
        totalReports,
        hasNext: skip + reports.length < totalReports,
        hasPrev: parseInt(page) > 1
      },
      popularTags: popularTags.map(tag => ({
        name: tag._id,
        count: tag.count
      })),
      topMembers: await ScamReport.aggregate([
        { $match: { isPublic: true, status: 'active' } },
        { $group: { _id: '$reportedBy', postCount: { $sum: 1 } } },
        { $sort: { postCount: -1 } },
        { $limit: 6 },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user'
          }
        },
        { $unwind: '$user' },
        {
          $project: {
            name: '$user.name',
            postCount: 1,
            lastLogin: '$user.lastLogin'
          }
        }
      ])
    });

  } catch (error) {
    console.error('Get public reports error:', error);
    res.status(500).json({
      message: 'Failed to fetch public reports',
      error: error.message
    });
  }
});

// @route   GET /api/scam-reports/company/:companyName
// @desc    Get reports for a specific company
// @access  Public
router.get('/company/:companyName', async (req, res) => {
  try {
    const { companyName } = req.params;
    const { limit = 10 } = req.query;

    const [reports, stats] = await Promise.all([
      ScamReport.findByCompany(companyName, parseInt(limit)),
      ScamReport.getCompanyStats(companyName)
    ]);

    res.json({
      companyName,
      reports,
      stats: stats[0] || {
        totalReports: 0,
        avgTrustScore: 0,
        dangerCount: 0,
        warningCount: 0,
        safeCount: 0,
        totalHelpfulVotes: 0
      }
    });

  } catch (error) {
    console.error('Get company reports error:', error);
    res.status(500).json({
      message: 'Failed to fetch company reports',
      error: error.message
    });
  }
});

// @route   GET /api/scam-reports/:id
// @desc    Get a specific report by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const report = await ScamReport.findById(req.params.id)
      .populate('reportedBy', 'firstName lastName campus studentId')
      .populate('moderatedBy', 'firstName lastName role')
      .populate('comments.author', 'firstName lastName campus studentId');

    if (!report || (!report.isPublic && report.status !== 'active')) {
      return res.status(404).json({ message: 'Report not found' });
    }

    // Increment view count
    await ScamReport.findByIdAndUpdate(req.params.id, {
      $inc: { viewCount: 1 },
      lastViewed: new Date()
    });

    res.json(report);

  } catch (error) {
    console.error('Get report by ID error:', error);
    res.status(500).json({
      message: 'Failed to fetch report',
      error: error.message
    });
  }
});

// @route   POST /api/scam-reports/:id/vote
// @desc    Vote on a scam report (agree/disagree/helpful)
// @access  Private  
router.post('/:id/vote', auth, async (req, res) => {
  try {
    const { voteType } = req.body; // 'agree', 'disagree', 'helpful'

    if (!['agree', 'disagree', 'helpful'].includes(voteType)) {
      return res.status(400).json({ message: 'Invalid vote type' });
    }

    const report = await ScamReport.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    // Check if user already voted
    const existingVote = report.voters.find(
      voter => voter.userId.toString() === req.userId.toString()
    );

    if (existingVote) {
      // Update existing vote if different
      if (existingVote.voteType !== voteType) {
        // Remove old vote count
        report.communityVotes[existingVote.voteType] = Math.max(0, report.communityVotes[existingVote.voteType] - 1);

        // Add new vote count
        report.communityVotes[voteType] += 1;

        // Update voter record
        existingVote.voteType = voteType;
        existingVote.votedAt = new Date();
      } else {
        return res.status(400).json({ message: 'You have already voted this way' });
      }
    } else {
      // Add new vote
      report.communityVotes[voteType] += 1;
      report.voters.push({
        userId: req.userId,
        voteType,
        votedAt: new Date()
      });
    }

    await report.save();

    res.json({
      message: 'Vote recorded successfully',
      communityVotes: report.communityVotes
    });

  } catch (error) {
    console.error('Vote on report error:', error);
    res.status(500).json({
      message: 'Failed to record vote',
      error: error.message
    });
  }
});

// @route   DELETE /api/scam-reports/:id
// @desc    Delete a report (only by report author or admin)
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const report = await ScamReport.findById(req.params.id);

    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    // Check if user is the author or admin
    const user = await require('../models/User').findById(req.userId);
    if (report.reportedBy.toString() !== req.userId.toString() && user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this report' });
    }

    await ScamReport.findByIdAndDelete(req.params.id);

    res.json({ message: 'Report deleted successfully' });

  } catch (error) {
    console.error('Delete report error:', error);
    res.status(500).json({
      message: 'Failed to delete report',
      error: error.message
    });
  }
});

// @route   POST /api/scam-reports/:id/comments
// @desc    Add a comment to a report
// @access  Private
router.post('/:id/comments', auth, async (req, res) => {
  try {
    const { content, parentId } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ message: 'Comment content is required' });
    }

    if (content.length > 2000) {
      return res.status(400).json({ message: 'Comment too long. Maximum 2000 characters.' });
    }

    const report = await ScamReport.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    const newComment = {
      author: req.userId,
      content: content.trim(),
      parentId: parentId || null,
      createdAt: new Date()
    };

    report.comments.push(newComment);
    await report.save();

    // Populate the new comment with user data for immediate return
    await report.populate('comments.author', 'name studentId campus');
    const addedComment = report.comments[report.comments.length - 1];

    res.status(201).json({
      message: 'Comment added successfully',
      comment: addedComment
    });

  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({
      message: 'Failed to add comment',
      error: error.message
    });
  }
});

// @route   DELETE /api/scam-reports/:id/comments/:commentId
// @desc    Delete a comment (author or admin only)
// @access  Private
router.delete('/:id/comments/:commentId', auth, async (req, res) => {
  try {
    const report = await ScamReport.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    const user = await User.findById(req.userId);
    const comment = report.comments.id(req.params.commentId);

    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Check if user owns the comment or is admin
    if (comment.author.toString() !== req.userId.toString() && user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this comment' });
    }

    report.comments.id(req.params.commentId).remove();
    await report.save();

    res.json({ message: 'Comment deleted successfully' });

  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({
      message: 'Failed to delete comment',
      error: error.message
    });
  }
});

// @route   POST /api/scam-reports/:id/comments/:commentId/like
// @desc    Like/unlike a comment
// @access  Private
router.post('/:id/comments/:commentId/like', auth, async (req, res) => {
  try {
    const report = await ScamReport.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    const comment = report.comments.id(req.params.commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    const userId = req.userId;
    const hasLiked = comment.likes.users.includes(userId);

    if (hasLiked) {
      // Unlike the comment
      comment.likes.users.pull(userId);
      comment.likes.count = Math.max(0, comment.likes.count - 1);
    } else {
      // Like the comment
      comment.likes.users.push(userId);
      comment.likes.count += 1;
    }

    await report.save();

    res.json({
      message: hasLiked ? 'Comment unliked' : 'Comment liked',
      liked: !hasLiked,
      likeCount: comment.likes.count
    });

  } catch (error) {
    console.error('Like comment error:', error);
    res.status(500).json({
      message: 'Failed to like comment',
      error: error.message
    });
  }
});

module.exports = router;