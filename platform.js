// Platform bridge: Capacitor (Android) lifecycle, hardware back button, haptics, status bar and the PWA service worker.
// Loaded after game.js; uses its globals (save, gameTick, topModal, closeModal, currentScreen, showScreen, toast).
(function () {
  'use strict';
  const cap = window.Capacitor;
  const isNative = Boolean(cap?.isNativePlatform?.());
  const plugins = cap?.Plugins || {};
  let lastBackAt = 0;

  function haptic(kind = 'light') {
    if (!window.NebulaAudio?.settings.haptics) return;
    try {
      if (isNative && plugins.Haptics) {
        if (kind === 'success') plugins.Haptics.notification({ type: 'SUCCESS' });
        else if (kind === 'warning') plugins.Haptics.notification({ type: 'WARNING' });
        else plugins.Haptics.impact({ style: kind === 'heavy' ? 'HEAVY' : kind === 'medium' ? 'MEDIUM' : 'LIGHT' });
      } else if (navigator.vibrate && matchMedia('(pointer: coarse)').matches && navigator.userActivation?.hasBeenActive !== false) {
        navigator.vibrate(kind === 'heavy' ? 30 : kind === 'medium' ? 18 : kind === 'success' ? [12, 40, 12] : 8);
      }
    } catch {}
  }

  // Android back: close dialog → return to the farm screen → second press within 2s leaves the app.
  function handleBack() {
    const modal = typeof topModal === 'function' ? topModal() : null;
    if (modal) {
      if (modal !== 'introModal') closeModal(modal);
      return;
    }
    if (typeof currentScreen === 'function' && currentScreen() !== 'home') {
      showScreen('home');
      return;
    }
    const now = Date.now();
    if (now - lastBackAt < 2000) {
      save();
      plugins.App?.minimizeApp?.();
      return;
    }
    lastBackAt = now;
    toast('Erneut „Zurück“ drücken, um das Spiel zu verlassen.');
  }

  if (isNative) {
    document.documentElement.classList.add('native-app');
    plugins.App?.addListener?.('backButton', handleBack);
    plugins.App?.addListener?.('appStateChange', ({ isActive }) => {
      if (isActive) gameTick();
      else save();
    });
    plugins.App?.addListener?.('pause', () => save());
    plugins.App?.addListener?.('resume', () => gameTick());
    plugins.StatusBar?.setStyle?.({ style: 'DARK' }).catch?.(() => {});
    plugins.StatusBar?.setBackgroundColor?.({ color: '#071329' }).catch?.(() => {});
    plugins.SplashScreen?.hide?.().catch?.(() => {});
  } else {
    window.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        const modal = typeof topModal === 'function' ? topModal() : null;
        if (modal && modal !== 'introModal') closeModal(modal);
      }
    });
  }

  // Service worker only for the hosted PWA; local dev and the native app must never serve stale caches.
  if ('serviceWorker' in navigator) {
    const localHost = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
    if (!isNative && location.protocol === 'https:' && !localHost) {
      navigator.serviceWorker.register('./service-worker.js').catch(() => {});
    } else {
      navigator.serviceWorker
        .getRegistrations?.()
        .then(registrations => registrations.forEach(registration => registration.unregister()))
        .catch(() => {});
    }
  }

  window.NebulaPlatform = { isNative, platform: cap?.getPlatform?.() || 'web', haptic, handleBack };
})();
