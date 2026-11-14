const ORIGIN = 'https://mino.co.kr';
const COOKIE = '__Host-mino_reaction';
const encoder = new TextEncoder();
const hex = bytes => [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
const unhex = value => Uint8Array.from(value.match(/../g), byte => parseInt(byte, 16));

function json(body, status = 200, headers = {}) {
  return Response.json(body, { status, headers: {
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers,
  } });
}
async function hmac(key, value) {
  return hex(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
}
async function identity(request, key) {
  const value = request.headers.get('Cookie')?.split(';').map(x => x.trim())
    .find(x => x.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!value || !/^[a-f0-9]{32}\.[a-f0-9]{64}$/.test(value)) return null;
  const [id, signature] = value.split('.');
  return await crypto.subtle.verify('HMAC', key, unhex(signature), encoder.encode(`visitor:${id}`)) ? id : null;
}
async function limit(db, key, seconds, maximum) {
  const now = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(now / seconds);
  const result = await db.prepare(`INSERT INTO reaction_limits (key, expires, requests) VALUES (?, ?, 1)
    ON CONFLICT(key) DO UPDATE SET requests = requests + 1 WHERE requests < ?
    RETURNING requests`).bind(`${key}:${bucket}`, (bucket + 1) * seconds, maximum).first();
  return !!result;
}
async function readBody(request) {
  if (!request.headers.get('Content-Type')?.match(/^application\/json(?:\s*;|$)/i)) return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  let size = 0;
  const chunks = [];
  while (true) {
    const {done, value} = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 256) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  try { return JSON.parse(await new Blob(chunks).text()); } catch { return null; }
}
async function handle(request, env) {
  const url = new URL(request.url);
  const slug = url.searchParams.get('slug');
  if (url.pathname !== '/api/reactions' || !['why-we-work', 'why-children-study'].includes(slug)) {
    return json({error: 'not_found'}, 404);
  }
  if (!['GET', 'PUT'].includes(request.method)) return json({error: 'method_not_allowed'}, 405, {Allow: 'GET, PUT'});
  const origin = request.headers.get('Origin');
  if ((origin && origin !== ORIGIN) || request.headers.get('Sec-Fetch-Site') === 'cross-site' ||
      (request.method === 'PUT' && origin !== ORIGIN)) return json({error: 'forbidden'}, 403);
  // Cloudflare supplies this header at the edge; never trust X-Forwarded-For.
  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip) return json({error: 'unavailable'}, 503);
  const db = env.DB;
  const config = await db.prepare('SELECT signing_key FROM reaction_config WHERE id = 1').first();
  const key = await crypto.subtle.importKey('raw', encoder.encode(config.signing_key),
    {name: 'HMAC', hash: 'SHA-256'}, false, ['sign', 'verify']);
  // Daily pseudonyms prevent long-lived storage of IP-derived identifiers.
  const day = Math.floor(Date.now() / 86400000);
  const ipKey = await hmac(key, `rate:${day}:${ip}`);
  if (!await limit(db, `all:${ipKey}`, 60, 120)) return json({error: 'rate_limited'}, 429, {'Retry-After': '60'});
  let visitor = await identity(request, key);
  const headers = {};
  if (request.method === 'PUT') {
    if (!visitor) return json({error: 'cookie_required'}, 401);
    const body = await readBody(request);
    if (!body || typeof body.liked !== 'boolean' || Object.keys(body).length !== 1) return json({error: 'invalid_body'}, 400);
    if (!await limit(db, `write:${ipKey}`, 60, 30) || !await limit(db, `daily:${ipKey}`, 86400, 200)) {
      return json({error: 'rate_limited'}, 429, {'Retry-After': '60'});
    }
    const mutation = body.liked
      ? db.prepare('INSERT INTO reactions (slug, visitor) VALUES (?, ?) ON CONFLICT DO NOTHING')
      : db.prepare('DELETE FROM reactions WHERE slug = ? AND visitor = ?');
    const results = await db.batch([
      mutation.bind(slug, visitor),
      db.prepare(`SELECT likes AS count, EXISTS(SELECT 1 FROM reactions WHERE slug = ? AND visitor = ?) AS liked
        FROM reaction_articles WHERE slug = ?`).bind(slug, visitor, slug),
    ]);
    const state = results[1].results[0];
    return json({count: state.count, liked: !!state.liked});
  }
  if (!visitor) {
    visitor = hex(crypto.getRandomValues(new Uint8Array(16)));
    const signature = await hmac(key, `visitor:${visitor}`);
    headers['Set-Cookie'] = `${COOKIE}=${visitor}.${signature}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=31536000`;
  }
  const state = await db.prepare(`SELECT likes AS count, EXISTS(SELECT 1 FROM reactions WHERE slug = ? AND visitor = ?) AS liked
    FROM reaction_articles WHERE slug = ?`).bind(slug, visitor, slug).first();
  return json({count: state.count, liked: !!state.liked}, 200, headers);
}
export default {
  async fetch(request, env) {
    try { return await handle(request, env); }
    catch { return json({error: 'unavailable'}, 503); }
  },
  async scheduled(_event, env) {
    await env.DB.prepare('DELETE FROM reaction_limits WHERE expires < ?')
      .bind(Math.floor(Date.now() / 1000)).run();
  },
};
