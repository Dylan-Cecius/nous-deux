import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ScheduleImport } from '@/components/schedule-import';
import { useCollectionState, useSession } from '../couple-context';
import { readSchedulePhoto } from '../schedule-photo';

jest.mock('../couple-context', () => ({ useCollectionState: jest.fn(), useSession: jest.fn() }));
jest.mock('../schedule-photo', () => ({ readSchedulePhoto: jest.fn() }));
jest.mock('@/components/dialog', () => ({ showDialog: jest.fn() }));
jest.mock('@/components/pickers', () => ({ DateField: 'date' }));
jest.mock('@/components/ui', () => {
  const React = jest.requireActual('react');
  return Object.fromEntries(['Button', 'Card', 'Chips', 'Field', 'Sheet', 'T'].map(name => [name, (props: unknown) => React.createElement(name.toLowerCase(), props)]));
});
const backend = { mode: 'cloud', userId: 'alice', coupleId: 'shared', addEvents: jest.fn() };
const members = [{ id: 'alice', name: 'Alice fictive' }, { id: 'bob', name: 'Bob fictif' }];
const ready = { items: [], loading: false, error: false, retry: jest.fn() };
let root: ReactTestRenderer;
const close = jest.fn();
const button = (label: string) => root.root.findAllByType('button' as never).find(node => node.props.label === label)!;
const field = () => root.root.findByType('field' as never);
const open = async () => act(async () => { root = create(<ScheduleImport defaultDate="2026-11-02" onClose={close} />); });
const fill = async () => act(async () => field().props.onChangeText('Lundi 09h-17h\nMardi 10h-18h'));
const review = async () => act(async () => button('Je confirme les dates, heures et la personne').props.onPress());
beforeEach(() => {
  jest.clearAllMocks();
  backend.addEvents.mockReset().mockResolvedValue(undefined);
  (useSession as jest.Mock).mockReturnValue({ backend, members });
  (useCollectionState as jest.Mock).mockReturnValue(ready);
});
afterEach(async () => { if (root) await act(async () => root.unmount()); });

test('choix du partenaire, revue obligatoire, un seul lot malgré un double appui', async () => {
  await open(); await fill();
  expect(button('Ajouter 2 créneau(x)').props.disabled).toBe(true);
  await act(async () => root.root.findByType('chips' as never).props.onChange('bob'));
  await review();
  expect(button('Ajouter 2 créneau(x)').props.disabled).toBe(false);
  const save = button('Ajouter 2 créneau(x)').props.onPress;
  await act(async () => { await Promise.all([save(), save()]); });
  expect(backend.addEvents).toHaveBeenCalledTimes(1);
  expect(backend.addEvents.mock.calls[0][0]).toEqual([
    { title: 'Travail', date: '2026-11-02', start: '09:00', end: '17:00', who: 'bob', createdBy: 'alice', kind: 'travail' },
    { title: 'Travail', date: '2026-11-03', start: '10:00', end: '18:00', who: 'bob', createdBy: 'alice', kind: 'travail' },
  ]);
  expect(close).toHaveBeenCalledTimes(1);
});
test('une correction du texte annule la confirmation précédente', async () => {
  await open(); await fill(); await review();
  const staleSave = button('Ajouter 2 créneau(x)').props.onPress;
  await act(async () => field().props.onChangeText('Lundi 10h-17h'));
  expect(button('Ajouter 1 créneau(x)').props.disabled).toBe(true);
  await act(async () => staleSave());
  expect(backend.addEvents).not.toHaveBeenCalled();
});
test.each(['loading', 'error'])('une collection devenue %s bloque même un ancien bouton de confirmation', async key => {
  await open(); await fill(); await review();
  const save = button('Ajouter 2 créneau(x)').props.onPress;
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, [key]: true });
  await act(async () => root.update(<ScheduleImport defaultDate="2026-11-02" onClose={close} />));
  await act(async () => save());
  expect(backend.addEvents).not.toHaveBeenCalled();
});
test('les doublons apparus depuis la revue sont exclus au dernier instant', async () => {
  await open(); await fill(); await review();
  const save = button('Ajouter 2 créneau(x)').props.onPress;
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [{ date: '2026-11-02', start: '09:00', end: '17:00', who: 'alice', kind: 'travail' }] });
  await act(async () => root.update(<ScheduleImport defaultDate="2026-11-02" onClose={close} />));
  await act(async () => save());
  expect(backend.addEvents.mock.calls[0][0]).toHaveLength(1);
  expect(backend.addEvents.mock.calls[0][0][0].date).toBe('2026-11-03');
});
test('une réponse réseau perdue ne permet pas de rejouer le lot dans le formulaire', async () => {
  backend.addEvents.mockRejectedValue(new Error('fictif'));
  await open(); await fill(); await review();
  const staleSave = button('Ajouter 2 créneau(x)').props.onPress;
  await act(async () => staleSave());
  expect(close).not.toHaveBeenCalled();
  expect(button('Ajouter 2 créneau(x)').props.disabled).toBe(true);
  await act(async () => button('Ajouter 2 créneau(x)').props.onPress());
  await act(async () => staleSave());
  expect(backend.addEvents).toHaveBeenCalledTimes(1);
  expect(field().props.value).toContain('Lundi');
});
test('résultat photo ignoré après changement de compte et anciennes actions sans effet', async () => {
  let finish!: (value: string) => void;
  (readSchedulePhoto as jest.Mock).mockReturnValue(new Promise<string>(resolve => { finish = resolve; }));
  await open();
  let pending: Promise<void>;
  await act(async () => { pending = button('Photographier le planning').props.onPress(); });
  (useSession as jest.Mock).mockReturnValue({ backend: { ...backend, userId: 'bob' }, members });
  await act(async () => root.update(<ScheduleImport defaultDate="2026-11-02" onClose={close} />));
  await act(async () => { finish('Lundi 09h-17h'); await pending; });
  expect(field().props.value).toBe('');
  expect(backend.addEvents).not.toHaveBeenCalled();
});
test('mode local annoncé, absence de membre sélectionné et texte ambigu empêchent l’ajout', async () => {
  (useSession as jest.Mock).mockReturnValue({ backend: { ...backend, mode: 'local' }, members: [] });
  await open(); await fill(); await review();
  expect(button('Ajouter 2 créneau(x)').props.disabled).toBe(true);
  expect(JSON.stringify(root.toJSON())).toContain('sans partage entre appareils');
  await act(async () => field().props.onChangeText('Alice 09h-17h'));
  expect(button('Ajouter 0 créneau(x)').props.disabled).toBe(true);
});
