import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Miniflare, convertV4MiniflareOptions} from 'miniflare';
let mf, db;
before(async () => {
  mf = new Miniflare(convertV4MiniflareOptions({modules: true, scriptPath: 'workers/reactions/index.js', compatibilityDate: '2026-07-01', d1Databases: ['DB']}));
  db = await mf.getD1Database('DB');
  const sql = await readFile('workers/reactions/migrations/0001_reactions.sql', 'utf8');
  // D1 exec handles complete SQL scripts through the underlying SQLite engine.
  for (const statement of sql.replace(/--[^\n]*/g, '').match(/\s*CREATE TRIGGER[\s\S]*?END;|[^;]+;/g)) {
    await db.prepare(statement).run();
  }
  await db.prepare("INSERT INTO reaction_articles (slug) VALUES ('why-children-study')").run();
  await db.prepare("INSERT INTO reaction_articles (slug) VALUES ('why-go-fishing')").run();
  await db.prepare("INSERT INTO reaction_articles (slug) VALUES ('does-humanity-need-to-work')").run();
  await db.prepare("INSERT INTO reaction_articles (slug) VALUES ('we-built-what-we-do-not-understand')").run();
  await db.prepare("INSERT INTO reaction_articles (slug) VALUES ('why-we-still-build')").run();
  await db.prepare("INSERT INTO reaction_articles (slug) VALUES ('why-we-need-each-other')").run();
  await db.prepare("INSERT INTO reaction_articles (slug) VALUES ('when-we-accept-the-world-we-made')").run();
  await db.prepare("INSERT INTO reaction_articles (slug) VALUES ('let-me-live-my-own-life')").run();
  await db.prepare("INSERT INTO reaction_articles (slug) VALUES ('still-we-live-tomorrow')").run();
  const filmMigration = await readFile('workers/reactions/migrations/0011_film_essay.sql', 'utf8');
  await db.prepare(filmMigration.replace(/--[^\n]*/g, '').trim()).run();
});
after(async () => { await mf?.dispose(); });
async function req({method = 'GET', cookie, ip = '192.0.2.1', origin = 'https://mino.co.kr', body, path = '/api/reactions?slug=why-we-work'} = {}) {
  return mf.dispatchFetch(`https://mino.co.kr${path}`, {method, headers: {
    'CF-Connecting-IP': ip, ...(origin ? {Origin: origin} : {}), ...(cookie ? {Cookie: cookie} : {}),
    ...(body !== undefined ? {'Content-Type': 'application/json'} : {}),
  }, ...(body !== undefined ? {body: typeof body === 'string' ? body : JSON.stringify(body)} : {})});
}
async function visitor(ip) {
  const response = await req({ip});
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const cookie = response.headers.get('Set-Cookie');
  assert.match(cookie, /HttpOnly; Secure; SameSite=Strict/);
  return cookie.split(';')[0];
}
test('concurrent duplicate likes count once, unlike is idempotent, independent browsers count separately', async () => {
  const cookie = await visitor('192.0.2.1');
  const responses = await Promise.all(Array.from({length: 8}, () => req({method:'PUT', cookie, body:{liked:true}})));
  for (const response of responses) { assert.equal(response.status, 200); assert.deepEqual(await response.json(), {count:1, liked:true}); }
  const second = await visitor('192.0.2.2');
  assert.deepEqual(await (await req({method:'PUT', cookie:second, ip:'192.0.2.2', body:{liked:true}})).json(), {count:2, liked:true});
  for (let i=0;i<2;i++) assert.deepEqual(await (await req({method:'PUT', cookie, body:{liked:false}})).json(), {count:1, liked:false});
  assert.deepEqual(await (await req({cookie:second})).json(), {count:1, liked:true});
});
test('education article has its own independent like count', async () => {
  const cookie = await visitor('192.0.2.70');
  const path = '/api/reactions?slug=why-children-study';
  assert.deepEqual(await (await req({cookie,path})).json(), {count:0,liked:false});
  assert.deepEqual(await (await req({method:'PUT',cookie,path,body:{liked:true}})).json(), {count:1,liked:true});
  assert.deepEqual(await (await req({cookie,path:'/api/reactions?slug=why-we-work'})).json(), {count:1,liked:false});
});
test('fishing essay reaction counts are independent from previous two articles', async () => {
  const cookie = await visitor('192.0.2.71');
  const path = '/api/reactions?slug=why-go-fishing';
  assert.deepEqual(await (await req({cookie,path})).json(), {count:0,liked:false});
  assert.deepEqual(await (await req({method:'PUT',cookie,path,body:{liked:true}})).json(), {count:1,liked:true});
  assert.deepEqual(await (await req({cookie,path:'/api/reactions?slug=why-children-study'})).json(), {count:1,liked:false});
  assert.deepEqual(await (await req({cookie,path:'/api/reactions?slug=why-we-work'})).json(), {count:1,liked:false});
});
test('new essay reaction counts are independent', async () => {
 const cookie = await visitor('192.0.2.72');
 const path = '/api/reactions?slug=does-humanity-need-to-work';
 assert.deepEqual(await (await req({cookie,path})).json(),{count:0,liked:false});
 assert.deepEqual(await (await req({method:'PUT',cookie,path,body:{liked:true}})).json(),{count:1,liked:true});
 assert.deepEqual(await (await req({cookie,path:'/api/reactions?slug=why-go-fishing'})).json(),{count:1,liked:false});
});
test('fifth essay reactions can be read, liked and unliked independently', async () => {
  const cookie = await visitor('192.0.2.73');
  const path = '/api/reactions?slug=we-built-what-we-do-not-understand';
  assert.deepEqual(await (await req({cookie,path})).json(), {count:0, liked:false});
  assert.deepEqual(await (await req({method:'PUT',cookie,path,body:{liked:true}})).json(), {count:1, liked:true});
  assert.deepEqual(await (await req({cookie,path:'/api/reactions?slug=does-humanity-need-to-work'})).json(), {count:1, liked:false});
  assert.deepEqual(await (await req({method:'PUT',cookie,path,body:{liked:false}})).json(), {count:0, liked:false});
});

test('sixth essay has independent, reversible reactions', async () => {
  const cookie = await visitor('192.0.2.74');
  const path = '/api/reactions?slug=why-we-still-build';
  assert.deepEqual(await (await req({cookie,path})).json(),{count:0,liked:false});
  assert.deepEqual(await (await req({method:'PUT',cookie,path,body:{liked:true}})).json(),{count:1,liked:true});
  assert.deepEqual(await (await req({method:'PUT',cookie,path,body:{liked:false}})).json(),{count:0,liked:false});
  const other = await req({cookie,path:'/api/reactions?slug=we-built-what-we-do-not-understand'});
  assert.equal((await other.json()).liked,false);
});
test('seventh essay has an independent, reversible reaction count', async () => {
  const cookie = await visitor('192.0.2.75');
  const path = '/api/reactions?slug=why-we-need-each-other';
  assert.deepEqual(await (await req({cookie,path})).json(),{count:0,liked:false});
  assert.deepEqual(await (await req({method:'PUT',cookie,path,body:{liked:true}})).json(),{count:1,liked:true});
  assert.deepEqual(await (await req({method:'PUT',cookie,path,body:{liked:false}})).json(),{count:0,liked:false});
});
test('new civilization essay reactions remain independent and reversible', async () => {
  const cookie = await visitor('192.0.2.76');
  const path = '/api/reactions?slug=when-we-accept-the-world-we-made';
  assert.deepEqual(await (await req({cookie,path})).json(),{count:0,liked:false});
  assert.deepEqual(await (await req({method:'PUT',cookie,path,body:{liked:true}})).json(),{count:1,liked:true});
  assert.deepEqual(await (await req({method:'PUT',cookie,path,body:{liked:false}})).json(),{count:0,liked:false});
});
test('ninth essay supports independent reversible reactions', async () => {
  const cookie = await visitor('192.0.2.77');
  const path = '/api/reactions?slug=let-me-live-my-own-life';
  assert.deepEqual(await (await req({cookie,path})).json(),{count:0,liked:false});
  assert.deepEqual(await (await req({method:'PUT',cookie,path,body:{liked:true}})).json(),{count:1,liked:true});
  assert.deepEqual(await (await req({method:'PUT',cookie,path,body:{liked:false}})).json(),{count:0,liked:false});
});
test('tenth essay reaction state is independent and reversible', async () => {
  const cookie = await visitor('192.0.2.78');
  const path = '/api/reactions?slug=still-we-live-tomorrow';
  assert.deepEqual(await (await req({cookie,path})).json(),{count:0,liked:false});
  assert.deepEqual(await (await req({method:'PUT',cookie,path,body:{liked:true}})).json(),{count:1,liked:true});
  assert.deepEqual(await (await req({method:'PUT',cookie,path,body:{liked:false}})).json(),{count:0,liked:false});
});
test('film essay migration preserves previous reactions and supports reversible independent likes', async () => {
  const cookie = await visitor('192.0.2.79');
  const path = '/api/reactions?slug=the-future-we-already-quoted';
  const previous = await (await req({cookie})).json();
  assert.deepEqual(await (await req({cookie,path})).json(), {count:0,liked:false});
  assert.deepEqual(await (await req({method:'PUT',cookie,path,body:{liked:true}})).json(), {count:1,liked:true});
  const sql = await readFile('workers/reactions/migrations/0011_film_essay.sql', 'utf8');
  await db.prepare(sql.replace(/--[^\n]*/g, '').trim()).run();
  assert.deepEqual(await (await req({cookie,path})).json(), {count:1,liked:true});
  assert.deepEqual(await (await req({method:'PUT',cookie,path,body:{liked:false}})).json(), {count:0,liked:false});
  assert.deepEqual(await (await req({cookie})).json(), previous);
});
test('rejects foreign origins, missing or forged cookies, invalid JSON and unknown articles', async () => {
  const cookie = await visitor('192.0.2.3');
  for (const origin of ['https://evil.example', null]) assert.equal((await req({method:'PUT', cookie, origin, body:{liked:true}})).status, 403);
  for (const bad of [undefined, '__Host-mino_reaction='+'a'.repeat(32)+'.'+'0'.repeat(64)]) {
    assert.equal((await req({method:'PUT', cookie:bad, body:{liked:true}})).status, 401);
  }
  for (const body of ['{', {liked:'true'}, {liked:true, count:999}, 'x'.repeat(257)]) {
    assert.equal((await req({method:'PUT', cookie, body})).status, 400);
  }
  assert.equal((await req({path:'/api/reactions?slug=unknown'})).status, 404);
  assert.equal((await req({method:'POST'})).status, 405);
});
test('IP write limit survives cookie rotation and concurrent requests', async () => {
  const ip = '192.0.2.10';
  const cookie = await visitor(ip);
  const results = await Promise.all(Array.from({length:35}, () => req({method:'PUT', ip, cookie, body:{liked:true}})));
  assert.equal(results.filter(r=>r.status===200).length, 30);
  assert.equal(results.filter(r=>r.status===429).length, 5);
  const rotated = await visitor(ip);
  const limited = await req({method:'PUT', ip, cookie:rotated, body:{liked:true}});
  assert.equal(limited.status,429);
  assert.equal(limited.headers.get('Retry-After'),'60');
});
test('read requests are limited before unlimited database work', async () => {
  const ip = '192.0.2.20';
  for (let i=0;i<120;i++) assert.equal((await req({ip})).status,200);
  assert.equal((await req({ip})).status,429);
});
test('daily write quota rejects writes and expired counters are cleaned without deleting likes', async () => {
  const ip = '192.0.2.30';
  const cookie = await visitor(ip);
  assert.equal((await req({method:'PUT', ip, cookie, body:{liked:true}})).status,200);
  const {signing_key} = await db.prepare('SELECT signing_key FROM reaction_config WHERE id = 1').first();
  const {createHmac} = await import('node:crypto');
  const day = Math.floor(Date.now()/86400000);
  const hashed = createHmac('sha256',signing_key).update(`rate:${day}:${ip}`).digest('hex');
  await db.prepare('UPDATE reaction_limits SET requests = 200 WHERE key = ?').bind(`daily:${hashed}:${day}`).run();
  assert.equal((await req({method:'PUT', ip, cookie, body:{liked:false}})).status,429);
  await db.prepare('INSERT INTO reaction_limits VALUES (?, ?, ?)').bind('expired-test',1,1).run();
  const worker = (await import('../workers/reactions/index.js')).default;
  await worker.scheduled({}, {DB:db});
  assert.equal(await db.prepare('SELECT * FROM reaction_limits WHERE key = ?').bind('expired-test').first(),null);
  assert.equal((await (await req({ip,cookie})).json()).liked,true);
});
test('database failures return a generic error without internal details', async () => {
  const worker = (await import('../workers/reactions/index.js')).default;
  const response = await worker.fetch(new Request('https://mino.co.kr/api/reactions?slug=why-we-work', {
    headers:{'CF-Connecting-IP':'192.0.2.50'},
  }), {DB:{prepare(){throw new Error('sensitive database details')}}});
  assert.equal(response.status,503);
  assert.deepEqual(await response.json(),{error:'unavailable'});
});
