import { useLanguage } from '../i18n/LanguageContext';
import { useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';
import { C, Card, Message, Page, Primary, Secondary, Segments } from './ui';

const studentColumns = ['Full Name', 'JAMB Registration Number', 'Email', 'Phone Number', 'Faculty / School', 'Department', 'Programme', 'Entry Level', 'Current Level', 'Admission Year', 'Admission Status'];
const staffColumns = ['Full Name', 'Institution Staff ID', 'Email', 'Phone Number', 'Faculty', 'Department', 'Job Title'];

export default function ImportScreen({ api, kind, onBack, onManual, onValidated, allowMatric = false, nested = false }) {
  const { t } = useLanguage();
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('Import Excel');
  const student = kind === 'students';
  const pick = async () => { try { const selected = await api.chooseSpreadsheet(); if (selected) { setFile(selected); setError(''); } } catch (cause) { setError(t(cause.message)); } };
  const validate = async () => { if (!file) { setError(t("Choose a .xlsx or .csv file first.")); return; } setBusy(true); setError(''); try { const result = await api.request(`/${kind}/import/validate`, file); onValidated({ ...result, kind }); } catch (cause) { setError(t(cause.message)); } finally { setBusy(false); } };
  return <Page nested={nested} title={student ? t("Add Students") : t("Import Staff")} onBack={onBack} footer={<><Message text={error} error /><Primary title={busy ? t("Validating...") : t("Upload and Validate")} disabled={busy} onPress={validate} /></>}>
    <Segments items={['Add Manually', 'Import Excel']} value={tab} onChange={(next) => { setTab(next); if (next === 'Add Manually') onManual(); }} />
    <Pressable accessibilityRole="button" onPress={pick} style={{ minHeight: 172, borderWidth: 2, borderStyle: 'dashed', borderColor: '#BEAFF6', borderRadius: 14, backgroundColor: '#FCFBFF', alignItems: 'center', justifyContent: 'center', marginBottom: 13 }}>
      <Ionicons name="cloud-upload-outline" size={42} color={C.purple} />
      <Text style={{ marginTop: 8, color: C.ink, fontSize: 16, fontFamily: 'Inter_700Bold' }}>{file ? file.filename : t("Upload Excel File")}</Text>
      <Text style={{ marginTop: 4, color: C.muted, fontSize: 13 }}>.xlsx or .csv · Max 10MB</Text>
      <Text style={{ marginTop: 10, color: C.purple, fontSize: 14, fontFamily: 'Inter_700Bold' }}>{t("Tap to choose file")}</Text>
    </Pressable>
    <Secondary title={t("Download Import Template")} icon="download-outline" onPress={() => api.downloadTemplate(kind).catch((cause) => setError(t(cause.message)))} />
    <Text style={{ marginTop: 20, marginBottom: 10, color: C.ink, fontSize: 17, fontFamily: 'Inter_800ExtraBold', fontWeight: '800' }}>{allowMatric ? t("Spreadsheet Columns") : t("Required Columns")}</Text>
    <Card style={{ borderWidth: 3, borderColor: '#CBBFF5' }}><View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{(student ? allowMatric ? [...studentColumns, 'Matriculation Number'] : studentColumns : staffColumns).map((column) => <Text key={column} style={{ width: '50%', paddingVertical: 5, paddingRight: 6, color: C.ink, fontSize: 14, fontFamily: 'Inter_500Medium' }}>• {column}</Text>)}</View></Card>
    {student ? <Text style={{ marginTop: 4, color: C.muted, fontSize: 13, lineHeight: 19 }}>{allowMatric ? t("For each student at any level, fill in either JAMB Registration Number or Matriculation Number.") : t("Upload all admitted students in one spreadsheet. The institution is taken from your account.")}</Text> : null}
  </Page>;
}
