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
        <BarChart
          className="mt-4"
          style={{ height: Math.max(250, aging.length * 40) }}
          data={aging.map((r: R) => ({
            vendor: String(r.vendor_name),
            Current: Number(r.current_bucket || 0),
            "1-30": Number(r.days_1_30 || 0),
            "31-60": Number(r.days_31_60 || 0),
            "61-90": Number(r.days_61_90 || 0),
            "91+": Number(r.days_91_plus || 0),
          }))}
          index="vendor"
          categories={["Current", "1-30", "31-60", "61-90", "91+"]}
          colors={["emerald", "blue", "amber", "rose", "red"]}
          valueFormatter={(v: number) => currencyFormatter(v)}
          stack
          layout="vertical"
          showAnimation
        />
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
