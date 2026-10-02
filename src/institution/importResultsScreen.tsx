import { useLanguage } from '../i18n/LanguageContext';
import { useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, View } from 'react-native';
import { C, Card, Heading, Message, Page, Primary, Secondary } from './ui';

function Count({ value, label, tint, background }) { return <View style={{ width: '31.5%', minHeight: 80, alignItems: 'center', justifyContent: 'center', borderRadius: 11, borderWidth: 1, borderColor: C.line, backgroundColor: background }}><Ionicons name="checkmark-circle" size={20} color={tint} /><Text style={{ marginTop: 3, color: C.ink, fontSize: 17, fontFamily: 'Inter_700Bold' }}>{value}</Text><Text style={{ color: C.muted, fontSize: 10 }}>{label}</Text></View>; }

export default function ImportResultsScreen({ api, batch, onBack, onCommitted }) {
  const { t } = useLanguage();
  const [showIssues, setShowIssues] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const counts = batch?.counts || {};
  const commit = async () => { setBusy(true); setError(''); try { const result = await api.request(`/${batch.kind}/import/${batch.batchId}`, {}); onCommitted(result); } catch (cause) { setError(t(cause.message)); } finally { setBusy(false); } };
  return <Page title={t("Import Results")} onBack={onBack} footer={<><Message text={error} error /><Primary title={busy ? t("Importing...") : `Import ${counts.valid || 0} Valid ${batch.kind === 'students' ? 'Students' : 'Staff'}`} disabled={busy || !counts.valid} onPress={commit} /></>}>
    <View style={{ alignItems: 'center', paddingVertical: 17 }}><View style={{ width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: '#DDF7EC' }}><Ionicons name="checkmark-circle" size={55} color={C.green} /></View><Text style={{ marginTop: 12, color: C.ink, fontSize: 20, fontFamily: 'Inter_700Bold' }}>{(counts.detected || 0).toLocaleString()} records detected</Text></View>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 13 }}><Count value={counts.valid || 0} label={t("Valid")} tint={C.green} background="#F0FFF8" /><Count value={counts.correction || 0} label={t("Need Correction")} tint={C.amber} background="#FFFBF1" /><Count value={counts.duplicates || 0} label={t("Duplicates")} tint={C.red} background="#FFF4F6" /></View>
    <Secondary title={showIssues ? t("Hide Issues") : t("Review Issues")} icon="list-outline" onPress={() => setShowIssues((current) => !current)} />
    {showIssues ? <><Heading>{t("Rows requiring attention")}</Heading>{batch.issues?.length ? batch.issues.map((item) => <Card key={item.line}><Text style={{ color: C.ink, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>Row {item.line} · {item.person?.name || 'Unnamed'}</Text><Text style={{ marginTop: 5, color: item.status === 'duplicate' ? C.red : '#A36C00', fontSize: 11 }}>{item.issues.join(' · ')}</Text></Card>) : <Text style={{ color: C.green, marginTop: 10 }}>{t("No issues found.")}</Text>}</> : null}
  </Page>;
}
