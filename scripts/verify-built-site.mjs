import {readFileSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const md = readFileSync('books/vol1/manuscript.md','utf8');
assert.equal(createHash('sha256').update(md).digest('hex'),'13e03c3edfc804dff7f7e45eb4d4836140cc22fd99d5efbc3d96f8b9f3e65fc5', 'Use the approved final manuscript unchanged');
const html = readFileSync('dist/books/vol1/index.html','utf8');
const article = html.match(/<article id="book-text"[^>]*>(.*?)<\/article>/s)?.[1];
assert.ok(article,'Full book must be in server-rendered HTML');
const plain = text => text.replace(/&#x([a-f\d]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)))
 .replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)))
 .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/\s+/g,'');
const rendered = plain(article.replace(/<[^>]*>/g,''));
const expected = md.slice(md.indexOf('# 프롤로그')).split(/\n\s*\n/).map(x=>x.trim())
 .filter(x=>x && x!=='---' && !x.startsWith('!['))
 .map(x=>plain(x.replace(/^#+ /,'').replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').replace(/\*/g,'').replace(/^- /,'')));
assert.equal(expected.length,748,'Verify every final print-manuscript block');
let cursor=0;
for (const block of expected) {
 const at = rendered.indexOf(block,cursor);
 assert.ok(at>=0,`Missing or reordered book text: ${block.slice(0,70)}`);
 cursor=at+block.length;
}
assert.equal((article.match(/<img\b/g)||[]).length,16);
assert.equal((article.match(/data-book-section/g)||[]).length,18);
assert.equal((article.match(/<h1\b/g)||[]).length,1);
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(ids).size,ids.length,'Unique book anchors');
for(const [,id] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(id),`Missing book TOC destination: ${id}`);
for(const [img] of article.matchAll(/<img\b[^>]*>/g)) {
 assert.match(img,/width="\d+"/);assert.match(img,/height="\d+"/);
 const src=img.match(/src="([^"]+)"/)[1];
 assert.ok(existsSync(`dist${src}`));
}
const sitemap=readFileSync('dist/sitemap.xml','utf8');
assert.ok(sitemap.includes('https://mino.co.kr/books/vol1/'));
assert.ok(sitemap.includes('https://mino.co.kr/writing/why-we-work/'));
assert.ok(!sitemap.includes('https://mino.co.kr/essays/'));
const home=readFileSync('dist/index.html','utf8');
assert.ok(home.includes('/books/vol1/?mode=ebook'));
assert.ok(!home.includes('/essays/why-we-work/'));
console.log(`Built site verified: ${expected.length} final book blocks, 16 images, 18 reading sections, all TOC targets and migrated sitemap.`);
