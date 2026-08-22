"use client";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatCentsBRL } from "@/lib/money";
import { ArrowRight, User } from "lucide-react";

interface RecentLead {
  id: string;
  title: string;
  value_cents: number;
  stage_name: string;
  contact_name: string | null;
  budget_status?: string | null;
  created_at: string;
}

interface Props {
  leads: RecentLead[];
}

function formatDate(s: string): string {
  const d = new Date(s);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RecentLeadsCard({ leads }: Props) {
  return (
    <Card className="col-span-full">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base font-semibold">Oportunidades Recentes</CardTitle>
          <CardDescription className="text-xs">
            Últimos negócios criados ou movimentados no funil
          </CardDescription>
        </div>
        <Link
          href="/app/kanban"
          className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Ver todas <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent>
        {leads.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            Nenhuma oportunidade cadastrada ainda. Crie um novo lead no funil ou aguarde uma nova conversa do WhatsApp!
          </div>
        ) : (
          <div className="divide-y rounded-md border">
            {leads.map((lead) => (
              <div
                key={lead.id}
                className="flex items-center justify-between p-3.5 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">
                      {lead.title}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {lead.contact_name ?? "Contato sem nome"} · {formatDate(lead.created_at)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                  {lead.budget_status && (
                    <span
                      className={`hidden sm:inline rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        lead.budget_status === "aprovado" || lead.budget_status === "quitado"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {lead.budget_status === "aprovado"
                        ? "Orçamento Aprovado"
                        : lead.budget_status === "quitado"
                          ? "100% Quitado"
                          : `Orçamento ${lead.budget_status}`}
                    </span>
                  )}
                  <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                    {lead.stage_name}
                  </span>
                  <span className="text-sm font-bold text-foreground min-w-[90px] text-right">
                    {lead.value_cents > 0 ? formatCentsBRL(lead.value_cents) : "R$ 0,00"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
