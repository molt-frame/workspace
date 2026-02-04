// claims.js
import { 
  createPublicClient, 
  createWalletClient, 
  http,
  encodeFunctionData,
  encodeAbiParameters,
  keccak256,
  formatEther 
} from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync } from 'fs';

// Contract addresses
const MULTICURVE_INITIALIZER = '0x65dE470Da664A5be139A5D812bE5FDa0d76CC951';
const MULTICURVE_HOOKS = '0x892D3C2B4ABEAAF67d52A7B29783E2161B7CaD40';
const RPC_URL = 'https://mainnet.base.org';

// DERC20 Token ABI (for vesting)
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

// UniswapV4MulticurveInitializer ABI (for getting pool state)
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

// MulticurveHooks ABI (for collecting fees)
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

// Compute poolId from PoolKey (keccak256 of encoded PoolKey)
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

// Pool status enum
const PoolStatus = {
  0: 'NotInitialized',
  1: 'Initializing',
  2: 'Active',
  3: 'Migrating',
  4: 'Migrated'
};

// Load wallet
function loadWallet() {
  const walletPath = `${process.env.HOME}/.evm-wallet.json`;
  const wallet = JSON.parse(readFileSync(walletPath, 'utf-8'));
  return wallet;
}

// Create clients
function createClients(privateKey) {
  const account = privateKeyToAccount(privateKey);
  
  const publicClient = createPublicClient({
    chain: base,
    transport: http(RPC_URL),
  });
  
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(RPC_URL),
  });
  
  return { publicClient, walletClient, account };
}

// Get pool state from initializer
async function getPoolState(tokenAddress) {
  const wallet = loadWallet();
  const { publicClient } = createClients(wallet.privateKey);
  
  const [numeraire, status, poolKey, farTick] = await publicClient.readContract({
    address: MULTICURVE_INITIALIZER,
    abi: initializerAbi,
    functionName: 'getState',
    args: [tokenAddress],
  });
  
  const poolId = computePoolId(poolKey);
  
  return {
    numeraire,
    status: PoolStatus[status] || status,
    statusCode: status,
    poolKey,
    poolId,
    farTick
  };
}

// Check vesting status
async function checkVesting(tokenAddress) {
  const wallet = loadWallet();
  const { publicClient } = createClients(wallet.privateKey);
  
  const [total, released] = await publicClient.readContract({
    address: tokenAddress,
    abi: derc20Abi,
    functionName: 'getVestingDataOf',
    args: [wallet.address],
  });
  
  const claimable = total - released;
  
  return {
    total: formatEther(total),
    released: formatEther(released),
    claimable: formatEther(claimable),
    hasClaimable: claimable > 0n
  };
}

// Claim vesting
async function claimVesting(tokenAddress) {
  const wallet = loadWallet();
  const { publicClient, walletClient, account } = createClients(wallet.privateKey);
  
  // Check claimable
  const [total, released] = await publicClient.readContract({
    address: tokenAddress,
    abi: derc20Abi,
    functionName: 'getVestingDataOf',
    args: [account.address],
  });
  
  if (total - released === 0n) {
    return { success: false, message: 'No vesting tokens to claim' };
  }
  
  // Claim
  const hash = await walletClient.sendTransaction({
    to: tokenAddress,
    data: encodeFunctionData({
      abi: derc20Abi,
      functionName: 'release',
    }),
  });
  
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  
  return {
    success: true,
    hash,
    blockNumber: receipt.blockNumber.toString()
  };
}

// Check fees - get pool state and poolId
async function checkFees(tokenAddress) {
  const wallet = loadWallet();
  
  try {
    const poolState = await getPoolState(tokenAddress);
    
    return {
      tokenAddress,
      poolId: poolState.poolId,
      numeraire: poolState.numeraire,
      status: poolState.status,
      poolKey: {
        currency0: poolState.poolKey.currency0,
        currency1: poolState.poolKey.currency1,
        fee: poolState.poolKey.fee,
        tickSpacing: poolState.poolKey.tickSpacing,
        hooks: poolState.poolKey.hooks
      },
      wallet: wallet.address,
      note: poolState.status === 'Active' 
        ? 'Pool is active. Fees accumulate from trading.' 
        : `Pool status: ${poolState.status}. Fees available when active.`
    };
  } catch (error) {
    return {
      tokenAddress,
      wallet: wallet.address,
      error: 'Pool not found or not initialized',
      note: 'The pool may not exist yet. Trading must occur first.'
    };
  }
}

// Claim fees
async function claimFees(tokenAddress) {
  const wallet = loadWallet();
  const { publicClient, walletClient } = createClients(wallet.privateKey);
  
  // Get pool state and compute poolId
  const poolState = await getPoolState(tokenAddress);
  
  if (poolState.status !== 'Active') {
    return { 
      success: false, 
      message: `Pool not active. Status: ${poolState.status}`,
      poolId: poolState.poolId
    };
  }
  
  // Collect fees
  const hash = await walletClient.writeContract({
    address: MULTICURVE_HOOKS,
    abi: multicurveHooksAbi,
    functionName: 'collectFees',
    args: [poolState.poolId],
  });
  
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  
  return {
    success: true,
    hash,
    poolId: poolState.poolId,
    blockNumber: receipt.blockNumber.toString()
  };
}

// CLI
const [,, action, ...args] = process.argv;

async function main() {
  if (action === 'vesting') {
    const tokenAddress = args.find(a => a.startsWith('--token='))?.split('=')[1];
    if (!tokenAddress) {
      console.log('Usage: node claims.js vesting --token=0x... [--check]');
      process.exit(1);
    }
    
    if (args.includes('--check')) {
      const status = await checkVesting(tokenAddress);
      console.log(JSON.stringify(status, null, 2));
    } else {
      const result = await claimVesting(tokenAddress);
      console.log(JSON.stringify(result, null, 2));
    }
  } else if (action === 'fees') {
    const tokenAddress = args.find(a => a.startsWith('--token='))?.split('=')[1];
    if (!tokenAddress) {
      console.log('Usage: node claims.js fees --token=0x... [--check]');
      process.exit(1);
    }
    
    if (args.includes('--check')) {
      const status = await checkFees(tokenAddress);
      console.log(JSON.stringify(status, null, 2));
    } else {
      const result = await claimFees(tokenAddress);
      console.log(JSON.stringify(result, null, 2));
    }
  } else if (action === 'pool') {
    // New action: get pool state directly
    const tokenAddress = args.find(a => a.startsWith('--token='))?.split('=')[1];
    if (!tokenAddress) {
      console.log('Usage: node claims.js pool --token=0x...');
      process.exit(1);
    }
    
    const state = await getPoolState(tokenAddress);
    console.log(JSON.stringify({
      tokenAddress,
      poolId: state.poolId,
      numeraire: state.numeraire,
      status: state.status,
      poolKey: state.poolKey
    }, null, 2));
  } else {
    console.log('Usage:');
    console.log('  node claims.js vesting --token=0x... [--check]');
    console.log('  node claims.js fees --token=0x... [--check]');
    console.log('  node claims.js pool --token=0x...');
  }
}

main().catch(console.error);
