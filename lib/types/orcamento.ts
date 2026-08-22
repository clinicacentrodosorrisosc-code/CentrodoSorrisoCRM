/**
 * Tipos e utilitários para o sistema de Orçamentos e Baixas Parciais de Pagamento do Lead.
 */

export interface OrcamentoItem {
  id: string;
  descricao: string;
  quantidade: number;
  valor_unitario_cents: number;
  valor_total_cents: number;
}

export type MetodoPagamento =
  | "pix"
  | "cartao_credito"
  | "cartao_debito"
  | "dinheiro"
  | "boleto"
  | "transferencia"
  | "outro";

export const METODOS_PAGAMENTO_LABELS: Record<MetodoPagamento, string> = {
  pix: "Pix",
  cartao_credito: "Cartão de Crédito",
  cartao_debito: "Cartão de Débito",
  dinheiro: "Dinheiro",
  boleto: "Boleto Bancário",
  transferencia: "Transferência / TED",
  outro: "Outro",
};

export interface PagamentoBaixa {
  id: string;
  data: string; // YYYY-MM-DD
  valor_cents: number;
  metodo: MetodoPagamento;
  observacao?: string;
  criado_em: string;
}

export type StatusOrcamento = "rascunho" | "enviado" | "aprovado" | "recusado" | "quitado";

export const STATUS_ORCAMENTO_LABELS: Record<StatusOrcamento, { label: string; color: string }> = {
  rascunho: { label: "Rascunho", color: "bg-muted text-text-muted" },
  enviado: { label: "Enviado ao Lead", color: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
  aprovado: { label: "Aprovado", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  recusado: { label: "Recusado", color: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  quitado: { label: "100% Quitado", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
};

export interface OrcamentoLead {
  status: StatusOrcamento;
  itens: OrcamentoItem[];
  desconto_cents?: number;
  total_cents: number;
  total_pago_cents: number;
  saldo_restante_cents: number;
  pagamentos: PagamentoBaixa[];
  aprovado_em?: string;
  observacoes?: string;
}

/**
 * Recalcula totais do orçamento e atualiza o status para quitado se saldo zerar
 */
export function recalcularOrcamento(
  itens: OrcamentoItem[],
  pagamentos: PagamentoBaixa[],
  statusAtual: StatusOrcamento,
  descontoCents = 0,
  aprovadoEm?: string,
  observacoes?: string,
): OrcamentoLead {
  const somaItens = itens.reduce((acc, item) => acc + (item.valor_total_cents || 0), 0);
  const totalCents = Math.max(0, somaItens - descontoCents);
  const totalPagoCents = pagamentos.reduce((acc, p) => acc + (p.valor_cents || 0), 0);
  const saldoRestanteCents = Math.max(0, totalCents - totalPagoCents);

  let status = statusAtual;
  if (totalCents > 0 && saldoRestanteCents === 0 && totalPagoCents >= totalCents) {
    status = "quitado";
  } else if (statusAtual === "quitado" && saldoRestanteCents > 0) {
    status = "aprovado";
  }

  return {
    status,
    itens,
    desconto_cents: descontoCents,
    total_cents: totalCents,
    total_pago_cents: totalPagoCents,
    saldo_restante_cents: saldoRestanteCents,
    pagamentos,
    aprovado_em: aprovadoEm,
    observacoes,
  };
}
