"""AP Aging Summary tool."""

from mcp.server.fastmcp import FastMCP
from database import fetch_all
from audit import audited


def register(mcp: FastMCP):
    @mcp.tool()
    @audited("get_ap_aging_summary")
    async def get_ap_aging_summary(
        as_of_date: str | None = None,
        min_bucket: str | None = None,
        vendor_name: str | None = None,
    ) -> list[dict]:
        """Get accounts payable aging summary showing how much is owed to each vendor
        and how overdue the balances are.

        Args:
            as_of_date: Optional date filter (YYYY-MM-DD). Uses latest snapshot if omitted.
            min_bucket: Minimum aging bucket to filter by. Options: "1-30", "31-60", "61-90", "91+".
            vendor_name: Optional vendor name filter (partial match, case-insensitive).

        Returns:
            List of vendor aging records with current, 1-30, 31-60, 61-90, 91+ day buckets
            and total open balance.
        """
        conditions = ["1=1"]
        params = []
        param_idx = 0

        base_query = """
            SELECT vendor_name, current_bucket, days_1_30, days_31_60,
                   days_61_90, days_91_plus, total_open_balance, snapshot_at
            FROM v_latest_ap_aging
        """

        if vendor_name:
            param_idx += 1
            conditions.append(f"vendor_name ILIKE ${param_idx}")
            params.append(f"%{vendor_name}%")

        if min_bucket:
            bucket_map = {
                "1-30": "days_1_30 + days_31_60 + days_61_90 + days_91_plus > 0",
                "31-60": "days_31_60 + days_61_90 + days_91_plus > 0",
                "61-90": "days_61_90 + days_91_plus > 0",
                "91+": "days_91_plus > 0",
            }
            if min_bucket in bucket_map:
                conditions.append(bucket_map[min_bucket])

        query = f"{base_query} WHERE {' AND '.join(conditions)} ORDER BY total_open_balance DESC"
        return await fetch_all(query, *params)
