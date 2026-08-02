import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { disconnectQrCodeSession } from '@/lib/whatsapp/qrcode-engine'

export async function POST() {
  try {
    const { accountId } = await requireRole('admin')
    const supabase = await createClient()

    await disconnectQrCodeSession(supabase, accountId)
    return NextResponse.json({ success: true, message: 'Disconnected successfully' })
  } catch (err) {
    return toErrorResponse(err)
  }
}
