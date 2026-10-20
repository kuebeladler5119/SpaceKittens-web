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
    ],
    depth: 'Tiefe 15',
    intro: 'Der beschädigte Kern des Kristallplaneten. Seit der Großen Stille ist er gesprungen – heile ihn in drei Stufen.',
    healed: 'Der Kern ist geheilt. Orion leuchtet – alle Verkäufe auf Orion bringen 25 % mehr.',
    saleFactor: 1.25
  },
  // Beta 1.9 M7: Glacies' Thermalkern in the Altes Wärmenetz below the frost layer. Found once Frostbyte is
  // recalibrated (the story of Glacies) and the Kernscanner is researched, with Glacies' mine open. Its stages use the
  // Glacies chain (M5): Thermalzellen, Kühlmittel, Frostquarz → Kälteplatten, Kryokerne, bars → Kryokerne and the
  // Hitzeschild from Pyra. The rewards act on Glacies' own chain; the last one transforms the world (hot springs).
  ice: {
    planet: 1,
    name: 'Thermalkern',
    found: () => (typeof techHas === 'function' && techHas('coreScanner')) && state.meta?.guardians?.frostbyte?.stage === 'repaired' && typeof undergroundOpen === 'function' && undergroundOpen(1),
    stages: [
      { id: 'thaw', name: 'Wärmenetz auftauen', needs: { cells: 30, coolant: 20, frost: 600 }, reward: 'Warme Geysire: der Frostquarz-Bohrer fördert 50 % mehr.' },
      { id: 'network', name: 'Wärmenetz schließen', needs: { coldPlate: 10, cryoCore: 3, bars: 1500 }, reward: 'Die Thermalwerkstatt arbeitet 50 % schneller.' },
      { id: 'wake', name: 'Thermalkern erwecken', needs: { cryoCore: 6, heatShield: 1, credits: 25000000 }, reward: 'Glacies verwandelt sich: heiße Quellen dampfen in der Kolonie, alle Verkäufe auf Glacies +20 %.' }
    ],
    depth: 'Altes Wärmenetz',
    intro: 'Unter der Frostschicht schläft das alte Wärmenetz der Kolonisten. Sein Kern ist erkaltet – taue es in drei Stufen wieder auf.',
    healed: 'Der Thermalkern glüht. Heiße Quellen wärmen Glacies – alle Verkäufe auf Glacies bringen 20 % mehr.',
    saleFactor: 1.2
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
  if (def.found) return def.found() ? (s.stage > 0 ? 'healing' : 'found') : 'hidden';
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
  for (const [key, def] of Object.entries(CORES)) if (planet === def.planet && coreStage(key) >= def.stages.length) return def.saleFactor || 1;
  return 1;
}
// Beta 1.9 M7: Glacies' Thermalkern – warm geysers (stage 1) and the closed heat network (stage 2)
function coreFrostFactor(planet) {
  return planet === CORES.ice.planet && coreStage('ice') >= 1 ? 1.5 : 1;
}
function coreThermalFactor(planet) {
  return planet === CORES.ice.planet && coreStage('ice') >= 2 ? 1.5 : 1;
}
// the core of a planet (its key), if it has one
function coreKeyOf(planet) {
  return Object.keys(CORES).find(key => CORES[key].planet === planet) || null;
}
