# HEARTBEAT.md

## Token Monitoring (every 4 hours)

Check Frame token status:
```bash
cd /data/workspace/skills/frame-builder/src && node heartbeat.js status
```

## Tokens to Monitor

- MOLT (builder): 0x2e3fa2c4CAA0196125e551b45bb5C801828946EA
- SCAN (product): 0x26aB6b5EdF92278Fa8825552FfE11D7c5d816A64
- AUDIT (product): 0x1f94c42f20cA42f1A75d857cA91D2F0E4a62cbC4
- KIT (product): 0x2C0d1E1bbbfa7040272EDEDD99B60a3cCa5e7d1c

## Actions if Claimable

If vesting or fees are claimable:
```bash
cd /data/workspace/skills/frame-builder/src
node claims.js vesting --token=<address>
node claims.js fees --token=<address>
```
