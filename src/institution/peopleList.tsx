import { useLanguage } from '../i18n/LanguageContext';
import { useEffect, useState } from 'react';
import ErrorBanner from '../components/ErrorBanner';
import Ionicons from '@expo/vector-icons/Ionicons';
import { FlatList, Pressable, Text, View } from 'react-native';
import { C, Empty, Pill, Primary, ScreenTitle, Search, Secondary, Segments } from './ui';

// Students and Staff share this screen. It has its own header (back arrow + title) instead of the institution banner.
export default function PeopleList({ api, kind, initialFilter = 'All', onNavigate, onBack }) {
  const { t } = useLanguage();
  const student = kind === 'students';
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState(initialFilter);
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const status = filter === 'All' ? 'all' : filter.toLowerCase();
  const query = `/${kind}?search=${encodeURIComponent(search)}&status=${status}&limit=50`;
  useEffect(() => {
    let active = true;
    setItems([]);
    setHasMore(false);
    const timer = setTimeout(() => api.request(query).then((result) => { if (active) { setItems(result.items); setHasMore(result.hasMore); setError(''); } }).catch((cause) => { if (active) setError(t(cause.message)); }), 220);
    return () => { active = false; clearTimeout(timer); };
  }, [query]);
  const loadMore = () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    api.request(`${query}&offset=${items.length}`).then((result) => { setItems((current) => [...current, ...result.items]); setHasMore(result.hasMore); setError(''); }).catch((cause) => setError(t(cause.message))).finally(() => setLoadingMore(false));
  };
  const initials = (name) => name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();
  return <View style={{ flex: 1, backgroundColor: '#FCFBFF' }}>
    <View style={{ paddingHorizontal: 17, backgroundColor: 'white' }}>
      <ScreenTitle title={student ? t("Students") : t("Staff")} onBack={onBack} />
      <Search value={search} onChangeText={setSearch} placeholder={student ? t("Search students, JAMB no...") : t("Search staff...")} />
      <Segments items={student ? ['All', 'Pending', 'Ready', 'Cleared'] : ['All', 'Active', 'Inactive']} value={filter} onChange={setFilter} />
    </View>
    <FlatList style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 17, paddingTop: 8, paddingBottom: 22 }} data={items} keyExtractor={(item) => item.id} onEndReached={loadMore} onEndReachedThreshold={0.5} ListHeaderComponent={<ErrorBanner message={error} />} ListEmptyComponent={<Empty title={student ? t("No students yet") : t("No staff yet")} detail={student ? t("Add a student or import an admitted student list.") : t("Add staff or import your staff list.")} />} renderItem={({ item, index }) => <Pressable onPress={() => onNavigate(student ? 'student-detail' : 'staff-detail', { id: item.id })} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderColor: C.line }}>
        <View style={{ width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: ['#B083E9', '#F95970', '#5C7DF0', '#A957ED', '#168BA0'][index % 5] }}><Text style={{ fontSize: 15, color: 'white', fontFamily: 'Inter_700Bold' }}>{initials(item.name)}</Text></View>
        <View style={{ flex: 1, marginLeft: 12 }}><Text numberOfLines={1} style={{ fontSize: 15, color: C.ink, fontFamily: 'Inter_700Bold', fontWeight: '700' }}>{item.name}</Text><Text numberOfLines={1} style={{ marginTop: 3, fontSize: 12, color: C.muted }}>{student ? item.clearanceId : item.accessId}</Text><Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12, color: C.muted }}>{item.department} {student ? `· ${item.level} Level` : ''}</Text></View>
        {student
          ? <Pill tone={item.disabled ? 'red' : item.status === 'cleared' ? 'green' : item.status === 'ready' ? 'purple' : 'amber'}>{item.disabled ? t("Disabled") : item.status === 'ready' ? t("Ready") : item.status === 'cleared' ? t("Cleared") : t("Pending")}</Pill>
          : <Pill tone={item.disabled ? 'red' : item.approved ? 'green' : 'amber'}>{item.disabled ? t("Disabled") : item.approved ? t("Approved") : t("Pending")}</Pill>}
        <Ionicons name="chevron-forward" size={20} color={C.muted} style={{ marginLeft: 6 }} />
      </Pressable>} />
    <View style={{ paddingHorizontal: 17, paddingVertical: 12, gap: 10, borderTopWidth: 1, borderColor: C.line, backgroundColor: 'white' }}>
      <Primary title={student ? t("Add Student") : t("Add Staff")} icon="add" iconSide="left" onPress={() => onNavigate(student ? 'add-student' : 'add-staff')} />
      <View style={{ flexDirection: 'row', gap: 10 }}><View style={{ flex: 1 }}><Secondary title={student ? t("Import Students") : t("Import Staff")} icon="cloud-upload-outline" onPress={() => onNavigate(student ? 'import-students' : 'import-staff')} /></View><View style={{ flex: 1 }}><Secondary title={student ? t("Review IDs") : t("Assign Role")} icon={student ? 'key-outline' : 'shield-outline'} onPress={() => onNavigate(student ? 'review-student-ids' : 'assign-role')} /></View></View>
    </View>
  </View>;
}
