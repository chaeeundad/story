// Read-only: no synthetic likes in the production database; never print cookies.
for (let attempt = 0; attempt < 6; attempt++) {
  try {
    const response = await fetch('https://mino.co.kr/api/reactions?slug=why-we-work', {
      signal: AbortSignal.timeout(10000), headers: {Origin: 'https://mino.co.kr'},
    });
    const state = await response.json();
    if (response.ok && Number.isSafeInteger(state.count) && state.count >= 0 && typeof state.liked === 'boolean') {
      console.log('Reactions API is ready.');
      process.exit(0);
    }
  } catch { /* DNS and route propagation can take a few seconds. */ }
  await new Promise(resolve => setTimeout(resolve, 10000));
}
throw new Error('Public reactions API is unavailable. Check Cloudflare proxy DNS, route and token permissions.');
