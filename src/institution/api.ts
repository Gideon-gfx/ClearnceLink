import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { apiBaseUrl, apiRequest } from '../api';

export function institutionApi(token) {
  const request = (path, body, method) => apiRequest(`/api/institution${path}`, body, token, method);
  const chooseSpreadsheet = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '*/*'], copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return null;
    const asset = result.assets[0];
    if (!/\.(xlsx|csv)$/i.test(asset.name)) throw new Error('Choose a .xlsx or .csv file.');
    if (asset.size && asset.size > 10 * 1024 * 1024) throw new Error('Choose a file under 10MB.');
    const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
    return { filename: asset.name, base64 };
  };
  const downloadTemplate = async (kind, format = 'xlsx') => {
    const url = `${apiBaseUrl}/api/institution/${kind}/template?format=${format}`;
    const destination = `${FileSystem.cacheDirectory}${kind}-import-template.${format}`;
    const result = await FileSystem.downloadAsync(url, destination, { headers: { Authorization: `Bearer ${token}` } });
    if (result.status !== 200) throw new Error('Could not download the template.');
    await Sharing.shareAsync(result.uri, { mimeType: format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  };
  return { request, chooseSpreadsheet, downloadTemplate };
}
