"use client";

import {
  AreaChart, BarChart, BarList, DonutChart,
  Card, Metric, Text, Flex, BadgeDelta, Bold, Grid, Title, Subtitle,
  Legend,
} from "@tremor/react";
import DataTable from "@/components/DataTable";
import StatusBadge from "@/components/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/format";
import { useCompanyFetch } from "@/lib/useCompanyFetch";

/* eslint-disable @typescript-eslint/no-explicit-any */
type R = Record<string, any>;

interface OverviewData {
  kpis: R;
  revenueTrend: R[];
  arAging: R[];
  apAging: R[];
  overdueCustomers: R[];
  recentPayments: R[];
}

const valueFormatter = (v: number) => `$${(v / 1000).toFixed(0)}K`;
const pctFormatter = (v: number) => `${v}%`;

export default function OverviewPage() {
  const data = useCompanyFetch<OverviewData>("/api/overview");

  const kpis = data?.kpis || {};
  const revenueTrend = data?.revenueTrend || [];
  const arAging = data?.arAging || [];
  const overdueCustomers = data?.overdueCustomers || [];
  const recentPayments = data?.recentPayments || [];

  const arBarList = arAging.slice(0, 8).map((r: R) => ({
    name: String(r.customer_name),
    value: Number(r.total_open_balance || 0),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Title>Financial Overview</Title>
        <Text>Executive summary — U1P Ultrachem financial performance</Text>
      </div>

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
          <Text>MTD Revenue</Text>
          <Metric>{formatCurrency(Number(kpis.mtd_revenue || 0))}</Metric>
        </Card>
        <Card decoration="top" decorationColor="emerald">
          <Text>MTD Gross Margin</Text>
          <Metric>{kpis.mtd_margin_pct || 0}%</Metric>
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
          <Subtitle>Jan 2025 — present</Subtitle>
          <AreaChart
            className="mt-4 h-72"
            data={revenueTrend.map((r: R) => ({
              month: String(r.label),
              Revenue: Number(r.revenue || 0),
              "Gross Profit": Number(r.gross_profit || 0),
            }))}
            index="month"
            categories={["Revenue", "Gross Profit"]}
            colors={["blue", "emerald"]}
            valueFormatter={valueFormatter}
            showAnimation
            curveType="monotone"
          />
        </Card>

        <Card>
          <Title>Gross Margin %</Title>
          <Subtitle>Monthly trend</Subtitle>
          <AreaChart
            className="mt-4 h-72"
            data={revenueTrend.map((r: R) => ({
              month: String(r.label),
              "Margin %": Number(r.margin_pct || 0),
            }))}
            index="month"
            categories={["Margin %"]}
            colors={["emerald"]}
            valueFormatter={pctFormatter}
            showAnimation
            curveType="monotone"
            minValue={0}
            maxValue={60}
          />
        </Card>
      </div>

      {/* AR Aging + Top Receivables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <Title>AR Aging by Customer</Title>
          <Subtitle>Top 10 by outstanding balance</Subtitle>
          <BarChart
            className="mt-4 h-80"
            data={arAging.map((r: R) => ({
              customer: String(r.customer_name),
              Current: Number(r.current_bucket || 0),
              "1-30d": Number(r.days_1_30 || 0),
              "31-60d": Number(r.days_31_60 || 0),
              "61-90d": Number(r.days_61_90 || 0),
              "91+d": Number(r.days_91_plus || 0),
            }))}
            index="customer"
            categories={["Current", "1-30d", "31-60d", "61-90d", "91+d"]}
            colors={["emerald", "blue", "amber", "rose", "red"]}
            valueFormatter={valueFormatter}
            stack
            layout="vertical"
            showAnimation
          />
        </Card>

        <Card>
          <Title>Top Receivables</Title>
          <Subtitle>Largest open balances</Subtitle>
          <Flex className="mt-4" justifyContent="between">
            <Text><Bold>Customer</Bold></Text>
            <Text><Bold>Outstanding</Bold></Text>
          </Flex>
          <BarList
            data={arBarList}
            valueFormatter={(v: number) => formatCurrency(v)}
            className="mt-2"
            color="blue"
          />
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
