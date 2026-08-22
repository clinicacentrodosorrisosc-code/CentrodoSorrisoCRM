import fs from 'fs';
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

async function run() {
  const org = "7bf66eb2-0517-4db4-ac91-79d451827eff";

  // Verificar status dos enrollments
  const { data: enrollments } = await sb
    .from('followup_enrollments')
    .select('id, contact_id, current_node_id, status, cancel_reason, next_eval_at, steps_taken')
    .eq('organization_id', org);

  console.log("Current enrollments:", enrollments);

  // Deletar enrollments antigos de teste para permitir novos testes limpos
  await sb.from('followup_enrollments').delete().eq('organization_id', org);
  await sb.from('followup_enrollment_events').delete().eq('organization_id', org);
  await sb.from('job_queue').delete().eq('organization_id', org);

  console.log("Cleaned test enrollments, events and job_queue. Ready for fresh test!");
}

run().catch(console.error);
