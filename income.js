// Beta 1.3 — honest income numbers. Two different things, never mixed up:
//   measured  = Credits really booked by sales of a colony (automatic stall/dock, hand sales, Minka's bazaar, contracts)
//               during the last minute of live play — read from the game's own 'sale' events (each names its planet).
//               Offline catch-up is not part of it (the offline report shows that), freight never counts (cargo earns
//               only when it is sold at its destination, by that colony).
//   estimate  = what the colony's automatic sales should bring per second right now: the automated sale rate in raw
//               units (automatedIncomeRate: extraction, cart line, stall/dock capacity, depot stock) × the Credits one
//               unit really fetched in the colony's last production step (bars, price bonuses) — "≈", never exact.
// The galaxy card, the top bar and the dock line all read colonyIncomeStats(). Loaded after bazaar.js, before market.js.
// Nothing here changes production, prices or saves (the meter is not saved: after a reload it measures again).

const INCOME_WINDOW_MS = 60000,
  INCOME_BUCKET_MS = 5000,
  INCOME_MIN_MS = 15000; // below this much observed live time there is no "measured" value yet
const incomeLog = []; // per planet: [{ b: bucket index, c: credits }]
let incomeSince = Date.now(),
  incomeLastCheck = Date.now();

function incomeRecord(planet, credits, now = Date.now()) {
  if (!(credits > 0) || !Number.isInteger(planet) || planet < 0) return;
  const list = (incomeLog[planet] ||= []),
    b = Math.floor(now / INCOME_BUCKET_MS),
    last = list[list.length - 1];
  if (last && last.b === b) last.c += credits;
  else list.push({ b, c: credits });
  while (list.length && list[0].b < b - INCOME_WINDOW_MS / INCOME_BUCKET_MS) list.shift();
}
GameEvents.on('sale', event => {
  if (offlineMode) return; // offline catch-up belongs to the offline report
  incomeRecord(Number.isInteger(event.planet) ? event.planet : state.activePlanet, event.credits);
});
// A gap in live play (app hidden, device asleep) invalidates the window: measure from scratch.
function incomeWatch(now = Date.now()) {
  if (now - incomeLastCheck > 5000 || document.hidden) {
    incomeSince = now;
    incomeLog.length = 0;
  }
  incomeLastCheck = now;
}
setInterval(() => incomeWatch(Date.now()), 1000);

// Credits per second really booked by this colony's sales (null while too little live time was observed).
function measuredIncome(planet, now = Date.now()) {
  const observed = Math.min(INCOME_WINDOW_MS, now - incomeSince);
  if (observed < INCOME_MIN_MS) return null;
  const from = Math.floor((now - observed) / INCOME_BUCKET_MS);
  return (incomeLog[planet] || []).reduce((sum, e) => sum + (e.b >= from ? e.c : 0), 0) / (observed / 1000);
}
function colonyIncomeStats(planet) {
  return withPlanet(planet, () => {
    const r = colonyRates(),
      a = colonyAutomation(),
      flow = industryFlow[planet],
      sold = flow ? flow.rawSold + flow.barsSold * BAR_RAW : 0,
      fill = Math.max(0, state.planetOps.storage[planet] || 0) / Math.max(1, r.depotCap),
      perUnit = flow && sold > 0 && flow.credits > 0 ? flow.credits / sold : salePriceMultiplier(fill),
      units = automatedIncomeRate(),
      autoSells = Boolean(a.stall || a.dock);
    return {
      planet,
      autoSells,
      extraction: automatedExtraction(r, a), // automated mining, raw units/s
      transport: a.rail ? r.L : 0, // automated cart line, units/s
      salesCap: (a.stall ? r.S1 : 0) + (a.dock ? r.S2 : 0), // automated sale capacity, units/s
      units, // automated sales, raw-equivalent units/s
      estimate: units * perUnit, // ≈ Credits/s from automatic sales
      measured: measuredIncome(planet), // Credits/s really booked (live, last minute) or null
      storageFull: fill >= 0.98,
      bottleneck: autoSells ? stageBottleneck() : null
    };
  });
}
// one computation per render pass: the top bar and the galaxy card share it (market.js clears it after the card)
let incomePass = null;
function galaxyIncomeStats() {
  return incomePass || computeGalaxyIncomeStats();
}
function computeGalaxyIncomeStats() {
  const rows = PLANETS.map((_, i) => i)
    .filter(i => state.planetsUnlocked[i] && state.colonies[i])
    .map(colonyIncomeStats);
  const measured = rows.every(r => r.measured === null) ? null : rows.reduce((s, r) => s + (r.measured || 0), 0);
  return { rows, measured, estimate: rows.reduce((s, r) => s + r.estimate, 0) };
}
// the number a player sees for "Credits per second": measured when there is a measurement, else the estimate with ≈
function incomeLabel(measured, estimate) {
  return measured !== null && measured !== undefined ? fmt(measured) : '≈' + fmt(estimate);
}

// top bar ("PRO SEKUNDE") and the colony dock line show Credits/s from the same source as the galaxy card
const renderBeforeIncome = render;
render = () => {
  renderBeforeIncome();
  const g = (incomePass = computeGalaxyIncomeStats()),
    top = $('incomeRate');
  if (top) {
    const text = (g.measured !== null ? '+' : '') + incomeLabel(g.measured, g.estimate);
    if (top.textContent !== text) top.textContent = text;
    top.title = g.measured !== null ? 'Verkaufserlöse aller Kolonien, letzte Minute' : 'Geschätzt aus dem automatischen Verkauf (Messung läuft)';
  }
  const out = $('planetOutput');
  if (out) {
    const here = colonyIncomeStats(state.activePlanet),
      text = here.autoSells ? '≈' + fmt(here.estimate) : '0';
    if (out.textContent !== text) out.textContent = text;
  }
};
