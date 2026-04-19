const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
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
} = require('../controllers/userController');

// Current user
router.get('/me', authenticate, getMe);
router.patch('/me', authenticate, updateProfile);
router.patch('/me/email', authenticate, updateEmail);
router.patch('/me/password', authenticate, changePassword);
router.delete('/me', authenticate, deleteAccount);

// Creator/Remixer dashboards
router.get('/me/creator-stats', authenticate, getCreatorStats);
router.get('/me/remixer-stats', authenticate, getRemixerStats);

// Public profile
router.get('/:identifier', getUserByIdentifier);

// Follow system
router.post('/:id/follow', authenticate, followUser);
router.delete('/:id/follow', authenticate, unfollowUser);
router.get('/:id/followers', getFollowers);
router.get('/:id/following', getFollowing);

module.exports = router;