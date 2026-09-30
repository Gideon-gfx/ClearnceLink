import { useEffect, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';
import { C, Card, Empty, Message, Page, Pill, Primary } from './ui';

// Staff who have been given a clearance officer role, with their scope. Tap one to view or change it.
export default function AssignedRolesScreen({ api, onBack, onOpen, onAssign }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api.request('/staff').then((result) => setItems(result.items.filter((item) => item.role === 'officer' && !item.disabled))).catch((cause) => { setError(cause.message); setItems([]); }); }, []);
  return <Page title="Assigned Roles" subtitle="Staff you have made clearance officers." onBack={onBack} footer={<><Message text={error} error /><Primary title="Assign New Role" icon="shield-outline" onPress={onAssign} /></>}>
    {items && !items.length && !error ? <Empty title="No roles assigned yet" detail="Assign a staff member as a clearance officer and they will be listed here." /> : null}
    {(items || []).map((item) => <Pressable key={item.id} onPress={() => onOpen(item.id)}><Card>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: C.pale, marginRight: 12 }}><Ionicons name="shield-checkmark-outline" size={20} color={C.purple} /></View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ color: C.ink, fontSize: 14, fontFamily: 'Inter_700Bold' }}>{item.name}</Text>
          <Text numberOfLines={1} style={{ marginTop: 2, color: C.muted, fontSize: 11.5 }}>{item.scope?.department || item.department}{item.scope?.level ? ` · ${item.scope.level} Level` : ''}</Text>
          <Text numberOfLines={1} style={{ marginTop: 2, color: C.muted, fontSize: 11 }}>Session {item.scope?.session || '—'}</Text>
        </View>
        <Pill tone="purple">Officer</Pill>
        <Ionicons name="chevron-forward" size={18} color={C.muted} style={{ marginLeft: 6 }} />
      </View>
    </Card></Pressable>)}
  </Page>;
}
