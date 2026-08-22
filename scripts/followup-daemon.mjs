import fs from 'fs';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

let envText = '';
try { envText += fs.readFileSync('.env.local', 'utf8') + '\n'; } catch {}
try { envText += fs.readFileSync('.env', 'utf8') + '\n'; } catch {}

const env = {};
envText.split('\n').forEach(line => {
  const idx = line.indexOf('=');
  if (idx > 0) {
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    env[k] = v;
  }
});

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

console.log("=== INICIANDO DAEMON DE FOLLOW-UP (LOOP CONTÍNUO DE 10 SEGUNDOS) ===");

let isRunning = false;

async function tick() {
  if (isRunning) return;
  isRunning = true;

  try {
    // 1. Drenar event_log
    const { drainEventLog } = await import('../lib/event-log/drain.ts');
    await drainEventLog(sb, { limit: 50 });

    // 2. Rodar o tick do motor de follow-up
    const { createSupabaseAdminClient, runFollowupTick } = await import('../lib/followup/engine.ts');
    const { createFollowupTurnHandler } = await import('../lib/agent-engine/agent/followup-turn.ts');

    const newlyEnqueuedJobs = [];
    const enqueueJob = async (job) => {
      newlyEnqueuedJobs.push(job);
      await sb.from("job_queue").insert({
        organization_id: job.organization_id,
        contact_id: job.contact_id,
        kind: "followup_turn",
        payload: job.payload,
      });
    };

    const deps = {
      db: createSupabaseAdminClient(sb),
      clock: () => new Date(),
      enqueueJob,
    };

    const summary = await runFollowupTick(deps, { limit: 20 });
    if (summary.claimed > 0 || newlyEnqueuedJobs.length > 0) {
      console.log(`[DAEMON TICK] claimed=${summary.claimed}, advanced=${summary.advanced}, scheduled=${summary.scheduled}`);
    }

    // 3. Processar jobs gerados na fila
    for (const job of newlyEnqueuedJobs) {
      if (job.payload && job.payload.purpose === "send_message" && job.payload.template_id) {
        const { createSupabaseTurnBridgeClient, completeTurnForEnrollment } = await import('../lib/followup/turn-bridge.ts');
        const bridgeClient = createSupabaseTurnBridgeClient(sb);

        const completeFollowupTurn = async (_pool, input) => {
          await completeTurnForEnrollment(
            bridgeClient,
            input.organizationId,
            input.enrollmentId,
            input.nodeId,
            input.result,
          );
        };

        const handler = createFollowupTurnHandler({
          crmCfg: {},
          llmCfg: {},
          log: { info: console.log, warn: console.warn, error: console.error },
          knobs: {},
          completeFollowupTurn,
        });

        const fakePool = {
          query: async () => ({ rowCount: 0, rows: [] }),
        };

        const jobRow = {
          id: randomUUID(),
          organization_id: job.organization_id,
          contact_id: job.contact_id,
          kind: "followup_turn",
          payload: job.payload,
          status: "running",
          priority: 0,
          lease_token: null,
          leased_until: null,
          claimed_by: "daemon",
          attempts: 1,
          max_attempts: 3,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        await handler(jobRow, fakePool, { workerId: "daemon" });
        console.log(`[DAEMON] Template ${job.payload.template_id} disparado com sucesso para o contato ${job.contact_id}`);
      }
    }
  } catch (err) {
    // Silencia erros transitórios para manter o loop vivo
  } finally {
    isRunning = false;
  }
}

// Roda imediatamente no boot
tick();

// Agenda execução a cada 10 segundos
setInterval(tick, 10000);
