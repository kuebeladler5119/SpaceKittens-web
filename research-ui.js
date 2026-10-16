// Beta 1.7 M8: the Forschungsbaum on a phone – branch chips on top, the branch's nodes as a vertical chain (tier 1 →
// 3, each one unlocking the next), every node with its real effect, its cost (Credits + materials of the visited
// colony, the missing amounts named) and one button. Opened from ☰ → Forschung and from the colony's Orbitallabor
// card. The wrappers of game.js functions for research effects live here (loaded after game.js and the UI modules).
let techBranch = 'mining';
(function buildTechModal() {
  if ($('techModal')) return;
  const modal = document.createElement('div');
  modal.className = 'modal hidden';
  modal.id = 'techModal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'techTitle');
  modal.innerHTML =
    '<div class="modal-box tech-box"><button class="modal-close" data-close-modal="techModal" aria-label="Schließen">×</button><span>FORSCHUNG</span><h2 id="techTitle">Forschungsbaum</h2><p class="tech-note" id="techNote"></p><nav class="tech-branches" id="techBranches" aria-label="Forschungszweige"></nav><div class="tech-list" id="techList"></div></div>';
  document.body.append(modal);
  // the colony's research card gets the way into the tree
  const panel = $('researchPanel');
  if (panel && !$('techOpen')) {
    const b = document.createElement('button');
    b.className = 'survey-button tech-open';
    b.id = 'techOpen';
    b.dataset.techOpen = '';
    b.textContent = 'FORSCHUNGSBAUM ÖFFNEN';
    panel.append(b);
  }
})();
function techCostHTML(id) {
  const missing = techMissing(id);
  return Object.entries(TECH[id].cost)
    .map(([item, need]) => {
      const [name, icon] = techItemName(item),
        short = missing[item];
      return `<span class="${short ? 'short' : 'ok'}">${icon} ${fmt(need)} ${item === 'credits' ? '' : name}${short ? ' · fehlt ' + fmt(Math.ceil(short)) : ''}</span>`;
    })
    .join('');
}
function renderTech() {
  const list = $('techList');
  if (!list) return;
  const planet = PLANETS[state.activePlanet]?.name || '';
  $('techNote').textContent = 'Forschung gilt für alle Kolonien und bleibt nach „Neue Galaxie“. Materialien zahlt die Kolonie, die du gerade besuchst: ' + planet + '.';
  setHTML(
    $('techBranches'),
    TECH_BRANCHES.map(br => {
      const ids = TECH_IDS.filter(id => TECH[id].branch === br.id),
        done = ids.filter(techHas).length;
      return `<button class="${br.id === techBranch ? 'active' : ''}" data-tech-branch="${br.id}" aria-pressed="${br.id === techBranch}"><span aria-hidden="true">${br.icon}</span><b>${br.name}</b><small>${done}/${ids.length}</small></button>`;
    }).join('')
  );
  setHTML(
    list,
    TECH_IDS.filter(id => TECH[id].branch === techBranch)
      .sort((x, y) => TECH[x].tier - TECH[y].tier)
      .map(id => {
        const def = TECH[id],
          done = techHas(id),
          open = techAvailable(id),
          short = Object.keys(techMissing(id)).length > 0,
          stateText = done ? 'ERFORSCHT' : !open ? 'Braucht ' + TECH[def.needs].name : short ? 'FEHLT NOCH' : 'ERFORSCHEN';
        return `<article class="tech-node ${done ? 'done' : open ? 'open' : 'locked'}"><i class="tech-tier" aria-hidden="true">${def.tier}</i><div><b>${def.name}</b><p>${def.text}</p>${done ? '' : `<p class="tech-cost">${techCostHTML(id)}</p>`}</div><button data-tech-buy="${id}" ${done || !open || short ? 'disabled' : ''}>${stateText}</button></article>`;
      })
      .join('')
  );
}
function openTech(branch) {
  if (branch && TECH_BRANCHES.some(b => b.id === branch)) techBranch = branch;
  renderTech();
  openModal('techModal');
}
document.addEventListener('click', event => {
  if (event.target.closest('[data-tech-open]')) return openTech();
  const br = event.target.closest('[data-tech-branch]');
  if (br) {
    techBranch = br.dataset.techBranch;
    feedback('open');
    return renderTech();
  }
  const buy = event.target.closest('[data-tech-buy]');
  if (buy) {
    const id = buy.dataset.techBuy;
    if (buyTech(id)) {
      feedback('unlock', 'success');
      toast('Erforscht: ' + TECH[id].name);
      requestSave(200);
      render();
    } else toast('Noch nicht genug Material in dieser Kolonie.');
    renderTech();
  }
});
// ☰ menu: Forschung (after Lichtzyklus)
const menuEntriesBeforeTech = menuEntries;
menuEntries = () => {
  const list = menuEntriesBeforeTech(),
    done = TECH_IDS.filter(techHas).length;
  list.splice(1, 0, { id: 'tech', icon: '🔬', title: 'Forschung', text: done + ' von ' + TECH_IDS.length + ' erforscht · Bergbau, Logistik, Fertigung, Automatik, Kampf' });
  return list;
};
document.addEventListener(
  'click',
  event => {
    const entry = event.target.closest('[data-menu="tech"]');
    if (!entry) return;
    event.stopImmediatePropagation();
    closeModal();
    openTech();
  },
  true
);
// ----- effects that live in game.js functions -----
const offlineEfficiencyBeforeTech = offlineEfficiency;
offlineEfficiency = () => Math.min(1, offlineEfficiencyBeforeTech() + (techHas('nightShift') ? 0.05 : 0));
