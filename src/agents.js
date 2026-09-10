export const AGENTS = [
  { id: 'SEEK', color: '#ef7b4b', job: 'new heat' },
  { id: 'HUNTER', color: '#c6b98c', job: 'flow' },
  { id: 'MIDAS', color: '#e2c36b', job: 'size' },
  { id: 'FORGE', color: '#6BDECC', job: 'book' },
  { id: 'CERBERUS', color: '#d45b5b', job: 'risk' },
  { id: 'MERCURY', color: '#7ec8e3', job: 'x-ray' },
]

function stamp() {
  const d = new Date()
  return d.toTimeString().slice(0, 8)
}

export function scoreHeat(row) {
  const marks = []
  const ageH = row.created ? (Date.now() - row.created) / 3600000 : 999
  const vol = row.vol24 || 0
  const vol1h = row.vol1h || 0
  const liq = row.liq || 0
  const buys = row.buys24 || 0
  const sells = row.sells24 || 0
  const pct1h = row.pct1h || 0
  const pct24 = row.pct24 || 0
  const mcap = row.mcap || 0

  if (ageH < 36 && vol > 400) {
    marks.push({ agent: 'SEEK', score: Math.min(99, 40 + (36 - ageH) + vol / 80), why: 'new + volume' })
  }
  if (buys > sells * 1.25 && vol1h > 40) {
    marks.push({ agent: 'HUNTER', score: Math.min(99, 35 + (buys - sells) * 2 + vol1h / 10), why: 'buy flow' })
  }
  if (mcap > 8000 && pct1h > 4) {
    marks.push({ agent: 'MIDAS', score: Math.min(99, 30 + pct1h * 3 + mcap / 2000), why: 'mcap impulse' })
  }
  if (liq > 4000 && vol / Math.max(liq, 1) > 0.25) {
    marks.push({ agent: 'FORGE', score: Math.min(99, 28 + (vol / liq) * 40), why: 'book turning' })
  }
  if (pct24 < -22 || (sells > buys * 1.4 && liq < 8000) || liq < 2500) {
    marks.push({ agent: 'CERBERUS', score: Math.min(99, 45 + Math.abs(Math.min(0, pct24))), why: pct24 < -22 ? 'dump tape' : 'thin / sell-side' })
  }
  if (row.twHeat >= 30) {
    marks.push({ agent: 'MERCURY', score: row.twHeat, why: 'x cadence / launch talk' })
  }
  marks.sort((a, b) => b.score - a.score)
  const heat = marks.reduce((s, m) => s + m.score, 0)
  return { marks, heat, top: marks[0] || null }
}

export function makeLogger() {
  const seek = []
  const risk = []
  const load = {}
  const last = {}
  for (const a of AGENTS) {
    load[a.id] = 8
    last[a.id] = 0
  }

  function push(list, agent, line, max = 18) {
    list.push({ t: stamp(), agent, line })
    if (list.length > max) list.shift()
    last[agent] = Date.now()
    load[agent] = Math.min(100, load[agent] * 0.82 + 38)
  }

  function decay() {
    for (const a of AGENTS) load[a.id] = Math.max(6, load[a.id] * 0.96)
  }

  return {
    seek,
    risk,
    load,
    last,
    line(agent, text) {
      if (agent === 'CERBERUS') push(risk, agent, text)
      else push(seek, agent, text)
    },
    fromPulse(pulse) {
      this.line('HUNTER', `blk ${pulse.block} gas ${pulse.gasLabel}`)
    },
    fromRadar(radar, flow) {
      const born = radar.find((r) => r.kind === 'meme')
      if (born) this.line('SEEK', `listing ${born.symbol} ${born.address.slice(0, 10)}`)
      const hit = radar.find((r) => r.kind === 'risk')
      if (hit) this.line('CERBERUS', `ticker collision ${hit.symbol}`)
      const fat = flow.find((f) => f.value > 0.25)
      if (fat) this.line('HUNTER', `print ${fat.value.toFixed(3)} ETH`)
    },
    fromHot(marks) {
      for (const m of marks.slice(0, 4)) {
        this.line(m.agent, `${m.symbol} ${m.score.toFixed(0)} · ${m.why}`)
      }
    },
    fromQuote(q, meta) {
      this.line('FORGE', `quote ${q.amountEth} ETH → ${q.human} ${meta.symbol}`)
    },
    fromPaper(action, proposal) {
      this.line('FORGE', `paper ${action} ${proposal.side} ${proposal.qty} ${proposal.symbol}`)
    },
    fromTwitter(tw) {
      this.line('MERCURY', `@${tw.handle} heat ${tw.heat} risk ${tw.risk} · ${tw.cadence} tw/24h`)
    },
    decay,
  }
}

export function pickProposal(hot, logger) {
  const row = (hot || []).find((h) => h.top && h.top.agent !== 'CERBERUS')
  if (!row) return null
  logger.line(row.top.agent, `candidate ${row.symbol} · ${row.top.why}`)
  return {
    agent: row.top.agent,
    row: { symbol: row.symbol, address: row.address, kind: 'meme' },
  }
}
