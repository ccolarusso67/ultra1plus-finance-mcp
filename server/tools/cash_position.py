"""Cash Position tool."""

from mcp.server.fastmcp import FastMCP
from database import fetch_one
from audit import audited


def register(mcp: FastMCP):
    @mcp.tool()
    @audited("get_cash_position")
    async def get_cash_position() -> list[dict]:
        """Get a snapshot of the current cash position based on AR, AP, and recent payments.

        Returns:
            Summary with total AR (receivables), total AP (payables), net position,
            payments received in the last 30 days, overdue AR, and overdue AP.
            Includes data freshness timestamps for each component.
        """
        result = await fetch_one("""
            SELECT
                (SELECT COALESCE(SUM(total_open_balance), 0) FROM v_latest_ar_aging) AS total_ar,
                (SELECT COALESCE(SUM(total_open_balance), 0) FROM v_latest_ap_aging) AS total_ap,
                (SELECT COALESCE(SUM(amount), 0) FROM payments
                 WHERE payment_date >= CURRENT_DATE - INTERVAL '30 days') AS payments_last_30d,
                (SELECT COALESCE(SUM(days_31_60 + days_61_90 + days_91_plus), 0)
                 FROM v_latest_ar_aging) AS overdue_ar,
                (SELECT COALESCE(SUM(days_31_60 + days_61_90 + days_91_plus), 0)
                 FROM v_latest_ap_aging) AS overdue_ap,
                (SELECT MAX(snapshot_at) FROM ar_aging_summary) AS ar_as_of,
                (SELECT MAX(snapshot_at) FROM ap_aging_summary) AS ap_as_of
        """)
        if result:
            result["net_ar_ap"] = result["total_ar"] - result["total_ap"]
        return [result] if result else []
