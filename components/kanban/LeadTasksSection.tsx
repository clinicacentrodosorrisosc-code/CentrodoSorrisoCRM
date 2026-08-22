"use client";
import { useState } from "react";
import { useTasks } from "@/hooks/tasks/useTasks";
import { TaskFormDialog } from "@/app/app/tasks/_components/TaskFormDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CrmTask, CreateTaskInput } from "@/lib/types/tasks";
import { PRIORITY_CONFIG, formatDueDate, isOverdue } from "@/lib/types/tasks";
import {
  CheckSquare,
  Plus,
  PencilSimple,
  Trash,
  CalendarBlank,
  Check,
  Clock,
} from "@/lib/ui/icons";

interface Props {
  leadId: string;
  contactId?: string | null;
}

export function LeadTasksSection({ leadId, contactId }: Props) {
  const { tasks, isLoading, createTask, updateTask, deleteTask, toggleDone } = useTasks({
    lead_id: leadId,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<CrmTask | null>(null);

  const pendingTasks = tasks.filter((t) => t.status === "pending" || t.status === "in_progress");
  const doneTasks = tasks.filter((t) => t.status === "done" || t.status === "cancelled");

  function openNew() {
    setEditingTask(null);
    setDialogOpen(true);
  }

  function openEdit(task: CrmTask) {
    setEditingTask(task);
    setDialogOpen(true);
  }

  async function handleSave(input: CreateTaskInput) {
    if (editingTask) {
      await updateTask(editingTask.id, input);
    } else {
      await createTask({
        ...input,
        lead_id: leadId,
        contact_id: contactId ?? undefined,
      });
    }
  }

  async function handleDelete(task: CrmTask) {
    if (!confirm(`Excluir a tarefa "${task.title}"?`)) return;
    await deleteTask(task.id);
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CheckSquare size={16} weight="bold" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-text">
              Tarefas do Lead
            </h4>
            <p className="text-[11px] text-text-muted">
              {pendingTasks.length > 0
                ? `${pendingTasks.length} tarefa(s) pendente(s)`
                : "Nenhuma tarefa pendente"}
            </p>
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={openNew}
          className="h-8 gap-1 text-xs border-dashed hover:border-primary hover:text-primary"
        >
          <Plus size={13} />
          Agendar Tarefa
        </Button>
      </div>

      {/* Lista de tarefas do lead */}
      {isLoading ? (
        <div className="h-16 rounded-lg bg-muted/40 animate-pulse" />
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center text-text-muted rounded-lg bg-muted/20 border border-dashed border-border">
          <Clock size={20} className="mb-1.5 opacity-50 text-primary" />
          <p className="text-xs font-medium text-text">Sem tarefas agendadas</p>
          <p className="text-[11px] text-text-muted mt-0.5">
            Agende um retorno, ligação ou envio de proposta com data e hora.
          </p>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={openNew}
            className="mt-2 h-7 text-xs text-primary hover:bg-primary/10"
          >
            + Adicionar primeira tarefa
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Tarefas Pendentes */}
          {pendingTasks.map((task) => {
            const prio = PRIORITY_CONFIG[task.priority];
            const overdue = isOverdue(task);

            return (
              <div
                key={task.id}
                className={cn(
                  "group flex items-start gap-2.5 rounded-lg border p-2.5 transition-colors",
                  overdue
                    ? "border-red-200 bg-red-50/40 dark:border-red-900/40 dark:bg-red-950/20"
                    : "border-border bg-background hover:bg-muted/30",
                )}
              >
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={false}
                  onClick={() => toggleDone(task)}
                  className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-muted-foreground/40 hover:border-primary hover:bg-primary/10 transition-colors"
                  title="Marcar como concluída"
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-semibold text-text truncate">
                      {task.title}
                    </span>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.2 text-[9px] font-bold",
                        prio.bg,
                        prio.color,
                      )}
                    >
                      {prio.label}
                    </span>
                  </div>

                  {task.description && (
                    <p className="mt-0.5 text-[11px] text-text-muted line-clamp-2">
                      {task.description}
                    </p>
                  )}

                  {task.due_date && (
                    <div
                      className={cn(
                        "mt-1 flex items-center gap-1 text-[10px] font-medium",
                        overdue
                          ? "text-red-600 dark:text-red-400 font-bold"
                          : "text-text-muted",
                      )}
                    >
                      <CalendarBlank size={11} />
                      {overdue ? "⚠️ Atrasada: " : "Vence: "}
                      {formatDueDate(task.due_date)}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => openEdit(task)}
                    title="Editar tarefa"
                  >
                    <PencilSimple size={12} />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(task)}
                    title="Excluir tarefa"
                  >
                    <Trash size={12} />
                  </Button>
                </div>
              </div>
            );
          })}

          {/* Tarefas Concluídas */}
          {doneTasks.length > 0 && (
            <div className="pt-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                Concluídas ({doneTasks.length})
              </span>
              <div className="mt-1 space-y-1.5">
                {doneTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-muted/20 px-2.5 py-1.5 opacity-60"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={true}
                        onClick={() => toggleDone(task)}
                        className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded bg-primary text-primary-foreground"
                        title="Reabrir tarefa"
                      >
                        <Check size={10} weight="bold" />
                      </button>
                      <span className="text-xs text-text-muted line-through truncate">
                        {task.title}
                      </span>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-text-muted hover:text-destructive"
                      onClick={() => handleDelete(task)}
                      title="Excluir"
                    >
                      <Trash size={11} />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal de criação / edição */}
      <TaskFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editingTask}
        onSave={handleSave}
        leadId={leadId}
        contactId={contactId}
      />
    </div>
  );
}
