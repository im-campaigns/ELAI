import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { ConfigError } from '@/lib/errors'

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
    throw new ConfigError(
      '회원 데이터베이스가 아직 설정되지 않았어요. 관리자에게 문의해주세요. (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 미설정)',
    )
  }

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return client
}

export type AiInterest = '업무활용' | '공부' | '창작' | '기타'
export type AiLevel = 'beginner' | 'intermediate' | 'advanced'

export type DbUser = {
  id: string
  nickname: string
  password_hash: string
  email: string | null
  created_at: string
  job: string | null
  ai_interest: AiInterest | null
  ai_level: AiLevel | null
  onboarding_done: boolean
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
