// Pyra-9 awakening (session 8): story with Mochi, Void and the foreman Funke, the cooling-console task, heat drones,
// the Emberbell boss, his repair and the UI hooks. State lives in state.meta.guardians.emberbell (pyra.js).
// Loaded after frostbyte.js (wraps the battle button after P.I.P.S. and Frostbyte).
//
// Boss mechanic — heat pressure (distinct from P.I.P.S.' inspection shield and Frostbyte's ice plates):
//   build: pressure rises 10 %/s; the heat shield lets only 40 % of the damage through; an aimed shot hits a vent
//          (+20 % pressure → the vent comes sooner)
//   warn (2 s):  "Druckwarnung" — vents glow, still shielded
//   blast (1.5 s): "Dampfstoß" — nothing gets through and a running Overcharge is blown out
//   cool (5 s):  plates open — 175 % damage; then pressure 0 and the cycle repeats

const EB = { rate: 10, aimPush: 20, warn: 2000, blast: 1500, cool: 5000, shield: 0.4, open: 1.75 };

Object.assign(STORY, {
  'eb-arrival': {
    title: 'Ankunft auf Pyra-9',
    lines: [
      ['funke', 'Willkommen auf Pyra-9! Vorsicht, heiß hier – seit der Großen Stille hält EMBERBELL alle Kühlklappen geschlossen.'],
      ['mochi', 'Emberbell? Noch ein Wächter von M.O.T.T.E.?'],
      ['void', 'Riechst du das? Überhitzte Leitungen. Er meint es gut – er glaubt, Hitze schützt den Planeten.'],
      ['funke', 'Über Stufe 10 überhitzen Glutschmelze und Magmaspalte. Baut eine Mine und eine Glutschmelze – Glutlegierung hält die Hitze aus!']
    ]
  },
  'void-pyra-mine': {
    title: 'Glutstein',
    lines: [
      ['void', 'Glutstein! Er glüht von innen. Und schau, die Kätzchen tragen ihn in Hitzekisten.'],
      ['mochi', 'Der Aufzug bringt ihn nach oben, und in der Glutschmelze wird daraus Glutlegierung.']
    ]
  },
  'eb-console': {
    title: 'Die alte Kühlkonsole',
    lines: [
      ['void', 'Mochi! Hinter der Magmaspalte – eine alte Kühlkonsole mit M.O.T.T.E.-Zeichen. Die Klappen sind zugeschweißt.'],
      ['tikki', 'Mit 6 Glutlegierung als Hitzeschild kriege ich sie wieder auf. Speise sie an der Glutschmelze ein!']
    ]
  },
  'eb-drones': {
    title: 'Hitzedrohnen',
    lines: [
      ['emberbell', 'KÜHLUNG ERKANNT! Gefahr! Ohne Hitze frieren meine Kätzchen! Hitzedrohnen – Klappen schließen!'],
      ['mochi', 'Er will uns beschützen … aber so überhitzt alles. Wir müssen zu ihm – im Abenteuer-Tab.']
    ]
  },
  'eb-arrives': {
    title: 'Emberbell persönlich',
    lines: [
      ['emberbell', 'Druck steigt … Druck ist SICHER! Niemand rührt meine Klappen an!'],
      ['boba', 'Sein Hitzeschild schluckt viel. Nach dem Dampfstoß kühlt er ab – dann ist er offen! Zielschüsse in die Ventile bringen den Ablass früher.']
    ]
  },
  'eb-defeated': {
    title: 'Ein erschöpfter Wächter',
    lines: [
      ['mochi', 'Emberbell keucht und dampft … er ist erschöpft, nicht böse.'],
      ['void', 'Wenn Tikki sein Schutzprotokoll neu kalibriert, kann er endlich verschnaufen.']
    ]
  },
  'eb-repaired': {
    title: 'Genau richtig warm',
    lines: [
      ['emberbell', 'Druck … ausgeglichen. Oh! Die Kätzchen lachen ja. Ich dachte, Kühle wäre gefährlich.'],
      ['emberbell', 'Ab jetzt halte ich die Glutschmelze warm – genau richtig warm. Versprochen!'],
      ['void', 'Siehst du, Mochi? Er wollte nur aufpassen. Wie du.'],
      ['mochi', 'Willkommen in der Kolonie, Emberbell!']
    ]
  }
});
window.StorySpeakers = Object.assign(window.StorySpeakers || {}, {
  emberbell: { name: 'Emberbell', portrait: () => window.PyraArt?.emberbellPortraitURL?.(['defeated', 'repaired'].includes(emberbell().stage)) || '' },
  funke: {
    name: 'Funke',
    portrait: () =>
      window.SpaceKittens?.managerPortraitURL?.('funke', window.SpaceKittens.WORKERS[4], { hat: 'hardhat', hatColor: '#ffcc33', jacket: '#c87a4a', bowtie: '#7fe8f0' }, 96, 1, emberbellFriendly() ? 'happy' : 'worried') || ''
  }
});
const EMBER_TALK = [
  'Die Glutschmelze hat jetzt genau 1.250 Grad. Perfekt für Legierung, perfekt für Pfoten-Abstand!',
  'Ich habe die Kühlklappen poliert. Sie glänzen. Das ist nicht nötig. Aber schön.',
  'Void sitzt gern auf meinem Kopf. Er sagt, ich sei die gemütlichste Wärmflasche der Galaxie.',
  'Wenn du Thermalzellen von Glacies bringst, kühlt die Schmelze schneller. Frostbyte lässt grüßen!'
];
let emberTalk = 0;
const talkBeforePyra = window.NebulaColonyActions.talk;
window.NebulaColonyActions.talk = who => {
  if (who === 'emberbell' && emberbellFriendly()) {
    storyQueue.push(['emberbell', EMBER_TALK[emberTalk++ % EMBER_TALK.length]]);
    return showNextStoryLine();
  }
  return talkBeforePyra?.(who);
};

// ----- story progression (real gameplay gates) -----
function updateEmberbell() {
  const eb = emberbell(),
    pi = pyraIndex();
  if (pi < 0) return;
  if (eb.stage === 'locked' && state.planetsUnlocked[pi]) {
    eb.stage = 'overheated';
    storyEvent('eb-arrival');
  }
  if (eb.stage === 'overheated' && withPlanet(pi, () => undergroundOpen(pi) && shaftLevel('shaft3', pi) > 0)) {
    eb.stage = 'console';
    storyEvent('eb-console');
  }
}
GameEvents.on('shaft-built', e => {
  if (e.planet === pyraIndex() && e.shaft === 'shaft2') storyEvent('void-pyra-mine');
});
// Feeds real Glutlegierung from the Pyra stock into the cooling console.
function feedCoolingConsole() {
  const eb = emberbell(),
    colony = state.colonies[pyraIndex()];
  if (eb.stage !== 'console' || !(colony.stock.emberAlloy >= 1)) return false;
  colony.stock.emberAlloy -= 1;
  eb.console += 1;
  feedback('upgrade', 'light');
  if (eb.console >= EMBER_CONSOLE_ALLOYS) {
    eb.stage = 'drones';
    eb.drones = 0;
    storyEvent('eb-drones');
  }
  save();
  render();
  return true;
}
// Ladder kills count as heat drones while Emberbell's drones are out (P.I.P.S. and Frostbyte keep priority).
GameEvents.on('enemy-defeated', event => {
  const eb = emberbell();
  if (eb.stage !== 'drones' || typeof event.level !== 'number' || guardianArena('emberbell')) return; // Beta 1.6: the Glutwacht campaign replaces the drones
  if (pips().stage === 'warned' || frostbyte().stage === 'drones') return;
  eb.drones = Math.min(2, eb.drones + 1);
  if (eb.drones >= 2) {
    const now = Date.now();
    Object.assign(eb, { stage: 'battle', maxHp: 2400 + 150 * state.enemyLevel, fightStart: now, pressure: 0, phase: 'build', phaseAt: now, lastAt: now });
    eb.hp = eb.maxHp;
    storyEvent('eb-arrives');
    requestSave(200);
  }
});

// ----- boss mechanics (pure time-based state, advanced on every read) -----
function ebAdvance(now = Date.now()) {
  const eb = emberbell();
  if (eb.stage !== 'battle') return eb;
  let guard = 0;
  while (guard++ < 20) {
    if (eb.phase === 'build') {
      const reach = eb.lastAt + ((100 - eb.pressure) / EB.rate) * 1000;
      if (now < reach) {
        eb.pressure = Math.min(100, eb.pressure + ((now - eb.lastAt) / 1000) * EB.rate);
        eb.lastAt = now;
        break;
      }
      Object.assign(eb, { pressure: 100, phase: 'warn', phaseAt: reach, lastAt: reach });
    } else if (eb.phase === 'warn') {
      if (now < eb.phaseAt + EB.warn) break;
      const at = eb.phaseAt + EB.warn;
      Object.assign(eb, { phase: 'blast', phaseAt: at, lastAt: at });
      // the steam blast blows out a running Overcharge
      if (state.overchargeUntil > at) state.overchargeUntil = at;
    } else if (eb.phase === 'blast') {
      if (now < eb.phaseAt + EB.blast) break;
      const at = eb.phaseAt + EB.blast;
      Object.assign(eb, { phase: 'cool', phaseAt: at, lastAt: at, pressure: 30 });
    } else {
      if (now < eb.phaseAt + EB.cool) {
        eb.pressure = Math.max(0, 30 - ((now - eb.phaseAt) / EB.cool) * 30);
        break;
      }
      const at = eb.phaseAt + EB.cool;
      Object.assign(eb, { phase: 'build', phaseAt: at, lastAt: at, pressure: 0 });
    }
  }
  // while the steam blast lasts, any Overcharge (also one started during it) is blown out
  if (eb.phase === 'blast' && state.overchargeUntil > now) state.overchargeUntil = now;
  return eb;
}
function ebPhaseLeft(now = Date.now()) {
  const eb = ebAdvance(now);
  if (eb.phase === 'build') return ((100 - eb.pressure) / EB.rate) * 1000;
  return eb.phaseAt + EB[eb.phase] - now;
}
function emberbellAttack(e) {
  const now = Date.now(),
    eb = ebAdvance(now),
    aimed = state.aimReady,
    base = attack();
  const factor = eb.phase === 'cool' ? EB.open : eb.phase === 'blast' ? 0 : EB.shield;
  if (aimed && eb.phase === 'build') eb.pressure = Math.min(100, eb.pressure + EB.aimPush);
  const damage = base * factor;
  eb.hp = Math.max(0, eb.hp - damage);
  GameEvents.emit('attack', { damage, weapon: state.ship.weaponType, aimed, overcharge: now < state.overchargeUntil, auto: !e.isTrusted, boss: true, killed: eb.hp <= 0, level: 'emberbell', shielded: factor < 1 });
  feedback(factor < 0.5 ? 'deny' : 'hit', e.isTrusted ? 'light' : null);
  if (eb.hp <= 0) defeatEmberbell();
}
function defeatEmberbell() {
  const eb = emberbell();
  if (eb.stage !== 'battle') return;
  eb.stage = 'defeated';
  earn(6000);
  state.crystals += 6;
  state.gems += 8;
  state.meta.managers.capsules += 1;
  seasonXp('boss');
  GameEvents.emit('enemy-defeated', { boss: true, credits: 6000, rarity: 'epic', dropName: 'Emberbells Druckventil', isNew: true, level: 'emberbell' });
  storyEvent('eb-defeated');
  save();
}
function emberbellRepairMissing() {
  const c = state.colonies[pyraIndex()].stock,
    missing = [];
  if (c.emberAlloy < EMBERBELL_REPAIR.alloy) missing.push(Math.ceil(EMBERBELL_REPAIR.alloy - c.emberAlloy) + ' ▣');
  if (c.ember < EMBERBELL_REPAIR.ember) missing.push(Math.ceil(EMBERBELL_REPAIR.ember - c.ember) + ' ⬢');
  if (state.ore < EMBERBELL_REPAIR.ore) missing.push(Math.ceil(EMBERBELL_REPAIR.ore - state.ore) + ' ⬡');
  return missing;
}
function repairEmberbell() {
  const eb = emberbell(),
    pi = pyraIndex();
  if (eb.stage !== 'defeated') return false;
  const missing = emberbellRepairMissing();
  if (missing.length) return toast('Für die Neukalibrierung fehlen noch ' + missing.join(', ') + ' (auf Pyra-9).'), false;
  const c = state.colonies[pi].stock;
  c.emberAlloy -= EMBERBELL_REPAIR.alloy;
  c.ember -= EMBERBELL_REPAIR.ember;
  state.ore -= EMBERBELL_REPAIR.ore;
  eb.stage = 'repaired';
  if (!state.meta.story.liberated.includes(pi)) state.meta.story.liberated.push(pi);
  window.NebulaAudio?.play('meow');
  feedback('unlock', 'success');
  storyEvent('eb-repaired');
  save();
  render();
  return true;
}

// ----- battle button: Emberbell's fight routes here (P.I.P.S. and Frostbyte keep priority) -----
const battleClickBeforeEmberbell = $('battleButton').onclick;
$('battleButton').onclick = e => {
  if (emberbell().stage === 'battle' && pips().stage !== 'battle' && frostbyte().stage !== 'battle') {
    emberbellAttack(e);
    render();
    return;
  }
  return battleClickBeforeEmberbell(e);
};

// ----- view models -----
const combatViewBeforePyra = window.NebulaView.combat;
window.NebulaView.combat = () => {
  const view = combatViewBeforePyra(),
    eb = emberbell();
  if (view.story) return view; // P.I.P.S. / Frostbyte first
  if (eb.stage === 'battle') {
    const now = Date.now(),
      cur = ebAdvance(now);
    return { ...view, enemyHp: cur.hp, enemyMax: cur.maxHp, boss: false, story: { mode: 'emberbell', pressure: cur.pressure / 100, phase: cur.phase, telegraph: cur.phase === 'warn', open: cur.phase === 'cool', left: Math.max(0, ebPhaseLeft(now)) } };
  }
  if (eb.stage === 'drones' && !guardianArena('emberbell')) return { ...view, story: { mode: 'heatdrone' } };
  return view;
};
const colonyViewBeforePyra = window.NebulaView.colony;
window.NebulaView.colony = () => {
  const view = colonyViewBeforePyra();
  if (!isPyra()) return view;
  return { ...view, pyra: { stage: emberbell().stage, calm: emberbellFriendly() } };
};

// ----- UI: battle story card, Pyra objective, Glutschmelze sheet -----
function renderEmberbellCard() {
  const card = $('storyCard'),
    eb = emberbell();
  if (!card || ['warned', 'battle', 'defeated'].includes(pips().stage) || ['drones', 'battle', 'defeated'].includes(frostbyte().stage)) return;
  let html = '';
  if (eb.stage === 'drones') html = `<b>Hitzedrohnen über Pyra-9</b><small>Besiege 2 Hitzedrohnen (${eb.drones}/2). Dann stellt sich Emberbell.</small>`;
  else if (eb.stage === 'battle') {
    const now = Date.now(),
      cur = ebAdvance(now),
      left = Math.ceil(ebPhaseLeft(now) / 1000),
      pct = Math.round(cur.pressure);
    const text =
      cur.phase === 'warn'
        ? '⚠ Druckwarnung – Dampfstoß in ' + left + ' s! Overcharge geht dabei verloren.'
        : cur.phase === 'blast'
          ? '💨 Dampfstoß: nichts kommt durch, Overcharge verpufft.'
          : cur.phase === 'cool'
            ? '❄ Abkühlen: Platten offen – 175 % Schaden für ' + left + ' s!'
            : '🔥 Hitzeschild: nur 40 % Schaden · Druck ' + pct + ' % (Zielschuss ins Ventil: +20 %)';
    html = `<b>Wächter: Emberbell</b><small>${text} · ${fmt(cur.hp)} / ${fmt(cur.maxHp)}</small><i class="eb-gauge"><u style="width:${pct}%"></u></i>`;
  } else if (eb.stage === 'defeated') {
    const missing = emberbellRepairMissing();
    html = `<b>Emberbell neu kalibrieren</b><small>Auf Pyra-9: ▣ ${EMBERBELL_REPAIR.alloy} Glutlegierung · ⬢ ${EMBERBELL_REPAIR.ember} Glutstein · ⬡ ${EMBERBELL_REPAIR.ore} Erz${missing.length ? ' – es fehlen ' + missing.join(', ') : ''}</small><button id="repairEmberbell" ${missing.length ? 'disabled' : ''}>NEU KALIBRIEREN</button>`;
  } else return;
  card.classList.remove('hidden');
  setHTML(card, html);
  if (eb.stage === 'drones') $('enemyName').textContent = 'Hitzedrohne ' + Math.min(2, eb.drones + 1) + '/2';
  if (eb.stage === 'battle') {
    $('enemyName').textContent = 'Emberbell · Hitzewächter';
    $('enemyHealth').style.width = (eb.hp / Math.max(1, eb.maxHp)) * 100 + '%';
    $('enemyHealthText').textContent = fmt(eb.hp) + ' / ' + fmt(eb.maxHp);
    $('battleReward').textContent = '6k';
    $('dropPreview').textContent = 'Belohnung: 6.000 ◈, 6 Kristalle, 8 Gems, 1 Talent-Kapsel und ein neuer Freund';
  }
  if (['drones', 'battle'].includes(eb.stage)) {
    $('battleKicker').textContent = 'PYRA-9 · STORY';
    $('battleTitle').textContent = 'Emberbells Hitzeschutz';
  }
}
document.addEventListener('click', event => {
  if (event.target.closest('#repairEmberbell')) repairEmberbell();
  if (event.target.closest('[data-feed-console]')) feedCoolingConsole();
});
const sheetExtraBeforePyra = window.sheetExtra;
window.sheetExtra = key => {
  const base = sheetExtraBeforePyra?.(key) || '';
  if (key !== 'foundry' || !isPyra()) return base;
  const eb = emberbell();
  if (eb.stage === 'console')
    return base + `<div class="sheet-manager manual"><i class="manager-icon">❄</i><div><b>Kühlkonsole ${eb.console} / ${EMBER_CONSOLE_ALLOYS}</b><small>Speise Glutlegierung als Hitzeschild ein, damit Tikki die alte Konsole öffnen kann.</small></div><button data-feed-console ${colonyAt().stock.emberAlloy >= 1 ? '' : 'disabled'}>1 LEGIERUNG EINSPEISEN</button></div>`;
  if (eb.stage === 'repaired') return base + `<p class="sheet-effect">Emberbell hilft mit: Glutschmelze +20 %, Glutstein +15 %, keine Stufengrenze.</p>`;
  if (['drones', 'battle', 'defeated'].includes(eb.stage)) return base + `<p class="sheet-effect">Kühlkonsole offen · Emberbell wehrt sich noch (Abenteuer-Tab).</p>`;
  return base + `<p class="sheet-effect">Über Stufe ${PYRA_LEVEL_CAP} überhitzt die Schmelze, solange Emberbell die Kühlklappen verschlossen hält.</p>`;
};
const renderObjectiveBeforePyra = renderObjective;
const storyGoalBeforePyra = planetStoryGoalActive;
planetStoryGoalActive = () => storyGoalBeforePyra() || (isPyra() && ['overheated', 'console', 'defeated'].includes(emberbell().stage));
renderObjective = function () {
  renderObjectiveBeforePyra();
  const eb = emberbell(),
    card = $('objectiveCard');
  if (!isPyra() || !['overheated', 'console', 'defeated'].includes(eb.stage)) return;
  const open = undergroundOpen(),
    foundryBuilt = (colonyAt().industry.foundry || 0) > 0,
    goal =
      eb.stage === 'overheated'
        ? !open
          ? ['⛏', 'Förderturm bauen', 'Unter der Basaltader liegen Glutkristalle. Öffne die Mine und grabe den Glutkristall-Stollen.', 'MINE ›', 'mine']
          : !foundryBuilt
            ? ['🔥', 'Glutschmelze bauen', 'Glutstein + Rohkristalle ergeben Glutlegierung – hitzefest genug für Pyra.', 'BAUEN ›', 'foundry']
            : ['⛏', 'Magmaspalte graben', 'Die Glutschmelze kühlt den Bohrer – grabe Schacht 3. Dort soll eine alte Konsole liegen.', 'MINE ›', 'mine']
        : eb.stage === 'console'
          ? ['❄', 'Kühlkonsole ' + eb.console + ' / ' + EMBER_CONSOLE_ALLOYS, 'Speise Glutlegierung an der Glutschmelze ein.', 'SCHMELZE ›', 'foundry']
          : ['🔧', 'Emberbell neu kalibrieren', 'Er ist erschöpft. Kalibriere ihn im Abenteuer-Tab neu.', 'ABENTEUER ›', ''];
  $('objectiveIcon').textContent = goal[0];
  $('objectiveTitle').textContent = goal[1];
  $('objectiveText').textContent = goal[2];
  $('objectiveAction').textContent = goal[3];
  card.dataset.screen = goal[4] ? 'home' : 'battle';
  card.dataset.sheet = goal[4] === 'mine' ? '0' : goal[4];
};
const renderBeforePyra = render;
render = () => {
  updateEmberbell();
  renderBeforePyra();
  if (currentScreen() === 'battle') renderEmberbellCard();
};
const screenUnlockedBeforePyra = screenUnlocked;
screenUnlocked = screen => screenUnlockedBeforePyra(screen) || (screen === 'battle' && ['drones', 'battle', 'defeated', 'repaired'].includes(emberbell().stage));
render();
