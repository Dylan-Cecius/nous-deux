/** Tire un élément au hasard (pour « on mange où ? », « on regarde quoi ? »). */
export function pickOne<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}
