#!/usr/bin/env node
/**
 * Frame Builder - Claims
 * Claim vesting tokens and trading fees
 */

const fs = require('fs');
const path = require('path');

const WALLET_PATH = path.join(process.env.HOME, '.evm-wallet.json');
const TOKENS_DIR = path.join(process.env.HOME, '.openclaw', 'frame', 'tokens');

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { command: args[0] };
  
  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--token=')) {
      result.token = args[i].split('=')[1];
    }
  }
  
  return result;
}

function loadWallet() {
  if (!fs.existsSync(WALLET_PATH)) {
    console.error('No wallet found. Run: node setup.js');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(WALLET_PATH, 'utf8'));
}

function findToken(address) {
  if (!fs.existsSync(TOKENS_DIR)) {
    return null;
  }
  
  const files = fs.readdirSync(TOKENS_DIR).filter(f => f.endsWith('.json'));
  for (const f of files) {
    const token = JSON.parse(fs.readFileSync(path.join(TOKENS_DIR, f), 'utf8'));
    if (token.address.toLowerCase() === address.toLowerCase()) {
      return token;
    }
  }
  return null;
}

async function claimVesting(wallet, tokenAddress) {
  console.log('📥 Claiming vesting tokens...');
  console.log('');
  console.log(`  Token: ${tokenAddress}`);
  console.log(`  Wallet: ${wallet.address}`);
  console.log('');
  
  // In production:
  // 1. Check vesting contract for claimable amount
  // 2. Encode claim transaction
  // 3. Send via Frame API (gas-free)
  // 4. Wait for confirmation
  
  console.log('⚠️  Simulation mode - no actual claim made');
  console.log('');
  console.log('To claim for real:');
  console.log('  1. Set FRAME_API_KEY environment variable');
  console.log('  2. Ensure you have claimable tokens (check heartbeat status)');
}

async function claimFees(wallet, tokenAddress) {
  console.log('📥 Claiming trading fees...');
  console.log('');
  console.log(`  Token: ${tokenAddress}`);
  console.log(`  Wallet: ${wallet.address}`);
  console.log('');
  
  // In production:
  // 1. Check fees contract for claimable ETH
  // 2. Encode claim transaction
  // 3. Send via Frame API (gas-free)
  // 4. Wait for confirmation
  
  console.log('⚠️  Simulation mode - no actual claim made');
  console.log('');
  console.log('To claim for real:');
  console.log('  1. Set FRAME_API_KEY environment variable');
  console.log('  2. Ensure you have claimable fees (check heartbeat status)');
}

async function main() {
  const args = parseArgs();
  
  if (!args.command || args.command === 'help') {
    console.log('Usage:');
    console.log('  node claims.js vesting --token=0x...  - Claim vesting tokens');
    console.log('  node claims.js fees --token=0x...     - Claim trading fees');
    console.log('');
    console.log('Token vesting: 10% of supply over 12 months');
    console.log('Trading fees: 50% of all trading fees');
    process.exit(0);
  }
  
  if (!args.token) {
    console.error('Error: --token=0x... is required');
    process.exit(1);
  }
  
  const wallet = loadWallet();
  
  if (args.command === 'vesting') {
    await claimVesting(wallet, args.token);
  } else if (args.command === 'fees') {
    await claimFees(wallet, args.token);
  } else {
    console.error(`Unknown command: ${args.command}`);
    console.log('Use: vesting, fees, or help');
    process.exit(1);
  }
}

main();
