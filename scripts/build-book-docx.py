"""Build the full Bookk template edition. Inputs: template, assets dir, output, optional page-map JSON."""
from pathlib import Path
from copy import deepcopy
from zipfile import ZipFile, ZIP_DEFLATED
import sys,re,json,hashlib,uuid
from lxml import etree as E
from docx import Document
from docx.shared import Pt,Mm
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK, WD_TAB_ALIGNMENT, WD_TAB_LEADER
from docx.enum.style import WD_STYLE_TYPE
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
root=Path(__file__).resolve().parents[1]
template,assets,out=map(Path,sys.argv[1:4]);pages=json.loads(Path(sys.argv[4]).read_text()) if len(sys.argv)>4 else {}
source=template.read_bytes();d=Document(template);sample=deepcopy(d.paragraphs[95]._p.pPr);sect=deepcopy(d.sections[3]._sectPr)
# Reuse the supplied book section; all five old sections only belong to removed sample pages.
body=d._element.body
for x in list(body): body.remove(x)
for x in list(sect):
 if x.tag in [qn('w:headerReference'),qn('w:footerReference'),qn('w:type')]:sect.remove(x)
body.append(sect)
s=d.sections[0];s.different_first_page_header_footer=True
d.settings.odd_and_even_pages_header_footer=True
if d.settings.element.find(qn('w:mirrorMargins')) is None:d.settings.element.append(OxmlElement('w:mirrorMargins'))
FONT='부크크 명조 Light'
SANS='NanumGothic'
manifest={x['file']:x for x in json.loads((root/'books/vol1/illustrations/manifest.json').read_text())}
def font(run,size=11,bold=False):
 family=SANS if bold else FONT
 run.font.name=family;run.font.size=Pt(size);run.font.bold=bold
 run.font.color.rgb=__import__('docx').shared.RGBColor(0,0,0)
 rp=run._r.get_or_add_rPr();rp.get_or_add_rFonts().set(qn('w:eastAsia'),family)
 for key in ['ascii','hAnsi','cs']:rp.get_or_add_rFonts().set(qn('w:'+key),family)
 for tag,value in [('spacing','0'),('w','100')]:
  el=rp.find(qn('w:'+tag))
  if el is None:el=E.SubElement(rp,qn('w:'+tag))
  el.set(qn('w:val'),value)
 return run
for name,size in [('Title',20),('Subtitle',12),('Heading 1',20),('Heading 2',16),('Heading 3',12)]:
 st=d.styles.add_style(name,WD_STYLE_TYPE.PARAGRAPH) if name not in d.styles else d.styles[name]
 st.base_style=d.styles['바탕글'];st.font.name=FONT;st.font.size=Pt(size);st.font.color.rgb=__import__('docx').shared.RGBColor(0,0,0)
 st.element.get_or_add_rPr().get_or_add_rFonts().set(qn('w:eastAsia'),FONT)
 st.paragraph_format.keep_with_next=True
 if name.startswith('Heading'):st.element.get_or_add_pPr().append(E.Element(qn('w:outlineLvl'),{qn('w:val'):str(int(name[-1])-1)}))
# Clear every retained header/footer, including unused parts, later in the package patch.
for kind in ['footer','even_page_footer','first_page_footer','header','even_page_header','first_page_header']:
 part=getattr(s,kind);part.is_linked_to_previous=False
 for child in list(part._element):part._element.remove(child)
 if kind in ['footer','even_page_footer']:
  p=part.add_paragraph();p.style=d.styles['Footer'];p.alignment=WD_ALIGN_PARAGRAPH.RIGHT if kind=='footer' else WD_ALIGN_PARAGRAPH.LEFT
  font(p.add_run('아직 생각 중입니다    ' if kind=='footer' else ''),9)
  fld=OxmlElement('w:fldSimple');fld.set(qn('w:instr'),'PAGE');r=OxmlElement('w:r');t=OxmlElement('w:t');t.text='1';r.append(t);fld.append(r);p._p.append(fld)
  if kind=='even_page_footer':font(p.add_run('    아직 생각 중입니다'),9)
 else:part.add_paragraph()
def para(text='',size=11,align=None,bold=False,style=None):
 p=d.add_paragraph(style=style or '바탕글');p._p.remove(p._p.pPr) if p._p.pPr is not None else None
 p._p.insert(0,deepcopy(sample));p.paragraph_format.widow_control=True
 p.paragraph_format.line_spacing=Pt(22);p.paragraph_format.space_after=Pt(4);p.paragraph_format.first_line_indent=Pt(11)
 if style:p.style=style
 if align is not None:p.alignment=align;p.paragraph_format.first_line_indent=Pt(0)
 # Preserve emphasis and make source references usable in print and Word.
 text=re.sub(r'\[([^\]]+)\]\(([^)]+)\)',r'\1 — \2',text)
 text=text.removeprefix('- ')
 for frag in re.split(r'(\*\*.*?\*\*|\*[^*]+\*)',text):
  if frag:font(p.add_run(frag.strip('*') if frag.startswith('*') else frag),size,bold or frag.startswith('**'))
 return p
def heading(text,level=2,newpage=True):
 p=para(text,22 if level==1 else 20 if level==2 else 12.5,WD_ALIGN_PARAGRAPH.CENTER if level<3 else WD_ALIGN_PARAGRAPH.LEFT,True,f'Heading {level}')
 pf=p.paragraph_format;pf.page_break_before=newpage;pf.keep_with_next=True;pf.first_line_indent=Pt(0);pf.line_spacing=Pt(28 if level<3 else 22);pf.space_before=Pt(60 if level<3 else 24);pf.space_after=Pt(32 if level<3 else 12)
 return p
def bookmark(p,name,i):
 a=OxmlElement('w:bookmarkStart');a.set(qn('w:id'),str(i));a.set(qn('w:name'),name);z=OxmlElement('w:bookmarkEnd');z.set(qn('w:id'),str(i));p._p.insert(1,a);p._p.append(z)
book=json.loads((root/'books/vol1/book.json').read_text());md=(root/'books/vol1/manuscript.md').read_text()
p=para(book['title'],20,WD_ALIGN_PARAGRAPH.CENTER,style='Title');p.paragraph_format.space_before=Pt(140);p.paragraph_format.space_after=Pt(30);p.paragraph_format.line_spacing=Pt(32)
p=para(book['subtitle'],12,WD_ALIGN_PARAGRAPH.CENTER,style='Subtitle');p.paragraph_format.line_spacing=Pt(23)
p=para(book['author']+' 지음',11,WD_ALIGN_PARAGRAPH.CENTER);p.paragraph_format.space_before=Pt(70)
heading('차례',2)
entries=[];heads=[]
for line in md.splitlines():
 if line.startswith('# ') and line[2:]!=book['title']:heads.append(line[2:])
entries += [(t,f'book_{i}',t.startswith('제')) for i,t in enumerate(heads)]
entries.insert(-1,('감사의 말','thanks',False))
entries += [('판권','colophon',False)]
for title,anchor,ispart in entries:
 p=para('',10 if not ispart else 11,WD_ALIGN_PARAGRAPH.LEFT);p.paragraph_format.line_spacing=Pt(21);p.paragraph_format.space_after=Pt(0);p.paragraph_format.space_before=Pt(6 if ispart else 0);p.paragraph_format.tab_stops.add_tab_stop(Mm(126),WD_TAB_ALIGNMENT.RIGHT,WD_TAB_LEADER.DOTS)
 h=OxmlElement('w:hyperlink');h.set(qn('w:anchor'),anchor)
 r=OxmlElement('w:r');rp=OxmlElement('w:rPr');rf=OxmlElement('w:rFonts');rf.set(qn('w:eastAsia'),FONT);rf.set(qn('w:ascii'),FONT);rp.append(rf);rp.append(E.Element(qn('w:sz'),{qn('w:val'):'20'}));r.append(rp);t=OxmlElement('w:t');t.text=title;r.append(t);h.append(r);p._p.append(h)
 font(p.add_run('\t'+str(pages.get(anchor,''))),10)
bodytext=md[md.index('# 프롤로그'):];index=0;divider=False;pending_body=False;references=False
for text in re.split(r'\n\s*\n',bodytext):
 text=text.strip()
 if not text or text=='---':continue
 if text.startswith('# '):
  title=text[2:]
  prior=d.paragraphs
  if len(prior)>1 and len(prior[-1].text)<200 and prior[-1].text and prior[-2].style.name=='바탕글':prior[-2].paragraph_format.keep_with_next=True
  references=title=='참고한 자료';divider=not title.startswith('제') and not references
  spacer=para('',1);spacer.paragraph_format.page_break_before=True;spacer.paragraph_format.line_spacing=Pt(48);spacer.paragraph_format.space_after=Pt(0)
  p=heading(title,1 if title.startswith('제') else 2,False);p.paragraph_format.space_before=Pt(0);bookmark(p,f'book_{index}',index+1);index+=1
  p.paragraph_format.keep_with_next=False
  pending_body=divider
 elif text.startswith('!['):
  name=re.search(r'\((.*?)\)',text).group(1);alt=re.search(r'!\[(.*?)\]',text).group(1);item=manifest[Path(name).name]
  p=para('',align=WD_ALIGN_PARAGRAPH.CENTER);p.paragraph_format.space_before=Pt(20);p.paragraph_format.space_after=Pt(24);p.paragraph_format.line_spacing=None
  shape=p.add_run().add_picture(str(root/'books/vol1'/name),width=Mm(item['width_mm']));shape._inline.docPr.set('descr',alt)
  if item['crop_bottom_percent']:
   crop=item['crop_bottom_percent'];shape.height=int(shape.height*(100-crop)/100)
   fill=shape._inline.graphic.graphicData.pic.blipFill
   rect=OxmlElement('a:srcRect');rect.set('b',str(crop*1000));fill.insert(1,rect)
 elif text.startswith('## '):
  p=heading(text[3:],3,False)
  if pending_body:p.paragraph_format.page_break_before=True;p.paragraph_format.space_before=Pt(0);pending_body=False
  if text[3:]=='감사의 말':bookmark(p,'thanks',102);p.paragraph_format.page_break_before=True;p.paragraph_format.space_before=Pt(0)
 else:
  p=para(text,9.5 if references else 11)
  if references:p.alignment=WD_ALIGN_PARAGRAPH.LEFT;p.paragraph_format.line_spacing=Pt(16);p.paragraph_format.first_line_indent=Pt(0);p.paragraph_format.space_after=Pt(14)
  if pending_body:p.paragraph_format.page_break_before=True;pending_body=False
p=heading('판권');bookmark(p,'colophon',101)
for txt in [book['title'],book['subtitle'],'지은이  '+book['author'],'© 2026 '+book['author'],'분류  '+book['genre'],'https://mino.co.kr/books/vol1/','이 책은 저자와 AI가 나눈 대화에서 출발해 엮었습니다.','삽화는 창작 장면이며 저자와 가족의 실제 모습을 기록한 그림이 아닙니다. 피아노 장면도 미래를 상상한 것입니다.','본문 글꼴  부크크 명조 Light · (주)부크크','제목 글꼴  나눔고딕 Bold · 네이버 (SIL OFL 1.1)']:
 p=para(txt,10,WD_ALIGN_PARAGRAPH.LEFT);p.paragraph_format.space_after=Pt(12)
d.core_properties.title=book['title'];d.core_properties.subject=book['subtitle'];d.core_properties.author=book['author'];d.core_properties.last_modified_by=book['author'];d.core_properties.comments='';d.core_properties.keywords=''
out.parent.mkdir(parents=True,exist_ok=True);intermediate=assets/'assembled.docx';d.save(intermediate)
# Preserve untouched package parts byte-for-byte, while replacing editable structures.
with ZipFile(template) as z:original={n:z.read(n) for n in z.namelist()}
with ZipFile(intermediate) as z:built={n:z.read(n) for n in z.namelist()}
editable={'word/document.xml','word/_rels/document.xml.rels','word/styles.xml','word/settings.xml','[Content_Types].xml','docProps/core.xml','docProps/app.xml'}
result=dict(original)
for n,data in built.items():
 if n in editable or n not in original or re.match(r'word/(header|footer)\d+\.xml$',n):result[n]=data
# Retained but unused sample headers and footers must contain no sample text.
active_ids={x.get(qn('r:id')) for x in E.fromstring(result['word/document.xml']).iter() if x.tag in [qn('w:headerReference'),qn('w:footerReference')]}
used={r.get('Target') for r in E.fromstring(result['word/_rels/document.xml.rels']) if r.get('Id') in active_ids}
for n in list(result):
 if re.match(r'word/(header|footer)\d+\.xml$',n) and Path(n).name not in used:
  r=E.fromstring(result[n]);r[:]=[E.Element(qn('w:p'))];result[n]=E.tostring(r,xml_declaration=True,encoding='UTF-8',standalone=True)
# Embed original font for print/view portability (OS/2 fsType=4, print/preview embedding).
W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';R='http://schemas.openxmlformats.org/officeDocument/2006/relationships';P='http://schemas.openxmlformats.org/package/2006/relationships';C='http://schemas.openxmlformats.org/package/2006/content-types'
fontdata=bytearray((assets/'BookkMyungjo-Light.ttf').read_bytes());key=uuid.UUID('71264f5e-2cc5-4bb9-a208-0f9cd7e75871');keybytes=key.bytes[::-1]
for i in range(32):fontdata[i]^=keybytes[i%16]
result['word/fonts/bookk.odttf']=bytes(fontdata)
ft=E.fromstring(result['word/fontTable.xml']);f=next((x for x in ft if x.get(qn('w:name'))==FONT),None)
if f is None:f=E.SubElement(ft,qn('w:font'),{qn('w:name'):FONT})
E.SubElement(f,qn('w:embedRegular'),{qn('r:id'):'rIdBookkEmbedded',qn('w:fontKey'):'{'+str(key).upper()+'}'})
sansdata=bytearray((assets/'NanumGothic-Bold.ttf').read_bytes());sanskey=uuid.UUID('a837e94d-73e0-4598-a50c-f11720152993')
for i in range(32):sansdata[i]^=sanskey.bytes[::-1][i%16]
result['word/fonts/nanum-bold.odttf']=bytes(sansdata)
sf=E.SubElement(ft,qn('w:font'),{qn('w:name'):SANS});E.SubElement(sf,qn('w:embedBold'),{qn('r:id'):'rIdNanumEmbedded',qn('w:fontKey'):'{'+str(sanskey).upper()+'}'})
result['word/fontTable.xml']=E.tostring(ft,xml_declaration=True,encoding='UTF-8',standalone=True)
fr=E.Element('{'+P+'}Relationships',nsmap={None:P});E.SubElement(fr,'{'+P+'}Relationship',Id='rIdBookkEmbedded',Type=R+'/font',Target='fonts/bookk.odttf');E.SubElement(fr,'{'+P+'}Relationship',Id='rIdNanumEmbedded',Type=R+'/font',Target='fonts/nanum-bold.odttf');result['word/_rels/fontTable.xml.rels']=E.tostring(fr,xml_declaration=True,encoding='UTF-8',standalone=True)
ct=E.fromstring(result['[Content_Types].xml']);E.SubElement(ct,'{'+C+'}Default',Extension='odttf',ContentType='application/vnd.openxmlformats-officedocument.obfuscatedFont');result['[Content_Types].xml']=E.tostring(ct,xml_declaration=True,encoding='UTF-8',standalone=True)
settings=E.fromstring(result['word/settings.xml'])
for tag in ['updateFields','embedTrueTypeFonts','saveSubsetFonts']:
 el=settings.find(qn('w:'+tag))
 if el is None:el=E.SubElement(settings,qn('w:'+tag))
 el.set(qn('w:val'),'true' if tag!='saveSubsetFonts' else 'false')
result['word/settings.xml']=E.tostring(settings,xml_declaration=True,encoding='UTF-8',standalone=True)
with ZipFile(out,'w',ZIP_DEFLATED) as z:
 for n,data in result.items():z.writestr(n,data)
inv={n:{'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'preserved':result.get(n)==b} for n,b in original.items()}
(assets/'template-inventory.json').write_text(json.dumps({'template_sha256':hashlib.sha256(source).hexdigest(),'parts':inv},indent=2))
(assets/'toc-entries.json').write_text(json.dumps(entries,ensure_ascii=False))
print(out, 'manuscript characters',len(md),'chapters/parts',index)
