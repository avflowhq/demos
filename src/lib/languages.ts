/** Target languages offered by the interpretation demo. Shared with the UI. */
export const TRANSLATE_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'zh', label: '中文' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'pt', label: 'Português' },
  { code: 'id', label: 'Bahasa Indonesia' },
] as const;

export type TranslateLanguage = (typeof TRANSLATE_LANGUAGES)[number]['code'];
