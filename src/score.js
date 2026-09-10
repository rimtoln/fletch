function clamp(n, a = 0, b = 100) {
  return Math.max(a, Math.min(b, Number.isFinite(n) ? n : a))
}

function createdMs(v) {
  if (!v) return 0
  const n = Number(v)
  if (Number.isFinite(n) && n > 0) return n < 1e12 ? n * 1000 : n
  const p = Date.parse(v)
  return Number.isFinite(p) ? p : 0
}

function ageHours(row) {
  const ms = createdMs(row.created)
  if (!ms) return null
  return Math.max(0, (Date.now() - ms) / 3600000)
}

function logScore(value, full) {
  if (value <= 0) return 0
  return clamp(100 * (Math.log10(1 + value) / Math.log10(1 + full)))
}

function factor(id, label, score, note) {
  return { id, label, score: clamp(score), note }
}

export function scoreToken(row) {
  const ageH = ageHours(row)
  const vol = row.vol24 || 0
  const vol1h = row.vol1h || 0
  const vol5m = row.vol5m || 0
  const liq = row.liq || 0
  const mcap = row.mcap || row.fdv || 0
  const buys = row.buys24 || 0
  const sells = row.sells24 || 0
  const buys1h = row.buys1h || 0
  const sells1h = row.sells1h || 0
  const pct1h = row.pct1h || 0
  const pct24 = row.pct24 || 0
  const pct5m = row.pct5m || 0
  const tick = Number(row.tick) || 0
  const holders = row.holders || 0
  const top10 = row.top10 || 0
  const social = (row.handles && row.handles.length) || row.twHeat ? 1 : 0
  const twHeat = row.twHeat || 0

  const tapeVol = vol + vol1h * 3 + vol5m * 6
  const tape = factor('tape', 'tape', logScore(tapeVol, 400000), vol ? `vol ${Math.round(vol)}` : 'quiet book')
  const book = factor('book', 'book', logScore(liq, 200000), liq ? `liq ${Math.round(liq)}` : 'no pool')

  const buyN = buys + buys1h * 2
  const sellN = sells + sells1h * 2
  const flowRatio = sellN <= 0 ? (buyN > 0 ? 2 : 1) : buyN / Math.max(sellN, 1)
  const activity = Math.min(28, Math.log10(1 + buyN + sellN) * 14)
  const bias = Math.tanh((flowRatio - 1) * 1.15) * 36
  const flow = factor(
    'flow',
    'flow',
    38 + bias + activity,
    buyN || sellN ? `${buys}/${sells} 24h` : 'no prints',
  )

  const impulse = factor(
    'impulse',
    'impulse',
    48 + Math.tanh(tick / 6) * 16 + Math.tanh(pct5m / 14) * 14 + Math.tanh(pct1h / 22) * 16 + Math.tanh(pct24 / 40) * 6,
    tick ? `tick ${tick.toFixed(2)}%` : `1h ${pct1h.toFixed(1)}%`,
  )

  const crowd = factor(
    'crowd',
    'crowd',
    holders <= 0 ? 16 : Math.min(88, 8 + Math.log10(1 + holders) * 24) - Math.max(0, top10 - 32) * 0.8,
    holders ? `${holders} holders` : 'holders dark',
  )

  let freshScore = 34
  let freshNote = 'age unknown'
  if (ageH != null) {
    if (ageH < 0.08 && vol < 80) {
      freshScore = 18
      freshNote = 'too raw'
    } else if (ageH < 2) {
      freshScore = 82 - ageH * 10
      freshNote = `${Math.round(ageH * 60)}m old`
    } else if (ageH < 24) {
      freshScore = 62 - (ageH - 2) * 1.05
      freshNote = `${ageH.toFixed(1)}h old`
    } else if (ageH < 96) {
      freshScore = 38 - (ageH - 24) * 0.18
      freshNote = `${Math.round(ageH)}h old`
    } else {
      freshScore = 22
      freshNote = `${Math.round(ageH / 24)}d old`
    }
  }
  const fresh = factor('fresh', 'fresh', freshScore, freshNote)

  const ratio = mcap > 0 && liq > 0 ? liq / mcap : 0
  const structure = factor(
    'structure',
    'structure',
    mcap <= 0 || liq <= 0 ? 22 : logScore(ratio * 100, 40),
    ratio ? `liq/mcap ${(ratio * 100).toFixed(1)}%` : 'thin structure',
  )
  const xray = factor(
    'xray',
    'x-ray',
    social ? 38 + twHeat * 0.5 : 14,
    twHeat ? `x heat ${twHeat}` : social ? 'handle on file' : 'no social',
  )

  const factors = [tape, book, flow, impulse, crowd, fresh, structure, xray]
  const weights = {
    tape: 18,
    book: 16,
    flow: 14,
    impulse: 10,
    crowd: 10,
    fresh: 12,
    structure: 12,
    xray: 8,
  }
  let raw = 0
  let wsum = 0
  for (const f of factors) {
    const w = weights[f.id]
    raw += f.score * w
    wsum += w
  }
  let pct = raw / wsum

  const penalties = []
  if (liq > 0 && liq < 2500) {
    pct -= 16
    penalties.push('thin book')
  }
  if (sellN > buyN * 1.45 && sellN > 8) {
    pct -= 11
    penalties.push('sell-side')
  }
  if (pct24 < -22) {
    pct -= 14
    penalties.push('dump tape')
  }
  if (top10 > 55) {
    pct -= 9
    penalties.push('top10 heavy')
  }
  if (mcap > 0 && liq > 0 && mcap / liq > 40) {
    pct -= 10
    penalties.push('exit risk')
  }

  pct = clamp(Math.round(pct))
  const band = pct >= 68 ? 'SING' : pct >= 42 ? 'HUM' : 'MUTE'
  const ranked = factors.slice().sort((a, b) => b.score - a.score)
  const why = penalties[0] || `${ranked[0].label} ${ranked[0].score.toFixed(0)} · ${ranked[0].note}`
  return {
    pct,
    band,
    factors,
    penalties,
    why,
    heat: pct / 100,
    ageH,
  }
}

export function gmgnTokenUrl(address) {
  return 'https://gmgn.ai/robinhood/token/' + address
}
