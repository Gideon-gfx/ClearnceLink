import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { C, Card, Empty, Page } from './ui';

export default function ActivityScreen({ api, onBack }) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => { api.request('/oversight').then((result) => setItems(result.recent || [])).catch((cause) => setError(cause.message)); }, []);
  return <Page title="Audit History" onBack={onBack}>{error ? <Text style={{ color: C.red }}>{error}</Text> : null}{items.length ? items.map((item) => <Card key={item.id}><Text style={{ color: C.ink, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>{item.action}</Text><Text style={{ marginTop: 4, color: C.muted, fontSize: 11 }}>{item.actor} · {item.target}</Text><Text style={{ marginTop: 3, color: C.muted, fontSize: 10 }}>{new Date(item.at).toLocaleString()}</Text></Card>) : <Empty title="No activity yet" detail="Changes to people, roles and tuition will be recorded here." />}</Page>;
}
