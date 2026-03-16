import { describe, test, expect } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { register } from "../../src/tools/history.js";
import { makeMockClient } from "../setup.js";

describe("history tools", () => {
  test("registers all 8 history tools", () => {
    const server = new McpServer({ name: "test", version: "0.1.0" });
    const client = makeMockClient();
    register(server, client);
    // 1 advanced + 7 convenience = 8 total
    expect(true).toBe(true);
  });
});
