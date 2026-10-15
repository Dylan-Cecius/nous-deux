import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Pressable, View } from 'react-native';
import { RestaurantRating } from '@/components/restaurant-rating';

jest.mock('@/constants/theme', () => ({ useTheme: () => ({ primary: '#123456', border: '#cccccc' }) }));
jest.mock('@/components/ui', () => ({ Ionicons: 'icon', Row: 'row' }));
jest.mock('react-native', () => Object.create(jest.requireActual('react-native'), {
  Pressable: { value: 'pressable' }, View: { value: 'view' },
}));

let root: ReactTestRenderer;
afterEach(async () => { if (root) await act(async () => root.unmount()); });

test.each([0, 3, 5])('la note en lecture seule %s est annoncée une fois sans faux boutons', async (value) => {
  await act(async () => { root = create(<RestaurantRating value={value} />); });
  const summary = root.root.findAllByType(View).filter((node) => node.props.accessible);
  expect(summary).toHaveLength(1);
  expect(summary[0].props.accessibilityRole).toBe('text');
  expect(summary[0].props.accessibilityLabel).toBe(value ? `Note : ${value} sur 5` : 'Aucune note');
  expect(root.root.findAllByType(Pressable)).toHaveLength(0);
  const decoration = root.root.findAllByType(View).find((node) => node.props.accessibilityElementsHidden);
  expect(decoration?.props.importantForAccessibility).toBe('no-hide-descendants');
});

test('les cinq choix annoncent la sélection et expliquent comment retirer la note', async () => {
  const onChange = jest.fn();
  await act(async () => { root = create(<RestaurantRating value={3} onChange={onChange} />); });
  const buttons = root.root.findAllByType(Pressable);
  expect(buttons.map((button) => button.props.accessibilityRole)).toEqual(Array(5).fill('button'));
  expect(buttons.map((button) => button.props.accessibilityState.selected)).toEqual([false, false, true, false, false]);
  expect(buttons[2].props.accessibilityHint).toBe('Retirer la note');
  expect(buttons[3].props.accessibilityHint).toBe('Attribuer 4 sur 5');
  await act(async () => { buttons[2].props.onPress(); buttons[3].props.onPress(); });
  expect(onChange.mock.calls).toEqual([[0], [4]]);
});

test('une note désactivée reste sélectionnée sans accepter de changement', async () => {
  const onChange = jest.fn();
  await act(async () => { root = create(<RestaurantRating value={3} onChange={onChange} disabled />); });
  const buttons = root.root.findAllByType(Pressable);
  expect(buttons.every((button) => button.props.disabled && button.props.accessibilityState.disabled)).toBe(true);
  expect(buttons[2].props.accessibilityState.selected).toBe(true);
  await act(async () => buttons[0].props.onPress());
  expect(onChange).not.toHaveBeenCalled();
  await act(async () => root.update(<RestaurantRating value={3} onChange={onChange} />));
  await act(async () => root.root.findAllByType(Pressable)[0].props.onPress());
  expect(onChange).toHaveBeenCalledWith(1);
});
