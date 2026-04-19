const { BagsClient } = require('@bagsfm/bags-sdk');

// Initialize Bags client with API key
const bagsClient = new BagsClient({
  apiKey: process.env.BAGS_API_KEY,
  apiUrl: process.env.BAGS_API_URL,
  network: process.env.NODE_ENV === 'production' ? 'mainnet-beta' : 'devnet',
});

module.exports = bagsClient;