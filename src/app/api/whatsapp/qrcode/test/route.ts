import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { sendQrCodeMessage } from '@/lib/whatsapp/qrcode-engine'
import { sanitizePhoneForMeta } from '@/lib/whatsapp/phone-utils'

export async function POST(request: Request) {
  try {
    const { accountId } = await requireRole('admin')
    const supabase = await createClient()

    const body = await request.json().catch(() => ({}))
    const phone = typeof body?.phone === 'string' ? body.phone.trim() : ''
    const text = typeof body?.text === 'string' && body.text.trim() ? body.text.trim() : 'Olá! Esta é uma mensagem de teste enviada via conexão QR Code do Centro do Sorriso CRM. 📱✨'

    if (!phone) {
      return NextResponse.json({ error: 'Número de telefone é obrigatório' }, { status: 400 })
    }

    const { data: config } = await supabase
      .from('whatsapp_config')
      .select('*')
      .eq('account_id', accountId)
      .maybeSingle()

    if (!config || config.qrcode_status !== 'connected') {
      return NextResponse.json(
        { error: 'WhatsApp via QR Code não está conectado. Escaneie o QR Code primeiro.' },
        { status: 400 },
      )
    }

    const result = await sendQrCodeMessage(config, {
      to: phone,
      type: 'text',
      text,
    })

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      recipient: sanitizePhoneForMeta(phone),
    })
  } catch (err) {
    return toErrorResponse(err)
  }
}
