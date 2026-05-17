import type { NamespaceHandler } from "./common";
import { ok, warning } from "./common";

export const handleReports: NamespaceHandler = ({
  call,
  context,
  runtime,
  auditRef,
}) => {
  if (call.tool === "create_run_card") {
    const payload =
      (call.input as { payload?: Record<string, unknown> }).payload ?? {};
    const category = payload.category;
    if (category !== "risk_warning" && category !== "no_action") {
      return ok(auditRef, "plutus_reports", undefined, [
        warning(
          "unsafe_final_category",
          "blocking",
          "Final run cards must use an allowed safety category.",
        ),
      ]);
    }
    const card = {
      runId: context.runId,
      profileId: context.profileId,
      ...payload,
    };
    runtime.records.set(`run_card_${context.runId}`, card);
    return ok(auditRef, "plutus_reports", card, [
      warning(
        "risk_caveat_required",
        "info",
        "Risk caveats and assumptions must remain visible.",
      ),
    ]);
  }

  if (call.tool === "create_mobile_summary") {
    const summary = {
      runId: context.runId,
      profileId: context.profileId,
      ...(call.input as object),
    };
    runtime.records.set(`mobile_summary_${context.runId}`, summary);
    return ok(auditRef, "plutus_reports", summary);
  }

  return ok(auditRef, "plutus_reports", { tool: call.tool, status: "stored" });
};
