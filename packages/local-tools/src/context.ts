import { z } from "zod";

export const localToolRunContextSchema = z.object({
  runId: z.string(),
  profileId: z.string(),
  agentName: z.string(),
  selectedTeam: z.string(),
  allowedNamespaces: z.array(z.string()),
  allowedTools: z.array(z.string()),
  writeScopes: z.array(z.string()),
  appDataPath: z.string().optional(),
});

export type LocalToolRunContext = z.infer<typeof localToolRunContextSchema>;

export interface LocalToolCall {
  namespace: string;
  tool: string;
  input: unknown;
}
