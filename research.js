// Beta 1.7 M8: the research tree (Forschungsbaum). Account-level (state.meta.tech): research stays through "Neue
// Galaxie". Each node is a real mechanic in the system it names (no hidden flat bonus); costs are Credits plus real
// materials and goods taken from the colony the player is visiting (booked like every other consumption). Dunkle
// Materie is not used here (it is scarce and comes with the repeatable boss challenges); the core branch arrives with
// the planetary core (M9). Loaded after fabrication.js and before game.js (the save loader normalises the field);
// the UI and the wrappers of game.js functions live in research-ui.js.
const TECH_BRANCHES = [
  { id: 'mining', name: 'Bergbau', icon: '⛏' },
  { id: 'logistics', name: 'Logistik', icon: '⇄' },
  { id: 'industry', name: 'Raffinerie & Fertigung', icon: '⚙' },
  { id: 'automation', name: 'Manager & Automatik', icon: '♙' },
  { id: 'combat', name: 'Kampf & DNA', icon: '⚔' },
  { id: 'core', name: 'Kernforschung', icon: '◉' }
];
const TECH = {
  // Bergbau
  veinMap: { branch: 'mining', tier: 1, name: 'Aderkarte', text: 'Funde tiefer Schächte (Kristalle, Erz) zählen doppelt.', cost: { credits: 25000, raw: 500 } },
  resinProbe: { branch: 'mining', tier: 2, needs: 'veinMap', name: 'Harzsonde', text: 'Die Harztanks des Bohrturms fassen 50 % mehr.', cost: { credits: 150000, bars: 40, plating: 5 } },
  deepDrill: { branch: 'mining', tier: 3, needs: 'resinProbe', name: 'Funkenbohrer', text: 'Jeder Schacht (auch Schacht 1) fördert 10 % mehr.', cost: { credits: 2000000, crystalGel: 6, polymer: 2 } },
  // Beta 1.9 M6: finds as research inputs (Fundstücke; favourites are never taken)
  fossilScan: { branch: 'mining', tier: 4, needs: 'deepDrill', name: 'Fossilkunde', text: 'Die tiefen Schächte geben ihre Fundstücke 20 % früher frei.', cost: { credits: 4000000, fossil: 2 } },
  // Logistik
  quickCouple: { branch: 'logistics', tier: 1, name: 'Schnellkupplung', text: 'Loren kippen ihre Ladung in 0,4 s statt in 1 s.', cost: { credits: 20000, raw: 400 } },
  extraCarts: { branch: 'logistics', tier: 2, needs: 'quickCouple', name: 'Ausweichgleis', text: 'Bis zu 6 statt 4 beladene Loren unterwegs – ein volles Lager staut erst später zurück.', cost: { credits: 120000, plating: 4 } },
  packBand: { branch: 'logistics', tier: 3, needs: 'extraCarts', name: 'Etikettierband', text: 'Verpackte Kisten bringen beim Verkauf +20 % statt +15 %.', cost: { credits: 900000, lubricant: 6, polymer: 1 } },
  // Beta 1.9 M5: the Glacies chain's research use – every carrier between the buildings one tier faster (logistics.js)
  coldChain: { branch: 'logistics', tier: 4, needs: 'packBand', name: 'Kühlkette', text: 'Alle Träger zwischen den Gebäuden fahren eine Stufe besser (schnellere Wege, bis zur Schwebepalette).', cost: { credits: 3000000, cryoCore: 2 } },
  // Raffinerie & Fertigung
  barMint: { branch: 'industry', tier: 1, name: 'Barrenprägung', text: 'Jeder Kristallbarren ist 1 ◈ mehr wert.', cost: { credits: 40000, bars: 30 } },
  secondLine: { branch: 'industry', tier: 2, needs: 'barMint', name: 'Zusatzfließband', text: 'Die Fertigung jeder Kolonie hat eine Linie mehr (gleichzeitige Aufträge).', cost: { credits: 250000, plating: 8, crystalGel: 2 } },
  catalyst: { branch: 'industry', tier: 3, needs: 'secondLine', name: 'Polymer-Katalyse', text: 'Sternenpolymer braucht 28 s statt 40 s je Charge.', cost: { credits: 1500000, crystalGel: 8, lubricant: 4 } },
  lensArray: { branch: 'industry', tier: 4, needs: 'catalyst', name: 'Resonanzlinsen', text: 'Jede Raffinerie verarbeitet 10 % mehr.', cost: { credits: 8000000, resonanceLens: 2 } },
  // Manager & Automatik
  nightShift: { branch: 'automation', tier: 1, name: 'Nachtschicht', text: 'Offline-Ertrag +5 Prozentpunkte (bis höchstens 100 %).', cost: { credits: 60000, raw: 1000 } },
  autoTank: { branch: 'automation', tier: 2, needs: 'nightShift', name: 'Tankautomatik', text: 'Sternentreibstoff füllt den Schiffstank von selbst bis 75 % statt bis zur Hälfte.', cost: { credits: 200000, starFuel: 10 } },
  foreman: { branch: 'automation', tier: 3, needs: 'autoTank', name: 'Vorarbeiter-Schule', text: 'Alle gewöhnlichen Manager arbeiten 5 % effizienter (Spezialisten unverändert).', cost: { credits: 3000000, polymer: 3, plating: 10 } },
  // Kampf & DNA
  dodgeAssist: { branch: 'combat', tier: 1, name: 'Ausweich-Assistent', text: 'Solange du nicht selbst steuerst, weicht das Schiff Schüssen aus, die in 0,4 s treffen würden – ein Reflex, selbst steuern bleibt besser.', cost: { credits: 50000, plating: 3 } },
  shieldCap: { branch: 'combat', tier: 2, needs: 'dodgeAssist', name: 'Schildkondensator', text: 'Der Schildpuls hält 0,5 s länger.', cost: { credits: 300000, plating: 6, bars: 60 } },
  welder: { branch: 'combat', tier: 3, needs: 'shieldCap', name: 'Bordschweißer', text: 'Werftreparaturen kosten 25 % weniger Credits.', cost: { credits: 1200000, plating: 10, lubricant: 3 } },
  // Beta 1.9 M9: the use of the Dunkle Materie from the Wächter-Revanche (rematch.js)
  matterArmor: { branch: 'combat', tier: 4, needs: 'welder', name: 'Materiepanzer', text: 'Dunkle Materie verdichtet die Außenhaut: +10 % Hülle, zusätzlich zu allen Ausbauten.', cost: { credits: 15000000, darkMatter: 3 } },
  // Kernforschung (M9: the planetary cores)
  coreScanner: { branch: 'core', tier: 1, name: 'Kernscanner', text: 'Ortet den beschädigten Kristallkern unter Orions Schacht 14 (dort erscheint er, sobald der Schacht steht).', cost: { credits: 5000000, polymer: 4 } },
  coreProbe: { branch: 'core', tier: 2, needs: 'coreScanner', name: 'Kernsonde', text: 'Lieferungen an den Kern nehmen Material aus allen Kolonien, nicht nur aus der besuchten.', cost: { credits: 20000000, polymer: 8, hullModule: 2 } },
  coreHarmonics: { branch: 'core', tier: 3, needs: 'coreProbe', name: 'Kernharmonie', text: 'Kernkristalle entstehen in 54 s statt 90 s je Charge.', cost: { credits: 80000000, coreCrystal: 2 } }
};
const TECH_IDS = Object.keys(TECH);
function normalizeTech(raw) {
  const done = {};
  if (raw?.done && typeof raw.done === 'object' && !Array.isArray(raw.done))
    for (const [id, v] of Object.entries(raw.done)) if (v && typeof id === 'string' && id.length <= 40) done[id] = true; // unknown ids of a newer build are kept
  return { done };
}
function techState() {
  if (!state.meta.tech) state.meta.tech = normalizeTech(null);
  return state.meta.tech;
}
function techHas(id) {
  // Beta 1.9: also called while the save is being normalised (shipHullMax inside normalizeState), when `state` is still in
  // its temporal dead zone – `typeof` does not guard that, so a read there counts as "not researched"
  try {
    return Boolean(state?.meta?.tech?.done?.[id]);
  } catch (e) {
    return false;
  }
}
// the stock a cost item is paid from: Credits from the account, everything else from the visited colony
function techStock(item, planet = state.activePlanet) {
  if (item === 'credits') return state.credits;
  return fabStock(planet, item);
}
function techItemName(item) {
  if (item === 'credits') return ['Credits', '◈'];
  return [fabName(item), fabIcon(item)];
}
function techMissing(id, planet = state.activePlanet) {
  const def = TECH[id],
    missing = {};
  for (const [item, need] of Object.entries(def.cost)) {
    const have = techStock(item, planet);
    if (have + 1e-9 < need) missing[item] = need - have;
  }
  return missing;
}
function techAvailable(id) {
  const def = TECH[id];
  return Boolean(def) && !techHas(id) && (!def.needs || techHas(def.needs));
}
// buys a node: all or nothing (never a partial charge), the materials are booked as consumed
function buyTech(id, planet = state.activePlanet) {
  if (!techAvailable(id) || Object.keys(techMissing(id, planet)).length) return false;
  for (const [item, need] of Object.entries(TECH[id].cost)) {
    if (item === 'credits') state.credits -= need;
    else {
      fabSetStock(planet, item, fabStock(planet, item) - need);
      ledgerBook('destroyed', planet, item, need);
    }
  }
  techState().done[id] = true;
  if (typeof GameEvents !== 'undefined') GameEvents.emit('tech', { id });
  return true;
}
// ----- effect queries (read where the mechanic lives) -----
function techFindsMultiplier() {
  return techHas('veinMap') ? 2 : 1;
}
function techResinCapacityFactor() {
  return techHas('resinProbe') ? 1.5 : 1;
}
function techShaftFactor() {
  return techHas('deepDrill') ? 1.1 : 1;
}
function techPackPremium() {
  return techHas('packBand') ? 1.2 : 1.15;
}
function techRefuelShare() {
  return techHas('autoTank') ? 0.75 : 0.5;
}
function techStaffFactor() {
  return techHas('foreman') ? 1.05 : 1;
}
function techRecipeSeconds(recipe) {
  const base = RECIPES[recipe]?.seconds || 0;
  if (recipe === 'coreCrystal' && techHas('coreHarmonics')) return base * 0.6;
  return recipe === 'polymer' && techHas('catalyst') ? base * 0.7 : base;
}
