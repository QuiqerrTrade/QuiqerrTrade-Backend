const Remix = require('../models/Remix');
const Transaction = require('../models/Transaction');
const bagsService = require('../services/bagsService');
const { StatusCodes } = require('http-status-codes');

// @desc    Buy remix tokens
// @route   POST /api/market/buy
const buyTokens = async (req, res) => {
  try {
    const { remixId, amount } = req.body;

    const remix = await Remix.findById(remixId);
    if (!remix) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: 'Remix not found' });
    }

    // Execute buy on Bags
    const { txSignature, price, totalCost } = await bagsService.buyTokens(
      remix.bagsTokenAddress,
      req.user.walletAddress,
      amount
    );

    // Record transaction
    const transaction = await Transaction.create({
      type: 'buy',
      remix: remixId,
      buyer: req.user._id,
      buyerWallet: req.user.walletAddress,
      amount,
      pricePerToken: price,
      totalValue: totalCost,
      solanaTxSignature: txSignature,
      feeBreakdown: {
        creatorFee: totalCost * (remix.royaltySplit.creator / 100),
        remixerFee: totalCost * (remix.royaltySplit.remixer / 100),
        platformFee: totalCost * (remix.royaltySplit.platform / 100),
      },
      status: 'confirmed',
    });

    // Update user earnings (simplified - actual earnings come from Bags royalties)
    // The Bags Income Assignment handles actual distribution

    res.status(StatusCodes.OK).json({
      success: true,
      transaction,
      txSignature,
    });
  } catch (error) {
    console.error('Buy error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
};

// @desc    Get user wallet/portfolio
// @route   GET /api/market/portfolio
const getPortfolio = async (req, res) => {
  try {
    // Get holdings from Bags
    const holdings = await bagsService.getUserHoldings(req.user.walletAddress);

    // Get transactions from our DB
    const transactions = await Transaction.find({
      $or: [
        { buyer: req.user._id },
        { seller: req.user._id },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('remix', 'title tokenSymbol');

    // Calculate PnL per holding
    const portfolio = holdings.map((holding) => {
      const buyTransactions = transactions.filter(
        (tx) => tx.type === 'buy' && tx.remix.bagsTokenAddress === holding.tokenAddress
      );
      const totalInvested = buyTransactions.reduce((sum, tx) => sum + tx.totalValue, 0);
      const currentValue = holding.amount * holding.currentPrice;

      return {
        token: holding.tokenAddress,
        symbol: holding.symbol,
        amount: holding.amount,
        currentPrice: holding.currentPrice,
        totalInvested,
        currentValue,
        pnl: currentValue - totalInvested,
        pnlPercentage: ((currentValue - totalInvested) / totalInvested) * 100,
      };
    });

    // Get creator/remixer earnings from Bags
    const earnings = await bagsService.getUserEarnings(req.user.walletAddress);

    res.status(StatusCodes.OK).json({
      portfolio,
      earnings,
      transactions,
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
};

module.exports = {
  buyTokens,
  getPortfolio,
};