#!/usr/bin/env node
/**
 * Frame Builder - IPFS Upload
 * 
 * Uploads token image and metadata to IPFS via Long.xyz API.
 * 
 * Usage:
 *   node upload.js \
 *     --name "My Token" \
 *     --symbol "MTK" \
 *     --description "A token for builders" \
 *     --image "./token-image.png" \
 *     --category "builder-coin" \
 *     --twitter "https://x.com/myproject" \
 *     --github "https://github.com/myproject" \
 *     --website "https://myproject.xyz"
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join, basename, extname } from 'path';
import { FormData } from 'undici';
import { Blob } from 'buffer';

const API_BASE = 'https://api.long.xyz/v1';
const WALLET_PATH = join(homedir(), '.evm-wallet.json');
const TOKENS_DIR = join(homedir(), '.openclaw', 'frame', 'tokens');

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    json: false,
    name: null,
    symbol: null,
    description: null,
    image: null,
    category: 'builder-coin',
    twitter: null,
    github: null,
    website: null,
    apiKey: process.env.FRAME_API_KEY || null,
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--json') {
      result.json = true;
    } else if (arg.startsWith('--')) {
      const key = arg.slice(2).replace(/-/g, '_');
      const value = args[i + 1];
      if (value && !value.startsWith('--')) {
        if (key === 'api_key') {
          result.apiKey = value;
        } else {
          result[key] = value;
        }
        i++;
      }
    }
  }
  
  return result;
}

function loadWallet() {
  if (!existsSync(WALLET_PATH)) {
    return null;
  }
  return JSON.parse(readFileSync(WALLET_PATH, 'utf-8'));
}

function getMimeType(filePath) {
  const ext = extname(filePath).toLowerCase();
  const mimeTypes = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

async function uploadImage(imagePath) {
  const imageBuffer = readFileSync(imagePath);
  const mimeType = getMimeType(imagePath);
  const blob = new Blob([imageBuffer], { type: mimeType });
  
  const formData = new FormData();
  formData.set('image', blob, basename(imagePath));
  
  const response = await fetch(`${API_BASE}/sponsorship/upload-image`, {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Image upload failed (${response.status}): ${text}`);
  }
  
  const data = await response.json();
  return data.result;
}

async function uploadMetadata(imageHash, tokenData) {
  const socialLinks = [];
  
  if (tokenData.twitter) {
    socialLinks.push({ label: 'Twitter', url: tokenData.twitter });
  }
  if (tokenData.github) {
    socialLinks.push({ label: 'GitHub', url: tokenData.github });
  }
  if (tokenData.website) {
    socialLinks.push({ label: 'Website', url: tokenData.website });
  }
  
  // Convert category format: "builder-coin" -> "builder"
  const category = tokenData.category?.replace('-coin', '') || 'product';
  
  const metadata = {
    name: tokenData.name,
    description: tokenData.description,
    image_hash: imageHash,
    social_links: socialLinks,
    category: category,
  };
  
  const response = await fetch(`${API_BASE}/sponsorship/upload-metadata`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Metadata upload failed (${response.status}): ${text}`);
  }
  
  const data = await response.json();
  return data.result;
}

function saveTokenData(symbol, data) {
  mkdirSync(TOKENS_DIR, { recursive: true });
  const filePath = join(TOKENS_DIR, `${symbol}.json`);
  writeFileSync(filePath, JSON.stringify(data, null, 2));
  return filePath;
}

async function main() {
  const args = parseArgs();
  const { json } = args;
  
  // Validate required args
  const required = ['name', 'symbol', 'description', 'image'];
  const missing = required.filter(key => !args[key]);
  
  if (missing.length > 0) {
    const error = { success: false, error: `Missing required args: ${missing.join(', ')}` };
    if (json) {
      console.log(JSON.stringify(error));
    } else {
      console.error(`❌ Missing required arguments: ${missing.join(', ')}`);
      console.error('');
      console.error('Usage:');
      console.error('  node upload.js \\');
      console.error('    --name "My Token" \\');
      console.error('    --symbol "MTK" \\');
      console.error('    --description "A token for builders" \\');
      console.error('    --image "./token-image.png"');
    }
    process.exit(1);
  }
  
  // No API key required - all endpoints are public
  
  // Check image exists
  if (!existsSync(args.image)) {
    const error = { success: false, error: `Image not found: ${args.image}` };
    if (json) {
      console.log(JSON.stringify(error));
    } else {
      console.error(`❌ Image not found: ${args.image}`);
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
    if (!json) {
      console.log('📦 IPFS Upload');
      console.log('==============');
      console.log(`Name: ${args.name}`);
      console.log(`Symbol: ${args.symbol}`);
      console.log(`Category: ${args.category}`);
      console.log('');
    }
    
    // Upload image
    if (!json) console.log('📷 Uploading image...');
    const imageHash = await uploadImage(args.image);
    if (!json) console.log(`✓ Image: ipfs://${imageHash}`);
    
    // Upload metadata
    if (!json) console.log('📝 Uploading metadata...');
    const metadataCid = await uploadMetadata(imageHash, args);
    if (!json) console.log(`✓ Metadata: ipfs://${metadataCid}`);
    
    // Save token data
    const tokenData = {
      name: args.name,
      symbol: args.symbol,
      description: args.description,
      image_ipfs: `ipfs://${imageHash}`,
      metadata_ipfs: `ipfs://${metadataCid}`,
      category: args.category,
      social_links: {
        twitter: args.twitter,
        github: args.github,
        website: args.website,
      },
      wallet_address: wallet.address,
      created_at: new Date().toISOString(),
    };
    
    const savedPath = saveTokenData(args.symbol, tokenData);
    
    const result = {
      success: true,
      image_hash: imageHash,
      metadata_cid: metadataCid,
      token_uri: `ipfs://${metadataCid}`,
      saved_to: savedPath,
    };
    
    if (json) {
      console.log(JSON.stringify(result));
    } else {
      console.log('');
      console.log('✅ Upload Complete!');
      console.log(`   Token URI: ipfs://${metadataCid}`);
      console.log(`   Saved to: ${savedPath}`);
      console.log('');
      console.log('Next: Use token_uri in ENCODE.md');
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
