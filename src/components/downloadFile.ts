import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { Linking, Platform } from 'react-native';

// Downloads a protected file (sent with the sign-in token) and opens the share sheet so it can be saved or opened.
export async function downloadAndShare(url: string, fileName: string, token: string, mimeType?: string) {
  if (Platform.OS === 'web') { await Linking.openURL(url); return; }
  const target = new File(Paths.cache, fileName.replace(/[^\w.\- ]/g, '_'));
  const file = await File.downloadFileAsync(url, target, { headers: { Authorization: `Bearer ${token}` }, idempotent: true });
  await Sharing.shareAsync(file.uri, mimeType ? { mimeType } : undefined);
}

// Downloads a protected PDF and opens the system print dialog for it (choose a printer or "Save as PDF").
export async function printFile(url: string, fileName: string, token: string) {
  if (Platform.OS === 'web') { await Linking.openURL(url); return; }
  const target = new File(Paths.cache, fileName.replace(/[^\w.\- ]/g, '_'));
  const file = await File.downloadFileAsync(url, target, { headers: { Authorization: `Bearer ${token}` }, idempotent: true });
  await Print.printAsync({ uri: file.uri });
}

export const stampedName = (fileName: string) => `${fileName.replace(/\.[^.]+$/, '')}-stamped.pdf`;
