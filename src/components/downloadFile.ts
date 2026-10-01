import JSZip from 'jszip';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Directory, File, Paths } from 'expo-file-system';
import { Alert, Linking, Platform, ToastAndroid } from 'react-native';
import { apiBaseUrl } from '../api';

// Saves a file into the device's download folder. The phone only lets an app write to a folder the user has approved, so
// the folder is asked for ONCE (pick "Downloads"); it is remembered, and every later download saves straight there.
// Returns false if the user backed out of the folder picker.
const FOLDER_NOTE = new File(Paths.document, 'download-folder.txt');
export async function saveToDownloadFolder(name: string, mimeType: string, bytes: Uint8Array): Promise<boolean> {
  if (FOLDER_NOTE.exists) {
    try {
      const remembered = new Directory(await FOLDER_NOTE.text());
      remembered.createFile(name, mimeType).write(bytes);
      return true;
    } catch { /* the folder is gone or its permission was removed: ask again below */ }
  }
  let folder: Directory;
  try { folder = await Directory.pickDirectoryAsync(); }
  catch (error) {
    // Backing out of the folder picker is not an error.
    if (/cancel|dismiss/i.test(String((error as Error)?.message || error))) return false;
    throw error;
  }
  folder.createFile(name, mimeType).write(bytes);
  try { FOLDER_NOTE.create({ overwrite: true }); FOLDER_NOTE.write(folder.uri); } catch { /* next time it just asks again */ }
  return true;
}

const notifySaved = (name: string) => {
  if (Platform.OS === 'android') ToastAndroid.show(`Saved ${name} to your downloads`, ToastAndroid.LONG);
  else Alert.alert('Saved', `${name} was saved.`);
};

// Downloads a protected file (sent with the sign-in token) and saves it to the device's download folder.
// (The name is kept from when this opened the share sheet.)
export async function downloadAndShare(url: string, fileName: string, token: string, mimeType?: string) {
  if (Platform.OS === 'web') { await Linking.openURL(url); return; }
  const safeName = fileName.replace(/[^\w.\- ]/g, '_');
  const target = new File(Paths.cache, safeName);
  const file = await File.downloadFileAsync(url, target, { headers: { Authorization: `Bearer ${token}` }, idempotent: true });
  if (await saveToDownloadFolder(safeName, mimeType || 'application/octet-stream', await file.bytes())) notifySaved(safeName);
}

// Downloads a protected PDF and opens the system print dialog for it (choose a printer or "Save as PDF").
export async function printFile(url: string, fileName: string, token: string) {
  if (Platform.OS === 'web') { await Linking.openURL(url); return; }
  const target = new File(Paths.cache, fileName.replace(/[^\w.\- ]/g, '_'));
  const file = await File.downloadFileAsync(url, target, { headers: { Authorization: `Bearer ${token}` }, idempotent: true });
  await Print.printAsync({ uri: file.uri });
}

export const stampedName = (fileName: string) => `${fileName.replace(/\.[^.]+$/, '')}-stamped.pdf`;

// Ask the student where to save, then write every approved PDF into one zip named after the folder (e.g. "Hostel Clearance.zip").
export async function saveStampedFilesToFolder(files: { fileId: string; fileName: string; stamped?: boolean }[], folderName: string, token: string) {
  if (Platform.OS === 'web') throw new Error('Open the mobile app to save a folder.');
  if (!files.length) throw new Error('There are no stamped documents to save yet.');
  const safeFolder = folderName.trim().replace(/[\\/:*?"<>|\x00-\x1f]/g, '-').replace(/^\.+$/, '');
  if (!safeFolder) throw new Error('Enter a folder name.');
  const zip = new JSZip();
  const folder = zip.folder(safeFolder);
  const used = new Set<string>();
  for (const [index, item] of files.entries()) {
    const base = (item.stamped === false ? (item.fileName || `document-${index + 1}`) : stampedName(item.fileName || `document-${index + 1}.pdf`)).replace(/[^\w.\- ]/g, '_');
    let name = base;
    let suffix = 2;
    while (used.has(name.toLowerCase())) name = base.replace(/(\.[^.]+)?$/, (ext) => `-${suffix++}${ext}`);
    used.add(name.toLowerCase());
    const cacheFile = new File(Paths.cache, `${item.fileId}-${name}`);
    const downloaded = await File.downloadFileAsync(`${apiBaseUrl}/api/files/${item.fileId}`, cacheFile, { headers: { Authorization: `Bearer ${token}` }, idempotent: true });
    folder.file(name, await downloaded.bytes());
  }
  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  const zipName = `${safeFolder}.zip`;
  // Empty string means the user backed out of the folder picker.
  return (await saveToDownloadFolder(zipName, 'application/zip', bytes)) ? zipName : '';
}
