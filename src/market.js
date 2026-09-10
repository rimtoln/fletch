export const DEFAULT_TOKEN = '0xB06B1E58F5ba2a3df1AB74C01cB2A44C5395B3be'

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export function fmtUsd(n, digits = 2) {
  if (n == null || !Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  if (abs >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B'
  if (abs >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M'
  if (abs >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K'
  if (abs >= 1) return '$' + n.toFixed(digits)
  if (abs >= 0.01) return '$' + n.toFixed(4)
  return '$' + n.toPrecision(3)
}

export function fmtPx(n) {
  if (n == null || !Number.isFinite(n)) return '—'
  if (n >= 1) return n.toFixed(4)
  if (n >= 0.01) return n.toFixed(5)
  return n.toPrecision(4)
}

export function fmtPct(n) {
  if (n == null || !Number.isFinite(n)) return '—'
  const sign = n > 0 ? '+' : ''
  return sign + n.toFixed(2) + '%'
}

export function ago(ts) {
  if (!ts) return '—'
  const s = Math.max(0, Math.floor(Date.now() / 1000 - Number(ts)))
  if (s < 60) return s + 's'
  if (s < 3600) return Math.floor(s / 60) + 'm'
  if (s < 86400) return Math.floor(s / 3600) + 'h'
  return Math.floor(s / 86400) + 'd'
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

function handlesFromPair(pair) {
  return ((pair.info && pair.info.socials) || [])
    .map((s) => String(s.url || ''))
    .filter((u) => /x\.com|twitter\.com/i.test(u))
    .map((u) => {
      const m = u.match(/(?:x\.com|twitter\.com)\/@?([A-Za-z0-9_]{1,15})/i)
      return m ? m[1] : ''
    })
    .filter(Boolean)
}

function pairToRow(pair, source = 'dex') {
  const ch = pair.priceChange || {}
  const vol = pair.volume || {}
  const tx = pair.txns || {}
  const base = pair.baseToken || {}
  return {
    symbol: base.symbol || '???',
    name: base.name || '',
    address: base.address || '',
    priceUsd: num(pair.priceUsd),
    priceNative: num(pair.priceNative),
    mcap: num(pair.marketCap || pair.fdv),
    fdv: num(pair.fdv),
    liq: num(pair.liquidity && pair.liquidity.usd),
    liqBase: num(pair.liquidity && pair.liquidity.base),
    liqQuote: num(pair.liquidity && pair.liquidity.quote),
    quoteSym: (pair.quoteToken && pair.quoteToken.symbol) || 'ETH',
    vol5m: num(vol.m5),
    vol1h: num(vol.h1),
    vol6h: num(vol.h6),
    vol24: num(vol.h24),
    pct5m: ch.m5 == null ? 0 : num(ch.m5),
    pct1h: ch.h1 == null ? 0 : num(ch.h1),
    pct6h: ch.h6 == null ? 0 : num(ch.h6),
    pct24: ch.h24 == null ? 0 : num(ch.h24),
    buys1h: (tx.h1 && tx.h1.buys) || 0,
    sells1h: (tx.h1 && tx.h1.sells) || 0,
    buys24: (tx.h24 && tx.h24.buys) || 0,
    sells24: (tx.h24 && tx.h24.sells) || 0,
    pairId: pair.pairAddress,
    created: pair.pairCreatedAt,
    dex: pair.dexId,
    dexId: pair.dexId,
    labels: pair.labels || [],
    source,
    socials: ((pair.info && pair.info.socials) || []).map((s) => ({
      type: (s.type || '').toLowerCase(),
      url: s.url,
    })),
    handles: handlesFromPair(pair),
  }
}

function bestPair(pairs, token) {
  const list = (pairs || []).filter((p) => (p.chainId || '').toLowerCase() === 'robinhood')
  const want = token.toLowerCase()
  const ranked = list
    .filter((p) => (p.baseToken && p.baseToken.address || '').toLowerCase() === want
      || (p.quoteToken && p.quoteToken.address || '').toLowerCase() === want)
    .sort((a, b) => (b.liquidity && b.liquidity.usd || 0) - (a.liquidity && a.liquidity.usd || 0))
  return ranked[0] || list[0] || null
}

export async function pullDex(token) {
  const json = await getJson([
    '/dex-proxy/latest/dex/tokens/' + token,
    'https://api.dexscreener.com/latest/dex/tokens/' + token,
  ])
  const pair = bestPair(json.pairs, token)
  if (!pair) throw new Error('no pair')
  return pairToRow(pair, 'dex')
}

export async function searchTokens(q) {
  const query = String(q || '').trim()
  if (!query) return []
  if (/^0x[a-fA-F0-9]{40}$/.test(query)) {
    try {
      return [await pullDex(query)]
    } catch {
      return []
    }
  }
  const json = await getJson([
    '/dex-proxy/latest/dex/search?q=' + encodeURIComponent(query),
    'https://api.dexscreener.com/latest/dex/search?q=' + encodeURIComponent(query),
  ])
  const seen = new Set()
  const rows = []
  for (const pair of json.pairs || []) {
    if ((pair.chainId || '').toLowerCase() !== 'robinhood') continue
    const row = pairToRow(pair, 'search')
    const key = (row.address || '').toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    rows.push(row)
  }
  return rows.slice(0, 24)
}

export async function pullOhlcv(poolId, aggregate = 5) {
  const json = await getJson([
    `/gt-proxy/api/v2/networks/robinhood/pools/${poolId}/ohlcv/minute?aggregate=${aggregate}&limit=100`,
    `https://api.geckoterminal.com/api/v2/networks/robinhood/pools/${poolId}/ohlcv/minute?aggregate=${aggregate}&limit=100`,
  ])
  const list = (((json.data || {}).attributes || {}).ohlcv_list) || []
  return list.slice().reverse().map((row) => ({
    t: row[0],
    o: row[1],
    h: row[2],
    l: row[3],
    c: row[4],
    v: row[5],
  }))
}

export async function pullTrades(poolId) {
  try {
    const json = await getJson([
      `/gt-proxy/api/v2/networks/robinhood/pools/${poolId}/trades?trade_volume_in_usd_greater_than=0`,
      `https://api.geckoterminal.com/api/v2/networks/robinhood/pools/${poolId}/trades?trade_volume_in_usd_greater_than=0`,
    ])
    return (json.data || []).slice(0, 40).map((d) => {
      const a = d.attributes || {}
      const usd = num(a.volume_in_usd)
      const kind = String(a.kind || a.type || '').toLowerCase()
      return {
        side: kind.includes('sell') ? 'sell' : 'buy',
        usd,
        amount: num(a.from_token_amount || a.to_token_amount),
        px: num(a.price_to_in_usd || a.price_from_in_usd),
        maker: a.tx_from_address || a.originator_address || '',
        tx: a.tx_hash || (d.id || ''),
        ts: a.block_timestamp ? Date.parse(a.block_timestamp) / 1000 : 0,
      }
    })
  } catch {
    return []
  }
}

export async function pullHolders(token, supply) {
  const json = await getJson([
    `https://robinhoodchain.blockscout.com/api/v2/tokens/${token}/holders`,
    `/bs-proxy/api/v2/tokens/${token}/holders`,
  ])
  const items = json.items || []
  const sup = Number(supply || 0)
  const rows = items.slice(0, 20).map((h) => {
    const addr = (h.address && (h.address.hash || h.address)) || ''
    const value = num(h.value)
    const share = sup > 0 ? (value / sup) * 100 : num(h.percentage)
    return { address: addr, value, share: Number.isFinite(share) ? share : 0 }
  })
  const top10 = rows.slice(0, 10).reduce((s, r) => s + r.share, 0)
  return { rows, top10 }
}

export async function pullTokenExtra(token) {
  const json = await getJson([
    `https://robinhoodchain.blockscout.com/api/v2/tokens/${token}`,
    `/bs-proxy/api/v2/tokens/${token}`,
  ]).catch(() => null)
  if (!json) return { holders: null, supply: null }
  return {
    holders: num(json.holders_count || json.holders),
    supply: json.total_supply,
    symbol: json.symbol,
    name: json.name,
    rate: num(json.exchange_rate),
    vol24: num(json.volume_24h),
  }
}

export async function loadMarket(token) {
  const dex = await pullDex(token)
  const extra = await pullTokenExtra(token)
  let candles = []
  let trades = []
  if (dex.pairId) {
    candles = await pullOhlcv(dex.pairId).catch(() => [])
    trades = await pullTrades(dex.pairId).catch(() => [])
  }
  const holders = await pullHolders(token, extra.supply).catch(() => ({ rows: [], top10: 0 }))
  const holderCount = extra.holders || holders.rows.length
  const top10 = holders.top10 || holders.rows.slice(0, 10).reduce((s, r) => s + r.share, 0)
  return {
    dex: { ...dex, holders: holderCount, vol24: dex.vol24 || extra.vol24 },
    candles,
    trades,
    holders: holders.rows,
    top10,
  }
}

function txWindow(tx, key) {
  if (!tx) return {}
  return tx[key] || {}
}

function poolToRow(p, source = 'pool') {
  const a = p.attributes || {}
  const rel = (p.relationships && p.relationships.base_token && p.relationships.base_token.data) || {}
  const id = String(rel.id || '')
  const address = id.includes('_') ? id.split('_')[1] : (a.address || '')
  const vol = a.volume_usd || {}
  const ch = a.price_change_percentage || {}
  const tx = a.transactions || {}
  const h24 = txWindow(tx, 'h24')
  const h1 = txWindow(tx, 'h1')
  const m5 = txWindow(tx, 'm5')
  const poolId = String(p.id || '').includes('_') ? String(p.id).split('_')[1] : ''
  return {
    symbol: (a.name || '').split(' / ')[0] || '???',
    name: a.name || '',
    address,
    priceUsd: num(a.base_token_price_usd),
    priceNative: num(a.base_token_price_native_currency),
    mcap: num(a.fdv_usd || a.market_cap_usd),
    fdv: num(a.fdv_usd),
    liq: num(a.reserve_in_usd),
    quoteSym: 'ETH',
    vol5m: num(vol.m5),
    vol1h: num(vol.h1),
    vol6h: num(vol.h6),
    vol24: num(vol.h24),
    pct5m: num(ch.m5),
    pct15: num(ch.m15),
    pct30: num(ch.m30),
    pct1h: num(ch.h1),
    pct6h: num(ch.h6),
    pct24: num(ch.h24),
    buys1h: num(h1.buys),
    sells1h: num(h1.sells),
    buys24: num(h24.buys),
    sells24: num(h24.sells),
    buys5m: num(m5.buys),
    sells5m: num(m5.sells),
    pairId: poolId,
    created: a.pool_created_at ? Date.parse(a.pool_created_at) : 0,
    dex: a.dex_id || a.name || '',
    source,
    handles: [],
  }
}

async function gtPools(path, page) {
  return getJson([
    `/gt-proxy/api/v2/networks/robinhood/${path}?include=base_token&page=${page}`,
    `https://api.geckoterminal.com/api/v2/networks/robinhood/${path}?include=base_token&page=${page}`,
  ]).catch(() => ({ data: [] }))
}

function isYoung(row, hours = 6) {
  const ts = Number(row.created || 0)
  if (!ts) return false
  const age = Date.now() - (ts > 1e12 ? ts : ts * 1000)
  return age >= 0 && age < hours * 3600000
}

export async function pullTape({ deep = false } = {}) {
  const jobs = [gtPools('new_pools', 1), gtPools('trending_pools', 1)]
  if (deep) {
    jobs.push(gtPools('new_pools', 2), gtPools('new_pools', 3), gtPools('pools', 1))
  }
  const [fresh1, trend, fresh2, fresh3, top] = await Promise.all(jobs)
  const rows = []
  const seen = new Set()
  function add(row) {
    const key = (row.address || row.pairId || row.name).toLowerCase()
    if (!key || seen.has(key)) return
    seen.add(key)
    rows.push(row)
  }
  const freshList = [...(fresh1.data || []), ...((fresh2 && fresh2.data) || []), ...((fresh3 && fresh3.data) || [])]
  for (const p of freshList) add(poolToRow(p, 'new'))
  const freshCount = rows.length
  for (const p of trend.data || []) {
    const row = poolToRow(p, 'trend')
    if (isYoung(row, 1)) row.source = 'new'
    add(row)
  }
  for (const p of (top && top.data) || []) add(poolToRow(p, 'trend'))
  if (deep && freshCount < 8) {
    const dexNew = await pullRecentDex().catch(() => [])
    for (const row of dexNew) add(row)
  }
  if (rows.length) return rows.slice(0, 80)
  return pullTapeDex()
}

async function pullRecentDex() {
  const queries = ['ETH', 'WETH', 'USDG']
  const seen = new Set()
  const rows = []
  await Promise.all(queries.map(async (q) => {
    const found = await searchTokens(q).catch(() => [])
    for (const row of found) {
      const key = (row.address || '').toLowerCase()
      if (!key || seen.has(key)) continue
      seen.add(key)
      rows.push({ ...row, source: isYoung(row, 6) ? 'new' : 'trend' })
    }
  }))
  return rows.sort((a, b) => Number(b.created || 0) - Number(a.created || 0)).slice(0, 40)
}

async function pullTapeDex() {
  return pullRecentDex()
}

export async function snapDexPrices(addresses) {
  const uniq = [...new Set(
    (addresses || [])
      .map((a) => String(a || '').toLowerCase())
      .filter((a) => /^0x[0-9a-f]{40}$/.test(a)),
  )].slice(0, 30)
  if (!uniq.length) return new Map()
  const json = await getJson([
    `/dex-proxy/latest/dex/tokens/${uniq.join(',')}`,
    `https://api.dexscreener.com/latest/dex/tokens/${uniq.join(',')}`,
  ]).catch(() => ({ pairs: [] }))
  const map = new Map()
  for (const pair of json.pairs || []) {
    const addr = String((pair.baseToken && pair.baseToken.address) || '').toLowerCase()
    if (!addr) continue
    const chain = String(pair.chainId || '')
    if (chain && !/robinhood|4663/i.test(chain)) continue
    const liq = num(pair.liquidity && pair.liquidity.usd)
    const prev = map.get(addr)
    if (prev && prev._liq >= liq) continue
    const ch = pair.priceChange || {}
    map.set(addr, {
      priceUsd: num(pair.priceUsd),
      pct5m: num(ch.m5),
      pct1h: num(ch.h1),
      pct24: num(ch.h24),
      vol24: num(pair.volume && pair.volume.h24),
      _liq: liq,
    })
  }
  return map
}

export async function pullHotPools() {
  return (await pullTape()).slice(0, 16)
}
