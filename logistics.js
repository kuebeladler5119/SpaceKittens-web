// Beta 1.9 M2: Physical Logistics 3.0 – the hand-overs after the depot as real batches (hauls), built like the cart
// line (transport.js). Before, the surface flow (simulateColonyFlow) sold raw, crates and bars and fed the hopper in the
// same step it took them from the depot: a teleport. Now its arithmetic is unchanged, but what it used to sell or feed
// is *dispatched*: it leaves its store (depot, crate store, bar store) and lies in the loading carrier of a leg.
// - Every interval (2.5 s, up to 6 s on long routes) a carrier leaves with what it holds (never empty), travels, unloads for HAUL_UNLOAD s at its
//   target and walks back empty.
// - Targets book in on arrival only:
//   - the market shelf, where customers buy at the stall's sale rate (the sale process; Credits only here);
//   - the Frachtdock pad, where the freighter loads at the dock's rate (sold as it goes into the hold);
//   - the hopper, which takes what fits (plus one second of the refinery's work); the rest waits on the carrier.
// - A leg stops taking dispatches while it holds more than its rate × (2 intervals + travel + unload + 2 s), so no
//   queue grows without bound. In steady state the bound is never reached: the throughput equals the old flow, only a
//   few seconds of latency are added (measured A/B, docs/beta-1-9/PHYSICAL_LOGISTICS.md).
// The material is really on the carriers (colony.haul, saved, default-filled: schema 37 stays). The scene draws exactly
// these runs and loads, inventoryRaw() counts them, the book destroys raw only when it is sold, and offline uses the same
// ≤ 1-s production chunks (10 × 60 s = 1 × 600 s). Loaded after transport.js, before game.js.
const HAUL_INTERVAL = 2.5; // s between departures of a short leg (one carrier is always loading)
const HAUL_INTERVAL_MAX = 6; // a long route sends bigger loads less often (about one departure per 0.9 × the walk)
const HAUL_UNLOAD = 0.6; // s setting the load down at the target
const HAUL_SLACK = 2; // s of extra room in a leg's bound (chunk rounding)
// Legs: source → target, which goods, the building whose level sets the carrier tier, and a fallback travel time (s)
// for a world without these plots.
const HAUL_LEGS = {
  stallRaw: { from: 'depot', to: 'shelf', goods: ['packed', 'raw'], travel: 3, tierOf: 'stall' },
  stallBars: { from: 'refinery', to: 'shelf', goods: ['bars'], travel: 3, tierOf: 'stall' },
  dockRaw: { from: 'depot', to: 'pad', goods: ['packed', 'raw'], travel: 3.5, tierOf: 'dock' },
  dockBars: { from: 'refinery', to: 'pad', goods: ['bars'], travel: 3.5, tierOf: 'dock' },
  feed: { from: 'depot', to: 'hopper', goods: ['raw'], travel: 2.5, tierOf: 'depot' }
};
// The travel time is the route's real length on the planet (PlanetLayouts, kitten widths between the buildings' edges)
// at the carrier's speed. The speed rises with the tier (hand → wheelbarrow → wagon → hover pallet) that the level of
// the served building unlocks: a better route is a faster route. Travel never changes the throughput (a leg's bound
// grows with it), only how long goods are on the way.
const HAUL_SPEED = [1.4, 1.4, 1.8, 2.4, 3.2]; // kitten widths per second by tier
const HAUL_PLOT = { depot: 'depot', refinery: 'refinery', shelf: 'stall', pad: 'dock', hopper: 'refinery' };
const HAUL_EDGES = 3.6; // kitten widths the buildings themselves take at both ends of a route
function haulTier(planet, legId) {
  const c = state.colonies[planet],
    of = HAUL_LEGS[legId].tierOf,
    level = of === 'stall' ? c?.industry?.stall : of === 'dock' ? c?.buildings?.[3]?.level : c?.buildings?.[2]?.level;
  // Beta 1.9 M5: the research Kühlkette lifts every route one tier (at most the hover pallet)
  const bonus = typeof techHas === 'function' && techHas('coldChain') ? 1 : 0;
  return Math.min(4, (typeof cartTier === 'function' ? cartTier(level || 1) : 1) + bonus);
}
// a leg's departure interval: short routes every 2.5 s, long ones less often with bigger loads (fewer carriers on the
// way at the same throughput; the bound grows with it)
function haulInterval(planet, legId) {
  return Math.min(HAUL_INTERVAL_MAX, Math.max(HAUL_INTERVAL, 0.9 * haulTravel(planet, legId)));
}
function haulTravel(planet, legId) {
  const spec = HAUL_LEGS[legId],
    L = typeof PlanetLayouts !== 'undefined' && typeof PLANETS !== 'undefined' && PLANETS[planet] ? PlanetLayouts.layoutFor(PLANETS[planet].id) : null,
    a = L?.plots?.[HAUL_PLOT[spec.from]],
    b = L?.plots?.[HAUL_PLOT[spec.to]];
  if (typeof a !== 'number' || typeof b !== 'number' || a === b) return spec.travel;
  return Math.min(9, Math.max(1.5, (Math.abs(b - a) - HAUL_EDGES) / HAUL_SPEED[haulTier(planet, legId)]));
}
const HAUL_LEG_IDS = Object.keys(HAUL_LEGS);
const HAUL_DEST_LEGS = { shelf: ['stallRaw', 'stallBars'], pad: ['dockRaw', 'dockBars'], hopper: ['feed'] };
const HAUL_GOODS = ['bars', 'packed', 'raw']; // the sale order at a shelf: bars, crates, loose raw (as the old flow)
const HAUL_PHASES = ['moving', 'unloading', 'waiting', 'returning'];
const HAUL_MAX_RUNS = 24;
const haulRawUnits = load => (load.raw || 0) + (load.packed || 0) + (load.bars || 0) * BAR_RAW;
const haulEmptyLoad = () => ({ raw: 0, packed: 0, bars: 0 });

function normalizeHaul(saved) {
  const num = (v, max = 1e300) => (Number.isFinite(Number(v)) ? Math.min(max, Math.max(0, Number(v))) : 0),
    load = l => ({ raw: num(l?.raw), packed: num(l?.packed), bars: num(l?.bars) });
  const legs = {};
  for (const id of HAUL_LEG_IDS) {
    const s = saved?.legs?.[id];
    legs[id] = {
      loading: load(s?.loading),
      wait: s?.wait === undefined ? HAUL_INTERVAL_MAX : num(s.wait, HAUL_INTERVAL_MAX), // a new leg is ready to leave
      runs: Array.isArray(s?.runs)
        ? s.runs
            .filter(r => r && HAUL_PHASES.includes(r.phase))
            .slice(0, HAUL_MAX_RUNS)
            .map(r => ({ id: Math.floor(num(r.id, 1e9)), phase: r.phase, left: num(r.left, 60), dur: Math.max(0.1, num(r.dur, 60) || num(r.left, 60) || 1), load: r.phase === 'returning' ? haulEmptyLoad() : load(r.load) }))
        : []
    };
  }
  return { seq: Math.floor(num(saved?.seq, 1e9)), legs, shelf: load(saved?.shelf), pad: load(saved?.pad) };
}
function colonyHaul(planet = state.activePlanet) {
  const colony = state.colonies[planet];
  if (colony && !colony.haul) colony.haul = normalizeHaul(null);
  return colony?.haul || normalizeHaul(null);
}
// raw units of a leg (its loading carrier and every loaded run)
function haulLegUnits(leg) {
  return haulRawUnits(leg.loading) + leg.runs.reduce((sum, r) => sum + haulRawUnits(r.load), 0);
}
// raw units on the hand-overs of a colony: carriers, the market shelf and the Frachtdock pad (for inventoryRaw)
function haulStock(planet = state.activePlanet) {
  const h = state.colonies[planet]?.haul;
  if (!h) return 0;
  return HAUL_LEG_IDS.reduce((sum, id) => sum + haulLegUnits(h.legs[id]), 0) + haulRawUnits(h.shelf) + haulRawUnits(h.pad);
}
// what a destination holds in raw units (its legs plus its own store) and the bound for its rate
function haulDestUnits(h, to) {
  let sum = to === 'shelf' ? haulRawUnits(h.shelf) : to === 'pad' ? haulRawUnits(h.pad) : 0;
  for (const id of HAUL_DEST_LEGS[to]) sum += haulLegUnits(h.legs[id]);
  return sum;
}
// The walk and the interval of every leg and the bound factors of every destination, computed once per production call
// (levels and research do not change inside a call); without a table they are computed on the spot (panels, views).
const HAUL_DESTS = ['shelf', 'pad', 'hopper'];
function haulTables(planet) {
  const travel = {},
    interval = {},
    span = {};
  for (const id of HAUL_LEG_IDS) {
    travel[id] = haulTravel(planet, id);
    interval[id] = Math.min(HAUL_INTERVAL_MAX, Math.max(HAUL_INTERVAL, 0.9 * travel[id]));
  }
  for (const to of HAUL_DESTS) {
    const legs = HAUL_DEST_LEGS[to];
    span[to] = 2 * Math.max(...legs.map(id => interval[id])) + Math.max(...legs.map(id => travel[id])) + HAUL_UNLOAD + HAUL_SLACK;
  }
  return { travel, interval, span };
}
function haulBound(rate, to, planet = state.activePlanet, tables = null) {
  return rate * (tables || haulTables(planet)).span[to];
}
// The capacities the surface flow may dispatch in a chunk of h seconds: the stall's and the dock's sale rates and the
// hopper feed, each limited by what its legs still have room for. Returns { saleRoom, feedRoom, stallShare }.
function haulRooms(planet, rates, auto, h, tables = null) {
  const hl = colonyHaul(planet),
    t = tables || haulTables(planet),
    room = (rate, to) => Math.max(0, haulBound(rate, to, planet, t) - haulDestUnits(hl, to)),
    stall = auto.stall ? Math.min(rates.S1 * h, room(rates.S1, 'shelf')) : 0,
    dock = auto.dock ? Math.min(rates.S2 * h, room(rates.S2, 'pad')) : 0,
    feed = auto.depot && rates.refineryOn ? Math.min(rates.F * h, room(rates.F, 'hopper')) : 0;
  return { saleRoom: stall + dock, feedRoom: feed, stallShare: stall + dock > 0 ? stall / (stall + dock) : 1 };
}
// Puts what the flow took from its stores into the legs' loading carriers. flow: the result of simulateColonyFlow
// (rawSold/packedSold/barsSold are what it dispatched for sale, fed what it dispatched to the hopper).
function haulDispatch(planet, flow, stallShare) {
  const hl = colonyHaul(planet),
    put = (legId, good, amount) => {
      if (!(amount > 0)) return;
      // a carrier never leaves empty; one that waited a whole interval leaves with the first goods (stepHauls)
      hl.legs[legId].loading[good] += amount;
    };
  const dockShare = 1 - stallShare;
  put('stallRaw', 'packed', flow.packedSold * stallShare);
  put('stallRaw', 'raw', flow.rawSold * stallShare);
  put('stallBars', 'bars', flow.barsSold * stallShare);
  put('dockRaw', 'packed', flow.packedSold * dockShare);
  put('dockRaw', 'raw', flow.rawSold * dockShare);
  put('dockBars', 'bars', flow.barsSold * dockShare);
  put('feed', 'raw', flow.fed);
}
// Advances every leg by `seconds` and runs the sale process at the shelf and the pad. ctx: { S1, S2 (raw units/s the
// stall and the dock sell now; 0 without their manager), hopperLimit (what the hopper may hold when a carrier unloads)
// }. Returns { sold: {raw, packed, bars} (Credits are paid by the caller), fedIn (raw into the hopper), shelfSold and
// padSold (raw units bought by customers / loaded by the freighter, for the scene) }.
function stepHauls(planet, seconds, ctx) {
  const colony = state.colonies[planet],
    hl = colonyHaul(planet),
    tables = ctx.tables || haulTables(planet),
    EPS = 1e-9;
  haulDecay(planet, seconds);
  // a colony without anything on its hand-overs: only the waits run on (no closures, no allocations – offline this is
  // most chunks of a colony without sale or feed managers)
  if (HAUL_LEG_IDS.every(id => !hl.legs[id].runs.length && haulRawUnits(hl.legs[id].loading) <= EPS) && haulRawUnits(hl.shelf) <= EPS && haulRawUnits(hl.pad) <= EPS) {
    for (const id of HAUL_LEG_IDS) hl.legs[id].wait = Math.min(tables.interval[id], hl.legs[id].wait + seconds);
    return { sold: haulEmptyLoad(), fedIn: 0, shelfSold: 0, padSold: 0 };
  }
  let fedIn = 0;
  const unload = (leg, run) => {
    const spec = HAUL_LEGS[leg],
      l = run.load;
    if (spec.to === 'hopper') {
      const put = Math.min(l.raw, Math.max(0, ctx.hopperLimit - colony.stock.hopper));
      if (put > 0) {
        colony.stock.hopper += put;
        l.raw -= put;
        fedIn += put;
      }
    } else {
      const store = spec.to === 'shelf' ? hl.shelf : hl.pad;
      for (const g of HAUL_GOODS) {
        store[g] += l[g];
        l[g] = 0;
      }
    }
    if (haulRawUnits(l) > EPS) run.phase = 'waiting';
    else {
      run.load = haulEmptyLoad();
      run.phase = 'returning';
      run.left = run.dur = tables.travel[leg];
    }
  };
  for (const id of HAUL_LEG_IDS) {
    const leg = hl.legs[id],
      iv = tables.interval[id];
    if (!leg.runs.length && haulRawUnits(leg.loading) <= EPS) {
      leg.wait = Math.min(iv, leg.wait + seconds);
      continue;
    }
    for (const r of leg.runs) if (r.phase === 'waiting') unload(id, r);
    let left = seconds,
      guard = 0;
    while (left > EPS && guard++ < 10000) {
      if (leg.wait >= iv - EPS && haulRawUnits(leg.loading) > EPS && leg.runs.length < HAUL_MAX_RUNS) {
        const travel = tables.travel[id];
        haulCount(planet, id, haulRawUnits(leg.loading));
        leg.runs.push({ id: ++hl.seq, phase: 'moving', left: travel, dur: travel, load: leg.loading });
        leg.loading = haulEmptyLoad();
        leg.wait = 0;
      }
      let h = left;
      if (leg.wait < iv - EPS) h = Math.min(h, iv - leg.wait);
      for (const r of leg.runs) if (r.phase !== 'waiting' && r.left > EPS) h = Math.min(h, r.left);
      leg.wait = Math.min(iv, leg.wait + h);
      for (const r of leg.runs) if (r.phase !== 'waiting') r.left = Math.max(0, r.left - h);
      left -= h;
      // (in place, oldest first; a returned carrier leaves the list – no copy per event, it runs 43,200 times offline)
      for (let i = 0; i < leg.runs.length; i++) {
        const r = leg.runs[i];
        if (r.left > EPS || r.phase === 'waiting') continue;
        if (r.phase === 'moving') {
          r.phase = 'unloading';
          r.left = r.dur = HAUL_UNLOAD;
        } else if (r.phase === 'unloading') unload(id, r);
        else if (r.phase === 'returning') leg.runs.splice(i--, 1);
      }
    }
  }
  // the sale process: customers at the shelf and the freighter at the pad take goods at their rates (bars first)
  const sold = haulEmptyLoad(),
    sell = (store, rate) => {
      let cap = rate * seconds;
      const cap0 = cap;
      for (const g of HAUL_GOODS) {
        if (cap <= EPS) break;
        const per = g === 'bars' ? BAR_RAW : 1,
          take = Math.min(store[g], cap / per);
        if (take > 0) {
          store[g] -= take;
          sold[g] += take;
          cap -= take * per;
        }
      }
      for (const g of HAUL_GOODS) if (store[g] < 1e-12) store[g] = 0;
      return Math.max(0, cap0 - cap);
    };
  const shelfSold = sell(hl.shelf, ctx.S1 || 0),
    padSold = sell(hl.pad, ctx.S2 || 0);
  return { sold, fedIn, shelfSold, padSold };
}
// ----- what the panels show about each route (runtime only, not saved) -----
// A leg's recent throughput: departed raw units, smoothed over about HAUL_RATE_TAU seconds of production.
const HAUL_RATE_TAU = 20;
const HAUL_RATES = []; // per planet: { legId: raw units/s }
function haulCount(planet, id, units) {
  const t = (HAUL_RATES[planet] ||= {});
  t[id] = (t[id] || 0) + units / HAUL_RATE_TAU;
}
// all legs of a planet decay together, once per production chunk
function haulDecay(planet, seconds) {
  const t = HAUL_RATES[planet];
  if (!t) return;
  const f = Math.exp(-seconds / HAUL_RATE_TAU);
  for (const id in t) t[id] *= f;
}
const HAUL_TIER_NAMES = ['', 'von Hand', 'Schubkarre', 'Wagen', 'Schwebepalette'];
const HAUL_TIER_LEVELS = [0, 1, 10, 25, 50];
const HAUL_LEG_NAMES = { stallRaw: 'Lager → Markt', stallBars: 'Raffinerie → Markt', dockRaw: 'Lager → Frachtdock', dockBars: 'Raffinerie → Frachtdock', feed: 'Lager → Raffinerie' };
const HAUL_TIER_BUILDING = { stall: 'Verkaufsstand', dock: 'Frachtdock', depot: 'Lagerhaus' };
// Per route: { id, name, tier, tierName, travel, next ({ name, level, building, travel } | null), out (loaded runs on
// the way), waiting (runs queued at a full target), perRun (raw units of the last departures), rate (raw/s moved
// recently), capacity (raw/s the target takes), use (0..1), store (what the target holds), blocked (text or '') }.
function haulReport(planet = state.activePlanet) {
  const hl = colonyHaul(planet),
    rates = withPlanet(planet, () => ({ shelf: isAutomated('stall') ? stallRate() : 0, pad: isAutomated('dock') ? dockRate() : 0, hopper: isAutomated('depot') && industryLevel('refinery') > 0 ? feedRate() : 0 }));
  return HAUL_LEG_IDS.map(id => {
    const spec = HAUL_LEGS[id],
      leg = hl.legs[id],
      tier = haulTier(planet, id),
      rate = HAUL_RATES[planet]?.[id] || 0,
      cap = rates[spec.to],
      out = leg.runs.filter(r => r.phase !== 'returning').length,
      waiting = leg.runs.filter(r => r.phase === 'waiting').length,
      base = tier - (typeof techHas === 'function' && techHas('coldChain') ? 1 : 0), // the building's own tier
      next = tier < 4 ? { name: HAUL_TIER_NAMES[tier + 1], level: HAUL_TIER_LEVELS[base + 1], building: HAUL_TIER_BUILDING[spec.tierOf] } : null,
      full = cap > 0 && haulDestUnits(hl, spec.to) >= haulBound(cap, spec.to, planet) - 1e-6;
    if (next) next.travel = Math.max(1.5, Math.min(9, haulTravel(planet, id) * (HAUL_SPEED[tier] / HAUL_SPEED[tier + 1])));
    return {
      id,
      name: HAUL_LEG_NAMES[id],
      tier,
      tierName: HAUL_TIER_NAMES[tier],
      travel: haulTravel(planet, id),
      next,
      out,
      waiting,
      perRun: rate * haulInterval(planet, id),
      rate,
      capacity: cap,
      use: cap > 0 ? Math.min(1, rate / cap) : 0,
      store: spec.to === 'shelf' ? haulRawUnits(hl.shelf) : spec.to === 'pad' ? haulRawUnits(hl.pad) : state.colonies[planet]?.stock?.hopper || 0,
      blocked: waiting ? 'wartet am vollen Trichter' : full ? 'Stau: das Ziel nimmt gerade nichts an' : ''
    };
  });
}
// A view of the hand-overs for the scene: every run with its progress, the loading carriers and the stores.
function haulView(planet = state.activePlanet, age = 0) {
  const hl = state.colonies[planet]?.haul;
  if (!hl) return null;
  const legs = {};
  for (const id of HAUL_LEG_IDS) {
    const leg = hl.legs[id],
      spec = HAUL_LEGS[id],
      run = (left, dur) => Math.min(1, Math.max(0, 1 - Math.max(0, left - age) / dur));
    legs[id] = {
      from: spec.from,
      to: spec.to,
      loading: haulRawUnits(leg.loading),
      loadingGoods: { ...leg.loading },
      wait: Math.min(1, (leg.wait + age) / haulInterval(planet, id)),
      runs: leg.runs.map(r => ({
        id: r.id,
        phase: r.phase,
        units: haulRawUnits(r.load),
        goods: r.load.bars > 0 ? 'bars' : r.load.packed > r.load.raw ? 'packed' : 'raw',
        progress: r.phase === 'waiting' ? 1 : run(r.left, r.dur || 1)
      }))
    };
  }
  return { legs, shelf: { ...hl.shelf }, pad: { ...hl.pad }, shelfUnits: haulRawUnits(hl.shelf), padUnits: haulRawUnits(hl.pad) };
}
