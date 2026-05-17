import { describe, expect, it } from "vitest";
import { formatCurrency, remoteStateLabel, riskToneForCategory } from "./index";

describe("ui helpers", () => {
  it("formats compact financial values and risk states used by the preview", () => {
    expect(formatCurrency(184250, "USD")).toBe("$184,250");
    expect(riskToneForCategory("risk_warning")).toBe("danger");
    expect(remoteStateLabel("stale")).toBe("Stale snapshot");
  });
});
