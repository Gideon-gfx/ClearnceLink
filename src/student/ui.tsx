import BackArrow from '../components/BackArrow';
import { useRef, useState } from 'react';
import { useAsyncPress } from '../components/useAsyncPress';
import ErrorBanner from '../components/ErrorBanner';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Animated, Pressable, ScrollView, Text, View } from 'react-native';
import { apiBaseUrl } from '../api';

export const PURPLE = '#5a17c9';
export const INK = '#171548';
export const MUTED = '#6e6b91';
export const LINE = '#e6e3f7';
export const BORDER = '#D9D2F3';
export const FIELD_BORDER = '#D2CAF1';
const STRIPS = ['#8427ed', '#7b20e7', '#721bdc', '#6817d2', '#5f13c6', '#5510bb', '#4b0bad'];

export const STATUS = {
  not_started: { label: 'Not Started', color: '#6e6b91', bg: '#f1f0f8' },
  in_progress: { label: 'In Progress', color: '#5a17c9', bg: '#ede9fe' },
  pending: { label: 'Pending Review', color: '#b45309', bg: '#fef3c7' },
  resubmitted: { label: 'Re-submitted', color: '#b45309', bg: '#fef3c7' },
  action_required: { label: 'Action Required', color: '#dc2626', bg: '#fee2e2' },
  cleared: { label: 'Cleared', color: '#15803d', bg: '#dcfce7' },
  completed: { label: 'Completed', color: '#15803d', bg: '#dcfce7' },
};

export function StatusBadge({ status, label }) {
  const style = STATUS[status] || STATUS.not_started;
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: style.bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
      <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', fontWeight: '700', color: style.color }}>{label || style.label}</Text>
    </View>
  );
}

export function ProgressBar({ percent, color = PURPLE, height = 6 }) {
  return (
    <View style={{ height, borderRadius: height, backgroundColor: '#ebe7fb', overflow: 'hidden' }}>
      <View style={{ height, width: `${Math.max(0, Math.min(100, percent))}%`, backgroundColor: color, borderRadius: height }} />
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

export function ErrorText({ children }) {
  return <ErrorBanner message={children} />;
}

const TABS = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'clearances', label: 'Clearances', icon: 'grid' },
  { key: 'cleared', label: 'Cleared', icon: 'checkmark-circle' },
  { key: 'profile', label: 'Profile', icon: 'person' },
];

export function BottomTabs({ active, onSelect, unread, tabs = TABS }) {
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

export function InstitutionMark({ size = 40 }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#ede9fe', alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name="shield-checkmark" size={size * 0.55} color={PURPLE} />
    </View>
  );
}

export function fileSource(fileId, token) {
  return { uri: `${apiBaseUrl}/api/files/${fileId}`, headers: { Authorization: `Bearer ${token}` } };
}

export function formatDate(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  const day = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return `${day}, ${time}`;
}

export function timeAgo(iso) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} hr ago`;
  return formatDate(iso).split(',')[0];
}

export function formatSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function shortName(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 2) return name;
  return `${parts[0]} ${parts.slice(1, -1).map((part) => `${part[0]}.`).join(' ')} ${parts.at(-1)}`;
}

export function useBusy() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (task) => {
    setBusy(true); setError('');
    try { return await task(); } catch (cause) { setError(cause.message || 'Something went wrong.'); } finally { setBusy(false); }
    return undefined;
  };
  return { busy, error, setError, run };
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

// The student's whole path: every clearance as a numbered circle, linked to the next (e.g. Hostel - Admission - Medical).
// A finished clearance is a green tick and turns the link after it green; the one to work on now has a purple ring.
export function ClearanceChain({ clearances, currentId, onPress }) {
  const current = currentId || (clearances.find((item) => item.status !== 'completed') || {}).id;
  const short = (name = '') => name.replace(/\s*clearance\s*$/i, '').trim() || name;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 4 }}>
      {clearances.map((item, index) => {
        const done = item.status === 'completed';
        const waiting = ['pending', 'in_progress', 'resubmitted'].includes(item.status);
        const on = item.id === current;
        const color = done ? '#16a34a' : item.status === 'action_required' ? '#dc2626' : waiting ? '#f59e0b' : on ? PURPLE : '#d9d3f0';
        return (
          <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`${item.name}, step ${index + 1} of ${clearances.length}`} onPress={() => onPress?.(item)} style={{ width: 88, alignItems: 'center' }}>
            {index < clearances.length - 1 ? <View style={{ position: 'absolute', top: 18, left: 44, width: 88, height: 4, borderRadius: 2, backgroundColor: done ? '#16a34a' : '#E3DDF5' }} /> : null}
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: color, alignItems: 'center', justifyContent: 'center', borderWidth: on ? 4 : 0, borderColor: '#ddd2fb' }}>
              {done ? <Ionicons name="checkmark" size={22} color="white" /> : <Text style={{ color: 'white', fontSize: 17, fontFamily: 'Inter_700Bold', fontWeight: '700' }}>{item.status === 'action_required' ? '!' : index + 1}</Text>}
            </View>
            <Text numberOfLines={2} style={{ marginTop: 6, paddingHorizontal: 4, fontSize: 12, textAlign: 'center', color: on ? INK : MUTED, fontFamily: on ? 'Inter_700Bold' : 'Inter_500Medium', fontWeight: on ? '700' : '500' }}>{short(item.name)}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
