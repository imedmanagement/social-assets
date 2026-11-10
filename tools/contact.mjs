// Renders review/contact.jpg: every photo in photos.json as a labelled thumbnail, for a visual check.
import fs from 'node:fs';
import { createRequire } from 'node:module';
let chromium; try { ({ chromium } = await import('playwright-core')); } catch { ({ chromium } = createRequire(import.meta.url)('playwright')); }
const lib = JSON.parse(fs.readFileSync('photos.json', 'utf8'));
const items = Object.entries(lib.tags).flatMap(([tag, ids]) => ids.map((id) => ({ tag, id })));
const browser = await chromium.launch(process.env.CI ? { channel: 'chrome' } : {});
const page = await browser.newPage();
const b64 = await page.evaluate(async (items) => {
  const TW = 240, TH = 180, COLS = 10, LAB = 26, rows = Math.ceil(items.length / COLS);
  const cv = document.createElement('canvas'); cv.width = COLS * TW; cv.height = rows * (TH + LAB); const ctx = cv.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.font = '600 15px sans-serif';
  await Promise.all(items.map((it, i) => new Promise((res) => {
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => { const x = (i % COLS) * TW, y = Math.floor(i / COLS) * (TH + LAB); const s = Math.max(TW / img.width, TH / img.height); const sw = TW / s, sh = TH / s; ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, TW - 4, TH); ctx.fillStyle = '#000'; ctx.fillText(`${it.tag} ${it.id}`, x + 4, y + TH + 18); res(); };
    img.onerror = () => { const x = (i % COLS) * TW, y = Math.floor(i / COLS) * (TH + LAB); ctx.fillStyle = '#c00'; ctx.fillText(`MISSING ${it.id}`, x + 4, y + 40); res(); };
    img.src = `https://images.pexels.com/photos/${it.id}/pexels-photo-${it.id}.jpeg?auto=compress&cs=tinysrgb&w=400`;
  })));
  return cv.toDataURL('image/jpeg', 0.8).split(',')[1];
}, items);
fs.mkdirSync('review', { recursive: true });
fs.writeFileSync('review/contact.jpg', Buffer.from(b64, 'base64'));
await browser.close();
console.log('contact sheet', items.length);
