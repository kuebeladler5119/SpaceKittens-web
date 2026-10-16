// Mekhanos art (cloud slice): the clockwork colony's own structures, drawn with the shared ColonyArt primitives.
// Every function takes the real state it shows (levels, fill ratios, activity); nothing here decides game logic.
// Palette: warm brass and copper, cool teal lights, industrial blue-gray. Cute, rounded, never grim.
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const A = () => window.ColonyArt;
  const P = {
    steel: '#5a6488',
    steel2: '#46506f',
    steelLight: '#8a94b8',
    brass: '#d9a54a',
    brassLight: '#f3cf7a',
    copper: '#c8784a',
    teal: '#5fe0d0',
    tealDark: '#2f8f8a',
    ink: '#262b48'
  };

  // Distant factory skyline (sky layer): sawtooth halls, chimneys, a giant idle cog and teal beacon lights.
  function factorySkyline(ctx, width, baseY, k, seed, t) {
    let s = seed;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let x = -k; x < width; x += (4 + rnd() * 4) * k) {
      const kind = Math.floor(rnd() * 3),
        w = (2 + rnd() * 1.6) * k,
        h = (1 + rnd() * 1.1) * k;
      ctx.fillStyle = 'rgba(52,60,98,0.88)';
      if (kind === 0) {
        // sawtooth hall
        ctx.beginPath();
        ctx.moveTo(x, baseY);
        ctx.lineTo(x, baseY - h);
        const teeth = 3;
        for (let i = 0; i < teeth; i++) {
          ctx.lineTo(x + ((i + 0.75) * w) / teeth, baseY - h - 0.45 * k);
          ctx.lineTo(x + ((i + 1) * w) / teeth, baseY - h);
        }
        ctx.lineTo(x + w, baseY);
        ctx.closePath();
        ctx.fill();
      } else if (kind === 1) {
        // chimney pair
        ctx.fillRect(x, baseY - h * 0.6, w * 0.6, h * 0.6);
        ctx.fillRect(x + 0.2 * k, baseY - h * 1.9, 0.32 * k, h * 1.9);
        ctx.fillRect(x + 0.8 * k, baseY - h * 1.5, 0.28 * k, h * 1.5);
        A().glow(ctx, x + 0.36 * k, baseY - h * 1.9, 0.3 * k, P.teal, 0.35 + Math.sin(t * 1.5 + x) * 0.1);
      } else {
        // a giant, slowly turning cog half-sunk into the plain
        A().gear(ctx, x + w / 2, baseY - 0.2 * k, Math.min(h * 0.55, 0.9 * k), t * 0.05 + x, 'rgba(70,80,124,0.85)');
      }
    }
  }
  // Gear tower landmark: a lattice mast with two meshing cogs that turn while the colony is producing.
  function gearTower(ctx, x, y, k, t, active) {
    const { line, gear, glow, fillRR } = A();
    const h = 3.1 * k,
      spin = active ? t * 1.6 : 0;
    line(ctx, x - 0.55 * k, y, x - 0.2 * k, y - h, 0.1 * k, P.steel2);
    line(ctx, x + 0.55 * k, y, x + 0.2 * k, y - h, 0.1 * k, P.steel2);
    for (let yy = y - 0.5 * k; yy > y - h + 0.3 * k; yy -= 0.55 * k) {
      const f = (y - yy) / h,
        half = 0.55 * k - 0.35 * k * f;
      line(ctx, x - half, yy, x + half, yy - 0.5 * k, 0.04 * k, P.steelLight);
    }
    gear(ctx, x - 0.25 * k, y - h + 0.15 * k, 0.42 * k, spin, P.brass);
    gear(ctx, x + 0.38 * k, y - h + 0.55 * k, 0.26 * k, -spin * 1.6 + 0.2, P.copper);
    fillRR(ctx, x - 0.08 * k, y - h - 0.35 * k, 0.16 * k, 0.2 * k, 0.05 * k, P.ink);
    glow(ctx, x, y - h - 0.38 * k, 0.22 * k, active ? P.teal : '#7a7fa8', active ? 0.8 + Math.sin(t * 3) * 0.15 : 0.4);
    return { x0: x - 0.7 * k, y0: y - h - 0.5 * k, x1: x + 0.7 * k, y1: y };
  }
  // Pipe bridge: brass pipes on stilts with a teal energy conduit; pulses travel along it while energy flows.
  function pipeBridge(ctx, x0, x1, y, k, t, active) {
    const { line, glow, fillRR } = A();
    const top = y - 1.6 * k;
    for (let x = x0; x <= x1 + 1; x += Math.max(1.2 * k, (x1 - x0) / 3)) line(ctx, x, y, x, top, 0.08 * k, P.steel2);
    line(ctx, x0 - 0.2 * k, top, x1 + 0.2 * k, top, 0.16 * k, P.copper);
    line(ctx, x0 - 0.2 * k, top + 0.2 * k, x1 + 0.2 * k, top + 0.2 * k, 0.1 * k, P.brass);
    line(ctx, x0 - 0.2 * k, top + 0.36 * k, x1 + 0.2 * k, top + 0.36 * k, 0.06 * k, active ? P.teal : P.tealDark);
    for (let x = x0; x <= x1; x += 0.9 * k) fillRR(ctx, x - 0.06 * k, top - 0.1 * k, 0.12 * k, 0.2 * k, 0.03 * k, P.brassLight);
    if (active)
      for (let i = 0; i < 3; i++) {
        const px = x0 + (((t * 0.6 + i / 3) % 1) * (x1 - x0));
        glow(ctx, px, top + 0.36 * k, 0.16 * k, P.teal, 0.85);
      }
  }
  // Ground decor: cog piles, bolts, pipe stubs and old valve wheels.
  function prop(ctx, x, y, s0, t, i) {
    const { gear, fillRR, line, glow } = A();
    const n = i % 4,
      s = s0 * 0.5;
    if (n === 0) {
      gear(ctx, x - 0.15 * s, y - 0.2 * s, 0.22 * s, 0.3 + i, P.copper);
      gear(ctx, x + 0.18 * s, y - 0.14 * s, 0.14 * s, i, P.brass);
    } else if (n === 1) {
      fillRR(ctx, x - 0.3 * s, y - 0.32 * s, 0.18 * s, 0.32 * s, 0.05 * s, P.steel);
      fillRR(ctx, x - 0.36 * s, y - 0.38 * s, 0.3 * s, 0.08 * s, 0.03 * s, P.brass);
      line(ctx, x - 0.12 * s, y - 0.2 * s, x + 0.35 * s, y - 0.2 * s, 0.1 * s, P.steel2);
    } else if (n === 2) {
      ctx.strokeStyle = P.copper;
      ctx.lineWidth = 0.07 * s;
      ctx.beginPath();
      ctx.arc(x, y - 0.3 * s, 0.22 * s, 0, TAU);
      ctx.stroke();
      line(ctx, x - 0.22 * s, y - 0.3 * s, x + 0.22 * s, y - 0.3 * s, 0.05 * s, P.copper);
      line(ctx, x, y - 0.52 * s, x, y, 0.06 * s, P.steel2);
    } else {
      for (let b = 0; b < 3; b++) fillRR(ctx, x - 0.3 * s + b * 0.22 * s, y - 0.12 * s, 0.16 * s, 0.12 * s, 0.03 * s, b % 2 ? P.steelLight : P.brass);
      glow(ctx, x, y - 0.1 * s, 0.18 * s, P.teal, 0.25 + Math.sin(t * 2 + i) * 0.1);
    }
  }
  // Small maintenance robot (cute: round body, one teal eye, a wrench arm). Rolls back and forth when `active`.
  function maintenanceBot(ctx, x, y, k, t, active, seed = 0) {
    const { fillRR, glow, line } = A();
    const dx = active ? Math.sin(t * 0.7 + seed) * 0.6 * k : 0,
      bx = x + dx,
      bob = active ? Math.sin(t * 6 + seed) * 0.02 * k : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(bx, y, 0.3 * k, 0.07 * k, 0, 0, TAU);
    ctx.fill();
    fillRR(ctx, bx - 0.24 * k, y - 0.14 * k, 0.48 * k, 0.12 * k, 0.06 * k, P.ink);
    fillRR(ctx, bx - 0.22 * k, y - 0.55 * k + bob, 0.44 * k, 0.42 * k, 0.18 * k, P.steelLight);
    fillRR(ctx, bx - 0.14 * k, y - 0.47 * k + bob, 0.28 * k, 0.16 * k, 0.08 * k, P.ink);
    glow(ctx, bx + (active ? 0.04 : 0) * k, y - 0.39 * k + bob, 0.07 * k, active ? P.teal : '#7a7fa8', 0.95);
    line(ctx, bx, y - 0.55 * k + bob, bx, y - 0.68 * k + bob, 0.03 * k, P.steel2);
    glow(ctx, bx, y - 0.7 * k + bob, 0.04 * k, P.brassLight, 0.9);
    const arm = active ? Math.sin(t * 5 + seed) * 0.4 : 0.3;
    line(ctx, bx + 0.2 * k, y - 0.32 * k + bob, bx + 0.2 * k + Math.cos(arm) * 0.25 * k, y - 0.32 * k + bob - Math.sin(arm) * 0.25 * k, 0.05 * k, P.brass);
  }

  // Präzisionswerkstatt: a blue-gray factory hall with a rounded sawtooth roof and brass trim, a big front cog, a press
  // arm stamping parts on a short conveyor (only while it really assembles), an ore hopper on the left (real
  // Präzisionserz stock) and finished parts on an output tray (real parts stock).
  // Stages: Lv 1 hall + press · Lv 10 robot arm + second cog · Lv 25 rooftop clock and twin chimneys.
  // o: level, active, fill (Präzisionserz intake), parts (parts store ratio), time.
  function workshop(ctx, x, y, k, o) {
    const { fillRR, line, glow, steam, plaque, gear, box } = A();
    const t = o.time,
      level = o.level,
      on = o.active,
      spin = on ? t * 2.2 : 0;
    A().shadow(ctx, x, y, 4.2 * k, k);
    // chimney(s) behind the hall
    const chimney = (cx, h) => {
      fillRR(ctx, cx - 0.18 * k, y - h, 0.36 * k, h, 0.06 * k, P.steel2);
      for (const ry of [0.35, 0.7]) fillRR(ctx, cx - 0.21 * k, y - h * ry - 0.4 * k, 0.42 * k, 0.08 * k, 0.03 * k, P.copper);
      if (on) steam(ctx, cx, y - h - 0.05 * k, k * 0.6, t + cx);
    };
    chimney(x + 1.1 * k, 3.0 * k);
    if (level >= 25) chimney(x + 1.55 * k, 2.6 * k);
    // main hall
    const hx = x - 1.45 * k,
      hw = 2.9 * k,
      hh = 1.55 * k;
    const g = ctx.createLinearGradient(hx, 0, hx + hw, 0);
    g.addColorStop(0, P.steel2);
    g.addColorStop(0.5, P.steel);
    g.addColorStop(1, P.steel2);
    fillRR(ctx, hx, y - hh, hw, hh, 0.12 * k, g);
    // rounded sawtooth roof with teal skylights
    for (let i = 0; i < 3; i++) {
      const rx = hx + (i * hw) / 3,
        rw = hw / 3;
      ctx.fillStyle = i % 2 ? P.steelLight : '#7a84aa';
      ctx.beginPath();
      ctx.moveTo(rx, y - hh);
      ctx.quadraticCurveTo(rx + rw * 0.7, y - hh - 0.75 * k, rx + rw, y - hh - 0.55 * k);
      ctx.lineTo(rx + rw, y - hh);
      ctx.closePath();
      ctx.fill();
      fillRR(ctx, rx + rw * 0.78, y - hh - 0.5 * k, rw * 0.16, 0.42 * k, 0.04 * k, on ? '#bff8f0' : '#6a8a9a');
      if (on) glow(ctx, rx + rw * 0.86, y - hh - 0.3 * k, 0.25 * k, P.teal, 0.3);
    }
    // brass trim and rivets
    fillRR(ctx, hx, y - hh - 0.02 * k, hw, 0.1 * k, 0.04 * k, P.brass);
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = P.brassLight;
      ctx.beginPath();
      ctx.arc(hx + 0.16 * k + (i * (hw - 0.32 * k)) / 8, y - hh + 0.2 * k, 0.03 * k, 0, TAU);
      ctx.fill();
    }
    // windows (teal-lit when working)
    for (let i = 0; i < 3; i++) A().windowPane(ctx, hx + 0.3 * k + i * 0.5 * k, y - hh + 0.38 * k, 0.32 * k, 0.32 * k, on, t + i);
    // big front cog (turns while assembling) and its meshing partner from Lv 10
    gear(ctx, x + 0.75 * k, y - hh + 0.55 * k, 0.4 * k, spin, P.brass);
    if (level >= 10) gear(ctx, x + 1.2 * k, y - hh + 0.25 * k, 0.24 * k, -spin * 1.7 + 0.2, P.copper);
    // door
    fillRR(ctx, x - 0.25 * k, y - 0.7 * k, 0.55 * k, 0.7 * k, 0.12 * k, P.ink);
    fillRR(ctx, x - 0.2 * k, y - 0.64 * k, 0.45 * k, 0.08 * k, 0.03 * k, on ? P.teal : P.tealDark);
    // rooftop clock (Lv 25)
    if (level >= 25) {
      const cx = x - 0.95 * k,
        cy = y - hh - 0.95 * k;
      ctx.fillStyle = P.brass;
      ctx.beginPath();
      ctx.arc(cx, cy, 0.34 * k, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fff6dc';
      ctx.beginPath();
      ctx.arc(cx, cy, 0.27 * k, 0, TAU);
      ctx.fill();
      line(ctx, cx, cy, cx + Math.cos(t * 0.5 - Math.PI / 2) * 0.2 * k, cy + Math.sin(t * 0.5 - Math.PI / 2) * 0.2 * k, 0.04 * k, P.ink);
      line(ctx, cx, cy, cx + Math.cos(t * 0.04) * 0.13 * k, cy + Math.sin(t * 0.04) * 0.13 * k, 0.05 * k, P.ink);
    }
    // press station in front-right: conveyor, anvil, piston arm (stamps only while really assembling)
    const px = x + 1.95 * k;
    fillRR(ctx, x + 1.2 * k, y - 0.32 * k, 1.5 * k, 0.16 * k, 0.08 * k, '#3a3f60');
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = P.steelLight;
      ctx.beginPath();
      ctx.arc(x + 1.3 * k + i * 0.32 * k, y - 0.24 * k, 0.05 * k, 0, TAU);
      ctx.fill();
    }
    line(ctx, x + 1.35 * k, y - 0.16 * k, x + 1.35 * k, y, 0.06 * k, P.steel2);
    line(ctx, x + 2.55 * k, y - 0.16 * k, x + 2.55 * k, y, 0.06 * k, P.steel2);
    line(ctx, px - 0.35 * k, y - 0.32 * k, px - 0.35 * k, y - 1.55 * k, 0.09 * k, P.steel2);
    line(ctx, px - 0.35 * k, y - 1.55 * k, px + 0.05 * k, y - 1.55 * k, 0.12 * k, P.steel2);
    const stroke = on ? Math.max(0, Math.sin(t * 5)) : 0,
      headY = y - 1.3 * k + stroke * 0.7 * k;
    line(ctx, px, y - 1.55 * k, px, headY, 0.07 * k, P.brassLight);
    fillRR(ctx, px - 0.18 * k, headY, 0.36 * k, 0.16 * k, 0.04 * k, P.copper);
    if (on && stroke > 0.92) glow(ctx, px, y - 0.36 * k, 0.28 * k, P.brassLight, 0.75);
    if (on) {
      const off = (t * 0.5 * k) % (0.45 * k);
      for (let bx = x + 1.3 * k + off; bx < x + 2.6 * k; bx += 0.45 * k) gear(ctx, bx, y - 0.4 * k, 0.07 * k, t * 3, bx < px ? P.steelLight : P.brassLight);
    }
    // robot arm (Lv 10) sorting finished parts
    if (level >= 10) {
      const a = on ? Math.sin(t * 2.4) * 0.6 : -0.3,
        bx0 = x + 2.75 * k,
        by0 = y - 0.15 * k;
      fillRR(ctx, bx0 - 0.15 * k, by0 - 0.05 * k, 0.3 * k, 0.2 * k, 0.05 * k, P.ink);
      const ex = bx0 + Math.cos(-Math.PI / 2 + a) * 0.6 * k,
        ey = by0 + Math.sin(-Math.PI / 2 + a) * 0.6 * k;
      line(ctx, bx0, by0, ex, ey, 0.08 * k, P.brass);
      line(ctx, ex, ey, ex + 0.25 * k, ey + 0.12 * k, 0.06 * k, P.brass);
      glow(ctx, ex, ey, 0.06 * k, P.teal, 0.9);
    }
    // ore hopper (real Präzisionserz stock) on the left
    ctx.fillStyle = P.steel2;
    ctx.beginPath();
    ctx.moveTo(hx - 0.75 * k, y - 1.25 * k);
    ctx.lineTo(hx - 0.05 * k, y - 1.25 * k);
    ctx.lineTo(hx - 0.25 * k, y - 0.6 * k);
    ctx.lineTo(hx - 0.55 * k, y - 0.6 * k);
    ctx.closePath();
    ctx.fill();
    fillRR(ctx, hx - 0.5 * k, y - 0.6 * k, 0.2 * k, 0.6 * k, 0.04 * k, '#3a3f60');
    const f = Math.max(0, Math.min(1, o.fill || 0));
    for (let i = 0; i < Math.round(f * 5); i++) gear(ctx, hx - 0.62 * k + i * 0.13 * k, y - 1.27 * k - (i % 2) * 0.05 * k, 0.06 * k, i, i % 2 ? P.teal : '#9ff0e4');
    // finished Präzisionsbauteile on an output tray (real stock)
    box(ctx, x + 2.9 * k, y - 0.08 * k, 0.8 * k, 0.08 * k, 0.1 * k, '#9a6e48', '#b88a5e', '#7a5638');
    const n = Math.round(Math.max(0, Math.min(1, o.parts || 0)) * 6);
    for (let i = 0; i < n; i++) gear(ctx, x + 2.98 * k + (i % 3) * 0.24 * k, y - 0.2 * k - Math.floor(i / 3) * 0.17 * k, 0.08 * k, i * 0.7, P.brassLight);
    plaque(ctx, x, y + 0.18 * k, k, 'Präzisionswerkstatt Lv ' + level, P.brassLight);
    return { x0: hx - 0.8 * k, y0: y - 3.1 * k, x1: x + 3.75 * k, y1: y + 0.6 * k };
  }


  // ----- Cogsworth-9 (session 9): M.O.T.T.E.'s factory coordinator — procedural, original -----
  // Tall but cute: brass body with teal trims, a round clock-face visor with ONE big teal eye-light and two clock hands
  // as brows, a small crown gear, four thin manipulator arms (clipboard, stamp, whistle, free), the M.O.T.T.E. ring-and-
  // three-dots insignia and a belly maintenance panel (the Taktband weak spot).
  // (x, y) = centre of the figure; height ≈ 2.9 · s. o.mood: inspect | warn | window | defend | open | violation |
  // exhausted | repair | friendly | stamp. o.symbol: gear | bolt | spring (shown on the visor while inspecting).
  function drawCogsworth(ctx, x, y, s, time, o = {}) {
    const mood = o.mood || 'inspect',
      calm = mood === 'friendly' || mood === 'stamp' || mood === 'repair',
      tired = mood === 'exhausted',
      bob = tired ? 0 : Math.sin(time * 1.8) * s * 0.05,
      teal = '#5fe0d0',
      brass = '#c99a4e',
      brassL = '#f3cf7a',
      brassD = '#8a6a3a',
      cream = '#f6ecd0';
    const rr = (px, py, w, h, r, c) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(px, py, w, h, r) : ctx.rect(px, py, w, h);
      ctx.fill();
    };
    const glowC = (cx, cy, r, c, a) => {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, c);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = a;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    };
    const arm = (sx, sy, ex, ey, w) => {
      ctx.strokeStyle = '#6a7290';
      ctx.lineWidth = w;
      ctx.lineCap = 'round';
      const mx = (sx + ex) / 2 + (ex > sx ? -1 : 1) * s * 0.08,
        my = (sy + ey) / 2 + s * 0.12;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(mx, my);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.fillStyle = brassL;
      ctx.beginPath();
      ctx.arc(mx, my, w * 0.7, 0, Math.PI * 2);
      ctx.fill();
    };
    ctx.save();
    ctx.translate(x, y + bob);
    if (tired) ctx.rotate(-0.12);
    if (o.hit) ctx.translate(Math.sin(time * 60) * s * 0.03, 0);
    // feet + legs
    for (const side of [-1, 1]) {
      rr(side * s * 0.32 - s * 0.07, s * 0.7, s * 0.14, s * 0.42, s * 0.06, '#6a7290');
      rr(side * s * 0.32 - s * 0.2, s * 1.08, s * 0.4, s * 0.2, s * 0.1, brassD);
    }
    // body: tall rounded brass cabinet with teal trims
    const g = ctx.createLinearGradient(-s * 0.6, 0, s * 0.6, 0);
    g.addColorStop(0, brassD);
    g.addColorStop(0.45, brass);
    g.addColorStop(1, '#a8803e');
    rr(-s * 0.62, -s * 0.38, s * 1.24, s * 1.15, s * 0.28, g);
    rr(-s * 0.62, -s * 0.38, s * 1.24, s * 0.08, s * 0.04, teal);
    rr(-s * 0.62, s * 0.69, s * 1.24, s * 0.06, s * 0.03, teal);
    // rivets
    ctx.fillStyle = brassL;
    for (const [rx, ry] of [[-0.5, -0.22], [0.5, -0.22], [-0.5, 0.55], [0.5, 0.55]]) {
      ctx.beginPath();
      ctx.arc(rx * s, ry * s, s * 0.035, 0, Math.PI * 2);
      ctx.fill();
    }
    // M.O.T.T.E. insignia: ring with three dots
    ctx.strokeStyle = teal;
    ctx.lineWidth = s * 0.045;
    ctx.beginPath();
    ctx.arc(0, -s * 0.12, s * 0.16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = teal;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(-s * 0.08 + i * s * 0.08, -s * 0.12, s * 0.025, 0, Math.PI * 2);
      ctx.fill();
    }
    // maintenance panel (belly) — opens in the Taktband 'open' phase and while being repaired
    const open = mood === 'open' || mood === 'repair';
    rr(-s * 0.3, s * 0.15, s * 0.6, s * 0.42, s * 0.08, '#2c3150');
    if (open) {
      glowC(0, s * 0.36, s * 0.42, teal, 0.75);
      ctx.save();
      ctx.translate(0, s * 0.36);
      ctx.rotate(time * 3);
      ctx.fillStyle = brassL;
      for (let i = 0; i < 8; i++) {
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-s * 0.025, -s * 0.15, s * 0.05, s * 0.06);
      }
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // the flap swung down
      rr(-s * 0.3, s * 0.57, s * 0.6, s * 0.1, s * 0.04, '#9a9fbc');
    } else {
      rr(-s * 0.26, s * 0.19, s * 0.52, s * 0.34, s * 0.06, '#7a84a6');
      ctx.fillStyle = '#4a5272';
      for (let i = 0; i < 3; i++) ctx.fillRect(-s * 0.18, s * 0.26 + i * s * 0.08, s * 0.36, s * 0.025);
    }
    // whistle on a chain
    ctx.strokeStyle = brassL;
    ctx.lineWidth = s * 0.02;
    ctx.beginPath();
    ctx.moveTo(s * 0.22, -s * 0.33);
    ctx.quadraticCurveTo(s * 0.34, -s * 0.05, s * 0.3, s * 0.06);
    ctx.stroke();
    rr(s * 0.24, s * 0.04, s * 0.16, s * 0.08, s * 0.04, '#d8dde8');
    // four manipulator arms: upper pair at the shoulders, lower pair at the hips
    const t = time;
    const wave = tired ? 0 : Math.sin(t * 3) * s * 0.06;
    // upper left: clipboard / approval tablet
    const cbx = -s * 1.0,
      cby = mood === 'warn' || mood === 'violation' ? -s * 0.75 : -s * 0.35 + wave * 0.5;
    arm(-s * 0.58, -s * 0.25, cbx + s * 0.12, cby + s * 0.2, s * 0.07);
    rr(cbx - s * 0.18, cby - s * 0.22, s * 0.36, s * 0.46, s * 0.04, '#d8b07a');
    rr(cbx - s * 0.14, cby - s * 0.16, s * 0.28, s * 0.36, s * 0.03, cream);
    rr(cbx - s * 0.06, cby - s * 0.26, s * 0.12, s * 0.07, s * 0.02, '#6a7290');
    ctx.fillStyle = '#8a94b8';
    for (let i = 0; i < 4; i++) ctx.fillRect(cbx - s * 0.1, cby - s * 0.08 + i * s * 0.07, s * (i === 3 ? 0.12 : 0.2), s * 0.022);
    if (calm) {
      ctx.strokeStyle = '#2a8a6a';
      ctx.lineWidth = s * 0.03;
      ctx.beginPath();
      ctx.moveTo(cbx + s * 0.02, cby + s * 0.12);
      ctx.lineTo(cbx + s * 0.06, cby + s * 0.16);
      ctx.lineTo(cbx + s * 0.12, cby + s * 0.06);
      ctx.stroke();
    }
    // upper right: stamp (stamps in the 'stamp' mood) or a raised warning hand
    const stampDown = mood === 'stamp' ? Math.max(0, Math.sin(t * 5)) : 0,
      sx = s * 0.98,
      sy = mood === 'warn' || mood === 'violation' ? -s * 0.8 : -s * 0.3 + stampDown * s * 0.25 - wave * 0.5;
    arm(s * 0.58, -s * 0.25, sx - s * 0.08, sy + s * 0.1, s * 0.07);
    rr(sx - s * 0.12, sy - s * 0.16, s * 0.24, s * 0.18, s * 0.05, '#a05a4a');
    rr(sx - s * 0.16, sy + s * 0.0, s * 0.32, s * 0.08, s * 0.03, calm ? '#2a8a6a' : '#c84a4a');
    // lower arms: little claws (the lower left holds a wrench while repairing/friendly)
    for (const side of [-1, 1]) {
      const hx = side * s * 0.92,
        hy = s * 0.45 + (side > 0 ? wave : -wave) * 0.6;
      arm(side * s * 0.58, s * 0.35, hx, hy, s * 0.06);
      ctx.strokeStyle = '#9aa6c8';
      ctx.lineWidth = s * 0.04;
      ctx.beginPath();
      ctx.arc(hx + side * s * 0.05, hy, s * 0.07, side > 0 ? -1.2 : 1.9, side > 0 ? 1.2 : 4.3);
      ctx.stroke();
    }
    // neck + head: round clock-face visor
    rr(-s * 0.12, -s * 0.52, s * 0.24, s * 0.16, s * 0.05, '#6a7290');
    const hy = -s * 0.98;
    ctx.fillStyle = brassD;
    ctx.beginPath();
    ctx.arc(0, hy, s * 0.52, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = brass;
    ctx.beginPath();
    ctx.arc(0, hy, s * 0.47, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = cream;
    ctx.beginPath();
    ctx.arc(0, hy, s * 0.4, 0, Math.PI * 2);
    ctx.fill();
    // hour ticks
    ctx.fillStyle = '#8a7a5a';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * s * 0.34, hy + Math.sin(a) * s * 0.34, s * (i % 3 ? 0.012 : 0.022), 0, Math.PI * 2);
      ctx.fill();
    }
    // crown gear on top (turns slowly; fast when warning)
    ctx.save();
    ctx.translate(0, hy - s * 0.55);
    ctx.rotate(tired ? 0.3 : time * (mood === 'warn' || mood === 'violation' ? 3 : 0.8));
    ctx.fillStyle = brassL;
    for (let i = 0; i < 8; i++) {
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-s * 0.03, -s * 0.15, s * 0.06, s * 0.06);
    }
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.11, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // ONE big teal eye-light (scans left/right while inspecting; dims when exhausted; red rim on violations)
    const scan = mood === 'inspect' || mood === 'window' ? Math.sin(time * 2.4) * s * 0.07 : 0,
      ex = scan,
      ey = hy - s * 0.04,
      eyeC = tired ? '#3a6a70' : teal;
    if (!tired) glowC(ex, ey, s * 0.34, eyeC, mood === 'open' ? 0.35 : 0.55);
    ctx.fillStyle = '#1a2a3a';
    ctx.beginPath();
    ctx.arc(ex, ey, s * 0.17, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = eyeC;
    ctx.beginPath();
    ctx.arc(ex, ey, s * 0.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8fffb';
    ctx.beginPath();
    ctx.arc(ex - s * 0.04, ey - s * 0.05, s * 0.04, 0, Math.PI * 2);
    ctx.fill();
    if (mood === 'violation' || mood === 'warn') {
      ctx.strokeStyle = '#ff6a6a';
      ctx.lineWidth = s * 0.035;
      ctx.beginPath();
      ctx.arc(ex, ey, s * 0.2, 0, Math.PI * 2);
      ctx.stroke();
    }
    // clock hands as brows: strict "V" while inspecting/defending, soft arc when friendly, droopy when tired
    ctx.strokeStyle = '#3a3048';
    ctx.lineWidth = s * 0.04;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (calm) {
      ctx.arc(0, hy + s * 0.08, s * 0.16, Math.PI * 0.15, Math.PI * 0.85);
    } else if (tired) {
      ctx.moveTo(-s * 0.25, hy - s * 0.22);
      ctx.lineTo(-s * 0.08, hy - s * 0.18);
      ctx.moveTo(s * 0.08, hy - s * 0.18);
      ctx.lineTo(s * 0.25, hy - s * 0.22);
    } else {
      ctx.moveTo(-s * 0.26, hy - s * 0.3);
      ctx.lineTo(-s * 0.06, hy - s * 0.22);
      ctx.moveTo(s * 0.06, hy - s * 0.22);
      ctx.lineTo(s * 0.26, hy - s * 0.3);
    }
    ctx.stroke();
    // small mouth grille
    rr(-s * 0.1, hy + s * 0.2, s * 0.2, s * 0.05, s * 0.02, calm ? '#2a8a6a' : '#6a5a4a');
    // warning lamp on the head while warning / after a violation
    if (mood === 'warn' || mood === 'violation') {
      const on = Math.sin(time * 10) > 0 || o.reduced;
      glowC(s * 0.42, hy - s * 0.38, s * 0.2, on ? '#ff5a5a' : '#7a2a2a', 0.9);
    }
    // defensive inspection shield: hexagon plates in front (not while the panel is open)
    if (mood === 'defend' || mood === 'inspect' || mood === 'window' || mood === 'violation') {
      ctx.globalAlpha = o.shieldAlpha ?? 0.22;
      ctx.strokeStyle = '#9ff0e4';
      ctx.lineWidth = s * 0.03;
      for (let i = -1; i <= 1; i++)
        for (let j = -1; j <= 1; j++) {
          const cx = i * s * 0.36 + (j % 2 ? s * 0.18 : 0),
            cy = j * s * 0.32 + s * 0.15;
          ctx.beginPath();
          for (let q = 0; q < 6; q++) ctx.lineTo(cx + Math.cos((q / 6) * Math.PI * 2) * s * 0.18, cy + Math.sin((q / 6) * Math.PI * 2) * s * 0.18);
          ctx.closePath();
          ctx.stroke();
        }
      ctx.globalAlpha = 1;
    }
    if (tired) {
      // sparks + a small steam puff
      for (let i = 0; i < 3; i++) glowC(-s * 0.4 + i * s * 0.35, -s * 0.5 + Math.sin(time * 5 + i) * s * 0.06, s * 0.08, '#ffd77a', 0.7);
    }
    ctx.restore();
  }
  // Inspektor-Drohne: a small hovering inspection box with a magnifier lens eye, a propeller and a tiny clipboard.
  function drawInspectorDrone(ctx, x, y, s, time, o = {}) {
    ctx.save();
    ctx.translate(x, y + Math.sin(time * 3) * s * 0.08);
    if (o.hit) ctx.translate(Math.sin(time * 60) * s * 0.04, 0);
    ctx.fillStyle = '#6a7290';
    ctx.fillRect(-s * 0.04, -s * 0.75, s * 0.08, s * 0.2);
    ctx.save();
    ctx.translate(0, -s * 0.78);
    ctx.scale(Math.cos(time * 25), 1);
    ctx.fillStyle = '#9aa6c8';
    ctx.fillRect(-s * 0.55, -s * 0.04, s * 1.1, s * 0.08);
    ctx.restore();
    ctx.fillStyle = '#c99a4e';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(-s * 0.5, -s * 0.55, s, s * 0.9, s * 0.22) : ctx.rect(-s * 0.5, -s * 0.55, s, s * 0.9);
    ctx.fill();
    ctx.fillStyle = '#5fe0d0';
    ctx.fillRect(-s * 0.5, -s * 0.12, s, s * 0.06);
    ctx.fillStyle = '#2c3150';
    ctx.beginPath();
    ctx.arc(0, -s * 0.2, s * 0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = o.hit ? '#ff8f8f' : '#9ff0e4';
    ctx.beginPath();
    ctx.arc(0, -s * 0.2, s * 0.17, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.arc(-s * 0.06, -s * 0.27, s * 0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8a6a3a';
    ctx.lineWidth = s * 0.06;
    ctx.beginPath();
    ctx.moveTo(s * 0.13, -s * 0.07);
    ctx.lineTo(s * 0.32, s * 0.12);
    ctx.stroke();
    ctx.fillStyle = '#f6ecd0';
    ctx.fillRect(-s * 0.72, s * 0.0, s * 0.24, s * 0.3);
    ctx.restore();
  }
  const cogPortraits = new Map();
  function cogsworthPortraitURL(mood = 'inspect', size = 96) {
    const key = mood + size;
    if (cogPortraits.has(key)) return cogPortraits.get(key);
    let url = '';
    try {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (ctx && c.toDataURL) {
        const bg = ctx.createRadialGradient(size / 2, size * 0.35, 4, size / 2, size / 2, size * 0.7);
        bg.addColorStop(0, mood === 'friendly' ? '#3a6a6a' : '#4a4a6a');
        bg.addColorStop(1, '#1a1e36');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, size, size);
        // head-and-shoulders crop
        drawCogsworth(ctx, size / 2, size * 0.98, size * 0.4, 0.6, { mood, shieldAlpha: 0 });
        url = c.toDataURL('image/png');
      }
    } catch {
      url = '';
    }
    cogPortraits.set(key, url);
    return url;
  }

  window.MekhanosArt = { PALETTE: P, factorySkyline, gearTower, pipeBridge, prop, maintenanceBot, workshop, drawCogsworth, drawInspectorDrone, cogsworthPortraitURL };
})();
