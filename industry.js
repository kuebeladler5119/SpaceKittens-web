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
  // Beta 1.7 M2: the sorting and packing station next to the depot (packed crates sell better)
  { id: 'sorter', job: 'storage', name: 'Packstation', stage: 'Sortieren & Packen', verb: 'PACKEN', hire: 4000 },
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
  { id: 'biolab', job: 'production', name: 'Biolabor', stage: 'Biogel', verb: 'BIOGEL ANSETZEN', hire: 12000 },
  // Beta 1.7 M5: Orion's Sternenharz drill station (resin into tanks → Fertigung: fuel and chemicals)
  { id: 'resinDrill', job: 'mining', name: 'Harzbohrturm', stage: 'Harzförderung', verb: 'HARZ PUMPEN', hire: 15000 }
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
  // Beta 1.7 M2: sorts raw crystals from the depot into crates; the sale takes crates first at +15 %
  sorter: { name: 'Packstation', icon: '📦', cost: 2500, start: 0, perLevel: 6, unlockDepot: 3 },
  frostDrill: { name: 'Frostquarz-Bohrer', icon: '❄', cost: 1200, start: 0, perLevel: 0.5, planets: ['ice'] },
  thermal: { name: 'Thermalwerkstatt', icon: '♨', cost: 5000, start: 0, perLevel: 0.2, planets: ['ice'], needs: 'frostDrill' },
  foundry: { name: 'Glutschmelze', icon: '🔥', cost: 30000, start: 0, perLevel: 0.05, planets: ['volcanic'] },
  // K61 (session 9): 0.06 → 0.2 parts/s per level — at 0.06 a level paid back after 50,000 s (Lv 25: 249,000 s),
  // 8× worse than the Glutschmelze; the price stays (more output instead of cheaper levels)
  workshop: { name: 'Präzisionswerkstatt', icon: '⚙', cost: 450000, start: 0, perLevel: 0.2, planets: ['machine'] },
  // Viridia Bloom (session 11): Sporengarten → Biolabor; see viridia.js
  sporeGarden: { name: 'Sporengarten', icon: '✿', cost: 1500000, start: 0, perLevel: 3, planets: ['verdant'] },
  biolab: { name: 'Biolabor', icon: '◍', cost: 3000000, start: 0, perLevel: 1, planets: ['verdant'], needs: 'sporeGarden' },
  // Beta 1.7 M5: pumps Sternenharz from under the crystal plain into its tanks (no building multiplier: a slow, steady
  // source – fuel stays a decision, see docs/beta-1-7/STERNENHARZ.md)
  resinDrill: { name: 'Sternenharz-Bohrturm', icon: '🛢', cost: 40000, start: 0, perLevel: 0.06, planets: ['crystal'], unlockDepot: 8 }
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
  biogel: { name: 'Biogel', icon: '◍', planets: ['verdant'] },
  resin: { name: 'Sternenharz', icon: '✺', planets: ['crystal'] }
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
    biolab: Math.floor(num(saved?.industry?.biolab, 0, 100000)),
    sorter: Math.floor(num(saved?.industry?.sorter, 0, 100000)),
    resinDrill: Math.floor(num(saved?.industry?.resinDrill, 0, 100000))
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
    biogel: num(saved?.stock?.biogel, 0),
    packed: num(saved?.stock?.packed, 0),
    resin: num(saved?.stock?.resin, 0)
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
  // Beta 1.7 M2: the depot's distribution (sell / keep / production first); missing → the defaults
  const alloc = normalizeAlloc(saved?.alloc);
  // Beta 1.7 M3: the carts on the surface line (transport.js); missing → an empty line
  const transit = typeof normalizeTransit === 'function' ? normalizeTransit(saved?.transit) : null;
  // Beta 1.9 M2: the hand-overs after the depot (logistics.js); missing → empty legs, shelf and pad
  const haul = typeof normalizeHaul === 'function' ? normalizeHaul(saved?.haul) : null;
  return { industry, stock, staff, trip, converted, convertedJobs, railSizing, reserve, roots, alloc, transit, haul };
}
// Beta 1.7 M2: Verteilung of a colony's depot. The player decides whether surplus raw crystals and bars are sold
// automatically, how much raw stays as a minimum stock, and whether production orders come before the sale. The
// defaults need no micromanagement: everything surplus is sold, and active production orders keep their next batch.
const ALLOC_KEEP_OPTIONS = [0, 100, 500, 2000, 10000];
function normalizeAlloc(saved) {
  return {
    sellRaw: saved?.sellRaw !== false,
    sellBars: saved?.sellBars !== false,
    keep: ALLOC_KEEP_OPTIONS.includes(Number(saved?.keep)) ? Number(saved.keep) : 0,
    priority: saved?.priority === 'sale' ? 'sale' : 'production'
  };
}
function colonyAlloc(planet = state.activePlanet) {
  const colony = state.colonies[planet];
  if (colony && !colony.alloc) colony.alloc = normalizeAlloc(null);
  return colony?.alloc || normalizeAlloc(null);
}
// raw that production orders hold back from the sale (and from the hopper feed): their next batch
function fabReserveUnits(planet = state.activePlanet) {
  return colonyAlloc(planet).priority !== 'sale' && typeof fabRawDemand === 'function' ? fabRawDemand(planet) : 0;
}
// Beta 1.7 M3/QA: the carts deliver in batches (one every CART_INTERVAL s), so every automated processing step keeps
// one delivery interval of its raw input in the depot: the refinery's feed and the specialty buildings (Thermalwerkstatt,
// Glutschmelze, Präzisionswerkstatt, Biolabor). Otherwise the sale takes a batch in the tick it arrives and these
// buildings only get one second's worth per delivery (they ran at ~40 % – found by the economy simulation, QA).
// Only what each step really consumes (rate × its raw per unit), never the feed's full speed.
function feedReserveUnits(planet = state.activePlanet) {
  const colony = state.colonies[planet];
  if (!colony || colonyAlloc(planet).priority === 'sale') return 0;
  const span = (typeof CART_INTERVAL === 'number' ? CART_INTERVAL : 0) + 1;
  return withPlanet(planet, () => {
    let perSecond = 0;
    if ((colony.industry.refinery || 0) > 0 && isAutomated('depot') && isAutomated('refinery')) perSecond += Math.min(feedRate(), refineryRate());
    if ((colony.industry.thermal || 0) > 0 && isAutomated('thermal')) perSecond += thermalRate() * RAW_PER_CELL;
    if ((colony.industry.foundry || 0) > 0 && isAutomated('foundry') && typeof foundryRate === 'function') perSecond += foundryRate() * 1.5 * RAW_PER_ALLOY;
    if ((colony.industry.workshop || 0) > 0 && isAutomated('workshop') && typeof workshopRate === 'function') perSecond += workshopRate() * RAW_PER_PART;
    if ((colony.industry.biolab || 0) > 0 && isAutomated('biolab') && typeof biogelRate === 'function') perSecond += biogelRate() * RAW_PER_GEL;
    return perSecond * span;
  });
}
// The sales floor: the largest of the K62 reserve, the chosen minimum stock, and what production keeps (the orders'
// next batches plus one cart interval of every automated processing step's raw input).
function rawSaleFloor(planet = state.activePlanet) {
  const cap = withPlanet(planet, () => storageCapacity());
  return Math.min(cap, Math.max(rawReserveUnits(planet), colonyAlloc(planet).keep, fabReserveUnits(planet) + feedReserveUnits(planet)));
}

// ----- Beta 1.7 M2: conservation book -----
// Every quantity of a colony is in exactly one place: underground (faces, kittens, platforms, the cabin), the Halde, a
// cart, the depot, the hopper, the bar store (1 bar = BAR_RAW raw), a production batch in work or a freight hold. The
// book counts what enters the economy (mined, extracted, tapped, bought) and what leaves it (sold, consumed by a
// recipe, delivered, used for a repair); inventoryRaw() sums the places. Tests assert Δinventory = created − destroyed
// for any mix of steps, so nothing can appear or vanish unnoticed. Runtime only (not saved), like industryFlow.
const LEDGER = { created: {}, destroyed: {}, credits: {} };
function ledgerBook(kind, planet, material, amount) {
  if (!(amount > 0) || !LEDGER[kind]) return;
  const bars = material === 'bars',
    key = planet + ':' + (bars ? 'raw' : material);
  LEDGER[kind][key] = (LEDGER[kind][key] || 0) + (bars ? amount * BAR_RAW : amount);
}
function ledgerNet(planet, material) {
  const key = planet + ':' + material;
  return (LEDGER.created[key] || 0) - (LEDGER.destroyed[key] || 0);
}
function ledgerReset() {
  LEDGER.created = {};
  LEDGER.destroyed = {};
  LEDGER.credits = {};
}
// Credits by source ('sale:auto', 'sale:manual', 'sale:speciality', 'sale:goods', 'contract'; rewards stay 'other').
function ledgerCredits(source, amount) {
  if (amount > 0) LEDGER.credits[source] = (LEDGER.credits[source] || 0) + amount;
}
// Raw crystals of a colony in raw units wherever they are (bars count BAR_RAW each); freight holds are added once for
// the whole galaxy by inventoryRawGalaxy().
function inventoryRaw(planet) {
  const c = state.colonies[planet];
  if (!c) return 0;
  const inWork = (c.fab?.orders || []).reduce((sum, o) => sum + (o.loaded && typeof RECIPES !== 'undefined' && RECIPES[o.recipe] ? RECIPES[o.recipe].in.raw || 0 : 0), 0);
  return (
    (typeof undergroundStockOf === 'function' ? undergroundStockOf('raw', planet) : 0) +
    c.stock.pile +
    (c.trip?.amount || 0) +
    (state.planetOps.storage[planet] || 0) +
    c.stock.hopper +
    c.stock.bars * BAR_RAW +
    (c.stock.packed || 0) +
    (typeof transitStock === 'function' ? transitStock(planet) : 0) +
    (typeof haulStock === 'function' ? haulStock(planet) : 0) +
    inWork
  );
}
function inventoryRawGalaxy() {
  const freight = typeof freightInTransit === 'function' ? freightInTransit('raw') + freightInTransit('bars') * BAR_RAW : 0;
  return state.colonies.reduce((sum, _, i) => sum + inventoryRaw(i), 0) + freight;
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
  return Math.max(0, (state.planetOps.storage[planet] || 0) - rawSaleFloor(planet));
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
  if (['frostDrill', 'thermal', 'foundry', 'workshop', 'sporeGarden', 'biolab', 'resinDrill'].includes(id)) return planetAllows(id, planet) && colony.industry[id] > 0;
  if (id === 'refinery') return colony.industry.refinery > 0;
  if (id === 'sorter') return (colony.industry.sorter || 0) > 0;
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
  return level > 0 ? (1 + 0.05 * (level - 1)) * (typeof techStaffFactor === 'function' ? techStaffFactor() : 1) : 1;
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
// P1.4 — the station managers' training (FORTBILDEN): credits per level (× growth per level). The Meisterstufen in
// STAFF_TRAINING.master also need the station's own building at a milestone level and cost a factor more. A level once
// trained is never taken away: the table only decides the next training (docs/p1-4-cosmetics-collection/MANAGER_BALANCE.md).
// The Meisterstufen: a number of completed Lichtzyklen (account progress; training restarts at 1 with every Lichtzyklus,
// as it always did) and the station's building at a level in this run; each costs a factor more. Chosen from the
// simulated curves (MANAGER_BALANCE.md, variant cycles6: the first MAX of an active player on day 3, about a quarter of
// the station managers at MAX on day 4; a casual player stays at the Meisterstufen in the first week).
let STAFF_TRAINING = {
  growth: 1.6,
  master: {
    7: { cycles: 1, building: 10, factor: 3 },
    8: { cycles: 2, building: 15, factor: 6 },
    9: { cycles: 4, building: 20, factor: 12 },
    10: { cycles: 6, building: 25, factor: 25 }
  }
};
// Meisterbrief (Bestandsschutz): the highest level a station's manager ever reached, per planet (meta.staffMastery,
// kept through every Lichtzyklus). A level once reached may be trained again in any later run without waiting for the
// Lichtzyklen again – the station's building level of the run still counts. Saves from before P1.4 record what their
// managers have reached on the first load.
function staffMastery(workplace, planet = state.activePlanet) {
  return Math.max(0, Math.min(STAFF_MAX_LEVEL, Math.floor(Number(state.meta?.staffMastery?.[planet]?.[workplace]) || 0)));
}
function staffMasterySync() {
  if (!state.meta) return;
  const m = state.meta.staffMastery && typeof state.meta.staffMastery === 'object' && !Array.isArray(state.meta.staffMastery) ? state.meta.staffMastery : (state.meta.staffMastery = {});
  state.colonies.forEach((colony, planet) => {
    for (const [wp, level] of Object.entries(colony?.staff || {})) {
      if (!(level > 1) || !/^[a-z]\w{0,30}$/i.test(wp)) continue;
      const row = m[planet] && typeof m[planet] === 'object' ? m[planet] : (m[planet] = {});
      if (level > staffMastery(wp, planet)) row[wp] = Math.min(STAFF_MAX_LEVEL, Math.floor(level));
    }
  });
}
// the level of the building a workplace runs (the station a manager's training is tied to)
function workplaceBuildingLevel(id, planet = state.activePlanet) {
  const c = colonyAt(planet);
  if (!c) return 0;
  if (id === 'mine') return c.buildings[0].level;
  if (id === 'depot') return c.buildings[2].level;
  if (id === 'dock') return c.buildings[3].level;
  if (SHAFT_IDS.includes(id)) return c.underground?.shafts?.[id]?.level || 0;
  if (id === 'elevator') return Math.max(c.underground?.elevator?.speed || 0, c.underground?.elevator?.cap || 0);
  return c.industry?.[id] || 0;
}
// what keeps a hired station manager from the next training: null, or { level, cycles?, building? } – a Meisterstufe
// needs a number of completed Lichtzyklen (account progress) and the station's own building at a level (this run)
function staffTrainBlock(workplace, planet = state.activePlanet) {
  const level = colonyAt(planet)?.staff?.[workplace] || 0,
    need = STAFF_TRAINING.master[level + 1];
  if (!(level > 0) || level >= STAFF_MAX_LEVEL || !need) return null;
  const cycles = need.cycles && (state.galaxiesSold || 0) < need.cycles && staffMastery(workplace, planet) < level + 1 ? need.cycles : 0,
    building = need.building && workplaceBuildingLevel(workplace, planet) < need.building ? need.building : 0;
  return cycles || building ? { level: level + 1, ...(cycles ? { cycles } : {}), ...(building ? { building } : {}) } : null;
}
function staffUpgradeCost(workplace, planet = state.activePlanet) {
  const level = colonyAt(planet).staff[workplace],
    master = STAFF_TRAINING.master[level + 1];
  return Math.floor(WORKPLACE[workplace].hire * Math.pow(3, planet) * 2 * Math.pow(STAFF_TRAINING.growth, level - 1) * (master?.factor || 1) * (1 - 0.1 * academyRank('personnel')));
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
  return level > 0 ? INDUSTRY_BUILDINGS.frostDrill.perLevel * level * buildingMultiplier(level) * workplaceEfficiency('frostDrill') * glaciesBoost('frost') * (typeof coreFrostFactor === 'function' ? coreFrostFactor(state.activePlanet) : 1) : 0;
}
function frostCapacity() {
  const level = industryLevel('frostDrill') || 0;
  return level > 0 ? 30 + 20 * level * buildingMultiplier(level) : 0;
}
function thermalRate() {
  const level = industryLevel('thermal') || 0;
  return level > 0 ? INDUSTRY_BUILDINGS.thermal.perLevel * level * buildingMultiplier(level) * workplaceEfficiency('thermal') * glaciesBoost('thermal') * (typeof coreThermalFactor === 'function' ? coreThermalFactor(state.activePlanet) : 1) : 0;
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
    ? INDUSTRY_BUILDINGS.refinery.perLevel * level * buildingMultiplier(level) * workplaceEfficiency('refinery') * (secondaryActive('waffles') ? 1.1 : 1) * (typeof techHas === 'function' && techHas('lensArray') ? 1.1 : 1)
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
// Beta 1.7 M5: Sternenharz. The drill fills its tanks (resin units); full tanks stop the pump (nothing is lost).
function resinRate(planet = state.activePlanet) {
  const level = state.colonies[planet]?.industry?.resinDrill || 0;
  return level > 0 ? INDUSTRY_BUILDINGS.resinDrill.perLevel * level * withPlanet(planet, () => workplaceEfficiency('resinDrill')) : 0;
}
function resinCapacity(planet = state.activePlanet) {
  const level = state.colonies[planet]?.industry?.resinDrill || 0;
  return level > 0 ? Math.floor((40 + 20 * level) * (typeof techResinCapacityFactor === 'function' ? techResinCapacityFactor() : 1)) : 0;
}
// Beta 1.7 M2: the Packstation. Packs raw crystals above the sale floor into crates (raw units); the sale takes
// crates first and pays PACK_PREMIUM for them. Crates are raw crystals in another place (counted by inventoryRaw).
const PACK_PREMIUM = 1.15;
function packPremium() {
  return typeof techPackPremium === 'function' ? techPackPremium() : PACK_PREMIUM;
}
function packRate(planet = state.activePlanet) {
  const level = state.colonies[planet]?.industry?.sorter || 0;
  return level > 0 ? INDUSTRY_BUILDINGS.sorter.perLevel * level * buildingMultiplier(level) * withPlanet(planet, () => workplaceEfficiency('sorter')) : 0;
}
function packCapacity(planet = state.activePlanet) {
  const level = state.colonies[planet]?.industry?.sorter || 0;
  return level > 0 ? 200 + 100 * level * buildingMultiplier(level) : 0;
}
function barValue() {
  return BAR_VALUE + (secondaryActive('pudding') ? 1 : 0) + (typeof techHas === 'function' && techHas('barMint') ? 1 : 0);
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
    RS: resinRate(),
    resinCap: resinCapacity(),
    PK: packRate(),
    packCap: packCapacity(),
    rawReserve: rawSaleFloor(),
    fabReserve: fabReserveUnits(),
    barsReserve: colonyAlloc().priority !== 'sale' && typeof fabDemand === 'function' ? fabDemand(state.activePlanet, 'bars') : 0,
    sellRaw: colonyAlloc().sellRaw,
    sellBars: colonyAlloc().sellBars
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
  // Beta 1.9 M2: with the hauls (logistics.js) the sale and the feed are dispatched onto carriers: the caller passes
  // what the legs can take (saleRoom, feedRoom); the hopper then fills on arrival, not here
  const legFeed = r.feedRoom !== undefined,
    saleCap = r.saleRoom !== undefined ? r.saleRoom : ((a.stall ? r.S1 : 0) + (a.dock ? r.S2 : 0)) * dt; // raw-equivalent units
  const hopperRoom = legFeed ? r.feedRoom : Math.max(0, r.hopperCap - stock.hopper) + (a.refinery ? r.P * dt : 0);
  // Beta 1.7: the hopper feed leaves the production orders' next batch in the depot (they take turns, nobody starves)
  let fed = a.depot && r.refineryOn ? Math.max(0, Math.min(r.F * dt, depot - (r.fabReserve || 0), hopperRoom)) : 0;
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
  let hopper = stock.hopper + (legFeed ? 0 : fed);
  const barRoom = Math.max(0, r.barCap - stock.bars) + (r.sellBars === false ? 0 : saleCap / BAR_RAW);
  const processed = a.refinery && r.refineryOn ? Math.max(0, Math.min(r.P * dt, hopper, barRoom * BAR_RAW)) : 0;
  hopper -= processed;
  let bars = stock.bars + processed / BAR_RAW;
  // Beta 1.7 M5: the Sternenharz drill pumps into its tanks (a full tank stops the pump)
  const resinGross = a.resinDrill ? (r.RS || 0) * dt : 0;
  let resin = (stock.resin || 0) + resinGross,
    resinExtracted = resinGross;
  if (resin > (r.resinCap || 0) && resinGross > 0) {
    const idle = Math.min(resin - (r.resinCap || 0), resinGross);
    resin -= idle;
    resinExtracted -= idle;
  }
  // Beta 1.7 M2: the Packstation packs sellable raw (above the sale floor) into crates
  let packed = stock.packed || 0;
  const packedNow = a.sorter && r.PK > 0 ? Math.max(0, Math.min(r.PK * dt, depot - (r.rawReserve || 0), (r.packCap || 0) - packed)) : 0;
  depot -= packedNow;
  packed += packedNow;
  let capacity = saleCap;
  // Beta 1.7 M9: production orders keep their next batch of bars too (e.g. Kernkristall: 100 bars)
  const barsSold = r.sellBars === false ? 0 : Math.min(Math.max(0, bars - (r.barsReserve || 0)), capacity / BAR_RAW);
  bars -= barsSold;
  capacity -= barsSold * BAR_RAW;
  // crates first (they fetch more), then loose raw above the floor
  const packedSold = r.sellRaw === false ? 0 : Math.min(packed, capacity);
  packed -= packedSold;
  capacity -= packedSold;
  // K62: sales only take what lies above the Rohkristall-Reserve (processing above may use the reserve)
  const rawSold = r.sellRaw === false ? 0 : Math.min(Math.max(0, depot - (r.rawReserve || 0)), capacity);
  depot -= rawSold;
  // Overflow is pushed back upstream (never destroyed).
  if (!legFeed && hopper > r.hopperCap && fed > 0) {
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
    stock: { pile, depot, hopper, bars, frost, cells, ember, emberAlloy, precisionOre, precisionParts, spores, biogel, packed, resin },
    resinExtracted,
    packedNow,
    packedSold,
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
// Beta 1.7: production runs in steps of at most 1 s (the cart line and the Halde buffer are physical time constants);
// the cap only guards absurd spans (> 30 h, beyond every offline limit).
const OFFLINE_CHUNK_MAX = 108000;
// Beta 1.9 M2: rawSold/packedSold/barsSold are what customers and the freighter really bought; *Sent is what left the
// stores for them (onto the carriers), fed what left the depot for the hopper and fedIn what reached it
const FLOW_SUM = ['resinExtracted', 'packedNow', 'packedSold', 'extracted', 'inflow', 'moved', 'fed', 'fedIn', 'processed', 'barsSold', 'rawSold', 'rawSent', 'packedSent', 'barsSent', 'shelfSold', 'padSold', 'frostExtracted', 'cellsMade', 'alloysMade', 'coolantUsed', 'partsMade', 'sporesExtracted', 'gelMade', 'lifted', 'manual'];
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
  // Beta 1.7 M2/M3: every call is cut into chunks of at most 1 s (offline too), with or without the
  // underground, and production orders run inside the same chunks (they see the depot between the steps, not after
  // the whole call has sold it). Ten 60-s steps and one 600-s step therefore run the same 600 chunks.
  const fabActive = Boolean(colony.fab?.orders?.length) && typeof stepFabrication === 'function',
    chunks = seconds > 1 ? Math.min(OFFLINE_CHUNK_MAX, Math.ceil(seconds)) : 1,
    h = seconds / chunks;
  let nums = open ? undergroundNumbers(index) : null;
  // Beta 1.7 M3: with a rail manager the line runs as real carts (transport.js); carts already out finish their trip
  const carts = typeof stepSurfaceTransport === 'function',
    flowAuto = carts ? { ...auto, rail: false } : auto,
    hauls = typeof stepHauls === 'function',
    haulT = hauls ? haulTables(index) : null; // Beta 1.9: walks, intervals and bounds once per call (offline: 43,200 chunks)
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
    // the depot is a pass-through within the chunk (transport.js): a cart may tip what sales, feed and processing take
    const through =
        h *
        ((auto.stall ? rates.S1 : 0) + (auto.dock ? rates.S2 : 0) + (auto.depot ? rates.F : 0) + (rates.PK || 0) + (rates.TR || 0) * RAW_PER_CELL +
          (rates.FD || 0) * 1.5 * RAW_PER_ALLOY + (rates.WS || 0) * RAW_PER_PART + (rates.BL || 0) * RAW_PER_GEL),
      cartMoved = carts && (auto.rail || colony.transit?.carts?.length) ? stepSurfaceTransport(index, h, { rate: rates.L, auto: auto.rail, depotCap: rates.depotCap, through }).moved : 0;
    total.moved += cartMoved;
    if (fabActive) {
      rates.rawReserve = rawSaleFloor(index);
      rates.fabReserve = fabReserveUnits(index);
      rates.barsReserve = colonyAlloc(index).priority !== 'sale' && typeof fabDemand === 'function' ? fabDemand(index, 'bars') : 0;
    }
    const rooms = hauls ? haulRooms(index, rates, auto, h, haulT) : null;
    if (rooms) {
      rates.saleRoom = rooms.saleRoom;
      rates.feedRoom = rooms.feedRoom;
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
        biogel: colony.stock.biogel || 0,
        packed: colony.stock.packed || 0,
        resin: colony.stock.resin || 0
      },
      rates,
      flowAuto,
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
    colony.stock.packed = flow.stock.packed;
    colony.stock.resin = flow.stock.resin;
    state.planetOps.storage[index] = flow.stock.depot;
    // what this chunk's carts tipped beyond the depot's capacity and nobody took goes back onto the cart
    const back = Math.min(cartMoved, flow.stock.depot - rates.depotCap);
    if (back > 1e-9) {
      cartTakeBack(index, back);
      state.planetOps.storage[index] -= back;
      total.moved -= back;
    }
    // Beta 1.9 M2: what the flow took for the sale and the hopper goes onto the carriers; customers, the freighter and
    // the hopper book it in only when it arrives
    if (rooms) {
      haulDispatch(index, flow, rooms.stallShare);
      flow.rawSent = flow.rawSold;
      flow.packedSent = flow.packedSold;
      flow.barsSent = flow.barsSold;
      const step = stepHauls(index, h, { S1: auto.stall ? rates.S1 : 0, S2: auto.dock ? rates.S2 : 0, hopperLimit: rates.hopperCap + (auto.refinery ? rates.P : 0), tables: haulT });
      flow.rawSold = step.sold.raw;
      flow.packedSold = step.sold.packed;
      flow.barsSold = step.sold.bars;
      flow.fedIn = step.fedIn;
      flow.shelfSold = step.shelfSold;
      flow.padSold = step.padSold;
    } else flow.fedIn = flow.fed;
    FLOW_SUM.forEach(key => {
      if (key !== 'lifted' && key !== 'manual') total[key] += flow[key] || 0;
    });
    if (fabActive) stepFabrication(index, h * efficiency);
  }
  // Beta 1.7 M7: deep shafts (depth 3+) find Fundstücke by what they really mined (bounded, see artifacts.js)
  if (open && typeof artifactProgress === 'function') artifactProgress(index, mined);
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
      // Beta 1.7 M8: the Aderkarte doubles what a find brings
      const gain = found * (typeof techFindsMultiplier === 'function' ? techFindsMultiplier() : 1);
      if (finds.kind === 'crystals') state.crystals += gain;
      else state.ore += gain;
    });
  }
  // Beta 1.7 M2: the book – what this call mined/extracted and what it sold or consumed
  if (open) Object.entries(mined).forEach(([id, value]) => ledgerBook('created', index, shaftMaterial(id, index), value));
  else ledgerBook('created', index, 'raw', total.extracted);
  ledgerBook('created', index, 'frost', total.frostExtracted);
  ledgerBook('created', index, 'spores', total.sporesExtracted);
  ledgerBook('created', index, 'resin', total.resinExtracted);
  ledgerBook('destroyed', index, 'raw', total.rawSold + total.packedSold + total.barsSold * BAR_RAW + total.cellsMade * RAW_PER_CELL + total.alloysMade * RAW_PER_ALLOY + total.partsMade * RAW_PER_PART + total.gelMade * RAW_PER_GEL);
  const credits = (total.rawSold + total.packedSold * packPremium() + total.barsSold * barValue()) * salePriceMultiplier(fill) * efficiency * (typeof coreSaleFactor === 'function' ? coreSaleFactor(index) : 1);
  if (credits > 0) {
    earn(credits, 'sale:auto');
    GameEvents.emit('sale', { credits, amount: total.rawSold + total.packedSold + total.barsSold * BAR_RAW, auto: true, planet: index, workplace: auto.stall ? 'stall' : 'dock' });
  }
  if (total.extracted > 0 && secondaryActive('nibbles')) {
    crystalCarry[index] = (crystalCarry[index] || 0) + seconds / 900;
    const found = Math.floor(crystalCarry[index]);
    if (found) {
      state.crystals += found;
      crystalCarry[index] -= found;
    }
  }
  const delivered = total.rawSold + total.packedSold + total.barsSold * BAR_RAW;
  trackWeeklySales(delivered);
  if (seconds > 0) industryFlow[index] = { ...total, mined, deposited, credits, seconds, at: Date.now() };
  if (seconds > 0 && seconds <= 30) updateFlowRates(index, total, seconds);
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
// ----- Beta 1.7 M4: measured throughput and station diagnosis -----
// Per-second flows over the last 60 s of play (a sliding window; online ticks only, offline catch-ups are not
// "measured"). Batches (carts, crates, elevator trips) arrive in pulses; the window turns them into a steady rate.
const flowRates = [];
const FLOW_WINDOW = 60;
function updateFlowRates(index, total, seconds) {
  const e = flowRates[index] || (flowRates[index] = { age: 0, ticks: [] });
  e.ticks.push({ seconds, ...Object.fromEntries(FLOW_SUM.map(key => [key, total[key] || 0])) });
  let span = e.ticks.reduce((s, t) => s + t.seconds, 0);
  while (e.ticks.length > 1 && span - e.ticks[0].seconds >= FLOW_WINDOW) span -= e.ticks.shift().seconds;
  e.age += seconds;
  e.span = span;
}
function measuredRate(key, planet = state.activePlanet) {
  const e = flowRates[planet];
  if (!e?.span) return 0;
  return e.ticks.reduce((s, t) => s + t[key], 0) / e.span;
}
// One station's throughput: what it really moved per second, what it could move, and why it is below that.
// status: 'manual' (no manager), 'full' (≥ 95 % used), 'starved' (a processing station waits for input it should
// get), 'spare' (more capacity than arrives – upstream sets the pace),
// 'blocked' (output full), 'ok'. hint: a short reason; action: a one-tap fix the sheet offers.
function stationReport(workplace, planet = state.activePlanet) {
  return withPlanet(planet, () => {
    const r = colonyRates(),
      a = colonyAutomation(planet),
      c = colonyAt(planet),
      depot = state.planetOps.storage[planet] || 0,
      sale = (a.stall ? r.S1 : 0) + (a.dock ? r.S2 : 0),
      m = key => measuredRate(key, planet),
      warm = (flowRates[planet]?.age || 0) >= 8;
    const report = (rate, cap, unit = '/s') => ({ workplace, rate, cap, unit, use: cap > 0 ? Math.min(1, rate / cap) : 0, status: 'ok', hint: '', action: null, warm });
    let rep;
    if (workplace === 'mine') {
      rep = report(r.open ? m('lifted') : m('extracted'), r.open ? Math.min(automatedExtraction(r, a), r.EL || Infinity) : a.mine ? r.E : 0);
      if (!r.open && c.stock.pile >= r.pileCap * 0.95) Object.assign(rep, { status: 'blocked', hint: 'Die Halde ist voll – die Lorenbahn holt zu wenig ab.' });
    } else if (workplace === 'rail') {
      rep = report(m('moved'), r.L);
      if (depot >= r.depotCap * 0.95) Object.assign(rep, { status: 'blocked', hint: 'Das Lager ist voll – die Loren warten mit ihrer Ladung.' });
      else if (c.stock.pile < 1 && rep.use < 0.5) Object.assign(rep, { status: 'spare', hint: 'Die Loren schaffen mehr, als der Abbau liefert.' });
    } else if (workplace === 'depot') {
      rep = report(m('fed'), industryLevel('refinery') > 0 ? r.F : 0);
      if (rep.cap > 0 && depot < 1 && rep.use < 0.5) Object.assign(rep, { status: 'starved', hint: 'Kein Rohkristall im Lager für die Beschickung.' });
    } else if (workplace === 'sorter') {
      rep = report(m('packedNow'), r.PK);
      if ((c.stock.packed || 0) >= (r.packCap || 0) * 0.95) Object.assign(rep, { status: 'blocked', hint: 'Das Kistenlager ist voll – der Verkauf holt zu wenig ab.' });
      else if (rep.use < 0.5 && depot <= (r.rawReserve || 0) + 1) Object.assign(rep, { status: 'starved', hint: 'Nur Rohkristalle über dem Mindestbestand werden verpackt.' });
    } else if (workplace === 'refinery') {
      rep = report(m('processed'), r.P);
      const fedEnough = a.depot;
      if (rep.cap > 0 && c.stock.bars >= r.barCap * 0.95 && !a.stall && !a.dock) Object.assign(rep, { status: 'blocked', hint: 'Das Barrenlager ist voll – niemand verkauft Barren.' });
      else if (rep.cap > 0 && !fedEnough) Object.assign(rep, { status: 'starved', hint: 'Raffinerie wartet auf Rohkristalle – ohne Lager-Manager beschickt niemand den Trichter.', action: { label: 'LAGERHAUS ÖFFNEN', sheet: 2 } });
      else if (rep.cap > 0 && rep.use < 0.8 && c.stock.hopper < r.P * 0.5) {
        const keep = Math.max(50, Math.ceil((r.P * 30) / 50) * 50),
          option = ALLOC_KEEP_OPTIONS.find(n => n >= keep) || ALLOC_KEEP_OPTIONS[ALLOC_KEEP_OPTIONS.length - 1],
          sold = m('rawSold') + m('packedSold');
        // raw is being sold while the refinery waits: the Verteilung decides; otherwise the feed or the supply is the limit
        if (sold > r.P * 0.05)
          Object.assign(
            rep,
            colonyAlloc(planet).priority === 'sale'
              ? { status: 'starved', hint: 'Raffinerie wartet auf Rohkristalle – der Verkauf hat Vorrang.', action: { label: 'PRODUKTION ZUERST', alloc: { priority: 'production' } } }
              : { status: 'starved', hint: 'Raffinerie wartet auf Rohkristalle – reserviere ' + fmt(option) + ' Rohkristalle für die Raffinerie.', action: { label: 'MINDESTBESTAND ' + fmt(option), alloc: { keep: option } } }
          );
        else if (r.F < r.P * 0.9) Object.assign(rep, { status: 'starved', hint: 'Die Beschickung ist zu langsam – das Lagerhaus ausbauen.', action: { label: 'LAGERHAUS ÖFFNEN', sheet: 2 } });
        else Object.assign(rep, { status: 'spare', hint: 'Die Raffinerie schafft mehr, als ankommt.' });
      }
    } else if (workplace === 'stall' || workplace === 'dock') {
      rep = report(m('rawSold') + m('packedSold') + m('barsSold') * BAR_RAW, sale);
      if (rep.use < 0.5 && depot <= (r.rawReserve || 0) + 1 && c.stock.bars < 1 && (c.stock.packed || 0) < 1) Object.assign(rep, { status: 'spare', hint: 'Der Verkauf schafft mehr, als ankommt.' });
    } else if (workplace === 'elevator' && r.open) {
      // exact from the trip log when there are trips: what the cabin brought up per second between its arrivals
      const log = typeof liftTripLog === 'function' ? liftTripLog(planet) : null,
        trips = log?.at || [],
        span = trips.length >= 3 ? trips[trips.length - 1] - trips[0] : 0;
      const lifted = span > 0 ? log.last.slice(-trips.length + 1).reduce((s, v) => s + v, 0) / span : m('lifted');
      // elevatorRate() assumes full trips over every ramp; a cabin that only serves the upper ramps is faster than that
      rep = report(lifted, Math.max(r.EL, lifted));
    } else return null;
    if (!isAutomated(workplace, planet) && workplace !== 'elevator') Object.assign(rep, { status: 'manual', hint: rep.hint || 'Handbetrieb – ein Manager übernimmt diese Station.' });
    else if (rep.status === 'ok' && rep.use >= 0.95) rep.status = 'full';
    return rep;
  });
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
  // Beta 1.7 M4: a processing station that really waits (measured, after ~8 s of play)
  if (a.refinery) {
    const ref = stationReport('refinery');
    if (ref?.warm && ref.status === 'starved') return { id: 'refinery', text: ref.hint };
  }
  return { id: 'mine', text: 'Die Förderung bestimmt dein Tempo.' };
}

// ----- Manual operation (always available, so the player can never get stuck) -----
function manualBatch(workplace) {
  const r = colonyRates();
  if (workplace === 'rail') return Math.max(40, r.L * 4);
  if (workplace === 'stall') return Math.max(30, r.S1 * 6);
  if (workplace === 'dock') return Math.max(100, r.S2 * 6);
  if (workplace === 'depot') return Math.max(50, r.F * 6);
  if (workplace === 'sorter') return Math.max(40, r.PK * 6);
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
  ledgerBook('created', state.activePlanet, 'raw', added);
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
  const crates = Math.min(colony.stock.packed || 0, capacity);
  capacity -= crates;
  const raw = Math.min(Math.max(0, depot - rawSaleFloor(index)), capacity);
  if (bars + crates + raw <= 0) return { units: 0, credits: 0 };
  colony.stock.bars -= bars;
  colony.stock.packed = (colony.stock.packed || 0) - crates;
  state.planetOps.storage[index] = depot - raw;
  const credits = (raw + crates * packPremium() + bars * barValue()) * salePriceMultiplier(fill) * (typeof coreSaleFactor === 'function' ? coreSaleFactor(index) : 1);
  ledgerBook('destroyed', index, 'raw', raw + crates + bars * BAR_RAW);
  earn(credits, 'sale:manual');
  const units = raw + crates + bars * BAR_RAW;
  trackWeeklySales(units);
  return { units, credits };
}
// Beta 1.7 M5: one tap at the Harzbohrturm pumps a few seconds' worth into the tanks
function manualResin() {
  const colony = colonyAt(),
    amount = Math.min(Math.max(2, resinRate() * 10), Math.max(0, resinCapacity() - (colony.stock.resin || 0)));
  if (amount <= 0 || !workplaceExists('resinDrill')) return 0;
  colony.stock.resin = (colony.stock.resin || 0) + amount;
  ledgerBook('created', state.activePlanet, 'resin', amount);
  return amount;
}
// Beta 1.7 M2: one tap at the Packstation packs a batch of sellable raw into crates
function manualPack() {
  const index = state.activePlanet,
    colony = colonyAt(),
    depot = state.planetOps.storage[index] || 0,
    amount = Math.min(manualBatch('sorter'), Math.max(0, depot - rawSaleFloor(index)), Math.max(0, packCapacity() - (colony.stock.packed || 0)));
  if (amount <= 0 || !workplaceExists('sorter')) return 0;
  state.planetOps.storage[index] = depot - amount;
  colony.stock.packed = (colony.stock.packed || 0) + amount;
  return amount;
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
  ledgerBook('destroyed', index, 'raw', cells * RAW_PER_CELL);
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
