import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SchwabClient } from "../client.js";
import type { CandleList, Candle } from "../types.js";
import { toEpochMs } from "./utils.js";
import {
  SMA,
  EMA,
  RSI,
  Stochastic,
  MACD,
  ADX,
  BollingerBands,
  ATR,
  VWAP,
} from "technicalindicators";

async function fetchCandles(
  client: SchwabClient,
  symbol: string,
  opts: {
    frequencyType?: string;
    frequency?: number;
    startDatetime?: string;
    endDatetime?: string;
  },
): Promise<Candle[]> {
  const result = (await client.getPriceHistory(symbol, {
    frequencyType: opts.frequencyType ?? "daily",
    frequency: opts.frequency ?? 1,
    startDate: toEpochMs(opts.startDatetime),
    endDate: toEpochMs(opts.endDatetime),
  })) as CandleList | null;
  return result?.candles ?? [];
}

function closePrices(candles: Candle[]): number[] {
  return candles.map((c) => c.close);
}

const baseSchema = {
  symbol: z.string().describe("Symbol of the security"),
  period: z.number().optional().describe("Number of periods (default varies by indicator)"),
  start_datetime: z
    .string()
    .optional()
    .describe("Start date (ISO format)"),
  end_datetime: z
    .string()
    .optional()
    .describe("End date (ISO format)"),
};

export function register(server: McpServer, client: SchwabClient): void {
  server.tool(
    "sma",
    "Calculate Simple Moving Average for a symbol. Returns array of SMA values.",
    baseSchema,
    async ({ symbol, period = 20, start_datetime, end_datetime }) => {
      const candles = await fetchCandles(client, symbol, {
        startDatetime: start_datetime,
        endDatetime: end_datetime,
      });
      const values = closePrices(candles);
      const result = SMA.calculate({ period, values });
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ symbol, period, sma: result }) }],
      };
    },
  );

  server.tool(
    "ema",
    "Calculate Exponential Moving Average for a symbol. Returns array of EMA values.",
    baseSchema,
    async ({ symbol, period = 20, start_datetime, end_datetime }) => {
      const candles = await fetchCandles(client, symbol, {
        startDatetime: start_datetime,
        endDatetime: end_datetime,
      });
      const values = closePrices(candles);
      const result = EMA.calculate({ period, values });
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ symbol, period, ema: result }) }],
      };
    },
  );

  server.tool(
    "rsi",
    "Calculate Relative Strength Index for a symbol. Returns array of RSI values (0-100).",
    baseSchema,
    async ({ symbol, period = 14, start_datetime, end_datetime }) => {
      const candles = await fetchCandles(client, symbol, {
        startDatetime: start_datetime,
        endDatetime: end_datetime,
      });
      const values = closePrices(candles);
      const result = RSI.calculate({ period, values });
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ symbol, period, rsi: result }) }],
      };
    },
  );

  server.tool(
    "stoch",
    "Calculate Stochastic Oscillator for a symbol. Returns arrays of %K and %D values.",
    {
      symbol: z.string().describe("Symbol of the security"),
      period: z.number().optional().describe("Stochastic period (default 14)"),
      signal_period: z.number().optional().describe("Signal period (default 3)"),
      start_datetime: z.string().optional().describe("Start date (ISO format)"),
      end_datetime: z.string().optional().describe("End date (ISO format)"),
    },
    async ({ symbol, period = 14, signal_period = 3, start_datetime, end_datetime }) => {
      const candles = await fetchCandles(client, symbol, {
        startDatetime: start_datetime,
        endDatetime: end_datetime,
      });
      const result = Stochastic.calculate({
        high: candles.map((c) => c.high),
        low: candles.map((c) => c.low),
        close: candles.map((c) => c.close),
        period,
        signalPeriod: signal_period,
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ symbol, period, stochastic: result }) }],
      };
    },
  );

  server.tool(
    "macd",
    "Calculate MACD (Moving Average Convergence Divergence) for a symbol.",
    {
      symbol: z.string().describe("Symbol of the security"),
      fast_period: z.number().optional().describe("Fast EMA period (default 12)"),
      slow_period: z.number().optional().describe("Slow EMA period (default 26)"),
      signal_period: z.number().optional().describe("Signal period (default 9)"),
      start_datetime: z.string().optional().describe("Start date (ISO format)"),
      end_datetime: z.string().optional().describe("End date (ISO format)"),
    },
    async ({ symbol, fast_period = 12, slow_period = 26, signal_period = 9, start_datetime, end_datetime }) => {
      const candles = await fetchCandles(client, symbol, {
        startDatetime: start_datetime,
        endDatetime: end_datetime,
      });
      const values = closePrices(candles);
      const result = MACD.calculate({
        values,
        fastPeriod: fast_period,
        slowPeriod: slow_period,
        signalPeriod: signal_period,
        SimpleMAOscillator: false,
        SimpleMASignal: false,
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ symbol, macd: result }) }],
      };
    },
  );

  server.tool(
    "adx",
    "Calculate Average Directional Index for a symbol. Measures trend strength (0-100).",
    baseSchema,
    async ({ symbol, period = 14, start_datetime, end_datetime }) => {
      const candles = await fetchCandles(client, symbol, {
        startDatetime: start_datetime,
        endDatetime: end_datetime,
      });
      const result = ADX.calculate({
        high: candles.map((c) => c.high),
        low: candles.map((c) => c.low),
        close: candles.map((c) => c.close),
        period,
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ symbol, period, adx: result }) }],
      };
    },
  );

  server.tool(
    "bollinger_bands",
    "Calculate Bollinger Bands for a symbol. Returns upper, middle, lower bands and bandwidth.",
    {
      symbol: z.string().describe("Symbol of the security"),
      period: z.number().optional().describe("Number of periods (default 20)"),
      std_dev: z.number().optional().describe("Standard deviations (default 2)"),
      start_datetime: z.string().optional().describe("Start date (ISO format)"),
      end_datetime: z.string().optional().describe("End date (ISO format)"),
    },
    async ({ symbol, period = 20, std_dev = 2, start_datetime, end_datetime }) => {
      const candles = await fetchCandles(client, symbol, {
        startDatetime: start_datetime,
        endDatetime: end_datetime,
      });
      const values = closePrices(candles);
      const result = BollingerBands.calculate({
        period,
        values,
        stdDev: std_dev,
      });
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ symbol, period, stdDev: std_dev, bollingerBands: result }) },
        ],
      };
    },
  );

  server.tool(
    "pivot_points",
    "Calculate Pivot Points for a symbol using the most recent candle's high, low, close.",
    {
      symbol: z.string().describe("Symbol of the security"),
      start_datetime: z.string().optional().describe("Start date (ISO format)"),
      end_datetime: z.string().optional().describe("End date (ISO format)"),
    },
    async ({ symbol, start_datetime, end_datetime }) => {
      const candles = await fetchCandles(client, symbol, {
        startDatetime: start_datetime,
        endDatetime: end_datetime,
      });
      if (candles.length === 0) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "No candle data available" }) }],
        };
      }
      const last = candles[candles.length - 1];
      const pivot = (last.high + last.low + last.close) / 3;
      const r1 = 2 * pivot - last.low;
      const s1 = 2 * pivot - last.high;
      const r2 = pivot + (last.high - last.low);
      const s2 = pivot - (last.high - last.low);
      const r3 = last.high + 2 * (pivot - last.low);
      const s3 = last.low - 2 * (last.high - pivot);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              symbol,
              pivot,
              resistance: { r1, r2, r3 },
              support: { s1, s2, s3 },
            }),
          },
        ],
      };
    },
  );

  server.tool(
    "vwap",
    "Calculate Volume Weighted Average Price for a symbol.",
    {
      symbol: z.string().describe("Symbol of the security"),
      start_datetime: z.string().optional().describe("Start date (ISO format)"),
      end_datetime: z.string().optional().describe("End date (ISO format)"),
    },
    async ({ symbol, start_datetime, end_datetime }) => {
      const candles = await fetchCandles(client, symbol, {
        frequencyType: "minute",
        frequency: 1,
        startDatetime: start_datetime,
        endDatetime: end_datetime,
      });
      const result = VWAP.calculate({
        high: candles.map((c) => c.high),
        low: candles.map((c) => c.low),
        close: candles.map((c) => c.close),
        volume: candles.map((c) => c.volume),
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ symbol, vwap: result }) }],
      };
    },
  );

  server.tool(
    "atr",
    "Calculate Average True Range for a symbol. Measures volatility.",
    baseSchema,
    async ({ symbol, period = 14, start_datetime, end_datetime }) => {
      const candles = await fetchCandles(client, symbol, {
        startDatetime: start_datetime,
        endDatetime: end_datetime,
      });
      const result = ATR.calculate({
        high: candles.map((c) => c.high),
        low: candles.map((c) => c.low),
        close: candles.map((c) => c.close),
        period,
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ symbol, period, atr: result }) }],
      };
    },
  );

  server.tool(
    "historical_volatility",
    "Calculate Historical Volatility (annualized standard deviation of returns) for a symbol.",
    baseSchema,
    async ({ symbol, period = 20, start_datetime, end_datetime }) => {
      const candles = await fetchCandles(client, symbol, {
        startDatetime: start_datetime,
        endDatetime: end_datetime,
      });
      const closes = closePrices(candles);
      if (closes.length < 2) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Not enough data" }) }],
        };
      }

      // Calculate log returns
      const returns: number[] = [];
      for (let i = 1; i < closes.length; i++) {
        returns.push(Math.log(closes[i] / closes[i - 1]));
      }

      // Rolling standard deviation
      const hvValues: number[] = [];
      for (let i = period - 1; i < returns.length; i++) {
        const window = returns.slice(i - period + 1, i + 1);
        const mean = window.reduce((a, b) => a + b, 0) / window.length;
        const variance =
          window.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (window.length - 1);
        const annualized = Math.sqrt(variance) * Math.sqrt(252) * 100;
        hvValues.push(annualized);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ symbol, period, historicalVolatility: hvValues }),
          },
        ],
      };
    },
  );

  server.tool(
    "expected_move",
    "Calculate Expected Move for a symbol based on ATR or historical volatility.",
    {
      symbol: z.string().describe("Symbol of the security"),
      days: z.number().optional().describe("Number of days for expected move (default 1)"),
      start_datetime: z.string().optional().describe("Start date (ISO format)"),
      end_datetime: z.string().optional().describe("End date (ISO format)"),
    },
    async ({ symbol, days = 1, start_datetime, end_datetime }) => {
      const candles = await fetchCandles(client, symbol, {
        startDatetime: start_datetime,
        endDatetime: end_datetime,
      });
      const closes = closePrices(candles);
      if (closes.length < 21) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Not enough data (need 21+ candles)" }) }],
        };
      }

      // Calculate 20-day historical volatility
      const returns: number[] = [];
      for (let i = 1; i < closes.length; i++) {
        returns.push(Math.log(closes[i] / closes[i - 1]));
      }
      const recent = returns.slice(-20);
      const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
      const variance =
        recent.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (recent.length - 1);
      const dailyVol = Math.sqrt(variance);
      const lastPrice = closes[closes.length - 1];
      const expectedMove = lastPrice * dailyVol * Math.sqrt(days);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              symbol,
              days,
              lastPrice,
              expectedMove,
              expectedRange: {
                low: lastPrice - expectedMove,
                high: lastPrice + expectedMove,
              },
              dailyVolatility: dailyVol * 100,
              annualizedVolatility: dailyVol * Math.sqrt(252) * 100,
            }),
          },
        ],
      };
    },
  );
}
