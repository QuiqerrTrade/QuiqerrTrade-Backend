const mongoose = require('mongoose');

const trackSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: String,
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    creatorWallet: {
      type: String,
      required: true,
    },
    audioUrl: {
      type: String,
      required: true,
    },
    coverImageUrl: String,
    genre: {
      type: String,
      enum: ['afrobeats', 'amapiano', 'drill', 'hiphop', 'edm', 'pop', 'rnb', 'other'],
      required: true,
    },
    bpm: Number,
    key: String,
    duration: Number,
    // Bags token details
    bagsTokenAddress: {
      type: String,
      unique: true,
      sparse: true,
    },
    royaltySplit: {
      creator: { type: Number, default: 50 },
      remixer: { type: Number, default: 45 },
      platform: { type: Number, default: 5 },
    },
    stats: {
      totalVolume: { type: Number, default: 0 },
      remixCount: { type: Number, default: 0 },
      totalEarned: { type: Number, default: 0 },
      trendingScore: { type: Number, default: 0 },
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'published',
    },
    tags: [String],
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Index for discovery queries
trackSchema.index({ genre: 1, 'stats.trendingScore': -1 });
trackSchema.index({ createdAt: -1 });
trackSchema.index({ 'stats.totalVolume': -1 });

module.exports = mongoose.model('Track', trackSchema);