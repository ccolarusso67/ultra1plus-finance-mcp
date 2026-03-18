"use client";

import { useEffect, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  DollarSign, TrendingUp, TrendingDown, CreditCard,
  ClipboardList, AlertTriangle,
} from "lucide-react";
import KpiCard from "@/components/KpiCard";
import ChartCard from "@/components/ChartCard";
import DataTable from "@/components/DataTable";
import StatusBadge from "@/components/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/format";

interface OverviewData {
  kpis: Record<string, number>;
  revenueTrend: Array<Record<string, unknown>>;
  arAging: Array<Record<string, unknown>>;
  apAging: Array<Record<string, unknown>>;
  overdueCustomers: Array<Record<string, unknown>>;
  recentPayments: Array<Record<string, unknown>>;
}

export default function OverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);

  useEffect(() => {
    fetch("/api/overview")
      .then((r) => r.json())
      .then((d) => { if (!d.error) setData(d); else setData(null); })
      .catch(() => setData(null));
  }, []);

  const kpis = data?.kpis || { total_ar: 0, total_ap: 0, net_position: 0, mtd_revenue: 0, mtd_margin_pct: 0, backlog_value: 0, overdue_orders: 0 };
  const revenueTrend = data?.revenueTrend || [];
  const arAging = data?.arAging || [];
  const overdueCustomers = data?.overdueCustomers || [];
  const recentPayments = data?.recentPayments || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#1A1A1A]">Financial Overview</h1>
        <p className="text-[12px] text-[#5F6368] mt-0.5">
          Executive summary of Ultra1Plus financial performance
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard
          label="Total AR"
          value={formatCurrency(kpis.total_ar)}
          icon={DollarSign}
        />
        <KpiCard
          label="Total AP"
          value={formatCurrency(kpis.total_ap)}
          icon={CreditCard}
        />
        <KpiCard
          label="Net Position"
          value={formatCurrency(kpis.net_position)}
          changeType={kpis.net_position >= 0 ? "positive" : "negative"}
          icon={kpis.net_position >= 0 ? TrendingUp : TrendingDown}
        />
        <KpiCard
          label="MTD Revenue"
          value={formatCurrency(kpis.mtd_revenue)}
          icon={TrendingUp}
        />
        <KpiCard
          label="MTD Margin"
          value={`${kpis.mtd_margin_pct}%`}
          icon={TrendingUp}
        />
        <KpiCard
          label="Backlog"
          value={formatCurrency(kpis.backlog_value)}
          subtitle={`${kpis.overdue_orders} overdue`}
          icon={ClipboardList}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Revenue Trend" subtitle="Last 12 months">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={revenueTrend}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#003A5C" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#003A5C" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Area
                type="monotone" dataKey="revenue" stroke="#003A5C"
                fill="url(#revGrad)" strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Gross Margin %" subtitle="Last 12 months">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={revenueTrend}>
              <defs>
                <linearGradient id="marginGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#137333" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#137333" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} domain={[0, 50]} />
              <Tooltip formatter={(v: number) => `${v}%`} />
              <Area
                type="monotone" dataKey="margin_pct" stroke="#137333"
                fill="url(#marginGrad)" strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* AR Aging Bar Chart */}
      <ChartCard title="AR Aging by Customer" subtitle="Top 10 customers by outstanding balance">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={arAging} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
            <YAxis type="category" dataKey="customer_name" tick={{ fontSize: 11 }} width={150} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <Legend />
            <Bar dataKey="current_bucket" name="Current" stackId="a" fill="#137333" />
            <Bar dataKey="days_1_30" name="1-30 days" stackId="a" fill="#0098DB" />
            <Bar dataKey="days_31_60" name="31-60 days" stackId="a" fill="#E37400" />
            <Bar dataKey="days_61_90" name="61-90 days" stackId="a" fill="#C5221F" />
            <Bar dataKey="days_91_plus" name="91+ days" stackId="a" fill="#7F1D1D" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Top Overdue Customers" subtitle="Balances 31+ days past due">
          <DataTable
            columns={[
              { key: "customer_name", label: "Customer" },
              {
                key: "overdue_amount", label: "Overdue", align: "right" as const,
                render: (r: Record<string, unknown>) => (
                  <span className="font-semibold text-[#C5221F]">
                    {formatCurrency(Number(r.overdue_amount))}
                  </span>
                ),
              },
              {
                key: "total_open_balance", label: "Total Open", align: "right" as const,
                render: (r: Record<string, unknown>) => formatCurrency(Number(r.total_open_balance)),
              },
            ]}
            data={overdueCustomers as Record<string, unknown>[]}
            pageSize={5}
          />
        </ChartCard>

        <ChartCard title="Recent Payments" subtitle="Last 5 payments received">
          <DataTable
            columns={[
              { key: "customer_name", label: "Customer" },
              {
                key: "amount", label: "Amount", align: "right" as const,
                render: (r: Record<string, unknown>) => (
                  <span className="font-semibold text-[#137333]">
                    {formatCurrency(Number(r.amount))}
                  </span>
                ),
              },
              {
                key: "payment_date", label: "Date",
                render: (r: Record<string, unknown>) => formatDate(String(r.payment_date)),
              },
              {
                key: "payment_method", label: "Method",
                render: (r: Record<string, unknown>) => (
                  <StatusBadge status="info" label={String(r.payment_method || "N/A")} />
                ),
              },
            ]}
            data={recentPayments as Record<string, unknown>[]}
            pageSize={5}
          />
        </ChartCard>
      </div>
    </div>
  );
}
