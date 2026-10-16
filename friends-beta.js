// Friends Beta layer (hosted browser beta, see docs/FRIENDS_BETA.md). Active only when the bundle was built with
// `tools/build.mjs --friends-beta` (window.NEBULA_CONFIG.channel === 'friends-beta'); in every other build this file
// does nothing. It never touches the save: it shows which build runs, offers a copyable feedback report and tells the
// player when a newer deployment exists - a reload is always the player's own decision.
(() => {
  'use strict';
  const config = window.NEBULA_CONFIG || {};
  const active = config.channel === 'friends-beta';
  const NOTICE_KEY = 'space-kittens-friends-beta-notice-v1';
  const errors = [];
  const $ = id => document.getElementById(id);
  const pad = n => String(n).padStart(2, '0');

  // last few script errors of this session (message only, never stored or sent anywhere) for the feedback report
  const remember = text => {
    errors.push(String(text || 'unbekannt').slice(0, 160));
    if (errors.length > 5) errors.shift();
  };
  window.addEventListener('error', event => remember(event.message));
  window.addEventListener('unhandledrejection', event => remember(event.reason?.message || event.reason));

  const buildLine = () => {
    const built = config.buildDate ? new Date(config.buildDate) : null;
    const date = built && !Number.isNaN(built.getTime()) ? `${built.getFullYear()}-${pad(built.getMonth() + 1)}-${pad(built.getDate())}` : null;
    return ['Friends Beta', 'v' + (config.version || '?'), config.commitShort || 'unknown', date && 'gebaut ' + date]
      .filter(Boolean)
      .join(' · ');
  };

  // coarse device description: platform + browser family + screen, no raw user-agent string
  const deviceLine = () => {
    const ua = navigator.userAgent || '';
    const os = /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'unbekannt';
    const browser = /EdgA?\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Firefox|FxiOS/.test(ua) ? 'Firefox' : /CriOS|Chrome/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : 'unbekannt';
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
    return `${os} · ${browser} · Fenster ${innerWidth}×${innerHeight} @${window.devicePixelRatio || 1}x · ${standalone ? 'Home-Bildschirm-App' : 'Browser-Tab'} · ${navigator.language || '?'}`;
  };

  const progressLine = () => {
    try {
      const screen = document.querySelector('.screen.active')?.id || '?';
      const planets = Array.isArray(state.planetsUnlocked) ? state.planetsUnlocked.filter(Boolean).length : '?';
      return `Tab ${screen} · Planeten ${planets} · Gesamt verdient ${Math.round(state.totalEarned || 0)} · Sternenstaub ${Math.round(state.stardust || 0)} · Schema ${state.schemaVersion ?? '?'}`;
    } catch {
      return 'nicht lesbar';
    }
  };

  const CATEGORIES = {
    gefiel: 'Das hat mir gefallen',
    verwirrend: 'Das war verwirrend',
    fehler: 'Fehler / Absturz',
    ruckeln: 'Ruckelt / langsam',
    steuerung: 'Steuerung schwierig',
    optik: 'Sieht nicht schön aus',
    sonst: 'Sonstiges'
  };

  function buildReport() {
    const category = $('betaFeedbackCategory')?.value || 'sonst';
    const text = ($('betaFeedbackText')?.value || '').trim();
    return [
      'Space Kittens – Friends-Beta-Feedback',
      'Build: ' + buildLine() + (config.commit && config.commit !== 'unknown' ? ' (' + config.commit + ')' : ''),
      'Kategorie: ' + (CATEGORIES[category] || category),
      'Gerät: ' + deviceLine(),
      'Spielstand: ' + progressLine(),
      'Letzte Fehler: ' + (errors.length ? errors.join(' | ') : 'keine'),
      '',
      text || '(keine Beschreibung)'
    ].join('\n');
  }

  const refreshPreview = () => {
    const preview = $('betaFeedbackPreview');
    if (preview) preview.textContent = buildReport();
  };

  async function copyReport() {
    const report = buildReport();
    try {
      await navigator.clipboard.writeText(report);
      toast('Bericht kopiert – füge ihn in eine Nachricht an den Entwickler ein.');
    } catch {
      const area = $('betaFeedbackFallback');
      if (area) {
        area.value = report;
        area.classList.remove('hidden');
        area.focus();
        area.select();
      }
      toast('Bericht markiert – bitte manuell kopieren.');
    }
  }

  async function shareReport() {
    if (!navigator.share) return copyReport();
    try {
      await navigator.share({ title: 'Space Kittens Friends Beta', text: buildReport() });
    } catch {
      // cancelled by the player: nothing was sent, nothing to report
    }
  }

  function openFeedback() {
    if ($('betaFeedbackFallback')) $('betaFeedbackFallback').classList.add('hidden');
    if ($('betaFeedbackShare')) $('betaFeedbackShare').classList.toggle('hidden', !navigator.share);
    refreshPreview();
    openModal('betaFeedbackModal');
  }

  // ----- update discovery -----
  let latest = null;
  let lastProbe = 0;
  async function probeVersion() {
    if (!active || !config.commit || config.commit === 'unknown') return;
    if (Date.now() - lastProbe < 60000) return;
    lastProbe = Date.now();
    try {
      const response = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
      if (!response.ok) return;
      const info = await response.json();
      if (info.commit && info.commit !== config.commit) {
        latest = info;
        showUpdateBar();
        $('betaUpdateRow')?.classList.remove('hidden');
      }
      // refresh the offline copy in the background (the worker file changed with the deployment)
      navigator.serviceWorker?.getRegistration?.().then(registration => registration?.update?.()).catch(() => {});
    } catch {
      // offline or blocked: try again at the next probe
    }
  }

  const fullscreenCombat = () => document.body.classList.contains('expedition-on');
  const anyDialog = () => typeof topModal === 'function' && Boolean(topModal());

  function showUpdateBar() {
    const bar = $('betaUpdateBar');
    if (!bar || !latest || bar.dataset.dismissed === '1') return;
    // never interrupt a fight or a dialog; the check repeats on the next tick
    if (fullscreenCombat() || anyDialog()) return;
    $('betaNotice')?.classList.add('hidden');
    bar.classList.remove('hidden');
  }

  function reloadForUpdate() {
    try {
      save();
    } catch {
      // the game saves continuously anyway
    }
    location.reload();
  }

  // ----- first-run notice (shown once, never during the intro, a dialog or a fight) -----
  function maybeShowNotice() {
    const card = $('betaNotice');
    if (!active || !card) return;
    try {
      if (localStorage.getItem(NOTICE_KEY)) return;
    } catch {
      // storage blocked: show it every session, it is dismissible
    }
    if (fullscreenCombat() || anyDialog() || !$('introModal')?.classList.contains('hidden')) return;
    if (!$('betaUpdateBar')?.classList.contains('hidden')) return;
    card.classList.remove('hidden');
  }

  function dismissNotice() {
    $('betaNotice')?.classList.add('hidden');
    try {
      localStorage.setItem(NOTICE_KEY, '1');
    } catch {
      // ignore
    }
  }

  // called by renderSettings() every time the settings dialog opens
  function decorateSettings() {
    if (!active) return;
    $('betaGroup')?.classList.remove('hidden');
    const label = $('versionLabel');
    if (label) label.textContent += ' · ' + buildLine() + (config.commit && config.commit !== 'unknown' ? ' · ' + config.commit : '');
    const row = $('betaUpdateRow');
    if (row) row.classList.toggle('hidden', !latest);
  }

  function init() {
    if (!active) return;
    $('betaFeedbackOpen')?.addEventListener('click', openFeedback);
    $('betaFeedbackCategory')?.addEventListener('change', refreshPreview);
    $('betaFeedbackText')?.addEventListener('input', refreshPreview);
    $('betaFeedbackCopy')?.addEventListener('click', copyReport);
    $('betaFeedbackShare')?.addEventListener('click', shareReport);
    $('betaUpdateReload')?.addEventListener('click', reloadForUpdate);
    $('betaUpdateLater')?.addEventListener('click', () => {
      const bar = $('betaUpdateBar');
      if (bar) {
        bar.dataset.dismissed = '1';
        bar.classList.add('hidden');
      }
    });
    $('betaUpdateSettings')?.addEventListener('click', reloadForUpdate);
    $('betaNoticeOk')?.addEventListener('click', dismissNotice);
    $('betaNoticeFeedback')?.addEventListener('click', () => {
      dismissNotice();
      openFeedback();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') probeVersion();
    });
    setTimeout(probeVersion, 20000);
    setInterval(probeVersion, 15 * 60 * 1000);
    setInterval(() => {
      maybeShowNotice();
      showUpdateBar();
    }, 4000);
    setTimeout(maybeShowNotice, 3000);
  }

  window.FriendsBeta = { active, buildLine, buildReport, decorateSettings, probeVersion, errors };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
