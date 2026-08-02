import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _adminClient: SupabaseClient | null = null

export function supabaseAdmin(): SupabaseClient {
  if (!_adminClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yzitycpnaefywkvrsluz.supabase.co'
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6aXR5Y3BuYWVmeXdrdnJzbHV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTYxNzc2NCwiZXhwIjoyMTAxMTkzNzY4fQ.UNpBRd_ASqrp58uzxaH8s2g6eTMPAXuk82cmzzLEXHs'

    _adminClient = createClient(url, serviceKey)
  }
  return _adminClient
}
