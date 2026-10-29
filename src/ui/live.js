// The admin's catalogue and contact details, fetched once per visit. The page is already complete without them
// (built from src/content/cars.js); this only redraws what the admin changed. No API answering (a plain static
// preview) leaves the page as built.
import { driveOptions, esc } from '../build/car-card.js';

export async function initLive(app) {
  const built = JSON.parse(document.getElementById('cat-data')?.textContent || 'null');
  if (!built) return;
  let data;
  try {
    const res = await fetch('/api/catalogue', { headers: { accept: 'application/json' } });
    if (!res.ok || !(res.headers.get('content-type') || '').includes('json')) return;
    data = await res.json();
  } catch { return; }
  if (!data?.ok) return;

  if (JSON.stringify(data.cars) !== JSON.stringify(built.cars)) {
    app.setCatalogue?.(data.cars, built.strings, built.lang);
    const sel = document.getElementById('d-car');
    if (sel) {
      const keep = sel.value;
      sel.innerHTML = sel.options[0].outerHTML + driveOptions(data.cars);
      if ([...sel.options].some((o) => o.value === keep)) sel.value = keep;
    }
    app.ScrollTrigger.refresh();
  }

  fillSite(data.site);
}

// "Adresa: vendoset nga kompania" → the real value, phones and emails as links; [data-bare] = the value alone
export function fillSite(site) {
  for (const el of document.querySelectorAll('[data-site]')) {
    const [group, field] = el.dataset.site.split('.');
    const v = (group === 'contact' ? site?.contact?.[field] : site?.showrooms?.[group]?.[field]) || '';
    if (!v) continue;
    const label = el.hasAttribute('data-bare') ? '' : `${esc(el.dataset.label)}: `;
    if (field === 'phone') el.innerHTML = `${label}<a href="tel:${esc(v.replace(/[^\d+]/g, ''))}">${esc(v)}</a>`;
    else if (field === 'email') el.innerHTML = `${label}<a href="mailto:${esc(v)}">${esc(v)}</a>`;
    else el.textContent = `${label}${v}`;
  }
}
