// P1.5 — short story beats on the existing structures (STORY lines, the story bubble, the reveal card; nothing new to
// learn, nothing that blocks):
//   look lore     a guardian says one line on the reveal card when its look is granted (LOOK_LORE)
//   automation    a crew line when the ship learns a step of its automation (combat-step-<id>; new saves only – a
//                 save from before P1.5 had all of it already)
//   decorations   a resident of the planet comments on the first decoration set up there (decor-<planet>)
// Loaded after collection.js, combat-control.js and combat-tutorial.js.

// [speaker, line] – the speakers of the story bubble (crew, guardians, residents)
const LOOK_LORE = {
  'decal-pips': ['P.I.P.S.', 'Inspektion bestanden. Bitte gut sichtbar anbringen!'],
  'impact-frost': ['Frostbyte', 'Meine Splitter … sie sollen jetzt dich beschützen.'],
  'acc-ember-bell': ['Emberbell', 'Wenn es bimmelt, ist der Druck sicher. Versprochen!'],
  'engine-clockwork': ['Cogsworth-9', 'Takt gehalten. Diese Zahnräder sind dein Prüfstempel.'],
  'acc-petal-crown': ['Petalguard', 'Meine Blüten gehören jetzt auch dir. Gib gut auf sie acht.'],
  'frame-aurora': ['Flocke', 'Das Polarlicht über Glacies – jetzt auch um dein Bild!'],
  'frame-ember': ['Funke', 'Ein Rahmen aus echtem Basalt. Vorsicht, noch warm!'],
  'frame-gear': ['Cogsworth-9', 'Ein Zahnkranz, der niemals aus dem Takt gerät. Wie du.'],
  'decor-bloomarch': ['Petalguard', 'Ein Bogen aus meinen Rosen. Er blüht, wo du zu Hause bist.'],
  'frame-guardian': ['Mochi', 'Alle fünf Wächter – und alle sind jetzt unsere Freunde.']
};
if (typeof STORY !== 'undefined')
  Object.assign(STORY, {
    // the ship learns its automation, one step at a time (COMBAT_STEPS)
    'combat-step-lane': { title: 'Kurs halten', lines: [['tikki', 'Ich hab dem Schiff „Kurs halten“ beigebracht: Es folgt jetzt selbst der Bahn seines Ziels. Lenken darfst du trotzdem jederzeit!']] },
    'combat-step-aim1': { title: 'Zielhilfe 1', lines: [['boba', 'Zielhilfe 1 ist eingebaut: Die Kanonen drehen ein kleines Stück mit – zehn Grad, mehr nicht. Zielen bleibt deine Sache.']] },
    'combat-step-zones': { title: 'Wächter lesen', lines: [['void', 'Ich habe die Wächter-Angriffe ins Bordbuch geschrieben. Das Schiff findet jetzt selbst die sichere Stelle – wenn du es lässt.']] },
    'combat-step-aim2': { title: 'Zielhilfe 2', lines: [['pips', 'Meine Prüfoptik, frisch kalibriert: zwanzig Grad, und sie zielt vor bewegte Gegner. Bitte sorgsam behandeln!']] },
    'combat-step-dodge': { title: 'Ausweichen', lines: [['tikki', 'Der Ausweich-Assistent ist fertig! Ein kleiner Reflex weg von Schüssen, die gleich treffen.']] },
    'combat-step-aim3': { title: 'Zielhilfe 3', lines: [['frostbyte', 'Meine Kristalllinse sieht das ganze Feld. Wenn du willst, zielen deine Kanonen jetzt ganz allein.']] },
    // the first decoration on each planet: a resident notices it
    'decor-crystal': { title: 'Ein Platz zum Verweilen', lines: [['mochi', 'Eine Deko vor der Hütte! Jetzt fühlt sich Orion richtig nach Zuhause an.']] },
    'decor-ice': { title: 'Glacies wird gemütlich', lines: [['flocke', 'Hübsch! Und wenn das Wärmenetz läuft, friert sie auch nicht ein.']] },
    'decor-volcanic': { title: 'Ein Hauch Kühle', lines: [['funke', 'Das dampft ja fast so schön wie unsere Glutschmelze!']] },
    'decor-machine': { title: 'Nicht genormt', lines: [['werk', 'Hinweis: Dekoration nicht in Norm 9 verzeichnet. … Sie wird trotzdem geduldet.']] },
    'decor-verdant': { title: 'Es grünt', lines: [['wurzel', 'Die Wurzeln flüstern … sie mögen es, wenn jemand Schönes pflanzt.']] }
  });

// ----- look lore on the reveal card -----
{
  const showNextRevealBeforeLore = showNextReveal;
  showNextReveal = () => {
    showNextRevealBeforeLore();
    const card = $('cosmeticReveal');
    if (!card || card.classList.contains('hidden')) return;
    // the guardian's line takes the place of the small reason line (the card keeps its size: it never covers more of
    // the colony than before)
    const why = $('cosmeticRevealWhy'),
      lore = LOOK_LORE[card.dataset.look];
    if (!why) return;
    why.classList.toggle('cr-quote', Boolean(lore));
    if (lore) why.textContent = lore[0] + ': „' + lore[1] + '“';
  };
}

// ----- the ship learns its automation: a line when a step is earned (new saves only) -----
function combatStepsNoticed() {
  const s = combatSettings();
  if (s.legacy || !state.introSeen) return;
  for (const step of COMBAT_STEPS) {
    const id = 'combat-step-' + step.id;
    if (state.meta.story.journal.includes(id)) continue;
    let done = false;
    try {
      done = step.done();
    } catch (e) {
      done = false;
    }
    if (!done) continue;
    storyEvent(id);
    toast('🛠 Neu in der Steuerung: ' + step.name);
  }
}
// the first decoration set up on a planet (any equip path: decorSync stores it in meta.decor)
function decorNoticed() {
  const cur = state.activePlanet,
    id = 'decor-' + (PLANETS[cur]?.id || '');
  if (state.meta.decor?.[cur] && STORY[id] && !state.meta.story.journal.includes(id) && typeof currentScreen === 'function' && currentScreen() === 'home') storyEvent(id);
}
{
  const renderBeforeLore = render;
  render = function (...args) {
    const out = renderBeforeLore.apply(this, args);
    // never while an expedition is open (the story bubble pauses the arena): the line waits until the player is back
    if (!(typeof arenaActive === 'function' && arenaActive()) && !(typeof expedition !== 'undefined' && expedition.state !== 'closed') && !(typeof onboardingActive === 'function' && onboardingActive())) {
      combatStepsNoticed();
      decorNoticed();
    }
    return out;
  };
}
