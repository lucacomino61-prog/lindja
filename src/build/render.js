// Server-side page template for LINDJA: every word and every car is in the HTML before any script runs.
// The admin's live catalogue and contact details replace them in the browser when they differ (ui/live.js).
import { esc, euro, carCard, driveOptions, priceCap } from './car-card.js';
import { ORIGIN, ROUTES, dateLabel, isoDate } from './site.js';

const jsonLt = String.fromCharCode(92) + 'u003c';
const json = (v) => JSON.stringify(v).replace(/</g, jsonLt);

const icon = {
  arrow: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>',
  down: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v15m-6-6 6 6 6-6"/></svg>',
  chev: '<svg class="i i--chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
  plus: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  close: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
  search: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>',
  pause: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>',
  sun: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17h16M7 17a5 5 0 0 1 10 0M12 7V5M6.2 9.2 4.8 7.8M17.8 9.2l1.4-1.4"/></svg>',
  list: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  grid: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/></svg>',
  wheel: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.2"/><path d="M12 3.5v6.3M4.6 15.5l5.4-2.4M19.4 15.5 14 13.1"/></svg>',
  copy: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="1.5"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/></svg>',
};
const wordmark = (cls = '') => `<svg class="wordmark ${cls}" viewBox="0 0 150 44" aria-hidden="true"><text x="75" y="35" text-anchor="middle">lindja</text></svg>`;

const SCENES = [
  ['kore-lot', 'kore-hall', 'kore-gate'],
  ['port-ship', 'port-ramp', 'port-quay'],
  ['deti-ship', 'deti-isle'],
  ['durres-ship', 'durres-customs', 'durres-kolaudim'],
  ['salloni-room', 'salloni-lot', 'salloni-drive'],
];
const SHOWROOM_IDS = ['tirana', 'durres'];
// "Adresa: vendoset nga kompania" until the admin sets it; live.js swaps the value in
const siteField = (key, label, unset) => `<span data-site="${key}" data-label="${esc(label)}">${esc(label)}: ${esc(unset)}</span>`;
const honeypot = '<div class="hp" aria-hidden="true"><label>Website <input name="website" tabindex="-1" autocomplete="off"></label></div>';

export function langSwitch(t, all, cls = '', kind = 'home') {
  return `<ul class="lang ${cls}" aria-label="${esc(t.nav.language)}">${all.map((l) => `<li><a href="${ROUTES[l.lang][kind]}" hreflang="${l.lang}" lang="${l.lang}"${l.lang === t.lang ? ' aria-current="true"' : ''}><abbr title="${esc(l.label)}">${l.short}</abbr></a></li>`).join('')}</ul>`;
}
// what each menu row shows in the preview window when it is pointed at
const PREVIEW = { '#makinat?t=new': 'still-car-ev-white', '#makinat?t=used': 'still-car-suv-grey', '#makinat?f=ev': 'still-car-ev-silver', '#makinat?m=Hyundai': 'still-car-suv-blue', '#makinat?m=Kia': 'still-car-suv-white', '#makinat?m=Genesis': 'still-car-suv-black', '#makinat?m=KGM': 'still-car-suv-green', '#makinat': 'still-car-ev-orange', '#importi': 'scene-1-desktop', '#porosi': 'still-ship', '#financim': 'scene-4-desktop', '#udhezues': 'scene-3-desktop', '#sallonet': 'scene-4-desktop', '#test-drive': 'scene-4-desktop', '#kontakt': 'scene-0-desktop' };
// a port departures board: a code, the destination (its letters flap in, menu.js), an arrow
function panel(id, cols, cards) {
  let n = 0;
  const first = cols[0].links[0];
  return `<div class="mega__panel" id="panel-${id}" data-nav-content="${id}" role="region">
    <div class="mega__cols">${cols.map((c) => `<div class="mega__col" data-menu-fade><p class="mega__h">${esc(c.h)}</p><ul class="board">${c.links.map(([l, h]) => `<li><a class="board__row" href="${h}" data-close-menu data-preview="/media/${PREVIEW[h] || 'scene-0-desktop'}.webp"><span class="board__code mono">${String(++n).padStart(2, '0')}</span><span class="board__dest" data-flap>${esc(l)}</span><span class="board__go" aria-hidden="true">→</span></a></li>`).join('')}</ul></div>`).join('')}</div>
    <figure class="mega__preview" data-menu-fade aria-hidden="true"><img src="/media/${PREVIEW[first[1]] || 'scene-0-desktop'}.webp" alt="" width="1280" height="840" loading="lazy" decoding="async"><figcaption class="mono">${esc(first[0])}</figcaption></figure>
    ${cards.slice(0, 1).map((k) => `<a class="mega__cta mega__cta--${k.tone}" href="${k.href}" data-menu-fade data-close-menu data-track="${k.track}"><span class="mono">${esc(k.c.t)}</span><b>${esc(k.c.b)}</b><span class="mega__cta-a">${esc(k.c.a)} ${icon.arrow}</span></a>`).join('')}
  </div>`;
}

export function renderPage(t, all, cars) {
  const h = t.hero, n = t.nav, c = t.catalogue;
  const cDrive = { tone: 'signal', c: n.cardDrive, href: '#test-drive', img: 'still-car-ev-orange', track: 'mega-drive' };
  const cOrder = { tone: 'ink', c: n.cardOrder, href: '#porosi', img: 'still-ship', track: 'mega-order' };
  const cImport = { tone: 'ink', c: n.cardImport, href: '#importi', img: 'still-transporter', track: 'mega-import' };

  const header = `
<a class="skip-link" href="#main">${esc(t.skip)}</a>
<div class="scroll-progress" aria-hidden="true"><i></i></div>
<header class="site-header" data-menu-wrap data-menu-open="false">
  <a class="brand" href="${t.path}" aria-label="LINDJA">${wordmark()}</a>
  <nav class="site-nav" aria-label="${esc(n.label)}">
    <ul data-nav-list>
      <li><button type="button" class="nav-link" data-dropdown-toggle="cars" aria-expanded="false" aria-controls="panel-cars">${esc(n.cars)}${icon.chev}</button></li>
      <li><button type="button" class="nav-link" data-dropdown-toggle="import" aria-expanded="false" aria-controls="panel-import">${esc(n.import)}${icon.chev}</button></li>
      <li><button type="button" class="nav-link" data-dropdown-toggle="company" aria-expanded="false" aria-controls="panel-company">${esc(n.company)}${icon.chev}</button></li>
      <li><a class="nav-link" href="#kontakt">${esc(n.contact)}</a></li>
    </ul>
  </nav>
  <div class="site-header__tools">
    <button type="button" class="search-open" aria-expanded="false" aria-controls="site-search" aria-keyshortcuts="/">${icon.search}<span class="visually-hidden">${esc(n.search)}</span></button>
    ${langSwitch(t, all, 'lang--header')}
    <a class="tool-link" href="#test-drive" data-track="header-drive">${icon.wheel} ${esc(n.drive)}</a>
    <a class="btn btn--signal btn--header" href="#porosi" data-track="header-order">${esc(n.order)} ${icon.arrow}</a>
    <button type="button" class="burger" aria-expanded="false" aria-controls="mobile-menu"><span>${esc(n.menu)}</span><span class="burger__lines" aria-hidden="true"><i></i><i></i></span></button>
  </div>
  <div class="mega" data-dropdown-wrapper>
    <div class="mega__container" data-dropdown-container>
      ${panel('cars', n.carsCols, [cDrive, cOrder])}
      ${panel('import', n.importCols, [cImport, cOrder])}
      ${panel('company', n.companyCols, [cDrive, cImport])}
    </div>
  </div>
  <div class="site-search" id="site-search" role="dialog" aria-label="${esc(n.search)}" data-kinds="${esc(JSON.stringify(t.search.kinds))}" hidden>
    <form class="site-search__form" role="search" action="#"><label class="visually-hidden" for="ss-q">${esc(n.search)}</label>${icon.search}<input id="ss-q" type="search" placeholder="${esc(n.searchPh)}" autocomplete="off" aria-controls="ss-results"><button type="button" class="site-search__close" aria-label="${esc(n.close)}">${icon.close}</button></form>
    <p class="search-note" aria-live="polite" data-none="${esc(n.searchNone)}" data-count="${esc(n.searchCount)}"></p>
    <ul class="search-results" id="ss-results"></ul>
  </div>
</header>
<div class="mega-backdrop" data-menu-backdrop></div>
<div class="mobile-menu" id="mobile-menu" tabindex="-1" aria-label="${esc(n.menu)}" hidden>
  <form class="mm-search" role="search" action="#"><label class="visually-hidden" for="mm-q">${esc(n.search)}</label><input id="mm-q" type="search" placeholder="${esc(n.searchPh)}" autocomplete="off"><button type="submit" aria-label="${esc(n.search)}">${icon.search}</button></form>
  <p class="mm-search__note search-note" aria-live="polite" data-none="${esc(n.searchNone)}" data-count="${esc(n.searchCount)}"></p>
  <ul class="search-results search-results--menu"></ul>
  <ul class="mm-list">
    ${[[n.cars, n.carsCols], [n.import, n.importCols], [n.company, n.companyCols]].map(([lbl, cols]) => `<li><details><summary>${esc(lbl)}${icon.chev}</summary>${cols.map((col) => `<p class="mm-h">${esc(col.h)}</p><ul>${col.links.map(([l, hh]) => `<li><a href="${hh}" data-close-menu>${esc(l)}</a></li>`).join('')}</ul>`).join('')}</details></li>`).join('')}
    <li><a class="mm-link" href="#test-drive" data-close-menu>${esc(n.drive)}</a></li>
    <li><a class="mm-link" href="#kontakt" data-close-menu>${esc(n.contact)}</a></li>
  </ul>
  <a class="btn btn--signal btn--block" href="#porosi" data-close-menu data-track="menu-order">${esc(n.order)} ${icon.arrow}</a>
  ${langSwitch(t, all, 'lang--menu')}
</div>`;

  const spots = SCENES.map((ids, k) => ids.map((id) => {
    const cd = t.cards[id];
    return `<div class="spot" data-anchor="${id}" data-scene="${k}">
      <button type="button" class="spot__btn" aria-expanded="false" aria-controls="card-${id}"><span class="spot__plus">${icon.plus}</span><span class="spot__label">${esc(cd.title)}</span></button>
      <div class="spot__card" id="card-${id}" role="group" aria-label="${esc(cd.title)}" hidden>
        <p class="spot__title">${esc(cd.title)}</p>
        <ul class="tags">${cd.tags.map((g) => `<li>${esc(g)}</li>`).join('')}</ul>
        <p class="spot__text">${esc(cd.text)}</p>
        <a class="spot__more" href="#${cd.to}" data-track="spot-more">${esc(cd.more)} ${icon.arrow}</a>
        <button type="button" class="spot__close" aria-label="${esc(h.closeCard)}">${icon.close}</button>
      </div>
    </div>`;
  }).join('')).join('');

  const hero = `
<section class="hero" id="lindja-film" aria-labelledby="hero-h1" data-step="0">
  <script type="application/json" id="hero-steps">${json(h.steps)}</script>
  <div class="hero__pin">
  <div class="hero__stage" aria-hidden="true">
    <picture class="hero__poster"><source media="(max-aspect-ratio: 4/5)" srcset="/media/scene-0-phone.webp"><img src="/media/scene-0-desktop.webp" alt="" width="1920" height="1080" fetchpriority="high" decoding="async"></picture>
    <canvas class="hero__canvas"></canvas>
  </div>
  <div class="hero__spots">${spots}</div>
  <div class="hero__band">
    <div class="hero__sign">
      <p class="hero__place" aria-live="polite"><span class="mono hero__count">01 / 05</span> <span class="hero__placename">${esc(h.steps[0].place)}</span></p>
      <p class="hero__word" aria-hidden="true"><span class="hero__word-in">${esc(h.steps[0].word)}</span></p>
    </div>
    <div class="hero__copy">
      <h1 id="hero-h1">${esc(h.h1)}</h1>
      <p class="hero__lead">${esc(h.lead)}</p>
      <div class="cta-row">
        <a class="btn btn--signal" href="#makinat" data-track="hero-cars">${esc(h.ctaCars)} ${icon.arrow}</a>
        <a class="btn btn--ghost" href="#porosi" data-track="hero-order">${esc(h.ctaOrder)}</a>
      </div>
    </div>
  </div>
  <nav class="hero__rail" aria-label="${esc(h.stepsLabel)}">
    <ol>${h.steps.map((s, i) => `<li><button type="button" class="rail__btn" data-goto="${i}"${i === 0 ? ' aria-current="step"' : ''}><span class="mono">0${i + 1}</span><span class="rail__name">${esc(s.name)}</span><span class="rail__bar" aria-hidden="true"><i></i></span></button></li>`).join('')}</ol>
    <div class="rail__tools">
      <button type="button" class="motion-toggle" aria-pressed="false" data-label-stop="${esc(h.stop)}" data-label-start="${esc(h.start)}">${icon.pause}<span>${esc(h.stop)}</span></button>
      <a class="rail__skip" href="#manifest">${esc(h.skipMap)} ${icon.down}</a>
    </div>
  </nav>
  <p class="hero__hint" aria-hidden="true">${icon.down}<span>${esc(h.hint)}</span></p>
  <p class="proto-badge mono">${esc(t.proto)}</p>
  </div>
  <div class="loader" role="status">
    <div class="loader__mark">${wordmark('wordmark--loader')}</div>
    <p class="loader__line"><span>${esc(h.loading)}</span> <span class="mono loader__pct">0%</span></p>
    <span class="loader__bar" aria-hidden="true"><i></i></span>
    <button type="button" class="loader__skip">${esc(h.loaderSkip)} ${icon.arrow}</button>
  </div>
</section>`;

  const manifest = `
<section class="manifest" id="manifest" aria-labelledby="manifest-h">
  <h2 id="manifest-h" class="poster poster--xl">${t.manifest.lines.map((l) => `<span class="manifest__line">${esc(l)}</span>`).join('')}</h2>
  <div class="manifest__road" aria-hidden="true"><img class="manifest__truck" src="/media/still-transporter.webp" alt="" width="1280" height="840" loading="lazy" decoding="async"></div>
  <p class="manifest__text">${esc(t.manifest.text)}</p>
</section>`;

  const makes = [...new Set(cars.map((x) => x.make))];
  const cap = priceCap(cars);
  const sel = (name, label, opts) => `<div class="filter"><label for="f-${name}">${esc(label)}</label><select id="f-${name}" name="${name}"><option value="">${esc(c.any)}</option>${opts.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('')}</select></div>`;
  const { count, ...cStrings } = c; // the strings live.js needs to draw a card (the count function stays here)
  const catalogue = `
<section class="catalogue" id="makinat" aria-labelledby="cat-h" data-view="grid">
  <script type="application/json" id="cat-data">${json({ lang: t.lang, cars, strings: cStrings })}</script>
  <div class="catalogue__head">
    <h2 id="cat-h" class="poster poster--m">${esc(c.h)}</h2>
    <p>${esc(c.text)}</p>
  </div>
  <form class="filters" aria-controls="car-list" autocomplete="off">
    <div class="filter filter--status" role="radiogroup" aria-label="${esc(c.h)}">
      ${[['', c.all], ['new', c.fresh], ['used', c.used], ['korea', c.inKorea]].map(([v, l], i) => `<label class="seg"><input type="radio" name="status" value="${v}"${i === 0 ? ' checked' : ''}><span>${esc(l)}</span></label>`).join('')}
    </div>
    ${sel('make', c.make, makes.map((m) => [m, m]))}
    ${sel('body', c.body, Object.entries(c.bodies))}
    ${sel('fuel', c.fuel, Object.entries(c.fuels))}
    <div class="filter filter--range"><label for="f-price">${esc(c.price)} <output class="tabular" for="f-price" id="f-price-out">${euro(cap, t.lang)}</output></label><input id="f-price" name="price" type="range" min="8000" max="${cap}" step="1000" value="${cap}"></div>
    <div class="filter"><label for="f-sort">${esc(c.sort)}</label><select id="f-sort" name="sort">${c.sorts.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}</select></div>
  </form>
  <div class="catalogue__bar">
    <p class="catalogue__count mono" aria-live="polite" data-count-tpl="${esc(c.count('{n}'))}">${esc(c.count(cars.length))}</p>
    <div class="view-switch" role="group" aria-label="${esc(c.viewLabel)}">
      <button type="button" data-view="grid" aria-pressed="true">${icon.grid}<span>${esc(c.grid)}</span></button>
      <button type="button" data-view="list" aria-pressed="false">${icon.list}<span>${esc(c.list)}</span></button>
    </div>
  </div>
  <ul class="car-list" id="car-list">${cars.map((x) => carCard(x, c, t.lang)).join('')}</ul>
  <div class="catalogue__empty" hidden><p>${esc(c.empty)}</p><button type="button" class="btn btn--ghost-ink" data-reset>${esc(c.reset)}</button></div>
</section>`;

  const route = `
<section class="route" id="importi" aria-labelledby="route-h">
  <div class="route__pin">
    <div class="route__head">
      <h2 id="route-h" class="poster poster--m">${esc(t.route.h)}</h2>
      <p>${esc(t.route.text)}</p>
    </div>
    <div class="route__track">
      <span class="route__line" aria-hidden="true"><i></i></span>
      <ol class="legs">${t.route.legs.map((l, i) => `<li class="leg" data-leg="${i}">
        <span class="mono leg__n">0${i + 1}</span>
        <span class="leg__img"><img src="/media/scene-${i}-desktop.webp" alt="${esc(l.alt)}" width="1920" height="1080" loading="lazy" decoding="async"></span>
        <h3 class="leg__place">${esc(l.place)}</h3>
        <p class="leg__text">${esc(l.text)}</p></li>`).join('')}</ol>
    </div>
  </div>
</section>`;

  const d = t.drive;
  const errs = esc(json(d.errors));
  const order = `
<section class="order" id="porosi" aria-labelledby="order-h">
  <div class="order__intro">
    <h2 id="order-h" class="poster poster--m">${esc(t.order.h)}</h2>
    <p>${esc(t.order.text)}</p>
    <img src="/media/still-ship.webp" alt="" width="1280" height="840" loading="lazy" decoding="async">
  </div>
  <form class="mform" novalidate data-errors="${errs}" data-kind="order">
    ${honeypot}
    <fieldset class="qstep is-on" data-step="0"><legend class="visually-hidden">${esc(t.order.h)}</legend>
      <div class="field"><label for="o-model">${esc(d.model)}</label><input id="o-model" name="model" required placeholder="Hyundai Tucson, Kia EV6…"><p class="field__err" id="o-model-e"></p></div>
      <div class="field-row">
        <div class="field"><label for="o-budget">${esc(d.budget)}</label><input id="o-budget" name="budget" inputmode="numeric" class="tabular" required><p class="field__err" id="o-budget-e"></p></div>
        <div class="field"><label for="o-year">${esc(d.yearFrom)}</label><input id="o-year" name="yearFrom" inputmode="numeric" class="tabular" placeholder="2020" data-check><p class="field__err" id="o-year-e"></p></div>
      </div>
      <div class="field"><label for="o-name">${esc(d.name)}</label><input id="o-name" name="name" autocomplete="name" required><p class="field__err" id="o-name-e"></p></div>
      <div class="field-row">
        <div class="field"><label for="o-phone">${esc(d.phone)}</label><input id="o-phone" name="phone" type="tel" autocomplete="tel" required><p class="field__err" id="o-phone-e"></p></div>
        <div class="field"><label for="o-email">${esc(d.email)}</label><input id="o-email" name="email" type="email" autocomplete="email" required spellcheck="false"><p class="field__err" id="o-email-e"></p></div>
      </div>
    </fieldset>
    <p class="form-error" role="alert" hidden></p>
    <div class="quote__nav"><button type="submit" class="btn btn--ink" data-next data-label-next="${esc(d.sendOrder)}" data-label-send="${esc(d.sendOrder)}" data-label-sending="${esc(d.sending)}">${esc(d.sendOrder)} ${icon.arrow}</button></div>
    <p class="form-note">${esc(d.note)}</p>
    <div class="quote__done" hidden role="status"><p>${esc(d.doneOrder)}</p><button type="button" class="btn btn--ghost-ink" data-again>${esc(d.again)}</button></div>
  </form>
</section>`;

  const f = t.finance;
  const finance = `
<section class="finance" id="financim" aria-labelledby="fin-h">
  <div class="finance__intro"><h2 id="fin-h">${esc(f.h)}</h2><p>${esc(f.text)}</p></div>
  <form class="calc" novalidate data-errors="${esc(json(f.errors))}" data-lang="${t.lang}">
    <div class="field"><label for="c-price">${esc(f.price)}</label><input id="c-price" name="price" inputmode="numeric" class="tabular" value="27400"><p class="field__err" id="c-price-e"></p></div>
    <div class="field"><label for="c-down">${esc(f.down)}</label><input id="c-down" name="down" inputmode="numeric" class="tabular" value="7000"><p class="field__err" id="c-down-e"></p></div>
    <div class="field field--pills"><span class="field__l" id="c-months-l">${esc(f.months)}</span><div class="pills" role="radiogroup" aria-labelledby="c-months-l">${[24, 36, 48, 60, 72].map((m) => `<label><input type="radio" name="months" value="${m}"${m === 48 ? ' checked' : ''}><span class="tabular">${m}</span></label>`).join('')}</div></div>
    <div class="field"><label for="c-rate">${esc(f.rate)} <span class="mono calc__ex">${esc(t.example)}</span></label><input id="c-rate" name="rate" inputmode="decimal" class="tabular" value="7.5"><p class="field__err" id="c-rate-e"></p></div>
  </form>
  <div class="calc__out" aria-live="polite">
    <p class="calc__label">${esc(f.monthly)}</p>
    <p class="calc__big tabular" data-monthly aria-hidden="true">—</p>
    <p class="visually-hidden" data-monthly-sr></p>
    <p class="calc__sub"><span>${esc(f.total)}</span> <span class="tabular" data-total>—</span></p>
    <p class="calc__note">${esc(f.note)}</p>
  </div>
</section>`;

  const showrooms = `
<section class="showrooms" id="sallonet" aria-labelledby="sr-h">
  <h2 id="sr-h" class="poster poster--m">${esc(t.showrooms.h)}</h2>
  <ul class="sr-list">${t.showrooms.items.map((s, i) => `<li class="sr">
    <img src="/media/scene-${i === 0 ? 4 : 3}-desktop.webp" alt="${esc(s.alt)}" width="1920" height="1080" loading="lazy" decoding="async">
    <h3 class="sr__city">${esc(s.city)}</h3><p class="sr__role">${esc(s.role)}</p>
    <p class="sr__meta">${siteField(`${SHOWROOM_IDS[i]}.address`, t.showrooms.addrLabel, t.unset)}<br>${siteField(`${SHOWROOM_IDS[i]}.hours`, t.showrooms.hoursLabel, t.unset)}</p></li>`).join('')}</ul>
</section>`;

  const drive = `
<section class="quote" id="test-drive" aria-labelledby="drive-h">
  <div class="quote__intro">
    <h2 id="drive-h" class="poster poster--m">${esc(d.h)}</h2>
    <p>${esc(d.text)}</p>
    <ol class="quote__steps mono" aria-hidden="true">${d.steps.map((s, i) => `<li data-step="${i}"${i === 0 ? ' class="is-on"' : ''}>0${i + 1} ${esc(s)}</li>`).join('')}</ol>
  </div>
  <form class="mform quote__form" novalidate data-errors="${errs}" data-kind="drive">
    ${honeypot}
    <fieldset class="qstep is-on" data-step="0"><legend class="visually-hidden">${esc(d.steps[0])}</legend>
      <div class="field"><label for="d-car">${esc(d.car)}</label><select id="d-car" name="car" required><option value="">${esc(d.carPh)}</option>${driveOptions(cars)}</select><p class="field__err" id="d-car-e"></p></div>
      <div class="field field--pills"><span class="field__l" id="d-sr-l">${esc(d.showroom)}</span><div class="pills" role="radiogroup" aria-labelledby="d-sr-l">${t.showrooms.items.map((s, i) => `<label><input type="radio" name="showroom" value="${SHOWROOM_IDS[i]}"${i === 0 ? ' checked' : ''}><span>${esc(s.city)}</span></label>`).join('')}</div></div>
    </fieldset>
    <fieldset class="qstep" data-step="1" hidden><legend class="visually-hidden">${esc(d.steps[1])}</legend>
      <div class="field"><label for="d-date">${esc(d.date)}</label><input id="d-date" name="date" type="date" required><p class="field__err" id="d-date-e"></p></div>
      <div class="field field--pills"><span class="field__l" id="d-time-l">${esc(d.time)}</span><div class="pills" role="radiogroup" aria-labelledby="d-time-l">${d.times.map((tm, i) => `<label><input type="radio" name="time" value="${tm}"${i === 0 ? ' checked' : ''}><span class="tabular">${tm}</span></label>`).join('')}</div></div>
    </fieldset>
    <fieldset class="qstep" data-step="2" hidden><legend class="visually-hidden">${esc(d.steps[2])}</legend>
      <div class="field"><label for="d-name">${esc(d.name)}</label><input id="d-name" name="name" autocomplete="name" required><p class="field__err" id="d-name-e"></p></div>
      <div class="field-row">
        <div class="field"><label for="d-phone">${esc(d.phone)}</label><input id="d-phone" name="phone" type="tel" autocomplete="tel" required><p class="field__err" id="d-phone-e"></p></div>
        <div class="field"><label for="d-email">${esc(d.email)}</label><input id="d-email" name="email" type="email" autocomplete="email" required spellcheck="false"><p class="field__err" id="d-email-e"></p></div>
      </div>
      <div class="field"><label for="d-notes">${esc(d.notes)}</label><textarea id="d-notes" name="notes" rows="3"></textarea></div>
    </fieldset>
    <p class="form-error" role="alert" hidden></p>
    <div class="quote__nav">
      <button type="button" class="btn btn--ghost-ink" data-prev hidden>${esc(d.prev)}</button>
      <button type="submit" class="btn btn--ink" data-next data-label-next="${esc(d.next)}" data-label-send="${esc(d.send)}" data-label-sending="${esc(d.sending)}">${esc(d.next)} ${icon.arrow}</button>
    </div>
    <p class="form-note">${esc(d.note)}</p>
    <div class="quote__done" hidden role="status"><p>${esc(d.done)}</p><button type="button" class="btn btn--ghost-ink" data-again>${esc(d.again)}</button></div>
  </form>
</section>`;

  const guides = `
<section class="guides" id="udhezues" aria-labelledby="guides-h">
  <h2 id="guides-h">${esc(t.guides.h)}</h2>
  <ul class="guides__list">${t.guides.items.map((g) => `<li class="guide"><span class="guide__rule" aria-hidden="true"></span><p class="guide__k">${esc(g.k)}</p><h3>${esc(g.h)}</h3><p>${esc(g.t)}</p></li>`).join('')}</ul>
</section>`;

  return `<!doctype html>
<html lang="${t.lang}" data-motion="on">
<head>
${headTags(t, all, { kind: 'home', title: t.meta.title, description: t.meta.description })}
<link rel="preload" href="/fonts/bigshoulders-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/geist.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/media/film.json" as="fetch" crossorigin>
<script>try{if(localStorage.getItem('lindja-motion')==='off'||matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.dataset.motion='off'}catch(e){}if(history.scrollRestoration)history.scrollRestoration='manual';document.documentElement.classList.add('js')</script>
<link rel="stylesheet" href="/src/styles/main.css">
</head>
<body>
${header}
<main id="main" tabindex="-1">
${hero}
${manifest}
${catalogue}
${route}
${order}
${finance}
${showrooms}
${drive}
${guides}
</main>
<nav class="dock" aria-label="${esc(t.dock.label)}" hidden>
  <span class="dock__here mono"><span class="visually-hidden">${esc(t.dock.here)}: </span><span data-dock-here>${esc(t.dock.top)}</span></span>
  <a class="dock__a" href="#makinat">${esc(n.cars)}</a>
  <button type="button" class="dock__b" data-garage-open><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/></svg><span class="visually-hidden">${esc(t.dock.garage)}</span><b class="dock__n" data-garage-n>0</b></button>
  <button type="button" class="dock__b" data-compare-open hidden>${esc(t.dock.compare)} <b class="dock__n" data-compare-n>0</b></button>
  <button type="button" class="dock__b" data-dock-search><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg><span class="visually-hidden">${esc(t.dock.search)}</span></button>
  <a class="btn btn--signal btn--sm dock__cta" href="#porosi" data-track="dock-order">${esc(t.dock.order)} ${icon.arrow}</a>
  <p class="visually-hidden" aria-live="polite" data-dock-say></p>
</nav>
<dialog class="sheet" id="garage" aria-labelledby="garage-h" data-strings="${esc(JSON.stringify({ g: t.garage, c: t.compare, cat: { fuels: c.fuels, gear: c.gear, bodies: c.bodies, km: c.km, newBadge: c.newBadge, usedBadge: c.usedBadge, inKorea: c.inKorea, drive: c.drive } }))}"></dialog>
<dialog class="sheet sheet--wide" id="compare" aria-labelledby="compare-h"></dialog>
${siteFooter(t, all, 'home')}
<script type="module" src="/src/main.js"></script>
</body>
</html>`;
}

// ---------- shared by the home page and the legal pages ----------
// title, description, canonical, hreflang (absolute, for this kind of page in each language), share tags, icons
export function headTags(t, all, { kind, title, description }) {
  const url = ORIGIN + ROUTES[t.lang][kind];
  const og = t.share;
  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="noindex">
<link rel="canonical" href="${url}">
${all.map((l) => `<link rel="alternate" hreflang="${l.lang}" href="${ORIGIN}${ROUTES[l.lang][kind]}">`).join('\n')}
<link rel="alternate" hreflang="x-default" href="${ORIGIN}${ROUTES.sq[kind]}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="LINDJA">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:locale" content="${og.locale}">
<meta property="og:image" content="${ORIGIN}/media/og-${t.lang}.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(og.imageAlt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#EEF0EC">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">`;
}

// kind: 'home' (section links stay in the page) or a legal page (they go back to the home page)
export function siteFooter(t, all, kind) {
  const n = t.nav, h = t.hero, ft = t.footer, R = ROUTES[t.lang];
  const at = kind === 'home' ? '' : R.home; // "#makinat" on the home page, "/#makinat" elsewhere
  return `
<footer class="site-footer" id="kontakt">
  <p class="site-footer__mark" aria-hidden="true">lindja</p>
  <div class="site-footer__grid">
    <div><p class="mono">${esc(ft.contact)}</p><ul><li>${siteField('contact.address', ft.addressLabel, t.unset)}</li><li>${siteField('contact.phone', ft.phoneLabel, t.unset)}</li><li>${siteField('contact.email', ft.emailLabel, t.unset)}</li></ul></div>
    <div><p class="mono">${esc(ft.cols)}</p><ul><li><a href="${at}#makinat">${esc(n.cars)}</a></li><li><a href="${at}#importi">${esc(t.route.h)}</a></li><li><a href="${at}#porosi">${esc(n.order)}</a></li><li><a href="${at}#test-drive">${esc(n.drive)}</a></li></ul></div>
    <div><p class="mono">${esc(n.language)}</p>${langSwitch(t, all, 'lang--footer', kind)}
      <button type="button" class="motion-toggle motion-toggle--footer" aria-pressed="false" data-label-stop="${esc(h.stop)}" data-label-start="${esc(h.start)}">${icon.pause}<span>${esc(h.stop)}</span></button></div>
  </div>
  <ul class="site-footer__links">
    <li><a href="${R.privacy}"${kind === 'privacy' ? ' aria-current="page"' : ''}>${esc(ft.privacy)}</a></li>
    <li><a href="${R.terms}"${kind === 'terms' ? ' aria-current="page"' : ''}>${esc(ft.terms)}</a></li>
    <li><button type="button" class="link-btn" data-consent-open>${esc(ft.consent)}</button></li>
    <li><button type="button" class="link-btn" data-copy-link data-done="${esc(ft.copied)}" data-fail="${esc(ft.copyFail)}">${icon.copy}<span aria-live="polite">${esc(ft.copy)}</span></button></li>
  </ul>
  <p class="site-footer__legal">${esc(ft.legal)}</p>
  <p class="site-footer__legal">${esc(ft.credit)} <a href="/models/sketchfab/CREDITS.txt">${esc(ft.creditLink)}</a></p>
  <p class="site-footer__legal">${esc(ft.updated)} <time datetime="${isoDate()}">${esc(dateLabel(t.lang))}</time></p>
  <a class="site-footer__top" href="${kind === 'home' ? '#lindja-film' : '#top'}">${esc(ft.top)} ${icon.arrow}</a>
  <div class="consent" id="consent" role="region" aria-labelledby="consent-h" hidden>
    <p class="consent__h" id="consent-h">${esc(t.consent.h)}</p>
    <p class="consent__text">${esc(t.consent.text)}</p>
    <div class="consent__acts">
      <button type="button" class="btn btn--ink btn--sm" data-consent="yes">${esc(t.consent.accept)}</button>
      <button type="button" class="btn btn--ghost-ink btn--sm" data-consent="no">${esc(t.consent.decline)}</button>
      <a class="consent__more" href="${R.privacy}#s5">${esc(t.consent.more)}</a>
    </div>
  </div>
  <p class="visually-hidden" id="consent-status" aria-live="polite" data-yes="${esc(t.consent.saved.yes)}" data-no="${esc(t.consent.saved.no)}"></p>
</footer>`;
}
