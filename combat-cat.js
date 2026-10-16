// Combat crew (Beta 1.1, schema 34): Tikki and her Funkengleiter — the first cat that fights. Logic only; routing,
// timers and UI live in combat-cat-ui.js. Loaded after arsenal.js and before game.js. Doc: docs/beta-1-1/COMBAT_CREW.md.
//
// Canon: Tikki (Technik, red tinkerer with goggles) repaired P.I.P.S.; from its spare parts she builds a small glider and
// flies next to the ship. Mochi (main character) and Boba (defence, flies the ship, auto-battle) keep their roles.
//
// Damage model — one extension point, no second damage engine:
//   * attack() stays authoritative. A Tikki strike is resolved through the normal battle routing (ladder enemy or the
//     active guardian with its own phase factor) with attack() overridden to the strike's damage for that one call.
//   * A strike is never "aimed" and never "overcharged" (the player's Aim/Overcharge stay untouched and unused), it does
//     not change the combo, never wilts Petalguard's petals, never cracks Frostbyte's plates, never builds Emberbell's
//     pressure and never answers Cogsworth's Taktband — those decisions stay with the player.
//   * Ship shots get one extra bounded factor from Tikki's support effects (mark × charge ≤ 1.5); the Splitterladung
//     burst is a separate strike. Order: attack() [incl. arsenal % factor ≤ 1.75] × shipShotEffectFactor() [≤ 1.5].

const TIKKI = {
  strikeEveryMs: 3000, // automatic Funkenbolzen
  strikeFactor: 0.4, // × a plain ship shot (no Aim, no Overcharge)
  abilityStrikes: 5, // Funkenhagel: a volley of five bolts
  abilityGapMs: 400,
  abilityFactor: 1.0,
  abilityCooldownMs: 40000,
  abilityMinCooldownMs: 25000, // Werkzeuggürtel & co. never go below this
  markMs: 6000, // Markierung on the target
  chargeMs: 8000, // a charge waits this long for the next ship shot
  effectCap: 1.5 // mark × charge on one ship shot
};

// meta.combatCat = { unlocked, abilityReadyAt (epoch ms), strikes, volleys }
function normalizeCombatCat(raw, now = Date.now()) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const num = (v, max) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(max, Math.floor(n))) : 0;
  };
  const ready = num(src.abilityReadyAt, 1e15);
  return {
    unlocked: Boolean(src.unlocked),
    // a clock that was set ahead must not lock the ability: at most one full cooldown into the future
    abilityReadyAt: ready > now + TIKKI.abilityCooldownMs ? now : ready,
    strikes: num(src.strikes, 1e12),
    volleys: num(src.volleys, 1e9)
  };
}
function combatCat() {
  return state.meta.combatCat;
}
function catUnlocked() {
  return Boolean(state.meta?.combatCat?.unlocked);
}
// Tikki joins once P.I.P.S. is repaired (she rebuilt it — account-level, survives prestige).
function catSyncUnlock() {
  if (!state.meta?.combatCat || catUnlocked() || state.meta.guardians?.pips?.stage !== 'repaired') return false;
  combatCat().unlocked = true;
  return true;
}

// ----- damage -----
let strikeOverride = null; // { source, damage } while a Tikki strike is resolved through the battle routing
let activeShotFactor = 1; // Tikki's support factor while a real ship shot is resolved (1 otherwise, e.g. previews)
// A plain ship shot: attack() without Aim and Overcharge (the base of Tikki's strikes).
function shipPlainDamage() {
  const aim = state.aimReady,
    overcharge = state.overchargeUntil;
  state.aimReady = false;
  state.overchargeUntil = 0;
  try {
    return attack();
  } finally {
    state.aimReady = aim;
    state.overchargeUntil = overcharge;
  }
}
function catStrikeDamage(kind = 'auto') {
  return shipPlainDamage() * (kind === 'ability' ? TIKKI.abilityFactor : TIKKI.strikeFactor) * (1 + arsenalMods().catPower);
}
function catAbilityCooldownMs() {
  return Math.max(TIKKI.abilityMinCooldownMs, TIKKI.abilityCooldownMs - arsenalMods().catCooldown * 1000);
}
function catAbilityLeftMs(now = Date.now()) {
  return Math.max(0, (combatCat()?.abilityReadyAt || 0) - now);
}

// ----- transient combat effects (not saved; a reload simply ends a running mark/charge) -----
const catFx = { markedUntil: 0, charge: 0, chargedUntil: 0, shots: 0, lastStrikeAt: 0, lastBurstAt: 0 };
function catOnStrike(now = Date.now()) {
  const m = arsenalMods();
  catFx.lastStrikeAt = now;
  if (m.mark > 0) catFx.markedUntil = now + TIKKI.markMs;
  if (m.charge > 0) {
    catFx.charge = m.charge;
    catFx.chargedUntil = now + TIKKI.chargeMs;
  }
}
function catMarked(now = Date.now()) {
  return arsenalMods().mark > 0 && now < catFx.markedUntil;
}
function catCharged(now = Date.now()) {
  return catFx.charge > 0 && now < catFx.chargedUntil;
}
// The factor a real ship shot gets from Tikki's support (mark on the target, charge on the ship), capped.
function shipShotEffectFactor(now = Date.now()) {
  let factor = 1;
  if (catMarked(now)) {
    factor *= 1 + arsenalMods().mark;
    // Beta 1.2 synergy "Zielerfassung": an aimed shot on a marked target (still inside the cap)
    if (state.aimReady && arsenalSynergyActive('target-lock')) factor *= 1 + arsenalSynergyValue('target-lock');
  }
  if (catCharged(now)) factor *= 1 + catFx.charge;
  return Math.min(TIKKI.effectCap, factor);
}
// After a real ship shot: the charge is spent, the shot is counted; returns the burst share if this shot bursts.
function shipShotResolved(now = Date.now()) {
  const charged = catCharged(now);
  catFx.charge = 0;
  catFx.shots += 1;
  const burst = arsenalMods().burst;
  if (burst && catFx.shots % burst.every === 0) {
    catFx.lastBurstAt = now;
    // Beta 1.2 synergy "Kettenreaktion": a charged shot strengthens its own burst
    return burst.value * (charged && arsenalSynergyActive('chain-burst') ? 1 + arsenalSynergyValue('chain-burst') : 1);
  }
  return 0;
}
