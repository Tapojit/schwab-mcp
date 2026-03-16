import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SchwabClient } from "../client.js";

export function register(server: McpServer, client: SchwabClient): void {
  server.tool(
    "get_account_numbers",
    "Returns mapping of account IDs to account hashes. Hashes required for account-specific calls. Use first.",
    {},
    async () => {
      const result = await client.getAccountNumbers();
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    },
  );

  server.tool(
    "get_accounts",
    "Returns balances/info for all linked accounts (funds, cash, margin). Does not return hashes; use get_account_numbers first.",
    {},
    async () => {
      const result = await client.getAccounts();
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    },
  );

  server.tool(
    "get_accounts_with_positions",
    "Returns balances, info, and positions (holdings, cost, gain/loss) for all linked accounts. Does not return hashes; use get_account_numbers first.",
    {},
    async () => {
      const result = await client.getAccounts("positions");
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    },
  );

  server.tool(
    "get_account",
    "Returns balance/info for a specific account via account_hash (from get_account_numbers). Includes funds, cash, margin info.",
    {
      account_hash: z
        .string()
        .describe("Account hash for the Schwab account"),
    },
    async ({ account_hash }) => {
      const result = await client.getAccount(account_hash);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    },
  );

  server.tool(
    "get_account_with_positions",
    "Returns balance, info, and positions for a specific account via account_hash. Includes holdings, quantity, cost basis, unrealized gain/loss.",
    {
      account_hash: z
        .string()
        .describe("Account hash for the Schwab account"),
    },
    async ({ account_hash }) => {
      const result = await client.getAccount(account_hash, "positions");
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    },
  );

  server.tool(
    "get_user_preferences",
    "Returns user preferences (nicknames, display settings, notifications) for all linked accounts.",
    {},
    async () => {
      const result = await client.getUserPreferences();
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    },
  );
}
