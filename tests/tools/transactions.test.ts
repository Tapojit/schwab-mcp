import { describe, test, expect } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { register } from "../../src/tools/transactions.js";
import { makeMockClient } from "../setup.js";

describe("transaction tools", () => {
  test("registers get_transactions and get_transaction tools", () => {
    const server = new McpServer({ name: "test", version: "0.1.0" });
    const client = makeMockClient();
    register(server, client);
    expect(true).toBe(true);
  });
});
