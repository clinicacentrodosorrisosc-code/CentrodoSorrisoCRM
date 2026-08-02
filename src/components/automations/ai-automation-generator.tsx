"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Sparkles,
  Loader2,
  RefreshCw,
  Wand2,
  Zap,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ChevronRight,
  MessageSquare,
  Clock,
  Tag,
  UserCheck,
  Webhook,
  GitBranch,
  CircleSlash,
  Briefcase,
  Hourglass,
  PencilLine,
  TagIcon,
  FileText,
  X,
  ExternalLink,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// ─── Types ────────────────────────────────────────────────────────────────────

interface GeneratedStep {
  step_type: string
  step_config: Record<string, unknown>
}

interface GeneratedAutomation {
  name: string
  description?: string
  trigger_type: string
  trigger_config: Record<string, unknown>
  steps: GeneratedStep[]
}

interface AiAutomationGeneratorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: () => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TRIGGER_LABELS: Record<string, string> = {
  new_message_received: "Nova Mensagem Recebida",
  first_inbound_message: "Primeira Mensagem do Contato",
  keyword_match: "Palavra-chave",
  interactive_reply: "Resposta de Botão",
  new_contact_created: "Novo Contato Criado",
  conversation_assigned: "Conversa Atribuída",
  tag_added: "Tag Adicionada",
  time_based: "Agendado",
}

const STEP_LABELS: Record<string, string> = {
  send_message: "Enviar Mensagem",
  send_buttons: "Enviar Botões",
  send_list: "Enviar Lista",
  send_template: "Enviar Modelo",
  add_tag: "Adicionar Tag",
  remove_tag: "Remover Tag",
  assign_conversation: "Atribuir Conversa",
  update_contact_field: "Atualizar Campo",
  create_deal: "Criar Negócio",
  wait: "Aguardar",
  condition: "Condição (Se/Senão)",
  send_webhook: "Enviar Webhook",
  close_conversation: "Fechar Conversa",
}

const STEP_ICONS: Record<string, React.ElementType> = {
  send_message: MessageSquare,
  send_buttons: MessageSquare,
  send_list: MessageSquare,
  send_template: FileText,
  add_tag: Tag,
  remove_tag: TagIcon,
  assign_conversation: UserCheck,
  update_contact_field: PencilLine,
  create_deal: Briefcase,
  wait: Hourglass,
  condition: GitBranch,
  send_webhook: Webhook,
  close_conversation: CircleSlash,
}

const STEP_COLORS: Record<string, string> = {
  send_message: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  send_buttons: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  send_list: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  send_template: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  add_tag: "bg-green-500/10 text-green-400 border-green-500/20",
  remove_tag: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  assign_conversation: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  update_contact_field: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  create_deal: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  wait: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  condition: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  send_webhook: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  close_conversation: "bg-red-500/10 text-red-400 border-red-500/20",
}

const EXAMPLE_PROMPTS = [
  "Quando receber a palavra 'preço', envie uma mensagem perguntando sobre o interesse e atribua para um agente",
  "Responder automaticamente fora do horário comercial (18h-9h) com mensagem de ausência",
  "Quando um novo contato enviar a primeira mensagem, dê as boas-vindas e adicione a tag 'novo-lead'",
  "Aguardar 24 horas sem resposta e enviar um lembrete amigável",
]

// ─── Step summary helper ───────────────────────────────────────────────────────

function stepSummary(step: GeneratedStep): string {
  const c = step.step_config
  switch (step.step_type) {
    case "send_message":
      return typeof c.text === "string"
        ? `"${c.text.slice(0, 60)}${c.text.length > 60 ? "…" : ""}"`
        : ""
    case "add_tag":
    case "remove_tag":
      return c.tag_id ? `Tag: ${c.tag_id}` : "Tag a definir no builder"
    case "assign_conversation":
      return c.mode === "round_robin" ? "Modo rodízio" : "Agente específico"
    case "wait": {
      const unit = c.unit === "minutes" ? "min" : c.unit === "hours" ? "h" : "d"
      return `${c.amount}${unit}`
    }
    case "condition":
      return `Verificar: ${c.subject ?? ""}`
    case "send_template":
      return c.template_name ? `Modelo: ${c.template_name}` : "Modelo a escolher"
    case "create_deal":
      return c.title ? `"${c.title}"` : "Negócio a configurar"
    case "send_webhook":
      return typeof c.url === "string" ? c.url.slice(0, 50) : "URL a configurar"
    case "close_conversation":
      return "Fecha a conversa"
    default:
      return ""
  }
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function AiAutomationGenerator({
  open,
  onOpenChange,
  onCreated,
}: AiAutomationGeneratorProps) {
  const router = useRouter()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [prompt, setPrompt] = useState("")
  const [state, setState] = useState<"idle" | "loading" | "result" | "creating">("idle")
  const [generated, setGenerated] = useState<GeneratedAutomation | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dots, setDots] = useState("")

  // Animated dots while loading
  useEffect(() => {
    if (state !== "loading") return
    const interval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "" : d + "."))
    }, 400)
    return () => clearInterval(interval)
  }, [state])

  // Pre-computed so TypeScript doesn't narrow it to `never` inside JSX blocks
  const isCreating = state === "creating"

  // Focus textarea when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [open])

  function handleClose() {
    if (state === "loading" || state === "creating") return
    onOpenChange(false)
    setTimeout(() => {
      setState("idle")
      setGenerated(null)
      setError(null)
    }, 300)
  }

  async function generate() {
    if (!prompt.trim() || state === "loading") return
    setState("loading")
    setError(null)
    setGenerated(null)

    try {
      const res = await fetch("/api/ai/generate-automation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      })
      const data = await res.json()

      if (!res.ok) {
        if (data?.code === "ai_not_configured") {
          setError(
            "Assistente de IA não configurado. Vá em Configurações → Agente IA para adicionar sua chave de API.",
          )
        } else {
          setError(data?.error ?? "Erro ao gerar automação. Tente novamente.")
        }
        setState("idle")
        return
      }

      setGenerated(data.automation)
      setState("result")
    } catch {
      setError("Erro de conexão. Verifique sua internet e tente novamente.")
      setState("idle")
    }
  }

  async function createAutomation(activate: boolean) {
    if (!generated) return
    setState("creating")

    try {
      const res = await fetch("/api/automations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: generated.name,
          description: generated.description ?? null,
          trigger_type: generated.trigger_type,
          trigger_config: generated.trigger_config ?? {},
          steps: generated.steps,
          is_active: activate,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.error ?? "Falha ao criar automação")
        setState("result")
        return
      }

      toast.success(
        activate ? "Automação criada e ativada!" : "Automação criada como rascunho!",
      )
      onCreated?.()
      handleClose()

      // Redirect to builder for final adjustments
      router.push(`/automations/${data.automation.id}/edit`)
    } catch {
      toast.error("Erro de conexão ao criar automação")
      setState("result")
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      generate()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-2xl overflow-hidden border-0 p-0"
        style={{
          background:
            "linear-gradient(135deg, hsl(var(--background)) 0%, hsl(var(--card)) 100%)",
          boxShadow:
            "0 0 0 1px hsl(var(--border)), 0 25px 50px -12px rgba(0,0,0,0.5), 0 0 80px -20px hsl(var(--primary)/0.15)",
        }}
      >
        {/* Header */}
        <div className="relative overflow-hidden px-6 pb-4 pt-6">
          {/* Background glow */}
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              background:
                "radial-gradient(ellipse 60% 40% at 50% 0%, hsl(var(--primary)/0.4), transparent)",
            }}
          />
          <DialogHeader className="relative">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(271 91% 65%) 100%)",
                  boxShadow: "0 0 20px hsl(var(--primary)/0.4)",
                }}
              >
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-foreground">
                  Criar Automação com IA
                </DialogTitle>
                <p className="text-xs text-muted-foreground">
                  Descreva o que a automação deve fazer em linguagem natural
                </p>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-6 pb-6">
          {/* Prompt input */}
          <div className="space-y-2">
            <Textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ex: Quando receber a palavra 'preço', envie uma mensagem perguntando o interesse e atribua para um agente..."
              disabled={state === "loading" || state === "creating"}
              className="min-h-[100px] resize-none border-border/60 bg-background/50 text-sm placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
              maxLength={1000}
            />
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground">
                {prompt.length}/1000 · Ctrl+Enter para gerar
              </p>
              <Button
                onClick={generate}
                disabled={!prompt.trim() || state === "loading" || state === "creating"}
                size="sm"
                className="gap-2"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(271 91% 65%) 100%)",
                }}
              >
                {state === "loading" ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Gerando{dots}
                  </>
                ) : (
                  <>
                    <Wand2 className="h-3.5 w-3.5" />
                    {state === "result" ? "Regenerar" : "Gerar Automação"}
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Example prompts — only in idle state */}
          {state === "idle" && !error && (
            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
                Exemplos de prompts
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {EXAMPLE_PROMPTS.map((ex, i) => (
                  <button
                    key={i}
                    onClick={() => setPrompt(ex)}
                    className="group flex items-start gap-2 rounded-lg border border-border/40 bg-muted/30 px-3 py-2 text-left transition-all hover:border-primary/30 hover:bg-primary/5"
                  >
                    <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-primary/60" />
                    <span className="text-[11px] leading-relaxed text-muted-foreground group-hover:text-foreground/80">
                      {ex}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-destructive">Erro ao gerar</p>
                <p className="text-xs text-destructive/80">{error}</p>
                {error.includes("Configurações") && (
                  <button
                    onClick={() => {
                      handleClose()
                      router.push("/settings/agents")
                    }}
                    className="mt-2 flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    Ir para Configurações <ExternalLink className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Loading state — animated */}
          {state === "loading" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="relative">
                <div
                  className="absolute inset-0 animate-ping rounded-full opacity-30"
                  style={{
                    background:
                      "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)",
                  }}
                />
                <div
                  className="relative flex h-16 w-16 items-center justify-center rounded-full"
                  style={{
                    background:
                      "linear-gradient(135deg, hsl(var(--primary)/0.2) 0%, hsl(271 91% 65%/0.2) 100%)",
                    boxShadow:
                      "0 0 30px hsl(var(--primary)/0.2), inset 0 0 20px hsl(var(--primary)/0.1)",
                  }}
                >
                  <Sparkles className="h-7 w-7 animate-pulse text-primary" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">
                  IA analisando seu prompt{dots}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Gerando gatilho, etapas e configurações
                </p>
              </div>
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/60"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Result preview */}
          {state === "result" && generated && (
            <div className="space-y-4">
              {/* Success badge */}
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-400" />
                <span className="text-sm font-medium text-green-400">Automação gerada!</span>
                <span className="text-xs text-muted-foreground">Revise antes de criar</span>
              </div>

              {/* Automation preview card */}
              <div
                className="overflow-hidden rounded-xl border border-border/60"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--card)/0.8) 100%)",
                }}
              >
                {/* Header */}
                <div className="flex items-start gap-3 border-b border-border/40 p-4">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                    style={{
                      background:
                        "linear-gradient(135deg, hsl(var(--primary)/0.2) 0%, hsl(271 91% 65%/0.2) 100%)",
                    }}
                  >
                    <Zap className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-foreground">{generated.name}</h3>
                    {generated.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {generated.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Trigger */}
                <div className="flex items-center gap-3 border-b border-border/40 px-4 py-3">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60 w-16 shrink-0">
                    Gatilho
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    <Zap className="h-3 w-3" />
                    {TRIGGER_LABELS[generated.trigger_type] ?? generated.trigger_type}
                  </span>
                  {generated.trigger_config &&
                    "keywords" in generated.trigger_config && (
                      <span className="text-xs text-muted-foreground">
                        {(generated.trigger_config.keywords as string[]).slice(0, 3).join(", ")}
                        {(generated.trigger_config.keywords as string[]).length > 3 && "…"}
                      </span>
                    )}
                </div>

                {/* Steps */}
                <div className="p-4 space-y-2">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
                    {generated.steps.length} {generated.steps.length === 1 ? "Etapa" : "Etapas"}
                  </span>
                  <div className="space-y-2 mt-2">
                    {generated.steps.map((step, i) => {
                      const Icon = STEP_ICONS[step.step_type] ?? Zap
                      const colorClass =
                        STEP_COLORS[step.step_type] ??
                        "bg-muted/50 text-muted-foreground border-border/40"
                      const summary = stepSummary(step)
                      return (
                        <div key={i} className="flex items-start gap-3">
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                              {i + 1}
                            </span>
                            {i < generated.steps.length - 1 && (
                              <div className="absolute ml-2.5 mt-5 h-2 w-px bg-border/60" />
                            )}
                          </div>
                          <div
                            className={cn(
                              "flex flex-1 items-center gap-2 rounded-lg border px-3 py-2",
                              colorClass,
                            )}
                          >
                            <Icon className="h-3.5 w-3.5 shrink-0" />
                            <span className="text-xs font-medium">
                              {STEP_LABELS[step.step_type] ?? step.step_type}
                            </span>
                            {summary && (
                              <>
                                <span className="text-[10px] opacity-40">·</span>
                                <span className="text-[11px] opacity-70 truncate">{summary}</span>
                              </>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* AI disclaimer */}
                <div className="flex items-center gap-2 border-t border-border/40 px-4 py-2.5 bg-muted/20">
                  <Sparkles className="h-3 w-3 text-muted-foreground/50" />
                  <p className="text-[11px] text-muted-foreground/60">
                    Gerado por IA · Revise as configurações no builder antes de ativar
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setState("idle")
                    setGenerated(null)
                  }}
                  className="gap-2"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Gerar Novamente
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => createAutomation(false)}
                  disabled={isCreating}
                  className="gap-2"
                >
                  {isCreating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ArrowRight className="h-3.5 w-3.5" />
                  )}
                  Abrir no Builder
                </Button>
                <Button
                  size="sm"
                  onClick={() => createAutomation(true)}
                  disabled={isCreating}
                  className="gap-2"
                  style={{
                    background:
                      "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(271 91% 65%) 100%)",
                  }}
                >
                  {isCreating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Zap className="h-3.5 w-3.5" />
                  )}
                  Criar e Ativar
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
