import { useCallback, useEffect, useRef, useState } from 'react';

// Wraps a button's onPress. When the handler returns a promise (an async action), the button reports `pending`
// until it settles, so it can show a spinner, and extra taps are ignored in the meantime.
export function useAsyncPress(onPress) {
  const [pending, setPending] = useState(false);
  const mounted = useRef(true);
  const running = useRef(false);
  useEffect(() => () => { mounted.current = false; }, []);
  const handler = useCallback((...args) => {
    if (running.current) return undefined;
    const result = onPress ? onPress(...args) : undefined;
    if (result && typeof result.then === 'function') {
      running.current = true;
      setPending(true);
      const done = () => { running.current = false; if (mounted.current) setPending(false); };
      result.then(done, done);
    }
    return result;
  }, [onPress]);
  return [pending, handler];
}
