import { useEffect, useState } from 'react';
import ErrorBanner from '../components/ErrorBanner';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { C, Empty, Pill, Primary, ScreenTitle, Search, Secondary, Segments } from './ui';

// Students and Staff share this screen. It has its own header (back arrow + title) instead of the institution banner.
export default function PeopleList({ api, kind, onNavigate, onBack }) {
  const student = kind === 'students';
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => api.request(`/${kind}?search=${encodeURIComponent(search)}`).then((result) => { setItems(result.items); setError(''); }).catch((cause) => setError(cause.message)), 220);
    return () => clearTimeout(timer);
  }, [search]);
  const filtered = items.filter((item) => filter === 'All' || (filter === 'Pending' && item.status === 'pending') || (filter === 'Ready' && item.status === 'ready') || (filter === 'Cleared' && item.status === 'cleared') || (filter === 'Active' && !item.disabled) || (filter === 'Inactive' && item.disabled));
  const initials = (name) => name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();
  return <View style={{ flex: 1, backgroundColor: '#FCFBFF' }}>
    <View style={{ paddingHorizontal: 17, backgroundColor: 'white' }}>
      <ScreenTitle title={student ? 'Students' : 'Staff'} onBack={onBack} />
      <Search value={search} onChangeText={setSearch} placeholder={student ? 'Search students, JAMB no...' : 'Search staff...'} />
      <Segments items={student ? ['All', 'Pending', 'Ready', 'Cleared'] : ['All', 'Active', 'Inactive']} value={filter} onChange={setFilter} />
    </View>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 17, paddingTop: 8, paddingBottom: 22 }}>
      <ErrorBanner message={error} />
      {!filtered.length ? <Empty title={student ? 'No students yet' : 'No staff yet'} detail={student ? 'Add a student or import an admitted student list.' : 'Add staff or import your staff list.'} /> : filtered.map((item, index) => <Pressable key={item.id} onPress={() => onNavigate(student ? 'student-detail' : 'staff-detail', { id: item.id })} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderColor: C.line }}>
        <View style={{ width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: ['#B083E9', '#F95970', '#5C7DF0', '#A957ED', '#168BA0'][index % 5] }}><Text style={{ fontSize: 15, color: 'white', fontFamily: 'Inter_700Bold' }}>{initials(item.name)}</Text></View>
        <View style={{ flex: 1, marginLeft: 12 }}><Text numberOfLines={1} style={{ fontSize: 15, color: C.ink, fontFamily: 'Inter_700Bold', fontWeight: '700' }}>{item.name}</Text><Text numberOfLines={1} style={{ marginTop: 3, fontSize: 12, color: C.muted }}>{student ? item.clearanceId : item.accessId}</Text><Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12, color: C.muted }}>{item.department} {student ? `· ${item.level} Level` : ''}</Text></View>
        {student
          ? <Pill tone={item.disabled ? 'red' : item.status === 'cleared' ? 'green' : item.status === 'ready' ? 'purple' : 'amber'}>{item.disabled ? 'Disabled' : item.status === 'ready' ? 'Ready' : item.status === 'cleared' ? 'Cleared' : 'Pending'}</Pill>
          : <Pill tone={item.disabled ? 'red' : item.approved ? 'green' : 'amber'}>{item.disabled ? 'Disabled' : item.approved ? 'Approved' : 'Pending'}</Pill>}
        <Ionicons name="chevron-forward" size={20} color={C.muted} style={{ marginLeft: 6 }} />
      </Pressable>)}
    </ScrollView>
    <View style={{ paddingHorizontal: 17, paddingVertical: 12, gap: 10, borderTopWidth: 1, borderColor: C.line, backgroundColor: 'white' }}>
      <Primary title={student ? 'Add Student' : 'Add Staff'} icon="add" iconSide="left" onPress={() => onNavigate(student ? 'add-student' : 'add-staff')} />
      <View style={{ flexDirection: 'row', gap: 10 }}><View style={{ flex: 1 }}><Secondary title={student ? 'Import Students' : 'Import Staff'} icon="cloud-upload-outline" onPress={() => onNavigate(student ? 'import-students' : 'import-staff')} /></View><View style={{ flex: 1 }}><Secondary title={student ? 'Review IDs' : 'Assign Role'} icon={student ? 'key-outline' : 'shield-outline'} onPress={() => onNavigate(student ? 'review-student-ids' : 'assign-role')} /></View></View>
    </View>
  </View>;
}
