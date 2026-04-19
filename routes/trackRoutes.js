const express = require('express');
const router = express.Router();
const multer = require('multer');
const { verifyWalletSignature, attachUser } = require('../middleware/auth');
const { createTrack, getTracks, getTrackById } = require('../controllers/trackController');

const upload = multer({ dest: 'uploads/' });

router.route('/')
  .post(verifyWalletSignature, upload.single('audio'), createTrack)
  .get(attachUser, getTracks);

router.route('/:id')
  .get(attachUser, getTrackById);

module.exports = router;