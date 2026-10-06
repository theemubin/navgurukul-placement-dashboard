const mongoose = require('mongoose');

const dailyTrackerSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  date: {
    type: String,
    required: true,
    match: /^\d{4}-\d{2}-\d{2}$/,
    index: true
  },
  projectName: {
    type: String,
    required: true,
    trim: true
  },
  tasksPerformed: {
    type: String,
    required: true,
    trim: true
  },
  challengesFaced: {
    type: String,
    default: '',
    trim: true
  },
  resolution: {
    type: String,
    default: '',
    trim: true
  },
  challengeStatus: {
    type: String,
    enum: ['No Challenge', 'Resolved', 'Partially Resolved', 'Unresolved'],
    default: 'No Challenge'
  },
  supportRequired: {
    type: String,
    default: '',
    trim: true
  },
  additionalNotes: {
    type: String,
    default: '',
    trim: true
  }
}, {
  timestamps: true
});

dailyTrackerSchema.index({ student: 1, date: 1 }, { unique: true });
dailyTrackerSchema.index({ student: 1, createdAt: -1 });

module.exports = mongoose.model('DailyTracker', dailyTrackerSchema);
