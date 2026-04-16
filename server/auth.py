"""Bearer token authentication middleware for the Ultra1Plus Finance MCP server.

Pure ASGI middleware — does not wrap response body, safe for SSE/streaming.
Enforces MCP_API_KEY on POST requests. Allows GET through for discovery.
"""

import json


class BearerAuthMiddleware:
    """Pure ASGI middleware for bearer token auth on /mcp POST requests."""

    def __init__(self, app, api_key: str):
        self.app = app
        self.api_key = api_key

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")
        method = scope.get("method", "")

        # Only enforce auth on POST to /mcp
        if not path.startswith("/mcp") or method in ("GET", "HEAD", "OPTIONS"):
            # GET returns server info for discovery probes
            if path.startswith("/mcp") and method == "GET":
                body = json.dumps({
                    "name": "ultra1plus-finance",
                    "version": "0.1.0",
                    "status": "ok",
                    "protocol": "mcp-streamable-http",
                    "tools": 23,
                    "resources": 6
                }).encode()
                await send({
                    "type": "http.response.start",
                    "status": 200,
                    "headers": [
                        [b"content-type", b"application/json"],
                        [b"content-length", str(len(body)).encode()],
                    ],
                })
                await send({
                    "type": "http.response.body",
                    "body": body,
                })
                return
            await self.app(scope, receive, send)
            return

        # Extract Authorization header from scope
        headers = dict(scope.get("headers", []))
        auth_value = headers.get(b"authorization", b"").decode()

        if not auth_value:
            await self._reject(send, 401, "Missing Authorization header")
            return

        if not auth_value.startswith("Bearer "):
            await self._reject(send, 401, "Authorization header must use Bearer scheme")
            return

        token = auth_value[7:]
        if token != self.api_key:
            await self._reject(send, 403, "Invalid token")
            return

        # Auth passed — hand off to MCP handler without touching the response
        await self.app(scope, receive, send)

    async def _reject(self, send, status, message):
        body = json.dumps({"error": message}).encode()
        await send({
            "type": "http.response.start",
            "status": status,
            "headers": [
                [b"content-type", b"application/json"],
                [b"content-length", str(len(body)).encode()],
            ],
        })
        await send({
            "type": "http.response.body",
            "body": body,
        })
