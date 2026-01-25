const mongoose = require('mongoose');

const campusSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  location: {
    city: String,
    state: String,
    address: String
  },
  contactEmail: String,
  contactPhone: String,
  isActive: {
    type: Boolean,
    default: true
  },
  discordChannelId: {
    type: String,
    default: ''
  },
  placementTarget: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Campus', campusSchema);
