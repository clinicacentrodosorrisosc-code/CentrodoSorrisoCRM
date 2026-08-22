"use client";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CrmTask, CreateTaskInput, TaskPriority, TaskStatus } from "@/lib/types/tasks";
import { PRIORITY_CONFIG, STATUS_CONFIG } from "@/lib/types/tasks";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: CrmTask | null; // null = criar novo
  onSave: (input: CreateTaskInput) => Promise<unknown>;
  defaultDueDate?: string; // YYYY-MM-DD pré-preenchido
  leadId?: string | null;
  contactId?: string | null;
}

function toLocalDatetime(iso: string | null | undefined): { date: string; time: string } {
  if (!iso) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const date = tomorrow.toISOString().slice(0, 10);
    return { date, time: "09:00" };
  }
  const d = new Date(iso);
  const date = d.toISOString().slice(0, 10);
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return { date, time };
}

export function TaskFormDialog({
  open,
  onOpenChange,
  task,
  onSave,
  defaultDueDate,
  leadId,
  contactId,
}: Props) {
  const isEditing = !!task;

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [status, setStatus] = useState<TaskStatus>("pending");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      const initial = toLocalDatetime(task?.due_date);
      setTitle(task?.title ?? "");
      setDescription(task?.description ?? "");
      setDate(task?.due_date ? initial.date : defaultDueDate || initial.date);
      setTime(task?.due_date ? initial.time : "09:00");
      setPriority(task?.priority ?? "medium");
      setStatus(task?.status ?? "pending");
      setError(null);
    }
  }, [open, task, defaultDueDate]);

  function buildDueDate(): string {
    const localDatetime = `${date}T${time || "00:00"}:00`;
    return new Date(localDatetime).toISOString();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("O título da tarefa é obrigatório.");
      return;
    }
    if (!date.trim()) {
      setError("A data é obrigatória.");
      return;
    }
    if (!time.trim()) {
      setError("O horário é obrigatório.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim() || undefined,
        due_date: buildDueDate(),
        priority,
        status,
        lead_id: task?.lead_id ?? leadId ?? undefined,
        contact_id: task?.contact_id ?? contactId ?? undefined,
      });
      onOpenChange(false);
    } catch {
      setError("Erro ao salvar tarefa. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Tarefa" : "Agendar Nova Tarefa"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Título */}
          <div className="space-y-1.5">
            <Label htmlFor="task-title">
              Título da Tarefa <span className="text-destructive">*</span>
            </Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Ligar para confirmar consulta / Retorno de orçamento"
              autoFocus
            />
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <Label htmlFor="task-desc">Descrição / Observações</Label>
            <Textarea
              id="task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Detalhes adicionais sobre o que fazer..."
              className="resize-none"
            />
          </div>

          {/* Data + Horário (Obrigatórios) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="task-date">
                Data <span className="text-destructive">*</span>
              </Label>
              <Input
                id="task-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-time">
                Horário <span className="text-destructive">*</span>
              </Label>
              <Input
                id="task-time"
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>

          {/* Prioridade + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(PRIORITY_CONFIG) as [TaskPriority, typeof PRIORITY_CONFIG[TaskPriority]][]).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      <span className={cn("font-medium", cfg.color)}>{cfg.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(STATUS_CONFIG) as [TaskStatus, typeof STATUS_CONFIG[TaskStatus]][]).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      <span className={cn("font-medium", cfg.color)}>{cfg.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && (
            <div className="rounded bg-destructive/10 p-2 text-xs font-medium text-destructive">
              {error}
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : isEditing ? "Salvar alterações" : "Agendar tarefa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
