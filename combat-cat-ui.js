// Combat crew UI (Beta 1.1): routes Tikki's strikes through the normal battle routing, wraps real ship shots for her
// support effects and the Splitterladung burst, runs the automatic strikes and the Funkenhagel volley, and renders the
// dock button. Loaded after arsenal-ui.js (so it wraps the battle button outermost). Logic: combat-cat.js.

Object.assign(STORY, {
  'tikki-glider': {
    title: 'Tikkis Funkengleiter',
    lines: [
      ['tikki', 'Aus den Ersatzteilen von P.I.P.S. habe ich mir einen kleinen Gleiter gebaut. Ich fliege ab jetzt neben dem Schiff mit!'],
      ['mochi', 'Du kämpfst mit? Tikki, das ist großartig!'],
      ['tikki', 'Ich feuere von allein Funkenbolzen. Und wenn du FUNKENHAGEL drückst, gibt es eine ganze Salve.']
    ]
  }
});

// ----- one extension point: a strike resolved through the normal battle routing -----
// The strike is never aimed and never overcharged; the player's Aim, Overcharge and combo are restored afterwards.
let catStrikeSource = null; // read by the combat scene while the strike's 'attack' event is emitted
function combatStrike(source, damage) {
  if (!(damage > 0) || !state.meta?.combatCat) return false;
  const saved = { aim: state.aimReady, overcharge: state.overchargeUntil, combo: state.combo, comboAt: state.comboAt };
  state.aimReady = false;
  state.overchargeUntil = 0;
  strikeOverride = { source, damage };
  catStrikeSource = source;
  try {
    $('battleButton').onclick({ isTrusted: false, catStrike: true, source });
  } finally {
    strikeOverride = null;
    catStrikeSource = null;
    state.aimReady = saved.aim;
    state.overchargeUntil = saved.overcharge;
    state.combo = saved.combo;
    state.comboAt = saved.comboAt;
  }
  return true;
}
function catStrike(kind = 'auto') {
  if (!catUnlocked()) return false;
  const done = combatStrike(kind === 'ability' ? 'cat-ability' : 'cat', catStrikeDamage(kind));
  if (done) {
    combatCat().strikes += 1;
    catOnStrike(Date.now());
  }
  return done;
}

// ----- real ship shots: Tikki's support factor + the Splitterladung burst -----
const battleClickBeforeCombatCat = $('battleButton').onclick;
$('battleButton').onclick = e => {
  if (e?.catStrike) return battleClickBeforeCombatCat(e);
  const now = Date.now();
  activeShotFactor = shipShotEffectFactor(now);
  let shot = 0;
  try {
    shot = attack(); // what this shot is worth before the fight's own phase factor (for the burst share)
    battleClickBeforeCombatCat(e);
  } finally {
    activeShotFactor = 1;
  }
  const burst = shipShotResolved(now);
  if (burst > 0) combatStrike('burst', shot * burst);
};

// ----- automatic strikes and the Funkenhagel volley -----
let catNextStrikeAt = 0;
const catVolley = { left: 0, nextAt: 0 };
function catInFight() {
  // a paused Feldzug wave (player elsewhere) waits for the player — Tikki does not fight it alone
  if (typeof arenaActive === 'function' && arenaActive()) return false; // in the arena Tikki flies with the ship (arena.js)
  return catUnlocked() && !document.hidden && (currentScreen() === 'battle' || (state.autoBattle && !campaignRunning()));
}
function catTick(now = Date.now()) {
  if (!catInFight()) {
    catNextStrikeAt = Math.max(catNextStrikeAt, now + 1000); // no burst of strikes when the fight is opened again
    return;
  }
  if (catVolley.left > 0) {
    // during the volley only the volley fires; the automatic bolt waits until it is over (no extra strike)
    if (now >= catVolley.nextAt) {
      catVolley.left -= 1;
      catVolley.nextAt = now + TIKKI.abilityGapMs;
      catNextStrikeAt = Math.max(catNextStrikeAt, now + TIKKI.strikeEveryMs);
      catStrike('ability');
      render();
    }
  } else if (now >= catNextStrikeAt) {
    catNextStrikeAt = now + TIKKI.strikeEveryMs;
    catStrike('auto');
    render();
  }
  updateCatButton(now);
}
// renders from Tikki's bolts are folded into one per animation frame (frame-pacing.js)
setInterval(() => (typeof withDeferredRender === 'function' ? withDeferredRender(() => catTick(Date.now())) : catTick(Date.now())), 200);
// Funkenhagel: a volley of five bolts, then the cooldown (saved — a reload cannot reset it)
function catAbility(now = Date.now()) {
  if (!catUnlocked() || catAbilityLeftMs(now) > 0 || catVolley.left > 0) return false;
  combatCat().abilityReadyAt = now + catAbilityCooldownMs();
  combatCat().volleys += 1;
  catVolley.left = TIKKI.abilityStrikes;
  catVolley.nextAt = now;
  GameEvents.emit('cat-ability', { strikes: TIKKI.abilityStrikes });
  feedback('overcharge', 'medium');
  save();
  catTick(now);
  return true;
}

// ----- dock button (4th action; hidden until Tikki has joined) -----
function updateCatButton(now = Date.now()) {
  const button = $('catButton');
  if (!button) return;
  const on = catUnlocked();
  button.hidden = !on;
  document.body.classList.toggle('cat-active', on);
  if (!on) return;
  const left = catAbilityLeftMs(now),
    total = catAbilityCooldownMs(),
    firing = catVolley.left > 0,
    label = firing ? 'Salve!' : left > 0 ? Math.ceil(left / 1000) + ' s' : 'Bereit';
  button.style.setProperty('--cd', left > 0 ? (left / total).toFixed(3) : '0');
  button.classList.toggle('ready', left <= 0 && !firing);
  button.disabled = left > 0 || firing;
  const face = button.querySelector('i');
  if (face && !face.dataset.portrait && window.SpaceKittens?.portraitURL) {
    const url = window.SpaceKittens.portraitURL(6, 'happy', 64);
    if (url) face.style.backgroundImage = 'url(' + url + ')';
    face.dataset.portrait = '1';
  }
  const small = button.querySelector('small');
  if (small && small.textContent !== label) small.textContent = label;
  button.setAttribute('aria-label', 'Funkenhagel: ' + (left > 0 ? 'lädt, ' + label : firing ? 'feuert' : 'bereit'));
}
$('catButton')?.addEventListener('click', () => catAbility());

// ----- combat view: Tikki's glider, mark and charge for the scene -----
const combatViewBeforeCat = window.NebulaView.combat;
window.NebulaView.combat = () => {
  const view = combatViewBeforeCat(),
    now = Date.now();
  if (!catUnlocked()) return view;
  return {
    ...view,
    cat: {
      lastStrikeAt: catFx.lastStrikeAt,
      firing: catVolley.left > 0,
      ready: catAbilityLeftMs(now) <= 0,
      marked: catMarked(now),
      charged: catCharged(now),
      lastBurstAt: catFx.lastBurstAt
    }
  };
};

// ----- unlock (render hook) -----
const renderBeforeCombatCat = render;
render = () => {
  if (catSyncUnlock()) {
    storyEvent('tikki-glider');
    toast('Tikki fliegt jetzt mit! Funkenhagel im Abenteuer-Tab.');
    save();
  }
  renderBeforeCombatCat();
  updateCatButton();
};
