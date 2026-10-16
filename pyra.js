// Pyra-9 (planet id 'volcanic', schema 30): Glutstein, the Glutschmelze and Emberbell's saved state. Logic only;
// the story, boss fight and UI live in pyra-ui.js. Loaded after freight.js and before game.js (normalisers are used
// while the save is loaded; everything else only when called).
//
//   Pyra Schacht 2 (Glutkristall-Stollen) → Glutstein (typed elevator cargo) → colony.stock.ember
//   Glutschmelze: 4 Glutstein + 20 Rohkristalle (from the depot) → 1 Glutlegierung (colony.stock.emberAlloy)
//   optional coolant: Thermalzellen in the Pyra stock (freight from Glacies) → +50 %, 1 cell per 5 alloys

const EMBER_PER_ALLOY = 4;
const RAW_PER_ALLOY = 20;
const CELLS_PER_ALLOY = 0.2; // coolant use while Thermalzellen are present
const EMBER_VALUE = 6; // Sternenbasar price per Glutstein
const ALLOY_VALUE = 100; // Sternenbasar price per Glutlegierung
const PYRA_LEVEL_CAP = 10; // Glutschmelze and Magmaspalte overheat above Lv 10 until Emberbell is recalibrated

// Emberbell: locked → overheated (Pyra founded) → console (cooling console found in the Magmaspalte, feed alloys)
// → drones (2 heat drones) → battle → defeated → repaired (friendly helper).
const EMBERBELL_STAGES = ['locked', 'overheated', 'console', 'drones', 'battle', 'defeated', 'repaired'];
const EMBER_CONSOLE_ALLOYS = 6;
const EMBERBELL_REPAIR = { alloy: 10, ember: 40, ore: 300 };
function normalizeEmberbell(raw) {
  const num = (v, max) => Math.max(0, Math.min(max, Number.isFinite(Number(v)) ? Number(v) : 0));
  return {
    stage: EMBERBELL_STAGES.includes(raw?.stage) ? raw.stage : 'locked',
    console: Math.floor(num(raw?.console, EMBER_CONSOLE_ALLOYS)),
    drones: Math.floor(num(raw?.drones, 2)),
    hp: num(raw?.hp, 1e15),
    maxHp: num(raw?.maxHp, 1e15),
    fightStart: num(raw?.fightStart, 1e15),
    pressure: num(raw?.pressure, 100),
    phase: ['build', 'warn', 'blast', 'cool'].includes(raw?.phase) ? raw.phase : 'build',
    phaseAt: num(raw?.phaseAt, 1e15),
    lastAt: num(raw?.lastAt, 1e15)
  };
}
function emberbell() {
  return state.meta.guardians.emberbell;
}
function pyraIndex() {
  return PLANETS.findIndex(p => p.id === 'volcanic');
}
function isPyra(planet = state.activePlanet) {
  return PLANETS[planet]?.id === 'volcanic';
}
function emberbellFriendly() {
  return state.meta?.guardians?.emberbell?.stage === 'repaired';
}
// Friendly Emberbell helps Pyra's industry a little (no manager work): Glutschmelze +20 %, Glutstein +15 %.
function pyraBoost(kind, planet = state.activePlanet) {
  if (!emberbellFriendly() || !isPyra(planet)) return 1;
  return kind === 'foundry' ? 1.2 : kind === 'ember' ? 1.15 : 1;
}
// ----- Glutschmelze -----
function foundryRate() {
  const level = industryLevel('foundry') || 0;
  return level > 0 ? INDUSTRY_BUILDINGS.foundry.perLevel * level * buildingMultiplier(level) * workplaceEfficiency('foundry') * pyraBoost('foundry') : 0;
}
// Glutstein intake store (also the receiving store of the elevator's Glutstein cargo).
function emberCapacity() {
  const level = industryLevel('foundry') || 0;
  return 80 + 60 * level * buildingMultiplier(level);
}
function alloyCapacity() {
  const level = industryLevel('foundry') || 0;
  return level > 0 ? 10 + 8 * level * buildingMultiplier(level) : 0;
}
// One manual smelting batch (like the other manual stages): consumes real inputs only.
function manualFoundry() {
  const colony = colonyAt(),
    index = state.activePlanet,
    level = industryLevel('foundry') || 0;
  if (!level) return 0;
  const depot = state.planetOps.storage[index] || 0,
    want = Math.max(1, Math.floor(foundryRate() * 8)),
    room = Math.max(0, Math.floor(alloyCapacity() - colony.stock.emberAlloy)),
    made = Math.min(want, room, Math.floor(colony.stock.ember / EMBER_PER_ALLOY), Math.floor(depot / RAW_PER_ALLOY));
  if (made <= 0) return 0;
  colony.stock.ember -= made * EMBER_PER_ALLOY;
  state.planetOps.storage[index] = depot - made * RAW_PER_ALLOY;
  colony.stock.emberAlloy += made;
  return made;
}
