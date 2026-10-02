import { useLanguage } from '../i18n/LanguageContext';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScreenTransition } from '../components/Shared';
import ErrorBanner from '../components/ErrorBanner';
import { ActivityIndicator, BackHandler, StatusBar, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiRequest } from '../api';
import { ClearanceDetailScreen, ClearedScreen, CompletedScreen, IdCardScreen, RejectedScreen, RequirementScreen } from './screensFlow';
import { ClearedTabScreen, ClearancesScreen, HomeScreen, NotificationsScreen, ProfileScreen } from './screensMain';
import { BottomTabs, MUTED, PURPLE, SolidButton } from './ui';

export default function StudentApp({ session, onSignOut }) {
  const { t } = useLanguage();
  const token = session.token;
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [tab, setTab] = useState('home');
  const [stack, setStack] = useState([]);

  const reloadOverview = useCallback(async () => {
    try {
      setOverview(await apiRequest('/api/student/overview', undefined, token));
      setError('');
    } catch (cause) {
      setError(t(cause.message));
    }
  }, [token]);

  useEffect(() => { reloadOverview(); }, [version, reloadOverview]);

  const back = useCallback(() => setStack((current) => current.slice(0, -1)), []);
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length) { back(); return true; }
      if (tab !== 'home') { setTab('home'); return true; }
      return false;
    });
    return () => subscription.remove();
  }, [stack.length, tab, back]);

  const app = useMemo(() => {
    const go = (name, params = {}) => setStack((current) => [...current, { name, params }]);
    const replace = (name, params = {}) => setStack((current) => [...current.slice(0, -1), { name, params }]);
    return {
      token, overview, version, unread: overview?.unread || 0, go, replace, back, setTab: (next) => { setStack([]); setTab(next); },
      bump: () => setVersion((value) => value + 1), reload: reloadOverview, reloadOverview, signOut: onSignOut,
      openClearance: (clearance) => (clearance.status === 'completed' ? go('completed', { id: clearance.id }) : go('clearance', { id: clearance.id })),
      openRequirement: (clearance, requirement) => {
        const params = { clearanceId: clearance.id, requirementId: requirement.id };
        if (requirement.status === 'action_required') go('rejected', params);
        else if (requirement.status === 'cleared') go('cleared', params);
        // A document that has not been uploaded yet opens the file picker straight away.
        else go('requirement', { ...params, autoPick: requirement.kind === 'upload' && requirement.status === 'not_started' });
      },
    };
  }, [token, overview, version, back, reloadOverview, onSignOut]);

  if (!overview) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center', padding: 28 }}>
        <StatusBar barStyle="dark-content" backgroundColor="white" />
        {error ? (
          <>
            <View style={{ width: '100%' }}><ErrorBanner message={error} /></View>
            <View style={{ width: 200 }}><SolidButton title={t("Try Again")} onPress={reloadOverview} /></View>
            <View style={{ width: 200, marginTop: 10 }}><SolidButton variant="outline" title={t("Sign Out")} onPress={onSignOut} /></View>
          </>
        ) : <><ActivityIndicator color={PURPLE} /><Text style={{ marginTop: 10, color: MUTED }}>{t("Loading your clearances...")}</Text></>}
      </SafeAreaView>
    );
  }

  const top = stack.at(-1);
  const screens = { clearance: ClearanceDetailScreen, requirement: RequirementScreen, rejected: RejectedScreen, cleared: ClearedScreen, completed: CompletedScreen, idcard: IdCardScreen };
  const Flow = top && screens[top.name];
  const Tab = { home: HomeScreen, clearances: ClearancesScreen, cleared: ClearedTabScreen, notifications: NotificationsScreen, profile: ProfileScreen }[tab];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />
      {Flow ? <ScreenTransition key={`${top.name}-${stack.length}`}><Flow app={app} params={top.params} /></ScreenTransition> : (
        <View style={{ flex: 1 }}>
          <View style={{ flex: 1 }}><Tab app={app} /></View>
          <BottomTabs active={tab} onSelect={app.setTab} unread={app.unread} />
        </View>
      )}
    </SafeAreaView>
  );
}
