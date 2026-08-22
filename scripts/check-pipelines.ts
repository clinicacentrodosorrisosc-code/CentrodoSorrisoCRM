import { createAdminClient } from "../lib/supabase/admin";

async function run() {
  const sb = createAdminClient();
  const { data: pipelines } = await sb
    .from("crm_pipelines")
    .select("id, name, slug, position, is_default, is_archived");
  console.log("--- CRM_PIPELINES ---", JSON.stringify(pipelines, null, 2));

  const { data: leads } = await sb
    .from("crm_leads")
    .select("id, title, pipeline_id");
  console.log("--- CRM_LEADS ---", JSON.stringify(leads, null, 2));
}

run().catch(console.error);
