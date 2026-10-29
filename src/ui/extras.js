// Small page tools: the scroll progress bar (from Lenis on the home page, from the native scroll elsewhere) and the
// "copy the page link" button.
export function initExtras(app = {}) {
  const bar = document.querySelector('.scroll-progress i');
  if (bar) {
    const paint = (p) => { bar.style.transform = `scaleX(${Math.min(1, Math.max(0, p)).toFixed(4)})`; };
    if (app.lenis?.on) app.lenis.on('scroll', (l) => paint(l.progress || 0));
    else addEventListener('scroll', () => { const max = document.documentElement.scrollHeight - innerHeight; paint(max > 0 ? scrollY / max : 0); }, { passive: true });
  }
  for (const b of document.querySelectorAll('[data-copy-link]')) {
    const label = b.querySelector('span'), idle = label.textContent;
    let t = 0;
    b.addEventListener('click', async () => {
      const url = location.origin + location.pathname; // the page, without the visitor's own hash or campaign tags
      let ok = true;
      try { await navigator.clipboard.writeText(url); } catch { ok = false; }
      label.textContent = ok ? b.dataset.done : b.dataset.fail;
      b.classList.toggle('is-done', ok);
      clearTimeout(t);
      t = setTimeout(() => { label.textContent = idle; b.classList.remove('is-done'); }, 2400);
    });
  }
}
