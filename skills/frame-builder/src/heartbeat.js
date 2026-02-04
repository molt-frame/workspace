// heartbeat.js - Smart agent heartbeat for tracking tokens and auto-claiming
import { 
  createPublicClient, 
  createWalletClient, 
  http,
  encodeAbiParameters,
  keccak256,
  formatEther 
} from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';

// Contract addresses
const MULTICURVE_INITIALIZER = '0x65dE470Da664A5be139A5D812bE5FDa0d76CC951';
const MULTICURVE_HOOKS = '0x892D3C2B4ABEAAF67d52A7B29783E2161B7CaD40';
const RPC_URL = 'https://mainnet.base.org';

// Paths
const HOME = process.env.HOME;
const TOKENS_DIR = `${HOME}/.openclaw/frame/tokens`;
const HEARTBEAT_DIR = `${HOME}/.openclaw/frame/heartbeat`;
const SNAPSHOTS_DIR = `${HEARTBEAT_DIR}/snapshots`;
const HISTORY_FILE = `${HEARTBEAT_DIR}/history.json`;

// ABIs
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

const PoolStatus = {
  0: 'NotInitialized',
  1: 'Initializing',
  2: 'Active',
  3: 'Migrating',
  4: 'Migrated'
};

// Compute poolId from PoolKey
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

// Initialize directories
function ensureDirs() {
  if (!existsSync(HEARTBEAT_DIR)) mkdirSync(HEARTBEAT_DIR, { recursive: true });
  if (!existsSync(SNAPSHOTS_DIR)) mkdirSync(SNAPSHOTS_DIR, { recursive: true });
}

// Load wallet
function loadWallet() {
  const walletPath = `${HOME}/.evm-wallet.json`;
  if (!existsSync(walletPath)) {
    throw new Error('No wallet found. Run setup.js first.');
  }
  return JSON.parse(readFileSync(walletPath, 'utf-8'));
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

// Load all token files
function loadTokens() {
  if (!existsSync(TOKENS_DIR)) return [];
  
  const files = readdirSync(TOKENS_DIR).filter(f => f.endsWith('.json'));
  return files.map(f => {
    const data = JSON.parse(readFileSync(join(TOKENS_DIR, f), 'utf-8'));
    data._filename = f;
    return data;
  });
}

// Load history
function loadHistory() {
  if (!existsSync(HISTORY_FILE)) {
    return { snapshots: [], claims: [], launches: [] };
  }
  return JSON.parse(readFileSync(HISTORY_FILE, 'utf-8'));
}

// Save history
function saveHistory(history) {
  writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

// Load previous snapshot
function loadPreviousSnapshot() {
  if (!existsSync(SNAPSHOTS_DIR)) return null;
  
  const files = readdirSync(SNAPSHOTS_DIR)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse();
  
  if (files.length === 0) return null;
  
  return JSON.parse(readFileSync(join(SNAPSHOTS_DIR, files[0]), 'utf-8'));
}

// Save snapshot
function saveSnapshot(snapshot) {
  ensureDirs();
  const filename = `${snapshot.timestamp.replace(/[:.]/g, '-')}.json`;
  writeFileSync(join(SNAPSHOTS_DIR, filename), JSON.stringify(snapshot, null, 2));
}

// Collect current state for all tokens
async function collectState() {
  const wallet = loadWallet();
  const { publicClient } = createClients(wallet.privateKey);
  const tokens = loadTokens();
  
  const timestamp = new Date().toISOString();
  const state = {
    timestamp,
    wallet: wallet.address,
    tokens: {},
    summary: {
      total_tokens: 0,
      builders: 0,
      products: 0,
      active_pools: 0,
      total_vesting_claimable: '0'
    }
  };
  
  let totalClaimable = 0n;
  
  for (const token of tokens) {
    const symbol = token.symbol;
    const address = token.token_address;
    
    console.log(`  Checking ${symbol}...`);
    
    const tokenState = {
      address,
      name: token.name,
      category: token.category,
      deployed_at: token.deployed_at,
      vesting: null,
      pool: null,
      numeraire: token.numeraire || null
    };
    
    // Get vesting data
    try {
      const [total, released] = await publicClient.readContract({
        address,
        abi: derc20Abi,
        functionName: 'getVestingDataOf',
        args: [wallet.address],
      });
      
      const claimable = total - released;
      totalClaimable += claimable;
      
      tokenState.vesting = {
        total: formatEther(total),
        released: formatEther(released),
        claimable: formatEther(claimable),
        hasClaimable: claimable > 0n
      };
    } catch (e) {
      tokenState.vesting = { error: 'Failed to fetch vesting' };
    }
    
    // Get pool state
    try {
      const [numeraire, status, poolKey, farTick] = await publicClient.readContract({
        address: MULTICURVE_INITIALIZER,
        abi: initializerAbi,
        functionName: 'getState',
        args: [address],
      });
      
      const poolId = computePoolId(poolKey);
      const statusName = PoolStatus[status] || `Unknown(${status})`;
      
      tokenState.pool = {
        status: statusName,
        statusCode: status,
        poolId,
        numeraire
      };
      
      if (status === 2) state.summary.active_pools++;
    } catch (e) {
      tokenState.pool = { status: 'NotFound', error: 'Pool not initialized' };
    }
    
    // Track products for builder coins
    if (token.category === 'builder') {
      const products = tokens
        .filter(t => t.category === 'product' && t.numeraire === address)
        .map(t => t.symbol);
      tokenState.products = products;
      state.summary.builders++;
    } else {
      state.summary.products++;
    }
    
    state.tokens[symbol] = tokenState;
    state.summary.total_tokens++;
  }
  
  state.summary.total_vesting_claimable = formatEther(totalClaimable);
  
  return state;
}

// Detect changes between snapshots
function detectChanges(current, previous) {
  if (!previous) {
    return { isFirst: true, changes: [] };
  }
  
  const changes = [];
  
  // Check for new tokens
  for (const symbol of Object.keys(current.tokens)) {
    if (!previous.tokens[symbol]) {
      changes.push({
        type: 'new_token',
        symbol,
        category: current.tokens[symbol].category,
        message: `New ${current.tokens[symbol].category} token: ${symbol}`
      });
    }
  }
  
  // Check for status changes
  for (const symbol of Object.keys(current.tokens)) {
    const curr = current.tokens[symbol];
    const prev = previous.tokens[symbol];
    
    if (!prev) continue;
    
    // Pool status change
    if (curr.pool?.status !== prev.pool?.status) {
      changes.push({
        type: 'pool_status_change',
        symbol,
        from: prev.pool?.status,
        to: curr.pool?.status,
        message: `${symbol} pool: ${prev.pool?.status} → ${curr.pool?.status}`
      });
    }
    
    // Vesting claimed (released increased)
    if (curr.vesting?.released !== prev.vesting?.released) {
      const diff = parseFloat(curr.vesting?.released || 0) - parseFloat(prev.vesting?.released || 0);
      if (diff > 0) {
        changes.push({
          type: 'vesting_claimed',
          symbol,
          amount: diff.toString(),
          message: `${symbol}: ${diff.toLocaleString()} tokens claimed from vesting`
        });
      }
    }
  }
  
  return { isFirst: false, changes };
}

// Analyze impact of product launches on builder coin
function analyzeImpact(state, history) {
  const analysis = {
    builder_health: [],
    product_correlation: []
  };
  
  for (const [symbol, token] of Object.entries(state.tokens)) {
    if (token.category !== 'builder') continue;
    
    const products = token.products || [];
    const poolActive = token.pool?.status === 'Active';
    
    analysis.builder_health.push({
      symbol,
      pool_status: token.pool?.status,
      product_count: products.length,
      products,
      vesting_claimable: token.vesting?.claimable,
      healthy: poolActive
    });
    
    // Check if products affected builder
    for (const productSymbol of products) {
      const product = state.tokens[productSymbol];
      if (product) {
        analysis.product_correlation.push({
          builder: symbol,
          product: productSymbol,
          product_pool_status: product.pool?.status,
          builder_pool_status: token.pool?.status,
          correlation: poolActive && product.pool?.status === 'Active' ? 'healthy' : 'check'
        });
      }
    }
  }
  
  return analysis;
}

// Auto-claim fees for active pools
async function autoClaimFees(state, options = {}) {
  const wallet = loadWallet();
  const { publicClient, walletClient } = createClients(wallet.privateKey);
  
  const claims = [];
  const dryRun = options.dryRun !== false;
  
  for (const [symbol, token] of Object.entries(state.tokens)) {
    if (token.pool?.status !== 'Active') {
      console.log(`  ${symbol}: Pool not active, skipping`);
      continue;
    }
    
    const poolId = token.pool.poolId;
    
    if (dryRun) {
      console.log(`  ${symbol}: Would attempt fee claim (poolId: ${poolId.slice(0, 10)}...)`);
      claims.push({
        symbol,
        address: token.address,
        poolId,
        status: 'dry_run'
      });
    } else {
      try {
        console.log(`  ${symbol}: Claiming fees...`);
        const hash = await walletClient.writeContract({
          address: MULTICURVE_HOOKS,
          abi: multicurveHooksAbi,
          functionName: 'collectFees',
          args: [poolId],
        });
        
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        
        claims.push({
          symbol,
          address: token.address,
          poolId,
          status: 'claimed',
          hash,
          blockNumber: receipt.blockNumber.toString()
        });
        
        console.log(`  ${symbol}: Fees claimed! TX: ${hash.slice(0, 10)}...`);
      } catch (e) {
        claims.push({
          symbol,
          address: token.address,
          poolId,
          status: 'error',
          error: e.message
        });
        console.log(`  ${symbol}: Claim failed - ${e.message.slice(0, 50)}`);
      }
    }
  }
  
  return claims;
}

// Generate report
function generateReport(state, changes, analysis) {
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('💓 HEARTBEAT REPORT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Timestamp: ${state.timestamp}`);
  console.log(`Wallet: ${state.wallet}`);
  console.log('');
  
  // Summary
  console.log('📊 SUMMARY');
  console.log(`  Tokens: ${state.summary.total_tokens} (${state.summary.builders} builders, ${state.summary.products} products)`);
  console.log(`  Active pools: ${state.summary.active_pools}`);
  console.log(`  Total vesting claimable: ${parseFloat(state.summary.total_vesting_claimable).toLocaleString()} tokens`);
  console.log('');
  
  // Changes
  if (changes.isFirst) {
    console.log('📝 CHANGES: First heartbeat - no previous data');
  } else if (changes.changes.length === 0) {
    console.log('📝 CHANGES: No changes since last heartbeat');
  } else {
    console.log('📝 CHANGES:');
    for (const change of changes.changes) {
      console.log(`  • ${change.message}`);
    }
  }
  console.log('');
  
  // Token details
  console.log('🪙 TOKENS:');
  for (const [symbol, token] of Object.entries(state.tokens)) {
    const poolStatus = token.pool?.status || 'Unknown';
    const vestingClaimable = token.vesting?.claimable || '0';
    const products = token.products?.length ? ` [${token.products.join(', ')}]` : '';
    
    console.log(`  ${symbol} (${token.category})${products}`);
    console.log(`    Pool: ${poolStatus} | Vesting: ${parseFloat(vestingClaimable).toLocaleString()} claimable`);
  }
  console.log('');
  
  // Builder health
  if (analysis.builder_health.length > 0) {
    console.log('🏗️ BUILDER HEALTH:');
    for (const builder of analysis.builder_health) {
      const status = builder.healthy ? '✅' : '⚠️';
      console.log(`  ${status} ${builder.symbol}: ${builder.pool_status}, ${builder.product_count} products`);
    }
    console.log('');
  }
  
  // Links
  console.log('🔗 TRACKING LINKS:');
  for (const [symbol, token] of Object.entries(state.tokens)) {
    const addressLower = token.address.toLowerCase();
    console.log(`  ${symbol}:`);
    console.log(`    Frame.fun:  https://frame.fun/tokens/${addressLower}`);
    console.log(`    Defined.fi: https://www.defined.fi/base/${token.address}`);
  }
  
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

// CLI commands
async function runHeartbeat(options = {}) {
  console.log('💓 Running heartbeat...');
  console.log('');
  
  // Collect current state
  console.log('📡 Collecting token state...');
  const state = await collectState();
  
  // Load previous and detect changes
  console.log('📊 Analyzing changes...');
  const previous = loadPreviousSnapshot();
  const changes = detectChanges(state, previous);
  
  // Analyze impact
  const history = loadHistory();
  const analysis = analyzeImpact(state, history);
  
  // Save snapshot
  saveSnapshot(state);
  
  // Update history
  history.snapshots.push({
    timestamp: state.timestamp,
    summary: state.summary
  });
  
  // Keep only last 100 snapshots in history
  if (history.snapshots.length > 100) {
    history.snapshots = history.snapshots.slice(-100);
  }
  
  saveHistory(history);
  
  // Generate report
  generateReport(state, changes, analysis);
  
  // Auto-claim if requested
  if (options.claim) {
    console.log('');
    console.log('💰 Auto-claiming fees...');
    const claims = await autoClaimFees(state, { dryRun: false });
    
    if (claims.length > 0) {
      history.claims.push({
        timestamp: state.timestamp,
        claims
      });
      saveHistory(history);
    }
  }
  
  return { state, changes, analysis };
}

async function showStatus() {
  console.log('📊 Quick Status Check...');
  console.log('');
  
  const state = await collectState();
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STATUS OVERVIEW');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  for (const [symbol, token] of Object.entries(state.tokens)) {
    const poolIcon = token.pool?.status === 'Active' ? '🟢' : '🔴';
    const vestIcon = token.vesting?.hasClaimable ? '💰' : '⏳';
    console.log(`${poolIcon} ${symbol} (${token.category})`);
    console.log(`   Pool: ${token.pool?.status || 'Unknown'}`);
    console.log(`   ${vestIcon} Vesting: ${parseFloat(token.vesting?.claimable || 0).toLocaleString()} claimable`);
  }
  
  console.log('');
  console.log(`Total claimable: ${parseFloat(state.summary.total_vesting_claimable).toLocaleString()} tokens`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

async function showHistory() {
  const history = loadHistory();
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('HEARTBEAT HISTORY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  if (history.snapshots.length === 0) {
    console.log('No history yet. Run: node heartbeat.js run');
    return;
  }
  
  console.log(`Total snapshots: ${history.snapshots.length}`);
  console.log(`Total claims: ${history.claims.length}`);
  console.log('');
  
  // Show last 10 snapshots
  console.log('Recent snapshots:');
  const recent = history.snapshots.slice(-10).reverse();
  for (const snap of recent) {
    console.log(`  ${snap.timestamp}: ${snap.summary.total_tokens} tokens, ${snap.summary.active_pools} active pools`);
  }
  
  // Show claims
  if (history.claims.length > 0) {
    console.log('');
    console.log('Recent claims:');
    const recentClaims = history.claims.slice(-5).reverse();
    for (const claim of recentClaims) {
      const successful = claim.claims.filter(c => c.status === 'claimed').length;
      console.log(`  ${claim.timestamp}: ${successful} successful claims`);
    }
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

async function claimAll() {
  console.log('💰 Claiming all available fees...');
  console.log('');
  
  const state = await collectState();
  const claims = await autoClaimFees(state, { dryRun: false });
  
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('CLAIM RESULTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  for (const claim of claims) {
    if (claim.status === 'claimed') {
      console.log(`✅ ${claim.symbol}: Claimed (TX: ${claim.hash})`);
    } else if (claim.status === 'error') {
      console.log(`❌ ${claim.symbol}: ${claim.error}`);
    } else {
      console.log(`⏭️ ${claim.symbol}: ${claim.status}`);
    }
  }
  
  // Save to history
  const history = loadHistory();
  history.claims.push({
    timestamp: new Date().toISOString(),
    claims
  });
  saveHistory(history);
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

// Main CLI
const [,, action, ...args] = process.argv;

async function main() {
  ensureDirs();
  
  switch (action) {
    case 'run':
      const claimFlag = args.includes('--claim');
      await runHeartbeat({ claim: claimFlag });
      break;
      
    case 'status':
      await showStatus();
      break;
      
    case 'history':
      await showHistory();
      break;
      
    case 'claim':
      if (args.includes('--all')) {
        await claimAll();
      } else {
        console.log('Usage: node heartbeat.js claim --all');
      }
      break;
      
    default:
      console.log('💓 Frame Heartbeat - Token Monitoring & Auto-Claims');
      console.log('');
      console.log('Usage:');
      console.log('  node heartbeat.js run [--claim]  Full heartbeat cycle (optionally claim fees)');
      console.log('  node heartbeat.js status         Quick status check');
      console.log('  node heartbeat.js history        View historical trends');
      console.log('  node heartbeat.js claim --all    Force claim all available fees');
      console.log('');
      console.log('Data stored in: ~/.openclaw/frame/heartbeat/');
  }
}

main().catch(console.error);
