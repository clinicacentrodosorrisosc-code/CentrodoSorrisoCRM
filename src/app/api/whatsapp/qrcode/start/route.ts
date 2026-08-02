import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { startQrCodeSession } from '@/lib/whatsapp/qrcode-engine'

export async function POST(request: Request) {
  try {
    const { accountId } = await requireRole('admin')
    const supabase = await createClient()

    const body = await request.json().catch(() => ({}))
    const apiUrl = typeof body?.api_url === 'string' ? body.api_url.trim() : undefined
    const apiKey = typeof body?.api_key === 'string' ? body.api_key.trim() : undefined
    const phone = typeof body?.phone === 'string' ? body.phone.trim() : undefined

    const sessionState = await startQrCodeSession(supabase, accountId, {
      apiUrl,
      apiKey,
      phoneNumberForPairing: phone,
    })

    return NextResponse.json({ success: true, session: sessionState })
  } catch (err) {
    return toErrorResponse(err)
  }
}
