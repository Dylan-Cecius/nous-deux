import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { View } from 'react-native';
import { useState } from 'react';
import { FramedPhoto, PhotoFrameEditor } from '@/components/framed-photo';

jest.mock('expo-image', () => ({ Image: 'image' }));
jest.mock('@/constants/theme', () => ({ useTheme: () => ({}) }));
jest.mock('@/components/ui', () => ({ IconButton: 'button', Row: 'row', T: 'text' }));
jest.mock('react-native', () => Object.create(jest.requireActual('react-native'), { View: { value: 'view' } }));

let root: ReactTestRenderer;
const frame = { x: 0.5, y: 0.5, zoom: 2 };
afterEach(async () => { if (root) await act(async () => root.unmount()); });

describe('commandes rapprochées de cadrage', () => {
  const setup = async (initial = frame) => {
    const changes = jest.fn();
    function Form() {
      const [value, setValue] = useState(initial);
      return <PhotoFrameEditor uri="fictitious://photo" frame={value} onChange={next => { changes(next); setValue(next); }} />;
    }
    await act(async () => { root = create(<Form />); });
    const surface = () => root.root.findAllByType(View).find(node => node.props.onResponderMove)!;
    await act(async () => {
      surface().props.onLayout({ nativeEvent: { layout: { width: 100, height: 100 } } });
      root.root.findByType('image' as never).props.onLoad({ source: { width: 100, height: 400 } });
    });
    const command = (label: string) => root.root.findAllByType('button' as never).find(node => node.props.label === label)!.props.onPress;
    return { changes, command, surface };
  };

  test.each([['Zoomer', 2.3], ['Dézoomer', 1.7]] as const)('deux appuis sur %s sont cumulés avant le prochain rendu', async (label, expected) => {
    const { changes, command } = await setup();
    const press = command(label);
    await act(async () => { press(); press(); });
    expect(changes.mock.calls.at(-1)?.[0].zoom).toBeCloseTo(expected);
  });

  test.each([['Photo entière', 0.4], ['Remplir le cadre', 1.15]] as const)('zoomer après %s part du cadrage choisi', async (label, expected) => {
    const { changes, command } = await setup({ x: 0.2, y: 0.7, zoom: 2 });
    const reset = command(label), zoom = command('Zoomer');
    await act(async () => { reset(); zoom(); });
    expect(changes).toHaveBeenLastCalledWith({ x: 0.5, y: 0.5, zoom: expected });
  });

  test('zoomer juste après un déplacement conserve sa position', async () => {
    const { changes, command, surface } = await setup();
    const zoom = command('Zoomer');
    const event = (value: number) => ({ nativeEvent: { pageX: value, pageY: value } });
    await act(async () => {
      surface().props.onResponderGrant(event(0));
      surface().props.onResponderMove(event(10));
      zoom();
    });
    expect(changes.mock.calls.at(-1)?.[0]).toEqual({ ...changes.mock.calls[0][0], zoom: 2.15 });
  });

  test.each(['Zoomer', 'Photo entière', 'Remplir le cadre'])('%s met fin au geste précédent', async label => {
    const { changes, command, surface } = await setup();
    const event = (value: number) => ({ nativeEvent: { pageX: value, pageY: value } });
    await act(async () => surface().props.onResponderGrant(event(0)));
    const move = surface().props.onResponderMove;
    await act(async () => command(label)());
    const count = changes.mock.calls.length;
    await act(async () => move(event(20)));
    expect(changes).toHaveBeenCalledTimes(count);
  });

  test.each([['Zoomer', 3], ['Dézoomer', 0.25]] as const)('les appuis répétés sur %s restent bornés', async (label, expected) => {
    const { changes, command } = await setup();
    const press = command(label);
    await act(async () => { for (let i = 0; i < 30; i++) press(); });
    expect(changes.mock.calls.at(-1)?.[0].zoom).toBe(expected);
  });

  test('un geste commencé après zoom utilise les nouvelles dimensions avant le rendu', async () => {
    const { changes, command, surface } = await setup();
    const zoom = command('Zoomer');
    const event = (value: number) => ({ nativeEvent: { pageX: value, pageY: value } });
    await act(async () => {
      zoom();
      surface().props.onResponderGrant(event(0));
      surface().props.onResponderMove(event(11.5));
    });
    expect(changes.mock.calls.at(-1)?.[0].x).toBeCloseTo(0.4);
    expect(changes.mock.calls.at(-1)?.[0].zoom).toBe(2.15);
  });
});

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
    const render = (x: number) => <PhotoFrameEditor uri="fictitious://photo" frame={{ ...frame, x, y: x }} onChange={onChange} />;
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

  test.each(['cadre', 'image', 'aller-retour'])('changer la géométrie (%s) termine le geste et invalide ses callbacks', async change => {
    const { onChange } = await setup();
    const old = surface().props;
    await act(async () => old.onResponderGrant(event(0)));
    const resize = async (width: number) => act(async () => {
      if (change === 'image') root.root.findByType('image' as never).props.onLoad({ source: { width, height: 100 } });
      else surface().props.onLayout({ nativeEvent: { layout: { width, height: 100 } } });
    });
    await resize(200);
    if (change === 'aller-retour') await resize(100);
    await act(async () => {
      old.onResponderMove(event(10));
      old.onResponderGrant(event(0));
      old.onResponderMove(event(20));
      surface().props.onResponderMove(event(30));
    });
    expect(onChange).not.toHaveBeenCalled();
    await act(async () => {
      surface().props.onResponderGrant(event(0));
      surface().props.onResponderMove(event(10));
    });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  test('une mesure identique ne coupe pas le glissement', async () => {
    const { onChange } = await setup();
    await act(async () => surface().props.onResponderGrant(event(0)));
    await act(async () => surface().props.onLayout({ nativeEvent: { layout: { width: 100, height: 100 } } }));
    await act(async () => surface().props.onResponderMove(event(10)));
    expect(onChange).toHaveBeenLastCalledWith({ x: 0.4, y: 0.4, zoom: 2 });
  });

  test.each([
    { next: { x: 0.8, y: 0.2, zoom: 2 }, expectedX: 0.7 },
    { next: { x: 0.5, y: 0.5, zoom: 1.5 }, expectedX: 0.3 },
  ])('un cadrage remplacé par le parent termine le geste courant : $next', async ({ next, expectedX }) => {
    const { onChange } = await setup();
    await act(async () => surface().props.onResponderGrant(event(0)));
    const oldMove = surface().props.onResponderMove;
    await act(async () => root.update(<PhotoFrameEditor uri="fictitious://photo" frame={next} onChange={onChange} />));
    await act(async () => {
      oldMove(event(10));
      surface().props.onResponderMove(event(20));
    });
    expect(onChange).not.toHaveBeenCalled();
    await act(async () => {
      surface().props.onResponderGrant(event(0));
      surface().props.onResponderMove(event(10));
    });
    const result = onChange.mock.calls[0][0];
    expect(result.zoom).toBe(next.zoom);
    expect(result.x).toBeCloseTo(expectedX);
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

describe('échec de chargement dans le cadrage', () => {
  const image = () => root.root.findByType('image' as never);
  const surface = () => root.root.findAllByType(View).find(node => node.props.onResponderMove)!;
  const buttons = () => root.root.findAllByType('button' as never);
  const error = { error: 'fictitious://private-photo?token=private-token' };
  const setup = async () => {
    const onChange = jest.fn();
    const render = (uri = 'fictitious://photo') => <PhotoFrameEditor uri={uri} frame={frame} onChange={onChange} />;
    await act(async () => { root = create(render()); });
    await act(async () => surface().props.onLayout({ nativeEvent: { layout: { width: 100, height: 100 } } }));
    return { onChange, render };
  };

  test('un échec est expliqué sans exposer le détail technique', async () => {
    await setup();
    await act(async () => image().props.onError?.(error));
    const content = JSON.stringify(root.toJSON());
    expect(content).toContain('Impossible d’afficher la photo');
    expect(content).toContain('rouvre le cadrage');
    expect(content).not.toContain('private-token');
    expect(buttons().every(button => button.props.disabled)).toBe(true);
  });

  test('un échec après chargement bloque les anciens gestes et commandes, puis un succès permet de reprendre', async () => {
    const { onChange } = await setup();
    await act(async () => image().props.onLoad({ source: { width: 100, height: 100 } }));
    const old = surface().props;
    const oldCommands = buttons().map(button => button.props.onPress);
    await act(async () => old.onResponderGrant({ nativeEvent: { pageX: 0, pageY: 0 } }));
    await act(async () => image().props.onError?.(error));
    expect(buttons().every(button => button.props.disabled)).toBe(true);
    await act(async () => {
      old.onResponderMove({ nativeEvent: { pageX: 10, pageY: 10 } });
      oldCommands.forEach(command => command());
    });
    expect(onChange).not.toHaveBeenCalled();
    await act(async () => image().props.onLoad({ source: { width: 100, height: 100 } }));
    expect(JSON.stringify(root.toJSON())).not.toContain('Impossible d’afficher la photo');
    expect(buttons().every(button => !button.props.disabled)).toBe(true);
    await act(async () => oldCommands.forEach(command => command()));
    expect(onChange).not.toHaveBeenCalled();
    await act(async () => buttons().find(button => button.props.label === 'Zoomer')!.props.onPress());
    expect(onChange).toHaveBeenLastCalledWith({ ...frame, zoom: 2.15 });
  });

  test('une ancienne erreur ne contamine pas une autre photo', async () => {
    const { render } = await setup();
    const oldError = image().props.onError;
    await act(async () => oldError?.(error));
    await act(async () => root.update(render('fictitious://other')));
    await act(async () => {
      surface().props.onLayout({ nativeEvent: { layout: { width: 100, height: 100 } } });
      image().props.onLoad({ source: { width: 100, height: 100 } });
      oldError?.(error);
    });
    expect(JSON.stringify(root.toJSON())).not.toContain('Impossible d’afficher la photo');
    expect(buttons().every(button => !button.props.disabled)).toBe(true);
  });
});
