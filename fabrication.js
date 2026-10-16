// Beta 1.4 M1 — Industrial economy 2.0 (save schema 37): Fertigung, multi-purpose intermediate goods and supply traders.
//
//   Versorgungshändler (NPC, per world) ──buy──▶ Schrottmetall / Eiswasser ─┐
//   Rohkristalle (depot) · Frostquarz · Thermalzellen (existing chains)    ├─▶ Fertigung orders ─▶ Panzerplatten,
//                                                                          │    Kühlmittel (intermediates, used by
//                                                                          ┘    several recipes and the ship repair)
//   ─▶ Reparatursatz / Rumpfmodul ─▶ sold at any world's market (own demand per world, saturates when flooded) or
//      flown there by the existing freight routes (freight moves goods, never creates them).
//
// Conservation: a batch takes its inputs out of the colony stock when it starts (they are then "in work" on the order),
// and puts the outputs in when it ends — or waits, holding them, while the output store is full. Cancelling an order
// returns inputs that are in work exactly. Goods are whole units. Purchases cost Credits and take trader stock; sales pay
// Credits and remove stock; nothing else creates or destroys goods.
// Anti-arbitrage: purchasable raw goods sell for at most 40 % of their reference value anywhere, while every trader asks at
// least the reference value (more while its stock is low) — buying and reselling always loses. Intermediates and
// products are never sold by traders. Restock and saturation decay advance with simulated seconds (also offline), so
// the result does not depend on how the time is cut into ticks.
// Loaded after campaign.js and before game.js (normalizeState uses the normalisers). Uses globals only when called.

const GOODS = {
  scrap: { name: 'Schrottmetall', icon: '⛓', kind: 'raw', value: 5 },
  water: { name: 'Eiswasser', icon: '≋', kind: 'raw', value: 2 },
  plating: { name: 'Panzerplatten', icon: '▤', kind: 'intermediate', value: 60 },
  coolant: { name: 'Kühlmittel', icon: '❆', kind: 'intermediate', value: 45 },
  repairKit: { name: 'Reparatursatz', icon: '✚', kind: 'product', value: 150 },
  hullModule: { name: 'Rumpfmodul', icon: '⬣', kind: 'product', value: 380 },
  // Beta 1.7 M5: Sternenharz products (Orion)
  starFuel: { name: 'Sternentreibstoff', icon: '⚗', kind: 'intermediate', value: 30 },
  lubricant: { name: 'Funkel-Schmiermittel', icon: '❂', kind: 'intermediate', value: 40 },
  crystalGel: { name: 'Kristallgel', icon: '◇', kind: 'intermediate', value: 70 },
  polymer: { name: 'Sternenpolymer', icon: '⬢', kind: 'product', value: 320 },
  // Beta 1.7 M9: the healed core's crystal (Orion, from core stage 2)
  coreCrystal: { name: 'Kernkristall', icon: '✶', kind: 'product', value: 2000 }
};
const GOOD_IDS = Object.keys(GOODS);
const GOODS_CAP = { raw: 300, intermediate: 60, product: 20 };
const RAW_RESALE = 0.4; // share of the reference value a market pays for purchasable raw goods
// Names of the existing materials a recipe can use (the stock lives where it always did).
const FAB_MATERIAL_NAMES = { raw: ['Rohkristalle', '◆'], bars: ['Kristallbarren', '▰'], frost: ['Frostquarz', '❄'], cells: ['Thermalzellen', '♨'], emberAlloy: ['Glutlegierung', '▣'], resin: ['Sternenharz', '✺'] };
// Recipes: inputs are taken at batch start, `seconds` per batch (before the production manager's speed).
const RECIPES = {
  plating: { name: 'Panzerplatten', out: { plating: 1 }, in: { raw: 20, scrap: 4 }, seconds: 20, uses: 'Reparatursatz, Rumpfmodul, Notreparatur, Schiffsausbau (Panzerung, Schild)' },
  coolant: { name: 'Kühlmittel', out: { coolant: 1 }, in: { frost: 3, water: 5 }, seconds: 15, uses: 'Reparatursatz, Rumpfmodul, Schiffsausbau (Schild, Kühlung)' },
  repairKit: { name: 'Reparatursatz', out: { repairKit: 1 }, in: { plating: 1, coolant: 1 }, seconds: 30, uses: 'Schiffsreparatur, Handel' },
  hullModule: { name: 'Rumpfmodul', out: { hullModule: 1 }, in: { plating: 3, coolant: 2, cells: 1 }, seconds: 60, unlock: { recipe: 'plating', made: 5 }, uses: 'Schwere Panzerung in der Werft, Handel (Mekhanos und Viridia zahlen am meisten)' },
  // Beta 1.7 M5: Sternenharz chemistry (resin from the Orion drill station)
  starFuel: { name: 'Sternentreibstoff', out: { starFuel: 1 }, in: { resin: 8 }, seconds: 12, uses: 'Füllt den Schiffstank auf (1 Einheit = 2 Treibstoff), Handel' },
  lubricant: { name: 'Funkel-Schmiermittel', out: { lubricant: 1 }, in: { resin: 4, scrap: 2 }, seconds: 15, uses: 'Sternenpolymer, Handel' },
  crystalGel: { name: 'Kristallgel', out: { crystalGel: 1 }, in: { resin: 5, raw: 25 }, seconds: 20, uses: 'Sternenpolymer, Handel' },
  polymer: { name: 'Sternenpolymer', out: { polymer: 1 }, in: { crystalGel: 2, lubricant: 1 }, seconds: 40, unlock: { recipe: 'crystalGel', made: 3 }, uses: 'Handel (Mekhanos zahlt am meisten)' },
  coreCrystal: { name: 'Kernkristall', out: { coreCrystal: 1 }, in: { bars: 100, polymer: 1 }, seconds: 90, unlock: { core: 'crystal', stage: 2 }, uses: 'Den Kristallkern erwecken, Kernforschung, Handel' }
};
const RECIPE_IDS = Object.keys(RECIPES);
const FAB_MODES = ['once', 'count', 'target', 'auto'];
const FAB_MAX_ORDERS = 6;
const FAB_LOG = 12;
// Supply traders: what each world sells, how much it holds, how fast it restocks (units/s) and its base price.
const TRADERS = {
  crystal: { scrap: { max: 240, restock: 0.4, price: 6 } },
  ice: { water: { max: 400, restock: 1, price: 2.5 } },
  volcanic: { scrap: { max: 160, restock: 0.3, price: 7 }, water: { max: 80, restock: 0.2, price: 4 } },
  machine: { scrap: { max: 500, restock: 1.2, price: 5 } },
  verdant: { water: { max: 300, restock: 0.8, price: 2 } }
};
// Demand for manufactured goods per world (bounded 0.85–1.5 like the speciality markets).
const GOODS_DEMAND = {
  crystal: { plating: 0.9, coolant: 1.1, repairKit: 1.2, hullModule: 1.0, starFuel: 0.85, lubricant: 0.9, crystalGel: 0.85, polymer: 0.9 },
  ice: { plating: 1.2, coolant: 0.85, repairKit: 1.0, hullModule: 1.1 },
  volcanic: { plating: 1.1, coolant: 1.5, repairKit: 1.3, hullModule: 1.2 },
  machine: { plating: 1.35, coolant: 1.2, repairKit: 1.0, hullModule: 1.45, lubricant: 1.4, polymer: 1.5 },
  verdant: { plating: 1.0, coolant: 1.0, repairKit: 1.15, hullModule: 1.25 }
};
// Selling floods a market: each unit adds 1/depth to its saturation; the price falls to at most half; it recovers with a
// time constant of 10 minutes.
const SAT_DEPTH = { intermediate: 120, product: 40, raw: 400 };
const SAT_TAU = 600;

// ----- normalisers (save schema 37; unknown ids are kept untouched for a later build) -----
function keepCounts(raw, max = 1e12) {
  const out = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw))
    for (const [id, v] of Object.entries(raw)) {
      const n = Number(v);
      if (typeof id === 'string' && id.length <= 40 && Number.isFinite(n)) out[id] = Math.min(max, Math.max(0, n));
    }
  return out;
}
function normalizeGoods(raw) {
  const goods = keepCounts(raw);
  for (const id of GOOD_IDS) goods[id] = Math.floor(goods[id] || 0);
  return goods;
}
function normalizeFab(raw, now = Date.now()) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const seen = new Set();
  const orders = (Array.isArray(src.orders) ? src.orders : [])
    .filter(o => o && typeof o === 'object' && typeof o.recipe === 'string')
    .map(o => ({
      ...o, // unknown fields and unknown recipes of a newer build stay as they are (inert here)
      id: Math.max(1, Math.floor(Number(o.id) || 0)),
      recipe: o.recipe,
      mode: FAB_MODES.includes(o.mode) ? o.mode : 'once',
      count: Math.max(1, Math.min(9999, Math.floor(Number(o.count) || 1))),
      target: Math.max(1, Math.min(1e6, Math.floor(Number(o.target) || 1))),
      made: Math.max(0, Math.floor(Number(o.made) || 0)),
      paused: Boolean(o.paused),
      progress: Math.max(0, Number(o.progress) || 0),
      loaded: Boolean(o.loaded)
    }))
    .filter(o => !seen.has(o.id) && seen.add(o.id))
    .slice(0, FAB_MAX_ORDERS);
  const done = (Array.isArray(src.done) ? src.done : [])
    .filter(d => d && typeof d.recipe === 'string')
    .map(d => ({ recipe: d.recipe, made: Math.max(0, Math.floor(Number(d.made) || 0)), at: Number(d.at) || now }))
    .slice(-RECIPE_IDS.length * 2);
  return { orders, done, reserve: keepCounts(src.reserve, 1e6), seq: Math.max(Math.floor(Number(src.seq) || 0), ...orders.map(o => o.id), 0) };
}
function normalizeTraders(raw) {
  return PLANETS.map((planet, i) => {
    const def = TRADERS[planet.id] || {},
      src = Array.isArray(raw) && raw[i] && typeof raw[i] === 'object' ? raw[i] : {},
      stock = keepCounts(src.stock);
    Object.entries(def).forEach(([id, d]) => (stock[id] = id in stock ? Math.min(d.max, stock[id]) : d.max));
    const log = (Array.isArray(src.log) ? src.log : [])
      .filter(e => e && typeof e.good === 'string' && (e.kind === 'buy' || e.kind === 'sell'))
      .map(e => ({ at: Number(e.at) || 0, kind: e.kind, good: e.good, qty: Math.max(0, Math.floor(Number(e.qty) || 0)), credits: Math.max(0, Number(e.credits) || 0) }))
      .slice(-FAB_LOG);
    return { stock, sat: keepCounts(src.sat, 50), log };
  });
}
function normalizeFabStats(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  return { made: keepCounts(src.made), bought: keepCounts(src.bought), sold: keepCounts(src.sold) };
}

// ----- stock access: goods live in colony.goods, existing materials where they always lived -----
function fabStock(planet, id) {
  if (GOODS[id]) return state.colonies[planet]?.goods?.[id] || 0;
  return materialStock(planet, id);
}
function fabSetStock(planet, id, value) {
  if (GOODS[id]) state.colonies[planet].goods[id] = value;
  else setMaterialStock(planet, id, value);
}
function goodsCapacity(planet, id) {
  const depot = state.colonies[planet]?.buildings?.[2]?.level || 0;
  return Math.floor(GOODS_CAP[GOODS[id].kind] * (1 + 0.1 * Math.min(50, depot)));
}
function fabName(id) {
  return GOODS[id] ? GOODS[id].name : FAB_MATERIAL_NAMES[id]?.[0] || FREIGHT_MATERIALS[id]?.name || id;
}
function fabIcon(id) {
  return GOODS[id] ? GOODS[id].icon : FAB_MATERIAL_NAMES[id]?.[1] || FREIGHT_MATERIALS[id]?.icon || '•';
}
// Freight carries the new goods like any other material (same routes, same rules).
GOOD_IDS.forEach(id => (FREIGHT_MATERIALS[id] = { name: GOODS[id].name, icon: GOODS[id].icon }));
const materialStockBeforeGoods = materialStock,
  setMaterialStockBeforeGoods = setMaterialStock,
  materialCapacityBeforeGoods = materialCapacity;
materialStock = (planet, resource) => (GOODS[resource] ? state.colonies[planet]?.goods?.[resource] || 0 : materialStockBeforeGoods(planet, resource));
setMaterialStock = (planet, resource, value) => (GOODS[resource] ? (state.colonies[planet].goods[resource] = value) : setMaterialStockBeforeGoods(planet, resource, value));
materialCapacity = (planet, resource) => (GOODS[resource] ? goodsCapacity(planet, resource) : materialCapacityBeforeGoods(planet, resource));

// ----- Fertigung -----
const FAB_BUILDINGS = ['refinery', 'thermal', 'foundry', 'workshop', 'biolab'];
function fabOpen(planet = state.activePlanet) {
  const c = state.colonies[planet];
  return Boolean(state.planetsUnlocked[planet] && c && FAB_BUILDINGS.some(id => (c.industry[id] || 0) > 0));
}
// a production manager anywhere in the colony runs automatic orders and speeds batches up by 25 %
function fabManaged(planet = state.activePlanet) {
  return FAB_BUILDINGS.some(id => isAutomated(id, planet));
}
function fabSpeed(planet) {
  return fabManaged(planet) ? 1.25 : 1;
}
function fabLines(planet) {
  const r = state.colonies[planet]?.industry.refinery || 0;
  return 1 + (r >= 10 ? 1 : 0) + (r >= 25 ? 1 : 0) + (typeof techHas === 'function' && techHas('secondLine') ? 1 : 0);
}
function recipeUnlocked(id, planet = state.activePlanet) {
  const r = RECIPES[id];
  if (!r || !fabOpen(planet)) return false;
  // Beta 1.7 M9: a recipe can be the reward of a core stage (on the core's planet)
  if (r.unlock?.core) return typeof coreStage === 'function' && coreStage(r.unlock.core) >= r.unlock.stage && planet === CORES[r.unlock.core].planet;
  return !r.unlock || (state.fabStats?.made?.[r.unlock.recipe] || 0) >= r.unlock.made;
}
function recipeLockText(id, planet = state.activePlanet) {
  const r = RECIPES[id];
  if (!fabOpen(planet)) return 'Braucht ein Produktionsgebäude in dieser Kolonie (z. B. Raffinerie)';
  if (r.unlock?.core) return 'Freischaltung: ' + CORES[r.unlock.core].name + ' Stufe ' + r.unlock.stage + ' (Orion)';
  if (r.unlock) return 'Freischaltung: ' + r.unlock.made + '× ' + RECIPES[r.unlock.recipe].name + ' herstellen (' + Math.floor(state.fabStats?.made?.[r.unlock.recipe] || 0) + '/' + r.unlock.made + ')';
  return '';
}
// what a batch could take right now, honouring the colony's reserves; returns missing amounts per input
function recipeShortfall(id, planet) {
  const r = RECIPES[id],
    reserve = state.colonies[planet].fab.reserve,
    missing = {};
  for (const [input, need] of Object.entries(r.in)) {
    const free = fabStock(planet, input) - (reserve[input] || 0);
    if (free + 1e-9 < need) missing[input] = need - Math.max(0, free);
  }
  return missing;
}
function outputRoom(id, planet) {
  return Object.entries(RECIPES[id].out).every(([good, n]) => fabStock(planet, good) + n <= goodsCapacity(planet, good));
}
function orderFinished(order, planet) {
  if (order.mode === 'once') return order.made >= 1;
  if (order.mode === 'count') return order.made >= order.count;
  if (order.mode === 'target') return fabStock(planet, Object.keys(RECIPES[order.recipe].out)[0]) >= order.target;
  return false; // auto never finishes
}
// an automatic order keeps its output at the target and needs a production manager
function orderWants(order, planet) {
  if (order.paused) return false;
  if (order.mode === 'auto') return fabManaged(planet) && fabStock(planet, Object.keys(RECIPES[order.recipe].out)[0]) < order.target;
  return !orderFinished(order, planet);
}
function fabLog(planet, entry) {
  const fab = state.colonies[planet].fab;
  fab.done.push(entry);
  if (fab.done.length > RECIPE_IDS.length * 2) fab.done.shift();
}
// Beta 1.7 M5: a recipe needs its planet materials here – resin recipes only show where resin exists (Orion) or where
// the colony holds some (e.g. brought by freight)
function recipeAvailableHere(id, planet = state.activePlanet) {
  // (only resin: the older recipes keep showing everywhere, as before)
  return Object.keys(RECIPES[id]?.in || {}).every(input => input !== 'resin' || MATERIALS.resin.planets.includes(PLANETS[planet]?.id) || fabStock(planet, input) > 0);
}
// Beta 1.7 M5: Sternentreibstoff fills the ship's tank. Automatically only while the tank is below half (a reserve for
// scans and expeditions, never past the tank); by hand (TANKEN) up to the full tank. 1 unit = STAR_FUEL_UNITS fuel.
const STAR_FUEL_UNITS = 2;
function refuelFromStarFuel(planet = state.activePlanet, full = false) {
  const goods = state.colonies[planet]?.goods;
  if (!goods || !(goods.starFuel >= 1) || typeof fuelTankCapacity !== 'function') return 0;
  const cap = fuelTankCapacity(),
    room = Math.floor((cap - state.fuel) / STAR_FUEL_UNITS), // never past the full tank
    share = typeof techRefuelShare === 'function' ? techRefuelShare() : 0.5,
    want = full ? room : state.fuel < cap * share ? Math.ceil((cap * share - state.fuel) / STAR_FUEL_UNITS) : 0,
    n = Math.max(0, Math.min(Math.floor(goods.starFuel), want, room));
  if (n <= 0) return 0;
  goods.starFuel -= n;
  state.fuel += n * STAR_FUEL_UNITS;
  ledgerBook('destroyed', planet, 'starFuel', n);
  return n;
}
// Beta 1.7 M2: raw crystals the colony's production orders need for their next batches (one per free line, in order).
// The automatic sale and the hopper feed leave this much in the depot (industry.js rawSaleFloor).
function fabRawDemand(planet = state.activePlanet) {
  return fabDemand(planet, 'raw');
}
// Beta 1.7 M9: the same for any input the automatic sale could take (raw crystals, bars)
function fabDemand(planet, material) {
  const colony = state.colonies[planet];
  if (!colony?.fab?.orders?.length) return 0;
  let lines = fabLines(planet),
    need = 0;
  for (const order of colony.fab.orders) {
    if (lines <= 0) break;
    const r = RECIPES[order.recipe];
    if (!r || order.paused) continue;
    if (order.loaded) {
      lines--;
      // the batch in work already has its inputs; keep the next one ready if the order goes on after it
      const more = order.mode === 'auto' || order.mode === 'target' || (order.mode === 'count' && order.count - order.made > 1);
      if (more) need += r.in[material] || 0;
      continue;
    }
    if (!recipeUnlocked(order.recipe, planet) || !orderWants(order, planet)) continue;
    lines--;
    need += r.in[material] || 0;
  }
  return need;
}
// Advances the colony's orders by `seconds` of production time (event-driven: the same result for any tick size).
function stepFabrication(planet, seconds) {
  const colony = state.colonies[planet];
  if (!colony?.fab || !(seconds > 0)) return;
  const fab = colony.fab,
    speed = fabSpeed(planet);
  let lines = fabLines(planet);
  for (const order of fab.orders.slice()) {
    const r = RECIPES[order.recipe];
    if (!r || order.paused) continue; // a recipe of a newer build is kept, not run; a paused order holds its batch
    if (!order.loaded && (!recipeUnlocked(order.recipe, planet) || !orderWants(order, planet) || Object.keys(recipeShortfall(order.recipe, planet)).length)) continue;
    if (lines <= 0) break;
    lines--;
    let left = seconds;
    while (left > 1e-9) {
      if (!order.loaded) {
        if (!orderWants(order, planet) || Object.keys(recipeShortfall(order.recipe, planet)).length) break;
        for (const [input, need] of Object.entries(r.in)) fabSetStock(planet, input, fabStock(planet, input) - need);
        order.loaded = true;
        order.progress = 0;
      }
      const need = (typeof techRecipeSeconds === 'function' ? techRecipeSeconds(order.recipe) : r.seconds) / speed - order.progress;
      if (left < need) {
        order.progress += left;
        left = 0;
        break;
      }
      left -= need;
      order.progress = (typeof techRecipeSeconds === 'function' ? techRecipeSeconds(order.recipe) : r.seconds) / speed;
      if (!outputRoom(order.recipe, planet)) break; // blocked: holds the finished batch until there is room
      for (const [good, n] of Object.entries(r.out)) fabSetStock(planet, good, fabStock(planet, good) + n);
      // the book: the batch's inputs leave the economy, its output enters it (a loaded batch counts as inventory)
      for (const [input, need] of Object.entries(r.in)) ledgerBook('destroyed', planet, input, need);
      for (const [good, n] of Object.entries(r.out)) ledgerBook('created', planet, good, n);
      order.loaded = false;
      order.progress = 0;
      order.made++;
      state.fabStats.made[order.recipe] = (state.fabStats.made[order.recipe] || 0) + 1;
      if (order.mode !== 'auto' && orderFinished(order, planet)) {
        fab.orders.splice(fab.orders.indexOf(order), 1);
        fabLog(planet, { recipe: order.recipe, made: order.made, at: Date.now() });
        break;
      }
    }
  }
}
function createFabOrder(planet, recipe, mode = 'once', amount = 1) {
  const colony = state.colonies[planet];
  if (!RECIPES[recipe] || !recipeUnlocked(recipe, planet) || !FAB_MODES.includes(mode)) return null;
  if (colony.fab.orders.length >= FAB_MAX_ORDERS || colony.fab.orders.some(o => o.recipe === recipe)) return null;
  const out = Object.keys(RECIPES[recipe].out)[0],
    n = Math.max(1, Math.floor(amount) || 1),
    order = { id: ++colony.fab.seq, recipe, mode, count: mode === 'count' ? n : 1, target: mode === 'target' || mode === 'auto' ? Math.min(n, goodsCapacity(planet, out)) : 1, made: 0, paused: false, progress: 0, loaded: false };
  colony.fab.orders.push(order);
  return order;
}
// Cancelling returns the inputs of a batch in work exactly (even beyond the store limit: nothing is destroyed).
function cancelFabOrder(planet, id) {
  const fab = state.colonies[planet].fab,
    i = fab.orders.findIndex(o => o.id === id);
  if (i < 0) return false;
  const order = fab.orders[i],
    r = RECIPES[order.recipe];
  if (order.loaded && r) for (const [input, need] of Object.entries(r.in)) fabSetStock(planet, input, fabStock(planet, input) + need);
  fab.orders.splice(i, 1);
  return true;
}
function pauseFabOrder(planet, id) {
  const order = state.colonies[planet].fab.orders.find(o => o.id === id);
  if (!order) return false;
  order.paused = !order.paused;
  return true;
}
function setFabReserve(planet, good, units) {
  const reserve = state.colonies[planet].fab.reserve;
  if (units > 0) reserve[good] = Math.floor(units);
  else delete reserve[good];
}
// Display state of a recipe at a colony: locked / available / waiting / producing / blocked / finished.
function recipeState(id, planet = state.activePlanet) {
  const r = RECIPES[id],
    fab = state.colonies[planet].fab,
    order = fab.orders.find(o => o.recipe === id),
    missing = recipeShortfall(id, planet);
  if (!recipeUnlocked(id, planet)) return { state: 'locked', text: recipeLockText(id, planet), order, missing };
  if (order) {
    if (order.loaded && order.progress >= r.seconds / fabSpeed(planet) - 1e-9 && !outputRoom(id, planet)) return { state: 'blocked', text: 'Lager für ' + fabName(Object.keys(r.out)[0]) + ' voll – verkaufen oder verschiffen', order, missing };
    if (order.paused) return { state: 'blocked', text: 'Pausiert', order, missing };
    if (order.mode === 'auto' && !fabManaged(planet)) return { state: 'waiting', text: 'Automatik braucht einen Produktions-Manager', order, missing };
    if (order.loaded) return { state: 'producing', text: 'In Arbeit', order, missing };
    if (order.mode === 'auto' && !orderWants(order, planet)) return { state: 'finished', text: 'Lagerziel erreicht – startet wieder, sobald Bestand fällt', order, missing };
    if (Object.keys(missing).length) return { state: 'waiting', text: 'Wartet auf ' + Object.entries(missing).map(([g, n]) => fmt(Math.ceil(n)) + ' ' + fabName(g)).join(', '), order, missing };
    return { state: 'waiting', text: 'Wartet auf eine freie Fertigungslinie', order, missing };
  }
  const last = [...fab.done].reverse().find(d => d.recipe === id);
  if (Object.keys(missing).length) return { state: 'waiting', text: 'Zutaten fehlen: ' + Object.entries(missing).map(([g, n]) => fmt(Math.ceil(n)) + ' ' + fabName(g)).join(', '), missing, last };
  if (last && Date.now() - last.at < 60000) return { state: 'finished', text: 'Fertig: ' + last.made + '× ' + r.name, missing, last };
  return { state: 'available', text: 'Bereit', missing, last };
}

// ----- supply traders and goods markets -----
function traderOffer(planet, good) {
  return TRADERS[PLANETS[planet]?.id]?.[good] || null;
}
// price of the next unit: the base price, up to +60 % while the trader's shelf is empty
function traderUnitPrice(planet, good, stock = state.traders[planet].stock[good] || 0) {
  const d = traderOffer(planet, good);
  return d ? d.price * (1 + 0.6 * (1 - Math.max(0, Math.min(1, stock / d.max)))) : Infinity;
}
function traderQuote(planet, good, qty) {
  let stock = state.traders[planet].stock[good] || 0,
    cost = 0;
  const n = Math.min(Math.floor(qty), Math.floor(stock));
  for (let i = 0; i < n; i++) {
    cost += traderUnitPrice(planet, good, stock);
    stock--;
  }
  return { qty: n, cost };
}
function traderLog(planet, entry) {
  const log = state.traders[planet].log;
  log.push(entry);
  if (log.length > FAB_LOG) log.shift();
}
// Buy up to `qty` units into the visited colony: limited by trader stock, store room and Credits (never partial pay).
function buyGood(planet, good, qty) {
  if (!traderOffer(planet, good) || !state.planetsUnlocked[planet]) return 0;
  const room = Math.max(0, goodsCapacity(planet, good) - fabStock(planet, good));
  let q = traderQuote(planet, good, Math.min(qty, room));
  while (q.qty > 0 && q.cost > state.credits) q = traderQuote(planet, good, q.qty - 1);
  if (q.qty <= 0) return 0;
  state.credits -= q.cost;
  state.traders[planet].stock[good] -= q.qty;
  fabSetStock(planet, good, fabStock(planet, good) + q.qty);
  ledgerBook('created', planet, good, q.qty);
  state.fabStats.bought[good] = (state.fabStats.bought[good] || 0) + q.qty;
  traderLog(planet, { at: Date.now(), kind: 'buy', good, qty: q.qty, credits: q.cost });
  return q.qty;
}
function goodsDemand(planet, good) {
  if (GOODS[good].kind === 'raw') return RAW_RESALE;
  return Math.max(0.85, Math.min(1.5, GOODS_DEMAND[PLANETS[planet]?.id]?.[good] ?? 1));
}
function goodsUnitPrice(planet, good, sat = state.traders[planet].sat[good] || 0) {
  return GOODS[good].value * goodsDemand(planet, good) * Math.max(0.5, 1 - sat) * bazaarTradeBonus(planet);
}
function goodsSaleQuote(planet, good, qty) {
  let sat = state.traders[planet].sat[good] || 0,
    credits = 0;
  const n = Math.min(Math.floor(qty), Math.floor(fabStock(planet, good))),
    depth = SAT_DEPTH[GOODS[good].kind];
  for (let i = 0; i < n; i++) {
    credits += goodsUnitPrice(planet, good, sat);
    sat += 1 / depth;
  }
  return { qty: n, credits, sat };
}
function sellGood(planet, good, qty) {
  if (!GOODS[good] || !state.planetsUnlocked[planet]) return 0;
  const q = goodsSaleQuote(planet, good, qty);
  if (q.qty <= 0) return 0;
  fabSetStock(planet, good, fabStock(planet, good) - q.qty);
  ledgerBook('destroyed', planet, good, q.qty);
  state.traders[planet].sat[good] = Math.min(50, q.sat);
  earn(q.credits, 'sale:goods');
  state.fabStats.sold[good] = (state.fabStats.sold[good] || 0) + q.qty;
  traderLog(planet, { at: Date.now(), kind: 'sell', good, qty: q.qty, credits: q.credits });
  GameEvents.emit('sale', { credits: q.credits, amount: q.qty, planet, workplace: 'stall', goods: good });
  return q.credits;
}
// best other world to sell a good (by unit price now; freight moves it, the comparison is before transport)
function bestGoodsMarket(from, good) {
  let best = null;
  state.planetsUnlocked.forEach((on, to) => {
    if (!on || to === from || !state.colonies[to]) return;
    const unit = goodsUnitPrice(to, good);
    if (!best || unit > best.unit) best = { to, unit };
  });
  return best;
}
function stepTrader(planet, seconds) {
  const t = state.traders?.[planet];
  if (!t || !(seconds > 0)) return;
  Object.entries(TRADERS[PLANETS[planet].id] || {}).forEach(([good, d]) => (t.stock[good] = Math.min(d.max, (t.stock[good] || 0) + d.restock * seconds)));
  const k = Math.exp(-seconds / SAT_TAU);
  for (const good of Object.keys(t.sat)) {
    t.sat[good] *= k;
    if (t.sat[good] < 1e-6) delete t.sat[good];
  }
}
