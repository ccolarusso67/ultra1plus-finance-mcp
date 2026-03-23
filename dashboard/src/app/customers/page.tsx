"use client";

import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ZAxis,
} from "recharts";
import {
  BarChart, Card, Metric, Text, Grid, Title, Subtitle,
} from "@tremor/react";
import DataTable from "@/components/DataTable";
import StatusBadge from "@/components/StatusBadge";
import { formatCurrency } from "@/lib/format";
import { useCompanyFetch } from "@/lib/useCompanyFetch";

/* eslint-disable @typescript-eslint/no-explicit-any */
type R = Record<string, any>;

const currencyFormatter = (v: number) => `$${(v / 1000).toFixed(0)}K`;

export default function CustomersPage() {
  const data = useCompanyFetch<Record<string, unknown>>("/api/customers");

  const d = data as Record<string, unknown> || {};
  const rankings = (d.rankings as R[]) || [];
  const declining = (d.declining as R[]) || [];
  const reorderAlerts = (d.reorderAlerts as R[]) || [];
  const activeCount = Number(d.activeCount || 0);

  const topRevenue = rankings.length > 0 ? formatCurrency(Number(rankings[0].revenue)) : "$0";
  const avgMargin = rankings.length > 0
    ? (rankings.reduce((s, r) => s + Number(r.margin_pct || 0), 0) / rankings.length).toFixed(1)
    : "0";

  return (
    <div className="space-y-6">
      <div>
        <Title>Customers</Title>
        <Text>Customer performance, margins, and intelligence</Text>
      </div>

      <Grid numItemsSm={2} numItemsLg={4} className="gap-4">
        <Card decoration="top" decorationColor="blue">
          <Text>Active Customers</Text>
          <Metric>{String(activeCount)}</Metric>
        </Card>
        <Card decoration="top" decorationColor="emerald">
          <Text>Top Customer Revenue</Text>
          <Metric>{topRevenue}</Metric>
          <Text className="mt-1">Current quarter</Text>
        </Card>
        <Card decoration="top" decorationColor="cyan">
          <Text>Avg Margin</Text>
          <Metric>{avgMargin}%</Metric>
        </Card>
        <Card decoration="top" decorationColor={declining.length > 0 ? "rose" : "emerald"}>
          <Text>Declining Accounts</Text>
          <Metric>{String(declining.length)}</Metric>
        </Card>
      </Grid>

      {/* Top Customers Bar Chart */}
      <Card>
        <Title>Top Customers by Revenue</Title>
        <Subtitle>Current quarter</Subtitle>
        <BarChart
          className="mt-4 h-96"
          data={rankings.slice(0, 15).map((r: R) => ({
            customer: String(r.customer_name),
            Revenue: Number(r.revenue || 0),
            "Gross Margin": Number(r.gross_margin || 0),
          }))}
          index="customer"
          categories={["Revenue", "Gross Margin"]}
          colors={["blue", "emerald"]}
          valueFormatter={(v: number) => currencyFormatter(v)}
          layout="vertical"
          showAnimation
        />
      </Card>

      {/* Customer Margin Scatter — KEEP Recharts (ScatterChart not in Tremor) */}
      <Card>
        <Title>Revenue vs Margin</Title>
        <Subtitle>Each dot is a customer — bottom-left = low revenue, low margin</Subtitle>
        <ResponsiveContainer width="100%" height={300} className="mt-4">
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
            <XAxis type="number" dataKey="revenue" name="Revenue" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
            <YAxis type="number" dataKey="margin_pct" name="Margin %" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
            <ZAxis type="number" dataKey="order_count" range={[50, 400]} />
            <Tooltip formatter={(v: number, name: string) => name === "Revenue" ? formatCurrency(v) : `${v}%`} />
            <Scatter data={rankings} fill="#003A5C" />
          </ScatterChart>
        </ResponsiveContainer>
      </Card>

      {/* Rankings Table */}
      <Card>
        <Title>Customer Rankings</Title>
        <div className="mt-4">
          <DataTable
            columns={[
              { key: "customer_name", label: "Customer" },
              { key: "revenue", label: "Revenue", align: "right" as const, render: (r: R) => formatCurrency(Number(r.revenue)) },
              { key: "gross_margin", label: "Margin $", align: "right" as const, render: (r: R) => formatCurrency(Number(r.gross_margin)) },
              { key: "margin_pct", label: "Margin %", align: "right" as const, render: (r: R) => (
                <span className={Number(r.margin_pct) < 25 ? "text-brand-danger font-semibold" : "font-semibold"}>
                  {String(r.margin_pct)}%
                </span>
              )},
              { key: "order_count", label: "Orders", align: "right" as const },
            ]}
            data={rankings}
          />
        </div>
      </Card>

      {/* Declining + Reorder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <Title>Declining Accounts</Title>
          <Subtitle>Revenue dropped vs prior 6 months</Subtitle>
          <div className="mt-4">
            <DataTable
              columns={[
                { key: "customer_name", label: "Customer" },
                { key: "decline_amount", label: "Decline $", align: "right" as const, render: (r: R) => (
                  <span className="text-brand-danger font-semibold">{formatCurrency(Number(r.decline_amount))}</span>
                )},
                { key: "decline_pct", label: "Decline %", align: "right" as const, render: (r: R) => (
                  <StatusBadge status="danger" label={`-${String(r.decline_pct)}%`} />
                )},
              ]}
              data={declining}
              emptyMessage="No declining accounts detected"
            />
          </div>
        </Card>

        <Card>
          <Title>Reorder Alerts</Title>
          <Subtitle>Customers past their typical reorder cycle</Subtitle>
          <div className="mt-4">
            <DataTable
              columns={[
                { key: "customer_name", label: "Customer" },
                { key: "days_overdue", label: "Days Overdue", align: "right" as const, render: (r: R) => (
                  <StatusBadge status="warning" label={`${String(r.days_overdue)} days`} />
                )},
                { key: "avg_order_value", label: "Avg Order", align: "right" as const, render: (r: R) => formatCurrency(Number(r.avg_order_value)) },
              ]}
              data={reorderAlerts}
              emptyMessage="No overdue reorders"
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
