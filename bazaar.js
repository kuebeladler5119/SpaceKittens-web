// Sternenbasar — Madame Minka's trading hub. Everything here uses real colony stock:
//  * Specialities (Frostquarz, Thermalzellen) can be sold directly from the visited colony.
//  * Minka's delivery contracts ask for a material from a specific colony and pay more than the market.
// Raw crystals and bars keep selling through the colony's stall/dock (same value), so there is one coherent economy.
// Loaded after game.js; contracts are run state (state.bazaar), one-time gem milestones use meta.milestones.

const BAZAAR_SELL_PRICE = { frost: 3, cells: 30, ember: EMBER_VALUE, emberAlloy: ALLOY_VALUE, precisionOre: PRECISION_ORE_VALUE, precisionParts: PARTS_VALUE, spores: SPORE_VALUE, biogel: BIOGEL_VALUE };
const MINKA = {
  look: { fur: '#f3e7d6', fur2: '#fff8ee', mark: '#7a5a7a', pattern: 'point', eye: '#c48aff', suit: '#7a3a8a', suitDark: '#5a2a6a', accent: '#ffd23a' },
  outfit: { jacket: '#7a3a8a', bowtie: '#ffd23a', hat: 'tophat', hatColor: '#3a2a5a', glasses: true, item: 'briefcase' }
};
const MINKA_QUIPS = [
  'Willkommen am Sternenbasar, Schätzchen! Ich zahle gut – aber nur für echte Ware.',
  'Thermalzellen? Damit heizt halb Vesper seine Teestuben. Bring mir mehr davon!',
  'Ein Auftrag ist ein Versprechen. Und ich halte meine Versprechen – mit Zinsen.',
  'Frostquarz glitzert so hübsch … meine Kundschaft liebt das.',
  'Psst – eine gute Handelsmanagerin am Stand bringt dir bei mir zehn Prozent mehr.',
  'Frachtrouten sind das Herz des Handels. Deine Frachter sind hier immer willkommen.'
];
function minkaPortrait(size = 96) {
  return window.SpaceKittens?.managerPortraitURL?.('minka', MINKA.look, MINKA.outfit, size, 4) || '';
}
function bazaarTradeBonus(planet) {
  return isAutomated('stall', planet) || isAutomated('dock', planet) ? 1.1 : 1;
}

// Beta 1.5: Minka also orders Fertigung goods. They live in colony.goods, not in the material stock; only goods the
// account has really made count (the traders sell raw inputs only, so a contract can never be filled by buying).
const CONTRACT_GOODS = { plating: 4, coolant: 4, repairKit: 2, hullModule: 1 };
function contractStock(planet, resource) {
  return GOODS[resource] ? fabStock(planet, resource) : materialStock(planet, resource);
}
function contractSetStock(planet, resource, value) {
  if (GOODS[resource]) fabSetStock(planet, resource, value);
  else setMaterialStock(planet, resource, value);
}
function contractCapacity(planet, resource) {
  return GOODS[resource] ? goodsCapacity(planet, resource) : materialCapacity(planet, resource);
}
function contractMaterial(resource) {
  return GOODS[resource] ? { name: GOODS[resource].name, icon: GOODS[resource].icon } : FREIGHT_MATERIALS[resource];
}
function contractUnitValue(resource) {
  return GOODS[resource] ? GOODS[resource].value : BAZAAR_UNIT_VALUE[resource];
}

// ----- contracts -----
function bazaarEligible() {
  const pairs = [];
  state.planetsUnlocked.forEach((unlocked, i) => {
    if (!unlocked) return;
    const c = state.colonies[i];
    pairs.push([i, 'raw']);
    if (c.industry.refinery > 0) pairs.push([i, 'bars']);
    if (c.industry.frostDrill > 0) pairs.push([i, 'frost']);
    if (c.industry.thermal > 0) pairs.push([i, 'cells']);
    // Pyra: Glutstein once its shaft mines, Glutlegierung once the Glutschmelze stands
    if (c.underground?.shafts?.shaft2?.level > 0 && shaftMaterial('shaft2', i) === 'ember') pairs.push([i, 'ember']);
    if (c.industry.foundry > 0) pairs.push([i, 'emberAlloy']);
    if (c.underground?.shafts?.shaft2?.level > 0 && shaftMaterial('shaft2', i) === 'precisionOre') pairs.push([i, 'precisionOre']);
    if (c.industry.workshop > 0) pairs.push([i, 'precisionParts']);
    if (c.industry.sporeGarden > 0) pairs.push([i, 'spores']);
    if (c.industry.biolab > 0) pairs.push([i, 'biogel']);
    if (typeof fabOpen === 'function' && fabOpen(i))
      for (const good of Object.keys(CONTRACT_GOODS)) {
        const recipe = RECIPE_IDS.find(r => RECIPES[r].out[good]);
        if ((state.fabStats?.made?.[recipe] || 0) > 0) pairs.push([i, good]);
      }
  });
  return pairs;
}
// Deterministic contract generator (no reroll by reloading): the n-th contract always looks the same for a save.
function generateContract(id) {
  const pairs = bazaarEligible(),
    [planet, resource] = pairs[(id * 7) % pairs.length],
    minutes = 3 + (id % 3) * 2;
  if (GOODS[resource]) {
    // a small, fixed batch per good (Fertigung runs in batches, not as a flow), never more than 80 % of the store
    const amount = Math.max(1, Math.min(Math.floor(goodsCapacity(planet, resource) * 0.8), CONTRACT_GOODS[resource] * (1 + Math.min(2, Math.floor(id / 12)))));
    return { id, planet, resource, amount, credits: Math.round(amount * GOODS[resource].value * 1.6), bonus: id % 3 === 0 ? { kind: ['fuel', 'crystals', 'alloys'][(id / 3) % 3], amount: [6, 2, 3][(id / 3) % 3] } : null };
  }
  const rate = withPlanet(planet, () =>
    resource === 'raw' ? Math.max(1, deliveryRate()) : resource === 'bars' ? refineryRate() / BAR_RAW : resource === 'frost' ? frostRate() : resource === 'cells' ? thermalRate() : resource === 'ember' || resource === 'precisionOre' ? shaftRate('shaft2') : resource === 'precisionParts' ? workshopRate() : resource === 'spores' ? sporeRate() : resource === 'biogel' ? biogelRate() : foundryRate()
  );
  // Never more than the origin can hold (80 % of its storage), so every contract can really be fulfilled.
  const cap = Math.max(1, Math.floor(materialCapacity(planet, resource) * 0.8)),
    amount = Math.max(1, Math.min(cap, Math.ceil(Math.max({ raw: 150, bars: 6, frost: 16, cells: 3, ember: 12, emberAlloy: 2, precisionOre: 15, precisionParts: 2, spores: 20, biogel: 2 }[resource], rate * minutes * 60))));
  const credits = Math.round(amount * BAZAAR_UNIT_VALUE[resource] * 1.6);
  const bonusKinds = ['fuel', 'crystals', 'alloys'];
  const bonus = id % 3 === 0 ? { kind: bonusKinds[(id / 3) % 3], amount: [6, 2, 3][(id / 3) % 3] } : null;
  return { id, planet, resource, amount, credits, bonus };
}
function ensureContracts(now = Date.now()) {
  const b = state.bazaar;
  // contracts that became impossible (e.g. storage shrank) are withdrawn by Minka
  b.contracts = b.contracts.filter(c => state.planetsUnlocked[c.planet] && c.amount <= contractCapacity(c.planet, c.resource));
  if (b.contracts.length >= BAZAAR_SLOTS || now < b.refreshAt) return;
  while (b.contracts.length < BAZAAR_SLOTS) b.contracts.push(generateContract(b.nextId++));
}
function deliverContract(id) {
  const b = state.bazaar,
    index = b.contracts.findIndex(c => c.id === id);
  if (index < 0) return false;
  const c = b.contracts[index];
  if (!state.planetsUnlocked[c.planet] || contractStock(c.planet, c.resource) < c.amount) return false;
  contractSetStock(c.planet, c.resource, contractStock(c.planet, c.resource) - c.amount);
  const credits = c.credits * bazaarTradeBonus(c.planet);
  earn(credits);
  if (c.bonus) state[c.bonus.kind] += c.bonus.amount;
  b.contracts.splice(index, 1);
  b.refreshAt = Date.now() + BAZAAR_REFRESH_MS;
  b.done++;
  // one-time milestones (account level ledger, never repeatable)
  const done = state.meta.milestones,
    total = (state.meta.bazaarDone = (state.meta.bazaarDone || 0) + 1);
  [
    ['bazaar-1', 1, () => (state.gems += 5)],
    ['bazaar-10', 10, () => (state.gems += 10)],
    ['bazaar-25', 25, () => state.meta.managers.capsules++]
  ].forEach(([key, need, grant]) => {
    if (total >= need && !done.includes(key)) {
      done.push(key);
      grant();
    }
  });
  GameEvents.emit('sale', { credits, amount: c.amount, planet: c.planet, workplace: 'dock', contract: c.id });
  return credits;
}
function sellSpeciality(resource, units) {
  const planet = state.activePlanet,
    stock = materialStock(planet, resource),
    qty = Math.min(stock, units);
  if (!BAZAAR_SELL_PRICE[resource] || qty <= 0) return 0;
  setMaterialStock(planet, resource, stock - qty);
  // Beta 1.3: the planet's market (demand profile, own goods cheaper — market.js)
  const credits = qty * BAZAAR_SELL_PRICE[resource] * bazaarTradeBonus(planet) * (typeof marketFactor === 'function' ? marketFactor(planet, resource) : 1);
  earn(credits);
  GameEvents.emit('sale', { credits, amount: qty, planet, workplace: 'stall' });
  return credits;
}

// ----- UI -----
function renderBazaar() {
  if (!$('merchantCard')) return;
  ensureContracts();
  const planet = state.activePlanet,
    colony = colonyAt(),
    portrait = minkaPortrait(160),
    quip = MINKA_QUIPS[Math.floor(Date.now() / 20000) % MINKA_QUIPS.length],
    flights = state.routes.filter(r => r.status !== 'idle').length,
    bonus = bazaarTradeBonus(planet) > 1;
  setHTML(
    $('merchantCard'),
    `${portrait ? `<img src="${portrait}" alt="Madame Minka" width="80" height="80" />` : ''}<div><b>Madame Minka</b><small>Händlerin vom Sternenbasar</small><p>„${quip}“</p><div class="merchant-chips"><span class="${bonus ? 'on' : ''}">${bonus ? '✓ Handels-Manager: +10 %' : 'Kein Handels-Manager auf ' + shortName(planet)}</span><span>⇄ ${flights} Frachter unterwegs</span><span>✓ ${state.meta.bazaarDone || 0} Aufträge erfüllt</span></div></div>`
  );
  // Goods: real stock of the visited colony
  const goods = [
    ['raw', materialStock(planet, 'raw'), 'Verkauf am Stand/Dock'],
    ['bars', colony.stock.bars, 'Verkauf am Stand/Dock'],
    ['frost', colony.stock.frost, ''],
    ['cells', colony.stock.cells, ''],
    ...(isPyra(planet) || colony.stock.ember > 0 || colony.stock.emberAlloy > 0 ? [['ember', colony.stock.ember, ''], ['emberAlloy', colony.stock.emberAlloy, '']] : []),
    ...(isMekhanos(planet) || colony.stock.precisionOre > 0 || colony.stock.precisionParts > 0 ? [['precisionOre', colony.stock.precisionOre, ''], ['precisionParts', colony.stock.precisionParts, '']] : []),
    ...(isViridia(planet) || colony.stock.spores > 0 || colony.stock.biogel > 0 ? [['spores', colony.stock.spores, ''], ['biogel', colony.stock.biogel, '']] : [])
  ];
  $('goodsColony').textContent = shortName(planet);
  setHTML(
    $('goodsGrid'),
    goods
      .map(([id, stock, note]) => {
        const m = FREIGHT_MATERIALS[id],
          price = BAZAAR_SELL_PRICE[id];
        return `<article class="goods-tile goods-${id}"><span class="goods-icon">${m.icon}</span><b>${fmt(stock)}</b><small>${m.name}</small>${
          price
            ? `<button data-bazaar-sell="${id}" ${stock >= 1 ? '' : 'disabled'}>VERKAUFEN · ${fmt(price * bazaarTradeBonus(planet))} ◈</button>`
            : `<em>${note}</em>`
        }</article>`;
      })
      .join('')
  );
  // Contracts
  const b = state.bazaar;
  $('contractCount').textContent = b.contracts.length + ' / ' + BAZAAR_SLOTS;
  let html = b.contracts
    .map(c => {
      const m = contractMaterial(c.resource),
        have = contractStock(c.planet, c.resource),
        ready = have >= c.amount && state.planetsUnlocked[c.planet],
        pct = Math.min(100, Math.round((have / c.amount) * 100));
      return `<article class="bazaar-contract ${ready ? 'ready' : ''}"><div class="contract-head">${planetIcon(c.planet, 32)}<div><b>${fmt(c.amount)} ${m.icon} ${m.name}</b><small>aus ${shortName(c.planet)} · Lager dort: ${fmt(have)}</small></div></div><i class="contract-bar"><u style="width:${pct}%"></u></i><div class="contract-reward"><span>◈ ${fmt(c.credits * bazaarTradeBonus(c.planet))}${c.bonus ? ' + ' + c.bonus.amount + ' ' + { fuel: '⛽', crystals: '◆ Kristalle', alloys: '▰ Legierungen' }[c.bonus.kind] : ''}</span><button data-bazaar-deliver="${c.id}" ${ready ? '' : 'disabled'}>LIEFERN</button></div></article>`;
    })
    .join('');
  if (b.contracts.length < BAZAAR_SLOTS) html += `<p class="freight-hint">Neuer Auftrag in ${clockText(b.refreshAt - Date.now())}.</p>`;
  setHTML($('bazaarContracts'), html);
}
document.addEventListener('click', event => {
  const sell = event.target.closest('[data-bazaar-sell]');
  if (sell) {
    const id = sell.dataset.bazaarSell,
      credits = sellSpeciality(id, id === 'cells' || id === 'emberAlloy' || id === 'precisionParts' || id === 'biogel' ? 1 : 10);
    if (credits > 0) {
      feedback('reward', 'light');
      toast('Minka zahlt ' + fmt(credits) + ' ◈.');
      save();
    }
    return render();
  }
  const deliver = event.target.closest('[data-bazaar-deliver]');
  if (deliver) {
    const credits = deliverContract(+deliver.dataset.bazaarDeliver);
    if (credits) {
      feedback('unlock', 'success');
      window.NebulaAudio?.play('meow');
      toast('Auftrag erfüllt! +' + fmt(credits) + ' ◈');
      save();
    }
    return render();
  }
});
const renderBeforeBazaar = render;
render = () => {
  renderBeforeBazaar();
  if (currentScreen() === 'trade') renderBazaar();
};
const showScreenBeforeBazaar = showScreen;
showScreen = screen => {
  showScreenBeforeBazaar(screen);
  if (currentScreen() === 'trade') renderBazaar();
};
render();
