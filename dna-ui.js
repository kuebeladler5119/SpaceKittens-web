// Beta 1.4 M3 — Galactic DNA in the Werft (mount a weapon, see its identity) and in the Arsenal (affinity chip).
// Logic: dna.js. Loaded after combat-ui.js (the Werft lives on the battle screen).

function dnaAffinityChip(affinity) {
  const a = DNA_AFFINITIES[affinity];
  return a ? `<span class="dna-chip dna-${affinity}" title="${a.name}: stark gegen ${DNA_AFFINITIES[a.beats].name}">${a.icon} ${a.short}</span>` : `<span class="dna-chip">? ${affinity}</span>`;
}
// What beats what, in one line (the cycle is the same for weapons and enemies)
function dnaCycleHTML() {
  return `<p class="dna-cycle">${DNA_AFFINITY_IDS.map(id => DNA_AFFINITIES[id].icon + ' ' + DNA_AFFINITIES[id].short).join(' → ')} → ${DNA_AFFINITIES.hydro.icon} · jede Affinität schlägt die nächste (×1,25) und ist schwach gegen die vorige (×0,8)</p>`;
}
function dnaWeaponHTML(w, mounted) {
  const c = DNA_CHASSIS[w.chassis],
    s = dnaStats(w),
    rarity = typeof ARSENAL_RARITY_NAME !== 'undefined' ? ARSENAL_RARITY_NAME[w.rarity] || w.rarity : w.rarity;
  return `<article class="dna-weapon ${mounted ? 'mounted' : ''} rarity-${w.rarity}" data-dna="${w.uid}">
    <header><b>${dnaLabel(w)}</b>${dnaAffinityChip(w.affinity)}</header>
    <small>${rarity} · ${DNA_ARCHETYPES[w.archetype]?.name || 'Waffe'} · ${c ? c.text : 'Chassis aus einer neueren Version'}</small>
    <p class="dna-stats"><span>Feuerrate ×${s.rate.toFixed(2).replace('.', ',')}</span><span>Schaden ×${s.damage.toFixed(2).replace('.', ',')}</span>${s.count > 1 ? `<span>${s.count} Projektile</span>` : ''}${s.pierce ? `<span>durchschlägt ${s.pierce}</span>` : ''}${s.splash ? `<span>Fläche ${Math.round(s.splash)}</span>` : ''}</p>
    ${w.affixes.length ? `<p class="dna-affixes">${w.affixes.map(id => `<span title="${DNA_AFFIXES[id]?.text || ''}">${DNA_AFFIXES[id]?.name || id}</span>`).join('')}</p>` : ''}
    <small class="dna-seed">DNA ${w.seed.toString(36).toUpperCase()} · ${{ starter: 'Werft-Prototyp', chest: 'aus einer Kiste', wave: 'Feldzug-Belohnung', fusion: 'Fusion' }[w.src] || 'Belohnung'}</small>
    <button ${mounted ? 'class="secondary" data-dna-unmount' : `data-dna-mount="${w.uid}"`}>${mounted ? 'ABNEHMEN' : 'MONTIEREN'}</button>
  </article>`;
}
function renderDnaWeapons() {
  const box = $('dnaWeapons');
  if (!box || !state.meta?.dna) return;
  const d = state.meta.dna;
  setHTML(
    box,
    `<p class="dna-intro">Galaktische DNA: Chassis, Affinität und Eigenschaften jeder Waffe sind fest in ihrem Code. Montiert prägt sie Aussehen und Schüsse deines Schiffs; ihre Werte wirken voll in der Arena des Feldzugs. Ohne DNA-Waffe kämpft das Schiff mit seinem Waffensystem (${state.ship.weaponType} = ${DNA_AFFINITIES[WEAPON_AFFINITY[state.ship.weaponType]]?.short || 'Kinetik'}).</p>${dnaCycleHTML()}${
      d.owned.length ? `<div class="dna-list">${d.owned.map(w => dnaWeaponHTML(w, w.uid === d.mount)).join('')}</div>` : '<p class="freight-hint">Noch keine DNA-Waffe – die Werft baut dir zwei Prototypen, sobald das Abenteuer offen ist.</p>'
    }`
  );
}
// the two shipyard prototypes arrive once the battle screen is open (free, once per account)
function dnaStarterCheck() {
  if (state.meta?.dna && !state.meta.dna.starter && typeof screenUnlocked === 'function' && screenUnlocked('battle')) {
    grantStarterDna();
    save();
  }
}
// Arsenal items show their derived DNA affinity next to their tags (stats unchanged)
const arsenalTagsBeforeDna = arsenalTagsHTML;
arsenalTagsHTML = item => {
  const dna = arsenalDna(item.id);
  return arsenalTagsBeforeDna(item) + (dna ? `<span class="arsenal-tags">${dnaAffinityChip(dna.affinity)}</span>` : '');
};
document.addEventListener('click', event => {
  const mount = event.target.closest('[data-dna-mount]');
  if (mount) {
    if (mountDna(mount.dataset.dnaMount)) {
      feedback('upgrade', 'light');
      toast(dnaLabel(mountedDna()) + ' montiert.');
      save();
    }
    return render();
  }
  if (event.target.closest('[data-dna-unmount]')) {
    mountDna(null);
    save();
    return render();
  }
});
const renderBeforeDna = render;
render = () => {
  renderBeforeDna();
  dnaStarterCheck();
  if (currentScreen() === 'battle') renderDnaWeapons();
};
const showScreenBeforeDna = showScreen;
showScreen = screen => {
  showScreenBeforeDna(screen);
  if (currentScreen() === 'battle') renderDnaWeapons();
};
render();
// the Werft's "Aktuelle Ausstattung" names the mounted DNA weapon next to the weapon system
const workshopDetailBeforeDna = workshopDetailHTML;
workshopDetailHTML = () => {
  const html = workshopDetailBeforeDna(),
    d = mountedDna();
  return d && html.includes('AKTUELLE AUSSTATTUNG') ? html.replace('</b>', ' · DNA ' + dnaLabel(d) + '</b>') : html;
};

// ----- Beta 1.4 M6: fusion with an exact preview, the DNA collection -----
let dnaFuseBase = null,
  dnaFuseDonor = null;
function dnaFusionHTML() {
  const d = state.meta.dna;
  if (!dnaFuseBase) return d.owned.length >= 2 ? '<p class="dna-intro">Fusion: zwei DNA-Waffen gleicher Seltenheit ergeben eine der nächsten Seltenheit – Chassis von der Basis, Affinität vom Spender. Das Ergebnis siehst du vorher genau.</p>' : '';
  const base = d.owned.find(w => w.uid === dnaFuseBase);
  if (!dnaFuseDonor) return `<div class="dna-fusion"><b>Fusion · Basis: ${dnaLabel(base)}</b><small>Wähle einen Spender gleicher Seltenheit (Taste „SPENDER“).</small><button class="secondary" data-dna-fuse-cancel>ABBRECHEN</button></div>`;
  const p = dnaFusePreview(dnaFuseBase, dnaFuseDonor);
  if (!p.ok) return `<div class="dna-fusion"><b>Fusion nicht möglich</b><small>${p.why}</small><button class="secondary" data-dna-fuse-cancel>ABBRECHEN</button></div>`;
  return `<div class="dna-fusion"><b>Fusion · Vorschau</b><small>${dnaLabel(p.base)} + ${dnaLabel(p.donor)} → beide werden verbraucht</small>${
    p.base.rarity === 'epic' || [p.base.uid, p.donor.uid].includes(d.mount)
      ? `<p class="dna-warn" role="note">Achtung: ${[p.base.rarity === 'epic' ? 'zwei epische Waffen gehen in eine legendäre auf' : '', [p.base.uid, p.donor.uid].includes(d.mount) ? 'deine montierte Waffe wird verbraucht (das Ergebnis wird montiert)' : ''].filter(Boolean).join(' · ')}.</p>`
      : ''
  }${dnaWeaponHTML({ ...p.result, uid: 'preview', src: 'fusion' }, false).replace(/<button[^>]*>[^<]*<\/button>/, '')}<div class="fab-actions"><button data-dna-fuse-confirm ${p.affordable ? '' : 'disabled'}>FUSIONIEREN · ✦ ${p.cost}</button><button class="secondary" data-dna-fuse-cancel>ABBRECHEN</button></div>${p.affordable ? '' : '<small>Nicht genug Sternsplitter (✦ ' + (state.meta.arsenal?.splitters || 0) + ').</small>'}</div>`;
}
function dnaCodexHTML() {
  const seen = new Set(state.meta.dna.seen),
    next = DNA_CODEX_MILESTONES.find(m => !state.meta.dna.claims.includes('codex:' + m.need));
  return `<details class="dna-codex"><summary>DNA-Sammlung ${seen.size}/${DNA_CHASSIS_IDS.length * DNA_AFFINITY_IDS.length}${next ? ' · bei ' + next.need + ': ' + next.text : ' · komplett'}</summary><table><thead><tr><th></th>${DNA_AFFINITY_IDS.map(a => `<th>${DNA_AFFINITIES[a].icon}</th>`).join('')}</tr></thead><tbody>${DNA_CHASSIS_IDS.map(
    c => `<tr><th>${DNA_CHASSIS[c].name}</th>${DNA_AFFINITY_IDS.map(a => `<td class="${seen.has(c + ':' + a) ? 'seen' : ''}" aria-label="${DNA_CHASSIS[c].name} ${DNA_AFFINITIES[a].short}: ${seen.has(c + ':' + a) ? 'gesammelt' : 'offen'}">${seen.has(c + ':' + a) ? '✓' : '·'}</td>`).join('')}</tr>`
  ).join('')}</tbody></table><p class="dna-intro">Neue Kombinationen gibt es über Feldzug-Belohnungen (Wellen 3, 6, 9) und Fusionen. Meilensteine zahlen Kisten – einmal.</p></details>`;
}
const dnaWeaponHTMLBeforeFusion = dnaWeaponHTML;
dnaWeaponHTML = (w, mounted) => {
  let html = dnaWeaponHTMLBeforeFusion(w, mounted);
  if (w.uid === 'preview') return html;
  const base = dnaFuseBase && state.meta.dna.owned.find(x => x.uid === dnaFuseBase),
    button = !dnaFuseBase
      ? `<button class="secondary" data-dna-fuse-base="${w.uid}">ALS BASIS</button>`
      : w.uid === dnaFuseBase
        ? '<button class="secondary" disabled>BASIS</button>'
        : base && base.rarity === w.rarity
          ? `<button class="secondary" data-dna-fuse-donor="${w.uid}">SPENDER</button>`
          : '';
  return html.replace(/<\/article>\s*$/, button + '</article>');
};
const renderDnaWeaponsBeforeFusion = renderDnaWeapons;
renderDnaWeapons = () => {
  renderDnaWeaponsBeforeFusion();
  const box = $('dnaWeapons');
  if (!box || !state.meta?.dna) return;
  box.insertAdjacentHTML('beforeend', dnaFusionHTML() + dnaCodexHTML());
  htmlCache.delete(box);
};
document.addEventListener('click', event => {
  const t = event.target;
  const base = t.closest('[data-dna-fuse-base]');
  if (base) {
    dnaFuseBase = base.dataset.dnaFuseBase;
    dnaFuseDonor = null;
    return renderDnaWeapons();
  }
  const donor = t.closest('[data-dna-fuse-donor]');
  if (donor) {
    dnaFuseDonor = donor.dataset.dnaFuseDonor;
    renderDnaWeapons();
    return $('dnaWeapons')?.querySelector('.dna-fusion')?.scrollIntoView?.({ block: 'center', behavior: document.body.classList.contains('reduce-motion') ? 'auto' : 'smooth' });
  }
  if (t.closest('[data-dna-fuse-cancel]')) {
    dnaFuseBase = dnaFuseDonor = null;
    return renderDnaWeapons();
  }
  if (t.closest('[data-dna-fuse-confirm]')) {
    const weapon = dnaFuse(dnaFuseBase, dnaFuseDonor);
    dnaFuseBase = dnaFuseDonor = null;
    if (!weapon) return renderDnaWeapons();
    save(); // the fusion is on disk before its reveal
    feedback('chest', 'success');
    render();
    if (typeof showDnaReveal === 'function') showDnaReveal(weapon, 'FUSION · DNA-WAFFE');
  }
});

// Beta 1.5: chests show their DNA bonus odds and reveal a DNA weapon next to the Arsenal item
const DNA_CHEST_LABEL = { standard: 'Sternenkiste', elite: 'Kometenkiste', relic: 'Sternenrelikt' };
const chestOddsBeforeDna = chestOddsHTML;
chestOddsHTML = kind => {
  const odds = DNA_CHEST_ODDS[kind],
    total = odds ? Object.values(odds.rarity).reduce((s, w) => s + w, 0) : 1;
  const line = odds
    ? `<p class="dna-odds">Zusätzlich: DNA-Waffe mit ${Math.round(odds.chance * 100)} % Chance (${Object.entries(odds.rarity)
        .map(([r, w]) => ARSENAL_RARITY_NAME[r] + ' ' + Math.round((w / total) * 1000) / 10 + ' %')
        .join(', ')}). Chassis und Affinität sind gleich wahrscheinlich. Das Arsenal-Teil der Kiste bleibt unverändert.</p>`
    : '';
  return chestOddsBeforeDna(kind).replace('</details>', line + '</details>');
};
const renderChestModalBeforeDna = renderChestModal;
renderChestModal = result => {
  renderChestModalBeforeDna(result);
  const stage = $('chestStage');
  if (!stage || !result) return;
  if (result.dna) {
    const w = result.dna;
    stage.insertAdjacentHTML('beforeend', `<div class="reveal-card dna-bonus rarity-${w.rarity}"><i aria-hidden="true">${DNA_AFFINITIES[w.affinity]?.icon || '✦'}</i><b>${dnaLabel(w)}</b><small>DNA-Waffe · ${ARSENAL_RARITY_NAME[w.rarity] || w.rarity}</small><em>NEU in der Werft</em></div>`);
    htmlCache.delete(stage);
  } else if (result.dnaSplitters) $('chestText').textContent += ' · DNA-Hangar voll: +' + result.dnaSplitters + ' ✦';
};
