import datetime
from enum import Enum
from typing import Any

from schwab_mcp.tools import orders

from conftest import make_ctx, run


class DummyOrdersClient:
    class Order:
        Status = Enum(
            "Status",
            "WORKING FILLED CANCELED REJECTED",
        )

    async def get_orders_for_account(self, *args, **kwargs):
        return None


class TestGetOrders:
    def test_maps_single_status_and_dates(self, monkeypatch):
        captured: dict[str, Any] = {}

        async def fake_call(func, *args, **kwargs):
            captured["func"] = func
            captured["args"] = args
            captured["kwargs"] = kwargs
            return "ok"

        monkeypatch.setattr(orders, "call", fake_call)

        client = DummyOrdersClient()
        ctx = make_ctx(client)
        result = run(
            orders.get_orders(
                ctx,
                "abc123",
                max_results=25,
                from_date="2024-04-01",
                to_date="2024-04-15",
                status="working",
            )
        )

        assert result == "ok"
        assert captured["func"] == client.get_orders_for_account

        args = captured["args"]
        assert isinstance(args, tuple)
        assert args == ("abc123",)

        kwargs = captured["kwargs"]
        assert isinstance(kwargs, dict)
        assert kwargs["max_results"] == 25
        assert kwargs["from_entered_datetime"] == datetime.date(2024, 4, 1)
        assert kwargs["to_entered_datetime"] == datetime.date(2024, 4, 15)
        assert kwargs["status"] is client.Order.Status.WORKING

    def test_maps_status_list(self, monkeypatch):
        # Multiple statuses require separate API calls (schwab-py limitation)
        calls: list[dict[str, Any]] = []

        async def fake_call(func, *args, **kwargs):
            calls.append({"func": func, "args": args, "kwargs": kwargs.copy()})
            # Return realistic order data with unique orderId per status
            status_val = kwargs.get("status")
            if status_val:
                return [{"orderId": f"order_{status_val.name}"}]
            return []

        monkeypatch.setattr(orders, "call", fake_call)

        client = DummyOrdersClient()
        ctx = make_ctx(client)
        result = run(
            orders.get_orders(
                ctx,
                "xyz789",
                status=["filled", "canceled"],
            )
        )

        # Should make two separate calls (one per status)
        assert len(calls) == 2
        assert calls[0]["func"] == client.get_orders_for_account
        assert calls[1]["func"] == client.get_orders_for_account

        # Each call should have a single status (not statuses plural)
        assert calls[0]["kwargs"]["status"] == client.Order.Status.FILLED
        assert calls[1]["kwargs"]["status"] == client.Order.Status.CANCELED

        # Results should be merged and deduplicated
        assert isinstance(result, list)
        assert len(result) == 2
        order_ids = {order["orderId"] for order in result}
        assert order_ids == {"order_FILLED", "order_CANCELED"}


class TestGetOrder:
    def test_calls_client_with_correct_args(self, monkeypatch):
        captured: dict[str, Any] = {}

        async def fake_call(func, *args, **kwargs):
            captured["func"] = func
            captured["kwargs"] = kwargs
            return {"orderId": "12345", "status": "FILLED"}

        monkeypatch.setattr(orders, "call", fake_call)

        class DummyClient:
            async def get_order(self, *args, **kwargs):
                return None

        client = DummyClient()
        ctx = make_ctx(client)
        result = run(orders.get_order(ctx, "hash123", "order456"))

        assert result == {"orderId": "12345", "status": "FILLED"}
        assert captured["func"] == client.get_order
        assert captured["kwargs"]["account_hash"] == "hash123"
        assert captured["kwargs"]["order_id"] == "order456"
