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
      enum: ['job', 'application', 'user', 'skill']
    },
    id: mongoose.Schema.Types.ObjectId
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: Date
}, {
  timestamps: true
});

// Index for efficient querying
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
