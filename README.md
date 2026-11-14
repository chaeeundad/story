# mino.

An independent personal writing archive powered by Astro and GitHub Pages.

## Local development

```sh
npm install
npm run dev
npm run build
```

## Publishing

Write new articles as Markdown under `src/content/blog/` and push to `main`. GitHub Actions builds and deploys the website.

The first long-form article is preserved at `public/essays/why-we-work/index.html` as the original standalone HTML edition.

## GitHub Pages

Set **Settings → Pages → Source → GitHub Actions**. Configure the custom domain `mino.co.kr` and set DNS records following GitHub's official documentation: https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site

Do not enable forced HTTPS until the certificate has been issued. GitHub Pages will provision HTTPS after domain verification.

## Anonymous reactions

The standalone essay uses `GET /api/reactions?slug=why-we-work` to read the
count and `PUT` with `{"liked":true}` or `{"liked":false}` to set a reaction.
Only the explicitly registered essay is accepted. Copy/share buttons are unchanged.
Previous local-only likes are not silently imported into the shared count.

### Deployment

GitHub Actions uses the existing `CLOUDFLARE_API_TOKEN`,
`CLOUDFLARE_ACCOUNT_ID`, and `CLOUDFLARE_D1_DATABASE_ID` repository secrets.
The database's dashboard name does not need to match the local binding name `DB`;
the supplied database ID selects the existing database.
The token needs account **Workers Scripts: Edit**, **D1: Edit**, and zone
**Workers Routes: Edit** plus **Zone: Read** for `mino.co.kr`.
The domain must be in that Cloudflare account, and its DNS record must be proxied
(orange cloud). The existing GitHub Pages origin remains in place; only
`mino.co.kr/api/reactions*` is routed to the Worker. Use Full (strict) TLS once the
GitHub Pages origin certificate is valid. No DNS settings are modified by this repo.

On `main`, Actions tests and builds, applies D1 migrations, deploys the Worker,
checks the public API without adding a like, then deploys GitHub Pages. Pull
requests run validation without production credentials or mutations. A failed API
check blocks the new frontend deployment. Manual runs deploy only from `main`.

`wrangler.deploy.json` is generated in CI and ignored by Git. No secret values
belong in source, frontend assets, workflow command arguments, or logs.
The cookie signing key is generated once inside D1 by the first migration; it is
never returned by the API. Restrict D1 administrator access and backups accordingly.
Do not rerun the initial SQL manually or replace the signing key on each deploy.
Wrangler tracks applied migrations. Back up D1 before future destructive migrations.

### Security and limits

A server-issued, signed, Secure/HttpOnly/SameSite=Strict host-only cookie identifies
an anonymous browser for one year. A database primary key prevents duplicate likes,
including concurrent retries; triggers maintain the count in the same transaction.
PUT sets a desired state instead of toggling, so retransmission is idempotent.
Cross-site mutations, unsigned cookies, unknown slugs, and bodies over 256 bytes
are rejected. API responses are never cached.

Cloudflare's trusted connecting IP is HMAC-pseudonymized with a daily namespace;
raw IPs are not stored. Global D1 fixed-window counters allow 120 requests/minute,
30 writes/minute and 200 writes/day per IP, shared across cookies and edge locations.
A daily scheduled job removes expired counters (up to roughly 48 hours retention).
Shared networks share those limits. Fixed-window boundaries can admit short bursts.
Rate limits still require D1 operations; use Cloudflare WAF rules for volumetric abuse.
Anonymous cookies are not proof of a unique person: clearing cookies, private
browsing or changing devices can create another identity, subject to IP limits.
Stronger person-level protection would require login or an additional challenge.

### Local validation

Use Node 24 and `npm ci`, then `npm test`, `npm run check`, `npm run build`, and
`npm run reactions:bundle`. Tests run the real Worker and migration against an
isolated Miniflare D1 database, with no Cloudflare credentials.
For manual API development, run `npm run reactions:migrate:local` then
`npm run reactions:dev`. The production Secure cookie and origin policy are
intentional; a plain HTTP Astro preview alone does not provide the reactions API.
To roll back UI/Worker code, redeploy the previous revision without dropping the
D1 tables; preserve the data and signing key.
