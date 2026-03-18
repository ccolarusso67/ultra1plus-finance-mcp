"""Inventory Summary tool."""

from mcp.server.fastmcp import FastMCP
from database import fetch_all
from audit import audited


def register(mcp: FastMCP):
    @mcp.tool()
    @audited("get_inventory_summary")
    async def get_inventory_summary(
        item_name: str | None = None,
        category: str | None = None,
        below_reorder_only: bool = False,
    ) -> list[dict]:
        """Get current inventory levels for all products.

        Args:
            item_name: Filter by item name or SKU (partial match, case-insensitive).
            category: Filter by product category (partial match).
            below_reorder_only: If true, only show items at or below their reorder point.

        Returns:
            List of inventory items with SKU, name, quantities (on hand, on order,
            available), reorder point, costs, and asset value. Includes snapshot_at
            for data freshness.
        """
        conditions = ["1=1"]
        params = []
        param_idx = 0

        base_query = """
            SELECT sku, name, category, quantity_on_hand, quantity_on_sales_order,
                   quantity_available, reorder_point, avg_cost, last_cost,
                   asset_value, snapshot_at
            FROM v_latest_inventory
        """

        if item_name:
            param_idx += 1
            conditions.append(f"(name ILIKE ${param_idx} OR sku ILIKE ${param_idx})")
            params.append(f"%{item_name}%")

        if category:
            param_idx += 1
            conditions.append(f"category ILIKE ${param_idx}")
            params.append(f"%{category}%")

        if below_reorder_only:
            conditions.append("quantity_available <= reorder_point AND reorder_point > 0")

        query = f"{base_query} WHERE {' AND '.join(conditions)} ORDER BY name ASC"
        return await fetch_all(query, *params)
