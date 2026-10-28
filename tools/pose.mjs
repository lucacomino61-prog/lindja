// Render one custom camera pose at a given frame: node tools/pose.mjs out.jpg '{"t":[x,y,z],"az":0,"el":30,"dist":20,"fov":24,"shift":0}' [frame]
import fs from 'node:fs';
import { launch, openFilm } from './probe-frames.mjs';
const [out, poseJson, frame = '1074'] = process.argv.slice(2);
const b = await launch();
try {
  const p = await openFilm(b, { w: 1280, h: 720, variant: 'desktop', quality: 'draft' });
  const b64 = await p.evaluate(async (pose, f) => {
    const w = window.film.world; w.setFrame(f); w.applyPose(pose); w.scene.updateMatrixWorld(true); w.render();
    const c = document.getElementById('c'); const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
    return await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result.split(',')[1]); fr.readAsDataURL(blob); });
  }, JSON.parse(poseJson), +frame);
  fs.writeFileSync(out, Buffer.from(b64, 'base64'));
} finally { await b.close(); }
