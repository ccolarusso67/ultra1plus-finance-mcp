"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ClipboardList, DollarSign, AlertTriangle, Clock } from "lucide-react";
import KpiCard from "@/components/KpiCard";
import ChartCard from "@/components/ChartCard";
import DataTable from "@/components/DataTable";
import StatusBadge from "@/components/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/format";
import { useCompanyFetch } from "@/lib/useCompanyFetch";

export default function SalesOrdersPage() {
  const data = useCompanyFetch<Record<string, unknown>>("/api/sales-orders");

  if (!data) {
    return <div className="flex items-center justify-center h-96"><div className="text-muted-foreground">Loading...</div></div>;
  }

  const { orders, byCustomer, totals } = data as {
    orders: Record<string, unknown>[];
    byCustomer: Record<string, unknown>[];
    totals: Record<string, unknown>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Sales Orders</h1>
        <p className="text-[12px] text-muted-foreground mt-0.5">Open backlog and fulfillment status</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard label="Open Orders" value={String(totals?.open_count || 0)} icon={ClipboardList} />
        <KpiCard label="Backlog Value" value={formatCurrency(Number(totals?.open_value || 0))} icon={DollarSign} />
        <KpiCard
          label="Overdue"
          value={String(totals?.overdue_count || 0)}
          changeType={Number(totals?.overdue_count || 0) > 0 ? "negative" : "positive"}
          icon={AlertTriangle}
        />
      </div>

      {/* Backlog by Customer */}
      <ChartCard title="Backlog by Customer">
        <ResponsiveContainer width="100%" height={Math.max(200, byCustomer.length * 40)}>
          <BarChart data={byCustomer} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
            <YAxis type="category" dataKey="customer_name" tick={{ fontSize: 11 }} width={170} />
            <Tooltip formatter={(v: number, name: string) => name === "total_value" ? formatCurrency(v) : v} />
            <Bar dataKey="total_value" name="Order Value" fill="#003A5C" radius={[0, 1, 1, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Orders Table */}
      <ChartCard title="Open Sales Orders">
        <DataTable
          columns={[
            { key: "ref_number", label: "Order #" },
            { key: "customer_name", label: "Customer" },
            { key: "txn_date", label: "Order Date", render: (r) => formatDate(String(r.txn_date)) },
            { key: "ship_date", label: "Ship Date", render: (r) => formatDate(String(r.ship_date)) },
            { key: "amount", label: "Amount", align: "right", render: (r) => (
              <span className="font-semibold">{formatCurrency(Number(r.amount))}</span>
            )},
            { key: "is_overdue", label: "Status", render: (r) => (
              r.is_overdue
                ? <StatusBadge status="danger" label="Overdue" />
                : <StatusBadge status="current" label="On Track" />
            )},
          ]}
          data={orders}
        />
      </ChartCard>
    </div>
  );
}
