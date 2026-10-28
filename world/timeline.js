// The film's frame layout. One MP4 holds every piece; the page jumps between them.
//   intro → idle0 (+guard) → fwd01 → idle1 (+guard) → … → idle4 (+guard) → back43 → back32 → back21 → back10
// A forward move plays straight into the next idle loop; a back move ends on the first frame of its idle loop.
// Guard frames continue a loop past its end, so a late seek never shows the next segment.
export const FPS = 24;
export const PERIOD = 6; // seconds; every station loop and every convoy repeats on it
export const IDLE_F = PERIOD * FPS; // 144
export const GUARD_F = 12;
export const TRANS_F = 60; // 2.5 s
// the two sea legs are longer flights
export const moveLen = (a, b) => ((a === 1 && b === 2) || (a === 2 && b === 1) || (a === 2 && b === 3) || (a === 3 && b === 2) ? 84 : TRANS_F);
export const INTRO_F = 84; // 3.5 s

export function layout(sceneCount = 5) {
  const seg = [];
  let f = 0;
  const push = (s) => { s.start = f; f += s.len; seg.push(s); return s; };
  push({ name: 'intro', type: 'move', from: -1, to: 0, len: INTRO_F });
  for (let k = 0; k < sceneCount; k++) {
    push({ name: `idle${k}`, type: 'idle', scene: k, len: IDLE_F + GUARD_F, loopLen: IDLE_F });
    if (k < sceneCount - 1) push({ name: `fwd${k}${k + 1}`, type: 'move', from: k, to: k + 1, len: moveLen(k, k + 1) });
  }
  for (let k = sceneCount - 1; k > 0; k--) push({ name: `back${k}${k - 1}`, type: 'move', from: k, to: k - 1, len: moveLen(k, k - 1) });
  return { fps: FPS, period: PERIOD, frames: f, segments: seg };
}

export function segmentAt(L, f) {
  for (const s of L.segments) if (f >= s.start && f < s.start + s.len) return s;
  return L.segments[L.segments.length - 1];
}

// Local time of every scene at frame f, so a move ends exactly on the next loop's phase 0.
export function sceneTimes(L, f, sceneCount = 5) {
  const s = segmentAt(L, f);
  const t = (f - s.start) / FPS;
  const out = new Array(sceneCount).fill(0).map(() => t % PERIOD);
  if (s.type === 'idle') out[s.scene] = t % PERIOD;
  else {
    const D = s.len / FPS;
    if (s.from >= 0) out[s.from] = t % PERIOD;
    out[s.to] = ((t - D) % PERIOD + PERIOD) % PERIOD;
  }
  return { seg: s, t, times: out };
}

export const ease = {
  inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  out: (x) => 1 - Math.pow(1 - x, 3),
};
