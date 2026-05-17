import type { NamespaceHandler } from "./common";
import { ok, warning } from "./common";

export const handleRisk: NamespaceHandler = ({
  call,
  context,
  runtime,
  auditRef,
}) => {
  if (call.tool === "register_risk_veto") {
    const veto = {
      runId: context.runId,
      profileId: context.profileId,
      ...(call.input as object),
    };
    runtime.records.set(`risk_veto_${context.runId}`, veto);
    return ok(auditRef, "plutus_risk", veto, [
      warning(
        "risk_veto_registered",
        "blocking",
        "Risk veto was durably recorded.",
      ),
    ]);
  }

  return ok(auditRef, "plutus_risk", { tool: call.tool, status: "computed" });
};
