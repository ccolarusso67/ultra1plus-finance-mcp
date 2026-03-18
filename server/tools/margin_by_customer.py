"""Margin by Customer tool."""

from mcp.server.fastmcp import FastMCP
from database import fetch_all
from audit import audited


def register(mcp: FastMCP):
    @mcp.tool()
    @audited("get_margin_by_customer")
    async def get_margin_by_customer(
        period_start: str,
        period_end: str,
        min_revenue: float | None = None,
    ) -> list[dict]:
        """Get gross margin analysis by customer for a date range.
        Shows which customers are most and least profitable.

        Args:
            period_start: Start date (YYYY-MM-DD).
            period_end: End date (YYYY-MM-DD).
            min_revenue: Only include customers with at least this much revenue.

        Returns:
            List of customers with total revenue, total cost, gross margin,
            margin percentage, and invoice count. Sorted by margin % ascending
            to highlight low-margin customers first.
        """
        conditions = ["i.txn_date >= $1", "i.txn_date <= $2"]
        params = [period_start, period_end]
        param_idx = 2

        having = []
        if min_revenue is not None:
            param_idx += 1
            having.append(f"SUM(il.line_total) >= ${param_idx}")
            params.append(min_revenue)

        having_clause = f"HAVING {' AND '.join(having)}" if having else ""

        query = f"""
            SELECT
                c.full_name AS customer_name,
                COUNT(DISTINCT i.txn_id) AS invoice_count,
                SUM(il.line_total) AS revenue,
                SUM(il.cost * il.quantity) AS total_cost,
                SUM(il.line_total) - SUM(il.cost * il.quantity) AS gross_margin,
                CASE WHEN SUM(il.line_total) > 0
                     THEN ROUND(((SUM(il.line_total) - SUM(il.cost * il.quantity))
                                  / SUM(il.line_total) * 100)::numeric, 1)
                     ELSE 0 END AS margin_pct
            FROM invoice_lines il
            JOIN invoices i ON i.txn_id = il.invoice_txn_id
            LEFT JOIN customers c ON c.customer_id = i.customer_id
            WHERE {' AND '.join(conditions)}
            GROUP BY c.full_name
            {having_clause}
            ORDER BY margin_pct ASC
        """
        return await fetch_all(query, *params)
