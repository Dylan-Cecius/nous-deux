import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Pressable } from 'react-native';
import { Button, Card, Chips, ColorPicker, IconButton, SectionTitle, Segmented } from '@/components/ui';
import { tap } from '../haptics';

jest.mock('@expo/vector-icons/Ionicons', () => 'icon');
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'gradient' }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('@/components/assistant-context', () => ({ useAssistant: () => null }));
jest.mock('@/components/dialog', () => ({ showDialog: jest.fn() }));
jest.mock('@/constants/theme', () => ({ useTheme: () => ({}), Fonts: {}, Spacing: {}, Radius: {}, cardShadow: () => ({}) }));
jest.mock('../haptics', () => ({ tap: jest.fn() }));
jest.mock('react-native', () => Object.create(jest.requireActual('react-native'), {
  Pressable: { value: 'pressable' },
}));

let root: ReactTestRenderer;
afterEach(async () => { if (root) await act(async () => root.unmount()); jest.clearAllMocks(); });
const options = [{ value: 'alice', label: 'Alice' }, { value: 'bob', label: 'Bob' }];

const control = (kind: string, disabled: boolean, action: jest.Mock) => {
  if (kind === 'button') return <Button label="Valider" disabled={disabled} onPress={action} />;
  if (kind === 'icon') return <IconButton label="Valider" icon="checkmark" disabled={disabled} onPress={action} />;
  if (kind === 'color') return <ColorPicker colors={['#111111']} value="#111111" disabled={disabled} onChange={action} />;
  return <Chips options={[options[0]]} value="alice" disabled={disabled} onChange={action} />;
};

describe.each(['button', 'icon', 'color', 'chips'])('contrôle %s désactivé', (kind) => {
  test('refuse aussi une invocation directe de son gestionnaire', async () => {
    const action = jest.fn();
    await act(async () => { root = create(control(kind, true, action)); });
    await act(async () => { await root.root.findByType(Pressable).props.onPress(); });
    expect(action).not.toHaveBeenCalled();
    expect(tap).not.toHaveBeenCalled();
  });

  test('un ancien appui actif ne passe pas après désactivation', async () => {
    const action = jest.fn();
    await act(async () => { root = create(control(kind, false, action)); });
    const oldPress = root.root.findByType(Pressable).props.onPress;
    await act(async () => root.update(control(kind, true, action)));
    await act(async () => { await oldPress(); });
    expect(action).not.toHaveBeenCalled();
    expect(tap).not.toHaveBeenCalled();
    await act(async () => root.update(control(kind, false, action)));
    await act(async () => { await root.root.findByType(Pressable).props.onPress(); });
    expect(action).toHaveBeenCalledTimes(1);
  });

  test('un gestionnaire capturé désactivé ne devient pas une nouvelle intention', async () => {
    const action = jest.fn();
    await act(async () => { root = create(control(kind, true, action)); });
    const oldPress = root.root.findByType(Pressable).props.onPress;
    await act(async () => root.update(control(kind, false, action)));
    await act(async () => { await oldPress(); });
    expect(action).not.toHaveBeenCalled();
  });

  test('une désactivation temporaire invalide définitivement les anciens appuis', async () => {
    const action = jest.fn();
    await act(async () => { root = create(control(kind, false, action)); });
    const oldPress = root.root.findByType(Pressable).props.onPress;
    await act(async () => root.update(control(kind, true, action)));
    await act(async () => root.update(control(kind, false, action)));
    await act(async () => { await oldPress(); });
    expect(action).not.toHaveBeenCalled();
  });

  test('un appui retenu après démontage reste inactif', async () => {
    const action = jest.fn();
    await act(async () => { root = create(control(kind, false, action)); });
    const oldPress = root.root.findByType(Pressable).props.onPress;
    await act(async () => root.unmount());
    await act(async () => { await oldPress(); });
    expect(action).not.toHaveBeenCalled();
    expect(tap).not.toHaveBeenCalled();
  });
});

test('une carte action explicitement nommée annonce son rôle sans changer les cartes composites', async () => {
  const onPress = jest.fn();
  await act(async () => { root = create(<Card onPress={onPress} accessibilityLabel="Souvenir fictif" accessibilityHint="Ouvre l’album.">Photo</Card>); });
  const button = root.root.findByType(Pressable);
  expect(button.props.accessibilityRole).toBe('button');
  expect(button.props.accessibilityLabel).toBe('Souvenir fictif');
  expect(button.props.accessibilityHint).toBe('Ouvre l’album.');
  await act(async () => button.props.onPress());
  expect(onPress).toHaveBeenCalledTimes(1);
  await act(async () => root.update(<Card onPress={onPress}>Contenu composite</Card>));
  expect(root.root.findByType(Pressable).props.accessibilityRole).toBeUndefined();
});

test('un bouton icône peut être désactivé par son formulaire puis réactivé', async () => {
  const onPress = jest.fn();
  await act(async () => { root = create(<IconButton icon="add" label="Zoomer" onPress={onPress} disabled />); });
  const button = root.root.findByType(Pressable);
  expect(button.props.disabled).toBe(true);
  expect(button.props.accessibilityState).toMatchObject({ disabled: true, busy: false });
  await act(async () => { await button.props.onPress(); });
  expect(onPress).not.toHaveBeenCalled();
  await act(async () => root.update(<IconButton icon="add" label="Zoomer" onPress={onPress} />));
  await act(async () => { await root.root.findByType(Pressable).props.onPress(); });
  expect(onPress).toHaveBeenCalledTimes(1);
});

test('le verrou interne d’un bouton icône reste actif sans désactivation externe', async () => {
  let finish!: () => void;
  const onPress = jest.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
  await act(async () => { root = create(<IconButton icon="add" label="Zoomer" onPress={onPress} />); });
  const action = root.root.findByType(Pressable).props.onPress;
  let pending!: Promise<void>;
  await act(async () => { pending = action(); await action(); });
  expect(onPress).toHaveBeenCalledTimes(1);
  expect(root.root.findByType(Pressable).props.accessibilityState).toEqual({ disabled: true, busy: true });
  await act(async () => { finish(); await pending; });
  expect(root.root.findByType(Pressable).props.disabled).toBe(false);
});

test('les choix radio désactivés restent cochés mais ne réagissent pas', async () => {
  const onChange = jest.fn();
  await act(async () => { root = create(<Chips options={options} value="alice" onChange={onChange} disabled />); });
  const buttons = root.root.findAllByType(Pressable);
  expect(buttons.map((button) => button.props.accessibilityState)).toEqual([
    { checked: true, disabled: true }, { checked: false, disabled: true },
  ]);
  expect(buttons.every((button) => button.props.disabled)).toBe(true);
  await act(async () => buttons[1].props.onPress());
  expect(onChange).not.toHaveBeenCalled();
  expect(tap).not.toHaveBeenCalled();
  await act(async () => root.update(<Chips options={options} value="alice" onChange={onChange} />));
  await act(async () => root.root.findAllByType(Pressable)[1].props.onPress());
  expect(onChange).toHaveBeenCalledWith('bob');
  expect(tap).toHaveBeenCalledTimes(1);
});

test('le bouton de rubrique annonce son action et son contexte', async () => {
  const onAction = jest.fn();
  await act(async () => { root = create(<SectionTitle title="Souvenirs" action="Tout voir" onAction={onAction} />); });
  const button = root.root.findByType(Pressable);
  expect(button.props.accessibilityRole).toBe('button');
  expect(button.props.accessibilityLabel).toBe('Tout voir — Souvenirs');
  await act(async () => button.props.onPress());
  expect(onAction).toHaveBeenCalledTimes(1);
});

test('les choix radio exposent un état coché et un libellé explicite', async () => {
  const onChange = jest.fn();
  await act(async () => { root = create(<Chips options={options} value="alice" onChange={onChange} label="Payé par" />); });
  const buttons = root.root.findAllByType(Pressable);
  expect(buttons.map((b) => b.props.accessibilityState.checked)).toEqual([true, false]);
  expect(buttons.map((b) => b.props.accessibilityLabel)).toEqual(['Payé par : Alice', 'Payé par : Bob']);
  await act(async () => buttons[1].props.onPress());
  expect(onChange).toHaveBeenCalledWith('bob');
});

test('les choix sans titre gardent le nom de chaque option', async () => {
  await act(async () => { root = create(<Chips options={options} value="bob" onChange={jest.fn()} />); });
  expect(root.root.findAllByType(Pressable).map((b) => b.props.accessibilityLabel)).toEqual(['Alice', 'Bob']);
});

test('les pastilles annoncent leur état occupé et indisponible pendant la sauvegarde', async () => {
  let finish!: () => void;
  const onChange = jest.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
  await act(async () => { root = create(<ColorPicker colors={['#111111', '#222222']} value="#111111" onChange={onChange} />); });
  expect(root.root.findAllByType(Pressable).map((b) => b.props.accessibilityState.checked)).toEqual([true, false]);
  let pending!: Promise<void>;
  await act(async () => { pending = root.root.findAllByType(Pressable)[1].props.onPress(); });
  for (const button of root.root.findAllByType(Pressable)) {
    expect(button.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    expect(button.props.disabled).toBe(true);
  }
  await act(async () => { finish(); await pending; });
  expect(root.root.findAllByType(Pressable)[0].props.accessibilityState).toMatchObject({ busy: false, disabled: false });
});

test('un formulaire peut désactiver les pastilles sans perdre la sélection', async () => {
  const onChange = jest.fn();
  await act(async () => { root = create(<ColorPicker colors={['#111111', '#222222']} value="#111111" onChange={onChange} disabled />); });
  expect(root.root.findAllByType(Pressable)[0].props.accessibilityState).toMatchObject({ checked: true, disabled: true });
  await act(async () => { await root.root.findAllByType(Pressable)[1].props.onPress(); });
  expect(onChange).not.toHaveBeenCalled();
  await act(async () => root.update(<ColorPicker colors={['#111111', '#222222']} value="#111111" onChange={onChange} />));
  await act(async () => { await root.root.findAllByType(Pressable)[1].props.onPress(); });
  expect(onChange).toHaveBeenCalledWith('#222222');
});

test('les onglets conservent leur état selected, distinct des choix radio', async () => {
  await act(async () => { root = create(<Segmented options={options} value="alice" onChange={jest.fn()} />); });
  expect(root.root.findAllByType(Pressable).map((b) => b.props.accessibilityState.selected)).toEqual([true, false]);
});
