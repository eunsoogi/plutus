import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const r = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@plutus/agents": r("./packages/agents/src/index.ts"),
      "@plutus/backtest": r("./packages/backtest/src/index.ts"),
      "@plutus/command-client": r("./packages/command-client/src/index.ts"),
      "@plutus/data": r("./packages/data/src/index.ts"),
      "@plutus/domain": r("./packages/domain/src/index.ts"),
      "@plutus/local-mcp-adapter": r(
        "./packages/local-mcp-adapter/src/index.ts",
      ),
      "@plutus/local-tools": r("./packages/local-tools/src/index.ts"),
      "@plutus/memory": r("./packages/memory/src/index.ts"),
      "@plutus/remote-control": r("./packages/remote-control/src/index.ts"),
      "@plutus/test-fixtures": r("./packages/test-fixtures/src/index.ts"),
      "@plutus/ui": r("./packages/ui/src/index.ts"),
      "@plutus/wiki": r("./packages/wiki/src/index.ts"),
    },
  },
  test: {
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts"],
    globals: true,
  },
});
