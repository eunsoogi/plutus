import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@plutus/domain": new URL(
        "../../packages/domain/src/index.ts",
        import.meta.url,
      ).pathname,
    },
  },
  server: {
    host: "127.0.0.1",
    port: 4173,
  },
});
