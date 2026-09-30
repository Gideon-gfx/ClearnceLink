import { useEffect, useState } from 'react';
import ErrorBanner from '../components/ErrorBanner';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { C, Card, Empty, Heading } from './ui';

function Stat({ icon, value, label, tint = C.purple }) { return <View style={{ width: '48.5%', minHeight: 92, flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 10, borderWidth: 2, borderColor: '#d9d2f3', borderRadius: 14, backgroundColor: 'white' }}><View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: tint }}><Ionicons name={icon} size={21} color="white" /></View><View style={{ marginLeft: 10, flex: 1 }}><Text style={{ fontSize: 22, color: C.ink, fontFamily: 'Inter_800ExtraBold', fontWeight: '800' }}>{value}</Text><Text style={{ fontSize: 11, color: C.muted, fontFamily: 'Inter_500Medium' }}>{label}</Text></View></View>; }
function QuickAction({ icon, title, onPress }) { return <Pressable onPress={onPress} style={{ height: 68, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10, borderWidth: 2, borderColor: '#d9d2f3', borderRadius: 16, backgroundColor: 'white' }}><View style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: C.purple }}><Ionicons name={icon} size={22} color="white" /></View><Text style={{ flex: 1, marginLeft: 14, fontSize: 15, color: C.ink, fontFamily: 'Inter_700Bold', fontWeight: '700' }}>{title}</Text><Ionicons name="chevron-forward" size={22} color={C.muted} /></Pressable>; }

const greeting = () => { const hour = new Date().getHours(); return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'; };

export default function HomeScreen({ api, user, onNavigate }) {
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api.request('/overview').then(setOverview).catch((cause) => setError(cause.message)); }, []);
  const stats = overview?.stats || {};
  return <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 22, paddingBottom: 22 }} showsVerticalScrollIndicator={false}>
    <Text style={{ fontSize: 26, lineHeight: 32, color: C.ink, fontFamily: 'Inter_800ExtraBold', fontWeight: '800' }}>{greeting()},</Text>
    <Text style={{ fontSize: 36, lineHeight: 44, color: C.ink, fontFamily: 'Inter_800ExtraBold', fontWeight: '800' }}>{user?.name || 'Administrator'} 👋</Text>
    <Text style={{ marginTop: 6, marginBottom: 22, fontSize: 14, color: C.muted, fontFamily: 'Inter_500Medium' }}>Here’s your institution overview.</Text>
    <ErrorBanner message={error} />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
      <Stat icon="people" value={(stats.students || 0).toLocaleString()} label="Students" />
      <Stat icon="person" value={(stats.staff || 0).toLocaleString()} label="Staff" />
      <Stat icon="shield-checkmark" value={stats.officers || 0} label="Active Officers" tint={C.green} />
      <Stat icon="checkmark-circle" value={(stats.fullyCleared || 0).toLocaleString()} label="Fully Cleared" tint="#376CF0" />
    </View>
    <Heading>Quick Actions</Heading>
    <QuickAction icon="person-add" title="Add Student" onPress={() => onNavigate('add-student')} />
    <QuickAction icon="cloud-upload" title="Import Students" onPress={() => onNavigate('import-students')} />
    <QuickAction icon="person-add-outline" title="Add Staff" onPress={() => onNavigate('add-staff')} />
    <QuickAction icon="cloud-upload-outline" title="Import Staff" onPress={() => onNavigate('import-staff')} />
    <QuickAction icon="shield-checkmark-outline" title="Assigned Roles" onPress={() => onNavigate('assigned-roles')} />
    <Heading action="View All" onAction={() => onNavigate('activity')}>Recent Activity</Heading>
    {overview?.recent?.length ? overview.recent.map((item) => <Card key={item.id}><Text style={{ fontSize: 12, color: C.ink, fontFamily: 'Inter_600SemiBold' }}>{item.action}</Text><Text style={{ marginTop: 4, fontSize: 11, color: C.muted }}>{item.target} · {new Date(item.at).toLocaleDateString()}</Text></Card>) : <Empty title="No activity yet" detail="Actions in your institution will appear here." icon="time-outline" />}
  </ScrollView>;
}
