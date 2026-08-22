"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CrmTask } from "@/lib/types/tasks";
import { PRIORITY_CONFIG, isOverdue } from "@/lib/types/tasks";
import { CaretLeft, CaretRight } from "@/lib/ui/icons";

interface Props {
  tasks: CrmTask[];
  onEditTask: (task: CrmTask) => void;
  onNewTask: (date: string) => void; // YYYY-MM-DD
}

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTH_NAMES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function toYMD(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildCalendarGrid(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = getDaysInMonth(year, month);
  const grid: (Date | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    grid.push(new Date(year, month, d));
  }
  // Pad to complete last week
  while (grid.length % 7 !== 0) grid.push(null);
  return grid;
}

function TaskChip({
  task,
  onClick,
}: {
  task: CrmTask;
  onClick: (e: React.MouseEvent) => void;
}) {
  const prio = PRIORITY_CONFIG[task.priority];
  const overdue = isOverdue(task);
  const isDone = task.status === "done";
  const isAgendamento = task.kind === "agendamento";

  let colorClasses = `${prio.bg} ${prio.color}`;
  if (isAgendamento) {
    if (task.agendamento_status === "faltou") {
      colorClasses = "bg-red-100 text-red-900 dark:bg-red-950/70 dark:text-red-300 border border-red-500/50 font-bold shadow-xs";
    } else if (task.agendamento_status === "compareceu") {
      colorClasses = "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-500/50 font-bold shadow-xs";
    } else {
      colorClasses = "bg-sky-100 text-sky-900 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-400/40 font-bold shadow-xs";
    }
  } else if (isDone) {
    colorClasses = "line-through opacity-50 bg-muted text-muted-foreground";
  } else if (overdue) {
    colorClasses = "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-semibold";
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left rounded px-1.5 py-0.5 text-[10px] font-medium truncate transition-all hover:scale-[1.02]",
        colorClasses,
      )}
      title={isAgendamento ? `Agendamento: ${task.title} (clique para abrir lead)` : task.title}
    >
      {task.title}
    </button>
  );
}

export function TaskCalendarView({ tasks, onEditTask, onNewTask }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const grid = buildCalendarGrid(year, month);
  const todayStr = toYMD(today);

  // Mapa: YYYY-MM-DD → tasks
  const tasksByDay = new Map<string, CrmTask[]>();
  for (const task of tasks) {
    if (!task.due_date) continue;
    const key = task.due_date.slice(0, 10);
    const existing = tasksByDay.get(key) ?? [];
    existing.push(task);
    tasksByDay.set(key, existing);
  }

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
      {/* Header do calendário */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}>
          <CaretLeft size={16} aria-hidden />
        </Button>
        <div className="flex items-center gap-3">
          <h2 className="text-base font-bold text-foreground">
            {MONTH_NAMES[month]} {year}
          </h2>
          <div className="hidden md:flex items-center gap-2.5 text-[11px] text-muted-foreground border-l pl-3">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-sky-500" /> Agendado
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Compareceu
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red-500" /> Faltou (No-Show)
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-blue-500" /> Tarefa
            </span>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth}>
          <CaretRight size={16} aria-hidden />
        </Button>
      </div>

      {/* Labels dos dias da semana */}
      <div className="grid grid-cols-7 border-b bg-muted/40">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="py-2 text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            {d}
          </div>
        ))}
      </div>

      {/* Grid dos dias */}
      <div className="grid grid-cols-7 divide-x divide-y">
        {grid.map((day, idx) => {
          if (!day) {
            return <div key={`empty-${idx}`} className="min-h-[105px] bg-muted/15 p-1" />;
          }
          const dayStr = toYMD(day);
          const isToday = dayStr === todayStr;
          const dayTasks = tasksByDay.get(dayStr) ?? [];
          const maxVisible = 3;
          const overflow = dayTasks.length - maxVisible;

          return (
            <div
              key={dayStr}
              className={cn(
                "min-h-[105px] p-1.5 flex flex-col gap-1 cursor-pointer transition-colors hover:bg-muted/30",
                isToday && "bg-primary/5",
              )}
              onClick={() => onNewTask(dayStr)}
            >
              {/* Número do dia */}
              <span className={cn(
                "self-start text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full",
                isToday
                  ? "bg-primary text-primary-foreground font-bold shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}>
                {day.getDate()}
              </span>

              {/* Chips de tarefas / agendamentos */}
              {dayTasks.slice(0, maxVisible).map((task) => (
                <TaskChip
                  key={task.id}
                  task={task}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditTask(task);
                  }}
                />
              ))}
              {overflow > 0 && (
                <span className="text-[10px] font-semibold text-muted-foreground pl-1">
                  +{overflow} mais
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
