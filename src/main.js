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

gsap.registerPlugin(ScrollTrigger);
const lenis = new Lenis({ autoRaf: false, lerp: 0.12, wheelMultiplier: 0.9, smoothWheel: true });
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);
lenis.on('scroll', ScrollTrigger.update);

const app = { gsap, ScrollTrigger, lenis };
initMotion(app);
initMenu(app);
initSections(app);
initForms(app);
initReveals(app); // after the strip's pin (initSections), so the reveals below it measure past its spacer
initLive(app); // the admin's catalogue and contact details, when the API answers
initHero(app).catch((e) => console.error('hero', e));
window.__udha = app;
