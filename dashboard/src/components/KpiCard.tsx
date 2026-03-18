import { LucideIcon } from "lucide-react";

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
    positive: "text-[#137333]",
    negative: "text-[#C5221F]",
    neutral: "text-[#5F6368]",
  }[changeType];

  return (
    <div className="bg-white border border-[#E0E0E0] rounded-sm p-4 hover:shadow-sm transition-shadow relative">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#003A5C]" />
      <div className="flex items-center gap-2 mb-2">
        {Icon && (
          <Icon size={14} className="text-[#5F6368]" strokeWidth={1.5} />
        )}
        <p className="text-[11px] font-medium uppercase tracking-wider text-[#5F6368]">{label}</p>
      </div>
      <p className="text-xl font-semibold text-[#1A1A1A]">{value}</p>
      {change && (
        <span
          className={`inline-block mt-1.5 text-[11px] font-medium ${changeColor}`}
        >
          {change}
        </span>
      )}
      {subtitle && (
        <p className="text-[11px] text-[#5F6368] mt-1">{subtitle}</p>
      )}
    </div>
  );
}
