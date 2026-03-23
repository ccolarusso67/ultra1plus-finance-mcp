"use client";

import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Card, Metric, Text, Flex, BadgeDelta, Grid, Title, Subtitle,
} from "@tremor/react";
import DataTable from "@/components/DataTable";
import StatusBadge from "@/components/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/format";
import { useCompanyFetch } from "@/lib/useCompanyFetch";

/* eslint-disable @typescript-eslint/no-explicit-any */
type R = Record<string, any>;

export default function PayablesPage() {
  const data = useCompanyFetch<Record<string, unknown>>("/api/ap-aging");

  if (!data) {
    return <div className="flex items-center justify-center h-96"><div className="text-muted-foreground">Loading...</div></div>;
  }

  const { aging, openBills, totals } = data as {
    aging: R[];
    openBills: R[];
    totals: R;
  };

  const agingData = aging.map((r: R) => ({
    vendor: String(r.vendor_name),
    Current: Number(r.current_bucket || 0),
    "1-30": Number(r.days_1_30 || 0),
    "31-60": Number(r.days_31_60 || 0),
    "61-90": Number(r.days_61_90 || 0),
    "91+": Number(r.days_91_plus || 0),
  }));

  return (
    <div className="space-y-6">
      <div>
        <Title>Accounts Payable</Title>
        <Text>AP aging, open bills, and payment schedule</Text>
      </div>

      <Grid numItemsSm={2} numItemsLg={4} className="gap-4">
        <Card decoration="top" decorationColor="blue">
          <Text>Total AP</Text>
          <Metric>{formatCurrency(Number(totals?.total_ap || 0))}</Metric>
        </Card>
        <Card decoration="top" decorationColor={Number(totals?.overdue_ap || 0) > 0 ? "rose" : "emerald"}>
          <Flex justifyContent="between" alignItems="center">
            <div>
              <Text>Overdue</Text>
              <Metric>{formatCurrency(Number(totals?.overdue_ap || 0))}</Metric>
            </div>
            {Number(totals?.overdue_ap || 0) > 0 && (
              <BadgeDelta deltaType="decrease" size="sm">Overdue</BadgeDelta>
            )}
          </Flex>
        </Card>
        <Card decoration="top" decorationColor="amber">
          <Text>Due This Week</Text>
          <Metric>{String(totals?.due_this_week || 0)}</Metric>
        </Card>
        <Card decoration="top" decorationColor="cyan">
          <Text>Due Next Week</Text>
          <Metric>{String(totals?.due_next_week || 0)}</Metric>
        </Card>
      </Grid>

      {/* AP Aging */}
      <Card>
        <Title>AP Aging by Vendor</Title>
        <ResponsiveContainer width="100%" height={Math.max(250, aging.length * 40)} className="mt-4">
          <BarChart data={agingData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
            <YAxis type="category" dataKey="vendor" tick={{ fontSize: 11 }} width={140} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <Legend />
            <Bar dataKey="Current" stackId="a" fill="#137333" />
            <Bar dataKey="1-30" stackId="a" fill="#0098DB" />
            <Bar dataKey="31-60" stackId="a" fill="#E37400" />
            <Bar dataKey="61-90" stackId="a" fill="#C5221F" />
            <Bar dataKey="91+" stackId="a" fill="#7F1D1D" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Open Bills */}
      <Card>
        <Title>Open Bills</Title>
        <div className="mt-4">
          <DataTable
            columns={[
              { key: "vendor_name", label: "Vendor" },
              { key: "ref_number", label: "Ref #" },
              { key: "txn_date", label: "Date", render: (r: R) => formatDate(String(r.txn_date)) },
              { key: "due_date", label: "Due", render: (r: R) => formatDate(String(r.due_date)) },
              { key: "amount", label: "Amount", align: "right" as const, render: (r: R) => formatCurrency(Number(r.amount)) },
              { key: "balance_remaining", label: "Balance", align: "right" as const, render: (r: R) => (
                <span className="font-semibold">{formatCurrency(Number(r.balance_remaining))}</span>
              )},
              { key: "is_overdue", label: "Status", render: (r: R) => (
                r.is_overdue
                  ? <StatusBadge status="danger" label={`${String(r.days_past_due)}d overdue`} />
                  : <StatusBadge status="current" label="Current" />
              )},
            ]}
            data={openBills}
          />
        </div>
      </Card>
    </div>
  );
}
