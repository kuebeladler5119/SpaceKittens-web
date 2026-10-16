// Beta 1.4 M4 — Combat 2.0 UI: starts campaign waves in the arena (default; "Klassisch" stays selectable), runs the
// arena clock on animation frames while the fight is on screen, the wave dock with the two abilities, the enemy plate,
// the ship's condition with its repairs, results and defeat analysis. Logic: arena.js. Loaded after combat-gun.js
// (loaded after combat-ui.js and dna-ui.js: its battle-button wrapper is the outermost one, so no classic shot lands
// while an arena wave runs).

let arenaRun = null; // the running arena wave (transient: a reload ends it without reward or penalty)
let arenaLast = 0,
  arenaSeen = 0; // last event sequence the UI has reacted to
function arenaActive() {
  return Boolean(arenaRun);
}
function campaignMode() {
  return state.meta?.campaign?.mode === 'classic' ? 'classic' : 'arena';
}
function arenaBlocked(key) {
  const blocked = campaignStartBlocked(key);
  if (blocked) return blocked;
  if (shipCondition().emergencyUntil) return 'Notreparatur läuft noch';
  if (shipHullNow() <= 0) return 'Schiff kampfunfähig – erst reparieren (Notreparatur ist kostenlos)';
  return null;
}
function arenaBegin(key, now = Date.now()) {
  if (arenaBlocked(key)) return false;
  const cs = campaignState(),
    wave = campaignCleared(key);
  arenaRun = arenaCreate(key, wave, cs.wins + cs.fails, shipHullNow(), shipHullMax());
  arenaLast = 0;
  arenaSeen = 0;
  campaignDefeat = null;
  const c = campaignDef(key),
    w = c.waves[wave];
  feedback('unlock', 'light');
  GameEvents.emit('wave-start', { key, wave, total: c.waves.length, name: w.name, arena: true });
  if (w.line && typeof storyQueue !== 'undefined' && !state.meta.story.journal.includes('wave:' + key + ':' + wave)) {
    state.meta.story.journal.push('wave:' + key + ':' + wave);
    storyQueue.push(w.line);
    showNextStoryLine();
  }
  save();
  render();
  measureArenaInset();
  arenaLoop();
  return true;
}
// write the hull back after every step batch: the damage is the ship's, not the wave's
function arenaSyncHull() {
  if (!arenaRun) return;
  shipCondition().damage = Math.max(0, arenaRun.ship.hullMax - arenaRun.ship.hull);
}
function arenaAnalysis(a, reason) {
  const total = a.queue.reduce((sum, kind) => sum + arenaFoeStats(kind, a.key, a.wave).hp, 0),
    s = a.stats,
    progress = total > 0 ? Math.min(1, s.dealt / total) : 0,
    tips = [],
    weakShare = s.hits ? s.weak / s.hits : 0,
    reducedShare = s.hits ? s.reduced / s.hits : 0;
  if (weakShare >= 0.3) {
    const foeAff = a.foes[0]?.affinity || enemyDna(a.queue[0]).affinity,
      better = DNA_AFFINITY_IDS.find(id => DNA_AFFINITIES[id].beats === foeAff);
    tips.push({ kind: 'tactic', text: Math.round(weakShare * 100) + ' % deiner Treffer waren schwach (Affinität). Gegen ' + DNA_AFFINITIES[foeAff].short + ' hilft eine ' + DNA_AFFINITIES[better].short + '-Waffe in der Werft.' });
  }
  if (reducedShare >= 0.25) tips.push({ kind: 'tactic', text: Math.round(reducedShare * 100) + ' % deiner Treffer prallten an Panzer oder Siegel ab: die Overcharge-Salve (⚡) bricht beides.' });
  if (!s.abilities && s.taken > 0) tips.push({ kind: 'tactic', text: 'Der Schildpuls (🛡) fängt 2,5 s lang alle Schüsse ab – vor allem gegen Schwärme und Siegelkreuzer.' });
  (progress < 0.6 ? ['weapon', 'hull'] : ['hull', 'weapon']).forEach(kind => tips.push(shipUpgradeTip(kind)));
  const lastFoe = a.foes.find(f => f.hp > 0);
  return { key: a.key, wave: a.wave, name: a.boss ? (typeof EXP_BOSS !== 'undefined' && EXP_BOSS[a.key]?.name) || 'Wächter' : campaignDef(a.key).waves[a.wave].name, reason, foe: lastFoe ? CAMPAIGN_ENEMIES[lastFoe.kind]?.name || 'Glutgeist' : '—', left: a.queue.length - a.spawned + a.foes.length, progress, seconds: Math.round(a.t), tips: tips.slice(0, 2) };
}
// Ends the arena wave: rewards through the campaign's claim ledger (first clear pays once), damage stays on the ship.
function arenaFinish(won, now = Date.now(), { abort = false, reason = null } = {}) {
  const a = arenaRun;
  if (!a) return false;
  arenaSyncHull();
  arenaRun = null;
  const cs = campaignState();
  cs.run = { key: a.key, wave: a.wave };
  const result = campaignResolve(won, now);
  cs.run = null;
  cs.arenaWins = (cs.arenaWins || 0) + (won ? 1 : 0);
  save();
  const c = campaignDef(result.key),
    total = c.waves.length;
  GameEvents.emit('wave-complete', { key: result.key, wave: result.wave, won, name: result.name, arena: true });
  campaignDefeat = !won && !abort ? arenaAnalysis(a, reason || a.result?.reason) : null;
  if (won) {
    feedback('unlock', 'success');
    const pay = result.first ? ' · +' + fmt(result.credits) + ' ◈' + (result.crystals ? ' · +' + result.crystals + ' Kristall' + (result.crystals > 1 ? 'e' : '') : '') + (result.chest ? ' · ' + ARSENAL_CHESTS[result.chest].name + ' im Arsenal' : '') : '';
    toast('Welle ' + (result.wave + 1) + '/' + total + ' geschafft! ' + a.stats.kills + ' Gegner · Hülle ' + Math.round((a.ship.hull / a.ship.hullMax) * 100) + ' %' + pay);
    // Beta 1.5: the guardian waits for his own arena expedition (no classic boss fight starts here)
    if (result.guardianNext) campaignNextAt = 0;
    else if (cs.auto && shipHullNow() > shipHullMax() * 0.25) campaignNextAt = now + WAVE_PAUSE_MS;
    else campaignNextAt = 0;
  } else {
    campaignNextAt = 0;
    feedback('deny', 'warning');
    toast(abort ? 'Rückzug – die Welle beginnt beim nächsten Start von vorn.' : 'Welle ' + (result.wave + 1) + ' verloren – Schiff zieht sich zur Reparatur zurück.');
    if (campaignDefeat && currentScreen() === 'battle') setTimeout(() => document.querySelector('.wave-defeat')?.scrollIntoView?.({ block: 'center', behavior: document.body.classList.contains('reduce-motion') ? 'auto' : 'smooth' }), 0);
  }
  render();
  return true;
}
// The arena clock: animation frames while the fight is visible (no background or offline fighting).
function arenaShouldRun() {
  return Boolean(arenaRun) && !document.hidden && currentScreen() === 'battle' && !(typeof storyDialogueOpen === 'function' && storyDialogueOpen());
}
function arenaFrame(now) {
  if (!arenaRun) return;
  const dt = arenaLast ? Math.min(0.25, Math.max(0, (now - arenaLast) / 1000)) : 0;
  arenaLast = now;
  if (arenaShouldRun() && dt > 0) {
    arenaAdvance(arenaRun, dt);
    arenaSyncHull();
    arenaReact();
    if (arenaRun.result) return arenaFinish(arenaRun.result.won, Date.now(), { reason: arenaRun.result.reason });
  }
}
let arenaLoopOn = false;
function arenaLoop() {
  if (arenaLoopOn) return;
  arenaLoopOn = true;
  // the frame timestamp when the browser gives one (high resolution), else the clock
  const loop = stamp => {
    if (!arenaRun) {
      arenaLoopOn = false;
      return;
    }
    arenaFrame(typeof stamp === 'number' ? stamp : Date.now());
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
// sounds, haptics and the dock follow the fight's events (the scene draws them itself)
let arenaDockAt = 0;
function arenaReact() {
  const a = arenaRun;
  if (!a) return;
  let hit = false,
    hurt = false,
    kill = false;
  for (const e of a.events) {
    if (e.seq <= arenaSeen) continue;
    if (e.type === 'ship-hit') hurt = true;
    else if (e.type === 'kill') kill = true;
    else if (e.type === 'hit') hit = true;
    else if (e.type === 'call') {
      const who = CAMPAIGN_ENEMIES[e.kind]?.name || 'Ein Rufer',
        calls = e.calls || ['stamp'];
      toast(who + ' hat Verstärkung gerufen: +' + calls.length + ' ' + (CAMPAIGN_ENEMIES[calls[0]]?.name || 'Gegner') + '!');
    }
    else if (e.type === 'shield-break') toast('Siegel gebrochen!');
  }
  arenaSeen = a.eventSeq || 0;
  if (hurt) feedback('hit', 'light');
  else if (kill) feedback('reward', null);
  else if (hit && !document.body.classList.contains('reduce-motion')) feedback('hit', null);
  const now = Date.now();
  if (now - arenaDockAt > 200) {
    arenaDockAt = now;
    updateWaveDock();
    arenaPlate();
  }
}

// ----- dock (abilities, hull, progress) and enemy plate -----
function arenaDockHTML(a) {
  const hullPct = Math.round((a.ship.hull / Math.max(1, a.ship.hullMax)) * 100),
    left = a.queue.length - a.spawned + a.foes.length,
    ability = id => {
      const ab = ARENA_ABILITIES[id],
        wait = Math.max(0, a.ship.ready[id] - a.t),
        on = id === 'shield' ? a.t < a.ship.shieldUntil : a.t < a.ship.salvoUntil;
      return `<button class="arena-ability ${on ? 'on' : ''}" data-arena-ability="${id}" ${wait > 0 ? 'disabled' : ''} aria-label="${ab.name}: ${ab.text}"><i aria-hidden="true">${ab.icon}</i><b>${ab.short}</b><small>${on ? 'aktiv' : wait > 0 ? Math.ceil(wait) + ' s' : 'bereit'}</small></button>`;
    };
  return `<p class="tb-status challenge ${hullPct <= 30 ? 'overload' : 'fire'}" role="status">⚔ <b>${left} Gegner übrig</b> · ${a.stats.kills} besiegt <span class="wave-hull" aria-label="Hülle ${fmt(a.ship.hull)} von ${fmt(a.ship.hullMax)}"><i><u style="width:${hullPct}%"></u></i>🛡 ${fmt(a.ship.hull)}</span></p><div class="arena-abilities">${ability('shield')}${ability('salvo')}<button class="challenge-abort" data-campaign-abort>RÜCKZUG</button></div>`;
}
const updateWaveDockBeforeArena = updateWaveDock;
updateWaveDock = () => {
  const on = Boolean(arenaRun) && currentScreen() === 'battle';
  if (document.body.classList.contains('arena-on') !== on) {
    document.body.classList.toggle('arena-on', on);
    // the scene canvases switched display: let the runtime start/stop their loops now
    const m = window.NebulaScenesRuntime?.mounted;
    setTimeout(() => (m?.arena?.handle.refresh?.(), m?.combat?.handle.refresh?.()), 0);
  }
  if (!arenaRun) return updateWaveDockBeforeArena();
  const dock = $('waveDock');
  document.body.classList.toggle('wave-active', on);
  if (!dock) return;
  dock.hidden = !on;
  if (on) setHTML(dock, arenaDockHTML(arenaRun));
};
function arenaPlate() {
  const a = arenaRun;
  if (!a || a.boss || currentScreen() !== 'battle') return; // the fullscreen expedition shows its own top bar
  const c = campaignDef(a.key),
    total = a.queue.reduce((sum, kind) => sum + arenaFoeStats(kind, a.key, a.wave).hp, 0),
    rest = Math.max(0, total - a.stats.dealt);
  $('enemyName').textContent = 'Welle ' + (a.wave + 1) + ' · ' + c.waves[a.wave].name;
  $('enemyHealth').style.width = (rest / Math.max(1, total)) * 100 + '%';
  $('enemyHealthText').textContent = fmt(rest) + ' / ' + fmt(total);
  $('battleKicker').textContent = 'ARENA · ' + c.short.toUpperCase();
  $('battleTitle').textContent = 'Welle ' + (a.wave + 1) + '/' + c.waves.length + ' · ' + c.waves[a.wave].name;
  $('enemyRank').textContent = 'GEGNER';
  $('enemyLevel').hidden = false;
  $('enemyLevel').textContent = a.stats.kills + a.stats.crashed + '/' + a.queue.length;
  $('enemyPhaseMark').hidden = true;
  $('battleReward').textContent = '✦';
  const L = a.loadout,
    kinds = [...new Set(a.queue)];
  setHTML(
    $('enemyTags'),
    `<span class="hud-tag">${dnaAffinityChip(L.affinity)} ${L.chassis ? DNA_CHASSIS[L.chassis]?.name || '' : state.ship.weaponType}</span>${kinds
      .map(kind => {
        const d = enemyDna(kind),
          f = arenaAffinity(L, d.affinity);
        return `<span class="hud-tag ${f > 1 ? 'good' : f < 1 ? 'warn' : ''}">${CAMPAIGN_ENEMIES[kind]?.name || 'Glutgeist'} ${DNA_AFFINITIES[d.affinity].icon}${f > 1 ? ' ×' + String(f).replace('.', ',') : f < 1 ? ' ×0,8' : ''}</span>`;
      })
      .join('')}`
  );
  $('combatHint').textContent = 'ARENA: Dein Schiff zielt selbst auf den nächsten Gegner. Schildpuls fängt Schüsse ab, die Overcharge-Salve bricht Panzer und Siegel.';
  $('enemyCard').dataset.threat = '';
}
const updateWavePlateBeforeArena = updateWavePlate;
updateWavePlate = () => (arenaRun ? arenaPlate() : updateWavePlateBeforeArena());

// ----- routing: starts go to the arena in arena mode; the classic clock and shots stay out of an arena wave -----
const campaignBeginBeforeArena = campaignBegin;
campaignBegin = (key, now = Date.now()) => (campaignMode() === 'arena' ? arenaBegin(key, now) : campaignBeginBeforeArena(key, now));
const campaignFinishBeforeArena = campaignFinish;
campaignFinish = (won, now = Date.now(), opts = {}) => (arenaRun ? arenaFinish(won, now, opts) : campaignFinishBeforeArena(won, now, opts));
const campaignClockBeforeArena = campaignClock;
campaignClock = (dt, now = Date.now()) => {
  if (arenaRun) return; // the arena has its own fixed-step clock
  if (!campaignRun() && campaignNextAt && now >= campaignNextAt && campaignMode() === 'arena') {
    campaignNextAt = 0;
    const key = campaignKeyFor();
    if (key && !arenaBlocked(key)) arenaBegin(key, now);
    return;
  }
  campaignClockBeforeArena(dt, now);
};
const battleClickBeforeArena = $('battleButton').onclick;
$('battleButton').onclick = e => (arenaRun ? undefined : battleClickBeforeArena(e));
const renderCombatHudBeforeArena = renderCombatHud;
renderCombatHud = () => {
  renderCombatHudBeforeArena();
  if (arenaRun) arenaPlate();
};
Object.assign(renderCombatHud, { campaignAware: renderCombatHudBeforeArena.campaignAware, challengeAware: renderCombatHudBeforeArena.challengeAware, arenaAware: true });

// ----- ship condition and repairs (campaign card, arena mode) -----
function shipConditionHTML() {
  const max = shipHullMax(),
    now = shipHullNow(),
    pct = Math.round((now / Math.max(1, max)) * 100),
    er = emergencyRepairState(),
    p = state.activePlanet,
    kits = fabStock(p, 'repairKit'),
    plates = fabStock(p, 'plating'),
    damaged = shipCondition().damage > 0,
    price = repairCreditPrice();
  return `<div class="ship-condition ${pct <= 25 ? 'critical' : pct < 100 ? 'damaged' : ''}"><div class="sc-head"><b>🛡 Schiffszustand ${pct} %</b><small>Hülle ${fmt(now)} / ${fmt(max)} · Schäden bleiben bis zur Reparatur</small><i class="sc-bar"><u style="width:${pct}%"></u></i></div>${
    damaged
      ? `<div class="sc-actions"><button data-ship-repair="kit" ${kits >= 1 ? '' : 'disabled'}>✚ REPARATURSATZ<small>+40 % · ${fmt(kits)} auf ${shortName(p)}</small></button><button data-ship-repair="plate" ${plates >= 1 ? '' : 'disabled'}>▤ PANZERPLATTE<small>+10 % · ${fmt(plates)} auf ${shortName(p)}</small></button><button data-ship-repair="credits" ${state.credits >= price ? '' : 'disabled'}>◈ WERFT<small>voll · ${fmt(price)} ◈</small></button>${
          er.running ? `<button disabled>⏱ NOTREPARATUR<small>noch ${clockText(er.left)}</small></button>${typeof adReady === 'function' && adReady('repair') ? `<button class="ad-button" data-ship-repair-ad>${adLabel('repair', 'SOFORT FERTIG')}</button>` : ''}` : er.available ? `<button data-ship-repair="emergency">⏱ NOTREPARATUR<small>kostenlos · 90 s → 50 %</small></button>` : ''
        }</div>`
      : ''
  }</div>`;
}
// arena mode: the wave's enemies with their family and affinity (the Glutgeist included) instead of the old weakness
const ARENA_FOE_NAME = { ember: 'Glutgeist' };
const ARENA_FOE_TIP = { ember: 'Elementar aus den alten Kristallschmieden. Treibt nah heran und wirft Glut.' };
const waveFoesBeforeArena = waveFoesHTML;
waveFoesHTML = (key, wave) => {
  if (campaignMode() !== 'arena') return waveFoesBeforeArena(key, wave);
  const counts = {};
  for (const kind of arenaWaveFoes(key, wave)) counts[kind] = (counts[kind] || 0) + 1;
  const L = arenaLoadout();
  return Object.entries(counts)
    .map(([kind, n]) => {
      const d = enemyDna(kind),
        fam = ENEMY_FAMILIES[d.family],
        aff = DNA_AFFINITIES[d.affinity],
        better = DNA_AFFINITY_IDS.find(id => DNA_AFFINITIES[id].beats === d.affinity),
        f = arenaAffinity(L, d.affinity),
        img = window.EnemyArt?.portraitURL(kind, 64);
      return `<li><i aria-hidden="true">${img ? `<img src="${img}" alt="" width="32" height="32" />` : aff.icon}</i><b>${n}× ${CAMPAIGN_ENEMIES[kind]?.name || ARENA_FOE_NAME[kind] || kind}</b><small>${fam.name} · ${aff.icon} ${aff.short} – ${DNA_AFFINITIES[better].short} trifft stark${f > 1 ? ' (deine Waffe ✓)' : f < 1 ? ' (deine Waffe schwach)' : ''}. ${CAMPAIGN_ENEMIES[kind]?.tip || ARENA_FOE_TIP[kind] || ''}</small></li>`;
    })
    .join('');
};
const renderCampaignCardBeforeArena = renderCampaignCard;
renderCampaignCard = () => {
  renderCampaignCardBeforeArena();
  const card = $('campaignCard');
  if (!card || card.hidden) return;
  const key = campaignKeyFor();
  if (!key || campaignComplete(key)) return;
  const arena = campaignMode() === 'arena';
  if (arena) {
    // the card's texts for the arena: intro, current hull and the real number of enemies
    const intro = card.querySelector('.wave-track + .arsenal-note');
    if (intro) intro.textContent = 'Arena: Dein Schiff zielt und feuert selbst, alle Gegner der Welle greifen gleichzeitig an. Entscheidend sind DNA-Waffe und Affinität, Werft, Tikki und deine zwei Fähigkeiten – Schildpuls und Overcharge-Salve.';
    const line = card.querySelector('.wave-next small'),
      wave = arenaRun ? arenaRun.wave : campaignCleared(key);
    if (line) line.textContent = '🛡 Hülle ' + fmt(shipHullNow()) + '/' + fmt(shipHullMax()) + ' · ' + arenaWaveFoes(key, wave).length + ' Gegner · ' + waveRewardText(key, wave);
  }
  let extra = `<div class="arena-mode" role="radiogroup" aria-label="Kampfansicht"><button role="radio" aria-checked="${arena}" class="${arena ? 'active' : ''}" data-campaign-mode="arena" ${arenaRun || campaignRun() ? 'disabled' : ''}>⚔ ARENA</button><button role="radio" aria-checked="${!arena}" class="${!arena ? 'active' : ''}" data-campaign-mode="classic" ${arenaRun || campaignRun() ? 'disabled' : ''}>KLASSISCH</button></div>`;
  if (arena) {
    const wave = campaignCleared(key),
      extraFoes = ARENA_WAVE_EXTRA[key]?.[wave] || [];
    extra += `<p class="arsenal-note">Bis zu ${ARENA.MAX_ALIVE} Gegner zugleich, echte Projektile, Treffer bleiben an der Hülle bis zur Reparatur.${extraFoes.length ? ' Diesmal dabei: ' + extraFoes.length + '× Glutgeist.' : ''}</p>${shipConditionHTML()}`;
  }
  // a running arena wave: the card says so and offers the retreat (like a running classic wave)
  if (arenaRun) {
    const start = card.querySelector('[data-campaign-start]');
    if (start) start.outerHTML = '<button class="campaign-start" data-campaign-abort>RÜCKZUG</button>';
    const label = card.querySelector('.wave-next span');
    if (label && !label.textContent.includes('LÄUFT')) label.textContent += ' · LÄUFT';
  }
  const blocked = arena && !arenaRun ? arenaBlocked(key) : null;
  card.insertAdjacentHTML('beforeend', extra + (blocked && blocked !== campaignStartBlocked(key) ? `<p class="arsenal-note warn">${blocked}</p>` : ''));
  if (blocked) card.querySelector('[data-campaign-start]')?.setAttribute('disabled', '');
  // setHTML caches the last markup; the appended part must not confuse the next diff
  htmlCache.delete(card);
};
document.addEventListener('click', event => {
  const ab = event.target.closest('[data-arena-ability]');
  if (ab) {
    if (arenaRun && arenaAbility(arenaRun, ab.dataset.arenaAbility)) {
      feedback('upgrade', 'medium');
      updateWaveDock();
    }
    return;
  }
  const mode = event.target.closest('[data-campaign-mode]');
  if (mode && !arenaRun && !campaignRun()) {
    campaignState().mode = mode.dataset.campaignMode === 'classic' ? 'classic' : 'arena';
    save();
    return render();
  }
  // voluntary rewarded ad (adapter only; release builds without an ad provider never show the button)
  if (event.target.closest('[data-ship-repair-ad]')) {
    runRewardedPlacement(
      'repair',
      () => {
        shipCondition().emergencyUntil = Date.now();
        shipRepairTick();
        toast('Notreparatur abgeschlossen – Hülle bei 50 %.');
      },
      () => Boolean(shipCondition().emergencyUntil)
    );
    return;
  }
  const repair = event.target.closest('[data-ship-repair]');
  if (repair) {
    const kind = repair.dataset.shipRepair,
      ok = kind === 'emergency' ? startEmergencyRepair() : repairShip(kind) > 0;
    if (ok) {
      feedback('upgrade', 'light');
      toast(kind === 'emergency' ? 'Notreparatur läuft – in 90 s ist die Hülle wieder bei 50 %.' : 'Hülle repariert: ' + Math.round((shipHullNow() / shipHullMax()) * 100) + ' %');
      save();
    }
    return render();
  }
});
// the emergency repair completes on its own (also while the app was closed — real time)
setInterval(() => {
  if (state.shipCondition && shipRepairTick()) {
    toast('Notreparatur fertig – Hülle bei 50 %.');
    save();
    render();
  }
}, 1000);

// ----- view model for the arena scene -----
// the enemy plate's bottom edge, measured only when the plate changes size (not per frame)
let arenaInset = 0;
function measureArenaInset() {
  const plate = document.querySelector('#enemyCard .hud-enemy'),
    card = document.getElementById('enemyCard');
  if (!plate || !card || !arenaRun) return;
  const r = plate.getBoundingClientRect(),
    c = card.getBoundingClientRect();
  if (r.height > 0) arenaInset = Math.round(r.bottom - c.top);
}
if ('ResizeObserver' in window) {
  const plate = document.querySelector('#enemyCard .hud-enemy');
  if (plate) new ResizeObserver(() => measureArenaInset()).observe(plate);
}
window.NebulaView.arena = () => {
  const a = arenaRun;
  return {
    arena: a,
    inset: arenaInset,
    alpha: a ? Math.min(1, a.acc / ARENA.DT) : 0,
    ship: { ...state.ship },
    dna: typeof mountedDna === 'function' ? mountedDna() : null,
    cosmeticShip: state.meta?.equipped?.ship || null,
    pilot: typeof combatPilot === 'function' ? combatPilot() : 0,
    cat: typeof catUnlocked === 'function' && catUnlocked(),
    reduced: document.body.classList.contains('reduce-motion')
  };
};

// Beta 1.7 M10 — dodge: the scene reports drags along the ship's lane; nothing moves while paused, during a story
// line, or after the result. The first drag ever retires the one-time hint.
window.addEventListener('arena-steer', event => {
  const a = arenaRun;
  if (!a || a.result || (typeof expedition !== 'undefined' && expedition.paused)) return;
  if (typeof storyDialogueOpen === 'function' && storyDialogueOpen()) return;
  if (!arenaSteer(a, Number(event.detail?.dy))) return;
  if (!state.meta.story.journal.includes('dodge-learned')) {
    state.meta.story.journal.push('dodge-learned');
    requestSave(500);
  }
  document.getElementById('expDodgeHint')?.classList.add('gone');
});
// Beta 1.6 — Fokusziel: a tap on an enemy in the arena makes it the ship's target until it falls; a second tap on the
// same enemy gives the choice back to the ship. The scene only reports where the tap landed (arena-scene.js).
window.addEventListener('arena-tap', event => {
  const a = arenaRun;
  if (!a || a.result || (typeof expedition !== 'undefined' && expedition.paused)) return;
  const foe = arenaFoeAt(a, event.detail?.x, event.detail?.y);
  if (!foe) return;
  arenaFocus(a, a.focus === foe.id ? 0 : foe.id);
  feedback('upgrade', 'light');
});
