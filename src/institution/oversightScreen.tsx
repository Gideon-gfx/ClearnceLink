import { useLanguage } from '../i18n/LanguageContext';
import { useEffect, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScrollView, Text, View } from 'react-native';
import { C, Card, Empty, Heading, Pill, ScreenTitle } from './ui';

export default function OversightScreen({ api, onBack }) {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api.request('/oversight').then(setData).catch((cause) => setError(t(cause.message))); }, []);
  const stat = (icon, value, label, color) => <Card style={{ width: '31.5%', alignItems: 'center', padding: 9 }}><Ionicons name={icon} size={22} color={color} /><Text style={{ marginTop: 5, color: C.ink, fontSize: 18, fontFamily: 'Inter_700Bold' }}>{value || 0}</Text><Text style={{ textAlign: 'center', color: C.muted, fontSize: 10 }}>{label}</Text></Card>;
  return <View style={{ flex: 1, backgroundColor: 'white' }}><ScreenTitle title={t("Oversight")} onBack={onBack} /><ScrollView contentContainerStyle={{ paddingHorizontal: 17, paddingTop: 6, paddingBottom: 25 }}>
    <Text style={{ marginTop: 5, marginBottom: 16, textAlign: 'center', color: C.muted, fontSize: 11 }}>{t("Monitor activity across your institution.")}</Text>
    {error ? <Text style={{ color: C.red }}>{error}</Text> : null}
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>{stat('time-outline', data?.pending, 'Pending', C.amber)}{stat('checkmark-circle-outline', data?.cleared, 'Cleared', C.green)}{stat('alert-circle-outline', data?.rejected, 'Action Needed', C.red)}</View>
    <Heading>{t("Active Clearances")}</Heading>
    {data?.clearances?.length ? data.clearances.map((item) => <Card key={item.id}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ flex: 1, color: C.ink, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>{item.name}</Text><Pill tone="green">{t("Active")}</Pill></View><Text style={{ marginTop: 7, color: C.muted, fontSize: 11 }}>{item.session} · {item.department || t("Institution wide")}</Text></Card>) : <Empty title={t("No officer clearances yet")} detail={t("Clearance officers create processes within the scope you assign. Their activity will appear here.")} icon="clipboard-outline" />}
    <Heading>{t("Recent Officer Activity")}</Heading>
    {data?.recent?.length ? data.recent.slice(0, 12).map((item) => <Card key={item.id}><Text style={{ color: C.ink, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>{item.action}</Text><Text style={{ marginTop: 4, color: C.muted, fontSize: 11 }}>{item.actor} · {item.target}</Text><Text style={{ marginTop: 3, color: C.muted, fontSize: 10 }}>{new Date(item.at).toLocaleString()}</Text></Card>) : <Empty title={t("No activity yet")} detail={t("Officer and student clearance actions will appear here.")} />}
  </ScrollView></View>;
}
