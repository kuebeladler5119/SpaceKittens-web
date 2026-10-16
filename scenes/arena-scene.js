// Combat 2.0 arena scene (Beta 1.4 M4, fullscreen in Beta 1.5): draws the authoritative arena state (arena.js) —
// ship, every enemy, every projectile — interpolated between two fixed steps, plus effects read from the fight's events
// (arrivals, impacts, rays, blasts, crashes, shield absorbs, boss telegraphs and phase changes). It never changes the
// fight. Mounted in the fullscreen expedition stage (expedition-ui.js).
//
// Orientation: the simulation is a 160 × 90 field with the ship on the left. On a portrait screen (taller than wide) the
// scene turns it by 90°: the ship sits at the bottom and enemies come from the top — a pure drawing transform, the
// fight itself is identical. Characters always stay upright; only the ship turns to point at the enemies.
(function () {
  'use strict';
  const Art = () => window.NebulaArt;
  const TAU = Math.PI * 2;
  const W = 160,
    H = 90;
  const SHOT_COLOR = {
    stamp: '#e0565a', moth: '#f2ead0', clip: '#b98a5a', scan: '#ff8f8f', seal: '#c8343c', ember: '#ff9a3a', pips: '#ff6b8a', 'stamp-heavy': '#e0565a',
    flake: '#dff6ff', shard: '#9fe9ff', glacier: '#7fb8e6', chill: '#cfe9ff', warden: '#7fdcff', icicle: '#bff4ff', breath: '#8fe3ff',
    // Beta 1.6: the outer campaigns
    spark: '#ffb35a', slag: '#ff7a3a', kiln: '#ff9a4a', bellows: '#ffd27a', forgeguard: '#ff7a3a', cinder: '#ff8a3a', magma: '#ff5a3a', steam: '#f4f0ff',
    rivet: '#c4ccd8', inspector: '#5affd0', press: '#9aa6b8', jammer: '#ff78dc', projector: '#5affd0', foreman: '#ffd23a', 'cog-bolt': '#5affd0', crate: '#c49a5a', 'release-laser': '#ff4a5a',
    spore: '#e8fff4', thorn: '#9ad86a', bark: '#c49a6a', pollen: '#ffe27a', bulb: '#ff9ad0', bloomwarden: '#ff8fc8', 'thorn-shot': '#8ad86a', 'pollen-orb': '#ffe27a'
  };
  // Beta 1.5: the arena's sky per campaign (Orion violet, Glacies ice blue); Beta 1.6: Pyra ember, Mekhanos steel, Viridia teal
  const ARENA_SKY = { crystal: ['#10143a', '#2a2a5e', '#4a2f6a'], ice: ['#0b1d3a', '#1d3f6a', '#3a6f9a'], volcanic: ['#1e0c14', '#4a1a24', '#8a3a2a'], machine: ['#0e1622', '#22344e', '#3a5a66'], verdant: ['#0a1c22', '#173c48', '#2a6a52'] };
  // the world drifting past (Combat 3.0: the field is never an empty box): its planet on the enemy side and themed motes
  const ARENA_WORLD = {
    crystal: { planet: ['#b9a8ff', '#5a3f9a'], mote: '#d8ccff', kind: 'dust' },
    ice: { planet: ['#dff6ff', '#5a8fc4'], mote: '#f2fbff', kind: 'snow' },
    volcanic: { planet: ['#ff9a5a', '#7a2a2a'], mote: '#ffb35a', kind: 'ember' },
    machine: { planet: ['#c4ccd8', '#3a4a5e'], mote: '#a8b4c4', kind: 'gear' },
    verdant: { planet: ['#9af0b8', '#2a6a5a'], mote: '#ffc4e0', kind: 'petal' }
  };
  // impact style per projectile (the weapon family must feel different where it lands)
  const IMPACT = { bolt: { r: 3, n: 3 }, shell: { r: 7, n: 7, ring: true }, ray: { r: 4.5, n: 0, scorch: true }, pellet: { r: 2.2, n: 2 }, orb: { r: 6, n: 6, ring: true }, chain: { r: 3.5, n: 0, zap: true }, spark: { r: 3, n: 3 }, reflect: { r: 8, n: 8, ring: true } };
  const FOE_VISUAL = 1.18; // enemies are drawn a little larger than their hit circle (readability on phones)
  function createArenaScene({ getView }) {
    let w = 320,
      h = 240,
      time = 0,
      view = null,
      reduced = false,
      lastSeq = 0,
      shake = 0,
      hurt = 0,
      flash = 0,
      jam = 0,
      inset = 0;
    const banners = []; // short texts over the field (PARADE!, TAKTBRUCH!, …)
    const fx = []; // transient effects (max 70)
    const geo = { s: 1, ox: 0, oy: 0, rot: false };
    const stats = { frames: 0, foes: 0, shots: 0 };
    let bg = null,
      bgKey = '';
    function layout() {
      const top = inset > 0 ? inset + 6 : 4,
        fieldW = w - 8,
        fieldH = Math.max(80, h - top - 6);
      geo.rot = fieldH > fieldW * 1.05;
      const simW = geo.rot ? H : W,
        simH = geo.rot ? W : H,
        pad = Math.round(Math.min(fieldW, fieldH) * 0.05);
      geo.s = Math.min(fieldW / simW, (fieldH - (geo.rot ? pad * 2 : 0)) / simH, (fieldW - (geo.rot ? 0 : pad * 2)) / simW);
      geo.ox = (w - simW * geo.s) / 2;
      geo.oy = top + (fieldH - simH * geo.s) / 2;
    }
    // simulation point → canvas point (turned on portrait screens: ship at the bottom)
    const P = (x, y) => (geo.rot ? { x: geo.ox + y * geo.s, y: geo.oy + (W - x) * geo.s } : { x: geo.ox + x * geo.s, y: geo.oy + y * geo.s });
    const lerp = (a, b, t) => (a === undefined ? b : a + (b - a) * t);
    function pushFx(e) {
      if (fx.length >= 70) fx.shift();
      fx.push({ ...e, age: 0 });
    }
    function readEvents(a) {
      for (const e of a.events) {
        if (e.seq <= lastSeq) continue;
        if (e.type === 'hit') {
          pushFx({ kind: 'spark', x: e.x, y: e.y, life: e.proj === 'shell' || e.proj === 'orb' || e.proj === 'reflect' ? 0.4 : 0.25, strong: e.factor > 1, weak: e.factor < 1, proj: e.proj || (e.source === 'cat' ? 'spark' : 'bolt'), a: e.id * 1.7 + e.t * 9, zero: e.damage <= 0 });
          if (!reduced && (e.proj === 'shell' || e.proj === 'reflect')) shake = Math.max(shake, 0.08);
          // damage numbers: one label per enemy that adds up quick hits (at most 6 on screen)
          const label = fx.find(n => n.kind === 'num' && n.id === e.id && n.age < 0.45);
          if (label) {
            label.value += e.damage;
            label.age = Math.min(label.age, 0.1);
          } else if (fx.filter(n => n.kind === 'num').length < 6) pushFx({ kind: 'num', id: e.id, x: e.x, y: e.y, value: e.damage, life: 0.8, strong: e.factor > 1, weak: e.factor < 1 });
        } else if (e.type === 'kill') {
          pushFx({ kind: 'pop', x: e.x, y: e.y, life: e.boss ? 1.2 : 0.55, big: e.boss });
          if (!reduced) for (let i = 0; i < (e.boss ? 10 : 5); i++) pushFx({ kind: 'debris', x: e.x, y: e.y, a: (i / (e.boss ? 10 : 5)) * TAU + e.id, life: 0.7 });
          if (e.boss) flash = 0.6;
        } else if (e.type === 'ray' || e.type === 'chain') pushFx({ kind: e.type, x0: e.x0, y0: e.y0, x1: e.x1, y1: e.y1, life: e.type === 'ray' ? 0.14 : 0.2 });
        else if (e.type === 'blast') pushFx({ kind: 'blast', x: e.x, y: e.y, r: e.r, life: 0.4 });
        else if (e.type === 'crash') pushFx({ kind: 'pop', x: e.x, y: e.y, life: 0.5, red: true });
        else if (e.type === 'flee') pushFx({ kind: 'pop', x: e.x, y: e.y, life: 0.4 });
        else if (e.type === 'spawn') pushFx({ kind: 'arrive', id: e.id, life: 0.6 });
        else if (e.type === 'ship-hit') {
          shake = Math.max(shake, reduced ? 0 : e.damage > 15 ? 0.3 : 0.16);
          hurt = 0.45;
        } else if (e.type === 'absorb') pushFx({ kind: 'absorb', life: 0.3 });
        else if (e.type === 'shield-break') pushFx({ kind: 'break', id: e.id, life: 0.6 });
        else if (e.type === 'telegraph') pushFx({ kind: 'telegraph', frost: Boolean(e.frost), steam: Boolean(e.steam), laser: Boolean(e.laser), pollen: Boolean(e.pollen), x0: e.x0, y0: e.y0, x1: e.x1, y1: e.y1, life: Math.max(0.3, e.until - e.t) });
        else if (e.type === 'plate-crack') {
          const b = view?.arena?.foes.find(f => f.id === e.id);
          if (b && !reduced) for (let i = 0; i < 6; i++) pushFx({ kind: 'debris', x: b.x, y: b.y, a: (i / 6) * TAU + e.plates, life: 0.6, ice: true });
          flash = Math.max(flash, e.plates ? 0.15 : 0.45);
        }
        else if (e.type === 'boss-phase') {
          flash = 0.5;
          pushFx({ kind: 'phase', id: e.id, life: 1 });
          banner('PHASE 2', '#ffd77a');
        }
        // Beta 1.6 — Combat 3.0 events
        else if (e.type === 'fire') pushFx({ kind: 'muzzle', fire: e.fire, life: 0.09 });
        else if (e.type === 'mark') pushFx({ kind: 'mark', x: e.x, y: e.y, r: e.r, life: Math.max(0.3, e.until - e.t), shot: e.kind });
        else if (e.type === 'impact') {
          pushFx({ kind: 'impact', x: e.x, y: e.y, r: e.r, life: 0.45, shot: e.kind });
          if (!reduced) shake = Math.max(shake, 0.12);
        } else if (e.type === 'aid') pushFx({ kind: 'aid', aid: e.aid, x0: e.x0, y0: e.y0, x1: e.x1, y1: e.y1, life: 0.7 });
        else if (e.type === 'heal') {
          pushFx({ kind: 'heal', x0: e.x0, y0: e.y0, x1: e.x1, y1: e.y1, life: 0.7 });
          if (fx.filter(n => n.kind === 'num').length < 7) pushFx({ kind: 'num', id: -e.to, x: e.x1, y: e.y1, value: e.amount, life: 0.9, heal: true });
        } else if (e.type === 'barrier-break') pushFx({ kind: 'pop', x: e.x, y: e.y, life: 0.5, teal: true });
        else if (e.type === 'jam') jam = 0.7;
        else if (e.type === 'parry') {
          pushFx({ kind: 'parry', life: 0.55 });
          flash = Math.max(flash, 0.22);
          banner('PARADE!', '#8ff0d4');
        } else if (e.type === 'taktbruch') {
          flash = Math.max(flash, 0.3);
          banner('TAKTBRUCH!', '#5affd0');
        } else if (e.type === 'salvo-out') banner('Salve verpufft!', '#ffb35a');
        else if (e.type === 'cosmic') {
          banner(e.id === 'pulsar' ? 'PULSAR' : e.id === 'supernova' ? 'SUPERNOVA' : 'KOSMISCH', '#fff2a8', 0.7);
          if (e.id === 'supernova') flash = Math.max(flash, 0.2);
        }
        else if (e.type === 'steam') {
          flash = Math.max(flash, 0.15);
          if (!reduced) shake = Math.max(shake, 0.2);
        } else if (e.type === 'boss-open') banner(view?.arena?.foes.find(f => f.id === e.id)?.kind === 'petalguard' ? 'BLÜTE OFFEN' : 'OFFEN!', '#ffd77a', 0.8);
        else if (e.type === 'call') pushFx({ kind: 'pop', x: view?.arena?.foes.find(f => f.id === e.id)?.x || 140, y: view?.arena?.foes.find(f => f.id === e.id)?.y || 45, life: 0.6, big: true });
      }
      lastSeq = a.eventSeq || 0;
    }
    function update(c) {
      const dt = Math.min(0.05, c.dt || 0.016);
      time += dt;
      reduced = c.reducedMotion;
      view = getView();
      if (view && (view.inset || 0) !== inset) {
        inset = view.inset || 0;
        layout();
      }
      const a = view?.arena;
      if (a) readEvents(a);
      for (const f of fx) f.age += dt;
      for (let i = fx.length - 1; i >= 0; i--) if (fx[i].age >= fx[i].life) fx.splice(i, 1);
      shake = Math.max(0, shake - dt);
      hurt = Math.max(0, hurt - dt);
      flash = Math.max(0, flash - dt);
      jam = Math.max(0, jam - dt);
      for (const b of banners) b.age += dt;
      while (banners.length && banners[0].age >= banners[0].life) banners.shift();
    }
    function banner(text, color, life = 1.1) {
      if (banners.length >= 3) banners.shift();
      banners.push({ text, color, life, age: 0 });
    }
    function background(ctx, width, height) {
      const key = Math.ceil(width) + 'x' + Math.ceil(height) + (view?.planet || 'crystal');
      if (bgKey !== key) {
        bgKey = key;
        bg = Art()?.spaceBackground ? Art().spaceBackground('arena-' + (view?.planet || 'crystal'), Math.ceil(width), Math.ceil(height), ARENA_SKY[view?.planet] || ARENA_SKY.crystal, 77) : null;
      }
      if (bg) ctx.drawImage(bg, 0, 0);
      else {
        ctx.fillStyle = '#12163a';
        ctx.fillRect(0, 0, width, height);
      }
      const world = ARENA_WORLD[view?.planet] || ARENA_WORLD.crystal;
      // the campaign's planet, big and low behind the enemy line
      const c = P(W + 26, H * 0.72),
        pr = geo.s * 42,
        pg = ctx.createRadialGradient(c.x - pr * 0.3, c.y - pr * 0.3, pr * 0.1, c.x, c.y, pr);
      pg.addColorStop(0, world.planet[0]);
      pg.addColorStop(1, world.planet[1]);
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.arc(c.x, c.y, pr, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      // motes drifting toward the ship (embers, snow, gears, petals, dust); still with reduced motion
      for (let i = 0; i < 16; i++) {
        const seed = i * 97.31,
          lane = ((seed * 7.13) % 1) * H,
          speed = 10 + (i % 5) * 4,
          x = W - ((reduced ? seed * 3 : time * speed + seed * 3) % (W + 20)) + 10,
          y = lane + (reduced ? 0 : Math.sin(time * 0.8 + i) * 3),
          p = P(x, y),
          size = geo.s * (0.5 + (i % 3) * 0.35);
        ctx.globalAlpha = 0.35 + (i % 4) * 0.1;
        ctx.fillStyle = world.mote;
        if (world.kind === 'gear') {
          // loose hex nuts tumbling past
          ctx.strokeStyle = world.mote;
          ctx.lineWidth = Math.max(1, size * 0.45);
          ctx.beginPath();
          for (let j = 0; j <= 6; j++) {
            const ang = (j / 6) * TAU + (reduced ? 0 : time * 1.5) + i;
            j ? ctx.lineTo(p.x + Math.cos(ang) * size * 1.5, p.y + Math.sin(ang) * size * 1.5) : ctx.moveTo(p.x + Math.cos(ang) * size * 1.5, p.y + Math.sin(ang) * size * 1.5);
          }
          ctx.stroke();
        } else if (world.kind === 'petal') {
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, size * 1.6, size * 0.8, (reduced ? 0 : time) + i, 0, TAU);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, world.kind === 'ember' ? size * 0.9 : size, 0, TAU);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      // speed lines toward the ship: the expedition moves forward (static with reduced motion)
      ctx.strokeStyle = 'rgba(196,179,255,0.10)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 9; i++) {
        const lane = ((i + 0.5) / 9) * H,
          off = reduced ? 0 : (time * 40 + i * 37) % W,
          a = P(W - off, lane),
          b = P(W - off - 12, lane);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
    function drawShip(ctx, a, t) {
      const ship = a.ship,
        p = P(ship.x, lerp(ship.py, ship.y, t)),
        scale = geo.s * 12,
        blink = hurt > 0 && !reduced && Math.floor(time * 30) % 2 === 0;
      // Beta 1.5: the ship's paint leaves its own engine ribbon (engine + trim colour), so a cosmetic is recognisable in
      // the fight at phone size; a still ribbon with reduced motion
      const palette = Art().SHIP_PALETTES?.[view.cosmeticShip] || Art().SHIP_PALETTES?.default;
      if (palette) {
        const wob = reduced ? 0 : Math.sin(time * 9) * 0.8,
          tail = P(ship.x - 20, lerp(ship.py, ship.y, t) + wob),
          root = P(ship.x - 5, lerp(ship.py, ship.y, t)),
          g = ctx.createLinearGradient(root.x, root.y, tail.x, tail.y);
        g.addColorStop(0, palette.engine);
        g.addColorStop(0.45, palette.trim);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.strokeStyle = g;
        ctx.lineCap = 'round';
        ctx.globalAlpha = 0.75;
        ctx.lineWidth = geo.s * 3.2;
        ctx.beginPath();
        ctx.moveTo(root.x, root.y);
        ctx.lineTo(tail.x, tail.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.save();
      ctx.translate(p.x, p.y);
      if (geo.rot) ctx.rotate(-Math.PI / 2);
      ctx.scale(scale, scale);
      if (!blink) Art().drawPlayerShip(ctx, view.ship.model || 'Horizon', { ...view.ship, dna: view.dna }, time, Art().SHIP_PALETTES?.[view.cosmeticShip] || Art().SHIP_PALETTES?.default, window.SpaceKittens?.ROSTER?.[view.pilot || 0], hurt > 0 ? 'worried' : 'focus');
      ctx.restore();
      if (a.t < ship.shieldUntil) {
        const k = Math.min(1, (ship.shieldUntil - a.t) / (a.loadout?.shieldSeconds || 2.5));
        ctx.strokeStyle = `rgba(143,240,212,${0.35 + 0.4 * k})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, geo.s * 13, 0, TAU);
        ctx.stroke();
        Art().glowCircle(ctx, p.x, p.y, geo.s * 13, '#8ff0d4', 0.18);
      }
      // chilled: rime around the ship until the Salve thaws it
      if (a.t < (ship.chillUntil || 0) && a.t >= ship.salvoUntil) {
        Art().glowCircle(ctx, p.x, p.y, geo.s * 12, '#bff4ff', 0.28);
        ctx.strokeStyle = 'rgba(223,246,255,0.85)';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 6; i++) {
          const ang = (i / 6) * TAU + (reduced ? 0 : time * 0.5),
            r0 = geo.s * 9,
            r1 = geo.s * 12;
          ctx.beginPath();
          ctx.moveTo(p.x + Math.cos(ang) * r0, p.y + Math.sin(ang) * r0);
          ctx.lineTo(p.x + Math.cos(ang) * r1, p.y + Math.sin(ang) * r1);
          ctx.stroke();
        }
      }
      if (a.t < ship.salvoUntil) Art().glowCircle(ctx, p.x, p.y, geo.s * 9, '#ffd77a', 0.3 + (reduced ? 0 : Math.sin(time * 20) * 0.12));
      // jammed: magenta static crackles around the ship while the abilities are delayed
      if (jam > 0) {
        ctx.strokeStyle = `rgba(255,120,220,${0.3 + jam})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < 7; i++) {
          const ang = (i / 7) * TAU + (reduced ? 0 : time * 7),
            r0 = geo.s * 8,
            r1 = geo.s * (11 + (i % 2) * 2);
          ctx.moveTo(p.x + Math.cos(ang) * r0, p.y + Math.sin(ang) * r0);
          ctx.lineTo(p.x + Math.cos(ang + 0.25) * r1, p.y + Math.sin(ang + 0.25) * r1);
        }
        ctx.stroke();
      }
      if (view.cat) {
        const g = P(ship.x - 1, lerp(ship.py, ship.y, t) - 10);
        drawGlider(ctx, g.x, g.y + (reduced ? 0 : Math.sin(time * 2.1) * geo.s * 0.6), geo.s * 3.2);
      }
    }
    // Tikki's Funkengleiter: a small orange glider with her round head in the canopy (original, simple shapes)
    function drawGlider(ctx, x, y, s) {
      ctx.save();
      ctx.translate(x, y);
      if (geo.rot) ctx.rotate(-Math.PI / 2);
      Art().glowCircle(ctx, -s * 0.9, 0, s * 0.7, '#ffb35a', 0.35);
      ctx.fillStyle = '#ff9e5a';
      ctx.beginPath();
      ctx.moveTo(s * 1.1, 0);
      ctx.lineTo(-s * 0.8, -s * 0.75);
      ctx.lineTo(-s * 0.45, 0);
      ctx.lineTo(-s * 0.8, s * 0.75);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffd77a';
      ctx.fillRect(-s * 0.55, -s * 0.12, s * 1.2, s * 0.24);
      ctx.fillStyle = '#f3e7d6';
      ctx.beginPath();
      ctx.arc(s * 0.15, -s * 0.28, s * 0.3, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    const a_healing = f => fx.some(e => e.kind === 'heal' && e.age < 0.3);
    // Cogsworth's Taktband: a conveyor across the field in front of him; its parts advance one step per beat
    function drawConveyor(ctx, f) {
      const bx = f.anchor - 20,
        a0 = P(bx, 2),
        a1 = P(bx, H - 2),
        thick = geo.s * 5;
      ctx.strokeStyle = 'rgba(30,40,54,0.85)';
      ctx.lineWidth = thick;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.moveTo(a0.x, a0.y);
      ctx.lineTo(a1.x, a1.y);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,210,58,0.55)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([geo.s * 2, geo.s * 2]);
      ctx.stroke();
      ctx.setLineDash([]);
      const step = f.cwCount || 0;
      for (let i = 0; i < 6; i++) {
        const y = ((i * 16 + step * 4) % (H + 8)) - 4,
          c = P(bx, y);
        ctx.fillStyle = i % 3 ? '#9aa6b8' : '#c49a5a';
        ctx.fillRect(c.x - geo.s * 1.8, c.y - geo.s * 1.8, geo.s * 3.6, geo.s * 3.6);
      }
    }
    function drawFoe(ctx, f, t) {
      const p = P(lerp(f.px, f.x, t), lerp(f.py, f.y, t)),
        r = f.r * geo.s,
        boss = f.family === 'boss',
        // a short recoil away from the ship when hit
        kick = f.hitFlash > 0 && !reduced ? f.hitFlash * 18 : 0,
        kx = geo.rot ? 0 : kick,
        ky = geo.rot ? -kick : 0;
      // arrival: a ring that closes on the enemy
      const arrive = fx.find(e => e.kind === 'arrive' && e.id === f.id);
      if (arrive && !reduced) {
        ctx.strokeStyle = `rgba(255,179,90,${1 - arrive.age / arrive.life})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * (2.6 - (arrive.age / arrive.life) * 1.4), 0, TAU);
        ctx.stroke();
      }
      if (boss && f.kind === 'cogsworth') drawConveyor(ctx, f);
      // a support's heat guard: an orange shimmer; a barrier: a teal hex
      if (f.guardUntil > (view.arena?.t || 0)) Art().glowCircle(ctx, p.x, p.y, r * 1.9, '#ff9a3a', 0.28 + (reduced ? 0 : Math.sin(time * 9) * 0.08));
      ctx.save();
      ctx.translate(p.x + kx, p.y + ky);
      ctx.scale(r * 2.1 * (boss ? 1 : FOE_VISUAL), r * 2.1 * (boss ? 1 : FOE_VISUAL));
      if (boss && f.kind === 'emberbell' && window.PyraArt) {
        const phase = f.ebPhase || 'build';
        window.PyraArt.drawEmberbell(ctx, 0, 0, 0.36, time, { pressure: f.pressure || 0, phase, hit: f.hitFlash > 0 });
        // his pressure gauge: an arc that fills; glows red in the warning
        ctx.lineWidth = 0.06;
        ctx.strokeStyle = 'rgba(40,16,24,0.7)';
        ctx.beginPath();
        ctx.arc(0, 0, 0.62, Math.PI * 0.75, Math.PI * 2.25);
        ctx.stroke();
        ctx.strokeStyle = phase === 'warn' ? '#ff4a3a' : phase === 'cool' ? '#9ff4ff' : '#ffb35a';
        ctx.beginPath();
        ctx.arc(0, 0, 0.62, Math.PI * 0.75, Math.PI * 0.75 + Math.PI * 1.5 * (phase === 'build' ? (f.pressure || 0) / 100 : phase === 'cool' ? 0 : 1));
        ctx.stroke();
      } else if (boss && f.kind === 'cogsworth' && window.MekhanosArt) {
        const phase = window.cogsworthPhase ? window.cogsworthPhase(f) : 'inspect',
          mood = phase === 'open' || phase === 'broken' ? 'open' : phase === 'window' ? 'warn' : 'inspect';
        window.MekhanosArt.drawCogsworth(ctx, 0, 0.05, 0.34, time, { mood, hit: f.hitFlash > 0, reduced, shieldAlpha: mood === 'open' ? 0 : 0.28 });
        // the Taktband's eight beat lamps under him; the current beat lights up
        for (let i = 0; i < 8; i++) {
          const on = i === f.cwBeat,
            lx = -0.42 + i * 0.12;
          ctx.fillStyle = on ? (i === 3 ? '#ffd23a' : i >= 6 ? '#ff4a5a' : '#5affd0') : 'rgba(40,52,66,0.85)';
          ctx.beginPath();
          ctx.arc(lx, 0.66, 0.04, 0, TAU);
          ctx.fill();
        }
      } else if (boss && f.kind === 'petalguard' && window.ViridiaArt) {
        const mood = f.bloomOpen ? 'bloom' : fx.some(e => e.kind === 'telegraph' && e.pollen) ? 'telegraph' : 'bud';
        window.ViridiaArt.drawPetalguard(ctx, 0, 0.1, 0.3, time, { mood, petals: 6, healing: a_healing(f), hit: f.hitFlash > 0, reduced });
      } else if (boss && f.kind === 'frostbyte') {
        const thawed = f.plates === 0 && f.t < f.thawUntil;
        Art().drawFrostbyte(ctx, 0, 0, 0.4, time, { hit: f.hitFlash > 0, thawed, telegraph: fx.some(e => e.kind === 'telegraph') });
        // his crystal plates orbit him; cracked ones are gone, a thaw glows warm
        for (let i = 0; i < (f.plates || 0); i++) {
          const ang = (i / 3) * TAU + (reduced ? 0 : time * 0.8);
          ctx.save();
          ctx.translate(Math.cos(ang) * 0.62, Math.sin(ang) * 0.5);
          ctx.rotate(ang);
          ctx.fillStyle = 'rgba(191,244,255,0.78)';
          ctx.strokeStyle = 'rgba(255,255,255,0.95)';
          ctx.lineWidth = 0.03;
          ctx.beginPath();
          ctx.moveTo(0, -0.16);
          ctx.lineTo(0.09, 0);
          ctx.lineTo(0, 0.16);
          ctx.lineTo(-0.09, 0);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
        if (thawed) Art().glowCircle(ctx, 0, 0, 0.7, '#ffb36b', 0.25 + (reduced ? 0 : Math.sin(time * 6) * 0.08));
      } else if (boss) Art().drawMotteBot(ctx, 0, 0, 0.82, time, false, { variant: 'pips', hit: f.hitFlash > 0, shield: f.shieldOn, scanning: fx.some(e => e.kind === 'telegraph'), dizzy: false });
      else {
        const phase = f.shield ? (f.t < f.brokenUntil ? 'broken' : f.t % f.shield.every >= f.shield.from ? 'shield' : f.t % f.shield.every >= f.shield.warn ? 'warn' : 'open') : null;
        window.EnemyArt?.draw(ctx, f.kind, time + f.id * 0.7, { hit: f.hitFlash > 0, armor: Boolean(f.armor), seal: phase, call: f.callAfter && !f.called ? Math.min(1, f.t / f.callAfter) : 0, telegraph: phase === 'warn', reduced });
      }
      ctx.restore();
      // the boss's inspection shield: a hex dome while it holds
      if (boss && f.shieldOn) {
        ctx.strokeStyle = 'rgba(143,227,255,0.85)';
        ctx.fillStyle = 'rgba(143,227,255,0.12)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let i = 0; i <= 6; i++) {
          const ang = (i / 6) * TAU + (reduced ? 0 : time * 0.6),
            qx = p.x + Math.cos(ang) * r * 1.7,
            qy = p.y + Math.sin(ang) * r * 1.7;
          i ? ctx.lineTo(qx, qy) : ctx.moveTo(qx, qy);
        }
        ctx.fill();
        ctx.stroke();
      }
      if (f.barrier > 0) {
        ctx.strokeStyle = 'rgba(90,255,208,0.85)';
        ctx.fillStyle = 'rgba(90,255,208,0.12)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i <= 6; i++) {
          const ang = (i / 6) * TAU + (reduced ? 0 : time * 0.8),
            qx = p.x + Math.cos(ang) * r * 1.65,
            qy = p.y + Math.sin(ang) * r * 1.65;
          i ? ctx.lineTo(qx, qy) : ctx.moveTo(qx, qy);
        }
        ctx.fill();
        ctx.stroke();
      }
      // the player's focus: a reticle that turns
      if (view.arena?.focus === f.id) {
        const rr0 = r * (boss ? 1.5 : 1.9),
          spin = reduced ? 0 : time * 1.5;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          const ang = spin + (i * Math.PI) / 2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, rr0, ang - 0.35, ang + 0.35);
          ctx.stroke();
        }
      }
      if (!boss) {
        // affinity ring and a small health bar (the boss has the big bar on top)
        const aff = Art()?.DNA_TINT?.[f.affinity]?.[0] || '#ffffff';
        ctx.strokeStyle = aff;
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 1.25, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 1;
        const bw = Math.max(16, r * 2.2),
          pct = f.hp / Math.max(1, f.maxHp);
        ctx.fillStyle = 'rgba(10,12,40,0.7)';
        ctx.fillRect(p.x - bw / 2, p.y - r * 1.55 - 4, bw, 3.5);
        ctx.fillStyle = f.elite ? '#ffd77a' : '#ff8fb0';
        ctx.fillRect(p.x - bw / 2, p.y - r * 1.55 - 4, bw * pct, 3.5);
        const charge = 1 - (f.nextShot - f.t) / Math.max(0.1, f.every);
        if (charge > 0.8 && !reduced) Art().glowCircle(ctx, p.x, p.y, r * 0.8, '#ff6b6b', (charge - 0.8) * 3);
      }
    }
    function drawShots(ctx, a, t) {
      const color = Art()?.DNA_TINT?.[a.loadout.affinity]?.[0] || '#8fe3ff',
        // DNA 2.0: a rare-or-better weapon leaves a longer, brighter trail; a second affinity tints the core
        traits = a.loadout.stats?.traits || [],
        trail = traits.includes('trail'),
        core = a.loadout.affinity2 ? Art()?.DNA_TINT?.[a.loadout.affinity2]?.[0] || '#ffffff' : '#ffffff';
      for (const s of a.shots) {
        const p = P(lerp(s.px, s.x, t), lerp(s.py, s.y, t)),
          c = s.cat ? '#ffb35a' : color;
        if (s.kind === 'reflect') {
          // a parried shot: a bright star that flies home
          Art().glowCircle(ctx, p.x, p.y, geo.s * 5, '#8ff0d4', 0.7);
          Art().blob(ctx, p.x, p.y, geo.s * 1.8, geo.s * 1.8, '#ffffff');
        } else if (s.kind === 'lob') {
          // the mortar orb: a heavy glowing ball with its shadow on the target
          const tgt = P(s.tx, s.ty);
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.beginPath();
          ctx.ellipse(tgt.x, tgt.y, geo.s * 2.6, geo.s * 1.3, 0, 0, TAU);
          ctx.fill();
          Art().glowCircle(ctx, p.x, p.y, geo.s * 5, c, 0.65);
          Art().blob(ctx, p.x, p.y, geo.s * 2, geo.s * 2, '#ffffff');
        } else if (s.kind === 'shell') {
          // the heavy shell: a long glowing slug with a smoke trail
          const len = Math.hypot(s.vx || 1, s.vy || 0) || 1,
            q = P(lerp(s.px, s.x, t) - ((s.vx || 1) / len) * 9, lerp(s.py, s.y, t) - ((s.vy || 0) / len) * 9);
          ctx.strokeStyle = 'rgba(200,200,220,0.35)';
          ctx.lineWidth = geo.s * 2.6;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(q.x, q.y);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          Art().glowCircle(ctx, p.x, p.y, geo.s * 4.5, c, 0.6);
          Art().blob(ctx, p.x, p.y, geo.s * 2, geo.s * 1.4, '#ffffff');
        } else if (s.kind === 'orb') {
          Art().glowCircle(ctx, p.x, p.y, geo.s * 4, c, 0.6);
          Art().blob(ctx, p.x, p.y, geo.s * 1.6, geo.s * 1.6, '#ffffff');
        } else {
          const len = Math.hypot(s.vx || 1, s.vy || 0) || 1,
            tail = (s.kind === 'pellet' ? 3 : 5) * (trail && !s.cat ? 1.8 : 1),
            q = P(lerp(s.px, s.x, t) - ((s.vx || 1) / len) * tail, lerp(s.py, s.y, t) - ((s.vy || 0) / len) * tail);
          ctx.strokeStyle = c;
          ctx.lineWidth = Math.max(1.5, geo.s * (s.cat ? 1.2 : trail ? 1.4 : 1));
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(q.x, q.y);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          Art().blob(ctx, p.x, p.y, geo.s * (s.heavy ? 1.2 : 0.8), geo.s * (s.heavy ? 1.2 : 0.8), s.cat ? '#ffffff' : core);
        }
      }
      for (const q of a.foeShots) {
        const p = P(lerp(q.px, q.x, t), lerp(q.py, q.y, t)),
          c = SHOT_COLOR[q.kind] || '#e0565a',
          rr = q.r * geo.s;
        if (q.kind === 'stamp-heavy') {
          // the Prüfstempel: a big red stamp face, readable from far away
          Art().glowCircle(ctx, p.x, p.y, rr * 2.6, c, 0.5);
          ctx.fillStyle = '#c9a77a';
          ctx.fillRect(p.x - rr, p.y - rr, rr * 2, rr * 2);
          ctx.fillStyle = c;
          ctx.fillRect(p.x - rr * 0.75, p.y - rr * 0.75, rr * 1.5, rr * 1.5);
        } else if (q.kind === 'breath' || q.kind === 'pollen-orb') {
          // Frostatem / pollen storm: big soft orbs with a light core
          Art().glowCircle(ctx, p.x, p.y, rr * 2.8, c, 0.5);
          Art().blob(ctx, p.x, p.y, rr, rr, q.kind === 'breath' ? '#e8fbff' : '#fff8d0');
        } else if (q.kind === 'steam') {
          // the Dampfstoß: a rolling wall of white steam
          for (let i = 0; i < 3; i++) Art().glowCircle(ctx, p.x + (geo.rot ? 0 : i * rr * 0.8), p.y - (geo.rot ? i * rr * 0.8 : 0), rr * 2.2, '#f4f0ff', 0.35);
          Art().blob(ctx, p.x, p.y, rr * 1.2, rr * 1.2, 'rgba(255,255,255,0.85)');
        } else if (q.kind === 'release-laser') {
          // the Freigabelaser: a long hard red beam segment along its lane
          const tail = P(q.x + 26, q.y);
          ctx.strokeStyle = 'rgba(255,74,90,0.35)';
          ctx.lineWidth = rr * 3;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(tail.x, tail.y);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          ctx.strokeStyle = '#ffd0d4';
          ctx.lineWidth = rr * 0.9;
          ctx.stroke();
        } else if (q.lob) {
          // artillery: slag, magma, crates and seeds arc toward their mark
          if (q.kind === 'crate') {
            ctx.fillStyle = '#c49a5a';
            ctx.fillRect(p.x - rr * 0.9, p.y - rr * 0.9, rr * 1.8, rr * 1.8);
            ctx.strokeStyle = '#5a3a1a';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(p.x - rr * 0.9, p.y - rr * 0.9, rr * 1.8, rr * 1.8);
          } else {
            Art().glowCircle(ctx, p.x, p.y, rr * 1.4, c, 0.55);
            Art().blob(ctx, p.x, p.y, rr * 0.55, rr * 0.55, q.kind === 'bulb' ? '#c4a45a' : '#ffd0a0');
          }
        } else if (q.kind === 'thorn-shot' || q.kind === 'thorn') {
          const len = Math.hypot(q.vx || 1, q.vy || 0) || 1,
            tip = P(q.x + (q.vx / len) * 2.4, q.y + (q.vy / len) * 2.4);
          ctx.strokeStyle = c;
          ctx.lineWidth = Math.max(2, rr * 0.9);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(tip.x, tip.y);
          ctx.stroke();
        } else {
          Art().glowCircle(ctx, p.x, p.y, rr * 2.2, c, 0.45);
          Art().blob(ctx, p.x, p.y, rr, rr, c);
        }
      }
    }
    function drawFx(ctx, a) {
      const color = Art()?.DNA_TINT?.[a.loadout.affinity]?.[0] || '#8fe3ff';
      for (const f of fx) {
        const k = f.age / f.life;
        if (f.kind === 'ray' || f.kind === 'chain' || f.kind === 'telegraph') {
          const p0 = P(f.x0, f.y0),
            p1 = P(f.x1, f.y1);
          if (f.kind === 'telegraph' && (f.steam || f.laser || f.pollen)) {
            drawTelegraph(ctx, f);
            continue;
          }
          if (f.kind === 'telegraph') {
            // the boss announces an attack: a pulsing dashed line to where the ship was (red stamp, blue Frostatem)
            ctx.setLineDash([8, 6]);
            ctx.strokeStyle = `rgba(${f.frost ? '127,220,255' : '255,107,107'},${0.45 + (reduced ? 0.3 : 0.4 * Math.abs(Math.sin(time * 9)))})`;
            ctx.lineWidth = f.frost ? 5 : 3;
          } else if (f.kind === 'chain') {
            // the chain jumps as a jagged bolt
            ctx.strokeStyle = '#ffe26b';
            ctx.globalAlpha = 1 - k;
            ctx.lineWidth = geo.s * 0.9;
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            for (let i = 1; i < 5; i++) {
              const u = i / 5,
                jx = (Math.sin(i * 12.9 + f.x0) * 0.5) * geo.s * 4,
                jy = (Math.cos(i * 7.3 + f.y0) * 0.5) * geo.s * 4;
              ctx.lineTo(p0.x + (p1.x - p0.x) * u + jx, p0.y + (p1.y - p0.y) * u + jy);
            }
            ctx.lineTo(p1.x, p1.y);
            ctx.stroke();
            ctx.globalAlpha = 1;
            continue;
          } else if (f.kind === 'ray') {
            // the beam: a wide soft glow with a hard white core, fading fast
            ctx.globalAlpha = 1 - k;
            ctx.strokeStyle = color;
            ctx.lineCap = 'round';
            ctx.lineWidth = geo.s * 3.6;
            ctx.globalAlpha = (1 - k) * 0.45;
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
            ctx.stroke();
            ctx.globalAlpha = 1 - k;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = geo.s * 1.1;
            ctx.stroke();
            ctx.globalAlpha = 1;
            continue;
          } else {
            ctx.strokeStyle = f.kind === 'chain' ? '#ffe26b' : color;
            ctx.globalAlpha = 1 - k;
            ctx.lineWidth = geo.s * (f.kind === 'ray' ? 1.6 : 0.8);
          }
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
        } else if (f.kind === 'spark') {
          const p = P(f.x, f.y),
            st = IMPACT[f.proj] || IMPACT.bolt,
            tint = f.zero ? '#9aa2c4' : f.weak ? '#9aa2c4' : f.strong ? '#ffd77a' : f.proj === 'spark' ? '#ffb35a' : f.proj === 'reflect' ? '#8ff0d4' : color;
          // a still flash with reduced motion; otherwise the family's own impact
          Art().glowCircle(ctx, p.x, p.y, geo.s * st.r * (f.strong ? 1.3 : 1) * (1 - k * 0.4), tint, (reduced ? 0.45 : 0.7) * (1 - k));
          if (reduced) continue;
          if (st.ring) {
            ctx.strokeStyle = tint;
            ctx.globalAlpha = 1 - k;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(p.x, p.y, geo.s * st.r * (0.4 + k), 0, TAU);
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
          if (st.scorch) Art().blob(ctx, p.x, p.y, geo.s * 1.4 * (1 - k), geo.s * 1.4 * (1 - k), '#ffffff');
          for (let i = 0; i < st.n; i++) {
            const ang = f.a + (i / st.n) * TAU,
              d = geo.s * (1 + k * st.r * 0.9);
            ctx.fillStyle = tint;
            ctx.globalAlpha = 1 - k;
            ctx.fillRect(p.x + Math.cos(ang) * d - 1, p.y + Math.sin(ang) * d - 1, 2.2, 2.2);
          }
          ctx.globalAlpha = 1;
        } else if (f.kind === 'muzzle') {
          if (reduced) continue;
          const sp = P(a.ship.x + 8, a.ship.y);
          Art().glowCircle(ctx, sp.x, sp.y, geo.s * (f.fire === 'single' || f.fire === 'lob' ? 6 : f.fire === 'beam' ? 5 : 3.5) * (1 - k), color, 0.8 * (1 - k));
        } else if (f.kind === 'mark') {
          // artillery: the landing spot fills up until it lands
          const p = P(f.x, f.y),
            rr0 = f.r * geo.s,
            c = SHOT_COLOR[f.shot] || '#ff6b6b';
          ctx.strokeStyle = c;
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 4]);
          ctx.beginPath();
          ctx.arc(p.x, p.y, rr0, 0, TAU);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 0.18 + 0.3 * k;
          ctx.fillStyle = c;
          ctx.beginPath();
          ctx.arc(p.x, p.y, rr0 * k, 0, TAU);
          ctx.fill();
          ctx.globalAlpha = 1;
        } else if (f.kind === 'impact') {
          const p = P(f.x, f.y),
            c = SHOT_COLOR[f.shot] || '#ff9a3a';
          Art().glowCircle(ctx, p.x, p.y, f.r * geo.s * (1 + k * 0.6), c, 0.6 * (1 - k));
        } else if (f.kind === 'aid' || f.kind === 'heal') {
          // a support's help travels to its ally (guard orange, barrier teal, heal green)
          const p0 = P(f.x0, f.y0),
            p1 = P(f.x1, f.y1),
            c = f.kind === 'heal' || f.aid === 'heal' ? '#8fffb0' : f.aid === 'barrier' ? '#5affd0' : '#ffb35a';
          ctx.strokeStyle = c;
          ctx.globalAlpha = 0.8 * (1 - k);
          ctx.lineWidth = 2.5;
          ctx.setLineDash([3, 4]);
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.stroke();
          ctx.setLineDash([]);
          const m = reduced ? 1 : Math.min(1, k * 2);
          Art().glowCircle(ctx, p0.x + (p1.x - p0.x) * m, p0.y + (p1.y - p0.y) * m, geo.s * 3, c, 0.7 * (1 - k));
          ctx.globalAlpha = 1;
        } else if (f.kind === 'parry') {
          const sp = P(a.ship.x, a.ship.y);
          ctx.strokeStyle = '#ffffff';
          ctx.globalAlpha = 1 - k;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, geo.s * (12 + k * 10), 0, TAU);
          ctx.stroke();
          ctx.globalAlpha = 1;
        } else if (f.kind === 'pop') {
          const p = P(f.x, f.y);
          ctx.strokeStyle = f.teal ? '#5affd0' : f.red ? '#ff8f8f' : '#ffd77a';
          ctx.globalAlpha = 1 - k;
          ctx.lineWidth = f.big ? 4 : 2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, geo.s * (3 + k * (f.big ? 22 : 9)), 0, TAU);
          ctx.stroke();
          ctx.globalAlpha = 1;
        } else if (f.kind === 'debris') {
          const d = geo.s * (2 + k * 12),
            p = P(f.x, f.y);
          ctx.fillStyle = f.ice ? `rgba(191,244,255,${1 - k})` : `rgba(201,194,244,${1 - k})`;
          ctx.fillRect(p.x + Math.cos(f.a) * d - 1.5, p.y + Math.sin(f.a) * d + k * k * 10 - 1.5, 3, 3);
        } else if (f.kind === 'blast') {
          const p = P(f.x, f.y);
          Art().glowCircle(ctx, p.x, p.y, geo.s * f.r * (0.6 + k * 0.5), color, 0.5 * (1 - k));
        } else if (f.kind === 'num') {
          const p = P(f.x, f.y),
            rise = reduced ? 0 : k * 8 * geo.s;
          ctx.globalAlpha = Math.min(1, (1 - k) * 1.6);
          ctx.font = '900 ' + Math.round(Math.max(12, geo.s * (f.strong ? 6 : 5))) + 'px Nunito, sans-serif';
          ctx.textAlign = 'center';
          ctx.lineWidth = 3;
          ctx.strokeStyle = 'rgba(20,18,50,0.85)';
          const text = f.heal ? '+' + (typeof fmt === 'function' ? fmt(f.value) : Math.round(f.value)) : f.value <= 0 ? '✕' : '-' + (typeof fmt === 'function' ? fmt(f.value) : Math.round(f.value));
          ctx.strokeText(text, p.x, p.y - geo.s * 9 - rise);
          ctx.fillStyle = f.heal ? '#8fffb0' : f.value <= 0 ? '#b9b4d8' : f.strong ? '#ffd77a' : f.weak ? '#b9b4d8' : '#ffffff';
          ctx.fillText(text, p.x, p.y - geo.s * 9 - rise);
          ctx.globalAlpha = 1;
        }
      }
    }
    // Emberbell's steam: a curtain over the whole field at his line; Cogsworth's laser: a lane across the field;
    // Petalguard's pollen storm: a pink fan toward the ship
    function drawTelegraph(ctx, f) {
      const pulse = reduced ? 0.6 : 0.45 + 0.4 * Math.abs(Math.sin(time * 9));
      if (f.steam) {
        const a0 = P(f.x0 - 8, 0),
          a1 = P(f.x0 - 8, H);
        ctx.strokeStyle = `rgba(255,154,58,${pulse})`;
        ctx.lineWidth = geo.s * 3;
        ctx.setLineDash([10, 6]);
        ctx.beginPath();
        ctx.moveTo(a0.x, a0.y);
        ctx.lineTo(a1.x, a1.y);
        ctx.stroke();
        ctx.setLineDash([]);
        return;
      }
      if (f.laser) {
        const a0 = P(f.x0, f.y0),
          a1 = P(0, f.y1);
        ctx.strokeStyle = `rgba(255,74,90,${pulse})`;
        ctx.lineWidth = geo.s * 2.2;
        ctx.setLineDash([12, 6]);
        ctx.beginPath();
        ctx.moveTo(a0.x, a0.y);
        ctx.lineTo(a1.x, a1.y);
        ctx.stroke();
        ctx.setLineDash([]);
        return;
      }
      const base = Math.atan2(f.y1 - f.y0, f.x1 - f.x0);
      ctx.strokeStyle = `rgba(255,143,200,${pulse})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      for (let i = -3; i <= 3; i++) {
        const ang = base + i * 0.15,
          p0 = P(f.x0, f.y0),
          p1 = P(f.x0 + Math.cos(ang) * 120, f.y0 + Math.sin(ang) * 120);
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    function drawBanners(ctx, width, height) {
      banners.forEach((b, i) => {
        const k = b.age / b.life,
          y = height * 0.3 + i * 34 - (reduced ? 0 : k * 16);
        ctx.globalAlpha = Math.min(1, (1 - k) * 2.5);
        ctx.font = '900 ' + Math.round(Math.min(30, width * 0.075)) + 'px Nunito, sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(14,12,40,0.9)';
        ctx.strokeText(b.text, width / 2, y);
        ctx.fillStyle = b.color;
        ctx.fillText(b.text, width / 2, y);
        ctx.globalAlpha = 1;
      });
    }
    function draw(ctx, width, height) {
      if (width !== w || height !== h) {
        w = width;
        h = height;
        layout();
      }
      stats.frames++;
      background(ctx, width, height);
      const a = view?.arena;
      if (!a || !Art()) return;
      ctx.save();
      if (shake > 0) ctx.translate((Math.random() - 0.5) * 8 * shake, (Math.random() - 0.5) * 8 * shake);
      const t = Math.max(0, Math.min(1, view.alpha || 0));
      stats.foes = a.foes.length;
      stats.shots = a.shots.length + a.foeShots.length;
      for (const f of a.foes) drawFoe(ctx, f, t);
      drawShots(ctx, a, t);
      drawShip(ctx, a, t);
      drawFx(ctx, a);
      if (fx.some(f => f.kind === 'absorb')) {
        const p = P(a.ship.x, a.ship.y);
        Art().glowCircle(ctx, p.x, p.y, geo.s * 15, '#8ff0d4', 0.3);
      }
      ctx.restore();
      // a hit on the ship: a soft red edge; a boss phase change or kill: a short white flash
      if (hurt > 0) {
        const g = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.35, width / 2, height / 2, Math.max(width, height) * 0.7);
        g.addColorStop(0, 'rgba(255,80,80,0)');
        g.addColorStop(1, `rgba(255,80,80,${hurt * 0.55})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, width, height);
      }
      if (flash > 0 && !reduced) {
        ctx.fillStyle = `rgba(255,255,255,${flash * 0.35})`;
        ctx.fillRect(0, 0, width, height);
      }
      drawBanners(ctx, width, height);
    }
    // simulation point of a canvas point (taps)
    function toSim(cx, cy) {
      return geo.rot ? { x: W - (cy - geo.oy) / geo.s, y: (cx - geo.ox) / geo.s } : { x: (cx - geo.ox) / geo.s, y: (cy - geo.oy) / geo.s };
    }
    return {
      resize(width, height) {
        w = width;
        h = height;
        layout();
      },
      update,
      draw,
      attach(canvas) {
        let down = null;
        // Beta 1.7 M10: a drag steers the ship (relative: the finger's way, not its position, so it never covers the
        // ship); a short touch without movement stays the Fokusziel tap. Portrait shows the arena turned, so the
        // ship's lane runs along the screen's horizontal axis there.
        canvas.style.touchAction = 'none';
        canvas.addEventListener('pointerdown', e => {
          down = { id: e.pointerId, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, t: performance.now(), drag: false };
        });
        canvas.addEventListener('pointermove', e => {
          if (!down || e.pointerId !== down.id) return;
          if (!down.drag && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10) {
            down.drag = true;
            canvas.setPointerCapture?.(e.pointerId);
          }
          if (!down.drag) return;
          const rect = canvas.getBoundingClientRect(),
            px = (w / Math.max(1, rect.width)) / Math.max(1e-6, geo.s),
            d = geo.rot ? (e.clientX - down.lx) * px : (e.clientY - down.ly) * px;
          down.lx = e.clientX;
          down.ly = e.clientY;
          if (d) window.dispatchEvent(new CustomEvent('arena-steer', { detail: { dy: d } }));
        });
        canvas.addEventListener('pointercancel', () => (down = null));
        canvas.addEventListener('pointerup', e => {
          if (!down || down.drag || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 12 || performance.now() - down.t > 600) return (down = null);
          down = null;
          const rect = canvas.getBoundingClientRect(),
            sim = toSim(((e.clientX - rect.left) / Math.max(1, rect.width)) * w, ((e.clientY - rect.top) / Math.max(1, rect.height)) * h);
          window.dispatchEvent(new CustomEvent('arena-tap', { detail: sim }));
        });
      },
      toSim,
      onShow() {
        lastSeq = view?.arena?.eventSeq || 0;
      },
      // QA: canvas position of an arena point (frame sequences, e2e taps) and the current orientation
      toCanvas: (x, y) => P(x, y),
      debug: () => ({ ...stats, fx: fx.length, scale: geo.s, rotated: geo.rot })
    };
  }
  window.NebulaScenes = window.NebulaScenes || {};
  window.NebulaScenes.createArenaScene = createArenaScene;
})();
