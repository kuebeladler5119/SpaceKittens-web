// PWA offline support. Network-first so updates are picked up immediately; cache is the offline fallback.
// Not registered inside the Android app (Capacitor serves files locally) or on local dev hosts.
const CACHE = 'space-kittens-fb-a0c31cbdea82';
const CORE = [
  "./arena-ui.js",
  "./arena.js",
  "./arsenal-ui.js",
  "./arsenal.js",
  "./artifacts-ui.js",
  "./artifacts.js",
  "./assets/fonts/OFL-Nunito.txt",
  "./assets/fonts/OFL-SpaceGrotesk.txt",
  "./assets/fonts/nunito-latin-500-normal.woff2",
  "./assets/fonts/nunito-latin-700-normal.woff2",
  "./assets/fonts/nunito-latin-800-normal.woff2",
  "./assets/fonts/nunito-latin-900-normal.woff2",
  "./assets/fonts/space-grotesk-latin-500-normal.woff2",
  "./assets/fonts/space-grotesk-latin-700-normal.woff2",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/icon-maskable-512.png",
  "./assets/icon.svg",
  "./assets/nebula-farm-hero.webp",
  "./audio.js",
  "./batch-ui.js",
  "./bazaar.js",
  "./campaign-ui.js",
  "./campaign.js",
  "./challenge-ui.js",
  "./challenge.js",
  "./chest-reveal.js",
  "./cogsworth-ui.js",
  "./collection.js",
  "./combat-cat-ui.js",
  "./combat-cat.js",
  "./combat-control.js",
  "./combat-gun.js",
  "./combat-tutorial.js",
  "./combat-ui.js",
  "./config.js",
  "./core.js",
  "./credits.html",
  "./deepcore-ui.js",
  "./deepcore.js",
  "./dna-ui.js",
  "./dna.js",
  "./dna2-ui.js",
  "./dna2.js",
  "./engine/core.js",
  "./expedition-ui.js",
  "./fabrication-ui.js",
  "./fabrication.js",
  "./forge-ui.js",
  "./frame-pacing.js",
  "./freight-ui.js",
  "./freight.js",
  "./friends-beta.js",
  "./frostbyte.js",
  "./ftue.js",
  "./game-data.js",
  "./game.js",
  "./gear-loop.js",
  "./income.js",
  "./",
  "./index.html",
  "./industry-ui.js",
  "./industry.js",
  "./legal.css",
  "./logistics.js",
  "./lore.js",
  "./manifest.webmanifest",
  "./market.js",
  "./mekhanos.js",
  "./menu-ui.js",
  "./mobile-ux.js",
  "./monetization.js",
  "./onboarding-state.js",
  "./onboarding.js",
  "./outer-campaigns-ui.js",
  "./outer-campaigns.js",
  "./persistence.js",
  "./petalguard-ui.js",
  "./planet-gate.js",
  "./platform.js",
  "./prestige-ui.js",
  "./privacy.html",
  "./pyra-ui.js",
  "./pyra.js",
  "./rematch.js",
  "./research-ui.js",
  "./research.js",
  "./reveal.js",
  "./scenes/arena-scene.js",
  "./scenes/art.js",
  "./scenes/boot.js",
  "./scenes/colony-art.js",
  "./scenes/colony-scene.js",
  "./scenes/combat-scene.js",
  "./scenes/cosmetic-art.js",
  "./scenes/dna-visuals.js",
  "./scenes/enemy-art-outer.js",
  "./scenes/enemy-art.js",
  "./scenes/kittens.js",
  "./scenes/mekhanos-art.js",
  "./scenes/mine-art.js",
  "./scenes/mine-scene.js",
  "./scenes/planet-layouts.js",
  "./scenes/pyra-art.js",
  "./scenes/ship-art.js",
  "./scenes/viridia-art.js",
  "./ship-studio.js",
  "./shop-ui.js",
  "./styles.css",
  "./transport.js",
  "./views-ux.js",
  "./viridia.js",
  "./wardrobe.js",
  "./world-shell.js"
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(cache => Promise.allSettled(CORE.map(url => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      // only older Space Kittens caches: the browser build may share its origin with other games (GitHub Pages)
      .then(keys => Promise.all(keys.filter(key => key !== CACHE && key.startsWith('space-kittens')).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request, { ignoreSearch: true }).then(cached => cached || caches.match('./index.html')))
  );
});
