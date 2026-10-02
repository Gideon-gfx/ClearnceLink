import { useLanguage } from '../i18n/LanguageContext';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { C, Card, Input, Message, Page, Primary } from './ui';

export default function SettingsScreen({ api, onBack }) {
  const { t } = useLanguage();
  const [details, setDetails] = useState(null);
  const [prefix, setPrefix] = useState('');
  const [session, setSession] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => { api.request('/settings').then((result) => { setDetails(result.settings); setPrefix(result.settings.prefix); setSession(result.settings.session); }).catch((cause) => setError(t(cause.message))); }, []);
  const save = async () => { setError(''); try { await api.request('/settings', { prefix, session }, 'PUT'); setNotice(t("Institution settings saved. Future access IDs will use the new prefix.")); } catch (cause) { setError(t(cause.message)); } };
  return <Page title={t("Institution Settings")} onBack={onBack} footer={<><Message text={error} error /><Message text={notice} /><Primary title={t("Save Settings")} onPress={save} /></>}>
    <Card><Text style={{ color: C.ink, fontSize: 15, fontFamily: 'Inter_700Bold' }}>{details?.institutionName || t("Institution")}</Text><Text style={{ marginTop: 5, color: C.muted, fontSize: 11 }}>{details?.officialEmail}</Text><Text style={{ marginTop: 3, color: C.muted, fontSize: 11 }}>{details?.city}, {details?.state}, {details?.country}</Text></Card>
    <Input label={t("Institution Prefix")} value={prefix} onChangeText={setPrefix} placeholder="UNIX" />
    <Text style={{ marginTop: -7, marginBottom: 16, color: C.muted, fontSize: 11 }}>{t("Used for new Clearance IDs. Existing IDs keep their current value.")}</Text>
    <Input label={t("Current Academic Session")} value={session} onChangeText={setSession} placeholder="2026/2027" />
  </Page>;
}
