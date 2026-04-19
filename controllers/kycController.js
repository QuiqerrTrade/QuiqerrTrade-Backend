const KYC = require('../models/KYCModel');
const User = require('../models/UserModel');
const { StatusCodes } = require('http-status-codes');
const kycService = require('../services/kycService');
const crypto = require('crypto');

// @desc    Submit KYC application
// @route   POST /api/kyc/submit
const submitKYC = async (req, res) => {
  try {
    const { level, personalInfo, address, documents, enhancedDueDiligence } = req.body;
    
    // Check if user already has pending/approved KYC
    const existingKYC = await KYC.findOne({ 
      user: req.user._id,
      status: { $in: ['pending', 'under_review', 'approved'] },
    });
    
    if (existingKYC) {
      return res.status(StatusCodes.BAD_REQUEST).json({ 
        error: 'You already have a KYC application in progress' 
      });
    }
    
    // Generate application ID
    const applicationId = `KYC-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    
    // Create KYC application
    const kyc = await KYC.create({
      user: req.user._id,
      applicationId,
      level,
      personalInfo,
      address,
      documents,
      enhancedDueDiligence,
      metadata: {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        submissionSource: 'web',
      },
    });
    
    // Add review history
    kyc.reviewHistory.push({
      action: 'submitted',
      notes: 'Application submitted',
    });
    await kyc.save();
    
    // Update user KYC status
    await User.findByIdAndUpdate(req.user._id, {
      kycStatus: 'pending',
      kycLevel: 0,
      kycSubmittedAt: new Date(),
    });
    
    // Trigger automated checks
    await kycService.performAutomatedChecks(kyc);
    
    res.status(StatusCodes.CREATED).json({
      success: true,
      applicationId,
      message: 'KYC application submitted successfully',
    });
  } catch (error) {
    console.error('KYC submission error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
};

// @desc    Get KYC status
// @route   GET /api/kyc/status
const getKYCStatus = async (req, res) => {
  try {
    const kyc = await KYC.findOne({ user: req.user._id })
      .sort({ createdAt: -1 })
      .select('-documents.frontImage -documents.backImage -documents.selfieImage');
    
    if (!kyc) {
      return res.status(StatusCodes.OK).json({
        status: 'not_submitted',
        level: req.user.kycLevel,
      });
    }
    
    res.status(StatusCodes.OK).json({
      applicationId: kyc.applicationId,
      status: kyc.status,
      level: kyc.level,
      submittedAt: kyc.submittedAt,
      approvedAt: kyc.approvedAt,
      expiresAt: kyc.expiresAt,
      rejectionReason: kyc.rejectionReason,
      complianceChecks: {
        identityVerification: kyc.complianceChecks.identityVerification.status,
        livenessCheck: kyc.complianceChecks.livenessCheck.status,
        sanctionsScreening: kyc.complianceChecks.sanctionsScreening.status,
      },
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
};

// @desc    Upload KYC document
// @route   POST /api/kyc/documents
const uploadDocument = async (req, res) => {
  try {
    const { type, documentNumber, issuingCountry, issueDate, expiryDate } = req.body;
    const file = req.file;
    
    if (!file) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: 'Document file required' });
    }
    
    // Upload to secure storage (IPFS or encrypted S3)
    const documentUrl = await kycService.uploadSecureDocument(file);
    
    // Find or create KYC application
    let kyc = await KYC.findOne({ 
      user: req.user._id,
      status: { $in: ['pending', 'under_review'] },
    });
    
    if (!kyc) {
      return res.status(StatusCodes.BAD_REQUEST).json({ 
        error: 'No active KYC application found' 
      });
    }
    
    // Add or update document
    const docIndex = kyc.documents.findIndex(d => d.type === type);
    
    const documentData = {
      type,
      documentNumber,
      issuingCountry,
      issueDate: new Date(issueDate),
      expiryDate: new Date(expiryDate),
      frontImage: {
        url: documentUrl,
        uploadedAt: new Date(),
      },
      verificationStatus: 'pending',
    };
    
    if (docIndex >= 0) {
      kyc.documents[docIndex] = documentData;
    } else {
      kyc.documents.push(documentData);
    }
    
    await kyc.save();
    
    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Document uploaded successfully',
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
};

// @desc    Submit selfie for liveness check
// @route   POST /api/kyc/selfie
const submitSelfie = async (req, res) => {
  try {
    const file = req.file;
    
    if (!file) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: 'Selfie file required' });
    }
    
    const kyc = await KYC.findOne({ 
      user: req.user._id,
      status: { $in: ['pending', 'under_review'] },
    });
    
    if (!kyc) {
      return res.status(StatusCodes.BAD_REQUEST).json({ 
        error: 'No active KYC application found' 
      });
    }
    
    // Upload selfie
    const selfieUrl = await kycService.uploadSecureDocument(file);
    
    // Find or create selfie document
    const selfieDoc = kyc.documents.find(d => d.type === 'selfie');
    
    if (selfieDoc) {
      selfieDoc.selfieImage = {
        url: selfieUrl,
        uploadedAt: new Date(),
      };
    } else {
      kyc.documents.push({
        type: 'selfie',
        selfieImage: {
          url: selfieUrl,
          uploadedAt: new Date(),
        },
        verificationStatus: 'pending',
      });
    }
    
    await kyc.save();
    
    // Perform liveness check
    await kycService.performLivenessCheck(kyc, selfieUrl);
    
    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Selfie submitted for verification',
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
};

// @desc    Get KYC requirements by level
// @route   GET /api/kyc/requirements/:level
const getKYCRequirements = async (req, res) => {
  try {
    const { level } = req.params;
    
    const requirements = {
      1: {
        name: 'Basic Verification',
        required: ['email', 'phone', 'personalInfo', 'address'],
        limits: {
          dailyWithdrawal: 1000,
          monthlyVolume: 10000,
        },
      },
      2: {
        name: 'Identity Verification',
        required: ['email', 'phone', 'personalInfo', 'address', 'idDocument', 'selfie'],
        limits: {
          dailyWithdrawal: 10000,
          monthlyVolume: 100000,
        },
      },
      3: {
        name: 'Enhanced Due Diligence',
        required: ['email', 'phone', 'personalInfo', 'address', 'idDocument', 'selfie', 'sourceOfFunds', 'occupation'],
        limits: {
          dailyWithdrawal: null, // Unlimited
          monthlyVolume: null,
        },
      },
    };
    
    res.status(StatusCodes.OK).json(requirements[level] || requirements[1]);
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
};

module.exports = {
  submitKYC,
  getKYCStatus,
  uploadDocument,
  submitSelfie,
  getKYCRequirements,
};