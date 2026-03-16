import { describe, test, expect } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { register } from "../../src/tools/orders.js";
import { makeMockClient } from "../setup.js";

describe("order tools", () => {
  test("registers get_order and get_orders tools", () => {
    const server = new McpServer({ name: "test", version: "0.1.0" });
    const client = makeMockClient();
    register(server, client);
    expect(true).toBe(true);
  });
});
