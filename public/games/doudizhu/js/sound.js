'use strict';
/* sound.js — synthesized sound effects (WebAudio, no audio assets).
   All sounds are short oscillator/noise envelopes; muting persists. */

const Snd = (() => {
  let ctx = null;
  let enabled = true;
  try { enabled = localStorage.getItem('ddz_snd') !== '0'; } catch (e) { }

  function ac() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx.state !== 'running') ctx.resume().catch(() => { });
    return ctx;
  }

  function env(g, t0, attack, dur, peak) {
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + dur);
  }

  function tone(freq, o) {
    o = o || {};
    if (!enabled) return;
    const c = ac();
    if (!c) return;
    const t0 = c.currentTime + (o.delay || 0);
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + o.slide), t0 + (o.dur || 0.15));
    env(g, t0, 0.012, o.dur || 0.15, o.gain || 0.2);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + (o.dur || 0.15) + 0.1);
  }

  function noise(o) {
    o = o || {};
    if (!enabled) return;
    const c = ac();
    if (!c) return;
    const t0 = c.currentTime + (o.delay || 0);
    const dur = o.dur || 0.15;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const g = c.createGain();
    env(g, t0, 0.005, dur, o.gain || 0.2);
    let node = src;
    if (o.low) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 420;
      src.connect(f);
      node = f;
    }
    node.connect(g).connect(c.destination);
    src.start(t0);
  }

  return {
    get enabled() { return enabled; },
    toggle() {
      enabled = !enabled;
      try { localStorage.setItem('ddz_snd', enabled ? '1' : '0'); } catch (e) { }
      if (enabled) ac();
      return enabled;
    },
    /* Browsers require a user gesture before audio can start. */
    unlock() { if (enabled) ac(); },
    tick() { tone(1400, { type: 'square', dur: 0.03, gain: 0.05 }); },
    deal() { for (let i = 0; i < 6; i++) noise({ dur: 0.05, gain: 0.1, delay: i * 0.055 }); },
    play() { noise({ dur: 0.07, gain: 0.16 }); tone(900, { type: 'triangle', dur: 0.06, gain: 0.1 }); },
    pass() { tone(320, { dur: 0.12, gain: 0.1, slide: -140 }); },
    bomb() { noise({ dur: 0.5, gain: 0.45, low: true }); tone(85, { type: 'sawtooth', dur: 0.45, gain: 0.35, slide: -45 }); },
    rocket() {
      tone(200, { type: 'sawtooth', dur: 0.45, gain: 0.25, slide: 950 });
      noise({ dur: 0.4, gain: 0.35, delay: 0.32, low: true });
    },
    bid() { tone(660, { dur: 0.09, gain: 0.16 }); tone(880, { dur: 0.12, gain: 0.16, delay: 0.08 }); },
    dbl() { tone(523, { dur: 0.09, gain: 0.16 }); tone(784, { dur: 0.12, gain: 0.16, delay: 0.07 }); },
    turn() { tone(988, { dur: 0.08, gain: 0.14 }); tone(1319, { dur: 0.13, gain: 0.14, delay: 0.09 }); },
    landlord() {
      [523, 659, 784].forEach((f, i) => tone(f, { dur: 0.12, gain: 0.18, delay: i * 0.09 }));
      tone(1047, { dur: 0.3, gain: 0.2, delay: 0.27 });
    },
    win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, { dur: 0.18, gain: 0.2, delay: i * 0.12 })); },
    lose() { [392, 330, 262].forEach((f, i) => tone(f, { type: 'triangle', dur: 0.24, gain: 0.16, delay: i * 0.15 })); },
    chat() { tone(1200, { dur: 0.06, gain: 0.1 }); tone(1500, { dur: 0.08, gain: 0.08, delay: 0.05 }); },
  };
})();
