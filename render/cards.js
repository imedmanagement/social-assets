// Canvas renderers for IMM and IMM Academy social images.
// Feed cards are 1080 x 1350 (4:5). Stories are 1080 x 1920 (9:16), keeping 150px clear at the top and 250px at the bottom.
// Fonts and brand images are served from ../assets so the output does not depend on the brand websites.
(() => {
  const ASSETS = '../assets';
  const pexels = (id) => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1600`;
  const load = (src) => new Promise((res, rej) => {
    const i = new Image(); i.crossOrigin = 'anonymous';
    i.onload = () => res(i); i.onerror = () => rej(new Error('image failed: ' + src)); i.src = src;
  });
  const photoUrl = (p) => (String(p).startsWith('pexels:') ? pexels(String(p).slice(7)) : p);
  async function fonts() {
    if (window.__fontsReady) return;
    const faces = ['400 40px BrandSerif', 'italic 400 40px BrandSerif', '400 40px BrandSans', '500 40px BrandSans', '600 40px BrandSans', '700 40px BrandSans'];
    await Promise.all(faces.map((f) => document.fonts.load(f)));
    for (const f of faces) if (!document.fonts.check(f)) throw new Error('font not loaded: ' + f);
    window.__fontsReady = true;
  }
  function wrap(ctx, text, maxW) { const ws = text.split(/\s+/); const ls = []; let cur = ''; for (const w of ws) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { ls.push(cur); cur = w; } else cur = t; } if (cur) ls.push(cur); return ls; }
  function rich(ctx, text, size, maxW) {
    const toks = []; let it = false;
    text.split(/(\*)/).forEach((p) => { if (p === '*') { it = !it; return; } p.split(/\s+/).filter(Boolean).forEach((w) => toks.push({ w, it })); });
    const lines = []; let line = [], lw = 0; ctx.font = `400 ${size}px BrandSerif`; const sp = ctx.measureText(' ').width;
    for (const t of toks) { ctx.font = `${t.it ? 'italic ' : ''}400 ${size}px BrandSerif`; const ww = ctx.measureText(t.w).width; if (line.length && lw + sp + ww > maxW) { lines.push(line); line = []; lw = 0; } line.push({ ...t, ww }); lw += (line.length > 1 ? sp : 0) + ww; }
    if (line.length) lines.push(line); return { lines, sp };
  }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function cover(ctx, img, x, y, w, h, fx = 0.5, fy = 0.5) { const s = Math.max(w / img.naturalWidth, h / img.naturalHeight); const sw = w / s, sh = h / s; ctx.drawImage(img, (img.naturalWidth - sw) * fx, (img.naturalHeight - sh) * fy, sw, sh, x, y, w, h); }
  const toBlob = (cv) => new Promise((r) => cv.toBlob(r, 'image/jpeg', 0.92));
  // Layout guard: every box must hold its text and nothing may pass the card edges. Problems fail the render.
  let PROBLEMS = [];
  const check = (ok, msg) => { if (!ok) PROBLEMS.push(msg); };

  // IMM: full-bleed greyscale photo with navy tint, lighter at the top, solid navy lower half, stat panel, navy footer.
  async function imm(c) {
    const W = 1080, H = 1350, PH = 1200, FOOT = 150, PAD = 88;
    await fonts();
    const logo = await load(`${ASSETS}/imm/logo-white.png`);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d');
    ctx.fillStyle = '#06152e'; ctx.fillRect(0, 0, W, H);
    const img = await load(String(c.photo).startsWith('pexels:') ? photoUrl(c.photo) : `${ASSETS}/imm/photos/${c.photo}`);
    let dw, dh;
    if (c.size) { const pct = parseFloat(c.size.split(' ')[1]) / 100; dh = PH * pct; dw = img.naturalWidth * dh / img.naturalHeight; if (dw < W) { dw = W; dh = img.naturalHeight * W / img.naturalWidth; } }
    else { const s = Math.max(W / img.naturalWidth, PH / img.naturalHeight); dw = img.naturalWidth * s; dh = img.naturalHeight * s; }
    const [px, py] = (c.pos || '50% 50%').split(' ').map((v) => (v === 'center' ? 0.5 : parseFloat(v) / 100));
    const dx = (W - dw) * (isNaN(px) ? 0.5 : px), dy = (PH - dh) * (py === undefined || isNaN(py) ? 0.5 : py);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, PH); ctx.clip();
    ctx.filter = 'grayscale(1) contrast(1.3) brightness(1.12)'; ctx.drawImage(img, dx, dy, dw, dh); ctx.filter = 'none';
    ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.38; ctx.fillStyle = '#0a1f44'; ctx.fillRect(0, 0, W, PH);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    const g = ctx.createLinearGradient(0, 0, 0, PH);
    [[0, 0], [0.24, 0.06], [0.38, 0.42], [0.49, 0.78], [0.57, 0.95], [0.63, 1], [1, 1]].forEach(([o, a]) => g.addColorStop(o, `rgba(10,31,68,${a})`));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, PH); ctx.restore();
    let panelBottom = 0;
    if (c.stat) {
      // The panel always grows to fit its text; the big figure shrinks only if it would pass the card's side margin.
      const INNER_MAX = W - PAD * 2 - 64;
      let bs = 84; ctx.font = `400 ${bs}px BrandSerif`;
      while (ctx.measureText(c.stat[0]).width > INNER_MAX && bs > 48) { bs -= 2; ctx.font = `400 ${bs}px BrandSerif`; }
      const bigW = ctx.measureText(c.stat[0]).width;
      ctx.font = '500 24px BrandSans'; let labMax = Math.min(INNER_MAX, Math.max(366, bigW)), lab = wrap(ctx, c.stat[1], labMax);
      while (lab.length > 3 && labMax < INNER_MAX) { labMax = Math.min(INNER_MAX, labMax + 40); lab = wrap(ctx, c.stat[1], labMax); }
      const labW = Math.max(...lab.map((l) => ctx.measureText(l).width));
      const bw = Math.max(bigW, labW) + 64, bigH = Math.round(bs * 0.95), bh = 26 + bigH + 10 + lab.length * 31 + 24;
      check(bigW <= INNER_MAX && labW <= INNER_MAX, `stat panel text wider than the card ("${c.stat[0]}")`);
      check(lab.length <= 3, 'stat label longer than 3 lines');
      rr(ctx, PAD, 88, bw, bh, 18); ctx.fillStyle = 'rgba(6,21,46,0.78)'; ctx.fill(); ctx.strokeStyle = 'rgba(197,206,228,0.35)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.font = `400 ${bs}px BrandSerif`; ctx.fillText(c.stat[0], PAD + 32, 88 + 26 + Math.round(bs * 0.79));
      ctx.fillStyle = '#dbe3f3'; ctx.font = '500 24px BrandSans'; lab.forEach((l, i) => ctx.fillText(l, PAD + 32, 88 + 26 + bigH + 10 + 22 + i * 31));
      panelBottom = 88 + bh;
    }
    ctx.font = '400 31px BrandSans'; const sub = c.sub ? wrap(ctx, c.sub, 880) : [];
    const subH = sub.length ? 30 + sub.length * 31 * 1.42 : 0;
    // Headline shrinks (down to 64px) rather than run into the stat panel or past 3 lines.
    let hs = c.hs || 88, lh, head, y;
    for (;;) {
      lh = hs * 1.04; head = rich(ctx, c.headline, hs, W - PAD * 2);
      y = H - 236 - (29 + 34 + head.lines.length * lh + subH);
      if ((head.lines.length <= 3 && y >= panelBottom + 40) || hs <= 64) break;
      hs -= 4;
    }
    check(head.lines.length <= 3, 'headline longer than 3 lines');
    check(y >= panelBottom + 40, 'headline and subline run into the stat panel');
    check(sub.length <= 3, 'subline longer than 3 lines');
    check(head.lines.every((l) => l.reduce((s, t) => s + t.ww, 0) + (l.length - 1) * head.sp <= W - PAD * 2 + 1), 'a headline line is wider than the card');
    ctx.fillStyle = '#8fa8de'; ctx.fillRect(PAD, y + 13, 56, 3);
    ctx.fillStyle = '#dbe3f3'; ctx.font = '700 24px BrandSans'; ctx.letterSpacing = '4px'; check(ctx.measureText(c.eyebrow.toUpperCase()).width <= W - PAD * 2 - 76, 'eyebrow wider than the card'); ctx.fillText(c.eyebrow.toUpperCase(), PAD + 76, y + 23); ctx.letterSpacing = '0px';
    y += 29 + 34;
    head.lines.forEach((line, i) => { let x = PAD; line.forEach((t) => { ctx.font = `${t.it ? 'italic ' : ''}400 ${hs}px BrandSerif`; ctx.fillStyle = t.it ? '#c5cee4' : '#ffffff'; ctx.fillText(t.w, x, y + i * lh + hs * 0.8); x += t.ww + head.sp; }); });
    y += head.lines.length * lh;
    if (sub.length) { y += 30; ctx.font = '400 31px BrandSans'; ctx.fillStyle = 'rgba(255,255,255,0.92)'; sub.forEach((l, i) => ctx.fillText(l, PAD, y + 31 * 1.42 * i + 31 * 1.05)); }
    ctx.fillStyle = '#06152e'; ctx.fillRect(0, H - FOOT, W, FOOT); ctx.fillStyle = '#0d2150'; ctx.fillRect(0, H - FOOT, W, 2);
    const lh2 = 50, lw2 = logo.naturalWidth * lh2 / logo.naturalHeight; ctx.drawImage(logo, PAD, H - FOOT / 2 - lh2 / 2, lw2, lh2);
    ctx.fillStyle = '#ffffff'; ctx.font = '600 26px BrandSans'; ctx.textAlign = 'right'; ctx.fillText('imedmanagement.com.au', W - PAD, H - FOOT / 2 + 9); ctx.textAlign = 'left';
    return toBlob(cv);
  }

  // IMM Academy: light blue panel, navy serif headline, rounded photo, chips row, navy footer.
  async function academy(c) {
    const W = 1080, H = 1350, FOOT = 150, PAD = 88, NAVY = '#12305A', BLUE = '#2B5CB8', BG = '#EAF0F8';
    await fonts();
    const logo = await load(`${ASSETS}/academy/mark-white.png`);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d');
    ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
    let y = 80;
    if (c.ribbon) {
      ctx.font = '700 22px BrandSans'; ctx.letterSpacing = '3px'; const tw = ctx.measureText(c.ribbon.toUpperCase()).width;
      check(tw + 56 <= W - PAD * 2, 'ribbon wider than the card');
      rr(ctx, PAD, y, tw + 56, 56, 28); ctx.fillStyle = NAVY; ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.fillText(c.ribbon.toUpperCase(), PAD + 28, y + 36); ctx.letterSpacing = '0px';
      y += 56 + 48;
    }
    ctx.fillStyle = BLUE; ctx.fillRect(PAD, y + 9, 56, 3);
    ctx.font = '700 24px BrandSans'; ctx.letterSpacing = '4px'; check(ctx.measureText(c.eyebrow.toUpperCase()).width <= W - PAD * 2 - 76, 'eyebrow wider than the card'); ctx.fillText(c.eyebrow.toUpperCase(), PAD + 76, y + 19); ctx.letterSpacing = '0px';
    y += 24 + 40;
    let hs = c.hs || 78; let head = rich(ctx, c.headline, hs, W - PAD * 2);
    while (head.lines.length > 3 && hs > 56) { hs -= 2; head = rich(ctx, c.headline, hs, W - PAD * 2); }
    check(head.lines.length <= 3, 'headline longer than 3 lines');
    check(head.lines.every((l) => l.reduce((s2, t) => s2 + t.ww, 0) + (l.length - 1) * head.sp <= W - PAD * 2 + 1), 'a headline line is wider than the card');
    head.lines.forEach((line, i) => { let x = PAD; line.forEach((t) => { ctx.font = `${t.it ? 'italic ' : ''}400 ${hs}px BrandSerif`; ctx.fillStyle = t.it ? BLUE : NAVY; ctx.fillText(t.w, x, y + i * hs * 1.04 + hs * 0.8); x += t.ww + head.sp; }); });
    y += head.lines.length * hs * 1.04 + 26;
    ctx.font = '400 30px BrandSans'; ctx.fillStyle = '#3A4A63'; const sub = wrap(ctx, c.sub, W - PAD * 2);
    sub.forEach((l, i) => ctx.fillText(l, PAD, y + 30 + i * 30 * 1.42)); y += sub.length * 30 * 1.42 + 44;
    check(sub.length <= 3, 'subline longer than 3 lines');
    const chipY = H - FOOT - 64 - 56, photoBottom = chipY - 40, ph = Math.max(300, photoBottom - y);
    check(photoBottom - y >= 300, 'text is too long: the photo would overlap it');
    const img = await load(c.photo.startsWith('pexels:') ? photoUrl(c.photo) : `${ASSETS}/academy/${c.photo}`);
    ctx.save(); rr(ctx, PAD, photoBottom - ph, W - PAD * 2, ph, 28); ctx.clip(); cover(ctx, img, PAD, photoBottom - ph, W - PAD * 2, ph, c.fx ?? 0.5, c.fy ?? 0.5); ctx.restore();
    let x = PAD;
    for (const ch of c.chips) {
      if (Array.isArray(ch)) {
        const [label, was, now] = ch; ctx.font = '600 26px BrandSans';
        const t1 = label ? label + ' ' : '', w1 = ctx.measureText(t1).width, w2 = ctx.measureText(was).width, w3 = ctx.measureText(' ' + now).width, w = w1 + w2 + w3 + 48;
        rr(ctx, x, chipY, w, 64, 32); ctx.fillStyle = NAVY; ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.fillText(t1, x + 24, chipY + 42);
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillText(was, x + 24 + w1, chipY + 42); ctx.fillRect(x + 24 + w1, chipY + 33, w2, 2.5);
        ctx.fillStyle = '#ffffff'; ctx.font = '700 26px BrandSans'; ctx.fillText(' ' + now, x + 24 + w1 + w2, chipY + 42);
        x += w + 14;
      } else {
        ctx.font = '600 26px BrandSans'; const w = ctx.measureText(ch).width + 48;
        rr(ctx, x, chipY, w, 64, 32); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.strokeStyle = '#C9D6EA'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = NAVY; ctx.fillText(ch, x + 24, chipY + 42); x += w + 14;
      }
    }
    check(x - 14 <= W - PAD, 'chips run past the right edge');
    ctx.fillStyle = NAVY; ctx.fillRect(0, H - FOOT, W, FOOT);
    const lh = 78, lw = logo.naturalWidth * lh / logo.naturalHeight; ctx.drawImage(logo, PAD - 10, H - FOOT / 2 - lh / 2, lw, lh);
    ctx.fillStyle = '#ffffff'; ctx.font = '700 22px BrandSans'; ctx.letterSpacing = '6px'; ctx.fillText('ACADEMY', 256, H - FOOT / 2 + 9); ctx.letterSpacing = '0px';
    ctx.font = '600 25px BrandSans'; ctx.textAlign = 'right'; ctx.fillText('academy.imedmanagement.com.au', W - PAD, H - FOOT / 2 + 9); ctx.textAlign = 'left';
    return toBlob(cv);
  }

  // 9:16 Story: the feed card framed on a brand background, eyebrow above, one or two lines below.
  const STORY = {
    imm: { bg1: '#0d2150', bg2: '#06152e', fg: '#ffffff', sub: '#c5cee4', shadow: 'rgba(0,0,0,0.40)' },
    academy: { bg1: '#EAF0F8', bg2: '#d6e2f2', fg: '#12305A', sub: '#2B5CB8', shadow: 'rgba(18,48,90,0.22)' }
  };
  async function story(cardBlob, brand, o) {
    const p = STORY[brand];
    const img = new Image(); img.src = URL.createObjectURL(cardBlob); await img.decode();
    const W = 1080, H = 1920, cw = 940, ch = Math.round(cw * img.naturalHeight / img.naturalWidth), x = (W - cw) / 2, y = 290, r = 26;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, p.bg1); g.addColorStop(1, p.bg2); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = p.sub; ctx.font = '700 26px BrandSans'; ctx.letterSpacing = '6px'; ctx.fillText(o.eyebrow.toUpperCase(), W / 2, 225); ctx.letterSpacing = '0px';
    ctx.save(); ctx.shadowColor = p.shadow; ctx.shadowBlur = 44; ctx.shadowOffsetY = 16; rr(ctx, x, y, cw, ch, r); ctx.fillStyle = p.bg2; ctx.fill(); ctx.restore();
    ctx.save(); rr(ctx, x, y, cw, ch, r); ctx.clip(); ctx.drawImage(img, x, y, cw, ch); ctx.restore();
    ctx.fillStyle = p.fg; ctx.font = '600 36px BrandSans'; check(ctx.measureText(o.line).width <= W - 140, 'story line too wide'); ctx.fillText(o.line, W / 2, y + ch + 96);
    if (o.line2) { ctx.fillStyle = p.sub; ctx.font = '500 29px BrandSans'; check(ctx.measureText(o.line2).width <= W - 140, 'story second line too wide'); ctx.fillText(o.line2, W / 2, y + ch + 148); }
    ctx.font = '700 26px BrandSans'; ctx.letterSpacing = '6px'; check(ctx.measureText(o.eyebrow.toUpperCase()).width <= W - 140, 'story eyebrow too wide'); ctx.letterSpacing = '0px';
    ctx.textAlign = 'left';
    return toBlob(cv);
  }

  const b64 = async (blob) => { const u8 = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  window.renderJob = async (job) => {
    PROBLEMS = [];
    const card = job.brand === 'imm' ? await imm(job.card) : await academy(job.card);
    const st = job.story ? await story(card, job.brand, job.story) : null;
    if (PROBLEMS.length) throw new Error('layout: ' + PROBLEMS.join('; '));
    return { card: await b64(card), story: st ? await b64(st) : null };
  };
})();
