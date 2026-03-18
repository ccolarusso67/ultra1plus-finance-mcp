"""Monthly Profit & Loss tool."""

from mcp.server.fastmcp import FastMCP
from database import fetch_all
from audit import audited


def register(mcp: FastMCP):
    @mcp.tool()
    @audited("get_monthly_pnl")
    async def get_monthly_pnl(
        month_start: str,
        month_end: str,
        basis: str | None = None,
    ) -> list[dict]:
        """Get monthly profit and loss statement for a date range.

        Args:
            month_start: Start month (YYYY-MM-DD, first day of month, e.g. "2026-01-01").
            month_end: End month (YYYY-MM-DD, first day of month, e.g. "2026-03-01").
            basis: Accounting basis — "accrual" (default) or "cash".

        Returns:
            Monthly P&L rows with income, COGS, gross profit, operating expenses,
            other income/expenses, and net income. Includes report_basis and snapshot_at.
        """
        conditions = ["month >= $1", "month <= $2"]
        params = [month_start, month_end]
        param_idx = 2

        if basis:
            param_idx += 1
            conditions.append(f"report_basis = ${param_idx}")
            params.append(basis.lower())

        query = f"""
            SELECT month, report_basis, income, cogs, gross_profit,
                   operating_expenses, other_income, other_expenses,
                   net_income, snapshot_at
            FROM monthly_pnl
            WHERE {' AND '.join(conditions)}
            ORDER BY month ASC
        """
        return await fetch_all(query, *params)
