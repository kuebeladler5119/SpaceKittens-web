// Beta 1.6 M3 — the outer campaigns in the expedition layer: Pyra-9 (Die Glutwacht → Emberbell), Mekhanos (Das Taktband
// → Cogsworth-9), Viridia (Die Blütenwacht → Petalguard). Prep texts, story beats, the story cards while a campaign runs,
// the fight HUD's guardian status, the sync for older saves. Logic: outer-campaigns.js. Loaded after expedition-ui.js.
// Nothing here grants anything: waves pay through the campaign ledger, guardians through their own defeat function.

Object.assign(EXP_PLANET_NAME, { volcanic: 'Pyra-9', machine: 'Mekhanos', verdant: 'Viridia' });
Object.assign(EXP_FACTION, {
  volcanic: { name: 'Glutwacht', text: 'Emberbells Hitzedrohnen halten die Kühlklappen zu: Funkenschwärme, Schlackenwerfer (Artillerie mit markiertem Einschlag), gepanzerte Ofenpanzer, Blasebälge, die ihre Freunde mit einem Hitzeschild anfachen, und Essenwächter mit Glutschild. Dazu Glutgeister aus den alten Schmieden.' },
  machine: { name: 'Taktband', text: 'Cogsworths Fabrikinspektion im Gleichtakt: Nietenschwärme, Inspektor-Drohnen mit Doppelschuss, gepanzerte Stanzpressen, flinke Störsender (ihre Treffer verzögern Schild und Salve), Schildprojektoren mit Barrieren und Vorarbeiter, die Nieten nachrufen.' },
  verdant: { name: 'Blütenwacht', text: 'Petalguards Garten schützt das Wurzelnetz: Sporenwolken, Dornenranken mit Dreifachdornen, Rindenkolosse mit Borkenpanzer, Pollenpflegerinnen, die Verbündete heilen, Knospenrufer mit Samenkapseln und Blütenwächterinnen mit Blütenschild.' }
});
Object.assign(EXP_BOSS, {
  volcanic: {
    name: 'Emberbell',
    title: 'Wächter · Hüter der Kühlklappen',
    text: 'Sein Druck steigt ständig: solange hält sein Hitzeschild (nur 40 % Schaden), und er wirft gezielte Glut. Bei vollem Druck glühen die Ventile – dann kommt der Dampfstoß, eine Dampfwand über die ganze Arena, und eine laufende Salve verpufft. Danach kühlt er ab und steht offen. Ab halber Hülle regnet Magma auf markierte Stellen.',
    counter: 'Schildpuls genau beim Dampfstoß – eine Perfekte Parade wirft den Dampf zurück. Salve-Treffer heizen den Druck an, damit die Klappen früher öffnen. In der Kühlphase: 175 % Schaden.',
    reward: '6.000 ◈ · 6 Kristalle · 8 Gems · 1 Talent-Kapsel (einmalig)'
  },
  machine: {
    name: 'Cogsworth-9',
    title: 'Wächter · Taktmeister der Fabrik',
    text: 'Alles läuft im Takt seines Bandes: Prüfbolzen auf den Schlag, dann blinkt das Prüffenster und sein Gehäuse steht zwei Takte offen (180 %). Sonst hält sein Ordnungsschild (30 %). Auf Takt 7 kündigt eine rote Linie den Freigabelaser an. Ab halber Hülle wird das Band schneller, er ruft Drohnen und wirft Prüfkisten.',
    counter: 'Taktbruch: Ein Salve-Treffer im Prüffenster hält sein Gehäuse vier Takte offen. Schildpuls bei der roten Linie.',
    reward: '9.000 ◈ · 8 Kristalle · 10 Gems · 1 Talent-Kapsel (einmalig)'
  },
  verdant: {
    name: 'Petalguard',
    title: 'Wächterin · Herz des Gartens',
    text: 'In der Knospe schützen sie ihre Blätter (30 %) und sie schießt Dornenfächer. Eine rosa Linie kündigt den Pollensturm an – sieben langsame Pollenkugeln. Dann blüht sie auf (150 %). Am Ende jeder Blüte pflanzt sie Wurzelknoten, die sie alle 2 s heilen, solange sie stehen.',
    counter: 'Wurzelknoten antippen und kappen – oder die offene Blüte voll treffen. Salve-Treffer brennen durch die Blätter (90 %). Schildpuls beim Pollensturm.',
    reward: '15.000 ◈ · 10 Kristalle · 12 Gems · 1 Talent-Kapsel (einmalig)'
  }
});
Object.assign(EXP_GUARDIANS, {
  emberbell: { wait: 'drones', ready: ['drones', 'battle'], defeat: () => defeatEmberbell(), arrives: 'eb-arrives', story: 'eb-arena', phase2: 'eb-arena-phase2', after: 'Emberbell neu kalibrieren – Glutlegierung, Glutstein und Erz auf Pyra-9.', notYet: 'Emberbell stellt sich, sobald die Kühlkonsole in der Magmaspalte läuft (Glutlegierung).' },
  cogsworth: { wait: 'drones', ready: ['drones', 'battle'], defeat: () => defeatCogsworth(), arrives: 'cw-arrives', story: 'cw-arena', phase2: 'cw-arena-phase2', after: 'Cogsworth-9 neu kalibrieren – Präzisionsbauteile, Präzisionserz und Erz auf Mekhanos.', notYet: 'Cogsworth-9 stellt sich, sobald das Archiv mit Präzisionsbauteilen gefüllt ist.' },
  petalguard: { wait: 'thorns', ready: ['thorns', 'battle'], defeat: () => defeatPetalguard(), arrives: 'pg-arrives', story: 'pg-arena', phase2: 'pg-arena-phase2', after: 'Petalguard heilen – Biogel, Leuchtsporen und Erz auf Viridia.', notYet: 'Petalguard stellt sich, sobald der Wurzelknoten mit Biogel geheilt ist.' }
});

// ----- story beats (the drone-stage beats now point at the campaign) -----
if (typeof STORY !== 'undefined') {
  const lastLine = (id, line) => STORY[id]?.lines && (STORY[id].lines[STORY[id].lines.length - 1] = line);
  lastLine('eb-drones', ['mochi', 'Er will uns beschützen … aber so überhitzt alles. Sobald die Glutwacht durchbrochen ist, stellt er sich – Abenteuer-Tab, hier auf Pyra-9.']);
  lastLine('cw-drones', ['mochi', 'Cogsworth-9 will uns selbst prüfen. Sobald das Taktband durchbrochen ist, stellt er sich – Abenteuer-Tab, hier auf Mekhanos.']);
  lastLine('pg-thorns', ['mochi', 'Jetzt ist sie wach. Sobald die Blütenwacht durchbrochen ist, stellt sie sich – Abenteuer-Tab, hier auf Viridia.']);
  Object.assign(STORY, {
    'eb-arena': {
      title: 'Emberbell in der Arena',
      lines: [
        ['emberbell', 'DRUCK IST SICHER! Ich halte die Klappen zu, bis ihr geht!'],
        ['boba', 'Wenn seine Ventile glühen, kommt der Dampfstoß – Schild genau dann hoch, dann fliegt der Dampf zurück. Nach dem Stoß steht er offen.']
      ]
    },
    'eb-arena-phase2': { title: 'Magmaregen', lines: [['emberbell', 'Mehr Hitze! Funken, zu mir! Magma auf die Eindringlinge!']] },
    'cw-arena': {
      title: 'Cogsworth-9 in der Arena',
      lines: [
        ['cogsworth', 'Prüfung nach Norm 9. Bitte im Takt bleiben. Abweichungen werden protokolliert.'],
        ['void', 'Wenn das Prüffenster blinkt: Salve! Das bringt ihn aus dem Takt, und sein Gehäuse bleibt offen.']
      ]
    },
    'cw-arena-phase2': { title: 'Überstunden', lines: [['cogsworth', 'Taktband beschleunigt. Inspektor-Drohnen zur Nachprüfung!']] },
    'pg-arena': {
      title: 'Petalguard in der Arena',
      lines: [
        ['petalguard', 'Mein Garten heilt mich. Jede Wurzel trägt mich – ihr werdet welken!'],
        ['mochi', 'Ihre Wurzelknoten heilen sie. Tipp sie an, dann schießt unser Schiff zuerst darauf – oder triff ihre offene Blüte.']
      ]
    },
    'pg-arena-phase2': { title: 'Dornenwall', lines: [['petalguard', 'Ranken, erhebt euch! Schützt das Herz!']] },
    'pyra-campaign': {
      title: 'Die Glutwacht',
      lines: [
        ['funke', 'Emberbells Hitzedrohnen halten die Kühlklappen zu – die Glutwacht. Neun Wachen stehen zwischen euch und ihm.'],
        ['mochi', 'Dann fliegen wir eine Expedition nach der anderen. Abenteuer-Tab, hier auf Pyra-9!']
      ]
    },
    'mekhanos-campaign': {
      title: 'Das Taktband',
      lines: [
        ['werk', 'Unbekanntes Schiff gelandet. Prüfstrecke 1 bis 9 aktiviert. Bitte begeben Sie sich zur Kontrolle.'],
        ['void', 'Neun Prüfungen im Takt, dann Cogsworth selbst. Abenteuer-Tab, hier auf Mekhanos.']
      ]
    },
    'viridia-campaign': {
      title: 'Die Blütenwacht',
      lines: [
        ['wurzel', 'Fremde Schritte im Wurzelnetz … der Garten erhebt sich gegen sie.'],
        ['mochi', 'Neun Wachen der Blütenwacht, dann Petalguard. Abenteuer-Tab, hier auf Viridia!']
      ]
    }
  });
}
// the campaign's own beat follows the guardian's drone-stage beat (arena mode only)
const OUTER_OPEN_BEAT = { 'eb-arrival': ['emberbell', 'pyra-campaign'], 'cw-restricted': ['cogsworth', 'mekhanos-campaign'], 'pg-arrival': ['petalguard', 'viridia-campaign'] };
GameEvents.on('story', e => {
  const beat = OUTER_OPEN_BEAT[e?.id];
  if (beat && guardianArena(beat[0])) storyEvent(beat[1]);
});

// ----- the story card while a campaign runs (replaces the classic "two drones" task) -----
const OUTER_CARD = {
  emberbell: { key: 'volcanic', title: 'Die Glutwacht über Pyra-9', foes: 'Emberbells Hitzedrohnen halten die Kühlklappen zu.', before: () => ['warned', 'battle', 'defeated'].includes(pips().stage) || ['drones', 'battle', 'defeated'].includes(frostbyte().stage) },
  cogsworth: { key: 'machine', title: 'Das Taktband über Mekhanos', foes: 'Cogsworths Fabrikinspektion prüft im Takt.', before: () => ['warned', 'battle', 'defeated'].includes(pips().stage) || ['drones', 'battle', 'defeated'].includes(frostbyte().stage) || ['drones', 'battle', 'defeated'].includes(emberbell().stage) },
  petalguard: {
    key: 'verdant',
    title: 'Die Blütenwacht über Viridia',
    foes: 'Petalguards Garten schützt das Wurzelnetz.',
    before: () => ['warned', 'battle', 'defeated'].includes(pips().stage) || ['drones', 'battle', 'defeated'].includes(frostbyte().stage) || ['drones', 'battle', 'defeated'].includes(emberbell().stage) || ['drones', 'battle', 'defeated'].includes(cogsworth().stage)
  }
};
// true = handled (drawn, or an earlier guardian's card has priority); false = the classic card decides
function outerCampaignCard(guardian) {
  const def = OUTER_CARD[guardian],
    gd = EXP_GUARDIANS[guardian];
  if (!def || !guardianArena(guardian) || state.meta.guardians[guardian]?.stage !== gd.wait) return false;
  const card = $('storyCard');
  if (!card || def.before()) return true;
  const key = def.key,
    done = campaignCleared(key),
    total = CAMPAIGNS[key].waves.length,
    here = state.activePlanet === CAMPAIGNS[key].planet,
    name = EXP_PLANET_NAME[key];
  card.classList.remove('hidden');
  setHTML(card, `<b>${def.title}</b><small>${done >= total ? 'Alle Wachen geschafft – ' + EXP_BOSS[key].name + ' wartet auf die Wächter-Expedition.' : 'Feldzug ' + done + '/' + total + ' – ' + def.foes} ${here ? 'Expedition im Abenteuer-Tab starten.' : 'Fliege nach ' + name + ', dort startet die Expedition.'}</small>`);
  return true;
}
const renderEmberbellCardBeforeArena = renderEmberbellCard;
renderEmberbellCard = () => outerCampaignCard('emberbell') || renderEmberbellCardBeforeArena();
const renderCogsworthCardBeforeArena = renderCogsworthCard;
renderCogsworthCard = () => outerCampaignCard('cogsworth') || renderCogsworthCardBeforeArena();
const renderPetalguardCardBeforeArena = renderPetalguardCard;
renderPetalguardCard = () => outerCampaignCard('petalguard') || renderPetalguardCardBeforeArena();

// ----- the fight HUD: what the guardian is doing right now -----
const EXP_BOSS_STATUS = {
  emberbell: f => (f.ebPhase === 'cool' ? '❄ Kühlphase – 175 %' : f.ebPhase === 'blast' ? '💨 Dampfstoß – nichts geht durch' : f.ebPhase === 'warn' ? '⚠ Ventile glühen – Schild bereit!' : '🔥 Druck ' + Math.round(f.pressure || 0) + ' % · Hitzeschild 40 %'),
  cogsworth: f => {
    const phase = cogsworthPhase(f);
    return (phase === 'broken' ? '⚡ Taktbruch – Gehäuse offen 180 %' : phase === 'open' ? '⚙ Gehäuse offen – 180 %' : phase === 'window' ? '⚠ Prüffenster – jetzt Salve!' : '🛡 Ordnungsschild 30 %') + ' · Takt ' + (Math.max(0, f.cwBeat ?? 0) + 1) + '/8';
  },
  petalguard: (f, a) => {
    const roots = a.foes.filter(o => o.kind === 'root' && o.hp > 0).length;
    return (f.bloomOpen ? '🌸 Blüte offen – 150 %' : '🌱 Knospe – 30 %') + (roots ? ' · ' + roots + ' Wurzelknoten heilen' : '');
  }
};
const renderExpeditionHudBeforeOuter = renderExpeditionHud;
renderExpeditionHud = () => {
  renderExpeditionHudBeforeOuter();
  const a = arenaRun,
    boss = a?.boss && a.foes.find(f => f.family === 'boss'),
    status = boss && EXP_BOSS_STATUS[boss.kind];
  const label = status && document.querySelector('#expTop .exp-phase');
  if (label) {
    const text = (boss.phase2 ? 'Phase 2 · ' : '') + status(boss, a);
    if (label.textContent !== text) label.textContent = text;
  }
};

// ----- older saves: a classic fight of these guardians that was running continues as the arena guardian -----
function outerExpeditionSync() {
  if (campaignMode() !== 'arena' || !state.meta?.campaign) return;
  for (const [guardian, key] of Object.entries(OUTER_GUARDIAN_KEY)) {
    const g = state.meta.guardians?.[guardian];
    if (g?.stage === 'battle' && campaignComplete(key) && CAMPAIGN_FLAGS[key] && !arenaRun) g.stage = EXP_GUARDIANS[guardian].wait;
  }
}
outerExpeditionSync();

// ----- Combat 3.0 in the prep and the defeat analysis -----
// the three controls in one line under the matchup (the arena has no other buttons)
const expMatchHTMLBeforeTactics = expMatchHTML;
expMatchHTML = () =>
  expMatchHTMLBeforeTactics().replace(
    /<\/section>$/,
    '<p class="exp-tactics"><span>🛡 <b>Schild</b> kurz vor dem Einschlag: Perfekte Parade – der Schuss fliegt zurück</span><span>⚡ <b>Salve</b> bricht Panzer, Schilde und Barrieren</span><span>👆 <b>Gegner antippen</b>: Fokusziel</span></p></section>'
  );
// a lost fight names the Combat 3.0 lesson that fits it first (then the build tips as before)
const arenaAnalysisBeforeOuter = arenaAnalysis;
arenaAnalysis = (a, reason) => {
  const out = arenaAnalysisBeforeOuter(a, reason),
    s = a.stats,
    boss = a.foes.find(f => f.family === 'boss'),
    lesson = [];
  if (s.aids >= 2) lesson.push('Unterstützer haben ' + s.aids + '-mal geholfen (Hitzeschild, Barriere oder Heilung). Tippe sie an – dann zielt dein Schiff zuerst auf sie.');
  if (s.jams >= 2) lesson.push('Störsender haben Schild und Salve ' + s.jams + '-mal verzögert. Tippe sie an und schalte sie zuerst aus.');
  if (boss?.kind === 'petalguard' && boss.healed > boss.maxHp * 0.1) lesson.push('Petalguard hat sich um ' + fmt(boss.healed) + ' geheilt. Wurzelknoten antippen und kappen – oder in der offenen Blüte voll treffen.');
  if (boss?.kind === 'cogsworth' && !a.events.some(e => e.type === 'taktbruch')) lesson.push('Salve im Prüffenster (gelbe Lampe): Taktbruch – sein Gehäuse bleibt vier Takte offen.');
  if (boss?.kind === 'emberbell' && s.parries === 0) lesson.push('Beim Dampfstoß den Schild genau dann zünden, wenn die Dampfwand ankommt: Perfekte Parade.');
  if (!lesson.length && s.parries === 0 && s.taken > a.ship.hullMax * 0.5 && a.boss) lesson.push('Perfekte Parade: Schild kurz vor dem Einschlag – der Schuss fliegt zurück und der Schild lädt 3 s schneller.');
  if (lesson.length) out.tips = [{ kind: 'tactic', text: lesson[0] }, ...out.tips].slice(0, 2);
  if (a.boss) out.name = EXP_BOSS[a.key]?.name || out.name;
  return out;
};

// ----- Beta 1.6 M6: Rückenwind (campaign.js) — recorded at the end of every arena fight, named in the prep -----
const arenaFinishBeforeAssist = arenaFinish;
arenaFinish = (won, now = Date.now(), opts = {}) => {
  const a = arenaRun;
  const done = arenaFinishBeforeAssist(won, now, opts);
  // a retreat is the player's choice, not a defeat: only real losses and wins count
  if (a && done && !opts.abort) {
    campaignAssistRecord(a.key, a.wave, won);
    save();
  }
  return done;
};
const expMatchHTMLBeforeAssist = expMatchHTML;
expMatchHTML = () => {
  const html = expMatchHTMLBeforeAssist(),
    key = expedition.key,
    target = expedition.target === 'boss' ? 'boss' : campaignCleared(key),
    n = key ? campaignAssist(key, target) : 0;
  if (!n) return html;
  const k = campaignAssistFactors(n);
  return html.replace(
    /<\/section>$/,
    `<p class="exp-assist">🍃 <b>Rückenwind</b> nach ${n} Niederlage${n === 1 ? '' : 'n'}: Gegner −${Math.round((1 - k.hp) * 100)} % Hülle, −${Math.round((1 - k.dmg) * 100)} % Schaden. Nach dem Sieg ist er wieder weg.</p></section>`
  );
};

// ----- the campaign card after the ninth wave (Glacies and the outer worlds; Orion keeps its P.I.P.S. text) -----
// Before Beta 1.6 the card said "Feldzug abgeschlossen – … und der Wächter" while Frostbyte still waited. Now it names
// the guardian and opens his expedition, or names what his story still needs.
const renderCampaignCardBeforeGuardians = renderCampaignCard;
renderCampaignCard = () => {
  renderCampaignCardBeforeGuardians();
  const card = $('campaignCard'),
    key = typeof campaignKeyFor === 'function' ? campaignKeyFor() : null;
  if (!card || card.hidden || !key || key === 'crystal' || !campaignComplete(key) || arenaRun) return;
  const c = CAMPAIGNS[key],
    gd = EXP_GUARDIANS[c.guardian],
    stage = state.meta.guardians?.[c.guardian]?.stage;
  if (!gd || ['defeated', 'repaired'].includes(stage)) return;
  const kids = [...card.children],
    intro = kids.findIndex(el => el.classList.contains('arsenal-note'));
  if (intro < 0) return;
  kids.slice(intro + 1).forEach(el => el.remove());
  card.insertAdjacentHTML(
    'beforeend',
    expBossReady(key)
      ? `<p class="arsenal-note">Alle ${c.waves.length} Wellen geschafft – <b>${EXP_BOSS[key].name}</b> wartet.</p><button class="campaign-start" data-campaign-guardian="${key}">WÄCHTER-EXPEDITION</button>`
      : `<p class="arsenal-note">Alle ${c.waves.length} Wellen geschafft. ${gd.notYet || 'Der Wächter wartet noch auf seine Geschichte.'}</p>`
  );
  htmlCache.delete(card);
};

// ----- accessibility: the arena's big moments are also told to screen readers (the canvas banners are not) -----
// One polite live region in the fight layer; at most one announcement per 1.5 s, only for rare, meaningful events.
const EXP_ANNOUNCE = {
  'boss-phase': () => 'Phase 2: Der Wächter ruft Verstärkung.',
  parry: () => 'Perfekte Parade – der Schuss fliegt zurück.',
  taktbruch: () => 'Taktbruch – das Gehäuse bleibt offen.',
  'salvo-out': () => 'Der Dampfstoß hat die Salve ausgeblasen.',
  'boss-open': () => 'Der Wächter ist offen – volle Wirkung.',
  jam: () => 'Gestört: Schild und Salve verzögert.'
};
let expAnnounceSeq = 0,
  expAnnounceAt = 0;
function expAnnounce(text) {
  let live = $('expLive');
  if (!live) {
    const root = $('expedition');
    if (!root) return;
    root.insertAdjacentHTML('beforeend', '<p class="sr-only" id="expLive" aria-live="polite" role="status"></p>');
    live = $('expLive');
  }
  const now = Date.now();
  if (now - expAnnounceAt < 1500) return;
  expAnnounceAt = now;
  live.textContent = text;
}
const arenaReactBeforeAnnounce = arenaReact;
arenaReact = () => {
  const a = arenaRun;
  if (a) {
    for (const e of a.events) {
      if (e.seq <= expAnnounceSeq) continue;
      const say = EXP_ANNOUNCE[e.type];
      if (say) expAnnounce(say(e));
    }
    expAnnounceSeq = a.eventSeq || 0;
  } else expAnnounceSeq = 0;
  arenaReactBeforeAnnounce();
};
