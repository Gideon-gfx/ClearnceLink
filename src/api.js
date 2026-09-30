import Constants from 'expo-constants';
import { NativeModules, Platform } from 'react-native';

const metroAddress = Constants.expoConfig?.hostUri || NativeModules.SourceCode?.scriptURL;
const metroHost = metroAddress?.match(/(?:https?:\/\/)?([^/:]+)/)?.[1];
export const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL || `http://${Platform.OS === 'web' ? 'localhost' : metroHost || 'localhost'}:4000`;

export async function apiRequest(path, body, token, method) {
  let response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      method: method || (body === undefined ? 'GET' : 'POST'),
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new Error('Cannot reach the ClearanceLink server. Start the API and keep your phone on the same Wi-Fi.');
  }
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Something went wrong.');
  return result;
}
