"""TDD tests for new conftest fixtures.

These tests verify the behavior of three new fixtures that will be added to conftest.py:
- fake_call_factory: Creates a fake call function with optional return value
- order_response_factory: Creates a mock HTTP response for order placement
- place_order_client_factory: Creates a client that captures place_order() calls

Tests are written in RED phase (expected to fail until fixtures are implemented).
"""

from __future__ import annotations

import asyncio


class TestFakeCallFactory:
    """Tests for fake_call_factory fixture."""

    def test_fake_call_factory_returns_tuple(self, fake_call_factory):
        """Verify fake_call_factory returns (captured, fake_call) tuple."""
        result = fake_call_factory()
        assert isinstance(result, tuple)
        assert len(result) == 2

    def test_fake_call_factory_captures_function_reference(self, fake_call_factory):
        """Verify fake_call_factory captures the function being called."""
        captured, fake_call = fake_call_factory()

        async def dummy_func(x: int, y: int) -> int:
            return x + y

        asyncio.run(fake_call(dummy_func, 1, 2))

        assert captured["func"] == dummy_func

    def test_fake_call_factory_captures_positional_args(self, fake_call_factory):
        """Verify fake_call_factory captures positional arguments."""
        captured, fake_call = fake_call_factory()

        async def dummy_func(x: int, y: int) -> int:
            return x + y

        asyncio.run(fake_call(dummy_func, 42, 99))

        assert captured["args"] == (42, 99)

    def test_fake_call_factory_captures_keyword_args(self, fake_call_factory):
        """Verify fake_call_factory captures keyword arguments."""
        captured, fake_call = fake_call_factory()

        async def dummy_func(x: int, y: int) -> int:
            return x + y

        asyncio.run(fake_call(dummy_func, 1, 2, z=3, w=4))

        assert captured["kwargs"] == {"z": 3, "w": 4}

    def test_fake_call_factory_returns_default_value(self, fake_call_factory):
        """Verify fake_call_factory returns 'ok' by default."""
        captured, fake_call = fake_call_factory()

        async def dummy_func() -> None:
            pass

        result = asyncio.run(fake_call(dummy_func))

        assert result == "ok"

    def test_fake_call_factory_accepts_custom_return_value(self, fake_call_factory):
        """Verify fake_call_factory accepts optional return_value parameter."""
        custom_return = {"status": "success", "data": [1, 2, 3]}
        captured, fake_call = fake_call_factory(return_value=custom_return)

        async def dummy_func() -> None:
            pass

        result = asyncio.run(fake_call(dummy_func))

        assert result == custom_return

    def test_fake_call_factory_with_mixed_args_and_kwargs(self, fake_call_factory):
        """Verify fake_call_factory handles mixed args and kwargs correctly."""
        captured, fake_call = fake_call_factory()

        async def dummy_func(a: int, b: int, c: int = 0) -> int:
            return a + b + c

        asyncio.run(fake_call(dummy_func, 10, 20, c=30, d=40))

        assert captured["args"] == (10, 20)
        assert captured["kwargs"] == {"c": 30, "d": 40}


