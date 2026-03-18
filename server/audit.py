"""Audit logging for MCP tool calls."""

import json
import time
from functools import wraps
from database import execute


async def log_mcp_call(
    tool_name: str,
    parameters: dict,
    response_rows: int = 0,
    response_time_ms: int = 0,
    error: str | None = None,
    user_id: str | None = None,
):
    """Log an MCP tool call to the audit table."""
    await execute(
        """
        INSERT INTO mcp_audit_log (tool_name, parameters, user_id, response_rows, response_time_ms, error)
        VALUES ($1, $2::jsonb, $3, $4, $5, $6)
        """,
        tool_name,
        json.dumps(parameters),
        user_id,
        response_rows,
        response_time_ms,
        error,
    )


def audited(tool_name: str):
    """Decorator to audit MCP tool calls."""
    def decorator(func):
        @wraps(func)
        async def wrapper(**kwargs):
            start = time.monotonic()
            error = None
            result = []
            try:
                result = await func(**kwargs)
                return result
            except Exception as e:
                error = str(e)
                raise
            finally:
                elapsed_ms = int((time.monotonic() - start) * 1000)
                row_count = len(result) if isinstance(result, list) else 1
                try:
                    await log_mcp_call(
                        tool_name=tool_name,
                        parameters=kwargs,
                        response_rows=row_count,
                        response_time_ms=elapsed_ms,
                        error=error,
                    )
                except Exception:
                    pass  # Don't fail the tool call if audit logging fails
        return wrapper
    return decorator
