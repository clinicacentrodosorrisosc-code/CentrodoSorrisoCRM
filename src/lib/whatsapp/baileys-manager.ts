import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  type WASocket,
} from '@whiskeysockets/baileys'
import QRCode from 'qrcode'
import path from 'path'
import fs from 'fs'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { generateQrDataUrl } from './qrcode-engine'

// In-memory socket store per accountId
const activeSockets = new Map<string, WASocket>()

function getSessionDir(accountId: string): string {
  const dir = path.join(process.cwd(), '.next', 'whatsapp_sessions', accountId)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

/**
 * Initialize or get an active Baileys WhatsApp WebSocket session
 */
export async function initBaileysSession(accountId: string, options?: { phoneNumberForPairing?: string }) {
  // If socket already active and connected, return it
  if (activeSockets.has(accountId)) {
    const existing = activeSockets.get(accountId)!
    if (existing.user) {
      return { socket: existing, status: 'connected' }
    }
  }

  const sessionDir = getSessionDir(accountId)
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir)
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307] as [number, number, number] }))

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, undefined as any),
    },
    printQRInTerminal: false,
    syncFullHistory: false,
    browser: ['Centro do Sorriso CRM', 'Chrome', '1.0.0'],
  })

  activeSockets.set(accountId, sock)

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update
    const db = supabaseAdmin()
    const now = new Date().toISOString()

    // 1. QR Code generated from WhatsApp Web server
    if (qr) {
      try {
        const qrcodeUrl = await generateQrDataUrl(qr)
        await db
          .from('whatsapp_config')
          .update({
            connection_type: 'qrcode',
            qrcode_status: 'qrcode_ready',
            qrcode_raw: qr,
            qrcode_url: qrcodeUrl,
            updated_at: now,
          })
          .eq('account_id', accountId)
      } catch (err) {
        console.error('[baileys-manager] Failed to save QR update:', err)
      }
    }

    // 2. Connection status open (Scanned & Authenticated)
    if (connection === 'open') {
      const userJid = sock.user?.id || ''
      const phoneOnly = userJid.split(':')[0].split('@')[0]
      const formattedPhone = phoneOnly.startsWith('+') ? phoneOnly : `+${phoneOnly}`
      const name = sock.user?.name || 'WhatsApp Business'

      await db
        .from('whatsapp_config')
        .update({
          connection_type: 'qrcode',
          qrcode_status: 'connected',
          status: 'connected',
          connected_phone: formattedPhone,
          connected_name: name,
          connected_at: now,
          qrcode_url: null,
          qrcode_raw: null,
          updated_at: now,
        })
        .eq('account_id', accountId)
    }

    // 3. Connection closed / disconnected
    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as any)?.output?.statusCode
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut

      if (!shouldReconnect) {
        activeSockets.delete(accountId)
        // Clear session files on logout
        try {
          fs.rmSync(sessionDir, { recursive: true, force: true })
        } catch {
          // ignore
        }
        await db
          .from('whatsapp_config')
          .update({
            qrcode_status: 'disconnected',
            qrcode_url: null,
            qrcode_raw: null,
            connected_phone: null,
            connected_name: null,
            updated_at: now,
          })
          .eq('account_id', accountId)
      }
    }
  })

  // 4. Listen for inbound messages
  sock.ev.on('messages.upsert', async (m) => {
    if (m.type !== 'notify') return
    for (const msg of m.messages) {
      if (!msg.message || msg.key.fromMe) continue
      try {
        const port = process.env.PORT || '3000'
        await fetch(`http://localhost:${port}/api/whatsapp/qrcode/webhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instance: `cs_acc_${accountId.replace(/-/g, '').slice(0, 16)}`,
            data: msg,
          }),
        }).catch(() => {})
      } catch (err) {
        console.error('[baileys-manager] Failed to forward inbound message:', err)
      }
    }
  })

  // If phone pairing was requested:
  if (options?.phoneNumberForPairing && !sock.authState.creds.registered) {
    const cleanPhone = options.phoneNumberForPairing.replace(/\D/g, '')
    try {
      // Delay slightly for socket handshake
      await new Promise((resolve) => setTimeout(resolve, 1500))
      const pairingCode = await sock.requestPairingCode(cleanPhone)
      return { socket: sock, pairingCode }
    } catch (err) {
      console.error('[baileys-manager] requestPairingCode error:', err)
    }
  }

  return { socket: sock }
}

/**
 * Get active socket instance for account
 */
export function getActiveSocket(accountId: string): WASocket | null {
  return activeSockets.get(accountId) ?? null
}

/**
 * Disconnect socket and delete session
 */
export async function closeBaileysSession(accountId: string): Promise<void> {
  const sock = activeSockets.get(accountId)
  if (sock) {
    try {
      await sock.logout()
    } catch {
      sock.end(undefined)
    }
    activeSockets.delete(accountId)
  }
  const sessionDir = getSessionDir(accountId)
  try {
    fs.rmSync(sessionDir, { recursive: true, force: true })
  } catch {
    // ignore
  }
}
