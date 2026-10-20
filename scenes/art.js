// Nebula Harvest procedural art: planet textures, space backgrounds, ships and enemies (original vector-style
// drawings rendered with Canvas2D; no external images). Game-specific — the engine core stays theme-neutral.
(function () {
  'use strict';
  const { math } = window.IdleEngine;
  const TAU = Math.PI * 2;

  function canvas(width, height) {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    return c;
  }

  // Seeded value noise with fractal octaves (used for planet surfaces and nebulae).
  function noise2D(seed) {
    const rnd = math.seeded(seed),
      size = 64,
      grid = new Float32Array(size * size);
    for (let i = 0; i < grid.length; i++) grid[i] = rnd();
    // size is a power of two: "& mask" is the same wrap as the double modulo, also for negative cells (Beta 1.7 QA:
    // the planet textures spent most of a 700-ms start-up frame here)
    const mask = size - 1,
      shift = Math.log2(size),
      at = (x, y) => grid[((y & mask) << shift) | (x & mask)];
    const smooth = t => t * t * (3 - 2 * t);
    const value = (x, y) => {
      const xi = Math.floor(x),
        yi = Math.floor(y),
        tx = smooth(x - xi),
        ty = smooth(y - yi);
      const a = at(xi, yi),
        b = at(xi + 1, yi),
        c = at(xi, yi + 1),
        d = at(xi + 1, yi + 1);
      return math.lerp(math.lerp(a, b, tx), math.lerp(c, d, tx), ty);
    };
    return (x, y, octaves = 4) => {
      let sum = 0,
        amp = 0.5,
        freq = 1,
        norm = 0;
      for (let o = 0; o < octaves; o++) {
        sum += value(x * freq, y * freq) * amp;
        norm += amp;
        amp *= 0.5;
        freq *= 2;
      }
      return sum / norm;
    };
  }

  const hexCache = new Map();
  // parsed once per colour (ramp() runs per texture pixel); callers only read the result
  const hex = h => {
    let c = hexCache.get(h);
    if (!c) hexCache.set(h, (c = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]));
    return c;
  };
  const mix = (a, b, t) => [0, 1, 2].map(i => Math.round(math.lerp(a[i], b[i], t)));
  function ramp(stops, t) {
    t = math.clamp(t, 0, 1);
    for (let i = 1; i < stops.length; i++)
      if (t <= stops[i][0]) {
        const [t0, c0] = stops[i - 1],
          [t1, c1] = stops[i];
        return mix(hex(c0), hex(c1), (t - t0) / Math.max(1e-6, t1 - t0));
      }
    return hex(stops[stops.length - 1][1]);
  }

  // Planet themes keyed by planet id from game-data.js. Space Kittens palette: pastel worlds on deep-blue space.
  const THEMES = {
    crystal: {
      surface: [
        [0, '#5b62c9'],
        [0.45, '#8a93f0'],
        [0.7, '#b9b3ff'],
        [0.85, '#d9c9ff'],
        [1, '#fff4ff']
      ],
      atmosphere: '#b9c8ff',
      accent: '#c4b3ff',
      glow: '#e6e0ff',
      sky: ['#11163d', '#2a2766', '#4a3a86'],
      particle: '#d9ccff',
      bands: 0.3,
      features: 'crystals'
    },
    ice: {
      surface: [
        [0, '#6fb6c9'],
        [0.4, '#9fdcea'],
        [0.7, '#d4f4f6'],
        [1, '#ffffff']
      ],
      atmosphere: '#c8fbff',
      accent: '#8fe3ff',
      glow: '#e8fdff',
      sky: ['#0d1a3a', '#1c3a66', '#2c5a80'],
      particle: '#f0feff',
      bands: 0.2,
      features: 'caps'
    },
    volcanic: {
      surface: [
        [0, '#6a3446'],
        [0.45, '#9a4a5a'],
        [0.65, '#d0707a'],
        [0.82, '#ff9e8a'],
        [0.92, '#ffc08a'],
        [1, '#ffe8a8']
      ],
      atmosphere: '#ffb0a0',
      accent: '#ffb38a',
      glow: '#ffd7c0',
      sky: ['#1a1238', '#3d2050', '#61305a'],
      particle: '#ffc8a0',
      bands: 0.1,
      features: 'lava'
    },
    machine: {
      surface: [
        [0, '#5d5f86'],
        [0.5, '#8a8db8'],
        [0.75, '#b4b6d8'],
        [1, '#e2e3f4']
      ],
      atmosphere: '#c0d4ff',
      accent: '#ffd77a',
      glow: '#fff0c0',
      sky: ['#0e1430', '#1e2650', '#30386c'],
      particle: '#ffe9a8',
      bands: 0,
      features: 'grid'
    },
    verdant: {
      surface: [
        [0, '#2f8a8a'],
        [0.4, '#4fb8a6'],
        [0.55, '#7fd8a8'],
        [0.75, '#b5ecb0'],
        [1, '#effcd8']
      ],
      atmosphere: '#b8ffe0',
      accent: '#8ff0d4',
      glow: '#e0fff2',
      sky: ['#0c1c36', '#173c58', '#21566a'],
      particle: '#d0ffe8',
      bands: 0.15,
      features: 'clouds'
    },
    forge: {
      surface: [
        [0, '#b0603a'],
        [0.35, '#e08a4a'],
        [0.6, '#f6b26a'],
        [0.8, '#ffd78a'],
        [1, '#fff6d0']
      ],
      atmosphere: '#ffe0a0',
      accent: '#ffd77a',
      glow: '#fff4cc',
      sky: ['#161236', '#3a2650', '#5e3a5a'],
      particle: '#ffe6a8',
      bands: 0.55,
      features: 'molten'
    }
  };

  const cache = new Map();
  function cached(key, build) {
    if (cache.has(key)) {
      // least recently used first out (Beta 1.7 QA: it was first-in-first-out, so backgrounds in use were dropped)
      const value = cache.get(key);
      cache.delete(key);
      cache.set(key, value);
      return value;
    }
    // Bounded cache: backgrounds are keyed by size, so resizes must not grow memory without limit.
    if (cache.size >= 24) cache.delete(cache.keys().next().value);
    cache.set(key, build());
    return cache.get(key);
  }
  // Planet textures have their own store (one 512×256 strip per world, 3 MB for all six). Beta 1.7 QA: they shared the
  // background cache above, whose size-keyed entries (every dock or sheet height is a new size) pushed them out, so a
  // texture (120 ms of noise) was rebuilt in the middle of a screen change — the single slow frames of the soaks.
  const planetTextures = new Map();

  // Equirectangular-like texture strip; drawn scrolled inside a circular clip to fake rotation.
  function planetTexture(id) {
    if (planetTextures.has(id)) return planetTextures.get(id);
    const texture = (() => {
      const theme = THEMES[id] || THEMES.crystal,
        w = 512,
        h = 256,
        c = canvas(w, h),
        // CPU-backed: written once with putImageData; planet icons read it back through toDataURL (a GPU canvas cost
        // 60 ms per icon there, Beta 1.7 QA). Scenes still draw it as an image source as before.
        ctx = c.getContext('2d', { willReadFrequently: true });
      if (!ctx) return c;
      const n = noise2D(math.hash(id)),
        n2 = noise2D(math.hash(id + 'detail')),
        img = ctx.createImageData(w, h);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          // Tileable in x by blending the edges.
          const u = x / w,
            v = y / h;
          let value = math.lerp(n(u * 8, v * 4), n((u - 1) * 8, v * 4), u);
          value = value * (1 - theme.bands) + (0.5 + 0.5 * Math.sin(v * 22 + n2(u * 6, v * 6) * 6)) * theme.bands;
          let detail = n2(u * 24, v * 12, 3);
          let color = ramp(theme.surface, value * 0.85 + detail * 0.3 - 0.08);
          if (theme.features === 'caps' && (v < 0.16 || v > 0.86)) color = mix(color, [245, 252, 255], 0.75);
          if (theme.features === 'lava') {
            const crack = Math.abs(n2(u * 10, v * 10) - 0.5);
            if (crack < 0.035) color = mix(color, [255, 200, 150], 1 - crack / 0.035);
          }
          if (theme.features === 'grid') {
            const gx = x % 32 < 2 || y % 24 < 2;
            if (gx) color = mix(color, [80, 82, 120], 0.45);
            if (detail > 0.68 && (x * 7 + y * 13) % 11 === 0) color = [255, 216, 120];
          }
          if (theme.features === 'clouds') {
            const cloud = n2(u * 5 + 3, v * 7, 4);
            if (cloud > 0.58) color = mix(color, [235, 250, 245], Math.min(0.85, (cloud - 0.58) * 4));
          }
          if (theme.features === 'molten') {
            const flow = Math.abs(Math.sin((v + n(u * 4, v * 4) * 0.3) * 30));
            if (flow > 0.94) color = mix(color, [255, 240, 170], (flow - 0.94) * 16);
          }
          if (theme.features === 'crystals' && detail > 0.74) color = mix(color, [220, 210, 255], (detail - 0.74) * 3);
          const i = (y * w + x) * 4;
          img.data[i] = color[0];
          img.data[i + 1] = color[1];
          img.data[i + 2] = color[2];
          img.data[i + 3] = 255;
        }
      ctx.putImageData(img, 0, 0);
      return c;
    })();
    planetTextures.set(id, texture);
    return texture;
  }

  // Deep-space backdrop with nebula clouds and two star layers (pre-rendered per size + palette).
  function spaceBackground(key, width, height, palette, seed) {
    return cached('bg:' + key + ':' + width + 'x' + height, () => {
      const c = canvas(width, height),
        ctx = c.getContext('2d');
      if (!ctx) return c;
      const sky = ctx.createLinearGradient(0, 0, width * 0.3, height);
      sky.addColorStop(0, palette[0]);
      sky.addColorStop(0.6, palette[1]);
      sky.addColorStop(1, palette[2]);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, height);
      const rnd = math.seeded(seed);
      // Nebula: soft overlapping radial blobs.
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 9; i++) {
        const x = rnd() * width,
          y = rnd() * height * 0.8,
          r = (0.25 + rnd() * 0.45) * Math.max(width, height);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        const color = palette[1 + (i % 2)];
        g.addColorStop(0, color + '55');
        g.addColorStop(1, color + '00');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, width, height);
      }
      ctx.globalCompositeOperation = 'source-over';
      // Far stars
      for (let i = 0; i < (width * height) / 900; i++) {
        const x = rnd() * width,
          y = rnd() * height,
          a = 0.25 + rnd() * 0.6;
        ctx.fillStyle = `rgba(230,240,255,${a})`;
        ctx.fillRect(x, y, rnd() < 0.08 ? 1.6 : 0.9, rnd() < 0.08 ? 1.6 : 0.9);
      }
      return c;
    });
  }

  // Draws a lit, rotating planet. cx/cy center, r radius, spin 0..1 rotation phase.
  function drawPlanet(ctx, id, cx, cy, r, spin, light = { x: -0.55, y: -0.65 }) {
    const theme = THEMES[id] || THEMES.crystal,
      tex = planetTexture(id);
    // Atmosphere glow
    const glow = ctx.createRadialGradient(cx, cy, r * 0.92, cx, cy, r * 1.22);
    glow.addColorStop(0, theme.atmosphere + '66');
    glow.addColorStop(1, theme.atmosphere + '00');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.22, 0, TAU);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.clip();
    // Texture: scale so the strip height covers the diameter; scroll horizontally.
    const th = r * 2,
      tw = th * 2,
      offset = (spin % 1) * tw;
    ctx.drawImage(tex, cx - r - offset, cy - r, tw, th);
    ctx.drawImage(tex, cx - r - offset + tw, cy - r, tw, th);
    // Spherical shading: day side highlight, night side shadow, limb darkening.
    const lx = cx + light.x * r,
      ly = cy + light.y * r;
    const shade = ctx.createRadialGradient(lx, ly, r * 0.1, cx - light.x * r * 0.4, cy - light.y * r * 0.4, r * 1.45);
    shade.addColorStop(0, 'rgba(255,255,255,0.22)');
    shade.addColorStop(0.35, 'rgba(0,0,0,0)');
    shade.addColorStop(0.8, 'rgba(2,4,12,0.62)');
    shade.addColorStop(1, 'rgba(2,4,12,0.92)');
    ctx.fillStyle = shade;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    const limb = ctx.createRadialGradient(cx, cy, r * 0.75, cx, cy, r);
    limb.addColorStop(0, 'rgba(0,0,0,0)');
    limb.addColorStop(1, theme.atmosphere + '55');
    ctx.fillStyle = limb;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
    // Thin bright rim on the lit side.
    ctx.strokeStyle = theme.glow + 'aa';
    ctx.lineWidth = Math.max(1, r * 0.012);
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI * 1.05, Math.PI * 1.55);
    ctx.stroke();
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Space Kittens ships & critters. Drawn facing right at origin, unit size ~1 (scaled by caller).
  function glowCircle(ctx, x, y, r, color, alpha = 1) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    const previous = ctx.globalAlpha;
    ctx.globalAlpha = previous * alpha;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = previous;
  }
  function poly(ctx, points, fill, stroke, width = 0.02) {
    ctx.beginPath();
    points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      ctx.stroke();
    }
  }
  function blob(ctx, x, y, rx, ry, fill) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.001, rx), Math.max(0.001, ry), 0, 0, TAU);
    ctx.fillStyle = fill;
    ctx.fill();
  }
  function shade(ctx, y0, y1, light, dark) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, light);
    g.addColorStop(1, dark);
    return g;
  }
  function roundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  }
  function heart(ctx, x, y, s, fill) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.35);
    ctx.bezierCurveTo(x - s, y - s * 0.4, x - s * 0.4, y - s, x, y - s * 0.45);
    ctx.bezierCurveTo(x + s * 0.4, y - s, x + s, y - s * 0.4, x, y + s * 0.35);
    ctx.fillStyle = fill;
    ctx.fill();
  }
  // Cute face shared by critters: eyes look at the player (left), moods: 'idle' | 'hit' | 'dizzy' | 'angry'.
  function critterFace(ctx, x, y, size, mood, t, eyeColor = '#2a2438') {
    const gap = size * 0.55;
    [-1, 1].forEach(side => {
      const ex = x + side * gap * 0.5,
        ey = y;
      if (mood === 'dizzy') {
        ctx.strokeStyle = eyeColor;
        ctx.lineWidth = size * 0.12;
        ctx.beginPath();
        ctx.arc(ex, ey, size * 0.16, t * 8, t * 8 + Math.PI * 1.5);
        ctx.stroke();
        return;
      }
      if (mood === 'hit') {
        ctx.strokeStyle = eyeColor;
        ctx.lineWidth = size * 0.1;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(ex - size * 0.14, ey - size * 0.1);
        ctx.lineTo(ex + size * 0.14 * side, ey);
        ctx.lineTo(ex - size * 0.14, ey + size * 0.1);
        ctx.stroke();
        return;
      }
      blob(ctx, ex, ey, size * 0.2, size * 0.24, '#ffffff');
      blob(ctx, ex - size * 0.05, ey + size * 0.02, size * 0.12, size * 0.15, eyeColor);
      blob(ctx, ex - size * 0.09, ey - size * 0.06, size * 0.05, size * 0.05, '#ffffff');
      if (mood === 'angry') {
        ctx.strokeStyle = eyeColor;
        ctx.lineWidth = size * 0.08;
        ctx.beginPath();
        ctx.moveTo(ex - size * 0.2, ey - size * 0.3 + side * size * 0.06);
        ctx.lineTo(ex + size * 0.2, ey - size * 0.3 - side * size * 0.06);
        ctx.stroke();
      }
    });
  }

  // Player ships: rounded toy-like hulls, glass dome with the kitten pilot. `gear` = real upgrade levels.
  const SHIP_PALETTES = {
    default: { hull: ['#f4f7ff', '#9aa9d8'], trim: '#8ff0d4', engine: '#8fe3ff' },
    'ship-aurora': { hull: ['#f6ecff', '#a98be0'], trim: '#ffb3d1', engine: '#d4b0ff' },
    'ship-ember': { hull: ['#fff3df', '#e0a070'], trim: '#ffd77a', engine: '#ffb36b' },
    // Beta 1.2 Sternenschmiede
    'ship-starlight': { hull: ['#3a4a9a', '#1c2258'], trim: '#ffd77a', engine: '#fff1b8' },
    // Beta 1.3 looks
    'ship-sakura': { hull: ['#fff4f8', '#f2a9c4'], trim: '#ff7aa8', engine: '#ffc4dc' },
    'ship-mint': { hull: ['#e8fff4', '#7fd8b4'], trim: '#fff1d6', engine: '#8ff0d4' },
    // P1.4: a paint with a material – crystal facets and a running glint (scenes/ship-art.js)
    'ship-frost': { hull: ['#f2fcff', '#7fbfe6'], trim: '#bff4ff', engine: '#9fe8ff', material: 'crystal' }
  };
  const SHIP_SHAPES = {
    Horizon: { len: 0.62, h: 0.26, fin: 'twin', nose: 0.2 },
    Comet: { len: 0.72, h: 0.22, fin: 'tail', nose: 0.32 },
    Aegis: { len: 0.56, h: 0.32, fin: 'ring', nose: 0.12 },
    Vanguard: { len: 0.78, h: 0.24, fin: 'twin', nose: 0.38 },
    Corsair: { len: 0.64, h: 0.24, fin: 'wing', nose: 0.22 },
    Pioneer: { len: 0.6, h: 0.3, fin: 'dish', nose: 0.14 }
  };
  function weaponHardpoints(gear) {
    const count = 1 + Math.min(3, Math.floor(gear.weapon / 3));
    return [
      [0.6, 0.06],
      [0.3, 0.3],
      [0.3, -0.04],
      [0.12, 0.34]
    ].slice(0, count);
  }
  function drawPlayerShip(
    ctx,
    model,
    gear,
    time,
    palette = SHIP_PALETTES.default,
    pilotLook = null,
    pilotMood = 'focus'
  ) {
    const shape = SHIP_SHAPES[model] || SHIP_SHAPES.Horizon,
      [light, dark] = palette.hull,
      trim = palette.trim;
    const engineScale = 0.8 + Math.min(1.1, gear.engine * 0.08);
    const flicker = 0.85 + Math.sin(time * 34) * 0.08 + Math.sin(time * 13) * 0.07;
    // Thruster flames
    const flameLen = 0.32 * engineScale * flicker;
    [[0.04], model === 'Aegis' || model === 'Pioneer' ? [0.2] : null].filter(Boolean).forEach(([y]) => {
      const g = ctx.createLinearGradient(-shape.len * 0.62 - flameLen, 0, -shape.len * 0.55, 0);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.6, palette.engine);
      g.addColorStop(1, '#ffffff');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(-shape.len * 0.55 - flameLen * 0.5, y + 0.08, flameLen * 0.6, 0.06 * engineScale, 0, 0, TAU);
      ctx.fill();
    });
    // Fins (behind hull)
    ctx.fillStyle = trim;
    if (shape.fin === 'twin' || shape.fin === 'wing') {
      const span = shape.fin === 'wing' ? 0.42 : 0.3;
      poly(
        ctx,
        [
          [-0.2, 0.1],
          [-0.48, 0.1 + span],
          [-0.5, 0.1 + span * 0.6],
          [-0.42, 0.1]
        ],
        trim
      );
      poly(
        ctx,
        [
          [-0.2, -0.02],
          [-0.44, -0.02 - span * 0.55],
          [-0.48, -0.02 - span * 0.3],
          [-0.42, -0.02]
        ],
        shade(ctx, -0.3, 0, '#ffffff', trim)
      );
    } else if (shape.fin === 'tail') {
      poly(
        ctx,
        [
          [-0.2, 0.0],
          [-0.62, -0.22],
          [-0.56, 0.06]
        ],
        trim
      );
    } else if (shape.fin === 'dish') {
      ctx.strokeStyle = '#d8e6ff';
      ctx.lineWidth = 0.03;
      ctx.beginPath();
      ctx.moveTo(0.05, -0.12);
      ctx.lineTo(0.05, -0.32);
      ctx.stroke();
      blob(ctx, 0.05, -0.34, 0.1, 0.04, '#ffd77a');
    }
    // Hull: rounded capsule
    const hull = shade(ctx, -0.12, 0.34, light, dark);
    ctx.beginPath();
    ctx.moveTo(-shape.len * 0.55, -0.02);
    ctx.quadraticCurveTo(-shape.len * 0.6, shape.h + 0.12, -shape.len * 0.2, shape.h + 0.1);
    ctx.lineTo(shape.len * 0.5, shape.h * 0.6 + 0.08);
    ctx.quadraticCurveTo(shape.len * 0.5 + shape.nose, 0.1, shape.len * 0.5, -0.04);
    ctx.lineTo(-shape.len * 0.2, -0.08);
    ctx.quadraticCurveTo(-shape.len * 0.6, -0.12, -shape.len * 0.55, -0.02);
    ctx.fillStyle = hull;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 0.015;
    ctx.stroke();
    // Stripe + rivets (hull upgrades add armour stripes)
    ctx.fillStyle = trim;
    roundedRect(ctx, -shape.len * 0.35, shape.h * 0.45 + 0.06, shape.len * 0.75, 0.05, 0.025);
    ctx.fill();
    const plates = Math.min(4, Math.floor(gear.hull / 2));
    for (let i = 0; i < plates; i++) blob(ctx, -shape.len * 0.3 + i * 0.12, shape.h + 0.02, 0.025, 0.025, '#ffffffaa');
    // Aegis shield ring
    if (shape.fin === 'ring') {
      ctx.strokeStyle = `rgba(143,240,212,${0.35 + Math.sin(time * 3) * 0.1})`;
      ctx.lineWidth = 0.03;
      ctx.beginPath();
      ctx.ellipse(0.02, 0.1, 0.62, 0.42, 0, 0, TAU);
      ctx.stroke();
    }
    // Heart core (gem-core upgrades make it glow stronger)
    const beat = 1 + Math.sin(time * 5) * 0.08;
    glowCircle(
      ctx,
      -0.12,
      shape.h * 0.5 + 0.03,
      0.12 + Math.min(0.12, gear.core * 0.02),
      '#ff9ecb',
      0.6 + Math.min(0.4, gear.core * 0.08)
    );
    heart(ctx, -0.12, shape.h * 0.5 + 0.04, 0.07 * beat, '#ff7aa8');
    // Cannons
    weaponHardpoints(gear).forEach(([x, y]) => {
      ctx.fillStyle = '#6f7da8';
      roundedRect(ctx, x - 0.08, y - 0.025, 0.17, 0.05, 0.025);
      ctx.fill();
      blob(ctx, x + 0.1, y, 0.03, 0.03, trim);
    });
    // Glass dome with the pilot kitten
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0.12, -0.08, 0.22, 0.2, 0, Math.PI, 0);
    ctx.lineTo(0.34, -0.06);
    ctx.lineTo(-0.1, -0.06);
    ctx.closePath();
    ctx.fillStyle = 'rgba(40,52,110,0.55)';
    ctx.fill();
    ctx.clip();
    if (pilotLook && window.SpaceKittens) {
      ctx.translate(0.13, -0.12);
      ctx.scale(0.3, 0.3);
      window.SpaceKittens.drawPortrait(ctx, pilotLook, { mood: pilotMood, t: time, seed: 3 });
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(220,240,255,0.9)';
    ctx.lineWidth = 0.02;
    ctx.beginPath();
    ctx.ellipse(0.12, -0.08, 0.22, 0.2, 0, Math.PI, 0);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 0.025;
    ctx.beginPath();
    ctx.arc(0.06, -0.12, 0.13, Math.PI * 1.15, Math.PI * 1.45);
    ctx.stroke();
  }

  // Friendly opponents. type 0-5 regular, bosses 0-2. mood: idle | hit | dizzy.
  const CRITTER_COLORS = [
    ['#ffb3a8', '#e06a78'], // pirate drone
    ['#a8f5c4', '#3fbf8a'], // slime
    ['#ffd8a0', '#d8955a'], // scrap bot
    ['#d9c4ff', '#9a7ae0'], // nebula puff
    ['#ffe68a', '#e0b23a'], // bee bot
    ['#e6c8b0', '#b08868'] // rock crab
  ];
  function drawEnemy(ctx, type, time, hit, mood = hit ? 'hit' : 'idle') {
    const [light, dark] = CRITTER_COLORS[type] || CRITTER_COLORS[0];
    const fill = shade(ctx, -0.45, 0.45, hit ? '#ffffff' : light, dark);
    const squash = hit ? 1.08 : 1;
    ctx.save();
    ctx.scale(squash, 2 - squash);
    switch (type) {
      case 0: {
        // Pirate drone: round body, propeller, eyepatch + bandana
        ctx.strokeStyle = '#d8e0ee';
        ctx.lineWidth = 0.04;
        const spin = Math.sin(time * 30) * 0.3;
        ctx.beginPath();
        ctx.moveTo(-0.3 - spin, -0.52);
        ctx.lineTo(0.3 + spin, -0.52);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -0.38);
        ctx.lineTo(0, -0.52);
        ctx.stroke();
        blob(ctx, 0, 0, 0.42, 0.38, fill);
        ctx.fillStyle = '#5a6fd8';
        roundedRect(ctx, -0.4, -0.3, 0.8, 0.12, 0.06);
        ctx.fill();
        critterFace(ctx, -0.04, 0.02, 0.4, mood, time);
        if (mood === 'idle') {
          ctx.fillStyle = '#2a2438';
          blob(ctx, 0.07, 0.02, 0.1, 0.1, '#2a2438');
          ctx.fillRect(-0.3, -0.1, 0.62, 0.025);
        }
        break;
      }
      case 1: {
        // Jelly slime with wobble and shine
        ctx.beginPath();
        for (let i = 0; i <= 28; i++) {
          const a = (i / 28) * TAU,
            r = 0.44 + Math.sin(a * 3 + time * 3) * 0.035,
            y = Math.sin(a) * r * (a > 0 && a < Math.PI ? 0.75 : 0.9);
          i ? ctx.lineTo(Math.cos(a) * r, y) : ctx.moveTo(Math.cos(a) * r, y);
        }
        ctx.fillStyle = fill;
        ctx.globalAlpha = 0.92;
        ctx.fill();
        ctx.globalAlpha = 1;
        blob(ctx, -0.18, -0.2, 0.1, 0.05, 'rgba(255,255,255,0.6)');
        critterFace(ctx, -0.06, 0.02, 0.42, mood, time, '#1f4a38');
        break;
      }
      case 2: {
        // Scrap bot: boxy body, screen face, antenna, gear
        ctx.save();
        ctx.translate(0.3, 0.2);
        ctx.rotate(time * 2);
        ctx.fillStyle = '#c9a77a';
        for (let i = 0; i < 8; i++) {
          ctx.rotate(TAU / 8);
          ctx.fillRect(0.12, -0.03, 0.06, 0.06);
        }
        blob(ctx, 0, 0, 0.13, 0.13, '#b08858');
        ctx.restore();
        ctx.fillStyle = fill;
        roundedRect(ctx, -0.38, -0.36, 0.72, 0.68, 0.14);
        ctx.fill();
        ctx.fillStyle = '#26304d';
        roundedRect(ctx, -0.28, -0.24, 0.5, 0.32, 0.08);
        ctx.fill();
        if (mood === 'idle') {
          ctx.fillStyle = '#8ff0d4';
          const blinkOn = Math.sin(time * 2.3) > -0.95;
          ctx.fillRect(-0.18, -0.14, 0.08, blinkOn ? 0.1 : 0.02);
          ctx.fillRect(0.02, -0.14, 0.08, blinkOn ? 0.1 : 0.02);
        } else critterFace(ctx, -0.03, -0.08, 0.3, mood, time, '#8ff0d4');
        ctx.strokeStyle = '#d8e0ee';
        ctx.lineWidth = 0.03;
        ctx.beginPath();
        ctx.moveTo(0, -0.36);
        ctx.lineTo(0.05, -0.52);
        ctx.stroke();
        blob(ctx, 0.05, -0.54, 0.05, 0.05, Math.sin(time * 5) > 0 ? '#ff9ecb' : '#ffe26b');
        break;
      }
      case 3: {
        // Nebula puff: cloud body, tiny tentacles, sleepy eyes
        ctx.strokeStyle = dark;
        ctx.lineWidth = 0.06;
        ctx.lineCap = 'round';
        for (let i = 0; i < 4; i++) {
          const x = -0.24 + i * 0.16;
          ctx.beginPath();
          ctx.moveTo(x, 0.25);
          ctx.quadraticCurveTo(x + Math.sin(time * 3 + i) * 0.08, 0.42, x, 0.52);
          ctx.stroke();
        }
        [
          [-0.2, 0, 0.26],
          [0.16, -0.04, 0.28],
          [0, -0.18, 0.26],
          [0.02, 0.1, 0.3]
        ].forEach(([x, y, r]) => blob(ctx, x, y, r, r * 0.9, fill));
        critterFace(ctx, -0.04, -0.02, 0.4, mood, time, '#3a2a5a');
        break;
      }
      case 4: {
        // Bee bot: striped round body with fluttering wings and stinger
        const flap = Math.sin(time * 40) * 0.1;
        blob(ctx, 0.05, -0.38 - flap, 0.22, 0.12, 'rgba(230,245,255,0.65)');
        blob(ctx, 0.22, -0.34 + flap, 0.18, 0.1, 'rgba(230,245,255,0.55)');
        blob(ctx, 0, 0, 0.4, 0.34, fill);
        ctx.fillStyle = '#4a3a2a';
        [0.08, 0.24].forEach(x => {
          ctx.save();
          ctx.beginPath();
          ctx.ellipse(0, 0, 0.4, 0.34, 0, 0, TAU);
          ctx.clip();
          ctx.fillRect(x, -0.4, 0.08, 0.8);
          ctx.restore();
        });
        poly(
          ctx,
          [
            [0.4, 0],
            [0.55, 0.04],
            [0.4, 0.08]
          ],
          '#4a3a2a'
        );
        critterFace(ctx, -0.16, -0.02, 0.36, mood, time);
        break;
      }
      default: {
        // Rock crab: rocky shell, stalk eyes, waving claws
        const pinch = Math.sin(time * 4) * 0.08;
        [-1, 1].forEach(side => {
          ctx.strokeStyle = dark;
          ctx.lineWidth = 0.06;
          ctx.beginPath();
          ctx.moveTo(-0.3, side * 0.12);
          ctx.lineTo(-0.52, side * (0.26 + pinch));
          ctx.stroke();
          blob(ctx, -0.58, side * (0.3 + pinch), 0.1, 0.07, fill);
        });
        blob(ctx, 0.02, 0.06, 0.4, 0.3, fill);
        ctx.fillStyle = 'rgba(90,60,40,0.35)';
        [
          [0.12, 0.1, 0.06],
          [0.2, -0.04, 0.04],
          [-0.02, 0.2, 0.05]
        ].forEach(([x, y, r]) => blob(ctx, x, y, r, r, 'rgba(90,60,40,0.35)'));
        ctx.strokeStyle = dark;
        ctx.lineWidth = 0.035;
        [-0.12, 0.06].forEach(x => {
          ctx.beginPath();
          ctx.moveTo(x, -0.16);
          ctx.lineTo(x - 0.04, -0.34);
          ctx.stroke();
        });
        critterFace(ctx, -0.07, -0.38, 0.32, mood, time);
      }
    }
    ctx.restore();
  }
  function drawBoss(ctx, index, time, hit, phaseTwo, mood = hit ? 'hit' : 'angry') {
    const palettes = [
      ['#ffe0b0', '#f08a5a', '#ffd77a'],
      ['#d8deea', '#8a96b8', '#ff9e9e'],
      ['#d9c4ff', '#8a6ad8', '#8ff0d4']
    ];
    const [light, dark, core] = palettes[index % 3];
    const fill = shade(ctx, -0.6, 0.6, hit ? '#ffffff' : light, dark);
    if (index % 3 === 0) {
      // Comet king: round body, flaming pastel tail, crown
      for (let i = 0; i < 6; i++)
        glowCircle(ctx, 0.45 + i * 0.14, Math.sin(time * 3 + i) * 0.05, 0.3 - i * 0.035, i % 2 ? '#ffb3d1' : core, 0.6);
      blob(ctx, 0, 0, 0.5, 0.46, fill);
      poly(
        ctx,
        [
          [-0.22, -0.4],
          [-0.16, -0.62],
          [-0.06, -0.46],
          [0.02, -0.66],
          [0.1, -0.46],
          [0.2, -0.62],
          [0.24, -0.4]
        ],
        '#ffd77a',
        '#c99a3a',
        0.015
      );
      critterFace(ctx, -0.12, -0.02, 0.5, mood, time);
    } else if (index % 3 === 1) {
      // Scrap colossus: big friendly-grumpy mech with screen face and arms
      [-1, 1].forEach(side => {
        ctx.fillStyle = dark;
        roundedRect(ctx, -0.25, side * 0.48 - 0.08, 0.4, 0.16, 0.08);
        ctx.fill();
        blob(ctx, -0.3, side * 0.5, 0.11, 0.11, '#6f7da8');
      });
      ctx.fillStyle = fill;
      roundedRect(ctx, -0.5, -0.5, 0.95, 0.95, 0.2);
      ctx.fill();
      ctx.fillStyle = '#26304d';
      roundedRect(ctx, -0.36, -0.34, 0.66, 0.4, 0.1);
      ctx.fill();
      critterFace(ctx, -0.04, -0.14, 0.42, mood, time, core);
    } else {
      // Nebula hydra: three swaying heads, round body
      blob(ctx, 0.22, 0.05, 0.42, 0.36, fill);
      [-0.36, 0, 0.36].forEach((y, i) => {
        const hx = -0.42 + Math.sin(time * 2 + i) * 0.06,
          hy = y + Math.cos(time * 1.7 + i) * 0.06;
        ctx.strokeStyle = light;
        ctx.lineWidth = 0.13;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0.05, y * 0.4);
        ctx.quadraticCurveTo(-0.2, y, hx, hy);
        ctx.stroke();
        blob(ctx, hx, hy, 0.17, 0.14, fill);
        critterFace(ctx, hx - 0.03, hy - 0.01, 0.22, mood, time + i);
      });
    }
    // Core: armoured in phase 1, exposed & pulsing in phase 2 (real boss mechanic).
    glowCircle(ctx, 0.12, 0.18, phaseTwo ? 0.26 + Math.sin(time * 8) * 0.04 : 0.12, core, phaseTwo ? 1 : 0.5);
    if (phaseTwo) heart(ctx, 0.12, 0.2, 0.08, '#ffffff');
  }

  // (props are defined below the critter helpers because they use blob/poly)
  // Surface props projected onto the rotating sphere (move with the planet, foreshortened near the limb).
  function drawSurfaceProps(ctx, id, cx, cy, r, spin, time) {
    const theme = THEMES[id] || THEMES.crystal,
      rnd = math.seeded(math.hash('props' + id));
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.clip();
    for (let i = 0; i < 16; i++) {
      const lon = rnd() * TAU,
        lat = (rnd() - 0.35) * 1.1,
        size = 0.6 + rnd() * 0.6,
        a = lon - spin * 4;
      const z = Math.cos(lat) * Math.cos(a);
      if (z < 0.15) continue;
      const x = cx + r * Math.cos(lat) * Math.sin(a),
        y = cy - r * Math.sin(lat),
        s = r * 0.12 * size * (0.45 + 0.55 * z);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(s * Math.max(0.35, z), s);
      ctx.globalAlpha = Math.min(1, (z - 0.15) * 3);
      switch (theme.features) {
        case 'crystals':
          [
            [-0.5, 0.2, -0.3],
            [0, 0.4, 0],
            [0.45, 0.25, 0.3]
          ].forEach(([dx, h, rot]) => {
            ctx.save();
            ctx.translate(dx, 0);
            ctx.rotate(rot);
            poly(
              ctx,
              [
                [0, -1.3 - h],
                [0.32, -0.3],
                [0, 0.2],
                [-0.32, -0.3]
              ],
              '#e6dcff',
              'rgba(255,255,255,0.8)',
              0.06
            );
            ctx.restore();
          });
          break;
        case 'caps':
          blob(ctx, 0, 0, 1.1, 0.5, '#ffffff');
          if (i % 4 === 0) {
            ctx.fillStyle = '#e8f8ff';
            ctx.beginPath();
            ctx.arc(0, -0.2, 0.6, Math.PI, 0);
            ctx.fill();
            ctx.fillStyle = '#9fdcea';
            ctx.fillRect(-0.15, -0.35, 0.3, 0.3);
          }
          break;
        case 'lava':
          poly(
            ctx,
            [
              [-0.9, 0.2],
              [-0.25, -0.8],
              [0.25, -0.8],
              [0.9, 0.2]
            ],
            '#b05a6a'
          );
          blob(ctx, 0, -0.8, 0.25, 0.1, '#ffc08a');
          blob(
            ctx,
            0.2 + Math.sin(time + i) * 0.1,
            -1.3 - ((time * 0.5 + i * 0.3) % 1),
            0.3,
            0.25,
            'rgba(255,240,240,0.6)'
          );
          break;
        case 'grid':
          ctx.save();
          ctx.rotate(time * 0.8 + i);
          ctx.fillStyle = '#ffd77a';
          for (let k = 0; k < 6; k++) {
            ctx.rotate(TAU / 6);
            ctx.fillRect(0.45, -0.15, 0.3, 0.3);
          }
          blob(ctx, 0, 0, 0.5, 0.5, '#ffd77a');
          blob(ctx, 0, 0, 0.2, 0.2, '#8a8db8');
          ctx.restore();
          break;
        case 'clouds':
          ctx.fillStyle = '#7a5a4a';
          ctx.fillRect(-0.1, -0.6, 0.2, 0.6);
          blob(ctx, 0, -0.8, 0.6, 0.45, i % 3 ? '#7fd8a8' : '#ff9ecb');
          if (i % 3 === 0) blob(ctx, -0.2, -0.9, 0.12, 0.12, '#ffffff');
          break;
        default:
          blob(ctx, 0, 0, 0.9, 0.35, '#fff1b0');
          blob(ctx, 0, 0, 0.55, 0.2, '#ffffff');
      }
      ctx.restore();
    }
    ctx.restore();
  }

  // Static ship preview image for DOM cards (cached by appearance key).
  const previewCache = new Map();
  function shipPreviewURL(model, gear, palette, pilotLook, width = 160, height = 96) {
    const key = [model, gear.weapon, gear.hull, gear.core, gear.engine, palette?.trim, pilotLook?.id].join(':');
    if (previewCache.has(key)) return previewCache.get(key);
    let url = '';
    try {
      const c = canvas(width, height),
        ctx = c.getContext('2d', { willReadFrequently: true });
      if (ctx && c.toDataURL) {
        ctx.translate(width * 0.52, height * 0.5);
        ctx.scale(height * 0.62, height * 0.62);
        drawPlayerShip(ctx, model, gear, 0.4, palette || SHIP_PALETTES.default, pilotLook, 'happy');
        url = c.toDataURL('image/png');
      }
    } catch {
      url = '';
    }
    if (previewCache.size > 30) previewCache.delete(previewCache.keys().next().value);
    previewCache.set(key, url);
    return url;
  }
  // Product illustrations for the shop (rendered once, cached). Purely presentational.
  const productCache = new Map();
  function gemShape(ctx, x, y, s, fill) {
    poly(
      ctx,
      [
        [x, y - s],
        [x + s * 0.8, y - s * 0.25],
        [x + s * 0.5, y + s * 0.8],
        [x - s * 0.5, y + s * 0.8],
        [x - s * 0.8, y - s * 0.25]
      ],
      fill,
      'rgba(255,255,255,0.8)',
      s * 0.08
    );
    poly(
      ctx,
      [
        [x, y - s],
        [x + s * 0.3, y - s * 0.25],
        [x - s * 0.3, y - s * 0.25]
      ],
      'rgba(255,255,255,0.55)'
    );
  }
  function productArtURL(id, size = 112) {
    if (productCache.has(id)) return productCache.get(id);
    let url = '';
    try {
      const c = canvas(size, size),
        ctx = c.getContext('2d', { willReadFrequently: true });
      if (ctx && c.toDataURL) {
        const bg = ctx.createRadialGradient(size / 2, size * 0.45, 4, size / 2, size / 2, size * 0.7);
        bg.addColorStop(0, '#3d4386');
        bg.addColorStop(1, '#1d2150');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, size, size);
        const K = window.SpaceKittens,
          s = size / 112;
        ctx.save();
        ctx.scale(s, s);
        if (id === 'nh_commander_edition' && K) {
          glowCircle(ctx, 56, 52, 50, '#ffd77a', 0.5);
          ctx.save();
          ctx.translate(56, 104);
          ctx.scale(78, 78);
          K.drawKitten(
            ctx,
            { ...K.ROSTER[0], suit: '#c4b3ff', suitDark: '#7f6ad8' },
            { pose: 'cheer', t: 0.3, seed: 2 }
          );
          ctx.restore();
          poly(
            ctx,
            [
              [38, 16],
              [44, 4],
              [50, 14],
              [56, 0],
              [62, 14],
              [68, 4],
              [74, 16]
            ],
            '#ffd77a',
            '#c99a3a',
            1.5
          );
        } else if (id === 'nh_starter_bundle' && K) {
          [
            [30, 82],
            [56, 88],
            [82, 82]
          ].forEach(([x, y], i) => {
            ctx.fillStyle = i === 1 ? '#ffd77a' : '#ffc08a';
            ctx.beginPath();
            ctx.roundRect ? ctx.roundRect(x - 16, y - 20, 32, 26, 6) : ctx.rect(x - 16, y - 20, 32, 26);
            ctx.fill();
            ctx.fillStyle = '#ff9ecb';
            ctx.fillRect(x - 3, y - 20, 6, 26);
          });
          ctx.save();
          ctx.translate(56, 66);
          ctx.scale(52, 52);
          K.drawKitten(ctx, K.WORKERS[0], { pose: 'hop', t: 0.2, seed: 3 });
          ctx.restore();
        } else if (id === 'nh_season_pass') {
          glowCircle(ctx, 56, 56, 46, '#c4b3ff', 0.7);
          ctx.fillStyle = '#ffd77a';
          ctx.beginPath();
          for (let k = 0; k < 10; k++) {
            const ang = (k / 10) * TAU - Math.PI / 2,
              r = k % 2 ? 16 : 34;
            k
              ? ctx.lineTo(56 + Math.cos(ang) * r, 56 + Math.sin(ang) * r)
              : ctx.moveTo(56 + Math.cos(ang) * r, 56 + Math.sin(ang) * r);
          }
          ctx.closePath();
          ctx.fill();
          heart(ctx, 56, 58, 10, '#ff9ecb');
        } else {
          // Gem packs: more gems for bigger packs
          const count = id === 'nh_gems_large' ? 7 : id === 'nh_gems_medium' ? 4 : 2;
          glowCircle(ctx, 56, 60, 44, '#ff9ecb', 0.45);
          const spots = [
            [56, 56],
            [36, 70],
            [76, 70],
            [46, 36],
            [68, 38],
            [26, 50],
            [86, 50]
          ];
          spots.slice(0, count).forEach(([x, y], i) => gemShape(ctx, x, y, i ? 13 : 18, i % 2 ? '#c4b3ff' : '#ff9ecb'));
        }
        ctx.restore();
        url = c.toDataURL('image/png');
      }
    } catch {
      url = '';
    }
    productCache.set(id, url);
    return url;
  }
  // M.O.T.T.E. machine family: shared core symbol (ring + three dots), round shell, one big eye-light.
  // Warning colours (coral/red) while malfunctioning; mint when repaired/friendly. Used for drones and P.I.P.S.
  function motteSymbol(ctx, x, y, r, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = r * 0.18;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i * TAU) / 3;
      blob(ctx, x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.45, r * 0.16, r * 0.16, color);
    }
  }
  // size ≈ radius in px; friendly switches the light language; variant 'pips' adds the inspector cap & clipboard.
  function drawMotteBot(ctx, x, y, size, time, friendly, opts = {}) {
    const light = friendly ? '#8ff0d4' : '#ff8f8f',
      bob = Math.sin(time * 2.4) * size * 0.06;
    ctx.save();
    ctx.translate(x, y + bob);
    // hover jets
    glowCircle(ctx, -size * 0.45, size * 0.85, size * 0.3, '#8fe3ff', 0.7);
    glowCircle(ctx, size * 0.45, size * 0.85, size * 0.3, '#8fe3ff', 0.7);
    // shell
    const shell = ctx.createLinearGradient(0, -size, 0, size);
    shell.addColorStop(0, opts.hit ? '#ffffff' : '#f4f2ff');
    shell.addColorStop(1, opts.hit ? '#ffffff' : '#a9b0d8');
    ctx.fillStyle = shell;
    ctx.beginPath();
    ctx.ellipse(0, 0, size, size * 0.9, 0, 0, TAU);
    ctx.fill();
    // visor band with the big eye-light
    ctx.fillStyle = '#2a2f5a';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(-size * 0.75, -size * 0.35, size * 1.5, size * 0.6, size * 0.3) : ctx.rect(-size * 0.75, -size * 0.35, size * 1.5, size * 0.6);
    ctx.fill();
    const scan = opts.scanning ? Math.sin(time * 6) * size * 0.35 : 0;
    if (opts.dizzy) {
      ctx.strokeStyle = light;
      ctx.lineWidth = size * 0.1;
      ctx.beginPath();
      ctx.arc(scan, -size * 0.05, size * 0.18, time * 8, time * 8 + Math.PI * 1.5);
      ctx.stroke();
    } else {
      glowCircle(ctx, scan, -size * 0.05, size * 0.42, light, 0.6);
      blob(ctx, scan, -size * 0.05, size * 0.2, friendly ? size * 0.2 : size * 0.13, light);
      blob(ctx, scan - size * 0.06, -size * 0.11, size * 0.06, size * 0.06, '#ffffff');
    }
    // M.O.T.T.E. core symbol on the belly
    motteSymbol(ctx, 0, size * 0.48, size * 0.2, friendly ? '#8ff0d4' : '#ffb35a');
    if (opts.variant === 'pips') {
      // Inspector cap + clipboard: P.I.P.S. is a pedantic inspector
      ctx.fillStyle = '#5a6fd8';
      ctx.beginPath();
      ctx.ellipse(0, -size * 0.82, size * 0.6, size * 0.22, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(-size * 0.7, -size * 0.84, size * 1.4, size * 0.08);
      motteSymbol(ctx, 0, -size * 0.92, size * 0.12, '#ffd77a');
      ctx.save();
      ctx.translate(size * 0.95, size * 0.1);
      ctx.rotate(0.2 + Math.sin(time * 3) * 0.08);
      ctx.fillStyle = '#c9a77a';
      ctx.fillRect(-size * 0.2, -size * 0.28, size * 0.4, size * 0.52);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-size * 0.15, -size * 0.2, size * 0.3, size * 0.38);
      ctx.restore();
    } else {
      ctx.strokeStyle = '#d8e0ee';
      ctx.lineWidth = size * 0.08;
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.88);
      ctx.lineTo(0, -size * 1.15);
      ctx.stroke();
      blob(ctx, 0, -size * 1.2, size * 0.1, size * 0.1, light);
    }
    if (opts.shield) {
      ctx.strokeStyle = 'rgba(143,227,255,' + (0.55 + Math.sin(time * 6) * 0.2) + ')';
      ctx.lineWidth = size * 0.08;
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 1.35, size * 1.25, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }
  // Biome decoration props for the colony ground.
  function drawBiomeProp(ctx, feature, x, y, s, time, i) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s / 10, s / 10);
    switch (feature) {
      case 'crystals':
        poly(ctx, [[0, -16], [5, -3], [0, 3], [-5, -3]], i % 2 ? '#d9ccff' : '#b9c8ff', 'rgba(255,255,255,0.7)', 0.8);
        poly(ctx, [[7, -9], [10, -2], [7, 2], [4, -2]], '#e6dcff');
        break;
      case 'caps':
        blob(ctx, 0, 0, 12, 5, '#ffffff');
        if (i % 3 === 0) {
          ctx.fillStyle = '#e8f8ff';
          ctx.beginPath();
          ctx.arc(0, -2, 8, Math.PI, 0);
          ctx.fill();
          ctx.fillStyle = '#9fdcea';
          ctx.fillRect(-2, -5, 4, 4);
        }
        break;
      case 'lava':
        blob(ctx, 0, 0, 10, 4, '#7a3a4a');
        blob(ctx, 0, -1, 6, 2, '#ffc08a');
        blob(ctx, 2 + Math.sin(time + i) * 2, -8 - ((time * 6 + i * 5) % 10), 3, 3, 'rgba(255,240,240,0.5)');
        break;
      case 'grid':
        ctx.save();
        ctx.translate(0, -8);
        ctx.rotate(time * 0.6 + i);
        ctx.fillStyle = '#ffd77a';
        for (let k = 0; k < 6; k++) {
          ctx.rotate(TAU / 6);
          ctx.fillRect(5, -1.5, 3, 3);
        }
        blob(ctx, 0, 0, 5, 5, '#ffd77a');
        blob(ctx, 0, 0, 2, 2, '#5d5f86');
        ctx.restore();
        break;
      case 'clouds':
        ctx.fillStyle = '#e8d8c8';
        ctx.fillRect(-1.5, -10, 3, 10);
        blob(ctx, 0, -12, 8, 5, i % 3 ? '#7fd8a8' : '#ff9ecb');
        blob(ctx, -3, -13, 1.5, 1.5, '#ffffff');
        break;
      default:
        blob(ctx, 0, 0, 10, 3, '#fff1b0');
        glowCircle(ctx, 0, -1, 8, '#ffd77a', 0.5);
    }
    ctx.restore();
  }
  // Frostbyte: big round frost-management robot of the M.O.T.T.E. network. opts: { friendly, plates (0-3), thawed,
  // telegraph, frozenAttack, hit, dizzy }. Same visor/eye language as P.I.P.S., but rounder, icy shell, little arms.
  function drawFrostbyte(ctx, x, y, size, time, opts = {}) {
    const friendly = opts.friendly,
      bob = Math.sin(time * 1.8) * size * 0.05,
      eye = friendly ? '#8ff0d4' : opts.thawed ? '#ffd77a' : '#7fd6ff';
    ctx.save();
    ctx.translate(x, y + bob);
    // frost aura (hostile) / warm glow (friendly)
    glowCircle(ctx, 0, 0, size * 1.5, friendly ? '#ffd7a8' : '#bff4ff', friendly ? 0.25 : 0.35 + (opts.telegraph ? Math.sin(time * 14) * 0.2 : 0));
    // little hover feet + arms
    glowCircle(ctx, -size * 0.5, size * 0.95, size * 0.28, friendly ? '#ffd77a' : '#8fe3ff', 0.7);
    glowCircle(ctx, size * 0.5, size * 0.95, size * 0.28, friendly ? '#ffd77a' : '#8fe3ff', 0.7);
    const wave = Math.sin(time * (friendly ? 4 : 2)) * 0.25;
    [-1, 1].forEach(side => {
      ctx.save();
      ctx.translate(side * size * 0.95, size * 0.15);
      ctx.rotate(side * (0.5 + (friendly && side > 0 ? wave : 0)));
      ctx.fillStyle = friendly ? '#f6efe6' : '#d9f2ff';
      ctx.beginPath();
      ctx.ellipse(0, size * 0.25, size * 0.16, size * 0.34, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    });
    // round shell
    const shell = ctx.createRadialGradient(-size * 0.3, -size * 0.35, size * 0.1, 0, 0, size * 1.05);
    shell.addColorStop(0, opts.hit ? '#ffffff' : friendly ? '#fffaf2' : '#f2fbff');
    shell.addColorStop(1, opts.hit ? '#ffffff' : friendly ? '#ffd8b8' : '#9fd2ea');
    ctx.fillStyle = shell;
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, TAU);
    ctx.fill();
    // belly plate with the M.O.T.T.E. mark
    ctx.fillStyle = friendly ? 'rgba(255,190,140,0.35)' : 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, size * 0.45, size * 0.55, size * 0.35, 0, 0, TAU);
    ctx.fill();
    motteSymbol(ctx, 0, size * 0.5, size * 0.17, friendly ? '#ff9e5a' : '#5ab8ea');
    // visor with two big expressive eyes
    ctx.fillStyle = '#23315a';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(-size * 0.7, -size * 0.45, size * 1.4, size * 0.62, size * 0.31) : ctx.rect(-size * 0.7, -size * 0.45, size * 1.4, size * 0.62);
    ctx.fill();
    [-0.3, 0.3].forEach(ex => {
      if (opts.dizzy) {
        ctx.strokeStyle = eye;
        ctx.lineWidth = size * 0.07;
        ctx.beginPath();
        ctx.arc(ex * size, -size * 0.14, size * 0.12, time * 8, time * 8 + Math.PI * 1.5);
        ctx.stroke();
        return;
      }
      const blink = Math.sin(time * 0.9 + ex * 3) > 0.97 ? 0.15 : 1,
        worried = !friendly && !opts.thawed;
      glowCircle(ctx, ex * size, -size * 0.14, size * 0.24, eye, 0.55);
      ctx.fillStyle = eye;
      ctx.beginPath();
      ctx.ellipse(ex * size, -size * 0.14, size * 0.14, size * 0.17 * blink, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex * size - size * 0.05, -size * 0.2, size * 0.05, 0, TAU);
      ctx.fill();
      if (worried) {
        ctx.strokeStyle = '#bfe8ff';
        ctx.lineWidth = size * 0.05;
        ctx.beginPath();
        ctx.moveTo(ex * size - size * 0.14, -size * 0.38 + (ex < 0 ? size * 0.05 : 0));
        ctx.lineTo(ex * size + size * 0.14, -size * 0.38 + (ex < 0 ? 0 : size * 0.05));
        ctx.stroke();
      }
    });
    // little smile (friendly) or nervous wiggle
    ctx.strokeStyle = friendly ? '#ff9e5a' : '#5ab8ea';
    ctx.lineWidth = size * 0.05;
    ctx.beginPath();
    if (friendly) ctx.arc(0, size * 0.04, size * 0.16, 0.2 * Math.PI, 0.8 * Math.PI);
    else {
      ctx.moveTo(-size * 0.14, size * 0.1);
      ctx.quadraticCurveTo(-size * 0.05, size * 0.04, 0, size * 0.1);
      ctx.quadraticCurveTo(size * 0.05, size * 0.16, size * 0.14, size * 0.1);
    }
    ctx.stroke();
    // decorative crystal crown (always) + armour plates (boss: 0-3 remaining)
    [-0.35, 0, 0.35].forEach((cx, i) => {
      ctx.save();
      ctx.translate(cx * size, -size * 0.92);
      ctx.rotate(cx * 0.8);
      ctx.fillStyle = friendly ? '#ffd7a8' : '#c8fbff';
      ctx.beginPath();
      ctx.moveTo(0, -size * (0.3 + (i === 1 ? 0.1 : 0)));
      ctx.lineTo(size * 0.1, 0);
      ctx.lineTo(-size * 0.1, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
    const plates = opts.plates ?? 0;
    for (let i = 0; i < plates; i++) {
      const a = Math.PI * (0.85 + i * 0.65);
      ctx.save();
      ctx.translate(Math.cos(a) * size * 1.02, Math.sin(a) * size * 1.02);
      ctx.rotate(a + Math.PI / 2);
      ctx.fillStyle = 'rgba(200,245,255,0.92)';
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = size * 0.03;
      ctx.beginPath();
      ctx.moveTo(-size * 0.42, 0);
      ctx.lineTo(-size * 0.22, -size * 0.3);
      ctx.lineTo(size * 0.22, -size * 0.3);
      ctx.lineTo(size * 0.42, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    if (opts.thawed) for (let i = 0; i < 3; i++) glowCircle(ctx, Math.sin(time * 3 + i * 2) * size * 0.8, -size * 0.2 + i * size * 0.3, size * 0.12, '#ffb35a', 0.6);
    ctx.restore();
  }
  function frostbytePortraitURL(friendly, size = 96) {
    const key = 'fb' + (friendly ? 'f' : 'e') + size;
    if (botPortraits.has(key)) return botPortraits.get(key);
    let url = '';
    try {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (ctx && c.toDataURL) {
        const bg = ctx.createRadialGradient(size / 2, size * 0.4, 4, size / 2, size / 2, size * 0.7);
        bg.addColorStop(0, friendly ? '#6a4a5a' : '#2f5a7a');
        bg.addColorStop(1, '#1d2050');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, size, size);
        drawFrostbyte(ctx, size / 2, size * 0.58, size * 0.3, 0.4, { friendly });
        url = c.toDataURL('image/png');
      }
    } catch {
      url = '';
    }
    botPortraits.set(key, url);
    return url;
  }
  // Dialogue portrait of P.I.P.S. (cached data URL; empty string where canvas is unavailable).
  const botPortraits = new Map();
  function botPortraitURL(friendly, size = 96) {
    const key = (friendly ? 'f' : 'e') + size;
    if (botPortraits.has(key)) return botPortraits.get(key);
    let url = '';
    try {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (ctx && c.toDataURL) {
        const bg = ctx.createRadialGradient(size / 2, size * 0.4, 4, size / 2, size / 2, size * 0.7);
        bg.addColorStop(0, friendly ? '#2f5a6a' : '#4a2f5a');
        bg.addColorStop(1, '#1d2050');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, size, size);
        drawMotteBot(ctx, size / 2, size * 0.55, size * 0.3, 0.4, friendly, { variant: 'pips' });
        url = c.toDataURL('image/png');
      }
    } catch {
      url = '';
    }
    botPortraits.set(key, url);
    return url;
  }
  window.NebulaArt = {
    botPortraitURL,
    drawFrostbyte,
    frostbytePortraitURL,
    THEMES,
    planetTexture,
    spaceBackground,
    drawPlanet,
    drawSurfaceProps,
    drawPlayerShip,
    shipPreviewURL,
    productArtURL,
    weaponHardpoints,
    drawEnemy,
    drawBoss,
    drawMotteBot,
    drawBiomeProp,
    motteSymbol,
    glowCircle,
    poly,
    blob,
    heart,
    critterFace,
    SHIP_PALETTES,
    clearCache: () => cache.clear()
  };
})();
