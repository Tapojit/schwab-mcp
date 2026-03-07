# Schwab MCP Server (Read-Only)

A **read-only** [Model Context Protocol](https://modelcontextprotocol.io/) server that connects your Schwab brokerage account to LLM-based applications (Claude Desktop, Claude Code, or other MCP clients) for portfolio monitoring and market data retrieval.

> **This fork has been stripped of all trading, options placement, and order management capabilities.** It is designed exclusively as a portfolio data source — no orders can be placed, modified, or cancelled through this server.

## Features

- **Market Data**: Real-time quotes, price history (multiple timeframes), market hours, movers, and instrument search.
- **Account Info**: Balances, positions, transactions, and order history (read-only).
- **Technical Analysis**: Optional indicators (SMA, EMA, RSI, MACD, Bollinger Bands, VWAP, ATR, ADX, and more) powered by pandas-ta.
- **LLM Integration**: Built for agentic AI workflows via the MCP protocol.

## Quick Start

### Prerequisites

- Python 3.10+
- [uv](https://github.com/astral-sh/uv) (recommended) or `pip`
- Schwab Developer App Key and Secret ([Schwab Developer Portal](https://developer.schwab.com/))

### Installation

```bash
# Using uv (recommended)
uv tool install git+https://github.com/Tapojit/schwab-mcp.git

# Using pip
pip install git+https://github.com/Tapojit/schwab-mcp.git
```

### Save Credentials

```bash
schwab-mcp save-credentials
# Prompts for Client ID and Client Secret, saves to local config
```

Or set environment variables:
```bash
export SCHWAB_CLIENT_ID=YOUR_KEY
export SCHWAB_CLIENT_SECRET=YOUR_SECRET
```

### Authentication

Generate a token file by logging in to Schwab:

```bash
schwab-mcp auth
```

This opens a browser for Schwab OAuth. The token is saved to `~/.local/share/schwab-mcp/token.yaml`.

### Running the Server

```bash
schwab-mcp server
```

## Configuration

| Flag | Env Variable | Description |
|------|--------------|-------------|
| `--client-id` | `SCHWAB_CLIENT_ID` | Schwab App Key |
| `--client-secret` | `SCHWAB_CLIENT_SECRET` | Schwab App Secret |
| `--callback-url` | `SCHWAB_CALLBACK_URL` | Redirect URL (default: `https://127.0.0.1:8182`) |
| `--token-path` | — | Path to token file (default: `~/.local/share/schwab-mcp/token.yaml`) |
| `--no-technical-tools` | — | Disable technical analysis tools |
| `--json` | — | Return raw JSON instead of Toon-encoded strings |

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

> Technical analysis tools require `pandas` and `pandas-ta-classic`. Install with: `uv sync --group ta`

## OpenAPI Specifications

Official Schwab API specs are included in `docs/openapi/` for reference:

- `trader-api.json` — Accounts, Orders, Transactions, User Preferences
- `market-data-api.json` — Quotes, Option Chains, Price History, Movers, Market Hours, Instruments

## MCP Client Configuration

Add this to your MCP client config (e.g., Claude Desktop `claude_desktop_config.json` or Claude Code `settings.json`):

```json
{
  "mcpServers": {
    "schwab": {
      "command": "/full/path/to/uv",
      "args": [
        "--directory",
        "/path/to/schwab-mcp",
        "run",
        "schwab-mcp",
        "server",
        "--json"
      ]
    }
  }
}
```

> **Important**: Use the full absolute path to `uv` (e.g., `~/.local/bin/uv` or the output of `which uv`). A bare `"uv"` may not resolve in the MCP client's environment.

## Development

```bash
git clone https://github.com/Tapojit/schwab-mcp.git
cd schwab-mcp
uv sync --group dev --group ta

# Run tests
uv run pytest

# Lint and format
uv run ruff format . && uv run ruff check .

# Type check
uv run pyright
```

### MCP Inspector

A dev server is included for testing with the MCP Inspector:

```bash
uv run mcp dev dev_server.py:mcp -e .
```

## License

MIT License.
