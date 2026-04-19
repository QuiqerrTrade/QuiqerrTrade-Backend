const User = require('../models/UserModel');
const Track = require('../models/Track');
const Remix = require('../models/Remix');
const Follow = require('../models/Follow');
const Like = require('../models/Like');
const PlayHistory = require('../models/PlayHistory');
const Transaction = require('../models/Transaction');
const { StatusCodes } = require('http-status-codes');
const levelingService = require('../services/levelingService');
const emailService = require('../services/emailService');

// ============================================
// PROFILE MANAGEMENT
// ============================================

// @desc    Get current user profile
// @route   GET /api/users/me
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password -security -emailVerificationToken')
      .populate('creatorProfile.featuredTrack')
      .populate('remixerProfile.featuredRemix');
    
    // Get real-time stats
    const [followersCount, followingCount, likesCount] = await Promise.all([
      Follow.countDocuments({ following: user._id }),
      Follow.countDocuments({ follower: user._id }),
      Like.countDocuments({ 
        targetType: { $in: ['track', 'remix'] },
        target: { 
          $in: [
            ...(await Track.find({ creator: user._id }).distinct('_id')),
            ...(await Remix.find({ remixer: user._id }).distinct('_id')),
          ]
        }
      }),
    ]);
    
    user.stats.followers = followersCount;
    user.stats.following = followingCount;
    user.stats.likesReceived = likesCount;
    
    // Calculate level progress
    if (user.creatorProfile) {
      user.creatorProfile.levelProgress = levelingService.calculateCreatorProgress(user);
    }
    if (user.remixerProfile) {
      user.remixerProfile.levelProgress = levelingService.calculateRemixerProgress(user);
    }
    
    res.status(StatusCodes.OK).json({ user });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
};

// @desc    Get user by ID or username
// @route   GET /api/users/:identifier
const getUserByIdentifier = async (req, res) => {
  try {
    const { identifier } = req.params;
    
    const query = identifier.match(/^[0-9a-fA-F]{24}$/) 
      ? { _id: identifier }
      : { username: identifier };
    
    const user = await User.findOne(query)
      .select('-password -email -security -emailVerificationToken')
      .populate('creatorProfile.featuredTrack')
      .populate('remixerProfile.featuredRemix');
    
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: 'User not found' });
    }
    
    // Check privacy settings
    if (user.preferences.privacy.profileVisibility === 'private' && 
        (!req.user || req.user._id.toString() !== user._id.toString())) {
      return res.status(StatusCodes.FORBIDDEN).json({ 
        error: 'This profile is private' 
      });
    }
    
    // Get public stats
    const [followersCount, followingCount, tracks, remixes] = await Promise.all([
      Follow.countDocuments({ following: user._id }),
      Follow.countDocuments({ follower: user._id }),
      Track.find({ creator: user._id, status: 'published' })
        .sort({ createdAt: -1 })
        .limit(10),
      Remix.find({ remixer: user._id, status: 'active' })
        .sort({ createdAt: -1 })
        .limit(10),
    ]);
    
    user.stats.followers = followersCount;
    user.stats.following = followingCount;
    
    // Check if current user is following
    let isFollowing = false;
    if (req.user) {
      const follow = await Follow.findOne({
        follower: req.user._id,
        following: user._id,
      });
      isFollowing = !!follow;
    }
    
    res.status(StatusCodes.OK).json({
      user,
      tracks,
      remixes,
      isFollowing,
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
};

// @desc    Update user profile
// @route   PATCH /api/users/me
const updateProfile = async (req, res) => {
  try {
    const allowedUpdates = [
      'username',
      'displayName',
      'bio',
      'profileImage',
      'coverImage',
      'website',
      'personalInfo.firstName',
      'personalInfo.lastName',
      'personalInfo.gender',
      'personalInfo.nationality',
      'personalInfo.countryOfResidence',
      'personalInfo.language',
      'personalInfo.timezone',
      'address',
      'socialLinks',
      'preferences',
      'creatorProfile.artistName',
      'creatorProfile.primaryGenre',
      'creatorProfile.influences',
      'remixerProfile.remixerName',
      'remixerProfile.signatureStyle',
      'remixerProfile.primaryStyle',
    ];
    
    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });
    
    // Check username uniqueness
    if (updates.username) {
      const existing = await User.findOne({ 
        username: updates.username,
        _id: { $ne: req.user._id },
      });
      if (existing) {
        return res.status(StatusCodes.BAD_REQUEST).json({ 
          error: 'Username already taken' 
        });
      }
    }
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password -security');
    
    res.status(StatusCodes.OK).json({ user });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
};

// @desc    Update email
// @route   PATCH /api/users/me/email
const updateEmail = async (req, res) => {
  try {
    const { newEmail, password } = req.body;
    
    // Verify password
    const user = await User.findById(req.user._id).select('+password');
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(StatusCodes.UNAUTHORIZED).json({ 
        error: 'Invalid password' 
      });
    }
    
    // Check if email exists
    const existing = await User.findOne({ email: newEmail });
    if (existing) {
      return res.status(StatusCodes.BAD_REQUEST).json({ 
        error: 'Email already in use' 
      });
    }
    
    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    
    user.email = newEmail;
    user.emailVerified = false;
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();
    
    // Send verification email
    await emailService.sendVerificationEmail(user, verificationToken);
    
    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Email updated. Please verify your new email.',
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
};

// @desc    Change password
// @route   PATCH /api/users/me/password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    const user = await User.findById(req.user._id).select('+password');
    
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.status(StatusCodes.UNAUTHORIZED).json({ 
        error: 'Current password is incorrect' 
      });
    }
    
    user.password = await bcrypt.hash(newPassword, 10);
    user.security.lastPasswordChange = new Date();
    await user.save();
    
    // Invalidate all other sessions
    await Session.updateMany(
      { user: user._id, _id: { $ne: req.session._id } },
      { isValid: false }
    );
    
    // Send security notification
    await emailService.sendSecurityAlert(user, 'Password changed');
    
    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
};

// @desc    Delete account
// @route   DELETE /api/users/me
const deleteAccount = async (req, res) => {
  try {
    const { password, confirmation } = req.body;
    
    if (confirmation !== 'DELETE') {
      return res.status(StatusCodes.BAD_REQUEST).json({ 
        error: 'Please type DELETE to confirm' 
      });
    }
    
    const user = await User.findById(req.user._id).select('+password');
    
    if (user.password) {
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ 
          error: 'Invalid password' 
        });
      }
    }
    
    // Soft delete
    await user.softDelete();
    
    // Invalidate all sessions
    await Session.updateMany(
      { user: user._id },
      { isValid: false }
    );
    
    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Account scheduled for deletion',
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
};

// ============================================
// CREATOR DASHBOARD
// ============================================

// @desc    Get creator dashboard stats
// @route   GET /api/users/me/creator-stats
const getCreatorStats = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const [
      tracks,
      totalRemixes,
      totalVolume,
      totalEarned,
      recentTransactions,
      topTracks,
      monthlyStats,
    ] = await Promise.all([
      Track.find({ creator: userId }).select('title stats createdAt'),
      Remix.countDocuments({ 
        parentTrack: { $in: await Track.find({ creator: userId }).distinct('_id') }
      }),
      Transaction.aggregate([
        { $match: { type: 'buy', 'feeBreakdown.creatorFee': { $gt: 0 } } },
        { $lookup: { from: 'remixes', localField: 'remix', foreignField: '_id', as: 'remix' } },
        { $unwind: '$remix' },
        { $lookup: { from: 'tracks', localField: 'remix.parentTrack', foreignField: '_id', as: 'track' } },
        { $unwind: '$track' },
        { $match: { 'track.creator': userId } },
        { $group: { _id: null, total: { $sum: '$totalValue' } } },
      ]),
      User.findById(userId).select('earnings'),
      Transaction.find({ 'feeBreakdown.creatorFee': { $gt: 0 } })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('remix', 'title'),
      Track.find({ creator: userId })
        .sort({ 'stats.totalVolume': -1 })
        .limit(5)
        .select('title stats'),
      Transaction.aggregate([
        { $match: { createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
        { $lookup: { from: 'remixes', localField: 'remix', foreignField: '_id', as: 'remix' } },
        { $unwind: '$remix' },
        { $lookup: { from: 'tracks', localField: 'remix.parentTrack', foreignField: '_id', as: 'track' } },
        { $unwind: '$track' },
        { $match: { 'track.creator': userId } },
        { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          volume: { $sum: '$totalValue' },
          trades: { $sum: 1 },
        } },
        { $sort: { _id: 1 } },
      ]),
    ]);
    
    res.status(StatusCodes.OK).json({
      overview: {
        totalTracks: tracks.length,
        publishedTracks: tracks.filter(t => t.status === 'published').length,
        totalRemixesReceived: totalRemixes,
        totalVolume: totalVolume[0]?.total || 0,
        totalEarned: totalEarned?.earnings?.asCreator || 0,
      },
      recentTransactions,
      topTracks,
      monthlyStats,
      level: req.user.creatorProfile,
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
};

// ============================================
// REMIXER DASHBOARD
// ============================================

// @desc    Get remixer dashboard stats
// @route   GET /api/users/me/remixer-stats
const getRemixerStats = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const [
      remixes,
      totalVolume,
      totalEarned,
      recentTransactions,
      topRemixes,
      styleBreakdown,
    ] = await Promise.all([
      Remix.find({ remixer: userId }).select('title stats style createdAt'),
      Transaction.aggregate([
        { $match: { 'feeBreakdown.remixerFee': { $gt: 0 } } },
        { $lookup: { from: 'remixes', localField: 'remix', foreignField: '_id', as: 'remix' } },
        { $unwind: '$remix' },
        { $match: { 'remix.remixer': userId } },
        { $group: { _id: null, total: { $sum: '$totalValue' } } },
      ]),
      User.findById(userId).select('earnings'),
      Transaction.find({ 'feeBreakdown.remixerFee': { $gt: 0 } })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('remix', 'title'),
      Remix.find({ remixer: userId })
        .sort({ 'stats.totalVolume': -1 })
        .limit(5)
        .select('title stats style'),
      Remix.aggregate([
        { $match: { remixer: userId } },
        { $group: {
          _id: '$style',
          count: { $sum: 1 },
          totalVolume: { $sum: '$stats.totalVolume' },
        } },
      ]),
    ]);
    
    res.status(StatusCodes.OK).json({
      overview: {
        totalRemixes: remixes.length,
        publishedRemixes: remixes.filter(r => r.status === 'active').length,
        totalVolume: totalVolume[0]?.total || 0,
        totalEarned: totalEarned?.earnings?.asRemixer || 0,
        averageROI: remixes.length > 0 
          ? (totalVolume[0]?.total || 0) / remixes.length 
          : 0,
      },
      recentTransactions,
      topRemixes,
      styleBreakdown,
      level: req.user.remixerProfile,
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
};

// ============================================
// FOLLOW SYSTEM
// ============================================

// @desc    Follow a user
// @route   POST /api/users/:id/follow
const followUser = async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id);
    
    if (!targetUser) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: 'User not found' });
    }
    
    if (targetUser._id.equals(req.user._id)) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: 'Cannot follow yourself' });
    }
    
    const existingFollow = await Follow.findOne({
      follower: req.user._id,
      following: targetUser._id,
    });
    
    if (existingFollow) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: 'Already following' });
    }
    
    const follow = await Follow.create({
      follower: req.user._id,
      following: targetUser._id,
      status: targetUser.preferences.privacy.profileVisibility === 'public' 
        ? 'accepted' 
        : 'pending',
    });
    
    // Update follower counts
    await User.findByIdAndUpdate(req.user._id, { $inc: { 'stats.following': 1 } });
    await User.findByIdAndUpdate(targetUser._id, { $inc: { 'stats.followers': 1 } });
    
    // Create notification
    if (follow.status === 'accepted') {
      await Notification.create({
        user: targetUser._id,
        type: 'new_follower',
        title: 'New Follower',
        message: `${req.user.displayName || req.user.username || 'Someone'} started following you`,
        data: { actor: req.user._id },
      });
    }
    
    res.status(StatusCodes.CREATED).json({
      success: true,
      status: follow.status,
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
};

// @desc    Unfollow a user
// @route   DELETE /api/users/:id/follow
const unfollowUser = async (req, res) => {
  try {
    const result = await Follow.findOneAndDelete({
      follower: req.user._id,
      following: req.params.id,
    });
    
    if (!result) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: 'Not following this user' });
    }
    
    await User.findByIdAndUpdate(req.user._id, { $inc: { 'stats.following': -1 } });
    await User.findByIdAndUpdate(req.params.id, { $inc: { 'stats.followers': -1 } });
    
    res.status(StatusCodes.OK).json({ success: true });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
};

// @desc    Get followers list
// @route   GET /api/users/:id/followers
const getFollowers = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const followers = await Follow.find({ 
      following: req.params.id,
      status: 'accepted',
    })
      .populate('follower', 'username displayName profileImage creatorProfile.level remixerProfile.level')
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .sort({ createdAt: -1 });
    
    const total = await Follow.countDocuments({ 
      following: req.params.id,
      status: 'accepted',
    });
    
    res.status(StatusCodes.OK).json({
      followers: followers.map(f => f.follower),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
};

// @desc    Get following list
// @route   GET /api/users/:id/following
const getFollowing = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const following = await Follow.find({ 
      follower: req.params.id,
      status: 'accepted',
    })
      .populate('following', 'username displayName profileImage creatorProfile.level remixerProfile.level')
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .sort({ createdAt: -1 });
    
    const total = await Follow.countDocuments({ 
      follower: req.params.id,
      status: 'accepted',
    });
    
    res.status(StatusCodes.OK).json({
      following: following.map(f => f.following),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
};

module.exports = {
  getMe,
  getUserByIdentifier,
  updateProfile,
  updateEmail,
  changePassword,
  deleteAccount,
  getCreatorStats,
  getRemixerStats,
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
};