import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { ActivityIndicator, Image, Modal } from 'react-native';
import { apiBaseUrl } from '../api';
import ErrorBanner from '../components/ErrorBanner';
import { useSignOut } from '../components/useSignOut';
import { useBugReport } from '../components/BugReportShake';
import { C, Card, Heading, ScreenTitle, useLogoUri } from './ui';
import { LinearGradient } from 'expo-linear-gradient';
import { planSummary, planTheme } from './plansScreen';

const actions = [['Institution Settings', 'settings-outline', 'settings'], ['Completion Actions', 'gift-outline', 'completion'], ['Digital Stamp', 'ribbon-outline', 'stamp'], ['Generated Student IDs', 'key-outline', 'review-student-ids'], ['Generated Staff IDs', 'id-card-outline', 'review-staff-ids'], ['Notifications', 'notifications-outline', 'activity']];
async function toBase64(uri) {
  const blob = await (await fetch(uri)).blob();
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onloadend = () => resolve(String(reader.result).split(',')[1]); reader.onerror = () => reject(new Error('Could not read the selected image.')); reader.readAsDataURL(blob); });
}

export default function MoreScreen({ user, token, logoUrl, onLogoChanged, onNavigate, onSignOut, onBack }) {
  const { open: openBugReport } = useBugReport();
  const logoUri = useLogoUri(logoUrl, token);
  const [menu, setMenu] = useState(false);
  const [viewing, setViewing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [logoError, setLogoError] = useState('');
  const replaceLogo = async () => {
    setMenu(false); setLogoError('');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const mimeType = asset.mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
    if (asset.fileSize && asset.fileSize > 2 * 1024 * 1024) { setLogoError('The logo must be under 2MB.'); return; }
    setUploading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/institution/logo`, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: asset.fileName || 'logo', mimeType, base64: await toBase64(asset.uri) }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not replace the logo.');
      onLogoChanged();
    } catch (cause) { setLogoError(cause.message); }
    finally { setUploading(false); }
  };
  const [signingOut, askSignOut, signOutSheet] = useSignOut(onSignOut);
  return <View style={{ flex: 1, backgroundColor: 'white' }}><ScreenTitle title="More" onBack={onBack} /><ScrollView contentContainerStyle={{ paddingHorizontal: 17, paddingTop: 10, paddingBottom: 35 }}>
    <Pressable accessibilityRole="button" accessibilityLabel="Institution logo. View or replace" onPress={() => setMenu(true)}>
      <Card style={{ marginTop: 16, alignItems: 'center', backgroundColor: '#F8F5FF' }}>
        <View>
          <View style={{ width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: logoUri ? 'white' : C.purple, borderWidth: 2, borderColor: C.border, overflow: 'hidden' }}>
            {uploading ? <ActivityIndicator color={logoUri ? C.purple : 'white'} /> : logoUri ? <Image source={{ uri: logoUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <Ionicons name="school" size={40} color="white" />}
          </View>
          <View style={{ position: 'absolute', right: -6, bottom: -6, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: C.purple, borderWidth: 2, borderColor: 'white' }}><Ionicons name="camera" size={15} color="white" /></View>
        </View>
        <Text style={{ marginTop: 12, color: C.ink, fontSize: 19, fontFamily: 'Inter_800ExtraBold', fontWeight: '800', textAlign: 'center' }}>{user?.institutionName}</Text>
        {(() => {
          const theme = planTheme(user?.plan); const tone = user?.expired ? C.red : theme.color; const rich = user?.plan === 'enterprise' && !user?.expired;
          const chip = <>
            <Ionicons name={theme.icon} size={15} color={rich ? 'white' : tone} />
            <Text style={{ marginLeft: 6, color: rich ? 'white' : tone, fontSize: 12.5, fontFamily: 'Inter_700Bold', fontWeight: '700' }}>{planSummary(user)}</Text>
            <Ionicons name="chevron-forward" size={14} color={rich ? 'white' : tone} style={{ marginLeft: 3 }} />
          </>;
          const shape = { flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16 } as const;
          return <Pressable accessibilityRole="button" accessibilityLabel="Current plan. View plans or upgrade" onPress={() => onNavigate('plans')}>
            {rich ? <LinearGradient colors={theme.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={shape}>{chip}</LinearGradient> : <View style={{ ...shape, backgroundColor: theme.tint, borderWidth: 1.5, borderColor: tone }}>{chip}</View>}
          </Pressable>;
        })()}
        <Text style={{ marginTop: 8, color: C.muted, fontSize: 13 }}>Institution Administrator</Text>
        <Text style={{ marginTop: 8, color: C.purple, fontSize: 12, fontFamily: 'Inter_700Bold', fontWeight: '700' }}>Tap the logo to view or replace it</Text>
      </Card>
    </Pressable>
    <ErrorBanner message={logoError} />
    <Heading>Institution Controls</Heading>
    <Pressable onPress={openBugReport} style={{ height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, marginBottom: 8, borderWidth: 1.5, borderColor: C.border, borderRadius: 14, backgroundColor: 'white' }}><Ionicons name="bug-outline" size={23} color={C.purple} /><Text style={{ flex: 1, marginLeft: 13, color: C.ink, fontSize: 15, fontFamily: 'Inter_600SemiBold' }}>Report a bug</Text><Ionicons name="chevron-forward" size={19} color={C.muted} /></Pressable>
    {actions.map(([label, icon, target]) => <Pressable key={target} onPress={() => onNavigate(target)} style={{ height: 66, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10, borderWidth: 2, borderColor: C.border, borderRadius: 14, backgroundColor: 'white' }}><Ionicons name={icon} size={24} color={C.purple} /><Text style={{ flex: 1, marginLeft: 14, color: C.ink, fontSize: 16, fontFamily: 'Inter_700Bold', fontWeight: '700' }}>{label}</Text><Ionicons name="chevron-forward" size={21} color={C.muted} /></Pressable>)}
    <Pressable accessibilityRole="button" onPress={askSignOut} style={{ height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20, borderWidth: 2, borderColor: '#FFC4CF', borderRadius: 14, backgroundColor: '#FFF5F7' }}>{signingOut ? <ActivityIndicator color={C.red} /> : <Ionicons name="log-out-outline" size={22} color={C.red} />}<Text style={{ marginLeft: 8, color: C.red, fontSize: 16, fontFamily: 'Inter_700Bold', fontWeight: '700' }}>{signingOut ? 'Signing out...' : 'Sign Out'}</Text></Pressable>{signOutSheet}
  </ScrollView>
  <Modal transparent visible={menu} animationType="fade" onRequestClose={() => setMenu(false)}>
    <Pressable style={{ flex: 1, backgroundColor: 'rgba(23,19,43,0.5)', justifyContent: 'flex-end' }} onPress={() => setMenu(false)}>
      <Pressable style={{ backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28 }} onPress={() => {}}>
        <View style={{ alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: '#D6D3DF', marginBottom: 14 }} />
        <Text style={{ fontSize: 19, color: C.ink, fontFamily: 'Inter_800ExtraBold', fontWeight: '800', marginBottom: 12 }}>Institution logo</Text>
        {logoUri ? <Pressable accessibilityRole="button" onPress={() => { setMenu(false); setViewing(true); }} style={{ height: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, marginBottom: 10, borderWidth: 2, borderColor: C.border, borderRadius: 14 }}><Ionicons name="eye-outline" size={24} color={C.purple} /><Text style={{ marginLeft: 14, fontSize: 16, color: C.ink, fontFamily: 'Inter_700Bold', fontWeight: '700' }}>View logo</Text></Pressable> : null}
        <Pressable accessibilityRole="button" onPress={replaceLogo} style={{ height: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, marginBottom: 10, borderWidth: 2, borderColor: C.border, borderRadius: 14 }}><Ionicons name="swap-horizontal" size={24} color={C.purple} /><Text style={{ marginLeft: 14, fontSize: 16, color: C.ink, fontFamily: 'Inter_700Bold', fontWeight: '700' }}>{logoUri ? 'Replace logo' : 'Upload logo'}</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => setMenu(false)} style={{ height: 56, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 16, color: C.muted, fontFamily: 'Inter_700Bold', fontWeight: '700' }}>Cancel</Text></Pressable>
      </Pressable>
    </Pressable>
  </Modal>
  <Modal visible={viewing} animationType="fade" onRequestClose={() => setViewing(false)}>
    <View style={{ flex: 1, backgroundColor: '#0f0b1f', alignItems: 'center', justifyContent: 'center' }}>
      {logoUri ? <Image source={{ uri: logoUri }} style={{ width: '92%', height: '70%' }} resizeMode="contain" /> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => setViewing(false)} style={{ position: 'absolute', top: 48, right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="close" size={26} color="white" /></Pressable>
    </View>
  </Modal>
  </View>;
}
