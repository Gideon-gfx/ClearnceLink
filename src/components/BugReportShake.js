import { useLanguage } from '../i18n/LanguageContext';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Accelerometer } from 'expo-sensors';
import { File, Paths } from 'expo-file-system';
import { Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { apiRequest } from '../api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BugReportContext = createContext({ open: () => {}, setLocation: () => {} });
const settingFile = () => new File(Paths.document, 'shake-report-setting.json');
export const useBugReport = () => useContext(BugReportContext);

export function BugReportProvider({ children }) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [enabled, setEnabled] = useState(true);
  const [visible, setVisible] = useState(false);
  const [location, setLocation] = useState({ screen: 'welcome', role: 'guest', token: null });
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const offset = useRef(new Animated.Value(500)).current;
  const lastPeak = useRef(0);
  const lastOpen = useRef(0);
  const open = () => { setError(''); setSent(false); setVisible(true); };
  useEffect(() => {
    if (Platform.OS === 'web') return;
    settingFile().text().then((value) => setEnabled(JSON.parse(value).enabled !== false)).catch(() => {});
  }, []);
  useEffect(() => {
    if (Platform.OS === 'web' || !enabled) return;
    Accelerometer.setUpdateInterval(100);
    const subscription = Accelerometer.addListener(({ x, y, z }) => {
      const strength = Math.sqrt(x * x + y * y + z * z);
      if (strength < 2.1) return;
      const time = Date.now();
      if (time - lastPeak.current > 120 && time - lastPeak.current < 950 && time - lastOpen.current > 3500) {
        lastOpen.current = time;
        open();
      }
      lastPeak.current = time;
    });
    return () => subscription.remove();
  }, [enabled]);
  useEffect(() => {
    if (visible) { offset.setValue(500); Animated.spring(offset, { toValue: 0, useNativeDriver: true, damping: 23, stiffness: 190 }).start(); }
  }, [visible, offset]);
  const toggle = (value) => {
    setEnabled(value);
    if (Platform.OS !== 'web') {
      try { const file = settingFile(); if (!file.exists) file.create(); file.write(JSON.stringify({ enabled: value })); } catch { setError(t("Could not save this setting.")); }
    }
  };
  const submit = async () => {
    if (description.trim().length < 10) { setError(t("Describe the issue in at least 10 characters.")); return; }
    setBusy(true); setError('');
    try {
      await apiRequest('/api/bug-reports', { description: description.trim(), screen: location.screen, role: location.role, platform: Platform.OS }, location.token, 'POST');
      setDescription(''); setSent(true);
    } catch (cause) { setError(t(cause.message)); }
    finally { setBusy(false); }
  };
  return <BugReportContext.Provider value={{ open, setLocation }}>
    {children}
    <Modal visible={visible} transparent animationType="none" presentationStyle="overFullScreen" statusBarTranslucent navigationBarTranslucent onRequestClose={() => setVisible(false)}>
      <View style={{ flex: 1, backgroundColor: '#10072ACC' }}>
        <Pressable onPress={() => setVisible(false)} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />
        <KeyboardAvoidingView pointerEvents="box-none" behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Animated.View style={{ transform: [{ translateY: offset }], width: '100%', backgroundColor: 'white', borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: '86%', paddingTop: 10, paddingBottom: Math.max(insets.bottom, 12) }}>
            <View style={{ width: 42, height: 5, borderRadius: 3, backgroundColor: '#D9D2EA', alignSelf: 'center', marginBottom: 15 }} />
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 28 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}><View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: '#EEE6FF', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="bug-outline" size={22} color="#5A17C9" /></View><Text style={{ flex: 1, marginLeft: 11, color: '#171548', fontSize: 21, fontFamily: 'Inter_700Bold' }}>{t("Report a bug")}</Text><Pressable onPress={() => setVisible(false)} accessibilityLabel="Close bug report"><Ionicons name="close" size={25} color="#6E6B91" /></Pressable></View>
              <Text style={{ color: '#6E6B91', fontSize: 14, lineHeight: 20, marginBottom: 15 }}>{t("Tell us what happened. The current screen is included automatically.")}</Text>
              {sent ? <Text style={{ color: '#15803D', fontSize: 15, marginBottom: 14 }}>{t("Thank you. Your bug report was sent.")}</Text> : <><TextInput multiline value={description} onChangeText={setDescription} placeholder={t("What went wrong? What were you trying to do?")} placeholderTextColor="#9993B1" maxLength={2000} textAlignVertical="top" style={{ minHeight: 125, borderWidth: 1.5, borderColor: '#D9D2EA', borderRadius: 14, padding: 14, color: '#171548', fontSize: 15, marginBottom: 11 }} /><Pressable disabled={busy} onPress={submit} style={{ height: 50, borderRadius: 13, backgroundColor: '#5A17C9', alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.6 : 1 }}><Text style={{ color: 'white', fontSize: 15, fontFamily: 'Inter_600SemiBold' }}>{busy ? t("Sending...") : t("Send Report")}</Text></Pressable></>}
              {error ? <Text style={{ color: '#DC2626', marginTop: 9 }}>{error}</Text> : null}
              <View style={{ marginTop: 18, paddingTop: 15, borderTopWidth: 1, borderColor: '#E8E4F2', flexDirection: 'row', alignItems: 'center' }}><View style={{ flex: 1 }}><Text style={{ color: '#171548', fontSize: 15, fontFamily: 'Inter_600SemiBold' }}>{t("Shake to report")}</Text><Text style={{ color: '#6E6B91', fontSize: 12, marginTop: 2 }}>{t("Turn this shortcut on or off")}</Text></View><Switch value={enabled} onValueChange={toggle} trackColor={{ false: '#D9D2EA', true: '#B79AF2' }} thumbColor={enabled ? '#5A17C9' : '#FFFFFF'} /></View>
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  </BugReportContext.Provider>;
}
