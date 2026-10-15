import type { Restaurant } from './types';

/** Une donnée enregistrée ne doit pas lancer un protocole ou une application arbitraire. */
export function restaurantMapUrl(restaurant: Pick<Restaurant, 'name' | 'place' | 'mapsUrl'>): string {
  const raw = restaurant.mapsUrl;
  if (typeof raw === 'string' && raw.length <= 2000 && !/[\u0000-\u0020\u007f\\]/.test(raw)) {
    try {
      const url = new URL(raw);
      const mapsPath = url.pathname === '/maps' || url.pathname.startsWith('/maps/');
      const allowed = ((url.hostname === 'www.google.com' || url.hostname === 'google.com') && mapsPath) ||
        (url.hostname === 'maps.google.com' && (url.pathname === '/' || mapsPath));
      if (url.protocol === 'https:' && !url.username && !url.password && !url.port && allowed) return url.href;
    } catch { /* Adresse ancienne ou mal formée : rechercher le nom et le quartier. */ }
  }
  const query = [restaurant.name, restaurant.place].filter(Boolean).join(' ').trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
