#

from collections.abc import Callable
from typing import Annotated, Any, cast

from mcp.server.fastmcp import FastMCP

from schwab_mcp.context import SchwabContext
from schwab_mcp.tools._registration import register_tool
from schwab_mcp.tools.utils import parse_date
from schwab_mcp.tools.utils import JSONType, call


async def get_order(
    ctx: SchwabContext,
    account_hash: Annotated[str, "Account hash for the Schwab account"],
    order_id: Annotated[str, "Order ID to get details for"],
) -> JSONType:
    """
    Returns details for a specific order (ID, status, price, quantity, execution details). Params: account_hash, order_id.
    """
    client = ctx.orders
    return await call(client.get_order, order_id=order_id, account_hash=account_hash)


async def get_orders(
    ctx: SchwabContext,
    account_hash: Annotated[
        str, "Account hash for the Schwab account (from get_account_numbers)"
    ],
    max_results: Annotated[int | None, "Maximum number of orders to return"] = None,
    from_date: Annotated[
        str | None,
        "Start date for orders ('YYYY-MM-DD', max 60 days past)",
    ] = None,
    to_date: Annotated[str | None, "End date for orders ('YYYY-MM-DD')"] = None,
    status: Annotated[
        list[str] | str | None,
        "Filter by order status (e.g., WORKING, FILLED, CANCELED). See full list below.",
    ] = None,
) -> JSONType:
    """
    Returns order history for an account. Filter by date range (max 60 days past) and status.
    Params: account_hash, max_results, from_date (YYYY-MM-DD), to_date (YYYY-MM-DD), status (list/str).
    Status options: AWAITING_PARENT_ORDER, AWAITING_CONDITION, AWAITING_STOP_CONDITION, AWAITING_MANUAL_REVIEW, ACCEPTED, AWAITING_UR_OUT, PENDING_ACTIVATION, QUEUED, WORKING, REJECTED, PENDING_CANCEL, CANCELED, PENDING_REPLACE, REPLACED, FILLED, EXPIRED, NEW, AWAITING_RELEASE_TIME, PENDING_ACKNOWLEDGEMENT, PENDING_RECALL.
    Use tomorrow's date as to_date for today's orders. Use WORKING/PENDING_ACTIVATION for open orders.
    """
    client = ctx.orders

    from_date_obj = parse_date(from_date)
    to_date_obj = parse_date(to_date)

    kwargs: dict[str, Any] = {
        "max_results": max_results,
        "from_entered_datetime": from_date_obj,
        "to_entered_datetime": to_date_obj,
    }

    if status:
        if isinstance(status, str):
            kwargs["status"] = client.Order.Status[status.upper()]
            return await call(
                client.get_orders_for_account,
                account_hash,
                **kwargs,
            )
        else:
            # Multiple statuses: make separate calls and merge results
            all_orders: list[Any] = []
            seen_order_ids: set[str] = set()
            for s in status:
                kwargs["status"] = client.Order.Status[s.upper()]
                result = await call(
                    client.get_orders_for_account,
                    account_hash,
                    **kwargs,
                )
                if result:
                    for order in cast(list[Any], result):
                        order_id = str(order.get("orderId", ""))
                        if order_id and order_id not in seen_order_ids:
                            seen_order_ids.add(order_id)
                            all_orders.append(order)
            return all_orders if all_orders else []

    return await call(
        client.get_orders_for_account,
        account_hash,
        **kwargs,
    )


_READ_ONLY_TOOLS = (
    get_order,
    get_orders,
)


def register(
    server: FastMCP,
    *,
    result_transform: Callable[[Any], Any] | None = None,
) -> None:
    for func in _READ_ONLY_TOOLS:
        register_tool(server, func, result_transform=result_transform)
