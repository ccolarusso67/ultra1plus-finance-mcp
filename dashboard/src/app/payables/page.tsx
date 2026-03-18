"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { CreditCard, AlertTriangle, Calendar, Clock } from "lucide-react";
import KpiCard from "@/components/KpiCard";
import ChartCard from "@/components/ChartCard";
import DataTable from "@/components/DataTable";
import StatusBadge from "@/components/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/format";

export default function PayablesPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    fetch("/api/ap-aging").then((r) => r.json()).then((d) => { if (!d.error) setData(d); }).catch(() => {});
  }, []);

  if (!data) {
    return <div className="flex items-center justify-center h-96"><div className="text-[#5F6368]">Loading...</div></div>;
  }

  const { aging, openBills, totals } = data as {
    aging: Record<string, unknown>[];
    openBills: Record<string, unknown>[];
    totals: Record<string, unknown>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#1A1A1A]">Accounts Payable</h1>
        <p className="text-[12px] text-[#5F6368] mt-0.5">AP aging, open bills, and payment schedule</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total AP" value={formatCurrency(Number(totals?.total_ap || 0))} icon={CreditCard} />
        <KpiCard
          label="Overdue"
          value={formatCurrency(Number(totals?.overdue_ap || 0))}
          changeType={Number(totals?.overdue_ap || 0) > 0 ? "negative" : "positive"}
          icon={AlertTriangle}
        />
        <KpiCard label="Due This Week" value={String(totals?.due_this_week || 0)} icon={Calendar} />
        <KpiCard label="Due Next Week" value={String(totals?.due_next_week || 0)} icon={Clock} />
      </div>

      {/* AP Aging */}
      <ChartCard title="AP Aging by Vendor">
        <ResponsiveContainer width="100%" height={Math.max(250, aging.length * 40)}>
          <BarChart data={aging} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
            <YAxis type="category" dataKey="vendor_name" tick={{ fontSize: 11 }} width={170} />
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

      {/* Open Bills */}
      <ChartCard title="Open Bills">
        <DataTable
          columns={[
            { key: "vendor_name", label: "Vendor" },
            { key: "ref_number", label: "Ref #" },
            { key: "txn_date", label: "Date", render: (r) => formatDate(String(r.txn_date)) },
            { key: "due_date", label: "Due", render: (r) => formatDate(String(r.due_date)) },
            { key: "amount", label: "Amount", align: "right", render: (r) => formatCurrency(Number(r.amount)) },
            { key: "balance_remaining", label: "Balance", align: "right", render: (r) => (
              <span className="font-semibold">{formatCurrency(Number(r.balance_remaining))}</span>
            )},
            { key: "is_overdue", label: "Status", render: (r) => (
              r.is_overdue
                ? <StatusBadge status="danger" label={`${String(r.days_past_due)}d overdue`} />
                : <StatusBadge status="current" label="Current" />
            )},
          ]}
          data={openBills}
        />
      </ChartCard>
    </div>
  );
}
