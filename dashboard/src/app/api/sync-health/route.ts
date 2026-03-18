import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const jobs = await query(`
      SELECT job_name, last_run_at, last_success_at, records_synced,
             status, error_message,
             ROUND(EXTRACT(EPOCH FROM (NOW() - last_success_at)) / 60) AS minutes_ago
      FROM sync_status
      ORDER BY job_name
    `);

    return NextResponse.json({ jobs });
  } catch (error) {
    console.error("Sync Health API error:", error);
    return NextResponse.json({ error: "Failed to load sync status" }, { status: 500 });
  }
}
