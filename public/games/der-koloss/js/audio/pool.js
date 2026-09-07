// Pooled playback voices.
//
// AudioBufferSourceNodes are one-shot by spec and must be recreated, but every
// node *behind* them (gain, air-absorption low-pass, panner, reverb send) is
// reusable. Pooling them keeps the graph size flat under sustained fire, which
// is what stops WebAudio node churn turning into GC hitches.
//
// Signal path per voice:
//   src -> gain -> lp -> pan -+-> out ---> (a mix bus, re-pointed per play)
//                             `-> send -> (permanently wired to the reverb send)

export const MAX_VOICES = 72;

export class VoicePool {
  constructor(ctx, reverbSend, { size = MAX_VOICES } = {}) {
    this.ctx = ctx;
    this.reverbSend = reverbSend;
    this.size = size;
    this.free = [];
    this.active = [];   // in acquisition order, so [0] is the oldest
    this.created = 0;
    this.steals = 0;
    this.drops = 0;
  }

  _make() {
    const c = this.ctx;
    const gain = c.createGain(); gain.gain.value = 0;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 22000; lp.Q.value = 0.0001;
    const pan = c.createStereoPanner(); pan.pan.value = 0;
    const send = c.createGain(); send.gain.value = 0;
    gain.connect(lp); lp.connect(pan); pan.connect(send);
    if (this.reverbSend) send.connect(this.reverbSend);
    this.created++;
    return { gain, lp, pan, send, out: null, src: null, id: this.created, endTimer: 0 };
  }

  /** Grab a voice, stealing the oldest active one if the pool is saturated. */
  acquire() {
    let v = this.free.pop();
    if (!v) {
      if (this.created < this.size) v = this._make();
      else {
        v = this.active.shift();
        if (!v) { this.drops++; return null; }
        this.steals++;
        this._teardown(v);
      }
    }
    this.active.push(v);
    return v;
  }

  _teardown(v) {
    if (v.endTimer) { clearTimeout(v.endTimer); v.endTimer = 0; }
    if (v.src) {
      try { v.src.onended = null; } catch (e) {}
      try { v.src.stop(); } catch (e) {}
      try { v.src.disconnect(); } catch (e) {}
      v.src = null;
    }
    if (v.out) { try { v.pan.disconnect(v.out); } catch (e) { try { v.pan.disconnect(); if (this.reverbSend) v.pan.connect(v.send); } catch (e2) {} } v.out = null; }
    v.gain.gain.cancelScheduledValues(0);
    v.gain.gain.value = 0;
    v.send.gain.value = 0;
    v.lp.frequency.cancelScheduledValues(0);
    v.lp.frequency.value = 22000;
    v.pan.pan.value = 0;
  }

  /** Point a voice's dry output at a bus. */
  route(v, busNode) {
    if (v.out === busNode) return;
    if (v.out) { try { v.pan.disconnect(v.out); } catch (e) {} }
    v.out = busNode || null;
    if (busNode) { try { v.pan.connect(busNode); } catch (e) { v.out = null; } }
  }

  release(v) {
    const i = this.active.indexOf(v);
    if (i >= 0) this.active.splice(i, 1);
    else if (this.free.includes(v)) return;   // already released
    this._teardown(v);
    this.free.push(v);
  }

  /** Release everything (context teardown / hard stop). */
  releaseAll() {
    while (this.active.length) this.release(this.active[0]);
  }

  get activeCount() { return this.active.length; }
  get freeCount() { return this.free.length; }
  /** Total nodes held by the pool — used by the soak test to prove no growth. */
  get nodeCount() { return this.created * 4; }
}
