import TextLink from '../components/TextLink';
import { useEffect, useState } from 'react';
import { useSignOut } from '../components/useSignOut';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { apiRequest } from '../api';
import InstitutionLogo from '../components/InstitutionLogo';
import BackArrow from '../components/BackArrow';
import { Card, INK, LINE, MUTED, PURPLE, ProgressBar, RaisedPress, SolidButton, StatusBadge, TabTitle, fileSource, shortName, timeAgo } from './ui';

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning,' : hour < 17 ? 'Good afternoon,' : 'Good evening,';
}

export function useRefresh(app) {
  const [refreshing, setRefreshing] = useState(false);
  return <RefreshControl refreshing={refreshing} tintColor={PURPLE} onRefresh={async () => { setRefreshing(true); await app.reload(); setRefreshing(false); }} />;
}

function StatTile({ value, label, tone, onPress }) {
  const tones = { green: ['#DCF7E6', '#16a34a', '#A6E3BD'], purple: ['#EDE6FF', PURPLE, '#CDBDF7'], red: ['#FFE4E4', '#dc2626', '#F5B5B5'], gray: ['#EEEDF5', '#8b87a6', '#D3D0E2'] };
  const [bg, fg, edge] = tones[tone];
  return (
    <RaisedPress tint={bg} border={edge} padding={12} contentStyle={{ flexDirection: 'row', alignItems: 'center' }} onPress={onPress} accessibilityLabel={`${label}: ${value}`} style={{ width: '48.5%' }}>
      <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: fg, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
        <Text style={{ color: 'white', fontFamily: 'Inter_800ExtraBold', fontWeight: '800', fontSize: 18 }}>{value}</Text>
      </View>
      <Text numberOfLines={2} style={{ flex: 1, fontSize: 14, color: INK, fontFamily: 'Inter_700Bold', fontWeight: '700' }}>{label}</Text>
    </RaisedPress>
  );
}

export function ClearanceRow({ clearance, onPress, compact }) {
  const statusLabel = clearance.status === 'not_started' ? 'Not Started' : undefined;
  return (
    <View style={{ marginBottom: 12 }}><RaisedPress onPress={onPress} tint="#FAF7FF">
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: INK }}>{clearance.name}{compact ? ` ${clearance.session}` : ''}</Text>
          <View style={{ marginTop: 5, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <StatusBadge status={clearance.status} label={statusLabel} />
            {compact ? null : <Text style={{ fontSize: 14, color: MUTED }}>{clearance.session}</Text>}
          </View>
        </View>
        <Text style={{ fontSize: 16, fontWeight: '700', color: INK, marginRight: 8 }}>{clearance.percent}%</Text>
        <Ionicons name="chevron-forward" size={18} color="#8b87a6" />
      </View>
      <View style={{ marginTop: 10 }}><ProgressBar percent={clearance.percent} color={clearance.status === 'action_required' ? '#dc2626' : PURPLE} /></View>
      <Text style={{ marginTop: 6, fontSize: 13, color: MUTED }}>{clearance.done} of {clearance.total} completed</Text>
    </RaisedPress></View>
  );
}

export function HomeScreen({ app }) {
  const { overview } = app;
  const student = overview.student;
  // Progress is counted in documents across every clearance, so it moves as each one is cleared.
  const stages = overview.clearances.flatMap((item) => item.stages).flatMap((stage) => stage.requirements);
  const count = (...statuses) => stages.filter((item) => statuses.includes(item.status)).length;
  const done = count('cleared');
  const percent = stages.length ? Math.round((done / stages.length) * 100) : 0;
  const active = overview.clearances.filter((item) => item.status !== 'completed');
  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 24 }} refreshControl={useRefresh(app)}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
        <InstitutionLogo path="/api/student/logo" hasLogo={overview.hasLogo} token={app.token} size={58} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: INK }}>{student.institutionName}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}><Text style={{ fontSize: 15, color: MUTED }}>{student.session}</Text><Ionicons name="chevron-down" size={15} color={MUTED} style={{ marginLeft: 4 }} /></View>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Notifications" onPress={() => app.setTab('notifications')} style={{ padding: 6 }}>
          <Ionicons name="notifications-outline" size={27} color={INK} />
          {app.unread > 0 ? <View style={{ position: 'absolute', top: 2, right: 2, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: 'white', fontSize: 12, fontWeight: '700' }}>{app.unread}</Text></View> : null}
        </Pressable>
      </View>
      <Text style={{ fontSize: 20, color: INK }}>{greeting()}</Text>
      <Text style={{ fontSize: 26, fontWeight: '800', color: INK }}>{shortName(student.name)} 👋</Text>
      <Text style={{ fontSize: 16, color: MUTED, marginTop: 4, marginBottom: 16 }}>{student.programme} • {student.level} Level</Text>

      <Card style={{ marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: INK }}>Overall Clearance Progress</Text>
          <Text style={{ fontSize: 17, fontWeight: '800', color: INK }}>{percent}%</Text>
        </View>
        <ProgressBar percent={percent} height={8} />
        <Text style={{ marginTop: 8, fontSize: 14, color: MUTED }}>{done} of {stages.length} completed</Text>
      </Card>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, marginBottom: 20 }}>
        <StatTile value={count('cleared')} label="Completed" tone="green" onPress={() => app.setTab('clearances')} />
        <StatTile value={count('pending', 'resubmitted', 'in_progress')} label="Pending" tone="purple" onPress={() => app.setTab('clearances')} />
        <StatTile value={count('action_required')} label="Action Required" tone="red" onPress={() => app.setTab('clearances')} />
        <StatTile value={count('not_started')} label="Not Started" tone="gray" onPress={() => app.setTab('clearances')} />
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
        <Text style={{ fontSize: 17, fontWeight: '700', color: INK }}>Active Clearances</Text>
        <TextLink onPress={() => app.setTab('clearances')} color={PURPLE} style={{ fontSize: 15 }}>View All →</TextLink>
      </View>
      {active.length === 0 ? <Text style={{ color: MUTED, fontSize: 16 }}>All your clearances are complete. 🎉</Text> : null}
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
      <View style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 }}>
        <BackArrow onPress={() => app.setTab('home')} size={30} color={INK} style={{ width: 44, height: 48, justifyContent: 'center' }} />
        <Text style={{ flex: 1, textAlign: 'center', fontSize: 20, fontFamily: 'Inter_800ExtraBold', fontWeight: '800', color: INK }}>My Clearances</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Search clearances" onPress={() => { setSearching(!searching); setQuery(''); }} style={{ width: 44, height: 48, alignItems: 'flex-end', justifyContent: 'center' }}>
          <Ionicons name={searching ? 'close' : 'search'} size={26} color={PURPLE} />
        </Pressable>
      </View>
      {searching ? (
        <View style={{ marginHorizontal: 18, marginBottom: 8, height: 54, borderRadius: 14, borderWidth: 2, borderColor: '#D2CAF1', paddingHorizontal: 14, justifyContent: 'center' }}>
          <TextInput autoFocus value={query} onChangeText={setQuery} placeholder="Search clearances" placeholderTextColor="#a4a1bc" style={{ padding: 0, fontSize: 17, color: INK }} />
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', marginHorizontal: 18, marginBottom: 12, backgroundColor: '#f3f0fd', borderRadius: 14, padding: 4 }}>
        {FILTERS.map(([key, label]) => (
          <Pressable key={key} onPress={() => setFilter(key)} style={{ flex: 1, height: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: filter === key ? PURPLE : 'transparent' }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: filter === key ? 'white' : MUTED }}>{label}</Text>
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
      <TabTitle title="Notifications" onBack={() => app.setTab('home')} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 20 }} refreshControl={useRefresh(app)}>
        {items && items.length === 0 ? <Text style={{ textAlign: 'center', color: MUTED, marginTop: 50 }}>You’re all caught up.</Text> : null}
        {(items || []).map((item) => {
          const [icon, color] = NOTE_ICONS[item.type] || NOTE_ICONS.assigned;
          const target = item.clearanceId && app.overview.clearances.find((entry) => entry.id === item.clearanceId);
          return (
            <Card key={item.id} onPress={target ? () => app.openClearance(target) : undefined} style={{ marginBottom: 10, flexDirection: 'row', backgroundColor: item.read ? 'white' : '#faf8ff' }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#f3f0fd', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}><Ionicons name={icon} size={20} color={color} /></View>
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
  const [signingOut, askSignOut] = useSignOut(app.signOut);
  const student = app.overview.student;
  const photo = app.overview.clearances.flatMap((item) => item.stages).flatMap((stage) => stage.requirements).find((item) => item.id === 'passport-photo' && item.submission?.fileId && item.submission.mimeType.startsWith('image/'));
  const rows = [['Clearance ID', student.clearanceId], ['Programme', student.programme], ['Department', student.department], ['Faculty', student.faculty], ['Level', `${student.level} Level`], ['JAMB Reg. No.', student.jamb], ['Matric No.', student.matricNo || 'To be assigned'], ['Email', student.email], ['Phone', student.phone]];
  return (
    <View style={{ flex: 1 }}>
    <TabTitle title="Profile" onBack={() => app.setTab('home')} />
    <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 24 }}>
      <View style={{ alignItems: 'center', marginVertical: 12 }}>
        {photo ? <Image source={fileSource(photo.submission.fileId, app.token)} style={{ width: 92, height: 92, borderRadius: 46 }} /> : (
          <View style={{ width: 92, height: 92, borderRadius: 46, backgroundColor: '#ede9fe', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="person" size={40} color={PURPLE} /></View>
        )}
        <Text style={{ fontSize: 22, fontWeight: '800', color: INK, marginTop: 10 }}>{student.name}</Text>
        <Text style={{ fontSize: 15, color: MUTED, marginTop: 2 }}>{student.institutionName}</Text>
      </View>
      <Card style={{ padding: 0, marginBottom: 16 }}>
        {rows.map(([label, value], index) => (
          <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 15, borderTopWidth: index ? 1 : 0, borderTopColor: LINE }}>
            <Text style={{ fontSize: 15, color: MUTED }}>{label}</Text>
            <Text style={{ fontSize: 15, fontWeight: '600', color: INK, flexShrink: 1, textAlign: 'right', marginLeft: 16 }}>{value}</Text>
          </View>
        ))}
      </Card>
      {app.overview.clearances.some((item) => item.status === 'completed' && item.completion?.idCard) ? <><SolidButton variant="outline" icon="card-outline" title="Student ID Card" onPress={() => app.go('idcard')} /><View style={{ height: 10 }} /></> : null}
      <SolidButton variant="outline" icon="log-out-outline" title="Sign Out" busy={signingOut} onPress={askSignOut} />
    </ScrollView>
    </View>
  );
}
