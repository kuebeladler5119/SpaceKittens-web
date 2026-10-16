// Beta 1.6 M3 — the enemies of the outer campaigns (original art), registered into EnemyArt. Same unit space and options
// as scenes/enemy-art.js: origin = body centre, radius ≈ 0.45, facing the player (left); { hit, mood, armor, seal, call,
// telegraph, reduced } come from the real fight state. Each world has its own material language:
//   Pyra-9 · basalt, brass and glowing slag · Mekhanos · brushed steel, hazard yellow, teal status lights ·
//   Viridia · bark, leaves, petals and bioluminescent cyan.
// The Inspektor-Drohne and the Dornenranke reuse their existing world drawings (MekhanosArt / ViridiaArt).
(function () {
  const E = window.EnemyArt;
  if (!E?.register) return;
  const TAU = Math.PI * 2;
  const A = () => window.NebulaArt;
  const { rr } = E.helpers;

  // ----- shared pieces -----
  function eyes(ctx, x, y, r, gap, color, mood, time) {
    for (const dx of [-gap / 2, gap / 2]) {
      if (mood === 'dizzy') {
        ctx.strokeStyle = color;
        ctx.lineWidth = r * 0.5;
        ctx.beginPath();
        ctx.arc(x + dx, y, r, time * 8, time * 8 + Math.PI * 1.5);
        ctx.stroke();
        continue;
      }
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(x + dx, y, r, mood === 'hit' ? r * 0.35 : r, 0, 0, TAU);
      ctx.fill();
      if (mood !== 'hit') {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x + dx - r * 0.35, y - r * 0.35, r * 0.32, 0, TAU);
        ctx.fill();
      }
    }
  }
  function grad(ctx, y0, y1, c0, c1, hit) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, hit ? '#ffffff' : c0);
    g.addColorStop(1, hit ? '#ffffff' : c1);
    return g;
  }
  // the elite shield (seal rhythm): a hexagon in the world's colour; 'warn' pulses, 'shield' holds
  function hexShield(ctx, o, time, stroke, fill, r = 0.62) {
    if (o.seal !== 'shield' && o.seal !== 'warn') return;
    const pulse = o.seal === 'warn' && !o.reduced ? 0.5 + Math.sin(time * 10) * 0.5 : 0;
    ctx.save();
    ctx.globalAlpha = o.seal === 'shield' ? 0.9 : 0.3 + pulse * 0.4;
    ctx.strokeStyle = stroke;
    ctx.fillStyle = fill;
    ctx.lineWidth = 0.04;
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const a = (i / 6) * TAU + (o.reduced ? 0 : time * 0.4);
      i ? ctx.lineTo(Math.cos(a) * r * 1.1, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r * 1.1, Math.sin(a) * r);
    }
    if (o.seal === 'shield') ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  function armorRim(ctx, o, color) {
    if (!o.armor) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.035;
    ctx.stroke();
  }

  // ===== Pyra-9 · die Glutwacht =====
  const PY = { basalt: ['#5a3f4a', '#2e1f28'], brass: '#d9a45a', ember: '#ff9a3a', lava: '#ff5a3a', eye: '#ffe08a', soot: '#1f1418' };
  // Funkenschwarm: a tiny brass ember-core with three glowing sparks circling it, trailing light
  E.register('spark', (ctx, time, o) => {
    const Art = A(),
      spin = o.reduced ? 0.6 : time * 5;
    Art.glowCircle(ctx, 0, 0, 0.62, PY.ember, 0.35);
    for (let i = 0; i < 3; i++) {
      const a = spin + (i / 3) * TAU,
        x = Math.cos(a) * 0.3,
        y = Math.sin(a) * 0.22;
      if (!o.reduced) Art.glowCircle(ctx, x + 0.08, y, 0.12, '#ffd77a', 0.35);
      Art.blob(ctx, x, y, 0.09, 0.09, i === 1 ? '#fff1c4' : '#ffb35a');
    }
    ctx.fillStyle = grad(ctx, -0.2, 0.2, '#ffd27a', '#c46a2a', o.hit);
    ctx.beginPath();
    ctx.arc(0, 0, 0.19, 0, TAU);
    ctx.fill();
    // angry little brows
    ctx.strokeStyle = PY.soot;
    ctx.lineWidth = 0.03;
    ctx.beginPath();
    ctx.moveTo(-0.12, -0.08);
    ctx.lineTo(-0.03, -0.04);
    ctx.moveTo(0.1, -0.08);
    ctx.lineTo(0.02, -0.04);
    ctx.stroke();
    eyes(ctx, -0.035, 0.02, 0.035, 0.1, PY.soot, o.mood, time);
  });
  // Schlackenwerfer: a squat basalt catapult on two stubby legs; a ladle arm holds a glowing slag ball
  E.register('slag', (ctx, time, o) => {
    const Art = A(),
      swing = o.reduced ? 0 : Math.max(0, Math.sin(time * 2.2)) ** 3;
    ctx.fillStyle = PY.soot;
    rr(ctx, -0.26, 0.24, 0.12, 0.16, 0.04);
    ctx.fill();
    rr(ctx, 0.12, 0.24, 0.12, 0.16, 0.04);
    ctx.fill();
    // ladle arm (swings back before a throw)
    ctx.save();
    ctx.translate(0.14, -0.12);
    ctx.rotate(-0.5 + swing * 0.9);
    ctx.strokeStyle = PY.brass;
    ctx.lineWidth = 0.06;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-0.34, -0.24);
    ctx.stroke();
    Art.glowCircle(ctx, -0.4, -0.3, 0.2, PY.lava, 0.6);
    ctx.fillStyle = '#4a2a2a';
    ctx.beginPath();
    ctx.arc(-0.4, -0.27, 0.1, 0, Math.PI);
    ctx.fill();
    Art.blob(ctx, -0.4, -0.31, 0.09, 0.08, '#ff7a3a');
    ctx.restore();
    // body
    ctx.fillStyle = grad(ctx, -0.24, 0.3, PY.basalt[0], PY.basalt[1], o.hit);
    rr(ctx, -0.34, -0.2, 0.64, 0.48, 0.14);
    ctx.fill();
    // magma cracks
    ctx.strokeStyle = PY.ember;
    ctx.lineWidth = 0.022;
    ctx.beginPath();
    ctx.moveTo(0.1, 0.24);
    ctx.lineTo(0.16, 0.1);
    ctx.lineTo(0.12, 0.02);
    ctx.moveTo(-0.24, 0.2);
    ctx.lineTo(-0.18, 0.12);
    ctx.stroke();
    ctx.fillStyle = PY.soot;
    rr(ctx, -0.28, -0.08, 0.36, 0.13, 0.06);
    ctx.fill();
    eyes(ctx, -0.1, -0.015, 0.04, 0.14, PY.eye, o.mood, time);
  });
  // Ofenpanzer: a walking brick kiln — the furnace door is its face, a chimney puffs; riveted iron plates (armour)
  E.register('kiln', (ctx, time, o) => {
    const Art = A(),
      step = o.reduced ? 0 : Math.sin(time * 4);
    ctx.save();
    ctx.scale(1.12, 1.12);
    ctx.fillStyle = PY.soot;
    for (const [x, lift] of [[-0.22, step], [0.16, -step]]) {
      rr(ctx, x, 0.26 - Math.max(0, lift) * 0.04, 0.12, 0.14, 0.04);
      ctx.fill();
    }
    // chimney + smoke
    ctx.fillStyle = '#6a4a40';
    rr(ctx, 0.12, -0.52, 0.12, 0.22, 0.03);
    ctx.fill();
    if (!o.reduced)
      for (let i = 0; i < 3; i++) {
        const k = (time * 0.6 + i / 3) % 1;
        ctx.fillStyle = `rgba(120,100,110,${0.5 * (1 - k)})`;
        ctx.beginPath();
        ctx.arc(0.18 + k * 0.12, -0.56 - k * 0.3, 0.05 + k * 0.08, 0, TAU);
        ctx.fill();
      }
    // brick dome
    ctx.fillStyle = grad(ctx, -0.4, 0.3, '#b0604a', '#6a2e2a', o.hit);
    ctx.beginPath();
    ctx.moveTo(-0.4, 0.28);
    ctx.lineTo(-0.4, -0.06);
    ctx.quadraticCurveTo(-0.38, -0.42, 0, -0.42);
    ctx.quadraticCurveTo(0.38, -0.42, 0.4, -0.06);
    ctx.lineTo(0.4, 0.28);
    ctx.closePath();
    ctx.fill();
    armorRim(ctx, o, 'rgba(255,200,140,0.85)');
    ctx.strokeStyle = 'rgba(60,20,20,0.45)';
    ctx.lineWidth = 0.015;
    for (let r = 0; r < 4; r++) {
      ctx.beginPath();
      ctx.moveTo(-0.38, -0.16 + r * 0.12);
      ctx.lineTo(0.38, -0.16 + r * 0.12);
      ctx.stroke();
    }
    // furnace door = face (glows)
    Art.glowCircle(ctx, -0.06, 0.02, 0.26, PY.ember, 0.5 + (o.reduced ? 0 : Math.sin(time * 6) * 0.1));
    ctx.fillStyle = '#2a1414';
    rr(ctx, -0.24, -0.12, 0.34, 0.28, 0.1);
    ctx.fill();
    ctx.fillStyle = '#ff8a3a';
    rr(ctx, -0.21, 0.04, 0.28, 0.09, 0.04);
    ctx.fill();
    eyes(ctx, -0.07, -0.04, 0.04, 0.13, PY.eye, o.mood, time);
    // iron plates (the armour)
    if (o.armor) {
      ctx.fillStyle = 'rgba(150,140,150,0.92)';
      for (const [x, y] of [[-0.44, -0.08], [-0.44, 0.12]]) {
        rr(ctx, x, y, 0.12, 0.17, 0.02);
        ctx.fill();
        ctx.fillStyle = '#e8d8c8';
        ctx.beginPath();
        ctx.arc(x + 0.06, y + 0.04, 0.016, 0, TAU);
        ctx.arc(x + 0.06, y + 0.13, 0.016, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(150,140,150,0.92)';
      }
    }
    ctx.restore();
  });
  // Blasebalg: a leather bellows with two wooden paddles that pump; its nozzle glows when it fans an ally
  E.register('bellows', (ctx, time, o) => {
    const Art = A(),
      pump = o.reduced ? 0.5 : 0.5 + Math.sin(time * 5) * 0.5;
    const open = 0.1 + pump * 0.12;
    // nozzle (left, toward the allies in front)
    ctx.fillStyle = PY.brass;
    ctx.beginPath();
    ctx.moveTo(-0.62, -0.02);
    ctx.lineTo(-0.3, -0.08);
    ctx.lineTo(-0.3, 0.06);
    ctx.closePath();
    ctx.fill();
    if (!o.reduced) Art.glowCircle(ctx, -0.64, -0.02, 0.12, PY.ember, 0.3 + pump * 0.4);
    // pleated leather between the paddles
    ctx.fillStyle = grad(ctx, -open, open, '#a4683a', '#6a3a22', o.hit);
    ctx.beginPath();
    ctx.moveTo(-0.32, -0.04);
    ctx.lineTo(0.34, -open - 0.08);
    ctx.lineTo(0.34, open + 0.08);
    ctx.lineTo(-0.32, 0.04);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(40,20,10,0.5)';
    ctx.lineWidth = 0.014;
    for (let i = 1; i < 4; i++) {
      const x = -0.32 + i * 0.165,
        h = 0.04 + ((open + 0.04) * i) / 4;
      ctx.beginPath();
      ctx.moveTo(x, -h);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    // paddles
    ctx.fillStyle = o.hit ? '#ffffff' : '#c4874a';
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.rotate(s * (0.12 + pump * 0.16));
      rr(ctx, -0.34, s > 0 ? 0.06 : -0.16, 0.72, 0.1, 0.05);
      ctx.fill();
      ctx.restore();
    }
    // the face rides on the top paddle
    ctx.save();
    ctx.rotate(-(0.12 + pump * 0.16));
    eyes(ctx, 0.12, -0.11, 0.035, 0.12, PY.soot, o.mood, time);
    ctx.restore();
    ctx.fillStyle = PY.brass;
    rr(ctx, 0.3, -0.2, 0.1, 0.4, 0.04);
    ctx.fill();
  });
  // Essenwächter: an anvil-headed forge knight with a hammer arm and a molten crest; elite (orange seal hex)
  E.register('forgeguard', (ctx, time, o) => {
    const Art = A();
    ctx.save();
    ctx.scale(1.22, 1.22);
    Art.glowCircle(ctx, 0.36, 0.1, 0.18, PY.lava, 0.7);
    // hammer arm
    ctx.save();
    ctx.translate(0.24, 0.02);
    ctx.rotate(-0.6 + (o.reduced ? 0 : Math.sin(time * 2.5) * 0.25));
    ctx.fillStyle = '#7a6a5a';
    rr(ctx, -0.02, -0.38, 0.05, 0.38, 0.02);
    ctx.fill();
    ctx.fillStyle = '#4a4048';
    rr(ctx, -0.1, -0.48, 0.22, 0.12, 0.03);
    ctx.fill();
    ctx.restore();
    // body: an anvil shape pointing at the player
    ctx.fillStyle = grad(ctx, -0.3, 0.34, '#6a5a66', '#2e2630', o.hit);
    ctx.beginPath();
    ctx.moveTo(-0.5, -0.18);
    ctx.lineTo(0.3, -0.18);
    ctx.lineTo(0.3, -0.04);
    ctx.lineTo(0.14, 0.04);
    ctx.lineTo(0.2, 0.32);
    ctx.lineTo(-0.24, 0.32);
    ctx.lineTo(-0.16, 0.04);
    ctx.lineTo(-0.36, -0.04);
    ctx.closePath();
    ctx.fill();
    // molten crest
    ctx.fillStyle = PY.ember;
    for (const [x, h] of [[-0.18, 0.12], [-0.04, 0.18], [0.1, 0.12]]) {
      ctx.beginPath();
      ctx.moveTo(x - 0.06, -0.18);
      ctx.quadraticCurveTo(x, -0.18 - h * 1.6, x + 0.06, -0.18);
      ctx.fill();
    }
    ctx.fillStyle = PY.soot;
    rr(ctx, -0.36, -0.13, 0.36, 0.1, 0.05);
    ctx.fill();
    eyes(ctx, -0.2, -0.08, 0.03, 0.14, PY.eye, o.mood, time);
    const pulse = o.telegraph && !o.reduced ? 0.5 + Math.sin(time * 10) * 0.5 : 0;
    if (pulse) Art.glowCircle(ctx, -0.02, 0.16, 0.24, '#ffd77a', pulse * 0.7);
    Art.blob(ctx, -0.02, 0.16, 0.07, 0.07, o.hit ? '#ffffff' : PY.lava);
    ctx.restore();
    hexShield(ctx, o, time, 'rgba(255,190,110,0.95)', 'rgba(255,140,60,0.2)', 0.66);
  });

  // ===== Mekhanos · das Taktband =====
  const MK = { steel: ['#c4ccd8', '#7a8698'], dark: '#2a3442', hazard: '#ffd23a', light: '#5affd0', eye: '#5affd0' };
  function hazard(ctx, x, y, w, h) {
    ctx.save();
    rr(ctx, x, y, w, h, 0.02);
    ctx.clip();
    ctx.fillStyle = MK.hazard;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = MK.dark;
    for (let i = -2; i < 10; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * 0.08, y + h);
      ctx.lineTo(x + i * 0.08 + 0.04, y + h);
      ctx.lineTo(x + i * 0.08 + 0.04 + h, y);
      ctx.lineTo(x + i * 0.08 + h, y);
      ctx.fill();
    }
    ctx.restore();
  }
  function gear(ctx, x, y, r, teeth, rot, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < teeth * 2; i++) {
      const a = rot + (i / (teeth * 2)) * TAU,
        rad = i % 2 ? r : r * 1.25;
      i ? ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad) : ctx.moveTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
    }
    ctx.closePath();
    ctx.fill();
  }
  // Nietenschwarm: three rivets tumbling around a little cog with a face
  E.register('rivet', (ctx, time, o) => {
    const spin = o.reduced ? 0.4 : time * 6;
    for (let i = 0; i < 3; i++) {
      const a = -spin + (i / 3) * TAU;
      ctx.save();
      ctx.translate(Math.cos(a) * 0.3, Math.sin(a) * 0.24);
      ctx.rotate(a * 2);
      ctx.fillStyle = o.hit ? '#ffffff' : '#b4bccb';
      ctx.beginPath();
      ctx.arc(0, -0.04, 0.08, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#7a8698';
      ctx.fillRect(-0.025, -0.04, 0.05, 0.12);
      ctx.restore();
    }
    gear(ctx, 0, 0, 0.17, 8, o.reduced ? 0 : time * 2, o.hit ? '#ffffff' : '#9aa6b8');
    ctx.fillStyle = MK.dark;
    ctx.beginPath();
    ctx.arc(0, 0, 0.12, 0, TAU);
    ctx.fill();
    eyes(ctx, 0, 0, 0.03, 0.09, MK.eye, o.mood, time);
  });
  // Inspektor-Drohne: the Mekhanos drone drawing, scaled into enemy space
  E.register('inspector', (ctx, time, o) => {
    if (window.MekhanosArt?.drawInspectorDrone) window.MekhanosArt.drawInspectorDrone(ctx, 0, 0, 0.5, time, { hit: o.hit });
    else A()?.drawMotteBot(ctx, 0, 0, 0.5, time, false, { hit: o.hit });
  });
  // Stanzpresse: a tall hydraulic press frame whose die slams; a cyclops lens in the crossbeam (heavy, armoured)
  E.register('press', (ctx, time, o) => {
    const Art = A(),
      slam = o.reduced ? 0 : Math.max(0, Math.sin(time * 2.6)) ** 8;
    ctx.save();
    ctx.scale(1.12, 1.12);
    hazard(ctx, -0.42, 0.26, 0.84, 0.1);
    ctx.fillStyle = grad(ctx, -0.48, 0.3, MK.steel[0], MK.steel[1], o.hit);
    rr(ctx, -0.4, -0.48, 0.12, 0.76, 0.03);
    ctx.fill();
    rr(ctx, 0.28, -0.48, 0.12, 0.76, 0.03);
    ctx.fill();
    rr(ctx, -0.42, -0.5, 0.84, 0.18, 0.05);
    ctx.fill();
    armorRim(ctx, o, 'rgba(159,216,255,0.85)');
    // pistons and the die
    ctx.fillStyle = '#5a6678';
    ctx.fillRect(-0.16, -0.32, 0.05, 0.16 + slam * 0.18);
    ctx.fillRect(0.11, -0.32, 0.05, 0.16 + slam * 0.18);
    ctx.fillStyle = '#4a5466';
    rr(ctx, -0.26, -0.18 + slam * 0.18, 0.52, 0.14, 0.03);
    ctx.fill();
    if (slam > 0.7) Art.glowCircle(ctx, 0, 0.2, 0.22, '#ffd77a', 0.45);
    // anvil block
    ctx.fillStyle = '#6a7486';
    rr(ctx, -0.22, 0.14, 0.44, 0.12, 0.02);
    ctx.fill();
    // cyclops lens
    ctx.fillStyle = MK.dark;
    ctx.beginPath();
    ctx.arc(-0.08, -0.41, 0.07, 0, TAU);
    ctx.fill();
    if (o.mood === 'hit') Art.blob(ctx, -0.08, -0.41, 0.045, 0.015, MK.eye);
    else Art.glowCircle(ctx, -0.08, -0.41, 0.06, MK.eye, 0.95);
    // armour plates bolted on the uprights
    if (o.armor) {
      ctx.fillStyle = 'rgba(110,126,150,0.95)';
      rr(ctx, -0.48, -0.3, 0.1, 0.5, 0.02);
      ctx.fill();
      ctx.fillStyle = '#d8e0ee';
      for (const y of [-0.24, -0.04, 0.14]) {
        ctx.beginPath();
        ctx.arc(-0.43, y, 0.016, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  });
  // Störsender: a twitchy dish drone with a zigzag antenna that crackles with static (fast, disruptive)
  E.register('jammer', (ctx, time, o) => {
    const Art = A(),
      jitter = o.reduced ? 0 : Math.sin(time * 37) * 0.02;
    ctx.translate(jitter, -jitter);
    // static crackle
    if (!o.reduced) {
      ctx.strokeStyle = `rgba(255,120,220,${0.4 + Math.abs(Math.sin(time * 13)) * 0.5})`;
      ctx.lineWidth = 0.02;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + time * 3;
        ctx.moveTo(Math.cos(a) * 0.36, Math.sin(a) * 0.32);
        ctx.lineTo(Math.cos(a + 0.2) * 0.48, Math.sin(a + 0.2) * 0.44);
      }
      ctx.stroke();
    }
    // zigzag antenna
    ctx.strokeStyle = '#d8e0ee';
    ctx.lineWidth = 0.03;
    ctx.beginPath();
    ctx.moveTo(0.06, -0.16);
    ctx.lineTo(0.14, -0.28);
    ctx.lineTo(0.04, -0.36);
    ctx.lineTo(0.14, -0.48);
    ctx.stroke();
    Art.glowCircle(ctx, 0.14, -0.5, 0.09, '#ff78dc', 0.9);
    // dish (left, pointing at the ship)
    ctx.fillStyle = o.hit ? '#ffffff' : '#9aa6b8';
    ctx.beginPath();
    ctx.ellipse(-0.24, 0, 0.08, 0.22, 0, -Math.PI / 2, Math.PI / 2, true);
    ctx.fill();
    ctx.fillStyle = '#ff78dc';
    ctx.beginPath();
    ctx.arc(-0.3, 0, 0.035, 0, TAU);
    ctx.fill();
    // body
    ctx.fillStyle = grad(ctx, -0.18, 0.2, '#5a6478', '#2a3242', o.hit);
    ctx.beginPath();
    ctx.ellipse(0.04, 0.02, 0.24, 0.18, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = MK.dark;
    rr(ctx, -0.12, -0.05, 0.26, 0.1, 0.05);
    ctx.fill();
    eyes(ctx, 0.01, 0, 0.03, 0.11, '#ff9ae8', o.mood, time);
    Art.glowCircle(ctx, 0.16, 0.22, 0.1, MK.light, 0.7);
  });
  // Schildprojektor: a tripod with a lens that projects a teal hex; a small screen face (support)
  E.register('projector', (ctx, time, o) => {
    const Art = A(),
      hum = o.reduced ? 0.6 : 0.5 + Math.sin(time * 4) * 0.3;
    ctx.strokeStyle = '#7a8698';
    ctx.lineWidth = 0.035;
    ctx.lineCap = 'round';
    for (const [x, y] of [[-0.24, 0.4], [0, 0.42], [0.24, 0.4]]) {
      ctx.beginPath();
      ctx.moveTo(0, 0.1);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    // projected hex (toward the allies in front)
    ctx.strokeStyle = `rgba(90,255,208,${0.35 + hum * 0.4})`;
    ctx.lineWidth = 0.025;
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const a = (i / 6) * TAU;
      i ? ctx.lineTo(-0.5 + Math.cos(a) * 0.14, -0.12 + Math.sin(a) * 0.14) : ctx.moveTo(-0.5 + Math.cos(a) * 0.14, -0.12 + Math.sin(a) * 0.14);
    }
    ctx.stroke();
    ctx.fillStyle = `rgba(90,255,208,${0.08 + hum * 0.12})`;
    ctx.beginPath();
    ctx.moveTo(-0.24, -0.16);
    ctx.lineTo(-0.5, -0.26);
    ctx.lineTo(-0.5, 0.02);
    ctx.lineTo(-0.24, -0.06);
    ctx.fill();
    // head: a box with the lens and a little screen face
    ctx.fillStyle = grad(ctx, -0.3, 0.12, MK.steel[0], MK.steel[1], o.hit);
    rr(ctx, -0.24, -0.3, 0.48, 0.42, 0.08);
    ctx.fill();
    ctx.fillStyle = MK.dark;
    rr(ctx, -0.04, -0.22, 0.24, 0.18, 0.04);
    ctx.fill();
    eyes(ctx, 0.08, -0.13, 0.025, 0.09, MK.eye, o.mood, time);
    Art.glowCircle(ctx, -0.22, -0.11, 0.1, MK.light, 0.6 + hum * 0.3);
    ctx.fillStyle = '#dff';
    ctx.beginPath();
    ctx.arc(-0.22, -0.11, 0.04, 0, TAU);
    ctx.fill();
  });
  // Vorarbeiter: a big boxy foreman robot with a yellow hard hat and a megaphone arm; elite (teal seal hex)
  E.register('foreman', (ctx, time, o) => {
    const Art = A(),
      call = o.call || 0;
    ctx.save();
    ctx.scale(1.2, 1.2);
    // megaphone (shouts the reinforcement call; it shakes as the call nears)
    ctx.save();
    ctx.translate(-0.3, 0.04);
    ctx.rotate(-0.2 + (o.reduced ? 0 : Math.sin(time * (4 + call * 20)) * 0.05 * (0.4 + call)));
    ctx.fillStyle = '#e8e0d0';
    ctx.beginPath();
    ctx.moveTo(0, -0.05);
    ctx.lineTo(-0.24, -0.14);
    ctx.lineTo(-0.24, 0.14);
    ctx.lineTo(0, 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e0565a';
    ctx.fillRect(-0.26, -0.15, 0.04, 0.3);
    if (call > 0.6 && !o.reduced) Art.glowCircle(ctx, -0.3, 0, 0.16, '#ffd23a', (call - 0.6) * 1.8);
    ctx.restore();
    // body
    ctx.fillStyle = grad(ctx, -0.3, 0.34, MK.steel[0], MK.steel[1], o.hit);
    rr(ctx, -0.3, -0.24, 0.6, 0.58, 0.1);
    ctx.fill();
    hazard(ctx, -0.3, 0.22, 0.6, 0.08);
    ctx.fillStyle = MK.dark;
    rr(ctx, -0.22, -0.14, 0.36, 0.14, 0.06);
    ctx.fill();
    eyes(ctx, -0.06, -0.07, 0.035, 0.14, MK.eye, o.mood, time);
    // hard hat
    ctx.fillStyle = o.hit ? '#ffffff' : MK.hazard;
    ctx.beginPath();
    ctx.ellipse(0, -0.26, 0.3, 0.16, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(-0.36, -0.27, 0.72, 0.05);
    const pulse = o.telegraph && !o.reduced ? 0.5 + Math.sin(time * 10) * 0.5 : 0;
    Art.glowCircle(ctx, 0.12, 0.1, 0.1, MK.light, 0.6 + pulse * 0.4);
    ctx.restore();
    hexShield(ctx, o, time, 'rgba(90,255,208,0.95)', 'rgba(90,255,208,0.16)', 0.68);
  });

  // ===== Viridia · die Blütenwacht =====
  const VI = { leaf: ['#7ad88a', '#2e7a4a'], bark: ['#9a6a42', '#5a3a22'], petal: '#ff8fc8', glow: '#8fffe0', eye: '#183a2a' };
  // Sporenwolke: a dandelion puff of spores around a soft seed with a sleepy face
  E.register('spore', (ctx, time, o) => {
    const Art = A();
    Art.glowCircle(ctx, 0, 0, 0.55, VI.glow, 0.25);
    ctx.strokeStyle = o.hit ? '#ffffff' : 'rgba(230,255,245,0.9)';
    ctx.lineWidth = 0.018;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU + (o.reduced ? 0 : Math.sin(time * 2 + i) * 0.08),
        x = Math.cos(a) * 0.38,
        y = Math.sin(a) * 0.38;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 0.14, Math.sin(a) * 0.14);
      ctx.lineTo(x, y);
      ctx.stroke();
      Art.blob(ctx, x, y, 0.045, 0.045, '#f4fff8');
    }
    ctx.fillStyle = grad(ctx, -0.16, 0.16, '#d8f8c8', '#7ab87a', o.hit);
    ctx.beginPath();
    ctx.arc(0, 0, 0.16, 0, TAU);
    ctx.fill();
    eyes(ctx, 0, -0.01, 0.028, 0.08, VI.eye, o.mood, time);
  });
  // Dornenranke: the Viridia thorn vine drawing, scaled into enemy space
  E.register('thorn', (ctx, time, o) => {
    if (window.ViridiaArt?.drawThornVine) window.ViridiaArt.drawThornVine(ctx, 0, 0, 0.62, time, { hit: o.hit, reduced: o.reduced });
  });
  // Rindenkoloss: a walking tree stump with bark plates, a mossy crown, mushrooms and glowing eyes in a knot (heavy)
  E.register('bark', (ctx, time, o) => {
    const Art = A(),
      sway = o.reduced ? 0 : Math.sin(time * 1.8) * 0.03;
    ctx.save();
    ctx.scale(1.14, 1.14);
    ctx.rotate(sway);
    // roots as legs
    ctx.strokeStyle = VI.bark[1];
    ctx.lineWidth = 0.07;
    ctx.lineCap = 'round';
    for (const x of [-0.24, 0, 0.22]) {
      ctx.beginPath();
      ctx.moveTo(x, 0.2);
      ctx.quadraticCurveTo(x - 0.08, 0.34, x - 0.04, 0.4);
      ctx.stroke();
    }
    // trunk
    ctx.fillStyle = grad(ctx, -0.36, 0.3, VI.bark[0], VI.bark[1], o.hit);
    rr(ctx, -0.34, -0.36, 0.68, 0.62, 0.16);
    ctx.fill();
    armorRim(ctx, o, 'rgba(190,240,190,0.8)');
    ctx.strokeStyle = 'rgba(40,20,10,0.4)';
    ctx.lineWidth = 0.018;
    for (const x of [-0.2, 0.04, 0.22]) {
      ctx.beginPath();
      ctx.moveTo(x, -0.3);
      ctx.quadraticCurveTo(x + 0.04, -0.04, x - 0.02, 0.22);
      ctx.stroke();
    }
    // moss crown and mushrooms
    ctx.fillStyle = '#5ab86a';
    for (const [x, r] of [[-0.22, 0.12], [-0.04, 0.15], [0.16, 0.13]]) {
      ctx.beginPath();
      ctx.arc(x, -0.36, r, Math.PI, 0);
      ctx.fill();
    }
    ctx.fillStyle = '#ff8f8f';
    ctx.beginPath();
    ctx.ellipse(0.32, -0.04, 0.08, 0.05, 0, Math.PI, 0);
    ctx.fill();
    // knot hole face
    ctx.fillStyle = '#2a1a10';
    ctx.beginPath();
    ctx.ellipse(-0.08, -0.08, 0.17, 0.12, 0, 0, TAU);
    ctx.fill();
    if (o.mood === 'hit') eyes(ctx, -0.08, -0.08, 0.035, 0.12, VI.glow, 'hit', time);
    else {
      Art.glowCircle(ctx, -0.14, -0.08, 0.05, VI.glow, 0.95);
      Art.glowCircle(ctx, -0.02, -0.08, 0.05, VI.glow, 0.95);
    }
    // bark plates (armour)
    if (o.armor) {
      ctx.fillStyle = 'rgba(120,80,48,0.95)';
      for (const [x, y, w, h] of [[-0.42, -0.24, 0.12, 0.2], [-0.42, 0.0, 0.12, 0.2]]) {
        rr(ctx, x, y, w, h, 0.04);
        ctx.fill();
      }
    }
    ctx.restore();
  });
  // Pollenpflegerin: a yellow bloom with leaf arms that carries a glowing dewdrop — her healing (support)
  E.register('pollen', (ctx, time, o) => {
    const Art = A(),
      bob = o.reduced ? 0 : Math.sin(time * 2.4) * 0.03;
    ctx.translate(0, bob);
    // stem and leaf arms
    ctx.strokeStyle = VI.leaf[1];
    ctx.lineWidth = 0.04;
    ctx.beginPath();
    ctx.moveTo(0, 0.14);
    ctx.lineTo(0, 0.42);
    ctx.stroke();
    ctx.fillStyle = VI.leaf[0];
    ctx.beginPath();
    ctx.ellipse(-0.2, 0.22, 0.14, 0.05, -0.4, 0, TAU);
    ctx.ellipse(0.2, 0.26, 0.14, 0.05, 0.4, 0, TAU);
    ctx.fill();
    // the dewdrop (heal)
    Art.glowCircle(ctx, -0.36, 0.14, 0.14, VI.glow, 0.7);
    ctx.fillStyle = '#e8fffa';
    ctx.beginPath();
    ctx.moveTo(-0.36, 0.05);
    ctx.quadraticCurveTo(-0.29, 0.16, -0.36, 0.2);
    ctx.quadraticCurveTo(-0.43, 0.16, -0.36, 0.05);
    ctx.fill();
    // petals
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + (o.reduced ? 0 : time * 0.3);
      ctx.fillStyle = o.hit ? '#ffffff' : i % 2 ? '#ffe27a' : '#ffd23a';
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * 0.22, -0.04 + Math.sin(a) * 0.22, 0.12, 0.07, a, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = grad(ctx, -0.18, 0.1, '#ffb35a', '#c46a2a', o.hit);
    ctx.beginPath();
    ctx.arc(0, -0.04, 0.15, 0, TAU);
    ctx.fill();
    eyes(ctx, 0, -0.05, 0.028, 0.09, '#5a2a10', o.mood, time);
    ctx.strokeStyle = '#5a2a10';
    ctx.lineWidth = 0.014;
    ctx.beginPath();
    ctx.arc(0, -0.0, 0.04, 0.2, Math.PI - 0.2);
    ctx.stroke();
  });
  // Knospenrufer: a big closed bud on a stalk with seed pods; it swells as its call nears (summoner, throws seeds)
  E.register('bulb', (ctx, time, o) => {
    const Art = A(),
      call = o.call || 0,
      swell = 1 + call * 0.12 + (o.reduced ? 0 : Math.sin(time * 3) * 0.02);
    ctx.strokeStyle = VI.leaf[1];
    ctx.lineWidth = 0.05;
    ctx.beginPath();
    ctx.moveTo(0.04, 0.42);
    ctx.quadraticCurveTo(0.12, 0.2, 0, 0.1);
    ctx.stroke();
    ctx.fillStyle = VI.leaf[0];
    ctx.beginPath();
    ctx.ellipse(0.18, 0.3, 0.16, 0.06, 0.5, 0, TAU);
    ctx.fill();
    // seed pods
    for (const [x, y] of [[-0.3, 0.2], [0.3, -0.1]]) Art.blob(ctx, x, y, 0.06, 0.05, '#c4a45a');
    ctx.save();
    ctx.scale(swell, swell);
    ctx.fillStyle = grad(ctx, -0.36, 0.14, '#ff9ad0', '#a8407a', o.hit);
    ctx.beginPath();
    ctx.moveTo(0, -0.4);
    ctx.quadraticCurveTo(0.3, -0.2, 0.2, 0.08);
    ctx.quadraticCurveTo(0, 0.18, -0.2, 0.08);
    ctx.quadraticCurveTo(-0.3, -0.2, 0, -0.4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(90,20,60,0.4)';
    ctx.lineWidth = 0.015;
    ctx.beginPath();
    ctx.moveTo(0, -0.38);
    ctx.lineTo(0, 0.12);
    ctx.moveTo(-0.12, -0.28);
    ctx.quadraticCurveTo(-0.18, -0.06, -0.1, 0.1);
    ctx.stroke();
    // sepals
    ctx.fillStyle = VI.leaf[1];
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, 0.12);
      ctx.quadraticCurveTo(s * 0.22, 0.1, s * 0.24, -0.08);
      ctx.quadraticCurveTo(s * 0.1, 0.0, 0, 0.12);
      ctx.fill();
    }
    eyes(ctx, -0.02, -0.12, 0.03, 0.1, '#3a0a28', o.mood, time);
    if (call > 0.6 && !o.reduced) Art.glowCircle(ctx, 0, -0.14, 0.3, VI.petal, (call - 0.6) * 1.4);
    ctx.restore();
  });
  // Blütenwächterin: a lily knight with petal armour and a leaf shield; elite (pink seal hex)
  E.register('bloomwarden', (ctx, time, o) => {
    const Art = A();
    ctx.save();
    ctx.scale(1.2, 1.2);
    Art.glowCircle(ctx, 0.3, 0.12, 0.16, VI.glow, 0.7);
    // leaf shield in front
    ctx.fillStyle = grad(ctx, -0.3, 0.3, '#8ae89a', '#2e7a4a', o.hit);
    ctx.beginPath();
    ctx.moveTo(-0.44, -0.3);
    ctx.quadraticCurveTo(-0.26, 0, -0.44, 0.3);
    ctx.quadraticCurveTo(-0.56, 0, -0.44, -0.3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(20,60,30,0.5)';
    ctx.lineWidth = 0.014;
    ctx.beginPath();
    ctx.moveTo(-0.44, -0.28);
    ctx.lineTo(-0.44, 0.28);
    ctx.stroke();
    // petal body
    for (const [a, c] of [[-0.5, '#ffb8dc'], [0.5, '#ffb8dc'], [0, VI.petal]]) {
      ctx.save();
      ctx.rotate(a);
      ctx.fillStyle = o.hit ? '#ffffff' : c;
      ctx.beginPath();
      ctx.ellipse(0, -0.12, 0.14, 0.3, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = grad(ctx, -0.12, 0.3, '#7ad88a', '#2e7a4a', o.hit);
    rr(ctx, -0.16, 0.0, 0.32, 0.3, 0.1);
    ctx.fill();
    ctx.fillStyle = '#183a2a';
    rr(ctx, -0.13, -0.08, 0.24, 0.1, 0.05);
    ctx.fill();
    eyes(ctx, -0.01, -0.03, 0.025, 0.1, VI.glow, o.mood, time);
    const pulse = o.telegraph && !o.reduced ? 0.5 + Math.sin(time * 10) * 0.5 : 0;
    if (pulse) Art.glowCircle(ctx, 0, -0.2, 0.3, VI.petal, pulse * 0.7);
    ctx.restore();
    hexShield(ctx, o, time, 'rgba(255,160,210,0.95)', 'rgba(255,140,200,0.16)', 0.68);
  });
  // Wurzelknoten (Petalguard's roots): a glowing knot in the ground that pulses while it feeds her
  E.register('root', (ctx, time, o) => {
    const Art = A(),
      pulse = o.reduced ? 0.6 : 0.5 + Math.sin(time * 3) * 0.3;
    Art.glowCircle(ctx, 0, 0, 0.5, VI.glow, 0.25 + pulse * 0.25);
    ctx.strokeStyle = VI.bark[1];
    ctx.lineWidth = 0.06;
    ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + 0.3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(Math.cos(a + 0.4) * 0.22, Math.sin(a + 0.4) * 0.22, Math.cos(a) * 0.4, Math.sin(a) * 0.4);
      ctx.stroke();
    }
    ctx.fillStyle = grad(ctx, -0.2, 0.2, '#b07a4a', '#5a3a22', o.hit);
    ctx.beginPath();
    ctx.arc(0, 0, 0.2, 0, TAU);
    ctx.fill();
    Art.glowCircle(ctx, 0, 0, 0.1, VI.glow, 0.8 + pulse * 0.2);
  });
})();
