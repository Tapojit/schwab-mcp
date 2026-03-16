/** Parse a YYYY-MM-DD string to a Date object, or return undefined. */
export function parseDate(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  // Validate format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid date format: ${value}. Expected YYYY-MM-DD.`);
  }
  return value;
}

/** Parse an ISO datetime string, or return undefined. */
export function parseDatetime(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  // Validate it's parseable
  const d = new Date(value);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid datetime: ${value}. Expected ISO format.`);
  }
  return value;
}

/** Convert ISO datetime string to epoch milliseconds, or return undefined. */
export function toEpochMs(value: string | undefined | null): number | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid datetime: ${value}`);
  }
  return d.getTime();
}

/** Format a result for MCP tool output — compact JSON string. */
export function formatResult(data: unknown): string {
  if (typeof data === "string") return data;
  return JSON.stringify(data);
}
