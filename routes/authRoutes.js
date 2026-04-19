const express = require('express');
const router = express.Router();
const { verifyWalletSignature, authenticate } = require('../middleware/auth');
const {
  getNonce,
  walletAuth,
  register,
  login,
  verifyEmail,
  refreshToken,
  logout,
  logoutAll,
} = require('../controllers/authController');

// Wallet auth
router.get('/nonce/:walletAddress', getNonce);
router.post('/wallet', walletAuth);

// Email auth
router.post('/register', register);
router.post('/login', login);
router.get('/verify-email/:token', verifyEmail);

// Token management
router.post('/refresh', refreshToken);
router.post('/logout', authenticate, logout);
router.post('/logout-all', authenticate, logoutAll);

module.exports = router;