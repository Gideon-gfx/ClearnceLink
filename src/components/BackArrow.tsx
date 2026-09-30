import { useEffect, useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable } from 'react-native';

// The back arrow used at the top of screens. Tapping it swaps the arrow for a small spinner while the screen changes,
// and ignores repeat taps meanwhile.
export default function BackArrow({ onPress, size = 30, color = '#171548', label = 'Back', style, className }: { onPress: () => any; size?: number; color?: string; label?: string; style?: any; className?: string }) {
  const [pending, setPending] = useState(false);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  const press = () => {
    if (pending) return;
    setPending(true);
    const settle = () => { if (mounted.current) setPending(false); };
    let result;
    try { result = onPress?.(); } catch (error) { settle(); throw error; }
    if (result && typeof result.then === 'function') result.then(settle, settle);
    else setTimeout(settle, 700);
  };
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ busy: pending }} onPress={press} style={style} className={className}>
      {pending ? <ActivityIndicator size="small" color={color} /> : <Ionicons name="chevron-back" size={size} color={color} />}
    </Pressable>
  );
}
