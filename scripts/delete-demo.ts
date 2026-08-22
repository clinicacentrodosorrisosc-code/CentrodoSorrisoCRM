import { createAdminClient } from "../lib/supabase/admin";

async function run() {
  const sb = createAdminClient();

  console.log("🧹 Buscando dados de demonstração para exclusão...");

  const { data: demoContacts } = await sb
    .from("contacts")
    .select("id, name, display_name, phone_number")
    .or("name.ilike.%Demonstração%,display_name.ilike.%Demonstração%,phone_number.eq.+5511987654321");

  console.log("Contatos de demonstração encontrados:", demoContacts);

  if (demoContacts && demoContacts.length > 0) {
    const contactIds = demoContacts.map((c) => c.id);

    // 1. Apaga leads associados
    const { data: deletedLeads, error: errLeads } = await sb
      .from("crm_leads")
      .delete()
      .in("contact_id", contactIds)
      .select("id, title");
    console.log("Leads deletados:", deletedLeads, errLeads ?? "");

    // 2. Apaga mensagens associadas
    const { data: deletedMsgs, error: errMsgs } = await sb
      .from("messages")
      .delete()
      .in("contact_id", contactIds)
      .select("id");
    console.log("Mensagens deletadas:", deletedMsgs?.length ?? 0, errMsgs ?? "");

    // 3. Apaga conversas associadas
    const { data: deletedConvs, error: errConvs } = await sb
      .from("conversations")
      .delete()
      .in("contact_id", contactIds)
      .select("id");
    console.log("Conversas deletadas:", deletedConvs, errConvs ?? "");

    // 4. Apaga contatos
    const { data: deletedCont, error: errCont } = await sb
      .from("contacts")
      .delete()
      .in("id", contactIds)
      .select("id, name");
    console.log("Contatos deletados:", deletedCont, errCont ?? "");
  }

  console.log("✅ Limpeza concluída!");
}

run().catch(console.error);
