import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import type { OAuthToken, Credentials } from "./types.js";

function userDataDir(appName: string): string {
  const platform = process.platform;
  if (platform === "darwin") {
    return join(homedir(), "Library", "Application Support", appName);
  }
  if (platform === "win32") {
    return join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), appName);
  }
  // Linux / other
  return join(process.env.XDG_DATA_HOME || join(homedir(), ".local", "share"), appName);
}

export function tokenPath(appName: string, filename = "token.json"): string {
  const dir = userDataDir(appName);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  return join(dir, filename);
}

export function credentialsPath(appName: string, filename = "credentials.json"): string {
  const dir = userDataDir(appName);
  mkdirSync(dir, { recursive: true });
  return join(dir, filename);
}

export class TokenManager {
  constructor(public readonly path: string) {}

  exists(): boolean {
    return existsSync(this.path);
  }

  load(): OAuthToken {
    const raw = readFileSync(this.path, "utf-8");
    return JSON.parse(raw) as OAuthToken;
  }

  save(token: OAuthToken): void {
    if (!token) return;
    const dir = dirname(this.path);
    mkdirSync(dir, { recursive: true });
    writeFileSync(this.path, JSON.stringify(token, null, 2), { mode: 0o600 });
  }

  tokenAge(): number {
    if (!this.exists()) return Infinity;
    const token = this.load();
    return Date.now() - token.created_at;
  }
}

export function loadCredentials(path: string): Partial<Credentials> {
  if (!existsSync(path)) return {};
  try {
    const raw = readFileSync(path, "utf-8");
    const data = JSON.parse(raw);
    if (typeof data !== "object" || data === null) return {};
    return data as Partial<Credentials>;
  } catch {
    return {};
  }
}

export function saveCredentials(
  path: string,
  clientId: string,
  clientSecret: string,
): void {
  const dir = dirname(path);
  mkdirSync(dir, { recursive: true });
  const data: Credentials = { client_id: clientId, client_secret: clientSecret };
  writeFileSync(path, JSON.stringify(data, null, 2), { mode: 0o600 });
}
