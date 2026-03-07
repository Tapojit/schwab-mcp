import click
import sys
import anyio

from schwab.client import AsyncClient

from schwab_mcp.server import SchwabMCPServer, send_error_response
from schwab_mcp import auth as schwab_auth
from schwab_mcp import tokens


APP_NAME = "schwab-mcp"
TOKEN_MAX_AGE_SECONDS = schwab_auth.DEFAULT_MAX_TOKEN_AGE_SECONDS


@click.group()
def cli():
    """Schwab Model Context Protocol CLI."""
    pass


@cli.command("auth")
@click.option(
    "--token-path",
    type=str,
    default=tokens.token_path(APP_NAME),
    help="Path to save Schwab token file",
)
@click.option(
    "--client-id",
    type=str,
    required=False,
    default=None,
    envvar="SCHWAB_CLIENT_ID",
    help="Schwab Client ID",
)
@click.option(
    "--client-secret",
    type=str,
    required=False,
    default=None,
    envvar="SCHWAB_CLIENT_SECRET",
    help="Schwab Client Secret",
)
@click.option(
    "--callback-url",
    type=str,
    envvar="SCHWAB_CALLBACK_URL",
    default="https://127.0.0.1:8182",
    help="Schwab callback URL",
)
@click.option(
    "--base-url",
    type=str,
    envvar="SCHWAB_BASE_URL",
    default="https://api.schwabapi.com",
    help="Schwab API base URL",
)
def auth(
    token_path: str,
    client_id: str | None,
    client_secret: str | None,
    callback_url: str,
    base_url: str,
) -> int:
    """Initialize Schwab client authentication."""
    creds = tokens.load_credentials(tokens.credentials_path(APP_NAME))
    client_id = client_id or creds.get("client_id")
    client_secret = client_secret or creds.get("client_secret")
    if not client_id or not client_secret:
        click.echo(
            "Error: client-id and client-secret are required. "
            "Provide via --client-id/--client-secret, env vars, "
            "or store in credentials file with 'schwab-mcp save-credentials'.",
            err=True,
        )
        raise SystemExit(1)

    click.echo(f"Initializing authentication flow to create token at: {token_path}")
    token_manager = tokens.Manager(token_path)

    try:
        schwab_auth.easy_client(
            client_id=client_id,
            client_secret=client_secret,
            callback_url=callback_url,
            token_manager=token_manager,
            max_token_age=TOKEN_MAX_AGE_SECONDS,
            base_url=base_url,
        )

        click.echo(f"Authentication successful! Token saved to: {token_path}")
        return 0
    except Exception as e:
        click.echo(f"Authentication failed: {str(e)}", err=True)
        return 1


@cli.command("server")
@click.option(
    "--token-path",
    type=str,
    default=tokens.token_path(APP_NAME),
    help="Path to Schwab token file",
)
@click.option(
    "--client-id",
    type=str,
    required=False,
    default=None,
    envvar="SCHWAB_CLIENT_ID",
    help="Schwab Client ID",
)
@click.option(
    "--client-secret",
    type=str,
    required=False,
    default=None,
    envvar="SCHWAB_CLIENT_SECRET",
    help="Schwab Client Secret",
)
@click.option(
    "--callback-url",
    type=str,
    envvar="SCHWAB_CALLBACK_URL",
    default="https://127.0.0.1:8182",
    help="Schwab callback URL",
)
@click.option(
    "--base-url",
    type=str,
    envvar="SCHWAB_BASE_URL",
    default="https://api.schwabapi.com",
    help="Schwab API base URL",
)
@click.option(
    "--no-technical-tools",
    default=False,
    is_flag=True,
    help="Disable optional technical analysis tools.",
)
@click.option(
    "--json",
    "json_output",
    default=False,
    is_flag=True,
    help="Return JSON payloads from tools instead of Toon-encoded strings.",
)
def server(
    token_path: str,
    client_id: str | None,
    client_secret: str | None,
    callback_url: str,
    base_url: str,
    no_technical_tools: bool,
    json_output: bool,
) -> int:
    """Run the Schwab MCP server."""
    creds = tokens.load_credentials(tokens.credentials_path(APP_NAME))
    client_id = client_id or creds.get("client_id")
    client_secret = client_secret or creds.get("client_secret")
    if not client_id or not client_secret:
        send_error_response(
            "client-id and client-secret are required. "
            "Provide via --client-id/--client-secret, env vars, "
            "or store in credentials file with 'schwab-mcp save-credentials'.",
            code=400,
            details={
                "missing_client_id": not bool(client_id),
                "missing_client_secret": not bool(client_secret),
            },
        )
        return 1

    token_manager = tokens.Manager(token_path)

    try:
        client = schwab_auth.easy_client(
            client_id=client_id,
            client_secret=client_secret,
            callback_url=callback_url,
            token_manager=token_manager,
            asyncio=True,
            interactive=False,
            enforce_enums=False,
            max_token_age=TOKEN_MAX_AGE_SECONDS,
            base_url=base_url,
        )

        if not isinstance(client, AsyncClient):
            send_error_response(
                "Async client required when starting the MCP server.",
                code=500,
                details={"client_type": type(client).__name__},
            )
            return 1
    except Exception as e:
        send_error_response(
            f"Error initializing Schwab client: {str(e)}",
            code=500,
            details={"error": str(e)},
        )
        return 1

    if client.token_age() >= TOKEN_MAX_AGE_SECONDS:
        send_error_response(
            "Token is older than 5 days. Please run 'schwab-mcp auth' to re-authenticate.",
            code=401,
            details={
                "token_expired": True,
                "token_age_days": client.token_age() / 86400,
            },
        )
        return 1

    try:
        click.echo(
            "Read-only mode: trading tools are not available in this build.",
            err=True,
        )

        mcp_server = SchwabMCPServer(
            APP_NAME,
            client,
            enable_technical_tools=not no_technical_tools,
            use_json=json_output,
        )
        anyio.run(mcp_server.run, backend="asyncio")
        return 0
    except Exception as e:
        send_error_response(
            f"Error running server: {str(e)}", code=500, details={"error": str(e)}
        )
        return 1


@cli.command("save-credentials")
@click.option(
    "--client-id",
    type=str,
    prompt="Schwab Client ID",
    help="Schwab Client ID",
)
@click.option(
    "--client-secret",
    type=str,
    prompt="Schwab Client Secret",
    help="Schwab Client Secret",
)
def save_credentials(client_id: str, client_secret: str) -> None:
    """Save Schwab client credentials to a local file."""
    path = tokens.credentials_path(APP_NAME)
    tokens.save_credentials(path, client_id, client_secret)
    click.echo(f"Credentials saved to: {path}")


def main():
    """Main entry point for the application."""
    return cli()


if __name__ == "__main__":
    sys.exit(main())
