// Beta 1.7 M1: Mobile World UX 3.0, the phone shell. On phones (and phones in landscape) the colony and the mine are
// full-screen game views instead of a card in a scrolling page:
// - a compact resource HUD at the top;
// - the world in between;
// - the production dock and the navigation at the bottom;
// - every info card of the colony screen in a bottom sheet ("Kolonie"), opened on demand.
// The page itself never scrolls on the colony screen, so a drag in the world only moves the camera (no nested scrolling).
// Friends-UX: the shell runs on every screen size. Wide screens (desktop, tablets) get the same game view with the
// navigation as a rail on the left, one HUD row on top and the details as a side panel (body.world-wide); before,
// they kept a two-column page in which the world had 27 % of the screen. Presentation only: no game state, price, rate or reward is read or changed here
// beyond what the existing UI shows. Loaded after mobile-ux.js (it moves the scene bar it builds).
const WORLD_SHELL_QUERY = '(max-width: 759px), (max-height: 520px)';
const worldShellMedia = window.matchMedia ? window.matchMedia(WORLD_SHELL_QUERY) : null;
const worldShellLandscape = window.matchMedia ? window.matchMedia('(max-height: 520px) and (orientation: landscape)') : null;
function worldShellActive() {
  return true;
}
// a phone (portrait or landscape) vs a wide screen
function worldShellPhone() {
  return Boolean(worldShellMedia?.matches);
}

// ----- DOM: one HUD wrapper around the top bars, one sheet around the colony screen's info cards -----
// Ids, classes and handlers of the moved elements stay as they are; outside the shell both wrappers are plain blocks.
(function buildWorldShell() {
  const shell = $('appShell'),
    home = $('home'),
    hero = $('heroCard');
  if (!shell || !home || !hero || $('worldHud')) return;
  const hud = document.createElement('div');
  hud.className = 'world-hud';
  hud.id = 'worldHud';
  const top = shell.querySelector('.topbar');
  top.before(hud);
  for (const el of [top, shell.querySelector('.resource-panel'), shell.querySelector('.mini-resources'), shell.querySelector('.status-row')]) if (el) hud.append(el);

  const sheet = document.createElement('section');
  sheet.className = 'home-sheet';
  sheet.id = 'homeSheet';
  sheet.setAttribute('aria-label', 'Kolonie-Details');
  sheet.innerHTML =
    '<div class="home-sheet-head" id="homeSheetHead"><i class="home-sheet-grip" aria-hidden="true"></i><b>Details</b><small id="homeSheetPlanet"></small><button class="home-sheet-close" data-home-sheet="close" aria-label="Kolonie-Details schließen">×</button></div><div class="home-sheet-body" id="homeSheetBody"></div>';
  const body = sheet.querySelector('.home-sheet-body');
  // everything after the world, the scene bar, the next-step card and the sector event is detail
  const keep = new Set([hero, $('sceneBar'), $('objectiveCard'), $('eventCard')]);
  [...home.children].filter(el => !keep.has(el)).forEach(el => body.append(el));
  home.append(sheet);
  const backdrop = document.createElement('div');
  backdrop.className = 'home-sheet-backdrop';
  backdrop.id = 'homeSheetBackdrop';
  backdrop.dataset.homeSheet = 'close';
  home.append(backdrop);

  // the scene tools get the sheet button (the colony's details) next to zoom, Mochi and the mine
  const tools = document.querySelector('#sceneBar .scene-tools');
  if (tools) {
    const b = document.createElement('button');
    b.className = 'scene-info';
    b.id = 'homeSheetButton';
    b.dataset.homeSheet = 'toggle';
    b.setAttribute('aria-expanded', 'false');
    b.setAttribute('aria-controls', 'homeSheet');
    b.setAttribute('aria-label', 'Kolonie-Details: Aufträge, Produktion, Planeten');
    b.innerHTML = '<span aria-hidden="true">📋</span><b> Details</b>';
    tools.prepend(b);
  }

  // the mine as a main view in the navigation (shown once the colony has a mine)
  const nav = shell.querySelector('.bottom-nav'),
    homeItem = nav?.querySelector('[data-screen="home"]');
  if (homeItem && !$('navMine')) {
    const m = document.createElement('button');
    m.className = 'nav-item nav-mine';
    m.id = 'navMine';
    m.hidden = true;
    m.setAttribute('aria-label', 'Mine');
    m.innerHTML = '<span>⛏</span><b>Mine</b>';
    homeItem.after(m);
  }
})();

// ----- Friends-UX: on phones the resource chips (ore, crystals, fuel, alloys) open on demand: a tap on the Credits -----
let hudMore = false;
try {
  hudMore = localStorage.getItem('sk-hud-more') === '1';
} catch {}
(function hudMoreToggle() {
  const panel = document.querySelector('#worldHud .resource-panel');
  if (!panel) return;
  panel.setAttribute('role', 'button');
  panel.tabIndex = 0;
  panel.setAttribute('aria-controls', 'hudChips');
  document.querySelector('#worldHud .mini-resources')?.setAttribute('id', 'hudChips');
  const apply = () => {
    document.body.classList.toggle('hud-more', hudMore);
    panel.setAttribute('aria-expanded', String(hudMore));
    panel.setAttribute('aria-label', hudMore ? 'Weitere Werte ausblenden' : 'Weitere Werte zeigen: Erz, Kristalle, Treibstoff, Legierungen');
  };
  const toggle = () => {
    hudMore = !hudMore;
    try {
      localStorage.setItem('sk-hud-more', hudMore ? '1' : '0');
    } catch {}
    apply();
    worldShellSig = '';
    scheduleWorldShell();
  };
  panel.addEventListener('click', toggle);
  panel.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  });
  apply();
})();

// ----- sheet state -----
let homeSheetOpen = false;
function setHomeSheet(open) {
  homeSheetOpen = Boolean(open) && worldShellActive() && currentScreen() === 'home';
  document.body.classList.toggle('home-sheet-open', homeSheetOpen);
  $('homeSheetButton')?.setAttribute('aria-expanded', String(homeSheetOpen));
  const sheet = $('homeSheet');
  if (sheet) {
    if (worldShellActive()) sheet.setAttribute('aria-hidden', String(!homeSheetOpen));
    else sheet.removeAttribute('aria-hidden');
    if (homeSheetOpen) {
      $('homeSheetBody').scrollTop = 0;
      // the open sheet is a dialog on phones; focus goes to its close button for keyboards and screen readers
      requestAnimationFrame(() => sheet.querySelector('.home-sheet-close')?.focus({ preventScroll: true }));
    }
  }
}
// open the sheet and bring one of its cards into view (used by guidance that points at a card inside it)
function revealInHomeSheet(el) {
  if (!el || !worldShellActive() || !$('homeSheetBody')?.contains(el)) return false;
  if (!homeSheetOpen) setHomeSheet(true);
  requestAnimationFrame(() => el.scrollIntoView({ block: 'start', behavior: 'auto' }));
  return true;
}
document.addEventListener('click', event => {
  const b = event.target.closest('[data-home-sheet]');
  if (!b) return;
  const mode = b.dataset.homeSheet;
  setHomeSheet(mode === 'toggle' ? !homeSheetOpen : mode === 'open');
  feedback('open');
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && homeSheetOpen) setHomeSheet(false);
});
// a downward swipe on the sheet's head closes it
(function sheetSwipe() {
  const head = $('homeSheetHead');
  if (!head) return;
  let start = null;
  head.addEventListener('pointerdown', e => (start = { id: e.pointerId, y: e.clientY }));
  head.addEventListener('pointerup', e => {
    if (start && e.pointerId === start.id && e.clientY - start.y > 40) setHomeSheet(false);
    start = null;
  });
  head.addEventListener('pointercancel', () => (start = null));
})();

// ----- the mine in the navigation -----
document.addEventListener('click', event => {
  const nav = event.target.closest('.bottom-nav .nav-item');
  if (!nav) return;
  if (nav.id === 'navMine') {
    if (currentScreen() !== 'home') showScreen('home');
    setHomeSheet(false);
    if (typeof setMineView === 'function') setMineView(true);
    else render();
    feedback('open');
    return;
  }
  // "Kolonie" always means the surface
  if (nav.dataset.screen === 'home' && typeof mineView !== 'undefined' && mineView && typeof setMineView === 'function') setMineView(false);
});

// ----- layout: the world fills exactly what the HUD, the dock and the navigation leave -----
let worldShellSig = '';
function measureWorldShell() {
  const root = document.documentElement,
    active = worldShellActive(),
    home = active && currentScreen() === 'home',
    mine = home && typeof mineView !== 'undefined' && mineView;
  document.body.classList.toggle('world-shell', active);
  document.body.classList.toggle('world-home', home);
  document.body.classList.toggle('world-mine', Boolean(mine));
  const wide = !worldShellPhone();
  document.body.classList.toggle('world-wide', wide);
  // a new player has one main view only: no navigation bar for a single tab (the world gets its space)
  const navItems = [...document.querySelectorAll('.bottom-nav .nav-item')].filter(el => !el.hidden && getComputedStyle(el).display !== 'none');
  document.body.classList.toggle('nav-single', navItems.length <= 1);
  if (!home && homeSheetOpen) setHomeSheet(false);
  // the daily reward button: an icon beside the gems in the shell, back in the resource row on wide screens
  const daily = $('dailyButton'),
    actions = document.querySelector('.topbar-actions'),
    chips = document.querySelector('.mini-resources');
  if (daily && actions && chips) {
    if (active && daily.parentElement !== actions) actions.prepend(daily);
    else if (!active && daily.parentElement !== chips) chips.append(daily);
  }
  if (!active) return;
  const vh = window.visualViewport?.height || window.innerHeight,
    hud = $('worldHud')?.getBoundingClientRect(),
    nav = document.querySelector('.bottom-nav')?.getBoundingClientRect();
  // portrait: the top of whatever is fixed at the bottom (the production or mine dock, else the navigation);
  // landscape: the navigation is a rail on the left and the dock a column on the right (styles.css);
  // wide: the navigation is a rail on the left and the dock a bar at the bottom
  const landscape = Boolean(worldShellLandscape?.matches),
    rail = (landscape || wide) && nav && nav.height > nav.width;
  let bottomTop = landscape || rail ? vh : nav && nav.height ? nav.top : vh,
    rightEdge = window.innerWidth;
  for (const id of ['actionDock', 'mineDock']) {
    const d = $(id);
    if (!d || getComputedStyle(d).display === 'none') continue;
    const r = d.getBoundingClientRect();
    if (!r.height) continue;
    if (landscape) rightEdge = Math.min(rightEdge, r.left);
    else bottomTop = Math.min(bottomTop, r.top);
  }
  const hudH = Math.round(hud?.height || 0),
    bottom = Math.max(0, Math.round(vh - bottomTop)),
    right = Math.max(0, Math.round(window.innerWidth - rightEdge)),
    world = Math.max(160, Math.round(vh - hudH - bottom)),
    railW = rail ? Math.round(nav.right) : 0,
    sig = hudH + ':' + bottom + ':' + right + ':' + world + ':' + railW;
  if (sig === worldShellSig) return;
  worldShellSig = sig;
  root.style.setProperty('--w-hud', hudH + 'px');
  root.style.setProperty('--w-bottom', bottom + 'px');
  root.style.setProperty('--w-right', right + 'px');
  root.style.setProperty('--w-world', world + 'px');
  root.style.setProperty('--w-rail', railW + 'px');
}
function scheduleWorldShell() {
  requestAnimationFrame(() => {
    measureWorldShell();
    // a second pass: the dock's own height can change with the classes set by the first
    requestAnimationFrame(measureWorldShell);
  });
}
worldShellMedia?.addEventListener?.('change', () => {
  worldShellSig = '';
  setHomeSheet(false);
  scheduleWorldShell();
});
window.addEventListener('resize', scheduleWorldShell);
window.addEventListener('orientationchange', () => {
  worldShellSig = '';
  scheduleWorldShell();
});
window.visualViewport?.addEventListener('resize', scheduleWorldShell);
if ('ResizeObserver' in window) {
  const ro = new ResizeObserver(() => scheduleWorldShell());
  for (const el of [$('worldHud'), $('actionDock'), $('mineDock'), document.querySelector('.bottom-nav')]) if (el) ro.observe(el);
}

// ----- per render: classes, the mine nav item, the sheet's planet name -----
// fully automated docks fold away in the shell (the world gets their space); ✋ brings the manual buttons back
let mineDockExpanded = false;
try {
  mineDockExpanded = localStorage.getItem('sk-mine-dock-expanded') === '1';
} catch {}
function mineFullyAutomated() {
  if (typeof builtShafts !== 'function' || typeof colonyAutomation !== 'function') return false;
  const auto = colonyAutomation(),
    open = undergroundOpen(),
    shafts = builtShafts();
  return open && shafts.length > 0 && shafts.every(x => auto[x.id]) && Boolean(auto.elevator);
}
function renderWorldShell() {
  const home = worldShellActive() && currentScreen() === 'home',
    onMine = currentScreen() === 'home' && typeof mineView !== 'undefined' && Boolean(mineView);
  // the colony dock: industry-ui.js sets dock-collapsed when all three steps run automatically
  const dockFolded = home && !onMine && document.body.classList.contains('dock-collapsed');
  document.body.classList.toggle('world-dock-folded', dockFolded);
  const hand = $('dockHandButton');
  if (hand) hand.hidden = !dockFolded;
  const mineAuto = home && onMine && mineFullyAutomated();
  document.body.classList.toggle('mine-dock-folded', mineAuto && !mineDockExpanded);
  const mineHand = $('mineDockToggle');
  if (mineHand) {
    mineHand.hidden = !mineAuto;
    mineHand.setAttribute('aria-expanded', String(mineDockExpanded));
    mineHand.setAttribute('aria-label', mineDockExpanded ? 'Minen-Steuerung einklappen' : 'Minen-Steuerung (Handbetrieb) zeigen');
  }
  measureWorldShell();
  const navMine = $('navMine');
  if (navMine) {
    // the mine is a main view once this world's mine is open or its headframe can be built (deepcore.js rules)
    // from the rules themselves, not from the scene bar's ⛏ button: that one is updated later in the same render, so
    // the tab appeared only on the next tick after start-up (Beta 1.7 QA, flaky navigation e2e)
    navMine.hidden = !deepCoreDef() || !(undergroundOpen() || canOpenUnderground());
    // the scene bar's ⛏ follows the same rule: no mine button before there can be a mine (Friends-UX)
    const toggle = $('mineToggle');
    if (toggle) toggle.hidden = navMine.hidden;
    navMine.classList.toggle('active', onMine);
    navButton('home')?.classList.toggle('active', currentScreen() === 'home' && !onMine);
  }
  const planet = $('homeSheetPlanet');
  if (planet) {
    const name = PLANETS[state.activePlanet]?.name || '';
    if (planet.textContent !== name) planet.textContent = name;
  }
}
(function buildDockToggles() {
  const tools = document.querySelector('#sceneBar .scene-tools');
  if (tools && !$('dockHandButton')) {
    const b = document.createElement('button');
    b.className = 'scene-hand';
    b.id = 'dockHandButton';
    b.hidden = true;
    b.setAttribute('aria-label', 'Handbetrieb: Abbauen, Lore und Verkauf per Hand');
    b.innerHTML = '<span aria-hidden="true">✋</span><b> Hand</b>';
    tools.append(b);
  }
  const top = document.querySelector('#mineHud .mine-top');
  if (top && !$('mineDockToggle')) {
    const b = document.createElement('button');
    b.className = 'mine-dock-toggle';
    b.id = 'mineDockToggle';
    b.hidden = true;
    b.innerHTML = '✋';
    top.append(b);
  }
})();
document.addEventListener('click', event => {
  if (event.target.closest('#dockHandButton')) {
    $('dockToggle')?.click();
    render();
    return;
  }
  if (event.target.closest('#mineDockToggle')) {
    mineDockExpanded = !mineDockExpanded;
    try {
      localStorage.setItem('sk-mine-dock-expanded', mineDockExpanded ? '1' : '0');
    } catch {}
    feedback('open');
    render();
  }
});
const renderBeforeWorldShell = render;
render = () => {
  renderBeforeWorldShell();
  renderWorldShell();
};
const showScreenBeforeWorldShell = showScreen;
showScreen = screen => {
  showScreenBeforeWorldShell(screen);
  if (currentScreen() !== 'home') setHomeSheet(false);
  // the scene bar (and with it 📋 Kolonie) follows the screen at once, not on the next render
  if (typeof renderDistrictNav === 'function') renderDistrictNav(true);
  measureWorldShell();
};
scheduleWorldShell();
// the game's first render ran before this file wrapped render(): bring the shell (mine tab, classes) up to date now,
// not on the first tick a second later (Beta 1.7 QA)
renderWorldShell();
