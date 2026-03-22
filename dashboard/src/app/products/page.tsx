"use client";

import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Package, TrendingDown, AlertTriangle, Percent } from "lucide-react";
import KpiCard from "@/components/KpiCard";
import ChartCard from "@/components/ChartCard";
import DataTable from "@/components/DataTable";
import StatusBadge from "@/components/StatusBadge";
import { formatCurrency } from "@/lib/format";
import { useCompanyFetch } from "@/lib/useCompanyFetch";

const COLORS = ["#003A5C", "#0098DB", "#137333", "#5F6368", "#C5221F", "#E37400", "#1A73E8", "#8E24AA"];

export default function ProductsPage() {
  const data = useCompanyFetch<Record<string, unknown>>("/api/products");

  const d2 = data as Record<string, unknown> || {};
  const rankings = (d2?.rankings as Record<string, unknown>[]) || [];
  const categoryRevenue = (d2?.categoryRevenue as Record<string, unknown>[]) || [];
  const erosionAlerts = (d2?.erosionAlerts as Record<string, unknown>[]) || [];
  const activeSkus = Number(d2?.activeSkus || 0);

  const highestMargin = rankings.length > 0
    ? [...rankings].sort((a, b) => Number(b.margin_pct) - Number(a.margin_pct))[0]
    : null;
  const lowestMargin = rankings.length > 0
    ? [...rankings].sort((a, b) => Number(a.margin_pct) - Number(b.margin_pct))[0]
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#1A1A1A]">Products</h1>
        <p className="text-[12px] text-[#5F6368] mt-0.5">Product performance, margins, and alerts</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Active SKUs" value={String(activeSkus)} icon={Package} />
        <KpiCard
          label="Highest Margin"
          value={`${highestMargin?.margin_pct || 0}%`}
          subtitle={String(highestMargin?.product_name || "")}
          icon={Percent}
        />
        <KpiCard
          label="Lowest Margin"
          value={`${lowestMargin?.margin_pct || 0}%`}
          subtitle={String(lowestMargin?.product_name || "")}
          changeType="negative"
          icon={TrendingDown}
        />
        <KpiCard
          label="Margin Alerts"
          value={String(erosionAlerts.length)}
          changeType={erosionAlerts.length > 0 ? "negative" : "positive"}
          icon={AlertTriangle}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Products */}
        <ChartCard title="Top Products by Revenue" subtitle="Last 6 months" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={Math.max(300, rankings.slice(0, 12).length * 32)}>
            <BarChart data={rankings.slice(0, 12)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
              <YAxis type="category" dataKey="product_name" tick={{ fontSize: 11 }} width={220} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend />
              <Bar dataKey="revenue" name="Revenue" fill="#003A5C" radius={[0, 1, 1, 0]} />
              <Bar dataKey="gross_margin" name="Margin" fill="#137333" radius={[0, 1, 1, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Category Donut */}
        <ChartCard title="Revenue by Category">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={categoryRevenue}
                dataKey="revenue"
                nameKey="category"
                cx="50%" cy="50%"
                innerRadius={60} outerRadius={100}
                paddingAngle={2}
                label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {categoryRevenue.map((_: unknown, i: number) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Full Rankings Table */}
      <ChartCard title="Product Rankings">
        <DataTable
          columns={[
            { key: "product_name", label: "Product" },
            { key: "sku", label: "SKU" },
            { key: "category", label: "Category" },
            { key: "units_sold", label: "Units", align: "right" },
            { key: "revenue", label: "Revenue", align: "right", render: (r) => formatCurrency(Number(r.revenue)) },
            { key: "gross_margin", label: "Margin $", align: "right", render: (r) => formatCurrency(Number(r.gross_margin)) },
            { key: "margin_pct", label: "Margin %", align: "right", render: (r) => (
              <span className={Number(r.margin_pct) < 25 ? "text-[#C5221F] font-semibold" : "font-semibold"}>
                {String(r.margin_pct)}%
              </span>
            )},
            { key: "customer_count", label: "Customers", align: "right" },
          ]}
          data={rankings}
        />
      </ChartCard>

      {/* Margin Erosion Alerts */}
      {erosionAlerts.length > 0 && (
        <ChartCard title="Margin Erosion Alerts" subtitle="Products where margin dropped 3%+ vs prior period">
          <DataTable
            columns={[
              { key: "product_name", label: "Product" },
              { key: "sku", label: "SKU" },
              { key: "current_margin", label: "Current %", align: "right" },
              { key: "prior_margin", label: "Prior %", align: "right" },
              { key: "margin_change", label: "Change", align: "right", render: (r) => (
                <StatusBadge status="danger" label={`${String(r.margin_change)}%`} />
              )},
              { key: "current_cost", label: "Curr Cost", align: "right", render: (r) => `$${String(r.current_cost)}` },
              { key: "prior_cost", label: "Prior Cost", align: "right", render: (r) => `$${String(r.prior_cost)}` },
            ]}
            data={erosionAlerts}
          />
        </ChartCard>
      )}
    </div>
  );
}
