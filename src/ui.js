import { loadCicada, paintDottedCicada } from './cicada.js'
import {
  addRobinhoodChain,
  connectWallet,
  readWallet,
  walletUsd,
  watchWallet,
  getProvider,
  pullPulse,
  pullRadar,
  quoteExactIn,
  quoteSwap,
  formatOut,
  tokenMeta,
  shortAddr,
  fmtGas,
  sponsorLeft,
  USDG,
  WETH,
  EXPLORER,
  parseUnits,
  swapEthForToken,
  swapTokenForEth,
  readTokenBalance,
} from './chain.js'
import { AGENTS, makeLogger, pickProposal, scoreHeat } from './agents.js'
import {
  loadDesk,
  saveDesk,
  applyProposal,
  proposeFromQuote,
  proposeScan,
} from './paper.js'
import {
  loadMarket,
  fmtUsd,
  fmtPx,
  fmtPct,
  ago,
  pullOhlcv,
  pullDex,
  pullTape,
  searchTokens,
  snapDexPrices,
} from './market.js'
import { drawChart, sizeCanvas } from './chart.js'
import { pullTwitter } from './twitter.js'
import { scoreToken, gmgnTokenUrl } from './score.js'

const stage = document.getElementById('stage')
const asciiEl = document.getElementById('ascii')
const navCicada = document.getElementById('navCicada')
const heroCicada = document.getElementById('heroCicada')
const gate = document.getElementById('gate')
const deskStage = document.getElementById('deskStage')
const agentArray = document.getElementById('agentArray')
const blotterBody = document.getElementById('blotterBody')
const proposalBox = document.getElementById('proposalBox')
const tickerTrack = document.getElementById('tickerTrack')
const priceChart = document.getElementById('priceChart')
const volChart = document.getElementById('volChart')
const peekChart = document.getElementById('peekChart')

const logger = makeLogger()
let desk = loadDesk()
let pulse = { block: 0, gasHex: '0x0', live: false }
let radar = []
let flow = []
let heat = 0.2
let proposal = null
let lastQuote = null
let lastQuoteMeta = null
let market = null
let tf = 5
let lastAgentPaint = 0
let lastCicada = 0
let hatch = 1
let entered = true
let view = 'home'
let bootT = 0
let wallet = null
let hot = []
let twitter = null
let tape = []
let board = []
let huntFilter = 'all'
let huntPaused = false
let selected = null
let peekCandles = []
let searchTimer = 0
let searchMode = false
let tradeSide = 'buy'
let lastTrade = null
const lastPx = new Map()
let lastScanAt = 0
let hatchCount = 0

function scaleStage() {
  if (!stage) return
  const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080)
  stage.style.transform = `scale(${s})`
}

function setView(next) {
  view = next
  document.body.classList.remove('view-gate', 'view-home', 'view-desk')
  document.body.classList.add('view-' + next)
  deskStage.hidden = next !== 'desk'
  if (next === 'desk') scaleStage()
}

function escapeHtml(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
}

function clsPct(n) {
  if (n == null || !Number.isFinite(n)) return ''
  if (n > 0.005) return 'up'
  if (n < -0.005) return 'down'
  return 'flat'
}

function liveDelta(row) {
  if (!row) return null
  const tick = Number(row.tick)
  if (Number.isFinite(tick) && Math.abs(tick) >= 0.03) return tick
  const m5 = Number(row.pct5m)
  if (Number.isFinite(m5) && (m5 !== 0 || row.pct24 == null)) return m5
  const m15 = Number(row.pct15)
  if (Number.isFinite(m15) && m15 !== 0) return m15
  const m30 = Number(row.pct30)
  if (Number.isFinite(m30) && m30 !== 0) return m30
  const h1 = Number(row.pct1h)
  if (Number.isFinite(h1)) return h1
  if (Number.isFinite(m5)) return m5
  return null
}

function huntRank(row) {
  const ts = Number(row.created || 0)
  const age = ts ? Date.now() - (ts > 1e12 ? ts : ts * 1000) : 1e15
  const freshMins = age < 20 * 60000 ? (20 * 60000 - age) / 60000 : 0
  return (row.pct || 0) + freshMins * 2.4
}

function paintWallet() {
  const connected = !!(wallet && wallet.address)
  const onChain = connected && wallet.onChain
  const text = !connected
    ? 'disconnected'
    : shortAddr(wallet.address) + ' · ' + (onChain ? 'Robin Hood 4663' : 'wrong chain')
      + (wallet.balanceEth != null ? ' · ' + wallet.balanceEth.toFixed(4) + ' ETH' : '')
  document.getElementById('walletLabel').textContent = text
  const deskWallet = document.getElementById('deskWallet')
  if (deskWallet) deskWallet.textContent = text
  const btn = document.getElementById('btnWallet')
  btn.textContent = !connected ? 'connect' : (onChain ? 'connected' : 'switch Robin Hood')
  btn.classList.toggle('on', onChain)
  const hero = document.getElementById('btnHeroConnect')
  if (hero) {
    hero.textContent = onChain ? 'wallet live' : 'connect wallet'
    hero.classList.toggle('on', onChain)
  }
  const gateBtn = document.getElementById('btnGateConnect')
  if (gateBtn) gateBtn.textContent = onChain ? 'WALLET ON' : 'CONNECT WALLET'
  if (!entered && connected) {
    const gs = document.getElementById('gateStatus')
    if (gs) gs.textContent = 'wallet ' + shortAddr(wallet.address) + ' · ' + (onChain ? 'Robin Hood 4663' : 'wrong chain')
  }
  renderHomeStats()
}

async function doConnect() {
  if (wallet && wallet.address && wallet.onChain) {
    paintWallet()
    return
  }
  const status = document.getElementById('gateStatus')
  if (status) status.textContent = 'requesting wallet…'
  try {
    wallet = await connectWallet()
    paintWallet()
    logger.line('FORGE', 'wallet ' + shortAddr(wallet.address) + ' · ' + (wallet.onChain ? 'Robin Hood 4663' : 'switch chain'))
  } catch (err) {
    if (status) status.textContent = String(err.message || err)
    logger.line('CERBERUS', String(err.message || err))
  }
}

function enterApp() {
  entered = true
  if (gate) {
    gate.hidden = true
    gate.style.display = 'none'
  }
  if (view !== 'desk') showHome()
}

function showHome() {
  setView('home')
  if (location.hash === '#desk') history.replaceState(null, '', '#hunt')
  renderHunt()
  renderHomeStats()
}

function showDesk() {
  setView('desk')
  scaleStage()
  paintChart(0)
  renderDesk()
  renderAgents()
  renderTicker()
}

function scoredRow(row) {
  const scored = scoreToken(row)
  return { ...row, ...scored, top: { agent: scored.band, score: scored.pct, why: scored.why } }
}

function visibleHunt() {
  const min = Number(document.getElementById('minScore').value || 0)
  return tape.filter((row) => {
    if (row.pct < min) return false
    if (huntFilter === 'all') return true
    if (huntFilter === 'new' || huntFilter === 'trend') return row.source === huntFilter
    return row.band === huntFilter
  })
}

function ageLabel(row) {
  if (!row.created) return '—'
  const s = Math.max(0, Math.floor((Date.now() - Number(row.created)) / 1000))
  if (s < 60) return s + 's'
  if (s < 3600) return Math.floor(s / 60) + 'm'
  if (s < 86400) return Math.floor(s / 3600) + 'h'
  return Math.floor(s / 86400) + 'd'
}

function renderHunt() {
  const wrap = document.querySelector('.hunt-table-wrap')
  const keepY = wrap ? wrap.scrollTop : 0
  const body = document.getElementById('huntBody')
  const rows = visibleHunt()
  body.innerHTML = rows.map((h) => {
    const on = selected && selected.address && selected.address.toLowerCase() === (h.address || '').toLowerCase()
    const ageMs = h.created ? Date.now() - (Number(h.created) > 1e12 ? Number(h.created) : Number(h.created) * 1000) : 0
    const young = ageMs > 0 && ageMs < 15 * 60000
    const live = liveDelta(h)
    return `<tr class="${on ? 'on' : ''} ${h.band} ${h.hatched ? 'hatched' : ''}" data-addr="${escapeHtml(h.address || '')}">
      <td><div class="score ${h.band}" style="--p:${h.pct}"><b>${h.pct}</b></div></td>
      <td class="band ${h.band}">${h.band}</td>
      <td><div class="sym">$${escapeHtml(h.symbol)}</div><div class="muted">${escapeHtml((h.name || '').slice(0, 28))}</div></td>
      <td class="${young ? 'up' : 'muted'}">${young && ageMs < 60000 ? 'NEW ' : ''}${ageLabel(h)}</td>
      <td>${fmtUsd(h.mcap)}</td>
      <td>${fmtUsd(h.liq)}</td>
      <td>${fmtUsd(h.vol24)}</td>
      <td class="delta ${clsPct(live)}">${fmtPct(live)}</td>
      <td class="delta ${clsPct(h.pct24)}">${fmtPct(h.pct24)}</td>
      <td class="why">${escapeHtml(h.why)}</td>
    </tr>`
  }).join('') || `<tr><td colspan="10" class="muted">scanning Robin Hood pools…</td></tr>`
  body.querySelectorAll('tr[data-addr]').forEach((tr) => {
    tr.addEventListener('click', () => {
      const row = tape.find((t) => (t.address || '').toLowerCase() === tr.dataset.addr.toLowerCase())
      if (row) pickHunt(row)
    })
  })
  if (wrap) wrap.scrollTop = keepY
  paintHuntStatus()
}

function paintHuntStatus() {
  const st = document.getElementById('huntStatus')
  if (!st) return
  const ago = lastScanAt ? Math.max(0, Math.round((Date.now() - lastScanAt) / 1000)) : 0
  st.classList.toggle('live', !huntPaused)
  if (huntPaused) {
    st.textContent = 'paused'
    return
  }
  if (searchMode) {
    st.textContent = `Robin Hood search ${visibleHunt().length}`
    return
  }
  st.textContent = tape.length
    ? `scanning Robin Hood · ${tape.length} · ${ago}s`
    : 'scanning Robin Hood…'
}

function renderPeek(row) {
  const scored = row.pct == null ? scoredRow(row) : row
  document.getElementById('peekSym').textContent = scored.symbol || 'PICK'
  document.getElementById('peekName').textContent = scored.name || scored.symbol || 'select a hatch'
  document.getElementById('peekAddr').textContent = scored.address || 'search or click the tape'
  document.getElementById('peekPx').textContent = fmtUsd(scored.priceUsd, 6)
  document.getElementById('peekPx').className = clsPct(liveDelta(scored))
  document.getElementById('peekPxEth').textContent = scored.priceNative ? fmtPx(scored.priceNative) + ' ETH' : ''
  document.getElementById('peekPxEth').className = 'muted ' + clsPct(scored.pct5m || scored.pct1h)
  const ring = document.getElementById('peekScore')
  ring.style.setProperty('--p', scored.pct || 0)
  ring.className = 'score big ' + (scored.band || '')
  ring.querySelector('b').textContent = String(scored.pct || 0)
  document.getElementById('peekFactors').innerHTML = (scored.factors || []).map((f) => `
    <div class="factor" title="${escapeHtml(f.note)}">
      <span>${escapeHtml(f.label)}</span>
      <div class="bar"><span style="width:${f.score}%"></span></div>
      <b>${Math.round(f.score)}</b>
    </div>`).join('')
  const gmgn = document.getElementById('peekGmgn')
  gmgn.href = scored.address ? gmgnTokenUrl(scored.address) : 'https://gmgn.ai/?chain=robinhood'
  document.getElementById('tradeUnit').textContent = tradeSide === 'sell' ? (scored.symbol || 'TKN') : 'ETH'
  const send = document.getElementById('btnTradeSend')
  if (!lastTrade || lastTrade.token !== scored.address) {
    lastTrade = null
    send.disabled = true
  }
}

function drawPeek(t = 0) {
  if (!peekChart) return
  sizeCanvas(peekChart)
  const ctx = peekChart.getContext('2d')
  const w = peekChart.width
  const h = peekChart.height
  ctx.clearRect(0, 0, w, h)
  if (!peekCandles.length) return
  const closes = peekCandles.map((c) => c.c)
  const hi = Math.max(...closes)
  const lo = Math.min(...closes)
  const pad = (hi - lo) * 0.12 || hi * 0.02 || 1e-9
  ctx.strokeStyle = '#2c2a24'
  ctx.beginPath()
  ctx.moveTo(0, h / 2)
  ctx.lineTo(w, h / 2)
  ctx.stroke()
  ctx.beginPath()
  closes.forEach((px, i) => {
    const x = (i / Math.max(closes.length - 1, 1)) * (w - 8) + 4
    const u = (px - (lo - pad)) / ((hi + pad) - (lo - pad))
    const y = h - u * (h - 10) - 5
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  const up = closes[closes.length - 1] >= closes[0]
  ctx.strokeStyle = up ? '#6BDECC' : '#ef7b4b'
  ctx.lineWidth = 1.6
  ctx.stroke()
  void t
}

async function pickHunt(row) {
  selected = scoredRow(row)
  renderHunt()
  renderPeek(selected)
  peekCandles = []
  if (selected.pairId) {
    try {
      peekCandles = await pullOhlcv(selected.pairId, 5)
      drawPeek(0)
    } catch {
      peekCandles = []
    }
  }
  if (selected.address && /^0x[a-fA-F0-9]{40}$/.test(selected.address)) {
    pullDex(selected.address).then((extra) => {
      selected = scoredRow({ ...selected, ...extra, source: selected.source })
      const i = tape.findIndex((t) => (t.address || '').toLowerCase() === selected.address.toLowerCase())
      if (i >= 0) tape[i] = selected
      renderHunt()
      renderPeek(selected)
    }).catch(() => {})
  }
}

function openDeskFrom(row) {
  if (!row || !row.address) return
  document.getElementById('quoteToken').value = row.address
  showDesk()
  loadDeskToken(row.address)
}

function fmtCount(n) {
  if (n == null || !Number.isFinite(n)) return '—'
  return Math.round(n).toLocaleString('en-US')
}

function walletLabelUsd() {
  if (!wallet || !wallet.address) return '—'
  const usd = walletUsd(wallet, pulse.ethUsd)
  if (usd != null && Number.isFinite(usd) && (pulse.ethUsd || wallet.balanceUsdg)) return fmtUsd(usd)
  if (wallet.balanceEth != null) return wallet.balanceEth.toFixed(4) + ' ETH'
  return '—'
}

function renderHomeStats() {
  const src = board.length ? board : tape
  const news = src.filter((t) => t.source === 'new').length
  const trends = src.filter((t) => t.source === 'trend').length
  const sings = src.filter((t) => t.band === 'SING').length
  document.getElementById('statNew').textContent = src.length ? String(news) : '—'
  document.getElementById('statTrend').textContent = src.length ? String(trends) : '—'
  document.getElementById('statSing').textContent = src.length ? String(sings) : '—'
  document.getElementById('statPaper').textContent = walletLabelUsd()
  document.getElementById('statTx').textContent = fmtCount(pulse.txToday)
  document.getElementById('homeBlock').textContent = pulse.block ? String(pulse.block) : '—'
  document.getElementById('homeGas').textContent = fmtGas(pulse.gasHex)
  document.getElementById('homeSponsor').textContent = sponsorLeft().label.replace('SPONSOR ', '')
}

function renderAgents() {
  agentArray.innerHTML = AGENTS.map((a) => {
    const on = Date.now() - (logger.last[a.id] || 0) < 4000
    const load = Math.round(logger.load[a.id] || 8)
    return `<div class="agent-row ${on ? 'on' : ''}" style="color:${a.color}">
      <i></i><span>${a.id}</span>
      <div class="bar"><span style="width:${load}%"></span></div>
      <span>${load}%</span>
    </div>`
  }).join('')
}

function pickToken(address, symbol) {
  document.getElementById('quoteToken').value = address
  document.getElementById('quoteToken').dataset.symbol = symbol || ''
  loadDeskToken(address)
}

function renderHot() {
  const body = document.getElementById('hotBody')
  body.innerHTML = hot.slice(0, 10).map((h) => {
    const top = h.top
    const color = (AGENTS.find((a) => a.id === (top && top.agent)) || {}).color || '#cfc8b8'
    return `<tr>
      <td>${escapeHtml(h.symbol)}</td>
      <td style="color:${color}">${top ? top.agent : '—'}</td>
      <td>${top ? top.score.toFixed(0) : '—'}</td>
      <td class="muted">${top ? escapeHtml(top.why) : 'cold'}</td>
      <td><button type="button" data-quote="${h.address}" data-sym="${escapeHtml(h.symbol)}">Q</button></td>
    </tr>`
  }).join('') || `<tr><td colspan="5" class="muted">scanning heat</td></tr>`
  body.querySelectorAll('button[data-quote]').forEach((btn) => {
    btn.addEventListener('click', () => pickToken(btn.dataset.quote, btn.dataset.sym))
  })
}

function renderTwitter() {
  const box = document.getElementById('twBox')
  const head = document.getElementById('twHead')
  if (!twitter) {
    box.className = 'tw-box muted'
    box.textContent = 'no handle yet'
    head.textContent = 'TWITTER'
    return
  }
  head.textContent = '@' + twitter.handle
  box.className = 'tw-box'
  const tweets = (twitter.tweets || []).slice(0, 4).map((t) => `<p class="tw-line">“${escapeHtml(t.slice(0, 140))}”</p>`).join('')
  box.innerHTML = `<p>heat ${twitter.heat} · risk ${twitter.risk} · ${twitter.cadence} tw/24h · ${twitter.followers || 0} flw</p>
    <p class="muted">${escapeHtml((twitter.bio || '').slice(0, 160))}</p>
    ${tweets}
    <p><a href="https://x.com/${encodeURIComponent(twitter.handle)}" target="_blank" rel="noreferrer">open @${escapeHtml(twitter.handle)}</a></p>`
}

function renderDesk() {
  document.getElementById('paperCash').textContent = `CASH ${desk.cash.toFixed(2)} USDG`
  blotterBody.innerHTML = desk.blotter.slice(0, 6).map((b) => {
    const pnlClass = b.pnl > 0 ? 'pnl-pos' : b.pnl < 0 ? 'pnl-neg' : 'muted'
    const t = (b.ts || '').slice(11, 19)
    return `<tr>
      <td class="muted">${t}</td>
      <td>${b.side}</td>
      <td>${escapeHtml(b.symbol)}</td>
      <td>${b.qty}</td>
      <td>${b.px}</td>
      <td class="${pnlClass}">${Number(b.pnl).toFixed(2)}</td>
    </tr>`
  }).join('') || `<tr><td colspan="6" class="muted">empty blotter</td></tr>`
  renderProposal()
  renderHomeStats()
}

function renderProposal() {
  if (!proposal) {
    proposalBox.className = 'proposal empty'
    proposalBox.textContent = 'no live proposal'
    return
  }
  proposalBox.className = 'proposal'
  proposalBox.innerHTML = `<div>${proposal.agent} ${proposal.side} ${proposal.qty} ${escapeHtml(proposal.symbol)} @ ${proposal.px}</div>
    <div class="muted">${escapeHtml(proposal.thesis)}</div>
    <div class="acts">
      <button type="button" id="btnAccept">ACCEPT PAPER</button>
      <button type="button" id="btnSkip">SKIP</button>
    </div>`
  document.getElementById('btnAccept').onclick = () => settle(true)
  document.getElementById('btnSkip').onclick = () => settle(false)
}

function settle(accept) {
  if (!proposal) return
  try {
    applyProposal(desk, proposal, accept)
    logger.fromPaper(accept ? 'fill' : 'skip', proposal)
  } catch (err) {
    logger.line('CERBERUS', String(err.message || err))
  }
  proposal = null
  renderDesk()
  renderAgents()
}

function renderPulse() {
  document.getElementById('liveDot').classList.toggle('off', !pulse.live)
  document.getElementById('pulseBlock').textContent = pulse.block ? `BLK ${pulse.block}` : 'BLK —'
  document.getElementById('pulseGas').textContent = `GAS ${fmtGas(pulse.gasHex)}`
  document.getElementById('pulseTx').textContent = pulse.txToday ? `TX ${fmtCount(pulse.txToday)}` : 'TX —'
  document.getElementById('pulseSubsidy').textContent = sponsorLeft().label
  document.getElementById('asciiHeat').textContent = 'heat ' + heat.toFixed(2)
  renderHomeStats()
}

function setDelta(id, n) {
  const el = document.getElementById(id)
  el.textContent = fmtPct(n)
  el.className = clsPct(n)
}

function renderMarket() {
  if (!market) return
  const d = market.dex
  document.getElementById('tokenKicker').textContent = d.symbol
  document.getElementById('tokenName').textContent = d.name || d.symbol
  document.getElementById('tokenAddr').textContent = d.address
  const px = document.getElementById('tokenPx')
  px.textContent = fmtUsd(d.priceUsd, 6)
  px.className = 'px ' + clsPct(d.pct1h)
  document.getElementById('tokenPxEth').textContent = fmtPx(d.priceNative) + ' ' + (d.quoteSym || 'ETH')
  setDelta('d5', d.pct5m)
  setDelta('d1h', d.pct1h)
  setDelta('d6h', d.pct6h)
  setDelta('d24', d.pct24)
  document.getElementById('statMcap').textContent = fmtUsd(d.mcap)
  document.getElementById('statLiq').textContent = fmtUsd(d.liq)
  document.getElementById('statHolders').textContent = d.holders ? String(d.holders) : '—'
  document.getElementById('statVol').textContent = fmtUsd(d.vol24)
  document.getElementById('statFdv').textContent = fmtUsd(d.fdv)
  document.getElementById('statFlow').textContent = d.buys24 + ' / ' + d.sells24
  document.getElementById('chartMeta').textContent = `${(d.dex || 'DEX').toUpperCase()} · ${tf}M · LIQ ${fmtUsd(d.liq)}`
  const hatchScore = scoreToken({ ...d, holders: d.holders, top10: market.top10 })
  const scored = scoreHeat({ ...d, twHeat: twitter ? twitter.heat : 0 })
  document.getElementById('auditChips').innerHTML = [
    `<span class="chip live">${hatchScore.band} ${hatchScore.pct}%</span>`,
    `<span class="chip live">${d.dex || 'dex'}</span>`,
    `<span class="chip live">liq ${fmtUsd(d.liq)}</span>`,
    `<span class="chip ${d.liq < 5000 ? 'warn' : 'live'}">${d.liq < 5000 ? 'thin book' : 'book ok'}</span>`,
    scored.top ? `<span class="chip ${scored.top.agent === 'CERBERUS' ? 'warn' : 'live'}">${scored.top.agent} ${scored.top.score.toFixed(0)}</span>` : '',
    (d.handles || []).slice(0, 2).map((h) => `<span class="chip live">@${h}</span>`).join(''),
  ].join('')
  document.getElementById('tradeCount').textContent = (market.trades.length || 0) + ' PRINTS'
  document.getElementById('tradeBody').innerHTML = (market.trades.slice(0, 14)).map((tr) => {
    const side = (tr.side || 'buy').toLowerCase()
    return `<tr>
      <td class="muted">${ago(tr.ts)}</td>
      <td class="${side === 'sell' ? 'sell' : 'buy'}">${side.toUpperCase()}</td>
      <td>${fmtUsd(tr.usd)}</td>
      <td class="muted">${shortAddr(tr.maker || tr.tx)}</td>
    </tr>`
  }).join('') || `<tr><td colspan="4" class="muted">no prints yet</td></tr>`
  document.getElementById('holderBody').innerHTML = market.holders.slice(0, 10).map((h, i) => `<tr>
    <td class="muted">${i + 1}</td>
    <td>${shortAddr(h.address)}</td>
    <td>${h.share ? h.share.toFixed(2) + '%' : '—'}</td>
  </tr>`).join('') || `<tr><td colspan="3" class="muted">holders dark</td></tr>`
  document.getElementById('holderBars').innerHTML = market.holders.slice(0, 5).map((h, i) => `
    <div class="hb"><span>#${i + 1}</span><div class="bar"><span style="width:${Math.min(100, h.share || 0)}%"></span></div><span>${(h.share || 0).toFixed(1)}%</span></div>
  `).join('')
}

function renderTicker() {
  const d = market && market.dex
  const top = tape[0]
  const bits = [
    'FLETCH CICADA ROBIN HOOD 4663',
    top ? `${top.symbol} ${top.pct}% ${top.band}` : 'HUNT SYNC',
    d ? `${d.symbol} ${fmtUsd(d.priceUsd, 6)} 24H ${fmtPct(d.pct24)}` : 'NO DESK TOKEN',
    wallet && wallet.address ? `WALLET ${shortAddr(wallet.address)}` : 'WALLET OFF',
    pulse.block ? `BLOCK ${pulse.block}` : 'BLOCK SYNC',
    sponsorLeft().label,
    'QUOTER ONLY — NO SEND',
  ]
  const line = bits.join('   ·   ') + '   ·   '
  tickerTrack.textContent = line + line
}

function paintCicadas(t) {
  paintDottedCicada(navCicada, t, { gap: 1.8, glow: true })
  if (view === 'home') paintDottedCicada(heroCicada, t, { gap: 2.8, glow: true })
  if (view === 'desk' && asciiEl) paintDottedCicada(asciiEl, t, { gap: 3.2, glow: true })
}

function paintChart(t) {
  if (view !== 'desk' || !market || !market.candles.length) return
  sizeCanvas(priceChart)
  sizeCanvas(volChart)
  drawChart(priceChart, volChart, market.candles, t)
}

async function refreshChain() {
  try {
    pulse = await pullPulse()
    pulse.gasLabel = fmtGas(pulse.gasHex)
    const gwei = Number(BigInt(pulse.gasHex)) / 1e9
    heat = Math.max(0.12, Math.min(1, 0.2 + Math.log10(1 + gwei) * 0.35 + (pulse.txToday ? 0.15 : 0)))
    if (market && market.dex) heat = Math.max(heat, Math.min(1, 0.25 + Math.abs(market.dex.pct1h || 0) / 40))
    if (tape[0]) heat = Math.max(heat, tape[0].pct / 100)
    logger.fromPulse({ block: pulse.block, gasLabel: pulse.gasLabel })
    if (wallet && wallet.address) {
      wallet = await readWallet()
      paintWallet()
    }
  } catch (err) {
    pulse.live = false
    logger.line('CERBERUS', 'rpc dark · ' + String(err.message || err).slice(0, 42))
  }
  renderPulse()
  renderTicker()
  renderAgents()
  renderHomeStats()
}

let huntGen = 0
let huntBusy = false
let huntQueued = null
let scanN = 0
const hatchedSeen = new Set()

async function mapChunk(items, size, fn) {
  const out = []
  for (let i = 0; i < items.length; i += size) {
    const part = await Promise.all(items.slice(i, i + size).map(fn))
    out.push(...part)
  }
  return out
}

function mergeHunt(prev, incoming) {
  const now = Date.now()
  const map = new Map()
  for (const row of prev) {
    const key = (row.address || row.pairId || '').toLowerCase()
    if (!key) continue
    const ts = Number(row.created || 0)
    const age = ts ? now - (ts > 1e12 ? ts : ts * 1000) : 0
    if (!age || age < 18 * 3600000) map.set(key, row)
  }
  for (const row of incoming) {
    const key = (row.address || row.pairId || '').toLowerCase()
    if (!key) continue
    const old = map.get(key)
    map.set(key, old ? { ...old, ...row, hatched: old.hatched } : row)
  }
  return [...map.values()]
}

function stampTicks(rows) {
  return rows.map((row) => {
    const key = (row.address || row.pairId || '').toLowerCase()
    const usd = Number(row.priceUsd)
    const nat = Number(row.priceNative)
    const px = Number.isFinite(nat) && nat > 0 ? nat : usd
    let tick = 0
    if (key && Number.isFinite(px) && px > 0) {
      const prev = lastPx.get(key)
      const prevPx = prev && typeof prev === 'object' ? Number(prev.px) : Number(prev)
      if (Number.isFinite(prevPx) && prevPx > 0) tick = ((px - prevPx) / prevPx) * 100
      lastPx.set(key, { px, usd, nat })
    }
    return { ...row, tick }
  })
}

async function overlayDexPrices(rows) {
  const newest = rows.slice().sort((a, b) => Number(b.created || 0) - Number(a.created || 0))
  const snap = await snapDexPrices(newest.map((r) => r.address))
  if (!snap.size) return rows
  return rows.map((row) => {
    const extra = snap.get((row.address || '').toLowerCase())
    if (!extra) return row
    return {
      ...row,
      priceUsd: extra.priceUsd || row.priceUsd,
      pct5m: extra.pct5m != null ? extra.pct5m : row.pct5m,
      pct1h: extra.pct1h != null ? extra.pct1h : row.pct1h,
      pct24: extra.pct24 != null ? extra.pct24 : row.pct24,
      vol24: extra.vol24 || row.vol24,
      liq: extra._liq || row.liq,
    }
  })
}

function commitHunt(rows) {
  const firstPaint = hatchedSeen.size === 0
  const next = stampTicks(rows).map((row) => {
    const scored = scoredRow(row)
    const key = (scored.address || scored.pairId || '').toLowerCase()
    const hatched = !!(key && !firstPaint && !hatchedSeen.has(key))
    if (key) hatchedSeen.add(key)
    if (hatched) hatchCount += 1
    return { ...scored, hatched }
  })
  next.sort((a, b) => huntRank(b) - huntRank(a) || (b.vol24 || 0) - (a.vol24 || 0))
  tape = next.slice(0, 120)
  board = tape
  lastScanAt = Date.now()
  hot = tape.map((h) => {
    const s = scoreHeat(h)
    return { ...h, ...s }
  }).filter((h) => h.top)
  logger.fromHot(hot.map((h) => ({ ...h.top, symbol: h.symbol })))
  renderHunt()
  renderHot()
  renderHomeStats()
  if (!selected && tape[0]) pickHunt(tape[0])
  else if (selected) {
    const fresh = tape.find((t) => t.address && selected.address && t.address.toLowerCase() === selected.address.toLowerCase())
    if (fresh) {
      selected = fresh
      renderPeek(selected)
    }
  }
  if (!proposal) {
    const pick = pickProposal(hot, logger)
    if (pick) proposal = proposeScan(pick.agent, pick.row)
    renderProposal()
  }
}

async function refreshHunt(force = false, opts = {}) {
  const deep = !!opts.deep
  const dex = !!opts.dex
  if (huntPaused && !force) return
  if (searchMode && !force) return
  if (huntBusy) {
    huntQueued = {
      force: force || !!(huntQueued && huntQueued.force),
      deep: deep || !!(huntQueued && huntQueued.deep),
      dex: dex || !!(huntQueued && huntQueued.dex),
    }
    return
  }
  huntBusy = true
  const gen = ++huntGen
  try {
    paintHuntStatus()
    let rows = await pullTape({ deep })
    if (gen !== huntGen) return
    rows = mergeHunt(tape, rows)
    if (dex) rows = await overlayDexPrices(rows)
    if (gen !== huntGen) return
    if (!rows.length) {
      if (!tape.length) {
        const st = document.getElementById('huntStatus')
        if (st) st.textContent = 'tape miss'
      }
      return
    }
    commitHunt(rows)
  } catch (err) {
    logger.line('CERBERUS', 'hunt miss · ' + String(err.message || err).slice(0, 36))
    if (!tape.length) {
      const st = document.getElementById('huntStatus')
      if (st) st.textContent = 'tape miss'
    }
  } finally {
    if (gen === huntGen) huntBusy = false
    if (huntQueued && !huntBusy) {
      const q = huntQueued
      huntQueued = null
      refreshHunt(q.force, q)
    }
  }
  pullRadar().then((data) => {
    radar = data.radar
    flow = data.flow
    logger.fromRadar(radar, flow)
  }).catch(() => {})
  renderAgents()
}

async function runSearch(q) {
  const query = q.trim()
  if (!query) {
    searchMode = false
    tape = board.length ? board : tape
    if (!tape.length) refreshHunt(true)
    else {
      renderHunt()
      renderHomeStats()
    }
    return
  }
  searchMode = true
  document.getElementById('huntStatus').textContent = 'searching…'
  try {
    const rows = await searchTokens(query)
    tape = rows.map((r) => scoredRow({ ...r, source: 'search' })).sort((a, b) => b.pct - a.pct)
    renderHunt()
    if (tape[0]) pickHunt(tape[0])
    document.getElementById('huntStatus').textContent = tape.length ? `Robin Hood ${tape.length}` : 'no Robin Hood match'
  } catch (err) {
    document.getElementById('huntStatus').textContent = 'search miss'
    logger.line('CERBERUS', 'search miss · ' + String(err.message || err).slice(0, 36))
  }
}

async function loadTwitter(handles) {
  const h = (handles || [])[0]
  if (!h) {
    twitter = null
    renderTwitter()
    return
  }
  try {
    twitter = await pullTwitter(h)
    logger.fromTwitter(twitter)
    renderTwitter()
    renderAgents()
  } catch (err) {
    twitter = { handle: h, heat: 0, risk: 0, cadence: 0, tweets: [], bio: String(err.message || err) }
    renderTwitter()
  }
}

async function loadDeskToken(address) {
  const token = (address || document.getElementById('quoteToken').value || '').trim()
  if (!/^0x[a-fA-F0-9]{40}$/.test(token)) return
  document.getElementById('quoteToken').value = token
  document.getElementById('tokenName').textContent = 'loading…'
  try {
    market = await loadMarket(token)
    if (market.dex.liq < 8000) logger.line('CERBERUS', `thin liq ${market.dex.symbol} ${fmtUsd(market.dex.liq)}`)
    logger.line('HUNTER', `${market.dex.symbol} ${fmtUsd(market.dex.priceUsd, 6)} vol ${fmtUsd(market.dex.vol24)}`)
    renderMarket()
    renderTicker()
    paintChart(0)
    loadTwitter(market.dex.handles)
  } catch (err) {
    logger.line('CERBERUS', 'desk miss · ' + String(err.message || err).slice(0, 48))
  }
  renderAgents()
}

async function changeTf(next) {
  tf = next
  document.querySelectorAll('.tf button').forEach((b) => b.classList.toggle('on', Number(b.dataset.tf) === tf))
  if (!market || !market.dex.pairId) return
  try {
    market.candles = await pullOhlcv(market.dex.pairId, tf)
    paintChart(0)
    document.getElementById('chartMeta').textContent = `${(market.dex.dex || 'DEX').toUpperCase()} · ${tf}M`
  } catch {
    logger.line('CERBERUS', 'ohlcv miss')
  }
}

async function runQuote() {
  const token = document.getElementById('quoteToken').value.trim()
  const amount = document.getElementById('quoteAmount').value.trim() || '0.05'
  const outEl = document.getElementById('quoteOut')
  const paperBtn = document.getElementById('btnPaperQuote')
  paperBtn.disabled = true
  outEl.textContent = 'quoting…'
  try {
    const meta = await tokenMeta(token)
    const q = await quoteExactIn(token, amount)
    const decimals = token.toLowerCase() === USDG.toLowerCase() ? 6 : meta.decimals || 18
    const human = formatOut(q.amountOut, decimals)
    lastQuote = {
      ...q,
      amountEth: amount,
      human,
      fee: q.fee,
      tokenOutHuman: Number(human),
      usdPerToken: market && market.dex && market.dex.priceUsd || 0,
      tokenPerEth: Number(human) / Number(amount),
    }
    lastQuoteMeta = meta
    logger.fromQuote(lastQuote, meta)
    outEl.textContent = `${amount} ETH → ${human} ${meta.symbol}  ·  ${q.feeLabel || q.via || 'v4'}  ·  quoter only`
    paperBtn.disabled = false
    proposal = proposeFromQuote('FORGE', lastQuote, meta)
    renderProposal()
    renderAgents()
  } catch (err) {
    lastQuote = null
    outEl.textContent = String(err.message || err)
    logger.line('CERBERUS', 'quote fail · ' + String(err.message || err).slice(0, 48))
  }
}

function slipBps() {
  const n = Number(document.getElementById('tradeSlip').value || document.getElementById('deskSlip').value || 5)
  return Math.round(Math.max(0.5, Math.min(49, Number.isFinite(n) ? n : 5)) * 100)
}

function setTradeQuote(text, err = false) {
  const el = document.getElementById('tradeQuote')
  el.textContent = text
  el.classList.toggle('err', err)
}

async function runTradeQuote() {
  const token = (selected && selected.address) || document.getElementById('quoteToken').value.trim()
  const amt = document.getElementById('tradeAmt').value.trim() || '0.05'
  const send = document.getElementById('btnTradeSend')
  send.disabled = true
  lastTrade = null
  if (!/^0x[a-fA-F0-9]{40}$/.test(token)) {
    setTradeQuote('pick a hatch first', true)
    return
  }
  setTradeQuote('quoting Uniswap…')
  try {
    const meta = await tokenMeta(token)
    if (tradeSide === 'buy') {
      const q = await quoteExactIn(token, amt)
      const human = formatOut(q.amountOut, meta.decimals || 18)
      lastTrade = { side: 'buy', token, amount: amt, quote: q, meta }
      setTradeQuote(`${amt} ETH → ${human} ${meta.symbol}  ·  ${q.feeLabel || 'v4'}  ·  you sign next`)
    } else {
      const amountIn = parseUnits(amt, meta.decimals || 18)
      const q = await quoteSwap({ tokenIn: token, tokenOut: WETH, amountIn })
      const human = formatOut(q.amountOut, 18)
      lastTrade = { side: 'sell', token, amount: amt, quote: q, meta }
      setTradeQuote(`${amt} ${meta.symbol} → ${human} ETH  ·  ${q.feeLabel || 'v4'}  ·  approve if needed`)
    }
    send.disabled = false
    if (selected && selected.liq < 2500) setTradeQuote((document.getElementById('tradeQuote').textContent) + '  ·  thin book', true)
  } catch (err) {
    const msg = String(err.message || err)
    setTradeQuote(/revert/i.test(msg) ? 'no Uniswap pool at standard fees' : msg, true)
  }
}

async function runTradeSend() {
  const send = document.getElementById('btnTradeSend')
  if (!lastTrade) {
    await runTradeQuote()
    if (!lastTrade) return
  }
  if (!getProvider()) {
    setTradeQuote('install Rabby or MetaMask, then connect', true)
    return
  }
  send.disabled = true
  setTradeQuote('wallet prompt · sign to send')
  try {
    const slip = slipBps()
    const res = lastTrade.side === 'buy'
      ? await swapEthForToken({ token: lastTrade.token, amountEth: lastTrade.amount, slippageBps: slip })
      : await swapTokenForEth({
        token: lastTrade.token,
        amount: lastTrade.amount,
        decimals: lastTrade.meta.decimals || 18,
        slippageBps: slip,
      })
    logger.line('FORGE', `${res.side} sent ${res.hash.slice(0, 10)}`)
    setTradeQuote(`sent ${res.hash.slice(0, 10)}… · ${EXPLORER}/tx/${res.hash}`)
    const out = document.getElementById('quoteOut')
    if (out) out.innerHTML = `<a href="${EXPLORER}/tx/${res.hash}" target="_blank" rel="noreferrer">tx ${res.hash.slice(0, 10)}</a>`
    wallet = await readWallet()
    paintWallet()
  } catch (err) {
    const msg = String(err.message || err)
    setTradeQuote(/reject|denied|user/i.test(msg) ? 'wallet rejected' : msg, true)
    logger.line('CERBERUS', msg.slice(0, 48))
  }
  send.disabled = false
}

async function runDeskSwap(side) {
  const token = document.getElementById('quoteToken').value.trim()
  const amount = document.getElementById('quoteAmount').value.trim() || '0.05'
  const outEl = document.getElementById('quoteOut')
  const slip = Math.round(Math.max(0.5, Math.min(49, Number(document.getElementById('deskSlip').value) || 5)) * 100)
  if (!/^0x[a-fA-F0-9]{40}$/.test(token)) {
    outEl.textContent = 'load a token first'
    return
  }
  if (!getProvider()) {
    outEl.textContent = 'connect wallet first'
    await doConnect()
    return
  }
  outEl.textContent = side === 'buy' ? 'quoting buy…' : 'quoting sell…'
  try {
    const meta = await tokenMeta(token)
    if (side === 'sell') {
      const bal = wallet && wallet.address ? await readTokenBalance(token, wallet.address) : 0n
      if (bal === 0n) {
        outEl.textContent = 'token balance 0 — cannot sell'
        return
      }
    }
    outEl.textContent = 'wallet prompt · sign to send'
    const res = side === 'buy'
      ? await swapEthForToken({ token, amountEth: amount, slippageBps: slip })
      : await swapTokenForEth({ token, amount, decimals: meta.decimals || 18, slippageBps: slip })
    outEl.innerHTML = `sent · <a href="${EXPLORER}/tx/${res.hash}" target="_blank" rel="noreferrer">${res.hash.slice(0, 10)}</a>`
    logger.line('FORGE', `${side} ${meta.symbol} ${res.hash.slice(0, 10)}`)
    wallet = await readWallet()
    paintWallet()
  } catch (err) {
    outEl.textContent = String(err.message || err)
    logger.line('CERBERUS', String(err.message || err).slice(0, 48))
  }
}

function tickClock() {
  const el = document.getElementById('clockUtc')
  if (!el) return
  const d = new Date()
  el.textContent = d.toISOString().slice(11, 19) + ' UTC'
  if (view === 'home') paintHuntStatus()
}

function bind() {
  document.getElementById('btnNetwork').onclick = async () => {
    try {
      await addRobinhoodChain()
      wallet = await readWallet()
      paintWallet()
      logger.line('FORGE', 'Robin Hood chain 4663 in wallet')
    } catch (err) {
      logger.line('CERBERUS', String(err.message || err))
    }
  }
  document.getElementById('btnWallet').onclick = () => doConnect()
  document.getElementById('btnHeroConnect').onclick = () => doConnect()
  document.getElementById('btnGateConnect').onclick = () => doConnect()
  document.getElementById('btnGateEnter').onclick = () => enterApp()
  document.getElementById('btnHome').onclick = () => showHome()
  document.getElementById('btnHuntPause').onclick = () => {
    huntPaused = !huntPaused
    document.getElementById('btnHuntPause').textContent = huntPaused ? 'resume' : 'pause'
    renderHunt()
  }
  document.getElementById('huntFilters').onclick = (ev) => {
    const btn = ev.target.closest('button[data-filter]')
    if (!btn) return
    huntFilter = btn.dataset.filter
    document.querySelectorAll('#huntFilters button').forEach((b) => b.classList.toggle('on', b === btn))
    renderHunt()
  }
  document.getElementById('minScore').oninput = () => {
    document.getElementById('minScoreLabel').textContent = document.getElementById('minScore').value + '%'
    renderHunt()
  }
  document.getElementById('huntSearch').oninput = (ev) => {
    const q = ev.target.value
    window.clearTimeout(searchTimer)
    searchTimer = window.setTimeout(() => runSearch(q), 380)
  }
  window.__fletchEnter = enterApp
  window.__fletchConnect = doConnect
  document.getElementById('btnQuote').onclick = () => runQuote()
  document.getElementById('btnSwapBuy').onclick = () => runDeskSwap('buy')
  document.getElementById('btnSwapSell').onclick = () => runDeskSwap('sell')
  document.getElementById('btnPaperQuote').onclick = () => {
    if (!lastQuote || !lastQuoteMeta) return
    proposal = proposeFromQuote('FORGE', lastQuote, lastQuoteMeta)
    renderProposal()
  }
  document.getElementById('tradeTabs').onclick = (ev) => {
    const btn = ev.target.closest('button[data-side]')
    if (!btn) return
    tradeSide = btn.dataset.side
    document.querySelectorAll('#tradeTabs button').forEach((b) => b.classList.toggle('on', b === btn))
    lastTrade = null
    document.getElementById('btnTradeSend').disabled = true
    document.getElementById('tradeUnit').textContent = tradeSide === 'sell'
      ? ((selected && selected.symbol) || 'TKN')
      : 'ETH'
    if (tradeSide === 'sell' && document.getElementById('tradeAmt').value === '0.05') {
      document.getElementById('tradeAmt').value = '1000'
    }
    if (tradeSide === 'buy' && document.getElementById('tradeAmt').value === '1000') {
      document.getElementById('tradeAmt').value = '0.05'
    }
    setTradeQuote('quote this side before you sign')
  }
  document.getElementById('btnTradeQuote').onclick = () => runTradeQuote()
  document.getElementById('btnTradeSend').onclick = () => runTradeSend()
  document.getElementById('btnLoad').onclick = () => {
    showDesk()
    loadDeskToken()
  }
  document.querySelectorAll('.tf button').forEach((b) => {
    b.onclick = () => changeTf(Number(b.dataset.tf))
  })
  watchWallet((state) => {
    wallet = state
    paintWallet()
  })
}

function loop(t) {
  if (!bootT) bootT = t
  const sec = t / 1000
  if (sec - lastCicada > 0.08) {
    lastCicada = sec
    paintCicadas(sec)
  }
  paintChart(sec)
  if (view === 'home') drawPeek(sec)
  logger.decay()
  if (t - lastAgentPaint > 220) {
    renderAgents()
    lastAgentPaint = t
  }
  requestAnimationFrame(loop)
}

export function boot() {
  if (gate) {
    gate.hidden = true
    gate.style.display = 'none'
  }
  entered = true
  if (location.hash === '#desk' || location.hash === '#gate') history.replaceState(null, '', '#hunt')
  scaleStage()
  window.addEventListener('resize', () => {
    scaleStage()
    paintChart(0)
    drawPeek(0)
  })
  bind()
  showHome()
  renderDesk()
  renderAgents()
  renderTicker()
  tickClock()
  loadCicada().then(() => paintCicadas(0))
  readWallet().then((state) => {
    wallet = state
    paintWallet()
  }).catch(() => {})
  refreshChain()
  refreshHunt(true, { deep: true, dex: false })
  setInterval(refreshChain, 4000)
  setInterval(() => {
    scanN += 1
    refreshHunt(false, { deep: scanN % 3 === 0, dex: false })
  }, 2200)
  setInterval(() => {
    if (view === 'desk') {
      const token = document.getElementById('quoteToken').value.trim()
      if (token) loadDeskToken(token)
    }
  }, 15000)
  setInterval(() => {
    document.getElementById('pulseSubsidy').textContent = sponsorLeft().label
    renderHomeStats()
  }, 30000)
  setInterval(tickClock, 1000)
  requestAnimationFrame(loop)
}

saveDesk(desk)
void flow
void radar
