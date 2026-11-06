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

export type RoomMemberStatus = 'pending' | 'approved' | 'rejected'

export type DbStudyRoom = {
  id: string
  name: string
  description: string
  level: AiLevel
  interest: AiInterest
  max_members: number
  created_at: string
}

export type DbRoomMember = {
  room_id: string
  user_id: string
  status: RoomMemberStatus
  requested_at: string
  decided_at: string | null
}

export type RoomMessageSenderType = 'member' | 'ai_teacher' | 'ai_student'

export type DbRoomMessage = {
  id: string
  room_id: string
  user_id: string | null
  ai_student_id: string | null
  sender_type: RoomMessageSenderType
  nickname: string
  content: string
  created_at: string
  visible_at: string
  triggered_by: string | null
}

export type AiStudentRole = '질문형' | '공감형' | '조용형' | '엉뚱형'

export type AiStudentPersona = {
  ageGroup: string
  job: string
  motivation: string
  aiLevel: '입문' | '중급' | '고급'
  personality: string
  role: AiStudentRole
  speechStyle: string
  /** 회원 메시지 하나당 이 학생이 반응을 "시도"할 기본 확률 (0~1) */
  replyChance: number
  /** 생성된 답변에 가벼운 오타를 섞을 확률 (0~1), 현재는 프롬프트 힌트로만 사용 */
  typoChance: number
}

export type DbAiStudent = {
  id: string
  room_id: string
  nickname: string
  persona: AiStudentPersona
  is_active: boolean
  created_at: string
}
