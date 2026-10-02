import LanguagePicker from '../i18n/LanguagePicker';
import { useLanguage } from '../i18n/LanguageContext';
import BackArrow from '../components/BackArrow';
import TextLink from '../components/TextLink';
import { useEffect, useState } from 'react';
import { useSignOut } from '../components/useSignOut';
import { useBugReport } from '../components/BugReportShake';
import ErrorBanner from '../components/ErrorBanner';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Image, Modal, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { apiBaseUrl, apiRequest } from '../api';
import StampUploader from '../components/StampUploader';
import { useLogoUri } from '../institution/ui';
import { Card, INK, LINE, MUTED, PURPLE, ProgressBar, RaisedPress, SolidButton, TabTitle, timeAgo } from './ui';

const AVATARS = ['#8b5cf6', '#ef4444', '#3b82f6', '#a855f7', '#0d9488', '#f59e0b'];
export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
export const avatarColor = (name = '') => AVATARS[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % AVATARS.length];

export function Avatar({ name, fileId, token, size = 44 }) {
  if (fileId) return <Image source={{ uri: `${apiBaseUrl}/api/staff/files/${fileId}`, headers: { Authorization: `Bearer ${token}` } }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#f3f0fd' }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: avatarColor(name), alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: 'white', fontWeight: '700', fontSize: size * 0.3 }}>{initials(name)}</Text>
    </View>
  );
}

export function InstitutionLogo({ hasLogo, token, size = 56 }) {
  const uri = useLogoUri(hasLogo ? `${apiBaseUrl}/api/staff/logo` : null, token);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: uri ? 'white' : PURPLE, borderWidth: uri ? 1 : 0, borderColor: LINE, overflow: 'hidden' }}>
      {uri ? <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" accessibilityLabel="Institution logo" /> : <Ionicons name="school" size={size * 0.52} color="white" />}
    </View>
  );
}

function useRefresh(app) {
  const [refreshing, setRefreshing] = useState(false);
  return <RefreshControl refreshing={refreshing} tintColor={PURPLE} onRefresh={async () => { setRefreshing(true); await app.reload(); setRefreshing(false); }} />;
}

function Tile({ value, label, icon, tone, onPress }) {
  const tones = { amber: ['#FFF1D0', '#f59e0b', '#F6D58A'], red: ['#FFE4E4', '#ef4444', '#F5B5B5'], green: ['#DCF7E6', '#22c55e', '#A6E3BD'], purple: ['#EDE6FF', '#8b5cf6', '#CDBDF7'] };
  const [bg, fg, edge] = tones[tone];
  return (
    <RaisedPress tint={bg} border={edge} padding={12} contentStyle={{ flexDirection: 'row', alignItems: 'center' }} onPress={onPress} accessibilityLabel={`${label}: ${value}`} style={{ width: '48.5%' }}>
      <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
        <Ionicons name={icon} size={22} color={fg} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 24, lineHeight: 28, fontFamily: 'Inter_800ExtraBold', fontWeight: '800', color: INK }}>{value}</Text>
        <Text numberOfLines={1} style={{ fontSize: 13, color: MUTED }}>{label}</Text>
      </View>
    </RaisedPress>
  );
}

function scopeLine(staff) {
  return `${staff.scope.department} • ${staff.scope.level} Level`;
}

function ClearanceCard({ clearance, staff, onPress, onDelete }) {
  return (
    <RaisedPress onPress={onPress} tint="#FAF7FF">
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: INK }}>{clearance.name} {clearance.session}</Text>
          <Text style={{ fontSize: 14, color: MUTED, marginTop: 2 }}>{scopeLine(staff)}</Text>
        </View>
        {onDelete ? <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${clearance.name}`} onPress={onDelete} hitSlop={8} style={{ padding: 6, marginRight: 4 }}><Ionicons name="trash-outline" size={21} color="#F01F4A" /></Pressable> : null}
        <Ionicons name="chevron-forward" size={20} color="#8b87a6" />
      </View>
      <View style={{ marginTop: 12 }}><ProgressBar percent={clearance.percent} height={8} /></View>
      <Text style={{ marginTop: 6, fontSize: 13, color: MUTED }}>{clearance.pending} pending</Text>
    </RaisedPress>
  );
}

function StudentQuickActions({ app }) {
  const { t } = useLanguage();
  return (
    <View style={{ marginBottom: 20, borderWidth: 1, borderColor: '#E5E1F5', borderRadius: 14, backgroundColor: 'white', overflow: 'hidden' }}>
      {[[t('addStudent'), 'person-add-outline', 'add-student'], [t('importStudents'), 'cloud-upload-outline', 'import-students']].map(([label, icon, target], index) => <Pressable key={target} accessibilityRole="button" accessibilityLabel={label} onPress={() => app.go(target)} style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderTopWidth: index ? 1 : 0, borderTopColor: '#E5E1F5' }}><Ionicons name={icon} size={22} color={PURPLE} /><Text style={{ flex: 1, marginLeft: 12, fontSize: 15, fontFamily: 'Inter_600SemiBold', color: INK }}>{label}</Text><Ionicons name="chevron-forward" size={18} color={MUTED} /></Pressable>)}
    </View>
  );
}

export function HomeScreen({ app }) {
  const { t } = useLanguage();
  const { staff, counts, clearances } = app.overview;
  const hour = new Date().getHours();
  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 24 }} refreshControl={useRefresh(app)}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
        <InstitutionLogo hasLogo={app.overview.hasLogo} token={app.token} size={58} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text numberOfLines={2} style={{ fontSize: 19, lineHeight: 23, fontFamily: 'Inter_800ExtraBold', fontWeight: '800', color: INK }}>{staff.institutionName}</Text>
          <Text style={{ fontSize: 14, color: MUTED, marginTop: 2 }}>{t('portalStaff')}</Text>
        </View>
        <View style={{ marginRight: 6 }}><LanguagePicker /></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Notifications" onPress={() => app.setTab('notifications')} style={{ padding: 6 }}>
          <Ionicons name="notifications-outline" size={27} color={INK} />
          {app.overview.unread > 0 ? <View style={{ position: 'absolute', top: 2, right: 2, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: 'white', fontSize: 12, fontWeight: '700' }}>{app.overview.unread}</Text></View> : null}
        </Pressable>
      </View>
      <Text style={{ fontSize: 18, color: INK }}>{`${hour < 12 ? t('goodMorning') : hour < 17 ? t('goodAfternoon') : t('goodEvening')},`}</Text>
      <Text style={{ fontSize: 26, fontWeight: '800', color: INK }}>{staff.name} 👋</Text>
      <Text style={{ fontSize: 16, color: MUTED, marginTop: 4 }}>{staff.jobTitle}{staff.role === 'officer' ? <Text style={{ color: PURPLE, fontWeight: '700' }}> {t("• Clearance Officer")}</Text> : null}</Text>
      <Text style={{ fontSize: 16, color: MUTED, marginBottom: 16 }}>{scopeLine(staff)}</Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, marginBottom: 22 }}>
        <Tile value={counts.pending} label={t('pendingReview')} icon="hourglass-outline" tone="amber" onPress={() => app.setTab('students', 'pending')} />
        <Tile value={counts.action} label={t('actionRequired')} icon="alert" tone="red" onPress={() => app.setTab('students', 'action')} />
        <Tile value={counts.cleared} label={t('navCleared')} icon="checkmark" tone="green" onPress={() => app.setTab('students', 'cleared')} />
        <Tile value={counts.resubmitted} label={t('resubmitted')} icon="refresh" tone="purple" onPress={() => app.setTab('students', 'pending')} />
      </View>

      <Text style={{ fontSize: 17, fontWeight: '700', color: INK, marginBottom: 10 }}>{t('quickActions')}</Text>
      <StudentQuickActions app={app} />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
        <Text style={{ fontSize: 17, fontWeight: '700', color: INK }}>{t('myClearances')}</Text>
        <TextLink onPress={() => app.setTab('clearances')} color={PURPLE} style={{ fontSize: 15 }}>{t('viewAll')} →</TextLink>
      </View>
      {clearances.length === 0 ? <Text style={{ color: MUTED, fontSize: 16 }}>{t('noClearancesAssigned')}</Text> : null}
      {clearances.slice(0, 3).map((item) => <View key={item.id} style={{ marginBottom: 12 }}><ClearanceCard clearance={item} staff={staff} onPress={() => app.setTab('students')} /></View>)}
    </ScrollView>
  );
}

const CHIPS = [['all', 'All'], ['pending', 'Pending'], ['action', 'Action'], ['cleared', 'Cleared']];

function ReviewStudentsView({ app, switcher }) {
  const { t } = useLanguage();
  const [group, setGroup] = useState(['pending', 'action', 'cleared'].includes(app.filter) ? app.filter : 'all');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const chipCounts = app.overview.chipCounts;

  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      apiRequest(`/api/staff/students?group=${group}&q=${encodeURIComponent(query.trim())}`, undefined, app.token)
        .then((result) => { if (live) { setRows(result.students); setError(''); } })
        .catch((cause) => { if (live) setError(t(cause.message)); });
    }, query ? 250 : 0);
    return () => { live = false; clearTimeout(timer); };
  }, [group, query, app.version]);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 }}>
        <BackArrow onPress={() => app.setTab('home')} size={30} color={INK} style={{ width: 44, height: 48, justifyContent: 'center' }} />
        <Text style={{ flex: 1, textAlign: 'center', fontSize: 20, fontFamily: 'Inter_800ExtraBold', fontWeight: '800', color: INK }}>{t("Students")}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Filter" onPress={() => { setQuery(''); setGroup(group === 'all' ? 'pending' : group === 'pending' ? 'action' : group === 'action' ? 'cleared' : 'all'); }} style={{ width: 44, alignItems: 'flex-end' }}>
          <Ionicons name="funnel-outline" size={24} color={PURPLE} />
        </Pressable>
      </View>
      {switcher}
      <View style={{ marginHorizontal: 18, marginBottom: 12, height: 54, borderRadius: 14, borderWidth: 2, borderColor: '#D2CAF1', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name="search-outline" size={22} color={PURPLE} style={{ marginRight: 10 }} />
        <TextInput value={query} onChangeText={setQuery} placeholder={t("Search name, JAMB or matric no...")} placeholderTextColor="#a4a1bc" style={{ flex: 1, padding: 0, fontSize: 17, color: INK, fontFamily: 'Inter_500Medium' }} />
      </View>
      <View style={{ flexDirection: 'row', paddingHorizontal: 18, marginBottom: 8, gap: 8 }}>
        {CHIPS.map(([key, label]) => {
          const on = group === key && !query;
          const count = ` (${chipCounts[key] ?? 0})`;
          return (
            <Pressable key={key} onPress={() => { setQuery(''); setGroup(key); }} style={{ paddingHorizontal: 14, height: 40, borderRadius: on ? 20 : 4, justifyContent: 'center', backgroundColor: on ? PURPLE : '#f3f0fd', borderWidth: on ? 0 : 1.5, borderColor: '#D9D2F3' }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: on ? 'white' : MUTED }}>{t(label)}{count}</Text>
            </Pressable>
          );
        })}
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 20 }} refreshControl={useRefresh(app)}>
        {rows === null && !error ? <ActivityIndicator color={PURPLE} style={{ marginTop: 40 }} /> : null}
        <View style={{ marginTop: 20 }}><ErrorBanner message={error} /></View>
        {rows && rows.length === 0 ? <Text style={{ textAlign: 'center', color: MUTED, marginTop: 50 }}>{query ? t("No students match your search.") : t("No students in this list.")}</Text> : null}
        {(rows || []).map((item) => (
          <Pressable key={item.id} onPress={() => app.go('student', { id: item.id })} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#E5E1F5' }}>
            <Avatar name={item.name} fileId={item.photoFileId} token={app.token} size={50} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text numberOfLines={1} style={{ flex: 1, fontSize: 16, fontWeight: '700', color: INK }}>{item.name}</Text>
                {item.submittedAt ? <Text style={{ fontSize: 13, color: MUTED, marginLeft: 8 }}>{timeAgo(item.submittedAt)}</Text> : null}
              </View>
              <Text style={{ fontSize: 14, color: PURPLE, marginTop: 1 }}>{item.clearanceId}</Text>
              <Text style={{ fontSize: 14, color: MUTED, marginTop: 1 }}>{item.department} • {item.level} Level</Text>
            </View>
            <View style={{ width: 22, alignItems: 'center' }}>
              {item.group === 'pending' ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#f59e0b' }} /> : <Ionicons name="chevron-forward" size={16} color="#8b87a6" />}
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const DELIVERY = { delivered: ['Sent', 'green'], queued: ['Sending', 'amber'], sending: ['Sending', 'amber'], failed: ['Failed', 'red'], pending: ['Pending', 'amber'] };
const DELIVERY_COLORS = { green: ['#15803d', '#dcfce7'], amber: ['#b45309', '#fef3c7'], red: ['#dc2626', '#fee2e2'] };

// The students this staff member added themselves (officer or not).
function MyStudentsView({ app, switcher }) {
  const { t } = useLanguage();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  useEffect(() => {
    let live = true;
    apiRequest('/api/staff/my-students', undefined, app.token).then((result) => { if (live) { setRows(result.items); setError(''); } }).catch((cause) => { if (live) setError(t(cause.message)); });
    return () => { live = false; };
  }, [app.version]);
  // While any email is still going out, check again shortly so the status updates by itself.
  useEffect(() => {
    if (!rows?.some((item) => ['queued', 'sending'].includes(item.deliveryStatus))) return undefined;
    const timer = setTimeout(() => app.bump(), 4000);
    return () => clearTimeout(timer);
  }, [rows]);
  const resend = async (item) => {
    setNote(''); setError('');
    try { await apiRequest(`/api/staff/my-students/${item.id}/resend`, {}, app.token); setNote(`Clearance ID sent to ${item.email}.`); app.bump(); }
    catch (cause) { setError(t(cause.message)); }
  };
  return (
    <View style={{ flex: 1 }}>
      <TabTitle title={t("My Students")} onBack={() => app.setTab('home')} />
      {switcher}
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 24 }} refreshControl={useRefresh(app)}>
        <StudentQuickActions app={app} />
        <ErrorBanner message={error} />
        {note ? <Text style={{ color: '#15803d', fontSize: 14, marginBottom: 10 }}>{note}</Text> : null}
        {rows === null && !error ? <ActivityIndicator color={PURPLE} style={{ marginTop: 30 }} /> : null}
        {rows && rows.length === 0 ? <Text style={{ textAlign: 'center', color: MUTED, fontSize: 15, lineHeight: 22, marginTop: 24 }}>{t("You haven’t added any students yet. Use Add Student or Import Students above. Their Clearance ID is emailed to them automatically.")}</Text> : null}
        {(rows || []).map((item) => {
          const [label, tone] = DELIVERY[item.deliveryStatus] || DELIVERY.pending;
          const [fg, bg] = DELIVERY_COLORS[tone];
          return (
            <Card key={item.id} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontSize: 16, fontFamily: 'Inter_700Bold', fontWeight: '700', color: INK }}>{item.name}</Text>
                  <Text style={{ fontSize: 13, color: PURPLE, marginTop: 2 }}>{item.clearanceId}</Text>
                  <Text numberOfLines={1} style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>{item.department} • {item.level} Level</Text>
                </View>
                <View style={{ backgroundColor: bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}><Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', fontWeight: '700', color: fg }}>{t(label)}</Text></View>
              </View>
              {item.deliveryStatus === 'failed' ? <View style={{ marginTop: 10 }}>{item.deliveryError ? <Text style={{ fontSize: 13, color: '#dc2626', marginBottom: 8 }}>{item.deliveryError}</Text> : null}<SolidButton variant="outline" icon="mail-outline" title={t("Resend Clearance ID")} onPress={() => resend(item)} /></View> : null}
            </Card>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function StudentsScreen({ app }) {
  const { t } = useLanguage();
  // Officers can switch between reviewing submissions and their own students; other staff only have their own students.
  const canReview = Boolean(app.overview.canCreate);
  const [mode, setMode] = useState(app.filter === 'mine' || !canReview ? 'mine' : 'review');
  const switcher = canReview ? (
    <View style={{ flexDirection: 'row', padding: 4, marginHorizontal: 18, marginBottom: 14, borderRadius: 13, backgroundColor: '#f3f0fd' }}>
      {[['review', t("Review")], ['mine', t("My Students")]].map(([key, label]) => (
        <Pressable key={key} accessibilityRole="button" onPress={() => setMode(key)} style={{ flex: 1, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: mode === key ? PURPLE : 'transparent' }}>
          <Text style={{ fontSize: 15, color: mode === key ? 'white' : MUTED, fontFamily: mode === key ? 'Inter_700Bold' : 'Inter_600SemiBold' }}>{t(label)}</Text>
        </Pressable>
      ))}
    </View>
  ) : null;
  return mode === 'mine' ? <MyStudentsView app={app} switcher={switcher} /> : <ReviewStudentsView app={app} switcher={switcher} />;
}

export function ClearancesScreen({ app }) {
  const { t } = useLanguage();
  const { staff, clearances, canCreate } = app.overview;
  const [target, setTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const remove = async () => {
    setDeleting(true);
    try { await apiRequest(`/api/staff/clearances/${target.id}`, {}, app.token, 'DELETE'); setError(''); setTarget(null); app.bump(); }
    catch (cause) { setTarget(null); setError(t(cause.message)); }
    finally { setDeleting(false); }
  };
  return (
    <View style={{ flex: 1 }}>
      <TabTitle title={t("My Clearances")} onBack={() => app.setTab('home')} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 20 }} refreshControl={useRefresh(app)}>
        <Card style={{ marginBottom: 14, backgroundColor: '#faf8ff' }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: PURPLE, letterSpacing: 0.5 }}>{t("MY CLEARANCE ROLE")}</Text>
          <Text style={{ fontSize: 16, fontWeight: '700', color: INK, marginTop: 4 }}>{staff.scope.department}</Text>
          <Text style={{ fontSize: 14, color: MUTED }}>{staff.scope.level} Level • {staff.scope.session}</Text>
          <Text style={{ fontSize: 13, color: MUTED, marginTop: 6 }}>{t("You review only the clearance responsibilities assigned to you within this scope.")}</Text>
        </Card>
        {canCreate ? <View style={{ marginBottom: 16 }}><SolidButton icon="add-circle-outline" title={t("Create Clearance")} onPress={() => app.go('create-clearance')} /></View> : <Card style={{ marginBottom: 16 }}><Text style={{ fontSize: 14, color: MUTED, lineHeight: 20 }}>{t("Only a clearance officer can create clearances. Ask your institution to assign you the officer role.")}</Text></Card>}
        <ErrorBanner message={error} />
        {clearances.map((item) => <View key={item.id} style={{ marginBottom: 12 }}><ClearanceCard clearance={item} staff={staff} onPress={() => app.setTab('students')} onDelete={item.mine ? () => setTarget(item) : undefined} /></View>)}
        {clearances.length === 0 ? <Text style={{ textAlign: 'center', color: MUTED, marginTop: 24, fontSize: 15 }}>{canCreate ? t("No clearances yet. Tap Create Clearance to add your first one.") : t("No clearances assigned.")}</Text> : null}
      </ScrollView>
      <Modal transparent visible={Boolean(target)} animationType="fade" onRequestClose={() => setTarget(null)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(23,19,43,0.5)', justifyContent: 'flex-end' }} onPress={() => (deleting ? undefined : setTarget(null))}>
          <Pressable onPress={() => {}} style={{ backgroundColor: 'white', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28 }}>
            <View style={{ alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: '#D6D3DF', marginBottom: 18 }} />
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}><Ionicons name="trash-outline" size={30} color="#DC2626" /></View>
              <Text style={{ fontSize: 20, fontFamily: 'Inter_800ExtraBold', fontWeight: '800', color: INK, textAlign: 'center' }}>{t("Delete clearance?")}</Text>
              <Text style={{ marginTop: 8, fontSize: 15, lineHeight: 22, color: MUTED, textAlign: 'center' }}>“{target?.name}” will be removed for you and your students. This only works before students have submitted anything.</Text>
            </View>
            <SolidButton variant="danger" icon="trash-outline" title={t("Delete clearance")} busy={deleting} onPress={remove} />
            <View style={{ marginTop: 10 }}><SolidButton variant="outline" title={t("Cancel")} disabled={deleting} onPress={() => setTarget(null)} /></View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const NOTE_ICONS = { submission: ['document-text', PURPLE], resubmission: ['refresh-circle', '#d97706'], role: ['ribbon', '#16a34a'] };

export function NotificationsScreen({ app }) {
  const { t } = useLanguage();
  const [items, setItems] = useState(null);
  useEffect(() => {
    let live = true;
    apiRequest('/api/staff/notifications', undefined, app.token).then(async (result) => {
      if (!live) return;
      setItems(result.notifications);
      if (result.notifications.some((item) => !item.read)) { await apiRequest('/api/staff/notifications/read', {}, app.token); app.reload(); }
    }).catch(() => live && setItems([]));
    return () => { live = false; };
  }, [app.version]);
  return (
    <View style={{ flex: 1 }}>
      <TabTitle title={t("Notifications")} onBack={() => app.setTab('home')} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 20 }} refreshControl={useRefresh(app)}>
        {items && items.length === 0 ? <Text style={{ textAlign: 'center', color: MUTED, marginTop: 50 }}>{t("You’re all caught up.")}</Text> : null}
        {(items || []).map((item) => {
          const [icon, color] = NOTE_ICONS[item.type] || NOTE_ICONS.role;
          return (
            <Card key={item.id} style={{ marginBottom: 10, flexDirection: 'row', backgroundColor: item.read ? 'white' : '#faf8ff' }}>
              <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#f3f0fd', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}><Ionicons name={icon} size={20} color={color} /></View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: INK }}>{item.title}</Text>
                <Text style={{ fontSize: 15, color: MUTED, marginTop: 2, lineHeight: 17 }}>{item.body}</Text>
                <Text style={{ fontSize: 13, color: '#9a97b5', marginTop: 4 }}>{timeAgo(item.createdAt)}</Text>
              </View>
              {!item.read ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: PURPLE, marginTop: 4 }} /> : null}
            </Card>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function ProfileScreen({ app }) {
  const { t } = useLanguage();
  const { open: openBugReport } = useBugReport();
  const [signingOut, askSignOut, signOutSheet] = useSignOut(app.signOut);
  const { staff } = app.overview;
  const rows = [[t("Staff Access ID"), staff.accessId], [t("Institution Staff ID"), staff.staffId], [t("Job Title"), staff.jobTitle], [t("Faculty"), staff.faculty], [t("Department"), staff.department], [t("Email"), staff.email], [t("Phone"), staff.phone]];
  return (
    <View style={{ flex: 1 }}>
    <TabTitle title={t("Profile")} onBack={() => app.setTab('home')} />
    <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 24 }}>
      <View style={{ alignItems: 'center', marginVertical: 12 }}>
        <Avatar name={staff.name} size={92} />
        <Text style={{ fontSize: 22, fontWeight: '800', color: INK, marginTop: 10 }}>{staff.name}</Text>
        <Text style={{ fontSize: 15, color: MUTED, marginTop: 2 }}>{staff.institutionName}</Text>
      </View>
      <Card style={{ marginBottom: 14, backgroundColor: '#faf8ff' }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: PURPLE, letterSpacing: 0.5 }}>{t("MY CLEARANCE ROLE")}</Text>
        <Text style={{ fontSize: 17, fontWeight: '700', color: INK, marginTop: 4 }}>{staff.scope.department}</Text>
        <Text style={{ fontSize: 15, color: MUTED }}>{staff.scope.level} Level • {staff.scope.session}</Text>
      </Card>
      <Card style={{ padding: 0, marginBottom: 16 }}>
        {rows.map(([label, value], index) => (
          <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 15, borderTopWidth: index ? 1 : 0, borderTopColor: LINE }}>
            <Text style={{ fontSize: 15, color: MUTED }}>{t(label)}</Text>
            <Text style={{ fontSize: 15, fontWeight: '600', color: INK, flexShrink: 1, textAlign: 'right', marginLeft: 16 }}>{value}</Text>
          </View>
        ))}
      </Card>
      <View style={{ marginBottom: 16 }}><StampUploader basePath="/api/staff" token={app.token} /></View>
      <SolidButton variant="outline" icon="bug-outline" title={t("Report a bug")} onPress={openBugReport} /><View style={{ height: 10 }} />
      <><SolidButton variant="outline" icon="log-out-outline" title={t('signOut')} busy={signingOut} onPress={askSignOut} />{signOutSheet}</>
    </ScrollView>
    </View>
  );
}
