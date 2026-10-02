import { useLanguage } from '../i18n/LanguageContext';
import { useEffect, useMemo, useState } from 'react';
import { BackHandler, StatusBar, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { institutionApi } from './api';
import { apiBaseUrl } from '../api';
import { BottomNav, BrandHeader } from './ui';
import { ScreenTransition } from '../components/Shared';
import HomeScreen from './homeScreen';
import StudentsScreen from './studentsScreen';
import StaffScreen from './staffScreen';
import OversightScreen from './oversightScreen';
import MoreScreen from './moreScreen';
import AddStudentScreen from './addStudentScreen';
import AddStaffScreen from './addStaffScreen';
import ImportStudentsScreen from './importStudentsScreen';
import ImportStaffScreen from './importStaffScreen';
import ImportResultsScreen from './importResultsScreen';
import ReviewStudentIdsScreen from './reviewStudentIdsScreen';
import ReviewStaffIdsScreen from './reviewStaffIdsScreen';
import StudentDetailScreen from './studentDetailScreen';
import StaffDetailScreen from './staffDetailScreen';
import AssignRoleScreen from './assignRoleScreen';
import SettingsScreen from './settingsScreen';
import StampScreen from './stampScreen';
import PlansScreen from './plansScreen';
import AssignedRolesScreen from './assignedRolesScreen';
import CompletionScreen from './completionScreen';
import ActivityScreen from './activityScreen';

const mainTabs = ['home', 'students', 'staff', 'oversight', 'more'];
export default function InstitutionApp({ session, onSignOut, onSessionChange = (user) => {} }) {
  const { t } = useLanguage();
  const api = useMemo(() => institutionApi(session.token), [session.token]);
  const [stack, setStack] = useState([{ screen: 'home', params: {} }]);
  const [logoVersion, setLogoVersion] = useState(0);
  const [hasLogo, setHasLogo] = useState(Boolean(session.user.hasLogo));
  const logoUrl = hasLogo ? `${apiBaseUrl}/api/institution/logo?v=${logoVersion}` : null;
  const [unread, setUnread] = useState(0);
  const current = stack[stack.length - 1];
  // Refresh the bell's count whenever the admin moves between screens.
  useEffect(() => { api.request('/notifications').then((result) => setUnread(result.unread || 0)).catch(() => {}); }, [api, stack.length, current.screen]);
  const go = (screen, params = {}) => setStack((items) => [...items, { screen, params }]);
  const back = () => setStack((items) => items.length > 1 ? items.slice(0, -1) : items);
  const tab = (screen, params = {}) => setStack([{ screen, params }]);
  useEffect(() => { const subscription = BackHandler.addEventListener('hardwareBackPress', () => { if (stack.length > 1) { back(); return true; } return false; }); return () => subscription.remove(); }, [stack.length]);
  let body;
  switch (current.screen) {
    case 'home': body = <HomeScreen api={api} user={session.user} onNavigate={go} onTab={tab} />; break;
    case 'students': body = <StudentsScreen api={api} initialFilter={current.params.filter} onNavigate={go} onBack={() => tab('home')} />; break;
    case 'staff': body = <StaffScreen api={api} onNavigate={go} onBack={() => tab('home')} />; break;
    case 'oversight': body = <OversightScreen api={api} onBack={() => tab('home')} />; break;
    case 'more': body = <MoreScreen user={session.user} token={session.token} logoUrl={logoUrl} onLogoChanged={() => { setHasLogo(true); setLogoVersion((value) => value + 1); }} onNavigate={go} onSignOut={onSignOut} onBack={() => tab('home')} />; break;
    case 'add-student': body = <AddStudentScreen api={api} onBack={back} onSaved={(item) => go('student-detail', { id: item.id })} />; break;
    case 'add-staff': body = <AddStaffScreen api={api} onBack={back} onSaved={(item) => go('staff-detail', { id: item.id })} />; break;
    case 'import-students': body = <ImportStudentsScreen api={api} onBack={back} onManual={() => go('add-student')} onValidated={(batch) => go('import-results', { batch })} />; break;
    case 'import-staff': body = <ImportStaffScreen api={api} onBack={back} onManual={() => go('add-staff')} onValidated={(batch) => go('import-results', { batch })} />; break;
    case 'import-results': body = <ImportResultsScreen api={api} batch={current.params.batch} onBack={back} onCommitted={(result) => go(current.params.batch.kind === 'students' ? 'review-student-ids' : 'review-staff-ids', { autoDeliveryQueued: result.autoDeliveryQueued || 0 })} />; break;
    case 'review-student-ids': body = <ReviewStudentIdsScreen api={api} autoDeliveryQueued={current.params.autoDeliveryQueued} onBack={back} onOpen={(id) => go('student-detail', { id })} />; break;
    case 'review-staff-ids': body = <ReviewStaffIdsScreen api={api} onBack={back} onOpen={(id) => go('staff-detail', { id })} />; break;
    case 'student-detail': body = <StudentDetailScreen api={api} id={current.params.id} onBack={back} />; break;
    case 'staff-detail': body = <StaffDetailScreen api={api} id={current.params.id} onBack={back} onAssignRole={(staffId) => go('assign-role', { staffId })} />; break;
    case 'assigned-roles': body = <AssignedRolesScreen api={api} onBack={back} onOpen={(id) => go('staff-detail', { id })} onAssign={() => go('assign-role')} />; break;
    case 'assign-role': body = <AssignRoleScreen api={api} staffId={current.params.staffId} onBack={back} onSaved={(id) => go('staff-detail', { id })} />; break;
    case 'plans': body = <PlansScreen user={session.user} token={session.token} onChanged={onSessionChange} onBack={back} />; break;
    case 'settings': body = <SettingsScreen api={api} onBack={back} />; break;
    case 'stamp': body = <StampScreen token={session.token} onBack={back} />; break;
    case 'completion': body = <CompletionScreen api={api} onBack={back} />; break;
    case 'activity': body = <ActivityScreen api={api} onBack={back} onSeen={() => setUnread(0)} />; break;
    default: body = <HomeScreen api={api} user={session.user} onNavigate={go} onTab={tab} />;
  }
  const animated = <ScreenTransition key={`${current.screen}-${stack.length}`}>{body}</ScreenTransition>;
  if (!mainTabs.includes(current.screen)) return animated;
  const ownHeader = ['students', 'staff', 'oversight', 'more'].includes(current.screen); // these screens show their own title bar
  return <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}><StatusBar barStyle="dark-content" backgroundColor="white" />{ownHeader ? null : <BrandHeader name={session.user.institutionName} subtitle={t('administrator')} logoUrl={logoUrl} token={session.token} unread={unread} onNotify={() => go('activity')} />}<View style={{ flex: 1 }}>{animated}</View><BottomNav current={current.screen} onSelect={tab} /></SafeAreaView>;
}
