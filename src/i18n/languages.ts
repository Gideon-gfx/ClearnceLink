// The languages the app can be switched to. English is the default.
export type Language = { code: string; abbr: string; name: string; flag: string };

export const LANGUAGES: Language[] = [
  { code: 'en', abbr: 'EN', name: 'English', flag: '🇬🇧' },
  { code: 'fr', abbr: 'FR', name: 'Français', flag: '🇫🇷' },
  { code: 'es', abbr: 'ES', name: 'Español', flag: '🇪🇸' },
  { code: 'it', abbr: 'IT', name: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', abbr: 'PT', name: 'Português', flag: '🇧🇷' },
  { code: 'de', abbr: 'DE', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'zh', abbr: 'ZH', name: '中文', flag: '🇨🇳' },
  { code: 'hi', abbr: 'HI', name: 'हिन्दी', flag: '🇮🇳' },
];

export const DEFAULT_LANGUAGE = 'en';
