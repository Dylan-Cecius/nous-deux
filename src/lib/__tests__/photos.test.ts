import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { pickPhoto, toCompactDataUri } from '../photos';

jest.mock('expo-image-picker', () => ({ requestCameraPermissionsAsync: jest.fn(), launchCameraAsync: jest.fn(), launchImageLibraryAsync: jest.fn() }));
jest.mock('expo-image-manipulator', () => ({ ImageManipulator: { manipulate: jest.fn() }, SaveFormat: { JPEG: 'jpeg' } }));

const save = jest.fn();
const resize = jest.fn();
const render = jest.fn();
const context = { resize, renderAsync: render };
const picked = (width: number, height: number) => ({ canceled: false, assets: [{ uri: 'fictitious://original', width, height }] });
beforeEach(() => {
  jest.resetAllMocks();
  resize.mockReturnValue(context);
  render.mockResolvedValue({ saveAsync: save });
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
