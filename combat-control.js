// P1.5 — combat control on the game side. The arena's rules live in arena.js (ARENA_AIM_LEVELS, arenaControlOf); here:
//   combatSettings  what the player switched on (meta.combat: autoFire, autoAim, autoFly) – a save from before P1.5
//                   that has played keeps every automation it had (legacy, Bestandsschutz); a new save starts manual
//   combatUnlocks   what the player has earned by playing (no currency, no real money): the steps of COMBAT_STEPS
//   arenaControl    the control one fight gets (set at every start: a wave, a guardian, a Revanche)
//   the FEUER button (when Auto-Fire is off), the control row in the fight, the "Steuerung" section in the prep
// Auto-Fire, Auto-Aim and Auto-Fly stay separate: Auto-Fire never turns a gun, Auto-Aim never moves the ship.
// Loaded after gear-loop.js.

// the automation steps in the order a new player earns them (the prep lists them with what opens them)
const COMBAT_STEPS = [
  { id: 'lane', group: 'fly', name: 'Kurs halten', text: 'Das Schiff folgt der Bahn seines Ziels', when: 'Orion: Welle 2 geschafft', done: () => campaignCleared('crystal') >= 2 },
  { id: 'aim1', group: 'aim', name: 'Zielhilfe 1', text: 'Die Kanonen drehen bis ±10° zum nächsten Gegner', when: 'Orion: Welle 4 geschafft', done: () => campaignCleared('crystal') >= 4 },
  { id: 'zones', group: 'fly', name: 'Wächter lesen', text: 'Das Schiff fliegt bei Wächter-Angriffen zur sicheren Stelle', when: 'Orion: alle 9 Wellen', done: () => campaignCleared('crystal') >= 9 },
  { id: 'aim2', group: 'aim', name: 'Zielhilfe 2', text: 'Bis ±20°, zielt vor bewegte Gegner, beachtet dein Fokusziel', when: 'P.I.P.S. besiegt', done: () => ['defeated', 'repaired'].includes(state.meta.guardians?.pips?.stage) },
  { id: 'dodge', group: 'fly', name: 'Ausweichen', text: 'Ein Reflex weg von Schüssen, die gleich treffen', when: 'Forschung „Ausweich-Assistent“', done: () => typeof techHas === 'function' && techHas('dodgeAssist') },
  { id: 'aim3', group: 'aim', name: 'Zielhilfe 3', text: 'Freie Zielerfassung über das ganze Feld', when: 'Frostbyte besiegt', done: () => ['defeated', 'repaired'].includes(state.meta.guardians?.frostbyte?.stage) }
];
function combatSettings() {
  const m = state.meta;
  if (!m.combat || typeof m.combat !== 'object' || Array.isArray(m.combat)) {
    // a save loaded at this boot (game.js loadedSave) is from before P1.5: it keeps what it had; no save = a new player
    const played = (typeof loadedSave !== 'undefined' && Boolean(loadedSave)) || (state.galaxiesSold || 0) > 0 || (typeof campaignCleared === 'function' && campaignCleared('crystal') > 0);
    m.combat = { autoFire: true, autoAim: true, autoFly: true, legacy: played, tutorial: played ? 'done' : '' };
  }
  const c = m.combat;
  for (const k of ['autoFire', 'autoAim', 'autoFly']) c[k] = c[k] !== false;
  c.legacy = c.legacy === true;
  c.tutorial = typeof c.tutorial === 'string' ? c.tutorial.slice(0, 24) : '';
  return c;
}
// what has been earned: the Auto-Aim level (0–3) and the Auto-Fly parts (lane, dodge, zones)
function combatUnlocks() {
  const legacy = combatSettings().legacy,
    has = id => (id === 'dodge' ? COMBAT_STEPS.find(s => s.id === 'dodge').done() : legacy || COMBAT_STEPS.find(s => s.id === id).done());
  return { aim: has('aim3') ? 3 : has('aim2') ? 2 : has('aim1') ? 1 : 0, lane: has('lane'), zones: has('zones'), dodge: has('dodge'), legacy };
}
function arenaControl() {
  const s = combatSettings(),
    u = combatUnlocks();
  return { fire: s.autoFire ? 'auto' : 'hold', aim: s.autoAim ? u.aim : 0, fly: s.autoFly ? { lane: u.lane, dodge: u.dodge, zones: u.zones } : { lane: false, dodge: false, zones: false } };
}
// every fight start gets the player's control (the arena's default stays the full one for headless fights)
const combatControlWrap = fn =>
  function (...args) {
    const ok = fn.apply(this, args);
    if (ok && arenaRun) arenaRun.control = arenaControl();
    return ok;
  };
arenaBegin = combatControlWrap(arenaBegin);
arenaBeginBoss = combatControlWrap(arenaBeginBoss);
if (typeof rematchBegin === 'function') rematchBegin = combatControlWrap(rematchBegin);
combatSettings();

// ----- in the fight: the control row and the FEUER button -----
function combatAimText(c) {
  return c.aim ? '🎯 Zielhilfe ' + c.aim : '🎯 Geradeaus';
}
const renderExpeditionHudBeforeControl = renderExpeditionHud;
renderExpeditionHud = () => {
  renderExpeditionHudBeforeControl();
  const a = arenaRun,
    top = $('expTop'),
    bottom = $('expBottom');
  if (!a || a.result) return;
  const c = arenaControlOf(a);
  // no extra row (the field keeps its height on a small phone): the Auto-Fire switch sits beside the pause button, the
  // aim mode in the status line
  if (top) {
    const pause = top.querySelector('[data-exp-pause]');
    let btn = top.querySelector('[data-combat-fire]');
    if (btn && btn.dataset.fire !== c.fire) {
      btn.remove();
      btn = null;
    }
    if (!btn && pause)
      pause.insertAdjacentHTML(
        'beforebegin',
        `<button class="exp-fire-toggle ${c.fire === 'auto' ? 'on' : ''}" data-combat-fire data-fire="${c.fire}" aria-label="${c.fire === 'auto' ? 'Auto-Fire an – tippen: selbst feuern' : 'Du feuerst selbst – tippen: Auto-Fire'}"><i aria-hidden="true">🔫</i><small>${c.fire === 'auto' ? 'AUTO' : 'HAND'}</small></button>`
      );
    const phase = top.querySelector('.exp-phase');
    let aim = phase?.querySelector('.exp-aim');
    if (phase && aim && aim.dataset.aim !== String(c.aim)) {
      aim.remove();
      aim = null;
    }
    if (phase && !aim) phase.insertAdjacentHTML('beforeend', `<span class="exp-aim" data-aim="${c.aim}"> · ${combatAimText(c)}</span>`);
  }
  // the FEUER button sits with the abilities (the other thumb steers anywhere on the field)
  const dock = bottom?.querySelector('.exp-abilities');
  dock?.classList.toggle('with-fire', c.fire === 'hold');
  if (dock && c.fire === 'hold' && !dock.querySelector('[data-arena-fire]'))
    dock.insertAdjacentHTML('afterbegin', `<button class="exp-ability exp-fire ${a.trigger ? 'on' : ''}" data-arena-fire aria-label="Feuer – halten zum Schießen"><i aria-hidden="true">🔫</i><b>FEUER</b><small>halten</small></button>`);
};
// hold to fire: pressed on the button, released anywhere (also when the HUD redraws the button under the finger)
document.addEventListener('pointerdown', event => {
  if (!event.target.closest?.('[data-arena-fire]') || !arenaRun) return;
  event.preventDefault();
  arenaTrigger(arenaRun, true);
  event.target.closest('[data-arena-fire]').classList.add('on');
});
const combatRelease = () => {
  if (arenaRun?.trigger) arenaTrigger(arenaRun, false);
  document.querySelector('[data-arena-fire]')?.classList.remove('on');
};
document.addEventListener('pointerup', combatRelease);
document.addEventListener('pointercancel', combatRelease);
// on a keyboard the space bar is the trigger
document.addEventListener('keydown', event => {
  if (event.code !== 'Space' || !arenaRun || arenaControlOf(arenaRun).fire !== 'hold' || event.repeat) return;
  event.preventDefault();
  arenaTrigger(arenaRun, true);
});
document.addEventListener('keyup', event => {
  if (event.code === 'Space') combatRelease();
});
document.addEventListener('click', event => {
  if (event.target.closest('[data-combat-fire]') && arenaRun && !arenaRun.result) {
    // switched in the fight: the setting and this fight follow
    const s = combatSettings();
    s.autoFire = !s.autoFire;
    arenaRun.control = { ...arenaControlOf(arenaRun), fire: s.autoFire ? 'auto' : 'hold' };
    arenaTrigger(arenaRun, false);
    requestSave(300);
    feedback('open', 'light');
    return renderExpeditionHud();
  }
  const toggle = event.target.closest('[data-combat-toggle]');
  if (toggle) {
    const s = combatSettings(),
      key = toggle.dataset.combatToggle;
    if (!['autoFire', 'autoAim', 'autoFly'].includes(key)) return;
    s[key] = !s[key];
    requestSave(300);
    feedback('open', 'light');
    renderExpeditionPrep();
  }
});

// ----- in the prep: the "Steuerung" section (what is on, what is earned, what comes next) -----
function combatControlHTML() {
  const s = combatSettings(),
    u = combatUnlocks(),
    flyParts = ['lane', 'zones', 'dodge'].filter(k => u[k]),
    sw = (key, label, state2, detail, locked) =>
      `<button class="exp-switch ${state2 ? 'on' : ''}" data-combat-toggle="${key}" ${locked ? 'disabled' : ''} aria-pressed="${state2}"><b>${label}</b><small>${detail}</small><i aria-hidden="true">${locked ? '🔒' : state2 ? 'AN' : 'AUS'}</i></button>`;
  const next = COMBAT_STEPS.filter(step => !(step.id === 'dodge' ? u.dodge : u.legacy || step.done())).slice(0, 2);
  return `<section class="exp-block exp-control"><h3>Steuerung</h3><p class="exp-note">Du fliegst, indem du irgendwo auf dem Feld wischst. Die Kanonen schießen geradeaus – bring Gegner vor den Bug.${u.aim ? ' Die Zielhilfe dreht sie ein Stück mit.' : ''}</p>${sw('autoFire', 'Auto-Fire', s.autoFire, s.autoFire ? 'Feuert von selbst, geradeaus' : 'Du hältst FEUER', false)}${sw(
    'autoAim',
    'Auto-Aim',
    s.autoAim && u.aim > 0,
    u.aim ? 'Zielhilfe Stufe ' + u.aim + ' von 3' : 'Noch gesperrt',
    u.aim === 0
  )}${sw('autoFly', 'Auto-Fly', s.autoFly && flyParts.length > 0, flyParts.length ? flyParts.map(k => COMBAT_STEPS.find(x => x.id === k).name).join(' · ') : 'Noch gesperrt', flyParts.length === 0)}${
    next.length ? `<ul class="exp-next-steps">${next.map(step => `<li><b>${step.name}</b><small>${step.text} – ab: ${step.when}</small></li>`).join('')}</ul>` : ''
  }</section>`;
}
const renderExpeditionPrepBeforeControl = renderExpeditionPrep;
renderExpeditionPrep = () => {
  renderExpeditionPrepBeforeControl();
  const scroll = $('expPrep')?.querySelector('.exp-scroll');
  if (!scroll) return;
  // the prep may keep its body between renders: the section is replaced, so a switch shows at once
  const old = scroll.querySelector('.exp-control');
  if (old) old.outerHTML = combatControlHTML();
  else scroll.insertAdjacentHTML('afterbegin', combatControlHTML());
};
