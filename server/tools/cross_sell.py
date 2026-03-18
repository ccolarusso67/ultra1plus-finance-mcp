"""Cross-Sell Gap Analysis tool."""

from mcp.server.fastmcp import FastMCP
from database import fetch_all
from audit import audited


def register(mcp: FastMCP):
    @mcp.tool()
    @audited("get_cross_sell_gaps")
    async def get_cross_sell_gaps(
        customer_name: str | None = None,
        lookback_months: int = 12,
    ) -> list[dict]:
        """Identify products a customer doesn't buy that similar-size accounts purchase.
        Reveals cross-sell opportunities by comparing each customer's product mix
        against the catalog adoption of accounts with similar revenue.

        Args:
            customer_name: Specific customer to analyze (partial match). If omitted,
                          shows top gaps across all customers.
            lookback_months: How far back to analyze purchase history (default 12 months).

        Returns:
            List of customer + product combinations representing cross-sell opportunities,
            with the percentage of similar accounts that buy that product and
            estimated revenue potential.
        """
        conditions = []
        params = [lookback_months]
        param_idx = 1

        customer_filter = ""
        if customer_name:
            param_idx += 1
            customer_filter = f"AND c.full_name ILIKE ${param_idx}"
            params.append(f"%{customer_name}%")

        query = f"""
            WITH customer_revenue AS (
                SELECT
                    i.customer_id,
                    c.full_name AS customer_name,
                    SUM(il.line_total) AS total_revenue
                FROM invoice_lines il
                JOIN invoices i ON i.txn_id = il.invoice_txn_id
                JOIN customers c ON c.customer_id = i.customer_id
                WHERE i.txn_date >= CURRENT_DATE - ($1 || ' months')::interval
                GROUP BY i.customer_id, c.full_name
            ),
            customer_products AS (
                SELECT DISTINCT
                    i.customer_id,
                    COALESCE(pc.category, 'Other') AS category
                FROM invoice_lines il
                JOIN invoices i ON i.txn_id = il.invoice_txn_id
                LEFT JOIN product_catalog pc ON pc.item_id = il.item_id
                WHERE i.txn_date >= CURRENT_DATE - ($1 || ' months')::interval
            ),
            category_adoption AS (
                SELECT
                    category,
                    COUNT(DISTINCT customer_id) AS buying_count,
                    (SELECT COUNT(DISTINCT customer_id) FROM customer_revenue) AS total_customers,
                    ROUND(COUNT(DISTINCT customer_id)::numeric
                          / NULLIF((SELECT COUNT(DISTINCT customer_id) FROM customer_revenue), 0) * 100, 1)
                        AS adoption_pct,
                    (SELECT AVG(il2.line_total)
                     FROM invoice_lines il2
                     JOIN invoices i2 ON i2.txn_id = il2.invoice_txn_id
                     LEFT JOIN product_catalog pc2 ON pc2.item_id = il2.item_id
                     WHERE COALESCE(pc2.category, 'Other') = cp.category
                       AND i2.txn_date >= CURRENT_DATE - ($1 || ' months')::interval
                    ) AS avg_line_value
                FROM customer_products cp
                GROUP BY category
            )
            SELECT
                cr.customer_name,
                ca.category AS missing_category,
                ca.adoption_pct AS pct_similar_accounts_buy,
                ca.buying_count AS accounts_buying,
                ROUND(ca.avg_line_value::numeric, 2) AS est_avg_value
            FROM customer_revenue cr
            CROSS JOIN category_adoption ca
            LEFT JOIN customer_products cp
                ON cp.customer_id = cr.customer_id AND cp.category = ca.category
            WHERE cp.customer_id IS NULL
              AND ca.adoption_pct >= 30
              {customer_filter}
            ORDER BY cr.customer_name, ca.adoption_pct DESC
        """
        return await fetch_all(query, *params)
