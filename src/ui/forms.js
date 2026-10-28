// Test-drive booking (three steps), the order-from-Korea request (one step) and the payment calculator.
// No back end: every form says so when it is sent.
const rules = {
  car: (v) => !!v,
  model: (v) => v.trim().length >= 2,
  budget: (v) => /^\d[\d\s.,]*$/.test(v.trim()) && parseInt(v.replace(/\D/g, ''), 10) >= 1000,
  date: (v) => !!v && new Date(v) > new Date(new Date().toDateString()),
  name: (v) => v.trim().length >= 2,
  email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()),
  phone: (v) => v.replace(/[^\d]/g, '').length >= 6,
};

function multiStep(form) {
  const errs = JSON.parse(form.dataset.errors);
  const steps = [...form.querySelectorAll('.qstep')];
  const section = form.closest('section');
  const marks = [...section.querySelectorAll('.quote__steps li')];
  const next = form.querySelector('[data-next]');
  const prev = form.querySelector('[data-prev]');
  const nav = form.querySelector('.quote__nav');
  const done = form.querySelector('.quote__done');
  const note = form.querySelector('.form-note');
  let at = 0;
  const label = (k) => { next.firstChild.nodeValue = next.dataset[k] + ' '; };
  const date = form.querySelector('input[type="date"]');
  if (date) { const t = new Date(Date.now() + 864e5); date.min = t.toISOString().slice(0, 10); }

  function check(stepEl) {
    let first = null;
    for (const input of stepEl.querySelectorAll('[required]')) {
      const ok = rules[input.name] ? rules[input.name](input.value) : !!input.value.trim();
      const err = form.querySelector(`#${input.id}-e`);
      input.setAttribute('aria-invalid', String(!ok));
      if (err) { err.textContent = ok ? '' : errs[input.name] || ''; input.setAttribute('aria-describedby', err.id); }
      if (!ok && !first) first = input;
    }
    if (first) first.focus();
    return !first;
  }
  form.querySelectorAll('input, select').forEach((i) => i.addEventListener('input', () => {
    if (i.getAttribute('aria-invalid') === 'true' && (!rules[i.name] || rules[i.name](i.value))) { i.setAttribute('aria-invalid', 'false'); const e = form.querySelector(`#${i.id}-e`); if (e) e.textContent = ''; }
  }));
  function go(k) {
    steps[at].classList.remove('is-on'); steps[at].hidden = true;
    at = k;
    steps[at].hidden = false; steps[at].classList.add('is-on');
    marks.forEach((m, i) => m.classList.toggle('is-on', i === at));
    if (prev) prev.hidden = at === 0;
    label(at === steps.length - 1 ? 'labelSend' : 'labelNext');
    steps[at].querySelector('input, select, textarea')?.focus({ preventScroll: true });
  }
  prev?.addEventListener('click', () => go(at - 1));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!check(steps[at])) return;
    if (at < steps.length - 1) { go(at + 1); return; }
    label('labelSending');
    setTimeout(() => {
      steps.forEach((s) => { s.hidden = true; s.classList.remove('is-on'); });
      nav.hidden = true; if (note) note.hidden = true;
      done.hidden = false;
      done.querySelector('button').focus();
    }, 500);
  });
  done.querySelector('[data-again]').addEventListener('click', () => {
    form.reset();
    form.querySelectorAll('[aria-invalid]').forEach((i) => i.removeAttribute('aria-invalid'));
    done.hidden = true; nav.hidden = false; if (note) note.hidden = false;
    steps.forEach((s, i) => { s.hidden = i !== 0; s.classList.toggle('is-on', i === 0); });
    at = Math.min(1, steps.length - 1); go(0);
  });
  return { go: (k) => go(k), reset: () => { if (!done.hidden) done.querySelector('[data-again]').click(); if (at) go(0); } };
}

export function initForms(app) {
  const drive = document.querySelector('.mform[data-kind="drive"]');
  const order = document.querySelector('.mform[data-kind="order"]');
  const d = drive && multiStep(drive);
  const o = order && multiStep(order);
  app.preselectCar = (id) => { if (!drive) return; d.reset(); const s = drive.querySelector('#d-car'); if ([...s.options].some((x) => x.value === id)) s.value = id; };
  app.prefillOrder = (text) => { if (!order) return; o.reset(); order.querySelector('#o-model').value = text; };

  // ---------- payment calculator (annuity) ----------
  const calc = document.querySelector('.calc');
  if (!calc) return;
  const errs = JSON.parse(calc.dataset.errors);
  const lang = calc.dataset.lang;
  const out = document.querySelector('.calc__out');
  const monthly = out.querySelector('[data-monthly]'), total = out.querySelector('[data-total]');
  const fmt = (n) => { const s = Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, lang === 'sq' ? '.' : ','); return lang === 'sq' ? `€ ${s}` : `€${s}`; };
  const money = (v) => parseInt(String(v).replace(/[^\d]/g, ''), 10); // 27.400, 27,400 and 27 400 all read as 27400
  const decimal = (v) => parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
  const setErr = (name, msg) => { const i = calc.querySelector(`[name="${name}"]`); const e = calc.querySelector(`#c-${name}-e`); i.setAttribute('aria-invalid', String(!!msg)); e.textContent = msg || ''; if (msg) i.setAttribute('aria-describedby', e.id); };
  function compute() {
    const v = Object.fromEntries(new FormData(calc));
    const price = money(v.price), down = money(v.down || 0) || 0, rate = decimal(v.rate), months = +v.months;
    let bad = false;
    setErr('price', price > 0 ? '' : errs.price); bad ||= !(price > 0);
    setErr('down', down >= 0 && down < price ? '' : errs.down); bad ||= !(down >= 0 && down < price);
    setErr('rate', rate >= 0 && rate <= 30 ? '' : errs.rate); bad ||= !(rate >= 0 && rate <= 30);
    if (bad) { monthly.textContent = '—'; total.textContent = '—'; return; }
    const P = price - down, r = rate / 100 / 12;
    const m = r === 0 ? P / months : (P * r) / (1 - Math.pow(1 + r, -months));
    monthly.textContent = fmt(m);
    total.textContent = fmt(P);
  }
  calc.addEventListener('input', compute);
  calc.addEventListener('submit', (e) => e.preventDefault());
  compute();
}
