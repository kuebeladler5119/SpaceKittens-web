// Data-only catalogues. Add future planets, factions and ships here instead of changing simulation code.
window.NEBULA_DATA = Object.freeze({
  PLANETS: Object.freeze([
    {
      id: 'crystal',
      name: 'Kristallfeld Orion',
      type: 'Kristallplanet',
      icon: '💎',
      unlock: 0,
      income: 1,
      tap: 1,
      owner: 0,
      desc: 'Kristalladern: 18% Chance auf +1 Kristall beim aktiven Abbau.'
    },
    {
      id: 'ice',
      name: 'Glacies Niva',
      type: 'Eisplanet',
      icon: '❄',
      unlock: 3000,
      income: 1.16,
      tap: 1.08,
      owner: 2,
      desc: 'Frostadern: 18% Chance auf +1 Treibstoff beim aktiven Abbau.'
    },
    {
      id: 'volcanic',
      name: 'Pyra-9',
      type: 'Vulkanplanet',
      icon: '🌋',
      unlock: 40000,
      income: 1.32,
      tap: 1.18,
      owner: 1,
      desc: 'Lavazone: Jeder aktive Abbau liefert 1 zusätzliches Erz.'
    },
    {
      id: 'machine',
      name: 'Mekhanos',
      type: 'Maschinenwelt',
      icon: '⚙',
      unlock: 600000,
      income: 1.55,
      tap: 1.28,
      owner: 1,
      desc: 'Fabriknetz: 12% Chance auf einen zweiten aktiven Credit-Ertrag.'
    },
    {
      id: 'verdant',
      name: 'Viridia Bloom',
      type: 'Bioplanet',
      icon: '🌿',
      unlock: 15000000,
      income: 1.72,
      tap: 1.4,
      owner: 2,
      desc: 'Bioreaktoren: 24% Chance auf +1 Treibstoff beim aktiven Abbau.'
    },
    {
      id: 'forge',
      name: 'Aurelia-Forge',
      type: 'Schmiedewelt',
      icon: '🔶',
      unlock: 400000000,
      income: 2.08,
      tap: 1.55,
      owner: 0,
      desc: 'Sonnenöfen: Jeder aktive Abbau gewinnt +1 Legierung für Spitzenforschung.'
    }
  ]),
  RESEARCH: Object.freeze([
    {
      name: 'Drohnen-Matrix',
      icon: '◈',
      cost: 2500,
      effect: '+15% automatische Förderung',
      kind: 'income',
      requires: []
    },
    { name: 'Impuls-Linse', icon: '⌁', cost: 6000, effect: '+25% aktiver Abbau', kind: 'tap', requires: [0] },
    { name: 'Kritische Sensoren', icon: '✦', cost: 15000, effect: '+6% kritischer Abbau', kind: 'crit', requires: [0] },
    {
      name: 'Adaptive Routen',
      icon: '◫',
      cost: 120000,
      alloyCost: 6,
      effect: 'Schaltet +35 Transportkapazität frei',
      kind: 'logistics',
      requires: [0, 1]
    },
    {
      name: 'Tiefenresonanz',
      icon: '✧',
      cost: 3000000,
      alloyCost: 14,
      effect: 'Scans −1 Treibstoff · Expeditionen 25% schneller',
      kind: 'exploration',
      requires: [2, 3]
    }
  ]),
  FACTIONS: Object.freeze([
    {
      name: 'Orion-Kollektiv',
      icon: '⛏',
      bonus: '+10% Förderleistung bei freundlich',
      effect: 'mining',
      doctrine: 'Bohrprotokoll: +18% Förderung als Mitglied',
      warBonus: 'Kontrollierte Welten: +8% Produktion'
    },
    {
      name: 'Sternenwache',
      icon: '⚔',
      bonus: '+10% Kampfschaden bei freundlich',
      effect: 'combat',
      doctrine: 'Wachtaktik: +18% Kampfschaden als Mitglied',
      warBonus: 'Einsatzbefehl: +10% Kampfschaden im Krieg'
    },
    {
      name: 'Freihändler-Gilde',
      icon: '⇄',
      bonus: '+10% Handelswert bei freundlich',
      effect: 'trade',
      doctrine: 'Routenlizenz: +18% Handelswert als Mitglied',
      warBonus: 'Kontrollierte Welten: +8% Produktion'
    }
  ]),
  SECTORS: Object.freeze([
    {
      id: 'vesper',
      name: 'Vesper-Drift',
      icon: '☄',
      unlock: 60000,
      scans: 3,
      scanTime: 180000,
      scanFuel: 1,
      safeFuel: 3,
      riskFuel: 5,
      distance: 'Kurze Handelsroute',
      hazard: 'Ionenstürme',
      interest: '+12% Handelswert nach Sicherung',
      bonus: 'trade'
    },
    {
      id: 'meridian',
      name: 'Eisenmeridian',
      icon: '◫',
      unlock: 900000,
      scans: 4,
      scanTime: 360000,
      scanFuel: 1,
      safeFuel: 4,
      riskFuel: 6,
      distance: 'Mittlere Frachtstrecke',
      hazard: 'Schrottgürtel',
      interest: '+20 Transportkapazität nach Sicherung',
      bonus: 'logistics'
    },
    {
      id: 'veil',
      name: 'Nebel-Schleier',
      icon: '✧',
      unlock: 40000000,
      scans: 5,
      scanTime: 600000,
      scanFuel: 2,
      safeFuel: 5,
      riskFuel: 7,
      distance: 'Tiefe Forschungsroute',
      hazard: 'Gravitationsspalten',
      interest: '-10% Forschungskosten nach Sicherung',
      bonus: 'research'
    }
  ]),
  // Central pacing/tuning values (see docs/ECONOMY.md). Change here, then run `npm run sim` to compare.
  BALANCE: Object.freeze({
    buildingCostGrowth: 1.16,
    planetSurveyMinutes: [0, 1, 4, 10, 20, 40],
    sectorExpeditionMinutes: { safe: [8, 15, 25], risk: [12, 22, 35] },
    gate: [
      { credits: 400000, ore: 2000, alloys: 10 },
      { credits: 15000000, ore: 12000, alloys: 35 },
      { credits: 500000000, ore: 60000, alloys: 90 }
    ],
    crewCosts: [0, 900, 3000, 12000, 25000, 150000, 600000, 1500000],
    crewSlots: [
      { credits: 150000, alloys: 10, earned: 1000000 },
      { credits: 5000000, alloys: 30, gate: 2 }
    ],
    // Fuel from production grows with the square root of throughput and is limited by the tank.
    fuelPerSqrtDelivery: 0.012,
    fuelTankBase: 60,
    fuelTankPerPlanet: 20,
    fuelTankPerGate: 40,
    offlineEfficiencyBase: 0.6,
    offlineEfficiencyCap: 1,
    offlineHoursBase: 4,
    prestigeDivisor: 1000
  }),
  // Permanent stardust upgrades. Index = position in state.stars (0-3 existed before schema 25).
  STAR_UPGRADES: Object.freeze([
    {
      id: 'production',
      icon: '⌁',
      name: 'Förderkern',
      effect: '+10% Produktion je Stufe',
      max: 200,
      base: 1,
      growth: 'linear'
    },
    {
      id: 'fleet',
      icon: '⚔',
      name: 'Sternenflotte',
      effect: '+2 Kampfschaden je Stufe',
      max: 200,
      base: 1,
      growth: 'linear'
    },
    {
      id: 'sleep',
      icon: '☾',
      name: 'Schlafmatrix',
      effect: '+10% Offline-Effizienz (max. 100%)',
      max: 4,
      base: 1,
      growth: 'linear'
    },
    {
      id: 'trade',
      icon: '⇄',
      name: 'Handelsnetz',
      effect: '+10% Handelswert je Stufe',
      max: 50,
      base: 1,
      growth: 'linear'
    },
    {
      id: 'capital',
      icon: '◈',
      name: 'Startkapital',
      effect: 'Neue Galaxien starten mit 2k / 15k / 120k / 1M / 8M Credits',
      max: 5,
      base: 3,
      growth: 'square'
    },
    {
      id: 'archive',
      icon: '🪐',
      name: 'Sternkarten-Archiv',
      effect: 'Je Stufe bleibt ein weiterer Planet nach dem Verkauf entdeckt',
      max: 4,
      base: 10,
      growth: 'square'
    },
    {
      id: 'legacy',
      icon: '✦',
      name: 'Forschungserbe',
      effect: 'Je Stufe startet eine Forschung bereits abgeschlossen',
      max: 3,
      base: 8,
      growth: 'square'
    },
    {
      id: 'longsleep',
      icon: '⏾',
      name: 'Tiefschlaf-Kammern',
      effect: '+1 Std. maximale Offline-Zeit je Stufe',
      max: 4,
      base: 6,
      growth: 'square'
    },
    {
      id: 'fuel',
      icon: '⛽',
      name: 'Treibstoffsynthese',
      effect: '+25% Treibstoff-Förderung und +30 Tank je Stufe',
      max: 5,
      base: 4,
      growth: 'square'
    },
    {
      id: 'academy',
      icon: '♙',
      name: 'Kommando-Akademie',
      effect: 'Crew-Rekrutierung −15% je Stufe',
      max: 4,
      base: 5,
      growth: 'square'
    }
  ]),
  EVENTS: Object.freeze([
    {
      id: 'boom',
      icon: '✦',
      title: 'Mineralienboom',
      text: 'Ein Kometenschauer legt reiche Adern frei.',
      action: 'Bohrfenster öffnen',
      cost: 'Kostenlos',
      effect: '+50% Förderung für 60 Sek.'
    },
    {
      id: 'signal',
      icon: '☄',
      title: 'Notsignal',
      text: 'Ein Forschungsschiff braucht dringend Treibstoff.',
      action: 'Hilfe senden',
      cost: '⛽ 3',
      effect: '+1 Gem und +1 Kristall'
    },
    {
      id: 'market',
      icon: '⇄',
      title: 'Schwarzmarkt-Fenster',
      text: 'Ein Händler bietet seltene Kristalle gegen Erz.',
      action: 'Erz tauschen',
      cost: '⬡ 20',
      effect: '+2 Kristalle'
    }
  ])
});
