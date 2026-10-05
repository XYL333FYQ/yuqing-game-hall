'use strict';
/* music.js — generative background music, no audio assets.
   A gentle music-box loop: Karplus-Strong plucked strings arpeggiating a
   canon progression (C G Am Em F C F G) over a soft sine bass, ~74 BPM.
   Starts after the first user gesture (browser autoplay rules). */

const Bgm = (() => {
  let ctx = null, master = null, timer = null;
  let enabled = true;
  let loopStart = 0, nextEvent = 0;
  const pluckCache = {};
  try { enabled = localStorage.getItem('ddz_bgm') !== '0'; } catch (e) { }

  const BPM = 74, BEAT = 60 / BPM, BARS = 8;
  const LOOP = BARS * 4 * BEAT;
  const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);

  /* bass root + triad voicing per bar */
  const PROG = [
    { b: 48, c: [60, 64, 67] }, // C
    { b: 43, c: [59, 62, 67] }, // G
    { b: 45, c: [57, 60, 64] }, // Am
    { b: 40, c: [55, 59, 64] }, // Em
    { b: 41, c: [57, 60, 65] }, // F
    { b: 48, c: [60, 64, 67] }, // C
    { b: 41, c: [57, 60, 65] }, // F
    { b: 43, c: [62, 67, 71] }, // G
  ];

  /* Flatten the whole loop into [beatTime, midi, kind, velocity] events. */
  const EVENTS = (() => {
    const ev = [];
    PROG.forEach(({ b, c }, bar) => {
      const t0 = bar * 4;
      ev.push([t0, b, 'bass', 1]);
      const sparkle = bar >= 4;
      const slots = [c[0], c[1], c[2], c[1], sparkle ? c[2] + 12 : c[0] + 12, c[2], c[1], c[2]];
      slots.forEach((m, i) => {
        const vel = (i % 4 === 0 ? 1 : 0.72) * (0.88 + 0.24 * Math.random());
        ev.push([t0 + i * 0.5, m, 'pluck', vel]);
      });
    });
    // little resolving bell on the loop's last off-beat
    ev.push([BARS * 4 - 0.5, 84, 'pluck', 0.8]);
    return ev.sort((a, b) => a[0] - b[0]);
  })();

  function ac() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.4;
      master.connect(ctx.destination);
    }
    // 'suspended' after autoplay blocking or tab backgrounding, and Safari's
    // non-standard 'interrupted' after media interruptions — resume both.
    if (ctx.state !== 'running') ctx.resume().catch(() => { });
    return ctx;
  }

  /* Karplus-Strong pluck rendered into a cached buffer per pitch. */
  function pluckBuffer(c, freq) {
    const key = Math.round(freq);
    if (pluckCache[key]) return pluckCache[key];
    const sr = c.sampleRate;
    const N = Math.max(2, Math.round(sr / freq));
    const len = Math.floor(sr * 1.7);
    const buf = c.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < N; i++) d[i] = Math.random() * 2 - 1;
    for (let i = 1; i < N; i++) d[i] = (d[i] + d[i - 1]) / 2; // soften the attack
    const decay = 0.994 + 0.004 * Math.min(1, freq / 900);
    for (let i = N + 1; i < len; i++) d[i] = decay * 0.5 * (d[i - N] + d[i - N - 1]);
    pluckCache[key] = buf;
    return buf;
  }

  function schedulePluck(midi, t, vel) {
    const src = ctx.createBufferSource();
    src.buffer = pluckBuffer(ctx, midiHz(midi));
    const g = ctx.createGain();
    g.gain.value = 0.2 * vel;
    src.connect(g).connect(master);
    src.start(t + (Math.random() - 0.5) * 0.014);
  }

  function scheduleBass(midi, t) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = midiHz(midi);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 4 * BEAT * 0.95);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + 4 * BEAT);
  }

  function tick() {
    if (!ctx) return;
    if (ctx.state !== 'running') { ctx.resume().catch(() => { }); return; }
    // If the context was suspended for a while the schedule is far in the
    // past; re-anchor instead of machine-gunning the missed notes.
    if (nextEvent < EVENTS.length) {
      const nextT = loopStart + EVENTS[nextEvent][0] * BEAT;
      if (nextT < ctx.currentTime - 1) loopStart = ctx.currentTime + 0.2 - EVENTS[nextEvent][0] * BEAT;
    }
    const ahead = ctx.currentTime + 0.6;
    while (true) {
      if (nextEvent >= EVENTS.length) { loopStart += LOOP; nextEvent = 0; }
      const [beat, midi, kind, vel] = EVENTS[nextEvent];
      const t = loopStart + beat * BEAT;
      if (t > ahead) break;
      if (t >= ctx.currentTime - 0.05) {
        if (kind === 'bass') scheduleBass(midi, t);
        else schedulePluck(midi, t, vel);
      }
      nextEvent++;
    }
  }

  function start() {
    if (timer || !enabled) return;
    if (!ac()) return;
    loopStart = ctx.currentTime + 0.15;
    nextEvent = 0;
    tick();
    timer = setInterval(tick, 200);
  }

  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  return {
    get enabled() { return enabled; },
    get playing() { return !!timer; },
    /* Called on any user gesture: starts the loop once audio is allowed,
       and revives a context the browser suspended behind our back. */
    poke() {
      if (!enabled) return;
      if (!timer) start();
      else if (ctx && ctx.state !== 'running') ctx.resume().catch(() => { });
    },
    toggle() {
      enabled = !enabled;
      try { localStorage.setItem('ddz_bgm', enabled ? '1' : '0'); } catch (e) { }
      if (enabled) start(); else stop();
      return enabled;
    },
  };
})();
