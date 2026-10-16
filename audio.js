// Procedural audio (Web Audio API): UI effects and an ambient space-industrial soundscape.
// Everything is synthesized at runtime, so there are no third-party audio assets or licenses involved.
// Playback only starts after a user gesture (mobile autoplay rules) and is suspended while the app is hidden.
(function () {
  'use strict';
  const SETTINGS_KEY = 'nebula-harvest-settings';
  const DEFAULTS = { sfx: 0.7, music: 0.35, muted: false, haptics: true, reducedMotion: 'system' };

  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
      if (!saved || typeof saved !== 'object') return { ...DEFAULTS };
      const merged = { ...DEFAULTS, ...saved };
      merged.sfx = Math.min(1, Math.max(0, Number(merged.sfx) || 0));
      merged.music = Math.min(1, Math.max(0, Number(merged.music) || 0));
      merged.muted = Boolean(merged.muted);
      merged.haptics = merged.haptics !== false;
      if (!['system', 'on', 'off'].includes(merged.reducedMotion)) merged.reducedMotion = 'system';
      return merged;
    } catch {
      return { ...DEFAULTS };
    }
  }

  let settings = loadSettings();
  let ctx = null,
    master = null,
    sfxBus = null,
    musicBus = null,
    ambient = null,
    unlocked = false,
    lastPlay = {};

  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {}
  }

  function ensureContext() {
    if (ctx) return ctx;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return null;
    try {
      ctx = new AudioCtor();
    } catch {
      return null;
    }
    master = ctx.createGain();
    sfxBus = ctx.createGain();
    musicBus = ctx.createGain();
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -12;
    limiter.ratio.value = 6;
    sfxBus.connect(master);
    musicBus.connect(master);
    master.connect(limiter);
    limiter.connect(ctx.destination);
    applyVolumes();
    return ctx;
  }

  function applyVolumes() {
    if (!ctx) return;
    const now = ctx.currentTime;
    master.gain.setTargetAtTime(settings.muted ? 0 : 1, now, 0.05);
    sfxBus.gain.setTargetAtTime(settings.sfx * 0.9, now, 0.05);
    musicBus.gain.setTargetAtTime(settings.music * 0.5, now, 0.3);
    if (settings.music > 0 && !settings.muted) startAmbient();
  }

  // One enveloped oscillator voice.
  function tone({ freq = 440, to = null, type = 'sine', dur = 0.12, gain = 0.2, delay = 0, attack = 0.004, bus }) {
    const start = ctx.currentTime + delay,
      osc = ctx.createOscillator(),
      amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, start + dur);
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(amp);
    amp.connect(bus || sfxBus);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  let noiseBuffer = null;
  function noise({ dur = 0.15, gain = 0.1, freq = 1200, q = 0.8, delay = 0, type = 'bandpass', bus }) {
    if (!noiseBuffer) {
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const start = ctx.currentTime + delay,
      src = ctx.createBufferSource(),
      filter = ctx.createBiquadFilter(),
      amp = ctx.createGain();
    src.buffer = noiseBuffer;
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    amp.gain.setValueAtTime(gain, start);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(filter);
    filter.connect(amp);
    amp.connect(bus || sfxBus);
    src.start(start);
    src.stop(start + dur + 0.05);
  }

  const chord = (notes, opts) => notes.forEach((freq, i) => tone({ freq, delay: i * (opts.step || 0), ...opts }));

  const SOUNDS = {
    tap: () => tone({ freq: 880, to: 660, type: 'triangle', dur: 0.06, gain: 0.08 }),
    // Sternenkiste (beta 1): a soft lid knock and a rising sparkle arpeggio
    chest: () => {
      tone({ freq: 180, to: 120, type: 'triangle', dur: 0.08, gain: 0.1 });
      [660, 880, 1100, 1320].forEach((freq, i) => tone({ freq, to: freq * 1.02, type: 'sine', dur: 0.12, gain: 0.07, delay: 0.08 + i * 0.06 }));
    },
    // Soft bubbly "pop" for harvesting (Space Kittens sound language: round, playful, short).
    collect: () => {
      tone({ freq: 620, to: 1240, type: 'sine', dur: 0.08, gain: 0.13 });
      tone({ freq: 1500, to: 1900, type: 'sine', dur: 0.05, gain: 0.04, delay: 0.03 });
    },
    // Synthesised kitten "mew": pitch glide with vibrato through a vowel-like band-pass (no samples).
    meow: () => {
      const start = ctx.currentTime,
        osc = ctx.createOscillator(),
        vib = ctx.createOscillator(),
        vibGain = ctx.createGain(),
        formant = ctx.createBiquadFilter(),
        amp = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(620, start);
      osc.frequency.exponentialRampToValueAtTime(980, start + 0.12);
      osc.frequency.exponentialRampToValueAtTime(560, start + 0.38);
      vib.frequency.value = 9;
      vibGain.gain.value = 18;
      vib.connect(vibGain);
      vibGain.connect(osc.frequency);
      formant.type = 'bandpass';
      formant.frequency.setValueAtTime(1300, start);
      formant.frequency.linearRampToValueAtTime(1800, start + 0.12);
      formant.frequency.linearRampToValueAtTime(900, start + 0.38);
      formant.Q.value = 4;
      amp.gain.setValueAtTime(0.0001, start);
      amp.gain.exponentialRampToValueAtTime(0.16, start + 0.04);
      amp.gain.exponentialRampToValueAtTime(0.0001, start + 0.42);
      osc.connect(formant);
      formant.connect(amp);
      amp.connect(sfxBus);
      osc.start(start);
      vib.start(start);
      osc.stop(start + 0.45);
      vib.stop(start + 0.45);
    },
    crit: () => {
      chord([660, 990, 1320], { type: 'triangle', dur: 0.18, gain: 0.1, step: 0.035 });
      noise({ dur: 0.12, gain: 0.06, freq: 5200 });
    },
    upgrade: () => {
      tone({ freq: 330, to: 660, type: 'square', dur: 0.12, gain: 0.05 });
      tone({ freq: 660, to: 990, type: 'triangle', dur: 0.16, gain: 0.1, delay: 0.06 });
    },
    unlock: () => chord([523, 659, 784, 1047], { type: 'triangle', dur: 0.32, gain: 0.09, step: 0.07 }),
    research: () => {
      chord([440, 554, 659], { type: 'sine', dur: 0.4, gain: 0.09, step: 0.05 });
      tone({ freq: 1760, type: 'sine', dur: 0.5, gain: 0.03, delay: 0.15 });
    },
    reward: () => chord([784, 988, 1175, 1568], { type: 'triangle', dur: 0.22, gain: 0.08, step: 0.05 }),
    launch: () => {
      noise({ dur: 0.6, gain: 0.08, freq: 500, q: 0.5, type: 'lowpass' });
      tone({ freq: 110, to: 330, type: 'sawtooth', dur: 0.5, gain: 0.04 });
    },
    hit: () => {
      tone({ freq: 220, to: 90, type: 'square', dur: 0.08, gain: 0.06 });
      noise({ dur: 0.07, gain: 0.05, freq: 1800 });
    },
    defeat: () => {
      noise({ dur: 0.35, gain: 0.1, freq: 900, q: 0.4, type: 'lowpass' });
      chord([392, 523], { type: 'triangle', dur: 0.2, gain: 0.07, step: 0.08 });
    },
    prestige: () => {
      chord([262, 330, 392, 523, 659, 784], { type: 'sine', dur: 1.4, gain: 0.08, step: 0.12 });
      noise({ dur: 1.6, gain: 0.05, freq: 300, q: 0.3, type: 'lowpass' });
    },
    deny: () => tone({ freq: 196, to: 150, type: 'square', dur: 0.12, gain: 0.04 }),
    // Weapon voices (combat): each weapon type has its own short synthesized timbre.
    'shot-Laser': () => tone({ freq: 1800, to: 700, type: 'square', dur: 0.09, gain: 0.035 }),
    'shot-Plasma': () => {
      tone({ freq: 260, to: 520, type: 'sine', dur: 0.14, gain: 0.08 });
      noise({ dur: 0.1, gain: 0.03, freq: 900, q: 1.5 });
    },
    'shot-Arc': () => {
      noise({ dur: 0.12, gain: 0.06, freq: 3800, q: 2.5 });
      tone({ freq: 120, to: 95, type: 'sawtooth', dur: 0.1, gain: 0.03 });
    },
    'shot-Ion': () => {
      tone({ freq: 1200, to: 1600, type: 'triangle', dur: 0.05, gain: 0.05 });
      tone({ freq: 1600, to: 2100, type: 'triangle', dur: 0.05, gain: 0.04, delay: 0.05 });
    },
    'shot-Nova': () => {
      tone({ freq: 180, to: 90, type: 'sawtooth', dur: 0.22, gain: 0.05 });
      chord([660, 880], { type: 'sine', dur: 0.2, gain: 0.05, step: 0.06 });
    },
    // Deep Core: soft, friendly mining sounds (no loops while automated).
    pick: () => {
      tone({ freq: 900, to: 520, type: 'triangle', dur: 0.06, gain: 0.07 });
      noise({ dur: 0.05, gain: 0.04, freq: 3200, q: 2 });
    },
    liftGo: () => {
      tone({ freq: 180, to: 260, type: 'sine', dur: 0.35, gain: 0.06 });
      tone({ freq: 660, type: 'triangle', dur: 0.08, gain: 0.04, delay: 0.02 });
    },
    liftArrive: () => chord([523, 784], { type: 'triangle', dur: 0.16, gain: 0.07, step: 0.07 }),
    build: () => {
      noise({ dur: 0.3, gain: 0.06, freq: 700, q: 0.6, type: 'lowpass' });
      chord([392, 523, 659], { type: 'triangle', dur: 0.2, gain: 0.07, step: 0.08 });
    },
    discovery: () => {
      chord([440, 554, 659, 880], { type: 'sine', dur: 0.5, gain: 0.07, step: 0.09 });
      tone({ freq: 1760, type: 'sine', dur: 0.6, gain: 0.025, delay: 0.3 });
    },
    shield: () => {
      tone({ freq: 520, to: 480, type: 'triangle', dur: 0.12, gain: 0.05 });
      noise({ dur: 0.08, gain: 0.03, freq: 2600, q: 3 });
    },
    overcharge: () => {
      tone({ freq: 140, to: 560, type: 'sawtooth', dur: 0.45, gain: 0.04 });
      chord([523, 784], { type: 'triangle', dur: 0.2, gain: 0.06, step: 0.12, delay: 0.25 });
    },
    open: () => tone({ freq: 600, to: 900, type: 'sine', dur: 0.1, gain: 0.05 }),
    // Mekhanos (session 9): a soft two-step clockwork "tick-tock" when Cogsworth's inspection window opens,
    // and a round approval stamp (thump + bright click) for the repair and his friendly greetings.
    tick: () => {
      tone({ freq: 1800, to: 1600, type: 'square', dur: 0.025, gain: 0.03 });
      tone({ freq: 1300, to: 1150, type: 'square', dur: 0.025, gain: 0.03, delay: 0.16 });
      tone({ freq: 880, to: 990, type: 'triangle', dur: 0.12, gain: 0.05, delay: 0.32 });
    },
    stamp: () => {
      tone({ freq: 140, to: 70, type: 'sine', dur: 0.14, gain: 0.16 });
      tone({ freq: 2200, to: 1800, type: 'triangle', dur: 0.04, gain: 0.05, delay: 0.05 });
    }
  };

  function play(name) {
    if (!unlocked || settings.muted || settings.sfx <= 0 || document.hidden) return;
    if (!ensureContext() || !SOUNDS[name]) return;
    const now = performance.now();
    if (now - (lastPlay[name] || 0) < (name === 'meow' ? 4000 : name === 'tick' || name === 'stamp' ? 600 : 45)) return; // avoid stacking during rapid taps
    lastPlay[name] = now;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    try {
      SOUNDS[name]();
    } catch {}
  }

  // Ambient bed: detuned low drones through a slowly breathing low-pass filter, plus sparse pentatonic chimes.
  function startAmbient() {
    if (ambient || !unlocked || !ensureContext()) return;
    const filter = ctx.createBiquadFilter(),
      lfo = ctx.createOscillator(),
      lfoGain = ctx.createGain(),
      bed = ctx.createGain();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    filter.Q.value = 2;
    lfo.frequency.value = 0.05;
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    bed.gain.value = 0.0001;
    bed.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 4);
    const voices = [55, 55.4, 82.4, 110.2].map((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = i < 2 ? 'sawtooth' : 'triangle';
      osc.frequency.value = freq;
      osc.connect(filter);
      osc.start();
      return osc;
    });
    filter.connect(bed);
    bed.connect(musicBus);
    lfo.start();
    const scale = [261.6, 293.7, 329.6, 392, 440, 523.3, 587.3];
    let chimeTimer = null;
    const chime = () => {
      if (!document.hidden && ctx.state === 'running') {
        const base = scale[Math.floor(Math.random() * scale.length)];
        tone({ freq: base * 2, type: 'sine', dur: 2.4, gain: 0.05, attack: 0.3, bus: musicBus });
        tone({ freq: base * 3, type: 'sine', dur: 2, gain: 0.02, attack: 0.4, delay: 0.25, bus: musicBus });
      }
      chimeTimer = setTimeout(chime, 7000 + Math.random() * 9000);
    };
    chimeTimer = setTimeout(chime, 3000);
    ambient = { voices, lfo, bed, stop: () => clearTimeout(chimeTimer) };
  }

  function unlock() {
    if (unlocked) return;
    unlocked = true;
    if (!ensureContext()) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    applyVolumes();
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(type =>
    window.addEventListener(type, unlock, { once: true, capture: true, passive: true })
  );
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(() => {});
    else if (unlocked) ctx.resume().catch(() => {});
  });

  function applyMotionPreference() {
    const root = document.documentElement,
      systemReduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    root.classList.toggle(
      'reduce-motion',
      settings.reducedMotion === 'on' || (settings.reducedMotion === 'system' && Boolean(systemReduce))
    );
  }
  applyMotionPreference();

  window.NebulaAudio = {
    play,
    get settings() {
      return { ...settings };
    },
    update(patch) {
      settings = { ...settings, ...patch };
      saveSettings();
      applyVolumes();
      applyMotionPreference();
    }
  };
})();
