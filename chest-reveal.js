// Beta 1.6 M5 — Loot reveals 2.0: three physical chests (Sternenkiste: wood and brass with one padlock, Kometenkiste: blue
// steel with two comet clasps, Sternenrelikt: a violet crystal reliquary with three rune seals) and one opening sequence:
//   appear (the chest lands) → tension (it trembles; the glow drifts toward the rarity's colour) → locks react one by one →
//   the lid flies open with rays in the rarity colour → the reward rises out → inspect (the card with everything).
// Purely visual, on top of reveal.js: the result is granted and saved before the sequence starts (arsenal-ui.js), a tap
// on the stage, "Überspringen" or the action button jumps to the end at any time, reduced motion shows the result at
// once, and a reload in the middle loses nothing. Each reward type is presented as itself: an Arsenal part (its icon and
// slot), a duplicate (a shower of ✦), a DNA weapon (its picture and traits). Loaded after reveal.js and dna2-ui.js.

const CHEST_SEQ = { appear: 260, tension: { common: 380, uncommon: 450, rare: 560, epic: 680, legendary: 800, mythic: 900, celestial: 900 }, lock: 200, open: 320, rise: 380 };
const CHEST_LOOK = {
  standard: { body: ['#b0763e', '#6e4220'], band: '#e2b25a', locks: 1, emblem: 'star' },
  elite: { body: ['#4a6aa8', '#22345e'], band: '#9fe9ff', locks: 2, emblem: 'comet' },
  relic: { body: ['#8a5ad8', '#3a1f6a'], band: '#ffd77a', locks: 3, emblem: 'rune' }
};
const CHEST_RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'celestial'];
const chestSeq = { canvas: null, ctx: null, kind: 'standard', rarity: 'common', start: 0, phase: 'idle', raf: 0, dupe: 0, t0: 0 };

function chestSeqTotal(rarity) {
  const look = CHEST_LOOK[chestSeq.kind] || CHEST_LOOK.standard;
  return CHEST_SEQ.appear + (CHEST_SEQ.tension[rarity] || 600) + look.locks * CHEST_SEQ.lock + CHEST_SEQ.open + CHEST_SEQ.rise;
}
function chestCanvas(stage) {
  let c = stage.querySelector('canvas.chest-canvas');
  if (!c) {
    c = document.createElement('canvas');
    c.className = 'chest-canvas';
    c.setAttribute('aria-hidden', 'true');
    stage.prepend(c);
  }
  const ctx = c.getContext?.('2d');
  if (!ctx) return null;
  const w = Math.max(200, Math.round(stage.clientWidth || 300)),
    h = 190,
    dpr = Math.min(2, window.devicePixelRatio || 1);
  if (c.width !== w * dpr || c.height !== h * dpr) {
    c.width = w * dpr;
    c.height = h * dpr;
    c.style.width = w + 'px';
    c.style.height = h + 'px';
  }
  chestSeq.canvas = c;
  chestSeq.ctx = ctx;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  stage.classList.add('has-chest-canvas');
  return ctx;
}

// ----- drawing (one chest, any state) -----
function chestDraw(ctx, w, h, s) {
  const TAU = Math.PI * 2,
    look = CHEST_LOOK[chestSeq.kind] || CHEST_LOOK.standard,
    color = REVEAL_RARITY_COLOR[s.rarity] || '#ffffff',
    cx = w / 2,
    base = h * 0.8,
    size = Math.min(w * 0.42, 132);
  ctx.clearRect(0, 0, w, h);
  // halo: neutral while closed, drifting toward the rarity colour during the tension
  const haloColor = s.tension > 0 ? color : 'rgba(196,179,255,1)',
    haloR = Math.min(h * 0.62, size * (0.9 + s.tension * 0.4 + s.open * 0.6)),
    halo = ctx.createRadialGradient(cx, base - size * 0.45, 0, cx, base - size * 0.45, haloR);
  halo.addColorStop(0, haloColor);
  halo.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.globalAlpha = 0.18 + s.tension * 0.35 + s.open * 0.4;
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, base - size * 0.45, haloR, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
  // rays once the lid is open
  if (s.open > 0) {
    ctx.save();
    ctx.translate(cx, base - size * 0.55);
    ctx.globalAlpha = Math.min(1, s.open) * (1 - s.rise * 0.5);
    ctx.fillStyle = color;
    const n = 7 + CHEST_RARITY_ORDER.indexOf(s.rarity) * 2;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i - (n - 1) / 2) * (1.8 / n) + (s.reduced ? 0 : Math.sin(s.time * 1.5 + i) * 0.03),
        len = size * (1.2 + s.open * 0.6);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a - 0.05) * len, Math.sin(a - 0.05) * len);
      ctx.lineTo(Math.cos(a + 0.05) * len, Math.sin(a + 0.05) * len);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  // the chest (landing drop, tension shake)
  const drop = (1 - s.appear) * -h * 0.5,
    shake = s.reduced ? 0 : s.shake * Math.sin(s.time * 55) * 3,
    tilt = s.reduced ? 0 : s.shake * Math.sin(s.time * 37) * 0.04;
  ctx.save();
  ctx.translate(cx + shake, base + drop);
  ctx.rotate(tilt);
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 4, size * 0.62, size * 0.1, 0, 0, TAU);
  ctx.fill();
  const bw = size * 1.08,
    bh = size * 0.56,
    body = ctx.createLinearGradient(0, -bh, 0, 0);
  body.addColorStop(0, look.body[0]);
  body.addColorStop(1, look.body[1]);
  if (chestSeq.kind === 'relic') {
    // a hexagonal crystal reliquary
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-bw / 2, 0);
    ctx.lineTo(-bw / 2 + 10, -bh);
    ctx.lineTo(bw / 2 - 10, -bh);
    ctx.lineTo(bw / 2, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = look.band;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-bw / 2 + 16, -bh + 4);
    ctx.lineTo(-bw / 2 + 30, -bh + 4);
    ctx.lineTo(-bw / 2 + 14, -6);
    ctx.lineTo(-bw / 2 + 6, -6);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(-bw / 2, -bh, bw, bh, 6) : ctx.rect(-bw / 2, -bh, bw, bh);
    ctx.fill();
    // planks (wood) or rivets (steel)
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1;
    if (chestSeq.kind === 'standard')
      for (let i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-bw / 2, -bh + (bh / 3) * i);
        ctx.lineTo(bw / 2, -bh + (bh / 3) * i);
        ctx.stroke();
      }
    else {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      for (const x of [-bw / 2 + 7, bw / 2 - 7]) for (const y of [-bh + 7, -7]) ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    ctx.fillStyle = look.band;
    ctx.fillRect(-bw / 2 + bw * 0.18, -bh, 7, bh);
    ctx.fillRect(bw / 2 - bw * 0.18 - 7, -bh, 7, bh);
  }
  // emblem on the front
  ctx.save();
  ctx.translate(0, -bh * 0.48);
  ctx.fillStyle = look.band;
  if (look.emblem === 'star') {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 4 : 10,
        a = (i / 10) * TAU - Math.PI / 2;
      i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.fill();
  } else if (look.emblem === 'comet') {
    ctx.beginPath();
    ctx.arc(6, 0, 6, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(2, -5);
    ctx.lineTo(-16, -2);
    ctx.lineTo(2, 5);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  } else {
    ctx.strokeStyle = look.band;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, TAU);
    ctx.moveTo(-6, 0);
    ctx.lineTo(6, 0);
    ctx.moveTo(0, -6);
    ctx.lineTo(0, 6);
    ctx.stroke();
  }
  ctx.restore();
  // locks / clasps / seals: each reacts in turn (glows in the rarity colour, then springs open)
  for (let i = 0; i < look.locks; i++) {
    const lx = look.locks === 1 ? 0 : (i - (look.locks - 1) / 2) * bw * (look.locks === 2 ? 0.62 : 0.34),
      ly = -bh + 4,
      k = Math.max(0, Math.min(1, s.locks * look.locks - i));
    ctx.save();
    ctx.translate(lx, ly + k * 10);
    ctx.rotate(k * (i % 2 ? 0.7 : -0.7));
    ctx.globalAlpha = 1 - k * 0.7;
    if (k > 0 && k < 1 && !s.reduced) {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 16);
      g.addColorStop(0, color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-16, -16, 32, 32);
    }
    ctx.fillStyle = chestSeq.kind === 'relic' ? '#ffe9a8' : chestSeq.kind === 'elite' ? '#cfefff' : '#d9a24a';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(-6, -2, 12, 12, 3) : ctx.rect(-6, -2, 12, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, -2, 4, Math.PI, 0);
    ctx.stroke();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  // the lid: closed, then flies open
  ctx.save();
  // the wooden and steel lids swing open on their hinge; the reliquary's crystal roof lifts and fades
  if (chestSeq.kind === 'relic') {
    ctx.translate(-bw / 2, -bh - s.open * size * 0.5);
    ctx.globalAlpha = 1 - s.open * 0.75;
  } else {
    ctx.translate(-bw / 2, -bh);
    ctx.rotate(-s.open * 1.9);
  }
  const lid = ctx.createLinearGradient(0, -bh * 0.45, 0, 0);
  lid.addColorStop(0, look.body[0]);
  lid.addColorStop(1, look.body[1]);
  ctx.fillStyle = lid;
  ctx.beginPath();
  if (chestSeq.kind === 'relic') {
    ctx.moveTo(10, 0);
    ctx.lineTo(bw / 2, -bh * 0.45);
    ctx.lineTo(bw - 10, 0);
    ctx.closePath();
  } else ctx.roundRect ? ctx.roundRect(0, -bh * 0.38, bw, bh * 0.38, [10, 10, 2, 2]) : ctx.rect(0, -bh * 0.38, bw, bh * 0.38);
  ctx.fill();
  ctx.strokeStyle = look.band;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  ctx.restore();
  // duplicates: a shower of ✦ (the splitters the duplicate turned into)
  if (s.dupe && s.rise > 0 && !s.reduced) {
    ctx.fillStyle = '#ffd77a';
    ctx.font = '900 14px Nunito, sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i < Math.min(14, 4 + s.dupe); i++) {
      const a = (i / 14) * TAU,
        r = s.rise * size * 0.9;
      ctx.globalAlpha = 1 - s.rise * 0.6;
      ctx.fillText('✦', cx + Math.cos(a) * r, base - size * 0.6 + Math.sin(a) * r * 0.6);
    }
    ctx.globalAlpha = 1;
  }
}
// the state of the sequence at a time (ms since start); the whole sequence is a pure function of time and rarity
function chestSeqState(t, rarity, reduced) {
  const look = CHEST_LOOK[chestSeq.kind] || CHEST_LOOK.standard,
    tension = CHEST_SEQ.tension[rarity] || 600,
    a = CHEST_SEQ.appear,
    b = a + tension,
    c = b + look.locks * CHEST_SEQ.lock,
    d = c + CHEST_SEQ.open,
    e = d + CHEST_SEQ.rise,
    clamp = x => Math.max(0, Math.min(1, x)),
    tier = CHEST_RARITY_ORDER.indexOf(rarity);
  return {
    rarity,
    reduced,
    time: t / 1000,
    appear: clamp(t / a),
    tension: clamp((t - a) / tension) * (0.4 + tier * 0.1),
    shake: t > a && t < c ? clamp((t - a) / tension) * (0.4 + tier * 0.12) : 0,
    locks: clamp((t - b) / Math.max(1, c - b)),
    open: clamp((t - c) / (d - c)),
    rise: clamp((t - d) / (e - d)),
    dupe: chestSeq.dupe,
    done: t >= e
  };
}
function chestSeqFrame(stamp) {
  const stage = $('chestStage'),
    ctx = chestSeq.ctx;
  chestSeq.raf = 0;
  if (!stage || !ctx || $('chestModal')?.classList.contains('hidden')) return;
  const w = chestSeq.canvas.clientWidth || 300,
    h = 190,
    reduced = revealReduced();
  if (chestSeq.phase === 'idle') {
    // the closed chest waits: a slow breath of its neutral glow
    chestDraw(ctx, w, h, { rarity: 'common', reduced, time: stamp / 1000, appear: 1, tension: 0, shake: 0, locks: 0, open: 0, rise: 0, dupe: 0 });
    if (!reduced) chestSeq.raf = requestAnimationFrame(chestSeqFrame);
    return;
  }
  const finished = stage.classList.contains('rv-show'),
    t = finished ? Infinity : stamp - chestSeq.start,
    s = chestSeqState(t, chestSeq.rarity, reduced);
  chestDraw(ctx, w, h, { ...s, time: stamp / 1000 });
  // the reward rises out at the end of the sequence; the card itself is the DOM below
  if (s.done && !finished) revealFinish(stage);
  if (!s.done && !finished) chestSeq.raf = requestAnimationFrame(chestSeqFrame);
  else if (!reduced) {
    chestSeq.phase = 'open';
    chestSeq.raf = requestAnimationFrame(chestSeqOpenIdle);
  }
}
// after the reveal: the open chest keeps a soft glow (slow, only while the dialog is open)
function chestSeqOpenIdle(stamp) {
  chestSeq.raf = 0;
  const ctx = chestSeq.ctx;
  if (!ctx || $('chestModal')?.classList.contains('hidden') || chestSeq.phase !== 'open') return;
  const s = chestSeqState(Infinity, chestSeq.rarity, false);
  chestDraw(ctx, chestSeq.canvas.clientWidth || 300, 190, { ...s, time: stamp / 1000, rise: 1, dupe: 0 });
  chestSeq.raf = requestAnimationFrame(chestSeqOpenIdle);
}
function chestSeqStop() {
  if (chestSeq.raf) cancelAnimationFrame(chestSeq.raf);
  chestSeq.raf = 0;
}

// ----- wiring: the chest dialog -----
const renderChestModalBeforeSeq = renderChestModal;
renderChestModal = result => {
  renderChestModalBeforeSeq(result);
  const stage = $('chestStage');
  if (!stage) return;
  chestSeqStop();
  chestSeq.kind = result?.chest || chestKind;
  const ctx = chestCanvas(stage);
  if (!ctx) return; // no canvas (tests, very old browsers): the CSS chest and reveal.js stay as they were
  if (!result) {
    chestSeq.phase = 'idle';
    chestSeq.raf = requestAnimationFrame(chestSeqFrame);
    return;
  }
  // the sequence replaces reveal.js' short charge/burst for chests (its timers stop; its skip and card handling stay)
  (revealTimers.get(stage) || []).forEach(clearTimeout);
  revealTimers.delete(stage);
  stage.classList.remove('rv-charge', 'rv-burst');
  const item = ARSENAL_BY_ID[result.id],
    rarities = [item?.rarity, result.dna?.rarity].filter(Boolean);
  chestSeq.rarity = rarities.sort((a, b) => CHEST_RARITY_ORDER.indexOf(b) - CHEST_RARITY_ORDER.indexOf(a))[0] || 'common';
  chestSeq.dupe = result.duplicate ? Math.round(result.splitters / 2) : 0;
  stage.style.setProperty('--rv-color', REVEAL_RARITY_COLOR[chestSeq.rarity] || REVEAL_RARITY_COLOR.common);
  chestSeq.phase = 'play';
  chestSeq.start = performance.now();
  if (revealReduced()) {
    revealFinish(stage);
    chestDraw(ctx, chestSeq.canvas.clientWidth || 300, 190, { ...chestSeqState(Infinity, chestSeq.rarity, true), time: 0 });
    return;
  }
  // the reward types look like themselves: a DNA weapon shows its picture and traits
  const dnaCard = stage.querySelector('.reveal-card.dna-bonus');
  if (dnaCard && result.dna && typeof dnaWeaponArtURL === 'function') {
    const art = dnaWeaponArtURL(result.dna),
      traits = typeof dnaTraits === 'function' ? dnaTraits(result.dna).map(id => dnaTraitText(result.dna, id)?.name).filter(Boolean) : [];
    if (art) dnaCard.querySelector('i')?.replaceWith(Object.assign(document.createElement('img'), { src: art, alt: '', width: 120, height: 48, className: 'dna-art' }));
    if (traits.length) dnaCard.insertAdjacentHTML('beforeend', `<small class="dna-reveal-traits">${traits.join(' · ')}</small>`);
  }
  chestSeq.raf = requestAnimationFrame(chestSeqFrame);
};
// the action button skips while the sequence plays (a second tap never opens a second chest unseen)
$('chestAction')?.addEventListener(
  'click',
  event => {
    const stage = $('chestStage');
    if (chestSeq.phase === 'play' && stage && stage.classList.contains('rv-play') && !stage.classList.contains('rv-show')) {
      event.stopImmediatePropagation();
      revealFinish(stage);
    }
  },
  true
);
// DNA weapons revealed on their own (wave rewards, fusion) also name their traits
const showDnaRevealBeforeV2 = showDnaReveal;
showDnaReveal = (w, kicker) => {
  showDnaRevealBeforeV2(w, kicker);
  const stage = $('dnaRevealStage'),
    card = stage?.querySelector('.reveal-card'),
    traits = w && typeof dnaTraits === 'function' ? dnaTraits(w).map(id => dnaTraitText(w, id)?.name).filter(Boolean) : [];
  if (!card || !traits.length) return;
  card.insertAdjacentHTML('beforeend', `<small class="dna-reveal-traits">${traits.join(' · ')}</small>`);
  htmlCache.delete(stage);
};
