// Deep Core UI: the underground view inside the colony card (same planet, same state), its HUD, the mine dock,
// shaft / elevator / construction / overview sheets, story beats and sounds. Logic lives in deepcore.js.
// Loaded after combat-ui.js and before platform.js / scenes/boot.js.

let mineView = false;
let mineSelected = 'mine';
try {
  mineView = sessionStorage.getItem('sk-mine-view') === '1';
} catch {}
// Measured rates (rolling, ~30 s): what carriers really put down per shaft and what the elevator really lifted.
// The sheets show capacities separately — a label never claims goods that did not arrive.
const measured = {};
function updateMeasured(planet = state.activePlanet) {
  const flow = industryFlow[planet],
    m = (measured[planet] = measured[planet] || { at: 0, lifted: 0, shafts: {} });
  if (!flow || flow.at === m.at || !(flow.seconds > 0)) return m;
  const w = 1 - Math.exp(-flow.seconds / 30),
    ema = (old, value) => old + (value / flow.seconds - old) * w;
  m.at = flow.at;
  m.lifted = ema(m.lifted, flow.lifted || 0);
  ALL_SHAFT_IDS.forEach(id => (m.shafts[id] = ema(m.shafts[id] || 0, flow.deposited?.[id] || 0)));
  return m;
}
function measuredShaft(id, planet = state.activePlanet) {
  return updateMeasured(planet).shafts[id] || 0;
}
// Header height of the HUD over the mine canvas (the scene reserves this band; see scenes/mine-scene.js).
let mineHeaderPx = 0;
function measureMineHeader() {
  // the floors start under the HUD's lowest row (Beta 1.7: on phones the bottleneck chip shares the top row)
  const hud = $('mineHud');
  if (!hud || !mineView) return;
  const top = hud.getBoundingClientRect().top,
    rows = [...hud.querySelectorAll('.mine-top, .mine-sub, .mine-nav')].map(el => el.getBoundingClientRect()).filter(r => r.height > 0);
  if (rows.length) mineHeaderPx = Math.max(...rows.map(r => r.bottom - top)) + 6;
}
// Entering the mine brings the whole mine card into view (it is sized to the space above the dock and navigation).
function scrollMineIntoView() {
  const card = $('heroCard');
  if (!card) return;
  requestAnimationFrame(() => window.scrollTo(0, Math.max(0, card.getBoundingClientRect().top + window.scrollY - 8)));
}
function setMineView(on) {
  const entering = Boolean(on) && !mineView;
  mineView = Boolean(on);
  try {
    sessionStorage.setItem('sk-mine-view', mineView ? '1' : '0');
  } catch {}
  syncMineView();
  const rt = window.NebulaScenesRuntime;
  Object.values(rt?.mounted || {}).forEach(m => m.handle.refresh());
  if (mineView) window.NebulaAudio?.play('open');
  render();
  if (entering) scrollMineIntoView();
}
function mineScene() {
  return window.NebulaScenesRuntime?.mounted?.mine?.scene || null;
}
function dcTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  if (s < 60) return s + ' s';
  if (s < 3600) return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') + ' min';
  return Math.floor(s / 3600) + ' h ' + Math.floor((s % 3600) / 60) + ' min';
}
// Rates below 10/s keep one decimal (an early elevator moves 2,7/s, not "3").
function fmtRate(value) {
  return value > 0 && value < 10 ? value.toFixed(1).replace('.', ',') : fmt(value);
}
function kisten(units) {
  const n = units / KISTE;
  return (n >= 10 ? fmt(n) : n.toFixed(n % 1 ? 1 : 0).replace('.', ',')) + (n === 1 ? ' Kiste' : ' Kisten');
}
function elevatorTrainingText(planet = state.activePlanet) {
  const t = elevatorTraining(planet);
  return 'Ladezeit ' + elevatorLoadTime(planet).toFixed(1).replace('.', ',') + ' s' + (t >= 3 ? ' · plant faire Ladung' : ' · ab Lv 3 faire Planung') + (t >= 5 ? ' · lässt fast leere Rampen aus' : '');
}

// ----- view model for scenes/mine-scene.js (pure read; phases are live references to the saved state) -----
function managerVisual(workplace, planet = state.activePlanet) {
  if (!workplaceExists(workplace, planet)) return null;
  const duty = managerOnDuty(workplace, planet);
  if (!duty) return null;
  const def = duty.kind === 'special' ? SPECIALIST[duty.id] : STAFF_LOOKS[WORKPLACE[workplace].job];
  return { look: def.look, outfit: def.outfit, kind: duty.kind, rank: duty.rank || 1, job: WORKPLACE[workplace].job };
}
function shaftSubText(id, planet, open, isAuto) {
  if (!open) return (isAuto ? '+' + fmt(shaftMining(id, planet)) + '/s' : 'Handbetrieb') + ' · direkt zur Halde';
  const s = shaftState(id, planet),
    got = measuredShaft(id, planet);
  // measured delivery to the Schachtlager (not the theoretical capacity)
  const rate = isAuto ? (got > 0.05 ? 'liefert ' + fmtRate(got) + '/s' : 'läuft an') : 'Handbetrieb';
  return rate + ' · Lager ' + fmt(s.platform) + '/' + fmt(shaftCapacity(id, planet));
}
// depth zones of the visited mine that have at least one floor (in depth order) — for the zone jump button
let mineZoneAt = -1;
function mineZones(planet = state.activePlanet) {
  const def = deepCoreDef(planet),
    seen = new Set(mineFloors(planet).filter(f => f.kind !== 'future').map(f => f.zone));
  return def ? def.zones.filter(z => seen.has(z.id)) : [];
}
function mineFloors(planet = state.activePlanet) {
  const def = deepCoreDef(planet),
    open = undergroundOpen(planet),
    auto = colonyAutomation(planet),
    floors = [];
  if (!def) return floors;
  const zoneName = zone => def.zones.find(z => z.id === zone)?.name || '';
  def.shafts.forEach(sd => {
    const id = sd.id;
    if (shaftUnderConstruction(id, planet)) {
      const b = shaftState(id, planet).build,
        progress = constructionProgress(id, planet);
      floors.push({ kind: 'construction', id, depth: sd.depth, zone: sd.zone, zoneName: zoneName(sd.zone), name: sd.name, title: sd.title, build: b, progress, phase: constructionPhase(progress), sub: constructionPhase(progress) + ' · noch ' + dcTime(b.left) });
      return;
    }
    if (!shaftBuilt(id, planet)) return;
    const s = shaftState(id, planet),
      level = shaftLevel(id, planet),
      isAuto = Boolean(auto[id]),
      cap = open ? shaftCapacity(id, planet) : pileCapacity(),
      stock = open ? s.platform : state.colonies[planet].stock.pile,
      ratio = Math.min(1, stock / Math.max(1, cap)),
      faceCap = open ? faceCapacity(id, planet) : 1;
    floors.push({
      kind: 'shaft',
      id,
      depth: sd.depth,
      zone: sd.zone,
      zoneName: zoneName(sd.zone),
      name: sd.name,
      title: sd.title,
      level,
      stage: shaftStage(level),
      haulStage: haulStage(trackLevel(id, 'haul', planet)),
      look: sd.look || null,
      freed: typeof cogsworthFriendly === 'function' && cogsworthFriendly(),
      storeStage: open ? (trackLevel(id, 'store', planet) >= 25 ? 3 : trackLevel(id, 'store', planet) >= 10 ? 2 : 1) : 1,
      ratio,
      faceRatio: open ? Math.min(1, s.face / Math.max(1, faceCap)) : 0,
      full: open && ratio > 0.97,
      auto: isAuto,
      working: isAuto && (!open || s.face < faceCap - 1e-6),
      miners: minerCount(id, planet),
      carriers: open ? s.carriers : [],
      carrierLoad: open ? carrierLoad(id, planet) : 1,
      manual: s.manual,
      manualRef: Math.max(1, open ? HAND.seconds * shaftBase(id, planet) : 1),
      manager: managerVisual(id, planet),
      selected: mineSelected === id,
      limit: open ? shaftLimit(id, planet) : 'mining',
      sub: shaftSubText(id, planet, open, isAuto)
    });
  });
  if (open && def.frostFloor) {
    const c = state.colonies[planet],
      built = c.industry.frostDrill > 0;
    floors.push({
      kind: built ? 'frost' : 'frontier',
      id: 'frostDrill',
      depth: def.frostFloor,
      zone: 'frost',
      zoneName: 'Frostschicht',
      title: built ? 'Frostquarz-Bohrer · Lv ' + c.industry.frostDrill : 'Frostschicht',
      sub: built ? (auto.frostDrill ? '+' + fmt(withPlanet(planet, () => frostRate())) + '/s Frostquarz' : 'Handbetrieb') : 'Frostquarz-Bohrer bauen ›',
      locked: false,
      ratio: built ? (c.stock.frost || 0) / Math.max(1, withPlanet(planet, () => frostCapacity())) : 0,
      working: built && auto.frostDrill,
      auto: built && auto.frostDrill,
      heated: glaciesHeated(planet),
      friendly: frostbyte().stage === 'repaired',
      manager: built ? managerVisual('frostDrill', planet) : null
    });
  }
  if (planet === 0 && conduitState() !== 'hidden') {
    const repaired = conduitState() === 'repaired';
    // the old maintenance conduit belongs to the crystal geodes: right below Schacht 6, above the deeper zones (Beta 1.4)
    const conduit = { kind: 'conduit', id: 'conduit', zone: 'geode', state: conduitState(), title: 'Alte Wartungsleitung', sub: repaired ? 'Schnurrnetz-Lift aktiv · Aufzug +20 % Tempo' : 'Reparatur möglich ›' },
      below = floors.findIndex(f => (f.depth || 0) > 6);
    if (below < 0) floors.push(conduit);
    else floors.splice(below, 0, conduit);
  }
  // Beta 1.7 M9: the planetary core below the deepest shaft (Orion's Kristallkern)
  if (planet === 0 && typeof corePhase === 'function' && corePhase('crystal') !== 'hidden') {
    const phase = corePhase('crystal'),
      st = coreStage('crystal'),
      def = CORES.crystal;
    floors.push({ kind: 'core', id: 'core', zone: 'geode', phase, stage: st, title: def.name + (phase === 'healed' ? ' · geheilt' : ' · ' + st + '/3 geheilt'), sub: phase === 'healed' ? 'Orion ist verwandelt' : def.stages[st].name + ' ›' });
  }
  // construction frontier: the next shaft of this planet (or the mine opening itself)
  const next = def.shafts.find(s => s.id !== 'mine' && !shaftBuilt(s.id, planet) && !shaftUnderConstruction(s.id, planet));
  if (!open) floors.push({ kind: 'frontier', id: 'open', zone: def.shafts[0].zone, title: 'Tiefer graben', sub: 'Erst den Förderturm bauen', locked: true });
  else if (next) {
    const blocker = shaftBlocker(next.id, planet);
    floors.push({ kind: 'frontier', id: next.id, depth: next.depth, zone: next.zone, title: 'Baustelle · ' + next.name, sub: blocker || '◈ ' + fmt(shaftCost(next.id, planet)) + ' · Bauzeit ' + dcTime(next.build || 60), locked: Boolean(blocker) });
  }
  const future = def.zones.find(z => z.future);
  // (Beta 1.7 M9: once the planetary core is found it takes the place of the unexplored depth below)
  if (open && future && !floors.some(f => f.kind === 'core')) floors.push({ kind: 'future', id: 'future', zone: 'future', name: future.name });
  return floors;
}
const mineViewCosmetic = () => state.meta?.equipped?.mine || null; // Beta 1.3 mine look
window.NebulaView.mine = () => {
  const p = state.activePlanet,
    def = deepCoreDef(p),
    open = undergroundOpen(p),
    auto = colonyAutomation(p),
    flow = industryFlow[p],
    floors = mineFloors(p),
    e = elevatorState(p);
  return {
    cosmeticMine: mineViewCosmetic(),
    planetId: PLANETS[p].id,
    planetIndex: p,
    available: Boolean(def),
    open,
    canOpen: canOpenUnderground(p),
    surfaceZone: def?.shafts[0].zone || 'amethyst',
    floors,
    simAt: flow?.at || Date.now(),
    headerPx: mineHeaderPx,
    voidHere: open && voidMet(),
    surface: { pileRatio: state.colonies[p].stock.pile / Math.max(1, pileCapacity()) },
    railLevel: state.colonies[p].industry?.rail || 0, // Living Worlds 2.0: the cart line leaving the outpost
    elevator: e
      ? {
          level: elevatorLevel(p),
          tier: e.tier || 0,
          auto: Boolean(open && auto.elevator),
          running: Boolean(open && e.phase !== 'surface_idle'),
          phase: e.phase,
          left: e.left,
          dur: e.dur,
          from: e.from,
          to: e.to,
          stop: e.stop,
          load: Math.min(1, e.load / Math.max(1, elevatorCapacity(e.cap, e.tier))),
          crates: Math.min(6, Math.ceil(e.load / KISTE)),
          specialTint: Object.keys(e.cargo).some(id => shaftMaterial(id, p) === 'precisionOre') ? ['#5fe0d0', '#2f8f8a'] : null,
          emberShare: e.load > 0 ? Object.entries(e.cargo).reduce((s, [id, v]) => s + (shaftMaterial(id, p) !== 'raw' ? v : 0), 0) / e.load : 0,
          manager: managerVisual('elevator', p)
        }
      : null
  };
};

// The surface scene shows the headframe once the mine is open; tapping it enters the underground.
const colonyViewBeforeDeep = window.NebulaView.colony;
window.NebulaView.colony = () => {
  const view = colonyViewBeforeDeep(),
    p = state.activePlanet;
  const met = voidMet();
  if (!undergroundOpen(p)) return { ...view, voidMet: met };
  return { ...view, voidMet: met, underground: { level: elevatorLevel(p), running: elevatorState(p).phase !== 'surface_idle' } };
};
window.NebulaColonyActions.enterMine = () => setMineView(true);

// ----- HUD, dock and view switching -----
function syncMineView() {
  const home = currentScreen() === 'home',
    available = Boolean(deepCoreDef());
  if (!available && mineView) mineView = false;
  const on = home && mineView;
  $('heroCard')?.classList.toggle('mine-view', mineView);
  document.body.classList.toggle('mine-active', on);
  const toggle = $('mineToggle');
  if (toggle) {
    toggle.hidden = !available;
    toggle.classList.toggle('ready', canOpenUnderground() && !undergroundOpen());
  }
  if ($('mineHud')) $('mineHud').hidden = !mineView;
}
// Short chip text for the HUD (the full sentence is in the Minen-Übersicht and the chip's label).
function bottleneckChip(neck) {
  if (neck.id === 'elevator') return isAutomated('elevator') ? '⚠ Aufzug zu langsam' : '⇕ Aufzug per Hand';
  if (ALL_SHAFT_IDS.includes(neck.id)) {
    const full = shaftDef(neck.id)?.name || 'Schacht',
      name = window.innerWidth < 360 ? full.replace('Schacht ', 'S') : full;
    if (!isAutomated(neck.id)) return '⛏ ' + name + ' per Hand';
    const limit = shaftLimit(neck.id);
    return limit === 'mining' ? '✓ Alles läuft' : '⚠ ' + name + ': ' + (limit === 'haul' ? 'Transport' : 'Lager voll');
  }
  return { rail: '⚠ Lorenbahn', stall: '⚠ Verkauf' }[neck.id] || neck.text;
}
function renderMineHud() {
  if (!mineView || !$('mineHud')) return;
  const def = deepCoreDef(),
    open = undergroundOpen(),
    neck = open ? stageBottleneck() : null,
    chip = $('mineBottleneck'),
    text = !open ? (canOpenUnderground() ? 'Förderturm bereit zum Bau' : 'Erst die Oberfläche automatisieren') : bottleneckChip(neck);
  $('mineTitleText').textContent = def ? def.title : 'Mine';
  $('mineCredits').textContent = '◈ ' + fmt(state.credits);
  measureMineHeader();
  if (chip.textContent !== text) chip.textContent = text;
  chip.setAttribute('aria-label', open ? 'Engpass: ' + neck.text + ' – Übersicht öffnen' : text);
  chip.className = 'mine-bottleneck' + (open && text.startsWith('⚠') ? ' warn' : '');
}
function renderMineDock() {
  if (!$('mineDock') || !mineView) return;
  const open = undergroundOpen(),
    auto = colonyAutomation(),
    shafts = builtShafts(),
    autoCount = shafts.filter(s => auto[s.id]).length + (open && auto.elevator ? 1 : 0),
    total = shafts.length + (open ? 1 : 0);
  if (!shaftBuilt(mineSelected)) mineSelected = 'mine';
  $('mineDockAuto').textContent = autoCount + '/' + total + ' automatisch';
  // measured lift of the last ~30 s (closed mine: the surface mine's real extraction)
  $('mineDockRate').textContent = fmtRate(open ? updateMeasured().lifted : auto.mine ? shaftMining('mine') : 0);
  // the dock tells what is happening right now (the bottleneck lives in the HUD chip, not twice)
  const job = open ? constructionJob() : null,
    lift = open ? elevatorState() : null;
  $('mineDockHint').textContent = !open
    ? 'Förderturm bauen, um tiefer zu graben.'
    : 'Aufzug ' + LIFT_PHASE_TEXT[lift.phase] + (lift.stop ? ' (' + (shaftDef(lift.stop)?.name || '') + ')' : '') + (job ? ' · ' + (shaftDef(job.id)?.name || '') + ' im Bau ' + Math.floor(constructionProgress(job.id) * 100) + ' %' : '');
  // ABBAUEN (selected shaft): one tap = one work cycle of a kitten
  const def = shaftDef(mineSelected),
    s = shaftState(mineSelected),
    stock = open ? s.platform : colonyAt().stock.pile,
    cap = open ? shaftCapacity(mineSelected) : pileCapacity();
  const digName = def?.name || 'Schacht 1';
  $('mineDigLabel').textContent = (window.innerWidth < 380 ? digName.replace('Schacht ', 'S') : digName) + (open && s.manual.queue ? ' · ' + s.manual.queue + '/' + HAND.queue : '');
  $('mineDigFill').style.width = Math.min(100, (stock / Math.max(1, cap)) * 100) + '%';
  $('mineDigMode').textContent = auto[mineSelected] ? 'AUTO ✓' : 'Handarbeit';
  $('mineDigButton').classList.toggle('auto', Boolean(auto[mineSelected]));
  // AUFZUG: real phase and load
  const e = elevatorState(),
    waiting = open ? shafts.reduce((sum, x) => sum + shaftStock(x.id), 0) : 0;
  $('mineLiftButton').disabled = !open;
  $('mineLiftLabel').textContent = !open ? 'Noch kein Aufzug' : e.phase === 'surface_idle' ? 'Wartet: ' + fmt(waiting) : LIFT_PHASE_TEXT[e.phase] + (e.load > 0 ? ' · ' + fmt(e.load) : '');
  $('mineLiftFill').style.width = (open ? Math.min(100, (e.phase === 'surface_idle' ? waiting / Math.max(1, elevatorCapacity(e.cap, e.tier)) : e.load / Math.max(1, elevatorCapacity(e.cap, e.tier))) * 100) : 0) + '%';
  $('mineLiftMode').textContent = !open ? '–' : auto.elevator ? 'AUTO ✓' : 'Handarbeit';
  $('mineLiftButton').classList.toggle('auto', Boolean(open && auto.elevator));
  // LORE (surface)
  const pile = colonyAt().stock.pile;
  $('mineCartLabel').textContent = 'Halde ' + fmt(pile);
  $('mineCartFill').style.width = Math.min(100, (pile / Math.max(1, pileCapacity())) * 100) + '%';
  $('mineCartMode').textContent = auto.rail ? 'AUTO ✓' : colonyAt().trip ? 'unterwegs' : 'Handarbeit';
  $('mineCartButton').classList.toggle('auto', Boolean(auto.rail));
  // Beta 1.3: ABBAU → AUFZUG → VERKAUF — the stage that really limits (stageBottleneck compares the real capacities)
  // is marked, and its one-line suggestion leads straight to the place to fix it
  const neck = open ? stageBottleneck() : null,
    stage = !neck ? null : neck.id === 'elevator' ? 'lift' : ['rail', 'stall'].includes(neck.id) ? 'cart' : 'dig',
    calm = !neck || neck.text === 'Die Förderung bestimmt dein Tempo.';
  [['dig', 'mineDigButton'], ['lift', 'mineLiftButton'], ['cart', 'mineCartButton']].forEach(([s2, id]) => $(id).classList.toggle('limit', !calm && stage === s2));
  if (!calm) {
    $('mineDockHint').textContent = '⚠ ' + neck.text;
    $('mineDockHint').dataset.neck = neck.id;
  } else delete $('mineDockHint').dataset.neck;
}
// the suggestion opens the place it names (shaft sheet, elevator sheet, or the surface for transport/sale)
document.addEventListener('click', event => {
  const hint = event.target.closest('#mineDockHint[data-neck]');
  if (!hint) return;
  const id = hint.dataset.neck;
  if (id === 'elevator') return openBuildingSheet('dc:elevator');
  if (id === 'rail' || id === 'stall') {
    setMineView(false);
    return openBuildingSheet(id);
  }
  if (shaftBuilt(id)) {
    mineSelected = id;
    openBuildingSheet('dc:shaft:' + id);
  }
});

// ----- sheets (rendered into the existing bottom sheet; keys start with 'dc:') -----
function deepSheetHead(icon, title, role) {
  return `<button class="sheet-close" data-close-sheet aria-label="Schließen">×</button><div class="sheet-head"><span>${icon}</span><div><b>${title}</b><small>${role}</small></div></div>`;
}
const LIMIT_TEXT = { mining: 'Abbau', haul: 'Transport', store: 'Schachtlager', elevator: 'Aufzug' };
function shaftCapText(id) {
  const capped = shaftDef(id)?.capped;
  return capped === 'cogsworth' ? 'Über Stufe 10 fehlt Cogsworths Freigabe' : capped === 'petalguard' ? 'Über Stufe 10 wuchern Dornen – erst Petalguard heilen' : 'Über Stufe 10 zu heiß – erst Emberbell';
}
function trackRow(id, track) {
  const info = TRACK_INFO[track],
    level = trackLevel(id, track),
    price = trackCost(id, track),
    ok = state.credits >= price,
    now = trackValue(id, track, level),
    next = trackValue(id, track, level + 1),
    unit = track === 'store' ? '' : '/s';
  let note = '';
  const mining = shaftMining(id),
    transport = shaftTransport(id);
  if (track === 'drill' || track === 'crew') note = transport < mining + (next - now) ? 'Transport begrenzt auf ' + fmt(transport) + '/s' : 'wirkt voll';
  else if (track === 'haul') note = transport >= mining ? 'mehr als der Abbau liefert' : 'wirkt bis ' + fmt(mining) + '/s';
  else note = 'reicht für ' + Math.round(shaftCapacity(id) / Math.max(1e-9, shaftRate(id))) + ' s Förderung';
  if (id === 'mine' && track === 'crew' && level === 0) note = 'Helferhütte bauen';
  // guardian level caps (Magmaspalte: Emberbell, Uhrwerkkern: Cogsworth-9) — say why instead of "no Credits"
  const capped = track === 'drill' && shaftCapReached(id);
  if (capped) note = shaftCapText(id);
  const name = id === 'mine' && track === 'drill' ? 'Bohrer (Kristallmine)' : id === 'mine' && track === 'crew' ? 'Arbeiter-Kätzchen (Helferhütte)' : info.name;
  // Beta 1.3: +1 / +10 / MAX (batch-ui.js) — the price shown is the real total of the selected steps
  const button =
    id === 'mine' && (track === 'drill' || track === 'crew')
      ? batchButtonHTML('building', track === 'drill' ? 0 : 1, null, `data-buy="${track === 'drill' ? 0 : 1}"`)
      : capped
        ? `<button class="track-buy" disabled>🔒 Lv ${level}</button>`
        : batchButtonHTML('shaft', id, track, `data-dc-track="${id}:${track}"`);
  return `<li class="track-row ${shaftLimit(id) === track || (shaftLimit(id) === 'mining' && track === 'drill') ? 'limit' : ''}"><i>${info.icon}</i><div><b>${name} · Lv ${level}</b><small>${unit ? fmtRate(now) : fmt(now)}${unit} → ${unit ? fmtRate(next) : fmt(next)}${unit} · ${note}</small></div>${button}</li>`;
}
// Beta 1.7 M3: what the cabin really carried on its last trips – and what that says about the bottleneck
function liftLoadRow(capacity) {
  const last = liftTripLog().last;
  if (!last.length) return '';
  const avg = last.reduce((s, v) => s + v, 0) / last.length,
    fill = capacity > 0 ? avg / capacity : 0,
    bars = last.map(v => `<i style="height:${Math.max(6, Math.round(Math.min(1, v / Math.max(1, capacity)) * 100))}%"></i>`).join(''),
    why = fill >= 0.9 ? 'Die Kabine fährt voll – Tragkraft oder Tempo ausbauen bringt sofort mehr.' : fill < 0.5 ? 'Die Kabine fährt halb leer – die Schächte liefern weniger, als sie tragen könnte.' : 'Die Kabine ist gut ausgelastet.';
  return `<div class="lift-loads"><div class="lift-bars" aria-hidden="true">${bars}</div><small>Letzte ${last.length} Fahrten: Ø ${fmt(avg)} je Fahrt · ${Math.round(fill * 100)} % der Tragkraft. ${why}</small></div>`;
}
function renderDeepSheet(sheet, key) {
  const [, kind, id] = key.split(':');
  let html = '';
  if (kind === 'shaft') {
    const def = shaftDef(id),
      open = undergroundOpen(),
      s = shaftState(id),
      level = shaftLevel(id),
      stage = SHAFT_STAGES[shaftStage(level) - 1][1],
      legacy = id === 'mine' && underground().legacyPower > 0;
    const role =
      id === 'mine'
        ? 'Deine Kristallmine: Bohrer = Kristallmine, Arbeiter-Kätzchen = Helferhütte.' + (legacy ? ' Enthält übernommene Förderrechte aus Lagerhaus und Frachtdock (fest).' : '')
        : 'Eigener Abbauort: Kätzchen bauen ab, tragen zur Aufzugsrampe, der Aufzug holt ab.';
    if (!open) {
      html =
        deepSheetHead('⛏', def.name + ' · ' + def.title + ' · Lv ' + level, role) +
        `<p class="sheet-effect">Förderung ${fmt(shaftMining(id))}/s · liefert direkt auf die Halde · Maschine: ${stage}</p>` +
        managerRow(id) +
        batchToggleHTML() +
        `<div class="sheet-actions">${batchButtonHTML('building', 0, null, 'data-buy="0"', 'sheet-buy')}</div>`;
    } else {
      const limit = shaftLimit(id);
      html =
        deepSheetHead('⛏', def.name + ' · ' + def.title, role) +
        `<p class="sheet-effect shaft-status">Kapazität: Abbau ${fmtRate(shaftMining(id))}/s · Transport ${fmtRate(shaftTransport(id))}/s · <b>Engpass: ${LIMIT_TEXT[limit]}</b><br>Gemessen: ${isAutomated(id) ? fmtRate(measuredShaft(id)) + '/s an die Rampe' : 'Handbetrieb'} · Lager ${fmt(s.platform)} / ${fmt(shaftCapacity(id))}<br><small>${minerCount(id)} Kätzchen am Abbau · ${carrierCount(id)} Träger (${HAUL_STAGES[haulStage(trackLevel(id, 'haul')) - 1][1]}) · Maschine: ${stage}</small></p>` +
        batchToggleHTML() +
        `<ul class="track-list">${TRACKS.map(t => trackRow(id, t)).join('')}</ul>` +
        managerRow(id) +
        (window.sheetExtra?.(key) || '') +
        `<div class="sheet-actions"><button class="sheet-manual" data-dc-dig="${id}" ${s.manual.queue >= HAND.queue ? 'disabled' : ''}>ABBAUEN${s.manual.queue ? ' · ' + s.manual.queue + '/' + HAND.queue : ''}</button></div>`;
    }
  } else if (kind === 'elevator') {
    const e = elevatorState(),
      capNow = elevatorCapacity(e.cap, e.tier),
      rate = elevatorRate(),
      a = colonyAutomation(),
      supply = builtShafts().reduce((sum, x) => sum + (a[x.id] ? shaftRate(x.id) : 0), 0),
      rail = a.rail ? railRate() : 0,
      stage = ELEVATOR_STAGES.filter(([from]) => elevatorLevel() >= from).pop()?.[1] || ELEVATOR_STAGES[0][1],
      route = e.route.length ? e.route.map(r => (shaftDef(r)?.name || r).replace('Schacht ', 'S')).join(' → ') : '–',
      speedPrice = elevatorTrackCost('speed'),
      capPrice = elevatorTrackCost('cap'),
      speedMax = elevatorFloorTime(e.speed + 1) >= elevatorFloorTime(e.speed) - 1e-6,
      real = Math.min(rate, supply || rate, rail || Infinity);
    const honest = !a.elevator ? 'Fährt nur, wenn du ihn schickst.' : supply < rate ? 'Die Schächte liefern nur ' + fmt(supply) + '/s – mehr Aufzug bringt gerade nichts.' : rail && rail < Math.min(rate, supply) ? 'Oben schafft die Lorenbahn nur ' + fmt(rail) + '/s.' : 'Der Aufzug begrenzt die Förderung.';
    html =
      deepSheetHead('⇕', 'Förderaufzug · ' + stage, 'Fährt von oben nach unten alle Rampen mit Material an, kehrt um, sobald er voll ist, und lädt oben auf die Halde.') +
      `<p class="sheet-effect lift-status"><b>${LIFT_PHASE_TEXT[e.phase]}</b> · Ladung ${fmt(e.load)} / ${fmt(capNow)} (${kisten(capNow)}) · Route ${route}<br><small>Schafft ≈ ${fmtRate(rate)}/s bei voller Fahrt (Runde ${elevatorCycle().toFixed(1).replace('.', ',')} s, Tiefe ${elevatorDepth()}) · real ≈ ${fmtRate(a.elevator ? real : 0)}/s. ${honest}</small></p>` +
      batchToggleHTML() +
      `<ul class="track-list"><li class="track-row"><i>⏩</i><div><b>Aufzug-Geschwindigkeit · Lv ${e.speed}</b><small>${elevatorFloorTime(e.speed).toFixed(2).replace('.', ',')} → ${elevatorFloorTime(e.speed + 1).toFixed(2).replace('.', ',')} s je Etage · ${fmtRate(rate)} → ${fmtRate(elevatorRate(state.activePlanet, e.speed + 1))}/s</small></div>${batchButtonHTML('elevator', null, 'speed', 'data-dc-elev="speed"')}</li>` +
      `<li class="track-row"><i>▣</i><div><b>Aufzug-Tragkraft · Lv ${e.cap}</b><small>${kisten(capNow)} → ${kisten(elevatorCapacity(e.cap + 1, e.tier))} · ${fmtRate(rate)} → ${fmtRate(elevatorRate(state.activePlanet, e.speed, e.cap + 1))}/s</small></div>${batchButtonHTML('elevator', null, 'cap', 'data-dc-elev="cap"')}</li>${liftTierRowHTML(e, rate)}</ul>` +
      liftLoadRow(capNow) +
      (typeof stationRow === 'function' ? stationRow('elevator') : '') +
      managerRow('elevator') +
      `<div class="sheet-actions"><button class="sheet-manual" data-dc-lift ${e.phase !== 'surface_idle' || a.elevator ? 'disabled' : ''}>${a.elevator ? 'FÄHRT AUTOMATISCH' : e.phase === 'surface_idle' ? 'AUFZUG SCHICKEN' : 'UNTERWEGS …'}</button></div>`;
  } else if (kind === 'frontier') {
    const def = shaftDef(id),
      blocker = shaftBlocker(id),
      price = shaftCost(id),
      ok = !blocker && state.credits >= price,
      first = def.base * (def.material && def.material !== 'raw' ? 1 : extractionMultiplier());
    html =
      deepSheetHead('🚧', def.name + ' · ' + def.title + ' bauen', 'Tiefe ' + def.depth + ' · ' + (deepCoreDef().zones.find(z => z.id === def.zone)?.name || '')) +
      `<p class="sheet-effect">Bauzeit ${dcTime(def.build || 60)} · danach fördert Stufe 1 ca. ${fmtRate(first)}/s ${def.material && MATERIALS[def.material] ? MATERIALS[def.material].name : ''} an die eigene Aufzugsrampe.${findsText(def)}${def.start ? ' Der alte Förderstollen wird mit repariert: Transport startet auf Stufe ' + def.start.haul + ' (Grubenlore).' : ''} Braucht einen eigenen Bergbau-Manager.${blocker ? ' · <b>' + blocker + '</b>' : ''}</p>` +
      `<div class="sheet-actions"><button class="sheet-buy ${ok ? 'affordable' : ''}" data-dc-build="${id}" ${ok ? '' : 'disabled'}>BAU STARTEN · ◈ ${fmt(price)}</button></div>`;
  } else if (kind === 'build') {
    const def = shaftDef(id),
      b = shaftState(id)?.build;
    if (!b) {
      openSheetIndex = shaftBuilt(id) ? 'dc:shaft:' + id : null;
      return renderBuildingSheet();
    }
    const progress = constructionProgress(id),
      offer = constructionAdState(),
      gems = constructionGemCost(),
      adOk = offer.ok && adReady('construction');
    html =
      deepSheetHead('🏗', def.name + ' · ' + def.title + ' im Bau', 'Die Bautrupp-Kätzchen graben den Stollen. Die Zeit läuft auch, wenn du nicht spielst.') +
      `<div class="build-progress"><i style="width:${(progress * 100).toFixed(1)}%"></i></div>` +
      `<p class="sheet-effect">${constructionPhase(progress)} · ${Math.floor(progress * 100)} % · noch <b>${dcTime(b.left)}</b>${b.ads ? ' · ' + b.ads + '× beschleunigt' : ''}</p>` +
      `<div class="sheet-actions">` +
      (offer.ok
        ? `<button class="sheet-manual" data-dc-ad="${b.job}" ${adOk ? '' : 'disabled'}>${adLabel('construction', (state.meta.entitlements.commanderEdition ? 'Sofort ' : 'Werbung: ') + '−' + dcTime(offer.cut))}</button>`
        : `<button class="sheet-manual" disabled>${offer.why || 'Bau beschleunigen'}</button>`) +
      `<button class="sheet-buy ${state.gems >= gems ? 'affordable' : ''}" data-dc-gem="${b.job}" ${state.gems >= gems ? '' : 'disabled'}>SOFORT FERTIG · ${gems} ◆</button></div>` +
      `<p class="sheet-note">Optional: Werbung kürzt die Restzeit um die Hälfte (mind. 2 Min.); Gems: 1 ◆ je angefangene 3 Minuten. Ohne beides wird der Schacht genauso fertig.</p>`;
  } else if (kind === 'open') {
    const price = openCost(),
      can = canOpenUnderground(),
      ok = can && state.credits >= price;
    html =
      deepSheetHead('🏗', 'Förderturm bauen', 'Öffnet die Mine unter der Kolonie: Schacht 1 liegt dann unter Tage, Kätzchen tragen das Material zur Aufzugsrampe, ein Aufzug bringt es nach oben, und tiefere Schächte werden möglich.') +
      `<p class="sheet-effect">${can ? 'Aufzug und Transport werden so gebaut, dass deine laufende Förderung nicht sinkt.' + (elevatorRightsKept() ? ' Dein Bergbau lief schon vor der Mine automatisch – der Aufzug bekommt deshalb sofort einen Bediener (Übernommen).' : ' Danach fährt der Aufzug per Hand, bis du einen Aufzugs-Manager einstellst (◈ ' + fmt(hireCost('elevator')) + ').') : 'Erst Abbau, Lore und Verkauf automatisieren (oder 5.000 Credits verdienen).'}</p>` +
      `<div class="sheet-actions"><button class="sheet-buy ${ok ? 'affordable' : ''}" data-dc-open ${ok ? '' : 'disabled'}>${price ? 'BAUEN · ◈ ' + fmt(price) : 'WIEDER ERRICHTEN · KOSTENLOS'}</button></div>`;
  } else if (kind === 'conduit') {
    const st = conduitState(),
      missing = conduitMissing();
    html =
      deepSheetHead('◎', 'Alte Wartungsleitung', 'Hinter der Tiefendruse liegt ein Zugang des Schnurrnetzes – eine Energieleitung aus der Zeit vor der Großen Stille. M.O.T.T.E. hat sie versiegelt.') +
      (st === 'repaired'
        ? '<p class="sheet-effect">Repariert: Der Schnurrnetz-Lift speist alle Förderaufzüge – +20 % Fahrtempo auf jedem Planeten (dauerhaft, bleibt nach dem Galaxie-Verkauf).</p>'
        : `<p class="sheet-effect">Reparatur: ${CONDUIT_REPAIR.raw} Rohkristalle aus dem Orion-Lager · ${CONDUIT_REPAIR.ore} Erz · ${CONDUIT_REPAIR.crystals} Kristalle. Belohnung: Schnurrnetz-Lift (+20 % Fahrtempo aller Aufzüge, dauerhaft).${missing.length ? ' Es fehlen: ' + missing.join(', ') + '.' : ''}</p><div class="sheet-actions"><button class="sheet-buy ${missing.length ? '' : 'affordable'}" data-dc-repair ${missing.length ? 'disabled' : ''}>REPARIEREN</button></div>`);
  } else if (kind === 'core') html = coreSheetHTML(id || 'crystal');
  else if (kind === 'overview') html = mineOverviewHTML();
  setHTML(sheet, html);
  sheet.classList.remove('hidden');
}
// Beta 1.7 M9: the core's sheet – the stage, every need with its progress and a DELIVER button, the rewards
function coreSheetHTML(key) {
  const def = CORES[key],
    s = coreState(key),
    phase = corePhase(key),
    done = def.stages.map((st, i) => `<li class="${i < s.stage ? 'done' : i === s.stage ? 'now' : ''}"><b>${i + 1}. ${st.name}</b><small>${st.reward}</small></li>`).join('');
  let body = '';
  if (phase === 'healed') body = '<p class="sheet-effect">Der Kern ist geheilt. Orion leuchtet – alle Verkäufe auf Orion bringen 25 % mehr.</p>';
  else {
    const st = def.stages[s.stage],
      sources = coreSources(key),
      rows = Object.entries(st.needs)
        .map(([item, need]) => {
          const paid = s.paid[item] || 0,
            have = item === 'credits' || item === 'crystals' ? coreItemStock(item) : sources.reduce((sum, p) => sum + Math.floor(fabStock(p, item)), 0),
            [name, icon] = item === 'crystals' ? ['Kristalle', '◆'] : techItemName(item),
            left = Math.max(0, need - paid);
          return `<li class="core-need"><div><b>${icon} ${name}</b><small>${fmt(paid)} / ${fmt(need)} · verfügbar ${fmt(have)}</small><i class="station-bar"><u style="width:${Math.round((paid / need) * 100)}%"></u></i></div><button data-core-give="${item}" ${left > 0 && have >= 1 ? '' : 'disabled'}>${left <= 0 ? '✓' : 'LIEFERN'}</button></li>`;
        })
        .join('');
    body = `<p class="sheet-effect">Stufe ${s.stage + 1}: ${st.name} – Belohnung: ${st.reward} Teillieferungen zählen.${typeof techHas === 'function' && techHas('coreProbe') ? ' Die Kernsonde nimmt Material aus allen Kolonien.' : ' Geliefert wird aus der besuchten Kolonie.'}</p><ul class="core-needs">${rows}</ul>`;
  }
  return deepSheetHead('◉', def.name + ' · Tiefe 15', 'Der beschädigte Kern des Kristallplaneten. Seit der Großen Stille ist er gesprungen – heile ihn in drei Stufen.') + body + `<ol class="core-stages">${done}</ol>`;
}
document.addEventListener('click', event => {
  const give = event.target.closest('[data-core-give]');
  if (!give) return;
  const before = coreStage('crystal'),
    n = coreDeliver(give.dataset.coreGive, 'crystal');
  if (n > 0) {
    feedback('upgrade', 'success');
    toast(coreStage('crystal') > before ? '◉ Kernstufe ' + coreStage('crystal') + ' geheilt!' : 'Geliefert: ' + fmt(n));
    requestSave(200);
  }
  renderBuildingSheet();
  render();
});
function mineOverviewHTML() {
  const open = undergroundOpen(),
    a = colonyAutomation(),
    r = colonyRates(),
    shafts = builtShafts(),
    neck = stageBottleneck(),
    mined = shafts.reduce((s, x) => s + (a[x.id] ? shaftRate(x.id) : 0), 0),
    sell = (a.stall ? r.S1 : 0) + (a.dock ? r.S2 : 0),
    row = (icon, name, value, note, warn, jump) =>
      `<li class="${warn ? 'warn' : ''}"><i>${icon}</i><b>${name}</b><span>${value}</span><small>${note}</small>${jump ? `<button data-mine-goto="${jump}" aria-label="Zeigen">›</button>` : ''}</li>`;
  const rows = shafts.map(s => {
    const d = shaftDef(s.id),
      stock = open ? shaftStock(s.id) : 0,
      cap = open ? shaftCapacity(s.id) : 1,
      limit = open ? shaftLimit(s.id) : 'mining';
    return row('⛏', d.name, a[s.id] ? fmt(shaftRate(s.id)) + '/s' : 'Hand', open ? 'Lager ' + Math.round((stock / cap) * 100) + ' % · Engpass ' + LIMIT_TEXT[limit] : 'direkt zur Halde', !a[s.id] || (open && limit !== 'mining'), s.id);
  });
  const job = open ? constructionJob() : null;
  if (job) rows.push(row('🏗', shaftDef(job.id).name, dcTime(job.left), 'im Bau · ' + constructionPhase(constructionProgress(job.id)), false, job.id));
  if (open) rows.push(row('⇕', 'Aufzug', a.elevator ? fmt(r.EL) + '/s' : 'Hand', a.elevator ? (r.EL < mined * 0.98 ? 'kommt nicht hinterher' : 'genug Kapazität') + ' · ' + LIFT_PHASE_TEXT[elevatorState().phase] : 'kein Manager', !a.elevator || r.EL < mined * 0.98, 'elevator'));
  rows.push(row('🛒', 'Lorenbahn', a.rail ? fmt(r.L) + '/s' : 'Hand', 'Halde ' + Math.round((colonyAt().stock.pile / Math.max(1, r.pileCap)) * 100) + ' %', !a.rail || r.L < automatedExtraction(r, a) * 0.98, null));
  rows.push(row('▦', 'Lager', fmt(storageLevel()), 'von ' + fmt(r.depotCap), storageLevel() / r.depotCap > 0.92, null));
  rows.push(row('◈', 'Verkauf', sell ? fmt(sell) + '/s' : 'Hand', 'Einnahmen ≈ ' + fmt(automatedIncomeRate()) + ' ◈/s', !sell || sell < Math.min(automatedExtraction(r, a), r.L) * 0.98, null));
  return (
    deepSheetHead('☰', 'Minen-Übersicht', 'Jede Stufe begrenzt die nächste. Verbessere den Engpass – nicht einfach den größten Schacht.') +
    `<p class="sheet-effect mine-neck">Engpass: ${neck.text}</p><ul class="mine-overview">${rows.join('')}</ul>`
  );
}
const renderIndustrySheetBeforeDeep = renderIndustrySheet;
renderIndustrySheet = (sheet, key) => (typeof key === 'string' && key.startsWith('dc:') ? renderDeepSheet(sheet, key) : renderIndustrySheetBeforeDeep(sheet, key));
// The Kristallmine sheet on the surface links to the mine below it.
const sheetExtraBeforeDeep = window.sheetExtra;
window.sheetExtra = key => {
  const base = sheetExtraBeforeDeep?.(key) || '';
  if (key !== 0 || !deepCoreDef()) return base;
  return base + `<button class="sheet-manual mine-enter" data-mine-enter>${undergroundOpen() ? '⛏ IN DIE MINE ›' : '⛏ MINE ANSEHEN ›'}</button>`;
};

// ----- actions -----
function findsText(def) {
  if (!def.finds) return '';
  const every = def.finds.seconds >= 60 ? Math.round(def.finds.seconds / 60) + ' Min.' : def.finds.seconds + ' s';
  return ' Fund: ' + (def.finds.kind === 'crystals' ? '1 Kristall' : '1 Erz') + ' je ' + every + ' automatischem Abbau.';
}
function deepToast(ok, message, fail) {
  if (ok) toast(message);
  else if (fail) toast(fail);
}
window.NebulaColonyActions.mineTap = (type, key) => {
  if (type === 'shaft' || type === 'hire') {
    // 'hire': the empty manager desk — the shaft sheet carries the manager row with its hire button
    mineSelected = key;
    openBuildingSheet('dc:shaft:' + key);
    // Beta 1.7: the camera stays where the player put it; it only moves when the opened panel would cover the tapped shaft
    const index = NebulaView.mine?.().floors.findIndex(f => f.id === key);
    requestAnimationFrame(() => {
      const scene = mineScene(),
        canvas = document.querySelector('canvas.scene-mine'),
        sheet = $('buildingSheet');
      if (index < 0 || !scene || !canvas) return;
      const hit = scene.hitAreas().find(h => h.type === 'shaft' && h.key === key),
        sheetTop = sheet && !sheet.classList.contains('hidden') ? sheet.getBoundingClientRect().top : Infinity,
        top = canvas.getBoundingClientRect().top;
      if (!hit || top + hit.y1 > sheetTop - 4 || top + hit.y0 < top + scene.camera().head) scene.focusFloor(index);
    });
  } else if (type === 'elevator') openBuildingSheet('dc:elevator');
  else if (type === 'frontier') openBuildingSheet(key === 'open' ? 'dc:open' : key === 'frostDrill' ? 'frostDrill' : 'dc:frontier:' + key);
  else if (type === 'construction') openBuildingSheet('dc:build:' + key);
  else if (type === 'open') openBuildingSheet('dc:open');
  else if (type === 'conduit') openBuildingSheet('dc:conduit');
  else if (type === 'core') openBuildingSheet('dc:core:crystal');
  else if (type === 'frost') openBuildingSheet('frostDrill');
  else if (type === 'void') voidChat();
  else if (type === 'surface') setMineView(false);
  render();
};
function askGemSkip(jobId) {
  const job = constructionJob();
  if (!job || job.job !== jobId) return;
  const price = constructionGemCost();
  askConfirm(
    'Baustelle',
    shaftDef(job.id).name + ' sofort fertigstellen?',
    `Noch ${dcTime(job.left)} Bauzeit. Sofort fertig für <b>${price} ◆</b> (1 ◆ je angefangene 3 Minuten). Ohne Gems wird der Schacht genauso fertig.`,
    'FERTIGSTELLEN · ' + price + ' ◆',
    () => {
      const ok = skipConstructionWithGems(state.activePlanet, jobId, price);
      deepToast(ok, shaftDef(job.id).name + ' ist fertig!', 'Die Baustelle hat sich geändert – nichts abgebucht.');
      if (ok) save();
      render();
    }
  );
}
document.addEventListener('click', event => {
  const t = event.target;
  if (t.closest('#mineToggle') || t.closest('[data-mine-enter]')) {
    openSheetIndex = null;
    setMineView(true);
    if (!undergroundOpen()) openBuildingSheet('dc:open');
    return;
  }
  if (t.closest('#mineBack')) return setMineView(false);
  if (t.closest('#mineOverviewBtn') || t.closest('#mineBottleneck')) return openBuildingSheet('dc:overview');
  const jump = t.closest('[data-mine-jump]');
  if (jump) {
    const kind = jump.dataset.mineJump,
      neck = kind === 'bottleneck' ? stageBottleneck().id : null,
      found = neck && mineFloors().some(f => f.id === neck) ? (mineScene()?.focusShaft(neck), true) : mineScene()?.focusWhere(kind);
    if (found === false) toast({ idle: 'Alle Arbeitsplätze sind besetzt.', bottleneck: 'Kein Engpass – alle Schächte laufen frei.' }[kind] || 'Hier gibt es gerade nichts zu bauen.');
    return;
  }
  // Beta 1.4 M2: zone jumps — each tap goes to the next depth zone that has floors (then back to the surface)
  if (t.closest('[data-mine-zone]')) {
    const zones = mineZones();
    if (!zones.length) return;
    mineZoneAt = (mineZoneAt + 1) % (zones.length + 1);
    if (mineZoneAt === zones.length) {
      mineScene()?.focusTop();
      toast('Oberfläche');
    } else {
      mineScene()?.focusWhere('zone:' + zones[mineZoneAt].id);
      toast('Zone: ' + zones[mineZoneAt].name);
    }
    return;
  }
  const go = t.closest('[data-mine-goto]');
  if (go) {
    openSheetIndex = null;
    renderBuildingSheet();
    if (go.dataset.mineGoto === 'elevator') mineScene()?.focusTop();
    else mineScene()?.focusShaft(go.dataset.mineGoto);
    return;
  }
  if (t.closest('[data-dc-open]')) {
    const ok = openUnderground();
    deepToast(ok, 'Förderturm gebaut – der Weg in die Tiefe ist offen!', 'Noch nicht möglich');
    if (ok) {
      storyEvent('deep-open');
      openSheetIndex = 'dc:elevator';
      save();
    }
    return render();
  }
  const build = t.closest('[data-dc-build]');
  if (build) {
    const id = build.dataset.dcBuild,
      first = shaftLevel(id) === 0,
      ok = buildShaft(id);
    deepToast(ok, first ? shaftDef(id).name + ': Bau gestartet!' : shaftDef(id).name + ' verbessert!', shaftBlocker(id) || 'Nicht genug Credits');
    if (ok && first) {
      mineSelected = id;
      openSheetIndex = 'dc:build:' + id;
      mineScene()?.focusShaft(id);
    }
    if (ok) save();
    return render();
  }
  const track = t.closest('[data-dc-track]');
  if (track) {
    const [id, which] = track.dataset.dcTrack.split(':'),
      ok = upgradeShaftTrack(id, which);
    deepToast(ok, TRACK_INFO[which].name + ' verbessert!', which === 'drill' && shaftCapReached(id) ? shaftCapText(id) : 'Nicht genug Credits');
    if (ok) {
      feedback('upgrade', 'light');
      save();
    }
    return render();
  }
  const tierButton = t.closest('[data-dc-tier]');
  if (tierButton) {
    const ok = upgradeLiftTier();
    deepToast(ok, LIFT_TIER_NAMES[Math.min(LIFT_TIER_NAMES.length - 1, elevatorState().tier)] + ': der Aufzug trägt das Dreifache!', liftTierBlocker() || 'Nicht genug Credits');
    if (ok) save();
    return render();
  }
  const elev = t.closest('[data-dc-elev]');
  if (elev) {
    const ok = upgradeElevator(elev.dataset.dcElev);
    deepToast(ok, elev.dataset.dcElev === 'speed' ? 'Aufzug fährt schneller!' : 'Aufzug trägt mehr!', 'Nicht genug Credits');
    if (ok) save();
    return render();
  }
  const ad = t.closest('[data-dc-ad]');
  if (ad) {
    const planet = state.activePlanet,
      jobId = ad.dataset.dcAd;
    runRewardedPlacement(
      'construction',
      () => {
        if (applyConstructionAd(planet, jobId)) toast('Baustelle beschleunigt!');
      },
      () => {
        const offer = constructionAdState(planet);
        return offer.ok && offer.job.job === jobId;
      }
    );
    return;
  }
  const gem = t.closest('[data-dc-gem]');
  if (gem) return askGemSkip(gem.dataset.dcGem);
  const dig = t.closest('[data-dc-dig]') || t.closest('#mineDigButton');
  if (dig) {
    const id = dig.dataset?.dcDig || mineSelected;
    if (!undergroundOpen()) {
      collect();
      return;
    }
    const queued = manualShaft(id);
    if (queued) feedback('collect', 'light');
    else toast('Die Kätzchen in ' + (shaftDef(id)?.name || 'Schacht 1') + ' haben schon ' + HAND.queue + ' Aufträge.');
    return render();
  }
  if (t.closest('[data-dc-lift]') || t.closest('#mineLiftButton')) {
    if (isAutomated('elevator') && t.closest('#mineLiftButton')) return openBuildingSheet('dc:elevator');
    const stops = manualElevator();
    if (stops > 0) feedback('upgrade', 'light');
    else toast(elevatorState().phase !== 'surface_idle' ? 'Der Aufzug ist noch unterwegs.' : 'An den Rampen wartet kein Material.');
    return render();
  }
  if (t.closest('#mineCartButton')) {
    if (isAutomated('rail')) return openBuildingSheet('rail');
    return sendCart();
  }
  if (t.closest('[data-dc-repair]')) {
    const ok = repairConduit();
    if (ok) {
      storyEvent('deep-conduit-repaired');
      feedback('unlock', 'success');
      save();
    }
    return render();
  }
});

// ----- story beats (short, skippable; only real milestones) -----
Object.assign(STORY, {
  'deep-ready': {
    title: 'Ein hohler Klang',
    lines: [['mochi', 'Hörst du das? Unter der Kristallmine klingt der Boden hohl … Mit einem Förderturm könnten wir tiefer graben!']]
  },
  'deep-open': {
    title: 'Der erste Förderturm',
    lines: [
      ['mochi', 'Der Aufzug ist fertig! Schacht 1 liegt jetzt unter uns – die Kätzchen tragen alles zur Aufzugsrampe.'],
      ['pip', 'Tipp: Der Aufzug fährt erst los, wenn du ihn schickst – oder wenn ein Aufzugs-Manager das übernimmt.']
    ]
  },
  'deep-shaft2': { title: 'Ein zweiter Schacht', lines: [['mochi', 'Der neue Stollen ist durch! Jeder Schacht braucht seinen eigenen Bergbau-Manager.']] },
  'deep-shaft3': {
    title: 'Die Tiefendruse',
    lines: [
      ['mochi', 'Funkelnde Drusen – und dahinter eine runde Luke mit M.O.T.T.E.-Zeichen!'],
      ['tikki', 'Eine Wartungsleitung des Schnurrnetzes. Uralt, aber nicht kaputt – nur abgeschaltet. Mit echten Rohstoffen kriege ich sie wieder zum Laufen.']
    ]
  },
  'deep-conduit-repaired': {
    title: 'Der Schnurrnetz-Lift',
    lines: [
      ['tikki', 'Die Leitung summt! Sie treibt jetzt jeden Förderaufzug an – auf allen Planeten.'],
      ['mochi', 'Das Schnurrnetz war nie tot. Es hat nur auf jemanden gewartet, der es wieder verbindet.']
    ]
  }
});
function mineGuidance() {
  const j = state.meta.story.journal;
  if (!j.includes('deep-ready') && state.activePlanet === 0 && canOpenUnderground(0) && !undergroundOpen(0) && ['mine', 'rail'].every(w => isAutomated(w, 0))) storyEvent('deep-ready');
}
// ----- Void: Mochi's best friend (story only — no economy bonus, no gacha, Mochi stays the lead) -----
// Introduced by the old paw markings beside the elevator once the first real trip has come up (one-time journal
// entry). Old saves catch up the same way on their next visit to an open mine.
Object.assign(STORY, {
  'void-markings': {
    title: 'Pfotenzeichen am Aufzug',
    lines: [
      ['mochi', 'Siehst du die Kratzer neben dem Aufzugsschacht? Das sind Pfotenzeichen … und sie leuchten!'],
      ['void', 'Die sind nicht so alt, wie sie aussehen. Ein paar davon sind von mir. Hallo, Mochi.'],
      ['mochi', 'VOID?! Du hier unten? Ich hab dich seit der Akademie nicht mehr gesehen!'],
      ['void', 'Ich bin den alten Zeichen gefolgt. Jemand hat hier vor langer Zeit Wege in den Stein geritzt. Ich will wissen, wohin sie führen.'],
      ['mochi', 'Dann finden wir es zusammen raus. Wie früher – Pfote drauf!']
    ]
  },
  'void-deeper': {
    title: 'Void hört etwas',
    lines: [
      ['void', 'Die Zeichen gehen tiefer, Mochi. Halt mal das Ohr an den Fels – da unten summt etwas.'],
      ['mochi', 'Ein Schacht nach dem anderen. Aber ich hör es auch.']
    ]
  },
  'void-conduit': {
    title: 'Das Zeichen auf der Luke',
    lines: [
      ['void', 'Das ist es! Genau dieses Zeichen war überall an den Wänden. Die Markierungen haben uns zur Leitung geführt.'],
      ['mochi', 'Dann hat das Schnurrnetz uns die ganze Zeit den Weg gezeigt. Gut, dass du so neugierig bist.']
    ]
  }
});
window.StorySpeakers = Object.assign(window.StorySpeakers || {}, {
  void: { name: 'Void', portrait: () => window.SpaceKittens?.lookPortraitURL?.('void', window.SpaceKittens.VOID, 96, 'happy') || '' }
});
function voidMet() {
  return state.meta.story.journal.includes('void-markings');
}
const VOID_LINES = [
  'Siehst du die Linie da? Sie zeigt immer nach unten. Immer.',
  'Mochi hat mir in der Akademie immer die Hälfte der Fischkekse abgegeben. Dafür schulde ich noch ganz viele.',
  'Auf Pyra ist es so warm, dass mein Fell knistert. Mochi lacht jedes Mal.',
  'Ich zähle die Aufzugsfahrten. Nur so. Es beruhigt.',
  'Wenn es hier unten ganz still ist, hört man das Schnurrnetz schnurren.',
  'Die Bergbau-Kätzchen haben mir einen Helm geliehen. Er ist zu groß. Ich behalte ihn trotzdem.'
];
let voidLine = 0;
const talkBeforeVoid = window.NebulaColonyActions.talk;
window.NebulaColonyActions.talk = who => (who === 'void' ? voidChat() : talkBeforeVoid?.(who));
function voidChat() {
  if (!voidMet()) return;
  storyQueue.push(['void', VOID_LINES[voidLine++ % VOID_LINES.length]]);
  showNextStoryLine();
}
function voidGuidance() {
  if (!mineView || state.activePlanet !== 0 || !undergroundOpen(0)) return;
  const j = state.meta.story.journal;
  if (!j.includes('void-markings') && elevatorState(0).trips >= 1) storyEvent('void-markings');
  else if (voidMet() && !j.includes('void-deeper') && shaftLevel('shaft2', 0) > 0) storyEvent('void-deeper');
  else if (voidMet() && !j.includes('void-conduit') && conduitState() !== 'hidden') storyEvent('void-conduit');
}
GameEvents.on('shaft-built', e => {
  if (e.planet !== state.activePlanet) return;
  const id = e.shaft === 'shaft2' && PLANETS[e.planet].id !== 'crystal' ? 'deep-shaft2' : 'deep-' + e.shaft;
  if (STORY[id]) storyEvent(id);
});
Object.assign(STORY, {
  'deep-shaft4': {
    title: 'Verdichtete Adern',
    lines: [
      ['mochi', 'So dichtes Gestein! Die Bohrer singen richtig – und ab und zu fällt ein Brocken Erz heraus.'],
      ['void', 'Die Pfotenzeichen hier sind tiefer eingeritzt. Wer das war, hatte es eilig.']
    ]
  },
  'deep-shaft5': {
    title: 'Der vergessene Förderstollen',
    lines: [
      ['tikki', 'Ein Förderband aus der Zeit vor der Großen Stille! Verrostet, aber die Mechanik ist top. Ich hab es gleich mitrepariert.'],
      ['mochi', 'Dann haben hier schon mal Kätzchen gegraben … lange vor uns.']
    ]
  },
  'deep-shaft6': {
    title: 'Die Resonanzkammer',
    lines: [
      ['lumi', 'Die Kristalle hier schwingen alle im selben Ton. Wenn sie besonders laut summen, löst sich ein reiner Kristall.'],
      ['void', 'Hörst du, Mochi? Das ist das Summen, das ich die ganze Zeit gesucht habe.'],
      ['mochi', 'Dann sind wir angekommen. Fürs Erste.']
    ]
  }
});

// Shafts finished while the player was away are named in the welcome report (time passed, nothing was skipped).
const showOfflineReportBeforeDeep = showOfflineReport;
showOfflineReport = report => {
  showOfflineReportBeforeDeep(report);
  const line = $('welcomeMine');
  if (!line) return;
  line.hidden = !builtWhileAway.length;
  line.textContent = builtWhileAway.length ? '🏗 Fertig gebaut: ' + builtWhileAway.join(', ') : '';
  builtWhileAway.length = 0;
};

// ----- sounds (through NebulaAudio, respects the settings; rate-limited so automation never spams) -----
const soundAt = {};
function deepSound(name, gap = 0.6) {
  const now = performance.now() / 1000;
  if (offlineMode || (soundAt[name] && now - soundAt[name] < gap)) return;
  soundAt[name] = now;
  window.NebulaAudio?.play(name);
}
GameEvents.on('shaft-mined', e => e.planet === state.activePlanet && mineView && deepSound('pick', 0.4));
GameEvents.on('elevator-depart', e => e.planet === state.activePlanet && (e.manual || mineView) && deepSound('liftGo', 2));
GameEvents.on('elevator-arrived', e => e.planet === state.activePlanet && mineView && deepSound('liftArrive', 2));
GameEvents.on('shaft-built', () => deepSound('build', 1));
GameEvents.on('construction-start', () => deepSound('build', 1));
GameEvents.on('underground-open', () => deepSound('build', 1));
GameEvents.on('discovery', () => deepSound('discovery', 1));

// ----- wiring -----
const renderBeforeDeep = render;
render = () => {
  renderBeforeDeep();
  syncMineView();
  renderMineHud();
  renderMineDock();
  if (!anyModalOpen()) {
    mineGuidance();
    if ($('storyBubble')?.classList.contains('hidden')) voidGuidance();
  }
};
const showScreenBeforeDeep = showScreen;
showScreen = screen => {
  showScreenBeforeDeep(screen);
  syncMineView();
};
setInterval(() => {
  if (mineView && currentScreen() === 'home' && !document.hidden) {
    renderMineDock();
    renderMineHud();
    if (typeof openSheetIndex === 'string' && openSheetIndex.startsWith('dc:build:')) renderBuildingSheet();
  }
}, 500);
render();

// Beta 1.5: the cabin tier row in the elevator sheet (logic: deepcore.js LIFT_TIER)
function liftTierRowHTML(e, rate) {
  const max = liftTierMax();
  if (!max) return '';
  const blocker = liftTierBlocker(),
    price = liftTierCost(),
    name = LIFT_TIER_NAMES[Math.min(LIFT_TIER_NAMES.length - 1, e.tier)],
    next = LIFT_TIER_NAMES[Math.min(LIFT_TIER_NAMES.length - 1, e.tier + 1)];
  if (e.tier >= max) return `<li class="track-row lift-tier"><i>⬢</i><div><b>Kabine · ${name} (${e.tier}/${max})</b><small>Höchste Stufe – trägt ${LIFT_TIER.mult ** e.tier}× so viel wie die Grubenkabine.</small></div></li>`;
  const after = elevatorCapacity(e.cap, e.tier + 1) / elevatorCycle();
  return `<li class="track-row lift-tier"><i>⬢</i><div><b>Kabine · ${name} (${e.tier}/${max})</b><small>${blocker ? blocker + ' – dann: ' + next + ', ×' + LIFT_TIER.mult + ' Ladung' : next + ': ×' + LIFT_TIER.mult + ' Ladung · ' + fmtRate(rate) + ' → ' + fmtRate(after) + '/s'}</small></div><button data-dc-tier ${blocker || state.credits < price ? 'disabled' : ''}><b>${fmt(price)}</b></button></li>`;
}
