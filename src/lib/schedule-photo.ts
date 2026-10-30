import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { requireOptionalNativeModule } from 'expo';
import { MAX_SCHEDULE_TEXT } from './schedule-import';

/** No upload, base64 conversion, model API or persistence of the extracted text. */
export async function readSchedulePhoto(camera: boolean): Promise<string | null> {
  if (Platform.OS === 'web') throw new Error('La lecture de photo est disponible dans l’application iPhone ou Android. Tu peux aussi coller le texte du planning.');
  // Lazy loading also lets an older native binary display a useful message instead of crashing.
  const extractor = requireOptionalNativeModule<{ recognize(uri: string): Promise<string[]> }>('ScheduleOcr');
  if (!extractor) throw new Error('La lecture de photo nécessite une nouvelle version de l’application. En attendant, colle le texte du planning.');
  if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted) {
    throw new Error('L’accès à l’appareil photo est refusé. Choisis une image ou autorise l’appareil photo dans les réglages.');
  }
  // iOS supports free cropping; Android's default square crop can cut off a paper schedule.
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, allowsEditing: Platform.OS === 'ios', base64: false, exif: false };
  const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets[0]) return null;
  let text: string;
  try {
    const lines = await extractor.recognize(result.assets[0].uri);
    if (!lines.some(line => line.trim())) throw new Error('empty');
    text = lines.join('\n');
  } catch { throw new Error('Texte illisible. Reprends une photo nette, recadrée sur une seule personne, ou colle le texte du planning.'); }
  if (text.length > MAX_SCHEDULE_TEXT) throw new Error('Le planning est trop long. Photographie une plus petite partie de la feuille.');
  return text;
}
