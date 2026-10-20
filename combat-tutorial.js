// P1.5 — the combat tutorial: Boba coaches a new pilot through the first fights, one step at a time, by what the player
// really does (no scripted fight, no pause, no hidden help):
//   move      wipe on the field – the ship follows (done: the player steered)
//   straight  the guns shoot straight ahead along the dashed line (done: a shot went by / a miss puffed)
//   hit       bring an enemy in front of the nose (done: a shot of the ship hit)
//   dodge     change lanes away from a shot (done: a shot that would have hit flew past)
//   shield    the Schildpuls catches a shot (done: the shield was used)
//   fire      Auto-Fire vs FEUER halten (done: tapped "Verstanden" or switched the mode)
//   auto      automation is earned by playing; where to switch it (done: "Los geht's")
// Each step has WEITER (if the fight does not give the moment) and the whole tutorial has ÜBERSPRINGEN. The step reached
// is saved (meta.combat.tutorial): a fight left early resumes there. Saves from before P1.5 never see it (combatSettings
// marks them 'done'); the prep's Steuerung section can start it again. Loaded after combat-control.js.

const COMBAT_TUTORIAL = [
  { id: 'move', title: 'Fliegen', text: 'Wische irgendwo auf dem Feld nach oben oder unten – dein Schiff folgt deinem Finger.' },
  { id: 'straight', title: 'Geradeaus schießen', text: 'Deine Kanonen schießen nur geradeaus, entlang der gestrichelten Linie. Was daneben geht, verpufft grau.' },
  { id: 'hit', title: 'Treffen', text: 'Bring einen Gegner vor den Bug: Flieg auf seine Höhe – dann trifft jeder Schuss.' },
  { id: 'dodge', title: 'Ausweichen', text: 'Ein Schuss kommt auf dich zu? Wechsle die Bahn, bevor er dich erreicht.' },
  { id: 'shield', title: 'Schildpuls', text: 'Zu knapp zum Ausweichen? Tippe 🛡 Schild – er fängt Schüsse für einen Moment ab.' },
  { id: 'fire', title: 'Auto-Fire', text: 'Dein Schiff feuert gerade von selbst (Auto-Fire). Oben neben ⏸ schaltet 🔫 zwischen AUTO und HAND – dann hältst du FEUER selbst.' },
  { id: 'auto', title: 'Automatik verdienen', text: 'Kurs halten, Zielhilfe, Ausweichen: Das lernt dein Schiff mit jedem Erfolg dazu. Du schaltest es in der Vorbereitung unter „Steuerung“.' }
];
const COMBAT_TUTORIAL_IDS = COMBAT_TUTORIAL.map(s => s.id);
// what the coach watches during the current step (reset per fight and per step)
const coach = { step: null, fight: null, startY: null, threats: new Map(), hurtSeq: 0, seen: 0, fireMode: null };

function combatTutorialStep() {
  const s = combatSettings();
  if (s.tutorial === 'done' || s.tutorial === 'skipped') return null;
  return COMBAT_TUTORIAL_IDS.includes(s.tutorial) ? s.tutorial : 'move';
}
function combatTutorialAdvance(from) {
  const s = combatSettings(),
    i = COMBAT_TUTORIAL_IDS.indexOf(from);
  if (combatTutorialStep() !== from) return;
  s.tutorial = i >= 0 && i < COMBAT_TUTORIAL_IDS.length - 1 ? COMBAT_TUTORIAL_IDS[i + 1] : 'done';
  coach.step = null;
  feedback('unlock', 'light');
  requestSave(300);
  if (s.tutorial === 'done' && typeof toast === 'function') toast('🎓 Kampf-Training geschafft – viel Glück da draußen!');
  combatCoachRender();
}
function combatTutorialSkip() {
  combatSettings().tutorial = 'skipped';
  coach.step = null;
  requestSave(300);
  combatCoachRender();
}
// watched once per frame (arenaReact): the step is done by what really happened in the fight
function combatTutorialWatch(a) {
  const step = combatTutorialStep();
  if (!step || !a || a.result) return;
  if (coach.fight !== a || coach.step !== step) {
    Object.assign(coach, { fight: a, step, startY: a.manual ? a.manualY : a.ship.y, seen: a.eventSeq || 0, fireMode: arenaControlOf(a).fire });
    coach.threats.clear();
    combatCoachRender();
  }
  const fresh = a.events.filter(e => e.seq > coach.seen);
  coach.seen = a.eventSeq || coach.seen;
  const ship = a.ship;
  if (step === 'move' && a.manual && Math.abs(a.manualY - coach.startY) > 6) return combatTutorialAdvance('move');
  if (step === 'straight' && (fresh.some(e => e.type === 'miss') || (a.stats.proj || 0) >= 6)) return combatTutorialAdvance('straight');
  if (step === 'hit' && fresh.some(e => e.type === 'hit' && e.source === 'ship')) return combatTutorialAdvance('hit');
  if (step === 'dodge') {
    if (fresh.some(e => e.type === 'ship-hit')) coach.threats.clear();
    // a straight shot on course for the ship (within 1.2 s) is a threat; once it is past the ship unharmed, dodged
    for (const s of a.foeShots) {
      if (s.lob || !(s.vx < 0) || s.x < ship.x) continue;
      const t = (s.x - ship.x) / -s.vx,
        y = s.y + s.vy * t;
      if (t < 1.2 && Math.abs(y - ship.y) < s.r + ARENA.SHIP_R + 1 && !coach.threats.has(s.id)) coach.threats.set(s.id, ship.y);
    }
    for (const [id, y0] of coach.threats) {
      const s = a.foeShots.find(q => q.id === id);
      if (!s || s.x < ship.x - 4) {
        coach.threats.delete(id);
        if (Math.abs(ship.y - y0) > 3 && !fresh.some(e => e.type === 'ship-hit')) return combatTutorialAdvance('dodge');
      }
    }
  }
  if (step === 'shield' && a.t < ship.shieldUntil) return combatTutorialAdvance('shield');
  if (step === 'fire' && arenaControlOf(a).fire !== coach.fireMode) return combatTutorialAdvance('fire');
}

// ----- the coach card on the field (top of the stage; touches pass through to the field, its buttons take them) -----
function combatCoachRender() {
  const stage = $('expStage');
  if (!stage) return;
  let card = $('combatCoach');
  const step = typeof arenaRun !== 'undefined' && arenaRun && !arenaRun.result && expedition.state === 'fight' ? combatTutorialStep() : null;
  stage.closest('.exp-fight')?.classList.toggle('coaching', Boolean(step));
  if (!step) {
    card?.remove();
    return;
  }
  if (!card) {
    card = document.createElement('div');
    card.id = 'combatCoach';
    card.className = 'combat-coach';
    card.setAttribute('role', 'status');
    card.setAttribute('aria-live', 'polite');
    stage.append(card);
  }
  if (card.dataset.step === step) return;
  card.dataset.step = step;
  const i = COMBAT_TUTORIAL_IDS.indexOf(step),
    def = COMBAT_TUTORIAL[i],
    portrait = typeof kitPortraitURL === 'function' ? kitPortraitURL('boba', 'happy', 64) : '',
    last = i === COMBAT_TUTORIAL.length - 1;
  setHTML(
    card,
    `${portrait ? `<img src="${portrait}" alt="" />` : ''}<div><small>Boba · Training ${i + 1}/${COMBAT_TUTORIAL.length}</small><b>${def.title}</b><p>${def.text}</p></div><div class="coach-actions"><button data-coach-next="${step}">${last ? 'LOS GEHT’S' : step === 'fire' ? 'VERSTANDEN' : 'WEITER ›'}</button>${last ? '' : '<button class="secondary" data-coach-skip>ÜBERSPRINGEN</button>'}</div>`
  );
}
document.addEventListener('click', event => {
  const next = event.target.closest('[data-coach-next]');
  if (next) return combatTutorialAdvance(next.dataset.coachNext);
  if (event.target.closest('[data-coach-skip]')) return combatTutorialSkip();
  if (event.target.closest('[data-combat-tutorial-again]')) {
    combatSettings().tutorial = '';
    requestSave(300);
    toast('🎓 Das Kampf-Training startet in deinem nächsten Kampf');
    renderExpeditionPrep();
  }
});
{
  const arenaReactBeforeCoach = arenaReact;
  arenaReact = () => {
    arenaReactBeforeCoach();
    if (arenaRun && expedition.state === 'fight') {
      combatTutorialWatch(arenaRun);
      combatCoachRender();
    } else combatCoachRender();
  };
  // a fight that ends takes the card with it (the step reached stays saved)
  const arenaFinishBeforeCoach = arenaFinish;
  arenaFinish = (...args) => {
    const out = arenaFinishBeforeCoach(...args);
    $('combatCoach')?.remove();
    return out;
  };
  // the prep: start the training again (only once it is done or skipped)
  const combatControlHTMLBeforeCoach = combatControlHTML;
  combatControlHTML = () => {
    const html = combatControlHTMLBeforeCoach(),
      step = combatTutorialStep();
    const line = step
      ? `<p class="exp-note">🎓 Kampf-Training: Schritt ${COMBAT_TUTORIAL_IDS.indexOf(step) + 1} von ${COMBAT_TUTORIAL.length} – Boba erklärt im nächsten Kampf weiter.</p>`
      : `<button class="exp-secondary exp-tutorial-again" data-combat-tutorial-again>🎓 Kampf-Training wiederholen</button>`;
    return html.replace(/<\/section>$/, line + '</section>');
  };
}
