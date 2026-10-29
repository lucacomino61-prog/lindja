// What the world is built for: the offline film (full models) or the live page (light models, tree impostors).
// createWorld sets it before anything loads.
export const Q = { live: false, tier: 'high' };
// ground pictures: full size for the film (world/assets), browser size for the live page (public/live, tools/live-assets.mjs)
export const groundUrl = (name) => (Q.live ? `/live/${name}.webp` : `/world/assets/polyhaven/${name}_${name.startsWith('aerial') ? '2k' : '1k'}.jpg`);
// models with a live copy in public/models/live (tools/live-models.mjs): same look, a fraction of the triangles
export const LIVE_FILES = new Set(['tugboat', 'ship-container', 'trailer-cars', 'container-open', 'tree-cypress-lo', 'forklift', 'worker',
  'car-sedan-xlo', 'car-hatch-xlo', 'car-suv-xlo', 'car-ev-xlo', // -xlo: ~800-triangle cars for the parked rows
  // light already: copied as they are, so the live page needs nothing from public/models/sketchfab
  'car-sedan-lo', 'car-hatch-lo', 'car-suv-lo', 'car-ev-lo', 'tree-olive-lo', 'tree-pine', 'truck-cab', 'container-box']);
