const mongoose = require('mongoose');

const postPlacementTrackingSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  application: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application',
    required: false,
    unique: true,
    sparse: true,
    index: true
  },
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: false,
    index: true
  },
  companyName: {
    type: String,
    default: ''
  },
  designation: {
    type: String,
    default: ''
  },
  employmentType: {
    type: String,
    enum: ['Internship', 'Paid Internship', 'Full-Time Placement'],
    default: ''
  },
  joiningDate: Date,
  internshipStartDate: Date,
  internshipEndDate: Date,
  hasFullTimeConversion: {
    type: Boolean,
    default: null
  },
  fullTimeConversionDate: Date,
  ctc: {
    type: Number,
    default: null
  },
  stipendOrSalary: {
    type: Number,
    default: null
  },
  currency: {
    type: String,
    default: 'INR'
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'archived'],
    default: 'active'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

postPlacementTrackingSchema.index({ student: 1, createdAt: -1 });
postPlacementTrackingSchema.index({ employmentType: 1 });
postPlacementTrackingSchema.index({ companyName: 1 });
postPlacementTrackingSchema.index({ joiningDate: 1 });

module.exports = mongoose.model('PostPlacementTracking', postPlacementTrackingSchema);