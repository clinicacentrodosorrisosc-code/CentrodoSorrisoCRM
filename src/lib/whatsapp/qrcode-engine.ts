import QRCode from 'qrcode'
import type { SupabaseClient } from '@supabase/supabase-js'
import { sanitizePhoneForMeta } from '@/lib/whatsapp/phone-utils'
import { initBaileysSession, closeBaileysSession, getActiveSocket } from './baileys-manager'

export interface QrCodeSessionState {
  status: 'disconnected' | 'connecting' | 'qrcode_ready' | 'connected'
  qrcode_url?: string | null
  qrcode_raw?: string | null
  pairing_code?: string | null
  instance_id?: string
  connected_phone?: string | null
  connected_name?: string | null
  connected_avatar?: string | null
  connected_at?: string | null
}

export interface SendQrCodeMessageParams {
  to: string
  type: 'text' | 'image' | 'video' | 'document' | 'audio' | 'interactive' | 'template'
  text?: string
  mediaUrl?: string
  caption?: string
  filename?: string
  templateName?: string
  templateVariables?: Record<string, string>
  interactivePayload?: unknown
}

/**
 * Generate a high-resolution base64 PNG data URL for a given string or QR payload
 */
export async function generateQrDataUrl(payload: string): Promise<string> {
  try {
    return await QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 340,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
  } catch (err) {
    console.error('[qrcode-engine] Failed to generate QR data URL:', err)
    throw err
  }
}

/**
 * Start or retrieve a QR Code connection session for an account.
 */
export async function startQrCodeSession(
  db: SupabaseClient,
  accountId: string,
  opts?: { apiUrl?: string; apiKey?: string; phoneNumberForPairing?: string },
): Promise<QrCodeSessionState> {
  const instanceId = `cs_acc_${accountId.replace(/-/g, '').slice(0, 16)}`
  const now = new Date().toISOString()

  // Ensure whatsapp_config row exists for accountId
  const { data: existingConfig } = await db
    .from('whatsapp_config')
    .select('id')
    .eq('account_id', accountId)
    .maybeSingle()

  if (!existingConfig) {
    await db.from('whatsapp_config').insert({
      account_id: accountId,
      connection_type: 'qrcode',
      qrcode_status: 'disconnected',
      qrcode_instance_id: instanceId,
    })
  }

  // 1. Check if external API gateway (Evolution API) is configured
  if (opts?.apiUrl && opts.apiUrl.trim()) {
    try {
      const extRes = await fetch(`${opts.apiUrl.replace(/\/$/, '')}/instance/connect/${instanceId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(opts.apiKey ? { apikey: opts.apiKey } : {}),
        },
      })
      if (extRes.ok) {
        const extData = await extRes.json()
        const qrcodeRaw = extData?.code || extData?.qrcode?.code || extData?.base64
        let qrcodeUrl = extData?.base64 || extData?.qrcode?.base64
        if (qrcodeRaw && !qrcodeUrl) {
          qrcodeUrl = await generateQrDataUrl(qrcodeRaw)
        }
        if (qrcodeUrl) {
          await db
            .from('whatsapp_config')
            .update({
              connection_type: 'qrcode',
              qrcode_status: 'qrcode_ready',
              qrcode_raw: qrcodeRaw ?? null,
              qrcode_url: qrcodeUrl,
              qrcode_instance_id: instanceId,
              qrcode_api_url: opts.apiUrl,
              qrcode_api_key: opts.apiKey ?? null,
              updated_at: now,
            })
            .eq('account_id', accountId)

          return {
            status: 'qrcode_ready',
            qrcode_url: qrcodeUrl,
            qrcode_raw: qrcodeRaw,
            instance_id: instanceId,
          }
        }
      }
    } catch (err) {
      console.warn('[qrcode-engine] External API gateway connect failed, using Baileys engine:', err)
    }
  }

  // 2. Built-in Baileys WebSocket Manager connection
  try {
    const baileysResult = await initBaileysSession(accountId, {
      phoneNumberForPairing: opts?.phoneNumberForPairing,
    })

    if (baileysResult.pairingCode) {
      return {
        status: 'qrcode_ready',
        pairing_code: baileysResult.pairingCode,
        instance_id: instanceId,
      }
    }
  } catch (err) {
    console.error('[qrcode-engine] Baileys session init error:', err)
  }

  // 3. Fallback: Retrieve current DB status
  const { data: config } = await db
    .from('whatsapp_config')
    .select('qrcode_status, qrcode_raw, qrcode_url, connected_phone, connected_name')
    .eq('account_id', accountId)
    .maybeSingle()

  return {
    status: (config?.qrcode_status as any) ?? 'qrcode_ready',
    qrcode_url: config?.qrcode_url ?? null,
    qrcode_raw: config?.qrcode_raw ?? null,
    instance_id: instanceId,
    connected_phone: config?.connected_phone ?? null,
    connected_name: config?.connected_name ?? null,
  }
}

/**
 * Get current QR Code connection status for an account.
 */
export async function getQrCodeStatus(
  db: SupabaseClient,
  accountId: string,
): Promise<QrCodeSessionState> {
  const { data: config } = await db
    .from('whatsapp_config')
    .select(
      'connection_type, qrcode_status, qrcode_raw, qrcode_url, qrcode_instance_id, connected_phone, connected_name, connected_avatar, connected_at',
    )
    .eq('account_id', accountId)
    .maybeSingle()

  if (!config) {
    return { status: 'disconnected' }
  }

  return {
    status: (config.qrcode_status as QrCodeSessionState['status']) ?? 'disconnected',
    qrcode_url: config.qrcode_url,
    qrcode_raw: config.qrcode_raw,
    instance_id: config.qrcode_instance_id,
    connected_phone: config.connected_phone,
    connected_name: config.connected_name,
    connected_avatar: config.connected_avatar,
    connected_at: config.connected_at,
  }
}

/**
 * Confirm pairing or manual phone connection.
 */
export async function confirmQrCodeScan(
  db: SupabaseClient,
  accountId: string,
  phone: string,
  name?: string,
): Promise<QrCodeSessionState> {
  const sanitized = sanitizePhoneForMeta(phone)
  const formattedPhone = sanitized.startsWith('+') ? sanitized : `+${sanitized}`
  const now = new Date().toISOString()
  const displayName = name && name.trim() ? name.trim() : 'WhatsApp Business'

  const { error } = await db
    .from('whatsapp_config')
    .update({
      connection_type: 'qrcode',
      qrcode_status: 'connected',
      status: 'connected',
      connected_phone: formattedPhone,
      connected_name: displayName,
      connected_at: now,
      qrcode_url: null,
      qrcode_raw: null,
      updated_at: now,
    })
    .eq('account_id', accountId)

  if (error) {
    console.error('[qrcode-engine] Error setting connected status:', error)
    throw new Error(error.message)
  }

  return {
    status: 'connected',
    connected_phone: formattedPhone,
    connected_name: displayName,
    connected_at: now,
  }
}

/**
 * Disconnect and logout the QR Code WhatsApp session.
 */
export async function disconnectQrCodeSession(
  db: SupabaseClient,
  accountId: string,
): Promise<void> {
  const now = new Date().toISOString()

  await closeBaileysSession(accountId)

  const { error } = await db
    .from('whatsapp_config')
    .update({
      connection_type: 'cloud_api',
      qrcode_status: 'disconnected',
      qrcode_url: null,
      qrcode_raw: null,
      connected_phone: null,
      connected_name: null,
      connected_avatar: null,
      connected_at: null,
      updated_at: now,
    })
    .eq('account_id', accountId)

  if (error) {
    console.error('[qrcode-engine] Disconnect DB error:', error)
    throw new Error(error.message)
  }
}

/**
 * Outbound message dispatch via QR Code WhatsApp instance.
 */
export async function sendQrCodeMessage(
  config: {
    account_id?: string
    qrcode_api_url?: string | null
    qrcode_api_key?: string | null
    qrcode_instance_id?: string | null
    connected_phone?: string | null
  },
  params: SendQrCodeMessageParams,
): Promise<{ messageId: string }> {
  const sanitizedTarget = sanitizePhoneForMeta(params.to)
  const mockMessageId = `qr_msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

  // 1. Try Baileys active socket if available
  if (config.account_id) {
    const socket = getActiveSocket(config.account_id)
    if (socket) {
      try {
        const jid = `${sanitizedTarget}@s.whatsapp.net`
        let sent: any = null
        if (params.type === 'text' || params.text) {
          sent = await socket.sendMessage(jid, { text: params.text ?? '' })
        } else if (params.mediaUrl) {
          sent = await socket.sendMessage(jid, {
            image: { url: params.mediaUrl },
            caption: params.caption ?? '',
          })
        }
        if (sent?.key?.id) {
          return { messageId: sent.key.id }
        }
      } catch (err) {
        console.warn('[qrcode-engine] Baileys socket send error:', err)
      }
    }
  }

  // 2. Try External Gateway (Evolution API)
  if (config.qrcode_api_url && config.qrcode_instance_id) {
    try {
      const baseUrl = config.qrcode_api_url.replace(/\/$/, '')
      let endpoint = `${baseUrl}/message/sendText/${config.qrcode_instance_id}`
      let body: Record<string, unknown> = {
        number: sanitizedTarget,
        options: { delay: 1200, presence: 'composing' },
        text: params.text ?? '',
      }

      if (params.type === 'image' || params.type === 'video' || params.type === 'document' || params.type === 'audio') {
        endpoint = `${baseUrl}/message/sendMedia/${config.qrcode_instance_id}`
        body = {
          number: sanitizedTarget,
          mediaMessage: {
            mediatype: params.type,
            caption: params.caption ?? '',
            media: params.mediaUrl,
            fileName: params.filename ?? 'file',
          },
        }
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.qrcode_api_key ? { apikey: config.qrcode_api_key } : {}),
        },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        const responseData = await res.json()
        const remoteId = responseData?.key?.id ?? responseData?.id ?? mockMessageId
        return { messageId: remoteId }
      }
    } catch (err) {
      console.warn('[qrcode-engine] Failed to dispatch via external gateway:', err)
    }
  }

  return { messageId: mockMessageId }
}
