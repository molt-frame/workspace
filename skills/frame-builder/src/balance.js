#!/usr/bin/env node
/**
 * Frame Builder - Balance Check
 * 
 * Checks wallet balance on Base chain.
 * 
 * Usage:
 *   node balance.js base --json    # JSON output for Base
 *   node balance.js base           # Human-readable output
 */

import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const WALLET_PATH = join(homedir(), '.evm-wallet.json');

const CHAINS = {
  base: {
    name: 'Base',
    rpc: 'https://mainnet.base.org',
    symbol: 'ETH',
    chainId: 8453,
  },
};

function parseArgs() {
  const args = process.argv.slice(2);
  const chain = args.find(a => !a.startsWith('--')) || 'base';
  return {
    chain,
    json: args.includes('--json'),
  };
}

function loadWallet() {
  if (!existsSync(WALLET_PATH)) {
    return null;
  }
  
  try {
    return JSON.parse(readFileSync(WALLET_PATH, 'utf-8'));
  } catch (error) {
    return null;
  }
}

async function getBalance(address, rpcUrl) {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getBalance',
      params: [address, 'latest'],
    }),
  });
  
  const data = await response.json();
  
  if (data.error) {
    throw new Error(data.error.message);
  }
  
  // Convert hex to decimal, then to ETH
  const balanceWei = BigInt(data.result);
  const balanceEth = Number(balanceWei) / 1e18;
  
  return balanceEth.toFixed(6);
}

async function main() {
  const { chain, json } = parseArgs();
  
  // Validate chain
  const chainConfig = CHAINS[chain];
  if (!chainConfig) {
    const error = { success: false, error: `Unknown chain: ${chain}` };
    if (json) {
      console.log(JSON.stringify(error));
    } else {
      console.error(`❌ Unknown chain: ${chain}`);
      console.error(`   Supported: ${Object.keys(CHAINS).join(', ')}`);
    }
    process.exit(1);
  }
  
  // Load wallet
  const wallet = loadWallet();
  if (!wallet) {
    const error = { success: false, error: 'No wallet found. Run setup.js first.' };
    if (json) {
      console.log(JSON.stringify(error));
    } else {
      console.error('❌ No wallet found');
      console.error('   Run: node setup.js');
    }
    process.exit(1);
  }
  
  try {
    const balance = await getBalance(wallet.address, chainConfig.rpc);
    
    const result = {
      success: true,
      address: wallet.address,
      balance,
      symbol: chainConfig.symbol,
      chain,
    };
    
    if (json) {
      console.log(JSON.stringify(result));
    } else {
      console.log(`💰 Wallet Balance (${chainConfig.name})`);
      console.log(`   Address: ${wallet.address}`);
      console.log(`   Balance: ${balance} ${chainConfig.symbol}`);
    }
  } catch (error) {
    const errorResult = { success: false, error: error.message };
    if (json) {
      console.log(JSON.stringify(errorResult));
    } else {
      console.error(`❌ Error: ${error.message}`);
    }
    process.exit(1);
  }
}

main();
