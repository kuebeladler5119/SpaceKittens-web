// Monetization core: product catalogue, purchase/entitlement ledger, store + rewarded-ad providers, season pass data.
//
// HONESTY NOTE
// - 'mock' providers simulate Google Play Billing / AdMob for development and automated tests only.
// - 'native' providers are adapters for cordova-plugin-purchase (Google Play Billing) and
//   @capacitor-community/admob. They are NOT installed in the Android project yet and have NOT been tested on a
//   device. Until they are installed, configured in Play Console/AdMob and sandbox-tested, release builds report
//   the shop/ads as unavailable instead of pretending to work. See docs/MONETIZATION.md.
// - There is no server-side receipt validation (no backend). Entitlements are validated by the Play Billing
//   client library only. Refunds of consumables cannot be detected without a backend (Voided Purchases API).
(function () {
  'use strict';

  // ---------------------------------------------------------------------------------------------------------------
  // Catalogue. fallbackPrice is a reference value for the development mock only (shown there as "(Test)"); a real
  // localized price always comes from the store — Beta 1.4: the UI never shows fallbackPrice as a price.
  const CATALOG = Object.freeze([
    {
      id: 'nh_commander_edition',
      kind: 'non-consumable',
      title: 'Kommandanten-Edition',
      fallbackPrice: '4,99 €',
      highlight: 'Dauerhaft',
      lines: [
        'Werbe-Belohnungen sofort – ohne Werbung',
        'Offline-Ertrag bis 8 statt 4 Stunden',
        'Kosmetik: Aurora-Lackierung für dein Schiff',
        '+150 Gems einmalig'
      ],
      grants: { entitlement: 'commanderEdition', gems: 150, cosmetics: ['ship-aurora'] }
    },
    {
      id: 'nh_starter_bundle',
      kind: 'non-consumable',
      title: 'Startpaket',
      fallbackPrice: '1,99 €',
      highlight: 'Einmalig',
      lines: ['+300 Gems', '3 Produktionsboosts (2× für 30 Min.)', 'Kosmetik: Goldener Orbitalring'],
      grants: { gems: 300, boostTokens: 3, cosmetics: ['ring-gold'] }
    },
    {
      id: 'nh_gems_small',
      kind: 'consumable',
      title: 'Gem-Kapsel',
      fallbackPrice: '1,99 €',
      lines: ['120 Gems'],
      grants: { gems: 120 }
    },
    {
      id: 'nh_gems_medium',
      kind: 'consumable',
      title: 'Gem-Container',
      fallbackPrice: '8,99 €',
      highlight: '+8 % Bonus',
      lines: ['650 Gems'],
      grants: { gems: 650 }
    },
    {
      id: 'nh_gems_large',
      kind: 'consumable',
      title: 'Gem-Frachter',
      fallbackPrice: '17,99 €',
      highlight: '+25 % Bonus',
      lines: ['1.500 Gems'],
      grants: { gems: 1500 }
    },
    {
      // Consumable that unlocks the premium track of the season that is active at purchase time.
      id: 'nh_season_pass',
      kind: 'consumable',
      title: 'Sternenpass (aktuelle Saison)',
      fallbackPrice: '4,99 €',
      lines: ['Premium-Belohnungen der laufenden Saison', 'Alle Belohnungen sind vorab sichtbar'],
      grants: { seasonPass: true }
    }
  ]);

  const COSMETICS = Object.freeze({
    'ship-aurora': { slot: 'ship', name: 'Aurora-Lackierung', icon: '🚀' },
    'ring-gold': { slot: 'ring', name: 'Goldener Orbitalring', icon: '🪐' },
    'trail-nebula': { slot: 'trail', name: 'Nebel-Drohnenspur', icon: '✦' },
    'ship-ember': { slot: 'ship', name: 'Glut-Lackierung', icon: '🔥' },
    'ring-frost': { slot: 'ring', name: 'Frost-Orbitalring', icon: '❄' },
    'trail-solar': { slot: 'trail', name: 'Sonnenwind-Spur', icon: '☀' },
    // Mochi accessories (welcome capsule pool; purely visual)
    'acc-star-helmet': { slot: 'mochi', name: 'Sternchen-Helm', icon: '⭐' },
    'acc-mint-scarf': { slot: 'mochi', name: 'Mint-Schal', icon: '🧣' },
    'acc-star-backpack': { slot: 'mochi', name: 'Goldener Sternrucksack', icon: '🎒' },
    'acc-cute-antenna': { slot: 'mochi', name: 'Herz-Antenne', icon: '📡' },
    'acc-explorer-goggles': { slot: 'mochi', name: 'Mini-Forscherbrille', icon: '🥽' },
    'acc-moon-patch': { slot: 'mochi', name: 'Mond-Aufnäher', icon: '🌙' },
    // Beta 1.2 Sternenschmiede: earned with Sternsplitter (forge = price in ✦), purely visual, never sold here.
    // Same ownership list as every other cosmetic, so a later direct sale or bundle can reuse it without duplicates.
    'glider-midnight': { slot: 'glider', name: 'Mitternachtsgleiter', icon: '🌌', forge: 150, text: 'Tikkis Gleiter in Nachtblau mit Sternpunkten' },
    'glider-blossom': { slot: 'glider', name: 'Kirschblütengleiter', icon: '🌸', forge: 150, text: 'Tikkis Gleiter in Rosa mit Blütenkante' },
    'impact-gold': { slot: 'impact', name: 'Goldfunken', icon: '✨', forge: 120, text: 'Deine Schiffsschüsse und Treffer leuchten golden' },
    'impact-aurora': { slot: 'impact', name: 'Polarlicht-Funken', icon: '🌈', forge: 120, text: 'Deine Schiffsschüsse und Treffer leuchten türkis-violett' },
    'engine-comet': { slot: 'engine', name: 'Kometenschweif', icon: '☄', forge: 200, text: 'Eine funkelnde Spur hinter deinem Schiff im Kampf' },
    'ship-starlight': { slot: 'ship', name: 'Sternenstaub-Lackierung', icon: '🌟', forge: 250, text: 'Nachtblaues Schiff mit goldenen Akzenten – in Kolonie und Kampf' },
    // Beta 1.3 looks: also forged with Sternsplitter (earned only), purely visual, one ownership list
    'outfit-rose': { slot: 'outfit', name: 'Rosa Raumanzug', icon: '🩷', forge: 180, text: 'Mochis Anzug in Rosa mit weißen Kanten – Kolonie, Mine und Porträts' },
    'outfit-explorer': { slot: 'outfit', name: 'Forscher-Overall', icon: '🧭', forge: 180, text: 'Mochis Anzug in Sandbraun mit Korallen-Akzenten – für Expeditionen' },
    'ship-sakura': { slot: 'ship', name: 'Kirschblüten-Lack', icon: '🌸', forge: 220, text: 'Weiß-rosa Schiff mit Blütenkante – in Kolonie und Kampf' },
    'ship-mint': { slot: 'ship', name: 'Minz-Lack', icon: '🍃', forge: 220, text: 'Mintgrünes Schiff mit cremefarbenen Streifen – in Kolonie und Kampf' },
    'deco-lanterns': { slot: 'colony', name: 'Laternenkette', icon: '🏮', forge: 160, text: 'Bunte Laternen über deiner Kolonie, die abends leuchten' },
    'mine-crystal-lamps': { slot: 'mine', name: 'Kristall-Grubenlampen', icon: '💎', forge: 160, text: 'Leuchtende Kristalllampen an jeder Sohle deiner Mine' }
  });
  // Free welcome capsule: one equal-probability draw per save identity, never sold, never rerolled.
  const WELCOME_POOL = Object.freeze(['acc-star-helmet', 'acc-mint-scarf', 'acc-star-backpack', 'acc-cute-antenna', 'acc-explorer-goggles', 'acc-moon-patch']);
  const GUARDIAN_STAGES = ['locked', 'warned', 'battle', 'defeated', 'repaired'];

  // Rewarded ad placements. Every placement is optional, clearly labelled and capped per day.
  const PLACEMENTS = Object.freeze({
    offline_double: { label: 'Offline-Ertrag verdoppeln', dailyCap: 3 },
    boost: { label: 'Produktion 2× für 15 Min.', dailyCap: 6 },
    expedition: { label: 'Expedition sofort beenden', dailyCap: 4 },
    scanner: { label: 'Signal-Scanner sofort aufladen', dailyCap: 3 },
    construction: { label: 'Schacht-Baustelle beschleunigen', dailyCap: 5 },
    // Beta 1.4: finish the free emergency repair at once (the repair itself stays free without the ad)
    repair: { label: 'Notreparatur sofort abschließen', dailyCap: 3 }
  });

  // ---------------------------------------------------------------------------------------------------------------
  // Season pass. Seasons rotate every 28 days from a fixed UTC epoch, so start and end are deterministic and shown
  // to the player. No server is required; new reward themes ship with app updates.
  const SEASON_EPOCH = Date.UTC(2026, 10, 2); // Monday; before this date season 1 is active
  const SEASON_LENGTH = 28 * 86400000;
  const SEASON_TIERS = 30;
  const SEASON_TIER_XP = 180;
  const SEASON_THEMES = Object.freeze([
    { name: 'Erwachen der Nebel', cosmetics: ['trail-nebula', 'ring-frost', 'ship-ember'] },
    { name: 'Glut der Schmiede', cosmetics: ['ship-ember', 'trail-solar', 'ring-frost'] },
    { name: 'Frostgrenze', cosmetics: ['ring-frost', 'trail-nebula', 'trail-solar'] }
  ]);
  // Tuned with tools/economy-sim.mjs: a regular player (~1-2 h/day) completes the track in roughly 3-4 weeks.
  const SEASON_XP = Object.freeze({
    upgrade: 0,
    research: 8,
    planet: 10,
    scan: 2,
    expedition: 1,
    sector: 10,
    contract: 10,
    enemy: 0,
    boss: 2,
    strategic: 5,
    daily: 20,
    prestige: 40,
    gate: 25
  });
  // Absence builds a 'rested' pool (max 300 XP) that doubles subsequent XP gains - helps casual players without
  // creating any daily obligation or penalty.
  const SEASON_RESTED_PER_HOUR = 12;
  const SEASON_RESTED_CAP = 300;
  // Soft daily pace: the first 300 XP of a day count fully, further XP at 25 %. Missing days costs nothing
  // (rested XP even helps) — it only stops marathon sessions from finishing a 28-day track in a few days.
  const SEASON_DAILY_FULL_XP = 300;
  const SEASON_OVERFLOW_RATE = 0.25;

  function seasonAt(now) {
    const index = Math.max(0, Math.floor((now - SEASON_EPOCH) / SEASON_LENGTH));
    const start = SEASON_EPOCH + index * SEASON_LENGTH;
    const theme = SEASON_THEMES[index % SEASON_THEMES.length];
    return { id: 'S' + (index + 1), index, start, end: start + SEASON_LENGTH, name: theme.name, theme };
  }

  // Rewards per tier, fully deterministic and visible in advance.
  function seasonRewards(season) {
    const free = [],
      premium = [];
    const freeCycle = [{ crystals: 2 }, { fuel: 6 }, { gems: 5 }, { alloys: 3 }, { timeWarp: 15 }];
    const premiumCycle = [{ gems: 10 }, { boostTokens: 1 }, { crystals: 4 }, { timeWarp: 30 }, { alloys: 6 }];
    for (let tier = 1; tier <= SEASON_TIERS; tier++) {
      free.push(tier === SEASON_TIERS ? { gems: 30 } : freeCycle[(tier - 1) % freeCycle.length]);
      const cosmeticIndex = tier === 10 ? 0 : tier === 20 ? 1 : tier === 30 ? 2 : -1;
      premium.push(
        cosmeticIndex >= 0
          ? { cosmetic: season.theme.cosmetics[cosmeticIndex], gems: 20 }
          : premiumCycle[(tier - 1) % premiumCycle.length]
      );
    }
    return { free, premium };
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Ledger (pure functions over the `meta` object stored in the save; meta survives prestige).
  function createMeta() {
    return {
      purchases: {}, // transactionId -> { productId, at, status: 'granted' | 'pending' | 'revoked', season }
      entitlements: {},
      cosmetics: [],
      cosmeticsUnknown: [], // Beta 1.2: ids a newer build knows — kept, never shown, restored once known
      equipped: { ship: null, ring: null, trail: null, mochi: null, glider: null, impact: null, engine: null },
      welcome: null, // { item, at }
      guardians: { pips: { stage: 'locked', drones: 0, hp: 0, maxHp: 0, fightStart: 0 } },
      story: { journal: [], liberated: [] },
      boostTokens: 0,
      ads: {}, // placement -> { day: 'YYYY-MM-DD', count }
      adRewards: [], // recent reward ids (dedupe)
      season: { id: null, xp: 0, rested: 0, premium: false, claimedFree: [], claimedPremium: [] },
      stats: { gemsPurchased: 0 }
    };
  }

  function normalizeMeta(raw) {
    const meta = createMeta();
    if (!raw || typeof raw !== 'object') return meta;
    if (raw.purchases && typeof raw.purchases === 'object')
      for (const [id, purchase] of Object.entries(raw.purchases))
        if (purchase && typeof purchase.productId === 'string' && CATALOG.some(item => item.id === purchase.productId))
          meta.purchases[id] = {
            productId: purchase.productId,
            at: Number(purchase.at) || 0,
            status: ['granted', 'pending', 'revoked'].includes(purchase.status) ? purchase.status : 'granted',
            season: typeof purchase.season === 'string' ? purchase.season : null
          };
    if (raw.entitlements && typeof raw.entitlements === 'object')
      for (const key of Object.keys(raw.entitlements)) meta.entitlements[key] = raw.entitlements[key] === true;
    meta.cosmetics = Array.isArray(raw.cosmetics) ? [...new Set(raw.cosmetics.filter(id => COSMETICS[id]))] : [];
    // unknown ids (a newer build's cosmetics) are protected instead of silently dropped; known ones move back
    const unknownIds = [...(Array.isArray(raw.cosmetics) ? raw.cosmetics : []), ...(Array.isArray(raw.cosmeticsUnknown) ? raw.cosmeticsUnknown : [])].filter(id => typeof id === 'string' && id.length <= 40);
    for (const id of unknownIds) if (COSMETICS[id] && !meta.cosmetics.includes(id)) meta.cosmetics.push(id);
    meta.cosmeticsUnknown = [...new Set(unknownIds.filter(id => !COSMETICS[id]))].slice(0, 100);
    for (const slot of ['ship', 'ring', 'trail', 'mochi', 'glider', 'impact', 'engine', 'outfit', 'colony', 'mine']) {
      const id = raw.equipped?.[slot];
      meta.equipped[slot] = meta.cosmetics.includes(id) && COSMETICS[id]?.slot === slot ? id : null;
    }
    meta.boostTokens = Math.max(0, Math.min(999, Math.floor(Number(raw.boostTokens) || 0)));
    if (raw.ads && typeof raw.ads === 'object')
      for (const key of Object.keys(PLACEMENTS)) {
        const entry = raw.ads[key];
        if (entry && typeof entry.day === 'string')
          meta.ads[key] = { day: entry.day, count: Math.max(0, Number(entry.count) || 0) };
      }
    meta.adRewards = Array.isArray(raw.adRewards) ? raw.adRewards.filter(id => typeof id === 'string').slice(-50) : [];
    const season = raw.season || {};
    meta.season = {
      id: typeof season.id === 'string' ? season.id : null,
      xp: Math.max(0, Math.floor(Number(season.xp) || 0)),
      rested: Math.max(0, Math.min(SEASON_RESTED_CAP, Math.floor(Number(season.rested) || 0))),
      day: typeof season.day === 'string' ? season.day : '',
      dayXp: Math.max(0, Number(season.dayXp) || 0),
      premium: season.premium === true,
      claimedFree: Array.isArray(season.claimedFree) ? season.claimedFree.filter(Number.isInteger) : [],
      claimedPremium: Array.isArray(season.claimedPremium) ? season.claimedPremium.filter(Number.isInteger) : []
    };
    meta.stats.gemsPurchased = Math.max(0, Number(raw.stats?.gemsPurchased) || 0);
    if (raw.welcome && WELCOME_POOL.includes(raw.welcome.item))
      meta.welcome = { item: raw.welcome.item, at: Number(raw.welcome.at) || 0 };
    const pips = raw.guardians?.pips || {};
    meta.guardians.pips = {
      stage: GUARDIAN_STAGES.includes(pips.stage) ? pips.stage : 'locked',
      drones: Math.max(0, Math.min(2, Math.floor(Number(pips.drones) || 0))),
      hp: Math.max(0, Number(pips.hp) || 0),
      maxHp: Math.max(0, Number(pips.maxHp) || 0),
      fightStart: Number(pips.fightStart) || 0
    };
    if (raw.story && typeof raw.story === 'object') {
      meta.story.journal = Array.isArray(raw.story.journal) ? [...new Set(raw.story.journal.filter(id => typeof id === 'string'))].slice(0, 200) : [];
      meta.story.liberated = Array.isArray(raw.story.liberated) ? raw.story.liberated.filter(Number.isInteger) : [];
    }
    // Beta 1.4: sections of a newer build (unknown keys) are kept as they are — the game modules normalise their own
    for (const [key, value] of Object.entries(raw)) if (!(key in meta) && key.length <= 40) meta[key] = value;
    return meta;
  }

  const product = id => CATALOG.find(item => item.id === id) || null;
  const dayKey = now => new Date(now).toISOString().slice(0, 10);

  /**
   * Applies a store transaction exactly once.
   * @returns {{status: 'granted'|'duplicate'|'pending'|'invalid'|'already-owned', grants?: object}}
   */
  function recordPurchase(meta, { transactionId, productId, state = 'approved', now = Date.now(), seasonId = null }) {
    const item = product(productId);
    if (!item || typeof transactionId !== 'string' || !transactionId) return { status: 'invalid' };
    const existing = meta.purchases[transactionId];
    if (state === 'pending') {
      if (!existing) meta.purchases[transactionId] = { productId, at: now, status: 'pending', season: seasonId };
      return { status: 'pending' };
    }
    if (existing && existing.status !== 'pending') return { status: 'duplicate' };
    // A non-consumable restored under a different transaction id must not grant its one-time contents again.
    if (
      item.kind === 'non-consumable' &&
      Object.entries(meta.purchases).some(
        ([id, purchase]) => id !== transactionId && purchase.productId === productId && purchase.status === 'granted'
      )
    ) {
      meta.purchases[transactionId] = { productId, at: now, status: 'granted', season: seasonId, restoredCopy: true };
      return { status: 'already-owned' };
    }
    meta.purchases[transactionId] = { productId, at: now, status: 'granted', season: seasonId };
    const grants = { ...item.grants };
    if (grants.entitlement) meta.entitlements[grants.entitlement] = true;
    if (grants.cosmetics) for (const id of grants.cosmetics) if (!meta.cosmetics.includes(id)) meta.cosmetics.push(id);
    if (grants.boostTokens) meta.boostTokens += grants.boostTokens;
    if (grants.seasonPass) {
      if (meta.season.id !== seasonId)
        meta.season = { id: seasonId, xp: 0, rested: 0, premium: false, claimedFree: [], claimedPremium: [] };
      meta.season.premium = true;
    }
    if (grants.gems) meta.stats.gemsPurchased += grants.gems;
    return { status: 'granted', grants };
  }

  /** Store reports a non-consumable as no longer owned (refund/chargeback). Removes the entitlement. */
  function revokeProduct(meta, productId) {
    const item = product(productId);
    if (!item || item.kind !== 'non-consumable') return false;
    let changed = false;
    for (const purchase of Object.values(meta.purchases))
      if (purchase.productId === productId && purchase.status === 'granted') {
        purchase.status = 'revoked';
        changed = true;
      }
    if (!changed) return false;
    if (item.grants.entitlement) delete meta.entitlements[item.grants.entitlement];
    for (const id of item.grants.cosmetics || []) {
      meta.cosmetics = meta.cosmetics.filter(owned => owned !== id);
      for (const slot of Object.keys(meta.equipped)) if (meta.equipped[slot] === id) meta.equipped[slot] = null;
    }
    return true;
  }

  function owns(meta, productId) {
    return Object.values(meta.purchases).some(
      purchase => purchase.productId === productId && purchase.status === 'granted'
    );
  }

  function adRemaining(meta, placement, now = Date.now()) {
    const config = PLACEMENTS[placement];
    if (!config) return 0;
    const entry = meta.ads[placement];
    return entry && entry.day === dayKey(now) ? Math.max(0, config.dailyCap - entry.count) : config.dailyCap;
  }

  /** Records a verified reward event exactly once. */
  function recordAdReward(meta, placement, rewardId, now = Date.now()) {
    if (!PLACEMENTS[placement] || !rewardId || meta.adRewards.includes(rewardId)) return false;
    if (adRemaining(meta, placement, now) <= 0) return false;
    const day = dayKey(now),
      entry = meta.ads[placement];
    meta.ads[placement] = { day, count: entry && entry.day === day ? entry.count + 1 : 1 };
    meta.adRewards = [...meta.adRewards, rewardId].slice(-50);
    return true;
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Providers
  const config = () => window.NEBULA_CONFIG || {};
  const listeners = { transaction: null };

  // Development store: simulates success, cancel, pending, error and refunds through an explicit dialog.
  function createMockStore() {
    const KEY = 'nebula-mock-store';
    const load = () => {
      try {
        return JSON.parse(localStorage.getItem(KEY) || '{"owned":{},"pending":[],"seq":0}');
      } catch {
        return { owned: {}, pending: [], seq: 0 };
      }
    };
    const persist = data => {
      try {
        localStorage.setItem(KEY, JSON.stringify(data));
      } catch {}
    };
    let resolver = null;
    function dialog(item) {
      return new Promise(resolve => {
        resolver = resolve;
        const root = document.getElementById('mockStoreModal');
        if (!root) return resolve('error');
        root.querySelector('[data-mock-title]').textContent = item.title + ' · ' + item.fallbackPrice;
        root.classList.remove('hidden');
      });
    }
    document.addEventListener('click', event => {
      const choice = event.target.closest('[data-mock-result]');
      if (!choice || !resolver) return;
      document.getElementById('mockStoreModal')?.classList.add('hidden');
      const resolve = resolver;
      resolver = null;
      resolve(choice.dataset.mockResult);
    });
    return {
      name: 'mock',
      available: () => true,
      async init() {},
      // the mock never charges; its prices are marked as test values (never shown as a real localized price)
      price: id => (product(id)?.fallbackPrice ? product(id).fallbackPrice + ' (Test)' : ''),
      async purchase(id) {
        const item = product(id);
        if (!item) return { status: 'error', message: 'Unbekanntes Produkt' };
        const data = load();
        if (item.kind === 'non-consumable' && data.owned[id]) return { status: 'already-owned' };
        const outcome = await (window.__mockStoreOutcome ? Promise.resolve(window.__mockStoreOutcome) : dialog(item));
        if (outcome === 'cancel') return { status: 'cancelled' };
        if (outcome === 'error') return { status: 'error', message: 'Simulierter Store-Fehler' };
        const transactionId = 'mock-' + Date.now() + '-' + ++data.seq;
        if (outcome === 'pending') {
          data.pending.push({ transactionId, productId: id });
          persist(data);
          await listeners.transaction?.({ transactionId, productId: id, state: 'pending' });
          return { status: 'pending' };
        }
        if (item.kind === 'non-consumable') data.owned[id] = transactionId;
        persist(data);
        const result = await listeners.transaction?.({ transactionId, productId: id, state: 'approved' });
        return { status: result?.status === 'granted' ? 'success' : result?.status || 'success' };
      },
      async restore() {
        const data = load();
        let restored = 0;
        for (const [productId, transactionId] of Object.entries(data.owned)) {
          const result = await listeners.transaction?.({ transactionId, productId, state: 'approved' });
          if (result?.status === 'granted') restored++;
        }
        return { status: 'ok', restored, owned: Object.keys(data.owned) };
      },
      // Dev helpers
      async completePending() {
        const data = load();
        const pending = data.pending.splice(0);
        for (const tx of pending) {
          if (product(tx.productId)?.kind === 'non-consumable') data.owned[tx.productId] = tx.transactionId;
          persist(data);
          await listeners.transaction?.({ ...tx, state: 'approved' });
        }
        persist(data);
        return pending.length;
      },
      refund(productId) {
        const data = load();
        delete data.owned[productId];
        persist(data);
      }
    };
  }

  // Google Play Billing through cordova-plugin-purchase (CdvPurchase v13). UNTESTED until installed on a device.
  function createNativeStore() {
    let ready = false,
      initError = null;
    const api = () => window.CdvPurchase;
    return {
      name: 'native',
      available: () => Boolean(api()) && ready && !initError,
      async init() {
        const Cdv = api();
        if (!Cdv) {
          initError = 'Billing-Plugin nicht installiert';
          return;
        }
        const { store, ProductType, Platform } = Cdv;
        store.register(
          CATALOG.map(item => ({
            id: item.id,
            type: item.kind === 'consumable' ? ProductType.CONSUMABLE : ProductType.NON_CONSUMABLE,
            platform: Platform.GOOGLE_PLAY
          }))
        );
        store
          .when()
          .approved(async transaction => {
            for (const p of transaction.products) {
              const result = await listeners.transaction?.({
                transactionId: transaction.transactionId + ':' + p.id,
                productId: p.id,
                state: 'approved'
              });
              // Only acknowledge/consume after the grant has been persisted.
              if (result && ['granted', 'duplicate', 'already-owned'].includes(result.status)) transaction.finish();
            }
          })
          .pending(transaction => {
            for (const p of transaction.products)
              listeners.transaction?.({
                transactionId: transaction.transactionId + ':' + p.id,
                productId: p.id,
                state: 'pending'
              });
          })
          .productUpdated(() => window.dispatchEvent(new Event('nebula-store-updated')));
        try {
          await store.initialize([Platform.GOOGLE_PLAY]);
          ready = true;
        } catch (error) {
          initError = String(error?.message || error);
        }
      },
      price: id => api()?.store.get(id)?.pricing?.price || '',
      async purchase(id) {
        const Cdv = api();
        const offer = Cdv?.store.get(id)?.getOffer();
        if (!offer) return { status: 'error', message: 'Produkt derzeit nicht verfügbar' };
        const error = await offer.order();
        if (!error) return { status: 'submitted' };
        if (error.code === Cdv.ErrorCode.PAYMENT_CANCELLED) return { status: 'cancelled' };
        return { status: 'error', message: error.message };
      },
      async restore() {
        const Cdv = api();
        if (!Cdv) return { status: 'error' };
        await Cdv.store.restorePurchases();
        const owned = CATALOG.filter(item => item.kind === 'non-consumable' && Cdv.store.owned(item.id)).map(
          item => item.id
        );
        return { status: 'ok', owned };
      }
    };
  }

  // Development ad provider: a visible 5-second test placement; closing early = no reward (interrupted ad).
  let mockAdSeq = 0;
  function createMockAds() {
    let resolver = null,
      timer = null,
      seconds = 0;
    document.addEventListener('click', event => {
      if (!event.target.closest('[data-mock-ad-close]') || !resolver) return;
      finish(seconds <= 0);
    });
    function finish(rewarded) {
      clearInterval(timer);
      document.getElementById('mockAdModal')?.classList.add('hidden');
      const resolve = resolver;
      resolver = null;
      resolve?.({
        rewarded,
        rewardId: rewarded ? 'mockad-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) : null
      });
    }
    return {
      name: 'mock',
      available: () => true,
      async init() {},
      show(placement) {
        if (window.__mockAdOutcome) {
          const outcome = window.__mockAdOutcome;
          return Promise.resolve(
            outcome === 'reward'
              ? { rewarded: true, rewardId: 'mockad-' + Date.now() + '-' + placement + '-' + ++mockAdSeq }
              : { rewarded: false, error: outcome }
          );
        }
        return new Promise(resolve => {
          resolver = resolve;
          seconds = 5;
          const modal = document.getElementById('mockAdModal');
          if (!modal) return finish(false);
          const label = modal.querySelector('[data-mock-ad-count]');
          label.textContent = seconds + ' s';
          modal.classList.remove('hidden');
          timer = setInterval(() => {
            seconds--;
            label.textContent = seconds > 0 ? seconds + ' s' : 'Belohnung bereit – schließen';
            if (seconds <= 0) clearInterval(timer);
          }, 1000);
        });
      }
    };
  }

  // AdMob rewarded ads via @capacitor-community/admob. UNTESTED until installed and configured.
  const TEST_REWARDED_ID = 'ca-app-pub-3940256099942544/5224354917'; // Google's public test unit
  function createNativeAds() {
    let ready = false;
    const plugin = () => window.Capacitor?.Plugins?.AdMob;
    return {
      name: 'native',
      available: () => Boolean(plugin()) && ready,
      async init() {
        const AdMob = plugin();
        if (!AdMob) return;
        try {
          await AdMob.initialize({ initializeForTesting: config().adsTestMode !== false });
          const consent = await AdMob.requestConsentInfo();
          if (consent?.isConsentFormAvailable && consent.status === 'REQUIRED') await AdMob.showConsentForm();
          ready = true;
        } catch {
          ready = false;
        }
      },
      async show() {
        const AdMob = plugin();
        if (!AdMob || !ready) return { rewarded: false, error: 'unavailable' };
        const adId = config().adsTestMode !== false ? TEST_REWARDED_ID : config().rewardedAdUnitId;
        if (!adId) return { rewarded: false, error: 'not-configured' };
        let rewardItem = null;
        const handles = [];
        try {
          handles.push(await AdMob.addListener('onRewardedVideoAdReward', item => (rewardItem = item)));
          await AdMob.prepareRewardVideoAd({ adId, isTesting: config().adsTestMode !== false });
          await AdMob.showRewardVideoAd();
          return rewardItem
            ? { rewarded: true, rewardId: 'admob-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) }
            : { rewarded: false, error: 'interrupted' };
        } catch (error) {
          return { rewarded: false, error: String(error?.message || error) };
        } finally {
          handles.forEach(handle => handle?.remove?.());
        }
      }
    };
  }

  // Disabled provider: used for 'none' and for any non-native provider outside dev builds, so a release build can
  // never fall back to the simulated store or ads.
  const disabled = kind => ({
    name: 'none',
    available: () => false,
    async init() {},
    price: () => '',
    async purchase() {
      return { status: 'error', message: 'Käufe sind nicht verfügbar' };
    },
    async restore() {
      return { status: 'error' };
    },
    async show() {
      return { rewarded: false, error: 'unavailable' };
    },
    kind
  });
  const mockAllowed = config().build !== 'release' && config().devTools !== false;
  const pick = (provider, native, mock, kind) =>
    provider === 'native' ? native() : provider === 'mock' && mockAllowed ? mock() : disabled(kind);
  const store = pick(config().storeProvider, createNativeStore, createMockStore, 'store');
  const ads = pick(config().adsProvider, createNativeAds, createMockAds, 'ads');

  window.NebulaCommerce = {
    CATALOG,
    COSMETICS,
    WELCOME_POOL,
    SEASON_THEMES,
    PLACEMENTS,
    SEASON_TIERS,
    SEASON_TIER_XP,
    SEASON_XP,
    SEASON_RESTED_PER_HOUR,
    SEASON_RESTED_CAP,
    SEASON_DAILY_FULL_XP,
    SEASON_OVERFLOW_RATE,
    store,
    ads,
    product,
    seasonAt,
    seasonRewards,
    createMeta,
    normalizeMeta,
    recordPurchase,
    revokeProduct,
    owns,
    adRemaining,
    recordAdReward,
    onTransaction(handler) {
      listeners.transaction = handler;
    },
    async init() {
      await Promise.allSettled([store.init(), ads.init()]);
    }
  };
})();
