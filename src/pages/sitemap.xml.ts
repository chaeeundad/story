import {getCollection} from 'astro:content';
export async function GET(){
const posts=await getCollection('blog',({data})=>!data.draft);
const urls: {loc: string; lastmod?: string}[]=[
 {loc:'https://mino.co.kr/'},
 {loc:'https://mino.co.kr/about/'},
 ...posts.map(p=>({loc:new URL(p.data.legacyUrl??`/writing/${p.id}/`,'https://mino.co.kr').href,lastmod:p.data.pubDate.toISOString().slice(0,10)}))
];
const xml=`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u=>`<url><loc>${u.loc}</loc>${u.lastmod?`<lastmod>${u.lastmod}</lastmod>`:''}</url>`).join('\n')}\n</urlset>`;
return new Response(xml,{headers:{'Content-Type':'application/xml; charset=utf-8'}});
}
