// Frostbyte — the Glacies Niva liberation (story, heat network task, frost drones, boss fight, repair, friendship).
// State lives in state.meta.guardians.frostbyte (normalised in industry.js); this file holds the story flow, the boss
// mechanic and the view-model/UI hooks. Loaded after game.js.
//
// Boss mechanic (different from P.I.P.S.): three crystal armour plates absorb 85 % of every hit. Heat breaks them —
// every hit during Overcharge cracks a plate, an aimed shot cracks one too. Without plates Frostbyte is "thawed" for
// 8 s and takes 150 % damage, then the plates regrow. Every 12 s he telegraphs "Frostatem" (2 s warning) and then
// freezes the cannon for 3 s (half damage) — unless Overcharge keeps the ship warm.

const FB_CYCLE = 12000,
  FB_WARN = [6000, 8000],
  FB_FREEZE = [8000, 11000],
  FB_THAW_MS = 8000;
let fbThawUntil = 0;

Object.assign(STORY, {
  'fb-frozen': {
    title: 'Glacies im Kälteschlaf',
    lines: [
      ['nori', 'Brrr … hier ist ja alles eingefroren! Die Häuser sind dunkel.'],
      ['flocke', 'Seit der Großen Stille hält FROSTBYTE das Wärmenetz verschlossen. Er glaubt, Wärme würde den Planeten zerstören.'],
      ['mochi', 'Dann bauen wir eine Thermalwerkstatt und bringen das Wärmenetz Stück für Stück zurück!']
    ]
  },
  'fb-heating': {
    title: 'Das Wärmenetz',
    lines: [['tikki', 'Die Werkstatt läuft! Das Wärmenetz braucht 6 Thermalzellen zum Hochfahren – speise sie an der Thermalwerkstatt ein.']]
  },
  'fb-heat': {
    title: 'Die Leitungen glühen',
    lines: [
      ['flocke', 'Es wird warm! Die Lichter gehen wieder an!'],
      ['frostbyte', 'W-W-Wärme erkannt! Schutzprotokoll! Frostdrohnen – bitte alles wieder einfrieren!']
    ]
  },
  'fb-arrives': {
    title: 'Frostbyte persönlich',
    lines: [
      ['frostbyte', 'Ich … ich muss den Planeten schützen! Kristallpanzer aktiviert!'],
      ['boba', 'Sein Eispanzer schluckt fast alles. Overcharge macht Hitze – damit knacken wir die Platten!']
    ]
  },
  'fb-defeated': {
    title: 'Ein frierender Wächter',
    lines: [['mochi', 'Frostbyte zittert … er ist ganz in seinem eigenen Eis gefangen. Tikki, kannst du ihn neu kalibrieren?']]
  },
  'fb-repaired': {
    title: 'Ein warmer Freund',
    lines: [
      ['frostbyte', 'Kalibrierung abgeschlossen … Wärme ist … gut? Ich hatte solche Angst, etwas kaputt zu machen.'],
      ['frostbyte', 'Danke, kleine Kätzchen. Ab jetzt passe ich auf das Wärmenetz auf – und auf euch.']
    ]
  }
});
window.StorySpeakers = Object.assign(window.StorySpeakers || {}, {
  frostbyte: { name: 'Frostbyte', portrait: () => window.NebulaArt?.frostbytePortraitURL?.(frostbyte().stage === 'repaired' || frostbyte().stage === 'defeated') || '' },
  flocke: {
    name: 'Flocke',
    portrait: () =>
      window.SpaceKittens?.managerPortraitURL?.('flocke', window.SpaceKittens.WORKERS[3], { hat: 'cap', hatColor: '#8fe3ff', jacket: '#bfe3f2', bowtie: '#ff9ecb' }, 96, 1, frostbyte().stage === 'repaired' ? 'happy' : 'worried') || ''
  }
});

// ----- story progression -----
function updateFrostbyte() {
  const fb = frostbyte(),
    gi = glaciesIndex();
  if (gi < 0) return;
  if (fb.stage === 'locked' && state.planetsUnlocked[gi]) {
    fb.stage = 'frozen';
    storyEvent('fb-frozen');
  }
  if (fb.stage === 'frozen' && state.colonies[gi].industry.thermal > 0) {
    fb.stage = 'heating';
    storyEvent('fb-heating');
  }
}
// Feeds real Thermalzellen from the Glacies colony into the heat network.
function feedHeatNetwork() {
  const fb = frostbyte(),
    gi = glaciesIndex(),
    colony = state.colonies[gi];
  if (fb.stage !== 'heating' || !(colony.stock.cells >= 1)) return false;
  colony.stock.cells -= 1;
  fb.heat += 1;
  GameEvents.emit('heat', { heat: fb.heat });
  feedback('upgrade', 'light');
  if (fb.heat >= HEAT_CELLS_NEEDED) {
    fb.stage = 'drones';
    fb.drones = 0;
    storyEvent('fb-heat');
    if (frostArena()) storyEvent('glacies-campaign'); // Beta 1.5: the Frostwacht campaign opens
  }
  save();
  render();
  return true;
}
// Beta 1.5: on Glacies the Frostwacht is an arena campaign (nine waves, then Frostbyte as the arena guardian); the classic
// two-drone path and the classic boss fight remain only for the dev-only classic mode.
function frostArena() {
  return Boolean(CAMPAIGN_FLAGS.ice && typeof campaignMode === 'function' && campaignMode() === 'arena');
}
// Ladder kills count as frost drones while Frostbyte's drones are out (P.I.P.S.' inspection has priority).
GameEvents.on('enemy-defeated', event => {
  const fb = frostbyte();
  if (frostArena() || fb.stage !== 'drones' || pips().stage === 'warned' || typeof event.level !== 'number') return;
  fb.drones = Math.min(2, fb.drones + 1);
  if (fb.drones >= 2) {
    fb.stage = 'battle';
    fb.maxHp = 1500 + 120 * state.enemyLevel;
    fb.hp = fb.maxHp;
    fb.plates = 3;
    fb.fightStart = Date.now();
    fbThawUntil = 0;
    storyEvent('fb-arrives');
    requestSave(200);
  }
});

// ----- boss mechanics -----
function fbCycle(now = Date.now()) {
  return (now - frostbyte().fightStart) % FB_CYCLE;
}
function fbTelegraph(now = Date.now()) {
  const t = fbCycle(now);
  return frostbyte().stage === 'battle' && t >= FB_WARN[0] && t < FB_WARN[1];
}
function fbFrozenCannon(now = Date.now()) {
  const t = fbCycle(now);
  return frostbyte().stage === 'battle' && t >= FB_FREEZE[0] && t < FB_FREEZE[1] && now >= state.overchargeUntil;
}
function fbThawed(now = Date.now()) {
  const fb = frostbyte();
  if (fb.stage !== 'battle') return false;
  if (fb.plates === 0 && now >= fbThawUntil) fb.plates = 3; // plates regrow after the thaw window
  return fb.plates === 0 && now < fbThawUntil;
}
function frostbyteAttack(e) {
  const fb = frostbyte(),
    now = Date.now(),
    aimed = state.aimReady,
    hot = now < state.overchargeUntil,
    thawedBefore = fbThawed(now),
    base = attack();
  let factor = thawedBefore ? 1.5 : fb.plates > 0 ? 0.15 : 1;
  if (fbFrozenCannon(now)) factor *= 0.5;
  let cracked = false;
  if (!thawedBefore && fb.plates > 0 && (hot || aimed)) {
    fb.plates -= 1;
    cracked = true;
    if (fb.plates === 0) fbThawUntil = now + FB_THAW_MS;
  }
  const damage = base * factor;
  fb.hp = Math.max(0, fb.hp - damage);
  GameEvents.emit('attack', { damage, weapon: state.ship.weaponType, aimed, overcharge: hot, auto: !e.isTrusted, boss: true, killed: fb.hp <= 0, level: 'frostbyte', shielded: fb.plates > 0 && !cracked });
  if (cracked) GameEvents.emit('boss-phase', { level: 'frostbyte', plates: fb.plates });
  feedback(factor < 0.5 ? 'deny' : 'hit', e.isTrusted ? 'light' : null);
  if (fb.hp <= 0) defeatFrostbyte();
}
function defeatFrostbyte() {
  const fb = frostbyte();
  if (fb.stage !== 'battle') return;
  fb.stage = 'defeated';
  earn(4000);
  state.crystals += 5;
  state.gems += 8;
  state.meta.managers.capsules += 1;
  seasonXp('boss');
  GameEvents.emit('enemy-defeated', { boss: true, credits: 4000, rarity: 'epic', dropName: 'Frostbyte-Kühlkern', isNew: true, level: 'frostbyte' });
  storyEvent('fb-defeated');
  save();
}
function frostbyteRepairMissing() {
  const c = state.colonies[glaciesIndex()].stock,
    missing = [];
  if (c.cells < FROSTBYTE_REPAIR.cells) missing.push(Math.ceil(FROSTBYTE_REPAIR.cells - c.cells) + ' ♨');
  if (c.frost < FROSTBYTE_REPAIR.frost) missing.push(Math.ceil(FROSTBYTE_REPAIR.frost - c.frost) + ' ❄');
  if (state.ore < FROSTBYTE_REPAIR.ore) missing.push(Math.ceil(FROSTBYTE_REPAIR.ore - state.ore) + ' ⬡');
  return missing;
}
function repairFrostbyte() {
  const fb = frostbyte(),
    gi = glaciesIndex();
  if (fb.stage !== 'defeated') return false;
  const missing = frostbyteRepairMissing();
  if (missing.length) return toast('Für die Reparatur fehlen noch ' + missing.join(', ') + ' (auf Glacies).'), false;
  const c = state.colonies[gi].stock;
  c.cells -= FROSTBYTE_REPAIR.cells;
  c.frost -= FROSTBYTE_REPAIR.frost;
  state.ore -= FROSTBYTE_REPAIR.ore;
  fb.stage = 'repaired';
  if (!state.meta.story.liberated.includes(gi)) state.meta.story.liberated.push(gi);
  window.NebulaAudio?.play('meow');
  feedback('unlock', 'success');
  storyEvent('fb-repaired');
  save();
  render();
  return true;
}

// ----- battle button: Frostbyte fight routes here -----
const battleClickBeforeFrostbyte = $('battleButton').onclick;
$('battleButton').onclick = e => {
  if (frostbyte().stage === 'battle' && pips().stage !== 'battle') {
    frostbyteAttack(e);
    render();
    return;
  }
  return battleClickBeforeFrostbyte(e);
};

// ----- view models -----
const combatViewBeforeFrostbyte = window.NebulaView.combat;
window.NebulaView.combat = () => {
  const view = combatViewBeforeFrostbyte(),
    fb = frostbyte(),
    now = Date.now();
  if (view.story) return view; // P.I.P.S. has priority
  if (fb.stage === 'battle')
    return { ...view, enemyHp: fb.hp, enemyMax: fb.maxHp, boss: false, story: { mode: 'frostbyte', plates: fb.plates, thawed: fbThawed(now), telegraph: fbTelegraph(now), frozenCannon: fbFrozenCannon(now) } };
  if (fb.stage === 'drones') return { ...view, story: { mode: 'frostdrone' } };
  return view;
};
const colonyViewBeforeFrostbyte = window.NebulaView.colony;
window.NebulaView.colony = () => {
  const view = colonyViewBeforeFrostbyte(),
    ice = PLANETS[state.activePlanet]?.id === 'ice';
  return { ...view, heated: glaciesHeated(), frostbyte: ice ? frostbyte().stage : null, heat: frostbyte().heat };
};

// ----- UI: battle story card, Glacies objective, thermal sheet row -----
function renderFrostbyteCard() {
  const card = $('storyCard'),
    fb = frostbyte(),
    p = pips();
  if (!card || ['warned', 'battle', 'defeated'].includes(p.stage)) return;
  let html = '';
  if (fb.stage === 'drones' && frostArena()) {
    // Beta 1.5: the Frostwacht campaign (arena) — where it is played and how far it is
    const done = campaignCleared('ice'),
      total = CAMPAIGNS.ice.waves.length,
      here = PLANETS[state.activePlanet]?.id === 'ice';
    html = `<b>Die Frostwacht über Glacies</b><small>${done >= total ? 'Alle Wachen geschafft – Frostbyte wartet auf die Wächter-Expedition.' : 'Feldzug ' + done + '/' + total + ' – Frostbytes Drohnen hüten das Wärmenetz.'} ${here ? 'Expedition im Abenteuer-Tab starten.' : 'Fliege nach Glacies, dort startet die Expedition.'}</small>`;
    card.classList.remove('hidden');
    setHTML(card, html);
    return;
  }
  if (fb.stage === 'drones') html = `<b>Frostdrohnen über Glacies</b><small>Besiege 2 Frostdrohnen (${fb.drones}/2). Dann stellt sich Frostbyte.</small>`;
  else if (fb.stage === 'battle') {
    const now = Date.now(),
      thawed = fbThawed(now);
    html = `<b>Wächter: Frostbyte</b><small>${
      fbFrozenCannon(now)
        ? '❄ Kanone eingefroren: halber Schaden – Overcharge hält das Schiff warm!'
        : fbTelegraph(now)
          ? '⚠ Frostatem lädt – gleich friert die Kanone ein (Overcharge schützt).'
          : thawed
            ? '🔥 Aufgetaut! 150 % Schaden für ' + Math.ceil((fbThawUntil - now) / 1000) + ' s.'
            : '🧊 ' + fb.plates + ' Eisplatten: nur 15 % Schaden. Overcharge oder Zielschuss knackt eine Platte pro Treffer.'
    } · ${fmt(fb.hp)} / ${fmt(fb.maxHp)}</small>`;
  } else if (fb.stage === 'defeated') {
    const missing = frostbyteRepairMissing();
    html = `<b>Frostbyte neu kalibrieren</b><small>Auf Glacies: ♨ ${FROSTBYTE_REPAIR.cells} Thermalzellen · ❄ ${FROSTBYTE_REPAIR.frost} Frostquarz · ⬡ ${FROSTBYTE_REPAIR.ore} Erz${missing.length ? ' – es fehlen ' + missing.join(', ') : ''}</small><button id="repairFrostbyte" ${missing.length ? 'disabled' : ''}>REPARIEREN</button>`;
  } else return;
  card.classList.remove('hidden');
  setHTML(card, html);
  if (fb.stage === 'drones') $('enemyName').textContent = 'Frostdrohne ' + Math.min(2, fb.drones + 1) + '/2';
  if (fb.stage === 'battle') {
    $('enemyName').textContent = 'Frostbyte · Kältewächter';
    $('enemyHealth').style.width = (fb.hp / Math.max(1, fb.maxHp)) * 100 + '%';
    $('enemyHealthText').textContent = fmt(fb.hp) + ' / ' + fmt(fb.maxHp);
    $('battleReward').textContent = '4k';
    $('dropPreview').textContent = 'Belohnung: 4.000 ◈, 5 Kristalle, 8 Gems, 1 Talent-Kapsel und ein neuer Freund';
  }
  if (['drones', 'battle'].includes(fb.stage)) {
    $('battleKicker').textContent = 'GLACIES · STORY';
    $('battleTitle').textContent = 'Frostbytes Kälteschutz';
  }
}
document.addEventListener('click', event => {
  if (event.target.closest('#repairFrostbyte')) repairFrostbyte();
  if (event.target.closest('[data-feed-heat]')) feedHeatNetwork();
});
// Thermal workshop sheet: the heat network task (real cells from the Glacies stock).
window.sheetExtra = key => {
  const fb = frostbyte();
  if (key !== 'thermal' || PLANETS[state.activePlanet]?.id !== 'ice') return '';
  if (fb.stage === 'heating')
    return `<div class="sheet-manager manual"><i class="manager-icon">♨</i><div><b>Wärmenetz ${fb.heat} / ${HEAT_CELLS_NEEDED}</b><small>Speise Thermalzellen ein, um die Heizung der Kolonie wieder zu starten.</small></div><button data-feed-heat ${colonyAt().stock.cells >= 1 ? '' : 'disabled'}>1 ZELLE EINSPEISEN</button></div>`;
  if (fb.stage === 'repaired') return `<p class="sheet-effect">Frostbyte hilft mit: Thermalwerkstatt +25 %, Frostquarz +15 %, keine Stufengrenze.</p>`;
  if (['drones', 'battle', 'defeated'].includes(fb.stage)) return `<p class="sheet-effect">Wärmenetz läuft · Frostbyte wehrt sich noch (Abenteuer-Tab).</p>`;
  return '';
};
const renderObjectiveBeforeFrostbyte = renderObjective;
const storyGoalBeforeFrostbyte = planetStoryGoalActive;
planetStoryGoalActive = () => storyGoalBeforeFrostbyte() || (PLANETS[state.activePlanet]?.id === 'ice' && ['frozen', 'heating', 'defeated'].includes(frostbyte().stage));
renderObjective = function () {
  renderObjectiveBeforeFrostbyte();
  const fb = frostbyte(),
    card = $('objectiveCard');
  if (PLANETS[state.activePlanet]?.id !== 'ice' || !['frozen', 'heating', 'defeated'].includes(fb.stage)) return;
  const goal =
    fb.stage === 'frozen'
      ? !(colonyAt().industry.frostDrill > 0)
        ? ['❄', 'Frostquarz-Bohrer bauen', 'Glacies ist eingefroren (−20 % Förderung). Der Bohrer liefert Frostquarz – danach baust du die Thermalwerkstatt.', 'BAUEN ›', 'frostDrill']
        : ['♨', 'Thermalwerkstatt bauen', 'Glacies ist eingefroren (−20 % Förderung). Aus Frostquarz und Rohkristallen entstehen Thermalzellen.', 'BAUEN ›', 'thermal']
      : fb.stage === 'heating'
        ? ['♨', 'Wärmenetz ' + fb.heat + ' / ' + HEAT_CELLS_NEEDED, 'Fertige Thermalzellen und speise sie an der Thermalwerkstatt ein.', 'WERKSTATT ›', 'thermal']
        : ['🔧', 'Frostbyte reparieren', 'Er ist besiegt, aber zittert. Repariere ihn im Abenteuer-Tab.', 'ABENTEUER ›', ''];
  $('objectiveIcon').textContent = goal[0];
  $('objectiveTitle').textContent = goal[1];
  $('objectiveText').textContent = goal[2];
  $('objectiveAction').textContent = goal[3];
  card.dataset.screen = goal[4] ? 'home' : 'battle';
  card.dataset.sheet = goal[4] === 'frostDrill' && colonyAt().industry.frostDrill > 0 ? 'thermal' : goal[4];
};
const renderBeforeFrostbyte = render;
render = () => {
  updateFrostbyte();
  renderBeforeFrostbyte();
  if (currentScreen() === 'battle') renderFrostbyteCard();
};
// The combat tab opens for the Frostbyte story too.
const screenUnlockedBeforeFrostbyte = screenUnlocked;
screenUnlocked = screen => screenUnlockedBeforeFrostbyte(screen) || (screen === 'battle' && ['drones', 'battle', 'defeated', 'repaired'].includes(frostbyte().stage));
render();
