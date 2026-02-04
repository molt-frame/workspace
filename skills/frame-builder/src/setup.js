#!/usr/bin/env node
/**
 * Frame Builder - Wallet Setup
 * 
 * Generates or verifies an EVM wallet for Base chain.
 * Private key stored at ~/.evm-wallet.json (chmod 600)
 * 
 * Usage:
 *   node setup.js --json    # JSON output
 *   node setup.js           # Human-readable output
 */

import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { readFileSync, writeFileSync, existsSync, chmodSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const WALLET_PATH = join(homedir(), '.evm-wallet.json');

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    json: args.includes('--json'),
    force: args.includes('--force'),
  };
}

function loadExistingWallet() {
  if (!existsSync(WALLET_PATH)) {
    return null;
  }
  
  try {
    const data = JSON.parse(readFileSync(WALLET_PATH, 'utf-8'));
    return data;
  } catch (error) {
    return null;
  }
}

function generateWallet() {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  
  const walletData = {
    address: account.address,
    privateKey: privateKey,
  };
  
  // Save wallet with secure permissions
  writeFileSync(WALLET_PATH, JSON.stringify(walletData, null, 2));
  chmodSync(WALLET_PATH, 0o600);
  
  return walletData;
}

function main() {
  const { json, force } = parseArgs();
  
  // Check for existing wallet
  const existing = loadExistingWallet();
  
  if (existing && !force) {
    const result = {
      success: true,
      address: existing.address,
      created: false,
      message: 'Wallet already exists',
    };
    
    if (json) {
      console.log(JSON.stringify(result));
    } else {
      console.log('✓ Wallet already exists');
      console.log(`  Address: ${existing.address}`);
      console.log(`  Path: ${WALLET_PATH}`);
    }
    return;
  }
  
  // Generate new wallet
  const wallet = generateWallet();
  
  const result = {
    success: true,
    address: wallet.address,
    created: true,
  };
  
  if (json) {
    console.log(JSON.stringify(result));
  } else {
    console.log('✓ Wallet generated');
    console.log(`  Address: ${wallet.address}`);
    console.log(`  Path: ${WALLET_PATH}`);
    console.log('');
    console.log('⚠️  IMPORTANT: Never share your private key!');
  }
}

main();
