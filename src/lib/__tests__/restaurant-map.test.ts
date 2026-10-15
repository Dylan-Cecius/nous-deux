import { restaurantMapUrl } from '../restaurant-map';

const restaurant = { name: 'Chez Alice & Bob', place: 'Liège / Centre' };
const search = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Chez Alice & Bob Liège / Centre')}`;

test.each([
  undefined, '', 'not a url', 'javascript:alert(1)', 'tel:123', 'custom-app://action',
  'http://www.google.com/maps/place/test', 'https://google.com.evil.invalid/maps',
  'https://www.google.com@evil.invalid/maps', 'https://user@www.google.com/maps',
  'https://www.google.com:8443/maps', 'https://www.google.com/url?q=https://evil.invalid',
  'https://www.google.com/mapsevil', 'https://maps.google.com/url?q=evil',
  'https://www.google.com\\@evil.invalid/maps', 'https://www.goo\ngle.com/maps',
  'https://maps.app.goo.gl/unknown', 'https://evil.invalid/?maps=https://www.google.com/maps',
])('une adresse non autorisée revient à la recherche : %s', (mapsUrl) => {
  expect(restaurantMapUrl({ ...restaurant, mapsUrl })).toBe(search);
});

test.each([
  'https://www.google.com/maps/search/?api=1&query=Test',
  'https://google.com/maps/place/Test',
  'https://maps.google.com/?cid=123456',
  'https://maps.google.com/maps?cid=123456',
])('un lien HTTPS Maps confirmé reste précis : %s', (mapsUrl) => {
  expect(restaurantMapUrl({ ...restaurant, mapsUrl })).toBe(mapsUrl);
});

test('les caractères de recherche restent des données et non des paramètres supplémentaires', () => {
  const url = new URL(restaurantMapUrl({ name: 'Fictif &api=2#fragment', place: 'Liège' }));
  expect(url.searchParams.get('api')).toBe('1');
  expect(url.searchParams.get('query')).toBe('Fictif &api=2#fragment Liège');
  expect(url.hash).toBe('');
});

test('sans quartier, aucun espace inutile n’est ajouté', () => {
  expect(restaurantMapUrl({ name: 'Resto fictif' })).toBe('https://www.google.com/maps/search/?api=1&query=Resto%20fictif');
});
