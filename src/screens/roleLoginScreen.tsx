import LanguagePicker from '../i18n/LanguagePicker';
import { useLanguage } from '../i18n/LanguageContext';
import BackArrow from '../components/BackArrow';
import TextLink from '../components/TextLink';
import { useEffect, useRef, useState } from 'react';
import KeyboardScreen from '../components/KeyboardScreen';
import ErrorBanner from '../components/ErrorBanner';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Defs, Ellipse, Path, RadialGradient, Stop } from 'react-native-svg';
import { useFonts } from 'expo-font';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Alert, Animated, Easing, Image, Keyboard, LayoutAnimation, Platform, Pressable, ScrollView, StatusBar, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Field, PrimaryButton } from '../components/Shared';
import { apiRequest } from '../api';
import { clearRememberedSession, saveRememberedSession } from '../components/rememberedSession';

type LoginMode = 'student' | 'staff' | 'institution';
type LoginSession = { token: string; user: { role: string; email: string } };
type RoleLoginProps = { mode: LoginMode; onBack: () => void; onRegister: () => void; onForgot: () => void; onLogin: (result: LoginSession) => void };
const errorMessage = (cause: unknown) => cause instanceof Error ? cause.message : 'Something went wrong.';

export function RoleLoginScreen({ mode, onBack, onRegister, onForgot, onLogin }: RoleLoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [useBiometrics, setUseBiometrics] = useState(false);
  const [adminChallenge, setAdminChallenge] = useState('');
  const [adminCode, setAdminCode] = useState('');
  const [setupMode, setSetupMode] = useState(false);
  const [setupSent, setSetupSent] = useState(false);
  const [setupCode, setSetupCode] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [confirmAdminPassword, setConfirmAdminPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const backOffset = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  // While the keyboard is up, the tall purple header is swapped for a slim bar so the fields have room above the keyboard.
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => { LayoutAnimation.easeInEaseOut(); setKeyboardOpen(true); });
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => { LayoutAnimation.easeInEaseOut(); setKeyboardOpen(false); });
    return () => { show.remove(); hide.remove(); };
  }, []);
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  const { width, height } = useWindowDimensions();
  const role = mode === 'institution' ? 'Institution' : mode === 'staff' ? 'Staff' : 'Student';
  const portal = mode === 'institution' ? t('portalInstitution') : mode === 'staff' ? t('portalStaff') : t('portalStudent');
  const headerScale = Math.min(Math.max(width / 260, 1), 1.62);
  const logoScale = headerScale;
  const curveScale = headerScale;
  const panelTop = Math.max(height * 0.375, 194 * headerScale);
  const leftRise = 12 * curveScale;
  const waveHeight = 54 * curveScale;
  const goBackAnimated = () => Animated.timing(backOffset, { toValue: width, duration: 260, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start(({ finished }) => { if (finished) onBack(); });
  const finishLogin = async (result) => {
    if (remember) {
      const saved = await saveRememberedSession(result, useBiometrics);
      if (useBiometrics && saved === false) Alert.alert('Biometric unlock unavailable', 'You can still sign in, but this device could not enable biometric unlock.');
    }
    else await clearRememberedSession();
    onLogin(result);
  };
  const submit = async () => {
    if (adminChallenge) {
      if (!adminCode.trim()) { setError('Enter the email verification code.'); return; }
      setError('');
      setBusy(true);
      try { await finishLogin(await apiRequest('/api/platform-admin/login/verify', { challengeId: adminChallenge, code: adminCode.trim() })); }
      catch (cause) { setError(t(errorMessage(cause))); }
      finally { setBusy(false); }
      return;
    }
    if (!email.trim() || !password) { setError(t('errEnterBoth')); return; }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError(t('errEmail')); return; }
    setError('');
    setBusy(true);
    try {
      const result = await apiRequest('/api/auth/login', { role: mode, email: email.trim(), password });
      if (result.platformAdminOtpRequired) { setAdminChallenge(result.challengeId); setError('A sign-in code was sent to the platform admin email.'); return; }
      if (result.platformAdminSetupRequired) { setSetupMode(true); setError('Set up the platform admin password using the admin email OTP.'); return; }
      await finishLogin(result);
    }
    catch (cause) { setError(t(errorMessage(cause))); }
    finally { setBusy(false); }
  };
  const requestAdminSetup = async () => {
    setError('');
    setBusy(true);
    try { await apiRequest('/api/platform-admin/setup/request', { email: email.trim() }); setSetupSent(true); setError('A setup code was sent if this is the configured platform admin email.'); }
    catch (cause) { setError(t(errorMessage(cause))); }
    finally { setBusy(false); }
  };
  const completeAdminSetup = async () => {
    if (!/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(newAdminPassword)) { setError('Password needs 8 characters, an uppercase letter, a number and a symbol.'); return; }
    if (newAdminPassword !== confirmAdminPassword) { setError('Passwords do not match.'); return; }
    setError('');
    setBusy(true);
    try { await finishLogin(await apiRequest('/api/platform-admin/setup/complete', { email: email.trim(), code: setupCode.trim(), password: newAdminPassword })); }
    catch (cause) { setError(t(errorMessage(cause))); }
    finally { setBusy(false); }
  };
  return (
    <Animated.View style={{ flex: 1, backgroundColor: 'white', transform: [{ translateX: backOffset }] }}><SafeAreaView style={{ flex: 1, backgroundColor: 'white' }} edges={['left', 'right', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor="#5a17c9" />
      {keyboardOpen ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', height: 78 + (Platform.OS === 'ios' ? insets.top : 0), paddingTop: Platform.OS === 'ios' ? insets.top : 0, paddingHorizontal: 14, backgroundColor: '#5a17c9' }}>
          <BackArrow onPress={goBackAnimated} label={t("Go back to welcome")} size={26} color="white" style={{ width: 44, height: 48, justifyContent: 'center' }} />
          <Text style={{ flex: 1, textAlign: 'center', marginLeft: 44, marginRight: 8, fontSize: 18, color: 'white', fontFamily: fontsLoaded ? 'Inter_700Bold' : undefined, fontWeight: fontsLoaded ? undefined : '700' }}>{portal}</Text>
          <LanguagePicker tone="light" />
        </View>
      ) : (
      <View style={{ height: panelTop + waveHeight + 12, overflow: 'hidden', backgroundColor: '#5a17c9' }}>
        <Svg width={width} height={panelTop + waveHeight + 12} style={{ position: 'absolute', top: 0, left: 0 }} pointerEvents="none">
          <Defs>
            <RadialGradient id="loginDark" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0%" stopColor="#22004f" stopOpacity="0.7" />
              <Stop offset="55%" stopColor="#2c0568" stopOpacity="0.52" />
              <Stop offset="82%" stopColor="#330779" stopOpacity="0.2" />
              <Stop offset="100%" stopColor="#330779" stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="loginLight" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0%" stopColor="#984cff" stopOpacity="0.56" />
              <Stop offset="65%" stopColor="#984cff" stopOpacity="0.3" />
              <Stop offset="100%" stopColor="#984cff" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Ellipse cx={0} cy={-13 * headerScale} rx={145 * headerScale} ry={145 * headerScale} fill="url(#loginDark)" />
          <Ellipse cx={143 * headerScale} cy={130 * headerScale} rx={150 * headerScale} ry={150 * headerScale} fill="url(#loginDark)" />
          <Ellipse cx={width + 19 * headerScale} cy={12 * headerScale} rx={125 * headerScale} ry={125 * headerScale} fill="url(#loginLight)" />
          <Ellipse cx={56 * headerScale} cy={panelTop + waveHeight - 5 * headerScale} rx={145 * headerScale} ry={110 * headerScale} fill="url(#loginDark)" />
        </Svg>
        <View style={{ position: 'absolute', top: 62 * headerScale, left: 0, right: 0, alignItems: 'center' }}>
          <View style={{ width: 100 * logoScale, height: 73 * logoScale, overflow: 'hidden' }}>
            <Image source={require('../assets/logo-transparent.png')} resizeMode="stretch" style={{ width: 100 * logoScale, height: 100 * logoScale }} accessibilityLabel="ClearanceLink logo" />
          </View>
          <View style={{ width: 132 * logoScale, height: 30 * logoScale, overflow: 'hidden' }}>
            <Image source={require('../assets/logo-transparent.png')} resizeMode="stretch" style={{ position: 'absolute', top: -96 * logoScale, width: 132 * logoScale, height: 132 * logoScale, tintColor: '#ffffff' }} accessibilityLabel="ClearanceLink name and tagline" />
          </View>
          <Text style={{ marginTop: 3, fontSize: 11, color: '#eee6ff', fontFamily: fontsLoaded ? 'Inter_400Regular' : undefined }}>{portal}</Text>
        </View>
        <Svg width={width} height={waveHeight + 1} style={{ position: 'absolute', top: panelTop - leftRise, left: 0 }} pointerEvents="none">
          <Path d={`M 0 0 C 0 ${18 * curveScale} ${width * 0.12} ${20 * curveScale} ${width * 0.28} ${15 * curveScale} C ${width * 0.52} ${8 * curveScale} ${width * 0.74} ${4 * curveScale} ${width * 0.88} ${19 * curveScale} C ${width * 0.96} ${27 * curveScale} ${width * 0.995} ${39 * curveScale} ${width} ${waveHeight} L ${width} ${waveHeight + 1} L 0 ${waveHeight + 1} Z`} fill="white" />
        </Svg>
        <View style={{ position: 'absolute', top: panelTop - leftRise + waveHeight, left: 0, right: 0, bottom: 0, backgroundColor: 'white' }} />
        <BackArrow onPress={goBackAnimated} label={t("Go back to welcome")} size={22} color="white" style={{ position: 'absolute', left: 18, top: Math.max(46, insets.top + 22), width: 40, height: 42, justifyContent: 'center' }} />
        <View style={{ position: 'absolute', right: 18, top: Math.max(46, insets.top + 22) + 3 }}><LanguagePicker tone="light" /></View>
      </View>
      )}
      {keyboardOpen ? null : <Image
        source={require('../assets/campus-footer.png')}
        resizeMode="stretch"
        pointerEvents="none"
        accessibilityLabel="University campus building"
        style={{ position: 'absolute', left: 0, bottom: 0, width, height: 155 * headerScale, opacity: 0.78 }}
      />}
      <KeyboardScreen style={{ marginTop: keyboardOpen ? 14 : -36 * headerScale, zIndex: 1 }} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 25, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
        <Text style={{ marginTop: 2, textAlign: 'center', fontSize: 22, color: '#171548', fontFamily: fontsLoaded ? 'Inter_700Bold' : undefined, fontWeight: fontsLoaded ? undefined : '700' }}>{mode === 'institution' ? t('loginInstitution') : mode === 'staff' ? t('loginStaff') : t('loginStudent')}</Text>
        <Text style={{ marginTop: 7, marginBottom: 22, textAlign: 'center', fontSize: 12, color: '#68689c', fontFamily: fontsLoaded ? 'Inter_400Regular' : undefined }}>{mode === 'institution' ? t('loginSubInstitution') : mode === 'staff' ? t('loginSubStaff') : t('loginSubStudent')}</Text>
        <View style={{ marginBottom: 12 }}><Field login error={Boolean(error)} label={mode === 'institution' ? t('workEmail') : t('email')} value={email} onChangeText={setEmail} placeholder="name@institution.edu" keyboardType="email-address" icon="mail-outline" /></View>
        {adminChallenge ? (
          <View style={{ marginBottom: 12 }}><Field login error={Boolean(error)} label="Email verification code" value={adminCode} onChangeText={setAdminCode} placeholder="6-digit code" keyboardType="number-pad" icon="key-outline" /></View>
        ) : setupMode ? (
          <>
            {setupSent ? <View style={{ marginBottom: 12 }}><Field login error={Boolean(error)} label="Email verification code" value={setupCode} onChangeText={setSetupCode} placeholder="6-digit code" keyboardType="number-pad" icon="key-outline" /></View> : null}
            {setupSent ? <View style={{ marginBottom: 12 }}><Field login error={Boolean(error)} label="New admin password" value={newAdminPassword} onChangeText={setNewAdminPassword} placeholder="Create a strong password" secureTextEntry icon="lock-closed-outline" /></View> : null}
            {setupSent ? <View style={{ marginBottom: 12 }}><Field login error={Boolean(error)} label="Confirm new password" value={confirmAdminPassword} onChangeText={setConfirmAdminPassword} placeholder="Enter password again" secureTextEntry icon="lock-closed-outline" /></View> : null}
          </>
        ) : <View style={{ marginBottom: 12 }}><Field login error={Boolean(error)} label={t('password')} value={password} onChangeText={setPassword} placeholder={t('enterPassword')} secureTextEntry icon="lock-closed-outline" /></View>}
        {!adminChallenge && !setupMode ? <View className="mb-[32px] mt-0.5 flex-row items-center justify-between">
          <Pressable onPress={() => setRemember(!remember)} className="flex-row items-center">
            <Ionicons name={remember ? 'checkbox' : 'square-outline'} size={16} color="#6819d4" style={{ marginRight: 6 }} />
            <Text style={{ fontSize: 11, color: '#68689c', fontFamily: fontsLoaded ? 'Inter_500Medium' : undefined }}>{t('rememberMe')}</Text>
          </Pressable>
          <TextLink onPress={onForgot} color="#6318d1" style={{ fontSize: 13, fontWeight: undefined, fontFamily: fontsLoaded ? 'Inter_600SemiBold' : undefined }}>{t('forgotPassword')}</TextLink>
        </View> : null}
        {!adminChallenge && !setupMode && remember && Platform.OS !== 'web' ? <Pressable onPress={() => setUseBiometrics(!useBiometrics)} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
          <Ionicons name={useBiometrics ? 'checkbox' : 'square-outline'} size={16} color="#6819d4" style={{ marginRight: 6 }} />
          <Text style={{ fontSize: 11, color: '#68689c' }}>Unlock next time with device biometrics</Text>
        </Pressable> : null}
        <ErrorBanner message={error} />
        <PrimaryButton title={busy ? t('loggingIn') : adminChallenge ? 'Verify and sign in' : setupMode ? (setupSent ? 'Set admin password' : 'Send admin setup code') : t('loginButton')} onPress={busy ? undefined : adminChallenge ? submit : setupMode ? (setupSent ? completeAdminSetup : requestAdminSetup) : submit} />
        {!adminChallenge && !setupMode ? <TextLink onPress={() => { setSetupMode(true); setError('Enter the configured platform admin email to set its password.'); }} color="#6115d0" style={{ alignSelf: 'center', marginTop: 15 }}>First-time platform admin setup</TextLink> : null}
        {!adminChallenge && !setupMode ? <View style={{ marginTop: 25, alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: 14, color: '#68689c', fontFamily: fontsLoaded ? 'Inter_400Regular' : undefined }}>{t('noAccount')}</Text>
          <TextLink onPress={onRegister} color="#6115d0" style={{ fontSize: 14, fontFamily: fontsLoaded ? 'Inter_700Bold' : undefined, fontWeight: fontsLoaded ? undefined : '700' }}>{mode === 'institution' ? t('registerInstitution') : mode === 'staff' ? t('createStaffAccount') : t('createStudentAccount')}</TextLink>
        </View> : null}
      </KeyboardScreen>
    </SafeAreaView></Animated.View>
  );
}
