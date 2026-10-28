// Example stock for the prototype. Real models, invented prices, kilometres and availability.
// status: new = new in the showroom, used = used in the showroom, korea = chosen in Korea, on its way.
export default [
  { id: 'tucson-hev', make: 'Hyundai', model: 'Tucson Hybrid', year: 2026, km: 0, fuel: 'hybrid', gear: 'auto', body: 'suv', price: 38900, status: 'new', img: 'suv-blue' },
  { id: 'sportage', make: 'Kia', model: 'Sportage', year: 2026, km: 0, fuel: 'petrol', gear: 'auto', body: 'suv', price: 34500, status: 'new', img: 'suv-white' },
  { id: 'ioniq5', make: 'Hyundai', model: 'Ioniq 5', year: 2026, km: 0, fuel: 'ev', gear: 'auto', body: 'ev', price: 46900, status: 'new', img: 'ev-silver' },
  { id: 'ev6', make: 'Kia', model: 'EV6', year: 2026, km: 0, fuel: 'ev', gear: 'auto', body: 'ev', price: 48500, status: 'new', img: 'ev-white' },
  { id: 'gv70', make: 'Genesis', model: 'GV70', year: 2026, km: 0, fuel: 'petrol', gear: 'auto', body: 'suv', price: 58900, status: 'new', img: 'suv-black' },
  { id: 'torres', make: 'KGM', model: 'Torres', year: 2026, km: 0, fuel: 'petrol', gear: 'auto', body: 'suv', price: 32900, status: 'new', img: 'suv-green' },
  { id: 'santafe-21', make: 'Hyundai', model: 'Santa Fe', year: 2021, km: 82000, fuel: 'diesel', gear: 'auto', body: 'suv', price: 27400, status: 'used', img: 'suv-grey' },
  { id: 'sorento-20', make: 'Kia', model: 'Sorento', year: 2020, km: 96000, fuel: 'diesel', gear: 'auto', body: 'suv', price: 24900, status: 'used', img: 'suv-black' },
  { id: 'elantra-22', make: 'Hyundai', model: 'Elantra', year: 2022, km: 41000, fuel: 'petrol', gear: 'auto', body: 'sedan', price: 17800, status: 'used', img: 'sedan-white' },
  { id: 'niro-21', make: 'Kia', model: 'Niro Hybrid', year: 2021, km: 54000, fuel: 'hybrid', gear: 'auto', body: 'ev', price: 19900, status: 'used', img: 'ev-orange' },
  { id: 'picanto-21', make: 'Kia', model: 'Picanto', year: 2021, km: 38000, fuel: 'petrol', gear: 'manual', body: 'hatch', price: 9900, status: 'used', img: 'hatch-red' },
  { id: 'g80-20', make: 'Genesis', model: 'G80', year: 2020, km: 63000, fuel: 'petrol', gear: 'auto', body: 'sedan', price: 31500, status: 'used', img: 'sedan-black' },
  { id: 'k5-22', make: 'Kia', model: 'K5', year: 2022, km: 47000, fuel: 'petrol', gear: 'auto', body: 'sedan', price: 18900, status: 'korea', img: 'sedan-silver' },
  { id: 'kona-ev-22', make: 'Hyundai', model: 'Kona Electric', year: 2022, km: 36000, fuel: 'ev', gear: 'auto', body: 'ev', price: 21900, status: 'korea', img: 'ev-silver' },
];
// images the stills script renders: still-car-<img>.webp
export const CAR_IMAGES = { 'suv-blue': ['suv', '#2D4D78'], 'suv-white': ['suv', '#F2F2EE'], 'ev-silver': ['ev', '#A9AEB3'], 'ev-white': ['ev', '#F2F2EE'], 'suv-black': ['suv', '#1B1D21'], 'suv-green': ['suv', '#4D6A57'], 'suv-grey': ['suv', '#6C7177'], 'sedan-white': ['sedan', '#F2F2EE'], 'ev-orange': ['ev', '#FF6A2E'], 'hatch-red': ['hatch', '#9E2A2B'], 'sedan-black': ['sedan', '#1B1D21'], 'sedan-silver': ['sedan', '#A9AEB3'] };
