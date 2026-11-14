import {readFile, writeFile} from 'node:fs/promises';
const id = process.env.CLOUDFLARE_D1_DATABASE_ID;
if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id || '')) {
  throw new Error('CLOUDFLARE_D1_DATABASE_ID is missing or invalid');
}
const config = JSON.parse(await readFile('workers/reactions/wrangler.json', 'utf8'));
config.d1_databases[0].database_id = id;
await writeFile('workers/reactions/wrangler.deploy.json', JSON.stringify(config, null, 2));
