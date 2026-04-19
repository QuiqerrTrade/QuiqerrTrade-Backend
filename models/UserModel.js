const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema(
  {
    // ============================================
    // CORE IDENTITY & AUTHENTICATION
    // ============================================
    walletAddress: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },
    email: {
      type: String,
      lowercase: true,
      sparse: true,
      unique: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Invalid email'],
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: String,
    emailVerificationExpires: Date,
    
    phoneNumber: {
      type: String,
      sparse: true,
      unique: true,
    },
    phoneVerified: {
      type: Boolean,
      default: false,
    },
    
    // OAuth connections
    connectedAccounts: {
      google: {
        id: String,
        email: String,
        verified: Boolean,
      },
      twitter: {
        id: String,
        username: String,
        verified: Boolean,
      },
      discord: {
        id: String,
        username: String,
        verified: Boolean,
      },
      github: {
        id: String,
        username: String,
        verified: Boolean,
      },
    },

    // ============================================
    // PERSONAL INFORMATION
    // ============================================
    personalInfo: {
      firstName: {
        type: String,
        trim: true,
        maxlength: 50,
      },
      lastName: {
        type: String,
        trim: true,
        maxlength: 50,
      },
      fullName: {
        type: String,
        trim: true,
        maxlength: 100,
      },
      dateOfBirth: {
        type: Date,
        validate: {
          validator: function(dob) {
            // Must be at least 13 years old
            const age = (Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
            return age >= 13;
          },
          message: 'User must be at least 13 years old',
        },
      },
      gender: {
        type: String,
        enum: ['male', 'female', 'non_binary', 'prefer_not_to_say', 'other'],
      },
      nationality: {
        type: String,
        maxlength: 50,
      },
      countryOfResidence: {
        type: String,
        maxlength: 50,
      },
      language: {
        type: String,
        default: 'en',
      },
      timezone: {
        type: String,
        default: 'UTC',
      },
    },

    // ============================================
    // ADDRESS INFORMATION
    // ============================================
    address: {
      street: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
    },

    // ============================================
    // KYC VERIFICATION STATUS
    // ============================================
    kycStatus: {
      type: String,
      enum: ['not_submitted', 'pending', 'approved', 'rejected', 'expired'],
      default: 'not_submitted',
    },
    kycLevel: {
      type: Number,
      enum: [0, 1, 2, 3],
      default: 0,
    },
    kycSubmittedAt: Date,
    kycApprovedAt: Date,
    kycExpiresAt: Date,
    kycRejectionReason: String,

    // ============================================
    // PROFILE INFORMATION
    // ============================================
    username: {
      type: String,
      unique: true,
      sparse: true,
      minlength: 3,
      maxlength: 30,
      match: [/^[a-zA-Z0-9_.]+$/, 'Username can only contain letters, numbers, dots, and underscores'],
    },
    displayName: {
      type: String,
      maxlength: 50,
    },
    bio: {
      type: String,
      maxlength: 500,
    },
    profileImage: {
      type: String,
      default: 'https://remix-market.com/default-avatar.png',
    },
    coverImage: {
      type: String,
      default: 'https://remix-market.com/default-cover.png',
    },
    website: {
      type: String,
      match: [/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/, 'Invalid URL'],
    },

    // ============================================
    // SOCIAL LINKS
    // ============================================
    socialLinks: {
      twitter: {
        type: String,
        match: [/^@?(\w){1,15}$/, 'Invalid Twitter handle'],
      },
      instagram: {
        type: String,
        match: [/^@?([a-zA-Z0-9_.])+$/, 'Invalid Instagram handle'],
      },
      tiktok: {
        type: String,
        match: [/^@?([a-zA-Z0-9_.])+$/, 'Invalid TikTok handle'],
      },
      youtube: String,
      soundcloud: String,
      spotify: String,
      discord: String,
      telegram: String,
    },

    // ============================================
    // ROLES & STATUS
    // ============================================
    role: {
      type: String,
      enum: ['listener', 'creator', 'remixer', 'both'],
      default: 'listener',
    },
    accountStatus: {
      type: String,
      enum: ['active', 'suspended', 'banned', 'deactivated', 'pending_deletion'],
      default: 'active',
    },
    accountTier: {
      type: String,
      enum: ['free', 'pro', 'premium'],
      default: 'free',
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verifiedBadge: {
      type: String,
      enum: ['none', 'blue', 'gold', 'diamond'],
      default: 'none',
    },
    suspensionReason: String,
    suspendedUntil: Date,
    deletedAt: Date,

    // ============================================
    // CREATOR PROFILE (MUSIC PRODUCERS)
    // ============================================
    creatorProfile: {
      // Leveling System
      level: {
        type: String,
        enum: ['new_creator', 'rising_creator', 'viral_creator', 'top_creator'],
        default: 'new_creator',
      },
      levelProgress: {
        currentXP: { type: Number, default: 0 },
        nextLevelXP: { type: Number, default: 100 },
        totalXP: { type: Number, default: 0 },
      },
      
      // Statistics
      totalTracks: { type: Number, default: 0 },
      publishedTracks: { type: Number, default: 0 },
      totalRemixesReceived: { type: Number, default: 0 },
      totalVolume: { type: Number, default: 0 }, // Total trading volume across all tracks
      totalEarned: { type: Number, default: 0 },
      highestVolumeTrack: { type: mongoose.Schema.Types.ObjectId, ref: 'Track' },
      
      // Genre Specialization
      primaryGenre: String,
      secondaryGenres: [String],
      genreExpertise: [{
        genre: String,
        trackCount: Number,
        averageVolume: Number,
      }],
      
      // Creative Identity
      artistName: String,
      recordLabel: String,
      yearsActive: Number,
      influences: [String],
      
      // Featured Content
      featuredTrack: { type: mongoose.Schema.Types.ObjectId, ref: 'Track' },
      pinnedTrack: { type: mongoose.Schema.Types.ObjectId, ref: 'Track' },
      
      // Achievements & Badges
      badges: [{
        name: String,
        description: String,
        icon: String,
        earnedAt: Date,
        rarity: {
          type: String,
          enum: ['common', 'rare', 'epic', 'legendary'],
        },
      }],
      achievements: [{
        type: {
          type: String,
          enum: ['first_track', 'first_remix', 'volume_milestone', 'viral_track', 'top_10', 'trending'],
        },
        milestone: Number,
        achievedAt: Date,
      }],
      
      // Analytics
      analytics: {
        monthlyListeners: { type: Number, default: 0 },
        totalStreams: { type: Number, default: 0 },
        followerGrowth: [{
          month: Date,
          count: Number,
        }],
        topCountries: [{
          country: String,
          percentage: Number,
        }],
      },
    },

    // ============================================
    // REMIXER PROFILE (REMIX ARTISTS)
    // ============================================
    remixerProfile: {
      // Leveling System
      level: {
        type: String,
        enum: ['beginner', 'skilled', 'pro', 'elite'],
        default: 'beginner',
      },
      levelProgress: {
        currentXP: { type: Number, default: 0 },
        nextLevelXP: { type: Number, default: 100 },
        totalXP: { type: Number, default: 0 },
      },
      
      // Statistics
      totalRemixes: { type: Number, default: 0 },
      publishedRemixes: { type: Number, default: 0 },
      totalVolume: { type: Number, default: 0 },
      totalEarned: { type: Number, default: 0 },
      highestVolumeRemix: { type: mongoose.Schema.Types.ObjectId, ref: 'Remix' },
      averageROI: { type: Number, default: 0 }, // Return on Investment for traders
      
      // Style Specialization
      primaryStyle: {
        type: String,
        enum: ['night', 'chill', 'club', 'acoustic', 'instrumental', 'spedup', 'slowed'],
      },
      styleExpertise: [{
        style: String,
        remixCount: Number,
        averageVolume: Number,
      }],
      
      // Remixer Identity
      remixerName: String,
      signatureStyle: String,
      preferredGenres: [String],
      
      // Featured Content
      featuredRemix: { type: mongoose.Schema.Types.ObjectId, ref: 'Remix' },
      
      // Achievements & Badges
      badges: [{
        name: String,
        description: String,
        icon: String,
        earnedAt: Date,
        rarity: {
          type: String,
          enum: ['common', 'rare', 'epic', 'legendary'],
        },
      }],
      achievements: [{
        type: {
          type: String,
          enum: ['first_remix', 'volume_milestone', 'viral_remix', 'top_remixer', 'most_remixed'],
        },
        milestone: Number,
        achievedAt: Date,
      }],
    },

    // ============================================
    // TRADER/LISTENER PROFILE
    // ============================================
    traderProfile: {
      totalTrades: { type: Number, default: 0 },
      totalVolume: { type: Number, default: 0 },
      totalPnL: { type: Number, default: 0 },
      winRate: { type: Number, default: 0 },
      favoriteGenres: [{
        genre: String,
        tradeCount: Number,
      }],
      tradingLevel: {
        type: String,
        enum: ['novice', 'intermediate', 'advanced', 'pro', 'whale'],
        default: 'novice',
      },
    },

    // ============================================
    // WALLET & FINANCIAL INFORMATION
    // ============================================
    wallets: [{
      address: {
        type: String,
        required: true,
        lowercase: true,
      },
      chain: {
        type: String,
        enum: ['solana', 'ethereum', 'polygon', 'bitcoin'],
        default: 'solana',
      },
      label: String,
      isPrimary: { type: Boolean, default: false },
      verified: { type: Boolean, default: false },
      addedAt: { type: Date, default: Date.now },
    }],
    
    // Earnings Summary
    earnings: {
      total: { type: Number, default: 0 },
      asCreator: { type: Number, default: 0 },
      asRemixer: { type: Number, default: 0 },
      asTrader: { type: Number, default: 0 },
      pendingWithdrawal: { type: Number, default: 0 },
      withdrawn: { type: Number, default: 0 },
    },
    
    // Withdrawal Settings
    withdrawalSettings: {
      autoWithdraw: { type: Boolean, default: false },
      minWithdrawAmount: { type: Number, default: 10 },
      preferredCurrency: {
        type: String,
        enum: ['USDC', 'SOL', 'USDT'],
        default: 'USDC',
      },
    },

    // ============================================
    // PREFERENCES & SETTINGS
    // ============================================
    preferences: {
      emailNotifications: {
        newRemix: { type: Boolean, default: true },
        tradeActivity: { type: Boolean, default: true },
        earningsUpdate: { type: Boolean, default: true },
        marketing: { type: Boolean, default: false },
        security: { type: Boolean, default: true },
      },
      pushNotifications: {
        enabled: { type: Boolean, default: true },
        newRemix: { type: Boolean, default: true },
        priceAlerts: { type: Boolean, default: true },
        mentions: { type: Boolean, default: true },
      },
      privacy: {
        profileVisibility: {
          type: String,
          enum: ['public', 'followers_only', 'private'],
          default: 'public',
        },
        showEarnings: { type: Boolean, default: false },
        showActivity: { type: Boolean, default: true },
        allowTagging: { type: Boolean, default: true },
      },
      theme: {
        type: String,
        enum: ['light', 'dark', 'system'],
        default: 'system',
      },
      currency: {
        type: String,
        enum: ['USD', 'EUR', 'GBP', 'JPY', 'NGN'],
        default: 'USD',
      },
    },

    // ============================================
    // SECURITY INFORMATION
    // ============================================
    security: {
      twoFactorEnabled: { type: Boolean, default: false },
      twoFactorMethod: {
        type: String,
        enum: ['authenticator', 'sms', 'email'],
      },
      twoFactorSecret: String,
      backupCodes: [String],
      lastPasswordChange: Date,
      lastLogin: Date,
      lastLoginIp: String,
      loginHistory: [{
        ip: String,
        userAgent: String,
        location: String,
        timestamp: Date,
      }],
      trustedDevices: [{
        deviceId: String,
        deviceName: String,
        lastUsed: Date,
        isTrusted: Boolean,
      }],
    },

    // ============================================
    // REFERRAL SYSTEM
    // ============================================
    referral: {
      referralCode: {
        type: String,
        unique: true,
        sparse: true,
      },
      referredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      referralCount: { type: Number, default: 0 },
      referralEarnings: { type: Number, default: 0 },
      referralTier: {
        type: String,
        enum: ['none', 'bronze', 'silver', 'gold', 'platinum'],
        default: 'none',
      },
    },

    // ============================================
    // SOCIAL GRAPH STATS
    // ============================================
    stats: {
      followers: { type: Number, default: 0 },
      following: { type: Number, default: 0 },
      likesReceived: { type: Number, default: 0 },
      totalPlays: { type: Number, default: 0 },
    },

    // ============================================
    // METADATA
    // ============================================
    metadata: {
      registrationIp: String,
      registrationUserAgent: String,
      registrationSource: {
        type: String,
        enum: ['web', 'mobile', 'api', 'referral', 'direct'],
      },
      lastActive: Date,
      deviceInfo: {
        os: String,
        browser: String,
        isMobile: Boolean,
      },
    },

    // ============================================
    // ADMIN NOTES
    // ============================================
    adminNotes: [{
      note: String,
      addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      addedAt: { type: Date, default: Date.now },
    }],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ============================================
// INDEXES
// ============================================
userSchema.index({ email: 1 });
userSchema.index({ 'personalInfo.fullName': 1 });
userSchema.index({ 'creatorProfile.level': 1 });
userSchema.index({ 'remixerProfile.level': 1 });
userSchema.index({ 'stats.followers': -1 });
userSchema.index({ kycStatus: 1 });
userSchema.index({ accountStatus: 1 });

// ============================================
// VIRTUALS
// ============================================
userSchema.virtual('age').get(function() {
  if (!this.personalInfo?.dateOfBirth) return null;
  return Math.floor((Date.now() - this.personalInfo.dateOfBirth) / (1000 * 60 * 60 * 24 * 365.25));
});

userSchema.virtual('isKYCVerified').get(function() {
  return this.kycStatus === 'approved' && this.kycLevel >= 2;
});

userSchema.virtual('fullLocation').get(function() {
  const parts = [];
  if (this.address?.city) parts.push(this.address.city);
  if (this.address?.state) parts.push(this.address.state);
  if (this.address?.country) parts.push(this.address.country);
  return parts.join(', ');
});

// ============================================
// METHODS
// ============================================
userSchema.methods.generateReferralCode = function() {
  const code = crypto.randomBytes(4).toString('hex').toUpperCase();
  this.referral.referralCode = code;
  return code;
};

userSchema.methods.updateLevel = async function() {
  const levelingService = require('../services/levelingService');
  
  if (this.creatorProfile) {
    const creatorLevel = await levelingService.calculateCreatorLevel(this);
    this.creatorProfile.level = creatorLevel.level;
    this.creatorProfile.levelProgress = creatorLevel.progress;
  }
  
  if (this.remixerProfile) {
    const remixerLevel = await levelingService.calculateRemixerLevel(this);
    this.remixerProfile.level = remixerLevel.level;
    this.remixerProfile.levelProgress = remixerLevel.progress;
  }
  
  await this.save();
};

userSchema.methods.softDelete = async function() {
  this.accountStatus = 'deactivated';
  this.deletedAt = new Date();
  this.email = `deleted_${Date.now()}_${this.email}`;
  this.username = `deleted_${Date.now()}_${this.username}`;
  await this.save();
};

// ============================================
// PRE-SAVE HOOKS
// ============================================
userSchema.pre('save', function(next) {
  // Set full name from first and last name
  if (this.personalInfo?.firstName || this.personalInfo?.lastName) {
    this.personalInfo.fullName = [
      this.personalInfo.firstName,
      this.personalInfo.lastName,
    ].filter(Boolean).join(' ');
  }
  
  // Update role based on activity
  if (this.creatorProfile?.totalTracks > 0 && this.remixerProfile?.totalRemixes > 0) {
    this.role = 'both';
  } else if (this.creatorProfile?.totalTracks > 0) {
    this.role = 'creator';
  } else if (this.remixerProfile?.totalRemixes > 0) {
    this.role = 'remixer';
  }
  
  next();
});

module.exports = mongoose.model('User', userSchema);