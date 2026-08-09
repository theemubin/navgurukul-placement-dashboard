const mongoose = require('mongoose');

const RecalcJobSchema = new mongoose.Schema({
  school: { type: String },
  campus: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus', default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  total: { type: Number, default: 0 },
  processed: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'in_progress', 'completed', 'failed'], default: 'pending' },
  error: { type: String }
});

module.exports = mongoose.model('RecalcJob', RecalcJobSchema);
