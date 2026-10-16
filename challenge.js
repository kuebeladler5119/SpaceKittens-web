// Beta 1.2 — Sektorprüfungen (schema 35): optional, replayable training fights against a Prüfdrohne of the Sternwarte.
// Logic only; routing, timers, dock and card live in challenge-ui.js. Loaded after combat-cat.js, before game.js.
//
// One fight at a time, resolved through the normal battle routing (ship shots, Boba's auto-battle, Tikki's strikes and
// Funkenhagel all land here while a challenge runs — no second damage engine). Difficulty scales with the player's plain
// ship shot at the start (`base`), so the fights stay fair at every stage and reward *specialisation* (aim, auto-battle,
// Tikki, abilities) rather than raw damage. Phases are pure functions of the start time (stable through reloads).
//
// Rewards (transparent, shown in the card): the first bronze / silver / gold result of each challenge pays one chest
// (Sternenkiste / Kometenkiste / Sternenrelikt, claim `challenge:<id>:<tier>` — exactly once); repeats pay Sternsplitter
// at most once per challenge every 20 minutes (no daily attendance, no farming loop). Normal bosses and story are untouched.

const CHALLENGE_REPEAT_MS = 20 * 60 * 1000;
const CHALLENGE_TIERS = ['bronze', 'silver', 'gold'];
const CHALLENGE_TIER_NAME = { bronze: 'Bronze', silver: 'Silber', gold: 'Gold' };
const CHALLENGE_TIER_CHEST = { bronze: 'standard', silver: 'elite', gold: 'relic' };
const CHALLENGE_REPEAT_SPLITTERS = { bronze: 4, silver: 8, gold: 12 };
const CHALLENGES = [
  {
    id: 'precision',
    name: 'Präzisionsprüfung',
    icon: '🎯',
    short: 'Triff den Schwachpunkt',
    text: 'Der Schwachpunkt der Prüfdrohne öffnet sich alle 5 s für 2,5 s: dort ×2 Schaden, sonst nur 35 %. Gezielte Schüsse zählen zusätzlich ×1,5.',
    durationMs: 45000,
    hp: 85, // × plain ship shot at the start (Beta 1.3: tuned for the ship's gun — taps no longer add shots)
    // victory faster than these shares of the time limit → silver / gold
    silver: 0.7,
    gold: 0.45
  },
  {
    id: 'endurance',
    name: 'Ausdauerprüfung',
    icon: '⏱',
    short: '60 s Dauerfeuer',
    text: '60 Sekunden Dauerfeuer auf einen Zielschild. Gewertet wird der Schaden relativ zu deinem Grundschuss – Boba, Tikki und der Funkenhagel zählen voll.',
    durationMs: 60000,
    score: { bronze: 70, silver: 135, gold: 200 } // × plain ship shot (Beta 1.3 gun tuning)
  },
  {
    id: 'reactor',
    name: 'Reaktorprüfung',
    icon: '☢',
    short: 'Nutze die Überladung',
    text: 'Alle 10 s überlädt der Reaktor für 4 s: normale Schüsse nur 50 %, aber Funkenhagel ×3 und Overcharge-Schüsse ×2. Spare deine Fähigkeiten für die Überladung.',
    durationMs: 60000,
    hp: 80, // Beta 1.3 gun tuning
    silver: 0.7,
    gold: 0.45
  }
];
const CHALLENGE_BY_ID = Object.fromEntries(CHALLENGES.map(c => [c.id, c]));

// meta.challenges = { active: null | {id, startedAt, endsAt, base, hp, maxHp, damage}, best: {id: tier}, claims: [],
//                     lastRewardAt: {id: ms}, runs, wins, last: null | {id, tier, splitters, chest, at} }
function normalizeChallenges(raw, now = Date.now()) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const num = (v, max) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0;
  };
  const best = {},
    lastRewardAt = {};
  for (const c of CHALLENGES) {
    if (CHALLENGE_TIERS.includes(src.best?.[c.id])) best[c.id] = src.best[c.id];
    // a clock set ahead must not lock repeats for longer than one cooldown
    const at = Math.floor(num(src.lastRewardAt?.[c.id], 1e15));
    lastRewardAt[c.id] = at > now + CHALLENGE_REPEAT_MS ? now : at;
  }
  let active = null;
  const a = src.active;
  if (a && typeof a === 'object' && CHALLENGE_BY_ID[a.id]) {
    const startedAt = Math.floor(num(a.startedAt, 1e15)),
      base = num(a.base, 1e300),
      maxHp = num(a.maxHp, 1e300);
    // only a plausible running fight survives (a broken one is dropped, never paid)
    if (startedAt > 0 && startedAt <= now + 60000 && base > 0)
      active = { id: a.id, startedAt, endsAt: startedAt + CHALLENGE_BY_ID[a.id].durationMs, base, maxHp, hp: Math.min(maxHp, num(a.hp, 1e300)), damage: num(a.damage, 1e300) };
  }
  const last = src.last && typeof src.last === 'object' && CHALLENGE_BY_ID[src.last.id] ? { id: src.last.id, tier: CHALLENGE_TIERS.includes(src.last.tier) ? src.last.tier : null, splitters: Math.floor(num(src.last.splitters, 1e6)), chest: ARSENAL_CHESTS[src.last.chest] ? src.last.chest : null, at: Math.floor(num(src.last.at, 1e15)) } : null;
  return {
    active,
    best,
    claims: Array.isArray(src.claims) ? [...new Set(src.claims.filter(c => typeof c === 'string' && c.startsWith('challenge:')))].slice(0, 100) : [],
    lastRewardAt,
    runs: Math.floor(num(src.runs, 1e9)),
    wins: Math.floor(num(src.wins, 1e9)),
    last
  };
}
function challenges() {
  return state.meta.challenges;
}
function challengeActive() {
  return Boolean(state.meta?.challenges?.active);
}
// Unlock: Tikki flies (P.I.P.S. repaired) and Frostbyte is repaired — two guardians known, the crew is complete.
function challengesUnlocked() {
  return Boolean(state.meta?.combatCat?.unlocked) && state.meta?.guardians?.frostbyte?.stage === 'repaired';
}
function challengeGuardianFight() {
  const g = state.meta?.guardians;
  return ARSENAL_GUARDIANS.some(id => g?.[id]?.stage === 'battle');
}
function challengeStartBlocked(id) {
  if (!CHALLENGE_BY_ID[id]) return 'Unbekannte Prüfung';
  if (!challengesUnlocked()) return 'Freigeschaltet, sobald Tikki mitfliegt und Frostbyte repariert ist';
  if (challengeActive()) return 'Eine Prüfung läuft bereits';
  if (typeof campaignRunning === 'function' && campaignRunning()) return 'Erst die laufende Welle beenden';
  if (challengeGuardianFight()) return 'Erst den laufenden Wächterkampf beenden';
  return null;
}

// ----- phases (pure functions of the start time) -----
function challengePhase(active, now = Date.now()) {
  if (!active) return null;
  const t = Math.max(0, now - active.startedAt);
  if (active.id === 'precision') {
    const inCycle = t % 5000;
    return inCycle >= 2500 ? { name: 'window', left: 5000 - inCycle } : { name: 'cover', left: 2500 - inCycle };
  }
  if (active.id === 'reactor') {
    const inCycle = t % 10000;
    return inCycle >= 6000 ? { name: 'overload', left: 10000 - inCycle } : { name: 'stable', left: 6000 - inCycle };
  }
  return { name: 'fire', left: Math.max(0, active.endsAt - now) };
}
// The factor for one hit: source is 'ship' (tap or auto-battle), 'cat', 'cat-ability' or 'burst'.
function challengeFactor(active, source, { aimed = false, overcharged = false } = {}, now = Date.now()) {
  const phase = challengePhase(active, now)?.name;
  if (active.id === 'precision') return (phase === 'window' ? 2 : 0.35) * (source === 'ship' && aimed ? 1.5 : 1);
  if (active.id === 'reactor') {
    if (phase !== 'overload') return 1;
    if (source === 'cat-ability') return 3;
    if (source === 'ship' && overcharged) return 2;
    return 0.5;
  }
  return 1;
}

// ----- start, hit, finish -----
function challengeStart(id, now = Date.now()) {
  if (challengeStartBlocked(id)) return false;
  const c = CHALLENGE_BY_ID[id],
    base = Math.max(1, shipPlainDamage()),
    maxHp = c.hp ? base * c.hp : 0;
  challenges().active = { id, startedAt: now, endsAt: now + c.durationMs, base, maxHp, hp: maxHp, damage: 0 };
  challenges().runs += 1;
  return true;
}
function challengeHit(damage) {
  const active = challenges().active;
  if (!active || !(damage > 0)) return 0;
  active.damage += damage;
  if (active.maxHp) active.hp = Math.max(0, active.hp - damage);
  return damage;
}
// The tier a finished (or running) fight has reached; null = not passed.
function challengeTier(active, now = Date.now()) {
  const c = CHALLENGE_BY_ID[active.id];
  if (c.score) {
    const score = active.damage / active.base;
    return CHALLENGE_TIERS.slice().reverse().find(tier => score >= c.score[tier]) || null;
  }
  if (active.hp > 0) return null;
  const used = (Math.min(now, active.endsAt) - active.startedAt) / c.durationMs;
  return used <= c.gold ? 'gold' : used <= c.silver ? 'silver' : 'bronze';
}
// Ends the fight when its target is destroyed or its time is up (or when the player gives up). Exactly one result is
// written; rewards: the first time a tier is reached → its chest (claim ledger); otherwise splitters on a cooldown.
function challengeResolve(now = Date.now(), { abort = false } = {}) {
  const ch = challenges(),
    active = ch.active;
  if (!active) return null;
  const c = CHALLENGE_BY_ID[active.id],
    done = (c.hp && active.hp <= 0) || now >= active.endsAt || abort;
  if (!done) return null;
  const tier = abort ? null : challengeTier(active, now);
  ch.active = null;
  const result = { id: c.id, tier, splitters: 0, chest: null, at: now };
  if (tier) {
    ch.wins += 1;
    if (!ch.best[c.id] || CHALLENGE_TIERS.indexOf(tier) > CHALLENGE_TIERS.indexOf(ch.best[c.id])) ch.best[c.id] = tier;
    // every tier up to the reached one can pay its first-time chest (a gold first run pays all three)
    for (const t of CHALLENGE_TIERS.slice(0, CHALLENGE_TIERS.indexOf(tier) + 1)) {
      const key = 'challenge:' + c.id + ':' + t;
      if (ch.claims.includes(key)) continue;
      ch.claims.push(key);
      const chestKey = ARSENAL_CHESTS[CHALLENGE_TIER_CHEST[t]].key;
      state.meta.arsenal[chestKey] += 1;
      result.chest = CHALLENGE_TIER_CHEST[t]; // the best newly paid chest is shown
      result.chests = (result.chests || 0) + 1;
    }
    if (!result.chests && now - (ch.lastRewardAt[c.id] || 0) >= CHALLENGE_REPEAT_MS) {
      result.splitters = CHALLENGE_REPEAT_SPLITTERS[tier];
      state.meta.arsenal.splitters += result.splitters;
      ch.lastRewardAt[c.id] = now;
    }
    if (result.chests) ch.lastRewardAt[c.id] = now;
  }
  ch.last = { id: result.id, tier: result.tier, splitters: result.splitters, chest: result.chest, at: now };
  return result;
}
function challengeRepeatLeftMs(id, now = Date.now()) {
  return Math.max(0, (challenges().lastRewardAt[id] || 0) + CHALLENGE_REPEAT_MS - now);
}
