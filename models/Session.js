const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
    },
    refreshToken: {
      type: String,
      unique: true,
      sparse: true,
    },
    
    // Session Info
    ipAddress: String,
    userAgent: String,
    deviceInfo: {
      browser: String,
      os: String,
      device: String,
      isMobile: Boolean,
    },
    location: {
      country: String,
      city: String,
      coordinates: {
        lat: Number,
        lon: Number,
      },
    },
    
    // Validity
    isValid: {
      type: Boolean,
      default: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    lastActivity: {
      type: Date,
      default: Date.now,
    },
    
    // Security
    isTrusted: {
      type: Boolean,
      default: false,
    },
    twoFactorVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Auto-expire sessions
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Session', sessionSchema);