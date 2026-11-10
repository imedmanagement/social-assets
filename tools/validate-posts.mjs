// Checks posts.json before anything is pushed. Exit code 1 lists every problem.
// Usage: node tools/validate-posts.mjs [--check-images]
import fs from 'node:fs';

const REPO = JSON.parse(fs.readFileSync('repo.json', 'utf8'));
const { posts } = JSON.parse(fs.readFileSync('posts.json', 'utf8'));
const checkImages = process.argv.includes('--check-images');
const problems = [];
const bad = (p, msg) => problems.push(`${p.date} ${p.post}: ${msg}`);
const URL_RE = /https?:\/\/|www\.|\b[a-z0-9-]+\.(com|com\.au|au|org|net)\b/i;
const DASH_RE = /[\u2013\u2014]/;

const seen = new Set();
for (const p of posts) {
  const key = `${p.date}|${p.post}`;
  if (seen.has(key)) bad(p, 'duplicate entry'); seen.add(key);
  for (const f of ['date', 'post', 'brand', 'card', 'story', 'facebook', 'linkedin', 'instagram', 'first_comment']) if (!p[f]) bad(p, `missing ${f}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date || '')) bad(p, 'bad date');
  else if (new Date(p.date + 'T00:00:00Z').getUTCDay() === 0) bad(p, 'Sunday');
  const brand = REPO.brands[p.brand];
  if (!brand) { bad(p, `brand ${p.brand} does not belong in this repo`); continue; }
  if (p.facebook?.account !== brand.facebook) bad(p, 'wrong Facebook account for brand');
  if (p.linkedin?.account !== brand.linkedin) bad(p, 'wrong LinkedIn account for brand');
  if (p.instagram?.account !== brand.instagram) bad(p, 'wrong Instagram account for brand');
  const texts = { 'facebook caption': p.facebook?.caption, 'linkedin commentary': p.linkedin?.commentary, 'instagram caption': p.instagram?.caption };
  for (const [name, t] of Object.entries(texts)) {
    if (!t) continue;
    if (DASH_RE.test(t)) bad(p, `${name} has an en or em dash`);
    if (URL_RE.test(t.replace(/#\w+/g, ''))) bad(p, `${name} contains a link or domain (links go in the first comment)`);
    for (const w of REPO.forbidden_terms) if (t.toLowerCase().includes(w.toLowerCase())) bad(p, `${name} mentions "${w}"`);
    for (const w of brand.forbidden_terms || []) if (t.toLowerCase().includes(w.toLowerCase())) bad(p, `${name} mentions "${w}"`);
  }
  if ((p.linkedin?.commentary || '').length > 3000) bad(p, 'LinkedIn over 3000 characters');
  if ((p.instagram?.caption || '').length > 2200) bad(p, 'Instagram over 2200 characters');
  if (((p.instagram?.caption || '').match(/#/g) || []).length > 30) bad(p, 'more than 30 hashtags');
  if (DASH_RE.test(p.first_comment || '')) bad(p, 'first comment has an en or em dash');
  if (!(p.first_comment || '').includes(brand.link_prefix)) bad(p, `first comment must link to ${brand.link_prefix}`);
  for (const w of REPO.forbidden_terms) if ((p.first_comment || '').toLowerCase().includes(w.toLowerCase())) bad(p, `first comment mentions "${w}"`);
  if (brand.required_consumer_line && !(p.facebook?.caption || '').includes(brand.required_consumer_line)) bad(p, 'Facebook caption missing the prescriber safety line');
  if (brand.required_consumer_line && !(p.instagram?.caption || '').includes(brand.required_consumer_line)) bad(p, 'Instagram caption missing the prescriber safety line');
  if (REPO.offer_end && p.date > REPO.offer_end && /LAUNCH50|launch offer|half price|50% off/i.test(JSON.stringify(p))) bad(p, 'mentions the launch offer after it ended');
  const base = `https://raw.githubusercontent.com/${REPO.repo}/main/`;
  if (!(p.card || '').startsWith(base + 'cards/') || !(p.story || '').startsWith(base + 'stories/')) bad(p, 'card or story URL is not in this repo');
  if (checkImages) {
    for (const u of [p.card, p.story]) { const f = (u || '').replace(base, ''); if (!fs.existsSync(f)) bad(p, `image not rendered yet: ${f}`); }
  }
}
if (problems.length) { console.log(problems.join('\n')); console.log(`${problems.length} problem(s)`); process.exit(1); }
console.log(`posts.json OK (${posts.length} entries)`);
