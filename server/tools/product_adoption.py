"""New Product Adoption tool."""

from mcp.server.fastmcp import FastMCP
from database import fetch_all
from audit import audited


def register(mcp: FastMCP):
    @mcp.tool()
    @audited("get_new_product_adoption")
    async def get_new_product_adoption(
        product_name: str | None = None,
        launched_after: str | None = None,
        lookback_months: int = 6,
    ) -> list[dict]:
        """Track adoption of new or specific products across the customer base.
        Shows how many active accounts have ordered a product.

        Args:
            product_name: Filter by product name or SKU (partial match).
            launched_after: Only show products added to catalog after this date (YYYY-MM-DD).
            lookback_months: How far back to check for purchases (default 6 months).

        Returns:
            Products with count of customers who've ordered, total active customers,
            adoption percentage, total units sold, and total revenue.
        """
        conditions = ["i.txn_date >= CURRENT_DATE - ($1 || ' months')::interval"]
        params = [lookback_months]
        param_idx = 1

        if product_name:
            param_idx += 1
            conditions.append(
                f"(COALESCE(pc.name, il.description) ILIKE ${param_idx} OR il.sku ILIKE ${param_idx})"
            )
            params.append(f"%{product_name}%")

        if launched_after:
            param_idx += 1
            conditions.append(f"pc.created_at >= ${param_idx}")
            params.append(launched_after)

        query = f"""
            SELECT
                COALESCE(pc.name, il.description) AS product_name,
                il.sku,
                pc.category,
                COUNT(DISTINCT i.customer_id) AS customers_buying,
                (SELECT COUNT(*) FROM customers WHERE is_active) AS total_active_customers,
                ROUND(COUNT(DISTINCT i.customer_id)::numeric
                      / NULLIF((SELECT COUNT(*) FROM customers WHERE is_active), 0) * 100, 1)
                    AS adoption_pct,
                SUM(il.quantity) AS total_units_sold,
                ROUND(SUM(il.line_total)::numeric, 2) AS total_revenue,
                pc.created_at AS catalog_added_date
            FROM invoice_lines il
            JOIN invoices i ON i.txn_id = il.invoice_txn_id
            LEFT JOIN product_catalog pc ON pc.item_id = il.item_id
            WHERE {' AND '.join(conditions)}
            GROUP BY COALESCE(pc.name, il.description), il.sku, pc.category, pc.created_at
            ORDER BY adoption_pct ASC
        """
        return await fetch_all(query, *params)
