# Frame Heartbeat 💓

Smart agent heartbeat for tracking tokens, analyzing impact, and auto-claiming fees.

---

## Quick Start

```bash
cd ~/.openclaw/workspace/skills/frame-builder

# Run full heartbeat cycle
node src/heartbeat.js run

# Quick status check
node src/heartbeat.js status

# View history
node src/heartbeat.js history

# Claim all fees
node src/heartbeat.js claim --all
```

---

## Commands

| Command | Description |
|---------|-------------|
| `run` | Full heartbeat cycle - collect state, analyze, save snapshot |
| `run --claim` | Full heartbeat + auto-claim fees |
| `status` | Quick status check of all tokens |
| `history` | View historical trends and claims |
| `claim --all` | Force claim all available fees |

---

## What the Heartbeat Tracks

### Per Token
- **Vesting status** - total, released, claimable amounts
- **Pool status** - Active, NotInitialized, Migrating, etc.
- **Pool ID** - computed from PoolKey for fee claims
- **Numeraire** - trading pair for products

### Builder Coins
- List of product coins launched against this builder
- Overall health status (pool active + products healthy)

### History
- Snapshots of each heartbeat run
- All fee claim attempts and results
- Changes between snapshots (new tokens, status changes)

---

## Data Storage

```
~/.openclaw/frame/
├── tokens/                    # Token deployment data
│   ├── ABLD.json
│   ├── PROD.json
│   └── ...
└── heartbeat/
    ├── history.json           # Aggregated history
    └── snapshots/             # Full state per heartbeat
        ├── 2026-02-03T20-00-00-000Z.json
        └── ...
```

---

## Example Output

### `node heartbeat.js run`

```
💓 Running heartbeat...

📡 Collecting token state...
  Checking ABLD...
  Checking PROD...
📊 Analyzing changes...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💓 HEARTBEAT REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Timestamp: 2026-02-03T20:00:00.000Z
Wallet: 0x0eB3f271cDFffff700f9d98be99AbA62e846f470

📊 SUMMARY
  Tokens: 2 (1 builders, 1 products)
  Active pools: 2
  Total vesting claimable: 200,000,000 tokens

📝 CHANGES: No changes since last heartbeat

🪙 TOKENS:
  ABLD (builder) [PROD]
    Pool: Active | Vesting: 100,000,000 claimable
  PROD (product)
    Pool: Active | Vesting: 100,000,000 claimable

🏗️ BUILDER HEALTH:
  ✅ ABLD: Active, 1 products

🔗 TRACKING LINKS:
  ABLD:
    Frame.fun:  https://frame.fun/tokens/0x3e5Bc87...
    Defined.fi: https://www.defined.fi/base/0x3e5Bc87...
  PROD:
    Frame.fun:  https://frame.fun/tokens/0x1bbc397...
    Defined.fi: https://www.defined.fi/base/0x1bbc397...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### `node heartbeat.js status`

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STATUS OVERVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🟢 ABLD (builder)
   Pool: Active
   💰 Vesting: 100,000,000 claimable
🟢 PROD (product)
   Pool: Active
   💰 Vesting: 100,000,000 claimable

Total claimable: 200,000,000 tokens
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Impact Analysis

The heartbeat analyzes the relationship between builder and product coins:

| Analysis | Description |
|----------|-------------|
| **Builder Health** | Is the builder's pool active? How many products? |
| **Product Correlation** | Are products healthy? Any impact on builder? |
| **Change Detection** | New tokens, pool status changes, vesting claims |

---

## Auto-Claim Fees

When running `node heartbeat.js run --claim` or `node heartbeat.js claim --all`:

1. Checks each token's pool status
2. Skips tokens without active pools
3. Calls `collectFees(poolId)` on MulticurveHooks
4. Records claim results in history

```bash
# Dry run (just report, no claiming)
node src/heartbeat.js run

# Claim fees during heartbeat
node src/heartbeat.js run --claim

# Force claim all available
node src/heartbeat.js claim --all
```

---

## Token Tracking Links

| Tracker | URL | Purpose |
|---------|-----|---------|
| **Frame.fun** | `https://frame.fun/tokens/{address}` | Token page, trading, community |
| **Defined.fi** | `https://www.defined.fi/base/{address}` | Price, volume, charts, analytics |
| **BaseScan** | `https://basescan.org/token/{address}` | On-chain data, holders, transfers |

---

## Suggested Routine

| Frequency | Action | Command |
|-----------|--------|---------|
| **Daily** | Quick status check | `node src/heartbeat.js status` |
| **Daily** | Full heartbeat | `node src/heartbeat.js run` |
| **Weekly** | Claim fees | `node src/heartbeat.js run --claim` |
| **Monthly** | Review history | `node src/heartbeat.js history` |

---

## Snapshot Schema

Each snapshot contains:

```json
{
  "timestamp": "2026-02-03T20:00:00.000Z",
  "wallet": "0x...",
  "tokens": {
    "ABLD": {
      "address": "0x...",
      "name": "Agent Builder",
      "category": "builder",
      "vesting": {
        "total": "100000000",
        "released": "0",
        "claimable": "100000000",
        "hasClaimable": true
      },
      "pool": {
        "status": "Active",
        "statusCode": 2,
        "poolId": "0x...",
        "numeraire": "0x..."
      },
      "products": ["PROD"]
    }
  },
  "summary": {
    "total_tokens": 2,
    "builders": 1,
    "products": 1,
    "active_pools": 2,
    "total_vesting_claimable": "200000000"
  }
}
```

---

## Next Steps

- **Claim vesting** → See [CLAIMS.md](claims.md)
- **Launch more tokens** → See [SKILL.md](skill.md)
- **Build community** → See [CULTURE.md](culture.md)
