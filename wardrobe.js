// P1 Kitty Identity — the wardrobe and the Kätzchen-Studio. One cosmetic model for everything (Commerce.COSMETICS,
// account-wide ownership in meta.cosmetics): kitten pieces carry `wear` = head | suit | face | back, and each character
// (Mochi, Void, Boba, Pip) wears its own set in meta.wardrobe.chars. Owning a piece once lets every unlocked kitten wear
// it. Prices use existing currencies only (credits, gems, Sternsplitter) or a free achievement; nothing here changes
// damage, income, mining, luck, loot, research or managers. Loaded after deepcore-ui.js (voidMet), before onboarding.

const WARDROBE = {
  mochi: { name: 'Mochi', index: 0, base: () => window.SpaceKittens.ROSTER[0], open: () => true },
  void: { name: 'Void', base: () => window.SpaceKittens.VOID, open: () => typeof voidMet === 'function' && voidMet(), lock: () => 'Noch nicht getroffen' },
  boba: { name: 'Boba', index: 1, base: () => window.SpaceKittens.ROSTER[1], open: () => Boolean(state.crew[1]?.unlocked), lock: () => 'Freischaltung: ' + (state.crew[1]?.unlock || 'Crew') },
  pip: { name: 'Pip', index: 3, base: () => window.SpaceKittens.ROSTER[3], open: () => Boolean(state.crew[3]?.unlocked), lock: () => 'Freischaltung: ' + (state.crew[3]?.unlock || 'Crew') }
};
const WEAR_SLOT_NAME = { head: 'Kopf', suit: 'Kleidung', face: 'Gesicht', back: 'Rücken' };
const WEAR_SLOT_ICON = { head: '⛑', suit: '👕', face: '👓', back: '🎒' };
// free looks for play milestones (the same conditions as the badges in the Kätzchen tab), each granted once
const WARDROBE_ACHIEVEMENTS = {
  crew2: { name: 'Crewgeist', text: 'Rekrutiere 2 Crew-Mitglieder', done: () => state.crew.filter(c => c.unlocked).length >= 2 },
  expedition: { name: 'Spurensucher', text: 'Schließe eine Expedition ab', done: () => (state.expeditionsComplete || 0) >= 1 },
  // P1.3: the guardians' looks (a save that has already beaten one gets its look on the next tick)
  pips: { name: 'Inspektion bestanden', text: 'Besiege P.I.P.S., den Wächter von Orion', done: () => ['defeated', 'repaired'].includes(state.meta.guardians?.pips?.stage) },
  frostbyte: { name: 'Frostbrecher', text: 'Besiege Frostbyte, den Wächter von Glacies', done: () => ['defeated', 'repaired'].includes(state.meta.guardians?.frostbyte?.stage) },
  // P1.4: the other three guardians (granted once; a repeated fight never grants again – wardrobe.granted)
  emberbell: { name: 'Glockenruhe', text: 'Besiege Emberbell, den Wächter von Pyra', done: () => ['defeated', 'repaired'].includes(state.meta.guardians?.emberbell?.stage) },
  cogsworth: { name: 'Taktgeber', text: 'Besiege Cogsworth, den Wächter von Mekhanos', done: () => ['defeated', 'repaired'].includes(state.meta.guardians?.cogsworth?.stage) },
  petalguard: { name: 'Gartenfrieden', text: 'Besiege Petalguard, die Wächterin von Viridia', done: () => ['defeated', 'repaired'].includes(state.meta.guardians?.petalguard?.stage) }
};

const kitItem = id => (Commerce.COSMETICS[id]?.wear ? Commerce.COSMETICS[id] : null);
const wardrobeOwns = id => state.meta.cosmetics.includes(id);
function kitWear(char) {
  return state.meta.wardrobe?.chars?.[char] || null;
}
function kitWornIds(char) {
  const w = kitWear(char);
  return w ? Commerce.WEAR_SLOTS.map(slot => w[slot]).filter(Boolean) : [];
}
function kitLook(char) {
  const def = WARDROBE[char];
  return window.SpaceKittens.dressed(def.base(), kitWear(char));
}
function kitPortraitURL(char, mood = 'happy', size = 96) {
  const Kit = window.SpaceKittens;
  if (!Kit) return '';
  const def = WARDROBE[char];
  if (def.index !== undefined) return Kit.portraitURL(def.index, mood, size, kitWear(char) || null);
  return Kit.lookPortraitURL(char, kitLook(char), size, mood);
}
// put a piece on (replacing that slot); a piece the kitten already wears comes off
function wardrobeToggle(char, id) {
  const item = kitItem(id),
    w = kitWear(char);
  if (!item || !w || !wardrobeOwns(id)) return false;
  w[item.wear] = w[item.wear] === id ? null : id;
  Commerce.syncLegacyEquipped(state.meta);
  return true;
}
function wardrobeEquip(char, id) {
  const item = kitItem(id),
    w = kitWear(char);
  if (!item || !w || !wardrobeOwns(id)) return false;
  w[item.wear] = id;
  Commerce.syncLegacyEquipped(state.meta);
  return true;
}
function wardrobeTakeOff(char, slot) {
  const w = kitWear(char);
  if (!w || !(slot in w)) return false;
  w[slot] = null;
  Commerce.syncLegacyEquipped(state.meta);
  return true;
}
// how a piece is obtained: { cur: credits | gems | forge | achievement | welcome, amount, have }
function wardrobePrice(id) {
  const item = Commerce.COSMETICS[id];
  if (!item) return null;
  if (item.credits) return { cur: 'credits', amount: item.credits, have: state.credits };
  if (item.gems) return { cur: 'gems', amount: item.gems, have: state.gems };
  if (item.forge) return { cur: 'forge', amount: item.forge, have: state.meta.arsenal?.splitters || 0 };
  if (item.achievement) return { cur: 'achievement', amount: 0, have: 0, goal: WARDROBE_ACHIEVEMENTS[item.achievement] };
  return { cur: 'welcome', amount: 0, have: 0 };
}
const WEAR_PRICE_SIGN = { credits: '◈', gems: '💎', forge: '✦' };
const wearPriceText = p => (p && WEAR_PRICE_SIGN[p.cur] ? WEAR_PRICE_SIGN[p.cur] + ' ' + fmt(p.amount) : '');
/**
 * One synchronous transaction: the price and the ownership change together and the caller saves right after, so an
 * interrupted app keeps both or neither. A piece already owned is never charged again.
 * @returns {'bought'|'owned'|'poor'|'locked'|'unknown'}
 */
function wardrobeBuy(id) {
  const item = kitItem(id),
    p = item && wardrobePrice(id);
  if (!item || !p) return 'unknown';
  if (wardrobeOwns(id)) return 'owned';
  if (!WEAR_PRICE_SIGN[p.cur]) return 'locked';
  if (p.have < p.amount) return 'poor';
  if (p.cur === 'credits') state.credits -= p.amount;
  else if (p.cur === 'gems') state.gems -= p.amount;
  else state.meta.arsenal.splitters -= p.amount;
  state.meta.cosmetics.push(id);
  return 'bought';
}
// achievement looks: granted once when the milestone is reached (kept in wardrobe.granted, never taken back)
function wardrobeGrantAchievements() {
  const w = state.meta.wardrobe;
  if (!w) return [];
  const out = [];
  for (const [id, item] of Object.entries(Commerce.COSMETICS)) {
    const goal = item.achievement && WARDROBE_ACHIEVEMENTS[item.achievement];
    if (!goal || w.granted.includes(id) || !goal.done()) continue;
    w.granted.push(id);
    if (!state.meta.cosmetics.includes(id)) state.meta.cosmetics.push(id);
    out.push(id);
  }
  return out;
}

// ----- Kätzchen-Studio -----
const studio = { char: 'mochi', slot: 'suit', pose: 'idle', pick: undefined, confirm: null, raf: 0, lockUntil: 0 };
// after a purchase or a change the action bar shows a new button at the same place: a second tap of a double tap
// must not take the piece straight off again (it is ignored for a moment)
const STUDIO_TAP_LOCK = 600;
const STUDIO_POSES = [
  ['idle', 'Stehen'],
  ['walk', 'Laufen'],
  ['wave', 'Winken'],
  ['cheer', 'Jubeln'],
  ['work', 'Arbeiten']
];
const studioReduced = () => document.documentElement.classList.contains('reduce-motion');
function studioItems(slot) {
  return Object.keys(Commerce.COSMETICS).filter(id => Commerce.COSMETICS[id].wear === slot);
}
// the look on the stage: what the kitten wears, with the picked piece tried on (pick null = that slot empty)
function studioLook() {
  const w = { ...(kitWear(studio.char) || {}) };
  if (studio.pick !== undefined) w[studio.slot] = studio.pick;
  return window.SpaceKittens.dressed(WARDROBE[studio.char].base(), w);
}
const studioTrying = () => studio.pick !== undefined && studio.pick !== (kitWear(studio.char)?.[studio.slot] ?? null);
function drawStudioStage(t) {
  const canvas = $('studioCanvas'),
    ctx = canvas?.getContext?.('2d'),
    Kit = window.SpaceKittens;
  if (!ctx || !Kit) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1),
    cw = canvas.clientWidth || 300,
    ch = canvas.clientHeight || 240;
  if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cw, ch);
  // a soft floor and a spot light
  const floor = ctx.createRadialGradient(cw / 2, ch * 0.9, 4, cw / 2, ch * 0.9, cw * 0.45);
  floor.addColorStop(0, 'rgba(196,179,255,0.35)');
  floor.addColorStop(1, 'rgba(196,179,255,0)');
  ctx.fillStyle = floor;
  ctx.fillRect(0, 0, cw, ch);
  const size = Math.min(ch * 0.62, cw * 0.55),
    walk = studio.pose === 'walk';
  ctx.save();
  ctx.translate(cw / 2 + (walk && !studioReduced() ? Math.sin(t * 0.8) * cw * 0.12 : 0), ch * 0.9);
  ctx.scale(size, size);
  Kit.drawKitten(ctx, studioLook(), { pose: studio.pose, t, seed: WARDROBE[studio.char].index ?? 5, walking: walk, facing: walk && Math.cos(t * 0.8) < 0 ? -1 : 1, px: size, calm: studioReduced(), who: studio.char, tool: 'drill' });
  ctx.restore();
}
function studioLoop(now) {
  if ($('studioModal')?.classList.contains('hidden')) {
    studio.raf = 0;
    return;
  }
  drawStudioStage(studioReduced() ? 1.3 : now / 1000);
  studio.raf = studioReduced() ? 0 : requestAnimationFrame(studioLoop);
}
function studioTile(id) {
  const item = id ? Commerce.COSMETICS[id] : null,
    worn = (kitWear(studio.char)?.[studio.slot] ?? null) === id,
    owned = !id || wardrobeOwns(id),
    picked = (studio.pick === undefined ? (kitWear(studio.char)?.[studio.slot] ?? null) : studio.pick) === id,
    p = id ? wardrobePrice(id) : null;
  const state2 = worn ? '<em class="worn">ANGELEGT</em>' : owned ? (id ? '<em class="owned">IM BESITZ</em>' : '') : p.cur === 'achievement' ? `<em class="goal">🏅 ${p.goal.name}</em>` : `<em class="price">${wearPriceText(p) || 'Kapsel'}</em>`;
  return `<button class="studio-item${picked ? ' picked' : ''}${worn ? ' worn' : ''}${owned ? '' : ' locked'}" data-studio-pick="${id || ''}" aria-pressed="${picked}"><canvas width="128" height="128" data-studio-thumb="${id || ''}" aria-hidden="true"></canvas><b>${item ? item.icon + ' ' + item.name : 'Ohne'}</b>${state2}</button>`;
}
function studioActionHTML() {
  const worn = kitWear(studio.char)?.[studio.slot] ?? null,
    pick = studio.pick === undefined ? worn : studio.pick;
  if (pick === worn) return worn ? `<button class="secondary" data-studio-off="${studio.slot}">ABLEGEN</button>` : '<p class="studio-hint">Tippe ein Teil an, um es anzuprobieren.</p>';
  if (pick === null) return `<button data-studio-off="${studio.slot}">ABLEGEN</button><button class="secondary" data-studio-reset>ZURÜCK</button>`;
  const item = Commerce.COSMETICS[pick];
  if (wardrobeOwns(pick)) return `<button data-studio-wear="${pick}">ANLEGEN</button><button class="secondary" data-studio-reset>ZURÜCK</button>`;
  const p = wardrobePrice(pick);
  if (p.cur === 'achievement') return `<p class="studio-hint">🏅 Erfolg „${p.goal.name}“: ${p.goal.text}. Danach gehört ${item.name} dir – kostenlos.</p>`;
  if (!WEAR_PRICE_SIGN[p.cur]) return '<p class="studio-hint">Aus der Willkommenskapsel.</p>';
  if (p.have < p.amount) return `<button disabled>${wearPriceText(p)}</button><p class="studio-hint">Es fehlen ${WEAR_PRICE_SIGN[p.cur]} ${fmt(p.amount - p.have)}.</p>`;
  if (studio.confirm === pick) return `<button class="confirm" data-studio-buy="${pick}">BESTÄTIGEN · ${wearPriceText(p)}</button><button class="secondary" data-studio-cancel>ABBRECHEN</button>`;
  return `<button data-studio-ask="${pick}">${p.cur === 'forge' ? 'SCHMIEDEN' : 'KAUFEN'} · ${wearPriceText(p)}</button><button class="secondary" data-studio-reset>ZURÜCK</button>`;
}
function renderStudio() {
  const box = $('studioModal');
  if (!box || box.classList.contains('hidden')) return;
  if (!WARDROBE[studio.char]?.open()) studio.char = 'mochi';
  $('studioBalance').textContent = `◈ ${fmt(state.credits)} · 💎 ${fmt(state.gems)} · ✦ ${fmt(state.meta.arsenal?.splitters || 0)}`;
  setHTML(
    $('studioChars'),
    Object.entries(WARDROBE)
      .map(([id, def]) => {
        const open = def.open(),
          face = open ? kitPortraitURL(id, 'happy', 64) : '';
        // a story kitten not met yet stays a question mark (no name, no picture)
        const name = open ? def.name : id === 'void' ? '???' : def.name;
        return `<button class="studio-char${studio.char === id ? ' active' : ''}${open ? '' : ' locked'}" data-studio-char="${id}" role="tab" aria-selected="${studio.char === id}" aria-disabled="${!open}" title="${open ? '' : def.lock()}">${face ? `<img src="${face}" alt="" width="40" height="40" />` : '<i>?</i>'}<b>${name}</b>${open ? '' : '<small>🔒 gesperrt</small>'}</button>`;
      })
      .join('')
  );
  setHTML($('studioPoses'), STUDIO_POSES.map(([id, label]) => `<button class="${studio.pose === id ? 'active' : ''}" data-studio-pose="${id}" aria-pressed="${studio.pose === id}">${label}</button>`).join(''));
  setHTML(
    $('studioSlots'),
    Commerce.WEAR_SLOTS.map(slot => {
      const worn = kitWear(studio.char)?.[slot];
      return `<button class="${studio.slot === slot ? 'active' : ''}" data-studio-slot="${slot}" role="tab" aria-selected="${studio.slot === slot}"><i aria-hidden="true">${worn ? Commerce.COSMETICS[worn].icon : WEAR_SLOT_ICON[slot]}</i>${WEAR_SLOT_NAME[slot]}</button>`;
    }).join('')
  );
  setHTML($('studioPanel'), [null, ...studioItems(studio.slot)].map(studioTile).join(''));
  setHTML($('studioAction'), studioActionHTML());
  const tag = $('studioTag');
  tag.classList.toggle('hidden', !studioTrying());
  const look = WARDROBE[studio.char];
  $('studioWho').textContent = look.name; // the VORSCHAU tag says the rest
  const conflict = studio.slot !== 'head' && (studio.pick === 'outfit-pajama' || kitWear(studio.char)?.suit === 'outfit-pajama') && kitWear(studio.char)?.head;
  $('studioNote').textContent = conflict ? 'Die Schlafmütze des Mondschlafanzugs weicht dem Kopf-Accessoire.' : '';
  // thumbnails: the kitten wearing each piece (its other worn pieces stay on)
  const Kit = window.SpaceKittens;
  $('studioPanel')
    .querySelectorAll('[data-studio-thumb]')
    .forEach(canvas => {
      const ctx = canvas.getContext?.('2d');
      if (!ctx || !Kit) return;
      const id = canvas.dataset.studioThumb || null,
        w = { ...(kitWear(studio.char) || {}), [studio.slot]: id };
      ctx.clearRect(0, 0, 128, 128);
      ctx.save();
      if (studio.slot === 'head' || studio.slot === 'face') {
        ctx.translate(64, 60);
        ctx.scale(70, 70);
        Kit.drawPortrait(ctx, Kit.dressed(WARDROBE[studio.char].base(), w), { mood: 'happy', t: 1.3, seed: 2, px: 70 });
      } else {
        ctx.translate(studio.slot === 'back' ? 84 : 64, 122);
        ctx.scale(86, 86);
        Kit.drawKitten(ctx, Kit.dressed(WARDROBE[studio.char].base(), w), { pose: 'idle', t: 1.3, seed: 2, calm: true, px: 86 });
      }
      ctx.restore();
    });
  drawStudioStage(studioReduced() ? 1.3 : performance.now() / 1000);
  if (!studio.raf && !studioReduced()) studio.raf = requestAnimationFrame(studioLoop);
}
function openKittenStudio(char = 'mochi', item = null) {
  studio.char = WARDROBE[char]?.open() ? char : 'mochi';
  studio.confirm = null;
  studio.pick = undefined;
  if (item && kitItem(item)) {
    studio.slot = kitItem(item).wear;
    studio.pick = item;
  }
  openModal('studioModal');
  renderStudio();
}
function studioCommit(message) {
  studio.lockUntil = Date.now() + STUDIO_TAP_LOCK;
  save(); // on disk before the celebration
  applyCosmetics();
  render();
  if (message) toast(message);
  renderStudio();
  if (!$('shopModal')?.classList.contains('hidden')) renderShop();
}
document.addEventListener('click', event => {
  const t = event.target;
  const open = t.closest('[data-studio-open]');
  if (open) {
    while (topModal() && topModal() !== 'studioModal') closeModal();
    return openKittenStudio(open.dataset.studioOpen || 'mochi', open.dataset.studioItem || null);
  }
  if (!t.closest('#studioModal')) return;
  const char = t.closest('[data-studio-char]');
  // a locked kitten says how it is unlocked (Void only that it comes later in the story)
  if (char && !WARDROBE[char.dataset.studioChar]?.open()) return toast(char.dataset.studioChar === 'void' ? 'Diese Figur triffst du später in der Geschichte.' : WARDROBE[char.dataset.studioChar].lock());
  if (char) {
    studio.char = char.dataset.studioChar;
    studio.pick = undefined;
    studio.confirm = null;
    return renderStudio();
  }
  const pose = t.closest('[data-studio-pose]');
  if (pose) {
    studio.pose = pose.dataset.studioPose;
    return renderStudio();
  }
  const slot = t.closest('[data-studio-slot]');
  if (slot) {
    studio.slot = slot.dataset.studioSlot;
    studio.pick = undefined;
    studio.confirm = null;
    return renderStudio();
  }
  const pick = t.closest('[data-studio-pick]');
  if (pick) {
    studio.pick = pick.dataset.studioPick || null;
    studio.confirm = null;
    feedback('tap');
    return renderStudio();
  }
  if (t.closest('[data-studio-reset]') || t.closest('[data-studio-cancel]')) {
    if (t.closest('[data-studio-reset]')) studio.pick = undefined;
    studio.confirm = null;
    return renderStudio();
  }
  if (t.closest('#studioAction button') && Date.now() < studio.lockUntil) return;
  const ask = t.closest('[data-studio-ask]');
  if (ask) {
    studio.confirm = ask.dataset.studioAsk;
    return renderStudio();
  }
  const buy = t.closest('[data-studio-buy]');
  if (buy) {
    const id = buy.dataset.studioBuy,
      result = wardrobeBuy(id);
    studio.confirm = null;
    if (result === 'bought') {
      wardrobeEquip(studio.char, id);
      studio.pick = undefined;
      feedback('chest', 'success');
      GameEvents.emit('cosmetic-unlocked', { id, via: 'studio' });
      return studioCommit(Commerce.COSMETICS[id].icon + ' ' + Commerce.COSMETICS[id].name + ' gehört dir – und ist angelegt!');
    }
    if (result === 'poor') toast('Nicht genug ' + { credits: 'Credits', gems: 'Gems', forge: 'Sternsplitter' }[wardrobePrice(id).cur]);
    return renderStudio();
  }
  const wear = t.closest('[data-studio-wear]');
  if (wear && wardrobeEquip(studio.char, wear.dataset.studioWear)) {
    studio.pick = undefined;
    feedback('tap', 'success');
    return studioCommit();
  }
  const off = t.closest('[data-studio-off]');
  if (off && wardrobeTakeOff(studio.char, off.dataset.studioOff)) {
    studio.pick = undefined;
    return studioCommit();
  }
});

// ----- the shop and the forge route kitten pieces through the wardrobe (worn by Mochi unless the studio says else) -----
const forgeEquipBeforeWardrobe = forgeEquip;
forgeEquip = id => (kitItem(id) ? wardrobeToggle('mochi', id) : forgeEquipBeforeWardrobe(id));
// P1.4: the shop card shows kitten pieces itself (shop-ui.js lookCardHTML: who wears it, the studio to try it on)
// a look set with a kitten piece dresses Mochi in it (as the set always did, now through the wardrobe)
const buySetBeforeWardrobe = buySet;
buySet = id => {
  const ok = buySetBeforeWardrobe(id);
  if (ok) for (const item of LOOK_SETS.find(s => s.id === id).items) if (kitItem(item)) wardrobeEquip('mochi', item);
  return ok;
};

// ----- views: the scenes draw each kitten in what it wears -----
const colonyViewBeforeWardrobe = window.NebulaView.colony;
window.NebulaView.colony = () => ({ ...colonyViewBeforeWardrobe(), mochiAccessories: kitWornIds('mochi'), mochiWear: kitWear('mochi'), voidWear: kitWear('void'), pipWear: kitWear('pip') });
const mineViewBeforeWardrobe = window.NebulaView.mine;
window.NebulaView.mine = () => ({ ...mineViewBeforeWardrobe(), mochiWear: kitWear('mochi'), voidWear: kitWear('void') });
const combatViewBeforeWardrobe = window.NebulaView.combat;
window.NebulaView.combat = () => {
  const view = combatViewBeforeWardrobe();
  return { ...view, pilotWear: kitWear(view.pilot === 1 ? 'boba' : 'mochi') };
};
// Void's story portrait in what Void wears
if (window.StorySpeakers?.void) window.StorySpeakers.void.portrait = () => kitPortraitURL('void', 'happy', 96);

// ----- the first piece: one short hint from Mochi (skippable), then the studio; achievement looks announce themselves -----
const WARDROBE_HINT_LINE = id =>
  id === 'acc-star-helmet' ? 'Schau! Ich habe einen neuen Helm gefunden. Wollen wir ihn anprobieren?' : `Schau! ${Commerce.COSMETICS[id].name} – das ist neu! Wollen wir es anprobieren?`;
function wardrobeTick() {
  const w = state.meta?.wardrobe;
  if (!w || !state.introSeen) return;
  const granted = wardrobeGrantAchievements();
  if (granted.length) {
    // P1.4: each free look reveals itself (collection.js: a small card, skippable, never during a fight); the reason
    // is its achievement or the set it completes
    for (const id of granted) {
      const item = Commerce.COSMETICS[id],
        why = item.achievement ? '🏅 Erfolg ' + WARDROBE_ACHIEVEMENTS[item.achievement].name : item.reward ? '🎁 ' + (Commerce.COSMETIC_SETS.find(s => s.id === item.reward)?.name || 'Set') + ' komplett' : '';
      if (typeof queueCosmeticReveal === 'function') queueCosmeticReveal(id, why);
      else toast(item.icon + ' ' + item.name + ' erhalten – ' + why + '!');
    }
    requestSave(200);
  }
  // only on the colony screen and outside fights: the hint never interrupts a wave or a dialog
  if (w.hint || anyModalOpen() || storyQueue.length || !$('storyBubble')?.classList.contains('hidden') || currentScreen() !== 'home') return;
  if ((typeof campaignRunning === 'function' && campaignRunning()) || (typeof arenaActive === 'function' && arenaActive())) return;
  if (typeof onboardingActive === 'function' && onboardingActive()) return; // after the first steps, not during
  const first = state.meta.cosmetics.find(id => kitItem(id));
  if (!first) return;
  w.hint = true;
  requestSave(200);
  storyQueue.push(['mochi', WARDROBE_HINT_LINE(first), { label: 'ANPROBIEREN', run: () => openKittenStudio('mochi', kitWornIds('mochi').includes(first) ? null : first) }]);
  showNextStoryLine();
}
// story lines may carry one action button (the hint above); '›' skips it
const showStoryLineBeforeWardrobe = showNextStoryLine;
showNextStoryLine = () => {
  const action = storyQueue[0]?.[2] || null,
    button = $('storyAction');
  showStoryLineBeforeWardrobe();
  if (!button) return;
  button.classList.toggle('hidden', !action);
  button.textContent = action?.label || '';
  button.onclick = action
    ? () => {
        storyQueue.length = 0;
        $('storyBubble').classList.add('hidden');
        action.run();
      }
    : null;
};
const renderBeforeWardrobe = render;
render = () => {
  renderBeforeWardrobe();
  wardrobeTick();
};
