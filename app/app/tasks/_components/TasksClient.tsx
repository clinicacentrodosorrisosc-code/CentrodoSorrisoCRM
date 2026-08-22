"use client";
import { useState } from "react";
import { useTasks } from "@/hooks/tasks/useTasks";
import { TaskListView } from "./TaskListView";
import { TaskCalendarView } from "./TaskCalendarView";
import { TaskFormDialog } from "./TaskFormDialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { CrmTask, CreateTaskInput, TaskStatus, ItemKind } from "@/lib/types/tasks";
import { Plus, ListChecks, CalendarBlank, ArrowsClockwise } from "@/lib/ui/icons";

type ViewMode = "list" | "calendar";

export function TasksClient() {
  const [view, setView] = useState<ViewMode>("calendar");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [kindFilter, setKindFilter] = useState<"all" | "tasks" | "agendamentos" | "faltou" | "compareceu">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<CrmTask | null>(null);
  const [prefilledDate, setPrefilledDate] = useState<string | undefined>();

  const apiKind: "all" | "tasks" | "agendamentos" =
    kindFilter === "tasks" ? "tasks" : kindFilter === "all" ? "all" : "agendamentos";
  // Aplica filtro de status e tipo
  const swrFilter = {
    status: statusFilter === "active" ? undefined : (statusFilter as TaskStatus),
    kind: apiKind,
  };

  const { tasks, isLoading, isError, mutate, createTask, updateTask, deleteTask, toggleDone } = useTasks(swrFilter);

  // Filtragem local para o modo "active" e status de presença
  const filteredTasks = tasks.filter((t: CrmTask) => {
    if (statusFilter === "active" && t.kind !== "agendamento" && t.status !== "pending" && t.status !== "in_progress") {
      return false;
    }
    if (kindFilter === "faltou") {
      return t.kind === "agendamento" && t.agendamento_status === "faltou";
    }
    if (kindFilter === "compareceu") {
      return t.kind === "agendamento" && t.agendamento_status === "compareceu";
    }
    return true;
  });

  function openNew(date?: string) {
    setEditingTask(null);
    setPrefilledDate(date);
    setDialogOpen(true);
  }

  function openEdit(task: CrmTask) {
    if (task.kind === "agendamento") {
      // Abre o Lead no Kanban
      if (task.lead_id) {
        window.open(`/app/kanban?leadId=${task.lead_id}`, "_blank");
      }
      return;
    }
    setEditingTask(task);
    setPrefilledDate(undefined);
    setDialogOpen(true);
  }

  async function handleSave(input: CreateTaskInput) {
    if (editingTask) {
      await updateTask(editingTask.id, input);
    } else {
      await createTask(input);
    }
  }

  async function handleDelete(task: CrmTask) {
    if (task.kind === "agendamento") {
      alert("Para alterar ou cancelar este agendamento, edite diretamente os dados do Lead.");
      return;
    }
    if (!confirm(`Excluir "${task.title}"?`)) return;
    await deleteTask(task.id);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Tarefas & Agendamentos</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe suas atividades, retornos e agendamentos de consultas no mesmo calendário.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Filtro de Tipo (Todos / Tarefas / Agendamentos / Faltas) */}
          <Select value={kindFilter} onValueChange={(v) => setKindFilter(v as typeof kindFilter)}>
            <SelectTrigger className="w-[190px] h-9 text-xs font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Itens</SelectItem>
              <SelectItem value="tasks">Apenas Tarefas</SelectItem>
              <SelectItem value="agendamentos">Todos Agendamentos</SelectItem>
              <SelectItem value="faltou">🔴 Faltas (Não Compareceu)</SelectItem>
              <SelectItem value="compareceu">🟢 Compareceram</SelectItem>
            </SelectContent>
          </Select>

          {/* Filtro de status */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Status: Ativas</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="in_progress">Em andamento</SelectItem>
              <SelectItem value="done">Concluídas</SelectItem>
              <SelectItem value="cancelled">Canceladas</SelectItem>
            </SelectContent>
          </Select>

          {/* Toggle de visualização (Calendário / Lista) */}
          <div className="flex items-center rounded-md border bg-muted p-0.5 gap-0.5">
            <button
              type="button"
              onClick={() => setView("calendar")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-all",
                view === "calendar"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <CalendarBlank size={14} aria-hidden /> Calendário
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-all",
                view === "list"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <ListChecks size={14} aria-hidden /> Lista
            </button>
          </div>

          {/* Atualizar */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => mutate()}
            disabled={isLoading}
            className="h-9 px-3 gap-1.5 text-xs"
          >
            <ArrowsClockwise size={14} className={cn(isLoading && "animate-spin")} />
            Atualizar
          </Button>

          {/* Nova Tarefa */}
          <Button
            size="sm"
            className="h-9 gap-1.5 text-xs"
            onClick={() => openNew()}
          >
            <Plus size={14} aria-hidden />
            Nova Tarefa
          </Button>
        </div>
      </div>

      {/* Conteúdo */}
      {isError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <p className="text-sm font-medium text-destructive">Erro ao carregar itens.</p>
          <Button variant="outline" size="sm" onClick={() => mutate()} className="mt-3 text-xs">
            Tentar novamente
          </Button>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 rounded-lg border bg-card animate-pulse" />
          ))}
        </div>
      ) : view === "calendar" ? (
        <TaskCalendarView
          tasks={tasks}
          onEditTask={openEdit}
          onNewTask={(date) => openNew(date)}
        />
      ) : (
        <TaskListView
          tasks={filteredTasks}
          onToggleDone={toggleDone}
          onEdit={openEdit}
          onDelete={handleDelete}
        />
      )}

      {/* Dialog de criação/edição */}
      <TaskFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editingTask}
        onSave={handleSave}
        defaultDueDate={prefilledDate}
      />
    </div>
  );
}
