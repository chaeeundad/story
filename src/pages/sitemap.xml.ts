import {getCollection} from 'astro:content';
import illustrations from '../data/essay-illustrations.json';
const escapeXml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
export async function GET(){
const posts=await getCollection('blog',({data})=>!data.draft);
const art = illustrations as {posts: Record<string, {cover: string; vignettes: {asset: string}[]}>; assets: Record<string, {src: string}>};
const urls: {loc: string; lastmod?: string; images?: string[]}[]=[
 {loc:'https://mino.co.kr/'},
 {loc:'https://mino.co.kr/about/'},
 {loc:'https://mino.co.kr/books/vol1/'},
 ...posts.map(p=>({loc:new URL(p.data.legacyUrl??`/writing/${p.id}/`,'https://mino.co.kr').href,lastmod:p.data.pubDate.toISOString().slice(0,10),
  images: art.posts[p.id] ? [art.posts[p.id].cover, ...art.posts[p.id].vignettes.map(v=>v.asset)].map(id=>new URL(art.assets[id].src,'https://mino.co.kr').href) : []}))
];
const xml=`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.map(u=>`<url><loc>${escapeXml(u.loc)}</loc>${u.lastmod?`<lastmod>${u.lastmod}</lastmod>`:''}${(u.images??[]).map(src=>`<image:image><image:loc>${escapeXml(src)}</image:loc></image:image>`).join('')}</url>`).join('\n')}\n</urlset>`;
return new Response(xml,{headers:{'Content-Type':'application/xml; charset=utf-8'}});
}
