const TEAL = { r: 110, g: 231, b: 212 }

let img = null
let loading = null
const off = document.createElement('canvas')
const offCtx = off.getContext('2d', { willReadFrequently: true })

export function loadCicada() {
  if (img && img.complete && img.naturalWidth) return Promise.resolve(img)
  if (loading) return loading
  loading = new Promise((resolve) => {
    const el = new Image()
    el.onload = () => {
      img = el
      resolve(el)
    }
    el.onerror = () => resolve(null)
    el.src = './cicada.png'
  })
  return loading
}

export function paintDottedCicada(canvas, t = 0, { gap = 3.4, glow = true } = {}) {
  if (!canvas || !img || !img.naturalWidth) return
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const cssW = canvas.clientWidth || canvas.width
  const cssH = canvas.clientHeight || canvas.height
  if (!cssW || !cssH) return
  const w = Math.max(1, Math.floor(cssW * dpr))
  const h = Math.max(1, Math.floor(cssH * dpr))
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  }
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, w, h)

  const ir = img.naturalWidth / img.naturalHeight
  const cr = w / h
  let dw, dh, dx, dy
  if (ir > cr) {
    dw = w
    dh = w / ir
    dx = 0
    dy = (h - dh) / 2
  } else {
    dh = h
    dw = h * ir
    dx = (w - dw) / 2
    dy = 0
  }

  const sampleW = Math.max(8, Math.floor(dw / (gap * dpr)))
  const sampleH = Math.max(8, Math.floor(dh / (gap * dpr)))
  off.width = sampleW
  off.height = sampleH
  offCtx.clearRect(0, 0, sampleW, sampleH)
  offCtx.drawImage(img, 0, 0, sampleW, sampleH)
  const data = offCtx.getImageData(0, 0, sampleW, sampleH).data
  const pulse = 0.92 + 0.08 * Math.sin(t * 2.1)

  for (let y = 0; y < sampleH; y++) {
    for (let x = 0; x < sampleW; x++) {
      const i = (y * sampleW + x) * 4
      const a = data[i + 3] / 255
      const lum = (data[i] * 0.2 + data[i + 1] * 0.55 + data[i + 2] * 0.25) / 255
      const v = lum * a
      if (v < 0.07) continue
      const px = dx + (x + 0.5) / sampleW * dw
      const py = dy + (y + 0.5) / sampleH * dh
      const rad = (0.55 + v * 1.35) * gap * dpr * 0.38 * pulse
      ctx.beginPath()
      ctx.arc(px, py, rad, 0, Math.PI * 2)
      const alpha = Math.min(1, 0.25 + v * 0.9)
      ctx.fillStyle = `rgba(${TEAL.r},${TEAL.g},${TEAL.b},${alpha})`
      ctx.fill()
    }
  }
  if (glow) {
    ctx.globalCompositeOperation = 'screen'
    ctx.fillStyle = 'rgba(94,234,212,0.06)'
    ctx.fillRect(dx, dy, dw, dh)
    ctx.globalCompositeOperation = 'source-over'
  }
}
