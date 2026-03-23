"use client";

import { useState, useEffect } from "react";
import {
  ComposedChart, Bar as ReBar, Line as ReLine,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend as ReLegend,
  LineChart as ReLineChart, Line,
} from "recharts";
import {
  BarChart, DonutChart,
  Card, Metric, Text, Flex, Grid, Title, Subtitle,
} from "@tremor/react";
import {
  AlertTriangle, Calendar,
} from "lucide-react";
import DataTable from "@/components/DataTable";
import StatusBadge from "@/components/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/format";
import { useCompany } from "@/lib/company";

/* eslint-disable @typescript-eslint/no-explicit-any */
type R = Record<string, any>;

const currencyFormatter = (v: number) => `$${(v / 1000).toFixed(0)}K`;

function RiskBadge({ level }: { level: string }) {
  const colors: R = {
    critical: "bg-[#C5221F] text-white",
    high: "bg-[#E37400] text-white",
    medium: "bg-[#FDE293] text-[#7F6000]",
    low: "bg-[#E6F4EA] text-brand-success",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${colors[level] || colors.low}`}>
      {level}
    </span>
  );
}

function AlertCard({ condition, title, message }: { condition: boolean; title: string; message: string }) {
  if (!condition) return null;
  return (
    <div className="flex items-start gap-3 bg-[#FCE8E6] border border-[#C5221F]/20 rounded-lg px-4 py-3">
      <AlertTriangle size={16} className="text-brand-danger mt-0.5 shrink-0" />
      <div>
        <p className="text-[13px] font-semibold text-brand-danger">{title}</p>
        <p className="text-[12px] text-muted-foreground mt-0.5">{message}</p>
      </div>
    </div>
  );
}

export default function CashPage() {
  const { companyId } = useCompany();
  const [days, setDays] = useState(90);
  const [data, setData] = useState<R | null>(null);

  useEffect(() => {
    setData(null);
    fetch(`/api/cash-operations?company_id=${encodeURIComponent(companyId)}&days=${days}`)
      .then((r) => r.json())
      .then((d) => { if (!d.error) setData(d); })
      .catch(() => {});
  }, [companyId, days]);

  if (!data) {
    return <div className="flex items-center justify-center h-96"><div className="text-muted-foreground">Loading...</div></div>;
  }

  const k = data.kpis || {};
  const c = data.collections || {};
  const p = data.payables || {};
  const l = data.liquidity || {};
  const bl = data.backlog || {};
  const alerts = data.alerts || {};
  const flags = alerts.flags || {};

  const arBuckets = c.arBuckets || {};
  const apBuckets = p.apBuckets || {};

  const arPieData = [
    { name: "Current", value: Number(arBuckets.current || 0) },
    { name: "1-30d", value: Number(arBuckets.days_1_30 || 0) },
    { name: "31-60d", value: Number(arBuckets.days_31_60 || 0) },
    { name: "61-90d", value: Number(arBuckets.days_61_90 || 0) },
    { name: "91+d", value: Number(arBuckets.days_91_plus || 0) },
  ].filter((d) => d.value > 0);

  const apPieData = [
    { name: "Current", value: Number(apBuckets.current || 0) },
    { name: "1-30d", value: Number(apBuckets.days_1_30 || 0) },
    { name: "31-60d", value: Number(apBuckets.days_31_60 || 0) },
    { name: "61-90d", value: Number(apBuckets.days_61_90 || 0) },
    { name: "91+d", value: Number(apBuckets.days_91_plus || 0) },
  ].filter((d) => d.value > 0);

  const coverageRatio = k.coverage_ratio;
  const coverageType = coverageRatio >= 1.5 ? "positive" : coverageRatio >= 1 ? "neutral" : "negative";

  return (
    <div className="space-y-8">
      {/* Header + Date Range */}
      <div className="flex items-end justify-between">
        <div>
          <Title>Operational Cash</Title>
          <Text>
            Cash pressure, collections, obligations, and short-term liquidity
            <span className="ml-2 text-[10px] bg-[#FDE293] text-[#7F6000] px-1.5 py-0.5 rounded">Operational view — not a formal cash flow statement</span>
          </Text>
        </div>
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-muted-foreground" />
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}
            className="text-[13px] border border-border rounded px-3 py-1.5 bg-card text-foreground focus:outline-none focus:border-[#0098DB] cursor-pointer">
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={180}>Last 180 days</option>
            <option value={365}>Last 365 days</option>
          </select>
        </div>
      </div>

      {/* === ALERT BANNERS === */}
      <div className="space-y-2">
        <AlertCard condition={flags.billsExceedCollections7d}
          title="Cash Pressure: 7-Day"
          message={`Bills due next 7 days (${formatCurrency(Number(k.bills_due_7d || 0))}) exceed collections last 7 days (${formatCurrency(Number(k.cash_in_7d || 0))})`} />
        <AlertCard condition={flags.billsExceedCollections30d}
          title="Cash Pressure: 30-Day"
          message={`Bills due next 30 days (${formatCurrency(Number(k.bills_due_30d || 0))}) exceed collections last 30 days (${formatCurrency(Number(k.cash_in_30d || 0))})`} />
        <AlertCard condition={flags.arOver90Rising}
          title="AR Over 90 Days Elevated"
          message={`${formatCurrency(Number(k.ar_over_90 || 0))} in receivables past 90 days`} />
        <AlertCard condition={flags.highConcentration}
          title="High AR Concentration"
          message={`Top 10 customers represent ${c.top10ArPct || 0}% of total AR`} />
      </div>

      {/* === KPI ROW === */}
      <Grid numItemsSm={2} numItemsMd={5} numItemsLg={5} className="gap-3">
        <Card decoration="top" decorationColor="emerald">
          <Text>Cash In (7d)</Text>
          <Metric>{formatCurrency(Number(k.cash_in_7d || 0))}</Metric>
        </Card>
        <Card decoration="top" decorationColor="emerald">
          <Text>Cash In (30d)</Text>
          <Metric>{formatCurrency(Number(k.cash_in_30d || 0))}</Metric>
        </Card>
        <Card decoration="top" decorationColor="rose">
          <Text>Bills Due (7d)</Text>
          <Metric>{formatCurrency(Number(k.bills_due_7d || 0))}</Metric>
        </Card>
        <Card decoration="top" decorationColor="rose">
          <Text>Bills Due (30d)</Text>
          <Metric>{formatCurrency(Number(k.bills_due_30d || 0))}</Metric>
        </Card>
        <Card decoration="top" decorationColor={Number(k.net_cash_pressure_30d || 0) >= 0 ? "emerald" : "rose"}>
          <Text>Net Pressure (30d)</Text>
          <Metric>{formatCurrency(Number(k.net_cash_pressure_30d || 0))}</Metric>
        </Card>
      </Grid>

      <Grid numItemsSm={2} numItemsMd={5} numItemsLg={5} className="gap-3">
        <Card decoration="top" decorationColor="blue">
          <Text>Open AR</Text>
          <Metric>{formatCurrency(Number(k.open_ar || 0))}</Metric>
        </Card>
        <Card decoration="top" decorationColor="blue">
          <Text>Open AP</Text>
          <Metric>{formatCurrency(Number(k.open_ap || 0))}</Metric>
        </Card>
        <Card decoration="top" decorationColor="cyan">
          <Text>Backlog</Text>
          <Metric>{formatCurrency(Number(k.backlog_value || 0))}</Metric>
        </Card>
        <Card decoration="top" decorationColor={Number(k.ar_over_90 || 0) > 100000 ? "rose" : "amber"}>
          <Text>AR &gt; 90d</Text>
          <Metric>{formatCurrency(Number(k.ar_over_90 || 0))}</Metric>
        </Card>
        <Card decoration="top" decorationColor={Number(k.ap_over_90 || 0) > 100000 ? "rose" : "amber"}>
          <Text>AP &gt; 90d</Text>
          <Metric>{formatCurrency(Number(k.ap_over_90 || 0))}</Metric>
        </Card>
      </Grid>

      {/* Coverage Ratio */}
      <Card decoration="top" decorationColor={coverageType === "positive" ? "emerald" : coverageType === "neutral" ? "amber" : "rose"}>
        <Flex justifyContent="between" alignItems="center">
          <div>
            <Text className="uppercase tracking-wider font-medium">30-Day Coverage Ratio</Text>
            <Text className="mt-0.5">Cash In (30d) / Bills Due (30d)</Text>
          </div>
          <div className="text-right">
            <Metric className={
              coverageType === "positive" ? "text-brand-success" :
              coverageType === "neutral" ? "text-brand-warning" : "text-brand-danger"
            }>
              {coverageRatio !== null && coverageRatio !== undefined ? `${coverageRatio}x` : "N/A"}
            </Metric>
            <Text>
              {coverageRatio >= 1.5 ? "Healthy" : coverageRatio >= 1 ? "Tight" : coverageRatio !== null ? "Under pressure" : ""}
            </Text>
          </div>
        </Flex>
      </Card>

      {/* === COLLECTIONS === */}
      <div className="pt-2">
        <Title>Collections</Title>
        <Text>Cash inflows, payment trends, and receivable aging</Text>
      </div>

      {/* Daily Collections */}
      <Card>
        <Title>Daily Collections</Title>
        <Subtitle>{`Last ${days} days`}</Subtitle>
        <BarChart
          className="mt-4 h-72"
          data={(c.daily || []).map((r: R) => ({
            day: String(r.label),
            Amount: Number(r.amount || 0),
          }))}
          index="day"
          categories={["Amount"]}
          colors={["emerald"]}
          valueFormatter={(v: number) => formatCurrency(v)}
          showAnimation
        />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <Title>Top Paying Customers</Title>
          <Subtitle>Last 30 days</Subtitle>
          <div className="mt-4">
            <DataTable
              columns={[
                { key: "customer_name", label: "Customer" },
                { key: "total_paid", label: "Collected", align: "right" as const,
                  render: (r: R) => <span className="font-semibold text-brand-success">{formatCurrency(Number(r.total_paid))}</span> },
                { key: "payment_count", label: "#", align: "right" as const },
              ]}
              data={c.topCustomers || []}
              pageSize={8}
            />
          </div>
        </Card>

        <Card>
          <Title>AR Aging</Title>
          <Subtitle>{`Total: ${formatCurrency(Number(arBuckets.total || 0))}`}</Subtitle>
          <div className="mt-4 flex items-center gap-6">
            <DonutChart
              className="h-48 w-48"
              data={arPieData}
              category="value"
              index="name"
              valueFormatter={(v: number) => formatCurrency(v)}
              colors={["emerald", "blue", "amber", "rose", "red"]}
              showAnimation
            />
            <div className="space-y-1.5 text-[12px]">
              {["Current", "1-30d", "31-60d", "61-90d", "91+d"].map((label, i) => {
                const keys = ["current", "days_1_30", "days_31_60", "days_61_90", "days_91_plus"];
                const dotColors = ["#137333", "#0098DB", "#E37400", "#C5221F", "#7F1D1D"];
                return (
                  <div key={label} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: dotColors[i] }} />
                    <span className="text-muted-foreground w-12">{label}</span>
                    <span className="font-medium">{formatCurrency(Number(arBuckets[keys[i]] || 0))}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <Title>AR Concentration</Title>
          <Subtitle>{`Top 10 = ${c.top10ArPct || 0}% of total AR`}</Subtitle>
          <BarChart
            className="mt-4 h-72"
            data={(c.concentration || []).map((r: R) => ({
              customer: String(r.customer_name),
              Balance: Number(r.balance || 0),
            }))}
            index="customer"
            categories={["Balance"]}
            colors={["blue"]}
            valueFormatter={(v: number) => currencyFormatter(v)}
            layout="vertical"
            showAnimation
          />
        </Card>

        <Card>
          <Title>Largest Overdue Invoices</Title>
          <Subtitle>Past due, by balance</Subtitle>
          <div className="mt-4">
            <DataTable
              columns={[
                { key: "customer_name", label: "Customer" },
                { key: "balance_remaining", label: "Balance", align: "right" as const,
                  render: (r: R) => <span className="font-semibold text-brand-danger">{formatCurrency(Number(r.balance_remaining))}</span> },
                { key: "days_past_due", label: "Days", align: "right" as const,
                  render: (r: R) => {
                    const d = Number(r.days_past_due);
                    return <span className={d > 90 ? "text-brand-danger font-bold" : d > 30 ? "text-brand-warning font-medium" : ""}>{d}</span>;
                  }},
              ]}
              data={c.largestOverdue || []}
              pageSize={8}
            />
          </div>
        </Card>
      </div>

      {/* === PAYABLES === */}
      <div className="pt-2">
        <Title>Payables &amp; Obligations</Title>
        <Text>Upcoming bills, vendor exposure, and payment calendar</Text>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <Title>Upcoming Bills</Title>
          <Subtitle>Next 8 weeks by due date</Subtitle>
          <BarChart
            className="mt-4 h-72"
            data={(p.timeline || []).map((r: R) => ({
              week: String(r.label),
              Amount: Number(r.amount || 0),
            }))}
            index="week"
            categories={["Amount"]}
            colors={["rose"]}
            valueFormatter={(v: number) => currencyFormatter(v)}
            showAnimation
          />
        </Card>

        <Card>
          <Title>AP Aging</Title>
          <Subtitle>{`Total: ${formatCurrency(Number(apBuckets.total || 0))}`}</Subtitle>
          <div className="mt-4 flex items-center gap-6">
            <DonutChart
              className="h-48 w-48"
              data={apPieData}
              category="value"
              index="name"
              valueFormatter={(v: number) => formatCurrency(v)}
              colors={["emerald", "blue", "amber", "rose", "red"]}
              showAnimation
            />
            <div className="space-y-1.5 text-[12px]">
              {["Current", "1-30d", "31-60d", "61-90d", "91+d"].map((label, i) => {
                const keys = ["current", "days_1_30", "days_31_60", "days_61_90", "days_91_plus"];
                const dotColors = ["#137333", "#0098DB", "#E37400", "#C5221F", "#7F1D1D"];
                return (
                  <div key={label} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: dotColors[i] }} />
                    <span className="text-muted-foreground w-12">{label}</span>
                    <span className="font-medium">{formatCurrency(Number(apBuckets[keys[i]] || 0))}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <Title>AP Concentration</Title>
          <Subtitle>{`Top 10 = ${p.top10ApPct || 0}% of total AP`}</Subtitle>
          <BarChart
            className="mt-4 h-72"
            data={(p.concentration || []).map((r: R) => ({
              vendor: String(r.vendor_name),
              Balance: Number(r.balance || 0),
            }))}
            index="vendor"
            categories={["Balance"]}
            colors={["rose"]}
            valueFormatter={(v: number) => currencyFormatter(v)}
            layout="vertical"
            showAnimation
          />
        </Card>

        <Card>
          <Title>Largest Unpaid Vendors</Title>
          <Subtitle>By outstanding balance</Subtitle>
          <div className="mt-4">
            <DataTable
              columns={[
                { key: "vendor_name", label: "Vendor" },
                { key: "balance", label: "Balance", align: "right" as const,
                  render: (r: R) => <span className="font-semibold">{formatCurrency(Number(r.balance))}</span> },
                { key: "days_91_plus", label: ">90d", align: "right" as const,
                  render: (r: R) => Number(r.days_91_plus) > 0
                    ? <span className="text-brand-danger font-medium">{formatCurrency(Number(r.days_91_plus))}</span>
                    : <span className="text-muted-foreground">$0</span> },
              ]}
              data={p.largestVendors || []}
              pageSize={10}
            />
          </div>
        </Card>
      </div>

      {/* === LIQUIDITY === */}
      <div className="pt-2">
        <Title>Liquidity &amp; Pressure</Title>
        <Text>Collections vs obligations, operating cash trends</Text>
      </div>

      {/* Collections vs Obligations — Tremor BarChart (grouped) */}
      <Card>
        <Title>Collections vs Obligations</Title>
        <Subtitle>Monthly, last 12 months</Subtitle>
        <BarChart
          className="mt-4 h-80"
          data={(l.collectionsVsObligations || []).map((r: R) => ({
            month: String(r.label),
            "Cash In": Number(r.collections || 0),
            "Bills Due": Number(r.obligations || 0),
          }))}
          index="month"
          categories={["Cash In", "Bills Due"]}
          colors={["emerald", "rose"]}
          valueFormatter={(v: number) => currencyFormatter(v)}
          showAnimation
        />
      </Card>

      {/* Operating Cash Trends — KEEP Recharts ComposedChart (multi-line) */}
      <Card>
        <Title>Operating Cash Trends</Title>
        <Subtitle>Collections, invoicing, and bills — last 12 months</Subtitle>
        <ResponsiveContainer width="100%" height={320} className="mt-4">
          <ReLineChart data={l.monthlyTrends || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <ReLegend />
            <Line type="monotone" dataKey="collections" name="Collections" stroke="#137333" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="invoiced" name="Invoiced" stroke="#003A5C" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="billed" name="Bills" stroke="#C5221F" strokeWidth={2} dot={{ r: 3 }} />
          </ReLineChart>
        </ResponsiveContainer>
      </Card>

      {/* === BACKLOG === */}
      <div className="pt-2">
        <Title>Backlog &amp; Conversion</Title>
        <Text>Open orders, invoicing pipeline, and order-to-cash conversion</Text>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <Title>Backlog by Customer</Title>
          <Subtitle>{`Total: ${formatCurrency(Number(k.backlog_value || 0))}`}</Subtitle>
          {(bl.byCustomer || []).length === 0 ? (
            <p className="text-[13px] text-muted-foreground py-8 text-center">No open sales orders</p>
          ) : (
            <div className="mt-4">
              <DataTable
                columns={[
                  { key: "customer_name", label: "Customer" },
                  { key: "backlog_value", label: "Backlog", align: "right" as const,
                    render: (r: R) => <span className="font-semibold">{formatCurrency(Number(r.backlog_value))}</span> },
                  { key: "order_count", label: "Orders", align: "right" as const },
                  { key: "oldest_order", label: "Oldest", render: (r: R) => formatDate(String(r.oldest_order)) },
                ]}
                data={bl.byCustomer || []}
                pageSize={10}
              />
            </div>
          )}
        </Card>

        {/* Monthly Invoicing — KEEP Recharts ComposedChart (dual axis) */}
        <Card>
          <Title>Monthly Invoicing</Title>
          <Subtitle>Invoice volume and value, last 12 months</Subtitle>
          <ResponsiveContainer width="100%" height={280} className="mt-4">
            <ComposedChart data={bl.invoicingTrend || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="amt" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
              <YAxis yAxisId="cnt" orientation="right" tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number, name: string) => name === "Count" ? v : formatCurrency(v)} />
              <ReLegend />
              <ReBar yAxisId="amt" dataKey="invoiced" name="Invoiced" fill="#003A5C" radius={[2, 2, 0, 0]} />
              <ReLine yAxisId="cnt" type="monotone" dataKey="count" name="Count" stroke="#0098DB" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* === RISK & ALERTS === */}
      <div className="pt-2">
        <Title>Risk &amp; Alerts</Title>
        <Text>Overdue exposures, risk flags, and data freshness</Text>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <Title>High-Risk Customers</Title>
          <Subtitle>Large overdue balances</Subtitle>
          {(alerts.riskCustomers || []).length === 0 ? (
            <p className="text-[13px] text-brand-success py-4 text-center">No high-risk customers</p>
          ) : (
            <div className="mt-4">
              <DataTable
                columns={[
                  { key: "customer_name", label: "Customer" },
                  { key: "overdue_amount", label: "Overdue", align: "right" as const,
                    render: (r: R) => <span className="font-semibold">{formatCurrency(Number(r.overdue_amount))}</span> },
                  { key: "risk_level", label: "Risk", align: "center" as const,
                    render: (r: R) => <RiskBadge level={String(r.risk_level)} /> },
                ]}
                data={alerts.riskCustomers || []}
                pageSize={10}
              />
            </div>
          )}
        </Card>

        <Card>
          <Title>High-Risk Vendors</Title>
          <Subtitle>Significant unpaid obligations</Subtitle>
          {(alerts.riskVendors || []).length === 0 ? (
            <p className="text-[13px] text-brand-success py-4 text-center">No high-risk vendors</p>
          ) : (
            <div className="mt-4">
              <DataTable
                columns={[
                  { key: "vendor_name", label: "Vendor" },
                  { key: "overdue_amount", label: "Overdue", align: "right" as const,
                    render: (r: R) => <span className="font-semibold">{formatCurrency(Number(r.overdue_amount))}</span> },
                  { key: "risk_level", label: "Risk", align: "center" as const,
                    render: (r: R) => <RiskBadge level={String(r.risk_level)} /> },
                ]}
                data={alerts.riskVendors || []}
                pageSize={10}
              />
            </div>
          )}
        </Card>
      </div>

      {(alerts.syncWarnings || []).length > 0 && (
        <Card>
          <Title>Data Freshness Warnings</Title>
          <Subtitle>Sync jobs with stale or missing data</Subtitle>
          <div className="mt-4">
            <DataTable
              columns={[
                { key: "job_name", label: "Job" },
                { key: "health", label: "Status", align: "center" as const,
                  render: (r: R) => (
                    <StatusBadge
                      status={r.health === "ok" ? "current" : r.health === "stale" ? "warning" : "danger"}
                      label={String(r.health)}
                    />
                  )},
                { key: "hours_ago", label: "Hours Ago", align: "right" as const,
                  render: (r: R) => r.hours_ago !== null ? `${r.hours_ago}h` : "never" },
              ]}
              data={alerts.syncWarnings || []}
            />
          </div>
        </Card>
      )}
    </div>
  );
}
