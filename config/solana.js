const { Connection, Keypair } = require('@solana/web3.js');
const bs58 = require('bs58');

// Initialize Solana connection
const connection = new Connection(process.env.SOLANA_RPC_URL, 'confirmed');

// Platform wallet (for collecting fees)
const platformKeypair = Keypair.fromSecretKey(
  bs58.decode(process.env.SOLANA_PRIVATE_KEY)
);

// Creator/Remixer wallets will be passed from frontend signatures
// We never store private keys server-side

module.exports = {
  connection,
  platformKeypair,
  PLATFORM_WALLET_ADDRESS: process.env.PLATFORM_WALLET_ADDRESS,
};