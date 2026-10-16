// Beta 1.6 M3 — the outer campaigns: Pyra-9 (Die Glutwacht → Emberbell), Mekhanos (Das Taktband → Cogsworth-9) and
// Viridia (Die Blütenwacht → Petalguard) in the arena. Data and logic only, on the same engine as Orion and Glacies
// (campaign.js tables, arena.js simulation, the guardian's own one-time defeat function). Drawing: scenes/enemy-art.js
// and scenes/arena-scene.js; prep texts, story and HUD: outer-campaigns-ui.js. Loaded after arena.js, before game.js
// (normalizeCampaign sees the new campaigns when the save loads).
//
// Each campaign opens when the kittens reach the planet (its guardian's first story stage), so the next world's course
// depends on combat, not on the planet's deep economy (M6, docs/beta-1-6/BALANCE_REPORT.md). The guardian himself
// waits for his story: Emberbell after the cooling console runs ('drones'), Cogsworth-9 after the archive is filed
// ('drones'), Petalguard after the root node is healed ('thorns') — the classic two-drone task is gone, the nine waves
// are its replacement. Saves whose guardian already fights, is beaten or repaired count the campaign as done
// (normalizeCampaign), without retroactive wave rewards.
//
// New enemy roles (Combat 3.0, arena.js): support (heat guard / barrier / heal on an ally), disruptor (fast, weaving,
// its hits jam both abilities), artillery (lobbed shots that land on a marked spot). Every campaign mixes affinities so
// that no single weapon wins all nine waves.

Object.assign(CAMPAIGN_ENEMIES, {
  // ----- Pyra-9 · die Glutwacht (Emberbells Hitzedrohnen) -----
  spark: { name: 'Funkenschwarm', hp: 18, atk: 3.5, every: 1.6, shot: 'paper', weakness: 'Arc', tip: 'Glühende Funken im Schwarm – stürzen sich aufs Schiff. Schildpuls fängt den Aufprall ab.' },
  slag: { name: 'Schlackenwerfer', hp: 50, atk: 8, every: 3.1, shot: 'clip', weakness: 'Plasma', tip: 'Artillerie: wirft Schlacke dorthin, wo das Schiff gerade ist – der rote Kreis zeigt den Einschlag.' },
  kiln: { name: 'Ofenpanzer', hp: 96, atk: 9, every: 3.2, shot: 'clip', weakness: 'Ion', armor: 0.45, tip: 'Dicke Ofenplatten: je nach Waffe gehen 35–85 % durch. Die Salve geht ganz durch.' },
  bellows: { name: 'Blasebalg', hp: 54, atk: 3.5, every: 3, shot: 'laser', weakness: 'Laser', tip: 'Unterstützer: facht einen Verbündeten an – Hitzeschild, nur 50 % Schaden. Antippen, dann zielt das Schiff zuerst auf ihn.' },
  ember: { name: 'Glutgeist', hp: 80, atk: 7, every: 2.1, shot: 'laser', weakness: 'Ion', tip: 'Ein entlaufener Ofenwächter: driftet nah heran und wirft Glut. Hydro-Waffen löschen ihn.' },
  forgeguard: { name: 'Essenwächter', hp: 300, atk: 11, every: 4, shot: 'seal', weakness: 'Plasma', elite: true, shield: { every: 6, warn: 3, from: 4, factor: 0.25, breakFor: 2.5 }, tip: 'Glutschild (nur 25 %). Die Salve bricht es für 2,5 s.' },
  // ----- Mekhanos · das Taktband (Cogsworths Fabrikinspektion) -----
  rivet: { name: 'Nietenschwarm', hp: 22, atk: 4, every: 1.5, shot: 'paper', weakness: 'Plasma', tip: 'Ein Schwarm loser Nieten im Gleichtakt – sie prallen aufs Schiff. Schildpuls hilft.' },
  inspector: { name: 'Inspektor-Drohne', hp: 52, atk: 6, every: 2.4, shot: 'laser', weakness: 'Laser', tip: 'Prüft im Doppeltakt: zwei gezielte Prüfbolzen auf einmal.' },
  press: { name: 'Stanzpresse', hp: 110, atk: 10, every: 3.4, shot: 'clip', weakness: 'Plasma', armor: 0.4, tip: 'Gepanzerte Presse: je nach Waffe gehen 35–85 % durch. Die Salve geht ganz durch.' },
  jammer: { name: 'Störsender', hp: 40, atk: 4, every: 2, shot: 'laser', weakness: 'Laser', tip: 'Störer: flink und nie still. Seine Treffer verzögern Schild und Salve um 2 s – zuerst ausschalten!' },
  projector: { name: 'Schildprojektor', hp: 58, atk: 3, every: 3.2, shot: 'laser', weakness: 'Ion', tip: 'Unterstützer: legt einem Verbündeten eine Barriere um (20 % seiner Hülle). Ein Salve-Treffer zerschlägt sie.' },
  foreman: { name: 'Vorarbeiter', hp: 320, atk: 11, every: 4, shot: 'seal', weakness: 'Plasma', elite: true, callAfter: 9, calls: ['rivet', 'rivet'], shield: { every: 6, warn: 3, from: 4, factor: 0.25, breakFor: 2.5 }, tip: 'Normschild (nur 25 %), die Salve bricht es. Ruft nach 9 s zwei Nietenschwärme.' },
  // ----- Viridia · die Blütenwacht (Petalguards Garten) -----
  spore: { name: 'Sporenwolke', hp: 20, atk: 3.6, every: 1.6, shot: 'paper', weakness: 'Arc', tip: 'Treibende Sporen im Schwarm – sie platzen am Schiff. Schildpuls fängt sie ab.' },
  thorn: { name: 'Dornenranke', hp: 50, atk: 4.4, every: 2.6, shot: 'laser', weakness: 'Plasma', tip: 'Schießt drei Dornen im Fächer.' },
  bark: { name: 'Rindenkoloss', hp: 120, atk: 10, every: 3.4, shot: 'clip', weakness: 'Arc', armor: 0.4, tip: 'Borke wie Panzer: je nach Waffe gehen 35–85 % durch. Die Salve geht ganz durch.' },
  pollen: { name: 'Pollenpflegerin', hp: 56, atk: 3, every: 3, shot: 'laser', weakness: 'Laser', tip: 'Unterstützerin: heilt alle 3 s den verletztesten Verbündeten um 6 %. Zuerst ausschalten!' },
  bulb: { name: 'Knospenrufer', hp: 48, atk: 6, every: 2.8, shot: 'clip', weakness: 'Ion', callAfter: 7, calls: ['spore', 'spore'], tip: 'Wirft Samenkapseln auf den markierten Fleck und ruft nach 7 s zwei Sporenwolken.' },
  bloomwarden: { name: 'Blütenwächterin', hp: 340, atk: 12, every: 4, shot: 'seal', weakness: 'Arc', elite: true, shield: { every: 6, warn: 3, from: 4, factor: 0.25, breakFor: 2.5 }, tip: 'Blütenschild (nur 25 %). Die Salve bricht es für 2,5 s.' }
});

Object.assign(ARENA_FOES, {
  spark: { r: 3.6, speed: 27, home: 2, shotSpeed: 58, shotR: 1.2, contact: 2.2 },
  slag: { r: 5.6, speed: 14, anchor: [128, 146], shotSpeed: 0, shotR: 3, lob: { flight: 1.3, radius: 7 } },
  kiln: { r: 7.2, speed: 8, anchor: [86, 100], shotSpeed: 46, shotR: 2.8 },
  bellows: { r: 5.4, speed: 15, anchor: [124, 140], shotSpeed: 52, shotR: 2, support: { type: 'guard', every: 4.5, seconds: 3.5, first: 2 } },
  forgeguard: { r: 9, speed: 10, anchor: [114, 128], shotSpeed: 50, shotR: 3.2 },
  rivet: { r: 3.6, speed: 28, home: 2.1, shotSpeed: 60, shotR: 1.2, contact: 2.3 },
  inspector: { r: 5, speed: 18, anchor: [120, 140], shotSpeed: 96, shotR: 1.4, volley: { n: 2, spread: 0.1 } },
  press: { r: 7.4, speed: 7, anchor: [84, 98], shotSpeed: 44, shotR: 3 },
  jammer: { r: 4.6, speed: 30, anchor: [100, 124], shotSpeed: 80, shotR: 1.6, jam: 2, weave: { amp: 14, speed: 34, every: 2.4 } },
  projector: { r: 5.6, speed: 14, anchor: [130, 146], shotSpeed: 50, shotR: 2, support: { type: 'barrier', every: 6, amount: 0.2, first: 2.5 } },
  foreman: { r: 9.4, speed: 9, anchor: [112, 126], shotSpeed: 50, shotR: 3.2 },
  spore: { r: 3.8, speed: 25, home: 1.9, shotSpeed: 54, shotR: 1.2, contact: 2.4 },
  thorn: { r: 5.2, speed: 16, anchor: [116, 136], shotSpeed: 74, shotR: 1.4, volley: { n: 3, spread: 0.16 } },
  bark: { r: 7.6, speed: 7, anchor: [84, 98], shotSpeed: 42, shotR: 3 },
  pollen: { r: 5.2, speed: 14, anchor: [130, 146], shotSpeed: 48, shotR: 2, support: { type: 'heal', every: 3, amount: 0.06, first: 2.5 } },
  bulb: { r: 5.8, speed: 13, anchor: [126, 144], shotSpeed: 0, shotR: 3, lob: { flight: 1.4, radius: 6.5 } },
  bloomwarden: { r: 9.4, speed: 9, anchor: [112, 126], shotSpeed: 50, shotR: 3.2 },
  // the guardians and Petalguard's root nodes
  emberbell: { r: 13, speed: 12, anchor: [118, 126], shotSpeed: 66, shotR: 2.2, atk: 11, every: 9 },
  cogsworth: { r: 14, speed: 10, anchor: [120, 126], shotSpeed: 82, shotR: 1.8, atk: 8, every: 8 },
  petalguard: { r: 14, speed: 10, anchor: [118, 126], shotSpeed: 60, shotR: 1.6, atk: 8, every: 10 },
  root: { r: 4.6, speed: 0, anchor: [0, 0], shotSpeed: 0, shotR: 0, hp: 1, atk: 0, every: 999 }
});
Object.assign(ARENA_GAP, { spark: 0.45, rivet: 0.45, spore: 0.45, forgeguard: 2.6, foreman: 2.6, bloomwarden: 2.6 });

Object.assign(ENEMY_FAMILIES, {
  support: { name: 'Unterstützer', text: 'Hilft Verbündeten – Schild, Barriere oder Heilung' },
  disruptor: { name: 'Störer', text: 'Schnell und unstet; seine Treffer verzögern Schild und Salve' },
  artillery: { name: 'Artillerie', text: 'Wirft Geschosse auf einen markierten Fleck' }
});
Object.assign(ENEMY_DNA, {
  // Pyra: mostly Thermo (Hydro trifft stark), the throwers Kinetik, the bellows Ionen
  spark: { family: 'swarm', affinity: 'thermal' },
  slag: { family: 'artillery', affinity: 'kinetic' },
  kiln: { family: 'heavy', affinity: 'thermal' },
  bellows: { family: 'support', affinity: 'ion' },
  forgeguard: { family: 'elite', affinity: 'thermal' },
  // Mekhanos: mostly Kinetik (Thermo trifft stark), the drones Ionen, the projector Thermo
  rivet: { family: 'swarm', affinity: 'kinetic' },
  inspector: { family: 'ranged', affinity: 'ion' },
  press: { family: 'heavy', affinity: 'kinetic' },
  jammer: { family: 'disruptor', affinity: 'ion' },
  projector: { family: 'support', affinity: 'thermal' },
  foreman: { family: 'elite', affinity: 'kinetic' },
  // Viridia: mostly Hydro (Ionen trifft stark), the vines Kinetik, the caretaker Ionen, the caller Thermo
  spore: { family: 'swarm', affinity: 'hydro' },
  thorn: { family: 'ranged', affinity: 'kinetic' },
  bark: { family: 'heavy', affinity: 'hydro' },
  pollen: { family: 'support', affinity: 'ion' },
  bulb: { family: 'summoner', affinity: 'thermal' },
  bloomwarden: { family: 'elite', affinity: 'hydro' },
  root: { family: 'support', affinity: 'hydro' }
});

const outerWaves = (rows, credits, crystals, chests, lines) => rows.map(([name, foes], i) => ({ name, foes, reward: { credits: credits[i], crystals: crystals[i], ...(chests[i] ? { chest: chests[i] } : {}) }, line: lines[i] }));
const OUTER_CHESTS = [null, null, 'standard', null, 'elite', 'standard', null, null, 'standard'];
const OUTER_CRYSTALS = [1, 1, 1, 2, 2, 2, 2, 3, 3];
Object.assign(CAMPAIGNS, {
  // Pyra-9: Emberbell's heat drones guard the cooling vents; stronger than Glacies (tuned with tools/arena-balance.mjs)
  volcanic: {
    planet: 2,
    guardian: 'emberbell',
    title: 'Die Glutwacht',
    short: 'Pyra-9 · Feldzug',
    hpScale: 4.2,
    dmgScale: 2.1,
    waves: outerWaves(
      [
        ['Funkenflug', ['spark', 'spark', 'spark', 'spark', 'slag']],
        ['Schlackenregen', ['slag', 'spark', 'slag', 'spark', 'spark']],
        ['Ofenglut', ['kiln', 'spark', 'spark', 'kiln']],
        ['Heißer Wind', ['bellows', 'kiln', 'spark', 'slag']],
        ['Der Essenwächter', ['slag', 'slag', 'forgeguard']],
        ['Glutsturm', ['spark', 'spark', 'spark', 'ember', 'spark', 'spark', 'spark']],
        ['Schmelzofen', ['kiln', 'bellows', 'slag', 'kiln', 'ember']],
        ['Rote Linie', ['bellows', 'forgeguard', 'spark', 'spark', 'slag']],
        ['Das Herz der Esse', ['kiln', 'bellows', 'forgeguard', 'slag', 'ember', 'spark', 'spark']]
      ],
      [2000, 2800, 3800, 5000, 6500, 8000, 10000, 12500, 15000],
      OUTER_CRYSTALS,
      OUTER_CHESTS,
      [
        ['funke', 'Funkenschwärme aus den Kühlschächten! Sie fliegen direkt auf euch zu – Schild bereithalten.'],
        ['boba', 'Die Schlackenwerfer zielen dahin, wo wir gerade sind. Der rote Kreis zeigt den Einschlag – ich weiche aus, so gut ich kann.'],
        ['mochi', 'Ofenpanzer! Schwere Waffen oder die Salve kommen durch die Platten.'],
        ['funke', 'Der Blasebalg facht seine Freunde an. Tippt ihn an – dann zielt euer Schiff zuerst auf ihn.'],
        ['boba', 'Ein Essenwächter mit Glutschild. Wenn sein Siegel glüht: Salve!'],
        ['void', 'Ein Glutgeist zwischen den Funken … die alten Schmieden erwachen.'],
        ['mochi', 'Blasebalg und Ofenpanzer zusammen – erst den Blasebalg, sonst halten die Panzer doppelt.'],
        ['funke', 'Hinter dieser Linie liegen die Hauptventile. Noch zwei Wachen, dann kommt Emberbell selbst.'],
        ['void', 'Das Herz der Esse. Danach steht Emberbell vor euch – und er glaubt immer noch, Hitze schützt uns.']
      ]
    )
  },
  // Mekhanos: Cogsworth-9's inspection runs to the beat of the Taktband
  machine: {
    planet: 3,
    guardian: 'cogsworth',
    title: 'Das Taktband',
    short: 'Mekhanos · Feldzug',
    hpScale: 5.4,
    dmgScale: 2.3,
    waves: outerWaves(
      [
        ['Nietenregen', ['rivet', 'rivet', 'rivet', 'rivet', 'inspector']],
        ['Prüfstrecke', ['inspector', 'rivet', 'inspector', 'rivet', 'rivet']],
        ['Stanzwerk', ['press', 'rivet', 'rivet', 'press']],
        ['Störsignal', ['jammer', 'inspector', 'jammer', 'rivet', 'rivet']],
        ['Der Vorarbeiter', ['inspector', 'projector', 'foreman']],
        ['Schichtwechsel', ['rivet', 'rivet', 'rivet', 'jammer', 'rivet', 'rivet', 'rivet', 'press']],
        ['Schildwand', ['projector', 'press', 'inspector', 'projector', 'press']],
        ['Überstunden', ['jammer', 'foreman', 'projector', 'rivet', 'rivet']],
        ['Endkontrolle', ['press', 'projector', 'foreman', 'jammer', 'inspector', 'rivet', 'rivet']]
      ],
      [4000, 5500, 7000, 9000, 11500, 14000, 17000, 21000, 26000],
      OUTER_CRYSTALS,
      OUTER_CHESTS,
      [
        ['werk', 'ACHTUNG: Unangemeldetes Schiff im Prüfbereich. Nietenschwärme werden zur Kontrolle ausgesandt.'],
        ['boba', 'Die Inspektor-Drohnen schießen immer zu zweit. Bleib ruhig, ich halte die Spur.'],
        ['mochi', 'Stanzpressen – gepanzert wie ein Tresor. Die Salve geht durch!'],
        ['void', 'Störsender. Jeder Treffer von ihnen verzögert Schild und Salve. Tippt sie an, dann sind sie zuerst dran.'],
        ['werk', 'Der Vorarbeiter übernimmt die Kontrolle. Schildprojektor aktiv.'],
        ['mochi', 'Schichtwechsel … das sind ja Hunderte Nieten!'],
        ['boba', 'Zwei Projektoren legen Barrieren um die Pressen. Ein Salve-Treffer zerschlägt jede Barriere.'],
        ['werk', 'Überstunden genehmigt. Vorarbeiter und Störsender, bitte in die Prüfzone.'],
        ['void', 'Die Endkontrolle. Dahinter wartet Cogsworth-9 – er lebt im Takt seines Bandes.']
      ]
    )
  },
  // Viridia: Petalguard's garden defends the root network
  verdant: {
    planet: 4,
    guardian: 'petalguard',
    title: 'Die Blütenwacht',
    short: 'Viridia · Feldzug',
    hpScale: 7,
    dmgScale: 2.8,
    waves: outerWaves(
      [
        ['Sporenflug', ['spore', 'spore', 'spore', 'spore', 'thorn']],
        ['Dornenhecke', ['thorn', 'spore', 'thorn', 'spore', 'spore']],
        ['Rindenwall', ['bark', 'spore', 'spore', 'bark']],
        ['Pollenpflege', ['pollen', 'bark', 'thorn', 'spore', 'spore']],
        ['Die Blütenwächterin', ['thorn', 'pollen', 'bloomwarden']],
        ['Saatregen', ['bulb', 'spore', 'spore', 'bulb', 'thorn']],
        ['Wurzelwerk', ['bark', 'pollen', 'bulb', 'bark', 'thorn']],
        ['Blütensturm', ['pollen', 'bloomwarden', 'spore', 'spore', 'bulb']],
        ['Herz des Gartens', ['bark', 'pollen', 'bloomwarden', 'bulb', 'thorn', 'spore', 'spore']]
      ],
      [7000, 9000, 11500, 14500, 18000, 22000, 26500, 32000, 38000],
      OUTER_CRYSTALS,
      OUTER_CHESTS,
      [
        ['wurzel', 'Fremde … im Garten. Die Sporen werden euch prüfen.'],
        ['boba', 'Dornenranken schießen im Fächer – drei Dornen auf einmal.'],
        ['mochi', 'Rindenkolosse! Ihre Borke hält wie Panzer – Salve oder schwere Waffen.'],
        ['void', 'Die Pollenpflegerin heilt die anderen. Tippt sie an – dann fällt sie zuerst.'],
        ['wurzel', 'Die Blütenwächterin schützt den Pfad. Ihr Schild bricht nur unter Feuer.'],
        ['boba', 'Samenkapseln landen auf dem markierten Fleck – und die Knospenrufer holen Sporen nach.'],
        ['mochi', 'Rinde, Pollen und Knospen zusammen … zuerst die Pflegerin!'],
        ['wurzel', 'Der Garten ruft seine Wächterin. Sie ist nah.'],
        ['void', 'Das Herz des Gartens. Danach öffnet Petalguard ihre Blüte – und heilt sich aus ihren Wurzeln.']
      ]
    )
  }
});
CAMPAIGN_OPEN_STAGES.volcanic = ['overheated', 'console', 'drones', 'battle', 'defeated', 'repaired'];
CAMPAIGN_OPEN_STAGES.machine = ['restricted', 'archive', 'drones', 'battle', 'defeated', 'repaired'];
CAMPAIGN_OPEN_STAGES.verdant = ['overgrown', 'withering', 'thorns', 'battle', 'defeated', 'repaired'];
Object.assign(CAMPAIGN_FLAGS, { volcanic: true, machine: true, verdant: true });
Object.assign(DNA_WAVE_REWARDS, { volcanic: { 2: 'rare', 5: 'epic', 8: 'epic' }, machine: { 2: 'epic', 5: 'epic', 8: 'legendary' }, verdant: { 2: 'epic', 5: 'legendary', 8: 'legendary' } });
// the Glutgeist of the old forges also burns on Pyra (two waves); on Orion it stays where it was
// (its numbers now come from CAMPAIGN_ENEMIES.ember, which are the same as before)

// ----- the guardians -----
Object.assign(ARENA_BOSSES, {
  volcanic: { kind: 'emberbell', hp: 9000, phase2: 0.5, summon: ['spark', 'spark', 'slag'] },
  machine: { kind: 'cogsworth', hp: 11000, phase2: 0.5, summon: ['inspector', 'jammer'] },
  verdant: { kind: 'petalguard', hp: 12500, phase2: 0.5, summon: ['thorn', 'thorn'] }
});
// Phase 2 of a registered guardian: once at its threshold; calls its reinforcements (they fight like last-wave enemies).
function arenaGuardianPhase2(a, f) {
  const boss = ARENA_BOSSES[a.key];
  if (f.phase2 || f.hp > f.maxHp * boss.phase2) return false;
  f.phase2 = true;
  for (const kind of boss.summon) a.queue.push(kind);
  a.stats.calls += boss.summon.length;
  arenaEvent(a, { type: 'boss-phase', id: f.id, phase: 2 });
  return true;
}
// A guardian's entry (from the right edge to its anchor), then a slow hover around it.
function arenaGuardianMove(f, def, dt, sx, ax, sy, ay) {
  if (f.x > f.anchor + 0.01) f.x = Math.max(f.anchor, f.x - def.speed * dt);
  else {
    f.x = f.anchor + Math.sin(f.t * sx) * ax;
    f.y = ARENA.H / 2 + Math.sin(f.t * sy) * ay;
  }
}

// Emberbell — heat pressure (the classic mechanic, now with space):
//   build: pressure rises (11 %/s, 14 %/s in phase 2); the heat shield lets 40 % through; every Salve hit pushes the
//          pressure +3 % (the vents open sooner); aimed embers every 2 s (1.6 s); in phase 2 magma rain on marked spots
//   warn (2 s): the vents glow, an orange steam line is drawn — get the shield ready
//   blast (1.4 s): the Dampfstoß, a wall of steam across the whole arena (the shield blocks it, a parade throws it back);
//          nothing gets through his plates and a running Salve is blown out
//   cool (4.5 s): the plates stand open — 175 %; then the pressure starts at 0 again
const EB_ARENA = { rate: 11, rate2: 14, salvoPush: 3, warn: 2, blast: 1.4, cool: 4.5, shield: 0.4, open: 1.75, emberEvery: 2, emberEvery2: 1.6, steamShots: 7, steamSpeed: 44, steamDamage: 1.5, rainEvery: 3, rainFlight: 1.25, rainRadius: 8, rainDamage: 0.9 };
function emberbellArenaStep(a, f, def, dt) {
  const C = EB_ARENA;
  if (f.ebPhase === undefined) Object.assign(f, { ebPhase: 'build', ebAt: f.t, pressure: 0, nextEmber: 1.5, nextRain: 2 });
  arenaGuardianMove(f, def, dt, 0.8, 4, 0.45, 24);
  const since = f.t - f.ebAt;
  if (f.ebPhase === 'build') {
    f.pressure = Math.min(100, f.pressure + (f.phase2 ? C.rate2 : C.rate) * dt);
    if (f.t >= f.nextEmber) {
      f.nextEmber = f.t + (f.phase2 ? C.emberEvery2 : C.emberEvery);
      arenaFoeShot(a, f, def, { kind: 'cinder' });
    }
    if (f.phase2 && f.t >= f.nextRain) {
      f.nextRain = f.t + C.rainEvery;
      for (const offset of [-10, 10]) arenaFoeShot(a, f, def, { kind: 'magma', lob: { flight: C.rainFlight, radius: C.rainRadius }, offset, damage: f.atk * C.rainDamage });
    }
    if (f.pressure >= 100) emberbellEnter(a, f, 'warn');
  } else if (f.ebPhase === 'warn') {
    if (since >= C.warn) emberbellEnter(a, f, 'blast');
  } else if (f.ebPhase === 'blast') {
    if (a.ship.salvoUntil > a.t) a.ship.salvoUntil = a.t;
    if (since >= C.blast) emberbellEnter(a, f, 'cool');
  } else if (since >= C.cool) emberbellEnter(a, f, 'build');
  arenaGuardianPhase2(a, f);
}
function emberbellEnter(a, f, phase) {
  const C = EB_ARENA;
  f.ebPhase = phase;
  f.ebAt = f.t;
  if (phase === 'warn') arenaEvent(a, { type: 'telegraph', id: f.id, steam: true, x0: f.x, y0: f.y, x1: a.ship.x, y1: a.ship.y, until: a.t + C.warn });
  else if (phase === 'blast') {
    if (a.ship.salvoUntil > a.t) {
      a.ship.salvoUntil = a.t;
      arenaEvent(a, { type: 'salvo-out' });
    }
    for (let i = 0; i < C.steamShots; i++) {
      if (a.foeShots.length >= ARENA.MAX_FOE_SHOTS) a.foeShots.shift();
      a.foeShots.push({ id: a.nextId++, kind: 'steam', from: f.id, x: f.x - f.r, y: 8 + (i / (C.steamShots - 1)) * (ARENA.H - 16), vx: -C.steamSpeed, vy: 0, r: 4, damage: f.atk * C.steamDamage, age: 0 });
    }
    arenaEvent(a, { type: 'steam', id: f.id });
  } else if (phase === 'cool') arenaEvent(a, { type: 'boss-open', id: f.id, until: a.t + C.cool });
  else {
    f.pressure = 0;
    arenaEvent(a, { type: 'boss-close', id: f.id });
  }
}
ARENA_BOSS_STEPS.emberbell = emberbellArenaStep;
ARENA_BOSS_DAMAGE.emberbell = (a, f, factor, { salvo }) => {
  if (f.ebPhase === 'cool') return factor * EB_ARENA.open;
  a.stats.reduced++;
  if (f.ebPhase === 'blast') return 0;
  if (salvo && f.ebPhase === 'build') f.pressure = Math.min(100, f.pressure + EB_ARENA.salvoPush);
  return factor * EB_ARENA.shield;
};

// Cogsworth-9 — the Taktband: everything runs on beats (0.9 s, 0.72 s in phase 2), eight beats to a cycle.
//   beat 0: two aimed Prüfbolzen, beat 2: one · beat 1 (phase 2): a Prüfkiste lobbed on a marked spot
//   beat 3: the Prüffenster announces itself (the housing light blinks) · beats 4–5: the housing is open — 180 %
//   beat 6: the Freigabelaser is announced (a red line along the ship's lane) · beat 7: the laser fires along it
//   otherwise his Ordnungsschild lets 30 % through.
//   Taktbruch: a Salve hit in the window or while open breaks his rhythm — the housing stays open for four beats
//   (once per cycle).
const CW_ARENA = { beat: 0.9, beat2: 0.72, beats: 8, bolts: [0, 2], crate: 1, window: 3, open: 4, openBeats: 2, laserWarn: 6, laser: 7, shield: 0.3, openFactor: 1.8, breakBeats: 4, laserDamage: 2, laserSpeed: 120, crateDamage: 1.2 };
function cwBeatLen(f) {
  return f.phase2 ? CW_ARENA.beat2 : CW_ARENA.beat;
}
function cogsworthArenaStep(a, f, def, dt) {
  const C = CW_ARENA;
  if (f.cwBeat === undefined) Object.assign(f, { cwBeat: -1, cwNext: 1, openUntil: 0, broke: false });
  arenaGuardianMove(f, def, dt, 0.6, 2.5, 0.35, 18);
  if (f.x <= f.anchor + 6 && f.t >= f.cwNext) {
    const len = cwBeatLen(f);
    f.cwNext = f.t + len;
    f.cwBeat = (f.cwBeat + 1) % C.beats;
    f.cwCount = (f.cwCount || 0) + 1; // beats so far (the conveyor advances one step per beat)
    const b = f.cwBeat;
    if (b === 0) f.broke = false;
    arenaEvent(a, { type: 'beat', id: f.id, beat: b });
    if (b === C.bolts[0]) for (const spread of [-0.07, 0.07]) arenaFoeShot(a, f, def, { kind: 'cog-bolt', spread });
    else if (C.bolts.includes(b)) arenaFoeShot(a, f, def, { kind: 'cog-bolt' });
    if (b === C.crate && f.phase2) arenaFoeShot(a, f, def, { kind: 'crate', lob: { flight: 1.3, radius: 7 }, damage: f.atk * C.crateDamage });
    if (b === C.window) arenaEvent(a, { type: 'boss-warn', id: f.id, kind: 'window' });
    if (b === C.open && f.t >= f.openUntil) {
      f.openUntil = f.t + C.openBeats * len;
      arenaEvent(a, { type: 'boss-open', id: f.id, until: a.t + C.openBeats * len });
    }
    if (b === C.laserWarn) {
      f.aimY = a.ship.y;
      arenaEvent(a, { type: 'telegraph', id: f.id, laser: true, x0: f.x, y0: f.aimY, x1: a.ship.x, y1: f.aimY, until: a.t + len });
    }
    if (b === C.laser) {
      if (a.foeShots.length >= ARENA.MAX_FOE_SHOTS) a.foeShots.shift();
      a.foeShots.push({ id: a.nextId++, kind: 'release-laser', from: f.id, x: f.x - f.r, y: f.aimY ?? a.ship.y, vx: -C.laserSpeed, vy: 0, r: 3.6, damage: f.atk * C.laserDamage, age: 0 });
      arenaEvent(a, { type: 'foe-fire', id: f.id, kind: 'release-laser' });
    }
  }
  arenaGuardianPhase2(a, f);
}
function cogsworthPhase(f) {
  if (f.t < f.openUntil) return f.broke ? 'broken' : 'open';
  return f.cwBeat === CW_ARENA.window ? 'window' : 'inspect';
}
ARENA_BOSS_STEPS.cogsworth = cogsworthArenaStep;
ARENA_BOSS_DAMAGE.cogsworth = (a, f, factor, { salvo }) => {
  const phase = cogsworthPhase(f);
  if (salvo && !f.broke && (phase === 'open' || phase === 'window')) {
    f.broke = true;
    f.openUntil = f.t + CW_ARENA.breakBeats * cwBeatLen(f);
    arenaEvent(a, { type: 'taktbruch', id: f.id, until: a.t + CW_ARENA.breakBeats * cwBeatLen(f) });
    return factor * CW_ARENA.openFactor;
  }
  if (phase === 'open' || phase === 'broken') return factor * CW_ARENA.openFactor;
  a.stats.reduced++;
  return factor * CW_ARENA.shield;
};

// Petalguard — the bloom cycle and her roots (10 s, 8.2 s in phase 2):
//   bud (0–0.55): closed petals let 30 % through (a Salve hit burns through: 90 %); three thorn volleys
//   0.45: the pollen storm is announced (a pink fan) · 0.6: seven slow pollen orbs in a fan (the shield blocks them)
//   bloom (0.55–0.85): open — 150 % · 0.86: she plants two root nodes (three in phase 2; at most four stand)
//   Every living root heals her 1 % every 2 s (a green line from the root) — the ship's gun can cut them, the player
//   decides with a tap whether to burn her bloom or her roots first.
const PG_ARENA = { length: 10, length2: 8.2, thorns: [0.08, 0.22, 0.36], telegraph: 0.45, burst: 0.6, bloom: [0.55, 0.85], burstShots: 7, burstSpread: 0.15, burstSpeed: 38, burstDamage: 1.1, roots: 0.86, rootCount: 2, rootCount2: 3, rootMax: 4, rootHp: 0.035, heal: 0.01, healEvery: 2, bud: 0.3, budSalvo: 0.9, open: 1.5 };
function petalguardArenaStep(a, f, def, dt) {
  const C = PG_ARENA,
    cyc = f.phase2 ? C.length2 : C.length,
    n = Math.floor(f.t / cyc),
    ct = (f.t % cyc) / cyc,
    ship = a.ship;
  if (f.nextHeal === undefined) Object.assign(f, { nextHeal: C.healEvery, bloomOpen: false, healed: 0 });
  arenaGuardianMove(f, def, dt, 0.7, 3, 0.4, 22);
  if (f.cycle !== n) {
    f.cycle = n;
    f.fired = 0;
  }
  const once = (bit, at) => ct >= at && !(f.fired & bit) && (f.fired |= bit);
  C.thorns.forEach((at, i) => {
    if (!once(1 << i, at)) return;
    for (const spread of [-0.12, 0, 0.12]) arenaFoeShot(a, f, def, { kind: 'thorn-shot', spread, speed: 72, r: 1.4 });
  });
  if (once(16, C.telegraph)) {
    f.aimY = ship.y;
    arenaEvent(a, { type: 'telegraph', id: f.id, pollen: true, x0: f.x, y0: f.y, x1: ship.x, y1: ship.y, until: a.t + (C.burst - C.telegraph) * cyc });
  }
  if (once(32, C.burst)) {
    const base = Math.atan2((f.aimY ?? ship.y) - f.y, ship.x - f.x);
    for (let i = 0; i < C.burstShots; i++) {
      const ang = base + (i - (C.burstShots - 1) / 2) * C.burstSpread;
      if (a.foeShots.length >= ARENA.MAX_FOE_SHOTS) a.foeShots.shift();
      a.foeShots.push({ id: a.nextId++, kind: 'pollen-orb', from: f.id, x: f.x - f.r, y: f.y, vx: Math.cos(ang) * C.burstSpeed, vy: Math.sin(ang) * C.burstSpeed, r: 3.2, damage: f.atk * C.burstDamage, age: 0 });
    }
    arenaEvent(a, { type: 'foe-fire', id: f.id, kind: 'pollen-orb' });
  }
  const open = ct >= C.bloom[0] && ct < C.bloom[1];
  if (open !== f.bloomOpen) {
    f.bloomOpen = open;
    arenaEvent(a, { type: open ? 'boss-open' : 'boss-close', id: f.id, until: a.t + (C.bloom[1] - ct) * cyc });
  }
  if (once(64, C.roots)) {
    const standing = a.foes.filter(o => o.kind === 'root' && o.hp > 0).length,
      want = Math.min(f.phase2 ? C.rootCount2 : C.rootCount, C.rootMax - standing);
    for (let i = 0; i < want; i++) petalguardRoot(a, f, i, want);
  }
  // living roots feed her
  if (f.t >= f.nextHeal) {
    f.nextHeal = f.t + C.healEvery;
    for (const r of a.foes) {
      if (r.kind !== 'root' || r.hp <= 0 || f.hp <= 0) continue;
      const before = f.hp;
      f.hp = Math.min(f.maxHp, f.hp + f.maxHp * C.heal);
      f.healed += f.hp - before;
      arenaEvent(a, { type: 'heal', id: r.id, to: f.id, x0: r.x, y0: r.y, x1: f.x, y1: f.y, amount: f.hp - before });
    }
  }
  arenaGuardianPhase2(a, f);
}
// one root node in front of her (spawned in place: it neither moves nor shoots)
function petalguardRoot(a, boss, i, n) {
  const root = arenaSpawn(a, 'root', true);
  const hp = Math.round(boss.maxHp * PG_ARENA.rootHp);
  Object.assign(root, {
    x: 90 + arenaRand(a) * 16,
    y: 14 + ((i + 0.5 + arenaRand(a) * 0.4 - 0.2) / n) * (ARENA.H - 28),
    hp,
    maxHp: hp,
    atk: 0,
    every: 999,
    nextShot: Infinity,
    anchor: 0
  });
  root.lane = root.y;
  root.px = root.x;
  root.py = root.y;
  return root;
}
ARENA_BOSS_STEPS.petalguard = petalguardArenaStep;
ARENA_BOSS_DAMAGE.petalguard = (a, f, factor, { salvo }) => {
  if (f.bloomOpen) return factor * PG_ARENA.open;
  a.stats.reduced++;
  return factor * (salvo ? PG_ARENA.budSalvo : PG_ARENA.bud);
};

// ----- the campaign mode for the three guardians (the classic paths stay for the dev-only classic mode) -----
const OUTER_GUARDIAN_KEY = { emberbell: 'volcanic', cogsworth: 'machine', petalguard: 'verdant' };
function guardianArena(guardian) {
  const key = OUTER_GUARDIAN_KEY[guardian];
  return Boolean(key && CAMPAIGN_FLAGS[key] && typeof campaignMode === 'function' && campaignMode() === 'arena');
}
