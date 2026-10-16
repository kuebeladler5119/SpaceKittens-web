// Industry & Managers UI: production chain controls, building sheets with a manager slot, hiring, manual stages,
// specialist assignment and one-time milestone rewards. Loaded after game.js (uses its globals).

// Building-sheet keys: legacy building index or industry building id → workplace (null = no workplace).
const SHEET_WORKPLACE = { 0: 'mine', 1: null, 2: 'depot', 3: 'dock', rail: 'rail', stall: 'stall', refinery: 'refinery', frostDrill: 'frostDrill', thermal: 'thermal', foundry: 'foundry', workshop: 'workshop', sporeGarden: 'sporeGarden', biolab: 'biolab', sorter: 'sorter', resinDrill: 'resinDrill' };
const INDUSTRY_ROLE = {
  resinDrill: 'Pumpt Sternenharz aus der Tiefe der Kristallebene in seine Tanks. Die Fertigung macht daraus Sternentreibstoff (füllt den Schiffstank), Funkel-Schmiermittel, Kristallgel und Sternenpolymer.',
  sorter: 'Sortiert Rohkristalle aus dem Lager in Kisten. Der Verkauf nimmt zuerst Kisten und zahlt +15 % – verpackte Ware ist mehr wert.',
  sporeGarden: 'Kätzchen ernten Leuchtsporen von den Riesenblüten. Die Sporen speisen das Biolabor.',
  biolab: 'Setzt aus 3 Leuchtsporen + 25 Rohkristallen aus dem Lager 1 Biogel an. Biogel heilt Wurzeln und ist begehrte Ware.',
  rail: 'Loren bringen Rohkristalle von der Halde ins Lagerhaus. Ab Lv 10 Rover, ab 25 Förderband.',
  stall: 'Verkauft Ware aus dem Lager an Händler. Ab Lv 10 Marktstand mit Markise, ab 25 Handelskontor.',
  refinery: 'Schmilzt 10 Rohkristalle zu 1 Kristallbarren (Wert 12 ◈ statt 10). Braucht Beschickung aus dem Lager.',
  frostDrill: 'Nur auf Glacies Niva: bohrt Frostquarz aus der Eisklippe. Ab Lv 10 mit Kühlturm.',
  thermal: 'Fertigt Thermalzellen aus 4 Frostquarz + 10 Rohkristallen aus dem Lager. Zellen heizen das Wärmenetz und sind begehrte Handelsware.',
  foundry: 'Schmilzt 4 Glutstein + 20 Rohkristalle aus dem Lager zu 1 Glutlegierung. Thermalzellen von Glacies kühlen die Schmelze: +50 % Tempo, 1 Zelle je 5 Legierungen.',
  workshop: 'Fertigt aus 3 Präzisionserz + 15 Rohkristallen aus dem Lager 1 Präzisionsbauteil. Präzisionserz kommt aus dem Zahnrad-Stollen (Schacht 2) über den Förderaufzug.'
};
const MANUAL_ACTIONS = {
  mine: () => collect(),
  rail: () => sendCart(),
  stall: () => sellGoods('stall'),
  dock: () => sellGoods('dock'),
  depot: () => feedRefinery(),
  refinery: () => refineNow(),
  frostDrill: () => mineFrost(),
  thermal: () => makeCells(),
  foundry: () => smeltAlloy(),
  workshop: () => assembleParts(),
  sporeGarden: () => harvestSpores(),
  biolab: () => brewBiogel(),
  sorter: () => packCrates(),
  resinDrill: () => pumpResin()
};
function pumpResin() {
  const amount = manualResin();
  if (amount <= 0) return toast('Die Harztanks sind voll – die Fertigung braucht sie für Sternentreibstoff und Chemie.');
  feedback('collect', 'light');
  render();
}
function packCrates() {
  const amount = manualPack();
  if (amount <= 0) return toast('Nichts zu packen: Das Lager hat keine verkaufbaren Rohkristalle über dem Mindestbestand, oder das Kistenlager ist voll.');
  feedback('collect', 'light');
  render();
}
function harvestSpores() {
  const amount = manualSpores();
  if (amount <= 0) return toast('Das Sporenlager ist voll.');
  GameEvents.emit('spores', { amount, manual: true });
  feedback('collect', 'light');
  render();
}
function brewBiogel() {
  const made = manualBiolab();
  if (made <= 0) return toast('Für Biogel fehlen 3 Leuchtsporen oder 25 Rohkristalle im Lager (oder das Gellager ist voll).' + (rawReserveCharges() ? '' : ' Tipp: Rohkristall-Reserve einschalten.'));
  GameEvents.emit('biolab', { made, manual: true });
  feedback('upgrade', 'light');
  render();
}
function assembleParts() {
  const made = manualWorkshop();
  if (made <= 0) return toast('Für ein Präzisionsbauteil fehlen 3 Präzisionserz oder 15 Rohkristalle im Lager (oder das Bauteillager ist voll).' + (rawReserveCharges() ? '' : ' Tipp: Rohkristall-Reserve einschalten.'));
  GameEvents.emit('workshop', { made, manual: true });
  feedback('upgrade', 'light');
  render();
}
function mineFrost() {
  const amount = manualFrost();
  if (amount <= 0) return toast('Das Frostquarz-Lager ist voll.');
  GameEvents.emit('frost', { amount, manual: true });
  feedback('collect', 'light');
  render();
}
function smeltAlloy() {
  const made = manualFoundry();
  if (made <= 0) return toast('Für eine Glutlegierung fehlen 4 Glutstein oder 20 Rohkristalle im Lager (oder das Legierungslager ist voll).');
  GameEvents.emit('foundry', { made, manual: true });
  feedback('upgrade', 'light');
  render();
}
function makeCells() {
  const cells = manualThermal();
  if (cells <= 0) return toast('Für eine Zelle fehlen 4 Frostquarz oder 10 Rohkristalle im Lager.');
  GameEvents.emit('thermal', { cells, manual: true });
  feedback('upgrade', 'light');
  render();
}

function managerPortrait(job, specialistId, size = 88) {
  const Kit = window.SpaceKittens;
  if (!Kit?.managerPortraitURL) return '';
  const def = specialistId ? SPECIALIST[specialistId] : STAFF_LOOKS[job];
  return Kit.managerPortraitURL(specialistId || 'staff-' + job, def.look, def.outfit, size, specialistId ? specialistRank(specialistId) : 1);
}
function portraitImg(job, specialistId, size) {
  const url = managerPortrait(job, specialistId, size);
  return url ? `<img src="${url}" alt="" width="44" height="44" />` : `<i class="manager-icon">${PROFESSIONS[job].icon}</i>`;
}
function managerOnDuty(workplace, planet = state.activePlanet) {
  const special = specialistAt(planet, workplace),
    level = colonyAt(planet).staff[workplace];
  if (special) return { kind: 'special', id: special, name: SPECIALIST[special].name, rank: specialistRank(special) };
  if (level > 0) return { kind: 'staff', level, converted: (colonyAt(planet).convertedJobs || []).includes(workplace) };
  return null;
}
function workplaceTitle(workplace) {
  const job = PROFESSIONS[WORKPLACE[workplace].job];
  return job.title || job.name + '-Manager';
}

// ----- Hiring, training, specialists -----
function hireManager(workplace) {
  const planet = state.activePlanet,
    colony = colonyAt(planet);
  if (!WORKPLACE[workplace] || !workplaceExists(workplace) || colony.staff[workplace] > 0) return false;
  const price = hireCost(workplace);
  if (state.credits < price) {
    toast('Noch ' + fmt(price - state.credits) + ' Credits für den ' + workplaceTitle(workplace));
    return false;
  }
  state.credits -= price;
  colony.staff[workplace] = 1;
  state.meta.managers.hires++;
  GameEvents.emit('hire', { planet, workplace, job: WORKPLACE[workplace].job, special: null });
  feedback('unlock', 'success');
  window.NebulaAudio?.play('meow');
  toast(workplaceTitle(workplace) + ' eingestellt – ' + WORKPLACE[workplace].stage + ' läuft jetzt automatisch!');
  checkIndustryMilestones();
  save();
  render();
  return true;
}
function trainManager(workplace) {
  const colony = colonyAt();
  if (!(colony.staff[workplace] > 0) || colony.staff[workplace] >= STAFF_MAX_LEVEL) return false;
  const price = staffUpgradeCost(workplace);
  if (state.credits < price) return toast('Noch ' + fmt(price - state.credits) + ' Credits für die Fortbildung'), false;
  state.credits -= price;
  colony.staff[workplace]++;
  GameEvents.emit('manager-upgrade', { planet: state.activePlanet, workplace, level: colony.staff[workplace] });
  feedback('upgrade', 'light');
  save();
  render();
  return true;
}
// Specialists: one workplace at a time, profession must match; replaces whoever specialist worked there before.
function assignSpecialist(id, workplace, planet = state.activePlanet) {
  const managers = state.meta.managers,
    def = SPECIALIST[id];
  if (!def || !managers.roster[id]) return false;
  if (WORKPLACE[workplace]?.job !== def.job) {
    toast(def.name + ' ist ' + PROFESSIONS[def.job].name + '-Spezialist und kann hier nicht arbeiten.');
    return false;
  }
  if (!workplaceExists(workplace, planet)) return false;
  const previous = specialistAt(planet, workplace);
  if (previous && previous !== id) delete managers.assign[previous];
  managers.assign[id] = { planet, workplace };
  GameEvents.emit('hire', { planet, workplace, job: def.job, special: id });
  feedback('unlock', 'success');
  save();
  render();
  return true;
}
function unassignSpecialist(id) {
  if (!state.meta.managers.assign[id]) return false;
  const { planet, workplace } = state.meta.managers.assign[id];
  delete state.meta.managers.assign[id];
  GameEvents.emit('unassign', { planet, workplace, special: id });
  save();
  render();
  return true;
}

// ----- Building sheet -----
function industryEffectText(id) {
  const level = industryLevel(id),
    per = INDUSTRY_BUILDINGS[id].perLevel,
    gain = n => per * n * buildingMultiplier(n);
  if (id === 'rail') return 'Transport ' + fmt(level ? railRate() : 0) + ' → ' + fmt((10 + gain(level + 1)) * workplaceEfficiency('rail')) + ' /s';
  if (id === 'stall') return 'Verkauf ' + fmt(stallRate()) + ' → ' + fmt((transportCapacity(0) + per * level * buildingMultiplier(level + 1)) * workplaceEfficiency('stall')) + ' /s';
  if (id === 'frostDrill') return 'Frostquarz ' + fmt(frostRate()) + ' → ' + fmt(gain(level + 1) * workplaceEfficiency('frostDrill') * glaciesBoost('frost')) + ' /s';
  if (id === 'thermal') return 'Zellen ' + fmt(thermalRate()) + ' → ' + fmt(gain(level + 1) * workplaceEfficiency('thermal') * glaciesBoost('thermal')) + ' /s';
  if (id === 'foundry') return 'Glutlegierung ' + (foundryRate() * 60).toFixed(1).replace('.', ',') + ' → ' + (gain(level + 1) * workplaceEfficiency('foundry') * pyraBoost('foundry') * 60).toFixed(1).replace('.', ',') + ' /min';
  if (id === 'workshop') return 'Präzisionsbauteile ' + (workshopRate() * 60).toFixed(1).replace('.', ',') + ' → ' + (gain(level + 1) * workplaceEfficiency('workshop') * 60).toFixed(1).replace('.', ',') + ' /min';
  if (id === 'sporeGarden') return 'Leuchtsporen ' + fmt(sporeRate()) + ' → ' + fmt(gain(level + 1) * workplaceEfficiency('sporeGarden') * rootBoost('sporeGarden')) + ' /s';
  if (id === 'biolab') return 'Biogel ' + (biogelRate() * 60).toFixed(1).replace('.', ',') + ' → ' + (gain(level + 1) * workplaceEfficiency('biolab') * viridiaBoost('biolab') * rootBoost('biolab') * 60).toFixed(1).replace('.', ',') + ' /min';
  if (id === 'resinDrill') return 'Sternenharz ' + (resinRate() * 60).toFixed(1).replace('.', ',') + ' → ' + (INDUSTRY_BUILDINGS.resinDrill.perLevel * (level + 1) * workplaceEfficiency('resinDrill') * 60).toFixed(1).replace('.', ',') + ' /min · Tanks ' + fmt(colonyAt().stock.resin || 0) + ' / ' + fmt(resinCapacity());
  if (id === 'sorter') return 'Packen ' + fmt(packRate()) + ' → ' + fmt(gain(level + 1) * workplaceEfficiency('sorter')) + ' /s · Kisten ' + fmt(colonyAt().stock.packed || 0) + ' / ' + fmt(packCapacity());
  return 'Verarbeitung ' + fmt(refineryRate()) + ' → ' + fmt(gain(level + 1) * workplaceEfficiency('refinery')) + ' Rohkristalle/s';
}
function stockChips(workplace) {
  const colony = colonyAt(),
    depot = state.planetOps.storage[state.activePlanet] || 0,
    chips = [];
  if (['mine', 'rail'].includes(workplace)) chips.push('Halde ' + fmt(colony.stock.pile) + ' / ' + fmt(pileCapacity()));
  if (['rail', 'depot', 'stall', 'dock', 'sorter'].includes(workplace)) chips.push('Lager ' + fmt(depot) + ' / ' + fmt(storageCapacity()));
  if (workplace === 'resinDrill') {
    chips.push('✺ Sternenharz ' + fmt(colony.stock.resin || 0) + ' / ' + fmt(resinCapacity()));
    chips.push('⚗ Sternentreibstoff ' + fmt(colony.goods?.starFuel || 0) + ' · Tank ' + fmt(state.fuel) + ' / ' + fmt(fuelTankCapacity()));
  }
  if (['sorter', 'stall', 'dock'].includes(workplace) && workplaceExists('sorter')) chips.push('📦 Kisten ' + fmt(colony.stock.packed || 0) + ' / ' + fmt(packCapacity()));
  if (['stall', 'dock'].includes(workplace) && rawReserveUnits() > 0) chips.push('🔒 Reserve ' + fmt(rawReserveUnits()) + ' bleibt im Lager');
  if (['depot', 'refinery'].includes(workplace) && workplaceExists('refinery')) chips.push('Trichter ' + fmt(colony.stock.hopper) + ' / ' + fmt(hopperCapacity()));
  if (['refinery', 'stall', 'dock'].includes(workplace) && workplaceExists('refinery')) chips.push('Barren ' + fmt(colony.stock.bars) + ' / ' + fmt(barCapacity()));
  if (['frostDrill', 'thermal'].includes(workplace)) chips.push('❄ Frostquarz ' + fmt(colony.stock.frost) + ' / ' + fmt(frostCapacity()));
  if (workplace === 'foundry') {
    chips.push('⬢ Glutstein ' + fmt(colony.stock.ember) + ' / ' + fmt(emberCapacity()));
    chips.push('Lager ' + fmt(depot));
    chips.push('▣ Glutlegierung ' + fmt(colony.stock.emberAlloy) + ' / ' + fmt(alloyCapacity()));
    if (colony.stock.cells >= 1) chips.push('♨ Kühlung ' + fmt(colony.stock.cells));
  }
  if (workplace === 'workshop') {
    chips.push('⚙ Präzisionserz ' + fmt(colony.stock.precisionOre) + ' / ' + fmt(precisionOreCapacity()));
    chips.push('Lager ' + fmt(depot));
    chips.push('⛭ Bauteile ' + fmt(colony.stock.precisionParts) + ' / ' + fmt(partsCapacity()));
  }
  if (workplace === 'sporeGarden') chips.push('✿ Leuchtsporen ' + fmt(colony.stock.spores) + ' / ' + fmt(sporeCapacity()));
  if (workplace === 'biolab') {
    chips.push('✿ Leuchtsporen ' + fmt(colony.stock.spores) + ' / ' + fmt(sporeCapacity()));
    chips.push('Lager ' + fmt(depot));
    chips.push('◍ Biogel ' + fmt(colony.stock.biogel) + ' / ' + fmt(biogelCapacity()));
  }
  if (workplace === 'thermal') {
    chips.push('Lager ' + fmt(depot));
    chips.push('♨ Zellen ' + fmt(colony.stock.cells) + ' / ' + fmt(cellCapacity()));
  }
  return chips.length ? `<p class="sheet-stock">${chips.map(c => `<span>${c}</span>`).join('')}</p>` : '';
}
// K62: Rohkristall-Reserve control in the specialty facility's sheet (one compact row, readable at 320 px).
const RESERVE_RECIPE = { thermal: ['Thermalzelle', () => RAW_PER_CELL], foundry: ['Glutlegierung', () => RAW_PER_ALLOY], workshop: ['Präzisionsbauteil', () => RAW_PER_PART], biolab: ['Biogel', () => RAW_PER_GEL] };
function reserveRow(workplace) {
  if (!RESERVE_RECIPE[workplace] || !workplaceExists(workplace)) return '';
  const index = state.activePlanet,
    [product, recipe] = RESERVE_RECIPE[workplace],
    need = recipe(),
    charges = rawReserveCharges(index),
    units = rawReserveUnits(index),
    depot = state.planetOps.storage[index] || 0,
    sales = isAutomated('stall') || isAutomated('dock'),
    size = rawChargeSize(index),
    ready = depot >= need;
  const label = n => (n === 0 ? 'Aus' : n === 1 ? '1 Charge' : n + ' Chargen');
  return `<div class="sheet-reserve"><div class="reserve-head"><b>Rohkristall-Reserve</b><small>Schützt Rohkristalle vor dem Verkauf – deine Gebäude dürfen sie verarbeiten.</small></div><div class="reserve-options" role="radiogroup" aria-label="Rohkristall-Reserve">${RESERVE_OPTIONS.map(
    n => `<button role="radio" aria-checked="${n === charges}" class="${n === charges ? 'active' : ''}" data-reserve="${n}">${label(n)}</button>`
  ).join('')}</div><p class="reserve-facts"><span>geschützt ${fmt(units)}</span><span>Lager ${fmt(depot)}</span><span>verkaufbar ${fmt(sellableRaw(index))}</span><span>1 Charge = ${fmt(size)} (1 ${product}: ${need})</span><span class="${ready ? 'ok' : 'short'}">${ready ? '✓ Handbetrieb möglich' : '✕ Für Handbetrieb fehlen ' + fmt(Math.ceil(need - depot)) + ' Rohkristalle'}</span>${!charges && sales && !isAutomated(workplace) ? '<span class="short">Händler verkaufen sonst alles</span>' : ''}</p></div>`;
}
// Beta 1.7 M2: Verteilung of the depot (sheet level 2 of the depot, refinery, stall and dock). Sell surplus raw / bars,
// a minimum stock, and whether production orders come before the sale. The live line shows where the raw goes.
const ALLOC_SHEETS = ['depot', 'sorter', 'refinery', 'stall', 'dock'];
function allocRow(workplace) {
  if (!ALLOC_SHEETS.includes(workplace) || !workplaceExists(workplace)) return '';
  const index = state.activePlanet,
    a = colonyAlloc(index),
    depot = state.planetOps.storage[index] || 0,
    fab = fabReserveUnits(index),
    floor = rawSaleFloor(index),
    toggle = (key, label) => `<button role="switch" aria-checked="${a[key]}" class="${a[key] ? 'active' : ''}" data-alloc="${key}">${label}: ${a[key] ? 'AN' : 'AUS'}</button>`,
    keep = ALLOC_KEEP_OPTIONS.map(n => `<button role="radio" aria-checked="${n === a.keep}" class="${n === a.keep ? 'active' : ''}" data-alloc-keep="${n}">${n ? fmt(n) : 'Keiner'}</button>`).join(''),
    first = [['production', 'Produktion zuerst'], ['sale', 'Verkauf zuerst']].map(([id, label]) => `<button role="radio" aria-checked="${a.priority === id}" class="${a.priority === id ? 'active' : ''}" data-alloc-priority="${id}">${label}</button>`).join('');
  return `<div class="sheet-reserve sheet-alloc"><div class="reserve-head"><b>Verteilung</b><small>Was das Lager automatisch verkauft und was es für deine Produktion behält.</small></div><div class="reserve-options alloc-sell">${toggle('sellRaw', 'Rohkristalle verkaufen')}${toggle('sellBars', 'Barren verkaufen')}</div><div class="reserve-head"><small>Mindestbestand Rohkristalle</small></div><div class="reserve-options alloc-keep" role="radiogroup" aria-label="Mindestbestand">${keep}</div><div class="reserve-options alloc-sell" role="radiogroup" aria-label="Vorrang">${first}</div><p class="reserve-facts"><span>Lager ${fmt(depot)}</span>${fab > 0 ? `<span class="ok">Für Aufträge reserviert ${fmt(fab)}</span>` : ''}<span>Verkauf ab ${fmt(floor)}</span><span>${a.sellRaw ? 'verkaufbar ' + fmt(Math.max(0, depot - floor)) : 'Rohkristalle bleiben im Lager'}</span></p></div>`;
}
// What the manager's training does at this workplace (the elevator manager improves routing, not throughput).
function managerEffectText(workplace) {
  if (workplace === 'elevator' && typeof elevatorTrainingText === 'function') return elevatorTrainingText();
  return '×' + workplaceEfficiency(workplace).toFixed(2);
}
// Beta 1.7 M4: the station's measured throughput, its use and what holds it back (with a one-tap fix when there is one)
const STATION_STATUS = { ok: ['läuft', 'ok'], full: ['voll ausgelastet', 'full'], starved: ['wartet auf Nachschub', 'warn'], blocked: ['staut sich', 'warn'], spare: ['hat Luft', 'ok'], manual: ['Handbetrieb', 'idle'] };
function stationRow(workplace) {
  if (typeof stationReport !== 'function' || !workplaceExists(workplace)) return '';
  const rep = stationReport(workplace);
  if (!rep) return '';
  const [label, cls] = STATION_STATUS[rep.status] || STATION_STATUS.ok,
    rate = v => (v > 0 && v < 10 ? v.toFixed(1).replace('.', ',') : fmt(v)),
    action = rep.action ? `<button class="station-fix" data-station-fix='${JSON.stringify(rep.action).replace(/'/g, '&#39;')}'>${rep.action.label}</button>` : '';
  return `<div class="sheet-station ${cls}"><div class="station-head"><b>Durchsatz ${rate(rep.rate)} / ${rate(rep.cap)} ${rep.unit}</b><em>${label}</em></div><i class="station-bar"><u style="width:${Math.round(rep.use * 100)}%"></u></i>${rep.hint ? '<small>' + rep.hint + '</small>' : ''}${action}</div>`;
}
document.addEventListener('click', event => {
  const fix = event.target.closest('[data-station-fix]');
  if (!fix) return;
  let action = null;
  try {
    action = JSON.parse(fix.dataset.stationFix);
  } catch {}
  if (!action) return;
  if (action.alloc) {
    const a = colonyAlloc();
    if (action.alloc.keep !== undefined && ALLOC_KEEP_OPTIONS.includes(action.alloc.keep)) a.keep = action.alloc.keep;
    if (action.alloc.priority) a.priority = action.alloc.priority === 'sale' ? 'sale' : 'production';
    requestSave(200);
  }
  feedback('open');
  if (action.sheet !== undefined) return openBuildingSheet(action.sheet);
  renderBuildingSheet();
});
// Beta 1.7 M5: the drill station's sheet shows the fuel it feeds and offers TANKEN (up to the full tank)
function refuelRow(workplace) {
  if (workplace !== 'resinDrill' || !workplaceExists('resinDrill')) return '';
  const fuel = colonyAt().goods?.starFuel || 0,
    room = Math.floor((fuelTankCapacity() - state.fuel) / STAR_FUEL_UNITS),
    n = Math.min(Math.floor(fuel), room);
  return `<div class="sheet-reserve"><div class="reserve-head"><b>⚗ Sternentreibstoff ${fmt(fuel)}</b><small>Tank ${fmt(state.fuel)} / ${fmt(fuelTankCapacity())}. Unter halbem Tank füllt die Kolonie selbst nach (1 Einheit = ${STAR_FUEL_UNITS} Treibstoff). Hergestellt in der Fertigung aus 8 Sternenharz.</small></div><button class="station-fix" data-refuel ${n > 0 ? '' : 'disabled'}>${n > 0 ? 'TANKEN · +' + n * STAR_FUEL_UNITS + ' TREIBSTOFF' : fuel >= 1 ? 'TANK VOLL' : 'KEIN STERNENTREIBSTOFF'}</button></div>`;
}
document.addEventListener('click', event => {
  if (!event.target.closest('[data-refuel]')) return;
  const n = refuelFromStarFuel(state.activePlanet, true);
  if (n > 0) {
    toast('Getankt: +' + n * STAR_FUEL_UNITS + ' Treibstoff');
    feedback('collect', 'light');
  }
  renderBuildingSheet();
  render();
});
function managerRow(workplace) {
  if (!workplaceExists(workplace)) return '';
  const job = WORKPLACE[workplace].job,
    duty = managerOnDuty(workplace),
    owned = Object.keys(state.meta.managers.roster).filter(id => SPECIALIST[id].job === job);
  let html;
  if (duty?.kind === 'special') {
    const def = SPECIALIST[duty.id];
    html = `<div class="sheet-manager">${portraitImg(job, duty.id)}<div><b>${def.name} · Rang ${duty.rank}</b><small>${PROFESSIONS[job].name}-Spezialist · ${WORKPLACE[workplace].stage} automatisch · ${managerEffectText(workplace)}</small></div><button data-unassign="${duty.id}">ABZIEHEN</button></div>`;
  } else if (duty) {
    const price = staffUpgradeCost(workplace),
      max = duty.level >= STAFF_MAX_LEVEL;
    html = `<div class="sheet-manager">${portraitImg(job)}<div><b>${workplaceTitle(workplace)} · Lv ${duty.level}</b><small>${duty.converted ? 'Übernommen aus deinem alten Betrieb · ' : ''}${WORKPLACE[workplace].stage} automatisch · ${managerEffectText(workplace)}</small></div><button data-train="${workplace}" ${max || state.credits < price ? 'disabled' : ''}>${max ? 'MAX' : 'FORTBILDEN · ◈ ' + fmt(price)}</button></div>`;
  } else {
    const price = hireCost(workplace);
    html = `<div class="sheet-manager manual"><i class="manager-icon">${PROFESSIONS[job].icon}</i><div><b>Handbetrieb</b><small>Ein ${workplaceTitle(workplace)} übernimmt nur ${WORKPLACE[workplace].stage} – sonst nichts.</small></div><button data-hire="${workplace}" ${state.credits < price ? 'disabled' : ''}>EINSTELLEN · ◈ ${fmt(price)}</button></div>`;
  }
  const choices = owned.filter(id => specialistAt(state.activePlanet, workplace) !== id);
  if (choices.length)
    html += `<div class="sheet-specialists">${choices
      .map(id => {
        const where = state.meta.managers.assign[id];
        return `<button data-assign="${id}:${workplace}">★ ${SPECIALIST[id].name} R${specialistRank(id)}${where ? ' (' + PLANETS[where.planet].name.split(' ')[0] + ')' : ''}</button>`;
      })
      .join('')}</div>`;
  return html;
}
let sheetDetailsOpen = false;
document.addEventListener('click', event => {
  if (!event.target.closest('[data-sheet-more]')) return;
  sheetDetailsOpen = !sheetDetailsOpen;
  renderBuildingSheet();
});
function renderIndustrySheet(sheet, key) {
  const workplace = SHEET_WORKPLACE[key] ?? null,
    legacy = typeof key === 'number';
  let icon, title, role, effect, buy, batchBar = "";
  if (legacy) {
    const b = state.buildings[key],
      info = BUILDING_INFO[key],
      price = cost(b),
      ok = state.credits >= price;
    icon = b.icon;
    title = b.level ? info.title + ' · Lv ' + b.level : info.title + ' bauen';
    role = info.role;
    effect = buildingEffectText(b, key) + ' · nächster Meilenstein Lv ' + nextMilestoneLevel(b.level);
    // Beta 1.3: +1 / +10 / MAX for built buildings (batch-ui.js); the first build stays a single purchase
    buy =
      b.level && typeof batchButtonHTML === 'function'
        ? batchButtonHTML('building', key, null, `data-buy="${key}"`, 'sheet-buy', 'VERBESSERN · ')
        : `<button class="sheet-buy ${ok ? 'affordable' : ''}" data-buy="${key}" ${ok ? '' : 'disabled'}>${b.level ? 'VERBESSERN' : 'BAUEN'} · ◈ ${fmt(price)}</button>`;
    batchBar = b.level && typeof batchToggleHTML === 'function' ? batchToggleHTML() : '';
  } else {
    const def = INDUSTRY_BUILDINGS[key],
      level = industryLevel(key),
      price = industryCost(key),
      unlocked = industryUnlocked(key),
      ok = unlocked && state.credits >= price;
    icon = def.icon;
    title = level ? def.name + ' · Lv ' + level : def.name + ' bauen';
    role = INDUSTRY_ROLE[key];
    effect = unlocked
      ? industryEffectText(key) + ' · nächster Meilenstein Lv ' + nextMilestoneLevel(level)
      : !planetAllows(key)
        ? 'Nur auf Glacies Niva'
        : def.needs
          ? 'Freischaltung: ' + INDUSTRY_BUILDINGS[def.needs].name + ' bauen'
          : 'Freischaltung: Lagerhaus Lv ' + def.unlockDepot;
    buy =
      level && unlocked && typeof batchButtonHTML === 'function'
        ? batchButtonHTML('industry', key, null, `data-build-industry="${key}"`, 'sheet-buy', 'VERBESSERN · ')
        : `<button class="sheet-buy ${ok ? 'affordable' : ''}" data-build-industry="${key}" ${ok ? '' : 'disabled'}>${level ? 'VERBESSERN' : 'BAUEN'} · ◈ ${fmt(price)}</button>`;
    batchBar = level && unlocked && typeof batchToggleHTML === 'function' ? batchToggleHTML() : '';
  }
  const manual = workplace && workplaceExists(workplace) ? `<button class="sheet-manual" data-manual="${workplace}">${WORKPLACE[workplace].verb}</button>` : '';
  // Beta 1.7: level 1 (what it does, its manager, special actions, the upgrade) first; level 2 (stocks and the
  // distribution) behind "Details"; the K62 recipe reserve of specialty buildings stays on level 1, so the upgrade button is in reach on a phone without scrolling the panel
  const details = workplace ? stockChips(workplace) + allocRow(workplace) : '';
  setHTML(
    sheet,
    `<button class="sheet-close" data-close-sheet aria-label="Schließen">×</button><div class="sheet-head"><span>${icon}</span><div><b>${title}</b><small>${role}</small></div></div><p class="sheet-effect">${effect}</p>${workplace ? stationRow(workplace) : ''}${workplace ? refuelRow(workplace) : ''}${workplace ? reserveRow(workplace) : ''}${workplace ? managerRow(workplace) : ''}${window.sheetExtra?.(key) || ''}${batchBar}<div class="sheet-actions">${manual}${buy}</div>${details ? `<button class="sheet-more" data-sheet-more aria-expanded="${sheetDetailsOpen}">${sheetDetailsOpen ? 'Details ▴' : 'Details: Lager und Verteilung ▾'}</button>${sheetDetailsOpen ? `<div class="sheet-details">${details}</div>` : ''}` : ''}`
  );
  sheet.classList.remove('hidden');
}
function buildIndustry(id) {
  if (!INDUSTRY_BUILDINGS[id] || !industryUnlocked(id)) return false;
  if (industryCapped(id)) {
    const planets = INDUSTRY_BUILDINGS[id].planets || [];
    return (
      toast(
        planets.includes('machine')
          ? 'Freigabe verweigert: Über Stufe ' + MEKHANOS_LEVEL_CAP + ' fehlt Formular 7-B – erst Cogsworth-9 reparieren.'
          : planets.includes('volcanic')
            ? 'Über Stufe ' + PYRA_LEVEL_CAP + ' überhitzt die Schmelze – erst Emberbell neu kalibrieren.'
            : 'Die tiefe Frostschicht ist versiegelt – erst Frostbyte reparieren.'
      ),
      false
    );
  }
  const price = industryCost(id);
  if (state.credits < price) return toast('Noch ' + fmt(price - state.credits) + ' Credits nötig'), false;
  state.credits -= price;
  state.planetOps.investment[state.activePlanet] += price;
  const colony = colonyAt();
  colony.industry[id]++;
  const level = colony.industry[id];
  GameEvents.emit('upgrade', { index: id, level, milestone: milestonesReached(level) > milestonesReached(level - 1), visualStage: [1, 10, 25, 50].includes(level) });
  feedback('upgrade', 'light');
  if (level === 1) {
    const reserved = recommendRawReserve(id);
    toast(INDUSTRY_BUILDINGS[id].name + ' gebaut!' + (reserved ? ' Rohkristall-Reserve: ' + RESERVE_RECOMMENDED + ' Chargen (änderbar im Gebäude).' : ''));
  }
  checkIndustryMilestones();
  save();
  render();
  return true;
}

// ----- Hero chain + pipeline card -----
// Dock preference (per viewer convenience; storage may be unavailable).
let dockExpanded = false;
try {
  dockExpanded = localStorage.getItem('sk-dock-expanded') === '1';
} catch {}
document.getElementById('dockToggle')?.addEventListener('click', () => {
  dockExpanded = !document.body.classList.contains('dock-collapsed') ? false : true;
  try {
    localStorage.setItem('sk-dock-expanded', dockExpanded ? '1' : '0');
  } catch {}
  renderIndustryChain();
});
function renderIndustryChain() {
  const auto = colonyAutomation(),
    colony = colonyAt(),
    depot = state.planetOps.storage[state.activePlanet] || 0,
    pileCap = pileCapacity(),
    depotCap = storageCapacity(),
    sellsAuto = auto.stall || auto.dock,
    set = (id, text) => $(id) && ($(id).textContent = text),
    mode = (id, on) => {
      set(id, on ? 'AUTO ✓' : 'Handarbeit');
      $(id)?.classList.toggle('auto', on);
    };
  mode('mineMode', auto.mine);
  mode('railMode', auto.rail);
  mode('stallMode', sellsAuto);
  set('pileValue', 'Halde ' + fmt(colony.stock.pile));
  set('depotValue', 'Lager ' + fmt(depot) + (colony.stock.bars >= 1 ? ' · ' + fmt(colony.stock.bars) + ' ▰' : '') + (colony.stock.cells >= 1 ? ' · ' + fmt(colony.stock.cells) + ' ♨' : ''));
  if ($('pileFill')) $('pileFill').style.width = Math.min(100, (colony.stock.pile / Math.max(1, pileCap)) * 100) + '%';
  if ($('depotFill')) $('depotFill').style.width = Math.min(100, (depot / Math.max(1, depotCap)) * 100) + '%';
  const autoCount = [auto.mine, auto.rail, sellsAuto].filter(Boolean).length;
  set('chainAuto', autoCount === 3 ? '✓ Vollautomatisch' : autoCount + '/3 automatisch');
  document.body.classList.toggle('home-active', currentScreen() === 'home');
  const collapsed = autoCount === 3 && !dockExpanded;
  document.body.classList.toggle('dock-collapsed', collapsed);
  if ($('dockToggle')) {
    $('dockToggle').hidden = autoCount < 3;
    $('dockToggle').textContent = collapsed ? 'HANDBETRIEB ▴' : 'EINKLAPPEN ▾';
    $('dockToggle').setAttribute('aria-expanded', String(!collapsed));
  }
  [
    ['collectButton', auto.mine, false],
    ['cartButton', auto.rail, colony.stock.pile >= pileCap * 0.95],
    ['sellButton', sellsAuto, depot >= depotCap * 0.95]
  ].forEach(([id, on, blocked]) => {
    const el = $(id);
    if (!el) return;
    el.classList.toggle('manual', !on);
    el.classList.toggle('auto', on);
    el.classList.toggle('blocked', blocked);
  });
  // Live production card: the real stage rates of the visited colony.
  const r = colonyRates(),
    sell2 = (auto.stall ? r.S1 : 0) + (auto.dock ? r.S2 : 0),
    bottleneck = stageBottleneck();
  set('extractRate', auto.mine ? fmt(r.E) + ' /s' : 'Handarbeit');
  set('storageValue', fmt(depot) + ' / ' + fmt(depotCap));
  set('transportRate', sellsAuto ? fmt(sell2) + ' /s' : 'Handverkauf');
  set('pipelineHint', bottleneck.text);
  set('dockHint', autoCount === 3 ? bottleneck.text.replace(/ –.*$/, '') : '');
  set('pipelineStatus', [auto.mine, auto.rail, sellsAuto].every(Boolean) ? 'AUTOMATISCH' : 'HANDBETRIEB');
  if ($('storageFill')) $('storageFill').style.width = Math.min(100, (depot / Math.max(1, depotCap)) * 100) + '%';
  if ($('sceneStatus')) {
    const manualStage = ![auto.mine, auto.rail, sellsAuto].every(Boolean),
      status = manualStage
        ? ['Handbetrieb', 'idle']
        : depot >= depotCap * 0.92
          ? ['Lager voll', 'limited']
          : colony.stock.pile >= pileCap * 0.92
            ? ['Halde voll', 'limited']
            : bottleneck.id === 'stall'
              ? ['Verkauf am Limit', 'limited']
              : bottleneck.id === 'rail'
                ? ['Lore am Limit', 'limited']
                : bottleneck.id === 'refinery'
                  ? ['Raffinerie wartet', 'limited']
                  : ['Alles läuft', 'balanced'];
    $('sceneStatus').textContent = status[0];
    $('sceneStatus').className = 'scene-status ' + status[1];
  }
}
// Tutorial objective: the next manager to hire (story objectives keep priority).
function industryObjective() {
  const auto = colonyAutomation(),
    steps = [
      ['mine', 0, '⛏'],
      ['rail', 'rail', '🛒'],
      ['stall', 'stall', '◈']
    ];
  for (const [workplace, sheet, icon] of steps) {
    if (auto[workplace] || (workplace === 'stall' && auto.dock)) continue;
    const price = hireCost(workplace),
      ready = state.credits >= price;
    return [
      icon,
      ready ? workplaceTitle(workplace) + ' einstellen' : 'Abbauen · Lore · Verkaufen',
      ready
        ? 'Er übernimmt ' + WORKPLACE[workplace].stage + ' – und nur das. Tippe hier, um ihn einzustellen.'
        : 'Mach die Kette per Hand: abbauen, Lore schicken, verkaufen. Spare ◈ ' + fmt(price) + ' für den ' + workplaceTitle(workplace) + '.',
      ready ? 'EINSTELLEN ›' : 'KOLONIE ›',
      sheet
    ];
  }
  return null;
}
const renderObjectiveBeforeIndustry = renderObjective;
renderObjective = function () {
  renderObjectiveBeforeIndustry();
  const card = $('objectiveCard');
  card.dataset.sheet = '';
  const story = pips().stage;
  if (story === 'warned' || story === 'battle' || story === 'defeated') return;
  const goal = industryObjective();
  if (!goal) return;
  $('objectiveIcon').textContent = goal[0];
  $('objectiveTitle').textContent = goal[1];
  $('objectiveText').textContent = goal[2];
  $('objectiveAction').textContent = goal[3];
  card.dataset.screen = 'home';
  card.dataset.sheet = String(goal[4]);
};

// ----- Confirmation dialog: the state changes only after OK, exactly once per confirmation -----
let pendingConfirm = null;
function askConfirm(kicker, title, bodyHtml, okLabel, action) {
  pendingConfirm = action;
  $('confirmKicker').textContent = kicker;
  $('confirmTitle').textContent = title;
  setHTML($('confirmBody'), bodyHtml);
  $('confirmOk').textContent = okLabel;
  openModal('confirmModal');
}
$('confirmOk').onclick = () => {
  const action = pendingConfirm;
  pendingConfirm = null;
  closeModal('confirmModal');
  action?.();
};

// ----- Manager office: specialists, talent capsules, fusion -----
let managerFilter = 'all';
let managerSelected = null;
// Beta 1.5: the frame shows the earned rank (never a random rarity: every specialist has the same 1/7 chance)
const RANK_FRAMES = ['', 'Bronze', 'Silber', 'Gold', 'Kristall', 'Sternen'];
const RANK_REVEAL = ['common', 'rare', 'rare', 'epic', 'epic', 'legendary'];
function managerCollectionText() {
  const m = state.meta.managers,
    owned = Object.keys(m.roster).length,
    ranks = Object.values(m.roster).reduce((sum, e) => sum + (e.rank || 0), 0);
  return owned + ' / ' + SPECIALISTS.length + ' · Ränge ' + ranks + ' / ' + SPECIALISTS.length * SPECIALIST_MAX_RANK;
}
function rankStars(rank) {
  return '★'.repeat(rank) + '☆'.repeat(SPECIALIST_MAX_RANK - rank);
}
function specialistPortrait(id, size = 144) {
  const def = SPECIALIST[id],
    url = window.SpaceKittens?.managerPortraitURL?.(id, def.look, def.outfit, size, Math.max(1, specialistRank(id)));
  return url ? `<img src="${url}" alt="${def.name}" width="72" height="72" />` : `<i class="manager-icon">${PROFESSIONS[def.job].icon}</i>`;
}
function specialistLocation(id) {
  const where = state.meta.managers.assign[id];
  return where ? PLANETS[where.planet].name + ' · ' + WORKPLACE[where.workplace].name : 'Frei';
}
function homeWorkplaceFor(id) {
  return WORKPLACES.find(w => w.job === SPECIALIST[id].job && workplaceExists(w.id))?.id || null;
}
function renderManagerOffice() {
  const grid = $('managerGrid');
  if (!grid) return;
  const managers = state.meta.managers;
  $('specialistCount').textContent = managerCollectionText();
  setHTML(
    $('talentCard'),
    `<div class="talent-orb">✦</div><div><b>Talent-Kapseln: ${managers.capsules}</b><small>Jede Kapsel: 1 Spezialist (je 1/7 ≈ 14,3 %) + ${CAPSULE_BADGES} Abzeichen. Nach 2 Doppelten in Folge garantiert ein neuer. Nur durch Spielen – nie käuflich. Abzeichen: ${fmt(managers.badges)}</small></div><button data-open-capsule ${managers.capsules ? '' : 'disabled'}>ÖFFNEN</button>`
  );
  setHTML(
    $('managerFilter'),
    [['all', 'Alle'], ...Object.entries(PROFESSIONS).map(([id, p]) => [id, p.icon + ' ' + p.name])]
      .map(([id, label]) => `<button class="${managerFilter === id ? 'active' : ''}" data-manager-filter="${id}">${label}</button>`)
      .join('')
  );
  // Compact collection: portrait tiles; the selected specialist opens in the detail panel below.
  const visible = SPECIALISTS.filter(def => managerFilter === 'all' || def.job === managerFilter);
  if (managerSelected && !visible.some(def => def.id === managerSelected)) managerSelected = null;
  setHTML(
    grid,
    visible
      .map(def => {
        const entry = managers.roster[def.id],
          assigned = managers.assign[def.id],
          selected = managerSelected === def.id;
        if (!entry)
          return `<button class="manager-tile locked ${selected ? 'selected' : ''}" data-manager-select="${def.id}" aria-label="${def.name}, noch nicht im Team">${specialistPortrait(def.id, 120)}<b>${def.name}</b><small>${PROFESSIONS[def.job].icon} 🔒</small></button>`;
        return `<button class="manager-tile rank-${entry.rank} ${assigned ? 'on-duty' : ''} ${selected ? 'selected' : ''}" data-manager-select="${def.id}" aria-label="${def.name}, Rang ${entry.rank} (${RANK_FRAMES[entry.rank]}rahmen)"><i class="rank-frame">${RANK_FRAMES[entry.rank]}</i>${specialistPortrait(def.id, 120)}${canFuse(def.id) ? '<i class="tile-badge">↑</i>' : ''}<b>${def.name}</b><span class="rank-stars">${rankStars(entry.rank)}</span><small>${PROFESSIONS[def.job].icon} ${assigned ? 'Im Einsatz' : 'Frei'}</small></button>`;
      })
      .join('')
  );
  setHTML($('managerDetail'), managerDetailHTML(managerSelected));
}
function managerDetailHTML(id) {
  if (!id) return '<p class="manager-detail-hint">Tippe ein Kätzchen an: Bonus, Rang-Fortschritt und Einsatzort erscheinen hier.</p>';
  const managers = state.meta.managers,
    def = SPECIALIST[id],
    entry = managers.roster[id];
  if (!entry)
    return `<article class="manager-card locked">${specialistPortrait(id)}<div><h3>${def.name}</h3><span class="manager-meta">${PROFESSIONS[def.job].icon} ${PROFESSIONS[def.job].name} · noch nicht im Team</span><p>${def.title}. Kommt aus Talent-Kapseln – nur durch Spielen.</p></div></article>`;
  const need = fusionRequirement(id),
    home = homeWorkplaceFor(id),
    assigned = managers.assign[id],
    progress = need ? Math.min(1, (entry.copies / need.copies) * (need.badges ? Math.min(1, managers.badges / need.badges) : 1)) : 1;
  return `<article class="manager-card" data-specialist="${id}">${specialistPortrait(id)}<div><h3>${def.name} <span class="rank-stars">${rankStars(entry.rank)}</span></h3><span class="manager-meta">${PROFESSIONS[def.job].icon} ${PROFESSIONS[def.job].name} · Rang ${entry.rank} · ${specialistLocation(id)}</span><p><b>${def.title}:</b> ${specialistBonusText(id)}</p><p>${def.bio}</p>${need ? `<span class="fusion-bar"><u style="width:${Math.round(progress * 100)}%"></u></span><p>Rang ${need.rank}: Kopien ${entry.copies}/${need.copies}${need.badges ? ' · Abzeichen ' + fmt(managers.badges) + '/' + need.badges : ''}${need.rank === 3 ? ' · schaltet „' + def.secondary.split(':')[0] + '“ frei' : need.rank === 4 ? ' · goldene Anstecknadel' : ''}</p>` : '<p>Höchster Rang erreicht.</p>'}<div class="manager-actions"><button data-fuse="${id}" ${canFuse(id) ? '' : 'disabled'}>${need ? 'AUFWERTEN' : 'MAX'}</button>${assigned ? `<button class="secondary" data-unassign="${id}">ABZIEHEN</button>` : home ? `<button class="secondary" data-assign="${id}:${home}">HIER EINSETZEN</button>` : `<button class="secondary" disabled>KEIN ARBEITSPLATZ</button>`}</div></div></article>`;
}
function showTalentResult(kicker, title, id, text) {
  $('talentKicker').textContent = kicker;
  $('talentTitle').textContent = title;
  setHTML($('talentArt'), specialistPortrait(id, 192));
  $('talentItem').textContent = SPECIALIST[id].name + ' · ' + PROFESSIONS[SPECIALIST[id].job].name + ' · Rang ' + specialistRank(id);
  $('talentText').textContent = text;
  openModal('talentModal');
  $('talentArt').classList.remove('celebrate');
  void $('talentArt').offsetWidth;
  $('talentArt').classList.add('celebrate');
}
function openCapsuleFromUI() {
  const result = openTalentCapsule();
  if (!result) return;
  save(); // the result is stored before it is revealed (no reroll by reloading)
  window.NebulaAudio?.play('meow');
  feedback('reward', 'success');
  const def = SPECIALIST[result.id];
  showTalentResult(
    'TALENT-KAPSEL · GRATIS',
    result.isNew ? 'Neu im Team: ' + def.name + '!' : def.name + ' ist schon da',
    result.id,
    result.isNew
      ? def.bio + ' +' + result.badges + ' Abzeichen.'
      : result.converted
        ? 'Höchster Rang – die Kopie wird zu ' + result.badges + ' Abzeichen.'
        : 'Doppelt: +1 Kopie für die nächste Aufwertung, +' + result.badges + ' Abzeichen.'
  );
  render();
}
function askFusion(id) {
  const need = fusionRequirement(id);
  if (!need || !canFuse(id)) return;
  const def = SPECIALIST[id];
  askConfirm(
    'AUFWERTUNG',
    def.name + ': Rang ' + (need.rank - 1) + ' → ' + need.rank,
    specialistPortrait(id, 192) +
      `<p>Vorher: ${specialistBonusText(id)}<br />Nachher: ${specialistBonusText(id, need.rank)}</p><p>Kosten: ${need.copies} Kopien${need.badges ? ' + ' + need.badges + ' Abzeichen' : ''}. ${def.name} bleibt dieselbe Figur, behält Einsatzort und Ausstattung.</p>`,
    'AUFWERTEN',
    () => {
      if (!fuseSpecialist(id)) return;
      save();
      GameEvents.emit('manager-upgrade', { special: id, rank: specialistRank(id) });
      feedback('unlock', 'success');
      showTalentResult('AUFWERTUNG GESPEICHERT', def.name + ' ist jetzt Rang ' + specialistRank(id) + '!', id, specialistBonusText(id));
      render();
    }
  );
}

// ----- Sternenakademie -----
function renderAcademy() {
  const grid = $('academyGrid');
  if (!grid) return;
  $('academyGems').textContent = state.gems + ' ◆';
  setHTML(
    grid,
    ACADEMY.map(item => {
      const rank = academyRank(item.id),
        price = academyPrice(item.id),
        max = item.prices.length;
      return `<article class="academy-card ${price === null ? 'maxed' : ''}"><div class="academy-icon">${item.icon}</div><div><h3>${item.name}</h3><p>${item.text}</p><span class="academy-rank">Stufe ${rank} / ${max} · ${academyEffectText(item.id)}</span><br /><button data-academy="${item.id}" ${price !== null && state.gems >= price ? '' : 'disabled'}>${price === null ? 'ABGESCHLOSSEN' : 'LERNEN · ◆ ' + price}</button>${price !== null && state.gems < price ? `<p>Noch ${price - state.gems} Gems – gibt es in Bossen, Meilensteinen und der Sternenroute.</p>` : ''}</div></article>`;
    }).join('')
  );
}
function academyEffectText(id) {
  const rank = academyRank(id);
  if (id === 'deepsleep') return 'Offline-Maximum ' + Math.round(offlineCapSeconds() / 3600) + ' Std.';
  if (id === 'expedition') return 'Expeditionen ' + Math.round(expeditionDuration() / 1000) + ' s';
  return 'Manager ' + (rank ? '−' + rank * 10 + ' %' : 'Normalpreis');
}
function askAcademy(id) {
  const item = ACADEMY.find(a => a.id === id),
    price = academyPrice(id);
  if (!item || price === null || state.gems < price) return;
  askConfirm(
    'STERNENAKADEMIE',
    item.name + ' · Stufe ' + (academyRank(id) + 1),
    `<p>${item.text}.</p><p>Kosten: <b>◆ ${price}</b>. Dauerhaft – bleibt auch nach dem Galaxie-Verkauf.</p>`,
    'LERNEN · ◆ ' + price,
    () => {
      if (!buyAcademy(id)) return;
      save();
      feedback('unlock', 'success');
      toast(item.name + ' Stufe ' + academyRank(id) + ' gelernt!');
      render();
    }
  );
}

// ----- Events -----
document.addEventListener('click', event => {
  const manual = event.target.closest('[data-manual]');
  if (manual) return MANUAL_ACTIONS[manual.dataset.manual]?.();
  // Beta 1.7 M2: Verteilung
  const alloc = event.target.closest('[data-alloc], [data-alloc-keep], [data-alloc-priority]');
  if (alloc) {
    const a = colonyAlloc();
    if (alloc.dataset.alloc) a[alloc.dataset.alloc] = !a[alloc.dataset.alloc];
    if (alloc.dataset.allocKeep !== undefined) a.keep = ALLOC_KEEP_OPTIONS.includes(Number(alloc.dataset.allocKeep)) ? Number(alloc.dataset.allocKeep) : 0;
    if (alloc.dataset.allocPriority) a.priority = alloc.dataset.allocPriority === 'sale' ? 'sale' : 'production';
    feedback('open');
    requestSave(200);
    renderBuildingSheet();
    return;
  }
  const reserve = event.target.closest('[data-reserve]');
  if (reserve) {
    if (setRawReserve(Number(reserve.dataset.reserve))) {
      feedback('tap', 'light');
      save();
      render();
    }
    return;
  }
  const hire = event.target.closest('[data-hire]');
  if (hire) return hireManager(hire.dataset.hire);
  const train = event.target.closest('[data-train]');
  if (train) return trainManager(train.dataset.train);
  const build = event.target.closest('[data-build-industry]');
  if (build) return buildIndustry(build.dataset.buildIndustry);
  const assign = event.target.closest('[data-assign]');
  if (assign) {
    const [id, workplace] = assign.dataset.assign.split(':');
    return assignSpecialist(id, workplace);
  }
  const unassign = event.target.closest('[data-unassign]');
  if (unassign) return unassignSpecialist(unassign.dataset.unassign);
  if (event.target.closest('[data-open-capsule]')) return openCapsuleFromUI();
  const fuse = event.target.closest('[data-fuse]');
  if (fuse) return askFusion(fuse.dataset.fuse);
  const pick = event.target.closest('[data-manager-select]');
  if (pick) {
    managerSelected = managerSelected === pick.dataset.managerSelect ? null : pick.dataset.managerSelect;
    feedback('open');
    return renderManagerOffice();
  }
  const filter = event.target.closest('[data-manager-filter]');
  if (filter) {
    managerFilter = filter.dataset.managerFilter;
    return renderManagerOffice();
  }
  const academy = event.target.closest('[data-academy]');
  if (academy) return askAcademy(academy.dataset.academy);
  const objective = event.target.closest('#objectiveCard');
  if (objective?.dataset.sheet) {
    const key = objective.dataset.sheet;
    setTimeout(() => openBuildingSheet(/^\d+$/.test(key) ? Number(key) : key), 0);
  }
});
// Colony scene view model: real automation, managers on duty and recent flows of the viewed colony.
const SHEET_OF_WORKPLACE = { mine: 0, rail: 'rail', depot: 2, refinery: 'refinery', stall: 'stall', dock: 3, foundry: 'foundry', workshop: 'workshop', sporeGarden: 'sporeGarden', biolab: 'biolab' };
const colonyViewBeforeIndustry = window.NebulaView.colony;
window.NebulaView.colony = () => {
  const base = colonyViewBeforeIndustry(),
    index = state.activePlanet,
    colony = colonyAt(index),
    auto = colonyAutomation(index),
    flow = industryFlow[index],
    fresh = flow && Date.now() - flow.at < 2500,
    managers = {};
  WORKPLACES.forEach(w => {
    const duty = workplaceExists(w.id) ? managerOnDuty(w.id) : null;
    if (!duty) return;
    const def = duty.kind === 'special' ? SPECIALIST[duty.id] : STAFF_LOOKS[w.job];
    managers[w.id] = { ...duty, job: w.job, look: def.look, outfit: def.outfit, sheet: SHEET_OF_WORKPLACE[w.id] };
  });
  return {
    ...base,
    extraction: auto.mine ? base.extraction : 0,
    planetIndex: index,
    industry: { ...colony.industry },
    auto,
    managers,
    pileRatio: colony.stock.pile / Math.max(1, pileCapacity()),
    // Beta 1.7 M3: the cart line's real carts (transport.js), interpolated between production ticks
    transit: (() => {
      const t = colony.transit,
        lvl = colony.industry.rail || 0;
      if (!t || !lvl || typeof cartCapacity !== 'function') return null;
      const cap = cartCapacity(withPlanet(index, () => railRate())),
        age = Math.min(1.2, Math.max(0, (Date.now() - (flow?.at || Date.now())) / 1000)),
        run = (left, dur) => Math.min(1, Math.max(0, 1 - Math.max(0, left - age) / dur));
      return {
        tier: cartTier(lvl),
        auto: Boolean(auto.rail),
        loading: Math.min(1, t.loading / cap),
        loadWait: auto.rail ? Math.min(1, (t.wait + age) / CART_INTERVAL) : 0,
        carts: t.carts.map(c => ({ id: c.id, phase: c.phase, fill: c.phase === 'returning' ? 0 : Math.min(1, c.amount / cap), progress: c.phase === 'moving' || c.phase === 'returning' ? run(c.left, CART_TRAVEL) : c.phase === 'unloading' ? run(c.left, CART_UNLOAD) : 1 }))
      };
    })(),
    trip: colony.trip ? { progress: Math.min(1, Math.max(0, (Date.now() - colony.trip.departAt) / Math.max(1, colony.trip.arriveAt - colony.trip.departAt))), waiting: Date.now() >= colony.trip.arriveAt } : null,
    hopperRatio: colony.stock.hopper / Math.max(1, hopperCapacity()),
    barsRatio: colony.stock.bars / Math.max(1, barCapacity()),
    packedRatio: (colony.stock.packed || 0) / Math.max(1, packCapacity(index)),
    resinRatio: (colony.stock.resin || 0) / Math.max(1, resinCapacity(index)),
    coreHealed: typeof coreSaleFactor === 'function' && coreSaleFactor(index) > 1,
    refineryUnlocked: industryUnlocked('refinery'),
    thermalUnlocked: industryUnlocked('thermal'),
    frostRatio: (colony.stock.frost || 0) / Math.max(1, frostCapacity()),
    cellsRatio: (colony.stock.cells || 0) / Math.max(1, cellCapacity()),
    emberRatio: (colony.stock.ember || 0) / Math.max(1, emberCapacity()),
    alloyRatio: (colony.stock.emberAlloy || 0) / Math.max(1, alloyCapacity()),
    cooled: (colony.stock.cells || 0) >= 1,
    precisionRatio: (colony.stock.precisionOre || 0) / Math.max(1, precisionOreCapacity()),
    partsRatio: (colony.stock.precisionParts || 0) / Math.max(1, partsCapacity()),
    sporeRatio: (colony.stock.spores || 0) / Math.max(1, sporeCapacity()),
    gelRatio: (colony.stock.biogel || 0) / Math.max(1, biogelCapacity()),
    biolabUnlocked: industryUnlocked('biolab'),
    flow: {
      frost: Boolean(fresh && flow.frostExtracted > 0),
      thermal: Boolean(fresh && flow.cellsMade > 0),
      smelting: Boolean(fresh && flow.alloysMade > 0),
      assembling: Boolean(fresh && flow.partsMade > 0),
      sporing: Boolean(fresh && flow.sporesExtracted > 0),
      brewing: Boolean(fresh && flow.gelMade > 0),
      mining: Boolean(fresh && flow.extracted > 0),
      // Beta 1.7 M3: the carts deliver in batches – the line counts as moving while carts are out or loading
      moving: Boolean((fresh && flow.moved > 0) || (auto.rail && ((colony.transit?.carts?.length || 0) > 0 || (colony.transit?.loading || 0) > 0))),
      packing: Boolean(fresh && flow.packedNow > 0),
      pumping: Boolean(fresh && flow.resinExtracted > 0),
      feeding: Boolean(fresh && flow.fed > 0),
      refining: Boolean(fresh && flow.processed > 0),
      selling: Boolean(fresh && flow.rawSold + flow.barsSold + (flow.packedSold || 0) > 0)
    }
  };
};
window.NebulaColonyActions.sendCart = () => sendCart();
window.NebulaColonyActions.sell = workplace => sellGoods(workplace || 'stall');

let milestoneCheckAt = 0;
const renderBeforeIndustry = render;
render = () => {
  renderBeforeIndustry();
  renderIndustryChain();
  if (currentScreen() === 'crew') renderManagerOffice();
  if (currentScreen() === 'prestige') renderAcademy();
  if (Date.now() - milestoneCheckAt >= 1000) {
    milestoneCheckAt = Date.now();
    checkIndustryMilestones();
  }
};
render();
// Screens with industry content render immediately when opened (not only on the next tick).
const showScreenBeforeIndustry = showScreen;
showScreen = screen => {
  showScreenBeforeIndustry(screen);
  renderIndustryChain();
  if (currentScreen() === 'crew') renderManagerOffice();
  if (currentScreen() === 'prestige') renderAcademy();
};

// Production list: the new industry buildings next to the classic four.
function industryProductionCards() {
  return Object.entries(INDUSTRY_BUILDINGS)
    .filter(([id]) => planetAllows(id))
    .map(([id, def]) => {
      const level = industryLevel(id),
        unlocked = industryUnlocked(id),
        price = industryCost(id),
        ok = unlocked && state.credits >= price,
        workplace = WORKPLACE[id],
        duty = workplaceExists(id) ? managerOnDuty(id) : null;
      return `<article class="production-card"><div class="building-icon">${def.icon}</div><div class="production-info"><h3>${def.name} <small>Lv. ${level}</small></h3><p>${unlocked ? industryEffectText(id) : def.needs ? 'Freischaltung: ' + INDUSTRY_BUILDINGS[def.needs].name : 'Freischaltung: Lagerhaus Lv ' + def.unlockDepot} · ${INDUSTRY_ROLE[id].split('.')[0]}.</p><small class="milestone-note">${workplace ? (duty ? PROFESSIONS[workplace.job].name + '-Manager im Dienst' : level ? 'Handbetrieb – Manager am Gebäude einstellen' : '') : ''}</small></div><button class="buy-button ${ok ? 'affordable' : ''}" data-build-industry="${id}" ${ok ? '' : 'disabled'}>${!unlocked ? 'GESPERRT' : ok ? (level ? 'UPGRADE' : 'BAUEN') : 'NOCH ' + fmt(price - state.credits)}<br><small>◈ ${fmt(price)}</small></button></article>`;
    })
    .join('');
}
render();
