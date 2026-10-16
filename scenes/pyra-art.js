// Pyra-9 art (session 8): the volcanic colony's own structures and Emberbell, drawn with the shared ColonyArt
// primitives. Every function takes the real state it shows (levels, fill ratios, activity, before/after the repair);
// nothing here decides game logic. Palette: coral, ember orange, golden yellow, deep plum, basalt; cyan cooling
// accents keep equipment readable. `calm` = Emberbell recalibrated (the colony after its liberation).
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const A = () => window.ColonyArt;
  const P = {
    basalt: '#3a2f45',
    basalt2: '#2a2234',
    plum: '#5a2e4e',
    coral: '#ff8a72',
    ember: '#ff9a3a',
    gold: '#ffd25a',
    cyan: '#7fe8f0',
    steel: '#8a8fb0'
  };

  // Distant volcanoes (sky layer). Before the repair the craters glow red and smoke; afterwards they rest.
  function volcanoSkyline(ctx, width, baseY, k, seed, calm, t) {
    let s = seed;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let x = -k; x < width; x += (5 + rnd() * 5) * k) {
      const h = (2.2 + rnd() * 1.8) * k,
        half = (2.2 + rnd() * 1.4) * k,
        cx = x + half;
      ctx.fillStyle = 'rgba(70,32,70,0.85)';
      ctx.beginPath();
      ctx.moveTo(cx - half, baseY);
      ctx.lineTo(cx - 0.35 * k, baseY - h);
      ctx.lineTo(cx + 0.35 * k, baseY - h);
      ctx.lineTo(cx + half, baseY);
      ctx.closePath();
      ctx.fill();
      A().glow(ctx, cx, baseY - h, 0.6 * k, calm ? '#ffb38a' : '#ff6a3a', calm ? 0.25 : 0.55 + Math.sin(t * 1.3 + x) * 0.08);
      // smoke plume
      for (let i = 0; i < 4; i++) {
        const py = baseY - h - (0.5 + i * 0.55) * k - ((t * 0.25 * k) % (0.55 * k)),
          r = (0.25 + i * 0.12) * k;
        ctx.fillStyle = calm ? 'rgba(255,230,210,0.10)' : 'rgba(80,50,70,' + (0.35 - i * 0.07).toFixed(2) + ')';
        ctx.beginPath();
        ctx.arc(cx + Math.sin(t * 0.4 + i) * 0.2 * k + i * 0.15 * k, py, r, 0, TAU);
        ctx.fill();
      }
    }
    ctx.fillStyle = 'rgba(70,32,70,0.85)';
    ctx.fillRect(0, baseY, width, 2 * k);
  }
  // A magma channel crossing the colony with a cyan-railed walkway bridge over it.
  function lavaChannel(ctx, x0, x1, y, k, t, calm) {
    const { fillRR, line, glow } = A();
    const w = x1 - x0;
    const g = ctx.createLinearGradient(x0, y, x1, y);
    g.addColorStop(0, '#ff6a2a');
    g.addColorStop(0.5, '#ffb03a');
    g.addColorStop(1, '#ff6a2a');
    fillRR(ctx, x0, y - 0.05 * k, w, 0.32 * k, 0.12 * k, P.basalt2);
    fillRR(ctx, x0 + 0.12 * k, y, w - 0.24 * k, 0.2 * k, 0.1 * k, g);
    for (let i = 0; i < 5; i++) {
      const px = x0 + 0.3 * k + ((i / 5 + t * 0.06) % 1) * (w - 0.6 * k);
      glow(ctx, px, y + 0.1 * k, 0.12 * k, '#fff0a0', 0.6);
    }
    glow(ctx, (x0 + x1) / 2, y, w * 0.4, '#ff8a3a', calm ? 0.12 : 0.22);
    // walkway
    fillRR(ctx, x0 - 0.3 * k, y - 0.42 * k, w + 0.6 * k, 0.14 * k, 0.05 * k, '#5a5470');
    line(ctx, x0 - 0.2 * k, y - 0.8 * k, x1 + 0.2 * k, y - 0.8 * k, 0.05 * k, P.cyan);
    for (let x = x0; x <= x1 + 0.01; x += w / 4) line(ctx, x, y - 0.42 * k, x, y - 0.8 * k, 0.04 * k, P.cyan);
  }
  // Heat vent in the ground: before the repair it hisses red with a warning lamp, afterwards it breathes cool cyan.
  function vent(ctx, x, y, k, t, calm, i = 0) {
    const { fillRR, glow, steam } = A();
    fillRR(ctx, x - 0.35 * k, y - 0.28 * k, 0.7 * k, 0.28 * k, 0.08 * k, '#4a4058');
    fillRR(ctx, x - 0.25 * k, y - 0.34 * k, 0.5 * k, 0.1 * k, 0.04 * k, calm ? P.cyan : '#ff6a3a');
    if (calm) steam(ctx, x, y - 0.4 * k, k * 0.5, t + i);
    else {
      steam(ctx, x, y - 0.4 * k, k * 0.7, t * 1.6 + i);
      glow(ctx, x + 0.42 * k, y - 0.5 * k, 0.1 * k, Math.sin(t * 5 + i) > 0 ? '#ff5a5a' : '#7a3a3a', 0.95);
    }
  }
  // Cooling tower (storage/cooling district landmark). Overheated: red warning band, no steam. Calm: cyan steam.
  function coolingTower(ctx, x, y, k, t, calm) {
    const { glow, steam } = A();
    const h = 3.4 * k;
    const g = ctx.createLinearGradient(x - 1.2 * k, 0, x + 1.2 * k, 0);
    g.addColorStop(0, '#6a6488');
    g.addColorStop(0.5, '#a8a2c8');
    g.addColorStop(1, '#5a5478');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - 1.2 * k, y);
    ctx.quadraticCurveTo(x - 0.55 * k, y - h * 0.55, x - 0.75 * k, y - h);
    ctx.lineTo(x + 0.75 * k, y - h);
    ctx.quadraticCurveTo(x + 0.55 * k, y - h * 0.55, x + 1.2 * k, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = calm ? P.cyan : '#ff6a5a';
    ctx.fillRect(x - 0.62 * k, y - h * 0.72, 1.24 * k, 0.16 * k);
    if (calm) for (let i = 0; i < 3; i++) steam(ctx, x - 0.3 * k + i * 0.3 * k, y - h - 0.1 * k, k * 0.9, t + i * 0.7);
    else glow(ctx, x, y - h * 0.72, 0.5 * k, '#ff5a3a', 0.3 + Math.sin(t * 4) * 0.15);
    return { x0: x - 1.2 * k, y0: y - h, x1: x + 1.2 * k, y1: y };
  }
  // Basalt columns and glowing cracks (ground decor); cooled cracks after the repair.
  function prop(ctx, x, y, s, t, i, calm) {
    const { poly, glow } = A();
    const n = i % 4;
    if (n === 0 || n === 2) {
      for (let c = 0; c < 3; c++) {
        const h = (0.5 + ((i + c) % 3) * 0.25) * s,
          cx = x + (c - 1) * 0.24 * s;
        poly(ctx, [[cx - 0.12 * s, y], [cx - 0.12 * s, y - h], [cx, y - h - 0.07 * s], [cx + 0.12 * s, y - h], [cx + 0.12 * s, y]], c % 2 ? P.basalt : '#4a3c58');
      }
    } else if (n === 1) {
      ctx.strokeStyle = calm ? 'rgba(127,232,240,0.6)' : 'rgba(255,140,60,0.85)';
      ctx.lineWidth = 0.05 * s;
      ctx.beginPath();
      ctx.moveTo(x - 0.4 * s, y - 0.02 * s);
      ctx.lineTo(x - 0.1 * s, y - 0.06 * s);
      ctx.lineTo(x + 0.15 * s, y);
      ctx.lineTo(x + 0.45 * s, y - 0.05 * s);
      ctx.stroke();
      if (!calm) glow(ctx, x, y - 0.03 * s, 0.25 * s, '#ff8a3a', 0.3);
    } else {
      poly(ctx, [[x - 0.4 * s, y], [x - 0.15 * s, y - 0.32 * s], [x + 0.25 * s, y - 0.25 * s], [x + 0.45 * s, y]], '#5a4668');
    }
  }
  // Glutschmelze (Ember Foundry): a brick kiln with a glowing mouth (molten when really smelting), a tapered chimney,
  // the pour arm into a cyan cooling bath, finished alloy bars on a pallet and the Glutstein intake funnel.
  // o: level, active, fill (Glutstein intake), bars (alloy store ratio), cooled (Thermalzellen), calm, overheated.
  function foundry(ctx, x, y, k, o) {
    const { fillRR, line, glow, steam, plaque, gear, crystal } = A();
    const t = o.time,
      level = o.level,
      on = o.active;
    A().shadow(ctx, x, y, 4.0 * k, k);
    const kiln = (cx, w, h, shade) => {
      const g = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
      g.addColorStop(0, shade ? '#3a2e48' : '#4a3a5a');
      g.addColorStop(0.5, shade ? '#5a4a6a' : '#6e5a7e');
      g.addColorStop(1, shade ? '#2e2440' : '#3e3050');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(cx - w / 2, y);
      ctx.lineTo(cx - w / 2, y - h * 0.55);
      ctx.quadraticCurveTo(cx - w / 2, y - h, cx, y - h);
      ctx.quadraticCurveTo(cx + w / 2, y - h, cx + w / 2, y - h * 0.55);
      ctx.lineTo(cx + w / 2, y);
      ctx.closePath();
      ctx.fill();
      // staggered bricks
      ctx.strokeStyle = 'rgba(20,12,30,0.35)';
      ctx.lineWidth = 0.025 * k;
      for (let r = 1; r < 5; r++) {
        const yy = y - (h * 0.55 * r) / 5;
        line(ctx, cx - w / 2 + 0.03 * k, yy, cx + w / 2 - 0.03 * k, yy, 0.025 * k, 'rgba(20,12,30,0.35)');
        for (let j = 0; j < 4; j++) {
          const bx = cx - w / 2 + ((j + (r % 2) * 0.5) * w) / 4;
          if (bx > cx - w / 2 + 0.05 * k && bx < cx + w / 2 - 0.05 * k) line(ctx, bx, yy, bx, yy + (h * 0.55) / 5, 0.022 * k, 'rgba(20,12,30,0.3)');
        }
      }
    };
    // chimney (with copper rings) behind the kiln; second kiln from Lv 10
    const chx = x - 1.15 * k;
    ctx.fillStyle = '#4a4058';
    ctx.beginPath();
    ctx.moveTo(chx - 0.22 * k, y - 1.5 * k);
    ctx.lineTo(chx - 0.16 * k, y - 3.0 * k);
    ctx.lineTo(chx + 0.16 * k, y - 3.0 * k);
    ctx.lineTo(chx + 0.22 * k, y - 1.5 * k);
    ctx.closePath();
    ctx.fill();
    for (const ry of [2.0, 2.6]) fillRR(ctx, chx - 0.22 * k, y - ry * k, 0.44 * k, 0.09 * k, 0.04 * k, '#c87a4a');
    fillRR(ctx, chx - 0.26 * k, y - 3.08 * k, 0.52 * k, 0.12 * k, 0.05 * k, '#2a2234');
    if (on) steam(ctx, chx, y - 3.15 * k, k * 0.75, t);
    if (level >= 10) kiln(x + 0.55 * k, 1.1 * k, 1.25 * k, true);
    kiln(x - 0.55 * k, 1.9 * k, 1.75 * k, false);
    fillRR(ctx, x - 1.5 * k, y - 0.98 * k, 1.9 * k, 0.12 * k, 0.04 * k, '#c87a4a');
    // glowing arched mouth (the heating chamber)
    const mx = x - 0.55 * k,
      mw = 0.8 * k,
      mh = 0.72 * k;
    ctx.fillStyle = '#1e1828';
    ctx.beginPath();
    ctx.moveTo(mx - mw / 2, y);
    ctx.lineTo(mx - mw / 2, y - mh * 0.6);
    ctx.quadraticCurveTo(mx, y - mh * 1.25, mx + mw / 2, y - mh * 0.6);
    ctx.lineTo(mx + mw / 2, y);
    ctx.closePath();
    ctx.fill();
    const molten = ctx.createRadialGradient(mx, y - mh * 0.35, 0.02 * k, mx, y - mh * 0.35, mw * 0.7);
    molten.addColorStop(0, on ? '#fff3b0' : '#6a3a30');
    molten.addColorStop(1, on ? '#ff6a2a' : '#2e2028');
    ctx.fillStyle = molten;
    ctx.beginPath();
    ctx.moveTo(mx - mw * 0.4, y);
    ctx.lineTo(mx - mw * 0.4, y - mh * 0.55);
    ctx.quadraticCurveTo(mx, y - mh * 1.08, mx + mw * 0.4, y - mh * 0.55);
    ctx.lineTo(mx + mw * 0.4, y);
    ctx.closePath();
    ctx.fill();
    if (on) glow(ctx, mx, y - mh * 0.4, 0.9 * k, '#ff9a3a', 0.35 + Math.sin(t * 6) * 0.08);
    // pour arm + molten stream into the cooling bath
    line(ctx, x + 0.3 * k, y - 1.15 * k, x + 1.25 * k, y - 1.0 * k, 0.12 * k, '#7a6a8a');
    fillRR(ctx, x + 1.12 * k, y - 1.1 * k, 0.26 * k, 0.2 * k, 0.05 * k, '#7a6a8a');
    if (on) {
      const pour = ctx.createLinearGradient(0, y - 0.92 * k, 0, y - 0.5 * k);
      pour.addColorStop(0, '#fff0a0');
      pour.addColorStop(1, '#ff7a2a');
      ctx.fillStyle = pour;
      ctx.fillRect(x + 1.22 * k, y - 0.92 * k, 0.06 * k, 0.45 * k);
    }
    // cooling bath (cyan); steam when Thermalzellen cool it
    fillRR(ctx, x + 0.8 * k, y - 0.52 * k, 0.95 * k, 0.52 * k, 0.2 * k, '#3a5a7a');
    fillRR(ctx, x + 0.86 * k, y - 0.46 * k, 0.83 * k, 0.16 * k, 0.08 * k, o.cooled ? '#bff8ff' : '#7fe8f0');
    if (on) steam(ctx, x + 1.25 * k, y - 0.6 * k, k * (o.cooled ? 0.7 : 0.45), t * 1.3);
    if (level >= 25) gear(ctx, x + 1.27 * k, y - 0.15 * k, 0.13 * k, on ? t * 4 : 0, '#9aa6c8');
    // finished Glutlegierung bars on a pallet (real alloy stock)
    fillRR(ctx, x + 1.85 * k, y - 0.08 * k, 0.75 * k, 0.08 * k, 0.02 * k, '#9a6e48');
    const n = Math.round(Math.max(0, Math.min(1, o.bars || 0)) * 6);
    for (let i = 0; i < n; i++) {
      const row = i < 3 ? 0 : 1,
        bx = x + 1.92 * k + (i % 3) * 0.22 * k + row * 0.11 * k,
        by = y - 0.2 * k - row * 0.12 * k;
      fillRR(ctx, bx, by, 0.2 * k, 0.11 * k, 0.03 * k, '#ffb84a');
      fillRR(ctx, bx + 0.02 * k, by, 0.16 * k, 0.035 * k, 0.015 * k, '#ffe8a8');
    }
    // Glutstein intake funnel (real stock)
    ctx.fillStyle = '#4a4058';
    ctx.beginPath();
    ctx.moveTo(x - 2.15 * k, y - 1.2 * k);
    ctx.lineTo(x - 1.55 * k, y - 1.2 * k);
    ctx.lineTo(x - 1.72 * k, y - 0.55 * k);
    ctx.lineTo(x - 1.98 * k, y - 0.55 * k);
    ctx.closePath();
    ctx.fill();
    fillRR(ctx, x - 1.95 * k, y - 0.55 * k, 0.2 * k, 0.55 * k, 0.04 * k, '#3a3048');
    const f = Math.max(0, Math.min(1, o.fill || 0));
    for (let i = 0; i < Math.round(f * 4); i++) crystal(ctx, x - 2.05 * k + i * 0.14 * k, y - 1.2 * k, 0.1 * k, i % 2 ? '#ff9a3a' : '#ffd25a', 0.2);
    if (o.overheated && !o.calm) {
      glow(ctx, x - 0.55 * k, y - 1.9 * k, 0.12 * k, Math.sin(t * 5) > 0 ? '#ff5a5a' : '#7a3a3a', 0.95);
      plaque(ctx, x - 0.55 * k, y - 2.25 * k, k * 0.7, 'ÜBERHITZT', '#ff8f8f');
    }
    plaque(ctx, x, y + 0.18 * k, k, 'Glutschmelze Lv ' + level, '#ff9a3a');
    return { x0: x - 2.2 * k, y0: y - 3.1 * k, x1: x + 2.65 * k, y1: y + 0.6 * k };
  }
  // Basaltlager: a vaulted stone store with a heat-shield door (cyan when the colony is safe); crates by real fill.
  function depot(ctx, x, y, k, o) {
    const { fillRR, glow, crate, plaque } = A();
    const t = o.time,
      level = o.level,
      fill = Math.max(0, Math.min(1, o.fill || 0));
    A().shadow(ctx, x, y, 3.8 * k, k);
    ctx.fillStyle = P.basalt;
    ctx.beginPath();
    ctx.moveTo(x - 1.6 * k, y);
    ctx.lineTo(x - 1.6 * k, y - 1.3 * k);
    ctx.quadraticCurveTo(x, y - 2.3 * k, x + 1.6 * k, y - 1.3 * k);
    ctx.lineTo(x + 1.6 * k, y);
    ctx.closePath();
    ctx.fill();
    for (let c = -1; c <= 1; c++) fillRR(ctx, x + c * 1.05 * k - 0.12 * k, y - 1.45 * k, 0.24 * k, 1.45 * k, 0.04 * k, '#4a3c58');
    for (let r = 1; r <= 3; r++) A().line(ctx, x - 1.55 * k, y - r * 0.36 * k, x + 1.55 * k, y - r * 0.36 * k, 0.025 * k, 'rgba(15,10,25,0.35)');
    ctx.strokeStyle = '#c87a4a';
    ctx.lineWidth = 0.08 * k;
    ctx.beginPath();
    ctx.moveTo(x - 1.6 * k, y - 1.3 * k);
    ctx.quadraticCurveTo(x, y - 2.3 * k, x + 1.6 * k, y - 1.3 * k);
    ctx.stroke();
    fillRR(ctx, x - 0.55 * k, y - 1.05 * k, 1.1 * k, 1.05 * k, 0.12 * k, '#2a2234');
    fillRR(ctx, x - 0.48 * k, y - 0.98 * k, 0.96 * k, 0.12 * k, 0.04 * k, o.calm ? P.cyan : P.ember);
    A().hazard(ctx, x - 0.5 * k, y - 0.2 * k, 1.0 * k, 0.1 * k);
    for (let j = 1; j < 4; j++) A().line(ctx, x - 0.55 * k + j * 0.275 * k, y - 0.8 * k, x - 0.55 * k + j * 0.275 * k, y - 0.22 * k, 0.03 * k, '#4a3c58');
    glow(ctx, x, y - 0.95 * k, 0.5 * k, o.calm ? P.cyan : P.ember, 0.25);
    const n = Math.round(fill * 8);
    for (let i = 0; i < n; i++) crate(ctx, x - 2.2 * k + (i % 4) * 0.34 * k + Math.floor(i / 4) * 0.17 * k, y - Math.floor(i / 4) * 0.3 * k, 0.3 * k, '#ffb38a', '#c46a4a');
    if (level >= 10) fillRR(ctx, x + 1.7 * k, y - 1.0 * k, 0.9 * k, 1.0 * k, 0.12 * k, '#4a3c58');
    fillRR(ctx, x - 0.9 * k, y - 1.75 * k, 1.8 * k, 0.12 * k, 0.06 * k, 'rgba(0,0,0,0.3)');
    fillRR(ctx, x - 0.9 * k, y - 1.75 * k, 1.8 * k * fill, 0.12 * k, 0.06 * k, fill >= 0.92 ? '#ff8f8f' : P.cyan);
    plaque(ctx, x, y + 0.18 * k, k, 'Basaltlager Lv ' + level, P.coral);
    return { x0: x - 2.3 * k, y0: y - 2.2 * k, x1: x + (level >= 10 ? 2.7 : 1.7) * k, y1: y + 0.6 * k };
  }
  // Glutmarkt: a stall under a heat-proof copper canopy with glowing ember lamps and a cyan cool-box.
  function stall(ctx, x, y, k, o) {
    const { fillRR, glow, crystal, plaque, line } = A();
    const t = o.time,
      level = o.level,
      fill = Math.max(0, Math.min(1, o.fill || 0));
    A().shadow(ctx, x, y, 3.2 * k, k);
    fillRR(ctx, x - 1.2 * k, y - 0.95 * k, 2.4 * k, 0.95 * k, 0.12 * k, '#5a4668');
    fillRR(ctx, x - 1.05 * k, y - 0.85 * k, 1.5 * k, 0.4 * k, 0.08 * k, '#ffe2c4');
    for (let i = 0; i < 1 + Math.round(fill * 4); i++) crystal(ctx, x - 0.85 * k + i * 0.3 * k, y - 0.5 * k, 0.12 * k, i % 2 ? '#ffb03a' : '#ff8a72', 0);
    fillRR(ctx, x + 0.55 * k, y - 0.85 * k, 0.5 * k, 0.6 * k, 0.08 * k, '#3a5a7a');
    fillRR(ctx, x + 0.6 * k, y - 0.8 * k, 0.4 * k, 0.12 * k, 0.04 * k, P.cyan);
    // copper canopy
    ctx.fillStyle = '#c87a4a';
    ctx.beginPath();
    ctx.moveTo(x - 1.6 * k, y - 1.05 * k);
    ctx.lineTo(x - 1.2 * k, y - 1.7 * k);
    ctx.lineTo(x + 1.2 * k, y - 1.7 * k);
    ctx.lineTo(x + 1.6 * k, y - 1.05 * k);
    ctx.closePath();
    ctx.fill();
    line(ctx, x - 1.6 * k, y - 1.05 * k, x + 1.6 * k, y - 1.05 * k, 0.06 * k, '#ffd25a');
    for (let i = 0; i < (level >= 10 ? 3 : 2); i++) {
      const lx = x - 1.0 * k + (i * 2.0 * k) / (level >= 10 ? 2 : 1);
      glow(ctx, lx, y - 0.95 * k, 0.15 * k, '#ffb03a', 0.8 + Math.sin(t * 2 + i) * 0.1);
    }
    if (o.saleGlow > 0) glow(ctx, x, y - 0.9 * k, 1 * k, '#ffd25a', o.saleGlow * 0.6);
    plaque(ctx, x, y + 0.18 * k, k, 'Glutmarkt Lv ' + level, P.coral);
    return { x0: x - 1.7 * k, y0: y - 1.8 * k, x1: x + 1.7 * k, y1: y + 0.6 * k, counter: { x0: x - 1.1 * k, y0: y - 0.9 * k, x1: x + 1.1 * k, y1: y } };
  }

  // ----- Emberbell: a bell-shaped heat-control robot of M.O.T.T.E. (not round like Frostbyte, no visor) -----
  // o: friendly, pressure 0..1 (gauge needle), phase 'build'|'warn'|'blast'|'cool', hit
  function drawEmberbell(ctx, x, y, size, time, o = {}) {
    const friendly = o.friendly,
      phase = o.phase || 'build',
      warn = phase === 'warn',
      blast = phase === 'blast',
      cool = phase === 'cool',
      bob = Math.sin(time * 2.2) * size * 0.06,
      core = friendly ? '#ffd25a' : blast ? '#fff3b0' : warn ? '#ff5a3a' : cool ? '#9ff4ff' : '#ff8a3a';
    const glowC = (cx, cy, r, c, a) => {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, c);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = a;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    };
    ctx.save();
    ctx.translate(x, y + bob);
    glowC(0, 0, size * 1.7, friendly ? '#ffd7a8' : blast ? '#fff0a0' : '#ff7a3a', friendly ? 0.22 : warn ? 0.45 + Math.sin(time * 16) * 0.2 : blast ? 0.65 : 0.3);
    // hover thruster ring
    ctx.fillStyle = friendly ? P.cyan : '#ff9a3a';
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.ellipse(0, size * 1.02, size * 0.55, size * 0.12, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    // side vent fins (open = cooling phase)
    [-1, 1].forEach(side => {
      ctx.save();
      ctx.translate(side * size * 0.92, size * 0.35);
      ctx.rotate(side * (cool ? 0.75 : 0.35));
      ctx.fillStyle = '#7a6a8a';
      ctx.fillRect(-size * 0.1, -size * 0.32, size * 0.2, size * 0.64);
      ctx.fillStyle = cool || friendly ? P.cyan : '#ff8a3a';
      ctx.fillRect(-size * 0.05, -size * 0.25, size * 0.1, size * 0.5);
      ctx.restore();
    });
    // bell body: dome top, flared skirt
    const body = ctx.createLinearGradient(-size, 0, size, 0);
    body.addColorStop(0, o.hit ? '#ffffff' : '#9a6a4a');
    body.addColorStop(0.5, o.hit ? '#ffffff' : friendly ? '#f0c08a' : '#d08a5a');
    body.addColorStop(1, o.hit ? '#ffffff' : '#8a5a3e');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-size * 0.95, size * 0.85);
    ctx.quadraticCurveTo(-size * 0.75, size * 0.55, -size * 0.62, -size * 0.2);
    ctx.quadraticCurveTo(-size * 0.55, -size * 0.95, 0, -size * 1.0);
    ctx.quadraticCurveTo(size * 0.55, -size * 0.95, size * 0.62, -size * 0.2);
    ctx.quadraticCurveTo(size * 0.75, size * 0.55, size * 0.95, size * 0.85);
    ctx.closePath();
    ctx.fill();
    // rim band with rivets
    ctx.fillStyle = '#5a4058';
    ctx.fillRect(-size * 0.98, size * 0.78, size * 1.96, size * 0.14);
    for (let i = -3; i <= 3; i++) {
      ctx.fillStyle = '#ffd25a';
      ctx.beginPath();
      ctx.arc(i * size * 0.27, size * 0.85, size * 0.035, 0, TAU);
      ctx.fill();
    }
    // handle-like antenna loop on top
    ctx.strokeStyle = '#7a6a8a';
    ctx.lineWidth = size * 0.09;
    ctx.beginPath();
    ctx.arc(0, -size * 1.08, size * 0.18, Math.PI, 0);
    ctx.stroke();
    glowC(0, -size * 1.26, size * 0.18, friendly ? P.cyan : warn ? '#ff3a3a' : '#ffd25a', 0.9);
    // expressive eyes (LED style)
    const ey = -size * 0.42;
    [-1, 1].forEach(side => {
      ctx.fillStyle = '#2a1e2e';
      ctx.beginPath();
      ctx.ellipse(side * size * 0.27, ey, size * 0.17, size * 0.15, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = friendly ? '#9ff4ff' : warn || blast ? '#ff6a4a' : '#ffd25a';
      ctx.lineWidth = size * 0.06;
      ctx.lineCap = 'round';
      ctx.beginPath();
      if (friendly) ctx.arc(side * size * 0.27, ey + size * 0.04, size * 0.08, Math.PI * 1.15, Math.PI * 1.85);
      else if (warn || blast) {
        ctx.moveTo(side * size * 0.37, ey - size * 0.06);
        ctx.lineTo(side * size * 0.17, ey + size * 0.03);
      } else {
        ctx.moveTo(side * size * 0.2, ey);
        ctx.lineTo(side * size * 0.34, ey);
      }
      ctx.stroke();
    });
    // energy core
    glowC(0, size * 0.1, size * 0.5, core, 0.8);
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(0, size * 0.1, size * 0.2, 0, TAU);
    ctx.fill();
    // pressure gauge with the real needle
    ctx.fillStyle = '#f6efe6';
    ctx.beginPath();
    ctx.arc(0, size * 0.55, size * 0.17, 0, TAU);
    ctx.fill();
    const p = Math.max(0, Math.min(1, o.pressure ?? (friendly ? 0.35 : 0.5)));
    ctx.strokeStyle = p > 0.8 ? '#ff3a3a' : '#3a2a3a';
    ctx.lineWidth = size * 0.04;
    ctx.beginPath();
    ctx.moveTo(0, size * 0.55);
    ctx.lineTo(Math.cos(Math.PI * (1.15 + p * 0.7)) * size * 0.14, size * 0.55 + Math.sin(Math.PI * (1.15 + p * 0.7)) * size * 0.14);
    ctx.stroke();
    // M.O.T.T.E. paw-circuit mark on the shoulder
    ctx.strokeStyle = friendly ? '#5ab8a8' : '#7a3a3a';
    ctx.lineWidth = size * 0.035;
    ctx.beginPath();
    ctx.arc(-size * 0.45, size * 0.05, size * 0.08, 0, TAU);
    ctx.moveTo(-size * 0.45, size * 0.13);
    ctx.lineTo(-size * 0.45, size * 0.25);
    ctx.stroke();
    if (blast) for (let i = 0; i < 6; i++) glowC(Math.cos((i / 6) * TAU) * size * 1.3, Math.sin((i / 6) * TAU) * size * 1.0, size * 0.35, '#fff0a0', 0.6);
    ctx.restore();
  }
  const portraits = new Map();
  function emberbellPortraitURL(friendly, size = 96) {
    const key = (friendly ? 'f' : 'e') + size;
    if (portraits.has(key)) return portraits.get(key);
    let url = '';
    try {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (ctx && c.toDataURL) {
        const bg = ctx.createRadialGradient(size / 2, size * 0.4, 4, size / 2, size / 2, size * 0.7);
        bg.addColorStop(0, friendly ? '#6a5a4a' : '#7a3a3a');
        bg.addColorStop(1, '#2a1838');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, size, size);
        drawEmberbell(ctx, size / 2, size * 0.58, size * 0.3, 0.4, { friendly, pressure: friendly ? 0.3 : 0.7 });
        url = c.toDataURL('image/png');
      }
    } catch {
      url = '';
    }
    portraits.set(key, url);
    return url;
  }

  window.PyraArt = { PALETTE: P, volcanoSkyline, lavaChannel, vent, coolingTower, prop, foundry, depot, stall, drawEmberbell, emberbellPortraitURL };
})();
