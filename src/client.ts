import { SchwabAPIError, AuthenticationRequiredError } from "./types.js";
import type {
  OAuthToken,
  PriceHistoryOptions,
  OrderQueryOptions,
  TransactionQueryOptions,
  JSONValue,
} from "./types.js";
import { TokenManager } from "./tokens.js";
import { refreshTokenWithRetry } from "./auth.js";

const BACKGROUND_REFRESH_INTERVAL_MS = 25 * 60 * 1000; // 25 minutes

export type AuthFailureCallback = (message: string) => void;

export class SchwabClient {
  private accessToken: string;
  private tokenData: OAuthToken;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private onAuthFailure: AuthFailureCallback | null = null;
  private refreshInFlight: Promise<OAuthToken> | null = null;

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly tokenManager: TokenManager,
    private readonly baseUrl: string = "https://api.schwabapi.com",
  ) {
    this.tokenData = tokenManager.load();
    this.accessToken = this.tokenData.access_token;
  }

  setAuthFailureCallback(cb: AuthFailureCallback): void {
    this.onAuthFailure = cb;
  }

  /** Serialized token refresh — concurrent callers share the same in-flight request. */
  private doRefresh(): Promise<OAuthToken> {
    if (this.refreshInFlight) return this.refreshInFlight;
    this.refreshInFlight = refreshTokenWithRetry(
      this.clientId,
      this.clientSecret,
      this.tokenData.refresh_token,
      this.baseUrl,
    ).then(
      (refreshed) => {
        this.tokenManager.save(refreshed);
        this.tokenData = refreshed;
        this.accessToken = refreshed.access_token;
        return refreshed;
      },
    ).finally(() => {
      this.refreshInFlight = null;
    });
    return this.refreshInFlight;
  }

  startBackgroundRefresh(): void {
    if (this.refreshTimer) return;
    const timer = setInterval(async () => {
      try {
        await this.doRefresh();
      } catch (err) {
        console.error(`Background token refresh failed: ${err}`);
        this.onAuthFailure?.(
          "Authentication expired. Please run 'schwab-mcp auth' to re-authenticate.",
        );
      }
    }, BACKGROUND_REFRESH_INTERVAL_MS);
    timer.unref();
    this.refreshTimer = timer;
  }

  stopBackgroundRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private async ensureFreshToken(): Promise<void> {
    const expiresAt = this.tokenData.created_at + this.tokenData.expires_in * 1000;
    if (Date.now() < expiresAt) return;

    try {
      await this.doRefresh();
    } catch (err) {
      this.onAuthFailure?.(
        "Authentication expired. Please run 'schwab-mcp auth' to re-authenticate.",
      );
      throw new AuthenticationRequiredError(
        `Token refresh failed. Please run 'schwab-mcp auth' to re-authenticate. Cause: ${err}`,
      );
    }
  }

  private async request(
    path: string,
    params?: Record<string, string | undefined>,
  ): Promise<JSONValue> {
    await this.ensureFreshToken();

    const url = new URL(path, this.baseUrl);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) url.searchParams.set(k, v);
      }
    }

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const body = await res.text();
      // Retry once on 401 (token may have been invalidated server-side)
      if (res.status === 401) {
        try {
          await this.doRefresh();

          const retry = await fetch(url.toString(), {
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
              Accept: "application/json",
            },
          });
          if (!retry.ok) {
            const retryBody = await retry.text();
            throw new SchwabAPIError(retry.status, url.toString(), retryBody);
          }
          if (retry.status === 204) return null;
          return (await retry.json()) as JSONValue;
        } catch (err) {
          if (err instanceof SchwabAPIError) throw err;
          this.onAuthFailure?.(
            "Authentication expired. Please run 'schwab-mcp auth' to re-authenticate.",
          );
          throw new AuthenticationRequiredError(
            `Token refresh failed after 401. Please run 'schwab-mcp auth' to re-authenticate. Cause: ${err}`,
          );
        }
      }
      throw new SchwabAPIError(res.status, url.toString(), body);
    }

    if (res.status === 204) return null;
    const contentLength = res.headers.get("content-length");
    if (contentLength === "0") return null;

    return (await res.json()) as JSONValue;
  }

  // ── Trader API: Accounts ──

  async getAccountNumbers(): Promise<JSONValue> {
    return this.request("/trader/v1/accounts/accountNumbers");
  }

  async getAccounts(fields?: string): Promise<JSONValue> {
    return this.request("/trader/v1/accounts", {
      fields,
    });
  }

  async getAccount(accountHash: string, fields?: string): Promise<JSONValue> {
    return this.request(`/trader/v1/accounts/${accountHash}`, {
      fields,
    });
  }

  async getUserPreferences(): Promise<JSONValue> {
    return this.request("/trader/v1/userPreference");
  }

  // ── Trader API: Orders ──

  async getOrder(
    accountHash: string,
    orderId: string,
  ): Promise<JSONValue> {
    return this.request(
      `/trader/v1/accounts/${accountHash}/orders/${orderId}`,
    );
  }

  async getOrdersForAccount(
    accountHash: string,
    opts: OrderQueryOptions = {},
  ): Promise<JSONValue> {
    return this.request(`/trader/v1/accounts/${accountHash}/orders`, {
      maxResults: opts.maxResults?.toString(),
      fromEnteredTime: opts.fromEnteredTime,
      toEnteredTime: opts.toEnteredTime,
      status: opts.status,
    });
  }

  // ── Trader API: Transactions ──

  async getTransactions(
    accountHash: string,
    opts: TransactionQueryOptions = {},
  ): Promise<JSONValue> {
    return this.request(
      `/trader/v1/accounts/${accountHash}/transactions`,
      {
        startDate: opts.startDate,
        endDate: opts.endDate,
        types: opts.types,
        symbol: opts.symbol,
      },
    );
  }

  async getTransaction(
    accountHash: string,
    transactionId: string,
  ): Promise<JSONValue> {
    return this.request(
      `/trader/v1/accounts/${accountHash}/transactions/${transactionId}`,
    );
  }

  // ── Market Data API: Quotes ──

  async getQuotes(
    symbols: string[],
    fields?: string,
    indicative?: boolean,
  ): Promise<JSONValue> {
    return this.request("/marketdata/v1/quotes", {
      symbols: symbols.join(","),
      fields,
      indicative: indicative?.toString(),
    });
  }

  // ── Market Data API: Price History ──

  async getPriceHistory(
    symbol: string,
    opts: PriceHistoryOptions = {},
  ): Promise<JSONValue> {
    return this.request("/marketdata/v1/pricehistory", {
      symbol,
      periodType: opts.periodType,
      period: opts.period?.toString(),
      frequencyType: opts.frequencyType,
      frequency: opts.frequency?.toString(),
      startDate: opts.startDate?.toString(),
      endDate: opts.endDate?.toString(),
      needExtendedHoursData: opts.needExtendedHoursData?.toString(),
      needPreviousClose: opts.needPreviousClose?.toString(),
    });
  }

  // ── Market Data API: Movers ──

  async getMovers(
    index: string,
    sort?: string,
    frequency?: number,
  ): Promise<JSONValue> {
    return this.request(`/marketdata/v1/movers/${index}`, {
      sort,
      frequency: frequency?.toString(),
    });
  }

  // ── Market Data API: Market Hours ──

  async getMarketHours(
    markets: string[],
    date?: string,
  ): Promise<JSONValue> {
    return this.request("/marketdata/v1/markets", {
      markets: markets.join(","),
      date,
    });
  }

  async getMarketHoursForMarket(
    market: string,
    date?: string,
  ): Promise<JSONValue> {
    return this.request(`/marketdata/v1/markets/${market}`, {
      date,
    });
  }

  // ── Market Data API: Instruments ──

  async getInstruments(
    symbol: string,
    projection: string,
  ): Promise<JSONValue> {
    return this.request("/marketdata/v1/instruments", {
      symbol,
      projection,
    });
  }

  async getInstrumentByCusip(cusip: string): Promise<JSONValue> {
    return this.request(`/marketdata/v1/instruments/${cusip}`);
  }

  // ── Market Data API: Option Chains ──

  async getOptionChain(
    params: Record<string, string | undefined>,
  ): Promise<JSONValue> {
    return this.request("/marketdata/v1/chains", params);
  }

  async getExpirationChain(symbol: string): Promise<JSONValue> {
    return this.request("/marketdata/v1/expirationchain", { symbol });
  }
}
