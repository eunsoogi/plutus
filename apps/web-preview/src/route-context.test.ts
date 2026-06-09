import { describe, expect, it } from "vitest";
import { routeContextFromLocation } from "./route-context";

describe("routeContextFromLocation", () => {
  it("normalizes the packaged Tauri app origin to the host dashboard", () => {
    const context = routeContextFromLocation({
      href: "tauri://localhost",
    });

    expect(context.path).toBe("/");
    expect(context.remote).toBe("connected");
  });

  it("preserves explicit routes and remote visual states", () => {
    const context = routeContextFromLocation({
      href: "tauri://localhost/remote/dashboard?state=revoked",
    });

    expect(context.path).toBe("/remote/dashboard");
    expect(context.remote).toBe("revoked");
  });

  it("prefers packaged hash routes over the root bundle path", () => {
    const context = routeContextFromLocation({
      href: "tauri://localhost/#/settings/providers?state=stale",
    });

    expect(context.path).toBe("/settings/providers");
    expect(context.remote).toBe("stale");
  });
});
