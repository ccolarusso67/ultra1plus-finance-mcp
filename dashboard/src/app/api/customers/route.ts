import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const [rankings, declining, reorderAlerts] = await Promise.all([
      // Customer rankings by revenue
      query(`
        SELECT customer_name, sales_amount AS revenue, cogs_amount AS cogs,
               gross_margin, order_count,
               CASE WHEN sales_amount > 0
                    THEN ROUND((gross_margin / sales_amount * 100)::numeric, 1)
                    ELSE 0 END AS margin_pct
        FROM sales_by_customer
        WHERE period_start >= DATE_TRUNC('quarter', CURRENT_DATE)
        ORDER BY sales_amount DESC
      `),
      // Declining accounts
      query(`
        WITH recent AS (
          SELECT i.customer_id, c.full_name AS customer_name,
                 SUM(il.line_total) AS revenue
          FROM invoice_lines il
          JOIN invoices i ON i.txn_id = il.invoice_txn_id
          JOIN customers c ON c.customer_id = i.customer_id
          WHERE i.txn_date >= CURRENT_DATE - INTERVAL '6 months'
          GROUP BY i.customer_id, c.full_name
        ),
        prior AS (
          SELECT i.customer_id, SUM(il.line_total) AS revenue
          FROM invoice_lines il
          JOIN invoices i ON i.txn_id = il.invoice_txn_id
          WHERE i.txn_date >= CURRENT_DATE - INTERVAL '12 months'
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
      `),
      // Reorder alerts
      query(`
        WITH customer_orders AS (
          SELECT i.customer_id, c.full_name AS customer_name, i.txn_date,
                 LAG(i.txn_date) OVER (PARTITION BY i.customer_id ORDER BY i.txn_date) AS prev_date,
                 i.amount
          FROM invoices i
          JOIN customers c ON c.customer_id = i.customer_id
          WHERE c.is_active AND i.txn_date >= CURRENT_DATE - INTERVAL '18 months'
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
      `),
    ]);

    const activeCount = await query(`SELECT COUNT(*) AS count FROM customers WHERE is_active`);

    return NextResponse.json({
      rankings,
      declining,
      reorderAlerts,
      activeCount: Number(activeCount[0]?.count || 0),
    });
  } catch (error) {
    console.error("Customers API error:", error);
    return NextResponse.json({ error: "Failed to load customer data" }, { status: 500 });
  }
}
