import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

// Lets the user choose ANY picture for their stamp or signature (PNG, JPG, WebP, HEIC, a screenshot...). It is re-saved as a
// PNG at a stamp-friendly size here, because that is the format that can be placed onto a PDF. Transparent backgrounds are kept.
export async function pickStampImage(): Promise<{ name: string; base64: string; mimeType: 'image/png' } | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  const width = asset.width && asset.width > 900 ? 900 : undefined;
  let converted = await manipulateAsync(asset.uri, width ? [{ resize: { width } }] : [], { format: SaveFormat.PNG, base64: true });
  // A very detailed picture can still be large as a PNG; shrink it further until it fits.
  for (const next of [600, 400]) {
    if ((converted.base64?.length || 0) * 0.75 <= 1.4 * 1024 * 1024) break;
    converted = await manipulateAsync(asset.uri, [{ resize: { width: next } }], { format: SaveFormat.PNG, base64: true });
  }
  if (!converted.base64) throw new Error('That picture could not be read. Please try a different one.');
  const base = (asset.fileName || 'stamp').replace(/\.[^.]+$/, '');
  return { name: `${base}.png`, base64: converted.base64, mimeType: 'image/png' };
}
