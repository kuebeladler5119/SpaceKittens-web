// Beta 1.9 M9: Wächter-Revanche – a beaten guardian can be fought again, a step stronger each time it is beaten, for the
// rare Dunkle Materie. Built on the guardian's own arena fight (arenaCreate(key, 'boss')): no second combat engine.
// - Unlocked once the campaign's guardian is beaten (stage defeated / repaired). Every foe of the fight (the guardian and
//   what it summons) gets +40 % life and +15 % damage per Revanche level (arenaSpawn reads a.rematch).
// - A win raises that guardian's level and pays 1 Dunkle Materie (2 at every third level), at most REMATCH.weeklyCap
//   per week for all guardians together. A loss or a retreat pays nothing and keeps the level.
// - No story reward repeats: the guardian's defeat function pays only while it waits for its first fight
//   (expedition-ui.js arenaFinish), which a beaten guardian never does again.
// - Dunkle Materie is a material, not a shop currency: it is spent on research (Materiepanzer) like any other cost item
//   (fabStock / fabSetStock know it). Account-level (state.meta.rematch), kept through "Neue Galaxie", default-filled.
// Loaded after outer-campaigns-ui.js (it wraps the expedition's arenaFinish, the campaign card and the result card).
const REMATCH = { hpStep: 0.4, atkStep: 0.15, weeklyCap: 4, minHull: 0.3, maxLevel: 99 };
const REMATCH_DONE = ['defeated', 'repaired'];
function normalizeRematch(raw) {
  const num = (v, max = 1e9) => (Number.isFinite(Number(v)) ? Math.min(max, Math.max(0, Math.floor(Number(v)))) : 0),
    levels = {};
  if (raw?.levels && typeof raw.levels === 'object') for (const [key, v] of Object.entries(raw.levels)) if (/^[a-z]{2,20}$/.test(key)) levels[key] = num(v, REMATCH.maxLevel);
  return { levels, matter: num(raw?.matter), week: typeof raw?.week === 'string' ? raw.week.slice(0, 20) : '', earned: num(raw?.earned, REMATCH.weeklyCap), total: num(raw?.total), wins: num(raw?.wins) };
}
function rematchState() {
  if (!state.meta.rematch) state.meta.rematch = normalizeRematch(null);
  return state.meta.rematch;
}
state.meta.rematch = normalizeRematch(state.meta.rematch);
function rematchUnlocked(key) {
  const c = CAMPAIGNS[key];
  return Boolean(c && ARENA_BOSSES[key] && REMATCH_DONE.includes(state.meta.guardians?.[c.guardian]?.stage));
}
// the level of the next Revanche (1 = the first one, already stronger than the story fight)
function rematchLevel(key) {
  return Math.min(REMATCH.maxLevel, (rematchState().levels[key] || 0) + 1);
}
function rematchScale(level) {
  return { hp: 1 + REMATCH.hpStep * level, atk: 1 + REMATCH.atkStep * level };
}
function rematchReward(level) {
  return 1 + (level % 3 === 0 ? 1 : 0);
}
// what may still be earned this week (the week turns over by itself)
function rematchRoom(now = Date.now()) {
  const s = rematchState(),
    week = weekId(now);
  if (s.week !== week) {
    s.week = week;
    s.earned = 0;
  }
  return Math.max(0, REMATCH.weeklyCap - s.earned);
}
function rematchGrant(key, level, now = Date.now()) {
  const s = rematchState(),
    give = Math.min(rematchReward(level), rematchRoom(now));
  s.levels[key] = Math.max(s.levels[key] || 0, level);
  s.wins++;
  s.matter += give;
  s.earned += give;
  s.total += give;
  return give;
}
function rematchBlocked(key) {
  if (!rematchUnlocked(key)) return 'Erst den Wächter besiegen.';
  if (arenaRun) return 'Ein Kampf läuft schon.';
  if (shipHullNow() < shipHullMax() * REMATCH.minHull) return 'Die Hülle ist zu schwach – erst in der Werft reparieren.';
  return null;
}
function rematchBegin(key) {
  const blocked = rematchBlocked(key);
  if (blocked) return toast(blocked), false;
  const level = rematchLevel(key);
  expedition.key = key;
  expedition.target = 'rematch';
  expedition.paused = false;
  expedition.hullStart = shipHullNow();
  arenaRun = arenaCreate(key, 'boss', 1000 + level, shipHullNow(), shipHullMax());
  arenaRun.rematch = level;
  arenaRun.assist = 0; // no Rückenwind in a Revanche (it helps only after lost story attempts)
  arenaLast = 0;
  arenaSeen = 0;
  campaignDefeat = null;
  feedback('unlock', 'light');
  GameEvents.emit('wave-start', { key, wave: 'boss', arena: true, rematch: level });
  setExpeditionState('fight');
  save();
  render();
  arenaLoop();
  return true;
}
// the fight's end: the expedition's own finish runs (hull, analysis, result card; no story reward for a beaten
// guardian), then the Revanche's level and Dunkle Materie
const arenaFinishBeforeRematch = arenaFinish;
arenaFinish = (won, now = Date.now(), opts = {}) => {
  const a = arenaRun,
    out = arenaFinishBeforeRematch(won, now, opts);
  if (a?.rematch) {
    const give = won && !opts.abort ? rematchGrant(a.key, a.rematch, now) : 0;
    if (expedition.last) expedition.last.rematch = { level: a.rematch, won: Boolean(won && !opts.abort), matter: give, capped: Boolean(won && !opts.abort && give < rematchReward(a.rematch)) };
    save();
    render();
    if (expedition.state === 'result') setHTML($('expResult'), expResultHTML());
  }
  return out;
};
const expResultHTMLBeforeRematch = expResultHTML;
expResultHTML = () => {
  let html = expResultHTMLBeforeRematch();
  const r = expedition.last?.rematch;
  if (!r) return html;
  const s = rematchState(),
    line = r.won
      ? `+${r.matter} Dunkle Materie${r.capped ? ' (Wochengrenze erreicht)' : ''} · diese Woche ${s.earned}/${REMATCH.weeklyCap} · nächste Revanche: Stufe ${rematchLevel(expedition.last.key)}`
      : `Stufe ${r.level} bleibt. Keine Belohnung, keine Strafe außer Hülle.`;
  html = html.replace('Wächter besiegt!', 'Revanche gewonnen!').replace('Schon einmal geschafft – keine zweite Belohnung.', 'Story-Belohnungen gibt es nur beim ersten Sieg.');
  return html.replace('<div class="exp-damage">', `<p class="exp-rewards rematch-line">⚔ Revanche Stufe ${r.level} · ${line}</p><div class="exp-damage">`);
};
// the campaign card of a finished campaign offers the Revanche
function rematchHTML(key) {
  if (!rematchUnlocked(key)) return '';
  const level = rematchLevel(key),
    sc = rematchScale(level),
    room = rematchRoom(),
    s = rematchState();
  return `<div class="rematch-card"><b>⚔ Wächter-Revanche · Stufe ${level}</b><small>${EXP_BOSS[key]?.name || 'Der Wächter'} mit +${Math.round((sc.hp - 1) * 100)} % Leben und +${Math.round((sc.atk - 1) * 100)} % Schaden. Sieg: +${rematchReward(level)} Dunkle Materie${room ? '' : ' – Wochengrenze erreicht, nur Übung'} (diese Woche ${s.earned}/${REMATCH.weeklyCap}, vorhanden ${s.matter}). Story-Belohnungen gibt es nur beim ersten Sieg.</small><button class="campaign-start" data-rematch="${key}">REVANCHE STARTEN</button></div>`;
}
const renderCampaignCardBeforeRematch = renderCampaignCard;
renderCampaignCard = () => {
  renderCampaignCardBeforeRematch();
  const card = $('campaignCard'),
    key = typeof campaignKeyFor === 'function' ? campaignKeyFor() : null;
  if (!card || card.hidden || !key || !campaignComplete(key) || card.querySelector('.rematch-card')) return;
  const html = rematchHTML(key);
  if (html) card.insertAdjacentHTML('beforeend', html);
};
document.addEventListener('click', event => {
  const b = event.target.closest('[data-rematch]');
  if (b) rematchBegin(b.dataset.rematch);
});
// Dunkle Materie as a cost item of the research (techStock → fabStock)
const fabStockBeforeMatter = fabStock,
  fabSetStockBeforeMatter = fabSetStock,
  fabNameBeforeMatter = fabName,
  fabIconBeforeMatter = fabIcon;
fabStock = (planet, id) => (id === 'darkMatter' ? rematchState().matter : fabStockBeforeMatter(planet, id));
fabSetStock = (planet, id, value) => (id === 'darkMatter' ? (rematchState().matter = Math.max(0, Math.floor(value))) : fabSetStockBeforeMatter(planet, id, value));
fabName = id => (id === 'darkMatter' ? 'Dunkle Materie' : fabNameBeforeMatter(id));
fabIcon = id => (id === 'darkMatter' ? '✷' : fabIconBeforeMatter(id));
