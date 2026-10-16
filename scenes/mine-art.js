// Deep Core underground art: geological zones, tunnel floors, mining machines (5 stages), the central elevator
// (4 stages), the surface headframe, buffers, the construction frontier and ancient Schnurrnetz ruins.
// Procedural Canvas2D, sizes in kitten units (k). Moving parts move only when the scene says the real stage works.
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const A = () => window.ColonyArt;

  // Geological zones (rock, strata, crystal colours, lamp light, tunnel interior).
  const ZONES = {
    amethyst: { rock: '#4a3a72', rock2: '#3a2c5e', strata: '#5d4a8e', inner: '#2a2148', floor: '#8a6ea8', crystal: ['#c4a3ff', '#9f7bff', '#e2d4ff'], light: '#ffe2a8' },
    geode: { rock: '#3f3566', rock2: '#2d254d', strata: '#55467e', inner: '#221b3c', floor: '#7d6a9e', crystal: ['#8ff0d4', '#ff9ecb', '#ffd77a', '#9fd8ff'], light: '#d9f6ff' },
    // Pyra-9: dark basalt with ember veins; deeper the magma belt
    basalt: { rock: '#3e2f48', rock2: '#2c2236', strata: '#5a3e58', inner: '#20182a', floor: '#7a5a6a', crystal: ['#ff9a3a', '#ffd25a', '#ff6a4a'], light: '#ffcf9a' },
    magma: { rock: '#4a2a3a', rock2: '#341e2a', strata: '#6a3a3a', inner: '#24121c', floor: '#8a5a5a', crystal: ['#ffb03a', '#ff6a3a', '#fff0a0'], light: '#ffb38a' },
    // Mekhanos: blue-gray rock with brass strata and teal Präzisionserz studs; deeper the (future) clockwork core
    brass: { rock: '#4a5272', rock2: '#373d5c', strata: '#8a7a5a', inner: '#20253e', floor: '#9a8e70', crystal: ['#5fe0d0', '#f3cf7a', '#9ff0e4'], light: '#ffe6b0' },
    clockwork: { rock: '#3e4466', rock2: '#2c3150', strata: '#6a5e48', inner: '#1a1e36', floor: '#7a7060', crystal: ['#f3cf7a', '#5fe0d0'], light: '#d9fff8' },
    // the sealed (later reactivated) machine core: dark steel with teal conduits
    machinecore: { rock: '#2e3654', rock2: '#222842', strata: '#46506e', inner: '#141a30', floor: '#5e6a88', crystal: ['#5fe0d0', '#9ff0e4', '#f3cf7a'], light: '#c8fff4' },
    // Viridia Bloom: dark loam with bark-brown strata and mint/pink spore crystals; deeper the warm Herzwurzel
    roots: { rock: '#3a3a4e', rock2: '#2a2c3c', strata: '#5a4a46', inner: '#18242a', floor: '#6a5a4e', crystal: ['#8ff0d4', '#ff9ecb', '#bfffe6'], light: '#d8ffe8' },
    heartroot: { rock: '#3e3044', rock2: '#2c2232', strata: '#6a4a46', inner: '#221a24', floor: '#7a5e50', crystal: ['#ffd77a', '#8ff0d4', '#ff9ecb'], light: '#ffe9b8' },
    ice: { rock: '#5d88bb', rock2: '#46709f', strata: '#7aa6d4', inner: '#2c4f7a', floor: '#bfe3f7', crystal: ['#8ff0d4', '#bff4ff', '#e8fbff'], light: '#e6fbff' },
    frost: { rock: '#3d6597', rock2: '#2c4f7c', strata: '#5a86b8', inner: '#1f3a60', floor: '#a9d6f2', crystal: ['#e8fbff', '#9fe8ff', '#c4f0ff'], light: '#d0f4ff' },
    // Beta 1.4 M2 (Orion 7–14): rusty iron-red industrial depths with warm lamps, then cool blue-green caverns
    industrial: { rock: '#4a3a48', rock2: '#36293a', strata: '#7a5848', inner: '#1e1724', floor: '#9a7a62', crystal: ['#ffb35a', '#c4a3ff', '#ffd77a'], light: '#ffd6a0' },
    caverns: { rock: '#2f4058', rock2: '#223046', strata: '#3f6070', inner: '#121e2e', floor: '#5a8094', crystal: ['#8ff0d4', '#9fd8ff', '#c4a3ff', '#e8fbff'], light: '#c8f6ff' },
    future: { rock: '#2a2442', rock2: '#1e1a32', strata: '#342c52', inner: '#151226', floor: '#3a3358', crystal: ['#5a5480'], light: '#8f8ab8' }
  };
  function zone(id) {
    return ZONES[id] || ZONES.amethyst;
  }
  // Deterministic noise for decorations (no Math.random in static layers → caches stay stable).
  function rand(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  // ----- static layers (cached by the scene) -----
  // A rock band of one floor with its tunnel cavity. (0,0) = top-left of the floor slot, w × fh.
  function floorBackground(ctx, w, fh, k, o) {
    const { rr, fillRR, poly, line, crystal } = A();
    const z = zone(o.zone),
      r = rand(o.seed || 1);
    // rock with strata
    ctx.fillStyle = z.rock;
    ctx.fillRect(0, 0, w, fh);
    for (let i = 0; i < 4; i++) {
      const y = (0.12 + i * 0.27) * fh;
      ctx.fillStyle = i % 2 ? z.rock2 : z.strata;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= w; x += 0.8 * k) ctx.lineTo(x, y + Math.sin(x * 0.03 + i * 2 + o.seed) * 0.12 * k);
      ctx.lineTo(w, y + 0.2 * k);
      ctx.lineTo(0, y + 0.25 * k);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // pebbles
    for (let i = 0; i < w / k; i++) {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.ellipse(r() * w, r() * fh, (0.05 + r() * 0.08) * k, (0.03 + r() * 0.05) * k, 0, 0, TAU);
      ctx.fill();
    }
    if (o.zone === 'roots' || o.zone === 'heartroot') {
      ctx.strokeStyle = o.zone === 'heartroot' ? 'rgba(160,110,90,0.55)' : 'rgba(110,84,70,0.55)';
      ctx.lineCap = 'round';
      for (let i = 0; i < w / (2.2 * k); i++) {
        const rx = r() * w;
        ctx.lineWidth = (0.06 + r() * 0.06) * k;
        ctx.beginPath();
        ctx.moveTo(rx, 0);
        ctx.quadraticCurveTo(rx + (r() - 0.5) * 1.2 * k, fh * 0.2, rx + (r() - 0.5) * 0.8 * k, fh * (0.3 + r() * 0.12));
        ctx.stroke();
      }
    }
    if (o.locked) return;
    // tunnel cavity
    const x0 = o.tunnelX0,
      x1 = w - 0.18 * k,
      top = 0.42 * fh,
      bottom = fh - 0.32 * k;
    rr(ctx, x0, top, x1 - x0, bottom - top, 0.55 * k);
    const g = ctx.createLinearGradient(0, top, 0, bottom);
    g.addColorStop(0, shade(z.inner, 1.15));
    g.addColorStop(0.7, shade(z.inner, 1.45));
    g.addColorStop(1, shade(z.inner, 1.7));
    ctx.fillStyle = g;
    ctx.fill();
    // back wall texture: veins + embedded crystals
    ctx.save();
    rr(ctx, x0, top, x1 - x0, bottom - top, 0.55 * k);
    ctx.clip();
    for (let i = 0; i < (x1 - x0) / k; i++) {
      const cx = x0 + r() * (x1 - x0),
        cy = top + (0.15 + r() * 0.5) * (bottom - top);
      ctx.globalAlpha = 0.55;
      crystal(ctx, cx, cy, (0.12 + r() * 0.16) * k, z.crystal[Math.floor(r() * z.crystal.length)], (r() - 0.5) * 0.8);
    }
    ctx.globalAlpha = 1;
    if (o.zone === 'geode') {
      // a large open druse in the back wall: the reason this floor exists
      const gx = x1 - 2.6 * k,
        gy = top + 0.55 * (bottom - top);
      ctx.fillStyle = 'rgba(10,8,30,0.55)';
      ctx.beginPath();
      ctx.ellipse(gx, gy, 0.95 * k, 0.6 * k, 0, 0, TAU);
      ctx.fill();
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU;
        crystal(ctx, gx + Math.cos(a) * 0.62 * k, gy + Math.sin(a) * 0.36 * k, (0.2 + (i % 3) * 0.07) * k, z.crystal[i % z.crystal.length], a + Math.PI / 2);
      }
    }
    ctx.restore();
    // platform
    fillRR(ctx, x0 - 0.05 * k, bottom - 0.22 * k, x1 - x0 + 0.1 * k, 0.26 * k, 0.08 * k, z.floor);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let x = x0; x < x1; x += 0.55 * k) ctx.fillRect(x, bottom - 0.22 * k, 0.03 * k, 0.26 * k);
    // support beams (behind kittens; only at the ends and every ~3.5k so they never hide a worker)
    const beam = o.zone === 'ice' || o.zone === 'frost' ? '#d8eef8' : '#a07a52',
      beamDark = o.zone === 'ice' || o.zone === 'frost' ? '#9cc2dc' : '#7a5636';
    for (let x = x0 + 0.25 * k; x < x1 - 0.2 * k; x += 3.6 * k) {
      line(ctx, x, top + 0.25 * k, x, bottom - 0.2 * k, 0.12 * k, beam);
      line(ctx, x + 0.05 * k, top + 0.25 * k, x + 0.05 * k, bottom - 0.2 * k, 0.04 * k, beamDark);
    }
    line(ctx, x0 + 0.2 * k, top + 0.28 * k, x1 - 0.2 * k, top + 0.28 * k, 0.1 * k, beam);
    // ceiling cable
    ctx.strokeStyle = '#1c1a30';
    ctx.lineWidth = 0.035 * k;
    ctx.beginPath();
    ctx.moveTo(x0 + 0.3 * k, top + 0.42 * k);
    for (let x = x0 + 0.3 * k; x < x1; x += 1.8 * k) ctx.quadraticCurveTo(x + 0.9 * k, top + 0.62 * k, x + 1.8 * k, top + 0.42 * k);
    ctx.stroke();
    if (o.zone === 'ice' || o.zone === 'frost') {
      // icicles from the tunnel roof and frosted rims
      for (let x = x0 + 0.4 * k; x < x1 - 0.3 * k; x += 0.42 * k) {
        const len = (0.12 + ((x * 7) % 5) * 0.06) * k;
        poly(ctx, [[x - 0.06 * k, top + 0.05 * k], [x + 0.06 * k, top + 0.05 * k], [x, top + 0.05 * k + len]], 'rgba(230,250,255,0.85)');
      }
    }
  }
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16),
      c = v => Math.max(0, Math.min(255, Math.round(v * f)));
    return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => c(v).toString(16).padStart(2, '0')).join('');
  }
  // Surface band: sky slice, ground and the shaft opening (headframe drawn dynamically).
  function surfaceBackground(ctx, w, sh, k, o) {
    const sky = ctx.createLinearGradient(0, 0, 0, sh);
    const cold = o.zone === 'ice' || o.zone === 'frost',
      hot = o.zone === 'basalt' || o.zone === 'magma',
      mech = o.zone === 'brass' || o.zone === 'clockwork' || o.zone === 'machinecore',
      green = o.zone === 'roots' || o.zone === 'heartroot';
    sky.addColorStop(0, cold ? '#3a6aa8' : hot ? '#4a1e3e' : mech ? '#1e2650' : green ? '#173c48' : '#3a2f7a');
    sky.addColorStop(1, cold ? '#9fd0f0' : hot ? '#d0706a' : mech ? '#6aa8b8' : green ? '#6ac0a0' : '#8f78d8');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, sh);
    for (let i = 0; i < 18; i++) {
      ctx.fillStyle = 'rgba(255,255,255,' + (0.3 + (i % 3) * 0.2) + ')';
      ctx.fillRect((i * 97.3) % w, ((i * 41.7) % (sh * 0.45)) + 2, 1.5, 1.5);
    }
    const ground = o.groundY;
    ctx.fillStyle = cold ? '#e8f6ff' : hot ? '#6a4a62' : mech ? '#8a94b8' : green ? '#5aa07a' : '#b9a6ec';
    ctx.fillRect(0, ground, w, sh - ground);
    ctx.fillStyle = cold ? '#c2e2f6' : hot ? '#8a5a6a' : mech ? '#d9a54a' : green ? '#8fe0a8' : '#9a86d6';
    ctx.fillRect(0, ground, w, 0.14 * k);
  }

  // ----- Living Worlds 2.0: the mine's top is the planet's real outdoors -----
  // The same sky, planet, horizon, skyline, ground colours and props as the colony scene (Art.THEMES + PlanetLayouts +
  // ColonyArt/PyraArt/MekhanosArt/ViridiaArt), then a geological cut from the ground down to the first shaft: topsoil,
  // strata that blend into the first zone's rock, buried stones, and the concrete collar and steel supports of the shaft.
  // Static (cached by the scene). o: { planet, zone, groundY, shaftX, shaftW }.
  function outdoor(ctx, w, sh, k, o) {
    const Art = window.NebulaArt,
      CAx = window.ColonyArt,
      Layouts = window.PlanetLayouts,
      planet = o.planet || 'crystal',
      theme = (Art && Art.THEMES[planet]) || (Art && Art.THEMES.crystal),
      lay = Layouts ? Layouts.layoutFor(planet) : null,
      ground = o.groundY,
      zz = zone(o.zone);
    if (!theme) return surfaceBackground(ctx, w, sh, k, o);
    // sky with its stars and the planet's moon/planet, exactly the colony's palette
    const bg = Art.spaceBackground('mine-sky-' + planet, Math.ceil(w), Math.ceil(ground + 2), theme.sky, 4041 + planet.length * 13);
    ctx.drawImage(bg, 0, 0);
    if (lay?.sky?.aurora && CAx?.aurora) CAx.aurora(ctx, w, ground, 0.8);
    if (lay?.sky?.planet) Art.drawPlanet(ctx, planet, w * 0.78, ground * 0.22, Math.min(w, ground) * 0.11, 0.2);
    // distant ridges and the world's skyline (same functions and colours as the colony's parallax layers)
    const ridge = (base, amp, freq, seed, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, ground + 1);
      for (let x = 0; x <= w + 16; x += 16) ctx.lineTo(x, base - Math.sin(x * freq + seed) * amp - Math.sin(x * freq * 2.7 + seed * 2) * amp * 0.35);
      ctx.lineTo(w + 16, ground + 1);
      ctx.closePath();
      ctx.fill();
    };
    ridge(ground - 1.9 * k, 0.55 * k, 0.012, 1, theme.surface[1][1] + 'aa');
    const sk = lay?.skyline;
    if (sk === 'volcanoes' && window.PyraArt) window.PyraArt.volcanoSkyline(ctx, w, ground - 1.35 * k, k, 7, false, 0.5);
    else if (sk === 'factories' && window.MekhanosArt) window.MekhanosArt.factorySkyline(ctx, w, ground - 1.2 * k, k, 11, 0.5);
    else if (sk === 'blooms' && window.ViridiaArt) window.ViridiaArt.bloomSkyline(ctx, w, ground - 1.1 * k, k, 13, 0.5, false);
    ridge(ground - 0.95 * k, 0.4 * k, 0.018, 2, theme.surface[2][1] + 'dd');
    if (sk && CAx?.skyline && sk !== 'volcanoes' && sk !== 'factories' && sk !== 'blooms') CAx.skyline(ctx, w, ground - 1.0 * k, k * 0.7, sk, theme.surface[1][1] + 'cc', 1 + planet.length * 97);
    // the ground: the colony's ground colours (a layout may set its own, e.g. Mekhanos' steel deck)
    const g = ctx.createLinearGradient(0, ground - 0.3 * k, 0, ground + 0.7 * k);
    g.addColorStop(0, lay?.ground?.[0] || theme.surface[3][1]);
    g.addColorStop(1, lay?.ground?.[1] || theme.surface[1][1]);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, ground + 0.7 * k);
    for (let x = 0; x <= w + 12; x += 12) ctx.lineTo(x, ground - Math.sin(x * 0.02) * 0.04 * k);
    ctx.lineTo(w + 12, ground + 0.7 * k);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(0, ground - 0.02 * k, w, 0.04 * k);
    // a few of the world's props on the ground, away from the shaft, the pile and the booth
    const kind = lay?.decor?.kind || 'crystals',
      free = [o.shaftX + 6.6 * k, o.shaftX + 8.6 * k, w - 0.8 * k].filter(x => x < w - 0.4 * k);
    free.forEach((x, i) => {
      const s = (0.55 + (i % 2) * 0.2) * k;
      if (kind === 'machine' && window.MekhanosArt) window.MekhanosArt.prop(ctx, x, ground + 0.05 * k, s, 0.5, i);
      else if (kind === 'volcanic' && window.PyraArt) window.PyraArt.prop(ctx, x, ground + 0.05 * k, s, 0.5, i, false);
      else if (kind === 'verdant' && window.ViridiaArt) window.ViridiaArt.prop(ctx, x, ground + 0.05 * k, s, 0.5, i, false);
      else CAx?.prop?.(ctx, kind, x, ground + 0.05 * k, s, 0.5, i, theme);
    });
    // ----- the geological cut: from the outdoor ground down to the first shaft -----
    const top = ground + 0.7 * k,
      depth = sh - top;
    const soil = ctx.createLinearGradient(0, top, 0, sh);
    soil.addColorStop(0, shade(lay?.ground?.[1] || theme.surface[1][1], 0.62));
    soil.addColorStop(0.45, zz.strata);
    soil.addColorStop(1, zz.rock);
    ctx.fillStyle = soil;
    ctx.fillRect(0, top, w, depth);
    // strata lines and buried stones
    const r = rand(77 + planet.length);
    for (let i = 1; i <= 3; i++) {
      const y = top + (depth * i) / 4;
      ctx.strokeStyle = 'rgba(0,0,0,' + (0.12 + i * 0.04) + ')';
      ctx.lineWidth = Math.max(1, 0.05 * k);
      ctx.beginPath();
      for (let x = 0; x <= w + 10; x += 10) ctx.lineTo(x, y + Math.sin(x * 0.03 + i) * 0.12 * k);
      ctx.stroke();
    }
    for (let i = 0; i < Math.round(w / (1.1 * k)); i++) {
      const x = r() * w,
        y = top + 0.2 * k + r() * (depth - 0.4 * k),
        rr = (0.08 + r() * 0.16) * k;
      if (Math.abs(x - o.shaftX) < o.shaftW * 0.8 + rr) continue;
      ctx.fillStyle = r() > 0.5 ? zz.rock2 : shade(zz.strata, 1.15);
      ctx.beginPath();
      ctx.ellipse(x, y, rr * 1.4, rr, r() * 3, 0, Math.PI * 2);
      ctx.fill();
      if (r() > 0.82) {
        ctx.fillStyle = zz.crystal[i % zz.crystal.length];
        ctx.beginPath();
        ctx.moveTo(x, y - rr * 1.6);
        ctx.lineTo(x + rr * 0.5, y);
        ctx.lineTo(x - rr * 0.5, y);
        ctx.closePath();
        ctx.fill();
      }
    }
    // the shaft collar: concrete blocks around the opening, steel supports down through the cut
    const sx = o.shaftX,
      half = o.shaftW / 2;
    // foundation pad on the ground, footings into the cut
    ctx.fillStyle = '#7a7fa4';
    ctx.fillRect(sx - half - 0.75 * k, ground - 0.16 * k, o.shaftW + 1.5 * k, 0.26 * k);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(sx - half - 0.75 * k, ground - 0.16 * k, o.shaftW + 1.5 * k, 0.05 * k);
    ctx.fillStyle = '#5d6288';
    ctx.fillRect(sx - half - 0.62 * k, ground + 0.1 * k, 0.4 * k, 0.75 * k);
    ctx.fillRect(sx + half + 0.22 * k, ground + 0.1 * k, 0.4 * k, 0.75 * k);
    ctx.strokeStyle = '#4c5174';
    ctx.lineWidth = Math.max(1, 0.06 * k);
    for (let y = ground + 0.95 * k; y < sh; y += 0.7 * k) {
      ctx.beginPath();
      ctx.moveTo(sx - half - 0.08 * k, y);
      ctx.lineTo(sx - half - 0.35 * k, y + 0.35 * k);
      ctx.moveTo(sx + half + 0.08 * k, y);
      ctx.lineTo(sx + half + 0.35 * k, y + 0.35 * k);
      ctx.stroke();
    }
    ctx.fillStyle = '#4c5174';
    ctx.fillRect(sx - half - 0.1 * k, ground + 0.8 * k, 0.1 * k, depth + 0.7 * k - 0.8 * k);
    ctx.fillRect(sx + half, ground + 0.8 * k, 0.1 * k, depth + 0.7 * k - 0.8 * k);
  }

  // ----- dynamic parts -----
  // Buffer at the loading point: crystal heap growing with the real stock; crates from stage 3.
  function buffer(ctx, x, y, k, ratio, z, stage) {
    const { crate, crystal, poly } = A();
    const zz = zone(z),
      fill = Math.max(0, Math.min(1, ratio));
    if (stage >= 3) crate(ctx, x - 0.55 * k, y, 0.42 * k, '#8a6ea8', '#5d4a7e');
    if (fill > 0.01) {
      const hw = (0.35 + 0.5 * fill) * k,
        hh = (0.15 + 0.55 * fill) * k;
      poly(ctx, [[x - hw, y], [x - hw * 0.4, y - hh], [x + hw * 0.4, y - hh * 1.05], [x + hw, y]], shade(zz.rock2, 1.3));
      const n = 2 + Math.round(fill * 5);
      for (let i = 0; i < n; i++) crystal(ctx, x - hw * 0.6 + (i / Math.max(1, n - 1)) * hw * 1.2, y - hh * (0.6 + ((i * 37) % 10) / 25), (0.12 + fill * 0.08) * k, zz.crystal[i % zz.crystal.length], (i % 3) * 0.3 - 0.3);
    }
    // fill gauge
    const gx = x - 0.45 * k,
      gy = y + 0.08 * k;
    A().fillRR(ctx, gx, gy, 0.9 * k, 0.1 * k, 0.05 * k, 'rgba(0,0,0,0.35)');
    A().fillRR(ctx, gx, gy, 0.9 * k * fill, 0.1 * k, 0.05 * k, fill > 0.92 ? '#ff8f8f' : '#8ff0d4');
  }
  // Mining machine at the rock face (faces left, digs into the right wall). Stages: 1 hand tools, 2 powered drill,
  // 3 industrial drill + control station, 4 heavy excavator + conveyor, 5 crystal extraction platform.
  function machine(ctx, x, y, k, o) {
    const { fillRR, poly, line, box, gear, glow, hazard, drillBit, conveyor } = A();
    const t = o.time,
      on = o.working,
      st = o.stage,
      zz = zone(o.zone),
      spin = on ? t * 9 : 0;
    if (o.look && (st >= 2 || ['resonance', 'clockwork', 'machinecore'].includes(o.look))) {
      const rig = lookRig(ctx, x, y, k, o);
      if (rig) return rig;
    }
    // crystal vein in the rock face behind the machine
    for (let i = 0; i < 5; i++) A().crystal(ctx, x + (0.9 + (i % 2) * 0.25) * k, y - (0.3 + i * 0.36) * k, (0.18 + (i % 3) * 0.06) * k, zz.crystal[i % zz.crystal.length], 0.4 - (i % 2) * 0.8);
    if (st <= 1) {
      // hand stage: timber prop + basket
      line(ctx, x + 0.6 * k, y, x + 0.6 * k, y - 1.7 * k, 0.12 * k, '#a07a52');
      line(ctx, x + 0.2 * k, y - 1.7 * k, x + 1 * k, y - 1.7 * k, 0.1 * k, '#a07a52');
      fillRR(ctx, x - 0.75 * k, y - 0.32 * k, 0.5 * k, 0.32 * k, 0.08 * k, '#c99a6a');
      line(ctx, x - 0.75 * k, y - 0.22 * k, x - 0.25 * k, y - 0.22 * k, 0.03 * k, '#9a6e48');
      return { x0: x - 1 * k, y0: y - 1.9 * k, x1: x + 1.2 * k, y1: y };
    }
    if (st === 2) {
      // tripod drill with motor box and cable
      line(ctx, x - 0.4 * k, y, x + 0.1 * k, y - 1.3 * k, 0.07 * k, '#6f7da8');
      line(ctx, x + 0.4 * k, y, x + 0.1 * k, y - 1.3 * k, 0.07 * k, '#6f7da8');
      fillRR(ctx, x - 0.5 * k, y - 1.55 * k, 0.75 * k, 0.42 * k, 0.08 * k, '#ffcc33');
      hazard(ctx, x - 0.5 * k, y - 1.2 * k, 0.75 * k, 0.07 * k);
      ctx.save();
      ctx.translate(x + 0.32 * k, y - 1.32 * k);
      ctx.rotate(-Math.PI / 2);
      drillBit(ctx, 0, 0, k * 0.9, spin);
      ctx.restore();
      glow(ctx, x - 0.12 * k, y - 1.35 * k, 0.12 * k, on ? '#8ff0d4' : '#5a5f8a', 0.9);
      return { x0: x - 0.9 * k, y0: y - 1.9 * k, x1: x + 1.2 * k, y1: y };
    }
    // stages 3+: tracked rig
    const big = st >= 4 ? 1.25 : 1;
    fillRR(ctx, x - 1.1 * k * big, y - 0.32 * k, 1.9 * k * big, 0.32 * k, 0.16 * k, '#2f2f5a');
    for (let i = 0; i < 4; i++) gear(ctx, x - 0.9 * k * big + i * 0.5 * k * big, y - 0.16 * k, 0.09 * k, spin * 0.3, '#6f7da8');
    box(ctx, x - 0.25 * k * big, y - 0.3 * k, 1.3 * k * big, 0.85 * k * big, 0.3 * k, st >= 5 ? '#4f5f9e' : '#ffb84a', st >= 5 ? '#7f8fd0' : '#ffd47a', st >= 5 ? '#3a4880' : '#d98f2a');
    hazard(ctx, x - 0.9 * k * big, y - 0.42 * k, 1.3 * k * big, 0.08 * k);
    // arm + cutter head into the rock face
    const ax = x + 0.35 * k * big,
      ay = y - 0.75 * k * big;
    line(ctx, ax, ay, ax + 0.75 * k, ay - 0.35 * k, 0.16 * k, '#6f7da8');
    if (st >= 4) {
      gear(ctx, ax + 0.85 * k, ay - 0.4 * k, 0.24 * k, spin * 0.6, '#c9d2ea');
      glow(ctx, ax + 0.85 * k, ay - 0.4 * k, 0.3 * k, zz.light, on ? 0.35 : 0);
      // conveyor from the machine to the buffer
      conveyor(ctx, x - 1.1 * k * big, y - 0.75 * k, o.bufferX + 0.6 * k, y - 0.45 * k, k * 0.8, on, t, zz.crystal[0]);
    } else {
      ctx.save();
      ctx.translate(ax + 0.75 * k, ay - 0.35 * k);
      ctx.rotate(-Math.PI / 2 - 0.4);
      drillBit(ctx, 0, 0, k, spin);
      ctx.restore();
    }
    // cab / control station with screen
    fillRR(ctx, x - 0.8 * k * big, y - 1.45 * k * big, 0.55 * k, 0.45 * k, 0.08 * k, '#2f2f5a');
    fillRR(ctx, x - 0.74 * k * big, y - 1.4 * k * big, 0.43 * k, 0.28 * k, 0.05 * k, on ? '#8ff0d4' : '#4a4f86');
    if (on) for (let i = 0; i < 3; i++) line(ctx, x - 0.7 * k * big, y - (1.33 - i * 0.08) * k * big, x - (0.7 - 0.12 - ((t * 2 + i) % 1) * 0.2) * k * big, y - (1.33 - i * 0.08) * k * big, 0.02 * k, '#24224a');
    if (st >= 5) {
      // extraction platform: twin laser emitters + glowing core
      line(ctx, x - 0.2 * k, y - 1.3 * k * big, x + 0.2 * k, y - 2.05 * k, 0.08 * k, '#c9d2ea');
      fillRR(ctx, x + 0.05 * k, y - 2.25 * k, 0.5 * k, 0.24 * k, 0.08 * k, '#4f5f9e');
      glow(ctx, x + 0.3 * k, y - 2.13 * k, 0.28 * k, '#c4a3ff', on ? 0.8 : 0.2);
      if (on) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        line(ctx, x + 0.5 * k, y - 2.13 * k, x + 1.05 * k, y - (1.3 + Math.sin(t * 3) * 0.3) * k, 0.05 * k, '#ff9ecb');
        line(ctx, x + 0.5 * k, y - 2.1 * k, x + 1.0 * k, y - (0.7 + Math.cos(t * 3) * 0.2) * k, 0.04 * k, '#8ff0d4');
        ctx.restore();
      }
      poly(ctx, [[x - 1.3 * k, y], [x - 1.2 * k, y - 0.12 * k], [x + 1.25 * k, y - 0.12 * k], [x + 1.35 * k, y]], '#7f86b8');
    }
    glow(ctx, x - 0.95 * k * big, y - 1.55 * k * big, 0.1 * k, on && Math.sin(t * 5) > 0 ? '#ff8f8f' : '#ffe9a8', 0.9);
    return { x0: x - 1.4 * k * big, y0: y - 2.3 * k, x1: x + 1.3 * k, y1: y };
  }
  // Manager workstation (desk + lamp + clipboard board) — the manager kitten stands in front of it.
  function station(ctx, x, y, k, o) {
    const { fillRR, line, glow } = A();
    fillRR(ctx, x - 0.45 * k, y - 0.62 * k, 0.9 * k, 0.12 * k, 0.04 * k, '#c99a6a');
    line(ctx, x - 0.38 * k, y - 0.5 * k, x - 0.38 * k, y, 0.06 * k, '#9a6e48');
    line(ctx, x + 0.38 * k, y - 0.5 * k, x + 0.38 * k, y, 0.06 * k, '#9a6e48');
    fillRR(ctx, x - 0.2 * k, y - 0.98 * k, 0.4 * k, 0.32 * k, 0.05 * k, '#2f2f5a');
    fillRR(ctx, x - 0.16 * k, y - 0.94 * k, 0.32 * k, 0.22 * k, 0.04 * k, o.on ? '#8ff0d4' : '#4a4f86');
    glow(ctx, x, y - 0.83 * k, 0.4 * k, '#8ff0d4', o.on ? 0.25 : 0);
  }
  // Wall lamp with a soft cone.
  function wallLamp(ctx, x, y, k, color, t, on = true) {
    const { fillRR, glow } = A();
    fillRR(ctx, x - 0.1 * k, y - 0.08 * k, 0.2 * k, 0.16 * k, 0.05 * k, '#2f2f5a');
    if (!on) return;
    glow(ctx, x, y + 0.05 * k, 0.75 * k, color, 0.28 + Math.sin(t * 2 + x) * 0.03);
    glow(ctx, x, y, 0.12 * k, '#ffffff', 0.9);
  }

  // ----- elevator -----
  // The shaft column from the surface down to the deepest floor (rails + cable). Stage: 1–4 timber/steel lift,
  // 5–14 caged lift with lights, 15–29 enclosed sci-fi cargo lift, 30+ twin-deck industrial lift with counterweight.
  function elevatorStage(level) {
    return level >= 30 ? 4 : level >= 15 ? 3 : level >= 5 ? 2 : 1;
  }
  function shaftColumn(ctx, x, top, bottom, k, stage, t) {
    const { line, fillRR, glow } = A();
    const half = 0.78 * k;
    ctx.fillStyle = 'rgba(10,8,24,0.55)';
    ctx.fillRect(x - half, top, half * 2, bottom - top);
    const rail = stage >= 3 ? '#9fd8ff' : stage === 2 ? '#c9d2ea' : '#a07a52';
    line(ctx, x - half + 0.1 * k, top, x - half + 0.1 * k, bottom, 0.1 * k, rail);
    line(ctx, x + half - 0.1 * k, top, x + half - 0.1 * k, bottom, 0.1 * k, rail);
    for (let y = top + 0.4 * k; y < bottom; y += 0.9 * k) line(ctx, x - half + 0.1 * k, y, x + half - 0.1 * k, y + (stage === 1 ? 0.25 * k : 0), 0.04 * k, stage === 1 ? '#7a5636' : '#6f7da8');
    if (stage >= 3)
      for (let y = top + 0.6 * k; y < bottom; y += 1.8 * k) {
        glow(ctx, x - half + 0.1 * k, y, 0.14 * k, '#9fd8ff', 0.5 + Math.sin(t * 3 + y) * 0.2);
        glow(ctx, x + half - 0.1 * k, y + 0.9 * k, 0.14 * k, '#9fd8ff', 0.5 + Math.cos(t * 3 + y) * 0.2);
      }
    if (stage >= 4) fillRR(ctx, x + half - 0.32 * k, top + 0.3 * k, 0.16 * k, bottom - top - 0.6 * k, 0.05 * k, 'rgba(255,215,122,0.18)');
  }
  // Cabin at (x, y = cabin floor). load 0..1 = real cargo ratio.
  function cabin(ctx, x, y, k, stage, load, t, moving, cwY, emberShare, tint, tier = 0, topY = null) {
    const { line, fillRR, crate, glow, poly } = A();
    const w = (stage >= 4 ? 1.35 : stage >= 2 ? 1.2 : 1.05) * k,
      h = (stage >= 3 ? 1.15 : 1) * k;
    // the hoist cable runs up to the headframe's sheave (Living Worlds 2.0: the sky above is open now)
    line(ctx, x, y - h - 0.1 * k, x, topY ?? y - h - 60 * k, 0.04 * k, '#1c1a30');
    if (stage >= 4 && Number.isFinite(cwY)) fillRR(ctx, x + 0.45 * k, cwY, 0.18 * k, 0.6 * k, 0.04 * k, '#ffd77a');
    if (stage === 1) {
      // small open lift: light back panel + yellow frame so it reads against the wooden shaft beams
      fillRR(ctx, x - w / 2, y - h, w, h, 0.08 * k, 'rgba(255,233,168,0.22)');
      fillRR(ctx, x - w / 2, y - 0.14 * k, w, 0.14 * k, 0.04 * k, '#ffcc33');
      A().hazard(ctx, x - w / 2, y - 0.14 * k, w, 0.06 * k);
      line(ctx, x - w / 2 + 0.05 * k, y - 0.1 * k, x - w / 2 + 0.05 * k, y - h, 0.07 * k, '#ffcc66');
      line(ctx, x + w / 2 - 0.05 * k, y - 0.1 * k, x + w / 2 - 0.05 * k, y - h, 0.07 * k, '#ffcc66');
      line(ctx, x - w / 2, y - h, x + w / 2, y - h, 0.09 * k, '#ffcc66');
      line(ctx, x - w / 2, y - 0.55 * k, x + w / 2, y - 0.55 * k, 0.04 * k, '#e8b04a');
    } else {
      fillRR(ctx, x - w / 2, y - h, w, h, 0.12 * k, stage >= 3 ? 'rgba(60,80,150,0.9)' : 'rgba(80,90,140,0.55)');
      ctx.strokeStyle = stage >= 3 ? '#9fd8ff' : '#c9d2ea';
      ctx.lineWidth = 0.06 * k;
      A().rr(ctx, x - w / 2, y - h, w, h, 0.12 * k);
      ctx.stroke();
      if (stage === 2) for (let i = 1; i < 4; i++) line(ctx, x - w / 2 + (i * w) / 4, y - h, x - w / 2 + (i * w) / 4, y, 0.03 * k, '#c9d2ea');
      fillRR(ctx, x - w / 2, y - 0.14 * k, w, 0.14 * k, 0.04 * k, '#6f7da8');
      glow(ctx, x, y - h + 0.1 * k, 0.25 * k, stage >= 3 ? '#9fd8ff' : '#ffe9a8', moving ? 0.9 : 0.5);
      if (stage >= 3) poly(ctx, [[x - w / 2 + 0.1 * k, y - h + 0.25 * k], [x - w / 2 + 0.3 * k, y - h + 0.25 * k], [x - w / 2 + 0.1 * k, y - h + 0.6 * k]], 'rgba(255,255,255,0.35)');
    }
    // Beta 1.5 cabin tiers: a reinforced roof beam with one rivet light per tier (gold up to 5, then cyan for 6–10)
    if (tier > 0) {
      fillRR(ctx, x - w / 2 - 0.06 * k, y - h - 0.16 * k, w + 0.12 * k, 0.16 * k, 0.05 * k, '#4a4f72');
      const n = Math.min(10, tier);
      for (let i = 0; i < n; i++) {
        const px = x - w / 2 + ((i % 5) + 0.5) * (w / 5),
          py = y - h - 0.08 * k - (i >= 5 ? 0.12 * k : 0);
        glow(ctx, px, py, 0.07 * k, i >= 5 ? '#9fe9ff' : '#ffd77a', 0.95);
      }
      if (tier >= 3) {
        line(ctx, x - w / 2, y - h * 0.5, x + w / 2, y - h * 0.5, 0.05 * k, '#ffd77a');
      }
    }
    // cargo crates by real load (specialty crates keep their material colour: Glutstein orange, Präzisionserz teal)
    const n = load > 0.01 ? Math.max(1, Math.round(load * (stage >= 4 ? 4 : 3))) : 0,
      hot = Math.round(n * Math.max(0, Math.min(1, emberShare || 0)));
    for (let i = 0; i < n; i++) crate(ctx, x - w / 2 + 0.3 * k + (i % 3) * 0.32 * k, y - 0.14 * k - Math.floor(i / 3) * 0.3 * k, 0.28 * k, i < hot ? (tint?.[0] || '#ffb03a') : '#c4a3ff', i < hot ? (tint?.[1] || '#c46a2a') : '#7f6ad8');
    return { x0: x - w / 2 - 0.2 * k, y0: y - h - 0.2 * k, x1: x + w / 2 + 0.2 * k, y1: y + 0.1 * k };
  }
  // Headframe (Förderturm) above the shaft at the surface, with the turning sheave wheel.
  function headframe(ctx, x, ground, k, stage, t, running) {
    const { line, fillRR, gear, glow, box } = A();
    const hgt = (stage >= 3 ? 3.4 : stage === 2 ? 2.9 : 2.4) * k,
      top = ground - hgt,
      col = stage === 1 ? '#a07a52' : stage === 2 ? '#9aa6c8' : '#c9d2ea';
    line(ctx, x - 0.8 * k, ground, x - 0.35 * k, top, 0.12 * k, col);
    line(ctx, x + 0.8 * k, ground, x + 0.35 * k, top, 0.12 * k, col);
    for (let y = ground - 0.5 * k; y > top + 0.2 * k; y -= 0.55 * k) {
      const f = (ground - y) / hgt,
        half = 0.8 * k - 0.45 * k * f;
      line(ctx, x - half, y, x + half, y, 0.05 * k, col);
      if (stage >= 2) line(ctx, x - half, y, x + half * 0.85, y - 0.55 * k, 0.04 * k, col);
    }
    gear(ctx, x, top, 0.38 * k, running ? t * 3 : 0, stage >= 3 ? '#ffd77a' : '#6f7da8');
    if (stage >= 3) box(ctx, x + 1.25 * k, ground, 1 * k, 1 * k, 0.3 * k, '#4f5f9e', '#7f8fd0', '#3a4880');
    if (stage >= 4) glow(ctx, x, top - 0.55 * k, 0.22 * k, Math.sin(t * 3) > 0 ? '#ff8f8f' : '#ffe9a8', 0.95);
    return { x0: x - 1 * k, y0: top - 0.5 * k, x1: x + 1 * k, y1: ground };
  }
  // Construction frontier: dashed cavity outline, sign with cost or blocker, ghost drill.
  function frontier(ctx, x0, y0, w, fh, k, o) {
    const { fillRR, line } = A();
    ctx.save();
    ctx.setLineDash([0.18 * k, 0.14 * k]);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 0.05 * k;
    A().rr(ctx, x0, y0 + 0.42 * fh, w - x0 - 0.2 * k, fh * 0.58 - 0.35 * k, 0.55 * k);
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 0.35;
    machine(ctx, w - 2.2 * k, y0 + fh - 0.5 * k, k, { stage: 2, working: false, time: 0, zone: o.zone, bufferX: x0 });
    ctx.globalAlpha = 1;
    const sx = x0 + (w - x0) * 0.42,
      sy = y0 + fh * 0.58;
    line(ctx, sx, sy, sx, y0 + fh - 0.5 * k, 0.09 * k, '#9a6e48');
    ctx.font = `900 ${Math.max(10, Math.round(0.26 * k))}px Nunito, sans-serif`;
    const t1 = o.title,
      t2 = o.sub;
    const bw = Math.max(ctx.measureText(t1).width, ctx.measureText(t2).width) + 0.5 * k;
    fillRR(ctx, sx - bw / 2, sy - 0.85 * k, bw, 0.95 * k, 0.16 * k, o.locked ? '#d6d2ea' : '#fff4e2');
    A().hazard(ctx, sx - bw / 2, sy - 0.85 * k, bw, 0.08 * k);
    ctx.fillStyle = '#3a2f5a';
    ctx.textAlign = 'center';
    ctx.fillText(t1, sx, sy - 0.45 * k);
    ctx.font = `800 ${Math.max(9, Math.round(0.22 * k))}px Nunito, sans-serif`;
    ctx.fillStyle = o.locked ? '#6a6488' : '#b0602a';
    ctx.fillText(t2, sx, sy - 0.12 * k);
    ctx.textAlign = 'left';
    return { x0, y0: y0 + 0.4 * fh, x1: w, y1: y0 + fh };
  }
  // Ancient Schnurrnetz maintenance conduit (Orion discovery). state: 'found' (dark, sparking) or 'repaired' (glowing).
  function conduit(ctx, x0, y, w, k, t, state) {
    const { fillRR, line, glow, poly } = A();
    const on = state === 'repaired';
    const cx = x0 + (w - x0) * 0.55;
    // big round hatch with M.O.T.T.E. maintenance glyph
    ctx.fillStyle = '#2a2a4a';
    ctx.beginPath();
    ctx.arc(cx, y - 1.05 * k, 0.95 * k, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = on ? '#8ff0d4' : '#5a5f8a';
    ctx.lineWidth = 0.12 * k;
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + (on ? t * 0.4 : 0);
      line(ctx, cx + Math.cos(a) * 0.35 * k, y - 1.05 * k + Math.sin(a) * 0.35 * k, cx + Math.cos(a) * 0.75 * k, y - 1.05 * k + Math.sin(a) * 0.75 * k, 0.06 * k, on ? '#8ff0d4' : '#4a4f86');
    }
    glow(ctx, cx, y - 1.05 * k, 0.5 * k, on ? '#8ff0d4' : '#ff8f8f', on ? 0.75 : 0.15 + (Math.sin(t * 7) > 0.7 ? 0.4 : 0));
    // conduits running along the wall to the elevator
    for (let j = 0; j < 2; j++) {
      const yy = y - (0.35 + j * 0.25) * k;
      line(ctx, x0 + 0.2 * k, yy, cx - 0.9 * k, yy, 0.12 * k, '#3a3a5e');
      if (on) {
        ctx.save();
        ctx.setLineDash([0.2 * k, 0.4 * k]);
        ctx.lineDashOffset = -t * 3 * k;
        line(ctx, x0 + 0.2 * k, yy, cx - 0.9 * k, yy, 0.05 * k, '#8ff0d4');
        ctx.restore();
      }
    }
    // glyph tiles
    for (let i = 0; i < 3; i++) {
      fillRR(ctx, cx + 1.2 * k + i * 0.45 * k, y - 1.35 * k, 0.32 * k, 0.32 * k, 0.05 * k, on ? '#4f5f9e' : '#3a3658');
      poly(ctx, [[cx + 1.28 * k + i * 0.45 * k, y - 1.1 * k], [cx + 1.36 * k + i * 0.45 * k, y - 1.3 * k], [cx + 1.44 * k + i * 0.45 * k, y - 1.1 * k]], on ? '#ffd77a' : '#5a5480');
    }
    return { x0: cx - 1.1 * k, y0: y - 2.2 * k, x1: Math.min(w, cx + 2.6 * k), y1: y };
  }
  // Frost-quartz floor (Glacies): the existing Frostquarz-Bohrer in the ice, with the frost stock.
  function frostRig(ctx, x, y, k, o) {
    const { fillRR, line, glow, crystal, steam } = A();
    for (let i = 0; i < 6; i++) crystal(ctx, x + (0.7 + (i % 3) * 0.3) * k, y - (0.25 + Math.floor(i / 2) * 0.45) * k, (0.22 + (i % 2) * 0.1) * k, i % 2 ? '#e8fbff' : '#9fe8ff', (i - 3) * 0.2);
    fillRR(ctx, x - 0.9 * k, y - 1.1 * k, 1.1 * k, 1.1 * k, 0.12 * k, '#dff2fb');
    fillRR(ctx, x - 0.8 * k, y - 1.0 * k, 0.9 * k, 0.3 * k, 0.06 * k, o.working ? '#8ff0d4' : '#7aa6d4');
    line(ctx, x + 0.2 * k, y - 0.7 * k, x + 0.75 * k, y - 0.85 * k, 0.16 * k, '#9aa6c8');
    glow(ctx, x + 0.8 * k, y - 0.85 * k, 0.3 * k, '#bff4ff', o.working ? 0.6 : 0.1);
    if (o.heated) {
      line(ctx, x - 2.6 * k, y - 1.5 * k, x - 0.9 * k, y - 1.5 * k, 0.12 * k, '#ffb35a');
      glow(ctx, x - 1.6 * k, y - 1.5 * k, 0.4 * k, '#ffb35a', 0.35);
      if (o.working) steam(ctx, x - 0.6 * k, y - 1.2 * k, k * 0.7, o.time);
    }
    return { x0: x - 1.2 * k, y0: y - 1.8 * k, x1: x + 1.4 * k, y1: y };
  }

  // Worksite stock at the rock face (mined, not yet carried): loose rubble with crystal chips, grows with the stock.
  function facePile(ctx, x, y, k, ratio, z) {
    const { crystal, poly } = A();
    const fill = Math.max(0, Math.min(1, ratio));
    if (fill <= 0.01) return;
    const zz = zone(z),
      hw = (0.2 + 0.35 * fill) * k,
      hh = (0.1 + 0.35 * fill) * k;
    poly(ctx, [[x - hw, y], [x - hw * 0.3, y - hh], [x + hw * 0.5, y - hh * 0.8], [x + hw, y]], shade(zz.rock2, 1.15));
    for (let i = 0; i < 1 + Math.round(fill * 3); i++) crystal(ctx, x - hw * 0.5 + i * 0.18 * k, y - hh * 0.55, 0.1 * k, zz.crystal[i % zz.crystal.length], 0.3 - i * 0.2);
  }
  // Beta 1.3: the rock the miners actually strike. Its left surface is exactly x inside the strike band
  // (contactY ± band); above and below it only recedes INTO the rock (to the right), never into the open tunnel, so a
  // tool tip placed on x at contactY always touches stone. o: { height (k), contactY, band (k), scars 0..1, back,
  // boulder, seed }. Embedded zone crystals sit at the strike height; scars are lighter chip marks where work happens.
  function rockFace(ctx, x, y, k, z, o = {}) {
    const { crystal, poly } = A();
    const zz = zone(z),
      h = (o.height || 1.8) * k,
      cy = o.contactY ?? y - 0.25 * k,
      band = (o.band || 0.22) * k,
      depth = (o.depth || 1.4) * k,
      seed = o.seed || 1,
      top = y - h;
    // left edge: bumps only to the right of x (into the rock); flat at x around the contact
    const pts = [[x + depth, y], [x + 0.06 * k, y]];
    const steps = 7;
    for (let i = 1; i < steps; i++) {
      const py = y - (h * i) / steps,
        inBand = Math.abs(py - cy) <= band;
      pts.push([x + (inBand ? 0 : (0.05 + 0.09 * Math.abs(Math.sin(seed * 3.1 + i * 1.7))) * k), py]);
    }
    pts.push([x + 0.16 * k, top], [x + depth, top]);
    // lighter than the tunnel wall behind it, so the worked face reads as a solid block of ore-bearing rock
    poly(ctx, pts, o.back ? shade(zz.strata, 0.95) : shade(zz.strata, 1.18));
    // body shading + strata
    const g = ctx.createLinearGradient(x, 0, x + depth, 0);
    g.addColorStop(0, 'rgba(255,255,255,0.16)');
    g.addColorStop(0.3, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.3)');
    poly(ctx, pts, g);
    // the worked edge: a light rim along the surface the tools hit
    ctx.strokeStyle = o.back ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 0.05 * k;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    pts.slice(1, steps + 2).forEach(([px, py], n) => (n ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.stroke();
    ctx.strokeStyle = zz.strata;
    ctx.lineWidth = 0.05 * k;
    for (let i = 1; i <= 3; i++) {
      const sy = top + (h * i) / 4 + Math.sin(seed + i) * 0.05 * k;
      ctx.beginPath();
      ctx.moveTo(x + 0.12 * k, sy);
      ctx.quadraticCurveTo(x + depth * 0.5, sy - 0.08 * k, x + depth, sy + 0.04 * k);
      ctx.stroke();
    }
    // the ore the kittens are after, right where the blade lands
    const cols = zz.crystal;
    crystal(ctx, x + 0.2 * k, cy - 0.08 * k, (o.boulder ? 0.15 : 0.2) * k, cols[seed % cols.length], -0.5);
    crystal(ctx, x + 0.36 * k, cy + 0.14 * k, 0.13 * k, cols[(seed + 1) % cols.length], 0.3);
    if (!o.boulder) {
      crystal(ctx, x + 0.48 * k, cy - 0.42 * k, 0.16 * k, cols[(seed + 2) % cols.length], -0.2);
      crystal(ctx, x + 0.7 * k, cy - 0.9 * k, 0.12 * k, cols[(seed + 3) % cols.length], 0.4);
    }
    // fresh chip marks where the face is being worked (more with a fuller face pile)
    const scars = Math.round((o.scars || 0) * 4);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    for (let i = 0; i < scars; i++) {
      ctx.beginPath();
      ctx.ellipse(x + (0.04 + (i % 2) * 0.06) * k, cy + (i - 1.5) * 0.09 * k, 0.05 * k, 0.025 * k, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    return { x0: x, y0: top, x1: x + depth, y1: y };
  }
  // Hand stage 1: a timber cap beam over the face and a prop set INTO the rock (right of the strike line x).
  function timberFrame(ctx, x, y, k) {
    const { line } = A();
    line(ctx, x + 0.32 * k, y, x + 0.32 * k, y - 2.15 * k, 0.11 * k, '#a07a52');
    line(ctx, x - 0.5 * k, y - 2.15 * k, x + 0.9 * k, y - 2.15 * k, 0.1 * k, '#8a6644');
    line(ctx, x + 0.32 * k, y - 1.75 * k, x + 0.62 * k, y - 2.12 * k, 0.06 * k, '#8a6644');
  }
  // Hand stage 2: the generator cart that powers the hand drills (cable to the face), parked behind the crew.
  function drillCart(ctx, x, y, k, on, t) {
    const { fillRR, hazard, glow, line } = A();
    fillRR(ctx, x - 0.32 * k, y - 0.42 * k, 0.64 * k, 0.34 * k, 0.07 * k, '#ffcc33');
    hazard(ctx, x - 0.32 * k, y - 0.16 * k, 0.64 * k, 0.06 * k);
    fillRR(ctx, x - 0.22 * k, y - 0.1 * k, 0.12 * k, 0.1 * k, 0.05 * k, '#2f2f5a');
    fillRR(ctx, x + 0.1 * k, y - 0.1 * k, 0.12 * k, 0.1 * k, 0.05 * k, '#2f2f5a');
    glow(ctx, x + 0.18 * k, y - 0.33 * k, 0.08 * k, on && Math.sin(t * 6) > 0 ? '#8ff0d4' : '#5a5f8a', 0.9);
    line(ctx, x + 0.32 * k, y - 0.3 * k, x + 0.9 * k, y - 0.02 * k, 0.025 * k, '#2f2f5a');
  }
  // Internal transport between face and elevator platform, by the haul track stage:
  // 1 carried crates (footpath), 2 wheelbarrows (planks), 3 mine-cart rails, 4 conveyor belt (moves while running).
  function haulTrack(ctx, x0, x1, y, k, stage, t, running) {
    const { line, fillRR } = A();
    if (stage <= 1) {
      fillRR(ctx, x0, y - 0.04 * k, x1 - x0, 0.06 * k, 0.03 * k, 'rgba(0,0,0,0.18)');
      return;
    }
    if (stage === 2) {
      for (let x = x0; x < x1; x += 0.5 * k) fillRR(ctx, x, y - 0.06 * k, 0.44 * k, 0.08 * k, 0.02 * k, '#a07a52');
      return;
    }
    if (stage === 3) {
      line(ctx, x0, y - 0.05 * k, x1, y - 0.05 * k, 0.04 * k, '#9aa6c8');
      for (let x = x0; x < x1; x += 0.3 * k) line(ctx, x, y - 0.09 * k, x, y, 0.05 * k, '#7a5a3a');
      return;
    }
    fillRR(ctx, x0, y - 0.22 * k, x1 - x0, 0.18 * k, 0.08 * k, '#3a3a5e');
    ctx.save();
    ctx.setLineDash([0.16 * k, 0.16 * k]);
    ctx.lineDashOffset = running ? -t * 1.2 * k : 0;
    line(ctx, x0 + 0.08 * k, y - 0.13 * k, x1 - 0.08 * k, y - 0.13 * k, 0.05 * k, '#ffd77a');
    ctx.restore();
  }
  // What a carrier moves, by the haul stage (carried crate / wheelbarrow / mine cart / belt tray).
  function haulLoad(ctx, x, y, k, stage, fill, z, facing) {
    const { crate, fillRR, crystal } = A();
    const zz = zone(z),
      f = Math.max(0.35, Math.min(1, fill));
    if (stage === 2) {
      fillRR(ctx, x - 0.32 * k * facing - 0.18 * k, y - 0.32 * k, 0.5 * k, 0.24 * k, 0.06 * k, '#a07a52');
      crystal(ctx, x - 0.32 * k * facing + 0.05 * k, y - 0.34 * k, 0.12 * k * f + 0.04 * k, zz.crystal[0], 0);
      return;
    }
    if (stage >= 3) {
      fillRR(ctx, x - 0.3 * k, y - 0.42 * k, 0.6 * k, 0.32 * k, 0.06 * k, stage >= 4 ? '#4f5f9e' : '#6f7da8');
      crystal(ctx, x, y - 0.44 * k, (0.08 + 0.1 * f) * k, zz.crystal[1 % zz.crystal.length], 0);
      return;
    }
    crate(ctx, x, y, 0.26 * k * (0.8 + 0.2 * f), '#c4a3ff', '#7f6ad8');
  }
  // A shaft under construction, drawn from the saved progress (0..1):
  // < 25 % survey marks · 25–60 % drilling front · 60–85 % supports and rails · 85–100 % machine install.
  function constructionSite(ctx, x0, top, w, fh, k, p, z, t, reduced) {
    const { fillRR, line, glow, hazard } = A();
    const zz = zone(z),
      y = top + fh - 0.5 * k,
      span = w - x0 - 0.4 * k,
      dig = Math.max(0, Math.min(1, (p - 0.25) / 0.35)),
      frontX = x0 + 0.6 * k + (span - 0.6 * k) * (p < 0.25 ? 0.05 : dig);
    ctx.fillStyle = zz.rock;
    ctx.fillRect(frontX, top + fh * 0.4, w - frontX, fh * 0.6);
    ctx.fillStyle = zz.strata;
    for (let j = 0; j < 3; j++) ctx.fillRect(frontX, top + fh * (0.5 + j * 0.15), w - frontX, 0.06 * k);
    // survey marks along the planned tunnel
    ctx.save();
    ctx.setLineDash([0.12 * k, 0.12 * k]);
    ctx.strokeStyle = 'rgba(255,215,122,0.75)';
    ctx.lineWidth = 0.04 * k;
    ctx.strokeRect(x0 + 0.3 * k, top + fh * 0.45, span - 0.3 * k, fh * 0.55 - 0.55 * k);
    ctx.restore();
    // supports and rails behind the front
    if (p >= 0.6) {
      const n = Math.floor(((p - 0.6) / 0.25) * 6);
      for (let i = 0; i < Math.min(6, n + 1); i++) {
        const bx = x0 + 0.8 * k + i * ((frontX - x0 - 1 * k) / 6);
        line(ctx, bx, y, bx, top + fh * 0.45, 0.09 * k, '#a07a52');
        line(ctx, bx - 0.25 * k, top + fh * 0.45, bx + 0.25 * k, top + fh * 0.45, 0.08 * k, '#a07a52');
      }
      line(ctx, x0 + 0.5 * k, y - 0.05 * k, x0 + 0.5 * k + (frontX - x0) * Math.min(1, (p - 0.6) / 0.25), y - 0.05 * k, 0.04 * k, '#9aa6c8');
    }
    // the drill at the front
    if (p >= 0.25 && p < 0.85) {
      fillRR(ctx, frontX - 0.75 * k, y - 0.75 * k, 0.6 * k, 0.5 * k, 0.1 * k, '#ffcc33');
      hazard(ctx, frontX - 0.75 * k, y - 0.32 * k, 0.6 * k, 0.07 * k);
      glow(ctx, frontX, y - 0.5 * k, 0.45 * k, '#ffe9a8', reduced ? 0.7 : 0.7 + Math.sin(t * 30) * 0.2);
    }
    return { x0, y0: top + fh * 0.38, x1: w, y1: y + 0.2 * k, frontX, y };
  }

  // ----- per-shaft identities (session 8): drawn over the zone background, under the machinery -----
  // dense: darker compacted rock, steel I-beam supports, gold-brown ore nuggets
  // conveyor: a restored pre-Silence ceiling conveyor with Schnurrnetz glyph plates and brass pipes
  // resonance: tall glowing crystal pillars that pulse in one tone
  // An old clockwork wheel: square teeth, a rim, four spokes and a bright hub (Uhrwerkkern / Maschinenkern).
  function clockGear(ctx, x, y, r, angle, fill, dark, hub) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = fill;
    for (let i = 0; i < 14; i++) {
      ctx.save();
      ctx.rotate((i / 14) * Math.PI * 2);
      ctx.fillRect(-r * 0.12, -r * 1.14, r * 0.24, r * 0.22);
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.arc(0, 0, r * 0.74, 0, Math.PI * 2, true);
    ctx.fill();
    ctx.strokeStyle = dark;
    ctx.lineWidth = r * 0.12;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.2, Math.sin(a) * r * 0.2);
      ctx.lineTo(Math.cos(a) * r * 0.76, Math.sin(a) * r * 0.76);
      ctx.stroke();
    }
    ctx.fillStyle = hub;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  function shaftLook(ctx, look, x0, top, w, fh, k, t, reduced, working, freed) {
    const { fillRR, line, glow, crystal, poly } = A();
    const y0 = top + fh * 0.42,
      y1 = top + fh - 0.42 * k,
      x1 = w - 0.25 * k;
    if (look === 'clockwork') {
      // Uhrwerkkern: riveted ancient factory wall panels, big clockwork wheels (rim, spokes, square teeth) turning in
      // mesh while the shaft mines, two pistons, a teal energy conduit and old permit terminals — red "VERWEIGERT"
      // lamps and a blinking warning sign until Cogsworth's repair, teal approval lamps after it.
      const turn = working && !reduced ? t * 0.3 : 0;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x0 + 0.2 * k, y0 - 0.25 * k, x1 - x0 - 0.2 * k, y1 - y0 + 0.25 * k);
      ctx.clip();
      for (let x = x0 + 0.3 * k, i = 0; x < x1; x += 1.6 * k, i++) {
        fillRR(ctx, x, y0 - 0.2 * k, 1.5 * k, y1 - y0 + 0.2 * k, 0.06 * k, i % 2 ? '#2a3050' : '#303758');
        for (const ry of [y0 - 0.05 * k, y1 - 0.15 * k]) for (const rx of [x + 0.12 * k, x + 1.38 * k]) glow(ctx, rx, ry, 0.035 * k, '#b8894a', 0.9);
      }
      const wheels = [
        [x0 + 2.2 * k, y0 + 0.5 * k, 0.95 * k, 1],
        [x0 + 3.85 * k, y0 + 0.25 * k, 0.62 * k, -1.53],
        [x1 - 3.3 * k, y0 + 0.45 * k, 0.85 * k, 1.12]
      ];
      for (const [wx, wy, r, ratio] of wheels) if (wx < x1 - 0.4 * k) clockGear(ctx, wx, wy, r, turn * ratio, '#c99a4e', '#8a6a3a', '#f3cf7a');
      ctx.restore();
      // energy conduit along the ceiling (pulses only while mining)
      line(ctx, x0 + 0.4 * k, y0 - 0.05 * k, x1, y0 - 0.05 * k, 0.12 * k, '#1e2a48');
      line(ctx, x0 + 0.4 * k, y0 - 0.05 * k, x1, y0 - 0.05 * k, 0.04 * k, working ? '#5fe0d0' : '#3a6a70');
      const flow = reduced ? 0.5 : (t * 0.3) % 1;
      if (working) for (let i = 0; i < 4; i++) glow(ctx, x0 + 0.6 * k + ((i / 4 + flow) % 1) * (x1 - x0 - k), y0 - 0.05 * k, 0.12 * k, '#9ff0e4', 0.8);
      // pistons
      for (let i = 0; i < 2; i++) {
        const px = x0 + 5.3 * k + i * 1.0 * k;
        if (px > x1 - 2.6 * k) break;
        const stroke = working && !reduced ? (Math.sin(t * 3 + i * 1.7) + 1) / 2 : 0.4;
        fillRR(ctx, px - 0.08 * k, y0 - 0.02 * k, 0.16 * k, 0.4 * k + stroke * 0.25 * k, 0.04 * k, '#8a94b8');
        fillRR(ctx, px - 0.17 * k, y0 + 0.36 * k + stroke * 0.25 * k, 0.34 * k, 0.14 * k, 0.05 * k, '#c99a4e');
      }
      // permit terminal: screen with a stamp mark, lamp and slip slot
      const tx = x0 + 1.05 * k,
        ty = y0 + 0.62 * k;
      fillRR(ctx, tx - 0.36 * k, ty - 0.55 * k, 0.72 * k, 0.86 * k, 0.1 * k, '#1c2140');
      fillRR(ctx, tx - 0.28 * k, ty - 0.46 * k, 0.56 * k, 0.32 * k, 0.05 * k, freed ? '#1f5a56' : '#4a1e30');
      ctx.strokeStyle = freed ? '#9ff0e4' : '#ff8f8f';
      ctx.lineWidth = 0.05 * k;
      ctx.beginPath();
      if (freed) {
        ctx.moveTo(tx - 0.12 * k, ty - 0.3 * k);
        ctx.lineTo(tx - 0.03 * k, ty - 0.2 * k);
        ctx.lineTo(tx + 0.14 * k, ty - 0.4 * k);
      } else {
        ctx.moveTo(tx - 0.1 * k, ty - 0.4 * k);
        ctx.lineTo(tx + 0.1 * k, ty - 0.2 * k);
        ctx.moveTo(tx + 0.1 * k, ty - 0.4 * k);
        ctx.lineTo(tx - 0.1 * k, ty - 0.2 * k);
      }
      ctx.stroke();
      fillRR(ctx, tx - 0.2 * k, ty + 0.12 * k, 0.4 * k, 0.05 * k, 0.02 * k, '#8a7a5a');
      const blink = reduced || Math.sin(t * 4) > 0;
      glow(ctx, tx + 0.24 * k, ty - 0.02 * k, 0.07 * k, freed ? '#5fe0d0' : blink ? '#ff6a6a' : '#7a3a4a', 0.95);
      if (!freed) {
        const wx = (x0 + x1) / 2 + 0.9 * k,
          wy = y0 + 0.18 * k,
          on = reduced || Math.sin(t * 2.5) > -0.2;
        poly(ctx, [[wx, wy - 0.24 * k], [wx + 0.27 * k, wy + 0.22 * k], [wx - 0.27 * k, wy + 0.22 * k]], on ? '#ffd25a' : '#8a7a4a');
        fillRR(ctx, wx - 0.03 * k, wy - 0.1 * k, 0.06 * k, 0.17 * k, 0.02 * k, '#2c2236');
        glow(ctx, wx, wy + 0.14 * k, 0.03 * k, '#2c2236', 1);
      } else glow(ctx, (x0 + x1) / 2 + 0.9 * k, y0 + 0.18 * k, 0.12 * k, '#ffd77a', 0.9);
      return;
    }
    if (look === 'machinecore') {
      // Reaktivierter Maschinenkern: a great core ring with teal conduits and moving gears, a working lift platform,
      // warm factory lights — the machine is alive again (only exists after Cogsworth's repair).
      const cx = (x0 + x1) / 2,
        cy = (y0 + y1) / 2 - 0.05 * k,
        turn = working && !reduced ? t * 0.5 : 0;
      ctx.strokeStyle = 'rgba(95,224,208,0.35)';
      ctx.lineWidth = 0.18 * k;
      ctx.beginPath();
      ctx.arc(cx, cy, 0.95 * k, 0, Math.PI * 2);
      ctx.stroke();
      A().gear(ctx, cx, cy, 0.72 * k, turn, 'rgba(217,165,74,0.5)');
      glow(ctx, cx, cy, 0.5 * k, '#5fe0d0', working ? 0.45 + (reduced ? 0 : 0.15 * Math.sin(t * 2)) : 0.25);
      for (const side of [-1, 1]) {
        const gx = cx + side * 2.3 * k;
        if (gx < x0 + 0.8 * k || gx > x1 - 0.5 * k) continue;
        A().gear(ctx, gx, cy + 0.15 * k, 0.45 * k, -turn * 1.6, 'rgba(200,120,74,0.45)');
        line(ctx, cx + side * 0.95 * k, cy, gx - side * 0.45 * k, cy + 0.1 * k, 0.08 * k, '#5fe0d0');
      }
      // conduit grid on the ceiling and warm factory lamps
      line(ctx, x0 + 0.4 * k, y0 + 0.02 * k, x1, y0 + 0.02 * k, 0.09 * k, '#5fe0d0');
      for (let x = x0 + 1.4 * k; x < x1 - 0.4 * k; x += 2.1 * k) {
        line(ctx, x, y0 + 0.02 * k, x, y0 + 0.24 * k, 0.03 * k, '#6a7290');
        glow(ctx, x, y0 + 0.3 * k, 0.12 * k, '#ffd77a', 0.9);
      }
      // a small maintenance lift riding up and down at the right wall
      const lx = x1 - 0.7 * k,
        ly = y0 + 0.25 * k + (working && !reduced ? ((Math.sin(t * 0.8) + 1) / 2) * (y1 - y0 - 0.7 * k) : 0.2 * k);
      line(ctx, lx - 0.22 * k, y0, lx - 0.22 * k, y1, 0.04 * k, '#6a7290');
      line(ctx, lx + 0.22 * k, y0, lx + 0.22 * k, y1, 0.04 * k, '#6a7290');
      fillRR(ctx, lx - 0.25 * k, ly, 0.5 * k, 0.12 * k, 0.04 * k, '#c99a4e');
      return;
    }
    if (look === 'roots') {
      // Wurzelader: thick bark roots hanging from the tunnel roof, small mint glow buds on them
      for (let i = 0, x = x0 + 1.1 * k; x < x1 - 0.5 * k; x += 1.9 * k, i++) {
        const len = (0.55 + (i % 3) * 0.22) * k,
          sway = working && !reduced ? Math.sin(t * 0.8 + i) * 0.05 * k : 0;
        ctx.strokeStyle = i % 2 ? '#6a4a3e' : '#5a3e36';
        ctx.lineWidth = 0.14 * k;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x, y0 - 0.25 * k);
        ctx.quadraticCurveTo(x + 0.25 * k, y0 + len * 0.5, x + 0.05 * k + sway, y0 + len);
        ctx.stroke();
        glow(ctx, x + 0.05 * k + sway, y0 + len, 0.08 * k, '#8ff0d4', 0.85);
      }
      return;
    }
    if (look === 'fungi') {
      // Leuchtpilz-Grotte: glowing mushrooms along the back wall (they pulse while the shaft mines), drifting spores
      const pulse = reduced ? 0.6 : 0.5 + 0.3 * Math.sin(t * 2);
      for (let i = 0, x = x0 + 1.2 * k; x < x1 - 0.5 * k; x += 1.15 * k, i++) {
        const hgt = (0.35 + (i % 3) * 0.16) * k,
          cap = (0.2 + (i % 2) * 0.1) * k,
          col = i % 3 === 1 ? '#ff9ecb' : '#8ff0d4',
          by = y1 - 0.05 * k;
        line(ctx, x, by, x, by - hgt, 0.06 * k, '#d8e8e0');
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.ellipse(x, by - hgt, cap, cap * 0.55, 0, Math.PI, TAU);
        ctx.fill();
        glow(ctx, x, by - hgt - cap * 0.1, cap * 2.2, col, (working ? 0.35 : 0.18) * (pulse + 0.4));
      }
      if (working && !reduced) for (let i = 0; i < 6; i++) glow(ctx, x0 + 1 * k + ((i * 0.71 + t * 0.04) % 1) * (x1 - x0 - 1.5 * k), y1 - ((i * 0.37 + t * 0.08) % 1) * (y1 - y0), 0.04 * k, '#bfffe6', 0.7);
      return;
    }
    if (look === 'heartroot') {
      // Herzwurzel-Kammer: one great living root crossing the chamber with a warm beating heart (Petalguard's gift)
      const cx = (x0 + x1) / 2,
        cy = (y0 + y1) / 2,
        beat = reduced ? 0.7 : 0.6 + 0.3 * Math.max(0, Math.sin(t * 2.4)) ** 3;
      ctx.strokeStyle = '#6a4a3e';
      ctx.lineCap = 'round';
      ctx.lineWidth = 0.32 * k;
      ctx.beginPath();
      ctx.moveTo(x0 + 0.4 * k, y0 - 0.1 * k);
      ctx.bezierCurveTo(cx - 2 * k, y1, cx + 2 * k, y0 - 0.2 * k, x1, y1 - 0.2 * k);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(143,240,212,0.6)';
      ctx.lineWidth = 0.06 * k;
      ctx.stroke();
      glow(ctx, cx, cy, 0.9 * k, '#ffd77a', 0.3 * beat);
      ctx.fillStyle = '#ff9ecb';
      ctx.beginPath();
      ctx.ellipse(cx, cy, (0.24 + 0.04 * beat) * k, (0.3 + 0.04 * beat) * k, 0, 0, TAU);
      ctx.fill();
      glow(ctx, cx, cy, 0.18 * k, '#fff0c8', 0.9);
      for (let i = 0; i < 4; i++) {
        const fx = x0 + 1.2 * k + i * ((x1 - x0 - 2.2 * k) / 3);
        if (Math.abs(fx - cx) < 1.2 * k) continue;
        ctx.fillStyle = i % 2 ? '#ff9ecb' : '#ffd77a';
        for (let p = 0; p < 5; p++) {
          const a = (p / 5) * TAU;
          ctx.beginPath();
          ctx.arc(fx + Math.cos(a) * 0.09 * k, y1 - 0.2 * k + Math.sin(a) * 0.09 * k, 0.07 * k, 0, TAU);
          ctx.fill();
        }
        glow(ctx, fx, y1 - 0.2 * k, 0.05 * k, '#fff0c8', 0.9);
      }
      return;
    }
    if (look === 'dense') {
      ctx.fillStyle = 'rgba(22,12,34,0.38)';
      ctx.fillRect(x0 + 0.2 * k, y0, x1 - x0 - 0.2 * k, y1 - y0);
      for (let i = 0; i < 9; i++) {
        const px = x0 + 0.9 * k + ((i * 1.37) % 1) * (x1 - x0 - 1.4 * k),
          py = y0 + 0.12 * k + ((i * 0.61) % 1) * (y1 - y0 - 0.5 * k),
          s = (0.07 + (i % 3) * 0.03) * k;
        poly(ctx, [[px - s, py], [px - s * 0.3, py - s], [px + s, py - s * 0.4], [px + s * 0.6, py + s * 0.6]], i % 2 ? '#c98a3a' : '#ffd77a');
      }
      for (let x = x0 + 1.7 * k; x < x1 - 0.8 * k; x += 2.4 * k) {
        fillRR(ctx, x - 0.09 * k, y0 - 0.1 * k, 0.18 * k, y1 - y0 + 0.5 * k, 0.03 * k, '#6c7696');
        fillRR(ctx, x - 0.17 * k, y0 - 0.12 * k, 0.34 * k, 0.1 * k, 0.03 * k, '#8a94b6');
        for (let r = 0; r < 3; r++) glow(ctx, x, y0 + 0.25 * k + r * 0.45 * k, 0.03 * k, '#d6dcf0', 0.9);
      }
      return;
    }
    if (look === 'conveyor') {
      const cy = top + fh * 0.5;
      for (let i = 0; i < 3; i++) {
        const gx = x0 + 1.4 * k + i * ((x1 - x0 - 2.4 * k) / 2);
        fillRR(ctx, gx - 0.28 * k, y0 + 0.05 * k, 0.56 * k, 0.4 * k, 0.06 * k, 'rgba(20,40,60,0.75)');
        ctx.strokeStyle = 'rgba(143,240,212,0.75)';
        ctx.lineWidth = 0.035 * k;
        ctx.beginPath();
        ctx.arc(gx, y0 + 0.25 * k, 0.11 * k, 0, Math.PI * 2);
        ctx.moveTo(gx - 0.2 * k, y0 + 0.25 * k);
        ctx.lineTo(gx + 0.2 * k, y0 + 0.25 * k);
        ctx.stroke();
      }
      line(ctx, x0 + 0.4 * k, cy - 0.2 * k, x1, cy - 0.2 * k, 0.07 * k, '#b0864a');
      fillRR(ctx, x0 + 0.5 * k, cy - 0.06 * k, x1 - x0 - 0.7 * k, 0.16 * k, 0.08 * k, '#3a3550');
      for (let x = x0 + 0.7 * k; x < x1 - 0.2 * k; x += 0.55 * k) {
        ctx.fillStyle = '#7a7fa0';
        ctx.beginPath();
        ctx.arc(x, cy + 0.02 * k, 0.07 * k, 0, Math.PI * 2);
        ctx.fill();
        line(ctx, x, cy + 0.1 * k, x, y0 - 0.1 * k, 0.03 * k, '#5a5470');
      }
      // old crates riding the restored belt (moves only while the shaft is running)
      const off = working && !reduced ? (t * 0.6 * k) % (1.4 * k) : 0;
      for (let x = x1 - 0.6 * k - off; x > x0 + 0.8 * k; x -= 1.4 * k) A().crate(ctx, x, cy - 0.06 * k, 0.22 * k, '#8fd6c8', '#4a8f86');
      return;
    }
    if (look === 'gearwork') {
      // Mechanische Ader: big inset cogs in the back wall (they turn while the shaft mines), riveted steel ribs
      for (let i = 0, x = x0 + 1.6 * k; x < x1 - 0.8 * k; x += 2.6 * k, i++) {
        A().gear(ctx, x, y0 + 0.55 * k, (0.42 + (i % 2) * 0.12) * k, working && !reduced ? t * (i % 2 ? -0.6 : 0.6) : i, i % 2 ? 'rgba(200,120,74,0.55)' : 'rgba(217,165,74,0.55)');
        fillRR(ctx, x + 1.2 * k, y0 - 0.1 * k, 0.16 * k, y1 - y0 + 0.4 * k, 0.03 * k, '#5a6488');
        for (let r = 0; r < 3; r++) glow(ctx, x + 1.28 * k, y0 + 0.2 * k + r * 0.4 * k, 0.025 * k, '#f3cf7a', 0.9);
      }
      for (let x = x0 + 2.9 * k; x < x1 - 0.5 * k; x += 2.6 * k) glow(ctx, x, y0 + 1.05 * k, 0.11 * k, '#5fe0d0', 0.85);
      return;
    }
    if (look === 'precision') {
      // Zahnrad-Stollen: teal Präzisionserz studs in brass-ringed sockets (pulse while mining), ceiling pipes + gauges
      const pulse = reduced ? 0.6 : 0.55 + 0.3 * Math.sin(t * 2.6);
      line(ctx, x0 + 0.5 * k, y0 + 0.08 * k, x1, y0 + 0.08 * k, 0.12 * k, '#c8784a');
      line(ctx, x0 + 0.5 * k, y0 + 0.24 * k, x1, y0 + 0.24 * k, 0.07 * k, '#d9a54a');
      for (let i = 0; i < 6; i++) {
        const sx = x0 + 1.3 * k + i * ((x1 - x0 - 2 * k) / 5),
          sy = y0 + 0.55 * k + ((i * 0.43) % 1) * (y1 - y0 - 0.9 * k);
        ctx.strokeStyle = '#d9a54a';
        ctx.lineWidth = 0.04 * k;
        ctx.beginPath();
        ctx.arc(sx, sy, 0.13 * k, 0, Math.PI * 2);
        ctx.stroke();
        poly(ctx, [[sx, sy - 0.1 * k], [sx + 0.09 * k, sy - 0.05 * k], [sx + 0.09 * k, sy + 0.05 * k], [sx, sy + 0.1 * k], [sx - 0.09 * k, sy + 0.05 * k], [sx - 0.09 * k, sy - 0.05 * k]], '#5fe0d0');
        if (working) glow(ctx, sx, sy, 0.24 * k, '#5fe0d0', 0.3 * pulse);
      }
      for (let i = 0; i < 2; i++) {
        const gx = x0 + 2.4 * k + i * 3.2 * k;
        if (gx > x1 - 0.6 * k) break;
        fillRR(ctx, gx - 0.22 * k, y0 + 0.3 * k, 0.44 * k, 0.44 * k, 0.22 * k, '#2c3150');
        const a = Math.PI * (1.1 + 0.5 * ((Math.sin(t * 0.9 + i) + 1) / 2));
        line(ctx, gx, y0 + 0.52 * k, gx + Math.cos(a) * 0.16 * k, y0 + 0.52 * k + Math.sin(a) * 0.16 * k, 0.035 * k, '#f3cf7a');
      }
      return;
    }
    if (look === 'basalt') {
      // hexagonal basalt columns on the back wall, cyan safety lamps
      for (let x = x0 + 1.2 * k, i = 0; x < x1 - 0.6 * k; x += 0.42 * k, i++) {
        const hgt = (0.5 + ((i * 7) % 4) * 0.12) * k;
        poly(ctx, [[x - 0.16 * k, y0 + hgt], [x - 0.16 * k, y0 + 0.08 * k], [x, y0], [x + 0.16 * k, y0 + 0.08 * k], [x + 0.16 * k, y0 + hgt]], i % 2 ? '#4a3a58' : '#3a2e48');
      }
      for (let x = x0 + 2 * k; x < x1 - 0.5 * k; x += 2.8 * k) glow(ctx, x, y0 + 0.75 * k, 0.12 * k, '#7fe8f0', 0.9);
      return;
    }
    if (look === 'ember') {
      // glowing Glutkristall veins in the walls (they pulse while the shaft mines)
      const pulse = reduced ? 0.6 : 0.55 + 0.25 * Math.sin(t * 3);
      for (let i = 0; i < 5; i++) {
        const vx = x0 + 1.3 * k + i * ((x1 - x0 - 2 * k) / 4),
          vy = y0 + 0.2 * k + ((i * 0.37) % 1) * (y1 - y0 - 0.6 * k);
        ctx.strokeStyle = 'rgba(255,154,58,' + (working ? pulse : 0.4).toFixed(2) + ')';
        ctx.lineWidth = 0.06 * k;
        ctx.beginPath();
        ctx.moveTo(vx - 0.4 * k, vy);
        ctx.lineTo(vx - 0.1 * k, vy + 0.15 * k);
        ctx.lineTo(vx + 0.2 * k, vy - 0.05 * k);
        ctx.lineTo(vx + 0.45 * k, vy + 0.1 * k);
        ctx.stroke();
        crystal(ctx, vx, vy + 0.05 * k, 0.12 * k, '#ffb03a', 0.3);
        if (working) glow(ctx, vx, vy, 0.3 * k, '#ff9a3a', 0.25 * pulse);
      }
      return;
    }
    if (look === 'magma') {
      // a magma channel behind the walkway and cooling pipes along the ceiling
      const my = y1 - 0.08 * k;
      fillRR(ctx, x0 + 0.8 * k, my - 0.12 * k, x1 - x0 - 1 * k, 0.16 * k, 0.08 * k, '#ff6a2a');
      for (let i = 0; i < 6; i++) glow(ctx, x0 + 1 * k + ((i / 6 + t * 0.05) % 1) * (x1 - x0 - 1.4 * k), my - 0.05 * k, 0.12 * k, '#fff0a0', 0.55);
      glow(ctx, (x0 + x1) / 2, my, (x1 - x0) * 0.35, '#ff7a2a', 0.18);
      line(ctx, x0 + 0.5 * k, y0 + 0.15 * k, x1, y0 + 0.15 * k, 0.12 * k, '#5a7a9a');
      line(ctx, x0 + 0.5 * k, y0 + 0.32 * k, x1, y0 + 0.32 * k, 0.08 * k, '#7fe8f0');
      return;
    }
    if (look === 'heatchamber') {
      // ancient M.O.T.T.E. heat control: round dials, a vent grate and old pipes
      for (let i = 0; i < 3; i++) {
        const dx = x0 + 1.6 * k + i * 1.5 * k;
        fillRR(ctx, dx - 0.4 * k, y0 + 0.1 * k, 0.8 * k, 0.8 * k, 0.4 * k, '#3a3450');
        ctx.strokeStyle = '#ffd25a';
        ctx.lineWidth = 0.05 * k;
        ctx.beginPath();
        ctx.arc(dx, y0 + 0.5 * k, 0.28 * k, Math.PI * 0.8, Math.PI * 2.2);
        ctx.stroke();
        const a = Math.PI * (1 + 0.6 * ((Math.sin(t * 0.7 + i) + 1) / 2));
        line(ctx, dx, y0 + 0.5 * k, dx + Math.cos(a) * 0.22 * k, y0 + 0.5 * k + Math.sin(a) * 0.22 * k, 0.04 * k, '#7fe8f0');
      }
      fillRR(ctx, x1 - 2.6 * k, y0 + 0.05 * k, 1.6 * k, 0.9 * k, 0.1 * k, '#2a2234');
      for (let r = 0; r < 4; r++) line(ctx, x1 - 2.5 * k, y0 + 0.2 * k + r * 0.2 * k, x1 - 1.1 * k, y0 + 0.2 * k + r * 0.2 * k, 0.05 * k, '#5a4a6a');
      glow(ctx, x1 - 1.8 * k, y0 + 0.5 * k, 0.6 * k, '#7fe8f0', 0.25);
      return;
    }
    if (look === 'resonance') {
      const pulse = reduced ? 0.6 : 0.5 + 0.35 * Math.sin(t * 2.2);
      const cols = ['#9fe8ff', '#e2a8ff', '#ffffff'];
      for (let i = 0; i < 4; i++) {
        const cx = x0 + 1.6 * k + i * ((x1 - x0 - 3 * k) / 3),
          hgt = (1.4 + (i % 2) * 0.7) * k;
        glow(ctx, cx, y1 - hgt * 0.5, hgt * 0.75, cols[i % 2], 0.18 + pulse * 0.25);
        crystal(ctx, cx, y1 - 0.02 * k, hgt * 0.5, cols[i % 2], (i - 1.5) * 0.12);
        crystal(ctx, cx + 0.3 * k, y1, hgt * 0.3, cols[(i + 1) % 2], 0.3);
        crystal(ctx, cx - 0.28 * k, y1, hgt * 0.22, cols[2], -0.35);
      }
      for (let i = 0; i < 6; i++) glow(ctx, x0 + 1 * k + ((i * 0.83 + t * 0.05) % 1) * (x1 - x0 - 1.5 * k), y0 + ((i * 0.37 + t * 0.03) % 1) * (y1 - y0), 0.05 * k, '#ffffff', 0.5 * pulse);
    }
  }
  // Dedicated rigs for looks that need their own silhouette (stage ≥ 2)
  function lookRig(ctx, x, y, k, o) {
    const { fillRR, line, glow, gear, hazard, drillBit, box } = A();
    const t = o.time,
      on = o.working,
      spin = on ? t * 9 : 0;
    if (o.look === 'dense') {
      // "Kernbohrer": heavy armoured body on tracks, triple drill head on a piston arm
      fillRR(ctx, x - 1.25 * k, y - 0.34 * k, 2.2 * k, 0.34 * k, 0.17 * k, '#26263e');
      for (let i = 0; i < 5; i++) gear(ctx, x - 1.05 * k + i * 0.45 * k, y - 0.17 * k, 0.1 * k, spin * 0.3, '#7c86a6');
      box(ctx, x - 0.55 * k, y - 0.32 * k, 1.5 * k, 1.05 * k, 0.3 * k, '#4a5068', '#6c7696', '#353a52');
      hazard(ctx, x - 1.05 * k, y - 0.44 * k, 1.5 * k, 0.08 * k);
      line(ctx, x + 0.3 * k, y - 1.0 * k, x + 0.95 * k, y - 0.95 * k, 0.2 * k, '#8a94b6');
      for (let d = -1; d <= 1; d++) {
        ctx.save();
        ctx.translate(x + 1.0 * k, y - 0.95 * k + d * 0.22 * k);
        drillBit(ctx, 0, 0, k * 0.55, spin + d);
        ctx.restore();
      }
      glow(ctx, x - 0.2 * k, y - 1.05 * k, 0.12 * k, on ? '#ffd77a' : '#5a5f8a', 0.9);
      glow(ctx, x + 0.2 * k, y - 1.05 * k, 0.12 * k, on && Math.sin(t * 6) > 0 ? '#ff8f8f' : '#5a5f8a', 0.9);
      return { x0: x - 1.3 * k, y0: y - 1.6 * k, x1: x + 1.4 * k, y1: y };
    }
    if (o.look === 'clockwork') {
      // "Taktbohrer": a brass clock-cabinet on tracks; the pendulum swings and the piston drives the bit in time
      fillRR(ctx, x - 1.05 * k, y - 0.3 * k, 1.9 * k, 0.3 * k, 0.15 * k, '#2c3150');
      for (let i = 0; i < 4; i++) gear(ctx, x - 0.85 * k + i * 0.47 * k, y - 0.15 * k, 0.09 * k, spin * 0.3, '#d9a54a');
      fillRR(ctx, x - 0.6 * k, y - 1.35 * k, 1.0 * k, 1.1 * k, 0.16 * k, '#b8894a');
      fillRR(ctx, x - 0.5 * k, y - 1.25 * k, 0.8 * k, 0.8 * k, 0.4 * k, '#f3e6c4');
      ctx.strokeStyle = '#3a3048';
      ctx.lineWidth = 0.04 * k;
      for (let h = 0; h < 12; h++) {
        const a = (h / 12) * Math.PI * 2;
        line(ctx, x - 0.1 * k + Math.cos(a) * 0.32 * k, y - 0.85 * k + Math.sin(a) * 0.32 * k, x - 0.1 * k + Math.cos(a) * 0.36 * k, y - 0.85 * k + Math.sin(a) * 0.36 * k, 0.03 * k, '#3a3048');
      }
      const hand = on && !o.reduced ? t * 2 : 0.8;
      line(ctx, x - 0.1 * k, y - 0.85 * k, x - 0.1 * k + Math.cos(hand) * 0.26 * k, y - 0.85 * k + Math.sin(hand) * 0.26 * k, 0.04 * k, '#2a6a64');
      const swing = on && !o.reduced ? Math.sin(t * 4) * 0.35 : 0;
      line(ctx, x - 0.1 * k, y - 0.45 * k, x - 0.1 * k + Math.sin(swing) * 0.2 * k, y - 0.32 * k, 0.03 * k, '#8a6a3a');
      const push = on && !o.reduced ? (Math.sin(t * 4) + 1) / 2 : 0.3;
      fillRR(ctx, x + 0.4 * k, y - 0.72 * k, 0.3 * k + push * 0.18 * k, 0.16 * k, 0.05 * k, '#8a94b8');
      ctx.save();
      ctx.translate(x + 0.85 * k + push * 0.18 * k, y - 0.64 * k);
      drillBit(ctx, 0, 0, k * 0.55, spin);
      ctx.restore();
      glow(ctx, x + 0.35 * k, y - 1.2 * k, 0.08 * k, on ? '#5fe0d0' : '#5a6488', 0.95);
      return { x0: x - 1.1 * k, y0: y - 1.45 * k, x1: x + 1.5 * k, y1: y };
    }
    if (o.look === 'machinecore') {
      // "Kernfräse": a teal-lit ring cutter on a heavy carriage
      fillRR(ctx, x - 1.15 * k, y - 0.34 * k, 2.1 * k, 0.34 * k, 0.17 * k, '#1e2440');
      for (let i = 0; i < 5; i++) gear(ctx, x - 0.95 * k + i * 0.45 * k, y - 0.17 * k, 0.1 * k, spin * 0.3, '#5fe0d0');
      box(ctx, x - 0.5 * k, y - 0.32 * k, 1.3 * k, 0.95 * k, 0.28 * k, '#3a4466', '#5a6a90', '#2a3150');
      ctx.strokeStyle = '#5fe0d0';
      ctx.lineWidth = 0.09 * k;
      ctx.beginPath();
      ctx.arc(x + 1.0 * k, y - 0.75 * k, 0.36 * k, spin * 0.2, spin * 0.2 + Math.PI * 1.6);
      ctx.stroke();
      gear(ctx, x + 1.0 * k, y - 0.75 * k, 0.22 * k, spin, '#f3cf7a');
      if (on) glow(ctx, x + 1.0 * k, y - 0.75 * k, 0.5 * k, '#5fe0d0', 0.5);
      return { x0: x - 1.2 * k, y0: y - 1.3 * k, x1: x + 1.5 * k, y1: y };
    }
    if (o.look === 'precision') {
      // clockwork precision drill: rounded brass body with a turning side cog, a teal eye-lamp and a fine drill bit
      fillRR(ctx, x - 1.0 * k, y - 0.28 * k, 1.8 * k, 0.28 * k, 0.14 * k, '#2c3150');
      for (let i = 0; i < 4; i++) gear(ctx, x - 0.8 * k + i * 0.45 * k, y - 0.14 * k, 0.08 * k, spin * 0.3, '#d9a54a');
      fillRR(ctx, x - 0.55 * k, y - 1.15 * k, 1.1 * k, 0.9 * k, 0.35 * k, '#c99a4e');
      fillRR(ctx, x - 0.45 * k, y - 1.05 * k, 0.9 * k, 0.16 * k, 0.08 * k, '#f3cf7a');
      gear(ctx, x - 0.15 * k, y - 0.62 * k, 0.26 * k, spin * 0.5, '#c8784a');
      glow(ctx, x + 0.28 * k, y - 0.7 * k, 0.1 * k, on ? '#5fe0d0' : '#5a6488', 0.95);
      ctx.save();
      ctx.translate(x + 0.75 * k, y - 0.62 * k);
      drillBit(ctx, 0, 0, k * 0.55, spin);
      ctx.restore();
      if (on) glow(ctx, x + 1.25 * k, y - 0.62 * k, 0.3 * k, '#5fe0d0', 0.45);
      return { x0: x - 1.1 * k, y0: y - 1.3 * k, x1: x + 1.5 * k, y1: y };
    }
    if (o.look === 'ember') {
      // heat-resistant drill: cyan-cooled housing, coolant hoses, glowing bit
      fillRR(ctx, x - 1.0 * k, y - 0.3 * k, 1.8 * k, 0.3 * k, 0.15 * k, '#2a2a40');
      for (let i = 0; i < 4; i++) gear(ctx, x - 0.8 * k + i * 0.45 * k, y - 0.15 * k, 0.09 * k, spin * 0.3, '#7fe8f0');
      box(ctx, x - 0.2 * k, y - 0.28 * k, 1.2 * k, 0.9 * k, 0.28 * k, '#3a5a7a', '#5a8aaa', '#2a4060');
      line(ctx, x - 0.6 * k, y - 0.5 * k, x - 0.6 * k, y - 1.1 * k, 0.1 * k, '#7fe8f0');
      line(ctx, x - 0.6 * k, y - 1.1 * k, x + 0.4 * k, y - 1.1 * k, 0.1 * k, '#7fe8f0');
      ctx.save();
      ctx.translate(x + 0.55 * k, y - 0.75 * k);
      drillBit(ctx, 0, 0, k * 0.7, spin);
      ctx.restore();
      glow(ctx, x + 1.2 * k, y - 0.75 * k, 0.35 * k, '#ff9a3a', on ? 0.7 : 0.2);
      return { x0: x - 1.1 * k, y0: y - 1.4 * k, x1: x + 1.5 * k, y1: y };
    }
    if (o.look === 'resonance') {
      // "Resonanz-Extraktor": tripod with a focusing lens, rings travel to the crystal face while it runs
      line(ctx, x - 0.5 * k, y, x, y - 1.55 * k, 0.07 * k, '#c9d2ea');
      line(ctx, x + 0.5 * k, y, x, y - 1.55 * k, 0.07 * k, '#c9d2ea');
      line(ctx, x, y, x, y - 1.55 * k, 0.05 * k, '#9aa6c8');
      fillRR(ctx, x - 0.32 * k, y - 1.95 * k, 0.64 * k, 0.45 * k, 0.2 * k, '#3c4a72');
      ctx.fillStyle = '#9fe8ff';
      ctx.beginPath();
      ctx.ellipse(x + 0.34 * k, y - 1.72 * k, 0.12 * k, 0.2 * k, 0, 0, Math.PI * 2);
      ctx.fill();
      glow(ctx, x + 0.36 * k, y - 1.72 * k, 0.35 * k, '#9fe8ff', on ? 0.8 : 0.25);
      if (on && !o.reduced)
        for (let r = 0; r < 3; r++) {
          const p = (t * 0.8 + r / 3) % 1;
          ctx.strokeStyle = 'rgba(226,168,255,' + (0.7 * (1 - p)).toFixed(3) + ')';
          ctx.lineWidth = 0.04 * k;
          ctx.beginPath();
          ctx.ellipse(x + 0.5 * k + p * 0.9 * k, y - 1.72 * k, 0.08 * k + p * 0.25 * k, 0.15 * k + p * 0.45 * k, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      fillRR(ctx, x - 0.95 * k, y - 0.5 * k, 0.45 * k, 0.5 * k, 0.06 * k, '#2f2f5a');
      fillRR(ctx, x - 0.9 * k, y - 0.44 * k, 0.35 * k, 0.18 * k, 0.04 * k, on ? '#e2a8ff' : '#4a4f86');
      return { x0: x - 1.1 * k, y0: y - 2.1 * k, x1: x + 1.4 * k, y1: y };
    }
    return null;
  }
  // Schachtlager stages: 2 = shelf with crates, 3 = small silo with a gauge (Schachtlager level 10 / 25)
  function storeRack(ctx, x, y, k, stage, z) {
    const { fillRR, line, crate } = A();
    if (stage === 2) {
      fillRR(ctx, x - 0.95 * k, y - 0.95 * k, 0.12 * k, 0.95 * k, 0.03 * k, '#9a6e48');
      fillRR(ctx, x + 0.75 * k, y - 0.95 * k, 0.12 * k, 0.95 * k, 0.03 * k, '#9a6e48');
      line(ctx, x - 0.95 * k, y - 0.5 * k, x + 0.87 * k, y - 0.5 * k, 0.07 * k, '#c99a6a');
      for (let i = 0; i < 4; i++) crate(ctx, x - 0.7 * k + i * 0.42 * k, y - 0.54 * k, 0.3 * k, '#c4a3ff', '#7f6ad8');
      return;
    }
    fillRR(ctx, x - 1.05 * k, y - 1.45 * k, 0.55 * k, 1.45 * k, 0.25 * k, '#6f7da8');
    fillRR(ctx, x - 1.0 * k, y - 1.3 * k, 0.45 * k, 0.1 * k, 0.04 * k, '#9aa6c8');
    fillRR(ctx, x - 0.92 * k, y - 0.9 * k, 0.3 * k, 0.3 * k, 0.15 * k, '#2f2f5a');
    fillRR(ctx, x - 0.88 * k, y - 0.86 * k, 0.22 * k, 0.22 * k, 0.11 * k, zone(z).light || '#8ff0d4');
  }

  window.MineArt = { ZONES, zone, floorBackground, surfaceBackground, outdoor, buffer, machine, station, wallLamp, elevatorStage, shaftColumn, cabin, headframe, frontier, conduit, frostRig, shade, facePile, rockFace, timberFrame, drillCart, haulTrack, haulLoad, constructionSite, shaftLook, lookRig, storeRack };
})();
