const mongoose = require('mongoose');

const playHistorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    contentType: {
      type: String,
      enum: ['track', 'remix'],
      required: true,
    },
    content: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'contentType',
    },
    playedAt: {
      type: Date,
      default: Date.now,
    },
    duration: Number, // Seconds played
    completed: {
      type: Boolean,
      default: false,
    },
    source: {
      type: String,
      enum: ['feed', 'profile', 'market', 'search', 'playlist', 'direct'],
    },
    device: String,
  },
  {
    timestamps: true,
  }
);

playHistorySchema.index({ user: 1, playedAt: -1 });
playHistorySchema.index({ content: 1, playedAt: -1 });

module.exports = mongoose.model('PlayHistory', playHistorySchema);