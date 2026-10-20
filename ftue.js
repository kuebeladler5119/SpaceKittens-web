// Beta 1.8 FTUE 2.0: after the first steps (onboarding.js) the same coach – Mochi's bubble and the ring – introduces
// each new part of the game once, at the moment it becomes relevant, from the real game state:
//   chain    – the whole chain (Abbau, Lore, Verkauf) runs by itself: a short success moment
//   mine     – the mine can be built or is open: the way there (⛏ Mine)
//   headframe – in the mine before it is built: build the Förderturm (its panel)
//   elevator – the first look into the mine: the Förderaufzug and what it does
//   back     – after that, still in the mine: the way back to the colony
//   refinery – the Raffinerie is unlocked and not built yet: the camera glides there and the ring shows it
// One hint at a time; × dismisses it for good; the global "Hinweise ausblenden" (Hilfe) silences them too; Hilfe can
// show them again. A discovery the player already did (an older save, or the player went ahead) is marked seen without
// a bubble. Nothing is granted, locked or skipped by these hints, so replaying them can never pay anything twice.
// State: state.meta.onboarding.seen (onboarding-state.js, default-filled, schema unchanged).

const FTUE_TEXT = {
  chain: ['Geschafft', 'Die Kette läuft von selbst', 'Abbau, Lore und Verkauf arbeiten jetzt ohne dich – auch offline.'],
  mine: ['Neu entdeckt', 'Unter der Kolonie: die Mine', 'Tippe auf ⛏ Mine – dort liegen Schächte voller Erz.'],
  headframe: ['Die Mine', 'Baue den Förderturm', 'Er öffnet den Weg in die Tiefe: Schächte, ein Aufzug und mehr Erz.'],
  elevator: ['Die Mine', 'Der Förderaufzug', 'Er holt das Erz aus den Schächten nach oben. Tippe ihn an.'],
  back: ['Die Mine', 'Zurück zur Kolonie', 'Hier geht es nach oben. Die Mine arbeitet weiter.'],
  refinery: ['Neu freigeschaltet', 'Die Raffinerie', 'Sie macht aus Rohkristallen wertvollere Waren. Tippe sie an.']
};
// how long an informational hint stays (s); the others stay until done or dismissed
const FTUE_SHOW_FOR = { chain: 8, back: 12 };
let ftueShown = null,
  ftueShownAt = 0,
  ftueChecked = false,
  // Hilfe → "erneut zeigen": the hints show again when relevant, also for what was done before; only a new action (or ×)
  // ends each one (this session)
  ftueReplay = false;
// the mine's hints (headframe or elevator) were shown in this session: the way back follows them, not an old elevator
let ftueSawElevator = false;
const ftueShafts = () => (typeof builtShafts === 'function' ? builtShafts(0).length : 0);

function ftueSeen() {
  const o = onboardingState();
  if (!o.seen || typeof o.seen !== 'object') o.seen = {};
  return o.seen;
}
function ftueSee(id) {
  ftueSeen()[id] = true;
  if (ftueShown === id && !(FTUE_SHOW_FOR[id] && Date.now() - ftueShownAt <= FTUE_SHOW_FOR[id] * 1000 && !ftueClosed)) ftueShown = null;
}
// × on a timed moment ends it at once
let ftueClosed = false;
const ftueOrion = () => state.activePlanet === 0;
const ftueInMine = () => typeof mineView !== 'undefined' && Boolean(mineView);
const ftueChainRuns = () => ['mine', 'rail', 'stall'].every(w => isAutomated(w, 0));
// what the player already did (checked once per load and whenever the hints are evaluated)
const FTUE_DONE = {
  chain: () => false, // only a moment: marked when shown (or below for saves that already run)
  mine: () => ftueInMine() || (!ftueReplay && undergroundOpen(0) && ftueShafts() > 1),
  // R1: only a built headframe ends the hint – opening its panel and closing it without building used to end it for
  // good, and the mine stayed shut with no hint left (guided-player audit, docs/release-r1/GAMEPLAY_AUDIT.md). While the
  // panel is open the hint waits anyway (ftueHint returns nothing over an open panel).
  headframe: () => undergroundOpen(0),
  elevator: () => (!ftueReplay && isAutomated('elevator', 0)) || openSheetIndex === 'dc:elevator',
  back: () => false,
  refinery: () => industryLevel('refinery', 0) > 0 || openSheetIndex === 'refinery'
};
// when a discovery is relevant right now
const FTUE_WHEN = {
  chain: () => ftueOrion() && ftueChainRuns() && currentScreen() === 'home' && !ftueInMine(),
  mine: () => ftueOrion() && currentScreen() === 'home' && !ftueInMine() && (undergroundOpen(0) || canOpenUnderground(0)),
  headframe: () => ftueOrion() && ftueInMine() && !undergroundOpen(0) && canOpenUnderground(0),
  elevator: () => ftueOrion() && ftueInMine() && undergroundOpen(0),
  back: () => ftueOrion() && ftueInMine() && ftueSawElevator && ftueSeen().elevator,
  refinery: () => ftueOrion() && currentScreen() === 'home' && !ftueInMine() && industryUnlocked('refinery', 0) && industryLevel('refinery', 0) === 0
};
// once per load: an older save (or a player far ahead) never gets bubbles for what it already did
function ftueCheckOnce() {
  if (ftueChecked) return;
  ftueChecked = true;
  const seen = ftueSeen();
  // an existing player (a save far along when it loads) is never walked through what was already there: everything that
  // is relevant at load counts as known; only what becomes relevant later in play gets its bubble (PR #16's rule)
  if (onboardingProgressedFar(state)) for (const id of ONBOARDING_DISCOVERIES) if (FTUE_WHEN[id]()) seen[id] = true;
  if (ftueChainRuns()) seen.chain = true;
  // a save that loads with the mine already open knows the way there
  if (undergroundOpen(0)) seen.mine = seen.headframe = true;
  if (undergroundOpen(0) && ftueShafts() > 1) Object.assign(seen, { mine: true, elevator: true, back: true });
  if (isAutomated('elevator', 0)) seen.elevator = seen.back = true;
  if (industryLevel('refinery', 0) > 0) seen.refinery = true;
}

// the headframe's build site in the mine scene (before the mine is open), or null
function ftueMineOpenRect() {
  const scene = typeof mineScene === 'function' ? mineScene() : null,
    canvas = document.querySelector('canvas.scene-mine');
  if (!scene?.hitAreas || !canvas) return null;
  const c = onboardingVisible(canvas),
    h = scene.hitAreas().find(a => a.type === 'open' || (a.type === 'frontier' && a.key === 'open'));
  if (!h || !c) return null;
  return { left: c.left + h.x0, top: c.top + h.y0, right: c.left + h.x1, bottom: c.top + Math.min(h.y1, h.y0 + 180), width: h.x1 - h.x0, height: Math.min(h.y1, h.y0 + 180) - h.y0 };
}
// the screen rect of a tap area in the colony scene (world → screen), or null when it is not in view
function ftueColonyRect(type, key) {
  const scene = window.NebulaScenesRuntime?.mounted?.colony?.scene,
    canvas = document.querySelector('canvas.scene-colony');
  if (!scene?.hitAreas || !canvas) return null;
  const c = onboardingVisible(canvas),
    area = h => (h.x1 - h.x0) * (h.y1 - h.y0),
    hit = scene.hitAreas().filter(h => h.type === type && String(h.key) === String(key)).sort((a, b) => area(b) - area(a))[0];
  if (!hit || !c) return null;
  const x0 = Math.max(c.left + 4, c.left + hit.x0 - scene.camera.x),
    x1 = Math.min(c.right - 4, c.left + hit.x1 - scene.camera.x);
  if (x1 - x0 < 30) return null;
  return { left: x0, top: c.top + hit.y0, right: x1, bottom: c.top + hit.y1, width: x1 - x0, height: hit.y1 - hit.y0 };
}
// the elevator in the mine scene (its tap areas are in canvas coordinates already)
function ftueMineRect() {
  const scene = typeof mineScene === 'function' ? mineScene() : null,
    canvas = document.querySelector('canvas.scene-mine');
  if (!scene?.hitAreas || !canvas) return null;
  const c = onboardingVisible(canvas),
    hits = scene.hitAreas().filter(h => h.type === 'elevator');
  if (!hits.length || !c) return null;
  const x0 = Math.min(...hits.map(h => h.x0)),
    x1 = Math.max(...hits.map(h => h.x1)),
    y0 = Math.min(...hits.map(h => h.y0)),
    y1 = Math.min(Math.max(...hits.map(h => h.y1)), y0 + 160);
  return { left: c.left + x0, top: c.top + y0, right: c.left + x1, bottom: c.top + y1, width: x1 - x0, height: y1 - y0 };
}

// the discovery to show now: { step: 'd:<id>', kicker, title, text, target, button? } or null
function ftueHint() {
  const o = onboardingState();
  if (!o.done || o.hidden) return null;
  ftueCheckOnce();
  const seen = ftueSeen();
  // mark what the player did on their own (also while a panel is open: opening the elevator's panel is the answer)
  for (const id of ONBOARDING_DISCOVERIES) if (!seen[id] && FTUE_DONE[id]()) ftueSee(id);
  if (topModal() || document.body.classList.contains('home-sheet-open')) return null;
  const panel = $('buildingSheet');
  if (panel && !panel.classList.contains('hidden')) return null;
  // leaving the mine ends the "back" hint for good (the player found the way)
  if (ftueShown === 'back' && !ftueInMine()) ftueSee('back');
  // an informational hint ends by itself; until then it stays (the chain's moment counts as seen from its first frame)
  const showing = ftueShown && FTUE_SHOW_FOR[ftueShown] && Date.now() - ftueShownAt <= FTUE_SHOW_FOR[ftueShown] * 1000 && !ftueClosed;
  if (ftueShown && FTUE_SHOW_FOR[ftueShown] && !showing) ftueSee(ftueShown);
  const id = ftueShown && (showing || !seen[ftueShown]) && FTUE_WHEN[ftueShown]() ? ftueShown : ONBOARDING_DISCOVERIES.find(d => !seen[d] && FTUE_WHEN[d]());
  if (!id) return (ftueShown = null);
  if (ftueShown !== id) {
    ftueShown = id;
    ftueShownAt = Date.now();
    ftueClosed = false;
    if (id === 'chain') ftueSee('chain'); // a moment: it counts as seen as soon as it shows
    // the refinery is somewhere else in the colony: the camera glides there first
    if (id === 'refinery') window.NebulaScenesRuntime?.mounted?.colony?.scene?.focusStation?.('refinery');
  }
  const [kicker, title, text] = FTUE_TEXT[id];
  const hint = { step: 'd:' + id, kicker, title, text };
  if (id === 'mine') {
    const nav = $('navMine');
    hint.target = nav && !nav.hidden && nav.getClientRects().length ? nav : $('mineToggle');
  } else if (id === 'headframe') {
    ftueSawElevator = true; // after building it the game opens the elevator's panel itself; the way back follows
    hint.target = ftueMineOpenRect();
    hint.button = { label: 'Förderturm bauen', action: 'ftue-headframe' };
  } else if (id === 'elevator') {
    ftueSawElevator = true;
    hint.target = ftueMineRect();
  }
  else if (id === 'back') hint.target = document.querySelector('.bottom-nav [data-screen="home"]');
  else if (id === 'refinery') {
    hint.target = ftueColonyRect('building', 'refinery');
    hint.button = { label: 'Raffinerie öffnen', action: 'ftue-refinery' };
  }
  return hint;
}

// the first steps' hint selection and rendering stay as they are; after them, the discoveries use the same coach
const onboardingHintBeforeFtue = onboardingHint;
onboardingHint = () => (onboardingStep() ? onboardingHintBeforeFtue() : ftueHint());
const renderOnboardingBeforeFtue = renderOnboarding;
renderOnboarding = () => {
  renderOnboardingBeforeFtue();
  if (onboardingStep()) return;
  const coach = $('coach'),
    hint = ftueHint();
  if (!coach) return;
  if (!hint) {
    if (coach.dataset.step?.startsWith('d:')) coach.classList.add('hidden');
    return;
  }
  const key = hint.step + '|' + hint.title + '|' + hint.text;
  if (key !== onboardingLastKey || coach.classList.contains('hidden')) {
    onboardingLastKey = key;
    $('coachKicker').textContent = hint.kicker;
    $('coachTitle').textContent = hint.title;
    $('coachText').textContent = hint.text;
    $('coachText').hidden = !hint.text;
    const face = kitPortraitURL('mochi', hint.step === 'd:chain' ? 'happy' : 'neutral', 96);
    $('coachFace').innerHTML = face ? `<img src="${face}" alt="" />` : '🐾';
  }
  const action = $('coachAction');
  action.classList.toggle('hidden', !hint.button);
  if (hint.button) {
    action.textContent = hint.button.label;
    action.dataset.coachAction = hint.button.action;
  }
  $('coachClose').hidden = false;
  $('coachClose').setAttribute('aria-label', 'Diesen Hinweis schließen');
  coach.dataset.step = hint.step;
  coach.classList.remove('hidden');
  onboardingPlace(hint);
  if (!onboardingRaf && typeof requestAnimationFrame === 'function') onboardingRaf = requestAnimationFrame(onboardingLoop);
};
// × on a discovery closes only that one (the first steps' × silences all hints, as before)
document.addEventListener(
  'click',
  event => {
    const close = event.target.closest('#coachClose'),
      coach = $('coach');
    if (close && coach?.dataset.step?.startsWith('d:')) {
      event.stopImmediatePropagation();
      ftueClosed = true;
      ftueSee(coach.dataset.step.slice(2));
      ftueShown = null;
      coach.classList.add('hidden');
      render();
      return;
    }
    if (event.target.closest('#coachAction')?.dataset.coachAction === 'ftue-headframe') {
      event.stopImmediatePropagation();
      // R1: the hint ends when the headframe is built (FTUE_DONE.headframe), not when its panel opens
      openBuildingSheet('dc:open');
      render();
      return;
    }
    if (event.target.closest('#coachAction')?.dataset.coachAction === 'ftue-refinery') {
      event.stopImmediatePropagation();
      ftueSee('refinery');
      window.NebulaScenesRuntime?.mounted?.colony?.scene?.focusStation?.('refinery');
      openBuildingSheet('refinery');
      render();
    }
  },
  true
);

// Hilfe: the discoveries can be shown again (only the ones that are relevant now appear; nothing is paid)
const renderHelpBeforeFtue = renderHelp;
renderHelp = () => {
  renderHelpBeforeFtue();
  const body = $('helpBody');
  if (!body || !onboardingState().done || body.querySelector('[data-ftue-replay]')) return;
  body.querySelector('.help-note')?.insertAdjacentHTML(
    'afterend',
    `<button class="help-toggle" data-ftue-replay>Einführungs-Hinweise erneut zeigen</button>${onboardingState().hidden ? '<button class="help-toggle" data-help-hints="on">Hinweise wieder einblenden</button>' : '<button class="help-toggle" data-help-hints="off">Hinweise ausblenden</button>'}`
  );
};
document.addEventListener('click', event => {
  if (!event.target.closest('[data-ftue-replay]')) return;
  const o = onboardingState();
  o.seen = {};
  o.hidden = false;
  ftueShown = null;
  ftueChecked = true;
  ftueReplay = true;
  onboardingLastKey = '';
  toast('Die Einführungs-Hinweise erscheinen wieder, sobald sie passen.');
  renderHelp();
  render();
});

// ----- progressive disclosure on the next-step card -----
// After the chain runs by itself, the card used to send a new player straight to the investment (Förderbasis) and the
// planet specialization – two of the game's more complex systems, a few minutes into the game. A young Orion colony is
// first led through tangible building steps that open the next part of the chain: the Frachtdock (bigger sales and the
// story's next visitor), the Lagerhaus to Lv 5 (frees the Raffinerie), the Raffinerie itself. Only what the card SAYS
// changes (like the first-credits goal in mobile-ux.js): prices, unlocks and the planning panel stay as they were and
// can be opened any time in Details. From FTUE_PLANNING_EARNED earned (or after a prestige) the card is unchanged.
const FTUE_PLANNING_EARNED = 50000;
const FTUE_LATER_GOALS = ['Förderbasis ausbauen', 'Planetenrolle wählen'];
function ftueEarlyGoal() {
  if (state.activePlanet !== 0 || state.galaxiesSold > 0 || state.totalEarned >= FTUE_PLANNING_EARNED) return null;
  if (!FTUE_LATER_GOALS.includes($('objectiveTitle')?.textContent)) return null;
  if ((state.buildings[3]?.level || 0) < 1) return ['🚀', 'Frachtdock bauen', 'Frachter verkaufen ganze Ladungen auf einmal – und bringen Besuch von weit her.', 'HAFEN ›', 3];
  if ((state.buildings[2]?.level || 0) < 5) return ['◫', 'Lagerhaus ausbauen · Lv ' + state.buildings[2].level + '/5', 'Ab Stufe 5 wird die Raffinerie frei.', 'LAGER ›', 2];
  if (industryUnlocked('refinery', 0) && industryLevel('refinery', 0) === 0) return ['⚙', 'Raffinerie bauen', 'Sie macht aus Rohkristallen wertvollere Barren.', 'RAFFINERIE ›', 'refinery'];
  return null;
}
const renderObjectiveBeforeFtue = renderObjective;
renderObjective = function () {
  renderObjectiveBeforeFtue();
  const goal = ftueEarlyGoal();
  if (!goal) return;
  $('objectiveIcon').textContent = goal[0];
  $('objectiveTitle').textContent = goal[1];
  $('objectiveText').textContent = goal[2];
  $('objectiveAction').textContent = goal[3];
  const card = $('objectiveCard');
  card.dataset.screen = 'home';
  card.dataset.sheet = String(goal[4]);
};
