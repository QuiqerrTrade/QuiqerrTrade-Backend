const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    
    type: {
      type: String,
      enum: [
        'new_follower',
        'new_remix',
        'remix_milestone',
        'trade_executed',
        'price_alert',
        'earnings_update',
        'mention',
        'like',
        'comment',
        'badge_earned',
        'level_up',
        'kyc_update',
        'security_alert',
        'system',
      ],
      required: true,
    },
    
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    
    // Related data
    data: {
      actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      track: { type: mongoose.Schema.Types.ObjectId, ref: 'Track' },
      remix: { type: mongoose.Schema.Types.ObjectId, ref: 'Remix' },
      transaction: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
      amount: Number,
      url: String,
      metadata: mongoose.Schema.Types.Mixed,
    },
    
    // Delivery status
    read: {
      type: Boolean,
      default: false,
    },
    readAt: Date,
    
    delivered: {
      email: { type: Boolean, default: false },
      push: { type: Boolean, default: false },
      inApp: { type: Boolean, default: true },
    },
    
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    
    expiresAt: Date,
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 }); // Auto-delete after 30 days

module.exports = mongoose.model('Notification', notificationSchema);