// Interplanetary freight (schema 27): real cargo between colonies.
// A route moves one material from an origin colony to a destination colony. Dispatch removes the cargo from the
// origin (it is then "in transit" on the ship), arrival adds it to the destination as far as storage allows (the rest
// waits on the ship), and nothing is ever created or duplicated. Repeated shipments run by themselves only with a
// Logistics manager on duty at the origin's cargo dock; otherwise every flight is dispatched by hand.
// Loaded before game.js; uses game.js / industry.js globals only when called.

const FREIGHT_MATERIALS = {
  raw: { name: 'Rohkristalle', icon: '◆' },
  bars: { name: 'Kristallbarren', icon: '▰' },
  frost: { name: 'Frostquarz', icon: '❄' },
  cells: { name: 'Thermalzellen', icon: '♨' },
  // Pyra-9 (schema 30)
  ember: { name: 'Glutstein', icon: '⬢' },
  emberAlloy: { name: 'Glutlegierung', icon: '▣' },
  // Mekhanos (cloud slice)
  precisionOre: { name: 'Präzisionserz', icon: '⚙' },
  precisionParts: { name: 'Präzisionsbauteile', icon: '⛭' },
  // Viridia Bloom (schema 32)
  spores: { name: 'Leuchtsporen', icon: '✿' },
  biogel: { name: 'Biogel', icon: '◍' }
};
const FREIGHT_MAX_ROUTES = 6;
const FREIGHT_FUEL_PER_FLIGHT = 1;

function normalizeRoutes(raw, planetCount) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  return raw
    .filter(r => r && typeof r === 'object')
    .map(r => ({
      id: Math.max(1, Math.floor(Number(r.id) || 0)),
      from: Math.floor(Number(r.from)),
      to: Math.floor(Number(r.to)),
      resource: FREIGHT_MATERIALS[r.resource] ? r.resource : 'raw',
      amount: Math.max(1, Math.min(1e12, Number(r.amount) || 1)),
      repeat: Boolean(r.repeat),
      paused: Boolean(r.paused),
      status: ['idle', 'transit', 'unloading'].includes(r.status) ? r.status : 'idle',
      cargo: Math.max(0, Number(r.cargo) || 0),
      departAt: Number(r.departAt) || 0,
      arriveAt: Number(r.arriveAt) || 0,
      readyAt: Number(r.readyAt) || 0,
      flights: Math.max(0, Math.floor(Number(r.flights) || 0)),
      delivered: Math.max(0, Number(r.delivered) || 0)
    }))
    .filter(r => r.from !== r.to && r.from >= 0 && r.to >= 0 && r.from < planetCount && r.to < planetCount && !seen.has(r.id) && seen.add(r.id))
    .map(r => (r.status === 'idle' ? { ...r, cargo: 0 } : r))
    .slice(0, FREIGHT_MAX_ROUTES);
}

// ----- stock access per colony (the only place routes touch inventories) -----
function withPlanet(planet, fn) {
  const previous = state.activePlanet;
  state.activePlanet = planet;
  try {
    return fn();
  } finally {
    state.activePlanet = previous;
  }
}
function materialStock(planet, resource) {
  if (resource === 'raw') return state.planetOps.storage[planet] || 0;
  return state.colonies[planet]?.stock?.[resource] || 0;
}
function setMaterialStock(planet, resource, value) {
  if (resource === 'raw') state.planetOps.storage[planet] = value;
  else state.colonies[planet].stock[resource] = value;
}
// Destination storage: depot for raw goods, local stores for products; small import shelves where no building exists.
function materialCapacity(planet, resource) {
  return withPlanet(planet, () => {
    if (resource === 'raw') return storageCapacity();
    if (resource === 'bars') return Math.max(barCapacity(), 40);
    if (resource === 'frost') return Math.max(frostCapacity(), 60);
    if (resource === 'ember') return Math.max(emberCapacity(), 60);
    if (resource === 'emberAlloy') return Math.max(alloyCapacity(), 20);
    if (resource === 'precisionOre') return Math.max(precisionOreCapacity(), 60);
    if (resource === 'precisionParts') return Math.max(partsCapacity(), 20);
    if (resource === 'spores') return Math.max(sporeCapacity(), 60);
    if (resource === 'biogel') return Math.max(biogelCapacity(), 20);
    if (resource === 'resin') return Math.max(resinCapacity(), 40);
    return Math.max(cellCapacity(), 30);
  });
}
function freightDocked(planet) {
  return Boolean(state.planetsUnlocked[planet] && state.colonies[planet]?.buildings[3].level > 0);
}
// Cargo hold per flight: grows with the origin dock and the logistics manager's efficiency.
function freightCapacity(planet) {
  return withPlanet(planet, () => {
    const dock = state.buildings[3].level;
    return Math.floor((50 + 30 * dock * buildingMultiplier(dock)) * (isAutomated('dock') ? workplaceEfficiency('dock') : 1));
  });
}
// Flight time: 75 s per planet step, faster with a bigger origin dock, at least 30 s.
function freightDuration(from, to) {
  const dock = state.colonies[from]?.buildings[3].level || 0;
  return Math.max(30000, (75000 * Math.abs(to - from)) / (1 + 0.02 * dock));
}
function routeAutomated(route) {
  return route.repeat && !route.paused && isAutomated('dock', route.from);
}
function routeProblem(route) {
  if (!state.planetsUnlocked[route.from] || !state.planetsUnlocked[route.to]) return 'Planet nicht besiedelt';
  if (!freightDocked(route.from)) return 'Kein Frachtdock am Start';
  if (!freightDocked(route.to)) return 'Kein Frachtdock am Ziel';
  return '';
}

// ----- create / edit / dispatch -----
function createRoute({ from, to, resource, amount, repeat }) {
  if (state.routes.length >= FREIGHT_MAX_ROUTES) return null;
  const route = normalizeRoutes([{ id: 0, from, to, resource, amount, repeat }], PLANETS.length)[0];
  if (!route || routeProblem(route)) return null;
  route.id = Math.max(0, ...state.routes.map(r => r.id)) + 1;
  route.amount = Math.min(route.amount, freightCapacity(from));
  state.routes.push(route);
  return route;
}
function editRoute(id, changes) {
  const route = state.routes.find(r => r.id === id);
  if (!route) return false;
  if ('repeat' in changes) route.repeat = Boolean(changes.repeat);
  if ('paused' in changes) route.paused = Boolean(changes.paused);
  if ('amount' in changes) route.amount = Math.max(1, Math.min(freightCapacity(route.from), Number(changes.amount) || 1));
  return true;
}
// Only idle routes can be removed (cargo on a ship is never lost by editing).
function deleteRoute(id) {
  const index = state.routes.findIndex(r => r.id === id && r.status === 'idle');
  if (index < 0) return false;
  state.routes.splice(index, 1);
  return true;
}
// Loads real cargo and starts the flight. `full` = only with a full hold (used by automatic repeats).
function dispatchRoute(route, at = Date.now(), full = false) {
  if (route.status !== 'idle' || routeProblem(route) || at < route.readyAt) return 0;
  if (state.fuel < FREIGHT_FUEL_PER_FLIGHT) return 0;
  const stock = materialStock(route.from, route.resource),
    load = Math.min(route.amount, stock);
  if (load <= 0 || (full && load < route.amount)) return 0;
  setMaterialStock(route.from, route.resource, stock - load);
  state.fuel -= FREIGHT_FUEL_PER_FLIGHT;
  const duration = freightDuration(route.from, route.to);
  Object.assign(route, { status: 'transit', cargo: load, departAt: at, arriveAt: at + duration, readyAt: at + duration * 2 });
  GameEvents.emit('freight-depart', { route: route.id, from: route.from, to: route.to, resource: route.resource, amount: load });
  return load;
}
// Advances every route to `now`: arrivals unload (capacity-limited), automated routes re-dispatch with full holds.
// Idempotent: an arrival is processed once because the status changes; loops are bounded.
function processRoutes(now = Date.now()) {
  // Ships that became ready while the app was closed start from the last processed moment (not from "now").
  const since = Math.min(now, state.routesCheckedAt || now);
  for (const route of state.routes) {
    for (let guard = 0; guard < 500; guard++) {
      if (route.status === 'transit' && now >= route.arriveAt) route.status = 'unloading';
      if (route.status === 'unloading') {
        const stock = materialStock(route.to, route.resource),
          put = Math.max(0, Math.min(route.cargo, materialCapacity(route.to, route.resource) - stock));
        if (put > 0) {
          setMaterialStock(route.to, route.resource, stock + put);
          route.cargo -= put;
          route.delivered += put;
          GameEvents.emit('freight-arrive', { route: route.id, from: route.from, to: route.to, resource: route.resource, amount: put });
        }
        if (route.cargo > 1e-9) break; // destination full: the cargo waits on the ship
        route.cargo = 0;
        route.status = 'idle';
        route.flights++;
      }
      if (route.status !== 'idle' || !routeAutomated(route)) break;
      const at = Math.max(route.readyAt, since);
      if (at > now || !dispatchRoute(route, at, true)) break;
    }
  }
  state.routesCheckedAt = now;
}
// Material inventory for UI and tests: per colony stock plus cargo on ships.
function freightInTransit(resource) {
  return state.routes.filter(r => r.resource === resource && r.status !== 'idle').reduce((sum, r) => sum + r.cargo, 0);
}

// ----- Sternenbasar contracts (run state; the done-counter for one-time milestones is account level) -----
const BAZAAR_SLOTS = 3;
const BAZAAR_REFRESH_MS = 8 * 60000;
const BAZAAR_UNIT_VALUE = { raw: 1, bars: 12, frost: 4, cells: 40, ember: 8, emberAlloy: 130, precisionOre: 12, precisionParts: 190, spores: 16, biogel: 520 };
function normalizeBazaar(raw) {
  const contracts = Array.isArray(raw?.contracts)
    ? raw.contracts
        .filter(c => c && (FREIGHT_MATERIALS[c.resource] || (typeof GOODS === 'object' && GOODS[c.resource] && GOODS[c.resource].kind !== 'raw')) && Number.isInteger(c.planet) && Number(c.amount) > 0)
        .slice(0, BAZAAR_SLOTS)
        .map(c => ({
          id: Math.max(1, Math.floor(Number(c.id) || 1)),
          planet: c.planet,
          resource: c.resource,
          amount: Math.ceil(Number(c.amount)),
          credits: Math.max(0, Number(c.credits) || 0),
          bonus: c.bonus && ['fuel', 'crystals', 'alloys'].includes(c.bonus.kind) ? { kind: c.bonus.kind, amount: Math.max(1, Math.floor(c.bonus.amount) || 1) } : null
        }))
    : [];
  return {
    contracts,
    nextId: Math.max(1, Math.floor(Number(raw?.nextId) || 1)),
    refreshAt: Number(raw?.refreshAt) || 0,
    done: Math.max(0, Math.floor(Number(raw?.done) || 0))
  };
}
