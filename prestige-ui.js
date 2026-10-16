// Beta 1.2 — prestige preview (K91): before "Galaxie verkaufen" the player sees what the Lichtzyklus pays, what stays
// for good and what restarts — above all run-level Sprungtor progress. Information only: the prestige rules
// (performPrestige) are unchanged and the decision is never altered or cancelled by this module.

const PRESTIGE_GATE_NEAR = 0.6; // share of the next gate stage's Credits that counts as "close"

// Pure read of the current state (no side effects) — also used by tests.
function prestigePreview() {
  const gain = prestigeGain(),
    archive = starLevel('archive'),
    legacy = starLevel('legacy'),
    capital = [0, 2000, 15000, 120000, 1000000, 8000000][starLevel('capital')] || 0,
    planets = state.planetsUnlocked.filter(Boolean).length,
    keptPlanets = Math.min(planets, 1 + archive),
    research = state.research.filter(Boolean).length,
    keptResearch = Math.min(research, legacy),
    sectors = (state.sectorUnlocked || []).filter(Boolean).length,
    requirement = typeof gateRequirement === 'function' ? gateRequirement() : null;
  let next = null;
  if (requirement) {
    const parts = [
      requirement.credits > 0 ? Math.min(1, state.credits / requirement.credits) : 1,
      requirement.ore > 0 ? Math.min(1, state.ore / requirement.ore) : 1,
      requirement.alloys > 0 ? Math.min(1, state.alloys / requirement.alloys) : 1
    ];
    const progress = Math.min(...parts);
    next = { stage: state.jumpGate + 1, label: requirement.label, ready: Boolean(requirement.ready), progress, near: Boolean(requirement.ready) && progress >= PRESTIGE_GATE_NEAR };
  }
  const reset = [];
  if (state.jumpGate > 0) reset.push({ id: 'gate', icon: '◌', text: 'Sprungtor Phase ' + state.jumpGate + ' von 3 (Tor startet wieder bei 0)', important: true });
  if (next?.near) reset.push({ id: 'gate-near', icon: '◌', text: 'Fast fertige Torphase ' + next.stage + ' (' + Math.floor(next.progress * 100) + ' % bezahlbar)', important: true });
  if (planets > keptPlanets) reset.push({ id: 'planets', icon: '🪐', text: planets - keptPlanets + ' entdeckte Planeten (neu scannen)' });
  if (research > keptResearch) reset.push({ id: 'research', icon: '⚗', text: research - keptResearch + ' Forschungen' });
  if (sectors) reset.push({ id: 'sectors', icon: '✦', text: sectors + ' gesicherte Sektoren' });
  if (state.faction?.joined !== null && state.faction?.joined !== undefined) reset.push({ id: 'faction', icon: '⚑', text: 'Fraktionsfortschritt' });
  if (state.enemyLevel > 1) reset.push({ id: 'ladder', icon: '⚔', text: 'Kampfleiter Stufe ' + state.enemyLevel + ' (Rekorde bleiben)' });
  reset.push({ id: 'colony', icon: '⌂', text: 'Gebäude, Credits und Rohstoffe der Kolonien' });
  if (state.colonies.some(c => c.fab?.orders.length || GOOD_IDS.some(id => (c.goods?.[id] || 0) > 0))) reset.push({ id: 'goods', icon: '▤', text: 'Fertigungswaren und laufende Aufträge (freigeschaltete Rezepte bleiben)' });
  const keep = [{ id: 'stardust', icon: '✧', text: '+' + fmt(gain) + ' Sternenstaub (dann ' + fmt(state.stardust + gain) + ')', important: true }];
  keep.push({ id: 'stars', icon: '⌁', text: 'Sternen-Boni und Gems' });
  if (state.meta?.arsenal) keep.push({ id: 'arsenal', icon: '✦', text: (Object.keys(state.meta.arsenal.items).length ? 'Arsenal: ' + Object.keys(state.meta.arsenal.items).length + ' Ausrüstungsteile, ' : 'Arsenal: ') + 'Kisten, Splitter' });
  if (typeof catUnlocked === 'function' && catUnlocked()) keep.push({ id: 'tikki', icon: '🐾', text: 'Tikki und ihr Funkengleiter' });
  keep.push({ id: 'story', icon: '♥', text: 'Wächter, Story, Manager und Akademie' });
  if (capital) keep.push({ id: 'capital', icon: '◈', text: 'Startkapital ' + fmt(capital) + ' Credits' });
  if (archive) keep.push({ id: 'archive', icon: '🪐', text: keptPlanets - 1 + ' Planeten bleiben entdeckt (Sternkarten-Archiv)' });
  if (keptResearch) keep.push({ id: 'legacy', icon: '⚗', text: keptResearch + ' Forschungen bleiben (Forschungserbe)' });
  return { gain, keep, reset, gate: state.jumpGate, next, warn: state.jumpGate > 0 || Boolean(next?.near) };
}

function prestigeListHTML(items) {
  return items.map(item => `<li class="${item.important ? 'important' : ''}"><i aria-hidden="true">${item.icon}</i><span>${item.text}</span></li>`).join('');
}
function renderPrestigePreview() {
  const preview = prestigePreview(),
    box = $('prestigePreview');
  if (!box) return preview;
  const warning = preview.warn
    ? `<p class="prestige-warning" role="note"><b>Sprungtor:</b> ${
        preview.next?.near
          ? 'Phase ' + preview.next.stage + ' ist fast bezahlbar. Nach dem Verkauf beginnt das Tor wieder bei Phase 0 — vielleicht erst die Phase bauen?'
          : preview.gate === 1
            ? 'Deine gebaute Torphase gehört zu dieser Galaxie und startet neu.'
            : 'Deine ' + preview.gate + ' gebauten Torphasen gehören zu dieser Galaxie und starten neu.'
      }</p>`
    : '';
  setHTML(
    box,
    `${warning}<div class="prestige-columns"><section><h3>BLEIBT</h3><ul>${prestigeListHTML(preview.keep)}</ul></section><section><h3>STARTET NEU</h3><ul>${prestigeListHTML(preview.reset)}</ul></section></div>`
  );
  return preview;
}

// The confirmation keeps its single button and its wording; only the content explains the consequences.
const prestigeButtonBeforePreview = $('prestigeButton').onclick;
$('prestigeButton').onclick = event => {
  prestigeButtonBeforePreview(event);
  if (!$('prestigeModal').classList.contains('hidden')) renderPrestigePreview();
};

// The prestige screen's advice names a lost or nearly finished gate before the player even opens the dialog.
const renderBeforePrestigePreview = render;
render = () => {
  renderBeforePrestigePreview();
  if (currentScreen() !== 'prestige' || prestigeGain() < 1) return;
  const preview = prestigePreview();
  if (preview.next?.near) $('prestigeAdvice').textContent = 'Sprungtor Phase ' + preview.next.stage + ' ist fast bezahlbar — ein Verkauf jetzt setzt das Tor auf 0 zurück.';
  else if (preview.gate > 0) $('prestigeAdvice').textContent = 'Ein Verkauf setzt dein Sprungtor (Phase ' + preview.gate + ') zurück. Sternenstaub, Arsenal, Tikki und Story bleiben.';
};

// Guidance: the generic end-of-list objective ("Nächste Galaxie vorbereiten") says what to do next — build the gate
// stage that is affordable now, or sell the galaxy when the Lichtzyklus clearly pays — instead of always prestige.
const renderObjectiveBaseBeforeGuide = renderObjectiveBase;
renderObjectiveBase = () => {
  renderObjectiveBaseBeforeGuide();
  refineFallbackObjective();
};
function refineFallbackObjective() {
  if ($('objectiveTitle').textContent !== 'Nächste Galaxie vorbereiten') return;
  const preview = prestigePreview(),
    set = (icon, title, text, action, screen) => {
      $('objectiveIcon').textContent = icon;
      $('objectiveTitle').textContent = title;
      $('objectiveText').textContent = text;
      $('objectiveAction').textContent = action;
      $('objectiveCard').dataset.screen = screen;
    };
  if (preview.next?.ready && preview.next.progress >= 1)
    set('◌', 'Sprungtor Phase ' + preview.next.stage + ' bauen', preview.next.label + ' — bezahlbar. Bau sie vor dem nächsten Verkauf, sonst startet das Tor neu.', 'SPRUNGTOR ›', 'trade');
  else if (preview.gain >= Math.max(3, state.stardust + spentStardust() * 0.5))
    set('✧', 'Lichtzyklus lohnt sich', '+' + fmt(preview.gain) + ' Sternenstaub für dauerhafte Boni. Arsenal, Tikki und Story bleiben erhalten.', 'LICHTZYKLUS ›', 'prestige');
}

// Game feel: the new galaxy is celebrated with what it brought and what stayed (the mechanics are untouched).
const performPrestigeBeforeCelebration = performPrestige;
performPrestige = () => {
  const gain = prestigeGain(),
    ok = performPrestigeBeforeCelebration();
  if (ok && $('heroCard')) showPlanetMilestone('✧', 'NEUE GALAXIE · +' + fmt(gain) + ' STERNENSTAUB', 'Arsenal, Tikki, Wächter und Story bleiben bei dir.');
  return ok;
};
