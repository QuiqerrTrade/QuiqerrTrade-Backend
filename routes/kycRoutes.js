const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const {
  submitKYC,
  getKYCStatus,
  uploadDocument,
  submitSelfie,
  getKYCRequirements,
} = require('../controllers/kycController');

const upload = multer({ 
  dest: 'uploads/kyc/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

router.post('/submit', authenticate, submitKYC);
router.get('/status', authenticate, getKYCStatus);
router.post('/documents', authenticate, upload.single('document'), uploadDocument);
router.post('/selfie', authenticate, upload.single('selfie'), submitSelfie);
router.get('/requirements/:level', getKYCRequirements);

module.exports = router;