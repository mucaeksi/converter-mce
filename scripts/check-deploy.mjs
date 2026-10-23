import { readFileSync } from 'node:fs';
const config = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url)));
const missing = [];
if (!process.env.CLOUDFLARE_API_TOKEN) missing.push('CLOUDFLARE_API_TOKEN (secure environment settings)');
if (!process.env.CLOUDFLARE_ACCOUNT_ID) missing.push('CLOUDFLARE_ACCOUNT_ID');
if (!config.d1_databases[0].database_id) missing.push('real D1 database_id in wrangler.jsonc');
if (missing.length) { console.error('Deployment prerequisites missing:\n- ' + missing.join('\n- ')); process.exit(1); }
if (config.vars.APP_ENV !== 'production') throw new Error('Production deployment must not enable local authentication.');
console.log('Deployment prerequisites present.');
