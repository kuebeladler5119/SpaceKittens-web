// Beta 1.3 — four primary tabs (KOLONIE, GALAXIE, ABENTEUER, KÄTZCHEN) and the secondary "Mehr" menu (☰ in the top
// bar): Lichtzyklus (prestige screen), Shop, Looks, Einstellungen. Nothing moved away is lost: every entry opens the
// same screen or dialog as before; the prestige screen keeps its own route (status card, objectives, showScreen).
// A dot on ☰ marks a Lichtzyklus that would pay Sternenstaub now. Loaded after mobile-ux.js.

function menuEntries() {
  const prestigeOpen = screenUnlocked('prestige'),
    gain = prestigeOpen ? prestigeGain() : 0;
  return [
    {
      id: 'prestige',
      icon: '✧',
      title: 'Lichtzyklus',
      text: prestigeOpen ? (gain >= 1 ? 'Galaxie verkaufen: +' + fmt(gain) + ' Sternenstaub · Sternen-Upgrades' : 'Sternen-Upgrades und Akademie · Verkauf ab mehr Einnahmen') : 'Ab ' + fmt(SCREEN_UNLOCKS.prestige) + ' verdienten Credits',
      locked: !prestigeOpen,
      dot: gain >= 1
    },
    { id: 'shop', icon: '◆', title: 'Shop', text: 'Boosts, Angebote und Kisten – Echtgeld ist in dieser Beta abgeschaltet' },
    { id: 'looks', icon: '🎀', title: 'Looks', text: 'Kosmetik für Mochi, Schiff und Kolonie – nur Aussehen, nie Werte' },
    { id: 'settings', icon: '⚙', title: 'Einstellungen', text: 'Ton, Bewegung, Spielstand' }
  ];
}
function renderMenu() {
  const list = $('menuList');
  if (!list) return;
  setHTML(
    list,
    menuEntries()
      .map(e => `<button class="menu-entry${e.dot ? ' has-dot' : ''}" data-menu="${e.id}" ${e.locked ? 'disabled' : ''}><i aria-hidden="true">${e.icon}</i><span><b>${e.title}</b><small>${e.text}</small></span>${e.locked ? '<em>🔒</em>' : '<em>›</em>'}</button>`)
      .join('')
  );
}
function menuDot() {
  const button = $('menuButton');
  if (button) button.toggleAttribute('data-dot', screenUnlocked('prestige') && prestigeGain() >= 1);
}
$('menuButton').onclick = () => {
  renderMenu();
  openModal('menuModal');
};
document.addEventListener('click', event => {
  const entry = event.target.closest('[data-menu]');
  if (!entry || entry.disabled) return;
  closeModal();
  const id = entry.dataset.menu;
  if (id === 'prestige') {
    showScreen('prestige');
    render();
  } else if (id === 'shop') openShop('offers');
  else if (id === 'looks') openShop('style');
  else if (id === 'settings') $('settingsButton').click();
});
const renderBeforeMenu = render;
render = () => {
  renderBeforeMenu();
  menuDot();
};
