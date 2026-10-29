// Where the site lives and what its pages are called, for canonical URLs, hreflang, the sitemap and the legal links.
export const ORIGIN = 'https://lindja-prototype.netlify.app';
export const ROUTES = {
  sq: { home: '/', privacy: '/privatesia/', terms: '/kushtet/' },
  en: { home: '/en/', privacy: '/en/privacy/', terms: '/en/terms/' },
};
const MONTHS = {
  sq: ['janar', 'shkurt', 'mars', 'prill', 'maj', 'qershor', 'korrik', 'gusht', 'shtator', 'tetor', 'nëntor', 'dhjetor'], // Chrome ships no Albanian Intl data
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};
export const dateLabel = (lang, d = new Date()) => (lang === 'sq' ? `${d.getDate()} ${MONTHS.sq[d.getMonth()]} ${d.getFullYear()}` : `${d.getDate()} ${MONTHS.en[d.getMonth()]} ${d.getFullYear()}`);
export const isoDate = (d = new Date()) => d.toISOString().slice(0, 10);
