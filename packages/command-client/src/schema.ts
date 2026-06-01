import { z } from "zod";

export const AllowedCommandSchema = z.enum([
  "app.getSnapshot",
  "portfolios.list",
  "portfolios.create",
  "portfolios.getSnapshot",
  "portfolios.addPosition",
  "portfolios.updatePosition",
  "portfolios.updatePositionThesis",
  "watchlists.list",
  "watchlists.create",
  "watchlists.addItem",
  "watchlists.updateItem",
  "researchRuns.start",
  "researchRuns.get",
  "researchRuns.cancel",
  "artifacts.get",
  "artifacts.openLocalFile",
  "memory.listActivity",
  "memory.update",
  "memory.archive",
  "memory.forget",
  "memory.setCategoryEnabled",
  "wiki.listPages",
  "wiki.getPage",
  "wiki.listActivity",
  "wiki.revertRevision",
  "providers.list",
  "providers.save",
  "trading.previewDecision",
  "trading.submitDryRunOrder",
  "remote.prepareUnlock",
  "remote.executeCommand",
]);

export const CommandEnvelopeSchema = z.object({
  command: AllowedCommandSchema,
  args: z.array(z.unknown()).default([]),
});

export type CommandName = z.infer<typeof AllowedCommandSchema>;
export type CommandEnvelope = z.infer<typeof CommandEnvelopeSchema>;
export type CommandBridge = <T = unknown>(
  envelope: CommandEnvelope,
) => Promise<T>;
export type TauriInvoke = <T = unknown>(
  command: string,
  args?: Record<string, unknown>,
) => Promise<T>;
