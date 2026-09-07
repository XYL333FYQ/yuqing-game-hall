// Procedural sample bank.
//
// The shipped asset set has no bullet impacts, no ricochets, no shell casings,
// no per-surface footsteps and no weapon-foley layers — the exact things that
// make a shooter read as "AAA". These are synthesised once into AudioBuffers
// with OfflineAudioContext at start-up, so at play time they are ordinary
// one-shot buffer sources: no node churn, no per-event synth graphs.
//
// (These were intended to come from ElevenLabs; the configured API key is
// rejected with 401 invalid_api_key, so everything here is generated locally.)

const TAU = Math.PI * 2;

function rng(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a ^= a << 13; a >>>= 0;
    a ^= a >> 17;
    a ^= a << 5; a >>>= 0;
    return a / 4294967296;
  };
}

// Shared white-noise source data, re-wrapped per offline context.
let NOISE_DATA = null;
function noiseBuffer(ctx, seconds = 2) {
  const n = Math.ceil(ctx.sampleRate * seconds);
  if (!NOISE_DATA || NOISE_DATA.length < n) {
    NOISE_DATA = new Float32Array(n);
    const r = rng(0xc0ffee);
    for (let i = 0; i < n; i++) NOISE_DATA[i] = r() * 2 - 1;
  }
  const b = ctx.createBuffer(1, n, ctx.sampleRate);
  b.copyToChannel(NOISE_DATA.subarray(0, n), 0);
  return b;
}

/** Tiny scheduling helper handed to every recipe. */
function makeKit(ctx, dest, seed) {
  const nb = noiseBuffer(ctx, Math.max(2, ctx.length / ctx.sampleRate));
  const r = rng(seed);
  const env = (g, t, vol, at, dur, hold = 0) => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(Math.max(0.0002, vol), t + at);
    if (hold > 0) g.gain.setValueAtTime(Math.max(0.0002, vol), t + at + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + at + hold + Math.max(0.005, dur));
  };
  return {
    ctx, dest, rnd: r,
    rand: (a, b) => a + r() * (b - a),
    noise({ when = 0, dur = 0.15, vol = 0.5, type = 'lowpass', freq = 1200, freqEnd = null, q = 0.7, at = 0.001, rate = 1, hold = 0, to = null } = {}) {
      const t = when;
      const s = ctx.createBufferSource(); s.buffer = nb; s.loop = true; s.playbackRate.value = rate;
      s.loopStart = r() * 1.5; s.loopEnd = s.loopStart + 0.4;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
      if (freqEnd !== null) f.frequency.exponentialRampToValueAtTime(Math.max(30, freqEnd), t + at + hold + dur);
      const g = ctx.createGain(); env(g, t, vol, at, dur, hold);
      s.connect(f); f.connect(g); g.connect(to || dest);
      s.start(t); s.stop(t + at + hold + dur + 0.05);
      return g;
    },
    tone({ when = 0, dur = 0.15, vol = 0.4, type = 'sine', freq = 440, freqEnd = null, at = 0.002, hold = 0, to = null } = {}) {
      const t = when;
      const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
      if (freqEnd !== null) o.frequency.exponentialRampToValueAtTime(Math.max(15, freqEnd), t + at + hold + dur);
      const g = ctx.createGain(); env(g, t, vol, at, dur, hold);
      o.connect(g); g.connect(to || dest);
      o.start(t); o.stop(t + at + hold + dur + 0.05);
      return g;
    },
    /** A resonant ring — the metallic/woody body of an impact. */
    ring({ when = 0, freq = 900, vol = 0.2, dur = 0.4, q = 24 } = {}) {
      const t = when;
      const s = ctx.createBufferSource(); s.buffer = nb; s.loop = true; s.playbackRate.value = 1;
      s.loopStart = r() * 1.5; s.loopEnd = s.loopStart + 0.2;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); env(g, t, vol, 0.001, dur);
      s.connect(f); f.connect(g); g.connect(dest);
      s.start(t); s.stop(t + dur + 0.05);
    },
  };
}

// ---------------------------------------------------------------------------
// Recipes: name -> { dur, build(kit, variantIndex) }
// ---------------------------------------------------------------------------

const impactRecipes = {
  concrete: (k, v) => {
    k.noise({ dur: 0.055, vol: 0.9, type: 'lowpass', freq: k.rand(1500, 2400), freqEnd: 380, at: 0.0006 });
    k.noise({ dur: 0.02, vol: 0.55, type: 'highpass', freq: 4200 + v * 500, at: 0.0004 });
    k.tone({ dur: 0.05, vol: 0.4, type: 'triangle', freq: k.rand(150, 210), freqEnd: 70 });
    // grit / dust settling
    k.noise({ when: 0.03, dur: 0.16, vol: 0.1, type: 'bandpass', freq: 3400, q: 1.1, at: 0.01 });
  },
  metal: (k, v) => {
    k.noise({ dur: 0.03, vol: 0.75, type: 'bandpass', freq: 3200, q: 0.8, at: 0.0004 });
    const base = [1650, 2100, 2680][v % 3] * k.rand(0.94, 1.06);
    k.ring({ freq: base, vol: 0.3, dur: 0.42, q: 30 });
    k.ring({ freq: base * 1.87, vol: 0.16, dur: 0.3, q: 34 });
    k.ring({ freq: base * 2.94, vol: 0.09, dur: 0.22, q: 38 });
    k.tone({ dur: 0.04, vol: 0.25, type: 'triangle', freq: 260, freqEnd: 110 });
  },
  wood: (k, v) => {
    k.noise({ dur: 0.05, vol: 0.7, type: 'lowpass', freq: 1100, freqEnd: 300, at: 0.0006 });
    k.ring({ freq: [420, 530, 610][v % 3], vol: 0.22, dur: 0.18, q: 12 });
    k.ring({ freq: [900, 1120, 1310][v % 3], vol: 0.12, dur: 0.1, q: 14 });
    k.tone({ dur: 0.07, vol: 0.28, type: 'triangle', freq: 180, freqEnd: 90 });
    k.noise({ when: 0.015, dur: 0.09, vol: 0.14, type: 'bandpass', freq: 2600, q: 1.4, at: 0.004 }); // splinters
  },
  dirt: (k) => {
    k.noise({ dur: 0.09, vol: 0.75, type: 'lowpass', freq: k.rand(520, 760), freqEnd: 180, at: 0.002 });
    k.tone({ dur: 0.08, vol: 0.3, type: 'sine', freq: 110, freqEnd: 55 });
    k.noise({ when: 0.04, dur: 0.22, vol: 0.09, type: 'bandpass', freq: 1500, q: 0.8, at: 0.02 }); // scatter
  },
  flesh: (k) => {
    k.noise({ dur: 0.075, vol: 0.8, type: 'lowpass', freq: k.rand(600, 880), freqEnd: 200, at: 0.0015 });
    k.tone({ dur: 0.1, vol: 0.42, type: 'triangle', freq: k.rand(120, 165), freqEnd: 52 });
    k.noise({ when: 0.012, dur: 0.13, vol: 0.2, type: 'bandpass', freq: 1450, q: 0.9, at: 0.006, rate: 0.7 }); // wet
  },
  glass: (k, v) => {
    k.noise({ dur: 0.03, vol: 0.55, type: 'highpass', freq: 5000, at: 0.0004 });
    const parts = [[3200, 0.2], [4300, 0.16], [5600, 0.12], [7100, 0.08], [8800, 0.05]];
    parts.forEach(([f, g], i) => k.ring({ when: i * 0.006 + v * 0.002, freq: f * k.rand(0.96, 1.05), vol: g, dur: 0.3 - i * 0.04, q: 40 }));
    k.noise({ when: 0.05, dur: 0.35, vol: 0.13, type: 'highpass', freq: 3800, at: 0.02 }); // shards falling
  },
};

const RECIPES = {};

// `loopFade` (seconds) post-processes the rendered buffer by crossfading its
// tail back over its head, which makes a noise bed loop without a seam click.
function reg(name, dur, build, loopFade = 0, peak = 0.85) { RECIPES[name] = { dur, build, loopFade, peak }; }

// --- bullet impacts, 3 variants per surface --------------------------------
for (const [surface, fn] of Object.entries(impactRecipes)) {
  for (let v = 1; v <= 3; v++) reg(`impact_${surface}${v}`, 0.55, (k) => fn(k, v - 1));
}

// --- ricochets --------------------------------------------------------------
for (let v = 1; v <= 3; v++) {
  reg(`ricochet${v}`, 0.7, (k) => {
    k.noise({ dur: 0.025, vol: 0.6, type: 'bandpass', freq: 2800, q: 0.7, at: 0.0005 });
    const f0 = [2600, 3400, 1900][v - 1] * k.rand(0.9, 1.1);
    const dir = v === 3 ? 2.4 : 0.32; // one sweeps up, the rest fall away
    k.tone({ dur: 0.34, vol: 0.2, type: 'sine', freq: f0, freqEnd: f0 * dir, at: 0.004 });
    k.tone({ when: 0.01, dur: 0.28, vol: 0.1, type: 'sine', freq: f0 * 1.5, freqEnd: f0 * 1.5 * dir, at: 0.006 });
    k.noise({ when: 0.005, dur: 0.3, vol: 0.09, type: 'bandpass', freq: f0, freqEnd: f0 * dir, q: 6, at: 0.008 });
  });
}

// --- bullet whiz-by ---------------------------------------------------------
for (let v = 1; v <= 3; v++) {
  reg(`whizby${v}`, 0.4, (k) => {
    const f = [1800, 2400, 1300][v - 1];
    // fast doppler: rises into the listener, falls away hard
    k.noise({ dur: 0.06, vol: 0.5, type: 'bandpass', freq: f * 0.55, freqEnd: f * 1.6, q: 3.2, at: 0.03 });
    k.noise({ when: 0.06, dur: 0.13, vol: 0.42, type: 'bandpass', freq: f * 1.6, freqEnd: f * 0.4, q: 2.6, at: 0.004 });
    k.tone({ when: 0.04, dur: 0.12, vol: 0.09, type: 'sine', freq: f * 1.4, freqEnd: f * 0.45, at: 0.01 });
  });
}

// --- shell casings ----------------------------------------------------------
// A cartridge case hitting the floor is a CLATTER, not a note.
//
// The version this replaces rang two Q=34/Q=40 bandpasses at 3.9-6.4 kHz for
// 260 ms per bounce and spread three or four bounces EVENLY over 0.85 s. Two
// narrow, long, near-harmonic (1 : 1.63) resonances at that height is the
// recipe for a struck bell, and because the whole thing is scheduled 0.3-0.5 s
// behind the shot it landed in the gap where nothing masked it. Players heard a
// chime after every round.
//
// What a real case does: a hard broadband contact transient (the noise below
// carries most of the energy), a couple of SHORT resonances at deliberately
// non-integer ratios so no pitch can form, and a bounce train whose level and
// whose interval both decay geometrically — a coefficient of restitution — so
// it ends in a fast rattle instead of an even, musical pulse.
const CASING_KINDS = {
  // .45 ACP / 9x19 / .30 Carbine: small, thin-walled, bright, dies fast
  pistol: { f0: 3050, ratios: [1, 1.57, 2.29], ring: 0.019, n: 5, t0: 0.058, e: 0.62, low: 0.00 },
  // 7.92x57 / .30-06: longer and heavier, so lower and a touch more sustained
  rifle: { f0: 2000, ratios: [1, 1.63, 2.41], ring: 0.024, n: 5, t0: 0.072, e: 0.64, low: 0.12 },
  // 12-gauge hull: a plastic tube with a brass head. It thuds and stops.
  shell: { f0: 2450, ratios: [1, 1.71], ring: 0.011, n: 3, t0: 0.086, e: 0.55, low: 0.40 },
  // belt gun: the case AND its disintegrating link, so more contacts, brighter
  link: { f0: 3850, ratios: [1, 1.49, 2.17], ring: 0.015, n: 6, t0: 0.047, e: 0.60, low: 0.00 },
};
function casing(k, kind, metal, v) {
  const s = CASING_KINDS[kind];
  const det = [0.94, 1.0, 1.07][v];             // per-variant size within the kind
  let t = 0, gap = s.t0 * k.rand(0.92, 1.08), g = 1;
  for (let i = 0; i < s.n; i++) {
    // Contact transient: a few ms of noise, and the loudest thing here. Band
    // limited, though — unfiltered white noise puts the spectral centroid up at
    // 8 kHz and hisses instead of clinking. `to` chains it through a low-pass so
    // the top end goes with it.
    const lp = k.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = metal ? 10500 : 8000; lp.Q.value = 0.7;
    lp.connect(k.dest);
    k.noise({ when: t, dur: 0.005, vol: 0.62 * g, type: 'highpass', freq: metal ? 3000 : 2200, at: 0.0002, to: lp });
    k.noise({ when: t, dur: 0.013, vol: 0.30 * g, type: 'bandpass', freq: metal ? 2500 : 1450, q: 0.7, at: 0.0004 });
    if (s.low > 0) {
      k.noise({ when: t, dur: 0.026, vol: s.low * g, type: 'lowpass', freq: 540, freqEnd: 220, at: 0.0006 });
    }
    // Narrowband NOISE resonances (Q 8-15), not oscillators: they read as a
    // struck body without ever settling on a frequency you could hum.
    s.ratios.forEach((r, j) => {
      k.ring({
        when: t, freq: s.f0 * r * det * k.rand(0.96, 1.05),
        vol: (0.17 / (1 + j * 1.2)) * g,
        dur: s.ring * (metal ? 1.35 : 1) / (1 + j * 0.7),
        q: 11 - j * 2.5,
      });
    });
    if (metal) {
      // steel grating answers each contact with a very short, dull plate note
      k.ring({ when: t, freq: 640 * det * k.rand(0.9, 1.12), vol: 0.07 * g, dur: 0.045, q: 9 });
    }
    t += gap;
    gap *= s.e;                                  // bounces get CLOSER together
    g *= 0.52;                                   // and quieter
  }
}
for (const kind of Object.keys(CASING_KINDS)) {
  for (let v = 1; v <= 3; v++) {
    // 0.5 rather than the bank's usual 0.85: assets/audio/casing_*.mp3 is
    // mastered to -31 LUFS (see scripts/audio/design_casings.py) and this render
    // is its stand-in, so it has to land at the same level, not 5 dB over it.
    reg(`casing_${kind}_concrete${v}`, 0.34, (k) => casing(k, kind, false, v - 1), 0, 0.5);
    reg(`casing_${kind}_metal${v}`, 0.40, (k) => casing(k, kind, true, v - 1), 0, 0.5);
  }
}

// --- weapon foley -----------------------------------------------------------
reg('foley_sling', 0.5, (k) => {
  for (let i = 0; i < 4; i++) {
    k.noise({ when: i * k.rand(0.03, 0.075), dur: 0.035, vol: 0.16, type: 'bandpass', freq: k.rand(2600, 4400), q: 3.5, at: 0.001 });
  }
  k.noise({ dur: 0.22, vol: 0.07, type: 'bandpass', freq: 1400, q: 0.9, at: 0.02, rate: 0.6 });
});
reg('foley_cloth', 0.42, (k) => {
  k.noise({ dur: 0.19, vol: 0.2, type: 'bandpass', freq: 2100, freqEnd: 900, q: 0.8, at: 0.03, rate: 0.45 });
  k.noise({ when: 0.09, dur: 0.16, vol: 0.12, type: 'highpass', freq: 3200, at: 0.04, rate: 0.5 });
});
reg('foley_raise', 0.45, (k) => {
  k.noise({ dur: 0.16, vol: 0.16, type: 'bandpass', freq: 1600, freqEnd: 2600, q: 0.9, at: 0.03, rate: 0.5 });
  k.noise({ when: 0.13, dur: 0.05, vol: 0.26, type: 'bandpass', freq: 2400, q: 2.6, at: 0.001 });
  k.tone({ when: 0.13, dur: 0.06, vol: 0.14, type: 'triangle', freq: 220, freqEnd: 110 });
});
reg('foley_lower', 0.45, (k) => {
  k.noise({ dur: 0.18, vol: 0.15, type: 'bandpass', freq: 2400, freqEnd: 1200, q: 0.9, at: 0.03, rate: 0.5 });
  k.noise({ when: 0.15, dur: 0.05, vol: 0.2, type: 'bandpass', freq: 1500, q: 2.2, at: 0.001 });
});
// The slide, in the same three parts the shipped asset is built from (see
// scripts/audio/design_slide.py): entry scuff, a grit bed that gets quieter
// AND duller as you lose speed, and a dust tail. 1.05 s, matching the slide.
reg('foley_slide', 1.1, (k) => {
  k.noise({ dur: 0.13, vol: 0.30, type: 'bandpass', freq: 2600, freqEnd: 1500, q: 1.2, at: 0.0015 });
  k.noise({ dur: 0.90, vol: 0.20, type: 'lowpass', freq: 7000, freqEnd: 1600, q: 0.7, at: 0.012, rate: 0.8 });
  k.noise({ when: 0.10, dur: 0.75, vol: 0.05, type: 'bandpass', freq: 2400, q: 0.6, at: 0.05, rate: 0.5 });
});

// --- footsteps (heel and toe are separate takes, layered at play time) ------
const stepRecipes = {
  concrete: (k, hard) => {
    k.noise({ dur: hard ? 0.07 : 0.045, vol: hard ? 0.62 : 0.4, type: 'lowpass', freq: k.rand(700, 1000), freqEnd: 260, at: 0.0012 });
    k.tone({ dur: 0.055, vol: hard ? 0.3 : 0.18, type: 'triangle', freq: k.rand(115, 155), freqEnd: 62 });
    k.noise({ when: 0.008, dur: 0.05, vol: hard ? 0.16 : 0.09, type: 'bandpass', freq: 3100, q: 1.2, at: 0.001 }); // grit scuff
  },
  metal: (k, hard) => {
    k.noise({ dur: 0.035, vol: hard ? 0.5 : 0.33, type: 'bandpass', freq: 2400, q: 0.8, at: 0.0008 });
    k.ring({ freq: hard ? 780 : 940, vol: hard ? 0.22 : 0.13, dur: 0.26, q: 16 });
    k.ring({ freq: hard ? 1640 : 1980, vol: hard ? 0.12 : 0.07, dur: 0.18, q: 22 });
    k.tone({ dur: 0.05, vol: 0.16, type: 'triangle', freq: 130, freqEnd: 70 });
  },
  gravel: (k, hard) => {
    k.noise({ dur: hard ? 0.12 : 0.085, vol: hard ? 0.5 : 0.32, type: 'bandpass', freq: k.rand(1900, 2800), q: 0.55, at: 0.003, rate: 1.2 });
    k.noise({ dur: 0.05, vol: hard ? 0.3 : 0.18, type: 'lowpass', freq: 620, freqEnd: 220, at: 0.001 });
    k.tone({ dur: 0.04, vol: 0.12, type: 'triangle', freq: 105, freqEnd: 58 });
  },
  water: (k, hard) => {
    k.noise({ dur: hard ? 0.13 : 0.09, vol: hard ? 0.5 : 0.34, type: 'bandpass', freq: 1500, freqEnd: 3600, q: 0.6, at: 0.004 });
    k.noise({ dur: 0.05, vol: 0.28, type: 'lowpass', freq: 700, freqEnd: 240, at: 0.001 });
    k.tone({ when: 0.02, dur: 0.09, vol: 0.1, type: 'sine', freq: 640, freqEnd: 1500, at: 0.006 }); // droplet
  },
};
for (const [surface, fn] of Object.entries(stepRecipes)) {
  for (let v = 1; v <= 3; v++) {
    reg(`step_${surface}_heel${v}`, 0.42, (k) => fn(k, true));
    reg(`step_${surface}_toe${v}`, 0.35, (k) => fn(k, false));
  }
}

// --- landing --------------------------------------------------------------
reg('land_thud', 0.7, (k) => {
  k.noise({ dur: 0.13, vol: 0.85, type: 'lowpass', freq: 900, freqEnd: 180, at: 0.001 });
  k.tone({ dur: 0.22, vol: 0.6, type: 'triangle', freq: 92, freqEnd: 40 });
  k.tone({ dur: 0.3, vol: 0.35, type: 'sine', freq: 55, freqEnd: 30, at: 0.004 });
});
reg('land_foley', 0.6, (k) => {
  k.noise({ when: 0.03, dur: 0.2, vol: 0.2, type: 'bandpass', freq: 1900, freqEnd: 800, q: 0.8, at: 0.02, rate: 0.5 });
  for (let i = 0; i < 3; i++) k.noise({ when: 0.05 + i * k.rand(0.03, 0.07), dur: 0.03, vol: 0.13, type: 'bandpass', freq: k.rand(2400, 4200), q: 3.5, at: 0.001 });
});

// --- weapon layers ----------------------------------------------------------
// Low-end "thump" that gives a mono sample its body.
for (let v = 1; v <= 3; v++) {
  reg(`gun_thump${v}`, 0.6, (k) => {
    const f = [78, 92, 66][v - 1];
    k.tone({ dur: 0.19, vol: 0.95, type: 'sine', freq: f * 2.6, freqEnd: f * 0.62, at: 0.0012 });
    k.tone({ dur: 0.3, vol: 0.6, type: 'sine', freq: f, freqEnd: f * 0.45, at: 0.003 });
    k.noise({ dur: 0.1, vol: 0.5, type: 'lowpass', freq: 260, freqEnd: 90, at: 0.0008 });
  });
}
// Mechanical action clack, offset behind the shot.
for (let v = 1; v <= 3; v++) {
  reg(`gun_mech${v}`, 0.35, (k) => {
    const f = [1900, 2350, 1550][v - 1];
    k.noise({ dur: 0.022, vol: 0.5, type: 'bandpass', freq: f, q: 2.8, at: 0.0004 });
    k.noise({ when: 0.028, dur: 0.03, vol: 0.36, type: 'bandpass', freq: f * 0.72, q: 2.4, at: 0.0005 });
    k.ring({ freq: f * 1.9, vol: 0.09, dur: 0.09, q: 26 });
    k.tone({ dur: 0.03, vol: 0.14, type: 'triangle', freq: 300, freqEnd: 150 });
  });
}
// Sub-bass layer under explosions / wonder weapons.
reg('sub_impact', 1.6, (k) => {
  k.tone({ dur: 0.9, vol: 0.95, type: 'sine', freq: 62, freqEnd: 22, at: 0.004 });
  k.tone({ dur: 1.2, vol: 0.5, type: 'sine', freq: 38, freqEnd: 18, at: 0.02 });
  k.noise({ dur: 0.5, vol: 0.4, type: 'lowpass', freq: 150, freqEnd: 45, at: 0.002 });
});

// --- ambience beds and one-shots -------------------------------------------
reg('amb_wind', 8.0, (k) => {
  // Layered band-passed noise at three widths, held flat across the whole
  // render; the loop seam is smoothed by the crossfade below.
  for (const [freq, q, vol, rate] of [[190, 0.45, 0.5, 0.55], [430, 0.8, 0.26, 0.8], [95, 0.5, 0.42, 0.35]]) {
    k.noise({ dur: 0.4, vol, type: 'bandpass', freq, q, at: 0.3, hold: 7.3, rate });
  }
  k.noise({ when: 0.2, dur: 0.4, vol: 0.16, type: 'bandpass', freq: 700, q: 0.7, at: 0.4, hold: 6.9, rate: 0.9 });
}, 0.6);
reg('amb_buzz', 6.0, (k) => {
  // Electrical hum near the generators: 50 Hz + harmonics + crackle.
  k.tone({ dur: 0.3, vol: 0.34, type: 'sawtooth', freq: 50, at: 0.3, hold: 5.3 });
  k.tone({ dur: 0.3, vol: 0.14, type: 'square', freq: 150, at: 0.4, hold: 5.2 });
  k.tone({ dur: 0.3, vol: 0.06, type: 'square', freq: 350, at: 0.5, hold: 5.1 });
  for (let i = 0; i < 14; i++) k.noise({ when: k.rand(0.2, 5.4), dur: 0.02, vol: k.rand(0.04, 0.13), type: 'highpass', freq: 4000, at: 0.001 });
}, 0.35);
for (let v = 1; v <= 3; v++) {
  reg(`amb_metal${v}`, 3.0, (k) => {
    // Distant structural groan: slow detuned low resonances.
    const f = [58, 74, 91][v - 1];
    k.tone({ dur: 2.4, vol: 0.34, type: 'sawtooth', freq: f, freqEnd: f * 0.85, at: 0.5 });
    k.tone({ dur: 2.2, vol: 0.2, type: 'triangle', freq: f * 2.02, freqEnd: f * 1.7, at: 0.7 });
    k.ring({ when: 0.15, freq: f * 6.1, vol: 0.09, dur: 1.8, q: 30 });
    k.noise({ when: 0.1, dur: 1.6, vol: 0.06, type: 'bandpass', freq: 480, q: 1.4, at: 0.4, rate: 0.4 });
  });
  reg(`amb_drip${v}`, 1.4, (k) => {
    const f = [900, 1250, 1600][v - 1];
    k.tone({ dur: 0.09, vol: 0.4, type: 'sine', freq: f * 0.55, freqEnd: f * 1.9, at: 0.003 });
    k.noise({ dur: 0.03, vol: 0.12, type: 'highpass', freq: 3200, at: 0.001 });
    // faint puddle tail
    k.noise({ when: 0.05, dur: 0.28, vol: 0.05, type: 'bandpass', freq: f, q: 1.6, at: 0.02 });
  });
  reg(`amb_artillery${v}`, 3.6, (k) => {
    // Distant shellfire: no transient, all low-passed rumble and a slow tail.
    k.tone({ when: 0.0, dur: 1.5, vol: 0.55, type: 'sine', freq: [46, 38, 54][v - 1], freqEnd: 20, at: 0.06 });
    k.noise({ dur: 2.2, vol: 0.4, type: 'lowpass', freq: 210, freqEnd: 60, at: 0.05 });
    k.noise({ when: 0.7, dur: 2.4, vol: 0.12, type: 'lowpass', freq: 380, freqEnd: 110, at: 0.6 });
  });
}

// --- stingers ---------------------------------------------------------------
reg('stinger_round_start', 3.6, (k) => {
  // Low swell + a rising bed + a struck metallic accent.
  k.tone({ dur: 3.0, vol: 0.5, type: 'sawtooth', freq: 55, at: 0.9, hold: 0.4 });
  k.tone({ dur: 3.0, vol: 0.4, type: 'sawtooth', freq: 55.6, at: 1.1, hold: 0.3 });
  k.tone({ when: 0.3, dur: 2.4, vol: 0.25, type: 'triangle', freq: 110, freqEnd: 164, at: 0.7 });
  k.noise({ dur: 2.8, vol: 0.2, type: 'lowpass', freq: 240, freqEnd: 700, at: 1.3 });
  k.ring({ when: 1.5, freq: 620, vol: 0.16, dur: 1.6, q: 26 });
  k.ring({ when: 1.5, freq: 1490, vol: 0.08, dur: 1.2, q: 30 });
});
reg('stinger_round_end', 2.6, (k) => {
  k.tone({ dur: 1.7, vol: 0.4, type: 'triangle', freq: 220, freqEnd: 110, at: 0.12 });
  k.tone({ when: 0.18, dur: 1.9, vol: 0.24, type: 'sine', freq: 164, freqEnd: 82, at: 0.35 });
  k.noise({ when: 0.05, dur: 1.4, vol: 0.13, type: 'lowpass', freq: 900, freqEnd: 200, at: 0.25 });
});

// --- low-health layers ------------------------------------------------------
reg('heartbeat', 1.0, (k) => {
  // lub
  k.tone({ dur: 0.16, vol: 0.9, type: 'sine', freq: 62, freqEnd: 30, at: 0.008 });
  k.noise({ dur: 0.08, vol: 0.28, type: 'lowpass', freq: 190, freqEnd: 70, at: 0.004 });
  // dub
  k.tone({ when: 0.24, dur: 0.13, vol: 0.6, type: 'sine', freq: 54, freqEnd: 26, at: 0.008 });
  k.noise({ when: 0.24, dur: 0.07, vol: 0.18, type: 'lowpass', freq: 160, freqEnd: 60, at: 0.004 });
});

export const PROCEDURAL_NAMES = Object.freeze(Object.keys(RECIPES));

/** Render one recipe into an AudioBuffer. Resolves to null on any failure. */
async function renderOne(name, sampleRate, seed) {
  const spec = RECIPES[name];
  if (!spec) return null;
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!OAC) return null;
  const frames = Math.max(128, Math.ceil(spec.dur * sampleRate));
  const ctx = new OAC(1, frames, sampleRate);
  const out = ctx.createGain();
  out.gain.value = 1;
  out.connect(ctx.destination);
  const kit = makeKit(ctx, out, seed);
  spec.build(kit);
  const buf = await ctx.startRendering();
  const d = buf.getChannelData(0);

  // Seamless loops: crossfade the tail back over the head.
  const fade = Math.floor((spec.loopFade || 0) * sampleRate);
  if (fade > 16 && fade * 2 < d.length) {
    const head = d.length - fade;
    for (let i = 0; i < fade; i++) {
      const w = i / fade;              // 0 -> 1 across the fade
      d[i] = d[i] * w + d[head + i] * (1 - w);
    }
    // The tail we folded in is now redundant; silence it so `loopEnd` is clean.
    for (let i = head; i < d.length; i++) d[i] = 0;
  }

  // Normalise gently so play-time gains are predictable.
  const target = spec.peak ?? 0.85;
  let peak = 0;
  for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > peak) peak = a; }
  if (peak > 0.001 && peak !== target) {
    const g = Math.min(4, target / peak);
    for (let i = 0; i < d.length; i++) d[i] *= g;
  }
  // Custom marker read by the ambience bed when setting BufferSource.loopEnd.
  try { buf.__loopEnd = fade > 16 ? (d.length - fade) / sampleRate : buf.duration; } catch (e) {}
  return buf;
}

/**
 * Render the whole bank. Runs in small concurrent batches so it never stalls
 * the main thread for long, and always resolves — a failed sound is simply
 * absent and every call site treats a missing buffer as "skip silently".
 */
export async function renderBank(sampleRate, onDone) {
  const bank = Object.create(null);
  const names = PROCEDURAL_NAMES.slice();
  let next = 0;
  let seed = 1337;
  const worker = async () => {
    while (next < names.length) {
      const name = names[next++];
      const s = (seed += 7919);
      try {
        const buf = await renderOne(name, sampleRate, s);
        if (buf) bank[name] = buf;
      } catch (e) { /* skip */ }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  onDone?.(bank);
  return bank;
}
