import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const baseline = JSON.parse(readFileSync('tests/reading-baseline.json', 'utf8'));
const manifest = JSON.parse(readFileSync('src/data/essay-illustrations.json', 'utf8'));
const hash = value => createHash('sha256').update(value).digest('hex');
const removeFigures = value => value.replace(/<!-- essay-illustration:.*?<!-- \/essay-illustration -->/gs, '');
const text = value => value.replace(/<script\b[^>]*>.*?<\/script>|<style\b[^>]*>.*?<\/style>/gs, '')
  .replace(/<a\b[^>]*class="(?:skip|skip-link)"[^>]*>.*?<\/a>/gs, '')
  .replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const attr = (tag, name) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
const decode = value => value?.replace(/&(?:amp|lt|gt|quot|apos|#39|#x27);/g, entity=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&#39;':"'",'&#x27;':"'"}[entity]));
for (const [slug, before] of Object.entries(baseline)) {
  test(`${slug}: original prose, metadata-derived text and left table of contents are preserved`, () => {
    const html = readFileSync(before.html, 'utf8');
    const md = readFileSync(before.markdown, 'utf8').replace(/\n\n<!-- essay-illustration:.*?<!-- \/essay-illustration -->/gs, '');
    assert.equal(hash(md), before.markdownSha256, 'Authored Markdown must not change');
    assert.equal(hash(text(removeFigures(html))), before.visibleTextSha256, 'Existing rendered text must not change');
    const toc = html.match(/<nav class="toc"[^>]*>(.*?)<\/nav>/s)?.[1];
    assert.equal(toc, before.toc, 'Keep every original TOC entry and target, in order');
    const ids = [...html.matchAll(/\bid="([^"]*)"/g)].map(x=>x[1]);
    for (const id of before.ids) assert.ok(ids.includes(id), `Original anchor removed: ${id}`);
    const links = [...html.matchAll(/<a\b[^>]*>/g)].filter(([tag])=>!['skip','skip-link'].includes(attr(tag,'class'))).map(([tag])=>decode(attr(tag,'href'))||'');
    assert.deepEqual(links, before.links, 'Existing links and controls must be preserved');
    const metadata = Object.fromEntries([...html.matchAll(/<meta\b[^>]*>/g)].map(([tag])=>[attr(tag,'name')||attr(tag,'property'),decode(attr(tag,'content'))]));
    for (const [key,value] of Object.entries(before.metadata)) assert.equal(metadata[key],value, `Existing metadata changed: ${key}`);
    assert.equal(hash((html.match(/<script(?![^>]*application\/ld\+json)\b[^>]*>.*?<\/script>/gs)||[]).join('')), before.scriptsSha256, 'Existing behavior scripts must be preserved');
    assert.equal(ids.length, new Set(ids).size, 'IDs must be unique');
    for (const link of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(link[1]), `Missing target: ${link[1]}`);
    assert.equal((html.match(/<main\b/g)||[]).length, 1);
    assert.match(html, /<main id="article" tabindex="-1">/);
    assert.match(html, /href="#article"/);
    assert.match(html, /href="\/reading.css"/);
    assert.doesNotMatch(html, /cloudflareinsights\.com/, 'Only edge-injected analytics');
  });
  test(`${slug}: discoverable, responsive illustrations have valid metadata and local files`, () => {
    const html = readFileSync(before.html, 'utf8');
    const config = manifest.posts[slug];
    assert.equal((html.match(/<!-- essay-illustration:/g)||[]).length, 1 + config.vignettes.length);
    for (const [tag] of html.matchAll(/<img\b[^>]*>/g)) {
      assert.ok(attr(tag, 'alt')?.trim(), 'Meaningful image alternatives');
      assert.ok(Number(attr(tag,'width'))>0 && Number(attr(tag,'height'))>0, 'Reserve image layout space');
      const src = attr(tag,'src');
      if (src.startsWith('/')) assert.ok(existsSync(`public${src}`), src);
    }
    const ld = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
    const cover = manifest.assets[config.cover];
    assert.equal(ld.image.url, `https://mino.co.kr${cover.social}`);
    assert.equal(ld.image.width, cover.width);
    assert.ok(existsSync(`public${cover.social}`));
    assert.match(html, /property="og:image"/);
    assert.match(html, /name="twitter:card" content="summary_large_image"/);
  });
}
