// Beta 1.4 M4 — Combat 2.0: the spatial arena (logic only; drawing in scenes/arena-scene.js, UI in arena-ui.js).
//
// A 160 × 90 arena: the ship holds the left edge and steers up and down, enemies enter from the right — several at
// once — move by family (swarms home in, heavy ones grind forward, ranged ones keep their distance, summoners call
// help, elites shield, the Glutgeist drifts in close), and shoot real projectiles. Every projectile flies, collides
// (circle tests) and either hits or leaves the arena. The simulation advances in fixed steps of 1/30 s from an
// accumulator, so a fight gives the same result for any tick or frame rate; its random numbers come from a seed made
// of the campaign, the wave and the attempt number.
//
// Builds decide the fight: the ship's base shot (attack() without Aim/Overcharge and without the old weakness bonus,
// i.e. weapon level, core, crew, Arsenal, research …) × the mounted DNA weapon's chassis, rarity and affixes × the
// affinity matchup; fire rate = shipFireRate() (Boba, engine) × chassis rate; hull = shipHullMax() minus the ship's
// persistent damage. Tikki flies along (her Funkenbolzen every 3 s). Two manual abilities, never automatic: Schildpuls
// (absorbs enemy shots for 2.5 s) and Overcharge-Salve (double fire rate for 3 s, shots break armour and seal shields).
// Damage taken comes only from enemy projectiles and swarm contact — the classic wave clock (campaignAdvance) does not
// run during an arena wave, so nothing is counted twice.
//
// Nothing here runs offline or in the background: the arena clock only advances while the fight is on screen. A wave
// is not saved mid-fight — a reload ends it without reward or penalty (the hull damage already taken stays, as the
// ship's persistent damage). Rewards use the campaign's claim ledger (first clear pays once).
// Loaded after dna.js, before game.js.

const ARENA = { W: 160, H: 90, DT: 1 / 30, SHIP_X: 18, SHIP_R: 6, SHIP_SPEED: 30, MAX_ALIVE: 4, SAFETY: 300, MAX_SHOTS: 80, MAX_FOE_SHOTS: 60 };
const ARENA_DAMAGE = 0.6; // enemy projectile damage vs the classic per-shot value (several shoot at once; tuned with tools/arena-balance.mjs)
const ARENA_ABILITIES = {
  shield: { name: 'Schildpuls', short: 'Schild', icon: '🛡', seconds: 2.5, cooldown: 14, text: 'Fängt 2,5 s lang alle feindlichen Schüsse ab' },
  salvo: { name: 'Overcharge-Salve', short: 'Salve', icon: '⚡', seconds: 3, cooldown: 16, text: '3 s doppelte Feuerrate; Schüsse brechen Panzer und Siegelschild' }
};
// Movement and shots per enemy kind (arena units; hp/atk/every/armor/shield/callAfter come from CAMPAIGN_ENEMIES).
const ARENA_FOES = {
  stamp: { r: 5, speed: 22, anchor: [108, 132], shotSpeed: 70, shotR: 1.6 },
  moth: { r: 3.6, speed: 24, home: 1.6, shotSpeed: 55, shotR: 1.2, contact: 2 },
  clip: { r: 6.5, speed: 9, anchor: [90, 104], shotSpeed: 45, shotR: 2.6 },
  scan: { r: 5, speed: 18, anchor: [132, 146], shotSpeed: 95, shotR: 1.3 },
  seal: { r: 9, speed: 10, anchor: [116, 128], shotSpeed: 50, shotR: 3.2 },
  // the Glutgeist (elemental, Thermo): drifts close and throws embers; only in the arena
  ember: { r: 6, speed: 16, anchor: [78, 94], shotSpeed: 62, shotR: 2.4, hp: 80, atk: 7, every: 2.1 },
  // Beta 1.5: P.I.P.S., the inspection robot, as the arena boss of Orion (authored pattern: arenaBossStep)
  pips: { r: 12, speed: 14, anchor: [120, 124], shotSpeed: 74, shotR: 1.8, atk: 9, every: 7 },
  // Beta 1.5 · Glacies: the Frostwacht (chill = seconds the hit ship fires at 60 %) and Frostbyte
  flake: { r: 3.8, speed: 26, home: 1.9, shotSpeed: 55, shotR: 1.2, contact: 2.2 },
  shard: { r: 4.8, speed: 22, anchor: [104, 130], shotSpeed: 92, shotR: 1.4 },
  glacier: { r: 7, speed: 8, anchor: [88, 102], shotSpeed: 44, shotR: 2.8 },
  chill: { r: 5.4, speed: 16, anchor: [126, 146], shotSpeed: 48, shotR: 2.6, chill: 2.5 },
  warden: { r: 9, speed: 10, anchor: [114, 128], shotSpeed: 52, shotR: 3.2 },
  frostbyte: { r: 13, speed: 12, anchor: [118, 126], shotSpeed: 70, shotR: 2, atk: 10, every: 9 }
};
const ARENA_CHILL_FACTOR = 0.6; // fire rate while chilled (the Salve thaws the ship at once)
// Beta 1.6 — Combat 3.0:
// * Perfekte Parade: a shot that meets the Schildpuls in its first 0.35 s is thrown back at its sender (×2.5 of one ship
//   shot); the first parade of a pulse returns 3 s of the shield's cooldown. At most three parades per pulse.
// * Fokusziel: a tap on an enemy makes it the ship's target until it falls (auto-targeting otherwise).
// * Overkill: the gun skips an enemy whose shots already in flight will finish it, if another enemy is in reach.
// * New roles: support (heals, barriers, heat guard on an ally), disruptor (fast, jams the abilities), artillery
//   (lobbed shots that land where the ship was; the landing is marked).
const ARENA_PARRY = { window: 0.35, share: 2.5, refund: 3, max: 3, speed: 130 };
const ARENA_GUARD_FACTOR = 0.5; // an ally under a heat guard takes half (the Salve burns through)
// Bosses beyond P.I.P.S. and Frostbyte register their authored pattern and damage rule here (outer-campaigns.js):
//   ARENA_BOSS_STEPS[kind](a, foe, def, dt) · ARENA_BOSS_DAMAGE[kind](a, foe, factor, { salvo, source }) → factor
const ARENA_BOSS_STEPS = {};
const ARENA_BOSS_DAMAGE = {};
// Boss fights per campaign (the guardian at the end of the waves). hp/atk scale with the planet's last wave.
const ARENA_BOSSES = { crystal: { kind: 'pips', hp: 2600, phase2: 0.5, summon: ['stamp', 'stamp'] }, ice: { kind: 'frostbyte', hp: 5200, phase2: 0.5, summon: ['flake', 'flake', 'flake'] } };
// Frostbyte's 9-s cycle (7.5 s in phase 2), as fractions of the cycle:
//   0.08–0.26 Eiszapfen (four aimed shards) · 0.52 the Frostatem is announced (a blue line to the ship)
//   0.68 the Frostatem: five slow frost orbs in a fan that chill the ship (Schildpuls blocks them)
// Crystal plates: three plates take 85 % of every hit; each hit during the Salve cracks one (and goes through in full).
// Without plates he thaws for 6 s and takes 150 %; then the plates grow back.
const FB_ARENA = { length: 9, phase2: 7.5, shards: [0.08, 0.14, 0.2, 0.26], telegraph: 0.52, breath: 0.68, breathShots: 5, breathSpread: 0.17, breathSpeed: 40, breathDamage: 1.3, chill: 3, plates: 3, plateFactor: 0.15, thawFor: 6, thawFactor: 1.5 };
// P.I.P.S.' 7-s inspection cycle (5.6 s in phase 2), as fractions of the cycle:
//   0.05/0.12/0.19 Prüfsalve (three aimed bolts) · 0.36–0.71 Prüfschild (×0.2, the Salve breaks it for 2.5 s)
//   0.57 the Prüfstempel is announced (a red scan line to where the ship is) · 0.71 the stamp flies (heavy, slow)
const PIPS_CYCLE = { length: 7, phase2: 5.6, bolts: [0.05, 0.12, 0.19], shield: [0.36, 0.71], telegraph: 0.57, stamp: 0.71, stampDamage: 2.6, shieldFactor: 0.2, breakFor: 2.5 };
// Arena waves = the campaign's foes plus the Glutgeist on two waves (the elemental family of the Orion slice).
const ARENA_WAVE_EXTRA = { crystal: { 4: ['ember'], 6: ['ember'] } }; // waves 5 and 7 (tuned with tools/arena-balance.mjs)
const ARENA_GAP = { moth: 0.45, flake: 0.45, seal: 2.6, warden: 2.6, default: 1.6 };

function arenaFoeStats(kind, key, wave) {
  const boss = Object.values(ARENA_BOSSES).find(b => b.kind === kind);
  if (boss) {
    const w = CAMPAIGNS[key].waves.length - 1;
    return { hp: boss.hp, atk: ARENA_FOES[kind].atk * (1 + ENEMY_DAMAGE_SCALE * w) * (CAMPAIGNS[key]?.dmgScale || 1) * (typeof crewActive === 'function' && crewActive(1) ? BOBA_DODGE : 1) * ARENA_DAMAGE, every: ARENA_FOES[kind].every, armor: 0, shield: null, callAfter: 0, elite: true };
  }
  const c = CAMPAIGN_ENEMIES[kind],
    a = ARENA_FOES[kind];
  // a guardian's reinforcements fight at the strength of the campaign's last wave (before Beta 1.6 the wave id 'boss'
  // made their numbers NaN, and the summons vanished in the step they arrived)
  if (wave === 'boss') wave = CAMPAIGNS[key].waves.length - 1;
  const hp = c ? waveEnemyHp(key, wave, kind) : Math.round(a.hp * (1 + WAVE_SCALE * wave) * (CAMPAIGNS[key]?.hpScale || 1)),
    atk = (c ? enemyShotDamage(key, wave, kind) : a.atk * (1 + ENEMY_DAMAGE_SCALE * wave) * (CAMPAIGNS[key]?.dmgScale || 1) * (typeof crewActive === 'function' && crewActive(1) ? BOBA_DODGE : 1)) * ARENA_DAMAGE;
  return { hp, atk, every: c ? c.every : a.every, armor: c?.armor || 0, shield: c?.shield || null, callAfter: c?.callAfter || 0, calls: c?.calls || null, elite: Boolean(c?.elite) };
}
function arenaWaveFoes(key, wave) {
  if (wave === 'boss') return [ARENA_BOSSES[key].kind];
  const base = CAMPAIGNS[key].waves[wave].foes.slice(),
    extra = ARENA_WAVE_EXTRA[key]?.[wave] || [];
  // the Glutgeist joins in the middle of the wave
  extra.forEach((kind, i) => base.splice(Math.min(base.length, Math.floor(base.length / 2) + i), 0, kind));
  return base;
}
function arenaRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The ship's numbers for one wave, fixed at the start (a build is chosen before the fight).
function arenaLoadout() {
  const dna = typeof mountedDna === 'function' ? mountedDna() : null,
    weaponAff = WEAPON_AFFINITY[state.ship.weaponType] || 'kinetic',
    stats = dna ? dnaStats(dna) : { rate: 1, damage: 1, boss: 0, pierce: 0, count: 1, spread: 0, splash: 0, chain: 0, strong: DNA_STRONG, speed: 900, size: 3, fire: 'stream', projectile: 'bolt' },
    plain = typeof shipPlainDamage === 'function' ? shipPlainDamage() : attack(),
    base = plain / Math.max(1e-9, weaponBonus()); // the old weakness bonus is replaced by the affinity matchup
  return {
    shot: base,
    affinity: dna ? dna.affinity : weaponAff,
    chassis: dna ? dna.chassis : null,
    stats,
    // Beta 1.5 refits: heavy armour makes the ship slower to steer and to fire; cooling fires faster
    rate: shipFireRate() * stats.rate * refitFactor('rate'),
    speed: ARENA.SHIP_SPEED * refitFactor('speed'),
    shieldSeconds: ARENA_ABILITIES.shield.seconds + refitFactor('shield') + (typeof techHas === 'function' && techHas('shieldCap') ? 0.5 : 0),
    // Beta 1.7 M8: the Ausweich-Assistent (research) – a reflex while the player does not steer
    dodgeAssist: typeof techHas === 'function' && techHas('dodgeAssist'),
    // Beta 1.6 DNA 2.0: Brennlinie (lance) burns 80 % through armour; Würgebohrung (scatter) has no falloff
    armorPierce: stats.signature === 'burnline' ? 0.8 : DNA_CHASSIS[dna?.chassis]?.armorPierce ?? null,
    falloff: stats.signature === 'choke' ? 0 : DNA_CHASSIS[dna?.chassis]?.falloff || 0,
    affinity2: stats.affinity2 || null,
    close: DNA_CHASSIS[dna?.chassis]?.close || 0,
    cat: typeof catUnlocked === 'function' && catUnlocked() && typeof catStrikeDamage === 'function' ? catStrikeDamage('auto') / Math.max(1e-9, weaponBonus()) : 0,
    catEvery: typeof TIKKI !== 'undefined' ? TIKKI.strikeEveryMs / 1000 : 3
  };
}
// A fresh arena for one wave. `hull` = the ship's current hull points (persistent damage already subtracted).
// Beta 1.7 M10: manual dodging. The player drags anywhere on the fight (relative to where the finger went down, so
// it never covers the ship); the ship flies to the chosen lane faster than it steers by itself. Shooting stays
// automatic. Until the first drag the ship steers itself as before (idle players are unchanged); after it the ship
// holds the player's lane. Deterministic like everything in the arena (the input is applied at the next fixed step).
const ARENA_DODGE = { speed: 2.2, lane: [8, ARENA.H - 8], near: 7 };
function arenaSteer(a, dy) {
  if (!a || a.result || !Number.isFinite(dy)) return false;
  const [lo, hi] = ARENA_DODGE.lane;
  a.manualY = Math.max(lo, Math.min(hi, (a.manual ? a.manualY : a.ship.y) + dy));
  if (!a.manual) a.stats.steered = 1;
  a.manual = true;
  return true;
}
// P1.5 — the ship's combat control: three automations, kept apart (docs/p1-5-manual-combat/COMBAT.md).
//   fire  'auto' the gun fires at its rate while enemies are on the field · 'hold' only while the player holds FEUER
//   aim   0 straight ahead along the ship's forward axis (+x): a shot goes where the ship points – nothing is corrected,
//           a miss stays a miss; the player aims by flying the ship into an enemy's line
//         1 the guns turn up to ±10° toward the nearest enemy in that cone, at where it is now (it may move away)
//         2 up to ±20°, ahead of a moving enemy; the Fokusziel and the overkill check count
//         3 free aim over the whole field (the ship's targeting of every build before P1.5)
//   fly   { lane, dodge, zones }: follow the target's lane · the reflex away from a shot about to hit (still needs the
//         Ausweich-Assistent research) · the guardians' announced safe places. A drag always takes the flight over for
//         the rest of the fight (Beta 1.7). Without any of them the ship holds its lane until the player moves it.
// A shot always flies by the arena's rules: a straight line (an arc for the mortar), never steered after it left the
// gun – except by the Zielsucher trait, whose turn is limited, slower without Auto-Aim, and visible in its trail.
// arenaCreate's default is the full control (every headless fight and every test of the mechanics keeps the old rules);
// the game passes the player's own control (arena-ui.js arenaControl).
const ARENA_AIM_LEVELS = [
  { cone: 0, hold: 0 },
  { cone: (10 * Math.PI) / 180, hold: 0.6, lead: false, smart: false },
  { cone: (20 * Math.PI) / 180, hold: 0.3, lead: true, smart: true },
  { cone: Math.PI, hold: 0, free: true }
];
const ARENA_CONTROL_FULL = Object.freeze({ fire: 'auto', aim: 3, fly: Object.freeze({ lane: true, dodge: true, zones: true }) });
const ARENA_LOB_RANGE = 95; // a mortar shot without a target lands this far ahead of the muzzle
const ARENA_SEEK_CONE = (15 * Math.PI) / 180; // without Auto-Aim the Zielsucher only finds what is nearly ahead
// Handzielen: a shot aimed by the player alone (no Auto-Aim) hits 15 % harder – automation is comfort, aiming is skill
// (tools/p15-control-balance.mjs: without it a flying player loses the close Petalguard fight the automation wins)
const ARENA_HAND_AIM = 1.15;
function arenaControlOf(a) {
  return a.control || ARENA_CONTROL_FULL;
}
// the FEUER button (fire 'hold'): pressed or released; the gun fires at its rate while it is held
function arenaTrigger(a, on) {
  if (!a || a.result) return false;
  a.trigger = Boolean(on);
  return true;
}
// where the guns point now (an angle from the forward axis) and at whom (null: straight ahead) – only within the aim
// level's cone, measured from the muzzle; a level keeps its enemy for a moment before it switches (hold)
function arenaAim(a, from) {
  const C = arenaControlOf(a),
    lvl = ARENA_AIM_LEVELS[Math.max(0, Math.min(3, C.aim | 0))];
  if (!lvl.cone) return { ang: 0, target: null };
  if (lvl.free) {
    const t = arenaTarget(a);
    return t ? { ang: Math.atan2(t.y - from.y, t.x - from.x), target: t } : { ang: 0, target: null };
  }
  const inCone = f => f.hp > 0 && !f.untargetable && f.x > from.x + 2 && f.x < ARENA.W - 2 && Math.abs(Math.atan2(f.y - from.y, f.x - from.x)) <= lvl.cone;
  let t = a.aimLock && a.t < a.aimLock.until ? a.foes.find(f => f.id === a.aimLock.id && inCone(f)) : null;
  if (!t) {
    const pool = a.foes.filter(inCone);
    if (lvl.smart) {
      const focus = pool.find(f => f.id === a.focus);
      t = focus || pool.filter(f => !(f.incoming >= f.hp)).sort((p, q) => p.x - q.x || p.id - q.id)[0] || pool.sort((p, q) => p.x - q.x || p.id - q.id)[0] || null;
    } else t = pool.sort((p, q) => Math.abs(p.y - from.y) - Math.abs(q.y - from.y) || p.x - q.x || p.id - q.id)[0] || null;
    if (t) a.aimLock = { id: t.id, until: a.t + lvl.hold };
  }
  if (!t) return { ang: 0, target: null };
  let tx = t.x,
    ty = t.y;
  if (lvl.lead && Number.isFinite(t.px) && Number.isFinite(t.py)) {
    // ahead of a moving enemy: where it will be when the shot arrives (its motion of the last step, straight on)
    const sp = Math.max(40, (a.loadout.stats.speed || 900) / 6),
      fly = Math.hypot(tx - from.x, ty - from.y) / sp;
    tx += ((t.x - t.px) / ARENA.DT) * fly;
    ty += ((t.y - t.py) / ARENA.DT) * fly;
  }
  const ang = Math.max(-lvl.cone, Math.min(lvl.cone, Math.atan2(ty - from.y, tx - from.x)));
  return { ang, target: t };
}
// the enemies a straight ray crosses, nearest first (a ray from `from` at angle `ang`)
function arenaRayHits(a, from, ang) {
  const dx = Math.cos(ang),
    dy = Math.sin(ang);
  return a.foes
    .filter(f => f.hp > 0 && !f.untargetable && f.x > from.x)
    .map(f => ({ f, along: (f.x - from.x) * dx + (f.y - from.y) * dy, off: Math.abs((f.x - from.x) * dy - (f.y - from.y) * dx) }))
    .filter(o => o.along > 0 && o.off <= o.f.r + 1.5)
    .sort((p, q) => p.along - q.along)
    .map(o => o.f);
}
// a ship shot that left without touching anything (the scene shows where it went; the hit rate counts it)
function arenaMiss(a, x, y) {
  a.stats.misses = (a.stats.misses || 0) + 1;
  arenaEvent(a, { type: 'miss', x, y });
}
// the assistant's reflex: the lane away from the first shot that would hit within 0.4 s (null = nothing to dodge)
function arenaReflex(a) {
  const ship = a.ship;
  for (const s of a.foeShots) {
    if (s.lob || !(s.vx < 0) || s.x < ship.x) continue;
    const t = (s.x - ship.x) / -s.vx;
    if (t > 0.4) continue;
    const y = s.y + s.vy * t;
    if (Math.abs(y - ship.y) >= s.r + ARENA.SHIP_R + 1) continue;
    const away = y >= ship.y ? -1 : 1,
      lane = ship.y + away * 14;
    a.stats.assisted = (a.stats.assisted || 0) + 1;
    return lane < 10 || lane > ARENA.H - 10 ? ship.y - away * 14 : lane;
  }
  return null;
}
function arenaCreate(key, wave, attempt, hull, hullMax, loadout = arenaLoadout()) {
  const seed = (dnaHash(key + ':' + wave) ^ Math.imul(attempt + 1, 2654435761)) >>> 0;
  return {
    key,
    wave,
    boss: wave === 'boss' ? ARENA_BOSSES[key].kind : null,
    seed,
    rng: seed,
    t: 0,
    acc: 0,
    step: 0,
    nextId: 1,
    loadout,
    ship: { x: ARENA.SHIP_X, y: ARENA.H / 2, hull, hullMax, gun: 0.4, cat: 1.5, shieldUntil: 0, shieldAt: -9, parryLeft: 0, refunded: true, salvoUntil: 0, chillUntil: 0, ready: { shield: 0, salvo: 0 }, hits: 0 },
    focus: 0,
    queue: arenaWaveFoes(key, wave),
    assist: typeof campaignAssist === 'function' ? campaignAssist(key, wave) : 0, // Beta 1.6: Rückenwind (lost attempts)
    spawned: 0,
    nextSpawn: 0.6,
    lastKind: null,
    foes: [],
    shots: [],
    foeShots: [],
    events: [],
    stats: { kills: 0, crashed: 0, dealt: 0, taken: 0, absorbed: 0, shots: 0, hits: 0, reduced: 0, strong: 0, weak: 0, abilities: 0, calls: 0, parries: 0, overkill: 0, jams: 0, aids: 0, steered: 0, dodged: 0 },
    manual: false,
    manualY: ARENA.H / 2,
    result: null
  };
}
function arenaRand(a) {
  const r = arenaRng(a.rng)();
  a.rng = (a.rng + 0x6d2b79f5) >>> 0;
  return r;
}
function arenaEvent(a, e) {
  a.eventSeq = (a.eventSeq || 0) + 1;
  a.events.push({ ...e, t: a.t, seq: a.eventSeq });
  if (a.events.length > 200) a.events.splice(0, a.events.length - 200);
}
function arenaSpawn(a, kind, called = false) {
  const f = ARENA_FOES[kind],
    s = arenaFoeStats(kind, a.key, a.wave),
    d = enemyDna(kind, a.seed + a.nextId),
    y = 12 + arenaRand(a) * (ARENA.H - 24);
  const foe = {
    id: a.nextId++,
    kind,
    family: d.family,
    affinity: d.affinity,
    x: ARENA.W + f.r,
    y,
    lane: y,
    phase: arenaRand(a) * Math.PI * 2,
    anchor: f.anchor ? f.anchor[0] + arenaRand(a) * (f.anchor[1] - f.anchor[0]) : 0,
    r: f.r,
    hp: s.hp,
    maxHp: s.hp,
    atk: s.atk,
    every: s.every,
    armor: s.armor,
    shield: s.shield,
    callAfter: s.callAfter,
    calls: s.calls,
    elite: s.elite,
    t: 0,
    nextShot: ENEMY_FIRST_SHOT + arenaRand(a) * 0.8,
    brokenUntil: 0,
    called: false,
    hitFlash: 0,
    incoming: 0, // damage of the ship's shots already flying at it (overkill check)
    barrier: 0, // absorbs damage first (a support's barrier)
    guardUntil: 0, // heat guard of a support: half damage until then (fight time)
    nextAid: f.support ? f.support.first || 2.5 : 0
  };
  // Beta 1.9 M9: a Wächter-Revanche – every foe of the fight is stronger by its level (rematch.js)
  if (a.rematch && typeof rematchScale === 'function') {
    const r = rematchScale(a.rematch);
    foe.hp = foe.maxHp = Math.max(1, Math.round(foe.hp * r.hp));
    foe.atk *= r.atk;
  }
  if (a.assist) {
    const k = campaignAssistFactors(a.assist);
    foe.hp = foe.maxHp = Math.max(1, Math.round(foe.hp * k.hp));
    foe.atk *= k.dmg;
  }
  a.foes.push(foe);
  arenaEvent(a, { type: 'spawn', id: foe.id, kind, called });
  return foe;
}
function arenaSealPhase(foe) {
  if (!foe.shield) return null;
  if (foe.t < foe.brokenUntil) return 'broken';
  const at = foe.t % foe.shield.every;
  return at >= foe.shield.from ? 'shield' : at >= foe.shield.warn ? 'warn' : 'open';
}
// Beta 1.6: the matchup of the loadout against an enemy affinity; a second affinity (Doppelaffinität) counts only where it
// is strong (half the bonus) and never makes a hit weak.
function arenaAffinity(L, defender) {
  const first = affinityFactor(L.affinity, defender, L.stats.strong);
  if (!L.affinity2) return first;
  const second = affinityFactor(L.affinity2, defender, 1 + (L.stats.strong - 1) * DNA_DUAL_STRONG);
  return second > 1 ? Math.max(first, second) : first;
}
// One hit of a player projectile; returns the damage done.
// proj = what hit (bolt, shell, ray, pellet, orb, chain, spark, reflect): only for the scene's impact effect
function arenaDamage(a, foe, share = 1, source = 'ship', proj = null) {
  const L = a.loadout,
    salvo = a.t < a.ship.salvoUntil && source === 'ship';
  let factor = source === 'cat' ? 1 : arenaAffinity(L, foe.affinity);
  // P1.3: what caught the hit, for the scene (a shield ripple vs a hull hit); presentation only, no value reads it
  let guard = null;
  if (factor > 1) a.stats.strong++;
  else if (factor < 1) a.stats.weak++;
  if (source === 'ship' && (foe.elite || foe.family === 'boss')) factor *= 1 + (L.stats.boss || 0);
  // the chassis' role against this enemy family (dna.js DNA_CHASSIS vs)
  if (source === 'ship' && L.stats.vs?.[foe.family]) factor *= L.stats.vs[foe.family];
  // the DNA tuning (dna.js DNA_TUNES): Störerjagd is weaker against the rest, Einzelstrahl stronger on the tapped enemy
  if (source === 'ship' && L.stats.tune === 'hunt' && !DNA_TUNES.hunt.prey.includes(foe.family)) factor *= DNA_TUNES.hunt.others;
  if (source === 'ship' && L.stats.tune === 'aim' && a.focus === foe.id) factor *= DNA_TUNES.aim.tapped;
  // armour: the chassis decides how much goes through (heavy shells punch through, rapid bolts glance off)
  if (foe.armor && !salvo && source !== 'cat') {
    factor *= L.armorPierce ?? foe.armor;
    a.stats.reduced++;
    guard = 'armor';
  } else if (foe.armor && source === 'cat') factor *= foe.armor;
  // close-range weapons (the scatter gun): ×1.5 point-blank, losing punch over distance
  if (L.falloff && source === 'ship') {
    const dist = Math.hypot(foe.x - a.ship.x, foe.y - a.ship.y);
    if (L.close && dist < L.close) factor *= 1.5;
    else if (dist > L.falloff) factor *= Math.max(0.6, 1 - (dist - L.falloff) / 120);
  }
  // Frostbyte's crystal plates: ×0.15; a Salve hit cracks one and goes through; no plates = thawed, ×1.5
  if (foe.kind === 'frostbyte' && source !== 'cat' && foe.plates !== undefined) {
    if (foe.plates > 0 && foe.t < (foe.sigOpenUntil || 0) && !salvo) {
      // P1.3: after the Frostwand his plates stand open – everything goes through for a moment
    } else if (foe.plates > 0) {
      if (salvo) {
        foe.plates--;
        arenaEvent(a, { type: 'plate-crack', id: foe.id, plates: foe.plates });
        if (!foe.plates) {
          foe.thawUntil = foe.t + FB_ARENA.thawFor;
          arenaEvent(a, { type: 'thaw-boss', id: foe.id, until: a.t + FB_ARENA.thawFor });
        }
      } else {
        factor *= FB_ARENA.plateFactor;
        a.stats.reduced++;
        guard = 'plates';
      }
    } else if (foe.t < foe.thawUntil) factor *= FB_ARENA.thawFactor;
  } else if (foe.kind === 'frostbyte' && source === 'cat' && foe.plates > 0) factor *= FB_ARENA.plateFactor;
  // the boss's inspection shield: ×0.2, broken for 2.5 s by the Overcharge-Salve
  if (foe.family === 'boss' && foe.shieldOn) {
    if (salvo) {
      foe.brokenUntil = foe.t + PIPS_CYCLE.breakFor;
      foe.shieldOn = false;
      arenaEvent(a, { type: 'shield-break', id: foe.id, boss: true });
    } else {
      factor *= PIPS_CYCLE.shieldFactor;
      a.stats.reduced++;
      guard = 'shield';
    }
  }
  const phase = arenaSealPhase(foe);
  if (phase === 'shield') {
    if (salvo) {
      foe.brokenUntil = foe.t + foe.shield.breakFor;
      arenaEvent(a, { type: 'shield-break', id: foe.id });
    } else {
      factor *= foe.shield.factor;
      a.stats.reduced++;
      guard = 'shield';
    }
  }
  // Beta 1.6: a registered boss decides its own rule (Emberbell's pressure, Cogsworth's Taktband, Petalguard's bloom)
  const bossRule = ARENA_BOSS_DAMAGE[foe.kind];
  if (bossRule) {
    const before = factor;
    factor = bossRule(a, foe, factor, { salvo, source });
    if (factor < before) guard = guard || 'shield';
  }
  // a support's heat guard halves the damage; the Salve burns through it
  if (foe.guardUntil > a.t && !salvo) {
    factor *= ARENA_GUARD_FACTOR;
    a.stats.reduced++;
    guard = guard || 'shield';
  }
  let dmg = (source === 'cat' ? L.cat : L.shot * L.stats.damage) * share * factor;
  // a support's barrier soaks damage first; one Salve hit shatters it
  if (foe.barrier > 0 && dmg > 0) {
    const soak = salvo ? foe.barrier : Math.min(foe.barrier, dmg);
    foe.barrier -= soak;
    if (!salvo) guard = 'barrier';
    if (!salvo) dmg -= soak;
    if (foe.barrier <= 0) {
      foe.barrier = 0;
      arenaEvent(a, { type: 'barrier-break', id: foe.id, x: foe.x, y: foe.y });
    }
  }
  const before = foe.hp;
  foe.hp = Math.max(0, foe.hp - dmg);
  foe.hitFlash = 0.12;
  // Erschütterung (DNA tuning): the hit pushes the enemy's next shot back (never past one full cycle, never a guardian)
  if (source === 'ship' && L.stats.tune === 'stagger' && foe.family !== 'boss' && foe.every > 0 && dmg > 0 && foe.hp > 0) {
    const pushed = Math.min(foe.nextShot + DNA_TUNES.stagger.delay, foe.t + foe.every);
    if (pushed > foe.nextShot) {
      foe.nextShot = pushed;
      a.stats.staggered = (a.stats.staggered || 0) + 1;
    }
  }
  a.stats.dealt += before - foe.hp;
  a.stats.hits++;
  arenaEvent(a, { type: 'hit', id: foe.id, x: foe.x, y: foe.y, damage: dmg, factor, source, proj, guard });
  if (foe.hp <= 0 && before > 0) {
    a.stats.kills++;
    arenaEvent(a, { type: 'kill', id: foe.id, kind: foe.kind, x: foe.x, y: foe.y, boss: foe.family === 'boss' });
    if (foe.family === 'boss') {
      a.bossDown = true;
      for (const other of a.foes) if (other !== foe && other.hp > 0) (other.hp = 0), arenaEvent(a, { type: 'flee', id: other.id, x: other.x, y: other.y });
    }
  }
  return dmg;
}
// The ship's target: the player's focus while it lives, else the nearest enemy whose death is not already in flight
// (overkill); if every enemy in reach is already covered, the nearest one.
function arenaTarget(a, exclude = null) {
  const ok = f => f.hp > 0 && f.id !== exclude && f.x < ARENA.W - 2 && !f.untargetable;
  if (a.focus) {
    const f = a.foes.find(x => x.id === a.focus);
    if (f && ok(f)) return f;
  }
  // Störerjagd (DNA tuning): the prey families first, nearest first, while one is in reach
  const prey = a.loadout?.stats?.tune === 'hunt' ? DNA_TUNES.hunt.prey : null;
  let best = null,
    spare = null;
  for (const f of a.foes) {
    if (!ok(f)) continue;
    if (prey && !prey.includes(f.family) && a.foes.some(o => ok(o) && prey.includes(o.family))) continue;
    const covered = f.incoming >= f.hp;
    if (covered) {
      if (!spare || f.x < spare.x || (f.x === spare.x && f.id < spare.id)) spare = f;
    } else if (!best || f.x < best.x || (f.x === best.x && f.id < best.id)) best = f;
  }
  return best || spare;
}
// Expected damage of one ship shot on this enemy (for the overkill check only; no side effects)
function arenaEstimate(a, f) {
  const L = a.loadout;
  let k = arenaAffinity(L, f.affinity);
  if (f.armor) k *= L.armorPierce ?? f.armor;
  k *= L.stats.vs?.[f.family] || 1;
  if (L.stats.tune === 'hunt' && !DNA_TUNES.hunt.prey.includes(f.family)) k *= DNA_TUNES.hunt.others;
  return L.shot * L.stats.damage * k;
}
// A tap on an enemy (or 0 to clear): the ship keeps it as its target until it falls.
function arenaFocus(a, id) {
  if (!a || a.result) return false;
  const f = id ? a.foes.find(x => x.id === id && x.hp > 0 && !x.untargetable) : null;
  if (id && !f) return false;
  a.focus = f ? f.id : 0;
  arenaEvent(a, { type: 'focus', id: a.focus });
  return true;
}
// The enemy under a tap at simulation point (x, y), with a forgiving radius for fingers (null if none).
function arenaFoeAt(a, x, y, slack = 7) {
  let best = null,
    bestD = Infinity;
  for (const f of a?.foes || []) {
    if (f.hp <= 0 || f.untargetable) continue;
    const d = Math.hypot(f.x - x, f.y - y) - f.r;
    if (d <= slack && d < bestD) (best = f), (bestD = d);
  }
  return best;
}
// Player fire: one trigger of the gun in the chassis' fire mode.
function arenaFire(a) {
  const L = a.loadout,
    s = L.stats,
    ship = a.ship,
    from = { x: ship.x + 7, y: ship.y },
    speed = Math.max(40, (s.speed || 900) / 6),
    free = arenaControlOf(a).aim >= 3,
    // P1.5: with free aim the gun picks its target as before; otherwise it fires where the aim level points it
    aim = free ? null : arenaAim(a, from),
    target = free ? arenaTarget(a) : aim.target;
  if (free && !target) return;
  const ang0 = free ? Math.atan2(target.y - from.y, target.x - from.x) : aim.ang;
  ship.aimAng = ang0;
  a.stats.shots++;
  arenaEvent(a, { type: 'fire', fire: s.fire, x: from.x, y: from.y, ang: ang0 });
  if (!free && (s.fire === 'beam' || s.fire === 'split')) {
    // P1.5: rays where the guns point – a lance burns along its line, a prism fans its rays around it; each ray hits
    // what it crosses (nothing is pulled onto a target)
    const n = s.fire === 'split' ? Math.max(1, s.count) : 1,
      share = (s.fire === 'split' ? s.rayShare || 1 : 1) * (arenaControlOf(a).aim ? 1 : ARENA_HAND_AIM),
      touched = [];
    for (let i = 0; i < n; i++) {
      a.stats.proj = (a.stats.proj || 0) + 1; // P1.5: every ray and every projectile counts for the hit rate
      const ang = ang0 + (n > 1 ? (i - (n - 1) / 2) * 0.09 : 0),
        hits = arenaRayHits(a, from, ang).slice(0, s.fire === 'beam' ? 1 + s.pierce : 1);
      if (!hits.length) {
        const end = { x: from.x + Math.cos(ang) * 160, y: from.y + Math.sin(ang) * 160 };
        arenaEvent(a, { type: 'ray', x0: from.x, y0: from.y, x1: end.x, y1: end.y, miss: true });
        arenaMiss(a, Math.min(ARENA.W, end.x), Math.max(0, Math.min(ARENA.H, end.y)));
        continue;
      }
      for (const f of hits) {
        arenaEvent(a, { type: 'ray', x0: from.x, y0: from.y, x1: f.x, y1: f.y });
        arenaDamage(a, f, share, 'ship', 'ray');
        arenaChain(a, f);
        touched.push(f);
      }
    }
    if (s.cosmic === 'aurora' && s.fire === 'beam' && touched.length) {
      const last = touched[touched.length - 1],
        next = a.foes.filter(f => f.hp > 0 && !touched.includes(f) && !f.untargetable).sort((p, q) => Math.hypot(p.x - last.x, p.y - last.y) - Math.hypot(q.x - last.x, q.y - last.y))[0];
      if (next) {
        arenaEvent(a, { type: 'chain', x0: last.x, y0: last.y, x1: next.x, y1: next.y, cosmic: true });
        arenaDamage(a, next, 0.6, 'ship', 'chain');
      }
    }
    return;
  }
  if (s.fire === 'beam' || s.fire === 'split') {
    // instant rays: a lance pierces along its line, a prism splits onto the nearest targets
    const hitList = [];
    if (s.fire === 'beam') {
      const dx = target.x - from.x,
        dy = target.y - from.y,
        len = Math.hypot(dx, dy) || 1;
      a.foes
        .filter(f => f.hp > 0 && f.x > from.x)
        .map(f => ({ f, along: ((f.x - from.x) * dx + (f.y - from.y) * dy) / len, off: Math.abs((f.x - from.x) * dy - (f.y - from.y) * dx) / len }))
        .filter(o => o.along > 0 && o.off <= o.f.r + 1.5)
        .sort((p, q) => p.along - q.along)
        .slice(0, 1 + s.pierce)
        .forEach(o => hitList.push(o.f));
      if (!hitList.includes(target)) hitList.unshift(target);
    } else {
      // Störerjagd (DNA tuning): the prey families take the first rays
      const prey = s.tune === 'hunt' ? DNA_TUNES.hunt.prey : null,
        sorted = a.foes.filter(f => f.hp > 0 && f.x < ARENA.W - 2 && !f.untargetable).sort((p, q) => (prey ? Number(prey.includes(q.family)) - Number(prey.includes(p.family)) : 0) || p.x - q.x || p.id - q.id);
      // Bündelung (legendary prism): a lone enemy takes every ray at 70 %
      if (s.signature === 'bundle' && sorted.length === 1) for (let i = 0; i < s.count; i++) hitList.push(sorted[0]);
      // Beta 1.9 M8: Störerjagd on the prism bundles every ray on the first prey (before, its rays reached the prey
      // anyway and the tuning changed nothing – docs/gameplay-loop/BALANCE.md)
      else if (prey && sorted[0] && prey.includes(sorted[0].family)) for (let i = 0; i < s.count + s.pierce; i++) hitList.push(sorted[0]);
      else hitList.push(...sorted.slice(0, s.count + s.pierce));
    }
    const share = s.fire === 'split' ? (s.signature === 'bundle' && hitList.length > 1 && hitList.every(f => f === hitList[0]) ? 0.7 : s.rayShare || 1) : 1;
    a.stats.proj = (a.stats.proj || 0) + hitList.length;
    for (const f of hitList) {
      arenaEvent(a, { type: 'ray', x0: from.x, y0: from.y, x1: f.x, y1: f.y });
      arenaDamage(a, f, share, 'ship', 'ray');
      arenaChain(a, f);
    }
    // Polarlicht (celestial lance): the beam jumps once more, to the nearest enemy it did not touch
    if (s.cosmic === 'aurora' && s.fire === 'beam') {
      const last = hitList[hitList.length - 1],
        next = a.foes.filter(f => f.hp > 0 && !hitList.includes(f) && !f.untargetable).sort((p, q) => Math.hypot(p.x - last.x, p.y - last.y) - Math.hypot(q.x - last.x, q.y - last.y))[0];
      if (last && next) {
        arenaEvent(a, { type: 'chain', x0: last.x, y0: last.y, x1: next.x, y1: next.y, cosmic: true });
        arenaDamage(a, next, 0.6, 'ship', 'chain');
      }
    }
    return;
  }
  a.volleys = (a.volleys || 0) + 1;
  // Pulsar (celestial repeater): every 5th volley adds two bolts in a fan
  const pulsar = s.cosmic === 'pulsar' && a.volleys % 5 === 0;
  const n = s.fire === 'spread' ? s.count : pulsar ? 3 : 1,
    est = target ? arenaEstimate(a, target) : 0;
  if (pulsar) arenaEvent(a, { type: 'cosmic', id: 'pulsar', x: from.x, y: from.y });
  for (let i = 0; i < n; i++) {
    if (a.shots.length >= ARENA.MAX_SHOTS) arenaShotGone(a, a.shots.shift());
    a.stats.proj = (a.stats.proj || 0) + 1;
    const ang = ang0 + (n > 1 ? (i - (n - 1) / 2) * (pulsar ? 0.12 : s.spread) : 0);
    // Salvenrhythmus (legendary repeater): every 4th bolt pierces one more
    a.bolts = (a.bolts || 0) + 1;
    const pierce = s.pierce + (s.signature === 'rhythm' && a.bolts % 4 === 0 ? 1 : 0);
    // the overkill check counts what is flying at the target (the scatter gun's centre pellet only)
    const track = target && (n === 1 || i === (n - 1) / 2) ? est : 0;
    if (target) target.incoming += track;
    if (s.fire === 'lob') {
      // P1.5: with a target the mortar lands on it (as before). Without one it keeps its direction (straight down the
      // line); only its range is set – by the first enemy the line crosses (the gun's rangefinder), else ARENA_LOB_RANGE
      const inLine = target ? null : arenaRayHits(a, from, ang)[0],
        range = target ? 0 : inLine ? Math.max(20, Math.hypot(inLine.x - from.x, inLine.y - from.y)) : ARENA_LOB_RANGE,
        tx = target ? target.x : Math.min(ARENA.W - 4, from.x + Math.cos(ang) * range),
        ty = target ? target.y : Math.max(4, Math.min(ARENA.H - 4, from.y + Math.sin(ang) * range)),
        tt = Math.hypot(tx - from.x, ty - from.y) / speed;
      a.shots.push({ id: a.nextId++, kind: 'lob', x: from.x, y: from.y, x0: from.x, y0: from.y, tx, ty, life: tt, age: 0, r: 2.4, pierce: 0, hit: [], tid: target ? target.id : 0, est: track, ...(free || arenaControlOf(a).aim ? {} : { share: ARENA_HAND_AIM }) });
    } else a.shots.push({ id: a.nextId++, kind: s.projectile, x: from.x, y: from.y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, r: s.projectile === 'shell' ? 2.4 : 1.4, pierce, hit: [], life: 4, age: 0, tid: target ? target.id : 0, est: track, seek: Boolean(s.seek), cone: !free, heavy: pierce > s.pierce, ...(free || arenaControlOf(a).aim ? {} : { share: ARENA_HAND_AIM }) });
  }
}
// a ship shot that hit its target or left: it no longer counts as incoming
function arenaShotGone(a, p) {
  if (!p?.est) return;
  const f = a.foes.find(x => x.id === p.tid);
  if (f) f.incoming = Math.max(0, f.incoming - p.est);
  p.est = 0;
}
// Druckwelle (legendary heavy): neighbours of the hit take 25 %; Supernova (celestial heavy): a kill explodes (40 %)
function arenaShellRules(a, f) {
  const s = a.loadout.stats;
  if (s.signature === 'shockwave') {
    arenaEvent(a, { type: 'blast', x: f.x, y: f.y, r: 8, small: true });
    for (const o of a.foes) if (o !== f && o.hp > 0 && Math.hypot(o.x - f.x, o.y - f.y) <= 8 + o.r) arenaDamage(a, o, 0.25, 'ship', 'shell');
  }
  if (s.cosmic === 'supernova' && f.hp <= 0) {
    arenaEvent(a, { type: 'cosmic', id: 'supernova', x: f.x, y: f.y });
    arenaEvent(a, { type: 'blast', x: f.x, y: f.y, r: 12 });
    for (const o of a.foes) if (o !== f && o.hp > 0 && Math.hypot(o.x - f.x, o.y - f.y) <= 12 + o.r) arenaDamage(a, o, 0.4, 'ship', 'shell');
  }
}
function arenaChain(a, from) {
  const s = a.loadout.stats;
  if (!s.chain) return;
  a.chainCount = (a.chainCount || 0) + 1;
  if (a.chainCount % 3) return;
  const next = arenaTarget(a, from.id);
  if (!next) return;
  arenaEvent(a, { type: 'chain', x0: from.x, y0: from.y, x1: next.x, y1: next.y });
  arenaDamage(a, next, s.chain, 'ship', 'chain');
}
function arenaSplash(a, x, y, share = 1, echo = false) {
  const s = a.loadout.stats,
    radius = Math.max(6, (s.splash || 0) / 6);
  arenaEvent(a, { type: 'blast', x, y, r: radius, echo });
  for (const f of a.foes) if (f.hp > 0 && Math.hypot(f.x - x, f.y - y) <= radius + f.r) arenaDamage(a, f, share, 'ship', 'orb');
  if (echo) return;
  // Streumunition (legendary mortar): three bomblets around the impact
  if (s.signature === 'cluster')
    for (let i = 0; i < 3; i++) {
      const bx = x + Math.cos((i / 3) * Math.PI * 2 + 0.5) * radius * 0.9,
        by = y + Math.sin((i / 3) * Math.PI * 2 + 0.5) * radius * 0.9;
      arenaEvent(a, { type: 'blast', x: bx, y: by, r: 4, small: true });
      for (const f of a.foes) if (f.hp > 0 && Math.hypot(f.x - bx, f.y - by) <= 4 + f.r) arenaDamage(a, f, 0.3, 'ship', 'orb');
    }
  // Ereignishorizont (celestial mortar): the blast echoes 0.4 s later at 50 %
  if (s.cosmic === 'horizon') (a.echoes = a.echoes || []).push({ x, y, at: a.t + 0.4 });
}
function arenaAbility(a, id) {
  const ab = ARENA_ABILITIES[id];
  if (!ab || a.result || a.t < a.ship.ready[id]) return false;
  a.ship.ready[id] = a.t + ab.cooldown;
  if (id === 'shield') {
    a.ship.shieldUntil = a.t + (a.loadout.shieldSeconds || ab.seconds);
    // the parade window opens with the pulse
    a.ship.shieldAt = a.t;
    a.ship.parryLeft = ARENA_PARRY.max;
    a.ship.refunded = false;
  }
  else {
    a.ship.salvoUntil = a.t + ab.seconds;
    // the Salve's heat thaws a chilled ship at once
    if (a.t < (a.ship.chillUntil || 0)) {
      a.ship.chillUntil = 0;
      arenaEvent(a, { type: 'thaw' });
    }
  }
  a.stats.abilities++;
  arenaEvent(a, { type: 'ability', id });
  return true;
}
function arenaHurt(a, damage, cause) {
  const ship = a.ship;
  if (a.t < ship.shieldUntil) {
    a.stats.absorbed += damage;
    arenaEvent(a, { type: 'absorb', x: ship.x, y: ship.y });
    return 0;
  }
  ship.hull = Math.max(0, ship.hull - damage);
  ship.hits++;
  a.lastHurt = a.t;
  a.stats.taken += damage;
  arenaEvent(a, { type: 'ship-hit', damage, cause, hull: ship.hull });
  return damage;
}

// Gameplay loop: which straight shots are about to come, for the scene's aim lines. A shot flies at where the ship is
// when it is fired, so the line from the enemy to the ship in its last ARENA_AIM.from of the charge says "move now".
// Artillery has its own landing marks and guardians their telegraphs; at most ARENA_AIM.max lines (the closest to firing).
const ARENA_AIM = { from: 0.7, max: 2 };
function arenaAimWarnings(a) {
  if (!a || a.result) return [];
  return a.foes
    .filter(f => f.hp > 0 && f.family !== 'boss' && !f.untargetable && f.every > 0 && !ARENA_FOES[f.kind]?.lob && f.x < ARENA.W - 2)
    .map(f => ({ id: f.id, x: f.x, y: f.y, charge: 1 - (f.nextShot - f.t) / Math.max(0.1, f.every) }))
    .filter(w => w.charge >= ARENA_AIM.from && w.charge < 1)
    .sort((p, q) => q.charge - p.charge || p.id - q.id)
    .slice(0, ARENA_AIM.max)
    .map(w => ({ ...w, tx: a.ship.x, ty: a.ship.y }));
}
// One enemy shot: straight at the ship, or lobbed (artillery) at where the ship is now (the landing is marked).
function arenaFoeShot(a, f, def, o = {}) {
  const ship = a.ship,
    kind = o.kind || f.kind,
    damage = o.damage ?? f.atk,
    lob = o.lob || def.lob;
  if (a.foeShots.length >= ARENA.MAX_FOE_SHOTS) a.foeShots.shift();
  if (lob) {
    const tx = ship.x,
      ty = Math.max(8, Math.min(ARENA.H - 8, ship.y + (o.offset || 0)));
    a.foeShots.push({ id: a.nextId++, kind, lob: true, from: f.id, x: f.x - f.r, y: f.y, x0: f.x - f.r, y0: f.y, tx, ty, life: lob.flight, age: 0, r: lob.radius, damage, ...(o.extra || {}) });
    arenaEvent(a, { type: 'mark', id: f.id, kind, x: tx, y: ty, r: lob.radius, until: a.t + lob.flight });
  } else {
    const ang = Math.atan2(ship.y - f.y, ship.x - f.x) + (o.spread || 0),
      speed = o.speed || def.shotSpeed;
    a.foeShots.push({ id: a.nextId++, kind, from: f.id, x: f.x - f.r, y: f.y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, r: o.r || def.shotR, damage, age: 0, ...(def.chill ? { chill: def.chill } : {}), ...(def.jam ? { jam: def.jam } : {}), ...(o.extra || {}) });
  }
  arenaEvent(a, { type: 'foe-fire', id: f.id, kind });
}
// A support's help for one ally: heal (the most hurt), barrier (the biggest without one) or heat guard (the front one).
function arenaAid(a, f, S) {
  const allies = a.foes.filter(o => o !== f && o.hp > 0 && o.family !== 'boss' && !o.untargetable && o.x < ARENA.W - 2);
  let to = null;
  if (S.type === 'heal') to = allies.filter(o => o.hp < o.maxHp).sort((p, q) => p.hp / p.maxHp - q.hp / q.maxHp || p.id - q.id)[0];
  else if (S.type === 'barrier') to = allies.filter(o => o.barrier <= 0).sort((p, q) => q.maxHp - p.maxHp || p.id - q.id)[0];
  else to = allies.filter(o => o.guardUntil <= a.t).sort((p, q) => p.x - q.x || p.id - q.id)[0];
  if (!to) return null;
  if (S.type === 'heal') to.hp = Math.min(to.maxHp, to.hp + to.maxHp * S.amount);
  else if (S.type === 'barrier') to.barrier = to.maxHp * S.amount;
  else to.guardUntil = a.t + S.seconds;
  a.stats.aids++;
  arenaEvent(a, { type: 'aid', aid: S.type, id: f.id, to: to.id, x0: f.x, y0: f.y, x1: to.x, y1: to.y });
  return to;
}
// Perfekte Parade: the shield met the shot in its first moments — the shot flies back at its sender.
function arenaParry(a, s) {
  const ship = a.ship;
  if (!(a.t < ship.shieldUntil) || a.t - ship.shieldAt > ARENA_PARRY.window || ship.parryLeft <= 0) return false;
  ship.parryLeft--;
  a.stats.parries++;
  a.stats.absorbed += s.damage;
  if (!ship.refunded) {
    ship.refunded = true;
    ship.ready.shield = Math.max(a.t, ship.ready.shield - ARENA_PARRY.refund);
  }
  const back = a.foes.find(f => f.id === s.from && f.hp > 0 && !f.untargetable) || arenaTarget(a);
  if (back) {
    if (a.shots.length >= ARENA.MAX_SHOTS) arenaShotGone(a, a.shots.shift());
    const ang = Math.atan2(back.y - ship.y, back.x - ship.x);
    a.shots.push({ id: a.nextId++, kind: 'reflect', reflect: true, tid: back.id, est: 0, x: ship.x + 6, y: ship.y, vx: Math.cos(ang) * ARENA_PARRY.speed, vy: Math.sin(ang) * ARENA_PARRY.speed, r: 2.2, pierce: 0, hit: [], life: 3, age: 0, share: ARENA_PARRY.share });
  }
  arenaEvent(a, { type: 'parry', x: ship.x, y: ship.y, kind: s.kind, to: back?.id || 0 });
  return true;
}
// A jamming hit: both abilities wait `seconds` longer (an ability that was ready waits that long; never past a full cooldown).
function arenaJam(a, seconds) {
  const ship = a.ship;
  for (const id of Object.keys(ARENA_ABILITIES)) ship.ready[id] = Math.min(Math.max(ship.ready[id], a.t) + seconds, a.t + ARENA_ABILITIES[id].cooldown);
  a.stats.jams++;
  arenaEvent(a, { type: 'jam', until: a.t + seconds });
}

// One fixed step of 1/30 s.
function arenaStep(a) {
  const dt = ARENA.DT,
    ship = a.ship;
  a.t += dt;
  a.step++;
  // previous positions for the scene's interpolation between two fixed steps
  ship.py = ship.y;
  for (const f of a.foes) (f.px = f.x), (f.py = f.y);
  for (const p of a.shots) (p.px = p.x), (p.py = p.y);
  for (const q of a.foeShots) (q.px = q.x), (q.py = q.y);
  // spawns: in order, with a short gap (swarms in quick bursts), never more than MAX_ALIVE at once
  const alive = a.foes.filter(f => f.hp > 0).length;
  if (a.spawned < a.queue.length && a.t >= a.nextSpawn && alive < ARENA.MAX_ALIVE) {
    const kind = a.queue[a.spawned++];
    arenaSpawn(a, kind);
    a.nextSpawn = a.t + (kind === 'moth' && a.queue[a.spawned] === 'moth' ? ARENA_GAP.moth : ARENA_GAP[kind] || ARENA_GAP.default);
  }
  // ship: steers toward its target's height (slowly — a moving ship dodges some aimed shots, not all)
  // Beta 1.7 M10: after the player's first drag the ship flies to the player's lane (faster), else it steers itself
  // (Beta 1.7 M8: with the Ausweich-Assistent it sidesteps a shot that would hit within 0.4 s)
  while (a.sigSafe?.next && a.t >= a.sigSafe.until) a.sigSafe = a.sigSafe.next;
  // P1.5: each part of the self-steering is its own automation (arenaControlOf: lane, dodge, zones)
  const fly = arenaControlOf(a).fly || {};
  const target = arenaTarget(a),
    reflex = !a.manual && fly.dodge && a.loadout.dodgeAssist ? arenaReflex(a) : null,
    // P1.3: an announced signature zone (a guardian's raster or wall): the self-steering ship reads it like a player
    // and flies to the safe place until the attack has passed; a steering player decides alone
    // P1.4: a chain of safe places (Emberbell's rings: one gap after the other) and a moving one (Petalguard's path)
    sig = !a.manual && fly.zones && a.sigSafe && a.t < a.sigSafe.until ? a.sigSafe : null,
    safe = sig ? (sig.path ? arenaPathY(sig.path, a.t) : sig.y) : null,
    wantY = a.manual ? a.manualY : safe !== null ? safe : reflex !== null ? reflex : !fly.lane ? ship.y : target ? Math.max(10, Math.min(ARENA.H - 10, target.y)) : ARENA.H / 2,
    speed = (a.loadout.speed || ARENA.SHIP_SPEED) * (a.manual ? ARENA_DODGE.speed : reflex !== null || safe !== null ? 1.5 : 1),
    move = Math.max(-speed * dt, Math.min(speed * dt, wantY - ship.y));
  ship.y += move;
  // P1.4: Cogsworth's conveyor carries the ship (and a resting finger's lane) toward the laser lane; steering out works
  // against it (the ship is faster than the belt)
  if (a.belt && a.t < a.belt.until) {
    const pull = (y, dist) => (Math.abs(a.belt.y - y) < a.belt.reach ? Math.sign(a.belt.y - y) * Math.min(Math.abs(a.belt.y - y), dist) : 0);
    ship.y += pull(ship.y, a.belt.speed * dt);
    if (a.manual) a.manualY += pull(a.manualY, a.belt.speed * dt);
  }
  // guns
  const rate = a.loadout.rate * (a.t < ship.salvoUntil ? 2 : a.t < (ship.chillUntil || 0) ? ARENA_CHILL_FACTOR : 1);
  ship.gun -= dt;
  // P1.5: Auto-Fire shoots while enemies are on the field; with FEUER held the player decides (the gun keeps its rate)
  const armed = arenaControlOf(a).fire === 'hold' ? Boolean(a.trigger) : Boolean(target);
  if (ship.gun <= 0 && armed) {
    ship.gun += 1 / rate;
    arenaFire(a);
  } else if (ship.gun < 0) ship.gun = 0;
  if (a.loadout.cat > 0) {
    ship.cat -= dt;
    if (ship.cat <= 0 && target) {
      ship.cat += a.loadout.catEvery;
      if (a.shots.length >= ARENA.MAX_SHOTS) arenaShotGone(a, a.shots.shift());
      const ang = Math.atan2(target.y - (ship.y - 9), target.x - ship.x);
      a.shots.push({ id: a.nextId++, kind: 'spark', cat: true, x: ship.x + 2, y: ship.y - 9, vx: Math.cos(ang) * 110, vy: Math.sin(ang) * 110, r: 1.6, pierce: 0, hit: [], life: 3, age: 0 });
      arenaEvent(a, { type: 'cat-fire', x: ship.x, y: ship.y - 9 });
    } else if (ship.cat < 0) ship.cat = 0;
  }
  // enemies move, shoot, call
  for (const f of a.foes) {
    if (f.hp <= 0) continue;
    const def = ARENA_FOES[f.kind];
    f.t += dt;
    f.hitFlash = Math.max(0, f.hitFlash - dt);
    if (f.family === 'boss') {
      arenaBossStep(a, f, def, dt);
      continue;
    }
    if (f.family === 'swarm') {
      // home in on the ship and crash into it
      f.x -= def.speed * dt;
      f.y += Math.max(-def.home * 10 * dt, Math.min(def.home * 10 * dt, ship.y - f.y)) + Math.sin(f.t * 3 + f.phase) * 0.35;
      if (Math.hypot(f.x - ship.x, f.y - ship.y) <= f.r + ARENA.SHIP_R) {
        arenaHurt(a, f.atk * def.contact, f.kind);
        f.hp = 0;
        a.stats.crashed++;
        arenaEvent(a, { type: 'crash', id: f.id, x: f.x, y: f.y });
        continue;
      }
      if (f.x < -10) f.x = ARENA.W + f.r; // missed: circles back in
    } else if (f.x > f.anchor) f.x = Math.max(f.anchor, f.x - def.speed * dt);
    else if (def.weave) {
      // a disruptor never holds still: it weaves fast and switches lanes every few seconds
      if (f.t >= (f.nextLane || 0)) {
        f.nextLane = f.t + def.weave.every;
        f.lane = 14 + arenaRand(a) * (ARENA.H - 28);
      }
      const want = f.lane + Math.sin(f.t * 2.6 + f.phase) * def.weave.amp;
      f.y += Math.max(-def.weave.speed * dt, Math.min(def.weave.speed * dt, want - f.y));
    } else f.y = f.lane + Math.sin(f.t * 0.9 + f.phase) * 8;
    f.y = Math.max(f.r, Math.min(ARENA.H - f.r, f.y));
    if (f.t >= f.nextShot && f.x < ARENA.W - 4) {
      f.nextShot += f.every;
      const n = def.volley?.n || 1;
      for (let i = 0; i < n; i++) arenaFoeShot(a, f, def, { spread: n > 1 ? (i - (n - 1) / 2) * def.volley.spread : 0 });
    }
    // a support helps one ally on its own rhythm (only once it has arrived)
    if (def.support && f.x <= f.anchor + 1 && f.t >= f.nextAid) {
      f.nextAid = f.t + def.support.every;
      arenaAid(a, f, def.support);
    }
    if (f.callAfter && !f.called && f.t >= f.callAfter && a.queue.length < 40) {
      f.called = true;
      const calls = f.calls || ['stamp'];
      a.queue.splice(a.spawned, 0, ...calls);
      a.stats.calls += calls.length;
      arenaEvent(a, { type: 'call', id: f.id, kind: f.kind, calls: calls.slice() });
    }
  }
  // Ereignishorizont echoes
  if (a.echoes?.length) {
    for (const e of a.echoes) if (a.t >= e.at) arenaSplash(a, e.x, e.y, 0.5, true);
    a.echoes = a.echoes.filter(e => a.t < e.at);
  }
  // player projectiles: fly, collide, leave
  for (const p of a.shots) {
    p.age += dt;
    if (p.kind === 'lob') {
      const k = Math.min(1, p.age / Math.max(0.01, p.life));
      p.x = p.x0 + (p.tx - p.x0) * k;
      p.y = p.y0 + (p.ty - p.y0) * k - Math.sin(k * Math.PI) * 14;
      if (k >= 1) {
        arenaShotGone(a, p);
        arenaSplash(a, p.tx, p.ty, p.share || 1);
        p.dead = true;
      }
      continue;
    }
    if (p.reflect) {
      // a parried shot flies back at its sender
      const back = a.foes.find(f => f.id === p.tid && f.hp > 0);
      if (back) {
        const ang = Math.atan2(back.y - p.y, back.x - p.x);
        p.vx = Math.cos(ang) * ARENA_PARRY.speed;
        p.vy = Math.sin(ang) * ARENA_PARRY.speed;
      }
    }
    if (p.seek) {
      // Zielsucher (epic and up): turn toward the target, at most 2.4 rad/s. P1.5: a shot fired without Auto-Aim has no
      // target – it turns (1.2 rad/s) only toward an enemy nearly ahead of its flight (±15°)
      const dir = Math.atan2(p.vy, p.vx),
        t = p.tid
          ? a.foes.find(f => f.id === p.tid && f.hp > 0)
          : p.cone
            ? a.foes.filter(f => f.hp > 0 && !f.untargetable && f.x > p.x && Math.abs(((Math.atan2(f.y - p.y, f.x - p.x) - dir + Math.PI * 3) % (Math.PI * 2)) - Math.PI) <= ARENA_SEEK_CONE).sort((q, r) => q.x - r.x)[0]
            : null;
      if (t) {
        const speed = Math.hypot(p.vx, p.vy),
          cur = Math.atan2(p.vy, p.vx),
          want = Math.atan2(t.y - p.y, t.x - p.x);
        let d = want - cur;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        const turn = p.tid ? 2.4 : 1.2,
          ang = cur + Math.max(-turn * dt, Math.min(turn * dt, d));
        p.vx = Math.cos(ang) * speed;
        p.vy = Math.sin(ang) * speed;
      }
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    // Beta 1.9 M8: Abwehrfächer (scatter tuning) – a pellet catches a small straight enemy shot it touches and is used up
    if (p.kind === 'pellet' && !p.cat && !p.reflect && a.loadout?.stats?.tune === 'guard')
      for (const s of a.foeShots) {
        if (s.dead || s.lob || s.r > DNA_TUNES.guard.catchR || Math.hypot(s.x - p.x, s.y - p.y) > s.r + p.r + 1) continue;
        s.dead = true;
        p.dead = true;
        a.stats.caught = (a.stats.caught || 0) + 1;
        arenaEvent(a, { type: 'catch', x: s.x, y: s.y });
        break;
      }
    for (const f of a.foes) {
      if (p.dead || f.hp <= 0 || p.hit.includes(f.id)) continue;
      if (Math.hypot(f.x - p.x, f.y - p.y) <= f.r + p.r) {
        p.hit.push(f.id);
        if (f.id === p.tid) arenaShotGone(a, p);
        arenaDamage(a, f, p.share || 1, p.cat ? 'cat' : p.reflect ? 'reflect' : 'ship', p.kind);
        if (!p.cat && !p.reflect) {
          arenaChain(a, f);
          if (p.kind === 'shell') arenaShellRules(a, f);
        }
        if (p.pierce-- <= 0) p.dead = true;
      }
    }
    if (p.age > p.life || p.x > ARENA.W + 10 || p.x < -10 || p.y < -10 || p.y > ARENA.H + 10) {
      p.dead = true;
      // P1.5: a ship shot that touched nothing is a miss (where it left the field)
      if (!p.hit.length && !p.cat && !p.reflect) arenaMiss(a, Math.max(0, Math.min(ARENA.W, p.x)), Math.max(0, Math.min(ARENA.H, p.y)));
    }
    if (p.dead) arenaShotGone(a, p);
  }
  a.shots = a.shots.filter(p => !p.dead);
  // enemy projectiles: hit the ship or leave
  for (const s of a.foeShots) {
    if (s.dead) continue; // caught by the Abwehrfächer this frame
    s.age += dt;
    if (s.lob) {
      // artillery: an arc to where the ship was when it fired; it hurts only if the ship is still there
      const k = Math.min(1, s.age / Math.max(0.01, s.life));
      s.x = s.x0 + (s.tx - s.x0) * k;
      s.y = s.y0 + (s.ty - s.y0) * k - Math.sin(k * Math.PI) * 18;
      if (k < 1) continue;
      s.dead = true;
      arenaEvent(a, { type: 'impact', kind: s.kind, x: s.tx, y: s.ty, r: s.r });
      if (Math.hypot(s.tx - ship.x, s.ty - ship.y) > s.r + ARENA.SHIP_R) continue;
    } else {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      // P1.3: a Frostwand hurts once – the other shards of the same wall pass through the ship
      if (s.wall && a.wallHit === s.wall && Math.hypot(s.x - ship.x, s.y - ship.y) <= s.r + ARENA.SHIP_R) continue;
      if (Math.hypot(s.x - ship.x, s.y - ship.y) > s.r + ARENA.SHIP_R) {
        if (a.manual && !s.near && s.x <= ship.x && Math.abs(s.y - ship.y) <= s.r + ARENA.SHIP_R + ARENA_DODGE.near) {
          s.near = true;
          a.stats.dodged++;
          arenaEvent(a, { type: 'dodge', x: ship.x, y: ship.y });
        }
        if (s.x < -6 || s.x > ARENA.W + 6 || s.y < -6 || s.y > ARENA.H + 6) s.dead = true;
        continue;
      }
      s.dead = true;
      if (s.wall) a.wallHit = s.wall;
    }
    if (arenaParry(a, s)) continue;
    const got = arenaHurt(a, s.damage, s.kind);
    // a frost hit that gets through chills the gun (not during the Salve; the shield blocks it)
    if (got > 0 && s.chill && a.t >= ship.salvoUntil) {
      ship.chillUntil = Math.max(ship.chillUntil || 0, a.t + s.chill);
      arenaEvent(a, { type: 'chill', until: ship.chillUntil });
    }
    // a jamming hit delays both abilities (never past a full cooldown)
    if (got > 0 && s.jam) arenaJam(a, s.jam);
  }
  a.foeShots = a.foeShots.filter(s => !s.dead);
  a.foes = a.foes.filter(f => f.hp > 0); // dead enemies leave (their kill event stays for the scene)
  if (a.focus && !a.foes.some(f => f.id === a.focus)) a.focus = 0;
  // end of the wave
  if (ship.hull <= 0) a.result = { won: false, reason: 'hull' };
  else if (a.boss && a.bossDown) a.result = { won: true, boss: true };
  else if (!a.boss && a.spawned >= a.queue.length && !a.foes.length) a.result = { won: true };
  else if (a.t >= ARENA.SAFETY) a.result = { won: false, reason: 'time' };
}
// P1.3 — guardian signature attacks. Each runs in every second cycle of its guardian (the other cycle keeps its
// classic finisher), in six readable steps on the cycle's own clock (fractions of the cycle):
//   prep     the guardian stops and gets ready (its pose changes; event 'sig-prep')
//   warn     the threat zone is shown (event 'telegraph' with the zone: lanes or the wall's gap)
//   attack   the real shots fly (foe shots: the same collision, shield, parry and dodge rules as every enemy shot)
//   counter  get out of the zone (steer) or hold the Schildpuls; the zone always leaves a safe place
//   recover  the guardian is open for a moment (event 'boss-open'; it takes more damage)
// P.I.P.S. — Inspektionsraster: the arena is split into three lanes; two are scanned (a red sweep across each), the
// third stays green. The safe lane is never the one the ship is in when the scan is announced.
const PIPS_RASTER = { prep: 0.3, warn: 0.4, sweep: 0.72, open: 0.8, lanes: 3, r: 12.5, speed: 150, damage: 1.5, openFactor: 1.4 };
// P1.4: a safe place that moves (from y0 at arrival a0 to y1 at a1; before and after it rests)
function arenaPathY(p, t) {
  return t <= p.a0 ? p.y0 : t >= p.a1 ? p.y1 : p.y0 + ((p.y1 - p.y0) * (t - p.a0)) / (p.a1 - p.a0);
}
// one shot of a signature group (a wall, a ring, a storm): the group hurts at most once (a.wallHit)
function arenaSigShot(a, f, o) {
  if (a.foeShots.length >= ARENA.MAX_FOE_SHOTS) a.foeShots.shift();
  a.foeShots.push({ id: a.nextId++, from: f.id, age: 0, ...o });
}
function arenaLaneCentre(i, n) {
  return ((i + 0.5) / n) * ARENA.H;
}
function arenaLaneOf(y, n) {
  return Math.max(0, Math.min(n - 1, Math.floor((y / ARENA.H) * n)));
}
function pipsRasterStep(a, f, def, cyc, ct, once) {
  const C = PIPS_RASTER,
    ship = a.ship;
  if (once(64, C.prep)) {
    f.sig = 'raster';
    arenaEvent(a, { type: 'sig-prep', id: f.id, sig: 'raster' });
  }
  if (once(128, C.warn)) {
    const here = arenaLaneOf(ship.y, C.lanes),
      side = here === 0 ? 1 : here === C.lanes - 1 ? -1 : arenaRand(a) < 0.5 ? -1 : 1;
    f.safeLane = here + side;
    f.dangerLanes = [...Array(C.lanes).keys()].filter(i => i !== f.safeLane);
    arenaEvent(a, { type: 'telegraph', id: f.id, raster: true, lanes: f.dangerLanes.slice(), safe: f.safeLane, n: C.lanes, x0: f.x, y0: f.y, x1: ship.x, y1: arenaLaneCentre(f.safeLane, C.lanes), until: a.t + (C.sweep - C.warn) * cyc });
    // the safe place for the self-steering ship: until the sweeps have crossed the arena
    a.sigSafe = { y: arenaLaneCentre(f.safeLane, C.lanes), until: a.t + (C.sweep - C.warn) * cyc + (f.x - ship.x) / C.speed + 0.3 };
  }
  if (once(256, C.sweep)) {
    for (const lane of f.dangerLanes || []) {
      if (a.foeShots.length >= ARENA.MAX_FOE_SHOTS) a.foeShots.shift();
      a.foeShots.push({ id: a.nextId++, kind: 'scan-sweep', from: f.id, x: f.x - f.r, y: arenaLaneCentre(lane, C.lanes), vx: -C.speed, vy: 0, r: C.r, damage: f.atk * C.damage, age: 0 });
    }
    arenaEvent(a, { type: 'foe-fire', id: f.id, kind: 'scan-sweep' });
  }
  if (once(512, C.open)) {
    f.sig = null;
    f.sigOpenUntil = f.t + (1 - C.open) * cyc;
    arenaEvent(a, { type: 'boss-open', id: f.id, until: a.t + (1 - C.open) * cyc, recover: true });
  }
}
ARENA_BOSS_DAMAGE.pips = (a, f, factor) => (f.t < (f.sigOpenUntil || 0) ? factor * PIPS_RASTER.openFactor : factor);
// Frostbyte — Frostwand: a wall of ice shards across the whole arena advances on the ship; one gap stays open. The gap
// is announced where the ship is not (it has to move), a hit chills the gun; at most one shard of a wall hurts.
// Afterwards his plates stand open (they were thrown into the wall) and let everything through.
const FB_WALL = { prep: 0.42, warn: 0.5, wall: 0.68, open: 0.8, gap: 32, step: 6.5, r: 3.4, speed: 36, damage: 1.25, chill: 1.5, shift: 26 };
function frostbyteWallStep(a, f, def, cyc, ct, once) {
  const C = FB_WALL,
    ship = a.ship;
  if (once(64, C.prep)) {
    f.sig = 'wall';
    arenaEvent(a, { type: 'sig-prep', id: f.id, sig: 'wall' });
  }
  if (once(128, C.warn)) {
    const dir = ship.y > ARENA.H / 2 ? -1 : 1;
    f.gapY = Math.max(C.gap / 2 + 4, Math.min(ARENA.H - C.gap / 2 - 4, ship.y + dir * C.shift));
    arenaEvent(a, { type: 'telegraph', id: f.id, wall: true, gapY: f.gapY, gap: C.gap, x0: f.x, y0: f.y, x1: ship.x, y1: f.gapY, until: a.t + (C.wall - C.warn) * cyc });
    a.sigSafe = { y: f.gapY, until: a.t + (C.wall - C.warn) * cyc + (f.x - f.r - ship.x) / C.speed + 0.5 };
  }
  if (once(256, C.wall)) {
    const wall = a.nextId;
    for (let y = 4; y <= ARENA.H - 4; y += C.step) {
      if (Math.abs(y - f.gapY) < C.gap / 2) continue;
      if (a.foeShots.length >= ARENA.MAX_FOE_SHOTS) a.foeShots.shift();
      a.foeShots.push({ id: a.nextId++, kind: 'frost-wall', wall, from: f.id, x: f.x - f.r, y, vx: -C.speed, vy: 0, r: C.r, damage: f.atk * C.damage, chill: C.chill, age: 0 });
    }
    arenaEvent(a, { type: 'foe-fire', id: f.id, kind: 'frost-wall' });
  }
  if (once(512, C.open)) {
    f.sig = null;
    f.sigOpenUntil = f.t + (1 - C.open) * cyc;
    arenaEvent(a, { type: 'boss-open', id: f.id, until: a.t + (1 - C.open) * cyc, recover: true });
  }
}
// The boss's authored pattern (P.I.P.S.): enters, patrols a slow figure eight, runs its inspection cycle, calls two
// Stempeldrohnen once at half HP (phase 2, faster cycle). Every attack is announced before it lands.
function arenaBossStep(a, f, def, dt) {
  if (ARENA_BOSS_STEPS[f.kind]) return ARENA_BOSS_STEPS[f.kind](a, f, def, dt);
  if (f.kind === 'frostbyte') return frostbyteArenaStep(a, f, def, dt);
  const boss = ARENA_BOSSES[a.key],
    cyc = f.phase2 ? PIPS_CYCLE.phase2 : PIPS_CYCLE.length,
    n = Math.floor(f.t / cyc),
    ct = (f.t % cyc) / cyc,
    ship = a.ship;
  if (f.x > f.anchor + 0.01) f.x = Math.max(f.anchor, f.x - def.speed * dt);
  else if (!f.sig) {
    f.x = f.anchor + Math.sin(f.t * 1.3) * 5;
    f.y = ARENA.H / 2 + Math.sin(f.t * 0.65) * 22;
  }
  if (f.cycle !== n) {
    f.cycle = n;
    f.fired = 0;
  }
  const once = (bit, at) => ct >= at && !(f.fired & bit) && (f.fired |= bit),
    // P1.3: every second cycle is the Inspektionsraster (instead of the Prüfschild and the Prüfstempel)
    raster = n % 2 === 1;
  if (raster) pipsRasterStep(a, f, def, cyc, ct, once);
  PIPS_CYCLE.bolts.forEach((at, i) => {
    if (!once(1 << i, at)) return;
    const ang = Math.atan2(ship.y - f.y, ship.x - f.x) + (i - 1) * 0.12;
    if (a.foeShots.length >= ARENA.MAX_FOE_SHOTS) a.foeShots.shift();
    a.foeShots.push({ id: a.nextId++, kind: 'pips', x: f.x - f.r, y: f.y, vx: Math.cos(ang) * def.shotSpeed, vy: Math.sin(ang) * def.shotSpeed, r: def.shotR, damage: f.atk, age: 0 });
    arenaEvent(a, { type: 'foe-fire', id: f.id, kind: 'pips' });
  });
  const shield = !raster && ct >= PIPS_CYCLE.shield[0] && ct < PIPS_CYCLE.shield[1] && f.t >= f.brokenUntil;
  if (shield && !f.shieldOn) arenaEvent(a, { type: 'boss-shield', id: f.id });
  f.shieldOn = shield;
  if (!raster && once(8, PIPS_CYCLE.telegraph)) {
    f.aimY = ship.y;
    arenaEvent(a, { type: 'telegraph', id: f.id, x0: f.x, y0: f.y, x1: ship.x, y1: ship.y, until: a.t + (PIPS_CYCLE.stamp - PIPS_CYCLE.telegraph) * cyc });
  }
  if (!raster && once(16, PIPS_CYCLE.stamp)) {
    const ang = Math.atan2((f.aimY ?? ship.y) - f.y, ship.x - f.x);
    a.foeShots.push({ id: a.nextId++, kind: 'stamp-heavy', x: f.x - f.r, y: f.y, vx: Math.cos(ang) * 46, vy: Math.sin(ang) * 46, r: 4.2, damage: f.atk * PIPS_CYCLE.stampDamage, age: 0 });
    arenaEvent(a, { type: 'foe-fire', id: f.id, kind: 'stamp-heavy' });
  }
  if (!f.phase2 && f.hp <= f.maxHp * boss.phase2) {
    f.phase2 = true;
    for (const kind of boss.summon) a.queue.push(kind);
    a.stats.calls += boss.summon.length;
    arenaEvent(a, { type: 'boss-phase', id: f.id, phase: 2 });
  }
}
// Frostbyte (Glacies): enters, hovers in a slow wave, keeps three crystal plates, throws aimed Eiszapfen and announces
// his Frostatem before it comes. At half HP he calls three Frostflocken once and his cycle speeds up (phase 2).
function frostbyteArenaStep(a, f, def, dt) {
  const boss = ARENA_BOSSES[a.key],
    C = FB_ARENA,
    cyc = f.phase2 ? C.phase2 : C.length,
    n = Math.floor(f.t / cyc),
    ct = (f.t % cyc) / cyc,
    ship = a.ship;
  if (f.plates === undefined) {
    f.plates = C.plates;
    f.thawUntil = 0;
  }
  if (f.x > f.anchor + 0.01) f.x = Math.max(f.anchor, f.x - def.speed * dt);
  else if (!f.sig) {
    f.x = f.anchor + Math.sin(f.t * 0.9) * 4;
    f.y = ARENA.H / 2 + Math.sin(f.t * 0.5) * 26;
  }
  if (f.cycle !== n) {
    f.cycle = n;
    f.fired = 0;
  }
  const once = (bit, at) => ct >= at && !(f.fired & bit) && (f.fired |= bit),
    // P1.3: every second cycle is the Frostwand (instead of the Frostatem)
    wall = n % 2 === 1;
  if (wall) frostbyteWallStep(a, f, def, cyc, ct, once);
  C.shards.forEach((at, i) => {
    if (!once(1 << i, at)) return;
    const ang = Math.atan2(ship.y - f.y, ship.x - f.x) + (i - 1.5) * 0.08;
    if (a.foeShots.length >= ARENA.MAX_FOE_SHOTS) a.foeShots.shift();
    a.foeShots.push({ id: a.nextId++, kind: 'icicle', x: f.x - f.r, y: f.y, vx: Math.cos(ang) * def.shotSpeed, vy: Math.sin(ang) * def.shotSpeed, r: 1.8, damage: f.atk, age: 0 });
    arenaEvent(a, { type: 'foe-fire', id: f.id, kind: 'icicle' });
  });
  if (!wall && once(16, C.telegraph)) {
    f.aimY = ship.y;
    f.warnUntil = a.t + (C.breath - C.telegraph) * cyc;
    arenaEvent(a, { type: 'telegraph', id: f.id, frost: true, x0: f.x, y0: f.y, x1: ship.x, y1: ship.y, until: f.warnUntil });
  }
  if (!wall && once(32, C.breath)) {
    const base = Math.atan2((f.aimY ?? ship.y) - f.y, ship.x - f.x);
    for (let i = 0; i < C.breathShots; i++) {
      const ang = base + (i - (C.breathShots - 1) / 2) * C.breathSpread;
      if (a.foeShots.length >= ARENA.MAX_FOE_SHOTS) a.foeShots.shift();
      a.foeShots.push({ id: a.nextId++, kind: 'breath', x: f.x - f.r, y: f.y, vx: Math.cos(ang) * C.breathSpeed, vy: Math.sin(ang) * C.breathSpeed, r: 3.4, damage: f.atk * C.breathDamage, chill: C.chill, age: 0 });
    }
    arenaEvent(a, { type: 'foe-fire', id: f.id, kind: 'breath' });
  }
  // the thaw ends: the plates grow back
  if (f.plates === 0 && f.t >= f.thawUntil) {
    f.plates = C.plates;
    arenaEvent(a, { type: 'plates-regrow', id: f.id });
  }
  if (!f.phase2 && f.hp <= f.maxHp * boss.phase2) {
    f.phase2 = true;
    for (const kind of boss.summon) a.queue.push(kind);
    a.stats.calls += boss.summon.length;
    arenaEvent(a, { type: 'boss-phase', id: f.id, phase: 2 });
  }
}
// Advances the arena by `seconds` of fight time in fixed steps; returns the number of steps taken.
function arenaAdvance(a, seconds) {
  if (!a || a.result || !(seconds > 0)) return 0;
  a.acc += Math.min(seconds, 0.5);
  let n = 0;
  while (a.acc >= ARENA.DT - 1e-9 && !a.result) {
    a.acc -= ARENA.DT;
    arenaStep(a);
    n++;
  }
  return n;
}

// ----- Beta 1.5: ship refits from the Fertigung -----
// Advanced upgrades paid with manufactured goods of the visited colony plus Credits (early weapons, hull modules and the
// repairs never need them). Each has a real drawback or a clear limit, and each is visible on the ship (ship-art.js).
const SHIP_REFITS = {
  armor: {
    name: 'Schwere Panzerung',
    icon: '▦',
    max: 5,
    effect: lvl => (lvl ? '+' + 15 * lvl + ' % Hülle, −' + 5 * lvl + ' % Wendigkeit/Feuerrate' : 'keine'),
    cost: lvl => ({ hullModule: 1, plating: 2 + lvl, credits: 6000 * 3 ** lvl })
  },
  shield: {
    name: 'Schildgenerator',
    icon: '◎',
    max: 3,
    effect: lvl => 'Schildpuls ' + (2.5 + 0.5 * lvl).toFixed(1).replace('.', ',') + ' s',
    cost: lvl => ({ coolant: 2 + lvl, plating: 1 + lvl, credits: 4000 * 3 ** lvl })
  },
  cooling: {
    name: 'Waffenkühlung',
    icon: '❆',
    max: 3,
    effect: lvl => (lvl ? '+' + 6 * lvl + ' % Feuerrate' : 'keine'),
    cost: lvl => ({ coolant: 2 * (lvl + 1), credits: 3000 * 3 ** lvl })
  },
  // Beta 1.9 M5: the cross-planet product of Glacies (Kryokern) and Pyra (Glutlegierung): hull without the heavy
  // armour's drawback (no loss of agility or fire rate), but only two levels and an expensive chain behind each
  heatShield: {
    name: 'Hitzeschild',
    icon: '⛨',
    max: 2,
    effect: lvl => (lvl ? '+' + 10 * lvl + ' % Hülle, ohne Nachteil' : 'keine'),
    cost: lvl => ({ heatShield: 1 + lvl, plating: 2 + 2 * lvl, credits: 50000 * 3 ** lvl })
  },
  // Beta 1.9 M6: the Mekhanos module combined from a find (Relikt) – the shield pulse lasts a whole second longer
  projector: {
    name: 'Schildprojektor',
    icon: '⬡',
    max: 1,
    effect: lvl => (lvl ? 'Schildpuls +1 s' : 'keine'),
    cost: () => ({ shieldProjector: 1, credits: 250000 })
  }
};
function normalizeRefits(raw) {
  const src = raw && typeof raw === 'object' ? raw : {},
    out = { ...src }; // refits of a newer build stay
  for (const [id, r] of Object.entries(SHIP_REFITS)) out[id] = Math.max(0, Math.min(r.max, Math.floor(Number(src[id]) || 0)));
  return out;
}
function refitLevel(id, ship = state.ship) {
  return ship?.refits?.[id] || 0;
}
function refitFactor(kind, ship = state.ship) {
  const armor = refitLevel('armor', ship);
  if (kind === 'rate') return (1 - 0.05 * armor) * (1 + 0.06 * refitLevel('cooling', ship));
  if (kind === 'speed') return 1 - 0.05 * armor;
  if (kind === 'shield') return 0.5 * refitLevel('shield', ship) + 1 * refitLevel('projector', ship);
  if (kind === 'hull') return (1 + 0.15 * armor + 0.1 * refitLevel('heatShield', ship)) * (typeof techHas === 'function' && techHas('matterArmor') ? 1.1 : 1);
  return 1;
}
function refitCost(id, ship = state.ship) {
  const r = SHIP_REFITS[id],
    lvl = refitLevel(id, ship);
  return r && lvl < r.max ? r.cost(lvl) : null;
}
// what is missing for the next level at the visited colony (goods) and in Credits
function refitMissing(id, planet = state.activePlanet) {
  const cost = refitCost(id);
  if (!cost) return null;
  const missing = {};
  for (const [good, n] of Object.entries(cost)) {
    const have = good === 'credits' ? state.credits : fabStock(planet, good);
    if (have < n) missing[good] = n - have;
  }
  return missing;
}
function refitShip(id, planet = state.activePlanet) {
  const cost = refitCost(id),
    missing = refitMissing(id, planet);
  if (!cost || !missing || Object.keys(missing).length || (typeof arenaActive === 'function' && arenaActive())) return false;
  for (const [good, n] of Object.entries(cost)) {
    if (good === 'credits') state.credits -= n;
    else fabSetStock(planet, good, fabStock(planet, good) - n);
  }
  state.ship.refits = { ...normalizeRefits(state.ship.refits), [id]: refitLevel(id) + 1 };
  return true;
}
// the heavier hull counts everywhere the hull counts (arena, repairs, the classic waves)
const shipHullMaxBeforeRefits = shipHullMax;
shipHullMax = (ship = state.ship) => Math.round(shipHullMaxBeforeRefits(ship) * refitFactor('hull', ship));

// ----- the ship's persistent condition (run level): damage, emergency repair -----
const SHIP_REPAIR = {
  emergencySeconds: 90, // free emergency repair to 50 %: no softlock, ever
  emergencyTo: 0.5,
  kit: 0.4, // a Reparatursatz restores 40 % of the hull
  plate: 0.1, // a Panzerplatte 10 %
  creditsPerPoint: hullLevel => 6 * (1 + hullLevel) // Werftreparatur
};
function normalizeShipCondition(raw, now = Date.now()) {
  const src = raw && typeof raw === 'object' ? raw : {};
  return { damage: Math.max(0, Math.min(1e6, Number(src.damage) || 0)), emergencyUntil: Math.max(0, Math.min(now + SHIP_REPAIR.emergencySeconds * 1000, Number(src.emergencyUntil) || 0)) };
}
function shipCondition() {
  return state.shipCondition;
}
function shipHullNow() {
  const max = shipHullMax();
  return Math.max(0, max - Math.min(max, shipCondition().damage));
}
// an emergency repair that has run its time completes (real time, so it also finishes while the app is closed)
function shipRepairTick(now = Date.now()) {
  const c = shipCondition();
  if (c.emergencyUntil && now >= c.emergencyUntil) {
    c.emergencyUntil = 0;
    c.damage = Math.min(c.damage, shipHullMax() * (1 - SHIP_REPAIR.emergencyTo));
    return true;
  }
  return false;
}
function emergencyRepairState(now = Date.now()) {
  const c = shipCondition(),
    max = shipHullMax();
  if (c.emergencyUntil) return { running: true, left: Math.max(0, c.emergencyUntil - now) };
  return { running: false, available: shipHullNow() < max * SHIP_REPAIR.emergencyTo };
}
function startEmergencyRepair(now = Date.now()) {
  if (!emergencyRepairState(now).available || (typeof arenaActive === 'function' && arenaActive())) return false;
  shipCondition().emergencyUntil = now + SHIP_REPAIR.emergencySeconds * 1000;
  return true;
}
// Repair with goods of the visited colony (Reparatursatz, Panzerplatten) or Credits; returns hull points restored.
function repairShip(kind, planet = state.activePlanet) {
  const c = shipCondition(),
    max = shipHullMax();
  if (!(c.damage > 0) || (typeof arenaActive === 'function' && arenaActive())) return 0;
  let restore = 0;
  if (kind === 'kit' || kind === 'plate') {
    const good = kind === 'kit' ? 'repairKit' : 'plating';
    if (fabStock(planet, good) < 1) return 0; // a manual repair may use reserved plates: that is what the reserve is for
    fabSetStock(planet, good, fabStock(planet, good) - 1);
    restore = Math.min(c.damage, max * (kind === 'kit' ? SHIP_REPAIR.kit : SHIP_REPAIR.plate));
  } else if (kind === 'credits') {
    const price = Math.ceil(c.damage * SHIP_REPAIR.creditsPerPoint(state.ship.hull || 0) * (typeof techHas === 'function' && techHas('welder') ? 0.75 : 1));
    if (state.credits < price) return 0;
    state.credits -= price;
    restore = c.damage;
  } else return 0;
  c.damage = Math.max(0, c.damage - restore);
  if (c.damage < max * (1 - SHIP_REPAIR.emergencyTo)) c.emergencyUntil = 0;
  return restore;
}
function repairCreditPrice() {
  return Math.ceil(shipCondition().damage * SHIP_REPAIR.creditsPerPoint(state.ship.hull || 0) * (typeof techHas === 'function' && techHas('welder') ? 0.75 : 1));
}
