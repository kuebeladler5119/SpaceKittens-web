// Beta 1.7 M7: the Fundstücke screen (☰ → Fundstücke). The collection grouped by type, each find with ★ (protected),
// ANALYSIEREN (what it gives is named first) and VERKAUFEN (the price is named first). The odds of every depth band
// are shown exactly as the game uses them, as is the progress to the next find. A toast reports a new find.
(function buildArtifactModal() {
  if ($('artifactModal')) return;
  const modal = document.createElement('div');
  modal.className = 'modal hidden';
  modal.id = 'artifactModal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'artifactTitle');
  modal.innerHTML = '<div class="modal-box tech-box"><button class="modal-close" data-close-modal="artifactModal" aria-label="Schließen">×</button><span>SAMMLUNG</span><h2 id="artifactTitle">Fundstücke</h2><div id="artifactPanel"></div></div>';
  document.body.append(modal);
})();
function artifactGainText(gain) {
  if (gain.crystals) return '+' + gain.crystals + ' Kristalle';
  if (gain.ore) return '+' + fmt(gain.ore) + ' Erz';
  if (gain.capsules) return '+' + gain.capsules + ' Manager-Kapsel';
  if (gain.chestsElite) return '+' + gain.chestsElite + ' Elitekiste';
  return '';
}
function renderArtifacts() {
  const panel = $('artifactPanel');
  if (!panel) return;
  const s = artifactState(),
    progress = Math.min(1, s.progress / artifactThreshold()),
    items = s.items
      .slice()
      .reverse()
      .map(a => {
        const def = ARTIFACTS[a.type];
        return `<article class="artifact-card ${def.rarity} ${a.fav ? 'fav' : ''}"><span class="artifact-icon" aria-hidden="true">${def.icon}</span><div><b>${def.name}</b><small>${ARTIFACT_RARITY[def.rarity]} · aus Tiefe ${a.depth}</small><p>${def.text}</p>${ARTIFACT_USES?.[a.type] ? `<p class="artifact-use">Zutat für: ${ARTIFACT_USES[a.type]}</p>` : ''}</div><div class="artifact-actions"><button data-artifact-fav="${a.id}" aria-pressed="${a.fav}" aria-label="${a.fav ? 'Schutz aufheben' : 'Schützen (nicht verkaufen oder analysieren)'}">${a.fav ? '★' : '☆'}</button><button data-artifact-analyse="${a.id}" ${a.fav ? 'disabled' : ''}>ANALYSIEREN · ${artifactGainText(def.analyse)}</button><button data-artifact-sell="${a.id}" ${a.fav ? 'disabled' : ''}>VERKAUFEN · ◈ ${fmt(def.sell)}</button></div></article>`;
      })
      .join(''),
    odds = ARTIFACT_TABLES.map(t => `<li><b>${t.name}</b> ${Object.entries(t.odds).map(([type, p]) => ARTIFACTS[type].icon + ' ' + ARTIFACTS[type].name + ' ' + p + ' %').join(' · ')}</li>`).join('');
  // Beta 1.9 M6: the collection – every type ever found; all five bring finds 10 % sooner
  const col = typeof artifactCollection === 'function' ? artifactCollection() : null,
    seen = col ? artifactSeen() : {},
    collection = col
      ? `<div class="artifact-collection"><b>Sammlung ${col.seen}/${col.total}</b> ${Object.keys(ARTIFACTS).map(t => `<span class="${seen[t] ? 'seen' : 'unseen'}" title="${seen[t] ? ARTIFACTS[t].name : 'noch nicht gefunden'}">${seen[t] ? ARTIFACTS[t].icon : '?'}</span>`).join('')}<small>${col.seen >= col.total ? 'Vollständig: Funde kommen 10 % früher.' : 'Vollständig bringt sie Funde 10 % früher.'}</small></div>`
      : '';
  setHTML(
    panel,
    `${collection}<p class="tech-note">Tiefe Schächte (ab Tiefe 3) stoßen beim Fördern auf Fundstücke: je ${fmt(artifactThreshold())} geförderte Einheiten ein Fund – jeder Fund macht den nächsten etwas seltener. Nächster Fund: ${Math.round(progress * 100)} %.</p><i class="station-bar"><u style="width:${Math.round(progress * 100)}%"></u></i>
    <div class="artifact-list">${items || '<p class="tech-note">Noch keine Fundstücke. Baue Schacht 3 und fördere in der Tiefe.</p>'}</div>
    <details class="artifact-odds"><summary>Fundchancen (feste Tabelle)</summary><ul>${odds}</ul><p class="tech-note">Höchstens 2 Funde je Produktionsschritt, auch nach langer Abwesenheit. Der Zufall kommt aus deinem Spielstand – Neu laden ändert nichts.</p></details>`
  );
}
function openArtifacts() {
  renderArtifacts();
  openModal('artifactModal');
}
document.addEventListener('click', event => {
  const fav = event.target.closest('[data-artifact-fav]');
  if (fav) {
    artifactFavourite(Number(fav.dataset.artifactFav));
    requestSave(200);
    return renderArtifacts();
  }
  const an = event.target.closest('[data-artifact-analyse]');
  if (an) {
    const gain = artifactAnalyse(Number(an.dataset.artifactAnalyse));
    if (gain) {
      toast('Analysiert: ' + artifactGainText(gain));
      feedback('unlock', 'success');
      requestSave(200);
      render();
    }
    return renderArtifacts();
  }
  const sell = event.target.closest('[data-artifact-sell]');
  if (sell) {
    const credits = artifactSell(Number(sell.dataset.artifactSell));
    if (credits) {
      toast('Verkauft: ◈ ' + fmt(credits));
      feedback('collect', 'light');
      requestSave(200);
      render();
    }
    return renderArtifacts();
  }
});
GameEvents.on('artifact', ({ type }) => toast('Fundstück entdeckt: ' + ARTIFACTS[type].icon + ' ' + ARTIFACTS[type].name + ' (☰ → Fundstücke)'));
// ☰ menu: Fundstücke
const menuEntriesBeforeArtifacts = menuEntries;
menuEntries = () => {
  const list = menuEntriesBeforeArtifacts(),
    n = artifactState().items.length;
  list.splice(2, 0, { id: 'artifacts', icon: '🔮', title: 'Fundstücke', text: n ? n + ' in der Sammlung · analysieren oder verkaufen' : 'Funde aus den tiefen Schächten (ab Tiefe 3)' });
  return list;
};
document.addEventListener(
  'click',
  event => {
    if (!event.target.closest('[data-menu="artifacts"]')) return;
    event.stopImmediatePropagation();
    closeModal();
    openArtifacts();
  },
  true
);
