const User = require('../models/UserModel');
const Session = require('../models/Session');
const Referral = require('../models/Referral');
const { StatusCodes } = require('http-status-codes');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nacl = require('tweetnacl');
const bs58 = require('bs58');
const emailService = require('../services/emailService');
const levelingService = require('../services/levelingService');
const geoip = require('geoip-lite');

// ============================================
// WALLET AUTHENTICATION
// ============================================

// @desc    Get nonce for wallet signature
// @route   GET /api/auth/nonce/:walletAddress
const getNonce = async (req, res) => {
  try {
    const { walletAddress } = req.params;
    
    const nonce = crypto.randomBytes(32).toString('hex');
    const message = `Sign this message to authenticate with Remix Market.\nNonce: ${nonce}`;
    
    // Store nonce in Redis or memory cache (simplified here)
    // In production, use Redis with expiration
    
    res.status(StatusCodes.OK).json({
      message,
      nonce,
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
};

// @desc    Authenticate with wallet signature
// @route   POST /api/auth/wallet
const walletAuth = async (req, res) => {
  try {
    const { walletAddress, signature, message, referralCode } = req.body;
    const clientIp = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    
    // Verify signature
    const publicKey = bs58.decode(walletAddress);
    const signatureBytes = bs58.decode(signature);
    const messageBytes = new TextEncoder().encode(message);
    
    const isValid = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKey
    );
    
    if (!isValid) {
      return res.status(StatusCodes.UNAUTHORIZED).json({ 
        error: 'Invalid signature' 
      });
    }
    
    // Find or create user
    let user = await User.findOne({ walletAddress });
    let isNewUser = false;
    
    if (!user) {
      isNewUser = true;
      
      // Get location from IP
      const geo = geoip.lookup(clientIp);
      
      user = await User.create({
        walletAddress,
        wallets: [{
          address: walletAddress,
          chain: 'solana',
          isPrimary: true,
          verified: true,
        }],
        metadata: {
          registrationIp: clientIp,
          registrationUserAgent: userAgent,
          registrationSource: referralCode ? 'referral' : 'direct',
        },
        'personalInfo.countryOfResidence': geo?.country || 'Unknown',
      });
      
      // Initialize leveling
      await levelingService.initializeNewUser(user);
      
      // Process referral if provided
      if (referralCode) {
        await processReferral(referralCode, user);
      }
      
      // Send welcome email
      await emailService.sendWelcomeEmail(user);
    }
    
    // Update last login
    user.security.lastLogin = new Date();
    user.security.lastLoginIp = clientIp;
    user.security.loginHistory.push({
      ip: clientIp,
      userAgent,
      location: geo?.country || 'Unknown',
      timestamp: new Date(),
    });
    
    // Keep only last 10 login records
    if (user.security.loginHistory.length > 10) {
      user.security.loginHistory = user.security.loginHistory.slice(-10);
    }
    
    user.metadata.lastActive = new Date();
    await user.save();
    
    // Create session
    const session = await createSession(user, clientIp, userAgent);
    
    // Generate JWT tokens
    const accessToken = generateAccessToken(user, session);
    const refreshToken = generateRefreshToken(user, session);
    
    res.status(StatusCodes.OK).json({
      success: true,
      isNewUser,
      user: sanitizeUser(user),
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: '24h',
      },
      sessionId: session._id,
    });
  } catch (error) {
    console.error('Wallet auth error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
};

// ============================================
// EMAIL AUTHENTICATION
// ============================================

// @desc    Register with email
// @route   POST /api/auth/register
const register = async (req, res) => {
  try {
    const { 
      email, 
      password, 
      firstName, 
      lastName, 
      username,
      dateOfBirth,
      referralCode 
    } = req.body;
    const clientIp = req.ip || req.connection.remoteAddress;
    
    // Check if email exists
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(StatusCodes.BAD_REQUEST).json({ 
        error: 'Email already registered' 
      });
    }
    
    // Check if username exists
    if (username) {
      const existingUsername = await User.findOne({ username });
      if (existingUsername) {
        return res.status(StatusCodes.BAD_REQUEST).json({ 
          error: 'Username already taken' 
        });
      }
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    
    // Create user
    const user = await User.create({
      email,
      password: hashedPassword,
      username,
      personalInfo: {
        firstName,
        lastName,
        dateOfBirth: new Date(dateOfBirth),
      },
      emailVerificationToken: verificationToken,
      emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      metadata: {
        registrationIp: clientIp,
        registrationSource: referralCode ? 'referral' : 'direct',
      },
    });
    
    // Initialize leveling
    await levelingService.initializeNewUser(user);
    
    // Process referral
    if (referralCode) {
      await processReferral(referralCode, user);
    }
    
    // Send verification email
    await emailService.sendVerificationEmail(user, verificationToken);
    
    // Create session
    const session = await createSession(user, clientIp, req.headers['user-agent']);
    const accessToken = generateAccessToken(user, session);
    const refreshToken = generateRefreshToken(user, session);
    
    res.status(StatusCodes.CREATED).json({
      success: true,
      message: 'Registration successful. Please verify your email.',
      user: sanitizeUser(user),
      tokens: {
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
};

// @desc    Login with email
// @route   POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const clientIp = req.ip || req.connection.remoteAddress;
    
    // Find user
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(StatusCodes.UNAUTHORIZED).json({ 
        error: 'Invalid credentials' 
      });
    }
    
    // Check account status
    if (user.accountStatus !== 'active') {
      return res.status(StatusCodes.FORBIDDEN).json({ 
        error: `Account is ${user.accountStatus}` 
      });
    }
    
    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(StatusCodes.UNAUTHORIZED).json({ 
        error: 'Invalid credentials' 
      });
    }
    
    // Update login info
    user.security.lastLogin = new Date();
    user.security.lastLoginIp = clientIp;
    user.metadata.lastActive = new Date();
    await user.save();
    
    // Create session
    const session = await createSession(user, clientIp, req.headers['user-agent']);
    const accessToken = generateAccessToken(user, session);
    const refreshToken = generateRefreshToken(user, session);
    
    res.status(StatusCodes.OK).json({
      success: true,
      user: sanitizeUser(user),
      tokens: {
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
};

// @desc    Verify email
// @route   GET /api/auth/verify-email/:token
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;
    
    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() },
    });
    
    if (!user) {
      return res.status(StatusCodes.BAD_REQUEST).json({ 
        error: 'Invalid or expired verification token' 
      });
    }
    
    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();
    
    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Email verified successfully',
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
};

// @desc    Refresh access token
// @route   POST /api/auth/refresh
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    const session = await Session.findById(decoded.sessionId);
    
    if (!session || !session.isValid) {
      return res.status(StatusCodes.UNAUTHORIZED).json({ 
        error: 'Invalid session' 
      });
    }
    
    const user = await User.findById(session.user);
    if (!user || user.accountStatus !== 'active') {
      return res.status(StatusCodes.UNAUTHORIZED).json({ 
        error: 'User not found or inactive' 
      });
    }
    
    const newAccessToken = generateAccessToken(user, session);
    
    res.status(StatusCodes.OK).json({
      accessToken: newAccessToken,
      expiresIn: '24h',
    });
  } catch (error) {
    res.status(StatusCodes.UNAUTHORIZED).json({ error: 'Invalid refresh token' });
  }
};

// @desc    Logout
// @route   POST /api/auth/logout
const logout = async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    await Session.findByIdAndUpdate(sessionId, {
      isValid: false,
    });
    
    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
};

// @desc    Logout from all devices
// @route   POST /api/auth/logout-all
const logoutAll = async (req, res) => {
  try {
    await Session.updateMany(
      { user: req.user._id, isValid: true },
      { isValid: false }
    );
    
    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Logged out from all devices',
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

const createSession = async (user, ipAddress, userAgent) => {
  const session = await Session.create({
    user: user._id,
    token: crypto.randomBytes(32).toString('hex'),
    refreshToken: crypto.randomBytes(32).toString('hex'),
    ipAddress,
    userAgent,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  });
  
  return session;
};

const generateAccessToken = (user, session) => {
  return jwt.sign(
    {
      userId: user._id,
      walletAddress: user.walletAddress,
      email: user.email,
      role: user.role,
      sessionId: session._id,
    },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
};

const generateRefreshToken = (user, session) => {
  return jwt.sign(
    {
      userId: user._id,
      sessionId: session._id,
    },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: '30d' }
  );
};

const processReferral = async (referralCode, newUser) => {
  try {
    const referral = await Referral.findOne({ 
      code: referralCode.toUpperCase(),
      status: 'active',
    });
    
    if (!referral) return;
    
    // Update referral stats
    referral.totalSignups += 1;
    referral.referredUsers.push({
      user: newUser._id,
      signedUpAt: new Date(),
    });
    
    newUser.referral.referredBy = referral.referrer;
    newUser.referral.referralCode = await generateUniqueReferralCode();
    
    await referral.save();
    await newUser.save();
    
    // Send notification to referrer
    await createReferralNotification(referral.referrer, newUser);
  } catch (error) {
    console.error('Referral processing error:', error);
  }
};

const generateUniqueReferralCode = async () => {
  let code;
  let exists = true;
  
  while (exists) {
    code = crypto.randomBytes(4).toString('hex').toUpperCase();
    exists = await User.findOne({ 'referral.referralCode': code });
  }
  
  return code;
};

const sanitizeUser = (user) => {
  const sanitized = user.toObject();
  delete sanitized.password;
  delete sanitized.emailVerificationToken;
  delete sanitized.security.twoFactorSecret;
  delete sanitized.security.backupCodes;
  delete sanitized.__v;
  return sanitized;
};

module.exports = {
  getNonce,
  walletAuth,
  register,
  login,
  verifyEmail,
  refreshToken,
  logout,
  logoutAll,
};