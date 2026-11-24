"""Idempotent, text-preserving illustration/accessibility enrichment of standalone essays."""
from pathlib import Path
import argparse
import html
import json
import re

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / 'src/data/essay-illustrations.json').read_text())
FIGURE = re.compile(r'<!-- essay-illustration:.*?<!-- /essay-illustration -->', re.S)
HEAD = re.compile(r'<!-- reading-metadata -->.*?<!-- /reading-metadata -->', re.S)
NAV = re.compile(r'<!-- reading-navigation -->.*?<!-- /reading-navigation -->', re.S)

def place_html(page, anchor, illustration):
    start, end = page.index('<main'), page.index('</main>')
    main = page[start:end]
    matches = [m for m in re.finditer(r'<p\b[^>]*>.*?</p>', main, re.S)
               if anchor in html.unescape(re.sub(r'<[^>]+>', '', m[0]))]
    assert len(matches) == 1, ('Illustration paragraph must be unique', anchor)
    pos = start + matches[0].end()
    return page[:pos] + illustration + page[pos:]

def place_markdown(md, anchor, illustration):
    paragraphs = list(re.finditer(r'[^\n]+(?:\n(?!\n)[^\n]+)*', md))
    matches = [m for m in paragraphs if anchor in m[0]]
    assert len(matches) == 1, ('Illustration paragraph must be unique', anchor)
    pos = matches[0].end()
    return md[:pos] + '\n\n' + illustration + md[pos:]

def figure(asset_id, vignette=False):
    a = DATA['assets'][asset_id]
    classes = 'essay-illustration' + (' is-vignette' if vignette else '') + (' is-portrait' if a['height'] > a['width'] else '')
    size = 420 if vignette else (340 if a['height'] > a['width'] else 620)
    return (f'<!-- essay-illustration:{asset_id} -->'
        f'<figure class="{classes}"><img src="{a["src"]}" '
        f'srcset="{a["small"]} {a["smallWidth"]}w, {a["src"]} {a["width"]}w" '
        f'sizes="(max-width: {size + 44}px) calc(100vw - 44px), {size}px" '
        f'width="{a["width"]}" height="{a["height"]}" alt="{html.escape(a["alt"], quote=True)}" '
        'loading="lazy" decoding="async">'
        '<figcaption>책에 사용한 창작 삽화 · 실제 인물이나 사건의 기록이 아닙니다.</figcaption>'
        '</figure><!-- /essay-illustration -->')

def enhance(slug):
    settings = DATA['posts'][slug]
    directory = 'writing'
    path = ROOT / f'public/{directory}/{slug}/index.html'
    page = path.read_text()
    # Generated additions can be replaced without touching original prose.
    page = FIGURE.sub('', page)
    page = HEAD.sub('', page)
    page = NAV.sub('', page)
    page = page.replace('<main>', '<main id="article" tabindex="-1">', 1)
    page = page.replace('<main id="article">', '<main id="article" tabindex="-1">', 1)
    assert '<main id="article" tabindex="-1">' in page, slug
    if not re.search(r'<a\b[^>]*class="(?:skip|skip-link)"', page):
        page = page.replace('<body>', '<body><a class="skip-link" href="#article">본문으로 건너뛰기</a>', 1)
    page = re.sub(r'<aside class="toc">(.*?)</aside>', r'<nav class="toc" aria-label="글 목차">\1</nav>', page, count=1, flags=re.S)
    page = re.sub(r'(<nav class="toc"[^>]*>)<h3>(.*?)</h3>', r'\1<h2>\2</h2>', page, count=1)
    page = page.replace('<div class="progress" id="progress">', '<div class="progress" id="progress" aria-hidden="true">')
    # Existing dialogue labels are subordinate to the conversation heading (h2).
    page = re.sub(r'(<div class="dialogue-pair">)<h4>(.*?)</h4>', r'\1<h3>\2</h3>', page)
    page = place_html(page, settings['coverAfter'], figure(settings['cover']))
    for item in settings['vignettes']:
        page = place_html(page, item['after'], figure(item['asset'], True))
    page = page.replace('<nav class="toc" aria-label="글 목차">', '<nav class="toc" aria-label="글 목차" id="reading-toc" tabindex="-1">')
    navigation = ('<!-- reading-navigation --><nav class="reading-shortcuts" aria-label="읽기 바로가기">'
        '<a href="/">글 목록</a><a href="#reading-toc">목차로 이동</a></nav>'
        '<script src="/reading-nav.js" defer></script><!-- /reading-navigation -->')
    page = page.replace('</body>', navigation + '</body>', 1)
    a = DATA['assets'][settings['cover']]
    image_url = 'https://mino.co.kr' + a['social']
    alt = html.escape(a['alt'], quote=True)
    metadata = ('<!-- reading-metadata --><link rel="stylesheet" href="/reading.css">'
        f'<meta property="og:image" content="{image_url}">'
        f'<meta property="og:image:width" content="{a["width"]}">'
        f'<meta property="og:image:height" content="{a["height"]}">'
        f'<meta property="og:image:alt" content="{alt}">'
        f'<meta name="twitter:image" content="{image_url}">'
        f'<meta name="twitter:image:alt" content="{alt}"><!-- /reading-metadata -->')
    page = page.replace('</head>', metadata + '</head>', 1)
    page = page.replace('name="twitter:card" content="summary"', 'name="twitter:card" content="summary_large_image"')
    page = page.replace('name="robots" content="index, follow"', 'name="robots" content="index, follow, max-image-preview:large"')
    def update_ld(match):
        data = json.loads(match[1])
        data['image'] = {'@type':'ImageObject', 'url':image_url, 'width':a['width'], 'height':a['height']}
        return '<script type="application/ld+json">' + json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c') + '</script>'
    page, count = re.subn(r'<script type="application/ld\+json">(.*?)</script>', update_ld, page, flags=re.S)
    assert count == 1, slug
    path.write_text(page)

    md_path = ROOT / f'src/content/blog/{slug}.md'
    md = md_path.read_text()
    # Separate blocks use only our explicit markers; all authored lines stay in place.
    md = re.sub(r'\n\n<!-- essay-illustration:.*?<!-- /essay-illustration -->', '', md, flags=re.S)
    # This manuscript is only a link stub; its full edition is the HTML above.
    if slug == 'why-we-work' and not re.search(r'^## ', md, flags=re.M):
        md_path.write_text(md)
        return
    md = place_markdown(md, settings['coverAfter'], figure(settings['cover']))
    for item in settings['vignettes']:
        md = place_markdown(md, item['after'], figure(item['asset'], True))
    md_path.write_text(md)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--slug', choices=DATA['posts'])
    args = parser.parse_args()
    for slug in ([args.slug] if args.slug else DATA['posts']):
        enhance(slug)
        print('Enhanced', slug)
