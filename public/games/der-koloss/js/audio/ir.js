// Procedural impulse responses for the convolution reverb zones.
//
// Each IR is built as: pre-delay -> a handful of discrete early reflections ->
// an exponentially decaying diffuse noise tail whose high frequencies decay
// faster than its low frequencies (air/material absorption). No external IR
// files, no libraries — everything is written straight into an AudioBuffer.
//
// The maths is deliberately cheap: a one-pole low-pass whose coefficient is
// re-derived every block gives a convincing "the tail gets darker as it decays"
// without a full multi-band decay model.

// A deterministic PRNG keeps IRs identical between reloads, which makes the
// reverb tails reproducible when we assert on them in tests.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Zone reverb definitions.
 *
 * rt60        seconds for the diffuse tail to fall 60 dB
 * preDelay    seconds before the first early reflection
 * early       [timeSeconds, gain] discrete reflections (the "slap" character)
 * tone        0..1 — starting brightness of the tail (1 = wide open)
 * damping     0..1 — how fast the tail darkens (1 = very dark tail quickly)
 * diffusion   0..1 — 0 keeps the tail grainy/slappy, 1 smooths it into a wash
 * modes       [freqHz, gain, decaySeconds] resonant room modes (boxy rooms)
 * wet         default wet return level for the zone
 */
export const ZONE_SPECS = {
  // Tight concrete corridor: short, bright, hard slapback off parallel walls.
  corridor: {
    rt60: 0.62, preDelay: 0.004, tone: 0.92, damping: 0.22, diffusion: 0.35,
    early: [[0.006, 0.62], [0.011, 0.48], [0.019, 0.4], [0.027, 0.3], [0.038, 0.22], [0.051, 0.15]],
    modes: [],
    wet: 0.34,
  },
  // Main factory hall: long, dark, diffuse — the big AAA tail.
  hall: {
    rt60: 2.2, preDelay: 0.022, tone: 0.62, damping: 0.72, diffusion: 0.95,
    early: [[0.024, 0.34], [0.041, 0.3], [0.063, 0.26], [0.089, 0.22], [0.121, 0.17], [0.164, 0.13], [0.213, 0.1]],
    modes: [[46, 0.05, 1.5], [71, 0.035, 1.2]],
    wet: 0.46,
  },
  // Outdoor courtyard: almost no tail, but a clear distant slap off the far wall.
  courtyard: {
    rt60: 0.38, preDelay: 0.008, tone: 0.86, damping: 0.5, diffusion: 0.2,
    early: [[0.012, 0.2], [0.031, 0.14], [0.118, 0.44], [0.136, 0.26], [0.201, 0.16], [0.244, 0.09]],
    modes: [],
    wet: 0.22,
  },
  // Small lab / generator room: short but boxy, with audible standing modes.
  lab: {
    rt60: 0.78, preDelay: 0.003, tone: 0.74, damping: 0.4, diffusion: 0.5,
    early: [[0.004, 0.55], [0.009, 0.5], [0.014, 0.42], [0.021, 0.34], [0.03, 0.24]],
    modes: [[88, 0.09, 0.55], [132, 0.07, 0.45], [197, 0.05, 0.35]],
    wet: 0.4,
  },
};

export const ZONE_NAMES = Object.keys(ZONE_SPECS);

/**
 * Render one zone's impulse response into a stereo AudioBuffer.
 * Pure DSP — safe to call on any BaseAudioContext.
 */
export function buildImpulseResponse(ctx, spec, seed = 1) {
  const sr = ctx.sampleRate;
  const tail = Math.max(spec.rt60, 0.05);
  const lastEarly = spec.early.length ? spec.early[spec.early.length - 1][0] : 0;
  const length = Math.max(64, Math.ceil((spec.preDelay + Math.max(tail, lastEarly) + 0.08) * sr));
  const buf = ctx.createBuffer(2, length, sr);

  // ln(1000) ~= 6.9078 — the amplitude drop that corresponds to -60 dB.
  const decayK = 6.907755 / tail;
  const preDelaySamples = Math.round(spec.preDelay * sr);

  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    const rnd = mulberry32(seed * 7919 + ch * 104729);

    // --- diffuse exponential tail -------------------------------------------
    // One-pole low-pass whose cutoff falls as the tail decays: the classic
    // "high frequencies die first" behaviour of a real room.
    let lp = 0;
    for (let i = preDelaySamples; i < length; i++) {
      const t = (i - preDelaySamples) / sr;
      const env = Math.exp(-decayK * t);
      if (env < 1e-5) break;
      // coefficient walks from `tone` down toward a dark tail as time passes
      const openness = spec.tone * Math.exp(-spec.damping * t * 2.2);
      const a = Math.min(0.995, Math.max(0.02, openness));
      const white = rnd() * 2 - 1;
      lp += a * (white - lp);
      // `diffusion` blends the smoothed (washy) and raw (grainy) noise
      const s = lp * spec.diffusion + white * (1 - spec.diffusion) * 0.55;
      d[i] += s * env;
    }

    // --- discrete early reflections ------------------------------------------
    // A short shaped burst rather than a single sample, so they read as
    // reflections off a surface and not as digital clicks.
    for (const [time, gain] of spec.early) {
      const at = preDelaySamples + Math.round((time + (rnd() - 0.5) * 0.0022) * sr);
      const burst = Math.max(4, Math.round(sr * 0.0035));
      if (at + burst >= length) continue;
      const polarity = rnd() < 0.5 ? -1 : 1;
      for (let k = 0; k < burst; k++) {
        const w = Math.exp(-k / (burst * 0.35));
        d[at + k] += polarity * gain * w * (rnd() * 2 - 1) * 0.9;
      }
      // plus a deterministic impulse so the reflection has a defined transient
      d[at] += polarity * gain * 0.75;
    }

    // --- resonant room modes --------------------------------------------------
    for (const [freq, gain, modeDecay] of spec.modes || []) {
      const w = (2 * Math.PI * freq) / sr;
      const phase = rnd() * Math.PI * 2;
      const k = 6.907755 / Math.max(0.05, modeDecay);
      const n = Math.min(length - preDelaySamples, Math.ceil(modeDecay * sr));
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        d[preDelaySamples + i] += Math.sin(w * i + phase) * gain * Math.exp(-k * t);
      }
    }
  }

  // --- normalise -------------------------------------------------------------
  // Equal-loudness-ish: scale so peak sits at 0.9. Without this a long tail is
  // far quieter than a short one and the zone crossfade audibly jumps.
  let peak = 0;
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > peak) peak = a; }
  }
  if (peak > 0) {
    const g = 0.9 / peak;
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < d.length; i++) d[i] *= g;
    }
  }
  return buf;
}

/** Build every zone IR. Returns { corridor: AudioBuffer, ... }. */
export function buildAllImpulseResponses(ctx) {
  const out = {};
  let seed = 1;
  for (const name of ZONE_NAMES) {
    try { out[name] = buildImpulseResponse(ctx, ZONE_SPECS[name], seed++); }
    catch (e) { /* a failed IR simply means that zone stays dry */ }
  }
  return out;
}
