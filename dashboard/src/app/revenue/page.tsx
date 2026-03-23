"use client";

import { useState, useEffect } from "react";
import {
  BarChart, Bar, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ComposedChart,
} from "recharts";
import { TrendingUp, DollarSign, Percent, ArrowUpRight, ArrowDownRight, Minus, Calendar } from "lucide-react";
import KpiCard from "@/components/KpiCard";
import ChartCard from "@/components/ChartCard";
import DataTable from "@/components/DataTable";
import { formatCurrency } from "@/lib/format";
import { useCompanyFetch } from "@/lib/useCompanyFetch";
import { useCompany } from "@/lib/company";

/* eslint-disable @typescript-eslint/no-explicit-any */
type R = Record<string, any>;

function ChangeIndicator({ value, suffix = "%" }: { value: number; suffix?: string }) {
  if (value > 0) return <span className="text-[#137333] text-[12px] font-medium">+{value}{suffix}</span>;
  if (value < 0) return <span className="text-[#C5221F] text-[12px] font-medium">{value}{suffix}</span>;
  return <span className="text-[#5F6368] text-[12px]">0{suffix}</span>;
}

export default function RevenuePage() {
  const { companyId } = useCompany();
  const [period, setPeriod] = useState("trailing12");
  const [analyticsData, setAnalyticsData] = useState<R | null>(null);

  const pnlData = useCompanyFetch<R>("/api/pnl");

  // Fetch analytics with period param
  useEffect(() => {
    setAnalyticsData(null);
    fetch(`/api/revenue-analytics?company_id=${encodeURIComponent(companyId)}&period=${encodeURIComponent(period)}`)
      .then((r) => r.json())
      .then((d) => { if (!d.error) setAnalyticsData(d); })
      .catch(() => {});
  }, [companyId, period]);

  const monthly = (pnlData?.monthly as R[]) || [];
  const ytd = (pnlData?.ytd as R) || {};
  const a = analyticsData || {};

  const revenueByCustomer = (a.revenueByCustomer as R[]) || [];
  const revenueByProduct = (a.revenueByProduct as R[]) || [];
  const revenueByQuarter = (a.revenueByQuarter as R[]) || [];
  const qoq = (a.qoq as R) || {};
  const yoy = (a.yoy as R[]) || [];
  const ytdComp = (a.ytdComparison as R) || {};
  const marginByMonth = (a.marginByMonth as R[]) || [];
  const marginByCustomer = (a.marginByCustomer as R[]) || [];
  const marginByProduct = (a.marginByProduct as R[]) || [];
  const availablePeriods = (a.availablePeriods as R[]) || [];
  const periodLabel = (a.periodLabel as string) || "Last 12 months";

  return (
    <div className="space-y-8">
      {/* === SECTION: P&L Summary === */}
      <div>
        <h1 className="text-xl font-semibold text-[#1A1A1A]">Revenue & P&L</h1>
        <p className="text-[12px] text-[#5F6368] mt-0.5">Income, profitability, margins, and period comparisons</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="YTD Revenue" value={formatCurrency(Number(ytd?.revenue || 0))}
          change={`${ytd?.rev_change_pct || 0}% vs prior year`}
          changeType={Number(ytd?.rev_change_pct || 0) >= 0 ? "positive" : "negative"} icon={DollarSign} />
        <KpiCard label="YTD Gross Profit" value={formatCurrency(Number(ytd?.gross_profit || 0))} icon={TrendingUp} />
        <KpiCard label="YTD Net Income" value={formatCurrency(Number(ytd?.net_income || 0))}
          change={`${ytd?.ni_change_pct || 0}% vs prior year`}
          changeType={Number(ytd?.ni_change_pct || 0) >= 0 ? "positive" : "negative"} icon={ArrowUpRight} />
        <KpiCard label="Gross Margin" value={`${ytd?.margin_pct || 0}%`} icon={Percent} />
      </div>

      {/* Monthly P&L */}
      <ChartCard title="Monthly P&L" subtitle="Income, COGS, and Net Income by month">
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={monthly}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <Legend />
            <Bar dataKey="income" name="Revenue" fill="#003A5C" radius={[1, 1, 0, 0]} />
            <Bar dataKey="cogs" name="COGS" fill="#C5221F" radius={[1, 1, 0, 0]} />
            <Bar dataKey="net_income" name="Net Income" fill="#137333" radius={[1, 1, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* === SECTION: Period Comparisons === */}
      <div className="pt-2">
        <h2 className="text-lg font-semibold text-[#1A1A1A]">Period Comparisons</h2>
        <p className="text-[12px] text-[#5F6368] mt-0.5">Quarter-over-quarter, year-over-year, and YTD analysis</p>
      </div>

      {/* QoQ + YTD Comparison Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* QoQ Card */}
        <ChartCard title="Quarter over Quarter" subtitle={`${qoq.current_label || ''} vs ${qoq.prior_label || ''}`}>
          <div className="space-y-4 px-2 py-3">
            <div className="flex justify-between items-center">
              <span className="text-[12px] text-[#5F6368]">Revenue</span>
              <div className="text-right">
                <div className="text-[15px] font-semibold">{formatCurrency(Number(qoq.current_revenue || 0))}</div>
                <ChangeIndicator value={Number(qoq.revenue_change_pct || 0)} />
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[12px] text-[#5F6368]">Gross Profit</span>
              <div className="text-right">
                <div className="text-[15px] font-semibold">{formatCurrency(Number(qoq.current_gp || 0))}</div>
                <span className="text-[12px] text-[#5F6368]">prior: {formatCurrency(Number(qoq.prior_gp || 0))}</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[12px] text-[#5F6368]">Margin</span>
              <div className="text-right">
                <span className="text-[15px] font-semibold">{qoq.current_margin || 0}%</span>
                <span className="text-[12px] text-[#5F6368] ml-2">was {qoq.prior_margin || 0}%</span>
              </div>
            </div>
          </div>
        </ChartCard>

        {/* YTD Comparison Card */}
        <ChartCard title="YTD vs Prior YTD" subtitle={`Jan–now ${new Date().getFullYear()} vs ${new Date().getFullYear() - 1}`}>
          <div className="space-y-4 px-2 py-3">
            <div className="flex justify-between items-center">
              <span className="text-[12px] text-[#5F6368]">Revenue</span>
              <div className="text-right">
                <div className="text-[15px] font-semibold">{formatCurrency(Number(ytdComp.ytd_revenue || 0))}</div>
                <ChangeIndicator value={Number(ytdComp.rev_change_pct || 0)} />
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[12px] text-[#5F6368]">Prior YTD Revenue</span>
              <div className="text-[15px] font-semibold">{formatCurrency(Number(ytdComp.prior_ytd_revenue || 0))}</div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[12px] text-[#5F6368]">Margin</span>
              <div className="text-right">
                <span className="text-[15px] font-semibold">{ytdComp.ytd_margin || 0}%</span>
                <span className="text-[12px] text-[#5F6368] ml-2">was {ytdComp.prior_ytd_margin || 0}%</span>
              </div>
            </div>
          </div>
        </ChartCard>

        {/* Quarterly Revenue Trend */}
        <ChartCard title="Quarterly Revenue" subtitle="All quarters">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={revenueByQuarter}>
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="revenue" fill="#003A5C" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* YoY Monthly Comparison Chart */}
      {yoy.length > 0 && (
        <ChartCard title="Year-over-Year Monthly Comparison"
          subtitle={`${new Date().getFullYear()} vs ${new Date().getFullYear() - 1} (same months)`}>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={yoy}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend />
              <Bar dataKey="current_revenue" name={`${new Date().getFullYear()}`} fill="#003A5C" radius={[2, 2, 0, 0]} />
              <Bar dataKey="prior_revenue" name={`${new Date().getFullYear() - 1}`} fill="#003A5C" fillOpacity={0.25} radius={[2, 2, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* === SECTION: Revenue Analytics === */}
      <div className="pt-2 flex items-end justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#1A1A1A]">Revenue Analytics</h2>
          <p className="text-[12px] text-[#5F6368] mt-0.5">Revenue breakdown by customer, product, and category</p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-[#5F6368]" />
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="text-[13px] border border-[#E0E0E0] rounded px-3 py-1.5 bg-white text-[#1A1A1A] focus:outline-none focus:border-[#0098DB] cursor-pointer"
          >
            <optgroup label="Trailing">
              <option value="trailing6">Last 6 months</option>
              <option value="trailing12">Last 12 months</option>
              <option value="trailing24">Last 24 months</option>
            </optgroup>
            <optgroup label="Quarters (closed)">
              {availablePeriods
                .filter((p: R) => p.value !== `${new Date().getFullYear()}Q${Math.ceil((new Date().getMonth() + 1) / 3)}`)
                .map((p: R) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
            </optgroup>
            <optgroup label="Full Year">
              {[...new Set(availablePeriods.map((p: R) => String(p.value).substring(0, 4)))]
                .filter((y) => parseInt(y) < new Date().getFullYear())
                .map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
            </optgroup>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Customer */}
        <ChartCard title="Revenue by Customer" subtitle="Top 25 — {periodLabel}">
          <DataTable
            columns={[
              { key: "customer_name", label: "Customer" },
              { key: "revenue", label: "Revenue", align: "right" as const,
                render: (r: R) => <span className="font-semibold">{formatCurrency(Number(r.revenue))}</span> },
              { key: "margin_pct", label: "Margin", align: "right" as const,
                render: (r: R) => (
                  <span className={Number(r.margin_pct) >= 30 ? "text-[#137333]" : Number(r.margin_pct) >= 15 ? "text-[#E37400]" : "text-[#C5221F]"}>
                    {r.margin_pct}%
                  </span>
                )},
              { key: "invoice_count", label: "Orders", align: "right" as const },
            ]}
            data={revenueByCustomer}
            pageSize={10}
          />
        </ChartCard>

        {/* Revenue by Product */}
        <ChartCard title="Revenue by Product" subtitle="Top 25 — {periodLabel}">
          <DataTable
            columns={[
              { key: "product_name", label: "Product" },
              { key: "revenue", label: "Revenue", align: "right" as const,
                render: (r: R) => <span className="font-semibold">{formatCurrency(Number(r.revenue))}</span> },
              { key: "margin_pct", label: "Margin", align: "right" as const,
                render: (r: R) => (
                  <span className={Number(r.margin_pct) >= 30 ? "text-[#137333]" : Number(r.margin_pct) >= 15 ? "text-[#E37400]" : "text-[#C5221F]"}>
                    {r.margin_pct}%
                  </span>
                )},
              { key: "units_sold", label: "Units", align: "right" as const },
            ]}
            data={revenueByProduct}
            pageSize={10}
          />
        </ChartCard>
      </div>

      {/* === SECTION: Margin Analysis === */}
      <div className="pt-2">
        <h2 className="text-lg font-semibold text-[#1A1A1A]">Margin Analysis</h2>
        <p className="text-[12px] text-[#5F6368] mt-0.5">Gross and net margin trends by period, customer, and product</p>
      </div>

      {/* Margin Trend Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Gross Margin Trend" subtitle="Last 24 months">
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={marginByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="pct" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} domain={[0, 60]} />
              <YAxis yAxisId="rev" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(v: number, name: string) => name.includes("%") ? `${v}%` : formatCurrency(v)} />
              <Legend />
              <Bar yAxisId="rev" dataKey="revenue" name="Revenue" fill="#003A5C" fillOpacity={0.15} radius={[1, 1, 0, 0]} />
              <Line yAxisId="pct" type="monotone" dataKey="gross_margin_pct" name="Gross Margin %" stroke="#137333" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Net Margin Trend" subtitle="Last 24 months">
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={marginByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="pct" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} domain={[0, 60]} />
              <YAxis yAxisId="rev" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(v: number, name: string) => name.includes("%") ? `${v}%` : formatCurrency(v)} />
              <Legend />
              <Bar yAxisId="rev" dataKey="revenue" name="Revenue" fill="#003A5C" fillOpacity={0.15} radius={[1, 1, 0, 0]} />
              <Line yAxisId="pct" type="monotone" dataKey="net_margin_pct" name="Net Margin %" stroke="#0098DB" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Margin by Customer + Product */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Margin by Customer" subtitle="Top 15 by revenue — {periodLabel}">
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={marginByCustomer} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
              <YAxis type="category" dataKey="customer_name" tick={{ fontSize: 10 }} width={160} />
              <Tooltip formatter={(v: number) => `${v}%`} />
              <Bar dataKey="margin_pct" name="Margin %" fill="#137333" radius={[0, 2, 2, 0]}
                label={{ position: "right", fontSize: 10, formatter: (v: number) => `${v}%` }} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Margin by Product" subtitle="Top 15 by revenue — {periodLabel}">
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={marginByProduct} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
              <YAxis type="category" dataKey="product_name" tick={{ fontSize: 10 }} width={160} />
              <Tooltip formatter={(v: number) => `${v}%`} />
              <Bar dataKey="margin_pct" name="Margin %" fill="#0098DB" radius={[0, 2, 2, 0]}
                label={{ position: "right", fontSize: 10, formatter: (v: number) => `${v}%` }} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* P&L Detail Table */}
      <ChartCard title="Monthly P&L Detail">
        <DataTable
          columns={[
            { key: "label", label: "Month" },
            { key: "income", label: "Revenue", align: "right" as const, render: (r: R) => formatCurrency(Number(r.income)) },
            { key: "cogs", label: "COGS", align: "right" as const, render: (r: R) => formatCurrency(Number(r.cogs)) },
            { key: "gross_profit", label: "Gross Profit", align: "right" as const, render: (r: R) => formatCurrency(Number(r.gross_profit)) },
            { key: "margin_pct", label: "Margin %", align: "right" as const, render: (r: R) => <span className="font-semibold">{String(r.margin_pct)}%</span> },
            { key: "net_income", label: "Net Income", align: "right" as const, render: (r: R) => (
              <span className={Number(r.net_income) >= 0 ? "text-[#137333] font-semibold" : "text-[#C5221F] font-semibold"}>
                {formatCurrency(Number(r.net_income))}
              </span>
            )},
          ]}
          data={[...(monthly)].reverse()}
        />
      </ChartCard>
    </div>
  );
}
