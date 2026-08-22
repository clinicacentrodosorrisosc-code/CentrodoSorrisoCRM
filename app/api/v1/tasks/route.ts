/**
 * GET /api/v1/tasks — lista tarefas e agendamentos da organização
 * POST /api/v1/tasks — cria nova tarefa
 * (Com suporte a Agendamentos de crm_leads e fallback automático para custom_fields)
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import type { CrmTask } from "@/lib/types/tasks";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  due_date: z.string().datetime({ offset: true }).nullable().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  status: z.enum(["pending", "in_progress", "done", "cancelled"]).default("pending"),
  lead_id: z.string().uuid().nullable().optional(),
  contact_id: z.string().uuid().nullable().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
});

const listSchema = z.object({
  status: z.enum(["pending", "in_progress", "done", "cancelled"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  lead_id: z.string().uuid().optional(),
  contact_id: z.string().uuid().optional(),
  due_from: z.string().optional(),
  due_to: z.string().optional(),
  kind: z.enum(["all", "tasks", "agendamentos"]).default("all"),
});

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();

  const authz = await requireRole("viewer", { requestId, resource: "tasks" });
  if (!authz.ok) return authz.response;
  const { org } = authz;

  const url = new URL(req.url);
  const parsed = listSchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return fail("validation_failed", "Parâmetros inválidos.", 422, { requestId });
  }
  const { status, priority, lead_id, contact_id, due_from, due_to, kind } = parsed.data;

  const supabase = await createClient();

  let regularTasks: CrmTask[] = [];

  // 1. Busca tarefas regulares se kind for 'all' ou 'tasks'
  if (kind === "all" || kind === "tasks") {
    let query = supabase
      .from("crm_tasks")
      .select("*")
      .eq("organization_id", org.orgId)
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (status) query = query.eq("status", status);
    if (priority) query = query.eq("priority", priority);
    if (lead_id) query = query.eq("lead_id", lead_id);
    if (contact_id) query = query.eq("contact_id", contact_id);
    if (due_from) query = query.gte("due_date", due_from);
    if (due_to) query = query.lte("due_date", due_to);

    const { data, error } = await query;

    // Fallback: se a tabela crm_tasks não existe, busca tarefas armazenadas em custom_fields de crm_leads
    if (error && (error.code === "42P01" || error.code === "PGRST205")) {
      let leadQuery = supabase
        .from("crm_leads")
        .select("id, custom_fields")
        .eq("organization_id", org.orgId);

      if (lead_id) {
        leadQuery = leadQuery.eq("id", lead_id);
      }

      const { data: leads } = await leadQuery;

      (leads ?? []).forEach((lead) => {
        const custom = (lead.custom_fields ?? {}) as Record<string, unknown>;
        const tasks = (custom.tasks as CrmTask[] | undefined) ?? [];
        regularTasks.push(...tasks.map((t) => ({ ...t, kind: "task" as const })));
      });

      if (status) regularTasks = regularTasks.filter((t) => t.status === status);
      if (priority) regularTasks = regularTasks.filter((t) => t.priority === priority);
      if (lead_id) regularTasks = regularTasks.filter((t) => t.lead_id === lead_id);
      if (contact_id) regularTasks = regularTasks.filter((t) => t.contact_id === contact_id);
    } else if (data) {
      regularTasks = data.map((t) => ({ ...t, kind: "task" as const }));
    }
  }

  // 2. Busca agendamentos de leads se kind for 'all' ou 'agendamentos'
  let agendamentoTasks: CrmTask[] = [];
  if (kind === "all" || kind === "agendamentos") {
    let leadQuery = supabase
      .from("crm_leads")
      .select("id, title, organization_id, contact_id, custom_fields, created_at, updated_at")
      .eq("organization_id", org.orgId);

    if (lead_id) {
      leadQuery = leadQuery.eq("id", lead_id);
    }
    if (contact_id) {
      leadQuery = leadQuery.eq("contact_id", contact_id);
    }

    const { data: leadsWithCustom } = await leadQuery;

    (leadsWithCustom ?? []).forEach((lead) => {
      const custom = (lead.custom_fields ?? {}) as Record<string, unknown>;
      const dataStr = String(custom.agendamento_data ?? "").trim();
      const horaStr = String(custom.agendamento_hora ?? "").trim() || "09:00";
      const proc = String(custom.procedimento ?? "").trim();

      const agendStatus = (custom.agendamento_status as "agendado" | "confirmado" | "compareceu" | "faltou" | "remarcado" | "cancelado") ?? "agendado";
      const icon = agendStatus === "faltou" ? "🔴" : agendStatus === "compareceu" ? "🟢" : agendStatus === "confirmado" ? "🟡" : agendStatus === "remarcado" ? "🔄" : "🗓️";

      if (dataStr) {
        let isoDate: string | null = null;
        try {
          isoDate = new Date(`${dataStr}T${horaStr}:00`).toISOString();
        } catch {
          isoDate = null;
        }

        agendamentoTasks.push({
          id: `agendamento_${lead.id}`,
          organization_id: org.orgId,
          title: `${icon} ${lead.title}${proc ? ` (${proc})` : ""}`,
          description: `Agendamento: ${agendStatus.toUpperCase()} às ${horaStr}`,
          due_date: isoDate,
          priority: agendStatus === "faltou" ? "urgent" : "high",
          status: agendStatus === "compareceu" ? "done" : "pending",
          lead_id: lead.id,
          contact_id: lead.contact_id ?? null,
          assigned_to: null,
          created_by: null,
          created_at: lead.created_at ?? new Date().toISOString(),
          updated_at: lead.updated_at ?? new Date().toISOString(),
          kind: "agendamento",
          agendamento_status: agendStatus,
          lead_title: lead.title,
          procedimento: proc || null,
        });
      }
    });

    if (due_from) {
      agendamentoTasks = agendamentoTasks.filter((t) => t.due_date && t.due_date >= due_from);
    }
    if (due_to) {
      agendamentoTasks = agendamentoTasks.filter((t) => t.due_date && t.due_date <= due_to);
    }
  }

  // Combina e ordena tudo por data de vencimento
  const allItems = [...regularTasks, ...agendamentoTasks];
  allItems.sort((a, b) => {
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  });

  return ok({ tasks: allItems }, { requestId });
}

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();

  const authz = await requireRole("agent", { requestId, resource: "tasks" });
  if (!authz.ok) return authz.response;
  const { org, user } = authz;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return fail("validation_failed", "Dados inválidos.", 422, {
      details: parsed.error.flatten().fieldErrors as Record<string, unknown>,
      requestId,
    });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_tasks")
    .insert({
      ...parsed.data,
      organization_id: org.orgId,
      created_by: user.id,
    })
    .select()
    .single();

  // Fallback: se a tabela crm_tasks não existe no banco, grava em custom_fields do lead
  if (error && (error.code === "42P01" || error.code === "PGRST205") && parsed.data.lead_id) {
    const { data: lead } = await supabase
      .from("crm_leads")
      .select("id, custom_fields")
      .eq("id", parsed.data.lead_id)
      .single();

    if (lead) {
      const custom = (lead.custom_fields ?? {}) as Record<string, unknown>;
      const existing = (custom.tasks as CrmTask[] | undefined) ?? [];

      const newTask: CrmTask = {
        id: randomUUID(),
        organization_id: org.orgId,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        due_date: parsed.data.due_date ?? null,
        priority: parsed.data.priority,
        status: parsed.data.status,
        lead_id: parsed.data.lead_id,
        contact_id: parsed.data.contact_id ?? null,
        assigned_to: parsed.data.assigned_to ?? null,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        kind: "task",
      };

      const updated = [newTask, ...existing];
      await supabase
        .from("crm_leads")
        .update({
          custom_fields: { ...custom, tasks: updated },
        })
        .eq("id", lead.id);

      return ok({ task: newTask }, { requestId, status: 201 });
    }
  }

  if (error) return fail("db_error", error.message, 500, { requestId });

  return ok({ task: data }, { requestId, status: 201 });
}
