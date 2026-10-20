// Beta 1.7 M7: rare finds (Fundstücke) from the deep shafts. Deterministic and bounded:
// - every shaft from depth 3 adds what it really mines to a find counter;
// - a find comes when the counter passes a threshold that grows with every find (diminishing);
// - the type is drawn from a fixed, published table by the shaft's depth, with a seeded number from the save, so
//   reloading never rerolls;
// - one production call yields at most two finds, so a long offline catch-up cannot flood the collection.
// Uses: analyse (crystals, a manager capsule or an elite chest) or sell for Credits; favourites are protected from
// selling. Account-level (state.meta.artifacts), kept through "Neue Galaxie". Loaded before game.js.
const ARTIFACTS = {
  geode: { name: 'Kristallgeode', icon: '🔮', rarity: 'common', sell: 5000, analyse: { crystals: 20 }, text: 'Innen funkelt ein ganzer Kristallgarten.' },
  rareOre: { name: 'Funkelerz', icon: '✴', rarity: 'uncommon', sell: 40000, analyse: { ore: 400 }, text: 'Erz, das im Dunkeln leuchtet – Tikki will es unbedingt untersuchen.' },
  fossil: { name: 'Sternenfossil', icon: '🐚', rarity: 'uncommon', sell: 25000, analyse: { crystals: 60 }, text: 'Ein Abdruck aus der Zeit, bevor die Sterne leise wurden.' },
  relic: { name: 'Relikt der Großen Stille', icon: '🗿', rarity: 'rare', sell: 120000, analyse: { capsules: 1 }, text: 'Ein Bauteil der alten Kolonisten. Es summt, wenn Mochi es hält.' },
  motteTech: { name: 'M.O.T.T.E.-Bauteil', icon: '⚙', rarity: 'epic', sell: 400000, analyse: { chestsElite: 1 }, text: 'Ein versiegeltes Modul der Behörde. Formular 7-B klebt noch dran.' }
};
const ARTIFACT_RARITY = { common: 'Gewöhnlich', uncommon: 'Ungewöhnlich', rare: 'Selten', epic: 'Episch' };
// the find table by depth band: percentages (shown to the player exactly like this)
const ARTIFACT_TABLES = [
  { from: 3, to: 6, name: 'Tiefe 3–6', odds: { geode: 60, rareOre: 40 } },
  { from: 7, to: 10, name: 'Tiefe 7–10', odds: { geode: 30, rareOre: 30, fossil: 30, relic: 10 } },
  { from: 11, to: 99, name: 'Tiefe 11+', odds: { fossil: 35, relic: 35, rareOre: 15, motteTech: 15 } }
];
const ARTIFACT_STEP = 50000; // units mined for the first find; each find raises it by a quarter
const ARTIFACT_MAX_PER_CALL = 2;
const ARTIFACT_MAX = 200; // the collection holds at most this many (further finds wait in the counter)
function normalizeArtifacts(raw) {
  const items = Array.isArray(raw?.items)
    ? raw.items
        .filter(a => a && ARTIFACTS[a.type])
        .slice(0, ARTIFACT_MAX)
        .map(a => ({ id: Math.max(1, Math.floor(Number(a.id) || 0)), type: a.type, depth: Math.max(3, Math.floor(Number(a.depth) || 3)), fav: Boolean(a.fav) }))
    : [];
  const num = v => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0);
  // Beta 1.9 M6: seen (every type ever found, the collection) and used (finds consumed by recipes and research)
  const seen = {};
  if (raw?.seen && typeof raw.seen === 'object') for (const t of Object.keys(raw.seen)) if (ARTIFACTS[t] && raw.seen[t]) seen[t] = true;
  for (const a of items) seen[a.type] = true;
  return { items, progress: num(raw?.progress), found: Math.floor(num(raw?.found)), seq: Math.floor(num(raw?.seq)), sold: Math.floor(num(raw?.sold)), analysed: Math.floor(num(raw?.analysed)), seen, used: Math.floor(num(raw?.used)) };
}
function artifactState() {
  if (!state.meta.artifacts) state.meta.artifacts = normalizeArtifacts(null);
  return state.meta.artifacts;
}
function artifactThreshold(found = artifactState().found) {
  // Beta 1.9 M6: the research Fossilkunde (−20 %) and the complete collection (−10 %) bring finds sooner
  const scan = typeof techHas === 'function' && techHas('fossilScan') ? 0.8 : 1,
    full = typeof artifactCollection === 'function' && artifactCollection().seen >= Object.keys(ARTIFACTS).length ? 0.9 : 1;
  return ARTIFACT_STEP * (1 + 0.25 * found) * scan * full;
}
function artifactTable(depth) {
  return ARTIFACT_TABLES.find(t => depth >= t.from && depth <= t.to) || ARTIFACT_TABLES[0];
}
// a seeded draw from the save's own counter (the same save always gives the same next find)
function artifactRoll(seq) {
  let x = (seq * 2654435761 + 0x9e3779b9) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d) >>> 0;
  x ^= x >>> 15;
  return (x >>> 0) / 4294967296;
}
function artifactPick(depth, seq) {
  const odds = artifactTable(depth).odds,
    total = Object.values(odds).reduce((s, v) => s + v, 0);
  let r = artifactRoll(seq) * total;
  for (const [type, w] of Object.entries(odds)) if ((r -= w) < 0) return type;
  return Object.keys(odds)[0];
}
// called by the production with what each shaft really mined in this call; returns the new finds
function artifactProgress(planet, mined) {
  const s = artifactState(),
    finds = [];
  let deepest = 0,
    add = 0;
  for (const [id, amount] of Object.entries(mined || {})) {
    const depth = shaftDef(id, planet)?.depth || 0;
    if (depth < 3 || !(amount > 0)) continue;
    add += amount;
    deepest = Math.max(deepest, depth);
  }
  if (!add) return finds;
  s.progress += add;
  while (s.progress >= artifactThreshold() && finds.length < ARTIFACT_MAX_PER_CALL && s.items.length < ARTIFACT_MAX) {
    s.progress -= artifactThreshold();
    s.found++;
    s.seq++;
    const item = { id: s.seq, type: artifactPick(deepest, s.seq), depth: deepest, fav: false };
    s.items.push(item);
    if (s.seen) s.seen[item.type] = true;
    finds.push(item);
    if (typeof GameEvents !== 'undefined' && !offlineMode) GameEvents.emit('artifact', { planet, type: item.type });
  }
  // what is left over stays in the counter, capped at one threshold (no stockpile of finds from a long absence)
  s.progress = Math.min(s.progress, artifactThreshold());
  return finds;
}
function artifactSell(id) {
  const s = artifactState(),
    i = s.items.findIndex(a => a.id === id);
  if (i < 0 || s.items[i].fav) return 0;
  const credits = ARTIFACTS[s.items[i].type].sell;
  s.items.splice(i, 1);
  s.sold++;
  earn(credits, 'sale:artifact');
  return credits;
}
function artifactAnalyse(id) {
  const s = artifactState(),
    i = s.items.findIndex(a => a.id === id);
  if (i < 0 || s.items[i].fav) return null;
  const def = ARTIFACTS[s.items[i].type],
    gain = def.analyse;
  if (gain.crystals) state.crystals += gain.crystals;
  if (gain.ore) state.ore += gain.ore;
  if (gain.capsules) state.meta.managers.capsules = (state.meta.managers.capsules || 0) + gain.capsules;
  if (gain.chestsElite) state.meta.arsenal.chestsElite = (state.meta.arsenal.chestsElite || 0) + gain.chestsElite;
  s.items.splice(i, 1);
  s.analysed++;
  return gain;
}
function artifactFavourite(id) {
  const a = artifactState().items.find(x => x.id === id);
  if (!a) return false;
  a.fav = !a.fav;
  return a.fav;
}

// ----- Beta 1.9 M6: finds as research and recipe inputs, the collection -----
// A find can be an input wherever the Fertigung or the research takes materials (fabStock / fabSetStock): its stock is
// the number of non-favourite finds of that type (favourites stay protected, as from selling). Finds are account-level,
// so every colony's Fertigung sees the same collection. A cancelled batch gives its find back (a new item, the draw
// counter of future finds is not touched). The collection: every type ever found counts; with all five the finds come
// 10 % sooner (artifactThreshold).
function artifactCount(type) {
  return artifactState().items.filter(a => a.type === type && !a.fav).length;
}
function artifactSeen() {
  const s = artifactState();
  if (!s.seen) s.seen = {};
  for (const a of s.items) s.seen[a.type] = true;
  return s.seen;
}
function artifactCollection() {
  const seen = artifactSeen();
  return { seen: Object.keys(ARTIFACTS).filter(t => seen[t]).length, total: Object.keys(ARTIFACTS).length };
}
const fabStockBeforeArtifacts = fabStock,
  fabSetStockBeforeArtifacts = fabSetStock,
  fabNameBeforeArtifacts = fabName,
  fabIconBeforeArtifacts = fabIcon;
fabStock = (planet, id) => (ARTIFACTS[id] ? artifactCount(id) : fabStockBeforeArtifacts(planet, id));
fabSetStock = (planet, id, value) => {
  if (!ARTIFACTS[id]) return fabSetStockBeforeArtifacts(planet, id, value);
  const s = artifactState();
  let diff = Math.round(value) - artifactCount(id);
  while (diff < 0) {
    const i = s.items.findIndex(a => a.type === id && !a.fav);
    if (i < 0) break;
    s.items.splice(i, 1);
    s.used = (s.used || 0) + 1;
    diff++;
  }
  while (diff > 0 && s.items.length < ARTIFACT_MAX) {
    s.items.push({ id: Math.max(s.seq, ...s.items.map(a => a.id)) + 1, type: id, depth: 3, fav: false });
    s.used = Math.max(0, (s.used || 0) - 1); // a find given back was not used
    diff--;
  }
};
fabName = id => (ARTIFACTS[id] ? ARTIFACTS[id].name : fabNameBeforeArtifacts(id));
fabIcon = id => (ARTIFACTS[id] ? ARTIFACTS[id].icon : fabIconBeforeArtifacts(id));
// what a find is good for (shown on its card before any tap)
const ARTIFACT_USES = {
  geode: 'Resonanzlinse (Fertigung, Orion)',
  fossil: 'Forschung Fossilkunde',
  relic: 'Schildprojektor (Fertigung, Mekhanos)',
  rareOre: '',
  motteTech: ''
};
