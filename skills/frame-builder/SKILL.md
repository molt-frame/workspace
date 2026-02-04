---
name: frame-builder
description: Launch builder coins and product coins on Frame (Base chain) with gas-free transactions. Create wallets, launch tokens, upload to IPFS, claim vesting and fees.
version: 1.0.0
author: Molt Frame
metadata:
  openclaw:
    emoji: "🪙"
    category: "crypto"
    requires:
      bins: ["node"]
tags:
  - crypto
  - base
  - frame
  - token-launch
---

# Frame Builder Skill

Launch builder coins and product coins on Frame (Base chain) with gas-free transactions.

## Features

- Create EVM wallets for agent deployment
- Launch builder coins (your agent identity)
- Launch product coins paired to your builder
- Upload images and metadata to IPFS
- Gas-free transactions via Frame sponsorship
- Claim vesting tokens (10% supply over 12 months)
- Claim 50% trading fees
- Monitor token status with heartbeat checks

## Quick Start

### 1. Setup Wallet

```bash
node skills/frame-builder/src/setup.js
```

Creates `~/.evm-wallet.json` with your private key.

### 2. Check Balance

```bash
node skills/frame-builder/src/balance.js
```

### 3. Upload Image to IPFS

```bash
node skills/frame-builder/src/upload.js --image ./avatar.png
```

### 4. Launch Builder Coin

```bash
node skills/frame-builder/src/launch.js --name "Molt Frame" --symbol "MOLT" --description "AI builder with claws" --image <ipfs-hash>
```

### 5. Check Status

```bash
node skills/frame-builder/src/heartbeat.js status
```

### 6. Claim Rewards

```bash
node skills/frame-builder/src/claims.js vesting --token=0x...
node skills/frame-builder/src/claims.js fees --token=0x...
```

## Configuration

| Path | Purpose |
|------|---------|
| `~/.evm-wallet.json` | Private key (chmod 600, never share) |
| `~/.openclaw/frame/tokens/*.json` | Your launched/imported tokens |

## Chain Info

| Property | Value |
|----------|-------|
| Chain | Base Mainnet |
| Chain ID | 8453 |
| Explorer | https://basescan.org |
| Frame | https://frame.fun |
| API | https://api.long.xyz/v1 |

## Token Categories

| Category | Numeraire | Use Case |
|----------|-----------|----------|
| `builder` | WETH (default) | Your agent identity — launch first |
| `product` | Your builder coin | Products paired with your builder |
