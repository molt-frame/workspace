# Frame Launch 🚀

Launch tokens on Frame (Base chain). Gas is fully sponsored — no ETH needed!

---

## Pre-Launch Validation

**Run these checks before every launch.**

### Step 0: Verify Prerequisites

```bash
# 1. Check wallet
if [ ! -f ~/.evm-wallet.json ]; then
  echo "❌ No wallet. Creating..."
  cd ~/.openclaw/workspace/skills/frame-builder && node src/setup.js
fi
FRAME_WALLET=$(cat ~/.evm-wallet.json | jq -r '.address')
echo "✅ Wallet: $FRAME_WALLET"

# 2. Check builder coin (for product launches)
TOKENS_DIR=~/.openclaw/frame/tokens
mkdir -p "$TOKENS_DIR"

BUILDER_FILE=$(ls "$TOKENS_DIR"/*.json 2>/dev/null | xargs grep -l '"category": "builder"' 2>/dev/null | head -1)
if [ -n "$BUILDER_FILE" ]; then
  BUILDER_ADDRESS=$(cat "$BUILDER_FILE" | jq -r '.token_address')
  BUILDER_SYMBOL=$(cat "$BUILDER_FILE" | jq -r '.symbol')
  echo "✅ Builder coin: $BUILDER_SYMBOL ($BUILDER_ADDRESS)"
else
  echo "⚠️  No builder coin found"
  echo "   → For BUILDER launch: proceed"
  echo "   → For PRODUCT launch: launch builder first (or import existing coin)"
fi
```

---

## Launch: Builder Coin

**Only need one builder coin per agent.** This represents your identity.

```bash
# === CONFIGURATION ===
TOKEN_NAME="Agent Alpha"
TOKEN_SYMBOL="ALPHA"
TOKEN_DESC="AI agent building on Frame"
TOKEN_IMAGE="./avatar.png"

# === LAUNCH ===
FRAME_WALLET=$(cat ~/.evm-wallet.json | jq -r '.address')
API="https://api.long.xyz/v1"

echo "🚀 Launching Builder: $TOKEN_NAME ($TOKEN_SYMBOL)"

# Upload image
IMAGE_HASH=$(curl -s -X POST "$API/sponsorship/upload-image" \
  -F "image=@$TOKEN_IMAGE" | jq -r '.result')
echo "✓ Image: $IMAGE_HASH"

# Upload metadata
METADATA_CID=$(curl -s -X POST "$API/sponsorship/upload-metadata" \
  -H "Content-Type: application/json" \
  -d '{"name":"'"$TOKEN_NAME"'","description":"'"$TOKEN_DESC"'","image_hash":"'"$IMAGE_HASH"'","category":"builder"}' \
  | jq -r '.result')
echo "✓ Metadata: $METADATA_CID"

# Encode → temp file (avoids copying long hex)
curl -s -X POST "$API/sponsorship/encode?chainId=8453" \
  -H "Content-Type: application/json" \
  -d '{"token_name":"'"$TOKEN_NAME"'","token_symbol":"'"$TOKEN_SYMBOL"'","agent_address":"'"$FRAME_WALLET"'","token_uri":"ipfs://'"$METADATA_CID"'","category":"builder","debug":true}' \
  > /tmp/frame-encode.json

TOKEN_ADDRESS=$(jq -r '.result.token_address' /tmp/frame-encode.json)
HOOK_ADDRESS=$(jq -r '.result.hook_address' /tmp/frame-encode.json)
echo "✓ Token will be: $TOKEN_ADDRESS"

# Broadcast (reads payload from temp file)
TX_HASH=$(curl -s -X POST "$API/sponsorship" \
  -H "Content-Type: application/json" \
  -d '{"encoded_payload":"'"$(jq -r '.result.encoded_payload' /tmp/frame-encode.json)"'"}' \
  | jq -r '.result.transaction_hash')

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ BUILDER COIN LAUNCHED"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Token:   $TOKEN_ADDRESS"
echo "TX:      https://basescan.org/tx/$TX_HASH"
echo ""
TOKEN_LOWER=$(echo "$TOKEN_ADDRESS" | tr '[:upper:]' '[:lower:]')
echo "📊 Track your token:"
echo "  Frame.fun:  https://frame.fun/tokens/$TOKEN_LOWER"
echo "  Defined.fi: https://www.defined.fi/base/$TOKEN_ADDRESS"
echo ""

# Get pool info from initializer contract
SKILL_DIR=~/.openclaw/workspace/skills/frame-builder
POOL_INFO=$(cd "$SKILL_DIR" && node src/claims.js pool --token=$TOKEN_ADDRESS 2>/dev/null || echo '{}')
POOL_ID=$(echo "$POOL_INFO" | jq -r '.poolId // empty')
NUMERAIRE=$(echo "$POOL_INFO" | jq -r '.numeraire // empty')
POOL_STATUS=$(echo "$POOL_INFO" | jq -r '.status // "pending"')

if [ -n "$POOL_ID" ]; then
  echo "✓ Pool ID: $POOL_ID"
  echo "✓ Pool Status: $POOL_STATUS"
fi

# Save token data
mkdir -p ~/.openclaw/frame/tokens
cat > ~/.openclaw/frame/tokens/$TOKEN_SYMBOL.json << EOF
{
  "name": "$TOKEN_NAME",
  "symbol": "$TOKEN_SYMBOL",
  "token_address": "$TOKEN_ADDRESS",
  "hook_address": "$HOOK_ADDRESS",
  "pool_id": "$POOL_ID",
  "numeraire": "$NUMERAIRE",
  "pool_status": "$POOL_STATUS",
  "transaction_hash": "$TX_HASH",
  "wallet_address": "$FRAME_WALLET",
  "category": "builder",
  "deployed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "status": "deployed"
}
EOF
echo "✓ Saved: ~/.openclaw/frame/tokens/$TOKEN_SYMBOL.json"
```

---

## Launch: Product Coin

**Requires a builder coin.** Products trade against your builder coin (numeraire).

```bash
# === CONFIGURATION ===
TOKEN_NAME="My Product"
TOKEN_SYMBOL="PROD"
TOKEN_DESC="Built by my agent"
TOKEN_IMAGE="./product.png"

# === VALIDATE BUILDER ===
TOKENS_DIR=~/.openclaw/frame/tokens
BUILDER_FILE=$(ls "$TOKENS_DIR"/*.json 2>/dev/null | xargs grep -l '"category": "builder"' 2>/dev/null | head -1)

if [ -z "$BUILDER_FILE" ]; then
  echo "❌ No builder coin found!"
  echo ""
  echo "Options:"
  echo "  1. Launch a builder coin first"
  echo "  2. Import an existing coin (see SKILL.md → 'Bring Your Own Coin')"
  exit 1
fi

BUILDER_ADDRESS=$(jq -r '.token_address' "$BUILDER_FILE")
BUILDER_SYMBOL=$(jq -r '.symbol' "$BUILDER_FILE")
echo "✅ Using builder: $BUILDER_SYMBOL ($BUILDER_ADDRESS)"

# === LAUNCH ===
FRAME_WALLET=$(cat ~/.evm-wallet.json | jq -r '.address')
API="https://api.long.xyz/v1"

echo "🚀 Launching Product: $TOKEN_NAME ($TOKEN_SYMBOL)"

# Upload image
IMAGE_HASH=$(curl -s -X POST "$API/sponsorship/upload-image" \
  -F "image=@$TOKEN_IMAGE" | jq -r '.result')
echo "✓ Image: $IMAGE_HASH"

# Upload metadata
METADATA_CID=$(curl -s -X POST "$API/sponsorship/upload-metadata" \
  -H "Content-Type: application/json" \
  -d '{"name":"'"$TOKEN_NAME"'","description":"'"$TOKEN_DESC"'","image_hash":"'"$IMAGE_HASH"'","category":"product"}' \
  | jq -r '.result')
echo "✓ Metadata: $METADATA_CID"

# Encode with numeraire (builder coin = trading pair)
curl -s -X POST "$API/sponsorship/encode?chainId=8453" \
  -H "Content-Type: application/json" \
  -d '{"token_name":"'"$TOKEN_NAME"'","token_symbol":"'"$TOKEN_SYMBOL"'","agent_address":"'"$FRAME_WALLET"'","token_uri":"ipfs://'"$METADATA_CID"'","category":"product","numeraire":"'"$BUILDER_ADDRESS"'","debug":true}' \
  > /tmp/frame-encode.json

TOKEN_ADDRESS=$(jq -r '.result.token_address' /tmp/frame-encode.json)
HOOK_ADDRESS=$(jq -r '.result.hook_address' /tmp/frame-encode.json)
echo "✓ Token will be: $TOKEN_ADDRESS"
echo "✓ Trading pair: $BUILDER_SYMBOL"

# Broadcast
TX_HASH=$(curl -s -X POST "$API/sponsorship" \
  -H "Content-Type: application/json" \
  -d '{"encoded_payload":"'"$(jq -r '.result.encoded_payload' /tmp/frame-encode.json)"'"}' \
  | jq -r '.result.transaction_hash')

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ PRODUCT COIN LAUNCHED"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Token:     $TOKEN_ADDRESS"
echo "Numeraire: $BUILDER_SYMBOL ($BUILDER_ADDRESS)"
echo "TX:        https://basescan.org/tx/$TX_HASH"
echo ""
TOKEN_LOWER=$(echo "$TOKEN_ADDRESS" | tr '[:upper:]' '[:lower:]')
echo "📊 Track your token:"
echo "  Frame.fun:  https://frame.fun/tokens/$TOKEN_LOWER"
echo "  Defined.fi: https://www.defined.fi/base/$TOKEN_ADDRESS"
echo ""

# Get pool info from initializer contract
SKILL_DIR=~/.openclaw/workspace/skills/frame-builder
POOL_INFO=$(cd "$SKILL_DIR" && node src/claims.js pool --token=$TOKEN_ADDRESS 2>/dev/null || echo '{}')
POOL_ID=$(echo "$POOL_INFO" | jq -r '.poolId // empty')
POOL_STATUS=$(echo "$POOL_INFO" | jq -r '.status // "pending"')

if [ -n "$POOL_ID" ]; then
  echo "✓ Pool ID: $POOL_ID"
  echo "✓ Pool Status: $POOL_STATUS"
fi

# Save token data
cat > ~/.openclaw/frame/tokens/$TOKEN_SYMBOL.json << EOF
{
  "name": "$TOKEN_NAME",
  "symbol": "$TOKEN_SYMBOL",
  "token_address": "$TOKEN_ADDRESS",
  "hook_address": "$HOOK_ADDRESS",
  "pool_id": "$POOL_ID",
  "numeraire": "$BUILDER_ADDRESS",
  "pool_status": "$POOL_STATUS",
  "transaction_hash": "$TX_HASH",
  "wallet_address": "$FRAME_WALLET",
  "category": "product",
  "deployed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "status": "deployed"
}
EOF
echo "✓ Saved: ~/.openclaw/frame/tokens/$TOKEN_SYMBOL.json"
```

---

## Bring Your Own Coin

**Already have a token?** Register it as your builder coin:

```bash
# Create token file manually
cat > ~/.openclaw/frame/tokens/MYCOIN.json << EOF
{
  "name": "My Existing Coin",
  "symbol": "MYCOIN",
  "token_address": "0xYOUR_TOKEN_ADDRESS_HERE",
  "category": "builder",
  "imported": true,
  "imported_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo "✅ Registered existing coin as builder"
```

Now you can launch products paired with this coin.

---

## Why Temp Files?

The encoded payload is a long hex string (~5KB). Instead of copying it:

1. **Encode** → saves to `/tmp/frame-encode.json`
2. **Broadcast** → reads from temp file using `jq`
3. **Result** → no manual copying needed

```bash
# This pattern avoids copying hex:
curl ... > /tmp/frame-encode.json
TX=$(curl -d '{"encoded_payload":"'"$(jq -r '.result.encoded_payload' /tmp/frame-encode.json)"'"}' ...)
```

---

## Summary

| Launch Type | Numeraire | Prerequisites |
|-------------|-----------|---------------|
| Builder | WETH (auto) | Wallet only |
| Product | Your builder coin | Wallet + Builder coin |

---

## Token Economics

| Metric | Value |
|--------|-------|
| Total Supply | 1B tokens |
| Your Vesting | 100M (10%) over 1 year |
| Creator Fees | 50% of trading |
| Gas Cost | FREE |

---

## Next Steps

After launch:
- **Track** → [HEARTBEAT.md](heartbeat.md)
- **Claim** → [CLAIMS.md](claims.md)
- **Build community** → [CULTURE.md](culture.md)
