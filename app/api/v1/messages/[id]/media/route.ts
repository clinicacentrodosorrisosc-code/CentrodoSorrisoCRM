import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { fail } from "@/lib/api/wrappers";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import {
  CHANNEL_SESSION_REF_COLUMNS,
  DEFAULT_CHANNEL_PROVIDER,
  getAdapter,
  resolveSessionRef,
  type ChannelProvider,
  type ChannelSessionRef,
} from "@/lib/channels";
import { resolveMetaCreds } from "@/lib/channels/meta/credentials";
import { storagePathFor } from "@/lib/messaging/media/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const SIGNED_URL_TTL_S = 3600;

interface RouteCtx {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const requestId = randomUUID();
  const { id: messageId } = await ctx.params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return fail("unauthenticated", "Auth required.", 401, { requestId });
  }
  const authUser = await loadAuthUser();
  const activeOrg = authUser ? await resolveActiveOrg(authUser) : null;
  if (!activeOrg) {
    return fail("no_active_org", "No active organization.", 403, { requestId });
  }

  // Client de sessão: RLS garante que a mensagem pertence a uma org do usuário.
  const { data: msg, error } = await supabase
    .from("messages")
    .select("id, media_url, media_mime, media_storage_path, channel_session_id, conversation_id, metadata, type")
    .eq("id", messageId)
    .eq("organization_id", activeOrg.orgId)
    .maybeSingle();
  if (error) {
    return fail("internal_error", "Erro ao buscar mensagem.", 500, { requestId });
  }
  if (!msg) {
    return fail("not_found", "Mensagem não encontrada.", 404, { requestId });
  }

  const admin = createAdminClient();

  if (msg.media_storage_path) {
    const { data: signed, error: signErr } = await admin.storage
      .from("whatsapp-media")
      .createSignedUrl(msg.media_storage_path, SIGNED_URL_TTL_S);
    if (!signErr && signed?.signedUrl) {
      const response = NextResponse.redirect(signed.signedUrl, 302);
      response.headers.set("X-Request-Id", requestId);
      return response;
    }
    if (signErr) {
      console.error("[messages.media] createSignedUrl failed", signErr.message);
    }
  }

  // ── Fallback: busca via adapter / Meta Cloud API sob demanda ─────────────────
  try {
    const { data: sessao } = await admin
      .from("channel_sessions")
      .select(`id, provider, ${CHANNEL_SESSION_REF_COLUMNS}`)
      .eq("id", msg.channel_session_id)
      .maybeSingle();

    const provider = ((sessao?.provider as string) ?? DEFAULT_CHANNEL_PROVIDER) as ChannelProvider;
    const adapter = getAdapter(provider);
    const sessionRef = sessao ? resolveSessionRef(sessao as unknown as ChannelSessionRef) : null;

    let targetUrl = msg.media_url;

    // Se a mensagem é da Meta e não temos a URL (ou ela expirou), resolvemos pelo meta_media_id
    if (provider === "meta_cloud" && (!targetUrl || targetUrl.length === 0)) {
      const metaMediaId = (msg.metadata as Record<string, unknown> | null)?.meta_media_id as string | undefined;
      if (metaMediaId && sessionRef) {
        const creds = await resolveMetaCreds(admin, sessionRef);
        if (creds) {
          const graphRes = await fetch(
            `https://graph.facebook.com/${creds.graphVersion}/${metaMediaId}`,
            {
              headers: { Authorization: `Bearer ${creds.token}` },
              signal: AbortSignal.timeout(15_000),
            },
          );
          if (graphRes.ok) {
            const graphData = (await graphRes.json()) as { url?: string; mime_type?: string };
            if (graphData.url) {
              targetUrl = graphData.url;
            }
          }
        }
      }
    }

    if (targetUrl && adapter.fetchInboundMedia && sessionRef) {
      const media = await adapter.fetchInboundMedia({
        sessionRef,
        url: targetUrl,
        hintMime: msg.media_mime,
      });

      // Salva no storage em background para acelerar as próximas reproduções
      const path = storagePathFor(activeOrg.orgId, msg.conversation_id, msg.id, media.mime);
      admin.storage
        .from("whatsapp-media")
        .upload(path, media.buffer, { contentType: media.mime, upsert: true })
        .then(() => {
          admin
            .from("messages")
            .update({
              media_storage_path: path,
              media_size_bytes: media.buffer.byteLength,
              media_mime: media.mime,
            })
            .eq("id", msg.id)
            .then(() => {});
        })
        .catch(() => {});

      return new Response(new Uint8Array(media.buffer), {
        status: 200,
        headers: {
          "Content-Type": media.mime,
          "Cache-Control": "private, max-age=60",
          "X-Request-Id": requestId,
        },
      });
    }
  } catch (err) {
    console.error("[messages.media] proxy error", err);
    return fail("bad_gateway", "Mídia indisponível no momento.", 502, { requestId });
  }

  return fail("not_found", "Mensagem sem mídia.", 404, { requestId });
}

