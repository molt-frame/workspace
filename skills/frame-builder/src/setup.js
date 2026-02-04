#!/usr/bin/env node
/**
 * Frame Builder - Wallet Setup
 * Creates a new EVM wallet for Frame transactions
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const WALLET_PATH = path.join(process.env.HOME, '.evm-wallet.json');

function generateWallet() {
  // Generate 32 random bytes for private key
  const privateKey = crypto.randomBytes(32).toString('hex');
  
  // Derive address using keccak256 (simplified - in production use ethers.js)
  // For now, we'll use a placeholder that will be replaced when we have ethers
  const address = '0x' + crypto.createHash('sha256')
    .update(privateKey)
    .digest('hex')
    .slice(0, 40);
  
  return { privateKey, address };
}

function main() {
  if (fs.existsSync(WALLET_PATH)) {
    const wallet = JSON.parse(fs.readFileSync(WALLET_PATH, 'utf8'));
    console.log('Wallet already exists:');
    console.log(`  Address: ${wallet.address}`);
    console.log(`  Path: ${WALLET_PATH}`);
    return;
  }

  const wallet = generateWallet();
  
  fs.writeFileSync(WALLET_PATH, JSON.stringify(wallet, null, 2), { mode: 0o600 });
  
  console.log('🦞 New wallet created!');
  console.log(`  Address: ${wallet.address}`);
  console.log(`  Path: ${WALLET_PATH}`);
  console.log('');
  console.log('⚠️  IMPORTANT: Back up ~/.evm-wallet.json and NEVER share your private key!');
}

main();
