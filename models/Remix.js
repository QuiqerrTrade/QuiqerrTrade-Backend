const mongoose = require('mongoose');

const remixSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: String,
    parentTrack: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Track',
      required: true,
    },
    remixer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    remixerWallet: {
      type: String,
      required: true,
    },
    audioUrl: {
      type: String,
      required: true,
    },
    // Bags token details for this remix
    bagsTokenAddress: {
      type: String,
      unique: true,
      sparse: true,
    },
    tokenSymbol: String,
    // Inherited royalty split from parent track
    royaltySplit: {
      creator: Number,
      remixer: Number,
      platform: Number,
    },
    stats: {
      currentPrice: { type: Number, default: 0 },
      volume24h: { type: Number, default: 0 },
      totalVolume: { type: Number, default: 0 },
      holders: { type: Number, default: 0 },
      priceChange24h: { type: Number, default: 0 },
      trendingScore: { type: Number, default: 0 },
    },
    style: {
      type: String,
      enum: ['night', 'chill', 'club', 'acoustic', 'instrumental', 'spedup', 'slowed'],
    },
    tags: [String],
    aiPrediction: {
      viralPotential: { type: Number, min: 0, max: 100 },
      suggestedAction: String,
      lastUpdated: Date,
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'delisted'],
      default: 'active',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Index for market feed queries
remixSchema.index({ 'stats.trendingScore': -1 });
remixSchema.index({ 'stats.volume24h': -1 });
remixSchema.index({ createdAt: -1 });
remixSchema.index({ parentTrack: 1, 'stats.trendingScore': -1 });

module.exports = mongoose.model('Remix', remixSchema);