#!/usr/bin/env node
/**
 * Frame Builder - Token Launch
 * Launch builder coins and product coins on Frame (Base chain)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const WALLET_PATH = path.join(process.env.HOME, '.evm-wallet.json');
const TOKENS_DIR = path.join(process.env.HOME, '.openclaw', 'frame', 'tokens');
const FRAME_API = 'https://api.long.xyz/v1';

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { category: 'builder' };
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) result.name = args[++i];
    else if (args[i] === '--symbol' && args[i + 1]) result.symbol = args[++i];
    else if (args[i] === '--description' && args[i + 1]) result.description = args[++i];
    else if (args[i] === '--image' && args[i + 1]) result.image = args[++i];
    else if (args[i] === '--category' && args[i + 1]) result.category = args[++i];
    else if (args[i] === '--builder' && args[i + 1]) result.builder = args[++i];
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

function saveToken(token) {
  fs.mkdirSync(TOKENS_DIR, { recursive: true });
  const tokenPath = path.join(TOKENS_DIR, `${token.symbol.toLowerCase()}.json`);
  fs.writeFileSync(tokenPath, JSON.stringify(token, null, 2));
  return tokenPath;
}

async function launchToken(wallet, config) {
  console.log('🚀 Launching token on Frame...');
  console.log('');
  console.log(`  Name: ${config.name}`);
  console.log(`  Symbol: ${config.symbol}`);
  console.log(`  Category: ${config.category}`);
  console.log(`  Creator: ${wallet.address}`);
  console.log('');
  
  // Frame API call would go here
  // For now, simulating the launch process
  
  const token = {
    name: config.name,
    symbol: config.symbol,
    description: config.description,
    image: config.image,
    category: config.category,
    creator: wallet.address,
    // Simulated address - in production this comes from Frame API
    address: '0x' + require('crypto').randomBytes(20).toString('hex'),
    chain: 'base',
    chainId: 8453,
    launchedAt: new Date().toISOString(),
    status: 'pending'
  };
  
  if (config.builder) {
    token.builderCoin = config.builder;
  }
  
  return token;
}

async function main() {
  const args = parseArgs();
  
  if (!args.name || !args.symbol) {
    console.log('Usage:');
    console.log('  node launch.js --name "Token Name" --symbol "TKN" --description "..." --image <ipfs-hash>');
    console.log('');
    console.log('Options:');
    console.log('  --name        Token name (required)');
    console.log('  --symbol      Token symbol (required)');
    console.log('  --description Token description');
    console.log('  --image       IPFS hash for token image');
    console.log('  --category    "builder" (default) or "product"');
    console.log('  --builder     Builder coin address (required for product coins)');
    process.exit(1);
  }
  
  if (args.category === 'product' && !args.builder) {
    console.error('Error: Product coins require --builder <address>');
    process.exit(1);
  }
  
  const wallet = loadWallet();
  
  try {
    const token = await launchToken(wallet, args);
    const tokenPath = saveToken(token);
    
    console.log('✅ Token launch initiated!');
    console.log('');
    console.log(`  Address: ${token.address}`);
    console.log(`  Saved to: ${tokenPath}`);
    console.log('');
    console.log('⚠️  Note: This is a simulation. Connect to Frame API for real launches.');
    console.log('    Set FRAME_API_KEY environment variable for production.');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Check status: node heartbeat.js status');
    console.log('  2. View on Base: https://basescan.org/address/' + token.address);
    console.log('  3. Trade on Frame: https://frame.fun/t/' + token.symbol.toLowerCase());
  } catch (err) {
    console.error('Launch failed:', err.message);
    process.exit(1);
  }
}

main();
