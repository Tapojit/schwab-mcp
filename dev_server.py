"""Dev entry point for the MCP Inspector.

Exposes the FastMCP instance at module level so ``mcp dev dev_server.py:mcp``
can discover and proxy it.  Credentials are read from env vars or the saved
credentials file (``schwab-mcp save-credentials``).

Usage::

    uv run mcp dev dev_server.py:mcp -e .
"""

import os

from schwab_mcp import auth as schwab_auth
from schwab_mcp import tokens
from schwab_mcp.server import SchwabMCPServer

APP_NAME = "schwab-mcp"

# --- credentials --------------------------------------------------------
creds = tokens.load_credentials(tokens.credentials_path(APP_NAME))
client_id = os.getenv("SCHWAB_CLIENT_ID") or creds.get("client_id")
client_secret = os.getenv("SCHWAB_CLIENT_SECRET") or creds.get("client_secret")

if not client_id or not client_secret:
    raise RuntimeError(
        "Credentials required. Set SCHWAB_CLIENT_ID / SCHWAB_CLIENT_SECRET "
        "env vars or run 'schwab-mcp save-credentials'."
    )

# --- schwab client -------------------------------------------------------
token_manager = tokens.Manager(tokens.token_path(APP_NAME))
client = schwab_auth.easy_client(
    client_id=client_id,
    client_secret=client_secret,
    callback_url=os.getenv("SCHWAB_CALLBACK_URL", "https://127.0.0.1:8182"),
    token_manager=token_manager,
    asyncio=True,
    interactive=False,
    enforce_enums=False,
    max_token_age=schwab_auth.DEFAULT_MAX_TOKEN_AGE_SECONDS,
    base_url=os.getenv("SCHWAB_BASE_URL", "https://api.schwabapi.com"),
)

# --- MCP server (read-only, JSON output) ---------------------------------
_server = SchwabMCPServer(
    APP_NAME,
    client,
    enable_technical_tools=True,
    use_json=True,
)

# Module-level FastMCP instance for `mcp dev` to discover
mcp = _server._server
