# Repository Guidelines

## Project Structure

```
src/schwab_mcp/
  __init__.py         # Entry point proxy
  cli.py              # Click CLI commands (auth, server, save-credentials)
  server.py           # SchwabMCPServer class, FastMCP integration
  context.py          # SchwabContext, SchwabServerContext dataclasses
  auth.py             # OAuth browser flow helpers
  tokens.py           # Token load/save, validation, credentials management
  resources.py        # MCP resource definitions
  tools/              # MCP tool implementations (all read-only)
    __init__.py       # register_tools() aggregator
    _registration.py  # register_tool() with readOnlyHint=True
    _protocols.py     # Protocol classes for typed client facades
    utils.py          # call() helper, SchwabAPIError, JSONType
    tools.py          # get_datetime, get_market_hours, get_movers, get_instruments
    account.py        # Account and preferences tools
    history.py        # Price history tools (multiple timeframes)
    orders.py         # Order viewing (get_order, get_orders only)
    quotes.py         # Quote retrieval tools
    transactions.py   # Transaction history tools
    technical/        # Optional pandas-ta indicators (sma, rsi, macd, etc.)
tests/
  conftest.py         # make_ctx(), run(), shared fixtures
  test_*.py           # Mirror source structure
docs/
  openapi/            # Schwab API OpenAPI 3.x specifications
dev_server.py         # MCP Inspector entry point
```

## Important: Read-Only Server

This is a **read-only** fork. All trading, order placement, order cancellation,
options tools, approval workflows, and Discord integration have been removed.
Every registered tool has `readOnlyHint=True`. Do not add write operations.

## Build, Test, and Development Commands

```bash
# Install dependencies
uv sync --group dev --group ta

# Run the CLI
uv run schwab-mcp --help
uv run schwab-mcp server --help

# Type checking
uv run pyright

# Format code (run before commits)
uv run ruff format .

# Lint (auto-fixable issues)
uv run ruff check .
uv run ruff check . --fix

# Run full test suite with coverage
uv run pytest

# Run a single test file
uv run pytest tests/test_tools.py

# Run a single test function
uv run pytest tests/test_tools.py::test_get_datetime_returns_eastern_time

# Run tests matching a pattern
uv run pytest -k "get_order"

# Run with verbose output
uv run pytest -v tests/test_orders.py

# Combined check before commit
uv run ruff format . && uv run ruff check . && uv run pyright && uv run pytest

# MCP Inspector (dev server)
uv run mcp dev dev_server.py:mcp -e .
```

## Code Style & Formatting

### Python Version and Imports
- Target Python 3.10+ (use `from __future__ import annotations` for forward refs)
- Use explicit imports, no wildcards
- Group imports: stdlib, third-party, local (ruff enforces this)
- Prefer `from schwab_mcp.tools import module` over `from schwab_mcp.tools.module import func`

```python
from __future__ import annotations

import datetime
from collections.abc import Callable
from typing import Annotated, Any

from mcp.server.fastmcp import FastMCP
from schwab.client import AsyncClient

from schwab_mcp.context import SchwabContext
from schwab_mcp.tools._registration import register_tool
from schwab_mcp.tools.utils import JSONType, call
```

### Type Annotations
- All function signatures must be typed
- Use `Annotated[type, "description"]` for tool parameters (MCP uses these for descriptions)
- Use `JSONType` alias for Schwab API return values
- Use Protocol classes in `_protocols.py` for typed client facades
- Pyright is set to `basic` mode; don't fight it with `type: ignore`

```python
async def get_movers(
    ctx: SchwabContext,
    index: Annotated[str, "Index: DJI, COMPX, SPX, NYSE, NASDAQ"],
    sort: Annotated[str | None, "Sort: VOLUME, TRADES, PERCENT_CHANGE_UP/DOWN"] = None,
) -> JSONType:
    """Get top 10 movers for an index/market."""
    ...
```

### Naming Conventions
- Module files: `snake_case.py`
- Classes: `CamelCase` (e.g., `SchwabContext`, `SchwabMCPServer`)
- Functions/methods: `snake_case`
- Constants: `UPPER_SNAKE_CASE`
- Private helpers: prefix with `_` (e.g., `_resolve_context_parameters`)
- Tool functions: match Schwab API naming (e.g., `get_market_hours`, `get_quotes`)

### Error Handling
- Use `SchwabAPIError` for API failures (defined in `tools/utils.py`)
- Raise `ValueError` for invalid parameters
- Let unexpected exceptions propagate (don't catch-all)

```python
if status not in _VALID_STATUSES:
    raise ValueError(
        f"Invalid status: {status}. Must be one of: WORKING, FILLED, CANCELED, ..."
    )
```

### Async Patterns
- All tool functions are `async`
- Use `await call(client.method, ...)` to invoke Schwab client methods
- The `call()` helper handles response parsing and error wrapping

## Testing Guidelines

### Test File Organization
- Name test files `test_<module>.py` in the `tests/` directory
- Name test functions `test_<behavior>` (descriptive, not `test_1`)
- Use `monkeypatch` to stub `call()` or client methods

### Test Fixtures Pattern
```python
def make_ctx(client: Any) -> SchwabContext:
    lifespan_context = SchwabServerContext(
        client=cast(AsyncClient, client),
    )
    request_context = SimpleNamespace(lifespan_context=lifespan_context)
    return SchwabContext.model_construct(
        _request_context=cast(Any, request_context),
        _fastmcp=None,
    )

def run(coro):
    return asyncio.run(coro)
```

### Mocking Schwab Client
```python
def test_get_market_hours_handles_string_inputs(monkeypatch):
    captured: dict[str, Any] = {}

    async def fake_call(func, *args, **kwargs):
        captured["func"] = func
        captured["args"] = args
        captured["kwargs"] = kwargs
        return "ok"

    monkeypatch.setattr(tools, "call", fake_call)

    client = DummyToolsClient()
    ctx = make_ctx(client)
    result = run(tools.get_market_hours(ctx, "equity, option", date="2024-03-01"))

    assert result == "ok"
    assert captured["kwargs"]["date"] == datetime.date(2024, 3, 1)
```

### Coverage
- Tests run with `--cov=schwab_mcp --cov-report=term-missing`
- Aim to cover error branches that raise MCP errors or touch token handling

## Security & Configuration

- Store credentials via environment variables or `schwab-mcp save-credentials`
- Required: `SCHWAB_CLIENT_ID`, `SCHWAB_CLIENT_SECRET`
- Never commit tokens from `~/.local/share/schwab-mcp/`

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
fix(tools): default date window to 60 days for orders

Order queries without date parameters returned all history, causing
oversized responses that exceeded context limits.

Default from_date to today - 60 days and to_date to today when both
are omitted.
```
