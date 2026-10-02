import { useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { DEFAULT_LANGUAGE, LANGUAGES } from './languages';
import { useLanguage } from './LanguageContext';

const INK = '#171548';
const MUTED = '#6e6b91';
const PURPLE = '#5a17c9';

// A small button showing the current flag and abbreviation (🇬🇧 EN). Tapping it slides up the list of languages.
// `tone="light"` is for use on the purple login header.
export default function LanguagePicker({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  const { lang, setLang, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const current = LANGUAGES.find((item) => item.code === lang) || LANGUAGES[0];
  const light = tone === 'light';
  return (
    <>
      <Pressable
        accessibilityRole="button" accessibilityLabel={`${t('language')}: ${current.name}`} onPress={() => setOpen(true)} hitSlop={6}
        style={{ flexDirection: 'row', alignItems: 'center', height: 36, paddingHorizontal: 10, borderRadius: 18, backgroundColor: light ? 'rgba(255,255,255,0.18)' : '#F3F0FF', borderWidth: 1.5, borderColor: light ? 'rgba(255,255,255,0.55)' : '#D9D2F3' }}
      >
        <Text style={{ fontSize: 17 }}>{current.flag}</Text>
        <Text style={{ marginLeft: 5, fontSize: 13, fontFamily: 'Inter_700Bold', fontWeight: '700', color: light ? 'white' : PURPLE }}>{current.abbr}</Text>
        <Ionicons name="chevron-down" size={13} color={light ? 'white' : PURPLE} style={{ marginLeft: 3 }} />
      </Pressable>
      <Modal transparent visible={open} animationType="slide" statusBarTranslucent onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => setOpen(false)} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(23,19,43,0.5)' }} />
          <View style={{ backgroundColor: 'white', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24, maxHeight: '80%' }}>
            <View style={{ alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: '#D6D3DF', marginBottom: 14 }} />
            <Text style={{ fontSize: 21, fontFamily: 'Inter_800ExtraBold', fontWeight: '800', color: INK, marginBottom: 12 }}>{t('chooseLanguage')}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {LANGUAGES.map((item) => {
                const selected = item.code === lang;
                return (
                  <Pressable
                    key={item.code} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => { setLang(item.code); setOpen(false); }}
                    style={{ flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 8, borderRadius: 14, borderWidth: 2, borderColor: selected ? PURPLE : '#E5E1F5', backgroundColor: selected ? '#F6F2FF' : 'white' }}
                  >
                    <Text style={{ fontSize: 26, marginRight: 12 }}>{item.flag}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', fontWeight: '700', color: INK }}>{item.name}</Text>
                      <Text style={{ fontSize: 13, color: MUTED, marginTop: 1 }}>{item.abbr}</Text>
                    </View>
                    {item.code === DEFAULT_LANGUAGE ? <View style={{ backgroundColor: '#EEE8FF', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginRight: 10 }}><Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', fontWeight: '700', color: PURPLE }}>{t('defaultTag')}</Text></View> : null}
                    {selected ? <Ionicons name="checkmark-circle" size={24} color={PURPLE} /> : <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#c9c5dc' }} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
