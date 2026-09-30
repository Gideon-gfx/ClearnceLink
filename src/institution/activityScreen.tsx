import { useEffect, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, View } from 'react-native';
import { C, Card, Empty, Page } from './ui';

const iconFor = (action = '') => {
  const text = action.toLowerCase();
  if (/payment|plan|trial/.test(text)) return 'card-outline';
  if (/approved|cleared|activated/.test(text)) return 'checkmark-circle-outline';
  if (/rejected|removed|disabled/.test(text)) return 'close-circle-outline';
  if (/upload|stamp|document|logo/.test(text)) return 'document-text-outline';
  if (/sent|delivered|resent/.test(text)) return 'mail-outline';
  if (/import|added|created|updated|assigned/.test(text)) return 'people-outline';
  return 'notifications-outline';
};

// Every activity in the institution: its own admin actions and what its students and staff do.
export default function ActivityScreen({ api, onBack, onSeen = () => {} }) {
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    api.request('/notifications').then((result) => { setItems(result.items || []); setLoaded(true); return api.request('/notifications/seen', {}, 'POST').then(() => onSeen()); }).catch((cause) => { setError(cause.message); setLoaded(true); });
  }, []);
  return <Page title="Notifications" subtitle="Everything happening across your institution." onBack={onBack}>
    {error ? <Text style={{ color: C.red, marginBottom: 10 }}>{error}</Text> : null}
    {items.length ? items.map((item) => <Card key={item.id} style={item.unread ? { borderColor: C.purple, backgroundColor: '#F8F5FF' } : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: C.pale, marginRight: 11 }}><Ionicons name={iconFor(item.action)} size={18} color={C.purple} /></View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.ink, fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>{item.action}</Text>
          <Text style={{ marginTop: 3, color: C.muted, fontSize: 11.5, lineHeight: 16 }}>{item.actor}{item.target ? ` · ${item.target}` : ''}</Text>
          <Text style={{ marginTop: 3, color: C.muted, fontSize: 10.5 }}>{new Date(item.at).toLocaleString()}</Text>
        </View>
        {item.unread ? <View style={{ width: 9, height: 9, borderRadius: 5, marginTop: 5, backgroundColor: C.purple }} /> : null}
      </View>
    </Card>) : loaded && !error ? <Empty title="No activity yet" detail="Actions by you, your staff and your students will appear here." /> : null}
  </Page>;
}
