// The privacy and terms pages: no film and no smooth scroll, only the footer's tools, consent and the company's
// contact details from the admin.
import { initMotion } from './ui/motion.js';
import { initTracking } from './ui/track.js';
import { initExtras } from './ui/extras.js';
import { fillSite } from './ui/live.js';

const app = { lenis: { options: {} } }; // the Stop switch still works here; there is just no smooth scroll to stop
initTracking(app);
initMotion(app);
initExtras(app);
fetch('/api/catalogue', { headers: { accept: 'application/json' } })
  .then((r) => (r.ok && (r.headers.get('content-type') || '').includes('json') ? r.json() : null))
  .then((d) => d?.site && fillSite(d.site))
  .catch(() => {});
