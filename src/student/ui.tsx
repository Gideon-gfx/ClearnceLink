import { useState } from 'react';
import { useAsyncPress } from '../components/useAsyncPress';
import ErrorBanner from '../components/ErrorBanner';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { apiBaseUrl } from '../api';

export const PURPLE = '#5a17c9';
export const INK = '#171548';
export const MUTED = '#6e6b91';
export const LINE = '#e6e3f7';

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
    <View style={{ alignSelf: 'flex-start', backgroundColor: style.bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ fontSize: 10, fontWeight: '700', color: style.color }}>{label || style.label}</Text>
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
  const base = { backgroundColor: 'white', borderRadius: 14, borderWidth: 1, borderColor: LINE, padding: 14, shadowColor: '#3b1a8a', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 };
  if (onPress) return <Pressable onPress={onPress} style={[base, style]}>{children}</Pressable>;
  return <View style={[base, style]}>{children}</View>;
}

export function ScreenHeader({ title, onBack, right, tint = 'white' }) {
  return (
    <View style={{ height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, backgroundColor: tint }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={onBack} style={{ width: 40, height: 44, justifyContent: 'center' }}>
        <Ionicons name="chevron-back" size={24} color={INK} />
      </Pressable>
      <Text numberOfLines={1} style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: INK }}>{title}</Text>
      <View style={{ width: 40, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

export function SolidButton({ title, onPress, icon, variant = 'primary', disabled, busy: busyProp }) {
  const [pending, press] = useAsyncPress(onPress);
  const busy = busyProp || pending;
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={disabled || busy ? undefined : press}
      className="active:opacity-85"
      style={{ height: 52, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: primary ? (disabled ? '#b9a5e8' : PURPLE) : 'white', borderWidth: primary ? 0 : 1.5, borderColor: '#d6ccf3' }}
    >
      {busy ? <ActivityIndicator color={primary ? 'white' : PURPLE} /> : icon ? <Ionicons name={icon} size={18} color={primary ? 'white' : PURPLE} /> : null}
      <Text style={{ fontSize: 15, fontWeight: '700', color: primary ? 'white' : PURPLE }}>{busy ? 'Please wait...' : title}</Text>
    </Pressable>
  );
}

export function ErrorText({ children }) {
  return <ErrorBanner message={children} />;
}

const TABS = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'clearances', label: 'Clearances', icon: 'grid' },
  { key: 'notifications', label: 'Notifications', icon: 'notifications' },
  { key: 'profile', label: 'Profile', icon: 'person' },
];

export function BottomTabs({ active, onSelect, unread, tabs = TABS }) {
  return (
    <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: LINE, backgroundColor: 'white', paddingTop: 6, paddingBottom: 8 }}>
      {tabs.map((tab) => {
        const on = active === tab.key;
        return (
          <Pressable key={tab.key} accessibilityRole="tab" accessibilityLabel={tab.label} onPress={() => onSelect(tab.key)} style={{ flex: 1, alignItems: 'center', minHeight: 48, justifyContent: 'center' }}>
            <View>
              <Ionicons name={on ? tab.icon : `${tab.icon}-outline`} size={22} color={on ? PURPLE : '#8b87a6'} />
              {tab.key === 'notifications' && unread > 0 ? (
                <View style={{ position: 'absolute', top: -4, right: -8, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
                  <Text style={{ color: 'white', fontSize: 9, fontWeight: '700' }}>{unread > 9 ? '9+' : unread}</Text>
                </View>
              ) : null}
            </View>
            <Text style={{ fontSize: 10, marginTop: 2, fontWeight: on ? '700' : '500', color: on ? PURPLE : '#8b87a6' }}>{tab.label}</Text>
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
