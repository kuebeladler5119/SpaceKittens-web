// Beta 1.4 M3 — Galactic DNA (save schema 37, meta.dna): one deterministic, modular identity for weapons, Arsenal items
// and enemies. Logic and data only; drawing lives in scenes/ship-art.js (mounts) and the combat scenes (projectiles).
//
//   identity = { v, seed, archetype, chassis, affinity, fire, projectile, affixes[], rarity }
//
// * Determinism: dnaGenerate(seed, rarity, opts) depends only on its arguments (mulberry32 on the seed) — the same seed
//   always gives the same weapon. A weapon the player owns is stored as its full identity *plus* its seed, so a later
//   build that tunes the generator never changes an owned weapon (the stored identity wins; unknown chassis/affinity ids
//   of a newer build are kept as they are).
// * Affinities form one cycle — Hydro/Kryo → Thermo/Plasma → Kinetik → Ionen/Bogen → Hydro/Kryo: each beats the next
//   (×1.25) and is weak against the one before it (×0.8). The old weapon systems map onto it (Laser = Kinetik, Plasma
//   and Nova = Thermo, Arc and Ion = Ionen), so every existing enemy weakness keeps its meaning.
// * The 27 Arsenal items keep their ids, stats and effects. They only gain a derived DNA profile (affinity, archetype),
//   computed from their id and their existing weapon/effect — nothing in the save changes.
// * Enemies: every campaign enemy gets a family and an affinity (its old weakness becomes the affinity that beats it);
//   bosses keep their identity and get a fixed affinity.
// Loaded after arsenal.js and campaign.js, before game.js (normalizeState calls normalizeDna).

const DNA_VERSION = 1;
const DNA_AFFINITIES = {
  hydro: { name: 'Hydro/Kryo', short: 'Hydro', icon: '❄', color: '#7fdcff', core: '#effbff', beats: 'thermal' },
  thermal: { name: 'Thermo/Plasma', short: 'Thermo', icon: '🔥', color: '#ff9a4a', core: '#fff1dc', beats: 'kinetic' },
  kinetic: { name: 'Kinetik', short: 'Kinetik', icon: '☄', color: '#e8e2d0', core: '#ffffff', beats: 'ion' },
  ion: { name: 'Ionen/Bogen', short: 'Ionen', icon: '⚡', color: '#b89aff', core: '#f5efff', beats: 'hydro' }
};
const DNA_AFFINITY_IDS = Object.keys(DNA_AFFINITIES);
const DNA_STRONG = 1.25,
  DNA_WEAK = 0.8;
// The old weapon systems (state.ship.weaponType, enemy weaknesses) in the affinity cycle.
const WEAPON_AFFINITY = { Laser: 'kinetic', Plasma: 'thermal', Nova: 'thermal', Arc: 'ion', Ion: 'ion' };
// Weapon families (archetypes) and their chassis. rate × damage ≈ 1 (same damage per second before affixes and
// rarity); the chassis trade single-target burst for area, piercing or tempo.
const DNA_ARCHETYPES = {
  cannon: { name: 'Kanone', chassis: ['repeater', 'heavy'] },
  beam: { name: 'Strahler', chassis: ['lance', 'prism'] },
  launcher: { name: 'Werfer', chassis: ['scatter', 'mortar'] }
};
const DNA_CHASSIS = {
  // Beta 1.5: each chassis also has a real weakness — armorPierce = share of a hit that goes through 50 % armour plates
  // (the old guns: 0.5), falloff = distance from which the scatter gun loses punch, close = point-blank range where it hits ×1.5
  repeater: { name: 'Repetierer', archetype: 'cannon', fire: 'stream', projectile: 'bolt', rate: 1.6, damage: 0.625, speed: 900, size: 3, armorPierce: 0.35, text: 'Schnelle Salven kleiner Bolzen – gut gegen Schwärme, prallt an Panzerung ab' },
  heavy: { name: 'Schwerkanone', archetype: 'cannon', fire: 'single', projectile: 'shell', rate: 0.6, damage: 1.667, speed: 520, size: 8, armorPierce: 0.85, text: 'Langsame, schwere Granaten – durchschlagen Panzerung, verschwenden sich an Schwärmen' },
  lance: { name: 'Lanze', archetype: 'beam', fire: 'beam', projectile: 'ray', rate: 0.8, damage: 1.25, speed: 0, size: 3, pierce: 2, armorPierce: 0.6, text: 'Strahl, der bis zu drei Gegner in einer Linie trifft – langsamer Takt' },
  prism: { name: 'Prisma', archetype: 'beam', fire: 'split', projectile: 'ray', rate: 1, damage: 0.4, speed: 0, size: 2, count: 3, armorPierce: 0.45, text: 'Teilt sich in drei Strahlen auf drei Ziele – schwach gegen einen einzelnen Boss' },
  scatter: { name: 'Streuer', archetype: 'launcher', fire: 'spread', projectile: 'pellet', rate: 0.9, damage: 0.45, speed: 700, size: 3, count: 3, spread: 0.2, armorPierce: 0.4, falloff: 90, close: 45, text: 'Fächer aus drei Schrotkugeln – stark aus der Nähe, verliert auf Distanz' },
  mortar: { name: 'Mörser', archetype: 'launcher', fire: 'lob', projectile: 'orb', rate: 0.5, damage: 1.6, speed: 380, size: 9, splash: 70, armorPierce: 0.75, text: 'Bogenschuss mit Flächenschaden – trifft, wo der Gegner war' }
};
const DNA_CHASSIS_IDS = Object.keys(DNA_CHASSIS);
// Affixes: small, readable modifiers (no hidden randomness in combat — every value is fixed by the identity).
const DNA_AFFIXES = {
  swift: { name: 'Schnell', text: '+12 % Feuerrate', rate: 0.12 },
  heavy: { name: 'Wuchtig', text: '+12 % Schaden', damage: 0.12 },
  focus: { name: 'Fokussiert', text: '+20 % gegen Elite und Bosse', boss: 0.2 },
  pierce: { name: 'Durchschlag', text: 'Trifft einen Gegner mehr', pierce: 1 },
  chain: { name: 'Kettenblitz', text: 'Jeder 3. Treffer springt auf ein zweites Ziel (50 %)', chain: 0.5 },
  splash: { name: 'Splitter', text: '+35 % Flächenradius', splash: 0.35 },
  attune: { name: 'Abgestimmt', text: 'Affinitätsvorteil ×1,4 statt ×1,25', attune: 0.15 }
};
const DNA_AFFIX_IDS = Object.keys(DNA_AFFIXES);
const DNA_RARITY_AFFIXES = { common: 0, uncommon: 1, rare: 1, epic: 2, legendary: 2, mythic: 3, celestial: 3 };
const DNA_RARITY_POWER = { common: 1, uncommon: 1.05, rare: 1.1, epic: 1.18, legendary: 1.26, mythic: 1.35, celestial: 1.45 };
const DNA_MAX_OWNED = 60;

// ----- deterministic generation -----
function dnaHash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}
function dnaRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// opts.chassis / opts.affinity pin a part (starter weapons, themed rewards); the rest comes from the seed.
function dnaGenerate(seed, rarity = 'common', opts = {}) {
  const rnd = dnaRng(seed),
    pick = list => list[Math.floor(rnd() * list.length)];
  const chassis = DNA_CHASSIS[opts.chassis] ? opts.chassis : pick(DNA_CHASSIS_IDS),
    c = DNA_CHASSIS[chassis],
    affinity = DNA_AFFINITIES[opts.affinity] ? opts.affinity : pick(DNA_AFFINITY_IDS),
    tier = DNA_RARITY_AFFIXES[rarity] === undefined ? 'common' : rarity,
    pool = DNA_AFFIX_IDS.filter(id => !(id === 'pierce' && c.fire === 'spread') && !(id === 'splash' && !c.splash)),
    affixes = [];
  while (affixes.length < DNA_RARITY_AFFIXES[tier] && pool.length) affixes.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  return { v: DNA_VERSION, seed: seed >>> 0, archetype: c.archetype, chassis, affinity, fire: c.fire, projectile: c.projectile, affixes, rarity: tier };
}
// Stats of an identity (known parts only; an unknown chassis of a newer build behaves like a neutral repeater).
function dnaStats(dna) {
  const c = DNA_CHASSIS[dna?.chassis] || DNA_CHASSIS.repeater,
    has = id => (dna?.affixes || []).includes(id),
    power = DNA_RARITY_POWER[dna?.rarity] || 1;
  return {
    rate: c.rate * (1 + (has('swift') ? DNA_AFFIXES.swift.rate : 0)),
    damage: c.damage * power * (1 + (has('heavy') ? DNA_AFFIXES.heavy.damage : 0)),
    boss: has('focus') ? DNA_AFFIXES.focus.boss : 0,
    pierce: (c.pierce || 0) + (has('pierce') ? 1 : 0),
    count: c.count || 1,
    spread: c.spread || 0,
    splash: (c.splash || 0) * (1 + (has('splash') ? DNA_AFFIXES.splash.splash : 0)),
    chain: has('chain') ? DNA_AFFIXES.chain.chain : 0,
    strong: DNA_STRONG + (has('attune') ? DNA_AFFIXES.attune.attune : 0),
    speed: c.speed,
    size: c.size,
    fire: c.fire,
    projectile: c.projectile
  };
}
// Damage multiplier of an attacker affinity against a defender affinity (unknown ids: neutral).
function affinityFactor(attacker, defender, strong = DNA_STRONG) {
  if (!DNA_AFFINITIES[attacker] || !DNA_AFFINITIES[defender]) return 1;
  if (DNA_AFFINITIES[attacker].beats === defender) return strong;
  if (DNA_AFFINITIES[defender].beats === attacker) return DNA_WEAK;
  return 1;
}
function dnaLabel(dna) {
  const c = DNA_CHASSIS[dna?.chassis],
    a = DNA_AFFINITIES[dna?.affinity];
  return (a ? a.short + '-' : '') + (c ? c.name : 'Unbekanntes Chassis');
}

// ----- the 27 Arsenal items: a derived profile (no save change) -----
const ARSENAL_DNA_AFFINITY = {
  'frostbyte-core': 'hydro',
  'petal-seed': 'hydro',
  'ember-valve': 'thermal',
  'nova-heart': 'thermal',
  'sunforge-focus': 'thermal',
  'pips-core': 'ion',
  'cog-stamp': 'kinetic',
  'comet-splinter': 'kinetic',
  'splinter-charge': 'kinetic',
  'storm-coil': 'ion',
  'chain-capacitor': 'ion',
  'aurora-helmet': 'hydro',
  'star-eye': 'kinetic',
  'orbit-crown': 'thermal'
};
const ARSENAL_DNA_ARCHETYPE = { weapon: 'attachment', support: 'module', pilot: 'pilotGear', catWeapon: 'catTool', catSupport: 'gliderModule' };
function arsenalDna(id) {
  const item = typeof ARSENAL_BY_ID !== 'undefined' ? ARSENAL_BY_ID[id] : null;
  if (!item) return null;
  const weapon = item.effects.find(e => e.kind === 'weapon')?.weapon,
    affinity = ARSENAL_DNA_AFFINITY[id] || WEAPON_AFFINITY[weapon] || DNA_AFFINITY_IDS[dnaHash(id) % DNA_AFFINITY_IDS.length];
  return { v: DNA_VERSION, seed: dnaHash('arsenal:' + id), archetype: ARSENAL_DNA_ARCHETYPE[item.slot] || 'module', chassis: null, affinity, fire: null, projectile: null, affixes: [], rarity: item.rarity, item: id };
}

// ----- enemies: family + affinity; bosses keep their identity -----
const ENEMY_FAMILIES = {
  swarm: { name: 'Schwarm', text: 'Viele kleine, schnelle Gegner' },
  heavy: { name: 'Schwer', text: 'Langsam, gepanzert, viel Leben' },
  ranged: { name: 'Fernkämpfer', text: 'Hält Abstand und schießt gezielt' },
  summoner: { name: 'Rufer', text: 'Ruft Verstärkung, wenn er überlebt' },
  elemental: { name: 'Elementar', text: 'Starke Affinität – falsche Waffe trifft schwach' },
  elite: { name: 'Elite', text: 'Schild oder Spezialfähigkeit' },
  boss: { name: 'Boss', text: 'Wächter mit eigenem Muster' }
};
// the affinity that a weakness beats: weakness Laser (kinetic) → the enemy is ion (kinetic beats ion)
function affinityBeatenBy(attacker) {
  return DNA_AFFINITIES[attacker]?.beats || null;
}
const ENEMY_DNA = {
  stamp: { family: 'ranged', affinity: affinityBeatenBy(WEAPON_AFFINITY.Laser) },
  moth: { family: 'swarm', affinity: affinityBeatenBy(WEAPON_AFFINITY.Arc) },
  clip: { family: 'heavy', affinity: affinityBeatenBy(WEAPON_AFFINITY.Ion) },
  scan: { family: 'summoner', affinity: affinityBeatenBy(WEAPON_AFFINITY.Laser) },
  seal: { family: 'elite', affinity: affinityBeatenBy(WEAPON_AFFINITY.Plasma) },
  // Beta 1.4: Orion's elemental — a Glutgeist from the old crystal forges (beaten by Hydro/Kryo)
  ember: { family: 'elemental', affinity: 'thermal' },
  // Beta 1.5 · Glacies: the Frostwacht — mostly Hydro/Kryo (Ionen trifft stark), the shards Kinetik (Thermo trifft
  // stark), the fog Ionen (Kinetik trifft stark): no single affinity wins the whole campaign
  flake: { family: 'swarm', affinity: 'hydro' },
  shard: { family: 'ranged', affinity: 'kinetic' },
  glacier: { family: 'heavy', affinity: 'hydro' },
  chill: { family: 'summoner', affinity: 'ion' },
  warden: { family: 'elite', affinity: 'hydro' }
};
const BOSS_DNA = { pips: 'ion', frostbyte: 'hydro', emberbell: 'thermal', cogsworth: 'kinetic', petalguard: 'hydro' };
function enemyDna(kind, seed = 0) {
  const d = ENEMY_DNA[kind];
  if (BOSS_DNA[kind]) return { family: 'boss', affinity: BOSS_DNA[kind], seed: dnaHash('boss:' + kind) };
  if (!d) return { family: 'ranged', affinity: DNA_AFFINITY_IDS[dnaHash(kind) % 4], seed: dnaHash(kind + ':' + seed) };
  return { family: d.family, affinity: d.affinity, seed: dnaHash(kind + ':' + seed) };
}

// ----- the player's DNA weapons: meta.dna = { owned: [{uid, …identity, src}], mount: uid|null, next: n } -----
function normalizeDna(raw) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const seen = new Set();
  const owned = (Array.isArray(src.owned) ? src.owned : [])
    .filter(w => w && typeof w === 'object' && typeof w.uid === 'string' && w.uid.length <= 40 && Number.isFinite(Number(w.seed)))
    .filter(w => !seen.has(w.uid) && seen.add(w.uid))
    .map(w => ({
      ...w, // unknown fields of a newer build stay
      seed: Number(w.seed) >>> 0,
      chassis: typeof w.chassis === 'string' ? w.chassis : 'repeater',
      affinity: typeof w.affinity === 'string' ? w.affinity : 'kinetic',
      affixes: Array.isArray(w.affixes) ? w.affixes.filter(a => typeof a === 'string').slice(0, 6) : [],
      rarity: typeof w.rarity === 'string' ? w.rarity : 'common'
    }))
    .slice(0, DNA_MAX_OWNED);
  const mount = owned.some(w => w.uid === src.mount) ? src.mount : null;
  return { owned, mount, next: Math.max(Math.floor(Number(src.next) || 0), owned.length), starter: Boolean(src.starter) };
}
function dnaState() {
  return state.meta.dna;
}
// Adds one weapon (the identity is fixed now and stored); returns the stored weapon.
function grantDnaWeapon(seed, rarity, opts = {}, source = 'reward') {
  const d = dnaState();
  if (d.owned.length >= DNA_MAX_OWNED) return null;
  const weapon = { uid: 'w' + ++d.next, ...dnaGenerate(seed, rarity, opts), src: source };
  d.owned.push(weapon);
  if (!d.mount) d.mount = weapon.uid;
  return weapon;
}
// The two shipyard prototypes (free, once per account): two chassis with two different affinities.
function grantStarterDna() {
  const d = dnaState();
  if (d.starter) return false;
  d.starter = true;
  grantDnaWeapon(dnaHash('starter:repeater'), 'common', { chassis: 'repeater', affinity: 'kinetic' }, 'starter');
  grantDnaWeapon(dnaHash('starter:lance'), 'common', { chassis: 'lance', affinity: 'hydro' }, 'starter');
  return true;
}
function mountedDna() {
  const d = state.meta?.dna;
  return d?.owned.find(w => w.uid === d.mount) || null;
}
function mountDna(uid) {
  const d = dnaState();
  if (typeof arenaActive === 'function' && arenaActive()) return false; // equipment is locked during a fight (Beta 1.5)
  if (uid !== null && !d.owned.some(w => w.uid === uid)) return false;
  d.mount = uid;
  return true;
}

// ----- Beta 1.4 M6: DNA rewards, fusion with an exact preview, the DNA collection -----
// Rewards: the first clear of three Orion waves builds a DNA weapon (fixed rarity, seed from the claim — no randomness to
// replay). Saves that cleared those waves before Beta 1.4 (or in classic mode) receive them once, the same way.
const DNA_WAVE_REWARDS = { crystal: { 2: 'uncommon', 5: 'rare', 8: 'epic' }, ice: { 2: 'rare', 5: 'rare', 8: 'epic' } };
// Fusion: two weapons of the same rarity → one of the next rarity; the base keeps its chassis, the donor gives its
// affinity, the rest comes from a seed made of both seeds. The preview *is* the result (same function), so neither a
// reload nor a second try can change it. Both inputs are used up; the cost is paid in Sternsplitter (✦).
const DNA_FUSE_COST = { common: 15, uncommon: 30, rare: 60, epic: 120, legendary: 240, mythic: 400 };
const DNA_RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'celestial'];
// Collection: every chassis × affinity seen once; milestones pay chests once.
const DNA_CODEX_MILESTONES = [
  { need: 6, chest: 'elite', text: '1 Kometenkiste' },
  { need: 12, chest: 'relic', text: '1 Sternenrelikt' },
  { need: 24, chest: 'relic', count: 2, text: '2 Sternenrelikte' }
];
function dnaCodexKey(w) {
  return w.chassis + ':' + w.affinity;
}
function dnaSeen(w) {
  const d = dnaState();
  if (DNA_CHASSIS[w.chassis] && DNA_AFFINITIES[w.affinity] && !d.seen.includes(dnaCodexKey(w))) d.seen.push(dnaCodexKey(w));
}
const normalizeDnaBeforeM6 = normalizeDna;
normalizeDna = raw => {
  const d = normalizeDnaBeforeM6(raw),
    src = raw && typeof raw === 'object' ? raw : {};
  d.claims = Array.isArray(src.claims) ? [...new Set(src.claims.filter(c => typeof c === 'string'))].slice(0, 200) : [];
  d.seen = Array.isArray(src.seen) ? [...new Set(src.seen.filter(c => typeof c === 'string' && c.length <= 40))].slice(0, 200) : [];
  d.owned.forEach(w => DNA_CHASSIS[w.chassis] && DNA_AFFINITIES[w.affinity] && !d.seen.includes(w.chassis + ':' + w.affinity) && d.seen.push(w.chassis + ':' + w.affinity));
  return d;
};
const grantDnaWeaponBeforeM6 = grantDnaWeapon;
grantDnaWeapon = (seed, rarity, opts = {}, source = 'reward') => {
  const w = grantDnaWeaponBeforeM6(seed, rarity, opts, source);
  if (w) dnaSeen(w);
  return w;
};
// Pays every reward whose campaign claim exists and that DNA has not paid yet; returns the new weapons.
function dnaRewardSync() {
  const d = state.meta?.dna,
    claims = state.meta?.campaign?.claims;
  if (!d || !claims) return [];
  const out = [];
  for (const [key, waves] of Object.entries(DNA_WAVE_REWARDS))
    for (const [wave, rarity] of Object.entries(waves)) {
      const claim = 'wave:' + key + ':' + wave;
      if (!claims.includes(claim) || d.claims.includes(claim) || d.owned.length >= DNA_MAX_OWNED) continue;
      d.claims.push(claim);
      const w = grantDnaWeapon(dnaHash('reward:' + claim), rarity, {}, 'wave');
      if (w) out.push(w);
    }
  return out.concat(dnaCodexSync());
}
// collection milestones (once each); returns [] (chests are announced by the UI)
function dnaCodexSync() {
  const d = dnaState(),
    a = state.meta.arsenal;
  for (const m of DNA_CODEX_MILESTONES) {
    const claim = 'codex:' + m.need;
    if (d.seen.length < m.need || d.claims.includes(claim) || !a) continue;
    d.claims.push(claim);
    a[ARSENAL_CHESTS[m.chest].key] += m.count || 1;
    d.codexPaid = (d.codexPaid || 0) + 1;
  }
  return [];
}
function dnaFusePreview(baseUid, donorUid) {
  const d = dnaState(),
    base = d.owned.find(w => w.uid === baseUid),
    donor = d.owned.find(w => w.uid === donorUid);
  if (!base || !donor || base === donor) return { ok: false, why: 'Zwei verschiedene DNA-Waffen wählen' };
  if (base.rarity !== donor.rarity) return { ok: false, why: 'Nur gleiche Seltenheit lässt sich fusionieren' };
  const i = DNA_RARITY_ORDER.indexOf(base.rarity);
  if (i < 0 || i >= DNA_RARITY_ORDER.length - 1) return { ok: false, why: 'Höchste Seltenheit erreicht' };
  if (!DNA_CHASSIS[base.chassis] || !DNA_AFFINITIES[donor.affinity]) return { ok: false, why: 'Teile aus einer neueren Version – Fusion dort möglich' };
  const cost = DNA_FUSE_COST[base.rarity],
    result = dnaGenerate(dnaHash(base.seed + ':' + donor.seed + ':fuse'), DNA_RARITY_ORDER[i + 1], { chassis: base.chassis, affinity: donor.affinity });
  return { ok: true, base, donor, cost, result, affordable: (state.meta.arsenal?.splitters || 0) >= cost };
}
// One transaction: both inputs out, the previewed weapon in (mounted if an input was), cost paid. Saved by the caller
// before the reveal.
function dnaFuse(baseUid, donorUid) {
  const p = dnaFusePreview(baseUid, donorUid);
  if (!p.ok || !p.affordable) return null;
  const d = dnaState(),
    wasMounted = d.mount === baseUid || d.mount === donorUid;
  state.meta.arsenal.splitters -= p.cost;
  d.owned = d.owned.filter(w => w.uid !== baseUid && w.uid !== donorUid);
  const weapon = { uid: 'w' + ++d.next, ...p.result, src: 'fusion', from: [baseUid, donorUid] };
  d.owned.push(weapon);
  dnaSeen(weapon);
  if (wasMounted || !d.mount) d.mount = weapon.uid;
  dnaCodexSync();
  return weapon;
}

// ----- Beta 1.5: DNA weapons in earned chests -----
// A separate, published bonus roll on top of a chest's Arsenal item: the item, its odds and the chest's ✦ bonus are
// unchanged. The roll and the weapon come from the chest's position in the account's opening count (stored with the
// open and saved before the reveal), so a reload can neither reroll nor reopen it. No chest is ever sold.
const DNA_CHEST_ODDS = {
  standard: { chance: 0.15, rarity: { common: 60, uncommon: 30, rare: 10 } },
  elite: { chance: 0.4, rarity: { uncommon: 40, rare: 45, epic: 15 } },
  relic: { chance: 1, rarity: { rare: 30, epic: 50, legendary: 20 } }
};
const DNA_FULL_SPLITTERS = { common: 4, uncommon: 6, rare: 10, epic: 20, legendary: 40, mythic: 60, celestial: 80 };
function dnaChestRoll(type, n) {
  const odds = DNA_CHEST_ODDS[type];
  if (!odds) return null;
  const rnd = dnaRng(dnaHash('chest:' + type + ':' + n));
  if (rnd() >= odds.chance) return null;
  const total = Object.values(odds.rarity).reduce((s, w) => s + w, 0);
  let r = rnd() * total,
    rarity = Object.keys(odds.rarity)[0];
  for (const [id, w] of Object.entries(odds.rarity)) {
    if (r < w) {
      rarity = id;
      break;
    }
    r -= w;
  }
  return { rarity, seed: dnaHash('chest-dna:' + type + ':' + n) };
}
const arsenalOpenChestBeforeDna = arsenalOpenChest;
arsenalOpenChest = (type = 'standard') => {
  const result = arsenalOpenChestBeforeDna(type);
  if (!result || !state.meta?.dna) return result;
  const roll = dnaChestRoll(type, arsenal().opened);
  if (!roll) return result;
  if (state.meta.dna.owned.length >= DNA_MAX_OWNED) {
    // a full DNA hangar: the weapon becomes Sternsplitter instead (nothing is lost)
    arsenal().splitters += DNA_FULL_SPLITTERS[roll.rarity];
    return { ...result, dnaSplitters: DNA_FULL_SPLITTERS[roll.rarity] };
  }
  return { ...result, dna: grantDnaWeapon(roll.seed, roll.rarity, {}, 'chest') };
};
