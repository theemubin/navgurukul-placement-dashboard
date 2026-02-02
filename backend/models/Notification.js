const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: [
      'skill_approval_needed',
      'skill_approved',
      'skill_rejected',
      'new_job_posting',
      'application_update',
      'interview_scheduled',
      'feedback_received',
      'recommendation_received',
      'placement_confirmed',
      'profile_approval_needed',
      'profile_approved',
      'profile_approval_needed',
      'profile_approved',
      'profile_needs_revision',
      'self_application',
      'self_application_update',
      'self_application_verified',
      'job_question',
      'question_answered',
      'general'
    ],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  link: String,
  relatedEntity: {
    type: {
      type: String,
      enum: ['job', 'application', 'user', 'skill', 'self_application']
    },
    id: mongoose.Schema.Types.ObjectId
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: Date,
  // Discord Integration Tracking
  discord: {
    sent: {
      type: Boolean,
      default: false
    },
    sentAt: {
      type: Date
    },
    messageId: {
      type: String
    },      // Discord message ID
    threadId: {
      type: String
    },       // Discord thread ID (if applicable)
    channelId: {
      type: String
    },      // Discord channel ID where sent
    error: {
      type: String
    }           // Error message if failed to send
  }
}, {
  timestamps: true
});

// Index for efficient querying
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
