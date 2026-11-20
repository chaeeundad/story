"""Verify text coverage, template geometry, embedded art, and final rendered pagination."""
from pathlib import Path
from zipfile import ZipFile
import json,re,hashlib,sys
from docx import Document
from pypdf import PdfReader
from PIL import Image
r=Path(__file__).resolve().parents[1];doc=Path(sys.argv[1]);render=Path(sys.argv[2]);d=Document(doc)
md=(r/'books/vol1/manuscript.md').read_text();body=md[md.index('# 프롤로그'):]
def plain(t):return re.sub(r'\s','',re.sub(r'\[([^\]]+)\]\(([^)]+)\)',r'\1 — \2',t).replace('*','').removeprefix('- '))
expected=[plain(re.sub(r'^#+ ','',b.strip())) for b in re.split(r'\n\s*\n',body) if b.strip() and b.strip()!='---' and not b.strip().startswith('![')]
actual=[plain(p.text) for p in d.paragraphs];cursor=0
for p in expected:
 while cursor<len(actual) and actual[cursor]!=p:cursor+=1
 assert cursor<len(actual),f'Missing/reordered paragraph: {p[:60]}'
 cursor+=1
for f in ['prologue.md','epilogue.md']:
 for b in re.split(r'\n\s*\n',(r/'books/vol1'/f).read_text()):
  if b and b!='---':assert plain(re.sub(r'^#+ ','',b.strip())) in actual,(f,b)
assert '안산' not in md
assert len(d.inline_shapes)==16
assert int(d.sections[0].page_width.twips)==10660 and int(d.sections[0].page_height.twips)==14912
pdf=PdfReader(render/(doc.stem+'.pdf'));texts=[re.sub(r'\s','',p.extract_text()) for p in pdf.pages]
disclosure=json.loads((r/'books/vol1/book.json').read_text())['writingDisclosure']
assert disclosure in [p.text for p in d.paragraphs]
assert re.sub(r'\s','',disclosure) in texts[-1]
entries=json.loads((r/'.book-production/toc-entries.json').read_text());pages=json.loads((r/'books/vol1/print-page-map.json').read_text())
for title,anchor,_ in entries:assert re.sub(r'\s','',title) in texts[pages[anchor]-1],(title,anchor)
for title,anchor,_ in entries:
 if anchor not in ['thanks','colophon'] and not title.startswith('제') and title!='참고한 자료':
  n=pages[anchor];assert len(texts[n-1])<100,(title,'divider contains body');assert len(texts[n])>150
manifest=json.loads((r/'books/vol1/illustrations/manifest.json').read_text());art=[]
for x in manifest:
 im=Image.open(r/'books/vol1/illustrations/new'/x['file']);dpi=im.width/(x['width_mm']/25.4);assert dpi>=300
 art.append(x|{'pixels':list(im.size),'effective_dpi':round(dpi,1)})
artifact={'file':doc.name,'sha256':hashlib.sha256(doc.read_bytes()).hexdigest(),'bytes':doc.stat().st_size,'pages':len(pdf.pages),'manuscript_characters':len(md),'illustrations':16,'verified_manuscript_blocks':len(expected),'source_front_and_back_complete':True,'page_geometry_twips':[10660,14912],'body_font':'부크크 명조 Light 11pt / 22pt leading','subhead_font':'NanumGothic Bold 12.5pt','paragraph_after_pt':4}
(r/'books/vol1/print-artifact.json').write_text(json.dumps(artifact,ensure_ascii=False,indent=2)+'\n');(r/'.book-production/verified-art.json').write_text(json.dumps(art,ensure_ascii=False,indent=2))
print(json.dumps(artifact,ensure_ascii=False,indent=2))
