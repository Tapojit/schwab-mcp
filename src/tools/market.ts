import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SchwabClient } from "../client.js";
import { parseDate } from "./utils.js";
import {
  MarketType,
  MoverIndex,
  MoverSort,
  MoverFrequency,
  ProjectionType,
} from "../types.js";

export function register(server: McpServer, client: SchwabClient): void {
  server.tool(
    "get_datetime",
    "Get the current datetime in ISO format with Eastern Time offset and abbreviation.",
    {},
    async () => {
      const now = new Date();
      const eastern = now.toLocaleString("en-US", {
        timeZone: "America/New_York",
        timeZoneName: "short",
      });
      const isoEastern = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/New_York",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
        .format(now)
        .replace(",", "");
      // Extract timezone abbreviation
      const tzMatch = eastern.match(/\b([A-Z]{2,4})\s*$/);
      const tz = tzMatch ? tzMatch[1] : "ET";
      return {
        content: [{ type: "text" as const, text: `${isoEastern} ${tz}` }],
      };
    },
  );

  server.tool(
    "get_market_hours",
    "Get market hours for specified markets (EQUITY, OPTION, BOND, FUTURE, FOREX) on a given date (YYYY-MM-DD, default today).",
    {
      markets: z
        .string()
        .describe(
          "Markets (comma-separated): EQUITY, OPTION, BOND, FUTURE, FOREX",
        ),
      date: z
        .string()
        .optional()
        .describe("Date (YYYY-MM-DD, default today, max 1 year future)"),
    },
    async ({ markets, date }) => {
      const marketList = markets
        .split(",")
        .map((m) => m.trim().toLowerCase())
        .filter(Boolean);
      const dateStr = parseDate(date);
      const result = await client.getMarketHours(marketList, dateStr);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    },
  );

  server.tool(
    "get_movers",
    "Get top 10 movers for an index/market (e.g., DJI, SPX, NASDAQ). Params: index, sort (VOLUME/TRADES/PERCENT_CHANGE_UP/DOWN), frequency (min % change: 0/1/5/10/30/60).",
    {
      index: z
        .string()
        .describe(
          "Index/market: DJI, COMPX, SPX, NYSE, NASDAQ, OTCBB, INDEX_ALL, EQUITY_ALL, OPTION_ALL, OPTION_PUT, OPTION_CALL",
        ),
      sort: z
        .string()
        .optional()
        .describe(
          "Sort criteria: VOLUME, TRADES, PERCENT_CHANGE_UP, PERCENT_CHANGE_DOWN",
        ),
      frequency: z
        .number()
        .optional()
        .describe("Min % change threshold: 0, 1, 5, 10, 30, 60"),
    },
    async ({ index, sort, frequency }) => {
      const indexMap: Record<string, string> = {
        DJI: "$DJI",
        COMPX: "$COMPX",
        SPX: "$SPX",
        NYSE: "NYSE",
        NASDAQ: "NASDAQ",
        OTCBB: "OTCBB",
        INDEX_ALL: "INDEX_ALL",
        EQUITY_ALL: "EQUITY_ALL",
        OPTION_ALL: "OPTION_ALL",
        OPTION_PUT: "OPTION_PUT",
        OPTION_CALL: "OPTION_CALL",
      };
      const indexSymbol = indexMap[index.toUpperCase()] ?? index;
      const result = await client.getMovers(indexSymbol, sort, frequency);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    },
  );

  server.tool(
    "get_instruments",
    "Search for instruments by symbol or description. Params: symbol (search term), projection (SYMBOL_SEARCH/SYMBOL_REGEX/DESCRIPTION_SEARCH/DESCRIPTION_REGEX/SEARCH/FUNDAMENTAL, default symbol-search).",
    {
      symbol: z.string().describe("Symbol or search term"),
      projection: z
        .string()
        .default("symbol-search")
        .describe(
          "Search method: SYMBOL_SEARCH, SYMBOL_REGEX, DESCRIPTION_SEARCH, DESCRIPTION_REGEX, SEARCH, FUNDAMENTAL",
        ),
    },
    async ({ symbol, projection }) => {
      const projectionMap: Record<string, string> = {
        symbol_search: "symbol-search",
        symbol_regex: "symbol-regex",
        description_search: "desc-search",
        description_regex: "desc-regex",
        search: "search",
        fundamental: "fundamental",
        "symbol-search": "symbol-search",
        "symbol-regex": "symbol-regex",
        "description-search": "desc-search",
        "description-regex": "desc-regex",
        "desc-search": "desc-search",
        "desc-regex": "desc-regex",
      };
      const proj =
        projectionMap[projection.toLowerCase()] ?? projection.toLowerCase();
      const result = await client.getInstruments(symbol, proj);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    },
  );
}
