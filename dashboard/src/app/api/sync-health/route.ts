import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("company_id") || "u1p_ultrachem";

  try {
    const jobs = await query(`
      SELECT job_name, last_run_at, last_success_at, records_synced,
             status, error_message,
             ROUND(EXTRACT(EPOCH FROM (NOW() - last_success_at)) / 60) AS minutes_ago
      FROM sync_status
      WHERE company_id = $1
      ORDER BY job_name
    `, [companyId]);

    return NextResponse.json({ jobs });
  } catch (error) {
    console.error("Sync Health API error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to load sync status", detail: message }, { status: 500 });
  }
}
