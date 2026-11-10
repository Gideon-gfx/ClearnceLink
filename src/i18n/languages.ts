// The languages the app can be switched to. English is the default.
export type Language = { code: string; abbr: string; name: string; flag: string };

export const LANGUAGES: Language[] = [
  { code: 'en', abbr: 'EN', name: 'English', flag: '🇬🇧' },
  { code: 'pcm-NG', abbr: 'PCM', name: 'Nigeria · Naija Pidgin', flag: '🇳🇬' },
  { code: 'ak-GH', abbr: 'AK', name: 'Ghana · Twi', flag: '🇬🇭' },
  { code: 'sw-KE', abbr: 'SW', name: 'Kenya · Kiswahili', flag: '🇰🇪' },
  { code: 'lg-UG', abbr: 'LG', name: 'Uganda · Luganda', flag: '🇺🇬' },
  { code: 'zu-ZA', abbr: 'ZU', name: 'South Africa · isiZulu', flag: '🇿🇦' },
  { code: 'bem-ZM', abbr: 'BEM', name: 'Zambia · Bemba', flag: '🇿🇲' },
  { code: 'wo-SN', abbr: 'WO', name: 'Sénégal · Wolof', flag: '🇸🇳' },
  { code: 'dyu-CI', abbr: 'DYU', name: 'Côte d’Ivoire · Dioula', flag: '🇨🇮' },
  { code: 'wes-CM', abbr: 'CPE', name: 'Cameroon · Pidgin', flag: '🇨🇲' },
  { code: 'ln-CD', abbr: 'LN', name: 'R. D. Congo · Lingála', flag: '🇨🇩' },
  { code: 'pt-AO', abbr: 'PT', name: 'Angola · Português', flag: '🇦🇴' },
  { code: 'pt-MZ', abbr: 'PT', name: 'Moçambique · Português', flag: '🇲🇿' },
  { code: 'fr', abbr: 'FR', name: 'Français', flag: '🇫🇷' },
  { code: 'es', abbr: 'ES', name: 'Español', flag: '🇪🇸' },
  { code: 'it', abbr: 'IT', name: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', abbr: 'PT', name: 'Português', flag: '🇧🇷' },
  { code: 'de', abbr: 'DE', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'zh', abbr: 'ZH', name: '中文', flag: '🇨🇳' },
  { code: 'hi', abbr: 'HI', name: 'हिन्दी', flag: '🇮🇳' },
];

export const DEFAULT_LANGUAGE = 'en';
