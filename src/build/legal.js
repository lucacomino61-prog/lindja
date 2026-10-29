// The privacy policy and the terms of use: a reading page with the site's head tags and footer.
import { esc } from './car-card.js';
import { headTags, siteFooter, langSwitch } from './render.js';
import { ROUTES, dateLabel, isoDate } from './site.js';

const wordmark = '<svg class="wordmark" viewBox="0 0 150 44" aria-hidden="true"><text x="75" y="35" text-anchor="middle">lindja</text></svg>';
const back = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12H5m6-6-6 6 6 6"/></svg>';

export function renderLegal(t, all, kind, legal) {
  const L = legal[t.lang], doc = L[kind], R = ROUTES[t.lang];
  const other = kind === 'privacy' ? 'terms' : 'privacy';
  // the company email from the admin replaces this (ui/live.js), else it says who sets it
  const contact = `<span data-site="contact.email" data-bare>${esc(L.contact)}</span>`;
  const para = (p) => `<p>${esc(p).replace('{contact}', contact)}</p>`;
  return `<!doctype html>
<html lang="${t.lang}" data-motion="on">
<head>
${headTags(t, all, { kind, title: `${doc.title} · LINDJA`, description: doc.description })}
<link rel="preload" href="/fonts/bigshoulders-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/geist.woff2" as="font" type="font/woff2" crossorigin>
<script>try{if(localStorage.getItem('lindja-motion')==='off'||matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.dataset.motion='off'}catch(e){}document.documentElement.classList.add('js')</script>
<link rel="stylesheet" href="/src/styles/main.css">
</head>
<body class="legal-page">
<a class="skip-link" href="#main">${esc(t.skip)}</a>
<div class="scroll-progress" aria-hidden="true"><i></i></div>
<header class="legal-bar" id="top">
  <a class="brand" href="${R.home}" aria-label="LINDJA">${wordmark}</a>
  <nav class="legal-bar__nav" aria-label="${esc(t.nav.label)}"><a class="legal-bar__back" href="${R.home}">${back}<span>${esc(L.back)}</span></a>${langSwitch(t, all, 'lang--legal', kind)}</nav>
</header>
<main id="main" class="legal" tabindex="-1">
  <p class="legal__proto mono">${esc(t.proto)}</p>
  <h1 class="poster legal__h">${esc(doc.title)}</h1>
  <p class="legal__updated">${esc(L.updated)} <time datetime="${isoDate()}">${esc(dateLabel(t.lang))}</time></p>
  <p class="legal__intro">${esc(doc.intro)}</p>
  <nav class="legal__toc" aria-labelledby="toc-h"><p id="toc-h" class="mono">${esc(L.toc)}</p><ol>${doc.sections.map((s, i) => `<li><a href="#s${i + 1}">${esc(s.h)}</a></li>`).join('')}</ol></nav>
  ${doc.sections.map((s, i) => `<section class="legal__s" id="s${i + 1}" aria-labelledby="s${i + 1}-h"><h2 id="s${i + 1}-h">${esc(s.h)}</h2>${s.p.map(para).join('')}</section>`).join('\n  ')}
  <p class="legal__note">${esc(doc.note)}</p>
  <p class="legal__other"><a class="btn btn--ghost-ink" href="${R[other]}">${esc(L[other].title)} <svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg></a></p>
</main>
${siteFooter(t, all, kind)}
<script type="module" src="/src/legal.js"></script>
</body>
</html>`;
}
