// Planet layouts (data only): where each structure stands, how the terrain is shaped, which decor and residents
// belong to a world. Positions and heights are in kitten units (k ≈ kitten height in px), so the same layout scales
// from 320 px phones to tablets. Planets without an own layout use the Orion layout with their theme colours.
(function () {
  'use strict';
  const LAYOUTS = {
    // Orion — Kristallfeld: open crystal plain. Living Worlds 2.0: five districts left → right with room between them —
    // the mining outpost (mine + headframe + helpers' quarters), logistics (rail control + depot), the refinery, the
    // market and the spaceport (freight dock, the orbital lift as its landmark at the far end). The cart line runs from
    // the mine to the depot, so material visibly flows from extraction into storage.
    crystal: {
      // Beta 1.7 M5: the Sternenharz drill station stands beyond the orbital lift, next to the spaceport it fuels
      width: 66,
      plots: { hut: 3.6, mine: 10.4, rail: 20.2, depot: 25.6, refinery: 33, stall: 40.6, dock: 48.4, elevator: 56, resinDrill: 62.4 },
      // the cart line starts under the headframe (Förderturm) right of the pile: the mine's output visibly leaves on it
      track: { from: 'mine', fromOffset: 4.6, to: 'depot', toOffset: -2.6 },
      headframe: 5.2,
      mochi: { plot: 'mine', offset: 1.5 },
      // terrain: [x, dy] control points in k units (dy > 0 = lower); platforms are flat raised pads under buildings
      terrain: [[0, 0.1], [4, -0.05], [10, 0.08], [17, 0], [24, 0.08], [30, -0.04], [37, 0.06], [44, -0.08], [52, -0.12], [60, 0.04], [66, 0.1]],
      platforms: [{ from: 45.4, to: 59.2, dy: -0.18, style: 'pad' }],
      paths: [[2, 46]],
      poles: [7, 18.2, 29.6, 37, 44.6],
      decor: { kind: 'crystals', density: 16 },
      skyline: 'domes',
      residents: [{ plot: 'stall', offset: 2.2 }, { plot: 'dock', offset: -2.6 }],
      // districts: ground zones + a signpost each, and the district jumps of the colony card (scene/district-nav)
      districts: [
        { id: 'mining', name: 'Bergbau', icon: '⛏', from: 0.6, to: 17.9, color: '#ffcf8f' },
        { id: 'logistics', name: 'Logistik', icon: '⇄', from: 17.9, to: 29.4, color: '#8fe3ff' },
        { id: 'industry', name: 'Raffinerie', icon: '⚙', from: 29.4, to: 36.9, color: '#c4a3ff' },
        { id: 'trade', name: 'Markt', icon: '◈', from: 36.9, to: 44.6, color: '#ffd77a' },
        { id: 'spaceport', name: 'Raumhafen', icon: '🚀', from: 44.6, to: 65.6, color: '#8ff0d4' }
      ],
      sky: { planet: [0.78, 0.2], aurora: false, snow: false }
    },
    // Glacies Niva — frozen crystal shelf: landing pad on the ice shelf (left), the settlement climbs to a frost cliff
    // where the Frostquarz drill sits; the mine hides in an ice cavern in the middle.
    ice: {
      width: 59,
      plots: { dock: 3.8, stall: 9.6, depot: 15, refinery: 20.6, thermal: 26.2, rail: 30.4, mine: 37.6, hut: 43.6, frostDrill: 50, elevator: 55.6 },
      // carts run right → left from the cavern to the depot
      track: { from: 'mine', fromOffset: -3.7, to: 'depot', toOffset: 2.6 },
      // Beta 1.6: the headframe stands outside the ice cavern (half-width 2.4), right where the cart line starts
      headframe: 3.8,
      mochi: { plot: 'mine', offset: -1.5 },
      terrain: [[0, 0.05], [6, 0.1], [12, 0], [18, 0.12], [24, 0.05], [30, -0.05], [38, -0.12], [44, -0.3], [52, -0.55], [59, -0.4]],
      platforms: [
        { from: 0.6, to: 7.2, dy: 0.05, style: 'iceshelf' },
        { from: 47.2, to: 53, dy: -0.8, style: 'cliff' }
      ],
      paths: [[6, 46]],
      poles: [6.8, 12.4, 18, 23.6, 40.6, 46.6],
      decor: { kind: 'ice', density: 16 },
      skyline: 'icicles',
      cavern: { plot: 'mine' },
      districts: [
        { id: 'spaceport', name: 'Eishafen', icon: '🚀', from: 0.6, to: 7, color: '#8ff0d4' },
        { id: 'trade', name: 'Frostmarkt', icon: '◈', from: 7, to: 12.3, color: '#ffd77a' },
        { id: 'logistics', name: 'Eislager', icon: '⇄', from: 12.3, to: 17.8, color: '#8fe3ff' },
        { id: 'industry', name: 'Wärmewerk', icon: '♨', from: 17.8, to: 28.4, color: '#c4a3ff' },
        { id: 'mining', name: 'Eisminen', icon: '⛏', from: 28.4, to: 53, color: '#ffcf8f' }
      ],

      residents: [{ plot: 'hut', offset: -2.6 }, { plot: 'hut', offset: 2.6 }, { plot: 'stall', offset: 2.6 }],
      sky: { planet: [0.2, 0.18], aurora: true, snow: true }
    },
    // Pyra-9 — volcanic industry: landing dock on a basalt shelf (left), habitation, a magma channel under a walkway,
    // the processing district (refinery + Glutschmelze), the cooling district (cooling tower + Basaltlager), and the
    // mining district on a raised basalt cliff; distant volcanoes. Carts run right → left from the mine to the depot.
    volcanic: {
      width: 61,
      plots: { dock: 4, hut: 10.4, stall: 15.6, refinery: 22.4, foundry: 28.6, depot: 38.6, rail: 43.4, mine: 49.2, elevator: 57 },
      track: { from: 'mine', fromOffset: -3.7, to: 'depot', toOffset: 2.6 },
      mochi: { plot: 'mine', offset: -1.5 },
      terrain: [[0, 0.05], [6, 0.12], [12, 0], [18, 0.1], [24, 0.04], [30, 0], [36, -0.05], [42, -0.12], [46, -0.4], [53, -0.5], [61, -0.3]],
      platforms: [
        { from: 0.6, to: 7.6, dy: 0.02, style: 'pad' },
        { from: 46.2, to: 52.4, dy: -0.75, style: 'cliff' }
      ],
      paths: [[6, 46]],
      poles: [7.4, 13.2, 25.2, 41],
      decor: { kind: 'volcanic', density: 16 },
      skyline: 'volcanoes',
      lava: { from: 18.4, to: 19.9 },
      districts: [
        { id: 'spaceport', name: 'Basalthafen', icon: '🚀', from: 0.6, to: 7.4, color: '#8ff0d4' },
        { id: 'trade', name: 'Glutmarkt', icon: '◈', from: 7.4, to: 18.6, color: '#ffd77a' },
        { id: 'industry', name: 'Glutwerk', icon: '🔥', from: 18.6, to: 34.4, color: '#c4a3ff' },
        { id: 'logistics', name: 'Logistik', icon: '⇄', from: 34.4, to: 45.6, color: '#8fe3ff' },
        { id: 'mining', name: 'Bergbau', icon: '⛏', from: 45.6, to: 53.6, color: '#ffcf8f' }
      ],

      landmarks: [{ kind: 'coolingTower', x: 34.2 }, { kind: 'vent', x: 8.2 }, { kind: 'vent', x: 32 }, { kind: 'vent', x: 45.2 }],
      residents: [{ plot: 'hut', offset: -2.6 }, { plot: 'hut', offset: 2.6 }],
      sky: { planet: [0.82, 0.16], aurora: false, snow: false, embers: true }
    },
    // Mekhanos — reawakening clockwork colony: landing pad (left), habitation, market, the Präzisionswerkstatt next to
    // a gear tower, refinery and storage linked by a brass pipe bridge, and the mining district (Mechanische Ader)
    // on a raised steel deck; a factory skyline behind. Carts run right → left from the mine to the depot.
    machine: {
      width: 61,
      plots: { dock: 4, hut: 10.4, stall: 15.6, workshop: 23.4, refinery: 31.2, depot: 37.8, rail: 42.6, mine: 48.4, elevator: 56.6 },
      track: { from: 'mine', fromOffset: -3.7, to: 'depot', toOffset: 2.6 },
      mochi: { plot: 'mine', offset: -1.5 },
      terrain: [[0, 0.05], [6, 0.1], [12, 0.02], [18, 0.08], [24, 0], [30, 0.04], [36, -0.04], [42, -0.1], [46, -0.35], [53, -0.4], [61, -0.25]],
      platforms: [
        { from: 0.6, to: 7.6, dy: 0.02, style: 'pad' },
        { from: 45.4, to: 51.6, dy: -0.6, style: 'cliff' }
      ],
      paths: [[6, 45]],
      poles: [7.4, 13.2, 28.4, 40.2],
      decor: { kind: 'machine', density: 14 },
      skyline: 'factories',
      districts: [
        { id: 'spaceport', name: 'Landeplatz', icon: '🚀', from: 0.6, to: 7.4, color: '#8ff0d4' },
        { id: 'trade', name: 'Markt', icon: '◈', from: 7.4, to: 18.8, color: '#ffd77a' },
        { id: 'industry', name: 'Werkstätten', icon: '⚙', from: 18.8, to: 34.8, color: '#c4a3ff' },
        { id: 'logistics', name: 'Logistik', icon: '⇄', from: 34.8, to: 45.2, color: '#8fe3ff' },
        { id: 'mining', name: 'Mechanische Ader', icon: '⛏', from: 45.2, to: 52.8, color: '#ffcf8f' }
      ],

      ground: ['#7f88ae', '#3a4264'],
      landmarks: [{ kind: 'gearTower', x: 19.2 }, { kind: 'pipeBridge', x: 33.9, to: 35.3 }, { kind: 'bot', x: 8.2 }, { kind: 'bot', x: 28.2 }, { kind: 'gearTower', x: 52.9 }],
      residents: [{ plot: 'hut', offset: -2.6 }, { plot: 'hut', offset: 2.6 }, { plot: 'stall', offset: 2.4 }],
      sky: { planet: [0.8, 0.17], aurora: false, snow: false }
    },
    // Viridia Bloom — overgrown bio-world: landing pad in a clearing (left), habitation and the Blütenmarkt, the
    // Uralter Wurzelknoten in the middle (its roots reach the stages they feed), Sporengarten and Biolabor, refinery and
    // the Wurzellager, the mine at a root-covered rise; giant flowers behind. Carts run right → left to the depot.
    verdant: {
      width: 63,
      plots: { dock: 4, hut: 9.8, stall: 14.8, sporeGarden: 25.4, biolab: 31.4, refinery: 37.2, depot: 42.4, rail: 46.8, mine: 52.4, elevator: 59.4 },
      rootNode: 20.1,
      track: { from: 'mine', fromOffset: -3.7, to: 'depot', toOffset: 2.6 },
      mochi: { plot: 'mine', offset: -1.5 },
      terrain: [[0, 0.08], [6, 0.02], [12, 0.12], [20, -0.05], [26, 0.06], [32, 0], [38, 0.08], [44, -0.04], [49, -0.3], [56, -0.35], [63, -0.15]],
      platforms: [
        { from: 0.6, to: 7.6, dy: 0.04, style: 'pad' },
        { from: 49.4, to: 55.6, dy: -0.5, style: 'cliff' }
      ],
      paths: [[6, 49]],
      poles: [7.4, 12.4, 28.4, 40],
      decor: { kind: 'verdant', density: 16 },
      skyline: 'blooms',
      districts: [
        { id: 'spaceport', name: 'Lichtung', icon: '🚀', from: 0.6, to: 7.2, color: '#8ff0d4' },
        { id: 'trade', name: 'Blütenmarkt', icon: '◈', from: 7.2, to: 17.6, color: '#ffd77a' },
        { id: 'industry', name: 'Biofarm', icon: '✿', from: 17.6, to: 40, color: '#c4a3ff' },
        { id: 'logistics', name: 'Wurzellager', icon: '⇄', from: 40, to: 49.4, color: '#8fe3ff' },
        { id: 'mining', name: 'Wurzelmine', icon: '⛏', from: 49.4, to: 56, color: '#ffcf8f' }
      ],

      ground: ['#3f9a7e', '#1e5a52'],
      residents: [{ plot: 'hut', offset: -2.6 }, { plot: 'hut', offset: 2.6 }, { plot: 'stall', offset: 2.2 }],
      sky: { planet: [0.78, 0.16], aurora: true, snow: false }
    }
  };
  // Beta 1.8 A2: a compact colony. The layouts above were drawn with wide gaps (Orion: 66 kitten widths, 11–13 phone
  // screens; every station a screen of its own, measured with tools/nav-probe.mjs). Each gap between two neighbouring
  // structures now shrinks to GAP_KEEP of its width, but never below what the structures need (MIN_GAP, the mine site
  // with its headframe and cart start needs more, the spaceport pad too). Everything between the structures – terrain,
  // platforms, paths, poles, districts, landmarks, lava, the root node – is mapped piecewise-linearly with them, so the
  // world keeps its shape, only shorter. The economy never reads these distances (scenes only).
  const GAP_KEEP = 0.6,
    MIN_GAP = 5,
    MIN_GAP_AT = { mine: 6.8, dock: 5.8, elevator: 5.6 },
    TAIL_MIN = 3.4;
  function compact(L) {
    const names = Object.keys(L.plots).sort((a, b) => L.plots[a] - L.plots[b]),
      oldX = names.map(n => L.plots[n]),
      newX = [];
    oldX.forEach((x, i) => {
      if (!i) return newX.push(x);
      const need = Math.max(MIN_GAP, MIN_GAP_AT[names[i]] || 0, MIN_GAP_AT[names[i - 1]] || 0);
      newX.push(newX[i - 1] + Math.max(need, (x - oldX[i - 1]) * GAP_KEEP));
    });
    const width = newX[newX.length - 1] + Math.max(TAIL_MIN, (L.width - oldX[oldX.length - 1]) * 0.8),
      from = [0, ...oldX, L.width],
      to = [0, ...newX, width];
    const map = x => {
      if (x <= 0) return x;
      for (let i = 1; i < from.length; i++)
        if (x <= from[i]) return to[i - 1] + ((x - from[i - 1]) / Math.max(1e-6, from[i] - from[i - 1])) * (to[i] - to[i - 1]);
      return width + (x - L.width);
    };
    const m2 = r => ({ ...r, from: map(r.from), to: map(r.to) });
    return {
      ...L,
      width,
      wideWidth: L.width,
      plots: Object.fromEntries(names.map((n, i) => [n, Math.round(newX[i] * 100) / 100])),
      terrain: L.terrain.map(([x, dy]) => [map(x), dy]),
      platforms: L.platforms?.map(m2),
      paths: L.paths?.map(([a, b]) => [map(a), map(b)]),
      poles: L.poles?.map(map),
      districts: L.districts?.map(m2),
      lava: L.lava ? m2(L.lava) : L.lava,
      landmarks: L.landmarks?.map(l => ({ ...l, x: map(l.x), ...(l.to !== undefined ? { to: map(l.to) } : {}) })),
      rootNode: L.rootNode !== undefined ? map(L.rootNode) : L.rootNode
    };
  }
  for (const id of Object.keys(LAYOUTS)) LAYOUTS[id] = compact(LAYOUTS[id]);
  // Glacies-only structures (other planets never show them).
  const SPECIAL_PLOTS = { ice: ['frostDrill', 'thermal'], volcanic: ['foundry'], machine: ['workshop'], verdant: ['sporeGarden', 'biolab'] };
  function layoutFor(planetId) {
    return LAYOUTS[planetId] || LAYOUTS.crystal;
  }
  // Smooth terrain offset (k units) at world position xk (k units).
  // Called thousands of times per frame (ground, every figure): indexed loops only — the former array destructuring
  // and for…of created iterator objects on every call (the largest allocation source of the colony scene, Beta 1.4 M0).
  function terrainOffset(layout, xk) {
    const pts = layout.terrain;
    let dy = pts[pts.length - 1][1];
    for (let i = 1; i < pts.length; i++) {
      const b = pts[i];
      if (xk <= b[0]) {
        const a = pts[i - 1],
          t = Math.max(0, Math.min(1, (xk - a[0]) / Math.max(1e-6, b[0] - a[0])));
        dy = a[1] + (b[1] - a[1]) * (0.5 - Math.cos(t * Math.PI) / 2);
        break;
      }
    }
    const plats = layout.platforms;
    if (plats)
      for (let i = 0; i < plats.length; i++) {
        const p = plats[i];
        if (xk >= p.from && xk <= p.to) {
          const edge = Math.min(xk - p.from, p.to - xk);
          dy = edge >= 0.5 ? p.dy : dy + (p.dy - dy) * (edge / 0.5);
        }
      }
    return dy;
  }
  window.PlanetLayouts = { LAYOUTS, SPECIAL_PLOTS, layoutFor, terrainOffset };
})();
