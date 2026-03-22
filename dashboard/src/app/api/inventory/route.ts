import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("company_id") || "u1p_ultrachem";

  try {
    const [items, byCategory, totals] = await Promise.all([
      query(`
        SELECT sku, name, category, quantity_on_hand, quantity_on_sales_order,
               quantity_available, reorder_point, avg_cost, asset_value,
               CASE WHEN reorder_point > 0 AND quantity_available <= reorder_point
                    THEN TRUE ELSE FALSE END AS below_reorder
        FROM v_latest_inventory
        WHERE company_id = $1
        ORDER BY name ASC
      `, [companyId]),
      query(`
        SELECT COALESCE(category, 'Other') AS category,
               SUM(asset_value) AS value,
               COUNT(*) AS item_count
        FROM v_latest_inventory
        WHERE company_id = $1
        GROUP BY COALESCE(category, 'Other')
        ORDER BY value DESC
      `, [companyId]),
      queryOne(`
        SELECT
          COALESCE(SUM(asset_value), 0) AS total_value,
          COUNT(*) FILTER (WHERE reorder_point > 0 AND quantity_available <= reorder_point) AS below_reorder_count,
          COALESCE(SUM(quantity_on_sales_order), 0) AS total_on_order,
          COUNT(DISTINCT category) AS category_count
        FROM v_latest_inventory
        WHERE company_id = $1
      `, [companyId]),
    ]);

    return NextResponse.json({ items, byCategory, totals });
  } catch (error) {
    console.error("Inventory API error:", error);
    return NextResponse.json({ error: "Failed to load inventory data" }, { status: 500 });
  }
}
