import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { C, Card, Input, Message, Page, Primary } from './ui';

export default function SettingsScreen({ api, onBack }) {
  const [details, setDetails] = useState(null);
  const [prefix, setPrefix] = useState('');
  const [session, setSession] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => { api.request('/settings').then((result) => { setDetails(result.settings); setPrefix(result.settings.prefix); setSession(result.settings.session); }).catch((cause) => setError(cause.message)); }, []);
  const save = async () => { setError(''); try { await api.request('/settings', { prefix, session }, 'PUT'); setNotice('Institution settings saved. Future access IDs will use the new prefix.'); } catch (cause) { setError(cause.message); } };
  return <Page title="Institution Settings" onBack={onBack} footer={<><Message text={error} error /><Message text={notice} /><Primary title="Save Settings" onPress={save} /></>}>
    <Card><Text style={{ color: C.ink, fontSize: 15, fontFamily: 'Inter_700Bold' }}>{details?.institutionName || 'Institution'}</Text><Text style={{ marginTop: 5, color: C.muted, fontSize: 11 }}>{details?.officialEmail}</Text><Text style={{ marginTop: 3, color: C.muted, fontSize: 11 }}>{details?.city}, {details?.state}, {details?.country}</Text></Card>
    <Input label="Institution Prefix" value={prefix} onChangeText={setPrefix} placeholder="UNIX" />
    <Text style={{ marginTop: -7, marginBottom: 16, color: C.muted, fontSize: 11 }}>Used for new Clearance IDs. Existing IDs keep their current value.</Text>
    <Input label="Current Academic Session" value={session} onChangeText={setSession} placeholder="2026/2027" />
  </Page>;
}
