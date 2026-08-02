import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

// Singleton instance — one client shared across the whole browser session.
// Creating multiple clients causes auth-lock contention ("Lock was released
// because another request stole it") and intermittent fetch failures.
let browserClient: SupabaseClient | undefined

export function createClient() {
  if (browserClient) return browserClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yzitycpnaefywkvrsluz.supabase.co'
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6aXR5Y3BuYWVmeXdrdnJzbHV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2MTc3NjQsImV4cCI6MjEwMTE5Mzc2NH0.V4X5mqFZ1o5RgTmJl-_UCxrUPG70gfuFDvjRrViuh6I'

  browserClient = createBrowserClient(
    url,
    key
  )

  return browserClient
}
