import { execSync } from "node:child_process";
import { createServer, type Server } from "node:https";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { OAuthToken } from "./types.js";
import { TokenManager } from "./tokens.js";

const OAUTH_TOKEN_URL = "/v1/oauth/token";
const OAUTH_AUTHORIZE_URL = "/v1/oauth/authorize";

const REFRESH_MAX_RETRIES = 3;
const REFRESH_BACKOFF_MS = [1000, 2000, 4000];

interface AuthOptions {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  tokenManager: TokenManager;
  callbackTimeout?: number;
  interactive?: boolean;
  baseUrl?: string;
}

function basicAuth(clientId: string, clientSecret: string): string {
  return "Basic " + btoa(`${clientId}:${clientSecret}`);
}

export async function refreshToken(
  clientId: string,
  clientSecret: string,
  refreshTokenValue: string,
  baseUrl: string,
): Promise<OAuthToken> {
  const url = `${baseUrl}${OAUTH_TOKEN_URL}`;
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshTokenValue,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: basicAuth(clientId, clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Token refresh failed (${res.status}): ${text}`,
    );
  }

  const data = await res.json();
  return {
    ...data,
    created_at: Date.now(),
  } as OAuthToken;
}

export async function refreshTokenWithRetry(
  clientId: string,
  clientSecret: string,
  refreshTokenValue: string,
  baseUrl: string,
): Promise<OAuthToken> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= REFRESH_MAX_RETRIES; attempt++) {
    try {
      return await refreshToken(clientId, clientSecret, refreshTokenValue, baseUrl);
    } catch (err) {
      lastError = err;
      if (attempt < REFRESH_MAX_RETRIES) {
        const delay = REFRESH_BACKOFF_MS[attempt] ?? 4000;
        console.error(
          `Token refresh attempt ${attempt + 1} failed, retrying in ${delay}ms...`,
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

async function exchangeCode(
  code: string,
  clientId: string,
  clientSecret: string,
  callbackUrl: string,
  baseUrl: string,
): Promise<OAuthToken> {
  const url = `${baseUrl}${OAUTH_TOKEN_URL}`;
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: callbackUrl,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: basicAuth(clientId, clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return {
    ...data,
    created_at: Date.now(),
  } as OAuthToken;
}

function buildAuthorizationUrl(
  clientId: string,
  callbackUrl: string,
  baseUrl: string,
): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: callbackUrl,
  });
  return `${baseUrl}${OAUTH_AUTHORIZE_URL}?${params.toString()}`;
}

export async function clientFromLoginFlow(
  opts: AuthOptions,
): Promise<OAuthToken> {
  const {
    clientId,
    clientSecret,
    callbackUrl,
    tokenManager,
    callbackTimeout = 300,
    interactive = true,
    baseUrl = "https://api.schwabapi.com",
  } = opts;

  const parsed = new URL(callbackUrl);
  if (parsed.hostname !== "127.0.0.1") {
    throw new Error(
      `Disallowed hostname ${parsed.hostname}. Only 127.0.0.1 is allowed for callback URLs.`,
    );
  }

  const port = parseInt(parsed.port) || 443;
  const authUrl = buildAuthorizationUrl(clientId, callbackUrl, baseUrl);

  if (interactive) {
    console.log();
    console.log("***********************************************************************");
    console.log();
    console.log("Browser-assisted login and token creation flow for schwab-mcp.");
    console.log("This flow opens the login page, captures the OAuth callback,");
    console.log("and creates a token from the result.");
    console.log();
    console.log("Authorization URL:");
    console.log(">>", authUrl);
    console.log();
    console.log("IMPORTANT: Your browser may warn about an invalid certificate.");
    console.log("This is because a local HTTPS server uses a self-signed cert.");
    console.log("Verify the URL matches your callback URL before proceeding.");
    console.log();
    console.log("Callback URL:", callbackUrl);
    console.log("***********************************************************************");
    console.log();
  }

  // Open browser
  try {
    const platform = process.platform;
    if (platform === "darwin") {
      execSync(`open "${authUrl}"`);
    } else if (platform === "win32") {
      execSync(`start "${authUrl}"`);
    } else {
      execSync(`xdg-open "${authUrl}"`);
    }
  } catch {
    if (interactive) {
      console.log("Could not open browser automatically. Please visit the URL above.");
    }
  }

  // Start local HTTPS server to capture callback
  const token = await new Promise<OAuthToken>((resolve, reject) => {
    let server: Server;

    const timeout = setTimeout(() => {
      server.close();
      reject(
        new Error(
          "Timed out waiting for OAuth callback. " +
            `Set a longer timeout (current: ${callbackTimeout}s).`,
        ),
      );
    }, callbackTimeout * 1000);

    const tls = generateSelfSignedTls();
    server = createServer(
      { cert: tls.cert, key: tls.key },
      async (req, res) => {
        const url = new URL(req.url ?? "/", `https://127.0.0.1:${port}`);

        // Health check endpoint
        if (url.pathname === "/schwab-py-internal/status") {
          res.writeHead(200);
          res.end("ok");
          return;
        }

        // Capture the authorization code
        const code = url.searchParams.get("code");
        if (!code) {
          res.writeHead(400);
          res.end("No authorization code received");
          return;
        }

        try {
          const oauthToken = await exchangeCode(
            code,
            clientId,
            clientSecret,
            callbackUrl,
            baseUrl,
          );
          tokenManager.save(oauthToken);
          clearTimeout(timeout);
          resolve(oauthToken);
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(
            "<html><body><h1>Authentication successful!</h1><p>You can close this window.</p></body></html>",
          );
          // Delay server shutdown so the response reaches the browser
          setTimeout(() => server.close(), 1000);
        } catch (err) {
          clearTimeout(timeout);
          reject(err);
          res.writeHead(500);
          res.end("Authentication failed");
          setTimeout(() => server.close(), 1000);
        }
      },
    );

    server.listen(port);
  });

  return token;
}

export async function easyClient(opts: AuthOptions): Promise<OAuthToken> {
  const {
    tokenManager,
    clientId,
    clientSecret,
    interactive = true,
    baseUrl = "https://api.schwabapi.com",
  } = opts;

  // Try loading existing token
  if (tokenManager.exists()) {
    const token = tokenManager.load();
    const expiresAt = token.created_at + token.expires_in * 1000;

    // Access token still valid — use it
    if (Date.now() < expiresAt) {
      return token;
    }

    // Access token expired — attempt refresh with retries
    try {
      const refreshed = await refreshTokenWithRetry(
        clientId,
        clientSecret,
        token.refresh_token,
        baseUrl,
      );
      tokenManager.save(refreshed);
      return refreshed;
    } catch (err) {
      if (!interactive) {
        throw new Error(
          `Token refresh failed and server is non-interactive. ` +
            `Please run 'schwab-mcp auth' to re-authenticate. Cause: ${err}`,
        );
      }
      // Fall through to login flow
    }
  }

  // No valid token or refresh failed — need login flow
  return clientFromLoginFlow(opts);
}

// Generate a self-signed certificate at runtime for the local OAuth callback server.
// The cert/key are created in a temp directory and cleaned up after use.
let _cachedTls: { cert: string; key: string } | null = null;

function generateSelfSignedTls(): { cert: string; key: string } {
  if (_cachedTls) return _cachedTls;

  const dir = mkdtempSync(join(tmpdir(), "schwab-mcp-tls-"));
  const keyPath = join(dir, "key.pem");
  const certPath = join(dir, "cert.pem");

  try {
    execSync(
      `openssl req -x509 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -subj '/CN=127.0.0.1' 2>/dev/null`,
    );

    const cert = readFileSync(certPath, "utf-8");
    const key = readFileSync(keyPath, "utf-8");
    _cachedTls = { cert, key };
    return _cachedTls;
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {}
  }
}
