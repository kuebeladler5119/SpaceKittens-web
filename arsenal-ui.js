// Arsenal UI (beta 1 + 1.1): the card in the Abenteuer tab (ship & pilot gear, Tikki's gear, Sternsplitter, chests), the
// collection dialog (comparison, upgrade, fusion preview) and the chest reveal (three chest kinds, odds per kind).
// Reads and changes only meta.arsenal through arsenal.js; loaded after petalguard-ui.js.

const ARSENAL_SOURCE_TEXT = {
  chest: 'Sternenkisten',
  'guardian:pips': 'Wächter: P.I.P.S. besiegen',
  'guardian:frostbyte': 'Wächter: Frostbyte besiegen',
  'guardian:emberbell': 'Wächter: Emberbell besiegen',
  'guardian:cogsworth': 'Wächter: Cogsworth-9 besiegen',
  'guardian:petalguard': 'Wächter: Petalguard besiegen'
};
const ARSENAL_TABS = { all: null, ship: ['weapon', 'support'], pilot: ['pilot'], cat: ['catWeapon', 'catSupport'] };
// Beta 1.2: what each effect is about and when it works. Deliberately no DPS numbers — a fight's damage depends on boss
// phases, timing and the active ability, so a static estimate would mislead.
const ARSENAL_EFFECT_INFO = {
  dmg: ['Schaden', 'jeder Schuss: Tippen, Auto-Kampf und Tikki'],
  aimed: ['Präzision', 'nur gezielte Schüsse (ZIELEN)'],
  boss: ['Boss', 'alle Schüsse gegen Sektor-Bosse und Wächter'],
  weapon: ['Waffensystem', 'nur mit dem passenden Waffensystem'],
  combo: ['Kette', 'schnelle Tipps hintereinander (nicht im Auto-Kampf)'],
  loot: ['Beute', 'bessere Fundstücke aus Kämpfen'],
  burst: ['Spezialeffekt', 'Schiffsschüsse – getippt und im Auto-Kampf'],
  mark: ['Tikki · Markierung', 'Tikkis Treffer verstärken deine Schiffsschüsse'],
  charge: ['Tikki · Ladung', 'Tikkis Treffer laden deinen nächsten Schiffsschuss'],
  catPower: ['Tikki-Schaden', 'Tikkis Bolzen und Funkenhagel'],
  catCooldown: ['Abklingzeit', 'Funkenhagel']
};
function arsenalTagsHTML(item) {
  const tags = [...new Set(item.effects.map(effect => ARSENAL_EFFECT_INFO[effect.kind]?.[0]).filter(Boolean))];
  return `<span class="arsenal-tags">${tags.map(tag => `<span class="arsenal-tag">${tag}</span>`).join('')}</span>`;
}
function arsenalWhereHTML(item) {
  const rows = [...new Set(item.effects.map(effect => effect.kind))].map(kind => `<li><b>${ARSENAL_EFFECT_INFO[kind][0]}:</b> ${ARSENAL_EFFECT_INFO[kind][1]}</li>`);
  return `<ul class="arsenal-where" aria-label="Wirkt bei">${rows.join('')}</ul>`;
}
// synergies this item takes part in: active, or which partner effect is missing
function arsenalSynergyHTML(item) {
  const kinds = new Set(item.effects.map(effect => effect.kind)),
    equipped = arsenalEquippedKinds();
  return ARSENAL_SYNERGIES.filter(s => s.kinds.some(kind => kinds.has(kind)))
    .map(s => {
      const on = arsenalSynergyActive(s.id) && arsenal().loadout[item.slot] === item.id;
      const missing = s.kinds.filter(kind => !kinds.has(kind) && !equipped.has(kind)).map(kind => ARSENAL_EFFECT_INFO[kind][0]);
      return `<p class="arsenal-synergy ${on ? 'on' : ''}">⚡ <b>${s.name}</b> · ${s.text}${on ? ' — aktiv' : missing.length ? ' — braucht zusätzlich: ' + missing.join(', ') : ''}</p>`;
    })
    .join('');
}
function arsenalPresetMatches(preset) {
  return preset.saved && ARSENAL_SLOTS.every(slot => (preset.loadout[slot] || null) === (arsenal().loadout[slot] || null));
}
let arsenalTab = 'all';
let arsenalSelected = null;
let chestKind = 'standard';
const arsenalPct = v => {
  const p = v * 100;
  return (p < 10 ? p.toFixed(1) : p.toFixed(0)).replace('.', ',').replace(/,0$/, '') + ' %';
};
function arsenalEffectText(effect, level) {
  const raw = arsenalEffectValue(effect, level),
    v = arsenalPct(raw);
  return {
    dmg: '+' + v + ' Schaden',
    aimed: '+' + v + ' auf gezielte Schüsse',
    boss: '+' + v + ' gegen Bosse und Wächter',
    weapon: '+' + v + ' Schaden mit ' + effect.weapon,
    combo: '+' + v + ' pro Kettentreffer',
    loot: '+' + v + ' bessere Fundstücke',
    burst: 'jeder ' + effect.every + '. Schuss: Splitterstoß ' + v,
    mark: 'Tikkis Treffer markieren: Schiffsschüsse +' + v,
    charge: 'Tikkis Treffer laden den nächsten Schuss +' + v,
    catPower: 'Tikkis Bolzen +' + v + ' Schaden',
    catCooldown: 'Funkenhagel lädt ' + raw.toFixed(raw < 10 ? 1 : 0).replace('.', ',').replace(/,0$/, '') + ' s schneller'
  }[effect.kind];
}
function arsenalItemEffects(item, level) {
  return item.effects.map(effect => arsenalEffectText(effect, level)).join(' · ');
}
function arsenalSourceText(item) {
  if (item.source !== 'fusion') return ARSENAL_SOURCE_TEXT[item.source] || item.source;
  const recipe = ARSENAL_FUSION_BY_ID[item.id];
  return 'Fusion: ' + recipe.inputs.map(id => ARSENAL_BY_ID[id].name + ' Lv ' + ARSENAL_MAX_LEVEL).join(' + ') + ' + ✦ ' + recipe.splitters;
}

// ----- card in the Abenteuer tab -----
function arsenalSlotHTML(slot, owned) {
  const a = arsenal(),
    id = a.loadout[slot],
    item = ARSENAL_BY_ID[id],
    info = ARSENAL_SLOT_INFO[slot];
  return item
    ? `<button class="arsenal-slot rarity-${item.rarity}" data-arsenal-slot="${slot}" aria-label="${info.name}: ${item.name}, Stufe ${a.items[id].level}"><i aria-hidden="true">${item.icon}</i><span>${info.short}</span><b>${item.name} <em>Lv ${a.items[id].level}</em></b><small>${arsenalItemEffects(item, a.items[id].level)}</small></button>`
    : `<button class="arsenal-slot empty" data-arsenal-slot="${slot}" aria-label="${info.name}: leer"><i aria-hidden="true">${info.icon}</i><span>${info.short}</span><b>leer</b><small>${owned ? 'Tippe zum Ausrüsten' : 'Aus Kisten und von Wächtern'}</small></button>`;
}
function renderArsenalCard() {
  const card = $('arsenalCard');
  if (!card || !state.meta?.arsenal) return;
  const a = arsenal(),
    owned = Object.keys(a.items).length,
    chests = arsenalChestTotal(),
    factor = arsenalDamageFactor({ aimed: false, boss: false }),
    cat = typeof catUnlocked === 'function' && catUnlocked();
  const catBlock = cat
    ? `<div class="arsenal-group-head"><span>TIKKIS FUNKENGLEITER</span><small>${arsenalSlotOwnedCount(['catWeapon', 'catSupport'])} Teile</small></div><div class="arsenal-slots two">${arsenalSlotHTML('catWeapon', owned)}${arsenalSlotHTML('catSupport', owned)}</div>`
    : `<p class="arsenal-note cat-locked">🔧 Tikki fliegt mit, sobald P.I.P.S. repariert ist – dann bekommt sie eigene Ausrüstung.</p>`;
  const synergies = arsenalActiveSynergies(),
    synergyLine = synergies.length ? `<p class="arsenal-synergy-line">⚡ Synergie aktiv: ${synergies.map(s => s.name).join(' · ')}</p>` : '',
    presets = (a.presets || [])
      .map((p, i) => `<button class="${arsenalPresetMatches(p) ? 'current' : ''}" data-arsenal-preset-apply="${i}" ${p.saved ? '' : 'disabled'} aria-label="Build ${p.name}${p.saved ? ' anlegen' : ': noch nicht gespeichert'}">${p.name}${arsenalPresetMatches(p) ? ' ✓' : p.saved ? '' : ' · leer'}</button>`)
      .join('');
  setHTML(
    card,
    `<div class="arsenal-head"><div><span>ARSENAL · BLEIBT BEIM LICHTZYKLUS</span><h2>Ausrüstung</h2></div><b class="arsenal-splitters" title="Sternsplitter">✦ ${fmt(a.splitters)}</b></div>
    <div class="arsenal-group-head"><span>SCHIFF & PILOT</span></div>
    <div class="arsenal-slots">${arsenalSlotHTML('weapon', owned)}${arsenalSlotHTML('support', owned)}${arsenalSlotHTML('pilot', owned)}</div>
    ${catBlock}
    ${synergyLine}
    <div class="arsenal-group-head"><span>BUILDS</span><small>in der Sammlung speichern</small></div>
    <div class="arsenal-presets" role="group" aria-label="Gespeicherte Builds">${presets}</div>
    <p class="arsenal-note">${factor > 1.0001 ? 'Ausrüstung jetzt: ×' + factor.toFixed(2).replace('.', ',') + ' Schaden (ohne Ziel- und Bossboni)' : 'Ausrüstung verstärkt dein Schiff dauerhaft – sie bleibt auch nach dem Lichtzyklus.'}</p>
    <div class="arsenal-actions"><button class="arsenal-collection" data-arsenal-open>SAMMLUNG · ${owned} / ${ARSENAL_ITEMS.length}</button><button class="chest-button${chests ? ' ready' : ''}" data-chest-open ${chests ? '' : 'disabled'}><i class="chest-icon" aria-hidden="true"></i>${chests ? 'KISTEN · ' + chests : 'KEINE KISTE'}</button>${
      typeof forgeItems === 'function' ? `<button class="arsenal-forge" data-forge-open>✦ STERNENSCHMIEDE · ${forgeItems().filter(item => forgeOwned(item.id)).length} / ${forgeItems().length} · nur Optik</button>` : ''
    }</div>`
  );
  navButton('battle')?.toggleAttribute('data-chests', chests > 0);
}
function arsenalSlotOwnedCount(slots) {
  return ARSENAL_ITEMS.filter(item => slots.includes(item.slot) && arsenalOwned(item.id)).length;
}

// ----- collection dialog -----
function renderArsenalModal() {
  const box = $('arsenalPanel');
  if (!box) return;
  const a = arsenal(),
    slots = ARSENAL_TABS[arsenalTab],
    list = ARSENAL_ITEMS.filter(item => !slots || slots.includes(item.slot));
  if (!arsenalSelected || !ARSENAL_BY_ID[arsenalSelected] || !list.some(item => item.id === arsenalSelected)) arsenalSelected = list.find(item => a.items[item.id])?.id || list[0]?.id;
  $('arsenalBalance').textContent = '✦ ' + fmt(a.splitters) + ' Sternsplitter · ' + Object.keys(a.items).length + ' / ' + ARSENAL_ITEMS.length + ' entdeckt';
  document.querySelectorAll('[data-arsenal-tab]').forEach(button => {
    const on = button.dataset.arsenalTab === arsenalTab;
    button.classList.toggle('active', on);
    button.setAttribute('aria-selected', String(on));
  });
  const tiles = list
    .map(item => {
      const level = a.items[item.id]?.level || 0,
        equipped = a.loadout[item.slot] === item.id,
        fusable = !level && item.source === 'fusion' && arsenalFusionStatus(item.id)?.ready;
      return `<button class="arsenal-item rarity-${item.rarity}${level ? '' : ' locked'}${equipped ? ' equipped' : ''}${fusable ? ' fusable' : ''}${arsenalSelected === item.id ? ' selected' : ''}" data-arsenal-item="${item.id}" aria-pressed="${arsenalSelected === item.id}"><i aria-hidden="true">${level ? item.icon : item.source === 'fusion' ? '✧' : '?'}</i><b>${item.name}</b><small>${level ? ARSENAL_RARITY_NAME[item.rarity] + ' · Lv ' + level + '/' + ARSENAL_MAX_LEVEL : item.source === 'fusion' ? ARSENAL_RARITY_NAME[item.rarity] + ' · Fusion' : 'noch nicht gefunden'}</small>${equipped ? '<em>AUSGERÜSTET</em>' : fusable ? '<em class="fuse">FUSION BEREIT</em>' : ''}</button>`;
    })
    .join('');
  const saveRow = `<div class="arsenal-preset-save"><span>Aktuelle Ausrüstung als Build speichern:</span><div>${(a.presets || [])
    .map((p, i) => `<button data-arsenal-preset-save="${i}">${p.name}${p.saved ? ' ↻' : ''}</button>`)
    .join('')}</div><small>Builds merken sich nur, welche deiner Teile in welchem Slot stecken – sie kopieren nichts.</small></div>`;
  setHTML(box, `${arsenalDetailHTML(arsenalSelected)}<div class="arsenal-grid">${tiles}</div>${saveRow}`);
}
// comparison with the item currently in the same slot
function arsenalCompareHTML(item) {
  const a = arsenal(),
    current = ARSENAL_BY_ID[a.loadout[item.slot]];
  if (!current || current.id === item.id) return '';
  return `<p class="arsenal-compare">Statt ${current.name} (Lv ${a.items[current.id].level}): ${arsenalItemEffects(current, a.items[current.id].level)}</p>`;
}
function arsenalFusionHTML(item) {
  const status = arsenalFusionStatus(item.id);
  if (!status) return '';
  const rows = status.inputs
    .map(input => `<li class="${input.ok ? 'ok' : 'missing'}">${input.ok ? '✓' : '✗'} ${ARSENAL_BY_ID[input.id].name} · Lv ${input.level || '–'}/${ARSENAL_MAX_LEVEL}</li>`)
    .join('');
  return `<div class="arsenal-fusion"><b>FUSION</b><ul>${rows}<li class="${status.affordable ? 'ok' : 'missing'}">${status.affordable ? '✓' : '✗'} ✦ ${status.splitters} Sternsplitter</li></ul><small>Die Zutaten bleiben erhalten und ausgerüstet – verbraucht werden nur die Sternsplitter.</small><button data-arsenal-fuse="${item.id}" ${status.ready ? '' : 'disabled'}>FUSIONIEREN · ✦ ${status.splitters}</button></div>`;
}
function arsenalDetailHTML(id) {
  const item = ARSENAL_BY_ID[id];
  if (!item) return '';
  const a = arsenal(),
    level = a.items[id]?.level || 0,
    info = ARSENAL_SLOT_INFO[item.slot],
    equipped = a.loadout[item.slot] === id,
    price = arsenalUpgradeCost(id),
    catLocked = info.owner === 'cat' && !(typeof catUnlocked === 'function' && catUnlocked());
  if (!level)
    return `<div class="arsenal-detail locked rarity-${item.rarity}"><i aria-hidden="true">${item.source === 'fusion' ? '✧' : '?'}</i><div><b>${item.name}</b><small>${ARSENAL_RARITY_NAME[item.rarity]} · ${info.name}</small>${arsenalTagsHTML(item)}<p>${arsenalItemEffects(item, 1)}</p>${arsenalWhereHTML(item)}<p class="arsenal-source">Quelle: ${arsenalSourceText(item)}</p></div>${item.source === 'fusion' ? arsenalFusionHTML(item) : ''}</div>`;
  const next = level < ARSENAL_MAX_LEVEL ? `<p class="arsenal-next">Stufe ${level + 1}: ${arsenalItemEffects(item, level + 1)}</p>` : '<p class="arsenal-next">Höchste Stufe erreicht.</p>';
  return `<div class="arsenal-detail rarity-${item.rarity}"><i aria-hidden="true">${item.icon}</i><div><b>${item.name} <em>Lv ${level}/${ARSENAL_MAX_LEVEL}</em></b><small>${ARSENAL_RARITY_NAME[item.rarity]} · ${info.name}</small>${arsenalTagsHTML(item)}<p>${arsenalItemEffects(item, level)}</p>${next}${arsenalWhereHTML(item)}${equipped ? '' : arsenalCompareHTML(item)}${arsenalSynergyHTML(item)}${catLocked ? '<p class="arsenal-source">Wirkt, sobald Tikki mitfliegt.</p>' : ''}<p class="arsenal-source">Quelle: ${arsenalSourceText(item)}</p></div>
    <div class="arsenal-detail-actions">${equipped ? `<button class="secondary" data-arsenal-unequip="${item.slot}">ABLEGEN</button>` : `<button data-arsenal-equip="${id}">AUSRÜSTEN</button>`}${price === null ? '<button disabled>MAX</button>' : `<button data-arsenal-upgrade="${id}" ${a.splitters >= price ? '' : 'disabled'}>VERBESSERN · ✦ ${price}</button>`}</div></div>`;
}
function openArsenal(slot) {
  arsenalTab = !slot ? 'all' : Object.keys(ARSENAL_TABS).find(tab => ARSENAL_TABS[tab]?.includes(slot)) || 'all';
  arsenalSelected = slot ? arsenal().loadout[slot] || ARSENAL_ITEMS.find(item => item.slot === slot && arsenalOwned(item.id))?.id || null : arsenalSelected;
  renderArsenalModal();
  openModal('arsenalModal');
}

// ----- chest reveal (three kinds) -----
function chestOddsHTML(kind) {
  const chest = ARSENAL_CHESTS[kind],
    total = Object.values(chest.weights).reduce((s, w) => s + w, 0);
  const rows = ARSENAL_RARITIES.filter(r => chest.weights[r])
    .map(r => {
      const pool = ARSENAL_CHEST_POOL.filter(item => item.rarity === r);
      return `<tr class="rarity-${r}"><td>${ARSENAL_RARITY_NAME[r]}</td><td>${arsenalPct(chest.weights[r] / total)}</td><td>${pool.map(item => item.name).join(', ')}</td></tr>`;
    })
    .join('');
  return `<details class="chest-odds"><summary>Wahrscheinlichkeiten · ${chest.name}</summary><table><tbody>${rows}</tbody></table><p>Innerhalb einer Seltenheit ist jedes Teil gleich wahrscheinlich. Doppelte Teile werden zu Sternsplittern. Jede ${chest.name} gibt zusätzlich ✦ ${chest.splitters}. Mythische und himmlische Teile gibt es nur durch Fusion. Kisten gibt es nur im Spiel – nicht zu kaufen.</p></details>`;
}
function chestKindsHTML() {
  return `<div class="chest-kinds" role="radiogroup" aria-label="Kistenart">${ARSENAL_CHEST_TYPES.map(kind => {
    const n = arsenalChestCount(kind);
    return `<button role="radio" aria-checked="${kind === chestKind}" class="chest-kind kind-${kind}${kind === chestKind ? ' active' : ''}" data-chest-kind="${kind}" ${n ? '' : 'disabled'}><i class="chest-icon" aria-hidden="true"></i><b>${ARSENAL_CHESTS[kind].name}</b><small>${n}</small></button>`;
  }).join('')}</div>`;
}
let chestState = 'closed';
function renderChestModal(result) {
  const stage = $('chestStage'),
    text = $('chestText'),
    action = $('chestAction');
  if (!stage) return;
  // a revealed chest keeps its kind on screen; only a closed dialog moves on to a kind that still has chests
  if (!result && arsenalChestCount(chestKind) < 1) chestKind = ARSENAL_CHEST_TYPES.find(kind => arsenalChestCount(kind) > 0) || chestKind;
  setHTML($('chestKinds'), chestKindsHTML());
  const n = arsenalChestCount(chestKind),
    name = ARSENAL_CHESTS[chestKind].name;
  if (!result) {
    chestState = 'closed';
    stage.className = 'chest-stage kind-' + chestKind;
    setHTML(stage, '<div class="big-chest" aria-hidden="true"><i class="lid"></i><i class="body"></i><i class="lock"></i></div>');
    text.textContent = n ? name + ': noch ' + n + ' im Arsenal.' : 'Keine Kiste mehr.';
    action.textContent = n ? name.toUpperCase() + ' ÖFFNEN' : 'KEINE KISTE';
    action.disabled = n < 1;
  } else {
    chestState = 'open';
    const item = ARSENAL_BY_ID[result.id];
    stage.className = 'chest-stage revealed kind-' + result.chest + ' rarity-' + item.rarity;
    setHTML(
      stage,
      `<div class="big-chest open" aria-hidden="true"><i class="lid"></i><i class="body"></i><i class="glow"></i></div><div class="reveal-card rarity-${item.rarity}"><i aria-hidden="true">${item.icon}</i><b>${item.name}</b><small>${ARSENAL_RARITY_NAME[item.rarity]} · ${ARSENAL_SLOT_INFO[item.slot].name}</small><em>${result.duplicate ? 'Doppelt · +' + result.splitters + ' ✦' : 'NEU!' + (arsenal().loadout[item.slot] === item.id ? ' · ausgerüstet' : '')}</em></div>`
    );
    text.textContent = arsenalItemEffects(item, arsenalLevel(item.id)) + ' · +' + result.base + ' ✦';
    action.textContent = arsenalChestTotal() ? 'NÄCHSTE KISTE · ' + arsenalChestTotal() : 'FERTIG';
    action.disabled = false;
  }
  setHTML($('chestOdds'), chestOddsHTML(chestKind));
}
function openChestDialog(kind) {
  if (kind && ARSENAL_CHESTS[kind]) chestKind = kind;
  renderChestModal(null);
  openModal('chestModal');
}
$('chestAction')?.addEventListener('click', () => {
  if (chestState === 'open') {
    if (!arsenalChestTotal()) return closeModal('chestModal');
    return renderChestModal(null);
  }
  const result = arsenalOpenChest(chestKind);
  if (!result) return renderChestModal(null);
  save(); // the open and its result are on disk before anything is shown
  const rarity = ARSENAL_BY_ID[result.id].rarity;
  feedback('chest', ARSENAL_RARITIES.indexOf(rarity) >= 3 ? 'success' : 'light');
  GameEvents.emit('chest-opened', { id: result.id, rarity, duplicate: result.duplicate, chest: result.chest });
  renderChestModal(result);
  render();
});

// ----- interactions -----
document.addEventListener('click', event => {
  const t = event.target;
  const slot = t.closest('[data-arsenal-slot]');
  if (slot) return openArsenal(slot.dataset.arsenalSlot);
  if (t.closest('[data-arsenal-open]')) return openArsenal(null);
  if (t.closest('[data-chest-open]')) return openChestDialog();
  const kind = t.closest('[data-chest-kind]');
  if (kind) {
    chestKind = kind.dataset.chestKind;
    return renderChestModal(null);
  }
  const tab = t.closest('[data-arsenal-tab]');
  if (tab) {
    arsenalTab = tab.dataset.arsenalTab;
    arsenalSelected = null;
    return renderArsenalModal();
  }
  const tile = t.closest('[data-arsenal-item]');
  if (tile) {
    arsenalSelected = tile.dataset.arsenalItem;
    renderArsenalModal();
    // the detail sits above the grid: bring it into view on short phones
    return document.querySelector('#arsenalPanel .arsenal-detail')?.scrollIntoView({ block: 'nearest', behavior: document.body.classList.contains('reduce-motion') ? 'auto' : 'smooth' });
  }
  const equip = t.closest('[data-arsenal-equip]');
  if (equip && arsenalEquip(equip.dataset.arsenalEquip)) {
    feedback('upgrade', 'light');
    save();
    renderArsenalModal();
    return render();
  }
  const unequip = t.closest('[data-arsenal-unequip]');
  if (unequip && arsenalUnequip(unequip.dataset.arsenalUnequip)) {
    save();
    renderArsenalModal();
    return render();
  }
  const up = t.closest('[data-arsenal-upgrade]');
  if (up && arsenalUpgrade(up.dataset.arsenalUpgrade)) {
    feedback('upgrade', 'success');
    GameEvents.emit('arsenal-upgrade', { id: up.dataset.arsenalUpgrade, level: arsenalLevel(up.dataset.arsenalUpgrade) });
    save();
    renderArsenalModal();
    return render();
  }
  const presetSave = t.closest('[data-arsenal-preset-save]');
  if (presetSave && arsenalPresetSave(Number(presetSave.dataset.arsenalPresetSave))) {
    save();
    toast('Build „' + arsenal().presets[Number(presetSave.dataset.arsenalPresetSave)].name + '“ gespeichert');
    renderArsenalModal();
    return render();
  }
  const presetApply = t.closest('[data-arsenal-preset-apply]');
  if (presetApply) {
    const index = Number(presetApply.dataset.arsenalPresetApply),
      report = arsenalPresetApply(index);
    if (!report.ok) return toast(report.reason);
    save();
    feedback('upgrade', 'light');
    toast('Build „' + arsenal().presets[index].name + '“ angelegt' + (report.missing.length ? ' · fehlt: ' + report.missing.map(id => ARSENAL_BY_ID[id]?.name || 'unbekanntes Teil').join(', ') : ''));
    return render();
  }
  const fuse = t.closest('[data-arsenal-fuse]');
  if (fuse) {
    const result = arsenalFuse(fuse.dataset.arsenalFuse);
    if (!result) return;
    save(); // the transaction is on disk before the result is shown
    feedback('chest', 'success');
    GameEvents.emit('arsenal-fusion', { id: result.id, rarity: ARSENAL_BY_ID[result.id].rarity });
    toast('Fusion gelungen: ' + ARSENAL_BY_ID[result.id].name + '!');
    renderArsenalModal();
    render();
  }
});

// ----- reward notices + render hook -----
function arsenalGrantToast(granted) {
  if (!granted.length) return;
  const items = granted.filter(g => g.kind === 'guardian').map(g => ARSENAL_BY_ID[g.id]?.name).filter(Boolean),
    standard = granted.filter(g => g.kind === 'guardian' || g.kind === 'planet').length,
    elite = granted.filter(g => g.kind === 'elite').length,
    relic = granted.filter(g => g.kind === 'relic').length,
    parts = [];
  if (standard) parts.push('+' + standard + (standard === 1 ? ' Sternenkiste' : ' Sternenkisten'));
  if (elite) parts.push('+' + elite + (elite === 1 ? ' Kometenkiste' : ' Kometenkisten'));
  if (relic) parts.push('+' + relic + (relic === 1 ? ' Sternenrelikt' : ' Sternenrelikte'));
  if (!items.length && !parts.length) return;
  toast((items.length === 1 ? items[0] + ' im Arsenal · ' : items.length ? items.length + ' Wächter-Teile im Arsenal · ' : 'Arsenal: ') + parts.join(' · '));
}
GameEvents.on('enemy-defeated', event => {
  if (event.chest) setTimeout(() => toast('Neuer Boss-Rekord: ' + (event.chest === 'elite' ? 'Kometenkiste' : 'Sternenkiste') + ' im Arsenal!'), 1200);
});
const renderBeforeArsenal = render;
render = () => {
  arsenalGrantToast(arsenalSync());
  renderBeforeArsenal();
  if (currentScreen() === 'battle') renderArsenalCard();
  else navButton('battle')?.toggleAttribute('data-chests', arsenalChestTotal() > 0 && screenUnlocked('battle'));
};
// what an existing save received when it first loaded (guardians already beaten, planets founded, collection)
// shown after the save-integrity notice (1.3 s) has had time to be read
if (typeof arsenalBootGrants !== 'undefined') setTimeout(() => arsenalGrantToast(arsenalBootGrants), saveIntegrity ? 5200 : 1600);
