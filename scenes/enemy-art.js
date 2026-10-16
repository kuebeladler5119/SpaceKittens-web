// Beta 1.3 — story enemies of the Feldzüge (original art). Orion: the M.O.T.T.E. inspection force — bureaucracy robots
// in the M.O.T.T.E. shell language (lilac-white shell, navy visor, red inspection light, amber M.O.T.T.E. ring).
// Unit space like NebulaArt.drawEnemy: origin = body centre, radius ≈ 0.45, facing the player (left). Every visual state
// (armour plate, seal shield, reinforcement call) is handed in from the real fight state; nothing here decides anything.
(function () {
  const TAU = Math.PI * 2;
  const A = () => window.NebulaArt;
  const SHELL = ['#f4f2ff', '#a9b0d8'],
    VISOR = '#2a2f5a',
    EYE = '#ff8f8f',
    AMBER = '#ffb35a';

  function shell(ctx, y0, y1, hit) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, hit ? '#ffffff' : SHELL[0]);
    g.addColorStop(1, hit ? '#ffffff' : SHELL[1]);
    return g;
  }
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  }
  // visor band with the inspection eye (looks left at the ship; scans while `scan`)
  function visor(ctx, x, y, w, h, time, mood, scan = false) {
    const Art = A();
    ctx.fillStyle = VISOR;
    rr(ctx, x - w / 2, y - h / 2, w, h, h / 2);
    ctx.fill();
    const ex = x - w * 0.18 + (scan ? Math.sin(time * 5) * w * 0.22 : 0);
    if (mood === 'dizzy') {
      ctx.strokeStyle = EYE;
      ctx.lineWidth = h * 0.18;
      ctx.beginPath();
      ctx.arc(ex, y, h * 0.28, time * 8, time * 8 + Math.PI * 1.5);
      ctx.stroke();
      return;
    }
    Art.glowCircle(ctx, ex, y, h * 0.75, EYE, 0.55);
    Art.blob(ctx, ex, y, h * (mood === 'hit' ? 0.18 : 0.3), h * (mood === 'hit' ? 0.12 : 0.3), EYE);
    Art.blob(ctx, ex - h * 0.1, y - h * 0.1, h * 0.09, h * 0.09, '#ffffff');
  }

  // 1 · Stempeldrohne: round inspector drone with a rotor; a big rubber stamp hangs below and stamps in rhythm
  function stamp(ctx, time, o) {
    const Art = A(),
      press = o.reduced ? 0 : Math.max(0, Math.sin(time * 4.2)) ** 6;
    // rotor
    ctx.strokeStyle = '#d8e0ee';
    ctx.lineWidth = 0.035;
    const spin = o.reduced ? 0.2 : Math.sin(time * 28) * 0.28;
    ctx.beginPath();
    ctx.moveTo(-0.28 - spin, -0.5);
    ctx.lineTo(0.28 + spin, -0.5);
    ctx.moveTo(0, -0.5);
    ctx.lineTo(0, -0.36);
    ctx.stroke();
    // stamp on its arm
    const sy = 0.34 + press * 0.12;
    ctx.fillStyle = '#7a8094';
    ctx.fillRect(-0.025, 0.2, 0.05, sy - 0.18);
    ctx.fillStyle = '#c9a77a';
    rr(ctx, -0.09, sy - 0.04, 0.18, 0.12, 0.05);
    ctx.fill();
    ctx.fillStyle = '#e0565a';
    rr(ctx, -0.17, sy + 0.07, 0.34, 0.07, 0.02);
    ctx.fill();
    if (press > 0.6 && !o.reduced) Art.glowCircle(ctx, 0, sy + 0.16, 0.16, '#ff8f8f', 0.5);
    // body
    ctx.fillStyle = shell(ctx, -0.38, 0.3, o.hit);
    ctx.beginPath();
    ctx.ellipse(0, -0.06, 0.38, 0.32, 0, 0, TAU);
    ctx.fill();
    visor(ctx, 0, -0.1, 0.56, 0.18, time, o.mood);
    Art.motteSymbol(ctx, 0.0, 0.12, 0.07, AMBER);
  }

  // 2 · Formularfalter: a paper moth — four form-sheet wings (lines of print) beating around a small shell body
  function moth(ctx, time, o) {
    const Art = A(),
      beat = o.reduced ? 0.75 : 0.55 + Math.abs(Math.sin(time * 9)) * 0.45;
    const wing = (side, up) => {
      ctx.save();
      ctx.scale(side * beat, 1);
      ctx.rotate(up ? -0.35 : 0.3);
      ctx.fillStyle = o.hit ? '#ffffff' : '#fbf6e8';
      ctx.strokeStyle = '#c9bfa3';
      ctx.lineWidth = 0.015;
      rr(ctx, 0.04, up ? -0.34 : 0.0, 0.36, up ? 0.32 : 0.24, 0.05);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#9aa3c8';
      ctx.lineWidth = 0.012;
      for (let i = 0; i < (up ? 4 : 3); i++) {
        const y = (up ? -0.28 : 0.05) + i * 0.065;
        ctx.beginPath();
        ctx.moveTo(0.09, y);
        ctx.lineTo(0.09 + (i % 2 ? 0.2 : 0.26), y);
        ctx.stroke();
      }
      if (up) {
        ctx.fillStyle = '#e0565a';
        ctx.beginPath();
        ctx.arc(0.33, -0.08, 0.035, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    };
    wing(-1, true);
    wing(1, true);
    wing(-1, false);
    wing(1, false);
    // paper-clip antennae
    ctx.strokeStyle = '#c4cbe0';
    ctx.lineWidth = 0.02;
    ctx.beginPath();
    ctx.moveTo(-0.05, -0.18);
    ctx.quadraticCurveTo(-0.14, -0.36, -0.2, -0.34);
    ctx.moveTo(0.05, -0.18);
    ctx.quadraticCurveTo(0.12, -0.36, 0.18, -0.36);
    ctx.stroke();
    ctx.fillStyle = shell(ctx, -0.2, 0.22, o.hit);
    ctx.beginPath();
    ctx.ellipse(0, 0.0, 0.12, 0.22, 0, 0, TAU);
    ctx.fill();
    visor(ctx, 0, -0.08, 0.2, 0.09, time, o.mood);
    Art.motteSymbol(ctx, 0, 0.1, 0.045, AMBER);
  }

  // 3 · Klemmbrett-Käfer: a crawling beetle whose back is a clipboard with a steel clip — the armour plate
  function clip(ctx, time, o) {
    const Art = A(),
      step = o.reduced ? 0 : Math.sin(time * 7);
    // legs
    ctx.strokeStyle = '#5a6080';
    ctx.lineWidth = 0.035;
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const x = -0.22 + i * 0.2,
        lift = (i % 2 ? step : -step) * 0.04;
      ctx.beginPath();
      ctx.moveTo(x, 0.16);
      ctx.lineTo(x - 0.06, 0.32 - lift);
      ctx.stroke();
    }
    // body underneath with face peeking out (left)
    ctx.fillStyle = shell(ctx, -0.1, 0.25, o.hit);
    ctx.beginPath();
    ctx.ellipse(-0.02, 0.1, 0.4, 0.17, 0, 0, TAU);
    ctx.fill();
    visor(ctx, -0.26, 0.1, 0.22, 0.1, time, o.mood);
    // clipboard shell (armour): board, sheet, steel clip; a blue rim while the plate holds
    ctx.save();
    ctx.rotate(-0.08 + (o.reduced ? 0 : step * 0.015));
    ctx.fillStyle = o.hit ? '#ffffff' : '#b98a5a';
    rr(ctx, -0.3, -0.38, 0.6, 0.48, 0.06);
    ctx.fill();
    if (o.armor) {
      ctx.strokeStyle = 'rgba(159,216,255,0.85)';
      ctx.lineWidth = 0.035;
      ctx.stroke();
    }
    ctx.fillStyle = '#fbf6e8';
    rr(ctx, -0.24, -0.3, 0.48, 0.36, 0.02);
    ctx.fill();
    ctx.strokeStyle = '#9aa3c8';
    ctx.lineWidth = 0.014;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(-0.18, -0.2 + i * 0.07);
      ctx.lineTo(0.18 - (i % 2) * 0.08, -0.2 + i * 0.07);
      ctx.stroke();
    }
    ctx.strokeStyle = '#e0565a';
    ctx.lineWidth = 0.02;
    ctx.beginPath();
    ctx.moveTo(0.06, -0.02);
    ctx.lineTo(0.1, 0.02);
    ctx.lineTo(0.18, -0.06);
    ctx.stroke();
    ctx.fillStyle = '#c4cbe0';
    rr(ctx, -0.1, -0.44, 0.2, 0.1, 0.03);
    ctx.fill();
    ctx.fillStyle = '#7a8094';
    rr(ctx, -0.05, -0.41, 0.1, 0.04, 0.02);
    ctx.fill();
    ctx.restore();
    Art.motteSymbol(ctx, 0.2, 0.15, 0.05, AMBER);
  }

  // 4 · Messdrohne: a measuring drone — lens on a telescopic mast, a fold-out ruler arm, scan cone; the antenna
  // light blinks faster the closer its reinforcement call is (o.call 0…1)
  function scan(ctx, time, o) {
    const Art = A(),
      call = o.call || 0;
    // scan cone towards the player
    if (!o.reduced) {
      const a = 0.18 + Math.sin(time * 3) * 0.06;
      ctx.fillStyle = `rgba(255,143,143,${0.06 + call * 0.12})`;
      ctx.beginPath();
      ctx.moveTo(-0.14, -0.24);
      ctx.lineTo(-0.62, -0.24 - a * 1.3);
      ctx.lineTo(-0.62, -0.24 + a * 1.3);
      ctx.closePath();
      ctx.fill();
    }
    // ruler arm
    ctx.save();
    ctx.translate(0.2, 0.1);
    ctx.rotate(0.5 + (o.reduced ? 0 : Math.sin(time * 1.6) * 0.25));
    ctx.fillStyle = '#ffd77a';
    ctx.fillRect(0, -0.03, 0.34, 0.06);
    ctx.fillStyle = '#7a5a2a';
    for (let i = 1; i < 7; i++) ctx.fillRect(i * 0.05, -0.03, 0.008, i % 2 ? 0.025 : 0.04);
    ctx.restore();
    // body
    ctx.fillStyle = shell(ctx, -0.12, 0.34, o.hit);
    rr(ctx, -0.26, -0.04, 0.52, 0.34, 0.12);
    ctx.fill();
    Art.motteSymbol(ctx, 0.12, 0.13, 0.06, AMBER);
    // hover jets
    Art.glowCircle(ctx, -0.16, 0.36, 0.12, '#8fe3ff', 0.7);
    Art.glowCircle(ctx, 0.16, 0.36, 0.12, '#8fe3ff', 0.7);
    // mast + lens head
    ctx.fillStyle = '#7a8094';
    ctx.fillRect(-0.03, -0.24, 0.06, 0.22);
    ctx.fillStyle = shell(ctx, -0.36, -0.08, o.hit);
    ctx.beginPath();
    ctx.ellipse(-0.02, -0.24, 0.19, 0.14, 0, 0, TAU);
    ctx.fill();
    visor(ctx, -0.04, -0.24, 0.26, 0.12, time, o.mood, true);
    // antenna light: blink speed = call progress
    const blink = o.reduced ? 1 : Math.sin(time * (3 + call * 14)) > 0 ? 1 : 0.35;
    ctx.strokeStyle = '#d8e0ee';
    ctx.lineWidth = 0.025;
    ctx.beginPath();
    ctx.moveTo(0.1, -0.34);
    ctx.lineTo(0.16, -0.48);
    ctx.stroke();
    Art.glowCircle(ctx, 0.16, -0.5, 0.1 + call * 0.08, call > 0.7 ? '#ff5a5a' : '#ffd77a', blink);
    Art.blob(ctx, 0.16, -0.5, 0.035, 0.035, call > 0.7 ? '#ff5a5a' : '#ffd77a');
    // call progress ring
    if (call > 0) {
      ctx.strokeStyle = 'rgba(255,90,90,0.85)';
      ctx.lineWidth = 0.03;
      ctx.beginPath();
      ctx.arc(0.16, -0.5, 0.09, -Math.PI / 2, -Math.PI / 2 + TAU * call);
      ctx.stroke();
    }
  }

  // 5 · Siegelkreuzer (elite): a small cruiser carrying a giant wax seal with the M.O.T.T.E. ring; its seal shield
  // telegraphs (warn) and then closes (shield) — both from the real fight phase
  function seal(ctx, time, o) {
    const Art = A();
    ctx.save();
    ctx.scale(1.25, 1.25);
    // engine glow (rear = right)
    Art.glowCircle(ctx, 0.46, 0.02, 0.18, '#8fe3ff', 0.8);
    // hull: rounded wedge pointing at the player
    const g = shell(ctx, -0.3, 0.3, o.hit);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-0.48, 0.02);
    ctx.quadraticCurveTo(-0.3, -0.26, 0.2, -0.24);
    ctx.lineTo(0.44, -0.12);
    ctx.lineTo(0.44, 0.16);
    ctx.lineTo(0.2, 0.26);
    ctx.quadraticCurveTo(-0.3, 0.28, -0.48, 0.02);
    ctx.fill();
    // fins
    ctx.fillStyle = '#5a6fd8';
    ctx.beginPath();
    ctx.moveTo(0.18, -0.22);
    ctx.lineTo(0.36, -0.42);
    ctx.lineTo(0.42, -0.14);
    ctx.closePath();
    ctx.moveTo(0.18, 0.24);
    ctx.lineTo(0.36, 0.42);
    ctx.lineTo(0.42, 0.14);
    ctx.closePath();
    ctx.fill();
    visor(ctx, -0.22, -0.04, 0.3, 0.12, time, o.mood);
    // the wax seal: red disc with scalloped edge + amber M.O.T.T.E. ring
    const pulse = o.telegraph && !o.reduced ? 0.5 + Math.sin(time * 10) * 0.5 : 0;
    ctx.fillStyle = o.hit ? '#ffffff' : '#c8343c';
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * TAU,
        r = 0.17 + (i % 2 ? 0.015 : 0);
      i ? ctx.lineTo(0.12 + Math.cos(a) * r, 0.04 + Math.sin(a) * r) : ctx.moveTo(0.12 + Math.cos(a) * r, 0.04 + Math.sin(a) * r);
    }
    ctx.fill();
    if (pulse) Art.glowCircle(ctx, 0.12, 0.04, 0.3, '#ffd77a', pulse * 0.6);
    Art.motteSymbol(ctx, 0.12, 0.04, 0.09, '#ffd77a');
    ctx.restore();
    // seal shield: a hexagonal red-gold bubble
    if (o.seal === 'shield' || o.seal === 'warn') {
      const alpha = o.seal === 'shield' ? 0.75 : 0.25 + pulse * 0.35;
      ctx.strokeStyle = `rgba(255,190,110,${alpha})`;
      ctx.fillStyle = `rgba(200,52,60,${o.seal === 'shield' ? 0.16 : 0.05})`;
      ctx.lineWidth = 0.035;
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) {
        const a = (i / 6) * TAU + (o.reduced ? 0 : time * 0.4);
        i ? ctx.lineTo(Math.cos(a) * 0.78, Math.sin(a) * 0.7) : ctx.moveTo(Math.cos(a) * 0.78, Math.sin(a) * 0.7);
      }
      ctx.fill();
      ctx.stroke();
    }
  }

  // 6 · Glutgeist (Beta 1.4 arena, elemental Thermo): a round ember spirit from Orion's old crystal forges
  function ember(ctx, time, o) {
    const Art = A(),
      flick = o.reduced ? 0 : Math.sin(time * 9) * 0.04;
    Art.glowCircle(ctx, 0, 0, 0.62, '#ff9a3a', 0.5);
    for (let i = 0; i < 5; i++) {
      const ang = -Math.PI / 2 + (i - 2) * 0.42,
        len = 0.34 + (i % 2 ? 0.08 : 0.16) + flick * (i % 2 ? -1 : 1);
      ctx.fillStyle = i % 2 ? '#ffd25a' : '#ff7a3a';
      ctx.beginPath();
      ctx.moveTo(Math.cos(ang - 0.2) * 0.3, Math.sin(ang - 0.2) * 0.3);
      ctx.quadraticCurveTo(Math.cos(ang) * (0.3 + len), Math.sin(ang) * (0.3 + len) - 0.05, Math.cos(ang + 0.2) * 0.3, Math.sin(ang + 0.2) * 0.3);
      ctx.fill();
    }
    const g = ctx.createRadialGradient(-0.08, -0.08, 0.05, 0, 0, 0.4);
    g.addColorStop(0, o.hit ? '#ffffff' : '#fff1b8');
    g.addColorStop(0.6, o.hit ? '#ffffff' : '#ffb35a');
    g.addColorStop(1, '#e05a2a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0.04, 0.36, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#5a2030';
    if (o.mood === 'dizzy') {
      ctx.strokeStyle = '#5a2030';
      ctx.lineWidth = 0.03;
      for (const ex of [-0.13, 0.05]) {
        ctx.beginPath();
        ctx.arc(ex, 0, 0.045, time * 8, time * 8 + Math.PI * 1.5);
        ctx.stroke();
      }
    } else
      for (const ex of [-0.13, 0.05]) {
        ctx.beginPath();
        ctx.ellipse(ex, 0.0, 0.045, 0.06, 0, 0, TAU);
        ctx.fill();
      }
    ctx.strokeStyle = '#5a2030';
    ctx.lineWidth = 0.035;
    ctx.beginPath();
    ctx.arc(-0.04, 0.1, 0.06, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }


  // ----- Beta 1.5 · Glacies: the Frostwacht — Frostbyte's frost drones (original art) -----
  // The same unit space; Frostbyte's look: frost-white shells with a cool gradient, a deep-blue visor and a cyan eye,
  // little crystal spikes. Each has one readable silhouette: snowflake, icicle, ice block, fog cloud, crystal knight.
  const FROST = ['#f6fdff', '#9fd2ea'],
    FROST_VISOR = '#1d3a66',
    FROST_EYE = '#7fe8ff';
  function frostShell(ctx, y0, y1, hit) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, hit ? '#ffffff' : FROST[0]);
    g.addColorStop(1, hit ? '#ffffff' : FROST[1]);
    return g;
  }
  function frostEye(ctx, x, y, s, time, mood) {
    const Art = A();
    if (mood === 'dizzy') {
      ctx.strokeStyle = FROST_EYE;
      ctx.lineWidth = s * 0.3;
      ctx.beginPath();
      ctx.arc(x, y, s * 0.6, time * 8, time * 8 + Math.PI * 1.5);
      ctx.stroke();
      return;
    }
    Art.glowCircle(ctx, x, y, s * 1.5, FROST_EYE, 0.5);
    Art.blob(ctx, x, y, s * (mood === 'hit' ? 0.4 : 0.6), s * (mood === 'hit' ? 0.25 : 0.6), FROST_EYE);
    Art.blob(ctx, x - s * 0.2, y - s * 0.2, s * 0.18, s * 0.18, '#ffffff');
  }
  function spike(ctx, x, y, ang, len, w, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(ang + Math.PI / 2) * w, y + Math.sin(ang + Math.PI / 2) * w);
    ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    ctx.lineTo(x + Math.cos(ang - Math.PI / 2) * w, y + Math.sin(ang - Math.PI / 2) * w);
    ctx.closePath();
    ctx.fill();
  }

  // 7 · Frostflocke: a six-armed snowflake drone that spins as it dives at the ship (swarm)
  function flake(ctx, time, o) {
    const Art = A(),
      spin = o.reduced ? 0.3 : time * 2.4;
    Art.glowCircle(ctx, 0, 0, 0.6, '#bff4ff', 0.35);
    ctx.save();
    ctx.rotate(spin);
    ctx.strokeStyle = o.hit ? '#ffffff' : '#dff6ff';
    ctx.lineCap = 'round';
    ctx.lineWidth = 0.07;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU,
        x1 = Math.cos(a) * 0.46,
        y1 = Math.sin(a) * 0.46;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(x1, y1);
      // little side twigs
      for (const k of [0.55, 0.78]) {
        const bx = Math.cos(a) * 0.46 * k,
          by = Math.sin(a) * 0.46 * k;
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(a + 0.7) * 0.11, by + Math.sin(a + 0.7) * 0.11);
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(a - 0.7) * 0.11, by + Math.sin(a - 0.7) * 0.11);
      }
      ctx.stroke();
    }
    ctx.restore();
    // the core with a face
    ctx.fillStyle = frostShell(ctx, -0.2, 0.2, o.hit);
    ctx.beginPath();
    ctx.arc(0, 0, 0.21, 0, TAU);
    ctx.fill();
    frostEye(ctx, -0.07, -0.02, 0.07, time, o.mood);
    frostEye(ctx, 0.07, -0.02, 0.07, time, o.mood);
  }

  // 8 · Eiszapfen-Drohne: a hovering drone with a long icicle lance pointing at the ship (aimed, fast shots)
  function shard(ctx, time, o) {
    const Art = A(),
      bob = o.reduced ? 0 : Math.sin(time * 3) * 0.03;
    ctx.translate(0, bob);
    // twin hover jets
    Art.glowCircle(ctx, 0.12, 0.34, 0.12, '#8fe3ff', 0.7);
    Art.glowCircle(ctx, -0.12, 0.34, 0.12, '#8fe3ff', 0.7);
    // the icicle lance (pointing left at the player)
    const g = ctx.createLinearGradient(-0.62, 0, -0.1, 0);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#7fcdea');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-0.64, 0.02);
    ctx.lineTo(-0.12, -0.09);
    ctx.lineTo(-0.12, 0.13);
    ctx.closePath();
    ctx.fill();
    // body: a rounded shell with three crystal spikes on top
    ctx.fillStyle = frostShell(ctx, -0.32, 0.3, o.hit);
    ctx.beginPath();
    ctx.ellipse(0.06, 0.0, 0.32, 0.29, 0, 0, TAU);
    ctx.fill();
    for (const [x, len] of [[-0.06, 0.22], [0.08, 0.3], [0.22, 0.2]]) spike(ctx, x, -0.24, -Math.PI / 2, len, 0.05, '#bfeaff');
    ctx.fillStyle = FROST_VISOR;
    rr(ctx, -0.2, -0.1, 0.42, 0.15, 0.075);
    ctx.fill();
    frostEye(ctx, -0.08, -0.025, 0.06, time, o.mood);
  }

  // 9 · Gletscherpanzer: a slow, blocky ice tank; its armour is a ring of thick ice plates (heavy, armoured)
  function glacier(ctx, time, o) {
    const Art = A();
    ctx.save();
    ctx.scale(1.15, 1.15);
    // treads
    ctx.fillStyle = '#3f5a86';
    rr(ctx, -0.42, 0.18, 0.84, 0.16, 0.08);
    ctx.fill();
    ctx.fillStyle = '#9fc3e6';
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(-0.32 + i * 0.16, 0.26, 0.045, 0, TAU);
      ctx.fill();
    }
    // block body
    ctx.fillStyle = frostShell(ctx, -0.3, 0.2, o.hit);
    rr(ctx, -0.38, -0.26, 0.76, 0.48, 0.1);
    ctx.fill();
    // cannon (left)
    ctx.fillStyle = '#6f8fbf';
    rr(ctx, -0.62, -0.08, 0.3, 0.1, 0.04);
    ctx.fill();
    ctx.fillStyle = FROST_VISOR;
    rr(ctx, -0.26, -0.16, 0.34, 0.13, 0.06);
    ctx.fill();
    frostEye(ctx, -0.16, -0.095, 0.055, time, o.mood);
    // ice armour plates: translucent slabs on the front and the roof
    if (o.armor) {
      ctx.fillStyle = 'rgba(190,240,255,0.72)';
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 0.02;
      for (const [x, y, w, h] of [[-0.44, -0.3, 0.2, 0.46], [-0.2, -0.38, 0.34, 0.12], [0.16, -0.38, 0.22, 0.12]]) {
        rr(ctx, x, y, w, h, 0.03);
        ctx.fill();
        ctx.stroke();
      }
      if (!o.reduced) Art.glowCircle(ctx, -0.34, -0.2, 0.08, '#ffffff', 0.5 + Math.sin(time * 3) * 0.2);
    }
    ctx.restore();
  }

  // 10 · Kältenebler: a sleepy fog cloud with a frost lamp; its mist orbs chill the ship (support)
  function chill(ctx, time, o) {
    const Art = A(),
      drift = o.reduced ? 0 : Math.sin(time * 1.6) * 0.04;
    Art.glowCircle(ctx, 0, 0, 0.66, '#cfe9ff', 0.4);
    // cloud puffs
    ctx.fillStyle = o.hit ? '#ffffff' : '#e8f4ff';
    for (const [x, y, r] of [[-0.24, 0.04, 0.22], [0.0, -0.1 + drift, 0.27], [0.24, 0.04, 0.22], [-0.08, 0.14, 0.2], [0.14, 0.14, 0.2]]) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(159,210,234,0.55)';
    ctx.beginPath();
    ctx.ellipse(0, 0.22, 0.36, 0.08, 0, 0, TAU);
    ctx.fill();
    // half-closed sleepy eyes
    ctx.strokeStyle = FROST_VISOR;
    ctx.lineWidth = 0.035;
    ctx.lineCap = 'round';
    for (const ex of [-0.12, 0.06]) {
      ctx.beginPath();
      if (o.mood === 'dizzy') ctx.arc(ex, 0.0, 0.04, time * 8, time * 8 + Math.PI * 1.5);
      else ctx.arc(ex, -0.01, 0.05, 0.15, Math.PI - 0.15);
      ctx.stroke();
    }
    // the frost lamp it carries (glows brighter just before a mist orb)
    ctx.strokeStyle = '#9fc3e6';
    ctx.lineWidth = 0.025;
    ctx.beginPath();
    ctx.moveTo(-0.3, 0.2);
    ctx.lineTo(-0.38, 0.38);
    ctx.stroke();
    Art.glowCircle(ctx, -0.4, 0.42, 0.12, FROST_EYE, 0.85);
  }

  // 11 · Eiswächter: Frostbyte's crystal knight — elite with a frost shield (same rhythm as the Siegelkreuzer)
  function warden(ctx, time, o) {
    const Art = A();
    ctx.save();
    ctx.scale(1.25, 1.25);
    Art.glowCircle(ctx, 0.42, 0.0, 0.18, '#8fe3ff', 0.8);
    // armoured crystal body (pointing at the player)
    ctx.fillStyle = frostShell(ctx, -0.32, 0.32, o.hit);
    ctx.beginPath();
    ctx.moveTo(-0.46, 0.0);
    ctx.lineTo(-0.18, -0.3);
    ctx.lineTo(0.34, -0.22);
    ctx.lineTo(0.42, 0.0);
    ctx.lineTo(0.34, 0.22);
    ctx.lineTo(-0.18, 0.3);
    ctx.closePath();
    ctx.fill();
    // crystal crown
    for (const [x, len] of [[-0.1, 0.18], [0.04, 0.28], [0.18, 0.2]]) spike(ctx, x, -0.24, -Math.PI / 2 - 0.15, len, 0.05, '#c9f1ff');
    ctx.fillStyle = FROST_VISOR;
    rr(ctx, -0.3, -0.08, 0.3, 0.13, 0.065);
    ctx.fill();
    frostEye(ctx, -0.2, -0.015, 0.055, time, o.mood);
    // the frost crest (glows while the shield charges)
    const pulse = o.telegraph && !o.reduced ? 0.5 + Math.sin(time * 10) * 0.5 : 0;
    ctx.fillStyle = o.hit ? '#ffffff' : '#5ab8ea';
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      i ? ctx.lineTo(0.14 + Math.cos(a) * 0.12, 0.06 + Math.sin(a) * 0.12) : ctx.moveTo(0.14 + Math.cos(a) * 0.12, 0.06 + Math.sin(a) * 0.12);
    }
    ctx.fill();
    if (pulse) Art.glowCircle(ctx, 0.14, 0.06, 0.28, '#bff4ff', pulse * 0.7);
    ctx.restore();
    // frost shield: a cyan crystal hexagon (same states as the seal shield)
    if (o.seal === 'shield' || o.seal === 'warn') {
      const alpha = o.seal === 'shield' ? 0.8 : 0.25 + pulse * 0.35;
      ctx.strokeStyle = `rgba(191,244,255,${alpha})`;
      ctx.fillStyle = `rgba(127,220,255,${o.seal === 'shield' ? 0.18 : 0.05})`;
      ctx.lineWidth = 0.035;
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) {
        const a = (i / 6) * TAU + (o.reduced ? 0 : time * 0.4);
        i ? ctx.lineTo(Math.cos(a) * 0.78, Math.sin(a) * 0.7) : ctx.moveTo(Math.cos(a) * 0.78, Math.sin(a) * 0.7);
      }
      ctx.fill();
      ctx.stroke();
    }
  }

  const DRAW = { stamp, moth, clip, scan, seal, ember, flake, shard, glacier, chill, warden };
  // opts: { hit, mood, armor, seal, call, telegraph, reduced }
  function draw(ctx, kind, time, opts = {}) {
    const fn = DRAW[kind];
    if (!fn || !A()) return false;
    const o = { mood: opts.hit ? 'hit' : 'idle', ...opts };
    ctx.save();
    if (o.hit) ctx.scale(1.06, 0.94);
    fn(ctx, time, o);
    ctx.restore();
    return true;
  }
  // small portrait (wave card, docs): cached data URL
  const portraits = new Map();
  function portraitURL(kind, size = 64) {
    const key = kind + ':' + size;
    if (portraits.has(key)) return portraits.get(key);
    if (typeof document === 'undefined') return '';
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx || !DRAW[kind]) {
      portraits.set(key, '');
      return '';
    }
    ctx.translate(size / 2, size / 2);
    ctx.scale(size * 0.78, size * 0.78);
    draw(ctx, kind, 0.4, { reduced: true, armor: (typeof CAMPAIGN_ENEMIES !== 'undefined' && Boolean(CAMPAIGN_ENEMIES[kind]?.armor)) || kind === 'clip' || kind === 'glacier' });
    let url = '';
    try {
      url = c.toDataURL();
    } catch {}
    portraits.set(key, url);
    return url;
  }
  // Beta 1.6: the outer campaigns' enemies are drawn in scenes/enemy-art-outer.js and registered here
  function register(kind, fn) {
    DRAW[kind] = fn;
    portraits.forEach((_, key) => key.startsWith(kind + ':') && portraits.delete(key));
  }
  window.EnemyArt = {
    draw,
    portraitURL,
    register,
    helpers: { rr, shell, visor },
    get KINDS() {
      return Object.keys(DRAW);
    }
  };
})();
