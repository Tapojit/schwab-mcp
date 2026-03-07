from __future__ import annotations

from collections.abc import Awaitable, Callable
import functools
import inspect
import sys
import types
from typing import Annotated, Any, Union, cast, get_args, get_origin, get_type_hints

from mcp.server.fastmcp import FastMCP, Context as MCPContext
from mcp.types import ToolAnnotations
from schwab_mcp.context import SchwabContext


ToolFn = Callable[..., Awaitable[Any]]


def _is_context_annotation(annotation: Any) -> bool:
    if annotation in (inspect._empty, None):
        return False
    if annotation is SchwabContext:
        return True
    if annotation == "SchwabContext":
        return True
    if isinstance(annotation, str):
        return annotation == "SchwabContext"

    origin = get_origin(annotation)
    if origin is None:
        return False

    if origin in (Annotated,):
        args = get_args(annotation)
        return bool(args) and _is_context_annotation(args[0])

    if origin in (Union, types.UnionType):
        return any(_is_context_annotation(arg) for arg in get_args(annotation))

    return False


def _resolve_context_parameters(func: ToolFn) -> tuple[inspect.Signature, list[str]]:
    signature = inspect.signature(func)

    module = sys.modules.get(func.__module__)
    globalns = vars(module) if module else {}

    type_hints: dict[str, Any]
    try:
        type_hints = get_type_hints(func, globalns=globalns, include_extras=True)
    except TypeError:
        type_hints = get_type_hints(func, globalns=globalns)
    except Exception:
        type_hints = {}

    ctx_params = []
    for name, param in signature.parameters.items():
        annotation = type_hints.get(name, param.annotation)
        if _is_context_annotation(annotation):
            ctx_params.append(name)

    return signature, ctx_params


def _ensure_schwab_context(func: ToolFn) -> ToolFn:
    signature, ctx_params = _resolve_context_parameters(func)
    if not ctx_params:
        return func

    @functools.wraps(func)
    async def wrapper(*args: Any, **kwargs: Any) -> Any:
        bound = signature.bind_partial(*args, **kwargs)
        for name in ctx_params:
            if name not in bound.arguments:
                continue
            value = bound.arguments[name]
            if isinstance(value, SchwabContext):
                continue
            if isinstance(value, MCPContext):
                bound.arguments[name] = SchwabContext.model_construct(
                    _request_context=value.request_context,
                    _fastmcp=getattr(value, "_fastmcp", None),
                )
            else:
                raise TypeError(
                    f"Argument '{name}' must be an MCP context, got {type(value)!r}"
                )

        result = func(*bound.args, **bound.kwargs)
        if inspect.isawaitable(result):
            return await result
        return result

    # Ensure annotations referencing names from the original module remain resolvable.
    wrapper_globals = cast(dict[str, Any], getattr(wrapper, "__globals__", {}))
    module = inspect.getmodule(func)
    if module is not None:
        module_globals = vars(module)
        if wrapper_globals is not module_globals:
            for key, value in module_globals.items():
                wrapper_globals.setdefault(key, value)

    return wrapper


def _wrap_result_transform(func: ToolFn, transform: Callable[[Any], Any]) -> ToolFn:
    @functools.wraps(func)
    async def wrapper(*args: Any, **kwargs: Any) -> Any:
        result = func(*args, **kwargs)
        if inspect.isawaitable(result):
            result = await result
        return transform(result)

    # Preserve global namespace similar to other wrappers
    wrapper_globals = cast(dict[str, Any], getattr(wrapper, "__globals__", {}))
    module = inspect.getmodule(func)
    if module is not None:
        module_globals = vars(module)
        if wrapper_globals is not module_globals:
            for key, value in module_globals.items():
                wrapper_globals.setdefault(key, value)

    return cast(ToolFn, wrapper)


def register_tool(
    server: FastMCP,
    func: ToolFn,
    *,
    annotations: ToolAnnotations | None = None,
    result_transform: Callable[[Any], Any] | None = None,
) -> None:
    """Register a read-only Schwab tool using FastMCP's decorator plumbing."""

    func = _ensure_schwab_context(func)
    if result_transform is not None:
        func = _wrap_result_transform(func, result_transform)

    tool_annotations = annotations
    if tool_annotations is None:
        tool_annotations = ToolAnnotations(readOnlyHint=True)
    else:
        if tool_annotations.readOnlyHint is None:
            tool_annotations = tool_annotations.model_copy(
                update={"readOnlyHint": True}
            )

    server.tool(
        name=func.__name__,
        description=func.__doc__,
        annotations=tool_annotations,
    )(func)


__all__ = ["register_tool"]
