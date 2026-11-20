// Read-only: no synthetic likes in the production database; never print cookies.
const requiredSlugs = ['why-we-work', 'why-children-study', 'why-go-fishing', 'does-humanity-need-to-work', 'we-built-what-we-do-not-understand', 'why-we-still-build', 'why-we-need-each-other', 'when-we-accept-the-world-we-made'];
for (let attempt = 0; attempt < 6; attempt++) {
  try {
    const responses = await Promise.all(requiredSlugs.map(async slug => {
      const response = await fetch('https://mino.co.kr/api/reactions?slug=' + encodeURIComponent(slug), {
        signal: AbortSignal.timeout(10000), headers: {Origin: 'https://mino.co.kr'},
      });
      const state = await response.json();
      return response.ok && Number.isSafeInteger(state.count) && state.count >= 0 && typeof state.liked === 'boolean';
    }));
    if (responses.every(Boolean)) {
      console.log('Reactions API is ready for all essays.');
      process.exit(0);
    }
  } catch { /* DNS and route propagation can take a few seconds. */ }
  await new Promise(resolve => setTimeout(resolve, 10000));
}
throw new Error('Public reactions API is unavailable. Check Cloudflare proxy DNS, route and token permissions.');
