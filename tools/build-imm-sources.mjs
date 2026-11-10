// Builds sources/imm.json from the live IMM insights pages so the daily generator only uses published IMM facts.
// Run in GitHub Actions (needs open internet): node tools/build-imm-sources.mjs
import fs from 'node:fs';
import { parse } from 'node-html-parser';

const BASE = 'https://imedmanagement.com.au';
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; IMM-social-sources/1.0; +https://imedmanagement.com.au)' };
const clean = (t) => String(t || '').replace(/\s+/g, ' ').trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const index = parse(await (await fetch(`${BASE}/insights`, { headers: UA })).text());
const slugs = [...new Set(index.querySelectorAll('a').map((a) => (a.getAttribute('href') || '').replace(BASE, ''))
  .filter((h) => /^\/insights\/[a-z0-9-]+\/?$/.test(h)).map((h) => h.replace('/insights/', '').replace(/\/$/, '')))];
console.log('slugs', slugs.length);

const articles = [];
for (const slug of slugs) {
  try {
    const res = await fetch(`${BASE}/insights/${slug}`, { headers: UA });
    if (!res.ok) { console.log('skip', slug, res.status); continue; }
    const doc = parse(await res.text());
    const root = doc.querySelector('article') || doc.querySelector('main') || doc;
    root.querySelectorAll('script,style,nav,footer,form,aside').forEach((n) => n.remove());
    const title = clean(doc.querySelector('h1')?.text) || clean(doc.querySelector('title')?.text);
    const description = clean(doc.querySelector('meta[name="description"]')?.getAttribute('content'));
    const headings = root.querySelectorAll('h2').map((h) => clean(h.text)).filter(Boolean).slice(0, 12);
    const paras = root.querySelectorAll('p,li').map((p) => clean(p.text)).filter((t) => t.length > 40);
    let body = ''; for (const p of paras) { if (body.length > 3500) break; body += p + '\n'; }
    const published = clean(doc.querySelector('time')?.getAttribute('datetime') || doc.querySelector('meta[property="article:published_time"]')?.getAttribute('content'));
    articles.push({ slug, url: `${BASE}/insights/${slug}`, title, description, published: published || null, headings, body: body.trim() });
  } catch (e) { console.log('fail', slug, String(e).slice(0, 120)); }
  await sleep(250);
}
fs.mkdirSync('sources', { recursive: true });
fs.writeFileSync('sources/imm.json', JSON.stringify({ built: new Date().toISOString(), source: `${BASE}/insights`, count: articles.length, articles }, null, 1) + '\n');
console.log('articles', articles.length);
if (articles.length < 50) process.exit(1);
