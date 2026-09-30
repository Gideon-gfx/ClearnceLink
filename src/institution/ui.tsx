import BackArrow from '../components/BackArrow';
import { useEffect, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import ErrorBanner from '../components/ErrorBanner';
import TextLink from '../components/TextLink';
import { useAsyncPress } from '../components/useAsyncPress';
import { ActivityIndicator, Image, Pressable, ScrollView, StatusBar, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const C = { purple: '#5A17C9', purpleDark: '#4710AD', ink: '#171548', muted: '#71709D', line: '#E5E1F5', border: '#D9D2F3', pale: '#F3F0FF', green: '#00A66B', red: '#F01F4A', amber: '#F6A500' };
const strips = ['#8427ed', '#7b20e7', '#721bdc', '#6817d2', '#5f13c6', '#5510bb', '#4b0bad'];

// Downloads the institution logo (it needs the login token) and returns it as a data URI, or null.
export function useLogoUri(logoUrl, token) {
  const [uri, setUri] = useState(null);
  useEffect(() => {
    if (!logoUrl) { setUri(null); return undefined; }
    let live = true;
    fetch(logoUrl, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onloadend = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('read failed')); reader.readAsDataURL(blob); });
      })
      .then((next) => { if (live) setUri(next); })
      .catch((error) => console.warn('Institution logo could not be loaded:', error.message));
    return () => { live = false; };
  }, [logoUrl, token]);
  return uri;
}

export function BrandHeader({ name, subtitle, onNotify, logoUrl, token, unread = 0 }) {
  const logoUri = useLogoUri(logoUrl, token);
  const showLogo = Boolean(logoUri);
  return <View style={{ height: 84, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 17, borderBottomWidth: 1, borderColor: C.line, backgroundColor: 'white' }}>
    {/* The institution's own uploaded logo; the purple school icon only shows if none was uploaded or it could not load. */}
    <View style={{ width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: showLogo ? 'white' : C.purple, borderWidth: showLogo ? 1 : 0, borderColor: C.line, overflow: 'hidden' }}>
      {showLogo ? <Image source={{ uri: logoUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" accessibilityLabel="Institution logo" /> : <Ionicons name="school" size={30} color="white" />}
    </View>
    <View style={{ flex: 1, marginLeft: 12 }}><Text numberOfLines={2} style={{ fontSize: 18, lineHeight: 22, color: C.ink, fontFamily: 'Inter_800ExtraBold', fontWeight: '800' }}>{name}</Text><Text style={{ marginTop: 2, fontSize: 12, color: C.muted, fontFamily: 'Inter_500Medium' }}>{subtitle}</Text></View>
    <Pressable accessibilityRole="button" accessibilityLabel="Notifications" onPress={onNotify} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="notifications-outline" size={25} color={C.ink} />{unread > 0 ? <View style={{ position: 'absolute', top: 4, right: 3, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: C.red, borderWidth: 1.5, borderColor: 'white' }}><Text style={{ color: 'white', fontSize: 10, fontFamily: 'Inter_700Bold' }}>{unread > 99 ? '99+' : unread}</Text></View> : null}</Pressable>
  </View>;
}

// A screen's own header: back arrow on the left and the title in the centre.
export function ScreenTitle({ title, onBack }) {
  return <View style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, backgroundColor: 'white' }}>
    {onBack ? <BackArrow onPress={onBack} size={30} color={C.ink} style={{ width: 44, height: 48, justifyContent: 'center' }} /> : <View style={{ width: 44 }} />}
    <Text numberOfLines={1} style={{ flex: 1, textAlign: 'center', fontSize: 20, color: C.ink, fontFamily: 'Inter_800ExtraBold', fontWeight: '800' }}>{title}</Text>
    <View style={{ width: 44 }} />
  </View>;
}

export function BottomNav({ current, onSelect }) {
  const items = [['home', 'Home', 'speedometer-outline'], ['students', 'Students', 'people-outline'], ['staff', 'Staff', 'people-circle-outline'], ['oversight', 'Oversight', 'shield-checkmark-outline'], ['more', 'More', 'menu-outline']];
  return <View style={{ height: 70, flexDirection: 'row', borderTopWidth: 1, borderColor: C.line, backgroundColor: 'white' }}>
    {items.map(([id, label, icon]) => <Pressable key={id} accessibilityRole="button" onPress={() => onSelect(id)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={current === id ? icon.replace('-outline', '') : icon} size={25} color={current === id ? C.purple : '#7779A6'} />
      <Text style={{ marginTop: 3, fontSize: 11, color: current === id ? C.purple : '#7779A6', fontFamily: current === id ? 'Inter_700Bold' : 'Inter_500Medium' }}>{label}</Text>
    </Pressable>)}
  </View>;
}

export function Page({ title, subtitle, onBack, children, footer, noScroll = false }) {
  return <SafeAreaView style={{ flex: 1, backgroundColor: '#FCFBFF' }}>
    <StatusBar barStyle="dark-content" backgroundColor="white" />
    <ScreenTitle title={title} onBack={onBack} />
    {noScroll ? <View style={{ flex: 1, paddingHorizontal: 18, paddingTop: 17 }}>{subtitle ? <Text style={{ color: C.muted, fontSize: 14, lineHeight: 20, marginBottom: 16 }}>{subtitle}</Text> : null}{children}</View> : <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 17, paddingBottom: 30 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{subtitle ? <Text style={{ color: C.muted, fontSize: 14, lineHeight: 20, marginBottom: 16 }}>{subtitle}</Text> : null}{children}</ScrollView>}
    {footer ? <View style={{ paddingHorizontal: 18, paddingTop: 10, paddingBottom: 15, backgroundColor: 'white', borderTopWidth: 1, borderColor: C.line }}>{footer}</View> : null}
  </SafeAreaView>;
}

export function Card({ children, style }) { return <View style={[{ backgroundColor: 'white', borderWidth: 2, borderColor: C.border, borderRadius: 14, padding: 16, marginBottom: 10 }, style]}>{children}</View>; }
export function Heading({ children, action, onAction }) { return <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 12 }}><Text style={{ fontSize: 18, color: C.ink, fontFamily: 'Inter_800ExtraBold', fontWeight: '800' }}>{children}</Text>{action ? <TextLink onPress={onAction} color={C.purple} style={{ fontSize: 14, fontWeight: undefined, fontFamily: 'Inter_700Bold' }}>{action} →</TextLink> : null}</View>; }
export function Pill({ children, tone = 'purple' }) { const colors = tone === 'green' ? [C.green, '#D9F8EC'] : tone === 'red' ? [C.red, '#FFE8EF'] : tone === 'amber' ? ['#BC7800', '#FFF2D2'] : [C.purple, '#EEE8FF']; return <View style={{ alignSelf: 'flex-start', borderRadius: 20, paddingVertical: 5, paddingHorizontal: 10, backgroundColor: colors[1] }}><Text style={{ fontSize: 12, color: colors[0], fontFamily: 'Inter_700Bold' }}>{children}</Text></View>; }

// Main action button. Any async onPress automatically shows a spinner until it finishes; `busy` forces it on.
// iconSide="left" puts the icon beside the text instead of at the far end.
export function Primary({ title, onPress, icon = 'arrow-forward', disabled = false, danger = false, busy = false, iconSide = 'right' }) {
  const [pending, press] = useAsyncPress(onPress);
  const loading = busy || pending;
  const inline = iconSide === 'left';
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: disabled || loading, busy: loading }} onPress={disabled || loading ? undefined : press} style={{ height: 60, overflow: 'hidden', borderRadius: 15, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.55 : 1, backgroundColor: danger ? C.red : C.purple }}>
    {!danger ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, flexDirection: 'row' }}>{strips.map((color) => <View key={color} style={{ flex: 1, backgroundColor: color }} />)}</View> : null}
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
      {inline && !loading && icon ? <Ionicons name={icon} size={22} color="white" style={{ marginRight: 8 }} /> : null}
      {loading && inline ? <ActivityIndicator color="white" style={{ marginRight: 10 }} /> : null}
      <Text style={{ fontSize: 17, color: 'white', fontFamily: 'Inter_700Bold', fontWeight: '700' }}>{title}</Text>
    </View>
    {!inline ? (loading ? <ActivityIndicator color="white" style={{ position: 'absolute', right: 18 }} /> : icon ? <Ionicons name={icon} size={22} color="white" style={{ position: 'absolute', right: 18 }} /> : null) : null}
  </Pressable>;
}

export function Secondary({ title, onPress, icon, busy = false }) {
  const [pending, press] = useAsyncPress(onPress);
  const loading = busy || pending;
  return <Pressable accessibilityRole="button" accessibilityState={{ busy: loading }} onPress={loading ? undefined : press} style={{ minHeight: 54, borderRadius: 13, borderWidth: 2, borderColor: '#CBBFF5', backgroundColor: 'white', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12 }}>
    {loading ? <ActivityIndicator color={C.purple} /> : <Ionicons name={icon || 'add-outline'} size={20} color={C.purple} />}
    <Text style={{ fontSize: 14, color: C.purple, fontFamily: 'Inter_700Bold', fontWeight: '700' }}>{title}</Text>
  </Pressable>;
}

export function Input({ label, value, onChangeText, placeholder, keyboardType, multiline, secureTextEntry, error = false }) { return <View style={{ marginBottom: 16 }}><Text style={{ marginBottom: 8, fontSize: 14, color: C.ink, fontFamily: 'Inter_700Bold', fontWeight: '700' }}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#9995B5" keyboardType={keyboardType || 'default'} secureTextEntry={secureTextEntry} multiline={multiline} textAlignVertical={multiline ? 'top' : 'center'} style={{ minHeight: multiline ? 104 : 56, paddingHorizontal: 14, paddingVertical: multiline ? 13 : 0, borderWidth: 2, borderColor: error ? '#EF4444' : '#D2CAF1', borderRadius: 12, backgroundColor: error ? '#FFFAFA' : 'white', color: C.ink, fontSize: 16, fontFamily: 'Inter_500Medium' }} /></View>; }
export function Search({ value, onChangeText, placeholder }) { return <View style={{ height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, marginBottom: 12, borderWidth: 2, borderColor: '#D2CAF1', borderRadius: 14, backgroundColor: 'white' }}><Ionicons name="search" size={22} color={C.purple} /><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#9995B5" style={{ flex: 1, marginLeft: 10, color: C.ink, fontSize: 15, fontFamily: 'Inter_500Medium' }} />{value ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => onChangeText('')} hitSlop={10}><Ionicons name="close-circle" size={20} color="#B2A9DE" /></Pressable> : null}</View>; }
export function Segments({ items, value, onChange }) { return <View style={{ flexDirection: 'row', padding: 4, marginBottom: 14, borderRadius: 13, backgroundColor: C.pale }}>{items.map((item) => <Pressable key={item} onPress={() => onChange(item)} style={{ flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: value === item ? C.purple : 'transparent' }}><Text style={{ fontSize: 13, color: value === item ? 'white' : C.muted, fontFamily: value === item ? 'Inter_700Bold' : 'Inter_600SemiBold' }}>{item}</Text></Pressable>)}</View>; }
export function Message({ text, error = false }) { if (error) return <ErrorBanner message={text} />; return text ? <Text style={{ marginVertical: 8, color: error ? C.red : C.green, fontSize: 14 }}>{text}</Text> : null; }
export function Empty({ title, detail, icon = 'folder-open-outline' }) { return <View style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 }}><Ionicons name={icon} size={46} color="#B2A9DE" /><Text style={{ marginTop: 12, fontSize: 18, color: C.ink, fontFamily: 'Inter_700Bold' }}>{title}</Text><Text style={{ marginTop: 6, textAlign: 'center', fontSize: 14, lineHeight: 21, color: C.muted }}>{detail}</Text></View>; }
