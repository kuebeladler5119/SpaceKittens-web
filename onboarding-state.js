// Friends-UX: the first steps' saved state (account-level, state.meta.onboarding; schema unchanged, default-filled).
// The UI is onboarding.js. Loaded before game.js (normalizeState calls normalizeOnboarding).
//
// The five steps of the real production chain, in the game's own order and at its own prices:
//   mine    – crystals mined onto the Halde (ABBAUEN)
//   rail    – a cart sent to the depot (LORE)
//   stall   – the first sale (VERKAUF → Credits)
//   upgrade – the Kristallmine improved to Lv 2 (start 120 ◈, the upgrade costs 40 ◈)
//   manager – the Bergbau-Manager hired (100 ◈): the first automation
// A step counts as learned when the player really did it (game events) or the state shows it. Nothing here grants,
// skips or locks anything.
const ONBOARDING_STEPS = ['mine', 'rail', 'stall', 'upgrade', 'manager'];
// Beta 1.8 FTUE 2.0: one-time discoveries after the first steps (ftue.js), each shown once when it becomes relevant;
// seen[id] = true once shown, dismissed or already done. Nothing is granted by them.
const ONBOARDING_DISCOVERIES = ['chain', 'mine', 'headframe', 'elevator', 'back', 'refinery'];
// a save this far along has clearly found its way (an older save, or a player who went ahead without the hints)
const ONBOARDING_GRADUATE_EARNED = 5000;

function onboardingProgressedFar(source) {
  const colonies = Array.isArray(source?.colonies) ? source.colonies : [];
  const staff = colonies[0]?.staff || {};
  return (
    Number(source?.galaxiesSold) > 0 ||
    Number(source?.totalEarned) >= ONBOARDING_GRADUATE_EARNED ||
    (Array.isArray(source?.planetsUnlocked) && source.planetsUnlocked.slice(1).some(Boolean)) ||
    Boolean(staff.rail || staff.stall || staff.dock) ||
    Boolean(colonies[0]?.underground?.open) ||
    // the story has moved on to the Abenteuer (M.O.T.T.E. arrived, a fight or a campaign wave happened)
    (source?.meta?.guardians?.pips?.stage && source.meta.guardians.pips.stage !== 'locked') ||
    Number(source?.enemyLevel) > 1 ||
    Number(source?.bossDefeats) > 0 ||
    Number(source?.meta?.campaign?.cleared?.crystal) > 0
  );
}

// learned steps that the state itself proves (used for older saves and as a safety net after a reload)
function onboardingLearnedFromState(source) {
  const colony = Array.isArray(source?.colonies) ? source.colonies[0] : null;
  const learned = {};
  const depot = Number(source?.planetOps?.storage?.[0]) || 0,
    pile = Number(colony?.stock?.pile) || 0;
  if (pile > 0 || depot > 0 || colony?.trip) learned.mine = true;
  if (depot > 0 || colony?.trip) learned.rail = true;
  if ((Number(source?.buildings?.[0]?.level) || 0) >= 2) learned.upgrade = true;
  if (colony?.staff?.mine) learned.manager = true;
  return learned;
}

function normalizeOnboarding(raw, source) {
  const fresh = { done: false, hidden: false, learned: {}, celebrate: false, seen: {} };
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const learned = {},
      seen = {};
    for (const id of ONBOARDING_STEPS) if (raw.learned?.[id] === true) learned[id] = true;
    for (const id of ONBOARDING_DISCOVERIES) if (raw.seen?.[id] === true) seen[id] = true;
    return { done: raw.done === true, hidden: raw.hidden === true, learned, celebrate: raw.celebrate === true && raw.done !== true, seen };
  }
  // no save at all: a brand-new game starts the first steps
  if (!source || !source.meta) return fresh;
  // a save from before the first steps existed: far along → done (never forced through it again); otherwise the steps it
  // already shows count as learned, and the hints continue from there
  if (onboardingProgressedFar(source)) return { ...fresh, done: true };
  const learned = onboardingLearnedFromState(source);
  if (Number(source.totalEarned) > 120) Object.assign(learned, { mine: true, rail: true, stall: true });
  return { ...fresh, learned, done: Boolean(learned.manager) };
}
