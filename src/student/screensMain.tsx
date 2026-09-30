import { useEffect, useState } from 'react';
import { useSignOut } from '../components/useSignOut';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { apiRequest } from '../api';
import { Card, INK, InstitutionMark, LINE, MUTED, PURPLE, ProgressBar, SolidButton, StatusBadge, fileSource, shortName, timeAgo } from './ui';

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning,' : hour < 17 ? 'Good afternoon,' : 'Good evening,';
}

export function useRefresh(app) {
  const [refreshing, setRefreshing] = useState(false);
  return <RefreshControl refreshing={refreshing} tintColor={PURPLE} onRefresh={async () => { setRefreshing(true); await app.reload(); setRefreshing(false); }} />;
}

function StatTile({ value, label, tone }) {
  const tones = { green: ['#dcfce7', '#16a34a'], purple: ['#ede9fe', PURPLE], red: ['#fee2e2', '#dc2626'], gray: ['#eeedf5', '#8b87a6'] };
  const [bg, fg] = tones[tone];
  return (
    <View style={{ width: '48.5%', flexDirection: 'row', alignItems: 'center', backgroundColor: bg, borderRadius: 14, padding: 12 }}>
      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: fg, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
        <Text style={{ color: 'white', fontWeight: '800', fontSize: 15 }}>{value}</Text>
      </View>
      <Text style={{ flex: 1, fontSize: 11, color: INK, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

export function ClearanceRow({ clearance, onPress, compact }) {
  const statusLabel = clearance.status === 'not_started' ? 'Not Started' : undefined;
  return (
    <Card onPress={onPress} style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: INK }}>{clearance.name}{compact ? ` ${clearance.session}` : ''}</Text>
          <View style={{ marginTop: 5, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <StatusBadge status={clearance.status} label={statusLabel} />
            {compact ? null : <Text style={{ fontSize: 11, color: MUTED }}>{clearance.session}</Text>}
          </View>
        </View>
        <Text style={{ fontSize: 13, fontWeight: '700', color: INK, marginRight: 8 }}>{clearance.percent}%</Text>
        <Ionicons name="chevron-forward" size={18} color="#8b87a6" />
      </View>
      <View style={{ marginTop: 10 }}><ProgressBar percent={clearance.percent} color={clearance.status === 'action_required' ? '#dc2626' : PURPLE} /></View>
      <Text style={{ marginTop: 6, fontSize: 10, color: MUTED }}>{clearance.done} of {clearance.total} completed</Text>
    </Card>
  );
}

export function HomeScreen({ app }) {
  const { overview } = app;
  const student = overview.student;
  const stages = overview.clearances.flatMap((item) => item.stages);
  const count = (...statuses) => stages.filter((stage) => statuses.includes(stage.status)).length;
  const done = count('cleared');
  const percent = stages.length ? Math.round((done / stages.length) * 100) : 0;
  const active = overview.clearances.filter((item) => item.status !== 'completed');
  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 24 }} refreshControl={useRefresh(app)}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
        <InstitutionMark size={42} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: INK }}>{student.institutionName}</Text>
          <Text style={{ fontSize: 12, color: MUTED }}>{student.session}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Notifications" onPress={() => app.setTab('notifications')} style={{ padding: 6 }}>
          <Ionicons name="notifications-outline" size={24} color={INK} />
          {app.unread > 0 ? <View style={{ position: 'absolute', top: 2, right: 2, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: 'white', fontSize: 9, fontWeight: '700' }}>{app.unread}</Text></View> : null}
        </Pressable>
      </View>
      <Text style={{ fontSize: 18, color: INK }}>{greeting()}</Text>
      <Text style={{ fontSize: 24, fontWeight: '800', color: INK }}>{shortName(student.name)} 👋</Text>
      <Text style={{ fontSize: 13, color: MUTED, marginTop: 4, marginBottom: 16 }}>{student.programme} • {student.level} Level</Text>

      <Card style={{ marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: INK }}>Overall Clearance Progress</Text>
          <Text style={{ fontSize: 14, fontWeight: '800', color: INK }}>{percent}%</Text>
        </View>
        <ProgressBar percent={percent} height={8} />
        <Text style={{ marginTop: 8, fontSize: 11, color: MUTED }}>{done} of {stages.length} completed</Text>
      </Card>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, marginBottom: 20 }}>
        <StatTile value={count('cleared')} label="Completed" tone="green" />
        <StatTile value={count('pending', 'resubmitted', 'in_progress')} label="Pending" tone="purple" />
        <StatTile value={count('action_required')} label="Action Required" tone="red" />
        <StatTile value={count('not_started')} label="Not Started" tone="gray" />
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: INK }}>Active Clearances</Text>
        <Pressable onPress={() => app.setTab('clearances')}><Text style={{ fontSize: 12, fontWeight: '700', color: PURPLE }}>View All →</Text></Pressable>
      </View>
      {active.length === 0 ? <Text style={{ color: MUTED, fontSize: 13 }}>All your clearances are complete. 🎉</Text> : null}
      {active.slice(0, 3).map((item) => <ClearanceRow key={item.id} compact clearance={item} onPress={() => app.openClearance(item)} />)}
    </ScrollView>
  );
}

const FILTERS = [['all', 'All'], ['progress', 'In Progress'], ['done', 'Completed']];

export function ClearancesScreen({ app }) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const list = app.overview.clearances.filter((item) => {
    if (filter === 'done' && item.status !== 'completed') return false;
    if (filter === 'progress' && ['completed', 'not_started'].includes(item.status)) return false;
    return item.name.toLowerCase().includes(query.trim().toLowerCase());
  });
  return (
    <View style={{ flex: 1 }}>
      <View style={{ height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18 }}>
        <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: INK }}>My Clearances</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Search clearances" onPress={() => { setSearching(!searching); setQuery(''); }} style={{ padding: 6 }}>
          <Ionicons name={searching ? 'close' : 'search'} size={22} color={PURPLE} />
        </Pressable>
      </View>
      {searching ? (
        <View style={{ marginHorizontal: 18, marginBottom: 8, height: 44, borderRadius: 12, borderWidth: 1, borderColor: LINE, paddingHorizontal: 12, justifyContent: 'center' }}>
          <TextInput autoFocus value={query} onChangeText={setQuery} placeholder="Search clearances" placeholderTextColor="#a4a1bc" style={{ padding: 0, fontSize: 14, color: INK }} />
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', marginHorizontal: 18, marginBottom: 12, backgroundColor: '#f3f0fd', borderRadius: 12, padding: 3 }}>
        {FILTERS.map(([key, label]) => (
          <Pressable key={key} onPress={() => setFilter(key)} style={{ flex: 1, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: filter === key ? PURPLE : 'transparent' }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: filter === key ? 'white' : MUTED }}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 20 }} refreshControl={useRefresh(app)}>
        {list.map((item) => <ClearanceRow key={item.id} clearance={item} onPress={() => app.openClearance(item)} />)}
        {list.length === 0 ? <Text style={{ textAlign: 'center', color: MUTED, marginTop: 40 }}>No clearances found.</Text> : null}
      </ScrollView>
    </View>
  );
}

const NOTE_ICONS = {
  assigned: ['document-text', PURPLE], approved: ['checkmark-circle', '#16a34a'], rejected: ['alert-circle', '#dc2626'],
  completed: ['ribbon', '#16a34a'], idcard: ['card', PURPLE], matric: ['school', PURPLE],
};

export function NotificationsScreen({ app }) {
  const [items, setItems] = useState(null);
  useEffect(() => {
    let live = true;
    apiRequest('/api/student/notifications', undefined, app.token).then(async (result) => {
      if (!live) return;
      setItems(result.notifications);
      if (result.notifications.some((item) => !item.read)) { await apiRequest('/api/student/notifications/read', {}, app.token); app.reloadOverview(); }
    }).catch(() => live && setItems([]));
    return () => { live = false; };
  }, [app.version]);
  return (
    <View style={{ flex: 1 }}>
      <View style={{ height: 52, justifyContent: 'center', paddingHorizontal: 18 }}><Text style={{ fontSize: 18, fontWeight: '800', color: INK }}>Notifications</Text></View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 20 }} refreshControl={useRefresh(app)}>
        {items && items.length === 0 ? <Text style={{ textAlign: 'center', color: MUTED, marginTop: 50 }}>You’re all caught up.</Text> : null}
        {(items || []).map((item) => {
          const [icon, color] = NOTE_ICONS[item.type] || NOTE_ICONS.assigned;
          const target = item.clearanceId && app.overview.clearances.find((entry) => entry.id === item.clearanceId);
          return (
            <Card key={item.id} onPress={target ? () => app.openClearance(target) : undefined} style={{ marginBottom: 10, flexDirection: 'row', backgroundColor: item.read ? 'white' : '#faf8ff' }}>
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
  const student = app.overview.student;
  const photo = app.overview.clearances.flatMap((item) => item.stages).flatMap((stage) => stage.requirements).find((item) => item.id === 'passport-photo' && item.submission?.fileId && item.submission.mimeType.startsWith('image/'));
  const rows = [['Clearance ID', student.clearanceId], ['Programme', student.programme], ['Department', student.department], ['Faculty', student.faculty], ['Level', `${student.level} Level`], ['JAMB Reg. No.', student.jamb], ['Matric No.', student.matricNo || 'To be assigned'], ['Email', student.email], ['Phone', student.phone]];
  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 24 }}>
      <View style={{ alignItems: 'center', marginVertical: 12 }}>
        {photo ? <Image source={fileSource(photo.submission.fileId, app.token)} style={{ width: 84, height: 84, borderRadius: 42 }} /> : (
          <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: '#ede9fe', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="person" size={40} color={PURPLE} /></View>
        )}
        <Text style={{ fontSize: 19, fontWeight: '800', color: INK, marginTop: 10 }}>{student.name}</Text>
        <Text style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{student.institutionName}</Text>
      </View>
      <Card style={{ padding: 0, marginBottom: 16 }}>
        {rows.map(([label, value], index) => (
          <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 13, borderTopWidth: index ? 1 : 0, borderTopColor: LINE }}>
            <Text style={{ fontSize: 12, color: MUTED }}>{label}</Text>
            <Text style={{ fontSize: 12, fontWeight: '600', color: INK, flexShrink: 1, textAlign: 'right', marginLeft: 16 }}>{value}</Text>
          </View>
        ))}
      </Card>
      {app.overview.clearances.some((item) => item.status === 'completed' && item.completion?.idCard) ? <><SolidButton variant="outline" icon="card-outline" title="Student ID Card" onPress={() => app.go('idcard')} /><View style={{ height: 10 }} /></> : null}
      <SolidButton variant="outline" icon="log-out-outline" title="Sign Out" busy={signingOut} onPress={askSignOut} />
    </ScrollView>
  );
}
