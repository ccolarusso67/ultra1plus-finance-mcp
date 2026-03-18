"""Credit Hold Check tool."""

from mcp.server.fastmcp import FastMCP
from database import fetch_all
from audit import audited


def register(mcp: FastMCP):
    @mcp.tool()
    @audited("get_credit_hold_check")
    async def get_credit_hold_check(
        customer_name: str | None = None,
    ) -> list[dict]:
        """Check if customers are at or over their credit limit.
        Use this before approving shipments or new orders.

        Args:
            customer_name: Specific customer to check (partial match).
                          If omitted, shows all customers over their credit limit.

        Returns:
            Customer credit status with credit limit, current balance,
            available credit, and whether they're over limit. For customers
            over limit, includes their AR aging breakdown.
        """
        conditions = ["cs.credit_limit > 0"]
        params = []
        param_idx = 0

        if customer_name:
            param_idx += 1
            conditions.append(f"cs.full_name ILIKE ${param_idx}")
            params.append(f"%{customer_name}%")
        else:
            conditions.append("cs.is_over_limit = TRUE")

        query = f"""
            SELECT
                cs.full_name AS customer_name,
                cs.credit_limit,
                cs.balance AS current_balance,
                cs.available_credit,
                cs.is_over_limit,
                ar.current_bucket AS ar_current,
                ar.days_1_30 AS ar_1_30,
                ar.days_31_60 AS ar_31_60,
                ar.days_61_90 AS ar_61_90,
                ar.days_91_plus AS ar_91_plus,
                ar.total_open_balance AS ar_total
            FROM v_credit_status cs
            LEFT JOIN v_latest_ar_aging ar ON ar.customer_id = cs.customer_id
            WHERE {' AND '.join(conditions)}
            ORDER BY cs.balance DESC
        """
        return await fetch_all(query, *params)
