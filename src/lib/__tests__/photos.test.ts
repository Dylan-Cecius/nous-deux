import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { pickPhoto, toCompactDataUri } from '../photos';

jest.mock('expo-image-picker', () => ({ requestCameraPermissionsAsync: jest.fn(), launchCameraAsync: jest.fn(), launchImageLibraryAsync: jest.fn() }));
jest.mock('expo-image-manipulator', () => ({ ImageManipulator: { manipulate: jest.fn() }, SaveFormat: { JPEG: 'jpeg' } }));

const save = jest.fn();
const resize = jest.fn();
const render = jest.fn();
const context = { resize, renderAsync: render };
let image: { width: number; height: number; saveAsync: typeof save };
const picked = (width: number, height: number) => ({ canceled: false, assets: [{ uri: 'fictitious://original', width, height }] });
beforeEach(() => {
  jest.resetAllMocks();
  resize.mockReturnValue(context);
  image = { width: 1000, height: 1000, saveAsync: save };
  render.mockResolvedValue(image);
  save.mockResolvedValue({ uri: 'fictitious://prepared', base64: 'RklDVElG' });
  (ImageManipulator.manipulate as jest.Mock).mockReturnValue(context);
  (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue(picked(1000, 1000));
  (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
  (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue(picked(1000, 3000));
});

test.each([
  [1000, 10000, { height: 1600 }], [3000, 4000, { height: 1600 }],
  [4000, 3000, { width: 1600 }], [2000, 2000, { width: 1600 }],
])('la photo %s × %s borne son grand côté à 1600 sans déformer le ratio', async (width, height, expected) => {
  (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue(picked(width, height));
  await expect(pickPhoto()).resolves.toEqual({ uri: 'fictitious://prepared', base64: 'RklDVElG', mediaType: 'image/jpeg' });
  expect(resize).toHaveBeenCalledTimes(1);
  expect(resize).toHaveBeenCalledWith(expected);
  expect(save).toHaveBeenCalledWith({ format: SaveFormat.JPEG, compress: 0.75, base64: false });
});

test.each([[100, 200], [1600, 1600], [0, 0]])('la photo %s × %s n’est pas agrandie ni redimensionnée avec une taille inconnue', async (width, height) => {
  (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue(picked(width, height));
  await pickPhoto();
  expect(resize).not.toHaveBeenCalled();
});

test('une annulation ne lance pas de transformation', async () => {
  (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: true, assets: null });
  await expect(pickPhoto()).resolves.toBeNull();
  expect(ImageManipulator.manipulate).not.toHaveBeenCalled();
});

test('le refus de caméra ne lance ni sélecteur ni transformation', async () => {
  (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });
  await expect(pickPhoto({ camera: true })).resolves.toBeNull();
  expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
  expect(ImageManipulator.manipulate).not.toHaveBeenCalled();
});

test('la caméra et la galerie appliquent la même limite et le base64 reste optionnel', async () => {
  await pickPhoto({ camera: true, withBase64: true });
  expect(resize).toHaveBeenCalledWith({ height: 1600 });
  expect(save).toHaveBeenCalledWith({ format: SaveFormat.JPEG, compress: 0.75, base64: true });
  expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
});

test('une erreur native de préparation reste visible', async () => {
  render.mockRejectedValueOnce(new Error('Image fictive illisible'));
  await expect(pickPhoto()).rejects.toThrow('Image fictive illisible');
  expect(save).not.toHaveBeenCalled();
});

test('le repli compact conserve son seuil strict et refuse après trois essais trop grands', async () => {
  save.mockResolvedValue({ base64: 'x'.repeat(600000) });
  await expect(toCompactDataUri('fictitious://original')).rejects.toThrow('Photo trop lourde');
  expect(save).toHaveBeenCalledTimes(3);
});

test('les dimensions réelles corrigent des métadonnées du sélecteur inconnues', async () => {
  (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue(picked(0, 0));
  image.width = 1000; image.height = 10000;
  await pickPhoto();
  expect(ImageManipulator.manipulate).toHaveBeenCalledWith(image);
  expect(resize).toHaveBeenCalledWith({ height: 1600 });
});

test('le repli compact réduit aussi le grand côté des portraits', async () => {
  image.width = 200; image.height = 3000;
  await expect(toCompactDataUri('fictitious://original')).resolves.toBe('data:image/jpeg;base64,RklDVElG');
  expect(resize).toHaveBeenCalledWith({ height: 900 });
  expect(ImageManipulator.manipulate).toHaveBeenNthCalledWith(1, 'fictitious://original');
  expect(ImageManipulator.manipulate).toHaveBeenNthCalledWith(2, image);
});

test('une petite image n’est pas agrandie dans le repli compact', async () => {
  image.width = 100; image.height = 200;
  await toCompactDataUri('fictitious://original');
  expect(resize).not.toHaveBeenCalled();
});

test('les trois essais compacts repartent de la même référence décodée et gardent le seuil strict', async () => {
  image.width = 1200; image.height = 2400;
  save.mockResolvedValueOnce({ base64: 'x'.repeat(600000) }).mockResolvedValueOnce({ base64: 'x'.repeat(600001) }).mockResolvedValueOnce({ base64: 'FICTIF' });
  await expect(toCompactDataUri('fictitious://original')).resolves.toBe('data:image/jpeg;base64,FICTIF');
  expect(resize.mock.calls).toEqual([[{ height: 900 }], [{ height: 700 }], [{ height: 500 }]]);
  expect((ImageManipulator.manipulate as jest.Mock).mock.calls.filter(([source]) => typeof source === 'string')).toHaveLength(1);
  expect(save.mock.calls.map(([options]) => options.compress)).toEqual([0.6, 0.5, 0.45]);
});

test.each([0, -1, NaN, Infinity])('des dimensions décodées invalides (%s) sont refusées avant sauvegarde', async (width) => {
  image.width = width;
  await expect(toCompactDataUri('fictitious://original')).rejects.toThrow('dimensions');
  expect(save).not.toHaveBeenCalled();
});
