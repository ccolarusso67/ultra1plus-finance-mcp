"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ScatterChart, Scatter, ZAxis, Legend,
} from "recharts";
import { Users, TrendingDown, AlertTriangle, DollarSign } from "lucide-react";
import KpiCard from "@/components/KpiCard";
import ChartCard from "@/components/ChartCard";
import DataTable from "@/components/DataTable";
import StatusBadge from "@/components/StatusBadge";
import { formatCurrency } from "@/lib/format";
import { useCompanyFetch } from "@/lib/useCompanyFetch";

export default function CustomersPage() {
  const data = useCompanyFetch<Record<string, unknown>>("/api/customers");

  const d = data as Record<string, unknown> || {};
  const rankings = (d.rankings as Record<string, unknown>[]) || [];
  const declining = (d.declining as Record<string, unknown>[]) || [];
  const reorderAlerts = (d.reorderAlerts as Record<string, unknown>[]) || [];
  const activeCount = Number(d.activeCount || 0);

  const topRevenue = rankings.length > 0 ? formatCurrency(Number(rankings[0].revenue)) : "$0";
  const avgMargin = rankings.length > 0
    ? (rankings.reduce((s, r) => s + Number(r.margin_pct || 0), 0) / rankings.length).toFixed(1)
    : "0";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#1A1A1A]">Customers</h1>
        <p className="text-[12px] text-[#5F6368] mt-0.5">Customer performance, margins, and intelligence</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Active Customers" value={String(activeCount)} icon={Users} />
        <KpiCard label="Top Customer Revenue" value={topRevenue} icon={DollarSign} subtitle="Current quarter" />
        <KpiCard label="Avg Margin" value={`${avgMargin}%`} icon={TrendingDown} />
        <KpiCard
          label="Declining Accounts"
          value={String(declining.length)}
          changeType={declining.length > 0 ? "negative" : "positive"}
          icon={AlertTriangle}
        />
      </div>

      {/* Top Customers Bar Chart */}
      <ChartCard title="Top Customers by Revenue" subtitle="Current quarter">
        <ResponsiveContainer width="100%" height={Math.max(300, rankings.slice(0, 15).length * 35)}>
          <BarChart data={rankings.slice(0, 15)} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
            <YAxis type="category" dataKey="customer_name" tick={{ fontSize: 11 }} width={170} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <Legend />
            <Bar dataKey="revenue" name="Revenue" fill="#003A5C" radius={[0, 1, 1, 0]} />
            <Bar dataKey="gross_margin" name="Gross Margin" fill="#137333" radius={[0, 1, 1, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Customer Margin Scatter */}
      <ChartCard title="Revenue vs Margin" subtitle="Each dot is a customer — bottom-left = low revenue, low margin">
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
            <XAxis type="number" dataKey="revenue" name="Revenue" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
            <YAxis type="number" dataKey="margin_pct" name="Margin %" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
            <ZAxis type="number" dataKey="order_count" range={[50, 400]} />
            <Tooltip formatter={(v: number, name: string) => name === "Revenue" ? formatCurrency(v) : `${v}%`} />
            <Scatter data={rankings} fill="#003A5C" />
          </ScatterChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Rankings Table */}
      <ChartCard title="Customer Rankings">
        <DataTable
          columns={[
            { key: "customer_name", label: "Customer" },
            { key: "revenue", label: "Revenue", align: "right", render: (r) => formatCurrency(Number(r.revenue)) },
            { key: "gross_margin", label: "Margin $", align: "right", render: (r) => formatCurrency(Number(r.gross_margin)) },
            { key: "margin_pct", label: "Margin %", align: "right", render: (r) => (
              <span className={Number(r.margin_pct) < 25 ? "text-[#C5221F] font-semibold" : "font-semibold"}>
                {String(r.margin_pct)}%
              </span>
            )},
            { key: "order_count", label: "Orders", align: "right" },
          ]}
          data={rankings}
        />
      </ChartCard>

      {/* Declining + Reorder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Declining Accounts" subtitle="Revenue dropped vs prior 6 months">
          <DataTable
            columns={[
              { key: "customer_name", label: "Customer" },
              { key: "decline_amount", label: "Decline $", align: "right", render: (r) => (
                <span className="text-[#C5221F] font-semibold">{formatCurrency(Number(r.decline_amount))}</span>
              )},
              { key: "decline_pct", label: "Decline %", align: "right", render: (r) => (
                <StatusBadge status="danger" label={`-${String(r.decline_pct)}%`} />
              )},
            ]}
            data={declining}
            emptyMessage="No declining accounts detected"
          />
        </ChartCard>

        <ChartCard title="Reorder Alerts" subtitle="Customers past their typical reorder cycle">
          <DataTable
            columns={[
              { key: "customer_name", label: "Customer" },
              { key: "days_overdue", label: "Days Overdue", align: "right", render: (r) => (
                <StatusBadge status="warning" label={`${String(r.days_overdue)} days`} />
              )},
              { key: "avg_order_value", label: "Avg Order", align: "right", render: (r) => formatCurrency(Number(r.avg_order_value)) },
            ]}
            data={reorderAlerts}
            emptyMessage="No overdue reorders"
          />
        </ChartCard>
      </div>
    </div>
  );
}
