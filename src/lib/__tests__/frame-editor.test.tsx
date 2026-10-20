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

describe('cycle de vie du glissement', () => {
  const surface = () => root.root.findAllByType(View).find(node => node.props.onResponderMove)!;
  const event = (value: number) => ({ nativeEvent: { pageX: value, pageY: value } });
  const setup = async () => {
    const onChange = jest.fn();
    const render = (disabled = false, uri = 'fictitious://photo') =>
      <PhotoFrameEditor uri={uri} frame={frame} onChange={onChange} disabled={disabled} />;
    await act(async () => { root = create(render()); });
    await act(async () => {
      surface().props.onLayout({ nativeEvent: { layout: { width: 100, height: 100 } } });
      root.root.findByType('image' as never).props.onLoad({ source: { width: 100, height: 100 } });
    });
    return { onChange, render };
  };

  test('un mouvement sans prise du geste ne change pas le cadrage', async () => {
    const { onChange } = await setup();
    await act(async () => surface().props.onResponderMove(event(10)));
    expect(onChange).not.toHaveBeenCalled();
  });

  test.each(['onResponderRelease', 'onResponderTerminate'])('%s termine le geste même si un mouvement arrive ensuite', async end => {
    const { onChange } = await setup();
    await act(async () => surface().props.onResponderGrant(event(0)));
    const move = surface().props.onResponderMove;
    await act(async () => surface().props[end]?.(event(0)));
    await act(async () => move(event(10)));
    expect(onChange).not.toHaveBeenCalled();
    await act(async () => {
      surface().props.onResponderGrant(event(0));
      surface().props.onResponderMove(event(10));
    });
    expect(onChange).toHaveBeenCalledWith({ x: 0.4, y: 0.4, zoom: 2 });
  });

  test.each(['disabled', 'reenabled', 'source', 'unmount'])('les événements retenus deviennent inactifs après %s', async change => {
    const { onChange, render } = await setup();
    const old = surface().props;
    const commands = root.root.findAllByType('button' as never).map(node => node.props.onPress);
    await act(async () => old.onResponderGrant(event(0)));
    await act(async () => {
      if (change === 'unmount') root.unmount();
      else root.update(change === 'source' ? render(false, 'fictitious://other') : render(true));
    });
    if (change === 'reenabled') await act(async () => root.update(render()));
    await act(async () => {
      old.onResponderMove(event(10));
      old.onResponderGrant(event(0));
      old.onResponderMove(event(20));
      commands.forEach(command => command());
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  test('le retour du cadrage au parent ne coupe pas un geste actif', async () => {
    const onChange = jest.fn();
    const render = (x: number) => <PhotoFrameEditor uri="fictitious://photo" frame={{ ...frame, x }} onChange={onChange} />;
    await act(async () => { root = create(render(0.5)); });
    await act(async () => {
      surface().props.onLayout({ nativeEvent: { layout: { width: 100, height: 100 } } });
      root.root.findByType('image' as never).props.onLoad({ source: { width: 100, height: 100 } });
    });
    await act(async () => {
      surface().props.onResponderGrant(event(0));
      surface().props.onResponderMove(event(10));
    });
    await act(async () => root.update(render(0.4)));
    await act(async () => surface().props.onResponderMove(event(20)));
    expect(onChange).toHaveBeenLastCalledWith({ x: 0.3, y: 0.3, zoom: 2 });
  });
});

test.each(['image', 'cadre', 'mesure invalide'])('le cadrage attend une géométrie complète : %s manquant', async missing => {
  const onChange = jest.fn();
  const surface = () => root.root.findAllByType(View).find(node => node.props.onResponderMove)!;
  const buttons = () => root.root.findAllByType('button' as never);
  await act(async () => { root = create(<PhotoFrameEditor uri="fictitious://portrait" frame={{ ...frame, zoom: 0 }} onChange={onChange} />); });
  await act(async () => {
    if (missing !== 'image') root.root.findByType('image' as never).props.onLoad({ source: { width: 100, height: 400 } });
    if (missing !== 'cadre') surface().props.onLayout({ nativeEvent: { layout: { width: 100, height: missing === 'mesure invalide' ? 0 : 100 } } });
  });
  expect(surface().props.onStartShouldSetResponder()).toBe(false);
  for (const button of buttons()) {
    expect(button.props.disabled).toBe(true);
    await act(async () => button.props.onPress());
  }
  expect(onChange).not.toHaveBeenCalled();
  const oldZoom = buttons().find(button => button.props.label === 'Zoomer')!.props.onPress;
  await act(async () => {
    root.root.findByType('image' as never).props.onLoad({ source: { width: 100, height: 400 } });
    surface().props.onLayout({ nativeEvent: { layout: { width: 100, height: 100 } } });
  });
  await act(async () => oldZoom());
  expect(onChange).not.toHaveBeenCalled();
  expect(buttons().every(button => !button.props.disabled)).toBe(true);
  await act(async () => buttons().find(button => button.props.label === 'Zoomer')!.props.onPress());
  expect(onChange).toHaveBeenCalledWith({ x: 0.5, y: 0.5, zoom: 0.4 });
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
