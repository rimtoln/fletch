import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
}

const PROXIES = [
  { prefix: '/rpc-proxy', target: 'https://rpc.mainnet.chain.robinhood.com', strip: true },
  { prefix: '/bs-proxy', target: 'https://robinhoodchain.blockscout.com', strip: false },
  { prefix: '/hx-proxy', target: 'https://hoodexplorer.org', strip: false },
  { prefix: '/dex-proxy', target: 'https://api.dexscreener.com', strip: false },
  { prefix: '/gt-proxy', target: 'https://api.geckoterminal.com', strip: false },
  { prefix: '/fx-proxy', target: 'https://api.fxtwitter.com', strip: false },
  { prefix: '/jina-proxy', target: 'https://r.jina.ai', strip: false },
]

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

const cache = new Map()

function ttlFor(dest) {
  if (/new_pools/.test(dest)) return 2000
  if (/trending_pools/.test(dest)) return 4000
  if (/dexscreener/.test(dest) && /\/tokens\//.test(dest)) return 2000
  if (/geckoterminal|dexscreener/.test(dest)) return 8000
  return 20000
}

async function proxyTo(req, res, spec) {
  const incoming = new URL(req.url, 'http://127.0.0.1')
  let destPath = incoming.pathname
  if (spec.strip) destPath = '/'
  else destPath = destPath.replace(spec.prefix, '') || '/'
  const dest = spec.target.replace(/\/$/, '') + destPath + incoming.search
  const cacheKey = (req.method || 'GET') + ' ' + dest
  if (req.method === 'GET') {
    const hit = cache.get(cacheKey)
    const ttl = ttlFor(dest)
    if (hit && Date.now() - hit.at < ttl) {
      res.writeHead(hit.status, hit.out)
      res.end(hit.buf)
      return
    }
  }
  const headers = {
    accept: req.headers.accept || '*/*',
    'user-agent': 'Mozilla/5.0 FLETCH/0.1',
  }
  if (req.headers['content-type']) headers['content-type'] = req.headers['content-type']
  const init = { method: req.method, headers }
  if (req.method !== 'GET' && req.method !== 'HEAD') init.body = await readBody(req)
  const r = await fetch(dest, init)
  const buf = Buffer.from(await r.arrayBuffer())
  const out = {
    'access-control-allow-origin': '*',
    'content-type': r.headers.get('content-type') || 'application/octet-stream',
  }
  if (r.status === 429 && req.method === 'GET') {
    const hit = cache.get(cacheKey)
    if (hit && hit.status === 200) {
      hit.stale = true
      res.writeHead(hit.status, hit.out)
      res.end(hit.buf)
      return
    }
  }
  if (req.method === 'GET' && r.status === 200) {
    cache.set(cacheKey, { at: Date.now(), status: r.status, out, buf, stale: false })
  }
  res.writeHead(r.status, out)
  res.end(buf)
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': 'content-type',
        'access-control-allow-methods': 'GET,POST,OPTIONS',
      })
      res.end()
      return
    }
    const spec = PROXIES.find((p) => (req.url || '').startsWith(p.prefix))
    if (spec) {
      await proxyTo(req, res, spec)
      return
    }
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0])
    const rel = (urlPath === '/' ? 'index.html' : urlPath).replace(/^\/+/, '').replace(/\//g, path.sep)
    const file = path.resolve(root, rel)
    const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep
    if (file !== root && !file.startsWith(rootWithSep)) {
      res.writeHead(403)
      res.end('forbidden')
      return
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404)
        res.end('not found')
        return
      }
      res.writeHead(200, {
        'content-type': MIME[path.extname(file)] || 'application/octet-stream',
        'cache-control': 'no-store',
      })
      res.end(data)
    })
  } catch (err) {
    res.writeHead(502)
    res.end(String(err.message || err))
  }
})

const port = Number(process.env.PORT || 5173)
server.listen(port, '127.0.0.1', () => {
  console.log('FLETCH http://127.0.0.1:' + port)
})
