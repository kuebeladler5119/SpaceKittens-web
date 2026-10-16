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
    const count = 1 + Math.min(3, Math.floor((gear.weapon || 0) / 3));
    return model(gear.model).hardpoints.slice(0, count);
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
    };
    nozzles.forEach(y => flame(tail + 0.02, y, 1));
    if (m.wingNozzles)
      [
        [-0.6, 0.47],
        [-0.58, -0.43]
      ].forEach(([x, y]) => flame(x, y, 0.6));
    if (engine >= 6) Art.glowCircle(ctx, tail - 0.05, nozzles[0], 0.14 * big, palette.engine, 0.35);
    // --- wings (behind hull); hull upgrades add armour edges ---
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
    if (m.wingNozzles)
      [
        [-0.6, 0.47],
        [-0.58, -0.43]
      ].forEach(([x, y]) => {
        rr(ctx, x - 0.04, y - 0.04, 0.16, 0.08, 0.04);
        ctx.fillStyle = dark;
        ctx.fill();
      });
    // nozzle housings
    nozzles.forEach(y => {
      rr(ctx, tail - 0.06, y - 0.055 * big, 0.12, 0.11 * big, 0.04);
      ctx.fillStyle = engine >= 8 ? '#5a6aa0' : '#7f8cc0';
      ctx.fill();
      ctx.fillStyle = palette.engine;
      ctx.fillRect(tail - 0.07, y - 0.035 * big, 0.02, 0.07 * big);
    });
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
    if (hull >= 14) {
      ctx.strokeStyle = 'rgba(255,215,122,0.9)';
      ctx.lineWidth = 0.012;
      smoothPath(ctx, m.hull);
      ctx.stroke();
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
  }

  // Ship preview image for the workshop: the same renderer, cached per configuration.
  const previewCache = new Map();
  function shipPreviewURL(modelName, gear, palette, pilotLook, width = 160, height = 96) {
    const key = [
      modelName,
      gear.hull,
      gear.engine,
      gear.core,
      gear.weapon,
      gear.weaponType,
      (d => (d ? d.chassis + ':' + d.affinity : '-'))(mountedShipDna(gear)),
      (r => (r ? [r.armor || 0, r.shield || 0, r.cooling || 0].join('') : '-'))(gear.refits),
      palette?.trim,
      pilotLook?.id,
      width,
      height
    ].join('|');
    if (previewCache.has(key)) return previewCache.get(key);
    let url = '';
    try {
      const c = document.createElement('canvas');
      c.width = width;
      c.height = height;
      const ctx = c.getContext('2d');
      if (ctx && c.toDataURL) {
        ctx.translate(width * 0.52, height * 0.5);
        const s = Math.min(width / 1.9, height / 1.05);
        ctx.scale(s, s);
        drawPlayerShip(ctx, modelName, { ...gear, model: modelName }, 1.2, palette, pilotLook, 'happy');
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
