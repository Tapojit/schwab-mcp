import { execSync } from "node:child_process";
import type { OAuthToken } from "./types.js";
import { TokenManager } from "./tokens.js";

const DEFAULT_MAX_TOKEN_AGE_MS = 5 * 24 * 60 * 60 * 1000; // 5 days
const OAUTH_TOKEN_URL = "/v1/oauth/token";
const OAUTH_AUTHORIZE_URL = "/v1/oauth/authorize";

interface AuthOptions {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  tokenManager: TokenManager;
  maxTokenAge?: number;
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
    const timeout = setTimeout(() => {
      server.stop(true);
      reject(
        new Error(
          "Timed out waiting for OAuth callback. " +
            `Set a longer timeout (current: ${callbackTimeout}s).`,
        ),
      );
    }, callbackTimeout * 1000);

    const server = Bun.serve({
      port,
      tls: {
        cert: selfSignedCert(),
        key: selfSignedKey(),
      },
      async fetch(req) {
        const url = new URL(req.url);

        // Health check endpoint
        if (url.pathname === "/schwab-py-internal/status") {
          return new Response("ok");
        }

        // Capture the authorization code
        const code = url.searchParams.get("code");
        if (!code) {
          return new Response("No authorization code received", { status: 400 });
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
          server.stop(true);
          resolve(oauthToken);
          return new Response(
            "<html><body><h1>Authentication successful!</h1><p>You can close this window.</p></body></html>",
            { headers: { "Content-Type": "text/html" } },
          );
        } catch (err) {
          clearTimeout(timeout);
          server.stop(true);
          reject(err);
          return new Response("Authentication failed", { status: 500 });
        }
      },
    });
  });

  return token;
}

export async function easyClient(opts: AuthOptions): Promise<OAuthToken> {
  const {
    tokenManager,
    clientId,
    clientSecret,
    maxTokenAge = DEFAULT_MAX_TOKEN_AGE_MS,
    baseUrl = "https://api.schwabapi.com",
  } = opts;

  // Try loading existing token
  if (tokenManager.exists()) {
    const token = tokenManager.load();
    const age = Date.now() - token.created_at;

    if (maxTokenAge > 0 && age >= maxTokenAge) {
      // Token too old, try refresh
      try {
        const refreshed = await refreshToken(
          clientId,
          clientSecret,
          token.refresh_token,
          baseUrl,
        );
        tokenManager.save(refreshed);
        return refreshed;
      } catch {
        // Refresh failed, fall through to login flow
      }
    } else {
      // Token is fresh enough — still try to refresh access_token if expired
      const expiresAt = token.created_at + token.expires_in * 1000;
      if (Date.now() >= expiresAt) {
        try {
          const refreshed = await refreshToken(
            clientId,
            clientSecret,
            token.refresh_token,
            baseUrl,
          );
          tokenManager.save(refreshed);
          return refreshed;
        } catch {
          // Fall through
        }
      }
      return token;
    }
  }

  // No valid token, need login flow
  return clientFromLoginFlow(opts);
}

// Self-signed cert generation for local callback server
// These are generated once and embedded — adequate for localhost OAuth callback
function selfSignedCert(): string {
  return `-----BEGIN CERTIFICATE-----
MIICpDCCAYwCCQDU+pQ4pHgSpDANBgkqhkiG9w0BAQsFADAUMRIwEAYDVQQDDAls
b2NhbGhvc3QwHhcNMjQwMTAxMDAwMDAwWhcNMjUwMTAxMDAwMDAwWjAUMRIwEAYD
VQQDDAlsb2NhbGhvc3QwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQC7
o4qne60TB3pRBMzSBMbMKeFUGkJPHYAhIDe0MlFahbOoey1E3pW5UKr5WKZMSRST
q4NenEJRQ0hJiGJIGPl1Ri/L7Eel/cGFRNMFHBzQGKYCX+AZZX6lJOhQUTGGNR6
x0GwVBMGKgPnqFfwRAsJRh+DqbQXBY9sZ7E+BLIak0MRFmmnyTEHGnOlhT1CZTUU
KDuH2Rj0Sy1GOqYEZJPn7PQKyVizS/vy7PxpFG3JFe3Yku4SOFl6JMFaB0me22p
DDv05FUZDNDqaYrA2aQ/aqNqH/1xVPQyMJ3Sl1a3vRdLy5UDndECnGbPNz0MMGE
Y0IoMn3nLF99Y1M6sLnlAgMBAAEwDQYJKoZIhvcNAQELBQADggEBAGmLq4ZPJGZK
OAdMHE+hPi5pRO7PkZo28SQ80l/OuVDffLNWiGPqW3E9CbcK2PFKUsOgJR+e7bNJ
o9h1+w0GRpOsEXTo07Js3cO9Fn4x4TX87qRDcYAD1ypxjWLqJw2GBfwn9OgB6kU
SckgpH8L0O8m1h4cNEPjDI+gqBRJHi/J3kXqGMW+GINR+Fv8P/4Va6SNfTDnBGKj
cX3YOTvNbFN26GkNJo6wrEFk6hGyKw3E/YCwPGyRDFC4sEHrfGJ3VjOTdVz0o+9S
qla3rPVfrb1PByBD3E2qRaKHsY2KBQM3LUFODRM4BgIAkQaJ0jGNqZG2QBt3lbXk
6PpQ7Cdj+CI=
-----END CERTIFICATE-----`;
}

function selfSignedKey(): string {
  return `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7o4qne60TB3pR
BMzSBMbMKeFUGkJPHYAhIDe0MlFahbOoey1E3pW5UKr5WKZMSRSTQ4NenEJRQ0hJ
iGJIGPl1Ri/L7Eel/cGFRNMFHBzQGKYCX+AZZX6lJOhQUTGGNR6x0GwVBMGKgPnq
FfwRAsJRh+DqbQXBY9sZ7E+BLIak0MRFmmnyTEHGnOlhT1CZTUUKDuH2Rj0Sy1GO
qYEZJPn7PQKyVizS/vy7PxpFG3JFe3Yku4SOFl6JMFaB0me22pDDv05FUZDNDqaY
rA2aQ/aqNqH/1xVPQyMJ3Sl1a3vRdLy5UDndECnGbPNz0MMGEY0IoMn3nLF99Y1M
6sLnlAgMBAAECggEAF2+JZpaqq6ZZFLQRBU/crl3CJVe5q9hTN44vtPhCLzHt9D7z
YYYW5S7bUyEL7LNCD3b/MCT2FPG8LaPDAzgK5FqN3JKxiYC8e9b1OjyiuGXKOxKm
8CtII5Iv1fcYjNW9NVKy7O5G2L1IzeYn3J3/CGTXhxOkMjGo5W26JcsfH5Hx7BWY
p6fWzScdmcGFpHsLfATk3Cni/R5aGXAD/5eiZ7gFp77Pa+vF5Ql/z2WT8wM3MK4R
GIJT1YqXSd/TOjPNM7z08iK3OQlA5Lk2S78D3gS2N13PKRG7WC/OHNY0VLf2VxaE
v0lbSMhjD1K/za5bFQOJDvI5QG4rPHOKSQEFHQKBgQD0M1kORX/O9ACKnvYwr/Pj
IFCDkOWkVcA3K1pH9jn/VFJlq8A/LKGxL+uQ9J1YSHKj0MdjME4W5ZQ/MYcMP3+E
RzFiIwQOSNIoJ9i6tMq9ZX9TFRCzjD2PDwRGHz5bVHfZaGr4/O8GEb7jLIhHcfTw
KvHGwJCrYLPQ7SrfPJcbrwKBgQDkLZhd7r0lJN7XNVeD4xhGlLB+1/+OxhRxwh+3
PvCK3Xs+cjijsMMp/WT7txdA7IREn0A1KO8SjTy98OMXSJnbWXzzqFJnK0k8N3XH
RPV3q9M8B3kCT4Omu5h/Nq+eBPKcIqtnQ3Jh/JQP3nRL9V8XRQH5+d6kCBIR+Y0
XqhLKwKBgGVz3Q+Q8GFC0j6eU+iRMniexLcHPQDp5EPf1XEB8gPJ+G3L0UV/4Q/e
GkzN2pZzN/25nXT0seFNaHmi6DBF7wGN6wVH3KYYHuBPHOP/MrAX3eUJTK/2OQNZ
i3FMYwb9XHqo9FNBjkD+0PnHb+Z0L0vHPBGlBGHYhrLNMGJOYb0PAYJ/oIBNMXFk
TlA7pFc+C1Y4aNO8Qc7oZqGFJVnWFx/f/UoYcKYS8EZ4e0k3P9RPIW0bF8M4Hkk
djp7BhAQJPu5HS2b6FUHO8dbFaCd6pct/fRMzIFaP2K/n5Tl7P1pCOa5U+bMF1i5
NZMAK5fRbLH9ORMNPVf6+VTBrENfHN7X
-----END PRIVATE KEY-----`;
}
