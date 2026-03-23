"use client";

import { useState, useEffect } from "react";
import {
  BarChart, Bar, AreaChart, Area, ComposedChart, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import {
  ArrowDownLeft, ArrowUpRight, Banknote, CreditCard,
  AlertTriangle, ShieldAlert, Activity, TrendingUp, Calendar,
  ClipboardList,
} from "lucide-react";
import KpiCard from "@/components/KpiCard";
import ChartCard from "@/components/ChartCard";
import DataTable from "@/components/DataTable";
import StatusBadge from "@/components/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/format";
import { useCompany } from "@/lib/company";

/* eslint-disable @typescript-eslint/no-explicit-any */
type R = Record<string, any>;

const AGING_COLORS = ["#137333", "#0098DB", "#E37400", "#C5221F", "#7F1D1D"];

function RiskBadge({ level }: { level: string }) {
  const colors: R = {
    critical: "bg-[#C5221F] text-white",
    high: "bg-[#E37400] text-white",
    medium: "bg-[#FDE293] text-[#7F6000]",
    low: "bg-[#E6F4EA] text-[#137333]",
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
      <AlertTriangle size={16} className="text-[#C5221F] mt-0.5 shrink-0" />
      <div>
        <p className="text-[13px] font-semibold text-[#C5221F]">{title}</p>
        <p className="text-[12px] text-[#5F6368] mt-0.5">{message}</p>
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
    return <div className="flex items-center justify-center h-96"><div className="text-[#5F6368]">Loading...</div></div>;
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
          <h1 className="text-xl font-semibold text-[#1A1A1A]">Operational Cash</h1>
          <p className="text-[12px] text-[#5F6368] mt-0.5">
            Cash pressure, collections, obligations, and short-term liquidity
            <span className="ml-2 text-[10px] bg-[#FDE293] text-[#7F6000] px-1.5 py-0.5 rounded">Operational view — not a formal cash flow statement</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-[#5F6368]" />
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}
            className="text-[13px] border border-[#E0E0E0] rounded px-3 py-1.5 bg-white text-[#1A1A1A] focus:outline-none focus:border-[#0098DB] cursor-pointer">
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-10 gap-3">
        <KpiCard label="Cash In (7d)" value={formatCurrency(Number(k.cash_in_7d || 0))} icon={ArrowDownLeft} changeType="positive" />
        <KpiCard label="Cash In (30d)" value={formatCurrency(Number(k.cash_in_30d || 0))} icon={ArrowDownLeft} changeType="positive" />
        <KpiCard label="Bills Due (7d)" value={formatCurrency(Number(k.bills_due_7d || 0))} icon={ArrowUpRight} changeType="negative" />
        <KpiCard label="Bills Due (30d)" value={formatCurrency(Number(k.bills_due_30d || 0))} icon={ArrowUpRight} changeType="negative" />
        <KpiCard label="Net Pressure (30d)" value={formatCurrency(Number(k.net_cash_pressure_30d || 0))}
          changeType={Number(k.net_cash_pressure_30d || 0) >= 0 ? "positive" : "negative"} icon={TrendingUp} />
        <KpiCard label="Open AR" value={formatCurrency(Number(k.open_ar || 0))} icon={Banknote} />
        <KpiCard label="Open AP" value={formatCurrency(Number(k.open_ap || 0))} icon={CreditCard} />
        <KpiCard label="Backlog" value={formatCurrency(Number(k.backlog_value || 0))} icon={ClipboardList} />
        <KpiCard label="AR > 90d" value={formatCurrency(Number(k.ar_over_90 || 0))} icon={AlertTriangle}
          changeType={Number(k.ar_over_90 || 0) > 100000 ? "negative" : undefined} />
        <KpiCard label="AP > 90d" value={formatCurrency(Number(k.ap_over_90 || 0))} icon={ShieldAlert}
          changeType={Number(k.ap_over_90 || 0) > 100000 ? "negative" : undefined} />
      </div>

      {/* Coverage Ratio */}
      <div className={`rounded-lg border px-6 py-4 flex items-center justify-between ${
        coverageType === "positive" ? "bg-[#E6F4EA] border-[#137333]/20" :
        coverageType === "neutral" ? "bg-[#FEF7E0] border-[#E37400]/20" :
        "bg-[#FCE8E6] border-[#C5221F]/20"
      }`}>
        <div>
          <span className="text-[12px] font-medium text-[#5F6368] uppercase tracking-wider">30-Day Coverage Ratio</span>
          <p className="text-[11px] text-[#5F6368] mt-0.5">Cash In (30d) ÷ Bills Due (30d)</p>
        </div>
        <div className="text-right">
          <span className={`text-2xl font-bold ${
            coverageType === "positive" ? "text-[#137333]" :
            coverageType === "neutral" ? "text-[#E37400]" : "text-[#C5221F]"
          }`}>{coverageRatio !== null && coverageRatio !== undefined ? `${coverageRatio}x` : "N/A"}</span>
          <p className="text-[11px] text-[#5F6368]">
            {coverageRatio >= 1.5 ? "Healthy" : coverageRatio >= 1 ? "Tight" : coverageRatio !== null ? "Under pressure" : ""}
          </p>
        </div>
      </div>

      {/* === COLLECTIONS === */}
      <div className="pt-2">
        <h2 className="text-lg font-semibold text-[#1A1A1A]">Collections</h2>
        <p className="text-[12px] text-[#5F6368] mt-0.5">Cash inflows, payment trends, and receivable aging</p>
      </div>

      <ChartCard title="Daily Collections" subtitle={`Last ${days} days`}>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={c.daily || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
            <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={Math.max(Math.floor((c.daily || []).length / 15), 1)} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <Bar dataKey="amount" fill="#137333" radius={[1, 1, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Top Paying Customers" subtitle="Last 30 days">
          <DataTable
            columns={[
              { key: "customer_name", label: "Customer" },
              { key: "total_paid", label: "Collected", align: "right" as const,
                render: (r: R) => <span className="font-semibold text-[#137333]">{formatCurrency(Number(r.total_paid))}</span> },
              { key: "payment_count", label: "#", align: "right" as const },
            ]}
            data={c.topCustomers || []}
            pageSize={8}
          />
        </ChartCard>

        <ChartCard title="AR Aging" subtitle={`Total: ${formatCurrency(Number(arBuckets.total || 0))}`}>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="45%" height={200}>
              <PieChart>
                <Pie data={arPieData} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2}>
                  {arPieData.map((_, i) => <Cell key={i} fill={AGING_COLORS[i]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 text-[12px]">
              {["Current", "1-30d", "31-60d", "61-90d", "91+d"].map((label, i) => {
                const keys = ["current", "days_1_30", "days_31_60", "days_61_90", "days_91_plus"];
                return (
                  <div key={label} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: AGING_COLORS[i] }} />
                    <span className="text-[#5F6368] w-12">{label}</span>
                    <span className="font-medium">{formatCurrency(Number(arBuckets[keys[i]] || 0))}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="AR Concentration" subtitle={`Top 10 = ${c.top10ArPct || 0}% of total AR`}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={c.concentration || []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
              <YAxis type="category" dataKey="customer_name" tick={{ fontSize: 10 }} width={150} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="balance" fill="#003A5C" radius={[0, 2, 2, 0]}
                label={{ position: "right", fontSize: 9, formatter: (v: number) => `${((c.concentration || []).find((r: R) => r.balance === v) || {}).pct_of_total || ''}%` }} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Largest Overdue Invoices" subtitle="Past due, by balance">
          <DataTable
            columns={[
              { key: "customer_name", label: "Customer" },
              { key: "balance_remaining", label: "Balance", align: "right" as const,
                render: (r: R) => <span className="font-semibold text-[#C5221F]">{formatCurrency(Number(r.balance_remaining))}</span> },
              { key: "days_past_due", label: "Days", align: "right" as const,
                render: (r: R) => {
                  const d = Number(r.days_past_due);
                  return <span className={d > 90 ? "text-[#C5221F] font-bold" : d > 30 ? "text-[#E37400] font-medium" : ""}>{d}</span>;
                }},
            ]}
            data={c.largestOverdue || []}
            pageSize={8}
          />
        </ChartCard>
      </div>

      {/* === PAYABLES === */}
      <div className="pt-2">
        <h2 className="text-lg font-semibold text-[#1A1A1A]">Payables & Obligations</h2>
        <p className="text-[12px] text-[#5F6368] mt-0.5">Upcoming bills, vendor exposure, and payment calendar</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Upcoming Bills" subtitle="Next 8 weeks by due date">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={p.timeline || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="amount" fill="#C5221F" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="AP Aging" subtitle={`Total: ${formatCurrency(Number(apBuckets.total || 0))}`}>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="45%" height={200}>
              <PieChart>
                <Pie data={apPieData} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2}>
                  {apPieData.map((_, i) => <Cell key={i} fill={AGING_COLORS[i]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 text-[12px]">
              {["Current", "1-30d", "31-60d", "61-90d", "91+d"].map((label, i) => {
                const keys = ["current", "days_1_30", "days_31_60", "days_61_90", "days_91_plus"];
                return (
                  <div key={label} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: AGING_COLORS[i] }} />
                    <span className="text-[#5F6368] w-12">{label}</span>
                    <span className="font-medium">{formatCurrency(Number(apBuckets[keys[i]] || 0))}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="AP Concentration" subtitle={`Top 10 = ${p.top10ApPct || 0}% of total AP`}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={p.concentration || []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
              <YAxis type="category" dataKey="vendor_name" tick={{ fontSize: 10 }} width={180} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="balance" fill="#C5221F" radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Largest Unpaid Vendors" subtitle="By outstanding balance">
          <DataTable
            columns={[
              { key: "vendor_name", label: "Vendor" },
              { key: "balance", label: "Balance", align: "right" as const,
                render: (r: R) => <span className="font-semibold">{formatCurrency(Number(r.balance))}</span> },
              { key: "days_91_plus", label: ">90d", align: "right" as const,
                render: (r: R) => Number(r.days_91_plus) > 0
                  ? <span className="text-[#C5221F] font-medium">{formatCurrency(Number(r.days_91_plus))}</span>
                  : <span className="text-[#5F6368]">$0</span> },
            ]}
            data={p.largestVendors || []}
            pageSize={10}
          />
        </ChartCard>
      </div>

      {/* === LIQUIDITY === */}
      <div className="pt-2">
        <h2 className="text-lg font-semibold text-[#1A1A1A]">Liquidity & Pressure</h2>
        <p className="text-[12px] text-[#5F6368] mt-0.5">Collections vs obligations, operating cash trends</p>
      </div>

      <ChartCard title="Collections vs Obligations" subtitle="Monthly, last 12 months">
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={l.collectionsVsObligations || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <Legend />
            <Bar dataKey="collections" name="Cash In" fill="#137333" radius={[2, 2, 0, 0]} />
            <Bar dataKey="obligations" name="Bills Due" fill="#C5221F" fillOpacity={0.7} radius={[2, 2, 0, 0]} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Monthly trends: collections, invoicing, bills */}
      <ChartCard title="Operating Cash Trends" subtitle="Collections, invoicing, and bills — last 12 months">
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={l.monthlyTrends || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <Legend />
            <Line type="monotone" dataKey="collections" name="Collections" stroke="#137333" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="invoiced" name="Invoiced" stroke="#003A5C" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="billed" name="Bills" stroke="#C5221F" strokeWidth={2} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* === BACKLOG === */}
      <div className="pt-2">
        <h2 className="text-lg font-semibold text-[#1A1A1A]">Backlog & Conversion</h2>
        <p className="text-[12px] text-[#5F6368] mt-0.5">Open orders, invoicing pipeline, and order-to-cash conversion</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Backlog by Customer" subtitle={`Total: ${formatCurrency(Number(k.backlog_value || 0))}`}>
          {(bl.byCustomer || []).length === 0 ? (
            <p className="text-[13px] text-[#5F6368] py-8 text-center">No open sales orders</p>
          ) : (
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
          )}
        </ChartCard>

        <ChartCard title="Monthly Invoicing" subtitle="Invoice volume and value, last 12 months">
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={bl.invoicingTrend || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="amt" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
              <YAxis yAxisId="cnt" orientation="right" tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number, name: string) => name === "Count" ? v : formatCurrency(v)} />
              <Legend />
              <Bar yAxisId="amt" dataKey="invoiced" name="Invoiced" fill="#003A5C" radius={[2, 2, 0, 0]} />
              <Line yAxisId="cnt" type="monotone" dataKey="count" name="Count" stroke="#0098DB" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* === RISK & ALERTS === */}
      <div className="pt-2">
        <h2 className="text-lg font-semibold text-[#1A1A1A]">Risk & Alerts</h2>
        <p className="text-[12px] text-[#5F6368] mt-0.5">Overdue exposures, risk flags, and data freshness</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="High-Risk Customers" subtitle="Large overdue balances">
          {(alerts.riskCustomers || []).length === 0 ? (
            <p className="text-[13px] text-[#137333] py-4 text-center">No high-risk customers</p>
          ) : (
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
          )}
        </ChartCard>

        <ChartCard title="High-Risk Vendors" subtitle="Significant unpaid obligations">
          {(alerts.riskVendors || []).length === 0 ? (
            <p className="text-[13px] text-[#137333] py-4 text-center">No high-risk vendors</p>
          ) : (
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
          )}
        </ChartCard>
      </div>

      {(alerts.syncWarnings || []).length > 0 && (
        <ChartCard title="Data Freshness Warnings" subtitle="Sync jobs with stale or missing data">
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
        </ChartCard>
      )}
    </div>
  );
}
