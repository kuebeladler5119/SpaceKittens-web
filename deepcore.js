// Deep Core Mining 2.0 — the living mine (save schema 29). Loaded after industry.js and before game.js; functions use
// game.js globals only when called. Plan: docs/LIVING_MINE_LOGISTICS_PLAN.md.
//
//   face (worksite) → carried (kittens) → platform (Schachtlager) → elevator cabin → surface pile → rail → depot → …
//
// Every underground transfer happens in one discrete simulation (`stepUnderground`), advanced by simulated seconds
// (ticks and offline alike): mining is continuous between events, carrier deposits, manual work steps and elevator
// phases are discrete events. Rates shown in the UI are estimates from the same formulas.
//
// No double production: the colony's extraction is the sum of its shafts. Shaft 1 *is* the Kristallmine (track A =
// Kristallmine level, track B = Helferhütte level, plus the grandfathered `legacyPower` of K26). While the
// underground is closed, Shaft 1 delivers straight onto the pile (the original surface mine).

// Planet content. Shaft 'mine' is always the existing Kristallmine. `base` = output per drill level (before the
// building multiplier), `cost` = first construction (= drill track price), `build` = construction seconds.
// Beta 1.4 M2 — scalable shafts: deeper shafts come from a data table instead of hand-written ids. Each step deeper
// multiplies output ×3 and price ×6 (the ratio of the hand-made Schacht 4–6) and takes longer to build — minutes at
// first, hours at the bottom (construction runs offline too). Needs: the shaft above at level 10.
const DEEP_SERIES = { baseFrom: 1600, costFrom: 2500000, base: 3, cost: 6, build: [3600, 5400, 7200, 10800, 14400, 18000, 21600, 28800] };
function deepShaftSeries(planet, from, rows) {
  return rows.map(([title, zone, extra], i) => {
    const depth = from + i,
      step = depth - from + 1;
    return {
      id: 'shaft' + depth,
      depth,
      name: 'Schacht ' + depth,
      title,
      zone,
      base: Math.round(DEEP_SERIES.baseFrom * DEEP_SERIES.base ** step),
      cost: Math.round(DEEP_SERIES.costFrom * DEEP_SERIES.cost ** step),
      build: DEEP_SERIES.build[Math.min(i, DEEP_SERIES.build.length - 1)],
      needs: { ['shaft' + (depth - 1)]: 10 },
      ...(extra || {})
    };
  });
}
const DEEP_CORE = {
  crystal: {
    title: 'Kristallfeld-Tiefen',
    shafts: [
      { id: 'mine', depth: 1, name: 'Schacht 1', title: 'Kristallader', zone: 'amethyst' },
      { id: 'shaft2', depth: 2, name: 'Schacht 2', title: 'Amethyst-Stollen', zone: 'amethyst', base: 10, cost: 1200, build: 60, needs: {} },
      { id: 'shaft3', depth: 3, name: 'Schacht 3', title: 'Tiefendruse', zone: 'geode', base: 40, cost: 9000, build: 180, needs: { shaft2: 5, depot: 2 }, finds: { kind: 'crystals', seconds: 600 } },
      // "Organisierter Abbau": three deeper shafts, each with its own real value (finds, an old conveyor) and story.
      { id: 'shaft4', depth: 4, name: 'Schacht 4', title: 'Verdichtete Adern', zone: 'geode', base: 150, cost: 60000, build: 360, needs: { shaft3: 10 }, finds: { kind: 'ore', seconds: 20 }, look: 'dense' },
      { id: 'shaft5', depth: 5, name: 'Schacht 5', title: 'Vergessener Förderstollen', zone: 'geode', base: 500, cost: 400000, build: 900, needs: { shaft4: 10 }, start: { haul: 25, store: 10 }, look: 'conveyor' },
      { id: 'shaft6', depth: 6, name: 'Schacht 6', title: 'Kristallresonanz-Kammer', zone: 'geode', base: 1600, cost: 2500000, build: 1800, needs: { shaft5: 10 }, finds: { kind: 'crystals', seconds: 300 }, look: 'resonance' },
      // Beta 1.4 M2: two more zones, generated from one data table (deepShaftSeries) — 14 shafts on Orion
      ...deepShaftSeries('crystal', 7, [
        ['Förderhalle', 'industrial'],
        ['Schienenkreuz', 'industrial'],
        ['Pressenwerk', 'industrial', { finds: { kind: 'ore', seconds: 12 } }],
        ['Schmelzgalerie', 'industrial'],
        ['Echo-Kaverne', 'caverns', { finds: { kind: 'crystals', seconds: 240 } }],
        ['Tropfstein-Dom', 'caverns'],
        ['Kristallsee', 'caverns'],
        ['Tiefe Mutterader', 'caverns', { finds: { kind: 'crystals', seconds: 180 } }]
      ])
    ],
    // Depth bands (visual themes + future content).
    zones: [
      { id: 'amethyst', from: 1, to: 2, name: 'Erste Grabung' },
      { id: 'geode', from: 3, to: 6, name: 'Kristalldrusen' },
      { id: 'industrial', from: 7, to: 10, name: 'Industrietiefen' },
      { id: 'caverns', from: 11, to: 14, name: 'Vergessene Kavernen' },
      { id: 'core', from: 15, to: 30, name: 'Planetenkern', future: true }
    ],
    discovery: 'orion-conduit'
  },
  ice: {
    title: 'Eishöhlen',
    shafts: [
      { id: 'mine', depth: 1, name: 'Schacht 1', title: 'Eiskristall-Ader', zone: 'ice' },
      { id: 'shaft2', depth: 2, name: 'Schacht 2', title: 'Gletscherstollen', zone: 'ice', base: 10, cost: 1200, build: 60, needs: {} }
    ],
    // The existing Frostquarz-Bohrer is shown as its own floor below the shafts (same state, no second source).
    frostFloor: 3,
    zones: [
      { id: 'ice', from: 1, to: 2, name: 'Eishöhlen' },
      { id: 'frost', from: 3, to: 6, name: 'Frostschicht' },
      { id: 'thermal', from: 7, to: 12, name: 'Altes Wärmenetz', future: true }
    ]
  },
  // Pyra-9 (session 8): Schacht 1 is the existing Pyra mine; Schacht 2 mines Glutstein (typed cargo, material
  // 'ember'); the Magmaspalte needs the Glutschmelze's cooling and overheats above Lv 10 until Emberbell is
  // recalibrated; the Alte Wärmekammer opens only after that ("safe new area").
  volcanic: {
    title: 'Glutkammern',
    shafts: [
      { id: 'mine', depth: 1, name: 'Schacht 1', title: 'Basaltader', zone: 'basalt', look: 'basalt' },
      { id: 'shaft2', depth: 2, name: 'Schacht 2', title: 'Glutkristall-Stollen', zone: 'basalt', base: 0.4, cost: 40000, build: 180, needs: {}, material: 'ember', look: 'ember' },
      { id: 'shaft3', depth: 3, name: 'Schacht 3', title: 'Magmaspalte', zone: 'magma', base: 300, cost: 300000, build: 600, needs: { shaft2: 5, foundry: 1 }, look: 'magma', capped: true },
      { id: 'shaft4', depth: 4, name: 'Schacht 4', title: 'Alte Wärmekammer', zone: 'magma', base: 1200, cost: 2500000, build: 1800, needs: { shaft3: 10, emberbell: true }, look: 'heatchamber' }
    ],
    zones: [
      { id: 'basalt', from: 1, to: 2, name: 'Basaltgänge' },
      { id: 'magma', from: 3, to: 6, name: 'Magmagürtel' },
      { id: 'cool', from: 7, to: 12, name: 'Kühle Kavernen', future: true }
    ],
    discovery: 'pyra-console'
  },
  // Mekhanos (cloud slice): Schacht 1 is the existing Mekhanos mine (Mechanische Ader); Schacht 2 mines Präzisionserz
  // (typed cargo, material 'precisionOre') for the Präzisionswerkstatt. Deeper Uhrwerkkern = Cogsworth-9 (future).
  machine: {
    title: 'Zahnwerk-Tiefen',
    shafts: [
      { id: 'mine', depth: 1, name: 'Schacht 1', title: 'Mechanische Ader', zone: 'brass', look: 'gearwork' },
      { id: 'shaft2', depth: 2, name: 'Schacht 2', title: 'Zahnrad-Stollen', zone: 'brass', base: 0.5, cost: 500000, build: 300, needs: {}, material: 'precisionOre', look: 'precision' },
      // Session 9: the Uhrwerkkern (raw; holds Cogsworth's Freigabeschein-Archiv) and the Maschinenkern he seals.
      { id: 'shaft3', depth: 3, name: 'Schacht 3', title: 'Uhrwerkkern', zone: 'clockwork', base: 500, cost: 4000000, build: 900, needs: { shaft2: 5, workshop: 1 }, look: 'clockwork', capped: 'cogsworth' },
      { id: 'shaft4', depth: 4, name: 'Schacht 4', title: 'Reaktivierter Maschinenkern', zone: 'machinecore', base: 2000, cost: 30000000, build: 2400, needs: { shaft3: 10, cogsworth: true }, look: 'machinecore' }
    ],
    zones: [
      { id: 'brass', from: 1, to: 2, name: 'Messinggänge' },
      { id: 'clockwork', from: 3, to: 3, name: 'Uhrwerkkern' },
      { id: 'machinecore', from: 4, to: 4, name: 'Maschinenkern' },
      { id: 'foundations', from: 5, to: 8, name: 'Fundamenthallen', future: true }
    ]
  },
  // Viridia Bloom (session 11): Schacht 1 is the existing mine (Wurzelader); the Leuchtpilz-Grotte needs the Biolabor
  // and its drill waits for Petalguard above Lv 10; the Herzwurzel-Kammer opens only after her repair.
  verdant: {
    title: 'Wurzelgalerien',
    shafts: [
      { id: 'mine', depth: 1, name: 'Schacht 1', title: 'Wurzelader', zone: 'roots', look: 'roots' },
      { id: 'shaft2', depth: 2, name: 'Schacht 2', title: 'Leuchtpilz-Grotte', zone: 'roots', base: 2500, cost: 20000000, build: 1200, needs: { biolab: 1 }, look: 'fungi', capped: 'petalguard' },
      { id: 'shaft3', depth: 3, name: 'Schacht 3', title: 'Herzwurzel-Kammer', zone: 'heartroot', base: 8000, cost: 120000000, build: 2400, needs: { shaft2: 5, petalguard: true }, look: 'heartroot' }
    ],
    zones: [
      { id: 'roots', from: 1, to: 2, name: 'Wurzelgalerien' },
      { id: 'heartroot', from: 3, to: 3, name: 'Herzwurzel' },
      { id: 'seedvault', from: 4, to: 8, name: 'Samengewölbe', future: true }
    ]
  }
};
// Every shaft id any planet defines, in depth order (shaft2 … shaftN). Each colony keeps a state for each of them
// (an unbuilt shaft is a few zeros); workplaces for the generated ids are added to the industry catalogue here.
const SHAFT_IDS = [...new Set(Object.values(DEEP_CORE).flatMap(d => d.shafts.map(s => s.id)))]
  .filter(id => id !== 'mine')
  .sort((a, b) => Number(a.slice(5)) - Number(b.slice(5)));
const ALL_SHAFT_IDS = ['mine', ...SHAFT_IDS];
SHAFT_IDS.forEach(id => {
  if (WORKPLACE[id]) return;
  const n = Number(id.slice(5)),
    w = { id, job: 'mining', name: 'Schacht ' + n, stage: 'Schacht-' + n + '-Abbau', verb: 'ABBAUEN', hire: Math.round(160000 * 4 ** (n - 6)) };
  WORKPLACES.splice(WORKPLACES.findIndex(x => x.id === 'elevator'), 0, w);
  WORKPLACE[id] = w;
});
const UNDERGROUND_OPEN_COST = 500; // ×3 per planet index, free after the first time (account-level survey)

// ----- tuning (all in one place; see the plan for the reasoning) -----
const KISTE = 40; // one kitten crate = 40 Rohkristalle; the elevator starts with one crate
const LIFT = { floor: 5, floorMin: 0.35, door: 0.5, load: 1.5, unload: 1.5, speedCost: 110, capCost: 90, liftTech: 1.2 };
// Beta 1.5: cabin tiers. Deeper shafts multiply output ×3 per depth; the cabin's tracks alone cannot follow (×2 per 25
// levels at ×41 price), so from Schacht 5 each depth unlocks one cabin tier: ×3 load for half that shaft's construction
// price — the same ratio as the shafts, so carrying a new depth costs a share of the shaft instead of an exponential
// wall. Tier 0 is the old cabin (old saves keep their throughput). Targets and simulation: docs/beta-1-5/DEEP_MINING_2.md.
const LIFT_TIER = { from: 5, mult: 3, price: 12 };
const LIFT_TIER_NAMES = ['Grubenkabine', 'Schwerlastkabine', 'Doppeldeck-Kabine', 'Lastenkorb', 'Druckkabine', 'Tiefenkabine', 'Kavernenkorb', 'Panzerkabine', 'Kristallkorb', 'Kernkabine', 'Mutterkabine'];
const CARRY = { collect: 0.5, carry: 2, deposit: 0.5, back: 2, maxWait: 3, maxCarriers: 4 };
const CARRY_PERIOD = CARRY.collect + CARRY.carry + CARRY.deposit + CARRY.back;
const HAND = { walk: 1.2, mine: 1.5, collect: 0.3, carry: 1.5, deposit: 0.4, queue: 3, seconds: 3 };
const TRACKS = ['drill', 'crew', 'haul', 'store'];
const TRACK_INFO = {
  drill: { name: 'Bohrer', icon: '⛏', what: 'Abbauleistung der Maschinen' },
  crew: { name: 'Arbeiter-Kätzchen', icon: '🐾', what: 'Abbauleistung der Kätzchen' },
  haul: { name: 'Interner Transport', icon: '🛒', what: 'Transport zur Aufzugsrampe' },
  store: { name: 'Schachtlager', icon: '▦', what: 'Platz an der Aufzugsrampe' }
};
const EPS = 1e-9;

function deepCoreDef(planet = state.activePlanet) {
  return DEEP_CORE[PLANETS[planet]?.id] || null;
}
function shaftDef(id, planet = state.activePlanet) {
  return deepCoreDef(planet)?.shafts.find(s => s.id === id) || null;
}
// Old saves (schema ≤ 27): depot + dock building output becomes a fixed grandfathered Shaft-1 bonus (K26).
function legacyMiningPower(levels) {
  const out = (index, level) => level * defaults.buildings[index].base * buildingMultiplier(level);
  return out(2, levels[2] || 0) + out(3, levels[3] || 0);
}

// ----- state & migration -----
const CARRIER_PHASES = ['collecting', 'carrying', 'depositing', 'waiting_for_space', 'returning'];
const HAND_PHASES = ['idle', 'walking_to_face', 'mining', 'collecting', 'carrying', 'depositing', 'waiting_for_space'];
const LIFT_PHASES = ['surface_idle', 'descending', 'arriving_at_floor', 'loading', 'departing_floor', 'ascending', 'surface_unloading', 'blocked_by_surface_capacity'];
function dcNum(value, fallback = 0, max = 1e300) {
  return Number.isFinite(Number(value)) ? Math.min(max, Math.max(0, Number(value))) : fallback;
}
function normalizeShaftState(raw) {
  const level = key => Math.floor(dcNum(raw?.[key], 0, 100000));
  const carriers = Array.isArray(raw?.carriers)
    ? raw.carriers.slice(0, CARRY.maxCarriers).map(c => ({
        phase: CARRIER_PHASES.includes(c?.phase) ? c.phase : 'returning',
        left: dcNum(c?.left, 0, 60),
        dur: dcNum(c?.dur, 0, 60),
        load: dcNum(c?.load),
        wait: dcNum(c?.wait, 0, 60)
      }))
    : [];
  const m = raw?.manual;
  const build = raw?.build && Number(raw.build.total) > 0 && typeof raw.build.job === 'string' ? { job: raw.build.job.slice(0, 80), total: dcNum(raw.build.total, 60, 1e6), left: dcNum(raw.build.left, 0, 1e6), ads: Math.floor(dcNum(raw.build.ads, 0, 10)) } : null;
  return {
    level: level('level'),
    crew: level('crew'),
    haul: level('haul'),
    store: level('store'),
    face: dcNum(raw?.face),
    platform: dcNum(raw?.platform),
    carriers,
    manual: {
      queue: Math.floor(dcNum(m?.queue, 0, HAND.queue)),
      phase: HAND_PHASES.includes(m?.phase) ? m.phase : 'idle',
      left: dcNum(m?.left, 0, 60),
      dur: dcNum(m?.dur, 0, 60),
      load: dcNum(m?.load)
    },
    build
  };
}
function normalizeElevator(raw) {
  const route = Array.isArray(raw?.route) ? raw.route.filter(id => ALL_SHAFT_IDS.includes(id)).slice(0, 20) : [];
  const cargo = {},
    plan = {},
    starve = {};
  ALL_SHAFT_IDS.forEach(id => {
    if (dcNum(raw?.cargo?.[id]) > 0) cargo[id] = dcNum(raw.cargo[id]);
    if (raw?.plan && Number.isFinite(Number(raw.plan[id]))) plan[id] = dcNum(raw.plan[id]);
    if (dcNum(raw?.starve?.[id]) > 0) starve[id] = Math.floor(dcNum(raw.starve[id], 0, 100));
  });
  return {
    speed: Math.floor(dcNum(raw?.speed, 0, 100000)),
    cap: Math.floor(dcNum(raw?.cap, 0, 100000)),
    tier: Math.floor(dcNum(raw?.tier, 0, 100)),
    phase: LIFT_PHASES.includes(raw?.phase) ? raw.phase : 'surface_idle',
    left: dcNum(raw?.left, 0, 3600),
    dur: dcNum(raw?.dur, 0, 3600),
    from: dcNum(raw?.from, 0, 1000),
    to: dcNum(raw?.to, 0, 1000),
    stop: ALL_SHAFT_IDS.includes(raw?.stop) ? raw.stop : null,
    load: dcNum(raw?.load),
    cargo,
    route,
    plan: raw?.plan ? plan : null,
    manual: Boolean(raw?.manual),
    trips: Math.floor(dcNum(raw?.trips, 0, 1e12)),
    emptyStops: Math.floor(dcNum(raw?.emptyStops, 0, 1e12)),
    starve
  };
}
// `migrate` = save from before schema 28 (K26 legacy power); `old` = save from schema 28 (one level per shaft and
// elevator, buffers, wall-clock manual trip) → converted here, sized after loading by `migrateUnderground29`.
function normalizeUnderground(saved, levels, migrate, old) {
  const shafts = {};
  ALL_SHAFT_IDS.forEach(id => (shafts[id] = normalizeShaftState(saved?.shafts?.[id])));
  // shafts of a newer build (ids this build does not know) are kept as they were and never simulated
  const unknownShafts = { ...(saved?.unknownShafts && typeof saved.unknownShafts === 'object' ? saved.unknownShafts : {}) };
  if (saved?.shafts && typeof saved.shafts === 'object') for (const [id, raw] of Object.entries(saved.shafts)) if (!ALL_SHAFT_IDS.includes(id)) unknownShafts[id] = raw;
  shafts.mine.level = 0;
  shafts.mine.crew = 0;
  let elevator = normalizeElevator(saved?.elevator);
  let pending = saved?.pending29 && typeof saved.pending29 === 'object' ? saved.pending29 : null;
  if (old && saved) {
    // schema 28 → 29: buffers become platform stock (never destroyed), a trip in flight becomes a rising cabin.
    shafts.mine.platform = dcNum(saved.mineStock);
    SHAFT_IDS.forEach(id => {
      shafts[id].level = Math.floor(dcNum(saved.shafts?.[id]?.level, 0, 100000));
      shafts[id].platform = dcNum(saved.shafts?.[id]?.stock);
    });
    const trip = saved.elevator?.trip,
      amount = dcNum(trip?.amount);
    elevator = normalizeElevator(null);
    if (amount > 0) Object.assign(elevator, { phase: 'ascending', left: 3, dur: 3, from: 1, to: 0, load: amount, cargo: { mine: amount }, manual: true });
    pending = { elevator: Math.floor(dcNum(saved.elevator?.level, 0, 100000)) };
  }
  return {
    open: Boolean(saved?.open),
    legacyPower: saved ? dcNum(saved.legacyPower) : migrate ? legacyMiningPower(levels) : 0,
    shafts,
    elevator,
    jobs: Math.floor(dcNum(saved?.jobs, 0, 1e9)),
    pending29: pending,
    ...(Object.keys(unknownShafts).length ? { unknownShafts } : {})
  };
}
function normalizeDeepCoreMeta(raw) {
  return {
    surveyed: PLANETS.map((_, i) => Boolean(raw?.surveyed?.[i])),
    discoveries: Array.isArray(raw?.discoveries) ? [...new Set(raw.discoveries.filter(id => typeof id === 'string'))].slice(0, 100) : [],
    tech: { lift: Boolean(raw?.tech?.lift) }
  };
}
function underground(planet = state.activePlanet) {
  return state.colonies[planet]?.underground;
}
function undergroundOpen(planet = state.activePlanet) {
  return Boolean(state.planetsUnlocked[planet] && underground(planet)?.open);
}
function atPlanet(planet, fn) {
  if (planet === state.activePlanet) return fn();
  const previous = state.activePlanet;
  state.activePlanet = planet;
  try {
    return fn();
  } finally {
    state.activePlanet = previous;
  }
}
// Every shaft mines exactly one material (default raw crystals). Faces, carriers, platforms and the cabin's cargo of a
// shaft hold that material, so the identity is never lost on the way up.
function shaftMaterial(id, planet = state.activePlanet) {
  return shaftDef(id, planet)?.material || 'raw';
}
function shaftMultiplier(id, planet = state.activePlanet) {
  const material = shaftMaterial(id, planet);
  return material === 'raw' ? extractionMultiplier() : typeof pyraBoost === 'function' ? pyraBoost(material, planet) : 1;
}
function shaftState(id, planet = state.activePlanet) {
  return underground(planet)?.shafts[id] || null;
}

// ----- shaft tracks (A drill, B crew, C haul, D store) -----
function trackLevel(id, track, planet = state.activePlanet) {
  const colony = state.colonies[planet];
  if (id === 'mine' && track === 'drill') return colony.buildings[0].level;
  if (id === 'mine' && track === 'crew') return colony.buildings[1].level;
  const s = colony.underground?.shafts[id];
  return s ? s[track === 'drill' ? 'level' : track] || 0 : 0;
}
function shaftLevel(id, planet = state.activePlanet) {
  return trackLevel(id, 'drill', planet);
}
function shaftBuilt(id, planet = state.activePlanet) {
  if (id === 'mine') return true;
  return Boolean(shaftDef(id, planet)) && undergroundOpen(planet) && shaftLevel(id, planet) > 0;
}
function shaftUnderConstruction(id, planet = state.activePlanet) {
  return Boolean(id !== 'mine' && undergroundOpen(planet) && shaftState(id, planet)?.build);
}
// Built shafts of a colony in depth order (Shaft 1 always first).
function builtShafts(planet = state.activePlanet) {
  const def = deepCoreDef(planet);
  return (def ? def.shafts : [{ id: 'mine', depth: 1 }]).filter(s => shaftBuilt(s.id, planet));
}
function trackBase(id, track, level, planet = state.activePlanet) {
  const def = shaftDef(id, planet),
    u = def?.base || 0,
    mult = buildingMultiplier(level);
  if (track === 'drill') return id === 'mine' ? level * defaults.buildings[0].base * mult : level * u * mult;
  if (track === 'crew') return id === 'mine' ? level * defaults.buildings[1].base * mult : level * 2 * u * mult;
  if (track === 'haul') return (id === 'mine' ? 6 : 1.5 * u) * (2 + 3 * level) * mult;
  return (id === 'mine' ? 6 : u) * 30 * (1 + level) * mult; // store
}
function trackCost(id, track, planet = state.activePlanet) {
  const level = trackLevel(id, track, planet),
    grow = Math.pow(BALANCE.buildingCostGrowth, level),
    def = shaftDef(id, planet);
  if (id === 'mine' && track === 'drill') return cost(state.colonies[planet].buildings[0]);
  if (id === 'mine' && track === 'crew') return cost(state.colonies[planet].buildings[1]);
  if (id === 'mine') return Math.floor((track === 'haul' ? 80 : 60) * grow);
  if (!def) return Infinity;
  return Math.floor(def.cost * { drill: 1, crew: 2.4, haul: 0.35, store: 0.25 }[track] * grow);
}
// Base mining (units/s before multipliers). Shaft 1 = Kristallmine + Helferhütte + grandfathered legacy power.
function shaftBase(id, planet = state.activePlanet) {
  if (id === 'mine') {
    const colony = state.colonies[planet];
    return buildingOutput(colony.buildings[0]) + buildingOutput(colony.buildings[1]) + (colony.underground?.legacyPower || 0);
  }
  if (!shaftBuilt(id, planet)) return 0;
  return trackBase(id, 'drill', shaftLevel(id, planet), planet) + trackBase(id, 'crew', trackLevel(id, 'crew', planet), planet);
}
// Raw crystal extraction only (specialty shafts such as Pyra's Glutstein are not crystal output).
function miningBase(planet = state.activePlanet) {
  return builtShafts(planet).reduce((sum, s) => sum + (shaftMaterial(s.id, planet) === 'raw' ? shaftBase(s.id, planet) : 0), 0);
}
// Potential mining of a shaft in units/s (multipliers of the colony in context, manager training included).
function shaftMining(id, planet = state.activePlanet) {
  return shaftBase(id, planet) * shaftMultiplier(id, planet) * workplaceEfficiency(id, planet) * (typeof techShaftFactor === 'function' ? techShaftFactor() : 1) * (typeof coreShaftFactor === 'function' ? coreShaftFactor(planet) : 1);
}
function shaftTransport(id, planet = state.activePlanet) {
  if (!undergroundOpen(planet)) return Infinity;
  return trackBase(id, 'haul', trackLevel(id, 'haul', planet), planet) * shaftMultiplier(id, planet) * workplaceEfficiency(id, planet) * (typeof cogsworthBoost === 'function' ? cogsworthBoost('haul', planet) : 1);
}
// Platform capacity (Schachtlager at the elevator).
function shaftCapacity(id, planet = state.activePlanet) {
  return trackBase(id, 'store', trackLevel(id, 'store', planet), planet) * (shaftMaterial(id, planet) === 'raw' ? extractionMultiplier() : 1);
}
// Steady automated output estimate: mining, limited by the internal transport while the mine is open.
function shaftRate(id, planet = state.activePlanet) {
  return Math.min(shaftMining(id, planet), shaftTransport(id, planet));
}
function shaftStock(id, planet = state.activePlanet) {
  return shaftState(id, planet)?.platform || 0;
}
function carrierCount(id, planet = state.activePlanet) {
  return 1 + Math.min(CARRY.maxCarriers - 1, Math.floor(trackLevel(id, 'haul', planet) / 10));
}
function carrierLoad(id, planet = state.activePlanet) {
  return (shaftTransport(id, planet) * CARRY_PERIOD) / carrierCount(id, planet);
}
function faceCapacity(id, planet = state.activePlanet) {
  return Math.max(20, 2 * carrierLoad(id, planet), 8 * shaftMining(id, planet));
}
// Visible/working miners: one per 5 crew levels (Shaft 1: Helferhütte), at least the drill operator.
function minerCount(id, planet = state.activePlanet) {
  return 1 + Math.min(5, Math.floor(trackLevel(id, 'crew', planet) / 5));
}
// Value of a track at a level, in the unit the sheet shows (units/s, or units for storage).
function trackValue(id, track, level, planet = state.activePlanet) {
  const x = (track === 'store' && shaftMaterial(id, planet) !== 'raw' ? 1 : shaftMultiplier(id, planet)) * (track === 'store' ? 1 : workplaceEfficiency(id, planet));
  if (id === 'mine' && track === 'drill') return (level * defaults.buildings[0].base * buildingMultiplier(level) + (underground(planet)?.legacyPower || 0)) * x;
  return trackBase(id, track, level, planet) * x;
}
// What limits this shaft right now (for the sheet and the bottleneck chip).
function shaftLimit(id, planet = state.activePlanet) {
  const s = shaftState(id, planet);
  if (!undergroundOpen(planet)) return 'mining';
  if (s && s.platform >= shaftCapacity(id, planet) * 0.97) return 'store';
  return shaftTransport(id, planet) < shaftMining(id, planet) * 0.98 ? 'haul' : 'mining';
}
function shaftCost(id, planet = state.activePlanet) {
  return trackCost(id, 'drill', planet);
}
// Why a deeper shaft cannot be built yet (empty string = allowed). Never requires Gems.
function shaftBlocker(id, planet = state.activePlanet) {
  const def = shaftDef(id, planet);
  if (!def || id === 'mine') return '';
  if (!undergroundOpen(planet)) return 'Erst den Förderturm bauen';
  const needs = def.needs || {};
  for (const [key, value] of Object.entries(needs)) {
    if (key === 'depot' && state.colonies[planet].buildings[2].level < value) return 'Lagerhaus Stufe ' + value + ' nötig';
    if (key === 'foundry' && (state.colonies[planet].industry.foundry || 0) < value) return 'Glutschmelze Stufe ' + value + ' nötig (Kühlung)';
    if (key === 'emberbell' && !(typeof emberbellFriendly === 'function' && emberbellFriendly())) return 'Zu heiß – erst Emberbell neu kalibrieren';
    if (key === 'workshop' && (state.colonies[planet].industry.workshop || 0) < value) return 'Präzisionswerkstatt nötig (Bauteile für die Stützen)';
    if (key === 'cogsworth' && !(typeof cogsworthFriendly === 'function' && cogsworthFriendly())) return 'Versiegelt – Freigabe nur durch Cogsworth-9';
    if (key === 'biolab' && (state.colonies[planet].industry.biolab || 0) < value) return 'Biolabor nötig (Biogel festigt die Grotte)';
    if (key === 'petalguard' && !(typeof petalguardFriendly === 'function' && petalguardFriendly())) return 'Von Dornen verschlossen – erst Petalguard heilen';
    if (SHAFT_IDS.includes(key) && shaftLevel(key, planet) < value) return shaftDef(key, planet).name + ' Stufe ' + value + ' nötig';
  }
  const job = constructionJob(planet);
  if (shaftLevel(id, planet) === 0 && job && job.id !== id) return 'Die Bautrupp-Kätzchen bauen gerade ' + shaftDef(job.id, planet).name;
  return '';
}

// ----- elevator -----
function elevatorState(planet = state.activePlanet) {
  return underground(planet)?.elevator || null;
}
// Visual stage level of the cabin/headframe (both tracks together).
function elevatorLevel(planet = state.activePlanet) {
  const e = elevatorState(planet);
  return e ? Math.round((e.speed + e.cap) / 2) : 0;
}
function elevatorDepth(planet = state.activePlanet) {
  return Math.max(1, ...builtShafts(planet).map(s => s.depth || 1));
}
function elevatorCapacity(cap = elevatorState()?.cap || 0, tier = elevatorState()?.tier || 0) {
  return KISTE * (1 + 8 * cap) * buildingMultiplier(cap) * LIFT_TIER.mult ** tier;
}
// The shaft whose construction unlocks the next cabin tier (null = no deeper tier on this planet).
function liftTierShaft(tier, planet = state.activePlanet) {
  return deepCoreDef(planet)?.shafts.find(s => s.depth === LIFT_TIER.from + tier - 1 && s.cost) || null;
}
function liftTierMax(planet = state.activePlanet) {
  return (deepCoreDef(planet)?.shafts || []).filter(s => s.depth >= LIFT_TIER.from && s.cost).length;
}
function liftTierCost(planet = state.activePlanet) {
  const next = liftTierShaft((elevatorState(planet)?.tier || 0) + 1, planet);
  return next ? Math.round(next.cost * LIFT_TIER.price) : Infinity;
}
// null = can be bought (Credits permitting); otherwise the reason in German
function liftTierBlocker(planet = state.activePlanet) {
  const e = elevatorState(planet),
    next = e && liftTierShaft(e.tier + 1, planet);
  if (!e || !undergroundOpen(planet)) return 'Förderturm noch nicht eröffnet';
  if (!next) return 'Höchste Kabinenstufe erreicht';
  if (!shaftBuilt(next.id, planet)) return next.name + ' muss zuerst gebaut sein';
  return null;
}
function upgradeLiftTier(planet = state.activePlanet) {
  if (liftTierBlocker(planet)) return false;
  const price = liftTierCost(planet);
  if (state.credits < price) return false;
  state.credits -= price;
  state.planetOps.investment[planet] += price;
  const e = elevatorState(planet);
  e.tier++;
  GameEvents.emit('upgrade', { planet, index: 'elevator', track: 'tier', level: e.tier, milestone: true, visualStage: true });
  return true;
}
function elevatorFloorTime(speed = elevatorState()?.speed || 0) {
  return Math.max(LIFT.floorMin, LIFT.floor / (1 + 0.15 * speed)) / (state.meta?.deepCore?.tech?.lift ? LIFT.liftTech : 1);
}
// Routing skill of whoever runs the elevator: 0 = by hand, 1–10 = manager training (a specialist counts by rank).
function elevatorTraining(planet = state.activePlanet) {
  if (!isAutomated('elevator', planet)) return 0;
  const special = specialistAt(planet, 'elevator');
  if (special) return Math.min(10, 1 + 2 * specialistRank(special));
  return Math.max(1, colonyAt(planet).staff.elevator || 0);
}
function elevatorLoadTime(planet = state.activePlanet) {
  return LIFT.load * (1 - 0.05 * (Math.max(1, elevatorTraining(planet)) - 1));
}
// Expected round trip serving every built shaft (seconds).
function elevatorCycle(planet = state.activePlanet, speed = elevatorState(planet)?.speed || 0) {
  const stops = Math.max(1, builtShafts(planet).length);
  return 2 * elevatorDepth(planet) * elevatorFloorTime(speed) + stops * (2 * LIFT.door + elevatorLoadTime(planet)) + LIFT.unload;
}
// Throughput estimate (units/s) when every platform has material.
function elevatorRate(planet = state.activePlanet, speed, cap) {
  const e = elevatorState(planet);
  if (!undergroundOpen(planet) || !e) return 0;
  return elevatorCapacity(cap ?? e.cap, e.tier) / elevatorCycle(planet, speed ?? e.speed);
}
function elevatorTrackCost(track, planet = state.activePlanet) {
  const e = elevatorState(planet);
  return Math.floor((track === 'speed' ? LIFT.speedCost : LIFT.capCost) * Math.pow(BALANCE.buildingCostGrowth, e ? e[track] : 0));
}
function openCost(planet = state.activePlanet) {
  return state.meta?.deepCore?.surveyed?.[planet] ? 0 : UNDERGROUND_OPEN_COST * Math.pow(3, planet);
}
// The Förderturm becomes available once the surface chain runs (or the player has earned enough by hand).
function canOpenUnderground(planet = state.activePlanet) {
  if (undergroundOpen(planet) || !deepCoreDef(planet) || !state.planetsUnlocked[planet]) return false;
  const chain = isAutomated('mine', planet) && isAutomated('rail', planet) && (isAutomated('stall', planet) || isAutomated('dock', planet));
  return chain || state.totalEarned >= 5000;
}
function elevatorRightsKept(planet = state.activePlanet) {
  const colony = state.colonies[planet];
  return colony.staff.mine > 0 && (colony.underground.legacyPower > 0 || colony.convertedJobs.includes('mine'));
}

// ----- sizing (opening the mine, schema-29 migration): never cut a running throughput -----
function sizeElevator(planet, need) {
  const e = elevatorState(planet);
  for (let guard = 0; guard < 4000 && elevatorRate(planet) < need; guard++) {
    const base = elevatorRate(planet),
      gainSpeed = elevatorFloorTime(e.speed + 1) < elevatorFloorTime(e.speed) - 1e-6 ? (elevatorRate(planet, e.speed + 1) - base) / elevatorTrackCost('speed', planet) : 0,
      gainCap = (elevatorRate(planet, e.speed, e.cap + 1) - base) / elevatorTrackCost('cap', planet);
    if (gainSpeed > gainCap) e.speed++;
    else e.cap++;
  }
}
function sizeShaftLogistics(id, planet, needRate, needCap) {
  const s = shaftState(id, planet);
  for (let guard = 0; guard < 2000 && shaftTransport(id, planet) < needRate; guard++) s.haul++;
  for (let guard = 0; guard < 2000 && shaftCapacity(id, planet) < needCap; guard++) s.store++;
}
// Shaft 1 + elevator sized so an automated Shaft 1 keeps its throughput (rule of schema 28, kept).
function sizeForOpening(planet) {
  atPlanet(planet, () => {
    if (!isAutomated('mine', planet)) return;
    const need = shaftMining('mine', planet) * 1.05;
    sizeShaftLogistics('mine', planet, need, 0);
    sizeElevator(planet, need);
    sizeShaftLogistics('mine', planet, need, need * elevatorCycle(planet) * 1.5);
  });
}
// Schema 28 → 29, after the whole state is loaded: grant elevator tracks so the new expected throughput is at least
// the old one (old formula incl. manager efficiency and lift tech), and transport/storage per shaft so no shaft
// loses output. Runs once (the marker is removed).
function oldElevatorRate(level, depth, planet) {
  if (level <= 0) return 0;
  const cap = 40 + 60 * level * buildingMultiplier(level),
    cycle = 1.5 + (2 * depth * 0.7) / (1 + 0.04 * level);
  return (cap / cycle) * workplaceEfficiency('elevator', planet) * (state.meta?.deepCore?.tech?.lift ? 1.2 : 1);
}
function migrateUnderground29() {
  state.colonies.forEach((colony, planet) => {
    const u = colony.underground,
      pending = u?.pending29;
    if (!pending) return;
    u.pending29 = null;
    if (!undergroundOpen(planet)) return;
    atPlanet(planet, () => {
      builtShafts(planet).forEach(s => {
        const oldRate = shaftMining(s.id, planet),
          oldCap = 40 + 20 * shaftLevel(s.id, planet) + 15 * oldRate;
        sizeShaftLogistics(s.id, planet, oldRate * 1.05, oldCap);
      });
      sizeElevator(planet, oldElevatorRate(pending.elevator || 0, elevatorDepth(planet), planet));
    });
  });
}

// ----- construction (Shaft 2+; Shaft 1 is the surface mine) -----
function constructionJob(planet = state.activePlanet) {
  const u = underground(planet);
  if (!u) return null;
  const id = SHAFT_IDS.find(sid => u.shafts[sid]?.build);
  return id ? { id, ...u.shafts[id].build } : null;
}
function constructionProgress(id, planet = state.activePlanet) {
  const b = shaftState(id, planet)?.build;
  return b ? Math.min(1, Math.max(0, 1 - b.left / Math.max(1, b.total))) : 0;
}
const CONSTRUCTION_PHASES = [
  [0, 'Vermessung'],
  [0.25, 'Bohrfront'],
  [0.6, 'Stützen & Schienen'],
  [0.85, 'Maschine einbauen']
];
function constructionPhase(progress) {
  return CONSTRUCTION_PHASES.reduce((name, [from, label]) => (progress >= from ? label : name), CONSTRUCTION_PHASES[0][1]);
}
// Shafts finished during offline progress (named in the welcome report; read and cleared by the UI).
const builtWhileAway = [];
// Simulated seconds pass on the job; completion makes the shaft level 1 (it produces from then on).
function advanceConstruction(seconds, planet = state.activePlanet) {
  const u = underground(planet);
  if (!u?.open || !(seconds > 0)) return false;
  let done = false;
  SHAFT_IDS.forEach(id => {
    const s = u.shafts[id],
      b = s?.build;
    if (!b) return;
    b.left = Math.max(0, b.left - seconds);
    if (b.left > EPS) return;
    s.build = null;
    s.level = Math.max(1, s.level);
    // Schacht 5: the forgotten conveyor is repaired together with the tunnel (a real head start for its transport)
    const start = shaftDef(id, planet)?.start;
    if (start) Object.entries(start).forEach(([track, level]) => (s[track] = Math.max(s[track] || 0, level)));
    done = true;
    if (typeof offlineMode !== 'undefined' && offlineMode) builtWhileAway.push(PLANETS[planet].name.split(' ')[0] + ': ' + (shaftDef(id, planet)?.name || 'Schacht'));
    GameEvents.emit('shaft-built', { planet, index: id, shaft: id, level: s.level, milestone: false, visualStage: true });
  });
  return done;
}
// Rewarded ad on a construction job (mock provider in development, Commander Edition without ad).
const CONSTRUCTION_AD = { minLeft: 90, cutShare: 0.5, cutMin: 120, perJob: 3 };
function constructionAdState(planet = state.activePlanet) {
  const job = constructionJob(planet);
  if (!job) return { ok: false, why: 'Keine Baustelle aktiv.' };
  if (job.left <= CONSTRUCTION_AD.minLeft) return { ok: false, why: 'Fast fertig – das lohnt sich nicht.', job };
  if (job.ads >= CONSTRUCTION_AD.perJob) return { ok: false, why: 'Für diese Baustelle schon ' + CONSTRUCTION_AD.perJob + '× beschleunigt.', job };
  return { ok: true, job, cut: Math.min(job.left, Math.max(job.left * CONSTRUCTION_AD.cutShare, CONSTRUCTION_AD.cutMin)) };
}
// Applies one ad reward to exactly the job it was shown for (revalidated; returns false if the job changed).
function applyConstructionAd(planet, jobId) {
  const offer = constructionAdState(planet);
  if (!offer.ok || offer.job.job !== jobId) return false;
  const b = shaftState(offer.job.id, planet).build;
  b.left = Math.max(0, b.left - offer.cut);
  b.ads++;
  if (b.left <= EPS) atPlanet(planet, () => advanceConstruction(EPS, planet));
  return true;
}
// Gem skip: 1 Gem per started 3 minutes of remaining time (at least 1). Shown before, confirmed, revalidated.
function constructionGemCost(planet = state.activePlanet) {
  const job = constructionJob(planet);
  return job ? Math.max(1, Math.ceil(job.left / 180)) : 0;
}
function skipConstructionWithGems(planet, jobId, shownCost) {
  const job = constructionJob(planet),
    price = constructionGemCost(planet);
  if (!job || job.job !== jobId || price > shownCost || state.gems < price) return false;
  state.gems -= price;
  shaftState(job.id, planet).build.left = 0;
  atPlanet(planet, () => advanceConstruction(EPS, planet));
  return true;
}

// ----- player actions (logic only; the UI layer adds toasts and sounds) -----
function openUnderground(planet = state.activePlanet) {
  if (!canOpenUnderground(planet)) return false;
  const price = openCost(planet);
  if (state.credits < price) return false;
  state.credits -= price;
  state.planetOps.investment[planet] += price;
  const u = underground(planet),
    colony = state.colonies[planet];
  u.open = true;
  // A colony whose mine already ran by itself under the old rules keeps that right: the elevator gets an ordinary
  // operator ("Übernommen"). New colonies learn the elevator and hire its manager themselves (onboarding).
  if (elevatorRightsKept(planet) && !(colony.staff.elevator > 0)) {
    colony.staff.elevator = 1;
    if (!colony.convertedJobs.includes('elevator')) colony.convertedJobs.push('elevator');
  }
  sizeForOpening(planet);
  state.meta.deepCore.surveyed[planet] = true;
  GameEvents.emit('underground-open', { planet });
  return true;
}
// First purchase of a deeper shaft starts its construction; afterwards the same button upgrades the drill (A).
function buildShaft(id, planet = state.activePlanet) {
  if (id === 'mine' || !shaftDef(id, planet) || shaftBlocker(id, planet)) return false;
  const s = shaftState(id, planet);
  if (s.build) return false;
  if (s.level > 0) return upgradeShaftTrack(id, 'drill', planet);
  const price = shaftCost(id, planet);
  if (state.credits < price) return false;
  state.credits -= price;
  state.planetOps.investment[planet] += price;
  const u = underground(planet),
    seconds = shaftDef(id, planet).build || 60;
  u.jobs++;
  s.build = { job: planet + ':' + id + ':' + u.jobs + ':' + Date.now().toString(36), total: seconds, left: seconds, ads: 0 };
  GameEvents.emit('construction-start', { planet, shaft: id, seconds });
  return true;
}
// Credit upgrade of one track. Shaft 1's drill/crew are the Kristallmine/Helferhütte (bought through `buy`).
// Pyra's Magmaspalte overheats above Lv 10 until Emberbell is recalibrated (like the Glacies frost cap); Mekhanos'
// Uhrwerkkern drill needs Cogsworth's permit above Lv 10. `capped: true` = Emberbell (session 8), else the guardian id.
function shaftCapReached(id, planet = state.activePlanet) {
  const capped = shaftDef(id, planet)?.capped;
  if (!capped) return false;
  const friendly =
    capped === 'cogsworth'
      ? typeof cogsworthFriendly === 'function' && cogsworthFriendly()
      : capped === 'petalguard'
        ? typeof petalguardFriendly === 'function' && petalguardFriendly()
        : typeof emberbellFriendly === 'function' && emberbellFriendly();
  return !friendly && shaftLevel(id, planet) >= (capped === 'cogsworth' ? MEKHANOS_LEVEL_CAP : capped === 'petalguard' ? VIRIDIA_LEVEL_CAP : PYRA_LEVEL_CAP);
}
function upgradeShaftTrack(id, track, planet = state.activePlanet) {
  if (!TRACKS.includes(track) || !undergroundOpen(planet) || !shaftBuilt(id, planet)) return false;
  if (track === 'drill' && shaftCapReached(id, planet)) return false;
  if (id === 'mine' && (track === 'drill' || track === 'crew')) return false;
  const price = trackCost(id, track, planet);
  if (state.credits < price) return false;
  state.credits -= price;
  state.planetOps.investment[planet] += price;
  const s = shaftState(id, planet),
    key = track === 'drill' ? 'level' : track;
  s[key]++;
  const level = s[key];
  GameEvents.emit('upgrade', { planet, index: id, shaft: id, track, level, milestone: milestonesReached(level) > milestonesReached(level - 1), visualStage: track === 'drill' && [5, 15, 25, 50].includes(level) });
  return true;
}
function upgradeElevator(track = 'cap', planet = state.activePlanet) {
  if (!undergroundOpen(planet) || !['speed', 'cap'].includes(track)) return false;
  const price = elevatorTrackCost(track, planet);
  if (state.credits < price) return false;
  state.credits -= price;
  state.planetOps.investment[planet] += price;
  elevatorState(planet)[track]++;
  GameEvents.emit('upgrade', { planet, index: 'elevator', track, level: elevatorState(planet)[track], milestone: false, visualStage: [5, 15, 30].includes(elevatorLevel(planet)) });
  return true;
}
// One click = one complete manual work cycle in this shaft (queued, max 3). Material appears only when the kitten
// has mined it and reaches the platform only when she puts it down.
function manualShaft(id, planet = state.activePlanet) {
  if (!undergroundOpen(planet) || !shaftBuilt(id, planet)) return 0;
  const m = shaftState(id, planet).manual;
  if (m.queue >= HAND.queue) return 0;
  m.queue++;
  if (m.phase === 'idle') setPhase(m, 'walking_to_face', HAND.walk);
  GameEvents.emit('shaft-work', { planet, shaft: id, queue: m.queue });
  return m.queue;
}
// Manual elevator: starts one real round trip from the surface (the same state machine the manager uses).
function manualElevator(planet = state.activePlanet) {
  if (!undergroundOpen(planet)) return 0;
  const e = elevatorState(planet);
  if (e.phase !== 'surface_idle') return 0;
  return atPlanet(planet, () => startTrip(planet, true));
}

// ----- the discrete simulation -----
function setPhase(o, phase, seconds) {
  o.phase = phase;
  o.left = seconds;
  o.dur = seconds;
}
// Plans a trip: stocked shafts top to bottom (empty stops skipped); the cabin takes what it can and turns back as soon
// as it is full. Fairness without continuous pulling: room is reserved for deeper stops — untrained (by hand, manager
// Lv 1–2) only for shafts that were left waiting 2 trips (cap / stops each), trained (Lv 3+) for every stop by a
// max-min fair plan (water-filling). From Lv 5 near-empty platforms are skipped unless that shaft waited 3 trips.
const RESERVE_AFTER = 2;
function nearEmpty(capacity) {
  return Math.min(0.05 * capacity, KISTE);
}
function startTrip(planet, manual) {
  const e = elevatorState(planet),
    shafts = builtShafts(planet),
    capacity = elevatorCapacity(e.cap, e.tier),
    training = manual ? 0 : elevatorTraining(planet),
    minStock = training >= 5 ? nearEmpty(capacity) : EPS;
  const stocked = shafts.filter(s => shaftStock(s.id, planet) > EPS);
  const route = stocked.filter(s => shaftStock(s.id, planet) >= minStock || (e.starve[s.id] || 0) >= 3);
  if (!route.length) return 0;
  stocked.forEach(s => {
    if (!route.includes(s)) e.starve[s.id] = (e.starve[s.id] || 0) + 1;
  });
  e.route = route.map(s => s.id);
  if (training >= 3) e.plan = waterFill(route.map(s => [s.id, shaftStock(s.id, planet)]), capacity);
  else {
    e.plan = {};
    route.forEach(s => {
      if ((e.starve[s.id] || 0) >= RESERVE_AFTER) e.plan[s.id] = Math.min(shaftStock(s.id, planet), capacity / route.length);
    });
  }
  e.load = 0;
  e.cargo = {};
  e.manual = Boolean(manual);
  e.from = 0;
  e.to = shaftDef(e.route[0], planet).depth;
  e.stop = null;
  setPhase(e, 'descending', e.to * elevatorFloorTime(e.speed));
  if (!offlineMode) GameEvents.emit('elevator-depart', { planet, stops: e.route.length, manual: Boolean(manual) });
  return e.route.length;
}
function waterFill(stocks, capacity) {
  const plan = Object.fromEntries(stocks.map(([id]) => [id, 0]));
  let left = capacity,
    open = stocks.filter(([, s]) => s > EPS);
  while (left > EPS && open.length) {
    const share = left / open.length;
    const next = [];
    open.forEach(([id, s]) => {
      const take = Math.min(share, s - plan[id]);
      plan[id] += take;
      left -= take;
      if (s - plan[id] > EPS) next.push([id, s]);
    });
    if (next.length === open.length && share <= EPS) break;
    open = next;
  }
  return plan;
}
function loadAtStop(planet, e, id, out) {
  const s = shaftState(id, planet),
    capacity = elevatorCapacity(e.cap, e.tier),
    room = Math.max(0, capacity - e.load),
    later = e.route.slice(1);
  const reserved = later.reduce((sum, other) => sum + Math.min(e.plan?.[other] || 0, shaftStock(other, planet)), 0),
    take = Math.max(0, Math.min(s.platform, room - reserved, room));
  s.platform -= take;
  e.load += take;
  e.cargo[id] = (e.cargo[id] || 0) + take;
  delete e.starve[id];
  if (take < nearEmpty(capacity)) e.emptyStops++;
  out.loaded[id] = (out.loaded[id] || 0) + take;
  return take;
}
// Typed unloading: each material goes to its own receiving store (raw → surface pile, Glutstein → the Glutstein
// store); the cabin waits (blocked) while any part has no room. Nothing changes its material on the way.
// Beta 1.7 M3: what the last trips really carried (runtime, for the elevator sheet: load per trip and use)
const liftTrips = [];
function liftTripLog(planet = state.activePlanet) {
  return liftTrips[planet] || (liftTrips[planet] = { cur: 0, last: [], at: [], clock: 0 });
}
function unloadCabin(planet, e, ctx, out) {
  const colony = state.colonies[planet],
    byMaterial = {};
  Object.entries(e.cargo).forEach(([id, amount]) => {
    const m = shaftMaterial(id, planet);
    (byMaterial[m] = byMaterial[m] || []).push(id);
    byMaterial[m].total = (byMaterial[m].total || 0) + amount;
  });
  let moved = 0;
  Object.entries(byMaterial).forEach(([m, ids]) => {
    const room = m === 'raw' ? ctx.pileCap - colony.stock.pile : (ctx.caps?.[m] ?? 0) - (colony.stock[m] || 0),
      put = Math.max(0, Math.min(ids.total, room));
    if (put <= 0) return;
    if (m === 'raw') colony.stock.pile += put;
    else colony.stock[m] = (colony.stock[m] || 0) + put;
    const share = put / ids.total;
    ids.forEach(id => {
      e.cargo[id] -= e.cargo[id] * share;
      if (e.cargo[id] <= EPS) delete e.cargo[id];
    });
    e.load = Math.max(0, e.load - put);
    moved += put;
    if (m === 'raw') out.lifted += put;
    else out.liftedSpecial[m] = (out.liftedSpecial[m] || 0) + put;
  });
  if (moved > 0 && !offlineMode) GameEvents.emit('elevator-arrived', { planet, amount: moved });
  const log = liftTripLog(planet);
  log.cur += moved;
  if (!Object.keys(e.cargo).length) e.load = 0;
  if (e.load <= EPS) {
    e.load = 0;
    e.cargo = {};
    e.trips++;
    log.last.push(log.cur);
    log.at.push(log.clock);
    if (log.last.length > 12) (log.last.shift(), log.at.shift());
    log.cur = 0;
    e.manual = false;
    setPhase(e, 'surface_idle', 0);
  } else setPhase(e, 'blocked_by_surface_capacity', 0);
}
// Batch of one manual work cycle: Shaft 1 uses the surface harvest roll (critical, ore, alloys, planet loot — once
// per cycle); deeper shafts dig 3 s of their potential output (at least 6 units).
function handBatch(id, planet) {
  if (id === 'mine' && typeof harvestRoll === 'function') return Math.max(harvestRoll().gain, 0);
  if (shaftMaterial(id, planet) !== 'raw') return Math.max(1, HAND.seconds * shaftBase(id, planet) * shaftMultiplier(id, planet));
  return Math.max(6, HAND.seconds * shaftBase(id, planet) * extractionMultiplier());
}
// Numbers of the colony in context that stay constant during one production call.
function undergroundNumbers(planet = state.activePlanet) {
  const auto = colonyAutomation(planet);
  return {
    auto,
    pileCap: pileCapacity(),
    caps: { ember: typeof emberCapacity === 'function' ? emberCapacity() : 0, precisionOre: typeof precisionOreCapacity === 'function' ? precisionOreCapacity() : 0 },
    shafts: builtShafts(planet).map(def => {
      const id = def.id,
        isAuto = Boolean(auto[id]),
        count = carrierCount(id, planet),
        s = shaftState(id, planet);
      while (s.carriers.length < count) {
        const c = { phase: 'returning', left: 0, dur: 0, load: 0, wait: 0 };
        setPhase(c, 'returning', (CARRY_PERIOD * s.carriers.length) / count + 0.01);
        s.carriers.push(c);
      }
      return { id, depth: def.depth, s, auto: isAuto, rate: isAuto ? shaftMining(id, planet) : 0, load: carrierLoad(id, planet), faceCap: faceCapacity(id, planet), cap: shaftCapacity(id, planet) };
    })
  };
}
// Advances the underground of the colony in context by `dt` simulated seconds. Exact event order inside the slice.
function stepUnderground(dt, ctx = undergroundNumbers(), planet = state.activePlanet) {
  const out = { mined: {}, deposited: {}, loaded: {}, lifted: 0, liftedSpecial: {}, manual: 0 };
  if (!undergroundOpen(planet) || !(dt > 0)) return out;
  const e = elevatorState(planet),
    list = ctx.shafts,
    elAuto = Boolean(ctx.auto.elevator);
  const settle = () => {
    let again = true,
      rounds = 0;
    while (again && rounds++ < 64) {
      again = false;
      for (const f of list) {
        const s = f.s;
        for (const c of s.carriers) {
          if (c.phase === 'waiting_for_space') {
            const put = Math.min(c.load, Math.max(0, f.cap - s.platform));
            if (put > EPS) {
              s.platform += put;
              c.load -= put;
              out.deposited[f.id] = (out.deposited[f.id] || 0) + put;
            }
            if (c.load <= EPS) {
              c.load = 0;
              setPhase(c, 'returning', CARRY.back);
              again = true;
            }
            continue;
          }
          if (c.left > EPS) continue;
          if (c.phase === 'collecting') {
            const want = Math.min(f.load, f.faceCap);
            if (f.auto && s.face > EPS && (s.face >= want - EPS || c.wait >= CARRY.maxWait - EPS)) {
              c.load = Math.min(f.load, s.face);
              s.face -= c.load;
              c.wait = 0;
              setPhase(c, 'carrying', CARRY.carry);
              again = true;
            }
          } else if (c.phase === 'carrying') {
            setPhase(c, 'depositing', CARRY.deposit);
            again = true;
          } else if (c.phase === 'depositing') {
            const put = Math.min(c.load, Math.max(0, f.cap - s.platform));
            s.platform += put;
            c.load -= put;
            out.deposited[f.id] = (out.deposited[f.id] || 0) + put;
            if (c.load > EPS) setPhase(c, 'waiting_for_space', 0);
            else {
              c.load = 0;
              setPhase(c, 'returning', CARRY.back);
            }
            again = true;
          } else if (c.phase === 'returning') {
            setPhase(c, 'collecting', CARRY.collect);
            c.wait = 0;
            again = true;
          }
        }
        const m = s.manual;
        if (m.phase === 'waiting_for_space' || (m.phase === 'depositing' && m.left <= EPS)) {
          const put = Math.min(m.load, Math.max(0, f.cap - s.platform));
          if (put > EPS) {
            s.platform += put;
            m.load -= put;
            out.deposited[f.id] = (out.deposited[f.id] || 0) + put;
          }
          if (m.load > EPS) {
            if (m.phase !== 'waiting_for_space') setPhase(m, 'waiting_for_space', 0);
          } else {
            m.load = 0;
            m.queue = Math.max(0, m.queue - 1);
            if (m.queue > 0) setPhase(m, 'walking_to_face', HAND.walk);
            else setPhase(m, 'idle', 0);
            again = true;
          }
        } else if (m.phase !== 'idle' && m.left <= EPS) {
          again = true;
          if (m.phase === 'walking_to_face') setPhase(m, 'mining', HAND.mine);
          else if (m.phase === 'mining') {
            m.load = handBatch(f.id, planet);
            out.manual += m.load;
            ledgerBook('created', planet, shaftMaterial(f.id, planet), m.load);
            setPhase(m, 'collecting', HAND.collect);
            if (!offlineMode) GameEvents.emit('shaft-mined', { planet, shaft: f.id, amount: m.load, manual: true });
          } else if (m.phase === 'collecting') setPhase(m, 'carrying', HAND.carry);
          else if (m.phase === 'carrying') setPhase(m, 'depositing', HAND.deposit);
        }
      }
      // elevator
      if (e.phase === 'surface_idle') {
        if (elAuto && list.some(f => f.s.platform > EPS) && startTrip(planet, false)) again = true;
      } else if (e.phase === 'blocked_by_surface_capacity') {
        const before = e.load;
        unloadCabin(planet, e, ctx, out);
        if (e.load < before - EPS) again = true;
      } else if (e.left <= EPS) {
        again = true;
        const ft = elevatorFloorTime(e.speed);
        if (e.phase === 'descending') {
          e.from = e.to;
          e.stop = e.route[0];
          setPhase(e, 'arriving_at_floor', LIFT.door);
        } else if (e.phase === 'arriving_at_floor') {
          loadAtStop(planet, e, e.route[0], out);
          setPhase(e, 'loading', e.manual ? LIFT.load : elevatorLoadTime(planet));
        } else if (e.phase === 'loading') setPhase(e, 'departing_floor', LIFT.door);
        else if (e.phase === 'departing_floor') {
          e.route.shift();
          e.stop = null;
          const full = e.load >= elevatorCapacity(e.cap, e.tier) - 1e-6;
          if (e.route.length && !full) {
            const next = shaftDef(e.route[0], planet).depth;
            e.to = next;
            setPhase(e, 'descending', Math.abs(next - e.from) * ft);
          } else {
            // stops left out because the cabin is full wait for a later trip (and get a reserve after 2 trips)
            e.route.forEach(id => (e.starve[id] = (e.starve[id] || 0) + 1));
            e.route = [];
            e.plan = null;
            e.to = 0;
            setPhase(e, 'ascending', e.from * ft);
          }
        } else if (e.phase === 'ascending') {
          e.from = 0;
          setPhase(e, 'surface_unloading', LIFT.unload);
        } else if (e.phase === 'surface_unloading') unloadCabin(planet, e, ctx, out);
      }
    }
  };
  let t = 0,
    guard = 0;
  // Beta 1.7 M3: the trip log's clock (simulated seconds) so trip arrivals carry their real time
  const tripLog = liftTripLog(planet),
    clock0 = tripLog.clock;
  settle();
  while (t < dt - EPS && guard++ < 500000) {
    let h = dt - t;
    for (const f of list) {
      const s = f.s;
      for (const c of s.carriers) {
        if (c.phase === 'waiting_for_space') continue;
        if (c.left > EPS) h = Math.min(h, c.left);
        else if (c.phase === 'collecting' && f.auto) {
          const want = Math.min(f.load, f.faceCap);
          if (s.face > EPS) h = Math.min(h, Math.max(EPS, CARRY.maxWait - c.wait));
          if (f.rate > 0 && s.face < f.faceCap) h = Math.min(h, Math.max(EPS, (want - s.face) / f.rate));
        }
      }
      if (s.manual.phase !== 'idle' && s.manual.phase !== 'waiting_for_space') h = Math.min(h, s.manual.left);
    }
    if (!['surface_idle', 'blocked_by_surface_capacity'].includes(e.phase)) h = Math.min(h, e.left);
    h = Math.max(h, 0);
    for (const f of list) {
      const s = f.s;
      if (f.rate > 0 && s.face < f.faceCap) {
        const add = Math.min(f.rate * h, f.faceCap - s.face);
        s.face += add;
        out.mined[f.id] = (out.mined[f.id] || 0) + add;
      }
      for (const c of s.carriers) {
        if (c.left > 0) c.left = Math.max(0, c.left - h);
        else if (c.phase === 'collecting') c.wait += h;
      }
      if (s.manual.left > 0) s.manual.left = Math.max(0, s.manual.left - h);
    }
    if (e.left > 0) e.left = Math.max(0, e.left - h);
    t += h;
    tripLog.clock = clock0 + t;
    settle();
  }
  tripLog.clock = clock0 + dt;
  return out;
}
// Underground stock of one material (faces, kittens, platforms, the cabin's share) — per-material conservation.
function undergroundStockOf(material, planet = state.activePlanet) {
  const u = underground(planet);
  if (!u) return 0;
  return ALL_SHAFT_IDS.reduce((sum, id) => {
    if (shaftMaterial(id, planet) !== material) return sum;
    const s = u.shafts[id];
    return sum + s.face + s.platform + s.manual.load + s.carriers.reduce((a, c) => a + c.load, 0) + (u.elevator.cargo[id] || 0);
  }, 0);
}
// All material of a colony that is underground (faces, kittens, platforms, cabin) — conservation tests, overview.
function undergroundStock(planet = state.activePlanet) {
  const u = underground(planet);
  if (!u) return 0;
  return ALL_SHAFT_IDS.reduce((sum, id) => {
    const s = u.shafts[id];
    return sum + s.face + s.platform + s.manual.load + s.carriers.reduce((a, c) => a + c.load, 0);
  }, 0) + u.elevator.load;
}

// ----- visual stages (shared by the scene and the sheets) -----
const SHAFT_STAGES = [
  [1, 'Handwerkzeug'],
  [5, 'Bohrhammer'],
  [15, 'Industriebohrer'],
  [25, 'Schwerbagger mit Förderband'],
  [50, 'Kristall-Extraktor']
];
function shaftStage(level) {
  return SHAFT_STAGES.reduce((stage, [from], i) => (level >= from ? i + 1 : stage), 1);
}
function nextShaftStage(level) {
  return SHAFT_STAGES.find(([from]) => from > level) || null;
}
const HAUL_STAGES = [
  [0, 'Kisten tragen'],
  [10, 'Schubkarren'],
  [25, 'Grubenlore'],
  [50, 'Förderband']
];
function haulStage(level) {
  return HAUL_STAGES.reduce((stage, [from], i) => (level >= from ? i + 1 : stage), 1);
}
const ELEVATOR_STAGES = [
  [1, 'Kleiner Lastenlift'],
  [5, 'Käfiglift mit Steuerpult'],
  [15, 'Sci-Fi-Frachtlift'],
  [30, 'Zwillingsdeck-Förderanlage']
];
const LIFT_PHASE_TEXT = {
  surface_idle: 'wartet oben',
  descending: 'fährt hinab',
  arriving_at_floor: 'hält',
  loading: 'lädt',
  departing_floor: 'fährt weiter',
  ascending: 'fährt hinauf',
  surface_unloading: 'entlädt',
  blocked_by_surface_capacity: 'Halde voll – wartet'
};

// ----- Orion discovery: the old Schnurrnetz maintenance conduit behind Schacht 3 -----
const CONDUIT_REPAIR = { raw: 400, ore: 80, crystals: 3 };
function conduitState() {
  if (state.meta.deepCore.discoveries.includes('orion-conduit')) return 'repaired';
  return shaftLevel('shaft3', 0) > 0 && undergroundOpen(0) ? 'found' : 'hidden';
}
function conduitMissing() {
  const missing = [];
  if ((state.planetOps.storage[0] || 0) < CONDUIT_REPAIR.raw) missing.push(Math.ceil(CONDUIT_REPAIR.raw - (state.planetOps.storage[0] || 0)) + ' Rohkristalle im Orion-Lager');
  if (state.ore < CONDUIT_REPAIR.ore) missing.push(Math.ceil(CONDUIT_REPAIR.ore - state.ore) + ' Erz');
  if (state.crystals < CONDUIT_REPAIR.crystals) missing.push(CONDUIT_REPAIR.crystals - state.crystals + ' Kristalle');
  return missing;
}
// Repairs once with real goods; reward: the permanent Schnurrnetz-Lift (+20 % elevator travel speed everywhere).
function repairConduit() {
  if (conduitState() !== 'found' || conduitMissing().length) return false;
  state.planetOps.storage[0] -= CONDUIT_REPAIR.raw;
  ledgerBook('destroyed', 0, 'raw', CONDUIT_REPAIR.raw);
  state.ore -= CONDUIT_REPAIR.ore;
  state.crystals -= CONDUIT_REPAIR.crystals;
  state.meta.deepCore.discoveries.push('orion-conduit');
  state.meta.deepCore.tech.lift = true;
  GameEvents.emit('discovery', { id: 'orion-conduit' });
  return true;
}
