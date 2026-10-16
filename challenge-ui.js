// Beta 1.2 — Sektorprüfungen UI: routing of every hit while a challenge runs, the challenge card in the Abenteuer tab,
// the live dock above ANGREIFEN, the result notice and the combat-scene view. Logic: challenge.js.
// Loaded after arsenal-ui.js and before combat-cat-ui.js (Tikki's outermost wrapper keeps working unchanged).

// ----- routing: while a challenge runs, ship shots, auto-battle, Tikki and bursts hit the Prüfdrohne -----
const battleClickBeforeChallenge = $('battleButton').onclick;
$('battleButton').onclick = e => {
  const active = state.meta?.challenges?.active;
  if (!active) return battleClickBeforeChallenge(e);
  const now = Date.now();
  if (challengeFinish(now)) return;
  if (e?.isTrusted) {
    state.combo = now - (state.comboAt || 0) <= 1200 ? Math.min(10, (state.combo || 0) + 1) : 1;
    state.comboAt = now;
  } else if (!e?.catStrike) state.combo = 0;
  const source = e?.catStrike ? (catStrikeSource === 'cat-ability' ? 'cat-ability' : catStrikeSource === 'burst' ? 'burst' : 'cat') : 'ship',
    aimed = state.aimReady,
    overcharged = now < state.overchargeUntil,
    factor = challengeFactor(active, source, { aimed, overcharged }, now),
    damage = challengeHit(attack() * factor);
  feedback(factor < 0.6 ? 'deny' : 'hit', e?.isTrusted ? 'light' : null);
  GameEvents.emit('attack', { damage, weapon: state.ship.weaponType, aimed, overcharge: overcharged, auto: !e?.isTrusted, boss: true, killed: active.maxHp > 0 && active.hp <= 0, level: 'challenge', shielded: factor < 1 });
  if (!challengeFinish(Date.now())) updateChallengePlate();
};

// ----- finishing: one result, saved before it is shown -----
let challengeNotice = null;
function challengeFinish(now = Date.now(), opts) {
  const result = challengeResolve(now, opts);
  if (!result) return false;
  save();
  challengeNotice = result;
  const c = CHALLENGE_BY_ID[result.id];
  if (result.tier) {
    feedback('unlock', 'success');
    window.NebulaAudio?.play('meow');
    GameEvents.emit('challenge-complete', { id: result.id, tier: result.tier });
  } else feedback('deny', 'warning');
  toast(
    result.tier
      ? c.name + ': ' + CHALLENGE_TIER_NAME[result.tier] + '!' + (result.chests ? ' · ' + result.chests + (result.chests === 1 ? ' Kiste' : ' Kisten') + ' im Arsenal' : result.splitters ? ' · +' + result.splitters + ' ✦' : ' · Belohnung wieder in ' + Math.ceil(challengeRepeatLeftMs(result.id, now) / 60000) + ' min')
      : opts?.abort
        ? c.name + ' abgebrochen'
        : c.name + ': nicht bestanden – probier eine andere Ausrüstung'
  );
  render();
  return true;
}

// ----- view model for the combat scene -----
const combatViewBeforeChallenge = window.NebulaView.combat;
window.NebulaView.combat = () => {
  const view = combatViewBeforeChallenge(),
    active = state.meta?.challenges?.active;
  if (!active) return view;
  const now = Date.now(),
    phase = challengePhase(active, now),
    c = CHALLENGE_BY_ID[active.id];
  return {
    ...view,
    enemyHp: active.maxHp ? active.hp : Math.max(0, c.score.gold * active.base - active.damage),
    enemyMax: active.maxHp || c.score.gold * active.base,
    boss: false,
    story: { mode: 'challenge', kind: active.id, phase: phase.name, left: phase.left, telegraph: phase.name === 'window' || phase.name === 'overload' }
  };
};

// ----- card in the Abenteuer tab -----
function challengeRewardText(c) {
  const ch = challenges(),
    next = CHALLENGE_TIERS.filter(t => !ch.claims.includes('challenge:' + c.id + ':' + t));
  const chests = next.length ? 'Erstmals: ' + next.map(t => CHALLENGE_TIER_NAME[t] + ' → ' + ARSENAL_CHESTS[CHALLENGE_TIER_CHEST[t]].name).join(', ') : 'Alle Kisten erhalten';
  const left = challengeRepeatLeftMs(c.id);
  return chests + ' · Wiederholung: ' + CHALLENGE_REPEAT_SPLITTERS.bronze + '–' + CHALLENGE_REPEAT_SPLITTERS.gold + ' ✦' + (left ? ' (wieder in ' + Math.ceil(left / 60000) + ' min)' : ' alle 20 min');
}
function challengeGoalText(c) {
  if (c.score) return 'Bronze ' + c.score.bronze + ' · Silber ' + c.score.silver + ' · Gold ' + c.score.gold + ' Grundschüsse in 60 s';
  return 'Zeit ' + c.durationMs / 1000 + ' s · Silber unter ' + Math.round((c.durationMs * c.silver) / 1000) + ' s · Gold unter ' + Math.round((c.durationMs * c.gold) / 1000) + ' s';
}
function renderChallengeCard() {
  const card = $('challengeCard');
  if (!card || !state.meta?.challenges) return;
  if (!challengesUnlocked()) {
    card.hidden = !catUnlocked();
    if (catUnlocked()) setHTML(card, `<div class="challenge-head"><div><span>STERNWARTE · OPTIONAL</span><h2>Sektorprüfungen</h2></div></div><p class="arsenal-note">🔒 Die Sternwarte öffnet ihre Prüfdrohnen, sobald Frostbyte repariert ist.</p>`);
    return;
  }
  card.hidden = false;
  const ch = challenges(),
    blocked = challengeGuardianFight();
  const rows = CHALLENGES.map(c => {
    const best = ch.best[c.id],
      running = ch.active?.id === c.id;
    return `<article class="challenge-row${best ? ' tier-' + best : ''}"><i aria-hidden="true">${c.icon}</i><div><b>${c.name}${best ? ` <em class="challenge-medal ${best}">${CHALLENGE_TIER_NAME[best]}</em>` : ''}</b><small>${c.text}</small><small class="challenge-goal">${challengeGoalText(c)}</small><small class="challenge-reward">${challengeRewardText(c)}</small></div><button data-challenge-start="${c.id}" ${ch.active || blocked ? 'disabled' : ''}>${running ? 'LÄUFT' : 'STARTEN'}</button></article>`;
  }).join('');
  setHTML(
    card,
    `<div class="challenge-head"><div><span>STERNWARTE · OPTIONAL</span><h2>Sektorprüfungen</h2></div>${ch.wins ? `<b>${ch.wins} bestanden</b>` : ""}</div>
    <p class="arsenal-note">Kurze Trainingskämpfe gegen eine Prüfdrohne. Sie passen sich deinem Grundschuss an – hier zählen Bauweise und Timing.${blocked ? ' Gerade läuft ein Wächterkampf.' : ''}</p>${rows}`
  );
}

// ----- live dock above ANGREIFEN + enemy plate -----
function challengeStatusHTML(active, now) {
  const phase = challengePhase(active, now),
    c = CHALLENGE_BY_ID[active.id],
    left = Math.ceil(Math.max(0, active.endsAt - now) / 1000),
    phaseLeft = Math.ceil(phase.left / 1000),
    tier = c.score ? challengeTier(active, now) : null,
    score = c.score ? Math.floor(active.damage / active.base) : 0;
  const line =
    active.id === 'precision'
      ? phase.name === 'window'
        ? `🎯 <b>SCHWACHPUNKT OFFEN · ${phaseLeft} s</b> ×2 Schaden – jetzt treffen!`
        : `🛡 <b>Panzer geschlossen</b> 35 % · öffnet in ${phaseLeft} s`
      : active.id === 'reactor'
        ? phase.name === 'overload'
          ? `☢ <b>ÜBERLADUNG · ${phaseLeft} s</b> Funkenhagel ×3 · Overcharge ×2 · sonst 50 %`
          : `⚛ <b>Reaktor stabil</b> 100 % · Überladung in ${phaseLeft} s`
        : `⏱ <b>DAUERFEUER</b> ${score} Grundschüsse${tier ? ' · ' + CHALLENGE_TIER_NAME[tier] : ''} · nächste Stufe: ${(CHALLENGE_TIERS.map(t => c.score[t]).find(v => v > score) ?? '—')}`;
  return `<p class="tb-status challenge ${phase.name}" role="status">${line} <span class="challenge-time">⏳ ${left} s</span></p><button class="challenge-abort" data-challenge-abort>AUFGEBEN</button>`;
}
function updateChallengeDock() {
  const dock = $('challengeDock'),
    active = state.meta?.challenges?.active,
    on = Boolean(active) && currentScreen() === 'battle';
  document.body.classList.toggle('challenge-active', on);
  if (!dock) return;
  dock.hidden = !on;
  if (on) setHTML(dock, challengeStatusHTML(active, Date.now()));
}
function updateChallengePlate() {
  const active = state.meta?.challenges?.active;
  if (!active || currentScreen() !== 'battle') return;
  const c = CHALLENGE_BY_ID[active.id],
    max = active.maxHp || c.score.gold * active.base,
    hp = active.maxHp ? active.hp : Math.max(0, max - active.damage);
  $('enemyName').textContent = 'Prüfdrohne · ' + c.name;
  $('enemyHealth').style.width = (hp / Math.max(1, max)) * 100 + '%';
  $('enemyHealthText').textContent = active.maxHp ? fmt(hp) + ' / ' + fmt(max) : Math.floor(active.damage / active.base) + ' / ' + c.score.gold + ' Grundschüsse';
  $('battleKicker').textContent = 'STERNWARTE · SEKTORPRÜFUNG';
  $('battleTitle').textContent = c.name;
  $('dropPreview').textContent = challengeRewardText(c);
  // the plate shows the challenge, not the waiting ladder enemy (level, reward, weakness)
  $('enemyRank').textContent = 'PRÜFUNG';
  $('enemyLevel').textContent = CHALLENGES.indexOf(c) + 1 + '/3';
  $('battleReward').textContent = '✦';
  setHTML($('enemyTags'), `<span class="hud-tag">${c.icon} ${c.short}</span>`);
  $('combatHint').textContent = challengeGoalText(c);
  updateChallengeDock();
}
setInterval(() => {
  const active = state.meta?.challenges?.active;
  if (!active) return;
  if (challengeFinish(Date.now())) return;
  if (!document.hidden && currentScreen() === 'battle') updateChallengePlate();
}, 250);

document.addEventListener('click', event => {
  const start = event.target.closest('[data-challenge-start]');
  if (start) {
    const id = start.dataset.challengeStart,
      blocked = challengeStartBlocked(id);
    if (blocked) return toast(blocked);
    challengeStart(id);
    save();
    feedback('unlock', 'light');
    GameEvents.emit('challenge-start', { id, name: CHALLENGE_BY_ID[id].name });
    toast(CHALLENGE_BY_ID[id].name + ' beginnt – ' + CHALLENGE_BY_ID[id].short + '!');
    render();
    return document.querySelector('.battle-stage, #enemyCard')?.scrollIntoView({ block: 'nearest', behavior: document.body.classList.contains('reduce-motion') ? 'auto' : 'smooth' });
  }
  if (event.target.closest('[data-challenge-abort]')) challengeFinish(Date.now(), { abort: true });
});

// combat-ui.js (loaded later) refreshes the enemy plate 4×/s; wrap it once so the challenge plate wins while one runs
function challengeHudHook() {
  if (typeof renderCombatHud !== 'function' || renderCombatHud.challengeAware) return;
  const base = renderCombatHud;
  renderCombatHud = () => {
    base();
    if (state.meta?.challenges?.active) updateChallengePlate();
  };
  // keep the other hooks' marks, or they would wrap again on every render (an ever-growing chain — fixed in Beta 1.5)
  Object.assign(renderCombatHud, { campaignAware: base.campaignAware, arenaAware: base.arenaAware, challengeAware: true });
}
const renderBeforeChallenge = render;
render = () => {
  challengeHudHook();
  // a fight whose time ran out while the app was closed is resolved on the first render
  if (state.meta?.challenges?.active && Date.now() >= state.meta.challenges.active.endsAt) {
    const result = challengeResolve(Date.now());
    if (result) {
      save();
      const c = CHALLENGE_BY_ID[result.id];
      setTimeout(() => toast(c.name + ' beendet: ' + (result.tier ? CHALLENGE_TIER_NAME[result.tier] : 'nicht bestanden') + (result.chests ? ' · Kiste im Arsenal' : result.splitters ? ' · +' + result.splitters + ' ✦' : '')), 1200);
    }
  }
  renderBeforeChallenge();
  if (currentScreen() === 'battle') {
    renderChallengeCard();
    updateChallengePlate();
  }
  updateChallengeDock();
};
