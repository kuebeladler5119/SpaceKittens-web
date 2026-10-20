// Friends-UX: the first steps, help and build info. Loaded after artifacts-ui.js (the outermost render wrappers come
// after it: platform.js, frame-pacing.js). State: onboarding-state.js (state.meta.onboarding).
//
// The flow teaches the real production chain in the game's own order – ABBAUEN → LORE → VERKAUF → the first upgrade →
// the first manager – with one hint at a time, placed at the button or building it is about (Mochi's speech bubble and
// a ring). Every step is recognised from real game events or the state, so a reload continues at the right step.
// Nothing is granted, skipped, delayed or locked: every button works as before, and the player can try anything.
// While the first steps run, later systems stay out of the way: the resource chips, the scene tools, the daily
// reward, the shop's gem button, the next-step card and the story bubbles (they wait and play afterwards).
// The hints can be hidden (×) and shown again; ☰ → Hilfe explains the chain and where everything is.

const ONBOARDING_TEXT = {
  mine: ['Tippe auf ABBAUEN', 'Kristalle landen auf der Halde.'],
  rail: ['Jetzt die LORE', 'Sie bringt die Kristalle ins Lager.'],
  stall: ['VERKAUFEN', 'Kristalle aus dem Lager werden zu Credits ◈.'],
  upgrade: ['Tippe auf die Kristallmine', 'Ein Upgrade bringt mehr Kristalle pro Tipp.'],
  upgradeBuy: ['VERBESSERN', 'Mehr Kristalle bei jedem Abbau.'],
  manager: ['Stell eine Bergbau-Katze ein', 'Sie baut dann ganz von selbst ab.'],
  managerSave: ['Noch etwas sparen', ''],
  celebrate: ['Läuft von selbst!', 'Die Bergbau-Katze baut jetzt automatisch ab. Für Lore und Verkauf gibt es später eigene Katzen.']
};
const ONBOARDING_TITLES = { mine: 'Abbauen', rail: 'Lore', stall: 'Verkaufen', upgrade: 'Upgrade', manager: 'Manager' };
let onboardingCelebrateUntil = 0,
  onboardingFocusedStep = '',
  onboardingRaf = 0,
  onboardingLastKey = '';

function onboardingState() {
  if (!state.meta.onboarding) state.meta.onboarding = normalizeOnboarding(null, null);
  return state.meta.onboarding;
}
function onboardingFinish() {
  const o = onboardingState();
  if (o.done) return;
  o.done = true;
  o.celebrate = false;
  onboardingCelebrateUntil = 0;
  // the story bubbles that waited play now
  if (storyQueue.length && $('storyBubble')?.classList.contains('hidden')) showNextStoryLine();
}
// true while the first steps run. A player who went far ahead without the hints is done (graduates).
function onboardingActive() {
  const o = onboardingState();
  if (o.done) return false;
  if (state.galaxiesSold > 0 || onboardingProgressedFar(state)) {
    onboardingFinish();
    return false;
  }
  return true;
}
function onboardingLearned() {
  return { ...onboardingLearnedFromState(state), ...onboardingState().learned };
}
// the current step: the first one not learned yet (steps can be learned out of order – nothing is enforced)
function onboardingStep() {
  if (!onboardingActive()) return null;
  const o = onboardingState(),
    learned = onboardingLearned();
  if (learned.manager) {
    if (o.celebrate && Date.now() < onboardingCelebrateUntil) return 'celebrate';
    onboardingFinish();
    return null;
  }
  return ONBOARDING_STEPS.find(id => !learned[id]) || null;
}
function onboardingLearn(id) {
  const o = onboardingState();
  if (o.done || o.learned[id]) return;
  o.learned[id] = true;
}

// ----- real game events mark the steps -----
GameEvents.on('harvest', p => {
  if ((p?.material > 0 || p?.queued) && state.activePlanet === 0) onboardingLearn('mine');
});
GameEvents.on('transport', p => {
  if (p?.amount > 0 && !p.helper && (p.planet ?? 0) === 0) onboardingLearn('rail');
});
GameEvents.on('sale', p => {
  if (p?.credits > 0 && !p.helper && (p.planet ?? 0) === 0) onboardingLearn('stall');
});
GameEvents.on('hire', p => {
  if (p?.workplace !== 'mine' || (p.planet ?? 0) !== 0) return;
  const o = onboardingState();
  if (o.done) return;
  onboardingLearn('manager');
  o.celebrate = true;
  onboardingCelebrateUntil = Date.now() + 7000;
});

// ----- where each hint points -----
function onboardingVisible(el) {
  if (!el || !el.getClientRects().length) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return null;
  return r;
}
// the Kristallmine in the colony scene (its tap area, in screen coordinates)
function onboardingMineRect() {
  const scene = window.NebulaScenesRuntime?.mounted?.colony?.scene,
    canvas = document.querySelector('canvas.scene-colony');
  if (!scene?.hitAreas || !canvas) return null;
  const hits = scene.hitAreas(),
    area = h => (h.x1 - h.x0) * (h.y1 - h.y0),
    // the headframe: the largest tap area that opens the Kristallmine's panel
    hit = hits.filter(h => h.type === 'building' && (h.key === 0 || h.key === '0')).sort((a, b) => area(b) - area(a))[0];
  const c = onboardingVisible(canvas);
  if (!hit || !c) return null;
  // the visible headframe: the lower part of the tap area (its top is sky). The crystal field and Mochi lie on top of it
  // (a tap there mines or cheers), so during these hints the ring itself is the button that opens the panel.
  const field = hits.find(h => h.type === 'deposit' && h.x1 > hit.x0 && h.x0 < hit.x1);
  const top = field ? Math.max(hit.y0, field.y0 - 100) : hit.y0,
    bottom = hit.y1;
  const x0 = Math.max(c.left + 4, c.left + hit.x0 - scene.camera.x),
    x1 = Math.min(c.right - 4, c.left + hit.x1 - scene.camera.x),
    y0 = c.top + top,
    y1 = c.top + bottom;
  if (x1 - x0 < 40) return null;
  return { left: x0, top: y0, right: x1, bottom: y1, width: x1 - x0, height: y1 - y0 };
}
function onboardingSheetOpen() {
  const sheet = $('buildingSheet');
  return openSheetIndex === 0 && sheet && !sheet.classList.contains('hidden');
}
// the next useful chain action while the player saves Credits (sell what lies in the depot, cart what lies on the Halde)
function onboardingChainTarget() {
  const colony = colonyAt(),
    depot = state.planetOps.storage[state.activePlanet] || 0;
  if (depot >= 1) return 'sellButton';
  if (colony.stock.pile >= 1 && !colony.trip) return 'cartButton';
  return 'collectButton';
}
// { step, title, text, target: element | rect, button?: inline action }
function onboardingHint() {
  const step = onboardingStep();
  if (!step) return null;
  const o = onboardingState();
  if (o.hidden && step !== 'celebrate') return null;
  if (topModal() || document.body.classList.contains('home-sheet-open')) return null;
  // a building panel the player opened out of curiosity: the hint steps back (it never covers the panel's buttons);
  // only the hints about the Kristallmine's own panel stay
  const panel = $('buildingSheet');
  if (panel && !panel.classList.contains('hidden') && !((step === 'upgrade' || step === 'manager' || step === 'celebrate') && openSheetIndex === 0)) return null;
  const n = Math.min(ONBOARDING_STEPS.length, ONBOARDING_STEPS.indexOf(step) + 1),
    kicker = step === 'celebrate' ? 'Erste Schritte geschafft' : 'Erste Schritte · ' + n + '/' + ONBOARDING_STEPS.length;
  // away from the colony: the way back first
  if (currentScreen() !== 'home' || state.activePlanet !== 0 || (typeof mineView !== 'undefined' && mineView))
    return { step, kicker, title: 'Zurück zur Kolonie', text: 'Dort geht es mit den ersten Schritten weiter.', target: document.querySelector('.bottom-nav [data-screen="home"]'), back: true };
  const [title, text] = ONBOARDING_TEXT[step] || ['', ''];
  if (step === 'mine' || step === 'rail' || step === 'celebrate') return { step, kicker, title, text, target: $(step === 'rail' ? 'cartButton' : 'collectButton') };
  if (step === 'stall') {
    const traveling = Boolean(colonyAt().trip) && (state.planetOps.storage[state.activePlanet] || 0) < 1;
    return { step, kicker, title, text: traveling ? 'Die Lore ist unterwegs – gleich liegt die Ladung im Lager.' : text, target: $('sellButton') };
  }
  if (step === 'upgrade') {
    if (onboardingSheetOpen()) return { step, kicker, title: ONBOARDING_TEXT.upgradeBuy[0], text: ONBOARDING_TEXT.upgradeBuy[1], target: document.querySelector('#buildingSheet [data-buy="0"]') };
    return { step, kicker, title, text, target: onboardingMineRect(), ringTap: 'open-mine', button: { label: 'Kristallmine öffnen', action: 'open-mine' } };
  }
  // manager
  const price = hireCost('mine');
  if (state.credits < price) {
    const missing = Math.ceil(price - state.credits);
    return { step, kicker, title: ONBOARDING_TEXT.managerSave[0], text: 'Noch ◈ ' + fmt(missing) + ' für die Bergbau-Katze (◈ ' + fmt(price) + '). Verkaufe weitere Kristalle.', target: $(onboardingChainTarget()) };
  }
  if (onboardingSheetOpen()) return { step, kicker, title: 'EINSTELLEN', text: text, target: document.querySelector('#buildingSheet [data-hire="mine"]') };
  return { step, kicker, title, text: 'Tippe auf die Kristallmine – ' + text.toLowerCase(), target: onboardingMineRect(), ringTap: 'open-mine', button: { label: 'Kristallmine öffnen', action: 'open-mine' } };
}

// ----- the coach: Mochi's bubble and a ring around the target -----
(function buildCoach() {
  if ($('coach')) return;
  const coach = document.createElement('div');
  coach.id = 'coach';
  coach.className = 'coach hidden';
  coach.innerHTML =
    '<i class="coach-ring" id="coachRing" aria-hidden="true"></i><div class="coach-bubble" id="coachBubble" role="status" aria-live="polite"><span class="coach-face" id="coachFace" aria-hidden="true"></span><div class="coach-copy"><small id="coachKicker"></small><b id="coachTitle"></b><p id="coachText"></p><button class="coach-action hidden" id="coachAction" type="button"></button></div><button class="coach-close" id="coachClose" type="button" aria-label="Hinweise ausblenden (unter ☰ → Hilfe wieder einschalten)">×</button><i class="coach-arrow" id="coachArrow" aria-hidden="true"></i></div>';
  document.body.append(coach);
})();
// the elements marked as the hint's target (only this file marks them; render() clears them without a document query)
const onboardingMarked = new Set();
function onboardingTargetRect(hint) {
  const t = hint?.target;
  if (!t) return null;
  if (t instanceof Element) {
    t.classList.add('coach-target');
    onboardingMarked.add(t);
    return onboardingVisible(t);
  }
  return t;
}
function onboardingPlace(hint) {
  const coach = $('coach'),
    bubble = $('coachBubble'),
    ring = $('coachRing'),
    arrow = $('coachArrow');
  const r = onboardingTargetRect(hint);
  const vw = innerWidth,
    vh = innerHeight,
    margin = 8;
  ring.hidden = !r;
  ring.classList.toggle('tappable', Boolean(r && hint.ringTap));
  if (hint.ringTap) {
    ring.setAttribute('role', 'button');
    ring.setAttribute('aria-label', 'Kristallmine öffnen');
  } else {
    ring.removeAttribute('role');
    ring.removeAttribute('aria-label');
  }
  const bw = Math.min(300, vw - margin * 2),
    bh = bubble.offsetHeight || 90;
  bubble.style.width = bw + 'px';
  let left, top, below;
  if (r) {
    ring.style.transform = `translate(${Math.round(r.left - 6)}px, ${Math.round(r.top - 6)}px)`;
    ring.style.width = Math.round(r.width + 12) + 'px';
    ring.style.height = Math.round(r.height + 12) + 'px';
    const cx = r.left + r.width / 2;
    // above the target when there is room (the dock buttons sit low), else below; a button inside a panel gets the
    // bubble below it, so the panel's own text stays readable
    const inPanel = hint.target instanceof Element && Boolean(hint.target.closest('#buildingSheet, .home-sheet'));
    const roomAbove = r.top - bh - 18 >= margin,
      roomBelow = r.bottom + bh + 18 <= vh - margin;
    // a button in the dock column (phones in landscape): beside it, so the other dock buttons stay free
    const dock = hint.target instanceof Element ? hint.target.closest('.action-dock') : null,
      dr = dock?.getBoundingClientRect(),
      column = dr && dr.height > dr.width && r.left - bw - 14 >= margin;
    if (column || (!roomAbove && !roomBelow && (r.right + bw + 14 <= vw - margin || r.left - bw - 14 >= margin))) {
      // a tall target (the headframe in landscape): the bubble goes beside it
      left = !column && r.right + bw + 14 <= vw - margin ? r.right + 14 : (column ? dr.left : r.left) - bw - 14;
      top = Math.max(margin, Math.min(vh - bh - margin, r.top + r.height / 2 - bh / 2));
      arrow.hidden = true;
    } else {
      below = (inPanel && roomBelow) || !roomAbove;
      top = below ? r.bottom + 14 : r.top - bh - 14;
      // never on top of the scene tools (📋 Details stays tappable during the first steps): above them instead
      const bar = !below ? document.querySelector('#sceneBar .scene-tools') : null,
        br = bar && bar.getClientRects().length ? bar.getBoundingClientRect() : null;
      if (br && br.height && top < br.bottom && top + bh > br.top && br.top - bh - 8 >= margin) top = br.top - bh - 8;
      left = Math.max(margin, Math.min(vw - bw - margin, cx - bw / 2));
      top = Math.max(margin, Math.min(vh - bh - margin, top));
      arrow.hidden = false;
      arrow.className = 'coach-arrow ' + (below ? 'up' : 'down');
      arrow.style.left = Math.round(Math.max(16, Math.min(bw - 16, cx - left))) + 'px';
    }
  } else {
    // no visible target (the building is off screen): the bubble sits in the sky with its own button
    left = (vw - bw) / 2;
    top = Math.max(margin, (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--w-hud')) || 60) + 60);
    arrow.hidden = true;
  }
  bubble.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  coach.classList.toggle('coach-below', Boolean(below));
}
function onboardingLoop() {
  onboardingRaf = 0;
  const coach = $('coach');
  if (!coach || coach.classList.contains('hidden')) return;
  const hint = onboardingHint();
  // a panel opened or closed between two renders (the building sheet renders on its own): refresh the text at once
  if (!hint || hint.step + '|' + hint.title + '|' + hint.text !== onboardingLastKey) return renderOnboarding();
  onboardingPlace(hint);
  onboardingRaf = requestAnimationFrame(onboardingLoop);
}
function renderOnboarding() {
  const coach = $('coach');
  if (!coach) return;
  const active = onboardingActive(),
    step = active ? onboardingStep() : null;
  document.body.classList.toggle('ob-active', Boolean(step));
  document.body.dataset.obStep = step || '';
  for (const el of onboardingMarked) el.classList.remove('coach-target');
  onboardingMarked.clear();
  // the hints about the Kristallmine bring it into view once (a gentle camera pan; the player can drag away freely)
  if ((step === 'upgrade' || step === 'manager') && onboardingFocusedStep !== step && currentScreen() === 'home') {
    const scene = window.NebulaScenesRuntime?.mounted?.colony?.scene;
    if (scene?.plotX && scene.focusOn) {
      onboardingFocusedStep = step;
      scene.focusOn(scene.plotX('mine'));
    }
  }
  const hint = step ? onboardingHint() : null;
  if (!hint) {
    coach.classList.add('hidden');
    return;
  }
  const key = hint.step + '|' + hint.title + '|' + hint.text;
  if (key !== onboardingLastKey) {
    onboardingLastKey = key;
    // a button inside a panel that is scrolled out of view: bring it in once (never again while the hint stays)
    if (hint.target instanceof Element && hint.target.closest('#buildingSheet')) {
      const t = hint.target.getBoundingClientRect(),
        p = hint.target.closest('#buildingSheet').getBoundingClientRect();
      if (t.bottom > p.bottom || t.top < p.top) hint.target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    $('coachKicker').textContent = hint.kicker;
    $('coachTitle').textContent = hint.title;
    $('coachText').textContent = hint.text;
    $('coachText').hidden = !hint.text;
    const face = kitPortraitURL('mochi', hint.step === 'celebrate' ? 'happy' : 'neutral', 96);
    $('coachFace').innerHTML = face ? `<img src="${face}" alt="" />` : '🐾';
  }
  const action = $('coachAction');
  action.classList.toggle('hidden', !hint.button);
  if (hint.button) {
    action.textContent = hint.button.label;
    action.dataset.coachAction = hint.button.action;
  }
  $('coachClose').hidden = hint.step === 'celebrate';
  coach.dataset.step = hint.step;
  coach.classList.remove('hidden');
  onboardingPlace(hint);
  if (!onboardingRaf && typeof requestAnimationFrame === 'function') onboardingRaf = requestAnimationFrame(onboardingLoop);
}
document.addEventListener('click', event => {
  if (event.target.closest('#coachClose')) {
    onboardingState().hidden = true;
    render();
    toast('Hinweise ausgeblendet – ☰ → Hilfe schaltet sie wieder ein.');
    return;
  }
  const action = event.target.closest('#coachAction, #coachRing.tappable');
  if (action && (action.id === 'coachRing' || action.dataset.coachAction === 'open-mine')) {
    const scene = window.NebulaScenesRuntime?.mounted?.colony?.scene;
    if (scene?.plotX && scene.focusOn) scene.focusOn(scene.plotX('mine'));
    openBuildingSheet(0);
    render();
  }
});
// a tap anywhere after the celebration has been seen ends it (no waiting)
document.addEventListener(
  'pointerdown',
  () => {
    if (onboardingStep() === 'celebrate' && Date.now() > onboardingCelebrateUntil - 5500) {
      onboardingCelebrateUntil = 0;
      setTimeout(render, 0);
    }
  },
  { capture: true, passive: true }
);
addEventListener('resize', () => renderOnboarding());

// ----- one instruction at a time: the next-step card and the story bubbles wait during the first steps -----
const renderObjectiveBeforeOnboarding = renderObjective;
renderObjective = function () {
  renderObjectiveBeforeOnboarding();
  const step = onboardingStep();
  if (!step || step === 'celebrate') return;
  const [title, text] = ONBOARDING_TEXT[step];
  $('objectiveIcon').textContent = { mine: '⛏', rail: '🛒', stall: '◈', upgrade: '⬆', manager: '🐾' }[step];
  $('objectiveTitle').textContent = 'Erste Schritte · ' + (ONBOARDING_STEPS.indexOf(step) + 1) + '/5 ' + ONBOARDING_TITLES[step];
  $('objectiveText').textContent = title + ' – ' + text;
  $('objectiveAction').textContent = step === 'upgrade' || step === 'manager' ? 'KRISTALLMINE ›' : title.split(' ').pop() + ' ›';
  const card = $('objectiveCard');
  card.dataset.screen = 'home';
  card.dataset.sheet = step === 'upgrade' || step === 'manager' ? '0' : '';
  document.body.dataset.nextStep = step;
};
const showNextStoryLineBeforeOnboarding = showNextStoryLine;
showNextStoryLine = function () {
  if (onboardingActive() && storyQueue.length) {
    $('storyBubble')?.classList.add('hidden');
    return;
  }
  showNextStoryLineBeforeOnboarding();
};

// ----- help: the chain, where things are, the hints on and off -----
(function buildHelp() {
  if ($('helpModal')) return;
  const modal = document.createElement('div');
  modal.className = 'modal hidden';
  modal.id = 'helpModal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'helpTitle');
  modal.innerHTML = '<div class="modal-box help-box"><button class="modal-close" data-close-modal="helpModal" aria-label="Schließen">×</button><span>HILFE</span><h2 id="helpTitle">So läuft deine Kolonie</h2><div id="helpBody"></div></div>';
  document.body.append(modal);
})();
function renderHelp() {
  const o = onboardingState(),
    learned = onboardingLearned(),
    steps = [
      ['mine', '⛏', 'ABBAUEN', 'Kätzchen schlagen Kristalle aus dem Feld. Sie landen auf der Halde.'],
      ['rail', '🛒', 'LORE', 'Die Lore fährt die Kristalle von der Halde ins Lager.'],
      ['stall', '◈', 'VERKAUF', 'Der Verkauf macht aus dem Lager Credits ◈ – damit bezahlst du alles.'],
      ['upgrade', '⬆', 'Upgrades', 'Tippe ein Gebäude in der Welt an: Stufe, nächster Effekt, Preis.'],
      ['manager', '🐾', 'Manager', 'Eine Katze pro Station übernimmt die Arbeit. Mit Katzen an allen drei Stationen läuft die Kette von selbst – auch offline.']
    ];
  const places = [
    ['⌂ Kolonie', 'Deine Welt. Ziehen bewegt die Ansicht, Antippen öffnet ein Gebäude.'],
    ['📋 Details', 'Aufträge, Planeten und alle Gebäude als Liste – in der Kolonie unten in der Werkzeugleiste.'],
    ['⛏ Mine', 'Die Schächte unter der Kolonie, sobald du sie gebaut hast.'],
    ['⇄ Galaxie', 'Planeten, Handel, Fracht und Aufträge.'],
    ['⚔ Abenteuer', 'Dein Schiff, der Feldzug und die nächste Mission.'],
    ['☰ Mehr', 'Shop, Looks, Einstellungen, Hilfe und Version.']
  ];
  const hintsState = o.done
    ? '<p class="help-note">✓ Die ersten Schritte hast du geschafft. Der Hinweis oben in der Kolonie zeigt immer den nächsten sinnvollen Schritt.</p>'
    : `<button class="help-toggle" data-help-hints="${o.hidden ? 'on' : 'off'}">${o.hidden ? 'Hinweise wieder einblenden' : 'Hinweise ausblenden'}</button>`;
  setHTML(
    $('helpBody'),
    `<h3>Die Kette</h3><ol class="help-steps">${steps.map(([id, icon, name, text]) => `<li class="${learned[id] ? 'learned' : ''}"><i aria-hidden="true">${icon}</i><span><b>${name}</b><small>${text}</small></span>${learned[id] ? '<em aria-label="geschafft">✓</em>' : ''}</li>`).join('')}</ol>${hintsState}<h3>Wo finde ich was?</h3><dl class="help-places">${places.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl><h3>Kapitel 1</h3>${(typeof intro !== 'undefined' ? intro : []).map(([t, x]) => `<p class="help-story"><b>${t}</b> ${x}</p>`).join('')}`
  );
}
document.addEventListener('click', event => {
  const t = event.target.closest('[data-help-hints]');
  if (!t) return;
  onboardingState().hidden = t.dataset.helpHints === 'off';
  onboardingLastKey = '';
  renderHelp();
  render();
});

// ----- info: which build runs where (local / test build / live Friends Beta) -----
function buildChannel() {
  const config = window.NEBULA_CONFIG || {},
    host = location.hostname,
    local = ['localhost', '127.0.0.1', '[::1]', ''].includes(host) || host.endsWith('.localhost') || location.protocol === 'file:';
  if (config.channel === 'friends-beta') return local ? { id: 'test-build', label: 'Friends-Beta-Testbuild (lokal)' } : { id: 'live', label: 'Friends Beta (live) · ' + host };
  if (config.build === 'release') return { id: 'release', label: local ? 'Release-Build (lokal)' : 'Release-Build · ' + host };
  return { id: 'dev', label: local ? 'Entwicklung (lokal, ungebaut)' : 'Entwicklung · ' + host };
}
(function buildInfo() {
  if ($('infoModal')) return;
  const modal = document.createElement('div');
  modal.className = 'modal hidden';
  modal.id = 'infoModal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'infoTitle');
  modal.innerHTML = '<div class="modal-box help-box"><button class="modal-close" data-close-modal="infoModal" aria-label="Schließen">×</button><span>INFO</span><h2 id="infoTitle">Version und Spielstand</h2><div id="infoBody"></div></div>';
  document.body.append(modal);
})();
function renderInfo() {
  const config = window.NEBULA_CONFIG || {},
    channel = buildChannel(),
    profile = window.NebulaSave?.profile || '',
    built = config.buildDate ? new Date(config.buildDate) : null,
    rows = [
      ['Kanal', channel.label],
      ['Version', 'v' + (config.version || '?')],
      ['Build', config.commitShort ? config.commitShort + (built && !Number.isNaN(built.getTime()) ? ' · ' + built.toISOString().slice(0, 10) : '') : 'ohne Build-Kennung (direkt aus dem Quellcode)'],
      ['Spielstand', profile === 'test' ? 'Testprofil (getrennt vom normalen Spielstand)' : 'Normaler Spielstand dieses Browsers'],
      ['Gespeichert unter', window.NebulaSave?.PRIMARY || 'nebula-harvest-save']
    ];
  const base = location.pathname + location.hash;
  setHTML(
    $('infoBody'),
    `<dl class="help-places info-rows">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
    <h3>Testprofil</h3><p class="help-note">Ein Testprofil ist ein zweiter, getrennter Spielstand in diesem Browser – zum Ausprobieren eines frischen Starts, ohne den normalen Spielstand anzurühren.</p>
    ${profile === 'test'
      ? `<a class="help-toggle" href="${base}">Zum normalen Spielstand wechseln</a><button class="help-toggle danger" data-test-profile-reset>Testprofil neu beginnen</button>`
      : `<a class="help-toggle" href="${base}?profil=test">Testprofil öffnen (frischer Start)</a>`}`
  );
}
document.addEventListener('click', event => {
  if (!event.target.closest('[data-test-profile-reset]')) return;
  askConfirm('TESTPROFIL', 'Testprofil neu beginnen?', 'Nur das Testprofil wird gelöscht. Dein normaler Spielstand bleibt unverändert.', 'NEU BEGINNEN', () => {
    window.NebulaSave?.clearProfile?.();
    location.reload();
  });
});

// ----- ☰: Hilfe first, Info last -----
const menuEntriesBeforeOnboarding = menuEntries;
menuEntries = () => [
  { id: 'help', icon: '?', title: 'Hilfe', text: 'So läuft deine Kolonie · wo finde ich was · Hinweise' },
  ...menuEntriesBeforeOnboarding(),
  { id: 'info', icon: 'ⓘ', title: 'Info', text: buildChannel().label + ' · v' + ((window.NEBULA_CONFIG || {}).version || '?') }
];
document.addEventListener('click', event => {
  const entry = event.target.closest('[data-menu="help"], [data-menu="info"]');
  if (!entry) return;
  if (entry.dataset.menu === 'help') {
    renderHelp();
    openModal('helpModal');
  } else {
    renderInfo();
    openModal('infoModal');
  }
});

// a visible badge while the test profile is open (so a screenshot or a report says which save it was)
if (window.NebulaSave?.profile === 'test') {
  document.body.classList.add('test-profile');
  const badge = document.createElement('div');
  badge.className = 'test-profile-badge';
  badge.textContent = 'TESTPROFIL';
  document.body.append(badge);
}

const renderBeforeOnboarding = render;
render = () => {
  renderBeforeOnboarding();
  renderOnboarding();
};
