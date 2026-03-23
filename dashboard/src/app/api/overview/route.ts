import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { parsePeriod, isTrailing } from "@/lib/periods";

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("company_id") || "u1p_ultrachem";
  const period = request.nextUrl.searchParams.get("period") || "trailing12";
  const includeCurrent = request.nextUrl.searchParams.get("includeCurrent") === "true";
  const p = parsePeriod(period, includeCurrent);
  const trailing = isTrailing(period);

  // Build date filter for monthly_pnl.month column
  const pnlFilter = trailing
    ? `month >= ${p.start} AND month <= ${p.end}`
    : `month >= '${p.start}'::date AND month <= '${p.end}'::date`;

  // Build payment date filter
  const paymentFilter = trailing
    ? `p.payment_date >= ${p.start} AND p.payment_date <= ${p.end}`
    : `p.payment_date >= '${p.start}'::date AND p.payment_date <= '${p.end}'::date`;

  try {
    const [kpis, revenueTrend, arAging, apAging, overdueCustomers, recentPayments] =
      await Promise.all([
        // KPIs — period-aware revenue/margin
        queryOne(`
          SELECT
            (SELECT COALESCE(SUM(total_open_balance), 0) FROM v_latest_ar_aging WHERE company_id = $1) AS total_ar,
            (SELECT COALESCE(SUM(total_open_balance), 0) FROM v_latest_ap_aging WHERE company_id = $1) AS total_ap,
            (SELECT COALESCE(SUM(income), 0) FROM monthly_pnl
             WHERE company_id = $1 AND report_basis = 'accrual' AND ${pnlFilter}) AS period_revenue,
            (SELECT CASE WHEN SUM(income) > 0
                    THEN ROUND((SUM(gross_profit) / SUM(income) * 100)::numeric, 1)
                    ELSE 0 END
             FROM monthly_pnl
             WHERE company_id = $1 AND report_basis = 'accrual' AND ${pnlFilter}) AS period_margin_pct,
            (SELECT COALESCE(SUM(net_income), 0) FROM monthly_pnl
             WHERE company_id = $1 AND report_basis = 'accrual' AND ${pnlFilter}) AS period_net_income,
            (SELECT COALESCE(SUM(amount), 0) FROM v_open_sales_orders WHERE company_id = $1) AS backlog_value,
            (SELECT COUNT(*) FROM v_open_sales_orders WHERE company_id = $1 AND is_overdue) AS overdue_orders
        `, [companyId]),
        // Revenue trend — period-filtered
        query(`
          SELECT TO_CHAR(month, 'Mon YY') AS label, month,
                 income AS revenue, cogs, gross_profit, net_income,
                 CASE WHEN income > 0
                      THEN ROUND((gross_profit::numeric / income * 100), 1)
                      ELSE 0 END AS margin_pct
          FROM monthly_pnl
          WHERE company_id = $1 AND report_basis = 'accrual'
            AND ${pnlFilter}
          ORDER BY month ASC
        `, [companyId]),
        // AR aging totals (always current snapshot)
        query(`
          SELECT customer_name, current_bucket, days_1_30, days_31_60,
                 days_61_90, days_91_plus, total_open_balance
          FROM v_latest_ar_aging
          WHERE company_id = $1
          ORDER BY total_open_balance DESC LIMIT 10
        `, [companyId]),
        // AP aging totals (always current snapshot)
        query(`
          SELECT vendor_name, current_bucket, days_1_30, days_31_60,
                 days_61_90, days_91_plus, total_open_balance
          FROM v_latest_ap_aging
          WHERE company_id = $1
          ORDER BY total_open_balance DESC LIMIT 10
        `, [companyId]),
        // Top overdue customers (always current)
        query(`
          SELECT customer_name, total_open_balance,
                 days_31_60 + days_61_90 + days_91_plus AS overdue_amount
          FROM v_latest_ar_aging
          WHERE company_id = $1 AND days_31_60 + days_61_90 + days_91_plus > 0
          ORDER BY overdue_amount DESC LIMIT 5
        `, [companyId]),
        // Recent payments — period-filtered
        query(`
          SELECT c.full_name AS customer_name, p.payment_date, p.amount, p.payment_method
          FROM payments p
          LEFT JOIN customers c ON c.company_id = p.company_id AND c.customer_id = p.customer_id
          WHERE p.company_id = $1 AND ${paymentFilter}
          ORDER BY p.payment_date DESC LIMIT 10
        `, [companyId]),
      ]);

    return NextResponse.json({
      kpis: {
        ...kpis,
        net_position: Number(kpis?.total_ar || 0) - Number(kpis?.total_ap || 0),
      },
      revenueTrend,
      arAging,
      apAging,
      overdueCustomers,
      recentPayments,
      periodLabel: p.label,
      isPartial: p.isPartial,
    });
  } catch (error) {
    console.error("Overview API error:", error);
    return NextResponse.json({ error: "Failed to load overview data" }, { status: 500 });
  }
}
