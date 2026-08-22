import { createAdminClient } from "../lib/supabase/admin";

async function run() {
  const sb = createAdminClient();
  const { data: sessions } = await sb
    .from("channel_sessions")
    .select("id, provider, phone_number, display_name, meta_phone_number_id, meta_waba_id, webhook_path_token, status, archived_at");
  console.log("--- CHANNEL SESSIONS ---", JSON.stringify(sessions, null, 2));

  const { data: contacts } = await sb
    .from("contacts")
    .select("id, name, display_name, phone_number, channel");
  console.log("--- CONTACTS ---", JSON.stringify(contacts, null, 2));

  const { data: convs } = await sb
    .from("conversations")
    .select("id, contact_id, status, preview, created_at, updated_at");
  console.log("--- CONVERSATIONS ---", JSON.stringify(convs, null, 2));

  const { data: msgs } = await sb
    .from("messages")
    .select("id, conversation_id, content, direction, created_at");
  console.log("--- MESSAGES ---", JSON.stringify(msgs, null, 2));
}

run().catch(console.error);
