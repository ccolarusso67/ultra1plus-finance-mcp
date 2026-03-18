"""Reorder Alerts tool."""

from mcp.server.fastmcp import FastMCP
from database import fetch_all
from audit import audited


def register(mcp: FastMCP):
    @mcp.tool()
    @audited("get_reorder_alerts")
    async def get_reorder_alerts(
        days_overdue: int = 14,
    ) -> list[dict]:
        """Identify customers who are past their typical reorder cycle.
        Based on historical average days between invoices per customer.

        Args:
            days_overdue: Number of days past the average reorder cycle to flag (default 14).
                         A customer with a 45-day average cycle will be flagged at day 59.

        Returns:
            List of customers overdue for reorder with their average order cycle,
            days since last order, how many days overdue, and typical order value.
        """
        query = """
            WITH customer_orders AS (
                SELECT
                    i.customer_id,
                    c.full_name AS customer_name,
                    i.txn_date,
                    LAG(i.txn_date) OVER (PARTITION BY i.customer_id ORDER BY i.txn_date) AS prev_date,
                    i.amount
                FROM invoices i
                JOIN customers c ON c.customer_id = i.customer_id
                WHERE c.is_active
                  AND i.txn_date >= CURRENT_DATE - INTERVAL '18 months'
            ),
            cycle_stats AS (
                SELECT
                    customer_id,
                    customer_name,
                    AVG(txn_date - prev_date) AS avg_cycle_days,
                    MAX(txn_date) AS last_order_date,
                    AVG(amount) AS avg_order_value,
                    COUNT(*) AS order_count
                FROM customer_orders
                WHERE prev_date IS NOT NULL
                GROUP BY customer_id, customer_name
                HAVING COUNT(*) >= 3  -- Need at least 3 orders to establish a pattern
            )
            SELECT
                customer_name,
                ROUND(avg_cycle_days::numeric, 0) AS avg_cycle_days,
                last_order_date,
                (CURRENT_DATE - last_order_date) AS days_since_last_order,
                (CURRENT_DATE - last_order_date) - ROUND(avg_cycle_days::numeric, 0)::int
                    AS days_overdue,
                ROUND(avg_order_value::numeric, 2) AS avg_order_value,
                order_count
            FROM cycle_stats
            WHERE (CURRENT_DATE - last_order_date) > (avg_cycle_days + $1)
            ORDER BY days_overdue DESC
        """
        return await fetch_all(query, days_overdue)
