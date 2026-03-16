import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const ORDER_STATUSES = {
  statuses: {
    AWAITING_PARENT_ORDER: "Child order waiting for parent to execute",
    AWAITING_CONDITION: "Order waiting for a condition to be met",
    AWAITING_STOP_CONDITION: "Stop/trailing stop waiting for trigger price",
    AWAITING_MANUAL_REVIEW: "Order requires manual review",
    ACCEPTED: "Order accepted by the system",
    AWAITING_UR_OUT: "Order awaiting UR out",
    PENDING_ACTIVATION: "Order scheduled for future activation",
    QUEUED: "Order queued for submission",
    WORKING: "Order is active in the market",
    REJECTED: "Order was rejected by exchange or broker",
    PENDING_CANCEL: "Cancel request submitted, awaiting confirmation",
    CANCELED: "Order was canceled",
    PENDING_REPLACE: "Replace request submitted, awaiting confirmation",
    REPLACED: "Order was replaced with a new order",
    FILLED: "Order completely executed",
    EXPIRED: "Order expired without filling",
    NEW: "Order newly created",
    AWAITING_RELEASE_TIME: "Order waiting for scheduled release time",
    PENDING_ACKNOWLEDGEMENT: "Order pending acknowledgement",
    PENDING_RECALL: "Order pending recall",
  },
  common_queries: {
    open_orders: ["WORKING", "PENDING_ACTIVATION", "AWAITING_STOP_CONDITION"],
    trailing_stops: ["AWAITING_STOP_CONDITION"],
    completed: ["FILLED", "CANCELED", "EXPIRED", "REJECTED"],
  },
  tips: [
    "Use AWAITING_STOP_CONDITION (not WORKING) to find trailing stops",
    "Use tomorrow's date as to_date for today's orders",
    "WORKING status is for regular limit/stop orders actively in market",
  ],
};

export function registerResources(server: McpServer): void {
  server.resource(
    "order-statuses",
    "schwab://reference/order-statuses",
    {
      description:
        "Reference guide for order status values, their meanings, and common queries.",
      mimeType: "application/json",
    },
    async () => ({
      contents: [
        {
          uri: "schwab://reference/order-statuses",
          mimeType: "application/json",
          text: JSON.stringify(ORDER_STATUSES),
        },
      ],
    }),
  );
}
