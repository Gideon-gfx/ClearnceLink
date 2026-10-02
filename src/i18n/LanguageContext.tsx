import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { DEFAULT_LANGUAGE, LANGUAGES } from './languages';
import { translations } from './translations';

const STORAGE_KEY = 'clearancelink_language';

type Translate = (key: string, values?: Record<string, string | number>) => string;
const LanguageContext = createContext<{ lang: string; setLang: (code: string) => void; t: Translate }>({
  lang: DEFAULT_LANGUAGE, setLang: () => {}, t: (key) => translations.en[key] ?? key,
});

// Holds the chosen language for the whole app and remembers it on the phone.
export function LanguageProvider({ children }: { children: any }) {
  const [lang, setLangState] = useState(DEFAULT_LANGUAGE);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    SecureStore.getItemAsync(STORAGE_KEY).then((saved) => { if (saved && LANGUAGES.some((item) => item.code === saved)) setLangState(saved); }).catch(() => {});
  }, []);
  const setLang = useCallback((code: string) => {
    if (!LANGUAGES.some((item) => item.code === code)) return;
    setLangState(code);
    if (Platform.OS !== 'web') SecureStore.setItemAsync(STORAGE_KEY, code).catch(() => {});
  }, []);
  const t = useCallback<Translate>((key, values) => {
    const text = translations[lang]?.[key] ?? translations.en[key] ?? key;
    return values ? text.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? `{${name}}`)) : text;
  }, [lang]);
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export const useLanguage = () => useContext(LanguageContext);
