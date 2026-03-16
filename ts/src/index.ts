#!/usr/bin/env bun
import { Command } from "commander";
import { SchwabMCPServer, sendErrorResponse } from "./server.js";
import { SchwabClient } from "./client.js";
import { easyClient } from "./auth.js";
import {
  TokenManager,
  tokenPath,
  credentialsPath,
  loadCredentials,
  saveCredentials,
} from "./tokens.js";

const APP_NAME = "schwab-mcp";
const DEFAULT_MAX_TOKEN_AGE_MS = 5 * 24 * 60 * 60 * 1000; // 5 days
const DEFAULT_CALLBACK_URL = "https://127.0.0.1:8182";
const DEFAULT_BASE_URL = "https://api.schwabapi.com";

function resolveCredentials(opts: {
  clientId?: string;
  clientSecret?: string;
}): { clientId: string; clientSecret: string } | null {
  const creds = loadCredentials(credentialsPath(APP_NAME));
  const clientId = opts.clientId || process.env.SCHWAB_CLIENT_ID || creds.client_id;
  const clientSecret =
    opts.clientSecret || process.env.SCHWAB_CLIENT_SECRET || creds.client_secret;

  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

const program = new Command();

program
  .name("schwab-mcp")
  .description("Schwab Model Context Protocol CLI (read-only)")
  .version("0.1.0");

program
  .command("auth")
  .description("Initialize Schwab client authentication")
  .option("--token-path <path>", "Path to save token file", tokenPath(APP_NAME))
  .option("--client-id <id>", "Schwab Client ID")
  .option("--client-secret <secret>", "Schwab Client Secret")
  .option(
    "--callback-url <url>",
    "Schwab callback URL",
    process.env.SCHWAB_CALLBACK_URL || DEFAULT_CALLBACK_URL,
  )
  .option(
    "--base-url <url>",
    "Schwab API base URL",
    process.env.SCHWAB_BASE_URL || DEFAULT_BASE_URL,
  )
  .action(async (opts) => {
    const resolved = resolveCredentials(opts);
    if (!resolved) {
      console.error(
        "Error: client-id and client-secret are required. " +
          "Provide via --client-id/--client-secret, env vars, " +
          "or store with 'schwab-mcp save-credentials'.",
      );
      process.exit(1);
      return;
    }

    const tokenMgr = new TokenManager(opts.tokenPath);
    console.log(
      `Initializing authentication flow to create token at: ${opts.tokenPath}`,
    );

    try {
      await easyClient({
        clientId: resolved.clientId,
        clientSecret: resolved.clientSecret,
        callbackUrl: opts.callbackUrl,
        tokenManager: tokenMgr,
        maxTokenAge: DEFAULT_MAX_TOKEN_AGE_MS,
        baseUrl: opts.baseUrl,
      });
      console.log(`Authentication successful! Token saved to: ${opts.tokenPath}`);
    } catch (err) {
      console.error(`Authentication failed: ${err}`);
      process.exit(1);
    }
  });

program
  .command("server")
  .description("Run the Schwab MCP server")
  .option("--token-path <path>", "Path to token file", tokenPath(APP_NAME))
  .option("--client-id <id>", "Schwab Client ID")
  .option("--client-secret <secret>", "Schwab Client Secret")
  .option(
    "--callback-url <url>",
    "Schwab callback URL",
    process.env.SCHWAB_CALLBACK_URL || DEFAULT_CALLBACK_URL,
  )
  .option(
    "--base-url <url>",
    "Schwab API base URL",
    process.env.SCHWAB_BASE_URL || DEFAULT_BASE_URL,
  )
  .option("--no-technical-tools", "Disable optional technical analysis tools")
  .action(async (opts) => {
    const resolved = resolveCredentials(opts);
    if (!resolved) {
      sendErrorResponse(
        "client-id and client-secret are required. " +
          "Provide via --client-id/--client-secret, env vars, " +
          "or store with 'schwab-mcp save-credentials'.",
        400,
        {
          missing_client_id: !opts.clientId,
          missing_client_secret: !opts.clientSecret,
        },
      );
      return;
    }

    const tokenMgr = new TokenManager(opts.tokenPath);

    try {
      await easyClient({
        clientId: resolved.clientId,
        clientSecret: resolved.clientSecret,
        callbackUrl: opts.callbackUrl,
        tokenManager: tokenMgr,
        maxTokenAge: DEFAULT_MAX_TOKEN_AGE_MS,
        interactive: false,
        baseUrl: opts.baseUrl,
      });
    } catch (err) {
      sendErrorResponse(
        `Error initializing Schwab client: ${err}`,
        500,
        { error: String(err) },
      );
      return;
    }

    // Check token age
    const age = tokenMgr.tokenAge();
    if (age >= DEFAULT_MAX_TOKEN_AGE_MS) {
      sendErrorResponse(
        "Token is older than 5 days. Please run 'schwab-mcp auth' to re-authenticate.",
        401,
        {
          token_expired: true,
          token_age_days: age / (24 * 60 * 60 * 1000),
        },
      );
      return;
    }

    try {
      console.error(
        "Read-only mode: trading tools are not available in this build.",
      );

      const client = new SchwabClient(
        resolved.clientId,
        resolved.clientSecret,
        tokenMgr,
        opts.baseUrl,
      );

      const mcpServer = new SchwabMCPServer(APP_NAME, client, {
        enableTechnicalTools: opts.technicalTools !== false,
      });

      await mcpServer.run();
    } catch (err) {
      sendErrorResponse(
        `Error running server: ${err}`,
        500,
        { error: String(err) },
      );
    }
  });

program
  .command("save-credentials")
  .description("Save Schwab client credentials to a local file")
  .requiredOption("--client-id <id>", "Schwab Client ID")
  .requiredOption("--client-secret <secret>", "Schwab Client Secret")
  .action((opts) => {
    const path = credentialsPath(APP_NAME);
    saveCredentials(path, opts.clientId, opts.clientSecret);
    console.log(`Credentials saved to: ${path}`);
  });

program.parse();
