import { useCallback, useEffect, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiRequest } from '../api';

const PURPLE = '#5a17c9';
const tabs = [
  { id: 'overview', label: 'Overview', icon: 'grid-outline' },
  { id: 'applicants', label: 'Applicants', icon: 'people-outline' },
  { id: 'errors', label: 'Errors', icon: 'alert-circle-outline' },
  { id: 'more', label: 'More', icon: 'ellipsis-horizontal-circle-outline' },
] as const;
const kinds = [
  { id: 'students', label: 'Students' },
  { id: 'staff', label: 'Staff' },
  { id: 'institutions', label: 'Institutions' },
] as const;
const fieldStyle = { borderWidth: 1, borderColor: '#d8d2e8', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10, color: '#171548', marginBottom: 9 };

type AdminSession = { token: string; user: { email: string } };
type AccountItem = {
  id: string;
  name?: string;
  email?: string;
  status?: string;
  institutionName?: string;
  adminAccess?: boolean;
  plan?: string | null;
  role?: string | null;
  scope?: { department?: string; level?: string; session?: string } | null;
  phone?: string;
  faculty?: string;
  department?: string;
  level?: string;
  admissionStatus?: string;
  address?: string;
  jobTitle?: string;
};
type ErrorItem = { id: string; status?: string; role?: string; accountEmail?: string; description?: string; screen?: string; createdAt?: string };
type AuditItem = { id: string; at?: string; action: string; target?: string; detail?: string };
type Overview = { students: number; staff: number; institutions: number; openErrors: number; recentAudit: AuditItem[] };
type AccountKind = 'students' | 'staff' | 'institutions';

const errorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

export default function PlatformAdminApp({ session, onSignOut }: { session: AdminSession; onSignOut: () => void }) {
  const [tab, setTab] = useState('overview');
  const [kind, setKind] = useState<AccountKind>('students');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [errors, setErrors] = useState<ErrorItem[]>([]);
  const [audit, setAudit] = useState<AuditItem[]>([]);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [editor, setEditor] = useState<AccountItem | null>(null);
  const [emailEditor, setEmailEditor] = useState<AccountItem | null>(null);
  const [roleEditor, setRoleEditor] = useState<AccountItem | null>(null);
  const [emailCode, setEmailCode] = useState('');
  const [emailNew, setEmailNew] = useState('');
  const [changeId, setChangeId] = useState('');
  const [scope, setScope] = useState({ faculty: '', department: '', level: '', session: '' });
  const [draft, setDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setBusy(true);
    setMessage('');
    try {
      if (tab === 'overview') setOverview(await apiRequest('/api/platform-admin/overview', undefined, session.token));
      else if (tab === 'applicants') {
        const result = await apiRequest(`/api/platform-admin/accounts?kind=${kind}&q=${encodeURIComponent(query)}`, undefined, session.token);
        setAccounts(result.items || []);
      } else if (tab === 'errors') {
        const result = await apiRequest('/api/platform-admin/errors', undefined, session.token);
        setErrors(result.items || []);
      } else {
        const result = await apiRequest('/api/platform-admin/audit', undefined, session.token);
        setAudit(result.items || []);
      }
    } catch (error) {
      setMessage(errorMessage(error, 'Could not load platform admin data.'));
    } finally {
      setBusy(false);
    }
  }, [kind, query, session.token, tab]);

  useEffect(() => { void load(); }, [load]);

  const post = async (path: string, body: Record<string, unknown>, method: 'POST' | 'PATCH' | 'DELETE' = 'POST') => {
    setBusy(true);
    setMessage('');
    try {
      await apiRequest(path, body, session.token, method);
      setEditor(null); setEmailEditor(null); setRoleEditor(null);
      setMessage('Saved.');
      await load();
    } catch (error) {
      setMessage(errorMessage(error, 'The change could not be saved.'));
    } finally {
      setBusy(false);
    }
  };
  const openEditor = (item: AccountItem) => {
    setDraft({ name: item.name || '', phone: item.phone || '', department: item.department || '', faculty: item.faculty || '', level: item.level || '', admissionStatus: item.admissionStatus || '', institutionName: item.institutionName || '', address: item.address || '' });
    setEditor(item);
  };
  const editFields = kind === 'institutions'
    ? [['institutionName', 'Institution name'], ['name', 'Administrator name'], ['phone', 'Phone'], ['address', 'Address']]
    : kind === 'staff'
      ? [['name', 'Name'], ['phone', 'Phone'], ['faculty', 'Faculty'], ['department', 'Department'], ['jobTitle', 'Job title']]
      : [['name', 'Name'], ['phone', 'Phone'], ['faculty', 'Faculty'], ['department', 'Department'], ['level', 'Level'], ['admissionStatus', 'Admission status']];

  const button = (label: string, action: () => void, color = PURPLE, disabled = false) => (
    <Pressable onPress={action} disabled={disabled || busy} style={{ backgroundColor: disabled ? '#bcb6ca' : color, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8, marginTop: 7, alignSelf: 'flex-start' }}>
      <Text style={{ color: 'white', fontWeight: '700', fontSize: 12 }}>{label}</Text>
    </Pressable>
  );
  const metric = (label: string, value: number | undefined, icon: ComponentProps<typeof Ionicons>['name']) => (
    <View key={label} style={{ flex: 1, minWidth: '43%', backgroundColor: 'white', borderRadius: 13, padding: 16, margin: 5, borderWidth: 1, borderColor: '#eeeaf5' }}>
      <Ionicons name={icon} size={22} color={PURPLE} />
      <Text style={{ color: '#68627d', marginTop: 12, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: '#171548', fontWeight: '800', fontSize: 25, marginTop: 3 }}>{value ?? '—'}</Text>
    </View>
  );
  const content = () => {
    if (busy && !overview && !accounts.length && !errors.length && !audit.length) return <ActivityIndicator color={PURPLE} style={{ marginTop: 45 }} />;
    if (tab === 'overview') return (
      <>
        <Text style={styles.heading}>Platform overview</Text>
        <Text style={styles.subheading}>Manage ClearanceLink accounts and review activity.</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5, marginTop: 12 }}>
          {metric('Students', overview?.students, 'school-outline')}
          {metric('Staff', overview?.staff, 'people-outline')}
          {metric('Institutions', overview?.institutions, 'business-outline')}
          {metric('Open reports', overview?.openErrors, 'alert-circle-outline')}
        </View>
        <Text style={styles.section}>Recent admin activity</Text>
        {(overview?.recentAudit || []).slice(0, 10).map((item) => <Text key={item.id} style={styles.line}>{item.action} · {item.target}</Text>)}
      </>
    );
    if (tab === 'applicants') return (
      <>
        <Text style={styles.heading}>Applicants and accounts</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginVertical: 8 }}>
          {kinds.map((entry) => <Pressable key={entry.id} onPress={() => setKind(entry.id)} style={{ padding: 10, marginRight: 7, marginBottom: 5, borderRadius: 9, backgroundColor: kind === entry.id ? PURPLE : '#eeeaf5' }}><Text style={{ color: kind === entry.id ? 'white' : '#171548', fontWeight: '700' }}>{entry.label}</Text></Pressable>)}
        </View>
        <TextInput value={query} onChangeText={setQuery} placeholder="Search name, email or institution" style={fieldStyle} />
        {accounts.map((item) => (
          <View key={item.id} style={styles.card}>
            <Text style={styles.cardTitle}>{kind === 'institutions' ? item.institutionName || 'Institution' : item.name || 'Account'}</Text>
            <Text style={styles.line}>{item.email || 'No email'} · {item.status || 'unknown'}</Text>
            {item.institutionName && kind !== 'institutions' ? <Text style={styles.line}>{item.institutionName}</Text> : null}
            {kind === 'staff' ? <Text style={styles.line}>Role: {item.role || 'standard staff'}{item.scope ? ` · ${item.scope.department} / ${item.scope.level} / ${item.scope.session}` : ''}</Text> : null}
            {kind === 'institutions' ? <Text style={styles.line}>Plan: {item.adminAccess ? 'Admin-granted access' : item.plan || 'Not active'}</Text> : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
              {button('Edit details', () => openEditor(item))}
              {button('Correct email', () => { setEmailEditor(item); setEmailNew(item.email || ''); setEmailCode(''); setChangeId(''); }, '#4f46a5')}
              {kind === 'institutions'
                ? button(item.adminAccess ? 'Revoke free access' : 'Grant free access', () => void post(`/api/platform-admin/accounts/${item.id}/institution-access`, { grant: !item.adminAccess }), item.adminAccess ? '#9a3412' : '#15803d')
                : button(item.status === 'disabled' ? 'Restore account' : 'Disable account', () => void post(`/api/platform-admin/accounts/${item.id}/status`, { kind, disabled: item.status !== 'disabled' }, 'PATCH'), item.status === 'disabled' ? '#15803d' : '#9a3412')}
              {kind === 'staff' ? button(item.role === 'officer' ? 'Remove officer role' : 'Assign officer role', () => {
                if (item.role === 'officer') void post(`/api/platform-admin/staff/${item.id}/role`, {}, 'DELETE');
                else { setScope({ faculty: item.faculty || '', department: item.department || '', level: '', session: '' }); setRoleEditor(item); }
              }, '#4f46a5') : null}
            </View>
          </View>
        ))}
        {!accounts.length && !busy ? <Text style={styles.line}>No accounts found.</Text> : null}
      </>
    );
    if (tab === 'errors') return (
      <>
        <Text style={styles.heading}>Error reports</Text>
        <Text style={styles.subheading}>Review user-submitted issues, resolve them, then edit affected records from Applicants.</Text>
        {errors.map((item) => <View key={item.id} style={styles.card}>
          <Text style={styles.cardTitle}>{item.status === 'resolved' ? 'Resolved' : 'Open'} · {item.role || 'guest'} · {item.accountEmail || 'No linked account'}</Text>
          <Text style={styles.line}>{item.description}</Text>
          <Text style={styles.line}>{item.screen || 'Unknown screen'} · {item.createdAt || ''}</Text>
          {button(item.status === 'resolved' ? 'Reopen report' : 'Mark resolved', () => void post(`/api/platform-admin/errors/${item.id}`, { resolved: item.status !== 'resolved' }, 'PATCH'), item.status === 'resolved' ? '#4f46a5' : '#15803d')}
        </View>)}
        {!errors.length && !busy ? <Text style={styles.line}>No error reports.</Text> : null}
      </>
    );
    return (
      <>
        <Text style={styles.heading}>More</Text>
        <Text style={styles.subheading}>Audit log for platform administrator changes.</Text>
        {audit.map((item) => <Text key={item.id} style={styles.line}>{item.at} · {item.action} · {item.target}{item.detail ? ` · ${item.detail}` : ''}</Text>)}
        {button('Sign out', onSignOut, '#9a3412')}
      </>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f7fb' }}>
      <View style={styles.header}>
        <View><Text style={styles.headerTitle}>ClearanceLink Admin</Text><Text style={styles.headerEmail}>{session.user.email}</Text></View>
        <Pressable accessibilityLabel="Refresh dashboard" onPress={() => void load()}><Ionicons name="refresh" size={23} color={PURPLE} /></Pressable>
      </View>
      {message ? <Text style={{ color: message.includes('Saved') || message.includes('sent') ? '#15803d' : '#b91c1c', marginHorizontal: 16, marginTop: 7 }}>{message}</Text> : null}
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 15, paddingBottom: 25 }}>{content()}</ScrollView>
      <View style={styles.nav}>
        {tabs.map((item) => <Pressable key={item.id} onPress={() => { setTab(item.id); setMessage(''); }} style={{ flex: 1, alignItems: 'center', paddingVertical: 9 }}>
          <Ionicons name={item.icon} size={21} color={tab === item.id ? PURPLE : '#77738a'} />
          <Text style={{ color: tab === item.id ? PURPLE : '#77738a', fontSize: 10, fontWeight: '700', marginTop: 2 }}>{item.label}</Text>
        </Pressable>)}
      </View>

      <Modal visible={Boolean(editor)} transparent animationType="slide" onRequestClose={() => setEditor(null)}>
        <View style={styles.modalShade}><ScrollView style={styles.modal} keyboardShouldPersistTaps="handled">
          <Text style={styles.heading}>Edit account</Text>
          {editFields.map(([key, label]) => <TextInput key={key} value={String(draft[key] ?? '')} onChangeText={(value) => setDraft((current) => ({ ...current, [key]: value }))} placeholder={label} style={fieldStyle} />)}
          {button('Save changes', () => void post(`/api/platform-admin/accounts/${editor.id}`, { ...draft, kind }, 'PATCH'))}
          {button('Cancel', () => setEditor(null), '#77738a')}
        </ScrollView></View>
      </Modal>
      <Modal visible={Boolean(emailEditor)} transparent animationType="slide" onRequestClose={() => setEmailEditor(null)}>
        <View style={styles.modalShade}><View style={styles.modal}>
          <Text style={styles.heading}>Confirm email change</Text>
          <Text style={styles.subheading}>The new mailbox must confirm an OTP before this account changes.</Text>
          {!changeId ? <TextInput autoCapitalize="none" keyboardType="email-address" value={emailNew} onChangeText={setEmailNew} placeholder="New email address" style={fieldStyle} /> : <TextInput keyboardType="number-pad" value={emailCode} onChangeText={setEmailCode} placeholder="6-digit code" style={fieldStyle} />}
          {button(changeId ? 'Confirm new email' : 'Send OTP to new email', () => {
            if (changeId) void post('/api/platform-admin/email-change/confirm', { changeId, code: emailCode });
            else {
              setBusy(true); setMessage('');
              void apiRequest('/api/platform-admin/email-change/request', { kind, id: emailEditor.id, newEmail: emailNew }, session.token)
                .then((result: { changeId: string; message: string }) => { setChangeId(result.changeId); setMessage(result.message); })
                .catch((error: unknown) => setMessage(errorMessage(error, 'Could not send email verification.')))
                .finally(() => setBusy(false));
            }
          }, '#4f46a5')}
          {button('Cancel', () => setEmailEditor(null), '#77738a')}
        </View></View>
      </Modal>
      <Modal visible={Boolean(roleEditor)} transparent animationType="slide" onRequestClose={() => setRoleEditor(null)}>
        <View style={styles.modalShade}><ScrollView style={styles.modal} keyboardShouldPersistTaps="handled">
          <Text style={styles.heading}>Assign clearance officer</Text>
          {(['faculty', 'department', 'level', 'session'] as const).map((key) => <TextInput key={key} value={scope[key]} onChangeText={(value) => setScope((current) => ({ ...current, [key]: value }))} placeholder={key === 'level' ? 'Three-digit level' : key === 'session' ? 'YYYY/YYYY' : key[0].toUpperCase() + key.slice(1)} style={fieldStyle} />)}
          {button('Assign role', () => void post(`/api/platform-admin/staff/${roleEditor.id}/role`, scope))}
          {button('Cancel', () => setRoleEditor(null), '#77738a')}
        </ScrollView></View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = {
  header: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, paddingHorizontal: 17, paddingVertical: 13, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#eeeaf5' },
  headerTitle: { fontSize: 17, fontWeight: '800' as const, color: '#171548' },
  headerEmail: { fontSize: 11, color: '#6c6780', marginTop: 3 },
  heading: { fontSize: 21, fontWeight: '800' as const, color: '#171548', marginBottom: 5 },
  subheading: { fontSize: 13, lineHeight: 19, color: '#68627d', marginBottom: 10 },
  section: { fontWeight: '800' as const, color: '#171548', marginTop: 18, marginBottom: 7 },
  line: { color: '#524d65', fontSize: 12, lineHeight: 18, marginTop: 4 },
  card: { backgroundColor: 'white', borderWidth: 1, borderColor: '#eeeaf5', borderRadius: 12, padding: 13, marginVertical: 6 },
  cardTitle: { color: '#171548', fontSize: 14, fontWeight: '800' as const },
  nav: { flexDirection: 'row' as const, backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#e8e4ef', paddingBottom: 4 },
  modalShade: { flex: 1, backgroundColor: 'rgba(20,12,38,0.55)', justifyContent: 'center' as const, padding: 18 },
  modal: { maxHeight: '85%' as const, backgroundColor: 'white', borderRadius: 15, padding: 17 },
};
