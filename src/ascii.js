const RAMP = ' .:-+=*#%@&$YJPG7BS'

function ellipse(u, v, cx, cy, rx, ry) {
  const dx = (u - cx) / rx
  const dy = (v - cy) / ry
  const d = dx * dx + dy * dy
  if (d > 1.18) return 0
  return Math.max(0, 1 - d)
}

function capsule(u, v, x0, y0, x1, y1, r) {
  const dx = x1 - x0
  const dy = y1 - y0
  const len2 = dx * dx + dy * dy || 1
  let t = ((u - x0) * dx + (v - y0) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  const px = x0 + t * dx
  const py = y0 + t * dy
  const dist = Math.hypot(u - px, v - py)
  if (dist > r * 1.22) return 0
  return Math.max(0, 1 - dist / r)
}

function cicada(u, v, t, heat) {
  const sing = 0.5 + 0.5 * Math.sin(t * 17)
  const buzz = Math.sin(t * 22) * (0.01 + heat * 0.018)
  const lift = Math.sin(t * 1.3) * 0.01
  let d = 0
  d = Math.max(d, ellipse(u, v, 0.50, 0.14 + lift, 0.075, 0.055))
  d = Math.max(d, ellipse(u, v, 0.43, 0.135 + lift, 0.04, 0.038) * 1.3)
  d = Math.max(d, ellipse(u, v, 0.57, 0.135 + lift, 0.04, 0.038) * 1.3)
  d = Math.max(d, capsule(u, v, 0.47, 0.09 + lift, 0.41, 0.01, 0.01))
  d = Math.max(d, capsule(u, v, 0.53, 0.09 + lift, 0.59, 0.01, 0.01))
  d = Math.max(d, ellipse(u, v, 0.50, 0.26 + lift, 0.10, 0.07))
  d = Math.max(d, ellipse(u, v, 0.30 + buzz, 0.40 + lift, 0.16 + sing * 0.02, 0.28) * 0.55)
  d = Math.max(d, ellipse(u, v, 0.70 - buzz, 0.40 + lift, 0.16 + sing * 0.02, 0.28) * 0.55)
  d = Math.max(d, capsule(u, v, 0.42, 0.24 + lift, 0.22 + buzz, 0.62, 0.016))
  d = Math.max(d, capsule(u, v, 0.58, 0.24 + lift, 0.78 - buzz, 0.62, 0.016))
  for (let i = 0; i < 7; i++) {
    d = Math.max(d, ellipse(u, v, 0.50, 0.40 + i * 0.075 + lift, 0.078 - i * 0.007, 0.04))
  }
  d = Math.max(d, capsule(u, v, 0.45, 0.28 + lift, 0.30, 0.78, 0.01))
  d = Math.max(d, capsule(u, v, 0.55, 0.28 + lift, 0.70, 0.78, 0.01))
  d = Math.max(d, capsule(u, v, 0.47, 0.30 + lift, 0.36, 0.86, 0.009))
  d = Math.max(d, capsule(u, v, 0.53, 0.30 + lift, 0.64, 0.86, 0.009))
  d = Math.max(d, capsule(u, v, 0.48, 0.32 + lift, 0.43, 0.92, 0.008))
  d = Math.max(d, capsule(u, v, 0.52, 0.32 + lift, 0.57, 0.92, 0.008))
  return Math.min(1, d)
}

function glyph(density, heat, u, v, t) {
  if (density < 0.045) {
    const dust = Math.sin(u * 90 + t * 4) * Math.cos(v * 40 - t)
    if (heat > 0.5 && dust > 0.93) return '.`'[Math.floor((u * 9 + t) % 2)]
    return ' '
  }
  const n = Math.sin(u * 41 + v * 29 + t * 1.4) * 0.5 + 0.5
  const h = Math.min(1, density * 0.7 + heat * 0.4 + n * 0.1)
  const idx = Math.min(RAMP.length - 1, Math.floor(h * (RAMP.length - 1)))
  let ch = RAMP[idx]
  if (density > 0.62 && n > 0.8) ch = '#&$'[Math.floor(Math.abs(u + v + t) * 17) % 3]
  if (density > 0.75 && n < 0.18) ch = '7'
  if (heat > 0.7 && n > 0.93) ch = '@'
  return ch
}

export function renderAscii(cols, rows, heat, t, hatch = 1) {
  const emerge = Math.max(0, Math.min(1, hatch))
  const lines = []
  for (let y = 0; y < rows; y++) {
    let line = ''
    const v = y / (rows - 1)
    for (let x = 0; x < cols; x++) {
      const u = x / (cols - 1)
      let d = cicada(u, v, t, heat)
      if (v < 1 - emerge) d = 0
      else d *= Math.min(1, (v - (1 - emerge)) * 8)
      line += glyph(d, heat, u, v, t)
    }
    lines.push(line)
  }
  return lines.join('\n')
}

export function fitGrid(width, height) {
  const cols = Math.max(36, Math.min(110, Math.floor(width / 5.05)))
  const rows = Math.max(28, Math.min(78, Math.floor(height / 8)))
  return { cols, rows }
}
