// Beta 1.3 — shop sections: KOMFORT (boosts, unchanged) · LOOKS · SETS · KISTEN · ECHTGELD (the store offers,
// unchanged — and unavailable in release builds). Everything here is earned by playing:
//   LOOKS  every cosmetic by category (Outfits, Schiff, Kolonie, Mine, Manager) with a real preview drawn by the game's
//          own art, its owner state and where it comes from; forge looks are crafted with Sternsplitter right here.
//   SETS   themed bundles of forge looks for 80 % of the missing pieces' Sternsplitter (owned pieces are never charged).
//   KISTEN the Arsenal's chests with their real drop odds and sources — opened in the Arsenal. There are no paid
//          random chests (docs/MONETIZATION.md "no paid randomness"; docs/beta-1-3/MONETIZATION_PLAN.md).
// One ownership list (meta.cosmetics / meta.equipped) for all of it. Loaded after forge-ui.js.

const LOOK_CATEGORIES = [
  { id: 'outfit', name: 'Outfits', slots: ['outfit', 'mochi'] },
  { id: 'ship', name: 'Schiff', slots: ['ship', 'engine', 'impact', 'glider', 'ring', 'trail'] },
  { id: 'colony', name: 'Kolonie', slots: ['colony'] },
  { id: 'mine', name: 'Mine', slots: ['mine'] },
  { id: 'manager', name: 'Manager', slots: ['manager'] }
];
const LOOK_SLOT_NAME = { ...FORGE_SLOT_NAME, ring: 'Planetenring', trail: 'Drohnenspur', mochi: 'Mochi-Accessoire' };
const LOOK_SETS = [
  { id: 'set-sakura', name: 'Kirschblüten-Set', icon: '🌸', items: ['ship-sakura', 'outfit-rose', 'glider-blossom'], text: 'Schiff, Mochi und Tikkis Gleiter in Kirschblüte' },
  { id: 'set-miner', name: 'Grubenlicht-Set', icon: '💎', items: ['mine-crystal-lamps', 'outfit-explorer', 'deco-lanterns'], text: 'Kristalllampen in der Mine, Laternen über der Kolonie, Mochi im Forscher-Overall' }
];
const SET_DISCOUNT = 0.8;

function lookSource(id, item) {
  if (item.forge) return 'Sternenschmiede · ✦ ' + item.forge;
  if (Commerce.WELCOME_POOL.includes(id)) return 'Willkommenskapsel';
  if (Commerce.SEASON_THEMES?.some(t => t.cosmetics.includes(id))) return 'Sternenroute (Saison)';
  return 'Paket – Echtgeld ist in dieser Beta abgeschaltet';
}
function lookCardHTML(id) {
  const item = Commerce.COSMETICS[id],
    owned = state.meta.cosmetics.includes(id),
    on = state.meta.equipped[item.slot] === id,
    splitters = state.meta.arsenal?.splitters || 0;
  const action = owned
    ? `<button class="${on ? 'secondary' : ''}" data-equip="${id}">${on ? 'ABLEGEN' : 'ANLEGEN'}</button>`
    : item.forge
      ? `<button data-forge-craft="${id}" ${splitters >= item.forge ? '' : 'disabled'}>SCHMIEDEN · ✦ ${item.forge}</button>`
      : `<small class="look-source">${lookSource(id, item)}</small>`;
  return `<article class="forge-item look-item${owned ? ' owned' : ''}${on ? ' equipped' : ''}"><canvas class="forge-preview" width="168" height="84" data-look-preview="${id}" aria-hidden="true"></canvas><div><b>${item.icon} ${item.name}</b><small>${LOOK_SLOT_NAME[item.slot] || ''}${item.text ? ' · ' + item.text : ''}</small>${owned ? `<em>${on ? 'ANGELEGT' : 'IM BESITZ'}</em>` : ''}</div>${action}</article>`;
}
function looksHTML() {
  const ids = Object.keys(Commerce.COSMETICS),
    owned = ids.filter(id => state.meta.cosmetics.includes(id)).length;
  return (
    `<p class="shop-note">Looks ändern nur das Aussehen – nie Schaden, Einkommen oder Beute. ${owned} / ${ids.length} im Besitz · ✦ ${fmt(state.meta.arsenal?.splitters || 0)} Sternsplitter.</p>` +
    LOOK_CATEGORIES.map(cat => {
      const list = ids.filter(id => cat.slots.includes(Commerce.COSMETICS[id].slot)).sort((a, b) => cat.slots.indexOf(Commerce.COSMETICS[a].slot) - cat.slots.indexOf(Commerce.COSMETICS[b].slot));
      return `<h3 class="look-heading">${cat.name}</h3>${list.length ? list.map(lookCardHTML).join('') : '<p class="shop-note">Noch keine Looks in dieser Kategorie – geplant für ein späteres Update.</p>'}`;
    }).join('')
  );
}
function setPrice(set) {
  const missing = set.items.filter(id => !state.meta.cosmetics.includes(id));
  return { missing, price: Math.floor(missing.reduce((s, id) => s + (Commerce.COSMETICS[id].forge || 0), 0) * SET_DISCOUNT) };
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
  return (
    '<p class="shop-note">Sets bündeln Looks für 80 % der Sternsplitter – Teile, die dir schon gehören, kosten nichts.</p>' +
    LOOK_SETS.map(set => {
      const { missing, price } = setPrice(set),
        full = set.items.reduce((s, id) => s + Commerce.COSMETICS[id].forge, 0);
      return `<article class="shop-item look-set"><div><b>${set.icon} ${set.name}</b><small>${set.text}</small><div class="set-pieces">${set.items.map(id => `<span class="${state.meta.cosmetics.includes(id) ? 'have' : ''}">${Commerce.COSMETICS[id].icon} ${Commerce.COSMETICS[id].name}</span>`).join('')}</div></div><div class="shop-buttons">${
        missing.length ? `<button data-set-buy="${set.id}" ${splitters >= price ? '' : 'disabled'}>✦ ${price}${missing.length < set.items.length ? '' : ` <s>${full}</s>`}</button>` : '<button disabled>KOMPLETT</button>'
      }</div></article>`;
    }).join('')
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
document.addEventListener('click', event => {
  const set = event.target.closest('[data-set-buy]');
  if (set) {
    if (!buySet(set.dataset.setBuy)) return toast('Nicht genug Sternsplitter');
    save();
    applyCosmetics();
    feedback('chest', 'success');
    toast(LOOK_SETS.find(s => s.id === set.dataset.setBuy).name + ' geschmiedet und angelegt!');
    renderShop();
    return render();
  }
  if (event.target.closest('[data-chest-open-arsenal]')) {
    while (topModal()) closeModal();
    showScreen('battle');
    render();
    return $('arsenalCard')?.scrollIntoView?.({ block: 'start' });
  }
  // forge actions inside the shop: refresh the shop after the forge handler ran
  if (event.target.closest('[data-forge-craft], [data-forge-equip]') && !$('shopModal')?.classList.contains('hidden')) setTimeout(() => renderShop(), 0);
});
