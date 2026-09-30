import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

// Sign-out with a confirmation: "Are you sure?" with Cancel / Sign out. After confirming, `busy` is true (show a
// spinner) for a moment before the session actually ends.
export function useSignOut(onSignOut) {
  const [busy, setBusy] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const ask = () => {
    if (busy) return;
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => { setBusy(true); timer.current = setTimeout(() => onSignOut(), 800); } },
    ], { cancelable: true });
  };
  return [busy, ask];
}
