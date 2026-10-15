const pad = (n: number) => String(n).padStart(2, '0');

export function toKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey(): string {
  return toKey(new Date());
}

export function addDays(key: string, days: number): string {
  const d = fromKey(key);
  d.setDate(d.getDate() + days);
  return toKey(d);
}

/** Nombre de jours entiers entre deux dates (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((fromKey(b).getTime() - fromKey(a).getTime()) / 86_400_000);
}

/** Prochaine occurrence d'une date (pour les dates qui reviennent chaque année). */
export function nextOccurrence(key: string, yearly: boolean): string {
  if (!yearly) return key;
  const today = todayKey();
  const [, m, d] = key.split('-');
  const year = new Date().getFullYear();
  // Conserver le report au 1er mars déjà utilisé par Date pour un 29 février
  // hors année bissextile, mais comparer une date réelle, pas « YYYY-02-29 ».
  const occurrence = (y: number) => toKey(new Date(y, Number(m) - 1, Number(d)));
  const thisYear = occurrence(year);
  return thisYear >= today ? thisYear : occurrence(year + 1);
}

export function formatLong(key: string): string {
  return fromKey(key).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function formatShort(key: string): string {
  return fromKey(key).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function weekdayShort(key: string): string {
  return fromKey(key).toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '');
}

/** « 1 337 » avec une espace insécable classique (l'espace fine de fr-FR manque dans certaines polices). */
export function formatNumber(n: number): string {
  return n.toLocaleString('fr-FR').replace(/ /g, ' ');
}

/** Texte entre guillemets français, sans que « » se retrouvent seuls en bout de ligne. */
export function quote(text: string): string {
  return `« ${text} »`;
}

/** « aujourd'hui à 8:15 », « hier », « 3 oct. ». */
export function formatRelative(timestamp: number): string {
  const d = new Date(timestamp);
  const diff = daysBetween(toKey(d), todayKey());
  if (diff === 0) return `aujourd’hui à ${d.getHours()}:${pad(d.getMinutes())}`;
  if (diff === 1) return 'hier';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

/** Prochain cap symbolique (100, 200… puis tous les 500 jours) et progression vers lui. */
export function nextMilestone(days: number) {
  const step = days < 1000 ? 100 : 500;
  const next = (Math.floor(days / step) + 1) * step;
  return { next, left: next - days, progress: (days % step) / step };
}

/** « JJ/MM/AAAA » → « YYYY-MM-DD », ou null si invalide. */
export function parseFrenchDate(input: string): string | null {
  const m = input.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m.map(Number);
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return toKey(date);
}

export function toFrenchDate(key: string): string {
  const [y, m, d] = key.split('-');
  return `${d}/${m}/${y}`;
}

/** « 9h », « 930 », « 9:30 » → « 09:30 », ou null si invalide. */
export function parseTime(input: string): string | null {
  const s = input.trim().toLowerCase().replace('h', ':');
  const m = s.match(/^(\d{1,2})(?::?(\d{2}))?:?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (h > 23 || min > 59) return null;
  return `${pad(h)}:${pad(min)}`;
}
