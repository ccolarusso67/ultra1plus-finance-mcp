import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("company_id") || "u1p_ultrachem";

  try {
    const [aging, openInvoices, creditHolds, totals] = await Promise.all([
      query(`
        SELECT customer_name, current_bucket, days_1_30, days_31_60,
               days_61_90, days_91_plus, total_open_balance
        FROM v_latest_ar_aging
        WHERE company_id = $1
        ORDER BY total_open_balance DESC
      `, [companyId]),
      query(`
        SELECT ref_number, customer_name, txn_date, due_date,
               amount, balance_remaining, days_past_due
        FROM v_open_invoices
        WHERE company_id = $1
        ORDER BY due_date ASC
      `, [companyId]),
      query(`
        SELECT full_name AS customer_name, credit_limit, balance,
               available_credit, is_over_limit
        FROM v_credit_status
        WHERE company_id = $1 AND is_over_limit = TRUE
        ORDER BY balance DESC
      `, [companyId]),
      queryOne(`
        SELECT
          COALESCE(SUM(total_open_balance), 0) AS total_ar,
          COALESCE(SUM(days_31_60 + days_61_90 + days_91_plus), 0) AS overdue_ar,
          (SELECT COUNT(*) FROM v_credit_status WHERE company_id = $1 AND is_over_limit) AS over_credit_count
        FROM v_latest_ar_aging
        WHERE company_id = $1
      `, [companyId]),
    ]);

    return NextResponse.json({ aging, openInvoices, creditHolds, totals });
  } catch (error) {
    console.error("AR Aging API error:", error);
    return NextResponse.json({ error: "Failed to load AR data" }, { status: 500 });
  }
}
