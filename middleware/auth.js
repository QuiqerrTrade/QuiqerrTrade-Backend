const nacl = require('tweetnacl');
const bs58 = require('bs58');
const User = require('../models/UserModel');

// Verify wallet signature (Solana wallet authentication)
const verifyWalletSignature = async (req, res, next) => {
  try {
    const { walletAddress, signature, message } = req.body;

    if (!walletAddress || !signature || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify the signature
    const publicKey = bs58.decode(walletAddress);
    const signatureBytes = bs58.decode(signature);
    const messageBytes = new TextEncoder().encode(message);

    const isValid = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKey
    );

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Find or create user
    let user = await User.findOne({ walletAddress });

    if (!user) {
      user = await User.create({ walletAddress });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// Optional: Just attach user if exists, don't require auth
const attachUser = async (req, res, next) => {
  const { walletAddress } = req.query;

  if (walletAddress) {
    req.user = await User.findOne({ walletAddress });
  }

  next();
};

module.exports = { verifyWalletSignature, attachUser };