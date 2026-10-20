// Modular spaceship renderer (replaces the simple capsule ship). One function draws the real equipped ship
// everywhere: combat, ship workshop preview, colony landing pads and freighters.
//   model   → silhouette (Horizon, Comet, Aegis, Vanguard, Corsair, Pioneer)
//   hull    → armour stages (2, 5, 9, 14): plates, dorsal spine, nose cap, gold trim
//   engine  → nozzle count/size (4, 8), housing, flame length and glow
//   core    → reactor window glow, ring (3), crystal spikes (6)
//   weapon  → number of hardpoints (every 3 levels), barrel length; weaponType → distinct mount geometry
// Ship points right; origin ≈ centre of mass; 1 unit ≈ ship length 1.3.
(function () {
  'use strict';
  const Art = window.NebulaArt;
  const TAU = Math.PI * 2;

  // Silhouette definitions: hull outline (top & bottom curves), wings, cockpit, nozzles, core, hardpoints.
  const MODELS = {
    Horizon: {
      hull: [
        [-0.6, 0],
        [-0.52, -0.16],
        [-0.1, -0.2],
        [0.42, -0.12],
        [0.66, 0.02],
        [0.42, 0.16],
        [-0.1, 0.22],
        [-0.52, 0.18]
      ],
      wings: [
        [
          [-0.22, 0.12],
          [-0.5, 0.42],
          [-0.6, 0.4],
          [-0.44, 0.14]
        ],
        [
          [-0.22, -0.12],
          [-0.46, -0.34],
          [-0.56, -0.32],
          [-0.42, -0.12]
        ]
      ],
      cockpit: [0.18, -0.13, 0.2, 0.17],
      nozzles: [0.02],
      core: [-0.2, 0.04],
      hardpoints: [
        [0.5, 0.06],
        [0.22, 0.24],
        [0.22, -0.16],
        [0.02, 0.28]
      ],
      accent: 'stripe'
    },
    Comet: {
      hull: [
        [-0.66, 0.02],
        [-0.58, -0.08],
        [-0.1, -0.13],
        [0.5, -0.06],
        [0.78, 0.03],
        [0.5, 0.11],
        [-0.1, 0.15],
        [-0.58, 0.12]
      ],
      wings: [
        [
          [-0.3, -0.08],
          [-0.62, -0.42],
          [-0.7, -0.4],
          [-0.5, -0.06]
        ],
        [
          [-0.18, 0.12],
          [-0.42, 0.3],
          [-0.5, 0.28],
          [-0.38, 0.12]
        ]
      ],
      cockpit: [0.26, -0.09, 0.16, 0.12],
      nozzles: [-0.03, 0.08],
      core: [-0.18, 0.02],
      hardpoints: [
        [0.62, 0.05],
        [0.3, 0.15],
        [0.3, -0.08],
        [0.06, 0.18]
      ],
      accent: 'racing'
    },
    Aegis: {
      hull: [
        [-0.56, 0.02],
        [-0.5, -0.24],
        [-0.1, -0.3],
        [0.34, -0.22],
        [0.52, 0.02],
        [0.34, 0.26],
        [-0.1, 0.32],
        [-0.5, 0.26]
      ],
      wings: [
        [
          [-0.18, 0.24],
          [-0.36, 0.42],
          [-0.5, 0.4],
          [-0.38, 0.22]
        ],
        [
          [-0.18, -0.24],
          [-0.34, -0.4],
          [-0.48, -0.38],
          [-0.38, -0.22]
        ]
      ],
      cockpit: [0.12, -0.17, 0.2, 0.18],
      nozzles: [-0.1, 0.14],
      core: [-0.16, 0.06],
      hardpoints: [
        [0.42, 0.04],
        [0.2, 0.28],
        [0.2, -0.2],
        [0.0, 0.34]
      ],
      accent: 'ring'
    },
    Vanguard: {
      hull: [
        [-0.68, 0.02],
        [-0.6, -0.12],
        [-0.2, -0.16],
        [0.6, -0.07],
        [0.86, 0.02],
        [0.6, 0.1],
        [-0.2, 0.18],
        [-0.6, 0.15]
      ],
      wings: [
        [
          [-0.05, 0.14],
          [0.2, 0.4],
          [0.08, 0.42],
          [-0.22, 0.16]
        ],
        [
          [-0.05, -0.12],
          [0.16, -0.34],
          [0.04, -0.36],
          [-0.22, -0.13]
        ]
      ],
      cockpit: [-0.02, -0.12, 0.18, 0.13],
      nozzles: [0.02],
      core: [-0.34, 0.02],
      hardpoints: [
        [0.78, 0.02],
        [0.36, 0.14],
        [0.36, -0.1],
        [0.12, 0.3]
      ],
      accent: 'spine'
    },
    Corsair: {
      hull: [
        [-0.58, 0.02],
        [-0.48, -0.14],
        [-0.08, -0.17],
        [0.38, -0.1],
        [0.6, 0.02],
        [0.38, 0.14],
        [-0.08, 0.2],
        [-0.48, 0.16]
      ],
      wings: [
        [
          [-0.12, 0.14],
          [-0.36, 0.5],
          [-0.64, 0.5],
          [-0.42, 0.16]
        ],
        [
          [-0.12, -0.12],
          [-0.34, -0.46],
          [-0.62, -0.46],
          [-0.42, -0.12]
        ]
      ],
      cockpit: [0.14, -0.11, 0.18, 0.15],
      nozzles: [-0.1, 0.13],
      wingNozzles: true,
      core: [-0.18, 0.03],
      hardpoints: [
        [0.5, 0.04],
        [-0.36, 0.48],
        [-0.34, -0.44],
        [0.24, 0.2]
      ],
      accent: 'bandana'
    },
    Pioneer: {
      hull: [
        [-0.58, 0.04],
        [-0.54, -0.18],
        [-0.1, -0.24],
        [0.36, -0.2],
        [0.54, 0.02],
        [0.4, 0.24],
        [-0.1, 0.28],
        [-0.54, 0.26]
      ],
      wings: [
        [
          [-0.1, 0.26],
          [-0.26, 0.4],
          [-0.44, 0.4],
          [-0.32, 0.26]
        ]
      ],
      cockpit: [0.16, -0.15, 0.2, 0.17],
      nozzles: [-0.02, 0.16],
      core: [-0.22, 0.06],
      hardpoints: [
        [0.44, 0.06],
        [0.2, 0.3],
        [0.2, -0.18],
        [0.0, 0.32]
      ],
      accent: 'dish',
      cargo: true
    }
  };
  const model = name => MODELS[name] || MODELS.Horizon;

  function poly(ctx, pts, fill) {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }
  // Smooth closed curve through the outline points (rounded, cute silhouette).
  function smoothPath(ctx, pts) {
    ctx.beginPath();
    const n = pts.length,
      mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let start = mid(pts[n - 1], pts[0]);
    ctx.moveTo(start[0], start[1]);
    for (let i = 0; i < n; i++) {
      const p = pts[i],
        m = mid(p, pts[(i + 1) % n]);
      ctx.quadraticCurveTo(p[0], p[1], m[0], m[1]);
    }
    ctx.closePath();
  }
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  }
  function grad(ctx, y0, y1, a, b) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, a);
    g.addColorStop(1, b);
    return g;
  }

  // Hardpoints (muzzle positions) — model specific; count grows with the weapon level.
  function weaponHardpoints(gear) {
    const count = 1 + Math.min(3, Math.floor((gear.weapon || 0) / 3)),
      m = model(gear.model),
      [kx, ky0, rx0, ry0] = m.cockpit,
      rx = rx0 * 1.12,
      ry = ry0 * 1.45,
      ky = ky0 + 0.02;
    // P1.3: a dorsal hardpoint that would sit under the cockpit dome (the weapon showed through the glass) moves in front
    // of the dome, on the hull's upper front (presentation only: the game fires from the ship, not from a hardpoint)
    return m.hardpoints.slice(0, count).map(([x, y]) => (y < ky + 0.02 && y > ky - ry - 0.06 && Math.abs(x - kx) < rx + 0.06 ? [kx + rx + 0.07, y] : [x, y]));
  }

  // Weapon mounts: each weapon type has its own geometry; the muzzle sits at (x + reach, y).
  function weaponMount(ctx, type, x, y, level, time, trim) {
    const reach = 0.1 + Math.min(0.08, level * 0.006);
    ctx.save();
    ctx.translate(x, y);
    if (type === 'Plasma') {
      rr(ctx, -0.07, -0.045, 0.12, 0.09, 0.04);
      ctx.fillStyle = '#5a6aa0';
      ctx.fill();
      Art.glowCircle(ctx, -0.01, 0, 0.07, '#ff9ecb', 0.7);
      ctx.fillStyle = '#ff9ecb';
      ctx.beginPath();
      ctx.arc(-0.01, 0, 0.035, 0, TAU);
      ctx.fill();
      rr(ctx, 0.04, -0.028, reach, 0.056, 0.028);
      ctx.fillStyle = '#7f8cc0';
      ctx.fill();
    } else if (type === 'Arc') {
      rr(ctx, -0.06, -0.035, 0.1, 0.07, 0.03);
      ctx.fillStyle = '#4a5a8a';
      ctx.fill();
      ctx.strokeStyle = '#c4cbe4';
      ctx.lineWidth = 0.022;
      [-0.03, 0.03].forEach(dy => {
        ctx.beginPath();
        ctx.moveTo(0.03, dy);
        ctx.lineTo(0.03 + reach, dy * 1.6);
        ctx.stroke();
      });
      const spark = Math.sin(time * 30) > 0;
      if (spark) {
        ctx.strokeStyle = '#8fe3ff';
        ctx.lineWidth = 0.012;
        ctx.beginPath();
        ctx.moveTo(0.03 + reach, -0.05);
        ctx.lineTo(0.03 + reach * 0.8, 0);
        ctx.lineTo(0.03 + reach, 0.05);
        ctx.stroke();
      }
    } else if (type === 'Ion') {
      rr(ctx, -0.05, -0.04, 0.12, 0.08, 0.02);
      ctx.fillStyle = '#3f4f7a';
      ctx.fill();
      ctx.strokeStyle = '#8ff0d4';
      ctx.lineWidth = 0.016;
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.ellipse(0.09 + i * 0.04, 0, 0.012, 0.035 - i * 0.008, 0, 0, TAU);
        ctx.stroke();
      }
      Art.glowCircle(ctx, 0.07 + reach * 0.6, 0, 0.03, '#8ff0d4', 0.8);
    } else if (type === 'Nova') {
      rr(ctx, -0.09, -0.06, 0.16, 0.12, 0.05);
      ctx.fillStyle = '#5a4a8a';
      ctx.fill();
      for (let i = 0; i < 3; i++) {
        rr(ctx, -0.06 + i * 0.045, -0.07, 0.025, 0.14, 0.01);
        ctx.fillStyle = '#ffd77a';
        ctx.fill();
      }
      rr(ctx, 0.06, -0.04, reach + 0.04, 0.08, 0.04);
      ctx.fillStyle = '#7f74b0';
      ctx.fill();
      Art.glowCircle(ctx, 0.1 + reach, 0, 0.06, '#ffd77a', 0.45 + Math.sin(time * 6) * 0.2);
    } else {
      // Laser: sleek emitter with a lens
      rr(ctx, -0.06, -0.025, 0.08 + reach, 0.05, 0.025);
      ctx.fillStyle = '#6f7da8';
      ctx.fill();
      ctx.fillStyle = trim;
      ctx.beginPath();
      ctx.arc(0.02 + reach, 0, 0.026, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.arc(0.012 + reach, -0.008, 0.009, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  // Beta 1.4 M3: a Galactic-DNA weapon on a hardpoint — the chassis decides the shape, the affinity the colour.
  const DNA_TINT = { hydro: ['#7fdcff', '#2f5f8a'], thermal: ['#ff9a4a', '#8a3f2a'], kinetic: ['#e8e2d0', '#5a5a6e'], ion: ['#b89aff', '#4a3a8a'] };
  function dnaMount(ctx, dna, x, y, level, time) {
    const [glow, metal] = DNA_TINT[dna.affinity] || DNA_TINT.kinetic,
      reach = 0.11 + Math.min(0.08, level * 0.006),
      pulse = 0.55 + Math.sin(time * 5 + x * 9) * 0.2;
    ctx.save();
    ctx.translate(x, y);
    const body = (bx, by, w, h, r, fill) => {
      rr(ctx, bx, by, w, h, r);
      ctx.fillStyle = fill;
      ctx.fill();
    };
    if (dna.chassis === 'repeater') {
      body(-0.07, -0.04, 0.12, 0.08, 0.025, metal);
      for (const dy of [-0.022, 0.022]) body(0.04, dy - 0.011, reach, 0.022, 0.011, '#c4cbe4');
      Art.glowCircle(ctx, 0.05 + reach, 0, 0.035, glow, pulse);
    } else if (dna.chassis === 'heavy') {
      body(-0.09, -0.06, 0.15, 0.12, 0.04, metal);
      body(0.05, -0.035, reach + 0.03, 0.07, 0.02, '#9aa2c4');
      body(0.06 + reach, -0.045, 0.03, 0.09, 0.012, glow);
    } else if (dna.chassis === 'lance') {
      body(-0.07, -0.03, 0.11, 0.06, 0.03, metal);
      ctx.beginPath();
      ctx.moveTo(0.04, -0.03);
      ctx.lineTo(0.06 + reach + 0.05, 0);
      ctx.lineTo(0.04, 0.03);
      ctx.closePath();
      ctx.fillStyle = '#c4cbe4';
      ctx.fill();
      Art.glowCircle(ctx, 0.03, 0, 0.045, glow, pulse);
    } else if (dna.chassis === 'prism') {
      body(-0.06, -0.04, 0.1, 0.08, 0.02, metal);
      ctx.beginPath();
      ctx.moveTo(0.04, 0);
      ctx.lineTo(0.04 + reach * 0.6, -0.05);
      ctx.lineTo(0.04 + reach, 0);
      ctx.lineTo(0.04 + reach * 0.6, 0.05);
      ctx.closePath();
      ctx.fillStyle = glow;
      ctx.globalAlpha = 0.85;
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (dna.chassis === 'scatter') {
      body(-0.07, -0.05, 0.12, 0.1, 0.03, metal);
      for (const a of [-0.35, 0, 0.35]) {
        ctx.save();
        ctx.rotate(a);
        body(0.04, -0.012, reach * 0.8, 0.024, 0.012, '#c4cbe4');
        ctx.restore();
      }
      Art.glowCircle(ctx, 0.0, 0, 0.03, glow, pulse);
    } else if (dna.chassis === 'mortar') {
      body(-0.08, -0.05, 0.14, 0.1, 0.045, metal);
      ctx.save();
      ctx.rotate(-0.45);
      body(0.03, -0.03, reach, 0.06, 0.025, '#9aa2c4');
      ctx.restore();
      Art.glowCircle(ctx, 0.0, 0, 0.04, glow, pulse);
    } else {
      body(-0.06, -0.03, 0.1 + reach, 0.06, 0.03, metal);
      Art.glowCircle(ctx, 0.05 + reach, 0, 0.03, glow, pulse);
    }
    // P1.3 DNA 3.0: the quality as built parts on the mount (DnaVisuals.RARITY parts) – the barrel tip at reach
    const rarity = window.DnaVisuals?.rarityOf(dna.rarity),
      parts = rarity?.parts || [],
      tip = 0.05 + reach;
    if (parts.includes('fins'))
      for (const sy of [-1, 1]) {
        ctx.fillStyle = '#c4cbe4';
        ctx.beginPath();
        ctx.moveTo(-0.05, sy * 0.035);
        ctx.lineTo(-0.02, sy * 0.075);
        ctx.lineTo(0.02, sy * 0.075);
        ctx.lineTo(0.03, sy * 0.035);
        ctx.closePath();
        ctx.fill();
      }
    if (parts.includes('shroud')) {
      rr(ctx, 0.03, -0.028, reach * 0.55, 0.056, 0.02);
      ctx.fillStyle = '#ffd77a';
      ctx.fill();
      ctx.strokeStyle = '#b8862a';
      ctx.lineWidth = 0.008;
      ctx.stroke();
    }
    if (parts.includes('coil'))
      for (let i = 0; i < 3; i++) {
        const cx = 0.05 + (i + 0.5) * (reach / 3.2),
          on = Math.sin(time * 8 - i * 1.2) > 0;
        ctx.strokeStyle = on ? glow : 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 0.012;
        ctx.beginPath();
        ctx.ellipse(cx, 0, 0.012, 0.038, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    if (parts.includes('band')) {
      ctx.fillStyle = rarity.color;
      ctx.fillRect(0.035, -0.032, 0.016, 0.064);
    }
    if (parts.includes('shards'))
      for (const sy of [-1, 1]) {
        const bob = Math.sin(time * 2.2 + sy) * 0.012,
          sx = tip * 0.6,
          syy = sy * 0.085 + bob;
        ctx.fillStyle = rarity.color;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.moveTo(sx, syy - 0.025);
        ctx.lineTo(sx + 0.014, syy);
        ctx.lineTo(sx, syy + 0.025);
        ctx.lineTo(sx - 0.014, syy);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    if (parts.includes('ring')) {
      ctx.strokeStyle = rarity.color;
      ctx.lineWidth = 0.01;
      ctx.beginPath();
      ctx.ellipse(tip + 0.02, 0, 0.018, 0.05, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Visual Identity round: the weapon's quality on the mount (DnaVisuals): a rim glow from rare, sparkles from epic
    if (rarity?.glow >= 0.3) {
      Art.glowCircle(ctx, 0.02, 0, 0.1, rarity.color, rarity.glow * pulse);
      window.DnaVisuals.drawSparkles(ctx, 0.03, 0, 0.12, rarity, time);
    }
    ctx.restore();
  }
  // Beta 1.5 refits from the Fertigung, visible on every ship: armour plates along the belly (one per level, a nose
  // plate from 3), a dorsal shield emitter with one ring per level, cooling fins at the tail (one pair per level)
  function drawRefits(ctx, m, refits, time) {
    if (!refits) return;
    const xs = m.hull.map(p => p[0]),
      ys = m.hull.map(p => p[1]),
      minX = Math.min(...xs),
      maxX = Math.max(...xs),
      top = Math.min(...ys),
      bottom = Math.max(...ys),
      armor = Math.min(5, refits.armor || 0),
      shield = Math.min(3, refits.shield || 0),
      cooling = Math.min(3, refits.cooling || 0);
    for (let i = 0; i < cooling; i++) {
      const x = minX + 0.14 + i * 0.075;
      [
        [top + 0.03, top - 0.09],
        [bottom - 0.03, bottom + 0.09]
      ].forEach(([y0, y1]) => {
        poly(
          ctx,
          [
            [x - 0.02, y0],
            [x + 0.02, y0],
            [x + 0.005, y1],
            [x - 0.03, y1]
          ],
          '#bfeeff'
        );
        ctx.strokeStyle = 'rgba(70,170,220,0.9)';
        ctx.lineWidth = 0.008;
        ctx.stroke();
      });
    }
    if (armor) {
      const span = (maxX - minX) * 0.62,
        w = span / 5 - 0.012,
        x0 = minX + (maxX - minX) * 0.16;
      for (let i = 0; i < armor; i++) {
        const x = x0 + i * (w + 0.012);
        rr(ctx, x, bottom - 0.085, w, 0.07, 0.012);
        ctx.fillStyle = grad(ctx, bottom - 0.085, bottom - 0.015, '#d9deef', '#6f7894');
        ctx.fill();
        ctx.strokeStyle = 'rgba(40,46,70,0.85)';
        ctx.lineWidth = 0.01;
        ctx.stroke();
        ctx.fillStyle = '#3c4360';
        [0.2, 0.8].forEach(f => {
          ctx.beginPath();
          ctx.arc(x + w * f, bottom - 0.05, 0.007, 0, TAU);
          ctx.fill();
        });
      }
      if (armor >= 3) {
        poly(
          ctx,
          [
            [maxX - 0.2, -0.07],
            [maxX - 0.02, -0.01],
            [maxX - 0.02, 0.05],
            [maxX - 0.2, 0.11]
          ],
          grad(ctx, -0.07, 0.11, '#e4e8f5', '#7b84a0')
        );
        ctx.strokeStyle = 'rgba(40,46,70,0.85)';
        ctx.lineWidth = 0.01;
        ctx.stroke();
      }
    }
    if (shield) {
      const sx = m.core[0] - 0.06,
        sy = top + 0.01,
        pulse = 0.6 + Math.sin(time * 4) * 0.25;
      rr(ctx, sx - 0.05, sy - 0.015, 0.1, 0.04, 0.015);
      ctx.fillStyle = '#4b5578';
      ctx.fill();
      Art.glowCircle(ctx, sx, sy - 0.03, 0.05 + shield * 0.012, '#7fe8ff', pulse);
      ctx.fillStyle = '#c9f6ff';
      ctx.beginPath();
      ctx.arc(sx, sy - 0.02, 0.032, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = 'rgba(127,232,255,' + (0.35 + pulse * 0.4).toFixed(2) + ')';
      ctx.lineWidth = 0.01;
      for (let i = 0; i < shield; i++) {
        ctx.beginPath();
        ctx.arc(sx, sy - 0.02, 0.05 + i * 0.025, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      }
    }
  }
  function mountedShipDna(gear) {
    if (gear.dna !== undefined) return gear.dna;
    return typeof mountedDna === 'function' ? mountedDna() : null;
  }

  // P1.2 Ship DNA 2.0: the tier and the role change the SILHOUETTE, not only the lights. Behind the hull: the wing
  // extension (Veteran: the wings grow at their tips; Elite: a winglet stands on each tip) and the ventral nacelle
  // (Veteran+: a long module pod under the hull with a role-colour stripe; Elite: a lit intake). After the hull: the
  // Elite canards at the nose and the dorsal crest. The role module (from tier.roleModule): Jäger twin tail fins,
  // Versorger shield dome, Präzision sensor lance, Kaperer grapple claws, Erkunder scanner mast, Allrounder winglets.
  function wingExtension(ctx, m, look, trim, dark) {
    const ext = look.tier.wingExt || 0;
    if (!ext) return;
    m.wings.forEach(w => {
      const root = [(w[0][0] + w[3][0]) / 2, (w[0][1] + w[3][1]) / 2],
        tip = [(w[1][0] + w[2][0]) / 2, (w[1][1] + w[2][1]) / 2],
        len = Math.hypot(tip[0] - root[0], tip[1] - root[1]) || 1,
        dx = ((tip[0] - root[0]) / len) * ext,
        dy = ((tip[1] - root[1]) / len) * ext;
      const a = w[1],
        b = w[2],
        a2 = [a[0] + dx - 0.03, a[1] + dy],
        b2 = [b[0] + dx * 0.8, b[1] + dy * 0.8];
      poly(ctx, [a, a2, b2, b], trim);
      // the new tip carries the role colour (a stripe across the extension)
      ctx.strokeStyle = look.role.color;
      ctx.lineWidth = 0.022;
      ctx.beginPath();
      ctx.moveTo((a[0] + a2[0]) / 2, (a[1] + a2[1]) / 2);
      ctx.lineTo((b[0] + b2[0]) / 2, (b[1] + b2[1]) / 2);
      ctx.stroke();
      ctx.strokeStyle = look.tier.trim || 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 0.014;
      ctx.beginPath();
      ctx.moveTo(a2[0], a2[1]);
      ctx.lineTo(b2[0], b2[1]);
      ctx.stroke();
      if (look.tier.winglets) {
        // an Elite winglet: a small fin standing on the extended tip, in the trim colour
        const up = dy > 0 ? 1 : -1;
        poly(ctx, [b2, [b2[0] - 0.02, b2[1] + up * 0.12], [a2[0] - 0.06, a2[1] + up * 0.03]], trim);
      }
    });
  }
  function nacelle(ctx, m, look, dark, time) {
    if (!look.tier.nacelle) return;
    const bottom = Math.max(...m.hull.map(p => p[1])),
      tail = Math.min(...m.hull.map(p => p[0])),
      x0 = tail + 0.12,
      y = bottom + 0.05,
      len = 0.6;
    // two pylons, then the pod hanging under the hull
    ctx.fillStyle = dark;
    ctx.fillRect(x0 + 0.12, bottom - 0.04, 0.04, 0.08);
    ctx.fillRect(x0 + len - 0.2, bottom - 0.04, 0.04, 0.08);
    rr(ctx, x0, y - 0.045, len, 0.1, 0.05);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 0.01;
    ctx.stroke();
    ctx.fillStyle = look.role.color;
    ctx.fillRect(x0 + 0.08, y - 0.008, len - 0.18, 0.02);
    Art.glowCircle(ctx, x0 + len - 0.02, y, 0.035, look.role.color, look.tier.tier >= 3 ? 0.6 + Math.sin(time * 5) * 0.2 : 0.35);
  }
  function eliteCanards(ctx, m, look, trim) {
    if (!look.tier.canards) return;
    const nose = m.hull[4],
      top = m.hull[3],
      bot = m.hull[5];
    poly(ctx, [[top[0] - 0.06, top[1] + 0.02], [top[0] - 0.16, top[1] - 0.1], [top[0] + 0.04, top[1] + 0.01]], trim);
    poly(ctx, [[bot[0] - 0.06, bot[1] - 0.02], [bot[0] - 0.16, bot[1] + 0.1], [bot[0] + 0.04, bot[1] - 0.01]], trim);
    ctx.fillStyle = look.tier.trim;
    ctx.beginPath();
    ctx.arc(nose[0] - 0.03, nose[1], 0.018, 0, TAU);
    ctx.fill();
  }
  function roleModule(ctx, m, look, trim, dark, time) {
    if (look.tier.tier < 2) return;
    const kind = look.role.module,
      c = look.role.color,
      top = Math.min(...m.hull.map(p => p[1])),
      bottom = Math.max(...m.hull.map(p => p[1])),
      tail = Math.min(...m.hull.map(p => p[0])),
      nose = m.hull[4];
    if (kind === 'fins') {
      // twin tail fins, swept back
      for (const [dx, h] of [[0, 0.2], [0.1, 0.15]]) poly(ctx, [[tail + 0.06 + dx, top + 0.06], [tail - 0.02 + dx, top - h], [tail + 0.2 + dx, top + 0.05]], dx ? trim : c);
    } else if (kind === 'shield') {
      // a shield generator dome on the back with a pulsing field
      const x = -0.12,
        y = top + 0.02;
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.ellipse(x, y, 0.14, 0.1, 0, Math.PI, 0);
      ctx.fill();
      Art.glowCircle(ctx, x, y - 0.05, 0.09, c, 0.55 + Math.sin(time * 3) * 0.2);
      ctx.strokeStyle = c;
      ctx.globalAlpha = 0.35 + Math.sin(time * 3) * 0.15;
      ctx.lineWidth = 0.012;
      ctx.beginPath();
      ctx.arc(x, y, 0.16, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (kind === 'lance') {
      // a long sensor lance from the nose with a range ring
      ctx.strokeStyle = trim;
      ctx.lineWidth = 0.018;
      ctx.beginPath();
      ctx.moveTo(nose[0] - 0.02, nose[1]);
      ctx.lineTo(nose[0] + 0.2, nose[1]);
      ctx.stroke();
      ctx.strokeStyle = c;
      ctx.lineWidth = 0.01;
      ctx.beginPath();
      ctx.ellipse(nose[0] + 0.12, nose[1], 0.015, 0.035, 0, 0, TAU);
      ctx.stroke();
      Art.glowCircle(ctx, nose[0] + 0.2, nose[1], 0.025, c, 0.8);
    } else if (kind === 'claws') {
      // two grapple claws reaching forward from the nose
      for (const s of [-1, 1]) {
        ctx.strokeStyle = dark;
        ctx.lineWidth = 0.03;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(nose[0] - 0.12, nose[1] + s * 0.07);
        ctx.quadraticCurveTo(nose[0] + 0.08, nose[1] + s * 0.14, nose[0] + 0.1, nose[1] + s * 0.03);
        ctx.stroke();
        ctx.strokeStyle = c;
        ctx.lineWidth = 0.012;
        ctx.stroke();
        ctx.lineCap = 'butt';
      }
    } else if (kind === 'mast') {
      // a scanner mast with a turning light
      const x = 0.02,
        y = top + 0.03;
      ctx.strokeStyle = '#d8e6ff';
      ctx.lineWidth = 0.016;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - 0.2);
      ctx.stroke();
      const a = time * 3;
      Art.glowCircle(ctx, x + Math.cos(a) * 0.03, y - 0.2, 0.035, c, 0.85);
    } else if (kind === 'winglets') {
      // balanced dorsal and ventral winglets with a star light
      poly(ctx, [[0.06, top + 0.03], [-0.02, top - 0.11], [0.16, top + 0.02]], trim);
      poly(ctx, [[0.06, bottom - 0.03], [-0.02, bottom + 0.1], [0.16, bottom - 0.02]], trim);
      Art.glowCircle(ctx, -0.01, top - 0.1, 0.025, c, 0.7 + Math.sin(time * 4) * 0.2);
    }
  }
  function dorsalCrest(ctx, m, look, time) {
    if (!look.tier.crest) return;
    const top = m.hull[2];
    poly(ctx, [[top[0] - 0.2, top[1] + 0.03], [top[0] - 0.02, top[1] - 0.17], [top[0] + 0.12, top[1] + 0.03]], look.tier.trim);
    ctx.fillStyle = look.role.color;
    ctx.globalAlpha = 0.85;
    poly(ctx, [[top[0] - 0.1, top[1] + 0.01], [top[0] - 0.02, top[1] - 0.1], [top[0] + 0.04, top[1] + 0.01]], look.role.color);
    ctx.globalAlpha = 1;
  }
  function drawPlayerShip(
    ctx,
    modelName,
    gear,
    time,
    palette = Art.SHIP_PALETTES.default,
    pilotLook = null,
    pilotMood = 'focus'
  ) {
    const m = model(modelName),
      [light, dark] = palette.hull,
      trim = palette.trim,
      hull = gear.hull || 0,
      engine = gear.engine || 0,
      core = gear.core || 0,
      tail = Math.min(...m.hull.map(p => p[0]));
    // Visual Identity round: the ship's DNA (role, tier, build) from the central visual language (scenes/dna-visuals.js)
    const look = window.DnaVisuals ? window.DnaVisuals.shipLook(modelName, gear, mountedShipDna(gear)) : null;
    if (look?.aura) Art.glowCircle(ctx, 0, 0.02, 0.9, look.aura, 0.22 + Math.sin(time * 2.4) * 0.06);
    // --- engines: nozzles + flames (behind the hull) ---
    const nozzles = engine >= 4 ? [...m.nozzles, ...(m.nozzles.length === 1 ? [m.nozzles[0] + 0.12] : [])] : m.nozzles,
      big = engine >= 8 ? 1.3 : 1,
      flicker = 0.85 + Math.sin(time * 34) * 0.08 + Math.sin(time * 13) * 0.07,
      flameLen = (0.2 + Math.min(0.32, engine * 0.03)) * flicker;
    const flame = (x, y, scale) => {
      const g = ctx.createLinearGradient(x - flameLen * scale, 0, x, 0);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.55, palette.engine);
      g.addColorStop(1, '#ffffff');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x - flameLen * scale * 0.5, y, flameLen * scale * 0.6, 0.05 * big * scale, 0, 0, TAU);
      ctx.fill();
      // the build in motion: the weapon's affinity runs through the flame from rare up
      if (look?.trail) {
        ctx.globalAlpha = 0.75;
        ctx.fillStyle = look.trail;
        ctx.beginPath();
        ctx.ellipse(x - flameLen * scale * 0.42, y, flameLen * scale * 0.42, 0.022 * big * scale, 0, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    };
    nozzles.forEach(y => flame(tail + 0.02, y, 1));
    if (m.wingNozzles)
      [
        [-0.6, 0.47],
        [-0.58, -0.43]
      ].forEach(([x, y]) => flame(x, y, 0.6));
    if (engine >= 6) Art.glowCircle(ctx, tail - 0.05, nozzles[0], 0.14 * big, palette.engine, 0.35);
    // --- wings (behind hull); hull upgrades add armour edges ---
    if (look) wingExtension(ctx, m, look, trim, dark);
    m.wings.forEach((w, i) => {
      poly(ctx, w, i ? grad(ctx, -0.5, 0, '#ffffff', trim) : trim);
      if (hull >= 5) {
        ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        ctx.lineWidth = 0.02;
        ctx.beginPath();
        ctx.moveTo(w[1][0], w[1][1]);
        ctx.lineTo(w[2][0], w[2][1]);
        ctx.stroke();
      }
    });
    if (look) {
      // tier: position lights along each wing's outer edge (1 Erprobt · 2 Veteran · 3 Elite), blinking in turn
      m.wings.forEach((w, wi) => {
        for (let i = 0; i < look.tier.lights; i++) {
          const u = 0.25 + i * 0.25,
            x = w[1][0] + (w[2][0] - w[1][0]) * u,
            y = w[1][1] + (w[2][1] - w[1][1]) * u,
            on = Math.sin(time * 4 - i * 1.3 + wi) > -0.2;
          Art.glowCircle(ctx, x, y, 0.035, wi ? '#8ff0b0' : '#ff7a9a', on ? 0.9 : 0.35);
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(x, y, 0.011, 0, TAU);
          ctx.fill();
        }
      });
      // role: its emblem on the bigger wing (the wing's centre)
      const wing = m.wings.reduce((a, b) => (Math.abs(b[1][1]) > Math.abs(a[1][1]) ? b : a)),
        ex = wing.reduce((s2, p) => s2 + p[0], 0) / wing.length,
        ey = wing.reduce((s2, p) => s2 + p[1], 0) / wing.length;
      window.DnaVisuals.drawEmblem(ctx, look.role.emblem, ex, ey, 0.055, look.role.color);
      // P1.2: the player's hull signature (a cosmetic) on the other wing – or on the tail where a model has one wing
      const decal = gear.decal !== undefined ? gear.decal : typeof equippedCosmetic === 'function' ? equippedCosmetic('decal') : null;
      if (decal && window.DnaVisuals.drawDecal) {
        const other = m.wings.find(w => w !== wing),
          dx = other ? other.reduce((s2, p) => s2 + p[0], 0) / other.length : tail + 0.2,
          dy = other ? other.reduce((s2, p) => s2 + p[1], 0) / other.length : -0.1;
        window.DnaVisuals.drawDecal(ctx, decal, dx, dy, 0.05);
      }
    }
    if (m.wingNozzles)
      [
        [-0.6, 0.47],
        [-0.58, -0.43]
      ].forEach(([x, y]) => {
        rr(ctx, x - 0.04, y - 0.04, 0.16, 0.08, 0.04);
        ctx.fillStyle = dark;
        ctx.fill();
      });
    // P1.3 DNA 3.0: engine cowl rings from Veteran; at Elite they pulse with the thrust
    if (look?.tier.rings)
      nozzles.forEach((y, i) => {
        for (let r = 0; r < look.tier.rings; r++) {
          const x = tail + 0.02 - r * 0.05,
            hot = look.tier.rings > 1 ? 0.5 + 0.5 * Math.sin(time * 9 - r - i) : 0;
          ctx.strokeStyle = hot > 0.3 ? palette.engine : look.tier.trim;
          ctx.lineWidth = 0.016;
          ctx.beginPath();
          ctx.ellipse(x, y, 0.018, 0.07 * big, 0, 0, Math.PI * 2);
          ctx.stroke();
          if (hot > 0.6) Art.glowCircle(ctx, x, y, 0.05, palette.engine, 0.35 * hot);
        }
      });
    // nozzle housings
    nozzles.forEach(y => {
      rr(ctx, tail - 0.06, y - 0.055 * big, 0.12, 0.11 * big, 0.04);
      ctx.fillStyle = engine >= 8 ? '#5a6aa0' : '#7f8cc0';
      ctx.fill();
      ctx.fillStyle = palette.engine;
      ctx.fillRect(tail - 0.07, y - 0.035 * big, 0.02, 0.07 * big);
    });
    // P1.3 DNA 3.0: a tail stabilizer from Erprobt (a split tail at Elite), behind the hull
    if (look?.tier.tail) {
      const top = m.hull[1],
        n = look.tier.tail;
      for (let i = 0; i < n; i++) {
        const sy = n > 1 ? (i ? 1 : -1) : -1,
          base = sy < 0 ? top : m.hull[7];
        poly(ctx, [[base[0] + 0.02, base[1]], [base[0] - 0.12, base[1] + sy * 0.16], [base[0] + 0.14, base[1] + sy * 0.02]], i ? trim : dark);
      }
    }
    if (look) nacelle(ctx, m, look, dark, time);
    // --- hull ---
    smoothPath(ctx, m.hull);
    ctx.fillStyle = grad(ctx, -0.25, 0.3, light, dark);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 0.014;
    ctx.stroke();
    // lower shading
    ctx.save();
    smoothPath(ctx, m.hull);
    ctx.clip();
    ctx.fillStyle = 'rgba(40,40,100,0.12)';
    ctx.fillRect(-1, 0.08, 2, 0.4);
    // P1.4: a paint's material (cosmetic, inside the hull only): crystal facets and a glint that runs over them
    if (palette.material === 'crystal') {
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      for (const [x0, x1] of [[-0.62, -0.4], [-0.2, 0.0], [0.22, 0.42]]) {
        ctx.beginPath();
        ctx.moveTo(x0, -0.45);
        ctx.lineTo(x1, -0.45);
        ctx.lineTo(x1 - 0.14, 0.45);
        ctx.lineTo(x0 - 0.14, 0.45);
        ctx.closePath();
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 0.009;
      for (const x of [-0.51, -0.1, 0.32]) {
        ctx.beginPath();
        ctx.moveTo(x, -0.45);
        ctx.lineTo(x - 0.14, 0.45);
        ctx.stroke();
      }
      const gx = -0.95 + ((time * 0.32) % 1.5) * 1.5,
        glint = ctx.createLinearGradient(gx - 0.14, 0, gx + 0.14, 0);
      glint.addColorStop(0, 'rgba(255,255,255,0)');
      glint.addColorStop(0.5, 'rgba(255,255,255,0.65)');
      glint.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glint;
      ctx.beginPath();
      ctx.moveTo(gx - 0.08, -0.45);
      ctx.lineTo(gx + 0.12, -0.45);
      ctx.lineTo(gx - 0.02, 0.45);
      ctx.lineTo(gx - 0.22, 0.45);
      ctx.closePath();
      ctx.fill();
    }
    // panel seams + portholes
    ctx.strokeStyle = 'rgba(80,90,150,0.25)';
    ctx.lineWidth = 0.01;
    [-0.3, 0.05, 0.36].forEach(x => {
      ctx.beginPath();
      ctx.moveTo(x, -0.4);
      ctx.lineTo(x + 0.04, 0.4);
      ctx.stroke();
    });
    if (m.cargo || m.accent === 'stripe')
      [-0.46, -0.38].forEach(x => {
        ctx.fillStyle = 'rgba(160,220,255,0.75)';
        ctx.beginPath();
        ctx.arc(x, -0.04, 0.022, 0, TAU);
        ctx.fill();
      });
    // model accents
    if (m.accent === 'stripe' || m.accent === 'racing') {
      ctx.fillStyle = trim;
      ctx.fillRect(-0.6, 0.06, 1.3, 0.035);
      if (m.accent === 'racing') ctx.fillRect(-0.6, 0.11, 1.3, 0.02);
    }
    if (m.accent === 'spine') {
      ctx.fillStyle = trim;
      ctx.fillRect(-0.5, -0.02, 1.2, 0.03);
    }
    if (m.accent === 'bandana') {
      ctx.fillStyle = '#ff7a8a';
      ctx.fillRect(-0.1, -0.2, 0.08, 0.45);
      for (let i = 0; i < 3; i++) Art.heart(ctx, -0.06, -0.1 + i * 0.12, 0.022, '#ffffff');
    }
    // hull armour stages
    if (hull >= 2)
      for (let i = 0; i < Math.min(5, 1 + Math.floor(hull / 2)); i++) {
        rr(ctx, -0.42 + i * 0.16, 0.1, 0.13, 0.08, 0.025);
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.fill();
        ctx.fillStyle = 'rgba(80,90,150,0.35)';
        ctx.beginPath();
        ctx.arc(-0.4 + i * 0.16, 0.14, 0.01, 0, TAU);
        ctx.fill();
      }
    ctx.restore();
    if (hull >= 5) {
      // dorsal spine fin
      poly(
        ctx,
        [
          [-0.32, m.hull[2][1] + 0.02],
          [-0.14, m.hull[2][1] - 0.12],
          [0.02, m.hull[2][1] + 0.02]
        ],
        trim
      );
    }
    if (hull >= 9) {
      // reinforced nose cap
      const nose = m.hull[4];
      ctx.fillStyle = 'rgba(255,215,122,0.85)';
      ctx.beginPath();
      ctx.ellipse(nose[0] - 0.05, nose[1], 0.06, 0.08, 0, 0, TAU);
      ctx.fill();
    }
    if (hull >= 14 || look?.tier.tier >= 2) {
      ctx.strokeStyle = look?.tier.tier >= 3 ? look.tier.trim : 'rgba(255,215,122,0.9)';
      ctx.lineWidth = look?.tier.tier >= 3 ? 0.018 : 0.012;
      smoothPath(ctx, m.hull);
      ctx.stroke();
    }
    if (look?.tier.pennant) {
      // the Elite pennant: a small banner in the role colour waving from the dorsal edge
      const px = m.hull[2][0] - 0.05,
        py = m.hull[2][1] - 0.02,
        wave = Math.sin(time * 6) * 0.02;
      ctx.strokeStyle = '#d8e6ff';
      ctx.lineWidth = 0.014;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px, py - 0.16);
      ctx.stroke();
      ctx.fillStyle = look.role.color;
      ctx.beginPath();
      ctx.moveTo(px, py - 0.16);
      ctx.quadraticCurveTo(px - 0.08, py - 0.15 + wave, px - 0.15, py - 0.12 + wave);
      ctx.lineTo(px, py - 0.08);
      ctx.closePath();
      ctx.fill();
    }
    if (look) {
      eliteCanards(ctx, m, look, trim);
      dorsalCrest(ctx, m, look, time);
      roleModule(ctx, m, look, trim, dark, time);
    }
    // Pioneer cargo pods + radar dish
    if (m.cargo) {
      [-0.34, -0.12].forEach(x => {
        rr(ctx, x, 0.22, 0.18, 0.12, 0.03);
        ctx.fillStyle = '#ffd77a';
        ctx.fill();
        ctx.strokeStyle = '#c98a2a';
        ctx.lineWidth = 0.01;
        ctx.stroke();
      });
    }
    if (m.accent === 'dish') {
      ctx.strokeStyle = '#d8e6ff';
      ctx.lineWidth = 0.025;
      ctx.beginPath();
      ctx.moveTo(-0.28, -0.2);
      ctx.lineTo(-0.28, -0.36);
      ctx.stroke();
      ctx.fillStyle = '#e8e4fa';
      ctx.beginPath();
      ctx.ellipse(-0.28, -0.38, 0.1, 0.035, -0.3 + Math.sin(time) * 0.2, 0, TAU);
      ctx.fill();
    }
    if (m.accent === 'ring') {
      ctx.strokeStyle = `rgba(143,240,212,${0.35 + Math.sin(time * 3) * 0.1})`;
      ctx.lineWidth = 0.025;
      ctx.beginPath();
      ctx.ellipse(0, 0.02, 0.68, 0.46, 0, 0, TAU);
      ctx.stroke();
    }
    // --- reactor core (window on the side); stronger with core upgrades ---
    const [cx, cy] = m.core,
      beat = 1 + Math.sin(time * 5) * 0.08,
      power = Math.min(1, 0.4 + core * 0.08);
    rr(ctx, cx - 0.08, cy - 0.06, 0.16, 0.12, 0.05);
    ctx.fillStyle = '#2a2f5a';
    ctx.fill();
    Art.glowCircle(ctx, cx, cy, 0.09 + Math.min(0.1, core * 0.015), '#ff9ecb', power);
    Art.heart(ctx, cx, cy + 0.005, 0.045 * beat, '#ff7aa8');
    if (core >= 3) {
      ctx.strokeStyle = 'rgba(255,158,203,0.8)';
      ctx.lineWidth = 0.012;
      ctx.beginPath();
      ctx.arc(cx, cy, 0.075, time * 2, time * 2 + Math.PI * 1.4);
      ctx.stroke();
    }
    if (core >= 6)
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + (i - 1) * 0.6;
        poly(
          ctx,
          [
            [cx + Math.cos(a) * 0.07, cy + Math.sin(a) * 0.07],
            [cx + Math.cos(a - 0.15) * 0.12, cy + Math.sin(a - 0.15) * 0.12],
            [cx + Math.cos(a) * 0.16, cy + Math.sin(a) * 0.16]
          ],
          '#ffd7ec'
        );
      }
    // --- weapons ---
    weaponHardpoints({ ...gear, model: modelName }).forEach(([x, y]) => {
      if (Math.abs(y) > 0.12) {
        const toward = y > 0 ? y - 0.16 : y + 0.12;
        rr(ctx, x - 0.035, Math.min(y, toward), 0.05, Math.abs(y - toward), 0.015);
        ctx.fillStyle = dark;
        ctx.fill();
      }
    });
    drawRefits(ctx, m, gear.refits, time);
    const dna = mountedShipDna(gear);
    weaponHardpoints({ ...gear, model: modelName }).forEach(([x, y]) =>
      dna ? dnaMount(ctx, dna, x, y, gear.weapon || 0, time) : weaponMount(ctx, gear.weaponType, x, y, gear.weapon || 0, time, trim)
    );
    // --- cockpit dome with the pilot kitten (same rig as the HUD portrait) ---
    const [kx, ky0, rx0, ry0] = m.cockpit,
      rx = rx0 * 1.12,
      ry = ry0 * 1.45,
      ky = ky0 + 0.02;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(kx, ky, rx, ry, 0, Math.PI, 0);
    ctx.lineTo(kx + rx, ky + 0.02);
    ctx.lineTo(kx - rx, ky + 0.02);
    ctx.closePath();
    ctx.fillStyle = 'rgba(40,52,110,0.5)';
    ctx.fill();
    ctx.clip();
    if (pilotLook && window.SpaceKittens) {
      ctx.translate(kx + 0.01, ky - ry * 0.42);
      ctx.scale(rx * 1.15, rx * 1.15);
      window.SpaceKittens.drawPortrait(ctx, pilotLook, { mood: pilotMood, t: time, seed: 3 });
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(220,240,255,0.95)';
    ctx.lineWidth = 0.018;
    ctx.beginPath();
    ctx.ellipse(kx, ky, rx, ry, 0, Math.PI, 0);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 0.022;
    ctx.beginPath();
    ctx.arc(kx - rx * 0.3, ky - ry * 0.25, rx * 0.6, Math.PI * 1.15, Math.PI * 1.45);
    ctx.stroke();
    // cockpit rim
    ctx.fillStyle = trim;
    rr(ctx, kx - rx - 0.01, ky + 0.005, rx * 2 + 0.02, 0.03, 0.015);
    ctx.fill();
    // P1.3 DNA 3.0: the cockpit grows with the tier – struts (Erprobt), a HUD visor band (Veteran), an armoured gold rim
    // with an antenna (Elite)
    const canopy = look?.tier.canopy || 0;
    if (canopy >= 1) {
      ctx.strokeStyle = 'rgba(200,214,240,0.9)';
      ctx.lineWidth = 0.012;
      for (const u of [0.35, 0.65]) {
        const ang = Math.PI + u * Math.PI;
        ctx.beginPath();
        ctx.moveTo(kx + Math.cos(ang) * rx, ky + Math.sin(ang) * ry);
        ctx.lineTo(kx + Math.cos(ang) * rx * 0.55, ky + 0.01);
        ctx.stroke();
      }
    }
    if (canopy >= 2) {
      ctx.strokeStyle = 'rgba(143,240,212,0.75)';
      ctx.lineWidth = 0.014;
      ctx.beginPath();
      ctx.ellipse(kx, ky, rx * 0.92, ry * 0.92, 0, Math.PI * 1.12, Math.PI * 1.88);
      ctx.stroke();
    }
    if (canopy >= 3) {
      ctx.strokeStyle = look.tier.trim;
      ctx.lineWidth = 0.022;
      ctx.beginPath();
      ctx.ellipse(kx, ky, rx * 1.04, ry * 1.04, 0, Math.PI, 0);
      ctx.stroke();
      ctx.strokeStyle = '#d8e6ff';
      ctx.lineWidth = 0.01;
      ctx.beginPath();
      ctx.moveTo(kx + rx * 0.4, ky - ry * 0.95);
      ctx.lineTo(kx + rx * 0.62, ky - ry * 1.35);
      ctx.stroke();
      Art.glowCircle(ctx, kx + rx * 0.62, ky - ry * 1.35, 0.018, look.role.color, 0.9);
    }
  }

  // Ship preview image for the workshop: the same renderer, cached per configuration.
  const previewCache = new Map();
  // P1.4: the equipped engine trail shows behind every preview; opts.fx (the Werft's big picture) also freezes one shot
  // leaving the muzzle with the muzzle style, the shot ornament and the impact look's halo
  function shipPreviewURL(modelName, gear, palette, pilotLook, width = 160, height = 96, opts = {}) {
    const eq = slot => (typeof equippedCosmetic === 'function' ? equippedCosmetic(slot) : null),
      looks = [eq('engine'), opts.fx ? eq('muzzle') : '', opts.fx ? eq('shot') : '', opts.fx ? eq('impact') : ''];
    const key = [
      ...looks,
      modelName,
      gear.hull,
      gear.engine,
      gear.core,
      gear.weapon,
      gear.weaponType,
      (d => (d ? d.chassis + ':' + d.affinity + ':' + d.rarity : '-'))(mountedShipDna(gear)),
      (r => (r ? [r.armor || 0, r.shield || 0, r.cooling || 0].join('') : '-'))(gear.refits),
      palette?.trim,
      pilotLook?.id,
      // P1.2: the hull signature changes the picture too
      gear.decal !== undefined ? gear.decal : typeof equippedCosmetic === 'function' ? equippedCosmetic('decal') : null,
      width,
      height
    ].join('|');
    if (previewCache.has(key)) return previewCache.get(key);
    let url = '';
    try {
      const c = document.createElement('canvas');
      c.width = width;
      c.height = height;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (ctx && c.toDataURL) {
        ctx.translate(width * 0.52, height * 0.5);
        const s = Math.min(width / 1.9, height / 1.05);
        ctx.scale(s, s);
        const tailX = Math.min(...model(modelName).hull.map(p => p[0]));
        if (looks[0] && window.CosmeticArt?.TRAILS?.[looks[0]]) window.CosmeticArt.engineTrail(ctx, looks[0], { x: tailX - 0.02, y: 0.02 }, { x: tailX - 0.62, y: 0.02 }, 0.08, 1.2, true);
        drawPlayerShip(ctx, modelName, { ...gear, model: modelName }, 1.2, palette, pilotLook, 'happy');
        if (opts.fx && (looks[1] || looks[2] || looks[3]) && window.DnaVisuals) {
          // the shot, frozen in front of the nose: DNA colour and shape stay, the looks are added on top
          const dna = mountedShipDna(gear),
            wl = window.DnaVisuals.weaponLook(dna || { chassis: 'repeater', affinity: 'kinetic', rarity: 'common' }),
            nose = Math.max(...model(modelName).hull.map(p => p[0])),
            sx = nose + 0.32;
          if (looks[1]) window.DnaVisuals.drawMuzzleOrnament(ctx, nose + 0.06, 0, 0.012, looks[1], 0.25);
          if (looks[3]) window.CosmeticArt?.shotHalo(ctx, window.SpaceKittensForge?.LOOKS?.[looks[3]]?.color, sx, 0, 0.05);
          if (looks[2]) window.CosmeticArt?.shotTrail(ctx, looks[2], sx, 0, 1, 0, 0.035, 1.2, true);
          Art.glowCircle(ctx, sx, 0, 0.06, wl?.color || '#8fe3ff', 0.75);
          ctx.fillStyle = wl?.core || '#ffffff';
          ctx.beginPath();
          ctx.arc(sx, 0, 0.018, 0, TAU);
          ctx.fill();
        }
        url = c.toDataURL('image/png');
      }
    } catch {
      url = '';
    }
    if (previewCache.size > 40) previewCache.delete(previewCache.keys().next().value);
    previewCache.set(key, url);
    return url;
  }

  Object.assign(Art, { drawPlayerShip, weaponHardpoints, shipPreviewURL, SHIP_MODELS: MODELS, weaponMount, dnaMount, DNA_TINT });
})();
