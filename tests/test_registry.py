import asyncio
from typing import Any, cast

from mcp.server.fastmcp import FastMCP
from mcp.server.fastmcp.tools import Tool
from mcp.types import ToolAnnotations

from schwab_mcp.tools._registration import register_tool
from schwab_mcp.context import SchwabContext


async def _dummy_tool(ctx: SchwabContext) -> str:  # noqa: ARG001
    """dummy tool description"""
    return "ok"


def _registered_tools(server: FastMCP) -> list[Tool]:
    manager = getattr(server, "_tool_manager")
    return cast(list[Tool], manager.list_tools())


def _tool_by_name(server: FastMCP, name: str) -> Tool:
    tools = {tool.name: tool for tool in _registered_tools(server)}
    return tools[name]


def test_register_tool_sets_readonly_annotations() -> None:
    server = FastMCP(name="readonly")
    register_tool(server, _dummy_tool)

    tool = _tool_by_name(server, "_dummy_tool")
    annotations = tool.annotations
    assert isinstance(annotations, ToolAnnotations)
    assert annotations.readOnlyHint is True
    assert annotations.destructiveHint is None
    assert tool.description == (_dummy_tool.__doc__ or "")


def test_register_tool_applies_result_transform() -> None:
    server = FastMCP(name="transform")

    async def sample_tool() -> dict[str, str]:
        return {"ok": "yes"}

    captured: dict[str, Any] = {}

    def transform(payload: Any) -> str:
        captured["payload"] = payload
        return "encoded"

    register_tool(server, sample_tool, result_transform=transform)
    tool = _tool_by_name(server, "sample_tool")

    async def runner() -> str:
        return await tool.fn()

    result = asyncio.run(runner())
    assert result == "encoded"
    assert captured["payload"] == {"ok": "yes"}


def test_result_transform_preserves_strings() -> None:
    server = FastMCP(name="string-transform")

    async def sample_tool() -> str:
        return "already-string"

    captured: dict[str, Any] = {}

    def transform(payload: Any) -> str:
        captured["payload"] = payload
        if isinstance(payload, str):
            return payload
        return "encoded"

    register_tool(server, sample_tool, result_transform=transform)
    tool = _tool_by_name(server, "sample_tool")

    async def runner() -> str:
        return await tool.fn()

    result = asyncio.run(runner())
    assert result == "already-string"
    assert captured["payload"] == "already-string"
