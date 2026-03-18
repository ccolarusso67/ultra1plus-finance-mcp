import { ReactNode } from "react";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}

export default function ChartCard({
  title,
  subtitle,
  children,
  className = "",
}: ChartCardProps) {
  return (
    <div
      className={`bg-white rounded-sm border border-[#E0E0E0] p-5 ${className}`}
    >
      <div className="mb-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#5F6368]">{title}</h3>
        {subtitle && (
          <p className="text-[11px] text-[#5F6368]/70 mt-0.5">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}
