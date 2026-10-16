// Mekhanos chapter (session 9): "Das letzte Freigabeprotokoll" — Cogsworth-9's story with Mochi and Void, the
// Freigabeschein-Archiv (real Präzisionsbauteile), Inspektor-Drohnen, the Taktband boss, his repair and the UI hooks.
// State lives in state.meta.guardians.cogsworth (mekhanos.js). Loaded after pyra-ui.js (wraps the battle button
// after P.I.P.S., Frostbyte and Emberbell, who keep priority).
//
// Boss mechanic — Taktband (distinct from P.I.P.S.' shield, Frostbyte's ice plates and Emberbell's heat pressure):
//   inspect   "Prüfung läuft": inspection shield, 35 % damage; the next test part is announced in advance
//   window    "Prüfungsfenster" (5 s): Cogsworth shows Zahnrad, Bolzen or Feder — press the matching part
//   open      correct → "Wartungsklappe offen" (6 s): 200 % damage; one violation is forgiven
//   violation wrong → "Regelverstoß" (3 s): 20 % damage, +1 violation (max 3): the next inspection comes 1 s sooner
//   a missed window simply returns to the inspection (no penalty — auto-battle keeps working at 35 %)

const TB = { inspect: 6000, perViolation: 1000, inspectMin: 3000, window: 5000, open: 6000, violation: 3000, shield: 0.35, openFactor: 2, violationFactor: 0.2, maxViolations: 3 };
const TB_PART = { gear: { icon: '⚙', name: 'Zahnrad' }, bolt: { icon: '🔩', name: 'Bolzen' }, spring: { icon: '➰', name: 'Feder' } };
const COGSWORTH_REWARD = { credits: 9000, crystals: 8, gems: 10, capsules: 1 };

Object.assign(STORY, {
  'cw-restricted': {
    title: 'Freigabe verweigert',
    lines: [
      ['werk', 'DURCHSAGE: Produktionsfreigabe abgelehnt! Formular 7-B fehlt. Zudem trägt die zuständige Katze zwei verschiedene Handschuhe.'],
      ['void', 'Mochi, hier hängt eine Regel: „§ 112 – In Halle 3 ist Gähnen nur mit Helm gestattet.“ Die ist echt.'],
      ['mochi', 'Jemand bewacht diese Fabriken noch – seit der Großen Stille. Wir finden heraus, wer.']
    ]
  },
  'cw-archive': {
    title: 'Das Freigabeschein-Archiv',
    lines: [
      ['mochi', 'Im Uhrwerkkern! Ein Archiv voller Freigabescheine … alle abgelaufen am Tag der Stille.'],
      ['void', 'Hier steht: „Neue Freigabe nur gegen 8 geprüfte Präzisionsbauteile.“ Die bauen wir doch selbst!'],
      ['werk', 'Archivsystem bereit. Bitte Prüfmuster einlegen. Regel 4: Nicht mit Pfoten auf den Bildschirm tippen.']
    ]
  },
  'cw-clue': {
    title: 'Ein Protokoll von damals',
    lines: [
      ['mochi', 'Ein letzter Eintrag vor der Stille: „Funkspruch an Lichtanker 4 abgebrochen. Absender: unbekannt.“'],
      ['void', 'Unbekannt? M.O.T.T.E. kennt doch jeden Absender … Das merken wir uns.']
    ]
  },
  'cw-drones': {
    title: 'Inspektor-Drohnen',
    lines: [
      ['cogsworth', 'Unbefugte Freigabe-Anfragen! Sicherheitsprotokoll 9: Inspektor-Drohnen ausrücken. Bitte ruhig und in einer geraden Linie stehen.'],
      ['void', 'Eine Drohne wollte gerade meinen Schwanz vermessen. Ich glaube, ich habe einen Alarm ausgelöst.'],
      ['mochi', 'Zwei Inspektor-Drohnen über Mekhanos – im Abenteuer-Tab. Dann reden wir mit ihm.']
    ]
  },
  'cw-arrives': {
    title: 'Cogsworth-9',
    lines: [
      ['cogsworth', 'Ich bin Cogsworth-9, Fabrikkoordinator von Mekhanos. Ihr arbeitet ohne gültige Freigabe!'],
      ['cogsworth', 'Taktband-Prüfung beginnt: Zahnrad, Bolzen, Feder. Zeigt mir das richtige Teil – oder bleibt draußen.'],
      ['mochi', 'Wenn wir sein Prüfteil richtig zeigen, öffnet sich seine Wartungsklappe!']
    ]
  },
  'cw-defeated': {
    title: 'Prüfung beendet',
    lines: [
      ['cogsworth', 'Prüfung … nicht bestanden? Ich wollte doch nur die Fabrik schützen. Seit der Stille kam keine neue Anweisung.'],
      ['void', 'Du warst die ganze Zeit allein hier unten? Dann bekommst du jetzt Gesellschaft.'],
      ['mochi', 'Wir kalibrieren deine Regeln neu – mit echten Bauteilen aus unserer Werkstatt.']
    ]
  },
  'cw-repaired': {
    title: 'Neue Hausordnung',
    lines: [
      ['cogsworth', 'Kalibrierung abgeschlossen. Neue Regel 1: Kätzchen dürfen arbeiten. Neue Regel 2: … und Pausen machen.'],
      ['cogsworth', 'Besucherschein für Void ausgestellt. Gültig: für immer. Bitte nicht anknabbern.'],
      ['void', 'Er hat mir einen Stempel auf die Pfote gedrückt. Mochi, ich bin jetzt offiziell.'],
      ['mochi', 'Willkommen in der Kolonie, Cogsworth! Der Maschinenkern darf wieder anlaufen.']
    ]
  }
});
window.StorySpeakers = Object.assign(window.StorySpeakers || {}, {
  cogsworth: { name: 'Cogsworth-9', portrait: () => window.MekhanosArt?.cogsworthPortraitURL?.(cogsworthFriendly() ? 'friendly' : ['defeated'].includes(cogsworth().stage) ? 'exhausted' : 'inspect') || '' },
  werk: { name: 'Werkslautsprecher', portrait: () => window.MekhanosArt?.cogsworthPortraitURL?.('warn') || '' }
});
const COG_TALK = [
  'Regel 17: Jedes Kätzchen bekommt eine Pause pro Schicht. Ich habe nachgezählt. Zweimal.',
  'Die Präzisionswerkstatt läuft 20 % schneller, seit ich die Formulare stempele. Effizienz!',
  'Void hat heute drei Besucherscheine verloren. Ich habe ihm einen vierten ausgestellt. Laminiert.',
  'Früher war es hier sehr still. Ich mag das Klappern der Pfoten lieber.'
];
if (typeof VOID_LINES !== 'undefined')
  VOID_LINES.push('Auf Mekhanos gibt es eine Regel für alles. Sogar fürs Schnurren: höchstens 40 Dezibel.', 'Cogsworth hat Mochi gestern ein Lob-Formular ausgefüllt. In dreifacher Ausfertigung.');
let cogTalk = 0;
const talkBeforeCogsworth = window.NebulaColonyActions.talk;
window.NebulaColonyActions.talk = who => {
  if (who === 'cogsworth' && cogsworthFriendly()) {
    storyQueue.push(['cogsworth', COG_TALK[cogTalk++ % COG_TALK.length]]);
    window.NebulaAudio?.play('stamp');
    return showNextStoryLine();
  }
  return talkBeforeCogsworth?.(who);
};

// ----- story progression (real gameplay gates) -----
function updateCogsworth() {
  const cw = cogsworth(),
    mi = mekhanosIndex();
  if (mi < 0) return;
  if (cw.stage === 'locked' && state.planetsUnlocked[mi]) {
    cw.stage = 'restricted';
    storyEvent('cw-restricted');
  }
  if (cw.stage === 'restricted' && withPlanet(mi, () => undergroundOpen(mi) && shaftLevel('shaft3', mi) > 0)) {
    cw.stage = 'archive';
    storyEvent('cw-archive');
  }
}
// Files one real Präzisionsbauteil from the Mekhanos stock into the archive (deducted exactly once per click).
function feedArchive() {
  const cw = cogsworth(),
    colony = state.colonies[mekhanosIndex()];
  if (cw.stage !== 'archive' || !(colony.stock.precisionParts >= 1)) return false;
  colony.stock.precisionParts -= 1;
  cw.archive += 1;
  feedback('upgrade', 'light');
  if (cw.archive === Math.ceil(COGSWORTH_ARCHIVE_PARTS / 2)) storyEvent('cw-clue');
  if (cw.archive >= COGSWORTH_ARCHIVE_PARTS) {
    cw.stage = 'drones';
    cw.drones = 0;
    storyEvent('cw-drones');
  }
  save();
  render();
  return true;
}
// Ladder kills count as Inspektor-Drohnen only while the player is at Mekhanos and no earlier guardian's drone or
// warning stage is running (one kill never advances two stories).
function inspectorScene() {
  return cogsworth().stage === 'drones' && !guardianArena('cogsworth') && state.activePlanet === mekhanosIndex() && pips().stage !== 'warned' && frostbyte().stage !== 'drones' && emberbell().stage !== 'drones';
}
GameEvents.on('enemy-defeated', event => {
  const cw = cogsworth();
  if (typeof event.level !== 'number' || !inspectorScene()) return;
  cw.drones = Math.min(2, cw.drones + 1);
  if (cw.drones >= 2) startCogsworthBattle();
});
function cogsworthMaxHp() {
  return Math.round(4200 + 260 * state.enemyLevel);
}
function startCogsworthBattle(now = Date.now()) {
  const cw = cogsworth();
  if (cw.stage !== 'drones') return;
  Object.assign(cw, { stage: 'battle', maxHp: cogsworthMaxHp(), fightStart: now, phase: 'inspect', phaseAt: now, round: 0, seed: Math.floor(now / 1000) % 9973, symbol: null, answered: false, lastAnswer: null, violations: 0 });
  cw.hp = cw.maxHp;
  storyEvent('cw-arrives');
  requestSave(200);
}

// ----- Taktband (pure time-based state, advanced on every read; stable through reloads) -----
function tbSymbol(seed, round) {
  return TAKTBAND_SYMBOLS[(seed * 7 + round * 5 + ((round * round) % 3)) % 3];
}
function tbInspectMs(cw) {
  return Math.max(TB.inspectMin, TB.inspect - TB.perViolation * cw.violations);
}
function tbAdvance(now = Date.now()) {
  const cw = cogsworth();
  if (cw.stage !== 'battle') return cw;
  // long absences (reload hours later): resume calmly with a fresh inspection instead of replaying every cycle
  if (now - cw.phaseAt > 10 * 60 * 1000) Object.assign(cw, { phase: 'inspect', phaseAt: now, symbol: null, answered: false });
  for (let guard = 0; guard < 60; guard++) {
    if (cw.phase === 'inspect') {
      const end = cw.phaseAt + tbInspectMs(cw);
      if (now < end) break;
      cw.round += 1;
      Object.assign(cw, { phase: 'window', phaseAt: end, symbol: tbSymbol(cw.seed, cw.round), answered: false });
      // audible cue for a window that opens right now (not for windows replayed after a reload); never required
      if (now - end < 1000 && currentScreen() === 'battle') window.NebulaAudio?.play('tick');
    } else {
      const dur = cw.phase === 'window' ? TB.window : cw.phase === 'open' ? TB.open : TB.violation;
      if (now < cw.phaseAt + dur) break;
      if (cw.phase === 'window') cw.lastAnswer = 'missed';
      Object.assign(cw, { phase: 'inspect', phaseAt: cw.phaseAt + dur, symbol: null, answered: false });
    }
  }
  return cw;
}
function tbPhaseLeft(now = Date.now()) {
  const cw = tbAdvance(now);
  const dur = cw.phase === 'inspect' ? tbInspectMs(cw) : cw.phase === 'window' ? TB.window : cw.phase === 'open' ? TB.open : TB.violation;
  return Math.max(0, cw.phaseAt + dur - now);
}
function tbNextSymbol() {
  const cw = cogsworth();
  return tbSymbol(cw.seed, cw.round + 1);
}
// One answer per inspection window; anything else is ignored (repeat clicks, wrong phase, unknown part).
function cogsworthAnswer(symbol, now = Date.now()) {
  const cw = tbAdvance(now);
  if (cw.stage !== 'battle' || cw.phase !== 'window' || cw.answered || !TAKTBAND_SYMBOLS.includes(symbol)) return 'ignored';
  cw.answered = true;
  if (symbol === cw.symbol) {
    Object.assign(cw, { phase: 'open', phaseAt: now, violations: Math.max(0, cw.violations - 1), lastAnswer: 'correct' });
    window.NebulaAudio?.play('open');
    feedback('unlock', 'success');
    GameEvents.emit('taktband', { result: 'correct' });
  } else {
    Object.assign(cw, { phase: 'violation', phaseAt: now, violations: Math.min(TB.maxViolations, cw.violations + 1), lastAnswer: 'wrong' });
    feedback('deny', 'warning');
    GameEvents.emit('taktband', { result: 'wrong' });
  }
  requestSave(200);
  return cw.lastAnswer;
}
function tbFactor(phase) {
  return phase === 'open' ? TB.openFactor : phase === 'violation' ? TB.violationFactor : TB.shield;
}
function cogsworthAttack(e) {
  const now = Date.now(),
    cw = tbAdvance(now);
  if (cw.stage !== 'battle' || cw.hp <= 0) return;
  const aimed = state.aimReady,
    factor = tbFactor(cw.phase),
    damage = attack() * factor;
  cw.hp = Math.max(0, cw.hp - damage);
  GameEvents.emit('attack', { damage, weapon: state.ship.weaponType, aimed, overcharge: now < state.overchargeUntil, auto: !e?.isTrusted, boss: true, killed: cw.hp <= 0, level: 'cogsworth', shielded: factor < 1 });
  feedback(factor < 0.5 ? 'deny' : 'hit', e?.isTrusted ? 'light' : null);
  if (cw.hp <= 0) defeatCogsworth();
}
function defeatCogsworth() {
  const cw = cogsworth();
  if (cw.stage !== 'battle') return;
  cw.stage = 'defeated';
  cw.phase = 'inspect';
  if (!cw.rewarded) {
    cw.rewarded = true;
    earn(COGSWORTH_REWARD.credits);
    state.crystals += COGSWORTH_REWARD.crystals;
    state.gems += COGSWORTH_REWARD.gems;
    state.meta.managers.capsules += COGSWORTH_REWARD.capsules;
    seasonXp('boss');
  }
  GameEvents.emit('enemy-defeated', { boss: true, credits: COGSWORTH_REWARD.credits, rarity: 'epic', dropName: 'Cogsworths Prüfstempel', isNew: true, level: 'cogsworth' });
  storyEvent('cw-defeated');
  save();
}
function cogsworthRepairMissing() {
  const c = state.colonies[mekhanosIndex()].stock,
    missing = [];
  if (c.precisionParts < COGSWORTH_REPAIR.parts) missing.push(Math.ceil(COGSWORTH_REPAIR.parts - c.precisionParts) + ' ⛭ Bauteile');
  if (c.precisionOre < COGSWORTH_REPAIR.precisionOre) missing.push(Math.ceil(COGSWORTH_REPAIR.precisionOre - c.precisionOre) + ' ⚙ Präzisionserz');
  if (state.ore < COGSWORTH_REPAIR.ore) missing.push(Math.ceil(COGSWORTH_REPAIR.ore - state.ore) + ' ⬡ Erz');
  return missing;
}
function repairCogsworth() {
  const cw = cogsworth(),
    mi = mekhanosIndex();
  if (cw.stage !== 'defeated') return false;
  const missing = cogsworthRepairMissing();
  if (missing.length) return toast('Für die Neukalibrierung fehlen noch ' + missing.join(', ') + ' (auf Mekhanos).'), false;
  const c = state.colonies[mi].stock;
  c.precisionParts -= COGSWORTH_REPAIR.parts;
  c.precisionOre -= COGSWORTH_REPAIR.precisionOre;
  state.ore -= COGSWORTH_REPAIR.ore;
  cw.stage = 'repaired';
  cw.repairedAt = Date.now();
  if (!state.meta.story.liberated.includes(mi)) state.meta.story.liberated.push(mi);
  window.NebulaAudio?.play('stamp');
  feedback('unlock', 'success');
  storyEvent('cw-repaired');
  save();
  render();
  return true;
}

// ----- battle button: Cogsworth's fight routes here (P.I.P.S., Frostbyte and Emberbell keep priority) -----
function cogsworthFightActive() {
  return cogsworth().stage === 'battle' && pips().stage !== 'battle' && frostbyte().stage !== 'battle' && emberbell().stage !== 'battle';
}
const battleClickBeforeCogsworth = $('battleButton').onclick;
$('battleButton').onclick = e => {
  if (cogsworthFightActive()) {
    cogsworthAttack(e);
    render();
    return;
  }
  return battleClickBeforeCogsworth(e);
};

// ----- view models -----
const combatViewBeforeCogsworth = window.NebulaView.combat;
window.NebulaView.combat = () => {
  const view = combatViewBeforeCogsworth(),
    cw = cogsworth();
  if (view.story) return view; // earlier guardians first
  if (cogsworthFightActive()) {
    const now = Date.now(),
      cur = tbAdvance(now);
    return {
      ...view,
      enemyHp: cur.hp,
      enemyMax: cur.maxHp,
      boss: false,
      story: { mode: 'cogsworth', phase: cur.phase, symbol: cur.symbol, next: tbNextSymbol(), left: tbPhaseLeft(now), violations: cur.violations, lastAnswer: cur.lastAnswer, open: cur.phase === 'open', telegraph: cur.phase === 'window' }
    };
  }
  if (inspectorScene()) return { ...view, story: { mode: 'inspector' } };
  return view;
};
const colonyViewBeforeCogsworth = window.NebulaView.colony;
window.NebulaView.colony = () => {
  const view = colonyViewBeforeCogsworth();
  if (!isMekhanos()) return view;
  return { ...view, mekhanos: { stage: cogsworth().stage, freed: cogsworthFriendly() } };
};

// ----- UI: battle story card with the Taktband controls, Mekhanos objective, workshop sheet -----
function tbButtons(cw, active) {
  return `<div class="tb-controls" role="group" aria-label="Taktband-Prüfteil wählen">${TAKTBAND_SYMBOLS.map(
    id => `<button data-taktband="${id}" class="tb-part${active && cw.answered === false ? ' ready' : ''}" ${active && !cw.answered ? '' : 'disabled'}><b>${TB_PART[id].icon}</b><span>${TB_PART[id].name}</span></button>`
  ).join('')}</div>`;
}
function renderCogsworthCard() {
  const card = $('storyCard'),
    cw = cogsworth();
  if (!card || ['warned', 'battle', 'defeated'].includes(pips().stage) || ['drones', 'battle', 'defeated'].includes(frostbyte().stage) || ['drones', 'battle', 'defeated'].includes(emberbell().stage)) return;
  let html = '';
  if (cw.stage === 'drones') {
    html = state.activePlanet === mekhanosIndex()
      ? `<b>Inspektor-Drohnen über Mekhanos</b><small>Besiege 2 Inspektor-Drohnen (${cw.drones}/2). Dann stellt sich Cogsworth-9.</small>`
      : `<b>Inspektor-Drohnen über Mekhanos</b><small>Die Drohnen kreisen nur über Mekhanos – wähle Mekhanos als Planet (${cw.drones}/2).</small>`;
  } else if (cogsworthFightActive()) {
    // the live phase, countdown and the part buttons are in the Taktband dock above ANGREIFEN
    const cur = tbAdvance(Date.now()),
      note = cur.lastAnswer === 'missed' && cur.phase === 'inspect' ? ' · Fenster verpasst (keine Strafe)' : '';
    html = `<b>Wächter: Cogsworth-9 · Taktband</b><small>Schild: 35 % Schaden. Im Prüfungsfenster das gezeigte Teil tippen → Wartungsklappe offen (200 %); falsches Teil → Regelverstoß (20 %). ${fmt(cur.hp)} / ${fmt(cur.maxHp)}${note}</small>`;
  } else if (cw.stage === 'defeated') {
    const missing = cogsworthRepairMissing();
    html = `<b>Cogsworth-9 neu kalibrieren</b><small>Auf Mekhanos: ⛭ ${COGSWORTH_REPAIR.parts} Präzisionsbauteile · ⚙ ${COGSWORTH_REPAIR.precisionOre} Präzisionserz · ⬡ ${COGSWORTH_REPAIR.ore} Erz${missing.length ? ' – es fehlen ' + missing.join(', ') : ''}</small><button id="repairCogsworth" ${missing.length ? 'disabled' : ''}>NEU KALIBRIEREN</button>`;
  } else return;
  card.classList.remove('hidden');
  setHTML(card, html);
  if (cw.stage === 'drones' && inspectorScene()) $('enemyName').textContent = 'Inspektor-Drohne ' + Math.min(2, cw.drones + 1) + '/2';
  if (cogsworthFightActive()) {
    $('enemyName').textContent = 'Cogsworth-9 · Fabrikwächter';
    $('enemyHealth').style.width = (cw.hp / Math.max(1, cw.maxHp)) * 100 + '%';
    $('enemyHealthText').textContent = fmt(cw.hp) + ' / ' + fmt(cw.maxHp);
    $('battleReward').textContent = '9k';
    $('dropPreview').textContent = 'Belohnung: 9.000 ◈, 8 Kristalle, 10 Gems, 1 Talent-Kapsel und ein neuer Freund';
  }
  if (cw.stage === 'drones' || cogsworthFightActive()) {
    $('battleKicker').textContent = 'MEKHANOS · STORY';
    $('battleTitle').textContent = 'Das letzte Freigabeprotokoll';
  }
}
document.addEventListener('click', event => {
  if (event.target.closest('#repairCogsworth')) return repairCogsworth();
  if (event.target.closest('[data-feed-archive]')) {
    const cw = cogsworth();
    if (!feedArchive()) return toast('Kein Präzisionsbauteil auf Lager – die Präzisionswerkstatt fertigt welche.');
    return toast(cw.stage === 'archive' ? 'Freigabeschein gestempelt · ' + cw.archive + ' / ' + COGSWORTH_ARCHIVE_PARTS : 'Archiv vollständig – Cogsworth-9 schickt Inspektor-Drohnen!');
  }
  const part = event.target.closest('[data-taktband]');
  if (part) {
    cogsworthAnswer(part.dataset.taktband);
    updateTaktbandDock();
  }
});
// The archive lies in the Uhrwerkkern: it can be fed from the Schacht-3 sheet and from the Präzisionswerkstatt sheet.
function archiveRow() {
  const cw = cogsworth(),
    parts = colonyAt().stock.precisionParts;
  return `<div class="sheet-manager manual"><i class="manager-icon">🗄</i><div><b>Freigabeschein-Archiv ${cw.archive} / ${COGSWORTH_ARCHIVE_PARTS}</b><small>Lege geprüfte Präzisionsbauteile ins Archiv im Uhrwerkkern – jedes wird einmal verbraucht · auf Lager: ${fmt(Math.floor(parts))}</small></div><button data-feed-archive ${parts >= 1 ? '' : 'disabled'}>1 BAUTEIL EINLEGEN</button></div>`;
}
const sheetExtraBeforeCogsworth = window.sheetExtra;
window.sheetExtra = key => {
  const base = sheetExtraBeforeCogsworth?.(key) || '';
  if (key === 'dc:shaft:shaft3' && isMekhanos() && cogsworth().stage === 'archive') return base + archiveRow();
  if (key !== 'workshop' || !isMekhanos()) return base;
  const cw = cogsworth();
  if (cw.stage === 'archive') return base + archiveRow();
  if (cw.stage === 'repaired') return base + `<p class="sheet-effect">Cogsworth-9 stempelt Freigaben: Präzisionswerkstatt +20 %, interner Schachttransport +10 %, keine Stufengrenze.</p>`;
  if (['drones', 'battle', 'defeated'].includes(cw.stage)) return base + `<p class="sheet-effect">Archiv gefüllt · Cogsworth-9 wehrt sich noch (Abenteuer-Tab).</p>`;
  return base + `<p class="sheet-effect">Über Stufe ${MEKHANOS_LEVEL_CAP} fehlt Formular 7-B – erst Cogsworth-9 reparieren. Bereits gebaute Stufen bleiben.</p>`;
};
// open Mekhanos chapter steps: restricted → … → defeated, and after the repair the way to the Maschinenkern
function cogsworthGoalOpen() {
  const cw = cogsworth();
  if (!isMekhanos()) return false;
  if (['restricted', 'archive', 'drones', 'defeated'].includes(cw.stage)) return true;
  return cw.stage === 'repaired' && undergroundOpen() && shaftBuilt('shaft3') && !shaftBuilt('shaft4') && !shaftUnderConstruction('shaft4');
}
const storyGoalBeforeCogsworth = planetStoryGoalActive;
planetStoryGoalActive = () => storyGoalBeforeCogsworth() || cogsworthGoalOpen();
const renderObjectiveBeforeCogsworth = renderObjective;
renderObjective = function () {
  renderObjectiveBeforeCogsworth();
  const cw = cogsworth(),
    card = $('objectiveCard');
  if (!isMekhanos()) return;
  // after the repair: lead on to the Maschinenkern (then hand back to the normal objectives)
  if (cw.stage === 'repaired') {
    if (!undergroundOpen() || shaftBuilt('shaft4') || shaftUnderConstruction('shaft4') || !shaftBuilt('shaft3')) return;
    const ready = shaftLevel('shaft3') >= 10;
    $('objectiveIcon').textContent = '⚙';
    $('objectiveTitle').textContent = ready ? 'Maschinenkern bauen' : 'Uhrwerkkern auf Stufe ' + shaftLevel('shaft3') + ' / 10';
    $('objectiveText').textContent = ready ? 'Cogsworth hat Schacht 4 freigegeben – der Reaktivierte Maschinenkern wartet.' : 'Cogsworth hat den Maschinenkern entsiegelt. Bring den Uhrwerkkern-Bohrer auf Stufe 10.';
    $('objectiveAction').textContent = 'MINE ›';
    card.dataset.screen = 'home';
    card.dataset.sheet = '0';
    return;
  }
  if (!['restricted', 'archive', 'drones', 'defeated'].includes(cw.stage)) return;
  const open = undergroundOpen(),
    workshopBuilt = (colonyAt().industry.workshop || 0) > 0,
    blocker = open ? shaftBlocker('shaft3') : '';
  const goal =
    cw.stage === 'restricted'
      ? !open
        ? ['⛏', 'Förderturm bauen', 'Unter den Fabriken liegt das alte Zahnwerk. Öffne die Mine.', 'MINE ›', 'mine']
        : !workshopBuilt
          ? ['⚙', 'Präzisionswerkstatt bauen', 'Bauteile stützen die tiefen Stollen – und Cogsworth prüft nur Bauteile.', 'BAUEN ›', 'workshop']
          : ['⛏', 'Uhrwerkkern graben', blocker ? blocker + '.' : 'Grabe Schacht 3. Dort soll ein altes Archiv liegen.', 'MINE ›', 'mine']
      : cw.stage === 'archive'
        ? ['🗄', 'Archiv ' + cw.archive + ' / ' + COGSWORTH_ARCHIVE_PARTS, 'Lege Präzisionsbauteile an der Werkstatt ins Freigabeschein-Archiv.', 'WERKSTATT ›', 'workshop']
        : cw.stage === 'drones'
          ? ['🔍', 'Inspektor-Drohnen ' + cw.drones + ' / 2', 'Besiege die Drohnen über Mekhanos im Abenteuer-Tab.', 'ABENTEUER ›', '']
          : ['🔧', 'Cogsworth-9 neu kalibrieren', 'Er ist erschöpft. Kalibriere ihn im Abenteuer-Tab neu.', 'ABENTEUER ›', ''];
  $('objectiveIcon').textContent = goal[0];
  $('objectiveTitle').textContent = goal[1];
  $('objectiveText').textContent = goal[2];
  $('objectiveAction').textContent = goal[3];
  card.dataset.screen = goal[4] ? 'home' : 'battle';
  card.dataset.sheet = goal[4] === 'mine' ? '0' : goal[4];
};
// Taktband dock: status, countdown and the three large part buttons directly above ZIELEN / OVERCHARGE / ANGREIFEN.
// It refreshes itself 4×/s while the fight is on screen (only this element — no full render, K56).
function taktbandStatus(cur, now) {
  const left = Math.ceil(tbPhaseLeft(now) / 1000),
    next = TB_PART[tbNextSymbol()],
    part = cur.symbol ? TB_PART[cur.symbol] : null;
  if (cur.phase === 'window') return `<p class="tb-status window" role="status">🔍 <b>PRÜFUNGSFENSTER · ${left} s</b> Cogsworth prüft: <em>${part.icon} ${part.name}</em> – tippe das gleiche Teil!</p>`;
  if (cur.phase === 'open') return `<p class="tb-status open" role="status">✔ <b>RICHTIG!</b> Wartungsklappe offen: 200 % Schaden · ${left} s</p>`;
  if (cur.phase === 'violation') return `<p class="tb-status violation" role="status">✕ <b>REGELVERSTOSS</b> nur 20 % Schaden · ${left} s · Verstöße ${cur.violations}/${TB.maxViolations}</p>`;
  return `<p class="tb-status inspect" role="status">🛡 <b>PRÜFUNG LÄUFT</b> Schild 35 % · nächstes Prüfteil in ${left} s: ${next.icon} ${next.name}${cur.violations ? ' · Verstöße ' + cur.violations + '/' + TB.maxViolations : ''}</p>`;
}
function updateTaktbandDock() {
  const dock = $('taktbandDock'),
    on = currentScreen() === 'battle' && cogsworthFightActive();
  document.body.classList.toggle('taktband-active', on);
  if (!dock) return;
  dock.hidden = !on;
  if (!on) return;
  const now = Date.now(),
    cur = tbAdvance(now);
  setHTML(dock, taktbandStatus(cur, now) + tbButtons(cur, cur.phase === 'window'));
}
setInterval(() => {
  if (document.hidden || currentScreen() !== 'battle' || !cogsworthFightActive()) return;
  updateTaktbandDock();
}, 250);
const renderBeforeCogsworth = render;
render = () => {
  updateCogsworth();
  renderBeforeCogsworth();
  if (currentScreen() === 'battle') renderCogsworthCard();
  updateTaktbandDock();
};
const screenUnlockedBeforeCogsworth = screenUnlocked;
screenUnlocked = screen => screenUnlockedBeforeCogsworth(screen) || (screen === 'battle' && ['drones', 'battle', 'defeated', 'repaired'].includes(cogsworth().stage));
render();
