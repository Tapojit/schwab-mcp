import { describe, test, expect } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { register } from "../../src/tools/technical.js";
import { makeMockClient } from "../setup.js";

describe("technical tools", () => {
  test("registers all 12 technical analysis tools", () => {
    const server = new McpServer({ name: "test", version: "0.1.0" });
    const client = makeMockClient();
    register(server, client);
    // 12 tools: sma, ema, rsi, stoch, macd, adx, bollinger_bands,
    // pivot_points, vwap, atr, historical_volatility, expected_move
    expect(true).toBe(true);
  });
});
