"use client";

import {
  BarChart, DonutChart,
  Card, Metric, Text, Grid, Title, Subtitle,
} from "@tremor/react";
import DataTable from "@/components/DataTable";
import StatusBadge from "@/components/StatusBadge";
import { formatCurrency, formatNumber } from "@/lib/format";
import { useCompanyFetch } from "@/lib/useCompanyFetch";

/* eslint-disable @typescript-eslint/no-explicit-any */
type R = Record<string, any>;

export default function InventoryPage() {
  const data = useCompanyFetch<Record<string, unknown>>("/api/inventory");

  if (!data) {
    return <div className="flex items-center justify-center h-96"><div className="text-muted-foreground">Loading...</div></div>;
  }

  const { items, byCategory, totals } = data as {
    items: R[];
    byCategory: R[];
    totals: R;
  };

  const belowReorder = items.filter((i) => i.below_reorder);

  return (
    <div className="space-y-6">
      <div>
        <Title>Inventory</Title>
        <Text>Stock levels, values, and reorder alerts</Text>
      </div>

      <Grid numItemsSm={2} numItemsLg={4} className="gap-4">
        <Card decoration="top" decorationColor="blue">
          <Text>Total Value</Text>
          <Metric>{formatCurrency(Number(totals?.total_value || 0))}</Metric>
        </Card>
        <Card decoration="top" decorationColor={Number(totals?.below_reorder_count || 0) > 0 ? "rose" : "emerald"}>
          <Text>Below Reorder</Text>
          <Metric>{String(totals?.below_reorder_count || 0)}</Metric>
        </Card>
        <Card decoration="top" decorationColor="cyan">
          <Text>On Sales Order</Text>
          <Metric>{formatNumber(Number(totals?.total_on_order || 0))}</Metric>
        </Card>
        <Card decoration="top" decorationColor="amber">
          <Text>Categories</Text>
          <Metric>{String(totals?.category_count || 0)}</Metric>
        </Card>
      </Grid>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category Donut */}
        <Card>
          <Title>Inventory Value by Category</Title>
          <DonutChart
            className="mt-6 h-72"
            data={byCategory.map((r: R) => ({
              name: String(r.category),
              value: Number(r.value || 0),
            }))}
            category="value"
            index="name"
            valueFormatter={(v: number) => formatCurrency(v)}
            colors={["blue", "cyan", "emerald", "slate", "rose", "amber", "indigo", "violet"]}
            showAnimation
          />
        </Card>

        {/* Below Reorder Bar */}
        <Card className="lg:col-span-2">
          <Title>Below Reorder Point</Title>
          <Subtitle>Items needing replenishment</Subtitle>
          {belowReorder.length > 0 ? (
            <BarChart
              className="mt-4"
              style={{ height: Math.max(200, belowReorder.length * 35) }}
              data={belowReorder.map((i: R) => ({
                item: String(i.name),
                Available: Number(i.quantity_available || 0),
                Shortfall: Math.max(0, Number(i.reorder_point || 0) - Number(i.quantity_available || 0)),
              }))}
              index="item"
              categories={["Available", "Shortfall"]}
              colors={["cyan", "rose"]}
              layout="vertical"
              showAnimation
            />
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">All items above reorder point</div>
          )}
        </Card>
      </div>

      {/* Full Inventory Table */}
      <Card>
        <Title>Inventory Detail</Title>
        <div className="mt-4">
          <DataTable
            columns={[
              { key: "sku", label: "SKU" },
              { key: "name", label: "Product" },
              { key: "category", label: "Category" },
              { key: "quantity_on_hand", label: "On Hand", align: "right" as const, render: (r: R) => formatNumber(Number(r.quantity_on_hand)) },
              { key: "quantity_on_sales_order", label: "On Order", align: "right" as const, render: (r: R) => formatNumber(Number(r.quantity_on_sales_order)) },
              { key: "quantity_available", label: "Available", align: "right" as const, render: (r: R) => {
                const avail = Number(r.quantity_available);
                const reorder = Number(r.reorder_point);
                return (
                  <span className={avail <= reorder && reorder > 0 ? "text-brand-danger font-semibold" : ""}>
                    {formatNumber(avail)}
                  </span>
                );
              }},
              { key: "reorder_point", label: "Reorder Pt", align: "right" as const },
              { key: "asset_value", label: "Value", align: "right" as const, render: (r: R) => formatCurrency(Number(r.asset_value)) },
              { key: "below_reorder", label: "Status", render: (r: R) => (
                r.below_reorder
                  ? <StatusBadge status="danger" label="Below Reorder" />
                  : <StatusBadge status="current" label="OK" />
              )},
            ]}
            data={items}
          />
        </div>
      </Card>
    </div>
  );
}
