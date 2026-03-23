"use client";

import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
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

export default function SalesOrdersPage() {
  const data = useCompanyFetch<Record<string, unknown>>("/api/sales-orders");

  if (!data) {
    return <div className="flex items-center justify-center h-96"><div className="text-muted-foreground">Loading...</div></div>;
  }

  const { orders, byCustomer, totals } = data as {
    orders: R[];
    byCustomer: R[];
    totals: R;
  };

  const backlogData = byCustomer.map((r: R) => ({
    customer: String(r.customer_name),
    "Order Value": Number(r.total_value || 0),
  }));

  return (
    <div className="space-y-6">
      <div>
        <Title>Sales Orders</Title>
        <Text>Open backlog and fulfillment status</Text>
      </div>

      <Grid numItemsSm={2} numItemsLg={3} className="gap-4">
        <Card decoration="top" decorationColor="blue">
          <Text>Open Orders</Text>
          <Metric>{String(totals?.open_count || 0)}</Metric>
        </Card>
        <Card decoration="top" decorationColor="emerald">
          <Text>Backlog Value</Text>
          <Metric>{formatCurrency(Number(totals?.open_value || 0))}</Metric>
        </Card>
        <Card decoration="top" decorationColor={Number(totals?.overdue_count || 0) > 0 ? "rose" : "emerald"}>
          <Flex justifyContent="between" alignItems="center">
            <div>
              <Text>Overdue</Text>
              <Metric>{String(totals?.overdue_count || 0)}</Metric>
            </div>
            {Number(totals?.overdue_count || 0) > 0 && (
              <BadgeDelta deltaType="decrease" size="sm">Overdue</BadgeDelta>
            )}
          </Flex>
        </Card>
      </Grid>

      {/* Backlog by Customer */}
      <Card>
        <Title>Backlog by Customer</Title>
        <ResponsiveContainer width="100%" height={Math.max(200, byCustomer.length * 40)} className="mt-4">
          <BarChart data={backlogData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
            <YAxis type="category" dataKey="customer" tick={{ fontSize: 11 }} width={140} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <Bar dataKey="Order Value" fill="#003A5C" radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Orders Table */}
      <Card>
        <Title>Open Sales Orders</Title>
        <div className="mt-4">
          <DataTable
            columns={[
              { key: "ref_number", label: "Order #" },
              { key: "customer_name", label: "Customer" },
              { key: "txn_date", label: "Order Date", render: (r: R) => formatDate(String(r.txn_date)) },
              { key: "ship_date", label: "Ship Date", render: (r: R) => formatDate(String(r.ship_date)) },
              { key: "amount", label: "Amount", align: "right" as const, render: (r: R) => (
                <span className="font-semibold">{formatCurrency(Number(r.amount))}</span>
              )},
              { key: "is_overdue", label: "Status", render: (r: R) => (
                r.is_overdue
                  ? <StatusBadge status="danger" label="Overdue" />
                  : <StatusBadge status="current" label="On Track" />
              )},
            ]}
            data={orders}
          />
        </div>
      </Card>
    </div>
  );
}
