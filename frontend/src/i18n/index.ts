import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './en.json';
import pt from './pt.json';
import es from './es.json';
import ru from './ru.json';

const RU_SESSION_KEY = 'kelvo_ru_loaded';

let russianFailedOnce = false;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      pt: { translation: pt },
      es: { translation: es },
      ru: { translation: ru },
    },
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'kelvo_ecomm_lang',
      caches: ['localStorage'],
    },
  });

/**
 * Attempts to change language with the intentional Russian first-attempt
 * failure. Returns true on success, throws on the simulated failure.
 */
export async function changeLanguageSafe(lng: string): Promise<boolean> {
  if (lng === 'ru' && !russianFailedOnce && !sessionStorage.getItem(RU_SESSION_KEY)) {
    russianFailedOnce = true;
    const err = new Error('Translation load timeout: ru');
    (window as any).DD_RUM?.addError?.(err, {
      source: 'custom',
      context: { language: 'ru', attempt: 1 },
    });
    throw err;
  }

  await i18n.changeLanguage(lng);
  localStorage.setItem('kelvo_ecomm_lang', lng);

  if (lng === 'ru') {
    sessionStorage.setItem(RU_SESSION_KEY, '1');
  }

  return true;
}

export default i18n;
