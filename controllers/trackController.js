const Track = require('../models/Track');
const User = require('../models/UserModel');
const bagsService = require('../services/bagsService');
const storageService = require('../services/storageService');
const { StatusCodes } = require('http-status-codes');

// @desc    Upload a new original track
// @route   POST /api/tracks
const createTrack = async (req, res) => {
  try {
    const { title, description, genre, bpm, key, tags } = req.body;
    const audioFile = req.file;

    if (!audioFile) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: 'Audio file required' });
    }

    // Upload to IPFS
    const metadata = storageService.generateMetadata({
      title,
      description,
      genre,
      type: 'parent_track',
      creator: req.user.username || req.user.walletAddress,
      bpm,
      key,
    });

    const { audioUrl, metadataUri } = await storageService.uploadToIPFS(
      audioFile.path,
      metadata
    );

    // Create token on Bags
    const { tokenAddress, txSignature } = await bagsService.createTrackToken(
      {
        title,
        description,
        genre,
        metadataUri,
      },
      req.user.walletAddress
    );

    // Save to database
    const track = await Track.create({
      title,
      description,
      creator: req.user._id,
      creatorWallet: req.user.walletAddress,
      audioUrl,
      genre,
      bpm,
      key,
      tags: tags?.split(','),
      bagsTokenAddress: tokenAddress,
      royaltySplit: {
        creator: 50,
        remixer: 45,
        platform: 5,
      },
    });

    // Update user role if needed
    if (req.user.role === 'remixer') {
      await User.findByIdAndUpdate(req.user._id, { role: 'both' });
    }

    res.status(StatusCodes.CREATED).json({
      success: true,
      track,
      bagsTx: txSignature,
    });
  } catch (error) {
    console.error('Create track error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
};

// @desc    Get all tracks with filters
// @route   GET /api/tracks
const getTracks = async (req, res) => {
  try {
    const { genre, sort, limit = 20, page = 1 } = req.query;

    const query = { status: 'published' };
    if (genre) query.genre = genre;

    const sortOptions = {};
    if (sort === 'trending') sortOptions['stats.trendingScore'] = -1;
    else if (sort === 'newest') sortOptions.createdAt = -1;
    else if (sort === 'volume') sortOptions['stats.totalVolume'] = -1;

    const tracks = await Track.find(query)
      .sort(sortOptions)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate('creator', 'username walletAddress creatorLevel profileImage');

    const total = await Track.countDocuments(query);

    res.status(StatusCodes.OK).json({
      tracks,
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

// @desc    Get single track with remixes
// @route   GET /api/tracks/:id
const getTrackById = async (req, res) => {
  try {
    const track = await Track.findById(req.params.id)
      .populate('creator', 'username walletAddress creatorLevel profileImage');

    if (!track) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: 'Track not found' });
    }

    // Get remixes for this track
    const remixes = await require('../models/Remix').find({
      parentTrack: track._id,
      status: 'active',
    })
      .sort({ 'stats.trendingScore': -1 })
      .populate('remixer', 'username walletAddress remixerLevel profileImage');

    // Update stats from Bags (optional - could be a background job)
    if (track.bagsTokenAddress) {
      const stats = await bagsService.getTokenStats(track.bagsTokenAddress);
      if (stats) {
        track.stats.totalVolume = stats.totalVolume;
        await track.save();
      }
    }

    res.status(StatusCodes.OK).json({
      track,
      remixes,
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
};

module.exports = {
  createTrack,
  getTracks,
  getTrackById,
};