"use client";

import {
  Card, Metric, Text, Flex, Bold, Grid, Title, Subtitle, Badge,
} from "@tremor/react";
import { formatCurrency } from "@/lib/format";
import { useCompanyFetch } from "@/lib/useCompanyFetch";
import {
  AlertTriangle, TrendingUp, TrendingDown, DollarSign,
  Users, Package, ShieldAlert, CheckCircle2, Info, Target,
  Activity, ArrowRight, Gauge,
} from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */
type R = Record<string, any>;

interface InsightsData {
  healthScore: number;
  healthGrade: string;
  healthLabel: string;
  insightCount: { total: number; critical: number; warning: number; info: number; positive: number };
  insights: {
    category: string;
    severity: "critical" | "warning" | "info" | "positive";
    title: string;
    detail: string;
    action: string;
    metric?: string;
    value?: number;
  }[];
  keyMetrics: R;
  generatedAt: string;
}

const severityConfig = {
  critical: {
    bg: "bg-red-50", border: "border-red-200", text: "text-red-800",
    badge: "bg-red-600", badgeText: "text-white", icon: AlertTriangle,
    iconColor: "text-red-600", label: "Critical",
  },
  warning: {
    bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-800",
    badge: "bg-amber-500", badgeText: "text-white", icon: ShieldAlert,
    iconColor: "text-amber-600", label: "Warning",
  },
  info: {
    bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-800",
    badge: "bg-blue-500", badgeText: "text-white", icon: Info,
    iconColor: "text-blue-600", label: "Info",
  },
  positive: {
    bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-800",
    badge: "bg-emerald-600", badgeText: "text-white", icon: CheckCircle2,
    iconColor: "text-emerald-600", label: "Positive",
  },
};

const categoryIcons: Record<string, any> = {
  revenue: TrendingUp,
  margin: Target,
  cash: DollarSign,
  ar: ArrowRight,
  ap: ArrowRight,
  customers: Users,
  operations: Package,
};

function HealthGauge({ score, grade, label }: { score: number; grade: string; label: string }) {
  const color =
    score >= 85 ? "#137333" :
    score >= 70 ? "#0098DB" :
    score >= 55 ? "#E37400" :
    score >= 40 ? "#C5221F" : "#7F1D1D";

  return (
    <div className="flex flex-col items-center justify-center py-6">
      <div className="relative w-40 h-40">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle cx="60" cy="60" r="52" fill="none" stroke="#E5E7EB" strokeWidth="8" />
          <circle
            cx="60" cy="60" r="52" fill="none" stroke={color} strokeWidth="8"
            strokeDasharray={`${(score / 100) * 326.7} 326.7`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold" style={{ color }}>{grade}</span>
          <span className="text-sm text-gray-500 font-medium">{score}/100</span>
        </div>
      </div>
      <p className="mt-3 text-lg font-semibold text-gray-700">{label}</p>
      <p className="text-xs text-gray-400 mt-1">Financial Health Score</p>
    </div>
  );
}

export default function InsightsPage() {
  const data = useCompanyFetch<InsightsData>("/api/insights");

  const insights = data?.insights || [];
  const counts = data?.insightCount || { total: 0, critical: 0, warning: 0, info: 0, positive: 0 };
  const km = data?.keyMetrics || {};

  const categories = ["revenue", "margin", "cash", "ar", "ap", "customers", "operations"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Flex justifyContent="between" alignItems="center">
          <div>
            <Title>Financial Intelligence</Title>
            <Text>AI-powered analysis of your financial health — actionable insights and recommendations</Text>
          </div>
          {data?.generatedAt && (
            <Text className="text-xs text-gray-400">
              Analyzed: {new Date(data.generatedAt).toLocaleString()}
            </Text>
          )}
        </Flex>
      </div>

      {/* Health Score + Summary Counts + Key Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Health Gauge */}
        <Card className="flex items-center justify-center">
          <HealthGauge
            score={data?.healthScore || 0}
            grade={data?.healthGrade || "—"}
            label={data?.healthLabel || "Loading..."}
          />
        </Card>

        {/* Insight Counts */}
        <Card>
          <Title className="mb-4">Insight Summary</Title>
          <div className="space-y-3">
            <Flex justifyContent="between" className="items-center">
              <Flex justifyContent="start" className="gap-2 items-center">
                <div className="w-3 h-3 rounded-full bg-red-600" />
                <Text>Critical Issues</Text>
              </Flex>
              <span className={`text-2xl font-bold ${counts.critical > 0 ? "text-red-600" : "text-gray-300"}`}>
                {counts.critical}
              </span>
            </Flex>
            <Flex justifyContent="between" className="items-center">
              <Flex justifyContent="start" className="gap-2 items-center">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <Text>Warnings</Text>
              </Flex>
              <span className={`text-2xl font-bold ${counts.warning > 0 ? "text-amber-600" : "text-gray-300"}`}>
                {counts.warning}
              </span>
            </Flex>
            <Flex justifyContent="between" className="items-center">
              <Flex justifyContent="start" className="gap-2 items-center">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <Text>Informational</Text>
              </Flex>
              <span className="text-2xl font-bold text-blue-600">{counts.info}</span>
            </Flex>
            <Flex justifyContent="between" className="items-center">
              <Flex justifyContent="start" className="gap-2 items-center">
                <div className="w-3 h-3 rounded-full bg-emerald-600" />
                <Text>Positive Signals</Text>
              </Flex>
              <span className="text-2xl font-bold text-emerald-600">{counts.positive}</span>
            </Flex>
          </div>
        </Card>

        {/* Key Financial Metrics */}
        <Card>
          <Title className="mb-4">Key Ratios</Title>
          <div className="space-y-3">
            <Flex justifyContent="between">
              <Text>Days Sales Outstanding</Text>
              <Bold className={km.dso > 60 ? "text-red-600" : km.dso > 45 ? "text-amber-600" : "text-emerald-600"}>
                {km.dso || 0} days
              </Bold>
            </Flex>
            <Flex justifyContent="between">
              <Text>Gross Margin</Text>
              <Bold className={km.grossMargin < 25 ? "text-red-600" : km.grossMargin < 35 ? "text-amber-600" : "text-emerald-600"}>
                {km.grossMargin || 0}%
              </Bold>
            </Flex>
            <Flex justifyContent="between">
              <Text>Net Margin</Text>
              <Bold className={km.netMargin < 0 ? "text-red-600" : km.netMargin < 5 ? "text-amber-600" : "text-emerald-600"}>
                {km.netMargin || 0}%
              </Bold>
            </Flex>
            <Flex justifyContent="between">
              <Text>Cash Coverage (30d)</Text>
              <Bold className={
                km.coverageRatio == null ? "text-gray-400" :
                km.coverageRatio < 0.8 ? "text-red-600" :
                km.coverageRatio < 1.2 ? "text-amber-600" : "text-emerald-600"
              }>
                {km.coverageRatio != null ? `${km.coverageRatio}x` : "N/A"}
              </Bold>
            </Flex>
            <Flex justifyContent="between">
              <Text>Net Working Capital</Text>
              <Bold className={km.netWorkingCapital < 0 ? "text-red-600" : "text-emerald-600"}>
                {formatCurrency(km.netWorkingCapital || 0)}
              </Bold>
            </Flex>
            <Flex justifyContent="between">
              <Text>QoQ Revenue Change</Text>
              <Bold className={
                km.revenueChange == null ? "text-gray-400" :
                km.revenueChange < -5 ? "text-red-600" :
                km.revenueChange > 5 ? "text-emerald-600" : "text-gray-600"
              }>
                {km.revenueChange != null ? `${km.revenueChange > 0 ? "+" : ""}${km.revenueChange}%` : "N/A"}
              </Bold>
            </Flex>
          </div>
        </Card>
      </div>

      {/* Insights by Category */}
      {categories.map((cat) => {
        const catInsights = insights.filter((i) => i.category === cat);
        if (catInsights.length === 0) return null;

        const CatIcon = categoryIcons[cat] || Activity;
        const catLabel =
          cat === "ar" ? "Accounts Receivable" :
          cat === "ap" ? "Accounts Payable" :
          cat.charAt(0).toUpperCase() + cat.slice(1);

        return (
          <div key={cat}>
            <Flex justifyContent="start" className="gap-2 mb-3 items-center">
              <CatIcon size={18} className="text-gray-500" />
              <Title>{catLabel}</Title>
              <Badge size="sm" color="gray">{catInsights.length}</Badge>
            </Flex>
            <div className="space-y-3">
              {catInsights.map((insight, idx) => {
                const cfg = severityConfig[insight.severity];
                const SevIcon = cfg.icon;
                return (
                  <div
                    key={`${cat}-${idx}`}
                    className={`rounded-lg border ${cfg.border} ${cfg.bg} p-4`}
                  >
                    <Flex justifyContent="between" alignItems="start">
                      <Flex justifyContent="start" className="gap-3 items-start flex-1">
                        <SevIcon size={20} className={`${cfg.iconColor} mt-0.5 flex-shrink-0`} />
                        <div className="flex-1">
                          <Flex justifyContent="start" className="gap-2 items-center mb-1">
                            <span className={`font-semibold ${cfg.text}`}>{insight.title}</span>
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${cfg.badge} ${cfg.badgeText}`}>
                              {cfg.label}
                            </span>
                          </Flex>
                          <p className="text-sm text-gray-700 mb-3 leading-relaxed">{insight.detail}</p>
                          <div className="bg-white/60 rounded-md p-3 border border-gray-200/50">
                            <Flex justifyContent="start" className="gap-2 items-start">
                              <Gauge size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                              <div>
                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Recommended Action</span>
                                <p className="text-sm text-gray-600 mt-0.5">{insight.action}</p>
                              </div>
                            </Flex>
                          </div>
                        </div>
                      </Flex>
                    </Flex>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* No Insights State */}
      {insights.length === 0 && (
        <Card className="text-center py-12">
          <CheckCircle2 size={48} className="text-emerald-400 mx-auto mb-4" />
          <Title>No Issues Detected</Title>
          <Text className="mt-2">All financial metrics are within healthy ranges. Keep monitoring regularly.</Text>
        </Card>
      )}

      {/* Disclaimer */}
      <Card className="bg-gray-50">
        <Text className="text-xs text-gray-400 leading-relaxed">
          <Bold>Disclaimer:</Bold> These insights are generated from automated analysis of your synced QuickBooks data.
          They are advisory indicators — not professional accounting or financial advice.
          Always validate significant findings with your accounting team before taking action.
          Data freshness depends on the last successful sync from the Windows connector.
        </Text>
      </Card>
    </div>
  );
}
