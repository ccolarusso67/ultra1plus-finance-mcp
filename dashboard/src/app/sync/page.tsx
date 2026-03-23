"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  RefreshCw,
} from "lucide-react";
import ChartCard from "@/components/ChartCard";
import StatusBadge from "@/components/StatusBadge";

interface SyncJob {
  job_name: string;
  last_run_at: string | null;
  last_success_at: string | null;
  records_synced: number;
  status: string;
  error_message: string | null;
  minutes_ago: number | null;
}

function formatJobName(name: string): string {
  return name
    .replace(/_sync$/, "")
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function timeAgo(minutes: number | null): string {
  if (minutes === null) return "Never";
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${Math.round(minutes)}m ago`;
  const hrs = Math.floor(minutes / 60);
  if (hrs < 24) return `${hrs}h ${Math.round(minutes % 60)}m ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ${hrs % 24}h ago`;
}

function freshnessColor(minutes: number | null): string {
  if (minutes === null) return "text-muted-foreground";
  if (minutes < 30) return "text-brand-success";
  if (minutes < 120) return "text-brand-warning";
  return "text-brand-danger";
}

export default function SyncHealthPage() {
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = () => {
    setLoading(true);
    fetch("/api/sync-health")
      .then((r) => r.json())
      .then((d) => {
        if (d.jobs) setJobs(d.jobs);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const successCount = jobs.filter((j) => j.status === "success").length;
  const errorCount = jobs.filter((j) => j.status === "error").length;
  const totalRecords = jobs.reduce((sum, j) => sum + (j.records_synced || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Data Sync Health
          </h1>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            QuickBooks Web Connector sync job status and data freshness
          </p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-3 py-1.5 text-[12px] font-medium text-muted-foreground bg-card border border-border rounded-md hover:bg-[#F8F9FA] transition-colors"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            Total Jobs
          </p>
          <p className="text-2xl font-semibold text-foreground mt-1">
            {jobs.length}
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.15em] text-brand-success">
            Healthy
          </p>
          <p className="text-2xl font-semibold text-brand-success mt-1">
            {successCount}
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.15em] text-brand-danger">
            Errors
          </p>
          <p className="text-2xl font-semibold text-brand-danger mt-1">
            {errorCount}
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            Total Records
          </p>
          <p className="text-2xl font-semibold text-foreground mt-1">
            {totalRecords.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Job Table */}
      <ChartCard title="Sync Jobs" subtitle="Individual job status and last run details">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
                  Job
                </th>
                <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
                  Status
                </th>
                <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
                  Records
                </th>
                <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
                  Last Success
                </th>
                <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
                  Details
                </th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr
                  key={job.job_name}
                  className="border-b border-[#F3F3F3] hover:bg-[#F8F9FA] transition-colors"
                >
                  <td className="py-2.5 px-3 font-medium text-foreground">
                    {formatJobName(job.job_name)}
                  </td>
                  <td className="py-2.5 px-3">
                    {job.status === "success" ? (
                      <span className="inline-flex items-center gap-1 text-brand-success">
                        <CheckCircle2 size={14} />
                        <StatusBadge status="current" label="Healthy" />
                      </span>
                    ) : job.status === "error" ? (
                      <span className="inline-flex items-center gap-1 text-brand-danger">
                        <XCircle size={14} />
                        <StatusBadge status="danger" label="Error" />
                      </span>
                    ) : job.status === "running" ? (
                      <span className="inline-flex items-center gap-1 text-brand-blue">
                        <Loader2 size={14} className="animate-spin" />
                        <StatusBadge status="info" label="Running" />
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Clock size={14} />
                        <StatusBadge status="warning" label="Idle" />
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums">
                    {(job.records_synced || 0).toLocaleString()}
                  </td>
                  <td
                    className={`py-2.5 px-3 tabular-nums ${freshnessColor(job.minutes_ago)}`}
                  >
                    {timeAgo(job.minutes_ago)}
                  </td>
                  <td className="py-2.5 px-3 text-muted-foreground max-w-[200px] truncate">
                    {job.error_message || "—"}
                  </td>
                </tr>
              ))}
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    {loading ? "Loading sync status..." : "No sync jobs found"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </ChartCard>

      {/* Note about disabled jobs */}
      <div className="bg-[#FEF7E0] border border-[#F9D67A] rounded-lg px-4 py-3 text-[12px] text-[#5F4B00]">
        <strong>Note:</strong> The <code>price_level_sync</code> job is
        intentionally disabled because the QuickBooks company file has Price
        Rules enabled, which makes the Price Levels query unavailable.
      </div>
    </div>
  );
}
