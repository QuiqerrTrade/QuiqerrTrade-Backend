const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
    },
    referrer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    
    // Campaign info
    campaign: {
      name: String,
      source: {
        type: String,
        enum: ['default', 'twitter', 'discord', 'email', 'event', 'influencer'],
        default: 'default',
      },
    },
    
    // Stats
    totalClicks: { type: Number, default: 0 },
    totalSignups: { type: Number, default: 0 },
    totalConversions: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 },
    
    // Rewards
    rewardTier: {
      signupBonus: { type: Number, default: 0 },
      conversionBonus: { type: Number, default: 0 },
      volumeShare: { type: Number, default: 0.01 }, // 1% of referred user's trading volume
    },
    
    // Referred users list
    referredUsers: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      signedUpAt: { type: Date, default: Date.now },
      converted: { type: Boolean, default: false },
      convertedAt: Date,
      totalVolume: { type: Number, default: 0 },
      earningsGenerated: { type: Number, default: 0 },
    }],
    
    status: {
      type: String,
      enum: ['active', 'paused', 'expired'],
      default: 'active',
    },
    expiresAt: Date,
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Referral', referralSchema);