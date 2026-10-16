// Beta 1.3 — the ship's gun clock: automatic fire without Boba, no tap-spam. Loaded after combat-cat-ui.js.
//
// On the battle screen (app visible, no story dialogue open) the ship fires on its own at shipFireRate() shots per
// second — against the ladder, a guardian, a Sektorprüfung or a Feldzug wave. Each shot is a normal click on the
// attack button (same routing, events, aim consumption as Boba's old auto-battle). A tap on ANGREIFEN fires the loaded
// shot at once; while the gun reloads a tap does nothing, so tapping never adds shots. Boba (pilot) raises the fire rate
// and keeps fighting in the background when AUTO is on (game.js gameTick, only while this clock is not firing).
// The wave clock (campaign-ui.js) advances on this same tick — one clock, no second timer, nothing runs offline.

const GUN_BASE_RATE = 1.5; // shots per second
const GUN_BOBA = 1.25; // Boba flies the ship: +25 % fire rate
const GUN_ENGINE_STEP = 0.04; // + per engine module level (max 10 levels → +40 %)
let gunReadyAt = 0,
  gunLastTick = 0,
  gunShotsFired = 0; // read by the economy sim's combat clock

function shipFireRate(ship = state.ship) {
  return GUN_BASE_RATE * (crewActive(1) ? GUN_BOBA : 1) * (1 + GUN_ENGINE_STEP * Math.min(10, ship.engine || 0));
}
function gunIntervalMs() {
  return 1000 / shipFireRate();
}
function storyDialogueOpen() {
  const bubble = $('storyBubble');
  return Boolean(bubble && !bubble.classList.contains('hidden'));
}
// true while this clock is the one that fires (Boba's background fire waits)
function gunOwnsShots() {
  return !document.hidden && currentScreen() === 'battle' && screenUnlocked('battle');
}
function gunReloadLeftMs(now = Date.now()) {
  return Math.max(0, gunReadyAt - now);
}
function gunTick(now = Date.now()) {
  const dt = gunLastTick ? Math.min(0.5, Math.max(0, (now - gunLastTick) / 1000)) : 0;
  gunLastTick = now;
  // away from the fight the gun holds fire; a wave also waits while its story line is read (a tap still fires)
  if (!gunOwnsShots() || (storyDialogueOpen() && campaignRunning())) return;
  campaignClock(dt, now);
  // Beta 1.4: an arena wave has its own fixed-step clock and ship (arena-ui.js) — the classic gun holds fire
  if (typeof arenaActive === 'function' && arenaActive()) return;
  // anchored to the schedule (exact rate at any tick length); after a pause it restarts from now — one shot, no burst
  const interval = gunIntervalMs();
  if (now - gunReadyAt > interval) gunReadyAt = now;
  for (let n = 0; n < 3 && now >= gunReadyAt; n++) {
    gunReadyAt += interval;
    gunShotsFired += 1;
    $('battleButton').click();
  }
}
// one 100-ms clock for the gun, the wave and the button's reload bar
setInterval(() => {
  const now = Date.now();
  // the shots' renders are folded into one per animation frame (frame-pacing.js)
  if (typeof withDeferredRender === 'function') withDeferredRender(() => gunTick(now));
  else gunTick(now);
  if (currentScreen() === 'battle' && !document.hidden) updateGunButton(now);
}, 100);

// A real tap fires the loaded shot early; while reloading it is swallowed before any handler sees it (no aim consumed).
document.addEventListener(
  'click',
  event => {
    if (!event.isTrusted || !event.target.closest?.('#battleButton')) return;
    const now = Date.now();
    if (now < gunReadyAt) {
      event.stopPropagation();
      event.preventDefault();
      const button = $('battleButton');
      button.classList.remove('reloading');
      void button.offsetWidth;
      button.classList.add('reloading');
      return;
    }
    gunReadyAt = now + gunIntervalMs();
  },
  true
);

// ----- attack button: what the gun is doing -----
function updateGunButton(now = Date.now()) {
  const button = $('battleButton');
  if (!button) return;
  const label = button.querySelector('span'),
    left = gunReloadLeftMs(now),
    interval = gunIntervalMs();
  if (label) label.textContent = 'FEUER';
  button.style.setProperty('--reload', (1 - Math.min(1, left / interval)).toFixed(3));
  const small = button.querySelector('small');
  const html = `Schaden <b id="attackPower">${fmt(attack())}</b> · ${shipFireRate().toFixed(1).replace('.', ',')} Schuss/s`;
  if (small && small.dataset.html !== html) {
    small.dataset.html = html;
    small.innerHTML = html;
  }
}
const renderBeforeGun = render;
render = () => {
  renderBeforeGun();
  if (currentScreen() === 'battle') updateGunButton();
};

