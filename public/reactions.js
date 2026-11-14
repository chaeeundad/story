(() => {
  const button = document.getElementById('reaction-like');
  if (!button) return;
  const label = button.querySelector('.reaction-label');
  const icon = button.querySelector('span');
  const note = document.getElementById('reaction-note');
  const slug = location.pathname.includes('/why-children-study/') ? 'why-children-study' : 'why-we-work';
  const endpoint = '/api/reactions?slug=' + encodeURIComponent(slug);
  let liked = false;
  let ready = false;
  let busy = false;
  function render(state) {
    liked = state.liked;
    button.setAttribute('aria-pressed', String(liked));
    label.textContent = `${liked ? '공감했어요' : '공감하기'} · ${state.count}`;
    icon.textContent = liked ? '♥' : '♡';
  }
  async function request(method, body) {
    const response = await fetch(endpoint, {
      method, credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(10000),
      ...(body ? {headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)} : {}),
    });
    if (!response.ok) throw new Error(response.status === 429 ? '잠시 후 다시 시도해 주세요.' :
      response.status === 401 ? '공감을 저장하려면 쿠키를 허용한 뒤 새로고침해 주세요.' : '공감을 불러오거나 저장하지 못했어요. 다시 시도해 주세요.');
    const state = await response.json();
    if (!Number.isSafeInteger(state.count) || state.count < 0 || typeof state.liked !== 'boolean') throw new Error('공감 정보를 확인하지 못했어요. 다시 시도해 주세요.');
    return state;
  }
  async function sync(change = false) {
    if (busy) return;
    busy = true;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    try {
      if (!ready) { render(await request('GET')); ready = true; }
      if (change) render(await request('PUT', {liked: !liked}));
      note.textContent = liked ? '공감해 주셔서 감사합니다.' : '공감은 익명으로 집계됩니다.';
    } catch (error) {
      // A timed-out write may have committed. Re-read before the next change.
      ready = false;
      note.textContent = error.name === 'TimeoutError' ? '응답이 늦어지고 있어요. 다시 시도해 주세요.' : error.message;
    } finally {
      busy = false;
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  }
  button.addEventListener('click', () => sync(true));
  sync();
})();
