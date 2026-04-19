const User = require('../models/UserModel');
const Track = require('../models/Track');
const Remix = require('../models/Remix');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');

class LevelingService {
  constructor() {
    // XP thresholds for each level
    this.creatorLevels = {
      new_creator: { minXP: 0, maxXP: 100, name: 'New Creator' },
      rising_creator: { minXP: 100, maxXP: 500, name: 'Rising Creator' },
      viral_creator: { minXP: 500, maxXP: 2000, name: 'Viral Creator' },
      top_creator: { minXP: 2000, maxXP: Infinity, name: 'Top Creator' },
    };

    this.remixerLevels = {
      beginner: { minXP: 0, maxXP: 100, name: 'Beginner' },
      skilled: { minXP: 100, maxXP: 500, name: 'Skilled Remixer' },
      pro: { minXP: 500, maxXP: 2000, name: 'Pro Remixer' },
      elite: { minXP: 2000, maxXP: Infinity, name: 'Elite Remixer' },
    };

    this.traderLevels = {
      novice: { minVolume: 0, maxVolume: 1000, name: 'Novice Trader' },
      intermediate: { minVolume: 1000, maxVolume: 10000, name: 'Intermediate Trader' },
      advanced: { minVolume: 10000, maxVolume: 100000, name: 'Advanced Trader' },
      pro: { minVolume: 100000, maxVolume: 500000, name: 'Pro Trader' },
      whale: { minVolume: 500000, maxVolume: Infinity, name: 'Whale' },
    };

    // Badge definitions
    this.badges = {
      // Creator badges
      first_track: {
        name: 'First Track',
        description: 'Uploaded your first original track',
        icon: '🎵',
        rarity: 'common',
      },
      ten_tracks: {
        name: 'Prolific Creator',
        description: 'Uploaded 10 original tracks',
        icon: '📀',
        rarity: 'rare',
      },
      fifty_tracks: {
        name: 'Hit Factory',
        description: 'Uploaded 50 original tracks',
        icon: '💿',
        rarity: 'epic',
      },
      first_remix_received: {
        name: 'Remix Magnet',
        description: 'Someone created a remix of your track',
        icon: '🧲',
        rarity: 'common',
      },
      ten_remixes_received: {
        name: 'Remix Sensation',
        description: 'Your tracks have been remixed 10 times',
        icon: '🔥',
        rarity: 'rare',
      },
      volume_1k: {
        name: 'Rising Star',
        description: 'Your tracks generated $1,000 in trading volume',
        icon: '⭐',
        rarity: 'rare',
      },
      volume_10k: {
        name: 'Gold Record',
        description: 'Your tracks generated $10,000 in trading volume',
        icon: '🥇',
        rarity: 'epic',
      },
      volume_100k: {
        name: 'Platinum Record',
        description: 'Your tracks generated $100,000 in trading volume',
        icon: '💎',
        rarity: 'legendary',
      },
      viral_track: {
        name: 'Viral Hit',
        description: 'A track reached 100+ holders in 24 hours',
        icon: '🚀',
        rarity: 'epic',
      },

      // Remixer badges
      first_remix: {
        name: 'First Remix',
        description: 'Created your first remix',
        icon: '🔁',
        rarity: 'common',
      },
      ten_remixes: {
        name: 'Remix Machine',
        description: 'Created 10 remixes',
        icon: '🎛️',
        rarity: 'rare',
      },
      fifty_remixes: {
        name: 'Remix Legend',
        description: 'Created 50 remixes',
        icon: '🎚️',
        rarity: 'epic',
      },
      remix_volume_1k: {
        name: 'Remix Hustler',
        description: 'Your remixes generated $1,000 in volume',
        icon: '💸',
        rarity: 'rare',
      },
      remix_volume_10k: {
        name: 'Remix Mogul',
        description: 'Your remixes generated $10,000 in volume',
        icon: '💰',
        rarity: 'epic',
      },
      viral_remix: {
        name: 'Viral Remix',
        description: 'A remix reached 100+ holders in 24 hours',
        icon: '🌋',
        rarity: 'epic',
      },
      most_remixed_creator: {
        name: 'Creator\'s Favorite',
        description: 'Most remixed a specific creator\'s tracks',
        icon: '🤝',
        rarity: 'rare',
      },

      // Trader badges
      first_trade: {
        name: 'First Trade',
        description: 'Completed your first trade',
        icon: '📈',
        rarity: 'common',
      },
      ten_trades: {
        name: 'Active Trader',
        description: 'Completed 10 trades',
        icon: '📊',
        rarity: 'rare',
      },
      hundred_trades: {
        name: 'Market Maker',
        description: 'Completed 100 trades',
        icon: '🏦',
        rarity: 'epic',
      },
      profitable_trader: {
        name: 'Profit King',
        description: 'Achieved 50%+ profitable trades',
        icon: '👑',
        rarity: 'legendary',
      },
      diamond_hands: {
        name: 'Diamond Hands',
        description: 'Held a token for 30+ days',
        icon: '💎🙌',
        rarity: 'rare',
      },
      early_bird: {
        name: 'Early Bird',
        description: 'First 10 holders of a token',
        icon: '🐦',
        rarity: 'rare',
      },
    };

    // Achievements that grant XP
    this.achievements = {
      // Creator XP
      upload_track: { xp: 20, cooldown: null },
      track_gets_remixed: { xp: 30, cooldown: null },
      track_reaches_10_holders: { xp: 50, cooldown: null },
      track_reaches_100_holders: { xp: 200, cooldown: null },
      track_volume_100: { xp: 50, cooldown: null },
      track_volume_1000: { xp: 200, cooldown: null },
      track_volume_10000: { xp: 1000, cooldown: null },

      // Remixer XP
      create_remix: { xp: 25, cooldown: null },
      remix_gets_traded: { xp: 15, cooldown: null },
      remix_reaches_10_holders: { xp: 50, cooldown: null },
      remix_reaches_100_holders: { xp: 250, cooldown: null },
      remix_volume_100: { xp: 60, cooldown: null },
      remix_volume_1000: { xp: 250, cooldown: null },
      remix_volume_10000: { xp: 1200, cooldown: null },

      // Trader XP
      complete_trade: { xp: 10, cooldown: null },
      profitable_trade: { xp: 20, cooldown: null },
      trade_volume_100: { xp: 30, cooldown: null },
      trade_volume_1000: { xp: 100, cooldown: null },
      trade_volume_10000: { xp: 500, cooldown: null },

      // Social XP
      gain_follower: { xp: 5, cooldown: null },
      receive_like: { xp: 2, cooldown: null },
    };
  }

  /**
   * Initialize new user leveling data
   */
  async initializeNewUser(user) {
    user.creatorProfile = {
      level: 'new_creator',
      levelProgress: { currentXP: 0, nextLevelXP: 100, totalXP: 0 },
      totalTracks: 0,
      publishedTracks: 0,
      totalRemixesReceived: 0,
      totalVolume: 0,
      totalEarned: 0,
      badges: [],
      achievements: [],
    };

    user.remixerProfile = {
      level: 'beginner',
      levelProgress: { currentXP: 0, nextLevelXP: 100, totalXP: 0 },
      totalRemixes: 0,
      publishedRemixes: 0,
      totalVolume: 0,
      totalEarned: 0,
      badges: [],
      achievements: [],
    };

    user.traderProfile = {
      totalTrades: 0,
      totalVolume: 0,
      totalPnL: 0,
      winRate: 0,
      tradingLevel: 'novice',
    };

    await user.save();
    return user;
  }

  /**
   * Calculate creator level from XP
   */
  calculateCreatorLevel(user) {
    const xp = user.creatorProfile?.levelProgress?.totalXP || 0;
    
    for (const [level, threshold] of Object.entries(this.creatorLevels)) {
      if (xp >= threshold.minXP && xp < threshold.maxXP) {
        return {
          level,
          name: threshold.name,
          progress: {
            currentXP: xp,
            nextLevelXP: threshold.maxXP,
            percentage: Math.min(100, ((xp - threshold.minXP) / (threshold.maxXP - threshold.minXP)) * 100),
          },
        };
      }
    }
    
    return { level: 'new_creator', name: 'New Creator', progress: { currentXP: xp, nextLevelXP: 100, percentage: 0 } };
  }

  /**
   * Calculate remixer level from XP
   */
  calculateRemixerLevel(user) {
    const xp = user.remixerProfile?.levelProgress?.totalXP || 0;
    
    for (const [level, threshold] of Object.entries(this.remixerLevels)) {
      if (xp >= threshold.minXP && xp < threshold.maxXP) {
        return {
          level,
          name: threshold.name,
          progress: {
            currentXP: xp,
            nextLevelXP: threshold.maxXP,
            percentage: Math.min(100, ((xp - threshold.minXP) / (threshold.maxXP - threshold.minXP)) * 100),
          },
        };
      }
    }
    
    return { level: 'beginner', name: 'Beginner', progress: { currentXP: xp, nextLevelXP: 100, percentage: 0 } };
  }

  /**
   * Calculate trader level from volume
   */
  calculateTraderLevel(volume) {
    for (const [level, threshold] of Object.entries(this.traderLevels)) {
      if (volume >= threshold.minVolume && volume < threshold.maxVolume) {
        return { level, name: threshold.name };
      }
    }
    return { level: 'novice', name: 'Novice Trader' };
  }

  /**
   * Add XP to user
   */
  async addXP(user, type, role, amount = null) {
    const achievement = this.achievements[type];
    if (!achievement) return user;

    const xpAmount = amount || achievement.xp;
    
    if (role === 'creator' && user.creatorProfile) {
      const oldLevel = user.creatorProfile.level;
      user.creatorProfile.levelProgress.currentXP += xpAmount;
      user.creatorProfile.levelProgress.totalXP += xpAmount;
      
      const newLevelData = this.calculateCreatorLevel(user);
      user.creatorProfile.level = newLevelData.level;
      user.creatorProfile.levelProgress = newLevelData.progress;
      
      await user.save();
      
      // Check for level up
      if (oldLevel !== newLevelData.level) {
        await this.handleLevelUp(user, 'creator', oldLevel, newLevelData.level);
      }
      
      // Check for badges
      await this.checkAndAwardBadges(user, 'creator');
    }
    
    if (role === 'remixer' && user.remixerProfile) {
      const oldLevel = user.remixerProfile.level;
      user.remixerProfile.levelProgress.currentXP += xpAmount;
      user.remixerProfile.levelProgress.totalXP += xpAmount;
      
      const newLevelData = this.calculateRemixerLevel(user);
      user.remixerProfile.level = newLevelData.level;
      user.remixerProfile.levelProgress = newLevelData.progress;
      
      await user.save();
      
      if (oldLevel !== newLevelData.level) {
        await this.handleLevelUp(user, 'remixer', oldLevel, newLevelData.level);
      }
      
      await this.checkAndAwardBadges(user, 'remixer');
    }
    
    return user;
  }

  /**
   * Handle level up event
   */
  async handleLevelUp(user, role, oldLevel, newLevel) {
    const levelNames = role === 'creator' ? this.creatorLevels : this.remixerLevels;
    const newLevelName = levelNames[newLevel].name;
    
    // Create notification
    await Notification.create({
      user: user._id,
      type: 'level_up',
      title: `🎉 Level Up!`,
      message: `You've reached ${newLevelName} ${role}!`,
      data: { role, oldLevel, newLevel },
      priority: 'high',
    });
    
    // Send email notification
    const emailService = require('./emailService');
    await emailService.sendLevelUpEmail(user, role, newLevel);
    
    // Log achievement
    console.log(`🏆 User ${user._id} reached ${newLevelName} ${role}`);
  }

  /**
   * Check and award badges
   */
  async checkAndAwardBadges(user, role) {
    const earnedBadges = role === 'creator' 
      ? user.creatorProfile.badges.map(b => b.name)
      : user.remixerProfile.badges.map(b => b.name);
    
    const newBadges = [];
    
    if (role === 'creator') {
      // First track badge
      if (!earnedBadges.includes('First Track') && user.creatorProfile.totalTracks >= 1) {
        newBadges.push(this.badges.first_track);
      }
      
      // Ten tracks badge
      if (!earnedBadges.includes('Prolific Creator') && user.creatorProfile.totalTracks >= 10) {
        newBadges.push(this.badges.ten_tracks);
      }
      
      // Fifty tracks badge
      if (!earnedBadges.includes('Hit Factory') && user.creatorProfile.totalTracks >= 50) {
        newBadges.push(this.badges.fifty_tracks);
      }
      
      // Volume badges
      if (!earnedBadges.includes('Rising Star') && user.creatorProfile.totalVolume >= 1000) {
        newBadges.push(this.badges.volume_1k);
      }
      
      if (!earnedBadges.includes('Gold Record') && user.creatorProfile.totalVolume >= 10000) {
        newBadges.push(this.badges.volume_10k);
      }
      
      if (!earnedBadges.includes('Platinum Record') && user.creatorProfile.totalVolume >= 100000) {
        newBadges.push(this.badges.volume_100k);
      }
    }
    
    if (role === 'remixer') {
      // First remix badge
      if (!earnedBadges.includes('First Remix') && user.remixerProfile.totalRemixes >= 1) {
        newBadges.push(this.badges.first_remix);
      }
      
      // Ten remixes badge
      if (!earnedBadges.includes('Remix Machine') && user.remixerProfile.totalRemixes >= 10) {
        newBadges.push(this.badges.ten_remixes);
      }
      
      // Fifty remixes badge
      if (!earnedBadges.includes('Remix Legend') && user.remixerProfile.totalRemixes >= 50) {
        newBadges.push(this.badges.fifty_remixes);
      }
      
      // Volume badges
      if (!earnedBadges.includes('Remix Hustler') && user.remixerProfile.totalVolume >= 1000) {
        newBadges.push(this.badges.remix_volume_1k);
      }
      
      if (!earnedBadges.includes('Remix Mogul') && user.remixerProfile.totalVolume >= 10000) {
        newBadges.push(this.badges.remix_volume_10k);
      }
    }
    
    // Award new badges
    for (const badge of newBadges) {
      const badgeData = {
        ...badge,
        earnedAt: new Date(),
      };
      
      if (role === 'creator') {
        user.creatorProfile.badges.push(badgeData);
      } else {
        user.remixerProfile.badges.push(badgeData);
      }
      
      // Create notification
      await Notification.create({
        user: user._id,
        type: 'badge_earned',
        title: `🎖️ New Badge: ${badge.name}`,
        message: badge.description,
        data: { badge: badgeData },
        priority: 'medium',
      });
      
      // Send email
      const emailService = require('./emailService');
      await emailService.sendBadgeEarnedEmail(user, badgeData);
    }
    
    if (newBadges.length > 0) {
      await user.save();
    }
    
    return newBadges;
  }

  /**
   * Update creator stats after track upload
   */
  async onTrackUploaded(user, track) {
    user.creatorProfile.totalTracks += 1;
    user.creatorProfile.publishedTracks += 1;
    
    await this.addXP(user, 'upload_track', 'creator');
    await this.checkAndAwardBadges(user, 'creator');
    
    await user.save();
  }

  /**
   * Update remixer stats after remix creation
   */
  async onRemixCreated(user, remix, parentTrack) {
    user.remixerProfile.totalRemixes += 1;
    user.remixerProfile.publishedRemixes += 1;
    
    await this.addXP(user, 'create_remix', 'remixer');
    await this.checkAndAwardBadges(user, 'remixer');
    
    // Update parent track creator stats
    const creator = await User.findById(parentTrack.creator);
    if (creator) {
      creator.creatorProfile.totalRemixesReceived += 1;
      await this.addXP(creator, 'track_gets_remixed', 'creator');
      await this.checkAndAwardBadges(creator, 'creator');
      await creator.save();
    }
    
    await user.save();
  }

  /**
   * Update stats after trade
   */
  async onTradeCompleted(buyer, seller, remix, transaction) {
    // Update buyer
    if (buyer) {
      buyer.traderProfile.totalTrades += 1;
      buyer.traderProfile.totalVolume += transaction.totalValue;
      
      const newLevel = this.calculateTraderLevel(buyer.traderProfile.totalVolume);
      buyer.traderProfile.tradingLevel = newLevel.level;
      
      await buyer.save();
    }
    
    // Update remix stats
    remix.stats.totalVolume += transaction.totalValue;
    remix.stats.volume24h += transaction.totalValue;
    remix.stats.holders = await this.calculateHolders(remix._id);
    
    await remix.save();
    
    // Update remixer stats
    const remixer = await User.findById(remix.remixer);
    if (remixer) {
      remixer.remixerProfile.totalVolume += transaction.totalValue;
      remixer.remixerProfile.totalEarned += transaction.feeBreakdown.remixerFee;
      
      await this.addXP(remixer, 'remix_gets_traded', 'remixer');
      
      // Check volume milestones
      if (remixer.remixerProfile.totalVolume >= 1000) {
        await this.addXP(remixer, 'remix_volume_1000', 'remixer');
      }
      
      await remixer.save();
    }
    
    // Update creator stats
    const parentTrack = await Track.findById(remix.parentTrack).populate('creator');
    if (parentTrack?.creator) {
      const creator = await User.findById(parentTrack.creator);
      if (creator) {
        creator.creatorProfile.totalVolume += transaction.totalValue;
        creator.creatorProfile.totalEarned += transaction.feeBreakdown.creatorFee;
        
        await creator.save();
      }
    }
  }

  /**
   * Calculate number of holders for a remix
   */
  async calculateHolders(remixId) {
    const transactions = await Transaction.find({ remix: remixId });
    const holders = new Set();
    
    for (const tx of transactions) {
      if (tx.buyer) holders.add(tx.buyer.toString());
      if (tx.seller) holders.delete(tx.seller.toString());
    }
    
    return holders.size;
  }

  /**
   * Get user level progress
   */
  async getLevelProgress(user) {
    const creatorProgress = this.calculateCreatorLevel(user);
    const remixerProgress = this.calculateRemixerLevel(user);
    const traderProgress = this.calculateTraderLevel(user.traderProfile?.totalVolume || 0);
    
    return {
      creator: creatorProgress,
      remixer: remixerProgress,
      trader: traderProgress,
    };
  }

  /**
   * Get leaderboard
   */
  async getLeaderboard(type = 'creator', limit = 100) {
    const sortField = type === 'creator' 
      ? 'creatorProfile.totalVolume'
      : 'remixerProfile.totalVolume';
    
    const users = await User.find({
      [`${type}Profile.totalVolume`]: { $gt: 0 },
    })
      .sort({ [sortField]: -1 })
      .limit(limit)
      .select('username displayName profileImage walletAddress creatorProfile remixerProfile');
    
    return users.map((user, index) => ({
      rank: index + 1,
      user: {
        id: user._id,
        username: user.username,
        displayName: user.displayName,
        profileImage: user.profileImage,
      },
      volume: type === 'creator' ? user.creatorProfile.totalVolume : user.remixerProfile.totalVolume,
      level: type === 'creator' ? user.creatorProfile.level : user.remixerProfile.level,
    }));
  }
}

// Export singleton instance
module.exports = new LevelingService();