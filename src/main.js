// One clock: GSAP's ticker drives Lenis, the film engine and every scroll effect. Nothing else calls rAF.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { initMotion } from './ui/motion.js';
import { initMenu } from './ui/menu.js';
import { initHero } from './hero/hero.js';
import { initSections } from './ui/sections.js';
import { initForms } from './ui/forms.js';
import { initReveals } from './ui/reveals.js';
import { initLive } from './ui/live.js';
import { initTracking } from './ui/track.js';
import { initSearch } from './ui/search.js';
import { initExtras } from './ui/extras.js';
import { initFeel } from './ui/feel.js';
import { initGarage } from './ui/garage.js';

gsap.registerPlugin(ScrollTrigger);
const lenis = new Lenis({ autoRaf: false, lerp: 0.12, wheelMultiplier: 0.9, smoothWheel: true });
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);
lenis.on('scroll', ScrollTrigger.update);

const app = { gsap, ScrollTrigger, lenis };
initTracking(app); // consent first: nothing is counted before it
initMotion(app);
initMenu(app);
initSections(app);
initForms(app);
// the reveals split every heading into words and measure the page: none of it is on screen while the film holds
// the first view, so it waits for an idle moment instead of blocking the first second (still after the strip's pin,
// so the reveals below it measure past its spacer)
(window.requestIdleCallback || ((f) => setTimeout(f, 200)))(() => initReveals(app), { timeout: 1500 });
initLive(app); // the admin's catalogue and contact details, when the API answers
initSearch(app);
initExtras(app);
initGarage(app);
initFeel(app);
initHero(app).catch((e) => console.error('hero', e));
window.__udha = app;
