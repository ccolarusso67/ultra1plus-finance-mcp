"""Sales Orders Backlog tool."""

from mcp.server.fastmcp import FastMCP
from database import fetch_all
from audit import audited


def register(mcp: FastMCP):
    @mcp.tool()
    @audited("get_sales_orders_backlog")
    async def get_sales_orders_backlog(
        past_ship_date_only: bool = False,
        customer_name: str | None = None,
    ) -> list[dict]:
        """Get unfulfilled sales orders (backlog).

        Args:
            past_ship_date_only: If true, only show orders past their ship date (overdue).
            customer_name: Optional customer name filter (partial match).

        Returns:
            List of open sales orders with customer, dates, amounts, and overdue status.
        """
        conditions = ["1=1"]
        params = []
        param_idx = 0

        base_query = """
            SELECT txn_id, ref_number, customer_name, txn_date, ship_date,
                   amount, is_overdue
            FROM v_open_sales_orders
        """

        if past_ship_date_only:
            conditions.append("is_overdue = TRUE")

        if customer_name:
            param_idx += 1
            conditions.append(f"customer_name ILIKE ${param_idx}")
            params.append(f"%{customer_name}%")

        query = f"{base_query} WHERE {' AND '.join(conditions)} ORDER BY ship_date ASC"
        return await fetch_all(query, *params)
