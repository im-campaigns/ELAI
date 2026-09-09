import { createClient, SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

/**
 * Server-only Supabase client using the service role key. Never import this
 * from a 'use client' component — the service role key bypasses RLS.
 */
export function getDb(): SupabaseClient {
  if (client) return client

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 설정되어 있지 않습니다. .env.local을 확인해주세요.',
    )
  }

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return client
}

export type DbUser = {
  id: string
  nickname: string
  password_hash: string
  email: string | null
  created_at: string
}

export type DbChatMessage = {
  id: string
  user_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export type DbProgress = {
  user_id: string
  level: 'beginner' | 'intermediate' | 'advanced'
  subtopic_id: string
  completed_at: string
}
