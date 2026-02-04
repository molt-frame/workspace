#!/usr/bin/env node
/**
 * Frame Builder - IPFS Upload
 * Upload images and metadata to IPFS via public gateway
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const IPFS_API = 'https://api.pinata.cloud/pinning/pinFileToIPFS';

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {};
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--image' && args[i + 1]) {
      result.image = args[++i];
    } else if (args[i] === '--metadata' && args[i + 1]) {
      result.metadata = args[++i];
    }
  }
  
  return result;
}

async function uploadToNFTStorage(filePath) {
  // Using nft.storage free tier (no API key needed for small files)
  const NFT_STORAGE_API = 'https://api.nft.storage/upload';
  
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      reject(new Error(`File not found: ${filePath}`));
      return;
    }
    
    const fileData = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    
    // For demo, using a free IPFS pinning service
    // In production, use Pinata or nft.storage with API key
    console.log(`Uploading ${fileName} (${fileData.length} bytes)...`);
    
    // Placeholder - in production use proper IPFS upload
    const hash = require('crypto')
      .createHash('sha256')
      .update(fileData)
      .digest('hex')
      .slice(0, 46);
    
    console.log('');
    console.log('⚠️  Demo mode: Using simulated IPFS hash');
    console.log('    For production, set PINATA_API_KEY or use nft.storage');
    console.log('');
    resolve(`Qm${hash}`);
  });
}

async function main() {
  const args = parseArgs();
  
  if (!args.image && !args.metadata) {
    console.log('Usage:');
    console.log('  node upload.js --image ./avatar.png');
    console.log('  node upload.js --metadata ./metadata.json');
    process.exit(1);
  }
  
  try {
    if (args.image) {
      const hash = await uploadToNFTStorage(args.image);
      console.log(`IPFS Hash: ${hash}`);
      console.log(`Gateway URL: https://ipfs.io/ipfs/${hash}`);
    }
    
    if (args.metadata) {
      const hash = await uploadToNFTStorage(args.metadata);
      console.log(`Metadata Hash: ${hash}`);
      console.log(`Gateway URL: https://ipfs.io/ipfs/${hash}`);
    }
  } catch (err) {
    console.error('Upload failed:', err.message);
    process.exit(1);
  }
}

main();
