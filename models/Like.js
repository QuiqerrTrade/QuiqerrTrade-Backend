const mongoose = require('mongoose');

const likeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    targetType: {
      type: String,
      enum: ['track', 'remix', 'comment'],
      required: true,
    },
    target: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'targetType',
    },
    likedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for unique likes
likeSchema.index({ user: 1, targetType: 1, target: 1 }, { unique: true });
likeSchema.index({ targetType: 1, target: 1 });

module.exports = mongoose.model('Like', likeSchema);