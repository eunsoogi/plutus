import { z } from "zod";

import { Confidence, WarningSchema } from "../common";
import { IsoUtcDateTimeSchema, UuidSchema } from "../ids";

export const TradingProviderId = z.enum([
  "kiwoom",
  "upbit",
  "coinbase",
  "binance",
]);

export const TradingProviderEnvironment = z.enum([
  "mock",
  "sandbox",
  "paper",
  "live",
]);

export const TradingProviderMode = z.enum([
  "disabled",
  "read_only",
  "dry_run",
  "live_requires_approval",
]);

export const TradingProviderPermission = z.enum([
  "market_data",
  "account_read",
  "trade_dry_run",
  "trade_live",
]);

export const TradingProviderHealth = z.enum([
  "connected",
  "degraded",
  "not_configured",
  "blocked",
]);

export const TradingProviderConfigSchema = z.object({
  providerId: TradingProviderId,
  displayName: z.string().min(1),
  market: z.string().min(1),
  region: z.string().min(1),
  environment: TradingProviderEnvironment,
  mode: TradingProviderMode,
  permissions: z.array(TradingProviderPermission).min(1),
  health: TradingProviderHealth,
  lastCheckedAt: IsoUtcDateTimeSchema,
  credentialRef: z
    .string()
    .startsWith("secure://plutus/")
    .nullable()
    .default(null),
  warnings: z.array(WarningSchema).default([]),
});

export const TradingOrderSide = z.enum(["buy", "sell"]);
export const TradingOrderType = z.enum(["market", "limit"]);

export const TradingOrderIntentSchema = z
  .object({
    providerId: TradingProviderId,
    symbol: z.string().min(1),
    side: TradingOrderSide,
    orderType: TradingOrderType,
    quantity: z.number().positive(),
    limitPrice: z.number().positive().optional(),
    quoteCurrency: z.string().min(3).max(6),
    portfolioId: UuidSchema.optional(),
    rationale: z.string().max(2000).default(""),
    liveRequested: z.boolean().default(false),
  })
  .superRefine((intent, context) => {
    if (intent.orderType === "limit" && intent.limitPrice === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Limit orders require limitPrice.",
        path: ["limitPrice"],
      });
    }
  });

export const TradingDecisionAction = z.enum([
  "dry_run_allowed",
  "needs_review",
  "blocked",
  "live_requires_approval",
]);

export const TradingAgentViewSchema = z.object({
  role: z.enum([
    "bull_case",
    "bear_case",
    "risk_manager",
    "execution_specialist",
  ]),
  stance: z.enum(["support", "review", "object"]),
  summary: z.string().min(1),
});

export const TradingDecisionSchema = z.object({
  decisionId: z.string().min(1),
  provider: TradingProviderConfigSchema,
  intent: TradingOrderIntentSchema,
  finalAction: TradingDecisionAction,
  confidence: Confidence,
  agentViews: z.array(TradingAgentViewSchema).min(1),
  blockingReasons: z.array(z.string().min(1)),
  evidenceRefs: z.array(z.string().min(1)),
  warnings: z.array(WarningSchema),
  approvalRequired: z.boolean(),
  createdAt: IsoUtcDateTimeSchema,
});

export const DryRunOrderStatus = z.enum([
  "accepted",
  "blocked",
  "needs_approval",
]);

export const DryRunOrderResultSchema = z.object({
  orderId: z.string().min(1),
  providerId: TradingProviderId,
  status: DryRunOrderStatus,
  liveReady: z.boolean().default(false),
  providerPayload: z.record(z.string(), z.unknown()),
  warnings: z.array(WarningSchema),
  auditRefs: z.array(z.string().min(1)),
  decision: TradingDecisionSchema,
  createdAt: IsoUtcDateTimeSchema,
});

export type TradingProviderId = z.infer<typeof TradingProviderId>;
export type TradingProviderConfigInput = z.input<
  typeof TradingProviderConfigSchema
>;
export type TradingProviderConfig = z.infer<
  typeof TradingProviderConfigSchema
>;
export type TradingProviderPermission = z.infer<
  typeof TradingProviderPermission
>;
export type TradingOrderIntentInput = z.input<typeof TradingOrderIntentSchema>;
export type TradingOrderIntent = z.infer<typeof TradingOrderIntentSchema>;
export type TradingDecision = z.infer<typeof TradingDecisionSchema>;
export type DryRunOrderResult = z.infer<typeof DryRunOrderResultSchema>;
