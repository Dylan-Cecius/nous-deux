import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import Restos from '@/app/(tabs)/restos';
import { useCollectionState, useSession } from '../couple-context';
import { confirmDelete } from '@/components/ui';
import { showDialog } from '@/components/dialog';
import { Linking, Pressable } from 'react-native';

jest.mock('../couple-context', () => ({ useCollectionState: jest.fn(), useSession: jest.fn() }));
jest.mock('@/components/dialog', () => ({ showDialog: jest.fn() }));
jest.mock('@/constants/theme', () => ({ useTheme: () => ({}), Fonts: {} }));
jest.mock('react-native', () => Object.create(jest.requireActual('react-native'), {
  Pressable: { value: 'pressable' },
}));
jest.mock('expo-image', () => ({ Image: (props: object) => jest.requireActual('react').createElement('image', props) }));
jest.mock('@/components/ui', () => {
  const React = jest.requireActual('react');
  return { confirmDelete: jest.fn(), ...Object.fromEntries(['Screen', 'Card', 'T', 'Button', 'IconButton', 'Row', 'Dot', 'Empty', 'Fab', 'Ionicons', 'Field', 'Chips', 'Segmented', 'Sheet'].map((name) => [name, (props: object) => React.createElement(name.toLowerCase(), props)])) };
});

let root: ReactTestRenderer;
const resto = { id: 'one', name: 'Resto fictif', status: 'envie', createdBy: 'alice', createdAt: 1 };
const ready = { items: [resto], loading: false, error: false, retry: jest.fn() };
const backend = { mode: 'cloud', coupleId: 'couple', userId: 'alice', remove: jest.fn(), update: jest.fn(), add: jest.fn(), call: jest.fn() };
const session = { backend, colorOf: () => '#000', nameOf: () => 'Alice' };
beforeEach(() => {
  jest.clearAllMocks();
  for (const fn of [backend.remove, backend.update, backend.add]) fn.mockReset().mockResolvedValue(undefined);
  (useSession as jest.Mock).mockReturnValue(session);
  (useCollectionState as jest.Mock).mockReturnValue(ready);
});
afterEach(async () => { if (root) await act(async () => root.unmount()); expect(backend.call).not.toHaveBeenCalled(); });
const button = (label: string) => root.root.findByProps({ label }).props.onPress;
const sheet = () => root.root.findByType('sheet' as never);
const cards = () => root.root.findAllByType('card' as never).filter((n) => n.props.onPress && !n.props.tone);
const open = async (fresh = false) => {
  await act(async () => { root = create(<Restos />); });
  await act(async () => { if (fresh) button('Ajouter un resto')(); else cards()[0].props.onPress(); });
};
const ask = async () => {
  await act(async () => button('Supprimer')());
  return (confirmDelete as jest.Mock).mock.calls.at(-1)[1];
};
const refresh = async () => { await act(async () => root.update(<Restos />)); };
const field = (label: string) => root.root.findByProps({ label });
const edit = async (label: string, value: string) => { await act(async () => field(label).props.onChangeText(value)); };

test('la cuisine reçue reste intacte quand seul le nom est saisi', async () => {
  await open();
  await edit('Nom', 'Mon nom');
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [{ ...resto, cuisine: 'Italien', note: 'Réserver' }] });
  await refresh();
  expect(field('Cuisine').props.value).toBe('Italien');
  expect(field('Notes').props.value).toBe('Réserver');
  expect(field('Nom').props.value).toBe('Mon nom');
  await act(async () => { await button('Enregistrer')(); });
  expect(backend.update).toHaveBeenCalledWith('restaurants', resto.id, { name: 'Mon nom' });
});

test('une fiche intacte ferme sans réécrire les champs du partenaire', async () => {
  await open();
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [{ ...resto, name: 'Nom reçu', status: 'favori', rating: 4 }] });
  await refresh();
  expect(field('Nom').props.value).toBe('Nom reçu');
  expect(field('Liste').props.value).toBe('favori');
  await act(async () => { await button('Enregistrer')(); });
  expect(backend.update).not.toHaveBeenCalled();
  expect(root.root.findAllByType('sheet' as never)).toHaveLength(0);
});

test.each([false, true])('un ancien bouton relit le brouillon courant (création %s)', async (fresh) => {
  await open(fresh);
  const save = button('Enregistrer');
  await edit('Nom', 'Dernière saisie');
  await edit('Ville / quartier', 'Liège');
  await act(async () => { await save(); });
  if (fresh) expect(backend.add).toHaveBeenCalledWith('restaurants', expect.objectContaining({ name: 'Dernière saisie', place: 'Liège' }));
  else expect(backend.update).toHaveBeenCalledWith('restaurants', resto.id, { name: 'Dernière saisie', place: 'Liège' });
});

test('le statut saisi conserve la note et les métadonnées reçues', async () => {
  await open();
  await act(async () => field('Liste').props.onChange('teste'));
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [{ ...resto, rating: 5, address: 'Adresse reçue', mapsUrl: 'https://maps.google.com/?cid=2' }] });
  await refresh();
  await act(async () => { await button('Enregistrer')(); });
  expect(backend.update).toHaveBeenCalledWith('restaurants', resto.id, { status: 'teste' });
});

test('la dernière valeur reçue reste affichée après perte de lecture', async () => {
  await open();
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [{ ...resto, cuisine: 'Reçue' }] });
  await refresh();
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, error: true, items: [] });
  await refresh();
  expect(field('Cuisine').props.value).toBe('Reçue');
});

test.each(['Nom', 'Cuisine', 'Ville / quartier', 'Notes'])('%s ne change pas pendant une sauvegarde et reprend après échec', async (label) => {
  await open();
  await edit('Nom', 'Nom saisi');
  const field = () => root.root.findByProps({ label });
  const previous = field().props.value;
  const change = field().props.onChangeText;
  let reject!: (error: Error) => void;
  backend.update.mockImplementationOnce(() => new Promise<void>((_, fail) => { reject = fail; }));
  let pending!: Promise<void>;
  await act(async () => { pending = button('Enregistrer')(); await change('Saisie pendant attente'); });
  expect(field().props.value).toBe(previous);
  expect(field().props.editable).toBe(false);
  await act(async () => { reject(new Error('Échec fictif')); await pending; });
  expect(field().props.editable).toBe(true);
  await act(async () => field().props.onChangeText('Brouillon repris'));
  await act(async () => { await button('Enregistrer')(); });
  const key = { Nom: 'name', Cuisine: 'cuisine', 'Ville / quartier': 'place', Notes: 'note' }[label]!;
  expect(backend.update).toHaveBeenLastCalledWith('restaurants', resto.id, expect.objectContaining({ [key]: 'Brouillon repris' }));
});

test('liste et note restent figées pendant la sauvegarde puis redeviennent modifiables', async () => {
  await open();
  const chips = () => root.root.findByType('chips' as never);
  await act(async () => chips().props.onChange('favori'));
  const heart = () => root.root.findAllByType(Pressable).find((node) => node.props.accessibilityLabel === '4 cœurs')!;
  const changeStatus = chips().props.onChange;
  const changeRating = heart().props.onPress;
  let reject!: (error: Error) => void;
  backend.update.mockImplementationOnce(() => new Promise<void>((_, fail) => { reject = fail; }));
  let pending!: Promise<void>;
  await act(async () => { pending = button('Enregistrer')(); await changeStatus('teste'); await changeRating(); });
  expect(chips().props.value).toBe('favori');
  expect(chips().props.disabled).toBe(true);
  expect(heart().props.disabled).toBe(true);
  await act(async () => { reject(new Error('Échec fictif')); await pending; });
  expect(chips().props.disabled).toBe(false);
  expect(heart().props.disabled).toBe(false);
  await act(async () => { await button('Enregistrer')(); });
  expect(backend.update).toHaveBeenLastCalledWith('restaurants', resto.id, { status: 'favori' });
});

test.each(['closed', 'reopened', 'backend', 'member', 'loading', 'error', 'removed'])('confirmation ignorée après %s', async (change) => {
  await open();
  const confirm = await ask();
  if (change === 'closed' || change === 'reopened') {
    await act(async () => sheet().props.onClose());
    if (change === 'reopened') await act(async () => button('Ajouter un resto')());
  } else {
    if (change === 'backend' || change === 'member') (useSession as jest.Mock).mockReturnValue({ ...session, backend: { ...backend, userId: change === 'member' ? 'bob' : 'alice' } });
    else (useCollectionState as jest.Mock).mockReturnValue({ ...ready, ...(change === 'removed' ? { items: [] } : { [change]: true }) });
    await refresh();
  }
  await act(async () => { await confirm(); });
  expect(backend.remove).not.toHaveBeenCalled();
  if (change === 'reopened') expect(sheet().props.title).toBe('Nouveau resto');
  if (change === 'member') expect(root.root.findAllByType('sheet' as never)).toHaveLength(0);
});

test.each(['loading', 'error', 'removed'])('enregistrement bloqué après %s, brouillon conservé', async (change) => {
  await open();
  await act(async () => root.root.findByProps({ label: 'Nom' }).props.onChangeText('Brouillon fictif'));
  const save = button('Enregistrer');
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, ...(change === 'removed' ? { items: [] } : { [change]: true }) });
  await refresh();
  await act(async () => { await save(); });
  expect(backend.update).not.toHaveBeenCalled();
  expect(root.root.findByProps({ label: 'Nom' }).props.value).toBe('Brouillon fictif');
});

test('enregistrement, suppression et fermeture sont exclusifs', async () => {
  await open();
  await edit('Nom', 'Nom saisi');
  const confirm = await ask();
  let finish!: () => void;
  backend.update.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
  let pending!: Promise<void>;
  await act(async () => { pending = button('Enregistrer')(); await confirm(); sheet().props.onClose(); });
  expect(backend.remove).not.toHaveBeenCalled();
  expect(sheet()).toBeTruthy();
  expect(root.root.findByProps({ label: 'Supprimer' }).props.disabled).toBe(true);
  await act(async () => { finish(); await pending; });
  expect(root.root.findAllByType('sheet' as never)).toHaveLength(0);
});

test.each(['save', 'remove'])('double %s : une seule mutation', async (action) => {
  await open();
  await edit('Nom', 'Nom saisi');
  const perform = action === 'save' ? button('Enregistrer') : await ask();
  await act(async () => { await Promise.all([perform(), perform()]); });
  expect(backend.update.mock.calls.length + backend.remove.mock.calls.length).toBe(1);
});

test('un échec conserve le brouillon et permet une nouvelle tentative', async () => {
  await open();
  await edit('Nom', 'Nom saisi');
  backend.update.mockRejectedValueOnce(new Error('Erreur fictive'));
  await act(async () => { await button('Enregistrer')(); });
  expect(showDialog).toHaveBeenCalledWith('Action impossible', 'Erreur fictive');
  expect(root.root.findByProps({ label: 'Nom' }).props.value).toBe('Nom saisi');
  await act(async () => { await button('Enregistrer')(); });
  expect(backend.update).toHaveBeenCalledTimes(2);
});

test.each(['success', 'error'])('retour %s d’un ancien backend ignoré', async (outcome) => {
  await open();
  await edit('Nom', 'Nom saisi');
  let finish!: () => void;
  backend.update.mockImplementationOnce(() => new Promise<void>((resolve, reject) => { finish = () => outcome === 'success' ? resolve() : reject(new Error('Ancienne erreur')); }));
  let pending!: Promise<void>;
  await act(async () => { pending = button('Enregistrer')(); });
  (useSession as jest.Mock).mockReturnValue({ ...session, backend: { ...backend } });
  await refresh();
  await act(async () => { finish(); await pending; });
  expect(sheet()).toBeTruthy();
  expect(showDialog).not.toHaveBeenCalled();
});

test('un autre restaurant reçoit son propre brouillon', async () => {
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [resto, { ...resto, id: 'two', name: 'Autre resto' }] });
  await open();
  await act(async () => cards()[1].props.onPress());
  expect(root.root.findByProps({ label: 'Nom' }).props.value).toBe('Autre resto');
});

test('un nom vide est refusé dans l’action elle-même', async () => {
  await open(true);
  await act(async () => { await button('Enregistrer')(); });
  expect(backend.add).not.toHaveBeenCalled();
});

test('une nouvelle fiche reprend après erreur sans appel Places', async () => {
  await open(true);
  await act(async () => root.root.findByProps({ label: 'Nom' }).props.onChangeText('Nom repris'));
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, error: true });
  await refresh();
  await act(async () => { await button('Enregistrer')(); });
  expect(backend.add).not.toHaveBeenCalled();
  await act(async () => button('Recharger les restos du formulaire')());
  expect(ready.retry).toHaveBeenCalledTimes(1);
  (useCollectionState as jest.Mock).mockReturnValue(ready);
  await refresh();
  await act(async () => { await button('Enregistrer')(); });
  expect(backend.add).toHaveBeenCalledWith('restaurants', expect.objectContaining({ name: 'Nom repris', status: 'envie' }));
});

test('le bouton carte ne transmet pas un schéma arbitraire au système', async () => {
  const openUrl = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  try {
    (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [{ ...resto, mapsUrl: 'custom-app://unexpected/action' }] });
    await act(async () => { root = create(<Restos />); });
    await act(async () => { await button('Voir Resto fictif sur la carte')(); });
    expect(openUrl).toHaveBeenCalledWith('https://www.google.com/maps/search/?api=1&query=Resto%20fictif');
  } finally { openUrl.mockRestore(); }
});

test.each(['loading', 'error', 'backend', 'unmount', 'roundtrip'])('ancien tirage et ancienne carte ignorés après %s', async (kind) => {
  const openUrl = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  try {
    await act(async () => { root = create(<Restos />); });
    const map = button('Voir Resto fictif sur la carte');
    await act(async () => button('Tirer un resto au sort')());
    const reroll = (showDialog as jest.Mock).mock.calls.at(-1)[2][0].onPress;
    if (kind === 'unmount') await act(async () => root.unmount());
    else if (kind === 'roundtrip') {
      await act(async () => root.root.findByType('segmented' as never).props.onChange('favori'));
      await act(async () => root.root.findByType('segmented' as never).props.onChange('envie'));
    } else {
      if (kind === 'backend') (useSession as jest.Mock).mockReturnValue({ ...session, backend: { ...backend } });
      else (useCollectionState as jest.Mock).mockReturnValue({ ...ready, [kind]: true });
      await refresh();
    }
    (showDialog as jest.Mock).mockClear();
    await act(async () => { reroll(); await map(); });
    expect(showDialog).not.toHaveBeenCalled();
    expect(openUrl).not.toHaveBeenCalled();
  } finally { openUrl.mockRestore(); }
});

test('le tirage relit les envies/favoris et ignore un restaurant devenu testé', async () => {
  await act(async () => { root = create(<Restos />); });
  await act(async () => button('Tirer un resto au sort')());
  const reroll = (showDialog as jest.Mock).mock.calls.at(-1)[2][0].onPress;
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [
    { ...resto, status: 'teste' }, { ...resto, id: 'new', name: 'Nouvelle adresse', status: 'favori' },
  ] });
  await refresh();
  await act(async () => reroll());
  expect(showDialog).toHaveBeenLastCalledWith('Ce soir, c’est…', 'Nouvelle adresse', expect.any(Array));
});

test('une carte relit la destination actuelle puis ignore une fiche retirée', async () => {
  const openUrl = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  try {
    await act(async () => { root = create(<Restos />); });
    const map = button('Voir Resto fictif sur la carte');
    (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [{ ...resto, mapsUrl: 'https://maps.google.com/?cid=42' }] });
    await refresh();
    await act(async () => { await map(); });
    expect(openUrl).toHaveBeenLastCalledWith('https://maps.google.com/?cid=42');
    openUrl.mockClear();
    (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [] });
    await refresh();
    await act(async () => { await map(); });
    expect(openUrl).not.toHaveBeenCalled();
  } finally { openUrl.mockRestore(); }
});

test('un tirage sans adresse restante affiche un état vide confirmé', async () => {
  await act(async () => { root = create(<Restos />); });
  await act(async () => button('Tirer un resto au sort')());
  const reroll = (showDialog as jest.Mock).mock.calls.at(-1)[2][0].onPress;
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [] });
  await refresh();
  await act(async () => reroll());
  expect(showDialog).toHaveBeenLastCalledWith('Aucun resto', 'Ajoutez d’abord quelques envies ou favoris.');
});
