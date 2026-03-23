import { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

interface KpiCardProps {
  label: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon?: LucideIcon;
  subtitle?: string;
}

export default function KpiCard({
  label,
  value,
  change,
  changeType = "neutral",
  icon: Icon,
  subtitle,
}: KpiCardProps) {
  const changeColor = {
    positive: "text-brand-success",
    negative: "text-brand-danger",
    neutral: "text-muted-foreground",
  }[changeType];

  return (
    <Card size="sm" className="relative overflow-visible">
      <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-xl bg-brand-dark" />
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 mb-1.5">
          {Icon && <Icon size={14} className="text-muted-foreground" strokeWidth={1.5} />}
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        </div>
        <p className="text-xl font-semibold text-foreground">{value}</p>
        {change && (
          <span className={`inline-block mt-1 text-[11px] font-medium ${changeColor}`}>{change}</span>
        )}
        {subtitle && (
          <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>
    </Card>
  );
}
