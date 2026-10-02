import { useLanguage } from '../i18n/LanguageContext';
import { useEffect, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';
import { C, Card, Heading, Input, Message, Page, Primary } from './ui';

const ID_MODES = [
  ['none', 'No ID card step', 'Students are not given an ID card through the app.', 'close-circle-outline'],
  ['digital', 'Digital ID card', 'You upload each student’s ID card; they view and download it in the app.', 'phone-portrait-outline'],
  ['physical', 'Physical collection', 'Students collect the printed card. You set where, when and how.', 'business-outline'],
  ['both', 'Digital + physical', 'Students get the digital card and can also collect the printed one.', 'copy-outline'],
];

function Toggle({ label, detail, value, onChange }) {
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: value }} onPress={() => onChange(!value)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
      <Ionicons name={value ? 'checkbox' : 'square-outline'} size={23} color={value ? C.purple : '#A9A4CA'} style={{ marginRight: 11 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: C.ink, fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>{label}</Text>
        <Text style={{ marginTop: 2, color: C.muted, fontSize: 11 }}>{detail}</Text>
      </View>
    </Pressable>
  );
}

export default function CompletionScreen({ api, onBack }) {
  const { t } = useLanguage();
  const [config, setConfig] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => { api.request('/completion').then((result) => setConfig(result.completion)).catch((cause) => setError(t(cause.message))); }, []);
  const set = (changes) => { setNotice(''); setConfig((current) => ({ ...current, ...changes })); };
  const save = async () => {
    setError(''); setNotice('');
    try { const result = await api.request('/completion', config, 'PUT'); setConfig(result.completion); setNotice(t("Completion actions saved.")); }
    catch (cause) { setError(t(cause.message)); }
  };
  const physical = config && ['physical', 'both'].includes(config.idCardMode);
  return (
    <Page title={t("Completion Actions")} onBack={onBack} subtitle={t("Choose what students receive once they complete a clearance.")} footer={<><Message text={error} error /><Message text={notice} /><Primary title={t("Save Completion Actions")} onPress={save} disabled={!config} /></>}>
      {config ? <>
        <Heading>{t("Student ID card")}</Heading>
        {ID_MODES.map(([value, title, detail, icon]) => {
          const on = config.idCardMode === value;
          return (
            <Pressable key={value} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => set({ idCardMode: value })} style={{ flexDirection: 'row', alignItems: 'center', padding: 13, marginBottom: 9, borderRadius: 13, borderWidth: on ? 2 : 1, borderColor: on ? C.purple : C.line, backgroundColor: on ? '#F7F3FF' : 'white' }}>
              <Ionicons name={icon} size={22} color={on ? C.purple : C.muted} style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.ink, fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>{t(title)}</Text>
                <Text style={{ marginTop: 2, color: C.muted, fontSize: 11, lineHeight: 16 }}>{t(detail)}</Text>
              </View>
              <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={21} color={on ? C.purple : '#B7B2D6'} />
            </Pressable>
          );
        })}
        {config.idCardMode === 'digital' || config.idCardMode === 'both' ? <Text style={{ marginBottom: 6, color: C.muted, fontSize: 11, lineHeight: 16 }}>{t("Upload each student’s card from their Student Details screen.")}</Text> : null}
        {physical ? <>
          <Heading>{t("Collection details")}</Heading>
          <Input label={t("Location")} value={config.location} onChangeText={(value) => set({ location: value })} placeholder={t("e.g. Student Affairs Office")} />
          <Input label={t("Collection Date")} value={config.date} onChangeText={(value) => set({ date: value })} placeholder="e.g. 5 October 2026" />
          <Input label={t("Office Hours")} value={config.hours} onChangeText={(value) => set({ hours: value })} placeholder={t("e.g. Mon-Fri, 9:00 AM - 4:00 PM")} />
          <Input label={t("Instructions")} value={config.instructions} onChangeText={(value) => set({ instructions: value })} placeholder={t("e.g. Bring a printed copy of your clearance certificate.")} multiline />
        </> : null}
        <Heading>{t("Other completion actions")}</Heading>
        <Card>
          <Toggle label={t("Clearance certificate")} detail={t("Students can generate their clearance certificate.")} value={config.certificate} onChange={(value) => set({ certificate: value })} />
          <Toggle label={t("Matriculation number")} detail={t("Show the matric number once you record it on the student's account.")} value={config.matric} onChange={(value) => set({ matric: value })} />
        </Card>
        <Input label={t("Custom instructions (optional)")} value={config.custom} onChangeText={(value) => set({ custom: value })} placeholder={t("Anything else students should do after clearance.")} multiline />
      </> : <Message text={error} error />}
    </Page>
  );
}
