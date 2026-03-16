import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SchwabClient } from "../client.js";

export function register(server: McpServer, client: SchwabClient): void {
  server.tool(
    "get_quotes",
    "Returns current market quotes for specified symbols (stocks, ETFs, indices, options). Params: symbols (comma-separated), fields (QUOTE/FUNDAMENTAL/EXTENDED/REFERENCE/REGULAR), indicative (bool).",
    {
      symbols: z
        .string()
        .describe(
          "Comma-separated list of symbols (e.g., 'AAPL,MSFT,GOOG')",
        ),
      fields: z
        .string()
        .optional()
        .describe(
          "Data fields (comma-separated): QUOTE, FUNDAMENTAL, EXTENDED, REFERENCE, REGULAR. Default is all.",
        ),
      indicative: z
        .boolean()
        .optional()
        .describe("True for indicative quotes (extended hours/futures)"),
    },
    async ({ symbols, fields, indicative }) => {
      const symbolList = symbols
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const result = await client.getQuotes(
        symbolList,
        fields?.toLowerCase(),
        indicative,
      );
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    },
  );
}
