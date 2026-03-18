"""Payments Received tool."""

from mcp.server.fastmcp import FastMCP
from database import fetch_all
from audit import audited


def register(mcp: FastMCP):
    @mcp.tool()
    @audited("get_payments_received")
    async def get_payments_received(
        start_date: str,
        end_date: str,
        customer_name: str | None = None,
    ) -> list[dict]:
        """Get payments received within a date range.

        Args:
            start_date: Start date (YYYY-MM-DD).
            end_date: End date (YYYY-MM-DD).
            customer_name: Optional customer name filter (partial match, case-insensitive).

        Returns:
            List of payments with customer name, date, amount, reference number,
            payment method, and which invoices the payment was applied to.
        """
        conditions = ["p.payment_date >= $1", "p.payment_date <= $2"]
        params = [start_date, end_date]
        param_idx = 2

        base_query = """
            SELECT p.txn_id, c.full_name AS customer_name, p.payment_date,
                   p.amount, p.ref_number, p.payment_method, p.memo,
                   p.applied_invoice_refs
            FROM payments p
            LEFT JOIN customers c ON c.customer_id = p.customer_id
        """

        if customer_name:
            param_idx += 1
            conditions.append(f"c.full_name ILIKE ${param_idx}")
            params.append(f"%{customer_name}%")

        query = f"{base_query} WHERE {' AND '.join(conditions)} ORDER BY p.payment_date DESC"
        return await fetch_all(query, *params)
