const mongoose = require('mongoose');

const placementCycleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true // e.g., "January 2025", "February 2025"
  },
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  year: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['upcoming', 'active', 'completed'],
    default: 'active'
  },
  description: String,
  targetPlacements: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Snapshot of students assigned during this cycle (preserved even after release at month end)
  snapshotStudents: [{
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    addedAt: Date,
    status: { type: String, enum: ['active', 'placed', 'released', 'dropout'], default: 'active' }
  }]
}, {
  timestamps: true
});

// Unique index for month/year combination (global cycles)
placementCycleSchema.index({ month: 1, year: 1 }, { unique: true });

// Virtual for formatted name
placementCycleSchema.virtual('formattedName').get(function() {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                  'July', 'August', 'September', 'October', 'November', 'December'];
  return `${months[this.month - 1]} ${this.year}`;
});

placementCycleSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('PlacementCycle', placementCycleSchema);
