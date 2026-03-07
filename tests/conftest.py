from __future__ import annotations

import asyncio
from types import SimpleNamespace
from typing import Any, cast

import pytest
from schwab.client import AsyncClient

from schwab_mcp.context import SchwabContext, SchwabServerContext


def make_ctx(client: Any) -> SchwabContext:
    lifespan_context = SchwabServerContext(
        client=cast(AsyncClient, client),
    )
    request_context = SimpleNamespace(lifespan_context=lifespan_context)
    return SchwabContext.model_construct(
        _request_context=cast(Any, request_context),
        _fastmcp=None,
    )


def run(coro: Any) -> Any:
    return asyncio.run(coro)


@pytest.fixture
def ctx_factory():
    return make_ctx


@pytest.fixture
def fake_call_capture():
    captured: dict[str, Any] = {}

    async def fake_call(func, *args, **kwargs):
        captured["func"] = func
        captured["args"] = args
        captured["kwargs"] = kwargs
        return "ok"

    return captured, fake_call


@pytest.fixture
def fake_call_factory():
    """Factory fixture for creating fake call mocks with optional return values.

    Returns a factory function that creates (captured_dict, fake_call) tuples.
    The fake_call function captures function calls for test assertions.

    Args:
        return_value: Optional value to return from fake_call (default: "ok")

    Returns:
        Tuple of (captured dict, async fake_call function)
    """

    def factory(return_value: Any = "ok"):
        captured: dict[str, Any] = {}

        async def fake_call(func, *args, **kwargs):
            captured["func"] = func
            captured["args"] = args
            captured["kwargs"] = kwargs
            return return_value

        return captured, fake_call

    return factory
