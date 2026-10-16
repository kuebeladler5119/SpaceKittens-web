// Combat HUD, combat action dock and ship workshop (premium combat & ship UI).
// Presentation only: every number shown here is read from the real combat rules (attack(), enemyInfo(), guardian
// state). Previewing a model, weapon or module in the workshop never spends anything — only the explicit buy/equip
// button (data-ship / data-model / data-weapon, handled in game.js) changes the save.
// Loaded after bazaar.js, before platform.js.

const WEAPON_INFO = {
  Laser: { color: '#8fe3ff', icon: '│', text: 'Sofortiger Strahl · verlässlicher Basisschaden.', price: null },
  Plasma: { color: '#8ff0d4', icon: '●', text: 'Plasmakugeln · +25 % Schaden gegen Bosse.', price: { credits: 750 } },
  Arc: { color: '#ffe26b', icon: 'ϟ', text: 'Kettenblitz · +8 % Schaden in jedem Kampf.', price: { gems: 8 } },
  Ion: { color: '#c4b3ff', icon: '◎', text: 'Ionen-Salven · +12 % Schaden in jedem Kampf.', price: { credits: 2200 } },
  Nova: { color: '#ff9ecb', icon: '✸', text: 'Nova-Torpedo · +16 % Schaden gegen Bosse.', price: { gems: 15 } }
};
const MODEL_INFO = {
  Horizon: { text: 'Ausgewogenes Schiff für jede Mission.', price: null },
  Comet: { text: '+15 % Schaden und 5 s längerer Overcharge.', price: { credits: 1500 } },
  Aegis: { text: '+8 % bessere Item-Chance aus Gegnern.', price: { gems: 10 } },
  Vanguard: { text: '+10 % Präzisionsschaden im Zielmodus.', price: { bosses: 2 } },
  Corsair: { text: '+10 % Kampfschaden für schnelle Sektorjagden.', price: { credits: 4500 } },
  Pioneer: { text: '+8 % Grundschaden bei Erkundungsmissionen.', price: { gems: 12 } }
};
const MODULE_INFO = {
  weapon: { name: 'Waffen', icon: '⚔' },
  hull: { name: 'Hülle', icon: '⬡' },
  engine: { name: 'Antrieb', icon: '➤' },
  core: { name: 'Gem-Kern', icon: '◆' }
};
let workshopPreview = { kind: 'current', id: null };

function combatPilot() {
  return crewActive(1) ? 1 : 0;
}
function shipPalette() {
  const Art = window.NebulaArt;
  return Art.SHIP_PALETTES[state.meta?.equipped?.ship] || Art.SHIP_PALETTES.default;
}
// Pure "what if" read: evaluates fn with a temporary ship configuration and always restores the real one.
function withShip(gear, fn) {
  const real = state.ship;
  state.ship = { ...real, ...gear };
  try {
    return fn();
  } finally {
    state.ship = real;
  }
}
function overchargeDuration() {
  return (state.ship.model === 'Comet' ? 20000 : 15000) + energyPower() * 500;
}

// ----- combat situation (one source for HUD, dock and attack button) -----
function combatSituation(now = Date.now()) {
  const p = pips(),
    fb = frostbyte();
  if (p.stage === 'battle')
    return {
      mode: 'pips',
      guardian: true,
      hp: p.hp,
      max: p.maxHp,
      shielded: pipsShielded(now),
      telegraph: pipsTelegraph(now)
    };
  if (fb.stage === 'battle')
    return {
      mode: 'frostbyte',
      guardian: true,
      hp: fb.hp,
      max: fb.maxHp,
      plates: fb.plates,
      thawed: fbThawed(now),
      telegraph: fbTelegraph(now),
      frozen: fbFrozenCannon(now)
    };
  const foe = enemyInfo(),
    max = enemyMaxHp();
  return {
    mode: p.stage === 'warned' && !campaignLeadsTo('pips') ? 'drone' : fb.stage === 'drones' ? 'frostdrone' : 'ladder',
    boss: foe.boss,
    hp: Math.max(0, state.enemyHp),
    max,
    phaseTwo: foe.boss && state.enemyHp / max <= 0.5,
    weakness: foe.weakness
  };
}
function tag(cls, text) {
  return `<span class="hud-tag ${cls}">${text}</span>`;
}
function weaponDot(name) {
  return `<i class="wpn-dot" style="--wpn:${WEAPON_INFO[name].color}"></i>`;
}
function enemyTags(s, now) {
  const tags = [];
  if (s.mode === 'pips') {
    tags.push(
      s.telegraph
        ? tag('warn', '⚠ Scan lädt – Schild gleich aktiv')
        : s.shielded
          ? tag('shield', '🛡 Prüfschild · nur 20 %')
          : tag('good', '✓ Verwundbar')
    );
    tags.push(tag('', '◉ Zielschuss bricht das Schild'));
  } else if (s.mode === 'frostbyte') {
    if (s.frozen) tags.push(tag('ice', '❄ Kanone gefroren · 50 %'));
    else if (s.telegraph) tags.push(tag('warn', '⚠ Frostatem lädt'));
    if (s.thawed)
      tags.push(tag('good', '🔥 Aufgetaut · 150 % · ' + Math.ceil(Math.max(0, fbThawUntil - now) / 1000) + ' s'));
    else tags.push(tag('shield', '🧊 ' + '◆'.repeat(s.plates) + '◇'.repeat(3 - s.plates) + ' Eisplatten · 15 %'));
    tags.push(tag('', '⚡ Hitze knackt Platten'));
  } else {
    const match = state.ship.weaponType === s.weakness;
    tags.push(
      tag(match ? 'good' : '', 'Schwach gegen ' + weaponDot(s.weakness) + ' ' + s.weakness + (match ? ' ✓ +15 %' : ''))
    );
    if (s.boss) tags.push(s.phaseTwo ? tag('warn', 'PHASE 2 · Kern frei') : tag('shield', 'PHASE 1 · Panzerhülle'));
  }
  return tags.join('');
}

// ----- HUD over the combat stage -----
function renderCombatHud() {
  if (!$('combatHud')) return;
  const now = Date.now(),
    s = combatSituation(now),
    card = $('enemyCard'),
    threat = s.frozen
      ? 'ice'
      : s.telegraph
        ? 'warn'
        : s.shielded || (s.mode === 'frostbyte' && !s.thawed)
          ? 'shield'
          : s.phaseTwo
            ? 'warn'
            : '';
  card.dataset.threat = threat;
  card.classList.toggle('guardian', !!s.guardian);
  $('enemyRank').textContent = s.guardian ? 'WÄCHTER · STORY' : s.mode === 'ladder' ? 'STUFE' : 'STORY · STUFE';
  if (s.guardian)
    $('combatHint').textContent =
      s.mode === 'pips'
        ? 'TAKTIK: Wenn das Prüfschild leuchtet, nur Zielschüsse – sie brechen das Schild für 2,5 s.'
        : 'TAKTIK: Overcharge oder Zielschuss knackt pro Treffer eine Eisplatte. Ohne Platten: 150 % Schaden. Overcharge schützt vor dem Frostatem.';
  $('enemyLevel').hidden = !!s.guardian;
  $('enemyPhaseMark').hidden = !(s.boss && !s.guardian);
  setHTML($('enemyTags'), enemyTags(s, now));
  // Player plate: same pilot rig as the cockpit (Kit portrait), real ship/weapon/damage.
  const Kit = window.SpaceKittens,
    mood = window.NebulaScenesRuntime?.mounted?.combat?.scene.pilotMood?.() || 'focus',
    portrait = Kit?.portraitURL?.(combatPilot(), mood, 96) || '',
    hot = now < state.overchargeUntil,
    auto = autoAttack(),
    ocLeft = Math.max(0, state.overchargeUntil - now);
  setHTML(
    $('hudPlayer'),
    `${portrait ? `<img src="${portrait}" alt="" width="40" height="40" />` : ''}<div><b>${state.ship.model} Mk.${1 + state.ship.weapon + state.ship.hull + state.ship.core + state.ship.engine}</b><small>${weaponDot(state.ship.weaponType)}${state.ship.weaponType} · ${fmt(attack())}/Schuss</small></div>${hudGearHTML()}<span class="hud-auto on" title="Automatisches Bordgeschütz: Schaden pro Sekunde">⟳ ${fmt(attack() * shipFireRate())} Schaden/s</span>${
      hot
        ? `<i class="hud-oc"><u style="width:${Math.min(100, (ocLeft / overchargeDuration()) * 100).toFixed(1)}%"></u></i>`
        : ''
    }`
  );
  renderCombatDock(s, now);
}
function actionHTML(icon, label, text, progress = null) {
  return `<span class="ca-icon">${icon}</span><b>${label}</b><small>${text}</small>${
    progress === null
      ? ''
      : `<i class="ca-bar"><u style="width:${Math.max(0, Math.min(100, progress)).toFixed(1)}%"></u></i>`
  }`;
}
function setAction(button, st, html) {
  button.dataset.state = st;
  setHTML(button, html);
}
function renderCombatDock(s = combatSituation(), now = Date.now()) {
  const aimLeft = Math.max(0, state.aimCooldownUntil - now),
    hot = now < state.overchargeUntil,
    auto = autoAttack();
  setAction(
    $('aimButton'),
    state.aimReady ? 'active' : aimLeft ? 'cooldown' : state.fuel < 1 ? 'unavailable' : 'ready',
    state.aimReady
      ? actionHTML('◉', 'ZIELEN', 'ERFASST · +65 %')
      : aimLeft
        ? actionHTML('◉', 'ZIELEN', 'Abkühlung ' + Math.ceil(aimLeft / 1000) + ' s', 100 - (aimLeft / 20000) * 100)
        : actionHTML('◉', 'ZIELEN', state.fuel < 1 ? 'Kein ⛽' : 'Bereit · ⛽ 1')
  );
  setAction(
    $('overchargeButton'),
    hot ? 'active' : state.crystals < 1 ? 'unavailable' : 'ready',
    hot
      ? actionHTML(
          '⚡',
          'OVERCHARGE',
          '3× · ' + Math.ceil((state.overchargeUntil - now) / 1000) + ' s',
          ((state.overchargeUntil - now) / overchargeDuration()) * 100
        )
      : actionHTML('⚡', 'OVERCHARGE', state.crystals < 1 ? 'Kein ◆' : 'Bereit · ◆ 1')
  );
  setAction(
    $('autoBattleButton'),
    !auto ? 'unavailable' : state.autoBattle ? 'active' : 'ready',
    actionHTML('↻', 'AUTO', !auto ? 'Boba: Hintergrund' : state.autoBattle ? 'AN · auch im Hintergrund' : 'AUS · nur hier')
  );
  // Attack button: what the next hit really does against the current target.
  let st = 'ready',
    note = '';
  if (s.mode === 'pips' && s.shielded)
    [st, note] = state.aimReady ? ['active', 'Zielschuss bricht Schild'] : ['blocked', 'Schild · 20 %'];
  else if (s.mode === 'frostbyte') {
    if (s.thawed) [st, note] = ['active', 'Aufgetaut · 150 %'];
    else if (s.plates > 0 && (hot || state.aimReady)) [st, note] = ['active', 'Knackt eine Platte'];
    else if (s.plates > 0) [st, note] = ['blocked', 'Eisplatten · 15 %'];
    if (s.frozen) note += ' · ❄ ×0,5';
  } else if (state.aimReady) [st, note] = ['active', 'Zielschuss +65 %'];
  if (hot && !note) [st, note] = ['active', 'Overcharge 3×'];
  $('battleButton').dataset.state = st;
  $('attackState').textContent = note;
}

// ----- workshop -----
function previewGear() {
  const gear = { ...state.ship },
    p = workshopPreview;
  if (p.kind === 'model') gear.model = p.id;
  if (p.kind === 'weapon') gear.weaponType = p.id;
  if (p.kind === 'upgrade') gear[p.id] = (gear[p.id] || 0) + 1;
  return gear;
}
function priceText(price) {
  if (!price) return 'Standard';
  if (price.credits) return '◈ ' + fmt(price.credits);
  if (price.gems) return '◆ ' + price.gems;
  return price.bosses + ' Bosse';
}
function canAfford(price) {
  if (!price) return true;
  if (price.credits) return state.credits >= price.credits;
  if (price.gems) return state.gems >= price.gems;
  return state.bossDefeats >= price.bosses;
}
function visibleModuleChange(kind, level) {
  if (kind === 'weapon')
    return Math.min(3, Math.floor(level / 3)) > Math.min(3, Math.floor((level - 1) / 3))
      ? 'Neue Waffenhalterung am Rumpf'
      : 'Stärkere Waffen-Emitter';
  if (kind === 'hull')
    return (
      { 2: 'Panzerplatten', 5: 'Rückenpanzer und Flügelkanten', 9: 'Gepanzerte Bugkappe', 14: 'Goldbeschläge' }[
        level
      ] || 'Verstärkte Panzerung'
    );
  if (kind === 'engine')
    return { 4: 'Zusätzliche Triebwerksdüse', 8: 'Große Haupttriebwerke' }[level] || 'Längere Triebwerksflamme';
  return { 3: 'Reaktorring', 6: 'Strahlender Reaktorkern' }[level] || 'Hellerer Reaktor';
}
function moduleDelta(kind) {
  const level = state.ship[kind] || 0,
    next = { [kind]: level + 1 };
  if (kind === 'weapon' || kind === 'core') return 'Schaden ' + fmt(attack()) + ' → ' + fmt(withShip(next, attack));
  if (kind === 'hull') return 'Beute-Chance +' + level * 2 + ' % → +' + (level + 1) * 2 + ' %';
  const now = expeditionDuration(),
    after = withShip(next, expeditionDuration);
  return after < now
    ? 'Expedition ' + Math.round(now / 1000) + ' s → ' + Math.round(after / 1000) + ' s'
    : 'Expedition am Minimum (' + Math.round(now / 1000) + ' s)';
}
function workshopDetailHTML() {
  const p = workshopPreview,
    gearNow = state.ship;
  if (p.kind === 'model') {
    const info = MODEL_INFO[p.id],
      owned = !!gearNow.models[p.id],
      current = gearNow.model === p.id,
      dmg = withShip({ model: p.id }, attack),
      missingBosses = info.price?.bosses ? Math.max(0, info.price.bosses - state.bossDefeats) : 0;
    const button = current
      ? '<button class="workshop-confirm" disabled>AUSGERÜSTET</button>'
      : owned
        ? `<button class="workshop-confirm" data-model="${p.id}">AUSWÄHLEN</button>`
        : missingBosses
          ? `<button class="workshop-confirm" disabled>NOCH ${missingBosses} BOSS${missingBosses > 1 ? 'E' : ''}</button>`
          : `<button class="workshop-confirm buy" data-model="${p.id}" ${canAfford(info.price) ? '' : 'disabled'}>FREISCHALTEN · ${priceText(info.price)}</button>`;
    return `<div><span>VORSCHAU · MODELL</span><b>${p.id}</b><small>${info.text}</small><small>Schaden ${fmt(attack())} → <em>${fmt(dmg)}</em></small></div>${button}`;
  }
  if (p.kind === 'weapon') {
    const info = WEAPON_INFO[p.id],
      owned = !!gearNow.weaponTypes[p.id],
      current = gearNow.weaponType === p.id,
      dmg = withShip({ weaponType: p.id }, attack);
    const button = current
      ? '<button class="workshop-confirm" disabled>AUSGERÜSTET</button>'
      : owned
        ? `<button class="workshop-confirm" data-weapon="${p.id}">AUSRÜSTEN</button>`
        : `<button class="workshop-confirm buy" data-weapon="${p.id}" ${canAfford(info.price) ? '' : 'disabled'}>FREISCHALTEN · ${priceText(info.price)}</button>`;
    return `<div><span>VORSCHAU · WAFFE</span><b>${weaponDot(p.id)} ${p.id}</b><small>${info.text}</small><small>Gegen dieses Ziel: ${fmt(attack())} → <em>${fmt(dmg)}</em></small></div>${button}`;
  }
  if (p.kind === 'upgrade') {
    const kind = p.id,
      level = state.ship[kind] || 0,
      cost = shipCost(kind),
      gem = kind === 'core',
      afford = (gem ? state.gems : state.credits) >= cost;
    return `<div><span>VORSCHAU · MODUL</span><b>${MODULE_INFO[kind].icon} ${MODULE_INFO[kind].name} ${level} → ${level + 1}</b><small>${moduleDelta(kind)}</small><small>Sichtbar: <em>${visibleModuleChange(kind, level + 1)}</em></small></div><button class="workshop-confirm buy" data-ship="${kind}" ${afford ? '' : 'disabled'}>AUSBAUEN · ${gem ? '◆ ' + cost : '◈ ' + fmt(cost)}</button>`;
  }
  return `<div><span>AKTUELLE AUSSTATTUNG</span><b>${gearNow.model} · ${weaponDot(gearNow.weaponType)} ${gearNow.weaponType}</b><small>${fmt(attack())} Schaden pro Schuss · Tippe ein Modell, eine Waffe oder ein Modul für eine kostenlose Vorschau.</small></div>`;
}
function renderWorkshop() {
  const stage = $('workshopStage'),
    Art = window.NebulaArt,
    Kit = window.SpaceKittens;
  if (!stage || !Art?.shipPreviewURL) return;
  const pilot = Kit?.ROSTER[combatPilot()],
    palette = shipPalette(),
    gear = previewGear(),
    previewing = workshopPreview.kind !== 'current',
    big = Art.shipPreviewURL(gear.model, gear, palette, pilot, 640, 300),
    now = previewing ? Art.shipPreviewURL(state.ship.model, state.ship, palette, pilot, 240, 120) : '';
  setHTML(
    stage,
    `<img class="stage-ship" src="${big}" alt="Schiffsvorschau" /><span class="stage-badge ${previewing ? 'preview' : ''}">${previewing ? 'VORSCHAU' : 'AKTUELL'}</span>${
      previewing ? `<figure class="stage-now"><img src="${now}" alt="" /><figcaption>JETZT</figcaption></figure>` : ''
    }`
  );
  setHTML($('workshopDetail'), workshopDetailHTML());
  ['weapon', 'hull', 'engine', 'core'].forEach(kind => {
    $(kind + 'Level').textContent = 'Stufe ' + (state.ship[kind] || 0);
    $(kind + 'Delta').textContent = moduleDelta(kind);
    const gem = kind === 'core',
      cost = shipCost(kind);
    document.querySelector(`[data-ship="${kind}"]:not(.workshop-confirm)`).disabled =
      (gem ? state.gems : state.credits) < cost;
  });
  document
    .querySelectorAll('[data-preview-upgrade]')
    .forEach(row =>
      row.classList.toggle(
        'previewing',
        workshopPreview.kind === 'upgrade' && workshopPreview.id === row.dataset.previewUpgrade
      )
    );
  document.querySelectorAll('[data-preview-model]').forEach(button => {
    const id = button.dataset.previewModel,
      owned = !!state.ship.models[id],
      img = button.querySelector('img'),
      url = Art.shipPreviewURL(id, { ...state.ship, model: id }, palette, pilot, 200, 110);
    if (img.getAttribute('src') !== url) img.setAttribute('src', url);
    button.classList.toggle('active', state.ship.model === id);
    button.classList.toggle('locked', !owned);
    button.classList.toggle('previewing', workshopPreview.kind === 'model' && workshopPreview.id === id);
    button.querySelector('small').textContent =
      state.ship.model === id ? 'Ausgerüstet' : owned ? 'Besitz' : priceText(MODEL_INFO[id].price);
  });
  document.querySelectorAll('[data-preview-weapon]').forEach(button => {
    const id = button.dataset.previewWeapon,
      owned = !!state.ship.weaponTypes[id];
    button.style.setProperty('--wpn', WEAPON_INFO[id].color);
    button.classList.toggle('active', state.ship.weaponType === id);
    button.classList.toggle('locked', !owned);
    button.classList.toggle('previewing', workshopPreview.kind === 'weapon' && workshopPreview.id === id);
    button.querySelector('small').textContent =
      state.ship.weaponType === id ? 'Ausgerüstet' : owned ? 'Besitz' : priceText(WEAPON_INFO[id].price);
  });
}
// The crew/expedition preview uses the same renderer and the same equipped ship (static markup, looked up once).
let shipPreviewLive = null,
  expeditionCardEl;
renderShipPreview = function () {
  (shipPreviewLive ??= [...document.querySelectorAll('.ship-preview-live')]).forEach(el => {
    const Art = window.NebulaArt,
      url = Art?.shipPreviewURL?.(
        state.ship.model,
        state.ship,
        shipPalette(),
        window.SpaceKittens?.ROSTER[combatPilot()],
        320,
        170
      );
    if (url && el.getAttribute('src') !== url) el.setAttribute('src', url);
  });
};

document.addEventListener('click', event => {
  const target = event.target;
  const model = target.closest('[data-preview-model]'),
    weapon = target.closest('[data-preview-weapon]'),
    upgrade = target.closest('[data-preview-upgrade]');
  if (!model && !weapon && !upgrade) return;
  const next = model
    ? { kind: 'model', id: model.dataset.previewModel }
    : weapon
      ? { kind: 'weapon', id: weapon.dataset.previewWeapon }
      : { kind: 'upgrade', id: upgrade.dataset.previewUpgrade };
  // The equipped model/weapon is the current view; tapping the selected tile again closes the preview.
  const equipped =
    (next.kind === 'model' && state.ship.model === next.id) ||
    (next.kind === 'weapon' && state.ship.weaponType === next.id);
  const same = workshopPreview.kind === next.kind && workshopPreview.id === next.id;
  workshopPreview = equipped || (same && !target.closest('[data-ship]')) ? { kind: 'current', id: null } : next;
  feedback('open');
  renderWorkshop();
});

// ----- victory & reconciliation -----
const VICTORY_TEXT = {
  pips: [
    'P.I.P.S. GESTOPPT!',
    '+1.500 ◈ · 3 Kristalle · 5 Gems',
    'Er ist nur veraltet – repariere ihn und gewinne einen Freund.'
  ],
  frostbyte: [
    'FROSTBYTE TAUT AUF!',
    '+4.000 ◈ · 5 Kristalle · 8 Gems · 1 Talent-Kapsel',
    'Er zittert. Repariere ihn mit Glacies-Waren – dann hilft er der Kolonie.'
  ],
  emberbell: [
    'EMBERBELL KÜHLT AB!',
    '+6.000 ◈ · 6 Kristalle · 8 Gems · 1 Talent-Kapsel',
    'Er wollte nur wärmen. Kalibriere ihn mit Pyra-Waren neu.'
  ],
  cogsworth: [
    'PRÜFUNG BEENDET!',
    '+9.000 ◈ · 8 Kristalle · 10 Gems · 1 Talent-Kapsel',
    'Cogsworth-9 ist erschöpft. Kalibriere ihn mit Mekhanos-Bauteilen neu.'
  ],
  petalguard: [
    'DER WALD WIRD STILL!',
    '+15.000 ◈ · 10 Kristalle · 12 Gems · 1 Talent-Kapsel',
    'Petalguard welkt selbst. Heile sie mit Biogel und Leuchtsporen.'
  ]
};
let victoryTimer = 0;
function showVictory(event) {
  const card = $('enemyCard');
  if (!card || currentScreen() !== 'battle') return;
  const guardian = VICTORY_TEXT[event.level];
  if (!guardian && !event.boss) return;
  let el = card.querySelector('.victory-card');
  if (!el) {
    el = document.createElement('div');
    el.className = 'victory-card';
    el.setAttribute('role', 'status');
    card.appendChild(el);
  }
  const rarity = { normal: 'Gewöhnlich', rare: 'Selten', epic: 'Episch', legendary: 'Legendär' }[event.rarity] || '';
  const [title, rewards, line] = guardian || [
    'BOSS BESIEGT!',
    '+' + fmt(event.credits) + ' ◈ · +1 Gem · +2 Kristalle',
    'Sektor gesichert – der nächste Gegner wartet schon.'
  ];
  const chest = guardian || event.chest ? '<em class="victory-chest">+ Sternenkiste · Arsenal</em>' : '';
  el.innerHTML = `<b>${title}</b><span>${rewards}</span>${event.dropName ? `<em class="rarity-${event.rarity}">${event.isNew ? 'NEU · ' : ''}${rarity} ${event.dropName}</em>` : ''}${chest}<small>${line}</small>${
    guardian ? '<button data-victory-repair>ZUR REPARATUR ›</button>' : ''
  }`;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(victoryTimer);
  victoryTimer = setTimeout(() => el.classList.remove('show'), guardian ? 6000 : 2600);
}
GameEvents.on('enemy-defeated', showVictory);
document.addEventListener('click', event => {
  if (!event.target.closest('[data-victory-repair]')) return;
  event.target.closest('.victory-card')?.classList.remove('show');
  $('storyCard')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

// ----- weapon voices + overcharge cue (respect the audio settings through NebulaAudio.play) -----
GameEvents.on('attack', event => {
  if (currentScreen() !== 'battle') return;
  window.NebulaAudio?.play(event.shielded && !event.aimed ? 'shield' : 'shot-' + event.weapon);
});
$('overchargeButton').addEventListener('click', () => {
  if (Date.now() < state.overchargeUntil) window.NebulaAudio?.play('overcharge');
});

// ----- wiring -----
function syncBattleChrome() {
  const battle = currentScreen() === 'battle';
  document.body.classList.toggle('battle-active', battle);
  if (!battle) return;
  renderCombatHud();
  renderWorkshop();
}
const renderBeforeCombatUi = render;
render = () => {
  renderBeforeCombatUi();
  syncBattleChrome();
};
const showScreenBeforeCombatUi = showScreen;
showScreen = screen => {
  if (screen !== 'battle') workshopPreview = { kind: 'current', id: null };
  showScreenBeforeCombatUi(screen);
  syncBattleChrome();
};
// Timed states (shield windows, cooldowns, thaw timers) change without a click: refresh the HUD 4× per second.
setInterval(() => {
  if (currentScreen() === 'battle' && !document.hidden) renderCombatHud();
}, 250);
render();
// The combat stage shows the home planet of the fight in the background.
// K80: how far the HTML enemy plate really reaches into the combat canvas (it wraps to two lines on narrow phones,
// e.g. "Petalguard · Blütenwächterin" at 320 px). Measured only when the plate or the card changes size — never per
// frame — and handed to the scene, which places the enemy in the free band below it.
let combatHudInset = 0;
function measureCombatHud() {
  const plate = document.querySelector('#combatHud .hud-enemy'),
    canvas = $('enemyCard')?.querySelector('canvas');
  if (!plate || !canvas || !plate.offsetParent) return;
  const inset = Math.round(plate.getBoundingClientRect().bottom - canvas.getBoundingClientRect().top);
  combatHudInset = Math.max(0, Math.min(canvas.clientHeight, inset));
}
if (window.ResizeObserver) {
  const hudObserver = new ResizeObserver(measureCombatHud);
  const plate = document.querySelector('#combatHud .hud-enemy');
  if (plate) hudObserver.observe(plate);
  if ($('enemyCard')) hudObserver.observe($('enemyCard'));
}
// equipped Arsenal items on the pilot plate (beta 1): small icons with a rarity rim, so equipment is visible in fights
function hudGearHTML() {
  const a = state.meta?.arsenal;
  if (!a || typeof ARSENAL_BY_ID === 'undefined') return '';
  const icons = ARSENAL_SLOTS.map(slot => ARSENAL_BY_ID[a.loadout[slot]])
    .filter(Boolean)
    .map(item => `<i class="hud-gear rarity-${item.rarity}" title="${item.name}">${item.icon}</i>`)
    .join('');
  return icons ? `<span class="hud-gear-row" aria-label="Arsenal">${icons}</span>` : '';
}
const combatViewBeforeUi = window.NebulaView.combat;
window.NebulaView.combat = () => ({ ...combatViewBeforeUi(), planetId: PLANETS[state.activePlanet]?.id || 'crystal', hudInset: combatHudInset });
// The colony landing pad shows the same ship and pilot as combat and workshop.
const colonyViewBeforeUi = window.NebulaView.colony;
window.NebulaView.colony = () => ({ ...colonyViewBeforeUi(), pilot: combatPilot() });
// Expedition card: the equipped ship flies off while the real expedition timer runs.
const renderBeforeExpeditionShip = render;
render = () => {
  renderBeforeExpeditionShip();
  if (expeditionCardEl === undefined) expeditionCardEl = document.querySelector('.expedition-card');
  expeditionCardEl?.classList.toggle('flying', state.expeditionEnd > Date.now());
};
