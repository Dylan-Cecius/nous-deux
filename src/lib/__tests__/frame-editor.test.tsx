import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { View } from 'react-native';
import { FramedPhoto, PhotoFrameEditor } from '@/components/framed-photo';

jest.mock('expo-image', () => ({ Image: 'image' }));
jest.mock('@/constants/theme', () => ({ useTheme: () => ({}) }));
jest.mock('@/components/ui', () => ({ IconButton: 'button', Row: 'row', T: 'text' }));
jest.mock('react-native', () => Object.create(jest.requireActual('react-native'), { View: { value: 'view' } }));

let root: ReactTestRenderer;
const frame = { x: 0.5, y: 0.5, zoom: 2 };
afterEach(async () => { if (root) await act(async () => root.unmount()); });

describe.each(['photo', 'editor'])('dimensions de %s', mode => {
  const render = (uri: string) => mode === 'photo'
    ? <FramedPhoto uri={uri} frame={frame} />
    : <PhotoFrameEditor uri={uri} frame={frame} onChange={jest.fn()} />;
  const image = () => root.root.findByType('image' as never);
  const measure = async (width = 100, height = 100) => act(async () => {
    root.root.findAllByType(View).find(node => node.props.onLayout)!.props.onLayout({ nativeEvent: { layout: { width, height } } });
  });
  const load = async (width = 200, height = 100) => act(async () => image().props.onLoad({ source: { width, height } }));

  test('changer de photo retire les anciennes dimensions avant le nouveau chargement', async () => {
    await act(async () => { root = create(render('fictitious://first')); });
    await measure(); await load();
    expect(image().props.style.width).toBe(400);
    await act(async () => root.update(render('fictitious://second')));
    expect(image().props.style.width).toBeUndefined();
    await measure(); await load(100, 200);
    expect(image().props.style.width).toBe(200);
    expect(image().props.style.height).toBe(400);
  });

  test.each([false, true])('un ancien chargement ne remplace pas les dimensions courantes (aller-retour %s)', async roundTrip => {
    await act(async () => { root = create(render('fictitious://first')); });
    await measure();
    const oldLoad = image().props.onLoad;
    await act(async () => root.update(render('fictitious://second')));
    if (roundTrip) await act(async () => root.update(render('fictitious://first')));
    await measure(); await load(100, 200);
    await act(async () => oldLoad({ source: { width: 200, height: 100 } }));
    expect(image().props.style.width).toBe(200);
    expect(image().props.style.height).toBe(400);
  });

  test.each([0, -1, NaN, Infinity])('une dimension d’image invalide (%s) ne produit pas de style calculé', async value => {
    await act(async () => { root = create(render('fictitious://first')); });
    await measure(); await load(value, 100);
    expect(image().props.style.width).toBeUndefined();
    await load(100, 200);
    expect(image().props.style.height).toBe(400);
  });

  test.each([0, -1, NaN, Infinity])('une dimension du cadre invalide (%s) attend une mesure valide', async value => {
    await act(async () => { root = create(render('fictitious://first')); });
    await load(); await measure(100, value);
    expect(image().props.style.width).toBeUndefined();
    await measure();
    expect(image().props.style.width).toBe(400);
  });
});

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
