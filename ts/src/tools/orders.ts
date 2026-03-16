import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SchwabClient } from "../client.js";
import { parseDate } from "./utils.js";

export function register(server: McpServer, client: SchwabClient): void {
  server.tool(
    "get_order",
    "Returns details for a specific order (ID, status, price, quantity, execution details). Params: account_hash, order_id.",
    {
      account_hash: z
        .string()
        .describe("Account hash for the Schwab account"),
      order_id: z.string().describe("Order ID to get details for"),
    },
    async ({ account_hash, order_id }) => {
      const result = await client.getOrder(account_hash, order_id);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    },
  );

  server.tool(
    "get_orders",
    "Returns order history for an account. Filter by date range (max 60 days past) and status. Status options: AWAITING_PARENT_ORDER, AWAITING_CONDITION, AWAITING_STOP_CONDITION, WORKING, FILLED, CANCELED, EXPIRED, etc. Use tomorrow's date as to_date for today's orders.",
    {
      account_hash: z
        .string()
        .describe(
          "Account hash for the Schwab account (from get_account_numbers)",
        ),
      max_results: z
        .number()
        .optional()
        .describe("Maximum number of orders to return"),
      from_date: z
        .string()
        .optional()
        .describe("Start date for orders (YYYY-MM-DD, max 60 days past)"),
      to_date: z
        .string()
        .optional()
        .describe("End date for orders (YYYY-MM-DD)"),
      status: z
        .string()
        .optional()
        .describe(
          "Filter by order status (e.g., WORKING, FILLED, CANCELED). Comma-separated for multiple.",
        ),
    },
    async ({ account_hash, max_results, from_date, to_date, status }) => {
      const fromDate = parseDate(from_date);
      const toDate = parseDate(to_date);

      // If multiple statuses, make separate calls and merge
      if (status && status.includes(",")) {
        const statuses = status.split(",").map((s) => s.trim());
        const allOrders: unknown[] = [];
        const seenIds = new Set<string>();

        for (const s of statuses) {
          const result = await client.getOrdersForAccount(account_hash, {
            maxResults: max_results,
            fromEnteredTime: fromDate,
            toEnteredTime: toDate,
            status: s,
          });
          if (Array.isArray(result)) {
            for (const order of result) {
              const orderId = String(
                (order as Record<string, unknown>).orderId ?? "",
              );
              if (orderId && !seenIds.has(orderId)) {
                seenIds.add(orderId);
                allOrders.push(order);
              }
            }
          }
        }
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(allOrders) },
          ],
        };
      }

      const result = await client.getOrdersForAccount(account_hash, {
        maxResults: max_results,
        fromEnteredTime: fromDate,
        toEnteredTime: toDate,
        status: status?.trim(),
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    },
  );
}
