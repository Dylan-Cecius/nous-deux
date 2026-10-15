import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import Agenda from '@/app/(tabs)/agenda';
import Home from '@/app/(tabs)/index';
import { useCollectionState, useSession } from '../couple-context';
import { confirmDelete } from '@/components/ui';
import { showDialog } from '@/components/dialog';
import { todayKey } from '../dates';
import { notifyPartner } from '../assistant';

jest.mock('../couple-context', () => {
  const state = jest.fn();
  return {
    useCollection: (name: string) => state(name).items, useCollectionState: state,
    useSession: jest.fn(),
  };
});
jest.mock('@/components/assistant-context', () => ({ useAssistant: () => null }));
jest.mock('../assistant', () => ({ notifyPartner: jest.fn() }));
jest.mock('@/components/dialog', () => ({ showDialog: jest.fn() }));
jest.mock('@/components/invitation-card', () => ({ InvitationCard: () => null }));
jest.mock('@/components/home/home-hero', () => ({ HomeHero: () => null }));
jest.mock('@/components/home/love-cards', () => ({ NoteCard: () => null, PingCard: () => null }));
jest.mock('@/components/home/memories-strip', () => ({ MemoriesStrip: () => null }));
jest.mock('@/components/home/question-card', () => ({ QuestionCard: () => null }));
jest.mock('@/constants/theme', () => ({ useTheme: () => ({}), cardShadow: () => ({}), Fonts: {}, Spacing: {} }));
jest.mock('@/components/pickers', () => ({ TimeField: 'time', DateField: () => null }));
jest.mock('@/components/ui', () => {
  const React = jest.requireActual('react');
  return { confirmDelete: jest.fn(), ...Object.fromEntries(['Screen', 'SectionTitle', 'Card', 'T', 'Button', 'Fab', 'Row', 'Dot', 'Ionicons', 'Sheet', 'Field', 'Chips', 'IconButton'].map((name) => [
    name, (props: object) => React.createElement(name.toLowerCase(), props),
  ])) };
});

let root: ReactTestRenderer;
const ready = { items: [], loading: false, error: false, retry: jest.fn() };
const event = { id: 'event', title: 'Horaire fictif', date: todayKey(), who: 'alice', start: '09:00', end: '12:00', kind: 'travail' };
const backend = { mode: 'cloud', coupleId: 'couple', userId: 'alice', addEvents: jest.fn().mockResolvedValue(undefined), update: jest.fn().mockResolvedValue(undefined), remove: jest.fn().mockResolvedValue(undefined), removeEvents: jest.fn().mockResolvedValue(undefined) };
const session = { backend, members: [{ id: 'alice', name: 'Alice' }, { id: 'bob', name: 'Bob' }], colorOf: () => '#000', nameOf: () => 'Alice' };
beforeEach(() => { (useCollectionState as jest.Mock).mockReturnValue(ready); (useSession as jest.Mock).mockReturnValue(session); });
afterEach(async () => { if (root) await act(async () => root.unmount()); jest.clearAllMocks(); });
const text = () => root.root.findAllByType('t' as never).map((node) => node.children.filter((child) => typeof child === 'string').join('')).join('\n');

const seriesEvent = { ...event, seriesId: 'series' };
const seriesButton = () => root.root.findByProps({ label: 'Supprimer aussi les semaines suivantes' });
const openSeries = async () => {
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [seriesEvent] });
  await act(async () => { root = create(<Agenda />); });
  await act(async () => { root.root.findAllByProps({ accessibilityLabel: 'Horaire fictif, 09:00 à 12:00' }).find((node) => typeof node.props.onPress === 'function')!.props.onPress(); });
};
const formField = (label: string) => root.root.findByProps({ label });
const changeTitle = async (value = 'Titre saisi') => { await act(async () => formField('Titre').props.onChangeText(value)); };
const receiveEvent = async (patch: object) => {
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [{ ...seriesEvent, ...patch }] });
  await act(async () => root.update(<Agenda />));
};

test('le titre saisi ne réécrit pas les heures, membre ou type reçus', async () => {
  await openSeries();
  await changeTitle();
  await receiveEvent({ start: '10:00', end: '14:00', who: 'bob', kind: 'perso' });
  for (const [label, value] of [['Début', '10:00'], ['Fin', '14:00'], ['Pour qui ?', 'bob'], ['Type', 'perso']]) {
    expect(formField(label).props.value).toBe(value);
  }
  await act(async () => { await formField('Enregistrer').props.onPress(); });
  expect(backend.update).toHaveBeenCalledWith('events', event.id, { title: 'Titre saisi' });
});

test('une fiche agenda intacte ferme sans mutation', async () => {
  await openSeries();
  await act(async () => { await formField('Enregistrer').props.onPress(); });
  expect(backend.update).not.toHaveBeenCalled();
  expect(root.root.findAllByProps({ label: 'Titre' })).toHaveLength(0);
});

test('le bouton agenda ancien utilise le titre et les heures courants', async () => {
  await openSeries();
  const save = formField('Enregistrer').props.onPress;
  await changeTitle();
  await act(async () => formField('Début').props.onChange('10:00'));
  await act(async () => { await save(); });
  expect(backend.update).toHaveBeenCalledWith('events', event.id, { title: 'Titre saisi', start: '10:00' });
});

test('un ancien bouton refuse un intervalle devenu invalide', async () => {
  await openSeries();
  const save = formField('Enregistrer').props.onPress;
  await act(async () => formField('Début').props.onChange('13:00'));
  await act(async () => { await save(); });
  expect(backend.update).not.toHaveBeenCalled();
});

test('un ancien bouton de création utilise la répétition et le titre courants', async () => {
  await act(async () => { root = create(<Agenda />); });
  await act(async () => formField('Ajouter un horaire').props.onPress());
  const save = formField('Enregistrer').props.onPress;
  await changeTitle();
  await act(async () => formField('Répéter chaque semaine').props.onChange('4'));
  await act(async () => { await save(); });
  expect(backend.addEvents).toHaveBeenCalledTimes(1);
  expect(backend.addEvents.mock.calls[0][0]).toHaveLength(4);
  expect(backend.addEvents.mock.calls[0][0][0].title).toBe('Titre saisi');
});

test('le changement de jour relit la date reçue et cumule deux appuis', async () => {
  await openSeries();
  const next = formField('Jour suivant').props.onPress;
  await receiveEvent({ date: '2099-01-01' });
  await act(async () => { await next(); await next(); });
  await act(async () => { await formField('Enregistrer').props.onPress(); });
  expect(backend.update).toHaveBeenCalledWith('events', event.id, { date: '2099-01-03' });
});

const askLongPressDelete = async () => {
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [seriesEvent] });
  await act(async () => { root = create(<Agenda />); });
  await act(async () => { root.root.findAllByProps({ accessibilityLabel: 'Horaire fictif, 09:00 à 12:00' }).find((node) => typeof node.props.onLongPress === 'function')!.props.onLongPress(); });
  return (confirmDelete as jest.Mock).mock.calls[0][1];
};

test.each(['unmount', 'backend', 'loading', 'error', 'removed'])('un appui long confirmé après %s ne supprime rien', async (change) => {
  const confirm = await askLongPressDelete();
  if (change === 'backend') (useSession as jest.Mock).mockReturnValue({ ...session, backend: { ...backend, coupleId: 'new' } });
  else if (change === 'removed') (useCollectionState as jest.Mock).mockReturnValue(ready);
  else if (change !== 'unmount') (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [seriesEvent], [change]: true });
  await act(async () => { if (change === 'unmount') root.unmount(); else root.update(<Agenda />); });
  await act(async () => { await confirm(); });
  expect(backend.remove).not.toHaveBeenCalled();
});

test('la confirmation par appui long reste disponible et ne supprime qu’une fois', async () => {
  const confirm = await askLongPressDelete();
  await act(async () => { await Promise.all([confirm(), confirm()]); });
  expect(backend.remove).toHaveBeenCalledTimes(1);
  expect(backend.remove).toHaveBeenCalledWith('events', 'event');
});

test('un refus de suppression par appui long permet une reprise sans masquer l’erreur', async () => {
  const confirm = await askLongPressDelete();
  backend.remove.mockRejectedValueOnce(new Error('Suppression fictive refusée'));
  await act(async () => { await confirm(); });
  expect(showDialog).toHaveBeenCalledWith('Action impossible', 'Suppression fictive refusée');
  await act(async () => { await confirm(); });
  expect(backend.remove).toHaveBeenCalledTimes(2);
});

test.each(['loading', 'error'])('la suppression de série est bloquée en %s sans perdre le formulaire', async (status) => {
  await openSeries();
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [seriesEvent], [status]: true });
  await act(async () => { root.update(<Agenda />); });
  expect(seriesButton().props.disabled).toBe(true);
  await act(async () => { seriesButton().props.onPress(); });
  expect(confirmDelete).not.toHaveBeenCalled();
  expect(backend.remove).not.toHaveBeenCalled();
  expect(backend.removeEvents).not.toHaveBeenCalled();
  expect(root.root.findByProps({ label: 'Titre' }).props.value).toBe(event.title);
  if (status === 'error') {
    await act(async () => { root.root.findByProps({ label: 'Réessayer la série' }).props.onPress(); });
    expect(ready.retry).toHaveBeenCalledTimes(1);
  }
});

test.each(['loading', 'error', 'backend', 'closed'])('une confirmation devenue obsolète (%s) ne supprime rien', async (change) => {
  await openSeries();
  await act(async () => { seriesButton().props.onPress(); });
  const confirm = (confirmDelete as jest.Mock).mock.calls[0][1];
  if (change === 'backend') (useSession as jest.Mock).mockReturnValue({ ...session, backend: { ...backend } });
  else if (change !== 'closed') (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [seriesEvent], [change]: true });
  await act(async () => {
    if (change === 'closed') root.root.findByProps({ title: 'Modifier l’horaire' }).props.onClose();
    else root.update(<Agenda />);
  });
  await act(async () => { await confirm(); });
  expect(backend.remove).not.toHaveBeenCalled();
  expect(backend.removeEvents).not.toHaveBeenCalled();
  if (change !== 'closed') {
    expect(showDialog).toHaveBeenCalled();
    expect(root.root.findByProps({ label: 'Titre' }).props.value).toBe(event.title);
  }
});

test('la confirmation utilise la série fraîche et préserve les autres horaires', async () => {
  await openSeries();
  await act(async () => { seriesButton().props.onPress(); });
  const confirm = (confirmDelete as jest.Mock).mock.calls[0][1];
  const items = [seriesEvent, { ...seriesEvent, id: 'future', date: '2099-01-01' }, { ...seriesEvent, id: 'past', date: '2000-01-01' }, { ...seriesEvent, id: 'other', seriesId: 'other' }];
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items });
  await act(async () => { root.update(<Agenda />); });
  await act(async () => { await confirm(); });
  expect(backend.removeEvents.mock.calls).toEqual([[['event', 'future']]]);
  expect(backend.remove).not.toHaveBeenCalled();
  expect(root.root.findAllByProps({ label: 'Titre' })).toHaveLength(0);
});

test('un refus du lot conserve le formulaire et permet de réessayer', async () => {
  await openSeries();
  await act(async () => { seriesButton().props.onPress(); });
  const confirm = (confirmDelete as jest.Mock).mock.calls[0][1];
  backend.removeEvents.mockRejectedValueOnce(new Error('Lot fictif refusé'));
  await act(async () => { await confirm(); });
  expect(showDialog).toHaveBeenCalledWith('Action impossible', 'Lot fictif refusé');
  expect(root.root.findByProps({ label: 'Titre' }).props.value).toBe(event.title);
  await act(async () => { await confirm(); });
  expect(backend.removeEvents).toHaveBeenCalledTimes(2);
  expect(backend.remove).not.toHaveBeenCalled();
  expect(root.root.findAllByProps({ label: 'Titre' })).toHaveLength(0);
});

test('une sauvegarde bloque la suppression et la fermeture du même formulaire', async () => {
  await openSeries();
  await changeTitle();
  let finish!: () => void;
  backend.update.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
  let pending!: Promise<void>;
  await act(async () => { pending = root.root.findByProps({ label: 'Enregistrer' }).props.onPress(); });
  await act(async () => {
    root.root.findByProps({ label: 'Supprimer' }).props.onPress();
    seriesButton().props.onPress();
    root.root.findByProps({ title: 'Modifier l’horaire' }).props.onClose();
  });
  expect(confirmDelete).not.toHaveBeenCalled();
  expect(root.root.findByProps({ label: 'Titre' }).props.value).toBe('Titre saisi');
  await act(async () => { finish(); await pending; });
  expect(root.root.findAllByProps({ label: 'Titre' })).toHaveLength(0);
});

test('deux confirmations identiques ne lancent qu’une suppression', async () => {
  await openSeries();
  await act(async () => { root.root.findByProps({ label: 'Supprimer' }).props.onPress(); });
  const confirm = (confirmDelete as jest.Mock).mock.calls[0][1];
  await act(async () => { await Promise.all([confirm(), confirm()]); });
  expect(backend.remove).toHaveBeenCalledTimes(1);
});

test.each(['Supprimer', 'Supprimer aussi les semaines suivantes'])('une confirmation déjà ouverte (%s) ne contourne pas une sauvegarde en cours', async (label) => {
  await openSeries();
  await changeTitle();
  await act(async () => { root.root.findByProps({ label }).props.onPress(); });
  const confirm = (confirmDelete as jest.Mock).mock.calls[0][1];
  let finish!: () => void;
  backend.update.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
  let pending!: Promise<void>;
  await act(async () => { pending = root.root.findByProps({ label: 'Enregistrer' }).props.onPress(); });
  await act(async () => { await confirm(); });
  expect(backend.remove).not.toHaveBeenCalled();
  expect(backend.removeEvents).not.toHaveBeenCalled();
  await act(async () => { finish(); await pending; });
});

test('les anciens gestionnaires de formulaire ne rouvrent pas de confirmation après fermeture', async () => {
  await openSeries();
  const removeOne = root.root.findByProps({ label: 'Supprimer' }).props.onPress;
  const removeSeries = seriesButton().props.onPress;
  const save = root.root.findByProps({ label: 'Enregistrer' }).props.onPress;
  await act(async () => { root.root.findByProps({ title: 'Modifier l’horaire' }).props.onClose(); });
  await act(async () => { removeOne(); removeSeries(); await save(); });
  expect(confirmDelete).not.toHaveBeenCalled();
  expect(backend.update).not.toHaveBeenCalled();
});

test('une confirmation individuelle après fermeture ne supprime rien', async () => {
  await openSeries();
  await act(async () => { root.root.findByProps({ label: 'Supprimer' }).props.onPress(); });
  const confirm = (confirmDelete as jest.Mock).mock.calls[0][1];
  await act(async () => { root.root.findByProps({ title: 'Modifier l’horaire' }).props.onClose(); });
  await act(async () => { await confirm(); });
  expect(backend.remove).not.toHaveBeenCalled();
});

test.each(['success', 'failure'])('un ajout terminé en %s après changement de compte laisse le nouveau brouillon intact', async (result) => {
  await act(async () => { root = create(<Agenda />); });
  await act(async () => { root.root.findByProps({ label: 'Ajouter un horaire' }).props.onPress(); });
  await act(async () => { root.root.findByProps({ label: 'Titre' }).props.onChangeText('Ancien brouillon'); });
  let finish!: () => void; let fail!: (error: Error) => void;
  backend.addEvents.mockImplementationOnce(() => new Promise<void>((yes, no) => { finish = yes; fail = no; }));
  let pending!: Promise<void>;
  await act(async () => { pending = root.root.findByProps({ label: 'Enregistrer' }).props.onPress(); pending.catch(() => {}); });
  (useSession as jest.Mock).mockReturnValue({ ...session, backend: { ...backend, coupleId: 'new-couple', userId: 'bob' } });
  await act(async () => { root.update(<Agenda />); });
  expect(root.root.findAllByProps({ label: 'Titre' })).toHaveLength(0);
  await act(async () => { root.root.findByProps({ label: 'Ajouter un horaire' }).props.onPress(); });
  await act(async () => { root.root.findByProps({ label: 'Titre' }).props.onChangeText('Nouveau brouillon'); });
  await act(async () => { if (result === 'success') finish(); else fail(new Error('Ancien échec')); await pending; });
  expect(root.root.findByProps({ label: 'Titre' }).props.value).toBe('Nouveau brouillon');
  expect(notifyPartner).not.toHaveBeenCalled();
  expect(showDialog).not.toHaveBeenCalled();
});

test('un échec de sauvegarde reste visible, conserve la saisie et permet une reprise', async () => {
  await openSeries();
  await changeTitle();
  backend.update.mockRejectedValueOnce(new Error('Échec fictif'));
  await act(async () => { await root.root.findByProps({ label: 'Enregistrer' }).props.onPress(); });
  expect(showDialog).toHaveBeenCalledWith('Action impossible', 'Échec fictif');
  expect(root.root.findByProps({ label: 'Titre' }).props.value).toBe('Titre saisi');
  await act(async () => { await root.root.findByProps({ label: 'Enregistrer' }).props.onPress(); });
  expect(backend.update).toHaveBeenCalledTimes(2);
  expect(root.root.findAllByProps({ label: 'Titre' })).toHaveLength(0);
});

test.each(['loading', 'error'])('un agenda en %s ne ressemble pas à une journée vide', async (status) => {
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, [status]: true });
  await act(async () => { root = create(<Agenda />); });
  expect(text()).not.toContain('Aucun horaire ce jour-là');
  expect(text()).not.toContain('Libres ensemble');
  expect(text()).toContain(status === 'loading' ? 'Chargement de l’agenda' : 'Agenda indisponible');
  if (status === 'error') {
    await act(async () => { root.root.findByProps({ label: 'Réessayer l’agenda' }).props.onPress(); });
    expect(ready.retry).toHaveBeenCalledTimes(1);
  }
});

test.each(['loading', 'error'])('l’accueil en %s n’annonce pas une journée libre', async (status) => {
  (useCollectionState as jest.Mock).mockImplementation((name) => name === 'events' ? { ...ready, [status]: true } : ready);
  await act(async () => { root = create(<Home />); });
  expect(text()).not.toContain('Rien de prévu. Journée libre');
  expect(text()).toContain(status === 'loading' ? 'Chargement de l’agenda' : 'Agenda indisponible');
  if (status === 'error') {
    await act(async () => { root.root.findByProps({ label: 'Réessayer l’agenda' }).props.onPress(); });
    expect(ready.retry).toHaveBeenCalledTimes(1);
  }
});

test('un agenda confirmé vide garde son état vide normal', async () => {
  await act(async () => { root = create(<Agenda />); });
  expect(text()).toContain('Aucun horaire ce jour-là');
  expect(root.root.findByProps({ label: 'Ajouter un horaire' })).toBeTruthy();
});

test('une erreur masque les horaires et les disponibilités sans perdre la saisie ouverte', async () => {
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [event] });
  await act(async () => { root = create(<Agenda />); });
  expect(text()).toContain('Libres ensemble');
  await act(async () => { root.root.findByProps({ label: 'Ajouter un horaire' }).props.onPress(); });
  await act(async () => { root.root.findByProps({ label: 'Titre' }).props.onChangeText('Brouillon fictif'); });
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [event], error: true });
  await act(async () => { root.update(<Agenda />); });
  expect(text()).not.toContain('Libres ensemble');
  expect(text()).not.toContain('Horaire fictif');
  expect(root.root.findByProps({ label: 'Titre' }).props.value).toBe('Brouillon fictif');
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [event] });
  await act(async () => { root.update(<Agenda />); });
  expect(text()).toContain('Libres ensemble');
  expect(root.root.findByProps({ label: 'Titre' }).props.value).toBe('Brouillon fictif');
});

test('le résumé du jour affiche à nouveau les événements après reprise', async () => {
  (useCollectionState as jest.Mock).mockImplementation((name) => name === 'events' ? { ...ready, error: true, items: [event] } : ready);
  await act(async () => { root = create(<Home />); });
  expect(text()).not.toContain('Horaire fictif');
  (useCollectionState as jest.Mock).mockImplementation((name) => name === 'events' ? { ...ready, items: [event] } : ready);
  await act(async () => { root.update(<Home />); });
  expect(text()).toContain('Horaire fictif');
  expect(text()).not.toContain('Agenda indisponible');
});

test.each(['loading', 'error'])('les dates à venir en %s ne proposent pas un faux démarrage à zéro', async (status) => {
  (useCollectionState as jest.Mock).mockImplementation((name) => name === 'dates' ? { ...ready, [status]: true } : ready);
  await act(async () => { root = create(<Home />); });
  expect(text()).not.toContain('ajoutez les dates que vous attendez');
  expect(text()).toContain(status === 'loading' ? 'Chargement des dates' : 'Dates indisponibles');
  if (status === 'error') {
    await act(async () => { root.root.findByProps({ label: 'Réessayer les dates' }).props.onPress(); });
    expect(ready.retry).toHaveBeenCalledTimes(1);
  }
});

test('une date revient après reprise sans effacer la saisie de la nouvelle date', async () => {
  const date = { id: 'date', title: 'Sortie fictive', date: todayKey(), yearly: false };
  (useCollectionState as jest.Mock).mockImplementation((name) => name === 'dates' ? { ...ready, items: [date] } : ready);
  await act(async () => { root = create(<Home />); });
  expect(text()).toContain('Sortie fictive');
  await act(async () => { root.root.findByProps({ title: 'À venir' }).props.onAction(); });
  await act(async () => { root.root.findByProps({ label: 'Quoi ?' }).props.onChangeText('Date en préparation'); });
  (useCollectionState as jest.Mock).mockImplementation((name) => name === 'dates' ? { ...ready, error: true, items: [date] } : ready);
  await act(async () => { root.update(<Home />); });
  expect(text()).not.toContain('Sortie fictive');
  expect(root.root.findByProps({ label: 'Quoi ?' }).props.value).toBe('Date en préparation');
  (useCollectionState as jest.Mock).mockImplementation((name) => name === 'dates' ? { ...ready, items: [date] } : ready);
  await act(async () => { root.update(<Home />); });
  expect(text()).toContain('Sortie fictive');
  expect(root.root.findByProps({ label: 'Quoi ?' }).props.value).toBe('Date en préparation');
});

test.each(['loading', 'error', 'removed'])('sauvegarde et suppression simple bloquées après %s', async (status) => {
  await openSeries();
  const save = root.root.findByProps({ label: 'Enregistrer' }).props.onPress;
  await act(async () => root.root.findByProps({ label: 'Supprimer' }).props.onPress());
  const confirm = (confirmDelete as jest.Mock).mock.calls[0][1];
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: status === 'removed' ? [] : [seriesEvent], [status]: true });
  await act(async () => root.update(<Agenda />));
  await act(async () => { await save(); await confirm(); });
  expect(backend.update).not.toHaveBeenCalled();
  expect(backend.remove).not.toHaveBeenCalled();
  expect(root.root.findByProps({ label: 'Titre' }).props.value).toBe(event.title);
  expect(root.root.findByProps({ label: 'Enregistrer' }).props.disabled).toBe(true);
  expect(root.root.findByProps({ label: 'Supprimer' }).props.disabled).toBe(true);
});

test.each(['loading', 'error'])('création bloquée si la lecture devient %s', async (status) => {
  await act(async () => { root = create(<Agenda />); });
  await act(async () => root.root.findByProps({ label: 'Ajouter un horaire' }).props.onPress());
  await act(async () => root.root.findByProps({ label: 'Titre' }).props.onChangeText('Brouillon fictif'));
  const save = root.root.findByProps({ label: 'Enregistrer' }).props.onPress;
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, [status]: true });
  await act(async () => root.update(<Agenda />));
  await act(async () => { await save(); });
  expect(backend.addEvents).not.toHaveBeenCalled();
  expect(notifyPartner).not.toHaveBeenCalled();
});

test('tous les champs du formulaire agenda partagent le verrou de sauvegarde', async () => {
  await openSeries();
  await changeTitle();
  const title = root.root.findByProps({ label: 'Titre' }).props.onChangeText;
  const who = root.root.findByProps({ label: 'Pour qui ?' }).props.onChange;
  const kind = root.root.findByProps({ label: 'Type' }).props.onChange;
  const start = root.root.findByProps({ label: 'Début' }).props.onChange;
  const end = root.root.findByProps({ label: 'Fin' }).props.onChange;
  const day = root.root.findByProps({ label: 'Jour suivant' }).props.onPress;
  let finish!: () => void;
  backend.update.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
  let pending!: Promise<void>;
  await act(async () => {
    pending = root.root.findByProps({ label: 'Enregistrer' }).props.onPress();
    await title('Trop tard'); await who('bob'); await kind('perso'); await start('08:00'); await end('20:00'); await day();
  });
  expect(root.root.findByProps({ label: 'Titre' }).props).toMatchObject({ value: 'Titre saisi', editable: false });
  for (const [label, value] of [['Pour qui ?', event.who], ['Type', event.kind], ['Début', event.start], ['Fin', event.end]]) {
    expect(root.root.findByProps({ label }).props).toMatchObject({ value, disabled: true });
  }
  expect(root.root.findByProps({ label: 'Jour suivant' }).props.disabled).toBe(true);
  expect(root.root.findByProps({ label: 'Jour précédent' }).props.disabled).toBe(true);
  await act(async () => { finish(); await pending; });
});

test('la répétition d’un nouvel horaire est figée pendant son ajout', async () => {
  await act(async () => { root = create(<Agenda />); });
  await act(async () => root.root.findByProps({ label: 'Ajouter un horaire' }).props.onPress());
  await act(async () => root.root.findByProps({ label: 'Titre' }).props.onChangeText('Nouveau fictif'));
  const change = root.root.findByProps({ label: 'Répéter chaque semaine' }).props.onChange;
  let finish!: () => void;
  backend.addEvents.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
  let pending!: Promise<void>;
  await act(async () => { pending = root.root.findByProps({ label: 'Enregistrer' }).props.onPress(); await change('12'); });
  expect(root.root.findByProps({ label: 'Répéter chaque semaine' }).props).toMatchObject({ value: '0', disabled: true });
  await act(async () => { finish(); await pending; });
});

test.each(['save', 'delete', 'series', 'longpress'])('un aller-retour de backend n’actualise pas une ancienne action %s', async (action) => {
  await openSeries();
  let old: () => Promise<void>;
  if (action === 'save') old = root.root.findByProps({ label: 'Enregistrer' }).props.onPress;
  else {
    await act(async () => {
      if (action === 'longpress') root.root.findAllByProps({ accessibilityLabel: 'Horaire fictif, 09:00 à 12:00' }).find((node) => node.props.onLongPress)!.props.onLongPress();
      else root.root.findByProps({ label: action === 'series' ? 'Supprimer aussi les semaines suivantes' : 'Supprimer' }).props.onPress();
    });
    old = (confirmDelete as jest.Mock).mock.calls[0][1];
  }
  (useSession as jest.Mock).mockReturnValue({ ...session, backend: { ...backend } });
  await act(async () => root.update(<Agenda />));
  (useSession as jest.Mock).mockReturnValue(session);
  await act(async () => root.update(<Agenda />));
  await act(async () => { await old(); });
  expect(backend.update).not.toHaveBeenCalled();
  expect(backend.remove).not.toHaveBeenCalled();
  expect(backend.removeEvents).not.toHaveBeenCalled();
});

test.each(['removed', 'series', 'date'])('une confirmation de série refuse une ancre %s', async (change) => {
  await openSeries();
  await act(async () => seriesButton().props.onPress());
  const confirm = (confirmDelete as jest.Mock).mock.calls[0][1];
  const anchor = change === 'series' ? { ...seriesEvent, seriesId: 'other' } : { ...seriesEvent, date: '2099-01-01' };
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: change === 'removed' ? [] : [anchor] });
  await act(async () => root.update(<Agenda />));
  await act(async () => { await confirm(); });
  expect(backend.removeEvents).not.toHaveBeenCalled();
});

test.each(['save', 'delete', 'series', 'longpress'])('une ancienne erreur %s n’interrompt pas le backend courant', async (action) => {
  await openSeries();
  await changeTitle();
  let reject!: (error: Error) => void;
  const method = action === 'save' ? backend.update : action === 'series' ? backend.removeEvents : backend.remove;
  method.mockImplementationOnce(() => new Promise<void>((_, no) => { reject = no; }));
  let pending!: Promise<void>;
  await act(async () => {
    if (action === 'save') pending = root.root.findByProps({ label: 'Enregistrer' }).props.onPress();
    else {
      if (action === 'longpress') root.root.findAllByProps({ accessibilityLabel: 'Horaire fictif, 09:00 à 12:00' }).find((node) => node.props.onLongPress)!.props.onLongPress();
      else root.root.findByProps({ label: action === 'series' ? 'Supprimer aussi les semaines suivantes' : 'Supprimer' }).props.onPress();
      pending = (confirmDelete as jest.Mock).mock.calls[0][1]();
    }
  });
  (useSession as jest.Mock).mockReturnValue({ ...session, backend: { ...backend } });
  await act(async () => root.update(<Agenda />));
  await act(async () => { reject(new Error('Ancien échec')); await pending; });
  expect(showDialog).not.toHaveBeenCalled();
  expect(root.root.findByProps({ label: 'Titre' }).props.value).toBe('Titre saisi');
});
