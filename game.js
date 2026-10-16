const defaults = {
  schemaVersion: 24,
  credits: 120,
  gems: 25,
  stardust: 0,
  totalEarned: 120,
  galaxiesSold: 0,
  expeditionsComplete: 0,
  lastSeen: Date.now(),
  // E-01: monotonic "paid until" mark (epoch ms). Offline time is only paid after it, so moving the device clock
  // back and forth cannot pay the same absence twice. Live play advances it by real tick time even while the clock
  // is behind. This only protects legitimate progress consistency; an offline client cannot be made cheat-proof.
  paidUntil: 0,
  ore: 16,
  crystals: 2,
  fuel: 8,
  alloys: 0,
  dailyDay: 1,
  lastDaily: 0,
  spinAt: 0,
  expeditionEnd: 0,
  surveyEnd: 0,
  surveyTarget: null,
  sectorScanEnd: 0,
  sectorScanTarget: null,
  sectorScans: [],
  sectorUnlocked: [],
  sectorExpedition: null,
  jumpGate: 0,
  contracts: { claimed: {}, riskyExpeditions: 0 },
  crewActive: [0],
  crewSlots: 2,
  eventBoostUntil: 0,
  activeEvent: null,
  nextEventAt: Date.now() + 180000,
  overchargeUntil: 0,
  aimReady: false,
  aimCooldownUntil: 0,
  combo: 0,
  comboAt: 0,
  autoBattle: false,
  quests: [false, false, false],
  introSeen: false,
  activePlanet: 0,
  planetsUnlocked: [true, false, false, false, false, false],
  research: [false, false, false, false, false],
  reputation: [0, 0, 0],
  faction: { joined: null, territory: [], influence: [], claimed: [], warUntil: 0, warTarget: null },
  planetOps: { storage: [], investment: [], harvests: [], specializations: [] },
  inventory: [],
  itemDiscoveries: [],
  ship: {
    weapon: 0,
    hull: 0,
    core: 0,
    engine: 0,
    model: 'Horizon',
    models: { Horizon: true },
    weaponType: 'Laser',
    weaponTypes: { Laser: true }
  },
  bossDefeats: 0,
  buildings: [
    { name: 'Kristallmine', icon: '⛏', level: 1, base: 1, cost: 35 },
    { name: 'Helferhütte', icon: '⌂', level: 0, base: 6, cost: 160 },
    { name: 'Lagerhaus', icon: '▦', level: 0, base: 27, cost: 720 },
    { name: 'Frachtdock', icon: '⛴', level: 0, base: 110, cost: 3600 }
  ],
  crew: [
    {
      name: 'Mochi',
      bio: 'Neugierig, mutig, ein bisschen tollpatschig – und völlig verzaubert von allem, was leuchtet. Mochi fand den alten Sternkompass.',
      role: 'Bergbau · Hauptfigur',
      icon: '⛏',
      cost: 0,
      unlocked: true,
      rank: 1,
      unlock: 'Von Anfang an dabei',
      primary: '+12% Förderung',
      secondary: 'Rang 3: +10% aktiver Abbau'
    },
    {
      name: 'Boba',
      bio: 'Ruhige graue Pilotin mit weißen Socken. Beschützt die Kolonie und fliegt das Kampfschiff.',
      role: 'Verteidigung',
      icon: '⚔',
      cost: 900,
      unlocked: false,
      rank: 1,
      unlock: '1.000 verdiente Credits',
      primary: '+2 Kampfschaden je Rang',
      secondary: 'Rang 3: +10% in Kriegseinsätzen'
    },
    {
      name: 'Miso',
      bio: 'Glückskatze mit Schal und Händlerseele. Kennt jede Händlerin im Sternenbasar.',
      role: 'Handel',
      icon: '⇄',
      cost: 2500,
      unlocked: false,
      rank: 1,
      unlock: '4.000 verdiente Credits',
      primary: '+10% Marktwert',
      secondary: 'Rang 3: +5% ausgelieferte Waren'
    },
    {
      name: 'Pip',
      bio: 'Schwarzer Frachtpilot mit Mütze. Bringt jede Kiste pünktlich ans Ziel.',
      role: 'Logistik',
      icon: '◫',
      cost: 7000,
      unlocked: false,
      rank: 1,
      unlock: 'Eine Welt auf Entwicklungsstufe 3',
      primary: '+25 Transportkapazität',
      secondary: 'Rang 3: +8% bei vollen Lagern'
    },
    {
      name: 'Lumi',
      bio: 'Weiße Forscherin mit verschiedenfarbigen Augen. Liest alte Sternenarchive.',
      role: 'Forschung',
      icon: '⌁',
      cost: 14000,
      unlocked: false,
      rank: 1,
      unlock: 'Drohnen-Matrix erforscht',
      primary: '-8% Forschungskosten',
      secondary: 'Rang 3: +10% Scanfortschritt'
    },
    {
      name: 'Nori',
      bio: 'Brauner Kundschafter, immer mit Antenne auf Empfang für neue Signale.',
      role: 'Erkundung',
      icon: '☄',
      cost: 24000,
      unlocked: false,
      rank: 1,
      unlock: 'Vesper-Drift gesichert',
      primary: '-10% Scanzeit',
      secondary: 'Rang 3: Risiko-Expeditionen -1 Treibstoff'
    },
    {
      name: 'Tikki',
      bio: 'Rote Tüftlerin mit Schutzbrille. Repariert alles, was brummt.',
      role: 'Technik',
      icon: '⚗',
      cost: 36000,
      unlocked: false,
      rank: 1,
      unlock: '6 Legierungen und Sprungtor-Forschung',
      primary: '+1 Legierung bei aktivem Abbau',
      secondary: 'Rang 3: -8% Sprungtor-Kosten'
    },
    {
      name: 'Poppy',
      bio: 'Siam-Kätzchen mit Schleife. Vermittelt zwischen Gilden und Gemeinschaften.',
      role: 'Diplomatie',
      icon: '⚑',
      cost: 52000,
      unlocked: false,
      rank: 1,
      unlock: 'Fraktionsrang 1',
      primary: '-20% Reputationskosten',
      secondary: 'Rang 3: +1 Einfluss bei Bossen'
    }
  ],
  stars: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  enemyLevel: 1,
  enemyHp: 100,
  boostUntil: 0,
  flowCarry: { ore: 0, fuel: 0 }
};
const SCHEMA_VERSION = 37;
const PLANETS = window.NEBULA_DATA.PLANETS;
const RESEARCH = window.NEBULA_DATA.RESEARCH;
const FACTIONS = window.NEBULA_DATA.FACTIONS;
const SECTORS = window.NEBULA_DATA.SECTORS;
const EVENTS = window.NEBULA_DATA.EVENTS;
const BALANCE = window.NEBULA_DATA.BALANCE;
const STAR_UPGRADES = window.NEBULA_DATA.STAR_UPGRADES;
function starLevel(id) {
  const index = STAR_UPGRADES.findIndex(upgrade => upgrade.id === id);
  return index < 0 ? 0 : state.stars[index] || 0;
}
function starCost(index) {
  const upgrade = STAR_UPGRADES[index],
    level = state.stars[index] || 0;
  return upgrade.growth === 'square' ? upgrade.base * (level + 1) * (level + 1) : upgrade.base + level;
}
const SPECIALIZATION_IDS = ['mining', 'logistics', 'research', 'trade', 'military'];
// Clamp a possibly corrupted numeric save value into a safe finite range.
function safeNumber(value, fallback = 0, min = 0, max = 1e300) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}
// `state.buildings` is a view onto the colony of the planet currently being viewed (not saved separately).
function defineColonyView(target) {
  Object.defineProperty(target, 'buildings', {
    configurable: true,
    enumerable: false,
    get() {
      return this.colonies[this.activePlanet]?.buildings || this.colonies[0].buildings;
    }
  });
}
// A newly settled planet starts as an outpost with a small charter kit ("learned technology").
const COLONY_CHARTER = [3, 1, 0, 0];
function foundColony(index) {
  const colony = state.colonies[index];
  if (colony && colony.buildings.every(building => building.level === 0)) {
    colony.buildings.forEach((building, i) => (building.level = COLONY_CHARTER[i]));
    colony.industry.rail = Math.max(1, colony.industry.rail);
    colony.industry.stall = Math.max(1, colony.industry.stall);
  }
}
// Evaluates fn in the context of every settled colony (temporarily switches the planet context).
function forEachColony(fn) {
  const viewed = state.activePlanet;
  let total = 0;
  try {
    state.planetsUnlocked.forEach((unlocked, index) => {
      if (!unlocked) return;
      state.activePlanet = index;
      total += fn(index) || 0;
    });
  } finally {
    state.activePlanet = viewed;
  }
  return total;
}
// Rate of one colony, independent of which planet is currently viewed.
function colonyDeliveryRate(index) {
  const previous = state.activePlanet;
  state.activePlanet = index;
  try {
    return deliveryRate();
  } finally {
    state.activePlanet = previous;
  }
}
// Galaxy overview line: automation per core stage, own rate, the colony's real bottleneck and story status.
function colonySummary(index) {
  const previous = state.activePlanet;
  state.activePlanet = index;
  try {
    const colony = state.colonies[index],
      auto = colonyAutomation(index),
      sells = auto.stall || auto.dock,
      missing = [auto.mine, auto.rail, sells].filter(on => !on).length,
      freed = state.meta?.story?.liberated?.includes(index),
      stage = (icon, on) => `<i class="${on ? 'auto' : 'manual'}">${icon}${on ? '✓' : '✋'}</i>`,
      attention = missing
        ? missing + (missing === 1 ? ' Manager fehlt' : ' Manager fehlen')
        : stageBottleneck().id === 'mine'
          ? 'läuft rund'
          : stageBottleneck().text.replace(/ –.*$/, '').replace(/\.$/, '');
    const routes = (state.routes || []).filter(r => r.from === index || r.to === index),
      inbound = routes.filter(r => r.to === index && r.status !== 'idle').length;
    return `<small class="colony-summary">${stage('⛏', auto.mine)}${stage('🛒', auto.rail)}${stage('◈', sells)}${colony.industry.refinery ? stage('⚙', auto.refinery && auto.depot) : ''} · ${fmt(automatedIncomeRate())}/s</small><small class="colony-attention ${missing ? 'warn' : ''}">${attention}${freed ? ' · 🤖 befreit' : ''}${routes.length ? ' · ⇄ ' + routes.length + (inbound ? ' (' + inbound + ' im Anflug)' : '') : ''}</small>`;
  } finally {
    state.activePlanet = previous;
  }
}
function galacticDeliveryRate() {
  return forEachColony(() => deliveryRate());
}
// Schema ≤ 25 colonies converted to ordinary managers get a cart line sized to their previous throughput once
// (temporary boosts excluded). Runs after every load/import; colonies without the flag are untouched.
function sizeConvertedRails() {
  const wasOffline = offlineMode;
  offlineMode = true;
  try {
    if (state.colonies.some(colony => colony.railSizing)) preclaimIndustryMilestones();
    forEachColony(index => {
      const colony = state.colonies[index];
      if (!colony.railSizing) return;
      const need = Math.max(extractionRate(), transportCapacity());
      while (railRate() < need && colony.industry.rail < 100000) colony.industry.rail++;
      colony.railSizing = false;
    });
    state.colonies.forEach(colony => (colony.railSizing = false));
    migrateUnderground29();
  } finally {
    offlineMode = wasOffline;
  }
}
// Builds a complete, valid state from any (possibly old, partial or corrupted) save object.
// Static catalogue fields (names, costs, texts) always come from `defaults`; only progress is taken from the save.
function normalizeState(raw, now = Date.now()) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const state = { ...structuredClone(defaults), ...source, lastSeen: source.lastSeen ?? now };
  Object.keys(defaults).forEach(key => {
    if (typeof defaults[key] === 'number') state[key] = safeNumber(state[key], defaults[key]);
  });
  // Timestamps from a clock that was set far ahead must not lock the player out.
  ['lastDaily', 'spinAt', 'aimCooldownUntil', 'comboAt'].forEach(key => {
    if (state[key] > now + 86400000) state[key] = now;
  });
  ['expeditionEnd', 'surveyEnd', 'sectorScanEnd', 'overchargeUntil', 'boostUntil', 'eventBoostUntil'].forEach(key => {
    if (state[key] > now + 86400000) state[key] = now;
  });
  if (state.lastSeen > now) state.lastSeen = now;
  // never trust a mark far in the future (e.g. a clock that was set years ahead): fall back to "now"
  if (!(state.paidUntil <= now + 366 * 86400000)) state.paidUntil = now;
  state.dailyDay = Math.round(safeNumber(state.dailyDay, 1, 1, 7));
  state.enemyLevel = Math.floor(safeNumber(state.enemyLevel, 1, 1));
  // Legacy (≤ 24) global building levels; mapped into the colony of the previously active planet below.
  const legacyLevels = defaults.buildings.map((building, index) =>
    Math.floor(safeNumber(source.buildings?.[index]?.level, building.level, 0, 100000))
  );
  delete state.buildings;
  state.crew = defaults.crew.map((member, index) => {
    const saved = source.crew?.[index] || {};
    return {
      ...member,
      cost: BALANCE.crewCosts[index] ?? member.cost,
      rank: Math.round(safeNumber(saved.rank, 1, 1, 5)),
      unlocked: Boolean(saved.unlocked || saved.hired || index === 0)
    };
  });
  state.stars = defaults.stars.map((value, index) => Math.floor(safeNumber(source.stars?.[index], value, 0, 1000)));
  STAR_UPGRADES.forEach((upgrade, index) => {
    while (state.stars[index] > upgrade.max) {
      state.stars[index]--;
      // refund the linear cost of the removed level
      state.stardust += upgrade.base + state.stars[index];
    }
  });
  state.ship = {
    ...defaults.ship,
    ...(source.ship && typeof source.ship === 'object' ? source.ship : {}),
    models: { ...defaults.ship.models, ...(source.ship?.models || {}) },
    weaponTypes: { ...defaults.ship.weaponTypes, ...(source.ship?.weaponTypes || {}) }
  };
  ['weapon', 'hull', 'core', 'engine'].forEach(
    key => (state.ship[key] = Math.floor(safeNumber(state.ship[key], 0, 0, 10000)))
  );
  state.ship.refits = normalizeRefits(state.ship.refits); // Beta 1.5: refits from the Fertigung (arena.js)
  if (!state.ship.models[state.ship.model]) state.ship.model = 'Horizon';
  if (!state.ship.weaponTypes[state.ship.weaponType]) state.ship.weaponType = 'Laser';
  state.inventory = Array.isArray(state.inventory)
    ? state.inventory
        .filter(item => item && typeof item === 'object')
        .map(item => ({ effect: 'Schaden', ...item, power: safeNumber(item.power, 0, 0, 100) }))
        .slice(0, 30)
    : [];
  state.itemDiscoveries = Array.isArray(state.itemDiscoveries)
    ? [...new Set(state.itemDiscoveries.filter(name => typeof name === 'string'))]
    : [];
  state.quests = defaults.quests.map((_, index) => Boolean(source.quests?.[index]));
  state.flowCarry = {
    ore: safeNumber(source.flowCarry?.ore, 0, 0, 1),
    fuel: safeNumber(source.flowCarry?.fuel, 0, 0, 1)
  };
  state.planetsUnlocked = PLANETS.map((planet, index) => Boolean(source.planetsUnlocked?.[index] ?? index === 0));
  state.planetsUnlocked[0] = true;
  state.activePlanet = Math.floor(safeNumber(state.activePlanet, 0, 0, PLANETS.length - 1));
  if (!state.planetsUnlocked[state.activePlanet]) state.activePlanet = 0;
  // Schema 25: every planet owns its buildings. Old saves: all levels go to the planet the player was on;
  // other unlocked planets become small starter outposts (no duplication of upgrades).
  const savedColonies = Array.isArray(source.colonies) ? source.colonies : null;
  // Schema 26: staged industry. Saves from ≤ 25 ran production automatically → converted to ordinary managers.
  const legacyIndustry =
    typeof source.schemaVersion === 'number' ? source.schemaVersion < 26 : Boolean(source.buildings || source.colonies);
  // Schema 28: depot/dock extraction of older saves is kept as grandfathered Shaft-1 power (K26, deepcore.js).
  const legacyMining =
    typeof source.schemaVersion === 'number' ? source.schemaVersion < 28 : Boolean(source.buildings || source.colonies);
  // Schema 29: the living mine (discrete elevator, four shaft tracks); schema-28 undergrounds are converted.
  const legacyMine28 = typeof source.schemaVersion === 'number' && source.schemaVersion === 28;
  state.colonies = PLANETS.map((_, index) => {
    const saved = savedColonies?.[index];
    const levels =
      saved && Array.isArray(saved.buildings)
        ? defaults.buildings.map((building, i) =>
            Math.floor(safeNumber(saved.buildings[i]?.level ?? saved.buildings[i], 0, 0, 100000))
          )
        : !savedColonies && index === state.activePlanet
          ? legacyLevels
          : state.planetsUnlocked[index]
            ? [1, 0, 0, 0]
            : [0, 0, 0, 0];
    return {
      buildings: defaults.buildings.map((building, i) => ({ ...building, level: levels[i] })),
      ...normalizeIndustryColony(saved, levels, legacyIndustry),
      underground: normalizeUnderground(saved?.underground, levels, legacyMining && state.planetsUnlocked[index], legacyMine28),
      goods: normalizeGoods(saved?.goods), // schema 37: Fertigung goods (fabrication.js)
      fab: normalizeFab(saved?.fab, now)
    };
  });
  if (state.colonies[0].buildings[0].level < 1) state.colonies[0].buildings[0].level = 1;
  state.colonies[0].industry.rail = Math.max(1, state.colonies[0].industry.rail);
  state.colonies[0].industry.stall = Math.max(1, state.colonies[0].industry.stall);
  // Ordinary manager contracts survive prestige (levels restart at 1).
  if (Array.isArray(source.staffContracts))
    source.staffContracts.forEach((staff, index) => {
      if (!state.colonies[index] || !staff) return;
      WORKPLACES.forEach(w => {
        if (staff[w.id] > 0) state.colonies[index].staff[w.id] = Math.max(state.colonies[index].staff[w.id], 1);
      });
    });
  delete state.staffContracts;
  // The Rohkristall-Reserve setting survives prestige (a player choice, not progress; no stock is kept).
  if (Array.isArray(source.reserveSettings))
    source.reserveSettings.forEach((reserve, index) => {
      if (state.colonies[index] && RESERVE_OPTIONS.includes(Number(reserve?.raw))) state.colonies[index].reserve = { raw: Number(reserve.raw), chosen: Boolean(reserve.chosen) };
    });
  delete state.reserveSettings;
  // The Wurzelnetz assignment survives prestige like the reserve (a choice, not progress); roots regrow at once.
  if (Array.isArray(source.rootSettings))
    source.rootSettings.forEach((roots, index) => {
      if (state.colonies[index] && roots) state.colonies[index].roots = normalizeRoots({ slots: roots.slots });
    });
  delete state.rootSettings;
  state.surveyTarget = Number.isInteger(state.surveyTarget) && PLANETS[state.surveyTarget] ? state.surveyTarget : null;
  state.research = RESEARCH.map((_, index) => Boolean(source.research?.[index]));
  state.reputation = FACTIONS.map((_, index) => Math.floor(safeNumber(source.reputation?.[index], 0, 0, 3)));
  state.sectorScans = SECTORS.map((sector, index) =>
    Math.floor(safeNumber(source.sectorScans?.[index], 0, 0, sector.scans))
  );
  state.sectorUnlocked = SECTORS.map((_, index) => Boolean(source.sectorUnlocked?.[index]));
  state.sectorScanTarget =
    Number.isInteger(state.sectorScanTarget) && SECTORS[state.sectorScanTarget] ? state.sectorScanTarget : null;
  const mission = state.sectorExpedition;
  state.sectorExpedition =
    mission && typeof mission === 'object' && Number.isInteger(mission.target) && SECTORS[mission.target]
      ? {
          target: mission.target,
          risk: mission.risk === 'risk' ? 'risk' : 'safe',
          end: safeNumber(mission.end, now, 0, now + 86400000)
        }
      : null;
  state.jumpGate = Math.floor(safeNumber(state.jumpGate, 0, 0, 3));
  state.contracts = {
    ...defaults.contracts,
    ...(source.contracts && typeof source.contracts === 'object' ? source.contracts : {}),
    claimed: { ...(source.contracts?.claimed || {}) }
  };
  state.contracts.riskyExpeditions = Math.floor(safeNumber(state.contracts.riskyExpeditions, 0));
  state.crewSlots = Math.floor(safeNumber(state.crewSlots, 2, 2, 4));
  state.crewActive = Array.isArray(source.crewActive)
    ? [...new Set(source.crewActive.filter(index => Number.isInteger(index) && state.crew[index]?.unlocked))].slice(
        0,
        state.crewSlots
      )
    : state.crew
        .map((member, index) => (member.unlocked ? index : null))
        .filter(index => index !== null)
        .slice(0, state.crewSlots);
  if (!state.crewActive.length) state.crewActive = [0];
  state.faction = {
    ...structuredClone(defaults.faction),
    ...(source.faction && typeof source.faction === 'object' ? source.faction : {})
  };
  state.faction.joined =
    Number.isInteger(state.faction.joined) && FACTIONS[state.faction.joined] ? state.faction.joined : null;
  state.faction.territory = PLANETS.map((planet, index) =>
    Number.isInteger(state.faction.territory?.[index]) && FACTIONS[state.faction.territory[index]]
      ? state.faction.territory[index]
      : (planet.owner ?? null)
  );
  state.faction.influence = PLANETS.map((_, index) => safeNumber(state.faction.influence?.[index], 0, 0, 1000));
  state.faction.claimed = PLANETS.map((_, index) => Boolean(state.faction.claimed?.[index]));
  state.faction.warUntil = safeNumber(state.faction.warUntil, 0, 0, now + 86400000);
  state.faction.warTarget =
    Number.isInteger(state.faction.warTarget) && PLANETS[state.faction.warTarget] ? state.faction.warTarget : null;
  state.faction.control = PLANETS.map((planet, index) => {
    const legacy = state.faction.control?.[index],
      owner = state.faction.territory[index];
    if (Array.isArray(legacy) && legacy.length === FACTIONS.length) {
      const total = legacy.reduce((sum, value) => sum + safeNumber(value, 0), 0) || 1;
      return legacy.map(value => Math.round((safeNumber(value, 0) / total) * 100));
    }
    return FACTIONS.map((_, faction) => (faction === owner ? 70 : faction === (owner + 1) % FACTIONS.length ? 30 : 0));
  });
  state.faction.goalsClaimed =
    state.faction.goalsClaimed && typeof state.faction.goalsClaimed === 'object' ? state.faction.goalsClaimed : {};
  state.strategicEvent =
    state.strategicEvent &&
    typeof state.strategicEvent === 'object' &&
    typeof state.strategicEvent.type === 'string' &&
    typeof state.strategicEvent.id === 'string'
      ? state.strategicEvent
      : null;
  state.strategicEffects =
    state.strategicEffects && typeof state.strategicEffects === 'object' && !Array.isArray(state.strategicEffects)
      ? { ...state.strategicEffects }
      : {};
  Object.keys(state.strategicEffects).forEach(kind => {
    const effect = state.strategicEffects[kind];
    if (!effect || !Number.isFinite(effect.multiplier) || !Number.isFinite(effect.until))
      delete state.strategicEffects[kind];
  });
  state.strategicNextAt = safeNumber(source.strategicNextAt, now + 600000, 0, now + 86400000);
  state.strategicLastType = typeof state.strategicLastType === 'string' ? state.strategicLastType : '';
  state.strategicResolved = Array.isArray(state.strategicResolved)
    ? state.strategicResolved.filter(id => typeof id === 'string').slice(-20)
    : [];
  if (state.strategicEvent) {
    const target = state.strategicEvent.target,
      end = Number(state.strategicEvent.end),
      start = Number(state.strategicEvent.start);
    if (!Number.isInteger(target) || !PLANETS[target] || !Number.isFinite(end) || !Number.isFinite(start)) {
      state.strategicEvent = null;
    } else {
      state.strategicEvent = {
        ...state.strategicEvent,
        target,
        start,
        end,
        status: state.strategicEvent.status === 'active' ? 'active' : 'expired'
      };
    }
  }
  const ops = source.planetOps && typeof source.planetOps === 'object' ? source.planetOps : {};
  state.planetOps = {
    storage: PLANETS.map((_, index) => safeNumber(ops.storage?.[index], 0)),
    investment: PLANETS.map((_, index) => safeNumber(ops.investment?.[index], 0)),
    harvests: PLANETS.map((_, index) => Math.floor(safeNumber(ops.harvests?.[index], 0))),
    specializations: PLANETS.map((_, index) =>
      SPECIALIZATION_IDS.includes(ops.specializations?.[index]) ? ops.specializations[index] : null
    )
  };
  if (state.activeEvent !== null && !EVENTS.some(event => event.id === state.activeEvent)) state.activeEvent = null;
  state.meta = window.NebulaCommerce ? window.NebulaCommerce.normalizeMeta(source.meta) : source.meta || {};
  state.meta.managers = normalizeManagerMeta(source.meta?.managers);
  state.meta.guardians.frostbyte = normalizeFrostbyte(source.meta?.guardians?.frostbyte);
  state.meta.guardians.emberbell = normalizeEmberbell(source.meta?.guardians?.emberbell);
  state.meta.guardians.cogsworth = normalizeCogsworth(source.meta?.guardians?.cogsworth);
  state.meta.guardians.petalguard = normalizePetalguard(source.meta?.guardians?.petalguard);
  // Arsenal (schema 33, account-level). A save without one starts its boss record at the highest sector boss already
  // beaten in this run (no flood of retroactive chests); guardian items and planet chests are paid by arsenalSync().
  state.meta.arsenal = normalizeArsenal(source.meta?.arsenal);
  state.meta.combatCat = normalizeCombatCat(source.meta?.combatCat, now); // schema 34: Tikki's Funkengleiter
  state.meta.challenges = normalizeChallenges(source.meta?.challenges, now); // schema 35: Sektorprüfungen
  state.meta.campaign = normalizeCampaign(source.meta?.campaign, state.meta.guardians, now, state.ship); // schema 36: Feldzüge
  state.meta.dna = normalizeDna(source.meta?.dna); // schema 37: Galactic DNA weapons (dna.js)
  state.shipCondition = normalizeShipCondition(source.shipCondition, now); // schema 37: persistent ship damage (arena.js)
  if (!source.meta?.arsenal) state.meta.arsenal.bossRecord = Math.max(0, Math.floor((state.enemyLevel - 1) / 5) * 5);
  state.meta.deepCore = normalizeDeepCoreMeta(source.meta?.deepCore);
  // Interplanetary freight routes (cargo in transit is part of the run; prestige starts without routes).
  state.routes = normalizeRoutes(source.routes, PLANETS.length);
  state.routesCheckedAt = safeNumber(source.routesCheckedAt, now, 0, now);
  // schema 37: supply traders (stock, market saturation, activity log) and Fertigung totals
  state.traders = normalizeTraders(source.traders);
  state.fabStats = normalizeFabStats(source.fabStats);
  state.bazaar = normalizeBazaar(source.bazaar);
  state.meta.bazaarDone = Math.floor(safeNumber(source.meta?.bazaarDone, 0, 0, 1e9));
  state.meta.academy = normalizeAcademy(source.meta?.academy);
  state.meta.milestones = Array.isArray(source.meta?.milestones)
    ? [...new Set(source.meta.milestones.filter(id => typeof id === 'string'))].slice(0, 300)
    : [];
  state.schemaVersion = SCHEMA_VERSION;
  defineColonyView(state);
  return state;
}
// True while offline/background progress is simulated: temporary boosts must not apply to the whole absence.
let offlineMode = false;
const loadedSave = window.NebulaSave.load();
// E-03: a save from a newer build, or one whose structural fields have the wrong type, would be silently reset by
// normalizeState and then overwritten by the next autosave — keep an untouched copy first and tell the player.
const saveIntegrity = (() => {
  if (!loadedSave) return null;
  const isObject = value => value && typeof value === 'object' && !Array.isArray(value),
    wrong = [];
  if (Number(loadedSave.schemaVersion) > SCHEMA_VERSION) wrong.push('schema');
  for (const key of ['colonies', 'planetsUnlocked', 'research', 'inventory', 'routes'])
    if (key in loadedSave && !Array.isArray(loadedSave[key])) wrong.push(key);
  for (const key of ['meta', 'ship', 'planetOps', 'faction'])
    if (key in loadedSave && !isObject(loadedSave[key])) wrong.push(key);
  if (!wrong.length) return null;
  const reason = wrong[0] === 'schema' ? 'newer' : 'structure';
  return { reason, fields: wrong, held: window.NebulaSave.hold?.(loadedSave, reason + ':' + wrong.join(',')) };
})();
let state = normalizeState(loadedSave);
const arsenalBootGrants = arsenalSync(); // one-time arsenal rewards owed to this save (guardians beaten, planets founded, welcome chest)
const $ = id => document.getElementById(id);
// Gameplay → presentation events (engine/core.js). Listeners never modify game state.
const GameEvents = window.IdleEngine ? window.IdleEngine.events : { emit() {}, on() {} };
// Beta 1.4 M0: one cached formatter and one unit table — toLocaleString() built a new formatter on every call and fmt()
// was the single largest cost of render() (30–40 %). Output is identical.
const FMT_UNITS = [
  ['Qa', 1e15],
  ['T', 1e12],
  ['B', 1e9],
  ['M', 1e6],
  ['k', 1e3]
];
const FMT_INT = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
// A value that rounds up to 1000 of its unit moves to the next unit (999.950 → "1,0M", not "1000k"; Beta 1.4).
const fmt = n => {
  const abs = Math.abs(n);
  for (let i = 0; i < FMT_UNITS.length; i++) {
    const [unit, value] = FMT_UNITS[i];
    if (abs < value) continue;
    const text = (n / value).toFixed(abs >= value * 100 ? 0 : 1);
    if (i > 0 && Math.abs(Number(text)) >= 1000) return (n / FMT_UNITS[i - 1][1]).toFixed(1).replace('.', ',') + FMT_UNITS[i - 1][0];
    return text.replace('.', ',') + unit;
  }
  return FMT_INT.format(Math.floor(n));
};
function activePlanet() {
  return PLANETS[state.activePlanet] || PLANETS[0];
}
// E-04: derived values stay finite even for absurd (tampered) levels — cost tops out at 1e300, the milestone
// doubling stops at 2^900 (no legitimate save comes near either).
const cost = b => Math.floor(Math.min(1e300, b.cost * Math.pow(BALANCE.buildingCostGrowth, b.level)));
// Level milestones double a building's output (25, 50, 75, 100, then every 50 levels).
function milestonesReached(level) {
  return Math.min(900, Math.min(4, Math.floor(level / 25)) + Math.max(0, Math.floor((level - 100) / 50)));
}
function buildingMultiplier(level) {
  return Math.pow(2, milestonesReached(level));
}
function nextMilestoneLevel(level) {
  return level < 100 ? (Math.floor(level / 25) + 1) * 25 : (Math.floor((level - 100) / 50) + 1) * 50 + 100;
}
const buildingOutput = b => b.level * b.base * buildingMultiplier(b.level);
function crewActive(index) {
  return state.crewActive.includes(index);
}
function crewRank(index) {
  return crewActive(index) ? state.crew[index].rank : 0;
}
function crewUnlockReady(index) {
  const checks = [
    true,
    state.totalEarned >= 1000,
    state.totalEarned >= 4000,
    state.planetOps.investment.some(value => value >= 1000),
    Boolean(state.research[0]),
    Boolean(state.sectorUnlocked[0]),
    state.alloys >= 6 && Boolean(state.research[3]),
    state.faction.joined !== null && factionRank() >= 1
  ];
  return Boolean(checks[index]);
}
function crewSlotRequirement() {
  const [third, fourth] = BALANCE.crewSlots;
  return state.crewSlots === 2
    ? {
        credits: third.credits,
        alloys: third.alloys,
        ready: state.totalEarned >= third.earned,
        label: '3. Kommandoslot'
      }
    : state.crewSlots === 3
      ? {
          credits: fourth.credits,
          alloys: fourth.alloys,
          ready: state.jumpGate >= fourth.gate,
          label: '4. Kommandoslot'
        }
      : null;
}
function crewRecruitCost(member) {
  return Math.floor(member.cost * (1 - 0.15 * starLevel('academy')));
}
function crewUpgradeCost(member) {
  const rank = member.rank || 1;
  return {
    credits: Math.floor(member.cost * (rank + 1) * 0.7 + 500),
    alloys: rank >= 3 ? rank - 2 : 0,
    crystals: rank >= 4 ? 1 : 0
  };
}
function crewSynergies() {
  const active = (a, b) => crewActive(a) && crewActive(b),
    list = [];
  if (active(0, 6)) list.push('Industrie: +1 weitere Legierung bei aktivem Abbau');
  if (active(4, 5)) list.push('Expansion: -15% Scanzeit und -8% Forschungskosten');
  if (active(3, 2) && pipelineEfficiency() >= 0.9) list.push('Handelsnetz: +8% Marktwert bei effizienter Route');
  if (active(7, 1) && crewRank(7) >= 3 && warActive()) list.push('Grenzflotte: +12% Kampfstärke im Einsatz');
  return list;
}
function scanTimeMultiplier() {
  const rank = crewRank(5),
    explorer = rank ? 1 - (0.1 + (rank - 1) * 0.03) : 1,
    researchBoost = crewRank(4) >= 3 ? 0.9 : 1,
    synergy = crewActive(4) && crewActive(5) ? 0.85 : 1;
  return Math.max(0.55, explorer * researchBoost * synergy);
}
function managerBonus() {
  const rank = crewRank(0);
  return rank ? 1.12 + (rank - 1) * 0.025 : 1;
}
function starBonus() {
  return 1 + state.stars[0] * 0.1;
}
function factionBonus(index) {
  return state.reputation[index] >= 3 ? (state.faction.joined === index ? 1.18 : 1.06) : 1;
}
function reputationCost(index) {
  return Math.floor(600 * (state.reputation[index] + 1) * (crewRank(7) ? 0.8 : 1));
}
function factionRank(index = state.faction.joined) {
  if (index === null || index === undefined) return 0;
  const territories = state.faction.claimed.filter(Boolean).length;
  return territories >= 2 ? 2 : territories >= 1 ? 1 : 0;
}
function factionMilestoneText() {
  const index = state.faction.joined,
    rank = factionRank(index);
  if (index === null) return '';
  const rewards = [
    ['Rang 1: +8% Förderung · Rang 2: +5% Förderung'],
    ['Rang 1: +8% Kampfschaden · Rang 2: +5% Kampfschaden'],
    ['Rang 1: +40 Transport · Rang 2: +20 Transport']
  ];
  return 'FRAKTIONSRANG ' + rank + ' · ' + rewards[index];
}
const TERRITORY_ROLES = [
  ['mining', 'Abbaugebiet', '+7% Förderung · Bergbauwelt: +4%'],
  ['logistics', 'Logistikkorridor', '+20 Transport · Logistikwelt: +12'],
  ['military', 'Militärbastion', '+8% Kampfstärke · Verteidigung: +4%'],
  ['trade', 'Handelsknoten', '+8% Marktwert · Handelswelt: +4%'],
  ['research', 'Forschungszone', '-7% Forschung · Forschungswelt: -3%'],
  ['industrial', 'Industriezone', '+1 Legierung aktiv · Sprungtor: -4%']
];
const TERRITORY_NEIGHBORS = [[1], [0, 2], [1, 3], [2, 4], [3, 5], [4]];
function territoryControl(index, faction = state.faction.joined) {
  return faction === null || faction === undefined ? 0 : state.faction.control[index]?.[faction] || 0;
}
function territoryDominant(index) {
  const values = state.faction.control[index] || [];
  return values.reduce((best, value, current) => (value > values[best] ? current : best), 0);
}
function territoryOwned(index) {
  return state.faction.joined !== null && territoryControl(index) >= 60;
}
function territoryRole(index = state.activePlanet) {
  return TERRITORY_ROLES[index]?.[0] || 'mining';
}
function territoryRoleBonus(role, index = state.activePlanet) {
  if (!territoryOwned(index) || territoryRole(index) !== role) return 1;
  const specialization = planetSpecialization();
  if (role === 'mining') return specialization === 'mining' ? 1.11 : 1.07;
  if (role === 'trade') return specialization === 'trade' ? 1.12 : 1.08;
  if (role === 'research') return specialization === 'research' ? 0.9 : 0.93;
  if (role === 'military') return specialization === 'military' ? 1.12 : 1.08;
  return 1;
}
function connectedTerritories(index = state.activePlanet) {
  return TERRITORY_NEIGHBORS[index].filter(neighbor => territoryOwned(neighbor)).length;
}
function territoryBonus() {
  return territoryOwned(state.activePlanet) ? 1.06 : 0.98;
}
function strategicMultiplier(kind) {
  const effect = state.strategicEffects?.[kind];
  return effect && effect.until > Date.now() && Number.isFinite(effect.multiplier) ? effect.multiplier : 1;
}
function warActive() {
  return state.faction.warTarget === state.activePlanet && Date.now() < state.faction.warUntil;
}
function sectorBonus(kind) {
  return SECTORS.some((sector, index) => sector.bonus === kind && state.sectorUnlocked[index]);
}
function gateBonus(stage) {
  return state.jumpGate >= stage;
}
function specializationCount(kind) {
  return state.planetOps.specializations.filter(value => value === kind).length;
}
function tradeBonus() {
  const rank = crewRank(2),
    tradeCrew = rank ? 1.1 + (rank - 1) * 0.025 : 1,
    synergy = crewActive(3) && rank && pipelineEfficiency() >= 0.9 ? 1.08 : 1,
    routeBonus = territoryRoleBonus('trade') * (connectedTerritories() > 0 ? 1.03 : 1);
  return (
    tradeCrew *
    synergy *
    routeBonus *
    strategicMultiplier('trade') *
    (1 + (state.stars[3] || 0) * 0.1) *
    factionBonus(2) *
    (planetSpecialization() === 'trade' ? 1.15 : 1) *
    (1 + specializationCount('trade') * 0.04) *
    (sectorBonus('trade') ? 1.12 : 1)
  );
}
// Extraction = the colony's shafts (deepcore.js) × these multipliers. Since schema 28 only real mining sources count:
// Kristallmine + Helferhütte (Shaft 1), deeper shafts and the grandfathered legacy power of old saves (K26).
function income() {
  return miningBase() * incomeMultiplier();
}
function incomeMultiplier() {
  return (
    managerBonus() *
    starBonus() *
    activePlanet().income *
    (state.research[0] ? 1.15 : 1) *
    factionBonus(0) *
    territoryBonus() *
    (gateBonus(3) ? 1.1 : 1) *
    (!offlineMode && Date.now() < state.boostUntil ? 2 : 1) *
    (!offlineMode && Date.now() < state.eventBoostUntil ? 1.5 : 1)
  );
}
function planetSpecialization() {
  return state.planetOps.specializations[state.activePlanet];
}
function developmentStage(index = state.activePlanet) {
  if (!state.planetsUnlocked[index]) return 0;
  const investment = state.planetOps.investment[index] || 0;
  return investment >= 20000 ? 5 : investment >= 5000 ? 4 : investment >= 1000 ? 3 : investment >= 160 ? 2 : 1;
}
function extractionRate() {
  return miningBase() * extractionMultiplier();
}
function extractionMultiplier() {
  const rank = factionRank();
  return (
    incomeMultiplier() *
    (planetSpecialization() === 'mining' ? 1.16 : 1) *
    territoryRoleBonus('mining') *
    (state.faction.joined === 0 ? (rank === 2 ? 1.13 : rank === 1 ? 1.08 : 1) : 1) *
    (state.activePlanet === 0 && state.meta?.guardians?.pips?.stage === 'repaired' ? 1.15 : 1) *
    (frostbyteColdShock() ? 0.8 : 1) *
    rootBoost('mine') // Viridia's Wurzelnetz (1 on every other planet)
  );
}
function storageCapacity() {
  const depot = state.buildings[2];
  return (
    (80 + depot.level * 180 * buildingMultiplier(depot.level) + (planetSpecialization() === 'logistics' ? 160 : 0)) *
    (secondaryActive('tofu') ? 1.2 : 1)
  );
}
function transportCapacity(dockLevel = state.buildings[3].level) {
  const rank = factionRank(),
    crew = crewRank(3),
    territory =
      territoryOwned() && territoryRole() === 'logistics' ? 20 + (planetSpecialization() === 'logistics' ? 12 : 0) : 0;
  return (
    (18 +
      dockLevel * 115 * buildingMultiplier(dockLevel) +
      (state.research[3] ? 35 : 0) +
      (planetSpecialization() === 'logistics' ? 28 : 0) +
      specializationCount('logistics') * 12 +
      territory +
      (crew ? 25 + (crew - 1) * 7 : 0) +
      (state.faction.joined === 2 ? (rank === 2 ? 60 : rank === 1 ? 40 : 0) : 0) +
      (sectorBonus('logistics') ? 20 : 0) +
      (gateBonus(1) ? 30 : 0)) *
    strategicMultiplier('transport')
  );
}
function scanFuelCost() {
  return Math.max(1, 3 - (state.research[4] ? 1 : 0));
}
function storageLevel() {
  return Math.min(storageCapacity(), state.planetOps.storage[state.activePlanet] || 0);
}
// Steady automated sales of the colony in context (manual stages contribute nothing by themselves).
function deliveryRate() {
  return automatedIncomeRate();
}
function pipelineEfficiency() {
  return Math.min(1, transportCapacity() / Math.max(1, extractionRate()));
}
function researchCost(tech) {
  const rank = crewRank(4),
    crew = rank ? 1 - (0.08 + (rank - 1) * 0.02) : 1,
    synergy = crewActive(4) && crewActive(5) ? 0.92 : 1;
  return Math.floor(
    tech.cost *
      (planetSpecialization() === 'research' ? 0.85 : 1) *
      Math.pow(0.97, specializationCount('research')) *
      (sectorBonus('research') ? 0.9 : 1) *
      territoryRoleBonus('research') *
      crew *
      synergy *
      strategicMultiplier('research')
  );
}
// All settled colonies produce simultaneously; viewing a planet does not pause the others.
function runProduction(seconds, efficiency = 1) {
  const delivered = forEachColony(() => runColonyProduction(seconds, efficiency));
  processRoutes(Date.now());
  return delivered;
}
// Staged pipeline (industry.js): credits only come from goods that are actually sold.
function runColonyProduction(seconds, efficiency = 1) {
  const delivered = runColonyIndustry(seconds, efficiency);
  // Beta 1.4: Fertigung orders and the world's supply trader advance with the same simulated time
  stepFabrication(state.activePlanet, seconds * efficiency);
  stepTrader(state.activePlanet, seconds);
  return delivered;
}
function tap() {
  const rank = crewRank(0);
  return (
    (10 + state.buildings[0].level * 2) *
    starBonus() *
    activePlanet().tap *
    (state.research[1] ? 1.25 : 1) *
    (rank >= 3 ? 1.1 : 1)
  );
}
function itemPower() {
  return state.inventory.reduce((sum, item) => sum + (item.effect === 'Schaden' ? item.power || 0 : 0), 0);
}
function lootPower() {
  return state.inventory.reduce((sum, item) => sum + (item.effect === 'Beute' ? item.power || 0 : 0), 0);
}
function energyPower() {
  return state.inventory.reduce((sum, item) => sum + (item.effect === 'Energie' ? item.power || 0 : 0), 0);
}
function comboBonus() {
  return 1 + Math.min(state.combo || 0, 10) * (0.02 + arsenalComboStep());
}
function weaponBonus() {
  const foe = campaignFoe() || enemyInfo(), // a running wave: its enemy's weakness
    weapon = state.ship.weaponType;
  return (
    (weapon === 'Plasma' && foe.boss
      ? 1.25
      : weapon === 'Arc'
        ? 1.08
        : weapon === 'Ion'
          ? 1.12
          : weapon === 'Nova' && foe.boss
            ? 1.16
            : 1) * (foe.weakness === weapon ? 1.15 : 1)
  );
}
function attack() {
  // a Tikki strike is resolved through the normal battle routing with its own damage (combat-cat.js)
  if (strikeOverride) return strikeOverride.damage;
  const rank = factionRank(),
    defenseRank = crewRank(1),
    crewDamage = defenseRank ? defenseRank * 2 : 0,
    warCrew = warActive() && defenseRank >= 3 ? 1.1 : 1,
    synergy = crewRank(7) >= 3 && defenseRank && warActive() ? 1.12 : 1;
  return (
    (8 + crewDamage + state.stars[1] * 2 + state.ship.weapon * 3 + state.ship.core * 2 + itemPower()) *
    (state.ship.model === 'Comet'
      ? 1.15
      : state.ship.model === 'Corsair'
        ? 1.1
        : state.ship.model === 'Pioneer'
          ? 1.08
          : 1) *
    (state.ship.model === 'Vanguard' && state.aimReady ? 1.1 : 1) *
    weaponBonus() *
    comboBonus() *
    factionBonus(1) *
    (planetSpecialization() === 'military' ? 1.12 : 1) *
    territoryRoleBonus('military') *
    (state.faction.joined === 1 ? (rank === 2 ? 1.13 : rank === 1 ? 1.08 : 1) : 1) *
    (warActive() && state.faction.joined === 1 ? 1.1 : 1) *
    warCrew *
    synergy *
    (state.aimReady ? 1.65 : 1) *
    (Date.now() < state.overchargeUntil ? 3 : 1) *
    arsenalDamageFactor() *
    activeShotFactor
  );
}
function autoAttack() {
  const rank = crewRank(1);
  return rank ? rank + state.stars[1] : 0;
}
function shipCost(kind) {
  const base = { weapon: 150, hull: 220, core: 4, engine: 280 }[kind];
  return kind === 'core' ? base + state.ship.core * 3 : Math.floor(base * Math.pow(1.75, state.ship[kind]));
}
function expeditionDuration() {
  return Math.max(
    45000,
    (120000 - (state.ship.engine || 0) * 5000) * (state.research[4] ? 0.75 : 1) * (1 - 0.1 * academyRank('expedition'))
  );
}
function enemyInfo() {
  const tier = Math.floor((state.enemyLevel - 1) % 6),
    boss = state.enemyLevel % 5 === 0;
  const types = [
    { name: 'Staub-Pirat', art: '☠', drop: 'Credits, Erz, Modul', weakness: 'Laser' },
    { name: 'Raum-Schleim', art: '◉', drop: 'Kristalle, Erz, Artefakt', weakness: 'Plasma' },
    { name: 'Schrott-Drohne', art: '⚙', drop: 'Credits, Modul, Bauplan', weakness: 'Arc' },
    { name: 'Nebelbestie', art: '♜', drop: 'Kristalle, seltene Ausrüstung', weakness: 'Plasma' },
    { name: 'Quasar-Wespe', art: '✸', drop: 'Energie, Credits, Prisma', weakness: 'Arc' },
    { name: 'Asteroidenkrabbe', art: '🦀', drop: 'Erz, Kristalle, Schildteil', weakness: 'Laser' }
  ];
  return {
    ...types[tier],
    boss,
    name: boss
      ? 'SEKTOR-BOSS: ' + ['Kometenfürst', 'Der Schrottkoloss', 'Nebelhydra'][Math.floor(state.enemyLevel / 5) % 3]
      : types[tier].name
  };
}
function enemyBonus(foe) {
  return (
    {
      'Raum-Schleim': { crystals: 1, fuel: 0 },
      'Schrott-Drohne': { crystals: 0, fuel: 1 },
      Nebelbestie: { crystals: 1, fuel: 0 },
      'Quasar-Wespe': { crystals: 1, fuel: 1 },
      Asteroidenkrabbe: { crystals: 1, fuel: 0 }
    }[foe.name] || { crystals: 0, fuel: 0 }
  );
}
function enemyMaxHp() {
  return (100 + (state.enemyLevel - 1) * 70) * (state.enemyLevel % 5 === 0 ? 3 : 1);
}
function addItem(boss = false) {
  const roll = Math.max(
      0,
      Math.random() -
        (state.ship.hull * 0.02 + lootPower() * 0.005) -
        (state.ship.model === 'Aegis' ? 0.08 : 0) -
        Math.min(0.03, state.itemDiscoveries.length * 0.002) -
        arsenalLootBonus()
    ),
    rarity = boss
      ? roll < 0.05
        ? 'legendary'
        : roll < 0.32
          ? 'epic'
          : 'rare'
      : roll < 0.01
        ? 'legendary'
        : roll < 0.09
          ? 'epic'
          : roll < 0.31
            ? 'rare'
            : 'normal';
  const pools = {
    normal: [
      ['🔩', 'Rohes Modul', 'Schaden'],
      ['🪨', 'Sternen-Erz', 'Beute'],
      ['📡', 'Signalspule', 'Energie']
    ],
    rare: [
      ['🛡', 'Aurora-Schild', 'Beute'],
      ['🔧', 'Plasma-Werkzeug', 'Schaden'],
      ['🔋', 'Energiezelle', 'Energie'],
      ['💠', 'Dunkelglas-Prisma', 'Beute']
    ],
    epic: [
      ['🗡', 'Void-Linse', 'Schaden'],
      ['🧿', 'Nebelkompass', 'Beute'],
      ['⚡', 'Quantum-Akku', 'Energie'],
      ['🪐', 'Orbitallinse', 'Schaden']
    ],
    legendary: [
      ['👑', 'Sonnenkern', 'Schaden'],
      ['🌠', 'Kometenherz', 'Beute'],
      ['☄', 'Singularitätskern', 'Energie'],
      ['🛰', 'Orion-Relikt', 'Schaden']
    ]
  };
  const item = pools[rarity][Math.floor(Math.random() * pools[rarity].length)],
    power = { normal: 1, rare: 2, epic: 4, legendary: 8 }[rarity],
    isNew = !state.itemDiscoveries.includes(item[1]);
  if (isNew) state.itemDiscoveries.push(item[1]);
  state.inventory.unshift({ icon: item[0], name: item[1], effect: item[2], rarity, power });
  // beyond 30 the weakest find becomes Sternsplitter for the arsenal (it used to vanish, even a legendary one)
  const salvaged = arsenalTrimLoot();
  return { rarity, name: item[1], isNew, salvaged };
}
function save() {
  clearTimeout(saveTimer);
  saveTimer = null;
  state.lastSeen = Date.now();
  state.paidUntil = Math.max(state.paidUntil || 0, state.lastSeen);
  return window.NebulaSave.write(state);
}
let saveTimer = null;
// Coalesce frequent state changes into one storage write.
function requestSave(delay = 2000) {
  if (!saveTimer) saveTimer = setTimeout(save, delay);
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) save();
  else gameTick();
});
window.addEventListener('pagehide', () => save());
// Minimal DOM patcher: identical markup is skipped, and changed markup is patched in place so that buttons
// survive re-renders (no lost taps, no flicker) while only text and attributes are updated.
const htmlCache = new WeakMap();
function setHTML(element, html) {
  if (!element || htmlCache.get(element) === html) return;
  htmlCache.set(element, html);
  const template = document.createElement('template');
  template.innerHTML = html;
  patchChildren(element, template.content);
}
function patchChildren(target, source) {
  const next = [...source.childNodes],
    current = [...target.childNodes];
  next.forEach((node, index) => {
    const existing = current[index];
    if (!existing) target.appendChild(node);
    else if (existing.nodeType !== node.nodeType || existing.nodeName !== node.nodeName)
      target.replaceChild(node, existing);
    else if (node.nodeType !== 1) {
      if (existing.nodeValue !== node.nodeValue) existing.nodeValue = node.nodeValue;
    } else patchElement(existing, node);
  });
  for (let index = current.length - 1; index >= next.length; index--) target.removeChild(current[index]);
}
function patchElement(target, source) {
  for (const { name } of [...target.attributes]) if (!source.hasAttribute(name)) target.removeAttribute(name);
  for (const { name, value } of [...source.attributes])
    if (target.getAttribute(name) !== value) target.setAttribute(name, value);
  patchChildren(target, source);
}
const modalStack = [];
function openModal(id) {
  const modal = $(id);
  if (!modal) return;
  feedback('open');
  modal.classList.remove('hidden');
  if (!modalStack.includes(id)) modalStack.push(id);
  modal.querySelector('button:not(.modal-close)')?.focus({ preventScroll: true });
}
function closeModal(id = modalStack[modalStack.length - 1]) {
  if (!id) return false;
  $(id)?.classList.add('hidden');
  const index = modalStack.indexOf(id);
  if (index >= 0) modalStack.splice(index, 1);
  return true;
}
// any dialog open? (the dialogs are static markup; the old selector query scanned the whole page twice per second)
let modalElements = null;
function anyModalOpen() {
  return (modalElements ??= [...document.querySelectorAll('.modal')]).some(m => !m.classList.contains('hidden'));
}
function topModal() {
  for (let i = modalStack.length - 1; i >= 0; i--)
    if (!$(modalStack[i])?.classList.contains('hidden')) return modalStack[i];
  modalStack.length = 0;
  return null;
}
document.addEventListener('click', event => {
  const closer = event.target.closest('[data-close-modal]');
  if (closer) closeModal(closer.dataset.closeModal);
  else if (event.target.classList?.contains('modal') && event.target.id !== 'introModal') closeModal(event.target.id);
});
// Sound + haptic feedback (both optional and controlled in the settings dialog).
function feedback(sound, haptic) {
  window.NebulaAudio?.play(sound);
  if (haptic) window.NebulaPlatform?.haptic(haptic);
}
const DENY_PATTERN =
  /^(Noch |Du brauchst|Nicht genug|Mehr |Erforsche zuerst|Ein Strategiewechsel|Angriff benötigt|Besiege noch|Komm morgen)/;
function toast(message) {
  if (DENY_PATTERN.test(message)) feedback('deny', 'warning');
  const t = $('toast');
  t.textContent = message;
  t.classList.add('visible');
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => t.classList.remove('visible'), 1800);
}
// Kitten portrait for crew cards; falls back to the old icon where canvas is unavailable.
function kittenAvatar(index, icon, active) {
  const accessory = index === 0 ? state.meta?.equipped?.mochi : null,
    url = window.SpaceKittens?.portraitURL(index, active ? 'happy' : 'neutral', 96, accessory ? [accessory] : null);
  return url ? `<img src="${url}" alt="" width="56" height="56" />` : icon;
}
function renderShipPreview() {
  const art = document.querySelector('.ship-art'),
    Art = window.NebulaArt;
  if (!art || !Art?.shipPreviewURL) return;
  const url = Art.shipPreviewURL(
    state.ship.model,
    state.ship,
    Art.SHIP_PALETTES[state.meta?.equipped?.ship] || Art.SHIP_PALETTES.default,
    window.SpaceKittens?.ROSTER[crewActive(1) ? 1 : 0]
  );
  if (url && art.dataset.src !== url) {
    art.dataset.src = url;
    art.innerHTML = `<img src="${url}" alt="Dein Schiff" />`;
  }
}
function renderCrewSystem() {
  renderShipPreview();
  const slotRequirement = crewSlotRequirement(),
    synergies = crewSynergies();
  $('crewSlots').textContent = state.crewActive.length + ' / ' + state.crewSlots;
  $('crewBuildNote').textContent = state.crewActive.length
    ? 'Aktiv: ' + state.crewActive.map(index => state.crew[index].name.split(' ')[0]).join(' · ')
    : 'Wähle Spezialisten passend zu deinem aktuellen Ziel.';
  $('crewSynergy').textContent = synergies.length
    ? 'AKTIVE SYNERGIE · ' + synergies.join(' · ')
    : 'KEINE CREW-SYNERGIE AKTIV · Kombiniere Rollen für Build-Boni.';
  $('crewSlotButton').disabled =
    !slotRequirement ||
    !slotRequirement.ready ||
    state.credits < slotRequirement.credits ||
    state.alloys < slotRequirement.alloys;
  $('crewSlotButton').textContent = !slotRequirement
    ? 'ALLE SLOTS FREIGESCHALTET'
    : slotRequirement.ready
      ? 'SLOT · ' + fmt(slotRequirement.credits) + ' ◈ · ' + slotRequirement.alloys + ' ▰'
      : slotRequirement.label + ' GESPERRT';
  setHTML(
    $('crewList'),
    state.crew
      .map((crew, index) => {
        const active = crewActive(index),
          ready = crewUnlockReady(index),
          upgrade = crewUpgradeCost(crew),
          canUpgrade =
            crew.unlocked &&
            crew.rank < 5 &&
            state.credits >= upgrade.credits &&
            state.alloys >= upgrade.alloys &&
            state.crystals >= upgrade.crystals,
          action = !crew.unlocked
            ? ready
              ? 'REKRUTIEREN · ◈ ' + fmt(crewRecruitCost(crew))
              : 'GESPERRT'
            : active
              ? 'ABBERUFEN'
              : state.crewActive.length < state.crewSlots
                ? 'EINSETZEN'
                : 'SLOTS VOLL',
          disabled =
            (!crew.unlocked && !ready) || (!active && crew.unlocked && state.crewActive.length >= state.crewSlots);
        return `<article class="crew-card ${active ? 'active' : ''} ${crew.unlocked ? '' : 'locked'}"><div class="crew-avatar ${crew.unlocked ? '' : 'locked'}">${kittenAvatar(index, crew.icon, active)}</div><div class="crew-info"><span>${crew.role}${active ? ' · AKTIV' : ''}</span><h3>${crew.name} · RANG ${crew.rank}</h3><p>${crew.primary}</p><small>${crew.secondary}</small><em>${crew.unlocked ? 'Bereit für einen Kommandoslot' : crew.unlock}</em></div><div class="crew-actions"><button class="crew-button ${!disabled ? 'affordable' : ''}" data-crew-action="${index}" ${disabled ? 'disabled' : ''}>${action}</button>${crew.unlocked && crew.rank < 5 ? `<button class="crew-upgrade ${canUpgrade ? 'affordable' : ''}" data-crew-upgrade="${index}" ${canUpgrade ? '' : 'disabled'}>RANG +1 · ◈ ${fmt(upgrade.credits)}${upgrade.alloys ? ' · ▰ ' + upgrade.alloys : ''}${upgrade.crystals ? ' · ◆ ' + upgrade.crystals : ''}</button>` : ''}</div></article>`;
      })
      .join('')
  );
}
const SCREEN_UNLOCKS = { crew: 1500, battle: 1200, trade: 600, prestige: 10000 };
// After the first prestige every screen stays available, so stardust can always be spent.
function screenUnlocked(screen) {
  if (state.galaxiesSold > 0 || !SCREEN_UNLOCKS[screen]) return true;
  // Combat only appears once M.O.T.T.E. machines show up (or for players who already fought before).
  if (screen === 'battle')
    return state.meta?.guardians?.pips?.stage !== 'locked' || state.enemyLevel > 1 || state.bossDefeats > 0;
  return state.totalEarned >= SCREEN_UNLOCKS[screen];
}
// The screens and the tab buttons are static markup (index.html): look them up once instead of running a selector
// query on every render (render() runs every second and after every tap; currentScreen() is asked many times per render).
let screenElements = null,
  navButtonElements = null;
function screenNodes() {
  return (screenElements ??= [...document.querySelectorAll('.screen')]);
}
function navButton(screen) {
  navButtonElements ??= Object.fromEntries([...document.querySelectorAll('.nav-item[data-screen]')].reverse().map(b => [b.dataset.screen, b]));
  return navButtonElements[screen] || null;
}
function currentScreen() {
  return screenNodes().find(x => x.classList.contains('active'))?.id || 'home';
}
function showScreen(screen) {
  if (!$(screen) || !screenUnlocked(screen)) screen = 'home';
  const changed = currentScreen() !== screen;
  document.querySelectorAll('.screen,.nav-item').forEach(x => x.classList.remove('active'));
  $(screen).classList.add('active');
  navButton(screen)?.classList.add('active');
  if (changed) window.scrollTo(0, 0);
}
function renderProgressiveNavigation() {
  Object.keys(SCREEN_UNLOCKS).forEach(screen => {
    const button = navButton(screen);
    if (button) button.classList.toggle('progression-hidden', !screenUnlocked(screen));
  });
  if (!screenUnlocked(currentScreen())) showScreen('home');
}
function render() {
  if (Date.now() - (state.comboAt || 0) > 1200) state.combo = 0;
  if (!state.planetsUnlocked[state.activePlanet]) state.activePlanet = 0;
  renderProgressiveNavigation();
  $('credits').textContent = fmt(state.credits);
  $('gems').textContent = state.gems;
  $('stardust').textContent = state.stardust;
  $('incomeRate').textContent = '+' + fmt(galacticDeliveryRate());
  $('tapValue').textContent = fmt(tap());
  $('ore').textContent = fmt(state.ore);
  $('crystals').textContent = fmt(state.crystals);
  $('fuel').textContent = fmt(state.fuel) + '/' + fmt(fuelTankCapacity());
  const stored = storageLevel(),
    capacity = storageCapacity(),
    transport = transportCapacity(),
    extraction = extractionRate(),
    efficiency = pipelineEfficiency(),
    storageRatio = stored / Math.max(1, capacity),
    bottleneck =
      storageRatio >= 0.92
        ? 'LAGER FAST VOLL'
        : transport < extraction
          ? 'TRANSPORT LIMITIERT'
          : stored > 0
            ? 'LAGER WIRD GELEERT'
            : 'FÖRDERUNG LIMITIERT';
  $('extractRate').textContent = fmt(extraction) + ' Erz/s';
  $('storageValue').textContent = fmt(stored) + ' / ' + fmt(capacity);
  $('transportRate').textContent = fmt(transport) + ' Erz/s';
  $('storageFill').style.width = Math.min(100, storageRatio * 100) + '%';
  $('pipelineStatus').textContent = Math.round(efficiency * 100) + '% · ' + bottleneck;
  $('pipelineStatus').className = storageRatio >= 0.92 || transport < extraction ? 'limited' : 'balanced';
  $('pipelineHint').textContent =
    storageRatio >= 0.92
      ? 'Das Lager ist fast voll – Lagerhaus oder Frachtdock ausbauen.'
      : transport < extraction
        ? 'Die Frachter sind der Engpass – baue das Frachtdock aus.'
        : stored > 0
          ? 'Frachter liefern den Lagerbestand aus.'
          : 'Die Förderung bestimmt deinen nächsten Credits-Schub.';
  const planet = activePlanet(),
    nextPlanet = PLANETS.find((_, index) => !state.planetsUnlocked[index]),
    surveyLeft = Math.max(0, state.surveyEnd - Date.now()),
    scanCost = scanFuelCost(),
    fleetCount = Math.min(6, 1 + Math.floor(state.buildings[3].level / 3));
  $('heroCard').className =
    'hero-card hero-art planet-theme-' + planet.id + ($('heroCard').querySelector('.scene-canvas') ? ' has-scene' : '');
  $('planetType').textContent = planet.type.toUpperCase();
  $('planetName').textContent = planet.name;
  $('planetDescription').textContent = planet.desc;
  $('planetOutput').textContent = fmt(deliveryRate());
  void fleetCount;
  // Short state chip on the scene: the real current bottleneck.
  const sceneStatus =
    storageRatio >= 0.92
      ? ['Lager voll', 'limited']
      : transport < extraction
        ? ['Frachter am Limit', 'limited']
        : extraction <= 0
          ? ['Förderung ruht', 'idle']
          : ['Alles läuft', 'balanced'];
  $('sceneStatus').textContent = sceneStatus[0];
  $('sceneStatus').className = 'scene-status ' + sceneStatus[1];
  $('planetCount').textContent = state.planetsUnlocked.filter(Boolean).length + ' / ' + PLANETS.length;
  setHTML(
    $('planetList'),
    PLANETS.map((item, index) => {
      const unlocked = state.planetsUnlocked[index],
        selected = index === state.activePlanet,
        auto = Math.round((item.income - 1) * 100),
        active = Math.round((item.tap - 1) * 100);
      // Galaxy route: real planet portraits; the next undiscovered world shows the real scan progress.
      const icon = typeof planetIcon === 'function' ? planetIcon(index, 40) : '<span>' + item.icon + '</span>',
        isNext = !unlocked && item === nextPlanet,
        progress = isNext ? Math.min(1, state.totalEarned / Math.max(1, item.unlock)) : 0,
        guide = isNext
          ? `<small class="route-next">${progress >= 1 ? (surveyLeft ? 'Scan läuft …' : 'Bereit zum Scan · ⛽ ' + scanCost) : 'Nächstes Ziel · ' + fmt(state.totalEarned) + ' / ' + fmt(item.unlock) + ' verdiente Credits'}</small><i class="route-progress"><u style="width:${(progress * 100).toFixed(1)}%"></u></i>`
          : '';
      return `<button class="planet-route ${selected ? 'selected' : ''} ${unlocked ? '' : 'locked'} ${isNext ? 'next' : ''}" data-planet="${index}" ${unlocked ? '' : 'disabled'}>${icon}<div><b>${unlocked ? item.name : isNext ? 'Signal: ' + item.type : 'Unentdeckt'}</b><small>${unlocked ? item.type + ' · ' + (auto ? '+' + auto + '% Auto' : 'Standard') + (active ? ' · +' + active + '% aktiv' : '') : isNext ? 'Unbekannte Welt im Scanbereich' : 'Scanne ab ' + fmt(item.unlock) + ' verdienten Credits'}</small>${guide}${unlocked ? colonySummary(index) + planetBadges(index) : ''}</div>${unlocked && !selected ? '<em class="route-go">HINFLIEGEN ›</em>' : selected ? '<em class="route-here">HIER</em>' : ''}</button>`;
    }).join('')
  );
  $('surveyButton').disabled =
    !nextPlanet || !!surveyLeft || state.totalEarned < nextPlanet.unlock || state.fuel < scanCost;
  $('surveyButton').textContent = !nextPlanet
    ? 'ALLE PLANETEN ENTDECKT'
    : surveyLeft
      ? 'SCAN LÄUFT · ' + Math.ceil(surveyLeft / 1000) + 's'
      : state.totalEarned < nextPlanet.unlock
        ? 'SCAN AB ' + fmt(nextPlanet.unlock) + ' CREDITS'
        : 'NÄCHSTEN PLANETEN SCANNEN · ⛽ ' + scanCost;
  const galaxyNames = ['Aurora', 'Vesper', 'Helios', 'Nyx', 'Eclipse', 'Orion'],
    galaxyIndex = state.galaxiesSold % galaxyNames.length;
  $('sector').textContent = galaxyNames[galaxyIndex] + '-' + (state.galaxiesSold + 1);
  $('appShell').style.setProperty(
    '--galaxy-light',
    ['#1b3767', '#5a2d70', '#76511a', '#213563', '#573450', '#165456'][galaxyIndex]
  );
  $('crewLevel').textContent = state.crewActive.length + ' / ' + state.crewSlots;
  $('attackPower').textContent = fmt(attack());
  // Auto-battle fires one regular shot per second while a Fleet Defense commander (Rex) is on duty.
  $('autoDamage').textContent = autoAttack() ? fmt(attack()) + ' / Sek.' : 'Boba einsetzen';
  $('autoBattleButton').classList.toggle('on', state.autoBattle);
  $('overchargeButton').disabled = Date.now() < state.overchargeUntil || state.crystals < 1;
  $('dailyStatus').textContent = Date.now() - state.lastDaily > 86400000 ? 'bereit' : 'morgen';
  const productionRoles = [
    'Mehr Förderstrahlen im Abbau.',
    state.buildings[1].level
      ? 'Koordiniert ' + Math.min(6, 1 + state.buildings[1].level) + ' sichtbare Förderdrohnen.'
      : 'Schaltet sichtbare Förderdrohnen frei.',
    'Vergrößert das Lager (und füttert später die Raffinerie).',
    'Frachter verkaufen zusätzlich zum Stand (Logistik).'
  ];
  setHTML(
    $('productionList'),
    state.buildings
      .map((b, i) => {
        const c = cost(b),
          affordable = state.credits >= c,
          current = buildingOutput(b) * managerBonus() * starBonus(),
          next = buildingOutput({ ...b, level: b.level + 1 }) * managerBonus() * starBonus(),
          gain = (level, per) => level * per * buildingMultiplier(level),
          effect =
            i === 2
              ? 'Lager +' + fmt(gain(b.level + 1, 180) - gain(b.level, 180))
              : i === 3
                ? 'Fracht +' + fmt(gain(b.level + 1, 115) - gain(b.level, 115)) + ' /s'
                : fmt(current) + ' → ' + fmt(next) + ' /s';
        return `<article class="production-card"><div class="building-icon">${b.icon}</div><div class="production-info"><h3>${b.name} <small>Lv. ${b.level}</small></h3><p>${effect} · ${productionRoles[i]}</p><small class="milestone-note">${productionMilestoneNote(b, i)}</small></div><button class="buy-button ${affordable ? 'affordable' : ''}" data-buy="${i}" ${affordable ? '' : 'disabled'}>${affordable ? 'UPGRADE' : 'NOCH ' + fmt(c - state.credits)}<br><small>◈ ${fmt(c)}</small></button></article>`;
      })
      .join('') + (typeof industryProductionCards === 'function' ? industryProductionCards() : '')
  );
  const researchOpen = state.totalEarned >= 1200;
  $('researchPanel').classList.toggle('hidden', !researchOpen);
  if (researchOpen)
    setHTML(
      $('researchList'),
      RESEARCH.map((tech, index) => {
        const available = tech.requires.every(required => state.research[required]);
        return `<article class="research-card ${state.research[index] ? 'complete' : ''} ${available ? '' : 'locked'}"><span>${tech.icon}</span><div><b>${tech.name}</b><small>${available ? tech.effect : 'Benötigt Drohnen-Matrix'}</small></div><button data-research="${index}" ${state.research[index] || !available ? 'disabled' : ''}>${state.research[index] ? 'ERFORSCHT' : available ? '◈ ' + fmt(researchCost(tech)) + (tech.alloyCost ? ' · ▰ ' + tech.alloyCost : '') : 'GESPERRT'}</button></article>`;
      }).join('')
    );
  const event = EVENTS.find(item => item.id === state.activeEvent);
  $('eventCard').classList.toggle('hidden', !event);
  if (event) {
    $('eventIcon').textContent = event.icon;
    $('eventTitle').textContent = event.title;
    $('eventText').textContent = event.text;
    $('eventEffect').textContent = event.effect;
    $('eventAction').textContent = event.action + ' · ' + event.cost;
  }
  const quests = [
    ['Mine ausbauen', 'Verbessere die Kristallmine auf Stufe 3', '100 ◈'],
    ['Die erste Crew', 'Rekrutiere einen Spezialisten', '3 ◆'],
    ['Sektor sichern', 'Besiege einen Piraten', '250 ◈']
  ];
  $('questProgress').textContent = state.quests.filter(Boolean).length + ' / 3';
  setHTML(
    $('questList'),
    quests
      .map(
        (q, i) =>
          `<article class="quest ${state.quests[i] ? 'done' : ''}"><span>${state.quests[i] ? '✓' : i + 1}</span><div><b>${q[0]}</b><small>${q[1]}</small></div><em>${state.quests[i] ? 'ERLEDIGT' : q[2]}</em></article>`
      )
      .join('')
  );
  const events = [
    '↗ <b>Orion-Kristalle</b> sind heute besonders gefragt.',
    '✦ Ein Kometenschauer erhöht die Erz-Funde.',
    '☄ Der Handelsposten meldet ruhige Routen.'
  ];
  setHTML($('marketAlert'), events[Math.floor(Date.now() / 86400000) % events.length]);
  const markets = [
    ['Orion-Kristall', '◆', 20, 1.25],
    ['Mondmilch', '◌', 65, 0.82],
    ['Sternenmetall', '✦', 180, 1.45]
  ];
  setHTML(
    $('tradeList'),
    markets
      .map(
        (m, i) =>
          `<article class="trade-card"><div class="trade-icon">${m[1]}</div><div class="trade-info"><h3>${m[0]}</h3><p class="trade-price">◈ ${fmt(m[2] * m[3] * tradeBonus())} je Einheit · ${m[3] > 1 ? '↗ gefragt' : '↘ ruhig'}</p></div><button class="trade-button" data-trade="${i}">LIEFERN<br><small>10 Einheiten</small></button></article>`
      )
      .join('')
  );
  const factionOpen = state.totalEarned >= 7000;
  $('factionPanel').classList.toggle('hidden', !factionOpen);

  const timeLeft = Math.max(0, state.expeditionEnd - Date.now());
  $('expeditionStatus').textContent = timeLeft
    ? 'RÜCKKEHR IN ' + Math.ceil(timeLeft / 1000) + 's'
    : 'KURZMISSION · ' + Math.ceil(expeditionDuration() / 1000) + ' SEK.';
  renderAdButtons();
  $('expeditionButton').disabled = !!timeLeft;
  $('expeditionButton').textContent = timeLeft ? 'CREW IST UNTERWEGS' : 'EXPEDITION STARTEN · ⛽ 5';
  renderCrewSystem();
  const badges = [
    ['⛏', 'Erster Fund', 'Ernte 10 Erz', state.ore >= 10],
    ['♙', 'Crewgeist', 'Rekrutiere 2 Crew-Mitglieder', state.crew.filter(c => c.unlocked).length >= 2],
    ['⚔', 'Sektorwache', 'Besiege 3 Piraten', state.enemyLevel >= 4],
    ['☄', 'Spurensucher', 'Schließe eine Expedition ab', state.expeditionsComplete >= 1],
    ['✧', 'Neue Ära', 'Verkaufe eine Galaxie', state.galaxiesSold >= 1],
    ['⌁', 'Koloniebauer', 'Erreiche 1.000 Credits / Sek.', income() >= 1000],
    ['♛', 'Bossjäger', 'Besiege einen Sektor-Boss', state.bossDefeats >= 1],
    ['⚡', 'Waffenmeister', 'Schalte eine Spezialwaffe frei', Object.keys(state.ship.weaponTypes).length >= 2],
    ['🪐', 'Weltenbummler', 'Entdecke 2 Planeten', state.planetsUnlocked.filter(Boolean).length >= 2],
    ['☮', 'Diplomat', 'Erreiche eine freundliche Fraktion', state.reputation.some(rep => rep >= 3)]
  ];
  $('achievementCount').textContent = badges.filter(x => x[3]).length + ' / ' + badges.length;
  setHTML(
    $('achievementList'),
    badges
      .map(
        b =>
          `<article class="achievement ${b[3] ? 'unlocked' : ''}"><span>${b[0]}</span><b>${b[1]}</b><small>${b[2]}</small></article>`
      )
      .join('')
  );
  $('inventoryCount').textContent = state.inventory.length + ' / 30';
  setHTML(
    $('itemBonuses'),
    `<span>⚔ +${itemPower()} Schaden</span><span>◈ +${lootPower()} Beute</span><span>⚡ +${energyPower()} Energie</span>`
  );
  $('itemArchive').textContent =
    'ARTEFAKT-ARCHIV · ' + state.itemDiscoveries.length + ' Fundarten entdeckt · bis +3% seltene Beute';
  setHTML(
    $('inventoryList'),
    state.inventory.length
      ? state.inventory
          .map(
            item =>
              `<article class="item-card rarity-${item.rarity}"><span>${item.icon}</span><div><b>${item.name}</b><small>${{ normal: 'Gewöhnlich', rare: 'Selten', epic: 'Episch', legendary: 'Legendär' }[item.rarity]} · +${item.power || 0} ${item.effect || 'Schaden'}</small></div></article>`
          )
          .join('')
      : '<article class="item-card"><span>✦</span><div><b>Inventar leer</b><small>Besiege Gegner für Ausrüstung.</small></div></article>'
  );
  const foe = enemyInfo(),
    maxHp = enemyMaxHp(),
    hp = Math.max(0, Math.ceil(state.enemyHp));
  $('enemyLevel').textContent = state.enemyLevel;
  $('enemyName').textContent = foe.name;
  $('enemyCard').classList.toggle('boss', foe.boss);
  $('enemyCard').classList.toggle('critical', hp / maxHp <= 0.3);
  $('battleReward').textContent = fmt(state.enemyLevel * 100 * (foe.boss ? 3 : 1));
  $('enemyHealth').style.width = Math.max(0, (hp / maxHp) * 100) + '%';
  $('enemyHealthText').textContent = fmt(hp) + ' / ' + fmt(maxHp);
  $('comboText').textContent = state.combo
    ? 'KETTE ×' + state.combo + ' · +' + state.combo * 2 + '% Schaden'
    : 'Kette starten · schnelle Treffer geben bis zu +20% Schaden';
  $('dropPreview').textContent = foe.boss
    ? 'Boss-Beute: +1 Gem, +2 Kristalle, garantiert seltenes Item'
    : 'Möglicher Drop: ' + foe.drop;
  $('shipLevel').textContent = 1 + state.ship.weapon + state.ship.hull + state.ship.core + state.ship.engine;
  $('shipName').childNodes[0].textContent = state.ship.model + ' Mk.';
  $('shipDescription').textContent = {
    Horizon: 'Ausgewogenes Schiff für jede Mission.',
    Comet: '+15% Schaden und 5 Sekunden längerer Overcharge.',
    Aegis: '+8% bessere Item-Chance aus Gegnern.',
    Corsair: '+10% Kampfschaden für schnelle Sektorjagden.',
    Pioneer: '+8% Grundschaden bei Erkundungsmissionen.',
    Vanguard: '+10% Präzisionsschaden im Zielmodus.'
  }[state.ship.model];
  $('workshop').classList.toggle('overcharged', Date.now() < state.overchargeUntil);
  // the model/weapon buttons only exist in the workshop's detail panel (combat-ui.js)
  const workshopDetail = $('workshopDetail') || document;
  workshopDetail.querySelectorAll('[data-model]').forEach(button => button.classList.toggle('active', button.dataset.model === state.ship.model));
  workshopDetail.querySelectorAll('[data-weapon]').forEach(button => button.classList.toggle('active', button.dataset.weapon === state.ship.weaponType));
  $('weaponEffect').textContent = {
    Laser: 'Laser: verlässlicher Basisschaden',
    Plasma: 'Plasma: +25% Schaden gegen Bosse',
    Arc: 'Arc: +8% Schaden in jedem Kampf',
    Ion: 'Ion: +12% Schaden in jedem Kampf',
    Nova: 'Nova: +16% Schaden gegen Bosse'
  }[state.ship.weaponType];
  $('weaponCost').textContent = '◈ ' + fmt(shipCost('weapon'));
  $('hullCost').textContent = '◈ ' + fmt(shipCost('hull'));
  $('coreCost').textContent = '◆ ' + shipCost('core');
  $('engineCost').textContent = '◈ ' + fmt(shipCost('engine'));
  const gain = prestigeGain();
  $('prestigeGain').textContent = gain;
  $('prestigeButton').disabled = gain < 1;
  $('prestigeButton').style.opacity = gain < 1 ? 0.45 : 1;
  $('prestigeAdvice').textContent =
    gain < 1
      ? 'Erreiche 1.000 verdiente Credits. Ein Verkauf setzt Gebäude und lokale Ressourcen zurück.'
      : gain < Math.max(3, state.stardust + spentStardust() * 0.5)
        ? 'Tipp: Ein Verkauf lohnt sich meist erst, wenn der Gewinn deutlich über deinem bisherigen Sternenstaub liegt. Nächster Punkt bei ' +
          fmt(Math.pow(gain + 1, 2) * BALANCE.prestigeDivisor) +
          ' verdienten Credits.'
        : 'Du behältst Gems, Sternenstaub und das Artefakt-Archiv. Gebäude, Credits, Planeten- und Fraktionsfortschritt starten neu.';
  setHTML(
    $('starUpgradeList'),
    STAR_UPGRADES.map((upgrade, index) => {
      const level = state.stars[index] || 0,
        maxed = level >= upgrade.max,
        price = starCost(index),
        affordable = !maxed && state.stardust >= price;
      return `<article class="star-upgrade ${maxed ? 'maxed' : ''}"><span>${upgrade.icon}</span><b>${upgrade.name} · ${level}${upgrade.max < 100 ? '/' + upgrade.max : ''}</b><small>${upgrade.effect}</small><button data-star="${index}" class="${affordable ? 'affordable' : ''}" ${maxed ? 'disabled' : ''}>${maxed ? 'MAX' : '✧ ' + price}</button></article>`;
    }).join('')
  );
  requestSave();
}
const baseRender = render;
render = () => {
  baseRender();
  const foe = enemyInfo(),
    maxHp = enemyMaxHp(),
    phaseTwo = foe.boss && state.enemyHp / maxHp <= 0.5,
    aimLeft = Math.max(0, state.aimCooldownUntil - Date.now());
  $('enemyCard').classList.toggle('aimed', state.aimReady);
  $('enemyCard').classList.toggle('enraged', phaseTwo);
  $('enemyCard').classList.toggle('combo-hot', (state.combo || 0) >= 5);
  $('combatHint').textContent = phaseTwo
    ? 'BOSS-PHASE 2 · Kern ist freigelegt – ZIELMODUS für starken Präzisionstreffer nutzen.'
    : 'SCHWACHSTELLE: ' +
      foe.weakness.toUpperCase() +
      ' · ' +
      (state.ship.weaponType === foe.weakness ? 'TREFFERBONUS +15%' : 'Passende Waffe ausrüsten für +15% Schaden');
  $('aimButton').disabled = state.aimReady || !!aimLeft || state.fuel < 1;
  $('aimButton').classList.toggle('on', state.aimReady);
  if (state.ship.model === 'Vanguard')
    $('shipDescription').textContent = '+10% Präzisionsschaden im Zielmodus. Verdient durch Bossjagd.';
};
const PLANET_HARVEST_BONUS = {
  crystal: '◆ +1 Kristall-Chance',
  ice: '⛽ +1 Treibstoff-Chance',
  volcanic: '⬡ +1 Erz je Ernte',
  machine: '◈ Doppelernte-Chance',
  verdant: '⛽ +1 Treibstoff-Chance',
  forge: '▰ +1 Legierung je Ernte'
};
function planetBadges(index) {
  const owned = territoryOwned(index),
    owner = state.faction.territory[index],
    territory =
      state.faction.joined === null
        ? `<span class="planet-territory foreign">GEBIET: ${FACTIONS[owner]?.name || 'NEUTRAL'} · -2%</span>`
        : owned
          ? '<span class="planet-territory allied">VERBÜNDETES GEBIET · +6%</span>'
          : `<span class="planet-territory foreign">${territoryControl(index)}% EINFLUSS · -2%</span>`;
  return `<span class="planet-bonus">${PLANET_HARVEST_BONUS[PLANETS[index].id] || ''}</span><span class="planet-stage">ENTWICKLUNG · STUFE ${developmentStage(index)}</span>${territory}`;
}
// ----- View models for the canvas scenes (pure reads of the game state) -----
window.NebulaFormat = fmt;
window.NebulaView = {
  harvest() {
    const extraction = extractionRate(),
      transport = transportCapacity(),
      capacity = storageCapacity(),
      stored = storageLevel(),
      delivery = deliveryRate();
    return {
      planetId: activePlanet().id,
      planetIndex: state.activePlanet,
      stage: developmentStage(),
      specialization: planetSpecialization(),
      extraction,
      transport,
      delivery,
      storageRatio: capacity ? stored / capacity : 0,
      transportUtilization: transport ? Math.min(1, delivery / transport) : 0,
      transportBottleneck: transport < extraction * 0.98 && stored / Math.max(1, capacity) > 0.25,
      rigCount: Math.min(6, 1 + Math.floor(state.buildings[0].level / 6)),
      droneCount: state.buildings[1].level ? Math.min(7, 1 + Math.floor(state.buildings[1].level / 4)) : 0,
      freighterCount: Math.min(6, 1 + Math.floor(state.buildings[3].level / 3)),
      boost: Date.now() < state.boostUntil || Date.now() < state.eventBoostUntil,
      gate: state.jumpGate,
      activeEvent: state.activeEvent,
      crew: state.crewActive.slice(),
      cosmeticRing: state.meta?.equipped?.ring || null,
      cosmeticTrail: state.meta?.equipped?.trail || null
    };
  },
  combat() {
    const foe = enemyInfo(),
      max = enemyMaxHp();
    return {
      enemyLevel: state.enemyLevel,
      enemyHp: Math.max(0, state.enemyHp),
      enemyMax: max,
      enemyType: Math.floor((state.enemyLevel - 1) % 6),
      boss: foe.boss,
      bossIndex: Math.floor(state.enemyLevel / 5) % 3,
      phaseTwo: foe.boss && state.enemyHp / max <= 0.5,
      weakness: foe.weakness,
      ship: { ...state.ship },
      aimReady: state.aimReady,
      overcharge: Date.now() < state.overchargeUntil,
      combo: state.combo || 0,
      autoBattle: Boolean(state.autoBattle && autoAttack()),
      pilot: crewActive(1) ? 1 : 0,
      cosmeticShip: state.meta?.equipped?.ship || null
    };
  }
};
function earn(amount) {
  state.credits += amount;
  state.totalEarned += amount;
}
// One manual harvest roll (critical, ore, alloys, planet loot) without placing the material anywhere. The surface
// tap uses it directly; with the mine open it runs once per manual work cycle of Shaft 1 (deepcore.js).
function harvestRoll() {
  const critical = Math.random() < 0.08 + (state.research[2] ? 0.06 : 0) + (pipsFriendly() ? 0.03 : 0),
    base = tap() * (critical ? 3 : 1),
    engineering = crewRank(6),
    alloys = engineering ? (crewActive(0) ? 2 : 1) : 0;
  state.ore += critical ? 3 : 1;
  state.alloys += alloys;
  state.planetOps.harvests[state.activePlanet]++;
  const loot = planetHarvestBonus(base);
  return { gain: base * (loot === MACHINE_DOUBLE ? 2 : 1), critical, alloys, loot };
}
function collect() {
  if (undergroundOpen()) {
    // The mine is open: Shaft 1 is underground now. A tap sends a kitten on a real work cycle there (no second path
    // straight onto the pile).
    const queued = manualShaft('mine');
    if (!queued) {
      feedback('deny', 'light');
      toast('Die Kätzchen in Schacht 1 haben schon ' + HAND.queue + ' Aufträge.');
      return;
    }
    GameEvents.emit('harvest', { material: 0, credits: 0, queued, underground: true, planetId: activePlanet().id });
    feedback('collect', 'light');
    render();
    return;
  }
  if (colonyAt().stock.pile >= pileCapacity() - 0.5) {
    GameEvents.emit('harvest', { material: 0, credits: 0, full: true, planetId: activePlanet().id });
    feedback('deny', 'light');
    toast('Die Halde ist voll – schick die Lore zum Lager!');
    return;
  }
  const roll = harvestRoll(),
    critical = roll.critical,
    alloyGain = roll.alloys,
    planetLoot = roll.loot,
    material = addToPile(roll.gain);
  GameEvents.emit('harvest', {
    material,
    credits: 0,
    critical,
    alloys: alloyGain,
    planetId: activePlanet().id
  });
  render();
  feedback(critical ? 'crit' : 'collect', critical ? 'medium' : 'light');
  // Plain taps already show a floating number; only notable results get a toast.
  if (critical || alloyGain || planetLoot)
    toast(
      (critical ? 'Kritischer Abbau! 3× Material.' : '+' + fmt(material) + ' Rohkristalle') +
        (alloyGain ? ' · +' + alloyGain + ' Legierung' : '') +
        planetLoot
    );
}
const MACHINE_DOUBLE = ' · Fabriknetz verdoppelt den Abbau!';
// Manual stage actions (always possible; managers make them automatic).
function sendCart() {
  const moved = manualTransport();
  if (moved <= 0) {
    feedback('deny', 'light');
    toast(
      colonyAt().trip
        ? 'Die Lore ist noch unterwegs.'
        : colonyAt().stock.pile <= 0
          ? 'Die Halde ist leer – erst abbauen.'
          : 'Das Lager ist voll – erst verkaufen.'
    );
    return 0;
  }
  GameEvents.emit('transport', { amount: moved, manual: true, planet: state.activePlanet });
  feedback('collect', 'light');
  render();
  return moved;
}
function sellGoods(workplace = 'stall') {
  if (workplace === 'dock' && !workplaceExists('dock')) return 0;
  const sale = manualSale(workplace);
  if (sale.units <= 0) {
    feedback('deny', 'light');
    toast('Im Lager liegt nichts zum Verkaufen.');
    return 0;
  }
  GameEvents.emit('sale', { credits: sale.credits, amount: sale.units, manual: true, workplace, planet: state.activePlanet });
  addFlow(sale.units, 1);
  feedback('reward', 'light');
  render();
  return sale.credits;
}
// K71 (beta 1) — "Mochi hilft": until the first chain on Orion is fully automated (milestone 'first-chain', first run
// only), Mochi does one missing manual step — move the cart or sell — when the player has not touched the screen for
// MOCHI_HELP_SECONDS, at most once per MOCHI_HELP_SECONDS. A player who never taps the dock is no longer stuck (a
// hire-only start stayed at 20 Credits forever); tapping yourself stays far faster. Online only, no new state.
const MOCHI_HELP_SECONDS = 8;
let mochiHelpEnabled = true; // tests of the manager rules switch it off to look at one stage in isolation
let lastPlayerInputAt = Date.now(),
  mochiHelpAt = 0,
  mochiHelpToastShown = false;
document.addEventListener('pointerdown', () => (lastPlayerInputAt = Date.now()), { capture: true, passive: true });
document.addEventListener('keydown', () => (lastPlayerInputAt = Date.now()), { capture: true, passive: true });
function mochiHelp(now = Date.now()) {
  // only for a player who chose to idle (the mining manager is hired) — without any manager nothing runs by itself
  if (!mochiHelpEnabled || state.galaxiesSold > 0 || state.activePlanet !== 0 || state.meta.milestones.includes('first-chain') || !isAutomated('mine', 0)) return null;
  if (!state.introSeen || offlineMode || now - lastPlayerInputAt < MOCHI_HELP_SECONDS * 1000 || now - mochiHelpAt < MOCHI_HELP_SECONDS * 1000) return null;
  const auto = colonyAutomation(),
    colony = colonyAt();
  let step = null;
  if (!auto.stall && !auto.dock && (state.planetOps.storage[0] || 0) >= 1) {
    const sale = manualSale('stall');
    if (sale.units > 0) {
      step = 'stall';
      GameEvents.emit('sale', { credits: sale.credits, amount: sale.units, manual: true, helper: true, workplace: 'stall', planet: 0 });
      addFlow(sale.units, 1);
    }
  }
  if (!step && !auto.rail && colony.stock.pile >= 1 && !colony.trip) {
    const moved = manualTransport();
    if (moved > 0) {
      step = 'rail';
      GameEvents.emit('transport', { amount: moved, manual: true, helper: true, planet: 0 });
    }
  }
  if (!step) return null;
  mochiHelpAt = now;
  if (!mochiHelpToastShown) {
    mochiHelpToastShown = true;
    toast('Mochi hilft beim Tragen und Verkaufen – selbst tippen geht viel schneller!');
  }
  render();
  return step;
}
function feedRefinery() {
  const fed = manualFeed();
  if (fed <= 0) return toast('Kein Rohmaterial im Lager oder Trichter voll.');
  GameEvents.emit('feed', { amount: fed, manual: true });
  render();
}
function refineNow() {
  const used = manualRefine();
  if (used <= 0) return toast('Der Trichter ist leer – erst beschicken.');
  GameEvents.emit('refine', { amount: used, bars: used / BAR_RAW, manual: true });
  feedback('upgrade', 'light');
  render();
}
function showPlanetDiscovery(planet) {
  window.NebulaAudio?.play('meow');
  GameEvents.emit('planet', { index: PLANETS.indexOf(planet), discovered: true });
  seasonXp('planet');
  feedback('unlock', 'success');
  const hero = $('heroCard'),
    discovery = document.createElement('div');
  discovery.className = 'planet-discovery';
  discovery.innerHTML = `<i>${planet.icon}</i><b>NEUE WELT ENTDECKT</b><strong>${planet.name}</strong><small>${planet.type} · Kolonie freigegeben</small>`;
  hero.append(discovery);
  hero.classList.add('discovering');
  setTimeout(() => {
    discovery.remove();
    hero.classList.remove('discovering');
  }, 2800);
}
function showPlanetFocus(planet) {
  const hero = $('heroCard'),
    focus = document.createElement('div');
  focus.className = 'planet-focus';
  focus.innerHTML = `<i>${planet.icon}</i><b>${planet.name}</b><small>Abbauziel aktiv</small>`;
  hero.append(focus);
  hero.classList.remove('planet-focused');
  void hero.offsetWidth;
  hero.classList.add('planet-focused');
  setTimeout(() => {
    focus.remove();
    hero.classList.remove('planet-focused');
  }, 1000);
}
function showProductionUpgrade(building) {
  feedback('upgrade', 'light');
  const hero = $('heroCard'),
    pulse = document.createElement('div');
  pulse.className = 'upgrade-pulse';
  pulse.innerHTML = `<i>${building.icon}</i><b>${building.name.toUpperCase()} LV. ${building.level}</b><small>Produktion verstärkt</small>`;
  hero.append(pulse);
  hero.classList.remove('upgraded');
  void hero.offsetWidth;
  hero.classList.add('upgraded');
  setTimeout(() => {
    pulse.remove();
    hero.classList.remove('upgraded');
  }, 1050);
}
function showPlanetMilestone(icon, title, text) {
  feedback('unlock', 'success');
  const hero = $('heroCard'),
    notice = document.createElement('div');
  notice.className = 'planet-milestone';
  notice.innerHTML = `<i>${icon}</i><div><b>${title}</b><small>${text}</small></div>`;
  hero.append(notice);
  hero.classList.add('milestone-active');
  setTimeout(() => {
    notice.remove();
    hero.classList.remove('milestone-active');
  }, 2300);
}
function renderObjective() {
  if (renderStoryObjective()) return;
  renderObjectiveBase();
}
function renderObjectiveBase() {
  const nextPlanet = PLANETS.find((_, index) => !state.planetsUnlocked[index]),
    storageRatio = storageLevel() / Math.max(1, storageCapacity()),
    objective =
      state.buildings[0].level < 3
        ? ['⛏', 'Mine ausbauen', 'Tippe auf die Kristallmine und verbessere sie auf Stufe 3.', 'KOLONIE ›', 'home']
        : transportCapacity() < extractionRate() && storageRatio > 0.25
          ? [
              '◫',
              'Transportengpass lösen',
              'Das Lager füllt sich. Das Frachtdock bringt mehr Frachter.',
              'HAFEN ›',
              'home'
            ]
          : developmentStage() < 2
            ? [
                '⌂',
                'Förderbasis ausbauen',
                'Investiere noch ' +
                  fmt(Math.max(0, 160 - (state.planetOps.investment[state.activePlanet] || 0))) +
                  ' Credits für die erste Planetenspezialisierung.',
                'AUSBAU ›',
                'home'
              ]
            : !planetSpecialization()
              ? [
                  '✧',
                  'Planetenrolle wählen',
                  'Spezialisiere diese Welt auf Bergbau, Logistik, Forschung, Handel oder Verteidigung.',
                  'PLANEN ›',
                  'home'
                ]
              : !state.crew[1].unlocked
                ? [
                    '♙',
                    'Neue Kommandantin rekrutieren',
                    'Boba verstärkt Kampf und automatische Verteidigung.',
                    'CREW ›',
                    'crew'
                  ]
                : nextPlanet
                  ? [
                      '🪐',
                      nextPlanet.name + ' entdecken',
                      'Erreiche ' + fmt(nextPlanet.unlock) + ' verdiente Credits und starte den Scan.',
                      'SCANNEN ›',
                      'home'
                    ]
                  : state.crewActive.length < state.crewSlots
                    ? [
                        '♙',
                        'Build zusammenstellen',
                        'Aktiviere eine zweite Crewrolle für dein aktuelles Ziel.',
                        'CREW ›',
                        'crew'
                      ]
                    : state.bossDefeats < 1
                      ? [
                          '⚔',
                          'Ersten Sektor-Boss besiegen',
                          'Sichere seltene Beute und neue Schiffsrouten.',
                          'KAMPF ›',
                          'battle'
                        ]
                      : [
                          '✧',
                          'Nächste Galaxie vorbereiten',
                          'Sammle Sternenstaub für permanente Vorteile.',
                          'SPRUNG ›',
                          'prestige'
                        ];
  $('objectiveIcon').textContent = objective[0];
  $('objectiveTitle').textContent = objective[1];
  $('objectiveText').textContent = objective[2];
  $('objectiveAction').textContent = objective[3];
  $('objectiveCard').dataset.screen = objective[4];
}
function renderPlanetDevelopment() {
  const layer = $('planetDevelopment'),
    stage = developmentStage(),
    specialization = planetSpecialization() || 'general',
    key = state.activePlanet + ':' + stage + ':' + specialization;
  if (layer.dataset.key === key) return;
  layer.dataset.key = key;
  layer.className = 'planet-development stage-' + stage + ' ' + specialization;
  layer.innerHTML = `${stage >= 2 ? '<i class="dev-satellite"></i>' : ''}${stage >= 3 ? '<i class="dev-orbital"><b></b></i>' : ''}${stage >= 4 ? '<i class="dev-city"></i>' : ''}${stage >= 5 ? '<i class="dev-complex"><b></b></i>' : ''}`;
}
function renderPipelineVisual() {
  const depot = $('storageDepot'),
    traffic = $('spaceTraffic'),
    fill = Math.min(4, Math.ceil((storageLevel() / Math.max(1, storageCapacity())) * 4)),
    congested = fill >= 3,
    key = state.activePlanet + ':' + fill + ':' + Math.min(5, 1 + state.buildings[3].level);
  depot.classList.toggle('congested', congested);
  traffic.classList.toggle('congested', congested);
  traffic.classList.toggle('idle-capacity', !congested && transportCapacity() > extractionRate() * 1.25);
  if (depot.dataset.key !== key) {
    depot.dataset.key = key;
    depot.innerHTML = Array.from(
      { length: fill },
      (_, index) =>
        `<i style="--crate:${index};left:${(index % 2) * 11 + 8}px;bottom:${Math.floor(index / 2) * 8 + 7}px"></i>`
    ).join('');
  }
  renderPlanetDevelopment();
}
function renderPlanetCommand() {
  const stage = developmentStage(),
    titles = [
      'Unentdeckt',
      'Kleine Abbaustation',
      'Etablierte Förderbasis',
      'Industrielle Kolonie',
      'Produktionszentrum',
      'Planetarer Komplex'
    ],
    specializations = [
      ['mining', '⛏', 'Bergbau', '+16% Förderung'],
      ['logistics', '◫', 'Logistik', '+160 Lager · +28 Transport'],
      ['research', '⌁', 'Forschung', '-15% Forschungskosten'],
      ['trade', '⇄', 'Handel', '+15% Handelswert'],
      ['military', '⚔', 'Verteidigung', '+12% Kampfschaden']
    ],
    selected = planetSpecialization();
  $('developmentTitle').textContent = titles[stage];
  $('developmentStage').textContent = 'STUFE ' + stage;
  $('developmentText').textContent =
    stage < 2
      ? 'Investiere noch ' +
        fmt(Math.max(0, 160 - (state.planetOps.investment[state.activePlanet] || 0))) +
        ' Credits in lokale Gebäude für Stufe 2 und eine Spezialisierung.'
      : 'Eine Spezialisierung formt die Rolle dieses Planeten. Die erste Wahl ist kostenlos; Wechsel kosten 1 Kristall.';
  $('specializationList').classList.toggle('hidden', stage < 2);
  setHTML(
    $('specializationList'),
    specializations
      .map(
        ([id, icon, name, effect]) =>
          `<button class="specialization ${selected === id ? 'active' : ''}" data-specialization="${id}"><span>${icon}</span><div><b>${name}</b><small>${effect}</small></div></button>`
      )
      .join('')
  );
}
function productionMilestoneNote(building, index) {
  const milestone = nextMilestoneLevel(building.level),
    current = buildingMultiplier(building.level);
  return (
    'Meilenstein Lv. ' +
    milestone +
    ': Leistung ×2' +
    (current > 1 ? ' (aktuell ×' + current + ')' : '') +
    ' · ' +
    productionVisualNote(building, index)
  );
}
function productionVisualNote(building, index) {
  return index === 0
    ? 'Lv. ' + Math.ceil((building.level + 1) / 3) * 3 + ': zusätzlicher Förderstrahl.'
    : index === 1
      ? 'Jede Stufe: +1 sichtbare Förderdrohne.'
      : index === 2
        ? 'Vergrößert das Lager.'
        : 'Mehr Frachter und Transport.';
}
// Wrapped by the guardian chapters (frostbyte.js, pyra-ui.js, cogsworth-ui.js): true while the planet in view has an
// open story objective of its own.
let planetStoryGoalActive = () => false;
function renderSectorObjective() {
  const first = SECTORS[0],
    scanning = state.sectorScanTarget !== null,
    expedition = state.sectorExpedition;
  if (state.totalEarned < first.unlock || state.sectorUnlocked[0]) return;
  // a guardian chapter of the planet in view keeps its own objective (Glacies / Pyra / Mekhanos story steps)
  if (planetStoryGoalActive()) return;
  if (scanning) {
    $('objectiveIcon').textContent = '⌁';
    $('objectiveTitle').textContent = 'Sektorprofil auswerten';
    $('objectiveText').textContent = 'Der Scan eröffnet einen neuen Handelsweg nach Vesper.';
    $('objectiveAction').textContent = 'KARTE ›';
    $('objectiveCard').dataset.screen = 'trade';
    return;
  }
  if (expedition) {
    $('objectiveIcon').textContent = '☄';
    $('objectiveTitle').textContent = 'Expedition begleiten';
    $('objectiveText').textContent = 'Die Vesper-Route wird nach Rückkehr dauerhaft nutzbar.';
    $('objectiveAction').textContent = 'KARTE ›';
    $('objectiveCard').dataset.screen = 'trade';
    return;
  }
  if (state.sectorScans[0] < first.scans) {
    $('objectiveIcon').textContent = '⌁';
    $('objectiveTitle').textContent = 'Vesper-Drift kartieren';
    $('objectiveText').textContent =
      'Erzeuge ' +
      (first.scans - state.sectorScans[0]) +
      ' weitere Scanprofile für eine sichere oder riskante Expedition.';
    $('objectiveAction').textContent = 'SCANNEN ›';
    $('objectiveCard').dataset.screen = 'trade';
  }
}
function renderProgressionContent() {
  const nextPlanet = PLANETS.find((_, index) => !state.planetsUnlocked[index]),
    surveyLeft = Math.max(0, state.surveyEnd - Date.now()),
    scanCost = scanFuelCost(),
    survey = $('surveyButton');
  $('alloys').textContent = fmt(state.alloys);
  if (nextPlanet) {
    survey.disabled = !!surveyLeft || state.totalEarned < nextPlanet.unlock || state.fuel < scanCost;
    survey.textContent = surveyLeft
      ? 'SCAN LÄUFT · ' + Math.ceil(surveyLeft / 1000) + 's'
      : state.totalEarned < nextPlanet.unlock
        ? 'SCAN AB ' + fmt(nextPlanet.unlock) + ' CREDITS'
        : 'NÄCHSTEN PLANETEN SCANNEN · ⛽ ' + scanCost;
  }
  renderSectorObjective();
}
function gateRequirement() {
  const phase = state.jumpGate,
    engineering = crewRank(6) >= 3 ? 0.92 : 1,
    requirements = [
      { ...BALANCE.gate[0], label: 'TORRAHMEN · +30 Transport', ready: state.research[3] },
      {
        ...BALANCE.gate[1],
        label: 'STABILISATOR · Scans 25% schneller',
        ready:
          state.sectorUnlocked.some(Boolean) && state.planetOps.investment.filter(value => value >= 1000).length >= 2
      },
      {
        ...BALANCE.gate[2],
        label: 'SPRUNGKERN · +10% Gesamtproduktion',
        ready: state.sectorUnlocked.every(Boolean) && state.research[4]
      }
    ];
  const requirement = requirements[phase];
  return requirement
    ? {
        ...requirement,
        credits: Math.floor(requirement.credits * engineering),
        ore: Math.floor(requirement.ore * engineering),
        alloys: Math.floor(requirement.alloys * engineering)
      }
    : null;
}
function contractCatalog() {
  return [
    {
      id: 'route-1',
      chain: 'Routenprotokoll',
      title: 'Frachtkorridor kalibrieren',
      text: 'Erreiche 130 Transportkapazität und erstelle ein Vesper-Scanprofil.',
      ready: transportCapacity() >= 130 && state.sectorScans[0] >= 1,
      reward: '+4 Treibstoff'
    },
    {
      id: 'route-2',
      chain: 'Routenprotokoll',
      title: 'Riskante Erstfahrt',
      text: 'Schließe eine risikoreiche Expedition zur Vesper-Drift ab.',
      ready: state.contracts.riskyExpeditions >= 1 && state.sectorUnlocked[0],
      reward: '+3 Legierungen'
    },
    {
      id: 'industry-1',
      chain: 'Industrieverbund',
      title: 'Produktionsrollen verbinden',
      text: 'Entwickle eine Welt auf Stufe 3 sowie je einen Bergbau- und Forschungsplaneten.',
      ready:
        state.planetOps.investment.some(value => value >= 1000) &&
        specializationCount('mining') >= 1 &&
        specializationCount('research') >= 1,
      reward: '+4 Legierungen'
    },
    {
      id: 'industry-2',
      chain: 'Industrieverbund',
      title: 'Resonanz-Labor beliefern',
      text: 'Halte 10 Legierungen bereit und erforsche die Drohnen-Matrix.',
      ready: state.alloys >= 10 && state.research[0],
      reward: '+8.000 Credits · 60s Produktionsboost'
    },
    {
      id: 'explore-1',
      chain: 'Kartografenpakt',
      title: 'Meridian anpeilen',
      text: 'Erstelle ein Scanprofil des Eisenmeridians und sichere die Vesper-Route.',
      ready: state.sectorScans[1] >= 1 && state.sectorUnlocked[0],
      reward: '+3 Kristalle'
    },
    {
      id: 'explore-2',
      chain: 'Kartografenpakt',
      title: 'Schrottgürtel sichern',
      text: 'Sichere den Eisenmeridian mit einer Expedition.',
      ready: state.sectorUnlocked[1],
      reward: '+5 Legierungen'
    },
    {
      id: 'faction-1',
      chain: 'Grenzvertrag',
      title: 'Verbündete Grenzen',
      text: 'Tritt einer Fraktion bei und erreiche Fraktionsrang 1 durch ein gesichertes Gebiet.',
      ready: state.faction.joined !== null && factionRank() >= 1,
      reward: '+2 Gems'
    },
    {
      id: 'faction-2',
      chain: 'Grenzvertrag',
      title: 'Torversorgung',
      text: 'Schließe die erste Sprungtor-Bauphase als Fraktionsmitglied ab.',
      ready: state.faction.joined !== null && state.jumpGate >= 1,
      reward: '+10.000 Credits · +4 Treibstoff'
    }
  ];
}
function activeContractChain() {
  const contracts = contractCatalog(),
    chains = ['Routenprotokoll', 'Industrieverbund', 'Kartografenpakt', 'Grenzvertrag'];
  return (
    chains.find(chain =>
      contracts.some(contract => contract.chain === chain && !state.contracts.claimed[contract.id])
    ) || chains[chains.length - 1]
  );
}
function claimContract(id) {
  const contract = contractCatalog().find(item => item.id === id);
  if (!contract || !contract.ready || state.contracts.claimed[id]) return;
  state.contracts.claimed[id] = true;
  seasonXp('contract');
  if (id === 'route-1') state.fuel += 4;
  if (id === 'route-2') state.alloys += 3;
  if (id === 'industry-1') state.alloys += 4;
  if (id === 'industry-2') {
    earn(8000);
    state.boostUntil = Date.now() + 60000;
  }
  if (id === 'explore-1') state.crystals += 3;
  if (id === 'explore-2') state.alloys += 5;
  if (id === 'faction-1') state.gems += 2;
  if (id === 'faction-2') {
    earn(10000);
    state.fuel += 4;
  }
  render();
  showPlanetMilestone('✦', 'AUFTRAG ABGESCHLOSSEN', contract.reward);
  toast(contract.title + ': ' + contract.reward);
}
function renderContracts() {
  const open = state.totalEarned >= 15000,
    panel = $('contractPanel');
  panel.classList.toggle('hidden', !open);
  if (!open) return;
  const chain = activeContractChain(),
    contracts = contractCatalog().filter(contract => contract.chain === chain),
    done = contracts.filter(contract => state.contracts.claimed[contract.id]).length;
  $('contractChainTitle').textContent = chain;
  $('contractProgress').textContent = done + ' / ' + contracts.length;
  $('contractChainText').textContent = {
    Routenprotokoll: 'Baue Kapazität auf und wage die erste entfernte Route.',
    Industrieverbund: 'Kombiniere Planetenspezialisierungen für Forschung und Legierungen.',
    Kartografenpakt: 'Erweitere das Netz über aufeinanderfolgende Sektorentdeckungen.',
    Grenzvertrag: 'Verbinde territoriale Stärke mit dem Bau des Sprungtors.'
  }[chain];
  setHTML(
    $('contractList'),
    contracts
      .map(
        (contract, index) =>
          `<article class="contract-card ${state.contracts.claimed[contract.id] ? 'done' : ''}"><span>${state.contracts.claimed[contract.id] ? '✓' : index + 1}</span><div><b>${contract.title}</b><small>${contract.text}</small><em>${contract.reward}</em></div><button data-contract="${contract.id}" ${!contract.ready || state.contracts.claimed[contract.id] ? 'disabled' : ''}>${state.contracts.claimed[contract.id] ? 'ERLEDIGT' : contract.ready ? 'EINLÖSEN' : 'IN ARBEIT'}</button></article>`
      )
      .join('')
  );
  const network = [
    specializationCount('logistics') ? 'Logistik: +' + specializationCount('logistics') * 12 + ' Transport' : '',
    specializationCount('trade') ? 'Handel: +' + specializationCount('trade') * 4 + '% Marktwert' : '',
    specializationCount('research') ? 'Forschung: -' + specializationCount('research') * 3 + '% Laborkosten' : ''
  ].filter(Boolean);
  $('synergyNote').textContent = network.length
    ? 'PLANETENNETZWERK · ' + network.join(' · ')
    : 'PLANETENNETZWERK · Unterschiedliche Spezialisierungen erzeugen kombinierte Boni.';
}
function renderCrewSignals() {
  const scene = $('heroCard'),
    key = state.crewActive.join(':');
  let signals = scene.querySelector('.crew-scene-signals');
  if (!signals) {
    signals = document.createElement('div');
    signals.className = 'crew-scene-signals';
    scene.append(signals);
  }
  if (signals.dataset.key === key) return;
  signals.dataset.key = key;
  signals.innerHTML = state.crewActive
    .filter(index => [1, 3, 4, 5, 6].includes(index))
    .map(index => `<i class="crew-signal signal-${index}"><b>${state.crew[index].icon}</b></i>`)
    .join('');
}
function renderSectorVisual() {
  const layer = $('sectorVisual'),
    scanIndex = state.sectorScanTarget,
    mission = state.sectorExpedition,
    scan = scanIndex === null ? '' : SECTORS[scanIndex]?.icon || '',
    missionIcon = mission ? SECTORS[mission.target]?.icon || '✦' : '',
    key = scan + ':' + missionIcon + ':' + state.jumpGate;
  if (layer.dataset.key === key) return;
  layer.dataset.key = key;
  layer.className = 'sector-visual gate-stage-' + state.jumpGate;
  layer.innerHTML = `${scan ? `<i class="scan-wave"><b>${scan}</b></i>` : ''}${missionIcon ? `<i class="expedition-ship"><b>${missionIcon}</b><em></em></i>` : ''}${state.jumpGate ? `<i class="jump-gate gate-${state.jumpGate}"><b></b><em></em></i>` : ''}`;
}
function renderSectorSystem() {
  const open = state.totalEarned >= 15000,
    panel = $('sectorPanel'),
    gate = $('gateCard');
  panel.classList.toggle('hidden', !open);
  gate.classList.toggle('hidden', !open);
  if (!open) return;
  const activeScan = state.sectorScanTarget,
    scanLeft = Math.max(0, state.sectorScanEnd - Date.now()),
    expedition = state.sectorExpedition;
  $('sectorProgress').textContent = state.sectorUnlocked.filter(Boolean).length + ' / ' + SECTORS.length;
  setHTML(
    $('sectorList'),
    SECTORS.map((sector, index) => {
      const scans = state.sectorScans[index],
        known = state.sectorUnlocked[index],
        locked = state.totalEarned < sector.unlock,
        scanning = activeScan === index && scanLeft,
        expediting = expedition?.target === index,
        scanReady = scans >= sector.scans,
        scanButton = locked
          ? `<button disabled>AB ${fmt(sector.unlock)} ◈</button>`
          : scanning
            ? `<button disabled>SCAN · ${Math.ceil(scanLeft / 1000)}s</button>`
            : !scanReady
              ? `<button data-sector-scan="${index}">SCAN ${scans}/${sector.scans} · ⛽ ${sector.scanFuel}</button>`
              : expediting
                ? `<button disabled>EXPEDITION · ${Math.ceil((expedition.end - Date.now()) / 1000)}s</button>`
                : known
                  ? '<button disabled>GESICHERT</button>'
                  : `<div class="sector-actions"><button data-sector-expedition="${index}:safe">SICHER · ⛽ ${sector.safeFuel}</button><button data-sector-expedition="${index}:risk">RISIKO · ⛽ ${sector.riskFuel}</button></div>`;
      return `<article class="sector-card ${known ? 'secured' : ''} ${locked ? 'locked' : ''}"><span>${sector.icon}</span><div><b>${sector.name}</b><small>${sector.distance} · ${sector.hazard}</small><em>${known ? 'ROUTE GESICHERT · ' + sector.interest : sector.interest}</em></div>${scanButton}</article>`;
    }).join('')
  );
  const requirement = gateRequirement(),
    gateLabels = ['Sprungtor-Baustelle', 'Sprungtor-Rahmen', 'Stabilisierter Korridor', 'Tor nach dem Fernraum'];
  $('gateTitle').textContent = gateLabels[state.jumpGate];
  $('gateFill').style.width = (state.jumpGate / 3) * 100 + '%';
  if (!requirement) {
    $('gateText').textContent = 'Das Sprungtor öffnet den Fernraum und verstärkt die gesamte Produktion.';
    $('gateButton').disabled = true;
    $('gateButton').textContent = 'FERNRAUM BEREIT';
    return;
  }
  const missing = [];
  if (state.credits < requirement.credits) missing.push(fmt(requirement.credits - state.credits) + ' ◈');
  if (state.ore < requirement.ore) missing.push(fmt(requirement.ore - state.ore) + ' ⬡');
  if (state.alloys < requirement.alloys) missing.push(requirement.alloys - state.alloys + ' ▰');
  if (!requirement.ready) missing.push('Bedingung');
  $('gateText').textContent =
    requirement.label +
    ' · Bedarf: ' +
    fmt(requirement.credits) +
    ' ◈ · ' +
    fmt(requirement.ore) +
    ' ⬡ · ' +
    requirement.alloys +
    ' ▰' +
    (missing.length ? ' · Fehlt: ' + missing.join(', ') : '');
  $('gateButton').disabled = missing.length > 0;
  $('gateButton').textContent = 'PHASE ' + (state.jumpGate + 1) + ' BAUEN';
  renderSectorVisual();
}
function territoryGoal() {
  const joined = state.faction.joined;
  if (joined === null) return null;
  const target = PLANETS.findIndex((_, index) => territoryControl(index, joined) < 70 && state.planetsUnlocked[index]);
  return target < 0 ? null : { target, faction: joined, id: 'hold-' + joined + '-' + target };
}
function shiftTerritoryControl(index, gain) {
  const joined = state.faction.joined;
  if (joined === null) return;
  const control = state.faction.control[index],
    opponent =
      control
        .map((value, faction) => ({ value, faction }))
        .filter(item => item.faction !== joined)
        .sort((a, b) => b.value - a.value)[0]?.faction ?? 0;
  control[joined] = Math.min(100, control[joined] + gain);
  control[opponent] = Math.max(0, control[opponent] - gain);
  const total = control.reduce((sum, value) => sum + value, 0) || 1;
  state.faction.control[index] = control.map(value => Math.round((value / total) * 100));
  state.faction.territory[index] = territoryDominant(index);
  if (territoryOwned(index)) state.faction.claimed[index] = true;
}
function renderTerritoryMap() {
  const open = state.totalEarned >= 15000 && state.sectorUnlocked[0],
    panel = $('territoryPanel');
  panel.classList.toggle('hidden', !open);
  if (!open) return;
  const joined = state.faction.joined,
    held = PLANETS.filter((_, index) => territoryOwned(index)).length,
    goal = territoryGoal();
  $('territoryStatus').textContent = held + ' / ' + PLANETS.length;
  $('territoryGoal').textContent =
    joined === null
      ? 'Tritt einer freundlichen Fraktion bei, um Einfluss in ihren Grenzgebieten aufzubauen.'
      : !goal
        ? 'Fraktionsziel erfüllt: Halte deine bekannten Gebiete stabil.'
        : `FRAKTIONSZIEL · Sichere ${PLANETS[goal.target].name} auf 70% Einfluss für 2.500 Credits und 2 Treibstoff.`;
  setHTML(
    $('territoryList'),
    PLANETS.filter((_, index) => state.planetsUnlocked[index])
      .map((planet, index) => {
        const control = state.faction.control[index],
          owner = territoryDominant(index),
          own = joined === null ? 0 : territoryControl(index),
          role = TERRITORY_ROLES[index],
          status =
            own >= 70 ? 'STARK KONTROLLIERT' : own >= 60 ? 'KONTROLLIERT' : own >= 40 ? 'UMKÄMPFT' : 'FREMDE KONTROLLE',
          attackNeed = 14 + index * 3,
          canAttack = joined !== null && owner !== joined && state.fuel >= 2 && attack() >= attackNeed,
          canSupport = joined !== null && state.fuel >= 1 && own < 70,
          claimGoal = goal?.target === index && own >= 70 && !state.faction.goalsClaimed[goal.id];
        return `<article class="territory-card ${own >= 60 ? 'controlled' : own >= 40 ? 'contested' : ''}"><div class="territory-top"><span>${planet.icon}</span><div><b>${planet.name} · ${role[1]}</b><small>${status} · Nachbarn: ${TERRITORY_NEIGHBORS[index].filter(neighbor => state.planetsUnlocked[neighbor]).length}</small><em>${role[2]}</em></div><strong>${FACTIONS[owner].icon}</strong></div><div class="territory-meter">${control.map((value, faction) => `<i title="${FACTIONS[faction].name}" style="width:${value}%"></i>`).join('')}</div><div class="territory-actions">${claimGoal ? `<button data-territory-goal="${index}">ZIEL EINLÖSEN</button>` : `<button data-territory="${index}:support" ${canSupport ? '' : 'disabled'}>UNTERSTÜTZEN · ⛽ 1</button>`}<button data-territory="${index}:attack" ${canAttack ? '' : 'disabled'}>ANGRIFF · ⛽ 2 · ${attackNeed} ⚔</button></div></article>`;
      })
      .join('')
  );
}
function renderSceneEvent() {
  const layer = $('sceneEvent'),
    event = state.activeEvent || '';
  if (layer.dataset.event !== event) {
    layer.dataset.event = event;
    layer.innerHTML =
      event === 'boom'
        ? '<i class="event-comet"></i><i class="event-comet comet-two"></i><b class="event-ore-spark">✦</b>'
        : event === 'signal'
          ? '<i class="event-beacon"><b>☄</b><em></em></i>'
          : event === 'market'
            ? '<i class="event-trader"><b>⇄</b><em></em></i>'
            : '';
  }
  renderPipelineVisual();
  renderPlanetCommand();
  renderProgressionContent();
  renderSectorSystem();
  renderContracts();
  renderCrewSignals();
  renderTerritoryMap();
  renderStrategicEvent();
}
function renderFactionCommand() {
  if (state.totalEarned < 7000) return;
  const joined = state.faction.joined,
    war = warActive(),
    activeOwner = state.faction.territory[state.activePlanet];
  setHTML(
    $('factionList'),
    FACTIONS.map((faction, index) => {
      const rep = state.reputation[index],
        friendly = rep >= 3,
        isJoined = joined === index,
        rival = joined !== null && !isJoined,
        joinButton = friendly && joined === null ? `<button data-faction-join="${index}">BEITRETEN</button>` : '',
        support = !friendly ? `<button data-faction="${index}">◈ ${fmt(reputationCost(index))}</button>` : '',
        warButton = isJoined
          ? war
            ? `<button disabled>EINSATZ · ${Math.ceil((state.faction.warUntil - Date.now()) / 1000)}s</button>`
            : activeOwner === index
              ? '<button disabled>GEBIET GESICHERT</button>'
              : '<button data-faction-war>KRIEGSEINSATZ · ⛽ 2</button>'
          : '';
      return `<article class="faction-card ${friendly ? 'friendly' : ''} ${isJoined ? 'joined' : ''} ${rival ? 'rival' : ''}"><span>${faction.icon}</span><div><b>${faction.name}${isJoined ? ' · DEINE FRAKTION' : ''}</b><small>${isJoined ? faction.doctrine : friendly ? faction.bonus : 'Reputation ' + rep + ' / 3'}</small><em>${isJoined ? factionMilestoneText() : rival ? 'Diplomatischer Rivale' : 'Vertrauen durch Unterstützung aufbauen'}</em></div>${warButton || joinButton || support || '<button disabled>FREUNDLICH</button>'}</article>`;
    }).join('')
  );
}
// Brand portrait follows Mochi's equipped accessory (redrawn only when it changes).
let brandAccessory;
function renderMochiBrand() {
  const accessory = state.meta.equipped.mochi || '';
  if (accessory === brandAccessory) return;
  const url = window.SpaceKittens?.portraitURL(0, 'happy', 96, accessory ? [accessory] : null);
  if (!url) return;
  brandAccessory = accessory;
  document.getElementById('brandKitten')?.setAttribute('src', url);
}
const renderLivingWorlds = render;
render = () => {
  renderLivingWorlds();
  renderMochiBrand();
  renderBuildingSheet();
  renderStoryCard();
  renderJournal();
};
const renderWithVisuals = render;
render = () => {
  renderWithVisuals();
  renderObjective();
  renderSceneEvent();
  renderFactionCommand();
  const foe = enemyInfo(),
    droneCount = Math.min(6, 1 + state.buildings[1].level),
    beamCount = Math.min(4, 1 + Math.floor(state.buildings[0].level / 3) + Math.floor(state.buildings[1].level / 2)),
    trafficCount = Math.min(5, 1 + state.buildings[3].level),
    factionIndex = state.faction.joined ?? state.reputation.findIndex(rep => rep > 0),
    weakness = 'weak-' + foe.weakness.toLowerCase(),
    shipClass = 'ship-' + state.ship.model.toLowerCase(),
    weaponClass = 'weapon-' + state.ship.weaponType.toLowerCase(),
    drones = $('droneSwarm'),
    mining = $('ambientMining'),
    traffic = $('spaceTraffic'),
    art = $('enemyArt'),
    visualKey =
      state.enemyLevel + ':' + foe.boss + ':' + foe.weakness + ':' + state.ship.model + ':' + state.ship.weaponType,
    miningKey = beamCount + ':' + state.activePlanet + ':' + state.buildings[0].level + ':' + state.buildings[1].level,
    trafficKey = trafficCount + ':' + state.activePlanet + ':' + state.buildings[3].level + ':' + factionIndex;
  if (drones.dataset.count !== String(droneCount)) {
    drones.innerHTML = Array.from(
      { length: droneCount },
      (_, index) =>
        `<i style="--drone:${index};left:${(index % 3) * 32}px;top:${Math.floor(index / 3) * 28}px"><b></b></i>`
    ).join('');
    drones.dataset.count = droneCount;
  }
  if (mining.dataset.visualKey !== miningKey) {
    mining.innerHTML = Array.from(
      { length: beamCount },
      (_, index) =>
        `<i style="--beam:${index};--beam-delay:${(index * 0.64).toFixed(2)}s;left:${69 + (index % 2) * 58}px;top:${83 + Math.floor(index / 2) * 29}px"><b></b><em></em></i>`
    ).join('');
    mining.dataset.visualKey = miningKey;
  }
  if (traffic.dataset.visualKey !== trafficKey) {
    const factionShip =
      factionIndex < 0
        ? ''
        : `<i class="faction-ship faction-${factionIndex}"><b>${FACTIONS[factionIndex].icon}</b><em></em></i>`;
    traffic.innerHTML =
      Array.from(
        { length: trafficCount },
        (_, index) =>
          `<i class="space-ship ${index % 2 ? 'cargo' : 'miner'}" style="--ship:${index};--pace:${Math.max(3.6, 7 - state.buildings[3].level * 0.28).toFixed(2)}s"><b></b><em></em></i>`
      ).join('') + factionShip;
    traffic.dataset.visualKey = trafficKey;
  }
  if (art.dataset.visualKey !== visualKey) {
    const player = `<div class="combat-player ${shipClass} ${weaponClass}"><i class="player-wing wing-left"></i><i class="player-wing wing-right"></i><b></b><em></em></div>`;
    art.innerHTML = foe.boss
      ? player +
        `<div class="boss-model boss-model-${state.enemyLevel % 3} ${weakness}"><i class="boss-ring ring-a"></i><i class="boss-ring ring-b"></i><i class="boss-wing wing-a"></i><i class="boss-wing wing-b"></i><b>${foe.art}</b><em>◉</em></div>`
      : player +
        `<div class="enemy-model enemy-model-${state.enemyLevel % 3} ${weakness}"><i class="enemy-halo"></i><i class="enemy-fin fin-a"></i><i class="enemy-fin fin-b"></i><b>${foe.art}</b></div>`;
    art.dataset.visualKey = visualKey;
  }
};
function planetHarvestBonus(gain) {
  const id = activePlanet().id;
  if (id === 'crystal' && Math.random() < 0.18) {
    state.crystals++;
    return ' · Kristallader +1 ◆';
  }
  if (id === 'ice' && Math.random() < 0.18) {
    state.fuel++;
    return ' · Frostader +1 ⛽';
  }
  if (id === 'volcanic') {
    state.ore++;
    return ' · Lavaader +1 ⬡';
  }
  if (id === 'machine' && Math.random() < 0.12) return MACHINE_DOUBLE;
  if (id === 'verdant' && Math.random() < 0.24) {
    state.fuel++;
    return ' · Bioreaktor +1 ⛽';
  }
  if (id === 'forge') {
    state.alloys++;
    return ' · Sonnenofen +1 ▰ Legierung';
  }
  return '';
}
function fuelFromProduction() {
  return Math.max(0, Math.floor(deliveryRate() / 120));
}
function completeQuest(i) {
  if (state.quests[i]) return;
  state.quests[i] = true;
  if (i === 1) state.gems += 3;
  else earn(i === 0 ? 100 : 250);
  toast('Auftrag erfüllt! Belohnung erhalten.');
}
document.addEventListener('click', e => {
  const nav = e.target.closest('[data-screen]');
  if (nav) showScreen(nav.dataset.screen);
  const planet = e.target.closest('[data-planet]');
  if (planet) {
    const index = +planet.dataset.planet;
    if (state.planetsUnlocked[index]) {
      state.activePlanet = index;
      GameEvents.emit('planet', { index, discovered: false });
      render();
      showPlanetFocus(PLANETS[index]);
      toast(PLANETS[index].name + ' als Abbauziel gewählt!');
    }
  }
  const research = e.target.closest('[data-research]');
  if (research) {
    const index = +research.dataset.research,
      tech = RESEARCH[index],
      available = tech.requires.every(required => state.research[required]),
      researchPrice = researchCost(tech),
      alloyCost = tech.alloyCost || 0;
    if (!available) {
      toast('Erforsche zuerst die benötigten Technologien.');
    } else if (!state.research[index] && state.credits >= researchPrice && state.alloys >= alloyCost) {
      state.credits -= researchPrice;
      state.alloys -= alloyCost;
      state.research[index] = true;
      seasonXp('research');
      render();
      showPlanetMilestone(tech.icon, 'FORSCHUNG ABGESCHLOSSEN', tech.effect);
      toast(tech.name + ' erforscht!');
    } else if (!state.research[index])
      toast(
        state.alloys < alloyCost
          ? 'Noch ' + (alloyCost - state.alloys) + ' Legierungen nötig'
          : 'Noch ' + fmt(researchPrice - state.credits) + ' Credits nötig'
      );
  }
  const specialization = e.target.closest('[data-specialization]');
  if (specialization) {
    const next = specialization.dataset.specialization,
      current = planetSpecialization();
    if (developmentStage() < 2 || next === current) return;
    if (current && state.crystals < 1) {
      toast('Ein Strategiewechsel kostet 1 Kristall.');
      return;
    }
    if (current) state.crystals--;
    state.planetOps.specializations[state.activePlanet] = next;
    render();
    showPlanetMilestone(
      '✧',
      'PLANET SPEZIALISIERT',
      {
        mining: 'Bergbau erhöht die Förderleistung.',
        logistics: 'Logistik erweitert Lager und Frachter.',
        research: 'Forschung senkt Laborpreise.',
        trade: 'Handel erhöht den Marktwert.',
        military: 'Verteidigung unterstützt dein Schiff.'
      }[next]
    );
    toast(
      activePlanet().name +
        ' spezialisiert sich auf ' +
        { mining: 'Bergbau', logistics: 'Logistik', research: 'Forschung', trade: 'Handel', military: 'Verteidigung' }[
          next
        ] +
        '.'
    );
  }
  const buy = e.target.closest('[data-buy]');
  if (buy) {
    let b = state.buildings[+buy.dataset.buy],
      c = cost(b),
      stageBefore = developmentStage();
    if (state.credits >= c) {
      state.credits -= c;
      b.level++;
      seasonXp('upgrade');
      const milestoneHit = milestonesReached(b.level) > milestonesReached(b.level - 1);
      const buildingIndex = state.buildings.indexOf(b);
      GameEvents.emit('upgrade', {
        index: buildingIndex,
        level: b.level,
        milestone: milestoneHit,
        visualStage: VISUAL_STAGES[buildingIndex].includes(b.level)
      });
      if (b.level === 1 && buildingIndex > 0) storyEvent('built-' + buildingIndex);
      state.planetOps.investment[state.activePlanet] += c;
      if (state.buildings[0].level >= 3) completeQuest(0);
      render();
      showProductionUpgrade(b);
      if (developmentStage() > stageBefore)
        showPlanetMilestone(
          '✦',
          'ENTWICKLUNGSSTUFE ' + developmentStage(),
          'Neue Infrastruktur ist im Orbit sichtbar.'
        );
      if (milestoneHit) window.NebulaAudio?.play('meow');
      if (milestoneHit)
        showPlanetMilestone(b.icon, b.name.toUpperCase() + ' · LV. ' + b.level, 'Meilenstein: Leistung ×2!');
      toast(b.name + ' verbessert!');
    } else toast('Noch ' + fmt(c - state.credits) + ' Credits nötig');
  }
  const tr = e.target.closest('[data-trade]');
  if (tr) {
    const values = [250, 533, 2610],
      ore = [10, 18, 30],
      i = +tr.dataset.trade,
      bonus = tradeBonus();
    if (state.ore < ore[i]) {
      toast('Nicht genug Erz im Lager');
      return;
    }
    state.ore -= ore[i];
    earn(values[i] * bonus);
    if (i === 0) state.crystals++;
    render();
    toast('Lieferung verkauft!');
  }
  const factionJoin = e.target.closest('[data-faction-join]');
  if (factionJoin) {
    const index = +factionJoin.dataset.factionJoin;
    if (state.faction.joined !== null || state.reputation[index] < 3) return;
    state.faction.joined = index;
    render();
    toast('Du bist jetzt Teil des ' + FACTIONS[index].name + '!');
  }
  const factionWar = e.target.closest('[data-faction-war]');
  if (factionWar) {
    const target = state.activePlanet,
      owner = state.faction.territory[target];
    if (state.faction.joined === null || owner === state.faction.joined || state.fuel < 2) {
      toast(
        owner === state.faction.joined
          ? 'Dieses Gebiet ist bereits gesichert.'
          : 'Du brauchst 2 Treibstoff für den Einsatz.'
      );
      return;
    }
    state.fuel -= 2;
    state.faction.warTarget = target;
    state.faction.warUntil = Date.now() + 120000;
    render();
    toast('Kriegseinsatz auf ' + activePlanet().name + ' gestartet: Siege sichern Einfluss.');
  }
  const faction = e.target.closest('[data-faction]');
  if (faction) {
    const index = +faction.dataset.faction,
      rep = state.reputation[index],
      cost = reputationCost(index);
    if (rep >= 3) return;
    if (state.credits < cost) {
      toast('Noch ' + fmt(cost - state.credits) + ' Credits für Reputation nötig');
      return;
    }
    state.credits -= cost;
    state.reputation[index]++;
    render();
    toast(FACTIONS[index].name + ' vertraut dir mehr.');
  }
  const territoryAction = e.target.closest('[data-territory]');
  if (territoryAction) {
    const [rawIndex, action] = territoryAction.dataset.territory.split(':'),
      index = +rawIndex,
      owner = territoryDominant(index),
      need = 14 + index * 3;
    if (state.faction.joined === null || !PLANETS[index]) return;
    if (action === 'support') {
      if (state.fuel < 1) return;
      state.fuel--;
      shiftTerritoryControl(index, 12 + (crewRank(7) ? 3 : 0));
      toast('Versorgung nach ' + PLANETS[index].name + ': +Einfluss.');
    } else {
      if (state.fuel < 2 || owner === state.faction.joined || attack() < need) {
        toast('Angriff benötigt ' + need + ' Kampfstärke und 2 Treibstoff.');
        return;
      }
      state.fuel -= 2;
      shiftTerritoryControl(index, 18 + (crewRank(1) >= 3 ? 4 : 0) + (crewRank(7) ? 3 : 0));
      toast('Grenzangriff erfolgreich: Einfluss bei ' + PLANETS[index].name + ' verschoben.');
    }
    render();
  }
  const territoryGoalClaim = e.target.closest('[data-territory-goal]');
  if (territoryGoalClaim) {
    const goal = territoryGoal(),
      index = +territoryGoalClaim.dataset.territoryGoal;
    if (!goal || goal.target !== index || !territoryOwned(index) || state.faction.goalsClaimed[goal.id]) return;
    state.faction.goalsClaimed[goal.id] = true;
    earn(2500);
    state.fuel += 2;
    state.reputation[state.faction.joined] = Math.min(3, state.reputation[state.faction.joined] + 1);
    render();
    showPlanetMilestone('⚑', 'FRAKTIONSZIEL ERFÜLLT', '+2.500 Credits · +2 Treibstoff · Reputation');
    toast('Fraktionsziel abgeschlossen!');
  }
  const strategicAction = e.target.closest('[data-strategic-event]');
  if (strategicAction) {
    const [id, action] = strategicAction.dataset.strategicEvent.split(':');
    if (state.strategicEvent?.id === id) finishStrategicEvent(action);
  }
  const contract = e.target.closest('[data-contract]');
  if (contract) {
    claimContract(contract.dataset.contract);
  }
  const sectorScan = e.target.closest('[data-sector-scan]');
  if (sectorScan) {
    const index = +sectorScan.dataset.sectorScan,
      sector = SECTORS[index];
    if (
      !sector ||
      state.sectorScanEnd > Date.now() ||
      state.sectorScans[index] >= sector.scans ||
      state.totalEarned < sector.unlock ||
      state.fuel < sector.scanFuel
    )
      return;
    state.fuel -= sector.scanFuel;
    state.sectorScanTarget = index;
    state.sectorScanEnd = Date.now() + sector.scanTime * (gateBonus(2) ? 0.75 : 1) * scanTimeMultiplier();
    render();
    feedback('open', 'light');
    toast('Scanprofil für ' + sector.name + ' gestartet.');
  }
  const sectorExpedition = e.target.closest('[data-sector-expedition]');
  if (sectorExpedition) {
    const [rawIndex, risk] = sectorExpedition.dataset.sectorExpedition.split(':'),
      index = +rawIndex,
      sector = SECTORS[index],
      fuelCost = Math.max(
        1,
        (risk === 'risk' ? sector?.riskFuel : sector?.safeFuel) - (risk === 'risk' && crewRank(5) >= 3 ? 1 : 0)
      );
    if (
      !sector ||
      state.sectorExpedition ||
      state.sectorScans[index] < sector.scans ||
      state.sectorUnlocked[index] ||
      state.fuel < fuelCost
    )
      return;
    state.fuel -= fuelCost;
    state.sectorExpedition = {
      target: index,
      risk,
      end: Date.now() + BALANCE.sectorExpeditionMinutes[risk === 'risk' ? 'risk' : 'safe'][index] * 60000
    };
    render();
    feedback('launch', 'medium');
    toast((risk === 'risk' ? 'Risikoreiche' : 'Sichere') + ' Expedition zu ' + sector.name + ' gestartet.');
  }
  const crewAction = e.target.closest('[data-crew-action]');
  if (crewAction) {
    const index = +crewAction.dataset.crewAction,
      crew = state.crew[index];
    if (!crew) return;
    if (!crew.unlocked) {
      if (!crewUnlockReady(index)) {
        toast(crew.unlock);
        return;
      }
      if (state.credits < crewRecruitCost(crew)) {
        toast('Noch ' + fmt(crewRecruitCost(crew) - state.credits) + ' Credits nötig');
        return;
      }
      state.credits -= crewRecruitCost(crew);
      crew.unlocked = true;
      completeQuest(1);
      feedback('unlock', 'success');
      window.NebulaAudio?.play('meow');
      toast(crew.name + ' ist jetzt in deiner Crew!');
    }
    if (crewActive(index)) {
      state.crewActive = state.crewActive.filter(activeIndex => activeIndex !== index);
      toast(crew.name + ' abberufen.');
    } else if (state.crewActive.length < state.crewSlots) {
      state.crewActive.push(index);
      toast(crew.name + ' in den aktiven Dienst versetzt.');
    }
    render();
  }
  const crewUpgrade = e.target.closest('[data-crew-upgrade]');
  if (crewUpgrade) {
    const crew = state.crew[+crewUpgrade.dataset.crewUpgrade],
      cost = crew && crewUpgradeCost(crew);
    if (
      !crew ||
      crew.rank >= 5 ||
      state.credits < cost.credits ||
      state.alloys < cost.alloys ||
      state.crystals < cost.crystals
    )
      return;
    state.credits -= cost.credits;
    state.alloys -= cost.alloys;
    state.crystals -= cost.crystals;
    crew.rank++;
    render();
    showPlanetMilestone(
      crew.icon,
      crew.name + ' · RANG ' + crew.rank,
      crew.rank === 3 ? crew.secondary : 'Hauptbonus verstärkt.'
    );
    toast(crew.name + ' auf Rang ' + crew.rank + ' verbessert!');
  }
  const st = e.target.closest('[data-star]');
  if (st) {
    const i = +st.dataset.star,
      upgrade = STAR_UPGRADES[i],
      c = upgrade ? starCost(i) : Infinity;
    if (!upgrade || state.stars[i] >= upgrade.max) return;
    if (state.stardust >= c) {
      state.stardust -= c;
      state.stars[i]++;
      render();
      feedback('upgrade', 'medium');
      toast(upgrade.name + ' verbessert!');
    } else toast('Mehr Sternenstaub benötigt');
  }
  const ship = e.target.closest('[data-ship]');
  if (ship) {
    const kind = ship.dataset.ship,
      c = shipCost(kind),
      isGem = kind === 'core';
    if ((isGem ? state.gems : state.credits) >= c) {
      if (isGem) state.gems -= c;
      else state.credits -= c;
      state.ship[kind]++;
      render();
      toast(kind === 'core' ? 'Gem-Kern verstärkt!' : 'Schiff verbessert!');
    } else toast(isGem ? 'Nicht genug Gems' : 'Nicht genug Credits');
  }
  const model = e.target.closest('[data-model]');
  if (model) {
    const name = model.dataset.model;
    if (state.ship.models[name]) {
      state.ship.model = name;
      render();
      toast(name + ' ausgewählt!');
    } else {
      const gemCost = name === 'Aegis' ? 10 : name === 'Pioneer' ? 12 : 0,
        creditCost = name === 'Comet' ? 1500 : name === 'Corsair' ? 4500 : 0,
        bossNeeded = name === 'Vanguard' ? 2 : 0;
      if (bossNeeded && state.bossDefeats < bossNeeded) {
        toast('Besiege noch ' + (bossNeeded - state.bossDefeats) + ' Boss(e) für die Vanguard');
        return;
      }
      if ((gemCost && state.gems < gemCost) || (creditCost && state.credits < creditCost)) {
        toast(gemCost ? 'Du brauchst ' + gemCost + ' Gems' : 'Du brauchst ' + fmt(creditCost) + ' Credits');
        return;
      }
      state.gems -= gemCost;
      state.credits -= creditCost;
      state.ship.models[name] = true;
      state.ship.model = name;
      render();
      toast(name + ' freigeschaltet!');
    }
  }
  const weapon = e.target.closest('[data-weapon]');
  if (weapon) {
    const name = weapon.dataset.weapon;
    if (state.ship.weaponTypes[name]) {
      state.ship.weaponType = name;
      render();
      toast(name + '-Waffe ausgerüstet!');
    } else {
      const gemCost = name === 'Arc' ? 8 : name === 'Nova' ? 15 : 0,
        creditCost = name === 'Plasma' ? 750 : name === 'Ion' ? 2200 : 0;
      if ((gemCost && state.gems < gemCost) || (creditCost && state.credits < creditCost)) {
        toast(gemCost ? 'Du brauchst ' + gemCost + ' Gems' : 'Du brauchst ' + fmt(creditCost) + ' Credits');
        return;
      }
      state.gems -= gemCost;
      state.credits -= creditCost;
      state.ship.weaponTypes[name] = true;
      state.ship.weaponType = name;
      render();
      toast(name + '-Waffe freigeschaltet!');
    }
  }
});
$('collectButton').onclick = collect;
$('battleButton').onclick = e => {
  if (pips().stage === 'battle') {
    pipsAttack(e);
    render();
    return;
  }
  const card = $('enemyCard'),
    foe = enemyInfo(),
    now = Date.now();
  if (e.isTrusted) {
    state.combo = now - (state.comboAt || 0) <= 1200 ? Math.min(10, (state.combo || 0) + 1) : 1;
    state.comboAt = now;
  } else if (!e.catStrike) state.combo = 0; // Tikki's strikes leave the player's combo alone
  const damage = attack(),
    aimed = state.aimReady,
    overcharged = Date.now() < state.overchargeUntil;
  card.classList.remove('hit');
  void card.offsetWidth;
  card.classList.add('hit');
  feedback('hit', e.isTrusted ? 'light' : null);
  state.enemyHp -= damage;
  GameEvents.emit('attack', {
    damage,
    weapon: state.ship.weaponType,
    aimed,
    overcharge: overcharged,
    auto: !e.isTrusted,
    boss: foe.boss,
    killed: state.enemyHp <= 0,
    level: state.enemyLevel
  });
  if (state.enemyHp <= 0) {
    feedback(foe.boss ? 'unlock' : 'defeat', foe.boss ? 'heavy' : null);
    if (foe.boss) window.NebulaAudio?.play('meow');
    const credits = state.enemyLevel * 100 * (foe.boss ? 3 : 1),
      bonus = enemyBonus(foe);
    earn(credits);
    state.ore += 5 + state.enemyLevel;
    state.crystals += bonus.crystals + (foe.boss ? 2 : 0);
    state.fuel += bonus.fuel;
    const drop = addItem(foe.boss);
    let territoryNote = '';
    if (warActive() && state.faction.joined !== null) {
      const target = state.activePlanet,
        points = foe.boss ? 3 : 1;
      state.faction.influence[target] += points;
      if (state.faction.influence[target] >= 5) {
        state.faction.territory[target] = state.faction.joined;
        state.faction.influence[target] = 0;
        state.faction.warUntil = 0;
        territoryNote = ' · GEBIET GESICHERT!';
      } else territoryNote = ' · +' + points + '/5 Einfluss';
    }
    let chest = false;
    if (foe.boss) {
      state.bossDefeats++;
      state.gems += 1;
      chest = arsenalBossVictory(state.enemyLevel); // a new sector-boss record pays a Sternenkiste
    } else if (Math.random() < 0.08) state.gems++;
    seasonXp(foe.boss ? 'boss' : 'enemy');
    if (pips().stage === 'warned' && !campaignLeadsTo('pips')) countInspectionDrone(); // with the Orion campaign, its waves are the inspection
    GameEvents.emit('enemy-defeated', {
      boss: foe.boss,
      credits,
      rarity: drop.rarity,
      dropName: drop.name,
      isNew: drop.isNew,
      level: state.enemyLevel,
      chest
    });
    state.enemyLevel++;
    state.enemyHp = enemyMaxHp();
    const nextFoe = enemyInfo();
    GameEvents.emit('enemy-spawn', { level: state.enemyLevel, boss: nextFoe.boss, name: nextFoe.name });
    completeQuest(2);
    const extras =
      (bonus.crystals ? ' · +' + bonus.crystals + ' Kristall' : '') +
      (bonus.fuel ? ' · +' + bonus.fuel + ' Treibstoff' : '');
    toast(
      (foe.boss ? 'BOSS BESIEGT! ' : 'Gegner besiegt! ') +
        '+' +
        credits +
        ' Credits' +
        extras +
        territoryNote +
        ' · ' +
        (drop.isNew ? 'NEUER FUND: ' : '') +
        { normal: 'Gewöhnliches', rare: 'Seltenes', epic: 'Episches', legendary: 'Legendäres' }[drop.rarity] +
        ' ' +
        drop.name +
        '!'
    );
  }
  render();
};
$('autoBattleButton').onclick = () => {
  state.autoBattle = !state.autoBattle;
  render();
};
$('overchargeButton').onclick = () => {
  if (state.crystals < 1 || Date.now() < state.overchargeUntil) return;
  const duration = (state.ship.model === 'Comet' ? 20000 : 15000) + energyPower() * 500;
  state.crystals--;
  state.overchargeUntil = Date.now() + duration;
  render();
  toast('Overcharge aktiv: 3× Kampfschaden für ' + duration / 1000 + ' Sekunden!');
};
// ======================================================================================================
// Commerce: shop, boosts, rewarded ads, cosmetics, season pass. Ledger/providers live in monetization.js.
const Commerce = window.NebulaCommerce;
const BOOST_GEM_COST = 20;
const TIME_WARP_GEM_COST = 30;
let shopTab = 'boost';
let lastOfflineReport = null;
let adInProgress = false;

function addBoost(minutes) {
  const now = Date.now();
  // Boosts stack up to 4 hours in total.
  state.boostUntil = Math.min(now + 4 * 3600000, Math.max(now, state.boostUntil) + minutes * 60000);
}
function boostLeftText() {
  const left = Math.max(0, state.boostUntil - Date.now());
  if (!left) return '';
  const minutes = Math.ceil(left / 60000);
  return minutes >= 60 ? Math.floor(minutes / 60) + ' Std. ' + (minutes % 60) + ' Min.' : minutes + ' Min.';
}
// Instant production at full efficiency for the given minutes (gem sink / reward).
function timeWarp(minutes) {
  const seconds = minutes * 60,
    before = state.credits;
  offlineMode = true;
  try {
    addFlow(runProduction(seconds, 1), seconds);
  } finally {
    offlineMode = false;
  }
  return state.credits - before;
}
// Applies reward bundles from purchases, season tiers and ads. Purchases' entitlements/cosmetics/tokens are
// already recorded in the ledger by Commerce.recordPurchase; season/ad rewards pass through here completely.
function applyRewards(rewards, { fromLedger = false } = {}) {
  const parts = [];
  if (rewards.gems) {
    state.gems += rewards.gems;
    parts.push('+' + rewards.gems + ' ◆');
  }
  if (rewards.crystals) {
    state.crystals += rewards.crystals;
    parts.push('+' + rewards.crystals + ' Kristalle');
  }
  if (rewards.fuel) {
    state.fuel += rewards.fuel;
    parts.push('+' + rewards.fuel + ' ⛽');
  }
  if (rewards.alloys) {
    state.alloys += rewards.alloys;
    parts.push('+' + rewards.alloys + ' ▰');
  }
  if (rewards.timeWarp)
    parts.push('+' + fmt(timeWarp(rewards.timeWarp)) + ' ◈ (Zeitsprung ' + rewards.timeWarp + ' Min.)');
  if (rewards.boostTokens) {
    if (!fromLedger) state.meta.boostTokens += rewards.boostTokens;
    parts.push('+' + rewards.boostTokens + ' Boost');
  }
  if (rewards.cosmetic && !fromLedger && !state.meta.cosmetics.includes(rewards.cosmetic)) {
    state.meta.cosmetics.push(rewards.cosmetic);
    parts.push('Kosmetik: ' + Commerce.COSMETICS[rewards.cosmetic].name);
  }
  if (fromLedger && rewards.cosmetics) parts.push('Kosmetik freigeschaltet');
  if (fromLedger && rewards.entitlement) parts.push('Kommandanten-Edition aktiv');
  if (fromLedger && rewards.seasonPass) parts.push('Sternenpass aktiv');
  return parts.join(' · ');
}

// ----- Season pass -----
function currentSeason() {
  const season = Commerce.seasonAt(Date.now());
  if (state.meta.season.id !== season.id)
    state.meta.season = { id: season.id, xp: 0, rested: 0, premium: false, claimedFree: [], claimedPremium: [] };
  return season;
}
function seasonTier() {
  return Math.min(Commerce.SEASON_TIERS, Math.floor(state.meta.season.xp / Commerce.SEASON_TIER_XP));
}
function seasonXp(kind) {
  if (!Commerce) return;
  currentSeason();
  const season = state.meta.season,
    base = Commerce.SEASON_XP[kind] || 0,
    bonus = Math.min(base, season.rested || 0),
    today = new Date().toISOString().slice(0, 10);
  if (season.day !== today) {
    season.day = today;
    season.dayXp = 0;
  }
  season.rested = (season.rested || 0) - bonus;
  let gained = base + bonus;
  // Soft daily pace (see monetization.js): full rate up to the daily amount, reduced afterwards.
  const fullLeft = Math.max(0, Commerce.SEASON_DAILY_FULL_XP - season.dayXp),
    full = Math.min(gained, fullLeft);
  gained = full + (gained - full) * Commerce.SEASON_OVERFLOW_RATE;
  season.dayXp += base + bonus;
  season.xp = Math.min(Commerce.SEASON_TIERS * Commerce.SEASON_TIER_XP, season.xp + gained);
}
function rewardLabel(reward) {
  const parts = [];
  if (reward.gems) parts.push(reward.gems + ' ◆');
  if (reward.crystals) parts.push(reward.crystals + ' Kristalle');
  if (reward.fuel) parts.push(reward.fuel + ' ⛽');
  if (reward.alloys) parts.push(reward.alloys + ' ▰');
  if (reward.timeWarp) parts.push('Zeitsprung ' + reward.timeWarp + ' Min.');
  if (reward.boostTokens) parts.push(reward.boostTokens + '× Boost');
  if (reward.cosmetic)
    parts.push(Commerce.COSMETICS[reward.cosmetic].icon + ' ' + Commerce.COSMETICS[reward.cosmetic].name);
  return parts.join(' + ');
}
function claimSeasonTier(track, tier) {
  const season = currentSeason(),
    rewards = Commerce.seasonRewards(season),
    meta = state.meta.season,
    claimed = track === 'premium' ? meta.claimedPremium : meta.claimedFree;
  if (tier < 1 || tier > seasonTier() || claimed.includes(tier)) return;
  if (track === 'premium' && !meta.premium) return;
  claimed.push(tier);
  const summary = applyRewards((track === 'premium' ? rewards.premium : rewards.free)[tier - 1]);
  feedback('reward', 'success');
  save();
  render();
  renderSeason();
  toast('Stufe ' + tier + ': ' + summary);
}
function daysText(days) {
  return days === 1 ? '1 Tag' : days + ' Tage';
}
function seasonDaysLeft(season) {
  return Math.max(0, Math.ceil((season.end - Date.now()) / 86400000));
}
function renderSeasonCard() {
  if (!Commerce) return;
  const season = currentSeason(),
    tier = seasonTier(),
    meta = state.meta.season,
    claimable =
      Array.from({ length: tier }, (_, i) => i + 1).filter(t => !meta.claimedFree.includes(t)).length +
      (meta.premium
        ? Array.from({ length: tier }, (_, i) => i + 1).filter(t => !meta.claimedPremium.includes(t)).length
        : 0);
  $('seasonCard').classList.toggle('hidden', state.totalEarned < 600 && state.galaxiesSold === 0);
  $('seasonCardTag').textContent = 'STERNENROUTE · NOCH ' + daysText(seasonDaysLeft(season)).toUpperCase();
  $('seasonCardTitle').textContent = season.name + ' · Stufe ' + tier + '/' + Commerce.SEASON_TIERS;
  $('seasonCardFill').style.width = ((meta.xp % Commerce.SEASON_TIER_XP) / Commerce.SEASON_TIER_XP) * 100 + '%';
  $('seasonCardAction').textContent = claimable ? claimable + ' BEREIT ›' : 'ÖFFNEN ›';
  $('seasonCard').classList.toggle('claimable', claimable > 0);
}
function renderSeason() {
  const season = currentSeason(),
    rewards = Commerce.seasonRewards(season),
    meta = state.meta.season,
    tier = seasonTier(),
    end = new Date(season.end - 1).toLocaleDateString('de-DE');
  $('seasonTag').textContent = 'STERNENROUTE · SAISON ' + (season.index + 1);
  $('seasonTitle').textContent = season.name;
  $('seasonTime').textContent =
    'Läuft bis ' +
    end +
    ' (noch ' +
    daysText(seasonDaysLeft(season)) +
    ') · ' +
    Math.floor(meta.xp) +
    ' XP · heute ' +
    Math.min(Commerce.SEASON_DAILY_FULL_XP, Math.floor(meta.dayXp || 0)) +
    '/' +
    Commerce.SEASON_DAILY_FULL_XP +
    ' mit vollem Tempo' +
    (meta.rested ? ' · Ruhebonus ' + meta.rested : '');
  $('seasonLevel').textContent = 'Stufe ' + tier + ' / ' + Commerce.SEASON_TIERS;
  $('seasonFill').style.width = (meta.xp / (Commerce.SEASON_TIERS * Commerce.SEASON_TIER_XP)) * 100 + '%';
  setHTML(
    $('seasonTrack'),
    rewards.free
      .map((free, index) => {
        const t = index + 1,
          reached = t <= tier,
          freeClaimed = meta.claimedFree.includes(t),
          premiumClaimed = meta.claimedPremium.includes(t),
          premium = rewards.premium[index];
        return `<div class="season-tier ${reached ? 'reached' : ''}"><b>${t}</b><button class="tier-reward free" data-season-claim="free:${t}" ${!reached || freeClaimed ? 'disabled' : ''}><small>GRATIS</small>${rewardLabel(free)}${freeClaimed ? ' ✓' : ''}</button><button class="tier-reward premium ${meta.premium ? '' : 'locked'}" data-season-claim="premium:${t}" ${!reached || premiumClaimed || !meta.premium ? 'disabled' : ''}><small>STERNENPASS</small>${rewardLabel(premium)}${premiumClaimed ? ' ✓' : ''}</button></div>`;
      })
      .join('')
  );
  const storeReady = Commerce.store.available();
  $('seasonBuy').classList.toggle('hidden', meta.premium);
  $('seasonBuy').disabled = !storeReady;
  $('seasonBuy').textContent = storeReady
    ? 'STERNENPASS FREISCHALTEN · ' + (Commerce.store.price('nh_season_pass') || 'Preis lädt …')
    : 'STERNENPASS DERZEIT NICHT VERFÜGBAR';
}

// ----- Purchases -----
Commerce?.onTransaction(async transaction => {
  const result = Commerce.recordPurchase(state.meta, {
    ...transaction,
    seasonId: currentSeason().id,
    now: Date.now()
  });
  if (result.status === 'granted') {
    const summary = applyRewards(result.grants, { fromLedger: true });
    feedback('reward', 'success');
    toast('Kauf abgeschlossen: ' + summary);
  } else if (result.status === 'pending')
    toast('Zahlung ausstehend – die Belohnung folgt nach Bestätigung durch Google Play.');
  // Persist before the store acknowledges/consumes the purchase.
  save();
  render();
  if (topModal() === 'shopModal') renderShop();
  if (topModal() === 'seasonModal') renderSeason();
  return result;
});
async function buyProduct(id) {
  if (!Commerce.store.available()) {
    toast('Käufe sind derzeit nicht verfügbar.');
    return;
  }
  const result = await Commerce.store.purchase(id);
  if (result.status === 'cancelled') toast('Kauf abgebrochen.');
  else if (result.status === 'error')
    toast('Kauf fehlgeschlagen: ' + (result.message || 'Bitte später erneut versuchen.'));
  else if (result.status === 'already-owned') toast('Bereits freigeschaltet. Nutze „Käufe wiederherstellen“.');
  renderShop();
}

// ----- Rewarded ads (always optional; Commander Edition grants the reward without an ad) -----
function adReady(placement) {
  if (!Commerce || Commerce.adRemaining(state.meta, placement) <= 0) return false;
  return Boolean(state.meta.entitlements.commanderEdition) || Commerce.ads.available();
}
// `stillValid` (optional) is checked again after the ad and before the reward is recorded: if the target changed
// meanwhile (e.g. the construction finished), nothing is granted and the daily count is not used up.
async function runRewardedPlacement(placement, grant, stillValid) {
  if (adInProgress || !adReady(placement)) return false;
  adInProgress = true;
  try {
    let result;
    if (state.meta.entitlements.commanderEdition)
      result = { rewarded: true, rewardId: 'premium-' + Date.now() + '-' + placement };
    else result = await Commerce.ads.show(placement);
    if (!result?.rewarded) {
      toast(
        result?.error === 'interrupted' || !result?.error
          ? 'Werbung abgebrochen – keine Belohnung.'
          : 'Werbung nicht verfügbar.'
      );
      return false;
    }
    if (stillValid && !stillValid()) {
      toast('Das Ziel hat sich inzwischen erledigt – keine Belohnung verbraucht.');
      return false;
    }
    // Reward exactly once per verified reward event.
    if (!Commerce.recordAdReward(state.meta, placement, result.rewardId)) return false;
    grant();
    feedback('reward', 'success');
    save();
    render();
    return true;
  } finally {
    adInProgress = false;
  }
}
function adLabel(placement, text) {
  const left = Commerce.adRemaining(state.meta, placement);
  return (
    (state.meta.entitlements.commanderEdition ? '✦ ' : '▶ ') +
    text +
    ' · ' +
    left +
    '/' +
    Commerce.PLACEMENTS[placement].dailyCap
  );
}
function renderWelcomeDouble() {
  const button = $('welcomeDouble');
  const show = Boolean(
    lastOfflineReport && !lastOfflineReport.doubled && lastOfflineReport.credits > 0 && adReady('offline_double')
  );
  button.classList.toggle('hidden', !show);
  if (show) button.textContent = adLabel('offline_double', 'ERTRAG VERDOPPELN');
}
function renderAdButtons() {
  if (!Commerce) return;
  const expeditionRunning = state.expeditionEnd > Date.now();
  $('expeditionSkip').classList.toggle('hidden', !expeditionRunning || !adReady('expedition'));
  if (expeditionRunning) $('expeditionSkip').textContent = adLabel('expedition', 'SOFORT BEENDEN');
  const scannerCooling = Date.now() < state.spinAt;
  $('spinRefill').classList.toggle('hidden', !scannerCooling || !adReady('scanner'));
  if (scannerCooling) $('spinRefill').textContent = adLabel('scanner', 'AUFLADEN');
  $('boostButton').textContent = state.boostUntil > Date.now() ? '⚡ ' + boostLeftText() : '⚡ Boost';
  renderSeasonCard();
  applyCosmetics();
}
$('welcomeDouble').onclick = () =>
  runRewardedPlacement('offline_double', () => {
    if (!lastOfflineReport || lastOfflineReport.doubled) return;
    lastOfflineReport.doubled = true;
    earn(lastOfflineReport.credits);
    $('welcomeCredits').textContent = '+' + fmt(lastOfflineReport.credits * 2);
    renderWelcomeDouble();
    toast('Offline-Ertrag verdoppelt: +' + fmt(lastOfflineReport.credits));
  });
$('expeditionSkip').onclick = () =>
  runRewardedPlacement('expedition', () => {
    if (state.expeditionEnd > Date.now()) state.expeditionEnd = Date.now();
    gameTick();
  });
$('spinRefill').onclick = () =>
  runRewardedPlacement('scanner', () => {
    state.spinAt = 0;
    toast('Signal-Scanner aufgeladen.');
  });

// ----- Cosmetics -----
function applyCosmetics() {
  const shell = $('appShell'),
    equipped = state.meta?.equipped || {},
    classes = ['ship', 'ring', 'trail']
      .map(slot => (equipped[slot] ? 'cosmetic-' + equipped[slot] : ''))
      .filter(Boolean),
    key = classes.join(' ');
  if (shell.dataset.cosmetics === key) return;
  shell.dataset.cosmetics = key;
  [...shell.classList].filter(name => name.startsWith('cosmetic-')).forEach(name => shell.classList.remove(name));
  classes.forEach(name => shell.classList.add(name));
}

// ----- Shop dialog -----
function renderShop() {
  if (!Commerce) return;
  const meta = state.meta,
    storeReady = Commerce.store.available();
  $('shopGems').textContent = fmt(state.gems);
  $('shopTokens').textContent = meta.boostTokens ? '· ' + meta.boostTokens + ' Boost-Token' : '';
  document.querySelectorAll('[data-shop-tab]').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.shopTab === shopTab);
    tab.setAttribute('aria-selected', String(tab.dataset.shopTab === shopTab));
  });
  let html = '';
  if (shopTab === 'boost') {
    const boostActive = state.boostUntil > Date.now(),
      hourValue = (typeof galaxyIncomeStats === 'function' ? galaxyIncomeStats().estimate : galacticDeliveryRate()) * 3600;
    html =
      `<div class="shop-item"><div><b>Produktionsboost 2×</b><small>${boostActive ? 'Aktiv · noch ' + boostLeftText() : 'Verdoppelt die Produktion. Stapelbar bis 4 Std.'}</small></div><div class="shop-buttons">` +
      `<button data-shop-action="boost-token" ${meta.boostTokens ? '' : 'disabled'}>Token · 30 Min. (${meta.boostTokens})</button>` +
      `<button data-shop-action="boost-gems" ${state.gems >= BOOST_GEM_COST ? '' : 'disabled'}>◆ ${BOOST_GEM_COST} · 30 Min.</button>` +
      (adReady('boost')
        ? `<button class="ad-button" data-shop-action="boost-ad">${adLabel('boost', '15 Min.')}</button>`
        : '') +
      `</div></div>` +
      `<div class="shop-item"><div><b>Zeitsprung 1 Std.</b><small>Sofort 1 Stunde Produktion: ca. +${fmt(hourValue)} ◈</small></div><div class="shop-buttons"><button data-shop-action="warp" ${state.gems >= TIME_WARP_GEM_COST && hourValue > 0 ? '' : 'disabled'}>◆ ${TIME_WARP_GEM_COST}</button></div></div>`;
    if (state.expeditionEnd > Date.now()) {
      const cost = Math.max(1, Math.ceil((state.expeditionEnd - Date.now()) / 30000));
      html += `<div class="shop-item"><div><b>Expedition beenden</b><small>Kehrt sofort mit Beute zurück</small></div><div class="shop-buttons"><button data-shop-action="expedition-gems" ${state.gems >= cost ? '' : 'disabled'}>◆ ${cost}</button></div></div>`;
    }
    html +=
      '<p class="shop-note">Gems erhältst du auch kostenlos: Bosse, Tagesversorgung, Aufträge, Ereignisse und die Sternenroute.</p>';
  } else if (shopTab === 'offers') {
    html = storeReady
      ? Commerce.CATALOG.filter(item => item.id !== 'nh_season_pass')
          .map(item => {
            const owned = item.kind === 'non-consumable' && Commerce.owns(meta, item.id);
            const art = window.NebulaArt?.productArtURL?.(item.id);
            return `<div class="shop-item offer ${owned ? 'owned' : ''}">${art ? `<img class="offer-art" src="${art}" alt="" />` : ''}<div><b>${item.title}${item.highlight ? ` <em>${item.highlight}</em>` : ''}</b><small>${item.lines.join(' · ')}</small></div><div class="shop-buttons"><button data-buy-product="${item.id}" ${owned || !Commerce.store.price(item.id) ? 'disabled' : ''}>${owned ? 'GEKAUFT' : Commerce.store.price(item.id) || 'PREIS LÄDT …'}</button></div></div>`;
          })
          .join('')
      : '<p class="shop-note">Käufe sind in dieser Version derzeit nicht verfügbar. Alle Spielinhalte bleiben ohne Kauf erreichbar.</p>';
    if (storeReady && Commerce.store.name === 'mock')
      html = '<p class="shop-note warn">TEST-STORE: Es wird kein echtes Geld abgebucht.</p>' + html;
  } else {
    const owned = meta.cosmetics;
    html = owned.length
      ? owned
          .map(id => {
            const item = Commerce.COSMETICS[id],
              equipped = meta.equipped[item.slot] === id;
            return `<div class="shop-item"><div><b>${item.icon} ${item.name}</b><small>${{ ship: 'Schiff', ring: 'Planetenring', trail: 'Drohnenspur', mochi: 'Mochi-Accessoire', glider: 'Tikkis Gleiter', impact: 'Trefferfunken', engine: 'Triebwerksspur' }[item.slot]}</small></div><div class="shop-buttons"><button data-equip="${id}">${equipped ? 'ABLEGEN' : 'AUSRÜSTEN'}</button></div></div>`;
          })
          .join('')
      : '<p class="shop-note">Noch keine Kosmetik. Sie stammt aus der Sternenroute, der Sternenschmiede (Sternsplitter, im Arsenal) und optionalen Paketen – rein optisch, ohne Spielvorteil.</p>';
  }
  setHTML($('shopPanel'), html);
  $('restorePurchases').classList.toggle('hidden', !storeReady);
  $('devPanel').classList.toggle('hidden', !window.NEBULA_CONFIG?.devTools);
}
function openShop(tab = shopTab) {
  shopTab = tab;
  renderShop();
  openModal('shopModal');
}
$('gemsButton').onclick = () => openShop('offers');
$('boostButton').onclick = () => openShop('boost');
$('seasonCard').onclick = () => {
  renderSeason();
  openModal('seasonModal');
};
$('seasonBuy').onclick = () => buyProduct('nh_season_pass');
document.addEventListener('click', event => {
  const tab = event.target.closest('[data-shop-tab]');
  if (tab) {
    shopTab = tab.dataset.shopTab;
    renderShop();
  }
  const productButton = event.target.closest('[data-buy-product]');
  if (productButton) buyProduct(productButton.dataset.buyProduct);
  const equip = event.target.closest('[data-equip]');
  if (equip) {
    const item = Commerce.COSMETICS[equip.dataset.equip];
    if (item && state.meta.cosmetics.includes(equip.dataset.equip)) {
      state.meta.equipped[item.slot] =
        state.meta.equipped[item.slot] === equip.dataset.equip ? null : equip.dataset.equip;
      applyCosmetics();
      save();
      renderShop();
    }
  }
  const claim = event.target.closest('[data-season-claim]');
  if (claim) {
    const [track, tier] = claim.dataset.seasonClaim.split(':');
    claimSeasonTier(track, +tier);
  }
  const action = event.target.closest('[data-shop-action]')?.dataset.shopAction;
  if (!action) return;
  if (action === 'boost-token' && state.meta.boostTokens > 0) {
    state.meta.boostTokens--;
    addBoost(30);
    feedback('upgrade', 'medium');
    toast('Produktionsboost aktiv: noch ' + boostLeftText());
  } else if (action === 'boost-gems' && state.gems >= BOOST_GEM_COST) {
    state.gems -= BOOST_GEM_COST;
    addBoost(30);
    feedback('upgrade', 'medium');
    toast('Produktionsboost aktiv: noch ' + boostLeftText());
  } else if (action === 'boost-ad') {
    runRewardedPlacement('boost', () => {
      addBoost(15);
      toast('Produktionsboost aktiv: noch ' + boostLeftText());
    }).then(() => renderShop());
    return;
  } else if (action === 'warp' && state.gems >= TIME_WARP_GEM_COST) {
    state.gems -= TIME_WARP_GEM_COST;
    const gained = timeWarp(60);
    feedback('reward', 'success');
    toast('Zeitsprung: +' + fmt(gained) + ' Credits');
  } else if (action === 'expedition-gems' && state.expeditionEnd > Date.now()) {
    const cost = Math.max(1, Math.ceil((state.expeditionEnd - Date.now()) / 30000));
    if (state.gems < cost) return;
    state.gems -= cost;
    state.expeditionEnd = Date.now();
    gameTick();
  } else return;
  save();
  render();
  renderShop();
});
$('restorePurchases').onclick = async () => {
  const result = await Commerce.store.restore();
  // Non-consumables no longer owned at the store (refund/chargeback) lose their entitlement.
  if (result?.owned)
    Commerce.CATALOG.filter(item => item.kind === 'non-consumable' && !result.owned.includes(item.id)).forEach(item => {
      if (Commerce.revokeProduct(state.meta, item.id)) toast(item.title + ' wurde erstattet und entfernt.');
    });
  save();
  render();
  renderShop();
  toast('Käufe abgeglichen.');
};
// Developer-only helpers (local dev hosts / dev builds).
$('freeGems').onclick = () => {
  if (!window.NEBULA_CONFIG?.devTools) return;
  state.gems += 25;
  render();
  renderShop();
};
$('devCompletePending').onclick = async () => {
  if (!window.NEBULA_CONFIG?.devTools || !Commerce.store.completePending) return;
  toast((await Commerce.store.completePending()) + ' ausstehende Käufe abgeschlossen.');
};
$('devRefund').onclick = () => {
  if (!window.NEBULA_CONFIG?.devTools || !Commerce.store.refund) return;
  Commerce.store.refund('nh_commander_edition');
  toast('Erstattung simuliert. „Käufe wiederherstellen“ gleicht ab.');
};
$('devSeasonXp').onclick = () => {
  if (!window.NEBULA_CONFIG?.devTools) return;
  currentSeason();
  state.meta.season.xp = Math.min(Commerce.SEASON_TIERS * Commerce.SEASON_TIER_XP, state.meta.season.xp + 300);
  render();
  toast('+300 Saison-XP');
};
Commerce?.init().then(() => {
  if (topModal() === 'shopModal') renderShop();
});
$('dailyButton').onclick = () => {
  $('dailyModal').classList.remove('hidden');
  $('dailyDay').textContent = state.dailyDay;
};
document.querySelector('.close-daily').onclick = () => $('dailyModal').classList.add('hidden');
$('claimDaily').onclick = () => {
  if (Date.now() - state.lastDaily < 86400000) {
    toast('Komm morgen wieder vorbei!');
    return;
  }
  const isFinalDay = state.dailyDay === 7;
  const reward = 75 * state.dailyDay;
  earn(reward);
  if (isFinalDay) state.gems += 5;
  state.lastDaily = Date.now();
  seasonXp('daily');
  state.dailyDay = (state.dailyDay % 7) + 1;
  render();
  $('dailyModal').classList.add('hidden');
  feedback('reward', 'success');
  toast('Tagesbelohnung: +' + reward + ' Credits' + (isFinalDay ? ' und 5 Gems!' : ''));
};
$('spinButton').onclick = () => {
  if (Date.now() < state.spinAt) {
    toast('Der Scanner kalibriert noch.');
    return;
  }
  state.spinAt = Date.now() + 3600000;
  const rewards = [
    [150, 'Credits'],
    [10, 'Erz'],
    [1, 'Kristall']
  ];
  const r = rewards[(state.dailyDay - 1) % rewards.length];
  if (r[1] === 'Credits') earn(r[0]);
  else if (r[1] === 'Erz') state.ore += r[0];
  else state.crystals += r[0];
  toast('Signal empfangen: +' + r[0] + ' ' + r[1]);
  render();
};
$('expeditionButton').onclick = () => {
  if (state.expeditionEnd > Date.now()) return;
  if (state.fuel < 5) {
    toast('Du brauchst 5 Treibstoff');
    return;
  }
  state.fuel -= 5;
  state.expeditionEnd = Date.now() + expeditionDuration();
  render();
  feedback('launch', 'medium');
  toast('Expedition gestartet!');
};
$('surveyButton').onclick = () => {
  const target = PLANETS.findIndex((_, index) => !state.planetsUnlocked[index]),
    scanCost = scanFuelCost();
  if (target < 0 || state.surveyEnd > Date.now()) return;
  const planet = PLANETS[target];
  if (state.totalEarned < planet.unlock) {
    toast('Mehr verdiente Credits für diesen Kurs nötig');
    return;
  }
  if (state.fuel < scanCost) {
    toast('Du brauchst ' + scanCost + ' Treibstoff');
    return;
  }
  state.fuel -= scanCost;
  state.surveyTarget = target;
  state.surveyEnd = Date.now() + (BALANCE.planetSurveyMinutes[target] || 1) * 60000 * scanTimeMultiplier();
  render();
  toast('Langstreckenscan zu ' + planet.name + ' gestartet!');
};
$('crewSlotButton').onclick = () => {
  const requirement = crewSlotRequirement();
  if (!requirement || !requirement.ready || state.credits < requirement.credits || state.alloys < requirement.alloys)
    return;
  state.credits -= requirement.credits;
  state.alloys -= requirement.alloys;
  state.crewSlots++;
  render();
  showPlanetMilestone('♙', requirement.label + ' FREIGESCHALTET', 'Ein weiterer Commander kann aktiv werden.');
  toast(requirement.label + ' freigeschaltet!');
};
$('gateButton').onclick = () => {
  const requirement = gateRequirement();
  if (
    !requirement ||
    state.credits < requirement.credits ||
    state.ore < requirement.ore ||
    state.alloys < requirement.alloys ||
    !requirement.ready
  )
    return;
  state.credits -= requirement.credits;
  state.ore -= requirement.ore;
  state.alloys -= requirement.alloys;
  state.jumpGate++;
  seasonXp('gate');
  render();
  showPlanetMilestone('◌', 'SPRUNGTOR PHASE ' + state.jumpGate, requirement.label + ' freigeschaltet.');
  toast('Sprungtor-Bauphase abgeschlossen!');
};
let bossPhaseCheck = null;
$('aimButton').onclick = () => {
  if (state.aimReady || Date.now() < state.aimCooldownUntil || state.fuel < 1) return;
  state.fuel--;
  state.aimReady = true;
  state.aimCooldownUntil = Date.now() + 20000;
  render();
  toast('Zielmodus: Der nächste Treffer verursacht +65% Schaden!');
};
$('battleButton').addEventListener(
  'click',
  () => {
    const foe = enemyInfo();
    bossPhaseCheck = { level: state.enemyLevel, shouldAward: foe.boss && state.enemyHp > enemyMaxHp() / 2 };
  },
  true
);
$('battleButton').addEventListener('click', () => {
  if (state.aimReady) {
    state.aimReady = false;
    render();
  }
});
$('battleButton').addEventListener('click', () => {
  if (bossPhaseCheck?.shouldAward && state.enemyLevel === bossPhaseCheck.level && state.enemyHp <= enemyMaxHp() / 2) {
    state.crystals++;
    render();
    GameEvents.emit('boss-phase', { level: state.enemyLevel });
    toast('Boss-Kern freigelegt: +1 Kristall und Phase 2!');
  }
  bossPhaseCheck = null;
});
let factionClaimTarget = null;
$('battleButton').addEventListener('pointerdown', () => {
  factionClaimTarget = warActive() ? state.activePlanet : null;
});
$('battleButton').addEventListener('click', () => {
  if (
    factionClaimTarget !== null &&
    state.faction.territory[factionClaimTarget] === state.faction.joined &&
    state.faction.influence[factionClaimTarget] === 0 &&
    !state.faction.claimed[factionClaimTarget]
  ) {
    state.faction.claimed[factionClaimTarget] = true;
    render();
    showPlanetMilestone('⚑', 'GEBIET GESICHERT', 'Fraktionsrang ' + factionRank() + ' ist jetzt aktiv.');
  }
  factionClaimTarget = null;
});
const heroScene = $('heroCard');
heroScene.addEventListener('pointermove', event => {
  const rect = heroScene.getBoundingClientRect(),
    x = (event.clientX - rect.left) / rect.width - 0.5,
    y = (event.clientY - rect.top) / rect.height - 0.5;
  heroScene.style.setProperty('--scene-x', (x * 7).toFixed(2) + 'deg');
  heroScene.style.setProperty('--scene-y', (-y * 6).toFixed(2) + 'deg');
});
heroScene.addEventListener('pointerleave', () => {
  heroScene.style.setProperty('--scene-x', '0deg');
  heroScene.style.setProperty('--scene-y', '0deg');
});
const battleScene = $('enemyCard');
battleScene.addEventListener('pointermove', event => {
  const rect = battleScene.getBoundingClientRect(),
    x = (event.clientX - rect.left) / rect.width - 0.5,
    y = (event.clientY - rect.top) / rect.height - 0.5;
  battleScene.style.setProperty('--battle-x', (x * 3).toFixed(2) + 'deg');
  battleScene.style.setProperty('--battle-y', (-y * 2).toFixed(2) + 'deg');
});
battleScene.addEventListener('pointerleave', () => {
  battleScene.style.setProperty('--battle-x', '0deg');
  battleScene.style.setProperty('--battle-y', '0deg');
});
function resolveEvent(accept) {
  const event = EVENTS.find(item => item.id === state.activeEvent);
  if (!event) return;
  if (accept && event.id === 'signal') {
    if (state.fuel < 3) {
      toast('Du brauchst 3 Treibstoff');
      return;
    }
    state.fuel -= 3;
    state.gems++;
    state.crystals++;
  } else if (accept && event.id === 'market') {
    if (state.ore < 20) {
      toast('Du brauchst 20 Erz');
      return;
    }
    state.ore -= 20;
    state.crystals += 2;
  } else if (accept && event.id === 'boom') {
    state.eventBoostUntil = Date.now() + 60000;
  }
  state.activeEvent = null;
  state.nextEventAt = Date.now() + 180000;
  render();
  toast(accept ? event.title + ' genutzt!' : 'Ereignis ignoriert.');
}
$('eventAction').onclick = () => resolveEvent(true);
$('eventIgnore').onclick = () => resolveEvent(false);
function prestigeGain() {
  return Math.floor(Math.sqrt(state.totalEarned / BALANCE.prestigeDivisor));
}
function spentStardust() {
  return STAR_UPGRADES.reduce((sum, upgrade, index) => {
    const level = state.stars[index] || 0;
    let total = 0;
    for (let l = 0; l < level; l++)
      total += upgrade.growth === 'square' ? upgrade.base * (l + 1) * (l + 1) : upgrade.base + l;
    return sum + total;
  }, 0);
}
function performPrestige() {
  const gain = prestigeGain();
  if (gain < 1) return false;
  // Account-level progress survives; the colony itself restarts. Daily timers are kept so a reset cannot re-arm them.
  const keep = {
    gems: state.gems,
    stardust: state.stardust + gain,
    stars: [...state.stars],
    galaxiesSold: state.galaxiesSold + 1,
    itemDiscoveries: [...state.itemDiscoveries],
    introSeen: true,
    quests: [...state.quests],
    dailyDay: state.dailyDay,
    lastDaily: state.lastDaily,
    spinAt: state.spinAt,
    meta: state.meta,
    staffContracts: state.colonies.map(colony => ({ ...colony.staff })),
    reserveSettings: state.colonies.map(colony => ({ ...colony.reserve })),
    rootSettings: state.colonies.map(colony => ({ slots: [...(colony.roots?.slots || [])] })),
    fabStats: state.fabStats, // Beta 1.4: learned recipes (production totals) stay; goods and orders restart with the colony
    lastSeen: Date.now(),
    paidUntil: state.paidUntil,
    nextEventAt: Date.now() + 180000,
    strategicNextAt: Date.now() + 600000
  };
  state = normalizeState(keep);
  const capital = [0, 2000, 15000, 120000, 1000000, 8000000][starLevel('capital')] || 0;
  state.credits += capital;
  for (let planet = 1; planet <= starLevel('archive'); planet++) {
    state.planetsUnlocked[planet] = true;
    foundColony(planet);
  }
  for (let tech = 0; tech < starLevel('legacy'); tech++) state.research[tech] = true;
  seasonXp('prestige');
  feedback('prestige', 'heavy');
  offlineMode = false;
  lastTickAt = Date.now();
  save();
  render();
  toast('Neue Galaxie – ' + gain + ' Sternenstaub erhalten. Dein Artefakt-Archiv bleibt erhalten!');
  return true;
}
$('prestigeButton').onclick = () => {
  const gain = prestigeGain();
  if (gain < 1) return;
  $('prestigeConfirmGain').textContent = gain;
  openModal('prestigeModal');
};
$('prestigeConfirm').onclick = () => {
  closeModal('prestigeModal');
  performPrestige();
};
const intro = [
  [
    'Ein Funkeln im Staub',
    'Hallo! Ich bin Mochi. Ich habe einen alten Sternkompass gefunden – und dieses Kristallfeld auf Orion! Unten findest du die Kette ABBAUEN → LORE → VERKAUF. Probier sie einmal aus: Das bringt deine ersten Credits.'
  ],
  [
    'Eine kleine Kolonie',
    'Aus Kristallen bauen wir Hütten, Lager und Maschinen. Alles Gebaute arbeitet weiter, auch wenn du nicht da bist. Wische über die Kolonie, um dich umzusehen.'
  ],
  [
    'Das stille Schnurrnetz',
    'Der Kompass zeigt auf einen beschädigten Lichtanker. Früher verband das Schnurrnetz sechs Welten miteinander … vielleicht können wir es wieder zum Leuchten bringen!'
  ]
];
let introIndex = 0;
function introRender() {
  const x = intro[introIndex];
  $('introStep').textContent = 'KAPITEL 1 · ' + (introIndex + 1) + '/3';
  $('introTitle').textContent = x[0];
  $('introText').textContent = x[1];
  $('introNext').textContent = introIndex === 2 ? 'LOS GEHT’S' : 'WEITER';
}
$('introNext').onclick = () => {
  if (introIndex < 2) {
    introIndex++;
    introRender();
  } else {
    state.introSeen = true;
    render();
    $('introModal').classList.add('hidden');
  }
};
$('introSkip').onclick = () => {
  state.introSeen = true;
  render();
  $('introModal').classList.add('hidden');
};
setInterval(() => {
  const now = Date.now();
  if (state.sectorScanEnd && state.sectorScanEnd <= now) {
    const index = state.sectorScanTarget,
      sector = SECTORS[index];
    state.sectorScanEnd = 0;
    state.sectorScanTarget = null;
    if (sector) {
      seasonXp('scan');
      state.sectorScans[index] = Math.min(sector.scans, state.sectorScans[index] + 1);
      render();
      toast(sector.name + ': Scanprofil ' + state.sectorScans[index] + '/' + sector.scans + ' gesichert.');
    }
  }
  if (state.sectorExpedition && state.sectorExpedition.end <= now) {
    const mission = state.sectorExpedition,
      sector = SECTORS[mission.target];
    state.sectorExpedition = null;
    if (sector) {
      state.sectorUnlocked[mission.target] = true;
      seasonXp('sector');
      const credits = (mission.target + 1) * 1800 * (mission.risk === 'risk' ? 1.5 : 1);
      earn(credits);
      if (mission.risk) {
        state.contracts.riskyExpeditions++;
        state.alloys += mission.target + 2;
        state.crystals++;
      } else state.fuel += 2;
      render();
      showPlanetMilestone(sector.icon, 'SEKTOR GESICHERT', sector.interest);
      toast(
        sector.name +
          ' erkundet: +' +
          fmt(credits) +
          ' Credits' +
          (mission.risk ? ' · seltene Legierungen' : ' · +2 Treibstoff')
      );
    }
  }
}, 1000);
// 4 h base; the Commander Edition extends it to 8 h (convenience, not power).
function offlineCapSeconds() {
  return (
    (BALANCE.offlineHoursBase +
      starLevel('longsleep') +
      (state.meta?.entitlements?.commanderEdition ? 4 : 0) +
      2 * academyRank('deepsleep')) *
    3600
  );
}
// Gaps longer than this between two ticks are treated as absence (app suspended, tab hidden, device asleep).
let RESUME_GAP_SECONDS = 20;
function offlineEfficiency() {
  return Math.min(BALANCE.offlineEfficiencyCap, BALANCE.offlineEfficiencyBase + starLevel('sleep') * 0.1);
}
// Converts delivered ore throughput into whole ore/fuel units without losing fractions between ticks.
function fuelTankCapacity() {
  return (
    BALANCE.fuelTankBase +
    BALANCE.fuelTankPerPlanet * state.planetsUnlocked.filter(Boolean).length +
    BALANCE.fuelTankPerGate * state.jumpGate +
    30 * starLevel('fuel')
  );
}
// Fuel per second of production at the given delivery rate.
function fuelRate(delivery) {
  return BALANCE.fuelPerSqrtDelivery * Math.sqrt(Math.max(0, delivery)) * (1 + 0.25 * starLevel('fuel'));
}
function addFlow(delivered, seconds = 1) {
  state.flowCarry.ore += delivered / 20;
  state.flowCarry.fuel += state.fuel < fuelTankCapacity() ? fuelRate(delivered / Math.max(1, seconds)) * seconds : 0;
  const ore = Math.floor(state.flowCarry.ore),
    fuel = Math.floor(state.flowCarry.fuel);
  state.ore += ore;
  state.fuel = Math.max(state.fuel, Math.min(fuelTankCapacity(), state.fuel + fuel));
  state.flowCarry.ore -= ore;
  state.flowCarry.fuel -= fuel;
  return { ore, fuel };
}
function applyOfflineProgress(seconds) {
  if (!(seconds > 15)) return null;
  const away = Math.min(seconds, offlineCapSeconds()),
    creditsBefore = state.credits,
    fuelBefore = state.fuel;
  let delivered = 0;
  offlineMode = true;
  try {
    delivered = runProduction(away, offlineEfficiency());
    // Construction keeps going beyond the offline cap (no production for that part).
    if (seconds > away) forEachColony(index => advanceConstruction(seconds - away, index));
  } finally {
    offlineMode = false;
  }
  const flow = addFlow(delivered, away);
  if (Commerce) {
    currentSeason();
    state.meta.season.rested = Math.min(
      Commerce.SEASON_RESTED_CAP,
      (state.meta.season.rested || 0) + Math.floor((away / 3600) * Commerce.SEASON_RESTED_PER_HOUR)
    );
  }
  return {
    seconds,
    counted: away,
    capped: seconds > offlineCapSeconds(),
    credits: state.credits - creditsBefore,
    ...flow,
    fuel: Math.max(0, state.fuel - fuelBefore)
  };
}
function showOfflineReport(report) {
  if (!report || report.credits < 1) return;
  const minutes = Math.max(1, Math.round(report.counted / 60)),
    duration = minutes >= 60 ? Math.floor(minutes / 60) + ' Std. ' + (minutes % 60) + ' Min.' : minutes + ' Min.';
  $('welcomeDuration').textContent =
    duration + (report.capped ? ' (Maximum ' + Math.round(offlineCapSeconds() / 3600) + ' Std.)' : '');
  $('welcomeCredits').textContent = '+' + fmt(report.credits);
  $('welcomeOre').textContent = '+' + fmt(report.ore);
  $('welcomeFuel').textContent = '+' + fmt(report.fuel);
  $('welcomeRate').textContent = Math.round(offlineEfficiency() * 100) + '% Offline-Effizienz';
  lastOfflineReport = { ...report, doubled: false };
  renderWelcomeDouble();
  openModal('welcomeModal');
}
let lastTickAt = Date.now();
function gameTick() {
  updateStory();
  mochiHelp();
  const now = Date.now(),
    elapsed = (now - lastTickAt) / 1000;
  lastTickAt = now;
  if (elapsed > RESUME_GAP_SECONDS) {
    // absence: only the part after the paid mark counts (E-01)
    const unpaid = Math.min(elapsed, (now - (state.paidUntil || 0)) / 1000);
    state.paidUntil = Math.max(state.paidUntil || 0, now);
    showOfflineReport(applyOfflineProgress(unpaid));
  } else if (elapsed > 0) {
    addFlow(runProduction(elapsed), elapsed);
    // live play moves the mark by real time, also while the device clock is behind it
    state.paidUntil = Math.max((state.paidUntil || 0) + elapsed * 1000, now);
  }
  if (!state.activeEvent && state.totalEarned >= 1200 && Date.now() >= state.nextEventAt) {
    state.activeEvent = EVENTS[Math.floor(Date.now() / 180000) % EVENTS.length].id;
    toast('Neues Sektor-Ereignis!');
  }
  // Boba keeps fighting while the player is elsewhere in the app; on the battle screen the ship's gun clock fires
  // (combat-gun.js) and a paused wave waits for the player (one clock at a time, no double fire)
  if (state.autoBattle && autoAttack() && !gunOwnsShots() && !campaignRunning()) {
    $('battleButton').click();
  }
  if (state.expeditionEnd && state.expeditionEnd <= Date.now()) {
    state.expeditionEnd = 0;
    state.expeditionsComplete++;
    seasonXp('expedition');
    state.crystals += 3;
    state.fuel += 2;
    const expeditionCredits = 400 + galacticDeliveryRate() * 90;
    earn(expeditionCredits);
    feedback('reward', 'success');
    toast('Expedition zurück: +3 Kristalle, +2 Treibstoff, +' + fmt(expeditionCredits) + ' Credits!');
  }
  if (state.surveyEnd && state.surveyEnd <= Date.now()) {
    const planet = PLANETS[state.surveyTarget];
    state.surveyEnd = 0;
    state.surveyTarget = null;
    if (planet) {
      state.planetsUnlocked[PLANETS.indexOf(planet)] = true;
      foundColony(PLANETS.indexOf(planet));
      state.activePlanet = PLANETS.indexOf(planet);
      showPlanetDiscovery(planet);
      toast('Neuer Planet entdeckt: ' + planet.name + '!');
    }
  }
  render();
}
// ======================================================================================================
// Living Worlds: colony view, building sheet, story, welcome capsule and the P.I.P.S. liberation (Orion)
const BUILDING_INFO = [
  { title: 'Kristallmine', role: 'Fördert Erz und Kristalle. Ab Lv 5 Mini-Bohrer, ab 15 Bohrturm, ab 25 Großbohrer mit Förderband.' },
  { title: 'Helferhütte', role: 'Helfer-Kätzchen fördern mit und tragen Kristalle zum Lager. Mehr Stufen = mehr Helfer.' },
  { title: 'Lagerhaus', role: 'Mehr Lagerplatz (+180 je Stufe) und Verarbeitung. Ab Lv 15 Lastenlift, ab 25 Raffinerie.' },
  { title: 'Frachtdock', role: 'Frachter bringen Ware zum Markt (+115 Transport je Stufe). Mit Funkantenne.' }
];
// Levels at which a building visibly changes (construction animation).
const VISUAL_STAGES = [[5, 15, 25, 50], [10, 25], [10, 15, 25], [5, 15]];
function colonyHelperCount(level) {
  return level > 0 ? Math.min(6, 1 + Math.floor(level / 5)) : 0;
}
function pips() {
  return state.meta.guardians.pips;
}
function pipsFriendly() {
  return state.meta?.guardians?.pips?.stage === 'repaired';
}
function welcomeState() {
  if (state.meta.welcome) return 'claimed';
  return state.totalEarned >= 250 || state.buildings[0].level >= 3 || state.galaxiesSold > 0 ? 'available' : 'locked';
}
window.NebulaView.colony = () => {
  const base = window.NebulaView.harvest();
  return {
    ...base,
    buildings: state.buildings.map(b => b.level),
    helperCount: colonyHelperCount(state.buildings[1].level),
    ship: { ...state.ship },
    cosmeticShip: state.meta?.equipped?.ship || null,
    capsule: welcomeState(),
    pips: state.activePlanet === 0 ? pips().stage : null,
    liberated: state.meta.story.liberated.includes(state.activePlanet),
    mochiAccessories: [state.meta.equipped.mochi, state.meta.equipped.outfit].filter(Boolean),
    cosmeticColony: state.meta.equipped.colony || null
  };
};
const baseCombatView = window.NebulaView.combat;
window.NebulaView.combat = () => {
  const view = baseCombatView(),
    p = pips(),
    now = Date.now();
  if (p.stage === 'battle')
    return { ...view, enemyHp: p.hp, enemyMax: p.maxHp, boss: false, story: { mode: 'pips', shielded: pipsShielded(now), telegraph: pipsTelegraph(now) } };
  if (p.stage === 'warned' && !campaignLeadsTo('pips')) return { ...view, story: { mode: 'drone' } };
  return view;
};

// ----- Building sheet (tap a building/plot in the colony) -----
let openSheetIndex = null;
function buildingEffectText(b, i) {
  const gain = (level, per) => level * per * buildingMultiplier(level);
  if (i === 2) return 'Lager ' + fmt(gain(b.level, 180) + 80) + ' → ' + fmt(gain(b.level + 1, 180) + 80);
  if (i === 3) return 'Transport ' + fmt(gain(b.level, 115) + 18) + ' → ' + fmt(gain(b.level + 1, 115) + 18) + ' Erz/s';
  const now = buildingOutput(b) * managerBonus() * starBonus(),
    next = buildingOutput({ ...b, level: b.level + 1 }) * managerBonus() * starBonus();
  return 'Förderung ' + fmt(now) + ' → ' + fmt(next) + ' Erz/s' + (i === 1 ? ' · Helfer ' + colonyHelperCount(b.level) + ' → ' + colonyHelperCount(b.level + 1) : '');
}
function openBuildingSheet(index) {
  openSheetIndex = index;
  feedback('open');
  renderBuildingSheet();
}
function renderBuildingSheet() {
  const sheet = $('buildingSheet');
  if (!sheet) return;
  if (openSheetIndex === null || currentScreen() !== 'home') {
    sheet.classList.add('hidden');
    return;
  }
  if (typeof renderIndustrySheet === 'function') return renderIndustrySheet(sheet, openSheetIndex);
  const i = openSheetIndex,
    b = state.buildings[i],
    info = BUILDING_INFO[i],
    c = cost(b),
    affordable = state.credits >= c,
    milestone = nextMilestoneLevel(b.level);
  setHTML(
    sheet,
    `<button class="sheet-close" data-close-sheet aria-label="Schließen">×</button><div class="sheet-head"><span>${b.icon}</span><div><b>${b.level ? info.title + ' · Lv ' + b.level : info.title + ' bauen'}</b><small>${info.role}</small></div></div><p class="sheet-effect">${buildingEffectText(b, i)} · nächster Meilenstein Lv ${milestone}</p>${b.level && typeof batchButtonHTML === 'function' ? batchToggleHTML() + batchButtonHTML('building', i, null, 'data-buy="' + i + '"', 'sheet-buy', 'VERBESSERN · ') : `<button class="sheet-buy ${affordable ? 'affordable' : ''}" data-buy="${i}" ${affordable ? '' : 'disabled'}>${b.level ? 'VERBESSERN' : 'BAUEN'} · ◈ ${fmt(c)}${affordable ? '' : ' (noch ' + fmt(c - state.credits) + ')'}</button>`}`
  );
  sheet.classList.remove('hidden');
}
document.addEventListener('click', event => {
  if (event.target.closest('[data-close-sheet]')) {
    openSheetIndex = null;
    renderBuildingSheet();
  }
});

// ----- Story: short skippable dialogue bubbles + journal (meta.story, survives prestige) -----
const STORY = {
  welcome: { title: 'Willkommenskapsel', lines: [['mochi', 'Oh! Eine kleine Kapsel im Kristallstaub … mit einem Geschenk für mich!']] },
  'built-1': { title: 'Die erste Helferhütte', lines: [['mochi', 'Juhu, Verstärkung! Zusammen tragen wir doppelt so viele Kristalle.']] },
  'built-2': { title: 'Das Lagerhaus', lines: [['mochi', 'Endlich ein Lager! Jetzt geht kein Kristall mehr verloren.']] },
  'built-3': {
    title: 'Die alte Funkantenne',
    lines: [
      ['pip', 'Das Frachtdock steht – und die alte Funkantenne funktioniert wieder!'],
      ['mochi', 'Hörst du das? Da piepst etwas …']
    ]
  },
  'scan-noticed': {
    title: 'Ein Echo im Scanner',
    lines: [
      ['pip', 'Der Langstreckenscanner läuft … Moment, da kommt ein Signal zurück!'],
      ['mochi', 'Jemand hat unseren Scan bemerkt?']
    ]
  },
  'pips-warning': {
    title: 'M.O.T.T.E. meldet sich',
    lines: [
      ['pips', 'ACHTUNG! Hier spricht P.I.P.S., Planetare Inspektions-Patrouille im Auftrag von M.O.T.T.E.'],
      ['pips', 'Unautorisierter Kristallabbau festgestellt! Bitte Genehmigung vorlegen. Formular 7-B. In dreifacher Ausfertigung.'],
      ['mochi', 'Genehmigung? Hier war doch seit dem Großen Schweigen niemand mehr …'],
      ['boba', 'Seine Inspektionsdrohnen kommen. Ich hole das Schiff – im Abenteuer-Tab!']
    ]
  },
  'pips-arrives': {
    title: 'P.I.P.S. persönlich',
    lines: [
      ['pips', 'Inspektion eskaliert! Ich schalte mein Prüfschild ein. Bitte stillhalten!'],
      ['boba', 'Sein Schild flackert beim Scannen. Der Zielmodus kommt durch!']
    ]
  },
  'pips-defeated': {
    title: 'P.I.P.S. ist offline',
    lines: [
      ['mochi', 'Er ist nur erschöpft … und seine Daten sind uralt. Tikki, können wir ihn reparieren?'],
      ['tikki', 'Mit etwas Erz und ein paar Kristallen bekomme ich seine Software wieder hin!']
    ]
  },
  'pips-repaired': {
    title: 'Ein neuer Freund',
    lines: [
      ['pips', 'Neustart abgeschlossen … Oh! Ihre Kolonie ist vollständig legitim. Ich bitte um Entschuldigung.'],
      ['pips', 'Darf ich bleiben? Ich bin hervorragend im Prüfen von Kristallen.'],
      ['mochi', 'Willkommen in der Familie, P.I.P.S.!']
    ]
  }
};
const SPEAKERS = { mochi: 0, boba: 1, miso: 2, pip: 3, lumi: 4, nori: 5, tikki: 6, poppy: 7 };
let storyQueue = [];
function storyEvent(id) {
  if (!STORY[id] || state.meta.story.journal.includes(id)) return;
  state.meta.story.journal.push(id);
  storyQueue.push(...STORY[id].lines);
  GameEvents.emit('story', { id });
  requestSave(200);
  showNextStoryLine();
}
function showNextStoryLine() {
  const bubble = $('storyBubble');
  if (!bubble) return;
  const line = storyQueue.shift();
  if (!line) {
    bubble.classList.add('hidden');
    return;
  }
  const [speaker, text] = line,
    index = SPEAKERS[speaker],
    extra = window.StorySpeakers?.[speaker];
  const portrait = extra
    ? extra.portrait()
    : index !== undefined
      ? window.SpaceKittens?.portraitURL(index, speaker === 'mochi' ? 'happy' : 'neutral', 96, index === 0 ? [state.meta.equipped.mochi, state.meta.equipped.outfit].filter(Boolean) : null)
      : speaker === 'pips'
        ? window.NebulaArt?.botPortraitURL?.(pipsFriendly() || pips().stage === 'defeated')
        : '';
  $('storyPortrait').innerHTML = portrait ? `<img src="${portrait}" alt="" />` : '<i class="bot-face">◉</i>';
  $('storySpeaker').textContent = extra ? extra.name : speaker === 'pips' ? 'P.I.P.S.' : state.crew[index]?.name || speaker;
  $('storyText').textContent = text;
  bubble.classList.remove('hidden');
}
$('storyNext').onclick = () => showNextStoryLine();

// ----- Free welcome capsule -----
function claimWelcome() {
  if (state.meta.welcome) return showWelcomeResult();
  if (welcomeState() !== 'available') return;
  const pool = Commerce.WELCOME_POOL,
    item = pool[Math.floor(Math.random() * pool.length)];
  state.meta.welcome = { item, at: Date.now() };
  if (!state.meta.cosmetics.includes(item)) state.meta.cosmetics.push(item);
  state.meta.equipped.mochi = item;
  // The result is committed to storage before it is revealed (no reroll by reloading).
  save();
  feedback('reward', 'success');
  storyEvent('welcome');
  showWelcomeResult();
  render();
}
function showWelcomeResult() {
  const item = state.meta.welcome?.item;
  if (!item) return;
  const cosmetic = Commerce.COSMETICS[item],
    url = window.SpaceKittens?.portraitURL(0, 'happy', 160, [item]);
  $('capsuleArt').innerHTML = url ? `<img src="${url}" alt="Mochi mit ${cosmetic.name}" />` : cosmetic.icon;
  $('capsuleItem').textContent = cosmetic.name;
  $('capsuleEquip').textContent = state.meta.equipped.mochi === item ? 'ABLEGEN' : 'ANLEGEN';
  openModal('capsuleModal');
}

$('capsuleEquip').onclick = () => {
  const item = state.meta.welcome?.item;
  if (!item || !state.meta.cosmetics.includes(item)) return;
  state.meta.equipped.mochi = state.meta.equipped.mochi === item ? null : item;
  $('capsuleEquip').textContent = state.meta.equipped.mochi === item ? 'ABLEGEN' : 'ANLEGEN';
  save();
  render();
};

// ----- P.I.P.S. liberation (Orion vertical slice) -----
function pipsShielded(now = Date.now()) {
  const p = pips();
  if (p.stage !== 'battle' || now < (p.shieldBrokenUntil || 0)) return false;
  const t = ((now - p.fightStart) / 1000) % 7;
  return t >= 2.5 && t < 5;
}
function pipsTelegraph(now = Date.now()) {
  const p = pips(),
    t = ((now - p.fightStart) / 1000) % 7;
  return p.stage === 'battle' && t >= 1.5 && t < 2.5;
}
function countInspectionDrone() {
  const p = pips();
  p.drones = Math.min(2, p.drones + 1);
  if (p.drones >= 2) startPipsFight();
}
// P.I.P.S. steps in himself: after his two drones (old path) or after the last wave of Orion's campaign.
function startPipsFight() {
  const p = pips();
  if (p.stage !== 'warned') return false;
  p.drones = 2;
  p.stage = 'battle';
  p.maxHp = 600 + 80 * state.enemyLevel;
  p.hp = p.maxHp;
  p.fightStart = Date.now();
  storyEvent('pips-arrives');
  requestSave(200);
  return true;
}
function pipsAttack(e) {
  const p = pips(),
    now = Date.now(),
    aimed = state.aimReady,
    shielded = pipsShielded(now),
    base = attack(),
    damage = shielded && !aimed ? base * 0.2 : base;
  // A precision shot breaks the inspection shield for a moment (taught in the dialogue).
  if (shielded && aimed) p.shieldBrokenUntil = now + 2500;
  p.hp = Math.max(0, p.hp - damage);
  GameEvents.emit('attack', {
    damage,
    weapon: state.ship.weaponType,
    aimed,
    overcharge: now < state.overchargeUntil,
    auto: !e.isTrusted,
    boss: true,
    killed: p.hp <= 0,
    level: 'pips',
    shielded
  });
  feedback(shielded && !aimed ? 'deny' : 'hit', e.isTrusted ? 'light' : null);
  if (p.hp <= 0) defeatPips();
}
function defeatPips() {
  const p = pips();
  if (p.stage !== 'battle') return;
  p.stage = 'defeated';
  earn(1500);
  state.crystals += 3;
  state.gems += 5;
  seasonXp('boss');
  GameEvents.emit('enemy-defeated', { boss: true, credits: 1500, rarity: 'epic', dropName: 'P.I.P.S.-Kernmodul', isNew: true, level: 'pips' });
  storyEvent('pips-defeated');
  save();
}
const PIPS_REPAIR = { ore: 120, crystals: 4 };
function repairPips() {
  const p = pips();
  if (p.stage !== 'defeated') return;
  if (state.ore < PIPS_REPAIR.ore || state.crystals < PIPS_REPAIR.crystals) {
    toast('Noch ' + Math.max(0, PIPS_REPAIR.ore - state.ore) + ' Erz und ' + Math.max(0, PIPS_REPAIR.crystals - state.crystals) + ' Kristalle für die Reparatur nötig');
    return;
  }
  state.ore -= PIPS_REPAIR.ore;
  state.crystals -= PIPS_REPAIR.crystals;
  p.stage = 'repaired';
  if (!state.meta.story.liberated.includes(0)) state.meta.story.liberated.push(0);
  window.NebulaAudio?.play('meow');
  feedback('unlock', 'success');
  storyEvent('pips-repaired');
  save();
  render();
}
function updateStory() {
  const p = pips();
  if (p.stage === 'locked' && state.colonies[0].buildings[3].level >= 1) {
    p.stage = 'warned';
    p.drones = 0;
    storyEvent('built-3');
    storyEvent('pips-warning');
  }
}
function renderStoryCard() {
  const card = $('storyCard');
  if (!card) return;
  const p = pips();
  let html = '';
  if (p.stage === 'warned' && campaignLeadsTo('pips'))
    html = `<b>M.O.T.T.E.-Inspektion</b><small>Wehre die Inspektion ab: Welle ${Math.min(campaignCleared('crystal') + 1, CAMPAIGNS.crystal.waves.length)}/${CAMPAIGNS.crystal.waves.length} im Feldzug unten. Nach der letzten Welle stellt sich P.I.P.S. selbst.</small>`;
  else if (p.stage === 'warned')
    html = `<b>M.O.T.T.E.-Inspektion</b><small>Besiege die Inspektionsdrohnen (${p.drones}/2). Dann stellt sich P.I.P.S. selbst.</small>`;
  else if (p.stage === 'battle')
    html = `<b>Wächter: P.I.P.S.</b><small>${pipsTelegraph() ? '⚠ Scan lädt – gleich kommt das Prüfschild!' : pipsShielded() ? '🛡 Prüfschild aktiv: nur 20 % Schaden – Zielmodus durchbricht es.' : 'Verwundbar! Jetzt angreifen.'} · ${fmt(p.hp)} / ${fmt(p.maxHp)}</small>`;
  else if (p.stage === 'defeated')
    html = `<b>P.I.P.S. reparieren</b><small>Tikki kann seine Software retten: ⬡ ${PIPS_REPAIR.ore} · ◆ ${PIPS_REPAIR.crystals}</small><button id="repairPips" ${state.ore >= PIPS_REPAIR.ore && state.crystals >= PIPS_REPAIR.crystals ? '' : 'disabled'}>REPARIEREN</button>`;
  else if (p.stage === 'repaired')
    html = '<b>P.I.P.S. ist dein Freund</b><small>Er prüft Kristalle in der Orion-Kolonie: +15 % Förderung auf Orion, +3 % kritischer Abbau.</small>';
  card.classList.toggle('hidden', !html);
  setHTML(card, html);
  const inspection = p.stage === 'warned' || p.stage === 'battle';
  $('battleKicker').textContent = inspection ? 'ORION · STORY' : 'SEKTOR-VERTEIDIGUNG';
  $('battleTitle').textContent = inspection ? 'Die M.O.T.T.E.-Inspektion' : 'Piratenalarm';
  // During the warning the regular ladder enemies appear as M.O.T.T.E. inspection drones (same HP and rewards).
  if (p.stage === 'warned' && !campaignLeadsTo('pips')) $('enemyName').textContent = 'Inspektionsdrohne ' + Math.min(2, p.drones + 1) + '/2';
  if (p.stage === 'battle') {
    $('enemyName').textContent = 'P.I.P.S. · Inspektionswächter';
    $('enemyHealth').style.width = (p.hp / Math.max(1, p.maxHp)) * 100 + '%';
    $('enemyHealthText').textContent = fmt(p.hp) + ' / ' + fmt(p.maxHp);
    $('battleReward').textContent = '1,5k';
    $('dropPreview').textContent = 'Belohnung: 1.500 ◈, 3 Kristalle, 5 Gems und ein neuer Freund';
  }
}
document.addEventListener('click', event => {
  if (event.target.closest('#repairPips')) repairPips();
});
function renderStoryObjective() {
  const p = pips();
  const goal =
    p.stage === 'warned' || p.stage === 'battle'
      ? ['◉', 'P.I.P.S. stoppt den Abbau!', 'Ein Inspektionsroboter von M.O.T.T.E. hält deine Kolonie für illegal. Zeig ihm, dass ihr bleiben dürft.', 'ABENTEUER ›', 'battle']
      : p.stage === 'defeated'
        ? ['🔧', 'P.I.P.S. reparieren', 'Sein Speicher ist nur veraltet. Repariere ihn mit Erz und Kristallen – danach baut Tikki aus seinen Ersatzteilen ihren Funkengleiter.', 'ABENTEUER ›', 'battle']
        : null;
  if (!goal) return false;
  $('objectiveIcon').textContent = goal[0];
  $('objectiveTitle').textContent = goal[1];
  $('objectiveText').textContent = goal[2];
  $('objectiveAction').textContent = goal[3];
  $('objectiveCard').dataset.screen = goal[4];
  return true;
}
function renderJournal() {
  const list = $('journalList');
  if (!list) return;
  const entries = state.meta.story.journal.filter(id => STORY[id]);
  $('journalCount').textContent = entries.length;
  setHTML(
    list,
    entries.length
      ? entries
          .map(id => `<article class="journal-entry"><b>${STORY[id].title}</b><small>${STORY[id].lines[0][1]}</small></article>`)
          .join('')
      : '<article class="journal-entry"><b>Noch leer</b><small>Hier sammelt Mochi besondere Momente.</small></article>'
  );
}
const colonyActions = {
  mine: () => collect(),
  openBuilding: index => openBuildingSheet(index),
  openCapsule: () => claimWelcome(),
  talk: who => {
    if (who === 'pips') {
      storyQueue.push(['pips', 'Kristallprüfung läuft. Ergebnis: ausgezeichnet! Wie immer.']);
      showNextStoryLine();
    }
  }
};
window.NebulaColonyActions = colonyActions;

{
  sizeConvertedRails();
  const bootNow = Date.now(),
    away = (bootNow - Math.max(state.lastSeen, state.paidUntil || 0)) / 1000;
  lastTickAt = bootNow;
  state.paidUntil = Math.max(state.paidUntil || 0, bootNow);
  const report = applyOfflineProgress(away);
  render();
  if (report) setTimeout(() => showOfflineReport(report), 400);
  if (window.NebulaSave.loadInfo.recovered) setTimeout(() => toast('Spielstand aus Sicherung wiederhergestellt.'), 900);
  if (saveIntegrity)
    setTimeout(
      () =>
        toast(
          (saveIntegrity.reason === 'newer' ? 'Spielstand stammt aus einer neueren Version.' : 'Teile des Spielstands waren beschädigt und wurden zurückgesetzt.') +
            (saveIntegrity.held ? ' Eine unveränderte Kopie wurde gesichert.' : '')
        ),
      1300
    );
}
setInterval(gameTick, 1000);
// ----- Settings dialog -----
function renderSettings() {
  const settings = window.NebulaAudio?.settings || {};
  $('settingSfx').value = Math.round((settings.sfx ?? 0.7) * 100);
  $('settingMusic').value = Math.round((settings.music ?? 0.35) * 100);
  $('settingMuted').checked = Boolean(settings.muted);
  $('settingHaptics').checked = settings.haptics !== false;
  $('settingMotion').value = settings.reducedMotion || 'system';
  const error = window.NebulaSave.lastError;
  $('saveStatus').textContent = error
    ? 'Speichern fehlgeschlagen – Gerätespeicher prüfen. Sicherungscode empfohlen.'
    : 'Automatisch gespeichert' +
      (window.NebulaSave.lastWriteAt
        ? ' · ' + new Date(window.NebulaSave.lastWriteAt).toLocaleTimeString('de-DE')
        : '') +
      '.';
  $('versionLabel').textContent =
    'Space Kittens ' + (window.NEBULA_CONFIG?.version || '') + ' · Spielstand-Schema ' + SCHEMA_VERSION;
  window.FriendsBeta?.decorateSettings();
}
$('settingsButton').onclick = () => {
  save();
  renderSettings();
  openModal('settingsModal');
};
$('settingSfx').oninput = event => window.NebulaAudio?.update({ sfx: event.target.value / 100 });
$('settingSfx').onchange = () => feedback('tap');
$('settingMusic').oninput = event => window.NebulaAudio?.update({ music: event.target.value / 100 });
$('settingMuted').onchange = event => window.NebulaAudio?.update({ muted: event.target.checked });
$('settingHaptics').onchange = event => {
  window.NebulaAudio?.update({ haptics: event.target.checked });
  feedback('tap', 'light');
};
$('settingMotion').onchange = event => window.NebulaAudio?.update({ reducedMotion: event.target.value });
$('exportSave').onclick = async () => {
  save();
  const code = window.NebulaSave.exportCode(state);
  $('importCode').value = code;
  $('importPanel').classList.remove('hidden');
  try {
    await navigator.clipboard.writeText(code);
    toast('Sicherungscode kopiert. Bewahre ihn sicher auf.');
  } catch {
    $('importCode').select();
    toast('Code markiert – bitte manuell kopieren.');
  }
};
$('importSaveToggle').onclick = () => $('importPanel').classList.toggle('hidden');
$('importSave').onclick = () => {
  let imported;
  try {
    imported = window.NebulaSave.importCode($('importCode').value);
  } catch (error) {
    toast('Code ungültig: ' + error.message);
    return;
  }
  // Keep the current game recoverable before replacing it.
  try {
    localStorage.setItem(window.NebulaSave.BACKUP, JSON.stringify(state));
  } catch {}
  const keptWelcome = state.meta.welcome,
    keptCosmetics = state.meta.cosmetics;
  state = normalizeState(imported);
  sizeConvertedRails();
  if (keptWelcome && !state.meta.welcome) {
    state.meta.welcome = keptWelcome;
    if (!state.meta.cosmetics.includes(keptWelcome.item)) state.meta.cosmetics.push(keptWelcome.item);
  }
  void keptCosmetics;
  lastTickAt = Date.now();
  save();
  render();
  closeModal('settingsModal');
  toast('Spielstand geladen. Der vorherige Stand liegt in der Sicherung.');
};
if (!state.introSeen) {
  introRender();
  $('introModal').classList.remove('hidden');
}
setInterval(save, 15000);
function strategicEventCatalog() {
  const known = PLANETS.map((planet, index) => (state.planetsUnlocked[index] ? index : null)).filter(
      index => index !== null
    ),
    tradeTarget = known.find(index => territoryRole(index) === 'trade') ?? known[0],
    researchTarget = known.find(index => territoryRole(index) === 'research') ?? known[0],
    militaryTarget = known.find(index => territoryRole(index) === 'military') ?? known[0],
    joined = state.faction.joined;
  return [
    {
      type: 'blockade',
      icon: '⇄',
      target: tradeTarget,
      title: 'Handelsblockade',
      text: 'Ein Konvoi bei ' + PLANETS[tradeTarget].name + ' wird abgefangen.',
      bonus:
        (crewRank(2) ? 'Trade Commander: Eskorte günstiger. ' : '') +
        (planetSpecialization() === 'trade' ? 'Handelswelt: bessere Eskorte.' : ''),
      eligible: state.sectorUnlocked[0],
      actions: ['escort', 'reroute', 'accept']
    },
    {
      type: 'conflict',
      icon: '⚑',
      target: militaryTarget,
      title: 'Grenzkonflikt',
      text: 'Rivalen ringen um Einfluss auf ' + PLANETS[militaryTarget].name + '.',
      bonus:
        (crewRank(7) ? 'Faction Operations: mehr Einfluss. ' : '') +
        (crewRank(1) ? 'Defense Commander: Flottenhilfe verstärkt.' : ''),
      eligible: joined !== null,
      actions: ['support', 'supply', 'neutral']
    },
    {
      type: 'pirates',
      icon: '☠',
      target: militaryTarget,
      title: 'Piratenüberfall',
      text: 'Piraten bedrohen die Frachterroute von ' + PLANETS[militaryTarget].name + '.',
      bonus:
        (crewRank(1) ? 'Defense Commander verbessert Eskorte. ' : '') +
        (planetSpecialization() === 'military' ? 'Verteidigungswelt reduziert die Gefahr.' : ''),
      eligible: state.buildings[3].level > 0,
      actions: ['fleet', 'bribe', 'accept']
    },
    {
      type: 'research',
      icon: '⌁',
      target: researchTarget,
      title: 'Forschungsoffensive',
      text: 'Ein Labor auf ' + PLANETS[researchTarget].name + ' öffnet ein kurzes Forschungsfenster.',
      bonus:
        (crewRank(4) ? 'Research Specialist verbessert die Investition. ' : '') +
        (planetSpecialization() === 'research' ? 'Forschungswelt verstärkt den Rabatt.' : ''),
      eligible: state.totalEarned >= 5000,
      actions: ['invest', 'crystal', 'pass']
    },
    {
      type: 'anomaly',
      icon: '✧',
      target: known[known.length - 1] ?? 0,
      title: 'Sektor-Anomalie',
      text: 'Eine Anomalie verlangt eine Entscheidung nahe ' + PLANETS[known[known.length - 1] ?? 0].name + '.',
      bonus: crewRank(5)
        ? 'Explorer senkt die Analysekosten und erhöht Beute.'
        : 'Explorer kann diese Route später optimieren.',
      eligible: state.sectorUnlocked.some(Boolean),
      actions: ['analyse', 'risk', 'ignore']
    }
  ].filter(event => event.eligible && Number.isInteger(event.target));
}
function strategicActionLabel(type, action, event) {
  const labels = {
    blockade: {
      escort: 'ESKORTE · ⛽ ' + (crewRank(2) ? 1 : 2),
      reroute: 'UMLEITEN · -10% Markt',
      accept: 'AKZEPTIEREN · -22% Markt'
    },
    conflict: { support: 'UNTERSTÜTZEN · ⛽ 1', supply: 'LIEFERN · ⬡ 20', neutral: 'NEUTRAL BLEIBEN' },
    pirates: {
      fleet: 'FLOTTE · ⛽ 2 · ' + (14 + event.target * 3) + ' ⚔',
      bribe: 'SCHUTZGELD · ◈ 1.000',
      accept: 'VERLUST AKZEPTIEREN'
    },
    research: { invest: 'INVESTIEREN · ◈ 1.200', crystal: 'KRISTALL-EINSATZ · ◆ 1', pass: 'FENSTER SCHLIESSEN' },
    anomaly: {
      analyse: 'ANALYSE · ⛽ ' + (crewRank(5) ? 1 : 2),
      risk: 'RISIKO · ⛽ ' + (crewRank(5) >= 3 ? 3 : 4),
      ignore: 'IGNORIEREN'
    }
  };
  return labels[type][action];
}
function setStrategicEffect(kind, multiplier, seconds) {
  state.strategicEffects = state.strategicEffects || {};
  state.strategicEffects[kind] = { multiplier, until: Date.now() + seconds * 1000 };
}
function finishStrategicEvent(action) {
  const event = state.strategicEvent;
  if (!event || event.status !== 'active' || state.strategicResolved.includes(event.id)) return;
  const target = event.target,
    rankFaction = crewRank(7),
    rankDefense = crewRank(1),
    rankResearch = crewRank(4),
    rankExplorer = crewRank(5);
  if (event.type === 'blockade') {
    if (action === 'escort') {
      const cost = crewRank(2) ? 1 : 2;
      if (state.fuel < cost || attack() < 14 + target * 3) return;
      state.fuel -= cost;
      setStrategicEffect('trade', 1.08 + (planetSpecialization() === 'trade' ? 0.04 : 0), 180);
      if (state.faction.joined !== null) shiftTerritoryControl(target, 6 + rankFaction);
    } else if (action === 'reroute') setStrategicEffect('trade', crewRank(3) ? 0.94 : 0.9, 180);
    else if (action === 'accept') setStrategicEffect('trade', 0.78, 240);
    else return;
  } else if (event.type === 'conflict') {
    if (action === 'support') {
      if (state.fuel < 1) return;
      state.fuel--;
      shiftTerritoryControl(target, 12 + rankFaction * 2 + rankDefense);
    } else if (action === 'supply') {
      if (state.ore < 20) return;
      state.ore -= 20;
      shiftTerritoryControl(target, 8 + rankFaction * 2);
    } else if (action !== 'neutral') return;
  } else if (event.type === 'pirates') {
    if (action === 'fleet') {
      const need = 14 + target * 3;
      if (state.fuel < 2 || attack() < need) return;
      state.fuel -= 2;
      setStrategicEffect('transport', 1.1 + (rankDefense >= 3 ? 0.04 : 0), 180);
    } else if (action === 'bribe') {
      if (state.credits < 1000) return;
      state.credits -= 1000;
      setStrategicEffect('transport', 0.96, 180);
    } else if (action === 'accept') setStrategicEffect('transport', 0.8, 180);
    else return;
  } else if (event.type === 'research') {
    if (action === 'invest') {
      const cost = rankResearch ? 900 : 1200;
      if (state.credits < cost) return;
      state.credits -= cost;
      setStrategicEffect('research', planetSpecialization() === 'research' ? 0.72 : 0.78, 180);
      if (rankResearch) state.crystals++;
    } else if (action === 'crystal') {
      if (state.crystals < 1) return;
      state.crystals--;
      setStrategicEffect('research', 0.68, 150);
    } else if (action !== 'pass') return;
  } else if (event.type === 'anomaly') {
    const cost = action === 'analyse' ? (rankExplorer ? 1 : 2) : rankExplorer >= 3 ? 3 : 4;
    if (action === 'analyse') {
      if (state.fuel < cost) return;
      state.fuel -= cost;
      state.crystals += 1 + (rankExplorer ? 1 : 0);
      setStrategicEffect('research', 0.9, 120);
    } else if (action === 'risk') {
      if (state.fuel < cost) return;
      state.fuel -= cost;
      state.alloys += 2 + (rankExplorer ? 1 : 0);
      earn(2200);
      if (state.faction.joined !== null) shiftTerritoryControl(target, 4);
    } else if (action !== 'ignore') return;
  } else return;
  event.status = 'resolved';
  seasonXp('strategic');
  state.strategicResolved.push(event.id);
  state.strategicResolved = state.strategicResolved.slice(-20);
  state.strategicLastType = event.type;
  state.strategicEvent = null;
  state.strategicNextAt = Date.now() + (8 + (event.target % 5) * 2) * 60000;
  render();
  toast('Strategisches Ereignis entschieden: ' + event.title);
}
function maybeStartStrategicEvent() {
  const now = Date.now();
  state.strategicEffects = state.strategicEffects || {};
  state.strategicResolved = Array.isArray(state.strategicResolved) ? state.strategicResolved : [];
  state.strategicNextAt = Math.max(0, state.strategicNextAt || now + 600000);
  Object.keys(state.strategicEffects).forEach(kind => {
    if (state.strategicEffects[kind]?.until <= now) delete state.strategicEffects[kind];
  });
  if (state.strategicEvent && state.strategicEvent.end <= now) {
    state.strategicLastType = state.strategicEvent.type;
    state.strategicEvent = null;
    state.strategicNextAt = now + 480000;
    toast('Ein strategisches Ereignis ist neutral ausgelaufen.');
  }
  if (state.strategicEvent || now < state.strategicNextAt || state.totalEarned < 15000 || !state.sectorUnlocked[0])
    return;
  const options = strategicEventCatalog().filter(event => event.type !== state.strategicLastType);
  const event = options[Math.floor(now / 600000) % Math.max(1, options.length)];
  if (!event) return;
  state.strategicEvent = {
    id: event.type + '-' + now,
    type: event.type,
    target: event.target,
    start: now,
    end: now + 360000,
    status: 'active'
  };
  toast('Strategisches Ereignis: ' + event.title);
}
function renderStrategicEvent() {
  const card = $('strategicEvent'),
    event = state.strategicEvent;
  if (!event || event.status !== 'active') {
    card.classList.add('hidden');
    return;
  }
  const info = strategicEventCatalog().find(item => item.type === event.type);
  if (!info) {
    card.classList.add('hidden');
    return;
  }
  $('strategicEventIcon').textContent = info.icon;
  $('strategicEventTag').textContent =
    'STRATEGISCH · ' + Math.max(0, Math.ceil((event.end - Date.now()) / 60000)) + ' MIN';
  $('strategicEventTitle').textContent = info.title + ' · ' + PLANETS[event.target].name;
  $('strategicEventText').textContent = info.text;
  $('strategicEventBonus').textContent = info.bonus;
  setHTML(
    $('strategicEventActions'),
    info.actions
      .map(
        action =>
          `<button data-strategic-event="${event.id}:${action}">${strategicActionLabel(event.type, action, event)}</button>`
      )
      .join('')
  );
  card.classList.remove('hidden');
}
setInterval(() => {
  maybeStartStrategicEvent();
  if (state.strategicEvent || Object.keys(state.strategicEffects).length) render();
}, 5000);
