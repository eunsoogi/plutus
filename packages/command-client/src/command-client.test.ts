import { describe, expect, it } from "vitest";
import {
  CommandEnvelopeSchema,
  redactCommandLog,
} from "./index";

describe("command client", () => {
  it("rejects malformed command envelopes and redacts secret-like fields from logs", () => {
    expect(() =>
      CommandEnvelopeSchema.parse({
        command: "providers.setApiKey",
        args: [{ apiKey: "raw-secret" }],
      }),
    ).toThrow();

    expect(
      redactCommandLog({
        command: "providers.save",
        args: [
          { apiKey: "sk-live", authorization: "Bearer token", note: "keep" },
        ],
      }),
    ).toEqual({
      command: "providers.save",
      args: [
        { apiKey: "[REDACTED]", authorization: "[REDACTED]", note: "keep" },
      ],
    });
  });

});
