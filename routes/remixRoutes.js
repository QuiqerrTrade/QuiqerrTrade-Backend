const express = require('express');
const router = express.Router();
const multer = require('multer');
const { verifyWalletSignature, attachUser } = require('../middleware/auth');
const { createRemix, getMarketFeed, getRemixById } = require('../controllers/remixController');

const upload = multer({ dest: 'uploads/' });

router.route('/')
  .post(verifyWalletSignature, upload.single('audio'), createRemix);

router.route('/market')
  .get(attachUser, getMarketFeed);

router.route('/:id')
  .get(attachUser, getRemixById);

module.exports = router;