// Beta 1.7 M3: the surface cart line as real batches. An automated Lorenbahn moves the Halde's crystals to the depot
// in carts:
// - one cart always stands at the Halde and loads (at most the line's rate);
// - every CART_INTERVAL seconds it leaves with what it holds;
// - it drives CART_TRAVEL seconds, unloads for CART_UNLOAD seconds (only as much as the depot has room for; the rest
//   waits on the cart), then returns empty.
// - QA fix: the depot is a pass-through within a production chunk, as the continuous line was. A cart may tip what
//   the depot's room plus the chunk's outflow (sales, feed, processing: ctx.through) can take; what is still above
//   the depot's capacity after the chunk goes back onto the cart (cartTakeBack). Before, a small Lagerhaus (80 units)
//   capped the whole line at its capacity per second, whatever the sales could take (found by the bot accounts: a
//   colony with sales of 1 362/s sold 80/s).
// Throughput in steady state equals the continuous line of earlier betas (rate × interval per departure), so no
// balance moves. The material is really on the carts (colony.transit, saved): the scene draws exactly these carts and
// loads, the conservation book counts them, and a reload keeps them where they were. A cart never leaves empty; when
// the depot is full the carts queue at the depot, the loading cart fills up and the Halde stops draining
// (back-pressure up to the elevator, as before). Without a rail manager the manual cart (colony.trip) works unchanged.
// Event-driven and step-size independent within a production chunk. Loaded after deepcore.js, before game.js.
const CART_INTERVAL = 2.5; // s between departures (one cart is always loading)
const CART_TRAVEL = 5; // s Halde → depot (and back, empty)
const CART_UNLOAD = 1; // s tipping the load at the depot
const CART_MAX_OUT = 4; // loaded carts on the way / at the depot at most; then the loading cart waits full
// Beta 1.7 M8: research changes the tipping time (Schnellkupplung) and the queue (Ausweichgleis)
function cartUnloadSeconds() {
  return typeof techHas === 'function' && techHas('quickCouple') ? 0.4 : CART_UNLOAD;
}
function cartMaxOut() {
  return typeof techHas === 'function' && techHas('extraCarts') ? 6 : CART_MAX_OUT;
}
const CART_PHASES = ['moving', 'unloading', 'waiting', 'returning'];
function normalizeTransit(saved) {
  const num = (v, max = 1e300) => (Number.isFinite(Number(v)) ? Math.min(max, Math.max(0, Number(v))) : 0);
  const carts = Array.isArray(saved?.carts)
    ? saved.carts
        .filter(c => c && CART_PHASES.includes(c.phase))
        .slice(0, 12)
        .map(c => ({ phase: c.phase, amount: c.phase === 'returning' ? 0 : num(c.amount), left: num(c.left, 60), id: Math.floor(num(c.id, 1e9)) }))
    : [];
  return { loading: num(saved?.loading), wait: num(saved?.wait, CART_INTERVAL), carts, seq: Math.floor(num(saved?.seq, 1e9)) };
}
function colonyTransit(planet = state.activePlanet) {
  const colony = state.colonies[planet];
  if (colony && !colony.transit) colony.transit = normalizeTransit(null);
  return colony?.transit || normalizeTransit(null);
}
// raw crystals on the cart line (loading cart + every loaded cart)
function transitStock(planet = state.activePlanet) {
  const t = state.colonies[planet]?.transit;
  if (!t) return 0;
  return t.loading + t.carts.reduce((sum, c) => sum + c.amount, 0);
}
function cartCapacity(rate) {
  return Math.max(1, rate * CART_INTERVAL);
}
// The visual tier of the line by Lorenbahn level: wheelbarrow kittens → rover → train → robot convoy (art in colony-art)
function cartTier(level) {
  return level >= 50 ? 4 : level >= 25 ? 3 : level >= 10 ? 2 : 1;
}
// Advances the line by `seconds`. ctx: { rate (raw/s), auto (rail manager on duty), depotCap, through (what leaves the
// depot during this step at most) }. Reads and writes the
// colony's Halde (stock.pile) and depot (planetOps.storage). Returns { moved (into the depot), loaded (off the Halde) }.
function stepSurfaceTransport(planet, seconds, ctx) {
  const colony = state.colonies[planet],
    t = colonyTransit(planet),
    cap = cartCapacity(ctx.rate),
    EPS = 1e-9;
  let moved = 0,
    loaded = 0,
    left = seconds,
    guard = 0;
  // a full depot holds the cart that is unloading; the depot only changes outside this step, so one try per call
  const unload = c => {
    const depot = state.planetOps.storage[planet] || 0,
      room = Math.max(0, ctx.depotCap + (ctx.through || 0) - depot),
      put = Math.min(c.amount, room);
    if (put > 0) {
      state.planetOps.storage[planet] = depot + put;
      c.amount -= put;
      moved += put;
    }
    if (c.amount > EPS) c.phase = 'waiting';
    else {
      c.amount = 0;
      c.phase = 'returning';
      c.left = CART_TRAVEL;
    }
  };
  for (const c of t.carts) if (c.phase === 'waiting') unload(c);
  while (left > EPS && guard++ < 10000) {
    const out = t.carts.filter(c => c.phase !== 'returning').length;
    if (ctx.auto && t.wait >= CART_INTERVAL - EPS) {
      if (t.loading > EPS && out < cartMaxOut()) {
        // the interval is over: the cart leaves with what it holds, the next empty cart takes its place
        t.carts.push({ phase: 'moving', amount: t.loading, left: CART_TRAVEL, id: ++t.seq });
        t.loading = 0;
        t.wait = 0;
      } else if (t.loading <= EPS && colony.stock.pile > EPS) t.wait = 0; // it never leaves empty: crystals arrived, a new interval starts
    }
    // the next event: the end of the loading interval, a cart reaching its next phase, or the end of the step
    let h = left;
    if (ctx.auto && t.wait < CART_INTERVAL - EPS) h = Math.min(h, CART_INTERVAL - t.wait);
    for (const c of t.carts) if (c.phase !== 'waiting' && c.left > EPS) h = Math.min(h, c.left);
    // loading at the Halde (the line's rate limits it; a cart holds at most one interval of it)
    if (ctx.auto) {
      const take = Math.min(ctx.rate * h, colony.stock.pile, Math.max(0, cap - t.loading));
      if (take > 0) {
        colony.stock.pile -= take;
        t.loading += take;
        loaded += take;
      }
      t.wait = Math.min(CART_INTERVAL, t.wait + h);
    }
    for (const c of t.carts) if (c.phase !== 'waiting') c.left = Math.max(0, c.left - h);
    left -= h;
    for (const c of t.carts.slice()) {
      if (c.left > EPS || c.phase === 'waiting') continue;
      if (c.phase === 'moving') {
        c.phase = 'unloading';
        c.left = cartUnloadSeconds();
      } else if (c.phase === 'unloading') unload(c);
      else if (c.phase === 'returning') t.carts.splice(t.carts.indexOf(c), 1);
    }
  }
  return { moved, loaded };
}
// What the depot could not keep after a production chunk goes back onto the cart that brought it: the newest cart at
// the depot waits with it (a cart that had just emptied turns back from its return). Nothing is created or lost.
function cartTakeBack(planet, amount) {
  if (!(amount > 0)) return;
  const t = colonyTransit(planet),
    newest = list => list.reduce((best, c) => (!best || c.id > best.id ? c : best), null);
  let cart = newest(t.carts.filter(c => c.phase === 'waiting')) || newest(t.carts.filter(c => c.phase === 'returning'));
  if (!cart) t.carts.push((cart = { phase: 'waiting', amount: 0, left: 0, id: ++t.seq }));
  cart.phase = 'waiting';
  cart.left = 0;
  cart.amount += amount;
}
