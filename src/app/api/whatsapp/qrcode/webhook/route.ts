import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sanitizePhoneForMeta } from '@/lib/whatsapp/phone-utils'
import { findExistingContact } from '@/lib/contacts/dedupe'
import { runAutomationsForTrigger } from '@/lib/automations/engine'
import { dispatchInboundToAiReply } from '@/lib/ai/auto-reply'
import { dispatchWebhookEvent } from '@/lib/webhooks/deliver'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/**
 * Public Webhook endpoint to receive QR Code WhatsApp events (Baileys / Evolution API / Gateway)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const admin = supabaseAdmin()

    // 1. Extract instance identifier or accountId
    const instanceId = body.instance ?? body.instanceId ?? body.qrcode_instance_id
    const senderPhoneRaw = body.data?.key?.remoteJid ?? body.from ?? body.phone ?? body.sender
    const messageText = body.data?.message?.conversation ?? body.data?.message?.extendedTextMessage?.text ?? body.text ?? body.body ?? ''
    const isFromMe = body.data?.key?.fromMe === true

    // Ignore self-sent messages in webhook
    if (isFromMe) {
      return NextResponse.json({ status: 'ignored_self_message' })
    }

    if (!senderPhoneRaw) {
      return NextResponse.json({ status: 'ignored_no_sender' })
    }

    const phoneOnly = senderPhoneRaw.split('@')[0]
    const sanitizedPhone = sanitizePhoneForMeta(phoneOnly)
    const formattedPhone = sanitizedPhone.startsWith('+') ? sanitizedPhone : `+${sanitizedPhone}`

    // 2. Find whatsapp_config by instance_id or first qrcode-connected row
    let accountId: string | null = null
    if (instanceId) {
      const { data: config } = await admin
        .from('whatsapp_config')
        .select('account_id')
        .eq('qrcode_instance_id', instanceId)
        .maybeSingle()
      if (config) accountId = config.account_id
    }

    if (!accountId) {
      const { data: config } = await admin
        .from('whatsapp_config')
        .select('account_id')
        .eq('connection_type', 'qrcode')
        .eq('qrcode_status', 'connected')
        .limit(1)
        .maybeSingle()
      if (config) accountId = config.account_id
    }

    if (!accountId) {
      return NextResponse.json({ error: 'No account linked for QR Code instance' }, { status: 404 })
    }

    const pushName = body.data?.pushName ?? body.name ?? 'Contato'

    // 3. Find or create contact
    let contact = await findExistingContact(admin, accountId, formattedPhone)

    if (!contact) {
      const { data: newContact, error: createContactErr } = await admin
        .from('contacts')
        .insert({
          account_id: accountId,
          name: pushName,
          phone: formattedPhone,
        })
        .select()
        .single()

      if (createContactErr || !newContact) {
        console.error('[qrcode/webhook] Contact creation error:', createContactErr)
        return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 })
      }
      contact = newContact
    }

    if (!contact) {
      return NextResponse.json({ error: 'Contact unresolved' }, { status: 500 })
    }

    const activeContactId = contact.id

    // 4. Find or create conversation
    let { data: conversation } = await admin
      .from('conversations')
      .select('*')
      .eq('account_id', accountId)
      .eq('contact_id', activeContactId)
      .maybeSingle()

    if (!conversation) {
      const { data: newConv, error: createConvErr } = await admin
        .from('conversations')
        .insert({
          account_id: accountId,
          contact_id: activeContactId,
          status: 'open',
          unread_count: 1,
          last_message_at: new Date().toISOString(),
          last_message_preview: messageText.slice(0, 100) || '[Mensagem]',
        })
        .select()
        .single()

      if (createConvErr || !newConv) {
        console.error('[qrcode/webhook] Conversation creation error:', createConvErr)
        return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
      }
      conversation = newConv
    } else {
      // Update existing conversation
      await admin
        .from('conversations')
        .update({
          unread_count: (conversation.unread_count || 0) + 1,
          last_message_at: new Date().toISOString(),
          last_message_preview: messageText.slice(0, 100) || '[Mensagem]',
        })
        .eq('id', conversation.id)
    }

    // 5. Create message row
    const messageId = `qr_in_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const { data: insertedMsg, error: msgErr } = await admin
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        message_id: messageId,
        sender_type: 'customer',
        content_type: 'text',
        content_text: messageText,
        status: 'delivered',
      })
      .select()
      .single()

    if (msgErr || !insertedMsg) {
      console.error('[qrcode/webhook] Message insert error:', msgErr)
      return NextResponse.json({ error: 'Failed to insert message' }, { status: 500 })
    }

    const conversationIdStr = conversation.id as string

    // 6. Trigger Automations, AI, Webhooks
    void runAutomationsForTrigger({
      accountId,
      triggerType: 'new_message_received',
      contactId: activeContactId,
      context: {
        message_text: messageText,
        conversation_id: conversationIdStr,
      },
    })

    void dispatchInboundToAiReply({
      accountId,
      conversationId: conversationIdStr,
      contactId: activeContactId,
      configOwnerUserId: '00000000-0000-0000-0000-000000000000',
    })

    void dispatchWebhookEvent(admin, accountId, 'message.received', {
      message: insertedMsg,
      contact,
      conversation,
    })

    return NextResponse.json({ success: true, messageId: insertedMsg.id })
  } catch (err) {
    console.error('[qrcode/webhook] Exception:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'active', gateway: 'Centro do Sorriso QR Code Webhook' })
}
