import type { AppLocale } from "./core";
import { enMessages } from "./i18n-messages-en";
import { koMessages } from "./i18n-messages-ko";

export const messages = {
  en: enMessages,
  ko: koMessages,
} satisfies Record<AppLocale, Record<keyof typeof enMessages, string>>;
