/**
 * Tipos do módulo de Tarefas e Agendamentos do CRM.
 */

export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "pending" | "in_progress" | "done" | "cancelled";
export type ItemKind = "task" | "agendamento";

export interface CrmTask {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  due_date: string | null; // ISO 8601 com timezone
  priority: TaskPriority;
  status: TaskStatus;
  lead_id: string | null;
  contact_id: string | null;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  kind?: ItemKind; // "task" | "agendamento"
  agendamento_status?: "agendado" | "confirmado" | "compareceu" | "faltou" | "remarcado" | "cancelado";
  lead_title?: string | null;
  procedimento?: string | null;
  // Joins opcionais retornados pela API
  assigned_user?: { id: string; full_name: string | null; avatar_url: string | null } | null;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  due_date?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
  lead_id?: string | null;
  contact_id?: string | null;
  assigned_to?: string | null;
}

export type UpdateTaskInput = Partial<CreateTaskInput> & { status?: TaskStatus };

export const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; bg: string }> = {
  low:    { label: "Baixa",   color: "text-slate-500",                     bg: "bg-slate-100 dark:bg-slate-800" },
  medium: { label: "Média",   color: "text-blue-600 dark:text-blue-400",   bg: "bg-blue-50 dark:bg-blue-900/30" },
  high:   { label: "Alta",    color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/30" },
  urgent: { label: "Urgente", color: "text-red-600 dark:text-red-400",     bg: "bg-red-50 dark:bg-red-900/30" },
};

export const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string }> = {
  pending:     { label: "Pendente",     color: "text-muted-foreground" },
  in_progress: { label: "Em andamento", color: "text-blue-600 dark:text-blue-400" },
  done:        { label: "Concluída",    color: "text-emerald-600 dark:text-emerald-400" },
  cancelled:   { label: "Cancelada",   color: "text-slate-400" },
};

/** Formata due_date em texto amigável em pt-BR */
export function formatDueDate(iso: string | null): string {
  if (!iso) return "Sem data";
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 86400000);
  const taskDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (taskDay.getTime() === today.getTime()) {
    return `Hoje, ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  }
  if (taskDay.getTime() === tomorrow.getTime()) {
    return `Amanhã, ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Verifica se a tarefa está atrasada */
export function isOverdue(task: CrmTask): boolean {
  if (!task.due_date) return false;
  if (task.status === "done" || task.status === "cancelled") return false;
  return new Date(task.due_date) < new Date();
}
