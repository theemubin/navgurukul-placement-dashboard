const mongoose = require('mongoose');

const postPlacementDocumentSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  placement: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PostPlacementTracking',
    required: true,
    index: true
  },
  application: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application',
    required: false,
    index: true
  },
  documentType: {
    type: String,
    enum: ['OFFER_LETTER', 'INTERNSHIP_STIPEND_SLIP', 'FULL_TIME_SALARY_SLIP'],
    required: true
  },
  documentKey: {
    type: String,
    required: true
  },
  documentPeriod: {
    key: String,
    month: Number,
    year: Number,
    label: String
  },
  fileUrl: {
    type: String,
    required: true
  },
  storagePath: {
    type: String,
    required: true
  },
  originalName: String,
  mimeType: String,
  fileSize: Number,
  dueDate: Date,
  verificationStatus: {
    type: String,
    enum: ['Pending', 'Uploaded', 'Verified', 'Rejected'],
    default: 'Uploaded'
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verifiedAt: Date,
  rejectionReason: String,
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  replacedAt: Date
}, {
  timestamps: true
});

postPlacementDocumentSchema.index({ placement: 1, documentKey: 1 }, { unique: true });
postPlacementDocumentSchema.index({ student: 1, verificationStatus: 1 });

module.exports = mongoose.model('PostPlacementDocument', postPlacementDocumentSchema);