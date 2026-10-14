import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

export type PickedPhoto = { uri: string; base64?: string; mediaType: 'image/jpeg' };

/**
 * Choisit une photo (galerie ou appareil photo) et la redimensionne pour rester légère.
 * Renvoie null si l'utilisateur annule ou refuse l'accès.
 */
export async function pickPhoto({ camera = false, withBase64 = false } = {}): Promise<PickedPhoto | null> {
  if (camera) {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return null;
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
  const result = camera
    ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const context = ImageManipulator.manipulate(asset.uri);
  if (asset.width > 1600) context.resize({ width: 1600 });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.75, base64: withBase64 });
  return { uri: saved.uri, base64: saved.base64, mediaType: 'image/jpeg' };
}

/**
 * Version compacte d'une photo, sous forme d'adresse « data: » à ranger directement dans Firestore
 * (solution de secours sans Firebase Storage). Une fiche Firestore est limitée à 1 Mo :
 * on réduit jusqu'à rester bien en dessous.
 */
export async function toCompactDataUri(uri: string): Promise<string> {
  for (const [width, compress] of [
    [900, 0.6],
    [700, 0.5],
    [500, 0.45],
  ] as const) {
    const image = await ImageManipulator.manipulate(uri).resize({ width }).renderAsync();
    const { base64 } = await image.saveAsync({ format: SaveFormat.JPEG, compress, base64: true });
    if (base64 && base64.length < 600_000) return `data:image/jpeg;base64,${base64}`;
  }
  throw new Error('Photo trop lourde');
}
