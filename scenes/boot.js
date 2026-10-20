// Mounts the Space Kittens canvas scenes into the existing screens. Loaded after game.js.
// One shared render loop (engine/core.js); scenes pause automatically when hidden or off-screen.
(function () {
  'use strict';
  if (!window.IdleEngine || !window.NebulaScenes || !window.NebulaView) return;
  const runtime = window.IdleEngine.createSceneRuntime({ getSettings: () => window.NebulaAudio?.settings || {} });
  const events = window.IdleEngine.events;
  const mounted = {};

  function mountScene(name, host, factory, getView, before = null) {
    if (!host) return;
    const canvas = document.createElement('canvas');
    canvas.className = 'scene-canvas scene-' + name;
    canvas.setAttribute('aria-hidden', 'true');
    host.insertBefore(canvas, before || host.firstChild);
    host.classList.add('has-scene');
    const scene = factory({ getView, events, actions: window.NebulaColonyActions || {} });
    scene.attach?.(canvas);
    mounted[name] = { scene, handle: runtime.mount(name, canvas, scene), canvas };
  }

  mountScene('colony', document.getElementById('heroCard'), window.NebulaScenes.createColonyScene, window.NebulaView.colony);
  // Deep Core: the underground of the same colony shares the card; CSS shows one of the two canvases.
  if (window.NebulaScenes.createMineScene && window.NebulaView.mine)
    mountScene('mine', document.getElementById('heroCard'), window.NebulaScenes.createMineScene, window.NebulaView.mine);
  document.getElementById('mochiFocus')?.addEventListener('click', () => mounted.colony?.scene.focusMochi());
  mountScene(
    'combat',
    document.getElementById('enemyCard'),
    window.NebulaScenes.createCombatScene,
    window.NebulaView.combat
  );

  // Beta 1.4 M4: the Combat 2.0 arena shares the enemy card; CSS shows it only while an arena wave runs
  if (window.NebulaScenes.createArenaScene && window.NebulaView.arena)
    // inserted right after the combat canvas, so code that looks for the card's first canvas still finds the combat scene
    mountScene('arena', document.getElementById('expStage') || document.getElementById('enemyCard'), window.NebulaScenes.createArenaScene, window.NebulaView.arena, document.getElementById('expStage') ? null : mounted.combat?.canvas.nextSibling || null);

  // Screen switches change visibility; refresh so the loop starts/stops immediately.
  document.addEventListener('click', event => {
    if (event.target.closest('[data-screen]'))
      setTimeout(() => Object.values(mounted).forEach(m => m.handle.refresh()), 0);
  });
  window.addEventListener('resize', () => runtime.refreshAll());

  // Kitten portraits for static UI (brand, intro).
  const portrait = typeof kitPortraitURL === 'function' && typeof state !== 'undefined' ? kitPortraitURL('mochi', 'happy', 96) : window.SpaceKittens?.portraitURL(0, 'happy', 96, null);
  if (portrait) {
    document.getElementById('brandKitten')?.setAttribute('src', portrait);
    document.getElementById('introKitten')?.setAttribute('src', portrait);
  }

  window.NebulaScenesRuntime = {
    runtime,
    mounted,
    debug() {
      return Object.fromEntries(
        Object.entries(mounted).map(([name, m]) => [name, { visible: m.handle.visible, ...(m.scene.debug?.() || {}) }])
      );
    }
  };
})();
