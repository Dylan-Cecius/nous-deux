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
