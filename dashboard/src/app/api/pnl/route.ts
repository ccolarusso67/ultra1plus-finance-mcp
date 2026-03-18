import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";

export async function GET() {
  try {
    const [monthly, ytd] = await Promise.all([
      query(`
        SELECT TO_CHAR(month, 'Mon YY') AS label, month,
               income, cogs, gross_profit, operating_expenses,
               other_income, other_expenses, net_income,
               CASE WHEN income > 0
                    THEN ROUND((gross_profit::numeric / income * 100), 1)
                    ELSE 0 END AS margin_pct
        FROM monthly_pnl
        WHERE report_basis = 'accrual'
        ORDER BY month ASC
      `),
      queryOne(`
        WITH current_ytd AS (
          SELECT SUM(income) AS revenue, SUM(cogs) AS cogs,
                 SUM(gross_profit) AS gross_profit,
                 SUM(operating_expenses) AS opex, SUM(net_income) AS net_income
          FROM monthly_pnl
          WHERE month >= DATE_TRUNC('year', CURRENT_DATE) AND report_basis = 'accrual'
        ),
        prior_ytd AS (
          SELECT SUM(income) AS revenue, SUM(cogs) AS cogs,
                 SUM(gross_profit) AS gross_profit,
                 SUM(operating_expenses) AS opex, SUM(net_income) AS net_income
          FROM monthly_pnl
          WHERE month >= DATE_TRUNC('year', CURRENT_DATE) - INTERVAL '1 year'
            AND month < DATE_TRUNC('year', CURRENT_DATE) AND report_basis = 'accrual'
        )
        SELECT
          c.revenue, c.cogs, c.gross_profit, c.opex, c.net_income,
          CASE WHEN c.revenue > 0
               THEN ROUND((c.gross_profit / c.revenue * 100)::numeric, 1) ELSE 0 END AS margin_pct,
          p.revenue AS prior_revenue, p.net_income AS prior_net_income,
          CASE WHEN p.revenue > 0
               THEN ROUND(((c.revenue - p.revenue) / p.revenue * 100)::numeric, 1) ELSE 0 END AS rev_change_pct,
          CASE WHEN p.net_income != 0
               THEN ROUND(((c.net_income - p.net_income) / ABS(p.net_income) * 100)::numeric, 1) ELSE 0 END AS ni_change_pct
        FROM current_ytd c, prior_ytd p
      `),
    ]);

    return NextResponse.json({ monthly, ytd });
  } catch (error) {
    console.error("P&L API error:", error);
    return NextResponse.json({ error: "Failed to load P&L data" }, { status: 500 });
  }
}
