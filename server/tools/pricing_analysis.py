"""Pricing Analysis tool."""

from mcp.server.fastmcp import FastMCP
from database import fetch_all
from audit import audited


def register(mcp: FastMCP):
    @mcp.tool()
    @audited("get_pricing_analysis")
    async def get_pricing_analysis(
        item_name: str | None = None,
        customer_name: str | None = None,
        lookback_months: int = 6,
    ) -> list[dict]:
        """Analyze price variance across customers for the same products.
        Reveals pricing inconsistencies where similar accounts pay different prices.

        Args:
            item_name: Filter by product name or SKU (partial match).
            customer_name: Filter by customer name (partial match).
            lookback_months: How far back to analyze (default 6 months).

        Returns:
            For each product, shows each customer's average unit price, the overall
            average price, and the variance from average. Sorted by largest variance first.
        """
        conditions = ["i.txn_date >= CURRENT_DATE - ($1 || ' months')::interval"]
        params = [lookback_months]
        param_idx = 1

        if item_name:
            param_idx += 1
            conditions.append(
                f"(COALESCE(pc.name, il.description) ILIKE ${param_idx} OR il.sku ILIKE ${param_idx})"
            )
            params.append(f"%{item_name}%")

        if customer_name:
            param_idx += 1
            conditions.append(f"c.full_name ILIKE ${param_idx}")
            params.append(f"%{customer_name}%")

        query = f"""
            WITH line_prices AS (
                SELECT
                    COALESCE(pc.name, il.description) AS product_name,
                    il.sku,
                    c.full_name AS customer_name,
                    AVG(il.unit_price) AS avg_unit_price,
                    SUM(il.quantity) AS total_qty,
                    SUM(il.line_total) AS total_revenue
                FROM invoice_lines il
                JOIN invoices i ON i.txn_id = il.invoice_txn_id
                LEFT JOIN customers c ON c.customer_id = i.customer_id
                LEFT JOIN product_catalog pc ON pc.item_id = il.item_id
                WHERE {' AND '.join(conditions)}
                  AND il.unit_price > 0
                GROUP BY COALESCE(pc.name, il.description), il.sku, c.full_name
            ),
            product_avg AS (
                SELECT
                    product_name,
                    sku,
                    AVG(avg_unit_price) AS overall_avg_price,
                    MIN(avg_unit_price) AS min_price,
                    MAX(avg_unit_price) AS max_price,
                    COUNT(DISTINCT customer_name) AS customer_count
                FROM line_prices
                GROUP BY product_name, sku
                HAVING COUNT(DISTINCT customer_name) >= 2
            )
            SELECT
                lp.product_name,
                lp.sku,
                lp.customer_name,
                ROUND(lp.avg_unit_price::numeric, 4) AS customer_avg_price,
                ROUND(pa.overall_avg_price::numeric, 4) AS overall_avg_price,
                ROUND((lp.avg_unit_price - pa.overall_avg_price)::numeric, 4) AS price_variance,
                ROUND(((lp.avg_unit_price - pa.overall_avg_price)
                        / NULLIF(pa.overall_avg_price, 0) * 100)::numeric, 1) AS variance_pct,
                ROUND(pa.min_price::numeric, 4) AS lowest_price,
                ROUND(pa.max_price::numeric, 4) AS highest_price,
                pa.customer_count AS customers_buying,
                lp.total_qty,
                ROUND(lp.total_revenue::numeric, 2) AS total_revenue
            FROM line_prices lp
            JOIN product_avg pa ON pa.sku = lp.sku
            ORDER BY ABS(lp.avg_unit_price - pa.overall_avg_price) DESC
        """
        return await fetch_all(query, *params)
