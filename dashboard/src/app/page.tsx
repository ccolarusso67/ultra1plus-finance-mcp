"use client";

import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Card, Metric, Text, Flex, BadgeDelta, Bold, Grid, Title, Subtitle,
} from "@tremor/react";
import Link from "next/link";
import DataTable from "@/components/DataTable";
import StatusBadge from "@/components/StatusBadge";
import { useState, useMemo } from "react";
import { formatCurrency, formatDate } from "@/lib/format";
import { useCompanyFetch } from "@/lib/useCompanyFetch";
import PeriodSelector from "@/components/PeriodSelector";
import { AlertTriangle, ShieldAlert, CheckCircle2, Brain, ArrowRight } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */
type R = Record<string, any>;

interface OverviewData {
  kpis: R;
  revenueTrend: R[];
  arAging: R[];
  apAging: R[];
  overdueCustomers: R[];
  recentPayments: R[];
  periodLabel?: string;
}

interface InsightsData {
  healthScore: number;
  healthGrade: string;
  healthLabel: string;
  insightCount: { total: number; critical: number; warning: number; info: number; positive: number };
  insights: { category: string; severity: string; title: string; detail: string; action: string }[];
}

export default function OverviewPage() {
  const [period, setPeriod] = useState("trailing12");
  const params = useMemo(() => ({ period }), [period]);
  const data = useCompanyFetch<OverviewData>("/api/overview", params);
  const insightsData = useCompanyFetch<InsightsData>("/api/insights");

  const kpis = data?.kpis || {};
  const revenueTrend = data?.revenueTrend || [];
  const arAging = data?.arAging || [];
  const overdueCustomers = data?.overdueCustomers || [];
  const recentPayments = data?.recentPayments || [];

  const arBarList = arAging.slice(0, 8).map((r: R) => ({
    name: String(r.customer_name),
    value: Number(r.total_open_balance || 0),
  }));

  const agingChartData = arAging.map((r: R) => ({
    customer: String(r.customer_name),
    Current: Number(r.current_bucket || 0),
    "1-30d": Number(r.days_1_30 || 0),
    "31-60d": Number(r.days_31_60 || 0),
    "61-90d": Number(r.days_61_90 || 0),
    "91+d": Number(r.days_91_plus || 0),
  }));

  const revenueTrendData = revenueTrend.map((r: R) => ({
    month: String(r.label),
    Revenue: Number(r.revenue || 0),
    "Gross Profit": Number(r.gross_profit || 0),
  }));

  const marginTrendData = revenueTrend.map((r: R) => ({
    month: String(r.label),
    "Margin %": Number(r.margin_pct || 0),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <Flex justifyContent="between" alignItems="end">
        <div>
          <Title>Financial Overview</Title>
          <Text>Executive summary — {data?.periodLabel || "Last 12 months"}</Text>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </Flex>

      {/* Financial Intelligence Banner */}
      {insightsData && (insightsData.insightCount.critical > 0 || insightsData.insightCount.warning > 0) && (
        <div className={`rounded-lg border p-4 ${
          insightsData.insightCount.critical > 0
            ? "bg-red-50 border-red-200"
            : "bg-amber-50 border-amber-200"
        }`}>
          <Flex justifyContent="between" alignItems="center">
            <Flex justifyContent="start" className="gap-3 items-center">
              {insightsData.insightCount.critical > 0 ? (
                <AlertTriangle size={20} className="text-red-600" />
              ) : (
                <ShieldAlert size={20} className="text-amber-600" />
              )}
              <div>
                <span className={`font-semibold text-sm ${
                  insightsData.insightCount.critical > 0 ? "text-red-800" : "text-amber-800"
                }`}>
                  Financial Health: {insightsData.healthGrade} ({insightsData.healthScore}/100)
                </span>
                <span className="text-sm text-gray-600 ml-2">
                  — {insightsData.insightCount.critical > 0
                    ? `${insightsData.insightCount.critical} critical issue${insightsData.insightCount.critical > 1 ? "s" : ""}`
                    : ""
                  }
                  {insightsData.insightCount.critical > 0 && insightsData.insightCount.warning > 0 ? ", " : ""}
                  {insightsData.insightCount.warning > 0
                    ? `${insightsData.insightCount.warning} warning${insightsData.insightCount.warning > 1 ? "s" : ""}`
                    : ""
                  }
                  {" "}requiring attention
                </span>
              </div>
            </Flex>
            <Link
              href="/insights"
              className={`flex items-center gap-1 text-sm font-medium px-3 py-1.5 rounded-md ${
                insightsData.insightCount.critical > 0
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-amber-500 text-white hover:bg-amber-600"
              } transition-colors`}
            >
              <Brain size={14} />
              View Insights
              <ArrowRight size={14} />
            </Link>
          </Flex>
          {/* Top 2 critical/warning insights preview */}
          <div className="mt-3 space-y-1.5">
            {insightsData.insights
              .filter((i) => i.severity === "critical" || i.severity === "warning")
              .slice(0, 2)
              .map((insight, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm">
                  <span className={`font-medium ${
                    insight.severity === "critical" ? "text-red-700" : "text-amber-700"
                  }`}>
                    •
                  </span>
                  <span className="text-gray-700">
                    <Bold>{insight.title}:</Bold> {insight.detail.substring(0, 120)}
                    {insight.detail.length > 120 ? "..." : ""}
                  </span>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* Positive health banner */}
      {insightsData && insightsData.insightCount.critical === 0 && insightsData.insightCount.warning === 0 && (
        <div className="rounded-lg border bg-emerald-50 border-emerald-200 p-4">
          <Flex justifyContent="between" alignItems="center">
            <Flex justifyContent="start" className="gap-3 items-center">
              <CheckCircle2 size={20} className="text-emerald-600" />
              <span className="font-semibold text-sm text-emerald-800">
                Financial Health: {insightsData.healthGrade} ({insightsData.healthScore}/100) — All systems healthy
              </span>
            </Flex>
            <Link
              href="/insights"
              className="flex items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-800 transition-colors"
            >
              <Brain size={14} />
              Full Report
              <ArrowRight size={14} />
            </Link>
          </Flex>
        </div>
      )}

      {/* KPI Strip */}
      <Grid numItemsSm={2} numItemsLg={3} numItemsMd={3} className="gap-4">
        <Card decoration="top" decorationColor="blue">
          <Text>Total Receivables</Text>
          <Metric>{formatCurrency(Number(kpis.total_ar || 0))}</Metric>
        </Card>
        <Card decoration="top" decorationColor="rose">
          <Text>Total Payables</Text>
          <Metric>{formatCurrency(Number(kpis.total_ap || 0))}</Metric>
        </Card>
        <Card decoration="top" decorationColor={Number(kpis.net_position || 0) >= 0 ? "emerald" : "rose"}>
          <Flex justifyContent="between" alignItems="center">
            <div>
              <Text>Net Position</Text>
              <Metric>{formatCurrency(Number(kpis.net_position || 0))}</Metric>
            </div>
            <BadgeDelta
              deltaType={Number(kpis.net_position || 0) >= 0 ? "increase" : "decrease"}
              size="lg"
            >
              {Number(kpis.net_position || 0) >= 0 ? "Positive" : "Negative"}
            </BadgeDelta>
          </Flex>
        </Card>
        <Card decoration="top" decorationColor="cyan">
          <Text>Revenue</Text>
          <Metric>{formatCurrency(Number(kpis.period_revenue || kpis.mtd_revenue || 0))}</Metric>
          <Text className="text-xs text-gray-400 mt-1">{data?.periodLabel || ""}</Text>
        </Card>
        <Card decoration="top" decorationColor="emerald">
          <Text>Gross Margin</Text>
          <Metric>{kpis.period_margin_pct || kpis.mtd_margin_pct || 0}%</Metric>
          <Text className="text-xs text-gray-400 mt-1">{data?.periodLabel || ""}</Text>
        </Card>
        <Card decoration="top" decorationColor="amber">
          <Flex justifyContent="between" alignItems="center">
            <div>
              <Text>Sales Backlog</Text>
              <Metric>{formatCurrency(Number(kpis.backlog_value || 0))}</Metric>
            </div>
            {Number(kpis.overdue_orders || 0) > 0 && (
              <BadgeDelta deltaType="decrease" size="sm">
                {kpis.overdue_orders} overdue
              </BadgeDelta>
            )}
          </Flex>
        </Card>
      </Grid>

      {/* Revenue Trend + Margin */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <Title>Revenue Trend</Title>
          <Subtitle>{data?.periodLabel || "Last 12 months"}</Subtitle>
          <ResponsiveContainer width="100%" height={288} className="mt-4">
            <AreaChart data={revenueTrendData}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0098DB" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#0098DB" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorGP" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#137333" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#137333" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend />
              <Area type="monotone" dataKey="Revenue" stroke="#0098DB" fill="url(#colorRevenue)" strokeWidth={2} />
              <Area type="monotone" dataKey="Gross Profit" stroke="#137333" fill="url(#colorGP)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <Title>Gross Margin %</Title>
          <Subtitle>Monthly trend</Subtitle>
          <ResponsiveContainer width="100%" height={288} className="mt-4">
            <AreaChart data={marginTrendData}>
              <defs>
                <linearGradient id="colorMargin" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#137333" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#137333" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} domain={[0, 60]} />
              <Tooltip formatter={(v: number) => `${v}%`} />
              <Area type="monotone" dataKey="Margin %" stroke="#137333" fill="url(#colorMargin)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* AR Aging + Top Receivables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <Title>AR Aging by Customer</Title>
          <Subtitle>Top 10 by outstanding balance</Subtitle>
          <ResponsiveContainer width="100%" height={320} className="mt-4">
            <BarChart data={agingChartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
              <YAxis type="category" dataKey="customer" tick={{ fontSize: 11 }} width={120} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend />
              <Bar dataKey="Current" stackId="a" fill="#137333" />
              <Bar dataKey="1-30d" stackId="a" fill="#0098DB" />
              <Bar dataKey="31-60d" stackId="a" fill="#E37400" />
              <Bar dataKey="61-90d" stackId="a" fill="#C5221F" />
              <Bar dataKey="91+d" stackId="a" fill="#7F1D1D" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <Title>Top Receivables</Title>
          <Subtitle>Largest open balances</Subtitle>
          <Flex className="mt-4" justifyContent="between">
            <Text><Bold>Customer</Bold></Text>
            <Text><Bold>Outstanding</Bold></Text>
          </Flex>
          <ResponsiveContainer width="100%" height={Math.max(200, arBarList.length * 36)} className="mt-2">
            <BarChart data={arBarList} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={140} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="value" fill="#0098DB" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Tables: Overdue + Payments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <Title>Top Overdue Customers</Title>
          <Subtitle>Balances 31+ days past due</Subtitle>
          <div className="mt-4">
            <DataTable
              columns={[
                { key: "customer_name", label: "Customer" },
                {
                  key: "overdue_amount", label: "Overdue", align: "right" as const,
                  render: (r: R) => (
                    <span className="font-semibold text-red-600">{formatCurrency(Number(r.overdue_amount))}</span>
                  ),
                },
                {
                  key: "total_open_balance", label: "Total Open", align: "right" as const,
                  render: (r: R) => formatCurrency(Number(r.total_open_balance)),
                },
              ]}
              data={overdueCustomers}
              pageSize={5}
            />
          </div>
        </Card>

        <Card>
          <Title>Recent Payments</Title>
          <Subtitle>Last 5 payments received</Subtitle>
          <div className="mt-4">
            <DataTable
              columns={[
                { key: "customer_name", label: "Customer" },
                {
                  key: "amount", label: "Amount", align: "right" as const,
                  render: (r: R) => (
                    <span className="font-semibold text-emerald-600">{formatCurrency(Number(r.amount))}</span>
                  ),
                },
                {
                  key: "payment_date", label: "Date",
                  render: (r: R) => formatDate(String(r.payment_date)),
                },
                {
                  key: "payment_method", label: "Method",
                  render: (r: R) => (
                    <StatusBadge status="info" label={String(r.payment_method || "N/A")} />
                  ),
                },
              ]}
              data={recentPayments}
              pageSize={5}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
