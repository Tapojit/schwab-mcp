// Schwab API types derived from OpenAPI specifications

export class SchwabAPIError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly url: string,
    public readonly body: string,
  ) {
    super(
      `Schwab API request failed; status=${statusCode}; url=${url}; body=${body}`,
    );
    this.name = "SchwabAPIError";
  }
}

export class AuthenticationRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthenticationRequiredError";
  }
}

// -- Enums --

export const MarketType = {
  EQUITY: "equity",
  OPTION: "option",
  BOND: "bond",
  FUTURE: "future",
  FOREX: "forex",
} as const;
export type MarketType = (typeof MarketType)[keyof typeof MarketType];

export const ProjectionType = {
  SYMBOL_SEARCH: "symbol-search",
  SYMBOL_REGEX: "symbol-regex",
  DESCRIPTION_SEARCH: "desc-search",
  DESCRIPTION_REGEX: "desc-regex",
  SEARCH: "search",
  FUNDAMENTAL: "fundamental",
} as const;
export type ProjectionType = (typeof ProjectionType)[keyof typeof ProjectionType];

export const MoverIndex = {
  DJI: "$DJI",
  COMPX: "$COMPX",
  SPX: "$SPX",
  NYSE: "NYSE",
  NASDAQ: "NASDAQ",
  OTCBB: "OTCBB",
  INDEX_ALL: "INDEX_ALL",
  EQUITY_ALL: "EQUITY_ALL",
  OPTION_ALL: "OPTION_ALL",
  OPTION_PUT: "OPTION_PUT",
  OPTION_CALL: "OPTION_CALL",
} as const;
export type MoverIndex = (typeof MoverIndex)[keyof typeof MoverIndex];

export const MoverSort = {
  VOLUME: "VOLUME",
  TRADES: "TRADES",
  PERCENT_CHANGE_UP: "PERCENT_CHANGE_UP",
  PERCENT_CHANGE_DOWN: "PERCENT_CHANGE_DOWN",
} as const;
export type MoverSort = (typeof MoverSort)[keyof typeof MoverSort];

export const MoverFrequency = {
  ZERO: 0,
  ONE: 1,
  FIVE: 5,
  TEN: 10,
  THIRTY: 30,
  SIXTY: 60,
} as const;
export type MoverFrequency =
  (typeof MoverFrequency)[keyof typeof MoverFrequency];

export const OrderStatus = {
  AWAITING_PARENT_ORDER: "AWAITING_PARENT_ORDER",
  AWAITING_CONDITION: "AWAITING_CONDITION",
  AWAITING_STOP_CONDITION: "AWAITING_STOP_CONDITION",
  AWAITING_MANUAL_REVIEW: "AWAITING_MANUAL_REVIEW",
  ACCEPTED: "ACCEPTED",
  AWAITING_UR_OUT: "AWAITING_UR_OUT",
  PENDING_ACTIVATION: "PENDING_ACTIVATION",
  QUEUED: "QUEUED",
  WORKING: "WORKING",
  REJECTED: "REJECTED",
  PENDING_CANCEL: "PENDING_CANCEL",
  CANCELED: "CANCELED",
  PENDING_REPLACE: "PENDING_REPLACE",
  REPLACED: "REPLACED",
  FILLED: "FILLED",
  EXPIRED: "EXPIRED",
  NEW: "NEW",
  AWAITING_RELEASE_TIME: "AWAITING_RELEASE_TIME",
  PENDING_ACKNOWLEDGEMENT: "PENDING_ACKNOWLEDGEMENT",
  PENDING_RECALL: "PENDING_RECALL",
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const TransactionType = {
  TRADE: "TRADE",
  RECEIVE_AND_DELIVER: "RECEIVE_AND_DELIVER",
  DIVIDEND_OR_INTEREST: "DIVIDEND_OR_INTEREST",
  ACH_RECEIPT: "ACH_RECEIPT",
  ACH_DISBURSEMENT: "ACH_DISBURSEMENT",
  CASH_RECEIPT: "CASH_RECEIPT",
  CASH_DISBURSEMENT: "CASH_DISBURSEMENT",
  ELECTRONIC_FUND: "ELECTRONIC_FUND",
  WIRE_OUT: "WIRE_OUT",
  WIRE_IN: "WIRE_IN",
  JOURNAL: "JOURNAL",
  MEMORANDUM: "MEMORANDUM",
  MARGIN_CALL: "MARGIN_CALL",
  MONEY_MARKET: "MONEY_MARKET",
  SMA_ADJUSTMENT: "SMA_ADJUSTMENT",
} as const;
export type TransactionType =
  (typeof TransactionType)[keyof typeof TransactionType];

export const PeriodType = {
  DAY: "day",
  MONTH: "month",
  YEAR: "year",
  YTD: "ytd",
} as const;
export type PeriodType = (typeof PeriodType)[keyof typeof PeriodType];

export const FrequencyType = {
  MINUTE: "minute",
  DAILY: "daily",
  WEEKLY: "weekly",
  MONTHLY: "monthly",
} as const;
export type FrequencyType =
  (typeof FrequencyType)[keyof typeof FrequencyType];

export const QuoteField = {
  QUOTE: "quote",
  FUNDAMENTAL: "fundamental",
  EXTENDED: "extended",
  REFERENCE: "reference",
  REGULAR: "regular",
} as const;
export type QuoteField = (typeof QuoteField)[keyof typeof QuoteField];

// -- API Response Interfaces --

export type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [key: string]: JSONValue };

export interface AccountNumberHash {
  accountNumber: string;
  hashValue: string;
}

export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  datetime: number;
}

export interface CandleList {
  candles: Candle[];
  empty: boolean;
  previousClose?: number;
  previousCloseDate?: number;
  symbol: string;
}

export interface Screener {
  change: number;
  description: string;
  direction: string;
  last: number;
  symbol: string;
  totalVolume: number;
}

// -- Token --

export interface OAuthToken {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  created_at: number; // epoch ms
}

export interface Credentials {
  client_id: string;
  client_secret: string;
}

// -- Price History Options --

export interface PriceHistoryOptions {
  periodType?: string;
  period?: number;
  frequencyType?: string;
  frequency?: number;
  startDate?: number; // epoch ms
  endDate?: number; // epoch ms
  needExtendedHoursData?: boolean;
  needPreviousClose?: boolean;
}

// -- Order Query Options --

export interface OrderQueryOptions {
  maxResults?: number;
  fromEnteredTime?: string; // ISO-8601
  toEnteredTime?: string; // ISO-8601
  status?: string;
}

// -- Transaction Query Options --

export interface TransactionQueryOptions {
  startDate?: string; // ISO-8601
  endDate?: string; // ISO-8601
  types?: string; // comma-separated TransactionType values
  symbol?: string;
}
