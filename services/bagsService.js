const bagsClient = require('../config/bags');
const { PLATFORM_WALLET_ADDRESS } = require('../config/solana');

class BagsService {
  /**
   * Create a parent track token on Bags
   */
  async createTrackToken(trackData, creatorWallet) {
    try {
      const metadata = {
        name: trackData.title,
        symbol: `TRK-${trackData.title.slice(0, 4).toUpperCase()}`,
        uri: trackData.metadataUri, // IPFS URI with full metadata
        description: trackData.description || `Original track by ${trackData.creator}`,
        attributes: {
          type: 'parent_track',
          genre: trackData.genre,
          creator: creatorWallet,
          createdAt: new Date().toISOString(),
        },
      };

      const result = await bagsClient.createToken({
        metadata,
        incomeAssignment: {
          recipients: [
            { address: creatorWallet, share: 50 },
            { address: PLATFORM_WALLET_ADDRESS, share: 5 },
            // Remixer share (45%) will be dynamically assigned per remix
          ],
          isPermanent: true,
        },
      });

      return {
        tokenAddress: result.tokenAddress,
        txSignature: result.txSignature,
      };
    } catch (error) {
      console.error('Error creating track token:', error);
      throw error;
    }
  }

  /**
   * Create a remix token on Bags with royalty assignment to original creator
   */
  async createRemixToken(remixData, remixerWallet, parentTrack) {
    try {
      const metadata = {
        name: remixData.title,
        symbol: `RMX-${remixData.title.slice(0, 4).toUpperCase()}`,
        uri: remixData.metadataUri,
        description: `Remix of "${parentTrack.title}" by ${remixData.remixer}`,
        attributes: {
          type: 'remix',
          parentTrackId: parentTrack._id.toString(),
          parentTrackAddress: parentTrack.bagsTokenAddress,
          genre: parentTrack.genre,
          remixer: remixerWallet,
          creator: parentTrack.creatorWallet,
          style: remixData.style,
          createdAt: new Date().toISOString(),
        },
      };

      const result = await bagsClient.createToken({
        metadata,
        incomeAssignment: {
          recipients: [
            { address: parentTrack.creatorWallet, share: 45 }, // Original creator
            { address: remixerWallet, share: 45 }, // Remixer
            { address: PLATFORM_WALLET_ADDRESS, share: 10 }, // Platform
          ],
          isPermanent: true,
        },
        // Initial liquidity pool (optional)
        initialLiquidity: {
          amount: 1000,
          price: 0.01,
        },
      });

      return {
        tokenAddress: result.tokenAddress,
        txSignature: result.txSignature,
      };
    } catch (error) {
      console.error('Error creating remix token:', error);
      throw error;
    }
  }

  /**
   * Get market stats for a token
   */
  async getTokenStats(tokenAddress) {
    try {
      const stats = await bagsClient.getTokenStats(tokenAddress);
      return {
        price: stats.currentPrice,
        volume24h: stats.volume24h,
        totalVolume: stats.totalVolume,
        holders: stats.holders,
        priceChange24h: stats.priceChange24h,
      };
    } catch (error) {
      console.error('Error fetching token stats:', error);
      return null;
    }
  }

  /**
   * Get all remix tokens for a parent track
   */
  async getRemixTokensByParent(parentTrackAddress) {
    try {
      const tokens = await bagsClient.getTokensByAttribute(
        'parentTrackAddress',
        parentTrackAddress
      );
      return tokens;
    } catch (error) {
      console.error('Error fetching remix tokens:', error);
      return [];
    }
  }

  /**
   * Execute a buy transaction
   */
  async buyTokens(tokenAddress, buyerWallet, amount) {
    try {
      const result = await bagsClient.buy({
        tokenAddress,
        buyerWallet,
        amount,
        slippage: 1, // 1% slippage tolerance
      });

      return {
        txSignature: result.txSignature,
        price: result.executedPrice,
        totalCost: result.totalCost,
      };
    } catch (error) {
      console.error('Error buying tokens:', error);
      throw error;
    }
  }

  /**
   * Get user's token holdings
   */
  async getUserHoldings(walletAddress) {
    try {
      const holdings = await bagsClient.getUserHoldings(walletAddress);
      return holdings;
    } catch (error) {
      console.error('Error fetching user holdings:', error);
      return [];
    }
  }
}

module.exports = new BagsService();