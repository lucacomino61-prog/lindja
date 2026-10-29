// Server-side checks for everything that comes in. The browser checks the same things first; these are
// the ones that count.
import { CAR_IMAGES } from '../../src/content/cars.js';

export const MAKES = ['Hyundai', 'Kia', 'Genesis', 'KGM'];
export const FUELS = ['petrol', 'diesel', 'hybrid', 'ev'];
export const GEARS = ['auto', 'manual'];
export const BODIES = ['suv', 'sedan', 'hatch', 'ev'];
export const STATUSES = ['new', 'used', 'korea'];
export const SHOWROOMS = ['tirana', 'durres'];
export const TIMES = ['10:00', '12:00', '15:00', '17:00'];
export const REQUEST_STATES = ['new', 'contacted', 'closed'];
const YEAR_MAX = new Date().getFullYear() + 1;

const str = (v, min, max) => typeof v === 'string' && v.trim().length >= min && v.trim().length <= max;
const int = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
const clean = (v) => String(v ?? '').trim().replace(/\s+/g, ' ');
const digits = (v) => clean(v).replace(/[^\d]/g, '');
const money = (v) => parseInt(String(v ?? '').replace(/[^\d]/g, ''), 10);
const email = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean(v)) && clean(v).length <= 120;

// ---------- where a visit came from: utm_source / utm_medium / utm_campaign, or the referring site ----------
export const token = (v) => String(v ?? '').toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 40);
export const checkSource = (u) => (u && typeof u === 'object' ? { source: token(u.source) || 'direct', medium: token(u.medium), campaign: token(u.campaign) } : null);
export const CTAS = ['hero-cars', 'hero-order', 'header-order', 'header-drive', 'menu-order', 'car-drive', 'car-ask', 'mega-drive', 'mega-order', 'mega-import', 'spot-more', 'dock-order'];
export const EVENT_TYPES = ['view', 'cta', 'form_start', 'form_ok', 'form_error', 'search'];

// ---------- a test-drive booking or an order request from the site ----------
export function checkRequest(body, cars) {
  const errors = [];
  const d = body?.data || {};
  // the campaign that brought the visitor, only sent when they accepted counting
  const out = { kind: body?.kind, lang: body?.lang === 'en' ? 'en' : 'sq', source: checkSource(body?.utm) };
  const need = (ok, field) => { if (!ok) errors.push(field); };
  need(str(d.name, 2, 80), 'name');
  need(digits(d.phone).length >= 6 && digits(d.phone).length <= 20, 'phone');
  need(email(d.email), 'email');
  const contact = { name: clean(d.name), phone: clean(d.phone), email: clean(d.email).toLowerCase() };
  if (out.kind === 'drive') {
    const car = cars.find((c) => c.id === d.car && c.status !== 'korea');
    need(!!car, 'car');
    need(SHOWROOMS.includes(d.showroom), 'showroom');
    const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
    need(/^\d{4}-\d{2}-\d{2}$/.test(d.date || '') && d.date >= tomorrow && d.date <= new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10), 'date');
    need(TIMES.includes(d.time), 'time');
    need(d.notes == null || (typeof d.notes === 'string' && d.notes.length <= 1000), 'notes');
    out.data = { ...contact, car: d.car, carLabel: car ? `${car.make} ${car.model} ${car.year}` : '', showroom: d.showroom, date: d.date, time: d.time, notes: clean(d.notes || '') };
  } else if (out.kind === 'order') {
    need(str(d.model, 2, 80), 'model');
    const budget = money(d.budget);
    need(budget >= 1000 && budget <= 10_000_000, 'budget');
    const yearFrom = d.yearFrom ? parseInt(digits(d.yearFrom), 10) : null;
    need(yearFrom == null || int(yearFrom, 1990, YEAR_MAX), 'yearFrom');
    out.data = { ...contact, model: clean(d.model), budget, yearFrom };
  } else errors.push('kind');
  return { errors, value: out };
}

// ---------- the catalogue, as the admin saves it ----------
export function checkCars(list) {
  if (!Array.isArray(list) || list.length > 80) return { errors: ['list'] };
  const errors = [];
  const ids = new Set();
  const cars = list.map((c, i) => {
    const car = {
      id: clean(c.id).toLowerCase(), make: c.make, model: clean(c.model), year: Number(c.year), km: Number(c.km) || 0,
      fuel: c.fuel, gear: c.gear, body: c.body, price: Number(c.price), status: c.status, img: c.img,
    };
    const bad = [];
    if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(car.id) || ids.has(car.id)) bad.push('id');
    ids.add(car.id);
    if (!MAKES.includes(car.make)) bad.push('make');
    if (!str(car.model, 1, 40)) bad.push('model');
    if (!int(car.year, 1990, YEAR_MAX)) bad.push('year');
    if (!int(car.km, 0, 1_000_000)) bad.push('km');
    if (!FUELS.includes(car.fuel)) bad.push('fuel');
    if (!GEARS.includes(car.gear)) bad.push('gear');
    if (!BODIES.includes(car.body)) bad.push('body');
    if (!int(car.price, 1000, 500_000)) bad.push('price');
    if (!STATUSES.includes(car.status)) bad.push('status');
    if (!Object.hasOwn(CAR_IMAGES, car.img)) bad.push('img');
    if (bad.length) errors.push({ i, fields: bad });
    return car;
  });
  return { errors, cars };
}

// ---------- contact details and showrooms ----------
export function checkSite(s) {
  const f = (v, max) => (typeof v === 'string' && v.length <= max ? clean(v) : null);
  const site = {
    contact: { address: f(s?.contact?.address, 160), phone: f(s?.contact?.phone, 40), email: f(s?.contact?.email, 120) },
    showrooms: Object.fromEntries(SHOWROOMS.map((k) => [k, { address: f(s?.showrooms?.[k]?.address, 160), hours: f(s?.showrooms?.[k]?.hours, 120) }])),
  };
  const errors = [];
  for (const [k, v] of Object.entries(site.contact)) if (v == null) errors.push(`contact.${k}`);
  if (site.contact.email && !email(site.contact.email)) errors.push('contact.email');
  for (const k of SHOWROOMS) for (const [f2, v] of Object.entries(site.showrooms[k])) if (v == null) errors.push(`${k}.${f2}`);
  return { errors, site };
}
