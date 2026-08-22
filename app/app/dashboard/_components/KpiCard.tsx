"use client";
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  trend?: {
    text: string;
    isPositive?: boolean;
  };
  highlight?: boolean;
  clickable?: boolean;
  onClick?: () => void;
  className?: string;
}

export function KpiCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  highlight,
  clickable,
  onClick,
  className,
}: KpiCardProps) {
  return (
    <Card
      onClick={onClick}
      className={cn(
        "relative overflow-hidden transition-all duration-200 hover:shadow-md hover:border-primary/40",
        highlight && "border-primary/50 bg-primary/5",
        clickable && "cursor-pointer hover:ring-1 hover:ring-primary/30 active:scale-[0.99]",
        className,
      )}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {title}
            </span>
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {value}
            </div>
            {subtitle && (
              <span className="text-xs text-muted-foreground mt-0.5">
                {subtitle}
              </span>
            )}
            {trend && (
              <div className="mt-1 flex items-center gap-1 text-xs">
                <span
                  className={cn(
                    "font-medium",
                    trend.isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
                  )}
                >
                  {trend.text}
                </span>
              </div>
            )}
          </div>

          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-background/80 shadow-sm text-primary",
              highlight && "bg-primary text-primary-foreground border-transparent",
            )}
          >
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
