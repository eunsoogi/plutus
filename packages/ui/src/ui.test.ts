import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "./i18n";
import { routeHrefForLocation } from "./plutus-command";
import { MobileShell } from "./plutus-shell";
import {
  formatCurrency,
  normalizeLocale,
  remoteStateLabel,
  resolveLocale,
  riskToneForCategory,
  translate,
} from "./index";
import "./ui-office.test";
import "./ui-office-three.test";
import "./orchestrator-office-three-view.test";

describe("ui helpers", () => {
  it("formats compact financial values and risk states used by the preview", () => {
    expect(formatCurrency(184250, "USD")).toBe("$184,250");
    expect(riskToneForCategory("risk_warning")).toBe("danger");
    expect(remoteStateLabel("stale")).toBe("Stale snapshot");
  });

  it("normalizes supported app locales from URLs and browser preferences", () => {
    expect(normalizeLocale("ko-KR")).toBe("ko");
    expect(normalizeLocale("en-US")).toBe("en");
    expect(normalizeLocale("ja-JP")).toBe("en");
    expect(resolveLocale({ requested: "ko-KR", stored: "en" })).toBe("ko");
    expect(resolveLocale({ stored: "ko", browserLocales: ["en-US"] })).toBe(
      "ko",
    );
    expect(resolveLocale({ browserLocales: ["ko-KR", "en-US"] })).toBe("ko");
  });

  it("localizes currency and remote state labels", () => {
    expect(formatCurrency(184250, "USD", "ko")).toBe("US$184,250");
    expect(remoteStateLabel("connected", "ko")).toBe("Plutus Mac에 연결됨");
    expect(remoteStateLabel("stale", "ko")).toBe("오래된 스냅샷");
  });

  it("uses natural Korean product copy for remote-control surfaces", () => {
    expect(translate("ko", "remote.control")).toBe("원격 제어");
    expect(translate("ko", "remote.revoke", { device: "iPhone" })).toBe(
      "iPhone 연결 해제",
    );
    expect(translate("ko", "remote.thesisEdit")).toBe("투자 메모 편집");
    expect(translate("ko", "remote.saveThesis")).toBe("투자 메모를 Mac에 저장");
    expect(translate("ko", "wiki.revisionTimeline")).toBe("수정 이력");
    expect(translate("ko", "remote.readOnlyMobile")).toBe(
      "이 미리보기에서는 모바일 조회만 가능합니다.",
    );
  });

  it("keeps Tauri route links on the root bundle with hash paths", () => {
    expect(
      routeHrefForLocation({
        href: "tauri://localhost/",
        path: "/settings/providers",
        search: "?locale=ko",
      }),
    ).toBe("/#/settings/providers?locale=ko");
    expect(
      routeHrefForLocation({
        href: "http://127.0.0.1:4173/dashboard",
        path: "/settings/providers",
        search: "?runtime=local",
      }),
    ).toBe("/settings/providers?runtime=local");
    expect(
      routeHrefForLocation({
        href: "https://tauri.localhost/",
        path: "/settings/providers",
      }),
    ).toBe("/#/settings/providers");
    expect(
      routeHrefForLocation({
        href: "http://localhost/",
        path: "/settings/providers",
      }),
    ).toBe("/#/settings/providers");
    expect(
      routeHrefForLocation({
        href: "http://127.0.0.1:4173/",
        path: "/settings/providers",
        isTauriRuntime: true,
      }),
    ).toBe("/#/settings/providers");
    expect(
      routeHrefForLocation({
        href: "http://127.0.0.1:4173/dashboard",
        path: "/settings/providers",
        search: "?runtime=local",
        routeMode: "hash",
      }),
    ).toBe("/#/settings/providers?runtime=local");
    expect(
      routeHrefForLocation({
        href: "tauri://localhost/",
        path: "/settings/providers",
        routeMode: "path",
      }),
    ).toBe("/settings/providers");
  });

  it("keeps hash-routed remote state and locale in mobile tabs", () => {
    vi.stubGlobal("window", {
      __PLUTUS_ROUTE_MODE__: "hash",
      history: {
        replaceState: vi.fn(),
        state: null,
      },
      localStorage: {
        getItem: () => null,
        setItem: vi.fn(),
      },
      location: {
        href: "tauri://localhost/#/remote/dashboard?state=revoked&locale=ko",
      },
    });
    vi.stubGlobal("navigator", { languages: ["en-US"] });

    try {
      const markup = renderToStaticMarkup(
        createElement(
          I18nProvider,
          null,
          createElement(
            MobileShell,
            null,
            createElement("section", null, "Remote body"),
          ),
        ),
      );

      expect(markup).toContain(
        'href="/#/remote/runs?remote=revoked&amp;locale=ko"',
      );
      expect(markup).toContain(
        'href="/#/remote/settings?remote=revoked&amp;locale=ko"',
      );
      expect(markup).toContain('aria-label="원격 탐색"');
      expect(markup).toContain("<span>언어</span>");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
