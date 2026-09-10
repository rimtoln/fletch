import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const gitDir = path.join(root, '.git')

function ignored(rel) {
  const n = rel.replace(/\\/g, '/')
  if (n === '.git' || n.startsWith('.git/')) return true
  if (n === '.tools' || n.startsWith('.tools/')) return true
  if (n === 'node_modules' || n.startsWith('node_modules/')) return true
  if (n === 'dist' || n.startsWith('dist/')) return true
  if (n === '.vite' || n.startsWith('.vite/')) return true
  if (n.endsWith('.log')) return true
  if (n === '.env' || n.startsWith('.env.') && n !== '.env.example') return true
  return false
}

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name)
    const rel = path.relative(root, abs)
    if (ignored(rel)) continue
    const st = fs.statSync(abs)
    if (st.isDirectory()) walk(abs, out)
    else out.push(rel)
  }
  return out
}

function store(type, content) {
  const header = Buffer.from(type + ' ' + content.length + '\0')
  const packed = Buffer.concat([header, content])
  const sha = crypto.createHash('sha1').update(packed).digest('hex')
  const dir = path.join(gitDir, 'objects', sha.slice(0, 2))
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, sha.slice(2))
  if (!fs.existsSync(file)) fs.writeFileSync(file, zlib.deflateSync(packed))
  return sha
}

function treeFrom(files) {
  const rootNode = { files: {}, dirs: {} }
  for (const rel of files) {
    const parts = rel.replace(/\\/g, '/').split('/')
    let node = rootNode
    for (let i = 0; i < parts.length - 1; i++) {
      node.dirs[parts[i]] ||= { files: {}, dirs: {} }
      node = node.dirs[parts[i]]
    }
    node.files[parts[parts.length - 1]] = rel
  }

  function writeNode(node) {
    const entries = []
    for (const [name, child] of Object.entries(node.dirs).sort()) {
      entries.push({ mode: '40000', name, sha: writeNode(child) })
    }
    for (const [name, rel] of Object.entries(node.files).sort()) {
      const blob = fs.readFileSync(path.join(root, rel))
      entries.push({ mode: '100644', name, sha: store('blob', blob) })
    }
    const chunks = []
    for (const e of entries) {
      chunks.push(Buffer.from(e.mode + ' ' + e.name + '\0'))
      chunks.push(Buffer.from(e.sha, 'hex'))
    }
    return store('tree', Buffer.concat(chunks))
  }

  return writeNode(rootNode)
}

if (fs.existsSync(path.join(gitDir, 'HEAD'))) {
  const files = walk(root).sort()
  const tree = treeFrom(files)
  const parent = fs.readFileSync(path.join(gitDir, 'refs', 'heads', 'main'), 'utf8').trim()
  const ts = Math.floor(Date.now() / 1000)
  const ident = 'REZTOKIA <reztokia@local>'
  const message = process.argv[2] || 'Update cockpit\n'
  const commitBody = Buffer.from(
    `tree ${tree}\nparent ${parent}\nauthor ${ident} ${ts} +0000\ncommitter ${ident} ${ts} +0000\n\n${message.endsWith('\n') ? message : message + '\n'}`,
  )
  const commit = store('commit', commitBody)
  fs.writeFileSync(path.join(gitDir, 'refs', 'heads', 'main'), commit + '\n')
  console.log('created commit', commit)
  process.exit(0)
}

const files = walk(root).sort()
if (!files.length) {
  console.error('no files to commit')
  process.exit(1)
}

fs.mkdirSync(path.join(gitDir, 'refs', 'heads'), { recursive: true })
fs.mkdirSync(path.join(gitDir, 'objects'), { recursive: true })
fs.writeFileSync(path.join(gitDir, 'HEAD'), 'ref: refs/heads/main\n')
fs.writeFileSync(
  path.join(gitDir, 'config'),
  '[core]\n\trepositoryformatversion = 0\n\tfilemode = false\n\tbare = false\n\tlogallrefupdates = true\n\tsymlinks = false\n\tignorecase = true\n',
)
fs.writeFileSync(path.join(gitDir, 'description'), 'REZTOKIA ASCII cockpit\n')

const tree = treeFrom(files)
const ts = Math.floor(Date.now() / 1000)
const ident = 'REZTOKIA <reztokia@local>'
const message = 'Initial commit: ASCII cockpit for Robinhood Chain\n'
const commitBody = Buffer.from(
  `tree ${tree}\nauthor ${ident} ${ts} +0000\ncommitter ${ident} ${ts} +0000\n\n${message}`,
)
const commit = store('commit', commitBody)
fs.writeFileSync(path.join(gitDir, 'refs', 'heads', 'main'), commit + '\n')
console.log('created commit', commit)
console.log('files', files.length)
