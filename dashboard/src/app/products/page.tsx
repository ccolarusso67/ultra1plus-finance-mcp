"use client";

import {
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Card, Metric, Text, Grid, Title, Subtitle,
} from "@tremor/react";
import DataTable from "@/components/DataTable";
import StatusBadge from "@/components/StatusBadge";
import { formatCurrency } from "@/lib/format";
import { useCompanyFetch } from "@/lib/useCompanyFetch";

/* eslint-disable @typescript-eslint/no-explicit-any */
type R = Record<string, any>;

const DONUT_COLORS = ["#003A5C", "#0098DB", "#137333", "#64748B", "#C5221F", "#E37400", "#8E24AA", "#7F1D1D"];

export default function ProductsPage() {
  const data = useCompanyFetch<Record<string, unknown>>("/api/products");

  const d2 = data as Record<string, unknown> || {};
  const rankings = (d2?.rankings as R[]) || [];
  const categoryRevenue = (d2?.categoryRevenue as R[]) || [];
  const erosionAlerts = (d2?.erosionAlerts as R[]) || [];
  const activeSkus = Number(d2?.activeSkus || 0);

  const highestMargin = rankings.length > 0
    ? [...rankings].sort((a, b) => Number(b.margin_pct) - Number(a.margin_pct))[0]
    : null;
  const lowestMargin = rankings.length > 0
    ? [...rankings].sort((a, b) => Number(a.margin_pct) - Number(b.margin_pct))[0]
    : null;

  const topProductData = rankings.slice(0, 12).map((r: R) => ({
    product: String(r.product_name),
    Revenue: Number(r.revenue || 0),
    Margin: Number(r.gross_margin || 0),
  }));

  const donutData = categoryRevenue.map((r: R) => ({
    name: String(r.category),
    value: Number(r.revenue || 0),
  }));

  return (
    <div className="space-y-6">
      <div>
        <Title>Products</Title>
        <Text>Product performance, margins, and alerts</Text>
      </div>

      <Grid numItemsSm={2} numItemsLg={4} className="gap-4">
        <Card decoration="top" decorationColor="blue">
          <Text>Active SKUs</Text>
          <Metric>{String(activeSkus)}</Metric>
        </Card>
        <Card decoration="top" decorationColor="emerald">
          <Text>Highest Margin</Text>
          <Metric>{highestMargin?.margin_pct || 0}%</Metric>
          <Text className="mt-1">{String(highestMargin?.product_name || "")}</Text>
        </Card>
        <Card decoration="top" decorationColor="rose">
          <Text>Lowest Margin</Text>
          <Metric>{lowestMargin?.margin_pct || 0}%</Metric>
          <Text className="mt-1">{String(lowestMargin?.product_name || "")}</Text>
        </Card>
        <Card decoration="top" decorationColor={erosionAlerts.length > 0 ? "rose" : "emerald"}>
          <Text>Margin Alerts</Text>
          <Metric>{String(erosionAlerts.length)}</Metric>
        </Card>
      </Grid>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Products */}
        <Card className="lg:col-span-2">
          <Title>Top Products by Revenue</Title>
          <Subtitle>Last 6 months</Subtitle>
          <ResponsiveContainer width="100%" height={384} className="mt-4">
            <BarChart data={topProductData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
              <YAxis type="category" dataKey="product" tick={{ fontSize: 11 }} width={140} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend />
              <Bar dataKey="Revenue" fill="#003A5C" radius={[0, 3, 3, 0]} />
              <Bar dataKey="Margin" fill="#137333" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Category Donut */}
        <Card>
          <Title>Revenue by Category</Title>
          <ResponsiveContainer width="100%" height={288} className="mt-6">
            <PieChart>
              <Pie
                data={donutData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
              >
                {donutData.map((_, i) => (
                  <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Full Rankings Table */}
      <Card>
        <Title>Product Rankings</Title>
        <div className="mt-4">
          <DataTable
            columns={[
              { key: "product_name", label: "Product" },
              { key: "sku", label: "SKU" },
              { key: "category", label: "Category" },
              { key: "units_sold", label: "Units", align: "right" as const },
              { key: "revenue", label: "Revenue", align: "right" as const, render: (r: R) => formatCurrency(Number(r.revenue)) },
              { key: "gross_margin", label: "Margin $", align: "right" as const, render: (r: R) => formatCurrency(Number(r.gross_margin)) },
              { key: "margin_pct", label: "Margin %", align: "right" as const, render: (r: R) => (
                <span className={Number(r.margin_pct) < 25 ? "text-brand-danger font-semibold" : "font-semibold"}>
                  {String(r.margin_pct)}%
                </span>
              )},
              { key: "customer_count", label: "Customers", align: "right" as const },
            ]}
            data={rankings}
          />
        </div>
      </Card>

      {/* Margin Erosion Alerts */}
      {erosionAlerts.length > 0 && (
        <Card>
          <Title>Margin Erosion Alerts</Title>
          <Subtitle>Products where margin dropped 3%+ vs prior period</Subtitle>
          <div className="mt-4">
            <DataTable
              columns={[
                { key: "product_name", label: "Product" },
                { key: "sku", label: "SKU" },
                { key: "current_margin", label: "Current %", align: "right" as const },
                { key: "prior_margin", label: "Prior %", align: "right" as const },
                { key: "margin_change", label: "Change", align: "right" as const, render: (r: R) => (
                  <StatusBadge status="danger" label={`${String(r.margin_change)}%`} />
                )},
                { key: "current_cost", label: "Curr Cost", align: "right" as const, render: (r: R) => `$${String(r.current_cost)}` },
                { key: "prior_cost", label: "Prior Cost", align: "right" as const, render: (r: R) => `$${String(r.prior_cost)}` },
              ]}
              data={erosionAlerts}
            />
          </div>
        </Card>
      )}
    </div>
  );
}
