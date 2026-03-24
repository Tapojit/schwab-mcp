import { describe, test, expect, afterEach } from "bun:test";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { TokenManager, loadCredentials, saveCredentials } from "../src/tokens.js";
import type { OAuthToken } from "../src/types.js";

const TEST_DIR = join(tmpdir(), `schwab-mcp-test-${Date.now()}`);

afterEach(() => {
  try {
    rmSync(TEST_DIR, { recursive: true, force: true });
  } catch {}
});

function makeToken(): OAuthToken {
  return {
    access_token: "test-access",
    refresh_token: "test-refresh",
    token_type: "Bearer",
    expires_in: 1800,
    scope: "api",
    created_at: Date.now(),
  };
}

describe("TokenManager", () => {
  test("save and load a token", () => {
    mkdirSync(TEST_DIR, { recursive: true });
    const path = join(TEST_DIR, "token.json");
    const mgr = new TokenManager(path);

    expect(mgr.exists()).toBe(false);

    const token = makeToken();
    mgr.save(token);

    expect(mgr.exists()).toBe(true);

    const loaded = mgr.load();
    expect(loaded.access_token).toBe("test-access");
    expect(loaded.refresh_token).toBe("test-refresh");
  });

  test("token age can be computed from loaded token", () => {
    mkdirSync(TEST_DIR, { recursive: true });
    const path = join(TEST_DIR, "token.json");
    const mgr = new TokenManager(path);

    const token = makeToken();
    token.created_at = Date.now() - 60_000; // 1 minute ago
    mgr.save(token);

    const loaded = mgr.load();
    const age = Date.now() - loaded.created_at;
    expect(age).toBeGreaterThan(50_000);
    expect(age).toBeLessThan(70_000);
  });
});

describe("Credentials", () => {
  test("save and load credentials", () => {
    mkdirSync(TEST_DIR, { recursive: true });
    const path = join(TEST_DIR, "creds.json");

    saveCredentials(path, "my-id", "my-secret");

    const loaded = loadCredentials(path);
    expect(loaded.client_id).toBe("my-id");
    expect(loaded.client_secret).toBe("my-secret");
  });

  test("loadCredentials returns empty object for missing file", () => {
    const path = join(TEST_DIR, "missing.json");
    const loaded = loadCredentials(path);
    expect(loaded).toEqual({});
  });
});
