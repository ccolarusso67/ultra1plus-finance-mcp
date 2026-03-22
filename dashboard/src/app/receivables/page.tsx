"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { FileText, AlertTriangle, Clock, CreditCard } from "lucide-react";
import KpiCard from "@/components/KpiCard";
import ChartCard from "@/components/ChartCard";
import DataTable from "@/components/DataTable";
import StatusBadge from "@/components/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/format";
import { useCompanyFetch } from "@/lib/useCompanyFetch";

export default function ReceivablesPage() {
  const data = useCompanyFetch<Record<string, unknown>>("/api/ar-aging");

  if (!data) {
    return <div className="flex items-center justify-center h-96"><div className="text-[#5F6368]">Loading...</div></div>;
  }

  const { aging, openInvoices, creditHolds, totals } = data as {
    aging: Record<string, unknown>[];
    openInvoices: Record<string, unknown>[];
    creditHolds: Record<string, unknown>[];
    totals: Record<string, unknown>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#1A1A1A]">Accounts Receivable</h1>
        <p className="text-[12px] text-[#5F6368] mt-0.5">AR aging, open invoices, and credit status</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total AR" value={formatCurrency(Number(totals?.total_ar || 0))} icon={FileText} />
        <KpiCard
          label="Overdue (31+ days)"
          value={formatCurrency(Number(totals?.overdue_ar || 0))}
          changeType="negative"
          icon={AlertTriangle}
        />
        <KpiCard label="Open Invoices" value={String(openInvoices.length)} icon={Clock} />
        <KpiCard
          label="Over Credit Limit"
          value={String(totals?.over_credit_count || 0)}
          changeType={Number(totals?.over_credit_count || 0) > 0 ? "negative" : "positive"}
          icon={CreditCard}
        />
      </div>

      {/* AR Aging Stacked Bar */}
      <ChartCard title="AR Aging by Customer">
        <ResponsiveContainer width="100%" height={Math.max(300, aging.length * 35)}>
          <BarChart data={aging} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
            <YAxis type="category" dataKey="customer_name" tick={{ fontSize: 11 }} width={170} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <Legend />
            <Bar dataKey="current_bucket" name="Current" stackId="a" fill="#137333" />
            <Bar dataKey="days_1_30" name="1-30" stackId="a" fill="#0098DB" />
            <Bar dataKey="days_31_60" name="31-60" stackId="a" fill="#E37400" />
            <Bar dataKey="days_61_90" name="61-90" stackId="a" fill="#C5221F" />
            <Bar dataKey="days_91_plus" name="91+" stackId="a" fill="#7F1D1D" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Open Invoices */}
      <ChartCard title="Open Invoices">
        <DataTable
          columns={[
            { key: "ref_number", label: "Invoice #" },
            { key: "customer_name", label: "Customer" },
            { key: "txn_date", label: "Date", render: (r) => formatDate(String(r.txn_date)) },
            { key: "due_date", label: "Due", render: (r) => formatDate(String(r.due_date)) },
            { key: "amount", label: "Amount", align: "right", render: (r) => formatCurrency(Number(r.amount)) },
            { key: "balance_remaining", label: "Balance", align: "right", render: (r) => (
              <span className="font-semibold">{formatCurrency(Number(r.balance_remaining))}</span>
            )},
            { key: "days_past_due", label: "Days Past Due", align: "right", render: (r) => {
              const days = Number(r.days_past_due);
              if (days <= 0) return <StatusBadge status="current" label="Current" />;
              if (days <= 30) return <StatusBadge status="warning" label={`${days} days`} />;
              return <StatusBadge status="danger" label={`${days} days`} />;
            }},
          ]}
          data={openInvoices}
        />
      </ChartCard>

      {/* Credit Holds */}
      {creditHolds.length > 0 && (
        <ChartCard title="Customers Over Credit Limit" subtitle="These accounts should be reviewed before shipping">
          <DataTable
            columns={[
              { key: "customer_name", label: "Customer" },
              { key: "credit_limit", label: "Credit Limit", align: "right", render: (r) => formatCurrency(Number(r.credit_limit)) },
              { key: "balance", label: "Balance", align: "right", render: (r) => (
                <span className="text-[#C5221F] font-semibold">{formatCurrency(Number(r.balance))}</span>
              )},
              { key: "available_credit", label: "Available", align: "right", render: (r) => (
                <span className="text-[#C5221F]">{formatCurrency(Number(r.available_credit))}</span>
              )},
            ]}
            data={creditHolds}
          />
        </ChartCard>
      )}
    </div>
  );
}
