// One car card, used twice: by the build (render.js, in Node) and by the browser when the admin's catalogue
// differs from the one built into the page (ui/live.js). Plain strings, no DOM.
export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const group = (n, sep) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
export const euro = (n, lang) => (lang === 'sq' ? `€ ${group(n, '.')}` : `€${group(n, ',')}`);
export const kmf = (n, lang) => group(n, lang === 'sq' ? '.' : ',');
const arrow = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>';

// c = the page's catalogue strings (content/<lang>.js → catalogue)
export function carCard(x, c, lang) {
  const badge = x.status === 'new' ? c.newBadge : x.status === 'used' ? c.usedBadge : c.inKorea;
  return `<li class="car" data-id="${esc(x.id)}" data-status="${x.status}" data-make="${esc(x.make)}" data-body="${x.body}" data-fuel="${x.fuel}" data-price="${x.price}" data-year="${x.year}">
    <article class="car__in" aria-labelledby="car-${esc(x.id)}">
      <div class="car__img"><img src="/media/still-car-${esc(x.img)}.webp" alt="" width="1280" height="840" loading="lazy" decoding="async"><span class="car__badge car__badge--${x.status}">${esc(badge)}</span></div>
      <h3 class="car__name" id="car-${esc(x.id)}"><span class="car__make">${esc(x.make)}</span> ${esc(x.model)}</h3>
      <p class="car__spec mono"><span>${x.year}</span>${x.km ? `<span>${kmf(x.km, lang)} ${esc(c.km)}</span>` : ''}<span>${esc(c.fuels[x.fuel])}</span><span>${esc(c.gear[x.gear])}</span></p>
      <p class="car__price"><span class="car__amount tabular">${euro(x.price, lang)}</span><span class="car__plabel">${esc(c.priceLabel)}</span></p>
      <div class="car__acts">
        ${x.status === 'korea' ? '' : `<a class="btn btn--ink btn--sm" href="#test-drive" data-car="${esc(x.id)}" data-track="car-drive">${esc(c.drive)} ${arrow}</a>`}
        <a class="btn btn--ghost-ink btn--sm" href="#porosi" data-ask="${esc(`${x.make} ${x.model} ${x.year}`)}" data-track="car-ask">${esc(c.ask)}</a>
      </div>
    </article></li>`;
}
// the test-drive select: cars that are already in Albania
export const driveOptions = (cars) => cars.filter((x) => x.status !== 'korea').map((x) => `<option value="${esc(x.id)}">${esc(`${x.make} ${x.model} · ${x.year}`)}</option>`).join('');
// the slider's top: the dearest car, rounded up, never under 60 000
export const priceCap = (cars) => Math.max(60000, Math.ceil(Math.max(0, ...cars.map((x) => x.price)) / 1000) * 1000);
