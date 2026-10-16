// Beta 1.7 M9: planetary cores. Below the deepest shaft of a world lies its damaged core; healing it takes three
// stages of deliveries. Each stage gives a real reward, and the last one transforms the world. Vertical slice: Orion's
// Kristallkern (below Schacht 14). The other worlds' cores (Glacies thermal, Pyra magma, Mekhanos machine, Viridia bio
// network) are designed in docs/beta-1-7/PLANETARY_CORES.md and not playable yet. Account-level (state.meta.core),
// like the repaired maintenance conduit, so it stays through "Neue Galaxie". Deliveries can be partial; every unit
// delivered is booked as consumed. Loaded after research.js and before game.js (the loader normalises the field).
const CORES = {
  crystal: {
    planet: 0,
    name: 'Kristallkern',
    below: 'shaft14',
    stages: [
      { id: 'seal', name: 'Risse versiegeln', needs: { crystalGel: 40, plating: 30, raw: 500000 }, reward: 'Alle Orion-Schächte fördern 10 % mehr.' },
      { id: 'tune', name: 'Resonanz stimmen', needs: { polymer: 12, crystals: 400, hullModule: 4 }, reward: 'Neues Fertigungsrezept: Kernkristall (100 Barren + 1 Sternenpolymer).' },
      { id: 'wake', name: 'Kern erwecken', needs: { coreCrystal: 5, credits: 50000000 }, reward: 'Orion verwandelt sich: Polarlicht über der Kolonie, alle Verkäufe auf Orion +25 %.' }
    ]
  }
};
function normalizeCore(raw) {
  const out = {};
  for (const [key, def] of Object.entries(CORES)) {
    const src = raw?.[key] || {},
      stage = Math.max(0, Math.min(def.stages.length, Math.floor(Number(src.stage) || 0))),
      paid = {};
    if (stage < def.stages.length)
      for (const item of Object.keys(def.stages[stage].needs)) {
        const v = Number(src.paid?.[item]);
        if (Number.isFinite(v) && v > 0) paid[item] = Math.min(def.stages[stage].needs[item], v);
      }
    out[key] = { stage, paid };
  }
  return out;
}
function coreState(key = 'crystal') {
  if (!state.meta.core) state.meta.core = normalizeCore(null);
  if (!state.meta.core[key]) state.meta.core[key] = { stage: 0, paid: {} };
  return state.meta.core[key];
}
// hidden (no scanner or the shaft above it not built) · found (healing 0/3) · healing (1–2/3) · healed (3/3)
function corePhase(key = 'crystal') {
  const def = CORES[key],
    s = coreState(key);
  if (s.stage >= def.stages.length) return 'healed';
  if (!(typeof techHas === 'function' && techHas('coreScanner')) || !shaftBuilt(def.below, def.planet)) return 'hidden';
  return s.stage > 0 ? 'healing' : 'found';
}
function coreStage(key = 'crystal') {
  return coreState(key).stage;
}
// what the visited colony (or, with the Kernsonde, every colony) can give for one item
function coreItemStock(item, planet) {
  if (item === 'credits') return state.credits;
  if (item === 'crystals') return state.crystals;
  return fabStock(planet, item);
}
function coreSources(key = 'crystal') {
  const home = CORES[key].planet;
  if (!(typeof techHas === 'function' && techHas('coreProbe'))) return [state.activePlanet === home ? home : state.activePlanet];
  return state.colonies.map((_, i) => i).filter(i => state.planetsUnlocked[i]);
}
// delivers as much of one item as is available and still needed; returns the amount delivered
function coreDeliver(item, key = 'crystal') {
  const def = CORES[key],
    s = coreState(key),
    phase = corePhase(key);
  if (phase === 'hidden' || phase === 'healed') return 0;
  const need = def.stages[s.stage].needs[item];
  if (!need) return 0;
  let left = need - (s.paid[item] || 0),
    given = 0;
  if (left <= 0) return 0;
  if (item === 'credits' || item === 'crystals') {
    const take = Math.min(left, item === 'credits' ? state.credits : state.crystals);
    if (item === 'credits') state.credits -= take;
    else state.crystals -= take;
    given = take;
  } else
    for (const planet of coreSources(key)) {
      if (left <= 0) break;
      const take = Math.min(left, Math.floor(fabStock(planet, item)));
      if (take <= 0) continue;
      fabSetStock(planet, item, fabStock(planet, item) - take);
      ledgerBook('destroyed', planet, item, take);
      left -= take;
      given += take;
    }
  if (given > 0) {
    s.paid[item] = (s.paid[item] || 0) + given;
    coreAdvance(key);
  }
  return given;
}
function coreStageDone(key = 'crystal') {
  const def = CORES[key],
    s = coreState(key);
  if (s.stage >= def.stages.length) return false;
  return Object.entries(def.stages[s.stage].needs).every(([item, need]) => (s.paid[item] || 0) >= need - 1e-9);
}
function coreAdvance(key = 'crystal') {
  if (!coreStageDone(key)) return false;
  const s = coreState(key);
  s.stage++;
  s.paid = {};
  if (typeof GameEvents !== 'undefined') GameEvents.emit('core-stage', { key, stage: s.stage });
  return true;
}
// ----- rewards (read where they act) -----
function coreShaftFactor(planet) {
  return planet === CORES.crystal.planet && coreStage('crystal') >= 1 ? 1.1 : 1;
}
function coreSaleFactor(planet) {
  return planet === CORES.crystal.planet && coreStage('crystal') >= 3 ? 1.25 : 1;
}
