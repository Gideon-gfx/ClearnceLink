import BackArrow from '../components/BackArrow';
import TextLink from '../components/TextLink';
import { useRef, useState } from 'react';
import KeyboardScreen from '../components/KeyboardScreen';
import ErrorBanner from '../components/ErrorBanner';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Defs, Ellipse, Path, RadialGradient, Stop } from 'react-native-svg';
import { useFonts } from 'expo-font';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Animated, Easing, Image, Platform, Pressable, ScrollView, StatusBar, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Field, PrimaryButton } from '../components/Shared';
import { apiRequest } from '../api';

export function RoleLoginScreen({ mode, onBack, onRegister, onForgot, onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const backOffset = useRef(new Animated.Value(0)).current;
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  const { width, height } = useWindowDimensions();
  const role = mode === 'institution' ? 'Institution' : mode === 'staff' ? 'Staff' : 'Student';
  const portal = mode === 'institution' ? 'Institution Portal' : `${role} Portal`;
  const headerScale = Math.min(Math.max(width / 260, 1), 1.62);
  const logoScale = headerScale;
  const curveScale = headerScale;
  const panelTop = Math.max(height * 0.375, 194 * headerScale);
  const leftRise = 12 * curveScale;
  const waveHeight = 54 * curveScale;
  const goBackAnimated = () => Animated.timing(backOffset, { toValue: width, duration: 260, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start(({ finished }) => { if (finished) onBack(); });
  const submit = async () => {
    if (!email.trim() || !password) { setError('Enter your email and password.'); return; }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError('Enter a valid email address.'); return; }
    setError('');
    setBusy(true);
    try { const result = await apiRequest('/api/auth/login', { role: mode, email: email.trim(), password }); onLogin(result); }
    catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };
  return (
    <Animated.View style={{ flex: 1, backgroundColor: 'white', transform: [{ translateX: backOffset }] }}><SafeAreaView style={{ flex: 1, backgroundColor: 'white' }} edges={Platform.OS === 'android' ? ['left', 'right', 'bottom'] : undefined}>
      <StatusBar barStyle="light-content" backgroundColor="#5a17c9" />
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
        <BackArrow onPress={goBackAnimated} label="Go back to welcome" size={22} color="white" style={{ position: 'absolute', left: 18, top: 46, width: 40, height: 42, justifyContent: 'center' }} />
      </View>
      <Image
        source={require('../assets/campus-footer.png')}
        resizeMode="stretch"
        pointerEvents="none"
        accessibilityLabel="University campus building"
        style={{ position: 'absolute', left: 0, bottom: 0, width, height: 155 * headerScale, opacity: 0.78 }}
      />
      <KeyboardScreen style={{ marginTop: -36 * headerScale, zIndex: 1 }} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 25, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
        <Text style={{ marginTop: 2, textAlign: 'center', fontSize: 22, color: '#171548', fontFamily: fontsLoaded ? 'Inter_700Bold' : undefined, fontWeight: fontsLoaded ? undefined : '700' }}>{role} Login</Text>
        <Text style={{ marginTop: 7, marginBottom: 22, textAlign: 'center', fontSize: 12, color: '#68689c', fontFamily: fontsLoaded ? 'Inter_400Regular' : undefined }}>{mode === 'institution' ? 'Access your institution dashboard.' : `Access your ${role.toLowerCase()} account.`}</Text>
        <View style={{ marginBottom: 12 }}><Field login error={Boolean(error)} label={mode === 'institution' ? 'Work Email' : 'Email'} value={email} onChangeText={setEmail} placeholder="name@institution.edu" keyboardType="email-address" icon="mail-outline" /></View>
        <View style={{ marginBottom: 12 }}><Field login error={Boolean(error)} label="Password" value={password} onChangeText={setPassword} placeholder="Enter your password" secureTextEntry icon="lock-closed-outline" /></View>
        <View className="mb-[32px] mt-0.5 flex-row items-center justify-between">
          <Pressable onPress={() => setRemember(!remember)} className="flex-row items-center">
            <Ionicons name={remember ? 'checkbox' : 'square-outline'} size={16} color="#6819d4" style={{ marginRight: 6 }} />
            <Text style={{ fontSize: 11, color: '#68689c', fontFamily: fontsLoaded ? 'Inter_500Medium' : undefined }}>Remember me</Text>
          </Pressable>
          <TextLink onPress={onForgot} color="#6318d1" style={{ fontSize: 13, fontWeight: undefined, fontFamily: fontsLoaded ? 'Inter_600SemiBold' : undefined }}>Forgot password?</TextLink>
        </View>
        <ErrorBanner message={error} />
        <PrimaryButton title={busy ? 'Logging in...' : 'Login'} onPress={busy ? undefined : submit} />
        <View style={{ marginTop: 25, alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: 14, color: '#68689c', fontFamily: fontsLoaded ? 'Inter_400Regular' : undefined }}>Don’t have an account?</Text>
          <TextLink onPress={onRegister} color="#6115d0" style={{ fontSize: 14, fontFamily: fontsLoaded ? 'Inter_700Bold' : undefined, fontWeight: fontsLoaded ? undefined : '700' }}>{mode === 'institution' ? 'Register your institution' : `Create ${role.toLowerCase()} account`}</TextLink>
        </View>
      </KeyboardScreen>
    </SafeAreaView></Animated.View>
  );
}

