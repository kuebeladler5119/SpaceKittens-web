// Beta 1.4 M0 — frame pacing. Loaded after every module that wraps render() (outermost wrapper), before scenes/boot.js.
//
// Findings (tools/perf-stutter.mjs, docs/beta-1-4/PERFORMANCE.md): on a 144–165 Hz desktop display the frame budget is
// ~6 ms. High-frequency gameplay timers (the ship's gun up to 2.6 shots/s, Tikki's bolts, wave clock events) each ran a
// full synchronous render() (1–6 ms of DOM work) at an arbitrary moment between frames, so several renders could land in
// one frame and push it over budget. Renders requested from those paths are now coalesced into at most one render per
// animation frame. Player input, the one-second game tick and every other caller still render synchronously (the
// simulation and the saved state are untouched — this only changes *when* the DOM is refreshed).
//
// Also: first visits of screens generated portraits/ship previews (canvas → toDataURL, 9–40 ms) synchronously; they are
// pre-warmed in idle time after start-up, one asset per idle slot.

let renderDeferDepth = 0,
  renderQueued = false;
const renderImmediately = render;
function queueRender() {
  if (renderQueued) return;
  renderQueued = true;
  const run = () => {
    renderQueued = false;
    renderImmediately();
  };
  if (document.hidden || typeof requestAnimationFrame !== 'function') setTimeout(run, 0);
  else requestAnimationFrame(run);
}
// runs fn; every render() it triggers is folded into one render on the next animation frame
function withDeferredRender(fn) {
  renderDeferDepth++;
  try {
    return fn();
  } finally {
    renderDeferDepth--;
  }
}
render = () => {
  if (renderDeferDepth > 0) return queueRender();
  renderImmediately();
};

// ----- idle pre-warm of generated images (first visits of Abenteuer / Kätzchen no longer stall a frame) -----
function prewarmAssets() {
  const jobs = [];
  const Kit = window.SpaceKittens,
    Art = window.NebulaArt;
  if (Kit?.portraitURL) for (let i = 0; i < (Kit.ROSTER?.length || 0); i++) jobs.push(() => Kit.portraitURL(i, 'neutral', 96), () => Kit.portraitURL(i, 'happy', 96));
  if (Art?.shipPreviewURL && typeof shipPalette === 'function')
    jobs.push(() => {
      const pilot = Kit?.ROSTER?.[typeof combatPilot === 'function' ? combatPilot() : 0];
      Art.shipPreviewURL(state.ship.model, state.ship, shipPalette(), pilot, 640, 300);
    });
  const idle = window.requestIdleCallback || (fn => setTimeout(() => fn({ timeRemaining: () => 8 }), 200));
  const step = deadline => {
    while (jobs.length && deadline.timeRemaining() > 4) {
      try {
        jobs.shift()();
      } catch {}
    }
    if (jobs.length) idle(step, { timeout: 2000 });
  };
  idle(step, { timeout: 2000 });
}
setTimeout(prewarmAssets, 1500);
