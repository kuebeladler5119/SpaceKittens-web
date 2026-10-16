// Freight routes UI (Galaxie tab): route cards with live status and a compact route editor.
// All state changes go through freight.js (createRoute / editRoute / deleteRoute / dispatchRoute).

const planetIconCache = new Map();
function planetIconURL(index, size = 64) {
  const key = index + ':' + size;
  if (planetIconCache.has(key)) return planetIconCache.get(key);
  let url = '';
  try {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    if (ctx && c.toDataURL) {
      window.NebulaArt.drawPlanet(ctx, PLANETS[index].id, size / 2, size / 2, size * 0.42, 0.4);
      url = c.toDataURL('image/png');
    }
  } catch {
    url = '';
  }
  planetIconCache.set(key, url);
  return url;
}
function planetIcon(index, size = 40) {
  const url = planetIconURL(index, size * 2);
  return url ? `<img class="planet-icon" src="${url}" alt="" width="${size}" height="${size}" />` : `<i class="planet-icon">${PLANETS[index].icon}</i>`;
}
function cargoShipURL() {
  const Art = window.NebulaArt;
  return Art?.shipPreviewURL?.('Pioneer', state.ship, Art.SHIP_PALETTES[state.meta?.equipped?.ship] || Art.SHIP_PALETTES.default, window.SpaceKittens?.ROSTER[3], 96, 56) || '';
}
const PLANET_SHORT = ['Orion', 'Glacies', 'Pyra-9', 'Mekhanos', 'Viridia', 'Aurelia'];
function shortName(i) {
  return PLANET_SHORT[i] || PLANETS[i].name;
}
function clockText(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}
const routeEditor = { open: false, from: 0, to: 1, resource: 'raw', amount: 50, repeat: true };
function dockedColonies() {
  return PLANETS.map((_, i) => i).filter(i => freightDocked(i));
}
function routeStatus(route, now) {
  if (route.status === 'transit') {
    const p = Math.min(1, (now - route.departAt) / Math.max(1, route.arriveAt - route.departAt));
    return { text: 'Unterwegs · Ankunft in ' + clockText(route.arriveAt - now), progress: p, cls: 'transit' };
  }
  if (route.status === 'unloading') return { text: 'Ziel-Lager voll · ' + fmt(route.cargo) + ' warten an Bord', progress: 1, cls: 'waiting' };
  const problem = routeProblem(route);
  if (problem) return { text: problem, progress: 0, cls: 'blocked' };
  if (route.paused) return { text: 'Pausiert', progress: 0, cls: 'paused' };
  if (now < route.readyAt) return { text: 'Frachter kehrt zurück · ' + clockText(route.readyAt - now), progress: 0, cls: 'return' };
  const stock = materialStock(route.from, route.resource);
  if (routeAutomated(route)) return { text: stock >= route.amount ? 'Startet automatisch' : 'Wartet auf volle Ladung (' + fmt(stock) + ' / ' + fmt(route.amount) + ')', progress: 0, cls: 'ready' };
  return { text: stock > 0 ? 'Bereit · Start per Hand' : 'Keine Ware am Start', progress: 0, cls: 'ready' };
}
function renderFreight() {
  const box = $('freightPanel');
  if (!box) return;
  const now = Date.now(),
    docks = dockedColonies(),
    ship = cargoShipURL();
  $('routeCount').textContent = state.routes.length + ' / ' + FREIGHT_MAX_ROUTES;
  let html = '';
  if (docks.length < 2)
    html += `<p class="freight-hint">Baue auf zwei Kolonien ein Frachtdock, um Waren zwischen Planeten zu fliegen. (${docks.length}/2)</p>`;
  html += state.routes
    .map(route => {
      const st = routeStatus(route, now),
        mat = FREIGHT_MATERIALS[route.resource],
        auto = route.repeat ? (isAutomated('dock', route.from) ? 'Auto · Logistik-Manager' : 'Wiederholen braucht Logistik-Manager') : 'Einzelflug',
        idle = route.status === 'idle';
      return `<article class="route-card ${st.cls}" data-route="${route.id}">
        <div class="route-line">${planetIcon(route.from)}<div class="route-track"><i style="width:${Math.round(st.progress * 100)}%"></i>${ship ? `<img class="route-ship" src="${ship}" alt="" style="left:${Math.round(st.progress * 100)}%" />` : ''}</div>${planetIcon(route.to)}</div>
        <b>${mat.icon} ${fmt(route.status === 'idle' ? route.amount : route.cargo)} ${mat.name} · ${shortName(route.from)} → ${shortName(route.to)}</b>
        <small>${st.text} · ${auto} · ${route.flights} Flüge</small>
        <div class="route-actions">
          <button data-route-go="${route.id}" ${idle && !routeProblem(route) && now >= route.readyAt && materialStock(route.from, route.resource) > 0 && state.fuel >= FREIGHT_FUEL_PER_FLIGHT ? '' : 'disabled'}>STARTEN · 1 ⛽</button>
          ${route.repeat ? `<button class="secondary" data-route-pause="${route.id}">${route.paused ? 'WEITER' : 'PAUSE'}</button>` : ''}
          <button class="secondary" data-route-delete="${route.id}" ${idle ? '' : 'disabled'} aria-label="Route löschen">✕</button>
        </div>
      </article>`;
    })
    .join('');
  if (docks.length >= 2 && state.routes.length < FREIGHT_MAX_ROUTES) {
    if (!routeEditor.open) html += `<button class="route-new" data-route-open>+ NEUE FRACHTROUTE</button>`;
    else {
      const e = routeEditor;
      if (!docks.includes(e.from)) e.from = docks[0];
      if (!docks.includes(e.to) || e.to === e.from) e.to = docks.find(i => i !== e.from);
      const cap = freightCapacity(e.from);
      e.amount = Math.max(1, Math.min(cap, e.amount));
      const chips = (field, values, label) =>
        values.map(v => `<button class="chip ${e[field] === v ? 'active' : ''}" data-route-set="${field}:${v}">${label(v)}</button>`).join('');
      html += `<article class="route-editor">
        <b>Neue Frachtroute</b>
        <small>Von</small><div class="chips">${chips('from', docks, i => planetIcon(i, 22) + shortName(i))}</div>
        <small>Nach</small><div class="chips">${chips('to', docks.filter(i => i !== e.from), i => planetIcon(i, 22) + shortName(i))}</div>
        <small>Ware (Bestand am Start)</small><div class="chips">${chips('resource', Object.keys(FREIGHT_MATERIALS), id => FREIGHT_MATERIALS[id].icon + ' ' + FREIGHT_MATERIALS[id].name + ' · ' + fmt(materialStock(e.from, id)))}</div>
        <small>Ladung je Flug (max. ${fmt(cap)})</small>
        <div class="amount-row"><button data-route-amount="-">−</button><b>${fmt(e.amount)}</b><button data-route-amount="+">+</button><button data-route-amount="max">MAX</button></div>
        <label class="repeat-toggle"><input type="checkbox" data-route-repeat ${e.repeat ? 'checked' : ''} /> Wiederholen (läuft automatisch, wenn am Start ein Logistik-Manager arbeitet)</label>
        <p class="freight-hint">Flugzeit ${clockText(freightDuration(e.from, e.to))} · Rückflug gleich lang · 1 ⛽ je Flug · Ziel-Lager: ${fmt(materialCapacity(e.to, e.resource))}</p>
        <div class="route-actions"><button data-route-create>ROUTE ANLEGEN</button><button class="secondary" data-route-close>ABBRECHEN</button></div>
      </article>`;
    }
  }
  setHTML(box, html);
}
document.addEventListener('click', event => {
  const t = event.target;
  const go = t.closest('[data-route-go]');
  if (go) {
    const route = state.routes.find(r => r.id === +go.dataset.routeGo);
    if (route && dispatchRoute(route)) {
      feedback('upgrade', 'light');
      toast('Frachter gestartet!');
      save();
    }
    return render();
  }
  const pause = t.closest('[data-route-pause]');
  if (pause) {
    const route = state.routes.find(r => r.id === +pause.dataset.routePause);
    if (route) editRoute(route.id, { paused: !route.paused });
    save();
    return render();
  }
  const del = t.closest('[data-route-delete]');
  if (del) {
    if (deleteRoute(+del.dataset.routeDelete)) save();
    return render();
  }
  if (t.closest('[data-route-open]')) {
    routeEditor.open = true;
    return renderFreight();
  }
  if (t.closest('[data-route-close]')) {
    routeEditor.open = false;
    return renderFreight();
  }
  const set = t.closest('[data-route-set]');
  if (set) {
    const [field, value] = set.dataset.routeSet.split(':');
    routeEditor[field] = field === 'resource' ? value : +value;
    return renderFreight();
  }
  const amount = t.closest('[data-route-amount]');
  if (amount) {
    const cap = freightCapacity(routeEditor.from),
      step = Math.max(1, Math.round(cap / 10));
    const a = amount.dataset.routeAmount;
    routeEditor.amount = a === 'max' ? cap : Math.max(1, Math.min(cap, routeEditor.amount + (a === '+' ? step : -step)));
    return renderFreight();
  }
  if (t.closest('[data-route-create]')) {
    const route = createRoute(routeEditor);
    if (route) {
      routeEditor.open = false;
      feedback('unlock', 'success');
      toast('Frachtroute angelegt.');
      save();
    } else toast('Diese Route ist nicht möglich.');
    return render();
  }
});
document.addEventListener('change', event => {
  if (event.target.closest('[data-route-repeat]')) routeEditor.repeat = event.target.checked;
});
// Colony scene: route freighters follow the authoritative route timestamps (no arrival before it is processed).
const SHIP_ANIM_MS = 4000;
const colonyViewBeforeFreight = window.NebulaView.colony;
window.NebulaView.colony = () => {
  const view = colonyViewBeforeFreight(),
    here = state.activePlanet,
    now = Date.now(),
    routeShips = [];
  for (const r of state.routes) {
    if (r.from === here && r.status === 'transit' && now - r.departAt < SHIP_ANIM_MS)
      routeShips.push({ id: r.id, kind: 'depart', progress: (now - r.departAt) / SHIP_ANIM_MS, resource: r.resource });
    if (r.to === here && r.status === 'transit' && r.arriveAt - now < SHIP_ANIM_MS)
      routeShips.push({ id: r.id, kind: 'arrive', progress: Math.min(0.999, 1 - (r.arriveAt - now) / SHIP_ANIM_MS), resource: r.resource });
    if (r.to === here && (r.status === 'unloading' || (r.status === 'idle' && r.flights > 0 && now - r.arriveAt < 2500)))
      routeShips.push({ id: r.id, kind: 'unload', progress: 1, resource: r.resource });
  }
  return { ...view, routeShips: routeShips.slice(0, 2) };
};
const renderBeforeFreight = render;
render = () => {
  renderBeforeFreight();
  if (currentScreen() === 'trade') renderFreight();
};
const showScreenBeforeFreight = showScreen;
showScreen = screen => {
  showScreenBeforeFreight(screen);
  if (currentScreen() === 'trade') renderFreight();
};
// Live status: progress bars tick every second while the Galaxie tab is open.
setInterval(() => currentScreen() === 'trade' && !routeEditor.open && renderFreight(), 1000);

// ----- Contextual guidance for the later professions (one-time, kept in Mochi's logbook) -----
// Shown only after the core tutorial (mine/cart/sale automated on Orion) so it never interrupts the first steps.
Object.assign(STORY, {
  'tip-production': {
    title: 'Tipp: Raffinerie-Team',
    lines: [
      ['mochi', 'Die Raffinerie steht! Sie braucht Nachschub aus dem Lagerhaus – das Beschicken übernimmt jemand mit dem Beruf Lager.'],
      ['mochi', 'Das Schmelzen selbst macht ein Produktions-Manager. Beide stellst du direkt am Gebäude ein (Lagerhaus und Raffinerie antippen).']
    ]
  },
  'tip-logistics': {
    title: 'Tipp: Frachtdock',
    lines: [['pip', 'Mein Frachtdock verkauft zusätzlich zum Stand – aber nur mit Logistik-Manager. Tipp das Dock an, dort kannst du jemanden einstellen.']]
  },
  'tip-freight': {
    title: 'Tipp: Frachtrouten',
    lines: [
      ['pip', 'Zwei Kolonien mit Frachtdock! Unter Galaxie → Frachtrouten bringst du echte Ware von Welt zu Welt.'],
      ['pip', 'Die Ladung verlässt das Lager beim Start und kommt erst bei der Landung an. Mit Logistik-Manager am Start fliegt eine Wiederhol-Route von selbst.']
    ]
  }
});
function guidanceTips() {
  const orion = state.colonies[0];
  if (!orion || !['mine', 'rail', 'stall'].every(w => isAutomated(w, 0))) return;
  const journal = state.meta.story.journal,
    here = state.activePlanet,
    colony = state.colonies[here];
  if (!journal.includes('tip-production') && colony.industry.refinery > 0 && !(isAutomated('depot', here) && isAutomated('refinery', here)))
    return storyEvent('tip-production');
  if (!journal.includes('tip-logistics') && colony.buildings[3].level > 0 && !isAutomated('dock', here) && state.totalEarned >= 8000)
    return storyEvent('tip-logistics');
  if (!journal.includes("tip-freight") && state.planetsUnlocked.filter((_, i) => freightDocked(i)).length >= 2) return storyEvent("tip-freight");
}
const renderBeforeGuidance = render;
render = () => {
  renderBeforeGuidance();
  if (!anyModalOpen()) guidanceTips();
};
