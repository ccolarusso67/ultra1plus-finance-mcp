interface StatusBadgeProps {
  status: "current" | "overdue" | "paid" | "warning" | "danger" | "info";
  label: string;
}

const styles: Record<string, string> = {
  current: "bg-[#137333]/10 text-[#137333]",
  paid: "bg-[#137333]/10 text-[#137333]",
  overdue: "bg-[#C5221F]/10 text-[#C5221F]",
  danger: "bg-[#C5221F]/10 text-[#C5221F]",
  warning: "bg-[#E37400]/10 text-[#E37400]",
  info: "bg-[#0098DB]/10 text-[#003A5C]",
};

export default function StatusBadge({ status, label }: StatusBadgeProps) {
  return (
    <span
      className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-sm ${styles[status] || styles.info}`}
    >
      {label}
    </span>
  );
}
