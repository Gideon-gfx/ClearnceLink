import { useLanguage } from '../i18n/LanguageContext';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScreenTransition } from '../components/Shared';
import ErrorBanner from '../components/ErrorBanner';
import { ActivityIndicator, BackHandler, StatusBar, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiRequest } from '../api';
import { BottomTabs, MUTED, PURPLE, SolidButton } from './ui';
import { AddMyStudentScreen, CreateClearanceScreen, DocumentsScreen, ImportMyResultsScreen, ImportMyStudentsScreen, RejectScreen, StudentDetailsScreen, TakeActionScreen, ViewDocumentScreen } from './flow';
import { ClearancesScreen, HomeScreen, NotificationsScreen, ProfileScreen, StudentsScreen } from './screens';

const TABS = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'students', label: 'Students', icon: 'people' },
  { key: 'clearances', label: 'Clearances', icon: 'shield-checkmark' },
  { key: 'profile', label: 'Profile', icon: 'person' },
];
const SCREENS = { student: StudentDetailsScreen, documents: DocumentsScreen, view: ViewDocumentScreen, action: TakeActionScreen, reject: RejectScreen, 'create-clearance': CreateClearanceScreen, 'add-student': AddMyStudentScreen, 'import-students': ImportMyStudentsScreen, 'import-results': ImportMyResultsScreen };
const TAB_SCREENS = { home: HomeScreen, students: StudentsScreen, clearances: ClearancesScreen, notifications: NotificationsScreen, profile: ProfileScreen };

export default function StaffApp({ session, onSignOut }) {
  const { t } = useLanguage();
  const token = session.token;
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [tab, setTab] = useState('home');
  const [filter, setFilter] = useState(null);
  const [stack, setStack] = useState([]);

  const reload = useCallback(async () => {
    try { setOverview(await apiRequest('/api/staff/overview', undefined, token)); setError(''); }
    catch (cause) { setError(t(cause.message)); }
  }, [token]);
  useEffect(() => { reload(); }, [version, reload]);

  const back = useCallback(() => setStack((current) => current.slice(0, -1)), []);
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length) { back(); return true; }
      if (tab !== 'home') { setTab('home'); return true; }
      return false;
    });
    return () => subscription.remove();
  }, [stack.length, tab, back]);

  const app = useMemo(() => ({
    token, overview, version, reload, back, signOut: onSignOut,
    go: (name, params = {}) => setStack((current) => [...current, { name, params }]),
    backTo: (name) => setStack((current) => { const at = current.map((item) => item.name).lastIndexOf(name); return at < 0 ? [] : current.slice(0, at + 1); }),
    filter,
    setTab: (next, nextFilter = null) => { setStack([]); setFilter(nextFilter); setTab(next); },
    bump: () => setVersion((value) => value + 1),
  }), [token, overview, version, reload, back, onSignOut, filter]);

  if (!overview) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center', padding: 28 }}>
        <StatusBar barStyle="dark-content" backgroundColor="white" />
        {error ? (
          <>
            <View style={{ width: '100%' }}><ErrorBanner message={error} /></View>
            <View style={{ width: 200 }}><SolidButton title={t("Try Again")} onPress={reload} /></View>
            <View style={{ width: 200, marginTop: 10 }}><SolidButton variant="outline" title={t("Sign Out")} onPress={onSignOut} /></View>
          </>
        ) : <><ActivityIndicator color={PURPLE} /><Text style={{ marginTop: 10, color: MUTED }}>{t("Loading your dashboard...")}</Text></>}
      </SafeAreaView>
    );
  }

  const top = stack.at(-1);
  const Flow = top && SCREENS[top.name];
  const Tab = TAB_SCREENS[tab];
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />
      {Flow ? <ScreenTransition key={`${top.name}-${stack.length}`}><Flow app={app} params={top.params} /></ScreenTransition> : (
        <View style={{ flex: 1 }}>
          <View style={{ flex: 1 }}><Tab app={app} /></View>
          <BottomTabs tabs={TABS} active={tab} onSelect={app.setTab} unread={overview.unread} />
        </View>
      )}
    </SafeAreaView>
  );
}
