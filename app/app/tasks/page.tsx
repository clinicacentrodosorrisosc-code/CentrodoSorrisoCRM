import type { Metadata } from "next";
import { TasksClient } from "./_components/TasksClient";

export const metadata: Metadata = {
  title: "Tarefas | CRM",
  description: "Gerencie suas tarefas com data, horário, prioridade e visualização em lista ou calendário.",
};

export default function TasksPage() {
  return (
    <div className="container max-w-5xl py-6 px-4 sm:px-6">
      <TasksClient />
    </div>
  );
}
