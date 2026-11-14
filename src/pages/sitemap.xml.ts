import {getCollection} from 'astro:content';
export async function GET(){
const posts=await getCollection('blog',({data})=>!data.draft);
const urls=['/','/about/',...posts.map(p=>p.data.legacyUrl??`/writing/${p.id}/`)];
const xml=`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(u=>`<url><loc>https://mino.co.kr${u}</loc></url>`).join('')}</urlset>`;
return new Response(xml,{headers:{'Content-Type':'application/xml; charset=utf-8'}});
}
