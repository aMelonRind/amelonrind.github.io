import { createI18n, Flatten } from "../../lib/i18n-base.tsx";
import { en_us } from "./locale/en_us.ts";

export type TranslationDict = Flatten<typeof import("./locale/en_us.ts")['en_us']>;
export type TranslationKey = keyof TranslationDict;

export const {
  I18nProvider,
  useI18n,
  hasLocale,
  getAvailableLocales,
  createLangSelect,
  localeOrderedElements,
  tw,
  WrappedTranslatable
} = createI18n(en_us, import.meta.glob('./locale/*.json'), 'corner-cutter:lang')
