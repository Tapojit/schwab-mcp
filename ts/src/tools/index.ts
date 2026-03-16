import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SchwabClient } from "../client.js";
import { register as registerMarket } from "./market.js";
import { register as registerAccounts } from "./accounts.js";
import { register as registerQuotes } from "./quotes.js";
import { register as registerHistory } from "./history.js";
import { register as registerOrders } from "./orders.js";
import { register as registerTransactions } from "./transactions.js";
import { register as registerTechnical } from "./technical.js";

export interface RegisterToolsOptions {
  enableTechnical?: boolean;
}

export function registerTools(
  server: McpServer,
  client: SchwabClient,
  opts: RegisterToolsOptions = {},
): void {
  const { enableTechnical = true } = opts;

  registerMarket(server, client);
  registerAccounts(server, client);
  registerQuotes(server, client);
  registerHistory(server, client);
  registerOrders(server, client);
  registerTransactions(server, client);

  if (enableTechnical) {
    registerTechnical(server, client);
  }
}
