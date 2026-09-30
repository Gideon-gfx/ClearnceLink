import { useEffect, useRef, useState } from 'react';
import KeyboardScreen from '../components/KeyboardScreen';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, ScrollView, StatusBar, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiRequest } from '../api';
import { Field, PrimaryButton } from '../components/Shared';
import { ErrorText, INK, MUTED, PURPLE } from '../student/ui';

export const CODE_LIFETIME = 300; // seconds; matches the server (5 minutes)
export const clock = (total) => `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
const RULES = [
  ['At least 8 characters', (value) => value.length >= 8],
  ['One uppercase letter', (value) => /[A-Z]/.test(value)],
  ['One number', (value) => /\d/.test(value)],
  ['One special character', (value) => /[^A-Za-z0-9]/.test(value)],
];

export function Shell({ onBack, children }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />
      {onBack ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={onBack} style={{ marginTop: 16, marginLeft: 16, width: 44, height: 44, justifyContent: 'center' }}>
          <Ionicons name="chevron-back" size={26} color={INK} />
        </Pressable>
      ) : null}
      <KeyboardScreen contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: onBack ? 44 : 0, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">{children}</KeyboardScreen>
    </SafeAreaView>
  );
}

export const Title = ({ children }) => <Text style={{ textAlign: 'center', fontSize: 22, fontWeight: '700', color: INK }}>{children}</Text>;
export const Subtitle = ({ children }) => <Text style={{ textAlign: 'center', fontSize: 14, lineHeight: 21, color: MUTED, marginTop: 8, marginBottom: 26 }}>{children}</Text>;

export function CodeBoxes({ value, onChange }) {
  const input = useRef(null);
  return (
    <Pressable onPress={() => input.current?.focus()} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {Array.from({ length: 6 }, (_, index) => {
        const focused = index === Math.min(value.length, 5);
        return (
          <View key={index} style={{ width: 46, height: 56, borderRadius: 12, borderWidth: focused ? 2 : 1, borderColor: focused ? PURPLE : '#dedaf3', alignItems: 'center', justifyContent: 'center', backgroundColor: 'white' }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: INK }}>{value[index] || ''}</Text>
          </View>
        );
      })}
      <TextInput ref={input} accessibilityLabel="6-digit code" value={value} onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" autoFocus maxLength={6} style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%' }} />
    </Pressable>
  );
}

const CONFIG = {
  student: { title: 'Student Access', subtitle: 'Enter your Clearance ID to get started.', label: 'Clearance ID', placeholder: 'UNIX-26-K7M4Q9', icon: 'key-outline', key: 'clearanceId', helpTitle: 'Don’t have a Clearance ID?', help: 'Contact your institution.', doneText: 'Welcome to ClearanceLink.\nYou can now login with your\npassword.', doneButton: 'Continue to Login', otpSubtitle: 'We’ve sent a 6-digit code to' },
  staff: { title: 'Staff Access', subtitle: 'Enter your Staff Access ID\nprovided by your institution.', label: 'Staff Access ID', placeholder: 'UNIX-STF-P7N3X1', icon: 'person-outline', key: 'accessId', helpTitle: 'Need help?', help: 'Contact your institution administrator', doneText: 'Welcome to ClearanceLink.\nYou can now access your assigned\nclearance roles.', doneButton: 'Go to Dashboard', otpSubtitle: 'Enter the 6-digit code sent to' },
};

export default function ActivationFlow({ role = 'student', onBack, onDone }) {
  const cfg = CONFIG[role];
  const [result, setResult] = useState(null);
  const [step, setStep] = useState('access');
  const [clearanceId, setClearanceId] = useState('');
  const [contact, setContact] = useState({ masked: '' });
  const [code, setCode] = useState('');
  const [activationToken, setActivationToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (seconds <= 0) return undefined;
    const timer = setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  const guard = async (task) => {
    setBusy(true); setError('');
    try { await task(); } catch (cause) { setError(cause.message); } finally { setBusy(false); }
  };
  const id = clearanceId.trim().toUpperCase();
  const requestCode = () => guard(async () => {
    if (!id) throw new Error('Enter your Clearance ID.');
    const result = await apiRequest(`/api/${role}/access`, { [cfg.key]: id });
    setContact({ masked: result.maskedContact });
    setCode('');
    setSeconds(CODE_LIFETIME);
    setStep('otp');
  });
  const verify = () => guard(async () => {
    if (code.length !== 6) throw new Error('Enter the 6-digit code.');
    const result = await apiRequest(`/api/${role}/verify`, { [cfg.key]: id, code });
    setActivationToken(result.activationToken);
    setStep('password');
  });
  const activate = () => guard(async () => {
    if (RULES.some(([, test]) => !test(password))) throw new Error('Your password does not meet all the requirements.');
    if (password !== confirm) throw new Error('Passwords do not match.');
    setResult(await apiRequest(`/api/${role}/activate`, { [cfg.key]: id, activationToken, password }));
    setStep('done');
  });
  const back = () => {
    setError('');
    if (step === 'otp') setStep('access');
    else if (step === 'password') setStep('otp');
    else onBack();
  };

  if (step === 'access') {
    return (
      <Shell onBack={back}>
        <View style={{ paddingTop: 30 }}>
          <Title>{cfg.title}</Title>
          <Subtitle>{cfg.subtitle}</Subtitle>
          <View style={{ height: 54, flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: error ? 2 : 1, borderColor: error ? '#ef4444' : '#dedaf3', backgroundColor: error ? '#fffafa' : 'white', paddingHorizontal: 14, marginBottom: 16 }}>
            <Ionicons name={cfg.icon} size={20} color={PURPLE} style={{ marginRight: 12 }} />
            <TextInput accessibilityLabel={cfg.label} value={clearanceId} onChangeText={setClearanceId} placeholder={cfg.placeholder} placeholderTextColor="#a4a1bc" autoCapitalize="characters" autoCorrect={false} onSubmitEditing={requestCode} style={{ flex: 1, padding: 0, fontSize: 16, color: INK }} />
          </View>
          <ErrorText>{error}</ErrorText>
          <PrimaryButton title={busy ? 'Checking...' : 'Continue'} onPress={busy ? undefined : requestCode} />
          <Text style={{ marginTop: 30, textAlign: 'center', fontSize: 13, color: INK }}>{cfg.helpTitle}</Text>
          <Text style={{ marginTop: 4, textAlign: 'center', fontSize: 13, color: MUTED }}>{cfg.help}</Text>
        </View>
      </Shell>
    );
  }
  if (step === 'otp') {
    return (
      <Shell onBack={back}>
        <Title>Verify Your Identity</Title>
        <Subtitle>{`We’ve sent a 6-digit code to\n${contact.masked}`}</Subtitle>
        <CodeBoxes value={code} onChange={setCode} />
        <Text style={{ marginTop: 18, textAlign: 'center', fontSize: 13, color: MUTED }}>
          {seconds > 0 ? <>Code expires in <Text style={{ color: PURPLE, fontWeight: '700' }}>{clock(seconds)}</Text></> : 'This code has expired. Request a new one.'}
        </Text>
        <View style={{ height: 22 }} />
        <ErrorText>{error}</ErrorText>
        <PrimaryButton title={busy ? 'Verifying...' : 'Verify'} onPress={busy ? undefined : verify} />
        <View style={{ marginTop: 24, flexDirection: 'row', justifyContent: 'center' }}>
          <Text style={{ fontSize: 13, color: MUTED }}>Didn’t receive the code? </Text>
          <Pressable disabled={seconds > 0 || busy} onPress={requestCode}><Text style={{ fontSize: 13, fontWeight: '700', color: seconds > 0 ? '#b9a5e8' : PURPLE }}>Resend</Text></Pressable>
        </View>
      </Shell>
    );
  }
  if (step === 'password') {
    return (
      <Shell onBack={back}>
        <Title>Create Password</Title>
        <Subtitle>Set a password to secure your account.</Subtitle>
        <Field error={Boolean(error) && password.length > 0 && RULES.some(([, test]) => !test(password))} label="Create password" value={password} onChangeText={setPassword} placeholder="Create password" secureTextEntry icon="lock-closed-outline" />
        <Field error={Boolean(error) && confirm !== password} label="Confirm password" value={confirm} onChangeText={setConfirm} placeholder="Confirm password" secureTextEntry icon="lock-closed-outline" />
        <View style={{ marginTop: 6, marginBottom: 22, gap: 10 }}>
          {RULES.map(([label, test]) => {
            const ok = test(password);
            return (
              <View key={label} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name={ok ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={ok ? '#16a34a' : '#c4c1d8'} style={{ marginRight: 10 }} />
                <Text style={{ fontSize: 14, color: INK }}>{label}</Text>
              </View>
            );
          })}
        </View>
        <ErrorText>{error}</ErrorText>
        <PrimaryButton title={busy ? 'Creating...' : 'Create Account'} onPress={busy ? undefined : activate} />
      </Shell>
    );
  }
  return (
    <Shell>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <View style={{ width: 130, height: 130, borderRadius: 65, backgroundColor: '#ede9fe', alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: PURPLE, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="checkmark" size={48} color="white" />
            </View>
          </View>
        </View>
        <Title>Account Activated!</Title>
        <Text style={{ textAlign: 'center', fontSize: 15, lineHeight: 23, color: MUTED, marginTop: 10, marginBottom: 34 }}>{`Welcome to ClearanceLink.\nYou can now login with your\npassword.`}</Text>
        <PrimaryButton title={cfg.doneButton} onPress={() => onDone(result)} />
      </View>
    </Shell>
  );
}
