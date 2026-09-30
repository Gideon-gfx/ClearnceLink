import { useEffect, useState } from 'react';
import { useSignOut } from '../components/useSignOut';
import ErrorBanner from '../components/ErrorBanner';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { apiBaseUrl, apiRequest } from '../api';
import StampUploader from '../components/StampUploader';
import { Card, INK, InstitutionMark, LINE, MUTED, PURPLE, ProgressBar, SolidButton, timeAgo } from '../student/ui';

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

function useRefresh(app) {
  const [refreshing, setRefreshing] = useState(false);
  return <RefreshControl refreshing={refreshing} tintColor={PURPLE} onRefresh={async () => { setRefreshing(true); await app.reload(); setRefreshing(false); }} />;
}

function Tile({ value, label, icon, tone }) {
  const tones = { amber: ['#fff4dc', '#f59e0b'], red: ['#fee2e2', '#ef4444'], green: ['#dcfce7', '#22c55e'], purple: ['#ede9fe', '#8b5cf6'] };
  const [bg, fg] = tones[tone];
  return (
    <Card style={{ width: '48.5%', flexDirection: 'row', alignItems: 'center', padding: 12 }}>
      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
        <Ionicons name={icon} size={20} color={fg} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 20, fontWeight: '800', color: INK }}>{value}</Text>
        <Text style={{ fontSize: 10, color: MUTED }}>{label}</Text>
      </View>
    </Card>
  );
}

function scopeLine(staff) {
  return `${staff.scope.department} • ${staff.scope.level} Level`;
}

function ClearanceCard({ clearance, staff, onPress }) {
  return (
    <Card onPress={onPress} style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: INK }}>{clearance.name} {clearance.session}</Text>
          <Text style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{scopeLine(staff)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#8b87a6" />
      </View>
      <View style={{ marginTop: 10 }}><ProgressBar percent={clearance.percent} /></View>
      <Text style={{ marginTop: 6, fontSize: 10, color: MUTED }}>{clearance.pending} pending</Text>
    </Card>
  );
}

export function HomeScreen({ app }) {
  const { staff, counts, clearances } = app.overview;
  const hour = new Date().getHours();
  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 24 }} refreshControl={useRefresh(app)}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
        <InstitutionMark size={42} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: INK }}>{staff.institutionName}</Text>
          <Text style={{ fontSize: 12, color: MUTED }}>Staff Portal</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Notifications" onPress={() => app.setTab('notifications')} style={{ padding: 6 }}>
          <Ionicons name="notifications-outline" size={24} color={INK} />
          {app.overview.unread > 0 ? <View style={{ position: 'absolute', top: 2, right: 2, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: 'white', fontSize: 9, fontWeight: '700' }}>{app.overview.unread}</Text></View> : null}
        </Pressable>
      </View>
      <Text style={{ fontSize: 17, color: INK }}>{hour < 12 ? 'Good morning,' : hour < 17 ? 'Good afternoon,' : 'Good evening,'}</Text>
      <Text style={{ fontSize: 24, fontWeight: '800', color: INK }}>{staff.name} 👋</Text>
      <Text style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>{staff.jobTitle}</Text>
      <Text style={{ fontSize: 13, color: MUTED, marginBottom: 16 }}>{scopeLine(staff)}</Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, marginBottom: 22 }}>
        <Tile value={counts.pending} label="Pending Review" icon="hourglass-outline" tone="amber" />
        <Tile value={counts.action} label="Action Required" icon="alert" tone="red" />
        <Tile value={counts.cleared} label="Cleared" icon="checkmark" tone="green" />
        <Tile value={counts.resubmitted} label="Re-submitted" icon="refresh" tone="purple" />
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: INK }}>My Clearances</Text>
        <Pressable onPress={() => app.setTab('clearances')}><Text style={{ fontSize: 12, fontWeight: '700', color: PURPLE }}>View All →</Text></Pressable>
      </View>
      {clearances.length === 0 ? <Text style={{ color: MUTED, fontSize: 13 }}>No clearance responsibilities have been assigned to you yet.</Text> : null}
      {clearances.slice(0, 3).map((item) => <ClearanceCard key={item.id} clearance={item} staff={staff} onPress={() => app.setTab('students')} />)}
    </ScrollView>
  );
}

const CHIPS = [['pending', 'Pending'], ['action', 'Action Required'], ['cleared', 'Cleared']];

export function StudentsScreen({ app }) {
  const [group, setGroup] = useState('pending');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const chipCounts = app.overview.chipCounts;

  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      apiRequest(`/api/staff/students?group=${group}&q=${encodeURIComponent(query.trim())}`, undefined, app.token)
        .then((result) => { if (live) { setRows(result.students); setError(''); } })
        .catch((cause) => { if (live) setError(cause.message); });
    }, query ? 250 : 0);
    return () => { live = false; clearTimeout(timer); };
  }, [group, query, app.version]);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18 }}>
        <View style={{ width: 32 }} />
        <Text style={{ flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800', color: INK }}>Students</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Filter" onPress={() => { setQuery(''); setGroup(group === 'pending' ? 'action' : group === 'action' ? 'cleared' : 'pending'); }} style={{ width: 32, alignItems: 'flex-end' }}>
          <Ionicons name="funnel-outline" size={20} color={PURPLE} />
        </Pressable>
      </View>
      <View style={{ marginHorizontal: 18, marginBottom: 10, height: 44, borderRadius: 12, borderWidth: 1, borderColor: LINE, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name="search-outline" size={18} color={PURPLE} style={{ marginRight: 8 }} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Search by name, JAMB no..." placeholderTextColor="#a4a1bc" style={{ flex: 1, padding: 0, fontSize: 13, color: INK }} />
      </View>
      <View style={{ flexDirection: 'row', paddingHorizontal: 18, marginBottom: 6, gap: 8 }}>
        {CHIPS.map(([key, label]) => {
          const on = group === key && !query;
          const count = key === 'cleared' ? '' : ` (${chipCounts[key]})`;
          return (
            <Pressable key={key} onPress={() => { setQuery(''); setGroup(key); }} style={{ paddingHorizontal: 12, height: 34, borderRadius: 17, justifyContent: 'center', backgroundColor: on ? PURPLE : '#f3f0fd' }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: on ? 'white' : MUTED }}>{label}{count}</Text>
            </Pressable>
          );
        })}
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 20 }} refreshControl={useRefresh(app)}>
        {rows === null && !error ? <ActivityIndicator color={PURPLE} style={{ marginTop: 40 }} /> : null}
        <View style={{ marginTop: 20 }}><ErrorBanner message={error} /></View>
        {rows && rows.length === 0 ? <Text style={{ textAlign: 'center', color: MUTED, marginTop: 50 }}>{query ? 'No students match your search.' : 'No students in this list.'}</Text> : null}
        {(rows || []).map((item) => (
          <Pressable key={item.id} onPress={() => app.go('student', { id: item.id })} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0eef8' }}>
            <Avatar name={item.name} fileId={item.photoFileId} token={app.token} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, fontWeight: '700', color: INK }}>{item.name}</Text>
                {item.submittedAt ? <Text style={{ fontSize: 10, color: MUTED, marginLeft: 8 }}>{timeAgo(item.submittedAt)}</Text> : null}
              </View>
              <Text style={{ fontSize: 11, color: PURPLE, marginTop: 1 }}>{item.clearanceId}</Text>
              <Text style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>{item.department} • {item.level} Level</Text>
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

export function ClearancesScreen({ app }) {
  const { staff, clearances } = app.overview;
  return (
    <View style={{ flex: 1 }}>
      <View style={{ height: 52, justifyContent: 'center', paddingHorizontal: 18 }}><Text style={{ fontSize: 18, fontWeight: '800', color: INK }}>My Clearances</Text></View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 20 }} refreshControl={useRefresh(app)}>
        <Card style={{ marginBottom: 14, backgroundColor: '#faf8ff' }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: PURPLE, letterSpacing: 0.5 }}>MY CLEARANCE ROLE</Text>
          <Text style={{ fontSize: 14, fontWeight: '700', color: INK, marginTop: 4 }}>{staff.scope.department}</Text>
          <Text style={{ fontSize: 12, color: MUTED }}>{staff.scope.level} Level • {staff.scope.session}</Text>
          <Text style={{ fontSize: 11, color: MUTED, marginTop: 6 }}>You review only the clearance responsibilities assigned to you within this scope.</Text>
        </Card>
        {clearances.map((item) => <ClearanceCard key={item.id} clearance={item} staff={staff} onPress={() => app.setTab('students')} />)}
        {clearances.length === 0 ? <Text style={{ textAlign: 'center', color: MUTED, marginTop: 30 }}>No clearances assigned.</Text> : null}
      </ScrollView>
    </View>
  );
}

const NOTE_ICONS = { submission: ['document-text', PURPLE], resubmission: ['refresh-circle', '#d97706'], role: ['ribbon', '#16a34a'] };

export function NotificationsScreen({ app }) {
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
      <View style={{ height: 52, justifyContent: 'center', paddingHorizontal: 18 }}><Text style={{ fontSize: 18, fontWeight: '800', color: INK }}>Notifications</Text></View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 20 }} refreshControl={useRefresh(app)}>
        {items && items.length === 0 ? <Text style={{ textAlign: 'center', color: MUTED, marginTop: 50 }}>You’re all caught up.</Text> : null}
        {(items || []).map((item) => {
          const [icon, color] = NOTE_ICONS[item.type] || NOTE_ICONS.role;
          return (
            <Card key={item.id} style={{ marginBottom: 10, flexDirection: 'row', backgroundColor: item.read ? 'white' : '#faf8ff' }}>
              <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#f3f0fd', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}><Ionicons name={icon} size={20} color={color} /></View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: INK }}>{item.title}</Text>
                <Text style={{ fontSize: 12, color: MUTED, marginTop: 2, lineHeight: 17 }}>{item.body}</Text>
                <Text style={{ fontSize: 10, color: '#9a97b5', marginTop: 4 }}>{timeAgo(item.createdAt)}</Text>
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
  const [signingOut, askSignOut] = useSignOut(app.signOut);
  const { staff } = app.overview;
  const rows = [['Staff Access ID', staff.accessId], ['Institution Staff ID', staff.staffId], ['Job Title', staff.jobTitle], ['Faculty', staff.faculty], ['Department', staff.department], ['Email', staff.email], ['Phone', staff.phone]];
  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 24 }}>
      <View style={{ alignItems: 'center', marginVertical: 12 }}>
        <Avatar name={staff.name} size={84} />
        <Text style={{ fontSize: 19, fontWeight: '800', color: INK, marginTop: 10 }}>{staff.name}</Text>
        <Text style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{staff.institutionName}</Text>
      </View>
      <Card style={{ marginBottom: 14, backgroundColor: '#faf8ff' }}>
        <Text style={{ fontSize: 10, fontWeight: '700', color: PURPLE, letterSpacing: 0.5 }}>MY CLEARANCE ROLE</Text>
        <Text style={{ fontSize: 14, fontWeight: '700', color: INK, marginTop: 4 }}>{staff.scope.department}</Text>
        <Text style={{ fontSize: 12, color: MUTED }}>{staff.scope.level} Level • {staff.scope.session}</Text>
      </Card>
      <Card style={{ padding: 0, marginBottom: 16 }}>
        {rows.map(([label, value], index) => (
          <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 13, borderTopWidth: index ? 1 : 0, borderTopColor: LINE }}>
            <Text style={{ fontSize: 12, color: MUTED }}>{label}</Text>
            <Text style={{ fontSize: 12, fontWeight: '600', color: INK, flexShrink: 1, textAlign: 'right', marginLeft: 16 }}>{value}</Text>
          </View>
        ))}
      </Card>
      <View style={{ marginBottom: 16 }}><StampUploader basePath="/api/staff" token={app.token} /></View>
      <SolidButton variant="outline" icon="log-out-outline" title="Sign Out" busy={signingOut} onPress={askSignOut} />
    </ScrollView>
  );
}
