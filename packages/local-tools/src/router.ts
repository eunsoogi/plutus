import {
  AGENT_ALLOWLISTS,
  NAMESPACE_NAMES,
  WRITE_TOOLS,
} from "./authz/agent-allowlists";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { InMemoryToolRuntime } from "./audit/in-memory-audit";
import { createInMemoryToolRuntime } from "./audit/in-memory-audit";
import type { LocalToolCall, LocalToolRunContext } from "./context";
import type { LocalToolResponse, LocalToolWarning } from "./schemas/envelope";
import { localToolResponseSchema } from "./schemas/envelope";
import { handleBacktest } from "./namespaces/backtest";
import { handleGeneric } from "./namespaces/generic";
import { handleMarketData } from "./namespaces/market-data";
import { handleMemory } from "./namespaces/memory";
import { handlePortfolio } from "./namespaces/portfolio";
import { handleReports } from "./namespaces/reports";
import { handleResearch } from "./namespaces/research";
import { handleRisk } from "./namespaces/risk";
import { handleWiki } from "./namespaces/wiki";

const handlers = {
  plutus_backtest: handleBacktest,
  plutus_market_data: handleMarketData,
  plutus_portfolio: handlePortfolio,
  plutus_risk: handleRisk,
  plutus_reports: handleReports,
  plutus_research: handleResearch,
  plutus_memory: handleMemory,
  plutus_wiki: handleWiki,
  plutus_audit: handleGeneric,
};

export class LocalToolRouter {
  constructor(
    private readonly runtime: InMemoryToolRuntime = createInMemoryToolRuntime(),
  ) {}

  get auditEvents() {
    return this.runtime.auditEvents;
  }

  async call(
    context: LocalToolRunContext,
    call: LocalToolCall,
  ): Promise<LocalToolResponse> {
    const rejection = this.authorize(context, call);
    if (rejection) {
      const auditRef = this.runtime.log(
        context,
        call,
        "rejected",
        rejection.code,
      );
      return this.failure(auditRef, rejection);
    }

    const auditRef = this.runtime.log(context, call, "accepted");
    try {
      const handler = handlers[call.namespace as keyof typeof handlers];
      const response = await handler({
        context,
        call,
        runtime: this.runtime,
        auditRef,
      });
      return localToolResponseSchema.parse(response);
    } catch {
      return this.failure(auditRef, {
        code: "tool_execution_failed",
        severity: "blocking",
        message:
          "Local tool failed without exposing stack traces to the agent.",
        evidenceRefs: [],
      });
    }
  }

  private authorize(
    context: LocalToolRunContext,
    call: LocalToolCall,
  ): LocalToolWarning | undefined {
    const agentAllowlist = AGENT_ALLOWLISTS[context.agentName];
    const toolName = `${call.namespace}.${call.tool}`;

    if (!agentAllowlist) {
      return {
        code: "unknown_agent",
        severity: "blocking",
        message: `Agent ${context.agentName} is not registered for local tool access.`,
        evidenceRefs: [],
      };
    }

    if (
      !NAMESPACE_NAMES.includes(
        call.namespace as (typeof NAMESPACE_NAMES)[number],
      )
    ) {
      return {
        code: "unknown_namespace",
        severity: "blocking",
        message: `Namespace ${call.namespace} is not part of the local Plutus tool surface.`,
        evidenceRefs: [],
      };
    }

    if (
      !context.allowedNamespaces.includes(call.namespace) ||
      !agentAllowlist.allowedNamespaces.includes(call.namespace)
    ) {
      return {
        code: "namespace_not_allowed",
        severity: "blocking",
        message: `${context.agentName} cannot call namespace ${call.namespace}.`,
        evidenceRefs: [],
      };
    }

    if (
      !context.allowedTools.includes(toolName) ||
      !agentAllowlist.allowedTools.includes(toolName)
    ) {
      return {
        code: "tool_not_allowed",
        severity: "blocking",
        message: `${context.agentName} cannot call tool ${toolName}.`,
        evidenceRefs: [],
      };
    }

    if (
      WRITE_TOOLS.has(toolName) &&
      (!agentAllowlist.writeTools.includes(toolName) ||
        !context.writeScopes.includes(toolName))
    ) {
      return {
        code: "write_scope_required",
        severity: "blocking",
        message: `${toolName} requires an explicit write scope for this run.`,
        evidenceRefs: [],
      };
    }

    if (containsForeignProfile(call.input, context.profileId)) {
      return {
        code: "cross_profile_rejected",
        severity: "blocking",
        message:
          "Local tools cannot access portfolio or run data outside the active profile.",
        evidenceRefs: [],
      };
    }

    if (containsForeignPortfolio(call.input, context)) {
      return {
        code: "cross_profile_denied",
        severity: "blocking",
        message:
          "Portfolio tools cannot access a portfolio outside the active local profile.",
        evidenceRefs: [],
      };
    }

    return undefined;
  }

  private failure(
    auditRef: string,
    warning: LocalToolWarning,
  ): LocalToolResponse {
    return {
      ok: false,
      sourceRefs: [],
      warnings: [warning],
      auditRef,
    };
  }
}

function containsForeignProfile(
  value: unknown,
  activeProfileId: string,
): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }
  if (
    "profileId" in value &&
    typeof value.profileId === "string" &&
    value.profileId !== activeProfileId
  ) {
    return true;
  }
  return Object.values(value).some((nested) =>
    containsForeignProfile(nested, activeProfileId),
  );
}

function containsForeignPortfolio(
  value: unknown,
  context: LocalToolRunContext,
): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }
  if (
    "portfolioId" in value &&
    typeof value.portfolioId === "string" &&
    !allowedPortfolioIds(context).has(value.portfolioId)
  ) {
    return true;
  }
  return Object.values(value).some((nested) =>
    containsForeignPortfolio(nested, context),
  );
}

function allowedPortfolioIds(context: LocalToolRunContext): Set<string> {
  const ids = new Set([
    "018f3f5d-0000-7000-8000-000000000002",
    "018f3f5d-0000-7000-8000-000000000202",
  ]);
  if (!context.appDataPath) return ids;
  const statePath = join(
    context.appDataPath,
    "local-tools",
    "portfolio-state.json",
  );
  if (!existsSync(statePath)) return ids;
  try {
    const state = JSON.parse(readFileSync(statePath, "utf8")) as {
      profileId?: string;
      portfolios?: Array<{ id?: string }>;
    };
    if (state.profileId !== context.profileId) return ids;
    for (const portfolio of state.portfolios ?? []) {
      if (portfolio.id) ids.add(portfolio.id);
    }
  } catch {
    return ids;
  }
  return ids;
}
