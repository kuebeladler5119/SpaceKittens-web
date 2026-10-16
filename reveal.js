// Beta 1.4 M5/M6 — one reveal for everything that is opened: talent capsules, chests, DNA weapons. Purely visual:
// every result is granted and saved *before* its reveal starts (the callers keep that order), so closing the app, a
// reload or a skip mid-animation can neither lose nor repeat anything. Phases: charge (the capsule/chest shakes) →
// burst (a light in the rarity colour) → show (the result). A tap on the stage or "Überspringen" jumps to the result;
// with reduced motion the result is shown at once. Loaded after arena-ui.js.

const REVEAL_MS = { charge: 650, burst: 420 };
const REVEAL_RARITY_COLOR = { common: '#c9c3ee', uncommon: '#8ff0d4', rare: '#8fe3ff', epic: '#c4a3ff', legendary: '#ffd77a', mythic: '#ff9ecb', celestial: '#fff6c8' };
const revealTimers = new WeakMap();
function revealReduced() {
  return document.body.classList.contains('reduce-motion') || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
function revealFinish(stage) {
  (revealTimers.get(stage) || []).forEach(clearTimeout);
  revealTimers.delete(stage);
  stage.classList.remove('rv-charge', 'rv-burst');
  stage.classList.add('rv-show');
  stage.querySelector('.rv-skip')?.remove();
}
// Plays the reveal on a stage element whose final content is already in place.
function playReveal(stage, { rarity = 'common', label = 'Öffnet …' } = {}) {
  if (!stage) return;
  (revealTimers.get(stage) || []).forEach(clearTimeout);
  stage.classList.remove('rv-charge', 'rv-burst', 'rv-show');
  stage.classList.add('rv-play');
  stage.style.setProperty('--rv-color', REVEAL_RARITY_COLOR[rarity] || REVEAL_RARITY_COLOR.common);
  if (revealReduced()) return revealFinish(stage);
  stage.classList.add('rv-charge');
  if (!stage.querySelector('.rv-skip')) stage.insertAdjacentHTML('beforeend', `<button class="rv-skip" type="button" aria-label="Überspringen">Überspringen ›</button><span class="rv-label" aria-hidden="true">${label}</span>`);
  const t1 = setTimeout(() => {
      stage.classList.remove('rv-charge');
      stage.classList.add('rv-burst');
    }, REVEAL_MS.charge),
    t2 = setTimeout(() => revealFinish(stage), REVEAL_MS.charge + REVEAL_MS.burst);
  revealTimers.set(stage, [t1, t2]);
}
document.addEventListener('click', event => {
  const stage = event.target.closest('.rv-play:not(.rv-show)');
  if (!stage) return;
  event.preventDefault();
  revealFinish(stage);
});

// Chests (Arsenal): the revealed chest plays before its card shows.
const renderChestModalBeforeReveal = renderChestModal;
renderChestModal = result => {
  renderChestModalBeforeReveal(result);
  const stage = $('chestStage');
  if (!stage) return;
  if (result) playReveal(stage, { rarity: ARSENAL_BY_ID[result.id]?.rarity, label: 'Kiste öffnet …' });
  else stage.classList.remove('rv-play', 'rv-charge', 'rv-burst', 'rv-show');
};
// Talent capsules (Managerbüro): the capsule glows, then the specialist appears; duplicates name their progress.
const showTalentResultBeforeReveal = showTalentResult;
showTalentResult = (kicker, title, id, text) => {
  showTalentResultBeforeReveal(kicker, title, id, text);
  const art = $('talentArt'),
    entry = state.meta.managers.roster[id],
    need = typeof fusionRequirement === 'function' ? fusionRequirement(id) : null;
  if (entry && need && kicker.startsWith('TALENT-KAPSEL')) $('talentText').textContent = text + ' Kopien für Rang ' + need.rank + ': ' + entry.copies + '/' + need.copies + '.';
  // Beta 1.5: the capsule glows in the colour of the specialist's earned rank frame (Bronze … Sternen)
  if (kicker.startsWith('TALENT-KAPSEL')) {
    const rank = entry?.rank || 1;
    playReveal(art, { rarity: (typeof RANK_REVEAL !== 'undefined' && RANK_REVEAL[rank]) || 'rare', label: 'Kapsel öffnet …' });
    if (typeof RANK_FRAMES !== 'undefined') $('talentItem').textContent += ' · ' + RANK_FRAMES[rank] + 'rahmen';
  }
};

// DNA weapons (wave rewards, fusion): one dialog, the weapon's chassis drawn in its affinity colour.
const dnaRevealQueue = [];
function dnaWeaponArt(w, size = 160) {
  const c = document.createElement('canvas');
  c.width = size * 2;
  c.height = size;
  const ctx = c.getContext?.('2d', { willReadFrequently: true });
  if (!ctx || !window.NebulaArt?.dnaMount) return '';
  ctx.translate(size * 0.78, size / 2);
  ctx.scale(size * 3.4, size * 3.4);
  window.NebulaArt.dnaMount(ctx, w, -0.05, 0, 4, 1.1);
  try {
    return c.toDataURL();
  } catch {
    return '';
  }
}
function showDnaReveal(w, kicker) {
  const modal = $('dnaRevealModal');
  if (!modal || !w) return;
  const art = dnaWeaponArt(w);
  $('dnaRevealKicker').textContent = kicker;
  $('dnaRevealTitle').textContent = dnaLabel(w);
  setHTML(
    $('dnaRevealStage'),
    `<div class="rv-orb" aria-hidden="true"></div><div class="reveal-card rarity-${w.rarity}">${art ? `<img src="${art}" alt="" width="200" height="100" />` : ''}<b>${dnaLabel(w)}</b><small>${ARSENAL_RARITY_NAME?.[w.rarity] || w.rarity} · ${DNA_ARCHETYPES[w.archetype]?.name || ''}</small><em>${dnaAffinityChip(w.affinity)} ${w.affixes.map(id => DNA_AFFIXES[id]?.name || id).join(' · ')}</em></div>`
  );
  $('dnaRevealText').textContent = DNA_CHASSIS[w.chassis]?.text + '. In der Werft montieren – volle Wirkung in der Arena.';
  openModal('dnaRevealModal');
  playReveal($('dnaRevealStage'), { rarity: w.rarity, label: 'DNA wird gelesen …' });
}
function nextDnaReveal() {
  const next = dnaRevealQueue.shift();
  if (next) showDnaReveal(next.weapon, next.kicker);
}
// rewards are granted (and saved) on the next render after their claim; the reveal follows
const renderBeforeReveal = render;
render = () => {
  renderBeforeReveal();
  if (!state.meta?.dna || (typeof arenaActive === 'function' && arenaActive())) return;
  const fresh = dnaRewardSync();
  if (fresh.length) {
    save();
    fresh.forEach(weapon => dnaRevealQueue.push({ weapon, kicker: 'FELDZUG-BELOHNUNG · DNA-WAFFE' }));
    if ($('dnaRevealModal')?.classList.contains('hidden')) nextDnaReveal();
  }
};
document.addEventListener('click', event => {
  if (event.target.closest('#dnaRevealOk')) {
    closeModal('dnaRevealModal');
    nextDnaReveal();
  }
});
