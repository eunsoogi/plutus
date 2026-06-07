import { createRequire } from "node:module";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import {
  formatCurrency,
  normalizeLocale,
  remoteStateLabel,
  resolveLocale,
  riskToneForCategory,
  translate,
} from "./index";
import { officeCopy } from "./orchestrator-office-copy";
import { sceneStageLabel } from "./orchestrator-office";
import { OrchestratorOfficeScene } from "./orchestrator-office-scene";
import { slotFor } from "./orchestrator-office-scene-data";
import { teamSpecialists } from "./orchestrator-office-teams";

const require = createRequire(import.meta.url);
const { renderToStaticMarkup } = require("react-dom/server");

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

  it("keeps Korean office stage labels localized without raw run statuses", () => {
    expect(sceneStageLabel("계획", "queued")).toBe("계획");
    expect(sceneStageLabel("계획", "ready")).toBe("계획");
    expect(sceneStageLabel("완료", "completed")).toBe("완료");
  });

  it("localizes office station labels in Korean scenes", () => {
    const koreanOffice = officeCopy.ko;
    const markup = renderToStaticMarkup(
      createElement(OrchestratorOfficeScene, {
        orchestratorLabel: koreanOffice.orchestrator,
        specialistLabels: koreanOffice.specialist,
        specialists: teamSpecialists.portfolio_review_committee,
        stage: koreanOffice.stage.planning,
        stationLabels: koreanOffice.station,
      }),
    );

    expect(markup).toContain("시장 데스크");
    expect(markup).toContain("전략 보드");
    expect(markup).toContain("리스크 테이블");
    expect(markup).toContain("지휘 테이블");
    expect(markup).not.toContain("Market desk");
    expect(markup).not.toContain("Strategy board");
    expect(markup).not.toContain("Risk table");
    expect(markup).not.toContain("Command table");
  });
});
