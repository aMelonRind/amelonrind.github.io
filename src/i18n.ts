import { createI18n } from "../lib/i18n-base.tsx";
import { en_us } from "../locale/home/en_us.ts";

export const {
  I18nProvider,
  useI18n,
  hasLocale,
  getAvailableLocales,
  createLangSelect
} = createI18n(en_us, import.meta.glob('../locale/home/*.json'), 'home:lang')
