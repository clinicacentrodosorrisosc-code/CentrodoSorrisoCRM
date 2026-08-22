"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CrmTask } from "@/lib/types/tasks";
import { PRIORITY_CONFIG, formatDueDate, isOverdue } from "@/lib/types/tasks";
import { PencilSimple, Trash, CalendarBlank, Check, ArrowSquareOut } from "@/lib/ui/icons";

interface Props {
  tasks: CrmTask[];
  onToggleDone: (task: CrmTask) => Promise<void>;
  onEdit: (task: CrmTask) => void;
  onDelete: (task: CrmTask) => Promise<void>;
}

type Group = { label: string; emoji: string; tasks: CrmTask[] };

function groupTasks(tasks: CrmTask[]): Group[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 86400000);
  const weekEnd = new Date(todayStart.getTime() + 7 * 86400000);

  const overdue: CrmTask[] = [];
  const today: CrmTask[] = [];
  const thisWeek: CrmTask[] = [];
  const later: CrmTask[] = [];
  const noDate: CrmTask[] = [];
  const done: CrmTask[] = [];

  for (const t of tasks) {
    if (t.status === "done" || t.status === "cancelled") { done.push(t); continue; }
    if (!t.due_date) { noDate.push(t); continue; }
    const d = new Date(t.due_date);
    if (d < todayStart) { overdue.push(t); continue; }
    if (d >= todayStart && d < todayEnd) { today.push(t); continue; }
    if (d >= todayEnd && d < weekEnd) { thisWeek.push(t); continue; }
    later.push(t);
  }

  return [
    { label: "Atrasadas", emoji: "🔴", tasks: overdue },
    { label: "Hoje", emoji: "⚡", tasks: today },
    { label: "Esta semana", emoji: "📅", tasks: thisWeek },
    { label: "Mais tarde", emoji: "🔵", tasks: later },
    { label: "Sem data", emoji: "⚪", tasks: noDate },
    { label: "Concluídas", emoji: "✅", tasks: done },
  ].filter((g) => g.tasks.length > 0);
}

function TaskRow({
  task,
  onToggleDone,
  onEdit,
  onDelete,
}: {
  task: CrmTask;
  onToggleDone: (t: CrmTask) => Promise<void>;
  onEdit: (t: CrmTask) => void;
  onDelete: (t: CrmTask) => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const isDone = task.status === "done" || task.status === "cancelled";
  const overdue = isOverdue(task);
  const prio = PRIORITY_CONFIG[task.priority];
  const isAgendamento = task.kind === "agendamento";

  async function handleToggle() {
    if (isAgendamento) return;
    setLoading(true);
    try { await onToggleDone(task); } finally { setLoading(false); }
  }

  return (
    <div className={cn(
      "group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/40",
      isDone && "opacity-60",
      isAgendamento && "bg-sky-50/40 dark:bg-sky-950/20",
    )}>
      {/* Checkbox customizado acessível */}
      <button
        type="button"
        role="checkbox"
        aria-checked={isDone}
        onClick={handleToggle}
        disabled={loading || isAgendamento}
        className={cn(
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
          isAgendamento
            ? "border-sky-400 bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300 cursor-default"
            : isDone
              ? "border-primary bg-primary text-primary-foreground"
              : "border-muted-foreground/40 hover:border-primary",
        )}
        title={isAgendamento ? "Agendamento do Lead" : "Marcar como concluída"}
      >
        {isAgendamento ? <span className="text-[9px]">📅</span> : isDone ? <Check size={12} weight="bold" aria-hidden /> : null}
      </button>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">
        <button
          type="button"
          onClick={() => onEdit(task)}
          className={cn(
            "text-left block text-sm font-medium text-foreground hover:text-primary transition-colors",
            isDone && "line-through text-muted-foreground hover:text-muted-foreground",
          )}
        >
          {task.title}
        </button>
        {task.description && (
          <p className="mt-0.5 text-xs text-muted-foreground truncate">{task.description}</p>
        )}

        {/* Meta info */}
        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
          {isAgendamento ? (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-300 border border-sky-400/30 px-2 py-0.5 text-[10px] font-bold">
              🗓️ Agendamento
            </span>
          ) : (
            <span className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold",
              prio.bg, prio.color,
            )}>
              {prio.label}
            </span>
          )}

          {task.due_date && (
            <span className={cn(
              "inline-flex items-center gap-1 text-[11px]",
              overdue ? "text-red-500 dark:text-red-400 font-medium" : "text-muted-foreground",
            )}>
              <CalendarBlank size={11} aria-hidden />
              {formatDueDate(task.due_date)}
            </span>
          )}
        </div>
      </div>

      {/* Ações */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {isAgendamento ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs gap-1 text-sky-700 dark:text-sky-300 hover:bg-sky-100"
            onClick={() => onEdit(task)}
          >
            <ArrowSquareOut size={13} />
            Ver Lead
          </Button>
        ) : (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onEdit(task)}
              aria-label="Editar tarefa"
            >
              <PencilSimple size={14} aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => onDelete(task)}
              aria-label="Excluir tarefa"
            >
              <Trash size={14} aria-hidden />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export function TaskListView({ tasks, onToggleDone, onEdit, onDelete }: Props) {
  const groups = groupTasks(tasks);

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <div className="text-5xl">✅</div>
        <p className="text-sm font-medium text-foreground">Nenhum item encontrado</p>
        <p className="text-xs text-muted-foreground">Não há tarefas ou agendamentos com os filtros selecionados.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.label} className="space-y-1">
          <div className="flex items-center gap-2 px-3 pb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {group.emoji} {group.label}
            </span>
            <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-medium">
              {group.tasks.length}
            </Badge>
          </div>
          <div className="rounded-lg border bg-card/50 divide-y">
            {group.tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onToggleDone={onToggleDone}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
