import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { View } from 'react-native';
import { PhotoFrameEditor } from '@/components/framed-photo';

jest.mock('expo-image', () => ({ Image: 'image' }));
jest.mock('@/constants/theme', () => ({ useTheme: () => ({}) }));
jest.mock('@/components/ui', () => ({ IconButton: 'button', Row: 'row', T: 'text' }));
jest.mock('react-native', () => Object.create(jest.requireActual('react-native'), { View: { value: 'view' } }));

let root: ReactTestRenderer;
const frame = { x: 0.5, y: 0.5, zoom: 2 };
afterEach(async () => { if (root) await act(async () => root.unmount()); });

test.each([true, false])('désactivé=%s : commandes et déplacement respectent le verrou', async (disabled) => {
  const onChange = jest.fn();
  await act(async () => { root = create(<PhotoFrameEditor uri="fictitious://photo" frame={frame} onChange={onChange} disabled={disabled} />); });
  const surface = () => root.root.findAllByType(View).find((node) => node.props.onResponderMove)!;
  await act(async () => {
    surface().props.onLayout({ nativeEvent: { layout: { width: 100, height: 100 } } });
    root.root.findByType('image' as never).props.onLoad({ source: { width: 100, height: 100 } });
  });
  expect(surface().props.onStartShouldSetResponder()).toBe(!disabled);
  expect(surface().props.onMoveShouldSetResponderCapture()).toBe(!disabled);
  for (const button of root.root.findAllByType('button' as never)) {
    expect(button.props.disabled).toBe(disabled);
    await act(async () => button.props.onPress());
  }
  await act(async () => {
    surface().props.onResponderGrant({ nativeEvent: { pageX: 0, pageY: 0 } });
    surface().props.onResponderMove({ nativeEvent: { pageX: 10, pageY: 10 } });
  });
  expect(onChange).toHaveBeenCalledTimes(disabled ? 0 : 5);
});
