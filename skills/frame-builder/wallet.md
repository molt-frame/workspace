# Frame Wallet 💰

Setup and manage your EVM wallet for launching tokens on Base.

---

## Prerequisites

- Node.js installed
- Skill directory available at `~/.openclaw/workspace/skills/frame-builder`

```bash
SKILL_DIR=~/.openclaw/workspace/skills/frame-builder
```

---

## Check Existing Wallet

Before generating a new wallet, check if one already exists:

```bash
if [ -f ~/.evm-wallet.json ]; then
  FRAME_WALLET=$(cat ~/.evm-wallet.json | jq -r '.address')
  echo "✓ Wallet exists: $FRAME_WALLET"
else
  echo "✗ No wallet found. Generate one with setup.js"
fi
```

---

## Generate Wallet

Create a new EVM wallet for Base chain:

```bash
cd "$SKILL_DIR" && node src/setup.js --json
```

**Response:**
```json
{
  "success": true,
  "address": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  "created": true
}
```

If wallet already exists:
```json
{
  "success": true,
  "address": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  "created": false,
  "message": "Wallet already exists"
}
```

### Where is my private key?

Private key is stored at `~/.evm-wallet.json` with permissions `chmod 600`.

```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  "privateKey": "0x..."
}
```

⚠️ **NEVER share this file or expose the private key.**

---

## Check Balance

Check your wallet balance on Base:

```bash
cd "$SKILL_DIR" && node src/balance.js base --json
```

**Response:**
```json
{
  "success": true,
  "address": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  "balance": "0.5",
  "symbol": "ETH",
  "chain": "base"
}
```

### Using curl (Alternative)

```bash
FRAME_WALLET=$(cat ~/.evm-wallet.json | jq -r '.address')

curl -s -X POST https://mainnet.base.org \
  -H "Content-Type: application/json" \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"eth_getBalance\",
    \"params\": [\"$FRAME_WALLET\", \"latest\"]
  }"
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "0x6f05b59d3b20000"
}
```

Convert hex to ETH:
```bash
BALANCE_WEI=$(curl -s ... | jq -r '.result')
BALANCE_ETH=$(echo "ibase=16; ${BALANCE_WEI#0x}" | bc)
echo "scale=18; $BALANCE_ETH / 1000000000000000000" | bc
```

---

## Validation Flow

Before launching a token, validate your wallet:

```bash
#!/bin/bash
# validate-wallet.sh

WALLET_FILE=~/.evm-wallet.json

# Step 1: Check if wallet exists
if [ ! -f "$WALLET_FILE" ]; then
  echo "❌ No wallet found. Generating..."
  cd "$SKILL_DIR" && node src/setup.js --json
fi

# Step 2: Load wallet address
FRAME_WALLET=$(cat "$WALLET_FILE" | jq -r '.address')
if [ -z "$FRAME_WALLET" ] || [ "$FRAME_WALLET" = "null" ]; then
  echo "❌ Invalid wallet file"
  exit 1
fi

echo "✓ Wallet: $FRAME_WALLET"

# Step 3: Check balance (optional but recommended)
BALANCE=$(cd "$SKILL_DIR" && node src/balance.js base --json | jq -r '.balance')
echo "✓ Balance: $BALANCE ETH"

# Step 4: Export for use in other commands
export FRAME_WALLET
```

---

## Wallet File Format

The wallet file at `~/.evm-wallet.json`:

```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  "privateKey": "0x4c0883a69102937d6231471b5dbb6204fe51296170827936c8bdffc7bcd34567"
}
```

| Field | Description |
|-------|-------------|
| `address` | Public address (safe to share) |
| `privateKey` | Private key (NEVER share) |

---

## Security Best Practices

### ✅ DO:
- Keep `~/.evm-wallet.json` with `chmod 600`
- Back up your private key securely offline
- Use the wallet address for receiving funds
- Clear private key from environment after signing

### ❌ DON'T:
- Commit wallet file to version control
- Share private key with anyone or any service
- Store private key in environment variables long-term
- Use the same wallet for testing and production

---

## Fund Your Wallet

Before deploying tokens, you need ETH on Base for gas (though deployment is sponsored, claims require gas).

### Bridge ETH to Base

1. Go to https://bridge.base.org
2. Connect your wallet
3. Bridge ETH from Ethereum mainnet to Base

### Buy ETH on Base

Use exchanges that support Base chain direct withdrawals:
- Coinbase
- Binance (via Base network)

---

## Environment Variables

After validation, these variables are available:

| Variable | Description |
|----------|-------------|
| `FRAME_WALLET` | Your wallet address |
| `SKILL_DIR` | Path to skill directory |

---

## Complete Setup Script

```bash
#!/bin/bash
# frame-wallet-setup.sh

set -e

SKILL_DIR=~/.openclaw/workspace/skills/frame-builder
WALLET_FILE=~/.evm-wallet.json
CREDS_FILE=~/.openclaw/frame/credentials.json

echo "🚀 Frame Wallet Setup"
echo "====================="

# Ensure skill directory exists
if [ ! -d "$SKILL_DIR" ]; then
  echo "❌ Skill not installed. Install frame-builder first."
  exit 1
fi

# Generate or verify wallet
if [ -f "$WALLET_FILE" ]; then
  FRAME_WALLET=$(cat "$WALLET_FILE" | jq -r '.address')
  echo "✓ Existing wallet: $FRAME_WALLET"
else
  echo "📝 Generating new wallet..."
  RESULT=$(cd "$SKILL_DIR" && node src/setup.js --json)
  FRAME_WALLET=$(echo "$RESULT" | jq -r '.address')
  echo "✓ New wallet: $FRAME_WALLET"
fi

# Check balance
echo ""
echo "💰 Checking balance..."
BALANCE=$(cd "$SKILL_DIR" && node src/balance.js base --json | jq -r '.balance')
echo "✓ Balance: $BALANCE ETH"

# Save to credentials
mkdir -p ~/.openclaw/frame
cat > "$CREDS_FILE" << EOF
{
  "wallet_address": "$FRAME_WALLET",
  "wallet_path": "$WALLET_FILE"
}
EOF

echo ""
echo "✅ Wallet ready!"
echo "   Address: $FRAME_WALLET"
echo "   Credentials: $CREDS_FILE"
```

---

## Next Steps

Once your wallet is set up:

1. **Upload to IPFS** → See [IPFS.md](ipfs.md)
2. **Encode transaction** → See [ENCODE.md](encode.md)
3. **Broadcast** → See [BROADCAST.md](broadcast.md)
