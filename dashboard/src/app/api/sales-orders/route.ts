import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("company_id") || "u1p_ultrachem";

  try {
    const [orders, byCustomer, totals] = await Promise.all([
      query(`
        SELECT txn_id, ref_number, customer_name, txn_date, ship_date,
               amount, is_overdue
        FROM v_open_sales_orders
        WHERE company_id = $1
        ORDER BY ship_date ASC
      `, [companyId]),
      query(`
        SELECT customer_name, COUNT(*) AS order_count,
               SUM(amount) AS total_value
        FROM v_open_sales_orders
        WHERE company_id = $1
        GROUP BY customer_name
        ORDER BY total_value DESC
      `, [companyId]),
      queryOne(`
        SELECT
          COUNT(*) AS open_count,
          COALESCE(SUM(amount), 0) AS open_value,
          COUNT(*) FILTER (WHERE is_overdue) AS overdue_count
        FROM v_open_sales_orders
        WHERE company_id = $1
      `, [companyId]),
    ]);

    return NextResponse.json({ orders, byCustomer, totals });
  } catch (error) {
    console.error("Sales Orders API error:", error);
    return NextResponse.json({ error: "Failed to load sales order data" }, { status: 500 });
  }
}
