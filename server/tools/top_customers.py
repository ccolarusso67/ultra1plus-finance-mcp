"""Top Customers tool."""

from mcp.server.fastmcp import FastMCP
from database import fetch_all
from audit import audited


def register(mcp: FastMCP):
    @mcp.tool()
    @audited("get_top_customers")
    async def get_top_customers(
        metric: str,
        period_start: str,
        period_end: str,
        limit: int = 20,
    ) -> list[dict]:
        """Get top or bottom customers ranked by a specific metric.

        Args:
            metric: Ranking metric — "revenue", "margin", "margin_pct", or "orders".
            period_start: Start date (YYYY-MM-DD).
            period_end: End date (YYYY-MM-DD).
            limit: Number of results (default 20). Use negative for bottom N (e.g. -10 for worst 10).

        Returns:
            Ranked list of customers with revenue, cost, gross margin,
            margin percentage, and order count.
        """
        order_col_map = {
            "revenue": "revenue",
            "margin": "gross_margin",
            "margin_pct": "margin_pct",
            "orders": "invoice_count",
        }
        order_col = order_col_map.get(metric, "revenue")

        direction = "DESC"
        actual_limit = limit
        if limit < 0:
            direction = "ASC"
            actual_limit = abs(limit)

        query = f"""
            SELECT
                c.full_name AS customer_name,
                COUNT(DISTINCT i.txn_id) AS invoice_count,
                ROUND(SUM(il.line_total)::numeric, 2) AS revenue,
                ROUND(SUM(il.cost * il.quantity)::numeric, 2) AS total_cost,
                ROUND((SUM(il.line_total) - SUM(il.cost * il.quantity))::numeric, 2)
                    AS gross_margin,
                CASE WHEN SUM(il.line_total) > 0
                     THEN ROUND(((SUM(il.line_total) - SUM(il.cost * il.quantity))
                                  / SUM(il.line_total) * 100)::numeric, 1)
                     ELSE 0 END AS margin_pct
            FROM invoice_lines il
            JOIN invoices i ON i.txn_id = il.invoice_txn_id
            JOIN customers c ON c.customer_id = i.customer_id
            WHERE i.txn_date >= $1 AND i.txn_date <= $2
            GROUP BY c.full_name
            ORDER BY {order_col} {direction}
            LIMIT $3
        """
        return await fetch_all(query, period_start, period_end, actual_limit)
