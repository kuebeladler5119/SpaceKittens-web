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
  // P1 readability: plaques of one frame never overlap. A plaque that would cover an earlier one moves one row down
  // (twice at most) and is skipped after that — its building still names itself on tap (the sheet). In the overview
  // the level is left out (short names; the level stays in the sheet and in the detail view).
  let labelRects = null,
    labelShort = false;
  function beginLabels(opts = {}) {
    labelRects = [];
    labelShort = Boolean(opts.short);
  }
  function endLabels() {
    const placed = labelRects;
    labelRects = null;
    return placed;
  }
  function plaque(ctx, x, y, k, text, color = C.warm) {
    if (labelGate && text !== String(text).toUpperCase() && !labelGate(x, text)) return;
    if (labelShort) text = String(text).replace(/ Lv \d+$/, '');
    ctx.font = `900 ${Math.max(9, Math.round(0.24 * k))}px Nunito, sans-serif`;
    const w = ctx.measureText(text).width + 0.36 * k,
      h = 0.4 * k;
    if (labelRects) {
      const gap = 0.06 * k;
      for (let tries = 0; ; tries++) {
        const hit = labelRects.find(r => x - w / 2 < r.x1 + gap && x + w / 2 > r.x0 - gap && y < r.y1 + gap && y + h > r.y0 - gap);
        if (!hit) break;
        if (tries >= 2) return;
        y = hit.y1 + gap;
      }
      labelRects.push({ x0: x - w / 2, y0: y, x1: x + w / 2, y1: y + h, text });
    }
    fillRR(ctx, x - w / 2, y, w, h, h / 2, 'rgba(29,33,80,0.88)');
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + h / 2 + 0.5);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
  // Visual Identity round: the hidden part of a crowd as one small pill ("+3 🐾") above the leading kitten or vehicle —
  // the information stays, the picture stays calm
  function crowdBadge(ctx, x, y, k, n) {
    if (!(n > 0)) return;
    const text = '+' + n;
    ctx.font = `900 ${Math.max(9, Math.round(0.2 * k))}px Nunito, sans-serif`;
    const w = ctx.measureText(text).width + 0.42 * k,
      h = 0.3 * k;
    fillRR(ctx, x - w / 2, y - h, w, h, h / 2, 'rgba(29,33,80,0.9)');
    ctx.fillStyle = '#ffd77a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x - 0.08 * k, y - h / 2 + 0.5);
    ctx.fillStyle = '#ff9ecb';
    for (const [dx, dy, r] of [[0.13, -0.05, 0.03], [0.17, -0.11, 0.022], [0.09, -0.11, 0.022]]) {
      ctx.beginPath();
      ctx.arc(x + w / 2 - 0.22 * k + dx * k, y - h / 2 + dy * k + 0.05 * k, r * k, 0, TAU);
      ctx.fill();
    }
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
    // Beta 1.9 M1: Lv 100 – a giant crystal spire grown out of the vein, glowing while it is mined
    if (level >= 100) {
      crystal(ctx, x - 0.2 * k, y - 0.4 * k, 1.15 * k, accent, -0.12);
      crystal(ctx, x + 0.45 * k, y - 0.3 * k, 0.7 * k, o.theme.particle || '#fff', 0.2);
      glow(ctx, x - 0.2 * k, y - 1.2 * k, 0.9 * k, accent, working ? 0.45 + Math.sin(t * 3) * 0.12 : 0.2);
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
    // P1.5: a vehicle look paints body, rim and cab (o.skin = the equipped look); the ornament reads the real state
    const sk = vehicleSkin(o.skin),
      paint = (def, part = 'body') => (sk ? sk[part] : def),
      orn = (x0, y0, w, h) => vehicleOrnament(ctx, sk, x0, y0, w, h, k, t, { loaded: o.fill === undefined ? loaded : o.fill > 0.02, moving: o.moving !== false, reduced: o.reduced });
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
      poly(ctx, [[-0.42 * k, -0.48 * k], [0.4 * k, -0.48 * k], [0.28 * k, -0.14 * k], [-0.3 * k, -0.14 * k]], paint(C.wood));
      orn(-0.3 * k, -0.46 * k, 0.6 * k, 0.3 * k);
      line(ctx, -0.42 * k, -0.48 * k, 0.4 * k, -0.48 * k, 0.05 * k, paint(C.woodDark, 'dark'));
      line(ctx, -0.3 * k, -0.2 * k, -0.74 * k, -0.24 * k, 0.05 * k, C.woodDark); // handles at paw height (P1)
      line(ctx, -0.12 * k, -0.14 * k, -0.2 * k, 0, 0.05 * k, C.woodDark);
      wheels([0.3], 0.13);
    } else if (level < 10) {
      const big = level >= 5 ? 1.2 : 1;
      if (loaded) load(level >= 5 ? 3 : 2);
      poly(ctx, [[-0.45 * big * k, -0.5 * k], [0.45 * big * k, -0.5 * k], [0.36 * big * k, -0.1 * k], [-0.36 * big * k, -0.1 * k]], paint(level >= 5 ? '#9aa6c8' : C.wood));
      orn(-0.36 * big * k, -0.48 * k, 0.72 * big * k, 0.36 * k);
      line(ctx, -0.45 * big * k, -0.5 * k, 0.45 * big * k, -0.5 * k, 0.05 * k, paint(level >= 5 ? C.metalDark : C.woodDark, 'dark'));
      wheels([-0.24 * big, 0.24 * big], 0.11);
    } else if (level < 25) {
      // powered rover with cab, antenna and headlight
      if (loaded) load(3);
      fillRR(ctx, -0.6 * k, -0.52 * k, 0.95 * k, 0.42 * k, 0.1 * k, paint('#ff9e5a'));
      orn(-0.6 * k, -0.52 * k, 0.9 * k, 0.42 * k);
      fillRR(ctx, 0.3 * k, -0.78 * k, 0.42 * k, 0.68 * k, 0.12 * k, paint('#ffb35a', 'cab'));
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
        fillRR(ctx, -0.42 * k, -0.48 * k, 0.84 * k, 0.38 * k, 0.08 * k, sk ? (wgn ? sk.cab : sk.body) : wgn ? '#c4b3ff' : '#8fe3ff');
        orn(-0.42 * k, -0.48 * k, 0.84 * k, 0.38 * k);
        line(ctx, 0.42 * k, -0.22 * k, 0.55 * k, -0.22 * k, 0.05 * k, C.ink);
        wheels([-0.24, 0.24], 0.11);
        ctx.restore();
      }
      fillRR(ctx, -0.48 * k, -0.58 * k, 1.05 * k, 0.48 * k, 0.12 * k, paint('#ff9e5a'));
      orn(-0.48 * k, -0.58 * k, 0.6 * k, 0.48 * k);
      fillRR(ctx, 0.12 * k, -0.86 * k, 0.45 * k, 0.4 * k, 0.1 * k, paint('#ffb35a', 'cab'));
      fillRR(ctx, 0.22 * k, -0.8 * k, 0.26 * k, 0.22 * k, 0.06 * k, 'rgba(170,230,255,0.95)');
      glow(ctx, 0.6 * k, -0.32 * k, 0.2 * k, '#fff6d0', 0.8);
      wheels([-0.3, 0.05, 0.4], 0.13);
    } else {
      // maglev cargo pod hovering over the glowing rail
      const hover = Math.sin(t * 3) * 0.04 * k;
      ctx.translate(0, hover - 0.12 * k);
      if (loaded) load(3);
      fillRR(ctx, -0.75 * k, -0.6 * k, 1.5 * k, 0.5 * k, 0.25 * k, paint('#e8e4fa'));
      fillRR(ctx, -0.75 * k, -0.24 * k, 1.5 * k, 0.12 * k, 0.06 * k, paint(accent, 'trim'));
      orn(-0.55 * k, -0.6 * k, 0.8 * k, 0.36 * k);
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
    // Beta 1.9 M1: Lv 25 – a real Bohrturm: a lattice derrick over the bore with its crown block; Lv 50 – the derrick
    // glows while it pumps and a second tank stands beside the first; Lv 100 – a cracking column with resin lights
    if (level >= 25) {
      const dx = x - 0.35 * k,
        top = y - 2.6 * k;
      line(ctx, dx - 0.45 * k, y, dx - 0.1 * k, top, 0.06 * k, '#7f6ad8');
      line(ctx, dx + 0.45 * k, y, dx + 0.1 * k, top, 0.06 * k, '#7f6ad8');
      for (let yy = y - 0.45 * k; yy > top + 0.2 * k; yy -= 0.45 * k) {
        const f = (y - yy) / (y - top),
          half = 0.45 * k - 0.35 * k * f;
        line(ctx, dx - half, yy, dx + half, yy - 0.45 * k, 0.03 * k, '#9f8bf0');
        line(ctx, dx - half, yy, dx + half, yy, 0.035 * k, '#7f6ad8');
      }
      fillRR(ctx, dx - 0.2 * k, top - 0.14 * k, 0.4 * k, 0.16 * k, 0.05 * k, '#c4b3ff');
      if (level >= 50) glow(ctx, dx, top - 0.06 * k, 0.4 * k, '#ff9ecb', o.active ? 0.75 : 0.3);
    }
    if (level >= 50) {
      const t2 = tx + tw + 0.12 * k,
        th2 = th * 0.8;
      fillRR(ctx, t2, y - th2, tw * 0.7, th2, 0.2 * k, 'rgba(232,228,250,0.35)');
      if (fill > 0) fillRR(ctx, t2 + 0.05 * k, y - 0.05 * k - (th2 - 0.1 * k) * fill, tw * 0.7 - 0.1 * k, (th2 - 0.1 * k) * fill, 0.15 * k, '#ff8fc6');
    }
    if (level >= 100) {
      const cx = x + 2.0 * k;
      fillRR(ctx, cx - 0.22 * k, y - 2.3 * k, 0.44 * k, 2.3 * k, 0.16 * k, '#e8e4fa');
      for (let i = 0; i < 4; i++) glow(ctx, cx, y - 0.45 * k - i * 0.5 * k, 0.1 * k, '#ff9ecb', o.active ? 0.6 + 0.4 * Math.sin(t * 3 + i) : 0.35);
    }
    plaque(ctx, x, y + 0.18 * k, k, level ? 'Harzbohrturm Lv ' + level : 'Harzbohrturm', '#ff9ecb');
    return { x0: x - 2.2 * k, y0: y - (level >= 25 ? 2.8 : 1.8) * k, x1: x + 2.3 * k, y1: y + 0.5 * k };
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
      // Beta 1.8 A6: the first storage is a little wooden shed with a lean-to roof (was a bare fence): an open door with
      // shelves, a hand cart, a lantern; the yard in front holds the real stock as crates behind a low fence
      const sx = x + 0.45 * k;
      // yard: pallet and low fence (left), crates by real stock
      fillRR(ctx, x - 1.75 * k, y - 0.1 * k, 1.7 * k, 0.1 * k, 0.03 * k, C.woodDark);
      for (let i = 0; i < 4; i++) line(ctx, x - 1.8 * k + i * 0.55 * k, y, x - 1.8 * k + i * 0.55 * k, y - 0.42 * k, 0.06 * k, C.wood);
      line(ctx, x - 1.8 * k, y - 0.34 * k, x - 0.15 * k, y - 0.34 * k, 0.05 * k, C.wood);
      // the shed
      box(ctx, sx, y, 1.7 * k, 1.05 * k, 0.32 * k, '#d9b48a', '#f0d2a8', '#b98a5e');
      for (let i = 1; i < 4; i++) line(ctx, sx - 0.85 * k, y - i * 0.26 * k, sx + 0.85 * k, y - i * 0.26 * k, 0.025 * k, 'rgba(120,80,40,0.35)');
      // lean-to roof in the planet's accent, with a light edge
      poly(ctx, [[sx - 1.02 * k, y - 1.0 * k], [sx + 1.12 * k, y - 1.32 * k], [sx + 1.12 * k, y - 1.18 * k], [sx - 1.02 * k, y - 0.86 * k]], o.theme.accent);
      line(ctx, sx - 1.02 * k, y - 1.0 * k, sx + 1.12 * k, y - 1.32 * k, 0.05 * k, 'rgba(255,255,255,0.6)');
      // P1.5: the depot look on the lean-to roof (a thicker roof so the pattern reads)
      if (o.skin)
        roofLook(
          ctx,
          o.skin,
          c => {
            c.moveTo(sx - 1.06 * k, y - 1.04 * k);
            c.lineTo(sx + 1.16 * k, y - 1.42 * k);
            c.lineTo(sx + 1.16 * k, y - 1.14 * k);
            c.lineTo(sx - 1.06 * k, y - 0.82 * k);
            c.closePath();
          },
          { x0: sx - 1.06 * k, y0: y - 1.42 * k, x1: sx + 1.16 * k, y1: y - 0.82 * k },
          { x: sx + 0.7 * k, y: y - 1.34 * k },
          k,
          t,
          o
        );
      // open door: dark inside, two shelves with crates
      fillRR(ctx, sx - 0.42 * k, y - 0.78 * k, 0.84 * k, 0.78 * k, 0.08 * k, '#3b3570');
      line(ctx, sx - 0.38 * k, y - 0.5 * k, sx + 0.38 * k, y - 0.5 * k, 0.04 * k, C.woodDark);
      line(ctx, sx - 0.38 * k, y - 0.22 * k, sx + 0.38 * k, y - 0.22 * k, 0.04 * k, C.woodDark);
      if (crates > 2) crate(ctx, sx - 0.18 * k, y - 0.52 * k, 0.24 * k);
      if (crates > 5) crate(ctx, sx + 0.16 * k, y - 0.24 * k, 0.22 * k, '#ffc08a');
      // a crate sign over the door
      fillRR(ctx, sx - 0.3 * k, y - 1.0 * k, 0.6 * k, 0.18 * k, 0.05 * k, '#fff4e2');
      crate(ctx, sx, y - 0.84 * k, 0.12 * k);
      // a hand cart beside the shed
      const cx = sx + 1.15 * k;
      fillRR(ctx, cx - 0.32 * k, y - 0.42 * k, 0.64 * k, 0.2 * k, 0.05 * k, C.wood);
      line(ctx, cx + 0.32 * k, y - 0.36 * k, cx + 0.6 * k, y - 0.62 * k, 0.05 * k, C.woodDark);
      ctx.fillStyle = C.metalDark;
      ctx.beginPath();
      ctx.arc(cx - 0.12 * k, y - 0.12 * k, 0.12 * k, 0, TAU);
      ctx.fill();
      if (crates > 0) crate(ctx, cx - 0.05 * k, y - 0.42 * k, 0.26 * k, '#ffd77a');
      // a lantern on the corner (warm while the colony is heated)
      glow(ctx, sx - 0.95 * k, y - 0.95 * k, 0.28 * k, '#ffe9a8', o.warm === false ? 0.15 : 0.55 + Math.sin(t * 2.4) * 0.08);
      fillRR(ctx, sx - 1.02 * k, y - 1.02 * k, 0.14 * k, 0.16 * k, 0.04 * k, '#fff3c4');
      crateRow(x - 1.65 * k, y - 0.1 * k, Math.min(7, crates));
      if (full) glow(ctx, sx, y - 1.3 * k, 0.4 * k, '#ff8f8f', 0.55 + Math.sin(t * 8) * 0.3);
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
    if (o.skin) {
      const ridge = y - hgt - (big ? 0.85 : 0.6) * k;
      roofLook(
        ctx,
        o.skin,
        c => {
          c.moveTo(x - w / 2 - 0.12 * k, y - hgt);
          c.lineTo(x, ridge);
          c.lineTo(x + w / 2 + 0.12 * k, y - hgt);
          c.closePath();
        },
        { x0: x - w / 2 - 0.12 * k, y0: ridge, x1: x + w / 2 + 0.12 * k, y1: y - hgt },
        { x: x + w * 0.28, y: ridge + (big ? 0.4 : 0.3) * k },
        k,
        t,
        o
      );
    }
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
    // Beta 1.9 M1: Lv 100 – delivery drones circle the roof with crates while goods arrive (parked on it otherwise)
    if (level >= 100)
      for (let i = 0; i < 2; i++) {
        const a = o.active ? t * 0.9 + i * Math.PI : i * Math.PI;
        drone(ctx, x + Math.cos(a) * w * 0.55, y - hgt - 1.25 * k + Math.sin(a) * 0.25 * k, k, t, o.active ? '#ffd77a' : null);
      }
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
    // Beta 1.9 M1: Lv 50 – the Kristallschmelze: a glass dome on the hall where the melt glows in the planet's colour;
    // Lv 100 – an induction tower with a field ring over the plant
    if (level >= 50) {
      const dy = y - hgt;
      ctx.fillStyle = 'rgba(200,240,255,0.5)';
      ctx.beginPath();
      ctx.ellipse(x - 0.15 * k, dy, 0.7 * k, 0.55 * k, 0, Math.PI, 0);
      ctx.fill();
      glow(ctx, x - 0.15 * k, dy - 0.15 * k, 0.55 * k, o.theme.accent, active ? 0.55 + Math.sin(t * 3) * 0.12 : 0.2);
      crystal(ctx, x - 0.15 * k, dy - 0.05 * k, 0.32 * k, o.theme.accent, 0);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 0.04 * k;
      ctx.beginPath();
      ctx.ellipse(x - 0.15 * k, dy, 0.7 * k, 0.55 * k, 0, Math.PI, 0);
      ctx.stroke();
    }
    if (level >= 100) {
      const tx = x - w / 2 + 0.2 * k,
        top = y - hgt - 2.1 * k;
      fillRR(ctx, tx - 0.14 * k, top, 0.28 * k, 2.1 * k, 0.08 * k, C.steel);
      ctx.strokeStyle = active ? C.mint : '#a9a3d8';
      ctx.lineWidth = 0.07 * k;
      ctx.beginPath();
      ctx.ellipse(tx, top + 0.35 * k + (active ? Math.sin(t * 2) * 0.15 * k : 0), 0.5 * k, 0.14 * k, 0, 0, TAU);
      ctx.stroke();
      glow(ctx, tx, top, 0.25 * k, active ? C.mint : C.warm, 0.9);
    }
    // bars produced (real stock)
    const bars = Math.round(Math.max(0, Math.min(1, o.bars || 0)) * 6),
      bx = x + w / 2 + (big ? 1.15 : 0.35) * k;
    for (let i = 0; i < bars; i++) fillRR(ctx, bx + (i % 3) * 0.26 * k, y - 0.14 * k - Math.floor(i / 3) * 0.16 * k, 0.24 * k, 0.13 * k, 0.03 * k, i % 2 ? '#ffe38a' : '#ffd23a');
    plaque(ctx, x, y + 0.18 * k, k, 'Raffinerie Lv ' + level, '#ffb35a');
    return { x0: x - 2 * k, y0: y - hgt - (level >= 100 ? 2.2 : 1.5) * k, x1: x + w / 2 + 1.6 * k, y1: y + 0.6 * k };
  }

  // ----- Trade: market stall (1) → trade booth (10) → commercial outpost (25) → trading station (50) -----
  // P1.3: building looks (Commerce slot 'stall'): the stall's awning, roof and string lights
  // Building looks of the market stall (the cosmetic slot 'stall'): the awning's stripes, the kiosk roof and the string
  // lights. P1.4: the Raureif-Markise adds icicles under the awning and a glint that runs along them; on the planet stalls
  // (Glacies, Pyra, Viridia keep their own building) the look shows as a pennant line with its lights (stallAccent)
  const STALL_SKINS = {
    'stall-sunset': { awning: ['#ffb35a', '#fff4e2'], roof: '#ff8a5a', lights: ['#ffd27a', '#ff9a4a', '#fff4e2'] },
    'stall-frost': { awning: ['#9fdcf4', '#f2fcff'], roof: '#7fc4e6', lights: ['#e8fbff', '#9fe8ff', '#c4a3ff'], icicles: '#e8fbff' }
  };
  // icicles under an awning edge: a row of small ice teeth, one catching the light at a time
  function awningIcicles(ctx, ax, ay, w, k, color, t) {
    const n = 10,
      lit = Math.floor(((t * 1.5) % 1) * n);
    for (let i = 0; i < n; i++) {
      const ix = ax - w / 2 + ((i + 0.5) * w) / n,
        len = (i % 3 === 1 ? 0.3 : 0.18) * k;
      ctx.fillStyle = i === lit ? '#ffffff' : color;
      ctx.beginPath();
      ctx.moveTo(ix - 0.06 * k, ay);
      ctx.lineTo(ix, ay + len);
      ctx.lineTo(ix + 0.06 * k, ay);
      ctx.closePath();
      ctx.fill();
      if (i === lit) glow(ctx, ix, ay + len * 0.5, 0.18 * k, '#bff4ff', 0.7);
    }
  }
  // a stall look on a planet's own stall: a pennant line in the look's colours with its lights across the top
  function stallAccent(ctx, id, x, top, k, t) {
    const skin = STALL_SKINS[id];
    if (!skin) return;
    const w = 2.6 * k,
      n = 7;
    line(ctx, x - w / 2, top, x + w / 2, top, 0.035 * k, 'rgba(60,50,90,0.7)');
    for (let i = 0; i < n; i++) {
      const px = x - w / 2 + ((i + 0.5) * w) / n,
        sag = Math.sin(((i + 0.5) / n) * Math.PI) * 0.16 * k;
      poly(ctx, [[px - 0.13 * k, top + sag], [px + 0.13 * k, top + sag], [px, top + sag + 0.32 * k]], skin.awning[i % 2]);
      glow(ctx, px, top + sag - 0.04 * k, 0.07 * k, skin.lights[i % 3], 0.85 + Math.sin(t * 3 + i) * 0.12);
    }
    if (skin.icicles) awningIcicles(ctx, x, top + 0.1 * k, w * 0.8, k * 0.8, skin.icicles, t);
  }
  function stall(ctx, x, y, k, o) {
    const skin = STALL_SKINS[o.skin] || { awning: ['#ff9ecb', '#ffffff'], roof: '#ff9ecb', lights: ['#ffe26b', '#ff9ecb', '#8ff0d4'] };
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
      if (skin.icicles) awningIcicles(ctx, ax, ay + 0.36 * k, w * 0.92, k, skin.icicles, t);
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
      awning(x, top, 3 * k, skin.awning);
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
      poly(ctx, [[x - 1.6 * k, y - 1.5 * k], [x, y - 2.3 * k], [x + 1.6 * k, y - 1.5 * k]], skin.roof);
      if (skin.icicles) awningIcicles(ctx, x, y - 1.5 * k, 3 * k, k, skin.icicles, t);
      fillRR(ctx, x - 1.1 * k, y - 1.3 * k, 2.2 * k, 0.6 * k, 0.08 * k, '#4a4f86');
      goods(x - 0.9 * k, y - 0.82 * k, Math.round(fill * 7));
      line(ctx, x + 1.45 * k, y, x + 1.45 * k, y - 2 * k, 0.06 * k, C.woodDark);
      poly(ctx, [[x + 1.45 * k, y - 2 * k], [x + 2.05 * k, y - 1.85 * k], [x + 1.45 * k, y - 1.65 * k]], C.mint);
      top = y - 1.5 * k;
    } else {
      // hand-built market stall
      line(ctx, x - 1.1 * k, y, x - 1.1 * k, y - 1.6 * k, 0.09 * k, C.woodDark);
      line(ctx, x + 1.1 * k, y, x + 1.1 * k, y - 1.6 * k, 0.09 * k, C.woodDark);
      awning(x, y - 1.7 * k, 2.5 * k, skin.awning);
      fillRR(ctx, x - 1.15 * k, y - 0.62 * k, 2.3 * k, 0.62 * k, 0.08 * k, C.wood);
      for (let i = 0; i < 3; i++) line(ctx, x - 1.1 * k, y - 0.5 * k + i * 0.18 * k, x + 1.1 * k, y - 0.5 * k + i * 0.18 * k, 0.03 * k, C.woodDark);
      goods(x - 0.9 * k, y - 0.7 * k, Math.round(fill * 6));
      crate(ctx, x + 1.45 * k, y, 0.45 * k);
      // Beta 1.8 A6: string lights under the awning and a hanging crystal sign – the stall reads as a shop from afar
      for (let i = 0; i < 7; i++) {
        const lx = x - 1.05 * k + i * 0.35 * k,
          ly = y - 1.36 * k + Math.sin((i / 6) * Math.PI) * 0.12 * k;
        glow(ctx, lx, ly, 0.08 * k, skin.lights[i % 3], 0.9 + Math.sin(t * 3 + i) * 0.1);
      }
      line(ctx, x + 1.1 * k, y - 1.3 * k, x + 1.6 * k, y - 1.3 * k, 0.05 * k, C.woodDark);
      line(ctx, x + 1.45 * k, y - 1.3 * k, x + 1.45 * k, y - 1.12 * k, 0.03 * k, C.woodDark);
      fillRR(ctx, x + 1.22 * k, y - 1.14 * k, 0.46 * k, 0.4 * k, 0.08 * k, '#fff4e2');
      crystal(ctx, x + 1.45 * k, y - 0.82 * k, 0.24 * k, o.theme.accent, 0);
      top = y - 1.7 * k;
    }
    // Beta 1.9 M1: Lv 100 – the Galaktische Börse: a holo ring above the dome, two drones flying goods in
    if (level >= 100) {
      ctx.strokeStyle = 'rgba(143,240,212,0.55)';
      ctx.lineWidth = 0.06 * k;
      ctx.beginPath();
      ctx.ellipse(x, y - 3.85 * k, 1.5 * k, 0.28 * k, 0, 0, TAU);
      ctx.stroke();
      for (let i = 0; i < 2; i++) {
        const a = t * 0.7 + i * Math.PI;
        drone(ctx, x + Math.cos(a) * 1.5 * k, y - 3.85 * k + Math.sin(a) * 0.28 * k, k * 0.8, t, i ? o.theme.accent : '#ffd77a');
      }
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
      // Beta 1.8 A6: a lived-in home – a little chimney that smokes while it is warm, a light over the door, a flower pot
      if (i === 0) {
        fillRR(ctx, hx + 0.3 * s, y - 1.18 * s, 0.16 * s, 0.32 * s, 0.04 * s, '#b98a5e');
        fillRR(ctx, hx + 0.27 * s, y - 1.22 * s, 0.22 * s, 0.07 * s, 0.03 * s, '#8f6a48');
        if (o.warm !== false) steam(ctx, hx + 0.38 * s, y - 1.25 * s, k * 0.6, t + 1.3);
      }
      glow(ctx, hx + 0.21 * s, y - 0.5 * s, 0.14 * s, '#fff3c4', o.warm === false ? 0.2 : 0.6);
      fillRR(ctx, hx - 0.56 * s, y - 0.18 * s, 0.18 * s, 0.18 * s, 0.05 * s, '#d98a6a');
      ctx.fillStyle = i % 2 ? '#ff9ecb' : '#ffd77a';
      ctx.beginPath();
      ctx.arc(hx - 0.47 * s, y - 0.25 * s, 0.07 * s, 0, TAU);
      ctx.fill();
      if (level >= 5 && i === 0) {
        line(ctx, hx - 0.15 * s, y - 1.0 * s, hx - 0.28 * s, y - 1.42 * s, 0.03 * k, C.metalDark);
        glow(ctx, hx - 0.28 * s, y - 1.44 * s, 0.07 * s, Math.sin(t * 3 + i) > 0 ? C.mint : '#ffe9a8', 1);
      }
      if (level >= 25 && i === Math.floor(count / 2)) {
        line(ctx, hx + 0.45 * s, y - 1.0 * s, hx + 0.45 * s, y - 1.7 * s, 0.04 * k, C.woodDark);
        poly(ctx, [[hx + 0.45 * s, y - 1.7 * s], [hx + 0.85 * s, y - 1.6 * s], [hx + 0.45 * s, y - 1.48 * s]], C.pink);
      }
    }
    // Beta 1.9 M1: Lv 100 – a glass greenhouse dome beside the homes (green inside, lit) and a satellite dish
    if (level >= 100) {
      const gx = x + (count * 0.7 + 0.55) * k;
      ctx.fillStyle = 'rgba(200,240,255,0.5)';
      ctx.beginPath();
      ctx.ellipse(gx, y, 0.62 * k, 0.75 * k, 0, Math.PI, 0);
      ctx.fill();
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = i % 2 ? '#7fd08a' : '#9be06b';
        ctx.beginPath();
        ctx.arc(gx - 0.3 * k + i * 0.3 * k, y - 0.12 * k, 0.16 * k, 0, TAU);
        ctx.fill();
      }
      glow(ctx, gx, y - 0.4 * k, 0.5 * k, '#ffe9a8', 0.25);
      line(ctx, gx, y - 0.75 * k, gx + 0.2 * k, y - 1.2 * k, 0.04 * k, C.metalDark);
      ctx.fillStyle = '#e8e4fa';
      ctx.beginPath();
      ctx.ellipse(gx + 0.25 * k, y - 1.25 * k, 0.28 * k, 0.12 * k, -0.6, 0, TAU);
      ctx.fill();
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
    // Beta 1.9 M1: the first tiers get a freight shed behind the pad (door, roof, FRACHT sign), so the dock reads as a
    // place from the start; Lv 100 a control tower with a turning radar dish
    if (level < 30) {
      box(ctx, x + 2.95 * k, y, 1.1 * k, 0.95 * k, 0.25 * k, '#d9d3f5', '#f4f2ff', '#bdb6e6');
      fillRR(ctx, x + 2.7 * k, y - 0.62 * k, 0.5 * k, 0.62 * k, 0.05 * k, '#4a4f86');
      fillRR(ctx, x + 2.35 * k, y - 1.2 * k, 1.2 * k, 0.24 * k, 0.07 * k, 'rgba(29,33,80,0.9)');
      ctx.fillStyle = C.mint;
      ctx.font = `900 ${Math.max(7, Math.round(0.17 * k))}px Nunito, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('FRACHT', x + 2.95 * k, y - 1.03 * k);
      ctx.textAlign = 'left';
    }
    if (level >= 100) {
      const tx = x + 3.6 * k,
        top = y - 3.6 * k;
      fillRR(ctx, tx - 0.18 * k, top, 0.36 * k, 3.6 * k, 0.08 * k, '#e8e4fa');
      fillRR(ctx, tx - 0.45 * k, top - 0.35 * k, 0.9 * k, 0.4 * k, 0.12 * k, '#4a4f86');
      windowPane(ctx, tx - 0.35 * k, top - 0.3 * k, 0.7 * k, 0.24 * k, true, t);
      const a = t * 1.2;
      ctx.fillStyle = '#c9d2ea';
      ctx.beginPath();
      ctx.ellipse(tx, top - 0.55 * k, 0.35 * k * Math.abs(Math.cos(a)) + 0.04 * k, 0.12 * k, 0, 0, TAU);
      ctx.fill();
    }
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
    // Beta 1.9 M2: the pad holds the goods the porters really brought (o.pad 0..1); without hauls the old queue sign
    const stack = o.pad !== undefined ? (o.pad > 0.02 ? Math.max(1, Math.round(o.pad * 6)) : 0) : o.queue ? 6 : 0;
    for (let i = 0; i < stack; i++) crate(ctx, x - 0.9 * k + (i % 3) * 0.4 * k, y - Math.floor(i / 3) * 0.38 * k, 0.36 * k, i % 2 ? '#ffc08a' : '#ffd77a');
    // while the freight really loads, one crate after another rises from the stack into the hold above
    if (o.freighting) {
      const f = (t * 0.7) % 1;
      ctx.globalAlpha = 1 - f;
      crate(ctx, x - 0.5 * k, y - 0.4 * k - f * 1.6 * k, 0.32 * k, '#ffd77a', '#c98a2a');
      ctx.globalAlpha = 1;
      glow(ctx, x - 0.5 * k, y - 0.9 * k, 0.5 * k, C.mint, 0.18);
    }
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
    // Beta 1.9 M1: Lv 25 – a second cryo arm on a gantry and a belt carrying quartz into the building; Lv 50 – a cryo
    // tower (a tall frosted cylinder that vents cold mist while it drills)
    if (level >= 25) {
      const r2 = working ? Math.cos(t * 7) * 0.05 * k : 0;
      line(ctx, x + 0.2 * k, y - 1.25 * k, x + 0.95 * k + r2, y - 1.05 * k, 0.11 * k, C.metalDark);
      poly(ctx, [[x + 0.9 * k + r2, y - 1.18 * k], [x + 1.25 * k + r2, y - 1.05 * k], [x + 0.9 * k + r2, y - 0.92 * k]], '#c8fbff');
      conveyor(ctx, x + 1.4 * k, y - 0.15 * k, x + 0.3 * k, y - 0.45 * k, k * 0.7, working, t, '#9fe8ff');
    }
    if (level >= 50) {
      const tx = x - 2.15 * k;
      fillRR(ctx, tx - 0.35 * k, y - 2.9 * k, 0.7 * k, 2.9 * k, 0.3 * k, '#e9f7ff');
      for (let i = 0; i < 3; i++) fillRR(ctx, tx - 0.35 * k, y - (0.8 + i * 0.75) * k, 0.7 * k, 0.08 * k, 0.04 * k, '#8fe3ff');
      glow(ctx, tx, y - 3 * k, 0.3 * k, working ? '#c8fbff' : '#5a5f8a', 0.9);
      if (working) for (let i = 0; i < 3; i++) glow(ctx, tx + Math.sin(t + i) * 0.2 * k, y - 3.2 * k - ((t * 0.6 + i / 3) % 1) * 0.8 * k, 0.25 * k, '#e8fdff', 0.35);
    }
    if (frozen) icicles(ctx, x - 1.3 * k, y - (big ? 1.5 : 1.1) * k, (big ? 1.6 : 1.2) * k, k, t);
    // frost quartz stock crates
    const stock = Math.round(Math.max(0, Math.min(1, o.fill || 0)) * 6);
    for (let i = 0; i < stock; i++) crate(ctx, x - 2 * k + (i % 3) * 0.38 * k, y - Math.floor(i / 3) * 0.36 * k, 0.34 * k, '#bfefff', '#6fb6c9');
    plaque(ctx, x, y + 0.18 * k, k, 'Frostquarz Lv ' + level, '#9fe8ff');
    return { x0: x - 2.3 * k, y0: y - (level >= 50 ? 3.1 : 2.6) * k, x1: x + 2.2 * k, y1: y + 0.6 * k };
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
    // Beta 1.9 M1: Lv 25 – two heat exchangers with fins on the roof (their plumes rise while cells are made); Lv 50 –
    // the Wärmewerk: a reactor dome beside the hall with a glowing ring
    if (level >= 25)
      [-0.55, 0.55].forEach((dx, i) => {
        const fx = x + dx * k,
          top = y - hgt - 0.95 * k;
        fillRR(ctx, fx - 0.2 * k, top, 0.4 * k, 0.75 * k, 0.08 * k, '#f0cdb6');
        for (let f = 0; f < 4; f++) line(ctx, fx - 0.28 * k, top + 0.12 * k + f * 0.15 * k, fx + 0.28 * k, top + 0.12 * k + f * 0.15 * k, 0.04 * k, '#d9a88a');
        if (active) steam(ctx, fx, top - 0.1 * k, k, t + i);
      });
    if (level >= 50) {
      const dx = x - w / 2 - 1.05 * k;
      ctx.fillStyle = '#fff1e6';
      ctx.beginPath();
      ctx.ellipse(dx, y, 0.75 * k, 1.05 * k, 0, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = active ? '#ffb35a' : '#9a8aa8';
      ctx.lineWidth = 0.08 * k;
      ctx.beginPath();
      ctx.ellipse(dx, y - 0.55 * k, 0.6 * k, 0.16 * k, 0, 0, TAU);
      ctx.stroke();
      if (active) glow(ctx, dx, y - 0.55 * k, 0.7 * k, '#ffb35a', 0.35 + Math.sin(t * 4) * 0.1);
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
    // P1.5: the depot look covers the upper dome as its roof (the gauge and the entrance stay readable below)
    if (o.skin)
      roofLook(
        ctx,
        o.skin,
        c => {
          c.ellipse(x, y, 1.55 * k, 1.35 * k, 0, Math.PI * 1.12, Math.PI * 1.88);
          c.closePath();
        },
        { x0: x - 1.3 * k, y0: y - 1.35 * k, x1: x + 1.3 * k, y1: y - 0.7 * k },
        { x: x + 0.55 * k, y: y - 1.26 * k },
        k,
        t,
        o
      );
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
    // P1.5: a stall look is the snow roof's own awning (its stripes over the roof's shape, its icicles and lights)
    const look = o.skin
      ? stallRoof(
          ctx,
          o.skin,
          c => {
            c.moveTo(x - 1.55 * k, y - 1.05 * k);
            c.quadraticCurveTo(x, y - 1.95 * k, x + 1.55 * k, y - 1.05 * k);
            c.closePath();
          },
          { x0: x - 1.55 * k, y0: y - 1.55 * k, x1: x + 1.55 * k, y1: y - 1.05 * k },
          k
        )
      : null;
    if (look?.icicles) awningIcicles(ctx, x, y - 1.02 * k, 2.8 * k, k, look.icicles, t);
    else icicles(ctx, x - 1.4 * k, y - 1.05 * k, 2.8 * k, k * 0.5, 7);
    // lanterns (more with levels)
    const lanterns = level >= 10 ? 3 : 2;
    for (let i = 0; i < lanterns; i++) {
      const lx = x - 1.0 * k + (i * 2.0 * k) / (lanterns - 1);
      line(ctx, lx, y - 1.05 * k, lx, y - 0.85 * k, 0.025 * k, '#5d88bb');
      glow(ctx, lx, y - 0.78 * k, 0.16 * k, look ? look.lights[i % 3] : '#ffd77a', 0.75 + Math.sin(t * 2 + i) * 0.1);
    }
    if (level >= 25) plaque(ctx, x, y - 2.25 * k, k, 'FROSTMARKT', '#9fe8ff');
    if (o.saleGlow > 0) glow(ctx, x, y - 0.9 * k, 1 * k, '#9fe8ff', o.saleGlow * 0.6);
    plaque(ctx, x, y + 0.18 * k, k, 'Frostmarkt Lv ' + level, '#9fe8ff');
    return { x0: x - 1.7 * k, y0: y - 2.0 * k, x1: x + 1.7 * k, y1: y + 0.6 * k, counter: { x0: x - 1.1 * k, y0: y - 1.0 * k, x1: x + 1.1 * k, y1: y } };
  }

  // ----- Beta 1.9 M1: tiers for the planet-specific buildings (Eis-/Basalt-/Wurzellager, Frost-/Glut-/Blütenmarkt,
  // Glutschmelze, Präzisionswerkstatt, Sporengarten, Biolabor). Their own art barely changed with the level; annexes
  // in the world's style stand behind them (drawn first): a silo or lantern row (Lv 10), a tower or gate (Lv 25), a
  // dome, beacon or landmark (Lv 50). The building itself and its tap area stay as they were.
  const ANNEX_STYLE = {
    ice: { body: '#e9f7ff', trim: '#8fe3ff', dark: '#6fb6c9', glow: '#c8fbff' },
    volcanic: { body: '#4a3a4a', trim: '#ff8a3a', dark: '#2f2433', glow: '#ffb35a' },
    machine: { body: '#c9d2ea', trim: '#8ff0d4', dark: '#6f7da8', glow: '#8ff0d4' },
    verdant: { body: '#c8a46a', trim: '#7fd08a', dark: '#7a5a38', glow: '#e8ff9a' }
  };
  function planetAnnex(ctx, kind, x, y, k, level, planet, t, active) {
    const s = ANNEX_STYLE[planet];
    if (!s || !(level >= 10)) return;
    const market = kind === 'stall',
      side = kind === 'depot' ? 1 : -1;
    if (market) {
      // Lv 10: a lantern row in the world's light; Lv 25: a gate arch over the way in; Lv 50: a beacon with the light
      for (let i = 0; i < 4; i++) {
        const lx = x - 1.9 * k + i * 1.25 * k;
        line(ctx, lx, y, lx, y - 1.5 * k, 0.05 * k, s.dark);
        glow(ctx, lx, y - 1.55 * k, 0.13 * k, s.glow, 0.75 + 0.2 * Math.sin(t * 2 + i));
      }
      if (level >= 25) {
        ctx.strokeStyle = s.trim;
        ctx.lineWidth = 0.14 * k;
        ctx.beginPath();
        ctx.arc(x, y, 2.3 * k, Math.PI * 1.08, Math.PI * 1.92);
        ctx.stroke();
      }
      if (level >= 50) {
        const bx = x + 2.4 * k;
        fillRR(ctx, bx - 0.2 * k, y - 3.2 * k, 0.4 * k, 3.2 * k, 0.12 * k, s.body);
        fillRR(ctx, bx - 0.32 * k, y - 3.45 * k, 0.64 * k, 0.32 * k, 0.12 * k, s.trim);
        glow(ctx, bx, y - 3.3 * k, 0.45 * k, s.glow, active ? 0.7 + 0.2 * Math.sin(t * 3) : 0.4);
      }
      return;
    }
    // Lv 10: a silo or store tower beside it (its band glows while the building works)
    const sx = x + side * 2.1 * k;
    fillRR(ctx, sx - 0.38 * k, y - 1.9 * k, 0.76 * k, 1.9 * k, 0.32 * k, s.body);
    fillRR(ctx, sx - 0.38 * k, y - 1.25 * k, 0.76 * k, 0.12 * k, 0.05 * k, active ? s.trim : s.dark);
    if (level >= 25) {
      // Lv 25: a lattice tower behind, crowned with the world's light
      const tx = x - side * 1.3 * k,
        top = y - 3.1 * k;
      line(ctx, tx - 0.4 * k, y, tx - 0.1 * k, top, 0.06 * k, s.dark);
      line(ctx, tx + 0.4 * k, y, tx + 0.1 * k, top, 0.06 * k, s.dark);
      for (let yy = y - 0.5 * k; yy > top + 0.2 * k; yy -= 0.5 * k) {
        const half = 0.4 * k - 0.3 * k * ((y - yy) / (y - top));
        line(ctx, tx - half, yy, tx + half, yy, 0.035 * k, s.dark);
      }
      glow(ctx, tx, top, 0.22 * k, s.glow, active ? 0.95 : 0.5);
    }
    if (level >= 50) {
      // Lv 50: a dome behind the building, lit from inside while it works
      ctx.fillStyle = s.body + 'cc';
      ctx.beginPath();
      ctx.ellipse(x + side * 0.4 * k, y, 1.9 * k, 2.4 * k, 0, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = s.trim;
      ctx.lineWidth = 0.06 * k;
      ctx.beginPath();
      ctx.ellipse(x + side * 0.4 * k, y, 1.9 * k, 2.4 * k, 0, Math.PI, 0);
      ctx.stroke();
      glow(ctx, x + side * 0.4 * k, y - 1.6 * k, 1.1 * k, s.glow, active ? 0.35 + 0.1 * Math.sin(t * 2) : 0.15);
    }
  }

  // ----- Beta 1.9 M1: a small cargo drone (Lv 100 tiers): body, rotor glow, optional crate under it -----
  function drone(ctx, x, y, k, t, carry) {
    fillRR(ctx, x - 0.28 * k, y - 0.1 * k, 0.56 * k, 0.2 * k, 0.09 * k, '#e8e4fa');
    line(ctx, x - 0.42 * k, y - 0.14 * k, x + 0.42 * k, y - 0.14 * k, 0.03 * k, C.metalDark);
    glow(ctx, x - 0.42 * k, y - 0.16 * k, 0.1 * k, C.mint, 0.5 + 0.3 * Math.sin(t * 20));
    glow(ctx, x + 0.42 * k, y - 0.16 * k, 0.1 * k, C.mint, 0.5 + 0.3 * Math.cos(t * 20));
    if (carry) {
      line(ctx, x, y + 0.1 * k, x, y + 0.22 * k, 0.02 * k, C.ink);
      crate(ctx, x, y + 0.48 * k, 0.26 * k, carry, '#c98a2a');
    }
  }

  // ----- Beta 1.9 M2/M3: the hand-overs' carriers (logistics.js) -----
  // A load as the economy holds it: crystals (raw), crates (packed) or gold bars, 1–3 pieces by the run's real fill.
  function haulLoad(ctx, x, y, k, goods, fill, accent) {
    const n = fill > 0.02 ? Math.max(1, Math.min(3, Math.round(fill * 3))) : 0;
    for (let i = 0; i < n; i++) {
      const lx = x + (i - (n - 1) / 2) * 0.24 * k,
        ly = y - (i === 1 ? 0.08 * k : 0);
      if (goods === 'bars') {
        fillRR(ctx, lx - 0.14 * k, ly - 0.1 * k, 0.28 * k, 0.1 * k, 0.025 * k, '#ffd23a');
        fillRR(ctx, lx - 0.1 * k, ly - 0.18 * k, 0.2 * k, 0.09 * k, 0.025 * k, '#ffe38a');
      } else if (goods === 'packed') crate(ctx, lx, ly, 0.26 * k, '#ffc95a', '#c98a2a');
      else crystal(ctx, lx, ly - 0.06 * k, 0.24 * k, i % 2 ? accent : '#fff4ff', 0);
    }
  }
  // The carrier by tier (the kitten that moves it is drawn by the scene): 2 a wheelbarrow, 3 a small wagon on four
  // wheels, 4 a hover pallet. Each world builds its own: Glacies slides on runners (sled, hooded sled), Pyra's carts
  // are dark heat-shielded metal with a glowing rim, Mekhanos rolls robot carts with a status light, Viridia carries
  // in woven baskets and leaf wagons. o: { tier, dir, goods, fill, tilt, time, accent, planet }.
  function haulCarrier(ctx, x, y, k, o) {
    const sk = vehicleSkin(o.skin),
      paint = (def, part = 'body') => (sk ? sk[part] : def),
      orn = (x0, y0, w, h) => vehicleOrnament(ctx, sk, x0, y0, w, h, k, o.time || 0, { loaded: (o.fill || 0) > 0.02, moving: Boolean(o.moving), reduced: o.reduced });
    ctx.save();
    ctx.translate(x, y);
    if (o.dir < 0) ctx.scale(-1, 1);
    if (o.tilt) {
      ctx.translate(0.3 * k, -0.1 * k);
      ctx.rotate(-o.tilt);
      ctx.translate(-0.3 * k, 0.1 * k);
    }
    const wheel = (wx, r) => {
      ctx.fillStyle = C.ink;
      ctx.beginPath();
      ctx.arc(wx * k, -0.06 * k, r * k, 0, TAU);
      ctx.fill();
      ctx.fillStyle = C.metal;
      ctx.beginPath();
      ctx.arc(wx * k, -0.06 * k, r * 0.45 * k, 0, TAU);
      ctx.fill();
    };
    if (o.tier >= 4) {
      const hover = Math.sin((o.time || 0) * 3 + x * 0.01) * 0.035 * k;
      ctx.translate(0, hover - 0.16 * k);
      glow(ctx, 0, 0.1 * k, 0.45 * k, C.mint, 0.35);
      fillRR(ctx, -0.42 * k, -0.2 * k, 0.84 * k, 0.16 * k, 0.07 * k, paint('#e8e4fa'));
      fillRR(ctx, -0.42 * k, -0.07 * k, 0.84 * k, 0.05 * k, 0.025 * k, paint(o.accent, 'trim'));
      haulLoad(ctx, 0, -0.2 * k, k, o.goods, o.fill, o.accent);
    } else if (o.planet === 'ice') {
      // a sled on two runners (tier 3: with a hood against the snow)
      haulLoad(ctx, 0, -0.36 * k, k, o.goods, o.fill, o.accent);
      fillRR(ctx, -0.42 * k, -0.36 * k, 0.84 * k, 0.24 * k, 0.06 * k, paint(o.tier === 3 ? '#9fd8ff' : '#d9ecff'));
      orn(-0.42 * k, -0.36 * k, 0.84 * k, 0.24 * k);
      line(ctx, -0.5 * k, -0.04 * k, 0.42 * k, -0.04 * k, 0.05 * k, paint(C.metalDark, 'dark'));
      ctx.strokeStyle = C.metalDark;
      ctx.lineWidth = 0.05 * k;
      ctx.beginPath();
      ctx.arc(0.42 * k, -0.14 * k, 0.1 * k, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      [-0.25, 0.2].forEach(sx => line(ctx, sx * k, -0.12 * k, sx * k, -0.04 * k, 0.04 * k, C.metalDark));
      if (o.tier === 3) {
        ctx.fillStyle = 'rgba(200,236,255,0.55)';
        ctx.beginPath();
        ctx.ellipse(-0.05 * k, -0.4 * k, 0.4 * k, 0.26 * k, 0, Math.PI, 0);
        ctx.fill();
      }
      line(ctx, 0.5 * k, -0.2 * k, 0.82 * k, -0.2 * k, 0.04 * k, C.metalDark); // the pull bar (P1: at paw height)
    } else if (o.planet === 'volcanic') {
      // a heat-shielded cart of dark metal with a glowing rim
      haulLoad(ctx, 0, -0.44 * k, k, o.goods, o.fill, o.accent);
      fillRR(ctx, -0.42 * k, -0.46 * k, 0.84 * k, 0.34 * k, 0.05 * k, paint('#4a3a4a'));
      orn(-0.42 * k, -0.46 * k, 0.84 * k, 0.34 * k);
      line(ctx, -0.42 * k, -0.46 * k, 0.42 * k, -0.46 * k, 0.05 * k, '#ff8a3a');
      glow(ctx, 0, -0.3 * k, 0.35 * k, '#ff8a3a', 0.25);
      if (o.tier === 3) [-0.28, 0.28].forEach(wx => wheel(wx, 0.1));
      else {
        line(ctx, -0.3 * k, -0.2 * k, -0.68 * k, -0.16 * k, 0.045 * k, '#2f2433');
        wheel(0.27, 0.12);
      }
    } else if (o.planet === 'machine') {
      // a little robot cart: a rounded body, a status light, rolling on its own (the kitten guides it)
      haulLoad(ctx, 0, -0.44 * k, k, o.goods, o.fill, o.accent);
      fillRR(ctx, -0.4 * k, -0.46 * k, 0.8 * k, 0.36 * k, 0.12 * k, paint('#c9d2ea'));
      orn(-0.4 * k, -0.46 * k, 0.8 * k, 0.36 * k);
      fillRR(ctx, -0.3 * k, -0.38 * k, 0.24 * k, 0.12 * k, 0.04 * k, 'rgba(170,230,255,0.95)');
      glow(ctx, 0.3 * k, -0.52 * k, 0.07 * k, Math.sin((o.time || 0) * 5 + x) > 0 ? C.mint : C.warm, 1);
      [-0.22, 0.22].forEach(wx => wheel(wx, 0.09));
      if (o.tier === 3) wheel(0, 0.09);
    } else if (o.planet === 'verdant') {
      // a woven basket on one wheel (tier 3: a leaf wagon)
      haulLoad(ctx, 0, -0.44 * k, k, o.goods, o.fill, o.accent);
      fillRR(ctx, -0.4 * k, -0.46 * k, 0.8 * k, 0.32 * k, 0.12 * k, paint(o.tier === 3 ? '#7fd08a' : '#c8a46a'));
      orn(-0.4 * k, -0.46 * k, 0.8 * k, 0.32 * k);
      for (let i = 0; i < 4; i++) line(ctx, (-0.3 + i * 0.2) * k, -0.44 * k, (-0.25 + i * 0.2) * k, -0.16 * k, 0.03 * k, o.tier === 3 ? '#4a9a5a' : '#9a7a48');
      if (o.tier === 3) {
        [-0.26, 0.26].forEach(wx => wheel(wx, 0.1));
        poly(ctx, [[0.35 * k, -0.46 * k], [0.62 * k, -0.7 * k], [0.5 * k, -0.42 * k]], '#7fd08a');
      } else {
        line(ctx, -0.3 * k, -0.2 * k, -0.68 * k, -0.16 * k, 0.045 * k, '#7a5a38');
        wheel(0.27, 0.12);
      }
    } else if (o.tier === 3) {
      haulLoad(ctx, 0, -0.42 * k, k, o.goods, o.fill, o.accent);
      fillRR(ctx, -0.44 * k, -0.44 * k, 0.88 * k, 0.32 * k, 0.07 * k, paint('#8fb4e8'));
      orn(-0.44 * k, -0.44 * k, 0.88 * k, 0.32 * k);
      line(ctx, -0.44 * k, -0.44 * k, 0.44 * k, -0.44 * k, 0.04 * k, paint(C.metalDark, 'dark'));
      line(ctx, 0.44 * k, -0.26 * k, 0.8 * k, -0.2 * k, 0.04 * k, C.metalDark); // the drawbar the kitten pulls
      [-0.28, 0.28].forEach(wx => wheel(wx, 0.1));
    } else {
      haulLoad(ctx, 0.02 * k, -0.42 * k, k, o.goods, o.fill, o.accent);
      poly(ctx, [[-0.36 * k, -0.44 * k], [0.36 * k, -0.44 * k], [0.25 * k, -0.13 * k], [-0.26 * k, -0.13 * k]], paint(C.wood));
      orn(-0.26 * k, -0.42 * k, 0.52 * k, 0.28 * k);
      line(ctx, -0.36 * k, -0.44 * k, 0.36 * k, -0.44 * k, 0.045 * k, paint(C.woodDark, 'dark'));
      line(ctx, -0.26 * k, -0.18 * k, -0.66 * k, -0.16 * k, 0.045 * k, C.woodDark);
      line(ctx, -0.1 * k, -0.13 * k, -0.17 * k, 0, 0.045 * k, C.woodDark);
      wheel(0.27, 0.12);
    }
    ctx.restore();
  }

  // ----- P1.5 Cosmetics 2.1: the vehicle paint, the depot roofs, the planet decorations -----
  // A vehicle look paints the vehicles the economy already moves (no extra vehicle is drawn): the body, its dark rim,
  // the cab and an ornament. Each world keeps its own carrier shape (sled, heat cart, robot cart, basket). The ornament
  // follows the real state: the ember seams glow only while the vehicle carries a load, the brass cog turns only
  // while it drives.
  const VEHICLE_SKINS = {
    'vehicle-mint': { body: '#8fe8c8', dark: '#3f9c80', trim: '#fff4e2', cab: '#c8fff0', ornament: 'stripe' },
    'vehicle-ember': { body: '#3a2a36', dark: '#1f161d', trim: '#ff8a3a', cab: '#5a3a44', ornament: 'seams', glow: '#ffb35a' },
    'vehicle-brass': { body: '#e0b25a', dark: '#8a5a1a', trim: '#7a4a1a', cab: '#f0cf8a', ornament: 'rivets' }
  };
  const vehicleSkin = id => VEHICLE_SKINS[id] || null;
  // the ornament on a body box (local coordinates of the vehicle): o.loaded / o.moving are the vehicle's real state
  function vehicleOrnament(ctx, skin, x0, y0, w, h, k, t, o = {}) {
    if (!skin) return;
    if (skin.ornament === 'stripe') {
      fillRR(ctx, x0, y0 + h * 0.42, w, h * 0.2, Math.min(h * 0.1, 0.04 * k), skin.trim);
    } else if (skin.ornament === 'seams') {
      // two cracks of glowing heat; dark when the vehicle runs empty
      const on = o.loaded ? 0.75 + (o.reduced ? 0 : Math.sin(t * 3 + x0) * 0.2) : 0.18;
      ctx.save();
      ctx.globalAlpha = on;
      ctx.strokeStyle = skin.trim;
      ctx.lineWidth = Math.max(1, 0.035 * k);
      ctx.lineJoin = 'round';
      for (const [fx, dir] of [[0.28, 1], [0.7, -1]]) {
        ctx.beginPath();
        ctx.moveTo(x0 + w * fx, y0 + h * 0.12);
        ctx.lineTo(x0 + w * fx + dir * w * 0.06, y0 + h * 0.45);
        ctx.lineTo(x0 + w * fx - dir * w * 0.03, y0 + h * 0.62);
        ctx.lineTo(x0 + w * fx + dir * w * 0.05, y0 + h * 0.9);
        ctx.stroke();
      }
      ctx.restore();
      if (o.loaded) glow(ctx, x0 + w / 2, y0 + h / 2, Math.max(w, h) * 0.6, skin.glow, 0.22 * on);
    } else if (skin.ornament === 'rivets') {
      ctx.fillStyle = skin.trim;
      const n = Math.max(3, Math.round(w / (0.16 * k)));
      for (let i = 0; i < n; i++) {
        ctx.beginPath();
        ctx.arc(x0 + ((i + 0.5) * w) / n, y0 + h * 0.2, Math.max(0.6, 0.025 * k), 0, TAU);
        ctx.fill();
      }
      // the little cog on the side turns only while the vehicle drives
      const a = o.moving && !o.reduced ? t * 3 : 0.3,
        cx = x0 + w * 0.5,
        cy = y0 + h * 0.62,
        r = Math.min(h * 0.32, 0.11 * k);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a);
      ctx.fillStyle = skin.trim;
      ctx.beginPath();
      for (let i = 0; i < 12; i++) {
        const ang = (i / 12) * TAU,
          d = i % 2 ? r * 0.7 : r;
        i ? ctx.lineTo(Math.cos(ang) * d, Math.sin(ang) * d) : ctx.moveTo(d, 0);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = skin.cab;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.32, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }
  // The depot's roof (the second building slot): the look replaces the roof's surface on every planet – Orion's
  // pitched roof, Glacies' snow dome, Pyra's basalt vault, Viridia's root cap – and adds its crown. The brass vent turns
  // only while goods roll into the depot (o.active); the blossoms sway in the wind (still with reduced motion).
  const DEPOT_SKINS = {
    'depot-brass': { roof: ['#f6cf7a', '#b8862e'], trim: '#7a4a1a', pattern: 'seams', apex: 'gear' },
    'depot-blossom': { roof: ['#ffd3e6', '#ff8fbd'], trim: '#fff0f6', pattern: 'shingles', apex: 'flower' }
  };
  // path(ctx) builds the roof's outline; box = its bounds; apex = where the crown sits
  function roofLook(ctx, id, path, box, apex, k, t, o = {}) {
    const skin = DEPOT_SKINS[id];
    if (!skin) return false;
    const g = ctx.createLinearGradient(0, box.y0, 0, box.y1);
    g.addColorStop(0, skin.roof[0]);
    g.addColorStop(1, skin.roof[1]);
    ctx.save();
    ctx.beginPath();
    path(ctx);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.clip();
    if (skin.pattern === 'seams') {
      // brass plates: seams across, a row of rivets on each
      for (let y = box.y0 + 0.22 * k; y < box.y1; y += 0.24 * k) {
        line(ctx, box.x0, y, box.x1, y, 0.025 * k, 'rgba(122,74,26,0.55)');
        ctx.fillStyle = 'rgba(255,240,200,0.8)';
        for (let x = box.x0 + 0.12 * k; x < box.x1; x += 0.3 * k) {
          ctx.beginPath();
          ctx.arc(x, y - 0.06 * k, 0.025 * k, 0, TAU);
          ctx.fill();
        }
      }
    } else {
      // petal shingles: rows of scallops, every other row shifted
      let row = 0;
      for (let y = box.y0 + 0.12 * k; y < box.y1 + 0.2 * k; y += 0.18 * k, row++)
        for (let x = box.x0 - (row % 2) * 0.12 * k; x < box.x1 + 0.2 * k; x += 0.24 * k) {
          ctx.fillStyle = (row + Math.round(x / k)) % 3 ? 'rgba(255,255,255,0.32)' : 'rgba(255,111,168,0.35)';
          ctx.beginPath();
          ctx.ellipse(x, y, 0.13 * k, 0.1 * k, 0, 0, Math.PI);
          ctx.fill();
        }
    }
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    path(ctx);
    ctx.strokeStyle = skin.trim;
    ctx.lineWidth = 0.05 * k;
    ctx.stroke();
    ctx.restore();
    if (skin.apex === 'gear') {
      // the vent: a cog on a short stack, turning while goods come in
      fillRR(ctx, apex.x - 0.08 * k, apex.y - 0.3 * k, 0.16 * k, 0.3 * k, 0.04 * k, skin.trim);
      ctx.save();
      ctx.translate(apex.x, apex.y - 0.38 * k);
      ctx.rotate(o.active && !o.reduced ? t * 2.4 : 0);
      ctx.fillStyle = skin.roof[0];
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU,
          d = (i % 2 ? 0.15 : 0.21) * k;
        i ? ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d) : ctx.moveTo(d, 0);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = skin.trim;
      ctx.lineWidth = 0.025 * k;
      ctx.stroke();
      for (let i = 0; i < 4; i++) line(ctx, 0, 0, Math.cos((i / 4) * TAU) * 0.12 * k, Math.sin((i / 4) * TAU) * 0.12 * k, 0.025 * k, skin.trim);
      ctx.restore();
    } else {
      // a flower on the ridge with two leaves that sway
      const sway = o.reduced ? 0 : Math.sin(t * 1.6) * 0.12;
      ctx.save();
      ctx.translate(apex.x, apex.y);
      ctx.rotate(sway);
      for (const side of [-1, 1]) {
        ctx.fillStyle = '#7fd08a';
        ctx.beginPath();
        ctx.ellipse(side * 0.16 * k, -0.08 * k, 0.16 * k, 0.06 * k, side * 0.5, 0, TAU);
        ctx.fill();
      }
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU - Math.PI / 2;
        ctx.fillStyle = i % 2 ? '#ffb8da' : '#ff8fbd';
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * 0.1 * k, -0.22 * k + Math.sin(a) * 0.1 * k, 0.09 * k, 0.06 * k, a, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#ffe26b';
      ctx.beginPath();
      ctx.arc(0, -0.22 * k, 0.05 * k, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    return true;
  }
  // A stall look's real roof on a planet stall: the stripes of the awning across the planet's own roof shape, its trim
  // along the edge (path builds the roof outline, box its bounds).
  function stallRoof(ctx, id, path, box, k) {
    const skin = STALL_SKINS[id];
    if (!skin) return null;
    ctx.save();
    ctx.beginPath();
    path(ctx);
    ctx.fillStyle = skin.awning[1];
    ctx.fill();
    ctx.clip();
    const n = 7,
      w = (box.x1 - box.x0) / n;
    ctx.fillStyle = skin.awning[0];
    for (let i = 0; i < n; i += 2) ctx.fillRect(box.x0 + i * w, box.y0 - k, w, box.y1 - box.y0 + 2 * k);
    // a soft shade under the edge
    const g = ctx.createLinearGradient(0, box.y0, 0, box.y1);
    g.addColorStop(0, 'rgba(255,255,255,0.18)');
    g.addColorStop(1, 'rgba(40,30,70,0.18)');
    ctx.fillStyle = g;
    ctx.fillRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    path(ctx);
    ctx.strokeStyle = skin.roof;
    ctx.lineWidth = 0.06 * k;
    ctx.stroke();
    ctx.restore();
    return skin;
  }

  // Planet decorations (slot 'decor', one per world): standing in front of the colony's home. They react to the world:
  // the cat fountain freezes on Glacies while the colony is not heated (it thaws and steams once it is), steams on Pyra,
  // has moss on Viridia; the flower arch opens its blossoms once the planet is freed. o: { planet, time, reduced, warm,
  // freed }. Returns the tap box.
  function decor(ctx, id, x, y, k, o = {}) {
    const t = o.time || 0,
      reduced = o.reduced;
    shadow(ctx, x, y, 1.9 * k, k);
    if (id === 'decor-fountain') {
      const frozen = o.planet === 'ice' && o.warm === false,
        stone = o.planet === 'volcanic' ? '#6a5a72' : o.planet === 'ice' ? '#d9ecf7' : o.planet === 'machine' ? '#b9c2dc' : '#d9d3f5',
        stoneDark = o.planet === 'volcanic' ? '#4a3a52' : o.planet === 'ice' ? '#9fc4dc' : o.planet === 'machine' ? '#8a94b8' : '#a9a0d8',
        water = frozen ? '#e8fbff' : o.planet === 'volcanic' ? '#8fe3ff' : '#7fd4ff';
      // basin
      fillRR(ctx, x - 0.85 * k, y - 0.42 * k, 1.7 * k, 0.42 * k, 0.16 * k, stone);
      ctx.fillStyle = stoneDark;
      ctx.beginPath();
      ctx.ellipse(x, y - 0.42 * k, 0.85 * k, 0.16 * k, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = water;
      ctx.beginPath();
      ctx.ellipse(x, y - 0.42 * k, 0.72 * k, 0.11 * k, 0, 0, TAU);
      ctx.fill();
      if (o.planet === 'verdant')
        for (let i = 0; i < 4; i++) fillRR(ctx, x - 0.8 * k + i * 0.48 * k, y - 0.2 * k, 0.26 * k, 0.1 * k, 0.05 * k, '#7fd08a');
      if (o.planet === 'machine') line(ctx, x - 0.85 * k, y - 0.24 * k, x + 0.85 * k, y - 0.24 * k, 0.05 * k, '#e0b25a');
      // pedestal and the sitting cat statue (stone, the tail curled round its paws)
      fillRR(ctx, x - 0.16 * k, y - 0.9 * k, 0.32 * k, 0.5 * k, 0.06 * k, stoneDark);
      const cx = x,
        cy = y - 0.92 * k;
      ctx.fillStyle = stone;
      ctx.beginPath();
      ctx.ellipse(cx, cy - 0.28 * k, 0.24 * k, 0.3 * k, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + 0.04 * k, cy - 0.68 * k, 0.2 * k, 0, TAU);
      ctx.fill();
      poly(ctx, [[cx - 0.12 * k, cy - 0.8 * k], [cx - 0.08 * k, cy - 1.0 * k], [cx + 0.02 * k, cy - 0.84 * k]], stone);
      poly(ctx, [[cx + 0.06 * k, cy - 0.84 * k], [cx + 0.17 * k, cy - 0.99 * k], [cx + 0.2 * k, cy - 0.78 * k]], stone);
      ctx.strokeStyle = stone;
      ctx.lineWidth = 0.07 * k;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - 0.2 * k, cy - 0.1 * k);
      ctx.quadraticCurveTo(cx - 0.42 * k, cy - 0.05 * k, cx - 0.3 * k, cy + 0.04 * k);
      ctx.stroke();
      ctx.fillStyle = stoneDark;
      ctx.beginPath();
      ctx.arc(cx + 0.1 * k, cy - 0.7 * k, 0.025 * k, 0, TAU);
      ctx.arc(cx - 0.02 * k, cy - 0.7 * k, 0.025 * k, 0, TAU);
      ctx.fill();
      if (o.planet === 'machine') line(ctx, cx - 0.14 * k, cy - 0.5 * k, cx + 0.2 * k, cy - 0.5 * k, 0.04 * k, '#e0b25a'); // a brass collar
      if (o.planet === 'verdant') glow(ctx, cx - 0.1 * k, cy - 0.92 * k, 0.1 * k, '#ff9ecb', 0.9); // a flower behind the ear
      // the water: an arc from the mouth into the basin (droplets run along it); frozen = a still ice arc that glints
      const mx = cx + 0.22 * k,
        my = cy - 0.62 * k,
        ex = x + 0.62 * k,
        ey = y - 0.44 * k,
        at = u => ({ x: mx + (ex - mx) * u, y: my + (ey - my) * u * u - Math.sin(u * Math.PI) * 0.18 * k });
      ctx.strokeStyle = frozen ? 'rgba(232,251,255,0.95)' : 'rgba(127,212,255,0.7)';
      ctx.lineWidth = (frozen ? 0.07 : 0.05) * k;
      ctx.beginPath();
      for (let i = 0; i <= 10; i++) {
        const p = at(i / 10);
        i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
      }
      ctx.stroke();
      if (frozen) {
        const g = at(reduced ? 0.5 : (t * 0.4) % 1);
        glow(ctx, g.x, g.y, 0.12 * k, '#ffffff', 0.9);
        for (let i = 0; i < 3; i++) poly(ctx, [[x - 0.4 * k + i * 0.35 * k, y - 0.42 * k], [x - 0.36 * k + i * 0.35 * k, y - 0.25 * k], [x - 0.32 * k + i * 0.35 * k, y - 0.42 * k]], '#e8fbff');
      } else {
        for (let i = 0; i < 3; i++) {
          const p = at(reduced ? (i + 0.5) / 3 : (t * 0.9 + i / 3) % 1);
          glow(ctx, p.x, p.y, 0.06 * k, '#e8fbff', 0.95);
        }
        // ripples where it lands
        const r = reduced ? 0.5 : (t * 0.8) % 1;
        ctx.strokeStyle = 'rgba(232,251,255,' + (0.7 * (1 - r)).toFixed(3) + ')';
        ctx.lineWidth = 0.025 * k;
        ctx.beginPath();
        ctx.ellipse(ex, ey + 0.02 * k, 0.1 * k + r * 0.25 * k, 0.03 * k + r * 0.05 * k, 0, 0, TAU);
        ctx.stroke();
        // warm water steams (Pyra always, Glacies once heated)
        if ((o.planet === 'volcanic' || o.planet === 'ice') && !reduced)
          for (let i = 0; i < 2; i++) {
            const q = (t * 0.35 + i * 0.5) % 1;
            glow(ctx, x - 0.25 * k + i * 0.5 * k, y - 0.55 * k - q * 0.7 * k, (0.12 + q * 0.2) * k, '#ffffff', 0.28 * (1 - q));
          }
      }
      return { x0: x - 0.95 * k, y0: y - 2.05 * k, x1: x + 0.95 * k, y1: y + 0.1 * k };
    }
    if (id === 'decor-bloomarch') {
      // two posts, an arch of vine; seven blossoms, open once the planet is freed (closed buds before)
      const open = o.freed ? 1 : 0.35,
        sway = reduced ? 0 : Math.sin(t * 1.3) * 0.04 * k;
      for (const side of [-1, 1]) fillRR(ctx, x + side * 0.85 * k - 0.07 * k, y - 1.6 * k, 0.14 * k, 1.6 * k, 0.05 * k, '#8a6a48');
      ctx.strokeStyle = '#4a9a5a';
      ctx.lineWidth = 0.1 * k;
      ctx.beginPath();
      ctx.moveTo(x - 0.85 * k, y - 1.55 * k);
      ctx.quadraticCurveTo(x + sway, y - 2.5 * k, x + 0.85 * k, y - 1.55 * k);
      ctx.stroke();
      for (let i = 0; i < 7; i++) {
        const u = i / 6,
          bx = (1 - u) * (1 - u) * (x - 0.85 * k) + 2 * u * (1 - u) * (x + sway) + u * u * (x + 0.85 * k),
          by = (1 - u) * (1 - u) * (y - 1.55 * k) + 2 * u * (1 - u) * (y - 2.5 * k) + u * u * (y - 1.55 * k),
          r = (0.08 + 0.08 * open) * k;
        if (!o.freed) {
          // a closed bud: a green calyx and a pink tip, nodding in the wind
          ctx.save();
          ctx.translate(bx, by);
          ctx.rotate(reduced ? 0 : Math.sin(t * 1.5 + i) * 0.15);
          ctx.fillStyle = i % 2 ? '#ff8fbd' : '#ffb8da';
          ctx.beginPath();
          ctx.ellipse(0, -0.07 * k, 0.06 * k, 0.1 * k, 0, 0, TAU);
          ctx.fill();
          ctx.fillStyle = '#4a9a5a';
          ctx.beginPath();
          ctx.ellipse(0, 0, 0.07 * k, 0.05 * k, 0, 0, Math.PI);
          ctx.fill();
          ctx.restore();
          continue;
        }
        for (let p = 0; p < 5; p++) {
          const a = (p / 5) * TAU + i + (reduced ? 0 : Math.sin(t + i) * 0.1);
          ctx.fillStyle = i % 2 ? '#ff8fbd' : '#ffb8da';
          ctx.beginPath();
          ctx.ellipse(bx + Math.cos(a) * r * 0.8, by + Math.sin(a) * r * 0.8, r * 0.7, r * 0.45, a, 0, TAU);
          ctx.fill();
        }
        ctx.fillStyle = '#ffe26b';
        ctx.beginPath();
        ctx.arc(bx, by, r * 0.35, 0, TAU);
        ctx.fill();
      }
      if (o.freed) glow(ctx, x, y - 2.1 * k, 0.9 * k, '#ff9ecb', reduced ? 0.18 : 0.14 + Math.sin(t * 1.4) * 0.05);
      return { x0: x - 1.05 * k, y0: y - 2.7 * k, x1: x + 1.05 * k, y1: y + 0.1 * k };
    }
    return null;
  }
  window.ColonyArt = {
    C,
    VEHICLE_SKINS,
    DEPOT_SKINS,
    vehicleSkin,
    vehicleOrnament,
    roofLook,
    stallRoof,
    decor,
    glow,
    haulLoad,
    haulCarrier,
    planetAnnex,
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
    crowdBadge,
    beginLabels,
    endLabels,
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
    prop,
    stallAccent,
    STALL_SKINS
  };
})();
