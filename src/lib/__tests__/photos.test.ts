import { ImageManipulator } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { pickPhoto } from '../photos';

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(), launchCameraAsync: jest.fn(), launchImageLibraryAsync: jest.fn(),
}));
jest.mock('expo-image-manipulator', () => ({ ImageManipulator: { manipulate: jest.fn() }, SaveFormat: { JPEG: 'jpeg' } }));

const picker = ImagePicker.launchImageLibraryAsync as jest.Mock;
const manipulate = ImageManipulator.manipulate as jest.Mock;
beforeEach(() => jest.resetAllMocks());

test('a tall screenshot is resized by height and encoded as JPEG without a forced crop', async () => {
  const saveAsync = jest.fn().mockResolvedValue({ uri: 'converted.jpg', base64: 'encoded' });
  const resize = jest.fn();
  manipulate.mockReturnValue({ resize, renderAsync: jest.fn().mockResolvedValue({ saveAsync }) });
  picker.mockResolvedValue({ canceled: false, assets: [{ uri: 'photo.heic', width: 1200, height: 7000 }] });
  const photo = await pickPhoto({ withBase64: true, document: true });
  expect(resize).toHaveBeenCalledWith({ height: 2200 });
  expect(picker).toHaveBeenCalledWith(expect.objectContaining({ allowsEditing: false }));
  expect(saveAsync).toHaveBeenCalledWith(expect.objectContaining({ format: 'jpeg', base64: true }));
  expect(photo?.mediaType).toBe('image/jpeg');
});

test('a compressed image exceeding the callable limit retries at a smaller size', async () => {
  const saveAsync = jest.fn()
    .mockResolvedValueOnce({ uri: 'large.jpg', base64: 'A'.repeat(3_800_001) })
    .mockResolvedValueOnce({ uri: 'small.jpg', base64: 'small' });
  manipulate.mockImplementation(() => ({ resize: jest.fn(), renderAsync: jest.fn().mockResolvedValue({ saveAsync }) }));
  picker.mockResolvedValue({ canceled: false, assets: [{ uri: 'image.png', width: 4000, height: 3000 }] });
  expect((await pickPhoto({ withBase64: true, document: true }))?.uri).toBe('small.jpg');
  expect(manipulate).toHaveBeenCalledTimes(2);
});

test('camera permission refusal explains the gallery alternative while cancel remains harmless', async () => {
  (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });
  await expect(pickPhoto({ camera: true })).rejects.toThrow('galerie');
  picker.mockResolvedValue({ canceled: true, assets: null });
  await expect(pickPhoto()).resolves.toBeNull();
  expect(manipulate).not.toHaveBeenCalled();
});
