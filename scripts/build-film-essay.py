# -*- coding: utf-8 -*-
"""Render the film essay from Markdown and its credited still-image manifest."""
from pathlib import Path
import re, html, json
ROOT = Path(__file__).resolve().parents[1]
SLUG = 'the-future-we-already-quoted'
ART = ROOT / 'public/images/film-essay'
H = html.escape
assets = json.loads((ART/'provenance.json').read_text())['assets']
by_file = {a['file']: a for a in assets}
films = [(a['id'],a['film'],a['caption']) for a in assets]
source = ROOT / f'src/content/blog/{SLUG}.md'
md = source.read_text()
_,front,body=md.split('---',2)
title=re.search(r'title: "(.*?)"',front)[1]
description=re.search(r'description: "(.*?)"',front)[1]
url=f'https://mino.co.kr/writing/{SLUG}/'
body,notes=body.rsplit('\n---\n',1)
notes,conversation=notes.split('### 이 글이 만들어지기까지',1)

# Render only the small Markdown subset this article uses, escaping raw HTML.
def inline(s):
 s=H(s)
 s=re.sub(r'\[([^\]]+)\]\(([^)]+)\)',r'<a href="\2">\1</a>',s)
 s=re.sub(r'\*\*([^*]+)\*\*',r'<strong>\1</strong>',s)
 s=re.sub(r'(?<!\*)\*([^*]+)\*(?!\*)',r'<em>\1</em>',s)
 return s

def render(s):
 out=[]
 for p in re.split(r'\n\s*\n',s.strip()):
  if not p.strip():continue
  if p.startswith('>'):
   lines=[re.sub(r'^> ?', '',x) for x in p.splitlines()]
   quote=lines[0];attribution=' '.join(x for x in lines[1:] if x)
   film_name=re.search(r'《([^》]+)》',attribution)[1]
   anchor=next(i for i,(_,label,_) in enumerate(films,1) if label.split(' · ')[0]==film_name)
   out.append(f'<blockquote id="s{anchor}"><p>{inline(quote)}</p><cite>{inline(attribution)}</cite></blockquote>')
  elif (m:=re.fullmatch(r'!\[([^]]*)\]\(([^)]+)\)',p)):
   a=by_file[Path(m[2]).name]
   out.append(f'<figure><img src="{H(m[2])}" alt="{H(m[1])}" width="{a["width"]}" height="{a["height"]}" loading="lazy" decoding="async"><figcaption>{H(m[1])}</figcaption></figure>')
  elif p.startswith('*이미지 출처:'):out.append(f'<p class="image-credit">{inline(p)}</p>')
  elif p.startswith('### '):out.append(f'<h3>{inline(p[4:])}</h3>')
  else:out.append(f'<p>{inline(p)}</p>')
 return '\n'.join(out)

parts=re.split(r'(?m)^## ',body)
prologue_title=re.search(r'prologueTitle: "(.*?)"',front)[1]
sections=[('s0','프롤로그',prologue_title,parts[0])]
labels=['일과 능력','역할과 삶','이미지와 신뢰','애착과 책임','도움과 선택','에필로그']
for i,part in enumerate(parts[1:]):
 heading,content=part.split('\n',1)
 sections.append(('s11' if i==5 else f'part{i+1}',labels[i],heading,content))
toc=''.join(f'<a href="#{anchor}"><span>{H(label)}</span>{H(heading)}</a>' for anchor,label,heading,_ in sections)
main='\n'.join(f'<section class="chapter" id="{anchor}"><div class="chapter-number">{H(label)}</div><h2>{H(heading)}</h2>{render(content)}</section>' for anchor,label,heading,content in sections)
template=(ROOT/'public/writing/why-go-fishing/index.html').read_text()
css=re.search(r'<style>(.*?)</style>',template,re.S)[1]
css+='''
/* Preserve the archive's serif reading surface and green editorial accents. */
.chapter strong{font-weight:700;color:#294d40}.chapter>p em{font-style:italic;color:#365c4b}.chapter blockquote{scroll-margin-top:85px}.image-credit{font-size:12px!important;line-height:1.7!important;color:#68736d;margin-top:-14px!important;overflow-wrap:anywhere}.image-credit em{font-style:normal}.hero h1{max-width:900px;text-wrap:balance;word-break:keep-all}.hero .subtitle{max-width:650px;text-wrap:balance;word-break:keep-all}.chapter{padding-top:42px}.chapter-number{font-size:14px;letter-spacing:.035em}.toc h3,.toc a{font-size:14px}.toc a span{font-size:12px;color:#717b75}.top a,.hero .byline{font-size:14px}.top .home-link{font-size:21px}.chapter a,.notes a{color:#337c70;text-decoration:underline;text-underline-offset:4px}.chapter a{font-family:system-ui,sans-serif;font-size:.88em}.chapter blockquote{margin:0 0 38px;padding:5px 0 5px 25px;border-left:3px solid #7fa391}.chapter blockquote p{font-size:clamp(21px,3vw,28px);line-height:1.75;letter-spacing:-.03em;margin:0 0 14px}.chapter blockquote cite{font:14px/1.85 system-ui,sans-serif;color:#65746b;font-style:normal;display:block}.chapter figure{margin:35px 0 40px}.chapter figure img{display:block;width:100%;height:auto;border-radius:3px}.chapter figcaption{font:14px/1.85 system-ui,sans-serif;color:#69766f;margin-top:12px}.chapter figcaption span{display:block;font-size:12px;color:#7c8780;margin-top:2px}.notes p{font-size:14px;line-height:2}.conversation-list p{font:15px/2 system-ui,sans-serif;color:#56675d}.conversation-summary-sub{font-size:13px}.reader-response-button{font-size:14px}.reader-response-note{font-size:13px!important;color:#717d75!important}.reader-response-more{font-size:14px}.skip{position:absolute;top:-90px;left:20px;padding:10px;background:#fff;z-index:30}.skip:focus{top:10px}a:focus-visible,button:focus-visible,summary:focus-visible{outline:2px solid #337c70;outline-offset:5px}h2{text-wrap:balance}blockquote,figure{break-inside:avoid}@media(max-width:850px){.toc a{display:block;margin:0;padding:7px 0}.toc a span{display:inline;font-size:12px;margin-right:10px}.chapter{padding-top:28px}.hero{padding:66px 22px 55px}.hero h1{font-size:36px}.chapter blockquote{padding-left:18px}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}@media print{.chapter{break-before:auto;padding:25px 0}.chapter figure{max-width:75%;margin:20px auto}.notes{max-width:none}.chapter blockquote p{font-size:14pt}.skip{display:none}}
'''
response=template.split('<section class="reader-response">',1)[1].split('<div class="endnote">',1)[0]
response='<section class="reader-response">'+response
response=response.replace('모든 글 보기 →','모든 글 보기')
js=re.findall(r'<script>(.*?)</script>',template,re.S)[0].replace('why-go-fishing',SLUG).replace('물고기를 사지 않고 낚으러 가는 이유',title)
meta=f'''<meta name="description" content="{H(description)}"><link rel="canonical" href="{url}"><meta name="robots" content="index, follow, max-image-preview:large"><meta property="og:type" content="article"><meta property="og:site_name" content="mino."><meta property="og:locale" content="ko_KR"><meta property="og:url" content="{url}"><meta property="og:title" content="{H(title)}"><meta property="og:description" content="{H(description)}"><meta property="article:published_time" content="2026-11-23T00:00:00+09:00"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="{H(title)}"><meta name="twitter:description" content="{H(description)}">'''
ld={'@context':'https://schema.org','@type':'BlogPosting','headline':title,'description':description,'url':url,'mainEntityOfPage':url,'datePublished':'2026-11-23T00:00:00+09:00','dateModified':'2026-11-23T00:00:00+09:00','inLanguage':'ko-KR','author':{'@type':'Person','name':'mino.'}}
page=f'''<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">{meta}<title>{H(title)} — mino.</title><style>{css}</style><script type="application/ld+json">{json.dumps(ld,ensure_ascii=False)}</script></head><body><a href="#article" class="skip">본문으로 건너뛰기</a><div class="progress" id="progress" aria-hidden="true"></div><header class="top"><a class="home-link" href="/">mino.</a><span class="top-title">영화의 대사로 다시 읽는 AI 시대</span><a class="home-return" href="/">모든 글 보기</a></header><div class="hero"><div class="kicker">AI · 영화 · 인간과 사회</div><h1>오늘을 예측한 영화들,<br>우리가 놓친 대사들</h1><div class="subtitle">일을 대신하는 컴퓨터에서 사랑을 건네는 목소리까지.<br>편리함을 따라가다 다시 묻게 되는 우리의 자리.</div><div class="byline"><time datetime="2026-11-23">2026년 11월 23일</time> · mino.</div></div><div class="layout"><nav class="toc" aria-label="글 목차"><h3>이 글의 흐름</h3>{toc}<a href="#sources">인용과 이미지 안내</a></nav><main id="article">{main}</main></div><aside class="notes" id="sources">{render(notes)}</aside><section class="conversation-origin"><div class="conversation-heading"><div class="conversation-eyebrow">대화의 기록</div><h2>이 글이 만들어지기까지</h2></div><details class="conversation-disclosure"><summary><span class="conversation-summary-copy"><span class="conversation-summary-title">출발한 질문과 작업 과정</span><span class="conversation-summary-sub">대화의 취지 요약 · AI 활용 안내</span></span><span class="conversation-toggle" aria-hidden="true">+</span></summary><div class="conversation-list">{render(conversation)}</div></details></section>{response}<div class="endnote">끝까지 읽어주셔서 감사합니다.<div class="actions"><button type="button" onclick="window.print()">인쇄 · PDF 저장</button></div></div><footer>{H(title)} · 2026</footer><button class="floating" type="button" aria-label="맨 위로" onclick="scrollTo({{top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}})">↑</button><script>{js}</script><script src="/reactions.js" defer></script></body></html>'''
dest=ROOT/f'public/writing/{SLUG}/index.html'
dest.parent.mkdir(parents=True,exist_ok=True)
dest.write_text(page)
print(f'Built {dest.relative_to(ROOT)}; {len(films)} credited film images; {len(md)} manuscript characters')
