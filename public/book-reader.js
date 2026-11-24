(() => {
  const article = document.getElementById('book-text');
  if (!article) return;
  const root = document.documentElement;
  const tools = document.getElementById('book-tools');
  const toc = document.getElementById('book-toc');
  const sections = [...article.querySelectorAll('.book-section')];
  const headings = sections.map(section => section.querySelector('h1,h2'));
  const links = [...toc.querySelectorAll('a[href^="#"]')];
  const modeButton = document.getElementById('reader-mode');
  const resumeButton = document.getElementById('reader-resume');
  const previous = document.getElementById('chapter-prev');
  const next = document.getElementById('chapter-next');
  const position = document.getElementById('chapter-position');
  const status = document.getElementById('reader-status');
  const theme = document.getElementById('reader-theme');
  const fontDown = document.getElementById('font-down');
  const fontUp = document.getElementById('font-up');
  const storageKey = 'mino-book-vol1-reader-v1';
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch {}
  let fontSize = Number.isFinite(saved.fontSize) ? Math.max(16, Math.min(26, saved.fontSize)) : 19;
  let palette = ['paper','white','night'].includes(saved.theme) ? saved.theme : 'paper';
  let bookmark = saved.bookmark && headings.some(h => h.id === saved.bookmark.id) ? saved.bookmark : null;
  let ebook = new URL(location.href).searchParams.get('mode') === 'ebook';
  let active = 0;
  let savingPaused = false;
  let tracking = false;
  let timer;
  function store() {
    try { localStorage.setItem(storageKey, JSON.stringify({fontSize,theme:palette,bookmark})); } catch {}
  }
  function headerOffset() { return tools.getBoundingClientRect().height + 24; }
  function appearance() {
    root.dataset.theme = palette;
    root.style.setProperty('--book-size', `${fontSize}px`);
    root.style.setProperty('--reader-offset', `${headerOffset()}px`);
    document.getElementById('font-size').textContent = `${fontSize}px`;
    fontDown.disabled = fontSize <= 16;
    fontUp.disabled = fontSize >= 26;
    theme.value = palette;
  }
  function targetFromHash() {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return null; }
    return id && document.getElementById(id);
  }
  function sectionIndex(target) {
    return target ? sections.indexOf(target.closest('.book-section')) : -1;
  }
  function markCurrent() {
    links.forEach(link => {
      const current = decodeURIComponent(link.hash.slice(1)) === headings[active]?.id;
      if (current) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    previous.disabled = active === 0;
    next.disabled = active === sections.length - 1;
    position.textContent = `${active + 1} / ${sections.length}`;
    status.textContent = `이북 · 장별 읽기 — ${headings[active].textContent}`;
  }
  function renderMode() {
    root.classList.toggle('ebook', ebook);
    modeButton.setAttribute('aria-pressed', String(ebook));
    modeButton.textContent = ebook ? '전체 읽기로' : '이북 모드';
    sections.forEach((section, index) => { section.hidden = ebook && index !== active; });
    document.querySelector('.chapter-controls').hidden = !ebook;
    status.hidden = !ebook;
    markCurrent();
  }
  function findCurrent() {
    if (ebook) return active;
    let index = 0;
    headings.forEach((heading, i) => { if (heading.getBoundingClientRect().top <= headerOffset() + 40) index = i; });
    return index;
  }
  function savePlace() {
    if (savingPaused) return;
    active = findCurrent();
    markCurrent();
    if (!tracking) return;
    const section = sections[active];
    const rect = section.getBoundingClientRect();
    const fraction = Math.max(0,Math.min(1,(headerOffset()-rect.top)/Math.max(1,rect.height)));
    bookmark = {id:headings[active].id, fraction};
    store();
    resumeButton.hidden = false;
  }
  function jump(target, fraction = null, focus = true) {
    savingPaused = true;
    requestAnimationFrame(() => {
      const rect = target.getBoundingClientRect();
      const within = fraction === null ? 0 : rect.height * Math.max(0,Math.min(1,Number(fraction)||0));
      window.scrollTo({top:window.scrollY + rect.top + within - headerOffset(),behavior:'instant'});
      if (focus) { article.focus({preventScroll:true}); }
      requestAnimationFrame(() => { savingPaused = false; savePlace(); });
    });
  }
  function showSection(index, target = headings[index]) {
    if (index < 0 || index >= sections.length) return;
    tracking = true;
    active = index;
    renderMode();
    const url = new URL(location.href);
    url.hash = target.id;
    history.replaceState(null,'',url);
    if (matchMedia('(max-width:900px)').matches) toc.open = false;
    jump(target);
  }
  tools.hidden = false;
  const mobileLayout = matchMedia('(max-width:900px)');
  toc.open = !mobileLayout.matches;
  mobileLayout.addEventListener('change', event => { toc.open = !event.matches; });
  appearance();
  const initialTarget = targetFromHash();
  const initialIndex = sectionIndex(initialTarget);
  active = initialIndex >= 0 ? initialIndex : (ebook ? 1 : 0);
  renderMode();
  resumeButton.hidden = !bookmark;
  if (initialIndex >= 0 || ebook) jump(initialTarget || headings[active], null, false);

  modeButton.addEventListener('click', () => {
    tracking = true;
    // Preserve the selected/current section even if focusing the sticky toolbar
    // scrolls the document before the click is delivered.
    const rect = sections[active].getBoundingClientRect();
    const fraction = Math.max(0,Math.min(1,(headerOffset()-rect.top)/Math.max(1,rect.height)));
    savingPaused = true;
    ebook = !ebook;
    const url = new URL(location.href);
    if (ebook) url.searchParams.set('mode','ebook'); else url.searchParams.delete('mode');
    history.replaceState(null,'',url);
    renderMode();
    jump(sections[active], fraction);
  });
  previous.addEventListener('click', () => showSection(active - 1));
  next.addEventListener('click', () => showSection(active + 1));
  resumeButton.addEventListener('click', () => {
    if (!bookmark) return;
    const remembered = {...bookmark};
    tracking = true;
    active = headings.findIndex(h => h.id === remembered.id);
    renderMode();
    const url = new URL(location.href); url.hash = remembered.id; history.replaceState(null,'',url);
    if (matchMedia('(max-width:900px)').matches) toc.open = false;
    jump(sections[active], remembered.fraction);
  });
  function resizeFont(delta) {
    const index = active;
    const rect = sections[index].getBoundingClientRect();
    const fraction = Math.max(0,(headerOffset()-rect.top)/Math.max(1,rect.height));
    fontSize = Math.max(16,Math.min(26,fontSize + delta));
    appearance();store();jump(sections[index],fraction,false);
  }
  fontDown.addEventListener('click', () => resizeFont(-1));
  fontUp.addEventListener('click', () => resizeFont(1));
  theme.addEventListener('change', () => { palette = theme.value;appearance();store(); });
  document.querySelectorAll('a[href="#book-toc"]').forEach(link => link.addEventListener('click', () => { toc.open = true; }));
  links.forEach(link => link.addEventListener('click', event => {
    const target = document.getElementById(decodeURIComponent(link.hash.slice(1)));
    const index = sectionIndex(target);
    if (index < 0) return;
    event.preventDefault();showSection(index,target);
  }));
  addEventListener('hashchange', () => {
    const target = targetFromHash(); const index = sectionIndex(target);
    if (index >= 0) {active=index;renderMode();jump(target);}
  });
  addEventListener('scroll', () => { clearTimeout(timer);timer=setTimeout(savePlace,180); },{passive:true});
  addEventListener('resize', appearance);
  addEventListener('pagehide', savePlace);
  addEventListener('wheel', () => { tracking = true; },{passive:true});
  addEventListener('touchmove', () => { tracking = true; },{passive:true});
  addEventListener('keydown', event => {
    if (['PageDown','PageUp','ArrowDown','ArrowUp',' '].includes(event.key)) tracking = true;
    if (!ebook || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.target.closest('button,a,select,input,textarea,summary,[contenteditable]')) return;
    if (event.key === 'ArrowRight' && active < sections.length-1) {event.preventDefault();showSection(active+1);}
    if (event.key === 'ArrowLeft' && active > 0) {event.preventDefault();showSection(active-1);}
  });
})();
