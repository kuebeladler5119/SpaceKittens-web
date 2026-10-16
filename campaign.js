// Beta 1.3 — Feldzüge (schema 36): planetary wave campaigns that lead to a planet's guardian. Logic only; routing, the
// gun clock, card, dock and plate live in campaign-ui.js / combat-gun.js. Loaded after challenge.js, before game.js.
//
// A campaign is a fixed list of waves; a wave is a queue of story enemies with their own small mechanic (armour, seal
// shield, reinforcement call, swarm). The ship fires on its own (combat-gun.js) — taps only fire the loaded shot early,
// so tapping faster never adds damage. Every hit (ship, Boba, Tikki, burst) is resolved through the normal battle
// routing; attack() stays the only damage source (the wave enemy's weakness feeds weaponBonus()).
//
// The enemies shoot back (owner request): every enemy fires at the ship on its own rhythm; the ship's hull points
// (`shipHullMax`, more with each hull module) are full at the start of every wave; at 0 the wave is lost (the ship
// retreats for repairs — nothing is paid, nothing is taken). Boba as pilot reduces the damage the ship takes by 20 % (a fixed reduction, not a random dodge).
// Time: all of this runs in *fight seconds* (`run.t`), advanced by the gun clock only while the fight is on screen
// and the app is visible — the wave pauses everywhere else (no offline combat, no offline loot, no loss while away).
// Rewards: the first clear of a wave pays once (claim `wave:<campaign>:<n>`; Credits, crystals, some waves a chest).
// A failed wave costs nothing — the ship retreats, the player upgrades and tries again.
//
// Only Orion's campaign ("Die M.O.T.T.E.-Inspektion", 9 waves → P.I.P.S.) is defined and enabled. Other planets keep
// their existing guardian stories until their campaigns are written (CAMPAIGN_FLAGS).

const CAMPAIGN_FLAGS = { crystal: true, ice: true }; // Beta 1.5: Glacies' Frostwacht (arena)
const WAVE_SCALE = 0.3; // + per wave on every enemy's HP
const WAVE_PAUSE_MS = 2500; // pause between two waves of an automatic run
const WAVE_SAFETY_SECONDS = 300; // a wave that nobody can finish ends here (enemies always shoot, so it never should)
const HULL_BASE = 100,
  HULL_PER_LEVEL = 40; // ship hull points: base + per hull module level (max 20 levels)
const ENEMY_DAMAGE_SCALE = 0.12; // + per wave on every enemy shot
const ENEMY_FIRST_SHOT = 1.2; // seconds after an enemy appears
const BOBA_DODGE = 0.8; // Boba flies: the ship takes 20 % less damage (fixed reduction)

// Orion's inspection force (M.O.T.T.E. bureaucracy robots). hp = base HP before the wave scale.
const CAMPAIGN_ENEMIES = {
  stamp: { name: 'Stempeldrohne', hp: 30, atk: 5, every: 2.5, shot: 'stamp', weakness: 'Laser', tip: 'Stempelt alles, was glänzt. Schießt Stempelbolzen. Kein Panzer.' },
  moth: { name: 'Formularfalter', hp: 12, atk: 2, every: 1.6, shot: 'paper', weakness: 'Arc', tip: 'Papierfalter im Schwarm – schnell erledigt, aber ihre Papierschnitte summieren sich.' },
  clip: { name: 'Klemmbrett-Käfer', hp: 45, atk: 7, every: 3, shot: 'clip', weakness: 'Ion', armor: 0.5, tip: 'Panzerplatte: je nach Waffe gehen 35–85 % durch (schwere Granaten am besten). Zielschuss und Overcharge gehen ganz durch.' },
  scan: { name: 'Messdrohne', hp: 35, atk: 4, every: 2, shot: 'laser', weakness: 'Laser', callAfter: 8, tip: 'Ruft nach 8 s eine Stempeldrohne zur Verstärkung – schnell ausschalten!' },
  // Beta 1.5 · Glacies: the Frostwacht — Frostbyte's frost drones (arena campaign; the classic engine is dev-only)
  flake: { name: 'Frostflocke', hp: 20, atk: 3, every: 1.7, shot: 'paper', weakness: 'Arc', tip: 'Schwarm aus Eisflocken – stürzt sich aufs Schiff. Schildpuls fängt den Aufprall ab.' },
  shard: { name: 'Eiszapfen-Drohne', hp: 46, atk: 6, every: 2.3, shot: 'laser', weakness: 'Plasma', tip: 'Wirft schnelle, gezielte Eiszapfen. Kein Panzer – Thermo-Waffen treffen sie stark.' },
  glacier: { name: 'Gletscherpanzer', hp: 92, atk: 9, every: 3.2, shot: 'clip', weakness: 'Ion', armor: 0.45, tip: 'Dicke Eisplatten: je nach Waffe gehen 35–85 % durch. Die Salve geht ganz durch.' },
  chill: { name: 'Kältenebler', hp: 52, atk: 4, every: 2.8, shot: 'laser', weakness: 'Laser', chill: 2.5, tip: 'Seine Nebelkugeln unterkühlen das Schiff: 2,5 s nur 60 % Feuerrate. Schildpuls blockt sie, die Salve taut auf.' },
  warden: { name: 'Eiswächter', hp: 300, atk: 10, every: 4, shot: 'seal', weakness: 'Ion', elite: true, shield: { every: 6, warn: 3, from: 4, factor: 0.25, breakFor: 2.5 }, tip: 'Frostschild (nur 25 %). Die Salve bricht es für 2,5 s.' },
  seal: { name: 'Siegelkreuzer', hp: 240, atk: 9, every: 4, shot: 'seal', weakness: 'Plasma', elite: true, shield: { every: 6, warn: 3, from: 4, factor: 0.25, breakFor: 2.5 }, tip: 'Siegelschild (nur 25 %). Ein Zielschuss bricht es für 2,5 s.' }
};
const CAMPAIGNS = {
  crystal: {
    planet: 0,
    guardian: 'pips',
    title: 'Die M.O.T.T.E.-Inspektion',
    short: 'Orion · Feldzug',
    waves: [
      { name: 'Erste Stichprobe', foes: ['stamp', 'stamp', 'stamp'], reward: { credits: 250, crystals: 1 }, line: ['boba', 'Drei Stempeldrohnen! Das Bordgeschütz feuert von selbst – ich halte uns auf Kurs.'] },
      { name: 'Papierkram', foes: ['moth', 'moth', 'moth', 'moth', 'stamp'], reward: { credits: 400, crystals: 1 }, line: ['mochi', 'Ein ganzer Schwarm Formulare … die flattern ja überall!'] },
      { name: 'Gepanzerte Akten', foes: ['stamp', 'clip', 'stamp', 'clip'], reward: { credits: 600, crystals: 1, chest: 'standard' }, line: ['boba', 'Klemmbrett-Käfer mit Panzerplatte. Zielen oder Overcharge geht glatt durch.'] },
      { name: 'Die Messung', foes: ['moth', 'scan', 'moth', 'scan', 'moth'], reward: { credits: 800, crystals: 1 }, line: ['mochi', 'Die Messdrohnen rufen Verstärkung, wenn wir zu lange brauchen!'] },
      { name: 'Der Siegelkreuzer', foes: ['stamp', 'stamp', 'seal'], reward: { credits: 1200, crystals: 2, chest: 'elite' }, line: ['boba', 'Ein Siegelkreuzer! Wenn sein Siegel leuchtet: Zielschuss – das bricht den Schild.'] },
      { name: 'Formular 7-B', foes: ['moth', 'moth', 'clip', 'moth', 'moth', 'clip', 'moth', 'moth'], reward: { credits: 1500, crystals: 1, chest: 'standard' }, line: ['mochi', 'Formular 7-B … in dreifacher Ausfertigung. Ich glaube, die meinen das ernst.'] },
      { name: 'Doppelte Prüfung', foes: ['scan', 'clip', 'stamp', 'scan', 'clip', 'stamp'], reward: { credits: 1900, crystals: 2 }, line: ['boba', 'Zwei Messdrohnen gleichzeitig – die zuerst, sonst wird es voll hier.'] },
      { name: 'Dreifache Ausfertigung', foes: ['clip', 'moth', 'scan', 'clip', 'moth', 'scan', 'clip', 'moth'], reward: { credits: 2400, crystals: 2 }, line: ['mochi', 'Noch eine Welle, dann muss P.I.P.S. selbst kommen!'] },
      { name: 'Die letzte Instanz', foes: ['clip', 'scan', 'seal', 'clip', 'scan', 'seal'], reward: { credits: 3200, crystals: 3, chest: 'standard' }, line: ['boba', 'Die letzte Instanz – zwei Siegelkreuzer. Spar dir Zielen für ihre Schilde auf.'] }
    ]
  },
  // Beta 1.5: Glacies Niva — the Frostwacht guards the heat network until Frostbyte faces the kittens himself. Opens when
  // the heat network runs (Frostbyte's stage 'drones'); the nine waves replace the two classic frost drones. Stronger
  // than Orion (hpScale/dmgScale on every enemy), tuned with tools/arena-balance.mjs.
  ice: {
    planet: 1,
    guardian: 'frostbyte',
    title: 'Die Große Stille',
    short: 'Glacies · Feldzug',
    hpScale: 2.6,
    dmgScale: 1.5,
    waves: [
      { name: 'Erster Frost', foes: ['flake', 'flake', 'shard', 'flake', 'flake'], reward: { credits: 900, crystals: 1 }, line: ['flocke', 'Frostflocken! Die stürzen sich direkt auf euer Schiff – Schildpuls bereithalten!'] },
      { name: 'Eiszapfenregen', foes: ['shard', 'shard', 'flake', 'shard'], reward: { credits: 1300, crystals: 1 }, line: ['boba', 'Eiszapfen-Drohnen zielen genau. Bleib in Bewegung – ich halte die Spur.'] },
      { name: 'Gletscherfront', foes: ['glacier', 'shard', 'glacier', 'flake', 'flake'], reward: { credits: 1800, crystals: 1, chest: 'standard' }, line: ['mochi', 'Gletscherpanzer! Schwere Granaten oder die Salve kommen durch das Eis.'] },
      { name: 'Kältenebel', foes: ['chill', 'flake', 'flake', 'chill', 'shard'], reward: { credits: 2400, crystals: 2 }, line: ['flocke', 'Der Nebel macht das Geschütz träge. Die Salve taut es wieder auf!'] },
      { name: 'Der Eiswächter', foes: ['shard', 'shard', 'warden'], reward: { credits: 3200, crystals: 2, chest: 'elite' }, line: ['boba', 'Ein Eiswächter mit Frostschild. Wenn sein Kristall glüht: Salve, und das Schild bricht.'] },
      { name: 'Schneesturm', foes: ['flake', 'flake', 'flake', 'flake', 'chill', 'flake', 'flake', 'flake'], reward: { credits: 4000, crystals: 2, chest: 'standard' }, line: ['mochi', 'Ein ganzer Schneesturm aus Flocken … zum Glück schmelzen sie schnell.'] },
      { name: 'Eisige Allianz', foes: ['glacier', 'chill', 'shard', 'glacier', 'chill', 'shard'], reward: { credits: 5000, crystals: 2 }, line: ['flocke', 'Panzer und Nebel zusammen – erst die Nebler, sonst bleibt das Geschütz kalt.'] },
      { name: 'Weißer Horizont', foes: ['chill', 'glacier', 'flake', 'flake', 'warden', 'flake'], reward: { credits: 6200, crystals: 3 }, line: ['boba', 'Noch eine Welle, dann stellt sich Frostbyte. Ich kann seine Kälte schon spüren.'] },
      { name: 'Die Große Stille', foes: ['glacier', 'chill', 'shard', 'warden', 'glacier', 'flake', 'flake'], reward: { credits: 8000, crystals: 3, chest: 'standard' }, line: ['flocke', 'Die letzte Wacht vor dem Wärmenetz. Danach kommt Frostbyte selbst.'] }
    ]
  }
};
// a campaign opens with its guardian's story (Orion: once P.I.P.S. warns; Glacies: once the heat network runs)
const CAMPAIGN_OPEN_STAGES = { ice: ['drones', 'battle', 'defeated', 'repaired'] };

// ----- state: meta.campaign = { cleared: {key: n}, claims: [], run: null|{…}, wins, fails, last } -----
function normalizeCampaign(raw, guardians, now = Date.now(), ship = null) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const num = (v, max) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(max, Math.floor(n))) : 0;
  };
  const cleared = {};
  for (const [key, c] of Object.entries(CAMPAIGNS)) {
    let n = num(src.cleared?.[key], c.waves.length);
    // a guardian that is already fighting or beaten means its campaign is behind the player (never take progress away)
    const stage = guardians?.[c.guardian]?.stage;
    if (['battle', 'defeated', 'repaired'].includes(stage)) n = c.waves.length;
    cleared[key] = n;
  }
  let run = null;
  const r = src.run;
  if (r && typeof r === 'object' && CAMPAIGNS[r.key]) {
    const c = CAMPAIGNS[r.key],
      wave = num(r.wave, c.waves.length - 1),
      queue = Array.isArray(r.queue) ? r.queue.filter(k => CAMPAIGN_ENEMIES[k]).slice(0, 40) : [],
      index = num(r.index, 40);
    // only a plausible running wave survives (a broken one is dropped, never paid); it continues paused
    if (wave === cleared[r.key] && wave < c.waves.length && index < queue.length) {
      const maxHp = waveEnemyHp(r.key, wave, queue[index]);
      run = {
        key: r.key,
        wave,
        queue,
        index,
        hp: Math.min(maxHp, Math.max(0, Number(r.hp) || maxHp)),
        maxHp,
        t: Math.min(600, Math.max(0, Number(r.t) || 0)),
        foeT: Math.min(600, Math.max(0, Number(r.foeT) || 0)),
        nextShot: Math.min(600, Math.max(0, Number(r.nextShot) || ENEMY_FIRST_SHOT)),
        hullMax: shipHullMax(ship),
        hull: Math.min(shipHullMax(ship), Math.max(1, Number(r.hull) || shipHullMax(ship))),
        brokenUntil: 0,
        called: Array.isArray(r.called) ? r.called.filter(i => Number.isInteger(i) && i >= 0 && i < 40).slice(0, 40) : [],
        kills: num(r.kills, 100)
      };
    }
  }
  const last = src.last && typeof src.last === 'object' && CAMPAIGNS[src.last.key] ? { key: src.last.key, wave: num(src.last.wave, 40), won: Boolean(src.last.won), at: num(src.last.at, 1e15) } : null;
  return {
    cleared,
    claims: Array.isArray(src.claims) ? [...new Set(src.claims.filter(c => typeof c === 'string' && c.startsWith('wave:')))].slice(0, 200) : [],
    run,
    auto: src.auto === undefined ? true : Boolean(src.auto),
    mode: src.mode === 'classic' ? 'classic' : 'arena', // Beta 1.4: Combat 2.0 arena by default, classic selectable
    arenaWins: num(src.arenaWins, 1e9),
    wins: num(src.wins, 1e9),
    fails: num(src.fails, 1e9),
    last,
    // Beta 1.6: Rückenwind — lost attempts per target ('<key>:<wave>' or '<key>:boss'), reset by the win
    assist: Object.fromEntries(
      Object.entries(src.assist && typeof src.assist === 'object' ? src.assist : {})
        .filter(([id]) => /^[a-z]+:(\d+|boss)$/.test(id) && CAMPAIGNS[id.split(':')[0]])
        .map(([id, n]) => [id, num(n, CAMPAIGN_ASSIST.max)])
        .filter(([, n]) => n > 0)
        .slice(0, 60)
    )
  };
}
// Beta 1.6: Rückenwind — after each lost attempt at the same wave or guardian its enemies come with 5 % less hull and
// 4 % less damage (at most six losses: −30 % / −24 %); the win resets it. Visible in the expedition prep. Nothing else
// changes: no reward, no skip, the next target starts without it.
const CAMPAIGN_ASSIST = { max: 6, hp: 0.05, dmg: 0.04 };
function campaignAssist(key, target) {
  return Math.min(CAMPAIGN_ASSIST.max, state.meta?.campaign?.assist?.[key + ':' + target] || 0);
}
function campaignAssistFactors(n) {
  return { hp: 1 - CAMPAIGN_ASSIST.hp * n, dmg: 1 - CAMPAIGN_ASSIST.dmg * n };
}
function campaignAssistRecord(key, target, won) {
  const cs = state.meta?.campaign;
  if (!cs) return;
  cs.assist = cs.assist || {};
  const id = key + ':' + target;
  if (won) delete cs.assist[id];
  else cs.assist[id] = Math.min(CAMPAIGN_ASSIST.max, (cs.assist[id] || 0) + 1);
}
function campaignState() {
  return state.meta.campaign;
}
function campaignRun() {
  return state.meta?.campaign?.run || null;
}
// a classic wave or a Combat 2.0 arena wave (arena-ui.js) — either blocks the other fight modes
function campaignRunning() {
  return Boolean(campaignRun()) || (typeof arenaActive === 'function' && arenaActive());
}
function campaignKeyFor(planet = state.activePlanet) {
  const id = PLANETS[planet]?.id;
  return id && CAMPAIGNS[id] && CAMPAIGN_FLAGS[id] ? id : null;
}
function campaignDef(key) {
  return CAMPAIGNS[key] || null;
}
function campaignCleared(key) {
  return state.meta?.campaign?.cleared?.[key] || 0;
}
function campaignComplete(key) {
  const c = CAMPAIGNS[key];
  return Boolean(c) && campaignCleared(key) >= c.waves.length;
}
// The campaign that currently stands between the player and this guardian (null = the old story path applies).
function campaignLeadsTo(guardian) {
  const key = Object.keys(CAMPAIGNS).find(k => CAMPAIGNS[k].guardian === guardian);
  return key && CAMPAIGN_FLAGS[key] ? key : null;
}
// A campaign opens with its planet's guardian story (Orion: the M.O.T.T.E. warning when the Frachtdock stands).
function campaignOpen(key) {
  const c = CAMPAIGNS[key];
  if (!c || !CAMPAIGN_FLAGS[key]) return false;
  const stage = state.meta?.guardians?.[c.guardian]?.stage;
  if (CAMPAIGN_OPEN_STAGES[key]) return CAMPAIGN_OPEN_STAGES[key].includes(stage);
  return stage !== undefined && stage !== 'locked';
}
function waveEnemyHp(key, wave, kind) {
  return Math.round(CAMPAIGN_ENEMIES[kind].hp * (1 + WAVE_SCALE * wave) * (CAMPAIGNS[key]?.hpScale || 1));
}
function shipHullMax(ship = state.ship) {
  return HULL_BASE + HULL_PER_LEVEL * Math.min(20, ship?.hull || 0);
}
// one enemy shot against the ship in this wave (Boba's 20 % damage reduction included)
function enemyShotDamage(key, wave, kind) {
  return CAMPAIGN_ENEMIES[kind].atk * (1 + ENEMY_DAMAGE_SCALE * wave) * (CAMPAIGNS[key]?.dmgScale || 1) * (typeof crewActive === 'function' && crewActive(1) ? BOBA_DODGE : 1);
}
function waveTotalHp(key, wave) {
  return CAMPAIGNS[key].waves[wave].foes.reduce((sum, kind) => sum + waveEnemyHp(key, wave, kind), 0);
}
function campaignStartBlocked(key) {
  const c = CAMPAIGNS[key];
  if (!c || !CAMPAIGN_FLAGS[key]) return 'Kein Feldzug auf diesem Planeten';
  if (!campaignOpen(key)) return 'Der Feldzug beginnt mit der Geschichte dieses Planeten';
  if (campaignRunning()) return 'Eine Welle läuft bereits';
  if (state.meta?.challenges?.active) return 'Erst die Sektorprüfung beenden';
  const g = state.meta?.guardians;
  if (typeof ARSENAL_GUARDIANS !== 'undefined' && ARSENAL_GUARDIANS.some(id => g?.[id]?.stage === 'battle')) return 'Erst den laufenden Wächterkampf beenden';
  if (campaignComplete(key)) return 'Alle Wellen geschafft';
  return null;
}
// Starts the next uncleared wave of a campaign.
function campaignStart(key, now = Date.now()) {
  if (campaignStartBlocked(key)) return false;
  const wave = campaignCleared(key),
    queue = CAMPAIGNS[key].waves[wave].foes.slice();
  campaignState().run = { key, wave, queue, index: 0, hp: waveEnemyHp(key, wave, queue[0]), maxHp: waveEnemyHp(key, wave, queue[0]), t: 0, foeT: 0, nextShot: ENEMY_FIRST_SHOT, hull: shipHullMax(), hullMax: shipHullMax(), brokenUntil: 0, called: [], kills: 0 };
  return true;
}
// The enemy the ship is shooting at (for weaponBonus and the plate); null without a running wave.
function campaignFoe() {
  const run = campaignRun();
  if (!run) return null;
  const kind = run.queue[run.index],
    e = CAMPAIGN_ENEMIES[kind];
  return { kind, name: e.name, weakness: e.weakness, boss: Boolean(e.elite), elite: Boolean(e.elite) };
}

// ----- mechanics (pure functions of the fight time of the current enemy) -----
function sealPhase(run) {
  const e = CAMPAIGN_ENEMIES[run.queue[run.index]];
  if (!e.shield) return null;
  if (run.foeT < run.brokenUntil) return 'broken';
  const at = run.foeT % e.shield.every;
  return at >= e.shield.from ? 'shield' : at >= e.shield.warn ? 'warn' : 'open';
}
// Damage factor for one hit: source 'ship' | 'cat' | 'cat-ability' | 'burst'. Aimed/overcharged ship shots pierce
// armour; an aimed shot breaks a seal shield (and does full damage).
function campaignFactor(run, source, { aimed = false, overcharged = false } = {}) {
  const e = CAMPAIGN_ENEMIES[run.queue[run.index]];
  const pierce = source === 'ship' && (aimed || overcharged);
  if (e.armor && !pierce) return e.armor;
  if (e.shield && sealPhase(run) === 'shield') return source === 'ship' && aimed ? 1 : e.shield.factor;
  return 1;
}
// Applies one hit; returns { damage, killed, cleared, factor, shieldBroken }.
function campaignHit(baseDamage, source, opts = {}) {
  const run = campaignRun();
  if (!run || !(baseDamage > 0)) return null;
  const e = CAMPAIGN_ENEMIES[run.queue[run.index]],
    shielded = Boolean(e.shield) && sealPhase(run) === 'shield',
    factor = campaignFactor(run, source, opts),
    damage = baseDamage * factor;
  let shieldBroken = false;
  if (shielded && source === 'ship' && opts.aimed) {
    run.brokenUntil = run.foeT + e.shield.breakFor;
    shieldBroken = true;
  }
  const hpBefore = run.hp;
  run.hp = Math.max(0, run.hp - damage);
  // fight statistics for the defeat analysis (not saved beyond the run)
  run.hits = (run.hits || 0) + 1;
  if (factor < 1) {
    run.reduced = (run.reduced || 0) + 1;
    run.reducedBy = run.reducedBy || {};
    run.reducedBy[e.shield ? 'shield' : 'armor'] = (run.reducedBy[e.shield ? 'shield' : 'armor'] || 0) + 1;
  }
  run.dealt = (run.dealt || 0) + (hpBefore - run.hp);
  const out = { damage, factor, killed: false, cleared: false, shieldBroken, shielded: shielded && !shieldBroken, kind: run.queue[run.index], elite: Boolean(e.elite) };
  if (run.hp <= 0) {
    out.killed = true;
    run.kills += 1;
    run.index += 1;
    if (run.index >= run.queue.length) out.cleared = true;
    else campaignSpawn(run);
  }
  return out;
}
function campaignSpawn(run) {
  const hp = waveEnemyHp(run.key, run.wave, run.queue[run.index]);
  run.hp = hp;
  run.maxHp = hp;
  run.foeT = 0;
  run.nextShot = ENEMY_FIRST_SHOT;
  run.brokenUntil = 0;
}
// Advances the fight clock by dt seconds (only while the fight is on screen). Returns events: { called, failed }.
function campaignAdvance(dt) {
  const run = campaignRun();
  if (!run || !(dt > 0)) return null;
  run.t += dt;
  run.foeT += dt;
  const e = CAMPAIGN_ENEMIES[run.queue[run.index]],
    out = { called: false, failed: false, shots: [], reason: null };
  // the enemy shoots back on its rhythm (several shots if the tick was long)
  while (run.foeT >= run.nextShot && run.hull > 0) {
    const damage = enemyShotDamage(run.key, run.wave, run.queue[run.index]);
    run.hull = Math.max(0, run.hull - damage);
    run.taken = (run.taken || 0) + damage;
    run.nextShot += e.every;
    out.shots.push({ kind: run.queue[run.index], shot: e.shot, damage, hull: run.hull, hullMax: run.hullMax });
  }
  if (run.hull <= 0) {
    out.failed = true;
    out.reason = 'hull';
    return out;
  }
  // a Messdrohne that survives long enough calls one Stempeldrohne (once per drone)
  if (e.callAfter && run.foeT >= e.callAfter && !run.called.includes(run.index) && run.queue.length < 40) {
    run.called.push(run.index);
    run.queue.push('stamp');
    out.called = true;
  }
  if (run.t >= WAVE_SAFETY_SECONDS) {
    out.failed = true;
    out.reason = 'time';
  }
  return out;
}
// Ends the running wave: won → first-clear rewards (claim ledger) and progress; lost/abort → nothing is paid.
function campaignResolve(won, now = Date.now()) {
  const cs = campaignState(),
    run = cs.run;
  if (!run) return null;
  cs.run = null;
  const c = CAMPAIGNS[run.key],
    w = c.waves[run.wave],
    result = { key: run.key, wave: run.wave, name: w.name, won, credits: 0, crystals: 0, chest: null, first: false, guardianNext: false, at: now };
  if (won) {
    cs.wins += 1;
    const claim = 'wave:' + run.key + ':' + run.wave;
    if (!cs.claims.includes(claim)) {
      cs.claims.push(claim);
      result.first = true;
      result.credits = w.reward.credits || 0;
      result.crystals = w.reward.crystals || 0;
      earn(result.credits);
      state.crystals += result.crystals;
      if (w.reward.chest && typeof ARSENAL_CHESTS !== 'undefined' && ARSENAL_CHESTS[w.reward.chest]) {
        state.meta.arsenal[ARSENAL_CHESTS[w.reward.chest].key] += 1;
        result.chest = w.reward.chest;
      }
    }
    cs.cleared[run.key] = Math.max(cs.cleared[run.key] || 0, run.wave + 1);
    result.guardianNext = cs.cleared[run.key] >= c.waves.length;
  } else cs.fails += 1;
  cs.last = { key: run.key, wave: run.wave, won, at: now };
  return result;
}
