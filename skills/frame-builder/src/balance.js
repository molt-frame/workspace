#!/usr/bin/env node
/**
 * Frame Builder - Balance Check
 * Check wallet ETH balance on Base
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const WALLET_PATH = path.join(process.env.HOME, '.evm-wallet.json');
const BASE_RPC = 'https://mainnet.base.org';

function loadWallet() {
  if (!fs.existsSync(WALLET_PATH)) {
    console.error('No wallet found. Run: node setup.js');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(WALLET_PATH, 'utf8'));
}

async function getBalance(address) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_getBalance',
      params: [address, 'latest'],
      id: 1
    });

    const url = new URL(BASE_RPC);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (json.result) {
            const wei = BigInt(json.result);
            const eth = Number(wei) / 1e18;
            resolve(eth);
          } else {
            reject(new Error(json.error?.message || 'Unknown error'));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  const wallet = loadWallet();
  console.log(`Wallet: ${wallet.address}`);
  console.log('Chain: Base Mainnet (8453)');
  console.log('');
  
  try {
    const balance = await getBalance(wallet.address);
    console.log(`Balance: ${balance.toFixed(6)} ETH`);
  } catch (err) {
    console.error('Error fetching balance:', err.message);
  }
}

main();
