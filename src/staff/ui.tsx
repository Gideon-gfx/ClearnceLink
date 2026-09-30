import BackArrow from '../components/BackArrow';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, Text, View } from 'react-native';
import { useAsyncPress } from '../components/useAsyncPress';
import { INK, LINE, MUTED, PURPLE, STATUS } from '../student/ui';

// The staff portal uses the same look as the institution admin: 2px borders, roomier boxes and larger type.
// Anything not restyled here comes straight from the shared student helpers.
export * from '../student/ui';

export const BORDER = '#D9D2F3';
export const FIELD_BORDER = '#D2CAF1';
const STRIPS = ['#8427ed', '#7b20e7', '#721bdc', '#6817d2', '#5f13c6', '#5510bb', '#4b0bad'];

export function StatusBadge({ status, label }) {
  const style = STATUS[status] || STATUS.not_started;
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: style.bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
      <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', fontWeight: '700', color: style.color }}>{label || style.label}</Text>
    </View>
  );
}

export function Card({ children, style, onPress }) {
  const base = { backgroundColor: 'white', borderRadius: 14, borderWidth: 2, borderColor: BORDER, padding: 16 };
  if (onPress) return <Pressable onPress={onPress} style={[base, style]}>{children}</Pressable>;
  return <View style={[base, style]}>{children}</View>;
}

export function ScreenHeader({ title, onBack, right, tint = 'white' }) {
  return (
    <View style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, backgroundColor: tint }}>
      <BackArrow onPress={onBack} label="Go back" size={30} color={INK} style={{ width: 44, height: 48, justifyContent: 'center' }} />
      <Text numberOfLines={1} style={{ flex: 1, textAlign: 'center', fontSize: 20, color: INK, fontFamily: 'Inter_800ExtraBold', fontWeight: '800' }}>{title}</Text>
      <View style={{ width: 44, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

// A tab's own title bar: back arrow on the left (returns to Home) and the title in the centre.
export function TabTitle({ title, onBack, right }) {
  return (
    <View style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 }}>
      {onBack ? <BackArrow onPress={onBack} size={30} color={INK} style={{ width: 44, height: 48, justifyContent: 'center' }} /> : <View style={{ width: 44 }} />}
      <Text numberOfLines={1} style={{ flex: 1, textAlign: 'center', fontSize: 20, color: INK, fontFamily: 'Inter_800ExtraBold', fontWeight: '800' }}>{title}</Text>
      <View style={{ width: 44, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

// Primary buttons carry the purple stripes; `danger` is solid red; `outline` is the bordered secondary button.
export function SolidButton({ title, onPress, icon, iconSide = 'left', variant = 'primary', disabled = false, busy: busyProp = false }) {
  const [pending, press] = useAsyncPress(onPress);
  const busy = busyProp || pending;
  const primary = variant === 'primary';
  const danger = variant === 'danger';
  const filled = primary || danger;
  const text = busy ? 'Please wait...' : title;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: disabled || busy, busy }} onPress={disabled || busy ? undefined : press}
      style={{ height: filled ? 60 : 56, overflow: 'hidden', borderRadius: filled ? 15 : 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 14, opacity: disabled ? 0.55 : 1, backgroundColor: danger ? '#F01F4A' : primary ? PURPLE : 'white', borderWidth: filled ? 0 : 2, borderColor: '#CBBFF5' }}>
      {primary ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, flexDirection: 'row' }}>{STRIPS.map((color) => <View key={color} style={{ flex: 1, backgroundColor: color }} />)}</View> : null}
      {busy && iconSide === 'left' ? <ActivityIndicator color={filled ? 'white' : PURPLE} /> : icon && iconSide === 'left' ? <Ionicons name={icon} size={filled ? 22 : 20} color={filled ? 'white' : PURPLE} /> : null}
      <Text style={{ fontSize: filled ? 17 : 15, color: filled ? 'white' : PURPLE, fontFamily: 'Inter_700Bold', fontWeight: '700' }}>{text}</Text>
      {iconSide === 'right' ? (busy ? <ActivityIndicator color={filled ? 'white' : PURPLE} style={{ position: 'absolute', right: 18 }} /> : icon ? <Ionicons name={icon} size={22} color={filled ? 'white' : PURPLE} style={{ position: 'absolute', right: 18 }} /> : null) : null}
    </Pressable>
  );
}

export function BottomTabs({ active, onSelect, unread, tabs }) {
  return (
    <View style={{ height: 70, flexDirection: 'row', borderTopWidth: 1, borderColor: LINE, backgroundColor: 'white' }}>
      {tabs.map((tab) => {
        const on = active === tab.key;
        return (
          <Pressable key={tab.key} accessibilityRole="tab" accessibilityLabel={tab.label} onPress={() => onSelect(tab.key)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <View>
              <Ionicons name={tab.icon} size={27} color={on ? PURPLE : '#7779A6'} />
              {tab.key === 'notifications' && unread > 0 ? (
                <View style={{ position: 'absolute', top: -5, right: -9, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#F01F4A', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 1.5, borderColor: 'white' }}>
                  <Text style={{ color: 'white', fontSize: 10, fontFamily: 'Inter_700Bold' }}>{unread > 9 ? '9+' : unread}</Text>
                </View>
              ) : null}
            </View>
            <Text style={{ marginTop: 3, fontSize: 11, color: on ? PURPLE : '#7779A6', fontFamily: on ? 'Inter_700Bold' : 'Inter_500Medium' }}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export { INK, LINE, MUTED, PURPLE };

// A box that looks raised (tinted background, border and shadow) and springs in a little when pressed.
export function RaisedPress({ children, onPress, tint = '#F6F2FF', border = '#D9D2F3', padding = 16, contentStyle, style, accessibilityLabel }: { children: any; onPress?: () => any; tint?: string; border?: string; padding?: number; contentStyle?: any; style?: any; accessibilityLabel?: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (value) => Animated.spring(scale, { toValue: value, speed: 40, bounciness: 6, useNativeDriver: true }).start();
  return (
    <Animated.View style={[{ transform: [{ scale }], borderRadius: 16, backgroundColor: tint, shadowColor: '#3b1a8a', shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 6 }, style]}>
      <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} onPressIn={() => to(0.95)} onPressOut={() => to(1)} style={[{ flex: 1, borderRadius: 16, borderWidth: 2, borderColor: border, padding, backgroundColor: tint }, contentStyle]}>
        {children}
      </Pressable>
    </Animated.View>
  );
}
