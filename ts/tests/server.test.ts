import { describe, test, expect } from "bun:test";
import { SchwabMCPServer } from "../src/server.js";
import { makeMockClient } from "./setup.js";

describe("SchwabMCPServer", () => {
  test("creates server with all tools enabled", () => {
    const client = makeMockClient();
    const server = new SchwabMCPServer("test-server", client as any, {
      enableTechnicalTools: true,
    });
    expect(server).toBeDefined();
  });

  test("creates server with technical tools disabled", () => {
    const client = makeMockClient();
    const server = new SchwabMCPServer("test-server", client as any, {
      enableTechnicalTools: false,
    });
    expect(server).toBeDefined();
  });
});
