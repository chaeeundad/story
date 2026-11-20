"""Compare all ten source essays with the book, including the HTML-only first essay."""
from pathlib import Path
from lxml import html
import re, json, difflib, hashlib

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '.book-production' / 'comparison'
OUT.mkdir(parents=True, exist_ok=True)
slugs = ['why-we-work', 'why-children-study', 'why-go-fishing',
         'does-humanity-need-to-work', 'we-built-what-we-do-not-understand',
         'why-we-still-build', 'when-we-accept-the-world-we-made',
         'why-we-need-each-other', 'let-me-live-my-own-life', 'still-we-live-tomorrow']

def blocks(text):
    text = re.sub(r'\n(?=## )', '\n\n', text)
    return [s.strip() for s in re.split(r'\n\s*\n', text)
            if s.strip() and s.strip() != '---']

def norm(text):
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
    return re.sub(r'\s+', ' ', text.replace('*', '')).strip()

def narrative(seq):
    return [s for s in seq if not s.startswith('#') and not s.startswith('*이 글은')]

book = (ROOT / 'books/vol1/manuscript.md').read_text()
chunks = re.split(r'^# (.+)\n', book, flags=re.M)
chapters = {chunks[i]: chunks[i+1] for i in range(1, len(chunks), 2)}
results, diffs = [], []
for number, slug in enumerate(slugs, 1):
    path = ROOT / 'src/content/blog' / (slug + '.md')
    raw = path.read_text()
    title = re.search(r'^title: "(.+)"', raw, re.M).group(1)
    legacy = re.search(r'^legacyUrl: "(.+)"', raw, re.M).group(1)
    webpage = ROOT / 'public' / legacy.lstrip('/') / 'index.html'
    dom = html.fromstring(webpage.read_text())
    if number == 1:
        source = '\n\n'.join(('## ' if el.tag == 'h2' else '') + el.text_content()
                             for el in dom.xpath('//section[contains(concat(" ",normalize-space(@class)," ")," chapter ")]/*[self::h2 or self::p]'))
        source_path = str(webpage.relative_to(ROOT))
        references = ''
    else:
        source = raw.split('---', 2)[2].strip()
        parts = re.split(r'^### (?:참고한 자료|더 읽을 거리)', source, maxsplit=1, flags=re.M)
        source, references = parts[0].strip(), parts[1].strip() if len(parts)>1 else ''
        source_path = str(path.relative_to(ROOT))
    sb, bb = blocks(source), blocks(chapters[title])
    sn, bn = list(map(norm,sb)), list(map(norm,bb))
    changes=[]
    for kind,i,j,k,l in difflib.SequenceMatcher(None,sn,bn,autojunk=False).get_opcodes():
        if kind!='equal':changes.append({'kind':kind,'source_block':i+1,'source':sb[i:j],'book_block':k+1,'book':bb[k:l]})
    headings=[s for s in sb if s.startswith('## ')]
    removed=[s[3:] for s in headings if norm(s) not in bn]
    source_prose = narrative(sb)
    web_prose = [el.text_content() for el in dom.xpath('//section[contains(concat(" ",normalize-space(@class)," ")," chapter ")]//p')]
    if len(web_prose) == len(source_prose)+1 and web_prose[-1].startswith('이 글은'):
        web_prose = web_prose[:-1]
    # Ignore display-only spaces and inline emphasis; compare every narrative paragraph.
    web_match = [re.sub(r'\s','',norm(s)) for s in source_prose] == [re.sub(r'\s','',norm(s)) for s in web_prose]
    assert web_match, f'Markdown/public HTML mismatch in chapter {number}'
    result={'chapter':number,'title':title,'source':source_path,'web':str(webpage.relative_to(ROOT)),
            'source_chars':len(source),'book_chars':len(chapters[title].strip().removesuffix('---').strip()),
            'source_paragraphs':len(source_prose),'book_paragraphs':len(narrative(bb)),
            'source_matches_public_html':web_match,
            'source_subsections':len(headings),'book_subsections':sum(s.startswith('## ') for s in bb),
            'removed_sections':removed,'changes':changes,'references':references,
            'source_sha256':hashlib.sha256(source.encode()).hexdigest(),
            'book_sha256':hashlib.sha256(chapters[title].encode()).hexdigest()}
    results.append(result)
    (OUT/f'{number:02d}-source.txt').write_text(source)
    (OUT/f'{number:02d}-book.txt').write_text(chapters[title])
    diffs.append(f'CHAPTER {number}: {title}\n'+''.join(difflib.unified_diff([s+'\n' for s in sb],[s+'\n' for s in bb],fromfile='source',tofile='book',n=1)))
(OUT/'comparison.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
(OUT/'changes.diff').write_text('\n\n'.join(diffs))
print(json.dumps([{k:v for k,v in x.items() if k not in ['changes','references','source_sha256','book_sha256']}|{'change_groups':len(x['changes']),'has_source_references':bool(x['references'])} for x in results],ensure_ascii=False,indent=2))
