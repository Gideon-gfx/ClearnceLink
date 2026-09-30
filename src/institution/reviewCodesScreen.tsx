import { useEffect, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';
import { C, Card, Empty, Heading, Message, Page, Pill, Primary, Secondary } from './ui';

export default function ReviewCodesScreen({ api, kind, onBack, onOpen }) {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const student = kind === 'students';
  const load = () => api.request(`/${kind}`).then((result) => setItems(result.items)).catch((cause) => setError(cause.message));
  useEffect(() => { load(); }, []);
  const toggle = (id) => setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  const approve = async (all) => { setBusy(true); setError(''); try { const result = await api.request(`/${kind}/approve`, all ? { all: true } : { ids: selected }); setNotice(`${result.approved} IDs approved for release.`); setSelected([]); await load(); } catch (cause) { setError(cause.message); } finally { setBusy(false); } };
  const send = async () => { setBusy(true); setError(''); try { const result = await api.request(`/${kind}/send`, selected.length ? { ids: selected } : { all: true }); setNotice(`${result.results.filter((item) => item.status === 'delivered').length} codes delivered.${result.remaining ? ` ${result.remaining} remain; tap Send Approved Codes again.` : ''}`); setSelected([]); await load(); } catch (cause) { setError(cause.message); } finally { setBusy(false); } };
  const download = async () => { try { const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`; const lines = [['Full Name', 'Department', student ? 'Clearance ID' : 'Staff Access ID', 'Email', 'Approved', 'Delivery Status'], ...items.map((item) => [item.name, item.department, student ? item.clearanceId : item.accessId, item.email, item.approved ? 'Yes' : 'No', item.deliveryStatus])].map((row) => row.map(escape).join(',')).join('\r\n'); const uri = `${FileSystem.cacheDirectory}${kind}-access-ids.csv`; await FileSystem.writeAsStringAsync(uri, lines); await Sharing.shareAsync(uri, { mimeType: 'text/csv' }); } catch (cause) { setError(cause.message); } };
  return <Page title={student ? 'Generated Clearance IDs' : 'Generated Staff Access IDs'} subtitle="Review people before releasing their individual access codes." onBack={onBack} footer={<><Message text={error} error /><Message text={notice} /><Primary title={busy ? 'Please wait...' : 'Send Approved Codes'} disabled={busy} icon="send-outline" onPress={send} /></>}>
    <Text style={{ color: C.muted, fontSize: 11, marginBottom: 12 }}>Each recipient receives only their own ID. Email delivery requires the platform email service.</Text>
    {!items.length ? <Empty title="No generated IDs yet" detail={student ? 'Add or import students to generate IDs.' : 'Add or import staff to generate access IDs.'} /> : items.map((item) => <Card key={item.id}><View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Pressable onPress={() => toggle(item.id)} style={{ width: 32, justifyContent: 'center' }}><Ionicons name={selected.includes(item.id) ? 'checkbox' : 'square-outline'} size={22} color={C.purple} /></Pressable>
      <Pressable onPress={() => onOpen(item.id)} style={{ flex: 1 }}><Text style={{ color: C.ink, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>{item.name}</Text><Text style={{ marginTop: 3, color: C.muted, fontSize: 10 }}>{item.department}</Text><Text style={{ marginTop: 4, color: C.purple, fontSize: 11, fontFamily: 'Inter_700Bold' }}>{student ? item.clearanceId : item.accessId}</Text></Pressable>
      <Pill tone={item.deliveryStatus === 'delivered' ? 'green' : item.deliveryStatus === 'failed' ? 'red' : item.approved ? 'purple' : 'amber'}>{item.deliveryStatus === 'delivered' ? 'Delivered' : item.deliveryStatus === 'failed' ? 'Failed' : item.approved ? 'Ready' : 'Needs Review'}</Pill>
    </View></Card>)}
    {items.length ? <View style={{ gap: 7, marginTop: 10 }}><Secondary title={`Approve Selected (${selected.length})`} icon="checkmark-outline" onPress={() => approve(false)} /><Secondary title="Approve All" icon="checkmark-done-outline" onPress={() => approve(true)} /><Secondary title="Download List" icon="download-outline" onPress={download} /></View> : null}
  </Page>;
}
