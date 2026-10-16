// Reusable idle-game engine core (theme-independent). No game rules or game-specific content in this file.
// Exposes window.IdleEngine = { events, math, ParticlePool, SceneRuntime }.
(function () {
  'use strict';

  // ---------------------------------------------------------------------------------------------------------------
  // Event bus: gameplay emits facts ("attack", "harvest"); presentation layers subscribe. Listeners must not throw
  // into gameplay code, so errors are isolated and logged.
  function createEventBus() {
    const handlers = new Map();
    return {
      on(type, handler) {
        if (!handlers.has(type)) handlers.set(type, new Set());
        handlers.get(type).add(handler);
        return () => handlers.get(type)?.delete(handler);
      },
      emit(type, payload = {}) {
        const set = handlers.get(type);
        if (!set) return;
        for (const handler of [...set]) {
          try {
            handler(payload);
          } catch (error) {
            console.error('[IdleEngine] listener for "' + type + '" failed', error);
          }
        }
      },
      count(type) {
        return handlers.get(type)?.size || 0;
      }
    };
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Math / drawing helpers
  const math = {
    clamp: (value, min, max) => Math.min(max, Math.max(min, value)),
    lerp: (a, b, t) => a + (b - a) * t,
    easeOutCubic: t => 1 - Math.pow(1 - t, 3),
    easeInOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
    easeOutBack: t => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2),
    // Deterministic RNG for procedural art (same seed → same procedural texture).
    seeded(seed) {
      let s = seed >>> 0 || 1;
      return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
    hash: text => [...String(text)].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261),
    // Approaches target exponentially, frame-rate independent.
    damp: (current, target, rate, dt) => target + (current - target) * Math.exp(-rate * dt)
  };

  // ---------------------------------------------------------------------------------------------------------------
  // Particle pool: fixed capacity, no allocations per particle after warm-up.
  class ParticlePool {
    constructor(capacity) {
      this.capacity = capacity;
      this.items = Array.from({ length: capacity }, () => ({ alive: false }));
      this.active = 0;
    }
    spawn(props) {
      // Reuse a dead slot; if full, recycle the oldest particle instead of growing.
      let slot = null,
        oldest = null;
      for (const item of this.items) {
        if (!item.alive) {
          slot = item;
          break;
        }
        if (!oldest || item.age / item.life > oldest.age / oldest.life) oldest = item;
      }
      slot = slot || oldest;
      if (!slot.alive) this.active++;
      Object.assign(
        slot,
        {
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          ax: 0,
          ay: 0,
          age: 0,
          life: 1,
          size: 2,
          color: '#fff',
          drag: 0,
          kind: 'dot',
          alpha: 1
        },
        props,
        {
          alive: true
        }
      );
      return slot;
    }
    update(dt) {
      for (const p of this.items) {
        if (!p.alive) continue;
        p.age += dt;
        if (p.age >= p.life) {
          p.alive = false;
          this.active--;
          continue;
        }
        p.vx += p.ax * dt;
        p.vy += p.ay * dt;
        if (p.drag) {
          const f = Math.exp(-p.drag * dt);
          p.vx *= f;
          p.vy *= f;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    }
    forEach(fn) {
      for (const p of this.items) if (p.alive) fn(p);
    }
    clear() {
      for (const p of this.items) p.alive = false;
      this.active = 0;
    }
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Scene runtime: exactly one requestAnimationFrame loop for all canvas scenes. Scenes render only while their
  // canvas is visible on screen, the document is visible and the scene is mounted. Handles DPR, quality levels,
  // reduced motion and frame statistics.
  function createSceneRuntime({ getSettings = () => ({}) } = {}) {
    const scenes = new Set();
    let frameHandle = null,
      lastTime = 0;
    const stats = { frames: 0, slowFrames: 0, totalFrameMs: 0, maxFrameMs: 0, loopStarts: 0, lastDt: 0 };
    const raf = window.requestAnimationFrame?.bind(window) || (fn => setTimeout(() => fn(performance.now()), 16));
    const caf = window.cancelAnimationFrame?.bind(window) || clearTimeout;

    function quality() {
      const setting = getSettings().effects || 'auto';
      if (setting === 'low' || setting === 'high') return setting;
      // Auto: degrade when the measured frame time is poor.
      const avg = stats.frames > 60 ? stats.totalFrameMs / stats.frames : 0;
      return avg > 22 ? 'low' : 'high';
    }
    function reducedMotion() {
      return document.documentElement.classList.contains('reduce-motion');
    }
    function shouldRun() {
      if (document.hidden) return false;
      for (const scene of scenes) if (scene.visible) return true;
      return false;
    }
    function frame(time) {
      frameHandle = null;
      const dt = Math.min(0.1, Math.max(0, (time - (lastTime || time)) / 1000));
      lastTime = time;
      const started = performance.now();
      const context = { dt, time: time / 1000, quality: quality(), reducedMotion: reducedMotion() };
      for (const scene of scenes) {
        if (!scene.visible) continue;
        scene.resizeIfNeeded();
        try {
          scene.frame(context);
        } catch (error) {
          console.error('[IdleEngine] scene "' + scene.name + '" frame failed', error);
        }
      }
      const cost = performance.now() - started;
      stats.frames++;
      stats.totalFrameMs += cost;
      stats.maxFrameMs = Math.max(stats.maxFrameMs, cost);
      stats.lastDt = dt;
      if (dt > 1 / 40) stats.slowFrames++;
      if (shouldRun()) frameHandle = raf(frame);
      else lastTime = 0;
    }
    function wake() {
      if (frameHandle === null && shouldRun()) {
        stats.loopStarts++;
        lastTime = 0;
        frameHandle = raf(frame);
      }
    }
    document.addEventListener('visibilitychange', wake);

    function mount(name, canvas, scene) {
      // Beta 1.4 M0: the canvas size comes from a ResizeObserver instead of a getBoundingClientRect() in every frame —
      // reading layout inside the animation frame after DOM writes (timers, HUD) forced a synchronous layout per frame.
      // A fresh read happens only when no observation exists yet (first frame, just shown again, no ResizeObserver).
      let observed = null;
      const sizeObserver =
        'ResizeObserver' in window
          ? new ResizeObserver(entries => {
              const e = entries[entries.length - 1],
                box = e.borderBoxSize?.[0];
              observed = box ? { width: box.inlineSize, height: box.blockSize } : { width: e.contentRect.width, height: e.contentRect.height };
              if (!(observed.width > 0 && observed.height > 0)) observed = null;
            })
          : null;
      sizeObserver?.observe(canvas);
      const entry = {
        name,
        canvas,
        visible: false,
        width: 0,
        height: 0,
        dpr: 1,
        ctx: canvas.getContext?.('2d') || null,
        forgetSize() {
          observed = null;
        },
        resizeIfNeeded() {
          let rect = observed;
          if (!rect) {
            // one direct read fills the cache; later changes arrive through the ResizeObserver
            rect = canvas.getBoundingClientRect();
            if (sizeObserver && rect.width > 0 && rect.height > 0) observed = { width: rect.width, height: rect.height };
          }
          const cap = quality() === 'low' ? 1.25 : 2;
          const dpr = Math.min(cap, window.devicePixelRatio || 1);
          const w = Math.max(1, Math.round(rect.width)),
            h = Math.max(1, Math.round(rect.height));
          if (w !== this.width || h !== this.height || dpr !== this.dpr) {
            this.width = w;
            this.height = h;
            this.dpr = dpr;
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(h * dpr);
            scene.resize?.(w, h, dpr);
          }
        },
        frame(context) {
          if (!this.ctx) return;
          this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
          scene.update?.(context);
          scene.draw?.(this.ctx, this.width, this.height, context);
        }
      };
      scenes.add(entry);
      // Visibility: on-screen (IntersectionObserver) AND its screen is shown.
      let onScreen = true;
      const update = () => {
        const shown = canvas.offsetParent !== null || canvas.getClientRects?.().length > 0;
        const was = entry.visible;
        entry.visible = Boolean(onScreen && shown);
        if (entry.visible && !was) scene.onShow?.();
        if (!entry.visible && was) scene.onHide?.();
        wake();
      };
      let observer = null;
      if ('IntersectionObserver' in window) {
        observer = new IntersectionObserver(entries => {
          onScreen = entries.some(e => e.isIntersecting);
          update();
        });
        observer.observe(canvas);
      }
      update();
      return {
        refresh: update,
        get visible() {
          return entry.visible;
        },
        unmount() {
          observer?.disconnect();
          sizeObserver?.disconnect();
          scenes.delete(entry);
          scene.destroy?.();
        }
      };
    }

    return {
      mount,
      wake,
      stats,
      quality,
      get running() {
        return frameHandle !== null;
      },
      get sceneCount() {
        return scenes.size;
      },
      refreshAll() {
        for (const scene of scenes) {
          scene.forgetSize?.();
          scene.resizeIfNeeded?.();
        }
        wake();
      }
    };
  }

  window.IdleEngine = Object.freeze({
    events: createEventBus(),
    createEventBus,
    math,
    ParticlePool,
    createSceneRuntime
  });
})();
