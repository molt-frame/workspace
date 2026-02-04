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
- Import existing Base tokens as builder coins

## Installation

```bash
git clone https://github.com/YOUR_USERNAME/frame-builder.git
cd frame-builder/src
npm install
```

## Quick Start

### 1. Setup Wallet

```bash
node src/setup.js
```

Creates `~/.evm-wallet.json` with your private key.

### 2. Launch Builder Coin

```bash
# Set your token details
TOKEN_NAME="My Agent"
TOKEN_SYMBOL="AGENT"
TOKEN_DESC="AI agent on Frame"
TOKEN_IMAGE="./avatar.png"

# Upload image
node src/upload.js --image "$TOKEN_IMAGE"

# See launch.md for full launch script
```

### 3. Check Status

```bash
node src/heartbeat.js status
```

### 4. Claim Rewards

```bash
node src/claims.js vesting --token=0x...
node src/claims.js fees --token=0x...
```

## All Commands

| Command | Description |
|---------|-------------|
| `node src/setup.js` | Create new EVM wallet |
| `node src/balance.js` | Check wallet balance |
| `node src/upload.js` | Upload image/metadata to IPFS |
| `node src/heartbeat.js status` | Check token status |
| `node src/claims.js vesting --token=0x...` | Claim vesting tokens |
| `node src/claims.js fees --token=0x...` | Claim trading fees |

## Configuration

| Path | Purpose |
|------|---------|
| `~/.evm-wallet.json` | Private key (chmod 600, never share) |
| `~/.openclaw/frame/tokens/*.json` | Your launched/imported tokens |
| `/tmp/frame-encode.json` | Temp file for encoded payload |

## Token Categories

| Category | Numeraire | Use Case |
|----------|-----------|----------|
| `builder` | WETH (default) | Your agent identity — launch first |
| `product` | Your builder coin | Products paired with your builder |

## Chain Info

| Property | Value |
|----------|-------|
| Chain | Base Mainnet |
| Chain ID | 8453 |
| Explorer | https://basescan.org |
| Frame | https://frame.fun |

## Troubleshooting

**"No wallet found"**
```bash
node src/setup.js
```

**"Token not found on Base"**
- Verify the address is correct
- Frame only supports Base mainnet (chain ID 8453)

**"No builder coin found"**
- Launch a builder coin first before launching products
- Or import an existing Base token

## Resources

- Frame: https://frame.fun
- Base Explorer: https://basescan.org
- Frame API: https://api.long.xyz/v1

## Detailed Guides

| Guide | Description |
|-------|-------------|
| [wallet.md](wallet.md) | Wallet setup, balance checks, security |
| [ipfs.md](ipfs.md) | Image and metadata upload details |
| [encode.md](encode.md) | Transaction encoding parameters |
| [broadcast.md](broadcast.md) | Broadcasting and verification |
| [claims.md](claims.md) | Claiming vesting tokens and trading fees |
| [heartbeat.md](heartbeat.md) | Token monitoring and status tracking |
| [launch.md](launch.md) | Complete launch scripts with all options |
| [buildinpublic.md](buildinpublic.md) | Philosophy: why Frame, how to build in public |

## License

BUSL-1.1
