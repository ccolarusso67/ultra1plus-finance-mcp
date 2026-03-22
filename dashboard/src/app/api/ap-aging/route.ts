import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("company_id") || "u1p_ultrachem";

  try {
    const [aging, openBills, totals] = await Promise.all([
      query(`
        SELECT vendor_name, current_bucket, days_1_30, days_31_60,
               days_61_90, days_91_plus, total_open_balance
        FROM v_latest_ap_aging
        WHERE company_id = $1
        ORDER BY total_open_balance DESC
      `, [companyId]),
      query(`
        SELECT vendor_name, ref_number, txn_date, due_date,
               amount, balance_remaining,
               CASE WHEN due_date < CURRENT_DATE THEN TRUE ELSE FALSE END AS is_overdue,
               GREATEST(CURRENT_DATE - due_date, 0) AS days_past_due
        FROM bills
        WHERE company_id = $1 AND NOT is_paid
        ORDER BY due_date ASC
      `, [companyId]),
      queryOne(`
        SELECT
          COALESCE(SUM(total_open_balance), 0) AS total_ap,
          COALESCE(SUM(days_31_60 + days_61_90 + days_91_plus), 0) AS overdue_ap,
          (SELECT COUNT(*) FROM bills WHERE company_id = $1 AND NOT is_paid AND due_date <= CURRENT_DATE + 7) AS due_this_week,
          (SELECT COUNT(*) FROM bills WHERE company_id = $1 AND NOT is_paid AND due_date > CURRENT_DATE + 7 AND due_date <= CURRENT_DATE + 14) AS due_next_week
        FROM v_latest_ap_aging
        WHERE company_id = $1
      `, [companyId]),
    ]);

    return NextResponse.json({ aging, openBills, totals });
  } catch (error) {
    console.error("AP Aging API error:", error);
    return NextResponse.json({ error: "Failed to load AP data" }, { status: 500 });
  }
}
