const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['buy', 'sell', 'royalty_payout', 'platform_fee'],
      required: true,
    },
    remix: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Remix',
      required: true,
    },
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    buyerWallet: String,
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    sellerWallet: String,
    amount: {
      type: Number,
      required: true,
    },
    pricePerToken: Number,
    totalValue: Number,
    // On-chain transaction details
    solanaTxSignature: String,
    bagsTxId: String,
    // Fee breakdown
    feeBreakdown: {
      creatorFee: Number,
      remixerFee: Number,
      platformFee: Number,
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'failed'],
      default: 'pending',
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

module.exports = mongoose.model('Transaction', transactionSchema);