/**
 * PATCH /api/v1/tasks/[id] — edita uma tarefa
 * DELETE /api/v1/tasks/[id] — remove uma tarefa
 * (Com fallback para custom_fields.tasks se crm_tasks não existir no Postgres)
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import type { CrmTask } from "@/lib/types/tasks";

export const dynamic = "force-dynamic";

interface RouteCtx {
  params: Promise<{ id: string }>;
}

const patchSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  due_date: z.string().datetime({ offset: true }).nullable().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  status: z.enum(["pending", "in_progress", "done", "cancelled"]).optional(),
  lead_id: z.string().uuid().nullable().optional(),
  contact_id: z.string().uuid().nullable().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
});

export async function PATCH(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const requestId = randomUUID();
  const { id } = await ctx.params;

  const authz = await requireRole("agent", { requestId, resource: "tasks" });
  if (!authz.ok) return authz.response;
  const { org } = authz;

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return fail("validation_failed", "Dados inválidos.", 422, {
      details: parsed.error.flatten().fieldErrors as Record<string, unknown>,
      requestId,
    });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_tasks")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", org.orgId)
    .select()
    .single();

  // Fallback: se a tabela crm_tasks não existe, busca e atualiza o lead que contém esta tarefa
  if (error && (error.code === "42P01" || error.code === "PGRST205")) {
    const { data: leads } = await supabase
      .from("crm_leads")
      .select("id, custom_fields")
      .eq("organization_id", org.orgId);

    for (const lead of leads ?? []) {
      const custom = (lead.custom_fields ?? {}) as Record<string, unknown>;
      const tasks = (custom.tasks as CrmTask[] | undefined) ?? [];
      const idx = tasks.findIndex((t) => t.id === id);
      if (idx !== -1) {
        const updatedTask: CrmTask = {
          ...tasks[idx]!,
          ...parsed.data,
          updated_at: new Date().toISOString(),
        };
        tasks[idx] = updatedTask;
        await supabase
          .from("crm_leads")
          .update({ custom_fields: { ...custom, tasks } })
          .eq("id", lead.id);
        return ok({ task: updatedTask }, { requestId });
      }
    }
    return fail("not_found", "Tarefa não encontrada.", 404, { requestId });
  }

  if (error) {
    if (error.code === "PGRST116") return fail("not_found", "Tarefa não encontrada.", 404, { requestId });
    return fail("db_error", error.message, 500, { requestId });
  }

  return ok({ task: data }, { requestId });
}

export async function DELETE(_req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const requestId = randomUUID();
  const { id } = await ctx.params;

  const authz = await requireRole("agent", { requestId, resource: "tasks" });
  if (!authz.ok) return authz.response;
  const { org } = authz;

  const supabase = await createClient();
  const { error } = await supabase
    .from("crm_tasks")
    .delete()
    .eq("id", id)
    .eq("organization_id", org.orgId);

  // Fallback: se a tabela crm_tasks não existe, remove a tarefa do lead correspondente
  if (error && (error.code === "42P01" || error.code === "PGRST205")) {
    const { data: leads } = await supabase
      .from("crm_leads")
      .select("id, custom_fields")
      .eq("organization_id", org.orgId);

    for (const lead of leads ?? []) {
      const custom = (lead.custom_fields ?? {}) as Record<string, unknown>;
      const tasks = (custom.tasks as CrmTask[] | undefined) ?? [];
      const hasTask = tasks.some((t) => t.id === id);
      if (hasTask) {
        const filtered = tasks.filter((t) => t.id !== id);
        await supabase
          .from("crm_leads")
          .update({ custom_fields: { ...custom, tasks: filtered } })
          .eq("id", lead.id);
        return ok({ deleted: true }, { requestId });
      }
    }
    return ok({ deleted: true }, { requestId });
  }

  if (error) return fail("db_error", error.message, 500, { requestId });

  return ok({ deleted: true }, { requestId });
}
