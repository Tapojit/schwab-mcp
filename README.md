# Schwab MCP Server (Read-Only)

A **read-only** [Model Context Protocol](https://modelcontextprotocol.io/) server that connects your Schwab brokerage account to LLM-based applications (Claude Desktop, Claude Code, or other MCP clients) for portfolio monitoring and market data retrieval.

> **Fork Notice**: This project is forked from [jkoelker/schwab-mcp](https://github.com/jkoelker/schwab-mcp) and is a **complete rewrite** in TypeScript. The original project is a Python-based MCP server with trading capabilities and Discord approval workflows. This rewrite strips all trading functionality and focuses exclusively on read-only portfolio monitoring and market analysis.

> **Security**: Following the [principle of least privilege](https://en.wikipedia.org/wiki/Principle_of_least_privilege), all trading, options placement, and order management capabilities have been intentionally removed from this fork. This server is designed exclusively as a read-only portfolio data source — no orders can be placed, modified, or cancelled. Rather than gating trades behind approval workflows, the trading code has been eliminated entirely, so even if an LLM agent is prompt-injected or behaves unexpectedly, it cannot execute trades or modify your account. If you need trading capabilities, see the original project at [jkoelker/schwab-mcp](https://github.com/jkoelker/schwab-mcp).

## Features

- **Market Data**: Real-time quotes, price history (multiple timeframes), market hours, movers, and instrument search.
- **Account Info**: Balances, positions, transactions, and order history (read-only).
- **Technical Analysis**: Optional indicators (SMA, EMA, RSI, MACD, Bollinger Bands, VWAP, ATR, ADX, and more) powered by [technicalindicators](https://www.npmjs.com/package/technicalindicators).
- **LLM Integration**: Built for agentic AI workflows via the MCP protocol.

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v18+ (or [Bun](https://bun.sh/) v1.0+ for development)
- A Schwab brokerage account
- A Schwab Developer App Key (client ID) and Secret (client secret)

#### Obtaining Schwab API Credentials

1. Go to the [Schwab Developer Portal](https://developer.schwab.com/) and sign in (or create an account).
2. Navigate to **Dashboard** → **Apps** → **Create App**.
3. Fill in the app details. Set the **callback URL** to `https://127.0.0.1:8182` (the default used by this server).
4. Once approved, your app page will display the **App Key** (this is your client ID) and **Secret** (this is your client secret).

> **Note**: Schwab may take 1–2 business days to approve new apps. The callback URL you register must match the `--callback-url` flag (default: `https://127.0.0.1:8182`).

### Installation

#### Using npx (recommended)

No installation required — run directly via `npx`:

```bash
npx github:Tapojit/schwab-mcp server
```

#### From source

```bash
git clone https://github.com/Tapojit/schwab-mcp.git
cd schwab-mcp
npm install
npm run build
```

### Save Credentials

Store your App Key and Secret locally so you don't need to pass them every time:

```bash
schwab-mcp save-credentials --client-id YOUR_APP_KEY --client-secret YOUR_APP_SECRET
```

Or set environment variables:
```bash
export SCHWAB_CLIENT_ID=YOUR_APP_KEY
export SCHWAB_CLIENT_SECRET=YOUR_APP_SECRET
```

### Authentication

Generate an OAuth token by logging in to Schwab:

```bash
schwab-mcp auth
```

This opens a browser for Schwab OAuth. A local HTTPS callback server captures the authorization code and exchanges it for access and refresh tokens.

> **Note**: Your browser will warn about an invalid certificate — this is expected. The callback server uses a self-signed TLS certificate for localhost.

### File Storage Paths

All files are stored in a platform-specific data directory with restricted permissions (`0o600` for files, `0o700` for directories):

| File | macOS | Linux |
|------|-------|-------|
| OAuth token | `~/Library/Application Support/schwab-mcp/token.json` | `~/.local/share/schwab-mcp/token.json` |
| Credentials | `~/Library/Application Support/schwab-mcp/credentials.json` | `~/.local/share/schwab-mcp/credentials.json` |

On Linux, the `XDG_DATA_HOME` environment variable is respected if set. On Windows, files are stored under `%APPDATA%\schwab-mcp\`.

You can override the token path with `--token-path <path>`.

> **Token expiry**: OAuth tokens are valid for up to **5 days**. The server checks token age on startup and will prompt you to re-authenticate with `schwab-mcp auth` if the token has expired.

### Running the Server

```bash
schwab-mcp server
```

## Programmatic Usage

This package exports its core modules for use as a library:

```typescript
import { SchwabMCPServer } from "schwab-mcp/server";
import { SchwabClient } from "schwab-mcp/client";
import { TokenManager } from "schwab-mcp/tokens";
import type { OAuthToken, Candle } from "schwab-mcp/types";
```

## Configuration

| Flag | Env Variable | Description |
|------|--------------|-------------|
| `--client-id` | `SCHWAB_CLIENT_ID` | Schwab App Key |
| `--client-secret` | `SCHWAB_CLIENT_SECRET` | Schwab App Secret |
| `--callback-url` | `SCHWAB_CALLBACK_URL` | Redirect URL (default: `https://127.0.0.1:8182`) |
| `--base-url` | `SCHWAB_BASE_URL` | API base URL (default: `https://api.schwabapi.com`) |
| `--token-path` | — | Path to token file (default: platform-specific, see above) |
| `--no-technical-tools` | — | Disable technical analysis tools |

## Available Tools (35 total)

### Utilities (4)
| Tool | Description |
|------|-------------|
| `get_datetime` | Current datetime in Eastern Time |
| `get_market_hours` | Market open/close times for a given date |
| `get_movers` | Top 10 movers for an index (DJI, SPX, NASDAQ, etc.) |
| `get_instruments` | Search instruments by symbol or description |

### Account Info (6)
| Tool | Description |
|------|-------------|
| `get_account_numbers` | Account ID to hash mapping |
| `get_accounts` | Balances for all linked accounts |
| `get_accounts_with_positions` | Balances + positions for all accounts |
| `get_account` | Balance for a specific account |
| `get_account_with_positions` | Balance + positions for a specific account |
| `get_user_preferences` | User display/notification preferences |

### Market Data (9)
| Tool | Description |
|------|-------------|
| `get_quotes` | Real-time quotes for symbols |
| `get_advanced_price_history` | Price history with custom period/frequency |
| `get_price_history_every_minute` | 1-minute OHLCV candles |
| `get_price_history_every_five_minutes` | 5-minute OHLCV candles |
| `get_price_history_every_ten_minutes` | 10-minute OHLCV candles |
| `get_price_history_every_fifteen_minutes` | 15-minute OHLCV candles |
| `get_price_history_every_thirty_minutes` | 30-minute OHLCV candles |
| `get_price_history_every_day` | Daily OHLCV candles |
| `get_price_history_every_week` | Weekly OHLCV candles |

### Orders & Transactions (4, read-only)
| Tool | Description |
|------|-------------|
| `get_order` | Details for a specific order |
| `get_orders` | Order history with status/date filters |
| `get_transactions` | Transaction history (trades, dividends, etc.) |
| `get_transaction` | Details for a specific transaction |

### Technical Analysis (12, optional)
| Tool | Description |
|------|-------------|
| `sma` | Simple Moving Average |
| `ema` | Exponential Moving Average |
| `rsi` | Relative Strength Index |
| `stoch` | Stochastic Oscillator (%K, %D) |
| `macd` | Moving Average Convergence Divergence |
| `atr` | Average True Range |
| `adx` | Average Directional Index |
| `vwap` | Volume Weighted Average Price |
| `pivot_points` | Pivot point support/resistance levels |
| `bollinger_bands` | Bollinger Bands |
| `historical_volatility` | Historical volatility statistics |
| `expected_move` | Option-priced expected move (±1 SD) |

> Disable with `--no-technical-tools` if not needed.

## OpenAPI Specifications

Official Schwab API specs are included in `docs/openapi/` for reference:

- `trader-api.json` — Accounts, Orders, Transactions, User Preferences
- `market-data-api.json` — Quotes, Option Chains, Price History, Movers, Market Hours, Instruments

## MCP Client Configuration

Add this to your MCP client config (e.g., Claude Desktop `claude_desktop_config.json` or Claude Code `settings.json`):

### Using npx (recommended)

```json
{
  "mcpServers": {
    "schwab": {
      "command": "npx",
      "args": ["-y", "github:Tapojit/schwab-mcp", "server"]
    }
  }
}
```

### Using a local clone

```json
{
  "mcpServers": {
    "schwab": {
      "command": "node",
      "args": [
        "/path/to/schwab-mcp/dist/index.js",
        "server"
      ]
    }
  }
}
```

> **Important**: Use full absolute paths for local clones. A bare `"node"` may not resolve in the MCP client's environment — use the full path (e.g., `/usr/local/bin/node`) if needed.

## Development

```bash
git clone https://github.com/Tapojit/schwab-mcp.git
cd schwab-mcp
npm install

# Build
npm run build

# Run tests (requires Bun)
bun test

# Type check
npx tsc --noEmit
```

### MCP Inspector

Test the server interactively with the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector node dist/index.js server
```

## Acknowledgments

This project is a fork of [jkoelker/schwab-mcp](https://github.com/jkoelker/schwab-mcp), originally a Python-based MCP server for Schwab brokerage integration. This version is a **complete rewrite** using:

- **TypeScript** with strict typing (replacing Python type hints)
- **Node.js** as the runtime (replacing Python)
- **Read-only design** — all trading, order placement, and Discord approval workflows have been removed
- **[@modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk)** for MCP protocol integration
- **[technicalindicators](https://www.npmjs.com/package/technicalindicators)** for technical analysis (replacing custom Python implementations)

## License

[MIT](LICENSE)
