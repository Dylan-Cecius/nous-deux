import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Platform, Pressable } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { DateField, TimeField } from '@/components/pickers';
import { useState } from 'react';

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

test.each(['ios', 'android', 'web'] as const)('%s refuse une date après la borne mais accepte la journée limite entière', async os => {
  await render(os);
  await act(async () => root.update(<DateField {...props} maximumDate={new Date(2024, 5, 7, 0, 0)} />));
  const choose = async (day: number) => act(async () => {
    if (os === 'ios') root.root.findByType(DateTimePicker).props.onValueChange({}, new Date(2024, 5, day, 23, 59));
    else if (os === 'android') {
      root.root.findByType(Pressable).props.onPress(); select()({}, new Date(2024, 5, day, 23, 59));
    } else root.root.findByType('field' as never).props.onChangeText(`${day}/06/2024`);
  });
  await choose(8);
  expect(onChange).not.toHaveBeenCalled();
  if (os === 'web') {
    await act(async () => root.root.findByType('field' as never).props.onBlur());
    expect(root.root.findByType('field' as never).props.value).toBe('02/01/2020');
  }
  await choose(7);
  expect(onChange).toHaveBeenCalledWith('2024-06-07');
});

test.each(['ios', 'android', 'web'] as const)('%s invalide une ancienne sélection après changement de date maximale', async os => {
  await render(os);
  const renderBound = (day: number) => <DateField {...props} maximumDate={new Date(2024, 5, day)} />;
  await act(async () => root.update(renderBound(10)));
  let oldSelect: () => void;
  if (os === 'ios') {
    const change = root.root.findByType(DateTimePicker).props.onValueChange;
    oldSelect = () => change({}, new Date(2024, 5, 8));
  } else if (os === 'android') {
    await act(async () => root.root.findByType(Pressable).props.onPress());
    const change = select(); oldSelect = () => change({}, new Date(2024, 5, 8));
  } else {
    const change = root.root.findByType('field' as never).props.onChangeText;
    oldSelect = () => change('08/06/2024');
  }
  await act(async () => root.update(renderBound(7)));
  await act(async () => oldSelect());
  await act(async () => root.update(renderBound(10)));
  await act(async () => oldSelect());
  expect(onChange).not.toHaveBeenCalled();
});

test('une nouvelle instance Date pour la même borne ne ferme pas le dialogue Android', async () => {
  await render('android');
  await act(async () => root.update(<DateField {...props} maximumDate={new Date(2024, 5, 7, 8)} />));
  await act(async () => root.root.findByType(Pressable).props.onPress());
  const change = select();
  await act(async () => root.update(<DateField {...props} maximumDate={new Date(2024, 5, 7, 9)} />));
  await act(async () => change({}, new Date(2024, 5, 7)));
  expect(onChange).toHaveBeenCalledWith('2024-06-07');
});

test('Android affiche et annonce aussi l’année de la date sélectionnée', async () => {
  await render('android');
  const button = root.root.findByType(Pressable);
  expect(button.props.accessibilityLabel).toContain('2020');
  expect(button.findByType('text' as never).props.children).toContain('2020');
  await act(async () => root.update(<DateField {...props} value="2024-06-07" />));
  expect(root.root.findByType(Pressable).props.accessibilityLabel).toContain('2024');
});

test('le sélecteur iOS conserve le contexte de son champ pour le lecteur d’écran', async () => {
  await render('ios');
  expect(root.root.findByType(DateTimePicker).props.accessibilityLabel).toBe('Date fictive');
  expect(root.root.findByType(DateTimePicker).props.accessibilityState).toEqual({ disabled: false });
  await act(async () => root.update(<DateField {...props} disabled />));
  expect(root.root.findByType(DateTimePicker).props.accessibilityState).toEqual({ disabled: true });
});

test('le sélecteur iOS d’heure est nommé sans remplacer sa valeur native', async () => {
  await render('ios');
  await act(async () => root.update(<TimeField label="Heure du rendez-vous" value="13:45" onChange={onChange} />));
  const picker = root.root.findByType(DateTimePicker);
  expect(picker.props.accessibilityLabel).toBe('Heure du rendez-vous');
  expect(picker.props.value.getHours()).toBe(13);
  expect(picker.props.value.getMinutes()).toBe(45);
});

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

test('web affiche la valeur externe courante sans ressusciter un ancien brouillon', async () => {
  await render('web');
  const field = () => root.root.findByType('field' as never);
  await act(async () => field().props.onChangeText('12/'));
  expect(field().props.value).toBe('12/');
  await act(async () => root.update(<DateField {...props} label="Libellé modifié" />));
  expect(field().props.value).toBe('12/');
  await act(async () => root.update(<DateField {...props} value="2024-06-07" />));
  expect(field().props.value).toBe('07/06/2024');
  await act(async () => root.update(<DateField {...props} />));
  expect(field().props.value).toBe('02/01/2020');
  expect(onChange).not.toHaveBeenCalled();
});

test('web conserve le format tapé pendant une saisie d’heure contrôlée', async () => {
  Object.defineProperty(Platform, 'OS', { value: 'web' });
  function Form() { const [value, setValue] = useState('09:00'); return <TimeField label="Heure" value={value} onChange={(next) => { onChange(next); setValue(next); }} />; }
  await act(async () => { root = create(<Form />); });
  const field = () => root.root.findByType('field' as never);
  for (const text of ['1', '12', '123', '1230']) {
    await act(async () => field().props.onChangeText(text));
    expect(field().props.value).toBe(text);
  }
  expect(onChange).toHaveBeenLastCalledWith('12:30');
  await act(async () => field().props.onBlur());
  expect(field().props.value).toBe('12:30');
});

test.each(['disabled', 'value', 'roundtrip'])('web ignore un ancien callback après %s', async (kind) => {
  await render('web');
  const field = () => root.root.findByType('field' as never);
  const oldChange = field().props.onChangeText;
  if (kind === 'value') await act(async () => root.update(<DateField {...props} value="2024-06-07" />));
  else {
    await act(async () => root.update(<DateField {...props} disabled />));
    if (kind === 'roundtrip') await act(async () => root.update(<DateField {...props} />));
  }
  await act(async () => oldChange('12/'));
  expect(field().props.value).toBe(kind === 'value' ? '07/06/2024' : '02/01/2020');
  expect(onChange).not.toHaveBeenCalled();
});
