"use client";
import type { Lead } from "@/lib/types/leads";
import {
  OrcamentoLead,
  STATUS_ORCAMENTO_LABELS,
  METODOS_PAGAMENTO_LABELS,
} from "@/lib/types/orcamento";
import { Button } from "@/components/ui/button";
import { Receipt, CheckCircle, Plus, CreditCard } from "@/lib/ui/icons";

interface Props {
  lead: Lead;
  onOpenOrcamento: () => void;
}

function formatBRL(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export function OrcamentoCard({ lead, onOpenOrcamento }: Props) {
  const customFields = (lead.custom_fields ?? {}) as Record<string, unknown>;
  const orcamento = customFields.orcamento as OrcamentoLead | undefined;

  const totalCents = orcamento?.total_cents ?? lead.value_cents ?? 0;
  const totalPagoCents = orcamento?.total_pago_cents ?? 0;
  const saldoRestanteCents = orcamento?.saldo_restante_cents ?? Math.max(0, totalCents - totalPagoCents);
  const status = orcamento?.status ?? "rascunho";
  const itens = orcamento?.itens ?? [];
  const pagamentos = orcamento?.pagamentos ?? [];

  const percentualPago =
    totalCents > 0
      ? Math.min(100, Math.round((totalPagoCents / totalCents) * 100))
      : 0;

  return (
    <div className="rounded-lg border border-border bg-card p-3.5 space-y-3 text-xs">
      {/* Topo do Card */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Receipt className="text-primary" size={16} />
          <span className="font-semibold text-text">Orçamento & Pagamentos</span>
          <span
            className={`rounded-full px-2 py-0.2 text-[10px] font-semibold ${
              STATUS_ORCAMENTO_LABELS[status].color
            }`}
          >
            {STATUS_ORCAMENTO_LABELS[status].label}
          </span>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onOpenOrcamento}
          className="h-7 text-[11px] gap-1 bg-background"
        >
          <CreditCard size={13} />
          Gerenciar
        </Button>
      </div>

      {/* Valores e Saldo */}
      <div className="grid grid-cols-3 gap-2 rounded-md bg-muted/40 p-2 text-center">
        <div>
          <span className="block text-[10px] text-text-muted">Total Orçado</span>
          <span className="font-bold text-text tabular-nums text-xs">
            {formatBRL(totalCents)}
          </span>
        </div>
        <div>
          <span className="block text-[10px] text-emerald-600 dark:text-emerald-400">
            Total Pago
          </span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums text-xs">
            {formatBRL(totalPagoCents)}
          </span>
        </div>
        <div>
          <span className="block text-[10px] text-amber-600 dark:text-amber-400">
            Saldo Restante
          </span>
          <span className="font-bold text-amber-600 dark:text-amber-400 tabular-nums text-xs">
            {formatBRL(saldoRestanteCents)}
          </span>
        </div>
      </div>

      {/* Barra de Progresso do Pagamento */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-text-muted">
          <span>Progresso do pagamento</span>
          <span className="font-semibold text-text">{percentualPago}% pago</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full transition-all duration-300 ${
              percentualPago === 100 ? "bg-emerald-500" : "bg-primary"
            }`}
            style={{ width: `${percentualPago}%` }}
          />
        </div>
      </div>

      {/* Resumo de Procedimentos ou Última Baixa */}
      {pagamentos.length > 0 ? (
        <div className="rounded border border-border/50 bg-background/80 p-2 text-[11px] flex items-center justify-between">
          <span className="text-text-muted">
            Última baixa: {METODOS_PAGAMENTO_LABELS[pagamentos[0]!.metodo]} (
            {new Date(pagamentos[0]!.data).toLocaleDateString("pt-BR")})
          </span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">
            + {formatBRL(pagamentos[0]!.valor_cents)}
          </span>
        </div>
      ) : (
        itens.length > 0 && (
          <div className="flex flex-wrap gap-1 text-[10px] text-text-muted">
            {itens.map((i) => (
              <span
                key={i.id}
                className="rounded bg-muted px-1.5 py-0.5 text-text-muted font-medium truncate max-w-[200px]"
              >
                {i.quantidade}x {i.descricao || "Item"}
              </span>
            ))}
          </div>
        )
      )}
    </div>
  );
}
