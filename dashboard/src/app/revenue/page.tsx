"use client";

import { useState, useEffect } from "react";
import {
  ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  BarChart as TremorBarChart,
  Card, Metric, Text, Flex, BadgeDelta, Grid, Title, Subtitle,
} from "@tremor/react";
import { Calendar } from "lucide-react";
import DataTable from "@/components/DataTable";
import { formatCurrency } from "@/lib/format";
import { useCompanyFetch } from "@/lib/useCompanyFetch";
import { useCompany } from "@/lib/company";

/* eslint-disable @typescript-eslint/no-explicit-any */
type R = Record<string, any>;

const currencyFormatter = (v: number) => `$${(v / 1000).toFixed(0)}K`;
const pctFormatter = (v: number) => `${v}%`;

export default function RevenuePage() {
  const { companyId } = useCompany();
  const [period, setPeriod] = useState("trailing12");
  const [analyticsData, setAnalyticsData] = useState<R | null>(null);

  const pnlData = useCompanyFetch<R>("/api/pnl");

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
        <Title>Revenue &amp; P&amp;L</Title>
        <Text>Income, profitability, margins, and period comparisons</Text>
      </div>

      <Grid numItemsSm={2} numItemsLg={4} className="gap-4">
        <Card decoration="top" decorationColor="blue">
          <Text>YTD Revenue</Text>
          <Metric>{formatCurrency(Number(ytd?.revenue || 0))}</Metric>
          <Flex justifyContent="start" className="mt-2">
            <BadgeDelta
              deltaType={Number(ytd?.rev_change_pct || 0) >= 0 ? "increase" : "decrease"}
              size="sm"
            >
              {ytd?.rev_change_pct || 0}% vs prior year
            </BadgeDelta>
          </Flex>
        </Card>
        <Card decoration="top" decorationColor="emerald">
          <Text>YTD Gross Profit</Text>
          <Metric>{formatCurrency(Number(ytd?.gross_profit || 0))}</Metric>
        </Card>
        <Card decoration="top" decorationColor="cyan">
          <Text>YTD Net Income</Text>
          <Metric>{formatCurrency(Number(ytd?.net_income || 0))}</Metric>
          <Flex justifyContent="start" className="mt-2">
            <BadgeDelta
              deltaType={Number(ytd?.ni_change_pct || 0) >= 0 ? "increase" : "decrease"}
              size="sm"
            >
              {ytd?.ni_change_pct || 0}% vs prior year
            </BadgeDelta>
          </Flex>
        </Card>
        <Card decoration="top" decorationColor="amber">
          <Text>Gross Margin</Text>
          <Metric>{ytd?.margin_pct || 0}%</Metric>
        </Card>
      </Grid>

      {/* Monthly P&L */}
      <Card>
        <Title>Monthly P&amp;L</Title>
        <Subtitle>Income, COGS, and Net Income by month</Subtitle>
        <TremorBarChart
          className="mt-4 h-80"
          data={monthly.map((r: R) => ({
            month: String(r.label),
            Revenue: Number(r.income || 0),
            COGS: Number(r.cogs || 0),
            "Net Income": Number(r.net_income || 0),
          }))}
          index="month"
          categories={["Revenue", "COGS", "Net Income"]}
          colors={["blue", "rose", "emerald"]}
          valueFormatter={(v: number) => currencyFormatter(v)}
          showAnimation
          stack
        />
      </Card>

      {/* === SECTION: Period Comparisons === */}
      <div className="pt-2">
        <Title>Period Comparisons</Title>
        <Text>Quarter-over-quarter, year-over-year, and YTD analysis</Text>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* QoQ Card */}
        <Card>
          <Title>Quarter over Quarter</Title>
          <Subtitle>{`${qoq.current_label || ""} vs ${qoq.prior_label || ""}`}</Subtitle>
          <div className="space-y-4 mt-4">
            <Flex justifyContent="between" alignItems="center">
              <Text>Revenue</Text>
              <div className="text-right">
                <Metric className="text-lg">{formatCurrency(Number(qoq.current_revenue || 0))}</Metric>
                <BadgeDelta
                  deltaType={Number(qoq.revenue_change_pct || 0) >= 0 ? "increase" : "decrease"}
                  size="sm"
                >
                  {qoq.revenue_change_pct || 0}%
                </BadgeDelta>
              </div>
            </Flex>
            <Flex justifyContent="between" alignItems="center">
              <Text>Gross Profit</Text>
              <div className="text-right">
                <Metric className="text-lg">{formatCurrency(Number(qoq.current_gp || 0))}</Metric>
                <Text>prior: {formatCurrency(Number(qoq.prior_gp || 0))}</Text>
              </div>
            </Flex>
            <Flex justifyContent="between" alignItems="center">
              <Text>Margin</Text>
              <div className="text-right">
                <Metric className="text-lg">{qoq.current_margin || 0}%</Metric>
                <Text>was {qoq.prior_margin || 0}%</Text>
              </div>
            </Flex>
          </div>
        </Card>

        {/* YTD Comparison Card */}
        <Card>
          <Title>YTD vs Prior YTD</Title>
          <Subtitle>{`Jan–now ${new Date().getFullYear()} vs ${new Date().getFullYear() - 1}`}</Subtitle>
          <div className="space-y-4 mt-4">
            <Flex justifyContent="between" alignItems="center">
              <Text>Revenue</Text>
              <div className="text-right">
                <Metric className="text-lg">{formatCurrency(Number(ytdComp.ytd_revenue || 0))}</Metric>
                <BadgeDelta
                  deltaType={Number(ytdComp.rev_change_pct || 0) >= 0 ? "increase" : "decrease"}
                  size="sm"
                >
                  {ytdComp.rev_change_pct || 0}%
                </BadgeDelta>
              </div>
            </Flex>
            <Flex justifyContent="between" alignItems="center">
              <Text>Prior YTD Revenue</Text>
              <Metric className="text-lg">{formatCurrency(Number(ytdComp.prior_ytd_revenue || 0))}</Metric>
            </Flex>
            <Flex justifyContent="between" alignItems="center">
              <Text>Margin</Text>
              <div className="text-right">
                <Metric className="text-lg">{ytdComp.ytd_margin || 0}%</Metric>
                <Text>was {ytdComp.prior_ytd_margin || 0}%</Text>
              </div>
            </Flex>
          </div>
        </Card>

        {/* Quarterly Revenue Trend */}
        <Card>
          <Title>Quarterly Revenue</Title>
          <Subtitle>All quarters</Subtitle>
          <TremorBarChart
            className="mt-4 h-40"
            data={revenueByQuarter.map((r: R) => ({
              quarter: String(r.label),
              Revenue: Number(r.revenue || 0),
            }))}
            index="quarter"
            categories={["Revenue"]}
            colors={["blue"]}
            valueFormatter={(v: number) => currencyFormatter(v)}
            showAnimation
          />
        </Card>
      </div>

      {/* YoY Monthly Comparison Chart — KEEP Recharts (grouped bars) */}
      {yoy.length > 0 && (
        <Card>
          <Title>Year-over-Year Monthly Comparison</Title>
          <Subtitle>{`${new Date().getFullYear()} vs ${new Date().getFullYear() - 1} (same months)`}</Subtitle>
          <TremorBarChart
            className="mt-4 h-72"
            data={yoy.map((r: R) => ({
              month: String(r.label),
              [String(new Date().getFullYear())]: Number(r.current_revenue || 0),
              [String(new Date().getFullYear() - 1)]: Number(r.prior_revenue || 0),
            }))}
            index="month"
            categories={[String(new Date().getFullYear()), String(new Date().getFullYear() - 1)]}
            colors={["blue", "slate"]}
            valueFormatter={(v: number) => currencyFormatter(v)}
            showAnimation
          />
        </Card>
      )}

      {/* === SECTION: Revenue Analytics === */}
      <div className="pt-2 flex items-end justify-between">
        <div>
          <Title>Revenue Analytics</Title>
          <Text>Revenue breakdown by customer, product, and category</Text>
        </div>
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-muted-foreground" />
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="text-[13px] border border-border rounded px-3 py-1.5 bg-card text-foreground focus:outline-none focus:border-[#0098DB] cursor-pointer"
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
        <Card>
          <Title>Revenue by Customer</Title>
          <Subtitle>{`Top 25 — ${periodLabel}`}</Subtitle>
          <div className="mt-4">
            <DataTable
              columns={[
                { key: "customer_name", label: "Customer" },
                { key: "revenue", label: "Revenue", align: "right" as const,
                  render: (r: R) => <span className="font-semibold">{formatCurrency(Number(r.revenue))}</span> },
                { key: "margin_pct", label: "Margin", align: "right" as const,
                  render: (r: R) => (
                    <span className={Number(r.margin_pct) >= 30 ? "text-brand-success" : Number(r.margin_pct) >= 15 ? "text-brand-warning" : "text-brand-danger"}>
                      {r.margin_pct}%
                    </span>
                  )},
                { key: "invoice_count", label: "Orders", align: "right" as const },
              ]}
              data={revenueByCustomer}
              pageSize={10}
            />
          </div>
        </Card>

        <Card>
          <Title>Revenue by Product</Title>
          <Subtitle>{`Top 25 — ${periodLabel}`}</Subtitle>
          <div className="mt-4">
            <DataTable
              columns={[
                { key: "product_name", label: "Product" },
                { key: "revenue", label: "Revenue", align: "right" as const,
                  render: (r: R) => <span className="font-semibold">{formatCurrency(Number(r.revenue))}</span> },
                { key: "margin_pct", label: "Margin", align: "right" as const,
                  render: (r: R) => (
                    <span className={Number(r.margin_pct) >= 30 ? "text-brand-success" : Number(r.margin_pct) >= 15 ? "text-brand-warning" : "text-brand-danger"}>
                      {r.margin_pct}%
                    </span>
                  )},
                { key: "units_sold", label: "Units", align: "right" as const },
              ]}
              data={revenueByProduct}
              pageSize={10}
            />
          </div>
        </Card>
      </div>

      {/* === SECTION: Margin Analysis === */}
      <div className="pt-2">
        <Title>Margin Analysis</Title>
        <Text>Gross and net margin trends by period, customer, and product</Text>
      </div>

      {/* Margin Trend Charts — KEEP Recharts ComposedChart (dual axis) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <Title>Gross Margin Trend</Title>
          <Subtitle>Last 24 months</Subtitle>
          <ResponsiveContainer width="100%" height={280} className="mt-4">
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
        </Card>

        <Card>
          <Title>Net Margin Trend</Title>
          <Subtitle>Last 24 months</Subtitle>
          <ResponsiveContainer width="100%" height={280} className="mt-4">
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
        </Card>
      </div>

      {/* Margin by Customer + Product */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <Title>Margin by Customer</Title>
          <Subtitle>{`Top 15 by revenue — ${periodLabel}`}</Subtitle>
          <TremorBarChart
            className="mt-4 h-96"
            data={marginByCustomer.map((r: R) => ({
              customer: String(r.customer_name),
              "Margin %": Number(r.margin_pct || 0),
            }))}
            index="customer"
            categories={["Margin %"]}
            colors={["emerald"]}
            valueFormatter={(v: number) => pctFormatter(v)}
            layout="vertical"
            showAnimation
          />
        </Card>

        <Card>
          <Title>Margin by Product</Title>
          <Subtitle>{`Top 15 by revenue — ${periodLabel}`}</Subtitle>
          <TremorBarChart
            className="mt-4 h-96"
            data={marginByProduct.map((r: R) => ({
              product: String(r.product_name),
              "Margin %": Number(r.margin_pct || 0),
            }))}
            index="product"
            categories={["Margin %"]}
            colors={["cyan"]}
            valueFormatter={(v: number) => pctFormatter(v)}
            layout="vertical"
            showAnimation
          />
        </Card>
      </div>

      {/* P&L Detail Table */}
      <Card>
        <Title>Monthly P&amp;L Detail</Title>
        <div className="mt-4">
          <DataTable
            columns={[
              { key: "label", label: "Month" },
              { key: "income", label: "Revenue", align: "right" as const, render: (r: R) => formatCurrency(Number(r.income)) },
              { key: "cogs", label: "COGS", align: "right" as const, render: (r: R) => formatCurrency(Number(r.cogs)) },
              { key: "gross_profit", label: "Gross Profit", align: "right" as const, render: (r: R) => formatCurrency(Number(r.gross_profit)) },
              { key: "margin_pct", label: "Margin %", align: "right" as const, render: (r: R) => <span className="font-semibold">{String(r.margin_pct)}%</span> },
              { key: "net_income", label: "Net Income", align: "right" as const, render: (r: R) => (
                <span className={Number(r.net_income) >= 0 ? "text-brand-success font-semibold" : "text-brand-danger font-semibold"}>
                  {formatCurrency(Number(r.net_income))}
                </span>
              )},
            ]}
            data={[...(monthly)].reverse()}
          />
        </div>
      </Card>
    </div>
  );
}
