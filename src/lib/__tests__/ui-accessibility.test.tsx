import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Modal, Pressable, StyleSheet, Text, TextInput } from 'react-native';
import { Button, Card, Chips, ColorPicker, Empty, Fab, Field, IconButton, Screen, SectionTitle, Segmented, Sheet, T } from '@/components/ui';
import { tap } from '../haptics';
import { useReducedMotion } from '../use-reduced-motion';
import { MemberColors } from '@/constants/member-colors';

jest.mock('../use-reduced-motion', () => ({ useReducedMotion: jest.fn(() => false) }));

jest.mock('@expo/vector-icons/Ionicons', () => 'icon');
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'gradient' }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('@/components/assistant-context', () => ({ useAssistant: () => null }));
jest.mock('@/components/dialog', () => ({ showDialog: jest.fn() }));
jest.mock('@/constants/theme', () => ({ useTheme: () => ({}), Fonts: {}, Spacing: {}, Radius: {}, cardShadow: () => ({}) }));
jest.mock('../haptics', () => ({ tap: jest.fn() }));
jest.mock('react-native', () => Object.create(jest.requireActual('react-native'), {
  Pressable: { value: 'pressable' },
  TextInput: { value: 'text-input' },
  Modal: { value: 'modal' },
}));

let root: ReactTestRenderer;
beforeEach(() => { (useReducedMotion as jest.Mock).mockReturnValue(false); });
afterEach(async () => { if (root) await act(async () => root.unmount()); jest.clearAllMocks(); });
const options = [{ value: 'alice', label: 'Alice' }, { value: 'bob', label: 'Bob' }];

test.each(['card', 'fab'])('%s : réduire le mouvement retire le zoom d’appui sans désactiver l’action', async kind => {
  const action = jest.fn();
  const content = () => kind === 'card'
    ? <Card onPress={action} accessibilityLabel="Ouvrir le souvenir"><T>Souvenir fictif</T></Card>
    : <Fab onPress={action} label="Ajouter un souvenir" />;
  const scale = (pressed: boolean) => {
    const style = StyleSheet.flatten(root.root.findByType(Pressable).props.style({ pressed }));
    return style.transform?.find((entry: { scale?: number }) => entry.scale !== undefined)?.scale ?? 1;
  };
  await act(async () => { root = create(content()); });
  expect(scale(true)).toBeLessThan(scale(false));
  (useReducedMotion as jest.Mock).mockReturnValue(true);
  await act(async () => root.update(content()));
  expect(scale(true)).toBe(1);
  expect(scale(false)).toBe(1);
  await act(async () => { await root.root.findByType(Pressable).props.onPress(); });
  expect(action).toHaveBeenCalledTimes(1);
  (useReducedMotion as jest.Mock).mockReturnValue(false);
  await act(async () => root.update(content()));
  expect(scale(true)).toBeLessThan(scale(false));
});

test('la feuille suit la réduction du mouvement sans perdre ses enfants ni sa fermeture', async () => {
  const close = jest.fn();
  const content = <Sheet visible title="Formulaire fictif" onClose={close}><Field label="Prénom" value="Alice fictive" /></Sheet>;
  await act(async () => { root = create(content); });
  expect(root.root.findByType(Modal).props.animationType).toBe('slide');
  (useReducedMotion as jest.Mock).mockReturnValue(true);
  await act(async () => root.update(<Sheet visible title="Formulaire fictif" onClose={close}><Field label="Prénom" value="Alice fictive" /></Sheet>));
  expect(root.root.findByType(Modal).props.animationType).toBe('none');
  expect(root.root.findByType(TextInput).props.value).toBe('Alice fictive');
  await act(async () => root.root.findByType(Modal).props.onRequestClose());
  expect(close).toHaveBeenCalledTimes(1);
  (useReducedMotion as jest.Mock).mockReturnValue(false);
});

test('les onglets n’imposent ni hauteur fixe ni troncature à leurs libellés', async () => {
  await act(async () => { root = create(<Segmented options={[{ value: 'todo', label: 'À découvrir ensemble' }, { value: 'done', label: 'Déjà découverts ensemble' }]} value="todo" onChange={() => {}} />); });
  for (const button of root.root.findAllByType(Pressable)) {
    const style = StyleSheet.flatten(button.props.style);
    expect(style.height).toBeUndefined();
    expect(style.minHeight).toBeGreaterThanOrEqual(40);
    const label = button.findByType(Text);
    expect(label.props.numberOfLines).toBeUndefined();
    expect(label.props.allowFontScaling).not.toBe(false);
    expect(StyleSheet.flatten(label.props.style).textAlign).toBe('center');
  }
});

test.each(['screen', 'section', 'sheet', 'empty'])('%s : le titre est repérable comme en-tête accessible', async (kind) => {
  const title = 'Titre fictif';
  const content = kind === 'screen' ? <Screen title={title}><T>Contenu</T></Screen>
    : kind === 'section' ? <SectionTitle title={title} />
      : kind === 'sheet' ? <Sheet visible title={title} onClose={() => {}}><T>Contenu</T></Sheet>
        : <Empty title={title} text="Description fictive" icon="heart" />;
  await act(async () => { root = create(content); });
  const headings = root.root.findAllByType(Text).filter(node => node.props.accessibilityRole === 'header');
  expect(headings).toHaveLength(1);
  expect(headings[0].props.children).toBe(title);
});

test('un texte seulement stylé en h2 ne devient pas automatiquement un titre', async () => {
  await act(async () => { root = create(<T variant="h2">42</T>); });
  expect(root.root.findByType(Text).props.accessibilityRole).toBeUndefined();
});

test('un écran sans titre ne crée pas d’en-tête vide', async () => {
  await act(async () => { root = create(<Screen><T>Contenu</T></Screen>); });
  expect(root.root.findAllByType(Text).filter(node => node.props.accessibilityRole === 'header')).toHaveLength(0);
});

test('un champ sans titre garde son nom accessible après saisie', async () => {
  await act(async () => { root = create(<Field placeholder="Ton message" value="texte fictif" />); });
  expect(root.root.findByType(TextInput).props.accessibilityLabel).toBe('Ton message');
  expect(root.root.findByType(TextInput).props.accessibilityLabel).not.toContain('fictif');
});

test('le titre visible et le nom explicite gardent priorité sur le placeholder', async () => {
  await act(async () => { root = create(<Field label="Prénom" placeholder="Exemple" />); });
  expect(root.root.findByType(TextInput).props.accessibilityLabel).toBe('Prénom');
  await act(async () => root.update(<Field label="Prénom" placeholder="Exemple" accessibilityLabel="Prénom du partenaire" />));
  expect(root.root.findByType(TextInput).props.accessibilityLabel).toBe('Prénom du partenaire');
});

test.each([
  [{ editable: false }, true],
  [{ readOnly: true }, true],
  [{ editable: false, readOnly: false }, false],
  [{}, false],
] as const)('un champ annonce son état réellement modifiable (%p)', async (props, disabled) => {
  await act(async () => { root = create(<Field label="Légende" {...props} accessibilityState={{ busy: true }} />); });
  expect(root.root.findByType(TextInput).props.accessibilityState).toEqual({ busy: true, disabled });
});

test('les indications explicites du lecteur restent transmises', async () => {
  await act(async () => { root = create(<Field label="Note" accessibilityState={{ disabled: true, expanded: true }} accessibilityHint="Indication fictive" aria-label="Nom explicite web" />); });
  const input = root.root.findByType(TextInput);
  expect(input.props.accessibilityState).toEqual({ disabled: true, expanded: true });
  expect(input.props.accessibilityHint).toBe('Indication fictive');
  expect(input.props['aria-label']).toBe('Nom explicite web');
});

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

test.each([
  ['#C8385A', 'Rose framboise'], ['#2F5D9E', 'Bleu'], ['#1F7A55', 'Vert'],
  ['#C26A1B', 'Orange'], ['#6D4AB0', 'Violet'], ['#B03C8C', 'Rose mauve'], ['#1D7C86', 'Bleu canard'],
])('la pastille %s annonce le nom %s et garde sa valeur enregistrée', async (color, name) => {
  const onChange = jest.fn();
  await act(async () => { root = create(<ColorPicker colors={[color]} value={color} onChange={onChange} />); });
  const button = root.root.findByType(Pressable);
  expect(button.props.accessibilityLabel).toBe(`Couleur : ${name}`);
  expect(button.props.accessibilityState.checked).toBe(true);
  await act(async () => button.props.onPress());
  expect(onChange).toHaveBeenCalledWith(color);
});

test('les valeurs et l’ordre historiques de la palette restent inchangés', () => {
  expect(MemberColors).toEqual(['#C8385A', '#2F5D9E', '#1F7A55', '#C26A1B', '#6D4AB0', '#B03C8C', '#1D7C86']);
});

test.each([['#c26a1b', 'Orange'], ['#123456', '#123456']])('le nom de %s ne modifie pas sa valeur brute', async (color, label) => {
  const onChange = jest.fn();
  await act(async () => { root = create(<ColorPicker colors={[color]} value={color} onChange={onChange} />); });
  const button = root.root.findByType(Pressable);
  expect(button.props.accessibilityLabel).toBe(`Couleur : ${label}`);
  await act(async () => button.props.onPress());
  expect(onChange).toHaveBeenCalledWith(color);
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


test('le bouton flottant reflète une opération encore occupée après remontage', async () => {
  const onPress = jest.fn();
  await act(async () => { root = create(<Fab onPress={onPress} busy label="Envoi en cours" />); });
  const busyButton = root.root.findByType(Pressable);
  expect(busyButton.props.accessibilityState).toEqual({ disabled: true, busy: true });
  expect(busyButton.props.disabled).toBe(true);
  await act(async () => { await busyButton.props.onPress(); });
  expect(onPress).not.toHaveBeenCalled();
  await act(async () => { root.update(<Fab onPress={onPress} label="Ajouter une photo" />); });
  await act(async () => { await root.root.findByType(Pressable).props.onPress(); });
  expect(onPress).toHaveBeenCalledTimes(1);
});

test('une ancienne action flottante ne reprend pas après un aller-retour occupé', async () => {
  const onPress = jest.fn();
  await act(async () => { root = create(<Fab onPress={onPress} />); });
  const oldPress = root.root.findByType(Pressable).props.onPress;
  await act(async () => { root.update(<Fab onPress={onPress} busy />); });
  await act(async () => { root.update(<Fab onPress={onPress} />); });
  await act(async () => { await oldPress(); });
  expect(onPress).not.toHaveBeenCalled();
});
