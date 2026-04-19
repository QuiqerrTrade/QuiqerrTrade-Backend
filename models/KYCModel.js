const mongoose = require('mongoose');

const kycSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    
    // ============================================
    // APPLICATION STATUS
    // ============================================
    applicationId: {
      type: String,
      unique: true,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'under_review', 'approved', 'rejected', 'expired', 'needs_resubmission'],
      default: 'pending',
    },
    level: {
      type: Number,
      enum: [1, 2, 3],
      required: true,
    },
    
    // ============================================
    // PERSONAL INFORMATION (Level 1)
    // ============================================
    personalInfo: {
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
      dateOfBirth: { type: Date, required: true },
      nationality: { type: String, required: true },
      countryOfResidence: { type: String, required: true },
      phoneNumber: { type: String, required: true },
    },
    
    // ============================================
    // ADDRESS INFORMATION (Level 1)
    // ============================================
    address: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, required: true },
    },
    
    // ============================================
    // IDENTIFICATION DOCUMENTS (Level 2)
    // ============================================
    documents: [{
      type: {
        type: String,
        enum: ['passport', 'drivers_license', 'national_id', 'residence_permit', 'selfie'],
        required: true,
      },
      documentNumber: String,
      issuingCountry: String,
      issueDate: Date,
      expiryDate: Date,
      
      // File uploads
      frontImage: {
        url: String,
        ipfsHash: String,
        uploadedAt: Date,
      },
      backImage: {
        url: String,
        ipfsHash: String,
        uploadedAt: Date,
      },
      selfieImage: {
        url: String,
        ipfsHash: String,
        uploadedAt: Date,
      },
      
      // Verification results
      verificationStatus: {
        type: String,
        enum: ['pending', 'verified', 'rejected', 'needs_review'],
        default: 'pending',
      },
      verificationNotes: String,
      verifiedAt: Date,
      verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    }],
    
    // ============================================
    // ENHANCED DUE DILIGENCE (Level 3)
    // ============================================
    enhancedDueDiligence: {
      sourceOfFunds: {
        type: String,
        enum: ['salary', 'business', 'investments', 'crypto_trading', 'inheritance', 'other'],
      },
      sourceOfFundsDescription: String,
      estimatedAnnualIncome: {
        type: String,
        enum: ['under_50k', '50k_100k', '100k_250k', '250k_500k', 'over_500k'],
      },
      occupation: String,
      employer: String,
      politicallyExposedPerson: { type: Boolean, default: false },
      pepDetails: String,
    },
    
    // ============================================
    // AML/KYC CHECKS
    // ============================================
    complianceChecks: {
      sanctionsScreening: {
        status: {
          type: String,
          enum: ['pending', 'clear', 'hit', 'review'],
          default: 'pending',
        },
        checkedAt: Date,
        result: mongoose.Schema.Types.Mixed,
      },
      pepScreening: {
        status: {
          type: String,
          enum: ['pending', 'clear', 'hit', 'review'],
          default: 'pending',
        },
        checkedAt: Date,
        result: mongoose.Schema.Types.Mixed,
      },
      adverseMediaScreening: {
        status: {
          type: String,
          enum: ['pending', 'clear', 'hit', 'review'],
          default: 'pending',
        },
        checkedAt: Date,
        result: mongoose.Schema.Types.Mixed,
      },
      identityVerification: {
        status: {
          type: String,
          enum: ['pending', 'verified', 'failed', 'manual_review'],
          default: 'pending',
        },
        provider: String,
        verificationId: String,
        checkedAt: Date,
        confidence: Number,
      },
      livenessCheck: {
        status: {
          type: String,
          enum: ['pending', 'passed', 'failed'],
          default: 'pending',
        },
        provider: String,
        checkedAt: Date,
        score: Number,
      },
    },
    
    // ============================================
    // REVIEW PROCESS
    // ============================================
    reviewHistory: [{
      action: {
        type: String,
        enum: ['submitted', 'assigned', 'reviewed', 'approved', 'rejected', 'requested_info', 'escalated'],
      },
      performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      notes: String,
      timestamp: { type: Date, default: Date.now },
    }],
    
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    
    // ============================================
    // VALIDITY
    // ============================================
    submittedAt: { type: Date, default: Date.now },
    approvedAt: Date,
    rejectedAt: Date,
    expiresAt: {
      type: Date,
      default: function() {
        // KYC expires after 2 years
        return new Date(Date.now() + 730 * 24 * 60 * 60 * 1000);
      },
    },
    rejectionReason: String,
    
    // ============================================
    // METADATA
    // ============================================
    metadata: {
      ipAddress: String,
      userAgent: String,
      submissionSource: String,
      riskScore: { type: Number, min: 0, max: 100 },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
kycSchema.index({ user: 1 });
kycSchema.index({ status: 1 });
kycSchema.index({ applicationId: 1 });
kycSchema.index({ expiresAt: 1 });

module.exports = mongoose.model('KYC', kycSchema);