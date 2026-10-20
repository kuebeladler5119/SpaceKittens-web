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

  // P1.4: every look also carries its rarity (COSMETIC_RARITIES), and where it belongs: `world` (a planet theme of
  // COSMETIC_WORLDS), `guardian` (the guardian whose look it is) and `anim` (its own animation: glint, gear, sway, swing,
  // tick, shimmer); the sets list their pieces (COSMETIC_SETS). Ids, prices and slots never change (saves own them).
  const COSMETICS = Object.freeze({
    'ship-aurora': { slot: 'ship', name: 'Aurora-Lackierung', icon: '🚀', rarity: 'rare' },
    'ring-gold': { slot: 'ring', name: 'Goldener Orbitalring', icon: '🪐', rarity: 'rare' },
    'trail-nebula': { slot: 'trail', name: 'Nebel-Drohnenspur', icon: '✦', rarity: 'rare' },
    'ship-ember': { slot: 'ship', name: 'Glut-Lackierung', icon: '🔥', rarity: 'epic', world: 'pyra' },
    'ring-frost': { slot: 'ring', name: 'Frost-Orbitalring', icon: '❄', rarity: 'rare', world: 'glacies' },
    'trail-solar': { slot: 'trail', name: 'Sonnenwind-Spur', icon: '☀', rarity: 'rare' },
    // Kitten accessories (welcome capsule pool; purely visual). P1: `wear` is the kitten slot (head, suit, face, back)
    // a piece is worn in, per character (meta.wardrobe); the old `slot` stays for saves of older builds. Prices are
    // in existing in-game currencies only: credits (simple), gems (special), Sternsplitter (forge) or a free
    // achievement — docs/p1-kitty-identity/COSMETIC_ECONOMY.md.
    'acc-star-helmet': { slot: 'mochi', wear: 'head', name: 'Sternchen-Helm', icon: '⭐', credits: 3000, text: 'Goldener Helmrand mit Stern', rarity: 'common' },
    'acc-mint-scarf': { slot: 'mochi', wear: 'back', name: 'Mint-Schal', icon: '🧣', credits: 1500, text: 'Ein weicher Schal, dessen Enden beim Laufen flattern', rarity: 'common' },
    'acc-star-backpack': { slot: 'mochi', wear: 'back', name: 'Goldener Sternrucksack', icon: '🎒', credits: 3500, text: 'Ein goldener Rucksack mit Stern', rarity: 'common' },
    'acc-cute-antenna': { slot: 'mochi', wear: 'head', name: 'Herz-Antenne', icon: '📡', credits: 2000, text: 'Eine federnde Antenne mit Herz', rarity: 'common' },
    'acc-explorer-goggles': { slot: 'mochi', wear: 'face', name: 'Mini-Forscherbrille', icon: '🥽', credits: 2500, text: 'Runde Messingbrille auf den Augen', rarity: 'common' },
    'acc-moon-patch': { slot: 'mochi', wear: 'back', name: 'Mond-Aufnäher', icon: '🌙', credits: 1500, text: 'Ein Mondabzeichen auf der Schulter', rarity: 'common' },
    'acc-cat-helmet': { slot: 'mochi', wear: 'head', name: 'Katzenohren-Helm', icon: '😺', gems: 60, text: 'Ein Glashelm mit zwei Katzenohren', rarity: 'rare' },
    'acc-headphones': { slot: 'mochi', wear: 'head', name: 'Katzen-Kopfhörer', icon: '🎧', achievement: 'crew2', text: 'Pastell-Kopfhörer mit Öhrchen', rarity: 'rare' },
    'acc-pilot-visor': { slot: 'mochi', wear: 'face', name: 'Pilotenvisier', icon: '🕶', credits: 4000, text: 'Ein getöntes Visier über den Augen', rarity: 'common' },
    'acc-holo-monocle': { slot: 'mochi', wear: 'face', name: 'Holo-Monokel', icon: '🧿', gems: 40, text: 'Ein Hologramm-Monokel mit Scanlinie', rarity: 'rare' },
    'acc-rocket-pack': { slot: 'mochi', wear: 'back', name: 'Mini-Raketenrucksack', icon: '🚀', gems: 50, text: 'Zwei kleine Düsen, die beim Springen aufflammen', rarity: 'rare' },
    'acc-tool-pack': { slot: 'mochi', wear: 'back', name: 'Werkzeugrucksack', icon: '🧰', credits: 2500, text: 'Schraubenschlüssel und Schraubendreher immer dabei', rarity: 'common' },
    // Beta 1.2 Sternenschmiede: earned with Sternsplitter (forge = price in ✦), purely visual, never sold here.
    // Same ownership list as every other cosmetic, so a later direct sale or bundle can reuse it without duplicates.
    'glider-midnight': { slot: 'glider', name: 'Mitternachtsgleiter', icon: '🌌', forge: 150, text: 'Tikkis Gleiter in Nachtblau mit Sternpunkten', rarity: 'rare' },
    'glider-blossom': { slot: 'glider', name: 'Kirschblütengleiter', icon: '🌸', forge: 150, text: 'Tikkis Gleiter in Rosa mit Blütenkante', rarity: 'rare' },
    'impact-gold': { slot: 'impact', name: 'Goldfunken', icon: '✨', forge: 120, text: 'Deine Schiffsschüsse und Treffer leuchten golden', rarity: 'rare' },
    'impact-aurora': { slot: 'impact', name: 'Polarlicht-Funken', icon: '🌈', forge: 120, text: 'Deine Schiffsschüsse und Treffer leuchten türkis-violett', rarity: 'rare' },
    'engine-comet': { slot: 'engine', name: 'Kometenschweif', icon: '☄', forge: 200, text: 'Eine funkelnde Spur hinter deinem Schiff im Kampf', rarity: 'epic' },
    'ship-starlight': { slot: 'ship', name: 'Sternenstaub-Lackierung', icon: '🌟', forge: 250, text: 'Nachtblaues Schiff mit goldenen Akzenten – in Kolonie und Kampf', rarity: 'epic' },
    // Beta 1.3 looks: also forged with Sternsplitter (earned only), purely visual, one ownership list
    'outfit-rose': { slot: 'outfit', wear: 'suit', name: 'Rosa Raumanzug', icon: '💗', forge: 180, text: 'Rosa Anzug mit weißen Kanten und Herz – Kolonie, Mine und Porträts', rarity: 'rare' },
    'outfit-explorer': { slot: 'outfit', wear: 'suit', name: 'Forscher-Overall', icon: '🧭', forge: 180, text: 'Sandbraune Weste mit Taschen, Kompass und Halstuch – für Expeditionen', rarity: 'rare' },
    'outfit-stellar': { slot: 'outfit', wear: 'suit', name: 'Sternenforscher', icon: '🌟', gems: 90, text: 'Cremefarbener Anzug mit goldenen Sternen und Forschungsemblem', rarity: 'epic' },
    'outfit-miner': { slot: 'outfit', wear: 'suit', name: 'Kristall-Bergarbeiter', icon: '⛏', credits: 6000, text: 'Latzhose mit Trägern, Kristalltasche und Nähten', rarity: 'common', world: 'orion' },
    'outfit-glacies': { slot: 'outfit', wear: 'suit', name: 'Glacies-Pilot', icon: '❄', credits: 15000, text: 'Gesteppter Frostanzug mit Fellkragen, Schulterpolstern und Fäustlingen', rarity: 'rare', world: 'glacies' },
    'outfit-pyra': { slot: 'outfit', wear: 'suit', name: 'Pyra-Mechaniker', icon: '🔧', credits: 12000, text: 'Arbeitsanzug mit hochgekrempelten Ärmeln, Werkzeuggürtel und Zahnrad', rarity: 'rare', world: 'pyra' },
    'outfit-viridia': { slot: 'outfit', wear: 'suit', name: 'Viridia-Botaniker', icon: '🌿', credits: 12000, text: 'Laborkittel mit Blattkragen, Bio-Abzeichen und Setzling', rarity: 'rare', world: 'viridia' },
    'outfit-pajama': { slot: 'outfit', wear: 'suit', name: 'Mondschlafanzug', icon: '🌜', achievement: 'expedition', text: 'Sternenpyjama mit Knopfleiste und Schlafmütze', rarity: 'rare' },
    'outfit-navigator': { slot: 'outfit', wear: 'suit', name: 'Nebula-Navigator', icon: '🌌', forge: 240, text: 'Violetter Spezialanzug mit türkisen Lichtlinien und Umhang – wie für Void gemacht', rarity: 'epic' },
    'ship-sakura': { slot: 'ship', name: 'Kirschblüten-Lack', icon: '🌸', forge: 220, text: 'Weiß-rosa Schiff mit Blütenkante – in Kolonie und Kampf', rarity: 'rare' },
    'ship-mint': { slot: 'ship', name: 'Minz-Lack', icon: '🍃', forge: 220, text: 'Mintgrünes Schiff mit cremefarbenen Streifen – in Kolonie und Kampf', rarity: 'rare' },
    'deco-lanterns': { slot: 'colony', name: 'Laternenkette', icon: '🏮', forge: 160, text: 'Bunte Laternen über deiner Kolonie, die abends leuchten', rarity: 'rare', world: 'orion' },
    'mine-crystal-lamps': { slot: 'mine', name: 'Kristall-Grubenlampen', icon: '💎', forge: 160, text: 'Leuchtende Kristalllampen an jeder Sohle deiner Mine', rarity: 'rare', world: 'orion' },
    // P1.2: the ship's signature (a decal on the hull – the role emblem on the wing stays the ship's DNA) and the muzzle
    // style of the weapons (an ornament on the DNA muzzle flash – the chassis shape and the affinity colour stay)
    'decal-paw': { slot: 'decal', name: 'Pfoten-Abzeichen', icon: '🐾', credits: 5000, text: 'Ein Pfotenabdruck auf der Hülle – dein Schiff, deine Signatur', rarity: 'common' },
    'decal-comet': { slot: 'decal', name: 'Kometen-Signatur', icon: '☄', forge: 160, text: 'Ein Komet mit Schweif auf der Hülle, golden umrandet', rarity: 'rare' },
    'muzzle-star': { slot: 'muzzle', name: 'Sternenblitz', icon: '⭐', forge: 140, text: 'Jeder Schuss startet mit kleinen Sternen am Lauf', rarity: 'rare' },
    'muzzle-heart': { slot: 'muzzle', name: 'Herzfunke', icon: '💗', credits: 8000, text: 'Ein Herz blitzt am Lauf auf, wenn du feuerst', rarity: 'common' },
    // P1.3: guardian rewards – free, granted once when the guardian is beaten (wardrobe.js WARDROBE_ACHIEVEMENTS); the
    // guaranteed rewards of the fights stay exactly as they were
    'decal-pips': { slot: 'decal', name: 'Prüfsiegel', icon: '✅', achievement: 'pips', text: 'Das Siegel von P.I.P.S. auf deiner Hülle – Inspektion bestanden', rarity: 'epic', world: 'orion', guardian: 'pips' },
    'impact-frost': { slot: 'impact', name: 'Frostsplitter', icon: '❄', achievement: 'frostbyte', text: 'Deine Treffer sprühen Eissplitter wie Frostbytes Platten', rarity: 'epic', world: 'glacies', guardian: 'frostbyte' },
    // P1.3: the first building look – the market stall's awning (P1.4: on every planet's stall)
    'stall-sunset': { slot: 'stall', name: 'Abendrot-Markise', icon: '🌅', forge: 150, text: 'Orange-cremefarbene Markise und warme Lichterkette über deinem Marktstand', rarity: 'rare', world: 'orion' },
    // ----- P1.4 Cosmetics 2.0: a few looks made with care (shape, material and motion, not only colour) -----
    // Glacies-Forscherset (complete it for the Polarlicht-Rahmen): visor, paint, engine trail and stall join the
    // Glacies-Pilot suit and Frostbyte's Frostsplitter
    'acc-frost-visor': { slot: 'mochi', wear: 'face', name: 'Frostvisier', icon: '🧊', credits: 9000, text: 'Ein Eiskristall-Visier mit Raureifkante; ein Lichtfunke wandert darüber', rarity: 'rare', world: 'glacies', anim: 'glint' },
    'ship-frost': { slot: 'ship', name: 'Frostkristall-Lack', icon: '❄', forge: 260, text: 'Eisblaue Hülle aus Kristallfacetten; ein Glanzlicht läuft über die Kanten', rarity: 'epic', world: 'glacies', anim: 'glint' },
    'engine-crystal': { slot: 'engine', name: 'Kristallspur', icon: '💠', forge: 200, text: 'Dein Triebwerk lässt funkelnde Eiskristalle statt Funken zurück', rarity: 'rare', world: 'glacies', anim: 'shimmer' },
    'stall-frost': { slot: 'stall', name: 'Raureif-Markise', icon: '🧊', forge: 150, text: 'Eisblaue Markise mit Eiszapfenkante und kühlen Kristalllichtern', rarity: 'rare', world: 'glacies', anim: 'glint' },
    // Mekhanos: the technician's overall with a little gear on the chest that turns (faster at work)
    'outfit-mekhanos': { slot: 'outfit', wear: 'suit', name: 'Mekhanos-Techniker', icon: '⚙', forge: 220, text: 'Stahlblauer Overall mit Nieten, Schulterplatten und einem Zahnrad, das sich bei der Arbeit dreht', rarity: 'epic', world: 'mekhanos', anim: 'gear' },
    // the three remaining guardians' looks (free, once, when the guardian is beaten)
    'acc-ember-bell': { slot: 'mochi', wear: 'back', name: 'Glutglöckchen', icon: '🔔', achievement: 'emberbell', text: 'Ein Halsband mit einem Glöckchen von Emberbell; in ihm glimmt Glut, es schwingt beim Laufen', rarity: 'epic', world: 'pyra', guardian: 'emberbell', anim: 'swing' },
    'engine-clockwork': { slot: 'engine', name: 'Uhrwerk-Spur', icon: '⚙', achievement: 'cogsworth', text: 'Kleine goldene Zahnräder tanzen im Takt hinter deinem Schiff', rarity: 'epic', world: 'mekhanos', guardian: 'cogsworth', anim: 'tick' },
    'acc-petal-crown': { slot: 'mochi', wear: 'head', name: 'Blütenkranz', icon: '🌺', achievement: 'petalguard', text: 'Petalguards Blüten als Kranz; die Blätter wiegen sich im Wind', rarity: 'epic', world: 'viridia', guardian: 'petalguard', anim: 'sway' },
    // Geschoss-Spur (new weapon-effect slot): an ornament that follows each shot – the projectile keeps its chassis shape
    // and its affinity colour (a lance stays a lance)
    'shot-stardust': { slot: 'shot', name: 'Sternschnuppen-Spur', icon: '🌠', forge: 160, text: 'Kleine Sterne folgen jedem deiner Schüsse', rarity: 'rare', anim: 'shimmer' },
    'shot-petal': { slot: 'shot', name: 'Blütenblatt-Spur', icon: '🌸', credits: 30000, text: 'Rosa Blütenblätter wirbeln hinter deinen Schüssen her', rarity: 'rare', world: 'viridia', anim: 'sway' },
    // Profile frames (the frame slot prepared in P1.2): around your profile picture in the collection album
    'frame-star': { slot: 'frame', name: 'Sternenrahmen', icon: '⭐', credits: 2500, text: 'Ein goldener Rahmen mit fünf kleinen Sternen', rarity: 'common' },
    'frame-aurora': { slot: 'frame', name: 'Polarlicht-Rahmen', icon: '🌌', reward: 'set-glacies', text: 'Ein Rahmen, in dem langsam Polarlicht wandert – für das komplette Glacies-Forscherset', rarity: 'legendary', world: 'glacies', anim: 'shimmer' },
    // ----- P1.5 Cosmetics 2.1: vehicles, a second building, the first planet decoration, the world sets' rewards -----
    // Fahrzeug-Lack (new slot): the paint of every vehicle you already have – the cart line's carts, rovers, trains and
    // maglev pods, the porters' carriers (each world keeps its sled, heat cart, robot cart or basket) and the mine carts.
    // No extra vehicle is drawn; a look only paints the ones the economy moves.
    'vehicle-mint': { slot: 'vehicle', name: 'Minz-Flotte', icon: '🚃', credits: 8000, text: 'Mintgrün mit cremefarbenem Streifen – jede Lore, jeder Rover und jeder Karren', rarity: 'common' },
    'vehicle-ember': { slot: 'vehicle', name: 'Glutlack-Flotte', icon: '🚂', forge: 180, text: 'Basaltschwarz mit Glutnähten, die glimmen, solange das Fahrzeug Ladung trägt', rarity: 'rare', world: 'pyra', anim: 'glint' },
    'vehicle-brass': { slot: 'vehicle', name: 'Messing-Flotte', icon: '⚙', credits: 20000, text: 'Poliertes Messing mit Nieten und einem Zahnrad, das sich nur dreht, wenn das Fahrzeug fährt', rarity: 'rare', world: 'mekhanos', anim: 'gear' },
    // Lagerhaus (the second building slot, like the stall): the depot's roof on every planet
    'depot-brass': { slot: 'depot', name: 'Messingdach', icon: '🏭', credits: 22000, text: 'Ein Messingdach mit Lüfterrad – es dreht sich, während Ware ins Lager rollt', rarity: 'rare', world: 'mekhanos', anim: 'gear' },
    'depot-blossom': { slot: 'depot', name: 'Blütendach', icon: '🌸', forge: 170, text: 'Ein Dach aus rosa Blütenschindeln, in denen sich Blätter im Wind wiegen', rarity: 'rare', world: 'viridia', anim: 'sway' },
    // Planeten-Deko (new slot, saved per world): you set it up on the planet you are on; every planet keeps its own
    'decor-fountain': { slot: 'decor', name: 'Katzenbrunnen', icon: '⛲', credits: 12000, text: 'Eine kleine Katzenstatue, die Wasser spuckt – auf Glacies gefroren, auf Pyra dampfend', rarity: 'common' },
    'decor-bloomarch': { slot: 'decor', name: 'Blütenbogen', icon: '🌺', reward: 'set-viridia', text: 'Ein Rosenbogen aus Viridia, dessen Blüten sich bei Tag öffnen – für das komplette Viridia-Gartenset', rarity: 'epic', world: 'viridia', anim: 'sway' },
    'frame-ember': { slot: 'frame', name: 'Glutrahmen', icon: '🔥', reward: 'set-pyra', text: 'Ein Rahmen aus Basalt, aus dessen Rissen Funken steigen – für das komplette Pyra-Glutset', rarity: 'legendary', world: 'pyra', anim: 'glint' },
    'frame-gear': { slot: 'frame', name: 'Uhrwerkrahmen', icon: '⚙', reward: 'set-mekhanos', text: 'Ein Zahnkranz, der im Takt um dein Bild läuft – für das komplette Mekhanos-Werkset', rarity: 'legendary', world: 'mekhanos', anim: 'gear' },
    'frame-guardian': { slot: 'frame', name: 'Wächterkranz', icon: '👑', reward: 'set-guardians', text: 'Die Zeichen aller fünf Wächter umkreisen dein Bild – für alle fünf Wächter-Trophäen', rarity: 'mythic', guardian: 'all', anim: 'shimmer' }
  });
  // P1.2 — ONE cosmetic structure for the whole game: every look belongs to a domain and a slot. A slot holds one look
  // (meta.equipped[slot]; kitten wear per character in meta.wardrobe). Role uniforms are not cosmetics (scenes/kittens.js
  // ROLES, never sold, never in this list). Sources say how a look is earned; a later shop or free reward reuses the same
  // ids and ownership list (docs/p1-2-mobile-ux/COSMETICS.md). P1.4: the Geschoss-Spur joins the weapon effects, the
  // profile frame has its first looks (docs/p1-4-cosmetics-collection/COSMETICS.md).
  const COSMETIC_DOMAINS = Object.freeze([
    { id: 'kitten', name: 'Kätzchen', slots: ['mochi', 'outfit'] },
    { id: 'ship', name: 'Schiff', slots: ['ship', 'decal', 'engine'] },
    { id: 'weapon', name: 'Waffen-Effekte', slots: ['muzzle', 'shot', 'impact'] },
    { id: 'companion', name: 'Begleiter', slots: ['glider', 'trail'] },
    { id: 'world', name: 'Welt', slots: ['colony', 'stall', 'depot', 'mine', 'vehicle', 'decor', 'ring'] },
    { id: 'profile', name: 'Profil', slots: ['frame'] }
  ]);
  const COSMETIC_SLOT_NAMES = Object.freeze({
    mochi: 'Kätzchen-Accessoire',
    outfit: 'Outfit',
    ship: 'Lackierung',
    decal: 'Hüllen-Signatur',
    engine: 'Triebwerksspur',
    muzzle: 'Mündungsblitz',
    shot: 'Geschoss-Spur',
    impact: 'Trefferfunken',
    glider: 'Tikkis Gleiter',
    trail: 'Drohnenspur',
    colony: 'Kolonie-Deko',
    stall: 'Marktstand',
    depot: 'Lagerhaus',
    vehicle: 'Fahrzeug-Lack',
    decor: 'Planeten-Deko',
    mine: 'Minen-Deko',
    ring: 'Planetenring',
    frame: 'Profilrahmen'
  });
  // what a look of a slot fits on (the shop and the album say it)
  const COSMETIC_FITS = Object.freeze({
    mochi: 'Jedes Kätzchen im Studio',
    outfit: 'Jedes Kätzchen im Studio',
    ship: 'Alle 6 Schiffsmodelle',
    decal: 'Alle 6 Schiffsmodelle',
    engine: 'Alle 6 Schiffsmodelle',
    muzzle: 'Jede Waffe',
    shot: 'Jede Waffe',
    impact: 'Jede Waffe',
    glider: 'Tikkis Gleiter',
    trail: 'Deine Drohnen',
    colony: 'Deine Kolonie',
    stall: 'Der Marktstand jedes Planeten',
    depot: 'Das Lagerhaus jedes Planeten',
    vehicle: 'Loren, Rover, Züge, Karren und Grubenwagen',
    decor: 'Ein Planet deiner Wahl (jeder Planet behält seine)',
    mine: 'Deine Mine',
    ring: 'Dein Heimatplanet',
    frame: 'Dein Profilbild'
  });
  const EQUIP_SLOTS = Object.freeze(['ship', 'ring', 'trail', 'mochi', 'glider', 'impact', 'engine', 'outfit', 'colony', 'mine', 'decal', 'muzzle', 'frame', 'stall', 'shot', 'vehicle', 'depot', 'decor']);
  // P1.4: rarity is design quality, not more particles (docs/p1-4-cosmetics-collection/COSMETICS.md):
  //   common: a clean look · rare: an extra detail and a better material · epic: a design feature of its own ·
  //   legendary: a unique design with its own animation · mythic: an exceptional, controlled signature
  const COSMETIC_RARITIES = Object.freeze({
    common: { name: 'Gewöhnlich', rank: 0, color: '#c9c3ee' },
    rare: { name: 'Selten', rank: 1, color: '#8fe3ff' },
    epic: { name: 'Episch', rank: 2, color: '#c4a3ff' },
    legendary: { name: 'Legendär', rank: 3, color: '#ffd77a' },
    mythic: { name: 'Mythisch', rank: 4, color: '#ff9ecb' }
  });
  const COSMETIC_WORLDS = Object.freeze({ orion: 'Orion', glacies: 'Glacies', pyra: 'Pyra', mekhanos: 'Mekhanos', viridia: 'Viridia' });
  const COSMETIC_GUARDIANS = Object.freeze({ pips: 'P.I.P.S.', frostbyte: 'Frostbyte', emberbell: 'Emberbell', cogsworth: 'Cogsworth', petalguard: 'Petalguard' });
  // One set registry. A `bundle` set is forged at once for 80 % of its missing pieces (Beta 1.3 Sets tab); a collection
  // set is completed by owning its pieces – however they were earned – and gives its `reward` (a look, never a value)
  // once. No set is needed for anything but its reward.
  const COSMETIC_SETS = Object.freeze([
    { id: 'set-sakura', name: 'Kirschblüten-Set', icon: '🌸', items: ['ship-sakura', 'outfit-rose', 'glider-blossom'], text: 'Schiff, Mochi und Tikkis Gleiter in Kirschblüte', bundle: 0.8 },
    { id: 'set-miner', name: 'Grubenlicht-Set', icon: '💎', items: ['mine-crystal-lamps', 'outfit-explorer', 'deco-lanterns'], text: 'Kristalllampen in der Mine, Laternen über der Kolonie, Mochi im Forscher-Overall', bundle: 0.8, world: 'orion' },
    { id: 'set-glacies', name: 'Glacies-Forscherset', icon: '❄', items: ['outfit-glacies', 'acc-frost-visor', 'ship-frost', 'engine-crystal', 'impact-frost', 'stall-frost'], text: 'Frostanzug und Visier, Kristall-Lack und Kristallspur, Frostbytes Splitter und die Raureif-Markise', reward: 'frame-aurora', world: 'glacies' },
    { id: 'set-guardians', name: 'Wächter-Trophäen', icon: '👑', items: ['decal-pips', 'impact-frost', 'acc-ember-bell', 'engine-clockwork', 'acc-petal-crown'], text: 'Je ein Look von jedem der fünf Wächter – nur durch Siege', reward: 'frame-guardian' },
    // P1.5: a set for each remaining world, each with a look as its reward (shown in the album's world areas)
    { id: 'set-pyra', name: 'Pyra-Glutset', icon: '🌋', items: ['outfit-pyra', 'ship-ember', 'acc-ember-bell', 'vehicle-ember'], text: 'Mechaniker-Anzug, Glut-Lackierung, Emberbells Glöckchen und die Glutlack-Flotte', reward: 'frame-ember', world: 'pyra' },
    { id: 'set-mekhanos', name: 'Mekhanos-Werkset', icon: '⚙', items: ['outfit-mekhanos', 'engine-clockwork', 'vehicle-brass', 'depot-brass'], text: 'Techniker-Overall, Cogsworths Uhrwerk-Spur, Messing-Flotte und Messingdach', reward: 'frame-gear', world: 'mekhanos' },
    { id: 'set-viridia', name: 'Viridia-Gartenset', icon: '🌿', items: ['outfit-viridia', 'acc-petal-crown', 'shot-petal', 'depot-blossom'], text: 'Botaniker-Kittel, Petalguards Blütenkranz, Blütenblatt-Spur und Blütendach', reward: 'decor-bloomarch', world: 'viridia' }
  ]);
  // the album's areas: the five planets, the guardians, then the kinds of looks (each look shows in every area it fits)
  const COLLECTION_AREAS = Object.freeze([
    { id: 'orion', name: 'Orion', icon: '🪐', has: item => item.world === 'orion' },
    { id: 'glacies', name: 'Glacies', icon: '❄', has: item => item.world === 'glacies' },
    { id: 'pyra', name: 'Pyra', icon: '🌋', has: item => item.world === 'pyra' },
    { id: 'mekhanos', name: 'Mekhanos', icon: '⚙', has: item => item.world === 'mekhanos' },
    { id: 'viridia', name: 'Viridia', icon: '🌿', has: item => item.world === 'viridia' },
    { id: 'guardians', name: 'Wächter', icon: '👑', has: item => Boolean(item.guardian) },
    { id: 'ships', name: 'Raumschiffe', icon: '🚀', has: item => ['ship', 'decal', 'engine', 'muzzle', 'shot', 'impact'].includes(item.slot) },
    { id: 'kittens', name: 'Kätzchen', icon: '🐾', has: item => ['mochi', 'outfit'].includes(item.slot) },
    { id: 'world', name: 'Kolonie & Profil', icon: '🏡', has: item => ['glider', 'trail', 'colony', 'stall', 'mine', 'ring', 'frame'].includes(item.slot) },
    // P1.5: the buildings, vehicles and decorations of the planets
    { id: 'decor', name: 'Bauten & Deko', icon: '🏗', has: item => ['stall', 'depot', 'vehicle', 'decor', 'colony', 'mine'].includes(item.slot) }
  ]);
  function cosmeticDomain(id) {
    const slot = COSMETICS[id]?.slot;
    return COSMETIC_DOMAINS.find(d => d.slots.includes(slot)) || null;
  }
  // how a look is earned (the shop, the forge and the studio show it; nothing here grants or charges)
  function cosmeticSource(id) {
    const item = COSMETICS[id];
    if (!item) return null;
    if (item.credits) return { kind: 'credits', amount: item.credits };
    if (item.gems) return { kind: 'gems', amount: item.gems };
    if (item.forge) return { kind: 'forge', amount: item.forge };
    if (item.achievement) return { kind: 'achievement', id: item.achievement };
    if (item.reward) return { kind: 'set', id: item.reward };
    if (WELCOME_POOL.includes(id)) return { kind: 'welcome' };
    if (SEASON_THEMES.some(t => t.cosmetics.includes(id))) return { kind: 'season' };
    return { kind: 'store' };
  }
  // P1.4 (§ 11): the five kinds of source, kept apart for a fair later shop. Only `currency` costs something today (in
  // currencies earned by playing); `premium` are the old package looks – real money stays off (store and ads `none`).
  const SOURCE_GROUPS = Object.freeze({
    reward: { name: 'Gratis-Belohnung', kinds: ['welcome', 'set'] },
    currency: { name: 'Mit Spielwährung', kinds: ['credits', 'gems', 'forge'] },
    achievement: { name: 'Erfolg', kinds: ['achievement'] },
    event: { name: 'Event', kinds: ['season'] },
    premium: { name: 'Premium (abgeschaltet)', kinds: ['store'] }
  });
  function cosmeticSourceGroup(id) {
    const kind = cosmeticSource(id)?.kind;
    return Object.keys(SOURCE_GROUPS).find(g => SOURCE_GROUPS[g].kinds.includes(kind)) || null;
  }
  const cosmeticRarity = id => (COSMETIC_RARITIES[COSMETICS[id]?.rarity] ? COSMETICS[id].rarity : 'common');
  // the sets a look belongs to (a look may be in more than one: Frostsplitter is Glacies and a guardian trophy)
  const cosmeticSets = id => COSMETIC_SETS.filter(s => s.items.includes(id));
  // the one data model of a look (§ 2.1): everything the shop, the album, the studios and the reveal show
  function cosmeticInfo(id, meta) {
    const item = COSMETICS[id];
    if (!item) return null;
    const owned = Boolean(meta?.cosmetics?.includes(id)),
      worn = item.wear ? Object.values(meta?.wardrobe?.chars || {}).some(c => c?.[item.wear] === id) : meta?.equipped?.[item.slot] === id;
    return {
      id,
      name: item.name,
      icon: item.icon,
      text: item.text || '',
      domain: cosmeticDomain(id)?.id || null,
      slot: item.slot,
      wear: item.wear || null,
      slotName: COSMETIC_SLOT_NAMES[item.slot] || item.slot,
      rarity: cosmeticRarity(id),
      source: cosmeticSource(id),
      group: cosmeticSourceGroup(id),
      world: item.world || null,
      guardian: item.guardian || null,
      sets: cosmeticSets(id).map(s => s.id),
      fits: COSMETIC_FITS[item.slot] || '',
      anim: item.anim || null,
      owned,
      equipped: owned && worn
    };
  }
  // a collection set's state: owned pieces, complete, reward granted (meta.wardrobe.granted is the one "given once" list)
  function setProgress(set, meta) {
    const have = set.items.filter(id => meta?.cosmetics?.includes(id)).length;
    return { have, total: set.items.length, complete: have === set.items.length, rewarded: Boolean(set.reward && meta?.wardrobe?.granted?.includes(set.reward)) };
  }
  // Free welcome capsule: one equal-probability draw per save identity, never sold, never rerolled.
  const WARDROBE_CHARS = Object.freeze(['mochi', 'void', 'boba', 'pip']);
  const WEAR_SLOTS = Object.freeze(['head', 'suit', 'face', 'back']);
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
      equipped: { ship: null, ring: null, trail: null, mochi: null, glider: null, impact: null, engine: null, decal: null, muzzle: null, frame: null, stall: null, shot: null, vehicle: null, depot: null, decor: null },
      decor: {}, // P1.5: the planet decoration per world (planet index -> look id); equipped.decor mirrors the viewed planet
      // P1: what each kitten wears (ownership stays account-wide in meta.cosmetics); granted = achievement looks given
      wardrobe: { chars: emptyWardrobe(), granted: [], hint: false },
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
    for (const slot of EQUIP_SLOTS) {
      const id = raw.equipped?.[slot];
      meta.equipped[slot] = meta.cosmetics.includes(id) && COSMETICS[id]?.slot === slot ? id : null;
    }
    // P1.5: the planet decoration of each world (an owned decor look or nothing); unknown planets are dropped
    meta.decor = {};
    if (raw.decor && typeof raw.decor === 'object' && !Array.isArray(raw.decor))
      for (const [planet, id] of Object.entries(raw.decor)) if (/^[0-9]{1,2}$/.test(planet) && meta.cosmetics.includes(id) && COSMETICS[id]?.slot === 'decor') meta.decor[planet] = id;
    meta.decorAt = Number.isInteger(raw.decorAt) && raw.decorAt >= 0 && raw.decorAt < 100 ? raw.decorAt : null;
    normalizeWardrobe(meta, raw);
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

  // ----- P1 wardrobe: four slots per character, migrated from the single Mochi slots of Beta 1.x -----
  function emptyWardrobe() {
    const chars = {};
    for (const c of WARDROBE_CHARS) chars[c] = { head: null, suit: null, face: null, back: null };
    return chars;
  }
  const wearable = (meta, id, slot) => typeof id === 'string' && meta.cosmetics.includes(id) && COSMETICS[id]?.wear === slot;
  function normalizeWardrobe(meta, raw) {
    const w = { chars: emptyWardrobe(), granted: [], hint: false },
      src = raw.wardrobe && typeof raw.wardrobe === 'object' ? raw.wardrobe : null;
    if (src?.chars && typeof src.chars === 'object') {
      for (const c of WARDROBE_CHARS) for (const slot of WEAR_SLOTS) if (wearable(meta, src.chars[c]?.[slot], slot)) w.chars[c][slot] = src.chars[c][slot];
    } else {
      // migration from Beta 1.x: Mochi's accessory slot and the outfit slot become Mochi's head/face/back and suit
      const acc = raw.equipped?.mochi,
        outfit = raw.equipped?.outfit;
      if (typeof acc === 'string' && COSMETICS[acc]?.wear && wearable(meta, acc, COSMETICS[acc].wear)) w.chars.mochi[COSMETICS[acc].wear] = acc;
      if (wearable(meta, outfit, 'suit')) w.chars.mochi.suit = outfit;
    }
    if (Array.isArray(src?.granted)) w.granted = [...new Set(src.granted.filter(id => typeof id === 'string' && id.length <= 40))].slice(0, 50);
    w.hint = src?.hint === true;
    meta.wardrobe = w;
    syncLegacyEquipped(meta);
    return w;
  }
  // The Beta 1.x slots mirror Mochi, so an older build reading this save still shows Mochi's look: the first
  // accessory Mochi wears (head, face, back) and the outfit.
  function syncLegacyEquipped(meta) {
    const m = meta.wardrobe?.chars?.mochi;
    if (!m) return;
    meta.equipped.mochi = [m.head, m.face, m.back].find(id => id && COSMETICS[id]?.slot === 'mochi') || null;
    meta.equipped.outfit = m.suit && COSMETICS[m.suit]?.slot === 'outfit' ? m.suit : null;
  }
  // a cosmetic leaves every kitten that wears it (refund of a package)
  function unwearEverywhere(meta, id) {
    for (const c of Object.values(meta.wardrobe?.chars || {})) for (const slot of WEAR_SLOTS) if (c[slot] === id) c[slot] = null;
    syncLegacyEquipped(meta);
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
      for (const planet of Object.keys(meta.decor || {})) if (meta.decor[planet] === id) delete meta.decor[planet];
      unwearEverywhere(meta, id);
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
    WARDROBE_CHARS,
    WEAR_SLOTS,
    syncLegacyEquipped,
    COSMETIC_DOMAINS,
    COSMETIC_RARITIES,
    COSMETIC_WORLDS,
    COSMETIC_GUARDIANS,
    COSMETIC_SETS,
    COSMETIC_FITS,
    COLLECTION_AREAS,
    SOURCE_GROUPS,
    cosmeticSourceGroup,
    cosmeticRarity,
    cosmeticSets,
    cosmeticInfo,
    setProgress,
    COSMETIC_SLOT_NAMES,
    EQUIP_SLOTS,
    cosmeticDomain,
    cosmeticSource,
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
