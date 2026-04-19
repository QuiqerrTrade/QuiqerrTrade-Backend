const express = require('express');
const router = express.Router();
const { attachUser } = require('../middleware/auth');
const aiService = require('../services/aiService');
const Track = require('../models/Track');

// @desc    Get AI-suggested remix opportunities
// @route   GET /api/ai/suggestions
router.get('/suggestions', attachUser, async (req, res) => {
  try {
    const { genre } = req.query;
    const user = req.user;

    if (!user) {
      return res.json({ suggestion: 'Connect wallet to get personalized suggestions.' });
    }

    const suggestion = await aiService.suggestRemixOpportunities(user, genre || 'afrobeats');
    res.json({ suggestion });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;