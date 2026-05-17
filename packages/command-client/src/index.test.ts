import { describe, expect, it } from "vitest";
import { FixtureCommandClient } from "./index";

describe("command client", () => {
  it("exposes typed portfolio, watchlist, run, and artifact commands without secrets", async () => {
    const client = new FixtureCommandClient();
    expect((await client.portfolios.list())[0]?.name).toBe("Core");
    expect((await client.watchlists.list())[0]?.name).toContain("Watchlist");
    expect(
      (await client.researchRuns.start({ userRequest: "review" })).selectedTeam,
    ).toBe("portfolio_review_committee");
    expect(JSON.stringify(await client.artifacts.get("artifact"))).not.toMatch(
      /secret|api_key|password/i,
    );
  });
});
