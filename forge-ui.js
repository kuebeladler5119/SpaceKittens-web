// Beta 1.2 — Sternenschmiede (K90): an optional, purely visual use for Sternsplitter. Forge cosmetics live in the same
// catalog and ownership list as every other cosmetic (Commerce.COSMETICS with `forge` = price in ✦, meta.cosmetics,
// meta.equipped), so a later direct sale, bundle or season reward reuses one model and nobody owns anything twice.
// Crafting never touches combat, income or drops: the only effects are what the scenes draw. Loaded after arsenal-ui.js.

const FORGE_SLOT_NAME = { glider: 'Tikkis Gleiter', impact: 'Trefferfunken', engine: 'Triebwerksspur', ship: 'Schiffslack', outfit: 'Kätzchen-Outfit', colony: 'Kolonie-Deko', mine: 'Minen-Look' };
// colours the preview and the combat scene share (scenes read them from window.SpaceKittensForge)
const FORGE_LOOKS = {
  'glider-midnight': { body: ['#1c2258', '#3a4a9a'], trim: '#ffd77a', glow: '#9fb8ff', dots: '#fff1b8' },
  'glider-blossom': { body: ['#c4567e', '#f29ab9'], trim: '#fff0f6', glow: '#ffc4dc', dots: '#ffffff' },
  'impact-gold': { color: '#ffd76a', core: '#fff6d6' },
  'impact-aurora': { color: '#7af0e0', core: '#e8d6ff' },
  'impact-frost': { color: '#bff4ff', core: '#ffffff' },
  'engine-comet': { color: '#bfe6ff', core: '#ffffff' },
  // P1.4 (shapes: scenes/cosmetic-art.js)
  'engine-crystal': { color: '#9fe8ff', core: '#ffffff' },
  'engine-clockwork': { color: '#ffd77a', core: '#fff3c4' }
};
window.SpaceKittensForge = { LOOKS: FORGE_LOOKS };

function forgeItems() {
  return Object.entries(Commerce.COSMETICS)
    .filter(([, c]) => c.forge)
    .map(([id, c]) => ({ id, ...c }));
}
function forgeOwned(id) {
  return state.meta.cosmetics.includes(id);
}
// One synchronous transaction: price and ownership together, saved right after (an interrupted app keeps either both
// or neither). Owning it already → nothing happens (no second charge, no duplicate).
function forgeCraft(id) {
  const item = Commerce.COSMETICS[id];
  if (!item?.forge || forgeOwned(id) || !state.meta.arsenal || state.meta.arsenal.splitters < item.forge) return false;
  state.meta.arsenal.splitters -= item.forge;
  state.meta.cosmetics.push(id);
  return true;
}
function forgeEquip(id) {
  const item = Commerce.COSMETICS[id];
  if (!item || !forgeOwned(id)) return false;
  state.meta.equipped[item.slot] = state.meta.equipped[item.slot] === id ? null : id;
  return true;
}

// ----- previews: a small canvas per item, drawn with the game's own art (no images) -----
function forgePreview(canvas, id) {
  const ctx = canvas.getContext?.('2d'),
    Art = window.NebulaArt;
  if (!ctx || !Art) return;
  const item = Commerce.COSMETICS[id],
    look = FORGE_LOOKS[id],
    w = canvas.width,
    h = canvas.height;
  // P1.5: looks with a preview on the real object (a building, a vehicle, a decoration, a shot) use the shop's one
  if (['stall', 'shot', 'vehicle', 'depot', 'decor'].includes(item?.slot) && typeof drawLookPreview === 'function') return drawLookPreview(canvas, id);
  ctx.clearRect(0, 0, w, h);
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#1d1f5c');
  bg.addColorStop(1, '#121437');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  if (item.slot === 'ship' || item.slot === 'engine') {
    if (item.slot === 'engine')
      for (let i = 0; i < 9; i++) {
        ctx.globalAlpha = 0.85 - i * 0.09;
        ctx.fillStyle = i % 2 ? look.color : look.core;
        ctx.beginPath();
        ctx.arc(w * 0.36 - i * 7, h * 0.56 + Math.sin(i) * 2, 3.2 - i * 0.25, 0, Math.PI * 2);
        ctx.fill();
      }
    ctx.globalAlpha = 1;
    ctx.translate(w * 0.58, h * 0.52);
    ctx.scale(h * 0.9, h * 0.9);
    Art.drawPlayerShip(ctx, state.ship.model, state.ship, 0.4, Art.SHIP_PALETTES[item.slot === 'ship' ? id : state.meta.equipped.ship] || Art.SHIP_PALETTES.default, null, 'happy');
  } else if (item.slot === 'outfit' && window.SpaceKittens) {
    // Beta 1.3: Mochi wearing the outfit, drawn with the game's own kitten rig
    const Kit = window.SpaceKittens;
    ctx.translate(w / 2, h * 0.47);
    ctx.scale(h * 0.56, h * 0.56);
    Kit.drawKitten(ctx, Kit.withAccessories(Kit.ROSTER[0], [id]), { pose: 'idle', t: 1.3, seed: 1, mood: 'happy' });
  } else if (item.slot === 'colony') {
    // a lantern chain over a strip of ground
    ctx.fillStyle = '#2c2a63';
    ctx.fillRect(0, h * 0.78, w, h * 0.22);
    ctx.strokeStyle = 'rgba(200,190,255,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 4) ctx.lineTo(x, h * 0.25 + Math.sin((x / w) * Math.PI) * h * 0.18);
    ctx.stroke();
    ['#ff9ecb', '#ffd77a', '#8ff0d4', '#c4b3ff', '#ff9ecb'].forEach((c, i) => {
      const x = (w * (i + 1)) / 6,
        y = h * 0.25 + Math.sin((x / w) * Math.PI) * h * 0.18 + 8;
      Art.glowCircle(ctx, x, y, 14, c, 0.6);
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.ellipse(x, y, 5, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (item.slot === 'mine') {
    // a tunnel section with two crystal lamps
    ctx.fillStyle = '#3a3366';
    ctx.fillRect(0, 0, w, h * 0.16);
    ctx.fillRect(0, h * 0.84, w, h * 0.16);
    [[0.32, '#ff9ecb'], [0.68, '#8fe3ff']].forEach(([u, c]) => {
      const x = w * u,
        y = h * 0.48;
      ctx.strokeStyle = '#1d1a3a';
      ctx.beginPath();
      ctx.moveTo(x, h * 0.16);
      ctx.lineTo(x, y - 10);
      ctx.stroke();
      Art.glowCircle(ctx, x, y, 26, c, 0.6);
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(x, y - 11);
      ctx.lineTo(x + 7, y);
      ctx.lineTo(x, y + 14);
      ctx.lineTo(x - 7, y);
      ctx.closePath();
      ctx.fill();
    });
  } else if (item.slot === 'glider') {
    ctx.translate(w / 2, h * 0.55);
    ctx.scale(h * 0.42, h * 0.42);
    forgeDrawGliderBody(ctx, look);
  } else if (item.slot === 'impact') {
    for (const [r, a] of [[h * 0.42, 0.35], [h * 0.28, 0.7], [h * 0.12, 1]]) {
      ctx.globalAlpha = a;
      ctx.strokeStyle = r < h * 0.2 ? look.core : look.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(w * 0.62, h / 2, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = look.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w * 0.08, h / 2);
    ctx.lineTo(w * 0.5, h / 2);
    ctx.stroke();
  }
  ctx.restore();
}
// the glider hull in a forge colour (shared with scenes/combat-scene.js through SpaceKittensForge.drawGliderBody)
function forgeDrawGliderBody(ctx, look) {
  ctx.fillStyle = look.body[0];
  ctx.beginPath();
  ctx.ellipse(-0.05, 0.16, 0.98, 0.36, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = look.body[1];
  ctx.beginPath();
  ctx.ellipse(-0.05, 0.1, 0.94, 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = look.trim;
  ctx.lineWidth = 0.06;
  ctx.stroke();
  ctx.fillStyle = look.dots;
  for (const [x, y] of [[-0.6, 0.1], [-0.25, 0.22], [0.15, 0.05], [0.45, 0.2]]) {
    ctx.beginPath();
    ctx.arc(x, y, 0.045, 0, Math.PI * 2);
    ctx.fill();
  }
}
window.SpaceKittensForge.drawGliderBody = forgeDrawGliderBody;

// ----- dialog -----
function renderForgeModal() {
  const box = $('forgePanel');
  if (!box) return;
  const splitters = state.meta.arsenal?.splitters || 0,
    items = forgeItems(),
    owned = items.filter(item => forgeOwned(item.id)).length;
  $('forgeBalance').textContent = '✦ ' + fmt(splitters) + ' Sternsplitter · ' + owned + ' / ' + items.length + ' geschmiedet';
  setHTML(
    box,
    items
      .map(item => {
        const have = forgeOwned(item.id),
          on = state.meta.equipped[item.slot] === item.id,
          locked = item.slot === 'glider' && !catUnlocked();
        const action = have
          ? `<button class="${on ? 'secondary' : ''}" data-forge-equip="${item.id}">${on ? 'ABLEGEN' : 'ANLEGEN'}</button>`
          : `<button data-forge-craft="${item.id}" ${splitters >= item.forge ? '' : 'disabled'}>SCHMIEDEN · ✦ ${item.forge}</button>`;
        return `<article class="forge-item${have ? ' owned' : ''}${on ? ' equipped' : ''}"><canvas class="forge-preview" width="168" height="84" data-forge-preview="${item.id}" aria-hidden="true"></canvas><div><b>${item.icon} ${item.name}</b><small>${FORGE_SLOT_NAME[item.slot]} · ${item.text}${locked ? ' (sichtbar, sobald Tikki mitfliegt)' : ''}</small>${have ? `<em>${on ? 'ANGELEGT' : 'GESCHMIEDET'}</em>` : ''}</div>${action}</article>`;
      })
      .join('')
  );
  box.querySelectorAll('[data-forge-preview]').forEach(canvas => forgePreview(canvas, canvas.dataset.forgePreview));
}
function openForge() {
  renderForgeModal();
  openModal('forgeModal');
}
document.addEventListener('click', event => {
  if (event.target.closest('[data-forge-open]')) return openForge();
  const craft = event.target.closest('[data-forge-craft]');
  if (craft) {
    const id = craft.dataset.forgeCraft;
    if (!forgeCraft(id)) return toast('Nicht genug Sternsplitter');
    forgeEquip(id); // a fresh craft is put on right away (one tap to take it off again)
    save(); // the transaction is on disk before the celebration
    applyCosmetics();
    feedback('chest', 'success');
    GameEvents.emit('cosmetic-unlocked', { id });
    toast(Commerce.COSMETICS[id].icon + ' ' + Commerce.COSMETICS[id].name + ' geschmiedet und angelegt!');
    renderForgeModal();
    return render();
  }
  const equip = event.target.closest('[data-forge-equip]');
  if (equip && forgeEquip(equip.dataset.forgeEquip)) {
    save();
    applyCosmetics();
    renderForgeModal();
    render();
  }
});

// the combat scene reads the equipped looks from its view model
const combatViewBeforeForge = window.NebulaView.combat;
window.NebulaView.combat = () => {
  const view = combatViewBeforeForge(),
    eq = state.meta?.equipped || {};
  return { ...view, cosmeticGlider: eq.glider || null, cosmeticImpact: eq.impact || null, cosmeticEngine: eq.engine || null, cosmeticMuzzle: eq.muzzle || null, cosmeticShot: eq.shot || null };
};

// A short glow pulse on something new (a forged look, a fused item); static glow with reduced motion.
function celebrateElement(element) {
  if (!element) return;
  element.classList.remove('celebrate');
  void element.offsetWidth;
  element.classList.add('celebrate');
  setTimeout(() => element.classList.remove('celebrate'), 1200);
}
// deferred: the dialog is redrawn right after the event
GameEvents.on('cosmetic-unlocked', event => setTimeout(() => celebrateElement(document.querySelector(`#forgePanel [data-forge-preview="${event.id}"]`)?.closest('.forge-item')), 0));
GameEvents.on('arsenal-fusion', () => setTimeout(() => celebrateElement(document.querySelector('#arsenalPanel .arsenal-detail')), 0));
