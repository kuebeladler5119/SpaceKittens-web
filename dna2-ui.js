// Beta 1.6 M4 — Galactic DNA 2.0 in the Werft: every weapon shows a picture of its chassis and its fire pattern in its
// affinity colours (rarity frame, second affinity, cosmic star), its traits, and how it compares with the mounted weapon.
// The fusion preview shows both inputs → the result with every difference and every warning. Logic: dna.js, dna2.js.
// Loaded after dna-ui.js. Pictures are drawn once per identity and cached (no canvas work per render).

const DNA_RARITY_GLOW = { common: '#9aa2c4', uncommon: '#7fe08a', rare: '#6ab8ff', epic: '#c07aff', legendary: '#ffc04a', mythic: '#ff6ab0', celestial: '#fff2a8' };
const dnaArtCache = new Map();
// A 120×48 picture (drawn at 2×): the chassis on the left, its fire pattern on the right.
function dnaWeaponArtURL(w) {
  const key = [w.chassis, w.affinity, w.affinity2 || '', w.rarity, (w.affixes || []).join('+')].join(':');
  if (dnaArtCache.has(key)) return dnaArtCache.get(key);
  let url = '';
  try {
    const c = document.createElement('canvas');
    c.width = 240;
    c.height = 96;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.scale(2, 2);
      dnaDrawWeapon(ctx, w);
      url = c.toDataURL();
    }
  } catch {}
  if (dnaArtCache.size > 120) dnaArtCache.clear();
  dnaArtCache.set(key, url);
  return url;
}
function dnaDrawWeapon(ctx, w) {
  const TAU = Math.PI * 2,
    aff = DNA_AFFINITIES[w.affinity] || DNA_AFFINITIES.kinetic,
    aff2 = DNA_AFFINITIES[w.affinity2],
    glow = DNA_RARITY_GLOW[w.rarity] || '#9aa2c4',
    s = dnaStats(w),
    traits = s.traits || [];
  // panel with the rarity glow
  const bg = ctx.createLinearGradient(0, 0, 120, 48);
  bg.addColorStop(0, '#141a3e');
  bg.addColorStop(1, '#22184a');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(1, 1, 118, 46, 8) : ctx.rect(1, 1, 118, 46);
  ctx.fill();
  ctx.strokeStyle = glow;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = w.rarity === 'common' ? 1 : 1.6;
  ctx.stroke();
  ctx.globalAlpha = 1;
  if (w.rarity === 'celestial' || w.rarity === 'mythic')
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = i % 2 ? '#fff6c8' : '#ffd0f0';
      ctx.globalAlpha = 0.6;
      ctx.fillRect((i * 37.3) % 112 + 4, (i * 19.7) % 40 + 4, 1.2, 1.2);
      ctx.globalAlpha = 1;
    }
  const glowDot = (x, y, r, color, a = 0.6) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = a;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  };
  // ----- the chassis (left half) -----
  const metal = ctx.createLinearGradient(0, 14, 0, 36);
  metal.addColorStop(0, '#dfe4f4');
  metal.addColorStop(1, '#8a92b8');
  ctx.fillStyle = metal;
  const box = (x, y, bw, bh, r = 2) => {
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, bw, bh, r) : ctx.rect(x, y, bw, bh);
    ctx.fill();
  };
  const accent = aff.color,
    accent2 = aff2 ? aff2.color : aff.color;
  switch (w.chassis) {
    case 'repeater':
      box(8, 18, 22, 14, 4);
      ctx.fillStyle = '#6a7298';
      for (const y of [19, 24, 29]) box(30, y, 20, 3, 1.5);
      break;
    case 'heavy':
      box(6, 16, 24, 18, 5);
      ctx.fillStyle = '#6a7298';
      box(30, 21, 22, 8, 2);
      ctx.fillStyle = metal;
      box(48, 19, 7, 12, 2);
      break;
    case 'lance':
      box(8, 20, 18, 10, 4);
      ctx.fillStyle = '#6a7298';
      box(26, 23, 28, 4, 2);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.6;
      for (const x of [32, 42]) {
        ctx.beginPath();
        ctx.ellipse(x, 25, 2, 5, 0, 0, TAU);
        ctx.stroke();
      }
      break;
    case 'prism':
      box(8, 18, 20, 14, 4);
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.moveTo(28, 15);
      ctx.lineTo(50, 25);
      ctx.lineTo(28, 35);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
      break;
    case 'scatter':
      box(8, 18, 20, 14, 4);
      ctx.fillStyle = '#6a7298';
      ctx.beginPath();
      ctx.moveTo(28, 21);
      ctx.lineTo(50, 15);
      ctx.lineTo(50, 35);
      ctx.lineTo(28, 29);
      ctx.closePath();
      ctx.fill();
      break;
    case 'mortar':
      box(8, 26, 26, 12, 4);
      ctx.save();
      ctx.translate(26, 28);
      ctx.rotate(-0.6);
      ctx.fillStyle = '#6a7298';
      box(0, -6, 24, 12, 3);
      ctx.restore();
      break;
    default:
      box(8, 18, 40, 14, 4);
  }
  // affinity core (two-tone for a second affinity)
  glowDot(17, 25, 9, accent, 0.7);
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(17, 25, 3.4, 0, TAU);
  ctx.fill();
  if (aff2) {
    ctx.fillStyle = accent2;
    ctx.beginPath();
    ctx.arc(17, 25, 3.4, -Math.PI / 2, Math.PI / 2);
    ctx.fill();
  }
  // ----- the fire pattern (right half) -----
  const ox = 62,
    oy = 25,
    shot = (x, y, r) => {
      glowDot(x, y, r * 2.4, accent, 0.55);
      ctx.fillStyle = aff.core || '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    };
  ctx.strokeStyle = accent;
  ctx.lineCap = 'round';
  switch (s.fire) {
    case 'stream':
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(ox + i * 13, oy);
        ctx.lineTo(ox + i * 13 + 7, oy);
        ctx.stroke();
      }
      if (s.cosmic === 'pulsar') for (const dy of [-8, 8]) shot(ox + 44, oy + dy, 1.4);
      break;
    case 'single':
      ctx.strokeStyle = 'rgba(200,200,220,0.4)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + 26, oy);
      ctx.stroke();
      shot(ox + 30, oy, 4);
      if (s.signature) {
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(ox + 44, oy, 7, 0, TAU);
        ctx.stroke();
      }
      break;
    case 'beam': {
      ctx.lineWidth = 5;
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + 52, oy);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      for (let i = 0; i <= (s.pierce || 0); i++) {
        ctx.strokeStyle = accent;
        ctx.beginPath();
        ctx.arc(ox + 16 + i * 14, oy, 4, 0, TAU);
        ctx.stroke();
      }
      break;
    }
    case 'split': {
      const n = s.count || 3;
      ctx.lineWidth = 1.8;
      for (let i = 0; i < n; i++) {
        const dy = (i - (n - 1) / 2) * (n > 3 ? 4.5 : 8);
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(ox + 50, oy + dy * 2);
        ctx.stroke();
      }
      break;
    }
    case 'spread':
      for (let i = 0; i < (s.count || 3); i++) shot(ox + 30, oy + (i - 1) * 9, 2.2);
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + 28, oy - 9);
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + 28, oy + 9);
      ctx.stroke();
      ctx.setLineDash([]);
      break;
    case 'lob':
      ctx.lineWidth = 1.4;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(ox, oy + 6);
      ctx.quadraticCurveTo(ox + 22, oy - 22, ox + 42, oy + 8);
      ctx.stroke();
      ctx.setLineDash([]);
      glowDot(ox + 44, oy + 8, 12, accent, 0.5);
      ctx.beginPath();
      ctx.arc(ox + 44, oy + 8, 8, 0, TAU);
      ctx.stroke();
      break;
  }
  // trait marks: Zielsucher (a curved arrow), cosmic (a star)
  if (traits.includes('seeker')) {
    ctx.strokeStyle = '#ffffff';
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(ox + 40, oy - 9, 6, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (traits.includes('cosmic')) {
    ctx.fillStyle = '#fff2a8';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 2.2 : 5.4,
        ang = (i / 10) * TAU - Math.PI / 2;
      i ? ctx.lineTo(110 + Math.cos(ang) * r, 9 + Math.sin(ang) * r) : ctx.moveTo(110 + Math.cos(ang) * r, 9 + Math.sin(ang) * r);
    }
    ctx.fill();
  }
}
// the traits of a weapon as small chips with their rule in the title (screen readers get the rule as text)
function dnaTraitsHTML(w) {
  const traits = dnaTraits(w);
  if (!traits.length) return '';
  return `<p class="dna-traits">${traits
    .map(id => {
      const t = dnaTraitText(w, id);
      return t ? `<span class="dna-trait trait-${id}" title="${t.text}"><i aria-hidden="true">${DNA_TRAITS[id].icon}</i> ${t.name}<small>${t.text}</small></span>` : '';
    })
    .join('')}</p>`;
}
// a rough damage-per-second index of an identity (rate × damage × projectiles that count), for comparisons only
function dnaPowerIndex(w) {
  if (!w) return 1;
  const s = dnaStats(w);
  return s.rate * s.damage * (s.fire === 'split' ? s.count * (s.rayShare || 1) : s.fire === 'spread' ? s.count * 0.8 : 1);
}
// what changes against the mounted weapon (or the board gun)
function dnaCompareHTML(w) {
  const d = state.meta.dna,
    mounted = d.owned.find(x => x.uid === d.mount),
    base = mounted ? dnaPowerIndex(mounted) : 1,
    delta = Math.round((dnaPowerIndex(w) / Math.max(1e-9, base) - 1) * 100),
    key = typeof campaignKeyFor === 'function' ? campaignKeyFor() : null,
    kinds = key && CAMPAIGNS[key] ? [...new Set(CAMPAIGNS[key].waves[Math.min(campaignCleared(key), CAMPAIGNS[key].waves.length - 1)].foes)] : [],
    L = { affinity: w.affinity, affinity2: dnaStats(w).affinity2, stats: dnaStats(w) },
    strong = kinds.filter(k => arenaAffinity(L, enemyDna(k).affinity) > 1).length,
    weak = kinds.filter(k => arenaAffinity(L, enemyDna(k).affinity) < 1).length;
  return `<p class="dna-compare"><span class="${delta > 0 ? 'good' : delta < 0 ? 'warn' : ''}">${mounted ? 'gegen die montierte' : 'gegen das Bordgeschütz'}: Grundschaden/s ${delta > 0 ? '+' : ''}${delta} %</span>${
    kinds.length ? `<span>nächste Welle: ${strong ? `<b class="good">stark gegen ${strong}</b>` : ''}${strong && weak ? ' · ' : ''}${weak ? `<b class="warn">schwach gegen ${weak}</b>` : ''}${!strong && !weak ? 'neutral' : ''} von ${kinds.length} Gegnerarten</span>` : ''
  }</p>`;
}
const dnaWeaponHTMLBeforeV2 = dnaWeaponHTML;
dnaWeaponHTML = (w, mounted) => {
  let html = dnaWeaponHTMLBeforeV2(w, mounted);
  const art = dnaWeaponArtURL(w),
    second = w.affinity2 && DNA_AFFINITIES[w.affinity2] ? ' ' + dnaAffinityChip(w.affinity2).replace('dna-chip', 'dna-chip second') : '';
  html = html.replace('</header>', second + '</header>' + (art ? `<img class="dna-art" src="${art}" alt="" width="120" height="48" />` : ''));
  const extra = dnaTraitsHTML(w) + (mounted || w.uid === 'preview' ? '' : dnaCompareHTML(w));
  return html.replace(/(<small class="dna-seed">)/, extra + '$1');
};

// ----- the fusion preview: inputs → result, every difference, every warning -----
function dnaFusionDiff(p) {
  const a = dnaStats(p.base),
    r = dnaStats(p.result),
    chips = [],
    pct = (x, y) => Math.round((x / Math.max(1e-9, y) - 1) * 100);
  const rate = pct(r.rate, a.rate),
    dmg = pct(r.damage, a.damage),
    power = pct(dnaPowerIndex(p.result), dnaPowerIndex(p.base));
  chips.push(`<span class="${power >= 0 ? 'good' : 'warn'}">Grundschaden/s ${power >= 0 ? '+' : ''}${power} % zur Basis</span>`);
  if (rate) chips.push(`<span>Feuerrate ${rate > 0 ? '+' : ''}${rate} %</span>`);
  if (dmg) chips.push(`<span>Schaden je Treffer ${dmg > 0 ? '+' : ''}${dmg} %</span>`);
  if (p.result.affinity !== p.base.affinity) chips.push(`<span>Affinität ${DNA_AFFINITIES[p.base.affinity]?.short} → ${DNA_AFFINITIES[p.result.affinity]?.short}</span>`);
  if (p.result.affinity2) chips.push(`<span class="good">zweite Affinität: ${DNA_AFFINITIES[p.result.affinity2]?.short}</span>`);
  const gained = dnaTraits(p.result).filter(id => !dnaTraits(p.base).includes(id));
  for (const id of gained) chips.push(`<span class="good">neu: ${dnaTraitText(p.result, id)?.name || id}</span>`);
  const lost = p.base.affixes.filter(x => !p.result.affixes.includes(x));
  if (lost.length) chips.push(`<span class="warn">verliert: ${lost.map(x => DNA_AFFIXES[x]?.name || x).join(', ')}</span>`);
  return chips.join('');
}
function dnaFusionWarnings(p) {
  const d = state.meta.dna,
    warn = [];
  if ([p.base.uid, p.donor.uid].includes(d.mount)) warn.push('deine montierte Waffe wird verbraucht (das Ergebnis wird montiert)');
  if ([p.base, p.donor].some(w => w.src === 'starter')) warn.push('ein Werft-Prototyp wird verbraucht');
  for (const w of [p.base, p.donor]) if (w.affinity !== p.result.affinity && w.affinity !== p.result.affinity2 && !d.owned.some(o => o !== p.base && o !== p.donor && o.affinity === w.affinity)) warn.push('danach hast du keine ' + DNA_AFFINITIES[w.affinity]?.short + '-Waffe mehr');
  if (['epic', 'legendary', 'mythic'].includes(p.base.rarity)) warn.push('zwei ' + (ARSENAL_RARITY_NAME[p.base.rarity] || p.base.rarity).toLowerCase() + 'e Waffen gehen in eine auf');
  if (p.result.chassis === 'prism') warn.push('Prisma: gegen einen einzelnen Wächter schwächer' + (dnaTraits(p.result).includes('signature') ? ' (Bündelung hilft)' : ''));
  return [...new Set(warn)];
}
dnaFusionHTML = () => {
  const d = state.meta.dna;
  if (!dnaFuseBase) return d.owned.length >= 2 ? '<p class="dna-intro">Fusion: zwei DNA-Waffen gleicher Seltenheit ergeben eine der nächsten Seltenheit – Chassis von der Basis, Affinität vom Spender; ab Mythisch bleibt die Affinität der Basis als zweite. Das Ergebnis siehst du vorher genau.</p>' : '';
  const base = d.owned.find(w => w.uid === dnaFuseBase);
  if (!dnaFuseDonor) return `<div class="dna-fusion"><b>Fusion · Basis: ${dnaLabel(base)}</b><small>Wähle einen Spender gleicher Seltenheit (Taste „SPENDER“).</small><button class="secondary" data-dna-fuse-cancel>ABBRECHEN</button></div>`;
  const p = dnaFusePreview(dnaFuseBase, dnaFuseDonor);
  if (!p.ok) return `<div class="dna-fusion"><b>Fusion nicht möglich</b><small>${p.why}</small><button class="secondary" data-dna-fuse-cancel>ABBRECHEN</button></div>`;
  const mini = (w, label) => `<figure class="dna-mini"><figcaption>${label}</figcaption>${dnaWeaponArtURL(w) ? `<img src="${dnaWeaponArtURL(w)}" alt="" width="120" height="48" />` : ''}<b>${dnaLabel(w)}</b><small>${ARSENAL_RARITY_NAME[w.rarity] || w.rarity}</small></figure>`,
    warnings = dnaFusionWarnings(p);
  return `<div class="dna-fusion"><b>Fusion · Vorschau</b><div class="dna-fusion-io">${mini(p.base, 'Basis')}<span aria-hidden="true">+</span>${mini(p.donor, 'Spender')}<span aria-hidden="true">→</span>${mini(p.result, 'Ergebnis')}</div><p class="dna-diff">${dnaFusionDiff(p)}</p>${
    warnings.length ? `<p class="dna-warn" role="note">Achtung: ${warnings.join(' · ')}.</p>` : ''
  }${dnaWeaponHTML({ ...p.result, uid: 'preview', src: 'fusion' }, false).replace(/<button[^>]*>[^<]*<\/button>/, '')}<p class="dna-intro">Gleiche Eingaben ergeben immer genau dieses Ergebnis – auch nach einem Neustart.</p><div class="fab-actions"><button data-dna-fuse-confirm ${p.affordable ? '' : 'disabled'}>FUSIONIEREN · ✦ ${p.cost}</button><button class="secondary" data-dna-fuse-cancel>ABBRECHEN</button></div>${p.affordable ? '' : '<small>Nicht genug Sternsplitter (✦ ' + (state.meta.arsenal?.splitters || 0) + ').</small>'}</div>`;
};
// the cycle line names the second affinity rule as well
const dnaCycleHTMLBeforeV2 = dnaCycleHTML;
dnaCycleHTML = () => dnaCycleHTMLBeforeV2().replace('</p>', ' · ab Mythisch: zweite Affinität (stark ×1,125, nie schwach)</p>');
