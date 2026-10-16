// Beta 1.4 M1 — Raffinerie-Zentrale (one place for every recipe of a colony) and the Versorgungshändler on the Galaxie
// tab. Logic: fabrication.js. Loaded after market.js (wraps the final render / showScreen of the trade screen).

const FAB_STATE_LABEL = { locked: 'GESPERRT', available: 'BEREIT', waiting: 'WARTET', producing: 'IN ARBEIT', blocked: 'BLOCKIERT', finished: 'FERTIG' };
const FAB_MODE_LABEL = { once: '1×', count: '5×', target: 'Bis Lager 10', auto: 'Automatik · hält 10' };
const FAB_MODE_AMOUNT = { once: 1, count: 5, target: 10, auto: 10 };
const fabPick = {}; // chosen order mode per recipe (UI only)
// unit prices below 100 with one decimal (6,5 ◈ instead of a rounded 6)
const fabPrice = n => (n < 100 ? (Math.round(n * 10) / 10).toFixed(1).replace('.', ',').replace(',0', '') : fmt(n));
// The continuous chains of the existing buildings, shown with the same states (they keep their own controls).
const FAB_CHAINS = [
  { id: 'refinery', out: 'bars', made: 'processed', per: BAR_RAW, inputs: 'Rohkristalle aus dem Lager' },
  { id: 'thermal', out: 'cells', made: 'cellsMade', per: 1, inputs: 'Frostquarz + Rohkristalle' },
  { id: 'foundry', out: 'emberAlloy', made: 'alloysMade', per: 1, inputs: 'Glutstein + Rohkristalle' },
  { id: 'workshop', out: 'precisionParts', made: 'partsMade', per: 1, inputs: 'Präzisionserz + Rohkristalle' },
  { id: 'biolab', out: 'biogel', made: 'gelMade', per: 1, inputs: 'Leuchtsporen + Rohkristalle' }
];
function chainState(chain, planet) {
  const level = state.colonies[planet].industry[chain.id] || 0;
  if (!level) return { state: 'locked', text: INDUSTRY_BUILDINGS[chain.id].name + ' noch nicht gebaut' };
  const stock = materialStock(planet, chain.out),
    cap = materialCapacity(planet, chain.out),
    flow = industryFlow[planet],
    made = flow && flow.seconds > 0 ? (flow[chain.made] || 0) / chain.per / flow.seconds : 0;
  if (!isAutomated(chain.id, planet)) return { state: 'available', text: 'Handbetrieb – ein Produktions-Manager lässt es laufen' };
  if (made > 1e-6) return { state: 'producing', text: fmt(made * 60) + ' ' + FREIGHT_MATERIALS[chain.out].name + ' pro Minute' };
  if (chain.id !== 'refinery' && stock >= cap - 1e-6) return { state: 'blocked', text: 'Lager voll (' + fmt(cap) + ')' };
  return { state: 'waiting', text: 'Wartet auf ' + chain.inputs };
}
function fabChip(st) {
  return `<em class="fab-state fab-${st}">${FAB_STATE_LABEL[st]}</em>`;
}
function inputChips(id, planet) {
  const reserve = state.colonies[planet].fab.reserve;
  return Object.entries(RECIPES[id].in)
    .map(([input, need]) => {
      const have = fabStock(planet, input),
        free = have - (reserve[input] || 0),
        ok = free >= need;
      return `<span class="${ok ? 'ok' : 'short'}">${fabIcon(input)} ${need} ${fabName(input)} <small>(${fmt(Math.floor(have))}${reserve[input] ? ', Reserve ' + fmt(reserve[input]) : ''})</small></span>`;
    })
    .join('');
}
function recipeCard(id, planet) {
  const r = RECIPES[id],
    st = recipeState(id, planet),
    order = st.order,
    out = Object.keys(r.out)[0],
    speed = fabSpeed(planet),
    pick = fabPick[id] || 'once',
    pct = order?.loaded ? Math.min(100, (order.progress / (r.seconds / speed)) * 100) : 0,
    progressText = order ? (order.mode === 'count' ? order.made + '/' + order.count + ' · ' : order.mode === 'target' || order.mode === 'auto' ? 'Lager ' + fmt(fabStock(planet, out)) + '/' + order.target + ' · ' : '') + FAB_MODE_LABEL[order.mode].replace(/ ·.*/, '') : '';
  const actions =
    st.state === 'locked'
      ? ''
      : order
        ? `<div class="fab-actions"><button class="secondary" data-fab-pause="${order.id}">${order.paused ? 'WEITER' : 'PAUSE'}</button><button class="secondary" data-fab-cancel="${order.id}">STOPPEN${order.loaded ? ' · Zutaten zurück' : ''}</button></div>`
        : `<div class="fab-actions"><div class="fab-modes" role="radiogroup" aria-label="Auftragsart">${FAB_MODES.map(m => `<button role="radio" aria-checked="${m === pick}" class="${m === pick ? 'active' : ''}" data-fab-mode="${id}:${m}" ${m === 'auto' && !fabManaged(planet) ? 'title="Braucht einen Produktions-Manager"' : ''}>${FAB_MODE_LABEL[m]}</button>`).join('')}</div><button data-fab-start="${id}" ${state.colonies[planet].fab.orders.length >= FAB_MAX_ORDERS ? 'disabled' : ''}>AUFTRAG STARTEN</button></div>`;
  return `<article class="fab-recipe fab-is-${st.state}" data-recipe="${id}">
    <header><span class="fab-icon">${GOODS[out].icon}</span><div><b>${r.name}</b><small>${Math.round((r.seconds / speed) * 10) / 10} s je Charge · ergibt ${r.out[out]} ${GOODS[out].icon} · Lager ${fmt(fabStock(planet, out))}/${fmt(goodsCapacity(planet, out))}</small></div>${fabChip(st.state)}</header>
    ${st.state === 'locked' ? '' : `<div class="fab-inputs">${inputChips(id, planet)}</div>`}
    ${order ? `<i class="fab-bar"><u style="width:${pct.toFixed(1)}%"></u></i>` : ''}
    <small class="fab-text">${progressText ? progressText + ' · ' : ''}${st.text}</small>
    <small class="fab-uses">Verwendet für: ${r.uses}</small>
    ${actions}
  </article>`;
}
function reserveCard(planet) {
  const reserve = state.colonies[planet].fab.reserve,
    inputs = [...new Set(RECIPE_IDS.flatMap(id => Object.keys(RECIPES[id].in)))].filter(id => id !== 'raw');
  return `<article class="fab-reserve"><b>Reserven</b><small>Aufträge nehmen nichts unter diese Menge – z. B. Panzerplatten für die Schiffsreparatur zurückhalten.</small>${inputs
    .map(
      id => `<div class="fab-reserve-row"><span>${fabIcon(id)} ${fabName(id)}</span><div class="fab-modes">${[0, 5, 20, 50]
        .map(n => `<button class="${(reserve[id] || 0) === n ? 'active' : ''}" aria-pressed="${(reserve[id] || 0) === n}" data-fab-reserve="${id}:${n}">${n ? n : 'Aus'}</button>`)
        .join('')}</div></div>`
    )
    .join('')}</article>`;
}
function renderFabModal() {
  const box = $('fabPanel');
  if (!box || $('fabModal')?.classList.contains('hidden')) return;
  const planet = state.activePlanet,
    fab = state.colonies[planet].fab,
    busy = fab.orders.filter(o => o.loaded).length,
    chains = FAB_CHAINS.filter(c => planetAllows(c.id, planet));
  $('fabKicker').textContent = 'FERTIGUNG · ' + shortName(planet).toUpperCase();
  let html = `<p class="fab-summary"><span>Linien ${busy}/${fabLines(planet)} belegt</span><span class="${fabManaged(planet) ? 'on' : ''}">${fabManaged(planet) ? '✓ Produktions-Manager: +25 % Tempo, Automatik' : 'Kein Produktions-Manager – Aufträge laufen, Automatik nicht'}</span><span>Aufträge ${fab.orders.length}/${FAB_MAX_ORDERS}</span></p>`;
  if (!fabOpen(planet)) html += `<p class="freight-hint">Fertigungsaufträge brauchen ein Produktionsgebäude in dieser Kolonie (Raffinerie, Thermalwerkstatt, Glutschmelze, Präzisionswerkstatt oder Biolabor).</p>`;
  if (chains.length)
    html += `<h3 class="fab-heading">Fließbänder</h3><div class="fab-chains">${chains
      .map(c => {
        const st = chainState(c, planet);
        return `<div class="fab-chain fab-is-${st.state}"><span class="fab-icon">${FREIGHT_MATERIALS[c.out].icon}</span><div><b>${INDUSTRY_BUILDINGS[c.id].name}</b><small>${st.text} · Lager ${fmt(materialStock(planet, c.out))}</small></div>${fabChip(st.state)}</div>`;
      })
      .join('')}</div>`;
  html += `<h3 class="fab-heading">Fertigungsaufträge</h3><div class="fab-recipes">${RECIPE_IDS.map(id => recipeCard(id, planet)).join('')}</div>`;
  if (fabOpen(planet)) html += reserveCard(planet);
  setHTML(box, html);
}
function openFab() {
  openModal('fabModal');
  renderFabModal();
}
// Home screen entry: one line per colony state, the button opens the Raffinerie-Zentrale.
function renderFabCard() {
  const card = $('fabCard');
  if (!card) return;
  const planet = state.activePlanet,
    colony = state.colonies[planet],
    open = fabOpen(planet),
    stocked = GOOD_IDS.filter(id => (colony.goods[id] || 0) > 0);
  card.hidden = !open && !stocked.length && (colony.buildings[2]?.level || 0) < 1;
  if (card.hidden) return;
  const states = RECIPE_IDS.map(id => recipeState(id, planet).state),
    count = s => states.filter(x => x === s).length,
    line = open
      ? [count('producing') && count('producing') + ' in Arbeit', count('waiting') && count('waiting') + ' warten', count('blocked') && count('blocked') + ' blockiert', count('available') && count('available') + ' bereit'].filter(Boolean).join(' · ') || 'Alle Rezepte im Blick'
      : 'Baue eine Raffinerie für Fertigungsaufträge';
  setHTML(
    card,
    `<span class="fab-icon">⚙</span><div><small>FERTIGUNG</small><b>Raffinerie-Zentrale</b><p>${line}${stocked.length ? ' · Lager: ' + stocked.map(id => GOODS[id].icon + ' ' + fmt(colony.goods[id])).join(' ') : ''}</p></div><button data-fab-open>ÖFFNEN</button>`
  );
}

// ----- Versorgungshändler and goods market (Galaxie tab) -----
function traderPlaces(good) {
  return PLANETS.map((p, i) => (TRADERS[p.id]?.[good] ? shortName(i) : null)).filter(Boolean);
}
function renderTraderPanel() {
  const box = $('traderPanel');
  if (!box) return;
  const planet = state.activePlanet,
    t = state.traders[planet],
    offers = Object.entries(TRADERS[PLANETS[planet].id] || {});
  let html = `<article class="trader-card"><div class="trader-head"><b>Versorgungshändler · ${shortName(planet)}</b><small>Feste Preise ab Regal – je leerer das Regal, desto teurer (bis +60 %). Nachschub kommt mit der Zeit, auch offline.</small></div>`;
  html += offers.length
    ? offers
        .map(([good, d]) => {
          const stock = Math.floor(t.stock[good] || 0),
            unit = traderUnitPrice(planet, good),
            q10 = traderQuote(planet, good, 10),
            room = Math.max(0, goodsCapacity(planet, good) - fabStock(planet, good)),
            can = q10.qty > 0 && room > 0 && state.credits >= traderUnitPrice(planet, good);
          return `<div class="trader-row"><span class="fab-icon">${GOODS[good].icon}</span><div><b>${GOODS[good].name}</b><small>Regal ${fmt(stock)}/${fmt(d.max)} · +${String(d.restock).replace('.', ',')}/s · bei dir ${fmt(fabStock(planet, good))}/${fmt(goodsCapacity(planet, good))}</small><i class="fab-bar"><u style="width:${((stock / d.max) * 100).toFixed(1)}%"></u></i></div><div class="trader-buy"><b>${fabPrice(unit)} ◈/Stk</b><button data-trader-buy="${good}:10" ${can ? '' : 'disabled'}>${Math.min(10, q10.qty, room) || 10} KAUFEN · ${fmt(traderQuote(planet, good, Math.min(10, room)).cost)} ◈</button></div></div>`;
        })
        .join('')
    : `<p class="freight-hint">Auf ${shortName(planet)} gibt es keinen Versorgungshändler. Schrottmetall: ${traderPlaces('scrap').join(', ')} · Eiswasser: ${traderPlaces('water').join(', ')}.</p>`;
  html += '</article>';
  const goods = GOOD_IDS.filter(id => fabStock(planet, id) > 0 || (GOODS[id].kind !== 'raw' && (state.fabStats.made[RECIPE_IDS.find(r => RECIPES[r].out[id])] || 0) > 0));
  if (goods.length)
    html += `<div class="goods-market">${goods
      .map(id => {
        const stock = fabStock(planet, id),
          here = goodsUnitPrice(planet, id),
          best = GOODS[id].kind === 'raw' ? null : bestGoodsMarket(planet, id),
          better = best && best.unit > here * 1.001,
          docked = freightDocked(planet) && best && freightDocked(best.to);
        return `<article class="goods-tile goods-fab"><span class="goods-icon">${GOODS[id].icon}</span><b>${fmt(stock)}</b><small>${GOODS[id].name}</small><em>hier ${fabPrice(here)} ◈${GOODS[id].kind === 'raw' ? ' (Rückkauf 40 %)' : ''}${better ? ' · ' + shortName(best.to) + ' ' + fabPrice(best.unit) + ' ◈ (+' + Math.round((best.unit / here - 1) * 100) + ' %)' : ''}</em><button data-goods-sell="${id}:1" ${stock >= 1 ? '' : 'disabled'}>1 VERKAUFEN · ${fabPrice(goodsSaleQuote(planet, id, 1).credits)} ◈</button>${stock >= 2 ? `<button class="secondary" data-goods-sell="${id}:all">ALLE · ${fmt(goodsSaleQuote(planet, id, stock).credits)} ◈</button>` : ''}${better && stock >= 1 ? `<button class="secondary" data-goods-route="${id}:${best.to}" ${docked ? '' : 'disabled'}>${docked ? 'ROUTE NACH ' + shortName(best.to).toUpperCase() : 'Frachtdock fehlt'}</button>` : ''}</article>`;
      })
      .join('')}</div>`;
  const log = t.log.slice().reverse();
  if (log.length)
    html += `<details class="trader-log"><summary>Handelsprotokoll ${shortName(planet)} (${log.length})</summary>${log
      .map(e => `<p><span>${clockText(Math.max(0, Date.now() - e.at))} her</span> ${e.kind === 'buy' ? 'Gekauft' : 'Verkauft'} ${e.qty} ${GOODS[e.good]?.icon || ''} ${GOODS[e.good]?.name || e.good} · ${e.kind === 'buy' ? '−' : '+'}${fmt(e.credits)} ◈</p>`)
      .join('')}</details>`;
  setHTML(box, html);
}

document.addEventListener('click', event => {
  const t = event.target,
    planet = state.activePlanet;
  if (t.closest('[data-fab-open]')) return openFab();
  const mode = t.closest('[data-fab-mode]');
  if (mode) {
    const [id, m] = mode.dataset.fabMode.split(':');
    fabPick[id] = m;
    return renderFabModal();
  }
  const start = t.closest('[data-fab-start]');
  if (start) {
    const id = start.dataset.fabStart,
      m = fabPick[id] || 'once';
    if (m === 'auto' && !fabManaged(planet)) {
      toast('Automatik braucht einen Produktions-Manager in dieser Kolonie.');
      return;
    }
    if (createFabOrder(planet, id, m, FAB_MODE_AMOUNT[m])) {
      stepFabrication(planet, 1e-6); // a startable batch takes its inputs right away
      feedback('upgrade', 'light');
      save();
    }
    return render();
  }
  const pause = t.closest('[data-fab-pause]');
  if (pause) {
    if (pauseFabOrder(planet, +pause.dataset.fabPause)) save();
    return render();
  }
  const cancel = t.closest('[data-fab-cancel]');
  if (cancel) {
    if (cancelFabOrder(planet, +cancel.dataset.fabCancel)) {
      toast('Auftrag gestoppt.');
      save();
    }
    return render();
  }
  const reserve = t.closest('[data-fab-reserve]');
  if (reserve) {
    const [id, n] = reserve.dataset.fabReserve.split(':');
    setFabReserve(planet, id, +n);
    save();
    return render();
  }
  const buy = t.closest('[data-trader-buy]');
  if (buy) {
    const [good, n] = buy.dataset.traderBuy.split(':'),
      got = buyGood(planet, good, +n);
    if (got) {
      feedback('upgrade', 'light');
      toast(got + ' ' + GOODS[good].name + ' gekauft.');
      save();
    }
    return render();
  }
  const sell = t.closest('[data-goods-sell]');
  if (sell) {
    const [good, n] = sell.dataset.goodsSell.split(':'),
      credits = sellGood(planet, good, n === 'all' ? fabStock(planet, good) : +n);
    if (credits > 0) {
      feedback('reward', 'light');
      toast('Verkauft: +' + fmt(credits) + ' ◈');
      save();
    }
    return render();
  }
  const route = t.closest('[data-goods-route]');
  if (route) {
    const [good, to] = route.dataset.goodsRoute.split(':');
    Object.assign(routeEditor, { open: true, from: planet, to: +to, resource: good, amount: Math.max(1, Math.min(fabStock(planet, good), freightCapacity(planet))), repeat: false });
    renderFreight();
    $('freightPanel')?.scrollIntoView?.({ block: 'start', behavior: document.body.classList.contains('reduce-motion') ? 'auto' : 'smooth' });
  }
});
const renderBeforeFab = render;
render = () => {
  renderBeforeFab();
  if (currentScreen() === 'home') renderFabCard();
  if (currentScreen() === 'trade') renderTraderPanel();
  renderFabModal();
};
const showScreenBeforeFab = showScreen;
showScreen = screen => {
  showScreenBeforeFab(screen);
  if (currentScreen() === 'home') renderFabCard();
  if (currentScreen() === 'trade') renderTraderPanel();
};
render();

// Beta 1.4 M7: the colony scene shows the Fertigung bench next to the refinery (real orders: what is in work, its
// progress, a full output store, the goods on the shelf). View data only; the scene draws it.
const FAB_GOOD_COLOR = { scrap: '#9aa2c4', water: '#8fe3ff', plating: '#c4cbe4', coolant: '#7fdcff', repairKit: '#ff8fb0', hullModule: '#ffd77a' };
const colonyViewBeforeFab = window.NebulaView.colony;
window.NebulaView.colony = () => {
  const view = colonyViewBeforeFab(),
    planet = state.activePlanet;
  if (!fabOpen(planet)) return view;
  const fab = state.colonies[planet].fab,
    loaded = fab.orders.filter(o => o.loaded && RECIPES[o.recipe]).slice(0, 3),
    speed = fabSpeed(planet);
  return {
    ...view,
    fab: {
      work: loaded.map(o => ({ color: FAB_GOOD_COLOR[Object.keys(RECIPES[o.recipe].out)[0]] || '#ffffff', progress: Math.min(1, o.progress / (RECIPES[o.recipe].seconds / speed)), blocked: o.progress >= RECIPES[o.recipe].seconds / speed - 1e-9 && !outputRoom(o.recipe, planet) })),
      shelf: GOOD_IDS.filter(id => GOODS[id].kind !== 'raw' && fabStock(planet, id) > 0).map(id => ({ color: FAB_GOOD_COLOR[id], n: Math.min(3, Math.ceil(fabStock(planet, id) / 5)) })),
      managed: fabManaged(planet),
      orders: fab.orders.length
    }
  };
};

// Beta 1.4 M7: the Galaxie tab's section jumps (anchors only — no change to how the page scrolls)
document.addEventListener('click', event => {
  const jump = event.target.closest('[data-jump]');
  if (!jump) return;
  const target = $(jump.dataset.jump);
  const heading = target?.previousElementSibling?.classList?.contains('section-heading') ? target.previousElementSibling : target;
  heading?.scrollIntoView?.({ block: 'start', behavior: document.body.classList.contains('reduce-motion') ? 'auto' : 'smooth' });
});
const renderJumpsBeforeFab = render;
render = () => {
  renderJumpsBeforeFab();
  if (currentScreen() !== 'trade') return;
  // hide jumps to sections that are not shown (e.g. the income card with one colony)
  document.querySelectorAll('.section-jumps [data-jump]').forEach(b => {
    const el = $(b.dataset.jump);
    b.hidden = !el || el.hidden;
  });
};
