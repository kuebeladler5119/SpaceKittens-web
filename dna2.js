// Beta 1.6 M4 — Galactic DNA 2.0. Rarity buys behaviour, not numbers: the power table of dna.js stays as it was
// (common ×1 … celestial ×1.45), and every rarity step from rare on adds one visible, mechanical trait:
//   rare       Leuchtspur      a brighter, longer trail (recognition only)
//   epic       Zielsucher      projectiles steer gently toward their target (fewer misses on moving enemies)
//   legendary  Signatur        one rule per chassis (rhythm, shock wave, burn line, bundling, choke, cluster)
//   mythic     Doppelaffinität a second affinity: strong (×1,125) where the first one is not; never weak through it
//   celestial  Kosmische Identität  one named cosmic rule per chassis (Pulsar, Supernova, Polarlicht, …)
// Traits are cumulative and derived from the stored identity (rarity + chassis), so every owned weapon of that rarity
// has them at once. The second affinity is part of the identity (`affinity2`, identity version 2): fixed when the
// weapon is made, the same for the same inputs (fusion: the base's affinity, if it differs from the donor's; otherwise
// from the seed). Older builds keep unknown fields, newer ones keep everything — no save schema change (still 37).
// The arena behaviour lives in arena.js (it reads the flags of dnaStats). Loaded after dna.js, before arena.js.

const DNA_IDENTITY_VERSION = 2;
const DNA_TRAITS = {
  trail: { name: 'Leuchtspur', icon: '✧', text: 'Eine hellere, längere Spur – die Waffe ist in der Arena sofort zu erkennen.' },
  seeker: { name: 'Zielsucher', icon: '◎', text: 'Geschosse lenken leicht auf ihr Ziel nach – weniger Fehlschüsse auf bewegte Gegner.' },
  signature: { name: 'Signatur', icon: '✦', text: '' },
  dual: { name: 'Doppelaffinität', icon: '☯', text: 'Eine zweite Affinität trifft stark (×1,125), wo die erste nicht stark ist – nie schwach durch sie.' },
  cosmic: { name: 'Kosmische Identität', icon: '✺', text: '' }
};
const DNA_RARITY_TRAITS = {
  common: [],
  uncommon: [],
  rare: ['trail'],
  epic: ['trail', 'seeker'],
  legendary: ['trail', 'seeker', 'signature'],
  mythic: ['trail', 'seeker', 'signature', 'dual'],
  celestial: ['trail', 'seeker', 'signature', 'dual', 'cosmic']
};
// one rule per chassis, inside the chassis system (no new chassis, no raw damage step)
const DNA_SIGNATURES = {
  repeater: { id: 'rhythm', name: 'Salvenrhythmus', text: 'Jeder 4. Bolzen durchschlägt einen Gegner mehr.' },
  heavy: { id: 'shockwave', name: 'Druckwelle', text: 'Jeder Granatentreffer trifft Gegner direkt daneben mit 25 %.' },
  lance: { id: 'burnline', name: 'Brennlinie', text: 'Der Strahl brennt durch Panzer: 80 % statt 60 % gehen durch.' },
  prism: { id: 'bundle', name: 'Bündelung', text: 'Steht nur ein Gegner im Feld, bündeln sich alle Strahlen auf ihn (je 70 %).' },
  scatter: { id: 'choke', name: 'Würgebohrung', text: 'Kein Schadensverlust auf Distanz; aus der Nähe weiter ×1,5.' },
  mortar: { id: 'cluster', name: 'Streumunition', text: 'Jede Explosion streut drei Bomblets (je 30 %) um den Einschlag.' }
};
const DNA_COSMIC = {
  repeater: { id: 'pulsar', name: 'Pulsar', text: 'Jede 5. Salve feuert zusätzlich zwei Bolzen im Fächer.' },
  heavy: { id: 'supernova', name: 'Supernova', text: 'Eine Granate, die einen Gegner zerstört, explodiert (40 % im Umkreis).' },
  lance: { id: 'aurora', name: 'Polarlicht', text: 'Der Strahl springt auf einen weiteren Gegner abseits der Linie (60 %).' },
  prism: { id: 'nebula', name: 'Nebelprisma', text: 'Fünf Strahlen statt drei (je 80 %).' },
  scatter: { id: 'meteor', name: 'Meteorschauer', text: 'Schrotkugeln durchschlagen einen Gegner.' },
  mortar: { id: 'horizon', name: 'Ereignishorizont', text: 'Jede Explosion hallt 0,4 s später mit 50 % nach.' }
};
const DNA_DUAL_STRONG = 0.5; // the second affinity gives half the strong bonus (×1,125 instead of ×1,25)

// The traits of an identity (derived; nothing stored except affinity2)
function dnaTraits(dna) {
  const list = DNA_RARITY_TRAITS[dna?.rarity] || [];
  return list.filter(id => id !== 'dual' || (dna.affinity2 && DNA_AFFINITIES[dna.affinity2]));
}
function dnaTraitText(dna, id) {
  if (id === 'signature') return DNA_SIGNATURES[dna.chassis] || null;
  if (id === 'cosmic') return DNA_COSMIC[dna.chassis] || null;
  if (id === 'dual') return { name: DNA_TRAITS.dual.name + ' · ' + DNA_AFFINITIES[dna.affinity2].short, text: DNA_TRAITS.dual.text };
  return DNA_TRAITS[id];
}
// a second affinity from the seed (a different one than the first)
function dnaSecondAffinity(seed, first) {
  const rnd = dnaRng((seed ^ 0x9e3779b9) >>> 0),
    pool = DNA_AFFINITY_IDS.filter(id => id !== first);
  return pool[Math.floor(rnd() * pool.length)];
}

// generation: common … legendary unchanged (same seed, same weapon as before); mythic/celestial carry affinity2
const dnaGenerateBeforeV2 = dnaGenerate;
dnaGenerate = (seed, rarity = 'common', opts = {}) => {
  const w = dnaGenerateBeforeV2(seed, rarity, opts);
  if (w.rarity !== 'mythic' && w.rarity !== 'celestial') return w;
  const second = DNA_AFFINITIES[opts.affinity2] && opts.affinity2 !== w.affinity ? opts.affinity2 : dnaSecondAffinity(w.seed, w.affinity);
  return { ...w, v: DNA_IDENTITY_VERSION, affinity2: second };
};
// fusion into mythic or celestial: the base's affinity becomes the second one (if it differs), so the fusion keeps both
const dnaFusePreviewBeforeV2 = dnaFusePreview;
dnaFusePreview = (baseUid, donorUid) => {
  const p = dnaFusePreviewBeforeV2(baseUid, donorUid);
  if (!p.ok || (p.result.rarity !== 'mythic' && p.result.rarity !== 'celestial')) return p;
  const second = p.base.affinity !== p.donor.affinity && DNA_AFFINITIES[p.base.affinity] ? p.base.affinity : p.result.affinity2;
  return { ...p, result: { ...p.result, affinity2: second } };
};
// saves: keep a valid second affinity; mythic/celestial weapons of an older build get theirs once, from their seed
// (an upgrade that only adds, never a reroll of anything they had)
const normalizeDnaBeforeV2 = normalizeDna;
normalizeDna = raw => {
  const d = normalizeDnaBeforeV2(raw);
  d.owned = d.owned.map(w => {
    if (w.affinity2 !== undefined && (!DNA_AFFINITIES[w.affinity2] || w.affinity2 === w.affinity)) {
      const { affinity2, ...rest } = w;
      return rest;
    }
    if ((w.rarity === 'mythic' || w.rarity === 'celestial') && !w.affinity2 && DNA_AFFINITIES[w.affinity]) return { ...w, v: DNA_IDENTITY_VERSION, affinity2: dnaSecondAffinity(w.seed, w.affinity) };
    return w;
  });
  return d;
};
// stats: the trait flags the arena reads (numbers of the chassis and rarity stay as they were)
const dnaStatsBeforeV2 = dnaStats;
dnaStats = dna => {
  const s = dnaStatsBeforeV2(dna),
    traits = dnaTraits(dna),
    has = id => traits.includes(id),
    sig = has('signature') ? DNA_SIGNATURES[dna?.chassis]?.id || null : null,
    cosmic = has('cosmic') ? DNA_COSMIC[dna?.chassis]?.id || null : null;
  return {
    ...s,
    traits,
    seek: has('seeker'),
    signature: sig,
    cosmic,
    affinity2: has('dual') ? dna.affinity2 : null,
    count: cosmic === 'nebula' ? 5 : s.count,
    rayShare: cosmic === 'nebula' ? 0.8 : 1,
    pierce: s.pierce + (cosmic === 'meteor' ? 1 : 0)
  };
};
