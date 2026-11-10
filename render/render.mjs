// Renders every job in specs/*.json to cards/<id>.jpg (1080x1350) and stories/<id>.jpg (1080x1920).
// Skips jobs whose files already exist unless FORCE=1. Writes stories/index.json as a manifest.
// Usage: node render/render.mjs   (CI=true uses the runner's installed Chrome)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FORCE = process.env.FORCE === '1';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

let chromium;
try { ({ chromium } = await import('playwright-core')); } catch { ({ chromium } = createRequire(import.meta.url)('playwright')); }
const browser = await chromium.launch(process.env.CI ? { channel: 'chrome' } : {});
const page = await browser.newPage();
page.on('console', (m) => { if (m.type() === 'error') console.log('page:', m.text()); });
await page.goto(`${base}/render/index.html`);

const jobs = fs.readdirSync(path.join(ROOT, 'specs')).filter((f) => f.endsWith('.json')).sort()
  .flatMap((f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'specs', f), 'utf8')).jobs);
fs.mkdirSync(path.join(ROOT, 'cards'), { recursive: true });
fs.mkdirSync(path.join(ROOT, 'stories'), { recursive: true });

let failed = 0;
for (const job of jobs) {
  if (ONLY && !ONLY.includes(job.id)) continue;
  const cardFile = path.join(ROOT, 'cards', `${job.id}.jpg`), storyFile = path.join(ROOT, 'stories', `${job.id}.jpg`);
  if (!FORCE && fs.existsSync(cardFile) && (!job.story || fs.existsSync(storyFile))) { console.log('skip', job.id); continue; }
  try {
    const out = await page.evaluate((j) => window.renderJob(j), job);
    fs.writeFileSync(cardFile, Buffer.from(out.card, 'base64'));
    if (out.story) fs.writeFileSync(storyFile, Buffer.from(out.story, 'base64'));
    console.log('ok  ', job.id);
  } catch (e) {
    failed++; console.log('FAIL', job.id, String(e).split('\n')[0]);
  }
}

const RAW = 'https://raw.githubusercontent.com/imedmanagement/social-assets/main';
const manifest = jobs.filter((j) => fs.existsSync(path.join(ROOT, 'cards', `${j.id}.jpg`))).map((j) => ({
  id: j.id, date: j.date, brand: j.brand, instagram: j.instagram,
  card: `${RAW}/cards/${j.id}.jpg`,
  story: j.story && fs.existsSync(path.join(ROOT, 'stories', `${j.id}.jpg`)) ? `${RAW}/stories/${j.id}.jpg` : null
}));
fs.writeFileSync(path.join(ROOT, 'stories', 'index.json'), JSON.stringify(manifest, null, 2) + '\n');

await browser.close(); server.close();
console.log(`${jobs.length} jobs, ${failed} failed`);
if (failed && process.env.CI) process.exit(1);
