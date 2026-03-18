"""Top Products tool."""

from mcp.server.fastmcp import FastMCP
from database import fetch_all
from audit import audited


def register(mcp: FastMCP):
    @mcp.tool()
    @audited("get_top_products")
    async def get_top_products(
        metric: str,
        period_start: str,
        period_end: str,
        limit: int = 20,
    ) -> list[dict]:
        """Get top or bottom products ranked by a specific metric.

        Args:
            metric: Ranking metric — "revenue", "margin", "margin_pct", or "units".
            period_start: Start date (YYYY-MM-DD).
            period_end: End date (YYYY-MM-DD).
            limit: Number of results (default 20). Use negative for bottom N.

        Returns:
            Ranked list of products with revenue, cost, gross margin,
            margin percentage, and units sold.
        """
        order_col_map = {
            "revenue": "revenue",
            "margin": "gross_margin",
            "margin_pct": "margin_pct",
            "units": "units_sold",
        }
        order_col = order_col_map.get(metric, "revenue")

        direction = "DESC"
        actual_limit = limit
        if limit < 0:
            direction = "ASC"
            actual_limit = abs(limit)

        query = f"""
            SELECT
                COALESCE(pc.name, il.description, il.sku) AS product_name,
                il.sku,
                pc.category,
                SUM(il.quantity) AS units_sold,
                ROUND(SUM(il.line_total)::numeric, 2) AS revenue,
                ROUND(SUM(il.cost * il.quantity)::numeric, 2) AS total_cost,
                ROUND((SUM(il.line_total) - SUM(il.cost * il.quantity))::numeric, 2)
                    AS gross_margin,
                CASE WHEN SUM(il.line_total) > 0
                     THEN ROUND(((SUM(il.line_total) - SUM(il.cost * il.quantity))
                                  / SUM(il.line_total) * 100)::numeric, 1)
                     ELSE 0 END AS margin_pct,
                COUNT(DISTINCT i.customer_id) AS customer_count
            FROM invoice_lines il
            JOIN invoices i ON i.txn_id = il.invoice_txn_id
            LEFT JOIN product_catalog pc ON pc.item_id = il.item_id
            WHERE i.txn_date >= $1 AND i.txn_date <= $2
            GROUP BY COALESCE(pc.name, il.description, il.sku), il.sku, pc.category
            ORDER BY {order_col} {direction}
            LIMIT $3
        """
        return await fetch_all(query, period_start, period_end, actual_limit)
