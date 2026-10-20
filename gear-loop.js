// Gameplay loop: equipment you can trust and loot that leads somewhere. Loaded after views-ux.js (the last UI layer).
// - DNA weapons can be locked (🔒): a locked weapon is never used up – not as fusion base or donor, not by dismantling.
// - Surplus DNA weapons can be dismantled into Sternsplitter (✦) at the same rate a full hangar already pays for a new
//   one (DNA_FULL_SPLITTERS) – no new currency, no new rate. Never the mounted weapon, a locked one or the last one, and
//   never during a fight; with a confirmation that names what it gives.
// - Every DNA card names its use: what the chassis is strong and weak against (measured, docs/gameplay-loop/BALANCE.md).
// State: two optional fields on stored weapons (`locked`), kept by normalizeDna (unknown fields stay); schema unchanged.

// ----- protection -----
function dnaWeapon(uid) {
  return state.meta?.dna?.owned.find(w => w.uid === uid) || null;
}
function dnaSetLock(uid, on) {
  const w = dnaWeapon(uid);
  if (!w) return false;
  if (on) w.locked = true;
  else delete w.locked;
  return true;
}
const dnaFusePreviewBeforeLock = dnaFusePreview;
dnaFusePreview = (baseUid, donorUid) => {
  const p = dnaFusePreviewBeforeLock(baseUid, donorUid);
  const locked = [dnaWeapon(baseUid), dnaWeapon(donorUid)].find(w => w?.locked);
  return locked ? { ok: false, why: dnaLabel(locked) + ' ist gesperrt (🔒) – erst entsperren, dann fusionieren' } : p;
};
// dnaFuse calls the preview through its global name, so the lock also guards the transaction itself

// ----- dismantling surplus weapons -----
function dnaDismantleCheck(uid) {
  const d = state.meta?.dna,
    w = dnaWeapon(uid);
  if (!d || !w) return { ok: false, why: 'Waffe nicht gefunden' };
  if (typeof arenaActive === 'function' && arenaActive()) return { ok: false, why: 'Nicht während eines Kampfes' };
  if (d.mount === uid) return { ok: false, why: 'Montierte Waffe – erst eine andere montieren' };
  if (w.locked) return { ok: false, why: 'Gesperrt (🔒) – erst entsperren' };
  if (d.owned.length <= 1) return { ok: false, why: 'Deine letzte DNA-Waffe' };
  return { ok: true, splitters: DNA_FULL_SPLITTERS[w.rarity] || DNA_FULL_SPLITTERS.common };
}
function dnaDismantle(uid) {
  const c = dnaDismantleCheck(uid);
  if (!c.ok) return null;
  const d = state.meta.dna;
  d.owned = d.owned.filter(w => w.uid !== uid);
  state.meta.arsenal.splitters += c.splitters;
  return c.splitters;
}

// ----- what a chassis is for (shown on every DNA card and in the prep) -----
// Strengths and limits as the arena plays them (tools/chassis-probe.mjs measures them in real waves)
// The three directions (measured with tools/chassis-probe.mjs, docs/gameplay-loop/BALANCE.md): Schwarmfeuer, Brecher,
// Präzision. The texts name the real rules (DNA_CHASSIS vs, armorPierce, pierce, falloff).
const DNA_CHASSIS_DIRECTION = { repeater: 'Schwarmfeuer', prism: 'Schwarmfeuer', scatter: 'Schwarmfeuer', heavy: 'Brecher', mortar: 'Brecher', lance: 'Präzision' };
const DNA_CHASSIS_USE = {
  repeater: { good: 'Schwärme +60 %, Störer +50 % · schnelle Bolzen', weak: 'Panzerplatten (nur 35 % gehen durch)' },
  heavy: { good: 'Panzer +30 %, Elite +35 %, Wächter +40 %, Panzerung voll', weak: 'Schwärme −20 % (langsame Einzelschüsse)' },
  lance: { good: 'Allrounder: trifft sofort und nie daneben, bis zu 3 Gegner in einer Linie', weak: 'kein Rollenbonus · Panzerung (60 %) · langsamer Takt' },
  prism: { good: 'Schwärme +50 %, Unterstützer und Rufer +30 % · drei Ziele zugleich', weak: 'ein einzelner Wächter (nur 1 von 3 Strahlen trifft)' },
  scatter: { good: 'Schwärme +35 %, ×1,5 aus der Nähe', weak: 'Ziele auf Distanz, Panzerung (40 %)' },
  mortar: { good: 'Panzer +20 %, Artillerie +30 %, Gruppen (Fläche)', weak: 'flinke Störer −20 % (der Bogen kommt zu spät)' }
};
function dnaUseHTML(w) {
  const u = DNA_CHASSIS_USE[w.chassis];
  return u ? `<p class="dna-use"><b class="dna-dir">${DNA_CHASSIS_DIRECTION[w.chassis]}</b><span class="good">✓ stark: ${u.good}</span><span class="warn">✗ schwach: ${u.weak}</span>${dnaVerdictHTML(w)}</p>` : '';
}
// The Werft's verdict for the next fight of the active colony's campaign: how this weapon fits its enemies (affinity,
// role, armour) compared with a neutral weapon of the same strength.
function dnaVerdict(w) {
  const key = typeof campaignKeyFor === 'function' ? campaignKeyFor() : null;
  if (!key || !CAMPAIGNS[key] || campaignComplete(key) || !w?.chassis) return null;
  const wave = campaignCleared(key),
    kinds = arenaWaveFoes(key, wave),
    fit = dnaFitFor(w, kinds) / Math.max(1e-9, dnaPowerIndex(w));
  return { key, wave, fit, label: expPlanet(key) + ' ' + (wave + 1) };
}
function dnaVerdictHTML(w) {
  const v = dnaVerdict(w);
  if (!v) return '';
  const pct = Math.round((v.fit - 1) * 100),
    // why: the affinity per enemy kind, the chassis' role, the armour share (one line, the numbers behind it)
    kinds = [...new Set(arenaWaveFoes(v.key, v.wave))],
    L = { affinity: w.affinity, affinity2: dnaStats(w).affinity2, stats: dnaStats(w) },
    strong = kinds.filter(k => arenaAffinity(L, enemyDna(k).affinity) > 1).length,
    weak = kinds.filter(k => arenaAffinity(L, enemyDna(k).affinity) < 1).length,
    vs = DNA_CHASSIS[w.chassis]?.vs || {},
    roleUp = kinds.filter(k => vs[enemyDna(k).family] > 1).length,
    roleDown = kinds.filter(k => vs[enemyDna(k).family] < 1).length,
    armoured = kinds.filter(k => CAMPAIGN_ENEMIES[k]?.armor).length,
    why = [
      strong ? 'Affinität stark gegen ' + strong : '',
      weak ? 'Affinität schwach gegen ' + weak : '',
      roleUp ? 'Rolle stark gegen ' + roleUp : '',
      roleDown ? 'Rolle schwach gegen ' + roleDown : '',
      armoured ? 'Panzerung ' + Math.round((DNA_CHASSIS[w.chassis]?.armorPierce ?? 0.5) * 100) + ' %' : ''
    ].filter(Boolean).join(', '),
    detail = `<small>${why ? why + ' · ' : ''}${kinds.length} Gegnerarten</small>`;
  return v.fit >= 1.08
    ? `<span class="dna-verdict good">★ Nächste Welle (${v.label}): passt gut, etwa +${pct} % ${detail}</span>`
    : v.fit <= 0.93
      ? `<span class="dna-verdict warn">Nächste Welle (${v.label}): schwächer, etwa ${pct} % ${detail}</span>`
      : `<span class="dna-verdict">Nächste Welle (${v.label}): neutral ${detail}</span>`;
}
// the older comparison line named only the affinity for the next wave; the verdict above replaces it (one answer)
const dnaCompareHTMLBeforeLoop = dnaCompareHTML;
dnaCompareHTML = w => dnaCompareHTMLBeforeLoop(w).replace(/<span>nächste Welle:.*?Gegnerarten<\/span>/, '');

// ----- the Werft card: use, lock, dismantle -----
const dnaWeaponHTMLBeforeLoop = dnaWeaponHTML;
dnaWeaponHTML = (w, mounted) => {
  let html = dnaWeaponHTMLBeforeLoop(w, mounted);
  if (w.uid === 'preview') return html.replace(/(<small class="dna-seed">)/, dnaUseHTML(w) + '$1');
  const check = dnaDismantleCheck(w.uid),
    tools = `<div class="dna-tools"><button class="secondary dna-lock ${w.locked ? 'on' : ''}" data-dna-lock="${w.uid}" aria-pressed="${Boolean(w.locked)}" aria-label="${w.locked ? 'Entsperren' : 'Sperren: kann nicht verbraucht werden'}">${w.locked ? '🔒 Gesperrt' : '🔓 Sperren'}</button>${
      check.ok ? `<button class="secondary dna-scrap" data-dna-scrap="${w.uid}">Zerlegen · +${check.splitters} ✦</button>` : ''
    }</div>`;
  html = html.replace(/(<small class="dna-seed">)/, dnaUseHTML(w) + dnaTuneHTML(w) + '$1');
  return html.replace(/<\/article>\s*$/, tools + '</article>');
};
// ----- the DNA tuning: one real choice per direction (dna.js DNA_TUNES), switched here for free outside a fight -----
// what the standard setting of each direction does (the other side of the choice)
const DNA_TUNE_DEFAULT = {
  hunt: 'Standard: schießt auf den nächsten Gegner, volle Wirkung gegen alle',
  stagger: 'Standard: volle Feuerrate, Treffer halten Gegner nicht auf',
  guard: 'Standard: volle Wirkung, die Kugeln fliegen durch feindliche Geschosse hindurch',
  aim: 'Standard: der Strahl durchschlägt bis zu 3 Gegner in einer Linie'
};
function dnaTuneHTML(w) {
  const id = DNA_TUNE_FOR[w.chassis];
  if (!id) return '';
  const T = DNA_TUNES[id],
    on = dnaTune(w) === id,
    locked = typeof arenaActive === 'function' && arenaActive();
  return `<div class="dna-tune" role="group" aria-label="Abstimmung"><small>Abstimmung</small><div class="dna-tune-switch"><button type="button" data-dna-tune="${w.uid}" data-tune-on="0" aria-pressed="${!on}" class="${on ? '' : 'on'}" ${locked ? 'disabled' : ''}>Standard</button><button type="button" data-dna-tune="${w.uid}" data-tune-on="1" aria-pressed="${on}" class="${on ? 'on' : ''}" ${locked ? 'disabled' : ''}>${T.name}</button></div><p>${on ? T.text : DNA_TUNE_DEFAULT[id]}</p><p class="dna-tune-use">${on ? 'gut für: ' + T.use : 'Alternative „' + T.name + '“: ' + T.text}</p></div>`;
}
function dnaSetTune(uid, on) {
  const w = dnaWeapon(uid),
    id = w && DNA_TUNE_FOR[w.chassis];
  if (!id || (typeof arenaActive === 'function' && arenaActive())) return false;
  if (on) w.tune = id;
  else delete w.tune;
  return true;
}
document.addEventListener('click', event => {
  const b = event.target.closest('[data-dna-tune]');
  if (!b || b.disabled) return;
  const on = b.dataset.tuneOn === '1',
    w = dnaWeapon(b.dataset.dnaTune);
  if (!w || Boolean(dnaTune(w)) === on) return;
  if (dnaSetTune(w.uid, on)) {
    feedback('open', 'light');
    toast(dnaLabel(w) + ': ' + (on ? DNA_TUNES[DNA_TUNE_FOR[w.chassis]].name : 'Standard'));
    save();
    render();
    if (typeof expedition !== 'undefined' && expedition.state === 'prep' && typeof renderExpeditionPrep === 'function') renderExpeditionPrep();
  }
});
document.addEventListener('click', event => {
  const lock = event.target.closest('[data-dna-lock]');
  if (lock) {
    const w = dnaWeapon(lock.dataset.dnaLock);
    if (w && dnaSetLock(w.uid, !w.locked)) {
      feedback('open', 'light');
      toast(dnaLabel(w) + (w.locked ? ' gesperrt – wird nie verbraucht.' : ' entsperrt.'));
      save();
      render();
    }
    return;
  }
  const scrap = event.target.closest('[data-dna-scrap]');
  if (scrap) {
    const w = dnaWeapon(scrap.dataset.dnaScrap),
      c = w ? dnaDismantleCheck(w.uid) : null;
    if (!c?.ok) return toast(c?.why || 'Nicht möglich');
    askConfirm('WERFT', dnaLabel(w) + ' zerlegen?', `Gibt <b>+${c.splitters} ✦ Sternsplitter</b> (so viel wie eine neue Waffe bei vollem Hangar). Die Waffe ist danach weg. Sternsplitter verbessern Arsenal-Teile und bezahlen DNA-Fusionen.`, 'ZERLEGEN', () => {
      const got = dnaDismantle(w.uid);
      if (got) {
        feedback('upgrade', 'light');
        toast(dnaLabel(w) + ' zerlegt · +' + got + ' ✦');
        save();
        render();
      }
    });
  }
});

// ----- after a chest: what the loot is for, and the step to use it -----
// The chest's result is granted and saved before anything is shown (arsenal-ui.js); these buttons only act on what the
// player now owns. Guaranteed (the Arsenal part and its ✦) and random (the DNA bonus roll) are named as such.
function chestNextHTML(result) {
  const parts = [],
    item = ARSENAL_BY_ID[result.id],
    a = arsenal();
  if (item) {
    const equipped = a.loadout[item.slot] === item.id,
      cost = arsenalUpgradeCost(item.id);
    if (result.duplicate)
      parts.push(
        `<div class="chest-next-row"><span><b>${item.name}</b> hattest du schon: <em>+${result.splitters} ✦</em>. ${cost !== null ? `Lv ${arsenalLevel(item.id)} → ${arsenalLevel(item.id) + 1} kostet ✦ ${cost} (du hast ✦ ${fmt(a.splitters)}).` : 'Schon auf der Höchststufe – die ✦ bezahlen andere Teile und DNA-Fusionen.'}</span>${
          cost !== null ? `<button data-chest-upgrade="${item.id}" ${a.splitters >= cost ? '' : 'disabled'}>VERBESSERN · ✦ ${cost}</button>` : ''
        }</div>`
      );
    else if (!equipped)
      parts.push(`<div class="chest-next-row"><span><b>${item.name}</b> ist neu. Auf dem Platz ${ARSENAL_SLOT_INFO[item.slot].name} trägst du ${ARSENAL_BY_ID[a.loadout[item.slot]]?.name || 'nichts'}.</span><button data-chest-equip="${item.id}">AUSRÜSTEN</button><button class="secondary" data-chest-arsenal="${item.slot}">VERGLEICHEN</button></div>`);
    else parts.push(`<div class="chest-next-row"><span><b>${item.name}</b> ist ausgerüstet und wirkt ab dem nächsten Kampf.</span><button class="secondary" data-chest-arsenal="${item.slot}">IM ARSENAL</button></div>`);
  }
  const w = result.dna && dnaWeapon(result.dna.uid);
  if (w) {
    const mounted = state.meta.dna.mount === w.uid;
    parts.push(
      `<div class="chest-next-row dna"><span><b>Zufallsbonus: ${dnaLabel(w)}</b>${typeof dnaCompareHTML === 'function' && !mounted ? dnaCompareHTML(w) : ''}${dnaUseHTML(w)}</span>${
        mounted ? '<em>montiert</em>' : `<button data-chest-mount="${w.uid}">MONTIEREN</button>`
      }<button class="secondary" data-chest-werft="${w.uid}">IN DER WERFT</button></div>`
    );
  } else if (result.dnaSplitters) parts.push(`<div class="chest-next-row"><span>Zufallsbonus DNA-Waffe – dein Hangar ist voll (${DNA_MAX_OWNED}): <em>+${result.dnaSplitters} ✦</em> stattdessen. In der Werft kannst du überzählige Waffen zerlegen.</span></div>`);
  return parts.join('');
}
let chestLastResult = null;
const renderChestModalBeforeLoop = renderChestModal;
renderChestModal = result => {
  renderChestModalBeforeLoop(result);
  chestLastResult = result || null;
  let box = $('chestNext');
  if (!box) {
    box = document.createElement('div');
    box.id = 'chestNext';
    box.className = 'chest-next';
    $('chestText')?.after(box);
  }
  setHTML(box, result ? chestNextHTML(result) : '');
};
// the odds name what is guaranteed and what is random (the numbers come from the same tables the draw uses)
const chestOddsHTMLBeforeLoop = chestOddsHTML;
chestOddsHTML = kind => {
  const chest = ARSENAL_CHESTS[kind],
    dna = typeof DNA_CHEST_ODDS !== 'undefined' ? DNA_CHEST_ODDS[kind] : null;
  const head = `<p class="chest-guarantee"><b>Garantiert:</b> 1 Arsenal-Teil (Tabelle unten) und ✦ ${chest.splitters}.${dna ? ` <b>Zufällig dazu:</b> eine DNA-Waffe mit ${Math.round(dna.chance * 100)} % Chance.` : ''}</p>`;
  return chestOddsHTMLBeforeLoop(kind).replace('</summary>', '</summary>' + head);
};
document.addEventListener('click', event => {
  const t = event.target;
  const equip = t.closest('[data-chest-equip]');
  if (equip && arsenalEquip(equip.dataset.chestEquip)) {
    feedback('upgrade', 'light');
    save();
    toast(ARSENAL_BY_ID[equip.dataset.chestEquip].name + ' ausgerüstet.');
    return renderChestModal(chestLastResult), render();
  }
  const up = t.closest('[data-chest-upgrade]');
  if (up && arsenalUpgrade(up.dataset.chestUpgrade)) {
    feedback('upgrade', 'light');
    save();
    toast(ARSENAL_BY_ID[up.dataset.chestUpgrade].name + ' auf Lv ' + arsenalLevel(up.dataset.chestUpgrade) + ' verbessert.');
    return renderChestModal(chestLastResult), render();
  }
  const look = t.closest('[data-chest-arsenal]');
  if (look) {
    closeModal('chestModal');
    return openArsenal(look.dataset.chestArsenal);
  }
  const mount = t.closest('[data-chest-mount]');
  if (mount && mountDna(mount.dataset.chestMount)) {
    feedback('upgrade', 'light');
    save();
    toast(dnaLabel(mountedDna()) + ' montiert – wirkt ab dem nächsten Kampf.');
    return renderChestModal(chestLastResult), render();
  }
  const werft = t.closest('[data-chest-werft]');
  if (werft) {
    closeModal('chestModal');
    dnaShowInWerft(werft.dataset.chestWerft);
  }
});
// opens the Werft area and brings one weapon card into view, marked for a moment
// the highlight lives for 2.6 s across re-renders of the Werft list (a resize or the closing modal re-renders it)
let dnaFocus = { uid: null, until: 0 };
function dnaApplyFocus() {
  const on = dnaFocus.uid && Date.now() < dnaFocus.until;
  document.querySelectorAll('#dnaWeapons .dna-focus').forEach(el => (!on || el.dataset.dna !== dnaFocus.uid) && el.classList.remove('dna-focus'));
  if (on) document.querySelector(`#dnaWeapons [data-dna="${dnaFocus.uid}"]`)?.classList.add('dna-focus');
}
function dnaShowInWerft(uid) {
  showScreen('battle');
  if (typeof setViewTab === 'function') setViewTab('battle', 'ship');
  dnaFocus = { uid, until: Date.now() + 2600 };
  render();
  const card = document.querySelector(`#dnaWeapons [data-dna="${uid}"]`);
  if (!card) return;
  card.scrollIntoView?.({ block: 'center', behavior: document.body.classList.contains('reduce-motion') ? 'auto' : 'smooth' });
  setTimeout(dnaApplyFocus, 2700);
}

// ----- after a lost wave: the player's own weapon that fits it better, one tap to mount -----
// How well a weapon fits a list of enemy kinds: the affinity factor against each (×1,25 strong, ×0,8 weak), averaged,
// times the chassis' role against each enemy family (DNA_CHASSIS vs, measured with tools/chassis-probe.mjs) and the share
// that goes through armour plates, times its base damage/s index. Only a clearly better owned weapon (≥ 10 %) is suggested; nothing is mounted without a tap.
function dnaFitFor(w, kinds) {
  if (!w || !kinds.length) return 0;
  const s = dnaStats(w),
    L = { affinity: w.affinity, affinity2: s.affinity2, stats: s };
  const per = kinds.map(k => {
    const fam = enemyDna(k).family,
      c = DNA_CHASSIS[w.chassis],
      armour = CAMPAIGN_ENEMIES[k]?.armor ? (c?.armorPierce ?? 0.5) / 0.5 : 1;
    return arenaAffinity(L, enemyDna(k).affinity) * (c?.vs?.[fam] || 1) * armour;
  });
  return (per.reduce((a, b) => a + b, 0) / per.length) * dnaPowerIndex(w);
}
function dnaBetterFor(kinds) {
  const d = state.meta?.dna;
  if (!d || !kinds.length) return null;
  const mounted = mountedDna(),
    now = mounted ? dnaFitFor(mounted, kinds) : 0;
  const best = d.owned.filter(w => w.uid !== d.mount).map(w => ({ w, fit: dnaFitFor(w, kinds) })).sort((a, b) => b.fit - a.fit)[0];
  if (!best || best.fit < now * 1.1 + 1e-9) return null;
  const strong = [...new Set(kinds)].filter(k => arenaAffinity({ affinity: best.w.affinity, affinity2: dnaStats(best.w).affinity2, stats: dnaStats(best.w) }, enemyDna(k).affinity) > 1).length;
  return { w: best.w, gain: now ? Math.round((best.fit / now - 1) * 100) : null, strong, kinds: [...new Set(kinds)].length };
}
const arenaAnalysisBeforeLoop = arenaAnalysis;
arenaAnalysis = (a, reason) => {
  const d = arenaAnalysisBeforeLoop(a, reason);
  const better = dnaBetterFor(a.queue || []);
  if (better) {
    const why = [better.strong ? 'stark gegen ' + better.strong + ' von ' + better.kinds + ' Gegnerarten' : '', better.gain !== null ? 'etwa +' + better.gain + ' % Wirkung gegen diese Welle' : '', DNA_CHASSIS_USE[better.w.chassis]?.good].filter(Boolean).join(' · ');
    d.tips = [{ kind: 'equip', uid: better.w.uid, text: 'Deine ' + dnaLabel(better.w) + ' passt besser zu dieser Welle: ' + why + '.' }, ...d.tips].slice(0, 3);
  }
  return d;
};
const defeatHTMLBeforeLoop = defeatHTML;
defeatHTML = d => {
  const html = defeatHTMLBeforeLoop(d);
  const equip = d.tips.find(t => t.kind === 'equip');
  if (!equip) return html;
  const mounted = state.meta?.dna?.mount === equip.uid;
  // the base renderer shows an unknown tip kind as plain text: give it its button
  return html.replace(`<div class="defeat-tip"><span>${equip.text}</span></div>`, `<div class="defeat-tip equip"><span>${equip.text}</span>${mounted ? '<em>✓ montiert</em>' : `<button data-defeat-mount="${equip.uid}">MONTIEREN</button>`}</div>`);
};
document.addEventListener('click', event => {
  const b = event.target.closest('[data-defeat-mount]');
  if (!b || !mountDna(b.dataset.defeatMount)) return;
  feedback('upgrade', 'light');
  save();
  toast(dnaLabel(mountedDna()) + ' montiert – versuch die Welle noch einmal.');
  b.replaceWith(Object.assign(document.createElement('em'), { textContent: '✓ montiert' }));
  render();
});

// ----- the expedition prep: the mounted weapon, the one that fits this fight best, the rest folded -----
function expFightKinds() {
  const key = expedition.key;
  if (!key) return [];
  return expedition.target === 'boss' ? [ARENA_BOSSES[key].kind] : [...new Set(arenaWaveFoes(key, campaignCleared(key)))];
}
const expWeaponHTMLBeforeLoop = expWeaponHTML;
expWeaponHTML = () => {
  const d = state.meta.dna;
  if (!d || d.owned.length <= 2) return expWeaponHTMLBeforeLoop(); // a short list stays as it was
  const kinds = expFightKinds(),
    better = dnaBetterFor(kinds),
    weaponAff = WEAPON_AFFINITY[state.ship.weaponType],
    btn = (w, badge = '') =>
      `<button class="exp-weapon ${w.uid === d.mount ? 'active' : ''}${badge ? ' recommended' : ''}" ${w.uid === d.mount ? 'aria-pressed="true"' : `data-dna-mount="${w.uid}"`}><b>${dnaLabel(w)}</b>${dnaAffinityChip(w.affinity)}${badge}<small>${ARSENAL_RARITY_NAME[w.rarity] || w.rarity} · ${DNA_CHASSIS_USE[w.chassis] ? 'stark: ' + DNA_CHASSIS_USE[w.chassis].good : DNA_CHASSIS[w.chassis]?.text || ''}</small></button>`;
  const mounted = mountedDna(),
    first = [mounted, better?.w].filter(Boolean),
    rest = d.owned.filter(w => !first.includes(w));
  return `<section class="exp-block"><h3>DNA-Waffe</h3><div class="exp-weapons">${first.map(w => btn(w, w === better?.w ? '<em class="exp-pick">★ passt besser zu diesem Kampf</em>' : '')).join('')}${
    mounted ? '' : `<button class="exp-weapon active" aria-pressed="true"><b>Bordgeschütz (${state.ship.weaponType})</b>${dnaAffinityChip(weaponAff)}<small>ohne DNA-Waffe · Werte des Waffensystems</small></button>`
  }</div>${rest.length ? `<details class="exp-more"><summary>Weitere Waffen (${rest.length})</summary><div class="exp-weapons">${rest.map(w => btn(w)).join('')}${mounted ? `<button class="exp-weapon" data-dna-unmount><b>Bordgeschütz (${state.ship.weaponType})</b>${dnaAffinityChip(weaponAff)}<small>ohne DNA-Waffe · Werte des Waffensystems</small></button>` : ''}</div></details>` : ''}</section>`;
};

// ----- combat: back from steering by hand to the automatic steering (and its assistant) -----
// Before, the first drag switched the ship to manual for the rest of the wave. Now the HUD says who steers and one tap
// gives the steering back; the next drag takes it again. Deterministic: the change applies at the next fixed step.
function arenaAutoSteer(a) {
  if (!a || a.result || !a.manual) return false;
  a.manual = false;
  return true;
}
// ----- combat: what an enemy role asks of the player, the first time it shows up in a wave -----
// The roles already play differently (arena.js and outer-campaigns.js); in the fight nothing said so. Each role is
// named once per wave, for 3.5 s of fight time, with the answer the game has for it; one at a time (later ones wait).
const ROLE_CALL = {
  swarm: { icon: '🐝', name: 'Schwarm', act: 'stürzt aufs Schiff – Schildpuls fängt den Aufprall' },
  heavy: { icon: '🛡', name: 'Panzer', act: 'Platten schlucken Schaden – Salve oder Brecher-Waffe' },
  ranged: { icon: '🎯', name: 'Fernkämpfer', act: 'rote Linie = Schuss kommt – zur Seite wischen' },
  disruptor: { icon: '⚡', name: 'Störer', act: 'verzögert Schild und Salve – antippen, zuerst ausschalten' },
  support: { icon: '✚', name: 'Unterstützer', act: 'schützt Verbündete – antippen, Salve bricht Barrieren' },
  artillery: { icon: '◎', name: 'Artillerie', act: 'roter Kreis = Einschlag – den Kreis verlassen' },
  summoner: { icon: '📣', name: 'Rufer', act: 'ruft Verstärkung – früh ausschalten' },
  elite: { icon: '★', name: 'Elite', act: 'Siegelschild – die Salve bricht es' }
};
const roleCalls = new WeakMap();
function roleCallState(a) {
  let st = roleCalls.get(a);
  if (!st) roleCalls.set(a, (st = { seen: new Set(), queue: [], now: null, until: 0 }));
  return st;
}
// the current call of a fight (null when none); advances with the fight's own clock (a.t), so a pause holds it
function arenaRoleCall(a) {
  if (!a || a.result || a.boss) return null;
  const st = roleCallState(a);
  for (const f of a.foes)
    if (f.hp > 0 && ROLE_CALL[f.family] && !st.seen.has(f.family)) {
      st.seen.add(f.family);
      st.queue.push(f.family);
    }
  if (st.now && a.t >= st.until) st.now = null;
  if (!st.now && st.queue.length) {
    st.now = st.queue.shift();
    st.until = a.t + 3.5;
  }
  return st.now ? { family: st.now, ...ROLE_CALL[st.now] } : null;
}
function renderRoleCall(a, top) {
  let el = $('expRole');
  if (!el || !top.contains(el)) {
    el = document.createElement('div');
    el.id = 'expRole';
    el.className = 'exp-role';
    el.setAttribute('role', 'status');
    top.append(el);
  }
  const call = arenaRoleCall(a),
    key = call ? call.family : '';
  if (el.dataset.role === key) return;
  el.dataset.role = key;
  setHTML(el, call ? `<span><i aria-hidden="true">${call.icon}</i><b>${call.name}</b> ${call.act}</span>` : '');
}
const renderExpeditionHudBeforeLoop = renderExpeditionHud;
renderExpeditionHud = () => {
  renderExpeditionHudBeforeLoop();
  const a = arenaRun,
    top = $('expTop');
  if (!top) return;
  // its own element inside the HUD (the HUD is rewritten only when its text changes; then the row comes back once)
  let el = $('expSteer');
  if (!el || !top.contains(el)) {
    el = document.createElement('div');
    el.id = 'expSteer';
    el.className = 'exp-steer-row';
    top.append(el);
  }
  renderRoleCall(a, top);
  // P1.5: without any Auto-Fly part the player flies (there is nothing to hand the flight back to)
  const fly = a && typeof arenaControlOf === 'function' ? arenaControlOf(a).fly || {} : { lane: true },
    flyAny = Boolean(fly.lane || fly.zones || fly.dodge),
    mode = !a || a.result ? '' : !flyAny ? 'pilot' : a.manual ? 'manual' : fly.dodge && a.loadout?.dodgeAssist ? 'assist' : 'auto';
  if (el.dataset.mode === mode) return;
  el.dataset.mode = mode;
  setHTML(
    el,
    !mode
      ? ''
      : mode === 'pilot'
        ? '<span class="exp-steer">✋ Du fliegst · wischen = Kurs ändern</span>'
        : mode === 'manual'
        ? '<button class="exp-steer manual" data-arena-auto aria-label="Du steuerst selbst. Tippen: zurück zur Auto-Steuerung">✋ Du steuerst · <b>AUTO</b></button>'
        : '<span class="exp-steer">✈ Auto-Steuerung' + (mode === 'assist' ? ' + Assistent' : '') + ' · wischen = selbst</span>'
  );
};
document.addEventListener('click', event => {
  if (!event.target.closest('[data-arena-auto]')) return;
  if (arenaAutoSteer(arenaRun)) {
    feedback('open', 'light');
    renderExpeditionHud();
  }
});

// ----- progression after the first steps: one thing at a time, by real progress -----
// The first steps hide everything that is not part of them (onboarding.js). Afterwards, before, everything came back at
// once. Now: the scene tools (district jumps, zoom, Mochi) once the colony runs a second station by itself or the
// Galaxie is open; the daily reward and the gem shop with the Galaxie. Nothing is locked – the functions behind them
// are the same; the Mine button has its own rule (world-shell.js).
function progressionGates() {
  const done = !state.meta?.onboarding || state.meta.onboarding.done,
    auto = typeof colonyAutomation === 'function' ? colonyAutomation(0) : {},
    galaxy = typeof screenUnlocked === 'function' && screenUnlocked('trade');
  // Beta 1.8 A3: the district jumps come right after the first steps (they are the quick way through the colony)
  return { nav: done, tools: done && (galaxy || Boolean(auto.rail) || state.galaxiesSold > 0), extras: done && (galaxy || state.galaxiesSold > 0) };
}
// render() runs often: touch the body classes only when a gate changes (a class write restyles the page)
let progressionGatesShown = '';
function renderProgressionGates() {
  const g = progressionGates(),
    key = (g.nav ? 'n' : '') + (g.tools ? 't' : '') + (g.extras ? 'e' : '');
  if (key === progressionGatesShown && document.body.classList.contains('pg-tools') === g.tools) return;
  progressionGatesShown = key;
  document.body.classList.toggle('pg-nav', g.nav);
  document.body.classList.toggle('pg-tools', g.tools);
  document.body.classList.toggle('pg-extras', g.extras);
}

// ----- Details: locked buildings in one line, their conditions on demand -----
const industryProductionCardsBeforeLoop = industryProductionCards;
industryProductionCards = () => {
  const html = industryProductionCardsBeforeLoop(),
    locked = Object.entries(INDUSTRY_BUILDINGS).filter(([id]) => planetAllows(id) && !industryUnlocked(id) && industryLevel(id) === 0);
  if (!locked.length) return html;
  // the full cards of locked buildings leave the list; one summary carries their names and conditions
  const box = document.createElement('div');
  box.innerHTML = html;
  for (const [id] of locked) box.querySelector(`[data-build-industry="${id}"]`)?.closest('.production-card')?.remove();
  const cond = ([, def]) => (def.needs ? INDUSTRY_BUILDINGS[def.needs].name + ' bauen' : 'Lagerhaus Lv ' + def.unlockDepot);
  const next = locked.slice().sort((a, b) => (a[1].unlockDepot || 99) - (b[1].unlockDepot || 99))[0];
  return (
    box.innerHTML +
    `<details class="production-locked"><summary><span>🔒 Später: ${locked.length} Gebäude</span><small>als Nächstes ${next[1].name} · ${cond(next)}</small></summary><ul>${locked
      .map(e => `<li><b>${e[1].icon} ${e[1].name}</b><small>${cond(e)} · ${INDUSTRY_ROLE[e[0]].split('.')[0]}</small></li>`)
      .join('')}</ul></details>`
  );
};

// ----- building panels: focus goes in when one opens and back when it closes -----
let sheetReturnFocus = null;
const openBuildingSheetBeforeLoop = openBuildingSheet;
openBuildingSheet = index => {
  const active = document.activeElement;
  if (active && active !== document.body && !$('buildingSheet')?.contains(active)) sheetReturnFocus = active;
  openBuildingSheetBeforeLoop(index);
  const sheet = $('buildingSheet');
  if (sheet && !sheet.classList.contains('hidden')) {
    sheet.tabIndex = -1;
    sheet.focus({ preventScroll: true });
  }
};
function sheetRestoreFocus() {
  const target = sheetReturnFocus && sheetReturnFocus.isConnected ? sheetReturnFocus : document.querySelector('canvas.scene-colony');
  sheetReturnFocus = null;
  target?.focus?.({ preventScroll: true });
}
document.addEventListener('click', event => {
  if (event.target.closest('[data-close-sheet]')) requestAnimationFrame(sheetRestoreFocus);
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && openSheetIndex !== null && !topModal()) requestAnimationFrame(sheetRestoreFocus);
});

// ----- the Abenteuer areas name what waits there: the Truhen tab counts the chests -----
// the tab button is looked up once (a document-wide attribute query on every render was the costly part) and the
// badge is written only when the count changes
let areaBadgeButton = null,
  areaBadgeShown = -1;
function renderAreaBadges() {
  if (!areaBadgeButton?.isConnected) {
    areaBadgeButton = document.querySelector('[data-view-tab-button="battle:chests"]');
    areaBadgeShown = -1;
  }
  const b = areaBadgeButton;
  if (!b) return;
  const n = typeof arsenalChestTotal === 'function' ? arsenalChestTotal() : 0;
  if (n === areaBadgeShown) return;
  areaBadgeShown = n;
  let badge = b.querySelector('.tab-badge');
  if (!n) {
    badge?.remove();
    b.removeAttribute('aria-label');
    return;
  }
  if (!badge) b.append((badge = Object.assign(document.createElement('i'), { className: 'tab-badge' })));
  badge.textContent = String(n);
  b.setAttribute('aria-label', 'Truhen: ' + n + ' ungeöffnet');
}

// ----- the Handel area in groups: the overview stays open; traders, contracts and the raw market fold -----
(function groupMarket() {
  const trade = $('trade');
  if (!trade || trade.querySelector('.market-group')) return;
  const groups = [
    ['traderPanel', 'Händler', 'Versorgung kaufen, Waren verkaufen'],
    ['bazaarContracts', 'Aufträge', 'Lieferungen gegen Credits und Boni'],
    ['tradeList', 'Rohstoffmarkt', 'Erz, Kristalle und Legierungen tauschen']
  ];
  for (const [id, title, hint] of groups) {
    const panel = $(id);
    if (!panel || panel.parentElement !== trade) continue;
    // the section heading before the panel (the raw market has its alert line in between)
    let heading = panel.previousElementSibling;
    if (heading && !heading.classList.contains('section-heading')) heading = heading.previousElementSibling;
    if (heading && !heading.classList.contains('section-heading')) heading = null;
    const details = document.createElement('details');
    details.className = 'market-group';
    details.dataset.viewTab = 'market';
    details.innerHTML = `<summary><b>${title}</b><small>${hint}</small></summary>`;
    (heading || panel).before(details);
    let el = heading || panel;
    while (el) {
      const next = el === panel ? null : el.nextElementSibling;
      details.append(el);
      el = next;
    }
  }
  if (typeof viewTabsChanged === 'function') viewTabsChanged('trade'); // the groups are new tagged cards
})();
// a jump into a folded group opens it (the game's own "zu den Aufträgen" etc.)
const scrollIntoViewBeforeMarket = Element.prototype.scrollIntoView;
Element.prototype.scrollIntoView = function (...args) {
  const group = this.closest?.('.market-group');
  if (group && !group.open) group.open = true;
  return scrollIntoViewBeforeMarket?.apply(this, args);
};

const renderBeforeLoop = render;
render = () => {
  renderBeforeLoop();
  renderProgressionGates();
  renderAreaBadges();
  if (dnaFocus.uid) dnaApplyFocus();
};

// ----- the prep names the chassis' role against this fight (DNA_CHASSIS vs) -----
const expChassisNoteBeforeLoop = expChassisNote;
expChassisNote = (kinds, L) => {
  const html = expChassisNoteBeforeLoop(kinds, L),
    vs = L.chassis ? DNA_CHASSIS[L.chassis]?.vs : null;
  if (!vs) return html;
  const fams = kinds.map(k => enemyDna(k).family),
    good = [...new Set(fams.filter(f => vs[f] > 1))],
    bad = [...new Set(fams.filter(f => vs[f] < 1))],
    famName = f => DNA_FAMILY_NAME[f] || f;
  if (!good.length && !bad.length) return html;
  const line = [
    good.length ? `<span class="good">${DNA_CHASSIS[L.chassis].name}: ${good.map(f => famName(f) + ' +' + Math.round((vs[f] - 1) * 100) + ' %').join(', ')}</span>` : '',
    bad.length ? `<span class="warn">${bad.map(f => famName(f) + ' ' + Math.round((vs[f] - 1) * 100) + ' %').join(', ')}</span>` : ''
  ].filter(Boolean).join(' · ');
  return html ? html.replace('</p>', ' · ' + line + '</p>') : '<p class="exp-chassis">' + line + '</p>';
};
const DNA_FAMILY_NAME = { swarm: 'Schwärme', heavy: 'Panzer', elite: 'Elite', boss: 'Wächter', ranged: 'Fernkämpfer', disruptor: 'Störer', summoner: 'Rufer', support: 'Unterstützer', artillery: 'Artillerie', elemental: 'Elementare' };

// ----- the prep: does the mounted weapon's tuning fit this fight? (a reason and one tap to switch) -----
function dnaTuneAdvice(w, kinds, boss) {
  const id = w && DNA_TUNE_FOR[w.chassis];
  if (!id) return null;
  const on = dnaTune(w) === id,
    fams = kinds.map(k => enemyDna(k).family),
    count = f => fams.filter(x => x === f).length;
  let want = null,
    why = '';
  if (id === 'hunt') {
    const prey = fams.filter(f => DNA_TUNES.hunt.prey.includes(f)).length;
    if (prey) (want = true), (why = prey + ' Störer/Unterstützer/Rufer in dieser Welle');
    else (want = false), (why = 'keine Störer, Unterstützer oder Rufer in dieser Welle');
  } else if (id === 'stagger') {
    const shooters = count('ranged') + count('elite') + count('artillery') + count('disruptor');
    if (boss) (want = false), (why = 'Wächter lassen sich nicht erschüttern');
    else if (shooters >= 2) (want = true), (why = shooters + ' Schützen in dieser Welle');
  } else if (id === 'guard') {
    // Beta 1.9 M8: the scatter's Abwehrfächer catches small straight shots; measured, it halves the hits on the ship in
    // big waves and against a guardian (tools/chassis-probe.mjs --tune) and costs time – worth it where much flies
    if (boss) (want = true), (why = 'ein Wächter feuert viele Geschosse');
    else if (kinds.length >= 4) (want = true), (why = kinds.length + ' Gegner: viele Geschosse in dieser Welle');
    else (want = false), (why = 'kleine Welle: volle Wirkung lohnt mehr');
  } else if (id === 'aim') {
    if (boss || count('elite')) (want = true), (why = boss ? 'ein einzelner Wächter' : 'ein Elite-Gegner in dieser Welle');
    else if (kinds.length >= 4) (want = false), (why = kinds.length + ' Gegner, oft in einer Linie');
  }
  if (want === null || want === on) return null;
  return { uid: w.uid, on: want, name: want ? DNA_TUNES[id].name : 'Standard', why };
}
const expMatchHTMLBeforeTune = expMatchHTML;
expMatchHTML = () => {
  const html = expMatchHTMLBeforeTune(),
    w = mountedDna(),
    kinds = typeof arenaWaveFoes === 'function' && expedition.key ? (expedition.target === 'boss' ? [ARENA_BOSSES[expedition.key].kind] : arenaWaveFoes(expedition.key, campaignCleared(expedition.key))) : [],
    tip = dnaTuneAdvice(w, kinds, expedition.target === 'boss');
  if (!tip) return html;
  return html.replace(/<\/section>\s*$/, `<p class="exp-tune">Abstimmung: <b>${tip.name}</b> passt hier besser (${tip.why}). <button type="button" class="exp-secondary" data-dna-tune="${tip.uid}" data-tune-on="${tip.on ? 1 : 0}">UMSTELLEN</button></p></section>`);
};

// ----- the fight's own buttons act on the finger's press (touch and pen) -----
// Measured in browser emulation: the first tap on an ability right after a dodge swipe lost its click in 14 of 16 runs
// (the touch sequence reached the button, the click never came), so the shield came late or not at all. The fight's
// buttons (abilities, AUTO, pause) now act on pointerdown for touch and pen; the click that may follow is dropped once.
// Mouse and keyboard keep the normal click.
const FIGHT_PRESS = '[data-arena-ability], [data-arena-auto], [data-exp-pause]';
let fightPressed = null;
document.addEventListener(
  'pointerdown',
  event => {
    if (event.pointerType === 'mouse' || !event.isPrimary) return;
    const b = event.target.closest?.(FIGHT_PRESS);
    if (!b || b.disabled || !b.closest('#expedition')) return;
    fightPressed = { el: b, at: performance.now() };
    b.click();
    fightPressed.done = true;
  },
  true
);
document.addEventListener(
  'click',
  event => {
    const p = fightPressed;
    if (!p?.done) return; // the click this file sends on the press goes through
    const b = event.target.closest?.(FIGHT_PRESS);
    if (b && performance.now() - p.at < 1000 && (b === p.el || b.dataset.arenaAbility === p.el.dataset.arenaAbility)) {
      fightPressed = null;
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  },
  true
);
