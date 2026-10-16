// Viridia Bloom chapter (session 11): "Das stille Wurzelnetz" — Petalguard's story with Mochi and Void, the Wurzelknoten
// (root network sheet + healing with real Biogel), Dornenranken, the Blütenzyklus boss, her repair and the UI hooks.
// State lives in state.meta.guardians.petalguard and colony.roots (viridia.js). Loaded after cogsworth-ui.js (wraps
// the battle button after P.I.P.S., Frostbyte, Emberbell and Cogsworth, who keep priority).
//
// Boss mechanic — Blütenzyklus (distinct from shield / ice plates / heat pressure / Taktband):
//   bud    "Knospe" (7 s): petals closed — 50 % damage; in the last 2 s the bloom is telegraphed; 2 wilted petals regrow
//   bloom  "Blüte" (6 s): every living petal heals her 0.4 % of max HP per second. The player's target decides:
//          "Blüten welken" — each hit wilts a petal (Arc wilts two, an aimed shot one more), no HP damage
//          "Kern treffen"  — 150 % damage. With no petals left every hit goes to the core.
//   loss   if her healing brings her back to full HP after she had lost ≥ 10 %, she closes up: petals regrow, the cycle
//          restarts and a loss is counted — nothing else is lost.

const PG = { bud: 7000, telegraph: 2000, bloom: 6000, budFactor: 0.5, coreFactor: 1.5, healPerPetal: 0.004, regrow: 2, damagedAt: 0.9, away: 10 * 60 * 1000 };
const PETALGUARD_REWARD = { credits: 15000, crystals: 10, gems: 12, capsules: 1 };

Object.assign(STORY, {
  'pg-arrival': {
    title: 'Ankunft auf Viridia Bloom',
    lines: [
      ['mochi', 'Viridia Bloom! Alles leuchtet … und alles wächst über unsere Bauplätze.'],
      ['void', 'Die Ranken bewegen sich, wenn wir nicht hinsehen. Ich habe nachgesehen. Zweimal.'],
      ['wurzel', '… fremde Pfoten … das Netz hört euch …'],
      ['mochi', 'Ein Wurzelnetz verbindet hier alles. Bauen wir einen Sporengarten – vielleicht lässt es uns mitwachsen.']
    ]
  },
  'pg-roots': {
    title: 'Der Wurzelknoten',
    lines: [
      ['void', 'Dieser alte Wurzelknoten pulsiert. Legt man eine Wurzel zu einem Gebäude, wächst es schneller.'],
      ['mochi', 'Dann legen wir sie dahin, wo es gerade hakt – und können sie jederzeit umlegen. Tippe auf den Knoten.']
    ]
  },
  'pg-withering': {
    title: 'Die Welke',
    lines: [
      ['mochi', 'Oh nein … graue Flecken am Wurzelknoten. Der Wald welkt von innen.'],
      ['void', 'Das Biogel riecht nach frischem Regen. Vielleicht heilt es die Wurzeln?'],
      ['wurzel', '… die Welke … kommt von unten … vom stillen Anker …']
    ]
  },
  'pg-clue': {
    title: 'Ein Signal in den Wurzeln',
    lines: [
      ['void', 'Mochi, durch die Wurzeln läuft ein Signal. Ganz schwach. Es klingt wie das Schnurrnetz.'],
      ['mochi', 'Lichtanker 5 liegt unter diesem Wald. Die Welke kommt von dort.']
    ]
  },
  'pg-thorns': {
    title: 'Dornenranken',
    lines: [
      ['petalguard', 'Wer berührt meine Wurzeln? Seit der Stille welkt mein Wald – und jetzt kommt ihr. Ihr seid die Welke!'],
      ['void', 'Wir? Wir haben gerade geheilt! Okay … die Dornenranken sehen das anders.'],
      ['mochi', 'Zwei Dornenranken über Viridia – im Abenteuer-Tab. Danach müssen wir mit ihr reden.']
    ]
  },
  'pg-arrives': {
    title: 'Petalguard',
    lines: [
      ['petalguard', 'Ich bin Petalguard. M.O.T.T.E. pflanzte mich, um dieses Netz zu hüten. Ich lasse es nicht noch einmal welken!'],
      ['petalguard', 'Öffnen sich meine Blüten, heile ich. Ihr haltet mich nicht auf.'],
      ['mochi', 'Lass ihre Blüten welken, bevor sie heilt – oder triff den Kern, solange sie offen ist!']
    ]
  },
  'pg-defeated': {
    title: 'Ruhe im Wald',
    lines: [
      ['petalguard', '… ihr habt die Wurzeln nicht verletzt. Ihr habt sie geheilt. Dann war die Welke … nicht ihr?'],
      ['void', 'Nein. Aber wir finden heraus, wer. Erst bist du dran – du welkst ja selbst.'],
      ['mochi', 'Wir heilen dich mit Biogel und Leuchtsporen. Versprochen.']
    ]
  },
  'pg-repaired': {
    title: 'Viridia blüht',
    lines: [
      ['petalguard', 'Meine Blüten … sie leuchten wieder. Danke, kleine Gärtner.'],
      ['petalguard', 'Jetzt erinnere ich mich: Der Befehl, der Lichtanker 5 verstummen ließ, kam durch meine Wurzeln. Er trug ein Siegel, das ich nicht kannte.'],
      ['void', 'Ein fremdes Siegel … und auf Mekhanos ein Funkspruch ohne Absender. Jemand hat die Stille geschickt.'],
      ['mochi', 'Dann finden wir ihn. Willkommen in der Kolonie, Petalguard!']
    ]
  }
});
window.StorySpeakers = Object.assign(window.StorySpeakers || {}, {
  petalguard: { name: 'Petalguard', portrait: () => window.ViridiaArt?.petalguardPortraitURL?.(petalguardFriendly() ? 'friendly' : petalguard().stage === 'defeated' ? 'tired' : 'angry') || '' },
  wurzel: { name: 'Flüstern im Wurzelnetz', portrait: () => window.ViridiaArt?.petalguardPortraitURL?.('bud') || '' }
});
const PETAL_TALK = [
  'Leg eine Wurzel zum Biolabor, und ich singe ihm etwas vor. Pflanzen mögen das.',
  'Void schläft gern in meinen Blütenblättern. Er schnurrt dann in Grün.',
  'Der Wald erinnert sich an jeden Pfotenabdruck. Eure sind die freundlichsten seit langer Zeit.',
  'Cogsworth hat mir ein Formular für Gießkannen geschickt. Ich habe es eingepflanzt.'
];
if (typeof VOID_LINES !== 'undefined')
  VOID_LINES.push('Auf Viridia niese ich Sporen. Mochi sagt, ich leuchte dann ein bisschen.', 'Die Wurzeln flüstern. Meistens über Regen. Manchmal über uns.');
let petalTalk = 0;
const talkBeforePetalguard = window.NebulaColonyActions.talk;
window.NebulaColonyActions.talk = who => {
  if (who === 'petalguard' && petalguardFriendly()) {
    storyQueue.push(['petalguard', PETAL_TALK[petalTalk++ % PETAL_TALK.length]]);
    window.NebulaAudio?.play('collect');
    return showNextStoryLine();
  }
  if (who === 'rootnode') return openBuildingSheet('roots');
  return talkBeforePetalguard?.(who);
};

// ----- story progression (real gameplay gates) -----
function updatePetalguard() {
  const pg = petalguard(),
    vi = viridiaIndex();
  if (vi < 0) return;
  if (pg.stage === 'locked' && state.planetsUnlocked[vi]) {
    pg.stage = 'overgrown';
    storyEvent('pg-arrival');
  }
  const ind = state.colonies[vi]?.industry || {};
  if (state.planetsUnlocked[vi] && (ind.sporeGarden || 0) > 0) storyEvent('pg-roots');
  if (pg.stage === 'overgrown' && (ind.biolab || 0) > 0) {
    pg.stage = 'withering';
    storyEvent('pg-withering');
  }
}
// Heals the Wurzelknoten with one real Biogel from the Viridia stock (deducted exactly once per click).
function healRootNode() {
  const pg = petalguard(),
    colony = state.colonies[viridiaIndex()];
  if (pg.stage !== 'withering' || !(colony.stock.biogel >= 1)) return false;
  colony.stock.biogel -= 1;
  pg.healed += 1;
  feedback('upgrade', 'light');
  if (pg.healed === Math.ceil(PETALGUARD_HEAL_GEL / 2)) storyEvent('pg-clue');
  if (pg.healed >= PETALGUARD_HEAL_GEL) {
    pg.stage = 'thorns';
    pg.thorns = 0;
    storyEvent('pg-thorns');
  }
  save();
  render();
  return true;
}
// Ladder kills count as Dornenranken only at Viridia while no earlier guardian's drone/warning stage runs.
function thornScene() {
  return (
    petalguard().stage === 'thorns' &&
    !guardianArena('petalguard') &&
    state.activePlanet === viridiaIndex() &&
    pips().stage !== 'warned' &&
    frostbyte().stage !== 'drones' &&
    emberbell().stage !== 'drones' &&
    cogsworth().stage !== 'drones'
  );
}
GameEvents.on('enemy-defeated', event => {
  const pg = petalguard();
  if (typeof event.level !== 'number' || !thornScene()) return;
  pg.thorns = Math.min(2, pg.thorns + 1);
  if (pg.thorns >= 2) startPetalguardBattle();
});
function petalguardMaxHp() {
  return Math.round(9000 + 420 * state.enemyLevel);
}
function startPetalguardBattle(now = Date.now()) {
  const pg = petalguard();
  if (pg.stage !== 'thorns') return;
  Object.assign(pg, { stage: 'battle', maxHp: petalguardMaxHp(), fightStart: now, phase: 'bud', phaseAt: now, lastAt: now, petals: PETALS, damaged: false, losses: 0 });
  pg.hp = pg.maxHp;
  storyEvent('pg-arrives');
  requestSave(200);
}

// ----- Blütenzyklus (time-based, advanced on every read; deterministic through reloads) -----
let lastBloomLossAt = 0;
function pgAdvance(now = Date.now()) {
  const pg = petalguard();
  if (pg.stage !== 'battle') return pg;
  // a long absence: she has recovered calmly (no loss counted), the fight resumes with a fresh bud
  if (now - pg.lastAt > PG.away) {
    Object.assign(pg, { hp: pg.maxHp, petals: PETALS, phase: 'bud', phaseAt: now, lastAt: now, damaged: false });
    return pg;
  }
  for (let guard = 0; guard < 80; guard++) {
    if (pg.phase === 'bud') {
      const end = pg.phaseAt + PG.bud;
      if (now < end) {
        pg.lastAt = now;
        break;
      }
      Object.assign(pg, { phase: 'bloom', phaseAt: end, lastAt: end });
    } else {
      const end = pg.phaseAt + PG.bloom,
        until = Math.min(now, end);
      if (until > pg.lastAt && pg.petals > 0 && pg.hp > 0) {
        pg.hp = Math.min(pg.maxHp, pg.hp + (pg.petals * PG.healPerPetal * pg.maxHp * (until - pg.lastAt)) / 1000);
        if (pg.damaged && pg.hp >= pg.maxHp) {
          // loss: she healed back to full — closes up, petals regrow, the cycle restarts
          pg.losses += 1;
          lastBloomLossAt = until;
          Object.assign(pg, { petals: PETALS, damaged: false, phase: 'bud', phaseAt: until, lastAt: until });
          GameEvents.emit('petalguard-recovered', { losses: pg.losses });
          continue;
        }
      }
      pg.lastAt = until;
      if (now < end) break;
      Object.assign(pg, { phase: 'bud', phaseAt: end, lastAt: end, petals: Math.min(PETALS, pg.petals + PG.regrow) });
    }
  }
  return pg;
}
function pgPhaseLeft(now = Date.now()) {
  const pg = pgAdvance(now);
  return Math.max(0, pg.phaseAt + (pg.phase === 'bud' ? PG.bud : PG.bloom) - now);
}
function pgTelegraph(now = Date.now()) {
  const pg = pgAdvance(now);
  return pg.phase === 'bud' && pgPhaseLeft(now) <= PG.telegraph;
}
function setBloomTarget(target) {
  const pg = petalguard();
  if (!['core', 'petals'].includes(target) || pg.target === target) return false;
  pg.target = target;
  requestSave(200);
  return true;
}
function petalguardAttack(e) {
  const now = Date.now(),
    pg = pgAdvance(now);
  if (pg.stage !== 'battle' || pg.hp <= 0) return;
  const aimed = state.aimReady;
  let damage = 0,
    wilted = 0;
  // wilting petals is the player's decision: Tikki's strikes always go to the core
  if (pg.phase === 'bloom' && pg.target === 'petals' && pg.petals > 0 && !e?.catStrike) {
    wilted = Math.min(pg.petals, (state.ship.weaponType === 'Arc' ? 2 : 1) + (aimed ? 1 : 0));
    pg.petals -= wilted;
  } else {
    damage = attack() * (pg.phase === 'bloom' ? PG.coreFactor : PG.budFactor);
    pg.hp = Math.max(0, pg.hp - damage);
    if (pg.hp <= pg.maxHp * PG.damagedAt) pg.damaged = true;
  }
  GameEvents.emit('attack', { damage, weapon: state.ship.weaponType, aimed, overcharge: now < state.overchargeUntil, auto: !e?.isTrusted, boss: true, killed: pg.hp <= 0, level: 'petalguard', shielded: pg.phase === 'bud' || wilted > 0, wilted });
  if (wilted) {
    GameEvents.emit('petal-wilted', { wilted, left: pg.petals });
    feedback('hit', e?.isTrusted ? 'light' : null);
  } else feedback(pg.phase === 'bud' ? 'deny' : 'hit', e?.isTrusted ? 'light' : null);
  if (pg.hp <= 0) defeatPetalguard();
}
function defeatPetalguard() {
  const pg = petalguard();
  if (pg.stage !== 'battle') return;
  pg.stage = 'defeated';
  pg.phase = 'bud';
  if (!pg.rewarded) {
    pg.rewarded = true;
    earn(PETALGUARD_REWARD.credits);
    state.crystals += PETALGUARD_REWARD.crystals;
    state.gems += PETALGUARD_REWARD.gems;
    state.meta.managers.capsules += PETALGUARD_REWARD.capsules;
    seasonXp('boss');
  }
  GameEvents.emit('enemy-defeated', { boss: true, credits: PETALGUARD_REWARD.credits, rarity: 'epic', dropName: 'Petalguards Leuchtsamen', isNew: true, level: 'petalguard' });
  storyEvent('pg-defeated');
  save();
}
function petalguardRepairMissing() {
  const c = state.colonies[viridiaIndex()].stock,
    missing = [];
  if (c.biogel < PETALGUARD_REPAIR.biogel) missing.push(Math.ceil(PETALGUARD_REPAIR.biogel - c.biogel) + ' ◍ Biogel');
  if (c.spores < PETALGUARD_REPAIR.spores) missing.push(Math.ceil(PETALGUARD_REPAIR.spores - c.spores) + ' ✿ Leuchtsporen');
  if (state.ore < PETALGUARD_REPAIR.ore) missing.push(Math.ceil(PETALGUARD_REPAIR.ore - state.ore) + ' ⬡ Erz');
  return missing;
}
function repairPetalguard() {
  const pg = petalguard(),
    vi = viridiaIndex();
  if (pg.stage !== 'defeated') return false;
  const missing = petalguardRepairMissing();
  if (missing.length) return toast('Zum Heilen fehlen noch ' + missing.join(', ') + ' (auf Viridia Bloom).'), false;
  const c = state.colonies[vi].stock;
  c.biogel -= PETALGUARD_REPAIR.biogel;
  c.spores -= PETALGUARD_REPAIR.spores;
  state.ore -= PETALGUARD_REPAIR.ore;
  pg.stage = 'repaired';
  pg.repairedAt = Date.now();
  if (!state.meta.story.liberated.includes(vi)) state.meta.story.liberated.push(vi);
  window.NebulaAudio?.play('unlock');
  feedback('unlock', 'success');
  storyEvent('pg-repaired');
  save();
  render();
  return true;
}

// ----- battle button (earlier guardians keep priority) -----
function petalguardFightActive() {
  return petalguard().stage === 'battle' && pips().stage !== 'battle' && frostbyte().stage !== 'battle' && emberbell().stage !== 'battle' && cogsworth().stage !== 'battle';
}
const battleClickBeforePetalguard = $('battleButton').onclick;
$('battleButton').onclick = e => {
  if (petalguardFightActive()) {
    petalguardAttack(e);
    render();
    return;
  }
  return battleClickBeforePetalguard(e);
};

// ----- view models -----
const combatViewBeforePetalguard = window.NebulaView.combat;
window.NebulaView.combat = () => {
  const view = combatViewBeforePetalguard();
  if (view.story) return view; // earlier guardians first
  if (petalguardFightActive()) {
    const now = Date.now(),
      cur = pgAdvance(now);
    return {
      ...view,
      enemyHp: cur.hp,
      enemyMax: cur.maxHp,
      boss: false,
      story: { mode: 'petalguard', phase: cur.phase, petals: cur.petals, target: cur.target, left: pgPhaseLeft(now), telegraph: pgTelegraph(now), open: cur.phase === 'bloom', healing: cur.phase === 'bloom' && cur.petals > 0, recovered: now - lastBloomLossAt < 2500 }
    };
  }
  if (thornScene()) return { ...view, story: { mode: 'thornvine' } };
  return view;
};
const colonyViewBeforePetalguard = window.NebulaView.colony;
window.NebulaView.colony = () => {
  const view = colonyViewBeforePetalguard();
  if (!isViridia()) return view;
  const now = Date.now(),
    roots = colonyAt().roots;
  return {
    ...view,
    viridia: {
      stage: petalguard().stage,
      healed: petalguard().healed,
      bloom: petalguardFriendly(),
      roots: roots.slots.map((target, i) => ({ target, open: i < rootCount(), growing: Boolean(target) && roots.regrowAt[i] > now }))
    }
  };
};

// ----- Wurzelknoten sheet (the root network + healing the node) -----
const ROOT_LABEL = { mine: ['⛏', 'Abbau', 'Rohkristall-Förderung'], rail: ['🛒', 'Lorenbahn', 'Transport ins Lager'], sporeGarden: ['✿', 'Sporengarten', 'Leuchtsporen'], biolab: ['◍', 'Biolabor', 'Biogel'] };
function rootSheetHTML() {
  const roots = colonyAt().roots,
    n = rootCount(),
    now = Date.now(),
    pg = petalguard();
  const next =
    n >= ROOT_SLOTS
      ? 'Alle 4 Wurzeln sind gewachsen.'
      : (colonyAt().industry.sporeGarden || 0) < 5
        ? 'Nächste Wurzel: Sporengarten Lv 5.'
        : (colonyAt().industry.biolab || 0) < 10
          ? 'Nächste Wurzel: Biolabor Lv 10.'
          : 'Die letzte Wurzel wächst, wenn Petalguard geheilt ist.';
  const bonus = t => Math.round((rootBoost(t, state.activePlanet, now) - 1) * 100);
  const slot = i => {
    const target = roots.slots[i],
      locked = i >= n,
      growing = target && roots.regrowAt[i] > now,
      left = growing ? Math.ceil((roots.regrowAt[i] - now) / 1000) : 0;
    return `<li class="root-slot ${locked ? 'locked' : ''}"><b>Wurzel ${i + 1}${locked ? ' · noch nicht gewachsen' : growing ? ' · wächst ' + left + ' s' : target ? ' · ' + ROOT_LABEL[target][1] : ' · frei'}</b>${
      locked
        ? ''
        : `<div class="root-targets" role="radiogroup" aria-label="Wurzel ${i + 1} legen">${ROOT_TARGETS.map(
            t => `<button role="radio" aria-checked="${target === t}" class="${target === t ? 'active' : ''}" data-root="${i}:${t}"><span>${ROOT_LABEL[t][0]}</span>${ROOT_LABEL[t][1]}</button>`
          ).join('')}</div>`
    }</li>`;
  };
  const heal =
    pg.stage === 'withering'
      ? `<div class="sheet-manager manual"><i class="manager-icon">💧</i><div><b>Wurzelknoten heilen ${pg.healed} / ${PETALGUARD_HEAL_GEL}</b><small>Die Welke frisst sich durch den Knoten. Jedes Biogel heilt ein Stück – es wird einmal verbraucht · auf Lager: ${fmt(Math.floor(colonyAt().stock.biogel))}</small></div><button data-heal-node ${colonyAt().stock.biogel >= 1 ? '' : 'disabled'}>1 BIOGEL GEBEN</button></div>`
      : '';
  return `<button class="sheet-close" data-close-sheet aria-label="Schließen">×</button><div class="sheet-head"><span>🌳</span><div><b>Uralter Wurzelknoten</b><small>Das Wurzelnetz verbindet Viridia. Lege jede Wurzel zu der Stufe, die gerade bremst – umlegen ist kostenlos, die Wurzel wächst 60 s nach.</small></div></div><p class="sheet-effect">Abbau +${bonus('mine')} % · Lorenbahn +${bonus('rail')} % · Sporengarten +${bonus('sporeGarden')} % · Biolabor +${bonus('biolab')} %${
    activeRoots().includes('sporeGarden') && activeRoots().includes('biolab') ? ' · <b>Symbiose aktiv</b>' : ''
  }<br><small>Erste Wurzel +30 %, zweite +15 %, dritte +10 % · Sporengarten und Biolabor zusammen: Symbiose +10 % für beide. ${next}</small></p><ul class="root-slots">${Array.from({ length: ROOT_SLOTS }, (_, i) => slot(i)).join('')}</ul>${heal}`;
}
const renderIndustrySheetBeforeRoots = renderIndustrySheet;
renderIndustrySheet = (sheet, key) => {
  if (key !== 'roots') return renderIndustrySheetBeforeRoots(sheet, key);
  if (!isViridia()) return sheet.classList.add('hidden');
  setHTML(sheet, rootSheetHTML());
  sheet.classList.remove('hidden');
};

// ----- UI: battle story card, the bloom dock, Viridia objective, Biolabor sheet -----
function renderPetalguardCard() {
  const card = $('storyCard'),
    pg = petalguard();
  if (!card || ['warned', 'battle', 'defeated'].includes(pips().stage) || ['drones', 'battle', 'defeated'].includes(frostbyte().stage) || ['drones', 'battle', 'defeated'].includes(emberbell().stage) || ['drones', 'battle', 'defeated'].includes(cogsworth().stage)) return;
  let html = '';
  if (pg.stage === 'thorns') {
    html =
      state.activePlanet === viridiaIndex()
        ? `<b>Dornenranken über Viridia</b><small>Besiege 2 Dornenranken (${pg.thorns}/2). Dann stellt sich Petalguard.</small>`
        : `<b>Dornenranken über Viridia</b><small>Die Ranken wachsen nur über Viridia Bloom – wähle Viridia als Planet (${pg.thorns}/2).</small>`;
  } else if (petalguardFightActive()) {
    const cur = pgAdvance(Date.now());
    html = `<b>Wächterin: Petalguard · Blütenzyklus</b><small>Knospe: 50 % Schaden. Blüte: jede offene Blüte heilt sie – lass sie welken (Ziel „Blüten“) oder triff den Kern (150 %). Heilt sie sich ganz, beginnt der Zyklus neu. ${fmt(cur.hp)} / ${fmt(cur.maxHp)}${cur.losses ? ' · erholt ' + cur.losses + '×' : ''}</small>`;
  } else if (pg.stage === 'defeated') {
    const missing = petalguardRepairMissing();
    html = `<b>Petalguard heilen</b><small>Auf Viridia: ◍ ${PETALGUARD_REPAIR.biogel} Biogel · ✿ ${PETALGUARD_REPAIR.spores} Leuchtsporen · ⬡ ${PETALGUARD_REPAIR.ore} Erz${missing.length ? ' – es fehlen ' + missing.join(', ') : ''}</small><button id="repairPetalguard" ${missing.length ? 'disabled' : ''}>HEILEN</button>`;
  } else return;
  card.classList.remove('hidden');
  setHTML(card, html);
  if (pg.stage === 'thorns' && thornScene()) $('enemyName').textContent = 'Dornenranke ' + Math.min(2, pg.thorns + 1) + '/2';
  if (petalguardFightActive()) {
    $('enemyName').textContent = 'Petalguard · Blütenwächterin';
    $('enemyHealth').style.width = (pg.hp / Math.max(1, pg.maxHp)) * 100 + '%';
    $('enemyHealthText').textContent = fmt(pg.hp) + ' / ' + fmt(pg.maxHp);
    $('battleReward').textContent = '15k';
    $('dropPreview').textContent = 'Belohnung: 15.000 ◈, 10 Kristalle, 12 Gems, 1 Talent-Kapsel und eine neue Freundin';
  }
  if (pg.stage === 'thorns' || petalguardFightActive()) {
    $('battleKicker').textContent = 'VIRIDIA BLOOM · STORY';
    $('battleTitle').textContent = 'Das stille Wurzelnetz';
  }
}
function bloomStatus(cur, now) {
  const left = Math.ceil(pgPhaseLeft(now) / 1000),
    petals = '🌸'.repeat(cur.petals) + '·'.repeat(PETALS - cur.petals);
  if (now - lastBloomLossAt < 4000) return `<p class="tb-status violation" role="status">↺ <b>ERHOLT</b> Petalguard hat sich ganz geheilt – der Zyklus beginnt neu. Lass ihre Blüten welken!</p>`;
  if (cur.phase === 'bloom')
    return `<p class="tb-status window" role="status">🌸 <b>BLÜTE · ${left} s</b> ${cur.petals ? 'heilt +' + (cur.petals * PG.healPerPetal * 100).toFixed(1).replace('.', ',') + ' %/s' : 'keine Blüte heilt mehr'} · ${petals} · Kern 150 %</p>`;
  if (pgTelegraph(now)) return `<p class="tb-status window" role="status">⚠ <b>BLÜTE ÖFFNET SICH IN ${left} s</b> · ${petals} · wähle dein Ziel</p>`;
  return `<p class="tb-status inspect" role="status">🌱 <b>KNOSPE · ${left} s</b> geschlossen: 50 % Schaden · ${petals}</p>`;
}
function bloomButtons(cur) {
  return `<div class="tb-controls bloom-targets" role="radiogroup" aria-label="Ziel wählen">${[
    ['petals', '🌸', 'Blüten welken'],
    ['core', '💚', 'Kern treffen']
  ]
    .map(([id, icon, label]) => `<button role="radio" aria-checked="${cur.target === id}" data-bloom-target="${id}" class="tb-part${cur.target === id ? ' ready' : ''}"><b>${icon}</b><span>${label}</span></button>`)
    .join('')}</div>`;
}
function updateBloomDock() {
  const dock = $('bloomDock'),
    on = currentScreen() === 'battle' && petalguardFightActive();
  if (on) document.body.classList.add('taktband-active');
  else if (!(currentScreen() === 'battle' && typeof cogsworthFightActive === 'function' && cogsworthFightActive())) document.body.classList.remove('taktband-active');
  if (!dock) return;
  dock.hidden = !on;
  if (!on) return;
  const now = Date.now(),
    cur = pgAdvance(now);
  setHTML(dock, bloomStatus(cur, now) + bloomButtons(cur));
}
setInterval(() => {
  if (document.hidden || currentScreen() !== 'battle' || !petalguardFightActive()) return;
  updateBloomDock();
}, 250);
GameEvents.on('petalguard-recovered', () => {
  toast('Petalguard hat sich vollständig erholt – lass ihre Blüten welken, bevor sie heilt!');
  feedback('deny', 'warning');
});
document.addEventListener('click', event => {
  if (event.target.closest('#repairPetalguard')) return repairPetalguard();
  if (event.target.closest('[data-heal-node]')) {
    const pg = petalguard();
    if (!healRootNode()) return toast('Kein Biogel auf Lager – das Biolabor setzt welches an.');
    return toast(pg.stage === 'withering' ? 'Wurzelknoten geheilt · ' + pg.healed + ' / ' + PETALGUARD_HEAL_GEL : 'Der Knoten pulsiert wieder – und etwas Großes erwacht im Wald …');
  }
  const target = event.target.closest('[data-bloom-target]');
  if (target) {
    setBloomTarget(target.dataset.bloomTarget);
    feedback('tap', 'light');
    return updateBloomDock();
  }
  const root = event.target.closest('[data-root]');
  if (root) {
    const [slot, t] = root.dataset.root.split(':');
    if (setRoot(Number(slot), t)) {
      feedback('upgrade', 'light');
      save();
      render();
    }
  }
});
const sheetExtraBeforePetalguard = window.sheetExtra;
window.sheetExtra = key => {
  const base = sheetExtraBeforePetalguard?.(key) || '';
  if (!isViridia() || !['sporeGarden', 'biolab'].includes(key)) return base;
  const pg = petalguard(),
    rootLine = `<button class="sheet-manual mine-enter" data-root-sheet>🌳 WURZELNETZ · ${activeRoots().filter(t => t === key).length} Wurzel${activeRoots().filter(t => t === key).length === 1 ? '' : 'n'} hier ›</button>`;
  if (key === 'biolab' && pg.stage === 'withering')
    return base + `<p class="sheet-effect">Die Welke frisst den Wurzelknoten: heile ihn mit Biogel (${pg.healed} / ${PETALGUARD_HEAL_GEL}).</p>` + rootLine;
  if (pg.stage === 'repaired') return base + `<p class="sheet-effect">Petalguard singt den Pflanzen vor: Biolabor +20 %, vierte Wurzel, keine Stufengrenze.</p>` + rootLine;
  if (['thorns', 'battle', 'defeated'].includes(pg.stage)) return base + `<p class="sheet-effect">Der Knoten ist geheilt · Petalguard wehrt sich noch (Abenteuer-Tab).</p>` + rootLine;
  return base + `<p class="sheet-effect">Über Stufe ${VIRIDIA_LEVEL_CAP} hält die Welke den Wuchs auf – erst Petalguard heilen. Gebaute Stufen bleiben.</p>` + rootLine;
};
document.addEventListener('click', event => {
  if (event.target.closest('[data-root-sheet]')) openBuildingSheet('roots');
});
// open Viridia chapter steps; after the repair the way to the Herzwurzel-Kammer
function petalguardGoalOpen() {
  const pg = petalguard();
  if (!isViridia()) return false;
  if (['overgrown', 'withering', 'thorns', 'defeated'].includes(pg.stage)) return true;
  return pg.stage === 'repaired' && !shaftBuilt('shaft3') && !shaftUnderConstruction('shaft3');
}
const storyGoalBeforePetalguard = planetStoryGoalActive;
planetStoryGoalActive = () => storyGoalBeforePetalguard() || petalguardGoalOpen();
const renderObjectiveBeforePetalguard = renderObjective;
renderObjective = function () {
  renderObjectiveBeforePetalguard();
  const pg = petalguard(),
    card = $('objectiveCard');
  if (!petalguardGoalOpen()) return;
  const ind = colonyAt().industry,
    goal =
      pg.stage === 'overgrown'
        ? !(ind.sporeGarden > 0)
          ? ['✿', 'Sporengarten anlegen', 'Die Riesenblüten tragen Leuchtsporen. Ernte sie – das Wurzelnetz wächst mit.', 'BAUEN ›', 'sporeGarden']
          : ['◍', 'Biolabor bauen', 'Aus Leuchtsporen und Rohkristallen entsteht Biogel. Vielleicht heilt es den Wald.', 'BAUEN ›', 'biolab']
        : pg.stage === 'withering'
          ? ['💧', 'Wurzelknoten heilen ' + pg.healed + ' / ' + PETALGUARD_HEAL_GEL, 'Gib dem Knoten Biogel. Tippe ihn in der Kolonie an.', 'KNOTEN ›', 'roots']
          : pg.stage === 'thorns'
            ? ['🌿', 'Dornenranken ' + pg.thorns + ' / 2', 'Besiege die Ranken über Viridia im Abenteuer-Tab.', 'ABENTEUER ›', '']
            : pg.stage === 'defeated'
              ? ['🌸', 'Petalguard heilen', 'Sie welkt selbst. Heile sie im Abenteuer-Tab mit Biogel und Leuchtsporen.', 'ABENTEUER ›', '']
              : !undergroundOpen()
                ? ['⛏', 'Wurzelgalerien öffnen', canOpenUnderground() ? 'Unter Viridia warten Leuchtpilze und die Herzwurzel. Öffne die Mine.' : 'Automatisiere die Oberfläche, dann öffne die Mine unter Viridia.', 'MINE ›', 'mine']
                : !shaftBuilt('shaft2')
                  ? ['🍄', shaftUnderConstruction('shaft2') ? 'Leuchtpilz-Grotte im Bau' : 'Leuchtpilz-Grotte graben', 'Die Herzwurzel liegt tiefer – erst die Grotte.', 'MINE ›', 'mine']
              : shaftLevel('shaft2') >= 5
                ? ['🌳', 'Herzwurzel-Kammer graben', 'Petalguard hat die Dornen geöffnet – Schacht 3 wartet.', 'MINE ›', 'mine']
                : ['🍄', 'Leuchtpilz-Grotte auf Stufe ' + shaftLevel('shaft2') + ' / 5', 'Die Herzwurzel liegt tiefer. Bring den Grotten-Bohrer auf Stufe 5.', 'MINE ›', 'mine'];
  $('objectiveIcon').textContent = goal[0];
  $('objectiveTitle').textContent = goal[1];
  $('objectiveText').textContent = goal[2];
  $('objectiveAction').textContent = goal[3];
  card.dataset.screen = goal[4] ? 'home' : 'battle';
  card.dataset.sheet = goal[4] === 'mine' ? '0' : goal[4];
};
const renderBeforePetalguard = render;
render = () => {
  updatePetalguard();
  renderBeforePetalguard();
  if (currentScreen() === 'battle') renderPetalguardCard();
  updateBloomDock();
};
const screenUnlockedBeforePetalguard = screenUnlocked;
screenUnlocked = screen => screenUnlockedBeforePetalguard(screen) || (screen === 'battle' && ['thorns', 'battle', 'defeated', 'repaired'].includes(petalguard().stage));
render();
