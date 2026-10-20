// Space Kittens character rig 3.0 (P1 Kitty Identity). One parametric, modular kitten drawn with Canvas2D.
//   look  = fur colours, pattern, eyes, suit colours, built-in accessory, worn cosmetics (look.wear)      (identity)
//   pose  = idle | walk | carry | push | pull | unload | work | operate | construct | mine | drill | cheer | hop |
//           wave | sleep | worried | surprised | discover | check | stamp | signal | pilot                  (animation)
//   mood  = neutral | happy | focus | curious | tired | surprised | proud | worried | playful | sleepy     (face)
// Proportions (docs/p1-kitty-identity/ART_DIRECTION.md): 1 unit ≈ height, origin at the feet, facing +x. A big round
// head (centre −0.72, 0.35 × 0.30, cheek tufts), a small soft body, short legs, readable paws, a tapered tail.
// Layers, back to front: back items → tail → legs → body + outfit → arms (down) → head (ears, face, face items, hats,
// helmet glass, antenna) → arms (raised) → held items. Every layer is drawn in the frame of the part it belongs to, so
// a backpack bobs with the body and glasses sit on the eyes when the head tilts or looks aside.
// Detail by drawn size (opts.px = kitten height in css px; read from the transform when absent): below 30 px only the
// silhouette, eyes and the main colours; whiskers, toe beans, fur tufts and gradients from 44/60 px.
(function () {
  'use strict';
  const TAU = Math.PI * 2;

  // Main cast (indices match state.crew — gameplay roles unchanged).
  const ROSTER = [
    // Mochi: orange tabby, cream muzzle/chest, amber eyes, ringed tail, cream suit with mint accents.
    { id: 'mochi', fur: '#f39a45', fur2: '#ffe8cc', mark: '#c4682a', pattern: 'tabby', eye: '#f6b23a', eyeShape: 'round', suit: '#fff4e2', suitDark: '#dccab0', accent: '#7fe6c6', tailRings: true, emblem: 'star', tailTip: '#ffe8cc' },
    { id: 'boba', fur: '#8f97ab', fur2: '#f2f4fa', mark: '#646c80', pattern: 'socks', eye: '#ffc85a', eyeShape: 'calm', suit: '#ffb0b0', suitDark: '#c96a78', accent: '#ffe08a', accessory: 'visor', emblem: 'shield', tailTip: '#f2f4fa' },
    { id: 'miso', fur: '#fff3e4', fur2: '#ffffff', mark: '#e58c4a', mark2: '#4a3a38', pattern: 'calico', eye: '#7cc4ff', eyeShape: 'big', suit: '#ffd77a', suitDark: '#c99a3a', accent: '#ff9ecb', accessory: 'scarf', emblem: 'coin' },
    { id: 'pip', fur: '#3a3550', fur2: '#615c7e', mark: '#2a2640', pattern: 'plain', eye: '#ffe26b', eyeShape: 'round', suit: '#8fe3ff', suitDark: '#4a9cc4', accent: '#ffd77a', accessory: 'cap', emblem: 'box', tailTip: '#615c7e' },
    { id: 'lumi', fur: '#f7f7ff', fur2: '#ffffff', mark: '#d8d8ee', pattern: 'plain', eye: '#8fb8ff', eye2: '#ffd36b', eyeShape: 'big', suit: '#c4b3ff', suitDark: '#7f6ad8', accent: '#8ff0d4', accessory: 'goggles', emblem: 'flask' },
    { id: 'nori', fur: '#a37452', fur2: '#ecd4b8', mark: '#6b4a32', pattern: 'tabby', eye: '#9be06b', eyeShape: 'round', suit: '#a8f0c8', suitDark: '#4aa880', accent: '#8fe3ff', accessory: 'antenna', emblem: 'compass' },
    { id: 'tikki', fur: '#e8823a', fur2: '#ffd2a8', mark: '#b8561c', pattern: 'socks', eye: '#6bd6ff', eyeShape: 'round', suit: '#b9c6d8', suitDark: '#6f7d93', accent: '#ffd77a', accessory: 'goggles', emblem: 'bolt' },
    { id: 'poppy', fur: '#f3e7d6', fur2: '#fff8ee', mark: '#5a4636', pattern: 'point', eye: '#7fb8ff', eyeShape: 'big', lashes: true, suit: '#ffb3d1', suitDark: '#d16f9a', accent: '#c4b3ff', accessory: 'bow', emblem: 'heart' }
  ];
  // Void: Mochi's best friend from the academy (story character of the Deep Core; no gameplay role). Charcoal fur with
  // a light rim outline so the silhouette reads on dark rock (no canvas filter needed), teal almond eyes, mint
  // neckerchief, a violet suit.
  const VOID = { id: 'void', fur: '#2e2b38', fur2: '#4b4660', mark: '#1f1c28', pattern: 'plain', eye: '#5ff2d9', eyeShape: 'almond', lashes: true, suit: '#3c4a72', suitDark: '#28304e', accent: '#8ff0d4', accessory: 'neckerchief', rim: 'rgba(159,232,255,0.95)', rimLine: '#86c4d8', emblem: 'moon', tailTip: '#4b4660' };
  // Worker kittens (colony residents; no gameplay meaning). Eye shapes vary so a crowd does not look cloned.
  const WORKERS = [
    { fur: '#f6c37a', fur2: '#fff1d6', mark: '#d89a4a', pattern: 'tabby', eye: '#6bd6a6', eyeShape: 'round', suit: '#8ff0d4', suitDark: '#3fae94', accent: '#ffd77a' },
    { fur: '#5b5670', fur2: '#8a85a3', mark: '#3e3a52', pattern: 'socks', eye: '#ffe26b', eyeShape: 'calm', suit: '#ffd77a', suitDark: '#c99a3a', accent: '#8fe3ff' },
    { fur: '#ffffff', fur2: '#ffffff', mark: '#ff9e6b', mark2: '#4a3a38', pattern: 'calico', eye: '#7cc4ff', eyeShape: 'big', suit: '#c4b3ff', suitDark: '#7f6ad8', accent: '#ff9ecb' },
    { fur: '#c9c9d6', fur2: '#f2f2f8', mark: '#8b8ba0', pattern: 'tabby', eye: '#9be06b', eyeShape: 'round', suit: '#8fe3ff', suitDark: '#4a9cc4', accent: '#ffd77a' },
    { fur: '#e58c4a', fur2: '#ffd9b3', mark: '#b85c22', pattern: 'plain', eye: '#6bd6ff', eyeShape: 'calm', suit: '#ffb3d1', suitDark: '#d16f9a', accent: '#8ff0d4' },
    { fur: '#2f2b3d', fur2: '#4a4560', mark: '#1f1c2a', pattern: 'socks', eye: '#9cffb0', eyeShape: 'almond', suit: '#ff9e9e', suitDark: '#c45a6a', accent: '#ffd77a' }
  ];

  // ----- P1: wearable cosmetics (purely visual). slot: head | suit | face | back. Prices and ownership live in
  // Commerce.COSMETICS (monetization.js); this is only how each piece is drawn. -----
  const WEAR = {
    // head
    'acc-star-helmet': { slot: 'head', name: 'Sternchen-Helm', icon: '⭐', helmet: 'star' },
    'acc-cute-antenna': { slot: 'head', name: 'Herz-Antenne', icon: '📡' },
    'acc-cat-helmet': { slot: 'head', name: 'Katzenohren-Helm', icon: '😺', helmet: 'cat' },
    'acc-headphones': { slot: 'head', name: 'Katzen-Kopfhörer', icon: '🎧' },
    // P1.4: Petalguard's flower crown (its blossoms sway)
    'acc-petal-crown': { slot: 'head', name: 'Blütenkranz', icon: '🌺' },
    // face (under the glass, on the eyes)
    'acc-explorer-goggles': { slot: 'face', name: 'Mini-Forscherbrille', icon: '🥽' },
    'acc-pilot-visor': { slot: 'face', name: 'Pilotenvisier', icon: '🕶' },
    'acc-holo-monocle': { slot: 'face', name: 'Holo-Monokel', icon: '🧿' },
    // P1.4: a crystal visor with a rime edge; a glint wanders across
    'acc-frost-visor': { slot: 'face', name: 'Frostvisier', icon: '🧊' },
    // back and shoulder
    'acc-star-backpack': { slot: 'back', name: 'Goldener Sternrucksack', icon: '🎒' },
    'acc-mint-scarf': { slot: 'back', name: 'Mint-Schal', icon: '🧣' },
    'acc-moon-patch': { slot: 'back', name: 'Mond-Schulterabzeichen', icon: '🌙' },
    'acc-rocket-pack': { slot: 'back', name: 'Mini-Raketenrucksack', icon: '🚀' },
    'acc-tool-pack': { slot: 'back', name: 'Werkzeugrucksack', icon: '🧰' },
    // P1.4: a collar with a little bell of Emberbell (an ember glows in it; it swings with the steps)
    'acc-ember-bell': { slot: 'back', name: 'Glutglöckchen', icon: '🔔' },
    // outfits (suit): their own colours AND their own cut (see SUIT_DRAW)
    'outfit-rose': { slot: 'suit', name: 'Rosa Raumanzug', icon: '💗', suit: '#ffc2dc', suitDark: '#d9779f', accent: '#ffffff', cut: 'rose' },
    'outfit-explorer': { slot: 'suit', name: 'Forscher-Overall', icon: '🧭', suit: '#e2cd9e', suitDark: '#a88a52', accent: '#ff8f6b', cut: 'explorer' },
    'outfit-stellar': { slot: 'suit', name: 'Sternenforscher', icon: '🌟', suit: '#fff6e6', suitDark: '#e3cfa6', accent: '#ffc94a', cut: 'stellar' },
    'outfit-miner': { slot: 'suit', name: 'Kristall-Bergarbeiter', icon: '⛏', suit: '#7fd6c8', suitDark: '#3f9a90', accent: '#c4b3ff', cut: 'miner' },
    'outfit-glacies': { slot: 'suit', name: 'Glacies-Pilot', icon: '❄', suit: '#e8f6ff', suitDark: '#a9d6ee', accent: '#3fd0d8', cut: 'glacies' },
    'outfit-pyra': { slot: 'suit', name: 'Pyra-Mechaniker', icon: '🔧', suit: '#f0703e', suitDark: '#b8442a', accent: '#ffd23a', cut: 'pyra' },
    'outfit-viridia': { slot: 'suit', name: 'Viridia-Botaniker', icon: '🌿', suit: '#cdeec8', suitDark: '#86c48c', accent: '#5aa86a', cut: 'viridia' },
    'outfit-pajama': { slot: 'suit', name: 'Mondschlafanzug', icon: '🌜', suit: '#3a4a8e', suitDark: '#26306a', accent: '#ffe08a', cut: 'pajama' },
    'outfit-navigator': { slot: 'suit', name: 'Nebula-Navigator', icon: '🌌', suit: '#4a3a7a', suitDark: '#2c2250', accent: '#5ff2d9', cut: 'navigator' },
    // P1.4: deep steel blue with brass (not the light grey of the technician's role uniform), rivets, shoulder plates
    'outfit-mekhanos': { slot: 'suit', name: 'Mekhanos-Techniker', icon: '⚙', suit: '#41618f', suitDark: '#273d63', accent: '#e8b45a', cut: 'mekhanos' },
    // Visual Identity round: role uniforms of the working kittens (not in the shop; role: true) — one look per job, so a
    // job reads at a glance: transport (vest + cap), miner (hard hat with lamp), technician (overall + brow goggles)
    'role-courier': { slot: 'suit', role: true, name: 'Transport-Weste', suit: '#ffb35a', suitDark: '#d9772a', accent: '#fff1a8', cut: 'courier' },
    'role-tech': { slot: 'suit', role: true, name: 'Technik-Overall', suit: '#a9bcd2', suitDark: '#5f7590', accent: '#ffd23a', cut: 'tech' },
    'role-cap': { slot: 'head', role: true, name: 'Transport-Kappe', inner: true },
    'role-hardhat': { slot: 'head', role: true, name: 'Grubenhelm', inner: true },
    'role-goggles': { slot: 'head', role: true, name: 'Stirnbrille', inner: true }
  };
  const ROLES = {
    transport: { suit: 'role-courier', head: 'role-cap' },
    miner: { head: 'role-hardhat' },
    tech: { suit: 'role-tech', head: 'role-goggles' },
    pilot: { face: 'acc-pilot-visor' }
  };
  // legacy catalogue names (Beta 1.x): the six welcome-capsule accessories
  const ACCESSORIES = {};
  for (const id of ['acc-star-helmet', 'acc-mint-scarf', 'acc-star-backpack', 'acc-cute-antenna', 'acc-explorer-goggles', 'acc-moon-patch']) ACCESSORIES[id] = { name: WEAR[id].name, icon: WEAR[id].icon };
  // Beta 1.3 outfits (cosmetic slot 'outfit'): new suit colours for the kitten who wears them
  const OUTFITS = {};
  for (const [id, w] of Object.entries(WEAR)) if (w.slot === 'suit' && !w.role) OUTFITS[id] = { suit: w.suit, suitDark: w.suitDark, accent: w.accent };
  // the slot a character's own built-in accessory occupies (a worn cosmetic in that slot replaces it)
  const BUILTIN_SLOT = { visor: 'face', goggles: 'head', cap: 'head', antenna: 'head', bow: 'head', scarf: 'back', neckerchief: 'back' };
  const SLOTS = ['head', 'suit', 'face', 'back'];

  // ----- colour helpers (cached; nothing is parsed per frame after the first) -----
  const colorCache = new Map();
  function rgbOf(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const toHex = rgb => '#' + rgb.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  function shade(hex, f) {
    const key = hex + '*' + f;
    let hit = colorCache.get(key);
    if (hit === undefined) {
      hit = toHex(rgbOf(hex).map(v => v * f));
      if (colorCache.size < 3000) colorCache.set(key, hit);
    }
    return hit;
  }
  function lighten(hex, f) {
    const key = hex + '+' + f;
    let hit = colorCache.get(key);
    if (hit === undefined) {
      hit = toHex(rgbOf(hex).map(v => v + (255 - v) * f));
      if (colorCache.size < 3000) colorCache.set(key, hit);
    }
    return hit;
  }
  const luma = hex => {
    const [r, g, b] = rgbOf(hex);
    return r * 0.3 + g * 0.59 + b * 0.11;
  };
  const isDark = hex => luma(hex) < 90;
  // derived palette per look object (outline, shading, iris light) — computed once per look
  const palettes = new WeakMap();
  function pal(look) {
    let p = palettes.get(look);
    if (p) return p;
    const darkFur = isDark(look.fur);
    p = {
      line: darkFur ? look.rimLine || lighten(look.fur, 0.42) : shade(look.fur, look.fur === '#ffffff' || luma(look.fur) > 225 ? 0.62 : 0.58),
      suitLine: shade(look.suitDark, 0.62),
      furLo: shade(look.fur, darkFur ? 0.8 : 0.86),
      furHi: lighten(look.fur, darkFur ? 0.18 : 0.35),
      irisHi: lighten(look.eye, 0.55),
      iris2Hi: look.eye2 ? lighten(look.eye2, 0.55) : null,
      face: darkFur ? '#f4eefc' : '#3a2a3e',
      dark: darkFur,
      brow: darkFur ? '#f4eefc' : shade(look.mark || look.fur, 0.8),
      whisker: darkFur ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.85)',
      suitHi: lighten(look.suit, 0.45)
    };
    palettes.set(look, p);
    return p;
  }

  // ----- primitives -----
  function ellipse(ctx, x, y, rx, ry, fill, rotation = 0) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.001, rx), Math.max(0.001, ry), rotation, 0, TAU);
    ctx.fillStyle = fill;
    ctx.fill();
  }
  // an ellipse with an outline drawn as a slightly larger ellipse behind it (cheaper and crisper than a stroke)
  function oEllipse(ctx, x, y, rx, ry, fill, line, ow, rotation = 0) {
    if (ow > 0) ellipse(ctx, x, y, rx + ow, ry + ow, line, rotation);
    ellipse(ctx, x, y, rx, ry, fill, rotation);
  }
  function capsule(ctx, x1, y1, x2, y2, r, fill) {
    ctx.strokeStyle = fill;
    ctx.lineWidth = r * 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  function star(ctx, x, y, r, fill) {
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * TAU - Math.PI / 2,
        rr = k % 2 ? r * 0.45 : r;
      k ? ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }
  function heart(ctx, x, y, s, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.9);
    ctx.bezierCurveTo(x - s * 1.6, y - s * 0.2, x - s * 0.7, y - s * 1.3, x, y - s * 0.45);
    ctx.bezierCurveTo(x + s * 0.7, y - s * 1.3, x + s * 1.6, y - s * 0.2, x, y + s * 0.9);
    ctx.fill();
  }
  function blinkAmount(t, seed) {
    const period = 3.2 + (seed % 7) * 0.37,
      phase = (t + seed * 0.71) % period;
    return phase < 0.13 ? 1 - Math.abs(phase - 0.065) / 0.065 : 0;
  }
  const NO_ACCESSORIES = Object.freeze([]);
  const accessoriesOf = look => (look.accessory ? [...(look.accessories || []), look.accessory] : look.accessories || NO_ACCESSORIES);
  const wearOf = look => look.wear || NO_WEAR;
  const NO_WEAR = Object.freeze({ head: null, suit: null, face: null, back: null });
  // a character's own accessory is shown unless a worn cosmetic takes its slot
  const builtin = look => (look.accessory && !wearOf(look)[BUILTIN_SLOT[look.accessory]] ? look.accessory : null);

  // per-context gradient cache (gradients are defined in local units, so one object serves every kitten of a look)
  const gradCache = new WeakMap();
  function cachedGrad(ctx, key, make) {
    let m = gradCache.get(ctx);
    if (!m) gradCache.set(ctx, (m = new Map()));
    let g = m.get(key);
    if (!g) {
      g = make();
      if (m.size > 400) m.clear();
      m.set(key, g);
    }
    return g;
  }
  // drawn height in css px from the current transform (used when the caller gives no opts.px)
  function pxOf(ctx) {
    const m = ctx.getTransform ? ctx.getTransform() : null;
    if (!m) return 60;
    return Math.hypot(m.a, m.b) / (window.devicePixelRatio || 1);
  }

  // ----- Head (drawn in the head frame: origin at the head centre) -----
  // right half from the crown to the chin, with two cheek tufts; the left half mirrors it
  function headPath(ctx) {
    ctx.beginPath();
    ctx.moveTo(0, -0.296);
    ctx.bezierCurveTo(0.205, -0.298, 0.338, -0.198, 0.346, -0.05);
    ctx.bezierCurveTo(0.351, 0.03, 0.362, 0.082, 0.392, 0.128);
    ctx.lineTo(0.338, 0.148);
    ctx.lineTo(0.358, 0.198);
    ctx.bezierCurveTo(0.298, 0.262, 0.162, 0.296, 0, 0.296);
    ctx.bezierCurveTo(-0.162, 0.296, -0.298, 0.262, -0.358, 0.198);
    ctx.lineTo(-0.338, 0.148);
    ctx.lineTo(-0.392, 0.128);
    ctx.bezierCurveTo(-0.362, 0.082, -0.351, 0.03, -0.346, -0.05);
    ctx.bezierCurveTo(-0.338, -0.198, -0.205, -0.298, 0, -0.296);
    ctx.closePath();
  }
  function earPath(ctx, inner) {
    ctx.beginPath();
    if (inner) {
      ctx.moveTo(-0.058, 0.045);
      ctx.quadraticCurveTo(-0.036, -0.095, 0, -0.14);
      ctx.quadraticCurveTo(0.036, -0.095, 0.058, 0.045);
    } else {
      ctx.moveTo(-0.112, 0.075);
      ctx.quadraticCurveTo(-0.072, -0.165, 0, -0.218);
      ctx.quadraticCurveTo(0.072, -0.165, 0.112, 0.075);
    }
    ctx.closePath();
  }
  function drawEars(ctx, look, P, S, lod) {
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1;
      ctx.save();
      ctx.translate(side * 0.2, -0.2);
      ctx.rotate(side * (0.3 + (i ? S.earR : S.earL)));
      earPath(ctx, false);
      if (lod > 0) {
        ctx.strokeStyle = P.line;
        ctx.lineWidth = S.ow * 2;
        ctx.lineJoin = 'round';
        ctx.stroke();
      }
      ctx.fillStyle = look.pattern === 'point' ? look.mark : look.pattern === 'calico' ? (i ? look.mark2 || look.mark : look.mark) : look.fur;
      ctx.fill();
      earPath(ctx, true);
      ctx.fillStyle = '#ffb3c8';
      ctx.fill();
      if (lod > 1) {
        ctx.strokeStyle = look.fur2;
        ctx.lineWidth = 0.014;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-0.022, 0.035);
        ctx.lineTo(-0.04, -0.05);
        ctx.moveTo(0.012, 0.04);
        ctx.lineTo(0.022, -0.035);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  function drawPattern(ctx, look, P, lod) {
    if (look.pattern === 'tabby') {
      // tapered stripes on the crown and the cheeks
      ctx.fillStyle = look.mark;
      for (const x of [-0.075, 0, 0.075]) {
        ctx.beginPath();
        ctx.moveTo(x - 0.024, -0.3);
        ctx.lineTo(x + 0.024, -0.3);
        ctx.lineTo(x * 0.8 + 0.006, -0.155);
        ctx.closePath();
        ctx.fill();
      }
      if (lod > 0)
        for (const side of [-1, 1])
          for (const dy of [0, 0.065]) {
            ctx.beginPath();
            ctx.moveTo(side * 0.37, -0.025 + dy);
            ctx.lineTo(side * 0.37, 0.012 + dy);
            ctx.lineTo(side * 0.255, 0.0 + dy);
            ctx.closePath();
            ctx.fill();
          }
    } else if (look.pattern === 'calico') {
      ellipse(ctx, -0.21, -0.16, 0.18, 0.13, look.mark, -0.2);
      ellipse(ctx, 0.23, -0.18, 0.14, 0.11, look.mark2 || '#4a3a38', 0.3);
    } else if (look.pattern === 'point') {
      ellipse(ctx, 0, 0.1, 0.22, 0.16, look.mark + 'aa');
    } else if (look.pattern === 'socks') {
      ellipse(ctx, 0, 0.18, 0.2, 0.15, look.fur2);
    }
    // soft shading: crown light, chin shade
    if (lod > 1) {
      ellipse(ctx, -0.09, -0.17, 0.2, 0.1, 'rgba(255,255,255,0.16)', -0.25);
      ellipse(ctx, 0, 0.35, 0.34, 0.11, 'rgba(60,30,60,0.07)');
    }
  }
  // mid detail (30–60 px): the pattern without a clip — shapes kept inside the head outline (a clip per kitten and
  // frame was the largest single cost of the rig at porter size)
  function drawPatternInside(ctx, look) {
    if (look.pattern === 'tabby') {
      ctx.fillStyle = look.mark;
      for (const x of [-0.075, 0, 0.075]) {
        ctx.beginPath();
        ctx.moveTo(x - 0.024, -0.282);
        ctx.lineTo(x + 0.024, -0.282);
        ctx.lineTo(x * 0.8 + 0.006, -0.155);
        ctx.closePath();
        ctx.fill();
      }
    } else if (look.pattern === 'calico') {
      ellipse(ctx, -0.17, -0.14, 0.13, 0.1, look.mark, -0.2);
      ellipse(ctx, 0.19, -0.16, 0.1, 0.08, look.mark2 || '#4a3a38', 0.3);
    } else if (look.pattern === 'point') ellipse(ctx, 0, 0.1, 0.22, 0.16, look.mark + 'aa');
    else if (look.pattern === 'socks') ellipse(ctx, 0, 0.18, 0.2, 0.11, look.fur2);
  }
  function drawHead(ctx, look, S, lod) {
    const P = pal(look);
    drawEars(ctx, look, P, S, lod);
    headPath(ctx);
    if (lod > 0) {
      ctx.strokeStyle = P.line;
      ctx.lineWidth = S.ow * 2;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
    ctx.fillStyle = look.fur;
    ctx.fill();
    if (lod > 1) {
      ctx.save();
      headPath(ctx);
      ctx.clip();
      drawPattern(ctx, look, P, lod);
      ctx.restore();
    } else if (lod === 1) drawPatternInside(ctx, look);
    else if (look.pattern === 'tabby') {
      ctx.fillStyle = look.mark;
      ctx.fillRect(-0.03, -0.29, 0.06, 0.1);
    } else if (look.pattern === 'calico') ellipse(ctx, -0.18, -0.15, 0.14, 0.1, look.mark);
    drawFace(ctx, look, P, S, lod);
  }

  // ----- Face -----
  // eye shapes: round (default), big (rounder, larger), calm (a resting upper lid), almond (tilted, Void)
  function drawEye(ctx, look, P, S, lod, i, x, y) {
    const shape = look.eyeShape || 'round',
      big = shape === 'big' ? 1.1 : 1,
      rx = 0.08 * big,
      mood = S.mood,
      surprised = mood === 'surprised',
      ry0 = (surprised ? 0.108 : mood === 'focus' ? 0.078 : 0.098) * big * (shape === 'almond' ? 0.86 : 1),
      ry = ry0 * (1 - S.blink * 0.92),
      tilt = shape === 'almond' ? (i ? -0.2 : 0.2) : 0,
      side = i ? 1 : -1;
    if (ry < 0.018) {
      // closed for a blink
      ctx.strokeStyle = P.face;
      ctx.lineWidth = 0.026;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x - rx * 0.8, y);
      ctx.quadraticCurveTo(x, y + 0.02, x + rx * 0.8, y);
      ctx.stroke();
      return;
    }
    ellipse(ctx, x, y, rx, ry, '#251d33', tilt);
    const iris = i && look.eye2 ? look.eye2 : look.eye;
    ellipse(ctx, x, y + ry * 0.08, rx * 0.8, ry * 0.8, iris, tilt);
    if (lod > 1) ellipse(ctx, x, y + ry * 0.42, rx * 0.55, ry * 0.32, i && P.iris2Hi ? P.iris2Hi : P.irisHi, tilt);
    const pupil = surprised ? 0.3 : mood === 'curious' || mood === 'playful' || mood === 'happy' ? 0.5 : 0.42;
    ellipse(ctx, x + S.gx * 0.012, y + ry * 0.12, rx * pupil, ry * 0.58, '#15101d', tilt);
    ellipse(ctx, x - rx * 0.32, y - ry * 0.36, rx * 0.34, rx * 0.34, '#ffffff');
    if (lod > 0) ellipse(ctx, x + rx * 0.32, y + ry * 0.34, rx * 0.14, rx * 0.14, 'rgba(255,255,255,0.85)');
    if (S.sparkle && lod > 0) star(ctx, x + rx * 0.05, y - ry * 0.05, rx * 0.36, '#fff6c0');
    // the upper lid line (cartoon definition) and lashes
    if (lod > 0) {
      ctx.strokeStyle = '#1d1528';
      ctx.lineWidth = 0.02;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.ellipse(x, y, rx * 1.02, ry * 1.02, tilt, Math.PI * 1.08, Math.PI * 1.92);
      ctx.stroke();
      if (look.lashes) {
        ctx.beginPath();
        ctx.moveTo(x + side * rx * 0.86, y - ry * 0.5);
        ctx.lineTo(x + side * rx * 1.22, y - ry * 0.78);
        ctx.stroke();
      }
    }
    // a resting or tired lid: the fur colour covers the top of the eye
    const lid = shape === 'calm' ? 0.28 : 0;
    const tired = mood === 'tired' ? 0.5 : mood === 'proud' ? 0.38 : lid;
    if (tired > 0) {
      ctx.fillStyle = look.fur;
      ctx.beginPath();
      ctx.ellipse(x, y - ry * (1 - tired) - ry * 0.02, rx * 1.12, ry, tilt, Math.PI, 0);
      ctx.lineTo(x + rx * 1.12, y - ry * 2);
      ctx.lineTo(x - rx * 1.12, y - ry * 2);
      ctx.fill();
      ctx.strokeStyle = '#1d1528';
      ctx.lineWidth = 0.02;
      ctx.beginPath();
      ctx.moveTo(x - rx * 0.95, y - ry * (1 - 2 * tired) + 0.004);
      ctx.lineTo(x + rx * 0.95, y - ry * (1 - 2 * tired) + 0.004);
      ctx.stroke();
    }
  }
  function drawFace(ctx, look, P, S, lod) {
    const mood = S.mood,
      fx = S.gx * 0.045,
      fy = S.gy * 0.03,
      eyeY = 0.045 + fy;
    // blush
    const blush = mood === 'happy' || mood === 'proud' || mood === 'playful' ? 'rgba(255,120,160,0.62)' : 'rgba(255,130,165,0.42)';
    ellipse(ctx, -0.215 + fx * 0.6, 0.13 + fy, 0.066, 0.036, blush);
    ellipse(ctx, 0.215 + fx * 0.6, 0.13 + fy, 0.066, 0.036, blush);
    for (let i = 0; i < 2; i++) {
      const x = (i ? 0.132 : -0.132) + fx,
        closed = mood === 'happy' || mood === 'sleepy' || mood === 'proud' || (mood === 'playful' && i === 1);
      if (closed) {
        ctx.strokeStyle = P.face;
        ctx.lineWidth = lod > 0 ? 0.03 : 0.04;
        ctx.lineCap = 'round';
        ctx.beginPath();
        if (mood === 'sleepy') ctx.arc(x, eyeY - 0.012, 0.055, Math.PI * 0.15, Math.PI * 0.85);
        else ctx.arc(x, eyeY + 0.03, 0.06, Math.PI * 1.13, Math.PI * 1.87);
        ctx.stroke();
      } else drawEye(ctx, look, P, S, lod, i, x, eyeY);
      // brows for the expressive moods
      if (lod > 0 && (mood === 'worried' || mood === 'focus' || mood === 'curious' || mood === 'surprised')) {
        ctx.strokeStyle = P.brow;
        ctx.lineWidth = 0.022;
        ctx.lineCap = 'round';
        const lift = mood === 'surprised' ? 0.03 : mood === 'curious' && i ? 0.025 : 0,
          tilt = mood === 'worried' ? (i ? -0.025 : 0.025) : mood === 'focus' ? (i ? 0.022 : -0.022) : 0;
        ctx.beginPath();
        ctx.moveTo(x - 0.055, eyeY - 0.135 - lift - tilt);
        ctx.lineTo(x + 0.055, eyeY - 0.135 - lift + tilt);
        ctx.stroke();
      }
    }
    // muzzle, nose, mouth
    const mx = fx * 0.8,
      my = fy;
    ellipse(ctx, mx - 0.052, 0.148 + my, 0.074, 0.054, look.fur2);
    ellipse(ctx, mx + 0.052, 0.148 + my, 0.074, 0.054, look.fur2);
    ctx.fillStyle = '#ff8fab';
    ctx.beginPath();
    ctx.moveTo(mx - 0.03, 0.1 + my);
    ctx.quadraticCurveTo(mx, 0.09 + my, mx + 0.03, 0.1 + my);
    ctx.quadraticCurveTo(mx + 0.012, 0.128 + my, mx, 0.13 + my);
    ctx.quadraticCurveTo(mx - 0.012, 0.128 + my, mx - 0.03, 0.1 + my);
    ctx.fill();
    if (lod > 0) ellipse(ctx, mx - 0.01, 0.101 + my, 0.008, 0.005, 'rgba(255,255,255,0.8)');
    ctx.strokeStyle = '#5a3a48';
    ctx.lineWidth = lod > 0 ? 0.015 : 0.02;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (mood === 'surprised' || mood === 'curious') {
      const r = mood === 'surprised' ? 0.026 : 0.017;
      ctx.ellipse(mx, 0.175 + my, r, r * 1.2, 0, 0, TAU);
      ctx.fillStyle = '#7a2a3a';
      ctx.fill();
    } else if (mood === 'happy' || mood === 'proud' && S.open) {
      // an open happy mouth with a little tongue
      ctx.moveTo(mx - 0.045, 0.148 + my);
      ctx.quadraticCurveTo(mx, 0.225 + my, mx + 0.045, 0.148 + my);
      ctx.closePath();
      ctx.fillStyle = '#7a2a3a';
      ctx.fill();
      ellipse(ctx, mx, 0.188 + my, 0.022, 0.014, '#ff8fab');
    } else if (mood === 'worried' || mood === 'tired') {
      ctx.moveTo(mx - 0.032, 0.172 + my);
      ctx.quadraticCurveTo(mx, mood === 'worried' ? 0.152 + my : 0.168 + my, mx + 0.032, 0.172 + my);
      ctx.stroke();
    } else {
      // the cat 'w'; proud and playful curl the corners up
      const up = mood === 'proud' || mood === 'playful' ? 0.012 : 0;
      ctx.moveTo(mx - 0.045, 0.142 - up + my);
      ctx.quadraticCurveTo(mx - 0.022, 0.172 + my, mx, 0.135 + my);
      ctx.quadraticCurveTo(mx + 0.022, 0.172 + my, mx + 0.045, 0.142 - up + my);
      ctx.stroke();
      if (mood === 'playful') ellipse(ctx, mx + 0.01, 0.168 + my, 0.016, 0.02, '#ff8fab');
    }
    // whiskers
    if (lod > 1) {
      ctx.strokeStyle = P.whisker;
      ctx.lineWidth = 0.009;
      for (let w = 0; w < 4; w++) {
        const side = w < 2 ? -1 : 1,
          dy = w % 2 ? 0.026 : -0.008;
        ctx.beginPath();
        ctx.moveTo(mx + side * 0.12, 0.135 + dy + my);
        ctx.quadraticCurveTo(mx + side * 0.24, 0.115 + dy * 2 + my, mx + side * 0.33, 0.12 + dy * 2.6 + my);
        ctx.stroke();
      }
    }
    if (lod > 0) {
      if (mood === 'worried') ellipse(ctx, 0.3, -0.1, 0.026, 0.042, 'rgba(140,210,255,0.9)');
      if (mood === 'tired') ellipse(ctx, -0.31, -0.06, 0.022, 0.034, 'rgba(140,210,255,0.85)');
      if (mood === 'surprised') {
        ctx.strokeStyle = '#ffe26b';
        ctx.lineWidth = 0.018;
        for (const a of [-0.5, -0.2, 0.1]) {
          ctx.beginPath();
          ctx.moveTo(0.36 * Math.cos(a - 1.2), -0.38 + 0.36 * Math.sin(a - 1.2) * 0.4);
          ctx.lineTo(0.46 * Math.cos(a - 1.2), -0.44 + 0.46 * Math.sin(a - 1.2) * 0.4);
          ctx.stroke();
        }
      }
    }
    if (mood === 'sleepy' && lod > 0) {
      ctx.fillStyle = '#e8eefc';
      ctx.font = 'bold 0.14px Nunito, sans-serif';
      ctx.fillText('z', 0.3, -0.24 - ((S.t * 0.3) % 0.2));
    }
  }

  // ----- the helmet glass and head-slot items (head frame) -----
  function helmetKind(look) {
    const w = wearOf(look);
    if (w.head && WEAR[w.head]?.helmet) return WEAR[w.head].helmet;
    if (look.outfit) return 'none';
    if (w.suit === 'outfit-pajama' && !w.head) return 'none';
    return 'bubble';
  }
  function drawHelmet(ctx, look, kind, lod, t) {
    if (kind === 'none') return;
    const cat = kind === 'cat',
      gold = kind === 'star';
    if (lod > 0) {
      ctx.fillStyle = cachedGrad(ctx, 'glass', () => {
        const g = ctx.createRadialGradient(-0.14, -0.2, 0.02, 0, -0.04, 0.5);
        g.addColorStop(0, 'rgba(255,255,255,0.24)');
        g.addColorStop(0.62, 'rgba(190,230,255,0.05)');
        g.addColorStop(1, 'rgba(170,220,255,0.26)');
        return g;
      });
      ctx.beginPath();
      ctx.arc(0, -0.04, 0.48, 0, TAU);
      ctx.fill();
    }
    if (cat) {
      // glass cat ears on the dome
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(side * 0.2, -0.44);
        ctx.quadraticCurveTo(side * 0.3, -0.66, side * 0.36, -0.68);
        ctx.quadraticCurveTo(side * 0.4, -0.52, side * 0.38, -0.33);
        ctx.fillStyle = 'rgba(210,236,255,0.32)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(235,248,255,0.9)';
        ctx.lineWidth = 0.024;
        ctx.stroke();
        ellipse(ctx, side * 0.335, -0.6, 0.026, 0.04, '#ff9ecb', side * 0.3);
      }
    }
    ctx.strokeStyle = gold ? 'rgba(255,215,122,0.98)' : cat ? 'rgba(255,190,220,0.95)' : 'rgba(225,242,255,0.8)';
    ctx.lineWidth = gold || cat ? 0.034 : lod > 0 ? 0.024 : 0.03;
    ctx.beginPath();
    ctx.arc(0, -0.04, 0.48, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 0.036;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, -0.04, 0.39, Math.PI * 1.16, Math.PI * 1.36);
    ctx.stroke();
    if (lod > 0) ellipse(ctx, -0.33, -0.12, 0.016, 0.016, 'rgba(255,255,255,0.75)');
    if (gold) {
      star(ctx, 0.3, -0.38, 0.075, '#ffd77a');
      if (lod > 0) {
        star(ctx, -0.36, 0.22, 0.03, '#fff1b8');
        star(ctx, 0.4, 0.1, 0.022, '#fff1b8');
      }
    }
  }
  // the top of what the head wears (antenna base, headband): the glass dome or the head itself
  const headTop = kind => (kind === 'none' ? -0.29 : -0.52);
  function drawHeadItems(ctx, look, S, kind, lod) {
    const w = wearOf(look),
      id = w.head,
      t = S.t;
    if (id === 'acc-cute-antenna') {
      const top = headTop(kind),
        sway = S.antenna;
      ctx.strokeStyle = '#d8e6ff';
      ctx.lineWidth = 0.022;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0.12, top + 0.02);
      ctx.quadraticCurveTo(0.2, top - 0.1, 0.14 + sway, top - 0.19);
      ctx.stroke();
      ellipse(ctx, 0.12, top + 0.02, 0.04, 0.02, '#b8c4e8');
      heart(ctx, 0.14 + sway, top - 0.225, 0.045, '#ff7aa8');
      if (lod > 0) ellipse(ctx, 0.125 + sway, top - 0.245, 0.01, 0.008, 'rgba(255,255,255,0.8)');
    } else if (id === 'acc-headphones') {
      const r = kind === 'none' ? 0.36 : 0.5,
        cy = kind === 'none' ? -0.02 : -0.04;
      ctx.strokeStyle = '#c4b3ff';
      ctx.lineWidth = 0.05;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, cy, r, Math.PI * 1.08, Math.PI * 1.92);
      ctx.stroke();
      if (lod > 0) {
        ctx.strokeStyle = '#efe8ff';
        ctx.lineWidth = 0.016;
        ctx.beginPath();
        ctx.arc(0, cy, r, Math.PI * 1.2, Math.PI * 1.45);
        ctx.stroke();
      }
      for (const side of [-1, 1]) {
        const x = side * r * 0.98;
        oEllipse(ctx, x, cy + 0.06, 0.08, 0.11, '#ff9ecb', '#b8558a', lod > 0 ? 0.014 : 0);
        ellipse(ctx, x + side * 0.012, cy + 0.06, 0.045, 0.07, '#ffd0e4');
        // cat-ear tips on the cups
        ctx.fillStyle = '#ff9ecb';
        ctx.beginPath();
        ctx.moveTo(x - 0.05, cy - 0.03);
        ctx.lineTo(x + side * 0.02, cy - 0.12);
        ctx.lineTo(x + 0.05, cy - 0.03);
        ctx.fill();
        if (lod > 0 && Math.sin(t * 3 + side) > 0.2) ellipse(ctx, x, cy + 0.06, 0.012, 0.012, '#8ff0d4');
      }
    } else if (id === 'acc-petal-crown') {
      // a ring of six blossoms with leaves over the head (or the glass); each blossom sways on its own
      const r = kind === 'none' ? 0.34 : 0.49,
        cy = kind === 'none' ? -0.02 : -0.04;
      ctx.strokeStyle = '#4f9a5a';
      ctx.lineWidth = 0.022;
      ctx.beginPath();
      ctx.arc(0, cy, r, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const a = Math.PI * (1.12 + i * 0.152),
          x = Math.cos(a) * r,
          y = cy + Math.sin(a) * r,
          sway = S.calm ? 0 : Math.sin(t * 2.2 + i * 1.3) * 0.18;
        if (i < 5 && lod > 0) ellipse(ctx, Math.cos(a + 0.08) * r, cy + Math.sin(a + 0.08) * r - 0.01, 0.03, 0.014, '#7fd08a', a + 0.8);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(sway);
        const petal = i % 2 ? '#ffb3d1' : '#ff8fbd';
        for (let p = 0; p < 5; p++) {
          const pa = (p / 5) * TAU;
          ellipse(ctx, Math.cos(pa) * 0.034, Math.sin(pa) * 0.034, 0.03, 0.02, petal, pa);
        }
        ellipse(ctx, 0, 0, 0.018, 0.018, '#ffe08a');
        ctx.restore();
      }
    }
  }
  function drawFaceItems(ctx, look, S, lod) {
    const id = wearOf(look).face;
    if (!id) return;
    const fx = S.gx * 0.045,
      eyeY = 0.045 + S.gy * 0.03;
    if (id === 'acc-explorer-goggles') {
      // round brass-rim glasses on the eyes (the eyes stay visible through tinted lenses)
      ctx.strokeStyle = '#7a5a2a';
      ctx.lineWidth = 0.022;
      ctx.beginPath();
      ctx.moveTo(-0.34 + fx, eyeY - 0.02);
      ctx.lineTo(-0.225 + fx, eyeY - 0.01);
      ctx.moveTo(0.34 + fx, eyeY - 0.02);
      ctx.lineTo(0.225 + fx, eyeY - 0.01);
      ctx.moveTo(-0.04 + fx, eyeY - 0.015);
      ctx.quadraticCurveTo(fx, eyeY - 0.04, 0.04 + fx, eyeY - 0.015);
      ctx.stroke();
      for (const side of [-1, 1]) {
        const x = side * 0.132 + fx;
        ctx.fillStyle = 'rgba(170,230,255,0.22)';
        ctx.strokeStyle = '#d9a64a';
        ctx.lineWidth = 0.026;
        ctx.beginPath();
        ctx.arc(x, eyeY, 0.098, 0, TAU);
        ctx.fill();
        ctx.stroke();
        if (lod > 0) {
          ctx.strokeStyle = 'rgba(255,255,255,0.7)';
          ctx.lineWidth = 0.012;
          ctx.beginPath();
          ctx.arc(x, eyeY, 0.07, Math.PI * 1.15, Math.PI * 1.45);
          ctx.stroke();
        }
      }
    } else if (id === 'acc-pilot-visor') {
      // a sleek tinted band across the eyes
      ctx.fillStyle = cachedGrad(ctx, 'visor', () => {
        const g = ctx.createLinearGradient(0, -0.06, 0, 0.14);
        g.addColorStop(0, 'rgba(255,200,90,0.62)');
        g.addColorStop(1, 'rgba(255,120,150,0.5)');
        return g;
      });
      ctx.beginPath();
      ctx.moveTo(-0.3 + fx, eyeY - 0.07);
      ctx.quadraticCurveTo(fx, eyeY - 0.12, 0.3 + fx, eyeY - 0.07);
      ctx.quadraticCurveTo(0.33 + fx, eyeY + 0.04, 0.24 + fx, eyeY + 0.085);
      ctx.quadraticCurveTo(fx, eyeY + 0.06, -0.24 + fx, eyeY + 0.085);
      ctx.quadraticCurveTo(-0.33 + fx, eyeY + 0.04, -0.3 + fx, eyeY - 0.07);
      ctx.fill();
      ctx.strokeStyle = '#3a3a5e';
      ctx.lineWidth = 0.02;
      ctx.stroke();
      if (lod > 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        ctx.lineWidth = 0.014;
        ctx.beginPath();
        ctx.moveTo(-0.2 + fx, eyeY - 0.06);
        ctx.lineTo(-0.08 + fx, eyeY - 0.075);
        ctx.stroke();
      }
    } else if (id === 'acc-frost-visor') {
      // an ice-crystal visor: pale blue glass, a rime edge of small facets along the top, a glint that wanders across
      ctx.fillStyle = cachedGrad(ctx, 'frostvisor', () => {
        const g = ctx.createLinearGradient(0, -0.08, 0, 0.12);
        g.addColorStop(0, 'rgba(232,251,255,0.75)');
        g.addColorStop(1, 'rgba(127,220,255,0.45)');
        return g;
      });
      ctx.beginPath();
      ctx.moveTo(-0.31 + fx, eyeY - 0.06);
      ctx.lineTo(0.31 + fx, eyeY - 0.06);
      ctx.quadraticCurveTo(0.33 + fx, eyeY + 0.05, 0.22 + fx, eyeY + 0.08);
      ctx.lineTo(-0.22 + fx, eyeY + 0.08);
      ctx.quadraticCurveTo(-0.33 + fx, eyeY + 0.05, -0.31 + fx, eyeY - 0.06);
      ctx.fill();
      ctx.strokeStyle = '#6fc8ea';
      ctx.lineWidth = 0.016;
      ctx.stroke();
      // the rime: little crystal points along the top edge
      ctx.fillStyle = '#f2fdff';
      ctx.beginPath();
      for (let i = 0; i < 7; i++) {
        const x = -0.27 + i * 0.09 + fx,
          hgt = i % 2 ? 0.035 : 0.055;
        ctx.moveTo(x - 0.025, eyeY - 0.058);
        ctx.lineTo(x, eyeY - 0.058 - hgt);
        ctx.lineTo(x + 0.025, eyeY - 0.058);
      }
      ctx.fill();
      if (lod > 0) {
        // the glint: a soft light line crossing the glass every few seconds (it rests with calm motion)
        const g = S.calm ? 0.35 : ((S.t * 0.45) % 1.6) / 1.6,
          gx = -0.3 + g * 0.6 + fx;
        if (g < 1) {
          ctx.strokeStyle = 'rgba(255,255,255,0.85)';
          ctx.lineWidth = 0.02;
          ctx.beginPath();
          ctx.moveTo(gx - 0.03, eyeY + 0.07);
          ctx.lineTo(gx + 0.03, eyeY - 0.05);
          ctx.stroke();
        }
      }
    } else if (id === 'acc-holo-monocle') {
      // one holographic lens on the right eye, with a scan line and a little chain
      const x = 0.132 + fx,
        scan = lod > 0 && !S.calm ? Math.sin(S.t * 2.4) * 0.06 : 0;
      ctx.fillStyle = 'rgba(95,242,217,0.2)';
      ctx.strokeStyle = '#5ff2d9';
      ctx.lineWidth = 0.022;
      ctx.beginPath();
      ctx.arc(x, eyeY, 0.105, 0, TAU);
      ctx.fill();
      ctx.stroke();
      if (lod > 0) {
        ctx.strokeStyle = 'rgba(95,242,217,0.75)';
        ctx.lineWidth = 0.01;
        ctx.beginPath();
        ctx.moveTo(x - 0.08, eyeY + scan);
        ctx.lineTo(x + 0.08, eyeY + scan);
        ctx.stroke();
        for (let i = 0; i < 3; i++) ellipse(ctx, x + 0.135 + i * 0.03, eyeY - 0.07 + i * 0.022, 0.009, 0.009, 'rgba(95,242,217,0.8)');
        ctx.strokeStyle = '#d9c46a';
        ctx.setLineDash([0.016, 0.012]);
        ctx.beginPath();
        ctx.moveTo(x + 0.1, eyeY + 0.03);
        ctx.quadraticCurveTo(x + 0.17, eyeY + 0.2, x + 0.06, eyeY + 0.25);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }
  // character-own head accessories (Beta 1.x looks; hidden when a worn cosmetic takes their slot)
  function drawBuiltinHead(ctx, look, S, lod) {
    const acc = builtin(look);
    if (!acc) return;
    if (acc === 'antenna') {
      const sway = S.antenna;
      ctx.strokeStyle = '#d8e6ff';
      ctx.lineWidth = 0.022;
      ctx.beginPath();
      ctx.moveTo(0.12, -0.5);
      ctx.quadraticCurveTo(0.2, -0.62, 0.14 + sway, -0.7);
      ctx.stroke();
      ellipse(ctx, 0.14 + sway, -0.71, 0.038, 0.038, Math.sin(S.t * 4) > 0 ? '#ffe26b' : '#ff9ecb');
    } else if (acc === 'goggles') {
      ctx.strokeStyle = '#4a3a2a';
      ctx.lineWidth = 0.032;
      ctx.beginPath();
      ctx.moveTo(-0.34, -0.13);
      ctx.lineTo(0.34, -0.13);
      ctx.stroke();
      for (const x of [-0.12, 0.12]) {
        oEllipse(ctx, x, -0.145, 0.085, 0.068, '#c88a4a', '#7a5022', lod > 0 ? 0.012 : 0);
        ellipse(ctx, x, -0.145, 0.062, 0.048, 'rgba(160,230,255,0.88)');
        if (lod > 0) ellipse(ctx, x - 0.02, -0.16, 0.016, 0.012, 'rgba(255,255,255,0.85)');
      }
    } else if (acc === 'bow') {
      ctx.fillStyle = '#ff7aa8';
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(0.19, -0.22);
        ctx.quadraticCurveTo(0.19 + side * 0.08, -0.33, 0.19 + side * 0.11, -0.27);
        ctx.quadraticCurveTo(0.19 + side * 0.12, -0.17, 0.19, -0.22);
        ctx.fill();
      }
      ellipse(ctx, 0.19, -0.22, 0.034, 0.034, '#ffd0e0');
    } else if (acc === 'cap') {
      ctx.fillStyle = '#ffd77a';
      ctx.beginPath();
      ctx.ellipse(0, -0.2, 0.27, 0.15, 0, Math.PI, 0);
      ctx.fill();
      ellipse(ctx, 0.17, -0.2, 0.18, 0.045, '#d19a2e', 0.08);
      if (lod > 0) {
        ellipse(ctx, 0, -0.34, 0.03, 0.02, '#d19a2e');
        star(ctx, -0.08, -0.26, 0.04, '#fff4d0');
      }
    } else if (acc === 'visor') {
      ctx.fillStyle = 'rgba(255,120,140,0.48)';
      ctx.beginPath();
      ctx.moveTo(-0.29, -0.02);
      ctx.quadraticCurveTo(0, -0.08, 0.29, -0.02);
      ctx.lineTo(0.27, 0.08);
      ctx.quadraticCurveTo(0, 0.04, -0.27, 0.08);
      ctx.closePath();
      ctx.fill();
      if (lod > 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 0.012;
        ctx.beginPath();
        ctx.moveTo(-0.2, -0.02);
        ctx.lineTo(-0.06, -0.04);
        ctx.stroke();
      }
    }
  }
  // role hats and goggles sit on the head under the glass dome
  function drawInnerHead(ctx, look, S, lod) {
    const id = wearOf(look).head;
    if (!id || !WEAR[id]?.inner) return;
    if (id === 'role-cap') {
      ctx.fillStyle = '#ff8a2a';
      ctx.beginPath();
      ctx.ellipse(0, -0.2, 0.27, 0.15, 0, Math.PI, 0);
      ctx.fill();
      ellipse(ctx, 0.17, -0.2, 0.18, 0.045, '#d9612a', 0.08);
      if (lod > 0) ctx.fillStyle = '#fff1a8', ctx.fillRect(-0.24, -0.235, 0.48, 0.03);
    } else if (id === 'role-hardhat') {
      ctx.fillStyle = '#ffcc33';
      ctx.beginPath();
      ctx.ellipse(0, -0.17, 0.29, 0.22, 0, Math.PI, 0);
      ctx.fill();
      ellipse(ctx, 0, -0.17, 0.35, 0.05, '#d9a52a');
      ctx.strokeStyle = '#d9a52a';
      ctx.lineWidth = 0.025;
      ctx.beginPath();
      ctx.moveTo(0, -0.38);
      ctx.lineTo(0, -0.2);
      ctx.stroke();
      ellipse(ctx, 0, -0.3, 0.055, 0.045, '#fff6c0');
      if (lod > 0 && !S.calm) ellipse(ctx, 0, -0.3, 0.09, 0.075, 'rgba(255,246,192,0.35)');
    } else if (id === 'role-goggles') {
      ctx.strokeStyle = '#3a4258';
      ctx.lineWidth = 0.03;
      ctx.beginPath();
      ctx.moveTo(-0.34, -0.14);
      ctx.lineTo(0.34, -0.14);
      ctx.stroke();
      for (const x of [-0.12, 0.12]) {
        ellipse(ctx, x, -0.15, 0.08, 0.064, '#5f7590');
        ellipse(ctx, x, -0.15, 0.058, 0.044, 'rgba(255,214,90,0.9)');
      }
    }
  }
  function drawNightcap(ctx, look, S, lod) {
    // the pajama's floppy nightcap with a moon pompom (only while the head slot is free)
    ctx.fillStyle = '#3a4a8e';
    ctx.beginPath();
    ctx.moveTo(-0.3, -0.16);
    ctx.quadraticCurveTo(-0.22, -0.46, 0.08, -0.44);
    ctx.quadraticCurveTo(0.34, -0.42, 0.44, -0.2 + S.antenna * 0.6);
    ctx.quadraticCurveTo(0.3, -0.3, 0.3, -0.16);
    ctx.closePath();
    ctx.fill();
    ellipse(ctx, 0, -0.17, 0.33, 0.055, '#ffe08a');
    star(ctx, 0.44, -0.2 + S.antenna * 0.6, 0.06, '#ffe08a');
    if (lod > 0) {
      star(ctx, -0.1, -0.33, 0.025, '#ffe08a');
      star(ctx, 0.12, -0.36, 0.02, '#ffe08a');
    }
  }

  // ----- Manager outfits (business kittens): look.outfit = { jacket, tie, bowtie, glasses, hat, hatColor, item, badge } -----
  function drawOutfitBody(ctx, o, cy, rx, ry) {
    if (!o.jacket) return;
    ellipse(ctx, 0, cy, rx * 1.03, ry * 1.02, o.jacket);
    // white shirt V + lapels
    const top = cy - ry * 0.86,
      tip = cy + ry * 0.05;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-rx * 0.42, top);
    ctx.lineTo(rx * 0.42, top);
    ctx.lineTo(0, tip);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = shade(o.jacket, 0.7);
    ctx.lineWidth = rx * 0.07;
    ctx.beginPath();
    ctx.moveTo(-rx * 0.42, top);
    ctx.lineTo(0, tip);
    ctx.lineTo(rx * 0.42, top);
    ctx.stroke();
    ellipse(ctx, 0, cy + ry * 0.3, rx * 0.07, rx * 0.07, 'rgba(255,255,255,0.75)');
    ellipse(ctx, 0, cy + ry * 0.58, rx * 0.07, rx * 0.07, 'rgba(255,255,255,0.75)');
    if (o.tie) {
      ctx.fillStyle = o.tie;
      ctx.beginPath();
      ctx.moveTo(-rx * 0.1, top + ry * 0.12);
      ctx.lineTo(rx * 0.1, top + ry * 0.12);
      ctx.lineTo(rx * 0.17, tip - ry * 0.18);
      ctx.lineTo(0, tip + ry * 0.02);
      ctx.lineTo(-rx * 0.17, tip - ry * 0.18);
      ctx.closePath();
      ctx.fill();
      ellipse(ctx, 0, top + ry * 0.08, rx * 0.13, ry * 0.09, shade(o.tie, 0.85));
    }
    if (o.bowtie) {
      ctx.fillStyle = o.bowtie;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(0, top + ry * 0.1);
        ctx.lineTo(side * rx * 0.32, top - ry * 0.02);
        ctx.lineTo(side * rx * 0.32, top + ry * 0.24);
        ctx.closePath();
        ctx.fill();
      }
      ellipse(ctx, 0, top + ry * 0.1, rx * 0.08, rx * 0.08, shade(o.bowtie, 0.8));
    }
    if (o.badge) star(ctx, -rx * 0.55, cy - ry * 0.35, rx * 0.2, '#ffd77a');
  }
  function drawOutfitHead(ctx, o, hy, t) {
    if (o.glasses) {
      ctx.strokeStyle = '#3a3048';
      ctx.lineWidth = 0.02;
      for (const x of [-0.13, 0.13]) {
        ctx.fillStyle = 'rgba(200,235,255,0.22)';
        ctx.beginPath();
        ctx.arc(x, hy + 0.045, 0.095, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(-0.035, hy + 0.04);
      ctx.quadraticCurveTo(0, hy + 0.015, 0.035, hy + 0.04);
      ctx.stroke();
    }
    const hat = o.hatColor || '#ffcc33';
    if (o.hat === 'hardhat') {
      ctx.fillStyle = hat;
      ctx.beginPath();
      ctx.ellipse(0, hy - 0.17, 0.28, 0.22, 0, Math.PI, 0);
      ctx.fill();
      ellipse(ctx, 0, hy - 0.17, 0.35, 0.05, shade(hat, 0.82));
      ctx.strokeStyle = shade(hat, 0.75);
      ctx.lineWidth = 0.025;
      ctx.beginPath();
      ctx.moveTo(0, hy - 0.38);
      ctx.lineTo(0, hy - 0.2);
      ctx.stroke();
      if (o.item === 'lamp') {
        ellipse(ctx, 0, hy - 0.29, 0.055, 0.045, '#fff6c0');
        ctx.fillStyle = 'rgba(255,246,192,0.25)';
        ctx.beginPath();
        ctx.moveTo(0.03, hy - 0.31);
        ctx.lineTo(0.42, hy - 0.42 + Math.sin(t * 2) * 0.02);
        ctx.lineTo(0.42, hy - 0.18 + Math.sin(t * 2) * 0.02);
        ctx.closePath();
        ctx.fill();
      }
    } else if (o.hat === 'cap') {
      ellipse(ctx, 0, hy - 0.22, 0.26, 0.11, hat);
      ellipse(ctx, 0.17, hy - 0.18, 0.17, 0.045, shade(hat, 0.75));
    } else if (o.hat === 'tophat') {
      ellipse(ctx, 0.04, hy - 0.24, 0.27, 0.06, hat);
      ctx.fillStyle = hat;
      ctx.fillRect(-0.12, hy - 0.52, 0.32, 0.28);
      ctx.fillStyle = '#ffd23a';
      ctx.fillRect(-0.12, hy - 0.32, 0.32, 0.06);
      star(ctx, 0.2, hy - 0.3, 0.05, '#ff9ecb');
    } else if (o.hat === 'pilot') {
      ellipse(ctx, 0, hy - 0.24, 0.28, 0.12, hat);
      ellipse(ctx, 0, hy - 0.16, 0.26, 0.05, '#1f2a22');
      star(ctx, 0, hy - 0.25, 0.05, '#ffd77a');
    } else if (o.hat === 'goggles') {
      ctx.strokeStyle = '#4a3a2a';
      ctx.lineWidth = 0.032;
      ctx.beginPath();
      ctx.moveTo(-0.34, hy - 0.15);
      ctx.lineTo(0.34, hy - 0.15);
      ctx.stroke();
      for (const x of [-0.12, 0.12]) {
        ellipse(ctx, x, hy - 0.16, 0.085, 0.068, '#c88a4a');
        ellipse(ctx, x, hy - 0.16, 0.062, 0.048, 'rgba(160,230,255,0.88)');
      }
    }
  }
  function drawHeldItem(ctx, item, x, y, t) {
    ctx.save();
    ctx.translate(x, y);
    if (item === 'clipboard') {
      ctx.rotate(-0.15);
      ctx.fillStyle = '#b8875a';
      ctx.fillRect(-0.06, -0.15, 0.12, 0.16);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-0.045, -0.13, 0.09, 0.125);
      ctx.fillStyle = '#9aa0b4';
      ctx.fillRect(-0.03, -0.165, 0.06, 0.03);
      ctx.fillStyle = '#c4b3ff';
      for (const ly of [-0.1, -0.075, -0.05]) ctx.fillRect(-0.03, ly, 0.06, 0.008);
    } else if (item === 'briefcase') {
      ctx.strokeStyle = '#5a3a24';
      ctx.lineWidth = 0.018;
      ctx.beginPath();
      ctx.arc(0, 0.02, 0.035, Math.PI, 0);
      ctx.stroke();
      ctx.fillStyle = '#7a4a2a';
      ctx.fillRect(-0.085, 0.02, 0.17, 0.12);
      ctx.fillStyle = '#ffd23a';
      ctx.fillRect(-0.015, 0.06, 0.03, 0.025);
    } else if (item === 'wrench') {
      ctx.rotate(-0.6);
      ctx.strokeStyle = '#c9d6ea';
      ctx.lineWidth = 0.03;
      ctx.beginPath();
      ctx.moveTo(0, 0.04);
      ctx.lineTo(0, -0.17);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -0.2, 0.04, Math.PI * 0.3, Math.PI * 2.7);
      ctx.stroke();
    } else if (item === 'flag') {
      ctx.strokeStyle = '#a0785a';
      ctx.lineWidth = 0.02;
      ctx.beginPath();
      ctx.moveTo(0, 0.05);
      ctx.lineTo(0, -0.26);
      ctx.stroke();
      const wave = Math.sin(t * 9) * 0.025;
      ctx.fillStyle = '#ff7a3a';
      ctx.beginPath();
      ctx.moveTo(0, -0.26);
      ctx.quadraticCurveTo(0.08, -0.25 + wave, 0.15, -0.22);
      ctx.lineTo(0, -0.16);
      ctx.closePath();
      ctx.fill();
    } else if (item === 'lever') {
      // elevator control lever with a red knob
      ctx.strokeStyle = '#6f7da8';
      ctx.lineWidth = 0.035;
      ctx.beginPath();
      ctx.moveTo(0, -0.02);
      ctx.lineTo(0.05, -0.2);
      ctx.stroke();
      ellipse(ctx, 0.055, -0.21, 0.045, 0.045, '#ff6b7a');
      ellipse(ctx, 0, -0.01, 0.06, 0.03, '#3a3a5e');
    } else if (item === 'flask') {
      ctx.fillStyle = 'rgba(220,240,255,0.85)';
      ctx.fillRect(-0.015, -0.13, 0.03, 0.06);
      ellipse(ctx, 0, -0.04, 0.055, 0.05, 'rgba(220,240,255,0.85)');
      ellipse(ctx, 0, -0.03, 0.042, 0.032, '#ff9ecb');
    }
    ctx.restore();
  }

  // ----- Beta 1.3: mining motion with a real contact point -----
  // 'mine' (pickaxe) and 'drill' (hand drill) are phase-based cycles — ready → wind-up → accelerated swing → impact →
  // recoil → return — and toolTip() returns the striking point in kitten-local units after every transform drawKitten
  // applies (lean rotation, arm position, tool rotation). The mine scene places each miner so that this point lands on
  // the rock face at the impact phase. Purely visual: production never depends on the cycle. P1 keeps this transform
  // chain unchanged (no bob or lift in these two poses), so the contact stays exact.
  const MINE_CYCLE = 0.7;
  const PICK_TIP = [0.16 * Math.cos(Math.PI * 1.8), -0.17 + 0.16 * Math.sin(Math.PI * 1.8)];
  const DRILL_TIP = [0.26, 0.008];
  const MINE_KEYS = {
    ready: { arm: [0.2, -0.31], tool: 0.15, lean: 0 },
    wind: { arm: [0.07, -0.45], tool: -1.2, lean: -0.07 },
    impact: { arm: [0.27, -0.26], tool: 1.05, lean: 0.09 },
    recoil: { arm: [0.25, -0.28], tool: 0.82, lean: 0.06 }
  };
  const ease = {
    outQuad: p => 1 - (1 - p) * (1 - p),
    inCubic: p => p * p * p,
    inOut: p => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2),
    outBack: p => 1 + 2.2 * Math.pow(p - 1, 3) + 1.2 * Math.pow(p - 1, 2)
  };
  function mix(a, b, p) {
    return { arm: [a.arm[0] + (b.arm[0] - a.arm[0]) * p, a.arm[1] + (b.arm[1] - a.arm[1]) * p], tool: a.tool + (b.tool - a.tool) * p, lean: a.lean + (b.lean - a.lean) * p };
  }
  function minePhase(t, seed = 1) {
    const u = (t + seed * 0.237) / MINE_CYCLE;
    return u - Math.floor(u);
  }
  const MINE_IMPACT = [0.4, 0.48];
  function mineMotion(u) {
    const K = MINE_KEYS;
    if (u < 0.28) return mix(K.ready, K.wind, ease.outQuad(u / 0.28));
    if (u < MINE_IMPACT[0]) return mix(K.wind, K.impact, ease.inCubic((u - 0.28) / 0.12));
    if (u < MINE_IMPACT[1]) {
      const s = Math.sin(((u - MINE_IMPACT[0]) / (MINE_IMPACT[1] - MINE_IMPACT[0])) * Math.PI) * 0.012;
      return { arm: K.impact.arm, tool: K.impact.tool, lean: K.impact.lean + s };
    }
    if (u < 0.58) return mix(K.impact, K.recoil, ease.outQuad((u - MINE_IMPACT[1]) / 0.1));
    return mix(K.recoil, K.ready, ease.inOut((u - 0.58) / 0.42));
  }
  function drillMotion(t, seed = 1) {
    const buzz = Math.sin(t * 60 + seed) * 0.004;
    const push = Math.max(0, Math.sin(t * 2.4 + seed)) * 0.015;
    return { arm: [0.27 - 0.015 + push, -0.25 + buzz], tool: -0.02, lean: 0.05 + push };
  }
  function rotate([x, y], a) {
    const c = Math.cos(a),
      s = Math.sin(a);
    return [x * c - y * s, x * s + y * c];
  }
  function motionTip(motion, tip) {
    const handTip = rotate(tip, motion.tool);
    return rotate([motion.arm[0] + handTip[0], motion.arm[1] + handTip[1]], motion.lean);
  }
  /**
   * Striking point of the tool in kitten-local units (before the caller's translate/scale), facing applied.
   * opts.phase overrides the time-derived phase ('impact' = the contact pose). Returns null for poses without contact.
   */
  function toolTip(pose, opts = {}) {
    const facing = opts.facing === -1 ? -1 : 1;
    let p;
    if (pose === 'mine') {
      const u = opts.phase === 'impact' ? (MINE_IMPACT[0] + MINE_IMPACT[1]) / 2 : minePhase(opts.t || 0, opts.seed || 1);
      p = motionTip(mineMotion(u), PICK_TIP);
    } else if (pose === 'drill') p = motionTip(drillMotion(opts.t || 0, opts.seed || 1), DRILL_TIP);
    else return null;
    return [p[0] * facing, p[1]];
  }
  function mineImpact(t, seed = 1) {
    const u = minePhase(t, seed);
    return u >= MINE_IMPACT[0] && u < MINE_IMPACT[1];
  }

  function drawTool(ctx, tool, angle, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    if (tool === 'drill') {
      ctx.fillStyle = '#8f9ab3';
      ctx.fillRect(-0.03, -0.022, 0.17, 0.06);
      ctx.fillStyle = '#ffd77a';
      ctx.beginPath();
      ctx.moveTo(0.14, -0.035);
      ctx.lineTo(0.26, 0.008);
      ctx.lineTo(0.14, 0.052);
      ctx.closePath();
      ctx.fill();
    } else if (tool === 'pick') {
      ctx.strokeStyle = '#a0785a';
      ctx.lineWidth = 0.036;
      ctx.beginPath();
      ctx.moveTo(0, 0.02);
      ctx.lineTo(0, -0.3);
      ctx.stroke();
      ctx.strokeStyle = '#d6e2f2';
      ctx.lineWidth = 0.046;
      ctx.beginPath();
      ctx.arc(0, -0.17, 0.16, Math.PI * 1.2, Math.PI * 1.8);
      ctx.stroke();
      ctx.fillStyle = '#eef5ff';
      ctx.beginPath();
      ctx.arc(PICK_TIP[0], PICK_TIP[1], 0.022, 0, TAU);
      ctx.fill();
    } else if (tool === 'hammer') {
      ctx.strokeStyle = '#a0785a';
      ctx.lineWidth = 0.03;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -0.2);
      ctx.stroke();
      ctx.fillStyle = '#c9d6ea';
      ctx.fillRect(-0.06, -0.26, 0.12, 0.07);
    } else if (tool === 'crystal') {
      ctx.fillStyle = '#c4b3ff';
      ctx.beginPath();
      ctx.moveTo(0, -0.14);
      ctx.lineTo(0.075, 0);
      ctx.lineTo(0, 0.06);
      ctx.lineTo(-0.075, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillRect(-0.015, -0.1, 0.02, 0.07);
    } else if (tool === 'crate') {
      ctx.fillStyle = '#ffc95a';
      ctx.fillRect(-0.1, -0.16, 0.2, 0.15);
      ctx.strokeStyle = '#c98a2a';
      ctx.lineWidth = 0.015;
      ctx.strokeRect(-0.1, -0.16, 0.2, 0.15);
    }
    ctx.restore();
  }
  function neckerchief(ctx, x, y, half, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - half, y);
    ctx.lineTo(x + half, y);
    ctx.lineTo(x + half * 0.15, y + half * 0.9);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(x + half * 0.55, y + half * 0.12, half * 0.16, 0, TAU);
    ctx.fill();
  }
  function rimHalo(ctx, rim, cy, rx, ry) {
    ctx.fillStyle = cachedGrad(ctx, 'halo:' + rim, () => {
      const g = ctx.createRadialGradient(0, cy, 0, 0, cy, Math.max(rx, ry));
      g.addColorStop(0.55, rim.replace(/[\d.]+\)$/, '0.26)'));
      g.addColorStop(1, rim.replace(/[\d.]+\)$/, '0)'));
      return g;
    });
    ctx.beginPath();
    ctx.ellipse(0, cy, rx, ry, 0, 0, TAU);
    ctx.fill();
  }

  // ----- P1 animation 3.0: one state object per frame (reused; drawing is synchronous) -----
  const S = { t: 0, mood: 'neutral', blink: 0, gx: 0, gy: 0, ow: 0.016, lift: 0, squash: 1, lean: 0, bob: 0, headX: 0, headY: 0, headTilt: 0, earL: 0, earR: 0, tailSway: 0, tailTip: 0, tailUp: 0, tailPuff: 1, armL: [0, 0], armR: [0, 0], footL: 0, footR: 0, liftL: 0, liftR: 0, antenna: 0, sparkle: false, open: false, calm: false, act: null, actP: 0, crouch: 0, sitting: false, sleeping: false };
  const POSE_MOOD = { cheer: 'happy', hop: 'happy', discover: 'happy', worried: 'worried', work: 'focus', mine: 'focus', drill: 'focus', construct: 'focus', operate: 'focus', push: 'focus', pull: 'focus', surprised: 'surprised', sleep: 'sleepy', check: 'curious' };
  // rare personality moments while idle: deterministic per kitten (seeded), short, never two neighbours at once
  // P1.4: the crew's own moments – Boba (the calm guard with the visor) salutes and stands proud, Pip (the courier with
  // the cap) tips the cap and hops, Tikki (the pilot with goggles) pushes the goggles up
  const ACTS = { mochi: ['helmet', 'stretch', 'groom'], void: ['stargaze', 'groom', 'stargaze'], boba: ['salute', 'proud', 'groom'], pip: ['captip', 'hop', 'look'], tikki: ['goggles', 'stretch', 'look'], any: ['groom', 'stretch', 'look', 'yawn'] };
  function idleAct(t, seed, who) {
    const period = 17 + ((seed * 7.3) % 11),
      u = t + seed * 3.1,
      phase = u % period;
    if (phase > 2.8) return null;
    const list = ACTS[who] || ACTS.any;
    return { act: list[Math.floor(u / period) % list.length], p: phase / 2.8 };
  }
  const bump = p => Math.sin(Math.min(1, Math.max(0, p)) * Math.PI);
  function animate(look, pose, o) {
    const t = o.t || 0,
      seed = o.seed || 1,
      calm = Boolean(o.calm);
    S.t = t;
    S.calm = calm;
    S.mood = o.mood || POSE_MOOD[pose] || 'neutral';
    S.blink = S.mood === 'happy' || S.mood === 'sleepy' ? 0 : blinkAmount(t, seed);
    S.gx = o.gaze || 0;
    S.gy = 0;
    S.lift = 0;
    S.squash = 1;
    S.lean = 0;
    S.bob = Math.sin(t * 2.2 + seed) * 0.012; // breathing
    S.headX = 0;
    S.headY = 0;
    S.headTilt = 0;
    S.earL = 0;
    S.earR = Math.sin(t * 0.7 + seed) > 0.96 ? 0.25 : 0; // the old ear twitch
    S.tailSway = Math.sin(t * 2 + seed) * 0.12;
    S.tailTip = Math.sin(t * 2 + seed - 0.9) * 0.16;
    S.tailUp = 0;
    S.tailPuff = 1;
    S.footL = 0;
    S.footR = 0;
    S.liftL = 0;
    S.liftR = 0;
    S.sparkle = false;
    S.open = false;
    S.act = null;
    S.crouch = 0;
    S.turn = 0;
    S.antenna = Math.sin(t * 3 + seed) * 0.025;
    let L = S.armL,
      R = S.armR;
    L[0] = -0.19;
    L[1] = -0.2;
    R[0] = 0.19;
    R[1] = -0.2;
    // the mood moves the ears: down when worried or tired, up when surprised, one tilted when curious
    if (S.mood === 'worried' || S.mood === 'tired') S.earL = S.earR = 0.32;
    else if (S.mood === 'surprised') S.earL = S.earR = -0.12;
    else if (S.mood === 'curious') S.earR = -0.16;
    else if (S.mood === 'focus') S.earL = S.earR = 0.1;
    const swing = Math.sin(t * 8 + seed);
    const walkish = pose === 'walk' || pose === 'carry' || pose === 'push' || pose === 'pull' || (o.walking && pose !== 'mine' && pose !== 'drill');
    if (walkish) {
      // a real step: feet lift in arcs, the body is highest with the feet together, the head lags a little
      const heavy = pose === 'carry' && o.hold ? 1 : pose === 'push' || pose === 'pull' ? 0.6 : 0,
        rate = 9 - heavy * 2.2,
        ph = t * rate + seed,
        s = Math.sin(ph),
        stride = 0.055 - heavy * 0.018;
      S.footL = s * stride;
      S.footR = -s * stride;
      S.liftL = Math.max(0, Math.cos(ph)) * (0.032 - heavy * 0.01);
      S.liftR = Math.max(0, -Math.cos(ph)) * (0.032 - heavy * 0.01);
      const up = 1 - Math.abs(s);
      S.lift = up * (0.026 - heavy * 0.01);
      S.squash = 1 - (1 - up) * (0.025 + heavy * 0.025);
      S.headY = (1 - Math.abs(Math.sin(ph - 0.5))) * 0.012;
      S.headTilt = s * 0.03;
      S.earL = S.earL - Math.cos(2 * ph) * 0.05;
      S.earR = S.earR + Math.cos(2 * ph) * 0.05;
      S.tailSway = Math.sin(ph * 0.5) * 0.14;
      S.tailTip = Math.sin(ph * 0.5 - 0.9) * 0.18;
      S.antenna = Math.sin(ph - 1) * 0.045;
      S.lean = pose === 'walk' || o.walking ? 0.06 : 0;
      // a 3/4 turn while walking: the face looks where it goes and back pieces move behind the shoulder, so packs,
      // capes and glasses stay readable in motion (the rig has no real side view)
      if (o.gaze === undefined) S.gx = 0.45;
      S.turn = 1;
      L[0] = -0.18 - s * 0.05;
      L[1] = -0.2 + Math.abs(s) * 0.012;
      R[0] = 0.18 + s * 0.05;
      R[1] = -0.2 + Math.abs(s) * 0.012;
    }
    switch (pose) {
      case 'sit':
      case 'idle': {
        // P1.2: sitting (on a crate, on the ground): paws rest on the knees, the same personality moments as standing
        if (pose === 'sit') {
          L[0] = -0.11;
          L[1] = -0.2;
          R[0] = 0.11;
          R[1] = -0.2;
        }
        // weight shifts now and then; rare personality moments
        S.lean = Math.sin(t * 0.45 + seed * 1.7) * (pose === 'sit' ? 0.012 : 0.02);
        S.headTilt = Math.sin(t * 0.38 + seed) * 0.045;
        const act = calm ? null : idleAct(t, seed, o.who || look.id);
        if (act) {
          S.act = act.act;
          S.actP = act.p;
          const b = bump(act.p);
          if (act.act === 'helmet') {
            // Mochi straightens the helmet with both paws
            L[0] = -0.4;
            L[1] = -0.72 + Math.sin(act.p * 18) * 0.015 * b;
            R[0] = 0.4;
            R[1] = -0.72 - Math.sin(act.p * 18) * 0.015 * b;
            S.headTilt = Math.sin(act.p * 9) * 0.08 * b;
            S.mood = act.p > 0.75 ? 'proud' : 'focus';
          } else if (act.act === 'stargaze') {
            S.gy = -1 * b;
            S.headTilt = -0.12 * b;
            S.headY = -0.015 * b;
            S.tailSway *= 0.4;
            S.mood = 'curious';
            S.sparkle = b > 0.6;
          } else if (act.act === 'groom') {
            // a paw to the ear, eyes closed
            R[0] = 0.25;
            R[1] = -0.78 + Math.sin(act.p * 22) * 0.03 * b;
            S.headTilt = 0.14 * b;
            S.earR = 0.2 * b;
            S.mood = 'happy';
          } else if (act.act === 'stretch') {
            const s2 = b;
            L[0] = -0.28;
            L[1] = -0.2 - 0.6 * s2;
            R[0] = 0.28;
            R[1] = -0.2 - 0.6 * s2;
            S.squash = 1 + 0.06 * s2;
            S.mood = s2 > 0.5 ? 'sleepy' : 'neutral';
          } else if (act.act === 'look') {
            S.gx = Math.sin(act.p * Math.PI * 2) * b;
            S.headTilt = S.gx * 0.08;
            S.mood = 'curious';
          } else if (act.act === 'yawn') {
            S.mood = b > 0.5 ? 'surprised' : 'tired';
            S.headTilt = -0.06 * b;
          } else if (act.act === 'salute') {
            // a short salute: the right paw to the brow, chin up
            R[0] = 0.24;
            R[1] = -0.2 - 0.52 * b;
            S.headTilt = -0.05 * b;
            S.mood = b > 0.4 ? 'proud' : 'neutral';
          } else if (act.act === 'proud') {
            // paws on the hips, chest out
            L[0] = -0.3;
            L[1] = -0.12;
            R[0] = 0.3;
            R[1] = -0.12;
            S.squash = 1 + 0.05 * b;
            S.mood = 'proud';
          } else if (act.act === 'captip') {
            // a paw to the cap's brim, a little nod
            R[0] = 0.2;
            R[1] = -0.2 - 0.6 * b + Math.sin(act.p * 14) * 0.02 * b;
            S.headTilt = 0.1 * b;
            S.headY = 0.01 * b;
            S.mood = 'happy';
          } else if (act.act === 'hop') {
            // two small hops on the spot
            const h = Math.abs(Math.sin(act.p * Math.PI * 2));
            S.bob -= 0.05 * h * b;
            S.squash = 1 - 0.06 * (1 - h) * b;
            S.tailUp = 0.2 * b;
            S.mood = 'happy';
          } else if (act.act === 'goggles') {
            // both paws push the goggles up the forehead
            L[0] = -0.3;
            L[1] = -0.2 - 0.55 * b;
            R[0] = 0.3;
            R[1] = -0.2 - 0.55 * b;
            S.gy = -0.4 * b;
            S.mood = 'focus';
          }
        }
        break;
      }
      case 'check':
        L[0] = 0.1;
        L[1] = -0.31 + Math.sin(t * 1.5) * 0.01;
        R[0] = 0.2;
        R[1] = -0.26;
        S.headTilt = 0.08;
        S.gy = 0.5;
        break;
      case 'carry':
        if (o.hold) {
          // a load held against the chest (opts.hold draws it): paws on its sides, short heavy steps, leaning back a
          // little against the weight, the tail up for balance
          L[0] = -0.175;
          L[1] = -0.29 + S.bob;
          R[0] = 0.175;
          R[1] = -0.29 + S.bob;
          S.tailUp = 0.08;
          S.lean = -0.045;
          S.mood = o.mood || 'focus';
        } else {
          // hugging the item in front of the belly, leaning back a little against its weight
          L[0] = -0.08;
          L[1] = -0.22;
          R[0] = 0.08;
          R[1] = -0.22;
          S.lean = -0.04;
          S.tailUp = 0.05;
        }
        break;
      case 'push':
      case 'pull': {
        // paws on the handle (opts.grip in kitten units, facing applied by the caller) or a default grip
        const g = o.grip;
        if (pose === 'push') {
          S.lean = 0.16;
          R[0] = g ? g[0] : 0.34;
          R[1] = g ? g[1] : -0.4;
          L[0] = R[0] - 0.06;
          L[1] = R[1] + 0.03;
        } else {
          S.lean = 0.12;
          R[0] = 0.2 + Math.sin(t * 7 + seed) * 0.03;
          R[1] = -0.22;
          L[0] = g ? g[0] : -0.32;
          L[1] = g ? g[1] : -0.34;
        }
        S.tailUp = 0.06;
        break;
      }
      case 'unload': {
        // phase 0..1 (opts.phase): get ready (crouch) → tip/put down (paws forward, lean in) → a small happy finish
        const p = typeof o.phase === 'number' ? Math.min(1, Math.max(0, o.phase)) : (t * 0.8 + seed * 0.3) % 1;
        if (p < 0.25) {
          const q = ease.inOut(p / 0.25);
          S.crouch = q;
          S.squash = 1 - 0.07 * q;
          S.lean = 0.08 * q;
          L[0] = -0.06;
          L[1] = -0.36;
          R[0] = 0.08;
          R[1] = -0.36;
          S.mood = 'focus';
        } else if (p < 0.75) {
          const q = ease.inOut((p - 0.25) / 0.5);
          S.squash = 0.93 + 0.03 * q;
          S.lean = 0.08 + 0.12 * Math.sin(q * Math.PI);
          L[0] = 0.1 + 0.18 * q;
          L[1] = -0.36 + 0.14 * q;
          R[0] = 0.18 + 0.16 * q;
          R[1] = -0.34 + 0.12 * q;
          S.mood = 'focus';
        } else {
          // done: up, a paw-dust and a happy little bounce
          const q = (p - 0.75) / 0.25;
          S.lift = bump(q) * 0.06;
          S.squash = 1 + bump(q) * 0.03;
          L[0] = -0.2 - 0.05 * Math.sin(q * 20);
          L[1] = -0.26;
          R[0] = 0.2 + 0.05 * Math.sin(q * 20);
          R[1] = -0.26;
          S.mood = 'happy';
          S.tailUp = 0.08;
        }
        break;
      }
      case 'work':
        R[0] = 0.24;
        R[1] = -0.27 + swing * 0.07;
        L[0] = 0.14;
        L[1] = -0.23 + swing * 0.05;
        S.lean = Math.sin(t * 8 + seed) * 0.05;
        S.headY = Math.max(0, swing) * 0.008;
        break;
      case 'construct':
        R[0] = 0.22;
        R[1] = -0.4 - Math.max(0, swing) * 0.08;
        L[0] = 0.12;
        L[1] = -0.22;
        S.lean = Math.sin(t * 8 + seed) * 0.05;
        break;
      case 'operate':
        L[0] = 0.17;
        L[1] = -0.27 + Math.sin(t * 3) * 0.02;
        R[0] = 0.24;
        R[1] = -0.27 - Math.sin(t * 3) * 0.02;
        S.gy = 0.4;
        break;
      case 'cheer':
      case 'discover':
      case 'hop': {
        // anticipation squash → jump with stretch → land squash
        const ph = (t * 7 + seed) % Math.PI,
          air = Math.sin(ph);
        S.lift = air * (pose === 'hop' ? 0.18 : 0.1);
        S.squash = air > 0.85 ? 1.05 : air < 0.2 ? 0.94 : 1;
        if (pose !== 'hop') {
          L[0] = -0.38;
          L[1] = -0.5 + Math.sin(t * 7) * 0.05;
          R[0] = 0.38;
          R[1] = -0.5 - Math.sin(t * 7) * 0.05;
        }
        S.earL = S.earR = -0.08;
        S.tailUp = 0.1;
        S.tailSway = Math.sin(t * 9 + seed) * 0.2;
        if (pose === 'discover') {
          // big eyes first, then joy
          const first = (t % 2.4) < 0.5;
          S.mood = o.mood || (first ? 'surprised' : 'happy');
          S.sparkle = !first;
          S.open = true;
        }
        break;
      }
      case 'wave':
      case 'signal': {
        const w = Math.sin(t * 10);
        R[0] = 0.34 + w * 0.03;
        R[1] = -0.56 + w * 0.05;
        S.headTilt = 0.07;
        S.tailUp = 0.05;
        S.tailSway = Math.sin(t * 4 + seed) * 0.16;
        if (!o.mood) S.mood = 'happy';
        break;
      }
      case 'stamp':
        R[0] = 0.2;
        R[1] = -0.3 - Math.max(0, Math.sin(t * 6)) * 0.12;
        L[0] = 0.12;
        L[1] = -0.22;
        break;
      case 'worried':
      case 'surprised':
        L[0] = -0.11;
        L[1] = -0.4;
        R[0] = 0.11;
        R[1] = -0.4;
        if (pose === 'surprised') {
          S.lift = 0.04;
          S.tailPuff = 1.6;
          S.tailUp = 0.12;
          S.squash = 1.03;
        } else {
          S.headTilt = Math.sin(t * 1.3 + seed) * 0.05;
          S.squash = 0.98;
        }
        break;
      case 'sleep':
        L[0] = -0.12;
        L[1] = -0.18;
        R[0] = 0.12;
        R[1] = -0.18;
        S.bob = Math.sin(t * 1.1 + seed) * 0.016;
        S.tailSway = Math.sin(t * 0.8 + seed) * 0.08;
        S.earL = S.earR = 0.18;
        break;
      default:
        break;
    }
    if (calm) {
      // reduced motion: keep the pose, drop the secondary wobble
      S.tailSway *= 0.3;
      S.tailTip *= 0.3;
      S.antenna *= 0.3;
      S.headTilt *= 0.5;
    }
    return S;
  }

  // ----- body, limbs, tail (body frame) -----
  function drawTail(ctx, look, P, lod) {
    const sway = S.tailSway,
      tip = S.tailTip,
      up = S.tailUp,
      w = 0.085 * S.tailPuff;
    const sx = -0.36 + sway * 0.5 + tip * 0.3,
      sy = -0.42 - up - (S.mood === 'happy' ? 0.04 : 0);
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(-0.12, -0.13);
      ctx.quadraticCurveTo(-0.42, -0.15 + sway, sx, sy);
    };
    ctx.lineCap = 'round';
    if (lod > 0) {
      ctx.strokeStyle = P.line;
      ctx.lineWidth = w + S.ow * 2;
      path();
      ctx.stroke();
    }
    ctx.strokeStyle = look.fur;
    ctx.lineWidth = w;
    path();
    ctx.stroke();
    if (look.tailRings || look.pattern === 'tabby') {
      ctx.strokeStyle = look.mark;
      ctx.setLineDash([0.05, 0.06]);
      path();
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (look.tailTip) ellipse(ctx, sx, sy, w * 0.5, w * 0.5, look.tailTip);
  }
  function drawLegs(ctx, look, P, lod) {
    const sleeping = S.sleeping || S.sitting;
    const legY = -0.125 + S.crouch * 0.03;
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1,
        dx = i ? S.footR : S.footL,
        up = i ? S.liftR : S.liftL,
        // sitting: the feet stick out a little in front and apart (the body sits on the ground behind them)
        fx = S.sitting ? side * 0.12 : side * 0.075 + dx,
        fy = S.sitting ? -0.06 : -0.022 - up;
      if (!sleeping) {
        if (lod > 1) capsule(ctx, side * 0.07, legY, fx, fy - 0.01, 0.055 + S.ow, P.suitLine);
        capsule(ctx, side * 0.07, legY, fx, fy - 0.01, 0.055, look.suitDark);
      }
      const sock = look.pattern === 'socks' ? '#ffffff' : look.fur;
      oEllipse(ctx, fx, fy, 0.072, 0.044, sock, P.line, lod > 1 ? S.ow : 0);
      if (lod > 1) {
        ctx.strokeStyle = shade(sock, 0.72);
        ctx.lineWidth = 0.008;
        ctx.beginPath();
        ctx.moveTo(fx + 0.012, fy + 0.006);
        ctx.lineTo(fx + 0.014, fy + 0.03);
        ctx.moveTo(fx + 0.04, fy + 0.002);
        ctx.lineTo(fx + 0.042, fy + 0.026);
        ctx.stroke();
      }
    }
  }
  function drawArm(ctx, look, P, lod, hand, sx) {
    const sy = -0.33 + S.bob,
      sleeve = wearOf(look).suit === 'outfit-pyra' ? null : look.suit;
    // the sleeve ends a little before the paw (Pyra rolls the sleeves up: fur forearms)
    const ex = sx + (hand[0] - sx) * 0.72,
      ey = sy + (hand[1] - sy) * 0.72;
    if (lod > 1) capsule(ctx, sx, sy, hand[0], hand[1], 0.05 + S.ow, P.suitLine);
    if (sleeve) capsule(ctx, sx, sy, hand[0], hand[1], 0.05, sleeve);
    else {
      capsule(ctx, sx, sy, hand[0], hand[1], 0.046, look.fur);
      capsule(ctx, sx, sy, ex, ey, 0.052, look.suit);
    }
    const mitten = wearOf(look).suit === 'outfit-glacies';
    oEllipse(ctx, hand[0], hand[1], 0.052, 0.049, mitten ? '#3fd0d8' : look.fur, P.line, lod > 1 ? S.ow : 0);
  }
  function drawBody(ctx, look, P, lod) {
    const by = -0.255 + S.bob,
      cut = WEAR[wearOf(look).suit]?.cut;
    // the suit: a soft pear (belly a little wider than the chest), shaded from the top light
    if (lod > 0) ellipse(ctx, 0, by + 0.02, 0.19 + S.ow, 0.175 + S.ow, P.suitLine);
    const fill = lod > 0 ? cachedGrad(ctx, 'suit:' + look.suit + look.suitDark, () => {
      const g = ctx.createLinearGradient(-0.1, -0.44, 0.08, -0.08);
      g.addColorStop(0, P.suitHi);
      g.addColorStop(0.35, look.suit);
      g.addColorStop(1, look.suitDark);
      return g;
    }) : look.suit;
    ellipse(ctx, 0, by + 0.08, 0.2, 0.09, fill);
    ellipse(ctx, 0, by, 0.185, 0.165, fill);
    if (cut === 'viridia') {
      // the lab coat flares at the hem
      ctx.fillStyle = look.suit;
      ctx.beginPath();
      ctx.moveTo(-0.17, by - 0.02);
      ctx.lineTo(-0.24, by + 0.15);
      ctx.quadraticCurveTo(0, by + 0.2, 0.24, by + 0.15);
      ctx.lineTo(0.17, by - 0.02);
      ctx.fill();
      ctx.strokeStyle = look.suitDark;
      ctx.lineWidth = 0.014;
      ctx.stroke();
    }
    // a fur bib under the collar (the cream chest of the cast) and the suit's collar ring where the helmet seals
    ellipse(ctx, 0, by - 0.115, 0.08, 0.05, look.fur2);
    if (helmetKind(look) !== 'none') {
      oEllipse(ctx, 0, by - 0.15, 0.13, 0.038, '#e3e9f6', '#9aa6c4', lod > 1 ? 0.012 : 0);
      if (lod > 1) ellipse(ctx, -0.05, by - 0.16, 0.035, 0.01, 'rgba(255,255,255,0.8)');
    }
    // the waist line in the accent colour
    if (look.accent && cut !== 'miner' && cut !== 'pajama') {
      ctx.strokeStyle = look.accent;
      ctx.lineWidth = 0.025;
      ctx.beginPath();
      ctx.arc(0, by, 0.15, Math.PI * 0.18, Math.PI * 0.82);
      ctx.stroke();
    }
    if (cut) SUIT_DRAW[cut]?.(ctx, look, P, lod, by);
    else if (lod > 1 && look.emblem && !look.outfit) emblem(ctx, look.emblem, 0.075, by - 0.04, 0.048, look.accent, lod);
  }
  // small chest emblems (one per character): a quick identity read even in a crowd
  function emblem(ctx, kind, x, y, r, color, lod) {
    oEllipse(ctx, x, y, r, r, color, 'rgba(0,0,0,0.18)', lod > 1 ? 0.008 : 0);
    const ink = '#ffffff';
    if (kind === 'star') star(ctx, x, y, r * 0.62, ink);
    else if (kind === 'heart') heart(ctx, x, y - r * 0.05, r * 0.42, ink);
    else if (kind === 'moon') {
      ellipse(ctx, x, y, r * 0.55, r * 0.55, ink);
      ellipse(ctx, x + r * 0.25, y - r * 0.15, r * 0.48, r * 0.48, color);
    } else if (kind === 'bolt') {
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.moveTo(x + r * 0.15, y - r * 0.6);
      ctx.lineTo(x - r * 0.35, y + r * 0.1);
      ctx.lineTo(x, y + r * 0.1);
      ctx.lineTo(x - r * 0.15, y + r * 0.6);
      ctx.lineTo(x + r * 0.35, y - r * 0.1);
      ctx.lineTo(x, y - r * 0.1);
      ctx.fill();
    } else if (kind === 'shield') {
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.45, y - r * 0.45);
      ctx.lineTo(x + r * 0.45, y - r * 0.45);
      ctx.quadraticCurveTo(x + r * 0.45, y + r * 0.3, x, y + r * 0.6);
      ctx.quadraticCurveTo(x - r * 0.45, y + r * 0.3, x - r * 0.45, y - r * 0.45);
      ctx.fill();
    } else if (kind === 'box') {
      ctx.fillStyle = ink;
      ctx.fillRect(x - r * 0.42, y - r * 0.38, r * 0.84, r * 0.76);
      ctx.fillStyle = color;
      ctx.fillRect(x - r * 0.08, y - r * 0.38, r * 0.16, r * 0.76);
    } else if (kind === 'leaf') {
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.5, y + r * 0.4);
      ctx.quadraticCurveTo(x - r * 0.4, y - r * 0.5, x + r * 0.5, y - r * 0.5);
      ctx.quadraticCurveTo(x + r * 0.4, y + r * 0.4, x - r * 0.5, y + r * 0.4);
      ctx.fill();
    } else if (kind === 'atom') {
      ctx.strokeStyle = ink;
      ctx.lineWidth = r * 0.16;
      for (const a of [0, 1.05, 2.1]) {
        ctx.beginPath();
        ctx.ellipse(x, y, r * 0.62, r * 0.22, a, 0, TAU);
        ctx.stroke();
      }
    } else ellipse(ctx, x, y, r * 0.4, r * 0.4, ink);
  }
  // ----- outfits: each one its own cut and details (drawn over the suit base, body frame) -----
  const SUIT_DRAW = {
    courier(ctx, look, P, lod, by) {
      // a high-vis vest: two reflective bands and a pocket with a delivery slip
      ctx.fillStyle = '#fff6c8';
      ctx.fillRect(-0.17, by - 0.02, 0.34, 0.035);
      ctx.fillRect(-0.15, by + 0.06, 0.3, 0.03);
      if (lod > 0) {
        ctx.fillStyle = '#d9772a';
        ctx.fillRect(0.04, by - 0.11, 0.08, 0.07);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0.055, by - 0.13, 0.05, 0.04);
      }
    },
    tech(ctx, look, P, lod, by) {
      // an overall with a tool belt and a wrench badge
      ctx.fillStyle = '#3a4258';
      ctx.fillRect(-0.19, by + 0.04, 0.38, 0.04);
      ellipse(ctx, 0, by + 0.06, 0.03, 0.025, look.accent);
      if (lod > 0) {
        oEllipse(ctx, -0.08, by - 0.06, 0.04, 0.04, look.accent, 'rgba(0,0,0,0.2)', 0.006);
        ctx.strokeStyle = '#3a4258';
        ctx.lineWidth = 0.012;
        ctx.beginPath();
        ctx.moveTo(-0.1, by - 0.04);
        ctx.lineTo(-0.065, by - 0.075);
        ctx.stroke();
      }
    },
    rose(ctx, look, P, lod, by) {
      // white piping on the collar and a heart chest panel
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.02;
      ctx.beginPath();
      ctx.arc(0, by - 0.02, 0.165, Math.PI * 1.2, Math.PI * 1.8);
      ctx.stroke();
      heart(ctx, 0.07, by - 0.03, 0.05, '#ffffff');
      if (lod > 0) heart(ctx, 0.07, by - 0.03, 0.03, '#ff8fbd');
    },
    explorer(ctx, look, P, lod, by) {
      // a utility vest with two flap pockets, a compass badge and a coral bandana knot
      ctx.fillStyle = shade(look.suitDark, 0.92);
      ctx.beginPath();
      ctx.moveTo(-0.15, by - 0.1);
      ctx.lineTo(-0.035, by - 0.12);
      ctx.lineTo(-0.03, by + 0.12);
      ctx.lineTo(-0.16, by + 0.08);
      ctx.closePath();
      ctx.moveTo(0.15, by - 0.1);
      ctx.lineTo(0.035, by - 0.12);
      ctx.lineTo(0.03, by + 0.12);
      ctx.lineTo(0.16, by + 0.08);
      ctx.closePath();
      ctx.fill();
      for (const x of [-0.095, 0.095]) {
        ctx.fillStyle = look.suit;
        ctx.fillRect(x - 0.04, by + 0.01, 0.08, 0.06);
        ctx.fillStyle = look.suitDark;
        ctx.fillRect(x - 0.042, by + 0.005, 0.084, 0.018);
      }
      if (lod > 0) {
        oEllipse(ctx, -0.095, by - 0.055, 0.026, 0.026, '#fff4e2', '#7a5a2a', 0.008);
        ctx.strokeStyle = '#ff6b5a';
        ctx.lineWidth = 0.008;
        ctx.beginPath();
        ctx.moveTo(-0.095, by - 0.07);
        ctx.lineTo(-0.095, by - 0.04);
        ctx.stroke();
      }
      ctx.fillStyle = look.accent;
      ctx.beginPath();
      ctx.moveTo(-0.07, by - 0.15);
      ctx.lineTo(0.07, by - 0.15);
      ctx.lineTo(0.015, by - 0.08);
      ctx.closePath();
      ctx.fill();
      ellipse(ctx, 0, by - 0.145, 0.028, 0.02, shade(look.accent, 0.85));
    },
    stellar(ctx, look, P, lod, by) {
      // cream suit sprinkled with little gold stars, a gold collar and a research emblem
      for (const [x, y, r] of [[-0.12, -0.04, 0.026], [0.13, 0.05, 0.022], [-0.06, 0.09, 0.02], [0.1, -0.1, 0.018], [-0.15, 0.06, 0.016]]) star(ctx, x, by + y, r, look.accent);
      ctx.strokeStyle = look.accent;
      ctx.lineWidth = 0.022;
      ctx.beginPath();
      ctx.arc(0, by - 0.02, 0.162, Math.PI * 1.22, Math.PI * 1.78);
      ctx.stroke();
      emblem(ctx, 'atom', 0.045, by - 0.02, 0.052, '#6a8aff', lod);
    },
    miner(ctx, look, P, lod, by) {
      // a bib overall: straps with buttons, a front pocket with a crystal, stitched seams, knee patches (legs)
      const bib = shade(look.suit, 0.78);
      ctx.fillStyle = bib;
      ctx.beginPath();
      ctx.moveTo(-0.1, by - 0.06);
      ctx.lineTo(0.1, by - 0.06);
      ctx.lineTo(0.13, by + 0.1);
      ctx.quadraticCurveTo(0, by + 0.16, -0.13, by + 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = bib;
      ctx.lineWidth = 0.035;
      ctx.beginPath();
      ctx.moveTo(-0.085, by - 0.05);
      ctx.lineTo(-0.11, by - 0.15);
      ctx.moveTo(0.085, by - 0.05);
      ctx.lineTo(0.11, by - 0.15);
      ctx.stroke();
      ellipse(ctx, -0.085, by - 0.055, 0.016, 0.016, '#ffd77a');
      ellipse(ctx, 0.085, by - 0.055, 0.016, 0.016, '#ffd77a');
      ctx.fillStyle = shade(look.suit, 0.65);
      ctx.fillRect(-0.06, by + 0.01, 0.12, 0.07);
      ctx.fillStyle = look.accent;
      ctx.beginPath();
      ctx.moveTo(0.02, by - 0.03);
      ctx.lineTo(0.045, by + 0.02);
      ctx.lineTo(0.02, by + 0.03);
      ctx.lineTo(-0.005, by + 0.02);
      ctx.closePath();
      ctx.fill();
      if (lod > 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 0.007;
        ctx.setLineDash([0.014, 0.01]);
        ctx.beginPath();
        ctx.moveTo(-0.09, by - 0.045);
        ctx.lineTo(-0.11, by + 0.09);
        ctx.moveTo(0.09, by - 0.045);
        ctx.lineTo(0.11, by + 0.09);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    },
    glacies(ctx, look, P, lod, by) {
      // a padded frost suit: quilted bands, puffy shoulder pads, a fluffy white fur collar, turquoise mittens (arms)
      ctx.strokeStyle = look.suitDark;
      ctx.lineWidth = 0.012;
      for (const dy of [-0.04, 0.03, 0.1]) {
        ctx.beginPath();
        ctx.ellipse(0, by + dy - 0.05, 0.18, 0.06, 0, Math.PI * 0.12, Math.PI * 0.88);
        ctx.stroke();
      }
      oEllipse(ctx, -0.155, by - 0.09, 0.07, 0.06, look.suit, look.suitDark, 0.012);
      oEllipse(ctx, 0.155, by - 0.09, 0.07, 0.06, look.suit, look.suitDark, 0.012);
      ellipse(ctx, -0.155, by - 0.09, 0.03, 0.02, look.accent);
      ellipse(ctx, 0.155, by - 0.09, 0.03, 0.02, look.accent);
      for (let i = 0; i < 7; i++) ellipse(ctx, -0.12 + i * 0.04, by - 0.145 + Math.abs(i - 3) * 0.008, 0.032, 0.028, '#ffffff');
      ctx.strokeStyle = look.accent;
      ctx.lineWidth = 0.02;
      ctx.beginPath();
      ctx.moveTo(0, by - 0.11);
      ctx.lineTo(0, by + 0.14);
      ctx.stroke();
    },
    pyra(ctx, look, P, lod, by) {
      // a work suit: tool belt with buckle and a hanging wrench, a gear badge, hazard stripes on the hem
      ctx.fillStyle = '#5a3a2a';
      ctx.fillRect(-0.19, by + 0.04, 0.38, 0.045);
      ctx.fillStyle = look.accent;
      ctx.fillRect(-0.025, by + 0.035, 0.05, 0.055);
      ctx.fillStyle = '#5a3a2a';
      ctx.fillRect(-0.012, by + 0.05, 0.024, 0.025);
      ctx.save();
      ctx.translate(0.12, by + 0.09);
      ctx.rotate(0.25 + S.footL * 2);
      ctx.strokeStyle = '#c9d6ea';
      ctx.lineWidth = 0.022;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, 0.1);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0.12, 0.024, Math.PI * 1.3, Math.PI * 3.7);
      ctx.stroke();
      ctx.restore();
      if (lod > 0) {
        ctx.fillStyle = '#ffd23a';
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU;
          ctx.lineTo(-0.08 + Math.cos(a) * 0.04, by - 0.06 + Math.sin(a) * 0.04);
          ctx.lineTo(-0.08 + Math.cos(a + 0.39) * 0.028, by - 0.06 + Math.sin(a + 0.39) * 0.028);
        }
        ctx.fill();
        ellipse(ctx, -0.08, by - 0.06, 0.012, 0.012, look.suitDark);
        ctx.fillStyle = '#2a2230';
        for (let i = 0; i < 5; i++) ctx.fillRect(-0.15 + i * 0.07, by + 0.13, 0.03, 0.025);
      }
    },
    viridia(ctx, look, P, lod, by) {
      // leaf lapels, a bio badge, a sprout peeking out of the pocket
      ctx.fillStyle = look.accent;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(side * 0.02, by - 0.13);
        ctx.quadraticCurveTo(side * 0.13, by - 0.15, side * 0.12, by - 0.03);
        ctx.quadraticCurveTo(side * 0.06, by - 0.06, side * 0.02, by - 0.13);
        ctx.fill();
      }
      emblem(ctx, 'leaf', -0.085, by + 0.04, 0.042, look.accent, lod);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0.05, by + 0.03, 0.08, 0.06);
      if (lod > 0) {
        ctx.strokeStyle = '#3f8a4f';
        ctx.lineWidth = 0.012;
        ctx.beginPath();
        ctx.moveTo(0.09, by + 0.03);
        ctx.quadraticCurveTo(0.09, by - 0.02, 0.1 + S.antenna, by - 0.04);
        ctx.stroke();
        ellipse(ctx, 0.11 + S.antenna, by - 0.045, 0.02, 0.012, '#7fd08a', -0.4);
        ellipse(ctx, 0.075, by - 0.02, 0.016, 0.01, '#7fd08a', 0.5);
      }
    },
    pajama(ctx, look, P, lod, by) {
      // a cosy onesie: moon and star print, a button placket, cuffs
      for (const [x, y, r] of [[-0.12, -0.05, 0.022], [0.12, 0.06, 0.02], [-0.04, 0.1, 0.018], [0.14, -0.08, 0.016]]) star(ctx, x, by + y, r, look.accent);
      ellipse(ctx, -0.1, by + 0.04, 0.026, 0.026, look.accent);
      ellipse(ctx, -0.09, by + 0.035, 0.022, 0.022, look.suit);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 0.012;
      ctx.beginPath();
      ctx.moveTo(0.02, by - 0.11);
      ctx.lineTo(0.02, by + 0.13);
      ctx.stroke();
      for (const y of [-0.06, 0.0, 0.06]) ellipse(ctx, 0.02, by + y, 0.013, 0.013, '#fff4d0');
    },
    mekhanos(ctx, look, P, lod, by) {
      // the technician of Mekhanos: riveted shoulder plates, a brass utility belt with a pouch, and a brass gear on the
      // chest that turns (faster at work)
      for (const side of [-1, 1]) {
        ctx.fillStyle = shade(look.suit, 1.15);
        ctx.beginPath();
        ctx.moveTo(side * 0.09, by - 0.15);
        ctx.quadraticCurveTo(side * 0.21, by - 0.15, side * 0.2, by - 0.05);
        ctx.lineTo(side * 0.11, by - 0.07);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = look.suitDark;
        ctx.lineWidth = 0.01;
        ctx.stroke();
        if (lod > 0) for (const [x, y] of [[0.13, -0.12], [0.17, -0.08]]) ellipse(ctx, side * x, by + y, 0.011, 0.011, look.accent);
      }
      ctx.fillStyle = '#5a3f22';
      ctx.fillRect(-0.19, by + 0.04, 0.38, 0.04);
      ctx.fillStyle = look.accent;
      ctx.fillRect(-0.022, by + 0.035, 0.044, 0.05);
      ctx.fillStyle = shade(look.accent, 0.7);
      ctx.fillRect(0.09, by + 0.05, 0.07, 0.06);
      const spin = S.calm ? 0.3 : S.t * (S.mood === 'focus' ? 3.2 : 0.8);
      ctx.save();
      ctx.translate(-0.075, by - 0.04);
      ctx.rotate(spin);
      ctx.fillStyle = look.accent;
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU,
          d = i % 2 ? 0.033 : 0.048;
        i ? ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d) : ctx.moveTo(d, 0);
      }
      ctx.closePath();
      ctx.fill();
      ellipse(ctx, 0, 0, 0.016, 0.016, look.suitDark);
      ctx.restore();
      if (lod > 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 0.008;
        ctx.beginPath();
        ctx.moveTo(0.03, by - 0.11);
        ctx.lineTo(0.03, by + 0.03);
        ctx.stroke();
      }
    },
    navigator(ctx, look, P, lod, by) {
      // a high collar and teal light lines; a star-map panel (the short cape is drawn behind, see drawBackItems)
      ctx.fillStyle = look.suitDark;
      ctx.beginPath();
      ctx.moveTo(-0.13, by - 0.17);
      ctx.lineTo(-0.15, by - 0.08);
      ctx.lineTo(0, by - 0.11);
      ctx.lineTo(0.15, by - 0.08);
      ctx.lineTo(0.13, by - 0.17);
      ctx.closePath();
      ctx.fill();
      const glow = look.accent;
      ctx.strokeStyle = 'rgba(95,242,217,0.3)';
      ctx.lineWidth = 0.03;
      ctx.beginPath();
      ctx.moveTo(-0.15, by - 0.08);
      ctx.lineTo(-0.05, by + 0.13);
      ctx.moveTo(0.15, by - 0.08);
      ctx.lineTo(0.05, by + 0.13);
      ctx.stroke();
      ctx.strokeStyle = glow;
      ctx.lineWidth = 0.011;
      ctx.stroke();
      if (lod > 0) {
        ctx.fillStyle = '#1c1638';
        ctx.beginPath();
        ctx.arc(0, by + 0.01, 0.055, 0, TAU);
        ctx.fill();
        const pts = [[-0.025, -0.01], [0.012, -0.03], [0.03, 0.015], [-0.01, 0.03]];
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 0.005;
        ctx.beginPath();
        pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, by + 0.01 + y) : ctx.moveTo(x, by + 0.01 + y)));
        ctx.stroke();
        for (const [x, y] of pts) ellipse(ctx, x, by + 0.01 + y, 0.008, 0.008, '#ffffff');
      }
    }
  };
  // back-slot pieces behind the body (and the navigator's cape)
  function drawBackItems(ctx, look, P, lod) {
    const w = wearOf(look),
      by = -0.255 + S.bob,
      id = w.back;
    if (w.suit === 'outfit-navigator') {
      // a short cape that trails behind with the motion
      const flow = S.tailSway * 0.3 + S.lean * 0.6;
      ctx.fillStyle = look.suitDark;
      ctx.beginPath();
      ctx.moveTo(-0.12, by - 0.15);
      ctx.quadraticCurveTo(-0.3 - flow, by - 0.02, -0.28 - flow * 1.4, by + 0.17);
      ctx.lineTo(-0.08, by + 0.12);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = look.accent;
      ctx.lineWidth = 0.01;
      ctx.stroke();
    }
    if (!id) {
      // the default small air pack in the suit colour (Beta 1.x look)
      oEllipse(ctx, -0.155, by - 0.02, 0.08, 0.115, look.suitDark, P.suitLine, lod > 1 ? S.ow : 0);
      return;
    }
    if (id === 'acc-star-backpack') {
      oEllipse(ctx, -0.25, by - 0.06, 0.11, 0.14, '#ffd77a', '#c98a2a', lod > 0 ? S.ow : 0);
      ellipse(ctx, -0.27, by + 0.03, 0.08, 0.04, '#f2bb4a');
      star(ctx, -0.29, by - 0.09, 0.05, '#fff6d0');
    } else if (id === 'acc-rocket-pack') {
      for (const dx of [-0.34, -0.23]) {
        oEllipse(ctx, dx, by - 0.06, 0.048, 0.12, '#e9edf7', '#8f9ab3', lod > 0 ? S.ow : 0);
        ctx.fillStyle = '#ff6b7a';
        ctx.beginPath();
        ctx.moveTo(dx - 0.048, by - 0.14);
        ctx.quadraticCurveTo(dx, by - 0.27, dx + 0.048, by - 0.14);
        ctx.fill();
        const flame = S.calm ? 0.03 : 0.04 + (S.lift > 0.02 ? 0.06 : 0) + Math.sin(S.t * 30 + dx * 40) * 0.012;
        ellipse(ctx, dx, by + 0.08 + flame * 0.5, 0.025, flame, '#ffd77a');
        if (lod > 0) ellipse(ctx, dx, by + 0.07 + flame * 0.3, 0.012, flame * 0.5, '#ffffff');
      }
    } else if (id === 'acc-tool-pack') {
      // a wrench and a screwdriver stick out of the pack
      ctx.strokeStyle = '#c9d6ea';
      ctx.lineWidth = 0.022;
      ctx.beginPath();
      ctx.moveTo(-0.28, by - 0.13);
      ctx.lineTo(-0.34, by - 0.29);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-0.35, by - 0.315, 0.026, Math.PI * 0.2, Math.PI * 1.8);
      ctx.stroke();
      ctx.strokeStyle = '#ff9e6b';
      ctx.lineWidth = 0.026;
      ctx.beginPath();
      ctx.moveTo(-0.21, by - 0.13);
      ctx.lineTo(-0.19, by - 0.27);
      ctx.stroke();
      oEllipse(ctx, -0.25, by - 0.05, 0.11, 0.135, '#7a8aa8', '#4a5470', lod > 0 ? S.ow : 0);
      ctx.fillStyle = '#ffd23a';
      ctx.fillRect(-0.33, by - 0.03, 0.14, 0.024);
    } else {
      // scarf and shoulder patch keep the default air pack
      oEllipse(ctx, -0.155, by - 0.02, 0.08, 0.115, look.suitDark, P.suitLine, lod > 0 ? S.ow : 0);
    }
    if (id === 'acc-mint-scarf') {
      // the scarf's tails flutter behind
      const flap = S.tailSway * 0.4 + (S.lift > 0.01 ? 0.05 : 0);
      ctx.fillStyle = '#5fd6b4';
      ctx.beginPath();
      ctx.moveTo(-0.1, by - 0.15);
      ctx.quadraticCurveTo(-0.24, by - 0.14 + flap, -0.32, by - 0.06 + flap);
      ctx.lineTo(-0.27, by - 0.02 + flap);
      ctx.quadraticCurveTo(-0.2, by - 0.08, -0.08, by - 0.1);
      ctx.fill();
    }
  }
  // back-slot pieces in front of the body (straps, the scarf's wrap, the shoulder patch)
  function drawBackFront(ctx, look, P, lod) {
    const id = wearOf(look).back,
      by = -0.255 + S.bob,
      b = builtin(look);
    if (id === 'acc-star-backpack' || id === 'acc-rocket-pack' || id === 'acc-tool-pack') {
      ctx.strokeStyle = id === 'acc-star-backpack' ? '#d99a2a' : '#5a6480';
      ctx.lineWidth = 0.024;
      ctx.beginPath();
      ctx.moveTo(-0.12, by - 0.13);
      ctx.quadraticCurveTo(-0.07, by - 0.04, -0.1, by + 0.06);
      ctx.moveTo(0.12, by - 0.13);
      ctx.quadraticCurveTo(0.09, by - 0.04, 0.11, by + 0.06);
      ctx.stroke();
    } else if (id === 'acc-mint-scarf') {
      ctx.fillStyle = '#7fe6c6';
      ctx.beginPath();
      ctx.ellipse(0, by - 0.145, 0.17, 0.05, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#5fd6b4';
      ctx.fillRect(0.04, by - 0.13, 0.05, 0.11);
      if (lod > 0) {
        ctx.fillStyle = '#ffffff';
        for (const x of [-0.1, -0.03, 0.04, 0.11]) ctx.fillRect(x, by - 0.16, 0.022, 0.03);
      }
    } else if (id === 'acc-ember-bell') {
      // a dark red collar with gold studs; the brass bell swings with the steps and an ember glows in its mouth
      ctx.fillStyle = '#8a2a2a';
      ctx.beginPath();
      ctx.ellipse(0, by - 0.15, 0.16, 0.035, 0, 0, TAU);
      ctx.fill();
      if (lod > 0) for (const x of [-0.11, -0.04, 0.04, 0.11]) ellipse(ctx, x, by - 0.152 + Math.abs(x) * 0.08, 0.01, 0.01, '#ffd77a');
      const swing = S.calm ? 0 : Math.sin(S.t * 5.5) * (0.12 + Math.min(0.3, Math.abs(S.lean) * 2 + (S.lift > 0.01 ? 0.2 : 0)));
      ctx.save();
      // a short ribbon from the collar, the bell on the chest (the head covers the neck)
      ctx.strokeStyle = '#8a2a2a';
      ctx.lineWidth = 0.018;
      ctx.beginPath();
      ctx.moveTo(0, by - 0.14);
      ctx.lineTo(Math.sin(swing) * 0.03, by - 0.085);
      ctx.stroke();
      ctx.translate(0, by - 0.09);
      ctx.rotate(swing);
      ctx.scale(1.6, 1.6);
      ctx.fillStyle = '#e8a83a';
      ctx.beginPath();
      ctx.moveTo(-0.045, 0.065);
      ctx.quadraticCurveTo(-0.045, 0.0, 0, 0.0);
      ctx.quadraticCurveTo(0.045, 0.0, 0.045, 0.065);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#9a5a1a';
      ctx.lineWidth = 0.01;
      ctx.stroke();
      const ember = S.calm ? 0.8 : 0.65 + Math.sin(S.t * 4) * 0.25;
      ctx.globalAlpha = ember;
      ellipse(ctx, 0, 0.066, 0.032, 0.012, '#ff6a2a');
      ellipse(ctx, 0, 0.066, 0.016, 0.007, '#ffe08a');
      ctx.globalAlpha = 1;
      if (lod > 0) ellipse(ctx, -0.015, 0.025, 0.008, 0.016, 'rgba(255,255,255,0.6)');
      ctx.restore();
    } else if (id === 'acc-moon-patch') {
      ellipse(ctx, 0.13, by - 0.09, 0.045, 0.045, '#2c3270');
      ellipse(ctx, 0.13, by - 0.09, 0.03, 0.03, '#ffd77a');
      ellipse(ctx, 0.142, by - 0.1, 0.026, 0.026, '#2c3270');
      if (lod > 0) star(ctx, 0.112, by - 0.06, 0.012, '#ffffff');
    }
    if (b === 'scarf') {
      ctx.fillStyle = '#ff7aa8';
      ctx.fillRect(-0.16, by - 0.165, 0.32, 0.055);
      ctx.fillRect(0.05, by - 0.145, 0.055, 0.13);
    } else if (b === 'neckerchief') neckerchief(ctx, 0, by - 0.16, 0.17, look.accent);
  }

  /** Full-body astronaut kitten. opts: { pose, mood, t, seed, tool, jetpack, facing, walking, px, calm, gaze, grip,
   *  phase, who, overhead } */
  function drawKitten(ctx, look, opts = {}) {
    const pose = opts.pose || 'idle',
      px = opts.px || pxOf(ctx),
      // the named cast (Mochi, Void, crew) gets full detail from 48 px: few of them are on screen at once
      lod = px < 30 ? 0 : px < (look.id ? 48 : 60) ? 1 : 2,
      P = pal(look);
    animate(look, pose, opts);
    // outlines grow a little at small sizes so the silhouette reads; Void and dark workers get their light rim
    S.ow = lod === 0 ? 0 : px < 44 ? 0.024 : 0.016;
    S.sleeping = pose === 'sleep';
    S.sitting = pose === 'sit';
    const motion = pose === 'mine' ? mineMotion(minePhase(S.t, opts.seed || 1)) : pose === 'drill' ? drillMotion(S.t, opts.seed || 1) : null;
    if (motion) {
      S.lean = motion.lean;
      S.armR[0] = motion.arm[0];
      S.armR[1] = motion.arm[1];
      S.armL[0] = motion.arm[0] - 0.07;
      S.armL[1] = motion.arm[1] + 0.05;
      S.lift = 0;
      S.squash = 1;
    }
    ctx.save();
    if (look.rim && lod > 0 && !opts.noRim) rimHalo(ctx, look.rim, -0.48, 0.6, 0.6);
    if (opts.facing === -1) ctx.scale(-1, 1);
    ctx.translate(0, -S.lift);
    ctx.scale(2 - S.squash, S.squash);
    ctx.rotate(S.lean);
    if (S.sleeping) ctx.translate(0, 0.08);
    else if (S.sitting) ctx.translate(0, 0.075);
    if (S.turn) {
      ctx.save();
      ctx.translate(-0.05, -0.01);
      drawBackItems(ctx, look, P, lod);
      ctx.restore();
    } else drawBackItems(ctx, look, P, lod);
    drawTail(ctx, look, P, lod);
    if (opts.jetpack) {
      const flame = 0.07 + Math.sin(S.t * 30 + (opts.seed || 1)) * 0.02;
      ellipse(ctx, -0.17, -0.12, 0.04, flame, '#ffd77a');
      ellipse(ctx, -0.17, -0.13, 0.02, flame * 0.6, '#ffffff');
    }
    // sitting: the feet poke out in front of the body
    if (!S.sitting) drawLegs(ctx, look, P, lod);
    drawBody(ctx, look, P, lod);
    if (S.sitting) drawLegs(ctx, look, P, lod);
    if (look.outfit) drawOutfitBody(ctx, look.outfit, -0.24 + S.bob, 0.18, 0.17);
    drawBackFront(ctx, look, P, lod);
    const L = S.armL,
      R = S.armR,
      upL = L[1] < -0.45,
      upR = R[1] < -0.45;
    if (!upL) drawArm(ctx, look, P, lod, L, -0.13);
    if (!upR) drawArm(ctx, look, P, lod, R, 0.13);
    if (pose === 'carry' && opts.hold) {
      // the carried load in the body frame (it bobs and leans with the kitten), the paws over its sides
      opts.hold(ctx, 0, -0.17 + S.bob);
      oEllipse(ctx, L[0], L[1], 0.052, 0.049, look.fur, P.line, lod > 0 ? S.ow : 0);
      oEllipse(ctx, R[0], R[1], 0.052, 0.049, look.fur, P.line, lod > 0 ? S.ow : 0);
    }
    // head group: bob, lag and tilt; everything on the head follows it
    const kind = helmetKind(look);
    ctx.save();
    ctx.translate(S.headX, -0.72 + S.bob * 0.6 + S.headY + (S.sleeping ? 0.06 : 0) + S.crouch * 0.03);
    ctx.rotate(S.headTilt + (S.sleeping ? -0.18 : 0));
    drawHead(ctx, look, S, lod);
    drawFaceItems(ctx, look, S, lod);
    drawBuiltinHead(ctx, look, S, lod);
    drawInnerHead(ctx, look, S, lod);
    if (wearOf(look).suit === 'outfit-pajama' && !wearOf(look).head && !look.outfit) drawNightcap(ctx, look, S, lod);
    if (look.outfit) drawOutfitHead(ctx, look.outfit, 0, S.t);
    else drawHelmet(ctx, look, kind, lod, S.t);
    drawHeadItems(ctx, look, S, kind, lod);
    ctx.restore();
    if (upL) drawArm(ctx, look, P, lod, L, -0.13);
    if (upR) drawArm(ctx, look, P, lod, R, 0.13);
    if (look.outfit?.item && look.outfit.item !== 'lamp') {
      const hand = look.outfit.item === 'clipboard' || look.outfit.item === 'flask' ? L : R;
      drawHeldItem(ctx, look.outfit.item, hand[0], hand[1], S.t);
    }
    if (pose === 'discover' && lod > 0) star(ctx, 0.36, -1.22 - Math.abs(Math.sin(S.t * 3)) * 0.05, 0.07, '#ffe26b');
    if (pose === 'work') drawTool(ctx, opts.tool || 'drill', 0.3 + Math.sin(S.t * 8 + (opts.seed || 1)) * 0.25, R[0], R[1]);
    if (pose === 'mine') drawTool(ctx, 'pick', motion.tool, R[0], R[1]);
    if (pose === 'drill') drawTool(ctx, 'drill', motion.tool, R[0], R[1]);
    if (pose === 'construct') drawTool(ctx, 'hammer', -0.4 + Math.max(0, Math.sin(S.t * 8 + (opts.seed || 1))) * 0.9, R[0], R[1]);
    if (pose === 'carry' && opts.tool !== 'none' && !opts.hold) {
      drawTool(ctx, opts.tool || 'crystal', 0, 0, -0.15);
      oEllipse(ctx, L[0] - 0.05, L[1] + 0.04, 0.045, 0.045, look.fur, P.line, lod > 0 ? S.ow : 0);
      oEllipse(ctx, R[0] + 0.05, R[1] + 0.04, 0.045, 0.045, look.fur, P.line, lod > 0 ? S.ow : 0);
    }
    ctx.restore();
  }
  /** Where a carried load sits (kitten units from the feet, before facing): against the chest, moving with the step
   *  (the same point drawKitten passes to opts.hold). */
  function holdPoint(opts = {}) {
    animate(opts.look || ROSTER[0], 'carry', { ...opts, hold: true });
    return { x: 0, y: (-0.17 + S.bob) * S.squash - S.lift };
  }

  // Head-and-shoulders portrait (crew cards, dialogs, pilot overlay).
  function drawPortrait(ctx, look, opts = {}) {
    const t = opts.t || 0,
      seed = opts.seed || 1,
      P = pal(look),
      px = opts.px || pxOf(ctx),
      lod = px < 26 ? 0 : px < 50 ? 1 : 2;
    animate(look, 'idle', { mood: opts.mood || 'neutral', t, seed, calm: true, who: 'portrait' });
    S.ow = lod ? 0.014 : 0;
    S.headTilt = 0;
    S.bob = 0;
    if (look.rim && lod > 0) rimHalo(ctx, look.rim, 0.08, 0.62, 0.62);
    const w = wearOf(look);
    // shoulders in the suit
    if (lod > 0) ellipse(ctx, 0, 0.44, 0.4 + S.ow, 0.22 + S.ow, P.suitLine);
    ctx.fillStyle = lod > 0 ? cachedGrad(ctx, 'psuit:' + look.suit + look.suitDark, () => {
      const g = ctx.createLinearGradient(0, 0.1, 0, 0.5);
      g.addColorStop(0, look.suit);
      g.addColorStop(1, look.suitDark);
      return g;
    }) : look.suit;
    ctx.beginPath();
    ctx.ellipse(0, 0.44, 0.4, 0.22, 0, 0, TAU);
    ctx.fill();
    ellipse(ctx, 0, 0.33, 0.13, 0.06, look.fur2);
    if (look.outfit) drawOutfitBody(ctx, look.outfit, 0.46, 0.4, 0.22);
    // the outfit's chest at portrait scale: the body layer scaled into the shoulders
    if (w.suit || w.back) {
      ctx.save();
      ctx.translate(0, 0.66);
      ctx.scale(2.1, 2.1);
      S.bob = 0;
      if (w.suit) SUIT_DRAW[WEAR[w.suit].cut]?.(ctx, look, P, lod, -0.255);
      drawBackFront(ctx, look, P, lod);
      ctx.restore();
    } else {
      if (look.emblem && !look.outfit && lod > 0) emblem(ctx, look.emblem, 0.17, 0.46, 0.07, look.accent, lod);
      const b = builtin(look);
      if (b === 'scarf') {
        ctx.fillStyle = '#ff7aa8';
        ctx.fillRect(-0.25, 0.26, 0.5, 0.07);
      } else if (b === 'neckerchief') neckerchief(ctx, 0, 0.25, 0.27, look.accent);
    }
    const kind = helmetKind(look);
    ctx.save();
    ctx.translate(0, Math.sin(t * 2 + seed) * 0.01);
    ctx.scale(1.15, 1.15);
    drawHead(ctx, look, S, lod);
    drawFaceItems(ctx, look, S, lod);
    drawBuiltinHead(ctx, look, S, lod);
    drawInnerHead(ctx, look, S, lod);
    if (w.suit === 'outfit-pajama' && !w.head && !look.outfit) drawNightcap(ctx, look, S, lod);
    if (look.outfit) drawOutfitHead(ctx, look.outfit, 0, t);
    else drawHelmet(ctx, look, kind, lod, t);
    drawHeadItems(ctx, look, S, kind, lod);
    ctx.restore();
  }

  // ----- dressing: a look with worn cosmetics (cached, so scenes can ask every frame without allocating) -----
  const dressCache = new WeakMap();
  /** look + { head, suit, face, back } (cosmetic ids or null). Unknown ids are ignored. */
  const lastDress = new WeakMap(); // per look: the last slots object asked for (scenes ask every frame with the same one)
  function dressed(look, slots) {
    if (!slots) return look;
    const last = lastDress.get(look);
    if (last && last.slots === slots && last.head === slots.head && last.suit === slots.suit && last.face === slots.face && last.back === slots.back) return last.hit;
    const hit = dressedUncached(look, slots);
    lastDress.set(look, { slots, head: slots.head, suit: slots.suit, face: slots.face, back: slots.back, hit });
    return hit;
  }
  function dressedUncached(look, slots) {
    const head = WEAR[slots.head]?.slot === 'head' ? slots.head : null,
      suit = WEAR[slots.suit]?.slot === 'suit' ? slots.suit : null,
      face = WEAR[slots.face]?.slot === 'face' ? slots.face : null,
      back = WEAR[slots.back]?.slot === 'back' ? slots.back : null;
    if (!head && !suit && !face && !back) return look;
    const key = head + '|' + suit + '|' + face + '|' + back;
    let m = dressCache.get(look);
    if (!m) dressCache.set(look, (m = new Map()));
    let hit = m.get(key);
    if (!hit) {
      const o = suit ? WEAR[suit] : null;
      hit = { ...look, ...(o ? { suit: o.suit, suitDark: o.suitDark, accent: o.accent } : null), wear: Object.freeze({ head, suit, face, back }) };
      if (m.size > 64) m.clear();
      m.set(key, hit);
    }
    return hit;
  }
  /** cosmetic ids → slots (the last id of a slot wins) */
  function slotsOf(ids) {
    const slots = { head: null, suit: null, face: null, back: null };
    for (const id of ids || NO_ACCESSORIES) if (WEAR[id]) slots[WEAR[id].slot] = id;
    return slots;
  }
  // the uniform of a job on a look, plus extra pieces (a planet's gear) — cached like every dressed look
  const roleSets = new Map();
  function roleLook(look, role, extra = null) {
    const base = ROLES[role];
    if (!base) return look;
    const key = role + '|' + (extra ? extra.head + extra.suit + extra.face + extra.back : '');
    let slots = roleSets.get(key);
    if (!slots) {
      slots = Object.freeze({ head: null, suit: null, face: null, back: null, ...base, ...(extra ? Object.fromEntries(Object.entries(extra).filter(([, v]) => v)) : null) });
      roleSets.set(key, slots);
    }
    return dressed(look, slots);
  }
  // P1.2: who a worker is (the colony's mini inspector). Purely presentational and deterministic from the worker's
  // seed – the same kitten keeps its name, style and little quirk; nothing is stored in the save.
  const WORKER_NAMES = ['Tilly', 'Bruno', 'Nori', 'Pixel', 'Kiki', 'Muffin', 'Sushi', 'Krümel', 'Lotte', 'Fips', 'Juno', 'Momo', 'Zimt', 'Wolke', 'Paprika', 'Mika', 'Socke', 'Flocke', 'Bohne', 'Luna', 'Toffee', 'Quirin', 'Rosine', 'Nebel'];
  const WORKER_QUIRKS = ['summt bei der Arbeit', 'sammelt glänzende Steine', 'träumt von Sternschnuppen', 'macht die besten Pfannkuchen', 'zählt jede Kiste doppelt', 'liebt warme Werkstattlampen', 'winkt jeder Lore nach', 'kennt alle Sternbilder', 'trinkt Milch mit Sternenzucker', 'baut Modellraketen', 'hat immer einen Keks dabei', 'schnurrt, wenn alles läuft'];
  const PATTERN_NAMES = { tabby: 'getigert', socks: 'mit Söckchen', calico: 'dreifarbig', plain: 'einfarbig' };
  const ROLE_TITLES = { transport: 'Transportkatze', miner: 'Förderkatze', tech: 'Technikkatze', pilot: 'Pilotenkatze', trade: 'Marktbesuch', rest: 'hat Pause', manager: 'Leitung' };
  const seedHash = n => {
    let x = (Math.floor(Math.abs(n)) + 1) * 2654435761;
    x = (x ^ (x >>> 15)) >>> 0;
    return x;
  };
  function workerCard(look, seed, role) {
    const h = seedHash(seed),
      wear = wearOf(look),
      piece = [wear.head, wear.face, wear.back, wear.suit].map(id => id && WEAR[id]).find(Boolean),
      style = [PATTERN_NAMES[look.pattern] || 'flauschig', piece?.name].filter(Boolean).join(' · ');
    return { name: look.name || WORKER_NAMES[h % WORKER_NAMES.length], role: ROLE_TITLES[role] || '', style, quirk: WORKER_QUIRKS[(h >>> 5) % WORKER_QUIRKS.length] };
  }
  // Beta 1.x entry point: a list of cosmetic ids (accessories and an outfit) on a look
  function withAccessories(look, accessories) {
    if (!accessories || !accessories.length) return look;
    return dressed(look, slotsOf(accessories));
  }

  const portraitCache = new Map();
  function paintPortrait(size, bgTop, bgBottom, centerY, scale, draw) {
    let url = '';
    try {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (ctx && c.toDataURL) {
        const bg = ctx.createRadialGradient(size / 2, size * 0.4, 4, size / 2, size / 2, size * 0.7);
        bg.addColorStop(0, bgTop);
        bg.addColorStop(1, bgBottom);
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, size, size);
        ctx.translate(size / 2, size * centerY);
        ctx.scale(size * scale, size * scale);
        draw(ctx, size * scale);
        url = c.toDataURL('image/png');
      }
    } catch {
      url = '';
    }
    return url;
  }
  function remember(key, url, max) {
    if (portraitCache.size > max) portraitCache.delete(portraitCache.keys().next().value);
    portraitCache.set(key, url);
    return url;
  }
  function portraitURL(index, mood = 'neutral', size = 96, accessories = null) {
    const list = Array.isArray(accessories) ? accessories : accessories && typeof accessories === 'object' ? Object.values(accessories).filter(Boolean) : [];
    const key = index + ':' + mood + ':' + size + ':' + list.join(',');
    if (portraitCache.has(key)) return portraitCache.get(key);
    const look = Array.isArray(accessories) || !accessories ? withAccessories(ROSTER[index] || ROSTER[0], list) : dressed(ROSTER[index] || ROSTER[0], accessories);
    return remember(key, paintPortrait(size, '#3b3f7a', '#1d2050', 0.47, 0.6, (ctx, px) => drawPortrait(ctx, look, { mood, seed: index + 1, t: 1.3, px })), 80);
  }
  // cached per look, outfit object and rank: scenes ask for it every frame (managers, miners), and a fresh object per
  // frame would also miss the palette and gradient caches
  const managerCache = new WeakMap();
  function managerLook(look, outfit, rank = 1) {
    if (!outfit || typeof outfit !== 'object') return { ...look, outfit: { badge: rank >= 4 } };
    let byOutfit = managerCache.get(look);
    if (!byOutfit) managerCache.set(look, (byOutfit = new WeakMap()));
    let byRank = byOutfit.get(outfit);
    if (!byRank) byOutfit.set(outfit, (byRank = new Map()));
    let hit = byRank.get(rank >= 4);
    if (!hit) byRank.set(rank >= 4, (hit = { ...look, outfit: { ...outfit, badge: rank >= 4 } }));
    return hit;
  }
  function managerPortraitURL(key, look, outfit, size = 88, rank = 1, mood = 'happy') {
    const cacheKey = 'm:' + key + ':' + size + ':' + rank + ':' + mood;
    if (portraitCache.has(cacheKey)) return portraitCache.get(cacheKey);
    return remember(cacheKey, paintPortrait(size, rank >= 5 ? '#6a4a8a' : '#3b3f7a', '#1d2050', 0.5, 0.58, (ctx, px) => drawPortrait(ctx, managerLook(look, outfit, rank), { mood, seed: key.length, t: 1.3, px })), 100);
  }
  // Portrait of a story look (e.g. Void, optionally dressed).
  function lookPortraitURL(key, look, size = 96, mood = 'happy') {
    const w = look.wear,
      cacheKey = 'l:' + key + ':' + size + ':' + mood + (w ? ':' + w.head + w.suit + w.face + w.back : '');
    if (portraitCache.has(cacheKey)) return portraitCache.get(cacheKey);
    return remember(cacheKey, paintPortrait(size, '#2f6f7a', '#1d2050', 0.47, 0.6, (ctx, px) => drawPortrait(ctx, look, { mood, seed: 5, t: 1.3, px })), 100);
  }

  window.SpaceKittens = { ROSTER, WORKERS, VOID, ACCESSORIES, OUTFITS, WEAR, SLOTS, ROLES, ROLE_TITLES, roleLook, workerCard, drawKitten, drawPortrait, portraitURL, withAccessories, dressed, slotsOf, holdPoint, idleAct, managerLook, managerPortraitURL, lookPortraitURL, toolTip, mineImpact, minePhase, MINE_CYCLE, MINE_IMPACT };
})();
