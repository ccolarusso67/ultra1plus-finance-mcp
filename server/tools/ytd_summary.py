"""YTD Summary tool."""

from mcp.server.fastmcp import FastMCP
from database import fetch_all
from audit import audited


def register(mcp: FastMCP):
    @mcp.tool()
    @audited("get_ytd_summary")
    async def get_ytd_summary() -> list[dict]:
        """Get year-to-date financial summary with prior year comparison.

        Returns:
            YTD totals for revenue, COGS, gross profit, operating expenses,
            and net income — for both current year and prior year — with
            change amounts and percentages.
        """
        query = """
            WITH current_ytd AS (
                SELECT
                    COALESCE(SUM(income), 0) AS revenue,
                    COALESCE(SUM(cogs), 0) AS cogs,
                    COALESCE(SUM(gross_profit), 0) AS gross_profit,
                    COALESCE(SUM(operating_expenses), 0) AS operating_expenses,
                    COALESCE(SUM(net_income), 0) AS net_income
                FROM monthly_pnl
                WHERE month >= DATE_TRUNC('year', CURRENT_DATE)
                  AND month < CURRENT_DATE
                  AND report_basis = 'accrual'
            ),
            prior_ytd AS (
                SELECT
                    COALESCE(SUM(income), 0) AS revenue,
                    COALESCE(SUM(cogs), 0) AS cogs,
                    COALESCE(SUM(gross_profit), 0) AS gross_profit,
                    COALESCE(SUM(operating_expenses), 0) AS operating_expenses,
                    COALESCE(SUM(net_income), 0) AS net_income
                FROM monthly_pnl
                WHERE month >= DATE_TRUNC('year', CURRENT_DATE) - INTERVAL '1 year'
                  AND month < CURRENT_DATE - INTERVAL '1 year'
                  AND report_basis = 'accrual'
            )
            SELECT
                'current_ytd' AS period,
                c.revenue, c.cogs, c.gross_profit,
                c.operating_expenses, c.net_income,
                CASE WHEN c.revenue > 0
                     THEN ROUND((c.gross_profit / c.revenue * 100)::numeric, 1)
                     ELSE 0 END AS gross_margin_pct,

                p.revenue AS prior_revenue,
                p.cogs AS prior_cogs,
                p.gross_profit AS prior_gross_profit,
                p.operating_expenses AS prior_operating_expenses,
                p.net_income AS prior_net_income,

                ROUND((c.revenue - p.revenue)::numeric, 2) AS revenue_change,
                CASE WHEN p.revenue > 0
                     THEN ROUND(((c.revenue - p.revenue) / p.revenue * 100)::numeric, 1)
                     ELSE 0 END AS revenue_change_pct,

                ROUND((c.net_income - p.net_income)::numeric, 2) AS net_income_change,
                CASE WHEN p.net_income != 0
                     THEN ROUND(((c.net_income - p.net_income) / ABS(p.net_income) * 100)::numeric, 1)
                     ELSE 0 END AS net_income_change_pct
            FROM current_ytd c, prior_ytd p
        """
        return await fetch_all(query)
