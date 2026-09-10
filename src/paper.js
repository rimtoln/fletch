const KEY = 'fletch.paper.v1'
const START_CASH = 10000

function nowIso() {
  return new Date().toISOString()
}

export function loadDesk() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const d = JSON.parse(raw)
      if (d && typeof d.cash === 'number') return d
    }
  } catch {
    /* fresh desk */
  }
  return {
    cash: START_CASH,
    positions: [],
    blotter: [],
    lastQuote: null,
  }
}

export function saveDesk(desk) {
  localStorage.setItem(KEY, JSON.stringify(desk))
}

export function equity(desk) {
  let v = desk.cash
  for (const p of desk.positions) v += p.qty * p.last
  return v
}

export function mark(desk, symbol, last) {
  for (const p of desk.positions) {
    if (p.symbol === symbol) p.last = last
  }
}

export function proposeFromQuote(agent, quote, meta) {
  const px = quote.usdPerToken || quote.tokenPerEth || 0
  const qty = quote.tokenOutHuman || 0
  const notional = Math.min(500, Math.max(40, qty * (quote.usdPerToken || 1) * 0.15))
  const size = px > 0 ? notional / px : qty * 0.1
  const stop = px > 0 ? px * 0.92 : 0
  return {
    id: 'p' + Date.now().toString(36),
    ts: nowIso(),
    agent,
    side: 'buy',
    symbol: meta.symbol,
    address: meta.address,
    qty: Number(size.toPrecision(4)),
    px: Number((px || 1).toPrecision(6)),
    stop: Number(stop.toPrecision(6)),
    thesis: `${agent} paper fill vs Uniswap fee ${quote.fee / 10000}% · quote only`,
  }
}

export function proposeScan(agent, row, side = 'buy') {
  const px = 1
  const qty = 40
  return {
    id: 'p' + Date.now().toString(36),
    ts: nowIso(),
    agent,
    side,
    symbol: row.symbol,
    address: row.address,
    qty,
    px,
    stop: 0.92,
    thesis: `${agent} flagged ${row.kind} ${row.symbol} · size is paper`,
  }
}

export function applyProposal(desk, proposal, accept) {
  const row = {
    ts: nowIso(),
    side: accept ? proposal.side : 'skip',
    symbol: proposal.symbol,
    qty: proposal.qty,
    px: proposal.px,
    pnl: 0,
    agent: proposal.agent,
  }
  if (!accept) {
    desk.blotter.unshift(row)
    desk.blotter = desk.blotter.slice(0, 40)
    saveDesk(desk)
    return desk
  }
  const cost = proposal.qty * proposal.px
  if (proposal.side === 'buy') {
    if (cost > desk.cash) {
      row.side = 'reject'
      row.pnl = 0
      desk.blotter.unshift(row)
      saveDesk(desk)
      throw new Error('desk cash short')
    }
    desk.cash -= cost
    const pos = desk.positions.find((p) => p.symbol === proposal.symbol)
    if (pos) {
      const total = pos.qty * pos.entry + cost
      pos.qty += proposal.qty
      pos.entry = total / pos.qty
      pos.last = proposal.px
      pos.stop = proposal.stop
    } else {
      desk.positions.push({
        symbol: proposal.symbol,
        address: proposal.address,
        qty: proposal.qty,
        entry: proposal.px,
        last: proposal.px,
        stop: proposal.stop,
        agent: proposal.agent,
      })
    }
  } else {
    const pos = desk.positions.find((p) => p.symbol === proposal.symbol)
    if (!pos || pos.qty < proposal.qty) throw new Error('no position')
    const pnl = (proposal.px - pos.entry) * proposal.qty
    desk.cash += proposal.qty * proposal.px
    pos.qty -= proposal.qty
    row.pnl = pnl
    if (pos.qty <= 1e-9) desk.positions = desk.positions.filter((p) => p !== pos)
  }
  desk.blotter.unshift(row)
  desk.blotter = desk.blotter.slice(0, 40)
  saveDesk(desk)
  return desk
}
