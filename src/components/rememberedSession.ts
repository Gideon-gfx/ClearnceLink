import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// "Remember me": the sign-in token (never the password) is kept in the phone's secure storage, so the next launch goes
// straight to the dashboard until the session expires or the user signs out.
const KEY = 'clearancelink_remembered_session';

export async function saveRememberedSession(session: { token: string }) {
  if (Platform.OS === 'web' || !session?.token) return;
  try { await SecureStore.setItemAsync(KEY, JSON.stringify({ token: session.token })); } catch { /* not remembered, that is all */ }
}

export async function loadRememberedToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  try {
    const stored = await SecureStore.getItemAsync(KEY);
    return stored ? JSON.parse(stored).token || null : null;
  } catch { return null; }
}

export async function clearRememberedSession() {
  if (Platform.OS === 'web') return;
  try { await SecureStore.deleteItemAsync(KEY); } catch { /* nothing to clear */ }
}
