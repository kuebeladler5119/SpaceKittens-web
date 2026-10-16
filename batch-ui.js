// Beta 1.3 — batch upgrades (+1 / +10 / MAX) for shaft tracks, the elevator and the colony buildings.
// The plan uses the game's own price functions (trackCost, elevatorTrackCost, cost): the level is raised step by step
// in place and restored in `finally`, so a preview never changes anything. A purchase runs the existing single-step
// purchase N times (same events, caps and investment bookkeeping as N taps). MAX = as many steps as the Credits and
// any guardian cap allow, at most BATCH_MAX_STEPS per tap. Loaded after deepcore-ui.js.

const BATCH_MODES = [1, 10, 'max'];
const BATCH_MAX_STEPS = 100;
let upgradeBatch = 1;
try {
  const saved = sessionStorage.getItem('sk-batch');
  upgradeBatch = saved === 'max' ? 'max' : saved === '10' ? 10 : 1;
} catch {}

// { read, write, price, blocked } → { n, total, affordable } for the current batch mode
function batchPlan(src, want = upgradeBatch, credits = state.credits) {
  const start = src.read(),
    limit = want === 'max' ? BATCH_MAX_STEPS : want;
  let n = 0,
    total = 0;
  try {
    while (n < limit) {
      if (src.blocked?.()) break;
      const p = src.price();
      if (!Number.isFinite(p)) break;
      if (want === 'max' && total + p > credits) break;
      total += p;
      n++;
      src.write(start + n);
    }
  } finally {
    src.write(start);
  }
  return { n, total, affordable: n > 0 && total <= credits };
}
// sources for the three kinds of upgrades
function batchSource(kind, id, track) {
  if (kind === 'building') {
    const b = state.buildings[id];
    return { read: () => b.level, write: v => (b.level = v), price: () => cost(b) };
  }
  if (kind === 'industry') {
    const ind = colonyAt().industry;
    return { read: () => ind[id], write: v => (ind[id] = v), price: () => industryCost(id), blocked: () => industryCapped(id) || !industryUnlocked(id) };
  }
  if (kind === 'elevator') {
    const e = elevatorState();
    return {
      read: () => e[track],
      write: v => (e[track] = v),
      price: () => elevatorTrackCost(track),
      blocked: () => track === 'speed' && elevatorFloorTime(e.speed + 1) >= elevatorFloorTime(e.speed) - 1e-6
    };
  }
  // shaft track (Schacht 1's drill/crew are the Kristallmine and the Helferhütte: buildings 0 and 1)
  if (id === 'mine' && (track === 'drill' || track === 'crew')) return batchSource('building', track === 'drill' ? 0 : 1);
  const s = shaftState(id),
    key = track === 'drill' ? 'level' : track;
  return { read: () => s[key], write: v => (s[key] = v), price: () => trackCost(id, track), blocked: () => track === 'drill' && shaftCapReached(id) };
}
// the toggle shown above every upgrade list
function batchToggleHTML() {
  return `<div class="batch-toggle" role="group" aria-label="Upgrade-Menge">${BATCH_MODES.map(m => `<button data-batch-mode="${m}" class="${upgradeBatch === m ? 'active' : ''}" aria-pressed="${upgradeBatch === m}">${m === 'max' ? 'MAX' : '+' + m}</button>`).join('')}</div>`;
}
// label + state for a buy button under the current mode (attrs: the button's own data attribute, e.g. data-dc-track="…")
function batchButtonHTML(kind, id, track, attrs, cls = 'track-buy', prefix = '') {
  const src = batchSource(kind, id, track),
    plan = batchPlan(src);
  // a guardian cap / physical limit: the single purchase stays tappable and explains the limit (as before Beta 1.3)
  if (!plan.n && src.blocked?.()) return `<button class="${cls}" ${attrs}>${prefix}🔒 Grenze erreicht</button>`;
  if (!plan.n) return `<button class="${cls}" ${attrs} disabled>${upgradeBatch === 'max' ? 'MAX · –' : 'MAX'}</button>`;
  const label = prefix + (upgradeBatch === 1 ? '' : '+' + plan.n + ' · ') + '◈ ' + fmt(plan.total) + (plan.affordable || upgradeBatch === 'max' ? '' : ' (noch ' + fmt(plan.total - state.credits) + ')');
  return `<button class="${cls} ${plan.affordable ? 'affordable' : ''}" ${attrs} data-batch-n="${plan.n}" ${plan.affordable ? '' : 'disabled'} title="${plan.affordable ? '' : 'Noch ' + fmt(plan.total - state.credits) + ' ◈'}">${label}</button>`;
}

// mode switch (the open sheet re-renders through the normal render())
document.addEventListener('click', event => {
  const mode = event.target.closest('[data-batch-mode]');
  if (!mode) return;
  upgradeBatch = mode.dataset.batchMode === 'max' ? 'max' : Number(mode.dataset.batchMode);
  try {
    sessionStorage.setItem('sk-batch', String(upgradeBatch));
  } catch {}
  render();
});
// a batch purchase: N single purchases through the existing functions (capture phase, before the single handlers)
document.addEventListener(
  'click',
  event => {
    const button = event.target.closest('[data-batch-n]');
    const n = Number(button?.dataset.batchN || 0);
    if (!button || n <= 1) return; // one step: the normal handler does it
    event.stopPropagation();
    event.preventDefault();
    let done = 0;
    if (button.dataset.dcTrack) {
      const [id, which] = button.dataset.dcTrack.split(':');
      while (done < n && upgradeShaftTrack(id, which)) done++;
    } else if (button.dataset.dcElev) {
      while (done < n && upgradeElevator(button.dataset.dcElev)) done++;
    } else if (button.dataset.buildIndustry) {
      while (done < n && buildIndustry(button.dataset.buildIndustry)) done++;
    } else if (button.dataset.buy !== undefined) {
      // colony buildings: the game's own building purchase (events, milestones, quests) once per step
      const i = Number(button.dataset.buy);
      for (let step = 0; step < n; step++) {
        const before = state.buildings[i].level;
        const tmp = document.createElement('button');
        tmp.dataset.buy = String(i);
        tmp.hidden = true;
        document.body.appendChild(tmp);
        tmp.click();
        tmp.remove();
        if (state.buildings[i].level === before) break;
        done++;
      }
    }
    if (done) {
      feedback('upgrade', done >= 10 ? 'success' : 'light');
      toast('+' + done + ' Stufen verbessert');
      save();
    }
    render();
  },
  true
);
