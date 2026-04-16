"""Bearer token authentication middleware for the Ultra1Plus Finance MCP server.

Enforces the MCP_API_KEY on POST requests to the /mcp endpoint.
GET requests return a 200 server info response for discovery probes.
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse


class BearerAuthMiddleware(BaseHTTPMiddleware):
    """Validate Authorization: Bearer <token> on POST to /mcp path."""

    def __init__(self, app, api_key: str):
        super().__init__(app)
        self.api_key = api_key

    async def dispatch(self, request: Request, call_next):
        if not request.url.path.startswith("/mcp"):
            return await call_next(request)

        # Return 200 for GET/HEAD/OPTIONS — discovery probes and health checks
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return JSONResponse({
                "name": "ultra1plus-finance",
                "version": "0.1.0",
                "status": "ok",
                "protocol": "mcp-streamable-http",
                "tools": 23,
                "resources": 6
            })

        # POST requests require Bearer token
        auth_header = request.headers.get("Authorization", "")

        if not auth_header:
            return JSONResponse(
                {"error": "Missing Authorization header"},
                status_code=401,
                headers={"WWW-Authenticate": "Bearer"},
            )

        if not auth_header.startswith("Bearer "):
            return JSONResponse(
                {"error": "Authorization header must use Bearer scheme"},
                status_code=401,
                headers={"WWW-Authenticate": "Bearer"},
            )

        provided_token = auth_header[7:]
        if provided_token != self.api_key:
            return JSONResponse(
                {"error": "Invalid token"},
                status_code=403,
            )

        return await call_next(request)
