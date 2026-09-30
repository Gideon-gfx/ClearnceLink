import { useEffect, useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Animated, Easing, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { apiRequest } from '../api';
import { Field, PasswordChecklist, PrimaryButton, passwordIsStrong } from '../components/Shared';
import { ErrorText, INK, MUTED, PURPLE } from '../student/ui';
import { CODE_LIFETIME, CodeBoxes, Shell, Subtitle, Title, clock } from './ActivationFlow';

const RESEND_AFTER = 30; // seconds before another code can be requested (matches the server)

// Password reset in three steps: 1) enter your email, 2) enter the 6-digit code we email you, 3) choose a new password.
export default function ForgotPasswordScreen({ mode, initialEmail = '', onBack, onComplete }) {
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState(initialEmail);
  const [masked, setMasked] = useState('');
  const [code, setCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [expiresIn, setExpiresIn] = useState(0);
  const [resendIn, setResendIn] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { width } = useWindowDimensions();
  const backOffset = useRef(new Animated.Value(0)).current;
  const leave = (done) => Animated.timing(backOffset, { toValue: width, duration: 260, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start(({ finished }) => { if (finished) done(); });

  useEffect(() => {
    if (expiresIn <= 0 && resendIn <= 0) return undefined;
    const timer = setTimeout(() => { setExpiresIn((value) => Math.max(0, value - 1)); setResendIn((value) => Math.max(0, value - 1)); }, 1000);
    return () => clearTimeout(timer);
  }, [expiresIn, resendIn]);

  const guard = async (task) => {
    setBusy(true); setError('');
    try { await task(); } catch (cause) { setError(cause.message); } finally { setBusy(false); }
  };
  const address = email.trim();
  const roleLabel = mode === 'institution' ? 'institution' : mode;

  const sendCode = () => guard(async () => {
    if (!/^\S+@\S+\.\S+$/.test(address)) throw new Error('Enter a valid email address.');
    const result = await apiRequest('/api/auth/password/forgot', { role: mode, email: address });
    setMasked(result.maskedContact || address);
    setCode('');
    setExpiresIn(CODE_LIFETIME);
    setResendIn(RESEND_AFTER);
    setStep('code');
  });
  const verifyCode = () => guard(async () => {
    if (code.length !== 6) throw new Error('Enter the 6-digit code.');
    const result = await apiRequest('/api/auth/password/verify', { role: mode, email: address, code });
    setResetToken(result.resetToken);
    setStep('password');
  });
  const resetPassword = () => guard(async () => {
    if (!passwordIsStrong(password)) throw new Error('Your password does not meet all the requirements.');
    if (password !== confirm) throw new Error('Passwords do not match.');
    await apiRequest('/api/auth/password/reset', { role: mode, email: address, resetToken, password });
    setStep('done');
  });
  const back = () => {
    setError('');
    if (step === 'code') setStep('email');
    else if (step === 'password') { setStep('email'); setPassword(''); setConfirm(''); setResetToken(''); }
    else leave(onBack);
  };

  const body = (() => {
    if (step === 'email') {
      return (
        <View style={{ paddingTop: 6 }}>
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: '#ede9fe', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="lock-closed" size={40} color={PURPLE} />
            </View>
          </View>
          <Title>Forgot Password?</Title>
          <Subtitle>{`Enter the email linked to your ${roleLabel} account and we’ll send you a 6-digit code to reset your password.`}</Subtitle>
          <Field login error={Boolean(error)} label="Email" value={email} onChangeText={setEmail} placeholder="name@institution.edu" keyboardType="email-address" icon="mail-outline" />
          <View style={{ height: 8 }} />
          <ErrorText>{error}</ErrorText>
          <PrimaryButton title={busy ? 'Sending...' : 'Send Code'} onPress={busy ? undefined : sendCode} />
          <Pressable accessibilityRole="button" onPress={() => leave(onBack)} style={{ marginTop: 22, alignItems: 'center', padding: 8 }}>
            <Text style={{ fontSize: 14, color: MUTED }}>Remembered it? <Text style={{ color: PURPLE, fontWeight: '700' }}>Back to login</Text></Text>
          </Pressable>
        </View>
      );
    }
    if (step === 'code') {
      return (
        <>
          <Title>Check Your Email</Title>
          <Subtitle>{`We’ve sent a 6-digit code to\n${masked}`}</Subtitle>
          <CodeBoxes value={code} onChange={setCode} />
          <Text style={{ marginTop: 18, textAlign: 'center', fontSize: 13, color: MUTED }}>
            {expiresIn > 0 ? <>Code expires in <Text style={{ color: PURPLE, fontWeight: '700' }}>{clock(expiresIn)}</Text></> : 'This code has expired. Request a new one below.'}
          </Text>
          <View style={{ height: 22 }} />
          <ErrorText>{error}</ErrorText>
          <PrimaryButton title={busy ? 'Verifying...' : 'Verify Code'} onPress={busy ? undefined : verifyCode} />
          <View style={{ marginTop: 24, flexDirection: 'row', justifyContent: 'center' }}>
            <Text style={{ fontSize: 13, color: MUTED }}>Didn’t receive the code? </Text>
            <Pressable disabled={resendIn > 0 || busy} onPress={sendCode}><Text style={{ fontSize: 13, fontWeight: '700', color: resendIn > 0 ? '#b9a5e8' : PURPLE }}>{resendIn > 0 ? `Resend in 0:${String(resendIn).padStart(2, '0')}` : 'Resend'}</Text></Pressable>
          </View>
          <Text style={{ marginTop: 14, textAlign: 'center', fontSize: 12, color: MUTED }}>Check your spam folder if it doesn’t arrive within a minute.</Text>
        </>
      );
    }
    if (step === 'password') {
      return (
        <>
          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            <View style={{ width: 70, height: 70, borderRadius: 35, backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="shield-checkmark" size={34} color="#16a34a" />
            </View>
          </View>
          <Title>Create New Password</Title>
          <Subtitle>Your code is verified. Choose a strong password you haven’t used before.</Subtitle>
          <Field error={Boolean(error) && !passwordIsStrong(password)} label="New password" value={password} onChangeText={setPassword} placeholder="Create new password" secureTextEntry icon="lock-closed-outline" />
          <Field error={Boolean(error) && confirm !== password} label="Confirm password" value={confirm} onChangeText={setConfirm} placeholder="Confirm new password" secureTextEntry icon="lock-closed-outline" />
          {password ? <PasswordChecklist password={password} /> : null}
          <ErrorText>{error}</ErrorText>
          <View style={{ marginTop: 10 }}><PrimaryButton title={busy ? 'Saving...' : 'Reset Password'} onPress={busy ? undefined : resetPassword} /></View>
        </>
      );
    }
    return (
      <View style={{ flex: 1, justifyContent: 'center', paddingTop: 30 }}>
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <View style={{ width: 130, height: 130, borderRadius: 65, backgroundColor: '#ede9fe', alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: PURPLE, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="checkmark" size={48} color="white" />
            </View>
          </View>
        </View>
        <Title>Password Reset!</Title>
        <Text style={{ textAlign: 'center', fontSize: 15, lineHeight: 23, color: MUTED, marginTop: 10, marginBottom: 34 }}>{'Your password has been updated.\nLog in with your new password.'}</Text>
        <PrimaryButton title="Back to Login" onPress={onComplete} />
      </View>
    );
  })();

  return (
    <Animated.View style={{ flex: 1, backgroundColor: 'white', transform: [{ translateX: backOffset }] }}>
      <Shell onBack={step === 'done' ? undefined : back}>{body}</Shell>
    </Animated.View>
  );
}
