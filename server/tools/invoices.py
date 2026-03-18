"""Open Invoices tool."""

from mcp.server.fastmcp import FastMCP
from database import fetch_all
from audit import audited


def register(mcp: FastMCP):
    @mcp.tool()
    @audited("get_open_invoices")
    async def get_open_invoices(
        customer_name: str | None = None,
        due_before: str | None = None,
        min_balance: float | None = None,
    ) -> list[dict]:
        """Get all open (unpaid) invoices with optional filters.

        Args:
            customer_name: Filter by customer name (partial match, case-insensitive).
            due_before: Show invoices due before this date (YYYY-MM-DD). Useful for finding overdue invoices.
            min_balance: Minimum remaining balance to include (e.g. 10000 for invoices over $10K).

        Returns:
            List of open invoices with customer name, invoice number, dates, amounts,
            balance remaining, and days past due.
        """
        conditions = ["1=1"]
        params = []
        param_idx = 0

        base_query = """
            SELECT txn_id, ref_number, customer_name, txn_date, due_date,
                   amount, balance_remaining, terms, po_number, days_past_due
            FROM v_open_invoices
        """

        if customer_name:
            param_idx += 1
            conditions.append(f"customer_name ILIKE ${param_idx}")
            params.append(f"%{customer_name}%")

        if due_before:
            param_idx += 1
            conditions.append(f"due_date < ${param_idx}")
            params.append(due_before)

        if min_balance is not None:
            param_idx += 1
            conditions.append(f"balance_remaining >= ${param_idx}")
            params.append(min_balance)

        query = f"{base_query} WHERE {' AND '.join(conditions)} ORDER BY due_date ASC"
        return await fetch_all(query, *params)
