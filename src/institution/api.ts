import * as DocumentPicker from 'expo-document-picker';
import { apiBaseUrl, apiRequest } from '../api';
import { downloadAndShare } from '../components/downloadFile';
import { readFileAsBase64 } from '../components/readFile';

export function institutionApi(token) {
  const request = (path, body, method) => apiRequest(`/api/institution${path}`, body, token, method);
  const chooseSpreadsheet = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '*/*'], copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return null;
    const asset = result.assets[0];
    if (!/\.(xlsx|csv)$/i.test(asset.name)) throw new Error('Choose a .xlsx or .csv file.');
    if (asset.size && asset.size > 10 * 1024 * 1024) throw new Error('Choose a file under 10MB.');
    const base64 = await readFileAsBase64(asset.uri);
    return { filename: asset.name, base64 };
  };
  const downloadTemplate = async (kind, format = 'xlsx') => {
    const url = `${apiBaseUrl}/api/institution/${kind}/template?format=${format}`;
    const mimeType = format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    try { await downloadAndShare(url, `${kind}-import-template.${format}`, token, mimeType); }
    catch { throw new Error('Could not download the template. Check your connection and try again.'); }
  };
  return { request, chooseSpreadsheet, downloadTemplate };
}
