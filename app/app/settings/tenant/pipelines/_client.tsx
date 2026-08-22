"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePipelineConfig } from "@/app/actions/settings/updatePipelineConfig";
import type { PipelineConfigPatch } from "@/lib/schemas/settings";
import { Archive, Plus, Trash } from "@/lib/ui/icons";
import { useArquivarFunil, useCriarFunil } from "@/hooks/pipelines/usePipelines";
import { AgentMappingSection, ancoraDoMapeamento } from "./_mapping";
import { StagesSection, ancoraDasEtapas } from "./_stages";

export interface PipelineRow {
  id: string;
  name: string;
  slug: string;
  vocabulary: Record<string, string> | null;
  settings: Record<string, unknown> | null;
}

interface CustomFieldDef {
  key: string;
  label: string;
  type: string;
  required?: boolean;
}

function readFields(settings: Record<string, unknown> | null): CustomFieldDef[] {
  if (!settings) return [];
  const f = (settings as { fields?: unknown }).fields;
  return Array.isArray(f) ? (f as CustomFieldDef[]) : [];
}

function readLostReasons(settings: Record<string, unknown> | null): string[] {
  if (!settings) return [];
  const r = (settings as { lost_reasons?: unknown }).lost_reasons;
  return Array.isArray(r) ? (r as string[]) : [];
}

export function PipelinesClient({
  pipelines,
  podeEditarConfig,
}: {
  pipelines: PipelineRow[];
  /** Vocabulário/custom fields são admin (a server action recusa o resto). */
  podeEditarConfig: boolean;
}) {
  const [novo, setNovo] = useState<string | null>(null);
  const criar = useCriarFunil();
  const arquivar = useArquivarFunil();

  function criarNovoFunil() {
    const nome = (novo ?? "").trim();
    if (!nome) return;
    criar.mutate(nome, {
      onSuccess: () => {
        setNovo(null);
        toast.success(`Funil «${nome}» criado com sucesso!`);
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : "Erro ao criar funil.");
      },
    });
  }

  function pedirArquivamento(id: string, definitivo: boolean) {
    arquivar.mutate(
      { id, definitivo },
      {
        onSuccess: () => {
          toast.success(definitivo ? "Funil excluído definitivamente!" : "Funil arquivado com sucesso!");
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Erro ao processar ação no funil.");
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {podeEditarConfig && (
        <div className="flex justify-between items-center bg-card p-4 rounded-lg border">
          <div>
            <h3 className="text-sm font-medium">Gestão de Funis</h3>
            <p className="text-xs text-muted-foreground">Crie, personalize etapas ou arquive funis da sua operação.</p>
          </div>
          {novo === null ? (
            <Button onClick={() => setNovo("")} className="gap-1.5" size="sm">
              <Plus size={14} /> Novo Funil
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                autoFocus
                placeholder="Nome do novo funil..."
                value={novo}
                onChange={(e) => setNovo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") criarNovoFunil();
                  if (e.key === "Escape") setNovo(null);
                }}
                className="h-8 w-60 text-sm"
              />
              <Button size="sm" onClick={criarNovoFunil} disabled={!novo.trim() || criar.isPending}>
                Criar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setNovo(null)}>
                Cancelar
              </Button>
            </div>
          )}
        </div>
      )}

      {pipelines.length === 0 ? (
        <Card className="p-6 text-sm leading-relaxed text-muted-foreground text-center">
          Você não tem nenhum funil ativo no momento. Clique no botão acima para criar o seu primeiro funil.
        </Card>
      ) : (
        pipelines.map((p) => (
          <Card key={p.id} className="space-y-6 p-6">
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  {p.name}
                  <span className="text-xs font-normal text-muted-foreground">/{p.slug}</span>
                </h2>
              </div>
              {podeEditarConfig && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => pedirArquivamento(p.id, false)}
                    disabled={arquivar.isPending}
                    className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30 gap-1.5"
                  >
                    <Archive size={14} /> Arquivar Funil
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (confirm(`Deseja realmente EXCLUIR DEFINITIVAMENTE o funil «${p.name}»? Esta ação não pode ser desfeita.`)) {
                        pedirArquivamento(p.id, true);
                      }
                    }}
                    disabled={arquivar.isPending}
                    className="gap-1.5"
                  >
                    <Trash size={14} /> Excluir Funil
                  </Button>
                </div>
              )}
            </header>
            <StagesSection pipelineId={p.id} ancoraMapeamento={ancoraDoMapeamento(p.id)} />
            <div className="border-t border-border pt-6">
              <AgentMappingSection pipelineId={p.id} ancoraEtapas={ancoraDasEtapas(p.id)} />
            </div>
            {podeEditarConfig && <PipelineEditor pipeline={p} />}
          </Card>
        ))
      )}
    </div>
  );
}

function PipelineEditor({ pipeline }: { pipeline: PipelineRow }) {
  const v = pipeline.vocabulary ?? {};
  const [lead, setLead] = useState(v.lead ?? "Lead");
  const [deal, setDeal] = useState(v.deal ?? "Deal");
  const [won, setWon] = useState(v.won ?? "Ganho");
  const [lost, setLost] = useState(v.lost ?? "Perdido");
  const [reasonsText, setReasonsText] = useState(readLostReasons(pipeline.settings).join(", "));
  const [fieldsJson, setFieldsJson] = useState(
    JSON.stringify(readFields(pipeline.settings), null, 2),
  );
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    let fields: CustomFieldDef[] | undefined;
    try {
      const parsed = JSON.parse(fieldsJson);
      if (!Array.isArray(parsed)) throw new Error("not_array");
      fields = parsed as CustomFieldDef[];
    } catch {
      toast.error("Custom fields: JSON inválido. Esperado um array.");
      return;
    }
    const reasons = reasonsText
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const patch: PipelineConfigPatch = {
      vocabulary: { lead, deal, won, lost },
      fields: fields as PipelineConfigPatch["fields"],
      lost_reasons: reasons,
    };
    startTransition(async () => {
      const r = await updatePipelineConfig(pipeline.id, patch);
      if (r.ok) toast.success(`${pipeline.name} atualizado.`);
      else toast.error(`Erro: ${r.error}`);
    });
  }

  return (
    <div className="space-y-4 border-t border-border pt-6">
      <h3 className="text-sm font-semibold">Vocabulário e campos</h3>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="space-y-1">
          <Label className="text-xs">Lead</Label>
          <Input value={lead} onChange={(e) => setLead(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Deal</Label>
          <Input value={deal} onChange={(e) => setDeal(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Won</Label>
          <Input value={won} onChange={(e) => setWon(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Lost</Label>
          <Input value={lost} onChange={(e) => setLost(e.target.value)} />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Motivos de perda (separados por vírgula)</Label>
        <Input value={reasonsText} onChange={(e) => setReasonsText(e.target.value)} />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Custom fields (JSON array)</Label>
        <textarea
          value={fieldsJson}
          onChange={(e) => setFieldsJson(e.target.value)}
          className="min-h-32 w-full rounded-md border border-border bg-background p-2 font-mono text-xs"
          spellCheck={false}
        />
        <p className="text-xs text-muted-foreground">
          Ex: <code>{`[{ "key": "size", "label": "Tamanho", "type": "text" }]`}</code>
        </p>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? "Salvando…" : "Salvar vocabulário e campos"}
        </Button>
      </div>
    </div>
  );
}
