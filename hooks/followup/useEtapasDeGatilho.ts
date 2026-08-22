"use client";
import { useQueries, useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";
import type { Pipeline } from "@/lib/kanban/types";

/**
 * As etapas de funil que podem armar um gatilho de follow-up — com NOME, e
 * sabendo de que funil cada uma é.
 *
 * ⚠️ POR QUE ESTA LEITURA EXISTE. O `trigger_config` do gatilho de etapa guarda
 * só `params.stage_id`. Uma tela que recebesse isso e mostrasse o uuid estaria
 * pedindo ao dono de uma clínica que decorasse identificadores — o defeito de UX
 * que Rafael vetou nesta missão. Para exibir «Proposta enviada» é preciso o
 * caminho inverso (id → nome), e ele não vem no ponteiro.
 *
 * ⚠️ POR QUE `agent-mapping` E NÃO `board`. As duas rotas devolvem as etapas do
 * funil, mas o board carrega junto os NEGÓCIOS de cada coluna — payload de
 * quadro inteiro para preencher um `<select>`. `agent-mapping` devolve só as
 * etapas ATIVAS, na ordem do funil: etapa arquivada não recebe card, então
 * oferecê-la seria oferecer um gatilho que nunca dispara (e o publish recusa).
 * Mesmo papel `manager` exigido pela tela de fluxos, então não abre porta nova.
 */

export interface EtapaDeGatilho {
  stageId: string;
  stageName: string;
  pipelineId: string;
  pipelineName: string;
}

interface RespostaDeEtapas {
  data: { etapas: Array<{ id: string; name: string }> };
}

export interface EtapasDeGatilho {
  /** Todas as etapas ativas da org, agrupáveis por funil, na ordem do funil. */
  etapas: EtapaDeGatilho[];
  /** `true` enquanto QUALQUER funil ainda não respondeu — o seletor não deve mentir "vazio". */
  carregando: boolean;
}

export function useEtapasDeGatilho(habilitado = true): EtapasDeGatilho {
  const funis = useQuery({
    queryKey: ["pipelines"],
    queryFn: async () => apiClient.get<unknown>("/api/v1/pipelines"),
    staleTime: 60_000,
    enabled: habilitado,
  });

  const rawPipelines = funis.data as { data?: Pipeline[]; pipelines?: Pipeline[] } | Pipeline[] | undefined;
  const lista: Pipeline[] = Array.isArray(rawPipelines)
    ? rawPipelines
    : rawPipelines?.data && Array.isArray(rawPipelines.data)
      ? rawPipelines.data
      : rawPipelines?.pipelines && Array.isArray(rawPipelines.pipelines)
        ? rawPipelines.pipelines
        : [];

  const porFunil = useQueries({
    queries: lista.map((funil) => ({
      queryKey: ["agent-mapping", funil.id],
      queryFn: async () =>
        apiClient.get<unknown>(
          `/api/v1/pipelines/${encodeURIComponent(funil.id)}/agent-mapping`,
        ),
      staleTime: 60_000,
      enabled: habilitado,
    })),
  });

  const etapas: EtapaDeGatilho[] = [];
  lista.forEach((funil, i) => {
    const rawData = porFunil[i]?.data as { data?: { etapas?: Array<{ id: string; name: string }> }; etapas?: Array<{ id: string; name: string }> } | undefined;
    const etapasDoFunil = rawData?.data?.etapas ?? rawData?.etapas ?? [];
    for (const etapa of etapasDoFunil) {
      if (etapa?.id && etapa?.name) {
        etapas.push({
          stageId: etapa.id,
          stageName: etapa.name,
          pipelineId: funil.id,
          pipelineName: funil.name,
        });
      }
    }
  });

  return {
    etapas,
    carregando: funis.isLoading || porFunil.some((q) => q.isLoading),
  };
}
