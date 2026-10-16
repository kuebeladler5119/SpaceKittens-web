// Space Kittens character rig v2. One parametric, modular kitten drawn with Canvas2D.
//   look  = fur colours, pattern, eyes, suit colours, accessories      (identity)
//   pose  = idle | walk | work | carry | operate | construct | cheer | hop | wave | sleep | worried | surprised |
//           discover | pilot                                          (animation)
//   mood  = neutral | happy | focus | surprised | worried | sleepy     (face)
// Proportions: big round head (~55 % of height), small body, soft paws, ringed tail. 1 unit ≈ height, origin at feet.
(function () {
  'use strict';
  const TAU = Math.PI * 2;

  // Main cast (indices match state.crew — gameplay roles unchanged).
  const ROSTER = [
    // Mochi: orange tabby, cream muzzle/chest, amber eyes, ringed tail, cream suit with mint accents.
    { id: 'mochi', fur: '#f39a45', fur2: '#ffe8cc', mark: '#c4682a', pattern: 'tabby', eye: '#f6b23a', suit: '#fff4e2', suitDark: '#dccab0', accent: '#7fe6c6', tailRings: true },
    { id: 'boba', fur: '#8f97ab', fur2: '#f2f4fa', mark: '#646c80', pattern: 'socks', eye: '#ffc85a', suit: '#ffb0b0', suitDark: '#c96a78', accent: '#ffe08a', accessory: 'visor' },
    { id: 'miso', fur: '#fff3e4', fur2: '#ffffff', mark: '#e58c4a', mark2: '#4a3a38', pattern: 'calico', eye: '#7cc4ff', suit: '#ffd77a', suitDark: '#c99a3a', accent: '#ff9ecb', accessory: 'scarf' },
    { id: 'pip', fur: '#3a3550', fur2: '#615c7e', mark: '#2a2640', pattern: 'plain', eye: '#ffe26b', suit: '#8fe3ff', suitDark: '#4a9cc4', accent: '#ffd77a', accessory: 'cap' },
    { id: 'lumi', fur: '#f7f7ff', fur2: '#ffffff', mark: '#d8d8ee', pattern: 'plain', eye: '#8fb8ff', eye2: '#ffd36b', suit: '#c4b3ff', suitDark: '#7f6ad8', accent: '#8ff0d4', accessory: 'goggles' },
    { id: 'nori', fur: '#a37452', fur2: '#ecd4b8', mark: '#6b4a32', pattern: 'tabby', eye: '#9be06b', suit: '#a8f0c8', suitDark: '#4aa880', accent: '#8fe3ff', accessory: 'antenna' },
    { id: 'tikki', fur: '#e8823a', fur2: '#ffd2a8', mark: '#b8561c', pattern: 'socks', eye: '#6bd6ff', suit: '#b9c6d8', suitDark: '#6f7d93', accent: '#ffd77a', accessory: 'goggles' },
    { id: 'poppy', fur: '#f3e7d6', fur2: '#fff8ee', mark: '#5a4636', pattern: 'point', eye: '#7fb8ff', suit: '#ffb3d1', suitDark: '#d16f9a', accent: '#c4b3ff', accessory: 'bow' }
  ];
  // Void: Mochi's best friend from the academy (story character of the Deep Core; no gameplay role). Charcoal fur
  // with a cool rim light so the silhouette reads on dark rock, teal eyes, mint neckerchief.
  const VOID = { id: 'void', fur: '#2e2b38', fur2: '#4b4660', mark: '#1f1c28', pattern: 'plain', eye: '#5ff2d9', suit: '#3c4a72', suitDark: '#28304e', accent: '#8ff0d4', accessory: 'neckerchief', rim: 'rgba(159,232,255,0.95)' };
  // Worker kittens (colony residents; no gameplay meaning).
  const WORKERS = [
    { fur: '#f6c37a', fur2: '#fff1d6', mark: '#d89a4a', pattern: 'tabby', eye: '#6bd6a6', suit: '#8ff0d4', suitDark: '#3fae94', accent: '#ffd77a' },
    { fur: '#5b5670', fur2: '#8a85a3', mark: '#3e3a52', pattern: 'socks', eye: '#ffe26b', suit: '#ffd77a', suitDark: '#c99a3a', accent: '#8fe3ff' },
    { fur: '#ffffff', fur2: '#ffffff', mark: '#ff9e6b', mark2: '#4a3a38', pattern: 'calico', eye: '#7cc4ff', suit: '#c4b3ff', suitDark: '#7f6ad8', accent: '#ff9ecb' },
    { fur: '#c9c9d6', fur2: '#f2f2f8', mark: '#8b8ba0', pattern: 'tabby', eye: '#9be06b', suit: '#8fe3ff', suitDark: '#4a9cc4', accent: '#ffd77a' },
    { fur: '#e58c4a', fur2: '#ffd9b3', mark: '#b85c22', pattern: 'plain', eye: '#6bd6ff', suit: '#ffb3d1', suitDark: '#d16f9a', accent: '#8ff0d4' },
    { fur: '#2f2b3d', fur2: '#4a4560', mark: '#1f1c2a', pattern: 'socks', eye: '#9cffb0', suit: '#ff9e9e', suitDark: '#c45a6a', accent: '#ffd77a' }
  ];
  // Cosmetic accessories (purely visual). Also used by the free welcome capsule.
  const ACCESSORIES = {
    'acc-star-helmet': { name: 'Sternchen-Helm', icon: '⭐' },
    'acc-mint-scarf': { name: 'Mint-Schal', icon: '🧣' },
    'acc-star-backpack': { name: 'Goldener Sternrucksack', icon: '🎒' },
    'acc-cute-antenna': { name: 'Herz-Antenne', icon: '📡' },
    'acc-explorer-goggles': { name: 'Mini-Forscherbrille', icon: '🥽' },
    'acc-moon-patch': { name: 'Mond-Aufnäher', icon: '🌙' }
  };

  const isDark = hex => {
    const n = parseInt(hex.slice(1), 16);
    return ((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11 < 90;
  };
  function ellipse(ctx, x, y, rx, ry, fill, rotation = 0) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.001, rx), Math.max(0.001, ry), rotation, 0, TAU);
    ctx.fillStyle = fill;
    ctx.fill();
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
  function blinkAmount(t, seed) {
    const period = 3.2 + (seed % 7) * 0.37,
      phase = (t + seed * 0.71) % period;
    return phase < 0.13 ? 1 - Math.abs(phase - 0.065) / 0.065 : 0;
  }
  // no new arrays for the common case (called several times per kitten and frame — Beta 1.4 M0)
  const NO_ACCESSORIES = Object.freeze([]);
  const accessoriesOf = look => (look.accessory ? [...(look.accessories || []), look.accessory] : look.accessories || NO_ACCESSORIES);

  // ----- Face -----
  function drawFace(ctx, look, mood, t, seed, hy) {
    const line = isDark(look.fur) ? '#f4eefc' : '#2a2438',
      eyeY = hy + 0.035,
      blink = mood === 'happy' || mood === 'sleepy' ? 0 : blinkAmount(t, seed);
    ellipse(ctx, -0.21, hy + 0.12, 0.065, 0.035, 'rgba(255,130,165,0.5)');
    ellipse(ctx, 0.21, hy + 0.12, 0.065, 0.035, 'rgba(255,130,165,0.5)');
    for (let i = 0; i < 2; i++) {
      const x = i ? 0.125 : -0.125;
      if (mood === 'happy' || mood === 'sleepy') {
        ctx.strokeStyle = line;
        ctx.lineWidth = 0.03;
        ctx.lineCap = 'round';
        ctx.beginPath();
        if (mood === 'happy') ctx.arc(x, eyeY + 0.025, 0.055, Math.PI * 1.12, Math.PI * 1.88);
        else ctx.arc(x, eyeY - 0.01, 0.05, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();
        continue;
      }
      const ry = (mood === 'surprised' ? 0.1 : mood === 'focus' ? 0.07 : 0.088) * (1 - blink * 0.92);
      ellipse(ctx, x, eyeY, 0.072, ry, '#231d33');
      if (ry > 0.02) {
        ellipse(ctx, x, eyeY + 0.012, 0.056, ry * 0.78, i && look.eye2 ? look.eye2 : look.eye);
        ellipse(ctx, x, eyeY + 0.02, 0.03, ry * 0.52, '#18131f');
        ellipse(ctx, x - 0.022, eyeY - ry * 0.38, 0.022, 0.022, '#ffffff');
        ellipse(ctx, x + 0.024, eyeY + ry * 0.32, 0.01, 0.01, 'rgba(255,255,255,0.85)');
      }
      if (mood === 'worried' || mood === 'focus') {
        ctx.strokeStyle = line;
        ctx.lineWidth = 0.02;
        ctx.beginPath();
        const tilt = (mood === 'worried' ? 1 : -1) * (i ? -0.02 : 0.02);
        ctx.moveTo(x - 0.06, eyeY - 0.12 - tilt);
        ctx.lineTo(x + 0.06, eyeY - 0.12 + tilt);
        ctx.stroke();
      }
    }
    // Muzzle (cream), nose, mouth, whiskers
    ellipse(ctx, -0.05, hy + 0.135, 0.07, 0.05, look.fur2);
    ellipse(ctx, 0.05, hy + 0.135, 0.07, 0.05, look.fur2);
    ctx.fillStyle = '#ff8fab';
    ctx.beginPath();
    ctx.moveTo(-0.026, hy + 0.098);
    ctx.lineTo(0.026, hy + 0.098);
    ctx.lineTo(0, hy + 0.122);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#5a3a48';
    ctx.lineWidth = 0.015;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (mood === 'surprised') ctx.ellipse(0, hy + 0.16, 0.022, 0.028, 0, 0, TAU);
    else if (mood === 'worried') {
      ctx.moveTo(-0.03, hy + 0.165);
      ctx.quadraticCurveTo(0, hy + 0.145, 0.03, hy + 0.165);
    } else {
      ctx.moveTo(-0.04, hy + 0.14);
      ctx.quadraticCurveTo(-0.02, hy + 0.168, 0, hy + 0.13);
      ctx.quadraticCurveTo(0.02, hy + 0.168, 0.04, hy + 0.14);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 0.009;
    for (let w = 0; w < 4; w++) {
      const side = w < 2 ? -1 : 1,
        dy = w % 2 ? 0.025 : -0.01;
      ctx.beginPath();
      ctx.moveTo(side * 0.12, hy + 0.13 + dy);
      ctx.quadraticCurveTo(side * 0.24, hy + 0.11 + dy * 2, side * 0.32, hy + 0.115 + dy * 2.6);
      ctx.stroke();
    }
    if (mood === 'worried') ellipse(ctx, 0.29, hy - 0.1, 0.028, 0.045, 'rgba(140,210,255,0.9)');
    if (mood === 'sleepy') {
      ctx.fillStyle = '#e8eefc';
      ctx.font = 'bold 0.14px Nunito, sans-serif';
      ctx.fillText('z', 0.28, hy - 0.22 - ((t * 0.3) % 0.2));
    }
  }

  // ----- Head -----
  function drawHead(ctx, look, mood, t, seed, hy, earTwitch) {
    [-1, 1].forEach(side => {
      ctx.save();
      ctx.translate(side * 0.2, hy - 0.2);
      ctx.rotate(side * (0.3 + (side === 1 ? earTwitch : 0)));
      ctx.fillStyle = look.pattern === 'point' ? look.mark : look.fur;
      ctx.beginPath();
      ctx.moveTo(-0.1, 0.06);
      ctx.quadraticCurveTo(-0.05, -0.18, 0.0, -0.2);
      ctx.quadraticCurveTo(0.05, -0.18, 0.1, 0.06);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffb3c8';
      ctx.beginPath();
      ctx.moveTo(-0.055, 0.03);
      ctx.quadraticCurveTo(-0.02, -0.12, 0.0, -0.13);
      ctx.quadraticCurveTo(0.02, -0.12, 0.055, 0.03);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
    // Round head with soft cheek fluff
    ellipse(ctx, 0, hy, 0.34, 0.29, look.fur);
    ellipse(ctx, -0.26, hy + 0.08, 0.1, 0.09, look.fur);
    ellipse(ctx, 0.26, hy + 0.08, 0.1, 0.09, look.fur);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, hy, 0.34, 0.29, 0, 0, TAU);
    ctx.clip();
    if (look.pattern === 'tabby') {
      ctx.strokeStyle = look.mark;
      ctx.lineWidth = 0.034;
      ctx.lineCap = 'round';
      [-0.07, 0, 0.07].forEach(x => {
        ctx.beginPath();
        ctx.moveTo(x, hy - 0.29);
        ctx.lineTo(x * 0.85, hy - 0.16);
        ctx.stroke();
      });
      [-1, 1].forEach(side => {
        [0, 0.06].forEach(dy => {
          ctx.beginPath();
          ctx.moveTo(side * 0.34, hy - 0.01 + dy);
          ctx.lineTo(side * 0.25, hy + 0.005 + dy);
          ctx.stroke();
        });
      });
    } else if (look.pattern === 'calico') {
      ellipse(ctx, -0.2, hy - 0.15, 0.17, 0.13, look.mark);
      ellipse(ctx, 0.22, hy - 0.17, 0.13, 0.11, look.mark2 || '#4a3a38');
    } else if (look.pattern === 'point') {
      ellipse(ctx, 0, hy + 0.1, 0.2, 0.15, look.mark + 'aa');
    } else if (look.pattern === 'socks') {
      ellipse(ctx, 0, hy + 0.17, 0.19, 0.14, look.fur2);
    }
    ctx.restore();
    drawFace(ctx, look, mood, t, seed, hy);
  }

  function drawHeadAccessories(ctx, look, hy, t) {
    for (const accessory of accessoriesOf(look))
      switch (accessory) {
        case 'antenna':
        case 'acc-cute-antenna': {
          const sway = Math.sin(t * 3) * 0.025;
          ctx.strokeStyle = '#d8e6ff';
          ctx.lineWidth = 0.022;
          ctx.beginPath();
          ctx.moveTo(0.12, hy - 0.5);
          ctx.quadraticCurveTo(0.2, hy - 0.62, 0.14 + sway, hy - 0.7);
          ctx.stroke();
          if (accessory === 'acc-cute-antenna') {
            ctx.save();
            ctx.translate(0.14 + sway, hy - 0.72);
            ctx.fillStyle = '#ff7aa8';
            ctx.beginPath();
            ctx.moveTo(0, 0.03);
            ctx.bezierCurveTo(-0.06, -0.02, -0.03, -0.07, 0, -0.035);
            ctx.bezierCurveTo(0.03, -0.07, 0.06, -0.02, 0, 0.03);
            ctx.fill();
            ctx.restore();
          } else ellipse(ctx, 0.14 + sway, hy - 0.71, 0.038, 0.038, Math.sin(t * 4) > 0 ? '#ffe26b' : '#ff9ecb');
          break;
        }
        case 'goggles':
        case 'acc-explorer-goggles':
          ctx.strokeStyle = accessory === 'goggles' ? '#4a3a2a' : '#5a4ad8';
          ctx.lineWidth = 0.032;
          ctx.beginPath();
          ctx.moveTo(-0.34, hy - 0.13);
          ctx.lineTo(0.34, hy - 0.13);
          ctx.stroke();
          [-0.12, 0.12].forEach(x => {
            ellipse(ctx, x, hy - 0.14, 0.085, 0.068, accessory === 'goggles' ? '#c88a4a' : '#ffd77a');
            ellipse(ctx, x, hy - 0.14, 0.062, 0.048, 'rgba(160,230,255,0.88)');
          });
          break;
        case 'bow':
          ctx.fillStyle = '#ff7aa8';
          [-1, 1].forEach(side => {
            ctx.beginPath();
            ctx.moveTo(0.19, hy - 0.22);
            ctx.lineTo(0.19 + side * 0.1, hy - 0.3);
            ctx.lineTo(0.19 + side * 0.1, hy - 0.14);
            ctx.closePath();
            ctx.fill();
          });
          ellipse(ctx, 0.19, hy - 0.22, 0.034, 0.034, '#ffd0e0');
          break;
        case 'cap':
          ellipse(ctx, 0, hy - 0.22, 0.25, 0.1, '#ffd77a');
          ellipse(ctx, 0.16, hy - 0.19, 0.16, 0.04, '#d19a2e');
          break;
        case 'visor':
          ctx.fillStyle = 'rgba(255,120,140,0.5)';
          ctx.fillRect(-0.28, hy - 0.06, 0.56, 0.1);
          break;
        default:
          break;
      }
  }

  function drawHelmet(ctx, look, hy) {
    const g = ctx.createRadialGradient(-0.14, hy - 0.16, 0.02, 0, hy, 0.5);
    g.addColorStop(0, 'rgba(255,255,255,0.26)');
    g.addColorStop(0.6, 'rgba(190,230,255,0.07)');
    g.addColorStop(1, 'rgba(170,220,255,0.3)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, hy - 0.04, 0.48, 0, TAU);
    ctx.fill();
    const starHelmet = accessoriesOf(look).includes('acc-star-helmet');
    ctx.strokeStyle = starHelmet ? 'rgba(255,215,122,0.95)' : 'rgba(220,240,255,0.78)';
    ctx.lineWidth = starHelmet ? 0.034 : 0.024;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.78)';
    ctx.lineWidth = 0.038;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, hy - 0.04, 0.38, Math.PI * 1.15, Math.PI * 1.38);
    ctx.stroke();
    if (starHelmet) star(ctx, 0.3, hy - 0.36, 0.075, '#ffd77a');
  }

  // ----- Manager outfits (business kittens): look.outfit = { jacket, tie, bowtie, glasses, hat, hatColor, item, badge } -----
  const shadeCache = new Map();
  const shade = (hex, f) => {
    const key = hex + f;
    let hit = shadeCache.get(key);
    if (hit === undefined) {
      hit = shadeRaw(hex, f);
      if (shadeCache.size < 2000) shadeCache.set(key, hit);
    }
    return hit;
  };
  const shadeRaw = (hex, f) => {
    const n = parseInt(hex.slice(1), 16),
      c = v => Math.max(0, Math.min(255, Math.round(v * f)));
    return '#' + [c((n >> 16) & 255), c((n >> 8) & 255), c(n & 255)].map(v => v.toString(16).padStart(2, '0')).join('');
  };
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
      [-1, 1].forEach(side => {
        ctx.beginPath();
        ctx.moveTo(0, top + ry * 0.1);
        ctx.lineTo(side * rx * 0.32, top - ry * 0.02);
        ctx.lineTo(side * rx * 0.32, top + ry * 0.24);
        ctx.closePath();
        ctx.fill();
      });
      ellipse(ctx, 0, top + ry * 0.1, rx * 0.08, rx * 0.08, shade(o.bowtie, 0.8));
    }
    if (o.badge) star(ctx, -rx * 0.55, cy - ry * 0.35, rx * 0.2, '#ffd77a');
  }
  function drawOutfitHead(ctx, o, hy, t) {
    if (o.glasses) {
      ctx.strokeStyle = '#3a3048';
      ctx.lineWidth = 0.02;
      [-0.125, 0.125].forEach(x => {
        ctx.fillStyle = 'rgba(200,235,255,0.22)';
        ctx.beginPath();
        ctx.arc(x, hy + 0.035, 0.092, 0, TAU);
        ctx.fill();
        ctx.stroke();
      });
      ctx.beginPath();
      ctx.moveTo(-0.035, hy + 0.03);
      ctx.quadraticCurveTo(0, hy + 0.005, 0.035, hy + 0.03);
      ctx.stroke();
    }
    const hat = o.hatColor || '#ffcc33';
    if (o.hat === 'hardhat') {
      ctx.fillStyle = hat;
      ctx.beginPath();
      ctx.ellipse(0, hy - 0.17, 0.27, 0.21, 0, Math.PI, 0);
      ctx.fill();
      ellipse(ctx, 0, hy - 0.17, 0.34, 0.05, shade(hat, 0.82));
      ctx.strokeStyle = shade(hat, 0.75);
      ctx.lineWidth = 0.025;
      ctx.beginPath();
      ctx.moveTo(0, hy - 0.37);
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
      ellipse(ctx, 0, hy - 0.22, 0.25, 0.11, hat);
      ellipse(ctx, 0.17, hy - 0.18, 0.17, 0.045, shade(hat, 0.75));
    } else if (o.hat === 'tophat') {
      ellipse(ctx, 0.04, hy - 0.24, 0.27, 0.06, hat);
      ctx.fillStyle = hat;
      ctx.fillRect(-0.12, hy - 0.52, 0.32, 0.28);
      ctx.fillStyle = '#ffd23a';
      ctx.fillRect(-0.12, hy - 0.32, 0.32, 0.06);
      star(ctx, 0.2, hy - 0.3, 0.05, '#ff9ecb');
    } else if (o.hat === 'pilot') {
      ellipse(ctx, 0, hy - 0.24, 0.27, 0.12, hat);
      ellipse(ctx, 0, hy - 0.16, 0.25, 0.05, '#1f2a22');
      star(ctx, 0, hy - 0.25, 0.05, '#ffd77a');
    } else if (o.hat === 'goggles') {
      ctx.strokeStyle = '#4a3a2a';
      ctx.lineWidth = 0.032;
      ctx.beginPath();
      ctx.moveTo(-0.33, hy - 0.15);
      ctx.lineTo(0.33, hy - 0.15);
      ctx.stroke();
      [-0.12, 0.12].forEach(x => {
        ellipse(ctx, x, hy - 0.16, 0.085, 0.068, '#c88a4a');
        ellipse(ctx, x, hy - 0.16, 0.062, 0.048, 'rgba(160,230,255,0.88)');
      });
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
      [-0.1, -0.075, -0.05].forEach(ly => ctx.fillRect(-0.03, ly, 0.06, 0.008));
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
  // The old 'work' pose wiggled the arm on a sine and turned the tool ±0.25 rad around a fixed angle: the pickaxe never
  // reached anything. 'mine' (pickaxe) and 'drill' (hand drill) are phase-based cycles — ready → wind-up → accelerated
  // swing → impact → recoil → return — and toolTip() returns the striking point in kitten-local units after every
  // transform drawKitten applies (lean rotation, arm position, tool rotation). The mine scene places each miner so that
  // this point lands on the rock face at the impact phase. Purely visual: production never depends on the cycle.
  const MINE_CYCLE = 0.7; // seconds per swing (the old sine period was 2π/8 ≈ 0.785 s → ~11 % faster)
  const PICK_TIP = [0.16 * Math.cos(Math.PI * 1.8), -0.17 + 0.16 * Math.sin(Math.PI * 1.8)]; // front blade tip, tool frame
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
    inOut: p => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2)
  };
  function mix(a, b, p) {
    return { arm: [a.arm[0] + (b.arm[0] - a.arm[0]) * p, a.arm[1] + (b.arm[1] - a.arm[1]) * p], tool: a.tool + (b.tool - a.tool) * p, lean: a.lean + (b.lean - a.lean) * p };
  }
  // 0..1 position inside the swing; the seed offsets neighbours so a crew does not swing in lockstep
  function minePhase(t, seed = 1) {
    const u = (t + seed * 0.237) / MINE_CYCLE;
    return u - Math.floor(u);
  }
  // impact window of a cycle (the moment the tip rests on the rock)
  const MINE_IMPACT = [0.4, 0.48];
  function mineMotion(u) {
    const K = MINE_KEYS;
    if (u < 0.28) return mix(K.ready, K.wind, ease.outQuad(u / 0.28));
    if (u < MINE_IMPACT[0]) return mix(K.wind, K.impact, ease.inCubic((u - 0.28) / 0.12));
    if (u < MINE_IMPACT[1]) {
      // the blade stays on the rock; a tiny shake sells the hit (the tip itself does not move off the contact)
      const s = Math.sin(((u - MINE_IMPACT[0]) / (MINE_IMPACT[1] - MINE_IMPACT[0])) * Math.PI) * 0.012;
      return { arm: K.impact.arm, tool: K.impact.tool, lean: K.impact.lean + s };
    }
    if (u < 0.58) return mix(K.impact, K.recoil, ease.outQuad((u - MINE_IMPACT[1]) / 0.1));
    return mix(K.recoil, K.ready, ease.inOut((u - 0.58) / 0.42));
  }
  // Hand drill: pushed against the rock with a short vibration; the bit tip stays on the face.
  function drillMotion(t, seed = 1) {
    const buzz = Math.sin(t * 60 + seed) * 0.004;
    const push = Math.max(0, Math.sin(t * 2.4 + seed)) * 0.015; // leaning into the drill now and then
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
  // true while the blade rests on the rock in this frame (for synchronized chips and dust at the contact point)
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
      // Beta 1.3: a slightly larger pickaxe whose striking tip is PICK_TIP (used by toolTip() for the rock contact)
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

  /** Full-body astronaut kitten. opts: { pose, mood, t, seed, tool, jetpack, facing } */
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
  // Rim light for dark fur (Void): a soft halo that needs no canvas filter (older Android WebViews), plus the
  // sharper drop-shadow outline where `ctx.filter` exists.
  function rimHalo(ctx, rim, cy, rx, ry) {
    const g = ctx.createRadialGradient(0, cy, 0, 0, cy, Math.max(rx, ry));
    g.addColorStop(0.55, rim.replace(/[\d.]+\)$/, '0.32)'));
    g.addColorStop(1, rim.replace(/[\d.]+\)$/, '0)'));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, cy, rx, ry, 0, 0, TAU);
    ctx.fill();
  }
  function drawKitten(ctx, look, opts = {}) {
    if (look.rim && !opts.noRim) {
      rimHalo(ctx, look.rim, -0.48, 0.62, 0.62);
      if ('filter' in ctx) {
        const before = ctx.filter;
        ctx.filter = 'drop-shadow(0 0 2px ' + look.rim + ')';
        drawKitten(ctx, look, { ...opts, noRim: true });
        ctx.filter = before;
      } else drawKitten(ctx, look, { ...opts, noRim: true });
      return;
    }
    const pose = opts.pose || 'idle',
      t = opts.t || 0,
      seed = opts.seed || 1;
    const mood =
      opts.mood ||
      { cheer: 'happy', hop: 'happy', discover: 'happy', worried: 'worried', work: 'focus', mine: 'focus', drill: 'focus', construct: 'focus', operate: 'focus', surprised: 'surprised', sleep: 'sleepy' }[pose] ||
      'neutral';
    const breathe = Math.sin(t * 2.2 + seed) * 0.012;
    let lift = 0,
      squash = 1;
    if (pose === 'hop' || pose === 'cheer' || pose === 'discover') {
      const phase = Math.abs(Math.sin(t * 7 + seed));
      lift = phase * (pose === 'hop' ? 0.18 : 0.09);
      squash = 1 + (phase > 0.9 ? 0.05 : phase < 0.15 ? -0.05 : 0);
    }
    if (pose === 'walk') lift = Math.abs(Math.sin(t * 9 + seed)) * 0.03;
    if (pose === 'surprised') lift = 0.04;
    // Beta 1.3 mining poses: one motion object drives lean, arm and tool (see mineMotion / drillMotion)
    const motion = pose === 'mine' ? mineMotion(minePhase(t, seed)) : pose === 'drill' ? drillMotion(t, seed) : null;
    const lean = motion ? motion.lean : pose === 'work' || pose === 'construct' ? Math.sin(t * 8 + seed) * 0.05 : pose === 'walk' ? 0.05 : 0;
    ctx.save();
    if (opts.facing === -1) ctx.scale(-1, 1);
    ctx.translate(0, -lift);
    ctx.scale(2 - squash, squash);
    ctx.rotate(lean);
    const sleeping = pose === 'sleep';
    if (sleeping) ctx.translate(0, 0.08);
    // Tail (ringed for tabbies when requested)
    const sway = Math.sin(t * (sleeping ? 0.8 : 2) + seed) * 0.12;
    const tailPath = () => {
      ctx.beginPath();
      ctx.moveTo(-0.13, -0.12);
      ctx.quadraticCurveTo(-0.4, -0.16 + sway, -0.36 + sway * 0.5, -0.42);
    };
    ctx.lineCap = 'round';
    ctx.strokeStyle = look.fur;
    ctx.lineWidth = 0.085;
    tailPath();
    ctx.stroke();
    if (look.tailRings || look.pattern === 'tabby') {
      ctx.strokeStyle = look.mark;
      ctx.setLineDash([0.05, 0.06]);
      tailPath();
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Backpack / jetpack
    const backpackGold = accessoriesOf(look).includes('acc-star-backpack');
    ellipse(ctx, -0.15, -0.27, 0.085, 0.12, backpackGold ? '#ffd77a' : look.suitDark);
    if (backpackGold) star(ctx, -0.15, -0.28, 0.045, '#fff6d0');
    if (opts.jetpack) {
      const flame = 0.07 + Math.sin(t * 30 + seed) * 0.02;
      ellipse(ctx, -0.17, -0.12, 0.04, flame, '#ffd77a');
      ellipse(ctx, -0.17, -0.13, 0.02, flame * 0.6, '#ffffff');
    }
    // Legs + soft paws
    const step = pose === 'walk' || pose === 'carry' || opts.walking ? Math.sin(t * 9 + seed) * 0.05 : 0;
    if (!sleeping) {
      capsule(ctx, -0.07, -0.11, -0.07 + step, -0.03, 0.055, look.suitDark);
      capsule(ctx, 0.07, -0.11, 0.07 - step, -0.03, 0.055, look.suitDark);
    }
    ellipse(ctx, -0.075 + step, -0.022, 0.07, 0.042, look.pattern === 'socks' ? '#ffffff' : look.fur);
    ellipse(ctx, 0.075 - step, -0.022, 0.07, 0.042, look.pattern === 'socks' ? '#ffffff' : look.fur);
    // Body (small, round suit) with cream chest
    const body = ctx.createLinearGradient(0, -0.42, 0, -0.08);
    body.addColorStop(0, look.suit);
    body.addColorStop(1, look.suitDark);
    ellipse(ctx, 0, -0.24 + breathe, 0.18, 0.17, body);
    ellipse(ctx, 0, -0.27 + breathe, 0.085, 0.075, look.fur2);
    if (look.accent) {
      ctx.strokeStyle = look.accent;
      ctx.lineWidth = 0.025;
      ctx.beginPath();
      ctx.arc(0, -0.24 + breathe, 0.15, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    }
    if (look.outfit) drawOutfitBody(ctx, look.outfit, -0.24 + breathe, 0.18, 0.17);
    const acc = accessoriesOf(look);
    if (acc.includes('acc-moon-patch')) {
      ctx.fillStyle = '#ffd77a';
      ctx.beginPath();
      ctx.arc(0.1, -0.2, 0.04, 0, TAU);
      ctx.fill();
      ctx.fillStyle = look.suit;
      ctx.beginPath();
      ctx.arc(0.115, -0.21, 0.034, 0, TAU);
      ctx.fill();
    }
    if (look.accessory === 'scarf' || acc.includes('acc-mint-scarf')) {
      ctx.fillStyle = acc.includes('acc-mint-scarf') ? '#7fe6c6' : '#ff7aa8';
      ctx.fillRect(-0.16, -0.39, 0.32, 0.055);
      ctx.fillRect(0.05, -0.37, 0.055, 0.13);
    }
    if (look.accessory === 'neckerchief') neckerchief(ctx, 0, -0.4, 0.17, look.accent);
    // Arms by pose
    const shoulderY = -0.33 + breathe;
    let leftArm = [-0.18, -0.2],
      rightArm = [0.18, -0.2];
    const swing = Math.sin(t * 8 + seed);
    if (motion) {
      // both paws on the handle: the left paw trails the right one along the haft
      rightArm = motion.arm;
      leftArm = [motion.arm[0] - 0.07, motion.arm[1] + 0.05];
    } else if (pose === 'work') {
      rightArm = [0.24, -0.27 + swing * 0.07];
      leftArm = [0.14, -0.23 + swing * 0.05];
    } else if (pose === 'construct') {
      rightArm = [0.22, -0.4 - Math.max(0, swing) * 0.08];
      leftArm = [0.12, -0.22];
    } else if (pose === 'operate') {
      leftArm = [0.17, -0.27 + Math.sin(t * 3) * 0.02];
      rightArm = [0.24, -0.27 - Math.sin(t * 3) * 0.02];
    } else if (pose === 'carry') {
      leftArm = [-0.07, -0.2];
      rightArm = [0.07, -0.2];
    } else if (pose === 'cheer' || pose === 'discover') {
      leftArm = [-0.38, -0.46 + Math.sin(t * 7) * 0.05];
      rightArm = [0.38, -0.46 - Math.sin(t * 7) * 0.05];
    } else if (pose === 'wave' || pose === 'signal') {
      rightArm = [0.33, -0.5 + Math.sin(t * 10) * 0.06];
    } else if (pose === 'stamp') {
      rightArm = [0.2, -0.3 - Math.max(0, Math.sin(t * 6)) * 0.12];
      leftArm = [0.12, -0.22];
    } else if (pose === 'check') {
      leftArm = [0.1, -0.31 + Math.sin(t * 1.5) * 0.01];
      rightArm = [0.2, -0.26];
    } else if (pose === 'worried' || pose === 'surprised') {
      leftArm = [-0.11, -0.38];
      rightArm = [0.11, -0.38];
    } else if (pose === 'walk') {
      leftArm = [-0.17 - swing * 0.04, -0.2];
      rightArm = [0.17 + swing * 0.04, -0.2];
    } else if (sleeping) {
      leftArm = [-0.12, -0.18];
      rightArm = [0.12, -0.18];
    }
    capsule(ctx, -0.13, shoulderY, leftArm[0], leftArm[1], 0.05, look.suit);
    capsule(ctx, 0.13, shoulderY, rightArm[0], rightArm[1], 0.05, look.suit);
    ellipse(ctx, leftArm[0], leftArm[1], 0.05, 0.048, look.fur);
    ellipse(ctx, rightArm[0], rightArm[1], 0.05, 0.048, look.fur);
    // Head + helmet
    const hy = -0.72 + breathe * 0.6 + (sleeping ? 0.06 : 0);
    const twitch = Math.sin(t * 0.7 + seed) > 0.96 ? 0.25 : 0;
    ctx.save();
    if (sleeping) {
      ctx.translate(0, hy);
      ctx.rotate(-0.18);
      ctx.translate(0, -hy);
    }
    drawHead(ctx, look, mood, t, seed, hy, twitch);
    drawHeadAccessories(ctx, look, hy, t);
    if (look.outfit) drawOutfitHead(ctx, look.outfit, hy, t);
    else drawHelmet(ctx, look, hy);
    ctx.restore();
    if (look.outfit?.item && look.outfit.item !== 'lamp') {
      const hand = ['clipboard', 'flask'].includes(look.outfit.item) ? leftArm : rightArm;
      drawHeldItem(ctx, look.outfit.item, hand[0], hand[1], t);
    }
    if (pose === 'discover') star(ctx, 0.36, hy - 0.5 - Math.abs(Math.sin(t * 3)) * 0.05, 0.07, '#ffe26b');
    if (pose === 'work') drawTool(ctx, opts.tool || 'drill', 0.3 + swing * 0.25, rightArm[0], rightArm[1]);
    if (pose === 'mine') drawTool(ctx, 'pick', motion.tool, rightArm[0], rightArm[1]);
    if (pose === 'drill') drawTool(ctx, 'drill', motion.tool, rightArm[0], rightArm[1]);
    if (pose === 'construct') drawTool(ctx, 'hammer', -0.4 + Math.max(0, swing) * 0.9, rightArm[0], rightArm[1]);
    if (pose === 'carry') {
      drawTool(ctx, opts.tool || 'crystal', 0, 0, -0.15);
      ellipse(ctx, leftArm[0] - 0.05, leftArm[1] + 0.04, 0.045, 0.045, look.fur);
      ellipse(ctx, rightArm[0] + 0.05, rightArm[1] + 0.04, 0.045, 0.045, look.fur);
    }
    ctx.restore();
  }

  // Head-and-shoulders portrait (crew cards, dialogs, pilot overlay).
  function drawPortrait(ctx, look, opts = {}) {
    if (look.rim && !opts.noRim && 'filter' in ctx) {
      const before = ctx.filter;
      ctx.filter = 'drop-shadow(0 0 3px ' + look.rim + ')';
      drawPortrait(ctx, look, { ...opts, noRim: true });
      ctx.filter = before;
      return;
    }
    const t = opts.t || 0,
      seed = opts.seed || 1,
      mood = opts.mood || 'neutral';
    const body = ctx.createLinearGradient(0, 0.1, 0, 0.5);
    body.addColorStop(0, look.suit);
    body.addColorStop(1, look.suitDark);
    ellipse(ctx, 0, 0.44, 0.4, 0.22, body);
    ellipse(ctx, 0, 0.36, 0.14, 0.06, look.fur2);
    if (look.outfit) drawOutfitBody(ctx, look.outfit, 0.46, 0.4, 0.22);
    if (accessoriesOf(look).includes('acc-mint-scarf') || look.accessory === 'scarf') {
      ctx.fillStyle = accessoriesOf(look).includes('acc-mint-scarf') ? '#7fe6c6' : '#ff7aa8';
      ctx.fillRect(-0.25, 0.26, 0.5, 0.07);
    }
    if (look.accessory === 'neckerchief') neckerchief(ctx, 0, 0.25, 0.27, look.accent);
    const hy = Math.sin(t * 2 + seed) * 0.01;
    ctx.save();
    ctx.scale(1.15, 1.15);
    drawHead(ctx, look, mood, t, seed, hy, 0);
    drawHeadAccessories(ctx, look, hy, t);
    if (look.outfit) drawOutfitHead(ctx, look.outfit, hy, t);
    else drawHelmet(ctx, look, hy);
    ctx.restore();
  }

  // Look with cosmetics applied (Mochi's equipped accessory comes from state.meta).
  // Beta 1.3 outfits (cosmetic slot 'outfit'): new suit colours for the kitten who wears them
  const OUTFITS = {
    'outfit-rose': { suit: '#ffc2dc', suitDark: '#d9779f', accent: '#ffffff' },
    'outfit-explorer': { suit: '#e2cd9e', suitDark: '#a88a52', accent: '#ff8f6b' }
  };
  function withAccessories(look, accessories) {
    if (!accessories || !accessories.length) return look;
    const outfit = accessories.map(id => OUTFITS[id]).find(Boolean);
    return outfit ? { ...look, ...outfit, accessories } : { ...look, accessories };
  }

  const portraitCache = new Map();
  function portraitURL(index, mood = 'neutral', size = 96, accessories = null) {
    const key = index + ':' + mood + ':' + size + ':' + (accessories || []).join(',');
    if (portraitCache.has(key)) return portraitCache.get(key);
    let url = '';
    try {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (ctx && c.toDataURL) {
        const bg = ctx.createRadialGradient(size / 2, size * 0.4, 4, size / 2, size / 2, size * 0.7);
        bg.addColorStop(0, '#3b3f7a');
        bg.addColorStop(1, '#1d2050');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, size, size);
        ctx.translate(size / 2, size * 0.47);
        ctx.scale(size * 0.6, size * 0.6);
        drawPortrait(ctx, withAccessories(ROSTER[index] || ROSTER[0], accessories), { mood, seed: index + 1, t: 1.3 });
        url = c.toDataURL('image/png');
      }
    } catch {
      url = '';
    }
    if (portraitCache.size > 60) portraitCache.delete(portraitCache.keys().next().value);
    portraitCache.set(key, url);
    return url;
  }

  // Manager portrait: look + business outfit; rank ≥ 4 adds the golden pin.
  function managerLook(look, outfit, rank = 1) {
    return { ...look, outfit: { ...outfit, badge: rank >= 4 } };
  }
  function managerPortraitURL(key, look, outfit, size = 88, rank = 1, mood = 'happy') {
    const cacheKey = 'm:' + key + ':' + size + ':' + rank + ':' + mood;
    if (portraitCache.has(cacheKey)) return portraitCache.get(cacheKey);
    let url = '';
    try {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (ctx && c.toDataURL) {
        const bg = ctx.createRadialGradient(size / 2, size * 0.4, 4, size / 2, size / 2, size * 0.7);
        bg.addColorStop(0, rank >= 5 ? '#6a4a8a' : '#3b3f7a');
        bg.addColorStop(1, '#1d2050');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, size, size);
        ctx.translate(size / 2, size * 0.5);
        ctx.scale(size * 0.58, size * 0.58);
        drawPortrait(ctx, managerLook(look, outfit, rank), { mood, seed: key.length, t: 1.3 });
        url = c.toDataURL('image/png');
      }
    } catch {
      url = '';
    }
    if (portraitCache.size > 80) portraitCache.delete(portraitCache.keys().next().value);
    portraitCache.set(cacheKey, url);
    return url;
  }

  // Portrait of a story look (no outfit; e.g. Void).
  function lookPortraitURL(key, look, size = 96, mood = 'happy') {
    const cacheKey = 'l:' + key + ':' + size + ':' + mood;
    if (portraitCache.has(cacheKey)) return portraitCache.get(cacheKey);
    let url = '';
    try {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (ctx && c.toDataURL) {
        const bg = ctx.createRadialGradient(size / 2, size * 0.4, 4, size / 2, size / 2, size * 0.7);
        bg.addColorStop(0, '#2f6f7a');
        bg.addColorStop(1, '#1d2050');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, size, size);
        ctx.translate(size / 2, size * 0.47);
        ctx.scale(size * 0.6, size * 0.6);
        drawPortrait(ctx, look, { mood, seed: 5, t: 1.3 });
        url = c.toDataURL('image/png');
      }
    } catch {
      url = '';
    }
    portraitCache.set(cacheKey, url);
    return url;
  }

  window.SpaceKittens = { ROSTER, WORKERS, VOID, ACCESSORIES, OUTFITS, drawKitten, drawPortrait, portraitURL, withAccessories, managerLook, managerPortraitURL, lookPortraitURL, toolTip, mineImpact, minePhase, MINE_CYCLE, MINE_IMPACT };
})();
