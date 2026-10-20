// Friends-UX: Abenteuer and Galaxie as clear views with a few labelled areas instead of one long page each.
// - Abenteuer: Mission (the next adventure: campaign card, challenge, story) · Kampf (the live fight with its FEUER
//   dock) · Werft (the ship) · Truhen (the arsenal). A fight that becomes live (a classic campaign wave, a guardian,
//   P.I.P.S.) switches to Kampf once; the player can always switch back.
// - Galaxie: Planeten (the planet route, which moved here from the colony's details, scans, the gate, expeditions,
//   sectors) · Handel (income, Madame Minka, goods, traders, contracts, raw market) · Fracht · Sektor (wheel,
//   factions, territories, strategic events). An area without anything to show has no tab.
// Presentation only: every card, id and handler stays as it was; only which area is visible changes. Loaded after
// onboarding.js.
const VIEW_TABS = {
  battle: {
    title: 'Abenteuer',
    tabs: [
      ['mission', '🚀', 'Mission'],
      ['fight', '⚔', 'Kampf'],
      ['ship', '🛠', 'Werft'],
      ['chests', '🎁', 'Truhen']
    ],
    ids: { storyCard: 'mission', campaignCard: 'mission', challengeCard: 'mission', enemyCard: 'fight', arsenalCard: 'chests', workshop: 'ship' }
  },
  trade: {
    title: 'Galaxie',
    tabs: [
      ['planets', '🪐', 'Planeten'],
      ['market', '◈', 'Handel'],
      ['freight', '⇄', 'Fracht'],
      ['sector', '✦', 'Sektor']
    ],
    ids: {
      planetPanel: 'planets',
      gateCard: 'planets',
      expeditionCard: 'planets',
      sectorPanel: 'planets',
      galaxyIncome: 'market',
      merchantCard: 'market',
      goodsGrid: 'market',
      traderPanel: 'market',
      bazaarContracts: 'market',
      marketAlert: 'market',
      tradeList: 'market',
      freightPanel: 'freight',
      spinnerCard: 'sector',
      factionPanel: 'sector',
      territoryPanel: 'sector',
      strategicEvent: 'sector'
    }
  }
};
const VIEW_COPY = {
  battle: { mission: ['Mission', 'Hier beginnt dein nächstes Abenteuer.'], ship: ['Werft', 'Dein Schiff: verbessern, umbauen, ausrüsten.'], chests: ['Truhen', 'Truhen öffnen und Ausrüstung sammeln.'] },
  trade: { planets: ['Planeten', 'Deine Kolonien, der nächste Planet und das Sprungtor.'], market: ['Sternenbasar', 'Echte Ware aus deinen Kolonien gegen Credits, Händler und Aufträge.'], freight: ['Fracht', 'Frachtrouten zwischen deinen Kolonien.'], sector: ['Sektor', 'Glücksrad, Fraktionen und Sektor-Ereignisse.'] }
};
const viewTab = { battle: null, trade: null },
  // an area the player (or a jump of the game) chose stays; otherwise the default is chosen anew on every render
  viewTabChosen = { battle: false, trade: false };
try {
  const saved = JSON.parse(sessionStorage.getItem('sk-view-tabs') || '{}');
  for (const k of Object.keys(viewTab)) if (VIEW_TABS[k].tabs.some(t => t[0] === saved[k])) (viewTab[k] = saved[k]), (viewTabChosen[k] = true);
} catch {}

// ----- DOM: give the anonymous cards ids, move the planet route to the Galaxie, tag every card with its area -----
(function buildViews() {
  const trade = $('trade'),
    battle = $('battle');
  if (!trade || !battle || $('tradeTabs')) return;
  const planetPanel = $('planetList')?.closest('.planet-panel');
  if (planetPanel) {
    planetPanel.id = 'planetPanel';
    trade.querySelector('.page-title')?.after(planetPanel);
  }
  const named = [
    [trade.querySelector('.expedition-card'), 'expeditionCard'],
    [trade.querySelector('.spinner-card'), 'spinnerCard']
  ];
  for (const [el, id] of named) if (el && !el.id) el.id = id;
  battle.querySelector(':scope > .info-card')?.setAttribute('data-view-tab', 'fight');
  for (const [screen, def] of Object.entries(VIEW_TABS)) {
    const root = $(screen);
    for (const [id, tab] of Object.entries(def.ids)) $(id)?.setAttribute('data-view-tab', tab);
    // a section heading belongs to the card that follows it
    [...root.children].forEach((el, i, all) => {
      if (!el.classList.contains('section-heading') || el.dataset.viewTab) return;
      const next = all.slice(i + 1).find(x => x.dataset.viewTab);
      if (next) el.dataset.viewTab = next.dataset.viewTab;
    });
    const nav = document.createElement('nav');
    nav.className = 'view-tabs';
    nav.id = screen + 'Tabs';
    nav.setAttribute('role', 'tablist');
    nav.setAttribute('aria-label', def.title + ': Bereiche');
    nav.innerHTML = def.tabs.map(([id, icon, label]) => `<button role="tab" type="button" data-view-tab-button="${screen}:${id}" aria-selected="false"><span aria-hidden="true">${icon}</span><b>${label}</b></button>`).join('');
    root.querySelector('.page-title')?.after(nav);
  }
  // the old jump chips of the Galaxie are replaced by the areas
  trade.querySelector('.section-jumps')?.setAttribute('hidden', '');
})();

// the tagged cards of a screen are collected once (render() runs every tick, and a document-wide attribute query per
// area and render was the costliest part of a tick; gameplay-loop CI measurement). A card that left the page refreshes
// the list; code that tags new cards later calls viewTabsChanged().
const viewTabNodes = {};
function viewTabsChanged(screen) {
  if (screen) delete viewTabNodes[screen];
  else for (const k of Object.keys(viewTabNodes)) delete viewTabNodes[k];
}
function viewTabCards(screen) {
  let list = viewTabNodes[screen];
  if (!list || list.some(el => !el.isConnected)) list = viewTabNodes[screen] = [...($(screen)?.querySelectorAll('[data-view-tab]') || [])];
  return list;
}
function viewTabHasContent(screen, tab) {
  return viewTabCards(screen).some(el => el.dataset.viewTab === tab && !el.hidden && !el.classList.contains('hidden') && !el.classList.contains('section-heading'));
}
// a live fight in the Abenteuer card (not the fullscreen arena: that has its own layer)
function adventureFightLive() {
  try {
    if (typeof campaignRun === 'function' && campaignRun() && !(typeof arenaActive === 'function' && arenaActive())) return true;
    if (typeof pips === 'function' && pips().stage === 'battle') return true;
    if (typeof challengeActive === 'function' && challengeActive()) return true;
    return Object.values(state.meta?.guardians || {}).some(g => g?.stage === 'battle');
  } catch {
    return false;
  }
}
let adventureWasLive = false,
  adventureReturnAt = 0;
function viewDefaultTab(screen) {
  if (screen === 'battle') return viewTabHasContent('battle', 'mission') ? 'mission' : 'fight';
  return 'planets';
}
function setViewTab(screen, tab, save = true) {
  if (!VIEW_TABS[screen]?.tabs.some(t => t[0] === tab)) return;
  viewTab[screen] = tab;
  viewTabChosen[screen] = true;
  if (save)
    try {
      sessionStorage.setItem('sk-view-tabs', JSON.stringify(viewTab));
    } catch {}
  renderViewTabs();
}
function renderViewTabs() {
  const live = adventureFightLive();
  if (live && !adventureWasLive) (viewTab.battle = 'fight'), (viewTabChosen.battle = true);
  // after the fight the Kampf area stays while its victory card shows (6 s), then the mission shows the next step (a
  // repair, the next wave); a tab the player chose in the meantime wins. The lost-wave analysis and "zur Reparatur" open
  // their area at once through the jump below.
  else if (!live && adventureWasLive) adventureReturnAt = Date.now() + 6500;
  if (adventureReturnAt && !live && Date.now() >= adventureReturnAt) {
    adventureReturnAt = 0;
    if (viewTab.battle === 'fight' && viewTabHasContent('battle', 'mission')) viewTab.battle = 'mission';
  }
  adventureWasLive = live;
  for (const [screen, def] of Object.entries(VIEW_TABS)) {
    const nav = $(screen + 'Tabs');
    if (!nav) continue;
    const available = def.tabs.filter(([id]) => viewTabHasContent(screen, id) || (screen === 'battle' && id === 'fight'));
    let tab = viewTabChosen[screen] ? viewTab[screen] : null;
    if (!tab || !available.some(t => t[0] === tab)) tab = viewDefaultTab(screen);
    if (!available.some(t => t[0] === tab)) tab = available[0]?.[0] || def.tabs[0][0];
    viewTab[screen] = tab;
    $(screen).dataset.viewTabActive = tab;
    nav.hidden = available.length < 2;
    nav.querySelectorAll('[data-view-tab-button]').forEach(b => {
      const id = b.dataset.viewTabButton.split(':')[1];
      b.hidden = !available.some(t => t[0] === id);
      const on = id === tab;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
      b.classList.toggle('active', on);
    });
    if (screen === 'battle') document.body.classList.toggle('adv-tab-fight', tab === 'fight');
    // the page title names the area (the live fight keeps the game's own title)
    const copy = VIEW_COPY[screen]?.[tab],
      title = $(screen).querySelector('.page-title');
    if (copy && title) {
      title.querySelector('span').textContent = def.title.toUpperCase();
      title.querySelector('h1').textContent = copy[0];
      const p = title.querySelector('p');
      if (p) p.textContent = copy[1];
    } else if (screen === 'battle' && title) title.querySelector('p').textContent = 'Besiege Gegner für Baupläne und Credits.';
  }
}
document.addEventListener('click', event => {
  const b = event.target.closest('[data-view-tab-button]');
  if (!b) return;
  const [screen, tab] = b.dataset.viewTabButton.split(':');
  if (screen === 'battle') adventureReturnAt = 0;
  setViewTab(screen, tab);
  feedback('open');
  $(screen)?.scrollTo?.(0, 0);
  scrollTo(0, 0);
});
// arrow keys move between the areas (a tab list)
document.addEventListener('keydown', event => {
  const b = event.target.closest?.('[data-view-tab-button]');
  if (!b || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const all = [...b.parentElement.querySelectorAll('[data-view-tab-button]:not([hidden])')],
    i = all.indexOf(b),
    next = event.key === 'Home' ? all[0] : event.key === 'End' ? all.at(-1) : all[(i + (event.key === 'ArrowRight' ? 1 : -1) + all.length) % all.length];
  event.preventDefault();
  next.click();
  next.focus();
});
// every jump of the game to a card ("zur Werft", the lost-wave analysis, "Fracht anlegen", the chest card …) opens the
// area that holds it first
const scrollIntoViewBeforeViews = Element.prototype.scrollIntoView;
Element.prototype.scrollIntoView = function (...args) {
  const tagged = this.closest?.('[data-view-tab]'),
    screen = tagged?.closest('#battle, #trade')?.id;
  if (tagged && screen && viewTab[screen] !== tagged.dataset.viewTab) setViewTab(screen, tagged.dataset.viewTab, false);
  return scrollIntoViewBeforeViews?.apply(this, args);
};
// choosing a planet on the route takes the player to that colony (the route lives in the Galaxie now)
document.addEventListener('click', event => {
  const planet = event.target.closest('#planetPanel [data-planet]');
  if (planet && state.planetsUnlocked[+planet.dataset.planet] && currentScreen() === 'trade') showScreen('home');
});
// guidance that sends the player to the planet route opens the Galaxie on its planets
const renderObjectiveBeforeViews = renderObjective;
renderObjective = function () {
  renderObjectiveBeforeViews();
  const card = $('objectiveCard');
  if (/SCANNEN/.test($('objectiveAction')?.textContent || '') && card.dataset.screen === 'home' && !card.dataset.sheet) {
    card.dataset.screen = 'trade';
    (viewTab.trade = 'planets'), (viewTabChosen.trade = true);
  }
  // R1: the sector goals (Vesper-Drift kartieren, Sektorprofil auswerten, Expedition begleiten) live in the Planeten
  // area. A player who had chosen another area last landed on "✦ Sektor", whose free Signal-Scanner says "✦ SCANNEN" –
  // the guided-player audit pressed it for hours (docs/release-r1/GAMEPLAY_AUDIT.md). renderSectorObjective (game.js,
  // drawn after this) sets the tab and names the button as it is written (SCAN); every other goal clears it here.
  card.dataset.tab = '';
  delete card.dataset.goPlanet; // never data-planet: the planet route's handler reacts to any [data-planet]
  // R1-14: a colony founded but never visited (no cat hired there yet) waited unseen – the card kept showing the old
  // planet's general goals for hours (guided-player audit). Instead of those general goals it now names the new colony;
  // story, sector, elevator and first-step goals keep their priority.
  const GENERIC = ['Planetenrolle wählen', 'Förderbasis ausbauen', 'Transportengpass lösen', 'Mine ausbauen'];
  const fresh = PLANETS.findIndex((_, i) => i !== state.activePlanet && state.planetsUnlocked[i] && state.colonies[i] && Object.values(state.colonies[i].staff || {}).every(n => !n));
  if (fresh > 0 && GENERIC.includes($('objectiveTitle')?.textContent)) {
    $('objectiveIcon').textContent = '🪐';
    $('objectiveTitle').textContent = PLANETS[fresh].name + ' besuchen';
    $('objectiveText').textContent = 'Deine neue Kolonie wartet: eigene Gebäude, eigene Rohstoffe und die nächste Geschichte. Flieg über die Galaxie hin (HINFLIEGEN).';
    $('objectiveAction').textContent = 'GALAXIE ›';
    card.dataset.screen = 'trade';
    card.dataset.sheet = '';
    card.dataset.tab = 'route';
    card.dataset.goPlanet = String(fresh);
  }
};
document.addEventListener('click', event => {
  const card = event.target.closest('#objectiveCard');
  if (!card?.dataset.tab) return;
  setTimeout(() => {
    setViewTab('trade', 'planets');
    const target =
      card.dataset.tab === 'route'
        ? document.querySelector('#planetPanel [data-planet="' + card.dataset.goPlanet + '"]')
        : document.querySelector('#sectorPanel [data-sector-scan], #sectorPanel [data-sector-expedition]') || $('sectorPanel');
    target?.scrollIntoView?.({ block: 'center', behavior: document.body.classList.contains('reduce-motion') ? 'auto' : 'smooth' });
    if (target?.matches?.('button')) {
      target.classList.remove('step-nudge');
      void target.offsetWidth;
      target.classList.add('step-nudge');
      setTimeout(() => target.classList.remove('step-nudge'), 750);
    }
  }, 0);
});

const renderBeforeViews = render;
render = () => {
  renderBeforeViews();
  renderViewTabs();
};

// Escape (keyboard; the hardware back key on Android is handled by platform.js): dialogs first (platform.js), then the
// open building panel, then the mine back to the surface – one step per press, nothing else changes
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || topModal() || document.body.classList.contains('home-sheet-open')) return;
  const sheet = $('buildingSheet');
  if (sheet && !sheet.classList.contains('hidden') && openSheetIndex !== null) {
    openSheetIndex = null;
    renderBuildingSheet();
    render();
    return;
  }
  if (currentScreen() === 'home' && typeof mineView !== 'undefined' && mineView && typeof setMineView === 'function') setMineView(false);
});
