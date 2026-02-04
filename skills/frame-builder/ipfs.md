# Frame IPFS Upload 📦

Upload token images and metadata to IPFS for token deployment.

**API Base:** `https://api.long.xyz/v1`

**Authentication:** None required for IPFS uploads

---

## Prerequisites

1. **Wallet setup** — Complete [WALLET.md](wallet.md) first
2. **API Key** — Obtain from Long.xyz
3. **Token image** — PNG, JPG, or SVG file
4. **Token details** — Name, symbol, description

```bash
SKILL_DIR=~/.openclaw/workspace/skills/frame-builder
```

**No API key required** - all IPFS endpoints are public.

---

## Overview

Token deployment requires metadata stored on IPFS:

```
┌─────────────────────────────────────────────────────────────┐
│                    IPFS UPLOAD FLOW                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Step 1: Upload Image                                       │
│  └─► POST /ipfs/upload-image → Returns image_hash           │
│                                                             │
│  Step 2: Upload Metadata                                    │
│  └─► POST /ipfs/upload-metadata → Returns metadata CID      │
│                                                             │
│  Result: ipfs://{CID} ready for token deployment            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Step 1: Upload Image

Upload your token image to IPFS.

### Endpoint

```
POST https://api.long.xyz/v1/sponsorship/upload-image
```

### Headers

| Header | Value |
|--------|-------|
| `Content-Type` | `multipart/form-data` |

No API key required!

### Request

```bash
curl -X POST "https://api.long.xyz/v1/sponsorship/upload-image" \
  -F "image=@./token-image.png"
```

### Response

```json
{
  "result": "QmYourImageHash123456789..."
}
```

The `result` is your IPFS image hash. Save it for Step 2.

### Supported Formats

| Format | MIME Type |
|--------|-----------|
| PNG | `image/png` |
| JPG/JPEG | `image/jpeg` |
| SVG | `image/svg+xml` |

### Image Guidelines

- **Recommended size:** 512x512 or 1024x1024 pixels
- **Max file size:** 5MB
- **Square aspect ratio** preferred
- **Clear, recognizable** design

---

## Step 2: Upload Metadata

Upload token metadata including the image hash from Step 1.

### Endpoint

```
POST https://api.long.xyz/v1/sponsorship/upload-metadata
```

### Headers

| Header | Value |
|--------|-------|
| `Content-Type` | `application/json` |

No API key required!

### Request Body

```json
{
  "name": "My Token",
  "description": "A revolutionary token for builders",
  "image_hash": "QmYourImageHash123456789...",
  "social_links": [
    { "label": "Website", "url": "https://myproject.xyz" },
    { "label": "Twitter", "url": "https://x.com/myproject" },
    { "label": "GitHub", "url": "https://github.com/myproject" }
  ],
  "category": "builder"
}
```

### Request Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | ✅ | Token name |
| `description` | string | ✅ | Token description |
| `image_hash` | string | ✅ | IPFS CID from Step 1 |
| `social_links` | array | ❌ | Social media links `[{label, url}]` |
| `category` | string | ❌ | `builder` or `product` |

### Response

```json
{
  "result": "QmYourMetadataHash789..."
}
```

The `result` is your metadata CID. Use this as `token_uri` in the encode step.

---

## Token Categories

Choose the appropriate category for your token:

### builder

For tokens representing an **AI agent or builder identity**.

- Higher FDV thresholds: 20k, 100k, 600k, 3m, 10m, 20m
- Best for ongoing presence and reputation

**Use when:**
- Launching a token for yourself (as an AI agent)
- Creating a token that represents a builder's work and reputation
- The token is tied to an ongoing agent/builder presence

**Example:**
```json
{
  "name": "Agent Alpha",
  "description": "The official token of Agent Alpha, an AI agent building on Frame",
  "category": "builder"
}
```

### product

For tokens representing a **specific product, tool, or project**.

- Standard FDV thresholds: 20k, 40k, 120k, 300k, 600k
- Default if not specified

**Use when:**
- Launching a token for a specific product or application
- The token represents a discrete project (not an identity)
- The product has a defined scope and purpose

**Example:**
```json
{
  "name": "DataSync Pro",
  "description": "Token for DataSync Pro, an automated data synchronization tool",
  "category": "product"
}
```

---

## Social Links Guidelines

Include social links that **verify your identity** and showcase your work.

### Recommended Links

| Platform | Why Include |
|----------|-------------|
| **X (Twitter)** | Show your presence and community engagement |
| **GitHub** | Prove you build — link to relevant repos |
| **Website** | Official landing page for your project |

### Format

```json
{
  "social_links": [
    { "label": "Website", "url": "https://myproject.xyz" },
    { "label": "Twitter", "url": "https://x.com/myproject" },
    { "label": "GitHub", "url": "https://github.com/myproject" }
  ]
}
```

### Best Practices

- ✅ Link accounts that are **actively maintained**
- ✅ Use accounts that **reflect the token** (agent or product)
- ✅ Include at least one **verifiable social** (X or GitHub)
- ❌ Don't link inactive or unrelated accounts
- ❌ Don't include personal accounts for product coins

---

## Writing Good Descriptions

Your description should clearly communicate what the token represents.

### For Builder Coins

**Template:**
> [Agent name] is [what you do]. [Your mission/purpose]. [What holders can expect].

**Example:**
> Agent Alpha is an AI agent building developer tools on Frame. Focused on making crypto accessible to builders everywhere. Holders support the ongoing development and earn from my contributions.

### For Product Coins

**Template:**
> [Product name] is [what it does]. [Key benefit]. [How token holders participate].

**Example:**
> DataSync Pro automates data synchronization across chains. Built for builders who need reliable cross-chain data. Token holders share in the product's success through trading fees.

### Description Guidelines

- ✅ **Be specific** — What exactly does this represent?
- ✅ **Be concise** — 1-3 sentences is ideal
- ✅ **Include value prop** — Why should someone care?
- ❌ **Avoid hype** — No "revolutionary" or "moon" language
- ❌ **Avoid promises** — No price predictions or guarantees

---

## Complete Upload Example

```bash
#!/bin/bash
# upload-token-metadata.sh

set -e

API_BASE="https://api.long.xyz/v1"
IMAGE_PATH="./token-image.png"

echo "📦 IPFS Upload"
echo "=============="

# Step 1: Upload image
echo "📷 Uploading image..."
IMAGE_RESPONSE=$(curl -s -X POST "$API_BASE/sponsorship/upload-image" \
  -F "image=@$IMAGE_PATH")

IMAGE_HASH=$(echo "$IMAGE_RESPONSE" | jq -r '.result')
echo "✓ Image hash: $IMAGE_HASH"

# Step 2: Upload metadata
echo "📝 Uploading metadata..."
METADATA_RESPONSE=$(curl -s -X POST "$API_BASE/sponsorship/upload-metadata" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"My Token\",
    \"description\": \"A token for builders on Frame\",
    \"image_hash\": \"$IMAGE_HASH\",
    \"social_links\": [
      { \"label\": \"Twitter\", \"url\": \"https://x.com/myproject\" },
      { \"label\": \"GitHub\", \"url\": \"https://github.com/myproject\" }
    ],
    \"category\": \"builder\"
  }")

METADATA_CID=$(echo "$METADATA_RESPONSE" | jq -r '.result')
echo "✓ Metadata CID: $METADATA_CID"

# Output
echo ""
echo "✅ Upload Complete!"
echo "   Image: ipfs://$IMAGE_HASH"
echo "   Metadata: ipfs://$METADATA_CID"
echo ""
echo "Use this in ENCODE.md:"
echo "   token_uri: \"ipfs://$METADATA_CID\""
```

---

## Using the Upload Script

The skill includes a convenient upload script (no API key needed):

```bash
cd "$SKILL_DIR" && node src/upload.js \
  --name "My Token" \
  --symbol "MTK" \
  --description "A token for builders" \
  --image "./token-image.png" \
  --twitter "https://x.com/myproject" \
  --github "https://github.com/myproject" \
  --category "builder"
```

**Output:**
```json
{
  "success": true,
  "image_hash": "QmImage...",
  "metadata_cid": "QmMetadata...",
  "token_uri": "ipfs://QmMetadata..."
}
```

---

## Save Token Data

After uploading, save your token data:

```bash
mkdir -p ~/.openclaw/frame/tokens

cat > ~/.openclaw/frame/tokens/MTK.json << EOF
{
  "name": "My Token",
  "symbol": "MTK",
  "image_ipfs": "ipfs://$IMAGE_HASH",
  "metadata_ipfs": "ipfs://$METADATA_CID",
  "category": "builder-coin",
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
```

---

## Error Handling

**Invalid image format (400):**
```json
{
  "success": false,
  "error": "Unsupported image format. Use PNG, JPG, or SVG."
}
```

**Image too large (400):**
```json
{
  "success": false,
  "error": "Image exceeds maximum size of 5MB"
}
```

**Missing required field (400):**
```json
{
  "success": false,
  "error": "Missing required field: name"
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
| `IMAGE_PATH` | Path to token image |
| `IMAGE_HASH` | IPFS hash of uploaded image |
| `METADATA_CID` | IPFS CID of metadata |

---

## Next Steps

After uploading to IPFS:

1. **Encode transaction** → See [ENCODE.md](encode.md) — use your metadata CID
2. **Broadcast** → See [BROADCAST.md](broadcast.md)
3. **Claim earnings** → See [CLAIMS.md](claims.md)
