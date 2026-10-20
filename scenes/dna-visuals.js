// Visual Identity round — the DNA visual language: ONE place that maps the game's existing data (Galactic DNA weapons:
// chassis, affinity, rarity, traits; the ship: model, module levels, refits) to how things look. The ship renderer,
// the arena (muzzle flashes, impacts), the combat scene and the UI read their rules from here, so a new chassis, a new
// rarity or a new ship model gets its look by one table entry instead of scattered special cases.
//
//   weapon DNA  →  chassis   = SHAPE  (mount silhouette, projectile, muzzle style, impact style, fire rhythm)
//                  affinity  = COLOUR (glow, projectile, trail, impact tint; a second affinity tints the core)
//                  rarity    = QUALITY (rim colour, glow strength, trail length, sparkles, halo, prismatic shimmer)
//   ship DNA    →  model     = ROLE   (Allrounder, Jäger, Versorger, Präzision, Kaperer, Erkunder: emblem + role colour)
//                  modules   = TIER   (Starter → Erprobt → Veteran → Elite: trim colour, wing-tip lights, pennant)
//                  weapon    = BUILD  (direction Schwarmfeuer / Brecher / Präzision from the chassis; the weapon's
//                                      affinity tints the engine trail from rare up; legendary+ on an Elite hull: aura)
// Pure presentation: nothing here changes a value. Loaded after scenes/art.js, before scenes/ship-art.js. It reads the
// DNA tables (dna.js, loaded later) only when called.
(function () {
  'use strict';
  const TAU = Math.PI * 2;

  // QUALITY: one step per rarity; the colours are those of the Werft frames (dna2-ui.js DNA_RARITY_GLOW)
  const RARITY = {
    // P1.3 parts: what the mount gains with its quality (built parts, not more particles) – band (a rarity ring at the
    // barrel), fins (cooling fins), shroud (a gilded barrel shroud), coil (energy coils along the barrel), shards (two
    // floating prism shards), ring (a halo around the muzzle)
    common: { rank: 0, color: '#9aa2c4', label: 'Gewöhnlich', glow: 0, trail: 1, sparkle: 0, parts: [] },
    uncommon: { rank: 1, color: '#7fe08a', label: 'Ungewöhnlich', glow: 0.15, trail: 1.2, sparkle: 0, parts: [] },
    rare: { rank: 2, color: '#6ab8ff', label: 'Selten', glow: 0.3, trail: 1.6, sparkle: 0, parts: ['band'] },
    epic: { rank: 3, color: '#c07aff', label: 'Episch', glow: 0.45, trail: 1.9, sparkle: 2, parts: ['band', 'fins'] },
    legendary: { rank: 4, color: '#ffc04a', label: 'Legendär', glow: 0.6, trail: 2.2, sparkle: 3, halo: true, parts: ['band', 'fins', 'shroud', 'coil'] },
    mythic: { rank: 5, color: '#ff6ab0', label: 'Mythisch', glow: 0.7, trail: 2.4, sparkle: 3, halo: true, prism: true, parts: ['band', 'fins', 'shroud', 'coil', 'shards'] },
    celestial: { rank: 6, color: '#fff2a8', label: 'Himmlisch', glow: 0.8, trail: 2.6, sparkle: 3, halo: true, prism: true, stars: true, parts: ['band', 'fins', 'shroud', 'coil', 'shards', 'ring'] }
  };
  // COLOUR: the affinity cycle (the same colours as DNA_AFFINITIES; kept here for scenes that load before dna.js)
  // P1.3: trail = how the affinity moves in a shot – drop (a flowing droplet with a wave), ember (glowing sparks fall
  // off), slug (a hard body with speed lines), arc (a crackling zigzag); the colour alone never carries it
  const AFFINITY = {
    hydro: { color: '#7fdcff', core: '#effbff', metal: '#2f5f8a', trail: 'drop', label: 'fließend' },
    thermal: { color: '#ff9a4a', core: '#fff1dc', metal: '#8a3f2a', trail: 'ember', label: 'glühend' },
    kinetic: { color: '#e8e2d0', core: '#ffffff', metal: '#5a5a6e', trail: 'slug', label: 'wuchtig' },
    ion: { color: '#b89aff', core: '#f5efff', metal: '#4a3a8a', trail: 'arc', label: 'knisternd' }
  };
  // SHAPE: what each chassis looks like in a fight (the mount itself is drawn by ship-art.js dnaMount)
  //   muzzle: flicker (small rapid flashes) · blast (one big ring) · charge (a growing glow before the beam) ·
  //           facet (three small prism sparks) · cone (a wide puff) · puff (a smoke ring that rises)
  //   impact: sparks · shock (shock wave) · burn (a hot line) · shards (prism splinters) · pops (small pops) · splash
  const CHASSIS = {
    // P1.3: matter = energy or kinetic (the hit reaction), kick = the recoil of one shot (0 … 1), sound = the sound
    //       design's cue for later (no audio is played from here)
    repeater: { dir: 'Schwarmfeuer', muzzle: 'flicker', impact: 'sparks', rhythm: 'Dauerfeuer', matter: 'kinetic', kick: 0.12, sound: 'tick' },
    heavy: { dir: 'Brecher', muzzle: 'blast', impact: 'shock', rhythm: 'Einzelschuss', matter: 'kinetic', kick: 1, sound: 'boom' },
    lance: { dir: 'Präzision', muzzle: 'charge', impact: 'burn', rhythm: 'Strahl', matter: 'energy', kick: 0.45, sound: 'hum' },
    prism: { dir: 'Schwarmfeuer', muzzle: 'facet', impact: 'shards', rhythm: 'Dreifachstrahl', matter: 'energy', kick: 0.2, sound: 'chime' },
    scatter: { dir: 'Schwarmfeuer', muzzle: 'cone', impact: 'pops', rhythm: 'Fächer', matter: 'kinetic', kick: 0.6, sound: 'crack' },
    mortar: { dir: 'Brecher', muzzle: 'puff', impact: 'splash', rhythm: 'Bogenschuss', matter: 'energy', kick: 0.8, sound: 'thump' }
  };
  // ROLE: the ship models (their real bonuses in combat-ui.js MODEL_INFO decide the role)
  const ROLE = {
    // P1.2 DNA 2.0: module = the role's own silhouette piece from Veteran up (ship-art.js roleModule)
    // P1.3 motion (presentation only; the ship's real speed is the game's): bank = how far it leans into a turn,
    //   settle = how fast it follows the steering (higher = snappier), mass = how hard a recoil or a heavy hit moves it
    Horizon: { role: 'allround', name: 'Allrounder', emblem: 'star', color: '#8fe3ff', module: 'winglets', motion: { bank: 0.22, settle: 9, mass: 1 } },
    Comet: { role: 'striker', name: 'Jäger', emblem: 'chevron', color: '#ff9a4a', module: 'fins', motion: { bank: 0.34, settle: 15, mass: 0.75 } },
    Aegis: { role: 'support', name: 'Versorger', emblem: 'shield', color: '#8ff0b0', module: 'shield', motion: { bank: 0.12, settle: 6, mass: 1.25 } },
    Vanguard: { role: 'precision', name: 'Präzision', emblem: 'cross', color: '#c4b3ff', module: 'lance', motion: { bank: 0.14, settle: 8, mass: 1.05 } },
    Corsair: { role: 'raider', name: 'Kaperer', emblem: 'claw', color: '#ff7a9a', module: 'claws', motion: { bank: 0.28, settle: 12, mass: 1.1 } },
    Pioneer: { role: 'scout', name: 'Erkunder', emblem: 'compass', color: '#ffe08a', module: 'mast', motion: { bank: 0.16, settle: 5, mass: 1.4 } }
  };
  // TIER: the sum of the four module levels (weapon, hull, engine, core; each costs 1.75× the last level)
  // P1.2 DNA 2.0: the silhouette grows with the tier – wingExt (wing tips longer, ship units), nacelle (a ventral module
  // pod), winglets / canards / crest (Elite); the role module from Veteran (ROLE.module)
  const TIERS = [
    // P1.3 DNA 3.0: canopy = the cockpit's frame (0 bubble · 1 struts · 2 HUD visor · 3 armoured gold rim with an
    // antenna), rings = engine cowl rings (Elite: they pulse with the thrust), tail = a tail stabilizer (2 = split tail)
    { tier: 0, min: 0, name: 'Starter', trim: null, lights: 0, wingExt: 0, canopy: 0, rings: 0, tail: 0 },
    { tier: 1, min: 8, name: 'Erprobt', trim: '#c9d2ea', lights: 1, wingExt: 0.05, canopy: 1, rings: 0, tail: 1 },
    { tier: 2, min: 20, name: 'Veteran', trim: '#ffd77a', lights: 2, wingExt: 0.12, nacelle: true, canopy: 2, rings: 1, tail: 1 },
    { tier: 3, min: 40, name: 'Elite', trim: '#ffe9a8', lights: 3, pennant: true, wingExt: 0.18, nacelle: true, winglets: true, canards: true, crest: true, canopy: 3, rings: 2, tail: 2 }
  ];

  // ----- P1.3 Enemy DNA: one row per enemy kind (the arena's ARENA_FOES and CAMPAIGN_ENEMIES keep every value) -----
  //   world   the planet family (its palette, its debris)
  //   size    s · m · l (the explosion size)
  //   motion  how its body moves on top of its path (presentation only; the hit circle stays where the game has it):
  //           hover (bob) · flutter (fast flap) · stamp (hop and land) · creep (slow press forward) · patrol (glide and
  //           turn) · scan (lean and look) · flicker (heat jitter) · lumber (heavy rock) · drift (slow glide) ·
  //           spin (turns around itself) · tick (mechanical steps) · piston (press stroke) · glitch (bursts of jitter) ·
  //           pulse (breathes) · sway (sways from its base) · coil (winds and unwinds) · bob (floats)
  //   hit     the hit reaction: spark · clang (metal) · shatter (ice/crystal) · ember · splinter (wood/plant) · puff
  //   death   the debris shape: crystal · ice · ember · gear · petal · leaf
  const ENEMY = {
    stamp: { world: 'crystal', size: 'm', motion: 'stamp', hit: 'clang', death: 'crystal' },
    moth: { world: 'crystal', size: 's', motion: 'flutter', hit: 'puff', death: 'crystal' },
    clip: { world: 'crystal', size: 'm', motion: 'creep', hit: 'clang', death: 'crystal' },
    scan: { world: 'crystal', size: 'm', motion: 'scan', hit: 'spark', death: 'crystal' },
    seal: { world: 'crystal', size: 'l', motion: 'patrol', hit: 'clang', death: 'crystal' },
    ember: { world: 'volcanic', size: 'm', motion: 'flicker', hit: 'ember', death: 'ember' },
    flake: { world: 'ice', size: 's', motion: 'spin', hit: 'shatter', death: 'ice' },
    shard: { world: 'ice', size: 'm', motion: 'drift', hit: 'shatter', death: 'ice' },
    glacier: { world: 'ice', size: 'l', motion: 'lumber', hit: 'shatter', death: 'ice' },
    chill: { world: 'ice', size: 'm', motion: 'bob', hit: 'puff', death: 'ice' },
    warden: { world: 'ice', size: 'l', motion: 'patrol', hit: 'shatter', death: 'ice' },
    spark: { world: 'volcanic', size: 's', motion: 'flicker', hit: 'ember', death: 'ember' },
    slag: { world: 'volcanic', size: 'm', motion: 'lumber', hit: 'ember', death: 'ember' },
    kiln: { world: 'volcanic', size: 'l', motion: 'lumber', hit: 'clang', death: 'ember' },
    bellows: { world: 'volcanic', size: 'm', motion: 'piston', hit: 'splinter', death: 'ember' },
    forgeguard: { world: 'volcanic', size: 'l', motion: 'lumber', hit: 'clang', death: 'ember' },
    rivet: { world: 'machine', size: 's', motion: 'spin', hit: 'clang', death: 'gear' },
    inspector: { world: 'machine', size: 'm', motion: 'scan', hit: 'spark', death: 'gear' },
    press: { world: 'machine', size: 'l', motion: 'piston', hit: 'clang', death: 'gear' },
    jammer: { world: 'machine', size: 'm', motion: 'glitch', hit: 'spark', death: 'gear' },
    projector: { world: 'machine', size: 'm', motion: 'tick', hit: 'spark', death: 'gear' },
    foreman: { world: 'machine', size: 'l', motion: 'tick', hit: 'clang', death: 'gear' },
    spore: { world: 'verdant', size: 's', motion: 'pulse', hit: 'puff', death: 'petal' },
    thorn: { world: 'verdant', size: 'm', motion: 'coil', hit: 'splinter', death: 'leaf' },
    bark: { world: 'verdant', size: 'l', motion: 'lumber', hit: 'splinter', death: 'leaf' },
    pollen: { world: 'verdant', size: 'm', motion: 'sway', hit: 'puff', death: 'petal' },
    bulb: { world: 'verdant', size: 'm', motion: 'bob', hit: 'puff', death: 'petal' },
    bloomwarden: { world: 'verdant', size: 'l', motion: 'sway', hit: 'splinter', death: 'petal' },
    root: { world: 'verdant', size: 'm', motion: 'pulse', hit: 'splinter', death: 'leaf' }
  };
  /** The body motion of an enemy kind (simulation units dx/dy, radians rot, sx/sy squash) at time u. */
  function enemyMotion(kind, u) {
    const m = ENEMY[kind]?.motion || 'hover',
      o = { dx: 0, dy: 0, rot: 0, sx: 1, sy: 1 };
    if (m === 'flutter') {
      o.dy = Math.sin(u * 7) * 0.9;
      o.dx = Math.sin(u * 2.3) * 0.6;
      o.sx = 1 + Math.sin(u * 14) * 0.08;
    } else if (m === 'stamp') {
      // a hop and a hard landing (squash) every 1.4 s
      const p = (u % 1.4) / 1.4,
        air = p < 0.6 ? Math.sin((p / 0.6) * Math.PI) : 0;
      o.dy = -air * 2.2;
      if (p >= 0.6 && p < 0.72) (o.sy = 0.86), (o.sx = 1.12);
    } else if (m === 'creep') {
      o.dx = -Math.max(0, Math.sin(u * 1.6)) * 0.9;
      o.rot = Math.sin(u * 1.6) * 0.04;
    } else if (m === 'scan') {
      o.rot = Math.sin(u * 0.9) * 0.16;
      o.dy = Math.sin(u * 1.8) * 0.6;
    } else if (m === 'patrol') {
      o.dy = Math.sin(u * 0.8) * 1.2;
      o.rot = Math.cos(u * 0.8) * 0.06;
    } else if (m === 'flicker') {
      o.dx = Math.sin(u * 23) * 0.25;
      o.dy = Math.sin(u * 2.4) * 0.7 + Math.sin(u * 17) * 0.2;
      o.sx = o.sy = 1 + Math.sin(u * 9) * 0.04;
    } else if (m === 'lumber') {
      o.rot = Math.sin(u * 1.1) * 0.07;
      o.dy = Math.abs(Math.sin(u * 1.1)) * -0.7;
    } else if (m === 'drift') {
      o.dx = Math.sin(u * 0.7) * 1.4;
      o.dy = Math.sin(u * 0.5) * 0.6;
      o.rot = Math.sin(u * 0.7) * 0.07;
    } else if (m === 'spin') {
      o.rot = u * 1.6;
      o.dy = Math.sin(u * 2) * 0.5;
    } else if (m === 'tick') {
      const step = Math.floor(u * 3) % 2 ? 1 : -1;
      o.dy = step * 0.55;
      o.rot = step * 0.04;
    } else if (m === 'piston') {
      // a press stroke: slow down, quick up
      const p = (u % 1.2) / 1.2;
      o.sy = p < 0.7 ? 1 - 0.14 * (p / 0.7) : 0.86 + 0.14 * ((p - 0.7) / 0.3);
      o.sx = 2 - o.sy;
    } else if (m === 'glitch') {
      const burst = Math.sin(u * 3.1) > 0.75;
      o.dx = burst ? Math.sin(u * 61) * 0.9 : 0;
      o.dy = burst ? Math.cos(u * 47) * 0.6 : Math.sin(u * 2) * 0.4;
    } else if (m === 'pulse') {
      o.sx = o.sy = 1 + Math.sin(u * 2.6) * 0.08;
      o.dy = Math.sin(u * 1.2) * 0.6;
    } else if (m === 'sway') {
      o.rot = Math.sin(u * 1.6) * 0.16;
      o.dy = Math.sin(u * 1.6) * 0.5;
    } else if (m === 'coil') {
      o.rot = Math.sin(u * 1.3) * 0.5;
      o.sx = o.sy = 1 + Math.sin(u * 2.6) * 0.05;
    } else if (m === 'bob') {
      o.dy = Math.sin(u * 1.5) * 1.1;
      o.sy = 1 + Math.sin(u * 3) * 0.04;
    } else {
      o.dy = Math.sin(u * 2.1) * 1.0;
      o.rot = Math.sin(u * 1.05) * 0.05;
    }
    return o;
  }
  function rarityOf(id) {
    return RARITY[id] || RARITY.common;
  }
  function affinityOf(id) {
    return AFFINITY[id] || AFFINITY.kinetic;
  }
  /** The look of a DNA weapon (null for none). */
  function weaponLook(dna) {
    if (!dna) return null;
    const stats = typeof dnaStats === 'function' ? safe(() => dnaStats(dna)) : null,
      second = stats?.affinity2 ? affinityOf(stats.affinity2) : null,
      aff = affinityOf(dna.affinity);
    return {
      chassis: dna.chassis,
      shape: CHASSIS[dna.chassis] || CHASSIS.repeater,
      color: aff.color,
      core: second ? second.color : aff.core,
      metal: aff.metal,
      rarity: rarityOf(dna.rarity),
      rarityId: dna.rarity || 'common'
    };
  }
  function safe(f) {
    try {
      return f();
    } catch {
      return null;
    }
  }
  function shipTier(gear) {
    const sum = (gear?.weapon || 0) + (gear?.hull || 0) + (gear?.engine || 0) + (gear?.core || 0);
    let t = TIERS[0];
    for (const x of TIERS) if (sum >= x.min) t = x;
    return t;
  }
  /** The ship's DNA as one readable record: role, tier, build and the effects that follow from them. */
  function shipLook(model, gear, dna) {
    const role = ROLE[model] || ROLE.Horizon,
      tier = shipTier(gear),
      weapon = weaponLook(dna);
    const rank = weapon ? weapon.rarity.rank : 0;
    return {
      role,
      tier,
      weapon,
      build: weapon ? weapon.shape.dir : null,
      // the engine trail takes the weapon's colour from rare up (the build shows in motion)
      trail: weapon && rank >= 2 ? weapon.color : null,
      // the wow moment is earned: an Elite hull with a legendary-or-better weapon
      aura: weapon && tier.tier >= 3 && rank >= 4 ? weapon.rarity.color : null
    };
  }
  /** One short line for the UI: "Jäger · Veteran · Brecher (Legendär)". */
  function shipText(model, gear, dna) {
    const s = shipLook(model, gear, dna);
    return [s.role.name, s.tier.name, s.build ? s.build + (s.weapon.rarity.rank >= 2 ? ' (' + s.weapon.rarity.label + ')' : '') : null].filter(Boolean).join(' · ');
  }

  // ----- drawing helpers (local ship units; the caller sets the transform) -----
  function star(ctx, x, y, r, fill) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU - Math.PI / 2,
        rr = i % 2 ? r * 0.45 : r;
      i ? ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }
  /** The role emblem as a small decal (r = radius). */
  function drawEmblem(ctx, emblem, x, y, r, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(20,24,60,0.75)';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = r * 0.22;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const q = r * 0.55;
    ctx.beginPath();
    if (emblem === 'star') star(ctx, 0, 0, q * 1.05, color);
    else if (emblem === 'chevron') {
      ctx.moveTo(-q * 0.7, -q);
      ctx.lineTo(q * 0.3, 0);
      ctx.lineTo(-q * 0.7, q);
      ctx.moveTo(-q * 0.1, -q);
      ctx.lineTo(q * 0.9, 0);
      ctx.lineTo(-q * 0.1, q);
      ctx.stroke();
    } else if (emblem === 'shield') {
      ctx.moveTo(-q * 0.8, -q * 0.8);
      ctx.lineTo(q * 0.8, -q * 0.8);
      ctx.quadraticCurveTo(q * 0.8, q * 0.5, 0, q);
      ctx.quadraticCurveTo(-q * 0.8, q * 0.5, -q * 0.8, -q * 0.8);
      ctx.fill();
    } else if (emblem === 'cross') {
      ctx.arc(0, 0, q * 0.7, 0, TAU);
      ctx.moveTo(-q, 0);
      ctx.lineTo(q, 0);
      ctx.moveTo(0, -q);
      ctx.lineTo(0, q);
      ctx.stroke();
    } else if (emblem === 'claw') {
      for (const dx of [-0.5, 0, 0.5]) {
        ctx.moveTo(dx * q - q * 0.2, -q * 0.8);
        ctx.quadraticCurveTo(dx * q + q * 0.3, 0, dx * q - q * 0.1, q * 0.8);
      }
      ctx.stroke();
    } else if (emblem === 'compass') {
      ctx.moveTo(0, -q);
      ctx.lineTo(q * 0.35, 0);
      ctx.lineTo(0, q);
      ctx.lineTo(-q * 0.35, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  /** Rarity sparkles around a point (epic and up), deterministic in time. */
  function drawSparkles(ctx, x, y, r, rarity, time) {
    if (!rarity?.sparkle) return;
    for (let i = 0; i < rarity.sparkle; i++) {
      const a = time * 1.6 + (i / rarity.sparkle) * TAU,
        d = r * (1 + 0.25 * Math.sin(time * 3 + i)),
        c = rarity.prism ? ['#ff9ecb', '#8fe3ff', '#ffe26b', '#c4b3ff', '#8ff0d4'][i % 5] : rarity.color;
      star(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, r * 0.18 * (0.7 + 0.3 * Math.sin(time * 5 + i * 2)), c);
    }
  }
  function glow(ctx, x, y, r, color, alpha) {
    if (window.NebulaArt?.glowCircle) return window.NebulaArt.glowCircle(ctx, x, y, r, color, alpha);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  /**
   * The muzzle flash of a weapon (canvas px; s = scale, k = 0..1 age of the flash, dir = shot direction in rad).
   * Shape by chassis, colour by affinity, size and sparkle by rarity.
   */
  function drawMuzzle(ctx, x, y, s, look, k, dir = 0) {
    const shape = look?.shape?.muzzle || 'flicker',
      c = look?.color || '#8fe3ff',
      boost = 1 + (look?.rarity?.glow || 0) * 0.6,
      fade = 1 - k;
    if (shape === 'blast') {
      glow(ctx, x, y, s * 7 * boost * fade, c, 0.85 * fade);
      ctx.strokeStyle = c;
      ctx.globalAlpha = fade;
      ctx.lineWidth = Math.max(1.5, s * 1.2);
      ctx.beginPath();
      ctx.arc(x, y, s * (3 + 7 * k), 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (shape === 'charge') {
      glow(ctx, x, y, s * (3 + 4 * (1 - fade)) * boost, c, 0.9 * fade);
      glow(ctx, x, y, s * 1.6, '#ffffff', fade);
    } else if (shape === 'facet') {
      for (const a of [-0.45, 0, 0.45]) {
        const px = x + Math.cos(dir + a) * s * 4,
          py = y + Math.sin(dir + a) * s * 4;
        star(ctx, px, py, s * 1.8 * boost * fade, c);
      }
      glow(ctx, x, y, s * 3.5 * fade, c, 0.6 * fade);
    } else if (shape === 'cone') {
      ctx.fillStyle = c;
      ctx.globalAlpha = 0.65 * fade;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, s * 7 * boost, dir - 0.45, dir + 0.45);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (shape === 'puff') {
      ctx.strokeStyle = 'rgba(230,230,245,' + (0.7 * fade).toFixed(2) + ')';
      ctx.lineWidth = Math.max(1.5, s * 1.4);
      ctx.beginPath();
      ctx.arc(x, y - s * 4 * k, s * (2.5 + 4 * k), 0, TAU);
      ctx.stroke();
      glow(ctx, x, y, s * 4 * fade, c, 0.6 * fade);
    } else {
      // flicker: a small sharp flash, alternating size
      glow(ctx, x, y, s * (2.5 + (k < 0.5 ? 1.5 : 0)) * boost, c, 0.85 * fade);
      glow(ctx, x, y, s * 1.1, '#ffffff', fade);
    }
    if (look?.rarity?.sparkle && k < 0.6) drawSparkles(ctx, x, y, s * 5, look.rarity, k * 4);
  }
  /** Extra rarity sparkle on an impact (epic and up): drawn on top of the chassis' own impact. */
  function drawImpactFlair(ctx, x, y, s, look, k) {
    if (!look?.rarity?.sparkle || k > 0.7) return;
    drawSparkles(ctx, x, y, s * (3 + 4 * k), look.rarity, k * 3);
    if (look.rarity.halo) {
      ctx.strokeStyle = look.rarity.color;
      ctx.globalAlpha = 0.8 * (1 - k);
      ctx.lineWidth = Math.max(1, s * 0.6);
      ctx.beginPath();
      ctx.arc(x, y, s * (2 + 6 * k), 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  // ----- P1.2 cosmetics on top of the DNA (never instead of it) -----
  // A hull signature (Commerce slot 'decal') sits on the ship's other wing: the bigger wing carries the role emblem
  // (DNA), the other one the player's own mark. A muzzle style (slot 'muzzle') adds an ornament to the DNA muzzle flash
  // (the chassis shape and the affinity colour stay readable). An impact look (slot 'impact') adds sparkles in its colour
  // to a hit (the weapon's own impact flair stays).
  const DECALS = {
    'decal-paw': { kind: 'paw', color: '#ff9ecb', rim: '#ffffff' },
    'decal-pips': { kind: 'seal', color: '#e0565a', rim: '#fff4e2' },
    'decal-comet': { kind: 'comet', color: '#ffd77a', rim: '#fff6d6' }
  };
  const MUZZLES = {
    'muzzle-star': { kind: 'star', color: '#ffe26b' },
    'muzzle-heart': { kind: 'heart', color: '#ff7aa8' }
  };
  function heart(ctx, x, y, r, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(x, y + r * 0.9);
    ctx.bezierCurveTo(x - r * 1.4, y - r * 0.1, x - r * 0.6, y - r * 1.1, x, y - r * 0.35);
    ctx.bezierCurveTo(x + r * 0.6, y - r * 1.1, x + r * 1.4, y - r * 0.1, x, y + r * 0.9);
    ctx.fill();
  }
  /** The hull signature decal (r = radius, local ship units). */
  function drawDecal(ctx, id, x, y, r) {
    const d = DECALS[id];
    if (!d) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(20,24,60,0.6)';
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.25, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = d.rim;
    ctx.lineWidth = r * 0.16;
    ctx.stroke();
    ctx.fillStyle = d.color;
    if (d.kind === 'seal') {
      // P.I.P.S.' inspection seal: a red stamp face with a white tick
      ctx.beginPath();
      ctx.rect(-r * 0.62, -r * 0.62, r * 1.24, r * 1.24);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = r * 0.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-r * 0.35, 0);
      ctx.lineTo(-r * 0.08, r * 0.28);
      ctx.lineTo(r * 0.38, -r * 0.3);
      ctx.stroke();
      ctx.lineCap = 'butt';
    } else if (d.kind === 'paw') {
      ctx.beginPath();
      ctx.ellipse(0, r * 0.25, r * 0.48, r * 0.38, 0, 0, TAU);
      ctx.fill();
      for (const [dx, dy] of [[-0.55, -0.25], [-0.2, -0.6], [0.2, -0.6], [0.55, -0.25]]) {
        ctx.beginPath();
        ctx.arc(dx * r, dy * r, r * 0.19, 0, TAU);
        ctx.fill();
      }
    } else {
      // a comet: the head and three tail strokes
      ctx.beginPath();
      ctx.arc(r * 0.35, -r * 0.3, r * 0.32, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = d.color;
      ctx.lineCap = 'round';
      for (const [w, o] of [[0.16, 0], [0.1, 0.28], [0.1, -0.28]]) {
        ctx.lineWidth = r * w;
        ctx.beginPath();
        ctx.moveTo(r * 0.15 + o * r * 0.3, -r * 0.1 + o * r * 0.3);
        ctx.lineTo(-r * 0.7 + o * r * 0.3, r * 0.6 + o * r * 0.3);
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
    }
    ctx.restore();
  }
  /** The muzzle ornament of a muzzle style (k = 0..1 age of the flash). */
  function drawMuzzleOrnament(ctx, x, y, s, id, k) {
    const m = MUZZLES[id];
    if (!m) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - k);
    if (m.kind === 'heart') heart(ctx, x + s * 3 * k, y - s * 3.5 * k, s * (2.2 - k * 0.8), m.color);
    else for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i - 1) * 0.9;
      star(ctx, x + Math.cos(a) * s * (2 + k * 5), y + Math.sin(a) * s * (2 + k * 5), s * (1.4 - k * 0.6), m.color);
    }
    ctx.restore();
  }
  /** Sparkles of an impact look around a hit (color from the forge looks). */
  function drawImpactSparkles(ctx, x, y, s, color, k, seed = 0) {
    if (!color) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - k);
    for (let i = 0; i < 4; i++) {
      const a = seed + (i / 4) * TAU,
        d = s * (2.5 + k * 7);
      star(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, s * (1.1 - k * 0.5), color);
    }
    ctx.restore();
  }
  window.DnaVisuals = { ENEMY, enemyMotion, RARITY, AFFINITY, CHASSIS, ROLE, TIERS, DECALS, MUZZLES, rarityOf, affinityOf, weaponLook, shipTier, shipLook, shipText, drawEmblem, drawSparkles, drawMuzzle, drawImpactFlair, drawDecal, drawMuzzleOrnament, drawImpactSparkles };
})();
