// Beta 1.3 — planetary markets: every world pays its own price for the speciality goods at Minka's bazaar (the
// demand profile). The goods tiles compare "hier verkaufen" with the best market a freighter can reach and say what
// that really means: local sale value, destination sale value, the *additional revenue before transport* (fuel and
// flight time are shown next to it — fuel has no Credit price, so no "profit" is claimed), the exact load and the
// limits (freighter hold, free storage at the destination). "Route planen" opens the freight editor prefilled.
// Loaded after bazaar.js, freight-ui.js and income.js — the logic part is pure and used by bazaar.js' sale.
//
// No exploit: goods are never bought, only produced, moved (freight neither creates nor duplicates cargo) and sold once
// at the planet where they lie; factors are bounded (0.85–1.5) and apply to the sale only (contracts keep their price).
// Stabilisation (final Beta-1.3 review): a world's own products sell at the neutral price at home (×1.0, as before
// Beta 1.3) — the first draft's ×0.85 "oversupply" cut early speciality income for players without freight.

const MARKET_OWN = 1.0; // a world's own product at home: neutral
const MARKET_MIN = 0.85,
  MARKET_MAX = 1.5;
const PLANET_MARKETS = {
  // Orion: the trading hub — moderate demand for everything
  crystal: { frost: 1.05, cells: 1.15, ember: 1.1, emberAlloy: 1.2, precisionOre: 1.0, precisionParts: 1.15, spores: 1.1, biogel: 1.1 },
  // Glacies: cold — heat sells (Glutstein, Glutlegierung)
  ice: { ember: 1.4, emberAlloy: 1.25, precisionOre: 1.1, precisionParts: 1.0, spores: 1.0, biogel: 1.1 },
  // Pyra-9: hot — cooling sells (Frostquarz, Thermalzellen)
  volcanic: { frost: 1.5, cells: 1.4, precisionOre: 1.0, precisionParts: 1.2, spores: 0.9, biogel: 1.0 },
  // Mekhanos: machines — alloys and lubricants (Biogel)
  machine: { frost: 1.0, cells: 1.2, ember: 1.1, emberAlloy: 1.45, spores: 1.0, biogel: 1.35 },
  // Viridia: greenhouse — precision parts and warmth
  verdant: { frost: 0.9, cells: 1.25, ember: 1.0, emberAlloy: 1.1, precisionOre: 1.05, precisionParts: 1.45 }
};
const MARKET_HOME = { frost: 'ice', cells: 'ice', ember: 'volcanic', emberAlloy: 'volcanic', precisionOre: 'machine', precisionParts: 'machine', spores: 'verdant', biogel: 'verdant' };

function marketFactor(planet, resource) {
  const id = PLANETS[planet]?.id;
  if (!id || !BAZAAR_SELL_PRICE[resource]) return 1;
  if (MARKET_HOME[resource] === id) return MARKET_OWN;
  const f = PLANET_MARKETS[id]?.[resource] ?? 1;
  return Math.max(MARKET_MIN, Math.min(MARKET_MAX, f));
}
// what one unit fetches at that planet's bazaar right now (Minka's trade manager bonus included)
function marketUnitPrice(planet, resource) {
  return (BAZAAR_SELL_PRICE[resource] || 0) * marketFactor(planet, resource) * bazaarTradeBonus(planet);
}
// Every market a freighter from `from` could serve, for one load: local value vs destination value of exactly that
// load, the additional revenue before transport, fuel, flight time and what limits the load. Unusable destinations
// (no dock, full storage) are listed with their reason instead of being offered.
function shippingOptions(from, resource, stock = materialStock(from, resource)) {
  if (!BAZAAR_SELL_PRICE[resource] || !state.planetsUnlocked[from]) return [];
  const here = marketUnitPrice(from, resource),
    hold = freightDocked(from) ? freightCapacity(from) : 0;
  return PLANETS.map((_, to) => to)
    .filter(to => to !== from && state.planetsUnlocked[to] && state.colonies[to])
    .map(to => {
      const unit = marketUnitPrice(to, resource),
        free = Math.max(0, Math.floor(materialCapacity(to, resource) - materialStock(to, resource))),
        load = Math.max(0, Math.floor(Math.min(stock, hold, free))),
        limit = !freightDocked(from) ? 'Kein Frachtdock hier' : !freightDocked(to) ? 'Kein Frachtdock am Ziel' : free < 1 ? 'Ziel-Lager voll' : stock < 1 ? 'Kein Bestand' : load === hold ? 'Frachtraum' : load === free ? 'Ziel-Lager' : 'Bestand';
      return { to, unit, here, load, hold, free, localValue: here * load, destValue: unit * load, extra: (unit - here) * load, fuel: FREIGHT_FUEL_PER_FLIGHT, seconds: Math.round(freightDuration(from, to) / 1000), usable: freightDocked(from) && freightDocked(to) && load >= 1, limit };
    });
}
// The best usable market with more revenue than selling here (null when there is none).
function bestShipping(from, resource, stock = materialStock(from, resource)) {
  return shippingOptions(from, resource, stock)
    .filter(o => o.usable && o.extra > 0)
    .sort((a, b) => b.extra - a.extra)[0] || null;
}
function flightTimeText(seconds) {
  return seconds >= 60 ? Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0') + ' min' : seconds + ' s';
}

// ----- UI: market line on every goods tile + "Route planen" -----
function marketLineHTML(planet, resource, stock) {
  if (!BAZAAR_SELL_PRICE[resource]) return '';
  const factor = marketFactor(planet, resource),
    here = `<span class="market-here ${factor > 1.05 ? 'up' : factor < 1 ? 'down' : ''}">Hier ×${factor.toFixed(2).replace('.', ',')}${factor > 1.05 ? ' · gefragt' : factor < 1 ? ' · wenig gefragt' : ''}</span>`,
    ship = bestShipping(planet, resource, stock);
  if (!ship) {
    // say why there is no offer when a better market exists but cannot be used right now
    const blocked = shippingOptions(planet, resource, stock).filter(o => !o.usable && o.unit > o.here).sort((a, b) => b.unit - a.unit)[0];
    return `<small class="market-line">${here}${blocked ? `<span class="market-ship">${shortName(blocked.to)} ×${marketFactor(blocked.to, resource).toFixed(2).replace('.', ',')} – ${blocked.limit}</span>` : ''}</small>`;
  }
  const limit = ship.limit === 'Frachtraum' ? '' : ' · begrenzt durch ' + ship.limit;
  return `<small class="market-line" title="Verkauft wird dort im Basar, wenn du die Kolonie besuchst.">${here}<span class="market-ship">${fmt(ship.load)} Stück → ${shortName(ship.to)} ×${marketFactor(ship.to, resource).toFixed(2).replace('.', ',')}: ◈ ${fmt(ship.destValue)} dort · ◈ ${fmt(ship.localValue)} hier</span><span class="market-extra">Mehrerlös vor Transportaufwand: +${fmt(ship.extra)} ◈</span><span class="market-cost">⛽ ${ship.fuel} Treibstoff · Flugzeit ${flightTimeText(ship.seconds)}${limit}</span></small><button class="market-route" data-market-route="${resource}:${ship.to}">ROUTE PLANEN</button>`;
}
function decorateGoods() {
  const grid = $('goodsGrid');
  if (!grid || currentScreen() !== 'trade') return;
  const planet = state.activePlanet;
  grid.querySelectorAll('.goods-tile').forEach(tile => {
    const id = [...tile.classList].find(c => c.startsWith('goods-') && c !== 'goods-tile')?.slice(6);
    if (!id || !BAZAAR_SELL_PRICE[id]) return;
    const stock = materialStock(planet, id),
      html = marketLineHTML(planet, id, stock);
    let box = tile.querySelector('.market-box');
    if (!box) {
      box = document.createElement('div');
      box.className = 'market-box';
      tile.appendChild(box);
    }
    if (box.dataset.html !== html) {
      box.dataset.html = html;
      box.innerHTML = html;
    }
    // the sell button tells the real price on this world (base × market × trade bonus)
    const sell = tile.querySelector('[data-bazaar-sell]');
    if (sell) {
      const text = 'VERKAUFEN · ' + fmt(marketUnitPrice(planet, id)) + ' ◈';
      if (sell.textContent !== text) sell.textContent = text;
    }
  });
}
document.addEventListener('click', event => {
  const plan = event.target.closest('[data-market-route]');
  if (!plan) return;
  const [resource, to] = plan.dataset.marketRoute.split(':');
  const option = shippingOptions(state.activePlanet, resource).find(o => o.to === Number(to));
  Object.assign(routeEditor, { open: true, from: state.activePlanet, to: Number(to), resource, amount: Math.max(1, option?.load || 1), repeat: false });
  renderFreight();
  $('freightPanel')?.scrollIntoView?.({ block: 'start', behavior: document.body.classList.contains('reduce-motion') ? 'auto' : 'smooth' });
});

// ----- galaxy income overview (Galaxie tab): measured sales vs. the automatic estimate (income.js) -----
const BOTTLENECK_SHORT = { mine: 'Abbau', rail: 'Lore', stall: 'Verkauf', dock: 'Verkauf', elevator: 'Aufzug', depot: 'Lager', refinery: 'Raffinerie' };
const bottleneckName = id => BOTTLENECK_SHORT[id] || (/^shaft(\d+)$/.test(id || '') ? 'Schacht ' + id.slice(5) : 'Kette');
function incomeRowNote(r) {
  if (!r.autoSells) return 'Kein Verkaufs-Manager – Erlös nur durch Handverkauf';
  if (r.estimate <= 0) return r.storageFull ? 'Lager voll, nichts fließt zum Verkauf' : 'Automatik steht – ' + bottleneckName(r.bottleneck?.id) + ' prüfen';
  const neck = r.bottleneck && r.bottleneck.id !== 'mine' ? ' · Engpass: ' + bottleneckName(r.bottleneck.id) : '';
  return 'Automatik ≈ ' + fmt(r.estimate) + '/s erwartet' + neck;
}
function renderGalaxyIncome() {
  const card = $('galaxyIncome');
  if (!card) return;
  const g = galaxyIncomeStats();
  if (g.rows.length < 2) {
    card.hidden = true;
    return;
  }
  card.hidden = false;
  const value = r => (r.measured !== null ? r.measured : r.estimate),
    top = Math.max(1e-9, ...g.rows.map(value)),
    total = g.measured !== null ? g.measured : g.estimate;
  setHTML(
    card,
    `<div class="challenge-head"><div><span>GALAXIE · ALLE KOLONIEN</span><h2>Einkommen</h2></div><b>◈ ${incomeLabel(g.measured, g.estimate)}/s</b></div>
    <p class="arsenal-note">${g.measured !== null ? 'Gemessen: Verkaufserlöse der letzten Minute je Kolonie (Automatik, Handverkauf, Basar). Fracht zählt erst beim Verkauf am Ziel.' : 'Messung läuft … bis dahin ≈ Schätzung aus dem automatischen Verkauf.'}</p>
    ${g.rows
      .map(
        r =>
          `<div class="income-row${r.planet === state.activePlanet ? ' here' : ''}">${typeof planetIcon === 'function' ? planetIcon(r.planet, 28) : ''}<b>${shortName(r.planet)}</b><i class="income-bar"><u style="width:${((value(r) / top) * 100).toFixed(1)}%"></u></i><span>◈ ${incomeLabel(r.measured, r.estimate)}/s</span><small>${total > 0 ? Math.round((value(r) / total) * 100) + ' % · ' : ''}${incomeRowNote(r)}${state.routes.some(x => x.from === r.planet || x.to === r.planet) ? ' · ⇄ ' + state.routes.filter(x => x.from === r.planet || x.to === r.planet).length : ''}</small></div>`
      )
      .join('')}`
  );
}
const renderBeforeMarket = render;
render = () => {
  renderBeforeMarket();
  if (currentScreen() === 'trade') {
    decorateGoods();
    renderGalaxyIncome();
  }
  incomePass = null; // the next caller computes fresh numbers
};
