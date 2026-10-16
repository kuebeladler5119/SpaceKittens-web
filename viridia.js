// Viridia Bloom (planet id 'verdant', schema 32): Leuchtsporen, Biogel, the Wurzelnetz and Petalguard's saved state.
// Logic only; the story, boss fight and UI live in petalguard-ui.js. Loaded after mekhanos.js and before game.js
// (normalisers run while the save is loaded; everything else only when called). Plan: docs/PETALGUARD_PLAN.md.
//
//   Sporengarten (surface, mining) → colony.stock.spores
//   Biolabor: 3 Leuchtsporen + 25 Rohkristalle (from the depot) → 1 Biogel (colony.stock.biogel)
//   Wurzelnetz: 1–4 roots on Abbau / Lorenbahn / Sporengarten / Biolabor (+30 / +15 / +10 %, Symbiose +10 %)

const SPORES_PER_GEL = 3;
const RAW_PER_GEL = 25;
const SPORE_VALUE = 12; // Sternenbasar price per Leuchtspore
const BIOGEL_VALUE = 400; // Sternenbasar price per Biogel
const VIRIDIA_LEVEL_CAP = 10; // Sporengarten, Biolabor and the Leuchtpilz-Grotte drill wait for Petalguard above Lv 10

// ----- Petalguard: "Das stille Wurzelnetz" -----
// locked → overgrown (Viridia founded) → withering (Biolabor built: the Welke at the Wurzelknoten) → thorns (8 real
// Biogel healed the node) → battle (2 Dornenranken beaten at Viridia) → defeated (reward once) → repaired (repair once).
const PETALGUARD_STAGES = ['locked', 'overgrown', 'withering', 'thorns', 'battle', 'defeated', 'repaired'];
const BLOOM_PHASES = ['bud', 'bloom'];
const PETALS = 6;
const PETALGUARD_HEAL_GEL = 8;
const PETALGUARD_REPAIR = { biogel: 12, spores: 60, ore: 400 };
function normalizePetalguard(raw) {
  const num = (v, max) => Math.max(0, Math.min(max, Number.isFinite(Number(v)) ? Number(v) : 0));
  return {
    stage: PETALGUARD_STAGES.includes(raw?.stage) ? raw.stage : 'locked',
    healed: Math.floor(num(raw?.healed, PETALGUARD_HEAL_GEL)),
    thorns: Math.floor(num(raw?.thorns, 2)),
    hp: num(raw?.hp, 1e15),
    maxHp: num(raw?.maxHp, 1e15),
    fightStart: num(raw?.fightStart, 1e15),
    phase: BLOOM_PHASES.includes(raw?.phase) ? raw.phase : 'bud',
    phaseAt: num(raw?.phaseAt, 1e15),
    lastAt: num(raw?.lastAt, 1e15),
    petals: Math.floor(Number.isFinite(Number(raw?.petals)) ? num(raw.petals, PETALS) : PETALS),
    target: raw?.target === 'petals' ? 'petals' : 'core',
    damaged: Boolean(raw?.damaged),
    losses: Math.floor(num(raw?.losses, 1e6)),
    rewarded: Boolean(raw?.rewarded),
    repairedAt: num(raw?.repairedAt, 1e15)
  };
}
function petalguard() {
  return state.meta.guardians.petalguard;
}
function petalguardFriendly() {
  return state.meta?.guardians?.petalguard?.stage === 'repaired';
}
function viridiaIndex() {
  return PLANETS.findIndex(p => p.id === 'verdant');
}
function isViridia(planet = state.activePlanet) {
  return PLANETS[planet]?.id === 'verdant';
}
// Friendly Petalguard tends the Biolabor (+20 %). Read from the stage every time, never stored.
function viridiaBoost(kind, planet = state.activePlanet) {
  if (!petalguardFriendly() || !isViridia(planet)) return 1;
  return kind === 'biolab' ? 1.2 : 1;
}

// ----- Wurzelnetz -----
const ROOT_TARGETS = ['mine', 'rail', 'sporeGarden', 'biolab'];
const ROOT_SLOTS = 4;
const ROOT_REGROW_MS = 60000;
const ROOT_STEPS = [0.3, 0.15, 0.1]; // 1st, 2nd, 3rd root on the same target
const ROOT_SYMBIOSIS = 0.1;
function normalizeRoots(raw) {
  const slots = Array.from({ length: ROOT_SLOTS }, (_, i) => (ROOT_TARGETS.includes(raw?.slots?.[i]) ? raw.slots[i] : null));
  const regrowAt = Array.from({ length: ROOT_SLOTS }, (_, i) => {
    const t = Number(raw?.regrowAt?.[i]);
    return slots[i] && Number.isFinite(t) && t > 0 ? t : 0;
  });
  return { slots, regrowAt };
}
// Roots available: 1 at founding, +1 Sporengarten Lv 5, +1 Biolabor Lv 10, +1 from friendly Petalguard.
function rootCount(planet = state.activePlanet) {
  if (!isViridia(planet)) return 0;
  const ind = state.colonies[planet]?.industry || {};
  return 1 + ((ind.sporeGarden || 0) >= 5 ? 1 : 0) + ((ind.biolab || 0) >= 10 ? 1 : 0) + (petalguardFriendly() ? 1 : 0);
}
function activeRoots(planet = state.activePlanet, now = Date.now()) {
  const roots = state.colonies[planet]?.roots;
  if (!roots) return [];
  const n = rootCount(planet);
  return roots.slots.filter((target, i) => target && i < n && roots.regrowAt[i] <= now);
}
// Multiplier a target receives from the root network of the planet (1 everywhere else).
function rootBoost(target, planet = state.activePlanet, now = Date.now()) {
  if (!isViridia(planet)) return 1;
  const active = activeRoots(planet, now),
    count = active.filter(t => t === target).length;
  let bonus = 0;
  for (let i = 0; i < count; i++) bonus += ROOT_STEPS[Math.min(i, ROOT_STEPS.length - 1)];
  if ((target === 'sporeGarden' || target === 'biolab') && active.includes('sporeGarden') && active.includes('biolab')) bonus += ROOT_SYMBIOSIS;
  return 1 + bonus;
}
// Attach a root (or detach with null). A moved root regrows for 60 s before it counts; nothing is ever lost.
function setRoot(slot, target, planet = state.activePlanet, now = Date.now()) {
  const colony = state.colonies[planet];
  if (!colony?.roots || !isViridia(planet) || !(slot >= 0 && slot < rootCount(planet))) return false;
  if (target !== null && !ROOT_TARGETS.includes(target)) return false;
  if (colony.roots.slots[slot] === target) return false;
  colony.roots.slots[slot] = target;
  colony.roots.regrowAt[slot] = target ? now + ROOT_REGROW_MS : 0;
  return true;
}

// ----- Sporengarten and Biolabor -----
function sporeRate() {
  const level = industryLevel('sporeGarden') || 0;
  return level > 0 ? INDUSTRY_BUILDINGS.sporeGarden.perLevel * level * buildingMultiplier(level) * workplaceEfficiency('sporeGarden') * rootBoost('sporeGarden') : 0;
}
function sporeCapacity() {
  const level = industryLevel('sporeGarden') || 0;
  return level > 0 ? 40 + 75 * level * buildingMultiplier(level) : 0;
}
function biogelRate() {
  const level = industryLevel('biolab') || 0;
  return level > 0 ? INDUSTRY_BUILDINGS.biolab.perLevel * level * buildingMultiplier(level) * workplaceEfficiency('biolab') * viridiaBoost('biolab') * rootBoost('biolab') : 0;
}
function biogelCapacity() {
  const level = industryLevel('biolab') || 0;
  return level > 0 ? 10 + 15 * level * buildingMultiplier(level) : 0;
}
// Manual harvest / batch (like the other manual stages): real inputs only, never beyond the stores.
function manualSpores() {
  const colony = colonyAt(),
    amount = Math.min(Math.max(4, sporeRate() * 8), Math.max(0, sporeCapacity() - colony.stock.spores));
  if (amount <= 0 || !workplaceExists('sporeGarden')) return 0;
  colony.stock.spores += amount;
  return amount;
}
function manualBiolab() {
  const colony = colonyAt(),
    index = state.activePlanet,
    level = industryLevel('biolab') || 0;
  if (!level) return 0;
  const depot = state.planetOps.storage[index] || 0,
    want = Math.max(1, Math.floor(biogelRate() * 8)),
    room = Math.max(0, Math.floor(biogelCapacity() - colony.stock.biogel)),
    made = Math.min(want, room, Math.floor(colony.stock.spores / SPORES_PER_GEL), Math.floor(depot / RAW_PER_GEL));
  if (made <= 0) return 0;
  colony.stock.spores -= made * SPORES_PER_GEL;
  state.planetOps.storage[index] = depot - made * RAW_PER_GEL;
  colony.stock.biogel += made;
  return made;
}
