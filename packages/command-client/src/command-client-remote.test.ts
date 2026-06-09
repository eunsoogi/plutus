import { describe, expect, it } from "vitest";
import { createCommandClient, createTauriCommandBridge } from "./index";

describe("command client remote commands", () => {
  it("maps remote commands to the Rust DTO and rejects denied authorization", async () => {
    const calls: Array<{ command: string; args?: Record<string, unknown> }> =
      [];
    const bridge = createTauriCommandBridge(
      async <T>(command: string, args?: Record<string, unknown>) => {
        calls.push({ command, args });
        return {
          authorization: {
            success: true,
            permission_granted: true,
            warnings: [],
          },
          data: { ok: true },
        } as T;
      },
    );
    const client = createCommandClient(bridge);

    await expect(
      client.remote.executeCommand({
        commandId: "cmd-remote",
        commandType: "run.start",
        sessionId: "session-1",
        sessionKeyRef: "secure://session-1",
        unlock: {
          method: "biometric",
          sessionKeyRef: "secure://session-1",
          challenge: "sha256:test",
        },
        payload: { portfolioId: "portfolio-1" },
      }),
    ).resolves.toMatchObject({ data: { ok: true } });

    expect(calls[0]).toEqual({
      command: "execute_remote_command",
      args: {
        request: {
          command_id: "cmd-remote",
          session_id: "session-1",
          session_key_ref: "secure://session-1",
          unlock: {
            method: "biometric",
            session_key_ref: "secure://session-1",
            challenge: "sha256:test",
          },
          command_type: "run.start",
          payload: { portfolioId: "portfolio-1" },
        },
      },
    });

    const deniedBridge = createCommandClient(
      createTauriCommandBridge(async <T>() => {
        return {
          authorization: {
            success: false,
            permission_granted: false,
            warnings: ["unlock_required"],
          },
          data: null,
        } as T;
      }),
    );
    await expect(
      deniedBridge.remote.executeCommand({
        commandType: "run.start",
        sessionId: "session-1",
      }),
    ).rejects.toThrow("Remote command denied: unlock_required");

    const malformedBridge = createCommandClient(
      createTauriCommandBridge(async <T>() => ({ ok: true }) as T),
    );
    await expect(
      malformedBridge.remote.executeCommand({
        commandType: "run.start",
        sessionId: "session-1",
      }),
    ).rejects.toThrow("Remote command denied: malformed_authorization");

    const topLevelOnlyBridge = createCommandClient(
      createTauriCommandBridge(async <T>() => {
        return { success: true, permissionGranted: true, data: {} } as T;
      }),
    );
    await expect(
      topLevelOnlyBridge.remote.executeCommand({
        commandType: "run.start",
        sessionId: "session-1",
      }),
    ).rejects.toThrow("Remote command denied: malformed_authorization");
  });
});
