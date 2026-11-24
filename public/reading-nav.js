/* Enhance the original TOC without replacing its links or native anchors. */
(() => {
  const toc = document.querySelector('.toc');
  if (!toc) return;
  const entries = [...toc.querySelectorAll('a[href^="#"]')]
    .map(link => ({link, target: document.getElementById(link.hash.slice(1))}))
    .filter(entry => entry.target);
  let pending = false;
  let current;
  function update() {
    pending = false;
    let active;
    for (const entry of entries) {
      if (entry.target.getBoundingClientRect().top <= 100) active = entry;
    }
    if (active === current) return;
    current?.link.removeAttribute('aria-current');
    active?.link.setAttribute('aria-current', 'location');
    current = active;
  }
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(update);
  }
  addEventListener('scroll', schedule, {passive: true});
  addEventListener('resize', schedule);
  addEventListener('hashchange', schedule);
  addEventListener('pageshow', schedule);
  addEventListener('load', schedule);
  const article = document.getElementById('article');
  if (article && 'ResizeObserver' in window) new ResizeObserver(schedule).observe(article);
  schedule();
})();
