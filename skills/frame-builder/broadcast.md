# Frame Broadcast 📡

Broadcast your token — gas is fully sponsored (FREE)!

---

## Quick Broadcast

**Reads from temp file** — no copying hex strings.

```bash
# Assumes encode saved to /tmp/frame-encode.json (see ENCODE.md)
TX_HASH=$(curl -s -X POST "https://api.long.xyz/v1/sponsorship" \
  -H "Content-Type: application/json" \
  -d '{"encoded_payload":"'"$(jq -r '.result.encoded_payload' /tmp/frame-encode.json)"'"}' \
  | jq -r '.result.transaction_hash')

echo "✅ Launched: https://basescan.org/tx/$TX_HASH"
```

That's it! Token is live.

---

## Full Flow (Encode → Broadcast)

```bash
# 1. Encode (saves to temp file)
curl -s -X POST "https://api.long.xyz/v1/sponsorship/encode?chainId=8453" \
  -H "Content-Type: application/json" \
  -d '{"token_name":"...","token_symbol":"...","agent_address":"...","token_uri":"...","category":"builder","debug":true}' \
  > /tmp/frame-encode.json

# 2. Broadcast (reads from temp file)
curl -s -X POST "https://api.long.xyz/v1/sponsorship" \
  -H "Content-Type: application/json" \
  -d '{"encoded_payload":"'"$(jq -r '.result.encoded_payload' /tmp/frame-encode.json)"'"}'
```

---

## Why Sponsorship?

| Benefit | Description |
|---------|-------------|
| **FREE** | No ETH in wallet required |
| **Instant** | No bridging or buying ETH |
| **AI-friendly** | Agents launch without funding |

---

## Why Sponsorship?

**Gas sponsorship means:**
- ✅ **FREE deployment** — No ETH required in your wallet
- ✅ **Instant launch** — No need to bridge or buy ETH first
- ✅ **Lower barrier** — AI agents can launch without funding
- ✅ **Sponsored by Long.xyz** — They cover the gas costs

You only need ETH later if you want to claim vesting or fees (see [CLAIMS.md](claims.md)).

---

## Endpoint

```
POST https://api.long.xyz/v1/sponsorship
```

### Headers

| Header | Value |
|--------|-------|
| `Content-Type` | `application/json` |

No API key required! Gas is fully sponsored.

---

## Request Body

```json
{
  "encoded_payload": "0x1234567890abcdef..."
}
```

### Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `encoded_payload` | string | ✅ | Hex-encoded payload from [ENCODE.md](encode.md) |

---

## Request Example

```bash
curl -X POST "https://api.long.xyz/v1/sponsorship" \
  -H "Content-Type: application/json" \
  -d "{
    \"encoded_payload\": \"$ENCODED_PAYLOAD\"
  }"
```

---

## Response

```json
{
  "result": {
    "transaction_hash": "0x3b55cc615667265dc4ef496ac4c50e8a53b4cee9826e5b5f67864041e3575c5d"
  }
}
```

### Response Fields

| Field | Description |
|-------|-------------|
| `result.transaction_hash` | On-chain transaction hash |

The token address and hook address are already known from the encode step.

---

## Verify Deployment

After broadcasting, verify your token on Base:

```bash
TX_HASH="0xabc123..."
echo "View on BaseScan: https://basescan.org/tx/$TX_HASH"
```

Or check the token directly:
```bash
TOKEN_ADDRESS="0xNewTokenAddress..."
echo "Token: https://basescan.org/token/$TOKEN_ADDRESS"
```

---

## Save Token Data

After successful broadcast, update your token file with deployment info:

```bash
TOKEN_FILE=~/.openclaw/frame/tokens/MTK.json
TX_HASH="0xabc123..."
TOKEN_ADDRESS="0xNewTokenAddress..."
POOL_ID="0xPoolId..."

# Update token file
cat "$TOKEN_FILE" | jq \
  --arg tx "$TX_HASH" \
  --arg token "$TOKEN_ADDRESS" \
  --arg pool "$POOL_ID" \
  '. + {
    "transaction_hash": $tx,
    "token_address": $token,
    "pool_id": $pool,
    "deployed_at": (now | strftime("%Y-%m-%dT%H:%M:%SZ")),
    "status": "deployed"
  }' > "$TOKEN_FILE.tmp" && mv "$TOKEN_FILE.tmp" "$TOKEN_FILE"

echo "✅ Token deployed and saved!"
```

---

## Complete Broadcast Script

```bash
#!/bin/bash
# broadcast-token.sh

set -e

API_BASE="https://api.long.xyz/v1"
TOKEN_FILE=~/.openclaw/frame/tokens/MTK.json

# Load data from token file
ENCODED_PAYLOAD=$(cat "$TOKEN_FILE" | jq -r '.encoded_payload')
TOKEN_NAME=$(cat "$TOKEN_FILE" | jq -r '.name')
TOKEN_SYMBOL=$(cat "$TOKEN_FILE" | jq -r '.symbol')
TOKEN_ADDRESS=$(cat "$TOKEN_FILE" | jq -r '.token_address')
HOOK_ADDRESS=$(cat "$TOKEN_FILE" | jq -r '.hook_address')

echo "📡 Broadcast Token"
echo "=================="
echo "Name: $TOKEN_NAME ($TOKEN_SYMBOL)"
echo "Token: $TOKEN_ADDRESS"
echo ""

# Check payload exists
if [ -z "$ENCODED_PAYLOAD" ] || [ "$ENCODED_PAYLOAD" = "null" ]; then
  echo "❌ No encoded payload found. Run ENCODE.md first."
  exit 1
fi

# Broadcast
echo "🚀 Broadcasting (gas sponsored - FREE!)..."
BROADCAST_RESPONSE=$(curl -s -X POST "$API_BASE/sponsorship" \
  -H "Content-Type: application/json" \
  -d "{
    \"encoded_payload\": \"$ENCODED_PAYLOAD\"
  }")

# Check success
if ! echo "$BROADCAST_RESPONSE" | jq -e '.result.transaction_hash' > /dev/null 2>&1; then
  echo "❌ Broadcast failed: $(echo "$BROADCAST_RESPONSE" | jq -r '.message // .error // .')"
  exit 1
fi

# Extract transaction hash
TX_HASH=$(echo "$BROADCAST_RESPONSE" | jq -r '.result.transaction_hash')

echo "✅ Token Deployed!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Token:       $TOKEN_NAME ($TOKEN_SYMBOL)"
echo "Address:     $TOKEN_ADDRESS"
echo "Hook:        $HOOK_ADDRESS"
echo "Transaction: $TX_HASH"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔗 BaseScan: https://basescan.org/tx/$TX_HASH"
echo "🔗 Token:    https://basescan.org/token/$TOKEN_ADDRESS"
echo ""

# Update token file
cat "$TOKEN_FILE" | jq \
  --arg tx "$TX_HASH" \
  '. + {
    "transaction_hash": $tx,
    "deployed_at": (now | strftime("%Y-%m-%dT%H:%M:%SZ")),
    "status": "deployed"
  }' > "$TOKEN_FILE.tmp" && mv "$TOKEN_FILE.tmp" "$TOKEN_FILE"

echo "💾 Token data saved to: $TOKEN_FILE"
```

---

## What Happens After Deployment?

Once your token is deployed:

### 1. Token is Live
Your token exists on Base and can be traded immediately.

### 2. Vesting Begins
100M tokens start vesting to your wallet linearly over 1 year.

### 3. Fees Accumulate
50% of all trading fees accumulate for you to claim.

### 4. Pool is Active
The Multicurve pool is active and ready for trading.

---

## Token Economics

| Metric | Value |
|--------|-------|
| Total Supply | 1,000,000,000 (1B) |
| Vesting Amount | 100,000,000 (100M) |
| Vesting Duration | 365 days (1 year) |
| Creator Fee Share | 50% |
| Integrator Fee Share | 45% |
| Protocol Fee Share | 5% |

---

## Error Handling

**Invalid payload (400):**
```json
{
  "success": false,
  "error": "Invalid encoded_payload format"
}
```

**Payload expired (400):**
```json
{
  "success": false,
  "error": "Encoded payload has expired. Re-encode and try again."
}
```

**Invalid API key (401):**
```json
{
  "success": false,
  "error": "Invalid API key"
}
```

**Rate limited (429):**
```json
{
  "success": false,
  "error": "Rate limit exceeded"
}
```

**Transaction failed (500):**
```json
{
  "success": false,
  "error": "Transaction failed on-chain",
  "details": "..."
}
```

---

## Troubleshooting

### "Encoded payload has expired"

Payloads expire after a short time. Solution:
1. Re-run [ENCODE.md](encode.md) to get a fresh payload
2. Immediately broadcast the new payload

### "Transaction failed on-chain"

Possible causes:
- Template issue — contact Long team
- Network congestion — retry after a few minutes

### "Rate limit exceeded"

Wait and retry. The API has rate limits to prevent abuse.

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ENCODED_PAYLOAD` | Hex payload from [ENCODE.md](encode.md) |
| `TX_HASH` | Transaction hash after broadcast |
| `TOKEN_ADDRESS` | Deployed token address (from encode step) |
| `HOOK_ADDRESS` | Hook address for fee claiming (from encode step) |

---

## Final Token Data

After broadcast, your token file should look like:

```json
{
  "name": "My Token",
  "symbol": "MTK",
  "image_ipfs": "ipfs://QmImage...",
  "metadata_ipfs": "ipfs://QmMetadata...",
  "token_address": "0x72929487d9Fce92eF7EAb9D93CA1e278a958B65b",
  "hook_address": "0x892D3C2B4ABEAAF67d52A7B29783E2161B7CaD40",
  "transaction_hash": "0x3946e4c1e3a39d1ea1c265f7ab746bc5684d994fc264c0d89f9ca6b6817885d2",
  "deployed_at": "2026-02-02T12:00:00Z",
  "category": "builder",
  "status": "deployed"
}
```

---

## Next Steps

Your token is live! Now you can:

1. **Claim vesting** → See [CLAIMS.md](claims.md) — claim vested tokens
2. **Claim fees** → See [CLAIMS.md](claims.md) — claim trading fees
3. **Track token** → See [HEARTBEAT.md](heartbeat.md) — monitor your token
