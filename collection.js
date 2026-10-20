// P1.4 — the collection: the Sammelalbum, the collection sets' rewards and the unlock reveal. Everything reads the one
// cosmetic registry (monetization.js COSMETICS, COSMETIC_SETS, COLLECTION_AREAS, cosmeticInfo) and the one ownership list
// (meta.cosmetics, meta.equipped, meta.wardrobe); nothing here has its own list of looks or owners.
//   Album   the player's profile (Mochi in the equipped frame), the collection progress, one page per area (the five
//           planets, the guardians, ships, kittens, colony & profile) and the sets. A look not owned yet is a dark
//           silhouette with its condition; a tap shows it large with where it comes from and what it fits.
//   Sets    a collection set is complete when every piece is owned – however each was earned. Its reward (a look,
//           never a value) is granted once (meta.wardrobe.granted, the one "given once" list) and never needed for
//           anything else.
//   Reveal  a new look that was earned for free (an achievement, a guardian, a set) or a special one (epic and up)
//           bought outside a studio shows itself on a small card at the bottom: a short reveal in its rarity colour
//           (reveal.js, skippable), its name, ANLEGEN. It never blocks: no backdrop, it waits while a fight or the first
//           steps run, and it leaves by itself after a few seconds.
// Loaded after ship-studio.js.

const album = { area: 'all', pick: null };
const ALBUM_REVEAL_MS = 8000;

// ----- set rewards (granted once, with the achievement looks in the same tick) -----
function collectionGrantSetRewards() {
  const w = state.meta.wardrobe;
  if (!w) return [];
  const out = [];
  for (const set of Commerce.COSMETIC_SETS) {
    if (!set.reward || w.granted.includes(set.reward) || !Commerce.setProgress(set, state.meta).complete) continue;
    w.granted.push(set.reward);
    if (!state.meta.cosmetics.includes(set.reward)) state.meta.cosmetics.push(set.reward);
    out.push(set.reward);
  }
  return out;
}
const grantAchievementsBeforeCollection = wardrobeGrantAchievements;
wardrobeGrantAchievements = () => {
  const granted = grantAchievementsBeforeCollection();
  // a guardian look can complete a set in the same tick (the Frostsplitter completes the Glacies set)
  return [...granted, ...collectionGrantSetRewards()];
};

// ----- the album -----
function albumIds(area) {
  const ids = Object.keys(Commerce.COSMETICS);
  if (area === 'all' || area === 'sets') return ids;
  const def = Commerce.COLLECTION_AREAS.find(a => a.id === area);
  return def ? ids.filter(id => def.has(Commerce.COSMETICS[id])) : ids;
}
function albumAreas() {
  return Commerce.COLLECTION_AREAS.filter(a => albumIds(a.id).length);
}
const albumOwned = ids => ids.filter(id => state.meta.cosmetics.includes(id)).length;
function albumBar(have, total) {
  return `<span class="album-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${have}"><i style="width:${total ? Math.round((have / total) * 100) : 0}%"></i></span>`;
}
// the condition of a look not owned yet, in one short line
function albumCondition(id) {
  const item = Commerce.COSMETICS[id],
    src = Commerce.cosmeticSource(id);
  if (src.kind === 'achievement') return '🏅 ' + (WARDROBE_ACHIEVEMENTS[src.id]?.text || 'Ein Erfolg');
  if (src.kind === 'set') return '🎁 Komplettiere: ' + (Commerce.COSMETIC_SETS.find(s => s.id === src.id)?.name || 'das Set');
  return lookSource(id, item);
}
function albumTile(id) {
  const item = Commerce.COSMETICS[id],
    owned = state.meta.cosmetics.includes(id),
    rar = Commerce.cosmeticRarity(id);
  return `<button class="album-tile rar-${rar}${owned ? ' owned' : ' locked'}${album.pick === id ? ' picked' : ''}" style="--rar:${Commerce.COSMETIC_RARITIES[rar].color}" data-album-look="${id}" aria-label="${item.name}${owned ? '' : ' (gesperrt)'}"><canvas width="128" height="80" data-album-art="${id}" aria-hidden="true"></canvas><b>${owned ? item.icon + ' ' : '🔒 '}${item.name}</b></button>`;
}
function albumDetail(id) {
  const info = Commerce.cosmeticInfo(id, state.meta),
    item = Commerce.COSMETICS[id],
    rar = Commerce.COSMETIC_RARITIES[info.rarity],
    sets = info.sets.map(s => Commerce.COSMETIC_SETS.find(x => x.id === s)).filter(Boolean),
    where = [info.world ? Commerce.COSMETIC_WORLDS[info.world] : '', info.guardian && info.guardian !== 'all' ? 'Wächter ' + Commerce.COSMETIC_GUARDIANS[info.guardian] : ''].filter(Boolean).join(' · ');
  let action = '';
  if (info.owned && item.wear) action = `<button data-studio-open="mochi" data-studio-item="${id}">IM STUDIO</button>`;
  // P1.5: a decoration is set up on the planet you are on (each planet keeps its own)
  else if (info.owned && item.slot === 'decor') action = `<button class="${info.equipped ? 'secondary' : ''}" data-album-equip="${id}">${info.equipped ? 'ABBAUEN' : 'AUF ' + (activePlanet().name || 'DIESEM PLANETEN').toUpperCase() + ' AUFSTELLEN'}</button>`;
  else if (info.owned) action = `<button class="${info.equipped ? 'secondary' : ''}" data-album-equip="${id}">${info.equipped ? 'ABLEGEN' : 'ANLEGEN'}</button>`;
  else if (lookPriceOf(id)) action = `<button data-album-shop="${id}">IM SHOP ANSEHEN · ${lookBadge(id)}</button>`;
  return `<div class="album-detail" style="--rar:${rar.color}"><canvas width="288" height="150" data-album-big="${id}" aria-hidden="true"></canvas><div><i class="look-rarity">${rar.name}</i><b>${item.icon} ${item.name}</b><small>${item.text || ''}</small><small>${info.slotName} · passt auf: ${info.fits}${where ? ' · ' + where : ''}</small>${sets.length ? `<small>Set: ${sets.map(s => s.icon + ' ' + s.name).join(', ')}</small>` : ''}${item.slot === 'decor' && info.owned ? `<small>Steht auf: ${decorPlanets(id).join(', ') || 'noch keinem Planeten'}</small>` : ''}<small class="album-how">${info.owned ? '✓ In deiner Sammlung' + (info.equipped ? ' · angelegt' : '') : albumCondition(id)}</small></div>${action}</div>`;
}
function albumSetsHTML(list = Commerce.COSMETIC_SETS) {
  return list.map(set => {
    const pr = Commerce.setProgress(set, state.meta),
      reward = set.reward ? Commerce.COSMETICS[set.reward] : null;
    return `<article class="album-set${pr.complete ? ' complete' : ''}"><b>${set.icon} ${set.name}</b><small>${set.text}</small>${albumBar(pr.have, pr.total)}<small>${pr.have} / ${pr.total} Teile${set.bundle ? ' · als Bündel im Shop (Sets)' : ''}</small><div class="album-grid">${set.items.map(albumTile).join('')}</div>${
      reward ? `<div class="album-reward${pr.rewarded ? ' got' : ''}">${albumTile(set.reward)}<small>🎁 Belohnung: ${reward.name} (${Commerce.COSMETIC_RARITIES[Commerce.cosmeticRarity(set.reward)].name})${pr.rewarded ? ' – erhalten' : ' – sobald alle Teile dir gehören'}</small></div>` : ''
    }</article>`;
  }).join('');
}
function renderCollection() {
  const box = $('collectionModal');
  if (!box || box.classList.contains('hidden')) return;
  const all = Object.keys(Commerce.COSMETICS),
    sets = Commerce.COSMETIC_SETS.filter(s => s.reward),
    setsDone = sets.filter(s => Commerce.setProgress(s, state.meta).complete).length,
    frame = state.meta.equipped.frame;
  setHTML(
    $('collectionProfile'),
    `<canvas width="112" height="112" id="collectionPortrait" aria-hidden="true"></canvas><div><b>Deine Sammlung · ${albumOwned(all)} / ${all.length}</b>${albumBar(albumOwned(all), all.length)}<small>Sets: ${setsDone} / ${sets.length} komplett · Profilrahmen: ${frame ? Commerce.COSMETICS[frame].name : 'keiner'}</small><small class="album-rarities">${Object.entries(Commerce.COSMETIC_RARITIES)
      .map(([r, def]) => {
        const ids = all.filter(id => Commerce.cosmeticRarity(id) === r);
        return ids.length ? `<span style="--rar:${def.color}">${def.name} ${albumOwned(ids)}/${ids.length}</span>` : '';
      })
      .join('')}</small></div>`
  );
  const areas = [['all', 'Alle', '✦'], ['sets', 'Sets', '🎁'], ...albumAreas().map(a => [a.id, a.name, a.icon])];
  setHTML($('collectionAreas'), areas.map(([id, name, icon]) => `<button class="${album.area === id ? 'active' : ''}" data-album-area="${id}" aria-pressed="${album.area === id}">${icon} ${name}</button>`).join(''));
  let html = '';
  if (album.area === 'sets') html = albumSetsHTML();
  else {
    const ids = albumIds(album.area).sort((a, b) => Number(state.meta.cosmetics.includes(b)) - Number(state.meta.cosmetics.includes(a)) || Commerce.COSMETIC_RARITIES[Commerce.cosmeticRarity(a)].rank - Commerce.COSMETIC_RARITIES[Commerce.cosmeticRarity(b)].rank),
      def = Commerce.COLLECTION_AREAS.find(a => a.id === album.area);
    const worldSets = Commerce.COSMETIC_SETS.filter(s => s.world && s.world === album.area);
    html = `${worldSets.length ? albumSetsHTML(worldSets) : ''}<h3 class="look-heading">${def ? def.icon + ' ' + def.name : 'Alle Looks'} · ${albumOwned(ids)} / ${ids.length}</h3>${albumBar(albumOwned(ids), ids.length)}<div class="album-grid">${ids.map(albumTile).join('')}</div>`;
  }
  setHTML($('collectionPanel'), (album.pick && Commerce.COSMETICS[album.pick] ? albumDetail(album.pick) : '') + html);
  drawCollectionArt();
}
function drawCollectionArt() {
  const box = $('collectionModal');
  box.querySelectorAll('[data-album-art]').forEach(canvas => {
    const id = canvas.dataset.albumArt;
    drawLookPreview(canvas, id);
    // a look not owned yet is a silhouette: its shape shows, its colours wait
    if (!state.meta.cosmetics.includes(id)) {
      const ctx = canvas.getContext?.('2d');
      if (!ctx) return;
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(16,14,40,0.72)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
  });
  box.querySelectorAll('[data-album-big]').forEach(canvas => drawLookPreview(canvas, canvas.dataset.albumBig));
  drawProfilePortrait($('collectionPortrait'), performance.now() / 1000);
}
// Mochi in what Mochi wears, in the equipped profile frame (shop-ui.js drawFramedPortrait: the same drawing as the shop)
function drawProfilePortrait(canvas, t, frameId = state.meta.equipped.frame) {
  const ctx = canvas?.getContext?.('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawFramedPortrait(ctx, canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) * 0.36, frameId, t);
}
let albumRaf = 0;
function albumLoop(now) {
  if ($('collectionModal')?.classList.contains('hidden') || document.documentElement.classList.contains('reduce-motion')) {
    albumRaf = 0;
    return;
  }
  drawProfilePortrait($('collectionPortrait'), now / 1000);
  albumRaf = requestAnimationFrame(albumLoop);
}
function openCollection(area = null) {
  if (area) album.area = area;
  album.pick = null;
  openModal('collectionModal');
  renderCollection();
  if (!albumRaf && !document.documentElement.classList.contains('reduce-motion')) albumRaf = requestAnimationFrame(albumLoop);
}
document.addEventListener('click', event => {
  const t = event.target;
  const open = t.closest('[data-collection-open]');
  if (open) {
    while (topModal() && topModal() !== 'shopModal') closeModal();
    return openCollection(open.dataset.collectionOpen ? 'sets' : null);
  }
  if (t.closest('[data-menu="collection"]')) return openCollection();
  if (!t.closest('#collectionModal')) return;
  const area = t.closest('[data-album-area]');
  if (area) {
    album.area = area.dataset.albumArea;
    album.pick = null;
    feedback('tap');
    return renderCollection();
  }
  const look = t.closest('[data-album-look]');
  if (look) {
    album.pick = album.pick === look.dataset.albumLook ? null : look.dataset.albumLook;
    feedback('tap');
    renderCollection();
    return $('collectionPanel')?.scrollTo?.({ top: 0 });
  }
  const equip = t.closest('[data-album-equip]');
  if (equip) {
    const id = equip.dataset.albumEquip,
      item = Commerce.COSMETICS[id];
    if (!item || !state.meta.cosmetics.includes(id)) return;
    state.meta.equipped[item.slot] = state.meta.equipped[item.slot] === id ? null : id;
    save();
    applyCosmetics();
    feedback('tap', 'success');
    render();
    return renderCollection();
  }
  const shop = t.closest('[data-album-shop]');
  if (shop) {
    const id = shop.dataset.albumShop;
    lookView.cat = Commerce.cosmeticDomain(id)?.id || 'all';
    lookView.own = 'all';
    lookView.rarity = 'all';
    while (topModal()) closeModal();
    openShop('style');
    return document.querySelector('#shopPanel [data-look-card="' + id + '"]')?.scrollIntoView?.({ block: 'center' });
  }
});
// the "Mehr" menu gets the album (with the collection count)
const menuEntriesBeforeCollection = menuEntries;
menuEntries = () => {
  const list = menuEntriesBeforeCollection(),
    all = Object.keys(Commerce.COSMETICS),
    at = list.findIndex(e => e.id === 'looks') + 1;
  list.splice(at, 0, { id: 'collection', icon: '📖', title: 'Sammlung', text: albumOwned(all) + ' / ' + all.length + ' Looks · Sets · Profilrahmen' });
  return list;
};

// ----- the unlock reveal -----
const revealQueue = [];
let revealTimer = 0;
// the new look shows only on the colony screen with no dialog open; it waits while a fight, the first steps or the story
// run (and goes back into the queue if the player leaves the colony while it shows)
function revealBlocked() {
  return (
    !state.introSeen ||
    (typeof currentScreen === 'function' && currentScreen() !== 'home') ||
    anyModalOpen() ||
    (typeof arenaActive === 'function' && arenaActive()) ||
    (typeof campaignRunning === 'function' && campaignRunning()) ||
    (typeof onboardingActive === 'function' && onboardingActive())
  );
}
function queueCosmeticReveal(id, why) {
  if (!Commerce.COSMETICS[id] || revealQueue.some(r => r.id === id)) return;
  revealQueue.push({ id, why });
  showNextReveal();
}
function showNextReveal() {
  const card = $('cosmeticReveal');
  if (!card || !card.classList.contains('hidden') || !revealQueue.length || revealBlocked()) return;
  const { id, why } = revealQueue.shift(),
    item = Commerce.COSMETICS[id],
    rar = Commerce.cosmeticRarity(id),
    def = Commerce.COSMETIC_RARITIES[rar];
  card.dataset.look = id;
  card.style.setProperty('--rar', def.color);
  $('cosmeticRevealKind').textContent = 'NEU · ' + def.name.toUpperCase();
  $('cosmeticRevealName').textContent = item.icon + ' ' + item.name;
  $('cosmeticRevealWhy').textContent = why || '';
  const owned = state.meta.cosmetics.includes(id),
    on = item.wear ? Object.values(state.meta.wardrobe?.chars || {}).some(c => c?.[item.wear] === id) : state.meta.equipped[item.slot] === id;
  $('cosmeticRevealWear').classList.toggle('hidden', !owned || on);
  card.classList.remove('hidden');
  drawLookPreview($('cosmeticRevealArt'), id);
  if (typeof playReveal === 'function') playReveal($('cosmeticRevealStage'), { rarity: rar, label: 'Neuer Look …' });
  feedback('chest', 'success');
  clearTimeout(revealTimer);
  revealTimer = setTimeout(hideReveal, ALBUM_REVEAL_MS);
}
function hideReveal() {
  clearTimeout(revealTimer);
  $('cosmeticReveal')?.classList.add('hidden');
  setTimeout(showNextReveal, 300);
}
document.addEventListener('click', event => {
  if (event.target.closest('#cosmeticRevealClose')) return hideReveal();
  if (!event.target.closest('#cosmeticRevealWear')) return;
  const id = $('cosmeticReveal').dataset.look,
    item = Commerce.COSMETICS[id];
  if (!item || !state.meta.cosmetics.includes(id)) return hideReveal();
  if (item.wear) wardrobeEquip('mochi', id);
  else state.meta.equipped[item.slot] = id;
  save();
  applyCosmetics();
  render();
  toast(item.icon + ' ' + item.name + ' angelegt');
  hideReveal();
});
// a special look bought or forged outside a studio (the studio stage already shows it) reveals itself too
GameEvents.on('cosmetic-unlocked', event => {
  if (event.via === 'studio') return;
  if ((Commerce.COSMETIC_RARITIES[Commerce.cosmeticRarity(event.id)]?.rank || 0) >= 2) queueCosmeticReveal(event.id, 'Gehört jetzt dir');
});
const renderBeforeCollection = render;
render = () => {
  renderBeforeCollection();
  const card = $('cosmeticReveal');
  if (card && !card.classList.contains('hidden') && revealBlocked()) {
    revealQueue.unshift({ id: card.dataset.look, why: $('cosmeticRevealWhy').textContent });
    clearTimeout(revealTimer);
    card.classList.add('hidden');
  }
  if (revealQueue.length) showNextReveal();
};

// ----- P1.5: the planet decoration, saved per world -----
// meta.decor[planet] is the decoration standing on that planet; equipped.decor is the one of the planet you are on, so
// every equip path (album, shop, forge) works unchanged: whatever is put on or taken off lands on the viewed planet.
// decorAt remembers which planet equipped.decor belongs to – after a planet change it loads that planet's decoration.
function decorSync() {
  const m = state.meta;
  if (!m || !m.equipped) return;
  if (!m.decor || typeof m.decor !== 'object' || Array.isArray(m.decor)) m.decor = {};
  const cur = state.activePlanet;
  if (m.decorAt !== cur) {
    m.equipped.decor = m.decor[cur] || null;
    m.decorAt = cur;
    return;
  }
  const id = m.equipped.decor;
  if (id && m.cosmetics.includes(id) && Commerce.COSMETICS[id]?.slot === 'decor') m.decor[cur] = id;
  else {
    m.equipped.decor = null;
    delete m.decor[cur];
  }
}
// the planets a decoration stands on (the album says it)
function decorPlanets(id) {
  return Object.entries(state.meta.decor || {})
    .filter(([, d]) => d === id)
    .map(([p]) => (typeof PLANETS !== 'undefined' && PLANETS[Number(p)]?.name) || 'Planet ' + p);
}
{
  const renderBeforeDecor = render;
  render = function (...args) {
    decorSync();
    return renderBeforeDecor.apply(this, args);
  };
  const saveBeforeDecor = save;
  save = function (...args) {
    decorSync();
    return saveBeforeDecor.apply(this, args);
  };
  decorSync();
}
// a tap on a decoration in the colony opens it in the album
if (typeof colonyActions === 'object')
  colonyActions.openLook = id => {
    openCollection();
    album.pick = Commerce.COSMETICS[id] ? id : null;
    renderCollection();
  };
