import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { C, Card, Input, Message, Page, Primary, Secondary } from './ui';

export default function TuitionScreen({ api, onBack }) {
  const [mode, setMode] = useState('full');
  const [total, setTotal] = useState('');
  const [instalments, setInstalments] = useState(['50', '30', '20']);
  const [custom, setCustom] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.request('/tuition').then((result) => { const item = result.tuition; setMode(item.mode || 'full'); setTotal(item.total || ''); setInstalments(item.instalments?.length ? item.instalments.map(String) : ['50', '30', '20']); setCustom(item.custom || ''); }).catch((cause) => setError(cause.message)); }, []);
  const save = async () => { setBusy(true); setError(''); try { await api.request('/tuition', { mode, total, instalments: instalments.map(Number), custom }, 'PUT'); setNotice('Tuition structure saved.'); } catch (cause) { setError(cause.message); } finally { setBusy(false); } };
  const option = (id, title, detail) => <Pressable key={id} onPress={() => setMode(id)} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 68, paddingHorizontal: 12, marginBottom: 8, borderWidth: 1.5, borderColor: mode === id ? C.purple : C.line, borderRadius: 11, backgroundColor: mode === id ? '#F8F3FF' : 'white' }}><View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: mode === id ? C.purple : '#BDB7DA', alignItems: 'center', justifyContent: 'center' }}>{mode === id ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: C.purple }} /> : null}</View><View style={{ marginLeft: 11 }}><Text style={{ color: C.ink, fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>{title}</Text><Text style={{ marginTop: 3, color: C.muted, fontSize: 11 }}>{detail}</Text></View></Pressable>;
  return <Page title="Tuition Structure" subtitle="Define how your institution records tuition. Students do not pay in this app." onBack={onBack} footer={<><Message text={error} error /><Message text={notice} /><Primary title={busy ? 'Saving...' : 'Save Tuition Structure'} disabled={busy} onPress={save} /></>}>
    {option('full', '100% Full Tuition', 'One full tuition amount')}
    {option('instalment', 'Allow Instalment / Breakdown', 'Define percentage stages')}
    {option('custom', 'Custom Structure', 'Describe your own structure')}
    <View style={{ marginTop: 11 }}><Input label="Total Tuition (₦)" value={total} onChangeText={setTotal} placeholder="850000" keyboardType="number-pad" /></View>
    {mode === 'instalment' ? <Card><Text style={{ color: C.ink, fontSize: 12, fontFamily: 'Inter_700Bold', marginBottom: 10 }}>Instalments</Text>{instalments.map((value, index) => <Input key={index} label={`Instalment ${index + 1} (%)`} value={value} onChangeText={(next) => setInstalments((current) => current.map((part, i) => i === index ? next : part))} keyboardType="number-pad" />)}<Secondary title="Add Instalment" onPress={() => setInstalments((current) => [...current, ''])} /><Text style={{ marginTop: 9, color: C.muted, fontSize: 11 }}>Total: {instalments.reduce((sum, value) => sum + Number(value || 0), 0)}%</Text></Card> : null}
    {mode === 'custom' ? <Input label="Custom Instructions" value={custom} onChangeText={setCustom} placeholder="Describe the tuition schedule" multiline /> : null}
  </Page>;
}
