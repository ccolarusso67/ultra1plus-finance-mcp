"""Sync Health tool."""

from mcp.server.fastmcp import FastMCP
from database import fetch_all
from audit import audited


def register(mcp: FastMCP):
    @mcp.tool()
    @audited("get_sync_health")
    async def get_sync_health() -> list[dict]:
        """Check the health and freshness of all data sync jobs.

        Returns:
            Status of each sync job including last run time, last success time,
            records synced, current status, and any error messages.
            Use this to verify data freshness before answering finance questions.
        """
        return await fetch_all("""
            SELECT job_name, last_run_at, last_success_at, records_synced,
                   status, error_message, run_duration_ms, updated_at,
                   EXTRACT(EPOCH FROM (NOW() - last_success_at)) / 60 AS minutes_since_success
            FROM sync_status
            ORDER BY job_name
        """)
