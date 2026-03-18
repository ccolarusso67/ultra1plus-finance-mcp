"""Margin by Product tool."""

from mcp.server.fastmcp import FastMCP
from database import fetch_all
from audit import audited


def register(mcp: FastMCP):
    @mcp.tool()
    @audited("get_margin_by_product")
    async def get_margin_by_product(
        period_start: str,
        period_end: str,
        min_revenue: float | None = None,
        category: str | None = None,
    ) -> list[dict]:
        """Get gross margin analysis by product/SKU for a date range.
        Calculated from actual invoice line items (revenue vs cost).

        Args:
            period_start: Start date (YYYY-MM-DD).
            period_end: End date (YYYY-MM-DD).
            min_revenue: Only include products with at least this much revenue.
            category: Filter by product category (partial match).

        Returns:
            List of products with total revenue, total cost, gross margin,
            margin percentage, and units sold. Sorted by margin % ascending
            to highlight low-margin products first.
        """
        conditions = ["i.txn_date >= $1", "i.txn_date <= $2"]
        params = [period_start, period_end]
        param_idx = 2

        having = []

        if min_revenue is not None:
            param_idx += 1
            having.append(f"SUM(il.line_total) >= ${param_idx}")
            params.append(min_revenue)

        if category:
            param_idx += 1
            conditions.append(f"pc.category ILIKE ${param_idx}")
            params.append(f"%{category}%")

        having_clause = f"HAVING {' AND '.join(having)}" if having else ""

        query = f"""
            SELECT
                COALESCE(pc.name, il.description, il.sku) AS product_name,
                il.sku,
                pc.category,
                SUM(il.quantity) AS units_sold,
                SUM(il.line_total) AS revenue,
                SUM(il.cost * il.quantity) AS total_cost,
                SUM(il.line_total) - SUM(il.cost * il.quantity) AS gross_margin,
                CASE WHEN SUM(il.line_total) > 0
                     THEN ROUND(((SUM(il.line_total) - SUM(il.cost * il.quantity))
                                  / SUM(il.line_total) * 100)::numeric, 1)
                     ELSE 0 END AS margin_pct
            FROM invoice_lines il
            JOIN invoices i ON i.txn_id = il.invoice_txn_id
            LEFT JOIN product_catalog pc ON pc.item_id = il.item_id
            WHERE {' AND '.join(conditions)}
            GROUP BY COALESCE(pc.name, il.description, il.sku), il.sku, pc.category
            {having_clause}
            ORDER BY margin_pct ASC
        """
        return await fetch_all(query, *params)
