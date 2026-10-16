// Deep Core underground scene: a vertically scrollable cross-section of the colony's mine. Everything shown comes
// from the view model (NebulaView.mine), whose phases are the saved simulation state (deepcore.js): the cabin is
// where the elevator state machine says (interpolated inside the current phase), carriers and the manual kitten walk
// by their own phases, crates appear when material really moves, construction is drawn from its saved progress.
// Narrow screens may draw fewer miners — the economy never depends on what is drawn.
(function () {
  'use strict';
  const { math, ParticlePool } = window.IdleEngine;
  const Kit = window.SpaceKittens;
  const TAP_SLOP = 8;
  const MANAGER_POSE = { mining: 'check', elevator: 'operate' };
  const MINER_OUTFIT = { hat: 'hardhat', hatColor: '#ffcc33', item: 'lamp' };

  function createMineScene({ getView, events, actions }) {
    let w = 360,
      h = 480,
      k = 40,
      view = null,
      time = 0,
      reduced = false,
      quality = 'high',
      canvasEl = null,
      shown = false;
    const L = {}; // layout
    // Header band (CSS px) reserved for the DOM HUD: the world is drawn and clipped below it, so floors never scroll
    // under the buttons; the camera works with the visible height `h - head`.
    let head = 0;
    const visH = () => Math.max(1, h - head);
    const cam = { y: 0, target: 0, vel: 0 };
    let pointer = null;
    const hits = [];
    const particles = new ParticlePool(140);
    const layerCache = new Map();
    const construct = new Map(); // shaft id → 0..1 progress of the build celebration
    const stats = { taps: 0, drags: 0, wheel: 0, drawnFloors: 0, builds: 0, elevatorCycles: 0, carriersDrawn: 0 };
    let lastPhase = '';
    let frozenTime = null; // review tool only: a fixed scene time makes frame sequences reproducible

    function layout() {
      k = math.clamp(Math.min(h * 0.085, w / 10.5), 26, 44);
      // Living Worlds 2.0: the top of the mine is the planet's outdoors (sky, horizon, ground, the mining outpost), then
      // a geological cut down to the first shaft — the shaft visibly passes through real ground
      L.surface = 8.6 * k;
      L.ground = 6.2 * k;
      L.fh = 3.3 * k; // floor height
      L.ex = Math.max(1.25 * k, Math.min(w * 0.17, 2.4 * k)); // elevator column centre
      L.tunnelX0 = L.ex + 0.95 * k;
      layerCache.clear();
    }
    function floors() {
      return view?.floors || [];
    }
    function floorTop(i) {
      return L.surface + i * L.fh;
    }
    function floorY(i) {
      return floorTop(i) + L.fh - 0.5 * k; // platform surface
    }
    function worldH() {
      return L.surface + floors().length * L.fh + 0.6 * k;
    }
    function maxCam() {
      return Math.max(0, worldH() - visH());
    }
    // Camera jumps (quick navigation)
    function focusFloor(i) {
      cam.target = math.clamp(floorTop(i) - visH() * 0.22, 0, maxCam());
    }
    function focusTop() {
      cam.target = 0;
    }
    function indexOf(pred) {
      return floors().findIndex(pred);
    }

    // ----- input: vertical drag (with scroll chaining at the bounds), wheel, taps -----
    function attach(canvas) {
      canvasEl = canvas;
      canvas.style.touchAction = 'none';
      canvas.addEventListener('pointerdown', e => {
        pointer = { id: e.pointerId, x0: e.clientX, y0: e.clientY, y: e.clientY, camY: cam.target, dragging: false };
      });
      canvas.addEventListener('pointermove', e => {
        if (!pointer || e.pointerId !== pointer.id) return;
        const dy = e.clientY - pointer.y0;
        // Beta 1.7: a finger that wandered (any direction) is no tap any more
        if (Math.hypot(e.clientX - pointer.x0, dy) > TAP_SLOP * 1.5) pointer.moved = true;
        if (!pointer.dragging && Math.abs(dy) > TAP_SLOP && Math.abs(dy) > Math.abs(e.clientX - pointer.x0)) {
          pointer.dragging = true;
          stats.drags++;
          canvas.setPointerCapture?.(e.pointerId);
        }
        if (pointer.dragging) {
          const step = pointer.y - e.clientY;
          pointer.y = e.clientY;
          const want = cam.y + step,
            clamped = math.clamp(want, 0, maxCam());
          // At the top/bottom of the mine the page itself scrolls (no trapped page scroll).
          if (want !== clamped) window.scrollBy(0, want - clamped);
          cam.vel = step * 0.6;
          cam.target = cam.y = clamped;
        }
      });
      const end = e => {
        if (!pointer || e.pointerId !== pointer.id) return;
        const wasDrag = pointer.dragging,
          moved = pointer.moved;
        pointer = null;
        if (wasDrag) {
          cam.target = math.clamp(cam.y + cam.vel * 6, 0, maxCam());
          return;
        }
        if (e.type === 'pointercancel' || moved) return;
        stats.taps++;
        const rect = canvas.getBoundingClientRect(),
          sy = e.clientY - rect.top;
        if (sy < head) return; // the header band belongs to the HUD
        handleTap({ x: e.clientX - rect.left, y: sy - head + cam.y });
      };
      canvas.addEventListener('pointerup', end);
      canvas.addEventListener('pointercancel', end);
      canvas.addEventListener(
        'wheel',
        e => {
          const want = cam.target + e.deltaY,
            clamped = math.clamp(want, 0, maxCam());
          if (clamped === cam.target) return; // nothing to scroll here → let the page scroll
          e.preventDefault();
          stats.wheel++;
          cam.target = clamped;
        },
        { passive: false }
      );
    }
    function handleTap(p) {
      const hit = [...hits].reverse().find(r => p.x >= r.x0 && p.x <= r.x1 && p.y >= r.y0 && p.y <= r.y1);
      if (!hit) return;
      actions.mineTap?.(hit.type, hit.key);
    }

    // ----- events from the game (presentation only) -----
    const off = [];
    if (events) {
      off.push(
        events.on('shaft-built', e => {
          if (!shown) return;
          construct.set(e.shaft, 0);
          stats.builds++;
        })
      );

    }

    // ----- update -----
    function update(ctx) {
      const dt = ctx.dt;
      time = frozenTime !== null ? frozenTime : time + dt;
      reduced = ctx.reducedMotion;
      quality = ctx.quality;
      view = getView();
      if (!view) return;
      head = Math.max(0, Math.min(h * 0.4, view.headerPx || 0));
      cam.target = math.clamp(cam.target, 0, maxCam());
      if (!pointer?.dragging) cam.y = math.damp(cam.y, cam.target, reduced ? 30 : 9, dt);
      for (const [id, p] of construct) {
        const next = p + dt / 3.2;
        if (next >= 1) construct.delete(id);
        else construct.set(id, next);
        if (!reduced && Math.random() < ctx.dt * 8) dust(id);
      }
      const el = view.elevator;
      if (el && el.phase !== lastPhase) {
        if (el.phase === 'surface_unloading') stats.elevatorCycles++;
        lastPhase = el.phase;
      }
      // Beta 1.3: chips and dust start at the real contact points of the last frame (synchronized with the impact)
      contactEffects(dt);
      particles.update(dt);
    }
    function dust(id) {
      const i = indexOf(f => f.id === id);
      if (i < 0) return;
      particles.spawn({ x: L.tunnelX0 + Math.random() * (w - L.tunnelX0), y: floorY(i) - Math.random() * 1.8 * k, vx: (Math.random() - 0.5) * 30, vy: -10, drag: 1.5, life: 0.9, size: 2 + Math.random() * 3, color: 'rgba(230,220,255,0.5)', kind: 'puff' });
    }

    // ----- drawing -----
    function cached(key, width, height, paint) {
      if (layerCache.has(key)) return layerCache.get(key);
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.ceil(width));
      c.height = Math.max(1, Math.ceil(height));
      const cctx = c.getContext('2d');
      if (cctx) paint(cctx);
      if (layerCache.size > 40) layerCache.delete(layerCache.keys().next().value);
      layerCache.set(key, c);
      return c;
    }
    function kitten(ctx, look, x, y, size, opts) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(size, size);
      Kit.drawKitten(ctx, look, opts);
      ctx.restore();
    }
    function addHit(r, type, key) {
      if (r) hits.push({ x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1, type, key });
    }
    function label(ctx, x, y, text, sub, color) {
      const MA = window.ColonyArt;
      ctx.font = `900 ${Math.max(10, Math.round(0.27 * k))}px Nunito, sans-serif`;
      const w1 = ctx.measureText(text).width;
      ctx.font = `800 ${Math.max(9, Math.round(0.22 * k))}px Nunito, sans-serif`;
      const w2 = sub ? ctx.measureText(sub).width : 0;
      const bw = Math.max(w1, w2) + 0.4 * k,
        bh = (sub ? 0.78 : 0.44) * k;
      MA.fillRR(ctx, x, y, bw, bh, 0.16 * k, 'rgba(20,18,50,0.82)');
      ctx.fillStyle = color || '#fff4e2';
      ctx.font = `900 ${Math.max(10, Math.round(0.27 * k))}px Nunito, sans-serif`;
      ctx.fillText(text, x + 0.2 * k, y + 0.32 * k);
      if (sub) {
        ctx.font = `800 ${Math.max(9, Math.round(0.22 * k))}px Nunito, sans-serif`;
        ctx.fillStyle = '#8ff0d4';
        ctx.fillText(sub, x + 0.2 * k, y + 0.64 * k);
      }
    }
    function draw(ctx, width, height) {
      hits.length = 0;
      if (!view) return;
      const MA = window.MineArt,
        CA = window.ColonyArt;
      ctx.fillStyle = '#151226';
      ctx.fillRect(0, 0, width, height);
      if (head > 0) {
        // the HUD's own band: calm gradient, a thin rim where the world begins
        const g = ctx.createLinearGradient(0, 0, 0, head);
        g.addColorStop(0, '#231d48');
        g.addColorStop(1, '#2d2560');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, head);
        ctx.fillStyle = 'rgba(143,240,212,0.35)';
        ctx.fillRect(0, head - 1, w, 1);
      }
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, head, w, visH());
      ctx.clip();
      ctx.translate(0, head - Math.round(cam.y));
      const viewTop = cam.y - L.fh,
        viewBottom = cam.y + visH() + L.fh;
      const list = floors();
      const surfaceZone = view.surfaceZone || 'amethyst';
      // surface band
      if (viewTop < L.surface) {
        const planet = view.planetId || 'crystal',
          bg = cached('surface:' + planet + ':' + surfaceZone + ':' + w + ':' + k, w, L.surface, c =>
            (MA.outdoor || MA.surfaceBackground)(c, w, L.surface, k, { planet, zone: surfaceZone, groundY: L.ground, shaftX: L.ex, shaftW: 1.56 * k })
          );
        ctx.drawImage(bg, 0, 0, w, L.surface);
      }
      // floors (only those near the viewport are drawn)
      frameContacts.length = 0;
      let drawn = 0;
      list.forEach((f, i) => {
        const top = floorTop(i);
        if (top > viewBottom || top + L.fh < viewTop) return;
        drawn++;
        const zoneId = f.kind === 'future' ? 'future' : f.zone;
        const bg = cached('floor:' + zoneId + ':' + (f.kind === 'future' ? 'f' : 't') + ':' + i + ':' + w + ':' + k, w, L.fh, c =>
          MA.floorBackground(c, w, L.fh, k, { zone: zoneId, seed: 11 + i * 7, tunnelX0: L.tunnelX0, locked: f.kind === 'future' })
        );
        ctx.drawImage(bg, 0, top, w, L.fh);
        drawFloor(ctx, f, i);
      });
      stats.drawnFloors = drawn;
      // elevator column over the floors' left part
      const el = view.elevator;
      const stage = MA.elevatorStage(el?.level || 1);
      const bottom = list.length ? floorY(Math.max(0, lastShaftIndex())) + 0.3 * k : L.surface;
      if (view.open) MA.shaftColumn(ctx, L.ex, L.ground - 0.1 * k, bottom, k, stage, time);
      if (view.open && list.length) pawMarks(ctx, L.ex - 0.85 * k, floorTop(0) + 0.5 * k, view.voidHere);
      drawSurface(ctx, stage);
      if (view.open) drawCabin(ctx, stage);
      // particles
      particles.forEach(p => {
        ctx.globalAlpha = Math.max(0, 1 - p.age / p.life) * (p.kind === 'puff' ? 0.6 : 1);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (p.kind === 'puff' ? 1 + p.age : 1), 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      if (contactDebugOn()) drawContactDebug(ctx);
      ctx.restore();
      // depth gauge on the right edge
      const total = worldH();
      const vh = visH();
      if (total > vh) {
        const g0 = head + 0.2 * k,
          gh = vh - 0.4 * k;
        CA.fillRR(ctx, w - 0.14 * k, g0, 0.07 * k, gh, 0.04 * k, 'rgba(255,255,255,0.12)');
        const bar = Math.max(0.6 * k, (gh * vh) / total);
        CA.fillRR(ctx, w - 0.14 * k, g0 + ((gh - bar) * cam.y) / Math.max(1, maxCam()), 0.07 * k, bar, 0.04 * k, 'rgba(143,240,212,0.7)');
      }
    }
    // Old paw-shaped markings in the rock beside the shaft (the Void story starts here).
    function pawMarks(ctx, x, y, lit) {
      if (x < 0.3 * k) return;
      const CA = window.ColonyArt;
      for (let n = 0; n < 3; n++) {
        const px = x + (n % 2 ? 0.18 : -0.05) * k,
          py = y + n * 0.75 * k,
          a = lit ? 0.85 : 0.22,
          col = lit ? 'rgba(143,240,212,' + a + ')' : 'rgba(220,210,255,' + a + ')';
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.ellipse(px, py + 0.1 * k, 0.11 * k, 0.09 * k, 0, 0, Math.PI * 2);
        ctx.fill();
        for (let t = 0; t < 3; t++) {
          ctx.beginPath();
          ctx.arc(px + (t - 1) * 0.08 * k, py - 0.04 * k - (t === 1 ? 0.03 * k : 0), 0.035 * k, 0, Math.PI * 2);
          ctx.fill();
        }
        if (lit && !reduced) CA.glow(ctx, px, py, 0.25 * k, '#8ff0d4', 0.25 + 0.1 * Math.sin(time * 2 + n));
      }
    }
    // ----- Beta 1.3: hand-mining staging with real tool contact -----
    // Rows (front → back): the main face, a deeper rock layer, a low boulder. Each miner stands so that the striking
    // point of its tool at the impact pose — Kit.toolTip(pose, { phase: 'impact' }), all kitten transforms included —
    // lies exactly on its rock's surface line. Sizes are k-relative, so the geometry holds at every screen width.
    function handSlots(f, y, backY, machineX, stationX) {
      const pose = f.stage >= 2 ? 'drill' : 'mine',
        tip = Kit.toolTip(pose, { phase: 'impact' }),
        frontRockX = machineX - 0.2 * k,
        floor = floors().indexOf(f);
      const rows = [
        { size: 0.9, y: y + 0.04 * k, rockX: frontRockX, height: 2.3, depth: Math.max(0.5, (w - frontRockX) / k), back: false, boulder: false },
        { size: 0.72, y: backY, rockX: frontRockX - 0.72 * k, height: 1.6, depth: 0.75, back: true, boulder: false },
        { size: 0.6, y: backY - 0.1 * k, rockX: frontRockX - 1.5 * k, height: 0.75, depth: 0.55, back: true, boulder: true }
      ];
      const want = Math.max(1, Math.min(f.miners || 1, 3));
      const list = rows.slice(0, want).map((r, m) => {
        const size = r.size * k,
          contactY = r.y + tip[1] * size;
        return {
          pose,
          size,
          x: r.rockX - tip[0] * size,
          y: r.y,
          seed: 7 + m * 3 + Math.max(0, floor),
          contactX: r.rockX,
          contactY,
          rock: { x: r.rockX, y: r.y, height: r.height, depth: r.depth, contactY, band: 0.22, back: r.back, boulder: r.boulder, seed: 3 + m + Math.max(0, floor) }
        };
      });
      // narrow screens: a miner that would stand in the manager's desk area is not drawn (the economy is unaffected)
      const kept = list.filter((s, m) => m === 0 || s.x - 0.3 * s.size > stationX + 1.05 * k);
      return { list: kept, frontRockX, pileX: frontRockX - 0.08 * k };
    }
    // contact points of this frame (screen-independent world coordinates): chips/dust start here; the dev overlay
    // draws the rock target and the transformed tool tip so a reviewer can see that they meet
    // reduced motion: miners rest in the contact pose (tool on the rock) instead of swinging; no chips fly
    function mineTime(seed) {
      if (!reduced) return time;
      const [a, b] = Kit.MINE_IMPACT;
      return ((a + b) / 2) * Kit.MINE_CYCLE - seed * 0.237 + 100 * Kit.MINE_CYCLE;
    }
    const frameContacts = [];
    const lastImpact = new Map();
    function contactEffects(dt) {
      if (reduced || quality === 'low' || frozenTime !== null) return; // a frozen review frame shows no flying chips
      for (const c of frameContacts) {
        if (!c.working) continue;
        const key = c.floor + ':' + c.seed;
        if (c.kind === 'mine') {
          const hit = Kit.mineImpact(time, c.seed);
          if (hit && !lastImpact.get(key)) {
            const col = window.MineArt.zone(c.zone).crystal;
            for (let n = 0; n < 4; n++)
              particles.spawn({ x: c.x, y: c.y, vx: -40 - Math.random() * 70, vy: -50 - Math.random() * 60, ay: 260, drag: 0.5, life: 0.5 + Math.random() * 0.2, size: 1.6 + Math.random() * 1.4, color: n % 2 ? col[n % col.length] : '#d9d2f0' });
            particles.spawn({ x: c.x - 3, y: c.y, vx: -14, vy: -8, drag: 2, life: 0.45, size: 4, color: 'rgba(230,220,255,0.45)', kind: 'puff' });
          }
          lastImpact.set(key, hit);
        } else if (Math.random() < dt * (c.kind === 'drill' ? 9 : 5)) {
          // drill bit and rig cutter: a steady trickle of grit at the bit
          particles.spawn({ x: c.x, y: c.y + (Math.random() - 0.5) * 4, vx: -30 - Math.random() * 50, vy: -20 + Math.random() * 30, ay: 200, drag: 0.6, life: 0.4, size: 1.2 + Math.random(), color: window.MineArt.zone(c.zone).crystal[0] });
        }
      }
    }
    function contactDebugOn() {
      try {
        return Boolean(window.NEBULA_CONFIG?.devTools) && localStorage.getItem('sk-contact-debug') === '1';
      } catch {
        return false;
      }
    }
    function drawContactDebug(ctx) {
      for (const c of frameContacts) {
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(c.x, c.y - 0.25 * k);
        ctx.lineTo(c.x, c.y + 0.25 * k);
        ctx.stroke();
        ctx.fillStyle = '#ff2e88';
        ctx.beginPath();
        ctx.arc(c.tipX, c.tipY, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    function lastShaftIndex() {
      let last = 0;
      floors().forEach((f, i) => {
        if (f.kind === 'shaft' || f.kind === 'frost' || f.kind === 'conduit' || f.kind === 'core') last = i;
      });
      return last;
    }
    function drawSurface(ctx, stage) {
      const MA = window.MineArt,
        CA = window.ColonyArt;
      if (cam.y > L.surface + L.fh) return;
      const s = view.surface || {};
      if (view.open) {
        const r = MA.headframe(ctx, L.ex, L.ground, k, stage, time, Boolean(view.elevator?.running || view.elevator?.trip));
        addHit(r, 'elevator', 'elevator');
      } else {
        // closed mine: the Förderturm construction site
        const r = CA.emptyPlot(ctx, L.ex + 0.4 * k, L.ground, k, 'Förderturm', !view.canOpen);
        addHit(r, 'open', 'open');
      }
      // surface pile (the same pile the colony's carts take from), on an unloading deck the cabin tips onto
      const px = L.ex + 2.5 * k;
      if (view.open) {
        CA.fillRR(ctx, L.ex + 0.75 * k, L.ground - 0.42 * k, 1.1 * k, 0.12 * k, 0.04 * k, '#6b7096');
        ctx.fillStyle = '#4c5174';
        ctx.fillRect(L.ex + 0.85 * k, L.ground - 0.3 * k, 0.08 * k, 0.3 * k);
        ctx.fillRect(L.ex + 1.7 * k, L.ground - 0.3 * k, 0.08 * k, 0.3 * k);
        // the chute from the deck down to the pile
        ctx.fillStyle = '#8a8fb0';
        ctx.beginPath();
        ctx.moveTo(L.ex + 1.75 * k, L.ground - 0.42 * k);
        ctx.lineTo(L.ex + 2.05 * k, L.ground - 0.42 * k);
        ctx.lineTo(px - 0.15 * k, L.ground - 0.62 * k * Math.max(0.3, s.pileRatio || 0));
        ctx.lineTo(px - 0.45 * k, L.ground - 0.55 * k * Math.max(0.3, s.pileRatio || 0));
        ctx.closePath();
        ctx.fill();
      }
      MA.buffer(ctx, px, L.ground, k * 1.25, s.pileRatio || 0, view.surfaceZone, 1);
      CA.plaque(ctx, px, L.ground + 0.3 * k, k * 0.82, 'Halde ' + Math.round((s.pileRatio || 0) * 100) + ' %', (s.pileRatio || 0) >= 0.95 ? '#ff8f8f' : '#fff4e2');
      addHit({ x0: px - 0.9 * k, y0: L.ground - 1.1 * k, x1: px + 0.9 * k, y1: L.ground + 0.7 * k }, 'surface', 'pile');
      // the cart line leaves the outpost towards the colony's depot (only once it is built; the carts themselves run in
      // the colony scene — here a sign shows where the material goes)
      if (view.railLevel > 0 && CA.track) {
        const tx0 = px + 0.9 * k,
          tx1 = w + 0.5 * k;
        if (tx1 - tx0 > 1.2 * k) {
          CA.track(ctx, tx0, tx1, () => L.ground + 0.02 * k, k, view.railLevel);
          const sx = w - 1.05 * k;
          ctx.fillStyle = '#4a4470';
          ctx.fillRect(sx - 0.04 * k, L.ground - 1.05 * k, 0.08 * k, 1.05 * k);
          CA.fillRR(ctx, sx - 0.8 * k, L.ground - 1.45 * k, 1.6 * k, 0.45 * k, 0.1 * k, 'rgba(29,33,80,0.94)');
          ctx.font = `900 ${Math.max(9, Math.round(0.19 * k))}px Nunito, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#8fe3ff';
          ctx.fillText('ZUM LAGER ›', sx, L.ground - 1.22 * k);
          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';
        }
      }
      // elevator control booth with its manager
      if (view.open) {
        const bx = Math.min(w - 1.3 * k, L.ex + 4.7 * k);
        CA.box(ctx, bx, L.ground, 1.1 * k, 0.95 * k, 0.28 * k, '#2f8f86', '#4fb8ac', '#1f6660');
        CA.windowPane(ctx, bx - 0.38 * k, L.ground - 0.78 * k, 0.5 * k, 0.32 * k, Boolean(view.elevator?.auto), time);
        const m = view.elevator?.manager;
        if (m)
          kitten(ctx, Kit.managerLook(m.look, m.outfit, m.rank || 1), bx - 0.95 * k, L.ground + 0.04 * k, k * 0.85, {
            pose: view.elevator.running ? MANAGER_POSE.elevator : 'idle',
            t: time,
            seed: 41,
            facing: -1
          });
        addHit({ x0: bx - 1.4 * k, y0: L.ground - 1.3 * k, x1: bx + 0.8 * k, y1: L.ground + 0.2 * k }, 'elevator', 'elevator');
        // Beta 1.3: an empty booth shows its free manager place (tap → the elevator sheet with the hire button)
        if (!m) {
          CA.plaque(ctx, bx - 0.95 * k, L.ground - 0.95 * k, k * 0.72, '+ MANAGER', '#8ff0d4');
          addHit({ x0: bx - 1.7 * k, y0: L.ground - 1.35 * k, x1: bx - 0.2 * k, y1: L.ground - 0.55 * k }, 'elevator', 'elevator');
        }
      }
      // Mochi checks the opening; Void (once met) keeps Mochi company by the headframe
      const mochiLook = Kit.ROSTER?.[0];
      if (mochiLook) kitten(ctx, mochiLook, Math.min(w - 0.5 * k, L.ex + 6.2 * k), L.ground + 0.04 * k, k * 0.8, { pose: view.open ? 'idle' : 'discover', t: time, seed: 3, facing: -1 });
      if (view.voidHere && Kit.VOID) {
        const vx = L.ex + 1.35 * k;
        kitten(ctx, Kit.VOID, vx, L.ground + 0.04 * k, k * 0.72, { pose: Math.sin(time * 0.4) > 0.6 ? 'wave' : 'idle', t: time, seed: 17, facing: 1 });
        addHit({ x0: vx - 0.45 * k, y0: L.ground - 1 * k, x1: vx + 0.45 * k, y1: L.ground + 0.1 * k }, 'void', 'void');
      }
    }
    // ----- real-state helpers -----
    // Seconds since the simulation last advanced (phases are interpolated up to the next tick; frozen when reduced).
    function simAge() {
      return reduced ? 0 : math.clamp((Date.now() - (view.simAt || Date.now())) / 1000, 0, 1.2);
    }
    function phaseP(o) {
      return o && o.dur > 0 ? math.clamp((o.dur - o.left + simAge()) / o.dur, 0, 1) : 1;
    }
    // y of a depth (0 = surface dock); fractional depths interpolate between the floors.
    function depthY(d) {
      const dock = L.ground - 0.05 * k;
      if (d <= 0) return dock;
      const list = floors(),
        yOf = depth => {
          const i = list.findIndex(f => f.depth === depth && f.kind !== 'future');
          return i >= 0 ? floorY(i) : null;
        };
      const lo = Math.floor(d),
        hi = Math.ceil(d),
        ylo = lo <= 0 ? dock : (yOf(lo) ?? dock + lo * L.fh),
        yhi = yOf(hi) ?? ylo + (hi - lo) * L.fh;
      return hi === lo ? ylo : math.lerp(ylo, yhi, d - lo);
    }
    function cabinState() {
      const e = view.elevator;
      if (!e) return { y: depthY(0), load: 0, moving: false, p: 0 };
      const ease = math.easeInOutSine || (x => x),
        p = phaseP(e);
      if (e.phase === 'descending' || e.phase === 'ascending') return { y: depthY(e.from + (e.to - e.from) * ease(p)), load: e.load, moving: true, p };
      if (['surface_idle', 'surface_unloading', 'blocked_by_surface_capacity'].includes(e.phase)) return { y: depthY(0), load: e.load, moving: false, p };
      return { y: depthY(e.from), load: e.load, moving: false, p };
    }
    function drawCabin(ctx, stage) {
      const CA = window.ColonyArt,
        e = view.elevator,
        c = cabinState();
      const r = window.MineArt.cabin(ctx, L.ex, c.y, k, stage, c.load, time, c.moving, L.ground + (floorY(lastShaftIndex()) - c.y) * 0.5, e?.emberShare || 0, e?.specialTint, e?.tier || 0, L.ground - (stage >= 3 ? 3.4 : stage === 2 ? 2.9 : 2.4) * k);
      addHit(r, 'elevator', 'elevator');
      if (!e) return;
      // crates really changing place: platform → cabin while loading, cabin → pile while unloading
      if (e.phase === 'loading' && e.stop) {
        const i = floors().findIndex(f => f.id === e.stop);
        if (i >= 0) {
          const from = L.tunnelX0 + 1.0 * k;
          for (let n = 0; n < 2; n++) {
            const q = math.clamp(c.p * 1.6 - n * 0.45, 0, 1);
            if (q > 0 && q < 1) CA.crate(ctx, math.lerp(from, L.ex, q), floorY(i) - 0.1 * k - Math.sin(q * Math.PI) * 0.35 * k, 0.24 * k, '#c4a3ff', '#7f6ad8');
          }
        }
      }
      if (e.phase === 'surface_unloading' && e.load > 0) {
        const to = L.ex + 2.3 * k;
        for (let n = 0; n < 2; n++) {
          const q = math.clamp(c.p * 1.6 - n * 0.45, 0, 1);
          if (q > 0 && q < 1) CA.crate(ctx, math.lerp(L.ex, to, q), L.ground - 0.15 * k - Math.sin(q * Math.PI) * 0.4 * k, 0.24 * k, '#c4a3ff', '#7f6ad8');
        }
      }
      if (e.phase === 'blocked_by_surface_capacity') CA.plaque(ctx, L.ex + 2.3 * k, L.ground + 0.75 * k, k * 0.9, 'HALDE VOLL', '#ff8f8f');
    }
    // Floor labels sit in the rock band; below a depth banner they move down so both stay readable.
    function hasBanner(f, i) {
      const prev = floors()[i - 1];
      return Boolean(f.zoneName && (!prev || prev.zone !== f.zone));
    }
    function labelTop(f, i) {
      return floorTop(i) + (hasBanner(f, i) ? 0.55 * k : 0.06 * L.fh);
    }
    function drawFloor(ctx, f, i) {
      const MA = window.MineArt,
        CA = window.ColonyArt,
        y = floorY(i),
        top = floorTop(i);
      // depth transition: a zone banner where the geology changes
      if (hasBanner(f, i)) {
        const text = '▼ Tiefe ' + (f.depth || i + 1) + ' · ' + f.zoneName;
        ctx.font = '900 ' + Math.max(9, Math.round(0.22 * k)) + 'px Nunito, sans-serif';
        const tw = ctx.measureText(text).width + 0.4 * k;
        CA.fillRR(ctx, w - tw - 0.3 * k, top + 0.1 * k, tw, 0.4 * k, 0.2 * k, 'rgba(255,215,122,0.9)');
        ctx.fillStyle = '#3a2f5a';
        ctx.fillText(text, w - tw - 0.1 * k, top + 0.38 * k);
      }
      if (f.kind === 'future') {
        ctx.font = '900 ' + Math.max(10, Math.round(0.28 * k)) + 'px Nunito, sans-serif';
        ctx.fillStyle = 'rgba(200,190,255,0.55)';
        ctx.textAlign = 'center';
        ctx.fillText(f.name + ' · noch unerforscht', (L.tunnelX0 + w) / 2, top + L.fh * 0.55);
        ctx.textAlign = 'left';
        return;
      }
      // landing at the elevator
      CA.fillRR(ctx, L.ex + 0.6 * k, y - 0.08 * k, 0.6 * k, 0.12 * k, 0.04 * k, '#9aa6c8');
      MA.wallLamp(ctx, L.tunnelX0 + 0.7 * k, top + L.fh * 0.5, k, window.MineArt.zone(f.zone).light, time, f.kind !== 'frontier');
      // Beta 1.3 mine look: crystal lamps hanging from every floor's ceiling (purely visual)
      if (view.cosmeticMine === 'mine-crystal-lamps' && f.kind !== 'frontier') {
        const reducedLamp = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) || document.body.classList.contains('reduce-motion');
        [0.42, 0.78].forEach((u, j) => {
          const lx = L.tunnelX0 + (w - L.tunnelX0) * u,
            ly = top + 0.42 * k,
            c = (i + j) % 2 ? '#8fe3ff' : '#ff9ecb',
            pulse = reducedLamp ? 0.6 : 0.5 + Math.sin(time * 1.8 + i + j) * 0.15;
          ctx.strokeStyle = 'rgba(40,36,70,0.9)';
          ctx.lineWidth = Math.max(1, 0.03 * k);
          ctx.beginPath();
          ctx.moveTo(lx, top + 0.08 * k);
          ctx.lineTo(lx, ly - 0.14 * k);
          ctx.stroke();
          window.NebulaArt.glowCircle(ctx, lx, ly, 0.7 * k, c, pulse);
          ctx.fillStyle = c;
          ctx.beginPath();
          ctx.moveTo(lx, ly - 0.2 * k);
          ctx.lineTo(lx + 0.14 * k, ly);
          ctx.lineTo(lx, ly + 0.27 * k);
          ctx.lineTo(lx - 0.14 * k, ly);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.75)';
          ctx.fillRect(lx - 0.025 * k, ly - 0.08 * k, 0.03 * k, 0.12 * k);
        });
      }
      if (f.kind === 'frontier') {
        const r = MA.frontier(ctx, L.tunnelX0, top, w, L.fh, k, { title: f.title, sub: f.sub, locked: f.locked, zone: f.zone });
        addHit(r, 'frontier', f.id);
        return;
      }
      if (f.kind === 'construction') return drawConstruction(ctx, f, i, top, y);
      // Beta 1.7 M9: the planetary core – a great crystal heart; its cracks close stage by stage, it glows when healed
      if (f.kind === 'core') {
        const cx = (L.tunnelX0 + w) / 2 + 0.6 * k,
          cy = top + L.fh * 0.55,
          r0 = Math.min(L.fh * 0.36, 1.6 * k),
          healed = f.phase === 'healed',
          pulse = reduced ? 0.7 : 0.6 + Math.sin(time * (healed ? 2.2 : 0.9)) * 0.2;
        window.NebulaArt.glowCircle(ctx, cx, cy, r0 * (healed ? 3 : 1.8), healed ? '#ffd77a' : '#c4a3ff', pulse * (0.35 + 0.2 * f.stage));
        ctx.fillStyle = healed ? '#fff1c2' : '#b9a6ff';
        ctx.beginPath();
        ctx.moveTo(cx, cy - r0 * 1.25);
        ctx.lineTo(cx + r0 * 0.8, cy - r0 * 0.15);
        ctx.lineTo(cx + r0 * 0.4, cy + r0 * 1.0);
        ctx.lineTo(cx - r0 * 0.4, cy + r0 * 1.0);
        ctx.lineTo(cx - r0 * 0.8, cy - r0 * 0.15);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillRect(cx - r0 * 0.12, cy - r0 * 0.9, r0 * 0.1, r0 * 0.9);
        // the cracks of the stages still to heal (3 → 0)
        ctx.strokeStyle = 'rgba(40,30,80,0.85)';
        ctx.lineWidth = Math.max(1.2, 0.05 * k);
        const cracks = [
          [[-0.5, -0.4], [-0.15, 0.05], [-0.3, 0.55]],
          [[0.45, -0.3], [0.1, 0.15], [0.25, 0.7]],
          [[-0.1, -0.95], [0.05, -0.5], [-0.05, -0.1]]
        ];
        cracks.slice(f.stage).forEach(c => {
          ctx.beginPath();
          c.forEach(([x, y], j) => (j ? ctx.lineTo(cx + x * r0, cy + y * r0) : ctx.moveTo(cx + x * r0, cy + y * r0)));
          ctx.stroke();
        });
        label(ctx, L.tunnelX0 + 0.25 * k, labelTop(f, i), f.title, f.sub, healed ? '#ffd77a' : '#c4b3ff');
        addHit({ x0: L.tunnelX0, y0: top + L.fh * 0.25, x1: w, y1: y + 0.2 * k }, 'core', 'crystal');
        return;
      }
      if (f.kind === 'conduit') {
        const r = MA.conduit(ctx, L.tunnelX0, y, w, k, time, f.state);
        label(ctx, L.tunnelX0 + 0.25 * k, labelTop(f, i), f.title, f.sub, '#ffd77a');
        addHit(r, 'conduit', 'conduit');
        addHit({ x0: L.tunnelX0, y0: top + L.fh * 0.4, x1: w, y1: y }, 'conduit', 'conduit');
        return;
      }
      if (f.kind === 'frost') {
        const r = MA.frostRig(ctx, w - 2.2 * k, y, k, { working: f.working, heated: f.heated, time });
        MA.buffer(ctx, L.tunnelX0 + 1.1 * k, y, k, f.ratio, 'frost', 2);
        label(ctx, L.tunnelX0 + 0.25 * k, labelTop(f, i), f.title, f.sub);
        if (f.friendly && window.NebulaArt?.drawFrostbyte) window.NebulaArt.drawFrostbyte(ctx, w - 3.5 * k, y - 0.9 * k + Math.sin(time * 1.5) * 0.06 * k, k * 0.48, time, { friendly: true });
        if (f.manager) kitten(ctx, Kit.managerLook(f.manager.look, f.manager.outfit, f.manager.rank || 1), L.tunnelX0 + 2.2 * k, y + 0.04 * k, k * 0.82, { pose: f.working ? 'check' : 'idle', t: time, seed: 52, facing: 1 });
        addHit({ x0: L.tunnelX0, y0: top + L.fh * 0.4, x1: w, y1: y + 0.2 * k }, 'frost', 'frostDrill');
        addHit(r, 'frost', 'frostDrill');
        return;
      }
      // ----- shaft: platform (Schachtlager) at the lift, face at the machine, kittens in between -----
      // Staging (no two kittens share a spot): back row (y − 0.16 k, smaller) = manager beside the desk and the
      // second/third miner; front row = first miner at the face, carriers on their lane, the manual kitten in front.
      const progress = construct.get(f.id);
      const building = progress !== undefined;
      const bufferX = L.tunnelX0 + 1.0 * k,
        stationX = bufferX + 1.25 * k,
        machineX = w - 1.85 * k,
        faceX = machineX - (f.stage >= 4 ? 1.75 : 1.3) * k,
        platX = bufferX + 0.55 * k,
        backY = y - 0.16 * k;
      if (f.look) MA.shaftLook(ctx, f.look, L.tunnelX0, top, w, L.fh, k, time, reduced, f.working, f.freed);
      // Beta 1.3: who mines decides the staging. Machine stages (a rig, or a planet look rig) cut the rock with their
      // cutter while kittens operate and inspect; hand stages have a real rock face that every miner's tool touches.
      const rigMining = f.stage >= 3 || Boolean(f.look && (f.stage >= 2 || ['resonance', 'clockwork', 'machinecore'].includes(f.look)));
      const mining = f.working && !building;
      const slots = rigMining ? null : handSlots(f, y, backY, machineX, stationX);
      MA.haulTrack(ctx, platX, slots ? slots.pileX : faceX, y, k, f.haulStage || 1, time, Boolean(f.auto && f.carriers?.some(c => c.phase === 'carrying')));
      const machineAlpha = building ? math.clamp((progress - 0.2) / 0.5, 0, 1) : 1;
      if (rigMining) {
        // the generic rig's cutter bites into a real rock face (planet look rigs draw their own geology)
        const big = f.stage >= 4 ? 1.25 : 1,
          cut = { x: machineX + 0.35 * k * big + 0.72 * k, y: y - 0.75 * k * big - 0.33 * k };
        if (!f.look) {
          MA.rockFace(ctx, cut.x, y, k, f.zone, { height: 2.1, contactY: cut.y, band: 0.3, depth: Math.max(0.4, (w - cut.x) / k), scars: mining ? 0.75 : 0.25, seed: 5 + i });
          frameContacts.push({ floor: i, x: cut.x, y: cut.y, kind: 'rig', seed: 5 + i, working: mining, zone: f.zone, tipX: cut.x, tipY: cut.y });
        }
        if (machineAlpha > 0) {
          ctx.globalAlpha = machineAlpha;
          const r = MA.machine(ctx, machineX, y, k, { stage: f.stage, working: mining, time, zone: f.zone, bufferX, look: f.look, reduced });
          ctx.globalAlpha = 1;
          addHit(r, 'shaft', f.id);
        }
      } else {
        // hand stages: back rock layer and boulder first, then the main face in front
        for (const s of slots.list.slice().reverse()) if (s.rock) MA.rockFace(ctx, s.rock.x, s.rock.y, k, f.zone, { ...s.rock, scars: mining ? 0.6 : 0.2 });
        if (f.stage <= 1) MA.timberFrame?.(ctx, slots.frontRockX, y, k);
        else MA.drillCart?.(ctx, slots.pileX - 0.55 * k, y, k, mining, time);
        addHit({ x0: slots.frontRockX - 0.4 * k, y0: y - 1.9 * k, x1: w, y1: y }, 'shaft', f.id);
      }
      MA.facePile(ctx, slots ? slots.pileX : faceX + 0.15 * k, y, k, f.faceRatio || 0, f.zone);
      if (f.storeStage > 1) MA.storeRack(ctx, bufferX, y, k, f.storeStage, f.zone);
      MA.buffer(ctx, bufferX, y, k, f.ratio, f.zone, f.stage);
      MA.station(ctx, stationX, y, k, { on: Boolean(f.manager) });
      // back row: the manager right of the desk
      if (f.manager)
        kitten(ctx, Kit.managerLook(f.manager.look, f.manager.outfit, f.manager.rank || 1), stationX + 0.72 * k, backY, k * 0.8, {
          pose: f.working ? MANAGER_POSE.mining : 'idle',
          t: time,
          seed: 21 + i,
          facing: -1
        });
      const minerLook = m => Kit.managerLook(Kit.WORKERS[(m + i) % Kit.WORKERS.length], MINER_OUTFIT, 1);
      const hand = f.manual,
        handMining = Boolean(hand && hand.phase === 'mining');
      let frontMinerX = faceX;
      if (rigMining) {
        // operators: the first one at the rig's console, the others inspecting the ore — no pickaxes at a machine
        const big = f.stage >= 4 ? 1.25 : 1,
          ox = machineX - 1.35 * k * big;
        const crew = Math.max(1, Math.min(f.miners || 1, 3));
        for (let m = crew - 1; m >= 1; m--) kitten(ctx, minerLook(m), ox - (0.55 + (m - 1) * 0.5) * k, backY - (m - 1) * 0.06 * k, k * (0.64 - (m - 1) * 0.06), { pose: building ? 'construct' : 'check', t: time, seed: 7 + m * 3 + i, facing: 1 });
        kitten(ctx, minerLook(0), ox, y + 0.04 * k, k * 0.74, { pose: building ? 'construct' : mining ? 'operate' : 'idle', t: time, seed: 7 + i, facing: 1 });
        frontMinerX = ox;
      } else {
        // every miner stands where its tool tip meets its rock at the impact pose (tool-tip geometry, all transforms)
        slots.list.forEach((s, m) => {
          if (m === 0 && handMining) return; // the manual kitten takes the front slot while it mines
          const pose = building ? 'construct' : mining ? s.pose : 'idle';
          kitten(ctx, minerLook(m), s.x, s.y, s.size, { pose, t: mineTime(s.seed), seed: s.seed, facing: 1 });
          if (mining) {
            const tip = Kit.toolTip(s.pose, { t: mineTime(s.seed), seed: s.seed });
            frameContacts.push({ floor: i, x: s.contactX, y: s.contactY, kind: s.pose, seed: s.seed, working: true, zone: f.zone, tipX: s.x + tip[0] * s.size, tipY: s.y + tip[1] * s.size });
          }
        });
        frontMinerX = slots.list[slots.list.length - 1].x;
      }
      // carriers: each walks by its own saved phase; they pick up left of the miners and queue there
      const pickX = frontMinerX - 0.55 * k,
        fit = Math.max(1, Math.floor(Math.max(0.6 * k, pickX - (stationX + 0.6 * k)) / (0.6 * k)));
      const path = (from, to, p) => math.lerp(from, to, math.clamp(p, 0, 1));
      (f.carriers || []).slice(0, Math.max(1, fit)).forEach((c, n) => {
        const p = phaseP(c),
          holding = c.load > 0;
        if (!f.auto && !holding && c.phase === 'collecting') return; // idle carriers rest out of sight
        const x =
            c.phase === 'carrying'
              ? path(pickX, platX + 0.3 * k, p)
              : c.phase === 'returning'
                ? path(platX + 0.3 * k, pickX, p)
                : c.phase === 'collecting'
                  ? pickX - 0.5 * k * n
                  : platX + 0.3 * k + 0.35 * k * n,
          facing = c.phase === 'returning' || (c.phase === 'collecting' && !holding) ? 1 : -1,
          stage = f.haulStage || 1,
          walking = c.phase === 'carrying' || c.phase === 'returning';
        stats.carriersDrawn++;
        const look = Kit.managerLook(Kit.WORKERS[(n + 2 + i) % Kit.WORKERS.length], MINER_OUTFIT, 1);
        if (holding && stage >= 2) MA.haulLoad(ctx, x - 0.35 * k * facing, y + 0.06 * k, k, stage, c.load / Math.max(1, f.carrierLoad), f.zone, facing);
        kitten(ctx, look, x, y + 0.1 * k, k * 0.72, {
          pose: holding && stage < 2 ? 'carry' : walking ? 'walk' : c.phase === 'waiting_for_space' ? 'worried' : 'idle',
          t: time,
          seed: 13 + n * 5 + i,
          facing,
          tool: 'crate'
        });
      });
      // the manual kitten (one click = one complete cycle), always in front; it mines at the front rock with the
      // same tool-tip geometry as the crew (at a machine stage it works the rig's console instead of swinging)
      if (hand && hand.phase !== 'idle') {
        const front = slots?.list[0],
          workX = front ? front.contactX - Kit.toolTip(front.pose, { phase: 'impact' })[0] * k * 0.9 : frontMinerX + 0.1 * k,
          p = phaseP(hand),
          x =
            hand.phase === 'walking_to_face'
              ? path(platX + 0.5 * k, workX, p)
              : hand.phase === 'carrying'
                ? path(workX, platX + 0.5 * k, p)
                : hand.phase === 'mining' || hand.phase === 'collecting'
                  ? workX
                  : platX + 0.5 * k;
        const base = Kit.ROSTER?.[0],
          minePose = front ? front.pose : 'operate';
        if (base) {
          kitten(ctx, Kit.managerLook(base, MINER_OUTFIT, 1), x, y + 0.04 * k, k * 0.9, {
            pose: hand.phase === 'mining' ? minePose : ['carrying', 'depositing', 'waiting_for_space'].includes(hand.phase) ? 'carry' : hand.phase === 'collecting' ? 'check' : 'walk',
            t: time,
            seed: 99 + i,
            facing: hand.phase === 'walking_to_face' || hand.phase === 'mining' || hand.phase === 'collecting' ? 1 : -1,
            tool: 'crate'
          });
          if (hand.phase === 'mining' && front) {
            const tip = Kit.toolTip(minePose, { t: time, seed: 99 + i });
            frameContacts.push({ floor: i, x: front.contactX, y: y + 0.04 * k + Kit.toolTip(minePose, { phase: 'impact' })[1] * k * 0.9, kind: minePose, seed: 99 + i, working: true, zone: f.zone, tipX: x + tip[0] * k * 0.9, tipY: y + 0.04 * k + tip[1] * k * 0.9 });
          }
        }
        if (hand.queue > 1) CA.plaque(ctx, x, y - 1.15 * k, k * 0.7, '×' + hand.queue, '#ffd77a');
      }
      label(ctx, L.tunnelX0 + 0.25 * k, labelTop(f, i), f.name + ' · Lv ' + f.level, f.sub, f.selected ? '#ffd77a' : '#fff4e2');
      if (f.full) CA.plaque(ctx, bufferX + 0.2 * k, y - 1.2 * k, k * 0.9, 'LAGER VOLL', '#ff8f8f');
      if (building && progress > 0.75) CA.plaque(ctx, (L.tunnelX0 + w) / 2, top + L.fh * 0.5, k * 1.2, 'NEUER SCHACHT!', '#ffd77a');
      addHit({ x0: L.tunnelX0, y0: top + L.fh * 0.38, x1: w, y1: y + 0.2 * k }, 'shaft', f.id);
      // Beta 1.3: an empty manager desk is a visible place with an action (added last: wins over the floor's own hit)
      if (!f.manager && !building) {
        CA.plaque(ctx, stationX, backY - 1.05 * k, k * 0.72, '+ MANAGER', '#8ff0d4');
        addHit({ x0: stationX - 0.75 * k, y0: backY - 1.45 * k, x1: stationX + 0.75 * k, y1: y }, 'hire', f.id);
      }
    }
    // A shaft under construction: everything from the saved progress (survives reloads and offline).
    function drawConstruction(ctx, f, i, top, y) {
      const MA = window.MineArt,
        CA = window.ColonyArt;
      const r = MA.constructionSite(ctx, L.tunnelX0, top, w, L.fh, k, f.progress, f.zone, time, reduced);
      // the build crew: a surveyor first, then drillers at the front, then builders setting supports
      const crew = f.progress < 0.25 ? 1 : 2;
      for (let m = 0; m < crew; m++) {
        const x = f.progress < 0.25 ? L.tunnelX0 + 1.6 * k + m * 0.6 * k : r.frontX - 1.1 * k - m * 0.7 * k;
        kitten(ctx, Kit.managerLook(Kit.WORKERS[(m + 4) % Kit.WORKERS.length], MINER_OUTFIT, 1), Math.max(L.tunnelX0 + 0.9 * k, x), y + 0.04 * k, k * 0.74, {
          pose: f.progress < 0.25 ? 'check' : 'construct',
          t: time,
          seed: 31 + m + i,
          facing: 1
        });
      }
      if (f.progress >= 0.85) {
        ctx.globalAlpha = math.clamp((f.progress - 0.85) / 0.15, 0.2, 1);
        MA.machine(ctx, w - 1.85 * k, y, k, { stage: 1, working: false, time, zone: f.zone, bufferX: L.tunnelX0 + k });
        ctx.globalAlpha = 1;
      }
      // label + progress bar
      const bx = L.tunnelX0 + 0.3 * k,
        bw = Math.min(w - bx - 0.4 * k, 5 * k),
        by = labelTop(f, i) + 0.88 * k;
      label(ctx, L.tunnelX0 + 0.25 * k, labelTop(f, i), f.name + ' · im Bau', f.sub, '#ffd77a');
      CA.fillRR(ctx, bx, by, bw, 0.16 * k, 0.08 * k, 'rgba(20,18,50,0.75)');
      CA.fillRR(ctx, bx, by, bw * f.progress, 0.16 * k, 0.08 * k, '#ffd77a');
      addHit({ x0: L.tunnelX0, y0: top + L.fh * 0.3, x1: w, y1: y + 0.2 * k }, 'construction', f.id);
    }

    layout();
    return {
      attach,
      resize(width, height) {
        w = width;
        h = height;
        layout();
      },
      update,
      draw,
      onShow() {
        shown = true;
      },
      onHide() {
        shown = false;
        particles.clear();
        construct.clear();
      },
      destroy() {
        off.forEach(fn => fn());
      },
      focusFloor,
      focusTop,
      // review/QA: freeze the scene clock (null = live) and read this frame's contact points in canvas coordinates
      debugFreeze(t) {
        frozenTime = typeof t === 'number' ? t : null;
        if (frozenTime !== null) {
          time = frozenTime;
          particles.clear();
        }
      },
      debugContacts() {
        const dy = head - Math.round(cam.y);
        return frameContacts.map(c => ({ ...c, y: c.y + dy, tipY: c.tipY + dy }));
      },
      focusWhere(kind) {
        const list = floors();
        let i = -1;
        if (kind === 'deepest') i = lastShaftIndex();
        if (kind === 'frontier') i = list.findIndex(f => f.kind === 'frontier' || f.kind === 'conduit');
        if (kind === 'idle') i = list.findIndex(f => (f.kind === 'shaft' || f.kind === 'frost') && !f.auto);
        // Beta 1.4 M2: the running construction (else the next site), the first shaft that holds the mine back, a zone
        if (kind === 'construction') {
          i = list.findIndex(f => f.kind === 'construction');
          if (i < 0) i = list.findIndex(f => f.kind === 'frontier');
        }
        if (kind === 'bottleneck') i = list.findIndex(f => f.kind === 'shaft' && (!f.auto || f.full || (f.limit && f.limit !== 'mining')));
        if (kind.startsWith('zone:')) i = list.findIndex(f => f.zone === kind.slice(5) && f.kind !== 'future');
        if (kind === 'top') return focusTop(), true;
        if (i < 0) return false;
        focusFloor(i);
        return true;
      },
      focusShaft(id) {
        const i = floors().findIndex(f => f.id === id);
        if (i >= 0) focusFloor(i);
      },
      snap() {
        cam.y = cam.target;
      },
      // Performance probes only (tools/perf-mine.mjs): render a synthetic mine with many floors.
      stressView(fn) {
        getView = fn;
      },
      // visible parts only (the header band and everything above/below the canvas are not tappable)
      hitAreas: () =>
        hits
          .map(h2 => ({ ...h2, y0: Math.max(head, h2.y0 - cam.y + head), y1: Math.min(h, h2.y1 - cam.y + head) }))
          .filter(h2 => h2.y1 > h2.y0),
      camera: () => ({ y: cam.y, target: cam.target, max: maxCam(), head }),
      debug: () => ({ k, floors: floors().length, cam: Math.round(cam.y), particles: particles.active, layers: layerCache.size, ...stats })
    };
  }

  window.NebulaScenes = window.NebulaScenes || {};
  window.NebulaScenes.createMineScene = createMineScene;
})();
