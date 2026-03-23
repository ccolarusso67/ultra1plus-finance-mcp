"use client";

import {
  PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Warehouse, AlertTriangle, Package, Layers } from "lucide-react";
import KpiCard from "@/components/KpiCard";
import ChartCard from "@/components/ChartCard";
import DataTable from "@/components/DataTable";
import StatusBadge from "@/components/StatusBadge";
import { formatCurrency, formatNumber } from "@/lib/format";
import { useCompanyFetch } from "@/lib/useCompanyFetch";

const COLORS = ["#003A5C", "#0098DB", "#137333", "#5F6368", "#C5221F", "#E37400", "#1A73E8", "#8E24AA"];

export default function InventoryPage() {
  const data = useCompanyFetch<Record<string, unknown>>("/api/inventory");

  if (!data) {
    return <div className="flex items-center justify-center h-96"><div className="text-muted-foreground">Loading...</div></div>;
  }

  const { items, byCategory, totals } = data as {
    items: Record<string, unknown>[];
    byCategory: Record<string, unknown>[];
    totals: Record<string, unknown>;
  };

  const belowReorder = items.filter((i) => i.below_reorder);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Inventory</h1>
        <p className="text-[12px] text-muted-foreground mt-0.5">Stock levels, values, and reorder alerts</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Value" value={formatCurrency(Number(totals?.total_value || 0))} icon={Warehouse} />
        <KpiCard
          label="Below Reorder"
          value={String(totals?.below_reorder_count || 0)}
          changeType={Number(totals?.below_reorder_count || 0) > 0 ? "negative" : "positive"}
          icon={AlertTriangle}
        />
        <KpiCard label="On Sales Order" value={formatNumber(Number(totals?.total_on_order || 0))} icon={Package} />
        <KpiCard label="Categories" value={String(totals?.category_count || 0)} icon={Layers} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category Donut */}
        <ChartCard title="Inventory Value by Category">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={byCategory}
                dataKey="value"
                nameKey="category"
                cx="50%" cy="50%"
                innerRadius={60} outerRadius={100}
                paddingAngle={2}
                label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {byCategory.map((_: unknown, i: number) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Below Reorder Bar */}
        <ChartCard title="Below Reorder Point" subtitle="Items needing replenishment" className="lg:col-span-2">
          {belowReorder.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(200, belowReorder.length * 35)}>
              <BarChart
                data={belowReorder.map((i) => ({
                  name: i.name,
                  available: Number(i.quantity_available),
                  reorder_point: Number(i.reorder_point),
                  shortfall: Math.max(0, Number(i.reorder_point) - Number(i.quantity_available)),
                }))}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={220} />
                <Tooltip />
                <Bar dataKey="available" name="Available" fill="#0098DB" />
                <Bar dataKey="shortfall" name="Shortfall" fill="#C5221F" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">All items above reorder point</div>
          )}
        </ChartCard>
      </div>

      {/* Full Inventory Table */}
      <ChartCard title="Inventory Detail">
        <DataTable
          columns={[
            { key: "sku", label: "SKU" },
            { key: "name", label: "Product" },
            { key: "category", label: "Category" },
            { key: "quantity_on_hand", label: "On Hand", align: "right", render: (r) => formatNumber(Number(r.quantity_on_hand)) },
            { key: "quantity_on_sales_order", label: "On Order", align: "right", render: (r) => formatNumber(Number(r.quantity_on_sales_order)) },
            { key: "quantity_available", label: "Available", align: "right", render: (r) => {
              const avail = Number(r.quantity_available);
              const reorder = Number(r.reorder_point);
              return (
                <span className={avail <= reorder && reorder > 0 ? "text-brand-danger font-semibold" : ""}>
                  {formatNumber(avail)}
                </span>
              );
            }},
            { key: "reorder_point", label: "Reorder Pt", align: "right" },
            { key: "asset_value", label: "Value", align: "right", render: (r) => formatCurrency(Number(r.asset_value)) },
            { key: "below_reorder", label: "Status", render: (r) => (
              r.below_reorder
                ? <StatusBadge status="danger" label="Below Reorder" />
                : <StatusBadge status="current" label="OK" />
            )},
          ]}
          data={items}
        />
      </ChartCard>
    </div>
  );
}
