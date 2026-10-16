// Beta 1.3 — Feldzug UI: routing of every hit while a wave runs, the wave clock hook for the gun (combat-gun.js), the
// campaign card in the Abenteuer tab, the live dock above the attack row, the enemy plate and the combat-scene view.
// Logic: campaign.js. Loaded after challenge-ui.js and before combat-cat-ui.js (Tikki's wrapper stays outermost, so
// her strikes and bursts land on the wave enemy like everything else).

// ----- routing: while a wave runs, ship shots, Boba, Tikki and bursts hit the wave enemy -----
const battleClickBeforeCampaign = $('battleButton').onclick;
$('battleButton').onclick = e => {
  const run = campaignRun();
  if (!run) return battleClickBeforeCampaign(e);
  const now = Date.now();
  if (e?.isTrusted) {
    state.combo = now - (state.comboAt || 0) <= 1200 ? Math.min(10, (state.combo || 0) + 1) : 1;
    state.comboAt = now;
  } else if (!e?.catStrike) state.combo = 0;
  const source = e?.catStrike ? (catStrikeSource === 'cat-ability' ? 'cat-ability' : catStrikeSource === 'burst' ? 'burst' : 'cat') : 'ship',
    aimed = state.aimReady,
    overcharged = now < state.overchargeUntil,
    foe = campaignFoe(),
    res = campaignHit(attack(), source, { aimed, overcharged });
  if (!res) return;
  feedback(res.factor < 0.6 ? 'deny' : 'hit', e?.isTrusted ? 'light' : null);
  GameEvents.emit('attack', { damage: res.damage, weapon: state.ship.weaponType, aimed, overcharge: overcharged, auto: !e?.isTrusted, boss: foe.elite, killed: res.killed, level: 'wave', shielded: res.factor < 1 });
  if (res.shieldBroken) toast('Siegel gebrochen – 2,5 s volle Wirkung!');
  if (res.killed) {
    GameEvents.emit('enemy-defeated', { boss: false, credits: 0, level: 'wave', kind: res.kind, elite: res.elite });
    if (!res.cleared) {
      const next = campaignFoe();
      GameEvents.emit('enemy-spawn', { level: 'wave', boss: false, name: next.name, kind: next.kind, elite: next.elite });
    }
  }
  if (res.cleared) campaignFinish(true, now);
  else updateWavePlate();
};

// ----- finishing a wave: one result, saved before it is shown -----
let campaignNextAt = 0; // an automatic run starts the next wave after a short pause (transient)
let campaignDefeat = null; // the last lost wave's analysis, shown in the campaign card until the next start (transient)

// ----- defeat analysis: what happened and the one or two improvements that fit this fight -----
function shipUpgradeTip(kind) {
  const level = state.ship[kind] || 0,
    cost = shipCost(kind),
    missing = Math.max(0, cost - state.credits),
    effect =
      kind === 'weapon'
        ? 'Schaden ' + fmt(attack()) + ' → ' + fmt(withShip({ weapon: level + 1 }, attack)) + ' pro Schuss'
        : kind === 'hull'
          ? 'Hülle ' + fmt(shipHullMax()) + ' → ' + fmt(shipHullMax({ ...state.ship, hull: level + 1 }))
          : 'Feuerrate ' + shipFireRate().toFixed(2).replace('.', ',') + ' → ' + shipFireRate({ ...state.ship, engine: level + 1 }).toFixed(2).replace('.', ',') + ' Schuss/s';
  return { kind: 'upgrade', module: kind, text: MODULE_INFO[kind].name + ' Stufe ' + level + ' → ' + (level + 1) + ': ' + effect, price: '◈ ' + fmt(cost) + (missing ? ' · noch ' + fmt(missing) + ' ◈' : ''), affordable: !missing };
}
function defeatAnalysis(run, reason) {
  const c = campaignDef(run.key),
    hpOf = kind => waveEnemyHp(run.key, run.wave, kind),
    total = run.queue.reduce((sum, kind) => sum + hpOf(kind), 0),
    remaining = run.hp + run.queue.slice(run.index + 1).reduce((sum, kind) => sum + hpOf(kind), 0),
    progress = total > 0 ? 1 - remaining / total : 0,
    foe = CAMPAIGN_ENEMIES[run.queue[run.index]],
    reducedShare = run.hits ? (run.reduced || 0) / run.hits : 0,
    tips = [];
  if (reducedShare >= 0.25)
    tips.push(
      (run.reducedBy?.shield || 0) >= (run.reducedBy?.armor || 0)
        ? { kind: 'tactic', text: Math.round(reducedShare * 100) + ' % deiner Treffer prallten am Siegelschild ab: ZIELEN, sobald das Siegel leuchtet – das bricht den Schild für 2,5 s.' }
        : { kind: 'tactic', text: Math.round(reducedShare * 100) + ' % deiner Treffer trafen Panzerplatten: Zielschuss und Overcharge gehen voll durch.' }
    );
  // little progress → the ship lacks damage; most of the wave down → it lacked staying power
  (progress < 0.6 ? ['weapon', 'hull'] : ['hull', 'weapon']).forEach(kind => tips.push(shipUpgradeTip(kind)));
  if (state.crew[1]?.unlocked && !crewActive(1)) tips.splice(1, 0, { kind: 'crew', text: 'Boba als Pilot einsetzen: +25 % Feuerrate und 20 % weniger erlittener Schaden.' });
  return { key: run.key, wave: run.wave, name: c.waves[run.wave].name, reason, foe: foe.name, left: run.queue.length - run.index, progress, seconds: Math.round(run.t), tips: tips.slice(0, 2) };
}
function defeatHTML(d) {
  const why = d.reason === 'hull' ? 'Hülle zerstört nach ' + d.seconds + ' s' : 'Die Inspektion hielt stand';
  const tip = t =>
    t.kind === 'upgrade'
      ? `<div class="defeat-tip"><span>${t.text}<em>${t.price}</em></span><button data-campaign-workshop="${t.module}">ZUR WERFT ›</button></div>`
      : t.kind === 'crew'
        ? `<div class="defeat-tip"><span>${t.text}</span><button data-screen="crew">KÄTZCHEN ›</button></div>`
        : `<div class="defeat-tip"><span>${t.text}</span></div>`;
  return `<div class="wave-defeat" role="status"><b>⚠ Welle ${d.wave + 1} verloren · ${why}</b><small>${Math.round(d.progress * 100)} % der Welle geschafft · zuletzt: ${d.foe} (${d.left} Gegner übrig). Nichts verloren – die Welle wartet.</small>${d.tips.map(tip).join('')}</div>`;
}
function campaignFinish(won, now = Date.now(), { abort = false, reason = null } = {}) {
  const before = campaignRun() ? JSON.parse(JSON.stringify(campaignRun())) : null;
  const result = campaignResolve(won, now);
  if (!result) return false;
  save();
  const c = campaignDef(result.key),
    total = c.waves.length;
  GameEvents.emit('wave-complete', { key: result.key, wave: result.wave, won, name: result.name });
  campaignDefeat = !won && before && !abort ? defeatAnalysis(before, reason) : null;
  if (won) {
    feedback('unlock', 'success');
    const pay = result.first ? ' · +' + fmt(result.credits) + ' ◈' + (result.crystals ? ' · +' + result.crystals + ' Kristall' + (result.crystals > 1 ? 'e' : '') : '') + (result.chest ? ' · ' + ARSENAL_CHESTS[result.chest].name + ' im Arsenal' : '') : '';
    toast('Welle ' + (result.wave + 1) + '/' + total + ' geschafft!' + pay);
    if (result.guardianNext) {
      campaignNextAt = 0;
      // the last wave is behind us: the guardian answers in person (Orion: P.I.P.S. with his inspection shield)
      if (c.guardian === 'pips' && startPipsFight()) {
        const foe = enemyInfo();
        GameEvents.emit('enemy-spawn', { level: 'pips', boss: false, name: 'P.I.P.S.', story: true, foe: foe.name });
      }
    } else if (campaignState().auto) campaignNextAt = now + WAVE_PAUSE_MS;
  } else {
    campaignNextAt = 0;
    feedback('deny', 'warning');
    toast(abort ? 'Rückzug – die Welle beginnt beim nächsten Start von vorn.' : 'Welle ' + (result.wave + 1) + ' verloren – was jetzt hilft, steht in der Feldzug-Karte.');
    // the analysis is the next thing to read: bring it into view once (the wave is over, nothing on stage to watch)
    if (campaignDefeat && currentScreen() === 'battle') setTimeout(() => document.querySelector('.wave-defeat')?.scrollIntoView?.({ block: 'center', behavior: document.body.classList.contains('reduce-motion') ? 'auto' : 'smooth' }), 0);
  }
  render();
  return true;
}
// Called by the gun clock (combat-gun.js) while the fight is on screen: advances the wave time, starts the next wave of
// an automatic run, resolves a timeout.
function campaignClock(dt, now = Date.now()) {
  const run = campaignRun();
  if (!run) {
    if (campaignNextAt && now >= campaignNextAt) {
      campaignNextAt = 0;
      const key = campaignKeyFor();
      if (key && !campaignStartBlocked(key)) campaignBegin(key, now);
    }
    return;
  }
  const ev = campaignAdvance(dt);
  for (const shot of ev?.shots || []) GameEvents.emit('enemy-shot', shot);
  if (ev?.shots?.length) {
    feedback('hit', null);
    updateWavePlate();
  }
  if (ev?.called) {
    GameEvents.emit('wave-call', { key: run.key });
    toast('Die Messdrohne hat Verstärkung gerufen: +1 Stempeldrohne!');
  }
  if (ev?.failed) campaignFinish(false, now, { reason: ev.reason });
}
function campaignBegin(key, now = Date.now()) {
  if (!campaignStart(key, now)) return false;
  campaignDefeat = null;
  const run = campaignRun(),
    c = campaignDef(key),
    w = c.waves[run.wave],
    foe = campaignFoe();
  save();
  feedback('unlock', 'light');
  GameEvents.emit('wave-start', { key, wave: run.wave, total: c.waves.length, name: w.name });
  GameEvents.emit('enemy-spawn', { level: 'wave', boss: false, name: foe.name, kind: foe.kind, elite: foe.elite });
  if (w.line && typeof storyQueue !== 'undefined' && !state.meta.story.journal.includes('wave:' + key + ':' + run.wave)) {
    // one short line per wave, the first time only (journal keeps it)
    state.meta.story.journal.push('wave:' + key + ':' + run.wave);
    storyQueue.push(w.line);
    showNextStoryLine();
  }
  render();
  return true;
}

// ----- view model for the combat scene -----
const combatViewBeforeCampaign = window.NebulaView.combat;
window.NebulaView.combat = () => {
  const view = combatViewBeforeCampaign(),
    run = campaignRun();
  if (!run) return view;
  const foe = campaignFoe(),
    e = CAMPAIGN_ENEMIES[foe.kind];
  return {
    ...view,
    enemyHp: run.hp,
    enemyMax: run.maxHp,
    boss: false,
    weakness: foe.weakness,
    story: {
      mode: 'wave',
      kind: foe.kind,
      elite: foe.elite,
      seal: e.shield ? sealPhase(run) : null,
      armor: Boolean(e.armor),
      call: e.callAfter && !run.called.includes(run.index) ? Math.min(1, run.foeT / e.callAfter) : 0,
      hull: run.hull,
      hullMax: run.hullMax,
      charge: Math.min(1, Math.max(0, 1 - (run.nextShot - run.foeT) / e.every)),
      telegraph: e.shield ? sealPhase(run) === 'warn' : false
    }
  };
};

// ----- card in the Abenteuer tab -----
const WAVE_FOE_ICON = { stamp: '🔖', moth: '📄', clip: '📋', scan: '📡', seal: '🛡' };
function waveRewardText(key, wave) {
  const w = campaignDef(key).waves[wave],
    claimed = campaignState().claims.includes('wave:' + key + ':' + wave);
  if (claimed) return 'Belohnung erhalten';
  return 'Erstes Mal: ◈ ' + fmt(w.reward.credits) + (w.reward.crystals ? ' · ◆ ' + w.reward.crystals : '') + (w.reward.chest ? ' · ' + ARSENAL_CHESTS[w.reward.chest].name : '');
}
// Beta 1.6: the enemy's role and the DNA affinity that beats it (the arena's matchup; the old weapon names only fit the
// classic waves)
function foeRoleText(kind) {
  const d = typeof enemyDna === 'function' ? enemyDna(kind) : null,
    family = d && typeof ENEMY_FAMILIES !== 'undefined' ? ENEMY_FAMILIES[d.family]?.name : null,
    beater = d && typeof DNA_AFFINITIES !== 'undefined' ? Object.keys(DNA_AFFINITIES).find(id => DNA_AFFINITIES[id].beats === d.affinity) : null;
  if (!beater) return 'Schwach gegen ' + CAMPAIGN_ENEMIES[kind].weakness + '.';
  return (family ? family + ' · ' : '') + 'schwach gegen ' + DNA_AFFINITIES[beater].icon + ' ' + DNA_AFFINITIES[beater].short + '-Waffen.';
}
function waveFoesHTML(key, wave) {
  const counts = {};
  for (const kind of campaignDef(key).waves[wave].foes) counts[kind] = (counts[kind] || 0) + 1;
  return Object.entries(counts)
    .map(([kind, n]) => `<li title="Schuss: ${fmt(enemyShotDamage(key, wave, kind))} alle ${String(CAMPAIGN_ENEMIES[kind].every).replace('.', ',')} s"><i aria-hidden="true">${window.EnemyArt?.portraitURL(kind, 64) ? `<img src="${window.EnemyArt.portraitURL(kind, 64)}" alt="" width="32" height="32" />` : WAVE_FOE_ICON[kind]}</i><b>${n}× ${CAMPAIGN_ENEMIES[kind].name}</b><small>${CAMPAIGN_ENEMIES[kind].tip} ${foeRoleText(kind)} Schuss ${fmt(enemyShotDamage(key, wave, kind))} alle ${String(CAMPAIGN_ENEMIES[kind].every).replace('.', ',')} s.</small></li>`)
    .join('');
}
function renderCampaignCard() {
  const card = $('campaignCard');
  if (!card || !state.meta?.campaign) return;
  const key = campaignKeyFor();
  if (!key || !campaignOpen(key)) {
    card.hidden = true;
    return;
  }
  card.hidden = false;
  const c = campaignDef(key),
    cs = campaignState(),
    cleared = campaignCleared(key),
    total = c.waves.length,
    run = cs.run,
    guardianStage = state.meta.guardians?.[c.guardian]?.stage;
  const track = c.waves
    .map((w, i) => `<i class="wave-pip ${i < cleared ? 'done' : run?.wave === i ? 'live' : i === cleared ? 'next' : ''}" title="Welle ${i + 1}: ${w.name}"></i>`)
    .join('') + `<i class="wave-pip boss ${['defeated', 'repaired'].includes(guardianStage) ? 'done' : guardianStage === 'battle' ? 'live' : ''}" title="Wächter">★</i>`;
  let body;
  if (cleared >= total) {
    body =
      guardianStage === 'battle'
        ? `<p class="arsenal-note">Alle ${total} Wellen geschafft – <b>P.I.P.S. stellt sich selbst!</b> Oben im Kampf: Prüfschild mit Zielschüssen brechen.</p>`
        : guardianStage === 'warned'
          ? `<p class="arsenal-note">Alle ${total} Wellen geschafft. P.I.P.S. ist auf dem Weg …</p><button class="campaign-start" data-campaign-guardian="${key}">P.I.P.S. HERAUSFORDERN</button>`
          : `<p class="arsenal-note">✓ Feldzug abgeschlossen – alle ${total} Wellen und der Wächter. Die Sektor-Verteidigung oben läuft endlos weiter.</p>`;
  } else {
    const wave = run ? run.wave : cleared,
      w = c.waves[wave],
      blocked = run ? null : campaignStartBlocked(key);
    body = `${!run && campaignDefeat && campaignDefeat.key === key && campaignDefeat.wave === wave ? defeatHTML(campaignDefeat) : ''}<div class="wave-next"><span>WELLE ${wave + 1}/${total}${run ? ' · LÄUFT' : ''}</span><b>${w.name}</b><small>🛡 Hülle ${fmt(shipHullMax())} · ${w.foes.length} Gegner · ${waveRewardText(key, wave)}</small></div>
      <ul class="wave-foes">${waveFoesHTML(key, wave)}</ul>
      <div class="wave-actions">${run ? '<button class="campaign-start" data-campaign-abort>RÜCKZUG</button>' : `<button class="campaign-start" data-campaign-start="${key}" ${blocked ? 'disabled' : ''}>WELLE ${wave + 1} STARTEN</button>`}<label class="wave-auto"><input type="checkbox" data-campaign-auto ${cs.auto ? 'checked' : ''} /> automatisch weiter</label></div>
      ${blocked && !run ? `<p class="arsenal-note">${blocked}</p>` : ''}`;
  }
  setHTML(
    card,
    `<div class="challenge-head"><div><span>${c.short.toUpperCase()}</span><h2>${c.title}</h2></div><b>${Math.min(cleared, total)}/${total}</b></div>
    <div class="wave-track" aria-label="Fortschritt ${cleared} von ${total} Wellen">${track}</div>
    <p class="arsenal-note">Dein Schiff feuert automatisch, die Gegner schießen zurück. Hält die Hülle nicht, zieht sich das Schiff zur Reparatur zurück. Entscheidend sind Zielen, Overcharge, Tikki und die Werft.</p>${body}`
  );
}

// ----- live dock + enemy plate -----
function waveStatusHTML(run) {
  const foe = campaignFoe(),
    e = CAMPAIGN_ENEMIES[foe.kind],
    hullPct = Math.round((run.hull / Math.max(1, run.hullMax)) * 100);
  let line;
  if (e.shield) {
    const phase = sealPhase(run);
    line =
      phase === 'shield'
        ? '🛡 <b>SIEGELSCHILD</b> nur 25 % – jetzt Zielschuss!'
        : phase === 'warn'
          ? '⚠ <b>Siegel lädt</b> – Zielen bereithalten'
          : phase === 'broken'
            ? '✓ <b>Siegel gebrochen</b> volle Wirkung'
            : '✓ <b>Verwundbar</b> volle Wirkung';
  } else if (e.armor) line = '📋 <b>Panzerplatte</b> 50 % · Zielschuss/Overcharge gehen durch';
  else if (e.callAfter && !run.called.includes(run.index)) line = `📡 <b>Ruft Verstärkung in ${Math.max(0, Math.ceil(e.callAfter - run.foeT))} s</b>`;
  else line = `${WAVE_FOE_ICON[foe.kind]} <b>${e.name}</b> · ${run.index + 1}/${run.queue.length}`;
  return `<p class="tb-status challenge ${hullPct <= 30 ? 'overload' : 'fire'}" role="status">${line} <span class="wave-hull" aria-label="Hülle ${fmt(run.hull)} von ${fmt(run.hullMax)}"><i><u style="width:${hullPct}%"></u></i>🛡 ${fmt(run.hull)}</span></p><button class="challenge-abort" data-campaign-abort>RÜCKZUG</button>`;
}
function updateWaveDock() {
  const dock = $('waveDock'),
    run = campaignRun(),
    on = Boolean(run) && currentScreen() === 'battle';
  document.body.classList.toggle('wave-active', on);
  if (!dock) return;
  dock.hidden = !on;
  if (on) setHTML(dock, waveStatusHTML(run));
}
function updateWavePlate() {
  const run = campaignRun();
  if (!run || currentScreen() !== 'battle') return updateWaveDock();
  const c = campaignDef(run.key),
    foe = campaignFoe(),
    e = CAMPAIGN_ENEMIES[foe.kind];
  $('enemyName').textContent = foe.name;
  $('enemyHealth').style.width = (run.hp / Math.max(1, run.maxHp)) * 100 + '%';
  $('enemyHealthText').textContent = fmt(run.hp) + ' / ' + fmt(run.maxHp);
  $('battleKicker').textContent = c.short.toUpperCase();
  $('battleTitle').textContent = 'Welle ' + (run.wave + 1) + '/' + c.waves.length + ' · ' + c.waves[run.wave].name;
  $('dropPreview').textContent = waveRewardText(run.key, run.wave);
  $('enemyRank').textContent = 'GEGNER';
  $('enemyLevel').hidden = false;
  $('enemyLevel').textContent = run.index + 1 + '/' + run.queue.length;
  $('enemyPhaseMark').hidden = true;
  $('battleReward').textContent = '✦';
  const match = state.ship.weaponType === e.weakness;
  setHTML($('enemyTags'), `<span class="hud-tag ${match ? 'good' : ''}">Schwach gegen ${weaponDot(e.weakness)} ${e.weakness}${match ? ' ✓ +15 %' : ''}</span>${e.armor ? '<span class="hud-tag shield">📋 Panzer 50 %</span>' : ''}${e.shield ? `<span class="hud-tag ${sealPhase(run) === 'shield' ? 'shield' : sealPhase(run) === 'warn' ? 'warn' : 'good'}">🛡 Siegel</span>` : ''}`);
  $('combatHint').textContent = 'TAKTIK: ' + e.tip;
  $('enemyCard').dataset.threat = e.shield && sealPhase(run) === 'shield' ? 'shield' : e.shield && sealPhase(run) === 'warn' ? 'warn' : '';
  updateWaveDock();
}

document.addEventListener('click', event => {
  const start = event.target.closest('[data-campaign-start]');
  if (start) {
    const key = start.dataset.campaignStart,
      blocked = campaignStartBlocked(key);
    if (blocked) return toast(blocked);
    campaignBegin(key);
    return document.querySelector('#enemyCard')?.scrollIntoView({ block: 'nearest', behavior: document.body.classList.contains('reduce-motion') ? 'auto' : 'smooth' });
  }
  if (event.target.closest('[data-campaign-abort]')) return campaignFinish(false, Date.now(), { abort: true });
  const shipyard = event.target.closest('[data-campaign-workshop]');
  if (shipyard) {
    // the workshop with the suggested module already previewed (its buy button is right there)
    workshopPreview = { kind: 'upgrade', id: shipyard.dataset.campaignWorkshop };
    showScreen('battle');
    render();
    return $('workshop')?.scrollIntoView?.({ block: 'start', behavior: document.body.classList.contains('reduce-motion') ? 'auto' : 'smooth' });
  }
  const challenge = event.target.closest('[data-campaign-guardian]');
  if (challenge && campaignDef(challenge.dataset.campaignGuardian)?.guardian === 'pips' && campaignComplete(challenge.dataset.campaignGuardian) && startPipsFight()) {
    render();
    return document.querySelector('#enemyCard')?.scrollIntoView({ block: 'nearest' });
  }
});
document.addEventListener('change', event => {
  const box = event.target.closest?.('[data-campaign-auto]');
  if (!box || !state.meta?.campaign) return;
  campaignState().auto = box.checked;
  if (!box.checked) campaignNextAt = 0;
  save();
});

// combat-ui.js (loaded later) refreshes the enemy plate 4×/s; wrap it once so the wave plate wins while a wave runs
function campaignHudHook() {
  if (typeof renderCombatHud !== 'function' || renderCombatHud.campaignAware) return;
  const base = renderCombatHud;
  renderCombatHud = () => {
    base();
    if (campaignRun()) updateWavePlate();
  };
  // keep the other hooks' marks, or they would wrap again on every render (an ever-growing chain — fixed in Beta 1.5)
  Object.assign(renderCombatHud, { challengeAware: base.challengeAware, arenaAware: base.arenaAware, campaignAware: true });
}
const renderBeforeCampaign = render;
render = () => {
  campaignHudHook();
  renderBeforeCampaign();
  if (currentScreen() === 'battle') {
    renderCampaignCard();
    updateWavePlate();
  }
  updateWaveDock();
};
