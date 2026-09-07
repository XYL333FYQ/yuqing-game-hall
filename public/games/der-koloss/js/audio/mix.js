// Master mix bus: compressor -> limiter, plus the dynamic-mix effects that sit
// across the whole output (voice ducking, concussion / ear-ring, low-health
// muffle + tinnitus). Everything here is built once at init; nothing in this
// module allocates a node after `build()` returns.

const DB = (db) => Math.pow(10, db / 20);

export class MasterMix {
  constructor(ctx) {
    this.ctx = ctx;
    this.buses = {};
    this.ducks = {};
    this._duckState = {};   // busName -> { until, amount }
    this._concussionUntil = 0;
    this._health = 1;
    this._threat = 0;
    this._lowHealth = 0;    // smoothed 0..1
    this.build();
  }

  build() {
    const c = this.ctx;

    // ---- master chain --------------------------------------------------
    this.master = c.createGain();

    // Global low-pass: normally wide open, swept down for concussion and for
    // the low-health muffle.
    this.globalLP = c.createBiquadFilter();
    this.globalLP.type = 'lowpass';
    this.globalLP.frequency.value = 22000;
    this.globalLP.Q.value = 0.4;

    // Glue compressor: gentle, wide knee — controls the new dynamic range
    // without pumping.
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -15;
    this.comp.knee.value = 14;
    this.comp.ratio.value = 4;
    this.comp.attack.value = 0.006;
    this.comp.release.value = 0.18;

    // Brickwall-ish limiter: nothing reaches the DAC above ~-1 dBFS.
    this.limiter = c.createDynamicsCompressor();
    this.limiter.threshold.value = -1.2;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.001;
    this.limiter.release.value = 0.06;

    // A little make-up so the limiter's headroom does not just make it quieter.
    // It sits BEFORE the limiter, not after: +1.94 dB applied to the limiter's
    // output raised the real ceiling to about +0.7 dBFS, and a close gunshot
    // measured up to +0.6 dBFS at the DAC. Driving the limiter with it instead
    // keeps the same loudness and makes the -1.2 dBFS threshold mean what the
    // comment above it says.
    this.makeup = c.createGain();
    this.makeup.gain.value = 1.25;

    this.master.connect(this.globalLP);
    this.globalLP.connect(this.comp);
    this.comp.connect(this.makeup);
    this.makeup.connect(this.limiter);
    this.limiter.connect(c.destination);

    // ---- buses -----------------------------------------------------------
    // bus[name] is the public connection point (volume), duck[name] sits after
    // it so ducking never fights setVolume().
    for (const name of ['sfx', 'music', 'voice', 'ui']) {
      const g = c.createGain();
      const d = c.createGain();
      d.gain.value = 1;
      g.connect(d);
      d.connect(this.master);
      this.buses[name] = g;
      this.ducks[name] = d;
      this._duckState[name] = { until: 0, amount: 1 };
    }
    // Ambience rides under the music volume slider but ducks independently.
    const amb = c.createGain();
    const ambDuck = c.createGain();
    amb.connect(ambDuck);
    ambDuck.connect(this.buses.music);
    this.buses.amb = amb;
    this.ducks.amb = ambDuck;
    this._duckState.amb = { until: 0, amount: 1 };

    // ---- concussion / tinnitus tones ------------------------------------
    // Persistent oscillators at zero gain: no node churn when they fire.
    this.earRingGain = c.createGain();
    this.earRingGain.gain.value = 0;
    const ringFilter = c.createBiquadFilter();
    ringFilter.type = 'peaking';
    ringFilter.frequency.value = 4000;
    ringFilter.Q.value = 18;
    ringFilter.gain.value = 9;
    this.earRingOsc = c.createOscillator();
    this.earRingOsc.type = 'sine';
    this.earRingOsc.frequency.value = 4000;
    this.earRingOsc.connect(ringFilter);
    ringFilter.connect(this.earRingGain);
    // Post-globalLP so the concussion sweep does not muffle the ring itself.
    this.earRingGain.connect(this.comp);
    try { this.earRingOsc.start(); } catch (e) {}

    this.tinnitusGain = c.createGain();
    this.tinnitusGain.gain.value = 0;
    this.tinnitusOsc = c.createOscillator();
    this.tinnitusOsc.type = 'sine';
    this.tinnitusOsc.frequency.value = 7400;
    this.tinnitusOsc.connect(this.tinnitusGain);
    this.tinnitusGain.connect(this.comp);
    try { this.tinnitusOsc.start(); } catch (e) {}
  }

  /** Duck a bus by `db` for `seconds`. Overlapping ducks take the deepest. */
  duck(busName, db, seconds) {
    const d = this.ducks[busName];
    const st = this._duckState[busName];
    if (!d || !st) return;
    const c = this.ctx;
    const now = c.currentTime;
    const target = DB(-Math.abs(db));
    const until = now + Math.max(0.05, seconds);
    if (target < st.amount || until > st.until) {
      st.amount = Math.min(st.amount, target);
      st.until = Math.max(st.until, until);
      d.gain.cancelScheduledValues(now);
      d.gain.setValueAtTime(d.gain.value, now);
      d.gain.linearRampToValueAtTime(st.amount, now + 0.06);
      d.gain.setValueAtTime(st.amount, st.until);
      d.gain.linearRampToValueAtTime(1, st.until + 0.35);
      // reset bookkeeping once the release finishes
      st.resetAt = st.until + 0.35;
    }
  }

  /** Called from the engine's slow tick; frees expired duck state. */
  tick(nowCtxTime) {
    for (const name in this._duckState) {
      const st = this._duckState[name];
      if (st.resetAt && nowCtxTime > st.resetAt) { st.amount = 1; st.until = 0; st.resetAt = 0; }
    }
  }

  /**
   * The classic concussion: everything drops and goes dull for a moment while
   * a high-Q ring rises and fades over ~2 s.
   * `strength` 0..1.
   */
  concussion(strength = 1) {
    const c = this.ctx;
    const now = c.currentTime;
    if (now < this._concussionUntil - 1.4) return; // already ringing hard
    const s = Math.max(0.15, Math.min(1, strength));
    this._concussionUntil = now + 2.2 * s;

    for (const name of ['sfx', 'music', 'voice', 'ui', 'amb']) this.duck(name, 9 * s, 0.55 * s);

    // global low-pass sweep: slam shut, open back up over ~1.6 s
    const lp = this.globalLP.frequency;
    lp.cancelScheduledValues(now);
    lp.setValueAtTime(Math.max(400, lp.value), now);
    lp.linearRampToValueAtTime(Math.max(380, 1400 - 900 * s), now + 0.05);
    lp.exponentialRampToValueAtTime(this._muffleTarget(), now + 1.6 * s + 0.4);

    // ear ring
    const g = this.earRingGain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(Math.max(0.0001, g.value), now);
    g.linearRampToValueAtTime(0.05 * s, now + 0.04);
    g.exponentialRampToValueAtTime(0.0001, now + 2.0 * s);
    this.earRingOsc.frequency.setValueAtTime(3600 + Math.random() * 900, now);
  }

  /** Cutoff the global low-pass should rest at, given the low-health state. */
  _muffleTarget() {
    return 22000 * Math.pow(700 / 22000, this._lowHealth);
  }

  /**
   * health 0..1, threat 0..1. Drives the muffle + tinnitus. Smoothed so a
   * single hit does not snap the mix.
   */
  setIntensity(health, threat) {
    if (Number.isFinite(health)) this._health = Math.max(0, Math.min(1, health));
    if (Number.isFinite(threat)) this._threat = Math.max(0, Math.min(1, threat));
    // low health ramps in below 45 % and is full at 12 %
    const target = Math.max(0, Math.min(1, (0.45 - this._health) / 0.33));
    const c = this.ctx;
    const now = c.currentTime;
    this._lowHealth = target;
    if (now > this._concussionUntil) {
      const lp = this.globalLP.frequency;
      lp.cancelScheduledValues(now);
      lp.setTargetAtTime(this._muffleTarget(), now, 0.55);
    }
    this.tinnitusGain.gain.setTargetAtTime(0.006 * target, now, 0.8);
  }

  get lowHealth() { return this._lowHealth; }
  get health() { return this._health; }
  get threat() { return this._threat; }

  dispose() {
    try { this.earRingOsc.stop(); } catch (e) {}
    try { this.tinnitusOsc.stop(); } catch (e) {}
  }
}
