// Combat scene (Space Kittens): kitten-piloted ships vs. friendly-looking critters/robots. Synchronised presentation of the REAL combat model. Each 'attack' event (already resolved by the
// game) becomes a weapon-specific shot; the displayed health bar trails the authoritative HP. Animation timing
// never influences damage, rewards or kills.
(function () {
  'use strict';
  const { math, ParticlePool } = window.IdleEngine;
  const Art = window.NebulaArt;
  const TAU = Math.PI * 2;
  const Kit = window.SpaceKittens;
  const WEAPONS = {
    Laser: { color: '#8fe3ff', core: '#ffffff', speed: 0, width: 3 },
    Plasma: { color: '#8ff0d4', core: '#f4fff8', speed: 520, size: 7 },
    Arc: { color: '#ffe26b', core: '#ffffff', speed: 0, width: 2 },
    Ion: { color: '#c4b3ff', core: '#f3eeff', speed: 760, size: 3 },
    Nova: { color: '#ff9ecb', core: '#fff0f6', speed: 360, size: 9 },
    // Beta 1.1: Tikki's Funkenbolzen (from her glider) and the Splitterladung burst (a shockwave at the target)
    Spark: { color: '#ffb35a', core: '#fff1d6', speed: 620, size: 5 },
    Burst: { color: '#ffd77a', core: '#ffffff', speed: 0, width: 0 }
  };
  // which strike source is being resolved right now (set by combat-cat-ui.js around a Tikki/burst strike)
  const strikeSource = () => (typeof catStrikeSource !== 'undefined' ? catStrikeSource : null);

  function createCombatScene({ getView, events }) {
    let w = 320,
      h = 280,
      time = 0,
      shake = 0,
      view = null,
      quality = 'high',
      reduced = false;
    const particles = new ParticlePool(220);
    const shots = []; // max 10
    const numbers = []; // aggregated damage labels (max 3)
    const banners = []; // boss warning / victory / reward (max 2)
    const rings = []; // weapon-specific impact rings / shockwaves (max 10)
    const zaps = []; // Arc crackle around the target (max 4)
    const enemyShots = []; // Beta 1.3: wave enemies shoot back (max 8)
    let shipHit = 0;
    let recoil = 0;
    let backdrop = null,
      backdropKey = '';
    const stats = { attackEvents: 0, impacts: 0, kills: 0, spawns: 0 };
    const enemy = { hpShown: 1, hpTrail: 1, hit: 0, level: null, boss: false, spawn: 1, dying: 0, shield: 0, key: '', knock: 0, block: 0 };
    const pilot = { mood: 'focus', moodTime: 0 };
    function setPilotMood(mood, seconds) {
      pilot.mood = mood;
      pilot.moodTime = seconds;
    }
    const geo = {};
    let shown = false;
    let hudInset = 0;
    function layout() {
      // The HTML HUD covers ~92 px at the top (enemy plate) and ~52 px at the bottom (pilot plate).
      const top = h > 240 ? 92 : 64,
        bottom = h > 240 ? 52 : 40,
        field = Math.max(120, h - top - bottom),
        wide = w > h * 1.4;
      geo.top = top;
      geo.bottom = bottom;
      geo.player = { x: w * (wide ? 0.27 : 0.27), y: top + field * 0.64 };
      geo.enemy = { x: w * (wide ? 0.7 : 0.72), y: top + field * 0.42 };
      geo.shipScale = Math.min(w * 0.2, field * 0.36);
      geo.enemyScale = Math.min(w * 0.2, field * 0.3);
      // K80: when the measured enemy plate reaches lower than assumed (two-line names on narrow phones), the enemy
      // moves into the free band below it. The right side has no pilot plate, so that band runs almost to the
      // bottom edge. Sizes where the plate fits the assumption keep the old geometry.
      const plateBottom = hudInset + 6;
      if (plateBottom > top) {
        const band = Math.max(60, h - plateBottom - 8);
        geo.enemyScale = Math.min(w * 0.2, band * 0.3);
        geo.enemy = { x: w * (wide ? 0.7 : 0.72), y: plateBottom + band * 0.6 };
      }
    }
    const streaks = [];
    function initStreaks() {
      streaks.length = 0;
      for (let i = 0; i < 26; i++)
        streaks.push({ x: Math.random() * w, y: Math.random() * h, s: 0.4 + Math.random() * 1.6 });
    }

    function hardpointWorld(index) {
      const points = Art.weaponHardpoints(view.ship);
      const [px, py] = points[index % points.length];
      const bob = Math.sin(time * 1.6) * 4;
      return { x: geo.player.x + px * geo.shipScale * 1.6, y: geo.player.y + bob + py * geo.shipScale * 1.6 };
    }
    // Tikki's Funkengleiter rides above and behind the ship (Beta 1.1)
    function catGliderPos() {
      const bob = reduced ? 0 : Math.sin(time * 2.1 + 1) * 3,
        half = geo.shipScale * 0.55 * 0.6;
      let x = geo.player.x - geo.shipScale * 0.2,
        y = geo.player.y - geo.shipScale * 1.3;
      // K80: when the measured enemy plate reaches this low (narrow phones), fly in front of the ship's nose instead
      if (y - half < hudInset + 4) {
        x = geo.player.x + geo.shipScale * 1.15;
        y = geo.player.y + geo.shipScale * 0.5;
      }
      return { x, y: y + bob };
    }
    function catMuzzle() {
      const p = catGliderPos(),
        s = geo.shipScale * 0.55;
      return { x: p.x + 1.2 * s, y: p.y + 0.13 * s };
    }
    function drawCatGlider(ctx) {
      const cat = view.cat,
        p = catGliderPos(),
        s = geo.shipScale * 0.55,
        now = Date.now(),
        firing = cat.firing || now - cat.lastStrikeAt < 160;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(s, s);
      // Beta 1.2: a Sternenschmiede paint replaces the orange hull (purely visual)
      const forgeLook = window.SpaceKittensForge?.LOOKS?.[view.cosmeticGlider];
      Art.glowCircle(ctx, -1.0, 0.12, 0.42, forgeLook?.glow || '#ffb35a', reduced ? 0.5 : 0.45 + Math.sin(time * 14) * 0.15);
      if (forgeLook) window.SpaceKittensForge.drawGliderBody(ctx, forgeLook);
      else {
        ctx.fillStyle = '#b8561c';
        ctx.beginPath();
        ctx.ellipse(-0.05, 0.16, 0.98, 0.36, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e8823a';
        ctx.beginPath();
        ctx.ellipse(-0.05, 0.1, 0.94, 0.32, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffd77a';
        ctx.lineWidth = 0.06;
        ctx.stroke();
      }
      ctx.fillStyle = '#6f7d93';
      ctx.fillRect(0.55, 0.04, 0.62, 0.17);
      ctx.fillStyle = '#b9c6d8';
      ctx.fillRect(0.55, 0.04, 0.62, 0.06);
      if (firing) Art.glowCircle(ctx, 1.22, 0.13, 0.34, '#ffe9a8', 0.95);
      // glass dome with Tikki (same portrait rig as the ship's pilot)
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(-0.08, -0.08, 0.44, 0.48, 0, Math.PI, 0);
      ctx.closePath();
      ctx.fillStyle = 'rgba(40,52,110,0.55)';
      ctx.fill();
      ctx.clip();
      if (Kit?.ROSTER?.[6]) {
        ctx.translate(-0.07, -0.3);
        ctx.scale(0.5, 0.5);
        Kit.drawPortrait(ctx, Kit.ROSTER[6], { mood: firing ? 'focus' : 'happy', t: time, seed: 7 });
      }
      ctx.restore();
      ctx.strokeStyle = 'rgba(220,240,255,0.9)';
      ctx.lineWidth = 0.04;
      ctx.beginPath();
      ctx.ellipse(-0.08, -0.08, 0.44, 0.48, 0, Math.PI, 0);
      ctx.stroke();
      ctx.restore();
      if (cat.ready && !cat.firing && !reduced) Art.glowCircle(ctx, p.x, p.y, geo.shipScale * 0.75, '#ffd77a', 0.12 + Math.sin(time * 3) * 0.06);
    }
    function enemyPos() {
      const bob = Math.sin(time * 1.2) * 6;
      return { x: geo.enemy.x + Math.sin(time * 0.7) * 6 + enemy.knock * 7, y: geo.enemy.y + bob };
    }

    const off = [];
    off.push(
      events.on('attack', event => {
        if (!shown) return; // hidden scenes do not queue effects
        stats.attackEvents++;
        if (!view) view = getView();
        const source = strikeSource();
        if (source) {
          // Tikki's bolts start at her glider; the burst is a shockwave on the target. The ship does not recoil.
          if (shots.length >= 10) shots.shift();
          const ability = source === 'cat-ability',
            burst = source === 'burst',
            from = burst ? { x: geo.enemy.x, y: geo.enemy.y } : catMuzzle(),
            def = burst ? WEAPONS.Burst : ability ? { ...WEAPONS.Spark, size: 8 } : WEAPONS.Spark;
          shots.push({ weapon: burst ? 'Burst' : 'Spark', def, from, age: 0, delay: 0, travel: def.speed ? Math.hypot(geo.enemy.x - from.x, geo.enemy.y - from.y) / def.speed : 0, primary: true, damage: event.damage, killed: event.killed, boss: event.boss, shielded: event.shielded, source });
          if (burst && !reduced) {
            const pos = enemyPos();
            rings.push({ x: pos.x, y: pos.y, r0: geo.enemyScale * 0.3, r1: geo.enemyScale * 1.9, age: 0, life: 0.5, color: '#ffd77a', fill: false });
            rings.push({ x: pos.x, y: pos.y, r0: 0, r1: geo.enemyScale * 1.1, age: 0, life: 0.35, color: 'rgba(255,215,122,0.35)', fill: true });
            while (rings.length > 10) rings.shift();
          }
          return;
        }
        // Beta 1.4 M3: a mounted Galactic-DNA weapon shapes and colours the shot (its stats count in the arena)
        const dna = typeof mountedDna === 'function' ? mountedDna() : null,
          dnaKind = dna ? { ray: 'Laser', bolt: 'Ion', pellet: 'Ion', shell: 'Plasma', orb: 'Nova' }[DNA_CHASSIS[dna.chassis]?.projectile] : null;
        if (dnaKind) event = { ...event, weapon: dnaKind, dnaTint: Art.DNA_TINT?.[dna.affinity] };
        const baseWeapon = WEAPONS[event.weapon] || WEAPONS.Laser,
          tint = window.SpaceKittensForge?.LOOKS?.[view.cosmeticImpact];
        // Beta 1.2 Trefferfunken: only the colour of the ship's shots and impacts changes (never their size or number)
        const weapon = tint ? { ...baseWeapon, color: tint.color, core: tint.core } : event.dnaTint ? { ...baseWeapon, color: event.dnaTint[0], core: '#ffffff' } : baseWeapon;
        const hardpoints = Art.weaponHardpoints(view.ship).length;
        recoil = reduced ? 0 : event.weapon === 'Nova' ? 1 : 0.6;
        if (event.shielded && !event.aimed) setPilotMood('worried', 0.8);
        else if (event.aimed || event.overcharge) setPilotMood('focus', 0.8);
        // Higher fleet power → more visible barrels fire per (single) model attack. Damage stays one number.
        const volleys = Math.min(hardpoints, event.auto ? 1 : 1 + Math.floor(hardpoints / 2));
        for (let v = 0; v < volleys; v++) {
          if (shots.length >= 10) shots.shift();
          const from = hardpointWorld(v);
          shots.push({
            weapon: event.weapon,
            def: weapon,
            from,
            age: 0,
            delay: v * 0.06,
            travel: weapon.speed ? Math.hypot(geo.enemy.x - from.x, geo.enemy.y - from.y) / weapon.speed : 0.12,
            primary: v === 0,
            damage: event.damage,
            aimed: event.aimed,
            overcharge: event.overcharge,
            killed: event.killed,
            boss: event.boss,
            hpAfter: event.hpAfter,
            shielded: event.shielded && !event.aimed,
            wilted: event.wilted || 0
          });
        }
      })
    );
    off.push(
      events.on('enemy-defeated', event => {
        if (!shown) return; // hidden scenes do not queue effects
        stats.kills++;
        enemy.dying = 1;
        const pos = enemyPos();
        setPilotMood('happy', 1.4);
        const count = reduced ? 8 : quality === 'low' ? 14 : event.boss ? 46 : 26;
        for (let i = 0; i < count; i++) {
          const a = Math.random() * TAU,
            s = 50 + Math.random() * (event.boss ? 220 : 140);
          particles.spawn({
            x: pos.x,
            y: pos.y,
            vx: Math.cos(a) * s,
            vy: Math.sin(a) * s,
            drag: 2.4,
            life: 0.7 + Math.random() * 0.8,
            size: 2 + Math.random() * 3,
            color: ['#ffd77a', '#ff9ecb', '#8ff0d4', '#c4b3ff'][i % 4],
            kind: i % 2 ? 'star' : 'dot'
          });
        }
        for (let i = 0; i < (reduced ? 3 : 8); i++) {
          const a = (i / 8) * TAU;
          particles.spawn({
            x: pos.x,
            y: pos.y,
            vx: Math.cos(a) * 55,
            vy: Math.sin(a) * 55,
            drag: 2,
            life: 0.9,
            size: 10 + Math.random() * 8,
            color: 'rgba(255,255,255,0.75)',
            kind: 'puff'
          });
        }
        if (!reduced) shake = event.boss ? 0.5 : 0.22;
        // Boss victory celebration: pastel star confetti rains over the battlefield.
        if (event.boss && !reduced)
          for (let i = 0; i < (quality === 'low' ? 14 : 36); i++)
            particles.spawn({
              x: Math.random() * w,
              y: -10 - Math.random() * 40,
              vx: (Math.random() - 0.5) * 30,
              vy: 70 + Math.random() * 80,
              life: 2.2,
              size: 2.5 + Math.random() * 2,
              color: ['#ffd77a', '#ff9ecb', '#8ff0d4', '#c4b3ff'][i % 4],
              kind: 'star'
            });
        if (event.boss || event.level === 'wave') return;
        if (banners.length >= 2) banners.shift();
        const rarityColor = { rare: '#7fd8ff', epic: '#c79bff', legendary: '#ffd76a' }[event.rarity];
        banners.push({
          text: '+' + window.NebulaFormat(event.credits) + ' ◈',
          sub: event.dropName ? (event.isNew ? 'NEU: ' : '') + event.dropName : '',
          color: rarityColor || '#ffe6a0',
          age: 0,
          life: 1.6,
          kind: 'reward'
        });
      })
    );
    // Beta 1.3 Feldzug: an enemy shot flies to the ship; the hull damage was already applied by the game (logic first)
    off.push(
      events.on('enemy-shot', event => {
        if (!shown) return;
        if (enemyShots.length >= 8) enemyShots.shift();
        const from = enemyPos();
        enemyShots.push({ shot: event.shot, damage: event.damage, from: { x: from.x - geo.enemyScale * 0.4, y: from.y }, age: 0, travel: event.shot === 'laser' ? 0.12 : event.shot === 'seal' ? 0.5 : 0.36, hit: false });
      })
    );
    // Beta 1.3 Feldzug: wave announcement, cleared/failed banner, reinforcement warning
    off.push(
      events.on('wave-start', event => {
        if (!shown) return;
        if (banners.length >= 2) banners.shift();
        banners.push({ text: '⚑ WELLE ' + (event.wave + 1) + '/' + event.total, sub: event.name || '', color: '#9ff0ff', age: 0, life: 1.8, kind: 'warning' });
      }),
      events.on('wave-complete', event => {
        if (!shown) return;
        if (banners.length >= 2) banners.shift();
        banners.push({ text: event.won ? '★ WELLE GESCHAFFT ★' : 'RÜCKZUG', sub: event.name || '', color: event.won ? '#ffd76a' : '#ff9a8a', age: 0, life: 2, kind: 'warning' });
        if (event.won && !reduced)
          for (let i = 0; i < (quality === 'low' ? 10 : 24); i++)
            particles.spawn({ x: Math.random() * w, y: -10 - Math.random() * 40, vx: (Math.random() - 0.5) * 30, vy: 70 + Math.random() * 80, life: 2, size: 2.5 + Math.random() * 2, color: ['#ffd77a', '#ff9ecb', '#8ff0d4', '#c4b3ff'][i % 4], kind: 'star' });
      }),
      events.on('wave-call', () => {
        if (!shown) return;
        if (banners.length >= 2) banners.shift();
        banners.push({ text: '📡 VERSTÄRKUNG!', sub: '+1 Stempeldrohne', color: '#ff9a8a', age: 0, life: 1.6, kind: 'warning' });
      })
    );
    // Beta 1.2 Sektorprüfung started: a short announcement with the goal
    off.push(
      events.on('challenge-start', event => {
        if (!shown) return;
        if (banners.length >= 2) banners.shift();
        banners.push({ text: '⚑ SEKTORPRÜFUNG', sub: event.name || '', color: '#9ff0ff', age: 0, life: 1.8, kind: 'warning' });
      })
    );
    // Beta 1.2 Sektorprüfung finished: medal banner (+ star confetti for a medal, not in reduced motion)
    off.push(
      events.on('challenge-complete', event => {
        if (!shown) return;
        const medal = { bronze: ['BRONZE', '#f2b386'], silver: ['SILBER', '#e7eefc'], gold: ['GOLD', '#ffd76a'] }[event.tier];
        if (!medal) return;
        if (banners.length >= 2) banners.shift();
        banners.push({ text: '★ ' + medal[0] + ' ★', sub: 'Sektorprüfung bestanden', color: medal[1], age: 0, life: 2.2, kind: 'warning' });
        if (!reduced)
          for (let i = 0; i < (quality === 'low' ? 12 : 30); i++)
            particles.spawn({ x: Math.random() * w, y: -10 - Math.random() * 40, vx: (Math.random() - 0.5) * 30, vy: 70 + Math.random() * 80, life: 2, size: 2.5 + Math.random() * 2, color: i % 2 ? medal[1] : '#ffffff', kind: 'star' });
      })
    );
    off.push(
      events.on('enemy-spawn', event => {
        if (!shown) return; // hidden scenes do not queue effects
        stats.spawns++;
        enemy.spawn = 0;
        enemy.dying = 0;
        enemy.hpShown = 1;
        enemy.hpTrail = 1;
        if (event.boss) {
          setPilotMood('surprised', 1.2);
          if (banners.length >= 2) banners.shift();
          banners.push({
            text: '⚠ SEKTOR-BOSS',
            sub: event.name || '',
            color: '#ff6b4a',
            age: 0,
            life: 1.8,
            kind: 'warning'
          });
        }
      })
    );
    off.push(
      events.on('petal-wilted', event => {
        if (!shown || reduced) return;
        const pos = enemyPos(),
          r = geo.enemyScale;
        for (let i = 0; i < 4 * (event.wilted || 1); i++)
          particles.spawn({ x: pos.x + (Math.random() - 0.5) * r, y: pos.y - r * 0.4, vx: (Math.random() - 0.5) * 90, vy: -30, ay: 140, drag: 0.8, life: 1.1, size: 3, color: i % 2 ? '#8a8478' : '#ff9ecb' });
      }),
      events.on('boss-phase', () => {
        if (!shown) return; // hidden scenes do not queue effects
        enemy.shield = 1;
        const pos = enemyPos();
        for (let i = 0; i < (reduced ? 6 : 24); i++) {
          const a = Math.random() * TAU;
          particles.spawn({
            x: pos.x + Math.cos(a) * geo.enemyScale * 0.9,
            y: pos.y + Math.sin(a) * geo.enemyScale * 0.9,
            vx: Math.cos(a) * 120,
            vy: Math.sin(a) * 120,
            drag: 2,
            life: 0.7,
            size: 2,
            color: '#9fd8ff'
          });
        }
      })
    );

    function ring(x, y, r0, r1, life, color, width, fill = false) {
      if (rings.length >= 10) rings.shift();
      rings.push({ x, y, r0, r1, life, color, width, fill, age: 0 });
    }
    function impact(shot) {
      stats.impacts++;
      const pos = enemyPos();
      const strong = shot.aimed || shot.overcharge || shot.weapon === 'Nova';
      const hx = pos.x - geo.enemyScale * 0.35 + (Math.random() - 0.5) * 10,
        hy = pos.y + (Math.random() - 0.5) * geo.enemyScale * 0.6;
      if (shot.shielded) {
        // Blocked by a real shield (P.I.P.S. inspection shield / Frostbyte ice plates): the shot glances off.
        enemy.block = 0.35;
        ring(pos.x, pos.y, geo.enemyScale * 1.05, geo.enemyScale * 1.25, 0.35, '#bfe8ff', 3);
        for (let i = 0; i < (reduced ? 2 : 6); i++) {
          const a = Math.PI * 0.75 + Math.random() * Math.PI * 0.5;
          particles.spawn({ x: hx - geo.enemyScale * 0.5, y: hy, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160, drag: 3, life: 0.3, size: 1.5, color: '#e8f6ff' });
        }
      } else {
        enemy.hit = 0.12;
        enemy.knock = Math.min(1, enemy.knock + (strong ? 0.8 : 0.4));
      }
      if (!reduced && !shot.shielded) {
        const c = shot.def.color;
        if (shot.weapon === 'Laser') ring(hx, hy, 2, 16, 0.22, c, 2);
        else if (shot.weapon === 'Plasma') {
          ring(hx, hy, 4, 26, 0.32, c, 0, true);
          for (let i = 0; i < 4; i++) particles.spawn({ x: hx, y: hy, vx: -40 + Math.random() * 60, vy: -60 + Math.random() * 30, ay: 260, drag: 0.6, life: 0.6, size: 2.5, color: c });
        } else if (shot.weapon === 'Arc') {
          if (zaps.length >= 4) zaps.shift();
          zaps.push({ x: pos.x, y: pos.y, age: 0, life: 0.28, seed: Math.random() * 1000 });
        } else if (shot.weapon === 'Ion') {
          ring(hx, hy, 3, 22, 0.3, c, 2);
          ring(hx, hy, 3, 34, 0.42, c, 1.5);
        } else if (shot.weapon === 'Nova') {
          ring(hx, hy, 6, geo.enemyScale * 1.3, 0.45, c, 4);
          ring(hx, hy, 0, geo.enemyScale * 0.9, 0.2, '#ffffff', 0, true);
          shake = Math.max(shake, 0.18);
        }
      }
      const count = reduced ? 3 : quality === 'low' ? 5 : strong ? 16 : 8;
      for (let i = 0; i < count; i++) {
        const a = Math.PI + (Math.random() - 0.5) * 2.2,
          s = 60 + Math.random() * 160;
        particles.spawn({
          x: hx,
          y: hy,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          drag: 3,
          life: 0.25 + Math.random() * 0.35,
          size: 1 + Math.random() * 2,
          color: shot.def.color
        });
      }
      if (strong && !reduced) shake = Math.max(shake, 0.14);
      if (!shot.primary) return;
      // Aggregate damage labels so automated fire does not flood the screen.
      const last = numbers[numbers.length - 1];
      if (last && last.age < 0.6 && shot.wilted && last.wilted) {
        last.wilted += shot.wilted;
        last.age = 0.1;
      } else if (last && last.age < 0.6 && !strong && !last.strong && !shot.wilted && !last.wilted && !last.hurt) {
        last.value += shot.damage;
        last.age = 0.1;
      } else {
        if (numbers.length >= 3) numbers.shift();
        numbers.push({
          value: shot.damage,
          strong: strong && !shot.shielded,
          blocked: shot.shielded && !shot.wilted,
          wilted: shot.wilted,
          label: shot.source === 'burst' ? 'SPLITTER ' : shot.source ? 'TIKKI ' : shot.shielded ? 'BLOCK ' : shot.aimed ? 'PRÄZISION ' : shot.overcharge ? 'OVERCHARGE ' : '',
          x: hx,
          y: hy - 14,
          age: 0,
          life: 0.9
        });
      }
    }

    function update(ctx) {
      const dt = ctx.dt;
      time += dt;
      quality = ctx.quality;
      reduced = ctx.reducedMotion;
      view = getView();
      if (!view) return;
      if ((view.hudInset || 0) !== hudInset) {
        hudInset = view.hudInset || 0;
        layout();
      }
      const key = view.enemyLevel + ':' + view.boss + ':' + (view.story?.mode || '');
      if (enemy.key !== key) {
        enemy.key = key;
        enemy.boss = view.boss;
      }
      // Displayed HP follows the authoritative ratio smoothly; the trail shows recent damage.
      const ratio = math.clamp(view.enemyHp / view.enemyMax, 0, 1);
      enemy.hpShown = math.damp(enemy.hpShown, ratio, 14, dt);
      enemy.hpTrail = enemy.hpTrail > enemy.hpShown ? math.damp(enemy.hpTrail, enemy.hpShown, 3, dt) : enemy.hpShown;
      enemy.hit = Math.max(0, enemy.hit - dt);
      enemy.spawn = Math.min(1, enemy.spawn + dt * 2.2);
      enemy.dying = Math.max(0, enemy.dying - dt * 3);
      enemy.shield = Math.max(0, enemy.shield - dt * 1.5);
      enemy.knock = Math.max(0, enemy.knock - dt * 5);
      enemy.block = Math.max(0, enemy.block - dt);
      recoil = Math.max(0, recoil - dt * 6);
      for (const r of rings) r.age += dt;
      for (let i = rings.length - 1; i >= 0; i--) if (rings[i].age >= rings[i].life) rings.splice(i, 1);
      shipHit = Math.max(0, shipHit - dt * 3);
      for (const es of enemyShots) {
        es.age += dt;
        if (!es.hit && es.age >= es.travel) {
          es.hit = true;
          shipHit = 1;
          setPilotMood('worried', 0.7);
          if (!reduced) shake = Math.max(shake, es.shot === 'seal' ? 0.28 : 0.12);
          if (numbers.length >= 3) numbers.shift();
          numbers.push({ value: es.damage, label: '', hurt: true, x: geo.player.x, y: geo.player.y - geo.shipScale * 0.7, age: 0, life: 0.9 });
          if (!reduced && quality !== 'low')
            for (let i = 0; i < 8; i++) {
              const a = Math.random() * TAU;
              particles.spawn({ x: geo.player.x + geo.shipScale * 0.5, y: geo.player.y, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, drag: 2.5, life: 0.4, size: 2, color: i % 2 ? '#ff8f8f' : '#ffd77a', kind: 'spark' });
            }
        }
      }
      for (let i = enemyShots.length - 1; i >= 0; i--) if (enemyShots[i].age > enemyShots[i].travel + 0.15) enemyShots.splice(i, 1);
      for (const z of zaps) z.age += dt;
      for (let i = zaps.length - 1; i >= 0; i--) if (zaps[i].age >= zaps[i].life) zaps.splice(i, 1);
      pilot.moodTime = Math.max(0, pilot.moodTime - dt);
      if (pilot.moodTime === 0)
        pilot.mood = view.story?.frozenCannon ? 'worried' : view.aimReady || view.overcharge || view.boss || view.story ? 'focus' : 'neutral';
      shake = Math.max(0, shake - dt);
      for (const shot of shots) {
        shot.age += dt;
        if (!shot.hit && shot.age >= shot.delay + shot.travel) {
          shot.hit = true;
          impact(shot);
        }
      }
      for (let i = shots.length - 1; i >= 0; i--)
        if (shots[i].age > shots[i].delay + shots[i].travel + 0.2) shots.splice(i, 1);
      particles.update(dt);
      for (const n of numbers) n.age += dt;
      for (let i = numbers.length - 1; i >= 0; i--) if (numbers[i].age >= numbers[i].life) numbers.splice(i, 1);
      for (const b of banners) b.age += dt;
      for (let i = banners.length - 1; i >= 0; i--) if (banners[i].age >= banners[i].life) banners.splice(i, 1);
      if (!reduced)
        for (const s of streaks) {
          s.x -= s.s * 90 * dt;
          if (s.x < -20) {
            s.x = w + Math.random() * 40;
            s.y = Math.random() * h;
          }
        }
    }

    function drawShot(ctx, shot, target) {
      const t = math.clamp((shot.age - shot.delay) / Math.max(0.001, shot.travel), 0, 1);
      if (shot.age < shot.delay) return;
      const def = shot.def,
        from = shot.from;
      ctx.globalCompositeOperation = 'lighter';
      // Muzzle flash
      if (shot.age - shot.delay < 0.08) Art.glowCircle(ctx, from.x, from.y, 12, def.color);
      if (!def.speed) {
        // Beam weapons: instant line that fades after impact.
        const fade = shot.hit ? Math.max(0, 1 - (shot.age - shot.delay - shot.travel) / 0.2) : 1;
        ctx.globalAlpha = fade;
        if (shot.weapon === 'Arc') {
          ctx.strokeStyle = def.color;
          ctx.lineWidth = def.width + (shot.overcharge ? 2 : 0);
          ctx.beginPath();
          ctx.moveTo(from.x, from.y);
          const segments = 7;
          for (let i = 1; i < segments; i++) {
            const k = i / segments;
            ctx.lineTo(
              math.lerp(from.x, target.x, k) + (Math.random() - 0.5) * 6,
              math.lerp(from.y, target.y, k) + (Math.random() - 0.5) * 16
            );
          }
          ctx.lineTo(target.x, target.y);
          ctx.stroke();
        } else {
          const width = def.width * (shot.overcharge ? 2.2 : 1) * (shot.aimed ? 1.6 : 1);
          ctx.strokeStyle = def.color;
          ctx.lineWidth = width * 2.4;
          ctx.globalAlpha = fade * 0.35;
          ctx.beginPath();
          ctx.moveTo(from.x, from.y);
          ctx.lineTo(target.x, target.y);
          ctx.stroke();
          ctx.globalAlpha = fade;
          ctx.strokeStyle = def.core;
          ctx.lineWidth = width;
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      } else {
        const x = math.lerp(from.x, target.x, t),
          y = math.lerp(from.y, target.y, t) - Math.sin(t * Math.PI) * (shot.weapon === 'Nova' ? 24 : 0);
        if (!shot.hit) {
          // Trail
          const tail = shot.weapon === 'Nova' ? 0.18 : 0.08;
          const tx = math.lerp(from.x, target.x, Math.max(0, t - tail)),
            ty = math.lerp(from.y, target.y, Math.max(0, t - tail));
          const g = ctx.createLinearGradient(tx, ty, x, y);
          g.addColorStop(0, 'rgba(0,0,0,0)');
          g.addColorStop(1, def.color);
          ctx.strokeStyle = g;
          ctx.lineWidth = def.size * 0.8;
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(x, y);
          ctx.stroke();
          Art.glowCircle(ctx, x, y, def.size * (shot.overcharge ? 2.4 : 1.7), def.color);
          if (shot.weapon === 'Ion') {
            ctx.strokeStyle = def.core;
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.ellipse(x, y, def.size * 1.3, def.size * 2.1, 0, 0, TAU);
            ctx.stroke();
          } else {
            ctx.fillStyle = def.core;
            ctx.beginPath();
            ctx.arc(x, y, def.size * 0.45, 0, TAU);
            ctx.fill();
          }
          if (shot.weapon === 'Nova') {
            ctx.strokeStyle = def.core;
            ctx.lineWidth = 1.5;
            for (let k = 0; k < 4; k++) {
              const a = time * 9 + (k * TAU) / 4;
              ctx.beginPath();
              ctx.moveTo(x + Math.cos(a) * def.size * 0.6, y + Math.sin(a) * def.size * 0.6);
              ctx.lineTo(x + Math.cos(a) * def.size * 1.5, y + Math.sin(a) * def.size * 1.5);
              ctx.stroke();
            }
          }
        }
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    function draw(ctx, width, height) {
      if (!view) return;
      ctx.save();
      if (shake > 0) ctx.translate((Math.random() - 0.5) * 10 * shake, (Math.random() - 0.5) * 10 * shake);
      const tier = view.enemyType;
      const palettes = [
        ['#12163a', '#3a2a66', '#5a3a7a'],
        ['#0e1a38', '#1e4a5a', '#2a6a6a'],
        ['#141436', '#3a3060', '#5a4a6a'],
        ['#14123a', '#3a2a7a', '#5a3a9a'],
        ['#12163a', '#3a3a5a', '#6a5a4a'],
        ['#12163a', '#2a3a6a', '#4a4a7a']
      ];
      const bg = Art.spaceBackground(
        'c-' + tier + (view.boss ? 'b' : ''),
        Math.ceil(width),
        Math.ceil(height),
        view.story?.mode?.startsWith('frost') ? ['#0e1a38', '#1e4a6a', '#3a7a9a'] : ['emberbell', 'heatdrone'].includes(view.story?.mode) ? ['#2a1020', '#5a2030', '#8a3a3a'] : ['cogsworth', 'inspector'].includes(view.story?.mode) ? ['#101a30', '#22344e', '#3a5a66'] : ['petalguard', 'thornvine'].includes(view.story?.mode) ? ['#0c1c2a', '#173c48', '#2a5a52'] : view.story?.mode === 'wave' ? ['#12163a', '#2a2a5e', '#5a3a6a'] : view.boss ? ['#1a1238', '#4a2050', '#7a3a5a'] : palettes[tier],
        100 + tier
      );
      ctx.drawImage(bg, 0, 0);
      // Home planet of the fight, large and dim in the back (cached; redrawn only when planet/size change).
      const planetId = view.story?.mode?.startsWith('frost') ? 'ice' : ['emberbell', 'heatdrone'].includes(view.story?.mode) ? 'volcanic' : ['cogsworth', 'inspector'].includes(view.story?.mode) ? 'machine' : ['petalguard', 'thornvine'].includes(view.story?.mode) ? 'verdant' : view.story ? 'crystal' : view.planetId || 'crystal',
        key = planetId + ':' + Math.ceil(width) + 'x' + Math.ceil(height);
      if (backdropKey !== key) {
        backdropKey = key;
        backdrop = document.createElement('canvas');
        backdrop.width = Math.ceil(width);
        backdrop.height = Math.ceil(height);
        const b = backdrop.getContext('2d');
        if (b && Art.drawPlanet) {
          const r = Math.max(width, height) * 0.42;
          b.globalAlpha = 0.55;
          Art.drawPlanet(b, planetId, width * 0.08, height + r * 0.45, r, 0.4);
          b.globalAlpha = 0.35;
          Art.drawPlanet(b, ['crystal', 'ice', 'volcanic', 'machine', 'verdant', 'forge'][(tier + 2) % 6], width * 0.86, height * 0.2, Math.min(width, height) * 0.05, 1.2);
          b.globalAlpha = 1;
        } else backdrop = null;
      }
      if (backdrop) ctx.drawImage(backdrop, 0, 0);
      // Forward-motion streaks (parallax)
      ctx.strokeStyle = 'rgba(200,220,255,0.35)';
      ctx.lineWidth = 1;
      for (const s of streaks) {
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x + s.s * (reduced ? 2 : 14), s.y);
        ctx.stroke();
      }
      const pos = enemyPos();
      // Enemy (warp-in on spawn, collapse on death)
      const appear = math.easeOutBack(enemy.spawn);
      const scale = geo.enemyScale * (enemy.boss ? 1.45 : 1) * Math.max(0.01, appear) * (1 + enemy.dying * 0.3);
      if (enemy.spawn < 1)
        Art.glowCircle(ctx, pos.x, pos.y, geo.enemyScale * 1.6 * (1 - enemy.spawn), '#ffffff', 1 - enemy.spawn);
      ctx.save();
      ctx.globalAlpha = 1 - enemy.dying;
      ctx.translate(pos.x, pos.y);
      ctx.scale(scale, scale);
      const hit = enemy.hit > 0.06,
        mood = enemy.dying > 0 ? 'dizzy' : hit ? 'hit' : view.boss ? 'angry' : 'idle';
      const story = view.story;
      if (story?.mode === 'pips')
        // Story guardian P.I.P.S.: the shield and the telegraphed charge come from the real game state.
        Art.drawMotteBot(ctx, 0, 0, 0.82, time, false, { variant: 'pips', hit, dizzy: enemy.dying > 0, shield: story.shielded, scanning: story.telegraph });
      else if (story?.mode === 'drone') Art.drawMotteBot(ctx, 0, 0, 0.62, time, false, { hit, dizzy: enemy.dying > 0, scanning: true });
      else if (story?.mode === 'frostbyte') Art.drawFrostbyte(ctx, 0, 0, 0.78, time, { plates: story.plates, thawed: story.thawed, telegraph: story.telegraph, hit, dizzy: enemy.dying > 0 });
      else if (story?.mode === 'emberbell' && window.PyraArt) window.PyraArt.drawEmberbell(ctx, 0, 0, 0.7, time, { pressure: story.pressure, phase: story.phase, hit });
      else if (story?.mode === 'cogsworth' && window.MekhanosArt) {
        // Cogsworth-9 — his mood is the real Taktband phase (exhausted while the defeat plays)
        const mood = enemy.dying > 0 ? 'exhausted' : story.phase === 'open' ? 'open' : story.phase === 'violation' ? 'violation' : story.phase === 'window' ? 'warn' : 'inspect';
        window.MekhanosArt.drawCogsworth(ctx, 0, 0.1, 0.62, time, { mood, hit, reduced, shieldAlpha: story.phase === 'open' ? 0 : 0.28 });
      } else if (story?.mode === 'petalguard' && window.ViridiaArt) {
        // Petalguard — her mood and petals are the real Blütenzyklus state
        const mood = enemy.dying > 0 ? 'tired' : story.phase === 'bloom' ? 'bloom' : story.telegraph ? 'telegraph' : 'bud';
        window.ViridiaArt.drawPetalguard(ctx, 0, 0.12, 0.55, time, { mood, petals: story.petals, healing: story.healing, hit, reduced });
      } else if (story?.mode === 'thornvine' && window.ViridiaArt) {
        window.ViridiaArt.drawThornVine(ctx, 0, 0, 0.75, time, { hit, reduced });
      } else if (story?.mode === 'inspector' && window.MekhanosArt) {
        window.MekhanosArt.drawInspectorDrone(ctx, 0, 0, 0.62, time, { hit });
      } else if (story?.mode === 'heatdrone') {
        Art.drawMotteBot(ctx, 0, 0, 0.6, time, false, { hit, dizzy: enemy.dying > 0, scanning: true });
        Art.glowCircle(ctx, 0, 0, 0.9, '#ff9a3a', 0.35);
      } else if (story?.mode === 'frostdrone') {
        Art.drawMotteBot(ctx, 0, 0, 0.6, time, false, { hit, dizzy: enemy.dying > 0, scanning: true });
        Art.glowCircle(ctx, 0, 0, 0.9, '#bff4ff', 0.3);
      }
      else if (story?.mode === 'challenge') {
        // Beta 1.2 Sektorprüfung: the Sternwarte's training drone, tinted per challenge (glow follows the real phase)
        const tint = story.kind === 'reactor' ? (story.phase === 'overload' ? '#ff7a3a' : '#7affc8') : story.kind === 'precision' ? '#ffd76a' : '#9fd8ff';
        Art.glowCircle(ctx, 0, 0, 1.05, tint, story.telegraph ? 0.42 : 0.2);
        Art.drawMotteBot(ctx, 0, 0, 0.72, time, false, { hit, dizzy: enemy.dying > 0, scanning: story.telegraph });
      }
      else if (story?.mode === 'wave' && window.EnemyArt)
        // Beta 1.3 Feldzug: the wave enemy; armour, seal shield and reinforcement call come from the real fight state
        window.EnemyArt.draw(ctx, story.kind, time, { hit, mood: enemy.dying > 0 ? 'dizzy' : mood, armor: story.armor, seal: story.seal, call: story.call, telegraph: story.telegraph, reduced });
      else if (view.boss) Art.drawBoss(ctx, view.bossIndex, time, hit, view.phaseTwo, mood);
      else Art.drawEnemy(ctx, tier, time, hit, mood);
      ctx.restore();
      // Beta 1.3: a wave enemy glows red just before it fires (the real shot rhythm)
      if (view.story?.mode === 'wave' && view.story.charge > 0.75) Art.glowCircle(ctx, pos.x - geo.enemyScale * 0.4, pos.y, geo.enemyScale * 0.5, '#ff6b6b', (view.story.charge - 0.75) * 2.4);
      // Sektorprüfung markers from the real phase: the open weak point (precision), the overload pulse (reactor)
      if (view.story?.mode === 'challenge') {
        const st = view.story,
          r = geo.enemyScale;
        if (st.kind === 'precision' && st.phase === 'window') {
          const spin = reduced ? 0 : time * 2.2;
          ctx.save();
          ctx.translate(pos.x, pos.y);
          ctx.strokeStyle = '#ffd76a';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.62, 0, TAU);
          ctx.stroke();
          for (let i = 0; i < 4; i++) {
            const a = spin + (i * TAU) / 4;
            ctx.beginPath();
            ctx.moveTo(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45);
            ctx.lineTo(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85);
            ctx.stroke();
          }
          ctx.restore();
        }
        if (st.kind === 'reactor' && st.phase === 'overload') {
          const pulse = reduced ? 0.5 : 0.5 + Math.sin(time * 9) * 0.5;
          ctx.strokeStyle = `rgba(255,122,58,${0.35 + pulse * 0.45})`;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, r * (1.15 + pulse * 0.12), 0, TAU);
          ctx.stroke();
        }
      }
      // Boss armour shell in phase 1 (real mechanic: core exposed below 50 %); shatter flash on phase change.
      if (view.boss && !view.phaseTwo) {
        ctx.strokeStyle = `rgba(150,210,255,${0.35 + Math.sin(time * 4) * 0.12 + enemy.hit * 2})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, geo.enemyScale * 1.25, 0, TAU);
        ctx.stroke();
      }
      // P.I.P.S. telegraph: charging ring + warning so the player can time the aimed shot.
      // Frostbyte: frozen cannon tint and snow during the Frostatem
      if (view.story?.mode === 'frostbyte' && view.story.frozenCannon) {
        ctx.fillStyle = 'rgba(190,240,255,0.18)';
        ctx.fillRect(0, 0, width, height);
        if (!reduced) for (let i = 0; i < 2; i++) particles.spawn({ x: Math.random() * width, y: -4, vx: -30, vy: 80, life: 1.4, size: 2, color: 'rgba(255,255,255,0.9)', kind: 'spark' });
      }
      // Cogsworth: the inspected part above his head during the window, the open maintenance ring, a red flash on a
      // violation — all from the saved Taktband state (static in reduced motion)
      if (view.story?.mode === 'cogsworth') {
        const st = view.story,
          r = geo.enemyScale;
        if (st.phase === 'window' && st.symbol) {
          const icon = { gear: '⚙', bolt: '🔩', spring: '➰' }[st.symbol],
            name = { gear: 'ZAHNRAD', bolt: 'BOLZEN', spring: 'FEDER' }[st.symbol],
            bx = pos.x - r * 1.45,
            by = pos.y - r * 0.55,
            pulse = reduced ? 1 : 1 + Math.sin(time * 6) * 0.05;
          ctx.fillStyle = 'rgba(246,236,208,0.95)';
          ctx.beginPath();
          ctx.arc(bx, by, r * 0.42 * pulse, 0, TAU);
          ctx.fill();
          ctx.strokeStyle = '#ffd25a';
          ctx.lineWidth = 3;
          ctx.stroke();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#2a2234';
          ctx.font = '700 ' + Math.round(r * 0.44) + 'px system-ui, sans-serif';
          ctx.fillText(icon, bx, by + 1);
          ctx.font = '900 ' + Math.round(Math.max(11, r * 0.2)) + 'px system-ui, sans-serif';
          ctx.fillStyle = '#ffd25a';
          ctx.fillText(name + '?', bx, by + r * 0.62);
          ctx.textBaseline = 'alphabetic';
        }
        if (st.open) {
          ctx.strokeStyle = 'rgba(95,224,208,' + (reduced ? 0.7 : 0.55 + Math.sin(time * 6) * 0.2).toFixed(3) + ')';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y + r * 0.2, r * 0.55, 0, TAU);
          ctx.stroke();
        }
        if (st.phase === 'violation') {
          ctx.fillStyle = 'rgba(255,90,90,0.12)';
          ctx.fillRect(0, 0, width, height);
        }
      }
      // Petalguard: telegraph ring before the bloom, a green healing veil while living petals heal her, a green flash
      // when she recovered (from the saved state; static in reduced motion)
      if (view.story?.mode === 'petalguard') {
        const st = view.story,
          r = geo.enemyScale;
        if (st.healing) {
          ctx.fillStyle = 'rgba(127,255,176,' + (reduced ? 0.08 : 0.06 + 0.04 * Math.sin(time * 5)).toFixed(3) + ')';
          ctx.fillRect(0, 0, width, height);
          if (!reduced && Math.random() < 0.3) particles.spawn({ x: pos.x + (Math.random() - 0.5) * r * 1.6, y: pos.y + r * 0.6, vx: 0, vy: -50, life: 1, size: 3, color: 'rgba(200,255,220,0.9)', kind: 'spark' });
        }
        if (st.recovered) {
          ctx.fillStyle = 'rgba(127,255,176,0.18)';
          ctx.fillRect(0, 0, width, height);
        }
        if (st.phase === 'bloom' && st.target === 'petals' && st.petals > 0) {
          ctx.strokeStyle = 'rgba(255,158,203,0.75)';
          ctx.lineWidth = 3;
          ctx.setLineDash([6, 6]);
          ctx.beginPath();
          ctx.arc(pos.x, pos.y - r * 0.35, r * 0.75, 0, TAU);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      // Emberbell: steam blast tint (nothing gets through) and the open plates during cooling — real phases
      if (view.story?.mode === 'emberbell') {
        if (view.story.phase === 'blast') {
          ctx.fillStyle = 'rgba(255,230,190,0.22)';
          ctx.fillRect(0, 0, width, height);
          if (!reduced) for (let i = 0; i < 3; i++) particles.spawn({ x: pos.x + (Math.random() - 0.5) * geo.enemyScale * 2, y: pos.y, vx: (Math.random() - 0.5) * 160, vy: -40 - Math.random() * 80, life: 0.9, size: 3, color: 'rgba(255,240,220,0.8)', kind: 'spark' });
        }
        if (view.story.open) {
          ctx.strokeStyle = 'rgba(127,232,240,' + (0.55 + Math.sin(time * 6) * 0.2).toFixed(3) + ')';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, geo.enemyScale * 1.35, 0, TAU);
          ctx.stroke();
        }
      }
      if (view.story?.telegraph) {
        const pulse = 0.5 + Math.sin(time * 14) * 0.5;
        ctx.strokeStyle = `rgba(255,120,120,${0.4 + pulse * 0.5})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, geo.enemyScale * (1.5 - pulse * 0.3), 0, TAU);
        ctx.stroke();
        ctx.fillStyle = '#ffd77a';
        ctx.font = `900 ${Math.round(geo.enemyScale * 0.55)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('!', pos.x, pos.y - geo.enemyScale * 1.25);
      }
      if (enemy.shield > 0) Art.glowCircle(ctx, pos.x, pos.y, geo.enemyScale * 1.4, '#9fd8ff', enemy.shield);
      if (enemy.block > 0) {
        // Hex shield flash where the blocked shot landed
        ctx.save();
        ctx.globalAlpha = enemy.block * 2;
        ctx.strokeStyle = '#d8f2ff';
        ctx.lineWidth = 2;
        const R = geo.enemyScale * 1.15;
        for (let k = 0; k < 6; k++) {
          const a = Math.PI * 0.67 + (k - 2.5) * 0.2;
          ctx.beginPath();
          ctx.arc(pos.x + Math.cos(a) * R, pos.y + Math.sin(a) * R, R * 0.12, 0, TAU);
          ctx.stroke();
        }
        ctx.restore();
      }
      // Aim reticle when the precision shot is armed
      if (view.aimReady) {
        ctx.strokeStyle = '#ff5a5a';
        ctx.lineWidth = 2;
        const r = geo.enemyScale * 0.9 + Math.sin(time * 6) * 3;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r, 0, TAU);
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * TAU + time;
          ctx.moveTo(pos.x + Math.cos(a) * (r - 8), pos.y + Math.sin(a) * (r - 8));
          ctx.lineTo(pos.x + Math.cos(a) * (r + 8), pos.y + Math.sin(a) * (r + 8));
        }
        ctx.stroke();
      }
      // Player ship
      const bob = Math.sin(time * 1.6) * 4;
      ctx.save();
      ctx.translate(geo.player.x - recoil * 6, geo.player.y + bob);
      ctx.scale(geo.shipScale * 1.6, geo.shipScale * 1.6);
      ctx.rotate(-recoil * 0.02);
      if (view.overcharge) Art.glowCircle(ctx, 0, 0, 0.9, '#ffb35a', 0.45 + Math.sin(time * 10) * 0.15);
      // Beta 1.2 Kometenschweif: a static streak behind the engine (the moving sparks are added after the ship)
      const engineLook = window.SpaceKittensForge?.LOOKS?.[view.cosmeticEngine];
      if (engineLook) {
        const tail = ctx.createLinearGradient(-1.6, 0, -0.35, 0);
        tail.addColorStop(0, 'rgba(255,255,255,0)');
        tail.addColorStop(1, engineLook.color);
        ctx.fillStyle = tail;
        ctx.globalAlpha = 0.55;
        ctx.beginPath();
        ctx.ellipse(-0.95, 0.08, 0.65, 0.07, 0, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      Art.drawPlayerShip(
        ctx,
        view.ship.model,
        view.ship,
        time,
        Art.SHIP_PALETTES[view.cosmeticShip] || Art.SHIP_PALETTES.default,
        Kit.ROSTER[view.pilot],
        pilot.mood
      );
      ctx.restore();
      if (shipHit > 0) Art.glowCircle(ctx, geo.player.x, geo.player.y + bob, geo.shipScale * 1.2, '#ff6b6b', shipHit * 0.5);
      // Beta 1.3: the ship's hull in a wave (the enemies shoot back) — a small bar under the ship
      if (view.story?.mode === 'wave' && view.story.hullMax) {
        const bw = geo.shipScale * 1.6,
          bx = geo.player.x - bw / 2,
          by = geo.player.y + bob + geo.shipScale * 0.85,
          ratio = Math.max(0, Math.min(1, view.story.hull / view.story.hullMax));
        ctx.fillStyle = 'rgba(10,8,24,0.7)';
        ctx.fillRect(bx - 1, by - 1, bw + 2, 7);
        ctx.fillStyle = ratio > 0.5 ? '#8ff0d4' : ratio > 0.25 ? '#ffd76a' : '#ff6b6b';
        ctx.fillRect(bx, by, bw * ratio, 5);
      }
      // enemy shots in flight
      for (const es of enemyShots) {
        if (es.hit) continue;
        const k = Math.min(1, es.age / es.travel),
          tx = geo.player.x + geo.shipScale * 0.5,
          ty = geo.player.y + bob,
          x = es.from.x + (tx - es.from.x) * k,
          y = es.from.y + (ty - es.from.y) * k - (es.shot === 'seal' ? Math.sin(k * Math.PI) * geo.shipScale * 0.5 : 0);
        if (es.shot === 'laser') {
          ctx.strokeStyle = 'rgba(255,90,90,0.85)';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(es.from.x, es.from.y);
          ctx.lineTo(x, y);
          ctx.stroke();
        } else if (es.shot === 'paper') {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(reduced ? 0 : es.age * 14);
          ctx.fillStyle = '#fbf6e8';
          ctx.fillRect(-4, -3, 8, 6);
          ctx.restore();
        } else {
          const r = es.shot === 'seal' ? 7 : es.shot === 'clip' ? 5 : 4.5,
            color = es.shot === 'seal' ? '#c8343c' : es.shot === 'clip' ? '#b98a5a' : '#e0565a';
          if (!reduced) Art.glowCircle(ctx, x, y, r * 2.6, color, 0.45);
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, TAU);
          ctx.fill();
        }
      }
      if (engineLook && !reduced && Math.random() < 0.5)
        particles.spawn({ x: geo.player.x - geo.shipScale * 1.6 * 0.42, y: geo.player.y + bob + geo.shipScale * 0.12, vx: -110 - Math.random() * 40, vy: (Math.random() - 0.5) * 18, drag: 1.2, life: 0.55, size: 2.2, color: Math.random() < 0.5 ? engineLook.color : engineLook.core, kind: 'spark' });
      if (view.cat) {
        drawCatGlider(ctx);
        if (view.cat.charged) Art.glowCircle(ctx, geo.player.x, geo.player.y, geo.shipScale * 1.3, '#6bd6ff', reduced ? 0.25 : 0.2 + Math.sin(time * 6) * 0.08);
        if (view.cat.marked) {
          const mp = enemyPos(),
            mr = geo.enemyScale * 0.95,
            spin = reduced ? 0 : time * 0.8;
          ctx.save();
          ctx.translate(mp.x, mp.y);
          ctx.rotate(spin);
          ctx.strokeStyle = 'rgba(255,179,90,0.9)';
          ctx.lineWidth = 2;
          ctx.setLineDash([7, 6]);
          ctx.beginPath();
          ctx.arc(0, 0, mr, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          for (let i = 0; i < 4; i++) {
            const a = (i * Math.PI) / 2;
            ctx.beginPath();
            ctx.moveTo(Math.cos(a) * mr * 0.75, Math.sin(a) * mr * 0.75);
            ctx.lineTo(Math.cos(a) * mr * 1.2, Math.sin(a) * mr * 1.2);
            ctx.stroke();
          }
          ctx.restore();
        }
      }
      // Shots, particles
      const target = { x: pos.x - geo.enemyScale * 0.3, y: pos.y };
      for (const shot of shots) drawShot(ctx, shot, target);
      ctx.globalCompositeOperation = 'lighter';
      for (const r of rings) {
        const t = r.age / r.life,
          rad = r.r0 + (r.r1 - r.r0) * math.easeOutCubic(t);
        ctx.globalAlpha = (1 - t) * (r.fill ? 0.5 : 0.9);
        ctx.beginPath();
        ctx.arc(r.x, r.y, rad, 0, TAU);
        if (r.fill) {
          ctx.fillStyle = r.color;
          ctx.fill();
        } else {
          ctx.strokeStyle = r.color;
          ctx.lineWidth = r.width;
          ctx.stroke();
        }
      }
      ctx.strokeStyle = WEAPONS.Arc.color;
      ctx.lineWidth = 1.6;
      for (const z of zaps) {
        ctx.globalAlpha = 1 - z.age / z.life;
        const R = geo.enemyScale * (enemy.boss ? 0.6 : 0.8);
        for (let k = 0; k < 2; k++) {
          let a = z.seed + k * 2.1 + Math.floor(z.age * 30);
          ctx.beginPath();
          let px = z.x + Math.cos(a) * R * 0.6,
            py = z.y + Math.sin(a) * R * 0.6;
          ctx.moveTo(px, py);
          for (let j = 0; j < 4; j++) {
            a += (Math.sin(z.seed * (j + 1) + z.age * 50) - 0.2) * 0.6;
            px = z.x + Math.cos(a) * R * (0.7 + j * 0.15);
            py = z.y + Math.sin(a) * R * (0.7 + j * 0.15);
            ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalCompositeOperation = 'lighter';
      particles.forEach(p => {
        ctx.globalAlpha = 1 - p.age / p.life;
        ctx.fillStyle = p.color;
        if (p.kind === 'puff') {
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = (1 - p.age / p.life) * 0.8;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1 + p.age), 0, TAU);
          ctx.fill();
          ctx.globalCompositeOperation = 'lighter';
        } else if (p.kind === 'star') {
          const r = p.size * 1.4;
          ctx.beginPath();
          for (let k = 0; k < 10; k++) {
            const a = (k / 10) * TAU + p.age * 4,
              rr = k % 2 ? r * 0.45 : r;
            k
              ? ctx.lineTo(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr)
              : ctx.moveTo(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr);
          }
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, TAU);
          ctx.fill();
        }
      });
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      // Damage numbers (aggregated)
      ctx.textAlign = 'center';
      for (const n of numbers) {
        const t = n.age / n.life;
        ctx.globalAlpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
        ctx.font = `900 ${n.strong ? 18 : 14}px Nunito, sans-serif`;
        const y = n.y - math.easeOutCubic(t) * 26;
        // Petalguard: a hit on the petals wilts them instead of doing damage
        const text = n.wilted ? (n.wilted > 1 ? n.wilted + ' BLÜTEN WELKEN' : 'BLÜTE WELKT') : n.label + '-' + window.NebulaFormat(n.value);
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(10,4,8,0.9)';
        ctx.strokeText(text, n.x, y);
        ctx.fillStyle = n.hurt ? '#ff7a6b' : n.wilted ? '#ff9ecb' : n.blocked ? '#a9c4e0' : n.strong ? '#ffd76a' : '#ffffff';
        ctx.fillText(text, n.x, y);
      }
      // Banners (boss warning / reward)
      for (const b of banners) {
        const t = b.age / b.life;
        ctx.globalAlpha = t < 0.15 ? t / 0.15 : t > 0.8 ? (1 - t) / 0.2 : 1;
        const y = b.kind === 'warning' ? geo.top + 34 : height - geo.bottom - 24 - math.easeOutCubic(t) * 10;
        ctx.font = `900 ${b.kind === 'warning' ? 20 : 17}px Nunito, sans-serif`;
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(5,6,16,0.85)';
        ctx.strokeText(b.text, width / 2, y);
        ctx.fillStyle = b.color;
        ctx.fillText(b.text, width / 2, y);
        if (b.sub) {
          ctx.font = '700 11px Nunito, sans-serif';
          ctx.strokeText(b.sub, width / 2, y + 16);
          ctx.fillStyle = '#e8eefc';
          ctx.fillText(b.sub, width / 2, y + 16);
        }
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
      ctx.restore();
    }

    layout();
    initStreaks();
    return {
      resize(width, height) {
        w = width;
        h = height;
        layout();
        initStreaks();
      },
      update,
      draw,
      onShow() {
        shown = true;
      },
      onHide() {
        shown = false;
        // Drop transient effects so returning to the screen never replays a backlog.
        shots.length = 0;
        numbers.length = 0;
        rings.length = 0;
        zaps.length = 0;
        particles.clear();
        enemy.hpTrail = enemy.hpShown;
      },
      destroy() {
        off.forEach(fn => fn());
      },
      pilotMood: () => pilot.mood,
      debug: () => ({
        rings: rings.length,
        zaps: zaps.length,
        particles: particles.active,
        shots: shots.length,
        numbers: numbers.length,
        banners: banners.length,
        enemy: { x: geo.enemy.x, y: geo.enemy.y, scale: geo.enemyScale },
        hudInset,
        ...stats
      })
    };
  }

  window.NebulaScenes = window.NebulaScenes || {};
  window.NebulaScenes.createCombatScene = createCombatScene;
})();
