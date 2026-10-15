import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Platform, Pressable } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { DateField } from '@/components/pickers';

jest.mock('@react-native-community/datetimepicker', () => ({ __esModule: true, default: 'picker', DateTimePickerAndroid: { open: jest.fn() } }));
jest.mock('@/constants/theme', () => ({ useTheme: () => ({}), Fonts: {} }));
jest.mock('@/components/ui', () => ({ Field: 'field', Ionicons: 'icon', Row: 'row', T: 'text' }));
jest.mock('react-native', () => Object.create(jest.requireActual('react-native'), { Pressable: { value: 'pressable' } }));

let root: ReactTestRenderer;
const originalOS = Platform.OS;
const onChange = jest.fn();
const props = { label: 'Date fictive', value: '2020-01-02', onChange };
beforeEach(() => jest.clearAllMocks());
afterEach(async () => { if (root) await act(async () => root.unmount()); Object.defineProperty(Platform, 'OS', { value: originalOS }); });
const render = async (os: 'ios' | 'android' | 'web', disabled = false) => {
  Object.defineProperty(Platform, 'OS', { value: os });
  await act(async () => { root = create(<DateField {...props} disabled={disabled} />); });
};
const select = () => (DateTimePickerAndroid.open as jest.Mock).mock.calls.at(-1)[0].onValueChange;

test.each(['ios', 'android', 'web'] as const)('%s refuse la saisie quand désactivé puis la réactive', async (os) => {
  await render(os, true);
  if (os === 'ios') {
    expect(root.root.findByType(DateTimePicker).props.disabled).toBe(true);
    await act(async () => root.root.findByType(DateTimePicker).props.onValueChange({}, new Date(2021, 1, 3)));
  } else if (os === 'android') {
    const button = root.root.findByType(Pressable);
    expect(button.props.accessibilityState.disabled).toBe(true);
    await act(async () => button.props.onPress());
    expect(DateTimePickerAndroid.open).not.toHaveBeenCalled();
  } else {
    expect(root.root.findByType('field' as never).props.editable).toBe(false);
    await act(async () => root.root.findByType('field' as never).props.onChangeText('03/02/2021'));
    expect(root.root.findByType('field' as never).props.value).toBe('02/01/2020');
  }
  expect(onChange).not.toHaveBeenCalled();
  await act(async () => root.update(<DateField {...props} disabled={false} />));
  await act(async () => {
    if (os === 'ios') root.root.findByType(DateTimePicker).props.onValueChange({}, new Date(2021, 1, 3));
    else if (os === 'android') { root.root.findByType(Pressable).props.onPress(); select()({}, new Date(2021, 1, 3)); }
    else root.root.findByType('field' as never).props.onChangeText('03/02/2021');
  });
  expect(onChange).toHaveBeenCalledWith('2021-02-03');
});

test.each(['unmount', 'disabled', 'roundtrip'])('Android ignore une réponse native après %s', async (kind) => {
  await render('android');
  await act(async () => root.root.findByType(Pressable).props.onPress());
  const oldSelect = select();
  if (kind === 'unmount') await act(async () => root.unmount());
  else {
    await act(async () => root.update(<DateField {...props} disabled />));
    if (kind === 'roundtrip') await act(async () => root.update(<DateField {...props} />));
  }
  await act(async () => oldSelect({}, new Date(2021, 1, 3)));
  expect(onChange).not.toHaveBeenCalled();
});

test('Android applique seulement la dernière ouverture et une seule réponse', async () => {
  await render('android');
  await act(async () => root.root.findByType(Pressable).props.onPress());
  const oldSelect = select();
  await act(async () => root.root.findByType(Pressable).props.onPress());
  const currentSelect = select();
  await act(async () => {
    oldSelect({}, new Date(2021, 1, 3));
    currentSelect({}, new Date(2022, 2, 4));
    currentSelect({}, new Date(2023, 3, 5));
  });
  expect(onChange.mock.calls).toEqual([['2022-03-04']]);
});

test('Android ignore une réponse après annulation du dialogue', async () => {
  await render('android');
  await act(async () => root.root.findByType(Pressable).props.onPress());
  const dialog = (DateTimePickerAndroid.open as jest.Mock).mock.calls.at(-1)[0];
  expect(dialog.onDismiss).toEqual(expect.any(Function));
  await act(async () => { dialog.onDismiss(); dialog.onValueChange({}, new Date(2021, 1, 3)); });
  expect(onChange).not.toHaveBeenCalled();
});

test.each(['changed', 'roundtrip'])('Android ignore un résultat après valeur externe %s', async (kind) => {
  await render('android');
  await act(async () => root.root.findByType(Pressable).props.onPress());
  const oldSelect = select();
  await act(async () => root.update(<DateField {...props} value="2024-06-07" />));
  if (kind === 'roundtrip') await act(async () => root.update(<DateField {...props} />));
  await act(async () => oldSelect({}, new Date(2021, 1, 3)));
  expect(onChange).not.toHaveBeenCalled();
});

test('une annulation ancienne ne ferme pas une ouverture plus récente', async () => {
  await render('android');
  await act(async () => root.root.findByType(Pressable).props.onPress());
  const oldDialog = (DateTimePickerAndroid.open as jest.Mock).mock.calls.at(-1)[0];
  await act(async () => root.root.findByType(Pressable).props.onPress());
  const currentSelect = select();
  await act(async () => { oldDialog.onDismiss?.(); currentSelect({}, new Date(2021, 1, 3)); });
  expect(onChange).toHaveBeenCalledWith('2021-02-03');
});

test('un changement du callback sans changement de valeur utilise le gestionnaire courant', async () => {
  await render('android');
  await act(async () => root.root.findByType(Pressable).props.onPress());
  const currentSelect = select();
  const nextChange = jest.fn();
  await act(async () => root.update(<DateField {...props} onChange={nextChange} />));
  await act(async () => currentSelect({}, new Date(2021, 1, 3)));
  expect(onChange).not.toHaveBeenCalled();
  expect(nextChange).toHaveBeenCalledWith('2021-02-03');
});
