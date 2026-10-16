// Arsenal (beta 1 + 1.1, schema 34): a permanent, account-level equipment collection next to the run loot. Logic only;
// the UI lives in arsenal-ui.js, the combat cat in combat-cat.js / combat-cat-ui.js. Loaded after viridia.js and before
// game.js (normalizers run while the save loads). Docs: docs/beta-1/ARSENAL.md, docs/beta-1-1/COMBAT_CREW.md.
//
//   catalog (fixed stats, stable ids) → owned items {id: {level}} → loadout (5 slots: ship weapon, ship support, Mochi's
//   pilot gear, Tikki's weapon, Tikki's support) → one bounded damage factor + behaviour effects (burst, mark, charge)
//   Sternsplitter (✦) from duplicates, chests and overflowing run loot → item levels 1–5 → recipes (fusion) for the
//   mythic and celestial tiers (the ingredients are kept — fusion never destroys an item)
//   free chests in three kinds: Sternenkiste, Kometenkiste, Sternenrelikt
//
// Nothing here is purchasable: every catalog entry is earned (`source`). Purchased or cosmetic content needs its own
// entitlement path later (see ARSENAL.md) and must never be granted from the client save alone.

// Slot ids are stable save keys. Beta 1 had weapon/support/pilot; Beta 1.1 adds Tikki's two slots (old saves keep theirs).
const ARSENAL_SLOTS = ['weapon', 'support', 'pilot', 'catWeapon', 'catSupport'];
const ARSENAL_SLOT_INFO = {
  weapon: { name: 'Waffenaufsatz', short: 'Waffe', icon: '⚔', owner: 'ship' },
  support: { name: 'Schiffsmodul', short: 'Modul', icon: '⬡', owner: 'ship' },
  pilot: { name: 'Pilotenausrüstung', short: 'Pilot', icon: '🐾', owner: 'pilot' },
  catWeapon: { name: 'Tikkis Werkzeugwaffe', short: 'Werkzeug', icon: '🔧', owner: 'cat' },
  catSupport: { name: 'Tikkis Gleitermodul', short: 'Gleiter', icon: '🛸', owner: 'cat' }
};
// Seven rarity tiers (Beta 1.1). The four Beta-1 ids keep their meaning; uncommon/mythic/celestial are new tokens.
const ARSENAL_RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'celestial'];
const ARSENAL_RARITY_NAME = { common: 'Gewöhnlich', uncommon: 'Ungewöhnlich', rare: 'Selten', epic: 'Episch', legendary: 'Legendär', mythic: 'Mythisch', celestial: 'Himmlisch' };
const ARSENAL_MAX_LEVEL = 5;
const ARSENAL_LEVEL_STEP = 0.2; // +20 % of the base value per level (Lv 5 = 1.8 × base)
const ARSENAL_UPGRADE_COST = {
  common: [4, 8, 14, 22],
  uncommon: [5, 10, 17, 27],
  rare: [6, 12, 20, 32],
  epic: [10, 18, 30, 48],
  legendary: [16, 28, 45, 70],
  mythic: [24, 40, 60, 90],
  celestial: [36, 60, 90, 130]
};
const ARSENAL_DUPLICATE_SPLITTERS = { common: 6, uncommon: 9, rare: 12, epic: 30, legendary: 70, mythic: 120, celestial: 200 };
const ARSENAL_LOOT_SALVAGE = { normal: 1, rare: 2, epic: 5, legendary: 12 }; // run loot beyond 30 items → splitters
const ARSENAL_FACTOR_CAP = 1.75; // the % effects never multiply a shot by more than this
const ARSENAL_RUN_LOOT_CAP = 30;

// Effect kinds. Percentage kinds feed arsenalDamageFactor() (capped): dmg, aimed, boss (sector bosses and guardian
// fights), weapon (only with that weapon system), combo (per combo stack), loot (rarer run loot). Behaviour kinds
// (Beta 1.1, read by combat-cat.js): burst (every Nth ship shot an extra burst hit), mark (Tikki's strikes mark the
// target: ship shots +x % for a few seconds), charge (each Tikki strike charges the ship's next shot), catPower (Tikki's
// strikes hit harder), catCooldown (Funkenhagel recharges faster, seconds). Values are the Lv-1 base.
const ARSENAL_ITEMS = [
  { id: 'focus-lens', name: 'Fokuslinse', icon: '🔍', slot: 'weapon', rarity: 'common', effects: [{ kind: 'aimed', value: 0.12 }], source: 'chest' },
  { id: 'plasma-nozzle', name: 'Plasmadüse', icon: '🔥', slot: 'weapon', rarity: 'rare', effects: [{ kind: 'weapon', weapon: 'Plasma', value: 0.14 }], source: 'chest' },
  { id: 'arc-coil', name: 'Bogenspule', icon: '⚡', slot: 'weapon', rarity: 'rare', effects: [{ kind: 'weapon', weapon: 'Arc', value: 0.14 }], source: 'chest' },
  { id: 'laser-rail', name: 'Laserschiene', icon: '📏', slot: 'weapon', rarity: 'common', effects: [{ kind: 'weapon', weapon: 'Laser', value: 0.1 }], source: 'chest' },
  { id: 'comet-splinter', name: 'Kometensplitter', icon: '☄', slot: 'weapon', rarity: 'epic', effects: [{ kind: 'dmg', value: 0.08 }, { kind: 'boss', value: 0.06 }], source: 'chest' },
  { id: 'frostbyte-core', name: 'Frostbyte-Kühlkern', icon: '❄', slot: 'weapon', rarity: 'epic', effects: [{ kind: 'boss', value: 0.12 }], source: 'guardian:frostbyte' },
  { id: 'sunforge-focus', name: 'Sonnenschmiede-Fokus', icon: '🌞', slot: 'weapon', rarity: 'legendary', effects: [{ kind: 'dmg', value: 0.1 }, { kind: 'aimed', value: 0.08 }], source: 'chest' },
  // Beta 1.1: a weapon attachment that changes the shot pattern — every 4th shot releases a splinter burst
  { id: 'splinter-charge', name: 'Splitterladung', icon: '💥', slot: 'weapon', rarity: 'uncommon', effects: [{ kind: 'burst', every: 4, value: 0.4 }], source: 'chest' },
  { id: 'loot-magnet', name: 'Beutemagnet', icon: '🧲', slot: 'support', rarity: 'common', effects: [{ kind: 'loot', value: 0.03 }], source: 'chest' },
  { id: 'combo-relay', name: 'Kettenrelais', icon: '🔗', slot: 'support', rarity: 'rare', effects: [{ kind: 'combo', value: 0.006 }], source: 'chest' },
  { id: 'ion-capacitor', name: 'Ionen-Kondensator', icon: '🔋', slot: 'support', rarity: 'rare', effects: [{ kind: 'weapon', weapon: 'Ion', value: 0.12 }], source: 'chest' },
  { id: 'pips-core', name: 'P.I.P.S.-Kernmodul', icon: '📡', slot: 'support', rarity: 'epic', effects: [{ kind: 'dmg', value: 0.07 }], source: 'guardian:pips' },
  { id: 'ember-valve', name: 'Emberbells Druckventil', icon: '🔔', slot: 'support', rarity: 'epic', effects: [{ kind: 'dmg', value: 0.04 }, { kind: 'combo', value: 0.004 }], source: 'guardian:emberbell' },
  { id: 'nova-heart', name: 'Novaherz', icon: '🌟', slot: 'support', rarity: 'legendary', effects: [{ kind: 'weapon', weapon: 'Nova', value: 0.12 }, { kind: 'boss', value: 0.08 }], source: 'chest' },
  { id: 'star-goggles', name: 'Sternbrille', icon: '🥽', slot: 'pilot', rarity: 'common', effects: [{ kind: 'aimed', value: 0.08 }], source: 'chest' },
  { id: 'lucky-scarf', name: 'Glücksschal', icon: '🧣', slot: 'pilot', rarity: 'rare', effects: [{ kind: 'loot', value: 0.04 }], source: 'chest' },
  { id: 'cog-stamp', name: 'Cogsworths Prüfstempel', icon: '⚙', slot: 'pilot', rarity: 'epic', effects: [{ kind: 'aimed', value: 0.15 }], source: 'guardian:cogsworth' },
  { id: 'petal-seed', name: 'Petalguards Leuchtsamen', icon: '🌸', slot: 'pilot', rarity: 'epic', effects: [{ kind: 'boss', value: 0.1 }, { kind: 'loot', value: 0.02 }], source: 'guardian:petalguard' },
  { id: 'aurora-helmet', name: 'Polarlicht-Helm', icon: '⛑', slot: 'pilot', rarity: 'legendary', effects: [{ kind: 'dmg', value: 0.08 }, { kind: 'aimed', value: 0.08 }], source: 'chest' },
  // Beta 1.1 — Tikki's gear (her Funkengleiter fights next to the ship)
  { id: 'spark-sling', name: 'Funkenschleuder', icon: '🔩', slot: 'catWeapon', rarity: 'uncommon', effects: [{ kind: 'catPower', value: 0.25 }], source: 'chest' },
  { id: 'mark-laser', name: 'Markierungslaser', icon: '🎯', slot: 'catWeapon', rarity: 'rare', effects: [{ kind: 'mark', value: 0.12 }], source: 'chest' },
  { id: 'nova-wrench', name: 'Novaschlüssel', icon: '🛠', slot: 'catWeapon', rarity: 'epic', effects: [{ kind: 'catPower', value: 0.3 }, { kind: 'mark', value: 0.06 }], source: 'chest' },
  { id: 'tool-belt', name: 'Tikkis Werkzeuggürtel', icon: '🧰', slot: 'catSupport', rarity: 'uncommon', effects: [{ kind: 'catCooldown', value: 5 }], source: 'chest' },
  { id: 'chain-capacitor', name: 'Kettenkondensator', icon: '🔌', slot: 'catSupport', rarity: 'rare', effects: [{ kind: 'charge', value: 0.2 }], source: 'chest' },
  // Beta 1.1 — fusion recipes only (mythic / celestial); the ingredients stay owned
  { id: 'star-eye', name: 'Sternenauge', icon: '👁', slot: 'pilot', rarity: 'mythic', effects: [{ kind: 'aimed', value: 0.16 }, { kind: 'dmg', value: 0.05 }], source: 'fusion' },
  { id: 'storm-coil', name: 'Gewitterspule', icon: '🌩', slot: 'catSupport', rarity: 'mythic', effects: [{ kind: 'charge', value: 0.25 }, { kind: 'catPower', value: 0.15 }], source: 'fusion' },
  { id: 'orbit-crown', name: 'Orbitkrone', icon: '👑', slot: 'support', rarity: 'celestial', effects: [{ kind: 'dmg', value: 0.08 }, { kind: 'burst', every: 5, value: 0.3 }], source: 'fusion' }
];
const ARSENAL_BY_ID = Object.fromEntries(ARSENAL_ITEMS.map(item => [item.id, item]));
const ARSENAL_GUARDIANS = ['pips', 'frostbyte', 'emberbell', 'cogsworth', 'petalguard'];
const ARSENAL_GUARDIAN_NAME = { pips: 'P.I.P.S.', frostbyte: 'Frostbyte', emberbell: 'Emberbell', cogsworth: 'Cogsworth-9', petalguard: 'Petalguard' };
// Fusion recipes: both ingredients at Lv 5 + splitters → the result (once). Nothing is consumed except splitters.
const ARSENAL_FUSIONS = [
  { id: 'star-eye', inputs: ['focus-lens', 'star-goggles'], splitters: 120 },
  { id: 'storm-coil', inputs: ['chain-capacitor', 'arc-coil'], splitters: 150 },
  { id: 'orbit-crown', inputs: ['star-eye', 'storm-coil'], splitters: 300 }
];
const ARSENAL_FUSION_BY_ID = Object.fromEntries(ARSENAL_FUSIONS.map(f => [f.id, f]));

// ----- chests -----
// Three free kinds. Each has its own explicit table (weights per rarity, normalized), splitter bonus and sources.
// Mythic and celestial items never come from chests — they are fusion goals.
const ARSENAL_CHESTS = {
  standard: { name: 'Sternenkiste', key: 'chests', splitters: 3, weights: { common: 45, uncommon: 28, rare: 20, epic: 6, legendary: 1 } },
  elite: { name: 'Kometenkiste', key: 'chestsElite', splitters: 8, weights: { rare: 55, epic: 35, legendary: 10 } },
  relic: { name: 'Sternenrelikt', key: 'chestsRelic', splitters: 20, weights: { epic: 65, legendary: 35 } }
};
const ARSENAL_CHEST_TYPES = ['standard', 'elite', 'relic'];
const ARSENAL_CHEST_SPLITTERS = ARSENAL_CHESTS.standard.splitters; // Beta-1 name kept
const ARSENAL_CHEST_WEIGHTS = ARSENAL_CHESTS.standard.weights; // Beta-1 name kept
const ARSENAL_COLLECTION_RELICS = [10, 15, 20]; // owning this many items pays one Sternenrelikt each

// ----- state -----
// meta.arsenal = { items {id: {level}}, unknown {id: raw} (ids from a newer build, kept untouched), loadout {slot: id|null},
//   splitters, chests, chestsElite, chestsRelic, seed (uint32, advanced once per opened chest), claims [string] (each
//   reward exactly once), bossRecord, opened, salvaged, fused, lastReveal }
function normalizeArsenal(raw) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const num = (v, max) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(max, Math.floor(n))) : 0;
  };
  const items = {},
    unknown = {};
  const rawItems = src.items && typeof src.items === 'object' && !Array.isArray(src.items) ? src.items : {};
  for (const [id, entry] of Object.entries(rawItems)) {
    if (ARSENAL_BY_ID[id]) items[id] = { level: Math.max(1, Math.min(ARSENAL_MAX_LEVEL, num(entry?.level, ARSENAL_MAX_LEVEL) || 1)) };
    else unknown[id] = entry; // never delete what a newer build may know
  }
  if (src.unknown && typeof src.unknown === 'object' && !Array.isArray(src.unknown))
    for (const [id, entry] of Object.entries(src.unknown)) {
      if (ARSENAL_BY_ID[id] && !items[id]) items[id] = { level: Math.max(1, Math.min(ARSENAL_MAX_LEVEL, num(entry?.level, ARSENAL_MAX_LEVEL) || 1)) }; // known now
      else if (!ARSENAL_BY_ID[id] && !(id in unknown)) unknown[id] = entry;
    }
  const loadout = {};
  for (const slot of ARSENAL_SLOTS) {
    const id = src.loadout?.[slot];
    loadout[slot] = typeof id === 'string' && items[id] && ARSENAL_BY_ID[id].slot === slot ? id : null;
  }
  const seed = Number(src.seed);
  return {
    items,
    unknown,
    loadout,
    splitters: num(src.splitters, 1e9),
    chests: num(src.chests, 1e6),
    chestsElite: num(src.chestsElite, 1e6),
    chestsRelic: num(src.chestsRelic, 1e6),
    seed: Number.isFinite(seed) && seed > 0 ? seed >>> 0 : (Math.floor(Math.random() * 4294967295) >>> 0) || 1,
    claims: Array.isArray(src.claims) ? [...new Set(src.claims.filter(c => typeof c === 'string'))].slice(0, 500) : [],
    bossRecord: num(src.bossRecord, 1e9),
    opened: num(src.opened, 1e9),
    salvaged: num(src.salvaged, 1e9),
    fused: num(src.fused, 1e6),
    presets: normalizeArsenalPresets(src.presets), // Beta 1.2 (schema 35)
    lastReveal:
      src.lastReveal && typeof src.lastReveal === 'object' && ARSENAL_BY_ID[src.lastReveal.id]
        ? { id: src.lastReveal.id, duplicate: Boolean(src.lastReveal.duplicate), splitters: num(src.lastReveal.splitters, 1e6), chest: ARSENAL_CHESTS[src.lastReveal.chest] ? src.lastReveal.chest : 'standard' }
        : null
  };
}
function arsenal() {
  return state.meta.arsenal;
}
function arsenalLevel(id) {
  return arsenal().items[id]?.level || 0;
}
function arsenalOwned(id) {
  return arsenalLevel(id) > 0;
}
function arsenalEffectValue(effect, level) {
  return effect.value * (1 + ARSENAL_LEVEL_STEP * (Math.max(1, level) - 1));
}
function arsenalChestCount(type = 'standard') {
  return arsenal()[ARSENAL_CHESTS[type].key] || 0;
}
function arsenalChestTotal() {
  return ARSENAL_CHEST_TYPES.reduce((sum, t) => sum + arsenalChestCount(t), 0);
}

// ----- effects -----
// Sum of the equipped items' effects (no state change). weapon effects are kept per weapon system; burst keeps the
// strongest equipped burst (value and its interval).
function arsenalMods() {
  const mods = { dmg: 0, aimed: 0, boss: 0, combo: 0, loot: 0, weapon: {}, burst: null, mark: 0, charge: 0, catPower: 0, catCooldown: 0 };
  const a = state.meta?.arsenal;
  if (!a) return mods;
  for (const slot of ARSENAL_SLOTS) {
    const id = a.loadout[slot],
      item = ARSENAL_BY_ID[id];
    if (!item || !a.items[id]) continue;
    for (const effect of item.effects) {
      const value = arsenalEffectValue(effect, a.items[id].level);
      if (effect.kind === 'weapon') mods.weapon[effect.weapon] = (mods.weapon[effect.weapon] || 0) + value;
      else if (effect.kind === 'burst') {
        if (!mods.burst || value / effect.every > mods.burst.value / mods.burst.every) mods.burst = { every: effect.every, value };
      } else mods[effect.kind] += value;
    }
  }
  return mods;
}
// Sector bosses and every guardian fight count as boss fights for "boss" effects.
function arsenalBossContext() {
  try {
    if (enemyInfo().boss) return true;
    const g = state.meta.guardians;
    return ARSENAL_GUARDIANS.some(id => g?.[id]?.stage === 'battle');
  } catch {
    return false;
  }
}
// One factor per shot, applied once inside attack(); bounded so equipment cannot break boss balance.
function arsenalDamageFactor(opts = {}) {
  const m = arsenalMods(),
    aimed = opts.aimed ?? state.aimReady,
    boss = opts.boss ?? arsenalBossContext(),
    weapon = opts.weapon ?? state.ship.weaponType;
  const factor = (1 + m.dmg) * (aimed ? 1 + m.aimed : 1) * (boss ? 1 + m.boss : 1) * (1 + (m.weapon[weapon] || 0));
  return Math.min(ARSENAL_FACTOR_CAP, factor);
}
function arsenalComboStep() {
  return arsenalMods().combo;
}
function arsenalLootBonus() {
  return arsenalMods().loot;
}

// ----- actions (each returns true when something changed) -----
function arsenalEquip(id) {
  if (typeof arenaActive === 'function' && arenaActive()) return false; // equipment is locked during an expedition fight (Beta 1.5)
  const item = ARSENAL_BY_ID[id];
  if (!item || !arsenalOwned(id)) return false;
  if (arsenal().loadout[item.slot] === id) return false;
  arsenal().loadout[item.slot] = id;
  return true;
}
function arsenalUnequip(slot) {
  if (typeof arenaActive === 'function' && arenaActive()) return false; // equipment is locked during an expedition fight (Beta 1.5)
  if (!ARSENAL_SLOTS.includes(slot) || !arsenal().loadout[slot]) return false;
  arsenal().loadout[slot] = null;
  return true;
}
function arsenalUpgradeCost(id) {
  const item = ARSENAL_BY_ID[id],
    level = arsenalLevel(id);
  if (!item || !level || level >= ARSENAL_MAX_LEVEL) return null;
  return ARSENAL_UPGRADE_COST[item.rarity][level - 1];
}
function arsenalUpgrade(id) {
  const price = arsenalUpgradeCost(id);
  if (price === null || arsenal().splitters < price) return false;
  arsenal().splitters -= price;
  arsenal().items[id].level += 1;
  return true;
}
// Grant one catalog item: new → Lv 1 (auto-equipped into an empty slot), duplicate → splitters. Returns the result.
function arsenalGrantItem(id) {
  const item = ARSENAL_BY_ID[id];
  if (!item) return null;
  const a = arsenal();
  if (a.items[id]) {
    const splitters = ARSENAL_DUPLICATE_SPLITTERS[item.rarity];
    a.splitters += splitters;
    return { id, duplicate: true, splitters };
  }
  a.items[id] = { level: 1 };
  if (!a.loadout[item.slot]) a.loadout[item.slot] = id;
  return { id, duplicate: false, splitters: 0 };
}
// Claim a one-time reward. `grant` runs only if the claim is new; the claim and the grant happen in one synchronous
// step, so a reload can never pay it twice.
function arsenalClaim(key, grant) {
  const a = arsenal();
  if (a.claims.includes(key)) return false;
  a.claims.push(key);
  grant(a);
  return true;
}

// ----- fusion (Beta 1.1) -----
// Status of a recipe for the preview: which ingredient is missing or below Lv 5, and whether the splitters suffice.
function arsenalFusionStatus(id) {
  const recipe = ARSENAL_FUSION_BY_ID[id];
  if (!recipe) return null;
  const inputs = recipe.inputs.map(input => ({ id: input, level: arsenalLevel(input), ok: arsenalLevel(input) >= ARSENAL_MAX_LEVEL }));
  return { id, inputs, splitters: recipe.splitters, done: arsenalOwned(id), affordable: arsenal().splitters >= recipe.splitters, ready: !arsenalOwned(id) && inputs.every(i => i.ok) && arsenal().splitters >= recipe.splitters };
}
// One synchronous transaction: claim + splitters + item. The ingredients stay owned and equipped as they were.
function arsenalFuse(id) {
  const status = arsenalFusionStatus(id);
  if (!status?.ready) return null;
  let result = null;
  arsenalClaim('fusion:' + id, a => {
    a.splitters -= status.splitters;
    a.fused += 1;
    result = arsenalGrantItem(id);
  });
  return result;
}

// ----- chests -----
// Deterministic PRNG (mulberry32): the seed is stored and advanced once per opened chest — reloading cannot reroll.
function arsenalRandom(seed) {
  let t = (seed + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const ARSENAL_CHEST_POOL = ARSENAL_ITEMS.filter(item => item.source === 'chest');
// The explicit, normalized drop table of a chest kind: P(item) = weight(rarity) / Σweights / items of that rarity.
function arsenalDropTable(type = 'standard') {
  const weights = ARSENAL_CHESTS[type].weights,
    total = Object.values(weights).reduce((sum, w) => sum + w, 0);
  return ARSENAL_RARITIES.flatMap(rarity => {
    const pool = ARSENAL_CHEST_POOL.filter(item => item.rarity === rarity);
    if (!weights[rarity] || !pool.length) return [];
    return pool.map(item => ({ id: item.id, rarity, chance: weights[rarity] / total / pool.length }));
  });
}
function arsenalRollChest(seed, type = 'standard') {
  const table = arsenalDropTable(type),
    roll = arsenalRandom(seed);
  let acc = 0;
  for (const entry of table) {
    acc += entry.chance;
    if (roll < acc) return entry.id;
  }
  return table[table.length - 1].id; // floating-point remainder → never an empty chest
}
function arsenalOpenChest(type = 'standard') {
  const a = arsenal(),
    chest = ARSENAL_CHESTS[type];
  if (!chest || !(a[chest.key] >= 1)) return null;
  const id = arsenalRollChest(a.seed, type);
  a[chest.key] -= 1;
  a.seed = (Math.imul(a.seed ^ 0x9e3779b9, 2654435761) >>> 0) || 1;
  a.opened += 1;
  a.splitters += chest.splitters;
  const result = arsenalGrantItem(id);
  a.lastReveal = { ...result, chest: type };
  return { ...result, base: chest.splitters, chest: type };
}

// ----- reward sources -----
// Run once per render and at load. Uses claims, so it is idempotent and pays existing saves once (retroactive):
// welcome chest; per guardian victory its signature item + a Sternenkiste (Beta 1) + a Kometenkiste (Beta 1.1); per
// repaired guardian a Sternenrelikt; per first colony on a planet a Sternenkiste; collection milestones (10/15/20
// items) a Sternenrelikt each.
function arsenalSync() {
  if (!state.meta?.arsenal) return [];
  const granted = [];
  arsenalClaim('welcome', a => {
    a.chests += 1;
    granted.push({ kind: 'welcome' });
  });
  for (const g of ARSENAL_GUARDIANS) {
    const stage = state.meta.guardians?.[g]?.stage;
    if (stage !== 'defeated' && stage !== 'repaired') continue;
    const item = ARSENAL_ITEMS.find(entry => entry.source === 'guardian:' + g);
    arsenalClaim('guardian:' + g, a => {
      const result = arsenalGrantItem(item.id);
      a.chests += 1;
      granted.push({ kind: 'guardian', guardian: g, ...result });
    });
    arsenalClaim('elite:guardian:' + g, a => {
      a.chestsElite += 1;
      granted.push({ kind: 'elite', guardian: g });
    });
    if (stage === 'repaired')
      arsenalClaim('relic:repaired:' + g, a => {
        a.chestsRelic += 1;
        granted.push({ kind: 'relic', guardian: g });
      });
  }
  PLANETS.forEach((planet, index) => {
    if (index === 0 || !state.planetsUnlocked[index]) return;
    arsenalClaim('planet:' + planet.id, a => {
      a.chests += 1;
      granted.push({ kind: 'planet', planet: index });
    });
  });
  const owned = Object.keys(state.meta.arsenal.items).length;
  for (const n of ARSENAL_COLLECTION_RELICS)
    if (owned >= n)
      arsenalClaim('relic:collection:' + n, a => {
        a.chestsRelic += 1;
        granted.push({ kind: 'relic', collection: n });
      });
  return granted;
}
// A sector boss beaten at a higher ladder level than ever before pays one chest (account-level record, no farming);
// every 25th ladder level pays a Kometenkiste instead of a Sternenkiste.
function arsenalBossVictory(level) {
  const a = state.meta?.arsenal;
  if (!a || !(level > a.bossRecord)) return false;
  a.bossRecord = level;
  if (level % 25 === 0) a.chestsElite += 1;
  else a.chests += 1;
  return level % 25 === 0 ? 'elite' : 'standard';
}
// Run loot beyond 30 items: the weakest (oldest among equals) becomes splitters instead of vanishing.
function arsenalTrimLoot() {
  const salvaged = [];
  while (state.inventory.length > ARSENAL_RUN_LOOT_CAP) {
    let weakest = state.inventory.length - 1;
    for (let i = state.inventory.length - 1; i >= 0; i--) if ((state.inventory[i].power || 0) < (state.inventory[weakest].power || 0)) weakest = i;
    const [item] = state.inventory.splice(weakest, 1),
      splitters = ARSENAL_LOOT_SALVAGE[item.rarity] || 1;
    if (state.meta?.arsenal) {
      state.meta.arsenal.splitters += splitters;
      state.meta.arsenal.salvaged += 1;
    }
    salvaged.push({ name: item.name, rarity: item.rarity, splitters });
  }
  return salvaged;
}

// ----- Beta 1.2: synergies (two perceivable pairings of existing effects, inside the existing caps) -----
// Active when the loadout contains both effect kinds. Applied in combat-cat.js (shipShotEffectFactor ≤ 1.5,
// shipShotResolved), so no new damage path and no change to the ×1.75 arsenal cap.
const ARSENAL_SYNERGIES = [
  { id: 'target-lock', name: 'Zielerfassung', kinds: ['mark', 'aimed'], value: 0.1, text: 'Gezielte Schüsse auf ein von Tikki markiertes Ziel +10 %' },
  { id: 'chain-burst', name: 'Kettenreaktion', kinds: ['charge', 'burst'], value: 0.5, text: 'Ein von Tikki geladener Schuss verstärkt seinen Splitterstoß um 50 %' }
];
function arsenalEquippedKinds() {
  const kinds = new Set(),
    a = state.meta?.arsenal;
  if (!a) return kinds;
  for (const slot of ARSENAL_SLOTS) {
    const item = ARSENAL_BY_ID[a.loadout[slot]];
    if (item && a.items[item.id]) item.effects.forEach(effect => kinds.add(effect.kind));
  }
  return kinds;
}
function arsenalSynergyActive(id) {
  const synergy = ARSENAL_SYNERGIES.find(s => s.id === id);
  if (!synergy) return false;
  const kinds = arsenalEquippedKinds();
  return synergy.kinds.every(kind => kinds.has(kind));
}
function arsenalActiveSynergies() {
  const kinds = arsenalEquippedKinds();
  return ARSENAL_SYNERGIES.filter(s => s.kinds.every(kind => kinds.has(kind)));
}

// ----- Beta 1.2: loadout presets (convenience only — they reference owned items, never copy them) -----
const ARSENAL_PRESET_NAMES = ['Erkunden', 'Bossjagd', 'Auto-Kampf'];
function normalizeArsenalPresets(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return ARSENAL_PRESET_NAMES.map((name, index) => {
    const src = list[index] && typeof list[index] === 'object' ? list[index] : {};
    const loadout = {};
    // ids are kept as references (an item not owned yet — or from a newer build — is validated when applied)
    for (const slot of ARSENAL_SLOTS) {
      const id = src.loadout?.[slot];
      loadout[slot] = typeof id === 'string' && id.length <= 40 ? id : null;
    }
    return { name, saved: Boolean(src.saved), loadout };
  });
}
// Switching is blocked while a guardian fight or Funkenhagel volley runs (no mid-fight swaps, no cooldown tricks).
function arsenalPresetBlocked() {
  const g = state.meta?.guardians;
  if (ARSENAL_GUARDIANS.some(id => g?.[id]?.stage === 'battle')) return 'Während eines Wächterkampfs nicht möglich';
  if (typeof catVolley !== 'undefined' && catVolley.left > 0) return 'Während des Funkenhagels nicht möglich';
  if (typeof challengeActive === 'function' && challengeActive()) return 'Während einer Sektorprüfung nicht möglich';
  if (typeof arenaActive === 'function' && arenaActive()) return 'Während einer Expedition nicht möglich';
  return null;
}
function arsenalPresetSave(index) {
  const preset = arsenal().presets?.[index];
  if (!preset) return false;
  preset.loadout = Object.fromEntries(ARSENAL_SLOTS.map(slot => [slot, arsenal().loadout[slot] || null]));
  preset.saved = true;
  return true;
}
// Applies a saved preset: owned items go to their slot; a missing item leaves that slot as it is. Returns a report.
function arsenalPresetApply(index) {
  const a = arsenal(),
    preset = a.presets?.[index];
  if (!preset?.saved) return { ok: false, reason: 'Noch nicht gespeichert' };
  const blocked = arsenalPresetBlocked();
  if (blocked) return { ok: false, reason: blocked };
  const missing = [];
  let changed = 0;
  for (const slot of ARSENAL_SLOTS) {
    const id = preset.loadout[slot];
    if (!id) {
      if (a.loadout[slot]) changed++;
      a.loadout[slot] = null;
    } else if (ARSENAL_BY_ID[id]?.slot === slot && a.items[id]) {
      if (a.loadout[slot] !== id) changed++;
      a.loadout[slot] = id;
    } else missing.push(id);
  }
  return { ok: true, changed, missing };
}
function arsenalSynergyValue(id) {
  return ARSENAL_SYNERGIES.find(s => s.id === id)?.value || 0;
}
