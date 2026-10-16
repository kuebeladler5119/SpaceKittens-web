// Colony building art: staged, modular 2.5D structures drawn with Canvas2D. All sizes are in kitten units (k), so a
// building looks the same on every screen size. Every function draws one structure standing on the ground at (x, y)
// and returns its tap rectangle. Moving parts only move when the real game state says the stage is working.
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const C = {
    metal: '#9aa6c8',
    metalDark: '#6f7da8',
    steel: '#c9d2ea',
    dark: '#2f2f5a',
    ink: '#24224a',
    warm: '#ffd77a',
    warmDeep: '#ffb35a',
    wood: '#c99a6a',
    woodDark: '#9a6e48',
    white: '#f4f2ff',
    shade: 'rgba(20,18,50,0.22)',
    hazard: '#ffcc33',
    mint: '#8ff0d4',
    pink: '#ff9ecb'
  };

  // ----- primitives -----
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
    else ctx.rect(x, y, w, h);
  }
  function fillRR(ctx, x, y, w, h, r, fill) {
    rr(ctx, x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
  }
  function poly(ctx, pts, fill) {
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }
  function line(ctx, x0, y0, x1, y1, width, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
  function glow(ctx, x, y, r, color, alpha = 1) {
    window.NebulaArt.glowCircle(ctx, x, y, r, color, alpha);
  }
  // Oblique box: front face (w × h) standing on y, top and right side faces give depth d.
  function box(ctx, x, y, w, h, d, front, top, side) {
    const x0 = x - w / 2,
      x1 = x + w / 2,
      y0 = y - h,
      dx = d,
      dy = d * 0.55;
    poly(ctx, [[x0, y0], [x0 + dx, y0 - dy], [x1 + dx, y0 - dy], [x1, y0]], top);
    poly(ctx, [[x1, y0], [x1 + dx, y0 - dy], [x1 + dx, y - dy], [x1, y]], side);
    ctx.fillStyle = front;
    ctx.fillRect(x0, y0, w, h);
  }
  function shadow(ctx, x, y, w, k) {
    ctx.fillStyle = C.shade;
    ctx.beginPath();
    ctx.ellipse(x, y + 0.04 * k, w / 2, 0.16 * k, 0, 0, TAU);
    ctx.fill();
  }
  function windowPane(ctx, x, y, w, h, lit, t = 0) {
    fillRR(ctx, x, y, w, h, Math.min(w, h) * 0.25, lit ? '#ffe9a8' : '#4a4f86');
    if (lit) glow(ctx, x + w / 2, y + h / 2, Math.max(w, h) * 1.1, '#ffd77a', 0.25 + Math.sin(t * 2) * 0.05);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(x + w * 0.12, y + h * 0.12, w * 0.18, h * 0.5);
  }
  function lamp(ctx, x, y, k, on, t) {
    line(ctx, x, y, x, y - 1.25 * k, 0.07 * k, C.metalDark);
    line(ctx, x, y - 1.25 * k, x + 0.22 * k, y - 1.3 * k, 0.06 * k, C.metalDark);
    fillRR(ctx, x + 0.12 * k, y - 1.36 * k, 0.22 * k, 0.12 * k, 0.05 * k, on ? '#fff3c4' : '#7c80a8');
    if (on) glow(ctx, x + 0.23 * k, y - 1.24 * k, 0.55 * k, '#ffe9a8', 0.45 + Math.sin(t * 3) * 0.05);
  }
  function hazard(ctx, x, y, w, h) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.fillStyle = C.hazard;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = C.ink;
    for (let sx = x - h; sx < x + w; sx += h * 1.6) poly(ctx, [[sx, y + h], [sx + h * 0.8, y], [sx + h * 1.4, y], [sx + h * 0.6, y + h]], C.ink);
    ctx.restore();
  }
  function gear(ctx, x, y, r, angle, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU,
        rr2 = i % 2 ? r : r * 1.25;
      ctx.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.4, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  function crate(ctx, x, y, s, color = '#ffc95a', dark = '#c98a2a') {
    fillRR(ctx, x - s / 2, y - s, s, s, s * 0.12, color);
    ctx.strokeStyle = dark;
    ctx.lineWidth = s * 0.09;
    ctx.strokeRect(x - s * 0.36, y - s * 0.86, s * 0.72, s * 0.72);
    line(ctx, x - s * 0.36, y - s * 0.86, x + s * 0.36, y - s * 0.14, s * 0.08, dark);
  }
  function crystal(ctx, x, y, s, fill, rot = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(s * 0.36, -s * 0.25);
    ctx.lineTo(0, s * 0.18);
    ctx.lineTo(-s * 0.36, -s * 0.25);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(s * 0.1, -s * 0.3);
    ctx.lineTo(-s * 0.12, -s * 0.3);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fill();
    ctx.restore();
  }
  // Living Worlds 2.0: a scene may limit the plain building labels to what the player is looking at (warnings in
  // capitals always show). x is the world x of the label.
  let labelGate = null;
  function setLabelGate(fn) {
    labelGate = typeof fn === 'function' ? fn : null;
  }
  // Living Worlds 2.0: the shared industrial buildings (depot, refinery) are built from each world's own materials —
  // Orion's lavender panels, Glacies' frosted white-blue, Pyra's dark basalt, Mekhanos' blued steel, Viridia's cream
  // and moss. The world is found from the theme object the scene passes in (o.theme = NebulaArt.THEMES[planet]).
  const MATERIALS = {
    crystal: { wall: ['#e8e4fa', '#ffffff', '#c4bfe6'], hall: ['#d9d3f5', '#f1eeff', '#b7b0de'] },
    ice: { wall: ['#e6f6ff', '#ffffff', '#b8dcf2'], hall: ['#d4ecfa', '#f2fbff', '#a6cde6'] },
    volcanic: { wall: ['#6a5262', '#8a6a7a', '#4a3646'], hall: ['#5e4656', '#7f6070', '#3e2c3a'] },
    machine: { wall: ['#9aa6c8', '#c4cee6', '#6f7aa0'], hall: ['#8a96b8', '#b8c4e0', '#626e94'] },
    verdant: { wall: ['#f2ead2', '#fffbea', '#cfc39e'], hall: ['#e6dcbc', '#f8f2dc', '#bfb08a'] }
  };
  function materials(theme) {
    const T = window.NebulaArt?.THEMES || {};
    const id = Object.keys(MATERIALS).find(key => T[key] && T[key] === theme);
    return MATERIALS[id] || MATERIALS.crystal;
  }
  function plaque(ctx, x, y, k, text, color = C.warm) {
    if (labelGate && text !== String(text).toUpperCase() && !labelGate(x, text)) return;
    ctx.font = `900 ${Math.max(9, Math.round(0.24 * k))}px Nunito, sans-serif`;
    const w = ctx.measureText(text).width + 0.36 * k,
      h = 0.4 * k;
    fillRR(ctx, x - w / 2, y, w, h, h / 2, 'rgba(29,33,80,0.88)');
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + h / 2 + 0.5);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
  function scaffold(ctx, x, y, w, h, k) {
    ctx.strokeStyle = C.wood;
    ctx.lineWidth = 0.07 * k;
    for (let i = 0; i <= 3; i++) line(ctx, x - w / 2 + (i * w) / 3, y, x - w / 2 + (i * w) / 3, y - h, 0.07 * k, C.wood);
    for (let j = 1; j <= 3; j++) line(ctx, x - w / 2, y - (j * h) / 3, x + w / 2, y - (j * h) / 3, 0.06 * k, C.woodDark);
    line(ctx, x - w / 2, y, x + w / 2, y - h, 0.05 * k, C.woodDark);
  }
  function emptyPlot(ctx, x, y, k, label, locked) {
    ctx.fillStyle = 'rgba(255,255,255,0.13)';
    ctx.beginPath();
    ctx.ellipse(x, y + 0.05 * k, 1.35 * k, 0.28 * k, 0, 0, TAU);
    ctx.fill();
    ctx.setLineDash([0.14 * k, 0.12 * k]);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 0.05 * k;
    ctx.stroke();
    ctx.setLineDash([]);
    line(ctx, x, y, x, y - 1.05 * k, 0.09 * k, C.woodDark);
    ctx.font = `900 ${Math.max(9, Math.round(0.26 * k))}px Nunito, sans-serif`;
    const w = ctx.measureText(label).width + 0.4 * k;
    fillRR(ctx, x - w / 2, y - 1.62 * k, w, 0.56 * k, 0.14 * k, locked ? '#d6d2ea' : '#fff4e2');
    ctx.fillStyle = '#3a2f5a';
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y - 1.24 * k);
    ctx.textAlign = 'left';
    const bx = x + w / 2 - 0.05 * k,
      by = y - 1.62 * k;
    ctx.fillStyle = locked ? '#b9b4d6' : C.mint;
    ctx.beginPath();
    ctx.arc(bx, by, 0.2 * k, 0, TAU);
    ctx.fill();
    ctx.fillStyle = C.ink;
    ctx.font = `900 ${Math.max(9, Math.round(0.26 * k))}px Nunito, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(locked ? '🔒' : '+', bx, by + 0.1 * k);
    ctx.textAlign = 'left';
    return { x0: x - 1.4 * k, y0: y - 1.8 * k, x1: x + 1.4 * k, y1: y + 0.3 * k };
  }
  // A thin power line pole (cables are drawn between consecutive poles by the scene).
  function pole(ctx, x, y, k, on, t) {
    line(ctx, x, y, x, y - 1.9 * k, 0.07 * k, '#7f86b8');
    line(ctx, x - 0.25 * k, y - 1.75 * k, x + 0.25 * k, y - 1.75 * k, 0.06 * k, '#7f86b8');
    glow(ctx, x, y - 1.95 * k, 0.12 * k, on && Math.sin(t * 2 + x) > -0.2 ? '#8ff0d4' : '#5a5f8a', 0.9);
  }

  // ----- Mine: deposit → tools → mini drill (5) → drill tower (15) → mining complex (25) → crystal excavator (50) -----
  function mine(ctx, x, y, k, o) {
    const level = o.level,
      t = o.time,
      working = o.active,
      accent = o.theme.accent;
    ctx.save();
    if (o.flip) {
      ctx.translate(x, 0);
      ctx.scale(-1, 1);
      ctx.translate(-x, 0);
    }
    shadow(ctx, x - 0.4 * k, y, 4.6 * k, k);
    // rocky outcrop with the crystal vein
    poly(ctx, [[x - 1.2 * k, y], [x - 0.9 * k, y - 0.7 * k], [x - 0.2 * k, y - 0.95 * k], [x + 0.6 * k, y - 0.75 * k], [x + 1.1 * k, y]], o.rock || '#8a86c8');
    poly(ctx, [[x - 0.9 * k, y - 0.7 * k], [x - 0.2 * k, y - 0.95 * k], [x + 0.1 * k, y - 0.6 * k]], 'rgba(255,255,255,0.18)');
    const vein = Math.min(5, 3 + Math.floor(level / 25));
    for (let i = 0; i < vein; i++) {
      const cx = x - 0.7 * k + i * 0.38 * k,
        s = (0.55 + ((i * 37) % 5) * 0.08) * k;
      crystal(ctx, cx, y - 0.45 * k, s, accent, (i - 2) * 0.22);
    }
    glow(ctx, x - 0.1 * k, y - 0.7 * k, 1.1 * k, o.theme.glow, 0.28 + (working ? 0.1 : 0) + Math.sin(t * 2) * 0.05);
    const mx = x - 2 * k; // machine bay left of the vein
    if (level < 5) {
      // hand tools + wooden support frame + lantern (Beta 1.3: the posts stand ON the outcrop, clear of the flanks the
      // helpers' pickaxes strike — see mineSlot() in colony-scene.js)
      line(ctx, x - 0.92 * k, y - 0.55 * k, x - 0.92 * k, y - 1.35 * k, 0.1 * k, C.wood);
      line(ctx, x + 0.72 * k, y - 0.55 * k, x + 0.72 * k, y - 1.35 * k, 0.1 * k, C.wood);
      line(ctx, x - 1.05 * k, y - 1.35 * k, x + 0.85 * k, y - 1.35 * k, 0.12 * k, C.woodDark);
      fillRR(ctx, x - 0.12 * k, y - 1.3 * k, 0.24 * k, 0.28 * k, 0.06 * k, '#ffe9a8');
      glow(ctx, x, y - 1.15 * k, 0.5 * k, '#ffd77a', 0.4);
      line(ctx, mx + 0.5 * k, y, mx + 0.9 * k, y - 0.9 * k, 0.07 * k, C.woodDark);
      line(ctx, mx + 0.62 * k, y - 0.88 * k, mx + 1.15 * k, y - 0.72 * k, 0.09 * k, C.steel);
      crate(ctx, mx + 0.1 * k, y, 0.45 * k);
    } else if (level < 15) {
      // mini drill: tracked base, motor with fan, drill arm into the vein, control box with blinking light
      fillRR(ctx, mx - 0.7 * k, y - 0.32 * k, 1.5 * k, 0.32 * k, 0.16 * k, C.dark);
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = C.metal;
        ctx.beginPath();
        ctx.arc(mx - 0.5 * k + i * 0.36 * k, y - 0.16 * k, 0.1 * k, 0, TAU);
        ctx.fill();
      }
      box(ctx, mx, y - 0.32 * k, 1.2 * k, 0.75 * k, 0.25 * k, '#ffb35a', '#ffd08a', '#d98a3a');
      gear(ctx, mx - 0.25 * k, y - 0.7 * k, 0.18 * k, working ? t * 6 : 0, C.dark);
      const arm = working ? Math.sin(t * 9) * 0.05 * k : 0;
      line(ctx, mx + 0.5 * k, y - 0.8 * k, x - 0.85 * k + arm, y - 0.55 * k, 0.14 * k, C.metalDark);
      poly(ctx, [[x - 0.95 * k + arm, y - 0.7 * k], [x - 0.5 * k + arm, y - 0.55 * k], [x - 0.95 * k + arm, y - 0.4 * k]], C.warm);
      fillRR(ctx, mx - 1.2 * k, y - 0.95 * k, 0.4 * k, 0.95 * k, 0.08 * k, C.steel);
      glow(ctx, mx - k, y - 0.75 * k, 0.12 * k, working && Math.sin(t * 5) > 0 ? C.mint : '#ff8f8f', 0.95);
      lamp(ctx, x + 1.4 * k, y, k, true, t);
    } else if (level < 25) {
      // industrial drill tower: lattice tower, cabin, articulated arm, floodlights
      tower(ctx, mx, y, k, 2.9, t, working);
      box(ctx, mx - 0.9 * k, y, 0.9 * k, 0.9 * k, 0.25 * k, C.steel, C.white, C.metal);
      windowPane(ctx, mx - 1.2 * k, y - 0.75 * k, 0.6 * k, 0.32 * k, true, t);
      hazard(ctx, mx - 1.35 * k, y - 0.14 * k, 0.9 * k, 0.14 * k);
      const reach = working ? (Math.sin(t * 3) + 1) * 0.12 * k : 0;
      line(ctx, mx + 0.2 * k, y - 2.4 * k, x - 0.4 * k, y - 1.7 * k, 0.16 * k, C.metalDark);
      line(ctx, x - 0.4 * k, y - 1.7 * k, x - 0.3 * k, y - 0.95 * k + reach, 0.16 * k, C.metalDark);
      drillBit(ctx, x - 0.3 * k, y - 0.9 * k + reach, k, working ? t * 14 : 0);
      floodlight(ctx, mx + 0.35 * k, y - 2.95 * k, k, t, -0.4);
    } else if (level < 50) {
      // heavy mining complex: raised deck with railings, bigger tower, conveyor to the loading chute, steam vents
      deck(ctx, mx - 0.6 * k, y, 2.6 * k, 0.6 * k, k);
      tower(ctx, mx, y - 0.6 * k, k, 3.1, t, working);
      box(ctx, mx - 1.2 * k, y - 0.6 * k, 1.05 * k, 1.05 * k, 0.3 * k, C.steel, C.white, C.metal);
      windowPane(ctx, mx - 1.55 * k, y - 1.45 * k, 0.7 * k, 0.36 * k, true, t);
      gear(ctx, mx + 0.5 * k, y - 1.1 * k, 0.28 * k, working ? -t * 4 : 0, C.metalDark);
      const reach = working ? (Math.sin(t * 3) + 1) * 0.14 * k : 0;
      line(ctx, mx + 0.2 * k, y - 3.2 * k, x - 0.5 * k, y - 2.1 * k, 0.2 * k, C.metalDark);
      line(ctx, x - 0.5 * k, y - 2.1 * k, x - 0.3 * k, y - 1 * k + reach, 0.2 * k, C.metalDark);
      drillBit(ctx, x - 0.3 * k, y - 0.95 * k + reach, k * 1.25, working ? t * 16 : 0);
      conveyor(ctx, x + 0.7 * k, y - 0.55 * k, x + 2.4 * k, y - 1.05 * k, k, working, t, accent);
      floodlight(ctx, mx + 0.4 * k, y - 3.85 * k, k, t, -0.35);
      floodlight(ctx, mx - 1.6 * k, y - 1.7 * k, k, t, 0.3);
      if (working && Math.sin(t * 1.3) > 0.4) steam(ctx, mx - 1.5 * k, y - 1.75 * k, k, t);
    } else {
      // crystal excavator: bucket wheel with energy beam, coil towers, integrated loading arm
      deck(ctx, mx - 0.5 * k, y, 3 * k, 0.7 * k, k);
      box(ctx, mx - 0.9 * k, y - 0.7 * k, 1.9 * k, 1.25 * k, 0.4 * k, '#e8e4fa', '#ffffff', '#c4bfe6');
      windowPane(ctx, mx - 1.6 * k, y - 1.65 * k, 0.55 * k, 0.4 * k, true, t);
      windowPane(ctx, mx - 0.95 * k, y - 1.65 * k, 0.55 * k, 0.4 * k, true, t + 1);
      hazard(ctx, mx - 1.85 * k, y - 0.85 * k, 1.9 * k, 0.14 * k);
      // boom + wheel
      line(ctx, mx, y - 1.4 * k, x - 0.7 * k, y - 2.3 * k, 0.26 * k, C.metalDark);
      const wx = x - 0.55 * k,
        wy = y - 2.2 * k,
        wr = 0.95 * k,
        spin = working ? t * 1.6 : 0;
      ctx.strokeStyle = C.metal;
      ctx.lineWidth = 0.16 * k;
      ctx.beginPath();
      ctx.arc(wx, wy, wr, 0, TAU);
      ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const a = spin + (i / 8) * TAU;
        line(ctx, wx, wy, wx + Math.cos(a) * wr, wy + Math.sin(a) * wr, 0.07 * k, C.metalDark);
        ctx.save();
        ctx.translate(wx + Math.cos(a) * wr, wy + Math.sin(a) * wr);
        ctx.rotate(a);
        fillRR(ctx, -0.16 * k, -0.14 * k, 0.32 * k, 0.28 * k, 0.06 * k, C.warmDeep);
        ctx.restore();
      }
      gear(ctx, wx, wy, 0.22 * k, -spin * 2, C.dark);
      if (working) {
        ctx.strokeStyle = `rgba(143,240,212,${0.55 + Math.sin(t * 10) * 0.2})`;
        ctx.lineWidth = 0.1 * k;
        ctx.beginPath();
        ctx.moveTo(wx, wy + wr);
        ctx.lineTo(x - 0.1 * k, y - 0.55 * k);
        ctx.stroke();
        glow(ctx, x - 0.1 * k, y - 0.55 * k, 0.5 * k, C.mint, 0.6);
      }
      // coil towers
      [-2.2, -0.2].forEach((dx, i) => {
        line(ctx, mx + dx * k, y - 0.7 * k, mx + dx * k, y - 2.9 * k, 0.16 * k, C.steel);
        for (let j = 0; j < 4; j++) fillRR(ctx, mx + dx * k - 0.17 * k, y - (1.1 + j * 0.42) * k, 0.34 * k, 0.12 * k, 0.05 * k, C.accent2 || accent);
        glow(ctx, mx + dx * k, y - 2.95 * k, 0.32 * k, i ? C.mint : C.pink, 0.5 + (working ? Math.sin(t * 6 + i) * 0.25 : 0));
      });
      conveyor(ctx, x + 0.8 * k, y - 0.6 * k, x + 2.4 * k, y - 1.2 * k, k, working, t, accent);
      floodlight(ctx, mx - 2.2 * k, y - 3 * k, k, t, 0.35);
    }
    // material pile (real stock waiting for transport), red pulse when the pile is full
    const px = x + 2.65 * k,
      heap = Math.round(Math.max(0, Math.min(1, o.pileRatio || 0)) * 10);
    for (let i = 0; i < heap; i++) {
      const row = i < 4 ? 0 : i < 7 ? 1 : i < 9 ? 2 : 3,
        col = [i, i - 4, i - 7, i - 9][row];
      crystal(ctx, px - 0.55 * k + col * 0.32 * k + row * 0.16 * k, y - 0.05 * k - row * 0.24 * k, 0.32 * k, i % 2 ? accent : o.theme.particle || '#fff', 0);
    }
    if (o.pileFull) glow(ctx, px, y - 0.45 * k, 0.6 * k, '#ff8f8f', 0.4 + Math.sin(t * 8) * 0.2);
    ctx.restore();
    plaque(ctx, x, y + 0.18 * k, k, 'Mine Lv ' + level);
    return o.flip ? { x0: x - 1.4 * k, y0: y - 4.2 * k, x1: x + 4.4 * k, y1: y + 0.6 * k } : { x0: x - 4.4 * k, y0: y - 4.2 * k, x1: x + 1.4 * k, y1: y + 0.6 * k };
  }
  function tower(ctx, x, y, k, height, t, working) {
    const top = y - height * k,
      half = 0.36 * k;
    line(ctx, x - half, y, x - half * 0.6, top, 0.09 * k, C.metalDark);
    line(ctx, x + half, y, x + half * 0.6, top, 0.09 * k, C.metalDark);
    for (let yy = y; yy > top + 0.2 * k; yy -= 0.45 * k) {
      const f = (y - yy) / (y - top),
        w = half - (half * 0.4) * f;
      line(ctx, x - w, yy, x + w * 0.9, yy - 0.45 * k, 0.05 * k, C.metal);
      line(ctx, x - w, yy, x + w, yy, 0.05 * k, C.metal);
    }
    fillRR(ctx, x - 0.42 * k, top - 0.3 * k, 0.84 * k, 0.32 * k, 0.08 * k, C.steel);
    glow(ctx, x, top - 0.36 * k, 0.12 * k, working && Math.sin(t * 4) > 0 ? '#ff8f8f' : '#ffe9a8', 0.95);
  }
  function drillBit(ctx, x, y, k, spin) {
    ctx.save();
    ctx.translate(x, y);
    fillRR(ctx, -0.18 * k, -0.35 * k, 0.36 * k, 0.3 * k, 0.06 * k, C.steel);
    ctx.rotate(Math.sin(spin) * 0.04);
    poly(ctx, [[-0.16 * k, -0.06 * k], [0.16 * k, -0.06 * k], [0, 0.42 * k]], C.warm);
    for (let i = 0; i < 3; i++) line(ctx, -0.12 * k + (((spin * 0.05 + i / 3) % 1) * 0.24 * k), -0.02 * k, 0, 0.36 * k, 0.03 * k, C.warmDeep);
    ctx.restore();
  }
  function floodlight(ctx, x, y, k, t, tilt) {
    fillRR(ctx, x - 0.16 * k, y - 0.1 * k, 0.32 * k, 0.2 * k, 0.05 * k, C.dark);
    ctx.save();
    ctx.globalAlpha = 0.16 + Math.sin(t * 1.5) * 0.03;
    ctx.fillStyle = '#fff6d0';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.sin(tilt - 0.35) * 2.2 * k, y + Math.cos(tilt - 0.35) * 2.2 * k);
    ctx.lineTo(x + Math.sin(tilt + 0.35) * 2.2 * k, y + Math.cos(tilt + 0.35) * 2.2 * k);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  function deck(ctx, x, y, w, h, k) {
    box(ctx, x, y, w, h, 0.3 * k, '#7f86b8', '#a9b0d8', '#646ca0');
    hazard(ctx, x - w / 2, y - h, w, 0.1 * k);
    for (let i = 0; i <= 4; i++) line(ctx, x - w / 2 + (i * w) / 4, y - h, x - w / 2 + (i * w) / 4, y - h - 0.32 * k, 0.04 * k, C.steel);
    line(ctx, x - w / 2, y - h - 0.32 * k, x + w / 2, y - h - 0.32 * k, 0.05 * k, C.steel);
  }
  function conveyor(ctx, x0, y0, x1, y1, k, running, t, accent) {
    line(ctx, x0, y0, x1, y1, 0.22 * k, C.dark);
    ctx.save();
    ctx.setLineDash([0.12 * k, 0.24 * k]);
    ctx.lineDashOffset = running ? -t * 1.6 * k : 0;
    line(ctx, x0, y0 - 0.06 * k, x1, y1 - 0.06 * k, 0.1 * k, accent);
    ctx.restore();
    line(ctx, x1, y1, x1, y1 + 0.9 * k, 0.08 * k, C.metalDark);
  }
  function steam(ctx, x, y, k, t) {
    for (let i = 0; i < 3; i++) {
      const p = (t * 0.6 + i / 3) % 1;
      ctx.fillStyle = `rgba(255,255,255,${0.4 * (1 - p)})`;
      ctx.beginPath();
      ctx.arc(x + Math.sin(p * 5 + i) * 0.15 * k, y - p * 1.2 * k, (0.15 + p * 0.25) * k, 0, TAU);
      ctx.fill();
    }
  }

  // ----- Transport: track, loading station and the vehicle generations -----
  function track(ctx, x0, x1, groundAt, k, level) {
    if (!level) return;
    const a = Math.min(x0, x1),
      b = Math.max(x0, x1),
      y = gx => groundAt(gx) - 0.12 * k;
    for (let gx = a; gx <= b; gx += 0.34 * k) line(ctx, gx, y(gx) - 0.05 * k, gx, y(gx) + 0.12 * k, 0.07 * k, '#8a6a4e');
    [-0.04, 0.1].forEach(off => {
      ctx.strokeStyle = level >= 50 ? '#8ff0d4' : '#c4cbe4';
      ctx.lineWidth = 0.05 * k;
      ctx.beginPath();
      for (let gx = a; gx <= b; gx += 0.25 * k) gx === a ? ctx.moveTo(gx, y(gx) + off * k) : ctx.lineTo(gx, y(gx) + off * k);
      ctx.stroke();
    });
  }
  function loadingStation(ctx, x, y, k, o) {
    const level = o.level,
      t = o.time;
    if (level < 10) {
      line(ctx, x, y, x, y - 1.1 * k, 0.08 * k, C.woodDark);
      poly(ctx, [[x - 0.45 * k, y - 1.1 * k], [x + 0.45 * k, y - 1.1 * k], [x + 0.15 * k, y - 0.7 * k], [x - 0.15 * k, y - 0.7 * k]], C.wood);
    } else if (level < 25) {
      line(ctx, x - 0.35 * k, y, x - 0.35 * k, y - 1.5 * k, 0.09 * k, C.metalDark);
      line(ctx, x + 0.35 * k, y, x + 0.35 * k, y - 1.5 * k, 0.09 * k, C.metalDark);
      poly(ctx, [[x - 0.6 * k, y - 1.55 * k], [x + 0.6 * k, y - 1.55 * k], [x + 0.2 * k, y - 0.95 * k], [x - 0.2 * k, y - 0.95 * k]], '#ffb35a');
      lamp(ctx, x + 0.75 * k, y, k, true, t);
    } else {
      // gantry with a crane hook that only moves while transport runs
      line(ctx, x - 0.9 * k, y, x - 0.9 * k, y - 2.2 * k, 0.12 * k, C.metalDark);
      line(ctx, x + 0.9 * k, y, x + 0.9 * k, y - 2.2 * k, 0.12 * k, C.metalDark);
      line(ctx, x - 1.1 * k, y - 2.2 * k, x + 1.1 * k, y - 2.2 * k, 0.16 * k, C.hazard);
      const hook = o.active ? Math.sin(t * 2) * 0.5 * k : 0;
      line(ctx, x + hook, y - 2.2 * k, x + hook, y - 1.4 * k, 0.04 * k, C.ink);
      crate(ctx, x + hook, y - 1.05 * k, 0.4 * k);
      if (level >= 50) {
        poly(ctx, [[x - 0.7 * k, y - 1.9 * k], [x + 0.7 * k, y - 1.9 * k], [x + 0.25 * k, y - 1.2 * k], [x - 0.25 * k, y - 1.2 * k]], '#8ff0d4');
        glow(ctx, x, y - 1.5 * k, 0.6 * k, C.mint, 0.35);
      }
    }
    plaque(ctx, x, y + 0.36 * k, k, 'Lorenbahn Lv ' + level, '#8fe3ff');
    return { x0: x - 1.2 * k, y0: y - 2.4 * k, x1: x + 1.2 * k, y1: y + 0.8 * k };
  }
  // Vehicle by rail level: hand cart (1) → big cart (5) → rover (10) → cargo train (25) → maglev pods (50).
  function vehicle(ctx, x, y, k, o) {
    const { level, loaded, dir, time: t, accent } = o;
    ctx.save();
    ctx.translate(x, y);
    if (dir < 0) ctx.scale(-1, 1);
    // Beta 1.7 M3: the drawn load follows the real fill (o.fill 0..1); o.tilt tips the tub while unloading
    if (o.tilt) {
      ctx.translate(0.35 * k, -0.1 * k);
      ctx.rotate(-o.tilt);
      ctx.translate(-0.35 * k, 0.1 * k);
    }
    const load = max => {
      const n = o.fill === undefined ? max : o.fill > 0.02 ? Math.max(1, Math.round(o.fill * max)) : 0;
      for (let i = 0; i < n; i++) crystal(ctx, -0.28 * k + i * 0.28 * k, -0.42 * k - (i % 2) * 0.06 * k, 0.26 * k, i % 2 ? accent : '#fff4ff', 0);
    };
    const wheels = (xs, r) =>
      xs.forEach(wx => {
        ctx.fillStyle = C.ink;
        ctx.beginPath();
        ctx.arc(wx * k, -0.06 * k, r * k, 0, TAU);
        ctx.fill();
        ctx.fillStyle = C.metal;
        ctx.beginPath();
        ctx.arc(wx * k, -0.06 * k, r * 0.45 * k, 0, TAU);
        ctx.fill();
      });
    if (level < 5 && o.barrow) {
      // a kitten's wheelbarrow: one wheel in front, two handles behind (the kitten is drawn by the scene)
      if (loaded) load(2);
      poly(ctx, [[-0.42 * k, -0.48 * k], [0.4 * k, -0.48 * k], [0.28 * k, -0.14 * k], [-0.3 * k, -0.14 * k]], C.wood);
      line(ctx, -0.42 * k, -0.48 * k, 0.4 * k, -0.48 * k, 0.05 * k, C.woodDark);
      line(ctx, -0.3 * k, -0.2 * k, -0.72 * k, -0.42 * k, 0.05 * k, C.woodDark);
      line(ctx, -0.12 * k, -0.14 * k, -0.2 * k, 0, 0.05 * k, C.woodDark);
      wheels([0.3], 0.13);
    } else if (level < 10) {
      const big = level >= 5 ? 1.2 : 1;
      if (loaded) load(level >= 5 ? 3 : 2);
      poly(ctx, [[-0.45 * big * k, -0.5 * k], [0.45 * big * k, -0.5 * k], [0.36 * big * k, -0.1 * k], [-0.36 * big * k, -0.1 * k]], level >= 5 ? '#9aa6c8' : C.wood);
      line(ctx, -0.45 * big * k, -0.5 * k, 0.45 * big * k, -0.5 * k, 0.05 * k, level >= 5 ? C.metalDark : C.woodDark);
      wheels([-0.24 * big, 0.24 * big], 0.11);
    } else if (level < 25) {
      // powered rover with cab, antenna and headlight
      if (loaded) load(3);
      fillRR(ctx, -0.6 * k, -0.52 * k, 0.95 * k, 0.42 * k, 0.1 * k, '#ff9e5a');
      fillRR(ctx, 0.3 * k, -0.78 * k, 0.42 * k, 0.68 * k, 0.12 * k, '#ffb35a');
      fillRR(ctx, 0.4 * k, -0.7 * k, 0.24 * k, 0.24 * k, 0.06 * k, 'rgba(170,230,255,0.95)');
      line(ctx, 0.36 * k, -0.78 * k, 0.3 * k, -1.02 * k, 0.03 * k, C.white);
      glow(ctx, 0.3 * k, -1.04 * k, 0.07 * k, Math.sin(t * 6) > 0 ? C.mint : C.warm, 1);
      glow(ctx, 0.74 * k, -0.3 * k, 0.18 * k, '#fff6d0', 0.8);
      wheels([-0.4, 0, 0.45], 0.13);
    } else if (level < 50) {
      // cargo train: rover + two linked wagons
      for (let wgn = 0; wgn < 2; wgn++) {
        ctx.save();
        ctx.translate(-(1 + wgn) * 0.95 * k, 0);
        if (loaded) load(3);
        fillRR(ctx, -0.42 * k, -0.48 * k, 0.84 * k, 0.38 * k, 0.08 * k, wgn ? '#c4b3ff' : '#8fe3ff');
        line(ctx, 0.42 * k, -0.22 * k, 0.55 * k, -0.22 * k, 0.05 * k, C.ink);
        wheels([-0.24, 0.24], 0.11);
        ctx.restore();
      }
      fillRR(ctx, -0.48 * k, -0.58 * k, 1.05 * k, 0.48 * k, 0.12 * k, '#ff9e5a');
      fillRR(ctx, 0.12 * k, -0.86 * k, 0.45 * k, 0.4 * k, 0.1 * k, '#ffb35a');
      fillRR(ctx, 0.22 * k, -0.8 * k, 0.26 * k, 0.22 * k, 0.06 * k, 'rgba(170,230,255,0.95)');
      glow(ctx, 0.6 * k, -0.32 * k, 0.2 * k, '#fff6d0', 0.8);
      wheels([-0.3, 0.05, 0.4], 0.13);
    } else {
      // maglev cargo pod hovering over the glowing rail
      const hover = Math.sin(t * 3) * 0.04 * k;
      ctx.translate(0, hover - 0.12 * k);
      if (loaded) load(3);
      fillRR(ctx, -0.75 * k, -0.6 * k, 1.5 * k, 0.5 * k, 0.25 * k, '#e8e4fa');
      fillRR(ctx, -0.75 * k, -0.24 * k, 1.5 * k, 0.12 * k, 0.06 * k, accent);
      fillRR(ctx, 0.25 * k, -0.52 * k, 0.4 * k, 0.24 * k, 0.1 * k, 'rgba(170,230,255,0.95)');
      glow(ctx, 0, 0, 0.7 * k, C.mint, 0.35);
    }
    ctx.restore();
  }

  // ----- Beta 1.7 M5: Sternenharz drill station – a cute pumpjack (nods only while it pumps) and a pink resin tank
  // whose level is the real tank fill; a bigger tank and a second pump from Lv 10, a glowing pipe from Lv 25.
  function resinDrill(ctx, x, y, k, o) {
    const level = o.level || 0,
      t = o.time || 0,
      fill = Math.max(0, Math.min(1, o.fill || 0)),
      nod = o.active && !o.reduced ? Math.sin(t * 2.2) * 0.22 : 0;
    shadow(ctx, x, y, 3.4 * k, k);
    // the pumpjack: a frame, the walking beam and its horse head
    poly(ctx, [[x - 1.5 * k, y], [x - 1.05 * k, y - 1.15 * k], [x - 0.6 * k, y]], '#7f6ad8');
    ctx.save();
    ctx.translate(x - 1.05 * k, y - 1.15 * k);
    ctx.rotate(nod);
    fillRR(ctx, -0.95 * k, -0.08 * k, 1.75 * k, 0.16 * k, 0.06 * k, '#c4b3ff');
    fillRR(ctx, -1.15 * k, -0.22 * k, 0.32 * k, 0.5 * k, 0.12 * k, '#ff9ecb');
    ctx.restore();
    line(ctx, x - 2.05 * k, y - 1.15 * k + Math.sin(nod) * 0.95 * k, x - 2.05 * k, y, 0.05 * k, '#4a4f78');
    // the tank: a glass cylinder, filled to the real level with glowing pink resin
    const tw = (level >= 10 ? 1.3 : 1.05) * k,
      th = (level >= 10 ? 1.5 : 1.2) * k,
      tx = x + 0.15 * k;
    fillRR(ctx, tx, y - th, tw, th, 0.25 * k, 'rgba(232,228,250,0.35)');
    if (fill > 0) fillRR(ctx, tx + 0.06 * k, y - 0.06 * k - (th - 0.12 * k) * fill, tw - 0.12 * k, (th - 0.12 * k) * fill, 0.18 * k, '#ff8fc6');
    glow(ctx, tx + tw / 2, y - th * 0.4, 0.7 * k, '#ff9ecb', 0.25 + fill * 0.35);
    ctx.strokeStyle = '#e8e4fa';
    ctx.lineWidth = 0.05 * k;
    ctx.strokeRect(tx, y - th, tw, th);
    // the pipe from the pump to the tank (glows from Lv 25)
    line(ctx, x - 0.6 * k, y - 0.15 * k, tx, y - 0.15 * k, 0.09 * k, level >= 25 ? '#ffd77a' : '#4a4f78');
    if (level >= 10) {
      poly(ctx, [[x + 1.65 * k, y], [x + 1.95 * k, y - 0.7 * k], [x + 2.25 * k, y]], '#7f6ad8');
      fillRR(ctx, x + 1.6 * k, y - 0.82 * k, 0.75 * k, 0.12 * k, 0.05 * k, '#c4b3ff');
    }
    plaque(ctx, x, y + 0.18 * k, k, level ? 'Harzbohrturm Lv ' + level : 'Harzbohrturm', '#ff9ecb');
    return { x0: x - 2.2 * k, y0: y - 1.8 * k, x1: x + 2.3 * k, y1: y + 0.5 * k };
  }

  // ----- Beta 1.7 M2: Packstation – a sorting table with a belt, a crate stack by real fill, a sign; it grows a roof
  // at Lv 10 and a second belt at Lv 25. o: { level, fill 0..1 (packed / capacity), active, time, reduced }
  function packStation(ctx, x, y, k, o) {
    const level = o.level || 0,
      t = o.time || 0,
      fill = Math.max(0, Math.min(1, o.fill || 0));
    shadow(ctx, x, y, 2.2 * k, k);
    // the table and its belt (moves only while the station really packs)
    fillRR(ctx, x - 0.85 * k, y - 0.62 * k, 1.1 * k, 0.12 * k, 0.04 * k, '#4a4f78');
    line(ctx, x - 0.75 * k, y - 0.5 * k, x - 0.75 * k, y, 0.08 * k, '#2f3170');
    line(ctx, x + 0.15 * k, y - 0.5 * k, x + 0.15 * k, y, 0.08 * k, '#2f3170');
    ctx.save();
    ctx.setLineDash([0.12 * k, 0.12 * k]);
    ctx.lineDashOffset = o.active && !o.reduced ? -t * 0.8 * k : 0;
    line(ctx, x - 0.8 * k, y - 0.66 * k, x + 0.2 * k, y - 0.66 * k, 0.05 * k, '#ffd77a');
    ctx.restore();
    // a crate in the making on the belt while packing
    if (o.active) crate(ctx, x - 0.75 * k + ((t * 0.35) % 1) * 0.9 * k, y - 0.68 * k, 0.22 * k, '#ffd77a', '#c98a2a');
    // the stack of packed crates (0–6 by the real fill)
    const n = Math.round(fill * 6);
    for (let i = 0; i < n; i++) {
      const row = i < 3 ? 0 : i < 5 ? 1 : 2,
        col = [i, i - 3, i - 5][row];
      crate(ctx, x + 0.5 * k + col * 0.32 * k + row * 0.16 * k, y - row * 0.3 * k, 0.3 * k, i % 2 ? '#ffc08a' : '#ffd77a', '#c98a2a');
    }
    if (level >= 10) {
      // a little awning over the table
      poly(ctx, [[-1.05 * k + x, y - 1.2 * k], [0.4 * k + x, y - 1.2 * k], [0.55 * k + x, y - 0.95 * k], [-1.2 * k + x, y - 0.95 * k]], '#8fe3ff');
      line(ctx, x - 1.0 * k, y - 0.95 * k, x - 1.0 * k, y - 0.1 * k, 0.06 * k, '#2f3170');
    }
    if (level >= 25) line(ctx, x - 0.8 * k, y - 0.32 * k, x + 0.2 * k, y - 0.32 * k, 0.05 * k, '#ffd77a');
    plaque(ctx, x, y + 0.18 * k, k, level ? 'Packstation Lv ' + level : 'Packstation', '#ffd77a');
    return { x0: x - 1.2 * k, y0: y - 1.3 * k, x1: x + 1.3 * k, y1: y + 0.5 * k };
  }

  // ----- Storage: crate yard (1) → depot shed (10) → warehouse (25) → automated high-bay (50) -----
  function depot(ctx, x, y, k, o) {
    const level = o.level,
      t = o.time,
      fill = Math.max(0, Math.min(1, o.fill || 0)),
      full = fill >= 0.92;
    shadow(ctx, x, y, 3.6 * k, k);
    const crates = Math.round(fill * 12),
      crateRow = (cx, cy, n) => {
        for (let i = 0; i < n; i++) {
          const row = i < 4 ? 0 : i < 7 ? 1 : i < 9 ? 2 : 3,
            col = [i, i - 4, i - 7, i - 9][row];
          crate(ctx, cx + col * 0.4 * k + row * 0.2 * k, cy - row * 0.38 * k, 0.38 * k, full && Math.sin(t * 8) > 0 ? '#ff9e9e' : i % 3 ? '#ffd77a' : '#ffc08a');
        }
      };
    if (level < 10) {
      // open yard: pallet, fence, sign, crates by real stock
      fillRR(ctx, x - 1.5 * k, y - 0.12 * k, 3 * k, 0.12 * k, 0.04 * k, C.woodDark);
      for (let i = 0; i < 6; i++) line(ctx, x - 1.6 * k + i * 0.64 * k, y, x - 1.6 * k + i * 0.64 * k, y - 0.55 * k, 0.07 * k, C.wood);
      line(ctx, x - 1.6 * k, y - 0.45 * k, x + 1.6 * k, y - 0.45 * k, 0.06 * k, C.wood);
      crateRow(x - 1.25 * k, y - 0.12 * k, Math.min(10, crates));
      plaque(ctx, x, y + 0.18 * k, k, 'Lager Lv ' + level, '#c4b3ff');
      return { x0: x - 1.8 * k, y0: y - 1.8 * k, x1: x + 1.8 * k, y1: y + 0.6 * k };
    }
    const big = level >= 25,
      bay = level >= 50,
      w = bay ? 3.4 * k : big ? 3 * k : 2.4 * k,
      hgt = bay ? 2.9 * k : big ? 2 * k : 1.35 * k;
    // Living Worlds 2.0: a loading dock in front (raised deck with bumpers) — the warehouse reads without its label
    fillRR(ctx, x - w / 2 - 0.5 * k, y - 0.32 * k, w + 1 * k, 0.32 * k, 0.05 * k, '#8f88b8');
    fillRR(ctx, x - w / 2 - 0.5 * k, y - 0.34 * k, w + 1 * k, 0.07 * k, 0.03 * k, '#c9c2f0');
    for (let i = 0; i < 4; i++) fillRR(ctx, x - w / 2 - 0.35 * k + i * ((w + 0.7 * k) / 3), y - 0.27 * k, 0.12 * k, 0.18 * k, 0.04 * k, '#2f3170');
    box(ctx, x, y - 0.3 * k, w, hgt - 0.3 * k, 0.45 * k, ...materials(o.theme).wall);
    // corrugated wall
    for (let xx = x - w / 2 + 0.18 * k; xx < x + w / 2 - 0.1 * k; xx += 0.22 * k) line(ctx, xx, y - hgt + 0.12 * k, xx, y - 0.34 * k, 0.025 * k, 'rgba(120,110,170,0.22)');
    // a pitched warehouse roof with its gable emblem (a crate)
    poly(ctx, [[x - w / 2 - 0.12 * k, y - hgt], [x, y - hgt - (big ? 0.85 : 0.6) * k], [x + w / 2 + 0.12 * k, y - hgt]], o.theme.accent);
    line(ctx, x - w / 2 - 0.12 * k, y - hgt, x, y - hgt - (big ? 0.85 : 0.6) * k, 0.06 * k, 'rgba(255,255,255,0.55)');
    crate(ctx, x, y - hgt - 0.12 * k, (big ? 0.34 : 0.28) * k, '#ffd77a', '#c98a3a');
    // rolling door with crates inside (fill-dependent)
    const dw = w * 0.42,
      dh = (hgt - 0.3 * k) * 0.62;
    fillRR(ctx, x - dw / 2, y - 0.32 * k - dh, dw, dh, 0.06 * k, '#4a4f86');
    for (let i = 1; i < 4; i++) line(ctx, x - dw / 2, y - 0.32 * k - dh + i * 0.12 * k, x + dw / 2, y - 0.32 * k - dh + i * 0.12 * k, 0.03 * k, 'rgba(255,255,255,0.25)');
    // the real stock stands on the loading dock as crates
    crateRow(x - w / 2 - 0.3 * k, y - 0.32 * k, Math.min(9, crates));
    // fill gauge on the facade: the real stock level
    const gx = x + w / 2 - 0.45 * k,
      gh = hgt * 0.62;
    fillRR(ctx, gx, y - gh - 0.45 * k, 0.24 * k, gh, 0.08 * k, '#2f3170');
    fillRR(ctx, gx + 0.04 * k, y - 0.49 * k - (gh - 0.08 * k) * fill, 0.16 * k, (gh - 0.08 * k) * fill, 0.05 * k, full ? '#ff8f8f' : C.mint);
    windowPane(ctx, x - w / 2 + 0.25 * k, y - hgt + 0.3 * k, 0.45 * k, 0.3 * k, true, t);
    if (bay) {
      // robotic gantry moving crates while goods arrive
      line(ctx, x - w / 2, y - hgt - 0.6 * k, x + w / 2, y - hgt - 0.6 * k, 0.14 * k, C.metalDark);
      const g = o.active ? (Math.sin(t * 1.2) + 1) / 2 : 0.3,
        gxp = x - w / 2 + 0.3 * k + g * (w - 0.6 * k);
      fillRR(ctx, gxp - 0.25 * k, y - hgt - 0.75 * k, 0.5 * k, 0.3 * k, 0.08 * k, C.hazard);
      line(ctx, gxp, y - hgt - 0.45 * k, gxp, y - hgt + 0.1 * k, 0.04 * k, C.ink);
      crate(ctx, gxp, y - hgt + 0.45 * k, 0.36 * k);
      // silos
      [0, 1].forEach(i => {
        const sx = x + w / 2 + 0.55 * k + i * 0.62 * k;
        fillRR(ctx, sx - 0.28 * k, y - 2.2 * k, 0.56 * k, 2.2 * k, 0.28 * k, i ? '#d9d3f5' : '#c4bfe6');
        fillRR(ctx, sx - 0.28 * k, y - 2.2 * k + (1 - fill) * 1.8 * k, 0.56 * k, 0.08 * k, 0.04 * k, o.theme.accent);
      });
    }
    if (full) glow(ctx, x, y - hgt - 0.3 * k, 0.4 * k, '#ff8f8f', 0.55 + Math.sin(t * 8) * 0.3);
    plaque(ctx, x, y + 0.18 * k, k, 'Lager Lv ' + level, '#c4b3ff');
    return { x0: x - w / 2 - 0.2 * k, y0: y - hgt - 0.9 * k, x1: x + w / 2 + (bay ? 1.5 : 0.5) * k, y1: y + 0.6 * k };
  }

  // ----- Refinery: workshop (1) → refinery tower (10) → multi-stage plant (25) -----
  function refinery(ctx, x, y, k, o) {
    const level = o.level,
      t = o.time,
      active = o.active;
    shadow(ctx, x, y, 3.4 * k, k);
    const big = level >= 10,
      plant = level >= 25;
    const w = plant ? 2.2 * k : big ? 1.9 * k : 1.6 * k,
      hgt = plant ? 1.7 * k : big ? 1.45 * k : 1.05 * k;
    // Living Worlds 2.0: a concrete foundation the whole plant stands on
    fillRR(ctx, x - w / 2 - 1.25 * k, y - 0.18 * k, w + 2.5 * k, 0.18 * k, 0.04 * k, '#8f88b8');
    // hopper on a steel frame against the hall, its chute feeding the furnace (real fill level)
    const hx = x - w / 2 - 0.55 * k;
    line(ctx, hx - 0.32 * k, y - 0.18 * k, hx - 0.22 * k, y - 1.15 * k, 0.07 * k, C.metalDark);
    line(ctx, hx + 0.32 * k, y - 0.18 * k, hx + 0.22 * k, y - 1.15 * k, 0.07 * k, C.metalDark);
    line(ctx, hx - 0.28 * k, y - 0.6 * k, hx + 0.28 * k, y - 0.6 * k, 0.05 * k, C.metalDark);
    poly(ctx, [[hx - 0.5 * k, y - 1.75 * k], [hx + 0.5 * k, y - 1.75 * k], [hx + 0.16 * k, y - 1.12 * k], [hx - 0.16 * k, y - 1.12 * k]], C.metal);
    const hf = Math.max(0, Math.min(1, o.hopper || 0));
    if (hf > 0) poly(ctx, [[hx - 0.42 * k * Math.max(0.4, hf), y - 1.7 * k + (1 - hf) * 0.35 * k], [hx + 0.42 * k * Math.max(0.4, hf), y - 1.7 * k + (1 - hf) * 0.35 * k], [hx + 0.14 * k, y - 1.2 * k], [hx - 0.14 * k, y - 1.2 * k]], o.theme.accent);
    poly(ctx, [[hx + 0.1 * k, y - 1.16 * k], [x - w / 2, y - hgt * 0.62], [x - w / 2, y - hgt * 0.62 + 0.16 * k], [hx + 0.1 * k, y - 1.0 * k]], C.metalDark);
    // main hall with hazard stripes along its base
    box(ctx, x, y - 0.18 * k, w, hgt - 0.18 * k, 0.4 * k, ...materials(o.theme).hall);
    fillRR(ctx, x - w / 2, y - hgt, w, 0.14 * k, 0.04 * k, o.theme.accent);
    if (typeof hazard === 'function') hazard(ctx, x - w / 2, y - 0.34 * k, w, 0.12 * k);
    // furnace window: glows only while processing
    ctx.fillStyle = active ? '#ffb35a' : '#4a4f86';
    ctx.beginPath();
    ctx.arc(x, y - hgt * 0.45, 0.3 * k, 0, TAU);
    ctx.fill();
    if (active) glow(ctx, x, y - hgt * 0.45, 0.75 * k, '#ffb35a', 0.5 + Math.sin(t * 8) * 0.18);
    // chimneys + smoke
    const chimneys = plant ? 2 : 1;
    for (let i = 0; i < chimneys; i++) {
      const cx = x + w / 2 - 0.35 * k - i * 0.6 * k,
        ch = (big ? 1.4 : 0.9) * k;
      const M = materials(o.theme).hall;
      fillRR(ctx, cx - 0.16 * k, y - hgt - ch, 0.32 * k, ch, 0.06 * k, M[2]);
      fillRR(ctx, cx - 0.2 * k, y - hgt - ch, 0.4 * k, 0.12 * k, 0.04 * k, M[0]);
      if (active) steam(ctx, cx, y - hgt - ch - 0.1 * k, k, t + i);
    }
    if (big) {
      // pipe to a crucible tank
      const tx = x + w / 2 + 0.6 * k;
      fillRR(ctx, tx - 0.35 * k, y - 1.3 * k, 0.7 * k, 1.3 * k, 0.3 * k, materials(o.theme).hall[1]);
      fillRR(ctx, tx - 0.35 * k, y - 0.7 * k, 0.7 * k, 0.12 * k, 0.05 * k, active ? '#ffb35a' : C.metalDark);
      line(ctx, x + w / 2, y - hgt * 0.7, tx, y - 1.1 * k, 0.12 * k, active ? '#ffcf8a' : C.metal);
    }
    if (plant) {
      conveyor(ctx, x - w / 2, y - 0.35 * k, x - 1.15 * k, y - 0.35 * k, k, active, t, o.theme.accent);
      gear(ctx, x - w / 2 + 0.35 * k, y - hgt + 0.45 * k, 0.2 * k, active ? t * 3 : 0, C.metalDark);
    }
    // bars produced (real stock)
    const bars = Math.round(Math.max(0, Math.min(1, o.bars || 0)) * 6),
      bx = x + w / 2 + (big ? 1.15 : 0.35) * k;
    for (let i = 0; i < bars; i++) fillRR(ctx, bx + (i % 3) * 0.26 * k, y - 0.14 * k - Math.floor(i / 3) * 0.16 * k, 0.24 * k, 0.13 * k, 0.03 * k, i % 2 ? '#ffe38a' : '#ffd23a');
    plaque(ctx, x, y + 0.18 * k, k, 'Raffinerie Lv ' + level, '#ffb35a');
    return { x0: x - 2 * k, y0: y - hgt - 1.5 * k, x1: x + w / 2 + 1.6 * k, y1: y + 0.6 * k };
  }

  // ----- Trade: market stall (1) → trade booth (10) → commercial outpost (25) → trading station (50) -----
  function stall(ctx, x, y, k, o) {
    const level = o.level,
      t = o.time,
      fill = Math.max(0, Math.min(1, o.fill || 0));
    shadow(ctx, x, y, 3.2 * k, k);
    const awning = (ax, ay, w, colors) => {
      const n = 6;
      for (let i = 0; i < n; i++) {
        const sx = ax - w / 2 + (i * w) / n;
        ctx.fillStyle = colors[i % 2];
        ctx.beginPath();
        ctx.moveTo(sx, ay);
        ctx.lineTo(sx + w / n, ay);
        ctx.lineTo(sx + w / n, ay + 0.28 * k);
        ctx.quadraticCurveTo(sx + w / n / 2, ay + 0.42 * k, sx, ay + 0.28 * k);
        ctx.closePath();
        ctx.fill();
      }
    };
    const goods = (gx, gy, n) => {
      for (let i = 0; i < n; i++) crystal(ctx, gx + i * 0.3 * k, gy, 0.26 * k, i % 2 ? o.theme.accent : '#fff4ff', 0);
    };
    let top;
    if (level >= 25) {
      // building behind: outpost (25) or domed trading station (50)
      if (level >= 50) {
        // Sternenmarkt station: base ring, glass dome with ribs, arch, antenna dish, holo sign
        fillRR(ctx, x - 2.1 * k, y - 1.15 * k, 4.2 * k, 1.15 * k, 0.12 * k, '#d9d3f5');
        const dome = ctx.createLinearGradient(0, y - 3.1 * k, 0, y - 1.1 * k);
        dome.addColorStop(0, 'rgba(200,240,255,0.95)');
        dome.addColorStop(1, 'rgba(160,190,255,0.75)');
        ctx.fillStyle = dome;
        ctx.beginPath();
        ctx.ellipse(x, y - 1.15 * k, 2 * k, 1.95 * k, 0, Math.PI, 0);
        ctx.fill();
        for (let i = 1; i < 5; i++) {
          ctx.strokeStyle = 'rgba(255,255,255,0.55)';
          ctx.lineWidth = 0.05 * k;
          ctx.beginPath();
          ctx.ellipse(x, y - 1.15 * k, 2 * k * (i / 5), 1.95 * k, 0, Math.PI, 0);
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.ellipse(x - 0.9 * k, y - 2.3 * k, 0.5 * k, 0.22 * k, -0.5, 0, TAU);
        ctx.fill();
        fillRR(ctx, x - 0.95 * k, y - 3.6 * k, 1.9 * k, 0.5 * k, 0.16 * k, 'rgba(29,33,80,0.85)');
        ctx.fillStyle = C.mint;
        ctx.font = `900 ${Math.round(0.26 * k)}px Nunito, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('STERNENMARKT', x, y - 3.27 * k);
        ctx.textAlign = 'left';
        glow(ctx, x, y - 3.35 * k, 1 * k, C.mint, 0.18 + Math.sin(t * 2) * 0.05);
        line(ctx, x + 1.75 * k, y - 1.1 * k, x + 1.75 * k, y - 2.9 * k, 0.07 * k, C.steel);
        ctx.fillStyle = '#e8e4fa';
        ctx.beginPath();
        ctx.ellipse(x + 1.75 * k, y - 2.95 * k, 0.35 * k, 0.16 * k, -0.4, 0, TAU);
        ctx.fill();
        glow(ctx, x + 1.75 * k, y - 3.05 * k, 0.12 * k, Math.sin(t * 3) > 0 ? C.mint : C.pink, 1);
        [-1.7, 1.4].forEach(dx => windowPane(ctx, x + dx * k, y - 0.95 * k, 0.4 * k, 0.4 * k, true, t + dx));
      } else {
        box(ctx, x, y, 3.4 * k, 2 * k, 0.4 * k, '#e8e4fa', '#ffffff', '#c4bfe6');
        windowPane(ctx, x - 1.4 * k, y - 1.75 * k, 0.9 * k, 0.6 * k, true, t);
        windowPane(ctx, x + 0.5 * k, y - 1.75 * k, 0.9 * k, 0.6 * k, true, t + 1);
        plaque(ctx, x, y - 2.45 * k, k, 'HANDELSKONTOR', '#ffd23a');
      }
      top = y - 1.1 * k;
      awning(x, top, 3 * k, ['#ff9ecb', '#ffffff']);
      // display counter: glass front with lit goods, wooden base with panels
      fillRR(ctx, x - 1.4 * k, y - 0.62 * k, 2.8 * k, 0.62 * k, 0.1 * k, '#b98a5e');
      for (let i = 0; i < 4; i++) fillRR(ctx, x - 1.3 * k + i * 0.68 * k, y - 0.5 * k, 0.6 * k, 0.4 * k, 0.06 * k, '#c99a6a');
      fillRR(ctx, x - 1.4 * k, y - 0.9 * k, 2.8 * k, 0.3 * k, 0.08 * k, 'rgba(200,240,255,0.55)');
      goods(x - 1.1 * k, y - 0.66 * k, Math.round(fill * 7));
      crate(ctx, x - 1.75 * k, y, 0.45 * k);
      crate(ctx, x + 1.75 * k, y, 0.4 * k, '#c4b3ff', '#7f6ad8');
    } else if (level >= 10) {
      // trade booth: wooden kiosk with roof, display shelf, scale, banner
      box(ctx, x, y, 2.6 * k, 1.5 * k, 0.35 * k, '#d9b48a', '#f0d2a8', '#b98a5e');
      poly(ctx, [[x - 1.6 * k, y - 1.5 * k], [x, y - 2.3 * k], [x + 1.6 * k, y - 1.5 * k]], '#ff9ecb');
      fillRR(ctx, x - 1.1 * k, y - 1.3 * k, 2.2 * k, 0.6 * k, 0.08 * k, '#4a4f86');
      goods(x - 0.9 * k, y - 0.82 * k, Math.round(fill * 7));
      line(ctx, x + 1.45 * k, y, x + 1.45 * k, y - 2 * k, 0.06 * k, C.woodDark);
      poly(ctx, [[x + 1.45 * k, y - 2 * k], [x + 2.05 * k, y - 1.85 * k], [x + 1.45 * k, y - 1.65 * k]], C.mint);
      top = y - 1.5 * k;
    } else {
      // hand-built market stall
      line(ctx, x - 1.1 * k, y, x - 1.1 * k, y - 1.6 * k, 0.09 * k, C.woodDark);
      line(ctx, x + 1.1 * k, y, x + 1.1 * k, y - 1.6 * k, 0.09 * k, C.woodDark);
      awning(x, y - 1.7 * k, 2.5 * k, ['#ff9ecb', '#ffffff']);
      fillRR(ctx, x - 1.15 * k, y - 0.62 * k, 2.3 * k, 0.62 * k, 0.08 * k, C.wood);
      for (let i = 0; i < 3; i++) line(ctx, x - 1.1 * k, y - 0.5 * k + i * 0.18 * k, x + 1.1 * k, y - 0.5 * k + i * 0.18 * k, 0.03 * k, C.woodDark);
      goods(x - 0.9 * k, y - 0.7 * k, Math.round(fill * 6));
      crate(ctx, x + 1.45 * k, y, 0.45 * k);
      top = y - 1.7 * k;
    }
    if (o.saleGlow > 0) glow(ctx, x, y - 0.9 * k, 1 * k, C.warm, o.saleGlow * 0.6);
    plaque(ctx, x, y + 0.18 * k, k, 'Verkauf Lv ' + level, C.warm);
    return { x0: x - 1.9 * k, y0: top - 0.6 * k, x1: x + 2.1 * k, y1: y + 0.6 * k, counter: { x0: x - 1.1 * k, y0: y - 0.8 * k, x1: x + 1.1 * k, y1: y } };
  }

  // ----- Residences: cat-eared domes, more and bigger with level; snow caps on cold worlds -----
  function hut(ctx, x, y, k, o) {
    const level = o.level,
      t = o.time,
      count = level >= 25 ? 3 : level >= 10 ? 2 : 1,
      cold = o.cold;
    for (let i = 0; i < count; i++) {
      const hx = x + (i - (count - 1) / 2) * 1.35 * k,
        s = (i === Math.floor(count / 2) && level >= 25 ? 1.25 : 1) * k;
      shadow(ctx, hx, y, 1.3 * s, k);
      ctx.fillStyle = cold ? '#f2fbff' : '#f7f5ff';
      ctx.beginPath();
      ctx.moveTo(hx - 0.6 * s, y);
      ctx.lineTo(hx - 0.6 * s, y - 0.4 * s);
      ctx.quadraticCurveTo(hx - 0.6 * s, y - 1.0 * s, hx, y - 1.0 * s);
      ctx.quadraticCurveTo(hx + 0.6 * s, y - 1.0 * s, hx + 0.6 * s, y - 0.4 * s);
      ctx.lineTo(hx + 0.6 * s, y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = o.theme.accent;
      ctx.beginPath();
      ctx.moveTo(hx - 0.66 * s, y - 0.45 * s);
      ctx.quadraticCurveTo(hx - 0.62 * s, y - 1.12 * s, hx, y - 1.12 * s);
      ctx.quadraticCurveTo(hx + 0.62 * s, y - 1.12 * s, hx + 0.66 * s, y - 0.45 * s);
      ctx.quadraticCurveTo(hx, y - 0.72 * s, hx - 0.66 * s, y - 0.45 * s);
      ctx.fill();
      [-0.42, 0.18].forEach(ex => poly(ctx, [[hx + ex * s, y - 0.98 * s], [hx + (ex + 0.12) * s, y - 1.32 * s], [hx + (ex + 0.26) * s, y - 0.98 * s]], o.theme.accent));
      if (cold) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(hx, y - 1.08 * s, 0.5 * s, 0.1 * s, 0, 0, TAU);
        ctx.fill();
      }
      windowPane(ctx, hx - 0.38 * s, y - 0.62 * s, 0.24 * s, 0.24 * s, o.warm !== false, t + i);
      fillRR(ctx, hx + 0.08 * s, y - 0.42 * s, 0.26 * s, 0.42 * s, 0.12 * s, '#c4b3ff');
      if (level >= 25 && i === Math.floor(count / 2)) {
        line(ctx, hx + 0.45 * s, y - 1.0 * s, hx + 0.45 * s, y - 1.7 * s, 0.04 * k, C.woodDark);
        poly(ctx, [[hx + 0.45 * s, y - 1.7 * s], [hx + 0.85 * s, y - 1.6 * s], [hx + 0.45 * s, y - 1.48 * s]], C.pink);
      }
    }
    plaque(ctx, x, y + 0.18 * k, k, 'Helfer Lv ' + level, '#fff4e2');
    return { x0: x - (count * 0.7 + 0.2) * k, y0: y - 1.8 * k, x1: x + (count * 0.7 + 0.2) * k, y1: y + 0.6 * k };
  }

  // ----- Cargo dock: landing pad (1), crane (5), hangar (15), control tower (30) -----
  function dock(ctx, x, y, k, o) {
    const level = o.level,
      t = o.time;
    ctx.fillStyle = '#c9c2f0';
    ctx.beginPath();
    ctx.ellipse(x, y - 0.05 * k, 1.8 * k, 0.36 * k, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = o.theme.accent;
    ctx.lineWidth = 0.07 * k;
    ctx.beginPath();
    ctx.ellipse(x, y - 0.05 * k, 1.3 * k, 0.24 * k, 0, 0, TAU);
    ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU,
        on = o.active && Math.floor(t * 4) % 8 === i;
      glow(ctx, x + Math.cos(a) * 1.6 * k, y - 0.05 * k + Math.sin(a) * 0.32 * k, 0.08 * k, on ? C.mint : '#a9a3d8', 0.9);
    }
    line(ctx, x + 2 * k, y, x + 2 * k, y - 1.8 * k, 0.07 * k, '#e8e4fa');
    glow(ctx, x + 2 * k, y - 1.85 * k, 0.15 * k, Math.sin(t * 3) > 0 ? C.mint : C.pink, 1);
    if (level >= 5) {
      line(ctx, x - 2.1 * k, y, x - 2.1 * k, y - 2.1 * k, 0.12 * k, C.hazard);
      line(ctx, x - 2.2 * k, y - 2.1 * k, x - 0.9 * k, y - 2.1 * k, 0.12 * k, C.hazard);
      const swing = o.active ? Math.sin(t * 1.5) * 0.2 * k : 0;
      line(ctx, x - 1.1 * k + swing, y - 2.1 * k, x - 1.1 * k + swing, y - 1.3 * k, 0.03 * k, C.ink);
      crate(ctx, x - 1.1 * k + swing, y - 0.95 * k, 0.36 * k);
    }
    if (level >= 15) {
      ctx.fillStyle = '#e8e4fa';
      ctx.beginPath();
      ctx.arc(x - 3.4 * k, y, 1.2 * k, Math.PI, 0);
      ctx.fill();
      fillRR(ctx, x - 3.9 * k, y - 0.7 * k, 1 * k, 0.7 * k, 0.1 * k, '#4a4f86');
    }
    if (level >= 30) {
      box(ctx, x + 2.8 * k, y, 0.8 * k, 2.4 * k, 0.25 * k, '#e8e4fa', '#ffffff', '#c4bfe6');
      windowPane(ctx, x + 2.5 * k, y - 2.3 * k, 0.6 * k, 0.35 * k, true, t);
    }
    if (o.queue)
      for (let i = 0; i < 6; i++) crate(ctx, x - 0.9 * k + (i % 3) * 0.4 * k, y - Math.floor(i / 3) * 0.38 * k, 0.36 * k, i % 2 ? '#ffc08a' : '#ffd77a');
    plaque(ctx, x, y + 0.36 * k, k, 'Frachtdock Lv ' + level, C.mint);
    return { x0: x - 2.4 * k, y0: y - 2.4 * k, x1: x + 2.4 * k, y1: y + 0.8 * k };
  }

  // ----- Landmark: space elevator by development stage -----
  function elevator(ctx, x, y, k, o) {
    const stage = o.stage,
      t = o.time;
    if (stage < 2) {
      lamp(ctx, x, y, k, true, t);
      return null;
    }
    ctx.fillStyle = '#c9c2f0';
    ctx.beginPath();
    ctx.ellipse(x, y, 1.1 * k, 0.24 * k, 0, 0, TAU);
    ctx.fill();
    if (stage >= 3) {
      const top = stage >= 4 ? -k : y - 3 * k;
      line(ctx, x - 0.4 * k, y, x - 0.15 * k, top, 0.07 * k, '#e8e4fa');
      line(ctx, x + 0.4 * k, y, x + 0.15 * k, top, 0.07 * k, '#e8e4fa');
      for (let yy = y - 0.5 * k; yy > top; yy -= 0.55 * k) line(ctx, x - 0.32 * k, yy, x + 0.32 * k, yy - 0.28 * k, 0.04 * k, '#e8e4fa');
    }
    if (stage >= 4) {
      const p = (Math.sin(t * 0.5) + 1) / 2,
        cy = y - 0.5 * k - p * (y - k);
      fillRR(ctx, x - 0.3 * k, cy - 0.25 * k, 0.6 * k, 0.5 * k, 0.15 * k, o.theme.accent);
      glow(ctx, x, cy, 0.4 * k, o.theme.glow, 0.5);
    }
    if (stage >= 5) {
      ctx.strokeStyle = 'rgba(255,215,122,0.9)';
      ctx.lineWidth = 0.07 * k;
      ctx.beginPath();
      ctx.ellipse(x, 0.6 * k, 0.9 * k, 0.24 * k, 0, 0, TAU);
      ctx.stroke();
    }
    plaque(ctx, x, y + 0.36 * k, k, ['', '', 'Orbitallift · Fundament', 'Orbitallift · Streben', 'Orbitallift aktiv', 'Orbitallift'][stage], '#fff4e2');
    return null;
  }

  // ----- Glacies: Frostquarz-Bohrer and Thermalwerkstatt -----
  function frostDrill(ctx, x, y, k, o) {
    const level = o.level,
      t = o.time,
      working = o.active,
      frozen = o.frozen;
    shadow(ctx, x, y, 3.2 * k, k);
    // frost quartz vein in the cliff
    for (let i = 0; i < 4; i++) crystal(ctx, x + 0.9 * k + i * 0.32 * k, y - 0.3 * k, (0.5 + (i % 2) * 0.2) * k, '#9fe8ff', (i - 1.5) * 0.25);
    glow(ctx, x + 1.3 * k, y - 0.6 * k, 0.9 * k, '#c8fbff', 0.35);
    const big = level >= 10;
    box(ctx, x - 0.5 * k, y, big ? 1.6 * k : 1.2 * k, big ? 1.4 * k : 1 * k, 0.35 * k, '#e9f7ff', '#ffffff', '#bfe3f2');
    fillRR(ctx, x - 1.3 * k + (big ? 0 : 0.2 * k), y - (big ? 1.4 : 1) * k - 0.12 * k, (big ? 1.6 : 1.2) * k, 0.18 * k, 0.06 * k, '#8fe3ff');
    windowPane(ctx, x - 1 * k, y - (big ? 1.05 : 0.8) * k, 0.4 * k, 0.28 * k, !frozen, t);
    // cryo drill arm
    const reach = working ? Math.sin(t * 7) * 0.05 * k : 0;
    line(ctx, x + 0.25 * k, y - 0.8 * k, x + 0.85 * k + reach, y - 0.55 * k, 0.14 * k, C.metalDark);
    poly(ctx, [[x + 0.8 * k + reach, y - 0.7 * k], [x + 1.2 * k + reach, y - 0.55 * k], [x + 0.8 * k + reach, y - 0.4 * k]], '#c8fbff');
    if (working) for (let i = 0; i < 2; i++) glow(ctx, x + 1.15 * k + reach, y - 0.55 * k, (0.2 + i * 0.15) * k, '#e8fdff', 0.4);
    if (big) {
      line(ctx, x - 0.9 * k, y - 1.4 * k, x - 0.9 * k, y - 2.4 * k, 0.08 * k, C.steel);
      glow(ctx, x - 0.9 * k, y - 2.45 * k, 0.14 * k, working ? '#8ff0d4' : '#5a5f8a', 1);
    }
    if (frozen) icicles(ctx, x - 1.3 * k, y - (big ? 1.5 : 1.1) * k, (big ? 1.6 : 1.2) * k, k, t);
    // frost quartz stock crates
    const stock = Math.round(Math.max(0, Math.min(1, o.fill || 0)) * 6);
    for (let i = 0; i < stock; i++) crate(ctx, x - 2 * k + (i % 3) * 0.38 * k, y - Math.floor(i / 3) * 0.36 * k, 0.34 * k, '#bfefff', '#6fb6c9');
    plaque(ctx, x, y + 0.18 * k, k, 'Frostquarz Lv ' + level, '#9fe8ff');
    return { x0: x - 2.3 * k, y0: y - 2.6 * k, x1: x + 2.2 * k, y1: y + 0.6 * k };
  }
  function thermalWorkshop(ctx, x, y, k, o) {
    const level = o.level,
      t = o.time,
      active = o.active,
      heated = o.heated;
    shadow(ctx, x, y, 3.4 * k, k);
    const w = level >= 10 ? 2.3 * k : 1.9 * k,
      hgt = level >= 10 ? 1.6 * k : 1.25 * k;
    box(ctx, x, y, w, hgt, 0.4 * k, '#fff1e6', '#ffffff', '#f0cdb6');
    ctx.fillStyle = '#ff9e5a';
    ctx.beginPath();
    ctx.ellipse(x, y - hgt, w / 2 + 0.05 * k, 0.32 * k, 0, Math.PI, 0);
    ctx.fill();
    // thermal core: glows when processing
    fillRR(ctx, x - 0.35 * k, y - hgt * 0.75, 0.7 * k, hgt * 0.55, 0.18 * k, active ? '#ffb35a' : '#6a5a7a');
    if (active) glow(ctx, x, y - hgt * 0.5, 0.9 * k, '#ffb35a', 0.5 + Math.sin(t * 6) * 0.15);
    // heat pipes along the ground: orange when the heat network runs
    ctx.strokeStyle = heated ? `rgba(255,170,90,${0.75 + Math.sin(t * 3) * 0.15})` : '#7c86a8';
    ctx.lineWidth = 0.14 * k;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y - 0.3 * k);
    ctx.lineTo(x + w / 2 + 1.6 * k, y - 0.3 * k);
    ctx.lineTo(x + w / 2 + 1.6 * k, y + 0.05 * k);
    ctx.stroke();
    if (heated) glow(ctx, x + w / 2 + 0.8 * k, y - 0.3 * k, 0.5 * k, '#ffb35a', 0.3);
    // thermal cells produced (real stock)
    const cells = Math.round(Math.max(0, Math.min(1, o.fill || 0)) * 6);
    for (let i = 0; i < cells; i++) {
      const cx = x - w / 2 - 0.45 * k - (i % 3) * 0.3 * k,
        cy = y - Math.floor(i / 3) * 0.4 * k;
      fillRR(ctx, cx - 0.12 * k, cy - 0.36 * k, 0.24 * k, 0.36 * k, 0.08 * k, '#ffb35a');
      fillRR(ctx, cx - 0.08 * k, cy - 0.28 * k, 0.16 * k, 0.14 * k, 0.04 * k, '#fff3c4');
    }
    if (!heated) icicles(ctx, x - w / 2, y - hgt - 0.05 * k, w, k, t);
    plaque(ctx, x, y + 0.18 * k, k, 'Thermalwerkstatt Lv ' + level, '#ffb35a');
    return { x0: x - w / 2 - 1.1 * k, y0: y - hgt - 0.6 * k, x1: x + w / 2 + 1.7 * k, y1: y + 0.6 * k };
  }
  function icicles(ctx, x, y, w, k, t) {
    for (let i = 0; i < Math.floor(w / (0.22 * k)); i++) {
      const ix = x + 0.1 * k + i * 0.22 * k,
        len = (0.15 + ((i * 7) % 4) * 0.06) * k;
      poly(ctx, [[ix - 0.05 * k, y], [ix + 0.05 * k, y], [ix, y + len]], 'rgba(220,248,255,0.9)');
    }
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(x, y - 0.06 * k, w, 0.1 * k);
  }

  // ----- Environment -----
  // Distant settlement / skyline silhouettes (cached by the scene), drawn into an offscreen canvas.
  function skyline(ctx, width, baseY, k, kind, color, seed) {
    let s = seed;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    ctx.fillStyle = color;
    for (let x = 0; x < width; x += (1.4 + rnd() * 2.6) * k) {
      const h = (0.5 + rnd() * 1.4) * k;
      if (kind === 'icicles') {
        poly(ctx, [[x, baseY], [x + 0.35 * k, baseY - h * 1.3], [x + 0.7 * k, baseY]], color);
        if (rnd() > 0.6) poly(ctx, [[x + 0.6 * k, baseY], [x + 0.85 * k, baseY - h * 0.8], [x + 1.1 * k, baseY]], color);
      } else {
        ctx.beginPath();
        ctx.ellipse(x + 0.6 * k, baseY, 0.6 * k, h * 0.55, 0, Math.PI, 0);
        ctx.fill();
        if (rnd() > 0.55) {
          ctx.fillRect(x + 1.2 * k, baseY - h, 0.08 * k, h);
          glow(ctx, x + 1.24 * k, baseY - h, 0.08 * k, '#ffe9a8', 0.8);
        }
      }
    }
    ctx.fillRect(0, baseY, width, 2 * k);
  }
  function cavern(ctx, x, y, k, t, cold) {
    // ice/rock arch around the mine vein
    ctx.fillStyle = cold ? '#bfe9f6' : '#8a86c8';
    ctx.beginPath();
    ctx.moveTo(x - 2.2 * k, y);
    ctx.quadraticCurveTo(x - 2.4 * k, y - 3.1 * k, x, y - 3.2 * k);
    ctx.quadraticCurveTo(x + 2.4 * k, y - 3.1 * k, x + 2.2 * k, y);
    ctx.lineTo(x + 1.6 * k, y);
    ctx.quadraticCurveTo(x + 1.7 * k, y - 2.4 * k, x, y - 2.5 * k);
    ctx.quadraticCurveTo(x - 1.7 * k, y - 2.4 * k, x - 1.6 * k, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = cold ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.ellipse(x - 0.6 * k, y - 2.95 * k, 1.2 * k, 0.16 * k, -0.1, 0, TAU);
    ctx.fill();
    if (cold) icicles(ctx, x - 1.5 * k, y - 2.48 * k, 3 * k, k, t);
  }
  function cliff(ctx, x0, x1, yTop, yBottom, k, cold) {
    ctx.fillStyle = cold ? '#a7dcec' : '#7d78b8';
    ctx.beginPath();
    ctx.moveTo(x0 - 0.4 * k, yBottom);
    ctx.lineTo(x0, yTop);
    ctx.lineTo(x1, yTop);
    ctx.lineTo(x1 + 0.4 * k, yBottom);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = cold ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.2)';
    ctx.fillRect(x0, yTop - 0.06 * k, x1 - x0, 0.14 * k);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    for (let i = 0; i < 4; i++) poly(ctx, [[x0 + (i + 0.3) * (x1 - x0) / 4, yTop + 0.1 * k], [x0 + (i + 0.6) * (x1 - x0) / 4, yTop + 0.1 * k], [x0 + (i + 0.45) * (x1 - x0) / 4, yBottom - 0.2 * k]], 'rgba(255,255,255,0.12)');
  }
  function aurora(ctx, width, height, t) {
    for (let band = 0; band < 3; band++) {
      const g = ctx.createLinearGradient(0, 0, 0, height * 0.5);
      g.addColorStop(0, 'rgba(143,240,212,0)');
      g.addColorStop(0.5, band % 2 ? 'rgba(196,179,255,0.18)' : 'rgba(143,240,212,0.2)');
      g.addColorStop(1, 'rgba(143,240,212,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, height * 0.1);
      for (let x = 0; x <= width; x += 20) ctx.lineTo(x, height * (0.12 + band * 0.06) + Math.sin(x * 0.012 + t * 0.4 + band) * height * 0.05);
      for (let x = width; x >= 0; x -= 20) ctx.lineTo(x, height * (0.3 + band * 0.05) + Math.sin(x * 0.01 + t * 0.3 + band * 2) * height * 0.05);
      ctx.closePath();
      ctx.fill();
    }
  }
  // Biome decoration props by layout kind (crystals, ice spikes, snow drifts, crystal pines, rocks, lanterns).
  function prop(ctx, kind, x, y, s, t, i, theme) {
    const n = i % 5;
    if (kind === 'ice') {
      if (n === 0) {
        // crystal pine
        line(ctx, x, y, x, y - 0.25 * s, 0.08 * s, '#9a7a6a');
        [0, 1, 2].forEach(j => poly(ctx, [[x - (0.45 - j * 0.12) * s, y - (0.2 + j * 0.3) * s], [x + (0.45 - j * 0.12) * s, y - (0.2 + j * 0.3) * s], [x, y - (0.65 + j * 0.3) * s]], j % 2 ? '#bfefff' : '#e8fdff'));
      } else if (n === 1) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(x, y, 0.6 * s, 0.18 * s, 0, Math.PI, 0);
        ctx.fill();
      } else if (n === 2) {
        crystal(ctx, x, y, 0.55 * s, '#9fe8ff', -0.2);
        crystal(ctx, x + 0.25 * s, y, 0.38 * s, '#d4f4f6', 0.3);
      } else if (n === 3) {
        poly(ctx, [[x - 0.4 * s, y], [x - 0.1 * s, y - 0.45 * s], [x + 0.35 * s, y - 0.3 * s], [x + 0.5 * s, y]], '#a7dcec');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - 0.15 * s, y - 0.47 * s, 0.4 * s, 0.08 * s);
      } else {
        line(ctx, x, y, x, y - 0.7 * s, 0.06 * s, '#7f86b8');
        glow(ctx, x, y - 0.75 * s, 0.25 * s, '#ffd77a', 0.7 + Math.sin(t * 2 + i) * 0.1);
      }
      return;
    }
    if (n === 4) {
      line(ctx, x, y, x, y - 0.7 * s, 0.06 * s, '#7f86b8');
      glow(ctx, x, y - 0.75 * s, 0.25 * s, '#ffd77a', 0.7 + Math.sin(t * 2 + i) * 0.1);
    } else if (n === 3) {
      poly(ctx, [[x - 0.45 * s, y], [x - 0.15 * s, y - 0.35 * s], [x + 0.3 * s, y - 0.28 * s], [x + 0.5 * s, y]], '#8a86c8');
    } else window.NebulaArt.drawBiomeProp?.(ctx, theme.features, x, y, s * 0.9, t, i);
  }

  // ----- Glacies Niva: own storage and market buildings (session 8; no Orion art with a blue tint) -----
  // Eislager: a domed hall of ice blocks with a warm entrance; frosted crates stack outside by the real fill.
  function iceDepot(ctx, x, y, k, o) {
    const level = o.level,
      t = o.time,
      fill = Math.max(0, Math.min(1, o.fill || 0)),
      warm = o.warm !== false;
    shadow(ctx, x, y, 3.8 * k, k);
    const dome = (cx, rx, ry) => {
      const g = ctx.createLinearGradient(cx, y - ry, cx, y);
      g.addColorStop(0, '#f2fbff');
      g.addColorStop(1, '#a8d4ee');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(cx, y, rx, ry, 0, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(70,112,159,0.55)';
      ctx.lineWidth = 0.035 * k;
      for (let r = 1; r <= 3; r++) {
        const yy = y - (ry * r) / 4;
        const half = rx * Math.sqrt(1 - Math.pow((ry * r) / 4 / ry, 2));
        line(ctx, cx - half, yy, cx + half, yy, 0.035 * k, 'rgba(70,112,159,0.45)');
        for (let j = -2; j <= 2; j++) {
          const jx = cx + (j + (r % 2) * 0.5) * (half / 2.6);
          if (Math.abs(jx - cx) < half - 0.1 * k) line(ctx, jx, yy, jx, yy + ry / 4, 0.03 * k, 'rgba(70,112,159,0.35)');
        }
      }
    };
    if (level >= 10) dome(x + 1.55 * k, 0.9 * k, 0.8 * k);
    dome(x, 1.55 * k, 1.35 * k);
    // entrance tunnel with light from inside
    fillRR(ctx, x - 0.42 * k, y - 0.82 * k, 0.84 * k, 0.82 * k, 0.4 * k, '#5d88bb');
    fillRR(ctx, x - 0.3 * k, y - 0.7 * k, 0.6 * k, 0.7 * k, 0.3 * k, warm ? '#ffd9a0' : '#2c4f7a');
    if (warm) glow(ctx, x, y - 0.35 * k, 0.7 * k, '#ffd9a0', 0.35 + Math.sin(t * 1.5) * 0.04);
    icicles(ctx, x - 0.5 * k, y - 0.84 * k, 1.0 * k, k * 0.5, 3);
    // frosted crates (the real stock)
    const n = Math.round(fill * 9);
    for (let i = 0; i < n; i++) {
      const row = i < 4 ? 0 : i < 7 ? 1 : 2,
        col = i < 4 ? i : i < 7 ? i - 4 : i - 7;
      crate(ctx, x - 2.25 * k + col * 0.36 * k + row * 0.18 * k, y - row * 0.3 * k, 0.32 * k, '#bfe3f2', '#7aa6d4');
    }
    if (level >= 25) {
      // ice crane lifting a crate block
      line(ctx, x + 2.3 * k, y, x + 2.3 * k, y - 2.3 * k, 0.1 * k, '#9aa6c8');
      line(ctx, x + 2.3 * k, y - 2.3 * k, x + 0.9 * k, y - 2.3 * k, 0.08 * k, '#9aa6c8');
      const sway = Math.sin(t * 0.8) * 0.08 * k;
      line(ctx, x + 1.1 * k + sway, y - 2.3 * k, x + 1.1 * k + sway, y - 1.75 * k, 0.025 * k, '#2f3a5a');
      crate(ctx, x + 1.1 * k + sway, y - 1.5 * k, 0.3 * k, '#bfe3f2', '#7aa6d4');
    }
    // fill gauge: real stock
    fillRR(ctx, x - 0.9 * k, y - 1.62 * k, 1.8 * k, 0.12 * k, 0.06 * k, 'rgba(0,0,0,0.3)');
    fillRR(ctx, x - 0.9 * k, y - 1.62 * k, 1.8 * k * fill, 0.12 * k, 0.06 * k, fill >= 0.92 ? '#ff8f8f' : '#8ff0d4');
    plaque(ctx, x, y + 0.18 * k, k, 'Eislager Lv ' + level, '#9fe8ff');
    return { x0: x - 2.4 * k, y0: y - 1.9 * k, x1: x + (level >= 10 ? 2.5 : 1.7) * k, y1: y + 0.6 * k };
  }
  // Frostmarkt: a heated ice kiosk with a snow roof, lanterns and a display of frost quartz.
  function iceStall(ctx, x, y, k, o) {
    const level = o.level,
      t = o.time,
      fill = Math.max(0, Math.min(1, o.fill || 0));
    shadow(ctx, x, y, 3.2 * k, k);
    // ice-block walls
    fillRR(ctx, x - 1.2 * k, y - 1.1 * k, 2.4 * k, 1.1 * k, 0.12 * k, '#dff2fb');
    for (let r = 0; r < 3; r++) line(ctx, x - 1.15 * k, y - 0.37 * k * (r + 1), x + 1.15 * k, y - 0.37 * k * (r + 1), 0.03 * k, 'rgba(70,112,159,0.4)');
    // counter window with warm light
    fillRR(ctx, x - 0.85 * k, y - 0.95 * k, 1.7 * k, 0.5 * k, 0.08 * k, '#ffe9c4');
    glow(ctx, x, y - 0.7 * k, 0.9 * k, '#ffd9a0', 0.25);
    // display: frost quartz pieces by the depot fill
    const n = 1 + Math.round(fill * 5);
    for (let i = 0; i < n; i++) crystal(ctx, x - 0.65 * k + i * 0.26 * k, y - 0.5 * k, 0.13 * k, i % 2 ? '#9fe8ff' : '#e8fbff', 0);
    // snow roof
    const g = ctx.createLinearGradient(x, y - 1.75 * k, x, y - 1.05 * k);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#cfe9f7');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - 1.55 * k, y - 1.05 * k);
    ctx.quadraticCurveTo(x, y - 1.95 * k, x + 1.55 * k, y - 1.05 * k);
    ctx.closePath();
    ctx.fill();
    icicles(ctx, x - 1.4 * k, y - 1.05 * k, 2.8 * k, k * 0.5, 7);
    // lanterns (more with levels)
    const lanterns = level >= 10 ? 3 : 2;
    for (let i = 0; i < lanterns; i++) {
      const lx = x - 1.0 * k + (i * 2.0 * k) / (lanterns - 1);
      line(ctx, lx, y - 1.05 * k, lx, y - 0.85 * k, 0.025 * k, '#5d88bb');
      glow(ctx, lx, y - 0.78 * k, 0.16 * k, '#ffd77a', 0.75 + Math.sin(t * 2 + i) * 0.1);
    }
    if (level >= 25) plaque(ctx, x, y - 2.25 * k, k, 'FROSTMARKT', '#9fe8ff');
    if (o.saleGlow > 0) glow(ctx, x, y - 0.9 * k, 1 * k, '#9fe8ff', o.saleGlow * 0.6);
    plaque(ctx, x, y + 0.18 * k, k, 'Frostmarkt Lv ' + level, '#9fe8ff');
    return { x0: x - 1.7 * k, y0: y - 2.0 * k, x1: x + 1.7 * k, y1: y + 0.6 * k, counter: { x0: x - 1.1 * k, y0: y - 1.0 * k, x1: x + 1.1 * k, y1: y } };
  }

  window.ColonyArt = {
    C,
    glow,
    hazard,
    gear,
    shadow,
    windowPane,
    tower,
    drillBit,
    floodlight,
    deck,
    conveyor,
    steam,
    rr,
    fillRR,
    poly,
    line,
    box,
    crate,
    crystal,
    plaque,
    setLabelGate,
    scaffold,
    emptyPlot,
    pole,
    lamp,
    mine,
    track,
    loadingStation,
    vehicle,
    packStation,
    resinDrill,
    depot,
    iceDepot,
    refinery,
    stall,
    iceStall,
    hut,
    dock,
    elevator,
    frostDrill,
    thermalWorkshop,
    icicles,
    skyline,
    cavern,
    cliff,
    aurora,
    prop
  };
})();
