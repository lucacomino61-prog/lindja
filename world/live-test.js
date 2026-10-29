// Test page for the live world: ?tier=high|mid|low&dpr=1&u=0..4&variant=desktop|phone
// window.live.frame(u, t) draws one frame; window.live.bench(u, n) times n frames (CPU + GPU via timer queries).
import { createLive } from './live.js';
import fontUrl from '@fontsource-variable/big-shoulders-display/files/big-shoulders-display-latin-ext-wght-normal.woff2?url';
import fontUrl2 from '@fontsource-variable/big-shoulders-display/files/big-shoulders-display-latin-wght-normal.woff2?url';

const q = new URLSearchParams(location.search);
async function boot() {
  for (const [u, range] of [[fontUrl2, 'U+0000-00FF'], [fontUrl, 'U+0100-024F']]) {
    const ff = new FontFace('Big Shoulders Display', `url(${u})`, { weight: '100 900', unicodeRange: range });
    document.fonts.add(await ff.load());
  }
  const canvas = document.getElementById('c');
  const t0 = performance.now();
  const L = await createLive({
    canvas, width: innerWidth, height: innerHeight, dpr: +(q.get('dpr') || 1), tier: q.get('tier') || 'high', variant: q.get('variant') || 'desktop',
    sky: q.get('sky') || '/world/assets/polyhaven/sky_2k.hdr', skyGold: q.get('skyGold') || '/world/assets/polyhaven/sky_golden_2k.hdr',
  });
  const tBuilt = performance.now();
  await L.warm();
  await L.goldReady;
  const tWarm = performance.now();
  const gl = L.renderer.getContext(), ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  async function bench(u, n = 60, du = 0) {
    const cpu = [], gpu = [], qs = [];
    for (let i = 0; i < n; i++) {
      const a = performance.now();
      let qq = null;
      if (ext) { qq = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, qq); }
      L.frame(u + du * i, 10 + i / 60);
      if (qq) { gl.endQuery(ext.TIME_ELAPSED_EXT); qs.push(qq); }
      cpu.push(performance.now() - a);
      await new Promise((r) => requestAnimationFrame(r));
    }
    await new Promise((r) => setTimeout(r, 200));
    for (const qq of qs) if (gl.getQueryParameter(qq, gl.QUERY_RESULT_AVAILABLE)) gpu.push(gl.getQueryParameter(qq, gl.QUERY_RESULT) / 1e6);
    const med = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : null);
    const p95 = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length * 0.95)] : null);
    L.renderer.info.autoReset = false; L.renderer.info.reset(); L.frame(u, 10);
    const inf = L.info(); L.renderer.info.autoReset = true;
    return { u, cpuMed: med(cpu), cpuP95: p95(cpu), gpuMed: med(gpu), gpuP95: p95(gpu), ...inf, split: { ...L.split } };
  }
  window.live = { L, bench, frame: (u, t) => L.frame(u, t), times: { build: tBuilt - t0, warm: tWarm - tBuilt } };
  window.liveReady = true;
}
boot().catch((e) => { window.liveError = String(e && e.stack || e); console.error(e); });
