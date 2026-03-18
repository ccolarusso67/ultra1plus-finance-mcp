"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { TrendingUp, DollarSign, Percent, ArrowUpRight } from "lucide-react";
import KpiCard from "@/components/KpiCard";
import ChartCard from "@/components/ChartCard";
import DataTable from "@/components/DataTable";
import { formatCurrency } from "@/lib/format";

export default function RevenuePage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    fetch("/api/pnl").then((r) => r.json()).then((d) => { if (!d.error) setData(d); }).catch(() => {});
  }, []);

  const monthly = (data as Record<string, unknown>)?.monthly as Record<string, unknown>[] || [];
  const ytd = (data as Record<string, unknown>)?.ytd as Record<string, unknown> || {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#1A1A1A]">Revenue & P&L</h1>
        <p className="text-[12px] text-[#5F6368] mt-0.5">Income, profitability, and expense trends</p>
      </div>

      {/* YTD KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="YTD Revenue"
          value={formatCurrency(Number(ytd?.revenue || 0))}
          change={`${ytd?.rev_change_pct || 0}% vs prior year`}
          changeType={Number(ytd?.rev_change_pct || 0) >= 0 ? "positive" : "negative"}
          icon={DollarSign}
        />
        <KpiCard
          label="YTD Gross Profit"
          value={formatCurrency(Number(ytd?.gross_profit || 0))}
          icon={TrendingUp}
        />
        <KpiCard
          label="YTD Net Income"
          value={formatCurrency(Number(ytd?.net_income || 0))}
          change={`${ytd?.ni_change_pct || 0}% vs prior year`}
          changeType={Number(ytd?.ni_change_pct || 0) >= 0 ? "positive" : "negative"}
          icon={ArrowUpRight}
        />
        <KpiCard
          label="Gross Margin"
          value={`${ytd?.margin_pct || 0}%`}
          icon={Percent}
        />
      </div>

      {/* Monthly P&L Bar Chart */}
      <ChartCard title="Monthly P&L" subtitle="Income, COGS, and Net Income by month">
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={monthly as Record<string, unknown>[]}>
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

      {/* Revenue vs COGS trend + Margin trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Revenue vs COGS" subtitle="Monthly comparison">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={monthly as Record<string, unknown>[]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend />
              <Area type="monotone" dataKey="income" name="Revenue" stroke="#003A5C" fill="#003A5C" fillOpacity={0.1} />
              <Area type="monotone" dataKey="cogs" name="COGS" stroke="#C5221F" fill="#C5221F" fillOpacity={0.06} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Gross Margin %" subtitle="Monthly trend">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthly as Record<string, unknown>[]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} domain={[0, 50]} />
              <Tooltip formatter={(v: number) => `${v}%`} />
              <Line type="monotone" dataKey="margin_pct" stroke="#137333" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* P&L Table */}
      <ChartCard title="Monthly P&L Detail">
        <DataTable
          columns={[
            { key: "label", label: "Month" },
            { key: "income", label: "Revenue", align: "right", render: (r) => formatCurrency(Number(r.income)) },
            { key: "cogs", label: "COGS", align: "right", render: (r) => formatCurrency(Number(r.cogs)) },
            { key: "gross_profit", label: "Gross Profit", align: "right", render: (r) => formatCurrency(Number(r.gross_profit)) },
            { key: "margin_pct", label: "Margin %", align: "right", render: (r) => <span className="font-semibold">{String(r.margin_pct)}%</span> },
            { key: "operating_expenses", label: "OpEx", align: "right", render: (r) => formatCurrency(Number(r.operating_expenses)) },
            { key: "net_income", label: "Net Income", align: "right", render: (r) => (
              <span className={Number(r.net_income) >= 0 ? "text-[#137333] font-semibold" : "text-[#C5221F] font-semibold"}>
                {formatCurrency(Number(r.net_income))}
              </span>
            )},
          ]}
          data={[...(monthly as Record<string, unknown>[])].reverse()}
        />
      </ChartCard>
    </div>
  );
}
