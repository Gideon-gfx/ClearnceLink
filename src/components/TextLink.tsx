import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

// A tappable text link that shows a small spinner while its action runs. Async actions keep the spinner until they
// finish; instant ones (like opening another screen) show it briefly so every tap gets visible feedback.
//   <TextLink onPress={...} color="#5a17c9" style={{ fontSize: 13 }}>Resend</TextLink>
export default function TextLink({ children, onPress, color = '#5a17c9', style, disabled = false, left = null, accessibilityLabel }) {
  const [pending, setPending] = useState(false);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  const press = () => {
    if (pending || disabled) return;
    setPending(true);
    const settle = () => { if (mounted.current) setPending(false); };
    let result;
    try { result = onPress?.(); } catch (error) { settle(); throw error; }
    if (result && typeof result.then === 'function') result.then(settle, settle);
    else setTimeout(settle, 700);
  };
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={accessibilityLabel} accessibilityState={{ disabled: disabled || pending, busy: pending }} disabled={disabled} onPress={press} hitSlop={8}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {left}
        <Text style={[{ fontWeight: '700', color, opacity: pending ? 0.6 : 1 }, style]}>{children}</Text>
        {pending ? <ActivityIndicator size="small" color={color} style={{ marginLeft: 6 }} /> : null}
      </View>
    </Pressable>
  );
}
