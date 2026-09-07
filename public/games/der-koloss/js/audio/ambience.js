// Layered ambience bed.
//
// Replaces the single looping `ambience.mp3` with:
//   - a continuous wind loop (procedural, seamless)
//   - a continuous electrical buzz anchored at the generator room
//   - randomised positional one-shots (metal groans, drips, distant artillery)
//     scheduled on jittered timers, placed at fixed world anchors so the space
//     stays coherent as the player moves through it.
//
// Density scales with the current round: later rounds get more frequent and
// more aggressive one-shots.

// Fixed world anchors, chosen from the real map layout (see map-layout.js).
const ANCHORS = {
  metal: [
    { x: 0, y: 5.5, z: -52 },    // factory roof structure
    { x: -12, y: 4, z: -58 },    // factory west
    { x: 12, y: 4, z: -46 },     // factory east
    { x: 24, y: 3, z: -14 },     // automobile garage
  ],
  drip: [
    { x: -24, y: 2.4, z: -13 },  // animal lab
    { x: -10, y: 2.4, z: 2 },    // left corridor
    { x: 10, y: 2.4, z: 2 },     // garage entrance
    { x: -38, y: 2.4, z: -16 },  // generator room
    { x: 18, y: 2.4, z: -30 },   // chemical testing
  ],
  artillery: [
    { x: -30, y: 14, z: -70 },
    { x: 34, y: 14, z: -60 },
    { x: 0, y: 16, z: 46 },
  ],
  buzz: { x: -38, y: 1.6, z: -13 }, // generator room
  wind: null,                        // non-positional bed
};

export class AmbienceBed {
  /**
   * @param {object} engine  the AudioEngine — uses `playProcedural`, `bank`,
   *                         `bus.amb` and `ctx` only.
   */
  constructor(engine) {
    this.engine = engine;
    this.running = false;
    this.round = 1;
    this.loops = [];
    this.timers = [];
    this._legacy = null;
  }

  setRound(round) { if (Number.isFinite(round)) this.round = Math.max(1, round | 0); }

  /** Multiplier on one-shot frequency; 1.0 at round 1, ~2.1 by round 25. */
  get density() { return Math.min(2.2, 0.85 + this.round * 0.055); }

  _loop(bufName, { vol = 0.2, pos = null, rate = 1 } = {}) {
    const eng = this.engine;
    // recorded asset first, procedural render as the fallback
    let buf = eng._sample ? eng._sample(bufName) : (eng.bank?.[bufName] || null);
    if (!buf || !eng.ctx) return null;
    // Recorded beds carry no loop marker; smooth the seam once before use.
    if (eng._loopSafe) buf = eng._loopSafe(buf, 0.35);
    const c = eng.ctx;
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.playbackRate.value = rate;
    if (Number.isFinite(buf.__loopEnd) && buf.__loopEnd > 0.05) {
      src.loopStart = 0;
      src.loopEnd = buf.__loopEnd;
    }
    const g = c.createGain();
    const p = c.createStereoPanner();
    g.gain.value = 0;
    src.connect(g); g.connect(p); p.connect(eng.bus.amb);
    src.start(0, Math.random() * Math.max(0.01, (src.loopEnd || buf.duration) - 0.05));
    g.gain.setTargetAtTime(vol, c.currentTime, 1.4); // fade in, never a hard start
    const handle = { src, gain: g, pan: p, pos, base: vol };
    this.loops.push(handle);
    return handle;
  }

  start() {
    if (this.running) return;
    const eng = this.engine;
    if (!eng.ctx) return;
    this.running = true;

    // --- continuous beds ---------------------------------------------------
    const wind = this._loop('amb_wind', { vol: 0.16 });
    // A second, slower, darker wind layer gives the bed movement without an LFO.
    this._loop('amb_wind', { vol: 0.1, rate: 0.72 });
    this._loop('amb_buzz', { vol: 0.5, pos: ANCHORS.buzz, rate: 1 });

    // Fall back to the shipped stereo bed only if nothing procedural rendered.
    if (!wind) {
      const h = eng.loopFile('ambience', 0.42, 'amb');
      if (h) this._legacy = h;
    }

    this._schedule('metal', 14, 34);
    this._schedule('drip', 4.5, 13);
    this._schedule('artillery', 22, 62);
    this._schedule('dog_howl', 70, 190);
  }

  _schedule(kind, minSec, maxSec) {
    if (!this.running) return;
    const d = this.density;
    const wait = (minSec + Math.random() * (maxSec - minSec)) / d;
    const id = setTimeout(() => {
      const i = this.timers.indexOf(id);
      if (i >= 0) this.timers.splice(i, 1);
      if (!this.running) return;
      try { this._fire(kind); } catch (e) { /* ambience must never throw */ }
      this._schedule(kind, minSec, maxSec);
    }, wait * 1000);
    this.timers.push(id);
  }

  _fire(kind) {
    const eng = this.engine;
    if (kind === 'dog_howl') { eng.play('dog_howl'); return; }
    const list = ANCHORS[kind];
    if (!list || !list.length) return;
    const pos = list[(Math.random() * list.length) | 0];
    const v = 1 + ((Math.random() * 3) | 0);
    if (kind === 'metal') {
      eng.playProcedural(`amb_metal${v}`, {
        pos, vol: 0.5 + Math.random() * 0.35, rate: 0.85 + Math.random() * 0.3,
        bus: 'amb', refDist: 14, maxDist: 90, send: 0.9,
      });
    } else if (kind === 'drip') {
      eng.playProcedural(`amb_drip${v}`, {
        pos, vol: 0.34 + Math.random() * 0.2, rate: 0.9 + Math.random() * 0.35,
        bus: 'amb', refDist: 4, maxDist: 26, send: 0.8,
      });
      // occasional double-drip
      if (Math.random() < 0.35) {
        setTimeout(() => {
          if (this.running) eng.playProcedural(`amb_drip${v}`, { pos, vol: 0.22, rate: 1.05, bus: 'amb', refDist: 4, maxDist: 26, send: 0.8 });
        }, 260 + Math.random() * 420);
      }
    } else if (kind === 'artillery') {
      eng.playProcedural(`amb_artillery${v}`, {
        pos, vol: 0.6 + Math.random() * 0.3, rate: 0.9 + Math.random() * 0.2,
        bus: 'amb', refDist: 40, maxDist: 220, send: 0.35, noAir: true,
      });
    }
  }

  /** Ambience loops that are positional follow the listener each slow tick. */
  update() {
    if (!this.running) return;
    for (const l of this.loops) {
      if (!l.pos) continue;
      const sp = this.engine._spatial(l.pos, l.base, 6, 40);
      const t = this.engine.ctx.currentTime;
      l.gain.gain.setTargetAtTime(sp ? sp.vol : 0, t, 0.25);
      l.pan.pan.setTargetAtTime(sp ? sp.pan : 0, t, 0.25);
    }
  }

  stop() {
    this.running = false;
    for (const id of this.timers) clearTimeout(id);
    this.timers.length = 0;
    for (const l of this.loops) {
      try { l.src.stop(); } catch (e) {}
      try { l.gain.disconnect(); l.pan.disconnect(); } catch (e) {}
    }
    this.loops.length = 0;
    if (this._legacy) { try { this._legacy.stop(); } catch (e) {} this._legacy = null; }
  }
}
