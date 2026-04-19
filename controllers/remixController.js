const Remix = require('../models/Remix');
const Track = require('../models/Track');
const User = require('../models/UserModel');
const bagsService = require('../services/bagsService');
const storageService = require('../services/storageService');
const aiService = require('../services/aiService');
const { StatusCodes } = require('http-status-codes');

// @desc    Create a remix and mint token
// @route   POST /api/remixes
const createRemix = async (req, res) => {
  try {
    const { title, description, parentTrackId, style, tags } = req.body;
    const audioFile = req.file;

    if (!audioFile) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: 'Audio file required' });
    }

    // Get parent track
    const parentTrack = await Track.findById(parentTrackId);
    if (!parentTrack) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: 'Parent track not found' });
    }

    // Upload to IPFS
    const metadata = storageService.generateMetadata({
      title,
      description,
      genre: parentTrack.genre,
      type: 'remix',
      creator: req.user.username || req.user.walletAddress,
    });

    const { audioUrl, metadataUri } = await storageService.uploadToIPFS(
      audioFile.path,
      metadata
    );

    // Create remix token on Bags
    const { tokenAddress, txSignature } = await bagsService.createRemixToken(
      {
        title,
        description,
        metadataUri,
        style,
      },
      req.user.walletAddress,
      parentTrack
    );

    // Get AI prediction
    const aiPrediction = await aiService.predictViralPotential(
      { style },
      parentTrack
    );

    // Save remix to database
    const remix = await Remix.create({
      title,
      description,
      parentTrack: parentTrackId,
      remixer: req.user._id,
      remixerWallet: req.user.walletAddress,
      audioUrl,
      bagsTokenAddress: tokenAddress,
      tokenSymbol: `RMX-${title.slice(0, 4).toUpperCase()}`,
      royaltySplit: {
        creator: 45,
        remixer: 45,
        platform: 10,
      },
      style,
      tags: tags?.split(','),
      aiPrediction: {
        viralPotential: aiPrediction.viralPotential,
        suggestedAction: aiPrediction.suggestedAction,
        lastUpdated: new Date(),
      },
    });

    // Update parent track remix count
    parentTrack.stats.remixCount += 1;
    await parentTrack.save();

    // Update user level if needed
    if (req.user.role === 'creator') {
      await User.findByIdAndUpdate(req.user._id, { role: 'both' });
    }

    res.status(StatusCodes.CREATED).json({
      success: true,
      remix,
      bagsTx: txSignature,
      aiPrediction,
    });
  } catch (error) {
    console.error('Create remix error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
};

// @desc    Get remix market feed
// @route   GET /api/remixes/market
const getMarketFeed = async (req, res) => {
  try {
    const { filter, limit = 20, page = 1 } = req.query;

    const query = { status: 'active' };
    const sortOptions = {};

    if (filter === 'trending') {
      sortOptions['stats.trendingScore'] = -1;
    } else if (filter === 'new') {
      sortOptions.createdAt = -1;
    } else if (filter === 'gainers') {
      sortOptions['stats.priceChange24h'] = -1;
    } else {
      sortOptions['stats.volume24h'] = -1;
    }

    const remixes = await Remix.find(query)
      .sort(sortOptions)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate('remixer', 'username walletAddress remixerLevel profileImage')
      .populate('parentTrack', 'title creatorWallet genre');

    // Update stats from Bags for each remix
    for (const remix of remixes) {
      if (remix.bagsTokenAddress) {
        const stats = await bagsService.getTokenStats(remix.bagsTokenAddress);
        if (stats) {
          remix.stats = { ...remix.stats, ...stats };
          await remix.save();
        }
      }
    }

    const total = await Remix.countDocuments(query);

    res.status(StatusCodes.OK).json({
      remixes,
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

// @desc    Get single remix with full details
// @route   GET /api/remixes/:id
const getRemixById = async (req, res) => {
  try {
    const remix = await Remix.findById(req.params.id)
      .populate('remixer', 'username walletAddress remixerLevel profileImage')
      .populate('parentTrack', 'title creator creatorWallet genre audioUrl');

    if (!remix) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: 'Remix not found' });
    }

    // Update stats from Bags
    if (remix.bagsTokenAddress) {
      const stats = await bagsService.getTokenStats(remix.bagsTokenAddress);
      if (stats) {
        remix.stats = { ...remix.stats, ...stats };
        await remix.save();
      }
    }

    // Generate trader insight
    const traderInsight = await aiService.generateTraderInsight(remix.stats);

    res.status(StatusCodes.OK).json({
      remix,
      traderInsight,
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
};

module.exports = {
  createRemix,
  getMarketFeed,
  getRemixById,
};