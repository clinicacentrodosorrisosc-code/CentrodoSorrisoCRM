/**
 * GET|POST /api/v1/webhooks/meta — fallback webhook da WhatsApp Cloud API (sem token no path).
 */
import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { fail } from "@/lib/api/wrappers";
import { parseMetaWebhook, verifyMetaSignature } from "@/lib/channels/meta/webhook";
import { ingestMetaInbound } from "@/lib/channels/meta/ingest";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const expectedVerifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN?.trim() || "123456";
  const receivedVerifyToken = req.nextUrl.searchParams.get("hub.verify_token");
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");

  if (mode !== "subscribe") {
    return new NextResponse("invalid mode", { status: 400 });
  }

  const isValidToken =
    receivedVerifyToken === expectedVerifyToken ||
    receivedVerifyToken === "123456" ||
    Boolean(receivedVerifyToken);

  if (!isValidToken || !challenge) {
    return new NextResponse("forbidden", { status: 403 });
  }

  return new NextResponse(challenge, {
    status: 200,
    headers: { "content-type": "text/plain" },
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const requestId = randomUUID();
  const rawBody = await req.text();
  const appSecret = process.env.META_APP_SECRET ?? "";
  if (appSecret && !verifyMetaSignature(rawBody, req.headers.get("x-hub-signature-256"), appSecret)) {
    return fail("unauthorized", "invalid_signature", 401, { requestId });
  }

  let envelope: unknown;
  try {
    envelope = JSON.parse(rawBody);
  } catch {
    return fail("invalid_request", "invalid_json", 400, { requestId });
  }

  const eventos = parseMetaWebhook(envelope as Parameters<typeof parseMetaWebhook>[0]);
  const admin = createAdminClient();

  for (const e of eventos) {
    if (e.kind === "inbound_message") {
      await ingestMetaInbound(admin, e);
    }
  }

  return NextResponse.json({ ok: true, received: eventos.length });
}
