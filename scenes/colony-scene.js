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
  const PLOT_KEY = { mine: 0, hut: 1, depot: 2, dock: 3, rail: 'rail', refinery: 'refinery', stall: 'stall', frostDrill: 'frostDrill', thermal: 'thermal', foundry: 'foundry', workshop: 'workshop', sporeGarden: 'sporeGarden', biolab: 'biolab', resinDrill: 'resinDrill' };
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
    thermal: ['thermal', 1.8, -1],
    resinDrill: ['resinDrill', -2.3, 1]
  };
  const MANAGER_POSE = { mining: 'check', transport: 'signal', storage: 'check', production: 'operate', logistics: 'check', trade: 'stamp' };
  // Helper miners: up to three work at the vein; the rest rest at the huts (never stacked on one spot).
  const MINE_SLOTS = [-1.6, 3.15, 1.5]; // left flank of the vein, at the pile (loading the cart), right flank (Beta 1.3: computed below)
  const HELPER_SIZE = 0.82; // front-lane helper scale (k)
  const ZOOM_OVERVIEW = 0.62; // Beta 1.6: the overview camera (Übersicht) relative to the detail view
  // Beta 1.8 A1: the camera's fling. The finger's speed over its last FLING_WINDOW ms (not one move event, which made
  // the old fling frame-rate dependent and short) carries the camera on and slows down with FLING_FRICTION per second
  // (distance ≈ speed / friction). A slow release does not fling.
  const FLING_WINDOW = 100,
    FLING_FRICTION = 3.2,
    FLING_MIN = 220,
    FLING_MAX = 5200;
  // the camera's place per planet, kept across screen changes and reloads (the session, in world kitten units)
  const CAM_KEY = 'sk-colony-cam';
  function camMemory() {
    try {
      return JSON.parse(sessionStorage.getItem(CAM_KEY) || '{}') || {};
    } catch {
      return {};
    }
  }
  function camRemember(planet, centreK) {
    try {
      const m = camMemory();
      m[planet] = Math.round(centreK * 100) / 100;
      sessionStorage.setItem(CAM_KEY, JSON.stringify(m));
    } catch {}
  }
  // resting helpers stand in one row in front of their quarters, a full body width apart (never stacked)
  // P1.2: …not in a row any more: each rest spot has its own pause – one sits on a crate, two chat face to face, one
  // sits in the grass looking at the sky, one tinkers at a toolbox, one dozes – at irregular distances and depths
  const REST_SPOTS = [
    { at: -2.35, dy: -0.16, act: 'crate', face: 1 },
    { at: -1.2, dy: -0.08, act: 'chat', face: 1 },
    { at: -0.42, dy: -0.13, act: 'chat', face: -1 },
    { at: 1.05, dy: -0.19, act: 'gaze', face: -1 },
    { at: 2.3, dy: -0.1, act: 'tinker', face: -1 },
    { at: 3.45, dy: -0.15, act: 'nap', face: 1 }
  ];
  const REST_SLOTS = REST_SPOTS.map(r => r.at);

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
    const cam = { x: 0, target: 0, vel: 0, fling: 0, saved: 0 };
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
    // P1.2: the mini inspector – a tapped worker waves and shows its name tag for a moment (presentation only)
    const inspect = { id: null, until: 0, card: null, x: 0, y: 0, seen: false };
    const workerHits = [];
    function workerHit(id, x, top, card) {
      // the kitten's own body (head to feet, its width): a worker standing in front of its building is tapped itself;
      // the building answers everywhere else
      workerHits.push({ x0: x - 0.3 * k, y0: top + 0.05 * k, x1: x + 0.3 * k, y1: top + 1.05 * k, type: 'worker', key: id, card });
      if (inspect.id === id) {
        inspect.x = x;
        inspect.y = top;
        inspect.seen = true;
      }
    }
    const inspected = id => inspect.id === id && time < inspect.until;
    const greeting = id => inspected(id) && inspect.until - time > 2.6;

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
    const mochiHome = () => {
      let x = helpers?.[0]?.working && L.mochi.plot === 'mine' ? plotX('mine') + 2.3 * k * mineDir() : plotX(L.mochi.plot) + L.mochi.offset * k;
      // P1: Mochi's waiting spot never sits on a working helper (a step aside instead of three kittens on one point)
      for (let n = 0; n < 3; n++) {
        const near = helpers?.find(hp => hp.working && Math.abs(hp.x - x) < 0.75 * k);
        if (!near) break;
        x = near.x + (x >= near.x ? 1 : -1) * 0.8 * k;
      }
      return x;
    };
    // The mine faces its cart line: on worlds where the track runs left, the whole mine site is mirrored.
    const mineDir = () => (L.track.fromOffset >= 0 ? 1 : -1);
    let sized = false; // Beta 1.7: the first real size starts at Mochi; later resizes keep the view's centre
    function layout() {
      // Phones: kitten size follows the stage height. Wide tablet stages show more of the colony (width-capped).
      // Living Worlds 2.0: phones show about six kitten widths instead of 4.7 — a whole building with its neighbours'
      // edges and the path between them, kittens still large (≈ 60 px on a 390 × 844 phone).
      // Beta 1.7: a tall phone world (the full-screen colony) gets slightly larger kittens and its ground line moves up,
      // so the extra height becomes foreground (paths, carts, kittens) instead of empty sky
      // Beta 1.8 A1: a tall phone shows about 6.4 kitten widths (was 5.2): a station and most of its neighbour, kittens
      // still ≥ 50 px on a 320-px phone; together with the compact layouts the colony is 7–8 screens instead of 12–13
      // P1.2 composition: the colony is the picture, not the sky. A tall phone shows 5.3 kitten widths (was 6.4: the
      // world read small, 60 % of the stage was sky) and its ground line sits at about 65 % of the stage (was 78 %), so
      // the deeper foreground carries paths, props and the scene bar; wide screens show 10.5–13.5 widths with kittens up
      // to 88 px and the ground at 79 %. The space left above is filled by the far colony layer (drawBackground), not by emptiness.
      // (a tablet held upright is tall too: 7.5 widths with the same deep foreground, not 60 % sky as before)
      const tall = h > w * 1.15,
        tablet = tall && w >= 560;
      // (wide: kittens up to 88 px – before, a cap of 66 px kept the desktop colony small under 57 % sky; a short landscape
      // stage keeps its larger share of the height)
      k = math.clamp(tablet ? Math.min(h * 0.14, w / 7.5) : w >= 560 ? Math.min(h * (h < 520 ? 0.15 : 0.12), w / 10.5) : Math.min(h * 0.165, w / 5.3), 32, tablet ? 96 : tall ? 78 : 88);
      // Beta 1.6: the overview shows about 1.6× as much of the colony (kittens stay ≥ 24 px)
      if (zoom === 'overview') k = Math.max(24, k * ZOOM_OVERVIEW);
      // (a short landscape stage keeps the plaques under the ground line clear of the scene bar: 56 px + 0.8 k)
      groundY = tall ? h - math.clamp(3.5 * k, h * 0.24, h * 0.36) : Math.min(h * 0.79, h - 56 - 0.8 * k);
      worldW = L.width * k;
      if (!mochi.x || mochi.x > worldW) mochi.x = mochiHome();
      // Beta 1.8: the first layout of a planet returns to where the player last looked (this session), else to Mochi
      // the start view centres the mine site (its pile and flank sit on the side away from the cart line), so the mine,
      // Mochi and the start of the cart line are all in view – before, a narrow phone could open next to the mine
      const kept = camMemory()[planetId],
        start = plotX('mine') + mineDir() * 0.6 * k;
      cam.x = cam.target = math.clamp(typeof kept === 'number' ? kept * k - w / 2 : start - w / 2, 0, Math.max(0, worldW - w));
      cam.fling = 0;
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
    // P1: Mochi reacts to discoveries (a find, a story discovery): big eyes first, then a happy hop with sparkles;
    // a new look makes Mochi cheer. Only while Mochi is free (no walk, no action running).
    const react = (action, seconds) => () => {
      if (!shown || mochi.target !== null || mochi.actionTime > 0) return;
      mochi.action = action;
      mochi.actionTime = seconds;
      mochi.idleTime = 0;
    };
    off.push(events.on('artifact', react('discover', 2.4)), events.on('discovery', react('discover', 2.4)), events.on('cosmetic-unlocked', react('cheer', 1.4)));
    off.push(
      events.on('harvest', event => {
        if (!shown) return;
        stats.harvestEvents++;
        // Beta 1.8 A3: a tap on ABBAUEN shows the mine if it is out of view (the dock's step leads the camera)
        if (!event.underground) ensureVisible(plotX('mine'));
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
        if (!event.helper && (event.planet === undefined || event.planet === view?.planetIndex)) ensureVisible(hasPlot('rail') ? plotX('rail') : trackStart());
      })
    );
    off.push(
      events.on('sale', event => {
        if (!shown || (event.planet !== undefined && view && event.planet !== view.planetIndex) || !(event.credits > 0)) return;
        stats.sales++;
        saleGlow = 1;
        const x = event.workplace === 'dock' ? plotX('dock') : plotX('stall');
        if (event.manual && !event.helper) ensureVisible(x);
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
        // Beta 1.7: in the full-screen phone world the page cannot scroll (touch-action: none), so any drag pans – a
        // sloppy diagonal thumb too; in the page layout only a mostly horizontal drag does (the page owns vertical)
        // a finger on a flinging world stops it (and that touch is no tap)
        const stopped = Math.abs(cam.fling) > 60;
        cam.fling = 0;
        cam.target = cam.x;
        pointer = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, camX: cam.x, dragging: false, moved: stopped, samples: [{ t: e.timeStamp || performance.now(), x: e.clientX }], free: getComputedStyle(canvas).touchAction === 'none' };
      });
      canvas.addEventListener('pointermove', e => {
        if (!pointer || e.pointerId !== pointer.id) return;
        const dx = e.clientX - pointer.x0;
        // a finger that wandered (any direction) is no tap any more
        if (Math.hypot(dx, e.clientY - pointer.y0) > TAP_SLOP * 1.5) pointer.moved = true;
        if (!pointer.dragging && Math.abs(dx) > TAP_SLOP && (pointer.free ? Math.hypot(dx, e.clientY - pointer.y0) > TAP_SLOP * 1.5 : Math.abs(dx) > Math.abs(e.clientY - pointer.y0))) {
          pointer.dragging = true;
          stats.drags++;
          canvas.setPointerCapture?.(e.pointerId);
        }
        if (pointer.dragging) {
          // direct: the world point under the finger stays under the finger
          pointer.x = e.clientX;
          const now = e.timeStamp || performance.now();
          pointer.samples.push({ t: now, x: e.clientX });
          while (pointer.samples.length > 2 && now - pointer.samples[0].t > FLING_WINDOW) pointer.samples.shift();
          cam.target = cam.x = math.clamp(pointer.camX - dx, 0, Math.max(0, worldW - w));
        }
      });
      const end = e => {
        if (!pointer || e.pointerId !== pointer.id) return;
        const wasDrag = pointer.dragging,
          moved = pointer.moved,
          samples = pointer.samples;
        pointer = null;
        if (wasDrag) {
          cam.fling = flingSpeed(samples, e.timeStamp || performance.now());
          cam.target = cam.x;
          return;
        }
        if (e.type === 'pointercancel' || moved) return;
        stats.taps++;
        handleTap(toWorld(e.clientX, e.clientY, canvas));
      };
      canvas.addEventListener('pointerup', end);
      canvas.addEventListener('pointercancel', end);
    }
    function handleTap(p) {
      mochi.idleTime = 0;
      // P1.2: a worker's body wins over a building or the deposit behind it; Mochi, guardians, carts and capsules win
      // over a worker
      const inside = r => p.x >= r.x0 && p.x <= r.x1 && p.y >= r.y0 && p.y <= r.y1,
        top = [...hits].reverse().find(inside),
        worker = (!top || top.type === 'building' || top.type === 'deposit') && [...workerHits].reverse().find(inside),
        hit = worker || top;
      if (hit) {
        if (hit.type === 'deposit') actions.mine?.();
        else if (hit.type === 'building') actions.openBuilding?.(hit.key);
        else if (hit.type === 'capsule') actions.openCapsule?.();
        else if (hit.type === 'mine-entrance') actions.enterMine?.();
        else if (hit.type === 'pips') actions.talk?.('pips');
        else if (hit.type === 'guardian') actions.talk?.(hit.key);
        else if (hit.type === 'worker') {
          const again = inspect.id === hit.key && time < inspect.until;
          Object.assign(inspect, { id: again ? null : hit.key, until: again ? 0 : time + 4, card: hit.card });
          stats.inspects = (stats.inspects || 0) + 1;
        }
        else if (hit.type === 'cart') view.auto?.rail ? actions.openBuilding?.('rail') : actions.sendCart?.();
        else if (hit.type === 'sell') actions.sell?.('stall');
        else if (hit.type === 'decor') actions.openLook?.(hit.key);
        else if (hit.type === 'mochi') {
          mochi.action = 'cheer';
          mochi.actionTime = 1.2;
        }
        return;
      }
      if (p.y > groundY - k * 2) mochi.target = math.clamp(p.x, k, worldW - k);
    }
    // the camera's speed (px/s, world direction) from the finger's last samples; 0 for a slow or held release
    function flingSpeed(samples, now) {
      const recent = samples.filter(p => now - p.t <= FLING_WINDOW * 1.5);
      if (recent.length < 2) return 0;
      const a = recent[0],
        b = recent[recent.length - 1],
        dt = (b.t - a.t) / 1000;
      // the finger rested before lifting: no fling
      if (dt <= 0 || now - b.t > 80) return 0;
      const v = -(b.x - a.x) / dt;
      return Math.abs(v) < FLING_MIN ? 0 : math.clamp(v, -FLING_MAX, FLING_MAX);
    }
    function focusOn(x) {
      cam.fling = 0;
      cam.target = math.clamp(x - w / 2, 0, Math.max(0, worldW - w));
    }
    // Beta 1.8 A3: glide to x only if it is outside the view's central 76 % (repeated taps at a visible station do not
    // move the camera; a finger on the world wins)
    function ensureVisible(x) {
      if (pointer || x === null || x === undefined || Number.isNaN(x)) return;
      if (x < cam.target + w * 0.12 || x > cam.target + w * 0.88) focusOn(x);
    }
    // Beta 1.8: glide to a station (its plot, or a workplace's station) so its work area fills the view
    function focusStation(key) {
      // the building itself (its plot); a workplace without a plot of its own: its station
      const name = KEY_PLOT[key] ?? key,
        x = hasPlot(name) ? plotX(name) : STATIONS[key] ? stationX(key) : null;
      if (x === null) return false;
      focusOn(x);
      return true;
    }
    function focusMochi() {
      focusOn(mochi.x);
    }

    // ----- Simulation of visuals -----
    function syncEntities() {
      const count = view.helperCount || 0;
      while (helpers.length < count) {
        const i = helpers.length;
        helpers.push({ x: plotX('hut') + (i - 1) * 0.9 * k, dir: 1, look: roleLook(Kit.WORKERS[i % Kit.WORKERS.length], 'miner'), seed: 30 + i, working: false });
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
    // the stretch of ground Mochi (and Void beside Mochi) occupy, with room for one kitten on each side
    function mochiRoom() {
      const vx = view?.voidMet ? mochi.x - mochi.facing * 1.05 * k : mochi.x;
      return [Math.min(mochi.x, vx) - 0.85 * k, Math.max(mochi.x, vx) + 0.85 * k];
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
      const maxCam = Math.max(0, worldW - w);
      if (cam.fling && !pointer?.dragging) {
        // the fling rolls out; the world's edge stops it
        cam.x += cam.fling * dt;
        cam.fling *= Math.exp(-FLING_FRICTION * dt);
        if (cam.x <= 0 || cam.x >= maxCam || Math.abs(cam.fling) < 25) cam.fling = 0;
        cam.target = cam.x = math.clamp(cam.x, 0, maxCam);
      } else if (!pointer?.dragging) cam.x = math.damp(cam.x, cam.target, 8, dt);
      cam.x = math.clamp(cam.x, 0, maxCam);
      // remember where the player looks (once the camera rests)
      if (!pointer && !cam.fling && Math.abs(cam.x - cam.target) < 1 && Math.abs(cam.x - cam.saved) > 2 && sized) {
        cam.saved = cam.x;
        camRemember(planetId, (cam.x + w / 2) / Math.max(1e-6, k));
      }
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
      // P1: a resting helper makes room for Mochi and Void (never three kittens on one spot at the hut)
      const occ = mochiRoom();
      helpers.forEach((hp, i) => {
        const loader = i === 1,
          mineSlot = working && i < MINE_SLOTS.length && (!loader || (view.auto?.rail && view.flow?.moving));
        let home = mineSlot ? plotX('mine') + mineSlotOf(i).at * k * mineDir() : plotX('hut') + REST_SLOTS[i % REST_SLOTS.length] * k;
        if (!mineSlot && home > occ[0] && home < occ[1]) home = home - occ[0] < occ[1] - home ? occ[0] - (i % 2) * 0.6 * k : occ[1] + (i % 2) * 0.6 * k;
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
      // P1: residents make room — inside the stretch where Mochi (and Void) stand, a resident steps to its nearer edge
      const room = mochiRoom();
      residents.forEach(r => {
        const target = r.x > room[0] && r.x < room[1] ? (r.x - room[0] < room[1] - r.x ? room[0] : room[1]) - r.x : 0;
        r.dxTarget = target;
        r.dx = (r.dx || 0) + (target - (r.dx || 0)) * Math.min(1, dt * (reduced ? 20 : 3));
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
      // P1.4 Living Worlds: now and then a gust (about 3 s in 14) carries the snow sideways – a little more of it
      const gust = L.sky.snow && Math.sin(time * 0.45) > 0.82;
      if (L.sky.snow && !reduced && quality !== 'low' && Math.random() < dt * (gust ? 9 : 6))
        particles.spawn({ x: cam.x + Math.random() * w - (gust ? w * 0.3 : 0), y: -4, vx: gust ? 46 : 6, vy: 18 + Math.random() * 10, life: (h / 22) * 1.1, size: 1.4 + Math.random() * 1.4, color: 'rgba(255,255,255,0.85)', kind: 'snow' });
      particles.update(dt);
      for (const f of floaters) f.age += dt;
      for (let i = floaters.length - 1; i >= 0; i--) if (floaters[i].age >= floaters[i].life) floaters.splice(i, 1);
    }

    // ----- Drawing -----
    function addHit(r, type, key) {
      if (r) hits.push({ x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1, type, key });
    }
    // Visual Identity round: every working kitten wears its job (Kit.roleLook: transport, miner, tech)
    const roleLook = (look, role, extra) => (Kit.roleLook ? Kit.roleLook(look, role, extra) : look);
    function kitten(ctx, look, x, y, size, opts) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(size, size);
      // P1: the rig picks its detail by the drawn size; reduced motion drops the secondary wobble
      opts.px = size;
      opts.calm = reduced || zoom === 'overview';
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
    // P1.2: the far colony on the haze range – outposts every few screens: a dome cluster, a mast, a landing tower;
    // flat silhouettes in the haze colour with a few warm windows (cached with the range)
    const farRidgeY = (x, fw) => groundY - 3.1 * k - Math.sin(x * 0.0032 + 5 + planetId.length) * 1.05 * k - Math.sin(x * 0.0032 * 2.7 + (5 + planetId.length) * 2) * 0.37 * k;
    let farSpotsMemo = { key: '', list: [] };
    const farSpots = fw => {
      const key = planetId + ':' + Math.round(fw) + ':' + w;
      if (farSpotsMemo.key === key) return farSpotsMemo.list;
      const rnd = math.seeded(math.hash('outposts' + planetId)),
        out = [];
      for (let x = (0.3 + rnd()) * w * 0.5; x < fw; x += (0.55 + rnd() * 0.5) * w) out.push({ x, kind: Math.floor(rnd() * 3), s: 0.75 + rnd() * 0.4 });
      farSpotsMemo = { key, list: out };
      return out;
    };
    function farOutposts(c, fw, theme) {
      const body = theme.surface[0][1] + 'c8',
        lit = theme.glow || '#ffe9a8';
      for (const o of farSpots(fw)) {
        const s = o.s * k,
          y = farRidgeY(o.x, fw) + 0.18 * k;
        c.fillStyle = body;
        if (o.kind === 0) {
          // a dome cluster with a connecting tube
          for (const [dx, r] of [[-0.55, 0.42], [0, 0.6], [0.6, 0.36]]) {
            c.beginPath();
            c.ellipse(o.x + dx * s, y, r * s, r * 0.82 * s, 0, Math.PI, 0);
            c.fill();
          }
          c.fillRect(o.x - 0.9 * s, y - 0.12 * s, 1.8 * s, 0.12 * s);
          for (const dx of [-0.15, 0.12, 0.62]) CA.fillRR(c, o.x + dx * s, y - 0.3 * s, 0.09 * s, 0.07 * s, 0.02 * s, lit);
        } else if (o.kind === 1) {
          // a relay mast with a dish
          c.fillRect(o.x - 0.05 * s, y - 1.7 * s, 0.1 * s, 1.7 * s);
          c.beginPath();
          c.moveTo(o.x - 0.35 * s, y);
          c.lineTo(o.x, y - 1.1 * s);
          c.lineTo(o.x + 0.35 * s, y);
          c.closePath();
          c.fill();
          c.beginPath();
          c.ellipse(o.x + 0.18 * s, y - 1.35 * s, 0.26 * s, 0.12 * s, -0.5, 0, TAU);
          c.fill();
        } else {
          // a landing tower with a pad and a hangar
          c.fillRect(o.x - 0.16 * s, y - 1.35 * s, 0.32 * s, 1.35 * s);
          c.fillRect(o.x - 0.42 * s, y - 1.5 * s, 0.84 * s, 0.18 * s);
          c.beginPath();
          c.ellipse(o.x + 0.95 * s, y, 0.55 * s, 0.38 * s, 0, Math.PI, 0);
          c.fill();
          for (let i = 0; i < 3; i++) CA.fillRR(c, o.x - 0.06 * s, y - (1.1 - i * 0.32) * s, 0.12 * s, 0.07 * s, 0.02 * s, lit);
        }
      }
    }
    // the outposts' beacons blink (live, a few dots): on the mast top, the tower roof
    function farBeacons(ctx, fw, theme) {
      const shift = -cam.x * 0.12;
      for (const [i, o] of farSpots(fw).entries()) {
        if (o.kind === 0) continue;
        const x = o.x + shift;
        if (x < -k || x > w + k) continue;
        const s = o.s * k,
          y = farRidgeY(o.x, fw) + 0.18 * k - (o.kind === 1 ? 1.75 : 1.58) * s,
          on = Math.sin(time * 2.1 + i * 1.7) > 0.35;
        if (on) CA.glow(ctx, x, y, 0.1 * k, o.kind === 1 ? '#ff8f8f' : theme.glow || '#ffe9a8', 0.9);
      }
    }
    // a shuttle crosses the far sky now and then (one at a time, slow, small; its engine glow and a short trail)
    function drawFarShuttle(ctx, width, theme) {
      const period = 17,
        p = (time % period) / 9;
      if (p > 1) return;
      const dir = Math.floor(time / period) % 2 ? -1 : 1,
        x = dir > 0 ? -k + p * (width + 2 * k) : width + k - p * (width + 2 * k),
        y = groundY - (4.3 + Math.sin(time * 0.5) * 0.15) * k,
        s = 0.2 * k;
      ctx.save();
      ctx.globalAlpha = Math.min(1, Math.min(p, 1 - p) * 6) * 0.85;
      const trail = ctx.createLinearGradient(x - dir * 2.2 * k, y, x, y);
      trail.addColorStop(0, 'rgba(255,255,255,0)');
      trail.addColorStop(1, 'rgba(255,233,168,0.55)');
      ctx.strokeStyle = trail;
      ctx.lineWidth = 0.05 * k;
      ctx.beginPath();
      ctx.moveTo(x - dir * 2.2 * k, y + 0.04 * k);
      ctx.lineTo(x - dir * 0.6 * s, y);
      ctx.stroke();
      CA.fillRR(ctx, x - s, y - 0.32 * s, 2 * s, 0.64 * s, 0.3 * s, '#e8e4fa');
      CA.fillRR(ctx, x + dir * 0.25 * s - 0.25 * s, y - 0.22 * s, 0.5 * s, 0.26 * s, 0.1 * s, 'rgba(170,230,255,0.95)');
      CA.glow(ctx, x - dir * 1.1 * s, y, 0.45 * s, '#ffb35a', 0.9);
      ctx.restore();
    }
    function drawBackground(ctx, width, height, theme) {
      const bg = Art.spaceBackground('col-' + planetId, Math.ceil(width) + 60, Math.ceil(height), theme.sky, math.hash('sky' + planetId));
      ctx.drawImage(bg, -(cam.x * 0.05) % 60, 0);
      // Beta 1.7 M9: a healed planetary core lights its world's sky
      if (L.sky.aurora || view.coreHealed) CA.aurora(ctx, width, height, time);
      const [px, py] = L.sky.planet;
      Art.drawPlanet(ctx, planetId, width * px - cam.x * 0.03, height * py, Math.min(width, height) * 0.08, time * 0.003);
      // Beta 1.9 M1: the tall-phone sky – a far range high above the horizon in the planet's haze, with a few beacon
      // lights of distant outposts (very slow parallax). Only where the sky is tall (phones held upright); cached.
      // P1.2: on every screen with sky room above the buildings (wide screens too), and the range carries the colony's
      // far outposts: domes, masts and a landing tower in the haze, their windows lit – the world goes on behind the
      // stations instead of ending in an empty sky
      if (groundY > 4.6 * k) {
        const fw = worldW * 0.12 + w,
          farther = cached('farther' + planetId + w + 'x' + h + ':' + k, fw, h, c => {
            const haze = c.createLinearGradient(0, groundY - 5.5 * k, 0, groundY - 1.4 * k);
            haze.addColorStop(0, 'rgba(0,0,0,0)');
            haze.addColorStop(1, theme.atmosphere + '40');
            c.fillStyle = haze;
            c.fillRect(0, groundY - 5.5 * k, fw, 4.1 * k);
            ridge(c, fw, groundY - 3.1 * k, 1.05 * k, 0.0032, 5 + planetId.length, theme.surface[0][1] + '80');
            ridge(c, fw, groundY - 2.35 * k, 0.6 * k, 0.0051, 9 + planetId.length, theme.surface[1][1] + '88');
            for (let i = 0; i < 9; i++) {
              const bx = ((i * 0.37 + 0.11) % 1) * fw,
                by = groundY - 3.1 * k - Math.sin(bx * 0.0032 + 5 + planetId.length) * 1.05 * k - Math.sin(bx * 0.0032 * 2.7 + (5 + planetId.length) * 2) * 0.37 * k + 0.12 * k;
              CA.glow(c, bx, by, 0.12 * k, theme.glow, 0.7);
            }
            farOutposts(c, fw, theme);
          });
        ctx.drawImage(farther, -cam.x * 0.12, 0);
        if (!reduced) farBeacons(ctx, fw, theme);
      }
      if (!reduced && groundY > 4.6 * k) drawFarShuttle(ctx, width, theme);
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
      // Beta 1.9 M1: the Werkstatt – a workshop shed behind the bench (sign, tool wall, lamp while it works); with a
      // second production line (research Zusatzfließband) a second belt runs along its wall
      CA.box(ctx, x, y, 1.9 * k, 1.35 * k, 0.3 * k, '#cfc6ee', '#ece6ff', '#b3a9dd');
      CA.poly(ctx, [[x - 1.12 * k, y - 1.35 * k], [x, y - 1.8 * k], [x + 1.12 * k, y - 1.35 * k]], '#8f86c8');
      CA.fillRR(ctx, x - 0.62 * k, y - 1.62 * k, 1.24 * k, 0.24 * k, 0.07 * k, 'rgba(29,33,80,0.92)');
      ctx.fillStyle = '#ffd77a';
      ctx.font = `900 ${Math.max(7, Math.round(0.16 * k))}px Nunito, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('WERKSTATT', x, y - 1.45 * k);
      ctx.textAlign = 'left';
      for (let i = 0; i < 3; i++) CA.line(ctx, x - 0.7 * k + i * 0.22 * k, y - 1.15 * k, x - 0.7 * k + i * 0.22 * k, y - 0.88 * k, 0.04 * k, i === 1 ? '#ffb35a' : '#6f7da8');
      CA.glow(ctx, x + 0.65 * k, y - 1.12 * k, 0.12 * k, fab.work.length ? '#ffe9a8' : '#5a5f88', 0.9);
      if ((fab.lines || 1) > 1) {
        ctx.fillStyle = '#2a2d52';
        ctx.fillRect(x - 0.85 * k, y - 0.98 * k, 1.7 * k, 0.07 * k);
        ctx.fillStyle = '#7f86b8';
        const roll2 = reduced ? 0 : (time * 0.6) % 1;
        for (let i = 0; i < 8; i++) {
          ctx.beginPath();
          ctx.arc(x - 0.8 * k + ((i + roll2) % 8) * 0.2 * k, y - 0.945 * k, 0.022 * k, 0, TAU);
          ctx.fill();
        }
      }
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
    // P1.5: the planet decoration of this world (meta.decor, one per planet) stands in the front yard of the home, on
    // the side with more room; it reacts to the world (frozen on an unheated Glacies, blossoms open once freed)
    const decorStats = { drawn: null };
    function drawPlanetDecor(ctx) {
      decorStats.drawn = null;
      const id = view.cosmeticDecor;
      if (!id || !CA.decor || !hasPlot('hut')) return;
      const hx = plotX('hut'),
        others = Object.keys(L.plots).filter(n => n !== 'hut' && hasPlot(n)).map(plotX),
        room = side => Math.min(...others.map(px => Math.abs(px - (hx + side * 1.8 * k))), 99 * k),
        side = hx + 1.8 * k > L.width * k - 1.6 * k ? -1 : hx - 1.8 * k < 1.6 * k ? 1 : room(1) >= room(-1) ? 1 : -1,
        x = hx + side * 1.8 * k,
        y = groundAt(x) + 1.15 * k, // in the front yard, in front of the street (below the plaque)
        r = CA.decor(ctx, id, x, y, k * 0.72, { planet: planetId, time, reduced, warm: view.heated !== false, freed: Boolean(view.liberated) });
      if (r) {
        decorStats.drawn = { id, x: Math.round(x / k * 10) / 10, side };
        addHit(r, 'decor', id);
      }
    }
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
      // Beta 1.9 M2: the pad shows the goods the porters brought; the crane swings and crates rise only while the freight
      // really loads them
      plot('dock', b[3], 'Frachtdock', CA.dock, { active: v.haul ? Boolean(flow.freighting) : auto.dock && flow.selling, queue: v.transportBottleneck, pad: v.haul && auto.dock ? v.haul.padRatio : undefined, freighting: Boolean(flow.freighting) });
      // Beta 1.7 M5: from Lv 10 the helpers' hut is the mining and logistics HQ (Bergbau-Zentrale)
      plot('hut', b[1], b[1] >= 10 ? 'Bergbau-Zentrale' : 'Helferhütte', CA.hut, { cold: L.sky.snow, warm: v.heated !== false });
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
      // Beta 1.9 M1: the planet-specific buildings get their tiers as annexes in their world's style (drawn behind them)
      const annexed = (kind, draw) => (c, x, y, kk, o) => {
        CA.planetAnnex?.(c, kind, x, y, kk, o.level, planetId, time, Boolean(o.active));
        return draw(c, x, y, kk, o);
      };
      plot('depot', b[2], ice ? 'Eislager' : volcanic ? 'Basaltlager' : VA ? 'Wurzellager' : 'Lagerhaus', ice ? annexed('depot', CA.iceDepot) : volcanic ? annexed('depot', PA.depot) : VA ? annexed('depot', VA.depot) : CA.depot, { fill: v.storageRatio, active: flow.moving, warm: v.heated !== false, calm, skin: v.cosmeticDepot || null, reduced });
      // Beta 1.7 M2: the Packstation beside the depot (on the side with more free ground)
      if ((ind.sorter || 0) > 0 && hasPlot('depot')) {
        const px = packStationX(),
          pr = CA.packStation(ctx, px, groundAt(px), k, { level: ind.sorter, fill: v.packedRatio, active: Boolean(flow.packing), time, reduced });
        addHit(pr, 'building', 'sorter');
      }
      plot('refinery', ind.refinery, 'Raffinerie', CA.refinery, { active: flow.refining, hopper: v.hopperRatio, bars: v.barsRatio, locked: !v.refineryUnlocked });
      // Beta 1.4 M7: the Fertigung bench right of the refinery (or the Thermalwerkstatt): real orders and goods
      if (view.fab) {
        const host = ind.refinery && hasPlot('refinery') ? 'refinery' : ind.thermal && hasPlot('thermal') ? 'thermal' : null;
        if (host) drawFabBench(ctx, plotX(host) + 2.05 * k, groundAt(plotX(host) + 2.05 * k), view.fab);
      }
      plot('stall', ind.stall, 'Verkaufsstand', (c, x, y, kk, o) => {
        if (ice || volcanic || VA) CA.planetAnnex?.(c, 'stall', x, y, kk, o.level, planetId, time, Boolean(flow.customers || flow.selling));
        const r = (ice ? CA.iceStall : volcanic ? PA.stall : VA ? VA.stall : CA.stall)(c, x, y, kk, o);
        // P1.5: a stall look is the roof of every planet's stall (drawn by the stall itself – no pennant line any more)
        if (r && !auto.stall) hits.push({ ...r.counter, type: 'sell', key: 'stall' });
        return r;
      }, { fill: v.haul && auto.stall ? v.haul.shelfRatio : v.storageRatio, saleGlow, skin: v.cosmeticStall || null }); // Beta 1.9: the shelf's real goods
      if (hasPlot('thermal')) plot('thermal', ind.thermal || 0, 'Thermalwerkstatt', CA.thermalWorkshop, { active: flow.thermal, heated: v.heated, fill: v.cellsRatio, locked: !v.thermalUnlocked });
      if (hasPlot('foundry') && PA) plot('foundry', ind.foundry || 0, 'Glutschmelze', annexed('foundry', PA.foundry), { active: flow.smelting, fill: v.emberRatio, bars: v.alloyRatio, cooled: v.cooled, calm, overheated: (ind.foundry || 0) >= 10 && !calm });
      if (hasPlot('sporeGarden') && VA) plot('sporeGarden', ind.sporeGarden || 0, 'Sporengarten', annexed('sporeGarden', VA.sporeGarden), { active: flow.sporing, fill: v.sporeRatio, welke });
      if (hasPlot('biolab') && VA) plot('biolab', ind.biolab || 0, 'Biolabor', annexed('biolab', VA.biolab), { active: flow.brewing, fill: v.sporeRatio, gel: v.gelRatio, welke, capped: welke && (ind.biolab || 0) >= 10, locked: !v.biolabUnlocked });
      if (hasPlot('workshop') && MK) plot('workshop', ind.workshop || 0, 'Präzisionswerkstatt', annexed('workshop', MK.workshop), { active: flow.assembling, fill: v.precisionRatio, parts: v.partsRatio });
      // maintenance robots: they roll around while the colony's machines really run
      if (MK) for (const lm of L.landmarks || []) if (lm.kind === 'bot') MK.maintenanceBot(ctx, lm.x * k, groundAt(lm.x * k) + 0.05 * k, k * 0.9, time, Boolean(flow.assembling || flow.moving || flow.selling), lm.x);
      // Beta 1.7 M5: the Sternenharz drill station (Orion): a pumpjack and a resin tank filled to the real level
      if (hasPlot('resinDrill')) plot('resinDrill', ind.resinDrill || 0, 'Sternenharz-Bohrturm', CA.resinDrill, { active: flow.pumping, fill: v.resinRatio, reduced });
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
        // Beta 1.9: the hand-over at the top in one place – the cabin, the chute to the Halde, the loading cart
        if (window.MineArt.liftDisplay)
          window.MineArt.liftDisplay(ctx, hx, groundAt(hx), k * 0.85, window.MineArt.elevatorStage(v.underground.level), time, {
            lift: v.underground.lift || null,
            pile: v.pileRatio || 0,
            cart: v.transit && v.transit.auto ? v.transit.loading : null,
            chuteDir: -mineDir(),
            accent: theme.accent
          });
        CA.plaque(ctx, hx, groundAt(hx) + 0.36 * k, k, 'Förderturm ⇣ Mine', '#8fe3ff');
      }
      const mr = CA.mine(ctx, mx, my, k, { ...common, level: b[0], active: auto.mine && flow.mining, pileRatio: v.pileRatio, pileFull: (v.pileRatio || 0) >= 0.95, rock: L.sky.snow ? '#a7c8e6' : '#8a86c8', flip: mineDir() < 0 });
      addHit(mr, 'building', 0);
      addHit({ x0: mx - 1.3 * k, y0: my - 1.6 * k, x1: mx + 1.3 * k, y1: my + 0.1 * k }, 'deposit', 0);
    }
    // Beta 1.7 M2: where the Packstation stands: 2.4 kitten widths beside the depot, towards the side whose nearest
    // building (or the Fertigung bench) is farther away
    function packStationX() {
      const d = plotX('depot'),
        others = Object.keys(L.plots)
          .filter(p => p !== 'depot' && hasPlot(p))
          .map(plotX);
      if (view.fab && hasPlot('refinery')) others.push(plotX('refinery') + 2.05 * k);
      const room = dir => Math.min(...others.filter(x => (x - d) * dir > 0).map(x => Math.abs(x - d)), Infinity);
      return d + (room(1) >= room(-1) ? 1 : -1) * 2.4 * k;
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
      const line = view.transit,
        useLine = line && (line.auto || line.carts.length > 0 || line.loading > 0);
      carts.forEach((c, i) => {
        // Beta 1.7 M3: with the cart line running, the legacy shuttle only shows a manual trip
        if (useLine && !(i === 0 && view.trip && !line.auto)) return;
        const cx = math.lerp(x0, x1, c.pos),
          cy = groundAt(cx) - 0.14 * k,
          seen = seenCarts.push(cx),
          heading = (x1 > x0 ? 1 : -1) * c.dir;
        CA.vehicle(ctx, cx, cy, k, { level, loaded: c.loaded && c.dir > 0, dir: heading, time, accent: theme.accent, skin: view.cosmeticVehicle, moving: true, reduced });
        if (i === 0) addHit({ x0: cx - 0.9 * k, y0: cy - 1.1 * k, x1: cx + 0.9 * k, y1: cy + 0.2 * k }, 'cart', 'rail');
      });
      if (useLine) drawCartLine(ctx, theme, line, x0, x1, level);
    }
    // Beta 1.7 M3: the carts of the line exactly as the economy moves them – the loading cart at the Halde (its load
    // grows), loaded carts on the way, tipping at the depot or waiting there while it is full, empty ones going back.
    // At the first tier a kitten pushes each wheelbarrow (walks with it, tips it, walks back).
    const seenCarts = []; // P1: cart positions of this frame (kittens nearby look after them)
    // Visual Identity round: the cart line drawn calm and glitch-free (the economy's carts are unchanged):
    // - loaded vehicles run on the front rail, empty ones return on a back rail (behind, a little smaller) — they never
    //   drive through each other;
    // - a departing vehicle starts where it loaded (no jump back), the next one rolls in from behind and fades in;
    // - at the depot an unloaded vehicle turns (a short squash-flip) where it stood; a returning one fades out before the
    //   Halde instead of vanishing;
    // - vehicles keep their length apart and stop behind the queue instead of driving into it;
    // - at most VEHICLES_SHOWN loaded vehicles and one returning one are drawn; the rest is a "+N" pill on the queue
    //   head (every cart still exists in the economy and in the depot's numbers).
    const VEHICLES_SHOWN = 2;
    const drawnVehicles = []; // QA: the cart-line vehicles of the last frame (debug())
    function vehicleLength(tier) {
      return (tier >= 4 ? 1.7 : tier === 3 ? 3.2 : 1.6) * k;
    }
    function drawCartLine(ctx, theme, line, x0, x1, level) {
      const toDepot = x1 > x0 ? 1 : -1,
        barrow = line.tier === 1,
        len = vehicleLength(line.tier),
        loadX = x0 + toDepot * 0.4 * k,
        dumpX = x1 - toDepot * 0.3 * k,
        spot = (x, heading, o) => {
          const back = Boolean(o.back),
            cy = groundAt(x) - 0.14 * k - (back ? 0.2 * k : 0),
            sc = back ? 0.8 : 1;
          ctx.save();
          if (o.alpha !== undefined && o.alpha < 1) ctx.globalAlpha = Math.max(0, o.alpha);
          if (sc !== 1 || o.turn !== undefined) {
            ctx.translate(x, cy);
            ctx.scale(sc * (o.turn ?? 1), sc);
            ctx.translate(-x, -cy);
          }
          if (barrow && !back) {
            // the pusher holds the handles (P1: the paws sit on the real grip, the tilt included) — walking, tipping
            // (a happy finish at the end of the tip) or waiting with the barrow
            let hx = -0.74 * k,
              hy = -0.24 * k;
            if (o.tilt) {
              const px = hx - 0.35 * k,
                py = hy + 0.1 * k,
                cs = Math.cos(-o.tilt),
                sn = Math.sin(-o.tilt);
              hx = px * cs - py * sn + 0.35 * k;
              hy = px * sn + py * cs - 0.1 * k;
            }
            const size = k * 0.62,
              gx = x + heading * hx,
              kx = gx - heading * 0.3 * size,
              ky = groundAt(kx) + 0.04 * k;
            kitten(ctx, roleLook(Kit.WORKERS[(o.seed || 0) % Kit.WORKERS.length], 'transport'), kx, ky, size, { pose: 'push', grip: [0.3, (cy + hy - ky) / size], t: time, seed: o.seed || 0, facing: heading, walking: o.pose === 'walk', mood: o.pose === 'work' && (o.tilt || 0) > 0.45 ? 'happy' : o.pose === 'idle' ? 'tired' : undefined });
          } else if (barrow) {
            // an empty barrow on its way back is pushed by a smaller kitten on the back path
            const kx = x - heading * 0.95 * k;
            kitten(ctx, roleLook(Kit.WORKERS[(o.seed || 0) % Kit.WORKERS.length], 'transport'), kx, groundAt(kx) - 0.16 * k, k * 0.62, { pose: 'walk', t: time, seed: o.seed || 0, facing: heading, walking: true });
          }
          seenCarts.push(x);
          drawnVehicles.push({ x: Math.round(x), back, len: Math.round(len), alpha: o.alpha ?? 1 });
          CA.vehicle(ctx, x, cy, k, { level, loaded: o.fill > 0, fill: o.fill, tilt: o.tilt || 0, dir: heading, time, accent: theme.accent, barrow, skin: view.cosmeticVehicle, moving: o.pose === 'walk', reduced });
          ctx.restore();
          return { x0: x - 0.9 * k, y0: cy - 1.1 * k, x1: x + 0.9 * k, y1: cy + 0.2 * k };
        };
      // returning vehicles first (back rail, behind everything): the nearest one to the Halde is shown
      const returning = line.carts.filter(c => c.phase === 'returning').sort((a, b) => b.progress - a.progress);
      const ret = returning[0];
      if (ret) {
        const p = ret.progress,
          turn = p < 0.08 ? Math.max(0.15, Math.abs(1 - (2 * p) / 0.08)) : 1,
          heading = p < 0.04 ? toDepot : -toDepot;
        spot(math.lerp(dumpX, loadX, p), heading, { fill: 0, pose: 'walk', seed: ret.id, back: true, turn, alpha: p > 0.88 ? (1 - p) / 0.12 : 1 });
      }
      // the loaded ones: unloading first, then waiting in queue order, then moving (most advanced first)
      const at = line.carts.filter(c => c.phase === 'unloading' || c.phase === 'waiting').sort((a, b) => (a.phase === 'unloading' ? -1 : 0) - (b.phase === 'unloading' ? -1 : 0) || a.id - b.id),
        moving = line.carts.filter(c => c.phase === 'moving').sort((a, b) => b.progress - a.progress),
        order = [...at, ...moving];
      let slot = 0,
        shownN = 0,
        hidden = 0,
        last = null,
        ahead = null; // x of the vehicle in front (toward the depot)
      for (const c of order) {
        let x, o;
        if (c.phase === 'unloading') {
          x = dumpX;
          o = { fill: c.fill * (1 - c.progress), tilt: Math.sin(Math.min(1, c.progress) * Math.PI) * 0.6, pose: 'work', seed: c.id };
          slot++;
        } else if (c.phase === 'waiting') {
          x = dumpX - toDepot * slot++ * (len + 0.2 * k);
          o = { fill: c.fill, pose: 'idle', seed: c.id };
        } else {
          // from the loading spot to its place in the queue
          const stop = dumpX - toDepot * slot * (len + 0.2 * k);
          x = math.lerp(loadX, stop, c.progress);
          o = { fill: c.fill, pose: 'walk', seed: c.id };
        }
        // not drawn when the budget is used up, when it would stand inside the vehicle in front (a short track with
        // long trains) or behind the loading spot — counted in the +N pill instead
        const tooClose = ahead !== null && (ahead - x) * toDepot < len + 0.2 * k,
          behindStart = (x - loadX) * toDepot < -0.05 * k;
        if (shownN >= VEHICLES_SHOWN || tooClose || behindStart) {
          hidden++;
          continue;
        }
        ahead = x;
        shownN++;
        last = { x, r: spot(x, toDepot, o) };
      }
      if (last && hidden > 0) CA.crowdBadge?.(ctx, last.x, last.r.y0 - 0.1 * k, k, hidden);
      // the loading vehicle at the Halde: it waits one length behind the last vehicle that left and fades in while it
      // rolls up to its spot, then fills up (it never stands inside the one that just departed)
      if (line.auto || line.loading > 0) {
        let x = loadX;
        if (ahead !== null && (ahead - loadX) * toDepot < len + 0.2 * k) x = ahead - toDepot * (len + 0.2 * k);
        const behind = (loadX - x) * toDepot,
          arrive = Math.max(0, 1 - behind / (0.8 * k));
        if (arrive > 0.05) {
          const r = spot(x, toDepot, { fill: line.loading, pose: line.loading > 0 && line.auto ? 'carry' : 'idle', seed: 0, alpha: arrive });
          addHit(r, 'cart', 'rail');
        }
      }
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
    // Beta 1.9 M1: sky traffic – while the Frachtdock really loads freight (view.flow.freighting), small cargo shuttles
    // lift off from it one after another and climb into the sky, shrinking with distance (uses the tall phones' sky)
    function drawSkyTraffic(ctx) {
      if (!view.flow?.freighting || !hasPlot('dock') || reduced) return;
      const padX = plotX('dock');
      if (padX < cam.x - 6 * k || padX > cam.x + w + 6 * k) return;
      const padY = groundAt(padX) - 0.6 * k;
      for (let i = 0; i < 2; i++) {
        const p = ((time + i * 3.5) % 7) / 7,
          y = padY - p * (padY + 0.5 * k),
          x = padX + Math.sin(p * 2.4 + i) * 1.2 * k + (i ? -1 : 1) * p * 2.5 * k,
          s = k * (0.42 - 0.3 * p);
        ctx.globalAlpha = Math.min(1, (1 - p) * 2.2);
        CA.fillRR(ctx, x - 0.9 * s, y - 0.28 * s, 1.8 * s, 0.56 * s, 0.26 * s, '#e8e4fa');
        CA.fillRR(ctx, x - 0.2 * s, y - 0.2 * s, 0.4 * s, 0.24 * s, 0.1 * s, 'rgba(170,230,255,0.95)');
        CA.fillRR(ctx, x - 0.8 * s, y + 0.12 * s, 1.6 * s, 0.14 * s, 0.06 * s, '#ffd77a');
        CA.glow(ctx, x, y + 0.45 * s, 0.5 * s, '#ffb35a', 0.8);
        ctx.globalAlpha = 1;
      }
    }
    // Beta 1.9 M7: Glacies transformed by its healed Thermalkern – steaming hot springs between the buildings
    function drawHotSprings(ctx) {
      if (planetId !== 'ice' || !view.coreHealed) return;
      for (const f of [0.18, 0.47, 0.79]) {
        const x = f * worldW;
        if (x < cam.x - 2 * k || x > cam.x + w + 2 * k) continue;
        const y = groundAt(x) + 0.12 * k;
        ctx.fillStyle = '#7fd8e8';
        ctx.beginPath();
        ctx.ellipse(x, y, 0.9 * k, 0.2 * k, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.ellipse(x - 0.2 * k, y - 0.04 * k, 0.4 * k, 0.07 * k, 0, 0, TAU);
        ctx.fill();
        CA.glow(ctx, x, y, 0.9 * k, '#ffb35a', 0.18);
        if (!reduced) for (let i = 0; i < 3; i++) CA.glow(ctx, x + Math.sin(time + i * 2) * 0.3 * k, y - 0.3 * k - ((time * 0.4 + i / 3) % 1) * 1.2 * k, 0.32 * k, '#ffffff', 0.22);
      }
    }
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
    // Beta 1.9 M2/M3: the hand-overs after the depot are real batches (logistics.js, view.haul). Every carrier drawn here
    // is one run of the economy with its load and phase – nothing walks without goods behind it:
    // - loading: the next carrier stands at the source while its load grows (operate);
    // - moving: carries the load to the target (tier 1 by hand above the head, 2 a wheelbarrow, 3 a pulled wagon, 4 a
    //   hover pallet with an escort; the tier follows the level of the building it serves);
    // - unloading: sets it down (work; the barrow tips);
    // - waiting: queues at a full hopper with its load (idle);
    // - returning: walks back empty.
    // A leg without goods shows one porter resting at its source (checking the load list now and then).
    const HAUL_PLOT = { depot: 'depot', refinery: 'refinery', shelf: 'stall', pad: 'dock', hopper: 'refinery' };
    const HAUL_LANE = { stallRaw: 0, stallBars: 0.07, dockRaw: 0.035, dockBars: 0.1, feed: -0.035, fab: 0.05 };
    const HAUL_SEED = { stallRaw: 41, stallBars: 67, dockRaw: 29, dockBars: 83, feed: 53, fab: 97 };
    // planet porters: their own carrier (sled, heat cart, robot cart, woven basket) and their own gear
    const PORTER_GEAR = { ice: ['acc-mint-scarf'], volcanic: ['acc-explorer-goggles'], machine: ['acc-cute-antenna'], verdant: ['acc-moon-patch'] };
    const porterLooks = new Map();
    const porterLook = seed => {
      const key = planetId + ':' + (seed % Kit.WORKERS.length);
      if (!porterLooks.has(key)) {
        const look = Kit.WORKERS[seed % Kit.WORKERS.length];
        // the transport uniform (vest + cap) plus the world's own gear (scarf, goggles, antenna, patch)
        porterLooks.set(key, roleLook(look, 'transport', PORTER_GEAR[planetId] && Kit.slotsOf ? Kit.slotsOf(PORTER_GEAR[planetId]) : null));
      }
      return porterLooks.get(key);
    };
    const HAUL_DUTY = { shelf: 'stall', pad: 'dock', hopper: 'depot' };
    // where each leg's next carrier loads beside its source (kitten widths along the route), so two legs of one source
    // do not stand on one spot
    const HAUL_SLOT = { stallRaw: 0, dockRaw: 0.6, feed: 1.2, stallBars: 0, dockBars: 0.6 };
    function haulEnds(leg) {
      const from = HAUL_PLOT[leg.from],
        to = HAUL_PLOT[leg.to];
      if (!hasPlot(from) || !hasPlot(to) || from === to) return null;
      const a = plotX(from),
        b = plotX(to),
        dir = Math.sign(b - a) || 1;
      const x0 = a + dir * 1.9 * k,
        x1 = b - dir * 1.7 * k;
      // a hop between neighbours runs on a belt: the load glides, nobody walks back and forth on a tiny stretch
      return { x0, x1, dir, belt: Math.abs(x1 - x0) < 2.4 * k };
    }
    const PORTERS_SHOWN = 1;
    const CARRY_RANK = { unloading: 0, waiting: 1, moving: 2, returning: 3 };
    const carryRank = r => CARRY_RANK[r.phase] ?? 4;
    function haulCarriers() {
      const hv = view?.haul,
        out = [];
      if (!hv) return out;
      for (const [id, leg] of Object.entries(hv.legs)) {
        const e = haulEnds(leg);
        if (!e) continue;
        e.x0 += e.dir * (HAUL_SLOT[id] || 0) * k; // the whole route starts at the leg's loading spot
        let queue = 0;
        // crates start at the Packstation beside the depot (that is where they are packed)
        const packX = leg.from === 'depot' && (view.industry?.sorter || 0) > 0 && !e.belt ? packStationX() : null;
        // Visual Identity round: one loaded porter per route is drawn (or one going back when nothing is carried; the one at
        // the target first, then the most advanced); the other runs stay in the list as hidden and are counted in a
        // "+N" pill on the leading porter — every drawn porter is still a real run, no run is lost from the picture
        const ranked = e.belt
          ? leg.runs.filter(r => r.phase !== 'returning')
          : leg.runs.slice().sort((a, b) => carryRank(a) - carryRank(b) || (b.progress || 0) - (a.progress || 0));
        let loadedShown = 0,
          backShown = 0,
          lead = null,
          extra = 0;
        for (const r of ranked) {
          if (e.belt && r.phase === 'returning') continue; // a belt has no way back
          const back = r.phase === 'returning',
            // a porter going back is only shown while nothing is carried on its route (one kitten per route at a time)
            hidden = !e.belt && (back ? backShown >= 1 || loadedShown >= 1 : loadedShown >= PORTERS_SHOWN);
          const c = { leg: id, run: r.id, phase: r.phase, goods: r.goods, tier: leg.tier, units: r.units, fill: r.fill, facing: e.dir, tilt: 0, belt: e.belt },
            x0 = packX !== null && r.goods === 'packed' ? packX : e.x0;
          if (r.phase === 'moving') Object.assign(c, { x: x0 + (e.x1 - x0) * r.progress, pose: leg.tier === 1 ? 'carry' : 'walk' });
          else if (r.phase === 'unloading') Object.assign(c, { x: e.x1, pose: 'work', progress: r.progress, fill: r.fill * (1 - r.progress), tilt: leg.tier === 2 ? Math.sin(Math.min(1, r.progress) * Math.PI) * 0.6 : 0 });
          else if (r.phase === 'waiting') Object.assign(c, { x: e.x1 - e.dir * (0.95 + 1.05 * queue++) * k, pose: 'idle' });
          else Object.assign(c, { x: e.x1 + (e.x0 - e.x1) * r.progress, pose: 'walk', fill: 0, facing: -e.dir });
          if (hidden) {
            c.hidden = true;
            if (!back) extra++;
          } else if (back) backShown++;
          else {
            loadedShown++;
            lead ??= c;
          }
          out.push(c);
        }
        if (lead && extra) lead.more = extra;
        if (leg.loading > 1e-9) {
          const g = leg.loadingGoods;
          out.push({ leg: id, run: 0, phase: 'loading', goods: g.bars > 0 ? 'bars' : g.packed > g.raw ? 'packed' : 'raw', tier: leg.tier, units: leg.loading, fill: leg.loadingFill, facing: e.dir, tilt: 0, x: e.x0, pose: 'operate', beltOperator: e.belt });
        }
      }
      // Beta 1.9 M3: the Fertigung's batches – a porter carries the raw a batch took from the depot to the bench in the
      // batch's first seconds and walks back empty (the batch's timing is the economy's own; nothing extra is moved)
      if (view.fab && hasPlot('depot')) {
        const ind = view.industry || {},
          host = ind.refinery && hasPlot('refinery') ? 'refinery' : ind.thermal && hasPlot('thermal') ? 'thermal' : null;
        if (host) {
          const a = plotX('depot'),
            bench = plotX(host) + 2.05 * k,
            dir = Math.sign(bench - a) || 1,
            x0 = a + dir * 1.9 * k,
            x1 = bench - dir * 0.8 * k;
          for (const wk of view.fab.work || []) {
            if (!(wk.raw > 0) || Math.abs(x1 - x0) < k) continue;
            const fetch = Math.max(1, Math.min(0.3 * wk.seconds, Math.abs(x1 - x0) / (1.4 * k))),
              t = wk.elapsed;
            if (t < fetch) out.push({ leg: 'fab', run: wk.id, phase: 'moving', goods: 'raw', tier: 1, units: wk.raw, fill: 0.67, facing: dir, tilt: 0, x: x0 + (x1 - x0) * (t / fetch), pose: 'carry' });
            else if (t < fetch + 0.6) out.push({ leg: 'fab', run: wk.id, phase: 'unloading', goods: 'raw', tier: 1, units: wk.raw, fill: 0.67 * (1 - (t - fetch) / 0.6), facing: dir, tilt: 0, x: x1, pose: 'work' });
            else if (t < 2 * fetch + 0.6) out.push({ leg: 'fab', run: wk.id, phase: 'returning', goods: 'raw', tier: 1, units: 0, fill: 0, facing: -dir, tilt: 0, x: x1 + (x0 - x1) * ((t - fetch - 0.6) / fetch), pose: 'walk' });
          }
        }
      }
      // resting porters: one per source building whose legs carry nothing while the receiving station is staffed
      const busy = new Set(out.map(c => (hv.legs[c.leg] ? HAUL_PLOT[hv.legs[c.leg].from] : 'depot')));
      for (const [id, leg] of Object.entries(hv.legs)) {
        const from = HAUL_PLOT[leg.from],
          e = haulEnds(leg);
        if (!e || busy.has(from) || !view.auto?.[HAUL_DUTY[leg.to]]) continue;
        busy.add(from);
        const glance = Math.sin(time * 0.35 + HAUL_SEED[id]) > 0.7;
        out.push({ leg: id, run: -1, phase: 'resting', goods: 'raw', tier: leg.tier, units: 0, fill: 0, facing: -e.dir, tilt: 0, x: e.x0 - e.dir * 0.35 * k, pose: glance ? 'check' : 'idle' });
      }
      return out;
    }
    // P1: where the paws hold a carrier (carrier-local handle ends of colony-art.js haulCarrier, in its units):
    // [pose, x, y] — barrows are pushed by their handles, sleds and wagons pulled by their bars; robot carts roll alone
    const HAUL_GRIP = {
      crystal: { 2: ['push', -0.66, -0.16], 3: ['pull', 0.8, -0.2] },
      ice: { 2: ['pull', 0.82, -0.2], 3: ['pull', 0.82, -0.2] },
      volcanic: { 2: ['push', -0.68, -0.16], 3: ['push', -0.42, -0.3] },
      verdant: { 2: ['push', -0.68, -0.16], 3: ['push', -0.4, -0.3] },
      machine: {}
    };
    function haulGrip(tier, dir, vx, vy, tilt) {
      const g = (HAUL_GRIP[planetId] || HAUL_GRIP.crystal)[tier];
      if (!g) return null;
      const s = k * 0.95;
      let x = g[1] * s,
        y = g[2] * s;
      if (tilt) {
        // the barrow tips around its wheel (haulCarrier: translate(0.3, −0.1) · rotate(−tilt))
        const px = x - 0.3 * s,
          py = y + 0.1 * s,
          c = Math.cos(-tilt),
          sn = Math.sin(-tilt);
        x = px * c - py * sn + 0.3 * s;
        y = px * sn + py * c - 0.1 * s;
      }
      return { pose: g[0], x: vx + dir * x, y: vy + y };
    }
    // Market customers: while the shelf really sells (view.flow.customers) 1–3 cats come from the far side, pay at the
    // counter and leave with a bag. Deterministic in time, no state.
    function customerSpots() {
      if (!view?.flow?.customers || !hasPlot('stall')) return [];
      const sx = plotX('stall'),
        side = hasPlot('depot') && plotX('depot') > sx ? -1 : 1,
        n = Math.min(2, view.haul?.legs?.stallRaw?.tier || 1),
        T = 7,
        out = [];
      for (let i = 0; i < n; i++) {
        const p = (time + (i * T) / n + 0.9) % T,
          far = sx + side * 3.3 * k,
          at = sx + side * (0.75 + 0.42 * i) * k;
        if (p < 2.4) out.push({ i, x: far + (at - far) * (p / 2.4), pose: 'walk', facing: -side, bag: false });
        else if (p < 3.6) out.push({ i, x: at, pose: 'check', facing: -side, bag: false });
        else if (p < 3.95) out.push({ i, x: at, pose: 'cheer', facing: -side, bag: true });
        else if (p < 6.35) out.push({ i, x: at + (far - at) * ((p - 3.95) / 2.4), pose: 'walk', facing: side, bag: true });
      }
      return out;
    }
    // All kittens sorted into two depth lanes (back: resting/residents, front: workers/managers/Mochi).
    // P1: a kitten standing idle within 2.5 k of a passing cart looks after it (gaze −1..1, the head follows)
    function cartGaze(x) {
      let best = null;
      for (const cx of seenCarts) if (Math.abs(cx - x) < 2.5 * k && (best === null || Math.abs(cx - x) < Math.abs(best - x))) best = cx;
      return best === null ? 0 : Math.max(-1, Math.min(1, (best - x) / (1.2 * k)));
    }
    // P1 QA: what Mochi, Void and Pip wore in the last drawn frame (debug())
    const drawnWear = {};
    function drawKittens(ctx) {
      const back = [],
        front = [],
        accent = view.theme?.accent || '#c4a3ff';
      stats.porters = 0;
      stats.customers = 0;
      // the belts of short hops (drawn under their loads)
      if (view.haul)
        for (const leg of Object.values(view.haul.legs)) {
          const e = haulEnds(leg);
          if (!e?.belt || (!leg.runs.length && !(leg.loading > 1e-9))) continue;
          const y0 = groundAt(e.x0) - 0.42 * k,
            y1 = groundAt(e.x1) - 0.42 * k;
          back.push({ x: Math.min(e.x0, e.x1), draw: () => CA.conveyor(ctx, e.x0, y0, e.x1, y1, k * 0.8, true, time, accent) });
        }
      for (const c of haulCarriers()) {
        if (c.hidden || c.x < cam.x - 1.5 * k || c.x > cam.x + w + 1.5 * k) continue;
        if (c.more) front.push({ x: c.x + 0.001, draw: () => CA.crowdBadge?.(ctx, c.x, groundAt(c.x) - 1.05 * k, k, c.more) });
        stats.porters++;
        if (c.belt) {
          // on the belt: the run's load glides (moving) or sits at the end until it is taken off (unloading, waiting)
          if (c.fill > 0.02) front.push({ x: c.x, draw: () => CA.haulLoad(ctx, c.x, groundAt(c.x) - 0.52 * k, k * 0.85, c.goods, c.fill, accent) });
          continue;
        }
        const seed = HAUL_SEED[c.leg] + (c.run > 0 ? c.run : 0),
          look = c.leg === 'fab' ? roleLook(Kit.WORKERS[seed % Kit.WORKERS.length], 'tech') : porterLook(seed),
          size = k * 0.66,
          lane = (HAUL_LANE[c.leg] || 0) * k,
          gy = groundAt(c.x) + 0.06 * k + lane,
          walking = c.pose === 'walk' || c.pose === 'carry';
        // P1: the face follows the run — a short tired pause in a queue, a happy finish when a load is set down
        const mood = c.phase === 'waiting' ? 'tired' : undefined;
        front.push({ x: c.x, draw: () => {
          workerHit('porter:' + c.leg + ':' + c.run, c.x, gy - size * 1.15, () => Kit.workerCard?.(look, seed, c.leg === 'fab' ? 'tech' : 'transport'));
          if (c.tier === 1) {
            const loaded = c.fill > 0.02;
            if (c.phase === 'unloading') {
              // get ready, set the load down in front, a small happy finish (the load shrinks as the economy books it in)
              kitten(ctx, look, c.x, gy, size, { pose: 'unload', phase: c.progress, t: time, seed, facing: c.facing, tool: 'none' });
              if (loaded) CA.haulLoad(ctx, c.x + c.facing * size * (0.32 + 0.12 * Math.min(1, (c.progress || 0) * 1.4)), gy - size * (0.36 - 0.14 * Math.min(1, (c.progress || 0) * 1.4)), k * 0.85, c.goods, c.fill, accent);
              return;
            }
            // carried against the chest: the rig draws the load in the kitten's own frame (it bobs with the step), the
            // paws hold its sides
            const held = loaded && c.pose === 'carry';
            kitten(ctx, look, c.x, gy, size, { pose: held ? 'carry' : c.pose === 'carry' ? 'walk' : c.pose, t: time, seed, facing: c.facing, walking, tool: 'none', mood, hold: held ? (hctx, hx, hy) => CA.haulLoad(hctx, hx, hy, (k * 0.72) / size, c.goods, c.fill, accent) : null });
            if (loaded && !held) CA.haulLoad(ctx, c.x + c.facing * size * 0.42, gy - size * 0.55, k * 0.85, c.goods, c.fill, accent);
            return;
          }
          // tier 2: the kitten pushes the barrow by its handles; tier 3: it pulls the wagon by the drawbar; tier 4: it
          // walks beside the hover pallet. The paws sit on the real grip (haulGrip) at every frame, the tilt included.
          const vx = c.tier === 2 ? c.x + c.facing * 0.45 * k : c.tier === 3 ? c.x - c.facing * 0.55 * k : c.x - c.facing * 0.2 * k,
            vy = groundAt(vx) - 0.1 * k + lane,
            pose = c.pose === 'carry' ? 'walk' : c.pose;
          if (c.tier === 4) kitten(ctx, look, c.x + c.facing * 0.35 * k, gy - 0.02 * k, size * 0.95, { pose: pose === 'work' ? 'operate' : pose, t: time, seed, facing: c.facing, walking, tool: 'none', mood });
          CA.haulCarrier(ctx, vx, vy, k * 0.95, { tier: c.tier, dir: c.facing, goods: c.goods, fill: c.fill, tilt: c.tilt, time, accent, planet: planetId, skin: view.cosmeticVehicle, moving: walking, reduced });
          if (c.tier === 4) return;
          const g = haulGrip(c.tier, c.facing, vx, vy, c.tilt);
          if (!g) return kitten(ctx, look, c.x, gy, size, { pose, t: time, seed, facing: c.facing, walking, tool: 'none', mood });
          const kx = g.x - c.facing * (g.pose === 'push' ? 0.3 : -0.3) * size,
            ky = groundAt(kx) + 0.06 * k + lane,
            moving = c.phase === 'moving' || c.phase === 'returning';
          kitten(ctx, look, kx, ky, size, { pose: moving || c.phase === 'unloading' ? g.pose : pose, grip: [g.pose === 'push' ? 0.3 : -0.3, (g.y - ky) / size], t: time, seed, facing: c.facing, walking: moving, tool: 'none', mood: c.phase === 'unloading' && (c.progress || 0) > 0.7 ? 'happy' : mood });
        } });
      }
      for (const cu of customerSpots()) {
        if (cu.x < cam.x - k || cu.x > cam.x + w + k) continue;
        stats.customers++;
        const look = Kit.WORKERS[(cu.i * 2 + 3) % Kit.WORKERS.length],
          size = k * 0.62,
          gy = groundAt(cu.x) + 0.1 * k;
        front.push({ x: cu.x, draw: () => {
          const id = 'customer:' + cu.i;
          kitten(ctx, look, cu.x, gy, size, { pose: greeting(id) && cu.pose !== 'walk' ? 'wave' : cu.pose, t: time, seed: 90 + cu.i, facing: cu.facing, walking: cu.pose === 'walk', tool: 'none' });
          workerHit(id, cu.x, gy - size * 1.15, () => Kit.workerCard?.(look, 90 + cu.i, 'trade'));
          if (!cu.bag) return;
          const bx = cu.x - cu.facing * 0.2 * k,
            by = gy - 0.28 * k;
          CA.fillRR(ctx, bx - 0.12 * k, by - 0.2 * k, 0.24 * k, 0.24 * k, 0.04 * k, '#f0d2a8');
          CA.crystal(ctx, bx, by - 0.2 * k, 0.16 * k, accent, 0);
        } });
      }
      residents.forEach(r => back.push({ x: r.x + (r.dx || 0), draw: () => {
        const rx = r.x + (r.dx || 0),
          moving = Math.abs(r.dxTarget - (r.dx || 0)) > 0.05 * k,
          pose = cheer > 0 ? 'cheer' : view.heated === false ? 'worried' : r.chat > 0 ? 'wave' : moving ? 'walk' : 'idle',
          look = pose === 'idle' ? cartGaze(rx) : 0; // a resident looks after a passing cart
        kitten(ctx, r.look, rx, groundAt(rx) - 0.12 * k, k * 0.78, { pose, walking: moving, t: time, seed: r.seed, facing: moving ? Math.sign(r.dxTarget - (r.dx || 0)) : look ? Math.sign(look) : r.facing, gaze: Math.abs(look) });
        if (r.chat > 1 && zoom !== 'overview') {
          const by = groundAt(rx) - 1.25 * k;
          CA.fillRR(ctx, rx - 0.25 * k, by - 0.28 * k, 0.5 * k, 0.3 * k, 0.12 * k, 'rgba(255,255,255,0.9)');
          ctx.fillStyle = '#ff7aa8';
          ctx.font = `900 ${Math.round(0.22 * k)}px Nunito, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(r.seed % 2 ? '♥' : '…', rx, by - 0.06 * k);
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
        const id = 'helper:' + i,
          spot = hp.resting && (pose === 'idle' || pose === 'sleep') ? REST_SPOTS[i % REST_SPOTS.length] : null;
        if (spot) {
          back.push({ x: hp.x, draw: () => drawRestingHelper(ctx, hp, i, spot, id) });
          return;
        }
        (hp.resting ? back : front).push({ x: hp.x, draw: () => {
          const gy = groundAt(hp.x) + (hp.resting ? -0.12 * k : 0.05 * k),
            size = k * (hp.resting ? 0.75 : HELPER_SIZE),
            hello = greeting(id) && !slot;
          kitten(ctx, hp.look, hp.x, gy, size, { pose: hello ? 'wave' : pose, t: slot?.pose === 'mine' ? helperTime(hp.seed) : time, seed: hp.seed, facing, tool: i === 1 ? 'crystal' : 'drill' });
          workerHit(id, hp.x, gy - size * 1.15, () => Kit.workerCard?.(hp.look, hp.seed, hp.resting ? 'rest' : 'miner'));
        } });
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
        front.push({ x: px, draw: () => kitten(ctx, Kit.dressed ? Kit.dressed(Kit.ROSTER[3], view.pipWear) : Kit.ROSTER[3], px, groundAt(px) + 0.05 * k, k * 0.85, { pose: view.auto?.dock && view.flow?.selling ? 'wave' : 'idle', t: time, seed: 3 }) });
      }
      const mochiPose = mochi.target !== null ? 'walk' : mochi.actionTime > 0 ? mochi.action : cheer > 0 ? 'cheer' : mochi.idleTime > 25 ? 'sleep' : 'idle';
      // Void (Mochi's best friend) keeps a little behind Mochi, curious; tail flicks while waiting
      if (view.voidMet && Kit.VOID) {
        // P1: Void takes the free side of Mochi (working helpers and staff keep their spots); no free side → one step
        // back (behind lane, a little smaller), so three kittens never stack on one point
        const busyX = [...helpers.filter(hp => !hp.resting).map(hp => hp.x), ...[...staffSprites.values()].map(sp => sp.x)],
          free = x => busyX.every(bx => Math.abs(bx - x) >= 0.7 * k),
          side = [mochi.x - mochi.facing * 1.05 * k, mochi.x + mochi.facing * 1.05 * k].find(free),
          vx = side ?? mochi.x - mochi.facing * 0.8 * k,
          vBack = side === undefined,
          vPose = mochi.target !== null ? 'walk' : cheer > 0 ? 'cheer' : mochiPose === 'sleep' ? 'sleep' : Math.sin(time * 0.35) > 0.75 ? 'check' : 'idle';
        (vBack ? back : front).push({ x: vx - 0.01, draw: () => {
          const vLook = Kit.dressed ? Kit.dressed(Kit.VOID, view.voidWear) : Kit.VOID;
          drawnWear.void = vLook.wear || null;
          kitten(ctx, vLook, vx, groundAt(vx) + (vBack ? -0.12 : 0.1) * k, k * (vBack ? 0.8 : 0.92), { pose: vPose, t: time, seed: 17, facing: vx < mochi.x ? 1 : -1 });
          hits.push({ x0: vx - 0.45 * k, y0: groundAt(vx) - 1.1 * k, x1: vx + 0.45 * k, y1: groundAt(vx) + 0.1 * k, type: 'guardian', key: 'void' });
        } });
      }
      front.push({ x: mochi.x, draw: () => {
        const look = view.mochiWear && Kit.dressed ? Kit.dressed(Kit.ROSTER[0], view.mochiWear) : Kit.withAccessories(Kit.ROSTER[0], view.mochiAccessories);
        drawnWear.mochi = look.wear || null;
        // at the rock she faces the flank she strikes (reduced motion: resting on the rock in the contact pose)
        const mochiFacing = mochiPose === 'mine' && mochi.spot ? mochi.spot.facing * mineDir() : mochi.facing;
        kitten(ctx, look, mochi.x, groundAt(mochi.x) + 0.08 * k, k * 1.08, { pose: mochiPose, t: mochiPose === 'mine' ? (reduced ? helperTime(1) : Kit.MINE_CYCLE - mochi.actionTime - 0.237 + 10 * Kit.MINE_CYCLE) : time, seed: 1, facing: mochiFacing, tool: 'drill' });
        hits.push({ x0: mochi.x - 0.5 * k, y0: groundAt(mochi.x) - 1.2 * k, x1: mochi.x + 0.5 * k, y1: groundAt(mochi.x) + 0.1 * k, type: 'mochi', key: 0 });
      } });
      back.sort((a, b) => a.x - b.x).forEach(e => e.draw());
      front.sort((a, b) => a.x - b.x).forEach(e => e.draw());
      drawNameTag(ctx);
    }
    // P1.2: a resting helper's pause at its spot (see REST_SPOTS): the props (crate, toolbox) belong to the spot
    function drawRestingHelper(ctx, hp, i, spot, id) {
      const x = hp.x,
        base = groundAt(x) + spot.dy * k,
        size = k * (0.72 + (0.2 + spot.dy) * 0.4),
        hello = greeting(id),
        facing = spot.face;
      let y = base,
        pose = 'idle',
        opts = {};
      if (spot.act === 'crate') {
        CA.fillRR(ctx, x - 0.3 * k, base - 0.3 * k, 0.6 * k, 0.3 * k, 0.04 * k, '#c99a6a');
        CA.fillRR(ctx, x - 0.3 * k, base - 0.3 * k, 0.6 * k, 0.06 * k, 0.03 * k, '#e2b885');
        CA.line(ctx, x - 0.22 * k, base - 0.22 * k, x + 0.22 * k, base - 0.06 * k, 0.03 * k, '#9a6e48');
        y = base - 0.24 * k;
        pose = 'sit';
      } else if (spot.act === 'chat') {
        // two neighbours take turns: the speaker gestures, the listener tilts the head and looks over
        const turn = Math.sin(time * 0.7 + (spot.face > 0 ? 0 : Math.PI)),
          talk = turn > 0.2;
        pose = talk ? 'wave' : 'idle';
        opts = { gaze: talk ? 0 : 0.6, mood: talk ? 'happy' : 'curious' };
        if (turn > 0.75 && zoom !== 'overview') {
          const by = base - size * 1.55;
          CA.fillRR(ctx, x - 0.22 * k, by - 0.26 * k, 0.44 * k, 0.28 * k, 0.12 * k, 'rgba(255,255,255,0.9)');
          ctx.fillStyle = '#7f6ad8';
          ctx.font = '900 ' + Math.round(0.2 * k) + 'px Nunito, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(['…', '♪', '!', '♥'][(i + Math.floor(time / 9)) % 4], x, by - 0.06 * k);
          ctx.textAlign = 'left';
        }
      } else if (spot.act === 'gaze') {
        pose = 'sit';
        opts = { who: 'void' };
      } else if (spot.act === 'tinker') {
        const bx = x + facing * 0.46 * k;
        CA.fillRR(ctx, bx - 0.2 * k, base - 0.2 * k, 0.4 * k, 0.2 * k, 0.04 * k, '#e06b5a');
        CA.fillRR(ctx, bx - 0.08 * k, base - 0.26 * k, 0.16 * k, 0.07 * k, 0.03 * k, '#9a3a3a');
        pose = 'work';
        opts = { tool: 'drill' };
      } else if (spot.act === 'nap') {
        pose = 'sit';
        opts = { mood: 'sleepy' };
        if (!reduced && zoom !== 'overview') {
          const zt = (time * 0.5 + i * 0.3) % 1;
          ctx.globalAlpha = Math.sin(zt * Math.PI) * 0.85;
          ctx.fillStyle = '#e8e4fa';
          ctx.font = '900 ' + Math.round((0.16 + zt * 0.1) * k) + 'px Nunito, sans-serif';
          ctx.fillText('z', x + facing * (0.2 + zt * 0.25) * k, base - size * (1.05 + zt * 0.45));
          ctx.globalAlpha = 1;
        }
      }
      if (hello && pose !== 'sit') pose = 'wave';
      kitten(ctx, hp.look, x, y, size, { pose, t: time, seed: hp.seed, facing, tool: 'none', ...opts, ...(hello ? { mood: 'happy', gaze: 0 } : null) });
      workerHit(id, x, y - size * 1.15, () => Kit.workerCard?.(hp.look, hp.seed, 'rest'));
    }
    // the name tag over the inspected worker: name, role, style, a little quirk (fades in and out; follows the kitten)
    function drawNameTag(ctx) {
      if (!inspect.id) return;
      if (time >= inspect.until) {
        inspect.id = null;
        return;
      }
      if (!inspect.seen) return;
      if (typeof inspect.card === 'function') inspect.card = inspect.card();
      const c = inspect.card;
      if (!c) return;
      const left = inspect.until - time,
        a = Math.max(0, Math.min(1, (4 - left) * 6, left * 2.5)),
        fs1 = Math.max(11, Math.round(0.24 * k)),
        fs2 = Math.max(9, Math.round(0.17 * k)),
        f1 = '900 ' + fs1 + 'px Nunito, sans-serif',
        f2 = '800 ' + fs2 + 'px Nunito, sans-serif';
      ctx.save();
      ctx.globalAlpha = a;
      ctx.font = f1;
      const l1 = c.name + (c.role ? '  ·  ' + c.role : '');
      let tw = ctx.measureText(l1).width;
      ctx.font = f2;
      const l2 = c.style,
        l3 = '„' + c.quirk + '“';
      tw = Math.max(tw, ctx.measureText(l2).width, ctx.measureText(l3).width);
      const pw = tw + 0.4 * k,
        ph = fs1 + fs2 * 2 + 0.42 * k,
        px = math.clamp(inspect.x - pw / 2, cam.x + 6, cam.x + w - pw - 6),
        py = inspect.y - ph - 0.18 * k - (1 - a) * 6;
      CA.fillRR(ctx, px, py, pw, ph, 0.16 * k, '#fff6e8');
      ctx.fillStyle = '#fff6e8';
      ctx.beginPath();
      ctx.moveTo(inspect.x - 0.1 * k, py + ph - 1);
      ctx.lineTo(inspect.x, py + ph + 0.12 * k);
      ctx.lineTo(inspect.x + 0.1 * k, py + ph - 1);
      ctx.fill();
      ctx.textAlign = 'center';
      const cx = px + pw / 2;
      ctx.fillStyle = '#2a2448';
      ctx.font = f1;
      ctx.fillText(l1, cx, py + 0.12 * k + fs1 * 0.85);
      ctx.fillStyle = '#7f6ad8';
      ctx.font = f2;
      ctx.fillText(l2, cx, py + 0.2 * k + fs1 + fs2 * 0.85);
      ctx.fillStyle = '#6a6488';
      ctx.font = 'italic ' + f2.slice(4);
      ctx.fillText(l3, cx, py + 0.26 * k + fs1 + fs2 * 1.9);
      ctx.restore();
    }
    // P1.2 composition: the foreground ground is a field with depth instead of a pale band – the planet's props (crystal
    // pines, ice, basalt, blooms, machine parts, lamps) and pebbles spread at about one per 1.7 kitten widths, each
    // scaled and shifted by its depth (lower = nearer = larger and faster, parallax 0.12 … 0.4), with a soft contact
    // shadow. Positions are computed once per layout and size; only the props in view are drawn.
    let fgMemo = { key: '', list: [] };
    function foregroundProps(height) {
      const key = planetId + ':' + Math.round(worldW) + ':' + w + ':' + height + ':' + Math.round(groundY);
      if (fgMemo.key === key) return fgMemo.list;
      const frnd = math.seeded(math.hash('fg' + planetId)),
        depth = Math.max(4, height - groundY - 1.0 * k),
        list = [];
      for (let x = frnd() * k; x < worldW * 1.4 + w; x += (0.6 + frnd() * 0.7) * k) {
        const t = frnd(),
          i = list.length;
        list.push({ x, y: groundY + 0.95 * k + t * depth, t, s: (0.4 + 0.5 * t) * (0.75 + frnd() * 0.45) * k, prop: i % 3 === 0, i });
      }
      list.sort((p, q) => p.y - q.y);
      fgMemo = { key, list };
      return list;
    }
    function drawForeground(ctx, height, theme) {
      // drawn inside the world's translation: a prop's own parallax is the extra shift on top of the world's
      const list = foregroundProps(height),
        left = cam.x - 2 * k,
        right = cam.x + w + 2 * k,
        depth = height - groundY;
      // two soft dune bands across the foreground (a little darker than the ground, faster than the world)
      if (depth > 1.6 * k)
        for (const [f, amp, freq, alpha, par] of [[0.42, 0.22, 0.011, 0.16, 0.15], [0.72, 0.3, 0.007, 0.2, 0.32]]) {
          const base = groundY + depth * f,
            off = cam.x * par;
          ctx.fillStyle = theme.surface[1][1];
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.moveTo(cam.x - k, height);
          for (let x = cam.x - k; x <= cam.x + w + k; x += 18) ctx.lineTo(x, base - Math.sin((x + off) * freq + f * 9) * amp * k - Math.sin((x + off) * freq * 2.3) * amp * 0.4 * k);
          ctx.lineTo(cam.x + w + k, height);
          ctx.closePath();
          ctx.fill();
        }
      ctx.globalAlpha = 1;
      for (const p of list) {
        const x = p.x - cam.x * (0.12 + 0.28 * p.t);
        if (x < left || x > right) continue;
        ctx.fillStyle = 'rgba(20,16,60,0.16)';
        ctx.beginPath();
        ctx.ellipse(x, p.y + 0.02 * p.s, 0.55 * p.s, 0.12 * p.s, 0, 0, TAU);
        ctx.fill();
        if (p.prop) {
          ctx.globalAlpha = 0.85;
          if (L.decor.kind === 'machine' && window.MekhanosArt) window.MekhanosArt.prop(ctx, x, p.y, p.s, time, p.i + 40);
          else if (L.decor.kind === 'verdant' && window.ViridiaArt) window.ViridiaArt.prop(ctx, x, p.y, p.s, time, p.i + 40, Boolean(view.viridia?.bloom));
          else if (L.decor.kind === 'volcanic' && window.PyraArt) window.PyraArt.prop(ctx, x, p.y, p.s, time, p.i + 40, Boolean(view.pyra?.calm));
          else CA.prop(ctx, L.decor.kind, x, p.y, p.s, time, p.i + 40, theme);
          ctx.globalAlpha = 1;
        } else {
          // pebbles: a pair of flat stones with a light top
          ctx.fillStyle = theme.surface[0][1];
          ctx.globalAlpha = 0.55;
          ctx.beginPath();
          ctx.ellipse(x, p.y, 0.3 * p.s, 0.15 * p.s, 0, Math.PI, 0);
          ctx.ellipse(x + 0.34 * p.s, p.y, 0.17 * p.s, 0.1 * p.s, 0, Math.PI, 0);
          ctx.fill();
          ctx.globalAlpha = 0.3;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.ellipse(x - 0.05 * p.s, p.y - 0.1 * p.s, 0.14 * p.s, 0.04 * p.s, 0, 0, TAU);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
    }
    // P1.2 composition: the near frame – a few large, dark silhouettes at the bottom edge (rocks with the planet's own
    // crystals, ice, basalt, leaves or pipes) that pass faster than the world (parallax 1.3) and a soft shade under
    // them. They give the picture depth and a calm floor for the scene bar; they never reach the kittens' lane (their
    // height follows the foreground's depth).
    let nearMemo = { key: '', list: [] };
    function nearSpots() {
      const key = planetId + ':' + Math.round(worldW) + ':' + w;
      if (nearMemo.key === key) return nearMemo.list;
      const rnd = math.seeded(math.hash('near' + planetId)),
        list = [];
      for (let x = rnd() * 3 * k; x < worldW * 1.3 + w; x += (4.2 + rnd() * 3.4) * k) list.push({ x, s: 0.75 + rnd() * 0.5, flip: rnd() > 0.5 ? 1 : -1, v: Math.floor(rnd() * 3) });
      nearMemo = { key, list };
      return list;
    }
    function drawNearFrame(ctx, width, height, theme) {
      const depth = height - groundY;
      if (depth < 0.9 * k) return;
      const shade = ctx.createLinearGradient(0, groundY + depth * 0.45, 0, height);
      shade.addColorStop(0, 'rgba(12,10,40,0)');
      shade.addColorStop(1, 'rgba(12,10,40,0.38)');
      ctx.fillStyle = shade;
      ctx.fillRect(0, groundY + depth * 0.45, width, depth * 0.55 + 1);
      const size = Math.min(1.1 * k, depth * 0.26),
        dark = theme.surface[0][1],
        kind = L.decor?.kind;
      for (const n of nearSpots()) {
        const x = n.x - cam.x * 1.3;
        if (x < -2.2 * size || x > width + 2.2 * size) continue;
        const sz = size * n.s,
          y = height + 0.08 * sz;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(n.flip, 1);
        ctx.globalAlpha = 0.92;
        ctx.fillStyle = dark;
        if (kind === 'verdant') {
          // two broad leaves
          for (const [a, l] of [[-0.5, 1.5], [0.35, 1.2], [-0.05, 1.7]]) {
            ctx.save();
            ctx.rotate(a);
            ctx.beginPath();
            ctx.ellipse(0, -l * sz * 0.5, 0.28 * sz, l * sz * 0.5, 0, 0, TAU);
            ctx.fill();
            ctx.restore();
          }
        } else if (kind === 'machine') {
          // a pipe elbow with a flange and a half-buried cog
          ctx.fillRect(-1.2 * sz, -0.55 * sz, 1.5 * sz, 0.32 * sz);
          ctx.fillRect(0.1 * sz, -0.55 * sz, 0.32 * sz, 0.6 * sz);
          ctx.fillRect(-0.85 * sz, -0.66 * sz, 0.12 * sz, 0.54 * sz);
          ctx.beginPath();
          ctx.arc(0.95 * sz, 0, 0.55 * sz, Math.PI, 0);
          ctx.fill();
          for (let i = 0; i < 5; i++) {
            const a = Math.PI + (i + 0.5) * (Math.PI / 5);
            ctx.fillRect(0.95 * sz + Math.cos(a) * 0.55 * sz - 0.07 * sz, Math.sin(a) * 0.55 * sz - 0.07 * sz, 0.14 * sz, 0.14 * sz);
          }
        } else {
          // a rock with the planet's spikes (crystal, ice) or columns (basalt)
          ctx.beginPath();
          ctx.moveTo(-1.3 * sz, 0);
          ctx.quadraticCurveTo(-1.2 * sz, -0.62 * sz, -0.45 * sz, -0.7 * sz);
          ctx.quadraticCurveTo(0.2 * sz, -0.95 * sz, 0.7 * sz, -0.55 * sz);
          ctx.quadraticCurveTo(1.25 * sz, -0.3 * sz, 1.3 * sz, 0);
          ctx.closePath();
          ctx.fill();
          const spike = kind === 'volcanic' ? null : theme.accent;
          if (spike && n.v !== 2) {
            for (const [dx, hh, a] of [[-0.35, 1.25, -0.25], [0.05, 1.6, 0.05], [0.4, 1.05, 0.3]]) {
              ctx.save();
              ctx.translate(dx * sz, -0.55 * sz);
              ctx.rotate(a);
              ctx.beginPath();
              ctx.moveTo(-0.16 * sz, 0);
              ctx.lineTo(0, -hh * 0.62 * sz);
              ctx.lineTo(0.16 * sz, 0);
              ctx.closePath();
              ctx.fill();
              ctx.globalAlpha = 0.28;
              ctx.fillStyle = spike;
              ctx.beginPath();
              ctx.moveTo(-0.02 * sz, -0.05 * sz);
              ctx.lineTo(0, -hh * 0.55 * sz);
              ctx.lineTo(0.12 * sz, -0.05 * sz);
              ctx.closePath();
              ctx.fill();
              ctx.globalAlpha = 0.92;
              ctx.fillStyle = dark;
              ctx.restore();
            }
          } else if (kind === 'volcanic') {
            // a lava rock: glowing cracks in the dark stone
            ctx.save();
            ctx.globalAlpha = 0.85;
            ctx.strokeStyle = '#ff8a3a';
            ctx.lineWidth = Math.max(1.5, 0.05 * sz);
            ctx.beginPath();
            ctx.moveTo(-0.7 * sz, -0.3 * sz);
            ctx.lineTo(-0.3 * sz, -0.45 * sz);
            ctx.lineTo(-0.05 * sz, -0.25 * sz);
            ctx.moveTo(0.2 * sz, -0.6 * sz);
            ctx.lineTo(0.45 * sz, -0.35 * sz);
            ctx.stroke();
            ctx.restore();
          }
          // the rim light along the top (the sky's light)
          ctx.globalAlpha = 0.22;
          ctx.strokeStyle = theme.glow || '#ffffff';
          ctx.lineWidth = Math.max(1, 0.05 * sz);
          ctx.beginPath();
          ctx.moveTo(-1.15 * sz, -0.42 * sz);
          ctx.quadraticCurveTo(-1.0 * sz, -0.66 * sz, -0.45 * sz, -0.7 * sz);
          ctx.quadraticCurveTo(0.2 * sz, -0.95 * sz, 0.7 * sz, -0.55 * sz);
          ctx.stroke();
        }
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
    // P1.4 Living Worlds – Glacies: frost glitter on the snow (a few points that catch the light in turn, anchored to the
    // world, not the camera) and snow wisps blown along the ground; both stay low and quiet behind the kittens and the
    // goods. Reduced motion: the glitter stands still, no wisps. Low quality: none.
    function drawGlacies(ctx, width, height) {
      if (planetId !== 'ice' || !L.sky.snow || quality === 'low') return;
      const step = 2.3 * k,
        first = Math.floor(cam.x / step),
        last = first + Math.ceil(width / step) + 1;
      for (let i = first; i <= last; i++) {
        const x = i * step + ((i * 53.1) % 1) * step * 0.6,
          tw = reduced ? (i % 4 === 0 ? 0.7 : 0) : Math.max(0, Math.sin(time * 1.3 + i * 2.17) - 0.86) / 0.14;
        if (tw <= 0) continue;
        const y = groundAt(x) - 0.06 * k,
          r = 0.12 * k * tw;
        CA.glow(ctx, x, y, r * 2.2, '#dff6ff', 0.55 * tw);
        ctx.fillStyle = 'rgba(255,255,255,' + (0.9 * tw).toFixed(3) + ')';
        ctx.beginPath();
        ctx.moveTo(x, y - r * 1.6);
        ctx.lineTo(x + r * 0.3, y);
        ctx.lineTo(x, y + r * 1.6);
        ctx.lineTo(x - r * 0.3, y);
        ctx.closePath();
        ctx.moveTo(x - r * 1.6, y);
        ctx.lineTo(x, y - r * 0.3);
        ctx.lineTo(x + r * 1.6, y);
        ctx.lineTo(x, y + r * 0.3);
        ctx.closePath();
        ctx.fill();
      }
      if (reduced) return;
      for (let i = 0; i < 3; i++) {
        const span = width + 6 * k,
          x = cam.x - 3 * k + ((time * (18 + i * 7) + i * span * 0.37) % span),
          y = groundAt(x) - (0.12 + i * 0.08) * k,
          g = ctx.createLinearGradient(x - 1.6 * k, 0, x + 1.6 * k, 0);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(0.5, 'rgba(255,255,255,0.22)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(x, y, 1.6 * k, 0.09 * k, -0.04, 0, TAU);
        ctx.fill();
      }
    }
    // P1.4 Living Worlds – Pyra: the lava under the crust breathes (glowing seams on the ground, a slow wave runs through
    // them) and, rarely, a far volcano throws a little fountain of embers (every ~37 s, 2.5 s). Before the recalibration
    // red and restless, afterwards a calm gold. Reduced motion: still seams; low quality: no fountain.
    function drawPyraLava(ctx, width) {
      if (planetId !== 'volcanic' || !L.sky.embers) return;
      const calm = Boolean(view.pyra?.calm),
        step = 2.9 * k,
        first = Math.floor(cam.x / step),
        last = first + Math.ceil(width / step) + 1;
      for (let i = first; i <= last; i++) {
        const x = i * step + ((i * 71.3) % 1) * step * 0.5,
          y = groundAt(x) + 0.05 * k,
          wave = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(x * 0.03 - time * (calm ? 0.9 : 1.8)),
          len = (0.35 + ((i * 13.7) % 1) * 0.35) * k;
        ctx.strokeStyle = calm ? 'rgba(255,200,90,' + (0.25 + wave * 0.35).toFixed(3) + ')' : 'rgba(255,110,50,' + (0.35 + wave * 0.5).toFixed(3) + ')';
        ctx.lineWidth = 0.06 * k;
        ctx.beginPath();
        ctx.moveTo(x - len, y);
        ctx.lineTo(x - len * 0.3, y + 0.04 * k);
        ctx.lineTo(x + len * 0.2, y - 0.02 * k);
        ctx.lineTo(x + len, y + 0.03 * k);
        ctx.stroke();
        if (wave > 0.8) CA.glow(ctx, x, y, 0.35 * k, calm ? '#ffd25a' : '#ff7a3a', (wave - 0.8) * 1.6);
      }
      if (reduced || quality === 'low') return;
      const cycle = time % 37;
      if (cycle < 2.5) {
        // the far fountain: eight embers in an arc above the horizon (slow parallax, behind everything else here)
        const fx = cam.x + width * 0.22 - (cam.x * 0.03) % (width * 0.4),
          fy = groundY - 3.6 * k;
        for (let j = 0; j < 8; j++) {
          const u = cycle / 2.5,
            ang = -Math.PI / 2 + (j - 3.5) * 0.16,
            d = u * 1.6 * k,
            ex = fx + Math.cos(ang) * d,
            ey = fy + Math.sin(ang) * d + u * u * 1.4 * k;
          CA.glow(ctx, ex, ey, 0.09 * k, calm ? '#ffd25a' : '#ff8a3a', 1 - u);
        }
      }
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
      workerHits.length = 0;
      inspect.seen = false;
      seenCarts.length = 0;
      drawnVehicles.length = 0;
      const theme = Art.THEMES[planetId] || Art.THEMES.crystal;
      drawBackground(ctx, width, height, theme);
      ctx.save();
      ctx.translate(-Math.round(cam.x), 0);
      drawSkyTraffic(ctx);
      drawGround(ctx, height, theme);
      drawDistricts(ctx);
      drawDecor(ctx, theme);
      // P1.2: the foreground field lies in front of the ground but behind everything standing on it (labels, kittens)
      drawForeground(ctx, height, theme);
      // P1.4 Living Worlds: ground-level life behind the buildings and the kittens
      drawGlacies(ctx, width, height);
      drawPyraLava(ctx, width);
      drawHotSprings(ctx);
      drawCables(ctx);
      // the cart line runs behind the buildings (plaques and kittens stay readable in front)
      CA.beginLabels?.({ short: zoom === 'overview' });
      drawTransport(ctx, theme);
      // Living Worlds 2.0: plain building labels only in the central 70 % of the view (warnings always show)
      CA.setLabelGate?.(x => Math.abs(x - (cam.x + w / 2)) <= w * 0.35);
      drawBuildings(ctx, theme);
      stats.labels = CA.endLabels?.() || [];
      CA.setLabelGate?.(null);
      if (view.cosmeticColony === 'deco-lanterns') drawLanterns(ctx);
      drawPlanetDecor(ctx);
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
      drawNearFrame(ctx, width, height, theme);
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
        // Beta 1.7: a resize (the phone shell's dock folding, a rotation, the browser bar) keeps the part of the world the
        // player is looking at; only the very first layout starts at Mochi
        const had = sized,
          centre = (cam.x + w / 2) / Math.max(1e-6, k),
          mochiAt = mochi.x / Math.max(1e-6, k);
        w = width;
        h = height;
        sized = true;
        layout();
        if (had) {
          mochi.x = Math.min(worldW, mochiAt * k);
          cam.x = cam.target = math.clamp(centre * k - w / 2, 0, Math.max(0, worldW - w));
        }
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
      focusStation,
      get zoom() {
        return zoom;
      },
      // Test hooks
      tapWorld: handleTap,
      hitAreas: () => hits.map(r => ({ ...r })),
      // P1.2: the tappable workers (the mini inspector) and who is shown now
      workerAreas: () => workerHits.map(({ card, ...r }) => r),
      inspected: () => (inspect.id && time < inspect.until ? { id: inspect.id, card: typeof inspect.card === 'function' ? inspect.card() : inspect.card } : null),
      worldToScreen: x => x - cam.x,
      plotX,
      groundAt,
      get camera() {
        return { x: cam.x, worldW, viewW: w, target: cam.target, fling: cam.fling };
      },
      // Beta 1.9 M3: the carriers as drawn (each is one run of the economy) and the market's customers
      haulCarriers: () => (view ? haulCarriers() : []),
      customerSpots: () => (view ? customerSpots() : []),
      debug: () => ({ carts: carts.map(c => ({ pos: c.pos, loaded: c.loaded })), staff: [...staffSprites.keys()], particles: particles.active, floaters: floaters.length, helpers: helpers.length, ships: ships.length, mochiX: Math.round(mochi.x), camX: Math.round(cam.x), hits: hits.length, k: Math.round(k), groundY: Math.round(groundY), stageH: Math.round(h), stageW: Math.round(w), planet: planetId, dressed: { ...drawnWear }, zoom, vehicles: drawnVehicles.slice(), decor: decorStats.drawn, ...stats })
    };
  }

  window.NebulaScenes = window.NebulaScenes || {};
  window.NebulaScenes.createColonyScene = createColonyScene;
})();
