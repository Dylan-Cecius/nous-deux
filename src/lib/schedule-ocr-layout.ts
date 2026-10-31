import { MAX_SCHEDULE_TEXT } from './schedule-import';

/** Coordinates use a top-left origin, in the same units for the whole image. */
export type ScheduleOcrLine = { text: string; x: number; y: number; width: number; height: number };
const plain = (text: string) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[|•·]/g, ' ').replace(/\s+/g, ' ').trim();
const clock = '\\d{1,2}(?::\\d{2}|h(?:\\d{2})?)';
const tableRow = new RegExp(`^(.+?)\\s+(${clock})\\s+(${clock})$`, 'i');
const relevant = /^(?:[•·*]\s*)?(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|\d{1,2}\/\d{1,2}|\d{4}-\d{2}-\d{2})\b|\d{1,2}(?:h|:)/i;

/** Rebuild visual rows before interpreting a single explicit Jour / Début / Fin table.
 * Never zip independent columns by array index: a missing cell must stay missing.
 * Unsupported/ambiguous layouts remain editable text and fail normal validation.
 */
export function scheduleTextFromOcr(input: (ScheduleOcrLine | string)[]): string {
  const raw = input.map(line => typeof line === 'string' ? line : line.text).join('\n');
  if (raw.length > MAX_SCHEDULE_TEXT || input.length > 1000) throw new Error('Le planning est trop long. Photographie une plus petite partie de la feuille.');
  if (input.some(line => typeof line === 'string')) return raw;
  const lines = input as ScheduleOcrLine[];
  if (lines.some(line => ![line.x, line.y, line.width, line.height].every(Number.isFinite) || line.height <= 0 || line.width <= 0)) return raw;
  const center = (line: ScheduleOcrLine) => line.y + line.height / 2;
  const rows: ScheduleOcrLine[][] = [];
  for (const line of [...lines].sort((a, b) => center(a) - center(b) || a.x - b.x)) {
    const row = rows[rows.length - 1];
    // Fixed first-line anchor avoids chaining two neighbouring rows together.
    if (row && Math.abs(center(line) - center(row[0])) <= Math.min(line.height, row[0].height) * 0.55) row.push(line);
    else rows.push([line]);
  }
  for (const row of rows) row.sort((a, b) => a.x - b.x);
  const joined = rows.map(row => row.map(line => line.text.trim()).join(' '));
  const headers: { row: number; cells: ScheduleOcrLine[] }[] = [];
  rows.forEach((row, index) => {
    for (let start = 0; start < row.length; start++) {
      for (let count = 1; count <= 3 && start + count <= row.length; count++) {
        const cells = row.slice(start, start + count);
        if (/^jours? debut fin$/.test(plain(cells.map(cell => cell.text).join(' ')))) headers.push({ row: index, cells });
      }
    }
  });
  if (headers.length !== 1) return joined.join('\n');
  const header = headers[0];
  const padding = Math.max(...header.cells.map(cell => cell.height));
  const left = header.cells[0].x - padding;
  const right = Math.max(...header.cells.map(cell => cell.x + cell.width)) + padding * 3;
  const below = rows.slice(header.row + 1).map(row => row
    .filter(cell => cell.x + cell.width >= left && cell.x <= right)
    .map(cell => cell.text.trim()).join(' ').trim());
  const indexes = below.flatMap((line, index) => relevant.test(line) ? [index] : []);
  if (!indexes.length) return joined.join('\n');
  // Keep incomplete/unknown rows inside the table, rather than silently dropping a shift.
  return below.slice(indexes[0], indexes[indexes.length - 1] + 1).filter(Boolean).map(line => {
    const cleaned = line.replace(/[|]/g, ' ').replace(/^[•·*]\s*/, '').replace(/\s+/g, ' ').trim();
    const match = tableRow.exec(cleaned);
    return match ? `${match[1]} ${match[2]}-${match[3]}` : cleaned;
  }).join('\n');
}
