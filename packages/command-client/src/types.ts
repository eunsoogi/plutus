export type AnyRecord = Record<string, unknown>;

export interface Portfolio {
  id: string;
  name: string;
  baseCurrency: string;
  positions?: Array<{
    id: string;
    symbol: string;
    name?: string;
    thesis: string;
    quantity?: number;
    averageCost?: number;
    costCurrency?: string;
  }>;
}

export interface Watchlist {
  id: string;
  name: string;
  items: Array<{ id: string; symbol: string; triggerNote: string }>;
}

export interface ResearchRun {
  id: string;
  status: string;
  portfolioId: string | null;
  selectedTeam?: string;
  thesis?: string;
  confidence?: string;
  finalCard?: Record<string, unknown>;
}

export interface AgentArtifact {
  id: string;
  title: string;
  type: string;
  researchRunId?: string | null;
}

export interface RemoteUnlockPrepared {
  sessionId: string;
  sessionKeyRef: string;
  unlockProof: {
    method: string;
    sessionKeyRef: string;
    challenge?: string;
  };
}

export type TradingProviderId = string;

export interface TradingProviderConfig {
  providerId: TradingProviderId;
  displayName: string;
  market: string;
  region: string;
  environment: "mock" | "sandbox" | "paper" | "live";
  mode: "disabled" | "read_only" | "dry_run" | "live_requires_approval";
  permissions: readonly string[];
  health: "connected" | "degraded" | "not_configured" | "blocked";
  lastCheckedAt: string;
  credentialRef: string | null;
  warnings: readonly {
    code: string;
    severity: "info" | "warning" | "blocking";
    message: string;
  }[];
}

export interface TradingOrderIntent {
  providerId: TradingProviderId;
  symbol: string;
  side: "buy" | "sell";
  orderType: "market" | "limit";
  quantity: number;
  limitPrice?: number;
  quoteCurrency: string;
  rationale?: string;
  liveRequested?: boolean;
}

export interface TradingDecision {
  decisionId: string;
  provider: TradingProviderConfig;
  intent: TradingOrderIntent;
  finalAction:
    | "dry_run_allowed"
    | "needs_review"
    | "blocked"
    | "live_requires_approval";
  confidence: "low" | "medium" | "high";
  agentViews: readonly {
    role: string;
    stance: string;
    summary: string;
  }[];
  blockingReasons: readonly string[];
  evidenceRefs: readonly string[];
  warnings: TradingProviderConfig["warnings"];
  approvalRequired: boolean;
  createdAt: string;
}

export interface DryRunOrderResult {
  orderId: string;
  providerId: TradingProviderId;
  status: "accepted" | "blocked" | "needs_approval";
  liveReady: boolean;
  providerPayload: Record<string, unknown>;
  warnings: TradingProviderConfig["warnings"];
  auditRefs: readonly string[];
  decision: TradingDecision;
  createdAt: string;
}

export interface AppSnapshot {
  profileId: string;
  portfolios: Portfolio[];
  watchlists: Watchlist[];
  runs: Array<ResearchRun & { title?: string; category?: string }>;
  artifacts: AgentArtifact[];
  memoryActivity: AnyRecord[];
  wikiPages: AnyRecord[];
  remoteDevices: AnyRecord[];
  tradingProviders?: TradingProviderConfig[];
  tradingDecisions?: TradingDecision[];
  dryRunOrders?: DryRunOrderResult[];
}
