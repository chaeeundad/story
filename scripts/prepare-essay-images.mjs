import sharp from 'sharp';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
const file = new URL('../src/data/essay-illustrations.json', import.meta.url);
const manifest = JSON.parse(await readFile(file, 'utf8'));
const root = new URL('../', import.meta.url);
await mkdir(new URL('public/images/essays/', root), {recursive: true});
for (const [id, asset] of Object.entries(manifest.assets)) {
  const source = new URL(asset.source, root);
  const image = sharp(await readFile(source));
  const original = await image.metadata();
  const width = Math.min(1280, original.width);
  const smallWidth = Math.min(480, width);
  const stem = `book-${id.padStart(2, '0')}`;
  const variants = [[`${stem}.webp`, width, 'webp'], [`${stem}-small.webp`, smallWidth, 'webp'], [`${stem}.jpg`, width, 'jpeg']];
  for (const [name, size, format] of variants) {
    await image.clone().resize({width: size, withoutEnlargement: true})
      .toFormat(format, {quality: format === 'webp' ? 82 : 85})
      .toFile(new URL(`public/images/essays/${name}`, root).pathname);
  }
  Object.assign(asset, {src: `/images/essays/${stem}.webp`, small: `/images/essays/${stem}-small.webp`,
    social: `/images/essays/${stem}.jpg`, width, height: Math.round(original.height * width / original.width), smallWidth});
}
await writeFile(file, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Prepared ${Object.keys(manifest.assets).length} illustrations without cropping or upscaling.`);
