// P1.3 — Schiffs-Studio: the ship's cosmetics on one stage, in the style of the Kätzchen-Studio (same layout, same
// ownership list meta.cosmetics / meta.equipped, same buy and forge paths as the Looks shop: lookBuy, forgeCraft).
//   models  every ship model can be looked at (the model itself is changed in the Werft; a model not owned is a preview)
//   views   three honest 2D views instead of a fake 3D turn: Schweben (the ship at rest, its engines and modules),
//           Flug (it banks through a curve with its engine trail), Probeschuss (it fires at a practice target: the DNA
//           muzzle, the muzzle style, the affinity in flight, the impact flair and the impact look)
//   slots   Lackierung · Hüllen-Signatur · Triebwerksspur · Mündungsblitz · Trefferfunken
// A look that is not owned can be tried on (VORSCHAU); buying, forging or a free reward makes it the player's. Nothing here
// changes a value: the ship's real model, modules and weapon are drawn as they are. Loaded after shop-ui.js.
const SHIP_STUDIO_SLOTS = ['ship', 'decal', 'engine', 'muzzle', 'shot', 'impact'];
const SHIP_STUDIO_ICON = { ship: '🎨', decal: '🐾', engine: '☄', muzzle: '✴', shot: '🌠', impact: '✨' };
// short names on the five slot buttons (the full names stay in the Looks shop)
const SHIP_STUDIO_SHORT = { ship: 'Lack', decal: 'Signatur', engine: 'Triebwerk', muzzle: 'Mündung', shot: 'Geschoss', impact: 'Treffer' };
const SHIP_STUDIO_VIEWS = [
  ['hover', 'Schweben'],
  ['flight', 'Flug'],
  ['fire', 'Probeschuss']
];
const shipStudio = { model: null, view: 'hover', slot: 'ship', pick: undefined, confirm: null, raf: 0, lockUntil: 0 };
const shipStudioReduced = () => document.documentElement.classList.contains('reduce-motion');
function shipStudioItems(slot) {
  return Object.keys(Commerce.COSMETICS).filter(id => Commerce.COSMETICS[id].slot === slot);
}
const shipStudioWorn = slot => state.meta.equipped?.[slot] || null;
const shipStudioTrying = () => shipStudio.pick !== undefined && shipStudio.pick !== shipStudioWorn(shipStudio.slot);
// what the stage shows: the equipped looks with the picked one tried on in its slot
function shipStudioLooks() {
  const looks = {};
  for (const slot of SHIP_STUDIO_SLOTS) looks[slot] = shipStudioWorn(slot);
  if (shipStudio.pick !== undefined) looks[shipStudio.slot] = shipStudio.pick;
  return looks;
}
function shipStudioModelOwned(model) {
  return Boolean(state.ship.models?.[model]) || state.ship.model === model;
}
// ----- the stage -----
function drawShipStudioStage(time) {
  const canvas = $('shipStudioCanvas'),
    ctx = canvas?.getContext?.('2d'),
    Art = window.NebulaArt,
    DV = window.DnaVisuals;
  if (!ctx || !Art?.drawPlayerShip) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1),
    cw = canvas.clientWidth || 320,
    ch = canvas.clientHeight || 220;
  if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sky = ctx.createLinearGradient(0, 0, 0, ch);
  sky.addColorStop(0, '#141a4a');
  sky.addColorStop(1, '#2a2468');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, cw, ch);
  // stars drift past (they say "in flight" in the Flug view)
  const speed = shipStudio.view === 'flight' ? 60 : 8;
  ctx.fillStyle = 'rgba(232,228,250,0.7)';
  for (let i = 0; i < 24; i++) {
    const sx = (((i * 97.3) % cw) - ((time * speed * (0.4 + (i % 3) * 0.3)) % cw) + cw) % cw,
      sy = (i * 53.7) % ch;
    ctx.fillRect(sx, sy, i % 4 ? 1.2 : 2, i % 4 ? 1.2 : 2);
  }
  const looks = shipStudioLooks(),
    model = shipStudio.model || state.ship.model,
    dna = typeof mountedDna === 'function' ? mountedDna() : null,
    palette = Art.SHIP_PALETTES?.[looks.ship] || Art.SHIP_PALETTES?.default,
    gear = { ...state.ship, decal: looks.decal, dna },
    pilot = window.SpaceKittens?.ROSTER?.[0],
    engineLook = window.SpaceKittensForge?.LOOKS?.[looks.engine],
    scale = Math.min(ch * 0.62, cw * 0.36);
  let x = cw * 0.5,
    y = ch * 0.52,
    bank = 0;
  if (shipStudio.view === 'flight') {
    // a gentle S-curve: it banks into each turn
    const u = time * 0.9;
    y = ch * 0.52 + Math.sin(u) * ch * 0.16;
    bank = Math.cos(u) * 0.22;
  } else if (shipStudio.view === 'fire') x = cw * 0.34;
  else y += Math.sin(time * 1.6) * ch * 0.03;
  // P1.4: an engine look draws its own trail (scenes/cosmetic-art.js, as in the fights and the Werft)
  const trailId = looks.engine && window.CosmeticArt?.TRAILS?.[looks.engine] ? looks.engine : null;
  if (trailId) {
    const back = shipStudio.view === 'flight' ? cw * 0.42 : cw * 0.24;
    window.CosmeticArt.engineTrail(ctx, trailId, { x: x - scale * 0.6, y }, { x: x - scale * 0.6 - back, y: y - Math.sin(bank) * back * 0.6 }, scale * 0.12, time, shipStudioReduced());
  }
  // the engine trail (the engine look's colour, else the paint's)
  const trailColor = engineLook?.color || palette?.engine || '#8fe3ff',
    trailLen = shipStudio.view === 'flight' ? cw * 0.42 : cw * 0.2,
    g = ctx.createLinearGradient(x - scale * 0.6, y, x - scale * 0.6 - trailLen, y);
  g.addColorStop(0, trailColor);
  g.addColorStop(0.5, palette?.trim || '#ffffff');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.strokeStyle = g;
  ctx.lineCap = 'round';
  ctx.globalAlpha = trailId ? 0 : 0.75;
  ctx.lineWidth = scale * 0.12;
  ctx.beginPath();
  ctx.moveTo(x - scale * 0.6, y);
  if (shipStudio.view === 'flight') for (let i = 1; i <= 6; i++) ctx.lineTo(x - scale * 0.6 - (trailLen * i) / 6, y - Math.sin(time * 0.9 - i * 0.25) * ch * 0.16 + Math.sin(time * 0.9) * ch * 0.16);
  else ctx.lineTo(x - scale * 0.6 - trailLen, y);
  ctx.stroke();
  ctx.globalAlpha = 1;
  if (engineLook && !trailId)
    for (let i = 0; i < 4; i++) {
      const q = (time * 1.5 + i / 4) % 1;
      Art.glowCircle?.(ctx, x - scale * 0.6 - q * trailLen, y + (shipStudio.view === 'flight' ? 0 : Math.sin(i * 2.1) * 4), 3 + (1 - q) * 3, engineLook.color, 0.6 * (1 - q));
    }
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(bank);
  ctx.scale(scale, scale * (1 - Math.abs(bank) * 0.3));
  Art.drawPlayerShip(ctx, model, gear, time, palette, pilot, 'happy');
  ctx.restore();
  if (shipStudio.view === 'fire') drawShipStudioFire(ctx, cw, ch, x, y, scale, time, looks, dna);
}
// the practice target and one shot every 1.1 s: muzzle → flight → impact (all from the visual language)
function drawShipStudioFire(ctx, cw, ch, x, y, scale, time, looks, dna) {
  const Art = window.NebulaArt,
    DV = window.DnaVisuals,
    tx = cw * 0.84,
    ty = y;
  // the target: a practice drone ring
  ctx.strokeStyle = 'rgba(255,215,122,0.8)';
  ctx.lineWidth = 3;
  for (const r of [16, 9]) {
    ctx.beginPath();
    ctx.arc(tx, ty, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  // a ship without a DNA weapon fires its standard gun in the preview
  const look = DV?.weaponLook?.(dna || { chassis: 'repeater', affinity: 'kinetic', rarity: 'common' }),
    color = look?.color || '#8fe3ff',
    p = (time % 1.1) / 1.1,
    mx = x + scale * 0.62,
    s = scale / 40;
  if (!look) return;
  if (p < 0.18) {
    DV.drawMuzzle(ctx, mx, y, s, look, p / 0.18, 0);
    if (looks.muzzle) DV.drawMuzzleOrnament(ctx, mx, y, s, looks.muzzle, p / 0.18);
  }
  if (p >= 0.1 && p < 0.7) {
    const k = (p - 0.1) / 0.6,
      px = mx + (tx - mx) * k,
      trail = DV.AFFINITY?.[dna?.affinity]?.trail;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, s * 1.4);
    ctx.beginPath();
    ctx.moveTo(px - 14, y);
    ctx.lineTo(px, y);
    ctx.stroke();
    Art.glowCircle?.(ctx, px, y, 5, color, 0.8);
    // P1.4: the impact look's halo and the Geschoss-Spur ornament (the same drawing as in the fights)
    const halo = window.SpaceKittensForge?.LOOKS?.[looks.impact]?.color;
    if (halo) window.CosmeticArt?.shotHalo(ctx, halo, px, y, 5);
    if (looks.shot) window.CosmeticArt?.shotTrail(ctx, looks.shot, px, y, 1, 0, 4.2, time, shipStudioReduced());
    // the affinity in flight (the same four characters as in the arena)
    if (trail === 'ember') for (let i = 0; i < 2; i++) Art.glowCircle?.(ctx, px - 8 - i * 7, y + 3 + i * 2, 2, '#ffd27a', 0.8);
    else if (trail === 'drop') for (let i = 1; i <= 3; i++) Art.glowCircle?.(ctx, px - i * 6, y + Math.sin(time * 14 + i) * 3, 2.4 - i * 0.4, color, 0.7);
    else if (trail === 'arc') {
      ctx.strokeStyle = '#efe6ff';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(px, y);
      for (let i = 1; i <= 4; i++) ctx.lineTo(px - i * 6, y + (i % 2 ? 4 : -4));
      ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1;
      for (const off of [-3, 3]) {
        ctx.beginPath();
        ctx.moveTo(px - 6, y + off);
        ctx.lineTo(px - 22, y + off);
        ctx.stroke();
      }
    }
  }
  if (p >= 0.7) {
    const k = (p - 0.7) / 0.3;
    DV.drawImpactFlair(ctx, tx, ty, s, look, k);
    const impact = window.SpaceKittensForge?.LOOKS?.[looks.impact];
    if (impact) DV.drawImpactSparkles(ctx, tx, ty, s, impact.color, k, 0.6);
  }
}
function shipStudioLoop(now) {
  if ($('shipStudioModal')?.classList.contains('hidden')) {
    shipStudio.raf = 0;
    return;
  }
  drawShipStudioStage(shipStudioReduced() ? 1.3 : now / 1000);
  shipStudio.raf = shipStudioReduced() ? 0 : requestAnimationFrame(shipStudioLoop);
}
// ----- the panel -----
function shipStudioSource(id) {
  const item = Commerce.COSMETICS[id],
    src = Commerce.cosmeticSource ? Commerce.cosmeticSource(id) : null;
  if (!item || !src) return '';
  if (src.kind === 'credits') return '◈ ' + fmt(src.amount);
  if (src.kind === 'gems') return '💎 ' + fmt(src.amount);
  if (src.kind === 'forge') return '✦ ' + fmt(src.amount);
  if (src.kind === 'achievement') return '🏅 Gratis';
  if (src.kind === 'season') return 'Sternenroute';
  return 'Paket';
}
function shipStudioTile(id) {
  const item = id ? Commerce.COSMETICS[id] : null,
    worn = shipStudioWorn(shipStudio.slot) === id,
    owned = !id || state.meta.cosmetics.includes(id),
    picked = (shipStudio.pick === undefined ? shipStudioWorn(shipStudio.slot) : shipStudio.pick) === id;
  const tag = worn ? '<em class="worn">ANGELEGT</em>' : owned ? (id ? '<em class="owned">IM BESITZ</em>' : '') : `<em class="price">${shipStudioSource(id)}</em>`;
  return `<button class="studio-item${picked ? ' picked' : ''}${worn ? ' worn' : ''}${owned ? '' : ' locked'}" data-ship-pick="${id || ''}" aria-pressed="${picked}"><canvas width="128" height="80" data-ship-thumb="${id || ''}" aria-hidden="true"></canvas><b>${item ? item.icon + ' ' + item.name : 'Standard'}</b>${tag}</button>`;
}
function shipStudioActionHTML() {
  const worn = shipStudioWorn(shipStudio.slot),
    pick = shipStudio.pick === undefined ? worn : shipStudio.pick;
  if (pick === worn) return worn ? `<button class="secondary" data-ship-off="${shipStudio.slot}">ABLEGEN</button>` : '<p class="studio-hint">Tippe einen Look an, um ihn am Schiff anzuprobieren.</p>';
  if (pick === null) return `<button data-ship-off="${shipStudio.slot}">ABLEGEN</button><button class="secondary" data-ship-reset>ZURÜCK</button>`;
  const item = Commerce.COSMETICS[pick];
  if (state.meta.cosmetics.includes(pick)) return `<button data-ship-wear="${pick}">ANLEGEN</button><button class="secondary" data-ship-reset>ZURÜCK</button>`;
  const src = Commerce.cosmeticSource(pick);
  if (src.kind === 'achievement') {
    const goal = typeof WARDROBE_ACHIEVEMENTS !== 'undefined' ? WARDROBE_ACHIEVEMENTS[item.achievement] : null;
    return `<p class="studio-hint">🏅 ${goal ? goal.text : 'Ein Erfolg'} – danach gehört ${item.name} dir, kostenlos.</p>`;
  }
  if (src.kind === 'season') return '<p class="studio-hint">Aus der Sternenroute (Saison).</p>';
  if (src.kind === 'store' || src.kind === 'welcome') return '<p class="studio-hint">Ein Paket – Echtgeld ist in dieser Beta abgeschaltet.</p>';
  const have = src.kind === 'credits' ? state.credits : src.kind === 'gems' ? state.gems : state.meta.arsenal?.splitters || 0,
    sign = { credits: '◈', gems: '💎', forge: '✦' }[src.kind],
    verb = src.kind === 'forge' ? 'SCHMIEDEN' : 'KAUFEN';
  if (have < src.amount) return `<button disabled>${verb} · ${sign} ${fmt(src.amount)}</button><p class="studio-hint">Es fehlen ${sign} ${fmt(src.amount - have)}.</p>`;
  if (shipStudio.confirm === pick) return `<button class="confirm" data-ship-buy="${pick}">BESTÄTIGEN · ${sign} ${fmt(src.amount)}</button><button class="secondary" data-ship-cancel>ABBRECHEN</button>`;
  return `<button data-ship-ask="${pick}">${verb} · ${sign} ${fmt(src.amount)}</button><button class="secondary" data-ship-reset>ZURÜCK</button>`;
}
function renderShipStudio() {
  const box = $('shipStudioModal');
  if (!box || box.classList.contains('hidden')) return;
  const model = shipStudio.model || state.ship.model;
  $('shipStudioBalance').textContent = `◈ ${fmt(state.credits)} · 💎 ${fmt(state.gems)} · ✦ ${fmt(state.meta.arsenal?.splitters || 0)}`;
  setHTML(
    $('shipStudioModels'),
    Object.keys(MODEL_INFO)
      .map(m => {
        const owned = shipStudioModelOwned(m),
          role = window.DnaVisuals?.ROLE?.[m];
        return `<button class="studio-char${model === m ? ' active' : ''}${owned ? '' : ' locked'}" data-ship-model="${m}" role="tab" aria-selected="${model === m}"><i aria-hidden="true">${owned ? '🚀' : '🔒'}</i><b>${m}</b><small>${role ? role.name : ''}</small></button>`;
      })
      .join('')
  );
  setHTML($('shipStudioViews'), SHIP_STUDIO_VIEWS.map(([id, label]) => `<button class="${shipStudio.view === id ? 'active' : ''}" data-ship-view="${id}" aria-pressed="${shipStudio.view === id}">${label}</button>`).join(''));
  setHTML(
    $('shipStudioSlots'),
    SHIP_STUDIO_SLOTS.map(slot => {
      const worn = shipStudioWorn(slot);
      return `<button class="${shipStudio.slot === slot ? 'active' : ''}" data-ship-slot="${slot}" role="tab" aria-selected="${shipStudio.slot === slot}"><i aria-hidden="true">${worn ? Commerce.COSMETICS[worn].icon : SHIP_STUDIO_ICON[slot]}</i>${SHIP_STUDIO_SHORT[slot]}</button>`;
    }).join('')
  );
  setHTML($('shipStudioPanel'), [null, ...shipStudioItems(shipStudio.slot)].map(shipStudioTile).join(''));
  setHTML($('shipStudioAction'), shipStudioActionHTML());
  $('shipStudioTag').classList.toggle('hidden', !shipStudioTrying() && shipStudioModelOwned(model) && model === state.ship.model);
  $('shipStudioTag').textContent = !shipStudioModelOwned(model) ? 'VORSCHAU – Modell noch nicht im Besitz' : model !== state.ship.model ? 'VORSCHAU – Modell wechselst du in der Werft' : 'VORSCHAU – noch nicht angelegt';
  const role = window.DnaVisuals?.ROLE?.[model];
  $('shipStudioWho').textContent = window.DnaVisuals?.shipText ? window.DnaVisuals.shipText(model, state.ship, typeof mountedDna === 'function' ? mountedDna() : null) : model;
  $('shipStudioNote').textContent = role ? model + ' · ' + MODEL_INFO[model].text : '';
  // thumbnails: the ship with each look of this slot
  const Art = window.NebulaArt;
  $('shipStudioPanel')
    .querySelectorAll('[data-ship-thumb]')
    .forEach(canvas => {
      const ctx = canvas.getContext?.('2d');
      if (!ctx || !Art?.drawPlayerShip) return;
      const id = canvas.dataset.shipThumb || null,
        looks = { ...shipStudioLooks(), [shipStudio.slot]: id },
        palette = Art.SHIP_PALETTES?.[looks.ship] || Art.SHIP_PALETTES?.default;
      ctx.fillStyle = '#1d1f5c';
      ctx.fillRect(0, 0, 128, 80);
      ctx.save();
      ctx.translate(64, 42);
      ctx.scale(shipStudio.slot === 'decal' ? 70 : 52, shipStudio.slot === 'decal' ? 70 : 52);
      Art.drawPlayerShip(ctx, model, { ...state.ship, decal: looks.decal, dna: typeof mountedDna === 'function' ? mountedDna() : null }, 0.4, palette, null, 'happy');
      ctx.restore();
      if (shipStudio.slot === 'decal' && id) window.DnaVisuals?.drawDecal?.(ctx, id, 108, 18, 12);
      if (shipStudio.slot === 'muzzle' && id) window.DnaVisuals?.drawMuzzleOrnament?.(ctx, 110, 42, 2.4, id, 0.3);
      if (shipStudio.slot === 'impact' && id) window.DnaVisuals?.drawImpactSparkles?.(ctx, 108, 40, 2.6, window.SpaceKittensForge?.LOOKS?.[id]?.color, 0.25, 0.5);
      if (shipStudio.slot === 'engine' && id && !window.CosmeticArt?.engineTrail(ctx, id, { x: 34, y: 44 }, { x: 2, y: 44 }, 7, 1.3, true)) Art.glowCircle?.(ctx, 18, 42, 10, window.SpaceKittensForge?.LOOKS?.[id]?.color || '#ffffff', 0.7);
      if (shipStudio.slot === 'shot' && id) window.CosmeticArt?.shotTrail(ctx, id, 116, 42, 1, 0, 3.6, 1.3, true);
    });
  drawShipStudioStage(shipStudioReduced() ? 1.3 : performance.now() / 1000);
  if (!shipStudio.raf && !shipStudioReduced()) shipStudio.raf = requestAnimationFrame(shipStudioLoop);
}
function openShipStudio(slot = null, item = null) {
  shipStudio.model = state.ship.model;
  shipStudio.confirm = null;
  shipStudio.pick = undefined;
  if (slot && SHIP_STUDIO_SLOTS.includes(slot)) shipStudio.slot = slot;
  if (item && Commerce.COSMETICS[item] && SHIP_STUDIO_SLOTS.includes(Commerce.COSMETICS[item].slot)) {
    shipStudio.slot = Commerce.COSMETICS[item].slot;
    shipStudio.pick = item;
  }
  openModal('shipStudioModal');
  renderShipStudio();
}
function shipStudioCommit(message) {
  shipStudio.lockUntil = Date.now() + 600;
  shipStudio.pick = undefined;
  shipStudio.confirm = null;
  save();
  applyCosmetics();
  render();
  if (message) toast(message);
  renderShipStudio();
  if (!$('shopModal')?.classList.contains('hidden')) renderShop();
}
document.addEventListener('click', event => {
  const t = event.target;
  const open = t.closest('[data-ship-studio-open]');
  if (open) {
    while (topModal() && topModal() !== 'shipStudioModal') closeModal();
    return openShipStudio(open.dataset.shipStudioSlot || null, open.dataset.shipStudioItem || null);
  }
  if (!t.closest('#shipStudioModal')) return;
  // a double tap on a button that changes under the finger must not undo the first tap
  if (Date.now() < shipStudio.lockUntil && t.closest('[data-ship-wear], [data-ship-off], [data-ship-buy], [data-ship-ask]')) return;
  const model = t.closest('[data-ship-model]');
  if (model) {
    shipStudio.model = model.dataset.shipModel;
    return renderShipStudio();
  }
  const view = t.closest('[data-ship-view]');
  if (view) {
    shipStudio.view = view.dataset.shipView;
    return renderShipStudio();
  }
  const slot = t.closest('[data-ship-slot]');
  if (slot) {
    shipStudio.slot = slot.dataset.shipSlot;
    shipStudio.pick = undefined;
    shipStudio.confirm = null;
    return renderShipStudio();
  }
  const pick = t.closest('[data-ship-pick]');
  if (pick) {
    shipStudio.pick = pick.dataset.shipPick || null;
    shipStudio.confirm = null;
    feedback('open');
    return renderShipStudio();
  }
  if (t.closest('[data-ship-reset]') || t.closest('[data-ship-cancel]')) {
    shipStudio.pick = undefined;
    shipStudio.confirm = null;
    return renderShipStudio();
  }
  const wear = t.closest('[data-ship-wear]');
  if (wear) {
    const id = wear.dataset.shipWear;
    if (!state.meta.cosmetics.includes(id)) return;
    state.meta.equipped[Commerce.COSMETICS[id].slot] = id;
    feedback('chest', 'success');
    return shipStudioCommit(Commerce.COSMETICS[id].name + ' angelegt');
  }
  const off = t.closest('[data-ship-off]');
  if (off) {
    state.meta.equipped[off.dataset.shipOff] = null;
    feedback('open');
    return shipStudioCommit('Standard-Look');
  }
  const ask = t.closest('[data-ship-ask]');
  if (ask) {
    shipStudio.confirm = ask.dataset.shipAsk;
    shipStudio.lockUntil = Date.now() + 600;
    return renderShipStudio();
  }
  const buy = t.closest('[data-ship-buy]');
  if (buy) {
    const id = buy.dataset.shipBuy,
      item = Commerce.COSMETICS[id];
    const ok = item?.forge ? forgeCraft(id) : lookBuy(id) === 'bought';
    if (!ok) {
      shipStudio.confirm = null;
      toast('Das hat nicht geklappt – nichts abgebucht.');
      return renderShipStudio();
    }
    state.meta.equipped[item.slot] = id;
    feedback('chest', 'success');
    GameEvents?.emit?.('cosmetic-unlocked', { id, via: 'studio' });
    return shipStudioCommit(item.icon + ' ' + item.name + ' gehört dir und ist angelegt!');
  }
});
// the Looks shop shows its entry with the kitten studio and the album (shop-ui.js lookEntriesHTML)
