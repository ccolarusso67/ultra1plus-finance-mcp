"""MCP Resources — read-only data snapshots for Claude to reference."""

import json
from mcp.server.fastmcp import FastMCP
from database import fetch_all, fetch_one


def register(mcp: FastMCP):

    @mcp.resource("finance://latest-ar-aging")
    async def latest_ar_aging() -> str:
        """Latest accounts receivable aging summary for all customers."""
        rows = await fetch_all("""
            SELECT customer_name, current_bucket, days_1_30, days_31_60,
                   days_61_90, days_91_plus, total_open_balance, snapshot_at
            FROM v_latest_ar_aging
            ORDER BY total_open_balance DESC
        """)
        return json.dumps(rows, default=str)

    @mcp.resource("finance://latest-ap-aging")
    async def latest_ap_aging() -> str:
        """Latest accounts payable aging summary for all vendors."""
        rows = await fetch_all("""
            SELECT vendor_name, current_bucket, days_1_30, days_31_60,
                   days_61_90, days_91_plus, total_open_balance, snapshot_at
            FROM v_latest_ap_aging
            ORDER BY total_open_balance DESC
        """)
        return json.dumps(rows, default=str)

    @mcp.resource("finance://latest-pnl")
    async def latest_pnl() -> str:
        """Monthly P&L for the current year (accrual basis)."""
        rows = await fetch_all("""
            SELECT month, income, cogs, gross_profit, operating_expenses,
                   other_income, other_expenses, net_income, snapshot_at
            FROM monthly_pnl
            WHERE report_basis = 'accrual'
              AND month >= DATE_TRUNC('year', CURRENT_DATE)
            ORDER BY month ASC
        """)
        return json.dumps(rows, default=str)

    @mcp.resource("finance://latest-inventory-summary")
    async def latest_inventory_summary() -> str:
        """Latest inventory levels for all active items."""
        rows = await fetch_all("""
            SELECT sku, name, category, quantity_on_hand, quantity_on_sales_order,
                   quantity_available, reorder_point, avg_cost, asset_value, snapshot_at
            FROM v_latest_inventory
            ORDER BY name ASC
        """)
        return json.dumps(rows, default=str)

    @mcp.resource("finance://latest-sales-by-customer")
    async def latest_sales_by_customer() -> str:
        """Latest sales by customer for the current quarter."""
        rows = await fetch_all("""
            SELECT customer_name, sales_amount, cogs_amount, gross_margin,
                   order_count, snapshot_at
            FROM sales_by_customer
            WHERE period_start >= DATE_TRUNC('quarter', CURRENT_DATE)
            ORDER BY sales_amount DESC
        """)
        return json.dumps(rows, default=str)

    @mcp.resource("finance://sync-health")
    async def sync_health() -> str:
        """Status and freshness of all data sync jobs."""
        rows = await fetch_all("""
            SELECT job_name, last_success_at, records_synced, status,
                   error_message,
                   ROUND(EXTRACT(EPOCH FROM (NOW() - last_success_at)) / 60) AS minutes_ago
            FROM sync_status
            ORDER BY job_name
        """)
        return json.dumps(rows, default=str)
