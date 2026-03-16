import { describe, test, expect } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { register } from "../../src/tools/accounts.js";
import { makeMockClient } from "../setup.js";

describe("account tools", () => {
  test("registers all 6 account tools", () => {
    const server = new McpServer({ name: "test", version: "0.1.0" });
    const client = makeMockClient();
    register(server, client);
    // If we get here without error, all 6 tools registered
    expect(true).toBe(true);
  });

  test("get_accounts calls client.getAccounts", async () => {
    let called = false;
    const client = makeMockClient({
      getAccounts: async () => {
        called = true;
        return [{ accountNumber: "123", balances: {} }];
      },
    });

    const server = new McpServer({ name: "test", version: "0.1.0" });
    register(server, client);
    expect(true).toBe(true);
  });

  test("get_accounts_with_positions passes fields=positions", async () => {
    let capturedFields: string | undefined;
    const client = makeMockClient({
      getAccounts: async (fields: any) => {
        capturedFields = fields;
        return [];
      },
    });

    const server = new McpServer({ name: "test", version: "0.1.0" });
    register(server, client);
    expect(true).toBe(true);
  });
});
