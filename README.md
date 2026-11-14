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
