import { useEffect, useRef, useState } from 'react';
import { useConfirm } from './ConfirmSheet';

// Sign-out with a confirmation card that slides up from the bottom ("Sign out?" with Sign out / Cancel). After confirming,
// `busy` is true (show a spinner) for a moment before the session actually ends. Render `sheet` anywhere in the screen.
export function useSignOut(onSignOut) {
  const [busy, setBusy] = useState(false);
  const timer = useRef(null);
  const { confirm, sheet } = useConfirm();
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const ask = () => {
    if (busy) return;
    confirm({
      tone: 'danger', icon: 'log-out-outline', title: 'Sign out?', message: 'You will need to sign in again to use your account.',
      actions: [{ label: 'Sign out', variant: 'danger', onPress: () => { setBusy(true); timer.current = setTimeout(() => onSignOut(), 800); } }],
    });
  };
  return [busy, ask, sheet];
}
