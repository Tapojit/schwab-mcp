import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
import { SchwabAPIError } from "../src/types.js";

// We test the client's request logic by mocking fetch globally
describe("SchwabClient request handling", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("SchwabAPIError has correct properties", () => {
    const err = new SchwabAPIError(401, "https://api.schwab.com/test", "Unauthorized");
    expect(err.statusCode).toBe(401);
    expect(err.url).toBe("https://api.schwab.com/test");
    expect(err.body).toBe("Unauthorized");
    expect(err.name).toBe("SchwabAPIError");
    expect(err.message).toContain("status=401");
  });
});
