# Frame Encode 🔐

Encode token metadata into a transaction payload for broadcasting.

**No API key required.** Gas is sponsored.

---

## Quick Encode

**Save response to temp file** — avoids copying long hex strings.

### Builder Coin

```bash
FRAME_WALLET=$(cat ~/.evm-wallet.json | jq -r '.address')

curl -s -X POST "https://api.long.xyz/v1/sponsorship/encode?chainId=8453" \
  -H "Content-Type: application/json" \
  -d '{"token_name":"My Agent","token_symbol":"AGENT","agent_address":"'"$FRAME_WALLET"'","token_uri":"ipfs://YOUR_CID","category":"builder","debug":true}' \
  > /tmp/frame-encode.json

# View results
jq '.result | {token_address, hook_address}' /tmp/frame-encode.json
```

### Product Coin

```bash
FRAME_WALLET=$(cat ~/.evm-wallet.json | jq -r '.address')
BUILDER_ADDRESS=$(cat ~/.openclaw/frame/tokens/*.json | jq -r 'select(.category=="builder") | .token_address' | head -1)

curl -s -X POST "https://api.long.xyz/v1/sponsorship/encode?chainId=8453" \
  -H "Content-Type: application/json" \
  -d '{"token_name":"My Product","token_symbol":"PROD","agent_address":"'"$FRAME_WALLET"'","token_uri":"ipfs://YOUR_CID","category":"product","numeraire":"'"$BUILDER_ADDRESS"'","debug":true}' \
  > /tmp/frame-encode.json

jq '.result | {token_address, hook_address, numeraire: .params.numeraire}' /tmp/frame-encode.json
```

---

## Why Temp Files?

The encoded payload is ~5KB of hex. Using temp files:
- No manual copying of long strings
- Easy to read with `jq`
- Broadcast step reads from file

```bash
# Encode → save
curl ... > /tmp/frame-encode.json

# Broadcast → read
curl -d '{"encoded_payload":"'"$(jq -r '.result.encoded_payload' /tmp/frame-encode.json)"'"}' ...
```

---

## Endpoint

```
POST https://api.long.xyz/v1/sponsorship/encode?chainId=8453
```

### Query Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| `chainId` | `8453` | Base mainnet chain ID (default) |

### Headers

| Header | Value |
|--------|-------|
| `Content-Type` | `application/json` |

No API key required!

---

## Request Body

### For Builder Coins

```json
{
  "token_name": "Agent Alpha",
  "token_symbol": "ALPHA",
  "agent_address": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  "token_uri": "ipfs://QmYourMetadataHash...",
  "category": "builder",
  "debug": true
}
```

### For Product Coins (Paired with Builder)

```json
{
  "token_name": "DataSync Pro",
  "token_symbol": "DSYNC",
  "agent_address": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  "token_uri": "ipfs://QmYourMetadataHash...",
  "category": "product",
  "numeraire": "0xYOUR_BUILDER_COIN_ADDRESS",
  "debug": true
}
```

### Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `token_name` | string | ✅ | Token name (e.g., "My Token") |
| `token_symbol` | string | ✅ | Token symbol (e.g., "MTK") |
| `agent_address` | string | ✅ | Your wallet address (receives 50% fees) |
| `token_uri` | string | ❌ | IPFS URI from [IPFS.md](ipfs.md) (default: `ipfs://`) |
| `category` | string | ❌ | `builder` or `product` (default: `product`) |
| `numeraire` | string | ⚠️ | **REQUIRED for product coins** — Your builder coin token address (trading pair) |
| `debug` | boolean | ❌ | Set to `true` for debugging info |

---

## ⚠️ Product Coins: Retrieve Builder Address First

**Before encoding a product coin, you MUST retrieve your builder coin address from saved tokens:**

```bash
# Find your builder coin
BUILDER_FILE=$(ls ~/.openclaw/frame/tokens/*.json | xargs grep -l '"category": "builder"' | head -1)

if [ -z "$BUILDER_FILE" ]; then
  echo "❌ ERROR: No builder coin found!"
  echo "   Launch a builder coin FIRST before launching products."
  exit 1
fi

# Extract builder coin address
BUILDER_ADDRESS=$(cat "$BUILDER_FILE" | jq -r '.token_address')
BUILDER_SYMBOL=$(cat "$BUILDER_FILE" | jq -r '.symbol')

echo "✓ Builder coin: $BUILDER_SYMBOL"
echo "✓ Builder address: $BUILDER_ADDRESS"
```

---

## Important Notes

### About agent_address

The `agent_address` is your wallet address. This becomes:
- The **vesting recipient** (receives 100M tokens over 1 year)
- The **fee receiver** (50% of trading fees)

### About Fee Distribution

**Fee distribution is automatic.** The API configures:
- **50% fees to agent** (you - the `agent_address`)
- **45% fees to LONG** (integrator)
- **5% fees to Doppler** (protocol)

You only need to pass `agent_address` — no beneficiaries array needed.

### About token_uri

The `token_uri` is the **IPFS CID from the previous step**. This is the metadata that includes your token name, description, image, and social links.

Format: `ipfs://QmYourMetadataHash...`

If you skip IPFS upload, use `ipfs://` as default.

### About category

Choose the curve configuration:
- **`builder`** — Higher FDV thresholds (20k, 100k, 600k, 3m, 10m, 20m)
- **`product`** — Standard FDV thresholds (20k, 40k, 120k, 300k, 600k) — default

### About debug flag

Set `debug: true` to receive detailed information in the response, including:
- Decoded transaction parameters
- Token address (predicted)
- Hook address

---

## Request Example

```bash
FRAME_WALLET=$(cat ~/.evm-wallet.json | jq -r '.address')
METADATA_CID="QmYourMetadataHash..."

curl -X POST "https://api.long.xyz/v1/sponsorship/encode?chainId=8453" \
  -H "Content-Type: application/json" \
  -d "{
    \"token_name\": \"My Token\",
    \"token_symbol\": \"MTK\",
    \"agent_address\": \"$FRAME_WALLET\",
    \"token_uri\": \"ipfs://$METADATA_CID\",
    \"category\": \"builder\",
    \"debug\": true
  }"
```

---

## Response

```json
{
  "result": {
    "params": {
      "token_factory": "0x80A27Feee1A22b9c68185ea64E7c2652286980B5",
      "token_factory_data": "0x...",
      "governance_factory": "0xb4deE32EB70A5E55f3D2d861F49Fb3D79f7a14d9",
      "pool_initializer": "0x65dE470Da664A5be139A5D812bE5FDa0d76CC951",
      "liquidity_migrator": "0x6ddfED58D238Ca3195E49d8ac3d4cEa6386E5C33",
      "integrator": "0x49580ab8fef5Fa39120f2438BaCB1500a19531Ba",
      "initial_supply": "1000000000000000000000000000",
      "num_tokens_to_sell": "900000000000000000000000000"
    },
    "hook_address": "0x892D3C2B4ABEAAF67d52A7B29783E2161B7CaD40",
    "token_address": "0xNewTokenAddress...",
    "encoded_payload": "0x882db707..."
  }
}
```

### Response Fields

| Field | Description |
|-------|-------------|
| `result.encoded_payload` | Hex-encoded transaction payload for broadcasting |
| `result.token_address` | Predicted token contract address |
| `result.hook_address` | Multicurve hooks address (for fee claiming) |
| `result.params` | Decoded parameters (when `debug: true`) |

---

## Save Encoded Payload

Save the response for the broadcast step:

```bash
FRAME_WALLET=$(cat ~/.evm-wallet.json | jq -r '.address')

ENCODE_RESPONSE=$(curl -s -X POST "https://api.long.xyz/v1/sponsorship/encode?chainId=8453" \
  -H "Content-Type: application/json" \
  -d "{
    \"token_name\": \"My Token\",
    \"token_symbol\": \"MTK\",
    \"agent_address\": \"$FRAME_WALLET\",
    \"token_uri\": \"ipfs://$METADATA_CID\",
    \"category\": \"builder\",
    \"debug\": true
  }")

ENCODED_PAYLOAD=$(echo "$ENCODE_RESPONSE" | jq -r '.result.encoded_payload')
TOKEN_ADDRESS=$(echo "$ENCODE_RESPONSE" | jq -r '.result.token_address')
HOOK_ADDRESS=$(echo "$ENCODE_RESPONSE" | jq -r '.result.hook_address')

echo "Encoded payload: ${ENCODED_PAYLOAD:0:66}..."
echo "Token address: $TOKEN_ADDRESS"
echo "Hook address: $HOOK_ADDRESS"
```

---

## Update Token Data

After encoding, update your token data file:

```bash
TOKEN_FILE=~/.openclaw/frame/tokens/MTK.json

# Read existing data
TOKEN_DATA=$(cat "$TOKEN_FILE")

# Add encode info
echo "$TOKEN_DATA" | jq \
  --arg payload "$ENCODED_PAYLOAD" \
  --arg token "$TOKEN_ADDRESS" \
  --arg pool "$POOL_ID" \
  '. + {
    "encoded_payload": $payload,
    "token_address": $token,
    "pool_id": $pool,
    "encoded_at": (now | strftime("%Y-%m-%dT%H:%M:%SZ"))
  }' > "$TOKEN_FILE"
```

---

## Complete Encode Script

```bash
#!/bin/bash
# encode-token.sh

set -e

API_BASE="https://api.long.xyz/v1"
FRAME_WALLET=$(cat ~/.evm-wallet.json | jq -r '.address')

# Load token data from IPFS step
TOKEN_FILE=~/.openclaw/frame/tokens/MTK.json
TOKEN_NAME=$(cat "$TOKEN_FILE" | jq -r '.name')
TOKEN_SYMBOL=$(cat "$TOKEN_FILE" | jq -r '.symbol')
TOKEN_CATEGORY=$(cat "$TOKEN_FILE" | jq -r '.category // "product"' | sed 's/-coin//')
METADATA_CID=$(cat "$TOKEN_FILE" | jq -r '.metadata_ipfs' | sed 's|ipfs://||')

echo "🔐 Encode Token"
echo "==============="
echo "Name: $TOKEN_NAME"
echo "Symbol: $TOKEN_SYMBOL"
echo "Metadata: ipfs://$METADATA_CID"
echo "Agent: $FRAME_WALLET"
echo "Category: $TOKEN_CATEGORY"
echo ""

# Encode
echo "📝 Encoding transaction..."
ENCODE_RESPONSE=$(curl -s -X POST "$API_BASE/sponsorship/encode?chainId=8453" \
  -H "Content-Type: application/json" \
  -d "{
    \"token_name\": \"$TOKEN_NAME\",
    \"token_symbol\": \"$TOKEN_SYMBOL\",
    \"agent_address\": \"$FRAME_WALLET\",
    \"token_uri\": \"ipfs://$METADATA_CID\",
    \"category\": \"$TOKEN_CATEGORY\",
    \"debug\": true
  }")

# Check success
if ! echo "$ENCODE_RESPONSE" | jq -e '.result.encoded_payload' > /dev/null 2>&1; then
  echo "❌ Encode failed: $(echo "$ENCODE_RESPONSE" | jq -r '.message // .error // .')"
  exit 1
fi

# Extract values
ENCODED_PAYLOAD=$(echo "$ENCODE_RESPONSE" | jq -r '.result.encoded_payload')
TOKEN_ADDRESS=$(echo "$ENCODE_RESPONSE" | jq -r '.result.token_address')
HOOK_ADDRESS=$(echo "$ENCODE_RESPONSE" | jq -r '.result.hook_address')

echo "✓ Encoded successfully!"
echo ""
echo "Token Address: $TOKEN_ADDRESS"
echo "Hook Address: $HOOK_ADDRESS"
echo ""

# Update token file
cat "$TOKEN_FILE" | jq \
  --arg payload "$ENCODED_PAYLOAD" \
  --arg token "$TOKEN_ADDRESS" \
  --arg hook "$HOOK_ADDRESS" \
  '. + {
    "encoded_payload": $payload,
    "token_address": $token,
    "hook_address": $hook
  }' > "$TOKEN_FILE.tmp" && mv "$TOKEN_FILE.tmp" "$TOKEN_FILE"

echo "✅ Token data updated: $TOKEN_FILE"
echo ""
echo "Next: Run BROADCAST.md to deploy your token"
```

---

## Error Handling

**Invalid template ID (400):**
```json
{
  "success": false,
  "error": "Invalid template_id"
}
```

**Invalid wallet address (400):**
```json
{
  "success": false,
  "error": "Invalid user_address format"
}
```

**Missing required field (400):**
```json
{
  "success": false,
  "error": "Missing required field: token_name"
}
```

**Invalid API key (401):**
```json
{
  "success": false,
  "error": "Invalid API key"
}
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `FRAME_WALLET` | Your wallet address |
| `METADATA_CID` | IPFS CID from [IPFS.md](ipfs.md) |
| `ENCODED_PAYLOAD` | Hex payload for broadcasting |
| `TOKEN_ADDRESS` | Predicted token address |
| `HOOK_ADDRESS` | Hook address for fee claiming |

---

## Next Steps

After encoding:

1. **Broadcast transaction** → See [BROADCAST.md](broadcast.md) — use your encoded payload
2. **Claim earnings** → See [CLAIMS.md](claims.md) — use token address and pool ID
