const HOT_WORDS = /\b(launch|live|stealth|ca\b|contract|now|just|100x|moon|send it|aped|bonding|migrated)\b/i
const RISK_WORDS = /\b(rug|scam|dump|sold|honeypot|dev dump|exit)\b/i

export function extractHandle(url) {
  if (!url) return ''
  const m = String(url).match(/(?:x\.com|twitter\.com)\/@?([A-Za-z0-9_]{1,15})/i)
  return m ? m[1] : ''
}

async function getJson(urls) {
  let last
  for (const u of urls) {
    try {
      const res = await fetch(u)
      if (!res.ok) {
        last = new Error('tw ' + res.status)
        continue
      }
      const ct = res.headers.get('content-type') || ''
      if (ct.includes('json')) return await res.json()
      const text = await res.text()
      return { text }
    } catch (err) {
      last = err
    }
  }
  throw last || new Error('twitter miss')
}

function scoreTweets(tweets, user) {
  const texts = tweets.map((t) => t.text || t.full_text || '').filter(Boolean)
  let heat = 0
  let risk = 0
  for (const text of texts) {
    if (HOT_WORDS.test(text)) heat += 18
    if (RISK_WORDS.test(text)) risk += 22
  }
  const followers = Number(user.followers || user.followers_count || 0)
  if (followers > 10000) heat += 8
  if (followers < 80 && texts.length) risk += 10
  const cadence = tweets.filter((t) => {
    const ts = Date.parse(t.created_at || t.date || 0)
    return Date.now() - ts < 86400000
  }).length
  if (cadence >= 4) heat += 12
  return {
    heat: Math.min(100, heat + cadence * 4),
    risk: Math.min(100, risk),
    cadence,
    followers,
    bio: user.description || user.bio || '',
    name: user.name || user.screen_name || '',
    handle: user.screen_name || user.username || '',
    tweets: texts.slice(0, 6),
  }
}

export async function pullTwitter(handle) {
  if (!handle) throw new Error('no handle')
  const h = handle.replace(/^@/, '')
  try {
    const json = await getJson([
      'https://api.fxtwitter.com/' + h,
      '/fx-proxy/' + h,
    ])
    const user = json.user || (json.data && json.data.user) || json
    const tweets = json.tweets || json.latest_tweets || (json.data && json.data.tweets) || []
    const list = Array.isArray(tweets) ? tweets : []
    if (user && (user.screen_name || user.username || list.length)) {
      return scoreTweets(list, { ...user, screen_name: user.screen_name || user.username || h })
    }
  } catch {
    /* jina fallback */
  }
  const md = await getJson([
    'https://r.jina.ai/https://x.com/' + h,
    '/jina-proxy/https://x.com/' + h,
  ])
  const text = md.text || ''
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 24).slice(0, 8)
  const fakeTweets = lines.map((l) => ({ text: l, created_at: new Date().toISOString() }))
  return scoreTweets(fakeTweets, { screen_name: h, name: h, description: lines[0] || '', followers: 0 })
}
