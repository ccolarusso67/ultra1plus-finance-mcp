import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";

export async function GET() {
  try {
    const [kpis, revenueTrend, arAging, apAging, overdueCustomers, recentPayments] =
      await Promise.all([
        // KPIs
        queryOne(`
          SELECT
            (SELECT COALESCE(SUM(total_open_balance), 0) FROM v_latest_ar_aging) AS total_ar,
            (SELECT COALESCE(SUM(total_open_balance), 0) FROM v_latest_ap_aging) AS total_ap,
            (SELECT COALESCE(SUM(income), 0) FROM monthly_pnl
             WHERE month = DATE_TRUNC('month', CURRENT_DATE) AND report_basis = 'accrual') AS mtd_revenue,
            (SELECT CASE WHEN SUM(income) > 0
                    THEN ROUND((SUM(gross_profit) / SUM(income) * 100)::numeric, 1)
                    ELSE 0 END
             FROM monthly_pnl
             WHERE month = DATE_TRUNC('month', CURRENT_DATE) AND report_basis = 'accrual') AS mtd_margin_pct,
            (SELECT COALESCE(SUM(amount), 0) FROM v_open_sales_orders) AS backlog_value,
            (SELECT COUNT(*) FROM v_open_sales_orders WHERE is_overdue) AS overdue_orders
        `),
        // Revenue trend (12 months)
        query(`
          SELECT TO_CHAR(month, 'Mon YY') AS label, month,
                 income AS revenue, cogs, gross_profit, net_income,
                 CASE WHEN income > 0
                      THEN ROUND((gross_profit::numeric / income * 100), 1)
                      ELSE 0 END AS margin_pct
          FROM monthly_pnl
          WHERE report_basis = 'accrual'
          ORDER BY month DESC LIMIT 12
        `),
        // AR aging totals
        query(`
          SELECT customer_name, current_bucket, days_1_30, days_31_60,
                 days_61_90, days_91_plus, total_open_balance
          FROM v_latest_ar_aging
          ORDER BY total_open_balance DESC LIMIT 10
        `),
        // AP aging totals
        query(`
          SELECT vendor_name, current_bucket, days_1_30, days_31_60,
                 days_61_90, days_91_plus, total_open_balance
          FROM v_latest_ap_aging
          ORDER BY total_open_balance DESC LIMIT 10
        `),
        // Top overdue customers
        query(`
          SELECT customer_name, total_open_balance,
                 days_31_60 + days_61_90 + days_91_plus AS overdue_amount
          FROM v_latest_ar_aging
          WHERE days_31_60 + days_61_90 + days_91_plus > 0
          ORDER BY overdue_amount DESC LIMIT 5
        `),
        // Recent payments
        query(`
          SELECT c.full_name AS customer_name, p.payment_date, p.amount, p.payment_method
          FROM payments p
          LEFT JOIN customers c ON c.customer_id = p.customer_id
          ORDER BY p.payment_date DESC LIMIT 5
        `),
      ]);

    return NextResponse.json({
      kpis: {
        ...kpis,
        net_position: Number(kpis?.total_ar || 0) - Number(kpis?.total_ap || 0),
      },
      revenueTrend: revenueTrend.reverse(),
      arAging,
      apAging,
      overdueCustomers,
      recentPayments,
    });
  } catch (error) {
    console.error("Overview API error:", error);
    return NextResponse.json({ error: "Failed to load overview data" }, { status: 500 });
  }
}
