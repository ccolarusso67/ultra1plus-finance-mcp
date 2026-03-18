"""Ultra1Plus Finance MCP Server — main entry point.

Remote HTTP MCP server exposing read-only financial tools
backed by a PostgreSQL snapshot database synced from QuickBooks Enterprise.
"""

import logging
from contextlib import asynccontextmanager

from mcp.server.fastmcp import FastMCP

from config import settings
from database import init_pool, close_pool

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("u1p-finance-mcp")


@asynccontextmanager
async def server_lifespan(server: FastMCP):
    """Initialize and teardown server resources."""
    logger.info("Starting Ultra1Plus Finance MCP Server v%s", settings.server_version)
    await init_pool(settings.database_url)
    logger.info("Database pool initialized")
    yield
    await close_pool()
    logger.info("Server shutdown complete")


# Create MCP server
mcp = FastMCP(
    name=settings.server_name,
    version=settings.server_version,
    lifespan=server_lifespan,
)

# ─── Register tools ────────────────────────────────────────────
# Core reporting tools
from tools.ar_aging import register as register_ar_aging
from tools.ap_aging import register as register_ap_aging
from tools.invoices import register as register_invoices
from tools.payments import register as register_payments
from tools.inventory import register as register_inventory
from tools.pnl import register as register_pnl
from tools.sales_by_customer import register as register_sales_by_customer
from tools.cash_position import register as register_cash_position
from tools.sync_health import register as register_sync_health

# Business intelligence tools
from tools.margin_by_product import register as register_margin_product
from tools.margin_by_customer import register as register_margin_customer
from tools.margin_erosion import register as register_margin_erosion
from tools.cross_sell import register as register_cross_sell
from tools.declining_accounts import register as register_declining
from tools.reorder_alerts import register as register_reorder
from tools.pricing_analysis import register as register_pricing
from tools.top_customers import register as register_top_customers
from tools.top_products import register as register_top_products
from tools.sales_orders_backlog import register as register_backlog
from tools.product_adoption import register as register_adoption
from tools.credit_hold import register as register_credit_hold
from tools.ytd_summary import register as register_ytd
from tools.period_comparison import register as register_period_comparison

# Register all tools with the MCP server
_registrations = [
    register_ar_aging, register_ap_aging, register_invoices, register_payments,
    register_inventory, register_pnl, register_sales_by_customer,
    register_cash_position, register_sync_health,
    register_margin_product, register_margin_customer, register_margin_erosion,
    register_cross_sell, register_declining, register_reorder, register_pricing,
    register_top_customers, register_top_products, register_backlog,
    register_adoption, register_credit_hold, register_ytd, register_period_comparison,
]

for reg in _registrations:
    reg(mcp)

# ─── Register resources ───────────────────────────────────────
from resources.finance_resources import register as register_resources
register_resources(mcp)

logger.info("Registered %d tools", len(_registrations))


if __name__ == "__main__":
    mcp.run(transport="streamable-http", host=settings.mcp_host, port=settings.mcp_port)
