import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SchwabClient } from "../client.js";
import { toEpochMs } from "./utils.js";

function makeHistoryHandler(
  client: SchwabClient,
  frequencyType: string,
  frequency: number,
) {
  return async ({
    symbol,
    start_datetime,
    end_datetime,
    extended_hours,
    previous_close,
  }: {
    symbol: string;
    start_datetime?: string;
    end_datetime?: string;
    extended_hours?: boolean;
    previous_close?: boolean;
  }) => {
    const result = await client.getPriceHistory(symbol, {
      frequencyType,
      frequency,
      startDate: toEpochMs(start_datetime),
      endDate: toEpochMs(end_datetime),
      needExtendedHoursData: extended_hours,
      needPreviousClose: previous_close,
    });
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result) }],
    };
  };
}

const historyParamsSchema = {
  symbol: z.string().describe("Symbol of the security"),
  start_datetime: z
    .string()
    .optional()
    .describe("Start date (ISO format, e.g., '2023-01-01T09:30:00')"),
  end_datetime: z
    .string()
    .optional()
    .describe("End date (ISO format, e.g., '2023-01-31T16:00:00')"),
  extended_hours: z.boolean().optional().describe("Include extended hours data"),
  previous_close: z
    .boolean()
    .optional()
    .describe("Include previous close data"),
};

export function register(server: McpServer, client: SchwabClient): void {
  // Advanced price history with full control
  server.tool(
    "get_advanced_price_history",
    "Get price history with advanced period/frequency options. Specify period/frequency OR start/end datetimes. Period types: DAY, MONTH, YEAR, YTD. Frequency types: MINUTE, DAILY, WEEKLY, MONTHLY.",
    {
      symbol: z.string().describe("Symbol of the security"),
      period_type: z
        .string()
        .optional()
        .describe("Period type: DAY, MONTH, YEAR, YTD"),
      period: z
        .number()
        .optional()
        .describe("Number of periods (varies by period_type)"),
      frequency_type: z
        .string()
        .optional()
        .describe("Frequency type: MINUTE, DAILY, WEEKLY, MONTHLY"),
      frequency: z
        .number()
        .optional()
        .describe("Number of frequency_type per candle (e.g., 1, 5, 10, 15, 30)"),
      start_datetime: z
        .string()
        .optional()
        .describe("Start date (ISO format)"),
      end_datetime: z.string().optional().describe("End date (ISO format)"),
      extended_hours: z
        .boolean()
        .optional()
        .describe("Include extended hours data"),
      previous_close: z
        .boolean()
        .optional()
        .describe("Include previous close data"),
    },
    async ({
      symbol,
      period_type,
      period,
      frequency_type,
      frequency,
      start_datetime,
      end_datetime,
      extended_hours,
      previous_close,
    }) => {
      const result = await client.getPriceHistory(symbol, {
        periodType: period_type?.toLowerCase(),
        period,
        frequencyType: frequency_type?.toLowerCase(),
        frequency,
        startDate: toEpochMs(start_datetime),
        endDate: toEpochMs(end_datetime),
        needExtendedHoursData: extended_hours,
        needPreviousClose: previous_close,
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    },
  );

  // Convenience tools for specific timeframes
  const timeframes: Array<{
    name: string;
    desc: string;
    freqType: string;
    freq: number;
  }> = [
    {
      name: "get_price_history_every_minute",
      desc: "Get OHLCV price history per minute. For detailed intraday analysis. Max 48 days history.",
      freqType: "minute",
      freq: 1,
    },
    {
      name: "get_price_history_every_five_minutes",
      desc: "Get OHLCV price history per 5 minutes. Balance between detail and noise. Approx. 9 months history.",
      freqType: "minute",
      freq: 5,
    },
    {
      name: "get_price_history_every_ten_minutes",
      desc: "Get OHLCV price history per 10 minutes. Good for intraday trends/levels. Approx. 9 months history.",
      freqType: "minute",
      freq: 10,
    },
    {
      name: "get_price_history_every_fifteen_minutes",
      desc: "Get OHLCV price history per 15 minutes. Shows significant intraday moves. Approx. 9 months history.",
      freqType: "minute",
      freq: 15,
    },
    {
      name: "get_price_history_every_thirty_minutes",
      desc: "Get OHLCV price history per 30 minutes. For broader intraday trends. Approx. 9 months history.",
      freqType: "minute",
      freq: 30,
    },
    {
      name: "get_price_history_every_day",
      desc: "Get daily OHLCV price history. For medium/long-term analysis. Extensive history (back to 1985).",
      freqType: "daily",
      freq: 1,
    },
    {
      name: "get_price_history_every_week",
      desc: "Get weekly OHLCV price history. For long-term analysis, major cycles. Extensive history.",
      freqType: "weekly",
      freq: 1,
    },
  ];

  for (const tf of timeframes) {
    server.tool(
      tf.name,
      tf.desc,
      historyParamsSchema,
      makeHistoryHandler(client, tf.freqType, tf.freq),
    );
  }
}
