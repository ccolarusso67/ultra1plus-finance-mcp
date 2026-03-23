import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { parsePeriod, isTrailing } from "@/lib/periods";

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("company_id") || "u1p_ultrachem";
  const period = request.nextUrl.searchParams.get("period") || "trailing6";
  const includeCurrent = request.nextUrl.searchParams.get("includeCurrent") === "true";
  const p = parsePeriod(period, includeCurrent);
  const trailing = isTrailing(period);

  const dateFilter = trailing
    ? `i.txn_date >= ${p.start} AND i.txn_date <= ${p.end}`
    : `i.txn_date >= '${p.start}'::date AND i.txn_date <= '${p.end}'::date`;

  try {
    const [rankings, categoryRevenue, erosionAlerts] = await Promise.all([
      // Product rankings — period-aware
      query(`
        SELECT COALESCE(pc.name, il.description, il.sku) AS product_name,
               il.sku, pc.category,
               SUM(il.quantity) AS units_sold,
               ROUND(SUM(il.line_total)::numeric, 0) AS revenue,
               ROUND(SUM(il.cost * il.quantity)::numeric, 0) AS total_cost,
               ROUND((SUM(il.line_total) - SUM(il.cost * il.quantity))::numeric, 0) AS gross_margin,
               CASE WHEN SUM(il.line_total) > 0
                    THEN ROUND(((SUM(il.line_total) - SUM(il.cost * il.quantity))
                                 / SUM(il.line_total) * 100)::numeric, 1)
                    ELSE 0 END AS margin_pct,
               COUNT(DISTINCT i.customer_id) AS customer_count
        FROM invoice_lines il
        JOIN invoices i ON i.company_id = il.company_id AND i.txn_id = il.invoice_txn_id
        LEFT JOIN product_catalog pc ON pc.company_id = il.company_id AND pc.item_id = il.item_id
        WHERE i.company_id = $1 AND ${dateFilter}
        GROUP BY COALESCE(pc.name, il.description, il.sku), il.sku, pc.category
        ORDER BY revenue DESC
      `, [companyId]),
      // Revenue by category — period-aware
      query(`
        SELECT COALESCE(pc.category, 'Other') AS category,
               ROUND(SUM(il.line_total)::numeric, 0) AS revenue
        FROM invoice_lines il
        JOIN invoices i ON i.company_id = il.company_id AND i.txn_id = il.invoice_txn_id
        LEFT JOIN product_catalog pc ON pc.company_id = il.company_id AND pc.item_id = il.item_id
        WHERE i.company_id = $1 AND ${dateFilter}
        GROUP BY COALESCE(pc.category, 'Other')
        ORDER BY revenue DESC
      `, [companyId]),
      // Margin erosion (always uses 3-month vs prior 3-month comparison)
      query(`
        WITH recent AS (
          SELECT il.sku, COALESCE(pc.name, il.description) AS product_name,
                 SUM(il.line_total) AS revenue, SUM(il.cost * il.quantity) AS total_cost,
                 AVG(il.cost) AS avg_cost, AVG(il.unit_price) AS avg_price
          FROM invoice_lines il
          JOIN invoices i ON i.company_id = il.company_id AND i.txn_id = il.invoice_txn_id
          LEFT JOIN product_catalog pc ON pc.company_id = il.company_id AND pc.item_id = il.item_id
          WHERE i.company_id = $1 AND i.txn_date >= CURRENT_DATE - INTERVAL '3 months'
          GROUP BY il.sku, COALESCE(pc.name, il.description) HAVING SUM(il.line_total) > 0
        ),
        prior AS (
          SELECT il.sku, SUM(il.line_total) AS revenue, SUM(il.cost * il.quantity) AS total_cost,
                 AVG(il.cost) AS avg_cost
          FROM invoice_lines il
          JOIN invoices i ON i.company_id = il.company_id AND i.txn_id = il.invoice_txn_id
          WHERE i.company_id = $1
            AND i.txn_date >= CURRENT_DATE - INTERVAL '6 months'
            AND i.txn_date < CURRENT_DATE - INTERVAL '3 months'
          GROUP BY il.sku HAVING SUM(il.line_total) > 0
        )
        SELECT r.product_name, r.sku,
               ROUND(((r.revenue - r.total_cost) / r.revenue * 100)::numeric, 1) AS current_margin,
               ROUND(((p.revenue - p.total_cost) / p.revenue * 100)::numeric, 1) AS prior_margin,
               ROUND(((r.revenue - r.total_cost) / r.revenue * 100 - (p.revenue - p.total_cost) / p.revenue * 100)::numeric, 1) AS margin_change,
               ROUND(r.avg_cost::numeric, 2) AS current_cost,
               ROUND(p.avg_cost::numeric, 2) AS prior_cost
        FROM recent r JOIN prior p ON p.sku = r.sku
        WHERE ((r.revenue - r.total_cost) / r.revenue * 100) < ((p.revenue - p.total_cost) / p.revenue * 100) - 3
        ORDER BY margin_change ASC
      `, [companyId]),
    ]);

    const activeSkus = await query(
      `SELECT COUNT(*) AS count FROM product_catalog WHERE company_id = $1 AND is_active`,
      [companyId]
    );

    return NextResponse.json({
      rankings,
      categoryRevenue,
      erosionAlerts,
      activeSkus: Number(activeSkus[0]?.count || 0),
      periodLabel: p.label,
      isPartial: p.isPartial,
    });
  } catch (error) {
    console.error("Products API error:", error);
    return NextResponse.json({ error: "Failed to load product data" }, { status: 500 });
  }
}
