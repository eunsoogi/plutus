import { describe, expect, it } from "vitest";
import {
  formatCurrency,
  normalizeLocale,
  remoteStateLabel,
  resolveLocale,
  riskToneForCategory,
  translate,
} from "./index";
import { slotFor } from "./orchestrator-office-scene-data";
import { teamSpecialists } from "./orchestrator-office-teams";

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

  it("assigns each selected specialist a unique office slot", () => {
    for (const specialists of Object.values(teamSpecialists)) {
      const slotClasses = specialists.map(
        (_, index) => slotFor(index).slotClass,
      );
      expect(new Set(slotClasses).size).toBe(slotClasses.length);
    }
  });
});
