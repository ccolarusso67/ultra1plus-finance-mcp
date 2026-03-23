import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { parsePeriod, isTrailing } from "@/lib/periods";

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("company_id") || "u1p_ultrachem";
  const period = request.nextUrl.searchParams.get("period") || "trailing6";
  const includeCurrent = request.nextUrl.searchParams.get("includeCurrent") === "true";
  const p = parsePeriod(period, includeCurrent);
  const trailing = isTrailing(period);

  const invoiceDateFilter = trailing
    ? `i.txn_date >= ${p.start} AND i.txn_date <= ${p.end}`
    : `i.txn_date >= '${p.start}'::date AND i.txn_date <= '${p.end}'::date`;

  try {
    const [rankings, declining, reorderAlerts] = await Promise.all([
      // Customer rankings by revenue — period-aware
      query(`
        SELECT c.full_name AS customer_name,
               ROUND(SUM(il.line_total)::numeric, 0) AS revenue,
               ROUND(SUM(il.cost * il.quantity)::numeric, 0) AS cogs,
               ROUND(SUM(il.line_total - il.cost * il.quantity)::numeric, 0) AS gross_margin,
               COUNT(DISTINCT i.txn_id) AS order_count,
               CASE WHEN SUM(il.line_total) > 0
                    THEN ROUND((SUM(il.line_total - il.cost * il.quantity) / SUM(il.line_total) * 100)::numeric, 1)
                    ELSE 0 END AS margin_pct
        FROM invoice_lines il
        JOIN invoices i ON i.company_id = il.company_id AND i.txn_id = il.invoice_txn_id
        JOIN customers c ON c.company_id = i.company_id AND c.customer_id = i.customer_id
        WHERE i.company_id = $1 AND ${invoiceDateFilter}
        GROUP BY c.full_name
        ORDER BY SUM(il.line_total) DESC
      `, [companyId]),
      // Declining accounts (always uses 6-month comparison)
      query(`
        WITH recent AS (
          SELECT i.customer_id, c.full_name AS customer_name,
                 SUM(il.line_total) AS revenue
          FROM invoice_lines il
          JOIN invoices i ON i.company_id = il.company_id AND i.txn_id = il.invoice_txn_id
          JOIN customers c ON c.company_id = i.company_id AND c.customer_id = i.customer_id
          WHERE i.company_id = $1 AND i.txn_date >= CURRENT_DATE - INTERVAL '6 months'
          GROUP BY i.customer_id, c.full_name
        ),
        prior AS (
          SELECT i.customer_id, SUM(il.line_total) AS revenue
          FROM invoice_lines il
          JOIN invoices i ON i.company_id = il.company_id AND i.txn_id = il.invoice_txn_id
          WHERE i.company_id = $1
            AND i.txn_date >= CURRENT_DATE - INTERVAL '12 months'
            AND i.txn_date < CURRENT_DATE - INTERVAL '6 months'
          GROUP BY i.customer_id
        )
        SELECT r.customer_name,
               ROUND(r.revenue::numeric, 0) AS current_revenue,
               ROUND(p.revenue::numeric, 0) AS prior_revenue,
               ROUND((p.revenue - r.revenue)::numeric, 0) AS decline_amount,
               ROUND(((p.revenue - r.revenue) / NULLIF(p.revenue, 0) * 100)::numeric, 1) AS decline_pct
        FROM recent r JOIN prior p ON p.customer_id = r.customer_id
        WHERE p.revenue > r.revenue
        ORDER BY (p.revenue - r.revenue) DESC
      `, [companyId]),
      // Reorder alerts (always uses 18-month analysis)
      query(`
        WITH customer_orders AS (
          SELECT i.customer_id, c.full_name AS customer_name, i.txn_date,
                 LAG(i.txn_date) OVER (PARTITION BY i.customer_id ORDER BY i.txn_date) AS prev_date,
                 i.amount
          FROM invoices i
          JOIN customers c ON c.company_id = i.company_id AND c.customer_id = i.customer_id
          WHERE i.company_id = $1 AND c.is_active AND i.txn_date >= CURRENT_DATE - INTERVAL '18 months'
        ),
        cycle_stats AS (
          SELECT customer_id, customer_name,
                 AVG(txn_date - prev_date) AS avg_cycle_days,
                 MAX(txn_date) AS last_order_date,
                 AVG(amount) AS avg_order_value
          FROM customer_orders WHERE prev_date IS NOT NULL
          GROUP BY customer_id, customer_name HAVING COUNT(*) >= 3
        )
        SELECT customer_name,
               ROUND(avg_cycle_days::numeric, 0) AS avg_cycle_days,
               last_order_date,
               (CURRENT_DATE - last_order_date) AS days_since_last,
               (CURRENT_DATE - last_order_date) - ROUND(avg_cycle_days::numeric, 0)::int AS days_overdue,
               ROUND(avg_order_value::numeric, 0) AS avg_order_value
        FROM cycle_stats
        WHERE (CURRENT_DATE - last_order_date) > avg_cycle_days + 14
        ORDER BY days_overdue DESC
      `, [companyId]),
    ]);

    const activeCount = await query(
      `SELECT COUNT(*) AS count FROM customers WHERE company_id = $1 AND is_active`,
      [companyId]
    );

    return NextResponse.json({
      rankings,
      declining,
      reorderAlerts,
      activeCount: Number(activeCount[0]?.count || 0),
      periodLabel: p.label,
      isPartial: p.isPartial,
    });
  } catch (error) {
    console.error("Customers API error:", error);
    return NextResponse.json({ error: "Failed to load customer data" }, { status: 500 });
  }
}
