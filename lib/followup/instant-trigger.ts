import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { drainEventLog } from "@/lib/event-log/drain";
import { createSupabaseAdminClient, runFollowupTick, type FollowupJobRequest } from "@/lib/followup/engine";
import { createFollowupTurnHandler } from "@/lib/agent-engine/agent/followup-turn";

/**
 * Executa o processamento de follow-up instantaneamente em segundo plano.
 * Elimina esperas de crons ou atrasos de fila para transições de etapa.
 */
export async function triggerImmediateFollowupProcessing(orgId: string): Promise<void> {
  // Executa de forma assíncrona sem travar a resposta HTTP
  void (async () => {
    try {
      const admin = createAdminClient();

      // 1. Drena imediatamente os eventos pendentes do event_log (ex: lead.stage_changed)
      await drainEventLog(admin, { limit: 50 });

      // 2. Executa o tick do motor de follow-up para avançar nós elegíveis
      const newlyEnqueuedJobs: FollowupJobRequest[] = [];
      const enqueueJob = async (job: FollowupJobRequest) => {
        newlyEnqueuedJobs.push(job);
        await admin.from("job_queue").insert({
          organization_id: job.organization_id,
          contact_id: job.contact_id,
          kind: "followup_turn",
          payload: job.payload,
        });
      };

      const deps = {
        db: createSupabaseAdminClient(admin),
        clock: () => new Date(),
        enqueueJob,
      };

      await runFollowupTick(deps, { limit: 20 });

      // 3. Se algum job de envio de mensagem de template foi gerado, executa-o imediatamente!
      for (const job of newlyEnqueuedJobs) {
        if (job.payload && (job.payload as any).purpose === "send_message" && (job.payload as any).template_id) {
          try {
            const { createSupabaseTurnBridgeClient, completeTurnForEnrollment } = await import("@/lib/followup/turn-bridge");
            const bridgeClient = createSupabaseTurnBridgeClient(admin);

            const completeFollowupTurn = async (_pool: any, input: any) => {
              await completeTurnForEnrollment(
                bridgeClient,
                input.organizationId,
                input.enrollmentId,
                input.nodeId,
                input.result,
              );
            };

            const handler = createFollowupTurnHandler({
              crmCfg: {} as any,
              llmCfg: {} as any,
              log: { info: () => {}, warn: () => {}, error: () => {} } as any,
              knobs: {} as any,
              completeFollowupTurn,
            });

            const fakePool = {
              query: async () => ({ rowCount: 0, rows: [] }),
            };

            const jobRow = {
              id: randomUUID(),
              organization_id: job.organization_id,
              contact_id: job.contact_id,
              kind: "followup_turn" as const,
              payload: job.payload,
              status: "running" as const,
              priority: 0,
              lease_token: null,
              leased_until: null,
              claimed_by: "instant-trigger",
              attempts: 1,
              max_attempts: 3,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };

            await handler(jobRow as any, fakePool as any, { workerId: "instant-trigger" });
          } catch (handlerErr) {
            console.error("[instant-trigger] Erro ao disparar template instantâneo:", handlerErr);
          }
        }
      }
    } catch (err) {
      console.error("[instant-trigger] Erro geral no processamento imediato:", err);
    }
  })();
}
