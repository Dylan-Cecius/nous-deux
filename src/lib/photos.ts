import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

export type PickedPhoto = { uri: string; base64?: string; mediaType: 'image/jpeg' };

/**
 * Choisit une photo (galerie ou appareil photo) et la redimensionne pour rester légère.
 * Renvoie null en cas d’annulation ; explique un refus de caméra par une erreur.
 */
export async function pickPhoto({ camera = false, withBase64 = false, document = false } = {}): Promise<PickedPhoto | null> {
  if (camera) {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error('L’accès à l’appareil photo est désactivé. Autorise-le dans les réglages du téléphone ou choisis une image dans la galerie.');
  }
  // Preserve the full document. Native editing can force a square crop on iOS
  // and silently remove columns from a weekly schedule.
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, allowsEditing: false };
  const result = camera
    ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  // A portrait screenshot can be very tall despite a small width. Bound both
  // dimensions, preserve small print for OCR, and always convert HEIC to JPEG.
  const maxSide = document ? 2200 : 1600;
  for (const [size, quality] of [[maxSide, document ? 0.88 : 0.75], [1600, 0.75], [1200, 0.65]]) {
    const context = ImageManipulator.manipulate(asset.uri);
    if (Math.max(asset.width, asset.height) > size) {
      context.resize(asset.width >= asset.height ? { width: size } : { height: size });
    }
    const image = await context.renderAsync();
    const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: quality, base64: withBase64 });
    if (!withBase64 || (saved.base64 && saved.base64.length <= 3_800_000)) {
      return { uri: saved.uri, base64: saved.base64, mediaType: 'image/jpeg' };
    }
  }
  throw new Error('Cette photo reste trop lourde. Recadre une seule semaine du planning et réessaie.');
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
