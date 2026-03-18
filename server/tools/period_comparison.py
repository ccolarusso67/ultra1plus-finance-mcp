"""Period Comparison tool."""

from mcp.server.fastmcp import FastMCP
from database import fetch_all
from audit import audited


def register(mcp: FastMCP):
    @mcp.tool()
    @audited("get_period_comparison")
    async def get_period_comparison(
        metric: str,
        period_a_start: str,
        period_a_end: str,
        period_b_start: str,
        period_b_end: str,
    ) -> list[dict]:
        """Compare a financial metric across two arbitrary time periods.

        Args:
            metric: What to compare — "revenue", "gross_profit", "net_income",
                   "invoices", "payments", or "orders".
            period_a_start: Period A start date (YYYY-MM-DD) — typically the more recent period.
            period_a_end: Period A end date (YYYY-MM-DD).
            period_b_start: Period B start date (YYYY-MM-DD) — the comparison period.
            period_b_end: Period B end date (YYYY-MM-DD).

        Returns:
            Summary showing the metric value for each period, the absolute change,
            and percentage change.
        """
        metric_queries = {
            "revenue": {
                "query": """
                    SELECT COALESCE(SUM(il.line_total), 0) AS value
                    FROM invoice_lines il
                    JOIN invoices i ON i.txn_id = il.invoice_txn_id
                    WHERE i.txn_date >= $1 AND i.txn_date <= $2
                """,
            },
            "gross_profit": {
                "query": """
                    SELECT COALESCE(SUM(il.line_total) - SUM(il.cost * il.quantity), 0) AS value
                    FROM invoice_lines il
                    JOIN invoices i ON i.txn_id = il.invoice_txn_id
                    WHERE i.txn_date >= $1 AND i.txn_date <= $2
                """,
            },
            "net_income": {
                "query": """
                    SELECT COALESCE(SUM(net_income), 0) AS value
                    FROM monthly_pnl
                    WHERE month >= $1 AND month <= $2 AND report_basis = 'accrual'
                """,
            },
            "invoices": {
                "query": """
                    SELECT COUNT(*) AS value
                    FROM invoices
                    WHERE txn_date >= $1 AND txn_date <= $2
                """,
            },
            "payments": {
                "query": """
                    SELECT COALESCE(SUM(amount), 0) AS value
                    FROM payments
                    WHERE payment_date >= $1 AND payment_date <= $2
                """,
            },
            "orders": {
                "query": """
                    SELECT COUNT(*) AS value
                    FROM sales_orders
                    WHERE txn_date >= $1 AND txn_date <= $2
                """,
            },
        }

        if metric not in metric_queries:
            return [{"error": f"Unknown metric '{metric}'. Valid: {', '.join(metric_queries.keys())}"}]

        q = metric_queries[metric]["query"]

        from database import fetch_one
        period_a = await fetch_one(q, period_a_start, period_a_end)
        period_b = await fetch_one(q, period_b_start, period_b_end)

        val_a = float(period_a["value"]) if period_a else 0
        val_b = float(period_b["value"]) if period_b else 0
        change = val_a - val_b
        change_pct = round((change / abs(val_b) * 100), 1) if val_b != 0 else 0

        return [{
            "metric": metric,
            "period_a": f"{period_a_start} to {period_a_end}",
            "period_a_value": round(val_a, 2),
            "period_b": f"{period_b_start} to {period_b_end}",
            "period_b_value": round(val_b, 2),
            "change": round(change, 2),
            "change_pct": change_pct,
        }]
