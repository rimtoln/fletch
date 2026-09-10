export const CHAIN_ID = 4663
export const CHAIN_ID_HEX = '0x1237'
export const RPC_PUBLIC = 'https://rpc.mainnet.chain.robinhood.com'
export const EXPLORER = 'https://robinhoodchain.blockscout.com'
export const HOODEX = 'https://hoodexplorer.org/api'

export const WETH = '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73'
export const USDG = '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168'
export const USDG_FAKE = '0x8218d73C00567A01481495Ad6c5143e00D5BB5b4'
export const QUOTER_V2 = '0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7'
export const SWAP_ROUTER_02 = '0xCaf681a66D020601342297493863E78C959E5cb2'
export const V4_QUOTER = '0x8dc178efb8111bb0973dd9d722ebeff267c98f94'
export const POOL_MANAGER = '0x8366a39CC670B4001A1121B8F6A443A643e40951'
export const V4_SWAP_ROUTER = '0x65050a9b7e5075a2ba5ced7b1b64ee66262c40dc'
export const PONS_HOOK = '0xe5e702641ea86f4ae6cc3cdaed2b886f976be044'
export const ZERO_ADDR = '0x0000000000000000000000000000000000000000'
const INIT_TOPIC = '0xdd466e674ea557f56295e2d0218a125ea4b4f0f6f3307b95f85e6110838d6438'
const V4_QUOTE_SEL = 'aa9d21cb'
const V4_SWAP_SEL = '4d819a2a'

export const SPONSOR_END = Date.parse('2026-09-29T23:59:00-04:00')

export const RWA = {
  AAPL: ['0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9', 'Apple'],
  AMD: ['0x86923f96303D656E4aa86D9d42D1e57ad2023fdC', 'AMD'],
  AMZN: ['0x12f190a9F9d7D37a250758b26824B97CE941bF54', 'Amazon'],
  COIN: ['0x6330D8C3178a418788dF01a47479c0ce7CCF450b', 'Coinbase'],
  GOOGL: ['0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3', 'Alphabet'],
  META: ['0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35', 'Meta'],
  MSFT: ['0xe93237C50D904957Cf27E7B1133b510C669c2e74', 'Microsoft'],
  NVDA: ['0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC', 'NVIDIA'],
  PLTR: ['0x894E1EC2D74FFE5AEF8Dc8A9e84686acCB964F2A', 'Palantir'],
  TSLA: ['0x322F0929c4625eD5bAd873c95208D54E1c003b2d', 'Tesla'],
  QQQ: ['0xD5f3879160bc7c32ebb4dC785F8a4F505888de68', 'Invesco QQQ'],
  SPY: ['0x117cc2133c37B721F49dE2A7a74833232B3B4C0C', 'SPDR S&P 500'],
  GME: ['0x1b0E319c6A659F002271B69dB8A7df2F911c153E', 'GameStop'],
  MSTR: ['0xec262a75e413fAfD0dF80480274532C79D42da09', 'MicroStrategy'],
  CRCL: ['0xdF0992E440dD0be65BD8439b609d6D4366bf1CB5', 'Circle'],
}

const RWA_BY_ADDR = {}
for (const [sym, [addr, name]] of Object.entries(RWA)) {
  if (addr.startsWith('0x0000')) continue
  RWA_BY_ADDR[addr.toLowerCase()] = { symbol: sym, name, address: addr }
}

const FEES = [100, 500, 2500, 3000, 10000]
const QUOTE_SEL = 'c6a5026a'
const poolKeyCache = new Map()

function padAddr(a) {
  return (a || ZERO_ADDR).replace(/^0x/i, '').toLowerCase().padStart(64, '0')
}
function padUint(n) {
  return BigInt(n).toString(16).padStart(64, '0')
}
function padInt(n) {
  let v = BigInt(n)
  if (v < 0n) v = (1n << 256n) + v
  return v.toString(16).padStart(64, '0')
}
function padBytes32(h) {
  return (h || '0x').replace(/^0x/i, '').padStart(64, '0')
}
function hexJson(hex) {
  return hex.startsWith('0x') ? hex : '0x' + hex
}
function word(hex, i) {
  const h = hex.replace(/^0x/i, '')
  return '0x' + h.slice(i * 64, i * 64 + 64)
}
function addrFromTopic(topic) {
  return '0x' + String(topic || '').replace(/^0x/i, '').slice(-40)
}
function isEthLike(addr) {
  if (!addr) return false
  const a = addr.toLowerCase()
  return a === ZERO_ADDR.toLowerCase() || a === WETH.toLowerCase()
}

async function rpc(method, params = [], url = RPC_PUBLIC) {
  const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  const urls = url === RPC_PUBLIC ? [RPC_PUBLIC, '/rpc-proxy'] : [url]
  let last
  for (const u of urls) {
    try {
      const res = await fetch(u, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      })
      if (!res.ok) {
        last = new Error('rpc ' + res.status)
        continue
      }
      const json = await res.json()
      if (json.error) {
        last = new Error(json.error.message || 'rpc error')
        continue
      }
      return json.result
    } catch (err) {
      last = err
    }
  }
  throw last || new Error('rpc failed')
}

async function getJson(urls) {
  let last
  for (const u of urls) {
    try {
      const res = await fetch(u)
      if (!res.ok) {
        last = new Error(u + ' ' + res.status)
        continue
      }
      return await res.json()
    } catch (err) {
      last = err
    }
  }
  throw last || new Error('fetch failed')
}

export function rwaOf(address) {
  if (!address) return null
  return RWA_BY_ADDR[address.toLowerCase()] || null
}

export function rwaList() {
  return Object.values(RWA_BY_ADDR)
}

export function shortAddr(a) {
  if (!a) return '—'
  return a.slice(0, 6) + '…' + a.slice(-4)
}

export function fmtGas(weiHex) {
  if (!weiHex) return '—'
  const gwei = Number(BigInt(weiHex)) / 1e9
  if (!Number.isFinite(gwei)) return '—'
  return gwei < 1 ? gwei.toFixed(4) + ' gwei' : gwei.toFixed(3) + ' gwei'
}

export function sponsorLeft(now = Date.now()) {
  const ms = SPONSOR_END - now
  if (ms <= 0) return { label: 'SPONSOR ENDED', ended: true, ratio: 0 }
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  return {
    label: `SPONSOR ${d}d ${h}h ${m}m`,
    ended: false,
    ratio: Math.max(0, Math.min(1, ms / (14 * 86400000))),
  }
}

export function getProvider() {
  const e = typeof window !== 'undefined' ? window.ethereum : null
  if (!e) return null
  if (Array.isArray(e.providers) && e.providers.length) {
    return e.providers.find((p) => p.isMetaMask) || e.providers.find((p) => p.isRabby) || e.providers[0]
  }
  return e
}

export async function addRobinhoodChain(eth = getProvider()) {
  if (!eth) throw new Error('no wallet — install MetaMask or Rabby')
  await eth.request({
    method: 'wallet_addEthereumChain',
    params: [{
      chainId: CHAIN_ID_HEX,
      chainName: 'Robinhood Chain',
      nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
      rpcUrls: [RPC_PUBLIC],
      blockExplorerUrls: [EXPLORER],
    }],
  })
}

export async function readWallet(eth = getProvider()) {
  if (!eth) return null
  const acc = await eth.request({ method: 'eth_accounts' })
  if (!acc || !acc[0]) return null
  const chainId = await eth.request({ method: 'eth_chainId' })
  const onChain = String(chainId).toLowerCase() === CHAIN_ID_HEX
  let balanceEth = 0
  let balanceUsdg = 0
  let balanceWeth = 0
  try {
    const bal = await eth.request({ method: 'eth_getBalance', params: [acc[0], 'latest'] })
    balanceEth = Number(BigInt(bal)) / 1e18
  } catch {
    balanceEth = 0
  }
  if (onChain) {
    try {
      const [usdgRaw, wethRaw] = await Promise.all([
        readTokenBalance(USDG, acc[0]),
        readTokenBalance(WETH, acc[0]),
      ])
      balanceUsdg = Number(usdgRaw) / 1e6
      balanceWeth = Number(wethRaw) / 1e18
    } catch {
      /* keep native only */
    }
  }
  return {
    address: acc[0],
    chainId,
    onChain,
    balanceEth,
    balanceUsdg,
    balanceWeth,
  }
}

export function walletUsd(state, ethUsd = 0) {
  if (!state) return null
  const eth = (Number(state.balanceEth) || 0) + (Number(state.balanceWeth) || 0)
  const usdg = Number(state.balanceUsdg) || 0
  const px = Number(ethUsd) || 0
  return eth * px + usdg
}

export async function connectWallet() {
  const eth = getProvider()
  if (!eth) throw new Error('no wallet — install MetaMask or Rabby')
  await eth.request({ method: 'eth_requestAccounts' })
  try {
    await eth.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: CHAIN_ID_HEX }],
    })
  } catch (err) {
    const code = err && err.code
    if (code === 4902 || code === -32603 || /unrecognized|not added/i.test(String(err.message || ''))) {
      await addRobinhoodChain(eth)
      await eth.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: CHAIN_ID_HEX }],
      })
    } else {
      throw err
    }
  }
  const state = await readWallet(eth)
  if (!state) throw new Error('wallet connected but no account')
  return state
}

export function watchWallet(onChange) {
  const eth = getProvider()
  if (!eth || !eth.on) return () => {}
  const bump = () => readWallet(eth).then(onChange).catch(() => onChange(null))
  eth.on('accountsChanged', bump)
  eth.on('chainChanged', bump)
  return () => {
    if (eth.removeListener) {
      eth.removeListener('accountsChanged', bump)
      eth.removeListener('chainChanged', bump)
    }
  }
}

export async function pullPulse() {
  const [blockHex, gasHex, stats] = await Promise.all([
    rpc('eth_blockNumber'),
    rpc('eth_gasPrice'),
    getJson([
      EXPLORER + '/api/v2/stats',
      '/bs-proxy/api/v2/stats',
    ]).catch(() => null),
  ])
  const block = Number(BigInt(blockHex))
  let txToday = null
  let avgTime = null
  let ethUsd = 0
  if (stats) {
    const today = Number(stats.transactions_today)
    txToday = Number.isFinite(today) ? today : null
    avgTime = stats.average_block_time
    ethUsd = Number(stats.coin_price) || 0
  }
  return { block, gasHex, txToday, avgTime, ethUsd, live: true }
}

export async function pullRadar() {
  const [tokens, txs] = await Promise.all([
    getJson([
      EXPLORER + '/api/v2/tokens?type=ERC-20',
      '/bs-proxy/api/v2/tokens?type=ERC-20',
    ]).catch(() => ({ items: [] })),
    getJson([
      EXPLORER + '/api/v2/transactions?filter=validated',
      '/bs-proxy/api/v2/transactions?filter=validated',
    ]).catch(() => ({ items: [] })),
  ])

  const radar = []
  const seen = new Set()
  for (const t of tokens.items || []) {
    const address = t.address || t.address_hash
    if (!address) continue
    const key = address.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    if (key === USDG_FAKE.toLowerCase()) {
      radar.push({
        address,
        symbol: t.symbol || 'USDG',
        name: t.name || 'ticker squatter',
        kind: 'risk',
        print: 'COLLISION',
        holders: t.holders_count || t.holders,
      })
      continue
    }
    if (key === USDG.toLowerCase() || key === WETH.toLowerCase()) {
      radar.push({
        address,
        symbol: key === WETH.toLowerCase() ? 'WETH' : 'USDG',
        name: key === WETH.toLowerCase() ? 'Wrapped Ether' : 'Global Dollar',
        kind: 'rwa',
        print: t.exchange_rate || 'peg',
        holders: t.holders_count || t.holders,
      })
      continue
    }
    const rwa = rwaOf(address)
    radar.push({
      address,
      symbol: (rwa && rwa.symbol) || t.symbol || '???',
      name: (rwa && rwa.name) || t.name || '',
      kind: rwa ? 'rwa' : 'meme',
      print: t.exchange_rate || t.circulating_market_cap || t.holders_count || '—',
      holders: t.holders_count || t.holders,
    })
  }

  const flow = []
  for (const tx of (txs.items || []).slice(0, 24)) {
    const value = tx.value ? Number(tx.value) / 1e18 : 0
    flow.push({
      hash: tx.hash,
      from: tx.from && (tx.from.hash || tx.from),
      to: tx.to && (tx.to.hash || tx.to),
      method: (tx.method || tx.tx_types && tx.tx_types[0]) || 'transfer',
      value,
      fee: tx.fee && (tx.fee.value || tx.fee),
    })
  }

  return { radar, flow }
}

function decodeInitLog(log) {
  const data = log.data || '0x'
  const fee = Number(BigInt(word(data, 0)))
  const tickSpacing = Number(BigInt.asIntN(256, BigInt(word(data, 1))))
  const hooks = addrFromTopic(word(data, 2))
  return {
    poolId: log.topics && log.topics[1],
    currency0: addrFromTopic(log.topics && log.topics[2]),
    currency1: addrFromTopic(log.topics && log.topics[3]),
    fee,
    tickSpacing,
    hooks,
  }
}

async function logsForPair(currency0, currency1) {
  const t0 = '0x' + padAddr(currency0)
  const t1 = '0x' + padAddr(currency1)
  const result = await rpc('eth_getLogs', [{
    address: POOL_MANAGER,
    topics: [INIT_TOPIC, null, t0, t1],
    fromBlock: '0x0',
    toBlock: 'latest',
  }]).catch(() => [])
  return Array.isArray(result) ? result : []
}

export function feeLabel(key) {
  if (!key) return 'v4'
  if (key.hooks && key.hooks.toLowerCase() !== ZERO_ADDR.toLowerCase()) {
    if (key.hooks.toLowerCase() === PONS_HOOK.toLowerCase()) return 'pons hook'
    return 'v4 hook'
  }
  if (!key.fee) return 'v4'
  return (key.fee / 10000) + '%'
}

async function quoteV4(key, zeroForOne, amountIn) {
  const data = '0x' + V4_QUOTE_SEL
    + padUint(32)
    + padAddr(key.currency0)
    + padAddr(key.currency1)
    + padUint(key.fee)
    + padInt(key.tickSpacing)
    + padAddr(key.hooks)
    + padUint(zeroForOne ? 1 : 0)
    + padUint(amountIn)
    + padUint(256)
    + padUint(0)
  const raw = await rpc('eth_call', [{ to: V4_QUOTER, data }, 'latest'])
  if (!raw || raw === '0x') throw new Error('empty v4 quote')
  const amountOut = BigInt(hexJson(raw.slice(0, 66)))
  if (amountOut === 0n) throw new Error('zero v4 quote')
  return amountOut
}

async function resolvePoolKey(token) {
  const want = token.toLowerCase()
  if (poolKeyCache.has(want)) return poolKeyCache.get(want)
  const pons = {
    currency0: ZERO_ADDR,
    currency1: token,
    fee: 0,
    tickSpacing: 200,
    hooks: PONS_HOOK,
  }
  try {
    await quoteV4(pons, true, 10n ** 15n)
    poolKeyCache.set(want, pons)
    return pons
  } catch {
    /* not a default Pons hatch */
  }
  let lastErr = null
  const pairs = [
    [ZERO_ADDR, token],
    [WETH, token],
  ]
  for (const [c0, c1] of pairs) {
    const ordered = BigInt(c0) < BigInt(c1) ? [c0, c1] : [c1, c0]
    const logs = await logsForPair(ordered[0], ordered[1])
    for (const log of logs) {
      const key = decodeInitLog(log)
      try {
        await quoteV4(key, true, 10n ** 15n)
        poolKeyCache.set(want, key)
        return key
      } catch (err) {
        lastErr = err
        try {
          await quoteV4(key, false, 10n ** 15n)
          poolKeyCache.set(want, key)
          return key
        } catch (err2) {
          lastErr = err2
        }
      }
    }
  }
  throw lastErr || new Error('no Uniswap v4 pool')
}

async function quoteV3({ tokenIn, tokenOut, amountIn }) {
  let best = null
  let lastErr = null
  for (const fee of FEES) {
    const data = '0x' + QUOTE_SEL + padAddr(tokenIn) + padAddr(tokenOut) + padUint(amountIn) + padUint(fee) + padUint(0)
    try {
      const raw = await rpc('eth_call', [{ to: QUOTER_V2, data }, 'latest'])
      if (!raw || raw === '0x') {
        lastErr = new Error('empty quote fee ' + fee)
        continue
      }
      const amountOut = BigInt(hexJson(raw.slice(0, 66)))
      if (amountOut === 0n) continue
      if (!best || amountOut > best.amountOut) {
        best = { amountOut, fee, amountIn, tokenIn, tokenOut, via: 'v3', feeLabel: (fee / 10000) + '%' }
      }
    } catch (err) {
      lastErr = err
    }
  }
  if (!best) throw lastErr || new Error('no v3 pool')
  return best
}

export async function quoteSwap({ tokenIn, tokenOut, amountIn }) {
  if (!/^0x[a-fA-F0-9]{40}$/.test(tokenIn) || !/^0x[a-fA-F0-9]{40}$/.test(tokenOut)) {
    throw new Error('bad token')
  }
  if (tokenIn.toLowerCase() === USDG_FAKE.toLowerCase() || tokenOut.toLowerCase() === USDG_FAKE.toLowerCase()) {
    throw new Error('USDG ticker squatter — refuse quote')
  }
  const amt = BigInt(amountIn)
  if (amt <= 0n) throw new Error('bad amount')
  const meme = isEthLike(tokenIn) ? tokenOut : tokenIn
  try {
    const key = await resolvePoolKey(meme)
    const zeroForOne = isEthLike(tokenIn)
      ? key.currency0.toLowerCase() === ZERO_ADDR.toLowerCase() || key.currency0.toLowerCase() === WETH.toLowerCase()
      : key.currency0.toLowerCase() === meme.toLowerCase()
    const amountOut = await quoteV4(key, zeroForOne, amt)
    return {
      amountOut,
      amountIn: amt,
      tokenIn,
      tokenOut,
      fee: key.fee,
      feeLabel: feeLabel(key),
      via: 'v4',
      poolKey: key,
      zeroForOne,
    }
  } catch (v4err) {
    try {
      const v3In = isEthLike(tokenIn) ? WETH : tokenIn
      const v3Out = isEthLike(tokenOut) ? WETH : tokenOut
      return await quoteV3({ tokenIn: v3In, tokenOut: v3Out, amountIn: amt })
    } catch {
      const msg = String(v4err && v4err.message || v4err)
      throw new Error(/revert/i.test(msg) ? 'no Uniswap pool for this hatch' : msg)
    }
  }
}

export async function quoteExactIn(tokenOut, amountEth = '0.05', tokenIn = ZERO_ADDR) {
  return quoteSwap({ tokenIn, tokenOut, amountIn: parseUnits(String(amountEth), 18) })
}

export function formatOut(amount, decimals = 18) {
  const n = Number(amount) / 10 ** decimals
  if (!Number.isFinite(n)) return amount.toString()
  if (n >= 1000) return n.toFixed(2)
  if (n >= 1) return n.toFixed(4)
  return n.toPrecision(4)
}

export async function tokenMeta(address) {
  const rwa = rwaOf(address)
  if (rwa) return { ...rwa, decimals: 18 }
  const [sym, dec] = await Promise.all([
    rpc('eth_call', [{ to: address, data: '0x95d89b41' }, 'latest']).catch(() => '0x'),
    rpc('eth_call', [{ to: address, data: '0x313ce567' }, 'latest']).catch(() => '0x'),
  ])
  let symbol = rwa ? rwa.symbol : 'TKN'
  try {
    const hex = (sym || '0x').slice(2)
    if (hex.length >= 128) {
      const off = Number(BigInt('0x' + hex.slice(0, 64))) * 2
      const len = Number(BigInt('0x' + hex.slice(off, off + 64))) * 2
      const s = hex.slice(off + 64, off + 64 + len)
      const chars = s.match(/.{2}/g) || []
      symbol = chars.map((c) => String.fromCharCode(parseInt(c, 16))).join('').replace(/\0/g, '')
    } else if (hex.length >= 64) {
      const chars = hex.slice(0, 64).match(/.{2}/g) || []
      symbol = chars.map((c) => String.fromCharCode(parseInt(c, 16))).join('').replace(/\0/g, '')
    }
  } catch {
    /* keep TKN */
  }
  let decimals = 18
  try {
    if (dec && dec !== '0x') decimals = Number(BigInt(dec))
  } catch {
    decimals = 18
  }
  if (address.toLowerCase() === USDG.toLowerCase()) decimals = 6
  return { symbol: symbol || 'TKN', name: symbol, address, decimals }
}

export function parseUnits(value, decimals = 18) {
  const s = String(value).trim()
  if (!s || !/^\d+(\.\d+)?$/.test(s)) throw new Error('bad amount')
  const [w, f = ''] = s.split('.')
  if (f.length > decimals) throw new Error('too many decimals')
  return BigInt(w + f.padEnd(decimals, '0'))
}

function toHex(n) {
  return '0x' + BigInt(n).toString(16)
}

function encodeExactInputSingle({ tokenIn, tokenOut, fee, recipient, amountIn, amountOutMinimum, sqrtPriceLimitX96 = 0 }) {
  return '0x04e45aaf'
    + padAddr(tokenIn)
    + padAddr(tokenOut)
    + padUint(fee)
    + padAddr(recipient)
    + padUint(amountIn)
    + padUint(amountOutMinimum)
    + padUint(sqrtPriceLimitX96)
}

function encodeUnwrapWETH9(amountMinimum, recipient) {
  return '0x49404b7c' + padUint(amountMinimum) + padAddr(recipient)
}

function encodeApprove(spender, amount) {
  return '0x095ea7b3' + padAddr(spender) + padUint(amount)
}

function encodeBytes(hex) {
  const raw = String(hex).replace(/^0x/i, '')
  const pad = (64 - (raw.length % 64)) % 64
  return padUint(raw.length / 2) + raw + '0'.repeat(pad)
}

function encodeMulticall(calls) {
  const items = calls.map(encodeBytes)
  const n = items.length
  let cursor = 32 * (n + 1)
  let offsets = ''
  let body = ''
  for (const item of items) {
    offsets += padUint(cursor)
    body += item
    cursor += item.length / 2
  }
  return '0xac9650d8' + padUint(32) + padUint(n) + offsets + body
}

export async function readAllowance(token, owner, spender) {
  const data = '0xdd62ed3e' + padAddr(owner) + padAddr(spender)
  const raw = await rpc('eth_call', [{ to: token, data }, 'latest'])
  if (!raw || raw === '0x') return 0n
  return BigInt(hexJson(raw))
}

export async function readTokenBalance(token, owner) {
  const data = '0x70a08231' + padAddr(owner)
  const raw = await rpc('eth_call', [{ to: token, data }, 'latest'])
  if (!raw || raw === '0x') return 0n
  return BigInt(hexJson(raw))
}

export async function sendTx({ to, data, value = '0x0' }) {
  const eth = getProvider()
  if (!eth) throw new Error('no wallet — install MetaMask or Rabby')
  const state = await connectWallet()
  if (!state.onChain) throw new Error('switch wallet to Robinhood 4663')
  return eth.request({
    method: 'eth_sendTransaction',
    params: [{
      from: state.address,
      to,
      data,
      value,
      chainId: CHAIN_ID_HEX,
    }],
  })
}

export async function waitReceipt(hash, { tries = 40, ms = 1500 } = {}) {
  for (let i = 0; i < tries; i++) {
    const rec = await rpc('eth_getTransactionReceipt', [hash]).catch(() => null)
    if (rec && rec.blockNumber) return rec
    await new Promise((r) => setTimeout(r, ms))
  }
  throw new Error('tx pending · ' + hash.slice(0, 10))
}

function minOut(amountOut, slippageBps) {
  const bps = BigInt(Math.max(1, Math.min(4900, Number(slippageBps) || 500)))
  return (BigInt(amountOut) * (10000n - bps)) / 10000n
}

function encodeV4Hop({ tokenIn, tokenOut, key }) {
  const hookOff = 10 * 32
  return padUint(2)
    + padAddr(tokenIn)
    + padAddr(tokenOut)
    + padAddr(ZERO_ADDR)
    + padUint(key.fee)
    + padInt(key.tickSpacing)
    + padAddr(key.hooks)
    + padUint(hookOff)
    + padAddr(POOL_MANAGER)
    + padBytes32('0x0')
    + padUint(0)
}

function encodeV4Swap({ tokenIn, tokenOut, key, recipient, amountIn, amountOutMin, deadline }) {
  const hop = encodeV4Hop({ tokenIn, tokenOut, key })
  const hops = padUint(1) + padUint(32) + hop
  const head = padUint(160) + padAddr(recipient) + padUint(amountIn) + padUint(amountOutMin) + padUint(deadline)
  return '0x' + V4_SWAP_SEL + head + hops
}

async function swapV4({ token, amountIn, side, slippageBps, decimals = 18 }) {
  const state = await connectWallet()
  const tokenIn = side === 'buy' ? ZERO_ADDR : token
  const tokenOut = side === 'buy' ? token : ZERO_ADDR
  const q = await quoteSwap({ tokenIn, tokenOut, amountIn })
  const floor = minOut(q.amountOut, slippageBps)
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200)
  let approve = false
  if (side === 'sell') {
    const spender = q.via === 'v4' ? V4_SWAP_ROUTER : SWAP_ROUTER_02
    const allowance = await readAllowance(token, state.address, spender)
    if (allowance < amountIn) {
      const approveHash = await sendTx({
        to: token,
        data: encodeApprove(spender, (1n << 256n) - 1n),
      })
      await waitReceipt(approveHash)
      approve = true
    }
  }
  if (q.via === 'v4' && q.poolKey) {
    const data = encodeV4Swap({
      tokenIn,
      tokenOut,
      key: q.poolKey,
      recipient: state.address,
      amountIn,
      amountOutMin: floor,
      deadline,
    })
    const hash = await sendTx({
      to: V4_SWAP_ROUTER,
      data,
      value: side === 'buy' ? toHex(amountIn) : '0x0',
    })
    return { hash, quote: q, minOut: floor, side, approve }
  }
  if (side === 'buy') {
    const data = encodeExactInputSingle({
      tokenIn: WETH,
      tokenOut: token,
      fee: q.fee,
      recipient: state.address,
      amountIn,
      amountOutMinimum: floor,
      sqrtPriceLimitX96: 0,
    })
    const hash = await sendTx({ to: SWAP_ROUTER_02, data, value: toHex(amountIn) })
    return { hash, quote: q, minOut: floor, side, approve }
  }
  const swapData = encodeExactInputSingle({
    tokenIn: token,
    tokenOut: WETH,
    fee: q.fee,
    recipient: SWAP_ROUTER_02,
    amountIn,
    amountOutMinimum: floor,
    sqrtPriceLimitX96: 0,
  })
  const data = encodeMulticall([swapData, encodeUnwrapWETH9(floor, state.address)])
  const hash = await sendTx({ to: SWAP_ROUTER_02, data, value: '0x0' })
  return { hash, quote: q, minOut: floor, side, approve }
}

export async function swapEthForToken({ token, amountEth, slippageBps = 500 }) {
  return swapV4({
    token,
    amountIn: parseUnits(String(amountEth), 18),
    side: 'buy',
    slippageBps,
  })
}

export async function swapTokenForEth({ token, amount, decimals = 18, slippageBps = 500 }) {
  return swapV4({
    token,
    amountIn: parseUnits(String(amount), decimals),
    side: 'sell',
    slippageBps,
    decimals,
  })
}
