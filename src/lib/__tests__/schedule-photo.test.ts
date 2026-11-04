import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import * as ImagePicker from 'expo-image-picker';
import { readSchedulePhoto } from '../schedule-photo';

jest.mock('expo', () => ({ requireOptionalNativeModule: jest.fn() }));
jest.mock('expo-image-picker', () => ({ requestCameraPermissionsAsync: jest.fn(), launchCameraAsync: jest.fn(), launchImageLibraryAsync: jest.fn() }));
const recognize = jest.fn();
const original = Platform.OS;
beforeEach(() => {
  jest.clearAllMocks(); Platform.OS = 'ios';
  (requireOptionalNativeModule as jest.Mock).mockReturnValue({ recognize });
  (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
  (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///fictif.jpg' }] });
  (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: true });
  recognize.mockReset().mockResolvedValue(['Lundi 09h-17h']);
});
afterEach(() => { Platform.OS = original; });
test('seule l’URI locale sélectionnée va au module, sans base64 ni EXIF', async () => {
  expect(await readSchedulePhoto(true)).toBe('Lundi 09h-17h');
  expect(recognize).toHaveBeenCalledWith('file:///fictif.jpg');
  expect(ImagePicker.launchCameraAsync).toHaveBeenCalledWith(expect.objectContaining({ base64: false, exif: false, allowsEditing: true }));
});
test('annuler ne lance pas la reconnaissance ni une permission caméra en galerie', async () => {
  expect(await readSchedulePhoto(false)).toBeNull();
  expect(recognize).not.toHaveBeenCalled();
  expect(ImagePicker.requestCameraPermissionsAsync).not.toHaveBeenCalled();
});
test('ancienne build et refus caméra donnent un diagnostic sans ouvrir le sélecteur', async () => {
  (requireOptionalNativeModule as jest.Mock).mockReturnValue(null);
  await expect(readSchedulePhoto(true)).rejects.toThrow('nouvelle version');
  (requireOptionalNativeModule as jest.Mock).mockReturnValue({ recognize });
  (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });
  await expect(readSchedulePhoto(true)).rejects.toThrow('refusé');
  expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
});
test('erreur native ne divulgue pas son contenu et un résultat vide est explicite', async () => {
  recognize.mockRejectedValueOnce(new Error('fichier privé fictif'));
  await expect(readSchedulePhoto(true)).rejects.toThrow('Texte illisible');
  recognize.mockResolvedValueOnce([]);
  await expect(readSchedulePhoto(true)).rejects.toThrow('Texte illisible');
});
test('le résultat natif avec positions retrouve les cellules de la même ligne', async () => {
  const cell = (text: string, x: number, y: number) => ({ text, x, y, width: 50, height: 12 });
  recognize.mockResolvedValue([cell('Jour', 0, 0), cell('Début', 100, 0), cell('Fin', 200, 0), cell('Lundi', 0, 30), cell('9h00', 100, 30), cell('Mardi', 0, 60), cell('14h00', 100, 60), cell('17h00', 200, 30), cell('22h00', 200, 60)]);
  expect(await readSchedulePhoto(true)).toBe('Lundi 9h00-17h00\nMardi 14h00-22h00');
});
