import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: "current" | "overdue" | "paid" | "warning" | "danger" | "info";
  label: string;
}

const styles: Record<string, string> = {
  current: "bg-brand-success/10 text-brand-success",
  paid: "bg-brand-success/10 text-brand-success",
  overdue: "bg-brand-danger/10 text-brand-danger",
  danger: "bg-brand-danger/10 text-brand-danger",
  warning: "bg-brand-warning/10 text-brand-warning",
  info: "bg-brand-blue/10 text-brand-dark",
};

export default function StatusBadge({ status, label }: StatusBadgeProps) {
  return (
    <span className={cn("inline-block text-[11px] font-medium px-2 py-0.5 rounded-md", styles[status] || styles.info)}>
      {label}
    </span>
  );
}
