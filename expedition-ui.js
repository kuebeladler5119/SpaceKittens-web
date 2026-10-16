// Beta 1.5 — fullscreen expeditions: every campaign fight (waves and the guardian) runs in its own screen layer above the
// app. Three states, one loop:
//   prep   — choose ship, inspect and repair its condition, pick the DNA weapon, check modules and crew, see the enemy
//            faction with every matchup and the rewards, then start
//   fight  — the arena fills the screen: top bar (planet, wave/boss, HP, phase, pause), the arena, bottom bar (hull, the
//            two abilities). Equipment is locked; no shop, no menus. The bottom navigation and all page content are hidden.
//   result — victory/defeat/retreat, rewards, damage taken, repair choices, the next objective
// The arena logic (arena.js) and its clock (arena-ui.js) are unchanged: this layer starts waves through arenaBegin(), lets
// the clock run only while the fight is on screen and not paused, and reads the outcome from arenaFinish(). Nothing here
// grants anything itself (rewards come from the campaign ledger and the guardian's own defeat function — exactly once).
// Loaded after reveal.js.

const expedition = { state: 'closed', key: null, target: 'wave', paused: false, last: null, hullStart: 0, autoAt: 0 };
const EXP_PLANET_NAME = { crystal: 'Orion', ice: 'Glacies' };
const EXP_FACTION = { crystal: { name: 'M.O.T.T.E.-Inspektion', text: 'Bürokratie-Roboter der alten Minenverwaltung: Stempeldrohnen, Formularfalter, Klemmbrett-Käfer, Messdrohnen und Siegelkreuzer. Der Glutgeist ist ein entlaufener Ofenwächter aus den stillgelegten Kristallschmieden, den die Inspektion als „Prüfmuster“ mitführt.' },
  ice: { name: 'Frostwacht', text: 'Frostbytes Frostdrohnen hüten das Wärmenetz: Frostflocken im Schwarm, Eiszapfen-Drohnen, Gletscherpanzer mit Eisplatten, Kältenebler, deren Nebel das Geschütz unterkühlt, und Eiswächter mit Frostschild. Sie glauben, Wärme würde Glacies zerstören.' }
};
const EXP_BOSS = {
  crystal: {
    name: 'P.I.P.S.',
    title: 'Wächter · Prüf-Inspektor',
    text: 'Patrouilliert in einer Acht und prüft im Takt: drei gezielte Prüfbolzen, dann sein Prüfschild (nur 20 % Schaden) und ein angekündigter Prüfstempel – die rote Linie zeigt, wohin er fliegt. Bei halber Hülle ruft er zwei Stempeldrohnen.',
    counter: 'Overcharge-Salve bricht das Prüfschild für 2,5 s. Schildpuls fängt den Prüfstempel ab.',
    reward: '1.500 ◈ · 3 Kristalle · 5 Gems · P.I.P.S.-Kernmodul (einmalig)'
  },
  ice: {
    name: 'Frostbyte',
    title: 'Wächter · Hüter des Wärmenetzes',
    text: 'Drei Kristallplatten schlucken 85 % jedes Treffers. Er wirft gezielte Eiszapfen und kündigt seinen Frostatem mit einer blauen Linie an: fünf langsame Frostkugeln, die das Geschütz unterkühlen. Bei halber Hülle ruft er drei Frostflocken.',
    counter: 'Jeder Treffer während der Salve bricht eine Platte – ohne Platten taut er 6 s auf und nimmt 150 %. Schildpuls fängt den Frostatem ab.',
    reward: '4.000 ◈ · 5 Kristalle · 8 Gems · 1 Talent-Kapsel (einmalig)'
  }
};
// Beta 1.5: every guardian of an arena campaign — the stage that means "waiting for the kittens", the stages from which
// he can be fought, his own one-time defeat function and his story beats
const EXP_GUARDIANS = {
  pips: { wait: 'warned', ready: ['warned', 'battle'], defeat: () => defeatPips(), arrives: 'pips-arrives', story: 'pips-arena', phase2: 'pips-arena-phase2', after: 'P.I.P.S. reparieren – Tikki rettet seine Software (Erz und Kristalle).' },
  frostbyte: { wait: 'drones', ready: ['drones', 'battle'], defeat: () => defeatFrostbyte(), arrives: 'fb-arrives', story: 'fb-arena', phase2: 'fb-arena-phase2', after: 'Frostbyte neu kalibrieren – Thermalzellen, Frostquarz und Erz auf Glacies.', notYet: 'Frostbyte stellt sich, sobald das Wärmenetz läuft.' }
};
// story lines for the arena boss (the classic lines spoke of the Zielmodus; here the Salve breaks the shield)
if (typeof STORY !== 'undefined') {
  STORY['pips-arena'] = {
    title: 'P.I.P.S. in der Arena',
    lines: [
      ['pips', 'Prüfung Stufe drei! Bitte bleiben Sie in Ihrer Spur, während ich Sie abstemple.'],
      ['boba', 'Sein Prüfschild hält nur, bis unsere Salve einschlägt. Und wenn die rote Linie erscheint: Schild hoch!']
    ]
  };
  STORY['pips-arena-phase2'] = {
    title: 'Formular 99-B',
    lines: [['pips', 'Formular 99-B: Verstärkung angefordert! Zwei Prüfdrohnen, sofort!']]
  };
  STORY['fb-arena'] = {
    title: 'Frostbyte in der Arena',
    lines: [
      ['frostbyte', 'Ich … ich muss den Planeten schützen! Kristallpanzer aktiviert!'],
      ['boba', 'Drei Kristallplatten. Die Salve macht Hitze – jeder Treffer damit bricht eine. Und bei der blauen Linie: Schild hoch!']
    ]
  };
  STORY['fb-arena-phase2'] = {
    title: 'Schneesturm',
    lines: [['frostbyte', 'Frostflocken! Helft mir, bitte – sie dürfen das Wärmenetz nicht anfassen!']]
  };
  STORY['glacies-campaign'] = {
    title: 'Die Frostwacht',
    lines: [
      ['flocke', 'Das Wärmenetz läuft – und Frostbytes Frostdrohnen rücken aus. Neun Wachen stehen zwischen uns und ihm.'],
      ['mochi', 'Dann fliegen wir eine Expedition nach der anderen. Abenteuer-Tab, hier auf Glacies!']
    ]
  };
}

function classicAllowed() {
  // the classic wave engine stays for development and regression tests only (never for players)
  return Boolean(window.NEBULA_CONFIG?.devTools);
}
campaignMode = () => (state.meta?.campaign?.mode === 'classic' && classicAllowed() ? 'classic' : 'arena');

// the guardian's display name for its arena kind (pips → P.I.P.S.)
function expBossName(kind) {
  const key = Object.keys(ARENA_BOSSES).find(k => ARENA_BOSSES[k].kind === kind);
  return key ? EXP_BOSS[key]?.name || null : null;
}
function expPlanet(key) {
  return EXP_PLANET_NAME[key] || PLANETS[CAMPAIGNS[key]?.planet]?.name || '';
}
function expBossReady(key) {
  const c = CAMPAIGNS[key],
    gd = c && EXP_GUARDIANS[c.guardian];
  return Boolean(c && gd && campaignComplete(key) && gd.ready.includes(state.meta.guardians?.[c.guardian]?.stage) && ARENA_BOSSES[key]);
}
function expTargetName() {
  const key = expedition.key;
  if (expedition.target === 'boss') return 'Wächter: ' + EXP_BOSS[key].name;
  const wave = campaignCleared(key);
  return 'Welle ' + (wave + 1) + '/' + CAMPAIGNS[key].waves.length + ' · ' + CAMPAIGNS[key].waves[Math.min(wave, CAMPAIGNS[key].waves.length - 1)].name;
}
function expBlocked() {
  const key = expedition.key;
  if (!key) return 'Kein Feldzug';
  if (expedition.target === 'boss') {
    if (!expBossReady(key)) return 'Der Wächter ist nicht bereit';
    if (shipCondition().emergencyUntil) return 'Notreparatur läuft noch';
    if (shipHullNow() <= 0) return 'Schiff kampfunfähig – erst reparieren (Notreparatur ist kostenlos)';
    if (campaignRunning()) return 'Eine Welle läuft bereits';
    return null;
  }
  return arenaBlocked(key);
}

// ----- open / close -----
function setExpeditionState(next) {
  expedition.state = next;
  const on = next !== 'closed';
  document.body.classList.toggle('expedition-on', on);
  const root = $('expedition');
  if (root) {
    root.hidden = !on;
    root.dataset.state = next;
  }
  if (on) renderExpedition();
  // the arena canvas starts/stops with the fight layer
  const m = window.NebulaScenesRuntime?.mounted;
  setTimeout(() => (m?.arena?.handle.refresh?.(), Object.values(m || {}).forEach(x => x.handle.refresh?.())), 0);
}
function openExpedition(key = campaignKeyFor(), target = null) {
  if (!key || !CAMPAIGNS[key] || !campaignOpen(key)) return false;
  if (arenaRun) return setExpeditionState('fight'), true;
  expedition.key = key;
  expedition.target = target || (expBossReady(key) ? 'boss' : 'wave');
  if (expedition.target === 'wave' && campaignComplete(key)) return false;
  expedition.paused = false;
  setExpeditionState('prep');
  $('expedition')?.querySelector('.exp-prep')?.scrollTo?.(0, 0);
  return true;
}
function closeExpedition() {
  if (arenaRun) return; // a running fight is left through the pause menu (retreat)
  expedition.autoAt = 0;
  setExpeditionState('closed');
  showScreen('battle');
  render();
  setTimeout(() => $('campaignCard')?.scrollIntoView?.({ block: 'center', behavior: 'auto' }), 0);
}
function startExpedition() {
  const blocked = expBlocked();
  if (blocked) return toast(blocked), false;
  expedition.hullStart = shipHullNow();
  expedition.paused = false;
  const ok = expedition.target === 'boss' ? arenaBeginBoss(expedition.key) : arenaBegin(expedition.key);
  if (ok) setExpeditionState('fight');
  return ok;
}
// every arena start ends up in the fullscreen layer (also starts from older code paths)
const arenaBeginBeforeExpedition = arenaBegin;
arenaBegin = (key, now = Date.now()) => {
  if (!expedition.key) expedition.key = key;
  expedition.hullStart = shipHullNow();
  const ok = arenaBeginBeforeExpedition(key, now);
  if (ok) {
    expedition.target = 'wave';
    if (expedition.state !== 'fight') setExpeditionState('fight');
  }
  return ok;
};
// The guardian fight in the arena: the stage moves to 'battle' only when he is beaten (then his own defeat function pays,
// exactly once); a lost or abandoned attempt leaves him waiting ('warned') — no classic fight can be started meanwhile.
function arenaBeginBoss(key, now = Date.now()) {
  if (!expBossReady(key) || arenaRun) return false;
  const cs = campaignState(),
    gd = EXP_GUARDIANS[CAMPAIGNS[key].guardian],
    g = state.meta.guardians[CAMPAIGNS[key].guardian];
  if (g.stage === 'battle') g.stage = gd.wait;
  arenaRun = arenaCreate(key, 'boss', (cs.bossTries = (cs.bossTries || 0) + 1), shipHullNow(), shipHullMax());
  arenaLast = 0;
  arenaSeen = 0;
  campaignDefeat = null;
  feedback('unlock', 'light');
  GameEvents.emit('wave-start', { key, wave: 'boss', arena: true });
  if (typeof storyEvent === 'function') {
    if (!state.meta.story.journal.includes(gd.arrives)) state.meta.story.journal.push(gd.arrives);
    storyEvent(gd.story);
  }
  save();
  render();
  arenaLoop();
  return true;
}

// ----- the arena clock runs only while the fight layer is shown and not paused -----
arenaShouldRun = () => Boolean(arenaRun) && expedition.state === 'fight' && !expedition.paused && !document.hidden && !(typeof storyDialogueOpen === 'function' && storyDialogueOpen());
const arenaReactBeforeExpedition = arenaReact;
arenaReact = () => {
  const a = arenaRun;
  if (a?.boss && a.events.some(e => e.type === 'boss-phase' && e.seq > arenaSeen) && typeof storyEvent === 'function') storyEvent(EXP_GUARDIANS[CAMPAIGNS[a.key].guardian]?.phase2 || 'pips-arena-phase2');
  arenaReactBeforeExpedition();
  if (expedition.state === 'fight') renderExpeditionHud();
};
// outcome: waves through the campaign ledger (arena-ui.js); the boss through the guardian's own defeat
const arenaFinishBeforeExpedition = arenaFinish;
arenaFinish = (won, now = Date.now(), opts = {}) => {
  const a = arenaRun;
  if (!a) return false;
  const before = { credits: state.credits, crystals: state.crystals, gems: state.gems, chests: arenaChestCount(), dna: state.meta.dna.owned.length };
  let first = false;
  if (a.boss) {
    arenaSyncHull();
    arenaRun = null;
    const gd = EXP_GUARDIANS[CAMPAIGNS[a.key].guardian],
      g = state.meta.guardians[CAMPAIGNS[a.key].guardian];
    // the guardian's own defeat function pays, exactly once (it needs the 'battle' stage and leaves it at once)
    if (won && gd && g.stage === gd.wait) {
      g.stage = 'battle';
      gd.defeat();
      first = true;
    }
    campaignDefeat = !won && !opts.abort ? arenaAnalysis(a, opts.reason || a.result?.reason) : null;
    save();
    render();
  } else {
    arenaFinishBeforeExpedition(won, now, opts);
    first = Boolean(won && campaignState().claims.includes('wave:' + a.key + ':' + a.wave) && state.credits > before.credits);
  }
  campaignNextAt = 0; // the result screen decides what comes next
  expedition.last = {
    won,
    abort: Boolean(opts.abort),
    boss: a.boss,
    wave: a.wave,
    key: a.key,
    stats: { ...a.stats, seconds: Math.round(a.t) },
    hullStart: expedition.hullStart,
    hullEnd: shipHullNow(),
    hullMax: shipHullMax(),
    gained: { credits: Math.max(0, state.credits - before.credits), crystals: Math.max(0, state.crystals - before.crystals), gems: Math.max(0, state.gems - before.gems), chests: Math.max(0, arenaChestCount() - before.chests), dna: Math.max(0, state.meta.dna.owned.length - before.dna) },
    first,
    analysis: campaignDefeat
  };
  expedition.paused = false;
  setExpeditionState('result');
  if (won && !a.boss && campaignState().auto && expNextTarget() === 'wave' && shipHullNow() > shipHullMax() * 0.25) expedition.autoAt = Date.now() + 3500;
  return true;
};
function arenaChestCount() {
  const ar = state.meta.arsenal;
  return ar ? (ar.chests || 0) + (ar.chestsElite || 0) + (ar.chestsRelic || 0) : 0;
}
function expNextTarget() {
  const key = expedition.key;
  if (!key) return null;
  if (!campaignComplete(key)) return 'wave';
  return expBossReady(key) ? 'boss' : null;
}

// ----- markup -----
function expShipHTML() {
  const Art = window.NebulaArt,
    pilot = window.SpaceKittens?.ROSTER?.[combatPilot()],
    url = Art?.shipPreviewURL ? Art.shipPreviewURL(state.ship.model, state.ship, shipPalette(), pilot, 480, 220) : '',
    owned = Object.keys(state.ship.models).filter(m => state.ship.models[m]);
  return `<section class="exp-block"><h3>Schiff</h3>${url ? `<img class="exp-ship" src="${url}" alt="Dein Schiff" />` : ''}${
    owned.length > 1 ? `<div class="exp-chips" role="radiogroup" aria-label="Schiffsmodell">${owned.map(m => `<button role="radio" aria-checked="${m === state.ship.model}" class="${m === state.ship.model ? 'active' : ''}" data-exp-model="${m}">${m}</button>`).join('')}</div>` : ''
  }<p class="exp-facts"><span>⚔ ${fmt(arenaLoadout().shot * arenaLoadout().stats.damage)} je Treffer</span><span>➤ ${arenaLoadout().rate.toFixed(1).replace('.', ',')} Schuss/s</span><span>🛡 ${fmt(shipHullMax())} Hülle</span></p></section>`;
}
function expWeaponHTML() {
  const d = state.meta.dna,
    weaponAff = WEAPON_AFFINITY[state.ship.weaponType];
  return `<section class="exp-block"><h3>DNA-Waffe</h3><div class="exp-weapons">${d.owned
    .map(w => `<button class="exp-weapon ${w.uid === d.mount ? 'active' : ''}" ${w.uid === d.mount ? 'aria-pressed="true"' : `data-dna-mount="${w.uid}"`}><b>${dnaLabel(w)}</b>${dnaAffinityChip(w.affinity)}<small>${ARSENAL_RARITY_NAME[w.rarity] || w.rarity} · ${DNA_CHASSIS[w.chassis]?.text || ''}</small></button>`)
    .join('')}<button class="exp-weapon ${d.mount ? '' : 'active'}" ${d.mount ? 'data-dna-unmount' : 'aria-pressed="true"'}><b>Bordgeschütz (${state.ship.weaponType})</b>${dnaAffinityChip(weaponAff)}<small>ohne DNA-Waffe · Werte des Waffensystems</small></button></div></section>`;
}
function expModulesHTML() {
  const a = state.meta.arsenal,
    slots = ARSENAL_SLOTS.filter(s => ARSENAL_SLOT_INFO[s].owner !== 'cat' || (typeof catUnlocked === 'function' && catUnlocked()));
  return `<section class="exp-block"><h3>Module</h3><ul class="exp-modules">${slots
    .map(s => {
      const id = a.loadout[s],
        item = id && ARSENAL_BY_ID[id];
      return `<li><i aria-hidden="true">${item ? item.icon : ARSENAL_SLOT_INFO[s].icon}</i><span><b>${item ? item.name : 'leer'}</b><small>${ARSENAL_SLOT_INFO[s].name}${item ? ' · Lv ' + (a.items[id]?.level || 1) : ''}</small></span></li>`;
    })
    .join('')}</ul><button class="exp-secondary" data-arsenal-open>ARSENAL ÖFFNEN</button></section>`;
}
function expCrewHTML() {
  const boba = state.crew[1],
    slotsFree = state.crewActive.length < state.crewSlots;
  return `<section class="exp-block"><h3>Kampf-Kätzchen</h3><ul class="exp-crew"><li><b>Mochi</b><small>Pilotin – immer an Bord</small></li>${
    boba?.unlocked
      ? `<li><b>Boba</b><small>${crewActive(1) ? 'fliegt mit: +25 % Feuerrate, 20 % weniger Schaden' : 'nicht im Dienst'}</small><button class="exp-secondary" data-exp-crew="1" ${!crewActive(1) && !slotsFree ? 'disabled' : ''}>${crewActive(1) ? 'ABBERUFEN' : 'EINSETZEN'}</button></li>`
      : '<li><b>Boba</b><small>noch nicht in der Crew (Kätzchen-Tab)</small></li>'
  }<li><b>Tikki</b><small>${typeof catUnlocked === 'function' && catUnlocked() ? 'fliegt im Funkengleiter mit (Bolzen alle 3 s)' : 'kommt nach der Reparatur von P.I.P.S.'}</small></li></ul></section>`;
}
function expEnemyHTML() {
  const key = expedition.key,
    f = EXP_FACTION[key],
    L = arenaLoadout();
  if (expedition.target === 'boss') {
    const b = EXP_BOSS[key],
      d = enemyDna(ARENA_BOSSES[key].kind),
      factor = arenaAffinity(L, d.affinity);
    return `<section class="exp-block"><h3>Gegner · ${f?.name || ''}</h3><div class="exp-boss">${window.EnemyArt?.portraitURL ? '' : ''}<b>${b.name}</b><small>${b.title} · ${DNA_AFFINITIES[d.affinity].icon} ${DNA_AFFINITIES[d.affinity].short}${factor > 1 ? ' – deine Waffe trifft stark ✓' : factor < 1 ? ' – deine Waffe trifft schwach' : ''}</small><p>${b.text}</p><p class="exp-counter">Konter: ${b.counter}</p></div></section>`;
  }
  return `<section class="exp-block"><h3>Gegner · ${f?.name || ''}</h3><p class="exp-note">${f?.text || ''}</p><ul class="wave-foes exp-foes">${waveFoesHTML(key, campaignCleared(key))}</ul></section>`;
}
function expMatchHTML() {
  const key = expedition.key,
    L = arenaLoadout(),
    kinds = expedition.target === 'boss' ? [ARENA_BOSSES[key].kind] : [...new Set(arenaWaveFoes(key, campaignCleared(key)))],
    strong = kinds.filter(k => arenaAffinity(L, enemyDna(k).affinity) > 1),
    weak = kinds.filter(k => arenaAffinity(L, enemyDna(k).affinity) < 1),
    name = k => CAMPAIGN_ENEMIES[k]?.name || expBossName(k) || k;
  return `<section class="exp-block exp-match"><h3>Stärken &amp; Schwächen</h3><p>${dnaAffinityChip(L.affinity)} ${L.chassis ? DNA_CHASSIS[L.chassis].name : 'Bordgeschütz'}${strong.length ? ` · <span class="good">stark gegen ${strong.map(name).join(', ')}</span>` : ''}${weak.length ? ` · <span class="warn">schwach gegen ${weak.map(name).join(', ')}</span>` : ''}${!strong.length && !weak.length ? ' · neutral gegen alle Gegner dieser Welle' : ''}</p>${expChassisNote(kinds, L)}</section>`;
}
// Beta 1.5: what the weapon family means against this target (armour, a single guardian, range)
function expChassisNote(kinds, L) {
  const notes = [],
    armored = kinds.some(k => CAMPAIGN_ENEMIES[k]?.armor),
    pierce = L.armorPierce ?? 0.5;
  if (armored && pierce < 0.5) notes.push(`<span class="warn">Panzerung: nur ${Math.round(pierce * 100)} % deiner Treffer gehen durch – Salve oder eine schwere Waffe hilft</span>`);
  else if (armored && pierce > 0.5) notes.push(`<span class="good">Panzerung: ${Math.round(pierce * 100)} % deiner Treffer gehen durch</span>`);
  if (expedition.target === 'boss' && L.chassis === 'prism') notes.push('<span class="warn">Das Prisma teilt sich auf drei Ziele – gegen einen einzelnen Wächter verpufft viel davon</span>');
  if (L.chassis === 'scatter') notes.push('Streuer: aus der Nähe ×1,5, auf große Distanz schwächer');
  return notes.length ? '<p class="exp-chassis">' + notes.join(' · ') + '</p>' : '';
}
function expRewardHTML() {
  const key = expedition.key;
  if (expedition.target === 'boss') return `<section class="exp-block"><h3>Belohnung</h3><p>${EXP_BOSS[key].reward}</p></section>`;
  const wave = campaignCleared(key),
    dna = DNA_WAVE_REWARDS[key]?.[wave];
  return `<section class="exp-block"><h3>Belohnung</h3><p>${waveRewardText(key, wave)}${dna && !state.meta.dna.claims.includes('wave:' + key + ':' + wave) ? ` · DNA-Waffe (${ARSENAL_RARITY_NAME[dna]})` : ''}</p></section>`;
}
function renderExpeditionPrep() {
  const box = $('expPrep');
  if (!box) return;
  const blocked = expBlocked();
  setHTML(
    box,
    `<header class="exp-head"><button class="exp-back" data-exp-close aria-label="Zurück zur Basis">←</button><div><small>EXPEDITION · ${expPlanet(expedition.key).toUpperCase()}</small><b>${expTargetName()}</b></div></header>
    <div class="exp-scroll">${expShipHTML()}<section class="exp-block"><h3>Zustand</h3>${shipConditionHTML()}</section>${expWeaponHTML()}${expMatchHTML()}${expEnemyHTML()}${expModulesHTML()}<section class="exp-block"><h3>Ausbau</h3>${refitsHTML()}</section>${expCrewHTML()}${expRewardHTML()}</div>
    <footer class="exp-go">${blocked ? `<p class="exp-blocked">${blocked}</p>` : ''}<button class="exp-start" data-exp-start ${blocked ? 'disabled' : ''}>${expedition.target === 'boss' ? 'WÄCHTER HERAUSFORDERN' : 'EXPEDITION STARTEN'}</button></footer>`
  );
}
function renderExpeditionHud() {
  const a = arenaRun;
  if (!a) return;
  const top = $('expTop'),
    bottom = $('expBottom');
  if (top) {
    let hp, max, label;
    const boss = a.boss && a.foes.find(f => f.family === 'boss');
    if (a.boss) {
      max = boss ? boss.maxHp : 1;
      hp = boss ? boss.hp : 0;
      label =
        (boss?.phase2 ? 'Phase 2 · ' : '') +
        (boss?.kind === 'frostbyte' ? (boss.plates > 0 ? '❄ Kristallplatten ' + boss.plates + '/3' : boss.t < boss.thawUntil ? '🔥 aufgetaut – 150 %' : 'verwundbar') : boss?.shieldOn ? '🛡 Prüfschild' : 'verwundbar');
    } else {
      max = a.queue.reduce((sum, kind) => sum + arenaFoeStats(kind, a.key, a.wave).hp, 0);
      hp = Math.max(0, max - a.stats.dealt);
      label = a.queue.length - a.spawned + a.foes.length + ' Gegner übrig';
    }
    setHTML(
      top,
      `<div class="exp-title"><small>${expPlanet(a.key).toUpperCase()} · ${a.boss ? 'WÄCHTER' : 'WELLE ' + (a.wave + 1) + '/' + CAMPAIGNS[a.key].waves.length}</small><b>${a.boss ? EXP_BOSS[a.key].name : CAMPAIGNS[a.key].waves[a.wave].name}</b></div><button class="exp-pause" data-exp-pause aria-label="Pause">⏸</button><div class="exp-hp ${a.boss ? 'boss' : ''}" role="progressbar" aria-valuemin="0" aria-valuemax="${Math.round(max)}" aria-valuenow="${Math.round(hp)}"><i style="width:${((hp / Math.max(1, max)) * 100).toFixed(1)}%"></i><span>${fmt(hp)} / ${fmt(max)}</span></div><small class="exp-phase">${label}</small>`
    );
  }
  if (bottom) {
    const pct = Math.round((a.ship.hull / Math.max(1, a.ship.hullMax)) * 100),
      ability = id => {
        const ab = ARENA_ABILITIES[id],
          wait = Math.max(0, a.ship.ready[id] - a.t),
          on = id === 'shield' ? a.t < a.ship.shieldUntil : a.t < a.ship.salvoUntil;
        return `<button class="exp-ability ${on ? 'on' : ''}" data-arena-ability="${id}" ${wait > 0 ? 'disabled' : ''} aria-label="${ab.name}: ${ab.text}"><i aria-hidden="true">${ab.icon}</i><b>${ab.short}</b><small>${on ? 'aktiv' : wait > 0 ? Math.ceil(wait) + ' s' : 'bereit'}</small><u style="width:${on ? 100 : Math.round((1 - wait / ab.cooldown) * 100)}%"></u></button>`;
      };
    setHTML(bottom, `<div class="exp-hull ${pct <= 30 ? 'low' : ''}"><small>🛡 Hülle</small><i><u style="width:${pct}%"></u></i><b>${fmt(a.ship.hull)}</b></div><div class="exp-abilities">${ability('shield')}${ability('salvo')}</div>`);
  }
}
function expResultHTML() {
  const r = expedition.last;
  if (!r) return '';
  const lost = Math.max(0, r.hullStart - r.hullEnd),
    pct = Math.round((r.hullEnd / Math.max(1, r.hullMax)) * 100),
    g = r.gained,
    headline = r.won ? (r.boss ? 'Wächter besiegt!' : 'Welle geschafft!') : r.abort ? 'Rückzug' : 'Niederlage',
    name = r.boss ? EXP_BOSS[r.key].name : CAMPAIGNS[r.key].waves[r.wave]?.name || '',
    rewards = [g.credits && '+' + fmt(g.credits) + ' ◈', g.crystals && '+' + g.crystals + ' Kristall' + (g.crystals > 1 ? 'e' : ''), g.gems && '+' + g.gems + ' Gems', g.chests && '+' + g.chests + ' Kiste' + (g.chests > 1 ? 'n' : ''), g.dna && '+' + g.dna + ' DNA-Waffe'].filter(Boolean),
    next = expNextTarget(),
    gdef = EXP_GUARDIANS[CAMPAIGNS[r.key].guardian],
    gstage = state.meta.guardians?.[CAMPAIGNS[r.key].guardian]?.stage,
    objective = r.won && r.boss ? gdef?.after || '' : next === 'boss' ? 'Alle Wellen geschafft: der Wächter ' + (EXP_BOSS[r.key]?.name || '') + ' wartet.' : next === 'wave' ? 'Nächstes Ziel: ' + expTargetName() : gdef?.notYet && !['defeated', 'repaired'].includes(gstage) ? 'Alle Wellen geschafft. ' + gdef.notYet : 'Feldzug abgeschlossen.';
  return `<div class="exp-result-card ${r.won ? 'won' : 'lost'}"><small>${expPlanet(r.key).toUpperCase()} · ${r.boss ? 'WÄCHTER' : 'WELLE ' + (r.wave + 1)}</small><h2>${headline}</h2><b>${name}</b>
    <p class="exp-facts"><span>⚔ ${r.stats.kills} besiegt</span><span>⏱ ${r.stats.seconds} s</span><span>${r.stats.abilities} Fähigkeit${r.stats.abilities === 1 ? '' : 'en'}</span></p>
    ${rewards.length ? `<p class="exp-rewards">${rewards.join(' · ')}${r.first ? ' · Erstabschluss' : ''}</p>` : r.won ? '<p class="exp-rewards">Schon einmal geschafft – keine zweite Belohnung.</p>' : '<p class="exp-rewards">Nichts gewonnen, nichts verloren außer Hülle. Die Welle wartet.</p>'}
    <div class="exp-damage"><small>Hülle ${fmt(r.hullStart)} → ${fmt(r.hullEnd)} (−${fmt(lost)}) · ${pct} %</small><i><u style="width:${pct}%"></u></i></div>
    ${r.analysis ? defeatHTML(r.analysis) : ''}
    ${shipCondition().damage > 0 ? shipConditionHTML() : ''}
    <p class="exp-objective">${objective}</p>
    ${expedition.autoAt ? `<p class="exp-auto">Nächste Welle startet gleich … <button class="exp-secondary" data-exp-auto-stop>ANHALTEN</button></p>` : ''}
    <div class="exp-result-actions">${next ? `<button class="exp-start" data-exp-next>${next === 'boss' ? 'ZUM WÄCHTER' : 'NÄCHSTE WELLE'}</button>` : ''}<button class="exp-secondary" data-exp-close>ZUR BASIS</button></div></div>`;
}
function renderExpedition() {
  if (expedition.state === 'prep') renderExpeditionPrep();
  else if (expedition.state === 'fight') {
    renderExpeditionHud();
    $('expPauseMenu').hidden = !expedition.paused;
  } else if (expedition.state === 'result') setHTML($('expResult'), expResultHTML());
}

// ----- events -----
// links that lead into the app (shipyard tips, tabs) close the expedition layer first (not during a fight)
document.addEventListener(
  'click',
  event => {
    if (expedition.state !== 'closed' && !arenaRun && event.target.closest('[data-campaign-workshop], [data-screen]')) setExpeditionState('closed');
  },
  true
);
document.addEventListener('click', event => {
  const t = event.target;
  if (expedition.state === 'closed') return;
  if (t.closest('[data-exp-close]')) return closeExpedition();
  if (t.closest('[data-exp-start]')) return startExpedition();
  if (t.closest('[data-exp-next]')) {
    expedition.autoAt = 0;
    return openExpedition(expedition.key, expNextTarget());
  }
  if (t.closest('[data-exp-auto-stop]')) {
    expedition.autoAt = 0;
    return renderExpedition();
  }
  const model = t.closest('[data-exp-model]');
  if (model && state.ship.models[model.dataset.expModel] && !arenaRun) {
    state.ship.model = model.dataset.expModel;
    save();
    return render();
  }
  const crew = t.closest('[data-exp-crew]');
  if (crew && !arenaRun) {
    const i = +crew.dataset.expCrew;
    if (crewActive(i)) state.crewActive = state.crewActive.filter(x => x !== i);
    else if (state.crew[i]?.unlocked && state.crewActive.length < state.crewSlots) state.crewActive.push(i);
    save();
    return render();
  }
  if (t.closest('[data-exp-pause]')) {
    expedition.paused = true;
    return renderExpedition();
  }
  if (t.closest('[data-exp-resume]')) {
    expedition.paused = false;
    arenaLast = 0;
    return renderExpedition();
  }
  if (t.closest('[data-exp-retreat]')) {
    expedition.paused = false;
    return campaignFinish(false, Date.now(), { abort: true });
  }
});
// leaving the app pauses the fight (and it stays paused until the player resumes)
document.addEventListener('visibilitychange', () => {
  if (document.hidden && expedition.state === 'fight' && arenaRun) {
    expedition.paused = true;
    renderExpedition();
  }
});
// the result screen's optional automatic continue (only after a won wave with enough hull; any tap on ANHALTEN stops it)
setInterval(() => {
  if (expedition.state === 'result' && expedition.autoAt && Date.now() >= expedition.autoAt) {
    expedition.autoAt = 0;
    if (openExpedition(expedition.key, 'wave')) startExpedition();
  }
}, 500);

// ----- the campaign card opens the expedition (no fight inside the card any more) -----
const campaignBeginBeforeExpedition = campaignBegin;
campaignBegin = (key, now = Date.now()) => (campaignMode() === 'arena' ? openExpedition(key, 'wave') : campaignBeginBeforeExpedition(key, now));
document.addEventListener(
  'click',
  event => {
    const challenge = event.target.closest('[data-campaign-guardian]');
    if (!challenge || campaignMode() !== 'arena') return;
    event.stopPropagation();
    openExpedition(challenge.dataset.campaignGuardian, 'boss');
  },
  true
);
const renderCampaignCardBeforeExpedition = renderCampaignCard;
renderCampaignCard = () => {
  renderCampaignCardBeforeExpedition();
  const card = $('campaignCard');
  if (!card || card.hidden || campaignMode() !== 'arena') return;
  card.querySelector('.arena-mode')?.remove(); // the classic mode is not offered to players
  const start = card.querySelector('[data-campaign-start]');
  if (start) {
    start.textContent = 'EXPEDITION VORBEREITEN';
    start.removeAttribute('disabled');
  }
  const guardian = card.querySelector('[data-campaign-guardian]');
  if (guardian) guardian.textContent = 'WÄCHTER-EXPEDITION';
  htmlCache.delete(card);
};
// Saves from before Beta 1.5: a P.I.P.S. fight that was running in the old boss screen continues as the arena guardian
// fight (he waits, nothing is lost); a classic wave that was running restarts as an arena wave (it was never paid).
function expeditionSync() {
  if (campaignMode() !== 'arena' || !state.meta?.campaign) return;
  const cs = campaignState();
  if (cs.run) cs.run = null;
  const p = state.meta.guardians?.pips;
  if (p?.stage === 'battle' && campaignComplete('crystal') && CAMPAIGN_FLAGS.crystal && !arenaRun) p.stage = 'warned';
  // a classic Frostbyte fight of an older save continues as the arena guardian (his campaign counts as done)
  const fb = state.meta.guardians?.frostbyte;
  if (fb?.stage === 'battle' && campaignComplete('ice') && CAMPAIGN_FLAGS.ice && !arenaRun) fb.stage = 'drones';
}
expeditionSync();
const renderBeforeExpedition = render;
render = () => {
  renderBeforeExpedition();
  if (expedition.state === 'prep' || expedition.state === 'result') renderExpedition();
};
window.NebulaView.arena = (base => () => ({ ...base(), inset: 0, planet: arenaRun?.key || expedition.key || 'crystal' }))(window.NebulaView.arena);
// the Beta-1.4 in-card wave dock and enemy plate are not used by the fullscreen layer (no hidden duplicate buttons,
// no work for invisible DOM)
const updateWaveDockBeforeExpedition = updateWaveDock;
updateWaveDock = () => {
  if (arenaRun || expedition.state !== 'closed') {
    const dock = $('waveDock');
    if (dock && !dock.hidden) dock.hidden = true;
    document.body.classList.remove('arena-on', 'wave-active');
    return;
  }
  updateWaveDockBeforeExpedition();
};
arenaPlate = () => {};
// While the expedition layer is open (prep, fight or result) the classic battle screen behind it is not on screen: its gun,
// Boba's background fire and Tikki's classic strikes hold (they used to keep fighting the ladder unseen).
const gunOwnsShotsBeforeExpedition = gunOwnsShots;
gunOwnsShots = () => expedition.state === 'closed' && gunOwnsShotsBeforeExpedition();
const catInFightBeforeExpedition = catInFight;
catInFight = () => expedition.state === 'closed' && catInFightBeforeExpedition();

// ----- Beta 1.5 P1: ship refits from the Fertigung (logic: arena.js SHIP_REFITS) -----
// Shown in the Werft and in the expedition prep. Goods come from the colony you are visiting; each refit names its drawback.
function refitCostHTML(id) {
  const cost = refitCost(id),
    missing = refitMissing(id) || {};
  if (!cost) return '<small class="refit-cost">voll ausgebaut</small>';
  return `<small class="refit-cost">${Object.entries(cost)
    .map(([good, n]) => {
      const label = good === 'credits' ? '◈ ' + fmt(n) : (GOODS[good]?.icon || '') + ' ' + n + ' ' + (GOODS[good]?.name || good);
      return `<span class="${missing[good] ? 'missing' : 'have'}">${label}</span>`;
    })
    .join(' · ')}</small>`;
}
function refitsHTML() {
  const fighting = typeof arenaActive === 'function' && arenaActive();
  return `<p class="refit-intro">Ausbau mit Waren aus der Fertigung von ${PLANETS[state.activePlanet]?.name || 'dieser Kolonie'} – jeder Ausbau ist am Schiff sichtbar.</p><ul class="ship-refit-list">${Object.entries(SHIP_REFITS)
    .map(([id, r]) => {
      const lvl = refitLevel(id),
        missing = refitMissing(id),
        ready = missing && !Object.keys(missing).length && !fighting;
      return `<li class="refit-row" data-refit-row="${id}"><i aria-hidden="true">${r.icon}</i><span><b>${r.name} <em>${lvl}/${r.max}</em></b><small>Jetzt: ${r.effect(lvl)}${lvl < r.max ? ' → ' + r.effect(lvl + 1) : ''}</small>${refitCostHTML(id)}</span>${lvl < r.max ? `<button class="exp-secondary" data-refit="${id}" ${ready ? '' : 'disabled'}>AUSBAUEN</button>` : ''}</li>`;
    })
    .join('')}</ul>`;
}
let refitSignature = '';
function renderShipRefits(force = false) {
  const el = $('shipRefits');
  if (!el || (currentScreen() !== 'battle' && !force)) return;
  const sig = state.activePlanet + ':' + Object.keys(SHIP_REFITS).map(id => refitLevel(id) + (refitMissing(id) ? Object.keys(refitMissing(id)).join('') : 'x')).join('|');
  if (!force && sig === refitSignature) return;
  refitSignature = sig;
  el.innerHTML = refitsHTML();
}
const renderBeforeRefits = render;
render = () => {
  renderBeforeRefits();
  renderShipRefits();
};
document.addEventListener('click', event => {
  const b = event.target.closest('[data-refit]');
  if (!b) return;
  const id = b.dataset.refit;
  if (!refitShip(id)) return toast('Ausbau nicht möglich – Waren oder Credits fehlen.');
  save(); // paid goods and the new level are on disk together
  feedback('upgrade', 'success');
  toast(SHIP_REFITS[id].name + ' Stufe ' + refitLevel(id) + ': ' + SHIP_REFITS[id].effect(refitLevel(id)));
  renderShipRefits(true);
  render();
});
renderShipRefits(true);
