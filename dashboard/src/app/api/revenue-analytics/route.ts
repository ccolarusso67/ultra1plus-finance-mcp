import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { parsePeriod, isTrailing } from "@/lib/periods";

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("company_id") || "u1p_ultrachem";
  const period = request.nextUrl.searchParams.get("period") || "trailing12";
  const includeCurrent = request.nextUrl.searchParams.get("includeCurrent") === "true";
  const p = parsePeriod(period, includeCurrent);
  const trailing = isTrailing(period);

  // For trailing periods, use interval expressions; for fixed periods, use date literals
  const dateFilterSql = trailing
    ? `i.txn_date >= ${p.start} AND i.txn_date <= ${p.end}`
    : `i.txn_date >= '${p.start}'::date AND i.txn_date <= '${p.end}'::date`;

  // For margin queries (same filter)
  const marginDateFilter = dateFilterSql;

  try {
    const [
      revenueByCustomer,
      revenueByProduct,
      revenueByQuarter,
      qoqComparison,
      yoyComparison,
      ytdComparison,
      marginByMonth,
      marginByCustomer,
      marginByProduct,
      availablePeriods,
    ] = await Promise.all([
      // Revenue by Customer (period-filtered)
      query(`
        SELECT c.full_name AS customer_name, i.customer_id,
               ROUND(SUM(il.line_total)::numeric, 0) AS revenue,
               ROUND(SUM(il.cost * il.quantity)::numeric, 0) AS cogs,
               ROUND((SUM(il.line_total) - SUM(il.cost * il.quantity))::numeric, 0) AS gross_margin,
               CASE WHEN SUM(il.line_total) > 0
                    THEN ROUND(((SUM(il.line_total) - SUM(il.cost * il.quantity)) / SUM(il.line_total) * 100)::numeric, 1)
                    ELSE 0 END AS margin_pct,
               COUNT(DISTINCT i.txn_id) AS invoice_count
        FROM invoice_lines il
        JOIN invoices i ON i.company_id = il.company_id AND i.txn_id = il.invoice_txn_id
        JOIN customers c ON c.company_id = i.company_id AND c.customer_id = i.customer_id
        WHERE i.company_id = $1 AND ${dateFilterSql}
        GROUP BY c.full_name, i.customer_id
        ORDER BY revenue DESC
        LIMIT 25
      `, [companyId]),

      // Revenue by Product (period-filtered)
      query(`
        SELECT COALESCE(pc.name, il.description, il.sku) AS product_name,
               il.sku, COALESCE(pc.category, 'Other') AS category,
               ROUND(SUM(il.line_total)::numeric, 0) AS revenue,
               ROUND(SUM(il.cost * il.quantity)::numeric, 0) AS cogs,
               ROUND((SUM(il.line_total) - SUM(il.cost * il.quantity))::numeric, 0) AS gross_margin,
               CASE WHEN SUM(il.line_total) > 0
                    THEN ROUND(((SUM(il.line_total) - SUM(il.cost * il.quantity)) / SUM(il.line_total) * 100)::numeric, 1)
                    ELSE 0 END AS margin_pct,
               SUM(il.quantity) AS units_sold
        FROM invoice_lines il
        JOIN invoices i ON i.company_id = il.company_id AND i.txn_id = il.invoice_txn_id
        LEFT JOIN product_catalog pc ON pc.company_id = il.company_id AND pc.item_id = il.item_id
        WHERE i.company_id = $1 AND ${dateFilterSql}
        GROUP BY COALESCE(pc.name, il.description, il.sku), il.sku, COALESCE(pc.category, 'Other')
        ORDER BY revenue DESC
        LIMIT 25
      `, [companyId]),

      // Revenue by Quarter (all time — always show full history)
      query(`
        SELECT DATE_TRUNC('quarter', month)::date AS quarter,
               TO_CHAR(DATE_TRUNC('quarter', month), 'YYYY "Q"Q') AS label,
               ROUND(SUM(income)::numeric, 0) AS revenue,
               ROUND(SUM(cogs)::numeric, 0) AS cogs,
               ROUND(SUM(gross_profit)::numeric, 0) AS gross_profit,
               CASE WHEN SUM(income) > 0
                    THEN ROUND((SUM(gross_profit) / SUM(income) * 100)::numeric, 1)
                    ELSE 0 END AS margin_pct
        FROM monthly_pnl
        WHERE company_id = $1 AND report_basis = 'accrual'
        GROUP BY DATE_TRUNC('quarter', month)
        ORDER BY quarter ASC
      `, [companyId]),

      // QoQ Comparison
      query(`
        WITH current_q AS (
          SELECT SUM(income) AS revenue, SUM(cogs) AS cogs, SUM(gross_profit) AS gross_profit
          FROM monthly_pnl
          WHERE company_id = $1 AND report_basis = 'accrual'
            AND month >= DATE_TRUNC('quarter', CURRENT_DATE)
        ),
        prior_q AS (
          SELECT SUM(income) AS revenue, SUM(cogs) AS cogs, SUM(gross_profit) AS gross_profit
          FROM monthly_pnl
          WHERE company_id = $1 AND report_basis = 'accrual'
            AND month >= DATE_TRUNC('quarter', CURRENT_DATE) - INTERVAL '3 months'
            AND month < DATE_TRUNC('quarter', CURRENT_DATE)
        )
        SELECT
          ROUND(c.revenue::numeric, 0) AS current_revenue,
          ROUND(p.revenue::numeric, 0) AS prior_revenue,
          CASE WHEN p.revenue > 0
               THEN ROUND(((c.revenue - p.revenue) / p.revenue * 100)::numeric, 1)
               ELSE 0 END AS revenue_change_pct,
          ROUND(c.gross_profit::numeric, 0) AS current_gp,
          ROUND(p.gross_profit::numeric, 0) AS prior_gp,
          CASE WHEN c.revenue > 0
               THEN ROUND((c.gross_profit / c.revenue * 100)::numeric, 1)
               ELSE 0 END AS current_margin,
          CASE WHEN p.revenue > 0
               THEN ROUND((p.gross_profit / p.revenue * 100)::numeric, 1)
               ELSE 0 END AS prior_margin,
          TO_CHAR(DATE_TRUNC('quarter', CURRENT_DATE), 'YYYY "Q"Q') AS current_label,
          TO_CHAR(DATE_TRUNC('quarter', CURRENT_DATE) - INTERVAL '3 months', 'YYYY "Q"Q') AS prior_label
        FROM current_q c, prior_q p
      `, [companyId]),

      // YoY Comparison
      query(`
        WITH current_yr AS (
          SELECT TO_CHAR(month, 'Mon') AS mon, EXTRACT(MONTH FROM month) AS m,
                 income AS revenue, gross_profit,
                 CASE WHEN income > 0 THEN ROUND((gross_profit / income * 100)::numeric, 1) ELSE 0 END AS margin_pct
          FROM monthly_pnl
          WHERE company_id = $1 AND report_basis = 'accrual'
            AND month >= DATE_TRUNC('year', CURRENT_DATE)
        ),
        prior_yr AS (
          SELECT EXTRACT(MONTH FROM month) AS m,
                 income AS revenue, gross_profit,
                 CASE WHEN income > 0 THEN ROUND((gross_profit / income * 100)::numeric, 1) ELSE 0 END AS margin_pct
          FROM monthly_pnl
          WHERE company_id = $1 AND report_basis = 'accrual'
            AND month >= DATE_TRUNC('year', CURRENT_DATE) - INTERVAL '1 year'
            AND month < DATE_TRUNC('year', CURRENT_DATE)
        )
        SELECT c.mon AS label, c.m,
               ROUND(c.revenue::numeric, 0) AS current_revenue,
               ROUND(COALESCE(p.revenue, 0)::numeric, 0) AS prior_revenue,
               c.margin_pct AS current_margin,
               COALESCE(p.margin_pct, 0) AS prior_margin
        FROM current_yr c
        LEFT JOIN prior_yr p ON p.m = c.m
        ORDER BY c.m
      `, [companyId]),

      // YTD vs Prior YTD
      query(`
        WITH ytd AS (
          SELECT SUM(income) AS revenue, SUM(cogs) AS cogs, SUM(gross_profit) AS gp, SUM(net_income) AS ni
          FROM monthly_pnl
          WHERE company_id = $1 AND report_basis = 'accrual'
            AND month >= DATE_TRUNC('year', CURRENT_DATE)
        ),
        prior_ytd AS (
          SELECT SUM(income) AS revenue, SUM(cogs) AS cogs, SUM(gross_profit) AS gp, SUM(net_income) AS ni
          FROM monthly_pnl
          WHERE company_id = $1 AND report_basis = 'accrual'
            AND month >= DATE_TRUNC('year', CURRENT_DATE) - INTERVAL '1 year'
            AND month < DATE_TRUNC('year', CURRENT_DATE) - INTERVAL '1 year' + (CURRENT_DATE - DATE_TRUNC('year', CURRENT_DATE)::date) * INTERVAL '1 day'
        )
        SELECT
          ROUND(c.revenue::numeric, 0) AS ytd_revenue,
          ROUND(p.revenue::numeric, 0) AS prior_ytd_revenue,
          CASE WHEN p.revenue > 0
               THEN ROUND(((c.revenue - p.revenue) / p.revenue * 100)::numeric, 1) ELSE 0 END AS rev_change_pct,
          ROUND(c.gp::numeric, 0) AS ytd_gp,
          ROUND(p.gp::numeric, 0) AS prior_ytd_gp,
          CASE WHEN c.revenue > 0
               THEN ROUND((c.gp / c.revenue * 100)::numeric, 1) ELSE 0 END AS ytd_margin,
          CASE WHEN p.revenue > 0
               THEN ROUND((p.gp / p.revenue * 100)::numeric, 1) ELSE 0 END AS prior_ytd_margin
        FROM ytd c, prior_ytd p
      `, [companyId]),

      // Margin by Month (last 24 months)
      query(`
        SELECT TO_CHAR(month, 'Mon YY') AS label, month,
               ROUND(income::numeric, 0) AS revenue,
               ROUND(gross_profit::numeric, 0) AS gross_profit,
               CASE WHEN income > 0
                    THEN ROUND((gross_profit / income * 100)::numeric, 1)
                    ELSE 0 END AS gross_margin_pct,
               ROUND(net_income::numeric, 0) AS net_income,
               CASE WHEN income > 0
                    THEN ROUND((net_income / income * 100)::numeric, 1)
                    ELSE 0 END AS net_margin_pct
        FROM monthly_pnl
        WHERE company_id = $1 AND report_basis = 'accrual'
        ORDER BY month DESC
        LIMIT 24
      `, [companyId]),

      // Margin by Customer (period-filtered)
      query(`
        SELECT c.full_name AS customer_name,
               ROUND(SUM(il.line_total)::numeric, 0) AS revenue,
               CASE WHEN SUM(il.line_total) > 0
                    THEN ROUND(((SUM(il.line_total) - SUM(il.cost * il.quantity)) / SUM(il.line_total) * 100)::numeric, 1)
                    ELSE 0 END AS margin_pct
        FROM invoice_lines il
        JOIN invoices i ON i.company_id = il.company_id AND i.txn_id = il.invoice_txn_id
        JOIN customers c ON c.company_id = i.company_id AND c.customer_id = i.customer_id
        WHERE i.company_id = $1 AND ${marginDateFilter}
        GROUP BY c.full_name
        HAVING SUM(il.line_total) > 1000
        ORDER BY SUM(il.line_total) DESC
        LIMIT 15
      `, [companyId]),

      // Margin by Product (period-filtered)
      query(`
        SELECT COALESCE(pc.name, il.description, il.sku) AS product_name,
               ROUND(SUM(il.line_total)::numeric, 0) AS revenue,
               CASE WHEN SUM(il.line_total) > 0
                    THEN ROUND(((SUM(il.line_total) - SUM(il.cost * il.quantity)) / SUM(il.line_total) * 100)::numeric, 1)
                    ELSE 0 END AS margin_pct
        FROM invoice_lines il
        JOIN invoices i ON i.company_id = il.company_id AND i.txn_id = il.invoice_txn_id
        LEFT JOIN product_catalog pc ON pc.company_id = il.company_id AND pc.item_id = il.item_id
        WHERE i.company_id = $1 AND ${marginDateFilter}
        GROUP BY COALESCE(pc.name, il.description, il.sku)
        HAVING SUM(il.line_total) > 1000
        ORDER BY SUM(il.line_total) DESC
        LIMIT 15
      `, [companyId]),

      // Available periods for the selector
      query(`
        SELECT DISTINCT TO_CHAR(DATE_TRUNC('quarter', month), 'YYYY "Q"Q') AS label,
               TO_CHAR(DATE_TRUNC('quarter', month), 'YYYY') || 'Q' || EXTRACT(QUARTER FROM month) AS value,
               DATE_TRUNC('quarter', month) AS sort_date
        FROM monthly_pnl
        WHERE company_id = $1 AND report_basis = 'accrual'
        ORDER BY sort_date DESC
      `, [companyId]),
    ]);

    return NextResponse.json({
      revenueByCustomer,
      revenueByProduct,
      revenueByQuarter,
      qoq: qoqComparison[0] || {},
      yoy: yoyComparison,
      ytdComparison: ytdComparison[0] || {},
      marginByMonth: marginByMonth.reverse(),
      marginByCustomer,
      marginByProduct,
      availablePeriods,
      selectedPeriod: period,
      periodLabel: p.label,
    });
  } catch (error) {
    console.error("Revenue Analytics API error:", error);
    return NextResponse.json({ error: "Failed to load revenue analytics" }, { status: 500 });
  }
}
