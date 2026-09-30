import './global.css';
import { useEffect, useState } from 'react';
import { BackHandler } from 'react-native';
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

export default function App() {
  return <SafeAreaProvider><AppScreens /></SafeAreaProvider>;
}

function AppScreens() {
  const [screen, setScreen] = useState('welcome');
  const [session, setSession] = useState(null);

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
  if (screen === 'account-home' && session?.user?.role === 'student') return <StudentApp session={session} onSignOut={() => { setSession(null); setScreen('welcome'); }} />;
  if (screen === 'account-home' && session?.user?.role === 'staff') return <StaffApp session={session} onSignOut={() => { setSession(null); setScreen('welcome'); }} />;
  if (screen === 'account-home' && session?.user?.role === 'institution' && (session.user.status !== 'verified' || session.user.expired)) return <PendingVerificationScreen session={session} onPaid={(user) => setSession({ ...session, user })} onSignOut={() => { setSession(null); setScreen('institution-login'); }} />;
  if (screen === 'account-home' && session?.user?.role === 'institution') return <InstitutionApp session={session} onSessionChange={(user) => setSession({ ...session, user })} onSignOut={() => { setSession(null); setScreen('welcome'); }} />;
  if (screen === 'account-home') return <ScreenTransition key={screen}><AccountHomeScreen user={session?.user} onSignOut={() => { setSession(null); setScreen('welcome'); }} /></ScreenTransition>;
  return null;
}
