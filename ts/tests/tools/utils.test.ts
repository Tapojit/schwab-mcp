import { describe, test, expect } from "bun:test";
import { parseDate, parseDatetime, toEpochMs, formatResult } from "../../src/tools/utils.js";

describe("parseDate", () => {
  test("returns undefined for null/undefined", () => {
    expect(parseDate(null)).toBeUndefined();
    expect(parseDate(undefined)).toBeUndefined();
  });

  test("returns valid date string as-is", () => {
    expect(parseDate("2024-01-15")).toBe("2024-01-15");
  });

  test("throws for invalid format", () => {
    expect(() => parseDate("01/15/2024")).toThrow("Invalid date format");
  });
});

describe("parseDatetime", () => {
  test("returns undefined for null/undefined", () => {
    expect(parseDatetime(null)).toBeUndefined();
    expect(parseDatetime(undefined)).toBeUndefined();
  });

  test("returns valid ISO string as-is", () => {
    expect(parseDatetime("2024-01-15T09:30:00")).toBe("2024-01-15T09:30:00");
  });

  test("throws for invalid datetime", () => {
    expect(() => parseDatetime("not-a-date")).toThrow("Invalid datetime");
  });
});

describe("toEpochMs", () => {
  test("returns undefined for null/undefined", () => {
    expect(toEpochMs(null)).toBeUndefined();
    expect(toEpochMs(undefined)).toBeUndefined();
  });

  test("converts ISO string to epoch ms", () => {
    const ms = toEpochMs("2024-01-01T00:00:00Z");
    expect(ms).toBe(1704067200000);
  });
});

describe("formatResult", () => {
  test("returns string as-is", () => {
    expect(formatResult("hello")).toBe("hello");
  });

  test("stringifies objects", () => {
    expect(formatResult({ a: 1 })).toBe('{"a":1}');
  });

  test("stringifies arrays", () => {
    expect(formatResult([1, 2, 3])).toBe("[1,2,3]");
  });
});
