import type { ReactNode } from "react";

import { type AppLocale } from "./core";
import { useI18n } from "./i18n";
import type { HostShellProps } from "./plutus-types";
import { preserveRuntimeSearch, withRemoteQuery } from "./plutus-command";

function LocaleSelector() {
  const { locale, setLocale, t } = useI18n();
  return (
    <label className="locale-switcher">
      <span>{t("aria.language")}</span>
      <select
        aria-label={t("aria.language")}
        value={locale}
        onChange={(event) => setLocale(event.currentTarget.value as AppLocale)}
      >
        <option value="en">English</option>
        <option value="ko">한국어</option>
      </select>
    </label>
  );
}

export function HostShell({ children }: HostShellProps) {
  const runtimeSearch = preserveRuntimeSearch();
  const { t } = useI18n();
  return (
    <main
      className="app-shell"
      data-testid="route-surface"
      data-route-kind="host"
    >
      <aside className="sidebar" aria-label={t("aria.primaryNavigation")}>
        <strong>Plutus</strong>
        <LocaleSelector />
        <nav>
          <a href={`/dashboard${runtimeSearch}`}>{t("nav.dashboard")}</a>
          <a href={`/portfolios${runtimeSearch}`}>{t("nav.portfolios")}</a>
          <a href={`/watchlists${runtimeSearch}`}>{t("nav.watchlists")}</a>
          <a href={`/runs${runtimeSearch}`}>{t("nav.runs")}</a>
          <a href={`/settings/providers${runtimeSearch}`}>
            {t("nav.providers")}
          </a>
          <a href={`/memory${runtimeSearch}`}>{t("nav.memory")}</a>
          <a href={`/wiki${runtimeSearch}`}>{t("nav.wiki")}</a>
          <a href={`/settings/remote-control${runtimeSearch}`}>
            {t("nav.remote")}
          </a>
        </nav>
      </aside>
      <section className="main-surface">{children}</section>
    </main>
  );
}

export function MobileShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const remote =
    typeof window === "undefined"
      ? "connected"
      : (new URL(window.location.href).searchParams.get("remote") ??
        new URL(window.location.href).searchParams.get("state") ??
        "connected");
  return (
    <main
      className="mobile-shell"
      data-testid="route-surface"
      data-route-kind="remote"
    >
      <nav className="mobile-tabs" aria-label={t("aria.remoteNavigation")}>
        <a href={withRemoteQuery("/remote/dashboard", remote)}>
          {t("nav.home")}
        </a>
        <a href={withRemoteQuery("/remote/runs", remote)}>{t("nav.runs")}</a>
        <a href={withRemoteQuery("/remote/settings", remote)}>
          {t("nav.settings")}
        </a>
      </nav>
      <LocaleSelector />
      {children}
    </main>
  );
}

export function RuntimeUnavailablePage() {
  const { t } = useI18n();
  return (
    <HostShell>
      <section className="panel" data-testid="runtime-unavailable">
        <h1>{t("runtime.title")}</h1>
        <p>{t("runtime.body")}</p>
      </section>
    </HostShell>
  );
}
