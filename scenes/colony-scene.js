// Colony scene — a side-view, pannable kitten settlement on the viewed planet.
// Layout comes from scenes/planet-layouts.js (per planet), building art from scenes/colony-art.js (staged by level).
// Everything visible is derived from the read-only view model (real buildings, stock, flows, managers, story state).
// Taps call game actions; the scene never changes game state itself.
(function () {
  'use strict';
  const { math, ParticlePool } = window.IdleEngine;
  const Art = window.NebulaArt;
  const Kit = window.SpaceKittens;
  const CA = window.ColonyArt;
  const Layouts = window.PlanetLayouts;
  const TAU = Math.PI * 2;
  const TAP_SLOP = 9;
  // Sheet keys used by the game for each plot.
  const PLOT_KEY = { mine: 0, hut: 1, depot: 2, dock: 3, rail: 'rail', refinery: 'refinery', stall: 'stall', frostDrill: 'frostDrill', thermal: 'thermal', foundry: 'foundry', workshop: 'workshop', sporeGarden: 'sporeGarden', biolab: 'biolab' };
  const KEY_PLOT = { 0: 'mine', 1: 'hut', 2: 'depot', 3: 'dock' };
  // Where each workplace's manager stands (plot, offset in k) and which way they face.
  const STATIONS = {
    mine: ['mine', -2.9, 1],
    foundry: ['foundry', -3.1, 1],
    workshop: ['workshop', -0.85, 1],
    sporeGarden: ['sporeGarden', -2.55, 1],
    biolab: ['biolab', 2.2, -1],
    rail: ['rail', 0.95, 1],
    depot: ['depot', 2.25, -1],
    refinery: ['refinery', -2.45, 1],
    stall: ['stall', 1.75, -1],
    dock: ['dock', 1.4, -1],
    frostDrill: ['frostDrill', -2.7, 1],
    thermal: ['thermal', 1.8, -1]
  };
  const MANAGER_POSE = { mining: 'check', transport: 'signal', storage: 'check', production: 'operate', logistics: 'check', trade: 'stamp' };
  // Helper miners: up to three work at the vein; the rest rest at the huts (never stacked on one spot).
  const MINE_SLOTS = [-1.6, 3.15, 1.5]; // left flank of the vein, at the pile (loading the cart), right flank (Beta 1.3: computed below)
  const HELPER_SIZE = 0.82; // front-lane helper scale (k)
  const ZOOM_OVERVIEW = 0.62; // Beta 1.6: the overview camera (Übersicht) relative to the detail view
  // resting helpers stand in one row in front of their quarters, a full body width apart (never stacked)
  const REST_SLOTS = [-2.3, -1.15, 0, 1.15, 2.3, 3.45];

  function createColonyScene({ getView, events, actions = {} }) {
    let w = 360,
      h = 360,
      worldW = 1400,
      groundY = 270,
      k = 44,
      zoom = 'detail', // Beta 1.6: 'detail' (Nah) | 'overview' (Übersicht)
      time = 0,
      quality = 'high',
      reduced = false,
      shown = false,
      view = null,
      planetId = 'crystal',
      L = Layouts.layoutFor('crystal');
    const cam = { x: 0, target: 0, vel: 0 };
    const particles = new ParticlePool(140);
    const floaters = [];
    const construction = new Map();
    let cheer = 0,
      flash = 0,
      saleGlow = 0;
    const mochi = { x: 0, target: null, facing: 1, action: 'idle', actionTime: 0, idleTime: 0 };
    const helpers = [];
    const ships = [];
    const carts = [];
    const staffSprites = new Map();
    const residents = [];
    const stats = { harvestEvents: 0, upgradeEvents: 0, taps: 0, drags: 0, lastFloaterValue: 0, sales: 0, trips: 0, hires: 0 };
    const hits = [];
    const layerCache = new Map();

    const hasPlot = key => L.plots[key] !== undefined && L.plots[key] > 0;
    function plotX(key) {
      const name = KEY_PLOT[key] ?? key;
      return (L.plots[name] ?? L.plots.mine) * k;
    }
    function groundAt(x) {
      return groundY + Layouts.terrainOffset(L, x / k) * k;
    }
    function stationX(workplace) {
      const [plot, dx] = STATIONS[workplace];
      return plotX(plot) + dx * k * (plot === 'mine' ? mineDir() : plot === 'rail' ? Math.sign(trackEnd() - trackStart()) || 1 : 1);
    }
    const stationFacing = workplace => STATIONS[workplace][2] * (STATIONS[workplace][0] === 'mine' ? mineDir() : STATIONS[workplace][0] === 'rail' ? Math.sign(trackEnd() - trackStart()) || 1 : 1);
    const trackStart = () => plotX(L.track.from) + L.track.fromOffset * k,
      trackEnd = () => plotX(L.track.to) + L.track.toOffset * k;
    // Beta 1.3: while helpers mine at the vein's left flank Mochi waits on the free side (between the right flank and
    // the loader at the pile) instead of standing in front of the outcrop next to them
    const mochiHome = () => (helpers?.[0]?.working && L.mochi.plot === 'mine' ? plotX('mine') + 2.3 * k * mineDir() : plotX(L.mochi.plot) + L.mochi.offset * k);
    // The mine faces its cart line: on worlds where the track runs left, the whole mine site is mirrored.
    const mineDir = () => (L.track.fromOffset >= 0 ? 1 : -1);
    function layout() {
      // Phones: kitten size follows the stage height. Wide tablet stages show more of the colony (width-capped).
      // Living Worlds 2.0: phones show about six kitten widths instead of 4.7 — a whole building with its neighbours'
      // edges and the path between them, kittens still large (≈ 60 px on a 390 × 844 phone).
      k = math.clamp(w >= 560 ? Math.min(h * 0.14, w / 12) : Math.min(h * 0.165, w / 5.6), 32, 66);
      // Beta 1.6: the overview shows about 1.6× as much of the colony (kittens stay ≥ 24 px)
      if (zoom === 'overview') k = Math.max(24, k * ZOOM_OVERVIEW);
      groundY = h * 0.8;
      worldW = L.width * k;
      if (!mochi.x || mochi.x > worldW) mochi.x = mochiHome();
      cam.x = cam.target = math.clamp(mochi.x - w * 0.42, 0, Math.max(0, worldW - w));
      layerCache.clear();
    }
    // keeps the world point in the middle of the view where it is when the zoom changes
    function setZoom(level) {
      const next = level === 'overview' ? 'overview' : 'detail';
      if (next === zoom) return zoom;
      const centre = (cam.x + w / 2) / Math.max(1e-6, k);
      zoom = next;
      layout();
      cam.x = cam.target = math.clamp(centre * k - w / 2, 0, Math.max(0, worldW - w));
      return zoom;
    }
    function setPlanet(id) {
      planetId = id;
      L = Layouts.layoutFor(id);
      mochi.x = 0;
      helpers.length = 0;
      carts.length = 0;
      staffSprites.clear();
      residents.length = 0;
      layout();
    }

    // ----- Events -----
    const off = [];
    off.push(
      events.on('harvest', event => {
        if (!shown) return;
        stats.harvestEvents++;
        const dx = plotX('mine');
        mochi.idleTime = 0;
        // Beta 1.3: Mochi mines at a free flank of the outcrop (tool-tip contact) with hand tools, inspects from Lv 5
        const spot = mochiMineSpot(),
          goal = spot ? plotX('mine') + spot.at * k * mineDir() : mochiHome();
        if (Math.abs(mochi.x - goal) > 6) mochi.target = goal;
        mochi.spot = spot;
        mochi.action = spot && (view?.buildings?.[0] || 1) < 5 ? 'mine' : 'check';
        mochi.actionTime = mochi.action === 'mine' ? Kit.MINE_CYCLE : 0.5; // one complete swing per tap
        const color = event.critical ? '#ffd77a' : Art.THEMES[planetId]?.particle || '#fff';
        for (let i = 0; i < (reduced ? 4 : event.critical ? 14 : 8); i++)
          particles.spawn({ x: dx + (Math.random() - 0.3) * k, y: groundAt(dx) - 0.6 * k, vx: (Math.random() - 0.5) * 120, vy: -60 - Math.random() * 90, ay: 220, life: 0.6 + Math.random() * 0.4, size: 2.5 + Math.random() * 2, color, kind: 'gem' });
        const value = event.material ?? event.credits;
        const last = floaters[floaters.length - 1];
        if (last && last.unit === 'material' && last.age < 0.45 && !event.critical && !last.critical) {
          last.value += value;
          last.age = 0.05;
        } else {
          if (floaters.length >= 5) floaters.shift();
          floaters.push({ x: dx, y: groundAt(dx) - k * 2.1, value, unit: 'material', critical: event.critical, age: 0, life: 1.1 });
        }
        stats.lastFloaterValue = floaters[floaters.length - 1].value;
      })
    );
    off.push(
      events.on('upgrade', event => {
        if (!shown) return;
        stats.upgradeEvents++;
        const key = event.index,
          firstBuild = event.level === 1 && key !== 0;
        if (firstBuild || event.visualStage) construction.set(KEY_PLOT[key] ?? key, firstBuild ? 2.2 : 1.2);
        cheer = event.milestone || firstBuild ? 1.6 : 0.6;
        // Deep Core upgrades (the mine's lift tracks, shafts) belong to the mining outpost — the 'elevator' plot of a layout
        // is the orbital lift landmark at the spaceport, a different structure with the same key
        const deep = key === 'elevator' || event.shaft,
          x = deep ? plotX('mine') + mineDir() * (L.headframe ?? 1.9) * k : plotX(key);
        focusOn(x);
        // the new level rises from the building (a milestone says what it did); consecutive buys update one label
        if (Number.isFinite(event.level) && event.level > 0 && !(event.shaft || event.index === 'elevator')) {
          const label = event.milestone ? 'MEILENSTEIN · ×2' : 'Lv ' + event.level,
            last = floaters[floaters.length - 1];
          if (last && last.unit === 'level' && last.key === key && last.age < 0.9 && !event.milestone && !last.milestone) {
            last.label = label;
            last.age = 0.1;
          } else {
            if (floaters.length >= 5) floaters.shift();
            floaters.push({ x, y: groundAt(x) - k * 2.6, label, key, unit: 'level', milestone: event.milestone, age: 0, life: event.milestone ? 1.8 : 1.2 });
          }
        }
        for (let i = 0; i < (reduced ? 4 : 14); i++)
          particles.spawn({ x: x + (Math.random() - 0.5) * 2 * k, y: groundAt(x) - 4, vx: (Math.random() - 0.5) * 60, vy: -20 - Math.random() * 40, drag: 2, life: 0.9, size: 5 + Math.random() * 5, color: 'rgba(255,255,255,0.6)', kind: 'puff' });
      })
    );
    off.push(
      events.on('transport', event => {
        if (!shown || !event.manual) return;
        stats.trips++;
      })
    );
    off.push(
      events.on('sale', event => {
        if (!shown || (event.planet !== undefined && view && event.planet !== view.planetIndex) || !(event.credits > 0)) return;
        stats.sales++;
        saleGlow = 1;
        const x = event.workplace === 'dock' ? plotX('dock') : plotX('stall');
        const last = floaters[floaters.length - 1];
        if (last && last.unit === 'credits' && last.age < 0.8 && Math.abs(last.x - x) < 5) {
          last.value += event.credits;
          last.age = 0.1;
        } else {
          if (floaters.length >= 5) floaters.shift();
          floaters.push({ x, y: groundAt(x) - k * 2.3, value: event.credits, unit: 'credits', age: 0, life: 1.3 });
        }
        if (!reduced)
          for (let i = 0; i < 6; i++)
            particles.spawn({ x: x + (Math.random() - 0.5) * k, y: groundAt(x) - k, vx: (Math.random() - 0.5) * 60, vy: -60 - Math.random() * 40, ay: 160, life: 0.8, size: 3, color: '#ffd77a', kind: 'gem' });
      })
    );
    off.push(
      events.on('hire', event => {
        if (!shown || !view || event.planet !== view.planetIndex) return;
        stats.hires++;
        staffSprites.delete(event.workplace);
        cheer = 1.2;
        if (STATIONS[event.workplace]) focusOn(stationX(event.workplace));
      })
    );
    off.push(events.on('manager-upgrade', () => shown && (cheer = 1.4)));
    off.push(events.on('planet', () => (flash = 0.5)));
    off.push(events.on('story', () => (cheer = 1.2)));

    // ----- Input: drag pans, tap interacts (never both) -----
    let pointer = null;
    function toWorld(clientX, clientY, canvas) {
      const rect = canvas.getBoundingClientRect();
      return { x: clientX - rect.left + cam.x, y: clientY - rect.top };
    }
    function attach(canvas) {
      canvas.style.touchAction = 'pan-y';
      canvas.addEventListener('pointerdown', e => {
        pointer = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, camX: cam.target, dragging: false };
      });
      canvas.addEventListener('pointermove', e => {
        if (!pointer || e.pointerId !== pointer.id) return;
        const dx = e.clientX - pointer.x0;
        if (!pointer.dragging && Math.abs(dx) > TAP_SLOP && Math.abs(dx) > Math.abs(e.clientY - pointer.y0)) {
          pointer.dragging = true;
          stats.drags++;
          canvas.setPointerCapture?.(e.pointerId);
        }
        if (pointer.dragging) {
          cam.vel = (pointer.x - e.clientX) * 0.6;
          pointer.x = e.clientX;
          cam.target = cam.x = math.clamp(pointer.camX - dx, 0, Math.max(0, worldW - w));
        }
      });
      const end = e => {
        if (!pointer || e.pointerId !== pointer.id) return;
        const wasDrag = pointer.dragging;
        pointer = null;
        if (wasDrag) {
          cam.target = math.clamp(cam.x + cam.vel * 6, 0, Math.max(0, worldW - w));
          return;
        }
        if (e.type === 'pointercancel') return;
        stats.taps++;
        handleTap(toWorld(e.clientX, e.clientY, canvas));
      };
      canvas.addEventListener('pointerup', end);
      canvas.addEventListener('pointercancel', end);
    }
    function handleTap(p) {
      mochi.idleTime = 0;
      const hit = [...hits].reverse().find(r => p.x >= r.x0 && p.x <= r.x1 && p.y >= r.y0 && p.y <= r.y1);
      if (hit) {
        if (hit.type === 'deposit') actions.mine?.();
        else if (hit.type === 'building') actions.openBuilding?.(hit.key);
        else if (hit.type === 'capsule') actions.openCapsule?.();
        else if (hit.type === 'mine-entrance') actions.enterMine?.();
        else if (hit.type === 'pips') actions.talk?.('pips');
        else if (hit.type === 'guardian') actions.talk?.(hit.key);
        else if (hit.type === 'cart') view.auto?.rail ? actions.openBuilding?.('rail') : actions.sendCart?.();
        else if (hit.type === 'sell') actions.sell?.('stall');
        else if (hit.type === 'mochi') {
          mochi.action = 'cheer';
          mochi.actionTime = 1.2;
        }
        return;
      }
      if (p.y > groundY - k * 2) mochi.target = math.clamp(p.x, k, worldW - k);
    }
    function focusOn(x) {
      cam.target = math.clamp(x - w / 2, 0, Math.max(0, worldW - w));
    }
    function focusMochi() {
      focusOn(mochi.x);
    }

    // ----- Simulation of visuals -----
    function syncEntities() {
      const count = view.helperCount || 0;
      while (helpers.length < count) {
        const i = helpers.length;
        helpers.push({ x: plotX('hut') + (i - 1) * 0.9 * k, dir: 1, look: Kit.WORKERS[i % Kit.WORKERS.length], seed: 30 + i, working: false });
      }
      helpers.length = count;
      const shipCount = view.buildings[3] > 0 ? Math.min(3, view.freighterCount) : 0;
      while (ships.length < shipCount) ships.push({ t: ships.length / Math.max(1, shipCount) });
      ships.length = shipCount;
      const rail = view.industry?.rail || 0,
        cartCount = rail >= 50 ? 2 : 1;
      while (carts.length < cartCount) carts.push({ pos: carts.length * 0.5, dir: 1, loaded: true, trip: null });
      carts.length = cartCount;
      // After the liberation of Glacies, more residents come out of their warm houses.
      // On a frozen world only one shivering resident is outside; liberation brings everyone out.
      const pool = [
          ...(L.residents || []),
          ...(view.frostbyte === 'repaired' ? [{ plot: 'depot', offset: 2.6 }, { plot: 'thermal', offset: -2.8 }] : []),
          // Pyra after Emberbell's recalibration: residents dare to come out to the market and the foundry
          ...(view.pyra?.calm ? [{ plot: 'stall', offset: 2.4 }, { plot: 'foundry', offset: 3.9 }, { plot: 'dock', offset: 2.6 }] : []),
          // Mekhanos after Cogsworth's repair: maintenance kittens are back at the workshop and the refinery
          ...(view.mekhanos?.freed ? [{ plot: 'workshop', offset: 4.1 }, { plot: 'refinery', offset: -2.6 }, { plot: 'depot', offset: 2.2 }] : []),
          // Viridia after Petalguard's healing: gardeners come out among the blossoms
          ...(view.viridia?.bloom ? [{ plot: 'sporeGarden', offset: 2.6 }, { plot: 'biolab', offset: -2.7 }, { plot: 'dock', offset: 2.6 }] : [])
        ],
        wanted = view.heated === false ? 1 : pool.length;
      if (residents.length && residents.length !== wanted) residents.length = 0;
      if (!residents.length)
        pool.slice(0, wanted).forEach((r, i) =>
          residents.push({ x: plotX(r.plot) + r.offset * k, look: Kit.WORKERS[(i + 3) % Kit.WORKERS.length], seed: 60 + i, chat: 0, facing: i % 2 ? -1 : 1 })
        );
    }
    function update(frame) {
      const dt = frame.dt;
      time = frozenTime !== null ? frozenTime : time + dt;
      quality = frame.quality;
      reduced = frame.reducedMotion;
      view = getView();
      if (!view) return;
      if (view.planetId !== planetId) setPlanet(view.planetId);
      syncEntities();
      if (!pointer?.dragging) cam.x = math.damp(cam.x, cam.target, 8, dt);
      cam.x = math.clamp(cam.x, 0, Math.max(0, worldW - w));
      // Mochi
      mochi.idleTime += dt;
      mochi.actionTime = Math.max(0, mochi.actionTime - dt);
      if (mochi.target !== null) {
        const dx = mochi.target - mochi.x;
        if (Math.abs(dx) < 3) mochi.target = null;
        else {
          mochi.facing = dx > 0 ? 1 : -1;
          mochi.x += Math.sign(dx) * Math.min(Math.abs(dx), 2.4 * k * dt);
        }
      }
      // Mochi drifts back to her (possibly shifted) waiting spot after a short pause — never into the helpers' slots
      if (mochi.target === null && mochi.actionTime <= 0 && mochi.idleTime > 1.5 && Math.abs(mochi.x - mochiHome()) > 0.6 * k) mochi.target = mochiHome();
      // Helper miners: work at the vein only while mining really runs, otherwise rest at the huts.
      const working = view.auto ? view.auto.mine : view.extraction > 0;
      helpers.forEach((hp, i) => {
        const loader = i === 1,
          mineSlot = working && i < MINE_SLOTS.length && (!loader || (view.auto?.rail && view.flow?.moving)),
          home = mineSlot ? plotX('mine') + mineSlotOf(i).at * k * mineDir() : plotX('hut') + REST_SLOTS[i % REST_SLOTS.length] * k;
        if (Math.abs(hp.x - home) > 2) {
          hp.dir = home > hp.x ? 1 : -1;
          hp.x += hp.dir * Math.min(Math.abs(home - hp.x), 1.2 * k * dt);
          hp.working = false;
          hp.walking = true;
        } else {
          hp.walking = false;
          hp.working = mineSlot;
          hp.resting = !mineSlot;
        }
      });
      // Vehicles: shuttle while transport really moves goods, or one manual trip.
      const length = Math.max(k, Math.abs(trackEnd() - trackStart())),
        speed = (reduced ? 1.2 : 2.2) * k / length;
      const trip = view.trip;
      carts.forEach((c, i) => {
        const auto = view.auto?.rail && view.flow?.moving;
        if (i === 0 && trip && !auto) {
          // authoritative manual trip: position = real progress; it waits at the depot while the depot is full
          c.pos = trip.progress;
          c.dir = 1;
          c.loaded = true;
          c.trip = { back: true };
          return;
        }
        if (c.trip || auto) {
          c.pos += c.dir * speed * dt * (1 + i * 0.12);
          if (c.pos >= 1) {
            c.pos = 1;
            c.dir = -1;
            c.loaded = false;
          } else if (c.pos <= 0) {
            c.pos = 0;
            c.dir = 1;
            c.loaded = view.pileRatio > 0.01 || auto;
            c.trip = null;
          }
        } else if (c.pos > 0) {
          c.pos = Math.max(0, c.pos - speed * dt);
          c.dir = -1;
          c.loaded = false;
        } else {
          c.dir = 1;
          c.loaded = view.pileRatio > 0.01;
        }
      });
      // Ships only fly while freight really runs (or finish a started cycle).
      const flying = view.auto?.dock && view.flow?.selling;
      for (const s of ships) if (flying || s.t % 1 > 0.02) s.t = (s.t + dt * (0.04 + 0.05 * math.clamp(view.transportUtilization, 0.2, 1))) % 1;
      // Managers on duty walk in on arrival, greet, then work at their station.
      const duty = view.managers || {};
      for (const key of [...staffSprites.keys()]) if (!duty[key] || !STATIONS[key]) staffSprites.delete(key);
      Object.entries(duty).forEach(([workplace, m]) => {
        if (!STATIONS[workplace] || !hasPlot(STATIONS[workplace][0])) return;
        const id = m.kind === 'special' ? m.id : 'staff-' + m.job;
        let sprite = staffSprites.get(workplace);
        if (!sprite || sprite.key !== id) {
          sprite = { key: id, x: stationX(workplace) - (stats.hires ? 3.5 * k : 0), greet: stats.hires ? 1.6 : 0 };
          staffSprites.set(workplace, sprite);
        }
        const target = stationX(workplace);
        if (Math.abs(sprite.x - target) > 2) sprite.x += Math.sign(target - sprite.x) * Math.min(Math.abs(target - sprite.x), 2 * k * dt);
        else sprite.greet = Math.max(0, sprite.greet - dt);
      });
      // Residents: occasional short chats (two neighbours face each other with a tiny bubble).
      residents.forEach((r, i) => {
        r.chat = Math.max(0, r.chat - dt);
        if (!reduced && r.chat === 0 && Math.random() < dt * 0.05) r.chat = 2.5;
        if (r.chat > 0 && residents[i ^ 1]) r.facing = residents[i ^ 1].x > r.x ? 1 : -1;
      });
      for (const [key, left] of construction) left - dt <= 0 ? construction.delete(key) : construction.set(key, left - dt);
      cheer = Math.max(0, cheer - dt);
      flash = Math.max(0, flash - dt);
      saleGlow = Math.max(0, saleGlow - dt);
      // Snow on cold worlds (restrained)
      if (L.sky.snow && !reduced && quality !== 'low' && Math.random() < dt * 6)
        particles.spawn({ x: cam.x + Math.random() * w, y: -4, vx: 6, vy: 18 + Math.random() * 10, life: (h / 22) * 1.1, size: 1.4 + Math.random() * 1.4, color: 'rgba(255,255,255,0.85)', kind: 'snow' });
      particles.update(dt);
      for (const f of floaters) f.age += dt;
      for (let i = floaters.length - 1; i >= 0; i--) if (floaters[i].age >= floaters[i].life) floaters.splice(i, 1);
    }

    // ----- Drawing -----
    function addHit(r, type, key) {
      if (r) hits.push({ x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1, type, key });
    }
    function kitten(ctx, look, x, y, size, opts) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(size, size);
      Kit.drawKitten(ctx, look, opts);
      ctx.restore();
    }
    function cached(key, width, height, paint) {
      if (layerCache.has(key)) return layerCache.get(key);
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.ceil(width));
      c.height = Math.max(1, Math.ceil(height));
      const ctx = c.getContext('2d');
      if (ctx) paint(ctx);
      if (layerCache.size > 12) layerCache.delete(layerCache.keys().next().value);
      layerCache.set(key, c);
      return c;
    }
    function ridge(ctx, width, base, amp, freq, seed, color) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= width; x += 16) ctx.lineTo(x, base - Math.sin(x * freq + seed) * amp - Math.sin(x * freq * 2.7 + seed * 2) * amp * 0.35);
      ctx.lineTo(width, h);
      ctx.closePath();
      ctx.fill();
    }
    function drawBackground(ctx, width, height, theme) {
      const bg = Art.spaceBackground('col-' + planetId, Math.ceil(width) + 60, Math.ceil(height), theme.sky, math.hash('sky' + planetId));
      ctx.drawImage(bg, -(cam.x * 0.05) % 60, 0);
      if (L.sky.aurora) CA.aurora(ctx, width, height, time);
      const [px, py] = L.sky.planet;
      Art.drawPlanet(ctx, planetId, width * px - cam.x * 0.03, height * py, Math.min(width, height) * 0.08, time * 0.003);
      // Parallax ridges + distant settlement silhouettes (cached per planet and size)
      const far = cached('far' + planetId + w + 'x' + h, worldW * 0.3 + w, h, c => ridge(c, worldW * 0.3 + w, groundY - 1.6 * k, 0.5 * k, 0.006, 1, theme.surface[1][1] + 'aa'));
      const mid = cached('mid' + planetId + w + 'x' + h, worldW * 0.55 + w, h, c => {
        ridge(c, worldW * 0.55 + w, groundY - 0.9 * k, 0.45 * k, 0.009, 2, theme.surface[2][1] + 'dd');
        if (L.skyline !== 'volcanoes' && L.skyline !== 'factories' && L.skyline !== 'blooms') CA.skyline(c, worldW * 0.55 + w, groundY - 0.95 * k, k * 0.7, L.skyline, theme.surface[1][1] + 'cc', 1 + planetId.length * 97);
      });
      ctx.drawImage(far, -cam.x * 0.3, 0);
      // Pyra: live volcanoes between the ridges (their smoke and crater glow show the heat state)
      if (L.skyline === 'volcanoes' && window.PyraArt) {
        ctx.save();
        ctx.translate(-cam.x * 0.42, 0);
        window.PyraArt.volcanoSkyline(ctx, worldW * 0.42 + w, groundY - 1.25 * k, k, 7, Boolean(view.pyra?.calm), time);
        ctx.restore();
      }
      // Viridia: giant blossoms and mushroom trees (open and pollen-gold once Petalguard is healed)
      if (L.skyline === 'blooms' && window.ViridiaArt) {
        ctx.save();
        ctx.translate(-cam.x * 0.42, 0);
        window.ViridiaArt.bloomSkyline(ctx, worldW * 0.42 + w, groundY - 1.0 * k, k, 13, time, Boolean(view.viridia?.bloom));
        ctx.restore();
      }
      // Mekhanos: the factory skyline (its chimney beacons glow, the giant cogs turn very slowly)
      if (L.skyline === 'factories' && window.MekhanosArt) {
        ctx.save();
        ctx.translate(-cam.x * 0.42, 0);
        window.MekhanosArt.factorySkyline(ctx, worldW * 0.42 + w, groundY - 1.1 * k, k, 11, time);
        ctx.restore();
      }
      ctx.drawImage(mid, -cam.x * 0.55, 0);
    }
    // Fertigung bench (Beta 1.4 M7): a small conveyor table; each running order is a token riding the belt with its real
    // progress (red lamp = output store full), finished goods stand as crates on the shelf below.
    function drawFabBench(ctx, x, y, fab) {
      const w = 1.3 * k,
        top = y - 0.62 * k;
      ctx.fillStyle = 'rgba(30,26,60,0.9)';
      ctx.fillRect(x - w / 2, top, w, 0.12 * k);
      ctx.fillStyle = '#4a4f78';
      ctx.fillRect(x - w / 2 + 0.06 * k, top + 0.12 * k, 0.08 * k, 0.5 * k);
      ctx.fillRect(x + w / 2 - 0.14 * k, top + 0.12 * k, 0.08 * k, 0.5 * k);
      // belt with rollers
      ctx.fillStyle = '#2a2d52';
      ctx.fillRect(x - w / 2 + 0.05 * k, top - 0.08 * k, w - 0.1 * k, 0.08 * k);
      ctx.fillStyle = '#7f86b8';
      const roll = reduced ? 0 : (time * 0.6) % 1;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.arc(x - w / 2 + (0.15 + ((i + roll) % 6) * 0.2) * k, top - 0.04 * k, 0.025 * k, 0, TAU);
        ctx.fill();
      }
      fab.work.forEach((o, i) => {
        const tx = x - w / 2 + (0.12 + o.progress * 0.95) * w * 0.85,
          ty = top - 0.16 * k - i * 0.02 * k;
        ctx.fillStyle = o.color;
        ctx.fillRect(tx - 0.08 * k, ty - 0.08 * k, 0.16 * k, 0.16 * k);
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 0.02 * k;
        ctx.strokeRect(tx - 0.08 * k, ty - 0.08 * k, 0.16 * k, 0.16 * k);
      });
      // status lamp: green while working, red when an output store is full, dim when idle
      const blocked = fab.work.some(o => o.blocked),
        lamp = blocked ? '#ff6b6b' : fab.work.length ? '#8ff0d4' : '#5a5f88';
      ctx.fillStyle = lamp;
      ctx.beginPath();
      ctx.arc(x + w / 2 - 0.1 * k, top - 0.24 * k, 0.06 * k, 0, TAU);
      ctx.fill();
      if ((fab.work.length || blocked) && !reduced) {
        ctx.globalAlpha = 0.35 + 0.25 * Math.sin(time * 5);
        ctx.beginPath();
        ctx.arc(x + w / 2 - 0.1 * k, top - 0.24 * k, 0.14 * k, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      // crates of finished goods under the table
      let cx = x - w / 2 + 0.22 * k;
      for (const g of fab.shelf)
        for (let n = 0; n < g.n && cx < x + w / 2 - 0.2 * k; n++) {
          ctx.fillStyle = g.color;
          ctx.fillRect(cx, y - 0.2 * k, 0.16 * k, 0.16 * k);
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.fillRect(cx, y - 0.2 * k + 0.07 * k, 0.16 * k, 0.02 * k);
          cx += 0.19 * k;
        }
    }
    const groundCache = { key: '' };
    // the ground fill outline and the rim line through the same points (either target may be null)
    function groundOutline(fill, rim, ys, height) {
      if (fill) fill.moveTo(0, height);
      for (let i = 0; i < ys.length; i++) {
        const x = i * 12;
        if (fill) fill.lineTo(x, ys[i]);
        if (rim) i ? rim.lineTo(x, ys[i] + 0.03 * k) : rim.moveTo(x, ys[i] + 0.03 * k);
      }
      if (fill) {
        fill.lineTo(worldW, height);
        fill.closePath();
      }
    }
    function drawGround(ctx, height, theme) {
      const g = ctx.createLinearGradient(0, groundY - 0.4 * k, 0, height);
      // a layout may give its own ground colours (Mekhanos: steel deck instead of the pale planet surface)
      g.addColorStop(0, L.ground?.[0] || theme.surface[3][1]);
      g.addColorStop(1, L.ground?.[1] || theme.surface[1][1]);
      ctx.fillStyle = g;
      // the ground outline is static per layout and size: its heights are computed once, and drawn from a cached
      // Path2D where the canvas has one (every browser; test canvases without Path2D replay the same points) — Beta 1.4 M0
      const key = planetId + ':' + k + ':' + worldW + ':' + height;
      if (groundCache.key !== key) {
        const ys = [];
        for (let x = 0; x <= worldW; x += 12) ys.push(groundAt(x));
        groundCache.key = key;
        groundCache.ys = ys;
        groundCache.fillPath = groundCache.rim = null;
        if (typeof Path2D === 'function') {
          const fillPath = new Path2D(),
            rim = new Path2D();
          groundOutline(fillPath, rim, ys, height);
          Object.assign(groundCache, { fillPath, rim });
        }
      }
      if (groundCache.fillPath) ctx.fill(groundCache.fillPath);
      else {
        ctx.beginPath();
        groundOutline(ctx, null, groundCache.ys, height);
        ctx.fill();
      }
      // cliffs under raised platforms
      for (const p of L.platforms || [])
        if (p.style === 'cliff') CA.cliff(ctx, p.from * k, p.to * k, groundY + p.dy * k, groundY + 0.4 * k, k, L.sky.snow);
      // snow / regolith highlight along the surface
      ctx.strokeStyle = L.sky.snow ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 0.08 * k;
      if (groundCache.rim) ctx.stroke(groundCache.rim);
      else {
        ctx.beginPath();
        groundOutline(null, ctx, groundCache.ys, height);
        ctx.stroke();
      }
      // paved path between the buildings
      for (const [a, b] of L.paths || []) {
        ctx.fillStyle = L.sky.snow ? 'rgba(160,210,230,0.35)' : 'rgba(255,255,255,0.14)';
        for (let x = a * k; x <= b * k; x += 0.55 * k) {
          ctx.beginPath();
          ctx.ellipse(x, groundAt(x) + 0.55 * k, 0.24 * k, 0.07 * k, 0, 0, TAU);
          ctx.fill();
        }
      }
      // Pyra: the magma channel crossing the colony (walkway over it)
      if (L.lava && window.PyraArt) window.PyraArt.lavaChannel(ctx, L.lava.from * k, L.lava.to * k, groundAt(((L.lava.from + L.lava.to) / 2) * k) + 0.05 * k, k, time, Boolean(view.pyra?.calm));
      // soil texture
      // the soil speckles are static too: their numbers are computed once per layout and size (same seeded values as
      // before); each speckle is still filled on its own, so overlapping translucent speckles look exactly as before
      if (groundCache.soilKey !== groundCache.key) {
        const srnd = math.seeded(math.hash('soil' + planetId)),
          soil = new Float64Array(60 * 4);
        for (let i = 0; i < 60; i++) {
          const x = srnd() * worldW;
          soil[i * 4] = x;
          soil[i * 4 + 1] = groundAt(x) + 0.7 * k + srnd() * (height - groundY - 0.6 * k);
          soil[i * 4 + 2] = 0.05 * k + srnd() * 0.1 * k;
          soil[i * 4 + 3] = 0.03 * k + srnd() * 0.04 * k;
        }
        groundCache.soil = soil;
        groundCache.soilKey = groundCache.key;
      }
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      const soil = groundCache.soil;
      for (let i = 0; i < soil.length; i += 4) {
        ctx.beginPath();
        ctx.ellipse(soil[i], soil[i + 1], soil[i + 2], soil[i + 3], 0, 0, TAU);
        ctx.fill();
      }
    }
    function drawCables(ctx) {
      const poles = L.poles || [];
      ctx.strokeStyle = 'rgba(60,60,110,0.55)';
      ctx.lineWidth = Math.max(1, 0.03 * k);
      for (let i = 1; i < poles.length; i++) {
        const x0 = poles[i - 1] * k,
          x1 = poles[i] * k,
          y0 = groundAt(x0) - 1.8 * k,
          y1 = groundAt(x1) - 1.8 * k;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo((x0 + x1) / 2, Math.max(y0, y1) + 0.35 * k, x1, y1);
        ctx.stroke();
      }
      poles.forEach(p => CA.pole(ctx, p * k, groundAt(p * k), k, view.auto?.mine, time));
    }
    function drawDecor(ctx, theme) {
      const rnd = math.seeded(math.hash('deco' + planetId)),
        avoid = Object.values(L.plots).filter(v => v > 0),
        signs = (L.districts || []).map(d => d.from + 0.95);
      for (let i = 0; i < (L.decor.density || 12); i++) {
        const xk = rnd() * L.width,
          s = (0.6 + rnd() * 0.5) * k;
        if (avoid.some(p => Math.abs(p - xk) < 2.9) || signs.some(p => Math.abs(p - xk) < 1.3)) continue;
        if (L.decor.kind === 'machine' && window.MekhanosArt) window.MekhanosArt.prop(ctx, xk * k, groundAt(xk * k) + 0.05 * k, s, time, i);
        else if (L.decor.kind === 'volcanic' && window.PyraArt) window.PyraArt.prop(ctx, xk * k, groundAt(xk * k) + 0.05 * k, s, time, i, Boolean(view.pyra?.calm));
        else if (L.decor.kind === 'verdant' && window.ViridiaArt) window.ViridiaArt.prop(ctx, xk * k, groundAt(xk * k) + 0.05 * k, s, time, i, Boolean(view.viridia?.bloom));
        else CA.prop(ctx, L.decor.kind, xk * k, groundAt(xk * k) + 0.05 * k, s, time, i, theme);
      }
    }
    // Beta 1.3 colony look: a lantern chain between the built plots (purely visual, glows softly; static in reduced motion)
    function drawLanterns(ctx) {
      const xs = ['mine', 'hut', 'depot', 'dock'].filter(hasPlot).map(plotX).sort((a, b) => a - b);
      if (xs.length < 2) return;
      const colors = ['#ff9ecb', '#ffd77a', '#8ff0d4', '#c4b3ff'];
      let n = 0;
      for (let s = 0; s < xs.length - 1; s++) {
        const x0 = xs[s] + 0.6 * k,
          x1 = xs[s + 1] - 0.6 * k;
        if (x1 - x0 < k) continue;
        const y0 = groundAt(x0) - 2.5 * k,
          y1 = groundAt(x1) - 2.5 * k,
          sag = 0.45 * k,
          at = u => ({ x: x0 + (x1 - x0) * u, y: y0 + (y1 - y0) * u + Math.sin(u * Math.PI) * sag });
        ctx.strokeStyle = 'rgba(60,50,90,0.85)';
        ctx.lineWidth = Math.max(1, 0.04 * k);
        ctx.beginPath();
        for (let u = 0; u <= 1.001; u += 0.1) {
          const p = at(u);
          u ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
        }
        ctx.stroke();
        const count = Math.max(2, Math.floor((x1 - x0) / (0.9 * k)));
        for (let i = 1; i < count; i++) {
          const p = at(i / count),
            c = colors[n++ % colors.length],
            pulse = reduced ? 0.45 : 0.35 + Math.sin(time * 2 + n) * 0.12;
          Art.glowCircle(ctx, p.x, p.y + 0.22 * k, 0.38 * k, c, pulse);
          ctx.fillStyle = c;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y + 0.22 * k, 0.1 * k, 0.13 * k, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(60,50,90,0.9)';
          ctx.fillRect(p.x - 0.07 * k, p.y + 0.02 * k, 0.14 * k, 0.05 * k);
        }
      }
    }
    // Living Worlds 2.0: each district gets its own ground zone (a soft paved strip in its colour along the path) and
    // a signpost at its start — the functional areas read without labels
    function drawDistricts(ctx) {
      const list = L.districts;
      if (!list) return;
      for (const d of list) {
        const x0 = d.from * k,
          x1 = d.to * k;
        if (x1 < cam.x - k || x0 > cam.x + w + k) continue;
        const yy = x => groundAt(x) + 0.1 * k;
        // the district's paved zone along the path, with a kerb line in its colour
        ctx.fillStyle = d.color + '30';
        ctx.beginPath();
        ctx.moveTo(x0, yy(x0));
        for (let x = x0; x <= x1; x += 0.5 * k) ctx.lineTo(x, yy(x));
        ctx.lineTo(x1, yy(x1) + 0.36 * k);
        for (let x = x1; x >= x0; x -= 0.5 * k) ctx.lineTo(x, yy(x) + 0.36 * k);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = d.color + '99';
        ctx.lineWidth = Math.max(1, 0.035 * k);
        ctx.beginPath();
        for (let x = x0 + 0.2 * k; x <= x1 - 0.2 * k; x += 0.5 * k) x === x0 + 0.2 * k ? ctx.moveTo(x, yy(x)) : ctx.lineTo(x, yy(x));
        ctx.stroke();
        // the signpost at the district's entrance: its icon and name (part of the world, readable without UI)
        const sx = x0 + 0.95 * k,
          sy = groundAt(sx),
          bw = 1.5 * k,
          bh = 0.5 * k,
          top = sy - 1.55 * k;
        ctx.fillStyle = '#4a4470';
        ctx.fillRect(sx - 0.05 * k, top + bh, 0.1 * k, sy - top - bh);
        CA.fillRR?.(ctx, sx - bw / 2, top, bw, bh, 0.12 * k, 'rgba(29,33,80,0.94)');
        ctx.fillStyle = d.color;
        ctx.fillRect(sx - bw / 2 + 0.08 * k, top + bh - 0.07 * k, bw - 0.16 * k, 0.035 * k);
        ctx.font = `900 ${Math.max(9, Math.round(0.21 * k))}px Nunito, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = d.color;
        ctx.fillText(d.icon + ' ' + d.name.toUpperCase(), sx, top + bh * 0.45);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      }
    }
    // Living Worlds 2.0: a built workplace without a manager shows its free station — a dashed ring on the ground with a
    // small plus, quiet next to the buildings; a tap opens that building's sheet, where the manager is hired
    function drawFreeStations(ctx, b, ind, auto) {
      const duty = view.managers || {},
        level = { mine: b[0], depot: b[2], dock: b[3] };
      for (const [workplace, st] of Object.entries(STATIONS)) {
        const plotName = st[0];
        if (!hasPlot(plotName) || auto[workplace] || duty[workplace]) continue;
        if (!((level[workplace] ?? ind[workplace]) > 0)) continue;
        const x = stationX(workplace);
        if (x < cam.x - k || x > cam.x + w + k) continue;
        const y = groundAt(x) + 0.06 * k;
        ctx.save();
        ctx.globalAlpha = 0.75;
        ctx.setLineDash?.([0.12 * k, 0.1 * k]);
        ctx.strokeStyle = '#8ff0d4';
        ctx.lineWidth = Math.max(1, 0.04 * k);
        ctx.beginPath();
        ctx.ellipse(x, y, 0.42 * k, 0.12 * k, 0, 0, TAU);
        ctx.stroke();
        ctx.setLineDash?.([]);
        CA.fillRR?.(ctx, x - 0.17 * k, y - 0.72 * k, 0.34 * k, 0.34 * k, 0.17 * k, 'rgba(29,33,80,0.85)');
        ctx.fillStyle = '#8ff0d4';
        ctx.fillRect(x - 0.09 * k, y - 0.565 * k, 0.18 * k, 0.03 * k);
        ctx.fillRect(x - 0.015 * k, y - 0.64 * k, 0.03 * k, 0.18 * k);
        ctx.restore();
        addHit({ x0: x - 0.5 * k, y0: y - 0.85 * k, x1: x + 0.5 * k, y1: y + 0.2 * k }, 'building', PLOT_KEY[plotName]);
      }
    }
    // which district the camera centre is in (district nav + the visible district name)
    function districtAt(xWorld) {
      return (L.districts || []).find(d => xWorld >= d.from * k && xWorld < d.to * k) || null;
    }
    function drawBuildings(ctx, theme) {
      const v = view,
        b = v.buildings,
        ind = v.industry || {},
        flow = v.flow || {},
        auto = v.auto || {},
        common = { theme, time };
      const plot = (name, level, label, draw, extra = {}) => {
        if (!hasPlot(name)) return null;
        const x = plotX(name),
          y = groundAt(x);
        if (!level) {
          const r = CA.emptyPlot(ctx, x, y, k, label, extra.locked);
          addHit(r, 'building', PLOT_KEY[name]);
          return null;
        }
        if (construction.has(name)) CA.scaffold(ctx, x, y, 3 * k, 2.6 * k, k);
        const r = draw(ctx, x, y, k, { ...common, level, ...extra });
        addHit(r, 'building', PLOT_KEY[name]);
        return r;
      };
      if (L.cavern) CA.cavern(ctx, plotX(L.cavern.plot), groundAt(plotX(L.cavern.plot)), k, time, L.sky.snow);
      plot('dock', b[3], 'Frachtdock', CA.dock, { active: auto.dock && flow.selling, queue: v.transportBottleneck });
      plot('hut', b[1], 'Helferhütte', CA.hut, { cold: L.sky.snow, warm: v.heated !== false });
      // planet-specific storage/market art (Glacies: Eislager + Frostmarkt; Pyra: Basaltlager + Glutmarkt)
      const VA = planetId === 'verdant' && window.ViridiaArt,
        vv = view.viridia || {},
        welke = Boolean(VA) && !vv.bloom;
      // Viridia: the Uralter Wurzelknoten (tap: the root network sheet) and its glowing roots to the stages they feed
      if (VA && L.rootNode) {
        const nx = L.rootNode * k,
          ny = groundAt(nx),
          targetX = { mine: hasPlot('mine') ? plotX('mine') : null, rail: hasPlot('rail') ? plotX('rail') : null, sporeGarden: hasPlot('sporeGarden') ? plotX('sporeGarden') : null, biolab: hasPlot('biolab') ? plotX('biolab') : null };
        (vv.roots || []).forEach(r => {
          if (!r.open || !r.target || targetX[r.target] == null) return;
          const tx = targetX[r.target];
          VA.rootLine(ctx, nx, ny - 0.1 * k, tx, groundAt(tx) - 0.1 * k, k, time, r.growing, reduced);
        });
        const welkeShare = vv.stage === 'withering' ? 1 - (vv.healed || 0) / 8 : ['overgrown'].includes(vv.stage) ? 1 : 0;
        const r = VA.rootNode(ctx, nx, ny, k, time, { welke: welkeShare, bloom: vv.bloom, reduced });
        hits.push({ ...r, type: 'guardian', key: 'rootnode' });
      }
      const ice = planetId === 'ice',
        PA = window.PyraArt,
        volcanic = planetId === 'volcanic' && PA,
        calm = Boolean(v.pyra?.calm);
      if (volcanic)
        for (const lm of L.landmarks || []) {
          const lx = lm.x * k,
            ly = groundAt(lx);
          if (lm.kind === 'coolingTower') PA.coolingTower(ctx, lx, ly, k, time, calm);
          else PA.vent(ctx, lx, ly, k, time, calm, Math.round(lm.x));
        }
      const MK = planetId === 'machine' && window.MekhanosArt;
      if (MK) {
        const producing = Boolean(flow.assembling || flow.refining || flow.moving || flow.mining);
        for (const lm of L.landmarks || []) {
          const lx = lm.x * k,
            ly = groundAt(lx);
          // before Cogsworth's repair the old towers creak along at a fifth of their speed (locked by his rules)
          const tt = view.mekhanos?.freed ? time : time * 0.2;
          if (lm.kind === 'gearTower') MK.gearTower(ctx, lx, ly, k, tt, producing);
          else if (lm.kind === 'pipeBridge') MK.pipeBridge(ctx, lx, lm.to * k, Math.max(ly, groundAt(lm.to * k)), k, tt, producing && Boolean(view.mekhanos?.freed));
        }
      }
      plot('depot', b[2], ice ? 'Eislager' : volcanic ? 'Basaltlager' : VA ? 'Wurzellager' : 'Lagerhaus', ice ? CA.iceDepot : volcanic ? PA.depot : VA ? VA.depot : CA.depot, { fill: v.storageRatio, active: flow.moving, warm: v.heated !== false, calm });
      plot('refinery', ind.refinery, 'Raffinerie', CA.refinery, { active: flow.refining, hopper: v.hopperRatio, bars: v.barsRatio, locked: !v.refineryUnlocked });
      // Beta 1.4 M7: the Fertigung bench right of the refinery (or the Thermalwerkstatt): real orders and goods
      if (view.fab) {
        const host = ind.refinery && hasPlot('refinery') ? 'refinery' : ind.thermal && hasPlot('thermal') ? 'thermal' : null;
        if (host) drawFabBench(ctx, plotX(host) + 2.05 * k, groundAt(plotX(host) + 2.05 * k), view.fab);
      }
      plot('stall', ind.stall, 'Verkaufsstand', (c, x, y, kk, o) => {
        const r = (ice ? CA.iceStall : volcanic ? PA.stall : VA ? VA.stall : CA.stall)(c, x, y, kk, o);
        if (r && !auto.stall) hits.push({ ...r.counter, type: 'sell', key: 'stall' });
        return r;
      }, { fill: v.storageRatio, saleGlow });
      if (hasPlot('thermal')) plot('thermal', ind.thermal || 0, 'Thermalwerkstatt', CA.thermalWorkshop, { active: flow.thermal, heated: v.heated, fill: v.cellsRatio, locked: !v.thermalUnlocked });
      if (hasPlot('foundry') && PA) plot('foundry', ind.foundry || 0, 'Glutschmelze', PA.foundry, { active: flow.smelting, fill: v.emberRatio, bars: v.alloyRatio, cooled: v.cooled, calm, overheated: (ind.foundry || 0) >= 10 && !calm });
      if (hasPlot('sporeGarden') && VA) plot('sporeGarden', ind.sporeGarden || 0, 'Sporengarten', VA.sporeGarden, { active: flow.sporing, fill: v.sporeRatio, welke });
      if (hasPlot('biolab') && VA) plot('biolab', ind.biolab || 0, 'Biolabor', VA.biolab, { active: flow.brewing, fill: v.sporeRatio, gel: v.gelRatio, welke, capped: welke && (ind.biolab || 0) >= 10, locked: !v.biolabUnlocked });
      if (hasPlot('workshop') && MK) plot('workshop', ind.workshop || 0, 'Präzisionswerkstatt', MK.workshop, { active: flow.assembling, fill: v.precisionRatio, parts: v.partsRatio });
      // maintenance robots: they roll around while the colony's machines really run
      if (MK) for (const lm of L.landmarks || []) if (lm.kind === 'bot') MK.maintenanceBot(ctx, lm.x * k, groundAt(lm.x * k) + 0.05 * k, k * 0.9, time, Boolean(flow.assembling || flow.moving || flow.selling), lm.x);
      if (hasPlot('frostDrill')) plot('frostDrill', ind.frostDrill || 0, 'Frostquarz-Bohrer', CA.frostDrill, { active: flow.frost, frozen: v.heated === false, fill: v.frostRatio });
      if (hasPlot('elevator')) CA.elevator(ctx, plotX('elevator'), groundAt(plotX('elevator')), k, { ...common, stage: v.stage });
      drawFreeStations(ctx, b, ind, auto);
      // mine last among buildings (its pile overlaps the track start)
      const mx = plotX('mine'),
        my = groundAt(mx);
      // Deep Core: once the mine is opened, its headframe (Förderturm) stands behind the excavation site.
      if (v.underground && window.MineArt) {
        const hr = window.MineArt.headframe(ctx, mx + mineDir() * (L.headframe ?? 1.9) * k, groundAt(mx + mineDir() * (L.headframe ?? 1.9) * k), k * 0.85, window.MineArt.elevatorStage(v.underground.level), time, v.underground.running);
        addHit(hr, 'mine-entrance', 0);
        // Living Worlds 2.0: the headframe names where it leads (the same tower stands on top of the mine view)
        const hx = mx + mineDir() * (L.headframe ?? 1.9) * k;
        CA.plaque(ctx, hx, groundAt(hx) + 0.36 * k, k, 'Förderturm ⇣ Mine', '#8fe3ff');
      }
      const mr = CA.mine(ctx, mx, my, k, { ...common, level: b[0], active: auto.mine && flow.mining, pileRatio: v.pileRatio, pileFull: (v.pileRatio || 0) >= 0.95, rock: L.sky.snow ? '#a7c8e6' : '#8a86c8', flip: mineDir() < 0 });
      addHit(mr, 'building', 0);
      addHit({ x0: mx - 1.3 * k, y0: my - 1.6 * k, x1: mx + 1.3 * k, y1: my + 0.1 * k }, 'deposit', 0);
    }
    function drawTransport(ctx, theme) {
      const level = view.industry?.rail || 0;
      if (!level) return;
      const x0 = trackStart(),
        x1 = trackEnd();
      CA.track(ctx, x0, x1, groundAt, k, level);
      if (hasPlot('rail')) {
        const sx = plotX('rail'),
          r = CA.loadingStation(ctx, sx, groundAt(sx), k, { level, time, active: view.auto?.rail && view.flow?.moving });
        addHit(r, 'building', 'rail');
      }
      carts.forEach((c, i) => {
        const cx = math.lerp(x0, x1, c.pos),
          cy = groundAt(cx) - 0.14 * k,
          heading = (x1 > x0 ? 1 : -1) * c.dir;
        CA.vehicle(ctx, cx, cy, k, { level, loaded: c.loaded && c.dir > 0, dir: heading, time, accent: theme.accent });
        if (i === 0) addHit({ x0: cx - 0.9 * k, y0: cy - 1.1 * k, x1: cx + 0.9 * k, y1: cy + 0.2 * k }, 'cart', 'rail');
      });
    }
    function drawShip(ctx, s) {
      const padX = plotX('dock'),
        padY = groundAt(padX) - 0.4 * k,
        dir = padX > worldW / 2 ? 1 : -1;
      let x = padX,
        y = padY,
        loaded = false;
      if (s.t < 0.3) {
        const t = math.easeOutCubic(s.t / 0.3);
        x = padX + dir * (1 - t) * 4 * k;
        y = math.lerp(-k, padY, t);
      } else if (s.t < 0.55) loaded = (s.t - 0.3) / 0.25 > 0.5;
      else {
        const t = math.easeInOutSine((s.t - 0.55) / 0.45);
        x = padX + dir * t * 5 * k;
        y = math.lerp(padY, -1.5 * k, t);
        loaded = true;
      }
      ctx.save();
      ctx.globalAlpha = math.clamp((y + k) / (1.2 * k), 0, 1);
      ctx.translate(x, y);
      if (dir < 0) ctx.scale(-1, 1);
      ctx.scale(k * 1.15, k * 1.15);
      Art.drawPlayerShip(ctx, view.ship.model || 'Pioneer', view.ship, time, Art.SHIP_PALETTES[view.cosmeticShip] || Art.SHIP_PALETTES.default, Kit.ROSTER[view.pilot || 0], 'happy');
      if (loaded) {
        ctx.fillStyle = '#ffd77a';
        ctx.fillRect(-0.3, 0.32, 0.18, 0.12);
        ctx.fillRect(-0.08, 0.32, 0.18, 0.12);
      }
      ctx.restore();
    }
    // Interplanetary freighters: take off / land at the dock exactly along the saved route timeline.
    function drawRouteShips(ctx) {
      const list = view.routeShips || [];
      if (!list.length || !hasPlot('dock')) return;
      const padX = plotX('dock'),
        padY = groundAt(padX) - 0.45 * k;
      list.forEach((s, i) => {
        const side = i ? -1 : 1;
        let x = padX + side * 0.4 * k,
          y = padY;
        if (s.kind === 'depart') {
          const t = math.easeInOutSine(s.progress);
          x += side * t * 4 * k;
          y = math.lerp(padY, -1.5 * k, t);
        } else if (s.kind === 'arrive') {
          const t = math.easeOutCubic(s.progress);
          x += side * (1 - t) * 4 * k;
          y = math.lerp(-1.5 * k, padY, t);
        }
        ctx.save();
        ctx.globalAlpha = math.clamp((y + k) / (1.2 * k), 0, 1);
        ctx.translate(x, y);
        if (side < 0) ctx.scale(-1, 1);
        ctx.scale(k * 1.25, k * 1.25);
        Art.drawPlayerShip(ctx, view.ship.model || 'Pioneer', view.ship, time, Art.SHIP_PALETTES[view.cosmeticShip] || Art.SHIP_PALETTES.default, Kit.ROSTER[3], 'happy');
        // cargo containers in the material colour
        const color = { raw: '#c4b3ff', bars: '#ffd23a', frost: '#9fe8ff', cells: '#ffb35a' }[s.resource] || '#ffd77a';
        ctx.fillStyle = color;
        ctx.fillRect(-0.34, 0.3, 0.2, 0.14);
        ctx.fillRect(-0.1, 0.3, 0.2, 0.14);
        ctx.restore();
        if (s.kind === 'unload' && !reduced && Math.random() < 0.08)
          particles.spawn({ x: padX + side * 0.4 * k, y: padY + 0.3 * k, vx: (Math.random() - 0.5) * 30, vy: -20, life: 0.9, size: 3, color, kind: 'gem' });
      });
    }
    function drawStory(ctx) {
      if (view.capsule === 'available') {
        const x = plotX('hut') + 2 * k,
          y = groundAt(x) - 0.1 * k,
          bob = Math.sin(time * 3) * 0.06 * k;
        Art.glowCircle(ctx, x, y - 0.35 * k + bob, 0.7 * k, '#ffd77a', 0.6);
        ctx.fillStyle = '#fff4e2';
        ctx.beginPath();
        ctx.ellipse(x, y - 0.32 * k + bob, 0.36 * k, 0.3 * k, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#ff9ecb';
        ctx.fillRect(x - 0.36 * k, y - 0.36 * k + bob, 0.72 * k, 0.1 * k);
        Art.heart(ctx, x, y - 0.52 * k + bob, 0.13 * k, '#ff7aa8');
        addHit({ x0: x - 0.6 * k, y0: y - 1 * k, x1: x + 0.6 * k, y1: y + 0.2 * k }, 'capsule', 0);
      }
      if (view.pips === 'warned' || view.pips === 'battle') {
        const x = plotX('depot') + Math.sin(time * 0.6) * 3.5 * k,
          y = groundY - 3 * k + Math.sin(time * 2) * 0.15 * k;
        Art.drawMotteBot?.(ctx, x, y, k * 0.5, time, false);
      }
      if (view.frostbyte && hasPlot('thermal')) {
        const fx = plotX('thermal'),
          st = view.frostbyte;
        if (st === 'drones')
          for (let i = 0; i < 2; i++) {
            const x = fx + Math.sin(time * 0.5 + i * 2.5) * 4 * k,
              y = groundY - 3 * k + Math.sin(time * 2 + i) * 0.15 * k;
            Art.drawMotteBot?.(ctx, x, y, k * 0.42, time, false);
          }
        if (st === 'battle' || st === 'defeated') {
          const x = fx + 2.8 * k,
            y = groundAt(fx) - 2.4 * k + Math.sin(time * 1.5) * 0.1 * k;
          Art.drawFrostbyte?.(ctx, x, y, k * 0.75, time, { plates: st === 'battle' ? 3 : 0, dizzy: st === 'defeated' });
        }
        if (st === 'repaired') {
          // friendly Frostbyte hovers above the warm workshop and keeps an eye on the heat network
          const x = fx + 0.6 * k + Math.sin(time * 0.4) * 0.5 * k,
            y = groundAt(fx) - 2.9 * k + Math.sin(time * 2) * 0.08 * k;
          Art.drawFrostbyte?.(ctx, x, y, k * 0.62, time, { friendly: true });
          addHit({ x0: x - 0.7 * k, y0: y - 0.8 * k, x1: x + 0.7 * k, y1: y + 0.8 * k }, 'building', 'thermal');
        }
      }
      if (view.pips === 'repaired') {
        // the friendly inspector hovers over the helpers' quarters (no longer in front of the headframe and the vein)
        const px = hasPlot('hut') ? plotX('hut') : plotX('mine') + 3.6 * k,
          x = px + Math.sin(time * 0.4) * 0.7 * k,
          y = groundAt(px) - 3.1 * k + Math.sin(time * 2) * 0.08 * k;
        Art.drawMotteBot?.(ctx, x, y, k * 0.5, time, true, { variant: 'pips' });
        addHit({ x0: x - 0.6 * k, y0: y - 0.6 * k, x1: x + 0.6 * k, y1: y + 0.6 * k }, 'pips', 0);
      }
    }
    // Beta 1.3: where a helper stands at the vein. With hand tools (Kristallmine < Lv 5) the pickaxe tip at the impact
    // pose — Kit.toolTip, all kitten transforms included — lands on the outcrop's flank (CA.mine: left flank (−1.2,0)→
    // (−0.9,0.7), right flank (1.1,0)→(0.6,0.75) in k, mirrored with mineDir). From Lv 5 a machine drills; the helpers
    // inspect beside it instead of swinging. Returns the offset from plotX('mine') in k (before mineDir) and the facing.
    function mineSlot(i) {
      if (i === 1) return { at: MINE_SLOTS[1], facing: -1, pose: 'carry' };
      const hand = (view?.buildings?.[0] || 1) < 5;
      if (!hand) return i === 0 ? { at: -1.75, facing: 1, pose: 'check' } : { at: 1.6, facing: -1, pose: 'check' };
      const tip = Kit.toolTip('mine', { phase: 'impact' }),
        reach = tip[0] * HELPER_SIZE,
        h = -tip[1] * HELPER_SIZE - 0.05; // contact height above the ground (k)
      return i === 0 ? { at: -1.2 + 0.3 * (h / 0.7) - reach, facing: 1, pose: 'mine', contact: -1.2 + 0.3 * (h / 0.7) } : { at: 1.1 - 0.5 * (h / 0.75) + reach, facing: -1, pose: 'mine', contact: 1.1 - 0.5 * (h / 0.75) };
    }
    function mochiMineSpot() {
      const tip = Kit.toolTip('mine', { phase: 'impact' }),
        reach = tip[0] * 1.08,
        h = -tip[1] * 1.08 - 0.08;
      const left = { at: -1.2 + 0.3 * (h / 0.7) - reach, facing: 1 },
        right = { at: 1.1 - 0.5 * (h / 0.75) + reach, facing: -1 };
      const leftBusy = helpers[0]?.working,
        rightBusy = helpers[2]?.working;
      let spot = L.mochi.offset * mineDir() < 0 ? left : right;
      if (spot === left && leftBusy) spot = rightBusy ? null : right;
      else if (spot === right && rightBusy) spot = leftBusy ? null : left;
      return spot;
    }
    function mineSlotOf(i) {
      return mineSlot(i);
    }
    function helperTime(seed) {
      if (!reduced) return time;
      const [a, b] = Kit.MINE_IMPACT;
      return ((a + b) / 2) * Kit.MINE_CYCLE - seed * 0.237 + 100 * Kit.MINE_CYCLE; // reduced motion: resting on the rock
    }
    const helperImpact = new Map();
    let frozenTime = null; // review tool only (capture-mining-proof): reproducible frames
    // All kittens sorted into two depth lanes (back: resting/residents, front: workers/managers/Mochi).
    function drawKittens(ctx) {
      const back = [],
        front = [];
      residents.forEach(r => back.push({ x: r.x, draw: () => {
        kitten(ctx, r.look, r.x, groundAt(r.x) - 0.12 * k, k * 0.78, { pose: cheer > 0 ? 'cheer' : view.heated === false ? 'worried' : r.chat > 0 ? 'wave' : 'idle', t: time, seed: r.seed, facing: r.facing });
        if (r.chat > 1) {
          const by = groundAt(r.x) - 1.25 * k;
          CA.fillRR(ctx, r.x - 0.25 * k, by - 0.28 * k, 0.5 * k, 0.3 * k, 0.12 * k, 'rgba(255,255,255,0.9)');
          ctx.fillStyle = '#ff7aa8';
          ctx.font = `900 ${Math.round(0.22 * k)}px Nunito, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(r.seed % 2 ? '♥' : '…', r.x, by - 0.06 * k);
          ctx.textAlign = 'left';
        }
      } }));
      helpers.forEach((hp, i) => {
        const slot = hp.working ? mineSlotOf(i) : null;
        const pose = cheer > 0 ? 'cheer' : slot ? slot.pose : hp.walking ? 'walk' : view.auto && !view.auto.mine ? 'sleep' : 'idle';
        const facing = slot ? slot.facing * mineDir() : hp.dir;
        if (slot?.pose === 'mine' && !reduced && quality !== 'low') {
          // chips leave the rock exactly where the blade lands, once per swing
          const hit = Kit.mineImpact(time, hp.seed),
            key = 'h' + i;
          if (hit && !helperImpact.get(key)) {
            const cx = plotX('mine') + slot.contact * k * mineDir(),
              cy = groundAt(hp.x) + 0.05 * k + Kit.toolTip('mine', { phase: 'impact' })[1] * HELPER_SIZE * k;
            for (let n = 0; n < 3; n++) particles.spawn({ x: cx, y: cy, vx: -facing * (40 + Math.random() * 60), vy: -50 - Math.random() * 50, ay: 240, life: 0.5, size: 2 + Math.random() * 1.5, color: n % 2 ? '#e8e2ff' : (view.theme?.accent || '#c4a3ff'), kind: 'gem' });
          }
          helperImpact.set(key, hit);
        }
        (hp.resting ? back : front).push({ x: hp.x, draw: () => kitten(ctx, hp.look, hp.x, groundAt(hp.x) + (hp.resting ? -0.12 * k : 0.05 * k), k * (hp.resting ? 0.75 : HELPER_SIZE), { pose, t: slot?.pose === 'mine' ? helperTime(hp.seed) : time, seed: hp.seed, facing, tool: i === 1 ? 'crystal' : 'drill' }) });
      });
      const duty = view.managers || {},
        flow = view.flow || {};
      staffSprites.forEach((sprite, workplace) => {
        const m = duty[workplace];
        if (!m || !m.look) return;
        front.push({ x: sprite.x, draw: () => {
          const look = Kit.managerLook(m.look, m.outfit, m.rank || 1),
            target = stationX(workplace),
            walking = Math.abs(sprite.x - target) > 2,
            busy = { mine: flow.mining, rail: flow.moving, depot: flow.feeding, refinery: flow.refining, stall: flow.selling, dock: flow.selling, frostDrill: flow.frost, thermal: flow.thermal, foundry: flow.smelting, workshop: flow.assembling, sporeGarden: flow.sporing, biolab: flow.brewing }[workplace],
            pose = walking ? 'walk' : sprite.greet > 0 ? 'wave' : busy ? MANAGER_POSE[m.job] : 'idle';
          kitten(ctx, look, sprite.x, groundAt(sprite.x) + 0.05 * k, k * 0.9, { pose, t: time, seed: workplace.length + 5, facing: walking ? Math.sign(target - sprite.x) : stationFacing(workplace) });
          if (m.kind === 'special') {
            const sy = groundAt(sprite.x) - 1.15 * k;
            ctx.fillStyle = '#ffd77a';
            ctx.font = `900 ${Math.max(9, Math.round(0.22 * k))}px Nunito, sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText('★ ' + m.name, sprite.x, sy);
            ctx.textAlign = 'left';
          }
          hits.push({ x0: sprite.x - 0.4 * k, y0: groundAt(sprite.x) - 1.1 * k, x1: sprite.x + 0.4 * k, y1: groundAt(sprite.x) + 0.1 * k, type: 'building', key: m.sheet });
        } });
      });
      if (!duty.dock && view.buildings[3] > 0 && hasPlot('dock')) {
        const px = plotX('dock') + 1.1 * k;
        front.push({ x: px, draw: () => kitten(ctx, Kit.ROSTER[3], px, groundAt(px) + 0.05 * k, k * 0.85, { pose: view.auto?.dock && view.flow?.selling ? 'wave' : 'idle', t: time, seed: 3 }) });
      }
      const mochiPose = mochi.target !== null ? 'walk' : mochi.actionTime > 0 ? mochi.action : cheer > 0 ? 'cheer' : mochi.idleTime > 25 ? 'sleep' : 'idle';
      // Void (Mochi's best friend) keeps a little behind Mochi, curious; tail flicks while waiting
      if (view.voidMet && Kit.VOID) {
        const vx = mochi.x - mochi.facing * 1.05 * k,
          vPose = mochi.target !== null ? 'walk' : cheer > 0 ? 'cheer' : mochiPose === 'sleep' ? 'sleep' : Math.sin(time * 0.35) > 0.75 ? 'check' : 'idle';
        front.push({ x: vx - 0.01, draw: () => {
          kitten(ctx, Kit.VOID, vx, groundAt(vx) + 0.1 * k, k * 0.92, { pose: vPose, t: time, seed: 17, facing: mochi.facing });
          hits.push({ x0: vx - 0.45 * k, y0: groundAt(vx) - 1.1 * k, x1: vx + 0.45 * k, y1: groundAt(vx) + 0.1 * k, type: 'guardian', key: 'void' });
        } });
      }
      front.push({ x: mochi.x, draw: () => {
        const look = Kit.withAccessories(Kit.ROSTER[0], view.mochiAccessories);
        // at the rock she faces the flank she strikes (reduced motion: resting on the rock in the contact pose)
        const mochiFacing = mochiPose === 'mine' && mochi.spot ? mochi.spot.facing * mineDir() : mochi.facing;
        kitten(ctx, look, mochi.x, groundAt(mochi.x) + 0.08 * k, k * 1.08, { pose: mochiPose, t: mochiPose === 'mine' ? (reduced ? helperTime(1) : Kit.MINE_CYCLE - mochi.actionTime - 0.237 + 10 * Kit.MINE_CYCLE) : time, seed: 1, facing: mochiFacing, tool: 'drill' });
        hits.push({ x0: mochi.x - 0.5 * k, y0: groundAt(mochi.x) - 1.2 * k, x1: mochi.x + 0.5 * k, y1: groundAt(mochi.x) + 0.1 * k, type: 'mochi', key: 0 });
      } });
      back.sort((a, b) => a.x - b.x).forEach(e => e.draw());
      front.sort((a, b) => a.x - b.x).forEach(e => e.draw());
    }
    function drawForeground(ctx, height, theme) {
      ctx.save();
      ctx.translate(-cam.x * 0.2, 0);
      const frnd = math.seeded(math.hash('fg' + planetId));
      for (let i = 0; i < 14; i++) {
        const x = frnd() * (worldW * 1.2 + w),
          y = groundY + 1.1 * k + frnd() * Math.max(4, height - groundY - 1.1 * k),
          sc = (0.4 + frnd() * 0.5) * k;
        if (i % 3 === 0) {
          ctx.globalAlpha = 0.75;
          if (L.decor.kind === 'machine' && window.MekhanosArt) window.MekhanosArt.prop(ctx, x, y, sc, time, i + 40);
          else if (L.decor.kind === 'verdant' && window.ViridiaArt) window.ViridiaArt.prop(ctx, x, y, sc, time, i + 40, Boolean(view.viridia?.bloom));
          else CA.prop(ctx, L.decor.kind, x, y, sc, time, i + 40, theme);
          ctx.globalAlpha = 1;
        } else {
          ctx.fillStyle = theme.surface[0][1];
          ctx.globalAlpha = 0.5;
          ctx.beginPath();
          ctx.ellipse(x, y, 0.3 * sc, 0.17 * sc, 0, 0, TAU);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
      ctx.restore();
    }
    // Pyra atmosphere: before Emberbell's recalibration rising embers and a red heat haze; afterwards calm golden
    // light, a few sparks and Emberbell himself floating by the Glutschmelze (tap: he talks).
    function drawPyra(ctx, width, height) {
      if (planetId !== 'volcanic' || !L.sky.embers) return;
      const calm = Boolean(view.pyra?.calm),
        n = reduced ? 0 : calm ? 6 : quality === 'low' ? 8 : 18;
      for (let i = 0; i < n; i++) {
        const span = 3.4 * k,
          x = cam.x + ((i * 97.3 + time * (calm ? 6 : 14)) % (width + 40)) - 20,
          rise = (time * (calm ? 10 : 22) + i * 53) % span,
          y = groundY - rise,
          a = 1 - rise / span;
        CA.glow(ctx, x + Math.sin(time * 2 + i) * 6, y, (calm ? 0.05 : 0.07) * k, calm ? '#ffd25a' : '#ff8a3a', a * 0.9);
      }
      const poles = L.poles || [];
      if (!calm) {
        // red warning beacons on every pole and heat shimmer over the ground
        poles.forEach((p, i) => CA.glow(ctx, p * k, groundAt(p * k) - 2.05 * k, 0.16 * k, Math.sin(time * 4 + i) > 0 ? '#ff4a3a' : '#7a2a2a', 0.95));
        if (!reduced) {
          ctx.strokeStyle = 'rgba(255,180,140,0.18)';
          ctx.lineWidth = 0.04 * k;
          for (let r = 0; r < 4; r++) {
            const yy = groundY - (0.6 + r * 0.7) * k;
            ctx.beginPath();
            for (let x = cam.x; x <= cam.x + width; x += 14) ctx[x === cam.x ? 'moveTo' : 'lineTo'](x, yy + Math.sin(x * 0.04 + time * 3 + r) * 0.06 * k);
            ctx.stroke();
          }
        }
      } else {
        // festive lanterns along the power lines: the colony is safe again
        for (let i = 1; i < poles.length; i++) {
          const x0 = poles[i - 1] * k,
            x1 = poles[i] * k,
            y0 = groundAt(x0) - 1.8 * k,
            y1 = groundAt(x1) - 1.8 * k,
            cy = Math.max(y0, y1) + 0.35 * k;
          for (let j = 1; j < 6; j++) {
            const u = j / 6,
              lx = (1 - u) * (1 - u) * x0 + 2 * u * (1 - u) * ((x0 + x1) / 2) + u * u * x1,
              ly = (1 - u) * (1 - u) * y0 + 2 * u * (1 - u) * cy + u * u * y1;
            CA.glow(ctx, lx, ly + 0.12 * k, 0.11 * k, j % 2 ? '#ffd25a' : '#7fe8f0', 0.85 + Math.sin(time * 2 + j + i) * 0.1);
          }
        }
      }
      if (!calm) {
        const g = ctx.createLinearGradient(0, 0, 0, height);
        g.addColorStop(0, 'rgba(255,70,40,0.22)');
        g.addColorStop(0.5, 'rgba(255,90,40,0.05)');
        g.addColorStop(1, 'rgba(255,60,30,0.10)');
        ctx.fillStyle = g;
        ctx.fillRect(cam.x, 0, width, height);
      } else {
        const g = ctx.createLinearGradient(0, 0, 0, height);
        g.addColorStop(0, 'rgba(255,220,150,0.10)');
        g.addColorStop(1, 'rgba(127,232,240,0.04)');
        ctx.fillStyle = g;
        ctx.fillRect(cam.x, 0, width, height);
        if (hasPlot('foundry') && window.PyraArt) {
          const ex = plotX('foundry') + 0.6 * k,
            ey = groundAt(ex) - 2.55 * k;
          window.PyraArt.drawEmberbell(ctx, ex, ey, 0.42 * k, time, { friendly: true, pressure: 0.3 });
          hits.push({ x0: ex - 0.6 * k, y0: ey - 0.7 * k, x1: ex + 0.6 * k, y1: ey + 0.6 * k, type: 'guardian', key: 'emberbell' });
        }
      }
    }
    // Mekhanos atmosphere from Cogsworth's saved stage: before the repair red "Freigabe verweigert" lamps on every
    // pole, permit boards with a red ✕ on the gear towers and a cool, dim light; afterwards teal approval lamps, a
    // glowing energy conduit along the walkway, warm factory light and Cogsworth himself stamping permits by the
    // Präzisionswerkstatt (tap: he talks).
    function drawMekhanos(ctx, width, height) {
      if (planetId !== 'machine' || !view.mekhanos) return;
      const freed = Boolean(view.mekhanos.freed),
        poles = L.poles || [];
      poles.forEach((p, i) => {
        const x = p * k,
          y = groundAt(x) - 2.05 * k,
          on = reduced || Math.sin(time * 2 + i) > -0.3;
        CA.glow(ctx, x, y, 0.15 * k, freed ? '#5fe0d0' : on ? '#ff5a4a' : '#6a2a2a', 0.95);
      });
      for (const lm of L.landmarks || []) {
        if (lm.kind !== 'gearTower') continue;
        const x = lm.x * k,
          y = groundAt(x) - 1.15 * k;
        CA.fillRR(ctx, x - 0.55 * k, y - 0.3 * k, 1.1 * k, 0.5 * k, 0.08 * k, freed ? '#1f4a4a' : '#3a1e2a');
        ctx.strokeStyle = freed ? '#9ff0e4' : '#ff8f8f';
        ctx.lineWidth = 0.07 * k;
        ctx.lineCap = 'round';
        ctx.beginPath();
        if (freed) {
          ctx.moveTo(x - 0.16 * k, y - 0.05 * k);
          ctx.lineTo(x - 0.03 * k, y + 0.08 * k);
          ctx.lineTo(x + 0.2 * k, y - 0.16 * k);
        } else {
          ctx.moveTo(x - 0.14 * k, y - 0.16 * k);
          ctx.lineTo(x + 0.14 * k, y + 0.1 * k);
          ctx.moveTo(x + 0.14 * k, y - 0.16 * k);
          ctx.lineTo(x - 0.14 * k, y + 0.1 * k);
        }
        ctx.stroke();
      }
      if (freed) {
        // energy conduit along the walkway: teal pulses travel toward the mine
        const [from, to] = (L.paths && L.paths[0]) || [6, 45];
        ctx.strokeStyle = 'rgba(95,224,208,0.55)';
        ctx.lineWidth = 0.06 * k;
        ctx.beginPath();
        for (let xk = from; xk <= to; xk += 0.5) ctx[xk === from ? 'moveTo' : 'lineTo'](xk * k, groundAt(xk * k) + 0.88 * k);
        ctx.stroke();
        if (!reduced) for (let i = 0; i < 6; i++) {
          const xk = from + (((time * 2.2 + i * ((to - from) / 6)) % (to - from)) + (to - from)) % (to - from);
          CA.glow(ctx, xk * k, groundAt(xk * k) + 0.88 * k, 0.12 * k, '#9ff0e4', 0.8);
        }
        const g = ctx.createLinearGradient(0, 0, 0, height);
        g.addColorStop(0, 'rgba(255,215,140,0.08)');
        g.addColorStop(1, 'rgba(95,224,208,0.05)');
        ctx.fillStyle = g;
        ctx.fillRect(cam.x, 0, width, height);
        if (hasPlot('workshop') && window.MekhanosArt) {
          const cx = plotX('workshop') - 1.7 * k,
            gy = groundAt(cx),
            s = 0.42 * k,
            mood = !reduced && Math.sin(time * 0.6) > 0.55 ? 'stamp' : 'friendly';
          window.MekhanosArt.drawCogsworth(ctx, cx, gy - 1.28 * s, s, time, { mood, reduced, shieldAlpha: 0 });
          hits.push({ x0: cx - 0.7 * k, y0: gy - 1.6 * k, x1: cx + 0.7 * k, y1: gy, type: 'guardian', key: 'cogsworth' });
        }
      } else {
        // a hazard barrier closes the Präzisionswerkstatt's gate (production allowed, but "not approved")
        if (hasPlot('workshop')) {
          const wx = plotX('workshop'),
            wy = groundAt(wx);
          for (const px of [wx - 0.5 * k, wx + 0.55 * k]) CA.fillRR(ctx, px - 0.04 * k, wy - 0.5 * k, 0.08 * k, 0.5 * k, 0.03 * k, '#4a4058');
          ctx.save();
          ctx.beginPath();
          ctx.rect(wx - 0.62 * k, wy - 0.5 * k, 1.29 * k, 0.2 * k);
          ctx.clip();
          ctx.fillStyle = '#ffd25a';
          ctx.fillRect(wx - 0.62 * k, wy - 0.5 * k, 1.29 * k, 0.2 * k);
          ctx.fillStyle = '#2c2236';
          for (let i = -2; i < 8; i++) {
            ctx.beginPath();
            ctx.moveTo(wx - 0.62 * k + i * 0.22 * k, wy - 0.3 * k);
            ctx.lineTo(wx - 0.62 * k + i * 0.22 * k + 0.11 * k, wy - 0.3 * k);
            ctx.lineTo(wx - 0.62 * k + i * 0.22 * k + 0.31 * k, wy - 0.5 * k);
            ctx.lineTo(wx - 0.62 * k + i * 0.22 * k + 0.2 * k, wy - 0.5 * k);
            ctx.fill();
          }
          ctx.restore();
          CA.glow(ctx, wx + 0.55 * k, wy - 0.62 * k, 0.11 * k, reduced || Math.sin(time * 3) > 0 ? '#ff5a4a' : '#6a2a2a', 0.95);
        }
        const g = ctx.createLinearGradient(0, 0, 0, height);
        g.addColorStop(0, 'rgba(20,30,60,0.22)');
        g.addColorStop(1, 'rgba(255,80,80,0.05)');
        ctx.fillStyle = g;
        ctx.fillRect(cam.x, 0, width, height);
      }
    }
    // Viridia atmosphere from Petalguard's saved stage: before the healing a grey Welke haze, thorn vines and drooping
    // pole lanterns; afterwards blossom lanterns, warm pollen light and Petalguard by the Wurzelknoten (tap: she talks).
    function drawViridia(ctx, width, height) {
      if (planetId !== 'verdant' || !view.viridia || !window.ViridiaArt) return;
      const VA = window.ViridiaArt,
        bloom = Boolean(view.viridia.bloom),
        poles = L.poles || [];
      poles.forEach((p, i) => {
        const x = p * k,
          y = groundAt(x) - 2.05 * k;
        if (bloom) VA.blossom(ctx, x, y, 0.22 * k, 1, i % 2 ? VA.PALETTE.petal : VA.PALETTE.petal2, VA.PALETTE.pollen, time);
        else A_glow(ctx, x, y, 0.12 * k, '#8a8478', 0.8);
      });
      if (bloom) {
        const g = ctx.createLinearGradient(0, 0, 0, height);
        g.addColorStop(0, 'rgba(255,230,160,0.07)');
        g.addColorStop(1, 'rgba(143,240,212,0.06)');
        ctx.fillStyle = g;
        ctx.fillRect(cam.x, 0, width, height);
        if (L.rootNode) {
          const px = L.rootNode * k - 2.0 * k,
            gy = groundAt(px),
            s = 0.5 * k;
          VA.drawPetalguard(ctx, px, gy - 1.25 * s, s, time, { mood: 'friendly', petals: 6, reduced });
          hits.push({ x0: px - 0.8 * k, y0: gy - 2.0 * k, x1: px + 0.8 * k, y1: gy, type: 'guardian', key: 'petalguard' });
        }
      } else {
        // the Welke: thorn vines at the path and a grey veil
        for (const xk of [17.2, 34.6, 45.2]) if (xk < L.width) VA.thornVine(ctx, xk * k, groundAt(xk * k), k * 0.8, time, xk);
        const g = ctx.createLinearGradient(0, 0, 0, height);
        g.addColorStop(0, 'rgba(60,60,60,0.16)');
        g.addColorStop(1, 'rgba(138,132,120,0.08)');
        ctx.fillStyle = g;
        ctx.fillRect(cam.x, 0, width, height);
      }
    }
    function A_glow(ctx, x, y, r, c, a) {
      CA.glow(ctx, x, y, r, c, a);
    }
    function draw(ctx, width, height) {
      if (!view) return;
      hits.length = 0;
      const theme = Art.THEMES[planetId] || Art.THEMES.crystal;
      drawBackground(ctx, width, height, theme);
      ctx.save();
      ctx.translate(-Math.round(cam.x), 0);
      drawGround(ctx, height, theme);
      drawDistricts(ctx);
      drawDecor(ctx, theme);
      drawCables(ctx);
      // the cart line runs behind the buildings (plaques and kittens stay readable in front)
      drawTransport(ctx, theme);
      // Living Worlds 2.0: plain building labels only in the central 70 % of the view (warnings always show)
      CA.setLabelGate?.(x => Math.abs(x - (cam.x + w / 2)) <= w * 0.35);
      drawBuildings(ctx, theme);
      CA.setLabelGate?.(null);
      if (view.cosmeticColony === 'deco-lanterns') drawLanterns(ctx);
      ships.forEach(s => drawShip(ctx, s));
      drawRouteShips(ctx);
      drawStory(ctx);
      drawKittens(ctx);
      drawPyra(ctx, width, height);
      drawMekhanos(ctx, width, height);
      drawViridia(ctx, width, height);
      particles.forEach(p => {
        ctx.globalAlpha = Math.min(1, (1 - p.age / p.life) * 1.5);
        ctx.fillStyle = p.color;
        if (p.kind === 'gem') {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y - p.size * 1.3);
          ctx.lineTo(p.x + p.size, p.y);
          ctx.lineTo(p.x, p.y + p.size * 1.1);
          ctx.lineTo(p.x - p.size, p.y);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (p.kind === 'snow' ? 1 : 1 + p.age), 0, TAU);
          ctx.fill();
        }
      });
      ctx.globalAlpha = 1;
      drawForeground(ctx, height, theme);
      ctx.textAlign = 'center';
      for (const f of floaters) {
        const t = f.age / f.life;
        ctx.globalAlpha = t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25;
        ctx.font = `900 ${f.critical || f.milestone ? 18 : 15}px Nunito, sans-serif`;
        const y = f.y - math.easeOutCubic(Math.min(1, t * 1.4)) * 30,
          text = f.label || (f.critical ? 'SUPER +' : '+') + window.NebulaFormat(f.value) + (f.unit === 'credits' ? ' ◈' : f.unit === 'material' ? ' ◆' : '');
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(30,24,70,0.85)';
        ctx.strokeText(text, f.x, y);
        ctx.fillStyle = f.unit === 'level' ? (f.milestone ? '#ffd77a' : '#8ff0d4') : f.critical || f.unit === 'credits' ? '#ffd77a' : '#ffffff';
        ctx.fillText(text, f.x, y);
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
      ctx.restore();
      if (flash > 0) {
        ctx.fillStyle = `rgba(255,245,255,${flash * 0.6})`;
        ctx.fillRect(0, 0, width, height);
      }
    }

    layout();
    return {
      attach,
      focusOn,
      focusMochi,
      // Living Worlds 2.0: the districts of this world and a jump to one (its centre)
      districts: () => (L.districts || []).map(d => ({ id: d.id, name: d.name, icon: d.icon, active: districtAt(cam.target + w / 2)?.id === d.id })),
      focusDistrict(id) {
        const d = (L.districts || []).find(x => x.id === id);
        if (!d) return false;
        focusOn(((d.from + d.to) / 2) * k);
        return true;
      },
      // review/QA: freeze the clock; helper contact points (world x → canvas x = x − cam.x)
      debugFreeze(t) {
        frozenTime = typeof t === 'number' ? t : null;
        if (frozenTime !== null) {
          time = frozenTime;
          particles.clear();
        }
      },
      debugHelpers() {
        return helpers.map((hp, i) => {
          const slot = hp.working ? mineSlotOf(i) : null,
            tip = slot?.pose === 'mine' ? Kit.toolTip('mine', { t: helperTime(hp.seed), seed: hp.seed, facing: slot.facing * mineDir() }) : null,
            gy = groundAt(hp.x) + 0.05 * k;
          return {
            i,
            working: hp.working,
            pose: slot?.pose || null,
            seed: hp.seed,
            x: hp.x - cam.x,
            contact: slot?.contact !== undefined ? [plotX('mine') + slot.contact * k * mineDir() - cam.x, gy + Kit.toolTip('mine', { phase: 'impact' })[1] * HELPER_SIZE * k] : null,
            tip: tip ? [hp.x + tip[0] * HELPER_SIZE * k - cam.x, gy + tip[1] * HELPER_SIZE * k] : null
          };
        });
      },
      resize(width, height) {
        if (Math.abs(width - w) < 1 && Math.abs(height - h) < 1) return;
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
        floaters.length = 0;
      },
      destroy() {
        off.forEach(fn => fn());
      },
      setZoom,
      get zoom() {
        return zoom;
      },
      // Test hooks
      tapWorld: handleTap,
      hitAreas: () => hits.map(r => ({ ...r })),
      worldToScreen: x => x - cam.x,
      plotX,
      groundAt,
      get camera() {
        return { x: cam.x, worldW, viewW: w };
      },
      debug: () => ({ carts: carts.map(c => ({ pos: c.pos, loaded: c.loaded })), staff: [...staffSprites.keys()], particles: particles.active, floaters: floaters.length, helpers: helpers.length, ships: ships.length, mochiX: Math.round(mochi.x), camX: Math.round(cam.x), hits: hits.length, k: Math.round(k), planet: planetId, ...stats })
    };
  }

  window.NebulaScenes = window.NebulaScenes || {};
  window.NebulaScenes.createColonyScene = createColonyScene;
})();
