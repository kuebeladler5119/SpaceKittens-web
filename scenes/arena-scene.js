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
    // P1.4: the signatures of Emberbell, Cogsworth and Petalguard
    'heat-ring': '#ff8a3a', 'trap-laser': '#ff4a5a', 'petal-storm': '#ff8fbd',
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
          // P1.3: what caught it (shield, plates, barrier, armour) and what the target is made of decide the reaction
          const foe = view?.arena?.foes.find(q => q.id === e.id),
            matter = window.DnaVisuals?.CHASSIS?.[view?.dna?.chassis]?.matter || 'kinetic';
          pushFx({ kind: 'spark', x: e.x, y: e.y, life: e.proj === 'shell' || e.proj === 'orb' || e.proj === 'reflect' ? 0.4 : 0.25, strong: e.factor > 1, weak: e.factor < 1, proj: e.proj || (e.source === 'cat' ? 'spark' : 'bolt'), a: e.id * 1.7 + e.t * 9, zero: e.damage <= 0, guard: e.guard || null, ek: foe?.kind || null, fr: foe?.r || 5, matter });
          if (!reduced && (e.proj === 'shell' || e.proj === 'reflect')) shake = Math.max(shake, 0.08);
          // damage numbers: one label per enemy that adds up quick hits (at most 6 on screen)
          const label = fx.find(n => n.kind === 'num' && n.id === e.id && n.age < 0.45);
          if (label) {
            label.value += e.damage;
            label.age = Math.min(label.age, 0.1);
          } else if (fx.filter(n => n.kind === 'num').length < 6) pushFx({ kind: 'num', id: e.id, x: e.x, y: e.y, value: e.damage, life: 0.8, strong: e.factor > 1, weak: e.factor < 1 });
        } else if (e.type === 'kill') {
          // P1.3: three explosion sizes by the enemy's size (Enemy DNA), the guardian's is the heavy one
          const dna = window.DnaVisuals?.ENEMY?.[e.kind],
            size = e.boss ? 'xl' : dna?.size || 'm',
            pieces = { s: 4, m: 6, l: 8, xl: 12 }[size],
            shape = { crystal: 'dust', ice: 'snow', ember: 'ember', gear: 'gear', petal: 'petal', leaf: 'petal' }[dna?.death] || (ARENA_WORLD[view?.planet] || ARENA_WORLD.crystal).kind;
          pushFx({ kind: 'pop', x: e.x, y: e.y, life: e.boss ? 1.2 : size === 'l' ? 0.7 : 0.55, big: e.boss, size });
          // P1.2: the debris has the shape of the enemy (crystal splinters, ice shards, embers, cogs, petals)
          if (!reduced) for (let i = 0; i < pieces; i++) pushFx({ kind: 'debris', x: e.x, y: e.y, a: (i / pieces) * TAU + e.id, life: e.boss ? 0.95 : 0.7, shape });
          if (e.boss) flash = 0.6;
        } else if (e.type === 'ray' || e.type === 'chain') pushFx({ kind: e.type, x0: e.x0, y0: e.y0, x1: e.x1, y1: e.y1, life: e.type === 'ray' ? 0.14 : 0.2, miss: Boolean(e.miss) });
        else if (e.type === 'blast') pushFx({ kind: 'blast', x: e.x, y: e.y, r: e.r, life: 0.4 });
        else if (e.type === 'crash') pushFx({ kind: 'pop', x: e.x, y: e.y, life: 0.5, red: true });
        else if (e.type === 'flee') pushFx({ kind: 'pop', x: e.x, y: e.y, life: 0.4 });
        else if (e.type === 'spawn') pushFx({ kind: 'arrive', id: e.id, life: 0.6 });
        else if (e.type === 'ship-hit') {
          shake = Math.max(shake, reduced ? 0 : e.damage > 15 ? 0.3 : 0.16);
          hurt = 0.45;
          // P1.3: the hull takes it (sparks and smoke at the nose); a heavy hit jolts the ship by its mass
          pushFx({ kind: 'hullhit', life: 0.5, a: e.t * 7 });
          if (!reduced) shipMo.jolt = Math.max(shipMo.jolt, Math.min(1, e.damage / 12) / shipMotionOf().mass);
        } else if (e.type === 'absorb') pushFx({ kind: 'absorb', life: 0.3 });
        // P1.5: a shot that touched nothing – a small grey puff where it left (at most four at a time)
        else if (e.type === 'miss') {
          if (fx.filter(n => n.kind === 'miss').length < 4) pushFx({ kind: 'miss', x: e.x, y: e.y, life: 0.45 });
        }
        else if (e.type === 'shield-break') pushFx({ kind: 'break', id: e.id, life: 0.6 });
        else if (e.type === 'telegraph') {
          pushFx({ kind: 'telegraph', frost: Boolean(e.frost), steam: Boolean(e.steam), laser: Boolean(e.laser), pollen: Boolean(e.pollen), raster: Boolean(e.raster), wall: Boolean(e.wall), bell: Boolean(e.bell), belt: Boolean(e.belt), path: e.path || null, gaps: e.gaps, laneY: e.laneY, half: e.half, reach: e.reach, lanes: e.lanes, safe: e.safe, n: e.n, gapY: e.gapY, gap: e.gap, x0: e.x0, y0: e.y0, x1: e.x1, y1: e.y1, life: Math.max(0.3, e.until - e.t) });
          // P1.3: a signature names its counter
          if (e.raster) banner('RASTER: GRÜNE BAHN!', '#ff9aa6', 1.8);
          if (e.wall) banner('FROSTWAND: LÜCKE!', '#9fe8ff', 1.8);
          // P1.4
          if (e.bell) banner('GLOCKENSCHLAG: LÜCKEN!', '#ffb35a', 1.8);
          if (e.belt) banner('FLIESSBAND: RAUS!', '#ff9aa6', 1.8);
          if (e.path) banner('BLÜTENPFAD: FOLGEN!', '#8fffc0', 1.8);
        }
        else if (e.type === 'plate-crack') {
          const b = view?.arena?.foes.find(f => f.id === e.id);
          if (b && !reduced) for (let i = 0; i < 6; i++) pushFx({ kind: 'debris', x: b.x, y: b.y, a: (i / 6) * TAU + e.plates, life: 0.6, ice: true });
          flash = Math.max(flash, e.plates ? 0.15 : 0.45);
        }
        else if (e.type === 'boss-phase') {
          phaseAt.set(e.id, time);
          flash = 0.5;
          pushFx({ kind: 'phase', id: e.id, life: 1 });
          banner('PHASE 2', '#ffd77a');
        }
        // Beta 1.6 — Combat 3.0 events
        else if (e.type === 'fire') {
          pushFx({ kind: 'muzzle', fire: e.fire, ang: e.ang || 0, life: 0.09 });
          // P1.3: the recoil of the shot by its chassis, against the ship's mass
          if (!reduced) shipMo.recoil = Math.max(shipMo.recoil, (window.DnaVisuals?.CHASSIS?.[view?.dna?.chassis]?.kick ?? 0.3) / shipMotionOf().mass);
        }
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
        // Gameplay loop: a shot the player steered out of the way says so, next to the ship (at most one label at a time)
        else if (e.type === 'dodge') {
          if (!fx.some(n => n.kind === 'dodge' && n.age < n.life * 0.6)) pushFx({ kind: 'dodge', x: e.x, y: e.y, life: 0.75 });
        }
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
      updateShipMotion(a, dt);
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
        // P1.3/P1.4: an equipped engine trail replaces the ribbon with its own (scenes/cosmetic-art.js: the same trail as
        // in the classic fight, the Werft and the studio – sparks, crystal shards or little cogs)
        const engineId = typeof equippedCosmetic === 'function' ? equippedCosmetic('engine') : null;
        if (!window.CosmeticArt?.engineTrail(ctx, engineId, root, P(ship.x - 24, lerp(ship.py, ship.y, t) + wob), geo.s * 3.2, time, reduced)) {
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
      }
      ctx.save();
      ctx.translate(p.x, p.y);
      if (geo.rot) ctx.rotate(-Math.PI / 2);
      // P1.3: in the ship's own frame (nose = +x): it kicks back with a shot, leans into a turn (with a slight roll),
      // jolts under a heavy hit; the engines flare while it accelerates
      if (!reduced) {
        ctx.translate(-shipMo.recoil * geo.s * 2.4, 0);
        ctx.rotate(shipMo.bank + Math.sin(time * 38) * shipMo.jolt * 0.12);
        if (shipMo.boost > 0.05) Art().glowCircle(ctx, -scale * 0.72, 0, scale * (0.25 + shipMo.boost * 0.3), palette?.engine || '#8fe3ff', 0.35 * shipMo.boost);
      }
      ctx.scale(scale, scale * (1 - Math.abs(shipMo.bank) * 0.35));
      if (!blink) Art().drawPlayerShip(ctx, view.ship.model || 'Horizon', { ...view.ship, dna: view.dna }, time, Art().SHIP_PALETTES?.[view.cosmeticShip] || Art().SHIP_PALETTES?.default, window.SpaceKittens?.ROSTER?.[view.pilot || 0], hurt > 0 ? 'worried' : 'focus');
      ctx.restore();
      // P1.5: a quiet aim line from the muzzle along the guns' direction (straight ahead without Auto-Aim): the player
      // always sees where the ship fires. It fades out over a third of the field; nothing else is marked.
      const ctl = a.control;
      if (ctl && ctl.aim < 3 && !blink) {
        const ang = ship.aimAng || 0,
          y0 = lerp(ship.py, ship.y, t),
          m0 = P(ship.x + 7, y0),
          m1 = P(ship.x + 7 + Math.cos(ang) * 52, y0 + Math.sin(ang) * 52),
          g = ctx.createLinearGradient(m0.x, m0.y, m1.x, m1.y),
          c = Art()?.DNA_TINT?.[a.loadout?.affinity]?.[0] || '#8fe3ff';
        g.addColorStop(0, c);
        g.addColorStop(0.6, c);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.save();
        // a dark underlay keeps it readable on bright skies (it never hides an enemy's red warning line: drawn thinner)
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = 'rgba(16,14,44,1)';
        ctx.lineWidth = Math.max(3, geo.s * 0.9);
        ctx.setLineDash([geo.s * 2.2, geo.s * 1.6]);
        ctx.lineDashOffset = reduced ? 0 : -time * geo.s * 10;
        ctx.beginPath();
        ctx.moveTo(m0.x, m0.y);
        ctx.lineTo(m1.x, m1.y);
        ctx.stroke();
        ctx.globalAlpha = 0.85;
        ctx.strokeStyle = g;
        ctx.lineWidth = Math.max(1.6, geo.s * 0.5);
        ctx.stroke();
        ctx.restore();
      }
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
    // ----- P1.3 combat presentation -----
    // the ship's motion (presentation only: the ship's position is the game's): it leans into a turn, follows the
    // steering with its class's own feel, kicks back with heavy shots and jolts under a heavy hit
    const shipMo = { y: null, vy: 0, bank: 0, recoil: 0, jolt: 0, boost: 0 };
    const phaseAt = new Map(); // guardian id → when its phase 2 began (the transformation unfolds from there)
    function shipMotionOf() {
      return window.DnaVisuals?.ROLE?.[view?.ship?.model]?.motion || { bank: 0.22, settle: 9, mass: 1 };
    }
    function updateShipMotion(a, dt) {
      if (!a || reduced) {
        shipMo.bank = shipMo.recoil = shipMo.jolt = shipMo.boost = 0;
        shipMo.y = a ? a.ship.y : null;
        return;
      }
      const m = shipMotionOf(),
        y = a.ship.y;
      if (shipMo.y === null) shipMo.y = y;
      const vy = dt > 0 ? (y - shipMo.y) / dt : 0;
      shipMo.y = y;
      shipMo.vy += (vy - shipMo.vy) * Math.min(1, dt * m.settle);
      const want = Math.max(-1, Math.min(1, shipMo.vy / 66)) * m.bank;
      shipMo.bank += (want - shipMo.bank) * Math.min(1, dt * m.settle);
      shipMo.boost += (Math.min(1, Math.abs(shipMo.vy) / 50) - shipMo.boost) * Math.min(1, dt * 6);
      shipMo.recoil *= Math.exp(-dt * 11);
      shipMo.jolt *= Math.exp(-dt * 5);
    }
    // a zone in simulation units as a screen path (turned fields too)
    function zonePath(ctx, x0, y0, x1, y1) {
      const p = [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)];
      ctx.beginPath();
      ctx.moveTo(p[0].x, p[0].y);
      for (let i = 1; i < 4; i++) ctx.lineTo(p[i].x, p[i].y);
      ctx.closePath();
    }
    function zoneLabel(ctx, text, x, y, color) {
      const p = P(x, y);
      ctx.font = '900 ' + Math.round(Math.max(11, geo.s * 4.2)) + 'px Nunito, sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(20,18,50,0.85)';
      ctx.strokeText(text, p.x, p.y);
      ctx.fillStyle = color;
      ctx.fillText(text, p.x, p.y);
      ctx.textAlign = 'left';
    }
    // the arrow from the ship to the safe place (where to steer)
    function safeArrow(ctx, a, y, color) {
      const sy = a.ship.y;
      if (Math.abs(y - sy) < 4) return;
      const p0 = P(a.ship.x + 9, sy),
        p1 = P(a.ship.x + 9, y + (y > sy ? -3 : 3)),
        ang = Math.atan2(p1.y - p0.y, p1.x - p0.x),
        hl = geo.s * 3.4;
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2, geo.s * 0.9);
      ctx.setLineDash([geo.s * 2.4, geo.s * 1.8]);
      ctx.lineDashOffset = reduced ? 0 : -time * geo.s * 12;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p1.x - Math.cos(ang - 0.5) * hl, p1.y - Math.sin(ang - 0.5) * hl);
      ctx.lineTo(p1.x - Math.cos(ang + 0.5) * hl, p1.y - Math.sin(ang + 0.5) * hl);
      ctx.closePath();
      ctx.fill();
    }
    // Signature zones lie under everything (enemies, shots and the ship stay readable on top): the scanned lanes fill
    // red from the guardian toward the ship as the scan comes (a countdown you can see), the safe lane is green;
    // the Frostwand's ghost stands where the wall starts, its gap glows green
    function drawZones(ctx, a) {
      for (const f of fx) {
        if (f.kind !== 'telegraph' || !(f.raster || f.wall || f.bell || f.belt || f.path)) continue;
        if (f.bell || f.belt || f.path) {
          drawZonesP14(ctx, a, f);
          continue;
        }
        const k = Math.min(1, f.age / f.life),
          pulse = reduced ? 0.6 : 0.45 + 0.4 * Math.abs(Math.sin(time * 8)),
          x1 = Math.max(30, f.x0 - 8);
        if (f.raster) {
          const n = f.n || 3,
            lh = H / n;
          for (let i = 0; i < n; i++) {
            const y0 = i * lh + 1,
              y1 = (i + 1) * lh - 1;
            if (i === f.safe) {
              zonePath(ctx, 2, y0, x1, y1);
              ctx.fillStyle = `rgba(90,255,170,${0.08 + 0.06 * pulse})`;
              ctx.fill();
              ctx.strokeStyle = `rgba(120,255,190,${0.5 + 0.3 * pulse})`;
              ctx.lineWidth = Math.max(1.5, geo.s * 0.6);
              ctx.setLineDash([geo.s * 3, geo.s * 2]);
              ctx.stroke();
              ctx.setLineDash([]);
              zoneLabel(ctx, 'SICHER', 46, (y0 + y1) / 2 + 1.5, '#8fffc0');
              continue;
            }
            zonePath(ctx, 2, y0, x1, y1);
            ctx.fillStyle = `rgba(255,70,90,${0.07 + 0.08 * pulse})`;
            ctx.fill();
            // the countdown: the scan fills the lane from the guardian toward the ship
            zonePath(ctx, x1 - (x1 - 2) * k, y0, x1, y1);
            ctx.fillStyle = 'rgba(255,70,90,0.16)';
            ctx.fill();
            ctx.strokeStyle = `rgba(255,107,120,${0.5 + 0.35 * pulse})`;
            ctx.lineWidth = Math.max(1.5, geo.s * 0.6);
            zonePath(ctx, 2, y0, x1, y1);
            ctx.stroke();
          }
          safeArrow(ctx, a, ((f.safe ?? 1) + 0.5) * lh, '#8fffc0');
        } else {
          const half = (f.gap || 30) / 2,
            gx = x1;
          // the wall's ghost: ice diamonds where the shards will be
          for (let y = 4; y <= H - 4; y += 6.5) {
            if (Math.abs(y - f.gapY) < half) continue;
            const p = P(gx, y),
              s = geo.s * 2.6;
            ctx.strokeStyle = `rgba(191,244,255,${0.35 + 0.35 * pulse})`;
            ctx.lineWidth = Math.max(1.2, geo.s * 0.5);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y - s);
            ctx.lineTo(p.x + s * 0.6, p.y);
            ctx.lineTo(p.x, p.y + s);
            ctx.lineTo(p.x - s * 0.6, p.y);
            ctx.closePath();
            ctx.stroke();
          }
          // the gap: a green corridor all the way to the ship
          zonePath(ctx, 2, f.gapY - half + 3, gx, f.gapY + half - 3);
          ctx.fillStyle = `rgba(90,255,170,${0.07 + 0.06 * pulse})`;
          ctx.fill();
          ctx.strokeStyle = `rgba(120,255,190,${0.45 + 0.3 * pulse})`;
          ctx.setLineDash([geo.s * 3, geo.s * 2]);
          ctx.lineWidth = Math.max(1.5, geo.s * 0.6);
          ctx.stroke();
          ctx.setLineDash([]);
          zoneLabel(ctx, 'LÜCKE', 46, f.gapY + 1.5, '#8fffc0');
          safeArrow(ctx, a, f.gapY, '#8fffc0');
        }
      }
    }
    // P1.4 signature zones. The arrow always points to where the self-steering ship would go now (a.sigSafe: the next
    // gap of the bell, out of the laser lane, the path's place) – the same place for a steering player.
    function drawZonesP14(ctx, a, f) {
      const pulse = reduced ? 0.6 : 0.45 + 0.4 * Math.abs(Math.sin(time * 8)),
        k = Math.min(1, f.age / f.life),
        green = (y0, y1, x1) => {
          zonePath(ctx, 2, y0, x1, y1);
          ctx.fillStyle = 'rgba(90,255,170,' + (0.07 + 0.06 * pulse) + ')';
          ctx.fill();
          ctx.strokeStyle = 'rgba(120,255,190,' + (0.45 + 0.3 * pulse) + ')';
          ctx.setLineDash([geo.s * 3, geo.s * 2]);
          ctx.lineWidth = Math.max(1.5, geo.s * 0.6);
          ctx.stroke();
          ctx.setLineDash([]);
        },
        safeY = a.sigSafe && a.t < a.sigSafe.until ? (a.sigSafe.path ? window.arenaPathY(a.sigSafe.path, a.t) : a.sigSafe.y) : null;
      if (f.bell) {
        // one column of heat marks per ring (ring 1 nearest the ship), its gap green and numbered
        const half = (f.gap || 30) / 2;
        f.gaps.forEach((gy, i) => {
          const x = 30 + i * 9;
          for (let y = 4; y <= H - 4; y += 6) {
            if (Math.abs(y - gy) < half) continue;
            const p = P(x, y);
            Art().glowCircle(ctx, p.x, p.y, geo.s * 2.2, '#ff8a3a', 0.25 + 0.3 * pulse);
          }
          green(gy - half + 3, gy + half - 3, x + 3);
          zoneLabel(ctx, String(i + 1), x, gy + 1.5, '#8fffc0');
        });
      } else if (f.belt) {
        // the laser lane fills red toward the ship (the countdown); the conveyor's chevrons run toward it from both sides
        const y0 = f.laneY - f.half,
          y1 = f.laneY + f.half,
          x1 = Math.max(30, f.x0 - 8);
        zonePath(ctx, 2, y0, x1, y1);
        ctx.fillStyle = 'rgba(255,70,90,' + (0.07 + 0.08 * pulse) + ')';
        ctx.fill();
        zonePath(ctx, x1 - (x1 - 2) * k, y0, x1, y1);
        ctx.fillStyle = 'rgba(255,70,90,0.16)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,107,120,' + (0.5 + 0.35 * pulse) + ')';
        ctx.lineWidth = Math.max(1.5, geo.s * 0.6);
        zonePath(ctx, 2, y0, x1, y1);
        ctx.stroke();
        const span = Math.max(4, (f.reach || 30) - f.half);
        ctx.strokeStyle = 'rgba(255,215,122,' + (0.45 + 0.3 * pulse) + ')';
        ctx.lineWidth = Math.max(1.5, geo.s * 0.7);
        for (const side of [-1, 1])
          for (let i = 0; i < 3; i++)
            for (const x of [8, 22, 36]) {
              const d = f.half + span - ((i * span) / 3 + (reduced ? 0 : time * 12)) % span,
                y = f.laneY + side * d;
              if (y < 2 || y > H - 2) continue;
              const tip = P(x, y - side * 1.6),
                l = P(x - 2.2, y + side * 0.8),
                r = P(x + 2.2, y + side * 0.8);
              ctx.beginPath();
              ctx.moveTo(l.x, l.y);
              ctx.lineTo(tip.x, tip.y);
              ctx.lineTo(r.x, r.y);
              ctx.stroke();
            }
        zoneLabel(ctx, 'LASER', 50, f.laneY + 1.5, '#ff9aa6');
      } else if (f.path) {
        // the calm corridor where the path is now, and a dashed line to where it goes
        const half = (f.gap || 30) / 2,
          y = window.arenaPathY ? window.arenaPathY(f.path, a.t) : f.path.y0;
        green(y - half + 3, y + half - 3, 34);
        zoneLabel(ctx, 'PFAD', 48, y + 1.5, '#8fffc0');
        const p0 = P(40, y),
          p1 = P(40, f.path.y1);
        if (Math.abs(f.path.y1 - y) > 3) {
          ctx.strokeStyle = 'rgba(143,255,192,0.7)';
          ctx.lineWidth = Math.max(1.5, geo.s * 0.6);
          ctx.setLineDash([geo.s * 2, geo.s * 2]);
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.stroke();
          ctx.setLineDash([]);
          Art().glowCircle(ctx, p1.x, p1.y, geo.s * 2.4, '#8fffc0', 0.6);
        }
      }
      if (safeY !== null) safeArrow(ctx, a, safeY, '#8fffc0');
    }
    // a hit caught by a shield, a barrier or crystal plates: a local hex ripple on the bubble, on the side the shot came
    // from; the hull underneath stays untouched (no sparks)
    function shieldRipple(ctx, cx, cy, r, toward, k, color) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - k);
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1.5, geo.s * 0.7);
      const span = 0.9,
        rr = r * (1 + k * 0.15);
      ctx.beginPath();
      ctx.arc(cx, cy, rr, toward - span, toward + span);
      ctx.stroke();
      // three hex cells light up where it hit
      for (let i = -1; i <= 1; i++) {
        const ang = toward + i * 0.42,
          hx = cx + Math.cos(ang) * rr,
          hy = cy + Math.sin(ang) * rr,
          hs = geo.s * (i ? 1.8 : 2.6) * (1 - k * 0.3);
        ctx.beginPath();
        for (let j = 0; j <= 6; j++) {
          const q = (j / 6) * TAU + Math.PI / 6;
          j ? ctx.lineTo(hx + Math.cos(q) * hs, hy + Math.sin(q) * hs) : ctx.moveTo(hx + Math.cos(q) * hs, hy + Math.sin(q) * hs);
        }
        ctx.stroke();
      }
      Art().glowCircle(ctx, cx + Math.cos(toward) * rr, cy + Math.sin(toward) * rr, geo.s * 4, color, 0.5 * (1 - k));
      ctx.restore();
    }
    // the hull's own reaction by its material (ENEMY.hit): ice shatters, metal clangs, wood splinters, plants puff, fire
    // spits embers; an energy weapon adds a soft ring, a kinetic one a short shock line
    const HIT_CHIPS = { shatter: '#dff6ff', clang: '#e8eefc', splinter: '#c49a6a', puff: '#fff0f8', ember: '#ffb35a', spark: '#ffe9a8' };
    function hullReaction(ctx, f, p, k, tint) {
      const style = window.DnaVisuals?.ENEMY?.[f.ek]?.hit || 'spark',
        chip = HIT_CHIPS[style] || '#ffffff',
        n = style === 'puff' ? 0 : 3;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - k);
      if (style === 'puff') Art().glowCircle(ctx, p.x, p.y, geo.s * (3 + k * 6), chip, 0.4);
      for (let i = 0; i < n; i++) {
        const ang = f.a * 1.7 + i * 2.1,
          d = geo.s * (2 + k * 9),
          x = p.x + Math.cos(ang) * d,
          y = p.y + Math.sin(ang) * d + k * k * geo.s * 6;
        ctx.fillStyle = chip;
        ctx.beginPath();
        if (style === 'shatter') {
          ctx.moveTo(x, y - geo.s * 1.4);
          ctx.lineTo(x + geo.s * 0.6, y);
          ctx.lineTo(x, y + geo.s * 1.4);
          ctx.lineTo(x - geo.s * 0.6, y);
        } else ctx.rect(x - geo.s * 0.6, y - geo.s * 0.6, geo.s * 1.2, geo.s * (style === 'splinter' ? 2 : 1.2));
        ctx.fill();
      }
      if (f.matter === 'energy') {
        ctx.strokeStyle = tint;
        ctx.lineWidth = Math.max(1.2, geo.s * 0.5);
        ctx.beginPath();
        ctx.arc(p.x, p.y, geo.s * (2 + k * 7), 0, TAU);
        ctx.stroke();
      } else {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(1.5, geo.s * 0.7);
        const d = geo.s * (3 + k * 4);
        ctx.beginPath();
        ctx.moveTo(p.x - d, p.y);
        ctx.lineTo(p.x + d, p.y);
        ctx.stroke();
      }
      ctx.restore();
    }
    // P.I.P.S. in phase 2 — Generalinspektion: the inspection robot unfolds its whole kit (lore: the inspection goes from
    // a spot check to a full one). Two stamp arms above, two magnifier arms below, the chest hatch open on its red core,
    // the antenna becomes a dish. It unfolds over 0.9 s from the phase change. Drawn in the body frame.
    function drawPipsInspection(ctx, f, layer = 'back') {
      const since = time - (phaseAt.get(f.id) ?? time - 1),
        u = reduced ? 1 : Math.min(1, since / 0.9),
        e = u * u * (3 - 2 * u),
        swing = reduced ? 0 : Math.sin(time * 3) * 0.08;
      if (layer === 'front') return drawPipsCore(ctx, e);
      // the arms reach out from behind the body, past its rim
      for (const [sx, sy, kind] of [[-1, -1, 'stamp'], [1, -1, 'stamp'], [-1, 1, 'lens'], [1, 1, 'lens']]) {
        const ang = Math.atan2(sy * 0.75, sx) + sy * swing,
          len = 0.66 * e,
          bx = sx * 0.3,
          by = sy * 0.12,
          jx = bx + Math.cos(ang) * len * 0.55,
          jy = by + Math.sin(ang) * len * 0.55,
          hx = bx + Math.cos(ang) * len,
          hy = by + Math.sin(ang) * len + (kind === 'stamp' && !reduced ? Math.max(0, Math.sin(time * 5 + sx)) * 0.05 : 0);
        ctx.strokeStyle = '#6f7da8';
        ctx.lineWidth = 0.07;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(jx, jy);
        ctx.lineTo(hx, hy);
        ctx.stroke();
        ctx.fillStyle = '#c9d2ea';
        ctx.beginPath();
        ctx.arc(jx, jy, 0.04, 0, TAU);
        ctx.fill();
        if (e < 0.2) continue;
        if (kind === 'stamp') {
          ctx.fillStyle = '#c9a77a';
          ctx.fillRect(hx - 0.13, hy - 0.09, 0.26, 0.17);
          ctx.fillStyle = '#e0565a';
          ctx.fillRect(hx - 0.1, hy + 0.06, 0.2, 0.06);
        } else {
          ctx.strokeStyle = '#e8e4fa';
          ctx.lineWidth = 0.04;
          ctx.beginPath();
          ctx.arc(hx, hy, 0.1, 0, TAU);
          ctx.stroke();
          ctx.fillStyle = 'rgba(160,230,255,0.55)';
          ctx.fill();
        }
      }
    }
    // in front of the body: the open chest hatch with its red core, the antenna turned into a dish
    function drawPipsCore(ctx, e) {
      ctx.fillStyle = '#3a2f5a';
      ctx.beginPath();
      ctx.ellipse(0, 0.3, 0.17 * e, 0.12 * e, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#c9d2ea';
      ctx.lineWidth = 0.025;
      ctx.stroke();
      Art().glowCircle(ctx, 0, 0.3, 0.15 * e, '#ff5a6a', 0.7 + (reduced ? 0 : Math.sin(time * 6) * 0.2));
      // the antenna becomes a dish
      ctx.strokeStyle = '#c9d2ea';
      ctx.lineWidth = 0.03;
      ctx.beginPath();
      ctx.moveTo(0, -0.42);
      ctx.lineTo(0, -0.42 - 0.16 * e);
      ctx.stroke();
      ctx.fillStyle = '#e8e4fa';
      ctx.beginPath();
      ctx.ellipse(0, -0.6 * (0.7 + 0.3 * e), 0.16 * e, 0.05 * e, reduced ? 0 : Math.sin(time * 1.5) * 0.3, 0, TAU);
      ctx.fill();
    }
    // ----- P1.4: the transformations of the three remaining guardians (body frame; unfold over 0.9 s from phase 2) -----
    const unfold = f => {
      const u = reduced ? 1 : Math.min(1, (time - (phaseAt.get(f.id) ?? time - 1)) / 0.9);
      return u * u * (3 - 2 * u);
    };
    // Emberbell's bell swing: back in the preparation, a tremble in the warning, a swing and a ring after each strike
    function emberbellSwing(f) {
      if (reduced || !f.sig) return 0;
      const since = f.t - (f.ebAt || 0);
      if (f.ebPhase === 'bellprep') return -0.42 * Math.min(1, since / 0.4);
      if (f.ebPhase === 'bellwarn') return -0.42 + Math.sin(time * 30) * 0.03;
      const gap = f.phase2 ? 1.35 : 1.25,
        local = since % gap;
      return Math.sin(local * 11) * 0.38 * Math.exp(-local * 2.4);
    }
    // Emberbell, Glutkern (lore: the overheated guardian of the forges – his bell cracks and the core shows): two chains with
    // little bells swing at his sides, a flame crown burns on top, a molten seam glows across the bell
    function drawEmberbellAwake(ctx, f, layer) {
      const e = unfold(f);
      if (layer === 'back') {
        for (const side of [-1, 1]) {
          const swing = reduced ? 0.2 * side : Math.sin(time * 3.2 + side) * 0.45,
            bx = side * 0.3,
            by = -0.12,
            len = 0.5 * e,
            ex = bx + Math.sin(swing) * len + side * 0.12 * e,
            ey = by + Math.cos(swing) * len;
          ctx.strokeStyle = '#8a5a3a';
          ctx.lineWidth = 0.03;
          ctx.setLineDash([0.04, 0.025]);
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(ex, ey);
          ctx.stroke();
          ctx.setLineDash([]);
          if (e < 0.3) continue;
          ctx.fillStyle = '#e8a83a';
          ctx.beginPath();
          ctx.moveTo(ex - 0.08, ey + 0.1);
          ctx.quadraticCurveTo(ex - 0.08, ey - 0.02, ex, ey - 0.02);
          ctx.quadraticCurveTo(ex + 0.08, ey - 0.02, ex + 0.08, ey + 0.1);
          ctx.closePath();
          ctx.fill();
          Art().glowCircle(ctx, ex, ey + 0.1, 0.07, '#ff6a2a', 0.8);
        }
        return;
      }
      // the flame crown
      for (let i = 0; i < 5; i++) {
        const x = (i - 2) * 0.085,
          h = (0.14 + (i % 2 ? 0.04 : 0.09)) * e * (reduced ? 1 : 0.85 + Math.sin(time * 12 + i * 1.7) * 0.15),
          y = -0.4;
        ctx.fillStyle = i % 2 ? '#ffd25a' : '#ff7a3a';
        ctx.beginPath();
        ctx.moveTo(x - 0.045, y);
        ctx.quadraticCurveTo(x - 0.03, y - h * 0.6, x, y - h);
        ctx.quadraticCurveTo(x + 0.03, y - h * 0.6, x + 0.045, y);
        ctx.closePath();
        ctx.fill();
      }
      // the molten seam: a glowing crack across the bell
      ctx.strokeStyle = '#ffb35a';
      ctx.lineWidth = 0.035 * e;
      ctx.beginPath();
      ctx.moveTo(-0.3, 0.06);
      ctx.lineTo(-0.15, 0.0);
      ctx.lineTo(-0.02, 0.08);
      ctx.lineTo(0.12, -0.01);
      ctx.lineTo(0.3, 0.07);
      ctx.stroke();
      Art().glowCircle(ctx, 0, 0.04, 0.3 * e, '#ff7a3a', reduced ? 0.3 : 0.25 + Math.sin(time * 5) * 0.08);
    }
    // Cogsworth, Überstundenwerk (lore: the clockwork inspector goes into overtime – everything runs faster): two hammer
    // arms that strike on his beat, two steam stacks that puff, and his chest clock opens on a spinning gear
    function drawCogsworthOvertime(ctx, f, layer) {
      const e = unfold(f),
        len = f.phase2 ? 0.72 : 0.9,
        beat = f.cwNext !== undefined ? 1 - Math.max(0, Math.min(1, (f.cwNext - f.t) / len)) : 0.5,
        strike = reduced ? 0 : beat < 0.18 ? 1 - beat / 0.18 : 0;
      if (layer === 'back') {
        for (const side of [-1, 1]) {
          // raised outward and up between beats, down on the beat
          const ang = -0.5 + strike * 0.9,
            sx = side * 0.3,
            sy = -0.02,
            ex = sx + side * Math.cos(ang) * 0.42 * e,
            ey = sy + Math.sin(ang) * 0.42 * e;
          ctx.strokeStyle = '#8a6a3a';
          ctx.lineWidth = 0.06;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(ex, ey);
          ctx.stroke();
          if (e < 0.3) continue;
          ctx.save();
          ctx.translate(ex, ey);
          ctx.rotate(side * (0.3 - strike * 0.5));
          ctx.fillStyle = '#c99a4e';
          ctx.fillRect(-0.09, -0.06, 0.18, 0.12);
          ctx.fillStyle = '#5a4a3a';
          ctx.fillRect(-0.09, 0.03, 0.18, 0.03);
          ctx.restore();
        }
        for (const side of [-1, 1]) {
          ctx.fillStyle = '#6a5a4a';
          ctx.fillRect(side * 0.18 - 0.035, -0.5 - 0.1 * e, 0.07, 0.14 * e);
          if (!reduced && e > 0.5)
            for (let i = 0; i < 2; i++) {
              const q = (time * 0.9 + i * 0.5 + (side > 0 ? 0.25 : 0)) % 1;
              Art().glowCircle(ctx, side * 0.18 + q * 0.06 * side, -0.62 - q * 0.25, 0.06 + q * 0.05, '#f4f0ff', 0.4 * (1 - q));
            }
        }
        return;
      }
      // the open clock chest with its gear
      ctx.fillStyle = '#2a2230';
      ctx.beginPath();
      ctx.arc(0, 0.12, 0.11 * e, 0, TAU);
      ctx.fill();
      ctx.save();
      ctx.translate(0, 0.12);
      ctx.rotate(reduced ? 0 : time * 4);
      ctx.fillStyle = '#f3cf7a';
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU,
          d = (i % 2 ? 0.06 : 0.085) * e;
        i ? ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d) : ctx.moveTo(d, 0);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      Art().glowCircle(ctx, 0, 0.12, 0.09 * e, '#ff5a6a', reduced ? 0.5 : 0.4 + Math.sin(time * 6) * 0.15);
    }
    // Petalguard, Dornenkrone (lore: the garden's guardian in full bloom – the petals become armour, the roots her arms):
    // a ring of armoured outer petals turns behind her, two thorn vines sway at her sides, her seed heart glows; during
    // the Blütenpfad three petals whirl around her
    function drawPetalguardCrown(ctx, f, layer) {
      const e = f.phase2 ? unfold(f) : 0;
      if (layer === 'back') {
        if (e > 0) {
          const spin = reduced ? 0 : time * 0.35;
          for (let i = 0; i < 8; i++) {
            const a = spin + (i / 8) * TAU;
            ctx.save();
            ctx.translate(Math.cos(a) * 0.32 * e, 0.08 + Math.sin(a) * 0.32 * e);
            ctx.rotate(a);
            ctx.fillStyle = '#b0306a';
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(0.12, -0.08, 0.26 * e, 0);
            ctx.quadraticCurveTo(0.12, 0.08, 0, 0);
            ctx.fill();
            ctx.strokeStyle = '#ffd77a';
            ctx.lineWidth = 0.012;
            ctx.stroke();
            ctx.restore();
          }
          for (const side of [-1, 1]) {
            const sway = reduced ? 0 : Math.sin(time * 1.6 + side) * 0.08,
              x0 = side * 0.2,
              y0 = 0.25,
              x1 = side * (0.55 + sway) * e,
              y1 = -0.1 + sway;
            ctx.strokeStyle = '#3f7a3f';
            ctx.lineWidth = 0.035;
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.quadraticCurveTo(side * 0.5 * e, 0.35, x1, y1);
            ctx.stroke();
            ctx.fillStyle = '#c9e8a0';
            for (let j = 1; j <= 3; j++) {
              const u = j / 4,
                tx = (1 - u) * (1 - u) * x0 + 2 * u * (1 - u) * side * 0.5 * e + u * u * x1,
                ty = (1 - u) * (1 - u) * y0 + 2 * u * (1 - u) * 0.35 + u * u * y1;
              ctx.beginPath();
              ctx.moveTo(tx - 0.02, ty);
              ctx.lineTo(tx, ty - 0.05);
              ctx.lineTo(tx + 0.02, ty);
              ctx.fill();
            }
          }
        }
        if (f.sig === 'path' && !reduced)
          for (let i = 0; i < 3; i++) {
            const a = time * 3 + (i / 3) * TAU;
            ctx.save();
            ctx.translate(Math.cos(a) * 0.5, 0.08 + Math.sin(a) * 0.4);
            ctx.rotate(a * 2);
            ctx.fillStyle = '#ff8fbd';
            ctx.beginPath();
            ctx.ellipse(0, 0, 0.07, 0.035, 0, 0, TAU);
            ctx.fill();
            ctx.restore();
          }
        return;
      }
      Art().glowCircle(ctx, 0, 0.1, 0.16 * e, '#ffe08a', reduced ? 0.5 : 0.4 + Math.sin(time * 3) * 0.12);
    }
    // P.I.P.S. gets ready for the raster: its antenna sends rings out; in its recovery its vents stand open and steam
    function drawPipsSignature(ctx, f) {
      if (f.sig === 'raster') {
        for (let i = 0; i < 3; i++) {
          const q = reduced ? i / 3 : ((time * 1.4 + i / 3) % 1),
            r = 0.15 + q * 0.5;
          ctx.strokeStyle = `rgba(255,107,120,${(1 - q) * 0.8})`;
          ctx.lineWidth = 0.03;
          ctx.beginPath();
          ctx.arc(0, -0.5, r, Math.PI * 1.15, Math.PI * 1.85);
          ctx.stroke();
        }
      }
      if (f.t < (f.sigOpenUntil || 0)) {
        for (const sx of [-1, 1]) {
          ctx.fillStyle = '#2a2448';
          ctx.fillRect(sx * 0.33 - 0.04, -0.05, 0.08, 0.16);
          if (!reduced) for (let i = 0; i < 2; i++) Art().glowCircle(ctx, sx * (0.4 + ((time * 0.8 + i * 0.5) % 1) * 0.25), -0.02 - ((time * 0.8 + i * 0.5) % 1) * 0.2, 0.08, '#f4f0ff', 0.35);
        }
      }
    }
    // Visual Identity round: a guardian reads as a boss at a glance — a dark under-glow, a slowly turning segmented ring
    // in its affinity colour (phase 2: more segments, faster, ember red), a crown above it and two phase pips
    function drawBossPresence(ctx, p, r, f) {
      const aff = Art()?.DNA_TINT?.[f.affinity]?.[0] || '#ff9ecb',
        p2 = Boolean(f.phase2),
        ringC = p2 ? '#ff6b5a' : aff,
        n = p2 ? 12 : 8,
        rot = reduced ? 0 : time * (p2 ? 1.4 : 0.6),
        rad = r * 1.75;
      Art().glowCircle(ctx, p.x, p.y, r * 2.5, '#14081f', 0.35);
      Art().glowCircle(ctx, p.x, p.y, r * 2.1, ringC, p2 ? 0.22 + (reduced ? 0 : Math.sin(time * 6) * 0.06) : 0.14);
      ctx.strokeStyle = ringC;
      ctx.lineWidth = Math.max(2, r * 0.08);
      ctx.lineCap = 'round';
      for (let i = 0; i < n; i++) {
        const a = rot + (i / n) * TAU;
        ctx.beginPath();
        ctx.arc(p.x, p.y, rad, a, a + (TAU / n) * 0.55);
        ctx.stroke();
      }
      // the crown and the phase pips above it (screen up, also on turned portrait fields)
      const cx = p.x,
        cy = p.y - rad - r * 0.35,
        cw = r * 0.55;
      ctx.fillStyle = '#ffd77a';
      ctx.beginPath();
      ctx.moveTo(cx - cw, cy);
      ctx.lineTo(cx - cw, cy - cw * 0.7);
      ctx.lineTo(cx - cw * 0.45, cy - cw * 0.3);
      ctx.lineTo(cx, cy - cw * 0.95);
      ctx.lineTo(cx + cw * 0.45, cy - cw * 0.3);
      ctx.lineTo(cx + cw, cy - cw * 0.7);
      ctx.lineTo(cx + cw, cy);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#8a5a1a';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      for (let i = 0; i < 2; i++) {
        const px = cx + (i ? 1 : -1) * cw * 0.45,
          py = cy + cw * 0.45,
          on = i === 0 || p2;
        ctx.fillStyle = on ? (i ? '#ff6b5a' : '#ffd77a') : 'rgba(255,255,255,0.25)';
        ctx.beginPath();
        ctx.moveTo(px, py - cw * 0.22);
        ctx.lineTo(px + cw * 0.18, py);
        ctx.lineTo(px, py + cw * 0.22);
        ctx.lineTo(px - cw * 0.18, py);
        ctx.closePath();
        ctx.fill();
      }
    }
    // P1.2 Gegner-DNA: the way a planet's enemies move (simulation units; the hit circle stays where the game has it):
    // Orion's crystal drones hover and bob, Glacies' ice glides in slow drifts, Pyra's embers flicker with heat, Mekhanos'
    // machines step in ticks, Viridia's plants sway. Guardians keep their own animation (a slow bob only).
    function familyMotion(f, boss) {
      if (reduced) return { dx: 0, dy: 0, rot: 0, sx: 1, sy: 1 };
      const kind = (ARENA_WORLD[view?.planet] || ARENA_WORLD.crystal).kind,
        u = time + f.id * 1.37;
      if (boss) return { dx: 0, dy: f.sig ? 0 : Math.sin(u * 1.2) * 0.8, rot: 0 };
      // P1.3: the Enemy DNA's own motion per kind (scenes/dna-visuals.js ENEMY)
      if (window.DnaVisuals?.ENEMY?.[f.kind]) return window.DnaVisuals.enemyMotion(f.kind, u);
      if (kind === 'snow') return { dx: Math.sin(u * 0.7) * 1.4, dy: Math.sin(u * 0.5) * 0.6, rot: Math.sin(u * 0.7) * 0.07 };
      if (kind === 'ember') return { dx: Math.sin(u * 23) * 0.25, dy: Math.sin(u * 2.4) * 0.6 + Math.sin(u * 17) * 0.2, rot: Math.sin(u * 19) * 0.03 };
      if (kind === 'gear') {
        const step = Math.floor(u * 3) % 2 ? 1 : -1;
        return { dx: 0, dy: step * 0.55, rot: step * 0.04 };
      }
      if (kind === 'petal') return { dx: Math.sin(u * 1.1) * 0.5, dy: Math.sin(u * 1.6) * 0.5, rot: Math.sin(u * 1.6) * 0.13 };
      return { dx: Math.sin(u * 0.9) * 0.4, dy: Math.sin(u * 2.1) * 1.0, rot: Math.sin(u * 1.05) * 0.05 };
    }
    // P1.2 Boss phase 2 on the body itself (not only the ring): glowing cracks run from the core, the core burns
    function drawPhaseTwoBody(ctx, f) {
      const pulse = reduced ? 0.7 : 0.55 + 0.35 * Math.abs(Math.sin(time * 4));
      Art().glowCircle(ctx, 0, 0, 0.42, '#ff5a3a', 0.28 * pulse);
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = '#ffd27a';
      ctx.lineWidth = 0.028;
      ctx.lineCap = 'round';
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU + f.id * 0.9;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 0.08, Math.sin(a) * 0.08);
        ctx.lineTo(Math.cos(a + 0.25) * 0.2, Math.sin(a + 0.25) * 0.2);
        ctx.lineTo(Math.cos(a - 0.1) * 0.3, Math.sin(a - 0.1) * 0.3);
        ctx.lineTo(Math.cos(a + 0.12) * 0.38, Math.sin(a + 0.12) * 0.38);
        ctx.stroke();
      }
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.01;
      ctx.stroke();
      ctx.restore();
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
        // Visual Identity round: a guardian's entrance is bigger — a wide gold shock ring that closes on it
        ctx.strokeStyle = boss ? `rgba(255,215,122,${1 - arrive.age / arrive.life})` : `rgba(255,179,90,${1 - arrive.age / arrive.life})`;
        ctx.lineWidth = boss ? 4 : 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * ((boss ? 4.2 : 2.6) - (arrive.age / arrive.life) * (boss ? 2.6 : 1.4)), 0, TAU);
        ctx.stroke();
      }
      if (boss) drawBossPresence(ctx, p, r, f);
      if (boss && f.kind === 'cogsworth') drawConveyor(ctx, f);
      // a support's heat guard: an orange shimmer; a barrier: a teal hex
      if (f.guardUntil > (view.arena?.t || 0)) Art().glowCircle(ctx, p.x, p.y, r * 1.9, '#ff9a3a', 0.28 + (reduced ? 0 : Math.sin(time * 9) * 0.08));
      ctx.save();
      ctx.translate(p.x + kx, p.y + ky);
      // P1.2: each planet's enemies move in their own way; a hit squashes the body for a moment; a guardian in phase 2
      // stands bigger and breathes
      const mo = familyMotion(f, boss),
        sq = f.hitFlash > 0 && !reduced ? Math.min(1, f.hitFlash / 0.12) : 0,
        grow = boss && f.phase2 ? 1.07 + (reduced ? 0 : Math.sin(time * 3.2) * 0.02) : 1,
        base = r * 2.1 * (boss ? 1 : FOE_VISUAL) * grow;
      ctx.translate(mo.dx * geo.s, mo.dy * geo.s);
      ctx.rotate(mo.rot);
      ctx.scale(base * (1 + sq * 0.16) * (mo.sx || 1), base * (1 - sq * 0.12) * (mo.sy || 1));
      if (boss && f.kind === 'emberbell' && window.PyraArt) {
        const phase = f.ebPhase || 'build';
        // P1.4: phase 2 (Glutkern) unfolds around him; for the Glockenschlag he swings back and rings
        if (f.phase2) drawEmberbellAwake(ctx, f, 'back');
        ctx.save();
        ctx.rotate(emberbellSwing(f));
        window.PyraArt.drawEmberbell(ctx, 0, 0, 0.36, time, { pressure: f.pressure || 0, phase: f.sig === 'bell' ? 'warn' : phase, hit: f.hitFlash > 0 });
        ctx.restore();
        if (f.phase2) drawEmberbellAwake(ctx, f, 'front');
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
        // P1.4: phase 2 (Überstundenwerk): hammer arms and steam stacks behind, the open clock chest in front
        if (f.phase2) drawCogsworthOvertime(ctx, f, 'back');
        window.MekhanosArt.drawCogsworth(ctx, 0, 0.05, 0.34, time, { mood: f.sig === 'belt' ? 'warn' : mood, hit: f.hitFlash > 0, reduced, shieldAlpha: mood === 'open' ? 0 : 0.28 });
        if (f.phase2) drawCogsworthOvertime(ctx, f, 'front');
        // the Taktband's eight beat lamps under him; the current beat lights up (P1.4: a running chase while the belt
        // pulls)
        for (let i = 0; i < 8; i++) {
          const on = f.sig === 'belt' && !reduced ? i === Math.floor(time * 10) % 8 : i === f.cwBeat,
            lx = -0.42 + i * 0.12;
          ctx.fillStyle = on ? (i === 3 ? '#ffd23a' : i >= 6 ? '#ff4a5a' : '#5affd0') : 'rgba(40,52,66,0.85)';
          ctx.beginPath();
          ctx.arc(lx, 0.66, 0.04, 0, TAU);
          ctx.fill();
        }
      } else if (boss && f.kind === 'petalguard' && window.ViridiaArt) {
        const mood = f.bloomOpen ? 'bloom' : fx.some(e => e.kind === 'telegraph' && e.pollen) ? 'telegraph' : 'bud';
        // P1.4: phase 2 (Dornenkrone): armoured outer petals and thorn vines behind, the seed heart in front; the
        // Blütenpfad turns her petals into a storm around her
        if (f.phase2 || f.sig === 'path') drawPetalguardCrown(ctx, f, 'back');
        window.ViridiaArt.drawPetalguard(ctx, 0, 0.1, 0.3, time, { mood: f.sig === 'path' ? 'telegraph' : mood, petals: 6, healing: a_healing(f), hit: f.hitFlash > 0, reduced });
        if (f.phase2) drawPetalguardCrown(ctx, f, 'front');
      } else if (boss && f.kind === 'frostbyte') {
        const thawed = f.plates === 0 && f.t < f.thawUntil;
        Art().drawFrostbyte(ctx, 0, 0, 0.4, time, { hit: f.hitFlash > 0, thawed, telegraph: fx.some(e => e.kind === 'telegraph') });
        // his crystal plates orbit him; cracked ones are gone, a thaw glows warm
        // P1.3: for the Frostwand the plates line up in front of him; after it they drift wide open and dim
        const open = f.t < (f.sigOpenUntil || 0);
        if (f.phase2) {
          // the ice crown of phase 2: three spikes grow on his head
          const since = time - (phaseAt.get(f.id) ?? time - 1),
            g = reduced ? 1 : Math.min(1, since / 0.8);
          for (const [dx, hgt] of [[-0.16, 0.22], [0, 0.32], [0.16, 0.22]]) {
            ctx.fillStyle = '#dff6ff';
            ctx.beginPath();
            ctx.moveTo(dx - 0.06, -0.36);
            ctx.lineTo(dx, -0.36 - hgt * g);
            ctx.lineTo(dx + 0.06, -0.36);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#7fdcff';
            ctx.lineWidth = 0.02;
            ctx.stroke();
          }
        }
        for (let i = 0; i < (f.plates || 0); i++) {
          const ang = (i / 3) * TAU + (reduced ? 0 : time * 0.8);
          ctx.save();
          // (on a turned field the ship is below: the wall forms on that side)
          if (f.sig === 'wall') geo.rot ? ctx.translate(-0.42 + i * 0.42, 0.72) : ctx.translate(-0.72, -0.42 + i * 0.42);
          else if (open) {
            ctx.globalAlpha = 0.4;
            ctx.translate(Math.cos(ang) * 0.95, Math.sin(ang) * 0.8);
          } else ctx.translate(Math.cos(ang) * 0.62, Math.sin(ang) * 0.5);
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
      } else if (boss) {
        // P1.3: in phase 2 the kit unfolds behind and around the body (Generalinspektion)
        if (f.kind === 'pips' && f.phase2) drawPipsInspection(ctx, f);
        Art().drawMotteBot(ctx, 0, 0, 0.82, time, false, { variant: 'pips', hit: f.hitFlash > 0, shield: f.shieldOn, scanning: fx.some(e => e.kind === 'telegraph'), dizzy: false });
        if (f.kind === 'pips' && f.phase2) drawPipsInspection(ctx, f, 'front');
        if (f.kind === 'pips') drawPipsSignature(ctx, f);
      }
      if (boss && f.phase2) drawPhaseTwoBody(ctx, f);
      if (!boss) {
        const phase = f.shield ? (f.t < f.brokenUntil ? 'broken' : f.t % f.shield.every >= f.shield.from ? 'shield' : f.t % f.shield.every >= f.shield.warn ? 'warn' : 'open') : null;
        window.EnemyArt?.draw(ctx, f.kind, time + f.id * 0.7, { hit: f.hitFlash > 0, armor: Boolean(f.armor), seal: phase, call: f.callAfter && !f.called ? Math.min(1, f.t / f.callAfter) : 0, telegraph: phase === 'warn', reduced });
      }
      ctx.restore();
      // phase 2: embers leave the guardian now and then (a few, capped)
      if (boss && f.phase2 && !reduced && Math.sin(time * 5 + f.id) > 0.97 && fx.filter(e => e.kind === 'debris').length < 14) pushFx({ kind: 'debris', x: f.x, y: f.y, a: time * 7, life: 0.9, shape: 'ember' });
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
        // the charge glow; with reduced motion too (it was missing there: no warning at all before a shot)
        if (charge > 0.8) Art().glowCircle(ctx, p.x, p.y, r * 0.8, '#ff6b6b', reduced ? 0.45 : (charge - 0.8) * 3);
      }
    }
    // Gameplay loop: the aim line of a shot that is about to come (arena.js arenaAimWarnings): dashed from the enemy to the
    // ship, stronger the closer the shot; with reduced motion the same line without the dash running
    function drawAim(ctx, a) {
      const list = typeof arenaAimWarnings === 'function' ? arenaAimWarnings(a) : [];
      stats.aim = list.length;
      for (const w of list) {
        const p0 = P(w.x, w.y),
          p1 = P(w.tx, w.ty),
          k = (w.charge - 0.7) / 0.3;
        ctx.save();
        ctx.globalAlpha = 0.25 + 0.55 * k;
        ctx.strokeStyle = '#ff6b6b';
        ctx.lineWidth = Math.max(1.2, geo.s * (0.5 + 0.6 * k));
        ctx.setLineDash([geo.s * 3, geo.s * 2.5]);
        ctx.lineDashOffset = reduced ? 0 : -time * geo.s * 18;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
        ctx.setLineDash([]);
        // the end point on the ship: a small ring that closes as the shot comes
        ctx.beginPath();
        ctx.arc(p1.x, p1.y, geo.s * (9 - 4 * k), 0, TAU);
        ctx.stroke();
        ctx.restore();
      }
    }
    // P1.3 Waffen-DNA 3.0: the affinity moves in its own way behind a shot (DnaVisuals.AFFINITY trail) – embers fall off a
    // thermal shot, a hydro shot is a droplet with a wave behind it, an ion shot crackles in a zigzag, a kinetic slug
    // pulls speed lines. Small and cheap (a few strokes per shot), none with reduced motion.
    function affinityTrail(ctx, s, p, c, kind, len) {
      if (reduced || !kind) return;
      const vx = s.vx || 1,
        vy = s.vy || 0,
        sp = Math.hypot(vx, vy) || 1,
        ux = vx / sp,
        uy = vy / sp,
        back = (d, side = 0) => P(s.x - ux * d - uy * side, s.y - uy * d + ux * side),
        seed = s.id * 1.37;
      ctx.save();
      if (kind === 'ember') {
        for (let i = 0; i < 2; i++) {
          const q = (time * 3 + seed + i * 0.5) % 1,
            e = back(len * (0.4 + q), (i ? 1 : -1) * q * 1.6);
          ctx.globalAlpha = 1 - q;
          ctx.fillStyle = i ? '#ffd27a' : c;
          ctx.fillRect(e.x - 1, e.y - 1 + q * geo.s * 1.5, 2.2, 2.2);
        }
      } else if (kind === 'drop') {
        ctx.fillStyle = c;
        for (let i = 1; i <= 3; i++) {
          const e = back(len * 0.35 * i, Math.sin(time * 14 + seed + i * 1.4) * 1.1);
          ctx.globalAlpha = 0.75 - i * 0.18;
          ctx.beginPath();
          ctx.arc(e.x, e.y, geo.s * (0.75 - i * 0.12), 0, TAU);
          ctx.fill();
        }
      } else if (kind === 'arc') {
        ctx.strokeStyle = '#efe6ff';
        ctx.globalAlpha = 0.85;
        ctx.lineWidth = Math.max(1, geo.s * 0.4);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        for (let i = 1; i <= 4; i++) {
          const e = back(len * 0.32 * i, ((i % 2) * 2 - 1) * (0.8 + 0.6 * Math.sin(time * 40 + seed + i)));
          ctx.lineTo(e.x, e.y);
        }
        ctx.stroke();
      } else if (kind === 'slug') {
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 1;
        for (const side of [-0.9, 0.9]) {
          const a0 = back(len * 0.3, side),
            a1 = back(len * 1.3, side);
          ctx.beginPath();
          ctx.moveTo(a0.x, a0.y);
          ctx.lineTo(a1.x, a1.y);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
    function drawShots(ctx, a, t) {
      const trailKind = window.DnaVisuals?.AFFINITY?.[view?.dna?.affinity]?.trail || null;
      const color = Art()?.DNA_TINT?.[a.loadout.affinity]?.[0] || '#8fe3ff',
        // DNA 2.0: a rare-or-better weapon leaves a longer, brighter trail; a second affinity tints the core
        traits = a.loadout.stats?.traits || [],
        trail = traits.includes('trail'),
        core = a.loadout.affinity2 ? Art()?.DNA_TINT?.[a.loadout.affinity2]?.[0] || '#ffffff' : '#ffffff',
        // P1.4: the cosmetic layer on the ship's own shots (scenes/cosmetic-art.js): the impact look's soft halo and the
        // Geschoss-Spur's ornament – on at most six shots at a time; the projectile keeps its chassis shape and colour
        eq = slot => (typeof equippedCosmetic === 'function' ? equippedCosmetic(slot) : null),
        shotLook = window.CosmeticArt?.SHOTS?.[eq('shot')] ? eq('shot') : null,
        halo = window.SpaceKittensForge?.LOOKS?.[eq('impact')]?.color || null;
      let dressed = 0;
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
          affinityTrail(ctx, s, p, c, trailKind, 6);
        } else if (s.kind === 'orb') {
          Art().glowCircle(ctx, p.x, p.y, geo.s * 4, c, 0.6);
          Art().blob(ctx, p.x, p.y, geo.s * 1.6, geo.s * 1.6, '#ffffff');
          affinityTrail(ctx, s, p, c, trailKind, 5);
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
          if (!s.cat) affinityTrail(ctx, s, p, c, trailKind, tail);
        }
        if ((shotLook || halo) && !s.cat && s.kind !== 'reflect' && dressed < 6) {
          dressed++;
          const len = Math.hypot(s.vx || 1, s.vy || 0) || 1,
            back = P(lerp(s.px, s.x, t) - (s.vx || 1) / len, lerp(s.py, s.y, t) - (s.vy || 0) / len);
          if (halo) window.CosmeticArt.shotHalo(ctx, halo, p.x, p.y, geo.s * 1.4);
          if (shotLook) window.CosmeticArt.shotTrail(ctx, shotLook, p.x, p.y, p.x - back.x, p.y - back.y, geo.s * 1.8, time, reduced, s.id);
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
        } else if (q.kind === 'scan-sweep') {
          // P1.3 Inspektionsraster: a red scan bar as tall as its lane, bright at its front edge, scanlines behind
          const t0 = P(q.x + 7, q.y - q.r),
            t1 = P(q.x + 7, q.y + q.r),
            f0 = P(q.x - 1, q.y - q.r),
            f1 = P(q.x - 1, q.y + q.r);
          ctx.fillStyle = 'rgba(255,74,90,0.28)';
          ctx.beginPath();
          ctx.moveTo(f0.x, f0.y);
          ctx.lineTo(t0.x, t0.y);
          ctx.lineTo(t1.x, t1.y);
          ctx.lineTo(f1.x, f1.y);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#ffd0d4';
          ctx.lineWidth = Math.max(2, geo.s * 1.1);
          ctx.beginPath();
          ctx.moveTo(f0.x, f0.y);
          ctx.lineTo(f1.x, f1.y);
          ctx.stroke();
          ctx.strokeStyle = 'rgba(255,107,120,0.6)';
          ctx.lineWidth = 1;
          for (let i = 1; i < 4; i++) {
            const a0 = P(q.x + i * 2, q.y - q.r),
              a1 = P(q.x + i * 2, q.y + q.r);
            ctx.beginPath();
            ctx.moveTo(a0.x, a0.y);
            ctx.lineTo(a1.x, a1.y);
            ctx.stroke();
          }
        } else if (q.kind === 'heat-ring') {
          // P1.4 Glockenschlag: a glowing ember of the ring with a short flame behind it
          const len = Math.hypot(q.vx, q.vy) || 1,
            back = P(q.x - (q.vx / len) * 5, q.y - (q.vy / len) * 5);
          ctx.strokeStyle = 'rgba(255,138,58,0.55)';
          ctx.lineWidth = rr * 1.4;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(back.x, back.y);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          Art().glowCircle(ctx, p.x, p.y, rr * 2.2, '#ff8a3a', 0.55);
          Art().blob(ctx, p.x, p.y, rr * 0.8, rr * 0.8, '#ffe2a8');
        } else if (q.kind === 'trap-laser') {
          // P1.4 Fließbandfalle: a wide release laser, three hard beams with a white core
          const tail = P(q.x + 30, q.y);
          ctx.strokeStyle = 'rgba(255,74,90,0.4)';
          ctx.lineWidth = rr * 2.6;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(tail.x, tail.y);
          ctx.stroke();
          ctx.strokeStyle = '#fff0f2';
          ctx.lineWidth = Math.max(1.5, rr * 0.6);
          ctx.stroke();
        } else if (q.kind === 'petal-storm') {
          // P1.4 Blütenpfad: a big pink petal that turns as it flies
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(reduced ? 0.6 : time * 5 + q.id);
          ctx.fillStyle = '#ff8fbd';
          ctx.beginPath();
          ctx.moveTo(-rr, 0);
          ctx.quadraticCurveTo(-rr * 0.2, -rr * 0.75, rr, 0);
          ctx.quadraticCurveTo(-rr * 0.2, rr * 0.75, -rr, 0);
          ctx.fill();
          ctx.strokeStyle = '#ffd0e4';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(-rr * 0.7, 0);
          ctx.lineTo(rr * 0.7, 0);
          ctx.stroke();
          ctx.restore();
        } else if (q.kind === 'frost-wall') {
          // P1.3 Frostwand: a standing ice shard with a cold glow
          Art().glowCircle(ctx, p.x, p.y, rr * 2, '#9fe8ff', 0.35);
          ctx.fillStyle = '#dff6ff';
          ctx.strokeStyle = '#7fdcff';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y - rr * 1.4);
          ctx.lineTo(p.x + rr * 0.7, p.y);
          ctx.lineTo(p.x, p.y + rr * 1.4);
          ctx.lineTo(p.x - rr * 0.7, p.y);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
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
      const color = Art()?.DNA_TINT?.[a.loadout.affinity]?.[0] || '#8fe3ff',
        // Visual Identity round: the weapon's DNA look (chassis shape, affinity colour, rarity quality) for the muzzle
        // flash and the impact flair — from the one visual language (scenes/dna-visuals.js)
        wlook = window.DnaVisuals && view?.dna ? window.DnaVisuals.weaponLook(view.dna) : null,
        muzzleLook = window.DnaVisuals?.drawMuzzleOrnament && typeof equippedCosmetic === 'function' ? equippedCosmetic('muzzle') : null,
        impactLook = window.DnaVisuals?.drawImpactSparkles && typeof equippedCosmetic === 'function' ? window.SpaceKittensForge?.LOOKS?.[equippedCosmetic('impact')] || null : null;
      for (const f of fx) {
        const k = f.age / f.life;
        if (f.kind === 'ray' || f.kind === 'chain' || f.kind === 'telegraph') {
          const p0 = P(f.x0, f.y0),
            p1 = P(f.x1, f.y1);
          if (f.kind === 'telegraph' && (f.raster || f.wall || f.bell || f.belt || f.path)) continue; // drawn under everything (drawZones)
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
          } else if (f.kind === 'ray' && f.miss) {
            // P1.5: a ray that touched nothing – thinner, no white core, it thins out into space (a hit burns bright)
            const g = ctx.createLinearGradient(p0.x, p0.y, p1.x, p1.y);
            g.addColorStop(0, color);
            g.addColorStop(0.55, color);
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.strokeStyle = g;
            ctx.lineCap = 'round';
            ctx.globalAlpha = (1 - k) * 0.6;
            ctx.lineWidth = geo.s * 1.4;
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
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
            // P1.3: the affinity along the beam – ion crackles, thermal embers, hydro ripples
            const along = window.DnaVisuals?.AFFINITY?.[view?.dna?.affinity]?.trail;
            if (!reduced && along && along !== 'slug') {
              ctx.strokeStyle = along === 'arc' ? '#efe6ff' : along === 'ember' ? '#ffd27a' : '#dff6ff';
              ctx.lineWidth = Math.max(1, geo.s * 0.45);
              ctx.beginPath();
              for (let i = 0; i <= 8; i++) {
                const u = i / 8,
                  off = along === 'arc' ? ((i % 2) * 2 - 1) * geo.s * 1.6 : Math.sin(u * 12 + time * 18) * geo.s * (along === 'drop' ? 1.2 : 0.6),
                  nx = -(p1.y - p0.y),
                  ny = p1.x - p0.x,
                  nl = Math.hypot(nx, ny) || 1,
                  x = p0.x + (p1.x - p0.x) * u + (nx / nl) * off,
                  y = p0.y + (p1.y - p0.y) * u + (ny / nl) * off;
                i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
              }
              ctx.stroke();
            }
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
        } else if (f.kind === 'spark' && f.guard && f.guard !== 'armor' && !f.zero) {
          // P1.3: caught by a shield, a barrier or plates – the ripple on the bubble's side toward the ship
          const p = P(f.x, f.y),
            s0 = P(a.ship.x, a.ship.y),
            toward = Math.atan2(s0.y - p.y, s0.x - p.x);
          shieldRipple(ctx, p.x, p.y, f.fr * geo.s * 1.55, toward, k, f.guard === 'plates' ? '#bff4ff' : f.guard === 'barrier' ? '#5affd0' : '#8fe3ff');
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
          if (wlook && !f.zero && f.proj !== 'spark' && f.proj !== 'reflect') window.DnaVisuals.drawImpactFlair(ctx, p.x, p.y, geo.s, wlook, k);
          // P1.3: the hull's own reaction (its material; energy ring or kinetic shock); armour clangs brightly
          if (!f.zero && !reduced) hullReaction(ctx, f, p, k, tint);
          if (f.guard === 'armor' && !reduced) Art().glowCircle(ctx, p.x, p.y, geo.s * 3.5 * (1 - k), '#ffffff', 0.7 * (1 - k));
          // P1.2: the equipped impact look (Goldfunken, Polarlicht-Funken) sparkles around the ship's own hits – before,
          // it showed only in the classic fight
          if (impactLook && !f.zero && f.proj !== 'spark' && f.proj !== 'reflect') window.DnaVisuals.drawImpactSparkles(ctx, p.x, p.y, geo.s, impactLook.color, k, f.a);
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
          const sp = P(a.ship.x + 7, a.ship.y); // the arena's muzzle (arenaFire: ship.x + 7)
          if (wlook) window.DnaVisuals.drawMuzzle(ctx, sp.x, sp.y, geo.s, wlook, k, (geo.rot ? -Math.PI / 2 : 0) + (f.ang || 0));
          // P1.2: the equipped muzzle style adds its ornament to the DNA flash
          if (muzzleLook) window.DnaVisuals.drawMuzzleOrnament(ctx, sp.x, sp.y, geo.s, muzzleLook, k);
          else Art().glowCircle(ctx, sp.x, sp.y, geo.s * (f.fire === 'single' || f.fire === 'lob' ? 6 : f.fire === 'beam' ? 5 : 3.5) * (1 - k), color, 0.8 * (1 - k));
        } else if (f.kind === 'miss') {
          // P1.5: the miss – a soft grey puff with a short ring, nothing bright (a hit stays the clear feedback)
          const p = P(f.x, f.y);
          Art().glowCircle(ctx, p.x, p.y, geo.s * 2.6 * (1 - k * 0.4), '#c9c3ee', 0.35 * (1 - k));
          ctx.strokeStyle = 'rgba(201,195,238,' + (0.6 * (1 - k)).toFixed(3) + ')';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, geo.s * (1 + k * 2.5), 0, TAU);
          ctx.stroke();
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
          const p = P(f.x, f.y),
            reach = f.big ? 22 : { s: 7, m: 10, l: 15 }[f.size] || 9;
          ctx.strokeStyle = f.teal ? '#5affd0' : f.red ? '#ff8f8f' : '#ffd77a';
          ctx.globalAlpha = 1 - k;
          ctx.lineWidth = f.big ? 4 : f.size === 'l' ? 3 : 2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, geo.s * (3 + k * reach), 0, TAU);
          ctx.stroke();
          // P1.3: a medium or heavy explosion has a hot core; the heavy one a second, slower ring
          if (!reduced && (f.size === 'l' || f.size === 'm' || f.big)) Art().glowCircle(ctx, p.x, p.y, geo.s * (2 + reach * 0.35) * (1 - k * 0.5), '#ffe9a8', 0.55 * (1 - k));
          if (!reduced && (f.size === 'l' || f.big)) {
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(p.x, p.y, geo.s * (2 + k * reach * 0.6), 0, TAU);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        } else if (f.kind === 'hullhit') {
          // P1.3: a hit on the ship's hull: sparks fly off its nose and a little smoke rises
          if (reduced) continue;
          const p = P(a.ship.x + 5, a.ship.y);
          ctx.save();
          ctx.globalAlpha = 1 - k;
          for (let i = 0; i < 4; i++) {
            const ang = f.a + i * 1.6,
              d = geo.s * (2 + k * 8);
            ctx.fillStyle = i % 2 ? '#ffd77a' : '#ffffff';
            ctx.fillRect(p.x + Math.cos(ang) * d - 1, p.y + Math.sin(ang) * d - 1, 2.4, 2.4);
          }
          Art().glowCircle(ctx, p.x, p.y - geo.s * k * 5, geo.s * (2 + k * 4), '#8a86a8', 0.4 * (1 - k));
          ctx.restore();
        } else if (f.kind === 'absorb') {
          // P1.3: the Schildpuls caught it – the ripple on the ship's bubble, toward the enemies
          const p = P(a.ship.x, a.ship.y),
            front = P(a.ship.x + 10, a.ship.y);
          shieldRipple(ctx, p.x, p.y, geo.s * 13, Math.atan2(front.y - p.y, front.x - p.x), k, '#8ff0d4');
        } else if (f.kind === 'debris') {
          const d = geo.s * (2 + k * 12),
            p = P(f.x, f.y),
            dx = p.x + Math.cos(f.a) * d,
            dy = p.y + Math.sin(f.a) * d + k * k * 10,
            sz = Math.max(2.4, geo.s * 1.3) * (1 - k * 0.4),
            spin = f.a + k * 6;
          ctx.save();
          ctx.globalAlpha = 1 - k;
          ctx.translate(dx, dy);
          ctx.rotate(spin);
          if (f.ice || f.shape === 'snow') {
            ctx.fillStyle = '#bff4ff';
            ctx.beginPath();
            ctx.moveTo(0, -sz * 1.3);
            ctx.lineTo(sz * 0.55, 0);
            ctx.lineTo(0, sz * 1.3);
            ctx.lineTo(-sz * 0.55, 0);
            ctx.closePath();
            ctx.fill();
          } else if (f.shape === 'ember') {
            Art().glowCircle(ctx, 0, 0, sz * 1.6, '#ff8a3a', 0.9);
            ctx.fillStyle = '#ffe2a0';
            ctx.fillRect(-sz * 0.4, -sz * 0.4, sz * 0.8, sz * 0.8);
          } else if (f.shape === 'gear') {
            ctx.fillStyle = '#c4ccd8';
            ctx.beginPath();
            ctx.arc(0, 0, sz, 0, TAU);
            ctx.fill();
            for (let i = 0; i < 6; i++) {
              ctx.save();
              ctx.rotate((i / 6) * TAU);
              ctx.fillRect(-sz * 0.22, -sz * 1.45, sz * 0.44, sz * 0.6);
              ctx.restore();
            }
            ctx.fillStyle = '#3a4a5e';
            ctx.beginPath();
            ctx.arc(0, 0, sz * 0.38, 0, TAU);
            ctx.fill();
          } else if (f.shape === 'petal') {
            ctx.fillStyle = '#ffb6dc';
            ctx.beginPath();
            ctx.ellipse(0, 0, sz * 1.25, sz * 0.55, 0, 0, TAU);
            ctx.fill();
          } else {
            ctx.fillStyle = '#d8ccff';
            ctx.beginPath();
            ctx.moveTo(0, -sz * 1.1);
            ctx.lineTo(sz * 0.7, 0);
            ctx.lineTo(0, sz * 0.7);
            ctx.lineTo(-sz * 0.7, 0);
            ctx.closePath();
            ctx.fill();
          }
          ctx.restore();
        } else if (f.kind === 'phase') {
          // P1.2: the phase change as a moment – a hot shock ring from the guardian, twice
          const b = view?.arena?.foes.find(q => q.id === f.id);
          if (!b || reduced) continue;
          const p = P(b.x, b.y);
          for (const lag of [0, 0.25]) {
            const kk = Math.max(0, (k - lag) / (1 - lag));
            if (kk <= 0) continue;
            ctx.strokeStyle = lag ? '#ffd27a' : '#ff5a3a';
            ctx.globalAlpha = 1 - kk;
            ctx.lineWidth = Math.max(2, geo.s * 1.6) * (1 - kk);
            ctx.beginPath();
            ctx.arc(p.x, p.y, geo.s * (8 + kk * 60), 0, TAU);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        } else if (f.kind === 'blast') {
          const p = P(f.x, f.y);
          Art().glowCircle(ctx, p.x, p.y, geo.s * f.r * (0.6 + k * 0.5), color, 0.5 * (1 - k));
        } else if (f.kind === 'dodge') {
          const p = P(f.x, f.y),
            rise = reduced ? 0 : k * 6 * geo.s;
          ctx.globalAlpha = Math.min(1, (1 - k) * 1.8);
          ctx.font = '900 ' + Math.round(Math.max(12, geo.s * 4.6)) + 'px Nunito, sans-serif';
          ctx.textAlign = 'center';
          ctx.lineWidth = 3;
          ctx.strokeStyle = 'rgba(20,18,50,0.85)';
          ctx.strokeText('ausgewichen!', p.x, p.y + geo.s * 10 + rise);
          ctx.fillStyle = '#9fe8ff';
          ctx.fillText('ausgewichen!', p.x, p.y + geo.s * 10 + rise);
          if (!reduced) {
            ctx.strokeStyle = 'rgba(159,232,255,' + (0.7 * (1 - k)).toFixed(2) + ')';
            ctx.lineWidth = Math.max(1.5, geo.s * 0.6);
            ctx.beginPath();
            ctx.arc(p.x, p.y, geo.s * (5 + k * 6), -0.6, 0.6);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
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
        // P1.3: the text always fits the width (a long signature banner shrinks instead of being cut off)
        let size = Math.round(Math.min(30, width * 0.075));
        ctx.font = '900 ' + size + 'px Nunito, sans-serif';
        const tw = ctx.measureText(b.text).width;
        if (tw > width - 24) {
          size = Math.max(12, Math.floor((size * (width - 24)) / tw));
          ctx.font = '900 ' + size + 'px Nunito, sans-serif';
        }
        b.fits = ctx.measureText(b.text).width <= width - 8;
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
      drawZones(ctx, a);
      drawAim(ctx, a);
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
      debug: () => ({ ...stats, fx: fx.length, scale: geo.s, rotated: geo.rot, zones: fx.filter(f => f.kind === 'telegraph' && (f.raster || f.wall || f.bell || f.belt || f.path)).length, banners: banners.map(b => ({ text: b.text, fits: b.fits !== false })), bank: shipMo.bank })
    };
  }
  window.NebulaScenes = window.NebulaScenes || {};
  window.NebulaScenes.createArenaScene = createArenaScene;
})();
