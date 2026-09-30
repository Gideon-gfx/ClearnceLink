import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, ScrollView, TextInput, View } from 'react-native';

// Fields call this on focus so the screen can bring them above the keyboard,
// including when the user moves from one field to the next with the keyboard already open.
const listeners = new Set();
export const notifyFieldFocus = () => listeners.forEach((listener) => listener());

const GAP = 24;

export default function KeyboardScreen({ children, style, contentContainerStyle, onScroll, ...props }) {
  const scroll = useRef(null);
  const scrollY = useRef(0);
  const keyboardTop = useRef(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const reveal = useCallback(() => {
    if (keyboardTop.current === null) return;
    setTimeout(() => {
      const input = TextInput.State.currentlyFocusedInput?.();
      input?.measureInWindow?.((x, y, width, height) => {
        const overlap = y + height + GAP - keyboardTop.current;
        if (overlap > 0) scroll.current?.scrollTo({ y: scrollY.current + overlap, animated: true });
      });
    }, 60);
  }, []);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (event) => {
      keyboardTop.current = event.endCoordinates.screenY;
      setKeyboardHeight(event.endCoordinates.height);
      reveal();
    });
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => {
      keyboardTop.current = null;
      setKeyboardHeight(0);
    });
    listeners.add(reveal);
    return () => { show.remove(); hide.remove(); listeners.delete(reveal); };
  }, [reveal]);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={scroll}
        style={style}
        contentContainerStyle={[{ flexGrow: 1 }, contentContainerStyle, keyboardHeight ? { paddingBottom: keyboardHeight + GAP + 40 } : null]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onScroll={(event) => { scrollY.current = event.nativeEvent.contentOffset.y; onScroll?.(event); }}
        scrollEventThrottle={100}
        showsVerticalScrollIndicator={false}
        {...props}
      >
        {children}
      </ScrollView>
    </View>
  );
}
