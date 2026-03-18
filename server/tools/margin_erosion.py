"""Margin Erosion Alerts tool."""

from mcp.server.fastmcp import FastMCP
from database import fetch_all
from audit import audited


def register(mcp: FastMCP):
    @mcp.tool()
    @audited("get_margin_erosion_alerts")
    async def get_margin_erosion_alerts(
        lookback_months: int = 3,
        threshold_pct: float = 5.0,
    ) -> list[dict]:
        """Detect products where margin has eroded compared to the prior period.
        Flags SKUs where costs went up but prices didn't adjust.

        Args:
            lookback_months: Number of months to compare (default 3). Compares
                           the most recent N months vs the prior N months.
            threshold_pct: Minimum margin drop in percentage points to flag (default 5.0).

        Returns:
            List of products with current vs prior margin percentages, the change,
            and current vs prior average cost. Sorted by biggest margin drop first.
        """
        query = """
            WITH recent AS (
                SELECT
                    il.sku,
                    COALESCE(pc.name, il.description) AS product_name,
                    SUM(il.line_total) AS revenue,
                    SUM(il.cost * il.quantity) AS total_cost,
                    AVG(il.cost) AS avg_cost,
                    AVG(il.unit_price) AS avg_price
                FROM invoice_lines il
                JOIN invoices i ON i.txn_id = il.invoice_txn_id
                LEFT JOIN product_catalog pc ON pc.item_id = il.item_id
                WHERE i.txn_date >= CURRENT_DATE - ($1 || ' months')::interval
                GROUP BY il.sku, COALESCE(pc.name, il.description)
                HAVING SUM(il.line_total) > 0
            ),
            prior AS (
                SELECT
                    il.sku,
                    SUM(il.line_total) AS revenue,
                    SUM(il.cost * il.quantity) AS total_cost,
                    AVG(il.cost) AS avg_cost,
                    AVG(il.unit_price) AS avg_price
                FROM invoice_lines il
                JOIN invoices i ON i.txn_id = il.invoice_txn_id
                WHERE i.txn_date >= CURRENT_DATE - ($1 * 2 || ' months')::interval
                  AND i.txn_date < CURRENT_DATE - ($1 || ' months')::interval
                GROUP BY il.sku
                HAVING SUM(il.line_total) > 0
            )
            SELECT
                r.product_name,
                r.sku,
                ROUND(((r.revenue - r.total_cost) / r.revenue * 100)::numeric, 1) AS current_margin_pct,
                ROUND(((p.revenue - p.total_cost) / p.revenue * 100)::numeric, 1) AS prior_margin_pct,
                ROUND(((r.revenue - r.total_cost) / r.revenue * 100)::numeric, 1)
                    - ROUND(((p.revenue - p.total_cost) / p.revenue * 100)::numeric, 1) AS margin_change_pct,
                ROUND(r.avg_cost::numeric, 4) AS current_avg_cost,
                ROUND(p.avg_cost::numeric, 4) AS prior_avg_cost,
                ROUND(r.avg_price::numeric, 4) AS current_avg_price,
                ROUND(p.avg_price::numeric, 4) AS prior_avg_price
            FROM recent r
            JOIN prior p ON p.sku = r.sku
            WHERE ((r.revenue - r.total_cost) / r.revenue * 100)
                - ((p.revenue - p.total_cost) / p.revenue * 100) <= -$2
            ORDER BY margin_change_pct ASC
        """
        return await fetch_all(query, lookback_months, threshold_pct)
