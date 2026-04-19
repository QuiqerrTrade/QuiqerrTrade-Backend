const express = require('express');
const router = express.Router();
const { verifyWalletSignature } = require('../middleware/auth');
const { buyTokens, getPortfolio } = require('../controllers/marketController');

router.route('/buy')
  .post(verifyWalletSignature, buyTokens);

router.route('/portfolio')
  .get(verifyWalletSignature, getPortfolio);

module.exports = router;