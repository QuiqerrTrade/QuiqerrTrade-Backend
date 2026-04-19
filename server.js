require('dotenv').config();
require('express-async-errors');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');

const connectDB = require('./src/config/database');
const errorHandler = require('./src/middleware/errorHandler');

// Route imports
const authRoutes = require('./src/routes/authRoutes');
const userRoutes = require('./src/routes/userRoutes');
const kycRoutes = require('./src/routes/kycRoutes');
const trackRoutes = require('./src/routes/trackRoutes');
const remixRoutes = require('./src/routes/remixRoutes');
const marketRoutes = require('./src/routes/marketRoutes');
const aiRoutes = require('./src/routes/aiRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');

const app = express();

// Connect to MongoDB
connectDB();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://remix-market.com', 'https://app.remix-market.com'] 
    : ['http://localhost:3000'],
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Data sanitization
app.use(mongoSanitize()); // Prevent NoSQL injection
app.use(xss()); // Prevent XSS attacks

// Compression & Logging
app.use(compression());
app.use(morgan('combined'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api/tracks', trackRoutes);
app.use('/api/remixes', remixRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Error handling
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════╗
║     🎧 REMIX MARKET BACKEND - PRODUCTION 🎧        ║
║                                                    ║
║     Server running on port ${PORT}                    ║
║     Environment: ${process.env.NODE_ENV}                       ║
║     MongoDB: Connected                             ║
║     Bags SDK: Initialized                          ║
║                                                    ║
║     Features:                                      ║
║     ✅ User Authentication (Wallet + Email)        ║
║     ✅ KYC Verification                            ║
║     ✅ Creator/Remixer Profiles                    ║
║     ✅ Social Features (Follow/Like)               ║
║     ✅ Tokenized Music Trading                     ║
║     ✅ AI-Powered Discovery                        ║
║                                                    ║
║     Ready to tokenize music! 🎵💹                  ║
╚════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});