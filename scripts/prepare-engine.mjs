import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import https from 'node:https';

const wheel = JSON.parse(await readFile(new URL('../engine/wheel.json', import.meta.url)));
const directory = new URL('../engine/vendor/', import.meta.url);
const path = new URL(wheel.filename, directory);
const valid = (bytes) => createHash('sha256').update(bytes).digest('hex') === wheel.sha256;
try {
  if (valid(await readFile(path))) { console.log('Verified engine wheel already present.'); process.exit(0); }
} catch (error) { if (error.code !== 'ENOENT') throw error; }
const bytes = await new Promise((resolve, reject) => {
  https.get(wheel.url, { agent: new https.Agent({ proxyEnv: process.env }) }, (response) => {
    if (response.statusCode !== 200) return reject(new Error(`Wheel download returned ${response.statusCode}`));
    const chunks = [];
    response.on('data', (chunk) => chunks.push(chunk));
    response.on('end', () => resolve(Buffer.concat(chunks)));
    response.on('error', reject);
  }).on('error', reject);
});
if (!valid(bytes)) throw new Error('Pillow checksum mismatch. Refusing to install.');
await mkdir(directory, { recursive: true });
await writeFile(path, bytes);
console.log('Downloaded and SHA-256 verified Pillow wheel.');
