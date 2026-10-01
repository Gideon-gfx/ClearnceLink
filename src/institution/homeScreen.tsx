import { useEffect, useRef, useState } from 'react';
import ErrorBanner from '../components/ErrorBanner';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Animated, Pressable, ScrollView, Text, View } from 'react-native';
import { C, Card, Empty, Heading } from './ui';

function Stat({ icon, value, label, tint = C.purple, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  const animate = (toValue) => Animated.spring(scale, { toValue, useNativeDriver: true, friction: 5, tension: 180 }).start();
  return <Animated.View style={{ width: '48.5%', marginBottom: 14, borderRadius: 16, backgroundColor: 'white', elevation: 6, shadowColor: '#4B22A2', shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, transform: [{ scale }] }}>
    <Pressable accessibilityRole="button" accessibilityLabel={`View ${label}`} onPress={onPress} onPressIn={() => animate(0.96)} onPressOut={() => animate(1)} style={{ minHeight: 96, flexDirection: 'row', alignItems: 'center', padding: 11, borderWidth: 1.5, borderColor: '#D8CDF6', borderRadius: 16, backgroundColor: 'white' }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: tint }}><Ionicons name={icon} size={21} color="white" /></View>
      <View style={{ marginLeft: 9, flex: 1 }}><Text style={{ fontSize: 22, color: C.ink, fontFamily: 'Inter_800ExtraBold', fontWeight: '800' }}>{value}</Text><Text style={{ fontSize: 11, color: C.muted, fontFamily: 'Inter_500Medium' }}>{label}</Text></View>
      <Ionicons name="chevron-forward" size={15} color={C.purple} />
    </Pressable>
  </Animated.View>;
}
function QuickAction({ icon, title, onPress }) { return <Pressable onPress={onPress} style={{ height: 68, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10, borderWidth: 2, borderColor: '#d9d2f3', borderRadius: 16, backgroundColor: 'white' }}><View style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: C.purple }}><Ionicons name={icon} size={22} color="white" /></View><Text style={{ flex: 1, marginLeft: 14, fontSize: 15, color: C.ink, fontFamily: 'Inter_700Bold', fontWeight: '700' }}>{title}</Text><Ionicons name="chevron-forward" size={22} color={C.muted} /></Pressable>; }

const greeting = () => { const hour = new Date().getHours(); return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'; };

export default function HomeScreen({ api, user, onNavigate, onTab }) {
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
      <Stat icon="people" value={(stats.students || 0).toLocaleString()} label="Students" onPress={() => onTab('students')} />
      <Stat icon="person" value={(stats.staff || 0).toLocaleString()} label="Staff" onPress={() => onTab('staff')} />
      <Stat icon="shield-checkmark" value={stats.officers || 0} label="Active Officers" tint={C.green} onPress={() => onNavigate('assigned-roles')} />
      <Stat icon="checkmark-circle" value={(stats.fullyCleared || 0).toLocaleString()} label="Fully Cleared" tint="#376CF0" onPress={() => onTab('students', { filter: 'Cleared' })} />
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
