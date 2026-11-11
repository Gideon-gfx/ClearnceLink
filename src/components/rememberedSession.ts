import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// "Remember me": the sign-in token (never the password) is kept in the phone's secure storage, so the next launch goes
// straight to the dashboard until the session expires or the user signs out.
const KEY = 'clearancelink_remembered_session';
const BIOMETRIC_KEY = 'clearancelink_biometric_unlock';
const biometricOptions = { requireAuthentication: true, authenticationPrompt: 'Unlock ClearanceLink' };

export async function saveRememberedSession(session: { token: string }, useBiometrics = false) {
  if (Platform.OS === 'web' || !session?.token) return;
  try {
    if (useBiometrics) {
      await SecureStore.setItemAsync(KEY, JSON.stringify({ token: session.token }), biometricOptions);
      await SecureStore.setItemAsync(BIOMETRIC_KEY, '1');
    } else {
      await SecureStore.setItemAsync(KEY, JSON.stringify({ token: session.token }));
      await SecureStore.deleteItemAsync(BIOMETRIC_KEY);
    }
    return true;
  } catch {
    return false;
  }
}

export async function loadRememberedToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  const useBiometrics = await SecureStore.getItemAsync(BIOMETRIC_KEY).catch(() => null);
  try {
    const stored = await SecureStore.getItemAsync(KEY, useBiometrics === '1' ? biometricOptions : undefined);
    return stored ? JSON.parse(stored).token || null : null;
  } catch { return null; }
}

export async function clearRememberedSession() {
  if (Platform.OS === 'web') return;
  const useBiometrics = await SecureStore.getItemAsync(BIOMETRIC_KEY).catch(() => null);
  try { await SecureStore.deleteItemAsync(KEY, useBiometrics === '1' ? biometricOptions : undefined); } catch { /* nothing to clear */ }
  await SecureStore.deleteItemAsync(BIOMETRIC_KEY).catch(() => {});
}
