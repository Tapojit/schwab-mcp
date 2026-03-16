# Repository Guidelines

## Project Structure

```
ts/                           # Bun + TypeScript MCP server
  src/
    index.ts                  # CLI entry point (commander)
    server.ts                 # SchwabMCPServer class, MCP SDK integration
    client.ts                 # SchwabClient — authenticated fetch wrapper
    auth.ts                   # OAuth2 browser flow (local HTTPS callback)
    tokens.ts                 # Token load/save/refresh, credentials management
    resources.ts              # MCP resource definitions (order statuses)
    types.ts                  # TypeScript types from OpenAPI schemas
    tools/
      index.ts                # registerTools() aggregator
      utils.ts                # Shared helpers (date parsing, formatResult)
      market.ts               # get_datetime, get_market_hours, get_movers, get_instruments
      accounts.ts             # Account and preferences tools (6 tools)
      quotes.ts               # get_quotes
      history.ts              # Price history tools (8 tools, factory pattern)
      orders.ts               # get_order, get_orders (multi-status merge)
      transactions.ts         # get_transactions, get_transaction
      technical.ts            # 12 TA indicators via technicalindicators
  tests/
    setup.ts                  # makeMockClient() factory
    *.test.ts                 # Mirror source structure
    tools/*.test.ts           # Tool-specific tests
  package.json
  tsconfig.json
docs/
  openapi/                    # Schwab API OpenAPI 3.x specifications
```

## Important: Read-Only Server

This is a **read-only** fork. All trading, order placement, order cancellation,
options tools, approval workflows, and Discord integration have been removed.
Every registered tool has `readOnlyHint: true`. Do not add write operations.

## Build, Test, and Development Commands

```bash
# Install dependencies
cd ts && bun install

# Run the CLI
bun run src/index.ts --help
bun run src/index.ts server --help

# Type checking
bun run typecheck    # or: tsc --noEmit

# Run full test suite
bun test

# Run a single test file
bun test tests/tools/market.test.ts

# Run tests matching a pattern
bun test --grep "get_order"

# Build standalone binary
bun build src/index.ts --compile --outfile schwab-mcp

# Combined check before commit
tsc --noEmit && bun test

# MCP Inspector
npx @modelcontextprotocol/inspector bun run src/index.ts server
```

## Code Style & Formatting

### Runtime and Imports
- Runtime: Bun 1.0+
- Target: ES2022, strict mode, `nodenext` module resolution
- Use `node:` prefix for Node.js built-ins (e.g., `import { join } from "node:path"`)
- Use explicit `.js` extensions in relative imports (required by nodenext)
- Group imports: node builtins, third-party, local

```typescript
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { SchwabClient } from "../client.js";
import { formatResult } from "./utils.js";
```

### Type Annotations
- All function signatures must be typed
- Use Zod schemas for MCP tool parameter validation
- Use `SchwabAPIError` class for API failures (defined in `types.ts`)
- Interfaces from OpenAPI schemas live in `types.ts`
- TypeScript strict mode is enabled — no implicit any

```typescript
export function register(server: McpServer, client: SchwabClient): void {
  server.tool(
    "get_movers",
    "Get top 10 movers for a market index",
    {
      index: z.string().describe("Index: DJI, SPX, NASDAQ, NYSE, COMPX"),
      sort: z.string().optional().describe("Sort by: VOLUME, TRADES, PERCENT_CHANGE_UP/DOWN"),
    },
    async ({ index, sort }) => {
      const data = await client.getMovers(index, sort);
      return { content: [{ type: "text", text: formatResult(data) }] };
    },
  );
}
```

### Naming Conventions
- Module files: `camelCase.ts` (e.g., `accounts.ts`, `utils.ts`)
- Classes: `PascalCase` (e.g., `SchwabClient`, `SchwabMCPServer`)
- Functions/methods: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Tool names: `snake_case` matching Schwab API (e.g., `get_market_hours`)
- Interfaces/types: `PascalCase` (e.g., `OAuthToken`, `CandleList`)

### Error Handling
- Use `SchwabAPIError` for API failures
- Throw `Error` with descriptive messages for invalid parameters
- The `SchwabClient.request()` method auto-retries on 401 (token refresh)
- Let unexpected exceptions propagate (don't catch-all)

### Tool Registration Pattern
Each tool file exports a `register(server, client)` function:

```typescript
export function register(server: McpServer, client: SchwabClient): void {
  server.tool("tool_name", "description", zodSchema, handler, {
    annotations: { readOnlyHint: true },
  });
}
```

## Testing Guidelines

### Test File Organization
- Use `bun:test` (built-in test runner)
- Name test files `<module>.test.ts` in `tests/` or `tests/tools/`
- Use `describe`/`test` blocks from `bun:test`

### Mock Client Pattern
```typescript
// tests/setup.ts
export function makeMockClient(overrides: Record<string, any> = {}) {
  return {
    getAccountNumbers: async () => [{ accountNumber: "123", hashValue: "abc" }],
    getAccounts: async () => [{ securitiesAccount: { accountNumber: "123" } }],
    // ... defaults for all methods
    ...overrides,
  };
}
```

### Test Example
```typescript
import { describe, test, expect } from "bun:test";
import { makeMockClient } from "../setup.js";

describe("get_accounts", () => {
  test("returns account data", async () => {
    const client = makeMockClient({
      getAccounts: async () => [{ securitiesAccount: { balance: 1000 } }],
    });
    // ... invoke tool handler, assert result
  });
});
```

## Security & Configuration

- Store credentials via env vars or `schwab-mcp save-credentials --client-id ... --client-secret ...`
- Required: `SCHWAB_CLIENT_ID`, `SCHWAB_CLIENT_SECRET`
- Token stored at platform-specific path (macOS: `~/Library/Application Support/schwab-mcp/token.json`)
- Credentials file permissions set to 0o600
- Never commit tokens or credentials
- OAuth callback uses self-signed TLS cert generated at runtime via openssl

## Commit Message Format

Follow Linux kernel style with conventional commits:

### Subject Line (50 chars max, 72 absolute max)
- Imperative mood: "Add feature" not "Added feature"
- Format: `type(scope): description`
- Types: `fix`, `feat`, `chore`, `refactor`, `test`, `perf`, `docs`
- Scopes: `tools`, `cli`, `server`, `auth`, `deps`
- No period at end

### Body (wrap at 72 chars)
- Explain *what* and *why*, not *how*
- Use prose, not bullet points
- Reference issues at the bottom

### Examples
```
feat(tools): add advanced price history timeframe

Price history tools previously only supported daily and weekly candles.
Users need finer-grained data for intraday analysis.

Add get_price_history_every_minute through every_thirty_minutes tools.

Closes #42
```

```
fix(auth): delay server shutdown so success page reaches the browser

The callback server was stopping immediately after exchanging the auth
code, before the HTTP response could be delivered to the browser.
```
