import './global.css';
import { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ScreenTransition } from './src/components/Shared';
import WelcomeScreen from './src/screens/welcomeScreen';
import StudentLogin from './src/screens/studentLogin';
import StaffLogin from './src/screens/staffLogin';
import InstitutionLogin from './src/screens/institutionLogin';
import StudentAccess from './src/screens/studentAccess';
import StaffAccess from './src/screens/staffAccess';
import InstitutionRegistrationScreen from './src/screens/institutionRegistration';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import AccountHomeScreen from './src/screens/AccountHomeScreen';
import StudentApp from './src/student/StudentApp';
import StaffApp from './src/staff/StaffApp';
import InstitutionApp from './src/institution/InstitutionApp';
import PendingVerificationScreen from './src/institution/pendingVerificationScreen';
import { BugReportProvider, useBugReport } from './src/components/BugReportShake';
import { apiRequest } from './src/api';
import { clearRememberedSession, loadRememberedToken } from './src/components/rememberedSession';
import { unregisterPushNotifications, usePushNotifications } from './src/components/pushNotifications';

export default function App() {
  return <SafeAreaProvider><BugReportProvider><AppScreens /></BugReportProvider></SafeAreaProvider>;
}

function AppScreens() {
  const [screen, setScreen] = useState('welcome');
  const [session, setSession] = useState(null);
  const [restoring, setRestoring] = useState(true);
  // "Remember me": if a session was kept, check it is still valid and go straight to the dashboard.
  useEffect(() => {
    let live = true;
    (async () => {
      const token = await loadRememberedToken();
      if (!token) { if (live) setRestoring(false); return; }
      try {
        const result = await apiRequest('/api/auth/me', undefined, token);
        if (live && result?.user) { setSession({ token, user: result.user }); setScreen('account-home'); }
      } catch (cause) {
        // Only forget it when the server says it has expired; if the server is just unreachable, keep it for next time.
        if (/expired|sign in|log in/i.test(String(cause?.message || ''))) await clearRememberedSession();
      } finally { if (live) setRestoring(false); }
    })();
    return () => { live = false; };
  }, []);
  const signOut = () => { void unregisterPushNotifications(session?.token); clearRememberedSession(); setSession(null); setScreen('welcome'); };
  usePushNotifications(session);
  const { setLocation } = useBugReport();
  useEffect(() => { setLocation({ screen, role: session?.user?.role || 'guest', token: session?.token || null }); }, [screen, session, setLocation]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen === 'welcome') return true;
      if (screen === 'account-home' && ['student', 'staff', 'institution'].includes(session?.user?.role)) return false;
      if (screen.endsWith('-forgot')) setScreen(`${screen.replace('-forgot', '')}-login`);
      else if (screen.endsWith('-access')) setScreen(`${screen.replace('-access', '')}-login`);
      else if (screen.endsWith('-login') || screen === 'account-home') setScreen('welcome');
      else return false;
      return true;
    });
    return () => subscription.remove();
  }, [screen, session]);

  if (restoring) return <View style={{ flex: 1, backgroundColor: '#5a17c9', alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color="white" size="large" /></View>;
  if (screen === 'welcome') return <ScreenTransition key={screen}><WelcomeScreen onSelectMode={(mode) => setScreen(`${mode}-login`)} /></ScreenTransition>;
  if (screen === 'student-access') return <ScreenTransition key={screen}><StudentAccess onBack={() => setScreen('student-login')} onDone={() => setScreen('student-login')} /></ScreenTransition>;
  if (screen === 'staff-access') return <ScreenTransition key={screen}><StaffAccess onBack={() => setScreen('staff-login')} onDone={(result) => { setSession(result); setScreen('account-home'); }} /></ScreenTransition>;
  if (screen.endsWith('-login')) {
    const mode = screen.replace('-login', '');
    const Login = mode === 'institution' ? InstitutionLogin : mode === 'staff' ? StaffLogin : StudentLogin;
    return <ScreenTransition key={screen}><Login
      onBack={() => setScreen('welcome')}
      onForgot={() => setScreen(`${mode}-forgot`)}
      onLogin={(result) => { setSession(result); setScreen('account-home'); }}
      onRegister={() => setScreen(mode === 'institution' ? 'institution-register' : `${mode}-access`)}
    /></ScreenTransition>;
  }
  if (screen.endsWith('-forgot')) {
    const mode = screen.replace('-forgot', '');
    return <ScreenTransition key={screen}><ForgotPasswordScreen mode={mode} onBack={() => setScreen(`${mode}-login`)} onComplete={() => setScreen(`${mode}-login`)} /></ScreenTransition>;
  }
  if (screen === 'institution-register') return <InstitutionRegistrationScreen onExit={() => setScreen('institution-login')} onPaid={() => setScreen('institution-login')} />;
  if (screen === 'account-home' && session?.user?.role === 'student') return <StudentApp session={session} onSignOut={signOut} />;
  if (screen === 'account-home' && session?.user?.role === 'staff') return <StaffApp session={session} onSignOut={signOut} />;
  if (screen === 'account-home' && session?.user?.role === 'institution' && (session.user.status !== 'verified' || session.user.expired)) return <PendingVerificationScreen session={session} onPaid={(user) => setSession({ ...session, user })} onSignOut={() => { clearRememberedSession(); setSession(null); setScreen('institution-login'); }} />;
  if (screen === 'account-home' && session?.user?.role === 'institution') return <InstitutionApp session={session} onSessionChange={(user) => setSession({ ...session, user })} onSignOut={signOut} />;
  if (screen === 'account-home') return <ScreenTransition key={screen}><AccountHomeScreen user={session?.user} onSignOut={signOut} /></ScreenTransition>;
  return null;
}
