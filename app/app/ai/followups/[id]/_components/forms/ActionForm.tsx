"use client";

import { useState } from "react";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { actionConfigSchema } from "@/lib/followup/graph-schema";
import { MODOS_DA_ACAO, opcoes, type ModoDaAcao } from "@/lib/followup/vocabulario";
import { useMessageTemplates } from "@/hooks/inbox/useMessageTemplates";
import { useTemplates } from "@/hooks/channels/useTemplates";

import type { ConfigOf } from "./shared";

/**
 * Seletor de modelo que integra os modelos do WhatsApp Oficial (Meta)
 * e os modelos rápidos do Inbox.
 */
function SeletorDeModelo({
  id,
  valor,
  onChange,
  permiteVazio,
}: {
  id: string;
  valor: string;
  onChange: (templateId: string) => void;
  permiteVazio: boolean;
}) {
  const { data: modelosInbox, isLoading: loadingInbox } = useMessageTemplates();
  const { data: metaPayload, isLoading: loadingMeta } = useTemplates();

  const metaTemplates = (metaPayload as unknown as { data?: { templates?: Array<{ name: string; language: string; status: string }> }; templates?: Array<{ name: string; language: string; status: string }> })?.data?.templates
    ?? (metaPayload as unknown as { templates?: Array<{ name: string; language: string; status: string }> })?.templates
    ?? [];
  const inboxTemplates = modelosInbox ?? [];
  const isLoading = loadingInbox || loadingMeta;

  if (isLoading) return <p className="text-xs text-muted-foreground">Carregando seus modelos…</p>;

  const totalTemplates = metaTemplates.length + inboxTemplates.length;

  if (totalTemplates === 0) {
    return (
      <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
        Nenhum modelo encontrado. Conecte o canal oficial e sincronize seus templates em <strong>Conexões → Canal Oficial</strong>.
      </div>
    );
  }

  const SEM_MODELO = "__nenhum__";
  return (
    <Select
      value={valor === "" ? SEM_MODELO : valor}
      onValueChange={(v) => onChange(v === SEM_MODELO ? "" : v)}
    >
      <SelectTrigger id={id} className="text-sm">
        <SelectValue placeholder="Escolha um modelo de mensagem" />
      </SelectTrigger>
      <SelectContent>
        {permiteVazio && <SelectItem value={SEM_MODELO}>Nenhum</SelectItem>}

        {metaTemplates.length > 0 && (
          <SelectGroup>
            <SelectLabel className="text-xs font-semibold text-primary">
              WhatsApp Oficial (Templates Meta)
            </SelectLabel>
            {metaTemplates.map((m) => (
              <SelectItem key={`${m.name}-${m.language}`} value={m.name}>
                <div className="flex items-center gap-2">
                  <span className="text-xs">
                    {m.status === "APPROVED" ? "🟢" : "🟡"} <strong>{m.name}</strong> ({m.language})
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
        )}

        {inboxTemplates.length > 0 && (
          <SelectGroup>
            <SelectLabel className="text-xs font-semibold text-muted-foreground">
              Modelos Rápidos (Inbox)
            </SelectLabel>
            {inboxTemplates.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                💬 {m.title}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  );
}

export function ActionForm({
  config,
  onChange,
}: {
  config: ConfigOf<"action">;
  onChange: (c: ConfigOf<"action">) => void;
}) {
  const [mode, setMode] = useState(config.mode);
  const [promptHint, setPromptHint] = useState(config.mode === "ai_message" ? config.prompt_hint : "");
  const [fallbackTemplateId, setFallbackTemplateId] = useState(
    config.mode === "ai_message" ? (config.fallback_template_id ?? "") : "",
  );
  const [templateId, setTemplateId] = useState(config.mode === "template" ? config.template_id : "");
  const [error, setError] = useState<string | null>(null);

  const commit = (next: {
    mode: ModoDaAcao;
    promptHint: string;
    fallbackTemplateId: string;
    templateId: string;
  }) => {
    const candidate =
      next.mode === "ai_message"
        ? {
            mode: "ai_message" as const,
            prompt_hint: next.promptHint,
            ...(next.fallbackTemplateId.trim() ? { fallback_template_id: next.fallbackTemplateId } : {}),
          }
        : { mode: "template" as const, template_id: next.templateId };
    const parsed = actionConfigSchema.safeParse(candidate);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Configuração inválida.");
      return;
    }
    setError(null);
    onChange(parsed.data);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="action-mode">Como escrever a mensagem</Label>
        <Select
          value={mode}
          onValueChange={(v) => {
            const next = v as ModoDaAcao;
            setMode(next);
            commit({ mode: next, promptHint, fallbackTemplateId, templateId });
          }}
        >
          <SelectTrigger id="action-mode">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {opcoes(MODOS_DA_ACAO).map(({ valor, rotulo }) => (
              <SelectItem key={valor} value={valor}>
                {rotulo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {mode === "ai_message" ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="action-prompt-hint">Instrução para a IA</Label>
            <Textarea
              id="action-prompt-hint"
              maxLength={1000}
              value={promptHint}
              onChange={(e) => {
                setPromptHint(e.target.value);
                commit({ mode, promptHint: e.target.value, fallbackTemplateId, templateId });
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="action-fallback">Se a IA não conseguir escrever, mandar este modelo</Label>
            <SeletorDeModelo
              id="action-fallback"
              valor={fallbackTemplateId}
              permiteVazio
              onChange={(v) => {
                setFallbackTemplateId(v);
                commit({ mode, promptHint, fallbackTemplateId: v, templateId });
              }}
            />
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="action-template-id">Modelo de mensagem</Label>
            <SeletorDeModelo
              id="action-template-id"
              valor={templateId}
              permiteVazio={false}
              onChange={(v) => {
                setTemplateId(v);
                commit({ mode, promptHint, fallbackTemplateId, templateId: v });
              }}
            />
          </div>

          {templateId && (
            <div className="space-y-2 rounded-md border border-primary/20 bg-primary/5 p-3 text-xs">
              <p className="font-semibold text-primary">📌 Variáveis e Campos Personalizados:</p>
              <div className="space-y-1 text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Variável <code>{"{{1}}"}</code></span>
                  <span className="font-medium text-foreground">🏷️ Título do Lead</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Variável <code>{"{{2}}"}</code></span>
                  <span className="font-medium text-foreground">📅 Data e Hora da Consulta</span>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground pt-1 border-t border-primary/10 leading-relaxed">
                As variáveis são extraídas automaticamente do card do Lead (o <strong>Título do Lead</strong> para a variável 1, e <code>agendamento_data</code> / <code>agendamento_hora</code> para a variável 2) no momento exato do disparo.
              </p>
            </div>
          )}
        </div>
      )}
      {error && <p className="text-xs text-error-fg">{error}</p>}
    </div>
  );
}
