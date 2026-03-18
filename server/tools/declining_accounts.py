"""Declining Accounts tool."""

from mcp.server.fastmcp import FastMCP
from database import fetch_all
from audit import audited


def register(mcp: FastMCP):
    @mcp.tool()
    @audited("get_declining_accounts")
    async def get_declining_accounts(
        lookback_months: int = 6,
        min_decline_pct: float = 20.0,
    ) -> list[dict]:
        """Detect customers whose order volume is declining compared to the prior period.
        Compares the most recent N months against the same-length period before it.

        Args:
            lookback_months: Period length in months to compare (default 6).
            min_decline_pct: Minimum revenue decline percentage to flag (default 20%).

        Returns:
            List of declining customers with current vs prior revenue, decline
            amount and percentage. Sorted by largest dollar decline first.
        """
        query = """
            WITH recent AS (
                SELECT
                    i.customer_id,
                    c.full_name AS customer_name,
                    SUM(il.line_total) AS revenue,
                    COUNT(DISTINCT i.txn_id) AS invoice_count
                FROM invoice_lines il
                JOIN invoices i ON i.txn_id = il.invoice_txn_id
                JOIN customers c ON c.customer_id = i.customer_id
                WHERE i.txn_date >= CURRENT_DATE - ($1 || ' months')::interval
                GROUP BY i.customer_id, c.full_name
            ),
            prior AS (
                SELECT
                    i.customer_id,
                    SUM(il.line_total) AS revenue,
                    COUNT(DISTINCT i.txn_id) AS invoice_count
                FROM invoice_lines il
                JOIN invoices i ON i.txn_id = il.invoice_txn_id
                WHERE i.txn_date >= CURRENT_DATE - ($1 * 2 || ' months')::interval
                  AND i.txn_date < CURRENT_DATE - ($1 || ' months')::interval
                GROUP BY i.customer_id
            )
            SELECT
                r.customer_name,
                ROUND(r.revenue::numeric, 2) AS current_revenue,
                ROUND(p.revenue::numeric, 2) AS prior_revenue,
                ROUND((p.revenue - r.revenue)::numeric, 2) AS decline_amount,
                ROUND(((p.revenue - r.revenue) / NULLIF(p.revenue, 0) * 100)::numeric, 1)
                    AS decline_pct,
                r.invoice_count AS current_invoices,
                p.invoice_count AS prior_invoices
            FROM recent r
            JOIN prior p ON p.customer_id = r.customer_id
            WHERE p.revenue > 0
              AND ((p.revenue - r.revenue) / p.revenue * 100) >= $2
            ORDER BY (p.revenue - r.revenue) DESC
        """
        return await fetch_all(query, lookback_months, min_decline_pct)
