import { ImageManipulator, SaveFormat, type ImageRef } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

export type PickedPhoto = { uri: string; base64?: string; mediaType: 'image/jpeg' };

/** Réutiliser la référence décodée sans agrandir les petites images. */
async function fitImage(image: ImageRef, maximum: number): Promise<ImageRef> {
  if (![image.width, image.height].every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error('Les dimensions de cette photo sont illisibles. Choisis une autre image.');
  }
  if (Math.max(image.width, image.height) <= maximum) return image;
  return ImageManipulator.manipulate(image)
    .resize(image.height > image.width ? { height: maximum } : { width: maximum }).renderAsync();
}

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
  // Limiter le grand côté : borner seulement la largeur laisse les portraits
  // très hauts inchangés. Une seule dimension conserve le ratio côté natif.
  if (asset.height > asset.width && asset.height > 1600) context.resize({ height: 1600 });
  else if (asset.width > 1600) context.resize({ width: 1600 });
  // Les métadonnées du sélecteur peuvent valoir 0 : vérifier aussi les
  // dimensions réelles, disponibles après le décodage natif.
  const image = await fitImage(await context.renderAsync(), 1600);
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.75, base64: withBase64 });
  return { uri: saved.uri, base64: saved.base64, mediaType: 'image/jpeg' };
}

/**
 * Version compacte d'une photo, sous forme d'adresse « data: » à ranger directement dans Firestore
 * (solution de secours sans Firebase Storage). Une fiche Firestore est limitée à 1 Mo :
 * on réduit jusqu'à rester bien en dessous.
 */
export async function toCompactDataUri(uri: string): Promise<string> {
  const source = await ImageManipulator.manipulate(uri).renderAsync();
  for (const [maximum, compress] of [
    [900, 0.6],
    [700, 0.5],
    [500, 0.45],
  ] as const) {
    const image = await fitImage(source, maximum);
    const { base64 } = await image.saveAsync({ format: SaveFormat.JPEG, compress, base64: true });
    if (base64 && base64.length < 600_000) return `data:image/jpeg;base64,${base64}`;
  }
  throw new Error('Photo trop lourde');
}
