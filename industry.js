// Industry & Managers (save schema 26): a real, staged material pipeline per colony.
//   EXTRACTION (mine) → pile → RAIL → DEPOT → [FEED → hopper → REFINERY → bars] → STALL / DOCK sales → credits
// Every stage is a workplace with exactly one profession. A stage only runs by itself when a manager of the matching
// profession works there (ordinary hire or collectible specialist); otherwise the player operates it by hand.
// Loaded before game.js; the functions below use game.js globals (state, extractionRate, earn, …) only when called.

const BAR_RAW = 10; // raw units consumed per refined crystal bar
const BAR_VALUE = 12; // credits per bar before price multipliers (raw unit = 1 credit)
const STAFF_MAX_LEVEL = 10;
const PROFESSIONS = {
  mining: { name: 'Bergbau', icon: '⛏', color: '#f6b23a' },
  transport: { name: 'Transport', icon: '🛒', color: '#8fe3ff' },
  storage: { name: 'Lager', icon: '▦', color: '#c4b3ff' },
  production: { name: 'Produktion', icon: '⚙', color: '#ffb35a' },
  logistics: { name: 'Logistik', icon: '⛴', color: '#7fe6c6' },
  trade: { name: 'Handel', icon: '◈', color: '#ffd77a' },
  elevator: { name: 'Aufzug', title: 'Aufzugs-Manager', icon: '⇕', color: '#5fd4c4' }
};
// Workplaces in pipeline order. `hire` = ordinary manager cost on Orion; later planets cost ×3 per planet index.
const WORKPLACES = [
  { id: 'mine', job: 'mining', name: 'Kristallmine', stage: 'Abbau', verb: 'ABBAUEN', hire: 100 },
  // Deep Core (schema 28): deeper shafts (mining) and the central elevator (own profession). See deepcore.js.
  { id: 'shaft2', job: 'mining', name: 'Schacht 2', stage: 'Schacht-2-Abbau', verb: 'ABBAUEN', hire: 600 },
  { id: 'shaft3', job: 'mining', name: 'Schacht 3', stage: 'Schacht-3-Abbau', verb: 'ABBAUEN', hire: 2500 },
  { id: 'shaft4', job: 'mining', name: 'Schacht 4', stage: 'Schacht-4-Abbau', verb: 'ABBAUEN', hire: 9000 },
  { id: 'shaft5', job: 'mining', name: 'Schacht 5', stage: 'Schacht-5-Abbau', verb: 'ABBAUEN', hire: 40000 },
  { id: 'shaft6', job: 'mining', name: 'Schacht 6', stage: 'Schacht-6-Abbau', verb: 'ABBAUEN', hire: 160000 },
  { id: 'elevator', job: 'elevator', name: 'Förderaufzug', stage: 'Aufzug', verb: 'AUFZUG SCHICKEN', hire: 180 },
  { id: 'rail', job: 'transport', name: 'Lorenbahn', stage: 'Transport', verb: 'LORE SCHICKEN', hire: 250 },
  { id: 'depot', job: 'storage', name: 'Lagerhaus', stage: 'Beschickung', verb: 'BESCHICKEN', hire: 20000 },
  { id: 'refinery', job: 'production', name: 'Raffinerie', stage: 'Verarbeitung', verb: 'VERARBEITEN', hire: 30000 },
  { id: 'stall', job: 'trade', name: 'Verkaufsstand', stage: 'Verkauf', verb: 'VERKAUFEN', hire: 500 },
  { id: 'dock', job: 'logistics', name: 'Frachtdock', stage: 'Fracht', verb: 'FRACHTER STARTEN', hire: 8000 },
  // Glacies Niva only (planet theme 'ice')
  { id: 'frostDrill', job: 'mining', name: 'Frostquarz-Bohrer', stage: 'Frostquarz-Abbau', verb: 'FROSTQUARZ ABBAUEN', hire: 300 },
  { id: 'thermal', job: 'production', name: 'Thermalwerkstatt', stage: 'Thermalzellen', verb: 'ZELLE FERTIGEN', hire: 2000 },
  // Pyra-9 only (planet theme 'volcanic', schema 30)
  { id: 'foundry', job: 'production', name: 'Glutschmelze', stage: 'Glutlegierung', verb: 'SCHMELZEN', hire: 4000 },
  // Mekhanos only (planet theme 'machine', cloud slice)
  { id: 'workshop', job: 'production', name: 'Präzisionswerkstatt', stage: 'Präzisionsbauteile', verb: 'FERTIGEN', hire: 6000 },
  // Viridia Bloom only (planet theme 'verdant', schema 32)
  { id: 'sporeGarden', job: 'mining', name: 'Sporengarten', stage: 'Sporenernte', verb: 'SPOREN ERNTEN', hire: 9000 },
  { id: 'biolab', job: 'production', name: 'Biolabor', stage: 'Biogel', verb: 'BIOGEL ANSETZEN', hire: 12000 }
];
// Glacies recipe: 4 Frostquarz + 10 raw crystals from the depot → 1 Thermalzelle.
const FROST_PER_CELL = 4;
const RAW_PER_CELL = 10;
const CELL_VALUE = 30; // credits when sold at the Sternenbasar
const WORKPLACE = Object.fromEntries(WORKPLACES.map(w => [w.id, w]));
// New industry buildings (the four legacy buildings stay in colony.buildings).
const INDUSTRY_BUILDINGS = {
  rail: { name: 'Lorenbahn', icon: '🛒', cost: 25, start: 1, perLevel: 60 },
  stall: { name: 'Verkaufsstand', icon: '◈', cost: 120, start: 1, perLevel: 8 },
  refinery: { name: 'Raffinerie', icon: '⚙', cost: 6000, start: 0, perLevel: 20, unlockDepot: 5 },
  frostDrill: { name: 'Frostquarz-Bohrer', icon: '❄', cost: 1200, start: 0, perLevel: 0.5, planets: ['ice'] },
  thermal: { name: 'Thermalwerkstatt', icon: '♨', cost: 5000, start: 0, perLevel: 0.2, planets: ['ice'], needs: 'frostDrill' },
  foundry: { name: 'Glutschmelze', icon: '🔥', cost: 30000, start: 0, perLevel: 0.05, planets: ['volcanic'] },
  // K61 (session 9): 0.06 → 0.2 parts/s per level — at 0.06 a level paid back after 50,000 s (Lv 25: 249,000 s),
  // 8× worse than the Glutschmelze; the price stays (more output instead of cheaper levels)
  workshop: { name: 'Präzisionswerkstatt', icon: '⚙', cost: 450000, start: 0, perLevel: 0.2, planets: ['machine'] },
  // Viridia Bloom (session 11): Sporengarten → Biolabor; see viridia.js
  sporeGarden: { name: 'Sporengarten', icon: '✿', cost: 1500000, start: 0, perLevel: 3, planets: ['verdant'] },
  biolab: { name: 'Biolabor', icon: '◍', cost: 3000000, start: 0, perLevel: 1, planets: ['verdant'], needs: 'sporeGarden' }
};
// Planet-specific materials (stored per colony in colony.stock; ids are stable save keys).
const MATERIALS = {
  frost: { name: 'Frostquarz', icon: '❄', planets: ['ice'] },
  cells: { name: 'Thermalzellen', icon: '♨', planets: ['ice'], value: CELL_VALUE },
  ember: { name: 'Glutstein', icon: '⬢', planets: ['volcanic'] },
  emberAlloy: { name: 'Glutlegierung', icon: '▣', planets: ['volcanic'] },
  precisionOre: { name: 'Präzisionserz', icon: '⚙', planets: ['machine'] },
  precisionParts: { name: 'Präzisionsbauteile', icon: '⛭', planets: ['machine'] },
  spores: { name: 'Leuchtsporen', icon: '✿', planets: ['verdant'] },
  biogel: { name: 'Biogel', icon: '◍', planets: ['verdant'] }
};
// Collectible specialist managers (account level). Stage bonus = 1 + 0.15 × rank; secondary ability from rank 3.
const SPECIALISTS = [
  {
    id: 'nibbles',
    name: 'Nibbles',
    job: 'mining',
    title: 'Mineralien-Spürnase',
    bio: 'Neugierige orange-weiße Kätzin mit Helmlampe. Riecht seltene Kristalle durch drei Meter Fels.',
    secondary: 'Seltene Funde: +1 Kristall je 15 Min. laufender Förderung',
    look: { fur: '#f3a55a', fur2: '#ffffff', mark: '#d97a2e', pattern: 'socks', eye: '#6bd6a6', suit: '#2f3f7a', suitDark: '#1f2a55', accent: '#ffd77a' },
    outfit: { hat: 'hardhat', hatColor: '#ffcc33', jacket: '#2f3f7a', tie: '#ffcc33', item: 'lamp' }
  },
  {
    id: 'kruemel',
    name: 'Krümel',
    job: 'transport',
    title: 'Loren-Rennfahrerin',
    bio: 'Winziges graues Fellknäuel mit Fliegerbrille. Kein Gleis ist ihr zu steil, keine Lore zu voll.',
    secondary: 'Große Halde: +50 % Haldenkapazität an ihrer Mine',
    look: { fur: '#9aa0b4', fur2: '#e8ebf5', mark: '#6c7288', pattern: 'tabby', eye: '#ffc85a', suit: '#ff9e5a', suitDark: '#c46a2a', accent: '#8fe3ff' },
    outfit: { hat: 'cap', hatColor: '#ff7a3a', jacket: '#ff9e5a', bowtie: '#8fe3ff', item: 'flag' }
  },
  {
    id: 'tofu',
    name: 'Tofu',
    job: 'storage',
    title: 'Lagermeister mit Riesenbrille',
    bio: 'Kleiner, ständig müder grauer Kater mit übergroßer Brille. Zählt Kisten sogar im Schlaf.',
    secondary: 'Ordnungssinn: +20 % Lagerkapazität',
    look: { fur: '#b8bccb', fur2: '#f2f3f8', mark: '#8d91a3', pattern: 'plain', eye: '#8fb8ff', suit: '#c4b3ff', suitDark: '#7f6ad8', accent: '#ffd77a' },
    outfit: { glasses: true, jacket: '#7f6ad8', tie: '#ffd77a', item: 'clipboard' }
  },
  {
    id: 'waffles',
    name: 'Waffles',
    job: 'production',
    title: 'Werkstatt-Genie',
    bio: 'Goldene Kätzin in Arbeitsjacke, immer mit Schraubenschlüssel. Repariert Maschinen nach Gehör.',
    secondary: 'Feinabstimmung: Raffinerie zusätzlich +10 % schneller',
    look: { fur: '#e9b44c', fur2: '#fff1cf', mark: '#c48a26', pattern: 'tabby', eye: '#6bd6ff', suit: '#5a7fb8', suitDark: '#3a5a8c', accent: '#ffb35a' },
    outfit: { hat: 'goggles', jacket: '#5a7fb8', item: 'wrench' }
  },
  {
    id: 'pudding',
    name: 'Pudding',
    job: 'production',
    title: 'Materialforscherin',
    bio: 'Runde Kätzin in Pastellrosa mit Laborbrille. Findet in jedem Kristall noch ein bisschen mehr Glanz.',
    secondary: 'Reinheitsformel: Kristallbarren +1 Credit Wert',
    look: { fur: '#f6d6e4', fur2: '#ffffff', mark: '#e3a8c4', pattern: 'point', eye: '#c48aff', suit: '#ffffff', suitDark: '#d9d3ea', accent: '#ff9ecb' },
    outfit: { glasses: true, jacket: '#ffffff', bowtie: '#ff9ecb', item: 'flask' }
  },
  {
    id: 'peanut',
    name: 'Peanut',
    job: 'logistics',
    title: 'Frachtpilot',
    bio: 'Braun-weißer Kater in Mini-Pilotenuniform. Kennt jede Frachtroute zwischen Orion und Aurelia.',
    secondary: 'Sparflug: +25 % Treibstoff aus Frachtverkäufen',
    look: { fur: '#9a6a44', fur2: '#ffffff', mark: '#6b4a32', pattern: 'socks', eye: '#9be06b', suit: '#3f6f5a', suitDark: '#2a4a3c', accent: '#ffd77a' },
    outfit: { hat: 'pilot', hatColor: '#3f6f5a', jacket: '#3f6f5a', tie: '#ffd77a', item: 'clipboard' }
  },
  {
    id: 'biscuit',
    name: 'Biscuit',
    job: 'trade',
    title: 'Handelsdirektorin',
    bio: 'Cremefarbene Kätzin im marineblauen Anzug mit goldener Krawatte. Verhandelt lächelnd jeden Preis nach oben.',
    secondary: 'Verhandlungsgeschick: +5 % Verkaufspreis',
    look: { fur: '#f5e3c8', fur2: '#fffaf0', mark: '#dcc29c', pattern: 'plain', eye: '#7fb8ff', suit: '#24346a', suitDark: '#17224a', accent: '#ffd23a' },
    outfit: { jacket: '#24346a', tie: '#ffd23a', item: 'briefcase' }
  }
];
const SPECIALIST = Object.fromEntries(SPECIALISTS.map(s => [s.id, s]));
// Ordinary managers: one charming look per profession (no gameplay difference beyond the profession).
const STAFF_LOOKS = {
  mining: {
    look: { fur: '#5b5670', fur2: '#8a85a3', mark: '#3e3a52', pattern: 'socks', eye: '#ffe26b', suit: '#2f3f7a', suitDark: '#1f2a55', accent: '#ffcc33' },
    outfit: { hat: 'hardhat', hatColor: '#ffcc33', jacket: '#2f3f7a', tie: '#ffcc33' }
  },
  transport: {
    look: { fur: '#e58c4a', fur2: '#ffd9b3', mark: '#b85c22', pattern: 'tabby', eye: '#6bd6ff', suit: '#ff9e5a', suitDark: '#c46a2a', accent: '#8fe3ff' },
    outfit: { hat: 'cap', hatColor: '#ff7a3a', jacket: '#ff9e5a', item: 'flag' }
  },
  storage: {
    look: { fur: '#c9c9d6', fur2: '#f2f2f8', mark: '#8b8ba0', pattern: 'tabby', eye: '#9be06b', suit: '#c4b3ff', suitDark: '#7f6ad8', accent: '#ffd77a' },
    outfit: { glasses: true, jacket: '#7f6ad8', item: 'clipboard' }
  },
  production: {
    look: { fur: '#f6c37a', fur2: '#fff1d6', mark: '#d89a4a', pattern: 'tabby', eye: '#6bd6a6', suit: '#5a7fb8', suitDark: '#3a5a8c', accent: '#ffb35a' },
    outfit: { hat: 'goggles', jacket: '#5a7fb8', item: 'wrench' }
  },
  logistics: {
    look: { fur: '#2f2b3d', fur2: '#4a4560', mark: '#1f1c2a', pattern: 'socks', eye: '#9cffb0', suit: '#3f6f5a', suitDark: '#2a4a3c', accent: '#ffd77a' },
    outfit: { hat: 'pilot', hatColor: '#3f6f5a', jacket: '#3f6f5a', item: 'clipboard' }
  },
  trade: {
    look: { fur: '#ffffff', fur2: '#ffffff', mark: '#ff9e6b', mark2: '#4a3a38', pattern: 'calico', eye: '#7cc4ff', suit: '#24346a', suitDark: '#17224a', accent: '#ffd23a' },
    outfit: { jacket: '#24346a', tie: '#ffd23a', item: 'briefcase' }
  },
  // Aufzugs-Manager: small teal jacket, brass bowtie, tiny cap, control lever.
  elevator: {
    look: { fur: '#a8b4c8', fur2: '#e8eef8', mark: '#6e7c94', pattern: 'tabby', eye: '#ffcf5a', suit: '#2f8f86', suitDark: '#1f6660', accent: '#e8b04a' },
    outfit: { hat: 'cap', hatColor: '#2f8f86', jacket: '#2f8f86', bowtie: '#e8b04a', item: 'lever' }
  }
};
// Specialist rank-ups: rank 2 = 3 copies in total (the kept one + 2 duplicates); ranks 3–5 also need badges.
const FUSION_COST = { 2: { copies: 2, badges: 0 }, 3: { copies: 2, badges: 20 }, 4: { copies: 2, badges: 40 }, 5: { copies: 2, badges: 80 } };
const SPECIALIST_MAX_RANK = 5;
const DUPLICATE_BADGES = 10; // a spare duplicate of a rank-5 specialist converts into badges

// ----- State shape helpers -----
function emptyStaff() {
  return Object.fromEntries(WORKPLACES.map(w => [w.id, 0]));
}
function normalizeIndustryColony(saved, levels, legacyConversion) {
  const num = (value, fallback, max = 1e300) => (Number.isFinite(Number(value)) ? Math.min(max, Math.max(0, Number(value))) : fallback);
  const built = levels.some(level => level > 0);
  const industry = {
    rail: Math.floor(num(saved?.industry?.rail, built ? INDUSTRY_BUILDINGS.rail.start : 0, 100000)),
    stall: Math.floor(num(saved?.industry?.stall, built ? INDUSTRY_BUILDINGS.stall.start : 0, 100000)),
    refinery: Math.floor(num(saved?.industry?.refinery, 0, 100000)),
    frostDrill: Math.floor(num(saved?.industry?.frostDrill, 0, 100000)),
    thermal: Math.floor(num(saved?.industry?.thermal, 0, 100000)),
    foundry: Math.floor(num(saved?.industry?.foundry, 0, 100000)),
    workshop: Math.floor(num(saved?.industry?.workshop, 0, 100000)),
    sporeGarden: Math.floor(num(saved?.industry?.sporeGarden, 0, 100000)),
    biolab: Math.floor(num(saved?.industry?.biolab, 0, 100000))
  };
  if (built) {
    industry.rail = Math.max(1, industry.rail);
    industry.stall = Math.max(1, industry.stall);
  }
  const stock = {
    pile: num(saved?.stock?.pile, 0),
    hopper: num(saved?.stock?.hopper, 0),
    bars: num(saved?.stock?.bars, 0),
    frost: num(saved?.stock?.frost, 0),
    cells: num(saved?.stock?.cells, 0),
    ember: num(saved?.stock?.ember, 0),
    emberAlloy: num(saved?.stock?.emberAlloy, 0),
    precisionOre: num(saved?.stock?.precisionOre, 0),
    precisionParts: num(saved?.stock?.precisionParts, 0),
    spores: num(saved?.stock?.spores, 0),
    biogel: num(saved?.stock?.biogel, 0)
  };
  const staff = emptyStaff();
  WORKPLACES.forEach(w => (staff[w.id] = Math.floor(num(saved?.staff?.[w.id], 0, STAFF_MAX_LEVEL))));
  // managers at workplaces of a newer build (e.g. a deeper shaft) are kept for that build
  if (saved?.staff && typeof saved.staff === 'object')
    for (const [id, v] of Object.entries(saved.staff)) if (!(id in staff) && /^[a-z]\w{0,30}$/i.test(id) && Number(v) > 0) staff[id] = Math.floor(num(v, 0, STAFF_MAX_LEVEL));
  // A manual cart trip in progress (goods are in the cart, not on the pile and not yet in the depot).
  const trip =
    saved?.trip && Number(saved.trip.amount) > 0 && Number.isFinite(Number(saved.trip.arriveAt))
      ? { amount: Number(saved.trip.amount), departAt: Number(saved.trip.departAt) || 0, arriveAt: Number(saved.trip.arriveAt) }
      : null;
  let converted = Boolean(saved?.converted),
    railSizing = Boolean(saved?.railSizing),
    convertedJobs = Array.isArray(saved?.convertedJobs) ? saved.convertedJobs.filter(id => WORKPLACE[id]) : [];
  // Schema ≤ 25: production ran fully automatically. Every built colony keeps that capability through ordinary
  // managers ("Übernommen"); the rail line is sized once after loading so throughput stays comparable.
  if (legacyConversion && built) {
    staff.mine = Math.max(1, staff.mine);
    staff.rail = Math.max(1, staff.rail);
    staff.stall = Math.max(1, staff.stall);
    if (levels[3] > 0) staff.dock = Math.max(1, staff.dock);
    convertedJobs = ['mine', 'rail', 'stall', ...(levels[3] > 0 ? ['dock'] : [])];
    converted = true;
    railSizing = true;
  }
  // K62 Rohkristall-Reserve (schema 31): a sales floor in charges of this colony's own recipe; missing → Aus.
  const reserve = {
    raw: RESERVE_OPTIONS.includes(Number(saved?.reserve?.raw)) ? Number(saved.reserve.raw) : 0,
    chosen: Boolean(saved?.reserve?.chosen)
  };
  // Viridia's Wurzelnetz (schema 32): which root feeds which stage; every colony carries it, only Viridia uses it.
  const roots = normalizeRoots(saved?.roots);
  return { industry, stock, staff, trip, converted, convertedJobs, railSizing, reserve, roots };
}

// ----- K62: Rohkristall-Reserve -----
// Automatic and manual raw sales leave `rawReserveUnits()` in the depot so a manually run specialty facility always
// finds its recipe input between production steps. It is a floor for sales only: processing, freight, contracts and
// repairs may use the reserved raw, nothing is moved anywhere, nothing is created.
const RESERVE_OPTIONS = [0, 1, 5, 20];
const RESERVE_RECOMMENDED = 5;
const SPECIALTY_RAW = { thermal: () => RAW_PER_CELL, foundry: () => RAW_PER_ALLOY, workshop: () => RAW_PER_PART, biolab: () => RAW_PER_GEL };
// Raw per charge: the largest raw recipe among the colony's built specialty facilities (0 = none built).
function rawChargeSize(planet = state.activePlanet) {
  const colony = state.colonies[planet];
  if (!colony) return 0;
  return Object.entries(SPECIALTY_RAW).reduce((size, [id, raw]) => ((colony.industry[id] || 0) > 0 ? Math.max(size, raw()) : size), 0);
}
function rawReserveCharges(planet = state.activePlanet) {
  return state.colonies[planet]?.reserve?.raw || 0;
}
function rawReserveUnits(planet = state.activePlanet) {
  const units = rawReserveCharges(planet) * rawChargeSize(planet);
  return units > 0 ? Math.min(units, withPlanet(planet, () => storageCapacity())) : 0;
}
function sellableRaw(planet = state.activePlanet) {
  return Math.max(0, (state.planetOps.storage[planet] || 0) - rawReserveUnits(planet));
}
function setRawReserve(charges, planet = state.activePlanet) {
  const colony = state.colonies[planet];
  if (!colony || !RESERVE_OPTIONS.includes(charges)) return false;
  colony.reserve = { raw: charges, chosen: true };
  return true;
}
// First build of a specialty facility in a colony whose reserve was never chosen: recommend 5 charges (shown in the
// toast and the sheet). Existing facilities of old saves are never switched on behind the player's back.
function recommendRawReserve(id, planet = state.activePlanet) {
  const colony = state.colonies[planet];
  if (!SPECIALTY_RAW[id] || !colony || colony.reserve?.chosen || (colony.industry[id] || 0) !== 1) return false;
  colony.reserve = { raw: RESERVE_RECOMMENDED, chosen: true };
  return true;
}
function normalizeManagerMeta(raw) {
  const roster = {};
  SPECIALISTS.forEach(s => {
    const entry = raw?.roster?.[s.id];
    if (!entry) return;
    const rank = Math.min(SPECIALIST_MAX_RANK, Math.max(1, Math.floor(Number(entry.rank) || 1)));
    roster[s.id] = { rank, copies: Math.min(999, Math.max(0, Math.floor(Number(entry.copies) || 0))) };
  });
  const assign = {};
  const taken = new Set();
  Object.keys(roster).forEach(id => {
    const a = raw?.assign?.[id];
    const key = a ? a.planet + ':' + a.workplace : '';
    // A specialist works in exactly one place; two specialists never share a workplace; professions must match.
    if (a && Number.isInteger(a.planet) && WORKPLACE[a.workplace]?.job === SPECIALIST[id].job && !taken.has(key)) {
      assign[id] = { planet: a.planet, workplace: a.workplace };
      taken.add(key);
    }
  });
  return {
    roster,
    assign,
    badges: Math.min(1e6, Math.max(0, Math.floor(Number(raw?.badges) || 0))),
    capsules: Math.min(999, Math.max(0, Math.floor(Number(raw?.capsules) || 0))),
    opened: Math.max(0, Math.floor(Number(raw?.opened) || 0)),
    hires: Math.max(0, Math.floor(Number(raw?.hires) || 0)),
    dupStreak: Math.max(0, Math.floor(Number(raw?.dupStreak) || 0)),
    claimed: Array.isArray(raw?.claimed) ? [...new Set(raw.claimed.filter(id => typeof id === 'string'))].slice(0, 500) : [],
    week: typeof raw?.week === 'string' ? raw.week : '',
    weekSold: Math.max(0, Number(raw?.weekSold) || 0)
  };
}

// ----- Workplaces and managers -----
function colonyAt(planet = state.activePlanet) {
  return state.colonies[planet];
}
function workplaceExists(id, planet = state.activePlanet) {
  const colony = colonyAt(planet);
  if (!colony || !state.planetsUnlocked[planet]) return false;
  if (id === 'dock') return colony.buildings[3].level > 0;
  if (['frostDrill', 'thermal', 'foundry', 'workshop', 'sporeGarden', 'biolab'].includes(id)) return planetAllows(id, planet) && colony.industry[id] > 0;
  if (id === 'refinery') return colony.industry.refinery > 0;
  if (id === 'elevator') return undergroundOpen(planet);
  if (SHAFT_IDS.includes(id)) return shaftBuilt(id, planet);
  if (id === 'depot') return colony.buildings[2].level > 0 && colony.industry.refinery > 0;
  return true;
}
function specialistAt(planet, workplace) {
  const assign = state.meta?.managers?.assign || {};
  return Object.keys(assign).find(id => assign[id].planet === planet && assign[id].workplace === workplace) || null;
}
// A stage runs automatically only with a manager of the matching profession on duty.
function isAutomated(workplace, planet = state.activePlanet) {
  if (!workplaceExists(workplace, planet)) return false;
  return colonyAt(planet).staff[workplace] > 0 || Boolean(specialistAt(planet, workplace));
}
function specialistRank(id) {
  return state.meta?.managers?.roster?.[id]?.rank || 0;
}
function specialistActive(id, planet = state.activePlanet) {
  const a = state.meta?.managers?.assign?.[id];
  return Boolean(a && a.planet === planet && workplaceExists(a.workplace, planet));
}
// Stage multiplier of the manager on duty (the specialist replaces the ordinary hire while assigned).
function workplaceEfficiency(workplace, planet = state.activePlanet) {
  const special = specialistAt(planet, workplace);
  if (special) return 1 + 0.15 * specialistRank(special);
  const level = colonyAt(planet)?.staff[workplace] || 0;
  return level > 0 ? 1 + 0.05 * (level - 1) : 1;
}
function secondaryActive(id, planet = state.activePlanet) {
  return specialistActive(id, planet) && specialistRank(id) >= 3;
}
function academyRank(id) {
  return state.meta?.academy?.[id] || 0;
}
function hireCost(workplace, planet = state.activePlanet) {
  return Math.floor(WORKPLACE[workplace].hire * Math.pow(3, planet) * (1 - 0.1 * academyRank('personnel')));
}
function staffUpgradeCost(workplace, planet = state.activePlanet) {
  const level = colonyAt(planet).staff[workplace];
  return Math.floor(WORKPLACE[workplace].hire * Math.pow(3, planet) * 2 * Math.pow(1.6, level - 1) * (1 - 0.1 * academyRank('personnel')));
}

// ----- Industry buildings -----
function industryLevel(id, planet = state.activePlanet) {
  return colonyAt(planet).industry[id];
}
function industryCost(id, planet = state.activePlanet) {
  return Math.floor(INDUSTRY_BUILDINGS[id].cost * Math.pow(BALANCE.buildingCostGrowth, industryLevel(id, planet)));
}
function planetAllows(id, planet = state.activePlanet) {
  const def = INDUSTRY_BUILDINGS[id];
  return !def.planets || def.planets.includes(PLANETS[planet]?.id);
}
// Glacies structures stop at Lv 10 until Frostbyte is repaired (the deep frost layer is sealed).
function industryCapped(id, planet = state.activePlanet) {
  // Mekhanos: no upgrades past Lv 10 before Cogsworth's repair. Levels bought earlier (cloud slice, no cap) are kept
  // with their full output — the cap only blocks the next purchase.
  if (INDUSTRY_BUILDINGS[id]?.planets?.includes('machine')) return !cogsworthFriendly() && industryLevel(id, planet) >= MEKHANOS_LEVEL_CAP;
  // Viridia: the Welke stops Sporengarten and Biolabor at Lv 10 until Petalguard is healed (levels kept)
  if (INDUSTRY_BUILDINGS[id]?.planets?.includes('verdant')) return !petalguardFriendly() && industryLevel(id, planet) >= VIRIDIA_LEVEL_CAP;
  if (INDUSTRY_BUILDINGS[id]?.planets?.includes('volcanic')) return !emberbellFriendly() && industryLevel(id, planet) >= PYRA_LEVEL_CAP;
  return INDUSTRY_BUILDINGS[id]?.planets?.includes('ice') && state.meta?.guardians?.frostbyte?.stage !== 'repaired' && industryLevel(id, planet) >= GLACIES_LEVEL_CAP;
}
function industryUnlocked(id, planet = state.activePlanet) {
  const def = INDUSTRY_BUILDINGS[id];
  if (!planetAllows(id, planet)) return false;
  if (def.needs && !(colonyAt(planet).industry[def.needs] > 0)) return false;
  return !def.unlockDepot || colonyAt(planet).buildings[2].level >= def.unlockDepot;
}
// ----- Glacies rates -----
function glaciesBoost(kind, planet = state.activePlanet) {
  return state.meta?.guardians?.frostbyte?.stage === 'repaired' && PLANETS[planet]?.id === 'ice' ? (kind === 'thermal' ? 1.25 : 1.15) : 1;
}
function frostRate() {
  const level = industryLevel('frostDrill') || 0;
  return level > 0 ? INDUSTRY_BUILDINGS.frostDrill.perLevel * level * buildingMultiplier(level) * workplaceEfficiency('frostDrill') * glaciesBoost('frost') : 0;
}
function frostCapacity() {
  const level = industryLevel('frostDrill') || 0;
  return level > 0 ? 30 + 20 * level * buildingMultiplier(level) : 0;
}
function thermalRate() {
  const level = industryLevel('thermal') || 0;
  return level > 0 ? INDUSTRY_BUILDINGS.thermal.perLevel * level * buildingMultiplier(level) * workplaceEfficiency('thermal') * glaciesBoost('thermal') : 0;
}
function cellCapacity() {
  const level = industryLevel('thermal') || 0;
  return level > 0 ? 10 + 5 * level * buildingMultiplier(level) : 0;
}

// ----- Stage capacities (units per second for the colony in context) -----
function railRate() {
  const level = industryLevel('rail');
  return level > 0 ? (10 + INDUSTRY_BUILDINGS.rail.perLevel * level * buildingMultiplier(level)) * workplaceEfficiency('rail') * rootBoost('rail') : 0;
}
// The old freight capacity is split: the dock-level part ships from the Frachtdock, the rest sells at the stall.
function stallRate() {
  const level = industryLevel('stall');
  if (level <= 0) return 0;
  return (transportCapacity(0) + INDUSTRY_BUILDINGS.stall.perLevel * (level - 1) * buildingMultiplier(level)) * workplaceEfficiency('stall');
}
function dockRate() {
  if (!workplaceExists('dock')) return 0;
  return Math.max(0, transportCapacity() - transportCapacity(0)) * workplaceEfficiency('dock');
}
function refineryRate() {
  const level = industryLevel('refinery');
  return level > 0
    ? INDUSTRY_BUILDINGS.refinery.perLevel * level * buildingMultiplier(level) * workplaceEfficiency('refinery') * (secondaryActive('waffles') ? 1.1 : 1)
    : 0;
}
function feedRate() {
  const depot = state.buildings[2].level;
  return workplaceExists('depot') ? 25 * depot * buildingMultiplier(depot) * workplaceEfficiency('depot') : 0;
}
function pileCapacity() {
  return (40 + 20 * state.buildings[0].level + 20 * extractionRate()) * (secondaryActive('kruemel') ? 1.5 : 1);
}
function hopperCapacity() {
  const level = industryLevel('refinery');
  return level > 0 ? 50 + 100 * level * buildingMultiplier(level) : 0;
}
function barCapacity() {
  const level = industryLevel('refinery');
  return level > 0 ? 20 + 10 * level * buildingMultiplier(level) : 0;
}
function barValue() {
  return BAR_VALUE + (secondaryActive('pudding') ? 1 : 0);
}
function colonyRates() {
  const open = undergroundOpen();
  return {
    // Shaft 1 (Kristallmine + Helferhütte + legacy power). Deeper shafts and the elevator only exist underground; there
    // the values are estimates (mining limited by internal transport, elevator round trip over all shafts).
    E: shaftRate('mine'),
    open,
    shafts: open ? builtShafts().filter(s => s.id !== 'mine').map(s => ({ id: s.id, rate: shaftRate(s.id) })) : [],
    EL: open ? elevatorRate() : 0,
    L: railRate(),
    F: feedRate(),
    P: refineryRate(),
    S1: stallRate(),
    S2: dockRate(),
    pileCap: pileCapacity(),
    depotCap: storageCapacity(),
    hopperCap: hopperCapacity(),
    barCap: barCapacity(),
    refineryOn: industryLevel('refinery') > 0,
    FR: frostRate(),
    TR: thermalRate(),
    frostCap: frostCapacity(),
    cellCap: cellCapacity(),
    FD: foundryRate(),
    alloyCap: alloyCapacity(),
    WS: workshopRate(),
    partsCap: partsCapacity(),
    SP: sporeRate(),
    sporeCap: sporeCapacity(),
    BL: biogelRate(),
    gelCap: biogelCapacity(),
    rawReserve: rawReserveUnits()
  };
}
function colonyAutomation(planet = state.activePlanet) {
  return Object.fromEntries(WORKPLACES.map(w => [w.id, isAutomated(w.id, planet)]));
}

// Pure flow step of the surface chain. Goods produced in a step may pass through later stages in the same step, so
// one long step and many short steps give the same steady throughput. Nothing is destroyed: a full depot pushes goods
// back to the pile, a full pile simply stops extraction, a missing manager leaves goods where they are. With the
// underground open the surface mine does not extract here: the elevator's unloads (deepcore.js) are the only inflow.
function simulateColonyFlow(stock, r, a, dt) {
  let pile = stock.pile;
  const extractedGross = !r.open && a.mine ? r.E * dt : 0;
  pile += extractedGross;
  const inflow = extractedGross;
  let moved = a.rail ? Math.min(r.L * dt, pile) : 0;
  let depot = stock.depot + moved;
  const saleCap = ((a.stall ? r.S1 : 0) + (a.dock ? r.S2 : 0)) * dt; // raw-equivalent units
  const hopperRoom = Math.max(0, r.hopperCap - stock.hopper) + (a.refinery ? r.P * dt : 0);
  let fed = a.depot && r.refineryOn ? Math.max(0, Math.min(r.F * dt, depot, hopperRoom)) : 0;
  depot -= fed;
  // Glacies: Frostquarz extraction and Thermalzellen (4 frost + 10 raw → 1 cell); raw comes from the depot first.
  const frostGross = a.frostDrill ? (r.FR || 0) * dt : 0;
  let frost = (stock.frost || 0) + frostGross;
  const cellsMade =
    a.thermal && r.TR > 0
      ? Math.max(0, Math.min(r.TR * dt, frost / FROST_PER_CELL, depot / RAW_PER_CELL, Math.max(0, (r.cellCap || 0) - (stock.cells || 0))))
      : 0;
  frost -= cellsMade * FROST_PER_CELL;
  depot -= cellsMade * RAW_PER_CELL;
  let frostExtracted = frostGross;
  if (frost > (r.frostCap || 0) && frostGross > 0) {
    const idle = Math.min(frost - (r.frostCap || 0), frostGross);
    frost -= idle;
    frostExtracted -= idle;
  }
  let cells = (stock.cells || 0) + cellsMade;
  // Pyra: Glutschmelze — 4 Glutstein + 20 raw → 1 Glutlegierung; Thermalzellen in stock cool it (+50 %, 0.2 per alloy)
  let ember = stock.ember || 0,
    emberAlloy = stock.emberAlloy || 0;
  const cool = (r.FD || 0) > 0 && cells > 1e-9,
    alloysMade =
      a.foundry && r.FD > 0
        ? Math.max(0, Math.min(r.FD * (cool ? 1.5 : 1) * dt, ember / EMBER_PER_ALLOY, depot / RAW_PER_ALLOY, Math.max(0, (r.alloyCap || 0) - emberAlloy)))
        : 0,
    coolantUsed = cool ? Math.min(cells, alloysMade * CELLS_PER_ALLOY) : 0;
  ember -= alloysMade * EMBER_PER_ALLOY;
  depot -= alloysMade * RAW_PER_ALLOY;
  emberAlloy += alloysMade;
  cells -= coolantUsed;
  // Mekhanos: Präzisionswerkstatt — 3 Präzisionserz + 15 raw → 1 Präzisionsbauteil
  let precisionOre = stock.precisionOre || 0,
    precisionParts = stock.precisionParts || 0;
  const partsMade =
    a.workshop && r.WS > 0
      ? Math.max(0, Math.min(r.WS * dt, precisionOre / PRECISION_ORE_PER_PART, depot / RAW_PER_PART, Math.max(0, (r.partsCap || 0) - precisionParts)))
      : 0;
  precisionOre -= partsMade * PRECISION_ORE_PER_PART;
  depot -= partsMade * RAW_PER_PART;
  precisionParts += partsMade;
  // Viridia: Sporengarten (extraction) and Biolabor — 3 Leuchtsporen + 25 raw → 1 Biogel
  const sporeGross = a.sporeGarden ? (r.SP || 0) * dt : 0;
  let spores = (stock.spores || 0) + sporeGross,
    biogel = stock.biogel || 0;
  const gelMade =
    a.biolab && r.BL > 0 ? Math.max(0, Math.min(r.BL * dt, spores / SPORES_PER_GEL, depot / RAW_PER_GEL, Math.max(0, (r.gelCap || 0) - biogel))) : 0;
  spores -= gelMade * SPORES_PER_GEL;
  depot -= gelMade * RAW_PER_GEL;
  biogel += gelMade;
  let sporesExtracted = sporeGross;
  if (spores > (r.sporeCap || 0) && sporeGross > 0) {
    const idle = Math.min(spores - (r.sporeCap || 0), sporeGross);
    spores -= idle;
    sporesExtracted -= idle;
  }
  let hopper = stock.hopper + fed;
  const barRoom = Math.max(0, r.barCap - stock.bars) + saleCap / BAR_RAW;
  const processed = a.refinery && r.refineryOn ? Math.max(0, Math.min(r.P * dt, hopper, barRoom * BAR_RAW)) : 0;
  hopper -= processed;
  let bars = stock.bars + processed / BAR_RAW;
  let capacity = saleCap;
  const barsSold = Math.min(bars, capacity / BAR_RAW);
  bars -= barsSold;
  capacity -= barsSold * BAR_RAW;
  // K62: sales only take what lies above the Rohkristall-Reserve (processing above may use the reserve)
  const rawSold = Math.min(Math.max(0, depot - (r.rawReserve || 0)), capacity);
  depot -= rawSold;
  // Overflow is pushed back upstream (never destroyed).
  if (hopper > r.hopperCap && fed > 0) {
    const back = Math.min(hopper - r.hopperCap, fed);
    hopper -= back;
    fed -= back;
    depot += back;
  }
  if (depot > r.depotCap && moved > 0) {
    const back = Math.min(depot - r.depotCap, moved);
    depot -= back;
    moved -= back;
  }
  pile -= moved;
  let extracted = extractedGross;
  if (pile > r.pileCap && extractedGross > 0) {
    const idle = Math.min(pile - r.pileCap, extractedGross);
    pile -= idle;
    extracted -= idle;
  }
  return {
    stock: { pile, depot, hopper, bars, frost, cells, ember, emberAlloy, precisionOre, precisionParts, spores, biogel },
    extracted,
    alloysMade,
    partsMade,
    sporesExtracted,
    gelMade,
    coolantUsed,
    inflow,
    moved,
    fed,
    processed,
    barsSold,
    rawSold,
    frostExtracted,
    cellsMade
  };
}

// Credits for goods actually sold (legacy trade/logistics crew boosts kept, specialist price ability added).
function salePriceMultiplier(depotFill) {
  return (
    (crewRank(2) >= 3 ? 1.05 : 1) *
    (crewRank(3) >= 3 && depotFill > 0.75 ? 1.08 : 1) *
    (specialistActiveOnSales('biscuit') ? 1.05 : 1)
  );
}
function specialistActiveOnSales(id) {
  return secondaryActive(id) && ['stall', 'dock'].includes(state.meta.managers.assign[id]?.workplace);
}
const industryFlow = []; // last measured flow per colony (for visuals; not saved)
const crystalCarry = []; // Nibbles' rare finds (fractional, not saved)
const deepCarry = {}; // deep-shaft finds per colony and shaft (fractional, not saved)
const FLOW_SUM = ['extracted', 'inflow', 'moved', 'fed', 'processed', 'barsSold', 'rawSold', 'frostExtracted', 'cellsMade', 'alloysMade', 'coolantUsed', 'partsMade', 'sporesExtracted', 'gelMade', 'lifted', 'manual'];
// One production call for the colony in context. With the underground open the call is cut into chunks (≤ 1 s for
// ticks, ≤ seconds/4000 offline) that alternate the discrete underground (deepcore.js) and the surface flow, so the
// pile the elevator unloads into is drained by the rail in between. Construction advances in the same chunks: a
// shaft finished during the call produces only for the time after it was finished.
function runColonyIndustry(seconds, efficiency = 1) {
  processCartTrip(state.activePlanet);
  const index = state.activePlanet,
    colony = colonyAt(index),
    open = undergroundOpen(index),
    rates = colonyRates(),
    auto = colonyAutomation(index),
    fill = Math.max(0, state.planetOps.storage[index] || 0) / Math.max(1, rates.depotCap),
    total = Object.fromEntries(FLOW_SUM.map(key => [key, 0])),
    mined = {},
    deposited = {};
  const chunks = open && seconds > 1 ? Math.min(4000, Math.ceil(seconds)) : 1,
    h = seconds / chunks;
  let nums = open ? undergroundNumbers(index) : null;
  for (let i = 0; i < chunks && seconds > 0; i++) {
    if (open) {
      if (constructionJob(index) && advanceConstruction(h, index)) nums = undergroundNumbers(index);
      const ug = stepUnderground(h, nums, index);
      total.lifted += ug.lifted;
      total.manual += ug.manual;
      Object.entries(ug.deposited).forEach(([id, value]) => (deposited[id] = (deposited[id] || 0) + value));
      Object.entries(ug.mined).forEach(([id, value]) => {
        mined[id] = (mined[id] || 0) + value;
        if (shaftMaterial(id, index) === 'raw') total.extracted += value;
      });
    }
    const flow = simulateColonyFlow(
      {
        pile: colony.stock.pile,
        depot: Math.max(0, state.planetOps.storage[index] || 0),
        hopper: colony.stock.hopper,
        bars: colony.stock.bars,
        frost: colony.stock.frost || 0,
        cells: colony.stock.cells || 0,
        ember: colony.stock.ember || 0,
        emberAlloy: colony.stock.emberAlloy || 0,
        precisionOre: colony.stock.precisionOre || 0,
        precisionParts: colony.stock.precisionParts || 0,
        spores: colony.stock.spores || 0,
        biogel: colony.stock.biogel || 0
      },
      rates,
      auto,
      h
    );
    colony.stock.pile = flow.stock.pile;
    colony.stock.hopper = flow.stock.hopper;
    colony.stock.bars = flow.stock.bars;
    colony.stock.frost = flow.stock.frost;
    colony.stock.cells = flow.stock.cells;
    colony.stock.ember = flow.stock.ember;
    colony.stock.emberAlloy = flow.stock.emberAlloy;
    colony.stock.precisionOre = flow.stock.precisionOre;
    colony.stock.precisionParts = flow.stock.precisionParts;
    colony.stock.spores = flow.stock.spores;
    colony.stock.biogel = flow.stock.biogel;
    state.planetOps.storage[index] = flow.stock.depot;
    FLOW_SUM.forEach(key => {
      if (key !== 'lifted' && key !== 'manual') total[key] += flow[key] || 0;
    });
  }
  if (open) {
    total.inflow = total.lifted;
    // Finds of deep shafts (Tiefendruse/Resonanzkammer: crystals, Verdichtete Adern: ore) while they really mine.
    builtShafts(index).forEach(sd => {
      const finds = shaftDef(sd.id, index)?.finds;
      if (!finds || !((mined[sd.id] || 0) > 0)) return;
      const key = index + ':' + sd.id;
      deepCarry[key] = (deepCarry[key] || 0) + seconds / finds.seconds;
      const found = Math.floor(deepCarry[key]);
      if (!found) return;
      deepCarry[key] -= found;
      if (finds.kind === 'crystals') state.crystals += found;
      else state.ore += found;
    });
  }
  const credits = (total.rawSold + total.barsSold * barValue()) * salePriceMultiplier(fill) * efficiency;
  if (credits > 0) {
    earn(credits);
    GameEvents.emit('sale', { credits, amount: total.rawSold + total.barsSold * BAR_RAW, auto: true, planet: index, workplace: auto.stall ? 'stall' : 'dock' });
  }
  if (total.extracted > 0 && secondaryActive('nibbles')) {
    crystalCarry[index] = (crystalCarry[index] || 0) + seconds / 900;
    const found = Math.floor(crystalCarry[index]);
    if (found) {
      state.crystals += found;
      crystalCarry[index] -= found;
    }
  }
  const delivered = total.rawSold + total.barsSold * BAR_RAW;
  trackWeeklySales(delivered);
  if (seconds > 0) industryFlow[index] = { ...total, mined, deposited, credits, seconds, at: Date.now() };
  return delivered;
}
// Steady automated income (units/s ≈ credits/s) of the colony in context; manual stages count as 0.
function automatedExtraction(r = colonyRates(), a = colonyAutomation()) {
  const shafts = (a.mine ? r.E : 0) + (r.shafts || []).reduce((sum, sh) => sum + (a[sh.id] ? sh.rate : 0), 0);
  return r.open ? Math.min(shafts, a.elevator ? r.EL : 0) : shafts;
}
function automatedIncomeRate() {
  const r = colonyRates(),
    a = colonyAutomation(),
    sell = (a.stall ? r.S1 : 0) + (a.dock ? r.S2 : 0),
    supply = Math.min(automatedExtraction(r, a), a.rail ? r.L : 0),
    depot = sellableRaw(); // K62: reserved raw is not for sale (else a held reserve would show the full sale capacity)
  return Math.min(sell, depot > 1 ? sell : supply);
}
function stageBottleneck() {
  const r = colonyRates(),
    a = colonyAutomation(),
    stock = colonyAt().stock,
    depot = state.planetOps.storage[state.activePlanet] || 0;
  if (!a.mine) return { id: 'mine', text: 'Abbau ist Handarbeit – stelle einen Bergbau-Manager ein.' };
  if (r.open && !a.elevator) return { id: 'elevator', text: 'Der Aufzug fährt nur per Hand – ein Aufzugs-Manager übernimmt.' };
  const idleShaft = (r.shafts || []).find(sh => !a[sh.id]);
  if (idleShaft) return { id: idleShaft.id, text: shaftDef(idleShaft.id).name + ' hat keinen Manager.' };
  if (r.open) {
    const limited = builtShafts().find(sh => shaftLimit(sh.id) === 'haul');
    if (limited) return { id: limited.id, text: shaftDef(limited.id).name + ': Der interne Transport schafft nicht alles – Transport ausbauen.' };
  }
  if (!a.rail) return { id: 'rail', text: 'Die Lore fährt nur auf Zuruf – ein Transport-Manager übernimmt.' };
  if (!a.stall && !a.dock) return { id: 'stall', text: 'Verkauf per Hand – ein Handels-Manager verkauft automatisch.' };
  if (depot >= r.depotCap * 0.92) return { id: 'stall', text: 'Lager fast voll – Verkauf oder Frachtdock ausbauen.' };
  if (stock.pile >= r.pileCap * 0.92) return { id: 'rail', text: 'Die Halde ist voll – Lorenbahn ausbauen.' };
  const sell = (a.stall ? r.S1 : 0) + (a.dock ? r.S2 : 0),
    mined = (a.mine ? r.E : 0) + (r.shafts || []).reduce((sum, sh) => sum + (a[sh.id] ? sh.rate : 0), 0),
    supply = automatedExtraction(r, a);
  if (r.open && r.EL < mined * 0.98) return { id: 'elevator', text: 'Der Aufzug kommt nicht hinterher – Tempo oder Tragkraft ausbauen.' };
  if (r.open) {
    const full = builtShafts().find(sh => shaftLimit(sh.id) === 'store');
    if (full) return { id: full.id, text: shaftDef(full.id).name + ': Schachtlager voll – der Aufzug holt zu selten ab.' };
  }
  if (sell < Math.min(supply, r.L) * 0.98) return { id: 'stall', text: 'Der Verkauf ist der Engpass.' };
  if (r.L < supply * 0.98) return { id: 'rail', text: 'Die Lorenbahn ist der Engpass.' };
  return { id: 'mine', text: 'Die Förderung bestimmt dein Tempo.' };
}

// ----- Manual operation (always available, so the player can never get stuck) -----
function manualBatch(workplace) {
  const r = colonyRates();
  if (workplace === 'rail') return Math.max(40, r.L * 4);
  if (workplace === 'stall') return Math.max(30, r.S1 * 6);
  if (workplace === 'dock') return Math.max(100, r.S2 * 6);
  if (workplace === 'depot') return Math.max(50, r.F * 6);
  if (workplace === 'refinery') return Math.max(BAR_RAW * 5, r.P * 6);
  if (workplace === 'frostDrill') return Math.max(4, r.FR * 8);
  if (workplace === 'sporeGarden') return Math.max(4, r.SP * 8);
  if (workplace === 'thermal') return Math.max(1, r.TR * 8);
  return 0;
}
// Adds mined material to the pile; returns the amount that fit.
function addToPile(amount) {
  const colony = colonyAt(),
    room = Math.max(0, pileCapacity() - colony.stock.pile),
    added = Math.min(room, Math.max(0, amount));
  colony.stock.pile += added;
  return added;
}
// Manual cart trips are real state: the load leaves the pile at departure and reaches the depot on arrival.
const CART_TRIP_MS = 2400;
function manualTransport(now = Date.now()) {
  const index = state.activePlanet,
    colony = colonyAt();
  processCartTrip(index, now);
  if (colony.trip) return 0; // the cart is still on its way
  const room = Math.max(0, storageCapacity() - (state.planetOps.storage[index] || 0)),
    amount = Math.min(manualBatch('rail'), colony.stock.pile, room);
  if (amount <= 0) return 0;
  colony.stock.pile -= amount;
  colony.trip = { amount, departAt: now, arriveAt: now + CART_TRIP_MS };
  return amount;
}
// Unloads an arrived cart (as far as the depot has room; the rest waits in the cart). Idempotent.
function processCartTrip(index, now = Date.now()) {
  const colony = state.colonies[index],
    trip = colony?.trip;
  if (!trip || now < trip.arriveAt) return 0;
  const previous = state.activePlanet;
  state.activePlanet = index;
  try {
    const depot = state.planetOps.storage[index] || 0,
      put = Math.max(0, Math.min(trip.amount, storageCapacity() - depot));
    state.planetOps.storage[index] = depot + put;
    trip.amount -= put;
    if (trip.amount <= 1e-9) colony.trip = null;
    if (put > 0) GameEvents.emit('cart-arrived', { planet: index, amount: put });
    return put;
  } finally {
    state.activePlanet = previous;
  }
}
// Sells up to one batch (bars first). Returns { units (raw-equivalent), credits }.
function manualSale(workplace = 'stall') {
  const index = state.activePlanet,
    colony = colonyAt(),
    depot = state.planetOps.storage[index] || 0,
    fill = depot / Math.max(1, storageCapacity());
  let capacity = manualBatch(workplace);
  const bars = Math.min(colony.stock.bars, capacity / BAR_RAW);
  capacity -= bars * BAR_RAW;
  const raw = Math.min(Math.max(0, depot - rawReserveUnits(index)), capacity);
  if (bars + raw <= 0) return { units: 0, credits: 0 };
  colony.stock.bars -= bars;
  state.planetOps.storage[index] = depot - raw;
  const credits = (raw + bars * barValue()) * salePriceMultiplier(fill);
  earn(credits);
  const units = raw + bars * BAR_RAW;
  trackWeeklySales(units);
  return { units, credits };
}
function manualFeed() {
  const index = state.activePlanet,
    colony = colonyAt(),
    depot = state.planetOps.storage[index] || 0,
    amount = Math.min(manualBatch('depot'), depot, Math.max(0, hopperCapacity() - colony.stock.hopper));
  if (amount <= 0 || !workplaceExists('refinery')) return 0;
  state.planetOps.storage[index] = depot - amount;
  colony.stock.hopper += amount;
  return amount;
}
function manualFrost() {
  const colony = colonyAt(),
    amount = Math.min(Math.max(4, frostRate() * 8), Math.max(0, frostCapacity() - colony.stock.frost));
  if (amount <= 0 || !workplaceExists('frostDrill')) return 0;
  colony.stock.frost += amount;
  return amount;
}
function manualThermal() {
  const index = state.activePlanet,
    colony = colonyAt(),
    depot = state.planetOps.storage[index] || 0,
    cells = Math.floor(
      Math.min(Math.max(1, thermalRate() * 8), colony.stock.frost / FROST_PER_CELL, depot / RAW_PER_CELL, Math.max(0, cellCapacity() - colony.stock.cells))
    );
  if (cells <= 0 || !workplaceExists('thermal')) return 0;
  colony.stock.frost -= cells * FROST_PER_CELL;
  state.planetOps.storage[index] = depot - cells * RAW_PER_CELL;
  colony.stock.cells += cells;
  return cells;
}
function manualRefine() {
  const colony = colonyAt(),
    amount = Math.min(manualBatch('refinery'), colony.stock.hopper, Math.max(0, barCapacity() - colony.stock.bars) * BAR_RAW);
  if (amount <= 0 || !workplaceExists('refinery')) return 0;
  colony.stock.hopper -= amount;
  colony.stock.bars += amount / BAR_RAW;
  return amount;
}

// ----- Weekly delivery goal (free capsule once per ISO-like week) -----
function weekId(now = Date.now()) {
  const day = Math.floor(now / 86400000);
  return 'w' + Math.floor((day + 3) / 7); // weeks start on Monday (1970-01-01 was a Thursday)
}
function trackWeeklySales(units) {
  const managers = state.meta?.managers;
  if (!managers || !(units > 0)) return;
  const week = weekId();
  if (managers.week !== week) {
    managers.week = week;
    managers.weekSold = 0;
  }
  managers.weekSold += units;
}

// ----- Sternenakademie: permanent Gem upgrades (account level, survive prestige) -----
const ACADEMY = [
  {
    id: 'deepsleep',
    name: 'Tiefschlaf-Logistik',
    icon: '☾',
    text: '+2 Std. maximale Offline-Zeit je Stufe',
    prices: [60, 120, 200]
  },
  {
    id: 'expedition',
    name: 'Expeditionsplanung',
    icon: '⌁',
    text: '−10 % Expeditionsdauer je Stufe',
    prices: [50, 100, 150]
  },
  {
    id: 'personnel',
    name: 'Personalbüro',
    icon: '✎',
    text: '−10 % Kosten für normale Manager (Einstellen & Fortbildung) je Stufe',
    prices: [80, 160, 240]
  }
];
function normalizeAcademy(raw) {
  return Object.fromEntries(
    ACADEMY.map(item => [item.id, Math.min(item.prices.length, Math.max(0, Math.floor(Number(raw?.[item.id]) || 0)))])
  );
}

// ----- One-time milestone rewards (ledger in meta.milestones; never repeat after reload/import) -----
const INDUSTRY_MILESTONES = [
  {
    id: 'first-manager',
    title: 'Erste Managerin',
    test: () => state.meta.managers.hires > 0,
    gems: 10
  },
  {
    id: 'first-chain',
    title: 'Erste vollautomatische Kette',
    test: () => forEachColony(index => (['mine', 'rail'].every(w => isAutomated(w, index)) && (isAutomated('stall', index) || isAutomated('dock', index)) ? 1 : 0)) > 0,
    gems: 25,
    capsules: 1
  },
  { id: 'first-refinery', title: 'Erste Raffinerie', test: () => state.colonies.some(c => c.industry.refinery > 0), gems: 10, capsules: 1 },
  { id: 'pips-friend', title: 'P.I.P.S. befreit', test: () => pipsFriendly(), capsules: 1 },
  ...[2, 3, 4, 5, 6].map(n => ({
    id: 'colonies-' + n,
    title: n + ' Kolonien besiedelt',
    test: () => state.planetsUnlocked.filter(Boolean).length >= n,
    gems: n >= 4 ? 10 : 5,
    capsules: 1
  })),
  ...[1, 5, 10, 25].map(n => ({ id: 'bosses-' + n, title: n + ' Bosse besiegt', test: () => state.bossDefeats >= n, capsules: 1 })),
  ...[3, 6].map(n => ({ id: 'research-' + n, title: n + ' Forschungen', test: () => state.research.filter(Boolean).length >= n, capsules: 1 }))
];
function checkIndustryMilestones() {
  const done = state.meta.milestones;
  let granted = null;
  INDUSTRY_MILESTONES.forEach(m => {
    if (done.includes(m.id) || !m.test()) return;
    done.push(m.id);
    if (m.gems) state.gems += m.gems;
    if (m.capsules) state.meta.managers.capsules += m.capsules;
    granted = m;
  });
  // Weekly delivery goal: once per week, a free talent capsule for selling enough real goods.
  const managers = state.meta.managers,
    weekKey = 'week-' + managers.week;
  if (managers.week === weekId() && managers.weekSold >= weeklyGoal() && !managers.claimed.includes(weekKey)) {
    managers.claimed.push(weekKey);
    managers.capsules++;
    state.gems += 5;
    granted = { title: 'Wochenlieferung geschafft' };
  }
  if (granted) {
    toast('Meilenstein: ' + granted.title + '! Belohnung erhalten.');
    requestSave(200);
  }
}
function weeklyGoal() {
  return Math.max(5000, Math.round(galacticDeliveryRate() * 3600 * 2));
}
// Schema ≤ 25 saves: milestones that are already met count as done without paying out again (no sudden gem
// inflation); instead the new personnel department welcomes the player with one free talent capsule.
function preclaimIndustryMilestones() {
  const done = state.meta.milestones,
    managers = state.meta.managers;
  INDUSTRY_MILESTONES.forEach(m => {
    if (!done.includes(m.id) && m.test()) done.push(m.id);
  });
  if (!managers.claimed.includes('industry-welcome')) {
    managers.claimed.push('industry-welcome');
    managers.capsules++;
  }
}

// ----- Specialist collection: free talent capsules, duplicates and 3-copy fusion -----
// Odds (documented in the capsule dialog): every capsule holds 1 specialist with equal chance 1/7 + 5 badges.
// Pity: after 2 duplicates in a row the next capsule picks among specialists the player does not own yet.
const CAPSULE_BADGES = 5;
function openTalentCapsule(random = Math.random) {
  const managers = state.meta.managers;
  if (!(managers.capsules > 0)) return null;
  const missing = SPECIALISTS.filter(s => !managers.roster[s.id]),
    pool = managers.dupStreak >= 2 && missing.length ? missing : SPECIALISTS,
    pick = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
  managers.capsules--;
  managers.opened++;
  managers.badges += CAPSULE_BADGES;
  const owned = managers.roster[pick.id];
  let result;
  if (!owned) {
    managers.roster[pick.id] = { rank: 1, copies: 0 };
    managers.dupStreak = 0;
    result = { id: pick.id, isNew: true, badges: CAPSULE_BADGES };
  } else if (owned.rank >= SPECIALIST_MAX_RANK) {
    managers.badges += DUPLICATE_BADGES; // nothing left to fuse: the copy turns into badges
    managers.dupStreak++;
    result = { id: pick.id, isNew: false, converted: true, badges: CAPSULE_BADGES + DUPLICATE_BADGES };
  } else {
    owned.copies++;
    managers.dupStreak++;
    result = { id: pick.id, isNew: false, badges: CAPSULE_BADGES };
  }
  return result;
}
function fusionRequirement(id) {
  const entry = state.meta.managers.roster[id];
  if (!entry || entry.rank >= SPECIALIST_MAX_RANK) return null;
  return { rank: entry.rank + 1, ...FUSION_COST[entry.rank + 1] };
}
function canFuse(id) {
  const need = fusionRequirement(id),
    managers = state.meta.managers;
  return Boolean(need && managers.roster[id].copies >= need.copies && managers.badges >= need.badges);
}
// Keeps the canonical specialist (assignment, identity) and raises the rank; consumes duplicates (+ badges).
function fuseSpecialist(id) {
  if (!canFuse(id)) return false;
  const need = fusionRequirement(id),
    managers = state.meta.managers;
  managers.roster[id].copies -= need.copies;
  managers.badges -= need.badges;
  managers.roster[id].rank = need.rank;
  return true;
}
function specialistBonusText(id, rank = specialistRank(id)) {
  const def = SPECIALIST[id];
  return WORKPLACES.filter(w => w.job === def.job)
    .map(w => w.stage)
    .join('/') + ' ×' + (1 + 0.15 * rank).toFixed(2) + (rank >= 3 ? ' · ' + def.secondary : '');
}

// ----- Sternenakademie purchases (Gems; one safe state transition per rank) -----
function academyPrice(id) {
  const item = ACADEMY.find(a => a.id === id);
  return item ? item.prices[academyRank(id)] ?? null : null;
}
function buyAcademy(id) {
  const price = academyPrice(id);
  if (price === null || state.gems < price) return false;
  state.gems -= price;
  state.meta.academy[id] = academyRank(id) + 1;
  return true;
}

// ----- Frostbyte (Glacies guardian) — persistent state and rules shared by economy and story -----
// locked → frozen (Glacies settled) → heating (Thermalwerkstatt built; feed 6 cells into the heat network)
// → drones (2 frost drones) → battle → defeated → repaired (friend). Account level: survives prestige.
const FROSTBYTE_STAGES = ['locked', 'frozen', 'heating', 'drones', 'battle', 'defeated', 'repaired'];
const HEAT_CELLS_NEEDED = 6;
const FROSTBYTE_REPAIR = { cells: 6, frost: 30, ore: 150 };
const GLACIES_LEVEL_CAP = 10; // deep frost layers stay sealed until Frostbyte is recalibrated
function normalizeFrostbyte(raw) {
  const n = (v, max) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));
  return {
    stage: FROSTBYTE_STAGES.includes(raw?.stage) ? raw.stage : 'locked',
    heat: n(raw?.heat, HEAT_CELLS_NEEDED),
    drones: n(raw?.drones, 2),
    hp: Math.max(0, Number(raw?.hp) || 0),
    maxHp: Math.max(0, Number(raw?.maxHp) || 0),
    plates: n(raw?.plates ?? 3, 3),
    fightStart: Number(raw?.fightStart) || 0
  };
}
function frostbyte() {
  return state.meta.guardians.frostbyte;
}
const glaciesIndex = () => PLANETS.findIndex(p => p.id === 'ice');
// Cold shock: while the heat network is locked, Glacies extraction runs at 80 %.
function frostbyteColdShock(planet = state.activePlanet) {
  const stage = state.meta?.guardians?.frostbyte?.stage;
  return PLANETS[planet]?.id === 'ice' && (stage === 'frozen' || stage === 'heating');
}
function glaciesHeated(planet = state.activePlanet) {
  const stage = state.meta?.guardians?.frostbyte?.stage;
  return PLANETS[planet]?.id !== 'ice' || !['locked', 'frozen', 'heating'].includes(stage);
}
