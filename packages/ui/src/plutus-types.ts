import type { ReactNode } from "react";

import type {
  DryRunOrderResult,
  TradingDecision,
  TradingOrderIntent,
  TradingProviderConfig,
} from "./provider-settings-types";

export type RouteKind = "host" | "remote";

export type PlutusScenario = {
  profileId?: string;
  portfolio: {
    id: string;
    name: string;
    value: number;
    positions: {
      id?: string;
      symbol: string;
      name: string;
      value: number;
      allocation: string;
      thesis: string;
    }[];
  };
  watchlist: {
    id: string;
    name: string;
    items: {
      id?: string;
      symbol: string;
      triggerNote?: string;
    }[];
  };
  instrument: {
    id: string;
    symbol: string;
    name: string;
    summary: string;
  };
  run: {
    id: string;
    title: string;
    status: string;
    category: string;
    confidence?: string;
    selectedTeam?: string;
    finalCard?: {
      selectedTeam?: string;
      summary?: string;
      supportingEvidence?: Array<{ label?: string; sourceRef?: string }>;
      riskChecklist?: Array<{ check?: string; status?: string }>;
      limitations?: string[];
      nextActions?: string[];
    };
    artifacts: {
      id: string;
      name: string;
      type: string;
    }[];
  };
  memory: {
    id: string;
    summary: string;
    activity: string;
  };
  wiki: {
    id: string;
    title: string;
    revision: string;
    sourceRef: string;
    diffBody?: string;
  };
  remoteDevice: {
    name: string;
    pairingCode: string;
    sessionId?: string;
    sessionKeyRef?: string;
    unlockProof?: {
      method: string;
      sessionKeyRef: string;
      challenge?: string;
    };
  };
};

export type HostShellProps = {
  children: ReactNode;
};

export type PlutusCommandClient = {
  app?: {
    getSnapshot: () => Promise<unknown>;
  };
  portfolios?: {
    create: (input: {
      profileId?: string;
      name: string;
      baseCurrency: string;
      benchmarkId?: string | null;
      riskProfile?: Record<string, unknown>;
    }) => Promise<{ id?: string; name?: string }>;
    addPosition?: (input: {
      profileId?: string;
      portfolioId: string;
      symbol: string;
      quantity: number;
      averageCost: number;
      costCurrency: string;
      thesis?: string;
    }) => Promise<Record<string, unknown>>;
    syncFromProvider?: (input: {
      profileId?: string;
      providerId: string;
      portfolioId?: string;
      portfolioName?: string;
      baseCurrency?: string;
    }) => Promise<{
      importedCount: number;
      portfolioId: string;
      providerId: string;
      skippedCount: number;
      positionSymbols: readonly string[];
    }>;
    updatePositionThesis?: (input: {
      positionId: string;
      profileId?: string;
      thesis: string;
    }) => Promise<Record<string, unknown>>;
  };
  watchlists?: {
    updateItem: (input: {
      itemId: string;
      profileId?: string;
      triggerNote?: string;
      targetZone?: string;
    }) => Promise<Record<string, unknown>>;
  };
  providers?: {
    list: () => Promise<TradingProviderConfig[]>;
    save: (input: TradingProviderConfig) => Promise<TradingProviderConfig>;
  };
  trading?: {
    previewDecision: (input: {
      provider: TradingProviderConfig;
      intent: TradingOrderIntent;
    }) => Promise<TradingDecision>;
    submitDryRunOrder: (input: {
      provider: TradingProviderConfig;
      intent: TradingOrderIntent;
      decision?: TradingDecision;
    }) => Promise<DryRunOrderResult>;
  };
  researchRuns: {
    start: (input: {
      portfolioId?: string;
      profileId?: string;
      symbols?: string[];
      selectedTeam?: string;
      userRequest?: string;
    }) => Promise<{ id?: string; status?: string }>;
  };
  artifacts: {
    get: (
      artifactId: string,
      input?: { profileId?: string; runId?: string },
    ) => Promise<{
      id?: string;
      name?: string;
      title?: string;
      type?: string;
    }>;
  };
  memory?: {
    update: (
      memoryId: string,
      patch: Record<string, unknown>,
      input?: { profileId?: string },
    ) => Promise<Record<string, unknown>>;
    archive: (
      memoryId: string,
      reason: string,
      input?: { profileId?: string },
    ) => Promise<void>;
    forget: (memoryId: string, input?: { profileId?: string }) => Promise<void>;
    setCategoryEnabled: (category: string, enabled: boolean) => Promise<void>;
  };
  wiki?: {
    revertRevision: (
      pageId: string,
      revisionId: string,
      reason: string,
    ) => Promise<Record<string, unknown>>;
  };
  remote?: {
    prepareUnlock?: (input: {
      commandId: string;
      commandType: string;
      payload: Record<string, unknown>;
    }) => Promise<{
      sessionId: string;
      sessionKeyRef: string;
      unlockProof: {
        method: string;
        sessionKeyRef: string;
        challenge?: string;
      };
    }>;
    executeCommand: (input: {
      commandId?: string;
      sessionId?: string;
      sessionKeyRef?: string;
      commandType: string;
      payload?: Record<string, unknown>;
      unlock?: Record<string, unknown> | null;
    }) => Promise<Record<string, unknown>>;
  };
};
