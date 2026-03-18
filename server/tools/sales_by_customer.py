"""Sales by Customer tool."""

from mcp.server.fastmcp import FastMCP
from database import fetch_all
from audit import audited


def register(mcp: FastMCP):
    @mcp.tool()
    @audited("get_sales_by_customer")
    async def get_sales_by_customer(
        start_date: str,
        end_date: str,
        customer_name: str | None = None,
        min_revenue: float | None = None,
    ) -> list[dict]:
        """Get sales totals broken down by customer for a date range.

        Args:
            start_date: Period start date (YYYY-MM-DD).
            end_date: Period end date (YYYY-MM-DD).
            customer_name: Optional customer name filter (partial match, case-insensitive).
            min_revenue: Minimum sales amount to include.

        Returns:
            List of customers with their sales amount, COGS, gross margin,
            order count, and margin percentage for the period.
        """
        conditions = ["period_start >= $1", "period_end <= $2"]
        params = [start_date, end_date]
        param_idx = 2

        base_query = """
            SELECT customer_name, sales_amount, cogs_amount, gross_margin,
                   order_count,
                   CASE WHEN sales_amount > 0
                        THEN ROUND((gross_margin / sales_amount * 100)::numeric, 1)
                        ELSE 0 END AS margin_pct,
                   snapshot_at
            FROM sales_by_customer
        """

        if customer_name:
            param_idx += 1
            conditions.append(f"customer_name ILIKE ${param_idx}")
            params.append(f"%{customer_name}%")

        if min_revenue is not None:
            param_idx += 1
            conditions.append(f"sales_amount >= ${param_idx}")
            params.append(min_revenue)

        query = f"{base_query} WHERE {' AND '.join(conditions)} ORDER BY sales_amount DESC"
        return await fetch_all(query, *params)
