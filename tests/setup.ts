import type { SchwabClient } from "../src/client.js";
import type { JSONValue } from "../src/types.js";

type MockFn = ReturnType<typeof import("bun:test")["mock"]>;

/**
 * Create a mock SchwabClient where every method returns the given default value.
 * Override specific methods by passing them in the overrides object.
 */
export function makeMockClient(
  overrides: Partial<Record<keyof SchwabClient, (...args: any[]) => Promise<JSONValue>>> = {},
): SchwabClient {
  const defaultReturn = async () => null as JSONValue;
  const methods: Array<keyof SchwabClient> = [
    "getAccountNumbers",
    "getAccounts",
    "getAccount",
    "getUserPreferences",
    "getOrder",
    "getOrdersForAccount",
    "getTransactions",
    "getTransaction",
    "getQuotes",
    "getPriceHistory",
    "getMovers",
    "getMarketHours",
    "getMarketHoursForMarket",
    "getInstruments",
    "getInstrumentByCusip",
    "getOptionChain",
    "getExpirationChain",
  ];

  const client: Record<string, unknown> = {};
  for (const method of methods) {
    client[method] = overrides[method] ?? defaultReturn;
  }
  // Stubs for lifecycle methods that tools/server tests don't exercise
  client.setAuthFailureCallback = () => {};
  client.startBackgroundRefresh = () => {};
  client.stopBackgroundRefresh = () => {};
  return client as unknown as SchwabClient;
}
