"use client";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatCentsBRL } from "@/lib/money";
import { ArrowRight } from "lucide-react";

interface StageData {
  id: string;
  name: string;
  color: string | null;
  count: number;
  value_cents: number;
}

interface Props {
  stages: StageData[];
  totalOpenValueCents: number;
  totalLeadsCount: number;
}

export function PipelineSummaryCard({ stages, totalOpenValueCents, totalLeadsCount }: Props) {
  const maxCount = Math.max(1, ...stages.map((s) => s.count));

  return (
    <Card className="col-span-full xl:col-span-4 flex flex-col justify-between">
      <div>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-semibold">Funil de Vendas</CardTitle>
            <CardDescription className="text-xs">
              {totalLeadsCount} negócios ativos ({formatCentsBRL(totalOpenValueCents)})
            </CardDescription>
          </div>
          <Link
            href="/app/kanban"
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Abrir funil <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>

        <CardContent className="flex flex-col gap-3">
          {stages.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">
              Nenhuma etapa configurada no funil de vendas.
            </p>
          ) : (
            stages.map((s) => {
              const pct = Math.round((s.count / maxCount) * 100);
              return (
                <div key={s.id} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground truncate max-w-[150px]">
                      {s.name}
                    </span>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span>{s.count} {s.count === 1 ? "lead" : "leads"}</span>
                      {s.value_cents > 0 && (
                        <span className="font-medium text-foreground">
                          · {formatCentsBRL(s.value_cents)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.max(5, pct)}%`,
                        backgroundColor: s.color || "hsl(var(--primary))",
                      }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </div>

      <div className="border-t p-4 bg-muted/20">
        <div className="flex items-center justify-between text-xs font-medium">
          <span className="text-muted-foreground">Valor total em negociação</span>
          <span className="text-base font-bold text-foreground">
            {formatCentsBRL(totalOpenValueCents)}
          </span>
        </div>
      </div>
    </Card>
  );
}
