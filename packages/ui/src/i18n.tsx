import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  defaultLocale,
  normalizeLocale,
  resolveLocale,
  type AppLocale,
} from "./core";
import { messages } from "./i18n-messages";
import { currentRouteSearchParams } from "./plutus-command";

const localeStorageKey = "plutus.locale";

export type TranslationKey = keyof (typeof messages)["en"];

export type I18nContextValue = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
};

function interpolate(
  template: string,
  params?: Record<string, string | number>,
) {
  if (!params) return template;
  return template.replace(/\{([^}]+)\}/g, (_, key: string) =>
    String(params[key] ?? `{${key}}`),
  );
}

export function translate(
  locale: AppLocale,
  key: TranslationKey,
  params?: Record<string, string | number>,
) {
  return interpolate(messages[locale][key] ?? messages.en[key], params);
}

function initialLocale(): AppLocale {
  if (typeof window === "undefined") return defaultLocale;
  const routeSearch = currentRouteSearchParams(window.location.href);
  return resolveLocale({
    requested: routeSearch.get("locale"),
    stored: window.localStorage.getItem(localeStorageKey),
    browserLocales: navigator.languages,
  });
}

function hrefWithPersistedLocale(href: string, locale: AppLocale): URL {
  const url = new URL(href);
  if (!url.hash.startsWith("#/")) {
    url.searchParams.set("locale", locale);
    return url;
  }
  const hashRoute = new URL(url.hash.slice(1), "https://plutus.local");
  hashRoute.searchParams.set("locale", locale);
  url.searchParams.delete("locale");
  url.hash = `#${hashRoute.pathname}${hashRoute.search}${hashRoute.hash}`;
  return url;
}

function persistLocale(locale: AppLocale) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(localeStorageKey, locale);
  const url = hrefWithPersistedLocale(window.location.href, locale);
  window.history.replaceState(window.history.state, "", url);
}

const I18nContext = createContext<I18nContextValue>({
  locale: defaultLocale,
  setLocale: () => undefined,
  t: (key, params) => translate(defaultLocale, key, params),
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>(() => initialLocale());
  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale: (nextLocale) => {
        const normalizedLocale = normalizeLocale(nextLocale);
        setLocaleState(normalizedLocale);
        persistLocale(normalizedLocale);
      },
      t: (key, params) => translate(locale, key, params),
    }),
    [locale],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
