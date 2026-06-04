# Development

## Requirements

- Node.js `>=22.13`
- pnpm `11.0.0`
- Rust and the Tauri development toolchain

## Install And Run

```bash
pnpm install
pnpm dev:web
```

Run the macOS app:

```bash
pnpm dev:tauri
```

Run every package's development task through Turbo:

```bash
pnpm dev
```

## Common Verification

```bash
pnpm typecheck
pnpm test:unit
pnpm test:e2e:ui
pnpm --filter @plutus/tauri tauri build
```

The broader acceptance flow is:

```bash
pnpm test:acceptance
```

## Script Reference

| Command                 | Purpose                                                    |
| ----------------------- | ---------------------------------------------------------- |
| `pnpm build`            | Run workspace build tasks through Turbo.                   |
| `pnpm lint`             | Run workspace lint tasks through Turbo.                    |
| `pnpm test`             | Run workspace test tasks through Turbo.                    |
| `pnpm test:integration` | Run integration tests.                                     |
| `pnpm test:e2e`         | Run the full Playwright suite.                             |
| `pnpm test:mcp`         | Run local MCP adapter tests.                               |
| `pnpm test:agent`       | Run agent integration tests.                               |
| `pnpm test:persistence` | Run Tauri persistence tests.                               |
| `pnpm test:commands`    | Run Tauri command and command-client contract tests.       |
| `pnpm test:remote`      | Run remote-control package and Tauri remote-control tests. |
| `pnpm test:tauri`       | Run Tauri-specific tests.                                  |
| `pnpm format:check`     | Check formatting with Prettier.                            |

## Dependency Policy

If `pnpm add` fails because registry metadata lacks `time`, the repo is enforcing its minimum release-age policy. Use command-scoped overrides only when necessary and pin the exact dependency version.
