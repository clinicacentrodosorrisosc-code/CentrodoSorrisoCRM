"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { CrmTask, CreateTaskInput, UpdateTaskInput } from "@/lib/types/tasks";

const BASE = "/api/v1/tasks";

interface ListResponse {
  tasks: CrmTask[];
}

export function useTasks(filters?: {
  status?: string;
  priority?: string;
  lead_id?: string;
  contact_id?: string;
  kind?: "all" | "tasks" | "agendamentos";
}) {
  const queryClient = useQueryClient();
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.priority) params.set("priority", filters.priority);
  if (filters?.lead_id) params.set("lead_id", filters.lead_id);
  if (filters?.contact_id) params.set("contact_id", filters.contact_id);
  if (filters?.kind) params.set("kind", filters.kind);

  const qs = params.toString();
  const queryKey = [
    "crm_tasks",
    filters?.status,
    filters?.priority,
    filters?.lead_id,
    filters?.contact_id,
    filters?.kind,
  ];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`${BASE}${qs ? "?" + qs : ""}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { data?: ListResponse };
      return json.data ?? { tasks: [] };
    },
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: async (input: CreateTaskInput) => {
      const res = await fetch(BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("Falha ao criar tarefa");
      const json = (await res.json()) as { data?: { task: CrmTask } };
      return json.data!.task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm_tasks"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateTaskInput }) => {
      const res = await fetch(`${BASE}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("Falha ao atualizar tarefa");
      const json = (await res.json()) as { data?: { task: CrmTask } };
      return json.data!.task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm_tasks"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${BASE}/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Falha ao excluir tarefa");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm_tasks"] });
    },
  });

  return {
    tasks: query.data?.tasks ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    mutate: () => queryClient.invalidateQueries({ queryKey: ["crm_tasks"] }),
    createTask: (input: CreateTaskInput) => createMutation.mutateAsync(input),
    updateTask: (id: string, input: UpdateTaskInput) => updateMutation.mutateAsync({ id, input }),
    deleteTask: (id: string) => deleteMutation.mutateAsync(id),
    toggleDone: async (task: CrmTask) => {
      const newStatus = task.status === "done" ? "pending" : "done";
      await updateMutation.mutateAsync({ id: task.id, input: { status: newStatus } });
    },
  };
}
