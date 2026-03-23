import { ReactNode } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}

export default function ChartCard({ title, subtitle, children, className = "" }: ChartCardProps) {
  return (
    <Card className={cn("", className)}>
      <CardHeader>
        <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </CardTitle>
        {subtitle && (
          <CardDescription className="text-[11px]">{subtitle}</CardDescription>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
