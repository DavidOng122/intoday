export const LANGUAGE_STORAGE_KEY = 'desktop_profile_language';

export const SUPPORTED_LANGUAGES = ['EN', 'ZH', 'MS', 'JA', 'TH'];

const BROWSER_LANGUAGE_MAP = {
  en: 'EN',
  zh: 'ZH',
  ms: 'MS',
  ja: 'JA',
  th: 'TH',
};

export const LOGIN_LANGUAGE_OPTIONS = [
  { value: 'ZH', label: '中' },
  { value: 'EN', label: 'EN' },
  { value: 'MS', label: 'MS' },
  { value: 'JA', label: '日' },
  { value: 'TH', label: 'TH' },
];

export const PROFILE_LANGUAGE_OPTIONS = [
  { value: 'EN', label: 'EN' },
  { value: 'ZH', label: '中文' },
  { value: 'MS', label: 'MS' },
  { value: 'JA', label: '日本語' },
  { value: 'TH', label: 'ไทย' },
];

export function isSupportedLanguage(language) {
  return SUPPORTED_LANGUAGES.includes(language);
}

export function resolveLanguage(language) {
  return isSupportedLanguage(language) ? language : 'EN';
}

export function detectBrowserLanguage() {
  if (typeof navigator === 'undefined') {
    return 'EN';
  }

  const [prefix = 'en'] = (navigator.language || 'en').toLowerCase().split('-');
  return BROWSER_LANGUAGE_MAP[prefix] || 'EN';
}

export function getSavedLanguage() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const savedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isSupportedLanguage(savedLanguage) ? savedLanguage : null;
  } catch {
    return null;
  }
}

export function getInitialLanguage() {
  return getSavedLanguage() || detectBrowserLanguage();
}

export function getLanguageLabel(language) {
  return PROFILE_LANGUAGE_OPTIONS.find((option) => option.value === language)?.label || 'EN';
}
