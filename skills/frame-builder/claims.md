# Frame Claims 💸

Claim your vesting tokens and trading fees from deployed tokens.

---

## Prerequisites

1. **Deployed token** — Complete [BROADCAST.md](broadcast.md) first
2. **Token address** — From your deployment
3. **ETH for gas** — Claims require gas (unlike deployment)

```bash
TOKEN_ADDRESS="0xYourTokenAddress..."
FRAME_WALLET=$(cat ~/.evm-wallet.json | jq -r '.address')
```

---

## Overview

After deploying a token, you earn in two ways:

| Earning Type | Description | Claim Method |
|--------------|-------------|--------------|
| **Vesting** | 100M tokens vest over 1 year | `release()` on token |
| **Fees** | 50% of trading fees | `collectFees()` on hooks |

```
┌─────────────────────────────────────────────────────────────┐
│                    CLAIMS FLOW                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  VESTING (100M tokens over 1 year)                          │
│  ├─ Check: getVestingDataOf(address) → [total, released]    │
│  └─ Claim: release() → Transfers vested tokens              │
│                                                             │
│  FEES (50% of trading fees)                                 │
│  ├─ Get pool: getState(asset) → PoolKey → poolId            │
│  └─ Claim: collectFees(poolId) → Transfers fees             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Contract Addresses (Base Mainnet)

| Contract | Address | Purpose |
|----------|---------|---------|
| Multicurve Initializer | `0x65dE470Da664A5be139A5D812bE5FDa0d76CC951` | Get pool state & ID |
| Multicurve Hooks | `0x892D3C2B4ABEAAF67d52A7B29783E2161B7CaD40` | Collect fees |
| Pool Manager | `0x498581ff718922c3f8e6a244956af099b2652b2b` | Uniswap V4 |

---

## Vesting Details

| Parameter | Value |
|-----------|-------|
| Vesting Amount | 100,000,000 tokens |
| Vesting Duration | 365 days (1 year) |
| Vesting Schedule | Linear |
| Yearly Mint Rate | 0 (no additional minting) |

---

## Minimal ABIs

These are the minimal ABIs needed for claiming, no SDK required:

### DERC20 Token ABI (for vesting)

```javascript
const derc20Abi = [
  // Read vesting data: returns [total, released]
  {
    name: 'getVestingDataOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [
      { name: 'total', type: 'uint256' },
      { name: 'released', type: 'uint256' }
    ]
  },
  // Claim vested tokens
  {
    name: 'release',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: []
  }
];
```

### Multicurve Initializer ABI (for getting pool state)

```javascript
const initializerAbi = [
  // Get pool state from token address
  {
    name: 'getState',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'asset', type: 'address' }],
    outputs: [
      { name: 'numeraire', type: 'address' },
      { name: 'status', type: 'uint8' },
      { 
        name: 'poolKey', 
        type: 'tuple',
        components: [
          { name: 'currency0', type: 'address' },
          { name: 'currency1', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'tickSpacing', type: 'int24' },
          { name: 'hooks', type: 'address' }
        ]
      },
      { name: 'farTick', type: 'int24' }
    ]
  }
];

// Pool status enum
const PoolStatus = {
  0: 'NotInitialized',
  1: 'Initializing',
  2: 'Active',
  3: 'Migrating',
  4: 'Migrated'
};
```

### Multicurve Hooks ABI (for collecting fees)

```javascript
const multicurveHooksAbi = [
  // Collect accumulated fees for caller
  {
    name: 'collectFees',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'poolId', type: 'bytes32' }],
    outputs: [
      { name: 'fees0', type: 'uint128' },
      { name: 'fees1', type: 'uint128' }
    ]
  }
];
```

---

## Computing Pool ID

The pool ID is computed by hashing the PoolKey struct:

```javascript
import { encodeAbiParameters, keccak256 } from 'viem';

function computePoolId(poolKey) {
  const encoded = encodeAbiParameters(
    [
      { name: 'currency0', type: 'address' },
      { name: 'currency1', type: 'address' },
      { name: 'fee', type: 'uint24' },
      { name: 'tickSpacing', type: 'int24' },
      { name: 'hooks', type: 'address' }
    ],
    [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks]
  );
  return keccak256(encoded);
}
```

---

## Check Vesting (viem)

```javascript
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

const publicClient = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org'),
});

const derc20Abi = [
  {
    name: 'getVestingDataOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [
      { name: 'total', type: 'uint256' },
      { name: 'released', type: 'uint256' }
    ]
  }
];

async function checkVesting(tokenAddress, walletAddress) {
  const [total, released] = await publicClient.readContract({
    address: tokenAddress,
    abi: derc20Abi,
    functionName: 'getVestingDataOf',
    args: [walletAddress],
  });
  
  const claimable = total - released;
  
  console.log('Total vesting:', total.toString());
  console.log('Already released:', released.toString());
  console.log('Claimable now:', claimable.toString());
  
  return { total, released, claimable };
}

// Usage
checkVesting('0xTokenAddress', '0xYourWallet');
```

---

## Claim Vesting (viem)

```javascript
import { 
  createPublicClient, 
  createWalletClient, 
  http,
  encodeFunctionData 
} from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const publicClient = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org'),
});

const derc20Abi = [
  {
    name: 'getVestingDataOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [
      { name: 'total', type: 'uint256' },
      { name: 'released', type: 'uint256' }
    ]
  },
  {
    name: 'release',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: []
  }
];

async function claimVesting(tokenAddress, privateKey) {
  const account = privateKeyToAccount(privateKey);
  
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http('https://mainnet.base.org'),
  });
  
  // Check if there's vesting to claim
  const [total, released] = await publicClient.readContract({
    address: tokenAddress,
    abi: derc20Abi,
    functionName: 'getVestingDataOf',
    args: [account.address],
  });
  
  const claimable = total - released;
  
  if (claimable === 0n) {
    console.log('No vesting tokens to claim');
    return null;
  }
  
  console.log('Claimable:', claimable.toString(), 'tokens');
  console.log('Claiming vesting...');
  
  // Send release transaction
  const hash = await walletClient.sendTransaction({
    to: tokenAddress,
    data: encodeFunctionData({
      abi: derc20Abi,
      functionName: 'release',
    }),
  });
  
  console.log('Transaction:', hash);
  
  // Wait for confirmation
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log('Confirmed in block:', receipt.blockNumber);
  
  return receipt;
}

// Usage
// const privateKey = '0x...'; // Load from ~/.evm-wallet.json
// claimVesting('0xTokenAddress', privateKey);
```

---

## Check Pool State (viem)

Get pool state and compute poolId from token address:

```javascript
import { createPublicClient, http, encodeAbiParameters, keccak256 } from 'viem';
import { base } from 'viem/chains';

const MULTICURVE_INITIALIZER = '0x65dE470Da664A5be139A5D812bE5FDa0d76CC951';

const publicClient = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org'),
});

const initializerAbi = [
  {
    name: 'getState',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'asset', type: 'address' }],
    outputs: [
      { name: 'numeraire', type: 'address' },
      { name: 'status', type: 'uint8' },
      { 
        name: 'poolKey', 
        type: 'tuple',
        components: [
          { name: 'currency0', type: 'address' },
          { name: 'currency1', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'tickSpacing', type: 'int24' },
          { name: 'hooks', type: 'address' }
        ]
      },
      { name: 'farTick', type: 'int24' }
    ]
  }
];

const PoolStatus = ['NotInitialized', 'Initializing', 'Active', 'Migrating', 'Migrated'];

function computePoolId(poolKey) {
  const encoded = encodeAbiParameters(
    [
      { name: 'currency0', type: 'address' },
      { name: 'currency1', type: 'address' },
      { name: 'fee', type: 'uint24' },
      { name: 'tickSpacing', type: 'int24' },
      { name: 'hooks', type: 'address' }
    ],
    [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks]
  );
  return keccak256(encoded);
}

async function getPoolState(tokenAddress) {
  const [numeraire, status, poolKey, farTick] = await publicClient.readContract({
    address: MULTICURVE_INITIALIZER,
    abi: initializerAbi,
    functionName: 'getState',
    args: [tokenAddress],
  });
  
  const poolId = computePoolId(poolKey);
  
  console.log('Numeraire:', numeraire);
  console.log('Status:', PoolStatus[status]);
  console.log('Pool ID:', poolId);
  console.log('Pool Key:', poolKey);
  
  return { numeraire, status: PoolStatus[status], poolKey, poolId };
}

// Usage
getPoolState('0xTokenAddress');
```

---

## Claim Fees (viem)

```javascript
import { 
  createPublicClient, 
  createWalletClient, 
  http,
  encodeAbiParameters,
  keccak256
} from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const MULTICURVE_INITIALIZER = '0x65dE470Da664A5be139A5D812bE5FDa0d76CC951';
const MULTICURVE_HOOKS = '0x892D3C2B4ABEAAF67d52A7B29783E2161B7CaD40';

const publicClient = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org'),
});

const initializerAbi = [
  {
    name: 'getState',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'asset', type: 'address' }],
    outputs: [
      { name: 'numeraire', type: 'address' },
      { name: 'status', type: 'uint8' },
      { 
        name: 'poolKey', 
        type: 'tuple',
        components: [
          { name: 'currency0', type: 'address' },
          { name: 'currency1', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'tickSpacing', type: 'int24' },
          { name: 'hooks', type: 'address' }
        ]
      },
      { name: 'farTick', type: 'int24' }
    ]
  }
];

const multicurveHooksAbi = [
  {
    name: 'collectFees',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'poolId', type: 'bytes32' }],
    outputs: [
      { name: 'fees0', type: 'uint128' },
      { name: 'fees1', type: 'uint128' }
    ]
  }
];

function computePoolId(poolKey) {
  const encoded = encodeAbiParameters(
    [
      { name: 'currency0', type: 'address' },
      { name: 'currency1', type: 'address' },
      { name: 'fee', type: 'uint24' },
      { name: 'tickSpacing', type: 'int24' },
      { name: 'hooks', type: 'address' }
    ],
    [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks]
  );
  return keccak256(encoded);
}

async function claimFees(tokenAddress, privateKey) {
  const account = privateKeyToAccount(privateKey);
  
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http('https://mainnet.base.org'),
  });
  
  // Get pool state from initializer
  const [numeraire, status, poolKey] = await publicClient.readContract({
    address: MULTICURVE_INITIALIZER,
    abi: initializerAbi,
    functionName: 'getState',
    args: [tokenAddress],
  });
  
  // Check pool is active
  if (status !== 2) { // 2 = Active
    console.log('Pool not active. Status:', status);
    return null;
  }
  
  // Compute pool ID from PoolKey
  const poolId = computePoolId(poolKey);
  console.log('Pool ID:', poolId);
  console.log('Collecting fees...');
  
  // Collect fees
  const hash = await walletClient.writeContract({
    address: MULTICURVE_HOOKS,
    abi: multicurveHooksAbi,
    functionName: 'collectFees',
    args: [poolId],
  });
  
  console.log('Transaction:', hash);
  
  // Wait for confirmation
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log('Confirmed in block:', receipt.blockNumber);
  
  return receipt;
}

// Usage
// const privateKey = '0x...'; // Load from ~/.evm-wallet.json
// claimFees('0xTokenAddress', privateKey);
```

---

## Usage Examples

### Check Vesting Status

```bash
cd "$SKILL_DIR" && node src/claims.js vesting --token=0xTOKEN --check
```

**Output:**
```json
{
  "total": "100000000",
  "released": "8219178",
  "claimable": "91780822",
  "hasClaimable": true
}
```

### Claim Vesting

```bash
cd "$SKILL_DIR" && node src/claims.js vesting --token=0xTOKEN
```

**Output:**
```json
{
  "success": true,
  "hash": "0xabc123...",
  "blockNumber": "12345678"
}
```

### Check Pool State

```bash
cd "$SKILL_DIR" && node src/claims.js pool --token=0xTOKEN
```

**Output:**
```json
{
  "tokenAddress": "0x3e5Bc87...",
  "poolId": "0xbe158bcf...",
  "numeraire": "0x833589fC...",
  "status": "Active",
  "poolKey": {
    "currency0": "0x3e5Bc87...",
    "currency1": "0x833589fC...",
    "fee": 20000,
    "tickSpacing": 8,
    "hooks": "0x892D3C2B..."
  }
}
```

### Check Fees

```bash
cd "$SKILL_DIR" && node src/claims.js fees --token=0xTOKEN --check
```

**Output:**
```json
{
  "tokenAddress": "0x3e5Bc87...",
  "poolId": "0xbe158bcf...",
  "numeraire": "0x833589fC...",
  "status": "Active",
  "wallet": "0x0eB3f271...",
  "note": "Pool is active. Fees accumulate from trading."
}
```

### Claim Fees

```bash
cd "$SKILL_DIR" && node src/claims.js fees --token=0xTOKEN
```

**Output:**
```json
{
  "success": true,
  "hash": "0xdef456...",
  "poolId": "0xbe158bcf...",
  "blockNumber": "12345679"
}
```

---

## Key Constants

```javascript
// Base mainnet
const CHAIN_ID = 8453;
const MULTICURVE_INITIALIZER = '0x65dE470Da664A5be139A5D812bE5FDa0d76CC951';
const MULTICURVE_HOOKS = '0x892D3C2B4ABEAAF67d52A7B29783E2161B7CaD40';
const POOL_MANAGER = '0x498581ff718922c3f8e6a244956af099b2652b2b';

// Vesting config
const VESTING_DURATION = 365n * 24n * 60n * 60n; // 31536000 seconds
const VESTING_AMOUNT = 100_000_000n * 10n**18n;  // 100M tokens

// Fee config
const CREATOR_FEE_SHARE = 0.50; // 50% of trading fees

// Pool status enum
const PoolStatus = {
  0: 'NotInitialized',
  1: 'Initializing', 
  2: 'Active',
  3: 'Migrating',
  4: 'Migrated'
};
```

---

## Summary

| Action | Contract | Function | Notes |
|--------|----------|----------|-------|
| Check vesting | Token (DERC20) | `getVestingDataOf(address)` | Returns `[total, released]` |
| Claim vesting | Token (DERC20) | `release()` | Transfers vested tokens |
| Get pool state | Initializer | `getState(asset)` | Returns numeraire, status, poolKey |
| Compute pool ID | - | `keccak256(PoolKey)` | Hash of encoded PoolKey |
| Claim fees | MulticurveHooks | `collectFees(poolId)` | Collects trading fees |

---

## Gas Requirements

Unlike deployment (which is sponsored), **claims require gas**:

| Action | Estimated Gas | Cost (~$2 ETH) |
|--------|---------------|----------------|
| Claim vesting | ~80,000 | ~$0.02 |
| Claim fees | ~120,000 | ~$0.03 |

Ensure you have ETH on Base before claiming.

---

## Token Tracking

Monitor your tokens on these platforms:

| Tracker | URL | Purpose |
|---------|-----|---------|
| **Frame.fun** | `https://frame.fun/tokens/{token_address}` | Token page, trading, community |
| **Defined.fi** | `https://www.defined.fi/base/{token_address}` | Price, volume, charts, analytics |
| **BaseScan** | `https://basescan.org/token/{token_address}` | On-chain data, holders, transfers |

---

## Next Steps

After claiming:

1. **Track token** → See [HEARTBEAT.md](heartbeat.md)
2. **Launch more tokens** → See [SKILL.md](skill.md)
