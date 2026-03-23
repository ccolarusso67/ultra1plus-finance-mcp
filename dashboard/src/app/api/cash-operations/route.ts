import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("company_id") || "u1p_ultrachem";
  const days = parseInt(request.nextUrl.searchParams.get("days") || "90");

  try {
    const [
      kpis,
      dailyCollections,
      topPayingCustomers,
      largestOverdue,
      arBuckets,
      collectionConcentration,
      billsDueTimeline,
      apBuckets,
      largestUnpaidVendors,
      apConcentration,
      collectionsVsObligations,
      monthlyTrends,
      backlogByCustomer,
      invoicingTrend,
      riskCustomers,
      riskVendors,
      syncWarnings,
      alertFlags,
    ] = await Promise.all([
      // === KPIs ===
      queryOne(`
        SELECT
          (SELECT COALESCE(SUM(amount), 0) FROM payments
           WHERE company_id = $1 AND payment_date >= CURRENT_DATE - 7) AS cash_in_7d,
          (SELECT COALESCE(SUM(amount), 0) FROM payments
           WHERE company_id = $1 AND payment_date >= CURRENT_DATE - 30) AS cash_in_30d,
          (SELECT COALESCE(SUM(amount), 0) FROM bills
           WHERE company_id = $1 AND NOT is_paid AND due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7) AS bills_due_7d,
          (SELECT COALESCE(SUM(amount), 0) FROM bills
           WHERE company_id = $1 AND NOT is_paid AND due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30) AS bills_due_30d,
          (SELECT COALESCE(SUM(total_open_balance), 0) FROM v_latest_ar_aging
           WHERE company_id = $1) AS open_ar,
          (SELECT COALESCE(SUM(total_open_balance), 0) FROM v_latest_ap_aging
           WHERE company_id = $1) AS open_ap,
          (SELECT COALESCE(SUM(amount), 0) FROM v_open_sales_orders
           WHERE company_id = $1) AS backlog_value,
          (SELECT COALESCE(SUM(days_91_plus), 0) FROM v_latest_ar_aging
           WHERE company_id = $1) AS ar_over_90,
          (SELECT COALESCE(SUM(days_91_plus), 0) FROM v_latest_ap_aging
           WHERE company_id = $1) AS ap_over_90
      `, [companyId]),

      // === Daily collections (configurable range) ===
      query(`
        SELECT payment_date::date AS date,
               TO_CHAR(payment_date, 'Mon DD') AS label,
               ROUND(SUM(amount)::numeric, 0) AS amount,
               COUNT(*) AS count
        FROM payments
        WHERE company_id = $1 AND payment_date >= CURRENT_DATE - $2::int
        GROUP BY payment_date::date
        ORDER BY date ASC
      `, [companyId, days]),

      // === Top paying customers (last 30 days) ===
      query(`
        SELECT c.full_name AS customer_name,
               ROUND(SUM(p.amount)::numeric, 0) AS total_paid,
               COUNT(*) AS payment_count,
               MAX(p.payment_date)::text AS last_payment
        FROM payments p
        JOIN customers c ON c.company_id = p.company_id AND c.customer_id = p.customer_id
        WHERE p.company_id = $1 AND p.payment_date >= CURRENT_DATE - 30
        GROUP BY c.full_name
        ORDER BY total_paid DESC
        LIMIT 15
      `, [companyId]),

      // === Largest overdue invoices ===
      query(`
        SELECT ref_number, customer_name, amount, balance_remaining,
               due_date::text, days_past_due
        FROM v_open_invoices
        WHERE company_id = $1 AND days_past_due > 0
        ORDER BY balance_remaining DESC
        LIMIT 20
      `, [companyId]),

      // === AR aging buckets ===
      queryOne(`
        SELECT
          COALESCE(SUM(current_bucket), 0) AS current,
          COALESCE(SUM(days_1_30), 0) AS days_1_30,
          COALESCE(SUM(days_31_60), 0) AS days_31_60,
          COALESCE(SUM(days_61_90), 0) AS days_61_90,
          COALESCE(SUM(days_91_plus), 0) AS days_91_plus,
          COALESCE(SUM(total_open_balance), 0) AS total
        FROM v_latest_ar_aging
        WHERE company_id = $1
      `, [companyId]),

      // === AR concentration: top 10 with % of total ===
      query(`
        WITH totals AS (
          SELECT COALESCE(SUM(total_open_balance), 0) AS total_ar
          FROM v_latest_ar_aging WHERE company_id = $1
        )
        SELECT a.customer_name,
               a.total_open_balance AS balance,
               a.days_91_plus,
               CASE WHEN t.total_ar > 0
                    THEN ROUND(a.total_open_balance / t.total_ar * 100, 1)
                    ELSE 0 END AS pct_of_total
        FROM v_latest_ar_aging a, totals t
        WHERE a.company_id = $1
        ORDER BY a.total_open_balance DESC
        LIMIT 10
      `, [companyId]),

      // === Bills due timeline (next 8 weeks) ===
      query(`
        SELECT
          DATE_TRUNC('week', due_date)::date AS week_start,
          TO_CHAR(DATE_TRUNC('week', due_date), 'Mon DD') AS label,
          ROUND(SUM(amount)::numeric, 0) AS amount,
          COUNT(*) AS bill_count
        FROM bills
        WHERE company_id = $1 AND NOT is_paid
          AND due_date >= CURRENT_DATE
          AND due_date < CURRENT_DATE + 56
        GROUP BY DATE_TRUNC('week', due_date)
        ORDER BY week_start ASC
      `, [companyId]),

      // === AP aging buckets ===
      queryOne(`
        SELECT
          COALESCE(SUM(current_bucket), 0) AS current,
          COALESCE(SUM(days_1_30), 0) AS days_1_30,
          COALESCE(SUM(days_31_60), 0) AS days_31_60,
          COALESCE(SUM(days_61_90), 0) AS days_61_90,
          COALESCE(SUM(days_91_plus), 0) AS days_91_plus,
          COALESCE(SUM(total_open_balance), 0) AS total
        FROM v_latest_ap_aging
        WHERE company_id = $1
      `, [companyId]),

      // === Largest unpaid vendors ===
      query(`
        SELECT vendor_name,
               total_open_balance AS balance,
               days_91_plus
        FROM v_latest_ap_aging
        WHERE company_id = $1
        ORDER BY total_open_balance DESC
        LIMIT 10
      `, [companyId]),

      // === AP concentration: top 10 with % of total ===
      query(`
        WITH totals AS (
          SELECT COALESCE(SUM(total_open_balance), 0) AS total_ap
          FROM v_latest_ap_aging WHERE company_id = $1
        )
        SELECT a.vendor_name,
               a.total_open_balance AS balance,
               CASE WHEN t.total_ap > 0
                    THEN ROUND(a.total_open_balance / t.total_ap * 100, 1)
                    ELSE 0 END AS pct_of_total
        FROM v_latest_ap_aging a, totals t
        WHERE a.company_id = $1
        ORDER BY a.total_open_balance DESC
        LIMIT 10
      `, [companyId]),

      // === Collections vs obligations monthly ===
      query(`
        WITH monthly_collections AS (
          SELECT DATE_TRUNC('month', payment_date) AS month,
                 ROUND(SUM(amount)::numeric, 0) AS collections
          FROM payments
          WHERE company_id = $1 AND payment_date >= CURRENT_DATE - INTERVAL '12 months'
          GROUP BY DATE_TRUNC('month', payment_date)
        ),
        monthly_obligations AS (
          SELECT DATE_TRUNC('month', due_date) AS month,
                 ROUND(SUM(amount)::numeric, 0) AS obligations
          FROM bills
          WHERE company_id = $1 AND due_date >= CURRENT_DATE - INTERVAL '12 months'
          GROUP BY DATE_TRUNC('month', due_date)
        )
        SELECT TO_CHAR(COALESCE(mc.month, mo.month), 'Mon YY') AS label,
               COALESCE(mc.month, mo.month) AS month,
               COALESCE(mc.collections, 0) AS collections,
               COALESCE(mo.obligations, 0) AS obligations
        FROM monthly_collections mc
        FULL OUTER JOIN monthly_obligations mo ON mo.month = mc.month
        ORDER BY month ASC
      `, [companyId]),

      // === Monthly trends: collections, invoicing, bills ===
      query(`
        WITH mc AS (
          SELECT DATE_TRUNC('month', payment_date) AS month,
                 ROUND(SUM(amount)::numeric, 0) AS collections
          FROM payments WHERE company_id = $1 AND payment_date >= CURRENT_DATE - INTERVAL '12 months'
          GROUP BY 1
        ),
        mi AS (
          SELECT DATE_TRUNC('month', txn_date) AS month,
                 ROUND(SUM(amount)::numeric, 0) AS invoiced,
                 COUNT(*) AS invoice_count
          FROM invoices WHERE company_id = $1 AND txn_date >= CURRENT_DATE - INTERVAL '12 months'
          GROUP BY 1
        ),
        mb AS (
          SELECT DATE_TRUNC('month', txn_date) AS month,
                 ROUND(SUM(amount)::numeric, 0) AS billed
          FROM bills WHERE company_id = $1 AND txn_date >= CURRENT_DATE - INTERVAL '12 months'
          GROUP BY 1
        )
        SELECT TO_CHAR(COALESCE(mc.month, mi.month, mb.month), 'Mon YY') AS label,
               COALESCE(mc.month, mi.month, mb.month) AS month,
               COALESCE(mc.collections, 0) AS collections,
               COALESCE(mi.invoiced, 0) AS invoiced,
               COALESCE(mi.invoice_count, 0) AS invoice_count,
               COALESCE(mb.billed, 0) AS billed
        FROM mc
        FULL OUTER JOIN mi ON mi.month = mc.month
        FULL OUTER JOIN mb ON mb.month = COALESCE(mc.month, mi.month)
        ORDER BY month ASC
      `, [companyId]),

      // === Backlog by customer ===
      query(`
        SELECT customer_name,
               COUNT(*) AS order_count,
               ROUND(SUM(amount)::numeric, 0) AS backlog_value,
               MIN(txn_date)::text AS oldest_order
        FROM v_open_sales_orders
        WHERE company_id = $1
        GROUP BY customer_name
        ORDER BY backlog_value DESC
        LIMIT 15
      `, [companyId]),

      // === Invoicing trend (monthly, last 12 months) ===
      query(`
        SELECT TO_CHAR(DATE_TRUNC('month', txn_date), 'Mon YY') AS label,
               DATE_TRUNC('month', txn_date) AS month,
               ROUND(SUM(amount)::numeric, 0) AS invoiced,
               COUNT(*) AS count
        FROM invoices
        WHERE company_id = $1 AND txn_date >= CURRENT_DATE - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', txn_date)
        ORDER BY month ASC
      `, [companyId]),

      // === Risk customers ===
      query(`
        SELECT customer_name,
               total_open_balance AS balance,
               days_31_60 + days_61_90 + days_91_plus AS overdue_amount,
               days_91_plus AS severely_overdue,
               CASE
                 WHEN days_91_plus > 50000 THEN 'critical'
                 WHEN days_61_90 + days_91_plus > 20000 THEN 'high'
                 WHEN days_31_60 + days_61_90 + days_91_plus > 10000 THEN 'medium'
                 ELSE 'low'
               END AS risk_level
        FROM v_latest_ar_aging
        WHERE company_id = $1
          AND (days_31_60 + days_61_90 + days_91_plus) > 5000
        ORDER BY overdue_amount DESC
        LIMIT 10
      `, [companyId]),

      // === Risk vendors ===
      query(`
        SELECT vendor_name,
               total_open_balance AS balance,
               days_31_60 + days_61_90 + days_91_plus AS overdue_amount,
               CASE
                 WHEN days_91_plus > 50000 THEN 'critical'
                 WHEN days_61_90 + days_91_plus > 20000 THEN 'high'
                 WHEN days_31_60 + days_61_90 + days_91_plus > 10000 THEN 'medium'
                 ELSE 'low'
               END AS risk_level
        FROM v_latest_ap_aging
        WHERE company_id = $1
          AND (days_31_60 + days_61_90 + days_91_plus) > 5000
        ORDER BY overdue_amount DESC
        LIMIT 10
      `, [companyId]),

      // === Sync warnings ===
      query(`
        SELECT job_name, status, last_success_at,
               ROUND(EXTRACT(EPOCH FROM (NOW() - last_success_at)) / 3600) AS hours_ago,
               CASE
                 WHEN last_success_at IS NULL THEN 'never_synced'
                 WHEN NOW() - last_success_at > INTERVAL '24 hours' THEN 'stale'
                 ELSE 'ok'
               END AS health
        FROM sync_status
        WHERE company_id = $1
          AND (last_success_at IS NULL OR NOW() - last_success_at > INTERVAL '12 hours' OR status != 'success')
        ORDER BY job_name
      `, [companyId]),

      // === Alert flags ===
      queryOne(`
        SELECT
          (SELECT COALESCE(SUM(amount), 0) FROM payments
           WHERE company_id = $1 AND payment_date >= CURRENT_DATE - 7) AS collections_7d,
          (SELECT COALESCE(SUM(amount), 0) FROM bills
           WHERE company_id = $1 AND NOT is_paid AND due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7) AS bills_7d,
          (SELECT COALESCE(SUM(days_91_plus), 0) FROM v_latest_ar_aging
           WHERE company_id = $1) AS ar_over_90,
          (SELECT COUNT(*) FROM v_latest_ar_aging
           WHERE company_id = $1 AND total_open_balance > 0) AS ar_customer_count
      `, [companyId]),
    ]);

    const openAr = Number(kpis?.open_ar || 0);
    const openAp = Number(kpis?.open_ap || 0);
    const cashIn30 = Number(kpis?.cash_in_30d || 0);
    const billsDue30 = Number(kpis?.bills_due_30d || 0);
    const cashIn7 = Number(kpis?.cash_in_7d || 0);
    const billsDue7 = Number(kpis?.bills_due_7d || 0);

    // Compute concentration percentages for top 10
    const top10ArPct = (collectionConcentration as any[]).reduce(
      (s: number, r: any) => s + Number(r.pct_of_total || 0), 0
    );
    const top10ApPct = (apConcentration as any[]).reduce(
      (s: number, r: any) => s + Number(r.pct_of_total || 0), 0
    );

    return NextResponse.json({
      kpis: {
        ...kpis,
        net_working_capital: openAr - openAp,
        net_cash_pressure_30d: cashIn30 - billsDue30,
        coverage_ratio: billsDue30 > 0 ? Math.round((cashIn30 / billsDue30) * 100) / 100 : null,
      },
      collections: {
        daily: dailyCollections,
        topCustomers: topPayingCustomers,
        largestOverdue,
        arBuckets,
        concentration: collectionConcentration,
        top10ArPct: Math.round(top10ArPct * 10) / 10,
      },
      payables: {
        timeline: billsDueTimeline,
        apBuckets,
        largestVendors: largestUnpaidVendors,
        concentration: apConcentration,
        top10ApPct: Math.round(top10ApPct * 10) / 10,
      },
      liquidity: {
        collectionsVsObligations,
        monthlyTrends,
      },
      backlog: {
        byCustomer: backlogByCustomer,
        invoicingTrend,
      },
      alerts: {
        riskCustomers,
        riskVendors,
        syncWarnings,
        flags: {
          billsExceedCollections7d: billsDue7 > cashIn7,
          billsExceedCollections30d: billsDue30 > cashIn30,
          arOver90Rising: Number(alertFlags?.ar_over_90 || 0) > 100000,
          highConcentration: top10ArPct > 80,
        },
      },
    });
  } catch (error) {
    console.error("Cash Operations API error:", error);
    return NextResponse.json({ error: "Failed to load cash operations data" }, { status: 500 });
  }
}
