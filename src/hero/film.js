// Two stacked <video> elements play one MP4 like an edit suite: the visible one plays, the hidden one waits
// pre-seeked at the next cut, so loops close and moves start without a visible seek.
export class Film {
  constructor(a, b, data, variant) {
    this.v = [a, b];
    this.active = 0;
    this.fps = data.fps;
    this.seg = Object.fromEntries(data.segments.map((s) => [s.name, s]));
    this.segments = data.segments;
    this.tracks = data.variants[variant].tracks;
    this.src = data.variants[variant].src;
    this.plan = null; // { kind: 'loop', k } | { kind: 'move', name, to, join: 'run' | 'swap' }
    this.cue = null; // frame the standby video is parked on
    this.busy = false;
    this.onArrive = null;
  }
  get A() { return this.v[this.active]; }
  get B() { return this.v[1 - this.active]; }
  frame() { return this.A.currentTime * this.fps; }
  t(f) { return (f + 0.02) / this.fps; } // a hair inside the frame so the decoder lands on it

  load() {
    this.v.forEach((v) => { v.muted = true; v.playsInline = true; });
    this.A.preload = 'auto'; this.A.src = this.src;
    this.A.classList.add('is-on');
  }
  attachStandby() { if (!this.B.src) { this.B.preload = 'auto'; this.B.src = this.src; } }

  park(f) {
    // pre-seek the hidden video; resolves when its frame is decoded
    const v = this.B;
    if (this.cue === f && !v.seeking && v.readyState >= 2) return Promise.resolve();
    this.cue = f;
    return new Promise((res) => {
      if (!v.src) this.attachStandby();
      const done = () => { v.removeEventListener('seeked', done); res(); };
      v.addEventListener('seeked', done);
      v.pause();
      v.currentTime = this.t(f);
    });
  }
  swap(fade = 0, gsap) {
    const next = this.B, prev = this.A;
    next.play().catch(() => {});
    this.active = 1 - this.active;
    this.cue = null;
    if (fade && gsap) {
      gsap.killTweensOf(this.v);
      next.classList.add('is-on');
      gsap.fromTo(next, { opacity: 0 }, { opacity: 1, duration: fade, ease: 'power1.out', onComplete: () => { prev.pause(); prev.classList.remove('is-on'); gsap.set(this.v, { clearProps: 'opacity' }); } });
    } else {
      next.classList.add('is-on'); prev.classList.remove('is-on'); prev.pause();
    }
  }

  // start: from the intro, or straight into scene 0
  async begin(skipIntro) {
    const A = this.A;
    if (skipIntro) { A.currentTime = this.t(this.seg.idle0.start); this.plan = { kind: 'loop', k: 0 }; }
    else { A.currentTime = this.t(0); this.plan = { kind: 'move', name: 'intro', to: 0, join: 'run' }; }
    await A.play().catch(() => {});
    this.attachStandby();
    this.park(this.seg.idle0.start);
  }

  // jump from the current scene to scene k, through the move that ends there
  async go(from, k, gsap) {
    if (this.busy || from === k) return false;
    this.busy = true;
    const fwd = k > from;
    const name = fwd ? `fwd${k - 1}${k}` : `back${k + 1}${k}`;
    const s = this.seg[name];
    await this.park(s.start);
    this.swap(0.32, gsap); // cut to the move's first frame under a short dissolve
    this.plan = { kind: 'move', name, to: k, join: fwd ? 'run' : 'swap' };
    // a back move ends on the loop's first frame: park the other video there once its dissolve is over
    if (!fwd) setTimeout(() => { if (this.plan?.name === name) this.park(this.seg[`idle${k}`].start); }, 420);
    return true;
  }

  tick() {
    if (!this.plan) return;
    const f = this.frame();
    if (this.plan.kind === 'loop') {
      const L = this.seg[`idle${this.plan.k}`];
      const end = L.start + L.loopLen;
      if (this.cue !== L.start && !this.B.seeking) this.park(L.start);
      if (f >= end - 0.5) {
        if (this.cue === L.start && this.B.readyState >= 2 && !this.B.seeking) this.swap();
        else if (f >= end + 8) this.A.currentTime = this.t(L.start); // standby not ready: fall back to a seek inside the guard
      }
    } else {
      const s = this.seg[this.plan.name];
      const end = s.start + s.len;
      if (this.plan.join === 'swap' && f >= end - 0.6) {
        const k = this.plan.to;
        if (this.cue === this.seg[`idle${k}`].start && this.B.readyState >= 2 && !this.B.seeking) { this.swap(); this.arrive(k); }
        else if (f >= end + 2) { this.A.currentTime = this.t(this.seg[`idle${k}`].start); this.arrive(k); }
      } else if (this.plan.join === 'run' && f >= end) {
        this.arrive(this.plan.to); // the next loop follows in the file
      }
    }
  }
  arrive(k) {
    this.plan = { kind: 'loop', k };
    this.busy = false;
    this.park(this.seg[`idle${k}`].start);
    if (this.onArrive) this.onArrive(k);
  }

  // segment + local frame for the picture on screen now
  where() {
    const f = Math.floor(this.frame() + 0.001);
    for (const s of this.segments) if (f >= s.start && f < s.start + s.len) return { s, i: f - s.start };
    return { s: this.segments[0], i: 0 };
  }
  spot(id) {
    const { s, i } = this.where();
    const tr = this.tracks[s.name]?.[id];
    if (!tr) return null;
    const j = Math.min(i, tr.length / 2 - 1) * 2;
    return tr[j] == null ? null : [tr[j], tr[j + 1], s];
  }
  stillSpot(id, k) {
    const tr = this.tracks[`idle${k}`]?.[id];
    return tr && tr[0] != null ? [tr[0], tr[1]] : null;
  }
  progress() {
    if (this.plan?.kind !== 'loop') return 0;
    const L = this.seg[`idle${this.plan.k}`];
    return Math.min(1, Math.max(0, (this.frame() - L.start) / L.loopLen));
  }
  pause() { this.v.forEach((v) => v.pause()); }
  resume() { this.A.play().catch(() => {}); }
}
