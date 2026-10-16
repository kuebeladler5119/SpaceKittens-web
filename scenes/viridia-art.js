// Viridia Bloom art (session 11): the bio-planet's own structures and its guardian, drawn with the shared ColonyArt
// primitives. Every function takes the real state it shows (levels, fill ratios, activity, Welke / bloom); nothing
// here decides game logic. Palette: deep teal-green, luminous mint, blossom pink/violet, warm pollen gold.
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const A = () => window.ColonyArt;
  const P = {
    bark: '#5a3e4a',
    bark2: '#40303e',
    barkLight: '#7a5a5e',
    leaf: '#3fae86',
    leafDark: '#22745e',
    leafLight: '#7fe0b0',
    mint: '#8ff0d4',
    glow: '#c8fff0',
    petal: '#ff9ecb',
    petal2: '#d68cff',
    pollen: '#ffd77a',
    welke: '#8a8478',
    ink: '#1f2a3a'
  };
  const glowC = (ctx, x, y, r, c, a) => A().glow(ctx, x, y, r, c, a);
  const blob = (ctx, x, y, rx, ry, color, rot = 0) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
    ctx.fill();
  };
  // A five/six-petal blossom (open 0..1) — used everywhere on Viridia.
  function blossom(ctx, x, y, r, open, color, center, t = 0, wilted = 0) {
    const n = 6;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + t * 0.2,
        dead = i < wilted,
        reach = (0.35 + 0.65 * open) * r;
      blob(ctx, x + Math.cos(a) * reach * 0.55, y + Math.sin(a) * reach * 0.55 + (dead ? r * 0.25 : 0), reach * 0.5, reach * 0.28, dead ? P.welke : color, a);
    }
    blob(ctx, x, y, r * 0.28, r * 0.28, center);
  }

  // Distant bloom skyline (sky layer): giant flower stalks, mushroom trees and floating pollen; sways slowly.
  function bloomSkyline(ctx, width, baseY, k, seed, t, bloom) {
    let s = seed;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let x = -k; x < width; x += (2.6 + rnd() * 3) * k) {
      const kind = Math.floor(rnd() * 3),
        h = (1.4 + rnd() * 1.6) * k,
        sway = Math.sin(t * 0.4 + x * 0.01) * 0.12 * k;
      ctx.strokeStyle = 'rgba(30,70,80,0.85)';
      ctx.lineWidth = 0.16 * k;
      ctx.beginPath();
      ctx.moveTo(x, baseY);
      ctx.quadraticCurveTo(x + sway * 0.5, baseY - h * 0.6, x + sway, baseY - h);
      ctx.stroke();
      if (kind === 0) {
        blossom(ctx, x + sway, baseY - h, 0.75 * k, bloom ? 1 : 0.55, bloom ? 'rgba(255,158,203,0.75)' : 'rgba(170,130,160,0.6)', 'rgba(255,215,122,0.8)', t * 0.1);
      } else if (kind === 1) {
        // mushroom tree
        ctx.fillStyle = 'rgba(40,80,96,0.9)';
        ctx.beginPath();
        ctx.ellipse(x + sway, baseY - h, 1.1 * k, 0.55 * k, 0, Math.PI, TAU);
        ctx.fill();
        for (let i = 0; i < 4; i++) glowC(ctx, x + sway - 0.6 * k + i * 0.4 * k, baseY - h - 0.15 * k, 0.07 * k, P.mint, 0.8);
      } else {
        // fern fronds
        for (let i = 0; i < 5; i++) {
          ctx.strokeStyle = 'rgba(40,110,100,0.8)';
          ctx.lineWidth = 0.08 * k;
          ctx.beginPath();
          ctx.moveTo(x, baseY - h * 0.4);
          ctx.quadraticCurveTo(x + (i - 2) * 0.5 * k, baseY - h * 0.9, x + (i - 2) * 0.8 * k + sway, baseY - h * 0.7);
          ctx.stroke();
        }
      }
    }
    // floating pollen (more when blooming)
    for (let i = 0; i < (bloom ? 14 : 6); i++) {
      const px = ((i * 137.3 + t * 9) % (width + 20)) - 10,
        py = baseY - (0.8 + ((i * 0.37) % 1) * 2.6) * k + Math.sin(t + i) * 0.1 * k;
      glowC(ctx, px, py, 0.05 * k, bloom ? P.pollen : P.mint, 0.75);
    }
  }

  // Uralter Wurzelknoten: a squat ancient knot with a hollow glowing heart, arching root arms and a leafy crown; grey
  // Welke patches eat it until it is healed. o: welke (0..1 share still withered), bloom (Petalguard friendly)
  function rootNode(ctx, x, y, k, t, o = {}) {
    const welke = Math.max(0, Math.min(1, o.welke || 0)),
      bark = welke > 0.6 ? '#6a5a5a' : P.bark;
    A().shadow(ctx, x, y, 2.6 * k, k);
    // arching root arms (above ground, like big knees)
    for (const [dx, h, w] of [[-1.5, 0.55, 0.26], [-0.9, 0.85, 0.3], [0.9, 0.85, 0.3], [1.5, 0.55, 0.26]]) {
      ctx.strokeStyle = bark;
      ctx.lineWidth = w * k;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x + dx * 0.35 * k, y - 0.7 * k);
      ctx.quadraticCurveTo(x + dx * 0.8 * k, y - h * k - 0.2 * k, x + dx * k, y + 0.05 * k);
      ctx.stroke();
    }
    // the knot body
    ctx.fillStyle = bark;
    ctx.beginPath();
    ctx.ellipse(x, y - 1.05 * k, 0.95 * k, 1.0 * k, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = P.bark2;
    ctx.beginPath();
    ctx.ellipse(x + 0.25 * k, y - 0.85 * k, 0.55 * k, 0.75 * k, 0.2, 0, TAU);
    ctx.fill();
    // bark grain
    ctx.strokeStyle = 'rgba(255,230,210,0.16)';
    ctx.lineWidth = 0.04 * k;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(x - 0.1 * k, y - 1.05 * k, (0.35 + i * 0.12) * k, Math.PI * 0.7, Math.PI * 1.3);
      ctx.stroke();
    }
    // hollow heart with the glowing core (pulses; faint while withered)
    const pulse = o.reduced ? 0.8 : 0.65 + 0.25 * Math.sin(t * 2);
    ctx.fillStyle = '#1a2a30';
    ctx.beginPath();
    ctx.ellipse(x, y - 1.0 * k, 0.36 * k, 0.48 * k, 0, 0, TAU);
    ctx.fill();
    glowC(ctx, x, y - 1.0 * k, 0.9 * k, o.bloom ? P.pollen : P.mint, (1 - welke * 0.75) * pulse);
    blob(ctx, x, y - 1.0 * k, 0.18 * k, 0.24 * k, welke > 0.5 ? '#7a8a80' : o.bloom ? '#ffe9a8' : P.glow);
    // Welke patches
    for (let i = 0; i < Math.round(welke * 6); i++) {
      const a = i * 1.05,
        px = x + Math.cos(a) * 0.72 * k,
        py = y - 1.05 * k + Math.sin(a) * 0.72 * k;
      blob(ctx, px, py, 0.2 * k, 0.13 * k, 'rgba(150,144,128,0.9)', a);
    }
    // crown: leaf clusters (wilting grey), blossoms once Petalguard is friendly
    for (let i = 0; i < 6; i++) {
      const a = Math.PI + (i / 5) * Math.PI;
      blob(ctx, x + Math.cos(a) * 0.85 * k, y - 1.75 * k + Math.sin(a) * 0.55 * k, 0.42 * k, 0.24 * k, welke > 0.6 ? '#8a9070' : i % 2 ? P.leaf : P.leafDark, a + Math.PI / 2);
    }
    if (o.bloom) for (let i = 0; i < 3; i++) blossom(ctx, x + (i - 1) * 0.6 * k, y - 2.25 * k + Math.abs(i - 1) * 0.12 * k, 0.3 * k, 1, i % 2 ? P.petal2 : P.petal, P.pollen, t);
    A().plaque(ctx, x, y + 0.18 * k, k * 0.9, 'Wurzelknoten', o.bloom ? P.pollen : P.mint);
    return { x0: x - 1.4 * k, y0: y - 2.5 * k, x1: x + 1.4 * k, y1: y + 0.5 * k };
  }
  // A glowing root line from the knot to a building, arching just above the ground (growing roots: dashed and dim).
  function rootLine(ctx, x0, y0, x1, y1, k, t, growing, reduced) {
    const midX = (x0 + x1) / 2,
      top = Math.min(y0, y1) - 0.45 * k;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = growing ? 'rgba(90,62,74,0.55)' : P.bark;
    ctx.lineWidth = 0.16 * k;
    if (growing) ctx.setLineDash([0.2 * k, 0.18 * k]);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(midX, top, x1, y1);
    ctx.stroke();
    ctx.strokeStyle = growing ? 'rgba(143,240,212,0.35)' : 'rgba(143,240,212,0.9)';
    ctx.lineWidth = 0.05 * k;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(midX, top, x1, y1);
    ctx.stroke();
    ctx.setLineDash([]);
    const n = growing ? 0 : 3;
    for (let i = 0; i < n; i++) {
      const u = reduced ? (i + 0.5) / n : (t * 0.35 + i / n) % 1,
        px = (1 - u) * (1 - u) * x0 + 2 * u * (1 - u) * midX + u * u * x1,
        py = (1 - u) * (1 - u) * y0 + 2 * u * (1 - u) * top + u * u * y1;
      glowC(ctx, px, py, 0.13 * k, P.glow, 0.9);
    }
    ctx.restore();
  }

  // Sporengarten: raised beds of giant bell flowers puffing Leuchtsporen (only while really harvesting).
  function sporeGarden(ctx, x, y, k, o) {
    const { fillRR, plaque } = A();
    const level = o.level,
      on = o.active,
      t = o.time,
      beds = level >= 25 ? 3 : level >= 10 ? 2 : 1,
      bw = beds === 1 ? 2.4 : 1.25;
    A().shadow(ctx, x, y, 3.4 * k, k);
    for (let b = 0; b < beds; b++) {
      const bx = x - ((beds - 1) * bw * k) / 2 + b * bw * k - 0.2 * k;
      fillRR(ctx, bx - (bw / 2 - 0.05) * k, y - 0.42 * k, (bw - 0.1) * k, 0.42 * k, 0.14 * k, P.bark);
      fillRR(ctx, bx - (bw / 2 - 0.1) * k, y - 0.48 * k, (bw - 0.2) * k, 0.13 * k, 0.06 * k, '#6a4a3a');
      const flowers = beds === 1 ? 3 : 2;
      for (let i = 0; i < flowers; i++) {
        const fx = bx - ((flowers - 1) * 0.62 * k) / 2 + i * 0.62 * k,
          sway = o.reduced ? 0 : Math.sin(t * 1.2 + b + i) * 0.07 * k,
          h = (1.35 + ((b + i) % 3) * 0.3) * k;
        ctx.strokeStyle = P.leafDark;
        ctx.lineWidth = 0.08 * k;
        ctx.beginPath();
        ctx.moveTo(fx, y - 0.45 * k);
        ctx.quadraticCurveTo(fx + sway, y - 0.45 * k - h * 0.6, fx + sway, y - 0.45 * k - h);
        ctx.stroke();
        blob(ctx, fx - 0.12 * k, y - 0.7 * k, 0.16 * k, 0.07 * k, P.leaf, -0.6);
        // bell blossom (opens downward), glowing spores drift up while harvesting
        const hx = fx + sway,
          hy = y - 0.45 * k - h;
        ctx.fillStyle = (b + i) % 2 ? P.petal2 : P.petal;
        ctx.beginPath();
        ctx.moveTo(hx - 0.38 * k, hy + 0.26 * k);
        ctx.quadraticCurveTo(hx, hy - 0.55 * k, hx + 0.38 * k, hy + 0.26 * k);
        ctx.quadraticCurveTo(hx, hy + 0.1 * k, hx - 0.38 * k, hy + 0.26 * k);
        ctx.fill();
        glowC(ctx, hx, hy + 0.16 * k, 0.22 * k, P.pollen, on ? 0.7 : 0.35);
        if (on) for (let p = 0; p < 2; p++) glowC(ctx, hx + Math.sin(t * 2 + p) * 0.2 * k, hy - ((t * 0.6 + p * 0.5 + i) % 1) * 0.9 * k, 0.07 * k, P.pollen, 0.85);
      }
    }
    // spore jar = real Leuchtsporen store
    const fill = Math.max(0, Math.min(1, o.fill || 0)),
      jx = x + 1.75 * k;
    fillRR(ctx, jx - 0.22 * k, y - 0.75 * k, 0.44 * k, 0.75 * k, 0.12 * k, 'rgba(200,255,240,0.25)');
    fillRR(ctx, jx - 0.18 * k, y - 0.08 * k - 0.6 * k * fill, 0.36 * k, 0.6 * k * fill + 0.04 * k, 0.08 * k, P.pollen);
    if (o.welke) for (let i = 0; i < 3; i++) thornVine(ctx, x - 1.4 * k + i * 1.3 * k, y, k * 0.6, t, i);
    plaque(ctx, x, y + 0.18 * k, k, 'Sporengarten Lv ' + level, P.pollen);
    return { x0: x - 2 * k, y0: y - 2.3 * k, x1: x + 2 * k, y1: y + 0.6 * k };
  }
  // Biolabor: a glass dome greenhouse with bubbling Biogel vats and tubes (bubbles only while really brewing).
  function biolab(ctx, x, y, k, o) {
    const { fillRR, plaque } = A();
    const level = o.level,
      on = o.active,
      t = o.time;
    A().shadow(ctx, x, y, 3.4 * k, k);
    fillRR(ctx, x - 1.6 * k, y - 0.5 * k, 3.2 * k, 0.5 * k, 0.15 * k, P.bark2);
    // dome (glass) with a leafy frame
    ctx.fillStyle = 'rgba(160,255,225,0.22)';
    ctx.beginPath();
    ctx.ellipse(x, y - 0.5 * k, 1.5 * k, 1.55 * k, 0, Math.PI, TAU);
    ctx.fill();
    ctx.strokeStyle = P.leafDark;
    ctx.lineWidth = 0.07 * k;
    for (const a of [0.25, 0.5, 0.75]) {
      ctx.beginPath();
      ctx.ellipse(x, y - 0.5 * k, 1.5 * k * Math.cos((a - 0.5) * Math.PI) + 0.01, 1.55 * k, 0, Math.PI, TAU);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(x, y - 0.5 * k, 1.5 * k, 1.55 * k, 0, Math.PI, TAU);
    ctx.stroke();
    // gel vats (count by stage) — fill = real Biogel store
    const vats = level >= 25 ? 3 : level >= 10 ? 2 : 1,
      gel = Math.max(0, Math.min(1, o.gel || 0));
    for (let i = 0; i < vats; i++) {
      const vx = x - (vats - 1) * 0.45 * k + i * 0.9 * k;
      fillRR(ctx, vx - 0.3 * k, y - 1.3 * k, 0.6 * k, 0.8 * k, 0.25 * k, 'rgba(255,255,255,0.18)');
      fillRR(ctx, vx - 0.26 * k, y - 0.54 * k - 0.7 * k * gel, 0.52 * k, 0.7 * k * gel + 0.02 * k, 0.22 * k, '#5fe0a0');
      if (on) for (let b = 0; b < 3; b++) glowC(ctx, vx + (b - 1) * 0.12 * k, y - 0.6 * k - ((t * 0.8 + b * 0.33 + i * 0.2) % 1) * 0.7 * k, 0.05 * k, '#e0fff2', 0.9);
    }
    // spore funnel feeding the dome (real Leuchtsporen at the intake)
    const fill = Math.max(0, Math.min(1, o.fill || 0));
    fillRR(ctx, x + 1.45 * k, y - 1.2 * k, 0.32 * k, 0.7 * k, 0.1 * k, P.bark);
    for (let i = 0; i < Math.round(fill * 3); i++) glowC(ctx, x + 1.61 * k, y - 1.1 * k + i * 0.18 * k, 0.07 * k, P.pollen, 0.9);
    ctx.strokeStyle = P.mint;
    ctx.lineWidth = 0.06 * k;
    ctx.beginPath();
    ctx.moveTo(x + 1.45 * k, y - 0.9 * k);
    ctx.quadraticCurveTo(x + 1.2 * k, y - 1.5 * k, x + 0.5 * k, y - 1.35 * k);
    ctx.stroke();
    // a big leaf on top, a blossom from Lv 25
    blob(ctx, x - 0.2 * k, y - 2.05 * k, 0.55 * k, 0.2 * k, P.leaf, -0.3);
    if (level >= 25) blossom(ctx, x + 0.4 * k, y - 2.05 * k, 0.32 * k, 1, P.petal2, P.pollen, t);
    if (o.welke) thornVine(ctx, x - 1.5 * k, y, k * 0.75, t, 2);
    if (o.capped)
      A().plaque(ctx, x, y - 2.45 * k, k * 0.7, 'WELKE', '#c8c0a8');
    plaque(ctx, x, y + 0.18 * k, k, 'Biolabor Lv ' + level, P.mint);
    return { x0: x - 1.8 * k, y0: y - 2.4 * k, x1: x + 1.9 * k, y1: y + 0.6 * k };
  }
  // Wurzellager (depot): a hollow giant tree stump with a round door and stacked crystal sacks (fill = real depot)
  function depot(ctx, x, y, k, o) {
    const { fillRR, plaque, crystal } = A();
    A().shadow(ctx, x, y, 3 * k, k);
    ctx.fillStyle = P.bark;
    ctx.beginPath();
    ctx.moveTo(x - 1.3 * k, y);
    ctx.lineTo(x - 1.15 * k, y - 1.7 * k);
    ctx.quadraticCurveTo(x, y - 2.0 * k, x + 1.15 * k, y - 1.7 * k);
    ctx.lineTo(x + 1.3 * k, y);
    ctx.closePath();
    ctx.fill();
    blob(ctx, x, y - 1.72 * k, 1.15 * k, 0.25 * k, P.barkLight);
    blob(ctx, x, y - 1.72 * k, 0.85 * k, 0.15 * k, '#a07a68');
    for (let r = 0; r < 3; r++) {
      ctx.strokeStyle = 'rgba(30,20,30,0.25)';
      ctx.lineWidth = 0.04 * k;
      ctx.beginPath();
      ctx.ellipse(x, y - 1.72 * k, (0.25 + r * 0.22) * k, (0.05 + r * 0.04) * k, 0, 0, TAU);
      ctx.stroke();
    }
    fillRR(ctx, x - 0.38 * k, y - 0.95 * k, 0.76 * k, 0.95 * k, 0.38 * k, P.ink);
    glowC(ctx, x, y - 0.5 * k, 0.4 * k, P.mint, o.active ? 0.5 : 0.25);
    const fill = Math.max(0, Math.min(1, o.fill || 0));
    for (let i = 0; i < Math.round(fill * 5); i++) crystal(ctx, x - 1.05 * k + (i % 3) * 0.18 * k, y - 0.15 * k - Math.floor(i / 3) * 0.25 * k, 0.12 * k, P.mint, 0.2);
    blob(ctx, x + 0.9 * k, y - 1.95 * k, 0.32 * k, 0.16 * k, P.leaf, 0.4);
    plaque(ctx, x, y + 0.18 * k, k, 'Wurzellager Lv ' + o.level, P.mint);
    return { x0: x - 1.4 * k, y0: y - 2.2 * k, x1: x + 1.4 * k, y1: y + 0.6 * k };
  }
  // Blütenmarkt (stall): a counter under a huge flower canopy; the canopy opens wider at higher levels.
  function stall(ctx, x, y, k, o) {
    const { fillRR, plaque } = A();
    A().shadow(ctx, x, y, 2.6 * k, k);
    ctx.strokeStyle = P.leafDark;
    ctx.lineWidth = 0.14 * k;
    ctx.beginPath();
    ctx.moveTo(x, y - 0.6 * k);
    ctx.lineTo(x, y - 2.0 * k);
    ctx.stroke();
    const open = o.level >= 25 ? 1 : o.level >= 10 ? 0.85 : 0.7;
    for (let i = 0; i < 5; i++) {
      const a = Math.PI + (i / 4) * Math.PI;
      blob(ctx, x + Math.cos(a) * 0.8 * k * open, y - 2.1 * k + Math.sin(a) * 0.35 * k, 0.6 * k * open, 0.24 * k, i % 2 ? P.petal : '#ffb8da', a + Math.PI / 2);
    }
    blob(ctx, x, y - 2.15 * k, 0.25 * k, 0.18 * k, P.pollen);
    const counter = { x0: x - 1.1 * k, y0: y - 0.75 * k, x1: x + 1.1 * k, y1: y };
    fillRR(ctx, counter.x0, counter.y0, 2.2 * k, 0.75 * k, 0.15 * k, P.bark);
    fillRR(ctx, counter.x0 + 0.05 * k, counter.y0, 2.1 * k, 0.14 * k, 0.07 * k, P.leaf);
    for (let i = 0; i < 4; i++) glowC(ctx, x - 0.75 * k + i * 0.5 * k, y - 0.88 * k, 0.09 * k, i % 2 ? P.pollen : '#5fe0a0', o.saleGlow ? 0.95 : 0.6);
    plaque(ctx, x, y + 0.18 * k, k, 'Blütenmarkt Lv ' + o.level, P.petal);
    return { x0: x - 1.4 * k, y0: y - 2.5 * k, x1: x + 1.4 * k, y1: y + 0.6 * k, counter };
  }
  // A thorn vine creeping over a plot (the Welke's overgrowth before Petalguard is healed).
  function thornVine(ctx, x, y, s, t, seed = 0) {
    ctx.save();
    ctx.strokeStyle = '#5a6a4a';
    ctx.lineWidth = 0.08 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 0.5 * s, y);
    for (let i = 1; i <= 6; i++) ctx.lineTo(x - 0.5 * s + i * 0.17 * s, y - Math.abs(Math.sin(i * 1.3 + seed)) * 0.9 * s - i * 0.05 * s);
    ctx.stroke();
    ctx.fillStyle = '#7a8a5a';
    for (let i = 1; i <= 6; i++) {
      const tx = x - 0.5 * s + i * 0.17 * s,
        ty = y - Math.abs(Math.sin(i * 1.3 + seed)) * 0.9 * s - i * 0.05 * s;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx + 0.06 * s, ty - 0.1 * s);
      ctx.lineTo(tx + 0.08 * s, ty + 0.02 * s);
      ctx.fill();
    }
    ctx.restore();
  }
  // Ground props: ferns, glowing mushrooms and bulb flowers (they glow brighter once the planet blooms).
  function prop(ctx, x, y, s, t, i, bloom) {
    const kind = i % 4;
    if (kind === 0) {
      for (let f = 0; f < 4; f++) {
        ctx.strokeStyle = P.leaf;
        ctx.lineWidth = 0.06 * s;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + (f - 1.5) * 0.25 * s, y - 0.6 * s, x + (f - 1.5) * 0.45 * s + Math.sin(t + f + i) * 0.04 * s, y - 0.45 * s);
        ctx.stroke();
      }
    } else if (kind === 1) {
      ctx.fillStyle = '#e8e0d0';
      ctx.fillRect(x - 0.05 * s, y - 0.35 * s, 0.1 * s, 0.35 * s);
      blob(ctx, x, y - 0.38 * s, 0.26 * s, 0.14 * s, bloom ? '#b98aff' : '#8a7aa8');
      glowC(ctx, x, y - 0.4 * s, 0.35 * s, P.mint, bloom ? 0.45 : 0.2);
    } else if (kind === 2) {
      ctx.strokeStyle = P.leafDark;
      ctx.lineWidth = 0.05 * s;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - 0.55 * s);
      ctx.stroke();
      blossom(ctx, x, y - 0.6 * s, 0.22 * s, bloom ? 1 : 0.6, bloom ? P.petal : '#b89aa8', P.pollen, t * 0.5);
    } else {
      blob(ctx, x, y - 0.12 * s, 0.35 * s, 0.14 * s, P.leafDark);
      glowC(ctx, x + 0.1 * s, y - 0.2 * s, 0.12 * s, P.pollen, bloom ? 0.8 : 0.35);
    }
  }

  // ----- Petalguard (she), "die Blütenwächterin" -----
  // A tall flower guardian: a slender stem body with leaf arms, a round face in the blossom centre, six petals around
  // her head (closed bud / open bloom), wilted petals droop grey. (x, y) = centre; height ≈ 3 · s.
  // o.mood: bud | telegraph | bloom | tired | friendly | angry; o.petals 0..6; o.healing; o.hit; o.reduced
  function drawPetalguard(ctx, x, y, s, t, o = {}) {
    const mood = o.mood || 'bud',
      petals = o.petals ?? 6,
      open = mood === 'bloom' || mood === 'friendly' ? 1 : mood === 'telegraph' ? 0.55 : mood === 'tired' ? 0.4 : 0.15,
      sway = o.reduced ? 0 : Math.sin(t * 1.4) * 0.05 * s,
      calm = mood === 'friendly',
      tired = mood === 'tired';
    ctx.save();
    ctx.translate(x + sway, y);
    if (o.hit) ctx.translate(Math.sin(t * 60) * 0.03 * s, 0);
    if (tired) ctx.rotate(0.14);
    // root feet
    for (const d of [-1, 0, 1]) {
      ctx.strokeStyle = P.bark;
      ctx.lineWidth = 0.14 * s;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(d * 0.1 * s, 0.9 * s);
      ctx.quadraticCurveTo(d * 0.4 * s, 1.15 * s, d * 0.6 * s, 1.25 * s);
      ctx.stroke();
    }
    // stem body
    ctx.fillStyle = P.leafDark;
    ctx.beginPath();
    ctx.moveTo(-0.32 * s, 0.95 * s);
    ctx.quadraticCurveTo(-0.45 * s, 0.1 * s, -0.18 * s, -0.55 * s);
    ctx.lineTo(0.18 * s, -0.55 * s);
    ctx.quadraticCurveTo(0.45 * s, 0.1 * s, 0.32 * s, 0.95 * s);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = P.leaf;
    ctx.lineWidth = 0.05 * s;
    ctx.beginPath();
    ctx.moveTo(0, 0.9 * s);
    ctx.lineTo(0, -0.5 * s);
    ctx.stroke();
    // leaf arms (raised while angry / telegraphing, lowered when tired)
    const arm = tired ? 0.6 : mood === 'telegraph' || mood === 'angry' ? -0.7 : -0.2;
    for (const d of [-1, 1]) {
      ctx.save();
      ctx.translate(d * 0.25 * s, 0.05 * s);
      ctx.rotate(d * (0.9 + arm) + (o.reduced ? 0 : Math.sin(t * 2 + d) * 0.06));
      blob(ctx, d * 0.45 * s, 0, 0.5 * s, 0.18 * s, P.leaf, 0);
      ctx.strokeStyle = P.leafDark;
      ctx.lineWidth = 0.03 * s;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(d * 0.85 * s, 0);
      ctx.stroke();
      ctx.restore();
    }
    // healing glow while blooming with living petals
    if (o.healing) glowC(ctx, 0, -1.05 * s, 1.25 * s, '#7fffb0', 0.35 + (o.reduced ? 0 : 0.12 * Math.sin(t * 5)));
    // petals around the head: living ones in pink/violet, wilted ones drooping grey
    const hy = -1.05 * s;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU - Math.PI / 2,
        alive = i < petals,
        reach = alive ? (0.42 + 0.48 * open) * s : 0.5 * s,
        px = Math.cos(a) * reach * 0.62,
        py = hy + Math.sin(a) * reach * 0.62 + (alive ? 0 : 0.28 * s);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(a + Math.PI / 2 + (alive ? 0 : 0.5));
      blob(ctx, 0, 0, alive ? (0.16 + 0.14 * open) * s : 0.16 * s, alive ? (0.32 + 0.18 * open) * s : 0.3 * s, alive ? (i % 2 ? P.petal : P.petal2) : P.welke, 0);
      if (alive && open > 0.5) blob(ctx, 0, -0.12 * s, 0.06 * s, 0.14 * s, 'rgba(255,255,255,0.35)', 0);
      ctx.restore();
    }
    // face in the blossom centre
    blob(ctx, 0, hy, 0.42 * s, 0.4 * s, calm ? '#ffe7a8' : tired ? '#d8cfa8' : P.pollen);
    const eyeY = hy - 0.05 * s,
      blink = !o.reduced && Math.sin(t * 0.9) > 0.97;
    for (const d of [-1, 1]) {
      if (blink || tired) {
        ctx.strokeStyle = P.ink;
        ctx.lineWidth = 0.035 * s;
        ctx.beginPath();
        ctx.arc(d * 0.14 * s, eyeY, 0.06 * s, 0.2, Math.PI - 0.2);
        ctx.stroke();
      } else {
        blob(ctx, d * 0.14 * s, eyeY, 0.075 * s, 0.09 * s, P.ink);
        blob(ctx, d * 0.14 * s - 0.02 * s, eyeY - 0.03 * s, 0.025 * s, 0.025 * s, '#ffffff');
      }
      if (mood === 'angry' || mood === 'telegraph') {
        ctx.strokeStyle = P.ink;
        ctx.lineWidth = 0.035 * s;
        ctx.beginPath();
        ctx.moveTo(d * 0.24 * s, eyeY - 0.16 * s);
        ctx.lineTo(d * 0.06 * s, eyeY - 0.1 * s);
        ctx.stroke();
      }
    }
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 0.03 * s;
    ctx.beginPath();
    if (calm) ctx.arc(0, hy + 0.08 * s, 0.1 * s, 0.2, Math.PI - 0.2);
    else if (tired) ctx.arc(0, hy + 0.2 * s, 0.07 * s, Math.PI + 0.3, TAU - 0.3);
    else {
      ctx.moveTo(-0.07 * s, hy + 0.15 * s);
      ctx.lineTo(0.07 * s, hy + 0.15 * s);
    }
    ctx.stroke();
    blob(ctx, -0.27 * s, hy + 0.08 * s, 0.06 * s, 0.035 * s, 'rgba(255,120,150,0.45)');
    blob(ctx, 0.27 * s, hy + 0.08 * s, 0.06 * s, 0.035 * s, 'rgba(255,120,150,0.45)');
    // M.O.T.T.E. seed mark on the stem (ring + three dots)
    ctx.strokeStyle = P.mint;
    ctx.lineWidth = 0.03 * s;
    ctx.beginPath();
    ctx.arc(0, 0.25 * s, 0.11 * s, 0, TAU);
    ctx.stroke();
    for (let i = 0; i < 3; i++) blob(ctx, -0.05 * s + i * 0.05 * s, 0.25 * s, 0.015 * s, 0.015 * s, P.mint);
    // pollen sparkle when friendly
    if (calm && !o.reduced) for (let i = 0; i < 4; i++) glowC(ctx, Math.sin(t + i * 1.6) * 0.8 * s, hy - 0.6 * s - ((t * 0.3 + i * 0.25) % 1) * 0.6 * s, 0.05 * s, P.pollen, 0.85);
    ctx.restore();
  }
  // Dornenranke: a floating coil of thorny vine with a single watching bud.
  function drawThornVine(ctx, x, y, s, t, o = {}) {
    ctx.save();
    ctx.translate(x, y + (o.reduced ? 0 : Math.sin(t * 2.4) * 0.08 * s));
    if (o.hit) ctx.translate(Math.sin(t * 60) * 0.04 * s, 0);
    ctx.strokeStyle = '#4a7a4a';
    ctx.lineWidth = 0.14 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * TAU * 1.6 + t * 0.6,
        r = (0.25 + i / 80) * s;
      ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r * 0.7);
    }
    ctx.stroke();
    ctx.fillStyle = '#8aa060';
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU * 1.6 + t * 0.6,
        r = (0.25 + i / 20) * s;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r * 0.7);
      ctx.lineTo(Math.cos(a) * (r + 0.12 * s), Math.sin(a) * (r + 0.12 * s) * 0.7);
      ctx.lineTo(Math.cos(a + 0.2) * r, Math.sin(a + 0.2) * r * 0.7);
      ctx.fill();
    }
    blob(ctx, 0, 0, 0.2 * s, 0.24 * s, '#c86a9a');
    blob(ctx, 0, -0.02 * s, 0.09 * s, 0.1 * s, '#ffe8a8');
    blob(ctx, 0, -0.02 * s, 0.045 * s, 0.06 * s, P.ink);
    ctx.restore();
  }
  const portraits = new Map();
  function petalguardPortraitURL(mood = 'bud', size = 96) {
    const key = mood + size;
    if (portraits.has(key)) return portraits.get(key);
    let url = '';
    try {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (ctx && c.toDataURL) {
        const bg = ctx.createRadialGradient(size / 2, size * 0.35, 4, size / 2, size / 2, size * 0.7);
        bg.addColorStop(0, mood === 'friendly' ? '#3a7a6a' : mood === 'bud' ? '#24404a' : '#4a3a5a');
        bg.addColorStop(1, '#122030');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, size, size);
        drawPetalguard(ctx, size / 2, size * 0.98, size * 0.36, 0.6, { mood: mood === 'angry' ? 'angry' : mood, petals: 6, reduced: true });
        url = c.toDataURL('image/png');
      }
    } catch {
      url = '';
    }
    portraits.set(key, url);
    return url;
  }

  window.ViridiaArt = { PALETTE: P, blossom, bloomSkyline, rootNode, rootLine, sporeGarden, biolab, depot, stall, thornVine, prop, drawPetalguard, drawThornVine, petalguardPortraitURL };
})();
