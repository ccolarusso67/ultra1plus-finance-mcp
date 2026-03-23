"use client";

import {
  BarChart, Card, Metric, Text, Flex, BadgeDelta, Grid, Title, Subtitle,
} from "@tremor/react";
import DataTable from "@/components/DataTable";
import StatusBadge from "@/components/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/format";
import { useCompanyFetch } from "@/lib/useCompanyFetch";

/* eslint-disable @typescript-eslint/no-explicit-any */
type R = Record<string, any>;

const currencyFormatter = (v: number) => `$${(v / 1000).toFixed(0)}K`;

export default function ReceivablesPage() {
  const data = useCompanyFetch<Record<string, unknown>>("/api/ar-aging");

  if (!data) {
    return <div className="flex items-center justify-center h-96"><div className="text-muted-foreground">Loading...</div></div>;
  }

  const { aging, openInvoices, creditHolds, totals } = data as {
    aging: R[];
    openInvoices: R[];
    creditHolds: R[];
    totals: R;
  };

  return (
    <div className="space-y-6">
      <div>
        <Title>Accounts Receivable</Title>
        <Text>AR aging, open invoices, and credit status</Text>
      </div>

      <Grid numItemsSm={2} numItemsLg={4} className="gap-4">
        <Card decoration="top" decorationColor="blue">
          <Text>Total AR</Text>
          <Metric>{formatCurrency(Number(totals?.total_ar || 0))}</Metric>
        </Card>
        <Card decoration="top" decorationColor="rose">
          <Flex justifyContent="between" alignItems="center">
            <div>
              <Text>Overdue (31+ days)</Text>
              <Metric>{formatCurrency(Number(totals?.overdue_ar || 0))}</Metric>
            </div>
            <BadgeDelta deltaType="decrease" size="sm">Overdue</BadgeDelta>
          </Flex>
        </Card>
        <Card decoration="top" decorationColor="cyan">
          <Text>Open Invoices</Text>
          <Metric>{String(openInvoices.length)}</Metric>
        </Card>
        <Card decoration="top" decorationColor={Number(totals?.over_credit_count || 0) > 0 ? "rose" : "emerald"}>
          <Flex justifyContent="between" alignItems="center">
            <div>
              <Text>Over Credit Limit</Text>
              <Metric>{String(totals?.over_credit_count || 0)}</Metric>
            </div>
            {Number(totals?.over_credit_count || 0) > 0 && (
              <BadgeDelta deltaType="decrease" size="sm">Alert</BadgeDelta>
            )}
          </Flex>
        </Card>
      </Grid>

      {/* AR Aging Stacked Bar */}
      <Card>
        <Title>AR Aging by Customer</Title>
        <BarChart
          className="mt-4"
          style={{ height: Math.max(300, aging.length * 35) }}
          data={aging.map((r: R) => ({
            customer: String(r.customer_name),
            Current: Number(r.current_bucket || 0),
            "1-30": Number(r.days_1_30 || 0),
            "31-60": Number(r.days_31_60 || 0),
            "61-90": Number(r.days_61_90 || 0),
            "91+": Number(r.days_91_plus || 0),
          }))}
          index="customer"
          categories={["Current", "1-30", "31-60", "61-90", "91+"]}
          colors={["emerald", "blue", "amber", "rose", "red"]}
          valueFormatter={(v: number) => currencyFormatter(v)}
          stack
          layout="vertical"
          showAnimation
        />
      </Card>

      {/* Open Invoices */}
      <Card>
        <Title>Open Invoices</Title>
        <div className="mt-4">
          <DataTable
            columns={[
              { key: "ref_number", label: "Invoice #" },
              { key: "customer_name", label: "Customer" },
              { key: "txn_date", label: "Date", render: (r: R) => formatDate(String(r.txn_date)) },
              { key: "due_date", label: "Due", render: (r: R) => formatDate(String(r.due_date)) },
              { key: "amount", label: "Amount", align: "right" as const, render: (r: R) => formatCurrency(Number(r.amount)) },
              { key: "balance_remaining", label: "Balance", align: "right" as const, render: (r: R) => (
                <span className="font-semibold">{formatCurrency(Number(r.balance_remaining))}</span>
              )},
              { key: "days_past_due", label: "Days Past Due", align: "right" as const, render: (r: R) => {
                const days = Number(r.days_past_due);
                if (days <= 0) return <StatusBadge status="current" label="Current" />;
                if (days <= 30) return <StatusBadge status="warning" label={`${days} days`} />;
                return <StatusBadge status="danger" label={`${days} days`} />;
              }},
            ]}
            data={openInvoices}
          />
        </div>
      </Card>

      {/* Credit Holds */}
      {creditHolds.length > 0 && (
        <Card>
          <Title>Customers Over Credit Limit</Title>
          <Subtitle>These accounts should be reviewed before shipping</Subtitle>
          <div className="mt-4">
            <DataTable
              columns={[
                { key: "customer_name", label: "Customer" },
                { key: "credit_limit", label: "Credit Limit", align: "right" as const, render: (r: R) => formatCurrency(Number(r.credit_limit)) },
                { key: "balance", label: "Balance", align: "right" as const, render: (r: R) => (
                  <span className="text-brand-danger font-semibold">{formatCurrency(Number(r.balance))}</span>
                )},
                { key: "available_credit", label: "Available", align: "right" as const, render: (r: R) => (
                  <span className="text-brand-danger">{formatCurrency(Number(r.available_credit))}</span>
                )},
              ]}
              data={creditHolds}
            />
          </div>
        </Card>
      )}
    </div>
  );
}
