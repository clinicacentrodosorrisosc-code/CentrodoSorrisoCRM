import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { getQrCodeStatus, confirmQrCodeScan } from '@/lib/whatsapp/qrcode-engine'

export async function GET() {
  try {
    const { accountId } = await requireRole('agent')
    const supabase = await createClient()

    const status = await getQrCodeStatus(supabase, accountId)
    return NextResponse.json({ success: true, session: status })
  } catch (err) {
    return toErrorResponse(err)
  }
}

export async function POST(request: Request) {
  try {
    const { accountId } = await requireRole('admin')
    const supabase = await createClient()

    const body = await request.json().catch(() => ({}))
    const phone = typeof body?.phone === 'string' ? body.phone.trim() : ''
    const name = typeof body?.name === 'string' ? body.name.trim() : 'WhatsApp Business'

    if (!phone) {
      return NextResponse.json({ error: 'phone is required' }, { status: 400 })
    }

    const session = await confirmQrCodeScan(supabase, accountId, phone, name)
    return NextResponse.json({ success: true, session })
  } catch (err) {
    return toErrorResponse(err)
  }
}
