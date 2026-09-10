const UP = '#6BDECC'
const DOWN = '#ef7b4b'
const GRID = '#1c1b17'
const AXIS = '#7a7466'

export function drawChart(priceCv, volCv, candles, t = 0) {
  if (!priceCv || !volCv || !candles.length) return
  const pctx = priceCv.getContext('2d')
  const vctx = volCv.getContext('2d')
  const pw = priceCv.width
  const ph = priceCv.height
  const vw = volCv.width
  const vh = volCv.height
  pctx.clearRect(0, 0, pw, ph)
  vctx.clearRect(0, 0, vw, vh)

  const highs = candles.map((c) => c.h)
  const lows = candles.map((c) => c.l)
  const hi = Math.max(...highs)
  const lo = Math.min(...lows)
  const pad = (hi - lo) * 0.08 || hi * 0.02 || 1e-9
  const maxV = Math.max(...candles.map((c) => c.v), 1e-9)
  const n = candles.length
  const gap = 1
  const bw = Math.max(2, (pw - 8) / n - gap)

  pctx.strokeStyle = GRID
  pctx.lineWidth = 1
  for (let i = 1; i < 4; i++) {
    const y = (ph / 4) * i
    pctx.beginPath()
    pctx.moveTo(0, y)
    pctx.lineTo(pw, y)
    pctx.stroke()
  }

  const yOf = (px) => {
    const u = (px - (lo - pad)) / ((hi + pad) - (lo - pad))
    return ph - u * (ph - 8) - 4
  }

  candles.forEach((c, i) => {
    const x = 4 + i * (bw + gap)
    const up = c.c >= c.o
    const col = up ? UP : DOWN
    const y1 = yOf(c.h)
    const y2 = yOf(c.l)
    const yo = yOf(c.o)
    const yc = yOf(c.c)
    pctx.strokeStyle = col
    pctx.beginPath()
    pctx.moveTo(x + bw / 2, y1)
    pctx.lineTo(x + bw / 2, y2)
    pctx.stroke()
    const top = Math.min(yo, yc)
    const h = Math.max(1, Math.abs(yc - yo))
    pctx.fillStyle = col
    pctx.fillRect(x, top, bw, h)

    const vhgt = Math.max(1, (c.v / maxV) * (vh - 4))
    vctx.fillStyle = up ? 'rgba(107,222,204,.55)' : 'rgba(239,123,75,.55)'
    vctx.fillRect(x, vh - vhgt, bw, vhgt)
  })

  const last = candles[n - 1]
  const ly = yOf(last.c)
  pctx.strokeStyle = last.c >= last.o ? UP : DOWN
  pctx.setLineDash([4, 4])
  pctx.beginPath()
  pctx.moveTo(0, ly)
  pctx.lineTo(pw, ly)
  pctx.stroke()
  pctx.setLineDash([])
  pctx.fillStyle = AXIS
  pctx.font = '11px "IBM Plex Mono", Consolas, monospace'
  pctx.fillText(last.c.toPrecision(4), pw - 78, Math.max(12, ly - 4))

  const scan = ((t * 0.08) % 1) * pw
  pctx.fillStyle = 'rgba(239,123,75,.08)'
  pctx.fillRect(scan, 0, 18, ph)
}

export function sizeCanvas(cv) {
  const w = Math.max(1, cv.clientWidth)
  const h = Math.max(1, cv.clientHeight)
  if (cv.width !== w) cv.width = w
  if (cv.height !== h) cv.height = h
}
