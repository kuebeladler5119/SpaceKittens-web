// Mekhanos (planet id 'machine', schema 30, cloud slice): Präzisionserz and the Präzisionswerkstatt. Logic only;
// loaded after pyra.js and before game.js. Plan: docs/MEKHANOS_CLOUD_SLICE.md.
//
//   Mekhanos Schacht 2 (Zahnrad-Stollen) → Präzisionserz (typed elevator cargo) → colony.stock.precisionOre
//   Präzisionswerkstatt: 3 Präzisionserz + 15 Rohkristalle (from the depot) → 1 Präzisionsbauteil (colony.stock.precisionParts)

const PRECISION_ORE_PER_PART = 3;
const RAW_PER_PART = 15;
const PRECISION_ORE_VALUE = 9; // Sternenbasar price per Präzisionserz
const PARTS_VALUE = 150; // Sternenbasar price per Präzisionsbauteil

// ----- Cogsworth-9 (schema 31): "Das letzte Freigabeprotokoll" -----
// locked → restricted (Mekhanos founded) → archive (Uhrwerkkern built: Freigabeschein-Archiv) → drones (8 real
// Präzisionsbauteile filed) → battle (2 Inspektor-Drohnen beaten while on Mekhanos) → defeated (reward once) →
// repaired (repair once). Account-level: survives prestige, never resets.
const COGSWORTH_STAGES = ['locked', 'restricted', 'archive', 'drones', 'battle', 'defeated', 'repaired'];
const TAKTBAND_PHASES = ['inspect', 'window', 'open', 'violation'];
const TAKTBAND_SYMBOLS = ['gear', 'bolt', 'spring'];
const COGSWORTH_ARCHIVE_PARTS = 8;
const COGSWORTH_REPAIR = { parts: 10, precisionOre: 40, ore: 300 };
const MEKHANOS_LEVEL_CAP = 10; // Präzisionswerkstatt and Uhrwerkkern drill: no upgrades past Lv 10 until the repair
function normalizeCogsworth(raw) {
  const num = (v, max) => Math.max(0, Math.min(max, Number.isFinite(Number(v)) ? Number(v) : 0));
  return {
    stage: COGSWORTH_STAGES.includes(raw?.stage) ? raw.stage : 'locked',
    archive: Math.floor(num(raw?.archive, COGSWORTH_ARCHIVE_PARTS)),
    drones: Math.floor(num(raw?.drones, 2)),
    hp: num(raw?.hp, 1e15),
    maxHp: num(raw?.maxHp, 1e15),
    fightStart: num(raw?.fightStart, 1e15),
    phase: TAKTBAND_PHASES.includes(raw?.phase) ? raw.phase : 'inspect',
    phaseAt: num(raw?.phaseAt, 1e15),
    round: Math.floor(num(raw?.round, 1e9)),
    seed: Math.floor(num(raw?.seed, 1e9)),
    symbol: TAKTBAND_SYMBOLS.includes(raw?.symbol) ? raw.symbol : null,
    answered: Boolean(raw?.answered),
    lastAnswer: ['correct', 'wrong', 'missed'].includes(raw?.lastAnswer) ? raw.lastAnswer : null,
    violations: Math.floor(num(raw?.violations, 3)),
    rewarded: Boolean(raw?.rewarded),
    repairedAt: num(raw?.repairedAt, 1e15)
  };
}
function cogsworth() {
  return state.meta.guardians.cogsworth;
}
function cogsworthFriendly() {
  return state.meta?.guardians?.cogsworth?.stage === 'repaired';
}
// Friendly Cogsworth stamps permits: Präzisionswerkstatt +20 %, Mekhanos internal shaft transport +10 %. Read from the
// stage every time (never stored), so nothing can stack.
function cogsworthBoost(kind, planet = state.activePlanet) {
  if (!cogsworthFriendly() || PLANETS[planet]?.id !== 'machine') return 1;
  return kind === 'workshop' ? 1.2 : kind === 'haul' ? 1.1 : 1;
}
function mekhanosIndex() {
  return PLANETS.findIndex(p => p.id === 'machine');
}
function isMekhanos(planet = state.activePlanet) {
  return PLANETS[planet]?.id === 'machine';
}
// ----- Präzisionswerkstatt -----
function workshopRate() {
  const level = industryLevel('workshop') || 0;
  return level > 0 ? INDUSTRY_BUILDINGS.workshop.perLevel * level * buildingMultiplier(level) * workplaceEfficiency('workshop') * cogsworthBoost('workshop') : 0;
}
// Präzisionserz intake store (also the receiving store of the elevator's Präzisionserz cargo). Before the workshop is
// built a small shelf still receives ore, so Schacht 2 can run first.
function precisionOreCapacity() {
  const level = industryLevel('workshop') || 0;
  return 60 + 50 * level * buildingMultiplier(level);
}
function partsCapacity() {
  const level = industryLevel('workshop') || 0;
  return level > 0 ? 12 + 8 * level * buildingMultiplier(level) : 0;
}
// One manual assembly batch (like the other manual stages): consumes real inputs only.
function manualWorkshop() {
  const colony = colonyAt(),
    index = state.activePlanet,
    level = industryLevel('workshop') || 0;
  if (!level) return 0;
  const depot = state.planetOps.storage[index] || 0,
    want = Math.max(1, Math.floor(workshopRate() * 8)),
    room = Math.max(0, Math.floor(partsCapacity() - colony.stock.precisionParts)),
    made = Math.min(want, room, Math.floor(colony.stock.precisionOre / PRECISION_ORE_PER_PART), Math.floor(depot / RAW_PER_PART));
  if (made <= 0) return 0;
  colony.stock.precisionOre -= made * PRECISION_ORE_PER_PART;
  state.planetOps.storage[index] = depot - made * RAW_PER_PART;
  colony.stock.precisionParts += made;
  return made;
}
