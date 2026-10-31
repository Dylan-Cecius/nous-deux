import { scheduleTextFromOcr, type ScheduleOcrLine } from '../schedule-ocr-layout';
import { parseSchedule } from '../schedule-import';

const cell = (text: string, x: number, y: number, width = 60): ScheduleOcrLine => ({ text, x, y, width, height: 12 });
const days = ['Lundi', 'Mardi', '• Mercredi', 'Jeudi', 'Vendredi'];
const starts = ['9h00', '14h00', '8h00', '10h00', '7h00'];
const ends = ['17h00', '22h00', '16h00', '18h00', '15h00'];
const header = [cell('Jour', 250, 100), cell('Début', 440, 100), cell('Fin', 540, 100, 24)];
// Synthetic equivalent of the reported screenshot: unrelated sidebar and prose,
// then OCR returns all dates/starts before the separate end-time column.
const fixture = () => [
  cell('Exemple de planning pour une personne fictive', 250, 60, 350),
  cell('Autre conversation', 10, 100, 150), ...header,
  ...days.flatMap((day, i) => [cell(day, 250, 130 + i * 28, 100), cell(starts[i], 440, 130 + i * 28)]),
  cell('Autre sujet', 10, 190, 150),
  ...ends.map((end, i) => cell(end, 540, 130 + i * 28)),
  cell('Fin de l’exemple', 250, 290, 150),
];
const parsed = (lines: (ScheduleOcrLine | string)[]) => parseSchedule(scheduleTextFromOcr(lines), '2026-11-02');

test('les colonnes aplaties du signalement échouent, les positions reconstruisent cinq créneaux exacts', () => {
  expect(parsed(fixture().map(line => line.text)).issues.length).toBeGreaterThan(0);
  expect(parsed(fixture())).toEqual({ issues: [], slots: starts.map((_, i) => ({
    date: `2026-11-0${i + 2}`, start: ['09:00', '14:00', '08:00', '10:00', '07:00'][i], end: ['17:00', '22:00', '16:00', '18:00', '15:00'][i],
  })) });
  expect(scheduleTextFromOcr(fixture())).not.toContain('conversation');
});
test('ordre natif inversé et coordonnées normalisées donnent les mêmes lignes', () => {
  const scaled = fixture().reverse().map(line => ({ ...line, x: line.x / 1000, y: line.y / 1000, width: line.width / 1000, height: line.height / 1000 }));
  expect(scheduleTextFromOcr(scaled)).toBe(scheduleTextFromOcr(fixture()));
});
test('une cellule de fin manquante ne décale pas les heures des jours suivants', () => {
  const result = parsed(fixture().filter(line => !(line.x === 540 && line.text === '16h00')));
  expect(result.issues).toHaveLength(1);
  expect(result.slots).not.toEqual(expect.arrayContaining([expect.objectContaining({ date: '2026-11-04' })]));
  expect(result.slots).toContainEqual({ date: '2026-11-05', start: '10:00', end: '18:00' });
});
test('une date absente ne se décale pas sur la ligne suivante', () => {
  expect(parsed(fixture().filter(line => line.text !== '• Mercredi')).issues).toHaveLength(1);
});
test('une ligne illisible au milieu du tableau n’est pas supprimée silencieusement', () => {
  const lines = fixture().filter(line => line.y !== 186);
  lines.push(cell('Jour illisible', 250, 186, 100));
  expect(parsed(lines).issues).toHaveLength(1);
});
test('cellules fusionnées, colonnes proches mais lignes distinctes', () => {
  const lines = [cell('Jour Début Fin', 250, 100, 320), cell('Lundi 9h00', 250, 130, 250), cell('17h00', 540, 132), cell('Mardi', 250, 152), cell('14h00 22h00', 440, 152, 160)];
  expect(parsed(lines).issues).toEqual([]);
  expect(parsed(lines).slots).toHaveLength(2);
});
test.each(['Lundi 03/11/2026', 'Lunid'])('date/jour erroné reste bloquant : %s', day => {
  expect(parsed([...header, cell(day, 250, 130, 160), cell('9h00', 440, 130), cell('17h00', 540, 130)]).issues).toHaveLength(1);
});
test('heures invalides et nuit restent bloquantes', () => {
  expect(parsed([...header, cell('Lundi 22h00 6h00', 250, 130, 350)]).issues).toHaveLength(1);
  expect(parsed([...header, cell('Lundi 9h70 17h00', 250, 130, 350)]).issues).toHaveLength(1);
});
test('deux tableaux ou colonnes inversées restent à corriger, sans en choisir un arbitrairement', () => {
  expect(parsed([...fixture(), ...header.map(line => ({ ...line, y: 350 })), cell('Samedi 9h00 17h00', 250, 380, 350)]).issues.length).toBeGreaterThan(0);
  expect(parsed([header[0], cell('Fin', 440, 100), cell('Début', 540, 100), cell('Lundi 9h00 17h00', 250, 130, 350)]).issues.length).toBeGreaterThan(0);
});
test('texte ancien sans positions conservé, sans deviner des colonnes', () => {
  expect(scheduleTextFromOcr(['Lundi 9h-17h', 'Mardi repos'])).toBe('Lundi 9h-17h\nMardi repos');
  expect(scheduleTextFromOcr([cell('Lundi', 0, 0), '17h00'])).toBe('Lundi\n17h00');
});
test('les limites s’appliquent aussi au texte hors tableau et aux géométries invalides', () => {
  expect(() => scheduleTextFromOcr([...fixture(), cell('x'.repeat(12001), 0, 0)])).toThrow('trop long');
  expect(() => scheduleTextFromOcr(Array.from({ length: 1001 }, () => cell('x', 0, 0)))).toThrow('trop long');
  expect(scheduleTextFromOcr([{ ...cell('Lundi 9h-17h', 0, 0), height: NaN }])).toBe('Lundi 9h-17h');
});
