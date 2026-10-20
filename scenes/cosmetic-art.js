// P1.4 Cosmetics 2.0 — how the cosmetic overlays look, drawn the same way in every view (the Looks shop, the album, the
// studios, the arena, the classic fight, the reveal). One table per kind; a new look is one entry:
//   TRAILS  engine trails: the shape of the pieces the engine leaves (spark, shard, cog) and their colours
//   SHOTS   Geschoss-Spur: an ornament that follows a shot (stars, petals). The projectile itself keeps the shape of its
//           chassis and the colour of its affinity (scenes/dna-visuals.js) – a lance stays a lance
//   FRAMES  profile frames around a portrait (a ring with its own motif; legendary and mythic frames move slowly)
// Rarity is shown by design (shape, material, motion), never by more particles: every trail and ornament draws at most
// four pieces at a time. Reduced motion freezes the motion and keeps the look. Nothing here changes a value.
// Loaded after scenes/dna-visuals.js.
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const TRAILS = {
    'engine-comet': { shape: 'spark', color: '#bfe6ff', core: '#ffffff' },
    'engine-crystal': { shape: 'shard', color: '#9fe8ff', core: '#ffffff', rim: '#e8fbff' },
    'engine-clockwork': { shape: 'cog', color: '#ffd77a', core: '#fff3c4', rim: '#8a5a1a' }
  };
  const SHOTS = {
    'shot-stardust': { shape: 'star', color: '#fff3b0', glow: '#ffe28a' },
    'shot-petal': { shape: 'petal', color: '#ffb3d1', glow: '#ff8fbd', vein: '#ff6fa8' }
  };
  const FRAMES = {
    'frame-star': { ring: ['#ffe9a8', '#c9922f'], motif: 'stars', glow: null },
    'frame-aurora': { ring: ['#1d2b6e', '#0e1a44'], motif: 'aurora', glow: '#7af0e0' },
    'frame-guardian': { ring: ['#3a2466', '#1c1238'], motif: 'guardians', glow: '#ffd77a' },
    // P1.5 world-set rewards: basalt with rising sparks (Pyra), a toothed ring that ticks round (Mekhanos)
    'frame-ember': { ring: ['#4a3a4a', '#241a22'], motif: 'ember', glow: '#ff8a3a' },
    'frame-gear': { ring: ['#f0c36a', '#8a5a1a'], motif: 'gear', glow: '#ffd77a' }
  };

  function glow(ctx, x, y, r, color, a) {
    if (!(r > 0)) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = a;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  function star(ctx, x, y, r, color, rot = 0) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = rot + (i / 8) * TAU,
        d = i % 2 ? r * 0.38 : r;
      i ? ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d) : ctx.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
    }
    ctx.closePath();
    ctx.fill();
  }
  function shard(ctx, x, y, r, rot, fill, rim) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.5, 0);
    ctx.lineTo(0, r);
    ctx.lineTo(-r * 0.5, 0);
    ctx.closePath();
    ctx.fill();
    if (rim) {
      ctx.strokeStyle = rim;
      ctx.lineWidth = Math.max(0.6, r * 0.18);
      ctx.stroke();
      // the facet: a light line through the crystal
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.12, r * 0.2);
      ctx.stroke();
    }
    ctx.restore();
  }
  function cog(ctx, x, y, r, rot, fill, rim) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = fill;
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU,
        d = i % 2 ? r * 0.72 : r;
      i ? ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d) : ctx.moveTo(d, 0);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = rim || '#5a3a10';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.3, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  function petal(ctx, x, y, r, rot, fill, vein) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(-r, 0);
    ctx.quadraticCurveTo(-r * 0.2, -r * 0.7, r, 0);
    ctx.quadraticCurveTo(-r * 0.2, r * 0.7, -r, 0);
    ctx.fill();
    if (vein) {
      ctx.strokeStyle = vein;
      ctx.lineWidth = Math.max(0.5, r * 0.12);
      ctx.beginPath();
      ctx.moveTo(-r * 0.7, 0);
      ctx.lineTo(r * 0.6, 0);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * An engine trail from the engine (root) back to its tail, in screen space (turned fields too: the caller maps both
   * points). The ribbon in the look's colours, and four pieces of its shape travelling back along it.
   */
  function engineTrail(ctx, id, root, tail, size, t, reduced) {
    const look = TRAILS[id];
    if (!look) return false;
    const dx = tail.x - root.x,
      dy = tail.y - root.y,
      len = Math.hypot(dx, dy) || 1,
      nx = -dy / len,
      ny = dx / len;
    const g = ctx.createLinearGradient(root.x, root.y, tail.x, tail.y);
    g.addColorStop(0, look.color);
    g.addColorStop(0.45, look.core);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.strokeStyle = g;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = size * 0.9;
    ctx.beginPath();
    ctx.moveTo(root.x, root.y);
    ctx.lineTo(tail.x, tail.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
    for (let i = 0; i < 4; i++) {
      const q = reduced ? (i + 0.5) / 4 : (t * 1.4 + i / 4) % 1,
        wob = reduced ? 0 : Math.sin(t * 5 + i * 1.7) * size * 0.35,
        x = root.x + dx * q + nx * wob,
        y = root.y + dy * q + ny * wob,
        r = size * (0.62 - q * 0.32);
      ctx.globalAlpha = 1 - q * 0.8;
      if (look.shape === 'shard') shard(ctx, x, y, r * 1.25, (reduced ? 0.4 : t * 3 + i) % TAU, i % 2 ? look.color : look.core, look.rim);
      else if (look.shape === 'cog') cog(ctx, x, y, r, (reduced ? 0 : Math.floor(t * 8) * 0.4) + i, look.color, look.rim);
      else glow(ctx, x, y, r * 1.6, i % 2 ? look.color : look.core, 0.9 - q * 0.6);
    }
    ctx.restore();
    return true;
  }
  /** A shot's ornament: three pieces trailing behind the projectile at (x, y), flying along (dx, dy). */
  function shotTrail(ctx, id, x, y, dx, dy, size, t, reduced, seed = 0) {
    const look = SHOTS[id];
    if (!look) return;
    const len = Math.hypot(dx, dy) || 1,
      ux = dx / len,
      uy = dy / len;
    ctx.save();
    for (let i = 1; i <= 3; i++) {
      const back = size * (1.6 + i * 1.5),
        swirl = reduced ? 0 : Math.sin(t * 9 + i * 2 + seed) * size * 0.8,
        px = x - ux * back - uy * swirl,
        py = y - uy * back + ux * swirl,
        r = size * (0.95 - i * 0.18);
      ctx.globalAlpha = 1 - i * 0.22;
      if (look.shape === 'star') {
        glow(ctx, px, py, r * 2, look.glow, 0.35);
        star(ctx, px, py, r, look.color, reduced ? 0 : t * 4 + i);
      } else petal(ctx, px, py, r * 1.1, (reduced ? 0 : t * 6 + i * 1.3 + seed) % TAU, look.color, look.vein);
    }
    ctx.restore();
  }
  /** The impact look's soft halo behind a projectile (the projectile keeps its DNA colour and shape). */
  function shotHalo(ctx, color, x, y, size) {
    if (color) glow(ctx, x, y, size * 2.2, color, 0.35);
  }

  /** A profile frame around a portrait of radius r at (cx, cy). */
  function drawFrame(ctx, id, cx, cy, r, t, reduced) {
    const f = FRAMES[id];
    if (!f) return false;
    ctx.save();
    if (f.glow) glow(ctx, cx, cy, r * 1.5, f.glow, reduced ? 0.22 : 0.18 + 0.08 * Math.sin(t * 1.6));
    const ring = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    ring.addColorStop(0, f.ring[0]);
    ring.addColorStop(1, f.ring[1]);
    ctx.strokeStyle = ring;
    ctx.lineWidth = r * 0.2;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.08, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = Math.max(1, r * 0.03);
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.98, 0, TAU);
    ctx.stroke();
    if (f.motif === 'stars') for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i / 5) * TAU;
      star(ctx, cx + Math.cos(a) * r * 1.08, cy + Math.sin(a) * r * 1.08, r * 0.16, '#fff3c4', a);
    }
    else if (f.motif === 'aurora') {
      // the aurora wanders slowly round the ring: three soft bands in green, teal and violet
      const base = reduced ? 0 : t * 0.35;
      ctx.lineCap = 'round';
      [['#7af0a0', 0], ['#7af0e0', 0.9], ['#c4a3ff', 1.8]].forEach(([c, off]) => {
        ctx.strokeStyle = c;
        ctx.globalAlpha = 0.75;
        ctx.lineWidth = r * 0.11;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 1.08, base + off, base + off + 1.1);
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
      for (const a of [0.2, 1.8, 3.4, 5]) shard(ctx, cx + Math.cos(a) * r * 1.2, cy + Math.sin(a) * r * 1.2, r * 0.14, a + Math.PI / 2, '#e8fbff', '#9fe8ff');
    } else if (f.motif === 'ember') {
      // glowing cracks in the basalt ring, sparks rising from them (four at most)
      ctx.strokeStyle = '#ffb35a';
      ctx.lineWidth = Math.max(1.5, r * 0.06);
      ctx.lineJoin = 'round';
      for (const a of [0.4, 1.9, 3.3, 4.8]) {
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r * 0.99, cy + Math.sin(a) * r * 0.99);
        ctx.lineTo(cx + Math.cos(a + 0.08) * r * 1.08, cy + Math.sin(a + 0.08) * r * 1.08);
        ctx.lineTo(cx + Math.cos(a - 0.04) * r * 1.17, cy + Math.sin(a - 0.04) * r * 1.17);
        ctx.stroke();
      }
      for (let i = 0; i < 4; i++) {
        const q = reduced ? 0.4 : (t * 0.5 + i / 4) % 1,
          a = [0.4, 1.9, 3.3, 4.8][i],
          sx = cx + Math.cos(a) * r * 1.12,
          sy = cy + Math.sin(a) * r * 1.12 - q * r * 0.5;
        glow(ctx, sx, sy, r * 0.22 * (1 - q * 0.4), i % 2 ? '#ffd27a' : '#ff8a3a', 0.95 * (1 - q * 0.8));
        ctx.fillStyle = '#fff3b0';
        ctx.globalAlpha = 1 - q * 0.8;
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(1, r * 0.035), 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    } else if (f.motif === 'gear') {
      // teeth round the ring, turning one tooth at a time (a clock's tick, not a spin)
      const tick = reduced ? 0 : Math.floor(t * 2) * ((TAU / 24) * 0.5);
      ctx.fillStyle = '#f0c36a';
      for (let i = 0; i < 24; i++) {
        const a = tick + (i / 24) * TAU;
        ctx.save();
        ctx.translate(cx + Math.cos(a) * r * 1.2, cy + Math.sin(a) * r * 1.2);
        ctx.rotate(a);
        ctx.fillRect(-r * 0.05, -r * 0.06, r * 0.1, r * 0.12);
        ctx.restore();
      }
      cog(ctx, cx + r * 0.8, cy + r * 0.8, r * 0.26, -tick * 3, '#f0c36a', '#7a4a1a');
    } else if (f.motif === 'guardians') {
      // the five guardians' signs circle the picture: seal, ice shard, bell, cog, flower
      const base = reduced ? 0 : t * 0.25;
      for (let i = 0; i < 5; i++) {
        const a = base - Math.PI / 2 + (i / 5) * TAU,
          x = cx + Math.cos(a) * r * 1.1,
          y = cy + Math.sin(a) * r * 1.1,
          s = r * 0.17;
        ctx.fillStyle = '#1c1238';
        ctx.beginPath();
        ctx.arc(x, y, s * 1.35, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#ffd77a';
        ctx.lineWidth = Math.max(1, s * 0.22);
        ctx.stroke();
        if (i === 0) {
          ctx.fillStyle = '#e0565a';
          ctx.fillRect(x - s * 0.6, y - s * 0.6, s * 1.2, s * 1.2);
        } else if (i === 1) shard(ctx, x, y, s, 0, '#bff4ff', '#ffffff');
        else if (i === 2) {
          ctx.fillStyle = '#ffb35a';
          ctx.beginPath();
          ctx.moveTo(x - s * 0.7, y + s * 0.5);
          ctx.quadraticCurveTo(x - s * 0.6, y - s * 0.8, x, y - s * 0.8);
          ctx.quadraticCurveTo(x + s * 0.6, y - s * 0.8, x + s * 0.7, y + s * 0.5);
          ctx.closePath();
          ctx.fill();
        } else if (i === 3) cog(ctx, x, y, s * 0.85, a, '#c9d2ea', '#3a4a66');
        else for (let k = 0; k < 5; k++) petal(ctx, x + Math.cos((k / 5) * TAU) * s * 0.4, y + Math.sin((k / 5) * TAU) * s * 0.4, s * 0.5, (k / 5) * TAU, '#ff9ecb', null);
      }
    }
    ctx.restore();
    return true;
  }
  window.CosmeticArt = { TRAILS, SHOTS, FRAMES, engineTrail, shotTrail, shotHalo, drawFrame, star, shard, cog, petal };
})();
