// Mobile UX polish (QA audit M-02, N-01, N-03): presentation-only helpers. No game state, balance, unlock or reward is
// changed here — the module only reads state and wraps UI functions the way the other UI modules do. Loaded after every
// UI module and before platform.js. Evidence and before/after captures: docs/implementation/mobile-ux-polish/.

// ----- M-02: bring the boss stage into the free band above the fixed combat dock (phones only) -----
// The combat dock is position: fixed (132 px, 232 px while Cogsworth's Taktband or Petalguard's bloom dock runs) and the stage lives in the normal
// page flow, so a boss fight opened at scroll 0 could sit behind the controls (0–55 % visible on 320–430 px phones).
// The stage is scrolled into view ONCE per fight start / screen entry, never while a fight is running (no layout shifts).
// Beta 1.2: a running Sektorprüfung counts too (its timed phases must be visible above the dock)
const MOBILE_UX_BOSS_MODES = ['pips', 'frostbyte', 'emberbell', 'cogsworth', 'petalguard', 'challenge'];
let mobileUxRevealToken = 0;
let mobileUxBossWasLive = false;
function mobileUxBossLive() {
  try {
    const view = window.NebulaView?.combat?.();
    return Boolean(view && (view.boss || MOBILE_UX_BOSS_MODES.includes(view.story?.mode)));
  } catch {
    return false;
  }
}
function mobileUxRevealStage() {
  if (window.innerWidth >= 760 || currentScreen() !== 'battle') return;
  const token = ++mobileUxRevealToken;
  // two frames: the dock (and its Taktband row) must have been laid out before we measure
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      if (token !== mobileUxRevealToken || currentScreen() !== 'battle') return;
      const dock = $('combatDock'),
        canvas = $('enemyCard')?.querySelector('canvas');
      if (!dock || !canvas || getComputedStyle(dock).display === 'none' || !mobileUxBossLive()) return;
      const stage = canvas.getBoundingClientRect(),
        dockTop = dock.getBoundingClientRect().top;
      if (stage.height <= 0 || (stage.top >= 0 && stage.bottom <= dockTop - 4)) return; // already fully visible
      const top = stage.top - 8;
      try {
        window.scrollBy({ top, behavior: 'instant' });
      } catch {
        window.scrollBy(0, top);
      }
    })
  );
}
const showScreenBeforeMobileUx = showScreen;
showScreen = screen => {
  showScreenBeforeMobileUx(screen);
  if (screen === 'battle') mobileUxRevealStage();
};

// ----- N-01: one first goal — the manual chain ABBAUEN → LORE → VERKAUF, step by step, before the first sale -----
// industryObjective() (industry-ui.js) offers "Bergbau-Manager einstellen" at second 0 because the 120 starting Credits
// already cover the 100-Credit manager, which pulled new players away from the loop the intro and the dock teach.
// This only changes what the objective card SAYS: prices, unlocks and the manager chain are untouched. Existing saves
// (anything earned, any prestige) never see it, and the card falls back to the normal objective afterwards.
const MOBILE_UX_START_CREDITS = 120; // game.js initial state: credits and totalEarned both start at 120; any sale lifts totalEarned above it
function mobileUxFirstLoopStep() {
  if (state.totalEarned > MOBILE_UX_START_CREDITS || state.galaxiesSold > 0 || state.activePlanet !== 0 || !PLANETS[0]) return null;
  if (['warned', 'battle', 'defeated'].includes(pips().stage)) return null;
  const auto = colonyAutomation(),
    colony = colonyAt(),
    depot = state.planetOps.storage[0] || 0;
  if (depot >= 1 && !auto.stall && !auto.dock) return 'stall';
  if ((colony.stock.pile >= 1 || colony.trip) && !auto.rail) return 'rail';
  if (!auto.mine && depot < 1) return 'mine';
  return null;
}
const MOBILE_UX_FIRST_LOOP = {
  mine: ['⛏', 'Erste Credits · 1/3 Abbauen', 'Tippe unten auf ABBAUEN – die Kristalle landen auf der Halde.', 'ABBAUEN ›'],
  rail: ['🛒', 'Erste Credits · 2/3 Lore', 'Schick die Lore los – sie bringt die Kristalle von der Halde ins Lager.', 'LORE ›'],
  stall: ['◈', 'Erste Credits · 3/3 Verkaufen', 'Tippe auf VERKAUF – das Lager wird zu deinen ersten Credits.', 'VERKAUF ›']
};
const renderObjectiveBeforeMobileUx = renderObjective;
renderObjective = function () {
  renderObjectiveBeforeMobileUx();
  const step = mobileUxFirstLoopStep();
  document.body.dataset.nextStep = step || '';
  if (!step) return;
  const goal = MOBILE_UX_FIRST_LOOP[step];
  $('objectiveIcon').textContent = goal[0];
  $('objectiveTitle').textContent = goal[1];
  $('objectiveText').textContent = goal[2];
  $('objectiveAction').textContent = goal[3];
  const card = $('objectiveCard');
  card.dataset.screen = 'home';
  card.dataset.sheet = '';
};

// ----- N-03: say where a planet discovery took the player, and offer the way back -----
// Finishing a scan switches the viewed planet to the new colony (game.js, unchanged). The banner now names the old
// colony and a non-blocking "Zurück" chip appears for a while — no confirmation, no extra step for repeat players.
let mobileUxSeenPlanet = state.activePlanet;
let mobileUxChipTimer = 0;
function mobileUxPlanetName(index) {
  return (typeof PLANET_SHORT !== 'undefined' && PLANET_SHORT[index]) || PLANETS[index]?.name || 'Kolonie';
}
function mobileUxHideReturnChip() {
  clearTimeout(mobileUxChipTimer);
  $('planetReturnChip')?.remove();
}
function mobileUxAnnouncePlanetSwitch(from, planet) {
  const to = PLANETS.indexOf(planet);
  if (!Number.isInteger(from) || from === to || !state.planetsUnlocked[from]) return;
  const hero = $('heroCard');
  hero?.querySelector('.planet-discovery')?.insertAdjacentHTML('beforeend', `<small class="discovery-note">Du bist jetzt hier · ${mobileUxPlanetName(from)} arbeitet weiter</small>`);
  mobileUxHideReturnChip();
  if (!hero) return;
  const chip = document.createElement('button');
  chip.id = 'planetReturnChip';
  chip.className = 'planet-return-chip';
  chip.type = 'button';
  chip.dataset.from = String(from);
  chip.textContent = '↩ Zurück zu ' + mobileUxPlanetName(from);
  hero.append(chip);
  mobileUxChipTimer = setTimeout(mobileUxHideReturnChip, 20000);
}
document.addEventListener('click', event => {
  const chip = event.target.closest('#planetReturnChip');
  if (!chip) return;
  const from = Number(chip.dataset.from);
  mobileUxHideReturnChip();
  // the same handler the planet route list uses (selects the planet, focus animation, toast)
  document.querySelector(`.planet-route[data-planet="${from}"]`)?.click();
});
const showPlanetDiscoveryBeforeMobileUx = showPlanetDiscovery;
showPlanetDiscovery = function (planet) {
  const from = mobileUxSeenPlanet; // the planet that was on screen before the scan finished
  showPlanetDiscoveryBeforeMobileUx(planet);
  mobileUxAnnouncePlanetSwitch(from, planet);
};

// ----- shared render hook: remembers the viewed planet and detects "a boss fight just became live" -----
const renderBeforeMobileUx = render;
render = () => {
  renderBeforeMobileUx();
  if (state.activePlanet !== mobileUxSeenPlanet) {
    // the chip is for the planet the player was taken away from — drop it once they move on by themselves
    if ($('planetReturnChip') && state.activePlanet === Number($('planetReturnChip').dataset.from)) mobileUxHideReturnChip();
    mobileUxSeenPlanet = state.activePlanet;
  }
  if (currentScreen() === 'battle') {
    const live = mobileUxBossLive();
    if (live && !mobileUxBossWasLive) mobileUxRevealStage();
    mobileUxBossWasLive = live;
  } else mobileUxBossWasLive = false;
};
render();

// ----- Living Worlds 2.0: district jumps under the colony card -----
// The colony is a wide world the player drags through; these buttons are the short way to each district (and the
// accessible alternative to dragging). The district in the middle of the view is marked.
let districtNavSig = '';
function colonySceneHandle() {
  return window.NebulaScenesRuntime?.mounted?.colony?.scene || null;
}
// Beta 1.6: one bar under the card holds the district jumps and the scene tools, so nothing covers the world
const SCENE_ZOOM_KEY = 'nebula-harvest-colony-zoom';
(function buildSceneBar() {
  const card = $('heroCard'),
    nav = $('districtNav');
  if (!card || !nav || $('sceneBar')) return;
  const bar = document.createElement('div');
  bar.className = 'scene-bar';
  bar.id = 'sceneBar';
  nav.before(bar);
  bar.append(nav);
  const tools = document.createElement('div');
  tools.className = 'scene-tools';
  tools.innerHTML = '<button class="scene-zoom" id="sceneZoom" aria-pressed="false" aria-label="Übersicht der Kolonie">🔭<b> Übersicht</b></button>';
  bar.append(tools);
  for (const [id, icon, label] of [['mochiFocus', '🐾', 'Mochi'], ['mineToggle', '⛏', 'Mine']]) {
    const b = $(id);
    if (!b) continue;
    b.innerHTML = '<span aria-hidden="true">' + icon + '</span><b> ' + label + '</b>';
    tools.append(b);
  }
  const status = $('sceneStatus'),
    copy = card.querySelector('.hero-copy');
  if (status && copy) copy.append(status);
  let saved = 'detail';
  try {
    saved = localStorage.getItem(SCENE_ZOOM_KEY) === 'overview' ? 'overview' : 'detail';
  } catch {}
  if (saved === 'overview') setTimeout(() => applySceneZoom('overview'), 0);
})();
function applySceneZoom(level) {
  const scene = colonySceneHandle(),
    now = scene?.setZoom ? scene.setZoom(level) : 'detail',
    b = $('sceneZoom');
  if (b) {
    b.setAttribute('aria-pressed', String(now === 'overview'));
    b.setAttribute('aria-label', now === 'overview' ? 'Nahansicht der Kolonie' : 'Übersicht der Kolonie');
    b.innerHTML = now === 'overview' ? '🔍<b> Nah</b>' : '🔭<b> Übersicht</b>';
  }
  try {
    localStorage.setItem(SCENE_ZOOM_KEY, now);
  } catch {}
  districtNavSig = '';
  return now;
}
document.addEventListener('click', event => {
  if (!event.target.closest('#sceneZoom')) return;
  applySceneZoom(colonySceneHandle()?.zoom === 'overview' ? 'detail' : 'overview');
  feedback('open');
});
function renderDistrictNav(force = false) {
  const nav = $('districtNav'),
    scene = colonySceneHandle();
  if (!nav) return;
  const list = scene?.districts ? scene.districts() : [],
    mine = $('heroCard')?.classList.contains('mine-view'),
    show = currentScreen() === 'home' && list.length > 0 && !mine,
    sig = show + ':' + state.activePlanet + ':' + list.map(d => d.id + (d.active ? '*' : '')).join(',');
  if (!force && sig === districtNavSig) return;
  districtNavSig = sig;
  nav.hidden = !show;
  // the scene tools follow the colony card (hidden in the mine and off the colony screen)
  const bar = $('sceneBar');
  if (bar) {
    bar.classList.toggle('mine-view', Boolean(mine));
    bar.hidden = currentScreen() !== 'home' || !$('heroCard')?.classList.contains('has-scene');
  }
  if (!show) return;
  nav.innerHTML = list
    .map(d => `<button data-district="${d.id}" class="${d.active ? 'active' : ''}" ${d.active ? 'aria-current="true"' : ''} aria-label="${d.name}"><span aria-hidden="true">${d.icon}</span><b>${d.name}</b></button>`)
    .join('');
}
const renderBeforeDistrictNav = render;
render = () => {
  renderBeforeDistrictNav();
  renderDistrictNav();
};
document.addEventListener('click', event => {
  const b = event.target.closest('[data-district]');
  if (!b) return;
  colonySceneHandle()?.focusDistrict?.(b.dataset.district);
  feedback('open');
  renderDistrictNav(true);
});
