/**
 * Seed de conversa de demonstração para o Inbox e Funil do Centro do Sorriso.
 *
 * Execução:
 *   pnpm tsx scripts/seed-demo-inbox.ts
 */
import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";

function loadEnv(): Record<string, string> {
  const out: Record<string, string> = { ...process.env } as Record<string, string>;
  for (const file of [".env", ".env.local"]) {
    const p = path.join(process.cwd(), file);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !out[m[1]!]) out[m[1]!] = m[2]!.replace(/^"(.*)"$/, "$1");
    }
  }
  return out;
}

const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env.local");
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("🔍 Localizando organização...");
  const { data: orgs, error: orgErr } = await admin
    .from("organizations")
    .select("id, display_name, slug")
    .order("created_at", { ascending: false })
    .limit(1);

  if (orgErr || !orgs || orgs.length === 0) {
    throw new Error("Nenhuma organização encontrada. Execute o bootstrap primeiro.");
  }

  const org = orgs[0]!;
  const orgId = org.id;
  console.log(`✅ Organização: ${org.display_name} (${orgId})`);

  // 1. Garantir Canal / Channel Session
  console.log("📡 Verificando canal de WhatsApp...");
  const { data: existingSessions } = await admin
    .from("channel_sessions")
    .select("id, waha_session_name, status")
    .eq("organization_id", orgId)
    .limit(1);

  let channelSessionId: string;
  if (existingSessions && existingSessions.length > 0) {
    channelSessionId = existingSessions[0]!.id;
    console.log(`✅ Canal existente encontrado: ${channelSessionId}`);
  } else {
    const sessionName = `waha_org_${orgId.slice(0, 8)}`;
    const { data: newSession, error: sessErr } = await admin
      .from("channel_sessions")
      .insert({
        organization_id: orgId,
        waha_session_name: sessionName,
        webhook_secret_encrypted: "\\x00",
        phone_number: "+5511999990000",
        display_name: "WhatsApp Centro do Sorriso",
        status: "WORKING",
      } as never)
      .select("id")
      .single();

    if (sessErr || !newSession) {
      throw new Error(`Erro ao criar sessão de canal: ${sessErr?.message}`);
    }
    channelSessionId = (newSession as { id: string }).id;
    console.log(`✅ Novo canal criado: ${channelSessionId}`);
  }

  // 2. Criar ou Obter Contato Demo
  console.log("👤 Criando contato de demonstração...");
  const contactPhone = "+5511987654321";
  const { data: existingContact } = await admin
    .from("contacts")
    .select("id")
    .eq("organization_id", orgId)
    .eq("phone_number", contactPhone)
    .maybeSingle();

  let contactId: string;
  if (existingContact) {
    contactId = (existingContact as { id: string }).id;
    await admin
      .from("contacts")
      .update({
        name: "Mariana Silva",
        display_name: "Mariana Silva (Demonstração)",
        email: "mariana.silva@exemplo.com",
        tags: ["demo", "clareamento", "alinhador"],
      } as never)
      .eq("id", contactId);
    console.log(`✅ Contato demo atualizado: ${contactId}`);
  } else {
    const { data: newContact, error: ctErr } = await admin
      .from("contacts")
      .insert({
        organization_id: orgId,
        name: "Mariana Silva",
        display_name: "Mariana Silva (Demonstração)",
        phone_number: contactPhone,
        email: "mariana.silva@exemplo.com",
        tags: ["demo", "clareamento", "alinhador"],
      } as never)
      .select("id")
      .single();

    if (ctErr || !newContact) {
      throw new Error(`Erro ao criar contato: ${ctErr?.message}`);
    }
    contactId = (newContact as { id: string }).id;
    console.log(`✅ Contato demo criado: ${contactId}`);
  }

  // 3. Criar ou Obter Conversa
  console.log("💬 Criando conversa no Inbox...");
  const { data: existingConv } = await admin
    .from("conversations")
    .select("id")
    .eq("organization_id", orgId)
    .eq("contact_id", contactId)
    .maybeSingle();

  let conversationId: string;
  const now = new Date();
  const t1 = new Date(now.getTime() - 25 * 60 * 1000).toISOString(); // 25 min atrás
  const t2 = new Date(now.getTime() - 20 * 60 * 1000).toISOString(); // 20 min atrás
  const t3 = new Date(now.getTime() - 2 * 60 * 1000).toISOString();  // 2 min atrás

  if (existingConv) {
    conversationId = (existingConv as { id: string }).id;
    await admin
      .from("conversations")
      .update({
        status: "open",
        unread_count_for_assignee: 1,
        last_message_at: t3,
        last_message_preview: "Perfeito! Quais dias e horários vocês têm disponíveis para consulta nesta semana?",
      } as never)
      .eq("id", conversationId);
    console.log(`✅ Conversa demo atualizada: ${conversationId}`);
  } else {
    const { data: newConv, error: convErr } = await admin
      .from("conversations")
      .insert({
        organization_id: orgId,
        contact_id: contactId,
        channel_session_id: channelSessionId,
        status: "open",
        unread_count_for_assignee: 1,
        last_message_at: t3,
        last_message_preview: "Perfeito! Quais dias e horários vocês têm disponíveis para consulta nesta semana?",
      } as never)
      .select("id")
      .single();

    if (convErr || !newConv) {
      throw new Error(`Erro ao criar conversa: ${convErr?.message}`);
    }
    conversationId = (newConv as { id: string }).id;
    console.log(`✅ Conversa demo criada: ${conversationId}`);
  }

  // 4. Inserir Mensagens na Conversa
  console.log("✉️ Inserindo mensagens na conversa...");
  // Limpa mensagens anteriores deste demo para recriar limpo
  await admin.from("messages").delete().eq("conversation_id", conversationId);

  const messagesToInsert = [
    {
      organization_id: orgId,
      conversation_id: conversationId,
      channel_session_id: channelSessionId,
      contact_id: contactId,
      external_id: `demo_msg_${Date.now()}_1`,
      type: "text",
      direction: "inbound",
      status: "delivered",
      body: "Olá! Gostaria de saber mais informações sobre os tratamentos de clareamento a laser e alinhadores invisíveis do Centro do Sorriso.",
      created_at: t1,
      sent_at: t1,
    },
    {
      organization_id: orgId,
      conversation_id: conversationId,
      channel_session_id: channelSessionId,
      contact_id: contactId,
      external_id: `demo_msg_${Date.now()}_2`,
      type: "text",
      direction: "outbound",
      status: "read",
      body: "Olá Mariana, tudo bem? Seja muito bem-vinda ao Centro do Sorriso! ✨ Temos opções de clareamento estético a laser e alinhadores ortodônticos invisíveis de alta precisão. Você gostaria de agendar uma avaliação inicial conosco?",
      created_at: t2,
      sent_at: t2,
    },
    {
      organization_id: orgId,
      conversation_id: conversationId,
      channel_session_id: channelSessionId,
      contact_id: contactId,
      external_id: `demo_msg_${Date.now()}_3`,
      type: "text",
      direction: "inbound",
      status: "delivered",
      body: "Perfeito! Quais dias e horários vocês têm disponíveis para consulta nesta semana?",
      created_at: t3,
      sent_at: t3,
    },
  ];

  const { error: msgErr } = await admin.from("messages").insert(messagesToInsert as never);
  if (msgErr) {
    console.warn(`[seed] Erro ao inserir mensagens: ${msgErr.message}`);
  } else {
    console.log("✅ 3 Mensagens de demonstração inseridas com sucesso.");
  }

  // 5. Vincular ao Kanban (Oportunidade / Lead no Funil)
  console.log("🎯 Verificando funil de vendas...");
  const { data: pipelines } = await admin
    .from("crm_pipelines")
    .select("id, name")
    .eq("organization_id", orgId)
    .is("is_archived", false)
    .order("position", { ascending: true })
    .limit(1);

  if (pipelines && pipelines.length > 0) {
    const pipelineId = pipelines[0]!.id;
    const { data: stages } = await admin
      .from("crm_stages")
      .select("id, name")
      .eq("pipeline_id", pipelineId)
      .order("position", { ascending: true })
      .limit(2);

    const stageId = stages && stages.length > 1 ? stages[1]!.id : stages?.[0]?.id;

    if (stageId) {
      const { data: existingLead } = await admin
        .from("crm_leads")
        .select("id")
        .eq("organization_id", orgId)
        .eq("contact_id", contactId)
        .maybeSingle();

      const demoOrcamento = {
        status: "aprovado",
        aprovado_em: new Date(Date.now() - 3600000).toISOString(),
        itens: [
          {
            id: "item_1",
            descricao: "Clareamento Dental a Laser (Sessão Clínica)",
            quantidade: 1,
            valor_unitario_cents: 120000,
            valor_total_cents: 120000,
          },
          {
            id: "item_2",
            descricao: "Alinhador Ortodôntico Invisível (Arcada Superior/Inferior)",
            quantidade: 1,
            valor_unitario_cents: 125000,
            valor_total_cents: 125000,
          },
        ],
        desconto_cents: 0,
        total_cents: 245000,
        total_pago_cents: 100000,
        saldo_restante_cents: 145000,
        pagamentos: [
          {
            id: "pag_1",
            data: new Date().toISOString().split("T")[0],
            valor_cents: 100000,
            metodo: "pix",
            observacao: "Entrada confirmada via Pix Banco do Brasil",
            criado_em: new Date().toISOString(),
          },
        ],
      };

      if (existingLead) {
        await admin
          .from("crm_leads")
          .update({
            title: "Avaliação Clareamento & Alinhador — Mariana Silva",
            value_cents: 245000,
            stage_id: stageId,
            pipeline_id: pipelineId,
            source: "WhatsApp",
            custom_fields: {
              procedimento: "Clareamento Dental (Laser / Caseiro)",
              orcamento: demoOrcamento,
            },
          } as never)
          .eq("id", (existingLead as { id: string }).id);
        console.log("✅ Oportunidade no Funil atualizada com Orçamento e Pagamento Parcial.");
      } else {
        await admin.from("crm_leads").insert({
          organization_id: orgId,
          contact_id: contactId,
          pipeline_id: pipelineId,
          stage_id: stageId,
          title: "Avaliação Clareamento & Alinhador — Mariana Silva",
          value_cents: 245000,
          currency: "BRL",
          source: "WhatsApp",
          custom_fields: {
            procedimento: "Clareamento Dental (Laser / Caseiro)",
            orcamento: demoOrcamento,
          },
          status: "open",
        } as never);
        console.log("✅ Nova oportunidade no Funil criada: R$ 2.450,00 com Orçamento.");
      }
    }
  }

  console.log("\n🎉 Conversa de demonstração pronta!");
  console.log("👉 Acesse o Inbox: http://localhost:3001/app/inbox");
  console.log("👉 Acesse o Dashboard: http://localhost:3001/app/dashboard");
  console.log("👉 Acesse o Kanban: http://localhost:3001/app/kanban\n");
}

main().catch((err) => {
  console.error("❌ Falha no seed de demonstração:", err);
  process.exit(1);
});
