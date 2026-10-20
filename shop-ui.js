// Beta 1.3 — shop sections: KOMFORT (boosts, unchanged) · LOOKS · SETS · KISTEN · ECHTGELD (the store offers,
// unchanged — and unavailable in release builds). Everything here is earned by playing:
//   LOOKS  P1.4 Boutique: the three entries (Kätzchen-Studio, Schiffs-Studio, Sammlung), category chips, an owned and a
//          rarity filter, and one card per look with a real preview drawn by the game's own art, its rarity, where it
//          comes from (free, in-game currency, achievement, event, premium) and one clear action: KAUFEN or SCHMIEDEN
//          (always confirmed in a dialog), ANLEGEN / ABLEGEN, or the studio to try it on.
//   SETS   the one set registry (monetization.js COSMETIC_SETS): bundles of forge looks for 80 % of the missing pieces'
//          Sternsplitter (owned pieces are never charged), collection sets with their cosmetic reward.
//   KISTEN the Arsenal's chests with their real drop odds and sources — opened in the Arsenal. There are no paid
//          random chests (docs/MONETIZATION.md "no paid randomness"; docs/beta-1-3/MONETIZATION_PLAN.md).
// One ownership list (meta.cosmetics / meta.equipped) for all of it. Loaded after forge-ui.js.

// P1.2: the categories are the cosmetic domains of the one registry (monetization.js COSMETIC_DOMAINS): Kätzchen,
// Schiff, Waffen-Effekte, Begleiter, Welt, Profil – a new slot or domain shows up here by its table entry
const LOOK_CATEGORIES = Commerce.COSMETIC_DOMAINS || [
  { id: 'outfit', name: 'Outfits', slots: ['outfit', 'mochi'] },
  { id: 'ship', name: 'Schiff', slots: ['ship', 'engine', 'impact', 'glider', 'ring', 'trail'] },
  { id: 'colony', name: 'Kolonie', slots: ['colony'] },
  { id: 'mine', name: 'Mine', slots: ['mine'] }
];
const LOOK_SLOT_NAME = { ...FORGE_SLOT_NAME, ring: 'Planetenring', trail: 'Drohnenspur', mochi: 'Mochi-Accessoire', ...(Commerce.COSMETIC_SLOT_NAMES || {}) };
// the looks the Schiffs-Studio shows on the ship (tried on there before buying)
const LOOK_SHIP_SLOTS = ['ship', 'decal', 'engine', 'muzzle', 'shot', 'impact'];
// the look equipped in a slot (scenes read it while drawing: the hull signature, the muzzle style, the impact look)
function equippedCosmetic(slot) {
  return state?.meta?.equipped?.[slot] || null;
}
// a look's price in a currency earned by playing: { cur, amount, have, sign } (null for free, event or package looks)
const LOOK_SIGN = { credits: '◈', gems: '💎', forge: '✦' };
function lookPriceOf(id) {
  const src = Commerce.cosmeticSource(id);
  if (!src || !LOOK_SIGN[src.kind]) return null;
  const have = src.kind === 'credits' ? state.credits : src.kind === 'gems' ? state.gems : state.meta.arsenal?.splitters || 0;
  return { cur: src.kind, amount: src.amount, have, sign: LOOK_SIGN[src.kind] };
}
/**
 * One synchronous transaction for a look sold for credits or gems: the price and the ownership change together and the
 * caller saves right after. A kitten piece goes through the wardrobe (it is worn per kitten), a forge look through
 * forgeCraft. Never a second charge.
 * @returns {'bought'|'owned'|'poor'|'unknown'}
 */
function lookBuy(id) {
  const item = Commerce.COSMETICS[id],
    p = item ? lookPriceOf(id) : null;
  if (!item || item.wear || !p || p.cur === 'forge') return 'unknown';
  if (state.meta.cosmetics.includes(id)) return 'owned';
  if (p.have < p.amount) return 'poor';
  if (p.cur === 'credits') state.credits -= p.amount;
  else state.gems -= p.amount;
  state.meta.cosmetics.push(id);
  return 'bought';
}
// the sets of the one registry: bundles (Sets tab) and collection sets (album and Sets tab)
const LOOK_SETS = (Commerce.COSMETIC_SETS || []).filter(s => s.bundle);
const SET_DISCOUNT = 0.8;

function lookSource(id, item) {
  if (item.forge) return 'Sternenschmiede · ✦ ' + item.forge;
  if (item.credits) return 'Für ◈ ' + fmt(item.credits);
  if (item.achievement && typeof WARDROBE_ACHIEVEMENTS !== 'undefined' && WARDROBE_ACHIEVEMENTS[item.achievement]) return '🏅 Gratis · ' + WARDROBE_ACHIEVEMENTS[item.achievement].text;
  if (item.gems) return 'Für 💎 ' + fmt(item.gems);
  if (item.reward) return '🎁 Gratis · Belohnung für das komplette ' + (Commerce.COSMETIC_SETS.find(s => s.id === item.reward)?.name || 'Set');
  if (Commerce.WELCOME_POOL.includes(id)) return 'Willkommenskapsel';
  if (Commerce.SEASON_THEMES?.some(t => t.cosmetics.includes(id))) return 'Sternenroute (Saison)';
  return 'Paket – Echtgeld ist in dieser Beta abgeschaltet';
}
// the short badge on a card: the price, or what earns it
function lookBadge(id) {
  const src = Commerce.cosmeticSource(id),
    p = lookPriceOf(id);
  if (p) return p.sign + ' ' + fmt(p.amount);
  if (src.kind === 'achievement') return '🏅 ' + (typeof WARDROBE_ACHIEVEMENTS !== 'undefined' ? WARDROBE_ACHIEVEMENTS[src.id]?.name || 'Erfolg' : 'Erfolg');
  if (src.kind === 'set') return '🎁 Set-Belohnung';
  if (src.kind === 'welcome') return '🎁 Kapsel';
  if (src.kind === 'season') return '★ Event';
  return 'Premium · aus';
}
const lookRarity = id => (Commerce.COSMETIC_RARITIES || {})[Commerce.cosmeticRarity ? Commerce.cosmeticRarity(id) : 'common'] || { name: '', color: '#c9c3ee' };

// ----- the Boutique (LOOKS) -----
const lookView = { cat: 'all', own: 'all', rarity: 'all' };
let lookBuyAsk = null; // the look (or set) the confirm dialog is asking about
function lookWearers(id) {
  const item = Commerce.COSMETICS[id];
  return item?.wear && typeof WARDROBE !== 'undefined' ? Object.keys(WARDROBE).filter(c => state.meta.wardrobe?.chars?.[c]?.[item.wear] === id) : [];
}
function lookCardHTML(id) {
  const item = Commerce.COSMETICS[id],
    info = Commerce.cosmeticInfo(id, state.meta),
    owned = info.owned,
    rar = lookRarity(id),
    wearers = lookWearers(id),
    on = item.wear ? wearers.length > 0 : state.meta.equipped[item.slot] === id,
    p = lookPriceOf(id),
    world = info.world ? ' · ' + Commerce.COSMETIC_WORLDS[info.world] : '';
  // the picture: kitten pieces and ship looks are tried on in their studio with one tap on it
  const tryOn = item.wear
      ? `data-studio-open="${wearers[0] || 'mochi'}" data-studio-item="${id}"`
      : LOOK_SHIP_SLOTS.includes(item.slot)
        ? `data-ship-studio-open data-ship-studio-item="${id}"`
        : '',
    art = `<canvas width="192" height="112" data-look-preview="${id}" aria-hidden="true"></canvas><i class="look-rarity">${rar.name}</i>${on ? `<em class="look-state on">${wearers.length ? 'TRÄGT: ' + wearers.map(c => WARDROBE[c].name).join(', ') : 'ANGELEGT'}</em>` : owned ? '<em class="look-state">IM BESITZ</em>' : ''}${tryOn ? '<span class="look-try" aria-hidden="true">👁</span>' : ''}`;
  let action;
  if (owned) action = item.wear ? `<button class="secondary" data-studio-open="${wearers[0] || 'mochi'}" data-studio-item="${id}">IM STUDIO</button>` : `<button class="${on ? 'secondary' : ''}" data-equip="${id}">${on ? 'ABLEGEN' : 'ANLEGEN'}</button>`;
  else if (p) action = `<button data-look-buy="${id}" ${p.have >= p.amount ? '' : 'disabled'}>${p.cur === 'forge' ? 'SCHMIEDEN' : 'KAUFEN'} · ${p.sign} ${fmt(p.amount)}</button>`;
  else action = `<small class="look-source">${lookSource(id, item)}</small>`;
  return `<article class="look-card rar-${info.rarity}${owned ? ' owned' : ''}${on ? ' equipped' : ''}" style="--rar:${rar.color}" data-look-card="${id}">${tryOn ? `<button class="look-art" ${tryOn} aria-label="${item.name} anprobieren">${art}</button>` : `<div class="look-art">${art}</div>`}<b>${item.icon} ${item.name}</b><small>${LOOK_SLOT_NAME[item.slot] || ''}${world}${Commerce.WELCOME_POOL.includes(id) ? ' · auch aus der Willkommenskapsel' : ''}</small>${owned || p ? '' : `<span class="look-src src-${info.group}">${lookBadge(id)}</span>`}${action}</article>`;
}
// which looks the filters let through (the category chips, owned, rarity)
function lookFiltered(ids) {
  return ids.filter(id => {
    const owned = state.meta.cosmetics.includes(id);
    if (lookView.own === 'owned' && !owned) return false;
    if (lookView.own === 'missing' && owned) return false;
    return lookView.rarity === 'all' || Commerce.cosmeticRarity(id) === lookView.rarity;
  });
}
function lookEntriesHTML() {
  const ids = Object.keys(Commerce.COSMETICS),
    owned = ids.filter(id => state.meta.cosmetics.includes(id)).length;
  return `<div class="look-entries"><button class="studio-entry" data-studio-open="mochi"><i aria-hidden="true">🐾</i><span><b>Kätzchen-Studio</b><small>Mochi, Void und die Crew frei einkleiden</small></span></button><button class="studio-entry ship" data-ship-studio-open><i aria-hidden="true">🚀</i><span><b>Schiffs-Studio</b><small>Lack, Spur, Mündung, Geschoss, Treffer</small></span></button><button class="studio-entry album" data-collection-open><i aria-hidden="true">📖</i><span><b>Sammlung</b><small>${owned} / ${ids.length} Looks · Sets</small></span></button></div>`;
}
function looksHTML() {
  const ids = Object.keys(Commerce.COSMETICS),
    owned = ids.filter(id => state.meta.cosmetics.includes(id)).length,
    cats = LOOK_CATEGORIES.filter(cat => ids.some(id => cat.slots.includes(Commerce.COSMETICS[id].slot)));
  if (lookView.cat !== 'all' && !cats.some(c => c.id === lookView.cat)) lookView.cat = 'all';
  const chips = [['all', 'Alle'], ...cats.map(c => [c.id, c.name])].map(([id, name]) => `<button class="${lookView.cat === id ? 'active' : ''}" data-look-cat="${id}" aria-pressed="${lookView.cat === id}">${name}</button>`).join(''),
    own = `<select data-look-own aria-label="Besitz">${[['all', 'Alle Looks'], ['owned', 'Im Besitz'], ['missing', 'Fehlt noch']].map(([id, name]) => `<option value="${id}" ${lookView.own === id ? 'selected' : ''}>${name}</option>`).join('')}</select>`,
    rarities = `<select data-look-rarity aria-label="Seltenheit"><option value="all">Jede Seltenheit</option>${Object.entries(Commerce.COSMETIC_RARITIES).map(([id, r]) => `<option value="${id}" ${lookView.rarity === id ? 'selected' : ''}>${r.name}</option>`).join('')}</select>`;
  const sections = cats
    .filter(cat => lookView.cat === 'all' || cat.id === lookView.cat)
    .map(cat => {
      const list = lookFiltered(ids.filter(id => cat.slots.includes(Commerce.COSMETICS[id].slot))).sort(
        (a, b) => cat.slots.indexOf(Commerce.COSMETICS[a].slot) - cat.slots.indexOf(Commerce.COSMETICS[b].slot) || Commerce.COSMETIC_RARITIES[Commerce.cosmeticRarity(a)].rank - Commerce.COSMETIC_RARITIES[Commerce.cosmeticRarity(b)].rank
      );
      if (!list.length) return '';
      const slots = cat.slots.map(sl => LOOK_SLOT_NAME[sl]).filter(Boolean).join(' · ');
      return `<h3 class="look-heading">${cat.name}<small>${slots}</small></h3><div class="look-grid">${list.map(lookCardHTML).join('')}</div>`;
    })
    .join('');
  return (
    lookEntriesHTML() +
    `<p class="shop-note">Looks ändern nur das Aussehen – nie Schaden, Einkommen oder Beute. ${owned} / ${ids.length} im Besitz · ✦ ${fmt(state.meta.arsenal?.splitters || 0)} Sternsplitter.</p>` +
    `<div class="look-filter"><div class="look-chips" role="group" aria-label="Kategorie">${chips}</div><div class="look-own">${own}${rarities}</div></div>` +
    (sections || '<p class="shop-note">Keine Looks für diesen Filter.</p>')
  );
}
// ----- the confirm dialog: every purchase with a price (credits, gems, Sternsplitter; a look or a bundle set) -----
function lookConfirmOpen(kind, id) {
  lookBuyAsk = { kind, id };
  const box = $('lookConfirmModal');
  if (!box) return;
  if (kind === 'set') {
    const set = LOOK_SETS.find(s => s.id === id),
      { missing, price } = setPrice(set),
      have = state.meta.arsenal?.splitters || 0;
    $('lookConfirmKind').textContent = 'SET SCHMIEDEN';
    $('lookConfirmTitle').textContent = set.icon + ' ' + set.name;
    $('lookConfirmText').textContent = missing.map(m => Commerce.COSMETICS[m].name).join(' · ') + ' – rein optisch.';
    $('lookConfirmPrice').innerHTML = `<b>✦ ${fmt(price)}</b><small>Danach: ✦ ${fmt(have - price)}</small>`;
    drawLookPreview($('lookConfirmArt'), set.items[0]);
  } else {
    const item = Commerce.COSMETICS[id],
      p = lookPriceOf(id),
      rar = lookRarity(id);
    $('lookConfirmKind').textContent = (p.cur === 'forge' ? 'SCHMIEDEN' : 'KAUFEN') + ' · ' + rar.name.toUpperCase();
    $('lookConfirmTitle').textContent = item.icon + ' ' + item.name;
    $('lookConfirmText').textContent = (item.text ? item.text + '. ' : '') + 'Passt auf: ' + (Commerce.COSMETIC_FITS[item.slot] || '') + '. Rein optisch.';
    $('lookConfirmPrice').innerHTML = `<b>${p.sign} ${fmt(p.amount)}</b><small>Danach: ${p.sign} ${fmt(p.have - p.amount)}</small>`;
    box.querySelector('.modal-box').style.setProperty('--rar', rar.color);
    drawLookPreview($('lookConfirmArt'), id);
  }
  openModal('lookConfirmModal');
}
// BESTÄTIGEN: one transaction, saved at once; the new look is put on (a kitten piece on Mochi, as the forge always did)
function lookConfirmYes() {
  const ask = lookBuyAsk;
  lookBuyAsk = null;
  closeModal('lookConfirmModal');
  if (!ask) return;
  if (ask.kind === 'set') {
    if (!buySet(ask.id)) return toast('Nicht genug Sternsplitter');
    save();
    applyCosmetics();
    feedback('chest', 'success');
    toast(LOOK_SETS.find(s => s.id === ask.id).name + ' geschmiedet und angelegt!');
    renderShop();
    return render();
  }
  const id = ask.id,
    item = Commerce.COSMETICS[id],
    p = lookPriceOf(id);
  if (!item || !p) return;
  const result = state.meta.cosmetics.includes(id) ? 'owned' : p.cur === 'forge' ? (forgeCraft(id) ? 'bought' : 'poor') : item.wear ? wardrobeBuy(id) : lookBuy(id);
  if (result !== 'bought') {
    toast(result === 'poor' ? 'Nicht genug ' + { credits: 'Credits', gems: 'Gems', forge: 'Sternsplitter' }[p.cur] : 'Schon in deinem Besitz');
    return renderShop();
  }
  if (item.wear) wardrobeEquip('mochi', id);
  else state.meta.equipped[item.slot] = id;
  save();
  applyCosmetics();
  feedback('chest', 'success');
  toast(item.icon + ' ' + item.name + (p.cur === 'forge' ? ' geschmiedet' : ' gekauft') + ' und angelegt!');
  GameEvents?.emit?.('cosmetic-unlocked', { id, via: 'shop' });
  renderShop();
  const card = document.querySelector('#shopPanel [data-look-card="' + id + '"]');
  card?.classList.add('celebrate');
  setTimeout(() => card?.classList.remove('celebrate'), 1200);
  return render();
}
function setPrice(set) {
  const missing = set.items.filter(id => !state.meta.cosmetics.includes(id));
  return { missing, price: Math.floor(missing.reduce((s, id) => s + (Commerce.COSMETICS[id].forge || 0), 0) * (set.bundle || SET_DISCOUNT)) };
}
// one transaction: Sternsplitter and every missing piece together, saved right after; owned pieces cost nothing
function buySet(id) {
  const set = LOOK_SETS.find(s => s.id === id);
  if (!set || !state.meta.arsenal) return false;
  const { missing, price } = setPrice(set);
  if (!missing.length || state.meta.arsenal.splitters < price) return false;
  state.meta.arsenal.splitters -= price;
  for (const item of missing) state.meta.cosmetics.push(item);
  for (const item of set.items) state.meta.equipped[Commerce.COSMETICS[item].slot] = item;
  return true;
}
function setsHTML() {
  const splitters = state.meta.arsenal?.splitters || 0;
  const bundles = LOOK_SETS.map(set => {
    const { missing, price } = setPrice(set),
      full = set.items.reduce((s, id) => s + Commerce.COSMETICS[id].forge, 0);
    return `<article class="shop-item look-set"><div><b>${set.icon} ${set.name}</b><small>${set.text}</small><div class="set-pieces">${set.items.map(id => `<span class="${state.meta.cosmetics.includes(id) ? 'have' : ''}">${Commerce.COSMETICS[id].icon} ${Commerce.COSMETICS[id].name}</span>`).join('')}</div></div><div class="shop-buttons">${
      missing.length ? `<button data-set-buy="${set.id}" ${splitters >= price ? '' : 'disabled'}>✦ ${price}${missing.length < set.items.length ? '' : ` <s>${full}</s>`}</button>` : '<button disabled>KOMPLETT</button>'
    }</div></article>`;
  }).join('');
  // the collection sets: earned piece by piece, their reward is a look
  const collections = (Commerce.COSMETIC_SETS || [])
    .filter(s => s.reward)
    .map(set => {
      const pr = Commerce.setProgress(set, state.meta),
        reward = Commerce.COSMETICS[set.reward];
      return `<article class="shop-item look-set collection${pr.complete ? ' complete' : ''}"><div><b>${set.icon} ${set.name} · ${pr.have} / ${pr.total}</b><small>${set.text}</small><div class="set-pieces">${set.items.map(id => `<span class="${state.meta.cosmetics.includes(id) ? 'have' : ''}">${Commerce.COSMETICS[id].icon} ${Commerce.COSMETICS[id].name}</span>`).join('')}</div><small class="set-reward">🎁 Belohnung: ${reward.icon} ${reward.name} (${lookRarity(set.reward).name})${pr.rewarded ? ' – erhalten' : ''}</small></div><div class="shop-buttons"><button class="secondary" data-collection-open="${set.id}">IN DER SAMMLUNG</button></div></article>`;
    })
    .join('');
  return (
    '<p class="shop-note">Sets bündeln Looks für 80 % der Sternsplitter – Teile, die dir schon gehören, kosten nichts.</p>' +
    bundles +
    (collections ? '<h3 class="look-heading">Sammlungs-Sets<small>Teile einzeln erspielen – die Belohnung ist ein Look</small></h3>' + collections : '')
  );
}
function chestsHTML() {
  const a = state.meta.arsenal;
  if (!a) return '';
  const source = { standard: 'Feldzug-Wellen, Sektor-Bosse, Sektorprüfungen, Sammlung', elite: 'Siegelkreuzer-Welle, neue Boss-Rekorde, Silber in Prüfungen', relic: 'Gold in Prüfungen, Sammlungs-Meilensteine' };
  return (
    '<p class="shop-note">Kisten gibt es nur durchs Spielen. Es gibt keine Zufallskisten für Echtgeld – die Chancen stehen offen hier.</p>' +
    ARSENAL_CHEST_TYPES.map(type => {
      const c = ARSENAL_CHESTS[type],
        total = Object.values(c.weights).reduce((s, v) => s + v, 0),
        odds = Object.entries(c.weights)
          .map(([r, v]) => `${{ common: 'Gewöhnlich', uncommon: 'Ungewöhnlich', rare: 'Selten', epic: 'Episch', legendary: 'Legendär' }[r]} ${Math.round((v / total) * 100)} %`)
          .join(' · ');
      return `<article class="shop-item chest-info"><div><b>${c.name} · ${fmt(a[c.key] || 0)} im Besitz</b><small>Aus: ${source[type]}</small><small>${odds} · Doppelte werden zu ${c.splitters} ✦</small></div><div class="shop-buttons"><button data-chest-open-arsenal ${a[c.key] ? '' : 'disabled'}>IM ARSENAL ÖFFNEN</button></div></article>`;
    }).join('')
  );
}
function drawLookPreview(canvas, id) {
  const item = Commerce.COSMETICS[id];
  if (!item) return;
  // P1.4: a frame around the player's own Mochi, an engine trail behind the player's own ship, a shot ornament in flight
  if (item.slot === 'frame') return previewFrame(canvas, id);
  if (item.wear && window.SpaceKittens) return previewKitten(canvas, id, item);
  if (item.slot === 'engine' && window.CosmeticArt?.TRAILS?.[id]) return previewEngine(canvas, id);
  if (item.slot === 'decal' || item.slot === 'muzzle' || item.slot === 'shot') return previewShipCosmetic(canvas, id, item);
  if (item.slot === 'stall') return previewStall(canvas, id);
  if (item.slot === 'vehicle') return previewVehicle(canvas, id);
  if (item.slot === 'depot') return previewDepot(canvas, id);
  if (item.slot === 'decor') return previewDecor(canvas, id);
  if (['ship', 'engine', 'glider', 'impact', 'outfit', 'colony', 'mine'].includes(item.slot) && (item.forge || item.slot === 'ship' || item.slot === 'outfit')) return forgePreviewAny(canvas, id);
  const ctx = canvas.getContext?.('2d');
  if (!ctx) return;
  const w = canvas.width,
    h = canvas.height,
    bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#1d1f5c');
  bg.addColorStop(1, '#121437');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  if (item.slot === 'mochi' && window.SpaceKittens) {
    const Kit = window.SpaceKittens;
    ctx.save();
    ctx.translate(w / 2, h * 0.47);
    ctx.scale(h * 0.56, h * 0.56);
    Kit.drawKitten(ctx, Kit.withAccessories(Kit.ROSTER[0], [id]), { pose: 'idle', t: 1.3, seed: 1, mood: 'happy' });
    ctx.restore();
    return;
  }
  ctx.font = Math.round(h * 0.5) + 'px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(item.icon, w / 2, h / 2);
}
// forge previews know ship paints by palette, so non-forge ships (Aurora, Glut) work too
function forgePreviewAny(canvas, id) {
  const item = Commerce.COSMETICS[id];
  if (item.forge || item.slot === 'outfit') return forgePreview(canvas, id);
  const ctx = canvas.getContext?.('2d'),
    Art = window.NebulaArt;
  if (!ctx || !Art) return;
  const w = canvas.width,
    h = canvas.height,
    bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#1d1f5c');
  bg.addColorStop(1, '#121437');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  // Beta 1.5: previewed as in the fight — the real ship (refits, DNA weapon) with the paint's engine ribbon
  const palette = Art.SHIP_PALETTES[id] || Art.SHIP_PALETTES.default,
    ribbon = ctx.createLinearGradient(w * 0.36, 0, 0, 0);
  ribbon.addColorStop(0, palette.engine);
  ribbon.addColorStop(0.45, palette.trim);
  ribbon.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.strokeStyle = ribbon;
  ctx.lineCap = 'round';
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = h * 0.09;
  ctx.beginPath();
  ctx.moveTo(w * 0.36, h * 0.52);
  ctx.lineTo(w * 0.02, h * 0.5);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.save();
  ctx.translate(w * 0.58, h * 0.52);
  ctx.scale(h * 0.9, h * 0.9);
  Art.drawPlayerShip(ctx, state.ship.model, state.ship, 0.4, palette, null, 'happy');
  ctx.restore();
}

// P1.2: the hull signature on the player's own ship (zoomed on the wing it sits on) and the muzzle style firing
function previewShipCosmetic(canvas, id, item) {
  const ctx = canvas.getContext?.('2d'),
    Art = window.NebulaArt,
    DV = window.DnaVisuals;
  if (!ctx || !Art || !DV) return;
  const w = canvas.width,
    h = canvas.height,
    bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#1d1f5c');
  bg.addColorStop(1, '#121437');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  const palette = Art.SHIP_PALETTES[equippedCosmetic('ship')] || Art.SHIP_PALETTES.default,
    gear = { ...state.ship, decal: item.slot === 'decal' ? id : equippedCosmetic('decal') };
  ctx.save();
  ctx.translate(w * (item.slot === 'muzzle' ? 0.38 : 0.36), h * 0.52);
  ctx.scale(h * 0.85, h * 0.85);
  Art.drawPlayerShip(ctx, state.ship.model, gear, 0.4, palette, null, 'happy');
  ctx.restore();
  // the signature large beside the ship (on the hull it is small: it is a mark, not a paint)
  if (item.slot === 'decal') DV.drawDecal(ctx, id, w * 0.82, h * 0.5, h * 0.2);
  if (item.slot === 'muzzle') {
    const look = DV.weaponLook(typeof mountedDna === 'function' ? mountedDna() : null);
    if (look) DV.drawMuzzle(ctx, w * 0.78, h * 0.52, h / 40, look, 0.25, 0);
    DV.drawMuzzleOrnament(ctx, w * 0.8, h * 0.5, h / 40, id, 0.3);
  }
  // P1.4: the shot in flight in its DNA colour, its ornament behind it (the projectile keeps its chassis and affinity)
  if (item.slot === 'shot') {
    const look = DV.weaponLook((typeof mountedDna === 'function' ? mountedDna() : null) || { chassis: 'repeater', affinity: 'kinetic', rarity: 'common' }),
      x = w * 0.84,
      y = h * 0.5;
    window.CosmeticArt?.shotTrail(ctx, id, x, y, 1, 0, h / 14, 1.3, true);
    Art.glowCircle?.(ctx, x, y, h * 0.12, look?.color || '#8fe3ff', 0.7);
    ctx.fillStyle = look?.core || '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, h * 0.04, 0, Math.PI * 2);
    ctx.fill();
  }
}
function lookBackdrop(ctx, w, h) {
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#1d1f5c');
  bg.addColorStop(1, '#121437');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
}
// P1.4: Mochi (in what Mochi wears) inside a profile frame – the album's profile picture uses the same drawing
function drawFramedPortrait(ctx, cx, cy, r, frameId, t) {
  const Kit = window.SpaceKittens;
  if (!Kit) return;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = '#2a2468';
  ctx.fill();
  ctx.clip();
  ctx.translate(cx, cy + r * 0.12);
  ctx.scale(r * 1.15, r * 1.15);
  Kit.drawPortrait(ctx, typeof kitLook === 'function' ? kitLook('mochi') : Kit.ROSTER[0], { mood: 'happy', t: 1.3, seed: 2, px: r * 1.15 });
  ctx.restore();
  const reduced = document.documentElement.classList.contains('reduce-motion');
  if (!frameId || !window.CosmeticArt?.drawFrame(ctx, frameId, cx, cy, r, t, reduced)) {
    ctx.strokeStyle = 'rgba(196,179,255,0.6)';
    ctx.lineWidth = Math.max(2, r * 0.06);
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.04, 0, Math.PI * 2);
    ctx.stroke();
  }
}
// a kitten piece on Mochi: a head or face piece as a large portrait, clothes and back pieces on the whole kitten (seen
// a little from the side for a back piece) – the same rig and dressing as the studio
function previewKitten(canvas, id, item) {
  const ctx = canvas.getContext?.('2d'),
    Kit = window.SpaceKittens;
  if (!ctx) return;
  const w = canvas.width,
    h = canvas.height,
    look = Kit.dressed(Kit.ROSTER[0], { [item.wear]: id });
  lookBackdrop(ctx, w, h);
  const floor = ctx.createRadialGradient(w / 2, h * 0.92, 2, w / 2, h * 0.92, w * 0.4);
  floor.addColorStop(0, 'rgba(196,179,255,0.35)');
  floor.addColorStop(1, 'rgba(196,179,255,0)');
  ctx.fillStyle = floor;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  if (item.wear === 'head' || item.wear === 'face') {
    ctx.translate(w / 2, h * 0.56);
    ctx.scale(h * 0.62, h * 0.62);
    Kit.drawPortrait(ctx, look, { mood: 'happy', t: 1.3, seed: 2, px: h * 0.62 });
  } else {
    ctx.translate(w / 2, h * 0.95);
    ctx.scale(h * 0.72, h * 0.72);
    Kit.drawKitten(ctx, look, { pose: 'idle', t: 1.3, seed: 2, calm: true, px: h * 0.72, facing: item.wear === 'back' ? -1 : 1 });
  }
  ctx.restore();
}
function previewFrame(canvas, id) {
  const ctx = canvas.getContext?.('2d');
  if (!ctx) return;
  lookBackdrop(ctx, canvas.width, canvas.height);
  drawFramedPortrait(ctx, canvas.width / 2, canvas.height / 2, canvas.height * 0.34, id, 1.3);
}
// the player's own ship with the engine trail (the same drawing as the arena, the classic fight and the studio)
function previewEngine(canvas, id) {
  const ctx = canvas.getContext?.('2d'),
    Art = window.NebulaArt;
  if (!ctx || !Art) return;
  const w = canvas.width,
    h = canvas.height;
  lookBackdrop(ctx, w, h);
  window.CosmeticArt.engineTrail(ctx, id, { x: w * 0.42, y: h * 0.54 }, { x: w * 0.02, y: h * 0.5 }, h * 0.1, 1.3, true);
  const palette = Art.SHIP_PALETTES[equippedCosmetic('ship')] || Art.SHIP_PALETTES.default;
  ctx.save();
  ctx.translate(w * 0.62, h * 0.52);
  ctx.scale(h * 0.85, h * 0.85);
  Art.drawPlayerShip(ctx, state.ship.model, state.ship, 0.4, palette, null, 'happy');
  ctx.restore();
}
// P1.3: a building look on the real building (the Orion stall at a developed level, on its ground)
function previewStall(canvas, id) {
  const ctx = canvas.getContext?.('2d'),
    CA = window.ColonyArt,
    Art = window.NebulaArt;
  if (!ctx || !CA?.stall) return;
  const w = canvas.width,
    h = canvas.height,
    bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#2a2766');
  bg.addColorStop(1, '#4a3a86');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#b9b3ff';
  ctx.fillRect(0, h * 0.86, w, h * 0.14);
  CA.stall(ctx, w / 2, h * 0.88, h * 0.3, { level: 40, time: 1, fill: 0.6, theme: Art?.THEMES?.crystal || { accent: '#c4b3ff' }, skin: id });
}
// P1.5: the vehicle paint on a loaded rover and a cart of the cart line (as they drive, the ornament awake); the depot
// roof on a developed warehouse; a decoration on the planet you are on
function lookGround(ctx, w, h) {
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#2a2766');
  bg.addColorStop(1, '#4a3a86');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#b9b3ff';
  ctx.fillRect(0, h * 0.82, w, h * 0.18);
}
function previewVehicle(canvas, id) {
  const ctx = canvas.getContext?.('2d'),
    CA = window.ColonyArt;
  if (!ctx || !CA?.vehicle) return;
  const w = canvas.width,
    h = canvas.height,
    k = h * 0.36;
  lookGround(ctx, w, h);
  CA.vehicle(ctx, w * 0.62, h * 0.84, k, { level: 12, loaded: true, fill: 0.8, dir: 1, time: 1.2, accent: '#c4b3ff', skin: id, moving: true, reduced: true });
  CA.vehicle(ctx, w * 0.22, h * 0.84, k, { level: 6, loaded: true, fill: 0.6, dir: 1, time: 1.2, accent: '#c4b3ff', skin: id, moving: true, reduced: true });
}
function previewDepot(canvas, id) {
  const ctx = canvas.getContext?.('2d'),
    CA = window.ColonyArt,
    Art = window.NebulaArt;
  if (!ctx || !CA?.depot) return;
  const w = canvas.width,
    h = canvas.height;
  lookGround(ctx, w, h);
  CA.depot(ctx, w / 2, h * 0.86, h * 0.26, { level: 30, time: 1, fill: 0.5, active: true, theme: Art?.THEMES?.crystal || { accent: '#c4b3ff' }, skin: id, reduced: true });
}
function previewDecor(canvas, id) {
  const ctx = canvas.getContext?.('2d'),
    CA = window.ColonyArt;
  if (!ctx || !CA?.decor) return;
  const w = canvas.width,
    h = canvas.height,
    planet = activePlanet().id || 'crystal';
  lookGround(ctx, w, h);
  CA.decor(ctx, id, w / 2, h * 0.86, h * 0.3, { planet, time: 1.3, reduced: true, warm: true, freed: true });
}
// ----- the shop renders these sections; the others stay as they were -----
const renderShopBeforeLooks = renderShop;
renderShop = () => {
  if (!['style', 'sets', 'chests'].includes(shopTab)) return renderShopBeforeLooks();
  renderShopBeforeLooks(); // header, tabs, dev panel (its panel content is replaced below)
  const html = shopTab === 'style' ? looksHTML() : shopTab === 'sets' ? setsHTML() : chestsHTML();
  setHTML($('shopPanel'), html);
  $('shopPanel')
    .querySelectorAll('[data-look-preview]')
    .forEach(canvas => drawLookPreview(canvas, canvas.dataset.lookPreview));
};
document.addEventListener('change', event => {
  const rarity = event.target.closest?.('[data-look-rarity]'),
    own = event.target.closest?.('[data-look-own]');
  if (!rarity && !own) return;
  if (rarity) lookView.rarity = rarity.value;
  else lookView.own = own.value;
  renderShop();
});
document.addEventListener('click', event => {
  const t = event.target;
  const cat = t.closest('[data-look-cat]');
  if (cat) {
    lookView.cat = cat.dataset.lookCat;
    feedback('tap');
    return renderShop();
  }
  // KAUFEN / SCHMIEDEN and a bundle set ask first (the dialog shows the look, its price and the balance after it)
  const buy = t.closest('[data-look-buy]');
  if (buy) return lookConfirmOpen('look', buy.dataset.lookBuy);
  const set = t.closest('[data-set-buy]');
  if (set) return lookConfirmOpen('set', set.dataset.setBuy);
  if (t.closest('#lookConfirmYes')) return lookConfirmYes();
  if (t.closest('[data-close-modal="lookConfirmModal"]')) lookBuyAsk = null;
  if (t.closest('[data-chest-open-arsenal]')) {
    while (topModal()) closeModal();
    showScreen('battle');
    render();
    return $('arsenalCard')?.scrollIntoView?.({ block: 'start' });
  }
  // forge actions inside the shop: refresh the shop after the forge handler ran
  if (t.closest('[data-forge-craft], [data-forge-equip]') && !$('shopModal')?.classList.contains('hidden')) setTimeout(() => renderShop(), 0);
});
