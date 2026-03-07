from __future__ import annotations

from mcp.server.fastmcp import FastMCP

from schwab_mcp.resources import (
    ORDER_STATUSES,
    register_resources,
)


class TestStaticReferenceData:
    def test_order_statuses_has_required_keys(self):
        assert "statuses" in ORDER_STATUSES
        assert "common_queries" in ORDER_STATUSES
        assert "tips" in ORDER_STATUSES

    def test_order_statuses_includes_trailing_stop_status(self):
        assert "AWAITING_STOP_CONDITION" in ORDER_STATUSES["statuses"]
        assert (
            "AWAITING_STOP_CONDITION"
            in ORDER_STATUSES["common_queries"]["trailing_stops"]
        )


class TestRegisterResources:
    def test_registers_static_resources(self):
        import asyncio

        server = FastMCP(name="test")
        register_resources(server)

        resources = asyncio.run(server.list_resources())
        registered_uris = [str(r.uri) for r in resources]

        static_uris = [
            "schwab://reference/order-statuses",
        ]
        for uri in static_uris:
            assert uri in registered_uris, f"Missing resource: {uri}"
